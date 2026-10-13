"""The game page: loaded once at startup, served from memory with an ETag.

The page is one self-contained HTML file with exactly one inline <script> and one inline <style>. Instead of
'unsafe-inline', the CSP allows exactly those two blocks by their sha256 hash, computed here from the file that
is actually served, so the policy can never drift from the page.
"""

import base64
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

STATIC = Path(__file__).resolve().parent.parent / "static"
INDEX = STATIC / "index.html"

INLINE_BLOCKS = {tag: re.compile(rf"<{tag}>(.*?)</{tag}>", re.S) for tag in ("script", "style")}


class PageError(RuntimeError):
    """The page file is missing or does not have the expected shape."""


def csp_hash(text: str) -> str:
    """CSP source expression for an inline block: 'sha256-<base64 of sha256(UTF-8 text)>'."""
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return f"'sha256-{base64.b64encode(digest).decode('ascii')}'"


@dataclass(frozen=True)
class Page:
    body: bytes
    etag: str
    script_hashes: tuple[str, ...]
    style_hashes: tuple[str, ...]

    def csp(self) -> str:
        """Strict CSP for the game page: own origin only, inline blocks by hash, no network calls."""
        return "; ".join(
            (
                "default-src 'none'",
                "script-src " + " ".join(self.script_hashes),
                "style-src 'self' " + " ".join(self.style_hashes),
                "font-src 'self'",
                "img-src 'self' data:",
                "connect-src 'none'",
                "manifest-src 'self'",
                "worker-src 'self'",
                "base-uri 'none'",
                "form-action 'none'",
                "frame-ancestors 'none'",
            )
        )


def load_page(path: Path = INDEX) -> Page:
    """Read the page and hash its inline blocks. Raises PageError when the file is unusable."""
    try:
        raw = path.read_bytes()
        text = raw.decode("utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise PageError(f"{path.name}: {type(exc).__name__}") from exc
    blocks = {tag: pattern.findall(text) for tag, pattern in INLINE_BLOCKS.items()}
    if not blocks["script"]:
        raise PageError(f"{path.name}: no inline <script>")
    markup = text
    for pattern in INLINE_BLOCKS.values():  # only HTML tags count, not the JS/CSS inside the blocks
        markup = pattern.sub("", markup)
    if re.search(r"<script\b[^>]*\bsrc\s*=", markup, re.I) or re.search(r"<[a-z][^>]*\son[a-z]+\s*=", markup, re.I):
        # External scripts or inline event handlers would be blocked by the hash-only CSP.
        raise PageError(f"{path.name}: external <script src> or inline event handler")
    return Page(
        body=raw,
        etag='"' + hashlib.sha256(raw).hexdigest()[:32] + '"',
        script_hashes=tuple(csp_hash(b) for b in blocks["script"]),
        style_hashes=tuple(csp_hash(b) for b in blocks["style"]),
    )
