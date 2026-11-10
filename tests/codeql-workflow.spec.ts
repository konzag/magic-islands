// NIGHT-2 item 3: the public repo has CodeQL next to Semgrep + Gitleaks (ci.yml). Text checks on the workflow file.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows', 'codeql.yml');

test.describe('codeql.yml', () => {
  test('exists, named CodeQL, runs on PRs and pushes to staging/main', () => {
    expect(existsSync(file), '.github/workflows/codeql.yml').toBe(true);
    const src = readFileSync(file, 'utf8');
    expect(src).toMatch(/^name: CodeQL$/m);
    expect(src).toMatch(/^ {2}pull_request:\n {4}branches: \[staging, main\]$/m);
    expect(src).toMatch(/^ {2}push:\n {4}branches: \[staging, main\]$/m);
  });

  test('read-only token at the top, security-events: write only in the job; GitHub-hosted runner', () => {
    const src = readFileSync(file, 'utf8');
    expect(src).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(src.match(/security-events: write/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/^ {4}permissions:\n {6}contents: read\n {6}security-events: write$/m);
    for (const m of src.matchAll(/runs-on: (.+)/g)) expect((m[1] ?? '').split('#')[0]?.trim()).toBe('ubuntu-latest');
  });

  test('javascript-typescript and actions, buildless; every action pinned by a full SHA', () => {
    const src = readFileSync(file, 'utf8');
    expect(src).toContain('language: [javascript-typescript, actions]');
    expect(src).toContain('build-mode: none');
    const uses = [...src.matchAll(/uses: (\S+)/g)].map((m) => m[1] ?? '');
    expect(uses.length).toBeGreaterThanOrEqual(3);
    for (const u of uses) expect(u, u).toMatch(/@[0-9a-f]{40}$/);
    expect(uses.some((u) => u.startsWith('github/codeql-action/init@'))).toBe(true);
    expect(uses.some((u) => u.startsWith('github/codeql-action/analyze@'))).toBe(true);
  });
});
