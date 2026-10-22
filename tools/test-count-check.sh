#!/usr/bin/env bash
# Test-count ratchet (TEST-STANDARD v1 §R-JS, Playwright-only fallback): index.html has one inline <script> and no logic
# module, so line coverage is not measurable; the floor in .coverage-floor is the number of Playwright tests instead
# (all projects, as `npx playwright test --list` reports them). Fails when fewer tests are listed than the floor.
# tools/coverage-floor-check.sh makes sure the floor itself only goes up.
set -euo pipefail
floor=$(grep -oE '^[0-9]+' .coverage-floor | head -1)
list=$(npx playwright test --list)
n=$(grep -oE 'Total: [0-9]+' <<<"$list" | grep -oE '[0-9]+' || true)
if [ -z "$n" ]; then echo "::error::test-count-check: no 'Total: N tests' line from playwright --list"; exit 2; fi
echo "test count: $n listed (floor $floor)"
if [ "$n" -lt "$floor" ]; then echo "::error::test count $n < floor $floor (.coverage-floor)"; exit 1; fi
