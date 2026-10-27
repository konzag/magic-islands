import { defineConfig } from '@playwright/test';

// PW_PORT: another port for the stand-in hub when 4173 is taken on this machine (default 4173, as in CI).
const port = Number(process.env.PW_PORT || 4173);

// Chromium projects: a desktop with keyboard, a landscape tablet with touch (GAME-STANDARD §3, §7), and for the
// joystick spec also a landscape phone and a portrait tablet.
export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.ts',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium' },
  webServer: {
    command: 'node tests/serve.mjs',
    env: { PORT: String(port) },
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    {
      name: 'tablet',
      use: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
    // Floating joystick (tests/joystick.spec.ts) also on a landscape phone and a portrait tablet; the flight walk
    // (tests/flight.spec.ts) also on the phone.
    {
      name: 'phone',
      testMatch: /(joystick|flight)\.spec\.ts/, // + the walk after the dragon flight (SHIP-ALL 2026-10-27)
      use: { viewport: { width: 780, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
    {
      name: 'tablet-portrait',
      testMatch: 'joystick.spec.ts',
      use: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
});
