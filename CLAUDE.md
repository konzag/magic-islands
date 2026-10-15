# magic-islands — Claude Context

## Project
"Τα Μαγικά Νησιά": the owner's kids' HTML5 canvas game (Greek UI). A **static game repo** (GAME-STANDARD §2):
the whole game is `index.html` at the repo root. konzag/games-hub serves it at `/magic-islands/` as a pinned
git submodule (public, no login). There is no server code here any more: the old server app was retired on
2026-10-15 (its history is in git). Never add hosts, ports, IPs or internal hostnames to this public repo.

## Standard
The game follows **GAME-STANDARD v1** and is its reference game: https://github.com/konzag/games-template/blob/main/GAME-STANDARD.md
(copy: konzag/games-hub `docs/GAME-STANDARD.md`). Shell (§3), local-only resources and the hub's CSP (§4),
Playwright smoke (§7). New games start from `konzag/games-template`.

## Rules
- One self-contained `index.html`: one `<style>`, one inline `<script>` (the hub allows it by sha256). Never add
  `<script src>` from elsewhere, inline event handlers (`onclick="…"`), `eval`, third-party URLs (CDN, Google
  Fonts), a service worker or network calls. The font comes from the hub: `/static/fonts/comfortaa.css`.
- Keep the `[hidden]{display:none!important;}` rule at the end of the `<style>` (game fix: overlays).
- Shell stays: 🏠 to `/`, ⏸/P/Esc, 🔊/M, ⛶/F, pause on hidden tab / blur, touch d-pad + spell buttons.
- Progress only in localStorage (`magic-islands.progress.v1`), always in try/catch.
- All UI text in Greek; docs in English or Greek.
- `npx playwright test` must stay green: 10 s keyboard + 10 s touch, 0 console errors, 0 CSP violations under
  the hub's policy (`tests/serve.mjs` + `tests/hub-csp.mjs`, same as konzag/games-template).
- Option B: never push to `main` or `staging` directly. Feature branch → PR to `staging` (Auto-merge merges it
  when CI is green) → release PR `staging → main` needs the owner's GO → then a games-hub PR bumps the submodule.
- Commits are GPG-signed with conventional-commit subjects; never `--no-verify` / `--no-gpg-sign`.
