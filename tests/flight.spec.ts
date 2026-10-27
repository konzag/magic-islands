// The dragon flight between islands is the game's only ride. After it (skipped or watched to the end) the heroes must
// walk at once, by keys and by finger (SHIP-ALL 2026-10-27: the family's «cannot walk after the ride» report; the boat
// bug was in kryfes-maches, this pins the same path here). Desktop = keys; tablet + phone = the floating joystick.
import { expect, test, type Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { G: any } };
const SAVE_KEY = 'magic-islands.progress.v1';
const state = (page: Page) => page.evaluate(() => window.__mi.G.state);

async function advanceTo(page: Page, want: string, skipFlight: boolean) {
  for (let i = 0; i < 400 && (await state(page)) !== want; i++) {
    if (await page.locator('#dialog').isVisible()) await page.locator('#dialog').click({ timeout: 1500 }).catch(() => {});
    else if (skipFlight && (await page.locator('#flight-skip').isVisible())) await page.locator('#flight-skip').click({ timeout: 1500 }).catch(() => {});
    else await page.waitForTimeout(100);
  }
  expect(await state(page)).toBe(want);
}
/** Skip the waves: the key lies under the active hero, so the next frame takes it and the flight starts. */
async function takeKey(page: Page) {
  await page.evaluate(() => {
    const G = window.__mi.G, h = G.heroes[G.active];
    G.enemies.length = 0; G.toSpawn = 0; G.phase = 'key'; G.key = { T: 'key', x: h.x, y: h.y, t: 1 };
    for (const x of G.heroes) x.hp = x.max = 1e9;
  });
  await advanceTo(page, 'flight', false);
}
const hero = (page: Page) => page.evaluate(() => { const G = window.__mi.G, h = G.heroes[G.active]; return { x: h.x, y: h.y, island: G.island }; });
async function walk(page: Page, touch: boolean) {
  const a = await hero(page);
  if (touch) {
    const cdp = await page.context().newCDPSession(page), vp = page.viewportSize()!;
    const cx = vp.width * 0.22, cy = vp.height * 0.65;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
    for (let k = 0; k < 12; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 40, y: cy, id: 1 }] });
      await page.waitForTimeout(80);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1000); await page.keyboard.up('ArrowRight');
  }
  const b = await hero(page);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

test('after the dragon flight (skipped, then watched to the end) the heroes walk at once', async ({ page }, info) => {
  test.skip(!['desktop', 'tablet', 'phone'].includes(info.project.name));
  const touch = info.project.name !== 'desktop';
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto('/?e2e');
  await page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
  await page.goto('/?e2e');
  await page.locator('#start-btn').click();
  await advanceTo(page, 'play', true);
  await takeKey(page);
  await advanceTo(page, 'play', true); // the flight skipped
  expect((await hero(page)).island).toBe(1);
  expect(await walk(page, touch), 'walks after the skipped flight').toBeGreaterThan(60);
  await takeKey(page);
  for (let i = 0; i < 300 && (await state(page)) === 'flight'; i++) await page.waitForTimeout(100); // watched to the end
  await advanceTo(page, 'play', false);
  expect((await hero(page)).island).toBe(2);
  expect(await walk(page, touch), 'walks after the full flight').toBeGreaterThan(60);
  expect(problems).toEqual([]);
});

test('from a save («Συνέχεια»), the flight to the next island leaves the heroes free to walk', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' && info.project.name !== 'phone');
  const touch = info.project.name !== 'desktop';
  await page.goto('/?e2e');
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, island: 1, keys: 1 })), SAVE_KEY);
  await page.goto('/?e2e');
  await page.locator('#continue-btn').click();
  await advanceTo(page, 'play', true);
  await takeKey(page);
  await advanceTo(page, 'play', true);
  expect((await hero(page)).island).toBe(2);
  expect(await walk(page, touch)).toBeGreaterThan(60);
});
