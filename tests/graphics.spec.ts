// GAMES-GRAPHICS (L1-26, games-template docs/specs/GAMES-GRAPHICS.md; owner 02/11: Α + Β by default, «like console
// games: light, shadows and textures»). Checked through the opt-in test probe (`/?e2e` → window.__mi.graphics) and the
// canvas pixels; `/?e2e&gfx=base` is the look before GAMES-GRAPHICS.
// Tier Α (light and shadow):
// - soft shadows: copies of one cached blurred sprite under heroes, props and monsters (none with gfx=base);
// - the sea / sky is lit by each island's light: brighter near the sun (top-left), the far water darker;
// - the light is baked: with reduced motion the lit background stands still; no new storage key, save unchanged.
import { expect, test, type Page } from '@playwright/test';

type Graphics = { a: boolean; b: boolean; soft: number; len: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { G: any; graphics: Graphics } };
const SAVE_KEY = 'magic-islands.progress.v1';

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
const graphics = (page: Page) => page.evaluate(() => window.__mi.graphics);
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
  await page.evaluate(([k, n]) => {
    if (n) localStorage.setItem(k as string, JSON.stringify({ v: 1, island: n, keys: n }));
    else localStorage.removeItem(k as string);
  }, [SAVE_KEY, island] as const);
  await page.goto(`/?e2e${query}`);
  await page.locator(island ? '#continue-btn' : '#start-btn').click();
  await advanceTo(page, 'play');
  await page.evaluate(() => { const G = window.__mi.G; G.toSpawn = 0; G.enemies.length = 0; for (const h of G.heroes) h.hp = h.max = 1e9; });
  await page.waitForTimeout(400);
}
/** Mean brightness (0..255) of a block of the game canvas, in CSS pixels. */
const lum = (page: Page, x: number, y: number, w: number, h: number) => page.evaluate(([x, y, w, h]) => {
  const cv = document.getElementById('cv') as HTMLCanvasElement, k = cv.width / innerWidth;
  const d = cv.getContext('2d')!.getImageData(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k)).data;
  let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return s / (d.length / 4);
}, [x, y, w, h]);

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for the probe and the pixels');
});

test('Α: soft shadows are copies of one cached sprite; gfx=base keeps the old ones', async ({ page }) => {
  const problems = await watch(page);
  await toPlay(page);
  const g = await graphics(page);
  expect(g.a).toBe(true);
  expect(g.soft, 'soft shadows in the last frame (heroes, unicorns, props)').toBeGreaterThan(20);
  await toPlay(page, '&gfx=base');
  const b = await graphics(page);
  expect(b.a).toBe(false);
  expect(b.soft).toBe(0);
  expect(problems).toEqual([]);
});

test('Α: every island is lit: brighter near its light, the far water / sky darker', async ({ page }) => {
  const problems = await watch(page);
  for (const island of [0, 1, 2, 3]) {
    await toPlay(page, '&gfx=base', island);
    const before = { near: await lum(page, 8, 8, 40, 30), far: await lum(page, 8, 650, 40, 30) };
    await toPlay(page, '', island);
    const after = { near: await lum(page, 8, 8, 40, 30), far: await lum(page, 8, 650, 40, 30) };
    expect(after.near, `island ${island + 1}: near the light`).toBeGreaterThan(before.near + 4);
    expect(after.near - after.far, `island ${island + 1}: light falls off`).toBeGreaterThan(before.near - before.far + 4);
  }
  expect(problems).toEqual([]);
});

test('Α: the light is baked: still with reduced motion; no new storage key, save unchanged', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const problems = await watch(page);
  await toPlay(page);
  const a = await lum(page, 8, 8, 120, 60);
  await page.waitForTimeout(1200);
  expect(await lum(page, 8, 8, 120, 60), 'the lit sea stands still').toBeCloseTo(a, 5);
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys.filter((k) => k !== SAVE_KEY && k !== 'magic-islands.theme.v1')).toEqual([]);
  await page.evaluate(() => { const G = window.__mi.G, h = G.heroes[G.active]; G.enemies.length = 0; G.toSpawn = 0; G.phase = 'key'; G.key = { T: 'key', x: h.x, y: h.y, t: 1 }; });
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), SAVE_KEY), { timeout: 10_000 }).toContain('"island":1');
  const save = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY))!);
  expect(Object.keys(save).sort()).toEqual(['hub', 'island', 'keys', 'v']);
  expect(save.v).toBe(1);
  expect(problems).toEqual([]);
});

test('Α: each island has its own light; the sunset (Αγάπη) has the longest shadows', async ({ page }) => {
  const problems = await watch(page);
  const len: number[] = [];
  for (const island of [0, 1, 2, 3]) {
    await toPlay(page, '', island);
    const g = await graphics(page);
    expect(g.soft, `island ${island + 1}: soft shadows`).toBeGreaterThan(10);
    len.push(g.len);
  }
  expect(Math.max(...len)).toBe(len[3]);
  expect(len[3]).toBeGreaterThan(len[0] * 1.3);
  expect(problems).toEqual([]);
});
