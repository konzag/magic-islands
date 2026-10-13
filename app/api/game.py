"""The game page at `/` (served from memory with its own hash-based CSP and an ETag)."""

from fastapi import APIRouter, Request, Response

from app.services.page import Page

router = APIRouter(include_in_schema=False)


@router.api_route("/", methods=["GET", "HEAD"])
async def index(request: Request) -> Response:
    page: Page = request.app.state.page
    headers = {"ETag": page.etag, "Content-Security-Policy": page.csp()}
    if request.headers.get("if-none-match") == page.etag:
        return Response(status_code=304, headers=headers)
    body = b"" if request.method == "HEAD" else page.body
    headers["Content-Length"] = str(len(page.body))
    return Response(content=body, media_type="text/html; charset=utf-8", headers=headers)


@router.api_route("/favicon.ico", methods=["GET", "HEAD"])
async def favicon() -> Response:
    """No icon file: 204 instead of a JSON 404 on every page load."""
    return Response(status_code=204)
