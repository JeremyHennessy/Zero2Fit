#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4175}"
DOM_FILE="${RUNNER_TEMP:-/tmp}/zero2fit-build042-dom.html"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-build042-server.log"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null; then break; fi
  sleep 0.25
done

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then echo 'No Chrome/Chromium executable found on runner.' >&2; exit 1; fi

capture() {
  local attempt status profile
  for attempt in 1 2; do
    profile="${RUNNER_TEMP:-/tmp}/z2f-build042-profile-${attempt}-$$"
    rm -rf "$profile" "$DOM_FILE"
    set +e
    timeout --signal=TERM --kill-after=5s 45s "$CHROME" \
      --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
      --disable-background-networking --disable-component-update --no-first-run --no-default-browser-check \
      --user-data-dir="$profile" --virtual-time-budget=14000 \
      --dump-dom "http://127.0.0.1:${PORT}/?qaPage=today" >"$DOM_FILE" 2>/dev/null
    status=$?
    set -e
    rm -rf "$profile"
    if [[ "$status" -eq 0 ]] && [[ -s "$DOM_FILE" ]] && grep -Fq 'id="z42NextAction"' "$DOM_FILE"; then return 0; fi
    if [[ "$attempt" -eq 1 ]]; then echo 'Build 042 smoke did not reach daily-guidance marker; retrying once.' >&2; fi
  done
  echo "Build 042 browser smoke failed; final Chrome exit ${status}." >&2
  exit 1
}

capture

grep -Fq 'id="z42NextAction"' "$DOM_FILE"
grep -Fq 'id="z42ActionButton"' "$DOM_FILE"
grep -Fq 'id="z42StatusRow"' "$DOM_FILE"
grep -Fq 'Take a 10-minute purposeful walk' "$DOM_FILE"
grep -Fq '0 of 4 daily signals covered' "$DOM_FILE"
grep -Fq './build042.css' "$DOM_FILE"
if grep -Fq 'Zero2Fit private continuity module failed to load' "$DOM_FILE"; then echo 'Build 042 late module failed to load.' >&2; exit 1; fi

echo 'Build 042 browser smoke passed: default next action and four-signal Today guidance rendered.'
