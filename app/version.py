"""Running version for `/version` (same contract as the other homelab apps).

The deployed checkout is a git clone updated by homelab-scripts auto-deploy, so the commit is read straight
from `.git` (no subprocess, works inside the sandboxed unit). `BUILD_SHA` / `BUILD_TIME` (ISO-8601) env vars
override it when a deploy step provides them. Version string = short SHA + deploy date, e.g. `a1b2c3d-20261012`.
Shape: `{version, commit, commit_short, built_at, started_at}`.
"""

import contextlib
import os
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
_SHA_RE = re.compile(r"[0-9a-f]{40}")


@dataclass(frozen=True)
class BuildInfo:
    commit: str  # full SHA, "" when unknown
    built_at: datetime | None  # when this commit was checked out (deploy time)
    started_at: datetime

    @property
    def short(self) -> str:
        return self.commit[:7] if self.commit else "dev"

    @property
    def version(self) -> str:
        return f"{self.short}-{self.built_at:%Y%m%d}" if self.built_at else self.short

    def as_dict(self) -> dict[str, str | None]:
        return {
            "version": self.version,
            "commit": self.commit or None,
            "commit_short": self.short,
            "built_at": self.built_at.isoformat() if self.built_at else None,
            "started_at": self.started_at.isoformat(),
        }


def _git_dir(repo: Path) -> Path:
    dot_git = repo / ".git"
    if dot_git.is_file():  # worktree / submodule: "gitdir: <path>"
        target = dot_git.read_text(encoding="utf-8").strip().removeprefix("gitdir: ")
        return (repo / target).resolve()
    return dot_git


def read_git_head(repo: Path = REPO) -> tuple[str, datetime | None]:
    """(sha, mtime of the ref that moved on the last checkout) or ("", None)."""
    try:
        git = _git_dir(repo)
        head_file = git / "HEAD"
        head = head_file.read_text(encoding="utf-8").strip()
        if _SHA_RE.fullmatch(head):  # detached HEAD
            return head, datetime.fromtimestamp(head_file.stat().st_mtime, UTC)
        ref = head.removeprefix("ref: ")
        common = git / "commondir"
        roots = [git]
        if common.is_file():
            roots.append((git / common.read_text(encoding="utf-8").strip()).resolve())
        for root in roots:
            ref_file = root / ref
            if ref_file.is_file():
                sha = ref_file.read_text(encoding="utf-8").strip()
                return sha, datetime.fromtimestamp(ref_file.stat().st_mtime, UTC)
            packed = root / "packed-refs"
            if packed.is_file():
                for line in packed.read_text(encoding="utf-8").splitlines():
                    parts = line.split()
                    if len(parts) == 2 and parts[1] == ref:
                        return parts[0], datetime.fromtimestamp(packed.stat().st_mtime, UTC)
    except OSError:
        pass
    return "", None


def load_build_info(repo: Path = REPO) -> BuildInfo:
    sha, built = read_git_head(repo)
    env_sha = os.getenv("BUILD_SHA", "").strip().lower()
    if _SHA_RE.fullmatch(env_sha) or re.fullmatch(r"[0-9a-f]{7,39}", env_sha):
        sha = env_sha
    env_time = os.getenv("BUILD_TIME", "").strip()
    if env_time:
        with contextlib.suppress(ValueError):  # malformed BUILD_TIME: keep the git checkout time
            built = datetime.fromisoformat(env_time)
    return BuildInfo(commit=sha, built_at=built, started_at=datetime.now(UTC))
