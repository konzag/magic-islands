#!/usr/bin/env bash
# Post-deploy smoke (GET only). Usage: tools/smoke.sh <direct-base-url> [funnel-base-url]
#   direct: http://127.0.0.1:8087 on the VM (or http://192.168.1.17:8087 from monitor)
#   funnel: https://public.tailc01d70.ts.net (prod only)
set -uo pipefail
BASE=${1:?usage: smoke.sh <base-url> [funnel-url]}
FUNNEL=${2:-}
fails=0
check() { # name expected_code url [grep_pattern] [header]
  local out code body
  out=$(curl -s -m 15 ${5:+-H "$5"} -D - "$3" -o /tmp/magic-smoke.$$ -w '%{http_code}') || true
  code=${out##*$'\n'}
  body=$(cat /tmp/magic-smoke.$$ 2>/dev/null; printf '%s' "$out")
  if [ "$code" = "$2" ] && { [ -z "${4:-}" ] || grep -qi -- "$4" <<<"$body"; }; then echo "PASS $1 ($code)"
  else echo "FAIL $1 (got $code, want $2${4:+, pattern $4})"; fails=$((fails + 1)); fi
}
check "page" 200 "$BASE/" "Τα Μαγικά Νησιά"
check "page CSP is hash-based" 200 "$BASE/" "script-src 'sha256-"
check "font css" 200 "$BASE/static/fonts/comfortaa.css" "@font-face"
check "service worker" 200 "$BASE/sw.js" "magic-islands-"
check "manifest" 200 "$BASE/static/manifest.webmanifest" "Τα Μαγικά Νησιά"
check "funnel header -> /sw.js 200" 200 "$BASE/sw.js" "magic-islands-" "Tailscale-Funnel-Request: ?1"
check "live" 200 "$BASE/health/live" '"alive"'
check "ready" 200 "$BASE/health/ready" '"ready"'
check "version" 200 "$BASE/version" '"commit_short"'
check "funnel header -> /version 404" 404 "$BASE/version" "NOT_FOUND" "Tailscale-Funnel-Request: ?1"
if [ -n "$FUNNEL" ]; then
  check "funnel page" 200 "$FUNNEL/" "Τα Μαγικά Νησιά"
  check "funnel /metrics 404" 404 "$FUNNEL/metrics"
  check "funnel /version 404" 404 "$FUNNEL/version"
  check "funnel /health/ready 404" 404 "$FUNNEL/health/ready"
fi
rm -f /tmp/magic-smoke.$$
echo "SMOKE FAILS=$fails"
[ "$fails" -eq 0 ]
