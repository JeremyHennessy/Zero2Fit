#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4180}"
DOM_FILE="${RUNNER_TEMP:-/tmp}/zero2fit-build045-fuel-friction-dom.html"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-build045-fuel-friction-server.log"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

ready=0
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/qa-fuel-friction-fixture.html" >/dev/null; then ready=1; break; fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then echo 'Build 045 Fuel-friction fixture server did not become ready.' >&2; cat "$SERVER_LOG" >&2 || true; exit 1; fi

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then echo 'No Chrome/Chromium executable found on runner.' >&2; exit 1; fi

for attempt in 1 2; do
  profile="${RUNNER_TEMP:-/tmp}/z2f-build045-fuel-${attempt}-$$"
  rm -rf "$profile" "$DOM_FILE"
  set +e
  timeout --signal=TERM --kill-after=5s 40s "$CHROME" \
    --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --disable-background-networking --disable-component-update --no-first-run \
    --no-default-browser-check --user-data-dir="$profile" --virtual-time-budget=24000 \
    --dump-dom "http://127.0.0.1:${PORT}/qa-fuel-friction-fixture.html" >"$DOM_FILE" 2>/dev/null
  chrome_status=$?
  set -e
  rm -rf "$profile"

  if [[ -s "$DOM_FILE" ]] \
    && grep -Fq 'id="z43TuningSignals"' "$DOM_FILE" \
    && grep -Fq 'id="z45ToggleMeasurement"' "$DOM_FILE" \
    && grep -Fq 'Add Food sessions are often abandoned' "$DOM_FILE" \
    && grep -Fq 'Food lookup often misses a usable result' "$DOM_FILE" \
    && grep -Fq 'Fuel logging still leans on manual entry' "$DOM_FILE" \
    && grep -Fq '3 of 4 closed Add Food sessions ended without a new entry.' "$DOM_FILE" \
    && grep -Fq '4 of 5 resolved lookups were empty or failed.' "$DOM_FILE" \
    && grep -Fq '5 of 7 measured entries used the full manual form.' "$DOM_FILE" \
    && grep -Fq 'Pause measurement' "$DOM_FILE"; then
    echo "Build 045 populated Fuel-friction browser test passed on attempt ${attempt}."
    exit 0
  fi

  if [[ "$attempt" -eq 1 ]]; then echo "Build 045 Fuel-friction attempt 1 incomplete (Chrome exit ${chrome_status}); retrying once." >&2; fi
done

echo 'Build 045 populated Fuel-friction browser test failed after bounded retry.' >&2
grep -E 'z43TuningSignals|z45ToggleMeasurement|Add Food sessions|Food lookup often|Fuel logging still|closed Add Food|resolved lookups|manual form|Pause measurement' "$DOM_FILE" || true
exit 1
