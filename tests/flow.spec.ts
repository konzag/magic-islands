// Game flow (GAME-STANDARD §3, §6) through the opt-in test probe (`/?e2e` → window.__mi.G):
// - a loss never takes progress away (README MI-12: the save stays) and, per GAME-STANDARD §6, «Ξανά» restarts
//   at a safe point keeping what was unlocked (same island, same keys);
// - title → play → pause → resume → 🏠 by touch on the tablet, 0 console errors.
import { expect, test } from '@playwright/test';
import { advanceTo, forceLoss, G, state, stored, seedSave, watch } from './mi';

test.describe('losing (desktop)', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop'); });

  test('losing keeps the saved progress (README MI-12)', async ({ page }) => {
    const problems = await watch(page);
    await seedSave(page, JSON.stringify({ v: 1, island: 2, keys: 2 }));
    await page.goto('/?e2e');
    await page.locator('#continue-btn').click();
    await advanceTo(page, 'play');
    await forceLoss(page);
    await expect(page.locator('#lose')).toBeVisible();
    expect(JSON.parse((await stored(page))!)).toStrictEqual({ v: 1, island: 2, keys: 2 });
    await page.locator('#retry-btn').click();
    await expect.poll(() => state(page)).toBe('dialog');
    expect(JSON.parse((await stored(page))!)).toStrictEqual({ v: 1, island: 2, keys: 2 });
    await page.goto('/?e2e');
    await expect(page.locator('#continue-btn')).toBeVisible();
    expect(problems).toEqual([]);
  });

  // MAGIC-ISLANDS-T1, owner decision 11 (2026-10-22): «Ξανά από την αρχή 🐉» restarts THE SAME island, keys kept.
  test('losing restarts the same island and keeps the keys', async ({ page }) => {
    const problems = await watch(page);
    await seedSave(page, JSON.stringify({ v: 1, island: 2, keys: 2 }));
    await page.goto('/?e2e');
    await page.locator('#continue-btn').click();
    await advanceTo(page, 'play');
    expect(await G<number>(page, 'keys')).toBe(2);
    await forceLoss(page);
    await expect(page.locator('#lose')).not.toContainText('Μονοκέρια'); // the card no longer promises island 0
    await page.locator('#retry-btn').click();
    await expect.poll(() => state(page)).toBe('dialog');
    expect({ island: await G<number>(page, 'island'), keys: await G<number>(page, 'keys') }).toEqual({ island: 2, keys: 2 });
    await expect(page.locator('#isl-name')).toHaveText('Κρυσταλία');
    await expect(page.locator('#keys span.got')).toHaveCount(2);
    expect(JSON.parse((await stored(page))!)).toStrictEqual({ v: 1, island: 2, keys: 2 }); // save key + v1 format unchanged
    expect(problems).toEqual([]);
  });

  test('losing on the first island restarts Μονοκέρια with no keys', async ({ page }) => {
    const problems = await watch(page);
    await seedSave(page, null);
    await page.goto('/?e2e');
    await page.locator('#start-btn').click();
    await advanceTo(page, 'play');
    await forceLoss(page);
    await page.locator('#retry-btn').click();
    await expect.poll(() => state(page)).toBe('dialog');
    expect({ island: await G<number>(page, 'island'), keys: await G<number>(page, 'keys') }).toEqual({ island: 0, keys: 0 });
    await expect(page.locator('#isl-name')).toHaveText('Μονοκέρια');
    expect(await stored(page)).toBeNull(); // nothing was unlocked, so nothing is saved
    expect(problems).toEqual([]);
  });
});

test.describe('touch (tablet)', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'tablet'); });

  test('title -> play -> pause -> resume -> home button, by touch', async ({ page }) => {
    const problems = await watch(page);
    await seedSave(page, null);
    await page.goto('/?e2e');
    await page.locator('#start-btn').tap();
    for (let i = 0; i < 100 && (await state(page)) !== 'play'; i++) {
      if (await page.locator('#dialog').isVisible()) await page.locator('#dialog').tap();
      await page.waitForTimeout(320); // the dialog ignores taps within 280 ms of a new line
    }
    expect(await state(page)).toBe('play');
    await expect(page.locator('#joyzone')).toBeVisible();
    await page.locator('#pause-btn').tap();
    await expect(page.locator('#paused')).toBeVisible();
    expect(await state(page)).toBe('paused');
    await page.locator('#resume-btn').tap();
    await expect(page.locator('#paused')).toBeHidden();
    expect(await state(page)).toBe('play');
    await page.locator('#pause-btn').tap();
    const home = page.locator('#paused a[href="/"]');
    await expect(home).toBeVisible();
    await Promise.all([page.waitForURL((u) => u.pathname === '/' && !u.searchParams.has('e2e')), home.tap()]);
    await expect(page.locator('#title')).toBeVisible(); // the stand-in hub serves the game at /
    expect(problems).toEqual([]);
  });
});
