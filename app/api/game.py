"""The game page at `/` (served from memory with its own hash-based CSP and an ETag) and its service worker."""

from fastapi import APIRouter, Request, Response

from app.services.page import Page
from app.services.pwa import SW_CSP, ServiceWorker

router = APIRouter(include_in_schema=False)


def _cached(request: Request, body: bytes, etag: str, csp: str, media_type: str) -> Response:
    headers = {"ETag": etag, "Content-Security-Policy": csp}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    headers["Content-Length"] = str(len(body))
    return Response(content=b"" if request.method == "HEAD" else body, media_type=media_type, headers=headers)


@router.api_route("/", methods=["GET", "HEAD"])
async def index(request: Request) -> Response:
    page: Page = request.app.state.page
    return _cached(request, page.body, page.etag, page.csp(), "text/html; charset=utf-8")


@router.api_route("/sw.js", methods=["GET", "HEAD"])
async def service_worker(request: Request) -> Response:
    """Offline play (app/services/pwa.py). Served from `/` so that its scope covers the page."""
    sw: ServiceWorker = request.app.state.service_worker
    return _cached(request, sw.body, sw.etag, SW_CSP, "text/javascript; charset=utf-8")


@router.api_route("/favicon.ico", methods=["GET", "HEAD"])
async def favicon() -> Response:
    """No icon file: 204 instead of a JSON 404 on every page load."""
    return Response(status_code=204)
