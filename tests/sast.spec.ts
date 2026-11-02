// L1-20 SAST (docs/TEST-MATRIX.md row «SAST/DAST»): CI keeps a Semgrep job that fails the run on any finding, with a
// pinned Semgrep and the GitHub-hosted runner (public repo: never the homelab runner). File check, no browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ci = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows', 'ci.yml'), 'utf8');

test('CI has a blocking, pinned Semgrep job on ubuntu-latest', ({}, info) => {
  test.skip(info.project.name !== 'desktop', 'file check, desktop project only');
  const job = /^ {2}semgrep:\n((?: {4}.*\n|\s*\n)+)/m.exec(ci.replace(/\r\n/g, '\n'))?.[1] ?? '';
  expect(job, 'ci.yml lost the semgrep job').not.toBe('');
  expect(job).toMatch(/runs-on: ubuntu-latest/);
  expect(job).toMatch(/pip install 'semgrep==\d+\.\d+\.\d+'/);
  expect(job).toMatch(/semgrep --config auto --error \./);
  expect(job).not.toMatch(/continue-on-error|\bif:/);
});
