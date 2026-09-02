#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-50}"
DOM_FILE="${RUNNER_TEMP:-/tmp}/zero2fit-dom.html"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-server.log"
EXPECTED_EXERCISES="$(node -e "const x=require('./data/generated/catalog_summary.json'); process.stdout.write(String(x.counts.exercises))")"
EXPECTED_MET_ACTIVITIES="$(node -e "const x=require('./data/generated/catalog_summary.json'); process.stdout.write(String(x.counts.metActivities))")"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null; then break; fi
  sleep 0.25
done

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then echo 'No Chrome/Chromium executable found on runner.' >&2; exit 1; fi

capture_dom() {
  local attempt chrome_status profile
  for attempt in 1 2; do
    profile="${RUNNER_TEMP:-/tmp}/z2f-smoke-profile-${attempt}-$$"
    rm -rf "$profile" "$DOM_FILE"
    set +e
    timeout --signal=TERM --kill-after=5s "${SMOKE_TIMEOUT_SECONDS}s" "$CHROME" \
      --headless=new \
      --no-sandbox \
      --disable-gpu \
      --disable-dev-shm-usage \
      --disable-background-networking \
      --disable-component-update \
      --no-first-run \
      --no-default-browser-check \
      --user-data-dir="$profile" \
      --virtual-time-budget=22000 \
      --dump-dom "http://127.0.0.1:${PORT}/" >"$DOM_FILE" 2>/dev/null
    chrome_status=$?
    set -e
    rm -rf "$profile"

    if [[ "$chrome_status" -eq 0 ]] && [[ -s "$DOM_FILE" ]] && grep -Fq 'id="z11AdventureStatus"' "$DOM_FILE" && grep -Fq 'id="z28HealthKitEvidence"' "$DOM_FILE"; then
      if [[ "$attempt" -eq 2 ]]; then echo 'Browser smoke DOM completed on bounded retry.'; fi
      return 0
    fi

    if [[ "$attempt" -eq 1 ]]; then
      echo "Browser smoke attempt 1 did not reach all late-module markers (Chrome exit ${chrome_status}); retrying once with a fresh profile." >&2
    fi
  done

  if [[ ! -s "$DOM_FILE" ]]; then
    echo "Browser smoke could not produce a DOM after two attempts; final Chrome exit ${chrome_status}." >&2
    exit 1
  fi
  echo 'Browser smoke second attempt produced a DOM but not every late-module sentinel; detailed assertions will identify the missing marker.' >&2
}

capture_dom

assert_dom() {
  local needle="$1" label="${2:-$1}"
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
assert_dom 'id="z17Fuel"' 'Build 017 Fuel shell'
assert_dom 'Log once. Reuse what you actually eat.'
assert_dom 'Search saved + recent'
assert_dom 'Repeat last'
assert_dom 'Paste a nutrition line'
assert_dom 'Saved meals'
assert_dom '7-day logging'
assert_dom 'id="z17LegacyNutrition"' 'Build 017 legacy nutrition compatibility bridge'
assert_dom 'id="mealForm"' 'legacy nutrition form retained for XP bridge'
assert_dom 'id="z17NutritionIntel"' 'Build 017 personal-intelligence Fuel context'
assert_dom './build017.css'
assert_dom 'id="z18FoodLookup"' 'Build 018 food lookup shell'
assert_dom 'Find food without typing the macros.'
assert_dom 'Search Open Food Facts'
assert_dom 'Barcode'
assert_dom 'Look up'
assert_dom 'Camera scan unavailable'
assert_dom 'Open Food Facts'
assert_dom 'ODbL'
assert_dom './build018.css'
assert_dom 'id="z19FuelSync"' 'Build 019 Fuel private-sync strip'
assert_dom 'Fuel private sync'
assert_dom 'Fuel history is local + backup.'
assert_dom 'Browser storage remains the local cache.'
assert_dom 'full Fuel store'
assert_dom './build019.css'
assert_dom 'id="z21WorkoutSyncStatus"' 'Build 021 workout-continuity strip'
assert_dom 'Workout continuity'
assert_dom 'Workout history is local + backup.'
assert_dom 'completed workout sessions and set/load history'
assert_dom './build021.css'
assert_dom 'id="z22PhotoSyncStatus"' 'Build 022 photo-continuity strip'
assert_dom 'Private photo continuity'
assert_dom 'Raw photos remain in this browser until you sign in under Data and use Sync now.'
assert_dom 'Raw images stay out of JSON backups'
assert_dom './build022.css'
assert_dom 'id="z24Acceptance"' 'Build 024 private-account acceptance panel'
assert_dom 'Private-account acceptance'
assert_dom 'Run acceptance self-test'
assert_dom 'One-browser infrastructure acceptance only.'
assert_dom './build024.css'
assert_dom 'id="z26ActivationGuide"' 'Build 026 activation guide'
assert_dom 'Activation guide · Build 026'
assert_dom 'Finish real-account and iPhone acceptance.'
assert_dom 'Real-account acceptance'
assert_dom 'HealthKit acceptance'
assert_dom 'Private-store infrastructure self-test'
assert_dom 'Run local checks'
assert_dom './build026.css'
assert_dom 'id="z28HealthKitEvidence"' 'Build 028 HealthKit evidence matrix'
assert_dom 'Physical HealthKit evidence · Build 028'
assert_dom 'Resolve the source before you verify it.'
assert_dom 'Observed HealthKit bundle'
assert_dom 'Physical background delivery confirmed'
assert_dom 'Trust boundary:'
assert_dom 'Save evidence locally'
assert_dom './build028.css'

if grep -Fq 'Supabase remains disabled until authenticated RLS is configured and tested.' "$DOM_FILE"; then echo 'Stale pre-private-sync Supabase copy is still rendered.' >&2; exit 1; fi
if grep -q 'Workout reference data could not load' "$DOM_FILE"; then echo 'Workout catalog load failed in browser.' >&2; exit 1; fi
if grep -q 'Structured storage or ingestion module failed to load' "$DOM_FILE"; then echo 'Build 003 storage/device modules failed to load in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 004 initialization failed' "$DOM_FILE"; then echo 'Build 004 device/UI initialization failed in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 007 adventure failed' "$DOM_FILE"; then echo 'Build 007 adventure initialization failed in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 008 photos failed' "$DOM_FILE"; then echo 'Build 008 photo initialization failed in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 012 productization extension failed to load' "$DOM_FILE"; then echo 'Build 012 productization module failed in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 014 guided workout execution failed to load' "$DOM_FILE"; then echo 'Build 014 loader failed in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 014 workout execution failed' "$DOM_FILE"; then echo 'Build 014 execution module failed in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 016 Adventure visual extension failed to load' "$DOM_FILE"; then echo 'Build 016 Adventure visual loader failed in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 016 Adventure visual layer failed' "$DOM_FILE"; then echo 'Build 016 Adventure visual module failed in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 017 Fuel extension failed to load' "$DOM_FILE"; then echo 'Build 017 Fuel module failed in browser.' >&2; exit 1; fi
if grep -q 'Food lookup is not configured' "$DOM_FILE"; then echo 'Build 018 food lookup configuration failed.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 019 Fuel sync extension failed to load' "$DOM_FILE"; then echo 'Build 019 Fuel private-sync module failed in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 021 workout continuity extension failed to load' "$DOM_FILE"; then echo 'Build 021 workout-continuity module failed in browser.' >&2; exit 1; fi
if grep -q 'Zero2Fit Build 022 loader failed to load\|Zero2Fit Build 022 private photo continuity failed to load\|Zero2Fit Build 022/024 private continuity failed to load\|Zero2Fit Build 022/024/026 private continuity failed to load\|Zero2Fit Build 022/024/026/028 private continuity failed to load' "$DOM_FILE"; then echo 'Build 022/024/026/028 private continuity modules failed in browser.' >&2; exit 1; fi

echo "Browser smoke passed: ${EXPECTED_EXERCISES} exercises, ${EXPECTED_MET_ACTIVITIES} MET activities, training, guided workout execution + private set/load continuity, devices, Build 024 private-store acceptance + Build 026 cross-browser guide + Build 028 HealthKit evidence gate, clean iPhone UI, Fuel + food lookup + private sync, adaptive/personal intelligence, RPG adventure, private progress-photo continuity, PWA/productization, and private-sync shell rendered."
