#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
DOM_FILE="${RUNNER_TEMP:-/tmp}/zero2fit-dom.html"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-server.log"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null; then
    break
  fi
  sleep 0.25
done

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then
  echo 'No Chrome/Chromium executable found on runner.' >&2
  exit 1
fi

"$CHROME" \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --virtual-time-budget=15000 \
  --dump-dom "http://127.0.0.1:${PORT}/" >"$DOM_FILE"

grep -q 'Use what is actually available' "$DOM_FILE"
grep -q 'Bodyweight Squat' "$DOM_FILE"
grep -q 'No true substitute here' "$DOM_FILE"
grep -q '873 exercises' "$DOM_FILE"
grep -q '1111 MET activities' "$DOM_FILE"

grep -q 'Data architecture · Build 003' "$DOM_FILE"
grep -q 'Import measurements' "$DOM_FILE"
grep -q 'Amazfit Active 2 (Round)' "$DOM_FILE"
grep -q 'RENPHO scale' "$DOM_FILE"
grep -q 'IndexedDB' "$DOM_FILE"
grep -q 'Export JSON backup' "$DOM_FILE"

grep -q 'Train outside. Advance inside.' "$DOM_FILE"
grep -q 'Latest body snapshot' "$DOM_FILE"
grep -q 'Your devices, one private timeline' "$DOM_FILE"
grep -q 'z4SensorStrip' "$DOM_FILE"
grep -q './build006.css' "$DOM_FILE"
grep -q './build007.css' "$DOM_FILE"

grep -q 'Frontier expedition' "$DOM_FILE"
grep -q 'Offline auto-adventure' "$DOM_FILE"
grep -q 'Real fitness creates Adventure Energy' "$DOM_FILE"
grep -q 'Loot &amp; equipment' "$DOM_FILE"
grep -q 'Foundation Trail' "$DOM_FILE"
grep -q 'Private aligned visual timeline' "$DOM_FILE"
grep -q 'Use camera' "$DOM_FILE"
grep -q 'Save aligned photo' "$DOM_FILE"
grep -q 'Local only' "$DOM_FILE"
grep -q 'id="z8Stage"' "$DOM_FILE"

if grep -q 'Workout reference data could not load' "$DOM_FILE"; then
  echo 'Workout catalog load failed in browser.' >&2
  exit 1
fi

if grep -q 'Structured storage or ingestion module failed to load' "$DOM_FILE"; then
  echo 'Build 003 storage/device modules failed to load in browser.' >&2
  exit 1
fi

if grep -q 'Zero2Fit Build 004 initialization failed' "$DOM_FILE"; then
  echo 'Build 004 device/UI initialization failed in browser.' >&2
  exit 1
fi

if grep -q 'Zero2Fit Build 007 adventure failed' "$DOM_FILE"; then
  echo 'Build 007 adventure initialization failed in browser.' >&2
  exit 1
fi

if grep -q 'Zero2Fit Build 008 photos failed' "$DOM_FILE"; then
  echo 'Build 008 photo initialization failed in browser.' >&2
  exit 1
fi

echo 'Browser smoke passed: training, devices, approved UI, RPG adventure, and progress-photo modules rendered.'
