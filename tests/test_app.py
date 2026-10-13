"""Wiring: page loading errors, STD-14 errors, settings, tracing switch, the CI script extractor."""

from pathlib import Path

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.core.observability import setup_tracing
from app.main import create_app
from app.services.page import Page, PageError, csp_hash, load_page
from tools import extract_inline_js


def test_csp_hash_known_value() -> None:
    # echo -n 'alert(1)' | openssl dgst -sha256 -binary | base64
    assert csp_hash("alert(1)") == "'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='"


@pytest.mark.parametrize(
    ("content", "reason"),
    [
        ("<style>a{}</style>", "no inline <script>"),
        ('<script src="x.js"></script><script>1</script>', "external"),
        ('<button onclick="go()">x</button><script>1</script>', "event handler"),
    ],
)
def test_load_page_rejects_unsafe_shapes(tmp_path: Path, content: str, reason: str) -> None:
    f = tmp_path / "index.html"
    f.write_text(content, encoding="utf-8")
    with pytest.raises(PageError, match=reason):
        load_page(f)


def test_load_page_ignores_handler_like_text_inside_script(tmp_path: Path) -> None:
    f = tmp_path / "index.html"
    f.write_text("<p>x</p><script>let once = 1; el.onclick = go;</script>", encoding="utf-8")
    assert len(load_page(f).script_hashes) == 1


def test_load_page_missing_or_binary_file(tmp_path: Path) -> None:
    with pytest.raises(PageError, match="FileNotFoundError"):
        load_page(tmp_path / "missing.html")
    bad = tmp_path / "bad.html"
    bad.write_bytes(b"\xff\xfe<script>")
    with pytest.raises(PageError, match="UnicodeDecodeError"):
        load_page(bad)


def test_page_csp_without_styles() -> None:
    page = Page(body=b"", etag='"x"', script_hashes=("'sha256-a'",), style_hashes=())
    assert "style-src 'self' " in page.csp() + " "


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


def test_extract_inline_js(tmp_path: Path) -> None:
    out = tmp_path / "game.js"
    assert extract_inline_js.main(["x", str(out)]) == 0
    assert "requestAnimationFrame(frame)" in out.read_text(encoding="utf-8")
    assert extract_inline_js.main(["x"]) == 2
