"""Wiring: STD-14 errors, settings, tracing switch."""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.core.observability import setup_tracing
from app.main import create_app


async def _get(app: FastAPI, path: str) -> tuple[int, dict[str, object]]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get(path)
    return r.status_code, r.json()


async def test_unhandled_error_is_generic_std14_500() -> None:
    app = create_app(Settings(environment="test"))

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("secret detail")

    status, body = await _get(app, "/boom")
    assert status == 500
    assert body == {"error": {"code": "INTERNAL_ERROR", "message": "Εσωτερικό σφάλμα", "trace_id": "", "details": {}}}


async def test_validation_and_method_errors_use_std14_shape() -> None:
    app = create_app(Settings(environment="test"))

    @app.get("/n/{num}")
    async def num(num: int) -> dict[str, int]:
        return {"n": num}

    status, body = await _get(app, "/n/abc")
    assert status == 422
    assert body["error"]["code"] == "VALIDATION_ERROR"  # type: ignore[index]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/health/live")
    assert r.status_code == 405
    assert r.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


async def test_prod_hides_docs() -> None:
    app = create_app(Settings(environment="prod"))
    status, body = await _get(app, "/docs")
    assert status == 404
    assert body["error"]["code"] == "NOT_FOUND"  # type: ignore[index]


async def test_lifespan_logs_startup_and_shutdown(capsys: pytest.CaptureFixture[str]) -> None:
    app = create_app(Settings(environment="test"))
    async with app.router.lifespan_context(app):
        pass
    out = capsys.readouterr().out
    assert '"event": "startup"' in out and '"event": "shutdown"' in out


def test_settings_normalise_log_level() -> None:
    assert Settings(log_level="debug").log_level == "DEBUG"  # type: ignore[arg-type]
    assert Settings(environment="staging").docs_enabled is False


def test_tracing_disabled_by_default() -> None:
    assert setup_tracing(FastAPI(), Settings()) is False


def test_tracing_enabled_instruments_app(monkeypatch: pytest.MonkeyPatch) -> None:
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc import trace_exporter
    from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult

    class NullExporter(SpanExporter):
        def __init__(self, **_kwargs: object) -> None:
            pass

        def export(self, spans: object) -> SpanExportResult:
            return SpanExportResult.SUCCESS

    providers: list[object] = []
    monkeypatch.setattr(trace_exporter, "OTLPSpanExporter", NullExporter)
    monkeypatch.setattr(trace, "set_tracer_provider", providers.append)  # keep the global provider untouched
    app = FastAPI()
    assert setup_tracing(app, Settings(otel_enabled=True, otel_exporter_otlp_endpoint="http://127.0.0.1:4317"))
    assert len(providers) == 1
