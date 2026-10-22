// Frame budget, before vs after (G1-GFX-2026-10-22). Not part of CI: runs only with PERF=1 (numbers depend on the
// machine, so they are compared on the same machine, old code vs new code):
//   PERF=1 npx playwright test tests/perf.spec.ts --project=tablet
// A test-only hook wraps requestAnimationFrame from an init script, so it measures the old and the new index.html
// the same way: script time per frame and frames per second, at 1180x820 and pixel ratio 2, normal and with the CPU
// slowed down 4x (a mid tablet).
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { G: any }; __perf: any };
const SAVE_KEY = 'magic-islands.progress.v1';
const state = (page: Page) => page.evaluate(() => window.__mi.G.state);
async function advanceTo(page: Page, want: string) {
  for (let i = 0; i < 300 && (await state(page)) !== want; i++) {
    if (await page.locator('#dialog').isVisible()) await page.locator('#dialog').click();
    else if (await page.locator('#flight-skip').isVisible()) await page.locator('#flight-skip').click();
    else await page.waitForTimeout(100);
  }
  expect(await state(page)).toBe(want);
}
async function measure(page: Page, ms: number, keys: string[]) {
  await page.evaluate(() => { const P = window.__perf; P.list = []; P.on = true; P.t0 = performance.now(); });
  const end = Date.now() + ms; let i = 0;
  while (Date.now() < end) { const k = keys[i++ % keys.length]; await page.keyboard.down(k); await page.waitForTimeout(450); await page.keyboard.up(k); }
  return page.evaluate(() => {
    const P = window.__perf; P.on = false;
    const l = P.list.slice().sort((a: number, b: number) => a - b), n = l.length, mean = l.reduce((a: number, b: number) => a + b, 0) / n;
    return { frames: n, fps: +(n / ((performance.now() - P.t0) / 1000)).toFixed(1), meanMs: +mean.toFixed(2), p95Ms: +l[Math.floor(n * .95)].toFixed(2) };
  });
}
async function island(page: Page, i: number) {
  await page.evaluate(([k, n]) => { if (n) localStorage.setItem(k as string, JSON.stringify({ v: 1, island: n, keys: n })); else localStorage.removeItem(k as string); }, [SAVE_KEY, i]);
  await page.goto('/?e2e');
  await page.locator(i ? '#continue-btn' : '#start-btn').click();
  await advanceTo(page, 'play');
  await page.evaluate(() => { for (const h of window.__mi.G.heroes) { h.hp = h.max = 1e9; } });
}

test('frame budget (informative)', async ({ page }, info) => {
  test.skip(!process.env.PERF || info.project.name !== 'tablet', 'only with PERF=1, tablet project');
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window), P = { on: false, list: [] as number[], t0: 0 };
    (window as any).__perf = P;
    window.requestAnimationFrame = (cb) => raf((ts) => { const t0 = performance.now(); try { cb(ts); } finally { if (P.on) P.list.push(performance.now() - t0); } });
  });
  await page.goto('/?e2e'); // the origin's storage is reachable only after a first page load
  const cdp = await page.context().newCDPSession(page);
  const loop = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  const out: Record<string, unknown> = {};
  for (const rate of [1, 4]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await island(page, 0); await cdp.send('Emulation.setCPUThrottlingRate', { rate }); await page.waitForTimeout(1500);
    out[`island1@${rate}x`] = await measure(page, 7000, loop);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await island(page, 1); await cdp.send('Emulation.setCPUThrottlingRate', { rate }); await page.waitForTimeout(1500);
    out[`island2@${rate}x`] = await measure(page, 7000, loop);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await island(page, 3);
    await page.evaluate(() => { const G = window.__mi.G; G.wave = 3; G.toSpawn = 0; G.enemies.length = 0; G.waitT = 0; });
    await expect.poll(() => state(page)).toBe('dialog'); await advanceTo(page, 'play');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate }); await page.waitForTimeout(1500);
    out[`boss4@${rate}x`] = await measure(page, 6000, ['Digit1', 'ArrowLeft', 'Digit2', 'ArrowRight']);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const line = JSON.stringify({ label: process.env.PERF_LABEL || 'run', ...out });
  console.log('PERF ' + line);
  if (process.env.PERF_OUT) fs.appendFileSync(process.env.PERF_OUT, line + '\n');
});
