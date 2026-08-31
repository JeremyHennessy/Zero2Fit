#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
DOM_FILE="${RUNNER_TEMP:-/tmp}/zero2fit-dom.html"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-server.log"
EXPECTED_EXERCISES="$(node -e "const x=require('./data/generated/catalog_summary.json'); process.stdout.write(String(x.counts.exercises))")"
EXPECTED_MET_ACTIVITIES="$(node -e "const x=require('./data/generated/catalog_summary.json'); process.stdout.write(String(x.counts.metActivities))")"

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

assert_dom() {
  local needle="$1"
  local label="${2:-$1}"
  if ! grep -Fq "$needle" "$DOM_FILE"; then
    echo "Browser smoke missing expected DOM marker: $label" >&2
    echo "Expected literal: $needle" >&2
    exit 1
  fi
}

assert_dom 'Use what is actually available'
assert_dom 'Bodyweight Squat'
assert_dom 'No true substitute here'
assert_dom "${EXPECTED_EXERCISES} exercises" 'generated exercise count'
assert_dom "${EXPECTED_MET_ACTIVITIES} MET activities" 'generated MET activity count'

assert_dom 'Data architecture · Build 003'
assert_dom 'Import measurements'
assert_dom 'Amazfit / Zepp → Apple Health'
assert_dom 'RENPHO'
assert_dom 'IndexedDB'
assert_dom 'Export JSON backup'

assert_dom 'Train outside. Advance inside.'
assert_dom 'Latest body snapshot'
assert_dom 'Your devices, one private timeline'
assert_dom 'z4SensorStrip'
assert_dom './build006.css'
assert_dom './build007.css'

assert_dom 'Frontier expedition'
assert_dom 'Offline auto-adventure'
assert_dom 'Real fitness creates Adventure Energy'
assert_dom 'Loot &amp; equipment'
assert_dom 'Foundation Trail'
assert_dom 'id="z11AdventureStatus"' 'Build 011 Adventure status panel'
assert_dom 'Automatic progression'
assert_dom 'Materials'
assert_dom 'Real-world capability ceiling'
assert_dom 'Private aligned visual timeline'
assert_dom 'Use camera'
assert_dom 'Save aligned photo'
assert_dom 'Local only'
assert_dom 'id="z8Stage"'

assert_dom 'z12SettingsButton'
assert_dom 'Devices &amp; private sync'
assert_dom 'z12ProgressTabs'
assert_dom 'z12AdventureControls'
assert_dom 'z12AdventurePrimary'
assert_dom 'build012.css'
assert_dom 'Machines + cable + Smith + full dumbbell set'

assert_dom 'id="z14FocusCard"' 'Build 014 guided workout card'
assert_dom 'Complete set'
assert_dom 'Skip for now'
assert_dom 'Full workout'
assert_dom 'Exercise 1 of'

assert_dom 'id="z16Battlefield"' 'Build 016 Adventure battlefield'
assert_dom 'Current expedition'
assert_dom 'What improves your odds'
assert_dom 'Last expedition'
assert_dom 'id="z16Run"' 'Build 016 delegated expedition control'
assert_dom 'Auto-equip best'

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

if grep -q 'Zero2Fit Build 012 productization extension failed to load' "$DOM_FILE"; then
  echo 'Build 012 productization module failed in browser.' >&2
  exit 1
fi

if grep -q 'Zero2Fit Build 014 guided workout execution failed to load' "$DOM_FILE"; then
  echo 'Build 014 loader failed in browser.' >&2
  exit 1
fi

if grep -q 'Zero2Fit Build 014 workout execution failed' "$DOM_FILE"; then
  echo 'Build 014 execution module failed in browser.' >&2
  exit 1
fi

if grep -q 'Zero2Fit Build 016 Adventure visual extension failed to load' "$DOM_FILE"; then
  echo 'Build 016 Adventure visual loader failed in browser.' >&2
  exit 1
fi

if grep -q 'Zero2Fit Build 016 Adventure visual layer failed' "$DOM_FILE"; then
  echo 'Build 016 Adventure visual module failed in browser.' >&2
  exit 1
fi

echo "Browser smoke passed: ${EXPECTED_EXERCISES} exercises, ${EXPECTED_MET_ACTIVITIES} MET activities, training, guided workout execution, devices, clean iPhone UI, adaptive/personal intelligence, RPG adventure v2 + visual battlefield, PWA/productization, progress-photo modules, and private-sync shell rendered."
