// GAME-STANDARD v1.3 §5a: the `hub` object at the root of the save. Only schema, completed, completedAt and
// milestones; games-hub reads it (badge «Ολοκλήρωσες»), the game never calls the hub for it. The save key stays
// `magic-islands.progress.v1` (the hub reads it as this game's legacy key). Desktop project, through `/?e2e`.
import { expect, test, type Page } from '@playwright/test';
import { advanceTo, G, keyOnHero, seedSave, state, stored, watch } from './mi';

type Hub = { schema: number; completed: boolean; completedAt: string | null; milestones: string[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { hubOf: (raw: unknown) => Hub } };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const saved = async (page: Page) => JSON.parse((await stored(page))!);
const fresh: Hub = { schema: 1, completed: false, completedAt: null, milestones: [] };

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'save contract: one project is enough'); });

test('hubOf keeps only the four fields and cleans a malformed object', async ({ page }) => {
  await page.goto('/?e2e');
  const out = await page.evaluate(() => [
    window.__mi.hubOf(undefined),
    window.__mi.hubOf('str'),
    window.__mi.hubOf({ schema: 9, completed: 'yes', completedAt: 'tomorrow', milestones: ['island-1', 'Κακό', 7, 'x'.repeat(33), 'island-1'], name: 'Νίκος', playMs: 5 }),
    window.__mi.hubOf({ schema: 1, completed: true, completedAt: '2026-01-02', milestones: ['island-2'] }),
    window.__mi.hubOf({ completed: true, completedAt: 'bad' }),
    window.__mi.hubOf({ milestones: Array.from({ length: 60 }, (_, i) => `m-${i}`) }),
  ]);
  expect(out[0]).toEqual(fresh);
  expect(out[1]).toEqual(fresh);
  expect(out[2]).toEqual({ ...fresh, milestones: ['island-1'] });
  expect(out[3]).toEqual({ schema: 1, completed: true, completedAt: '2026-01-02', milestones: ['island-2'] });
  expect(out[4].completed).toBe(true);
  expect(out[4].completedAt).toMatch(DATE);
  expect(out[5].milestones).toHaveLength(50);
  for (const h of out) expect(Object.keys(h).sort()).toEqual(['completed', 'completedAt', 'milestones', 'schema']);
});

test('the first island key writes the hub object with its milestone', async ({ page }) => {
  const problems = await watch(page);
  await seedSave(page, null);
  await page.goto('/?e2e');
  await page.locator('#start-btn').click();
  await advanceTo(page, 'play');
  await keyOnHero(page);
  await expect.poll(() => stored(page), { timeout: 5000 }).not.toBeNull();
  expect(await saved(page)).toStrictEqual({ v: 1, island: 1, keys: 1, hub: { ...fresh, milestones: ['island-1'] } });
  expect(problems).toEqual([]);
});

test('an old save without hub loads, and gets it (with the islands it already shows) at the next save', async ({ page }) => {
  const problems = await watch(page);
  await seedSave(page, JSON.stringify({ v: 1, island: 2, keys: 2 }));
  await page.goto('/?e2e');
  await expect(page.locator('#continue-btn')).toBeVisible();
  await page.locator('#continue-btn').click();
  await advanceTo(page, 'play');
  expect(await G<number>(page, 'island')).toBe(2);
  await keyOnHero(page);
  await expect.poll(async () => (await saved(page)).island, { timeout: 5000 }).toBe(3);
  expect((await saved(page)).hub).toStrictEqual({ ...fresh, milestones: ['island-1', 'island-2', 'island-3'] });
  expect(problems).toEqual([]);
});

test('the final win writes completed and the date, keeps the hub object, and offers no «Συνέχεια»', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = await watch(page);
  await seedSave(page, JSON.stringify({ v: 1, island: 3, keys: 3 }));
  await page.goto('/?e2e');
  await page.locator('#continue-btn').click();
  await advanceTo(page, 'play');
  await keyOnHero(page);
  await expect.poll(() => state(page), { timeout: 5000 }).toBe('dialog');
  const s = await saved(page);
  expect(Object.keys(s).sort()).toEqual(['hub', 'v']); // no island: the next game starts from the beginning
  expect(Object.keys(s.hub).sort()).toEqual(['completed', 'completedAt', 'milestones', 'schema']);
  expect(s.hub).toMatchObject({ schema: 1, completed: true, milestones: ['island-1', 'island-2', 'island-3', 'island-4'] });
  expect(s.hub.completedAt).toMatch(DATE);
  await advanceTo(page, 'win');
  await page.locator('#again-btn').click();
  await expect.poll(() => state(page)).toBe('title');
  await expect(page.locator('#continue-btn')).toBeHidden();
  await page.reload();
  await expect(page.locator('#continue-btn')).toBeHidden();
  expect(problems).toEqual([]);
});

test('completedAt never changes, and a new game after the win keeps the hub object', async ({ page }) => {
  const problems = await watch(page);
  const hub: Hub = { schema: 1, completed: true, completedAt: '2026-01-02', milestones: ['island-1', 'island-2', 'island-3', 'island-4'] };
  await seedSave(page, JSON.stringify({ v: 1, hub }));
  await page.goto('/?e2e');
  await expect(page.locator('#continue-btn')).toBeHidden();
  await page.locator('#start-btn').click();
  await advanceTo(page, 'play');
  expect(await G<number>(page, 'island')).toBe(0);
  await keyOnHero(page);
  await expect.poll(async () => (await saved(page)).island, { timeout: 5000 }).toBe(1);
  expect(await saved(page)).toStrictEqual({ v: 1, island: 1, keys: 1, hub });
  expect(problems).toEqual([]);
});

test('a malformed hub object in the save is cleaned at the next save', async ({ page }) => {
  const problems = await watch(page);
  const bad = { schema: 9, completed: 'yes', completedAt: 'tomorrow', milestones: ['Bad Id', 'x'.repeat(33), 3], name: 'Νίκος' };
  await seedSave(page, JSON.stringify({ v: 1, island: 1, keys: 1, hub: bad }));
  await page.goto('/?e2e');
  await page.locator('#continue-btn').click();
  await advanceTo(page, 'play');
  await keyOnHero(page);
  await expect.poll(async () => (await saved(page)).island, { timeout: 5000 }).toBe(2);
  expect((await saved(page)).hub).toStrictEqual({ ...fresh, milestones: ['island-1', 'island-2'] });
  expect(problems).toEqual([]);
});
