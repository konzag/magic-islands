// GAMES-GFX storybook look (art direction v1, owner «ναι» 2026-10-27). Checked through the opt-in test probe
// (`/?e2e` → window.__mi.paint):
// - spirits, unicorns, props, the key, Ίριδα and the minions are painted once into sprites and then only copied;
// - `/?e2e&plain` (CONFIG.storybook = false) keeps the plain vector art: no sprites, no live paints, no foreground;
// - a defeated monster turns into glowing sparkles that fade out (capped); none with reduced motion;
// - each island paints its sprites in its own light (the cache is emptied on a palette change);
// - the foreground layer is drawn at the screen's corners on the islands;
// - 0 console errors / CSP violations.
import { expect, test, type Page } from '@playwright/test';

type Paint = {
  on: boolean; auto: boolean; R: number; sprites: number; bakes: number; bakeMs: number; copies: number; live: number;
  post: boolean; postBuilds: number; fore: number; glows: number; glowsSpawned: number; ema: number;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { G: any; paint: Paint } };

async function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`));
  });
  return problems;
}
const state = (page: Page) => page.evaluate(() => window.__mi.G.state);
const paint = (page: Page) => page.evaluate(() => window.__mi.paint);
async function advanceTo(page: Page, want: string) {
  for (let i = 0; i < 300 && (await state(page)) !== want; i++) {
    if (await page.locator('#dialog').isVisible()) await page.locator('#dialog').click();
    else if (await page.locator('#flight-skip').isVisible()) await page.locator('#flight-skip').click();
    else await page.waitForTimeout(100);
  }
  expect(await state(page)).toBe(want);
}
async function toPlay(page: Page, query = '', island = 0) {
  await page.goto(`/?e2e${query}`);
  await page.evaluate(([n]) => {
    if (n) localStorage.setItem('magic-islands.progress.v1', JSON.stringify({ v: 1, island: n, keys: n }));
    else localStorage.removeItem('magic-islands.progress.v1');
  }, [island]);
  await page.goto(`/?e2e${query}`);
  await page.locator(island ? '#continue-btn' : '#start-btn').click();
  await advanceTo(page, 'play');
  await page.evaluate(() => { for (const h of window.__mi.G.heroes) h.hp = h.max = 1e9; });
}
/** Three minions with 1 HP right next to Ναπολέων, then his «Αγκαθωτά Κλαδιά» (3) hits them all. */
async function defeatNearby(page: Page) {
  await expect.poll(() => page.evaluate(() => window.__mi.G.enemies.some((e: { dead: boolean; spawn: number }) => !e.dead && e.spawn <= 0)), { timeout: 10_000 }).toBe(true);
  await page.evaluate(() => {
    const G = window.__mi.G, h = G.heroes[0];
    G.active = 0; G.toSpawn = 0;
    G.enemies.forEach((e: { dead: boolean }) => { e.dead = true; });
    const tpl = G.enemies[0];
    for (let i = 0; i < 3; i++) G.enemies.push({ ...tpl, x: h.x + 40 + i * 30, y: h.y + 10, hp: 1, max: 1, dead: false, spawn: 0, frozen: 0, rooted: 0, boss: false });
  });
  await page.keyboard.press('Digit3');
}

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for the paint counters');
});

test('storybook paint: the world is painted once into sprites and then only copied', async ({ page }) => {
  const problems = await watch(page);
  await toPlay(page);
  // the frame steps of the spirits, unicorns and minions get painted once; then a second of play paints (almost)
  // nothing new (a sprite painted again every frame would add ~1 bake per frame forever)
  await expect.poll(async () => {
    const a = (await paint(page)).bakes;
    await page.waitForTimeout(1000);
    return (await paint(page)).bakes - a;
  }, { timeout: 30_000, intervals: [0] }).toBeLessThan(8);
  const b = await paint(page);
  expect(b.on).toBe(true);
  expect(b.sprites).toBeGreaterThan(30);
  expect(b.copies).toBeGreaterThan(30); // spirits, unicorns, props, key, Ίριδα, minions: copies in the last frame
  expect(b.post).toBe(true);
  expect(problems).toEqual([]);
});

test('`?plain` (CONFIG.storybook = false): the plain vector art, no sprites, no live paints, no foreground', async ({ page }) => {
  const problems = await watch(page);
  await toPlay(page, '&plain');
  await page.waitForTimeout(1500);
  const p = await paint(page);
  expect(p.on).toBe(false);
  expect(p.sprites).toBe(0);
  expect(p.copies).toBe(0);
  expect(p.live).toBe(0);
  expect(p.fore).toBe(0);
  expect(problems).toEqual([]);
});

test('a defeated monster turns into glowing sparkles that fade out', async ({ page }) => {
  const problems = await watch(page);
  await toPlay(page);
  await defeatNearby(page);
  await expect.poll(async () => (await paint(page)).glowsSpawned, { timeout: 5000 }).toBeGreaterThan(0);
  expect((await paint(page)).glows).toBeLessThanOrEqual(60);
  await expect.poll(async () => (await paint(page)).glows, { timeout: 5000 }).toBe(0);
  expect(problems).toEqual([]);
});

test('reduced motion: no sparkles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const problems = await watch(page);
  await toPlay(page);
  await defeatNearby(page);
  await page.waitForTimeout(800);
  expect((await paint(page)).glowsSpawned).toBe(0);
  expect(problems).toEqual([]);
});

test('each island paints in its own light, and the foreground is drawn at the corners', async ({ page }) => {
  const problems = await watch(page);
  await toPlay(page, '', 1);
  await page.waitForTimeout(1500);
  const g = await paint(page);
  expect(g.fore).toBe(1);
  expect(g.sprites).toBeGreaterThan(0);
  // back to the title (the night-sky palette): the island's sprites are not reused there
  await page.evaluate(() => { window.__mi.G.state = 'title'; });
  await page.waitForTimeout(400);
  expect((await paint(page)).sprites).toBeLessThan(g.sprites);
  expect(problems).toEqual([]);
});
