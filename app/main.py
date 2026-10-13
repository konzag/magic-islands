"""Application wiring only (STD-03): routers, middleware, lifespan."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import game, health
from app.core.config import Settings, settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import setup_middleware
from app.core.observability import setup_metrics, setup_tracing
from app.services.page import STATIC, load_page
from app.version import load_build_info


def create_app(cfg: Settings) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        log = configure_logging(cfg.service_name, cfg.log_level)
        build = app.state.build_info
        log.info("startup", version=build.version, environment=cfg.environment, page_bytes=len(page.body))
        yield
        log.info("shutdown")

    app = FastAPI(
        title=cfg.service_name,
        version="1",
        description="Τα Μαγικά Νησιά: a static HTML5 game for the kids, served with a strict CSP.",
        lifespan=lifespan,
        docs_url="/docs" if cfg.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if cfg.docs_enabled else None,
    )
    page = load_page()  # fail fast: a broken page must not deploy (auto-deploy rolls back)
    app.state.settings = cfg
    app.state.build_info = load_build_info()
    app.state.page = page
    register_error_handlers(app)
    setup_middleware(app, cfg)
    setup_metrics(app, app.state.build_info)
    setup_tracing(app, cfg)
    app.include_router(health.router)
    app.include_router(game.router)
    app.mount("/static", StaticFiles(directory=STATIC), name="static")
    return app


app = create_app(settings)
