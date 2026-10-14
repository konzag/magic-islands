"""Offline play / installable: manifest, icons, the service worker at /sw.js and the page CSP for them."""

import json
import struct
import zlib

from httpx import AsyncClient

from app.main import app
from app.services.page import INDEX
from app.services.pwa import SW_CSP, build_service_worker, precache_assets
from tests.conftest import FUNNEL
from tools import make_icons


def _directives(csp: str) -> dict[str, str]:
    return dict(d.split(" ", 1) for d in csp.split("; "))


async def test_page_links_manifest_and_registers_worker(client: AsyncClient) -> None:
    r = await client.get("/")
    assert '<link rel="manifest" href="/static/manifest.webmanifest">' in r.text
    assert '<link rel="apple-touch-icon" href="/static/icons/icon-180.png">' in r.text
    assert "navigator.serviceWorker.register('/sw.js')" in r.text  # inside the hashed inline script
    d = _directives(r.headers["content-security-policy"])
    assert d["worker-src"] == "'self'"
    assert d["manifest-src"] == "'self'"
    assert d["connect-src"] == "'none'"
    assert "'self'" not in d["script-src"]  # no same-origin scripts: registration stays in the hashed block


async def test_service_worker_is_served_from_root(client: AsyncClient) -> None:
    r = await client.get("/sw.js")
    assert r.status_code == 200
    assert r.headers["content-type"] == "text/javascript; charset=utf-8"
    assert r.headers["content-security-policy"] == SW_CSP
    assert r.headers["cache-control"] == "no-cache"
    assert "__VERSION__" not in r.text and "__ASSETS__" not in r.text
    sw = app.state.service_worker
    assert json.dumps(sw.version) in r.text
    assert sw.version.startswith(app.state.build_info.short + "-")
    assert json.dumps(list(sw.assets)) in r.text


async def test_service_worker_etag_and_head(client: AsyncClient) -> None:
    etag = (await client.get("/sw.js")).headers["etag"]
    assert (await client.get("/sw.js", headers={"If-None-Match": etag})).status_code == 304
    head = await client.head("/sw.js")
    assert head.status_code == 200 and head.content == b""
    assert head.headers["content-length"] == str(len(app.state.service_worker.body))


async def test_every_precached_asset_is_served(client: AsyncClient) -> None:
    assets = precache_assets()
    assert "/" in assets and "/static/fonts/comfortaa.css" in assets
    assert sum(a.endswith(".woff2") for a in assets) == 4
    assert "/static/manifest.webmanifest" in assets
    for path in assets:
        r = await client.get(path, headers=FUNNEL)  # offline cache is filled through the Funnel in prod
        assert r.status_code == 200, path


def test_new_build_commit_gives_a_new_cache_version() -> None:
    a = build_service_worker("1111111", '"abcdef0123"')
    b = build_service_worker("2222222", '"abcdef0123"')
    c = build_service_worker("1111111", '"99999999aa"')
    assert a.version == "1111111-abcdef01"
    assert len({a.body, b.body, c.body}) == 3
    assert len({a.etag, b.etag, c.etag}) == 3


async def test_manifest_is_greek_and_installable(client: AsyncClient) -> None:
    r = await client.get("/static/manifest.webmanifest")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/manifest+json")
    m = r.json()
    assert m["name"] == "Τα Μαγικά Νησιά"
    assert m["lang"] == "el"
    assert m["start_url"] == "/" and m["scope"] == "/"
    sizes = {i["sizes"] for i in m["icons"] if i["type"] == "image/png"}
    assert {"192x192", "512x512"} <= sizes
    for icon in m["icons"]:
        img = await client.get(icon["src"])
        assert img.status_code == 200, icon["src"]
        if icon["type"] == "image/png":
            assert img.content[:8] == b"\x89PNG\r\n\x1a\n"
            w, h = struct.unpack(">II", img.content[16:24])
            assert f"{w}x{h}" == icon["sizes"]
        else:
            assert img.content.startswith(b"<svg")


def test_icon_generator_is_reproducible() -> None:
    small = make_icons.render(8)
    assert small[:8] == b"\x89PNG\r\n\x1a\n" and struct.unpack(">II", small[16:24]) == (8, 8)
    assert make_icons.render(8) == small
    assert make_icons.svg() == (INDEX.parent / "icons" / "icon.svg").read_text(encoding="utf-8")
    # Compare the decoded pixels, not the bytes: zlib builds may compress differently (CI vs Windows).
    assert _pixels(make_icons.render(192)) == _pixels((INDEX.parent / "icons" / "icon-192.png").read_bytes())


def _pixels(png: bytes) -> bytes:
    """Raw scanlines of a single-IDAT PNG as written by tools/make_icons.py."""
    pos = png.index(b"IDAT")
    (length,) = struct.unpack(">I", png[pos - 4 : pos])
    return zlib.decompress(png[pos + 4 : pos + 4 + length])
