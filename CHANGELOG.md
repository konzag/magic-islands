# Changelog

## Unreleased
- Initial app (2026-10-13). From template-app; stateless, no DB.
  - The game is served at `/` with a hash-based CSP. The Comfortaa font is self-hosted.
  - Funnel allowlist; `/metrics` is served to the Prometheus host only.
  - Infra endpoints: health, `/version`, `app_build_info`, optional OTel.
  - Option B CI and delivery.
- Game page: added a document wrapper (doctype, `lang="el"`, charset, viewport). Fixed the `[hidden]`
  overlays that blocked the start button.
