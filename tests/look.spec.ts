// G1-GFX-2026-10-22: the new look of «Τα Μαγικά Νησιά» (layered backgrounds, glows, cute enemies, storybook dialog,
// animated logo, fades), checked through the opt-in test probe (`/?e2e` → window.__mi.gfx):
// - every screen at 1280, 1180x820 (touch), 820x1180 and 360, light + dark colour scheme: 0 console errors / CSP
//   violations, axe 0 serious on the menus and the dialog;
// - the new layers exist, the island is copied 1:1, the far layers move with the camera (parallax);
// - prefers-reduced-motion: no ambient particles, no parallax, a still logo and a still portrait;
// - the dialog portrait is alive; the particle pool keeps its cap; an old save still loads with the same key and format.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type Gfx = { sprites: number; bg: boolean; sky: boolean; parallax: number; amb: number; fade: boolean; reduceMotion: boolean; ground1to1: boolean };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { G: any; gfx: Gfx; fx: { max: number } } };
const SAVE_KEY = 'magic-islands.progress.v1';
const state = (page: Page) => page.evaluate(() => window.__mi.G.state);
const gfx = (page: Page) => page.evaluate(() => window.__mi.gfx);

async function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)); });
  return problems;
}
async function axeSerious(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).include(where).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}
async function advanceTo(page: Page, want: string, skipFlight = true) {
  for (let i = 0; i < 300 && (await state(page)) !== want; i++) {
    if (await page.locator('#dialog').isVisible()) await page.locator('#dialog').click();
    else if (skipFlight && (await page.locator('#flight-skip').isVisible())) await page.locator('#flight-skip').click();
    else await page.waitForTimeout(100);
  }
  expect(await state(page)).toBe(want);
}
async function island(page: Page, i: number) {
  await page.evaluate(([k, n]) => { if (n) localStorage.setItem(k as string, JSON.stringify({ v: 1, island: n, keys: n })); else localStorage.removeItem(k as string); }, [SAVE_KEY, i]);
  await page.goto('/?e2e');
  await page.locator(i ? '#continue-btn' : '#start-btn').click();
  await expect.poll(() => state(page)).toBe('dialog');
}
const toBoss = (page: Page) => page.evaluate(() => { const G = window.__mi.G; G.wave = 3; G.toSpawn = 0; G.enemies.length = 0; G.waitT = 0; });
const keyOnHero = (page: Page) => page.evaluate(() => { const G = window.__mi.G, h = G.heroes[G.active]; G.enemies.length = 0; G.toSpawn = 0; G.phase = 'key'; G.key = { T: 'key', x: h.x, y: h.y, t: 1 }; });

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'viewports are set per test here'); });

const SIZES = [
  { tag: '1280', viewport: { width: 1280, height: 800 }, touch: false },
  { tag: '1180x820', viewport: { width: 1180, height: 820 }, touch: true },
  { tag: '820x1180', viewport: { width: 820, height: 1180 }, touch: false },
  { tag: '360', viewport: { width: 360, height: 780 }, touch: false },
];
for (const sz of SIZES) for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${sz.tag} ${scheme}`, () => {
    test.use({ viewport: sz.viewport, hasTouch: sz.touch, isMobile: sz.touch });
    test(`every screen: 0 console errors, axe 0 serious (${sz.tag} ${scheme})`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.emulateMedia({ colorScheme: scheme });
      const problems = await watch(page);
      const serious: string[] = [];
      const check = async (where: string, sel: string) => { await page.waitForTimeout(350); serious.push(...(await axeSerious(page, sel)).map((s) => `${where}: ${s}`)); };
      await page.goto('/?e2e'); await page.waitForTimeout(600); await check('title', '#title');
      await island(page, 0); await check('dialog', '#dialog');
      await advanceTo(page, 'play'); await page.waitForTimeout(1500);
      await toBoss(page); await expect.poll(() => state(page)).toBe('dialog'); await check('boss dialog', '#dialog');
      await advanceTo(page, 'play'); await page.waitForTimeout(1200);
      await page.keyboard.press('KeyP'); await check('paused', '#paused'); await page.keyboard.press('KeyP');
      await keyOnHero(page); await expect.poll(() => state(page), { timeout: 5000 }).toBe('dialog');
      await advanceTo(page, 'flight', false); await page.waitForTimeout(2500);
      for (const i of [1, 2, 3]) { await island(page, i); await advanceTo(page, 'play'); await page.waitForTimeout(1500); }
      await page.evaluate(() => { const G = window.__mi.G; for (const h of G.heroes) { h.hp = 0; h.down = true; } G.phase = 'lost'; G.loseT = 0.6; });
      await expect.poll(() => state(page), { timeout: 10_000 }).toBe('lose'); await check('lose', '#lose');
      await island(page, 3); await advanceTo(page, 'play'); await keyOnHero(page); await expect.poll(() => state(page), { timeout: 5000 }).toBe('dialog');
      await advanceTo(page, 'win'); await page.waitForTimeout(1500); await check('win', '#win');
      expect(problems).toEqual([]);
      expect(serious).toEqual([]);
    });
  });
}

test.describe('layers and motion (1180x820)', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('the new layers: sprites, cached backgrounds, the island copied 1:1, parallax with the camera', async ({ page }) => {
    const problems = await watch(page);
    await page.goto('/?e2e'); await page.waitForTimeout(500);
    expect((await gfx(page)).sky).toBe(true);
    await island(page, 0); await advanceTo(page, 'play');
    await page.evaluate(() => { for (const h of window.__mi.G.heroes) { h.hp = h.max = 1e9; } });
    const g = await gfx(page);
    expect(g.bg).toBe(true);
    expect(g.ground1to1).toBe(true);
    expect(g.sprites).toBeGreaterThan(0);
    expect(g.amb).toBeGreaterThan(0);
    const p0 = g.parallax;
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1200); await page.keyboard.up('ArrowRight');
    expect((await gfx(page)).parallax).not.toBe(p0);
    expect(problems).toEqual([]);
  });

  test('reduced motion: no ambient particles, no parallax, still logo and portrait', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const problems = await watch(page);
    await page.goto('/?e2e');
    expect(await page.locator('#title h1').evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
    await island(page, 0);
    const p1 = await page.locator('#portrait').evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.waitForTimeout(700);
    expect(await page.locator('#portrait').evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(p1);
    await advanceTo(page, 'play');
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1200); await page.keyboard.up('ArrowRight');
    const g = await gfx(page);
    expect(g.reduceMotion).toBe(true);
    expect(g.amb).toBe(0);
    expect(g.parallax).toBe(0);
    expect(problems).toEqual([]);
  });

  test('animated logo with the same accessible name; cards pop in', async ({ page }) => {
    await watch(page);
    await page.goto('/?e2e');
    await expect(page.getByRole('heading', { name: 'Τα Μαγικά Νησιά' })).toBeVisible();
    expect(await page.locator('#title h1').evaluate((e) => getComputedStyle(e).animationName)).toContain('logoShine');
    expect(await page.locator('#title .card').evaluate((e) => getComputedStyle(e).animationName)).toBe('cardIn');
  });

  test('the dialog portrait is alive (Ίριδα bobs and blinks)', async ({ page }) => {
    const problems = await watch(page);
    await page.goto('/?e2e');
    await island(page, 0);
    const frames = new Set<string>();
    for (let i = 0; i < 6; i++) { frames.add(await page.locator('#portrait').evaluate((c: HTMLCanvasElement) => c.toDataURL())); await page.waitForTimeout(250); }
    expect(frames.size).toBeGreaterThan(1);
    expect(problems).toEqual([]);
  });

  test('the particle pool keeps its cap; an old save loads and is written in the same format', async ({ page }) => {
    const problems = await watch(page);
    await page.goto('/?e2e');
    expect((await page.evaluate(() => window.__mi.fx)).max).toBe(250);
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, island: 2, keys: 2 })), SAVE_KEY);
    await page.goto('/?e2e');
    await expect(page.locator('#continue-btn')).toHaveText('Συνέχεια: Κρυσταλία ▶');
    await page.locator('#continue-btn').click();
    await advanceTo(page, 'play');
    expect(await page.evaluate(() => window.__mi.G.island)).toBe(2);
    await keyOnHero(page); await expect.poll(() => state(page), { timeout: 5000 }).toBe('dialog');
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY))!)).toEqual({ v: 1, island: 3, keys: 3 });
    expect(problems).toEqual([]);
  });
});
