#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4179}"
DOM_FILE="${RUNNER_TEMP:-/tmp}/zero2fit-build044-friction-dom.html"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-build044-friction-server.log"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

ready=0
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/qa-training-friction-fixture.html" >/dev/null; then ready=1; break; fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then echo 'Build 044 training-friction fixture server did not become ready.' >&2; cat "$SERVER_LOG" >&2 || true; exit 1; fi

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then echo 'No Chrome/Chromium executable found on runner.' >&2; exit 1; fi

for attempt in 1 2; do
  profile="${RUNNER_TEMP:-/tmp}/z2f-build044-friction-${attempt}-$$"
  rm -rf "$profile" "$DOM_FILE"
  set +e
  timeout --signal=TERM --kill-after=5s 40s "$CHROME" \
    --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --disable-background-networking --disable-component-update --no-first-run \
    --no-default-browser-check --user-data-dir="$profile" --virtual-time-budget=24000 \
    --dump-dom "http://127.0.0.1:${PORT}/qa-training-friction-fixture.html" >"$DOM_FILE" 2>/dev/null
  chrome_status=$?
  set -e
  rm -rf "$profile"

  if [[ -s "$DOM_FILE" ]] \
    && grep -Fq 'id="z43TuningSignals"' "$DOM_FILE" \
    && grep -Fq 'Workout targets are frequently edited' "$DOM_FILE" \
    && grep -Fq 'Default rest is often shortened' "$DOM_FILE" \
    && grep -Fq 'Workouts are often left unfinished' "$DOM_FILE" \
    && grep -Fq '4 set-target edits were recorded (2 load · 2 reps).' "$DOM_FILE" \
    && grep -Fq 'Rest was ended early 3 times' "$DOM_FILE"; then
    echo "Build 044 populated training-friction browser test passed on attempt ${attempt}."
    exit 0
  fi

  if [[ "$attempt" -eq 1 ]]; then echo "Build 044 training-friction attempt 1 incomplete (Chrome exit ${chrome_status}); retrying once." >&2; fi
done

echo 'Build 044 populated training-friction browser test failed after bounded retry.' >&2
grep -E 'z43TuningSignals|Workout targets|Default rest|Workouts are often left|set-target edits|Rest was ended' "$DOM_FILE" || true
exit 1
