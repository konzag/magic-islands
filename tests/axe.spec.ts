// axe (WCAG 2.1 A/AA) 0 serious / critical on the pause, win and lose screens, one test per screen, light + dark,
// 1280 and 360 wide (GAME-STANDARD §3a, §7). look.spec.ts walks every screen in one long test; these name the screen
// that broke. Reached through the opt-in test probe (`/?e2e` → window.__mi.G) and a seeded save.
import { expect, test, type Page } from '@playwright/test';
import { advanceTo, axeSerious, forceLoss, keyOnHero, seedSave, state, watch } from './mi';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'viewports are set per test here'); });

const SCREENS: Record<string, { sel: string; island: number; reach: (page: Page) => Promise<void> }> = {
  pause: { sel: '#paused', island: 0, reach: async (page) => { await page.keyboard.press('KeyP'); await expect(page.locator('#paused')).toBeVisible(); } },
  lose: { sel: '#lose', island: 1, reach: async (page) => { await forceLoss(page); await expect(page.locator('#lose')).toBeVisible(); } },
  win: {
    sel: '#win', island: 3,
    reach: async (page) => { await keyOnHero(page); await expect.poll(() => state(page), { timeout: 5000 }).toBe('dialog'); await advanceTo(page, 'win'); },
  },
};

for (const sz of [{ tag: '1280', viewport: { width: 1280, height: 800 } }, { tag: '360', viewport: { width: 360, height: 780 } }]) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${sz.tag} ${scheme}`, () => {
      test.use({ viewport: sz.viewport });
      for (const [name, s] of Object.entries(SCREENS)) {
        test(`axe serious/critical = 0 on the ${name} screen (${sz.tag} ${scheme})`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: scheme });
          const problems = await watch(page);
          await seedSave(page, s.island ? JSON.stringify({ v: 1, island: s.island, keys: s.island }) : null);
          await page.goto('/?e2e');
          await page.locator(s.island ? '#continue-btn' : '#start-btn').click();
          await advanceTo(page, 'play');
          await s.reach(page);
          await page.waitForTimeout(400); // the card pop-in animation
          expect(await axeSerious(page, s.sel)).toEqual([]);
          expect(problems).toEqual([]);
        });
      }
    });
  }
}
