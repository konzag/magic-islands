# Changelog

## Unreleased
- **a11y (axe-core 4.14, dependabot #36):** the hero cards' accessible names start with the visible name
  (`label-content-name-mismatch`, WCAG 2.5.3): «Ναπολέων: παίξε με τον Ναπολέοντα», «Αριάνα: παίξε με την Αριάνα».
  With axe-core 4.14 the joystick axe test was red (3 projects) and is green with this change; the rule is not disabled.
- **Test:** new `tests/flight.spec.ts`: after the dragon flight (skipped, watched to the end, and from a save) the
  heroes walk at once, by keys (desktop) and by finger (tablet, phone). README MI-44. Floor 216 → 222.
- **GAMES-GFX storybook look** (art direction v1, owner «ναι» 2026-10-27), README MI-41..MI-43:
  - `PALETTE` per island (+ `sky` for the title, flight and win): key light warm top-left, cool shade bottom-right,
    rim, ink, cast shadow, vignette, grain, foreground colours. `finish()` paints the light, the rim and a varied ink
    outline onto a base drawing.
  - Painted once, copied every frame (`sprite()`, `blit()`): spirits (`spiritBody`, per eye position, tail-wave
    step, blink, asleep), unicorns (`uniBody`, per facing, walk and tail step), props (`propDraw` body; sway, bob and
    the glow plant's pulse stay live; seaweed stays live vector), the key, Ίριδα, and the minions (12 frames per cycle
    of their main motion, `EFREQ`; their own phase picks the frame). Bosses, the dragon and the mermaid are painted
    live into one scratch canvas (`paintLive`, a lighter finish). Inner `shadow()` calls are skipped while painting
    (`NOSHADOW`); a soft `castShadow()` along the key light is drawn instead.
  - Islands: the key light, paper grain and a beach / frost / blush rim baked into the ground; shaded cliffs; two
    palms on Μονοκέρια's tips (outside the arena). Vignette + grain baked into the cached sea/sky (`bgBase`,
    `skyBase`), no full-screen pass per frame. Foreground sprites at the screen's corners, 1.7× the camera
    (`drawFore`). Defeated monsters burst into additive-glow sparkles (`glowBurst`, cap 60; none with reduced motion).
  - At most one bake per frame (only every third frame while frames run over 20 ms); the cache is emptied on a palette
    change and on resize. `CONFIG.storybook` (false = the plain vector art, test hook `/?e2e&plain`);
    `CONFIG.slowFrameMs`/`slowFrameSec` switch the painted look off by itself on a slow device.
  - Unchanged: gameplay, islands, controls, texts, the save key `magic-islands.progress.v1` and its format, the hub
    contract (one inline script, no eval, no external URLs).
  - Tests: new `tests/storybook.spec.ts` (sprites painted once and copied, `?plain`, sparkles, reduced motion, palette
    per island + foreground); all 5 red on staging fd0d490, and six mutations turn them red. Probe
    `window.__mi.paint`. Test-count floor 206 → 216.
- **CI on every PR** (owner decision D21, rulesets with required checks): `.github/workflows/ci.yml` now runs on
  `pull_request` into staging/main, on `push` to staging/main only (a PR branch commit runs CI once, not twice) and
  on `workflow_dispatch`. Before, CI ran on push only, so a PR whose branch moved through GITHUB_TOKEN (Auto-merge,
  the release PR) could show no checks at all (#30). Job ids / check names stay `test` and `gitleaks`.
  - Tests: new `tests/ci-workflow.spec.ts` (file check, desktop project): triggers and branches, no paths filter,
    workflow name `CI`, required jobs present, unconditioned and keeping their check names, no `${{ }}` inside a
    `run:` script. Red on the old ci.yml; seven mutations of the new file (job renamed, check renamed, PR only on
    staging, bare push, job-level `if:`, expression in `run:`, workflow renamed) all turn it red.
    Test-count floor 200 → 206.
- **T4 light + dark** (port of games-template d1aa5fc T4, GAME-STANDARD §3a): the cards, menus, buttons, HUD and
  dialog follow `prefers-color-scheme` through `:root[data-theme]` (new CSS variables; the light palette keeps
  WCAG AA, axe 0 serious in both). New 🌓 switch (`.theme-btn`, 52 px) on the title and pause cards: device → light →
  dark → device. The choice is stored under its own key `magic-islands.theme.v1` (`'auto' | 'light' | 'dark'`),
  written only when the switch is pressed; a bad value falls back to the device setting. The progress key
  `magic-islands.progress.v1` and its value `{v:1,island:N,keys:N}` are untouched. The canvas world keeps its colours.
  Not in the HUD: at 360 px a fifth HUD button does not fit.
  - Tests: new `tests/theme.spec.ts` (follows the emulated scheme on title + pause, the switch cycle + reload + pause
    switch + live device change + progress value unchanged, bad stored value, axe on the title at 360 light/dark),
    all red on the old code. New `tests/layout.spec.ts`: T2 check, HUD at 360x740 / 360x780 fits while playing and
    paused (passes as is, so the HUD is unchanged). `playwright.config.ts` takes `PW_PORT` like kryfes-maches.
    Test-count floor 182 → 200.
- **MI-RETRY / MAGIC-ISLANDS-T1** (PR #29, owner decision 11 of 2026-10-22): after a loss, «Ξανά από την αρχή 🐉»
  restarts the same island and keeps the keys earned so far (GAME-STANDARD §6, no punishing loss). Before, it always
  went back to Μονοκέρια with 0 keys. The lose card text now says so instead of promising Μονοκέρια. Save key and
  v1 format unchanged; graphics unchanged.
  - Tests: the T1 test in `tests/flow.spec.ts` passes instead of `test.fail` (and fails on the old code); a new test
    covers a loss on the first island (Μονοκέρια, 0 keys, nothing saved). Test-count floor 180 → 182 (181 listed before + 1).
- **G1-GFX-2026-10-22** (PR #25): a clearly better look with the same gameplay, controls, difficulty, texts, save key and
  save format, and a much cheaper frame.
  - **Frame:** the pre-rendered island is built at the screen's own scale and copied 1:1 at whole pixels. Before,
    it was a scaled copy every frame, about 20 ms of a 1180x820 frame.
    - At 1x: 59 fps instead of 37-39; script time per frame 8 ms instead of 21 ms.
    - At 4x CPU: 14-17 fps instead of 6-7.
    - Spirit auras, glow plants, the key and the water/magic orbs are pre-rendered glow sprites instead of
      per-frame gradients; backgrounds and the title sky are cached per island and size.
  - **Backgrounds per island:** far layers with 0.08x parallax:
    - Μονοκέρια: islets and sea glints;
    - Γοργονία: kelp;
    - Κρυσταλία: snowy peaks and stars;
    - Αγάπη: storybook cloud sprites and heart islets.
  - **Under and around the island:** foam at the cliff foot (Μονοκέρια), cloud skirts under the sky islands, and a
    rim light baked into the island.
  - **Characters:**
    - spirits blink and squash/stretch softly with their bob;
    - Ίριδα blinks;
    - enemies get cute round eyes with a soft brow, blush, a blink and a thin ink outline;
    - bosses get softer brows and rosy cheeks.
  - **Dialog:** a storybook bubble with a ringed round portrait (rainbow for Ίριδα, rose for a boss), a name tag, an
    inner bubble with a tail, and a live portrait redrawn every frame.
  - **HUD:** emoji with a dark outline; collected keys glow.
  - **Screens:**
    - an animated title logo (float, light sweep, sparkles);
    - the title gets a moon with a glow, two cloud layers with parallax, sea glints and a shooting star;
    - the flight gets clouds at three depths and a sun glow;
    - the win gets a moon and hills;
    - cards pop and the dialog slides up (transform only);
    - a 0.35 s canvas fade into each new island, the flight, the win and the title.
  - **Reduced motion:** no ambient particles (fireflies, bubbles, snow, hearts), no parallax, static backgrounds, a
    still logo and a still portrait. The particle pool and its cap (250) are unchanged.
  - **Probe and tests:**
    - the test probe `/?e2e` gains `__mi.gfx`;
    - new `tests/look.spec.ts`: every screen at 4 sizes x light/dark with 0 console errors and axe 0 serious, the
      layers, parallax, reduced motion, the live portrait, the particle cap and the old save format. 4 of its tests
      fail on the old code; the screen and save guards pass on both.
    - `tests/perf.spec.ts` (PERF=1) and `tests/evidence.spec.ts` (EVIDENCE=dir) are not in CI.
  - **README:** «Τι άλλαξε» with before/after images in `docs/screens/gfx/`, and MI-31..MI-37 for the family
    tablet test.
- **Particle effects** (G1-MI-PARTICLES, PR #20): one pooled particle system drawn with code on the canvas.
  - `CONFIG.particles` at the top of the script: `enabled`, `max` (250) and a count per effect. Off with
    `prefers-reduced-motion`.
  - Pool = preallocated typed arrays, swap-remove on death, delta-time motion (drag via `exp(-k·dt)`): no
    allocations per frame. When full, a new particle reuses an old slot (round-robin), so the newest effect shows.
  - Effects, each with its own shape (colour-blind safe) and a dark rim: key glints while it waits + star burst and
    rings on pick-up; per spell leaves (Ναπολέων) or ice diamonds (Αριάνα); rainbow stars for the Ίριδα; drops +
    rings when Ζαφείρης dives into the sea (flight to Γοργονία) and where a Κύμα Νερού hits.
  - The old enemy sparks, the snowstorm flakes, the water trail and the win fireworks now use the same pool
    (before: object per particle, `filter()` every frame, cap 700).
  - Test probe `/?e2e` gains `__mi.fx` (pool counters) and `__mi.burst`. New `tests/particles.spec.ts` (13 tests:
    collect + drain to 0, every spell + Ίριδα, splash on the dive, cap, reduced motion = none, 1280 / 1180x820 /
    820x1180 / 360 × light + dark with 0 console errors); all 13 fail on the previous `index.html`.
  - README: «Οθόνες και ροή» §8 Εφέ, MI-26..MI-30, «Τι άλλαξε», «Γνωστοί περιορισμοί». Save key unchanged.
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
