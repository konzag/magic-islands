# Deploy notes: infra registration (owned by homelab-scripts)

This repo never contains systemd units, Caddy config, firewall rules, Funnel config or Prometheus targets.
These are the one-time steps for infra. The request with the same content is
`D:\Git\.claude\APP-REPLY-2026-10-13-magic-islands.md`.

## Facts

| Key | Value |
|---|---|
| repo | `konzag/magic-islands` (prod follows `main`, staging follows `staging`) |
| provision-apps id / unit / dir | `magic` / `magic-islands` / `/opt/magic-islands/{repo,venv,.env}` |
| port | **8087** (apps + staging) |
| entry | `app.main:app` (working dir = repo) |
| ExecStart | `uvicorn app.main:app --host 0.0.0.0 --port 8087 --workers 1 --proxy-headers --forwarded-allow-ips=127.0.0.1 --no-server-header --no-access-log` |
| Python | 3.11+ (CI runs 3.11) |
| liveness / readiness | `http://127.0.0.1:8087/health/live` / `http://127.0.0.1:8087/health/ready` (alias `/api/health`) |
| version | `http://127.0.0.1:8087/version` |
| metrics | `http://<vm>:8087/metrics`, only from 192.168.1.11 directly (others get 404) |
| CI gate | `konzag/magic-islands ci.yml`, check `test` |
| DB / migrations | none (no `alembic.ini`) |
| writable paths | none |
| outbound | none |
| env file | `/opt/magic-islands/.env` 0600: `ENVIRONMENT=prod`/`staging`, `LOG_LEVEL=INFO`, `METRICS_ALLOW_IPS=192.168.1.11`, optional `OTEL_*` |

## Why `--forwarded-allow-ips=127.0.0.1`

The Funnel is tailscaled on the same VM, which connects from 127.0.0.1 and sets `X-Forwarded-For` plus
`Tailscale-Funnel-Request`. Trusting forwarded headers from loopback only means a LAN client can never
forge its address. Caddy (on .11) is not trusted for XFF on purpose: the app treats any request that
carries XFF as proxied and never serves `/metrics` to it.

## Smoke

`tools/smoke.sh <base-url> [funnel-url]` checks the page, CSP, fonts and health, and that `/metrics` and
`/version` are 404 through the Funnel.
