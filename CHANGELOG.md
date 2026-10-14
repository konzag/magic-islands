# Changelog

## Unreleased
- Static game layout for games-hub (GAME-STANDARD §2, WP3, 2026-10-14): `index.html` at the repo root is the
  game as the hub serves it at `/magic-islands/`.
  - Removed: the service worker and the manifest.
  - Changed: relative icons in `assets/`.
  - Added: 🏠 back to the games, ⛶/F fullscreen, M sound, pause on blur.
  - Added: Playwright smoke under the hub's CSP (`tests/smoke.spec.ts`, CI job `game-smoke`).
  - `app/static/index.html` stays frozen for the running app until it is retired.
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
- Saved progress on the device (2026-10-14): the furthest island reached is kept in localStorage
  (`magic-islands.progress.v1`, every access in try/catch, nothing sent to the server). The title screen
  offers «Συνέχεια: <νησί>»; Enter on the title continues when a save exists. Cleared after the final win.
