"""Unversioned infrastructure endpoints (STD-13): /health/live, /health/ready, /health/security, /version."""

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
    """Ready: the skeleton has no dependencies (no DB)."""
    return JSONResponse({"status": "ready", "checks": {}})


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
        "csp": "default-src none",
        "docs_exposed": s.docs_enabled,
        "auth": "none by design (public kids' game, no data; ADR-0001)",
        "service": s.service_name,
    }


@router.get("/version")
async def version(request: Request) -> dict[str, str | None]:
    """Deployed build: `{version, commit, commit_short, built_at, started_at}`."""
    info: dict[str, str | None] = request.app.state.build_info.as_dict()
    return info
