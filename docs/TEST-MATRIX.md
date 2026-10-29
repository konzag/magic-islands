# Test matrix: magic-islands

Date: 2026-10-29 (CLOSE-ALL §2.1). One row for each of the owner's test types, in the owner's order (the list at the
end of PROMPT-CLOSE-ALL-2026-10-28 has 71 names; every one has its row here).

- **Applies**: `yes` = the game has what the type tests; `no` = it does not (reason in the last column);
  `no (manual)` = needs a person, no fake test; `infra: homelab-scripts` = host-level, owned by homelab-scripts.
- **Exists** (only for `yes`): `yes` = a test that checks it runs today; `partial` = some of it; `missing` = nothing yet.
- **Where**: paths in this repo, the CI job, or rows of homelab-acceptance `tests/12-magic-islands.spec.ts` (MI-xx =
  the README manual-test rows; `manual(...)` rows there are the owner's).
- **Runs**: PR CI = `.github/workflows/ci.yml` job `test` (every PR into staging/main and push to staging/main);
  nightly on staging = homelab-acceptance nightly (03:15); after each release = homelab-acceptance `test:prod`
  (`@prod-safe` rows, read-only); weekly from the runner = VM 107, staging only.

The game is static: one `index.html` served by games-hub at `/magic-islands/` (public, no login). It makes no network
calls at all (progress only in localStorage), so every server-side type is `no` here; the hub's headers, health and
metrics are in the games-hub matrix.

| Type | Applies | Exists | Where | Runs | Why not / gap |
|---|---|---|---|---|---|
| unit | yes | partial | tests/save.spec.ts (save rules), tests/particles.spec.ts «cap…», tests/ci-workflow.spec.ts | PR CI | Game rules (waves, spells, damage) are only checked through whole screens; no direct test of the pure functions via `page.evaluate` |
| component | yes | yes | tests/joystick.spec.ts (joystick, spell buttons), tests/theme.spec.ts (🌓 switch), tests/particles.spec.ts | PR CI | |
| integration | yes | yes | tests/smoke.spec.ts under the hub CSP (tests/serve.mjs + tests/hub-csp.mjs, the hub's font path) | PR CI | |
| API | no | | | | No API and no network calls |
| contract | no | | | | No API shared with another repo; the hub's game-page CSP is checked in row security configuration |
| end-to-end | yes | yes | homelab-acceptance tests/12-magic-islands.spec.ts MI-01..MI-40 (manual: MI-05..07, MI-19..21, MI-30..37) | nightly on staging; after each release (@prod-safe) | |
| functional | yes | yes | tests/smoke.spec.ts, tests/flow.spec.ts, tests/flight.spec.ts, tests/storybook.spec.ts | PR CI | |
| positive | yes | yes | tests/smoke.spec.ts (keyboard + touch 10 s), acceptance MI-09, MI-14 | PR CI; nightly on staging | |
| negative | yes | yes | tests/save.spec.ts «corrupt or out-of-range save never crashes…», tests/theme.spec.ts «a bad theme value…» | PR CI | |
| boundary | yes | yes | tests/save.spec.ts (out-of-range island values), tests/joystick.spec.ts (dead zone, full drag), tests/particles.spec.ts (pool cap) | PR CI | |
| validation | yes | yes | tests/save.spec.ts (a stored save is checked before use), tests/theme.spec.ts (bad theme value) | PR CI | |
| state transition | yes | yes | tests/flow.spec.ts (title → play → pause → resume → home; losing), tests/flight.spec.ts; acceptance MI-12, MI-15, MI-16 | PR CI; nightly on staging | |
| business rule | yes | yes | tests/save.spec.ts «progress never goes down», «winning the last island clears the save»; tests/flow.spec.ts (keys kept); acceptance MI-03 (🌈 once), MI-08 | PR CI; nightly on staging | |
| acceptance/UAT | yes | yes | homelab-acceptance tests/12-magic-islands.spec.ts (one test per README MI row) | nightly on staging | |
| smoke | yes | yes | tests/smoke.spec.ts; acceptance @prod-safe rows (MI-01) | PR CI; after each release | |
| sanity | yes | yes | tests/smoke.spec.ts «GAME-STANDARD §4…» + 10 s keyboard / touch | PR CI | |
| regression | yes | yes | tests/flight.spec.ts (heroes stuck after the dragon flight), tests/flow.spec.ts (MI-12), tests/layout.spec.ts (§3a) | PR CI | |
| retesting/confirmation | yes | yes | acceptance MI-09, MI-11, MI-12 (README «Τι άλλαξε» rows re-run on staging) | nightly on staging | |
| UI | yes | yes | tests/look.spec.ts, tests/layout.spec.ts, tests/theme.spec.ts; acceptance MI-18, MI-22, MI-38, MI-39 | PR CI; nightly on staging | |
| visual regression | yes | partial | tests/evidence.spec.ts (all screens at 1280, 1180x820, 820x1180, 360, light + dark) | PR CI | Screenshots are taken but not compared: no `toHaveScreenshot` baselines in git |
| responsive | yes | yes | tests/layout.spec.ts, playwright.config.ts projects phone, tablet-portrait; tests/axe.spec.ts sizes | PR CI | |
| cross-browser | yes | partial | playwright.config.ts (Chromium only) | PR CI | Firefox and WebKit not run |
| cross-device/OS | yes | yes | playwright.config.ts projects desktop, tablet (touch), phone (touch), tablet-portrait; real tablet: acceptance MI-05..07, MI-19..21 (manual) | PR CI | |
| usability | no (manual) | | | | Needs the kids and a person |
| accessibility | yes | yes | tests/axe.spec.ts, tests/keyboard.spec.ts (MI-23 focus ring + axe), tests/look.spec.ts, tests/theme.spec.ts; acceptance MI-23, MI-24 | PR CI; nightly on staging | |
| localization/internationalization | no | | | | Greek only, one language |
| content | yes | yes | tests/readme.spec.ts (nine README sections, unique IDs, no hostnames); acceptance MI-02 (dialog texts), MI-12, MI-14 | PR CI; nightly on staging | |
| performance | yes | partial | tests/perf.spec.ts (frame budget, only with PERF=1) | manual | Informative only, no threshold that fails |
| load | yes | partial | homelab-acceptance load/locustfile.py + load/thresholds.json «GET games-hub /magic-islands/» | manual (`npm run load:staging`) | Not scheduled weekly from the runner |
| stress | yes | missing | | weekly from the runner (to add) | Nothing yet |
| spike | yes | missing | | weekly from the runner (to add) | Nothing yet |
| soak/endurance | yes | missing | | weekly from the runner (to add) | Nothing yet (also no long in-browser play run for memory growth) |
| scalability | yes | missing | | weekly from the runner (to add) | Nothing yet |
| volume | yes | missing | | weekly from the runner (to add) | Static page, no stored server data; nothing measures many requests for the page's files |
| concurrency | yes | missing | | weekly from the runner (to add) | No concurrent-users run (k6/Locust) against staging |
| frontend performance | yes | missing | | weekly from the runner (to add) | No Lighthouse CI budgets |
| authentication | no | | | | Public page, no login, no PIN, no server save |
| authorization | no | | | | No users or roles |
| session | no | | | | No session; progress only in localStorage |
| input security | no | | | | No text input (keyboard / touch controls only), no network |
| request security | no | | | | Sends no requests (acceptance MI-25) |
| file upload | no | | | | No upload |
| rate limiting/abuse | no | | | | No endpoint of its own; the hub's limits are in games-hub |
| security configuration | yes | yes | tests/hub-csp.mjs (the hub's game-page CSP) + tests/smoke.spec.ts §4 (0 CSP violations, no inline handlers); CI job `gitleaks` | PR CI | The headers themselves are tested in games-hub |
| dependency scans | yes | partial | .github/dependabot.yml | weekly (Dependabot) | No `npm audit` / OSV step in CI |
| SAST/DAST | yes | missing | | PR CI (SAST); weekly from the runner (ZAP baseline, to add) | No Semgrep/CodeQL job; no ZAP baseline against staging |
| penetration | no (manual) | | | | Manual only |
| privacy | yes | yes | tests/smoke.spec.ts §4 (no external URLs), acceptance MI-25 (no requests besides the page, the hub font and the icons), tests/readme.spec.ts (no hostnames / private IPs) | PR CI; nightly on staging | |
| database | no | | | | No server DB |
| data integrity/transaction | yes | yes | tests/save.spec.ts «save key and format are frozen», «progress never goes down», «localStorage that throws…»; acceptance MI-40 | PR CI; nightly on staging | |
| migration | no | | | | No server schema; the localStorage save format is covered by row compatibility |
| import/export | no | | | | No import or export |
| caching | yes | yes | tests/storybook.spec.ts «painted once into sprites and then only copied», tests/look.spec.ts «cached backgrounds» | PR CI | HTTP caching headers are games-hub's |
| third-party integration | no | | | | No third party (tests/smoke.spec.ts §4, acceptance MI-25) |
| webhook/queue/background job | no | | | | No jobs |
| idempotency | no | | | | No requests and no repeated writes that could double (a save only moves forward, row business rule) |
| error handling | yes | yes | tests/smoke.spec.ts (0 console errors), tests/save.spec.ts (corrupt save, throwing localStorage), tests/particles.spec.ts (0 errors) | PR CI | |
| network | infra: homelab-scripts | | | | The game makes no network calls |
| offline/PWA | no | | | | No service worker (owner rule; GAMES-OFFLINE dropped 29/10; tests/smoke.spec.ts checks there is none) |
| resilience/failover | infra: homelab-scripts | | | | Static page; serving is games-hub's |
| recovery/disaster recovery | infra: homelab-scripts | | | | |
| backup/restore | infra: homelab-scripts | | | | No server data (progress is on the device) |
| chaos | infra: homelab-scripts | | | | |
| deployment/rollback | infra: homelab-scripts | | | | Release = games-hub submodule SHA; app part: the previous release's save loads (row compatibility) |
| configuration | yes | yes | tests/storybook.spec.ts «`?plain` (CONFIG.storybook = false)…», tests/theme.spec.ts «a bad theme value falls back…» | PR CI | Settings are the `CONFIG` constants in index.html |
| observability | no | | | | Static page: health, metrics and X-Request-ID are games-hub's |
| SEO | yes | missing | | | Public game page: `<html lang="el">`, `<title>`, theme-color exist, but no meta description and no test |
| analytics | no | | | | Policy: no analytics; acceptance MI-25 and tests/smoke.spec.ts §4 prove nothing third-party loads |
| exploratory | no (manual) | | | | Needs a person |
| ad hoc | no (manual) | | | | Needs a person |
| compatibility/backward compatibility | yes | yes | tests/save.spec.ts «save key and format are frozen», tests/look.spec.ts «an old save loads and is written in the same format»; acceptance MI-10, MI-11 | PR CI; nightly on staging | |

## Gaps

1. unit (partial): add direct tests of the pure game rules (waves, spells, damage) through `page.evaluate`.
2. visual regression (partial): `toHaveScreenshot` baselines in git at 1280, 820x1180, 1180x820, 360, light + dark.
3. cross-browser (partial): run the Playwright suite on Firefox and WebKit too.
4. performance (partial): a frame-time threshold that fails, run weekly from the runner.
5. load (partial): schedule the Locust games-hub run weekly from the runner VM 107.
6. stress (missing): step load on `/magic-islands/` on staging until the budget breaks.
7. spike (missing): sudden burst on `/magic-islands/` on staging.
8. soak/endurance (missing): up to 60 minutes on staging (and a long in-browser play run for memory growth).
9. scalability (missing): p95 at 1x/2x/4x users on staging.
10. volume (missing): many requests for the page and its files on staging.
11. concurrency (missing): concurrent users (k6/Locust) on `/magic-islands/` on staging.
12. frontend performance (missing): Lighthouse CI budgets for `/magic-islands/`.
13. dependency scans (partial): `npm audit` / OSV step in CI.
14. SAST/DAST (missing): Semgrep (or CodeQL) on PRs; ZAP baseline against staging weekly.
15. SEO (missing): meta description + a test of title, lang and description on the public page.
