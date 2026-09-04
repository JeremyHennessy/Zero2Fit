#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4177}"
DOM_FILE="${RUNNER_TEMP:-/tmp}/zero2fit-build043-signals-dom.html"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-build043-signals-server.log"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

ready=0
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/qa-usage-fixture.html" >/dev/null; then ready=1; break; fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then
  echo 'Build 043 signal fixture server did not become ready.' >&2
  cat "$SERVER_LOG" >&2 || true
  exit 1
fi

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then echo 'No Chrome/Chromium executable found on runner.' >&2; exit 1; fi

for attempt in 1 2; do
  profile="${RUNNER_TEMP:-/tmp}/z2f-build043-signals-${attempt}-$$"
  rm -rf "$profile" "$DOM_FILE"
  set +e
  timeout --signal=TERM --kill-after=5s 40s "$CHROME" \
    --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --disable-background-networking --disable-component-update --no-first-run \
    --no-default-browser-check --user-data-dir="$profile" --virtual-time-budget=24000 \
    --dump-dom "http://127.0.0.1:${PORT}/qa-usage-fixture.html" >"$DOM_FILE" 2>/dev/null
  chrome_status=$?
  set -e
  rm -rf "$profile"

  if [[ -s "$DOM_FILE" ]] \
    && grep -Fq 'id="z43TuningSignals"' "$DOM_FILE" \
    && grep -Fq 'Daily guidance is often bypassed' "$DOM_FILE" \
    && grep -Fq 'Workout queue has repeated skips' "$DOM_FILE" \
    && grep -Fq 'Exercise substitutions are a recurring need' "$DOM_FILE" \
    && grep -Fq 'Fuel entry is opened more often than it is completed' "$DOM_FILE" \
    && grep -Fq 'Quick leads' "$DOM_FILE"; then
    echo "Build 043 populated signal browser test passed on attempt ${attempt}."
    exit 0
  fi

  if [[ "$attempt" -eq 1 ]]; then
    echo "Build 043 populated signal attempt 1 incomplete (Chrome exit ${chrome_status}); retrying once." >&2
  fi
done

echo 'Build 043 populated signal browser test failed after bounded retry.' >&2
grep -E 'z43TuningSignals|Daily guidance|Workout queue|Exercise substitutions|Fuel entry|Quick leads' "$DOM_FILE" || true
exit 1
