// RELEASE-PR-APPROVAL (owner option (a), 2026-11-16): .github/scripts/automerge.sh run with a fake `gh` on PATH (no
// network; every call is recorded). After a merge into staging it must dispatch CI + Security + CodeQL on staging:
// a merge made with GITHUB_TOKEN starts no push run, and since the workflows no longer run on PRs into main, these
// dispatched runs are the only CI/Security/CodeQL results the staging commit (= the release PR head) gets.
// No browser needed: it runs once, in the desktop project. Needs bash (GitHub runner; Git Bash on Windows).
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(root, '.github', 'scripts', 'automerge.sh');
const SHA = 'a'.repeat(40);
const REPO = 'konzag/magic-islands';
const DISPATCHED = ['ci.yml', 'security.yml', 'codeql.yml'];

const FAKE_GH = `#!/usr/bin/env bash
echo "gh $*" >> "$GH_LOG"
case "$*" in
  *"/compare/"*) printf '%b' "\${FAKE_COMPARE:-}";;
  *"/check-runs"*) printf '%s' "\${FAKE_BAD_CHECKS:-}";;
  *"/status"*) echo "\${FAKE_STATUS:-pending 0}";;
  *"pr list"*"--base staging"*) printf '%b' "\${FAKE_STAGING_PRS:-}";;
  *"pr list"*"--base main"*) printf '%s' "\${FAKE_RELEASE_PR:-}";;
  *"workflow run"*)
    [[ -z "\${FAKE_DISPATCH_FAIL:-}" || "$*" != *"workflow run $FAKE_DISPATCH_FAIL "* ]] \\
      || { echo "HTTP 403: Resource not accessible by integration" >&2; exit 1; };;
  *) :;;
esac
`;

type Opts = { branch?: string; prs?: string; bad?: string; dispatchFail?: string };

function run({ branch = 'feature/x', prs = '', bad = '', dispatchFail = '' }: Opts) {
  const dir = mkdtempSync(join(tmpdir(), 'mi-automerge-'));
  const gh = join(dir, 'gh');
  writeFileSync(gh, FAKE_GH.replace(/\r\n/g, '\n'));
  chmodSync(gh, 0o755);
  const log = join(dir, 'gh.log');
  writeFileSync(log, '');
  const r = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH ?? ''}`,
      GH_LOG: log.replace(/\\/g, '/'),
      REPO,
      SHA,
      BRANCH: branch,
      FAKE_STAGING_PRS: prs,
      FAKE_BAD_CHECKS: bad,
      FAKE_DISPATCH_FAIL: dispatchFail,
    },
  });
  const calls = readFileSync(log, 'utf8');
  const dispatches = calls.split(/\r?\n/).filter(l => l.startsWith('gh workflow run '));
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '', calls, dispatches };
}

test.describe('automerge.sh (dispatch on staging after a merge)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'script check, desktop project only');
  });

  test('a green PR into staging is merged, then CI, Security and CodeQL are dispatched on staging', () => {
    const r = run({ prs: '12\\tkonzag\\tfeat: x\\n' });
    expect(r.code, r.err).toBe(0);
    expect(r.calls).toContain(`pulls/12/merge -f merge_method=merge -f sha=${SHA}`);
    expect(r.dispatches).toEqual(DISPATCHED.map(wf => `gh workflow run ${wf} -R ${REPO} --ref staging`));
    for (const wf of DISPATCHED) expect(r.out).toContain(`dispatched ${wf} on staging`);
    expect(r.calls).toContain('pr create'); // the release PR opens right away
  });

  test('nothing merged, nothing dispatched (green staging push; red PR check)', () => {
    const staging = run({ branch: 'staging' });
    expect(staging.code, staging.err).toBe(0);
    expect(staging.calls).toContain('pr create');
    expect(staging.dispatches).toEqual([]);
    const red = run({ prs: '12\\tkonzag\\tfeat: x\\n', bad: 'test' });
    expect(red.code, red.err).toBe(0);
    expect(red.calls).not.toContain('/merge');
    expect(red.dispatches).toEqual([]);
  });

  for (const failing of DISPATCHED) {
    test(`a failed dispatch of ${failing} fails the job after trying all three and opening the release PR`, () => {
      const r = run({ prs: '12\\tkonzag\\tfeat: x\\n', dispatchFail: failing });
      expect(r.code).not.toBe(0);
      expect(r.dispatches).toHaveLength(3);
      expect(r.out).toContain(`::error::dispatch of ${failing} on staging failed`);
      expect(r.calls).toContain('pr create');
    });
  }

  test('the Auto-merge job may dispatch workflows, and each dispatched workflow accepts workflow_dispatch', () => {
    const wf = readFileSync(join(root, '.github', 'workflows', 'automerge.yml'), 'utf8');
    expect(wf).toMatch(/^ {2}actions: write\b/m);
    for (const name of DISPATCHED) {
      const src = readFileSync(join(root, '.github', 'workflows', name), 'utf8');
      expect(src, name).toMatch(/^ {2}workflow_dispatch:/m);
    }
  });
});
