// GAME-STANDARD §3a light + dark (port of games-template T4): the menus, cards and buttons follow the device
// setting (prefers-color-scheme), and the 🌓 switch on the title and pause cards goes device → light → dark →
// device. The choice has its own key magic-islands.theme.v1; the progress key magic-islands.progress.v1 and its
// value {v:1,island:N,keys:N} are frozen and never touched. The canvas world keeps its colours.
import { expect, test, type Page } from '@playwright/test';
import { SAVE_KEY, advanceTo, axeSerious, seedSave, stored, watch } from './mi';

const THEME_KEY = 'magic-islands.theme.v1';
const PROGRESS = '{"v":1,"island":2,"keys":2}';

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const savedTheme = (page: Page) => page.evaluate((k) => localStorage.getItem(k), THEME_KEY);
/** Background of a card and colour of its text: what a child sees of the shell. */
const look = (page: Page, card: string) =>
  page.locator(`${card} .card`).evaluate((el) => {
    const p = el.querySelector('p')!;
    return { bg: getComputedStyle(el).backgroundColor, ink: getComputedStyle(p).color };
  });

test('§3a the title and pause cards follow the device light/dark setting', async ({ page }) => {
  const problems = await watch(page);
  const seen: Record<string, unknown> = {};
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/?e2e');
    expect(await theme(page)).toBe(scheme);
    const title = await look(page, '#title');
    await page.locator('#start-btn').click();
    await advanceTo(page, 'play');
    await page.keyboard.press('KeyP');
    await expect(page.locator('#paused')).toBeVisible();
    seen[scheme] = { title, pause: await look(page, '#paused') };
  }
  expect(seen.light).not.toEqual(seen.dark);
  // Following the device writes nothing: no theme key, no progress.
  expect(await savedTheme(page)).toBeNull();
  expect(problems).toEqual([]);
});

test('§3a the 🌓 switch goes device -> light -> dark -> device, wins over the device and is remembered in its own key', async ({ page }, info) => {
  const problems = await watch(page);
  const tap = info.project.name === 'tablet';
  const press = async (sel: string) => { const b = page.locator(sel); await (tap ? b.tap() : b.click()); };
  await seedSave(page, PROGRESS);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/?e2e');
  const btn = page.locator('#theme-btn');
  const box = (await btn.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  await expect(btn).toHaveAttribute('aria-label', /συσκευή/);
  expect(await theme(page)).toBe('dark');
  for (const [want, label] of [['light', /φωτεινά/], ['dark', /σκοτεινά/], ['auto', /συσκευή/], ['light', /φωτεινά/]] as const) {
    await press('#theme-btn');
    await expect(btn).toHaveAttribute('aria-label', label);
    expect(await savedTheme(page)).toBe(want);
  }
  expect(await theme(page)).toBe('light');
  // Remembered: after a reload the device still says dark, the cards stay light.
  await page.reload();
  expect(await theme(page)).toBe('light');
  // The pause card has the same switch, in step with the title one.
  await page.locator('#continue-btn').click();
  await advanceTo(page, 'play');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#paused')).toBeVisible();
  await expect(page.locator('#theme-btn-pause')).toHaveAttribute('aria-label', /φωτεινά/);
  await press('#theme-btn-pause');
  expect(await savedTheme(page)).toBe('dark');
  expect(await theme(page)).toBe('dark');
  await press('#theme-btn-pause');
  expect(await savedTheme(page)).toBe('auto');
  // Back on «device»: a change of the device setting while playing is followed at once.
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => theme(page)).toBe('light');
  // The children's progress is exactly as it was: same key, same value.
  expect(await stored(page)).toBe(PROGRESS);
  expect(problems).toEqual([]);
});

test('§5 a bad theme value falls back to the device setting and never touches the progress', async ({ page }) => {
  const problems = await watch(page);
  await seedSave(page, PROGRESS);
  await page.addInitScript((k) => localStorage.setItem(k, '{"broken'), THEME_KEY);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/?e2e');
  expect(await theme(page)).toBe('light');
  await expect(page.locator('#theme-btn')).toHaveAttribute('aria-label', /συσκευή/);
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(PROGRESS);
  expect(problems).toEqual([]);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe serious/critical = 0 on the title screen with the switch (360 ${scheme})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one window is enough');
    const problems = await watch(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.emulateMedia({ colorScheme: scheme });
    await seedSave(page, PROGRESS);
    await page.goto('/?e2e');
    await page.waitForTimeout(400); // the card pop-in animation
    await expect(page.locator('#theme-btn')).toBeInViewport();
    expect(await axeSerious(page, '#title')).toEqual([]);
    expect(problems).toEqual([]);
  });
}
