"""Offline play: the service worker served at `/sw.js` (built once at startup, served from memory).

The worker must be served from the root to control the page at `/` (a worker's default scope is its own
directory), so it is a route and not a file under /static/. Its source is the template `sw.js` next to this
module; the app fills in the cache version and the list of files to precache:

- VERSION = short build commit + page hash. A deploy of a new commit (or a changed page) gives a byte-different
  worker, the browser installs it, and its `activate` step deletes the caches of older versions.
- ASSETS = the page, the font CSS and font files, the manifest and the icons (everything the game loads).
"""

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from app.services.page import STATIC

TEMPLATE = Path(__file__).resolve().parent / "sw.js"
# The worker's own CSP: no scripts/imports, fetch() (cache.addAll) to its own origin only.
SW_CSP = "default-src 'none'; connect-src 'self'"


@dataclass(frozen=True)
class ServiceWorker:
    body: bytes
    etag: str
    version: str
    assets: tuple[str, ...]


def precache_assets(static: Path = STATIC) -> tuple[str, ...]:
    fonts = sorted(p.name for p in (static / "fonts").glob("*.woff2"))
    icons = sorted(p.name for p in (static / "icons").iterdir() if p.suffix in (".png", ".svg"))
    return (
        "/",
        "/static/fonts/comfortaa.css",
        *(f"/static/fonts/{name}" for name in fonts),
        "/static/manifest.webmanifest",
        *(f"/static/icons/{name}" for name in icons),
    )


def build_service_worker(commit_short: str, page_etag: str, static: Path = STATIC) -> ServiceWorker:
    version = f"{commit_short}-{page_etag.strip(chr(34))[:8]}"
    assets = precache_assets(static)
    text = (
        TEMPLATE.read_text(encoding="utf-8")
        .replace("'__VERSION__'", json.dumps(version))
        .replace('["__ASSETS__"]', json.dumps(list(assets)))
    )
    body = text.encode("utf-8")
    return ServiceWorker(
        body=body,
        etag='"' + hashlib.sha256(body).hexdigest()[:32] + '"',
        version=version,
        assets=assets,
    )
