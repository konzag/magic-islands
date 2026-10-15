# magic-islands — Claude Context

## Project
"Τα Μαγικά Νησιά": the owner's kids' HTML5 canvas game, served by a stateless FastAPI app (Python 3.11).
Prod runs on the isolated public VM 106 (192.168.1.17) on port 8087 as `magic-islands.service`, and is public
through Tailscale Funnel at https://public.tailc01d70.ts.net:8443/ without Authelia (ADR-0001). Staging runs on VM staging (192.168.1.16) behind Caddy + Authelia only.
There is no database, no user data, no secrets and no outbound calls.

## Standard
The game follows **GAME-STANDARD v1** and is its reference game (§0): https://github.com/konzag/games-template/blob/main/GAME-STANDARD.md
(copy: konzag/games-hub `docs/GAME-STANDARD.md`). Shell (§3), local-only resources and the hub's CSP (§4) and
Playwright smoke (§7) apply to `index.html`. New games start from `konzag/games-template`.

## Rules
- The game is `index.html` at the repo root, one self-contained file, served by games-hub at `/magic-islands/`.
  `app/static/index.html` is a frozen copy for the old app until it is retired; do not change it. Never add
  `<script src>`, inline event handlers, third-party URLs, a service worker or network calls. The hub's CSP is
  hash-based and never has `'unsafe-inline'` / `'unsafe-eval'`. `npx playwright test` checks the game under it.
- Keep the `[hidden]{display:none!important;}` rule at the end of the page's `<style>` (game fix).
- Funnel exposure is an allowlist (`app/core/guards.py`). A new route is NOT public unless it is added
  there on purpose. `/metrics` stays restricted to direct peers in METRICS_ALLOW_IPS.
- Never log client IPs (kids' public page; uvicorn runs with `--no-access-log`).
- Security baseline (every app): no /docs /redoc /openapi.json in prod/staging, `cache_control_for()`
  (API/health/version/metrics no-store, page and static no-cache + ETag), STD-14 errors.
- All UI text in Greek. README/docs in English.
- Infra owns deploy: never write systemd units, Caddy, firewall, Funnel or Prometheus config here or in
  homelab-scripts. The steps are in `docs/deploy.md`.
- Option B (GitHub Free): never push to `main` or `staging` directly. Work on a feature branch and open a PR
  to `staging`. Auto-merge merges it when CI is green; the `staging -> main` release PR needs the owner's GO.
- Commits are GPG-signed with conventional-commit subjects; never `--no-verify` / `--no-gpg-sign`.

## Checks (same as .github/workflows/ci.yml)
`ruff check . && ruff format --check .` · `mypy` (strict, app + tools) · `pytest` (gate 90 %, warnings = errors) ·
`python tools/extract_inline_js.py /tmp/game.js && node --check /tmp/game.js && node --check app/services/sw.js` ·
`pip-audit -r requirements.txt -r requirements-dev.txt` · `bandit -c .bandit -r . -x ./tests,./.venv`

## Agent behavior
- Do not ask clarifying questions; proceed with best judgment and note assumptions in code comments.
