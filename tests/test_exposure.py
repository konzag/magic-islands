"""Funnel and /metrics exposure rules (ADR-0001) and the security headers on every response."""

from collections.abc import Callable
from contextlib import AbstractAsyncContextManager

import pytest
from httpx import AsyncClient

from app.core.config import Settings
from app.core.guards import is_public_path
from app.core.middleware import NONE_CSP, SECURITY_HEADERS, cache_control_for
from tests.conftest import FUNNEL, PROMETHEUS

ClientFrom = Callable[[str], AbstractAsyncContextManager[AsyncClient]]

PUBLIC = [
    "/",
    "/sw.js",
    "/static/fonts/comfortaa.css",
    "/static/manifest.webmanifest",
    "/static/icons/icon-192.png",
    "/favicon.ico",
    "/health/live",
]
PRIVATE = ["/metrics", "/version", "/health/ready", "/health/security", "/api/health", "/docs", "/openapi.json"]


@pytest.mark.parametrize("path", PUBLIC)
async def test_funnel_reaches_the_game(client: AsyncClient, path: str) -> None:
    r = await client.get(path, headers=FUNNEL)
    assert r.status_code in (200, 204)


@pytest.mark.parametrize("path", PRIVATE)
async def test_funnel_gets_404_for_everything_else(client_from: ClientFrom, path: str) -> None:
    async with client_from(PROMETHEUS) as c:  # even from the Prometheus host
        r = await c.get(path, headers=FUNNEL)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


async def test_funnel_rejects_non_get_methods(client: AsyncClient) -> None:
    assert (await client.post("/", headers=FUNNEL)).status_code == 404
    assert (await client.head("/", headers=FUNNEL)).status_code == 200


async def test_metrics_served_to_prometheus_host(client_from: ClientFrom) -> None:
    async with client_from(PROMETHEUS) as c:
        r = await c.get("/metrics")
    assert r.status_code == 200
    assert "app_build_info{" in r.text
    assert r.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("peer", ["127.0.0.1", "192.168.1.50", "100.64.0.7", "testclient"])
async def test_metrics_404_for_other_peers(client_from: ClientFrom, peer: str) -> None:
    async with client_from(peer) as c:
        assert (await c.get("/metrics")).status_code == 404


@pytest.mark.parametrize("header", ["X-Forwarded-For", "Forwarded", "Tailscale-Funnel-Request"])
async def test_metrics_404_when_proxied_even_from_prometheus_host(client_from: ClientFrom, header: str) -> None:
    async with client_from(PROMETHEUS) as c:
        assert (await c.get("/metrics", headers={header: "203.0.113.9"})).status_code == 404


async def test_lan_reaches_private_endpoints_without_funnel(client: AsyncClient) -> None:
    assert (await client.get("/version")).status_code == 200


@pytest.mark.parametrize("path", ["/", "/version", "/static/fonts/comfortaa.css", "/nope"])
async def test_security_headers_on_every_response(client: AsyncClient, path: str) -> None:
    r = await client.get(path)
    for name, value in SECURITY_HEADERS.items():
        assert r.headers[name] == value
    assert "server" not in r.headers or "uvicorn" not in r.headers["server"]
    if path != "/":
        assert r.headers["content-security-policy"] == NONE_CSP


def test_public_path_rules() -> None:
    assert is_public_path("/static/fonts/x.woff2")
    assert not is_public_path("/static/../app/main.py")
    assert not is_public_path("/staticx")
    assert is_public_path("/sw.js")
    assert not is_public_path("/sw.js.map")


def test_cache_control_rules() -> None:
    assert cache_control_for("/") == "no-cache"
    assert cache_control_for("/static/a.css") == "no-cache"
    assert cache_control_for("/sw.js") == "no-cache"
    assert cache_control_for("/health/live") == "no-store"
    assert cache_control_for("/metrics") == "no-store"


def test_metrics_networks_drop_invalid_entries() -> None:
    s = Settings(metrics_allow_ips="192.168.1.11, not-an-ip, ,10.0.0.0/30")
    assert [str(n) for n in s.metrics_networks] == ["192.168.1.11/32", "10.0.0.0/30"]
