#!/usr/bin/env bash
# Option B "one-touch delivery" without branch protection (GitHub Free, private repo).
# Called by .github/workflows/automerge.yml after a successful CI run, with:
#   REPO=owner/name  SHA=<CI head sha>  BRANCH=<CI head branch>  GH_TOKEN=<workflow token>
#
# 1. Open PRs into `staging` whose head is SHA are merged through the API, but only when EVERY check run
#    and commit status on SHA is green (dependabot major bumps are left for a human). After a merge, CI is
#    dispatched on `staging` (merges made with GITHUB_TOKEN do not trigger push workflows), so the deployed
#    staging commit gets its own CI status for the infra deploy gate.
# 2. After a merge into staging (or green CI on a staging push), make sure a "staging -> main" release PR exists. Merging it is the
#    owner's one click (GO); nothing here ever merges into main. Its body carries release notes grouped from the
#    conventional-commit subjects in main...staging, refreshed whenever staging moves.
set -euo pipefail

all_green() {
  local sha=$1 bad state total
  # check runs (all workflows/jobs): completed and success/skipped/neutral
  bad=$(gh api "repos/$REPO/commits/$sha/check-runs?per_page=100" --paginate \
    --jq '.check_runs[] | select(.status != "completed" or (.conclusion | IN("success","skipped","neutral") | not)) | .name')
  if [[ -n "$bad" ]]; then
    echo "not green on ${sha:0:7}: ${bad//$'\n'/, }"
    return 1
  fi
  # commit statuses (e.g. app-gate posted by infra): success, or none at all
  read -r state total < <(gh api "repos/$REPO/commits/$sha/status" --jq '"\(.state) \(.total_count)"')
  if [[ "$total" != "0" && "$state" != "success" ]]; then
    echo "commit status on ${sha:0:7} is $state"
    return 1
  fi
}

is_major_bump() {  # "bump foo from 1.2.3 to 2.0.0" -> major changed
  local title=$1 from to
  [[ $title =~ from[[:space:]]+v?([0-9]+)[^[:space:]]*[[:space:]]+to[[:space:]]+v?([0-9]+) ]] || return 1
  from=${BASH_REMATCH[1]}
  to=${BASH_REMATCH[2]}
  [[ "$from" != "$to" ]]
}

release_notes() {  # changelog section from the conventional-commit subjects in main...staging (merge commits skipped)
  local subjects line feat="" fix="" other=""
  subjects=$(gh api "repos/$REPO/compare/main...staging" --jq '.commits[].commit.message | split("\n")[0]') || {
    echo "_Release notes unavailable (compare API failed)._"
    return 0
  }
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == "Merge "* ]] && continue
    if [[ $line =~ ^feat(\(.*\))?!?: ]]; then
      feat+="- $line"$'\n'
    elif [[ $line =~ ^fix(\(.*\))?!?: ]]; then
      fix+="- $line"$'\n'
    else
      other+="- $line"$'\n'
    fi
  done <<< "$subjects"
  echo "## Changes (main...staging)"
  [[ -n "$feat" ]] && printf '\n### Features\n%s' "$feat"
  [[ -n "$fix" ]] && printf '\n### Fixes\n%s' "$fix"
  [[ -n "$other" ]] && printf '\n### Other\n%s' "$other"
  [[ -n "$feat$fix$other" ]] || echo "_No commits besides merges._"
}

ensure_release_pr() {
  local number body
  body="New changes on staging. Merge after the owner's GO, once this PR's checks (CI on staging) are green and VM staging is verified; prod auto-deploys main."$'\n\n'"$(release_notes)"
  number=$(gh pr list -R "$REPO" --base main --head staging --state open --json number --jq '.[].number')
  if [[ -z "$number" ]]; then
    gh pr create -R "$REPO" --base main --head staging --title "Release: staging → main" --body "$body" \
      || echo "::warning::release PR not opened (repo setting 'Allow GitHub Actions to create and approve pull requests' is off?): open staging → main by hand"
  else
    # staging moved on: refresh the changelog section of the open release PR
    gh pr edit "$number" -R "$REPO" --body "$body" || echo "::warning::release notes of #$number not refreshed"
    echo "release PR staging → main already open (#$number), notes refreshed"
  fi
}

main() {
  : "${REPO:?}" "${SHA:?}" "${BRANCH:?}"
  merged=0
  while IFS=$'\t' read -r number author title; do
    [[ -z "$number" ]] && continue
    if [[ "$author" == "app/dependabot" ]] && is_major_bump "$title"; then
      echo "#$number: dependabot major bump, left for review"
      continue
    fi
    if all_green "$SHA"; then
      # sha= makes GitHub refuse the merge if the PR head moved after the checks ran
      gh api -X PUT "repos/$REPO/pulls/$number/merge" -f merge_method=merge -f sha="$SHA" --jq .message
      merged=1
    fi
  done < <(gh pr list -R "$REPO" --base staging --state open --json number,headRefOid,isDraft,author,title \
    --jq ".[] | select(.headRefOid == \"$SHA\" and (.isDraft | not)) | [.number, .author.login, .title] | @tsv")

  if [[ $merged == 1 ]]; then
    gh workflow run ci.yml -R "$REPO" --ref staging
    echo "dispatched CI on staging"
    # The dispatched run was started with GITHUB_TOKEN, so its completion does NOT fire workflow_run again:
    # open the release PR now; its checks show the staging CI result before the owner clicks merge.
    ensure_release_pr
  elif [[ "$BRANCH" == "staging" ]] && all_green "$SHA"; then
    ensure_release_pr
  fi
}

# sourced by tests -> only the functions; executed -> run
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
