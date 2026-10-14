# Deploy notes: infra registration (owned by homelab-scripts)

This repo never contains systemd units, Caddy config, firewall rules, Funnel config or Prometheus targets.
These are the one-time steps for infra. The request with the same content is
`D:\Git\.claude\APP-REPLY-2026-10-13-magic-islands.md`.

## Facts

| Key | Value |
|---|---|
| repo | `konzag/magic-islands` (prod follows `main`, staging follows `staging`) |
| prod host | public VM 106 `public`, 192.168.1.17 (homelab-scripts ADR-0042): no route into the homelab, files pushed by `tools/push-public.sh` (no homelab-scripts clone) |
| prod URL | `https://public.tailc01d70.ts.net:8443/` (Funnel, port **8443**) → `http://127.0.0.1:8087`; 443 on the same node is games-hub (port 8090), which links here |
| staging | VM staging (192.168.1.16), `magic.staging.homelab.lan` via Caddy + Authelia (not on the Funnel) |
| provision-apps id / unit / dir | `magic` / `magic-islands` / `/opt/magic-islands/{repo,venv,.env}` |
| port | **8087** (VM 106 + staging) |
| entry | `app.main:app` (working dir = repo) |
| ExecStart | `uvicorn app.main:app --host 0.0.0.0 --port 8087 --workers 1 --proxy-headers --forwarded-allow-ips=127.0.0.1 --no-server-header --no-access-log` |
| Python | 3.11+ (CI runs 3.11) |
| liveness / readiness | `http://127.0.0.1:8087/health/live` / `http://127.0.0.1:8087/health/ready` (alias `/api/health`) |
| version | `http://127.0.0.1:8087/version` |
| metrics | `http://192.168.1.17:8087/metrics` (prod), only from 192.168.1.11 directly (others get 404); the VM 106 firewall lets only monitor reach 8087/9100 |
| CI gate | `konzag/magic-islands ci.yml`, check `test` |
| DB / migrations | none (no `alembic.ini`) |
| writable paths | none |
| outbound | none |
| env file | `/opt/magic-islands/.env` 0600: `ENVIRONMENT=prod`/`staging`, `LOG_LEVEL=INFO`, `METRICS_ALLOW_IPS=192.168.1.11`, optional `OTEL_*` |

## Why `--forwarded-allow-ips=127.0.0.1`

The Funnel is tailscaled on the same VM (VM 106), which connects from 127.0.0.1 and sets `X-Forwarded-For` plus
`Tailscale-Funnel-Request`. Trusting forwarded headers from loopback only means a LAN client can never
forge its address. Caddy (on .11) is not trusted for XFF on purpose: the app treats any request that
carries XFF as proxied and never serves `/metrics` to it.

## Smoke

`tools/smoke.sh <base-url> [funnel-url]` checks the page, CSP, fonts and health, and that `/metrics` and
`/version` are 404 through the Funnel. Prod: `tools/smoke.sh http://192.168.1.17:8087 https://public.tailc01d70.ts.net:8443`.

## Funnel go-live order (infra, 2026-10-14)

Owner GO → merge release #2 to `main` (auto-deploy on VM 106) → Tailscale ACL (`tag:public`, Funnel attribute
only for it, no grants from it) → owner approves the node login →
`tailscale funnel --bg --https=8443 http://127.0.0.1:8087` → blackbox probe + alert on the public URL.
