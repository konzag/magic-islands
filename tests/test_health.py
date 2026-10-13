from httpx import AsyncClient


async def test_live_returns_alive(client: AsyncClient) -> None:
    r = await client.get("/health/live")
    assert r.status_code == 200
    assert r.json() == {"status": "alive"}


async def test_ready_and_api_health_return_ready(client: AsyncClient) -> None:
    for path in ("/health/ready", "/api/health"):
        r = await client.get(path)
        assert r.status_code == 200
        assert r.json()["status"] == "ready"


async def test_security_endpoint_describes_controls(client: AsyncClient) -> None:
    body = (await client.get("/health/security")).json()
    assert "Content-Security-Policy" in body["headers"]
    assert body["service"] == "magic-islands"
    assert body["docs_exposed"] is True  # ENVIRONMENT=test


async def test_version_shape_matches_fleet_contract(client: AsyncClient) -> None:
    r = await client.get("/version")
    assert r.status_code == 200
    assert set(r.json()) == {"version", "commit", "commit_short", "built_at", "started_at"}
    assert r.headers["cache-control"] == "no-store"


async def test_security_headers_and_std14_404(client: AsyncClient) -> None:
    r = await client.get("/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["content-security-policy"].startswith("default-src 'none'")


async def test_metrics_has_build_info(client: AsyncClient) -> None:
    assert "app_build_info{" in (await client.get("/metrics")).text
