#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4182}"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-build046-review-server.log"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

ready=0
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/qa-tuning-review-fixture.html" >/dev/null; then ready=1; break; fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then echo 'Build 046 tuning-review fixture server did not become ready.' >&2; cat "$SERVER_LOG" >&2 || true; exit 1; fi

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then echo 'No Chrome/Chromium executable found on runner.' >&2; exit 1; fi

capture_dom() {
  local mode="$1" file="$2" attempt chrome_status profile
  for attempt in 1 2; do
    profile="${RUNNER_TEMP:-/tmp}/z2f-build046-${mode}-${attempt}-$$"
    rm -rf "$profile" "$file"
    set +e
    timeout --signal=TERM --kill-after=5s 40s "$CHROME" \
      --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
      --disable-background-networking --disable-component-update --no-first-run \
      --no-default-browser-check --user-data-dir="$profile" --virtual-time-budget=24000 \
      --dump-dom "http://127.0.0.1:${PORT}/qa-tuning-review-fixture.html?mode=${mode}" >"$file" 2>/dev/null
    chrome_status=$?
    set -e
    rm -rf "$profile"
    if [[ "$chrome_status" -eq 0 && -s "$file" ]] && grep -Fq 'id="z46SignalToggle"' "$file"; then return 0; fi
    if [[ "$attempt" -eq 1 ]]; then echo "Build 046 ${mode} DOM attempt 1 incomplete (Chrome exit ${chrome_status}); retrying once." >&2; fi
  done
  echo "Build 046 ${mode} DOM failed after bounded retry." >&2
  return 1
}

COLLAPSED="${RUNNER_TEMP:-/tmp}/zero2fit-build046-collapsed.html"
EXPANDED="${RUNNER_TEMP:-/tmp}/zero2fit-build046-expanded.html"
capture_dom collapsed "$COLLAPSED"
capture_dom expanded "$EXPANDED"

# Default state: preserve original order and render only the first three signals.
grep -Fq 'Showing 3 of 11 signals' "$COLLAPSED"
grep -Fq 'Show all 11' "$COLLAPSED"
grep -Fq 'aria-expanded="false"' "$COLLAPSED"
grep -Fq 'Daily guidance is often bypassed' "$COLLAPSED"
grep -Fq 'Workout queue has repeated skips' "$COLLAPSED"
grep -Fq 'Exercise substitutions are a recurring need' "$COLLAPSED"
if grep -Fq 'Workout targets are frequently edited' "$COLLAPSED"; then
  echo 'Build 046 collapsed state leaked signal four into the DOM.' >&2
  exit 1
fi

# Expanded state: same ordering, all signals discoverable.
grep -Fq 'Showing all 11 signals' "$EXPANDED"
grep -Fq 'Show top 3' "$EXPANDED"
grep -Fq 'aria-expanded="true"' "$EXPANDED"
grep -Fq 'Daily guidance is often bypassed' "$EXPANDED"
grep -Fq 'Workout targets are frequently edited' "$EXPANDED"
grep -Fq 'Default rest is often shortened' "$EXPANDED"
grep -Fq 'Workouts are often left unfinished' "$EXPANDED"
grep -Fq 'Add Food sessions are often abandoned' "$EXPANDED"
grep -Fq 'Food lookup often misses a usable result' "$EXPANDED"
grep -Fq 'Fuel logging still leans on manual entry' "$EXPANDED"
grep -Fq 'Manual health entry is still doing repeated work' "$EXPANDED"
grep -Fq 'Quick training is the dominant choice' "$EXPANDED"

echo 'Build 046 collapsed/expanded tuning-review browser test passed.'
