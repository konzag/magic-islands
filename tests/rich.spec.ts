// GAMES-GRAPHICS tier Γ «ζωντανός κόσμος», only behind «🎨 Γραφικά: Κανονικά / Πλούσια» (owner 02/11). «Κανονικά» is
// the default (tiers Α + Β). «Πλούσια» adds wind gusts in the plants and leaves blown across the screen; it is off
// with prefers-reduced-motion and falls back by itself on a slow device. Own key magic-islands.gfx.v1; the progress
// key and its value never change.
import { expect, test, type Page } from '@playwright/test';
import { advanceTo, axeSerious, seedSave, stored, watch } from './mi';

/* eslint-disable @typescript-eslint/no-explicit-any */
const RICH_KEY = 'magic-islands.gfx.v1';
const PROGRESS = '{"v":1,"island":2,"keys":2}';
type Gr = { rich: boolean; richPick: boolean; richAuto: boolean; leaves: number };
const gr = (page: Page) => page.evaluate(() => (window as any).__mi.graphics as Gr);

test('«Κανονικά» by default: no gusts, no blown leaves, nothing written', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/?e2e');
  await expect(page.locator('#gfx-btn')).toHaveText('🎨 Γραφικά: Κανονικά');
  await expect(page.locator('#gfx-btn')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#start-btn').click();
  await advanceTo(page, 'play');
  expect(await gr(page)).toMatchObject({ rich: false, leaves: 0 });
  expect(await page.evaluate((k) => localStorage.getItem(k), RICH_KEY)).toBeNull();
  expect(problems).toEqual([]);
});

test('«Πλούσια» adds the blown leaves at once, is remembered, and switches off again from the pause card', async ({ page }, info) => {
  const problems = await watch(page);
  const tap = info.project.name === 'tablet';
  await seedSave(page, PROGRESS);
  await page.goto('/?e2e');
  const b = page.locator('#gfx-btn');
  const box = (await b.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await (tap ? b.tap() : b.click());
  await expect(b).toHaveText('🎨 Γραφικά: Πλούσια');
  await expect(b).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate((k) => localStorage.getItem(k), RICH_KEY)).toBe('rich');
  await page.reload();
  await page.locator('#continue-btn').click();
  await advanceTo(page, 'play');
  const g = await gr(page);
  expect(g.rich).toBe(true);
  expect(g.leaves).toBeGreaterThan(10);
  // the leaves move with the wind
  const pos = () => page.evaluate(() => (window as any).__mi.G.amb.filter((a: any) => a.type === 'leaf').map((a: any) => a.x));
  const x0 = await pos(); await page.waitForTimeout(600); const x1 = await pos();
  expect(x1.some((x: number, i: number) => Math.abs(x - x0[i]) > 0.001)).toBe(true);
  await page.keyboard.press('KeyP');
  await expect(page.locator('#paused')).toBeVisible();
  const bp = page.locator('#gfx-btn-pause');
  await (tap ? bp.tap() : bp.click());
  await expect(bp).toHaveText('🎨 Γραφικά: Κανονικά');
  expect(await gr(page)).toMatchObject({ rich: false, leaves: 0 });
  expect(await page.evaluate((k) => localStorage.getItem(k), RICH_KEY)).toBe('normal');
  expect(await stored(page)).toBe(PROGRESS);
  expect(problems).toEqual([]);
});

test('reduced motion: «Πλούσια» stays off whatever is stored', async ({ page }) => {
  const problems = await watch(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((k) => localStorage.setItem(k, 'rich'), RICH_KEY);
  await page.goto('/?e2e');
  await page.locator('#start-btn').click();
  await advanceTo(page, 'play');
  expect(await gr(page)).toMatchObject({ rich: false, richPick: true, leaves: 0 });
  expect(problems).toEqual([]);
});

test('a slow device falls back to «Κανονικά» by itself (the stored choice stays)', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = await watch(page);
  await page.addInitScript((k) => localStorage.setItem(k, 'rich'), RICH_KEY);
  await page.goto('/?e2e');
  await page.locator('#start-btn').click();
  await advanceTo(page, 'play');
  expect((await gr(page)).rich).toBe(true);
  // frames slower than CONFIG.slowFrameMs for slowFrameSec: fed to the same frame watch the game uses
  await page.evaluate(() => { for (let i = 0; i < 200; i++) (window as any).__mi.watchFrame(60); });
  expect(await gr(page)).toMatchObject({ rich: false, richAuto: true, leaves: 0 });
  expect(await page.evaluate((k) => localStorage.getItem(k), RICH_KEY)).toBe('rich');
  expect(problems).toEqual([]);
});

test('English labels for the setting', async ({ page }) => {
  const problems = await watch(page);
  await page.addInitScript(() => localStorage.setItem('games.lang', 'en'));
  await page.goto('/?e2e');
  await expect(page.locator('#gfx-btn')).toHaveText('🎨 Graphics: Normal');
  await page.locator('#gfx-btn').click();
  await expect(page.locator('#gfx-btn')).toHaveText('🎨 Graphics: Rich');
  expect(problems).toEqual([]);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe serious/critical = 0 on the title with the setting (360 ${scheme})`, async ({ page }) => {
    const problems = await watch(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/?e2e');
    await page.waitForTimeout(400);
    await expect(page.locator('#gfx-btn')).toBeInViewport();
    expect(await axeSerious(page, '#title')).toEqual([]);
    expect(problems).toEqual([]);
  });
}
