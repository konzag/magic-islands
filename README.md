# magic-islands

**Τα Μαγικά Νησιά** ("The Magic Islands"): a single-page HTML5 canvas game for the owner's kids, served as a
homelab app. The UI is in Greek. You play with the keyboard (arrows, 1-4, Space, Q, P/Esc) or by touch
(virtual d-pad + spell buttons).

The app is a small stateless FastAPI service. It serves the game page from memory with a strict, hash-based
Content-Security-Policy, plus the fleet's standard infra endpoints. It has no database, no user data, no
secrets and no outbound calls.

## Layout

```
app/
  main.py               wiring only (STD-03)
  api/game.py           GET/HEAD /  (the page, ETag), /sw.js (service worker) and /favicon.ico
  api/health.py         /health/live, /health/ready, /api/health, /health/security, /version
  core/guards.py        Funnel allowlist + /metrics peer rule (ADR-0001)
  core/middleware.py    security headers, Cache-Control, request log (no client IPs)
  core/observability.py /metrics + app_build_info, optional OpenTelemetry
  services/page.py      loads static/index.html, computes the CSP hashes
  services/pwa.py       builds /sw.js from services/sw.js (cache version = commit + page hash)
  static/index.html     the game (one inline <script>, one inline <style>)
  static/fonts/         Comfortaa 500/700, Greek + Latin, self-hosted (OFL 1.1)
  static/manifest.webmanifest, static/icons/   installable app (icons from tools/make_icons.py)
tools/
  extract_inline_js.py  inline script -> .js for `node --check` (CI)
  smoke.sh              post-deploy smoke
docs/                   ADR-0001 (exposure + N/A standards), deploy.md, runbook.md, standards.md
```

## Endpoints

| Path | Who can reach it |
|---|---|
| `/`, `/sw.js`, `/static/*`, `/favicon.ico`, `/health/live` | everyone, including the Funnel |
| `/health/ready`, `/api/health`, `/health/security`, `/version` | LAN / Caddy / localhost, never the Funnel |
| `/metrics` | direct requests from `METRICS_ALLOW_IPS` (Prometheus, 192.168.1.11) only |

## Updating the game

Replace `app/static/index.html` and keep it self-contained: no `<script src>`, no inline `on…=` handlers, no
third-party URLs. The CSP hashes follow automatically at startup. CI runs `node --check` on the inline
script, and the tests make sure every inline block is covered by the policy.

The page has a homelab fix appended to its `<style>`: `[hidden]{display:none!important;}`. Without it,
`.screen{display:grid}` overrode the `hidden` attribute, and the pause/lose/win screens covered the start
button. Keep this rule when you replace the file.

## Local development

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt   # (bin/ on Linux)
uvicorn app.main:app --port 8087 --reload        # http://127.0.0.1:8087/
pytest                                          # coverage gate 90 %
ruff check . && ruff format --check . && mypy
```

## Delivery (Option B, same as the other apps)

feature branch → PR to `staging` → **CI** (`test` job) → **Auto-merge** merges green PRs → VM staging deploys
`staging` → release PR `staging → main` → **merged only after the owner's GO** → the public VM 106 deploys `main`.
Infra deploys a commit only when its `test` check is green. Registration steps: `docs/deploy.md`.

## Origin

Created 2026-10-13 from `konzag/template-app` (golden master, STD-10). The DB layer, Alembic and SOPS were
removed, because the app has no state and no secrets (ADR-0001). The CI, delivery and core modules follow
`homelab-dashboard`, the other stateless fleet app.

## License

Code: MIT (`LICENSE`). Font: SIL Open Font License 1.1 (`app/static/fonts/OFL.txt`).
