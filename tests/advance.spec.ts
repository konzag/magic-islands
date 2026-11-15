// advanceTo (tests/mi.ts) walks the story dialogs and skips the dragon flight with a check-then-click loop. The game
// ends a skipped flight on its NEXT frame (index.html: the skip only sets flight.t = dur; the frame loop then calls
// startIsland, which hides #flight-skip for good). So the loop can read state 'flight' + «skip visible» just before that
// frame and then click a button that is gone a few ms later and never comes back. An unbounded click() waits for it
// until the test timeout: CI on main, 2026-11-11 (run 42995104436, frametime.spec «materials», 120 s on the Γοργονία
// dialog). This file pins that race with a fake page (no browser, no timing): every click must be bounded, a click on
// a vanished target is retried from the top, and other errors still fail.
// No browser needed: it runs once, in the desktop project.
import { errors, expect, test, type Page } from '@playwright/test';
import { advanceTo } from './mi';

type Opts = { timeout?: number };
/** A stand-in for the game: the flight is skipped, its button is gone at the click, then one dialog, then play. */
function fakeGame(failWith?: Error) {
  const log: string[] = [];
  let state = 'flight', skipSeen = false, skipGone = false;
  const pendingFrame = () => { // what the game's next frame does after the button vanished
    if (skipGone && state === 'flight') state = 'dialog';
  };
  const locator = (sel: string) => ({
    isVisible: async () => {
      if (sel === '#flight-skip') { const v = state === 'flight' && !skipGone; if (v) skipSeen = true; return v; }
      return state === 'dialog';
    },
    click: (o: Opts = {}) => {
      log.push(`click ${sel} timeout=${o.timeout ?? 'none'}`);
      if (sel === '#dialog') { state = 'play'; return Promise.resolve(); }
      if (failWith) return Promise.reject(failWith);
      // the race: the button was visible at the check and is gone now, for good
      if (skipSeen) skipGone = true;
      if (o.timeout === undefined || o.timeout <= 0) return new Promise<void>(() => {}); // Playwright waits forever
      return new Promise<void>((_, rej) => setTimeout(() => rej(new errors.TimeoutError(`locator.click: Timeout ${o.timeout}ms exceeded.`)), Math.min(o.timeout, 20)));
    },
  });
  const page = {
    evaluate: async () => { const s = state; pendingFrame(); return s; },
    locator,
    waitForTimeout: (ms: number) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
  } as unknown as Page;
  return { page, log };
}
const within = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`advanceTo still waiting after ${ms} ms (unbounded click)`)), ms))]);

test.describe('advanceTo: the flight-skip race', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'no browser: once, in the desktop project');
  });

  test('a skip button that vanishes between the check and the click does not hang the loop', async () => {
    const { page, log } = fakeGame();
    await within(advanceTo(page, 'play'), 5000);
    expect(log[0]).toMatch(/^click #flight-skip timeout=\d+$/);
    expect(log.at(-1)).toMatch(/^click #dialog timeout=\d+$/);
    expect(log.every((l) => !l.endsWith('timeout=none')), 'every click is bounded: ' + log.join(', ')).toBe(true);
  });

  test('an error other than a click timeout still fails the test', async () => {
    const { page } = fakeGame(new Error('Target page, context or browser has been closed'));
    await expect(within(advanceTo(page, 'play'), 5000)).rejects.toThrow(/has been closed/);
  });
});
