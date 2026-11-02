// L1-38: the Security workflow keeps a blocking, pinned Trivy scan on the GitHub-hosted runner (public repo: never
// the homelab runner), with a read-only token. The gitleaks scan stays in ci.yml (required check, D21). File check,
// no browser: it runs once, in the desktop project.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const wf = fs
  .readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows', 'security.yml'), 'utf8')
  .replace(/\r\n/g, '\n');

test.describe('Security workflow (L1-38)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'file check, desktop project only');
  });

  test('named Security, runs on PRs and pushes to staging/main, read-only token', () => {
    expect(wf).toMatch(/^name: Security$/m);
    expect(wf).toMatch(/^ {2}pull_request:\n {4}branches: \[staging, main\]$/m);
    expect(wf).toMatch(/^ {2}push:\n {4}branches: \[staging, main\]$/m);
    expect(wf).toMatch(/^permissions:\n {2}contents: read\n\n/m);
  });

  test('every job on ubuntu-latest, every action pinned by SHA', () => {
    const runsOn = [...wf.matchAll(/^\s*runs-on:\s*(\S+)/gm)].map(m => m[1]);
    expect(runsOn.length).toBeGreaterThan(0);
    expect([...new Set(runsOn)]).toEqual(['ubuntu-latest']);
    expect(wf).not.toMatch(/self-hosted|vars\.RUNNER/);
    for (const [, ref] of wf.matchAll(/uses:\s*\S+@(\S+)/g)) expect(ref).toMatch(/^[0-9a-f]{40}$/);
  });

  test('trivy is checksum-verified and its gate fails the run', () => {
    expect(wf).toMatch(/TRIVY_VERSION: "\d+\.\d+\.\d+"/);
    expect(wf).toMatch(/TRIVY_SHA256: "[0-9a-f]{64}"/);
    expect(wf).toMatch(/sha256sum -c -/);
    expect(wf).toMatch(/trivy fs \. --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1/);
    expect(wf).not.toMatch(/continue-on-error/);
    // `gitleaks` is a required check from ci.yml: no job here may take that check name.
    expect(wf).not.toMatch(/^\s+(name: )?gitleaks:?$/m);
  });
});
