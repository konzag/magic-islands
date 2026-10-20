# Changelog

## Unreleased
- **README pass 02** (GAME-STANDARD v1.2 §2a): the README (Greek) is also the owner's manual-test guide. New
  sections «Οθόνες και ροή» (title with «Συνέχεια: <νησί> ▶», hero cards and swap, the 4 islands, flight, lose,
  win, pause), «Αποθήκευση», «Λίστα χειροκίνητων δοκιμών» MI-01..MI-25 (1280, 1180x820, 820x1180, 780x360, 360,
  light + dark, keyboard, screen reader; always in a private window so the kids' `magic-islands.progress.v1`
  stays untouched), «Τι άλλαξε», «Γνωστοί περιορισμοί», «Ασφαλής δοκιμή», «Αναφορά προβλήματος». Issue forms
  `bug.yml` / `update.yml`, PR template checkbox, `tests/readme.spec.ts` (sections, MI ids, issue forms, no
  hostnames). No game code change; the save key is unchanged.

## 2026-10-19: FIX-1 (PR #16, release PR #17)
- **Floating joystick** replaces the 4-arrow d-pad (touch, FIX-1).
  - It appears where the thumb lands in the left 45 % of the screen and stays below the top HUD.
  - Base 110 px (was 168 px), knob 48 px. Analog 360°: the drag length sets the speed, with a 12 % dead zone.
  - It fades out on release. Pointer Events with `setPointerCapture`, one finger, so a second finger can use the spell
    buttons at the same time.
  - Spell buttons ~15 % smaller: touch 56 px (was 64), desktop 68 px (was 80). 🔄 and the keyboard are unchanged.
  - The game is wrapped in `<main>` (axe `region`).
  - `/?e2e` exposes a read-only test probe (`window.__mi`) for Playwright only.
  - New `tests/joystick.spec.ts`: 8 directions, release stops, analog/dead zone, two fingers, layout and axe.
    It runs at 780x360, 820x1180 and 1180x820.
## 2026-10-15: FastAPI app retired (PR #12, release PR #15)
- **Retired the FastAPI app** (WP3 final step, after the games-hub cut-over).
  - The repo is now a static game repo (GAME-STANDARD §2): `index.html`, `assets/`, Playwright smoke.
  - Removed: `app/` (incl. the frozen page, PWA and service worker), the Python tests, tools, Docker/compose,
    Python config, `security.yml`, and the infra docs (deploy, runbook, standards).
  - CI is now `test` (Playwright) + `gitleaks`. ADR-0001 (server-era exposure) is removed; it stays in git history.
## 2026-10-14: static game layout (PR #9, release PR #10 on 2026-10-15)
- Static game layout for games-hub (GAME-STANDARD §2, WP3, 2026-10-14): `index.html` at the repo root is the
  game as the hub serves it at `/magic-islands/`.
  - Removed: the service worker and the manifest.
  - Changed: relative icons in `assets/`.
  - Added: 🏠 back to the games, ⛶/F fullscreen, M sound, pause on blur.
  - Added: Playwright smoke under the hub's CSP (`tests/smoke.spec.ts`, CI job `game-smoke`).
  - `app/static/index.html` stays frozen for the running app until it is retired.
## 2026-10-13 / 2026-10-14: the first app (PR #1, #4, #5; release PRs #2, #8)
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
