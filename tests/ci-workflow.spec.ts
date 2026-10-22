import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Owner decision D21: a ruleset requires the checks `test` and `gitleaks` on every PR into staging and main.
// Those checks exist on a PR only when CI runs on `pull_request`: with push-only CI a PR whose branch was pushed
// with GITHUB_TOKEN (Auto-merge, release PR) shows no checks at all. This file check fails when ci.yml loses the
// pull_request trigger for staging/main, runs push CI on feature branches again (a second run of every PR
// commit), renames or conditions a required job, or puts a `${{ }}` expression inside a run: script.
// No browser needed: it runs once, in the desktop project.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const REQUIRED_JOBS = ['test', 'gitleaks'];
const BRANCHES = ['main', 'staging'];

type Y = string | string[] | null | { [k: string]: Y };
type Line = { ind: number; text: string };

// Small YAML subset reader (mappings, flow/block lists of scalars, block scalars): enough for a workflow file.
// List items that are mappings (steps) are kept as their first line only.
const lines: Line[] = src
  .split(/\r?\n/)
  .filter(l => l.trim() !== '' && !l.trim().startsWith('#'))
  .map(l => ({ ind: l.length - l.trimStart().length, text: l.trim() }));

const scalar = (s: string) => s.replace(/\s+#.*$/, '').trim().replace(/^(['"])(.*)\1$/, '$2');

function parse(i: number, ind: number): [Y, number] {
  if (lines[i].text.startsWith('- ')) {
    const list: string[] = [];
    while (i < lines.length && lines[i].ind === ind && lines[i].text.startsWith('- ')) {
      list.push(scalar(lines[i].text.slice(2)));
      i++;
      while (i < lines.length && lines[i].ind > ind) i++;
    }
    return [list, i];
  }
  const map: { [k: string]: Y } = {};
  while (i < lines.length && lines[i].ind >= ind) {
    if (lines[i].ind > ind) { i++; continue; }
    const m = /^("[^"]+"|'[^']+'|[^:]+):\s*(.*)$/.exec(lines[i].text);
    if (!m) { i++; continue; }
    const key = scalar(m[1]);
    const rest = m[2].replace(/\s+#.*$/, '');
    i++;
    if (/^[|>][-+]?$/.test(rest)) {
      const body: string[] = [];
      while (i < lines.length && lines[i].ind > ind) body.push(lines[i++].text);
      map[key] = body.join('\n');
    } else if (rest === '') {
      if (i < lines.length && lines[i].ind > ind) [map[key], i] = parse(i, lines[i].ind);
      else map[key] = null;
    } else if (rest.startsWith('[')) {
      map[key] = rest.replace(/^\[|\]$/g, '').split(',').map(scalar).filter(Boolean);
    } else {
      map[key] = scalar(rest);
    }
  }
  return [map, i];
}

const doc = parse(0, 0)[0] as { [k: string]: any };

test.describe('CI workflow (ruleset D21: required checks on every PR)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'file check, desktop project only');
  });

  test('CI runs on every PR into staging/main, push only on staging/main, plus workflow_dispatch', () => {
    const on = doc.on;
    expect(on, 'ci.yml has no `on:` mapping').toBeTruthy();
    expect(Object.keys(on ?? {}).sort()).toEqual(['pull_request', 'push', 'workflow_dispatch']);
    // No paths/types filter: a PR the filter skips would wait forever for its required checks.
    expect(on.pull_request, '`pull_request:` needs `branches: [staging, main]`').toBeTruthy();
    expect(Object.keys(on.pull_request ?? {})).toEqual(['branches']);
    expect([...on.pull_request.branches].sort()).toEqual(BRANCHES);
    // Push limited to staging/main: a bare `push:` would run CI twice for every commit of a PR branch.
    expect(on.push, '`push:` needs `branches: [staging, main]`').toBeTruthy();
    expect(Object.keys(on.push ?? {})).toEqual(['branches']);
    expect([...on.push.branches].sort()).toEqual(BRANCHES);
  });

  test('workflow is named CI and the required jobs keep their check names', () => {
    expect(doc.name, 'Auto-merge / hub tooling look for the workflow named CI').toBe('CI');
    for (const id of REQUIRED_JOBS) {
      const job = doc.jobs?.[id];
      expect(job, `job "${id}" is required by the ruleset`).toBeTruthy();
      expect(job.name ?? id, `job "${id}" check name`).toBe(id);
      // A job skipped by `if:` reports success on a PR without running anything.
      expect(job.if, `job "${id}" must not be conditional`).toBeUndefined();
    }
    for (const [id, job] of Object.entries<any>(doc.jobs ?? {})) {
      if (!REQUIRED_JOBS.includes(id)) expect(REQUIRED_JOBS, `job "${id}" reuses a required check name`).not.toContain(job?.name);
    }
  });

  test('no ${{ }} expression inside a run: script (values go through env:)', () => {
    const raw = src.split(/\r?\n/);
    const bad: string[] = [];
    raw.forEach((l, n) => {
      const m = /^(\s*(?:- )?)run:\s*(.*)$/.exec(l);
      if (!m) return;
      const col = m[1].length; // column of `run`: a block script is indented deeper than that
      const body = [m[2]];
      for (let k = n + 1; k < raw.length && (raw[k].trim() === '' || raw[k].length - raw[k].trimStart().length > col); k++) body.push(raw[k]);
      if (body.join('\n').includes('${{')) bad.push(`line ${n + 1}: ${l.trim()}`);
    });
    expect(bad).toEqual([]);
  });
});
