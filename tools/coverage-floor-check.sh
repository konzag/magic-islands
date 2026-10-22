#!/usr/bin/env bash
# Coverage ratchet (TEST-STANDARD v1 §R): fail when a coverage floor is lower than on the base branch.
#
# CANONICAL COPY: konzag/template-app tools/coverage-floor-check.sh. Every other repo copies this file
# verbatim from there; change it here first (with tests/test_coverage_floor_check.py), then re-copy.
#
# Usage: tools/coverage-floor-check.sh [base-ref] [file ...]
#   base-ref  default: origin/$GITHUB_BASE_REF, else origin/staging if it exists, else origin/main.
#             On a push to staging/main/master (GITHUB_REF_NAME) the base is always HEAD^1.
#   file      default: .coverage-floor .coveragerc pyproject.toml pytest.ini setup.cfg package.json
# Floor forms: `fail_under = N` (.coveragerc [report], pyproject [tool.coverage.report], setup.cfg),
# `--cov-fail-under=N` (pytest.ini addopts), `--test-coverage-lines=N` (package.json), bare `N` in
# .coverage-floor. Decimals are compared numerically. Comment lines (# or ;) are ignored.
#
# Per file, working tree vs `git show <base>:<file>`:
#   lower                -> exit 1 `coverage floor lowered: <file> <old> -> <new>`, unless a commit in
#                           base..HEAD carries the trailer `Coverage-Floor-Lowered-By: owner` (owner only)
#   gone (line or file)  -> exit 1, unless another checked file now holds a floor >= the old one (moved)
#   equal/higher/new     -> ok
# Base ref that does not resolve -> exit 2 (fail closed). Checkout needs fetch-depth 2 or more.
set -euo pipefail
# Git Bash on Windows would rewrite `origin/x:file` into a path list and read no base floor (= fail open).
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'

floor_in() {  # $1 = file name, stdin = its content; prints the floor (empty if none)
  if [ "${1##*/}" = .coverage-floor ]; then
    grep -oE '^[0-9]+(\.[0-9]+)?' | head -1 || true
    return 0
  fi
  grep -vE '^[[:space:]]*[#;]' \
    | grep -oE '(fail_under[[:space:]]*=[[:space:]]*|--cov-fail-under[= ]|--test-coverage-lines[= ])[0-9]+(\.[0-9]+)?' \
    | grep -oE '[0-9]+(\.[0-9]+)?$' | head -1 || true
}

lt() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a + 0 < b + 0) }'; }

base=${1:-}
[ $# -gt 0 ] && shift
if [ -z "$base" ]; then
  if [ -n "${GITHUB_BASE_REF:-}" ]; then base="origin/$GITHUB_BASE_REF"
  elif git ls-remote --exit-code --heads origin staging >/dev/null 2>&1; then base=origin/staging
  else base=origin/main; fi
fi
case "${GITHUB_REF_NAME:-}" in staging|main|master) base=HEAD^1 ;; esac  # push to an integration branch
if [ $# -gt 0 ]; then files=("$@"); else
  files=(.coverage-floor .coveragerc pyproject.toml pytest.ini setup.cfg package.json); fi

case "$base" in origin/*) git fetch -q --depth=50 origin "${base#origin/}" 2>/dev/null || true ;; esac
if ! git rev-parse -q --verify "$base^{commit}" >/dev/null; then
  echo "::error::coverage-floor-check: base ref '$base' not found (fetch-depth too small?)"; exit 2
fi

# Messages first, grep after: `git log | grep -q` under pipefail fails on SIGPIPE when grep exits early.
msgs=$(git log --format=%B "$base..HEAD" 2>/dev/null || true; git log -1 --format=%B HEAD)
trailer=no
if grep -q '^Coverage-Floor-Lowered-By: owner$' <<<"$msgs"; then trailer=yes; fi

declare -A old new
best_new=""
for f in "${files[@]}"; do
  old[$f]=$(git show "$base:$f" 2>/dev/null | floor_in "$f" || true)
  new[$f]=""
  # shellcheck disable=SC2094  # $f is only a name to floor_in (picks the format); nothing writes to it
  [ -f "$f" ] && new[$f]=$(floor_in "$f" <"$f")              # working tree (== HEAD in CI)
  if [ -n "${new[$f]}" ] && { [ -z "$best_new" ] || lt "$best_new" "${new[$f]}"; }; then best_new=${new[$f]}; fi
done

rc=0
for f in "${files[@]}"; do
  o=${old[$f]} n=${new[$f]}
  [ -z "$o" ] && [ -z "$n" ] && continue
  echo "coverage floor: $f base ${o:-none} -> head ${n:-none}"
  [ -z "$o" ] && continue                                   # new floor: allowed
  if [ -z "$n" ]; then
    if [ -n "$best_new" ] && ! lt "$best_new" "$o"; then
      echo "coverage floor moved: $f $o -> another file ($best_new)"; continue; fi
    echo "::error::coverage floor removed: $f $o -> none"; rc=1; continue
  fi
  if lt "$n" "$o"; then
    if [ "$trailer" = yes ]; then echo "coverage floor lowered with owner trailer: $f $o -> $n"; continue; fi
    echo "::error::coverage floor lowered: $f $o -> $n (needs trailer 'Coverage-Floor-Lowered-By: owner')"; rc=1
  fi
done
exit "$rc"
