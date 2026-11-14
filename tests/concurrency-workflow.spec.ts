// CI-NO-CONCURRENCY (owner decision 2026-11-15): CI and scan workflows carry no `concurrency` (workflow- or job-level),
// so a run is never left «pending» behind a cancelled run of the same group. Allowed here only because every job runs
// on its own GitHub-hosted VM (literal ubuntu-latest): two runs of one branch cannot share a port (the Playwright
// webServer). automerge.yml keeps its serializing group: it merges PRs and opens the release PR (a side effect).
// File check, no browser: it runs once, in the desktop project.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows');
const files = fs.readdirSync(dir).filter(f => /\.ya?ml$/.test(f));
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
const KEEP = ['automerge.yml'];

test.describe('Workflow concurrency (CI-NO-CONCURRENCY)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'file check, desktop project only');
  });

  test('CI and scan workflows have no concurrency key anywhere', () => {
    const checked = files.filter(f => !KEEP.includes(f));
    expect(checked).toContain('ci.yml');
    const bad = checked.filter(f => /^\s*concurrency\s*:/m.test(read(f)));
    expect(bad, 'workflows with a concurrency block').toEqual([]);
  });

  test('CI and scan workflows run only on GitHub-hosted ubuntu-latest (no shared runner without concurrency)', () => {
    for (const f of files.filter(f => !KEEP.includes(f))) {
      const wf = read(f);
      const runsOn = [...wf.matchAll(/^\s*runs-on:\s*(\S+)/gm)].map(m => m[1]);
      expect(runsOn.length, `${f}: no runs-on`).toBeGreaterThan(0);
      expect([...new Set(runsOn)], `${f}: runs-on`).toEqual(['ubuntu-latest']);
      expect(wf, f).not.toMatch(/self-hosted|vars\.RUNNER/);
    }
  });

  test('automerge.yml (if present) keeps group automerge without cancel-in-progress', () => {
    for (const f of KEEP.filter(f => files.includes(f))) {
      expect(read(f), f).toMatch(/^concurrency:\n {2}group: automerge\n {2}cancel-in-progress: false$/m);
    }
  });
});
