// Playwright smoke (GAME-STANDARD §7) for the static game `index.html`, served with the games-hub CSP
// (tests/serve.mjs): load, start, 10 s with the keyboard, 10 s with touch, 0 console errors, 0 CSP violations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

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

const playing = (page: Page) => page.locator('#spellbar').isVisible();

test('GAME-STANDARD §4: one inline <script>, no inline handlers, no external URLs, no service worker', async ({}, info) => {
  test.skip(info.project.name !== 'desktop');
  const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
  expect(html).toContain('<html lang="el">');
  expect(html.match(/<script\b/gi)).toHaveLength(1);
  expect(html).not.toMatch(/<[a-z][^>]*\son[a-z]+\s*=/i);
  expect(html).not.toMatch(/\beval\s*\(|new\s+Function\s*\(/);
  expect(html).not.toMatch(/(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i);
  expect(html).not.toMatch(/serviceWorker|manifest/);
  expect(html).toContain('href="/static/fonts/comfortaa.css"');
});

test('keyboard: start, 10 s of play, pause, sound, 0 errors', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page);
  await page.goto('/');
  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('#title a[href="/"]')).toBeVisible();
  await page.locator('#start-btn').click();

  const moves = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  let played = false;
  const end = Date.now() + 10_000;
  for (let i = 0; Date.now() < end; i++) {
    if (!(await playing(page))) {
      await page.keyboard.press('Enter'); // story dialogs and the dragon flight
      await page.waitForTimeout(150);
      continue;
    }
    played = true;
    const key = moves[i % moves.length];
    await page.keyboard.down(key);
    await page.keyboard.press(String((i % 4) + 1));
    await page.waitForTimeout(300);
    await page.keyboard.up(key);
  }
  expect(played).toBe(true);

  for (const id of ['#pause-btn', '#snd', '#full-btn', '#home-btn']) await expect(page.locator(id)).toBeVisible();
  await expect(page.locator('#home-btn')).toHaveAttribute('href', '/');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#paused')).toBeVisible();
  await expect(page.locator('#paused a[href="/"]')).toBeVisible();
  await page.keyboard.press('KeyP');
  await expect(page.locator('#paused')).toBeHidden();
  await page.keyboard.press('KeyM');
  await expect(page.locator('#snd')).toHaveText('🔇');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#paused')).toBeVisible(); // auto-pause when focus is lost
  expect(problems).toEqual([]);
});

test('touch: joystick and spell buttons for 10 s, 0 errors', async ({ page }, info) => {
  test.skip(info.project.name !== 'tablet');
  const problems = await watch(page);
  await page.goto('/');
  await page.locator('#start-btn').tap();
  const cdp = await page.context().newCDPSession(page);
  let played = false;
  const end = Date.now() + 10_000;
  for (let round = 0; Date.now() < end; round++) {
    if (!(await playing(page))) {
      if (await page.locator('#dialog').isVisible()) await page.locator('#dialog').tap();
      else if (await page.locator('#flight-skip').isVisible()) await page.locator('#flight-skip').tap();
      else await page.waitForTimeout(150);
      continue;
    }
    played = true;
    await expect(page.locator('#joyzone')).toBeVisible();
    const d = { width: 110, height: 110 }; // the joystick base
    const cx = page.viewportSize()!.width * 0.22;
    const cy = page.viewportSize()!.height * 0.65;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
    for (let k = 0; k < 10; k++) {
      const a = (round * 10 + k) / 3;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: cx + Math.cos(a) * d.width * 0.4, y: cy + Math.sin(a) * d.height * 0.4, id: 1 }],
      });
      await page.waitForTimeout(80);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (await playing(page)) await page.locator(`.spell[data-k="${round % 4}"]`).tap();
  }
  expect(played).toBe(true);
  expect(problems).toEqual([]);
});
