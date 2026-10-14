# Runbook

| Symptom | Check | Fix |
|---|---|---|
| Deploy rolls back, ready 503 / unit fails at start | `journalctl -u magic-islands -n 50` | `PageError` at startup means `index.html` is missing, not UTF-8, or has `<script src>` / an inline handler. Fix the page and redeploy. |
| Page is blank, console shows CSP errors | `curl -sI http://127.0.0.1:8087/ \| grep -i content-security` | The page must be served by the app (hashes are computed from the served file). Proxies must not rewrite the HTML. |
| Funnel URL is unreachable | `tailscale funnel status` on VM 106 `public` | Infra: Funnel 443 (`https://public.tailc01d70.ts.net/`) → 127.0.0.1:8087. Loopback must be allowed by nft. |
| Prometheus target down (404) | Is the scrape direct from 192.168.1.11 without a proxy? | `METRICS_ALLOW_IPS` in `/opt/magic-islands/.env`. Never scrape through Caddy. |
| Start button does not react | Is `[hidden]{display:none!important;}` still at the end of `<style>`? | Re-add it (see README). |

Restart: `sudo systemctl restart magic-islands`. Build: `curl -s http://127.0.0.1:8087/version`.
