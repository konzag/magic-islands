from datetime import datetime
from pathlib import Path

import pytest

from app.version import BuildInfo, load_build_info, read_git_head

SHA = "0123456789abcdef0123456789abcdef01234567"


def _repo(tmp_path: Path) -> Path:
    git = tmp_path / ".git"
    (git / "refs" / "heads").mkdir(parents=True)
    return tmp_path


def test_branch_ref(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    (repo / ".git" / "HEAD").write_text("ref: refs/heads/main\n")
    (repo / ".git" / "refs" / "heads" / "main").write_text(SHA + "\n")
    sha, built = read_git_head(repo)
    assert sha == SHA and isinstance(built, datetime)


def test_detached_head(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    (repo / ".git" / "HEAD").write_text(SHA)
    assert read_git_head(repo)[0] == SHA


def test_packed_refs(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    (repo / ".git" / "HEAD").write_text("ref: refs/heads/staging\n")
    (repo / ".git" / "packed-refs").write_text(f"# pack-refs\n{SHA} refs/heads/staging\n")
    assert read_git_head(repo)[0] == SHA


def test_worktree_gitdir_file(tmp_path: Path) -> None:
    main = _repo(tmp_path / "main")
    (main / ".git" / "refs" / "heads" / "feat").write_text(SHA)
    wt_git = main / ".git" / "worktrees" / "wt"
    wt_git.mkdir(parents=True)
    (wt_git / "HEAD").write_text("ref: refs/heads/feat\n")
    (wt_git / "commondir").write_text("../..\n")
    wt = tmp_path / "wt"
    wt.mkdir()
    (wt / ".git").write_text(f"gitdir: {wt_git}\n")
    assert read_git_head(wt)[0] == SHA


def test_no_git(tmp_path: Path) -> None:
    assert read_git_head(tmp_path) == ("", None)


def test_unknown_ref(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    (repo / ".git" / "HEAD").write_text("ref: refs/heads/gone\n")
    assert read_git_head(repo) == ("", None)


def test_env_override(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BUILD_SHA", SHA.upper())
    monkeypatch.setenv("BUILD_TIME", "2026-10-13T10:00:00+00:00")
    info = load_build_info(tmp_path)
    d = info.as_dict()
    assert d["commit"] == SHA and d["commit_short"] == SHA[:7]
    assert d["version"] == f"{SHA[:7]}-20261013"
    assert d["built_at"] == "2026-10-13T10:00:00+00:00"


def test_bad_build_time_keeps_git_time(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BUILD_SHA", "not-a-sha")
    monkeypatch.setenv("BUILD_TIME", "yesterday")
    info = load_build_info(tmp_path)
    assert info.as_dict() == {
        "version": "dev",
        "commit": None,
        "commit_short": "dev",
        "built_at": None,
        "started_at": info.started_at.isoformat(),
    }


def test_buildinfo_version_without_built_at() -> None:
    info = BuildInfo(commit=SHA, built_at=None, started_at=datetime.now())
    assert info.version == SHA[:7]
