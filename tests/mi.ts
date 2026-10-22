// Shared helpers for save.spec.ts, flow.spec.ts and axe.spec.ts (not a spec itself: testMatch is *.spec.ts).
// Everything goes through the opt-in test probe (`/?e2e` → window.__mi.G, read by reference) and localStorage;
// index.html is never changed for the tests.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { G: any } };

/** The frozen save contract (README «Αποθήκευση», GAME-STANDARD §5): never rename, every child's progress lives here. */
export const SAVE_KEY = 'magic-islands.progress.v1';

export const state = (page: Page) => page.evaluate(() => window.__mi.G.state);
export const G = <T>(page: Page, pick: string) => page.evaluate((p) => window.__mi.G[p], pick) as Promise<T>;
export const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);

/** Console errors, page errors and CSP violations (same watcher as smoke.spec.ts). */
export async function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)); });
  return problems;
}

/** Put `raw` (a string, or null = no save) into the save key before the page's own script runs. Only once per
 *  test, so a later reload sees what the game wrote, not the seed again. */
export async function seedSave(page: Page, raw: string | null) {
  await page.addInitScript(([k, v]) => {
    if (sessionStorage.getItem('mi-test-seeded')) return;
    sessionStorage.setItem('mi-test-seeded', '1');
    if (v === null) localStorage.removeItem(k as string); else localStorage.setItem(k as string, v as string);
  }, [SAVE_KEY, raw]);
}

/** Through the story dialogs (and the dragon flight, if `skipFlight`) until the game is in `want`. */
export async function advanceTo(page: Page, want: string, skipFlight = true) {
  for (let i = 0; i < 300 && (await state(page)) !== want; i++) {
    if (await page.locator('#dialog').isVisible()) await page.locator('#dialog').click();
    else if (skipFlight && (await page.locator('#flight-skip').isVisible())) await page.locator('#flight-skip').click();
    else await page.waitForTimeout(100);
  }
  expect(await state(page)).toBe(want);
}

/** Drop the island key on the active hero: the game's own update loop picks it up (collectKey → saveProgress). */
export const keyOnHero = (page: Page) => page.evaluate(() => {
  const G = window.__mi.G, h = G.heroes[G.active];
  G.enemies.length = 0; G.toSpawn = 0; G.phase = 'key'; G.key = { T: 'key', x: h.x, y: h.y, t: 1 };
});

/** A real loss: wait for the first enemies, make both heroes very tired and put the enemies on them, so the game's own
 *  hurtHero → lose() runs; then wait for the «Ωχ! Κουραστήκαμε…» screen. */
export async function forceLoss(page: Page) {
  await expect.poll(() => page.evaluate(() => window.__mi.G.enemies.length), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.evaluate(() => {
    const G = window.__mi.G;
    G.shieldT = 0;
    for (const h of G.heroes) { h.hp = 0.01; h.x = 0; h.y = 60; }
    for (const e of G.enemies) { e.spawn = 0; e.touchCd = 0; e.frozen = 0; e.rooted = 0; e.x = 0; e.y = 60; }
  });
  await expect.poll(() => state(page), { timeout: 15_000 }).toBe('lose');
}

/** axe (WCAG 2.1 A/AA) on one screen: only the serious / critical findings, as readable lines. */
export async function axeSerious(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).include(where).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}
