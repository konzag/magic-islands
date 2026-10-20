import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// README-PASS-02 / GAME-STANDARD §2a: the README is also the owner's manual-test guide. This check fails when one of
// its nine sections is missing or out of order, when the MI-nn test IDs are not unique and numbered, or when
// an issue form is missing. No browser needed: it runs once, in the desktop project.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECTIONS = [
  'Η ιστορία',
  'Χειρισμός',
  'Οθόνες και ροή',
  'Αποθήκευση',
  'Λίστα χειροκίνητων δοκιμών',
  'Τι άλλαξε στην τελευταία έκδοση',
  'Γνωστοί περιορισμοί',
  'Ασφαλής δοκιμή',
  'Αναφορά προβλήματος',
];
const PREFIX = 'MI';

test.describe('README (tester guide)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'file check, desktop project only');
  });

  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const headings = [...readme.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());

  test('the nine sections are there, in order', () => {
    for (const s of SECTIONS) expect(headings, `README.md lost "## ${s}"`).toContain(s);
    expect(headings.filter(h => SECTIONS.includes(h))).toEqual(SECTIONS);
  });

  test('test IDs are unique and numbered', () => {
    const ids = [...readme.matchAll(new RegExp(`^\\| (${PREFIX}-\\d{2}) \\|`, 'gm'))].map(m => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual(ids.map((_, i) => `${PREFIX}-${String(i + 1).padStart(2, '0')}`));
  });

  test('issue forms bug.yml and update.yml exist', () => {
    for (const f of ['bug.yml', 'update.yml']) {
      const p = join(root, '.github', 'ISSUE_TEMPLATE', f);
      expect(existsSync(p), f).toBe(true);
      expect(readFileSync(p, 'utf8')).toMatch(/^labels:/m);
    }
  });

  test('public repo: no hostnames or private IPs in the README', () => {
    expect(readme).not.toMatch(/\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})\b|\.ts\.net\b|\.homelab\.lan\b/);
  });
});
