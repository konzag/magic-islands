import { defineConfig } from '@playwright/test';

// Chromium projects: a desktop with keyboard, a landscape tablet with touch (GAME-STANDARD §3, §7), and for the
// joystick spec also a landscape phone and a portrait tablet.
export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.ts',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium' },
  webServer: {
    command: 'node tests/serve.mjs',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    {
      name: 'tablet',
      use: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
    // Floating joystick (tests/joystick.spec.ts) also on a landscape phone and a portrait tablet.
    {
      name: 'phone',
      testMatch: 'joystick.spec.ts',
      use: { viewport: { width: 780, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
    {
      name: 'tablet-portrait',
      testMatch: 'joystick.spec.ts',
      use: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
});
