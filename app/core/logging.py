"""structlog JSON logging to stdout (STD-12), with secret redaction on every entry."""

import logging
import sys
from collections.abc import Iterable, MutableMapping
from typing import Any

import structlog

from app.core.redact import redact


def _service_adder(service_name: str) -> structlog.types.Processor:
    """Processor that stamps the STD-12 `service` field on every entry."""

    def add_service(_logger: Any, _method: str, event_dict: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        event_dict.setdefault("service", service_name)
        return event_dict

    return add_service


def _redactor(secrets: Iterable[str]) -> structlog.types.Processor:
    """Processor that scrubs configured secret values and token-looking strings from all fields."""
    known = tuple(s for s in secrets if s)

    def scrub(_logger: Any, _method: str, event_dict: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        for key, value in list(event_dict.items()):
            if isinstance(value, str):
                event_dict[key] = redact(value, known)
        return event_dict

    return scrub


def configure_logging(
    service_name: str, log_level: str = "INFO", secrets: Iterable[str] = ()
) -> structlog.stdlib.BoundLogger:
    """Configure structlog JSON logging to stdout (journald captures it). Safe to call repeatedly."""
    level = logging.getLevelName(log_level.upper())
    if not isinstance(level, int):
        level = logging.INFO
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level, force=True)
    # httpx logs full request URLs at INFO; keep it quiet so query strings never reach the journal.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            _service_adder(service_name),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            _redactor(secrets),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=False,
    )
    logger: structlog.stdlib.BoundLogger = structlog.get_logger(service_name)
    return logger
