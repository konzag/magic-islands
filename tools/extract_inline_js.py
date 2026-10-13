"""Write the inline <script> blocks of app/static/index.html to a .js file for `node --check` (CI).

Usage: python tools/extract_inline_js.py <out.js>
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.services.page import INDEX, INLINE_BLOCKS  # noqa: E402


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        sys.stderr.write("usage: extract_inline_js.py <out.js>\n")
        return 2
    blocks = INLINE_BLOCKS["script"].findall(INDEX.read_text(encoding="utf-8"))
    if not blocks:
        sys.stderr.write("no inline <script> in index.html\n")
        return 1
    Path(argv[1]).write_text("\n;\n".join(blocks), encoding="utf-8")
    sys.stdout.write(f"{len(blocks)} script block(s) -> {argv[1]}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
