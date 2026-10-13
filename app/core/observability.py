"""/metrics (prometheus-fastapi-instrumentator) + app_build_info + optional OpenTelemetry tracing."""

import structlog
from fastapi import FastAPI
from prometheus_client import Gauge
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import Settings
from app.version import BuildInfo

log = structlog.get_logger("magic-islands.observability")

# Fleet shape: `app_build_info{version,commit} 1`, commit = 7-char short SHA (same as `commit_short` in /version).
BUILD_INFO = Gauge("app_build_info", "Deployed build of this app", ["version", "commit"])


def setup_metrics(app: FastAPI, build: BuildInfo) -> None:
    BUILD_INFO.clear()
    BUILD_INFO.labels(version=build.version, commit=build.short).set(1)
    # The static files are mounted, not routed: group them so labels stay bounded.
    Instrumentator(
        excluded_handlers=["/metrics", "/health/live"],
        should_group_untemplated=True,
    ).instrument(app).expose(app, include_in_schema=False)


def setup_tracing(app: FastAPI, settings: Settings) -> bool:
    """Configure OTel tracing. Returns True when tracing was enabled."""
    if not settings.otel_enabled:
        return False
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import SERVICE_NAME, Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:  # pragma: no cover - packages are in requirements.txt
        log.warning("otel_packages_missing")
        return False

    endpoint = settings.otel_exporter_otlp_endpoint
    provider = TracerProvider(resource=Resource(attributes={SERVICE_NAME: settings.service_name}))
    exporter = OTLPSpanExporter(endpoint=endpoint, insecure=endpoint.startswith("http://"))
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app, excluded_urls="/metrics,/health/live")
    log.info("otel_enabled", endpoint=endpoint)
    return True
