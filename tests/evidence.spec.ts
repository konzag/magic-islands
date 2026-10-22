// Before/after screenshots of every screen (G1-GFX-2026-10-22). Not part of CI: runs only with EVIDENCE=<folder>:
//   EVIDENCE=../.claude/GAME/evidence/2026-10-22-gfx-magic-islands/before npx playwright test tests/evidence.spec.ts --project=desktop
// Four sizes (1280, 1180x820 touch, 820x1180, 360) x light + dark colour scheme (the game has one night look).
import { expect, test, type Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { G: any } };
const DIR = process.env.EVIDENCE || '';
const SAVE_KEY = 'magic-islands.progress.v1';
const SIZES = [
  { tag: '1280', viewport: { width: 1280, height: 800 }, touch: false },
  { tag: '1180x820', viewport: { width: 1180, height: 820 }, touch: true },
  { tag: '820x1180', viewport: { width: 820, height: 1180 }, touch: false },
  { tag: '360', viewport: { width: 360, height: 780 }, touch: false },
];
const state = (page: Page) => page.evaluate(() => window.__mi.G.state);
async function shot(page: Page, name: string) { await page.screenshot({ path: `${DIR}/${name}.jpg`, type: 'jpeg', quality: 80 }); }
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

test.describe('evidence screenshots', () => {
  test.skip(!DIR, 'only with EVIDENCE=<folder>');
  for (const sz of SIZES) for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${sz.tag} ${scheme}`, () => {
      test.use({ viewport: sz.viewport, hasTouch: sz.touch, isMobile: sz.touch, deviceScaleFactor: 1 });
      test(`all screens ${sz.tag} ${scheme}`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop');
        test.setTimeout(180_000);
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'no-preference' });
        const tag = `${sz.tag}-${scheme}`;
        await page.goto('/?e2e');
        await page.waitForTimeout(1500); await shot(page, `01-title-${tag}`);
        await island(page, 0);
        await page.waitForTimeout(600); await shot(page, `02-dialog-${tag}`);
        await advanceTo(page, 'play'); await page.waitForTimeout(3000); await shot(page, `03-play-island1-${tag}`);
        await toBoss(page); await expect.poll(() => state(page)).toBe('dialog');
        await page.waitForTimeout(600); await shot(page, `04-dialog-boss-${tag}`);
        await advanceTo(page, 'play'); await page.waitForTimeout(2200); await shot(page, `05-boss-island1-${tag}`);
        await page.keyboard.press('KeyP'); await page.waitForTimeout(400); await shot(page, `06-paused-${tag}`); await page.keyboard.press('KeyP');
        await keyOnHero(page); await expect.poll(() => state(page), { timeout: 5000 }).toBe('dialog');
        await advanceTo(page, 'flight', false); await page.waitForTimeout(3600); await shot(page, `07-flight-${tag}`);
        for (const [i, n] of [[1, 'island2'], [2, 'island3'], [3, 'island4']] as const) {
          await island(page, i); await advanceTo(page, 'play'); await page.waitForTimeout(3000); await shot(page, `08-play-${n}-${tag}`);
        }
        await toBoss(page); await expect.poll(() => state(page)).toBe('dialog');
        await advanceTo(page, 'play'); await page.waitForTimeout(2200); await shot(page, `09-boss-island4-${tag}`);
        await page.evaluate(() => { const G = window.__mi.G; for (const h of G.heroes) { h.hp = 0; h.down = true; } G.phase = 'lost'; G.loseT = 0.6; }); // what lose() sets
        await expect.poll(() => state(page), { timeout: 10_000 }).toBe('lose');
        await page.waitForTimeout(500); await shot(page, `10-lose-${tag}`);
        await island(page, 3); await advanceTo(page, 'play'); await keyOnHero(page); await expect.poll(() => state(page), { timeout: 5000 }).toBe('dialog');
        await advanceTo(page, 'win'); await page.waitForTimeout(2500); await shot(page, `11-win-${tag}`);
      });
    });
  }
});
