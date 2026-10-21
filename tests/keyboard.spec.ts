// Keyboard only (README MI-23, GAME-STANDARD §3a): Tab moves the focus through the buttons of the title and pause
// screens with a visible ring, Enter / Space press the focused button exactly once, Enter advances the dialogs, and
// in play Tab stays the hero-switch key (the focus does not leave the game). Checked through the opt-in test probe
// (`/?e2e` → window.__mi.G).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

declare const window: Window & { __mi: { G: any } };

const state = (page: Page) => page.evaluate(() => window.__mi.G.state);

/** Press Tab (at most 8 times) until `target` has the focus; fail if it never gets it. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('Tab never reached the button');
}

async function expectVisibleFocus(target: Locator) {
  expect(await target.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
  expect(await target.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
}

/** Enter through the story dialogs and the dragon flight until the game is in play. */
async function enterToPlay(page: Page) {
  for (let i = 0; i < 300 && (await state(page)) !== 'play'; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }
  expect(await state(page)).toBe('play');
}

test.describe('keyboard only', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop'));

  test('MI-23 title: Tab reaches «Ξεκινάμε! ✨» with a visible ring, Enter starts, Enter advances, Tab in play switches the hero', async ({ page }) => {
    await page.goto('/?e2e');
    const start = page.getByRole('button', { name: 'Ξεκινάμε! ✨' });
    await tabTo(page, start);
    await expectVisibleFocus(start);

    await page.keyboard.press('Enter');
    await expect(page.locator('#dialog')).toBeVisible();
    expect(await state(page)).toBe('dialog');
    const first = await page.locator('#dlg-text').textContent();
    await page.waitForTimeout(320);
    await page.keyboard.press('Enter');
    await expect(page.locator('#dlg-text')).not.toHaveText(first ?? '');

    await enterToPlay(page);
    const before = await page.evaluate(() => window.__mi.G.active);
    const focusBefore = await page.evaluate(() => document.activeElement?.id ?? '');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => window.__mi.G.active)).not.toBe(before);
    expect(await page.evaluate(() => document.activeElement?.id ?? '')).toBe(focusBefore); // the focus stays put
  });

  test('MI-23 title: Space on the focused «Ξεκινάμε! ✨» starts the game once', async ({ page }) => {
    await page.goto('/?e2e');
    const start = page.locator('#start-btn');
    await tabTo(page, start);
    await page.evaluate(() => {
      (window as any).starts = 0;
      document.getElementById('start-btn')!.addEventListener('click', () => (window as any).starts++);
    });
    await page.keyboard.press('Space');
    await expect(page.locator('#dialog')).toBeVisible();
    expect(await page.evaluate(() => (window as any).starts)).toBe(1);
    expect(await state(page)).toBe('dialog');
  });

  test('MI-23 pause: Tab reaches «Συνέχεια ▶» with a visible ring, Enter resumes once', async ({ page }) => {
    await page.goto('/?e2e');
    await page.keyboard.press('Enter'); // nothing focused: Enter starts (unchanged)
    await enterToPlay(page);
    await page.keyboard.press('KeyP');
    await expect(page.locator('#paused')).toBeVisible();
    const resume = page.locator('#resume-btn');
    await tabTo(page, resume);
    await expectVisibleFocus(resume);
    await page.evaluate(() => {
      (window as any).resumes = 0;
      document.getElementById('resume-btn')!.addEventListener('click', () => (window as any).resumes++);
    });
    await page.keyboard.press('Enter');
    await expect(page.locator('#paused')).toBeHidden();
    expect(await state(page)).toBe('play');
    expect(await page.evaluate(() => (window as any).resumes)).toBe(1);
  });
});

// The focus ring and axe on the title screen at every GAME-STANDARD §3a size, light and dark.
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
      test(`MI-23 focus ring + axe on the title at ${size.name}, ${scheme}`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop');
        await page.goto('/?e2e');
        const start = page.locator('#start-btn');
        await tabTo(page, start);
        await expectVisibleFocus(start);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      });
    });
  }
}
