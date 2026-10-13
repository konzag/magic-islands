"""Unversioned infrastructure endpoints (STD-13): /health/live, /health/ready, /health/security, /version.

Only /health/live is reachable through the Funnel (app/core/guards.py).
"""

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.middleware import SECURITY_HEADER_NAMES

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def health_live() -> dict[str, str]:
    """Liveness: the process answers."""
    return {"status": "alive"}


@router.get("/health/ready")
async def health_ready(request: Request) -> JSONResponse:
    """Ready = the game page is loaded and its CSP hashes are computed (there is no database)."""
    page = getattr(request.app.state, "page", None)
    if page is None:
        return JSONResponse({"status": "degraded", "checks": {"page": "not loaded"}}, status_code=503)
    return JSONResponse({"status": "ready", "checks": {"page": "ok"}})


@router.get("/api/health")
async def api_health(request: Request) -> JSONResponse:
    """Alias of /health/ready (homelab auto-deploy HEALTH map convention)."""
    return await health_ready(request)


@router.get("/health/security")
async def health_security(request: Request) -> dict[str, Any]:
    """The security controls that are actually active."""
    s = request.app.state.settings
    return {
        "headers": SECURITY_HEADER_NAMES,
        "csp": "page: inline script/style by sha256 hash, self only, no network; other responses: default-src none",
        "docs_exposed": s.docs_enabled,
        "auth": "none by design (public kids' game, no data; ADR-0001)",
        "funnel": "only / , /static/*, /favicon.ico, /health/live (GET/HEAD); everything else 404",
        "metrics": "direct peers in METRICS_ALLOW_IPS only, never proxied",
        "service": s.service_name,
    }


@router.get("/version")
async def version(request: Request) -> dict[str, str | None]:
    """Deployed build: `{version, commit, commit_short, built_at, started_at}`."""
    info: dict[str, str | None] = request.app.state.build_info.as_dict()
    return info
