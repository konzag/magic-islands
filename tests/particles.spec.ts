// Particle effects (G1-MI-PARTICLES): one fixed pool drawn with code, CONFIG.particles at the top of the script.
// Checked through the opt-in test probe (`/?e2e` → window.__mi.fx = counters of the pool):
// - collect: picking up the key spawns glints, and the pool drains back to 0 afterwards;
// - every spell and the Ίριδα spawn an ability burst; the dive into Γοργονία spawns a splash;
// - the pool never holds more than CONFIG.particles.max;
// - prefers-reduced-motion = no particles at all;
// - 0 console errors / CSP violations at 1280, 1180x820, 820x1180 and 360 wide, light + dark colour scheme.
// Runs once per viewport inside the desktop project (the viewports are set here).
import { expect, test, type Page } from '@playwright/test';

type Fx = { on: boolean; max: number; active: number; peak: number; reused: number; spawned: Record<string, number> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { G: any; fx: Fx; burst: (x: number, y: number, c: string, n: number) => void } };

async function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return problems;
}

const state = (page: Page) => page.evaluate(() => window.__mi.G.state);
const fx = (page: Page) => page.evaluate(() => window.__mi.fx);

/** Advance dialogs (and, if allowed, the flight) until the game reaches `want`. */
async function advanceTo(page: Page, want: string, skipFlight = true) {
  for (let i = 0; i < 300 && (await state(page)) !== want; i++) {
    if (await page.locator('#dialog').isVisible()) await page.locator('#dialog').click();
    else if (skipFlight && (await page.locator('#flight-skip').isVisible())) await page.locator('#flight-skip').click();
    else await page.waitForTimeout(100);
  }
  expect(await state(page)).toBe(want);
}

async function toPlay(page: Page) {
  await page.goto('/?e2e');
  await page.locator('#start-btn').click();
  await advanceTo(page, 'play');
}

/** Skip the waves and the boss: the key lies right under the active hero, so the next frame picks it up. */
async function dropKeyOnHero(page: Page) {
  await page.evaluate(() => {
    const G = window.__mi.G;
    const h = G.heroes[G.active];
    G.enemies.length = 0;
    G.toSpawn = 0;
    G.phase = 'key';
    G.key = { T: 'key', x: h.x, y: h.y, t: 1 };
  });
}

/** Cast the four spells of each hero and the Ίριδα (keyboard 1-4, Q, Space). */
async function castAll(page: Page) {
  for (let hero = 0; hero < 2; hero++) {
    for (const k of ['1', '2', '3', '4']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(60);
    }
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(60);
  }
  await page.keyboard.press('Space');
}

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'viewports are set per test here');
});

test('collect: the key spawns glints, then the pool drains back to 0', async ({ page }) => {
  const problems = await watch(page);
  await toPlay(page);
  const before = await fx(page);
  expect(before.on).toBe(true);
  expect(before.max).toBe(250);
  expect(before.spawned.collect).toBe(0);

  await dropKeyOnHero(page);
  await expect.poll(async () => (await fx(page)).spawned.collect, { timeout: 3000 }).toBeGreaterThanOrEqual(24);
  expect(await page.evaluate(() => window.__mi.G.keys)).toBe(1);
  // Nothing else spawns after the key (no enemies, dialog next), so every particle dies and the pool is empty.
  await expect.poll(async () => (await fx(page)).active, { timeout: 5000 }).toBe(0);
  expect((await fx(page)).reused).toBe(0);
  expect(problems).toEqual([]);
});

test('ability: every spell and the Ίριδα spawn a burst', async ({ page }) => {
  const problems = await watch(page);
  await toPlay(page);
  await page.evaluate(() => (window.__mi.G.enemies.length = 0));
  await castAll(page);
  const f = await fx(page);
  expect(f.spawned.ability).toBeGreaterThanOrEqual(8 * 12);
  expect(f.spawned.iris).toBeGreaterThanOrEqual(28);
  expect(f.active).toBeLessThanOrEqual(f.max);
  expect(problems).toEqual([]);
});

test('water: Ζαφείρης splashes into the sea on the flight to Γοργονία', async ({ page }) => {
  const problems = await watch(page);
  await toPlay(page);
  await dropKeyOnHero(page);
  await advanceTo(page, 'flight', false);
  expect(await page.evaluate(() => window.__mi.G.flight.to)).toBe(1);
  await expect.poll(async () => (await fx(page)).spawned.splash, { timeout: 8000 }).toBeGreaterThanOrEqual(26);
  await advanceTo(page, 'dialog', false);
  expect(await page.evaluate(() => window.__mi.G.island)).toBe(1);
  expect((await fx(page)).active).toBe(0); // a new island starts with an empty pool
  expect(problems).toEqual([]);
});

test('cap: the pool never holds more than CONFIG.particles.max', async ({ page }) => {
  const problems = await watch(page);
  await toPlay(page);
  await page.evaluate(() => {
    for (let i = 0; i < 40; i++) window.__mi.burst(0, 0, '#ffffff', 20);
  });
  const f = await fx(page);
  expect(f.active).toBe(f.max);
  expect(f.peak).toBe(f.max);
  expect(f.reused).toBe(800 - f.max);
  // Informative only (CI machines differ): mean frame time with a full pool.
  const ms = await page.evaluate(
    () =>
      new Promise<number>((done) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => (++n < 30 ? requestAnimationFrame(tick) : done((performance.now() - t0) / n));
        requestAnimationFrame(tick);
      }),
  );
  test.info().annotations.push({ type: 'frame-ms (full pool, informative)', description: ms.toFixed(1) });
  expect(problems).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('prefers-reduced-motion: no particles on collect, spells or Ίριδα', async ({ page }) => {
    const problems = await watch(page);
    await toPlay(page);
    expect((await fx(page)).on).toBe(false);
    await castAll(page);
    await dropKeyOnHero(page);
    await expect.poll(() => page.evaluate(() => window.__mi.G.keys), { timeout: 3000 }).toBe(1);
    await page.evaluate(() => window.__mi.burst(0, 0, '#ffffff', 20));
    const f = await fx(page);
    expect(f.active).toBe(0);
    expect(f.peak).toBe(0);
    expect(Object.values(f.spawned).reduce((a, b) => a + b, 0)).toBe(0);
    expect(problems).toEqual([]);
  });
});

const SIZES = [
  { name: '1280', viewport: { width: 1280, height: 800 }, touch: false },
  { name: '1180x820', viewport: { width: 1180, height: 820 }, touch: true },
  { name: '820x1180', viewport: { width: 820, height: 1180 }, touch: true },
  { name: '360', viewport: { width: 360, height: 740 }, touch: true },
];
for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${size.name} ${scheme}`, () => {
      test.use({ viewport: size.viewport, colorScheme: scheme, hasTouch: size.touch, isMobile: size.touch });
      test(`effects at ${size.name}, ${scheme}: 0 console errors`, async ({ page }) => {
        const problems = await watch(page);
        await toPlay(page);
        await castAll(page);
        await dropKeyOnHero(page);
        await expect.poll(async () => (await fx(page)).spawned.collect, { timeout: 3000 }).toBeGreaterThanOrEqual(24); // even right after a full pool of spell bursts
        await page.waitForTimeout(1500);
        const f = await fx(page);
        expect(f.spawned.ability).toBeGreaterThan(0);
        expect(f.peak).toBeLessThanOrEqual(f.max);
        expect(problems).toEqual([]);
      });
    });
  }
}
