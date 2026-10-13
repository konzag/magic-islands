# Changelog

## Unreleased
- Initial app (2026-10-13). From template-app; stateless, no DB.
  - The game is served at `/` with a hash-based CSP. The Comfortaa font is self-hosted.
  - Funnel allowlist; `/metrics` is served to the Prometheus host only.
  - Infra endpoints: health, `/version`, `app_build_info`, optional OTel.
  - Option B CI and delivery.
- Game page: added a document wrapper (doctype, `lang="el"`, charset, viewport). Fixed the `[hidden]`
  overlays that blocked the start button.
- Offline play / installable (2026-10-14): web app manifest ("Τα Μαγικά Νησιά", icons from
  `tools/make_icons.py`) and a service worker at `/sw.js` that precaches the page, fonts, CSS and icons.
  The cache version is the build commit + page hash, so every deploy refreshes it. Page CSP gains
  `worker-src 'self'` and `manifest-src 'self'`; `/sw.js` is added to the Funnel allowlist.
