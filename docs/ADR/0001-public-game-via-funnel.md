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

1. **Exposure (prod):** Tailscale Funnel on VM apps, `https://<apps>.ts.net:8443` → `127.0.0.1:8087`.
   It is public, with no Authelia. Staging is NOT on the Funnel; it is reachable only through Caddy + Authelia
   (`magic.staging.homelab.lan`).
2. **Funnel allowlist in the app** (`app/core/guards.py`): a request marked `Tailscale-Funnel-Request` may only
   use GET/HEAD on `/`, `/static/*`, `/favicon.ico` and `/health/live`. Everything else answers 404, so
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
