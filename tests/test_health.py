from httpx import AsyncClient


async def test_live_returns_alive(client: AsyncClient) -> None:
    r = await client.get("/health/live")
    assert r.status_code == 200
    assert r.json() == {"status": "alive"}


async def test_ready_and_api_health_with_page_loaded_return_ready(client: AsyncClient) -> None:
    for path in ("/health/ready", "/api/health"):
        r = await client.get(path)
        assert r.status_code == 200
        assert r.json() == {"status": "ready", "checks": {"page": "ok"}}


async def test_ready_without_page_returns_503(client: AsyncClient) -> None:
    from app.main import app

    page = app.state.page
    del app.state.page
    try:
        r = await client.get("/health/ready")
    finally:
        app.state.page = page
    assert r.status_code == 503
    assert r.json()["status"] == "degraded"


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
