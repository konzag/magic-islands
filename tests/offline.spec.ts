// GAMES-OFFLINE (games-hub ADR-0008, owner decision 2026-11-16; GAME-STANDARD §4): offline play comes from the hub's
// one service worker, which precaches every file the hub serves from this repo and adds the install manifest itself.
// So a game made from this template never registers a service worker of its own (it would take the scope /<slug>/
// away from the hub's worker) and never links its own manifest; and every file it loads is a same-origin file of the
// repo (nothing the hub could not precache). File check, no browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['.git', '.github', 'node_modules', 'test-results', 'playwright-report', 'tests', 'tools', 'docs']);
const REGISTERS = /serviceWorker\s*\.\s*register|navigator\s*\.\s*serviceWorker/;
const OWN_MANIFEST = /<link\b[^>]*\brel\s*=\s*["']?manifest\b/i;

function served(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return [];
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return served(p);
    return /\.(html?|js)$/i.test(e.name) ? [p] : [];
  });
}

test('no own service worker, no own manifest: the hub worker serves the game offline', () => {
  const files = served(ROOT);
  expect(files.map((f) => path.relative(ROOT, f))).toContain('index.html');
  const hits = files.flatMap((f) => {
    const text = fs.readFileSync(f, 'utf8');
    return [
      ...(REGISTERS.test(text) ? [`${path.relative(ROOT, f)}: registers a service worker`] : []),
      ...(OWN_MANIFEST.test(text) ? [`${path.relative(ROOT, f)}: links its own manifest`] : []),
    ];
  });
  expect(hits).toEqual([]);
  // The rules themselves catch what they are for.
  expect(REGISTERS.test("navigator.serviceWorker.register('/sw.js')")).toBe(true);
  expect(OWN_MANIFEST.test('<link rel="manifest" href="m.json">')).toBe(true);
});

test('every file the page loads is a same-origin file (precacheable by the hub)', async ({ page, baseURL }) => {
  const others: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.origin !== new URL(baseURL ?? '').origin && url.protocol !== 'data:') others.push(r.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(others).toEqual([]);
});
