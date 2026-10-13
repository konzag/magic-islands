"""Security headers, exposure guard (app/core/guards.py) and request logging.

Every response gets HSTS, X-Frame-Options DENY, nosniff, no-referrer, a restrictive Permissions-Policy and a CSP.
The game page (`/`) gets the hash-based policy from app/services/page.py; everything else (JSON, fonts, CSS)
gets `default-src 'none'`. Client IPs are never logged (public page used by children: data minimisation).
"""

import time
from collections.abc import Awaitable, Callable

import structlog
from fastapi import FastAPI, Request, Response

from app.core.config import Settings
from app.core.errors import unhandled_error_handler
from app.core.guards import exposure_guard, is_funnel

log = structlog.get_logger("magic-islands.middleware")

NONE_CSP = "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
_DOCS_PATHS = ("/docs", "/openapi.json")

SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()",
}
SECURITY_HEADER_NAMES = [*SECURITY_HEADERS, "Content-Security-Policy"]


def cache_control_for(path: str) -> str:
    """Fleet baseline: API/health/version/metrics no-store; the page and its assets revalidate (ETag)."""
    if path == "/" or path.startswith("/static/") or path == "/favicon.ico":
        return "no-cache"
    return "no-store"


def setup_middleware(app: FastAPI, settings: Settings) -> None:
    networks = settings.metrics_networks

    @app.middleware("http")
    async def security_and_logging(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        start = time.perf_counter()
        try:
            response = await exposure_guard(request, call_next, networks)
        except Exception as exc:  # noqa: BLE001 - converted to a generic STD-14 500
            response = await unhandled_error_handler(request, exc)
        path = request.url.path
        if path not in ("/metrics", "/health/live"):
            log.info(
                "request",
                method=request.method,
                path=path,
                status=response.status_code,
                funnel=is_funnel(request),
                duration_ms=round((time.perf_counter() - start) * 1000, 1),
            )
        if not (settings.docs_enabled and path.startswith(_DOCS_PATHS)):  # Swagger (dev only) needs a CDN
            response.headers.setdefault("Content-Security-Policy", NONE_CSP)
        for name, value in SECURITY_HEADERS.items():
            response.headers[name] = value
        response.headers["Cache-Control"] = cache_control_for(path)
        return response
