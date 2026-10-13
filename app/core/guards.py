"""Exposure rules for a public, auth-less page (ADR-0001).

Funnel (prod): tailscaled proxies https://<apps>.ts.net:8443 to 127.0.0.1:8087 and marks every request with the
`Tailscale-Funnel-Request` header. Through the Funnel only the game itself is reachable (GET/HEAD of `/`,
`/sw.js` (offline play), `/static/...`, `/favicon.ico`, `/health/live`); everything else answers 404, so
/version, /health/ready, /health/security and /metrics never leak to the internet.

/metrics: only for a direct socket peer in METRICS_ALLOW_IPS (the Prometheus host) that is not proxied (no
Funnel header, no X-Forwarded-For / Forwarded). uvicorn runs with --forwarded-allow-ips=127.0.0.1, so a forged
X-Forwarded-For from the LAN never changes the peer, and a request relayed by Caddy (also on the Prometheus
host) carries X-Forwarded-For and is refused.
"""

import ipaddress
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse

from app.core.config import IPNetwork
from app.core.errors import error_body

FUNNEL_HEADER = "tailscale-funnel-request"
_PROXY_HEADERS = (FUNNEL_HEADER, "x-forwarded-for", "forwarded")
PUBLIC_EXACT = frozenset({"/", "/sw.js", "/favicon.ico", "/health/live"})
PUBLIC_PREFIX = "/static/"


def is_funnel(request: Request) -> bool:
    return FUNNEL_HEADER in request.headers


def is_public_path(path: str) -> bool:
    return path in PUBLIC_EXACT or (path.startswith(PUBLIC_PREFIX) and ".." not in path)


def metrics_allowed(request: Request, networks: tuple[IPNetwork, ...]) -> bool:
    if any(h in request.headers for h in _PROXY_HEADERS):
        return False
    host = request.client.host if request.client else ""
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(addr in net for net in networks)


def _not_found(request: Request) -> JSONResponse:
    return JSONResponse(error_body(request, "NOT_FOUND", "Δεν βρέθηκε"), status_code=404)


async def exposure_guard(
    request: Request, call_next: Callable[[Request], Awaitable[Response]], networks: tuple[IPNetwork, ...]
) -> Response:
    """404 for everything the current channel may not see (no hint that the path exists)."""
    path = request.url.path
    if is_funnel(request) and (request.method not in ("GET", "HEAD") or not is_public_path(path)):
        return _not_found(request)
    if path == "/metrics" and not metrics_allowed(request, networks):
        return _not_found(request)
    return await call_next(request)
