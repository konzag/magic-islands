"""Shared fixtures (STD-07). The environment is set BEFORE the app is imported.

STD-07 `db_session` is N/A: the app has no database (ADR-0001). `client` talks to the ASGI app in-process;
`client_from(peer)` builds one whose socket peer is `peer` (for the /metrics and Funnel rules).
"""

import os

os.environ["ENVIRONMENT"] = "test"
os.environ["TESTING"] = "1"
for _name in ("METRICS_ALLOW_IPS", "OTEL_ENABLED", "BUILD_SHA", "BUILD_TIME"):
    os.environ.pop(_name, None)

import socket  # noqa: E402
from collections.abc import AsyncIterator, Callable, Iterator  # noqa: E402
from contextlib import AbstractAsyncContextManager, asynccontextmanager  # noqa: E402
from typing import Any  # noqa: E402

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.main import app  # noqa: E402

PROMETHEUS = "192.168.1.11"
FUNNEL = {"Tailscale-Funnel-Request": "?1"}


@asynccontextmanager
async def _client(peer: str) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app, client=(peer, 40000))
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with _client("127.0.0.1") as c:
        yield c


@pytest.fixture
def client_from() -> Callable[[str], AbstractAsyncContextManager[AsyncClient]]:
    return _client


@pytest.fixture
def mock_external_apis(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Opt-in: any outbound socket connection fails the test (the app makes none by design)."""

    def refuse(*_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("unexpected outbound network call")

    monkeypatch.setattr(socket.socket, "connect", refuse)
    yield
