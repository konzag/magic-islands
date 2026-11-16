// EL + EN in the game shell (owner 02/11, Block 7): the menus, buttons and their labels in Greek or English. The
// «EN» / «ΕΛ» button on the title and pause cards switches; the choice lives in the key `games.lang`, shared with the
// hub and every game on the same origin. Only 'en' counts, anything else (or no storage) is Greek. The story (dialogs,
// island and spell names, banners) stays Greek and is marked lang="el". The progress key and its value never change.
import { expect, test, type Page } from '@playwright/test';
import { advanceTo, axeSerious, seedSave, stored, watch } from './mi';

const LANG_KEY = 'games.lang';
const PROGRESS = '{"v":1,"island":2,"keys":2}';
const lang = (page: Page) => page.evaluate(() => document.documentElement.lang);
const savedLang = (page: Page) => page.evaluate((k) => localStorage.getItem(k), LANG_KEY);

test('the shell is Greek by default and nothing is written', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/?e2e');
  expect(await lang(page)).toBe('el');
  await expect(page.locator('#start-btn')).toHaveText('Ξεκινάμε! ✨');
  await expect(page.locator('#lang-btn')).toHaveText('EN');
  await expect(page.locator('#lang-btn')).toHaveAttribute('aria-label', 'EN English');
  await expect(page.locator('#theme-btn')).toHaveAttribute('aria-label', /Χρώματα/);
  expect(await savedLang(page)).toBeNull();
  expect(problems).toEqual([]);
});

test('«EN» switches the shell to English at once, is remembered, and «ΕΛ» switches back', async ({ page }, info) => {
  const problems = await watch(page);
  const tap = info.project.name === 'tablet';
  const press = async (sel: string) => { const b = page.locator(sel); await (tap ? b.tap() : b.click()); };
  await seedSave(page, PROGRESS);
  await page.goto('/?e2e');
  const box = (await page.locator('#lang-btn').boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  await press('#lang-btn');
  expect(await lang(page)).toBe('en');
  expect(await savedLang(page)).toBe('en');
  await expect(page.locator('#start-btn')).toHaveText("Let's go! ✨");
  await expect(page.locator('#continue-btn')).toHaveText(/^Continue: .+ ▶$/);
  await expect(page.locator('#title .home-link')).toHaveText('🏠 Back to the games');
  await expect(page.locator('#theme-btn')).toHaveAttribute('aria-label', /^Colours: /);
  await expect(page.locator('#lang-btn')).toHaveText('ΕΛ');
  await expect(page.locator('#lang-btn')).toHaveAttribute('aria-label', 'ΕΛ Ελληνικά');
  await expect(page.locator('#snd')).toHaveAttribute('aria-label', 'Sound');
  await expect(page.locator('#home-btn')).toHaveAttribute('aria-label', 'Back to the games');
  // the story stays Greek and says so
  await expect(page.locator('#dialog')).toHaveAttribute('lang', 'el');
  await expect(page.locator('#spellbar')).toHaveAttribute('lang', 'el');
  // remembered after a reload; the pause card is English too and has the same button
  await page.reload();
  expect(await lang(page)).toBe('en');
  await page.locator('#continue-btn').click();
  await advanceTo(page, 'play');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#paused')).toBeVisible();
  await expect(page.locator('#paused h2')).toHaveText('Pause');
  await expect(page.locator('#resume-btn')).toHaveText('Continue ▶');
  await press('#lang-btn-pause');
  expect(await savedLang(page)).toBe('el');
  await expect(page.locator('#paused h2')).toHaveText('Παύση');
  await expect(page.locator('#lang-btn')).toHaveText('EN');
  expect(await stored(page)).toBe(PROGRESS);
  expect(problems).toEqual([]);
});

test('a bad stored language and a storage that throws both give Greek, no errors', async ({ page }) => {
  const problems = await watch(page);
  await page.addInitScript((k) => localStorage.setItem(k, 'fr'), LANG_KEY);
  await page.goto('/?e2e');
  expect(await lang(page)).toBe('el');
  await expect(page.locator('#start-btn')).toHaveText('Ξεκινάμε! ✨');
  const p2 = await page.context().newPage();
  const problems2 = await watch(p2);
  await p2.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  await p2.goto('/?e2e');
  expect(await lang(p2)).toBe('el');
  await p2.locator('#lang-btn').click(); // works for this visit, just not remembered
  expect(await lang(p2)).toBe('en');
  expect(problems).toEqual([]);
  expect(problems2).toEqual([]);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe serious/critical = 0 on the English title screen (360 ${scheme})`, async ({ page }) => {
    const problems = await watch(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript((k) => localStorage.setItem(k, 'en'), LANG_KEY);
    await page.goto('/?e2e');
    await page.waitForTimeout(400); // the card pop-in animation
    await expect(page.locator('#lang-btn')).toBeInViewport();
    expect(await axeSerious(page, '#title')).toEqual([]);
    expect(problems).toEqual([]);
  });
}
