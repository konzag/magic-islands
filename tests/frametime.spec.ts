// GAMES-GRAPHICS §4 (games-template docs/specs/GAMES-GRAPHICS.md): the frame-time gate, in CI on every PR.
// Chromium, tablet project (1180x820, pixel ratio 2, touch), CPU slowed down 4x through CDP so the CI machine looks
// like a mid tablet; 10 s of play on Μονοκέρια per variant (heroes cannot lose, the waves come as usual).
// A test-only hook wraps requestAnimationFrame from an init script: the frame time is the main-thread time of one
// frame callback (update + drawing), the same measure as tests/perf.spec.ts.
// Two variants, interleaved in the same test (reference, candidate, candidate, reference), so both run on the same
// machine under the same load (segments alternate ABBA ABBA, so a slow drift of the machine cancels out):
//   reference = /?e2e&keeplook&gfx=base : the look before GAMES-GRAPHICS (tiers off)
//   candidate = /?e2e&keeplook          : the default «Κανονικά»
// `keeplook` (test hook, only with e2e) keeps the painted look on: without it a slow (throttled) machine switches it
// off by itself after a few seconds (CONFIG.slowFrameMs), and the gate would measure the plain art instead.
// Gates (thresholds in tests/frametime.json): candidate p95 <= reference p95 x (1 + maxGrowth); and candidate
// p95 <= p95MaxMs whenever the reference itself meets p95MaxMs on this machine. The numbers go to the log
// (FRAMETIME {...}) and to the test annotations; FRAMETIME_OUT=<file> appends them as one JSON line.
// CI runs it in its own step, alone on the machine (tag @frametime: the main step skips it with --grep-invert), so
// other tests running in parallel do not steal CPU from the measurement:
//   npx playwright test --grep @frametime --project=tablet
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { __mi: { G: any; paint: { on: boolean; auto: boolean } }; __ft: any };
const CFG = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'frametime.json'), 'utf8'));
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

/** One segment: load the variant at full speed, get to play, then slow the CPU down and play for `ms`. */
async function segment(page: Page, cdp: { send: (m: string, p?: object) => Promise<unknown> }, query: string, ms: number) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
  await page.goto('/?e2e&keeplook' + query);
  await page.locator('#start-btn').click();
  await advanceTo(page, 'play');
  await page.evaluate(() => { for (const h of window.__mi.G.heroes) { h.hp = h.max = 1e9; } });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CFG.cpuThrottle });
  await page.waitForTimeout(1500); // warm-up: sprites baked, caches filled
  await page.evaluate(() => { const F = window.__ft; F.list = []; F.gaps = []; F.on = true; });
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'], end = Date.now() + ms;
  for (let i = 0; Date.now() < end; i++) { const k = keys[i % 4]; await page.keyboard.down(k); await page.waitForTimeout(450); await page.keyboard.up(k); }
  const out = await page.evaluate(() => {
    const F = window.__ft; F.on = false;
    return { list: F.list.slice() as number[], gaps: F.gaps.slice() as number[], paintOn: window.__mi.paint.on, autoOff: window.__mi.paint.auto, state: window.__mi.G.state };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  expect(out.state, 'still playing after the segment').toBe('play');
  return out;
}
const pct = (l: number[], q: number) => { const s = l.slice().sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(2); };
const mean = (l: number[]) => +(l.reduce((a, b) => a + b, 0) / l.length).toFixed(2);

test('frame time with the CPU 4x slower: p95 within the GAMES-GRAPHICS budget @frametime', async ({ page }, info) => {
  test.skip(info.project.name !== 'tablet', 'tablet project only (the family tablet: 1180x820, pixel ratio 2)');
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window), F = { on: false, list: [] as number[], gaps: [] as number[], last: 0 };
    (window as unknown as { __ft: typeof F }).__ft = F;
    window.requestAnimationFrame = (cb) => raf((ts) => {
      const t0 = performance.now();
      try { cb(ts); } finally { if (F.on) { F.list.push(performance.now() - t0); if (F.last) F.gaps.push(t0 - F.last); } F.last = t0; }
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?e2e'); // the origin's storage is reachable only after a first page load
  const cdp = await page.context().newCDPSession(page);
  const seg = CFG.playMsPerVariant / CFG.segments;
  const ref: number[] = [], cand: number[] = [], refGaps: number[] = [], candGaps: number[] = [];
  const paint: Record<string, unknown>[] = [];
  const order = ['ref', 'cand', 'cand', 'ref'];
  expect(CFG.segments % 2, 'segments: an even number (ABBA blocks)').toBe(0);
  for (let i = 0; i < CFG.segments * 2; i++) { // segments per variant, alternating
    const v = order[i % 4], r = await segment(page, cdp, v === 'ref' ? '&gfx=base' : '', seg);
    (v === 'ref' ? ref : cand).push(...r.list); (v === 'ref' ? refGaps : candGaps).push(...r.gaps);
    paint.push({ v, frames: r.list.length, paintOn: r.paintOn, autoOff: r.autoOff });
  }
  const res = {
    throttle: CFG.cpuThrottle, viewport: '1180x820@2',
    reference: { frames: ref.length, meanMs: mean(ref), p50Ms: pct(ref, 0.5), p95Ms: pct(ref, 0.95), gapP95Ms: pct(refGaps, 0.95) },
    candidate: { frames: cand.length, meanMs: mean(cand), p50Ms: pct(cand, 0.5), p95Ms: pct(cand, 0.95), gapP95Ms: pct(candGaps, 0.95) },
    paint,
  };
  const limit = +(res.reference.p95Ms * (1 + CFG.maxGrowth)).toFixed(2);
  const absolute = res.reference.p95Ms <= CFG.p95MaxMs;
  const line = JSON.stringify({ label: process.env.FRAMETIME_LABEL || 'run', ...res, relativeLimitMs: limit, absoluteGate: absolute });
  console.log('FRAMETIME ' + line);
  info.annotations.push({ type: 'frametime', description: line });
  if (process.env.FRAMETIME_OUT) fs.appendFileSync(process.env.FRAMETIME_OUT, line + '\n');
  expect(errors).toEqual([]);
  expect(ref.length, 'enough reference frames').toBeGreaterThan(30);
  expect(cand.length, 'enough candidate frames').toBeGreaterThan(30);
  expect(res.candidate.p95Ms, `candidate p95 vs reference p95 ${res.reference.p95Ms} ms + ${CFG.maxGrowth * 100} %`).toBeLessThanOrEqual(limit);
  if (absolute) expect(res.candidate.p95Ms, `p95 <= ${CFG.p95MaxMs} ms («Κανονικά»)`).toBeLessThanOrEqual(CFG.p95MaxMs);
});
