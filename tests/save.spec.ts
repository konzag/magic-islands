// The saved-progress contract (README «Αποθήκευση», GAME-STANDARD §5), desktop project, through the opt-in test probe
// (`/?e2e` → window.__mi.G) and localStorage only:
// - key `magic-islands.progress.v1`, value exactly {v:1,island:N,keys:N}: FROZEN (renaming it wipes every child's progress);
// - a reload keeps it and «Συνέχεια: <νησί> ▶» resumes the furthest island with its keys;
// - a corrupt or out-of-range value is ignored without an error; progress never goes down;
// - a localStorage that throws never breaks the game; the final win clears the save.
import { expect, test } from '@playwright/test';
import { advanceTo, G, keyOnHero, SAVE_KEY, seedSave, state, stored, watch } from './mi';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'save contract: one project is enough'); });

test('save survives reload and «Συνέχεια» resumes the furthest island', async ({ page }) => {
  const problems = await watch(page);
  await seedSave(page, JSON.stringify({ v: 1, island: 2, keys: 2 }));
  await page.goto('/?e2e');
  await page.reload(); // the save is read again from the device, not from memory
  const btn = page.locator('#continue-btn');
  await expect(btn).toBeVisible();
  const label = await btn.innerText();
  await btn.click();
  await expect.poll(() => state(page)).toBe('dialog');
  expect(await G<number>(page, 'island')).toBe(2);
  expect(await G<number>(page, 'keys')).toBe(2);
  // the label names the island the game really starts (ISL[2].name, shown in the HUD), not a hard-coded string
  expect(label).toBe(`Συνέχεια: ${await page.locator('#isl-name').innerText()} ▶`);
  await advanceTo(page, 'play');
  expect(await G<number>(page, 'island')).toBe(2);
  expect(problems).toEqual([]);
});

test('save key and format are frozen', async ({ page }) => {
  const problems = await watch(page);
  await seedSave(page, null);
  await page.goto('/?e2e');
  const before = await page.evaluate(() => Object.keys(localStorage));
  await page.locator('#start-btn').click();
  await advanceTo(page, 'play');
  expect(await stored(page)).toBeNull(); // «Ξεκινάμε! ✨» alone writes nothing
  await keyOnHero(page); // island 0 key → the game saves island 1
  await expect.poll(() => stored(page), { timeout: 5000 }).not.toBeNull();
  const raw = (await stored(page))!;
  expect(JSON.parse(raw)).toStrictEqual({ v: 1, island: 1, keys: 1 });
  expect(raw).toBe('{"v":1,"island":1,"keys":1}');
  const added = (await page.evaluate(() => Object.keys(localStorage))).filter((k) => !before.includes(k));
  expect(added.filter((k) => !/sound|mute/i.test(k))).toEqual([SAVE_KEY]); // only the hub-shell sound key may also appear
  // and the next visit offers to continue on island 1
  await page.goto('/?e2e');
  await expect(page.locator('#continue-btn')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(() => state(page)).toBe('dialog');
  expect(await G<number>(page, 'island')).toBe(1);
  expect(await G<number>(page, 'keys')).toBe(1);
  expect(problems).toEqual([]);
});

for (const raw of ['{bad json', '{"island":0}', '{"island":99}', '{"island":1.5}', 'null', '"str"']) {
  test(`corrupt or out-of-range save never crashes and is not used: ${raw}`, async ({ page }) => {
    const problems = await watch(page);
    await seedSave(page, raw);
    await page.goto('/?e2e');
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#start-btn')).toBeVisible();
    await expect(page.locator('#continue-btn')).toBeHidden();
    await page.keyboard.press('Enter');
    await expect.poll(() => state(page)).toBe('dialog');
    expect(await G<number>(page, 'island')).toBe(0);
    expect(await G<number>(page, 'keys')).toBe(0);
    expect(problems).toEqual([]);
  });
}

test('progress never goes down', async ({ page }) => {
  const problems = await watch(page);
  await seedSave(page, JSON.stringify({ v: 1, island: 2, keys: 2 }));
  await page.goto('/?e2e');
  await page.locator('#start-btn').click(); // a new game from island 0 while island 2 is saved
  await advanceTo(page, 'play');
  expect(await G<number>(page, 'island')).toBe(0);
  await keyOnHero(page); // the island 0 key would save island 1
  await expect.poll(() => state(page), { timeout: 5000 }).toBe('dialog');
  expect(JSON.parse((await stored(page))!)).toStrictEqual({ v: 1, island: 2, keys: 2 });
  await page.goto('/?e2e');
  await expect(page.locator('#continue-btn')).toBeVisible();
  await page.locator('#continue-btn').click();
  await expect.poll(() => state(page)).toBe('dialog');
  expect(await G<number>(page, 'island')).toBe(2);
  expect(problems).toEqual([]);
});

for (const how of ['getItem/setItem/removeItem throw', 'window.localStorage itself throws'] as const) {
  test(`localStorage that throws does not break the game (${how})`, async ({ page }) => {
    const problems = await watch(page);
    await page.addInitScript((mode) => {
      const boom = () => { throw new DOMException('blocked by the test', 'SecurityError'); };
      if (mode.startsWith('getItem')) {
        Storage.prototype.getItem = boom; Storage.prototype.setItem = boom; Storage.prototype.removeItem = boom;
      } else {
        Object.defineProperty(window, 'localStorage', { configurable: true, get: boom });
      }
    }, how);
    await page.goto('/?e2e');
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#continue-btn')).toBeHidden();
    await page.keyboard.press('Enter');
    await advanceTo(page, 'play');
    const moves = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    const end = Date.now() + 5000;
    for (let i = 0; Date.now() < end; i++) {
      await page.keyboard.down(moves[i % 4]);
      await page.keyboard.press(String((i % 4) + 1));
      await page.waitForTimeout(250);
      await page.keyboard.up(moves[i % 4]);
    }
    expect(await state(page)).toBe('play');
    await keyOnHero(page); // the save path (loadSave + setItem) runs with the throwing storage
    await expect.poll(() => state(page), { timeout: 5000 }).toBe('dialog');
    await advanceTo(page, 'flight', false); // the game goes on to the next island
    expect(problems).toEqual([]);
  });
}

test('winning the last island clears the save', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = await watch(page);
  await seedSave(page, JSON.stringify({ v: 1, island: 3, keys: 3 }));
  await page.goto('/?e2e');
  await page.locator('#continue-btn').click();
  await advanceTo(page, 'play');
  expect(await G<number>(page, 'island')).toBe(3);
  await keyOnHero(page);
  await expect.poll(() => state(page), { timeout: 5000 }).toBe('dialog');
  expect(await stored(page)).toBeNull(); // README: «Μετά τη νίκη η πρόοδος σβήνει (νέο ξεκίνημα)»
  await advanceTo(page, 'win');
  await page.locator('#again-btn').click();
  await expect.poll(() => state(page)).toBe('title');
  await expect(page.locator('#continue-btn')).toBeHidden();
  await page.reload();
  await expect(page.locator('#continue-btn')).toBeHidden();
  expect(problems).toEqual([]);
});
