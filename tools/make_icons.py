"""Generate the app icons (PNG + SVG) for the web app manifest, without any image library.

Usage: python tools/make_icons.py   (writes app/static/icons/; the output is committed)

The picture is drawn from a few shapes in a unit square: night sky, a rainbow, the sea and an island. The
background fills the whole square, so the same files work as `any` and `maskable` icons (the motif stays
inside the maskable safe zone, a centred circle of radius 0.4).
"""

import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "static" / "icons"
PNG_SIZES = (180, 192, 512)
SAMPLES = 3  # supersampling per axis (anti-aliasing)

RGB = tuple[int, int, int]
SKY_TOP: RGB = (0x2A, 0x1D, 0x5E)
SKY_BOTTOM: RGB = (0x14, 0x0E, 0x2E)
RAINBOW: tuple[RGB, ...] = (
    (0xFF, 0x5A, 0x5A),
    (0xFF, 0xE1, 0x4D),
    (0x6F, 0xDC, 0x6A),
    (0x4F, 0xB4, 0xFF),
    (0xC0, 0x6B, 0xFF),
)
ARC_CX, ARC_CY, ARC_OUTER, ARC_BAND = 0.5, 0.64, 0.36, 0.028
SEA: RGB = (0x3C, 0x7F, 0xE0)
SEA_TOP = 0.70
SAND: RGB = (0xF4, 0xE6, 0xB4)
GRASS: RGB = (0x58, 0xA6, 0x4A)
GOLD: RGB = (0xFF, 0xD4, 0x5E)
STARS = ((0.22, 0.24, 0.022), (0.79, 0.2, 0.018), (0.88, 0.42, 0.012), (0.1, 0.5, 0.012))
ISLAND = (0.5, 0.71, 0.27, 0.085)  # cx, cy, rx, ry
HILL = (0.5, 0.685, 0.2, 0.06)


def _in_ellipse(x: float, y: float, e: tuple[float, float, float, float]) -> bool:
    cx, cy, rx, ry = e
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0


def color_at(x: float, y: float) -> RGB:
    """Colour of the icon at (x, y) in the unit square (painter's order, last match wins)."""
    if _in_ellipse(x, y, HILL):
        return GRASS
    if _in_ellipse(x, y, ISLAND):
        return SAND
    if y >= SEA_TOP:
        return SEA
    for sx, sy, r in STARS:
        if (x - sx) ** 2 + (y - sy) ** 2 <= r * r:
            return GOLD
    d = ((x - ARC_CX) ** 2 + (y - ARC_CY) ** 2) ** 0.5
    if y <= ARC_CY and ARC_OUTER - ARC_BAND * len(RAINBOW) <= d <= ARC_OUTER:
        return RAINBOW[min(int((ARC_OUTER - d) / ARC_BAND), len(RAINBOW) - 1)]
    t = y / SEA_TOP
    return (
        round(SKY_TOP[0] + (SKY_BOTTOM[0] - SKY_TOP[0]) * t),
        round(SKY_TOP[1] + (SKY_BOTTOM[1] - SKY_TOP[1]) * t),
        round(SKY_TOP[2] + (SKY_BOTTOM[2] - SKY_TOP[2]) * t),
    )


def render(size: int) -> bytes:
    rows = bytearray()
    n = SAMPLES * SAMPLES
    for py in range(size):
        rows.append(0)  # PNG filter type 0 (None)
        for px in range(size):
            r = g = b = 0
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    c = color_at((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size)
                    r, g, b = r + c[0], g + c[1], b + c[2]
            rows += bytes((r // n, g // n, b // n))
    return png(size, size, bytes(rows))


def png(width: int, height: int, raw_rows: bytes) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    return (
        b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw_rows, 9)) + chunk(b"IEND", b"")
    )


def svg() -> str:
    def hx(c: RGB) -> str:
        return "#{:02x}{:02x}{:02x}".format(*c)

    s = 512
    arcs = []
    for i, c in enumerate(RAINBOW):
        r = (ARC_OUTER - ARC_BAND * (i + 0.5)) * s
        x0, x1, y = (ARC_CX * s - r), (ARC_CX * s + r), ARC_CY * s
        arcs.append(
            f'<path d="M{x0:.1f} {y:.1f}A{r:.1f} {r:.1f} 0 0 1 {x1:.1f} {y:.1f}" fill="none" '
            f'stroke="{hx(c)}" stroke-width="{ARC_BAND * s + 0.6:.1f}"/>'
        )
    stars = "".join(
        f'<circle cx="{x * s:.1f}" cy="{y * s:.1f}" r="{r * s:.1f}" fill="{hx(GOLD)}"/>' for x, y, r in STARS
    )

    def ell(e: tuple[float, float, float, float], c: RGB) -> str:
        return (
            f'<ellipse cx="{e[0] * s:.1f}" cy="{e[1] * s:.1f}" rx="{e[2] * s:.1f}" ry="{e[3] * s:.1f}" fill="{hx(c)}"/>'
        )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}">'
        f'<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{hx(SKY_TOP)}"/><stop offset="{SEA_TOP}" stop-color="{hx(SKY_BOTTOM)}"/>'
        f"</linearGradient></defs>"
        f'<rect width="{s}" height="{s}" fill="url(#sky)"/>'
        + "".join(arcs)
        + stars
        + f'<rect y="{SEA_TOP * s:.1f}" width="{s}" height="{(1 - SEA_TOP) * s:.1f}" fill="{hx(SEA)}"/>'
        + ell(ISLAND, SAND)
        + ell(HILL, GRASS)
        + "</svg>\n"
    )


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in PNG_SIZES:
        (OUT / f"icon-{size}.png").write_bytes(render(size))
    (OUT / "icon.svg").write_text(svg(), encoding="utf-8")
    sys.stdout.write(f"icons -> {OUT}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
