// L1-20 SEO (docs/TEST-MATRIX.md row «SEO»): the public game page carries the head a shared link or a search
// result needs (lang, title, one Greek meta description) and, like every games-hub page (policy: kids' pages are
// never indexed; the hub also sends X-Robots-Tag), asks robots not to index or follow it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ROBOTS_META = '<meta name="robots" content="noindex,nofollow">'; // same tag as games-hub app/services/page.py
const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');

test.describe('SEO head', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'head check, desktop project only');
  });

  test('lang="el", a non-empty title and one Greek meta description of 50-160 characters', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'el');
    expect((await page.title()).trim().length).toBeGreaterThan(0);
    const meta = page.locator('meta[name="description"]');
    await expect(meta).toHaveCount(1);
    const text = ((await meta.getAttribute('content')) ?? '').trim();
    expect(text.length, `description "${text}"`).toBeGreaterThanOrEqual(50);
    expect(text.length, `description "${text}"`).toBeLessThanOrEqual(160);
    expect(text, 'the description is Greek').toMatch(/[Ͱ-Ͽ]/);
    expect(text, 'no em dash in UI copy').not.toContain('—');
  });

  test('robots: noindex,nofollow, the exact tag of the hub pages, once', async ({ page }) => {
    expect(html.split(ROBOTS_META).length - 1).toBe(1);
    await page.goto('/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  });
});
