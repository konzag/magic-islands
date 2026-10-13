"""STD-14 error shape: {"error": {code, message, trace_id, details}}."""

from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = structlog.get_logger("magic-islands.errors")

_CODES = {400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}


def error_body(request: Request, code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "trace_id": request.headers.get("x-trace-id", ""),
            "details": details or {},
        }
    }


async def http_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, StarletteHTTPException):  # pragma: no cover - registered for this type only
        return await unhandled_error_handler(request, exc)
    code = _CODES.get(exc.status_code, "HTTP_ERROR")
    message = exc.detail if isinstance(exc.detail, str) else code
    return JSONResponse(error_body(request, code, message), status_code=exc.status_code, headers=exc.headers)


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):  # pragma: no cover - registered for this type only
        return await unhandled_error_handler(request, exc)
    fields = [".".join(str(p) for p in e.get("loc", ())) for e in exc.errors()]
    return JSONResponse(
        error_body(request, "VALIDATION_ERROR", "Μη έγκυρη αίτηση", {"fields": fields}), status_code=422
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    log.error("unhandled_error", path=request.url.path, error_type=type(exc).__name__)
    return JSONResponse(error_body(request, "INTERNAL_ERROR", "Εσωτερικό σφάλμα"), status_code=500)


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
