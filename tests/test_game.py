"""The game page, its assets and the hash-based CSP."""

import re

from httpx import AsyncClient

from app.services.page import INDEX, INLINE_BLOCKS, csp_hash, load_page


async def test_index_returns_game_html_utf8(client: AsyncClient) -> None:
    r = await client.get("/")
    assert r.status_code == 200
    assert r.headers["content-type"] == "text/html; charset=utf-8"
    assert "<title>Τα Μαγικά Νησιά</title>" in r.text
    assert r.text.startswith("<!doctype html>")
    assert '<html lang="el">' in r.text
    assert r.headers["cache-control"] == "no-cache"
    assert r.content == INDEX.read_bytes()


async def test_index_head_has_length_and_no_body(client: AsyncClient) -> None:
    r = await client.head("/")
    assert r.status_code == 200
    assert r.content == b""
    assert r.headers["content-length"] == str(len(INDEX.read_bytes()))


async def test_index_etag_revalidation_returns_304(client: AsyncClient) -> None:
    etag = (await client.get("/")).headers["etag"]
    r = await client.get("/", headers={"If-None-Match": etag})
    assert r.status_code == 304
    assert r.content == b""
    assert r.headers["etag"] == etag


async def test_page_csp_allows_exactly_the_inline_blocks(client: AsyncClient) -> None:
    r = await client.get("/")
    csp = r.headers["content-security-policy"]
    text = INDEX.read_text(encoding="utf-8")
    for block in INLINE_BLOCKS["script"].findall(text) + INLINE_BLOCKS["style"].findall(text):
        assert csp_hash(block) in csp
    assert "unsafe-inline" not in csp and "unsafe-eval" not in csp
    directives = dict(d.split(" ", 1) for d in csp.split("; "))
    assert directives["default-src"] == "'none'"
    assert directives["connect-src"] == "'none'"
    assert directives["frame-ancestors"] == "'none'"
    assert directives["font-src"] == "'self'"


def test_page_is_self_contained() -> None:
    text = INDEX.read_text(encoding="utf-8")
    assert "fonts.googleapis" not in text and "fonts.gstatic" not in text
    assert not re.search(r"""(src|href)\s*=\s*["']?(https?:)?//""", text)  # no third-party load
    assert '<link rel="stylesheet" href="/static/fonts/comfortaa.css">' in text


def test_page_hashes_are_stable() -> None:
    a, b = load_page(), load_page()
    assert a.etag == b.etag and a.script_hashes == b.script_hashes
    assert len(a.script_hashes) == 1 and len(a.style_hashes) == 1


async def test_font_css_and_files_are_served(client: AsyncClient) -> None:
    css = await client.get("/static/fonts/comfortaa.css")
    assert css.status_code == 200
    assert css.headers["content-type"].startswith("text/css")
    files = re.findall(r"url\('([^']+)'\)", css.text)
    assert len(files) == 4
    for name in files:
        r = await client.get(f"/static/fonts/{name}")
        assert r.status_code == 200
        assert r.content[:4] == b"wOF2"
        assert r.headers["cache-control"] == "no-cache"
    assert (await client.get("/static/fonts/OFL.txt")).status_code == 200


async def test_favicon_returns_204(client: AsyncClient) -> None:
    assert (await client.get("/favicon.ico")).status_code == 204


async def test_unknown_static_file_returns_std14_404(client: AsyncClient) -> None:
    r = await client.get("/static/nope.js")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_hidden_attribute_beats_screen_display() -> None:
    """Game fix: `.screen{display:grid}` overrode [hidden], so every overlay covered the start button."""
    style = INLINE_BLOCKS["style"].findall(INDEX.read_text(encoding="utf-8"))[0]
    assert "[hidden]{display:none!important;}" in style
