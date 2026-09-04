#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4184}"
DOM_FILE="${RUNNER_TEMP:-/tmp}/zero2fit-build047-adventure-friction-dom.html"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-build047-adventure-friction-server.log"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

ready=0
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/qa-adventure-friction-fixture.html" >/dev/null; then ready=1; break; fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then echo 'Build 047 Adventure-friction fixture server did not become ready.' >&2; cat "$SERVER_LOG" >&2 || true; exit 1; fi

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then echo 'No Chrome/Chromium executable found on runner.' >&2; exit 1; fi

for attempt in 1 2; do
  profile="${RUNNER_TEMP:-/tmp}/z2f-build047-adventure-${attempt}-$$"
  rm -rf "$profile" "$DOM_FILE"
  set +e
  timeout --signal=TERM --kill-after=5s 40s "$CHROME" \
    --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --disable-background-networking --disable-component-update --no-first-run \
    --no-default-browser-check --user-data-dir="$profile" --virtual-time-budget=24000 \
    --dump-dom "http://127.0.0.1:${PORT}/qa-adventure-friction-fixture.html" >"$DOM_FILE" 2>/dev/null
  chrome_status=$?
  set -e
  rm -rf "$profile"

  if [[ -s "$DOM_FILE" ]] \
    && grep -Fq 'Adventure repeatedly stops at combat walls' "$DOM_FILE" \
    && grep -Fq '4 of 8 active progression runs ended at a combat wall.' "$DOM_FILE" \
    && grep -Fq 'not a prompt to train extra' "$DOM_FILE" \
    && grep -Fq 'Adventure is repeatedly waiting on real-world capability' "$DOM_FILE" \
    && grep -Fq '3 runs ended at a real-progress capability gate.' "$DOM_FILE" \
    && grep -Fq 'not a prompt to overtrain' "$DOM_FILE"; then
    echo "Build 047 Adventure-friction browser test passed on attempt ${attempt}."
    exit 0
  fi

  if [[ "$attempt" -eq 1 ]]; then echo "Build 047 Adventure-friction attempt 1 incomplete (Chrome exit ${chrome_status}); retrying once." >&2; fi
done

echo 'Build 047 Adventure-friction browser test failed after bounded retry.' >&2
grep -E 'Adventure repeatedly|capability gate|prompt to train|prompt to overtrain|active progression runs' "$DOM_FILE" || true
exit 1
