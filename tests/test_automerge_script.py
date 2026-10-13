"""Option B auto-merge (.github/scripts/automerge.sh) with a fake `gh` on PATH: no network, records calls."""

import os
import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / ".github" / "scripts" / "automerge.sh"
SHA = "a" * 40
BASH = shutil.which("bash") or ""
pytestmark = pytest.mark.skipif(not BASH, reason="needs bash")

FAKE_GH = r"""#!/usr/bin/env bash
echo "gh $*" >> "$GH_LOG"
case "$*" in
  *"/compare/"*) [[ -z "${FAKE_COMPARE_FAIL:-}" ]] || exit 1; printf '%b' "${FAKE_COMPARE:-}";;
  *"/check-runs"*) printf '%s' "${FAKE_BAD_CHECKS:-}";;
  *"/status"*) echo "${FAKE_STATUS:-pending 0}";;
  *"pr list"*"--base staging"*) printf '%b' "${FAKE_STAGING_PRS:-}";;
  *"pr list"*"--base main"*) printf '%s' "${FAKE_RELEASE_PR:-}";;
  *"pr create"*) [[ -z "${FAKE_PR_CREATE_FAIL:-}" ]] || { echo "GraphQL: not permitted" >&2; exit 1; };;
  *) :;;
esac
"""


def _run(
    tmp_path,
    *,
    branch="feature/x",
    prs="",
    bad="",
    status="pending 0",
    release_pr="",
    create_fail="",
):
    bindir = tmp_path / "bin"
    bindir.mkdir()
    gh = bindir / "gh"
    gh.write_text(FAKE_GH)
    gh.chmod(0o755)
    log = tmp_path / "gh.log"
    log.touch()
    env = {
        **os.environ,
        "PATH": f"{bindir}{os.pathsep}{os.environ['PATH']}",
        "GH_LOG": str(log),
        "REPO": "konzag/magic-islands",
        "SHA": SHA,
        "BRANCH": branch,
        "FAKE_STAGING_PRS": prs,
        "FAKE_BAD_CHECKS": bad,
        "FAKE_STATUS": status,
        "FAKE_RELEASE_PR": release_pr,
        "FAKE_PR_CREATE_FAIL": create_fail,
    }
    r = subprocess.run([BASH, str(SCRIPT)], env=env, capture_output=True, text=True, check=False)  # noqa: S603
    assert r.returncode == 0, r.stderr
    return r.stdout, log.read_text()


def test_green_pr_into_staging_is_merged_and_staging_ci_dispatched(tmp_path):
    _, calls = _run(tmp_path, prs="12\\tkonzag\\tfeat: x\\n")
    assert f"pulls/12/merge -f merge_method=merge -f sha={SHA}" in calls
    assert "workflow run ci.yml" in calls and "--ref staging" in calls


def test_failing_check_blocks_merge(tmp_path):
    out, calls = _run(tmp_path, prs="12\\tkonzag\\tfeat: x\\n", bad="test")
    assert "/merge" not in calls and "workflow run" not in calls
    assert "not green" in out


def test_failing_commit_status_blocks_merge(tmp_path):
    _, calls = _run(tmp_path, prs="12\\tkonzag\\tfeat: x\\n", status="failure 1")
    assert "/merge" not in calls


def test_dependabot_major_is_left_for_review_minor_is_merged(tmp_path):
    prs = (
        "7\\tapp/dependabot\\tdeps: bump fastapi from 0.142.2 to 1.0.0\\n"
        "8\\tapp/dependabot\\tdeps: bump the python-deps group with 3 updates\\n"
    )
    out, calls = _run(tmp_path, prs=prs)
    assert "pulls/7/merge" not in calls and "left for review" in out
    assert "pulls/8/merge" in calls


def test_green_staging_opens_release_pr_but_never_merges_main(tmp_path):
    _, calls = _run(tmp_path, branch="staging")
    assert "pr create" in calls and "--base main --head staging" in calls
    assert "/merge" not in calls


def test_existing_release_pr_is_not_duplicated(tmp_path):
    _, calls = _run(tmp_path, branch="staging", release_pr="99")
    assert "pr create" not in calls


def test_merge_into_staging_also_opens_release_pr(tmp_path):
    # CI dispatched with GITHUB_TOKEN never fires workflow_run again, so the release PR must come right away.
    _, calls = _run(tmp_path, prs="12\tkonzag\tfeat: x\n")
    assert "pulls/12/merge" in calls
    assert "pr create" in calls and "--base main --head staging" in calls


def test_release_pr_refused_by_github_does_not_fail_the_run(tmp_path):
    # Real failure 2026-10-12: "GitHub Actions is not permitted to create or approve pull requests". The merge
    # into staging and the staging CI dispatch already happened; a red Auto-merge run would hide that.
    out, calls = _run(tmp_path, prs="12\tkonzag\tfeat: x\n", create_fail="1")  # _run asserts exit code 0
    assert "pulls/12/merge" in calls and "pr create" in calls
    assert "::warning::release PR not opened" in out


def test_release_pr_body_has_notes_grouped_by_conventional_commit_type(tmp_path, monkeypatch):
    monkeypatch.setenv(
        "FAKE_COMPARE",
        "feat(ui): new banner\nfix: lost writes\nMerge pull request #3 from x/y\nchore(deps): bump z\n",
    )
    _, calls = _run(tmp_path, branch="staging")
    assert "pr create" in calls
    assert "### Features\n- feat(ui): new banner" in calls
    assert "### Fixes\n- fix: lost writes" in calls
    assert "### Other\n- chore(deps): bump z" in calls
    assert "Merge pull request" not in calls


def test_open_release_pr_gets_its_notes_refreshed(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_COMPARE", "fix: x\n")
    out, calls = _run(tmp_path, branch="staging", release_pr="99")
    assert "pr create" not in calls
    assert "pr edit 99" in calls and "- fix: x" in calls
    assert "notes refreshed" in out


def test_compare_api_failure_still_opens_the_release_pr(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_COMPARE_FAIL", "1")
    _, calls = _run(tmp_path, branch="staging")
    assert "pr create" in calls and "Release notes unavailable" in calls
