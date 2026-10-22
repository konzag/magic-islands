// GAME-STANDARD §3a 360 (port of the games-template T2 check): at 360 px the HUD (hero cards, island name, keys,
// 🔊 ⏸ ⛶ 🏠) stays inside the screen and nothing in it overlaps, while playing and on the pause screen, light + dark.
import { expect, test, type Page } from '@playwright/test';
import { advanceTo, seedSave, watch } from './mi';

const PARTS = ['#card0', '#card1', '.isl', '#keys', '#snd', '#pause-btn', '#full-btn', '#home-btn'];

async function hudFits(page: Page, w: number) {
  const boxes = await page.evaluate((sels) => sels.map((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { s, l: r.left, r: r.right, t: r.top, b: r.bottom };
  }), PARTS);
  for (const b of boxes) {
    expect(b.l, `${b.s} left`).toBeGreaterThanOrEqual(0);
    expect(b.r, `${b.s} right`).toBeLessThanOrEqual(w);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], c = boxes[j];
    const overlap = Math.min(a.r, c.r) - Math.max(a.l, c.l) > 1 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 1;
    expect(overlap, `${a.s} overlaps ${c.s}`).toBe(false);
  }
}

for (const scheme of ['light', 'dark'] as const) {
  for (const [w, h] of [[360, 740], [360, 780]] as const) {
    test(`§3a ${w}x${h} (${scheme}): the HUD fits while playing and paused`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'viewports are set per test here');
      const problems = await watch(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: w, height: h });
      await seedSave(page, '{"v":1,"island":3,"keys":3}'); // all keys earned: the widest key row
      await page.goto('/?e2e');
      await page.locator('#continue-btn').click();
      await advanceTo(page, 'play');
      await hudFits(page, w);
      await page.keyboard.press('KeyP');
      await expect(page.locator('#paused')).toBeVisible();
      await hudFits(page, w);
      await expect(page.locator('#theme-btn-pause')).toBeInViewport();
      expect(problems).toEqual([]);
    });
  }
}
