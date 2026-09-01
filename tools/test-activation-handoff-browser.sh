#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4176}"
DOM_FILE="${RUNNER_TEMP:-/tmp}/zero2fit-activation-handoff-dom.html"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-activation-handoff-server.log"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

ready=0
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null; then ready=1; break; fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then
  echo 'Activation handoff test server did not become ready.' >&2
  cat "$SERVER_LOG" >&2 || true
  exit 1
fi

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then echo 'No Chrome/Chromium executable found on runner.' >&2; exit 1; fi

TARGET="http://127.0.0.1:${PORT}/?activation=healthkit"
for attempt in 1 2; do
  profile="${RUNNER_TEMP:-/tmp}/z2f-activation-handoff-${attempt}-$$"
  rm -rf "$profile" "$DOM_FILE"
  set +e
  timeout --signal=TERM --kill-after=5s 35s "$CHROME" \
    --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --disable-background-networking --disable-component-update --no-first-run \
    --user-data-dir="$profile" --virtual-time-budget=18000 --dump-dom "$TARGET" >"$DOM_FILE" 2>/dev/null
  chrome_status=$?
  set -e
  rm -rf "$profile"

  if [[ -s "$DOM_FILE" ]] \
    && grep -Fq 'data-zero2fit-activation-handoff="healthkit"' "$DOM_FILE" \
    && grep -Fq 'id="z28HealthKitEvidence"' "$DOM_FILE" \
    && grep -Fq 'id="z31ActivationHandoff"' "$DOM_FILE" \
    && grep -Fq 'Opened from Zero2Fit Bridge' "$DOM_FILE"; then
    echo "Build 031 browser handoff passed on attempt ${attempt}."
    exit 0
  fi

  if [[ "$attempt" -eq 1 ]]; then
    echo "Activation handoff attempt 1 incomplete (Chrome exit ${chrome_status}); retrying once with a fresh profile." >&2
  fi
done

echo 'Build 031 browser handoff failed after the bounded retry.' >&2
grep -E 'zero2fit-activation-handoff|z28HealthKitEvidence|z31ActivationHandoff|Opened from Zero2Fit Bridge' "$DOM_FILE" || true
exit 1
