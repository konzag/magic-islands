# ADR-0001: Public, auth-less kids' game behind Tailscale Funnel

- Status: accepted (owner, 2026-10-13)
- Context date: 2026-10-13

## Context

"Τα Μαγικά Νησιά" is a single self-contained HTML5 canvas game the owner's kids play from tablets. The owner
asked for it to become a homelab app with the fleet standards. Those tablets do not trust the homelab's Caddy
internal CA, and installing a CA on iOS/Android tablets is out of scope. So the usual path (Caddy +
Authelia two_factor on `*.homelab.lan`) does not work for them.

The game keeps no data on the server. There are no accounts, scores, uploads or cookies, and the page makes
no network calls (CSP `connect-src 'none'`).

## Decision

1. **Exposure (prod):** Tailscale Funnel on the public VM 106 (192.168.1.17), `https://public.tailc01d70.ts.net:8443/`
   (port 8443; 443 on the same node is the games-hub entrance) → `127.0.0.1:8087` (see the 2026-10-14 host amendment below).
   It is public, with no Authelia. Staging is NOT on the Funnel; it is reachable only through Caddy + Authelia
   (`magic.staging.homelab.lan`).
2. **Funnel allowlist in the app** (`app/core/guards.py`): a request marked `Tailscale-Funnel-Request` may only
   use GET/HEAD on `/`, `/sw.js`, `/static/*`, `/favicon.ico` and `/health/live`. Everything else answers 404, so
   `/version`, `/health/ready`, `/health/security`, `/metrics` and `/docs` never reach the internet.
3. **/metrics** is served only to a direct, non-proxied peer in `METRICS_ALLOW_IPS` (default `192.168.1.11`,
   the Prometheus host). A request carrying `X-Forwarded-For`, `Forwarded` or the Funnel header is refused,
   whatever its peer. Prometheus scrapes directly; Caddy (also on .11) always adds X-Forwarded-For.
   uvicorn trusts forwarded headers from `127.0.0.1` only (tailscaled), so the LAN cannot forge a peer.
4. **Strict CSP without `unsafe-inline`:** the page's single inline `<script>` and `<style>` are allowed by
   their sha256, which the app computes at startup from the file it serves (`app/services/page.py`).
   Policy: `default-src 'none'`; scripts/styles by hash; fonts/images from self; `connect-src 'none'`;
   `frame-ancestors 'none'`. The startup check refuses a page with `<script src>` or inline event handlers.
5. **No third-party requests:** the Comfortaa font (OFL 1.1) is self-hosted under `app/static/fonts/`
   instead of Google Fonts, so the kids' IPs never go to a third party.
6. **No IP logging:** uvicorn runs with `--no-access-log`; the app's own request log has method, path,
   status, duration and a funnel flag, without the client address (data minimisation).
7. **No rate limiting:** the responses are static and served from memory (an ETag answers revalidation
   with 304). Tailscale Funnel has its own limits.

## Amendment 2026-10-14: offline play (owner-approved proposal)

- `/sw.js` (the service worker) joins the Funnel allowlist. It must be served from the root so that its
  scope covers `/`. The manifest and icons live under `/static/`, which was already public.
- The page CSP adds `worker-src 'self'` and `manifest-src 'self'`; `connect-src` stays `'none'`. The
  worker registration lives inside the hashed inline script, so `script-src` still has no `'self'` and
  the page still has no `<script src>`. The worker gets its own CSP: `default-src 'none'; connect-src 'self'`.
- The worker only reads same-origin GETs into the Cache Storage of the device; it sends nothing anywhere.

## Amendment 2026-10-14: prod host = public VM 106 (infra)

- Prod no longer runs on VM apps. Infra built a dedicated VM 106 `public` (192.168.1.17, homelab-scripts
  ADR-0042) for internet-facing apps: two firewalls with no route into the homelab, inbound only SSH from
  the workstation/Proxmox and 9100/8087 from monitor, and no homelab-scripts clone on the box.
- The Funnel listens on **8443**: `https://public.tailc01d70.ts.net:8443/` → `127.0.0.1:8087`. Port 443 on
  the same node is games-hub, the common entrance for all the kids' games (owner request 2026-10-14), which
  links here. The node is `tag:public`; the ACL gives the Funnel attribute only to that tag and grants nothing from it.
- Nothing changes in the app: tailscaled still connects from 127.0.0.1, so the Funnel allowlist, the
  `/metrics` rule and `--forwarded-allow-ips=127.0.0.1` work as above.

## Standards marked N/A (app-standard.md)

| Standard | Why N/A |
|---|---|
| STD-11 Secrets (SOPS) | The app has no secrets at all, so there is no `secrets.enc.yaml` or `.sops.yaml`. Publishing even an encrypted dummy adds nothing. |
| STD-15 DB migrations | No database: nothing to migrate (no `alembic.ini`, so auto-deploy MIGRATE=1 skips it). |
| STD-20 Database | No database: the game holds no server-side state, by design. |
| STD-22 DR (backups) | Nothing to back up beyond the git repo. Restore = redeploy the commit. |
| STD-07 `db_session` fixture | No DB; `client` and `mock_external_apis` exist (`tests/conftest.py`). |
| STD-13 `/api/v1/` | There is no business API; only the unversioned infra routes and the page. |

## Consequences

- The game is reachable by anyone who knows the ts.net URL. That is acceptable for a static page with no data.
- Changing the game = replace `app/static/index.html`. The CSP follows automatically; a test checks that
  the policy contains the hash of every inline block.
- Infra registers the Funnel port, firewall and Prometheus target; see `docs/deploy.md`. A homelab-scripts
  ADR records the Funnel exposure (next free number there).
