# magic-islands — Claude Context

## Project
"Τα Μαγικά Νησιά": the owner's kids' HTML5 canvas game, served by a stateless FastAPI app (Python 3.11).
It runs on VM apps (192.168.1.14) on port 8087 as `magic-islands.service`, and is public through Tailscale
Funnel without Authelia (ADR-0001). Staging runs on VM staging (192.168.1.16) behind Caddy + Authelia only.
There is no database, no user data, no secrets and no outbound calls.

## Rules
- The game is `app/static/index.html`, one self-contained file. Never add `<script src>`, inline event
  handlers, third-party URLs or network calls. The CSP is hash-based (`app/services/page.py`) and must never
  get `'unsafe-inline'` / `'unsafe-eval'`.
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
`python tools/extract_inline_js.py /tmp/game.js && node --check /tmp/game.js` ·
`pip-audit -r requirements.txt -r requirements-dev.txt` · `bandit -c .bandit -r . -x ./tests,./.venv`

## Agent behavior
- Do not ask clarifying questions; proceed with best judgment and note assumptions in code comments.
