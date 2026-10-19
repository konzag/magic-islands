// Floating joystick (touch): appears where the thumb lands in the left ~45 %, analog 360°, release stops, works
// together with a spell button (two fingers), never covers the top HUD; plus axe on the play screen.
// Runs on the touch projects only (phone landscape 780x360, tablet portrait 820x1180, tablet landscape 1180x820).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type CDPSession, type Page } from '@playwright/test';

type Pt = { x: number; y: number; id: number };
// The game's state through its opt-in test probe (index.html, `/?e2e`), read in page.evaluate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { G: any; touchV: { x: number; y: number } } };

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

/** Start the game and advance the story until the heroes can move. */
async function toPlay(page: Page) {
  if ((await state(page)) === 'title') await page.locator('#start-btn').tap();
  for (let i = 0; i < 200 && (await state(page)) !== 'play'; i++) {
    if (await page.locator('#dialog').isVisible()) await page.locator('#dialog').tap();
    else if (await page.locator('#flight-skip').isVisible()) await page.locator('#flight-skip').tap();
    else await page.waitForTimeout(100);
  }
  expect(await state(page)).toBe('play');
}

/** Active hero back to the arena centre, healthy and without enemies, so walls and hits do not skew a move. */
async function resetHero(page: Page) {
  await page.evaluate(() => {
    const h = window.__mi.G.heroes[window.__mi.G.active];
    h.x = 0;
    h.y = 0;
    h.slow = 0;
    window.__mi.G.enemies.length = 0;
  });
}
const hero = (page: Page) => page.evaluate(() => ({ x: window.__mi.G.heroes[window.__mi.G.active].x, y: window.__mi.G.heroes[window.__mi.G.active].y }));

const touch = (cdp: CDPSession, type: string, touchPoints: Pt[]) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints });

test.beforeEach(({}, info) => {
  test.skip(info.project.name === 'desktop', 'touch only');
});

test('drag in 8 directions moves the hero that way; release stops it', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/?e2e');
  await toPlay(page);
  await expect(page.locator('#joyzone')).toBeVisible();
  const vp = page.viewportSize()!;
  const cdp = await page.context().newCDPSession(page);
  const start = { x: vp.width * 0.22, y: vp.height * 0.65, id: 1 };

  for (let i = 0; i < 8; i++) {
    await toPlay(page);
    await resetHero(page);
    const a = (i * Math.PI) / 4;
    await touch(cdp, 'touchStart', [start]);
    await expect(page.locator('#joy')).toHaveClass(/\bon\b/);
    for (let step = 1; step <= 4; step++) {
      await touch(cdp, 'touchMove', [
        { x: start.x + Math.cos(a) * 15 * step, y: start.y + Math.sin(a) * 15 * step, id: 1 },
      ]);
    }
    const before = await hero(page);
    await page.waitForTimeout(350);
    const after = await hero(page);
    const dx = after.x - before.x;
    const dy = (after.y - before.y) / 0.8; // the game squashes vertical speed by 0.8
    const len = Math.hypot(dx, dy);
    expect(len, `direction ${i}`).toBeGreaterThan(20);
    expect((dx * Math.cos(a) + dy * Math.sin(a)) / len, `direction ${i}`).toBeGreaterThan(0.95);

    await touch(cdp, 'touchEnd', []);
    await expect(page.locator('#joy')).not.toHaveClass(/\bon\b/);
    expect(await page.evaluate(() => [window.__mi.touchV.x, window.__mi.touchV.y])).toEqual([0, 0]);
    const stopped = await hero(page);
    await page.waitForTimeout(250);
    expect(await hero(page)).toEqual(stopped);
  }
  expect(problems).toEqual([]);
});

test('analog: a short drag is slower than a full one; the dead zone does nothing', async ({ page }) => {
  await page.goto('/?e2e');
  await toPlay(page);
  const vp = page.viewportSize()!;
  const cdp = await page.context().newCDPSession(page);
  const start = { x: vp.width * 0.22, y: vp.height * 0.65, id: 1 };
  const speedAt = async (px: number) => {
    await touch(cdp, 'touchStart', [start]);
    await touch(cdp, 'touchMove', [{ x: start.x + px, y: start.y, id: 1 }]);
    const v = await page.evaluate(() => Math.hypot(window.__mi.touchV.x, window.__mi.touchV.y));
    await touch(cdp, 'touchEnd', []);
    return v;
  };
  expect(await speedAt(4)).toBe(0); // 4 px < 12 % of 44 px
  const half = await speedAt(25);
  const full = await speedAt(80);
  expect(half).toBeGreaterThan(0.3);
  expect(half).toBeLessThan(0.7);
  expect(full).toBeCloseTo(1, 5);
});

test('two fingers: joystick and a spell button at the same time', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/?e2e');
  await toPlay(page);
  await resetHero(page);
  const vp = page.viewportSize()!;
  const cdp = await page.context().newCDPSession(page);
  const start = { x: vp.width * 0.22, y: vp.height * 0.65, id: 1 };
  const btn = (await page.locator('.spell[data-k="0"]').boundingBox())!;
  const spell = { x: btn.x + btn.width / 2, y: btn.y + btn.height / 2, id: 2 };
  await page.evaluate(() => {
    window.__mi.G.heroes[window.__mi.G.active].cds[0] = 0;
  });

  await touch(cdp, 'touchStart', [start]);
  await touch(cdp, 'touchMove', [{ x: start.x + 60, y: start.y, id: 1 }]);
  await touch(cdp, 'touchStart', [{ x: start.x + 60, y: start.y, id: 1 }, spell]);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__mi.G.heroes[window.__mi.G.active].cds[0])).toBeGreaterThan(0); // the spell was cast
  const v = await page.evaluate(() => [window.__mi.touchV.x, window.__mi.touchV.y]);
  expect(v[0]).toBeGreaterThan(0.9); // ...and the joystick still drives
  // Spell finger up, joystick finger stays (CDP: the list is the set of active points; touchEnd takes none).
  await touch(cdp, 'touchMove', [{ x: start.x + 62, y: start.y, id: 1 }]);
  expect((await page.evaluate(() => window.__mi.touchV.x)) > 0.9).toBe(true);
  await touch(cdp, 'touchEnd', []);
  expect(await page.evaluate(() => window.__mi.touchV.x)).toBe(0);
  expect(problems).toEqual([]);
});

test('layout: joystick stays clear of the HUD, ability buttons >= 56 px, swap works', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/?e2e');
  await toPlay(page);
  const vp = page.viewportSize()!;
  const cdp = await page.context().newCDPSession(page);
  // A thumb high up in the corner: the base is pushed below the HUD and inside the screen.
  await touch(cdp, 'touchStart', [{ x: 5, y: 5, id: 1 }]);
  const base = (await page.locator('#joy').boundingBox())!;
  const top = (await page.locator('.hud-top').boundingBox())!;
  expect(base.width).toBeCloseTo(114, -1); // 110 px + border
  expect(base.y).toBeGreaterThanOrEqual(top.y + top.height);
  expect(base.x).toBeGreaterThanOrEqual(0);
  expect(base.y + base.height).toBeLessThanOrEqual(vp.height);
  const knob = (await page.locator('#joy i').boundingBox())!;
  expect(knob.width).toBeCloseTo(48, 0);
  await touch(cdp, 'touchEnd', []);

  const zone = (await page.locator('#joyzone').boundingBox())!;
  expect(zone.width / vp.width).toBeCloseTo(0.45, 2);
  for (const b of await page.locator('#spellbar .spell').all()) {
    const box = (await b.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(56);
    expect(box.height).toBeGreaterThanOrEqual(56);
    expect(box.x).toBeGreaterThanOrEqual(zone.x + zone.width); // buttons never sit on the joystick zone
  }

  const active = await page.evaluate(() => window.__mi.G.active);
  await page.locator('#swap-btn').tap();
  expect(await page.evaluate(() => window.__mi.G.active)).toBe(1 - active);
  await resetHero(page);
  await touch(cdp, 'touchStart', [{ x: vp.width * 0.22, y: vp.height * 0.65, id: 1 }]);
  await touch(cdp, 'touchMove', [{ x: vp.width * 0.22 + 60, y: vp.height * 0.65, id: 1 }]);
  const before = await hero(page);
  await page.waitForTimeout(300);
  expect((await hero(page)).x - before.x).toBeGreaterThan(20); // the joystick drives the new active hero
  await touch(cdp, 'touchEnd', []);
  expect(problems).toEqual([]);
});

test('axe: title and play screen have no violations', async ({ page }) => {
  await page.goto('/?e2e');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await toPlay(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
