# Zero2Fit — Current State

This file is the authoritative technical checkpoint for future Zero2Fit work. It separates **software/production verification**, **real-account/browser acceptance**, **physical-device acceptance**, and **evidence-driven tuning**.

## Locked application baseline

**Current production application:** Build 047 — Adventure Friction Evidence, on top of Builds 046, 045, 044, 043, 042 and the Build 040 light blue/orange product shell.

**Application-code checkpoint:** `3a9925d403887d6ee700ab6fb7311987b2912d88`

**Preserved baseline ref:** `baseline/build-047-v1-activation`

Production target:

`https://jeremyhennessy.github.io/Zero2Fit/`

Build 047 is frozen as the V1 activation/use baseline. Until the activation and real-use sequence below is complete, do **not** add another broad subsystem, redesign the approved UI, refactor working architecture, or tune behavior from synthetic/one-off evidence.

The active offline-shell lineage is `zero2fit-shell-v47-adventure-friction`.

At the Build 047 production checkpoint:

- GitHub Pages deployment on the exact Build 047 SHA: **success**
- Visual QA on the exact Build 047 SHA: **success**
- Build 045 Fuel-friction validation: implemented and merged
- Build 046 tuning-review validation: implemented and merged
- Build 047 Adventure-friction validation: implemented and merged
- no open pull request existed when this checkpoint was reconciled on 2026-09-09

Software/CI success is not a substitute for browser/device acceptance.

## Product purpose

Zero2Fit is a one-person personal fitness operating system. It is not being designed as a commercial multi-user SaaS product.

The product should make four questions easy to answer:

1. What should I do today?
2. What did I actually do?
3. Am I improving?
4. What is the smallest useful next action when motivation or time is low?

Primary iPhone navigation:

**Today · Train · Fuel · Adventure · Progress · Devices**

Settings remains available from the top-right control and includes private-sync/setup actions.

## Current visual authority

Build 040+ is the active presentation authority:

- light-only product shell
- cool neutral background and white surfaces
- blue for navigation, structure, trusted-data state and primary information
- orange for training, energy and action emphasis
- iPhone safe-area bottom navigation
- desktop horizontal product header
- Adventure uses the same light product language
- versioned PWA/offline shell

Historical CSS remains only for semantic compatibility. Leakage from old dark/neon presentation layers is a regression.

## Build 042 — Daily Guidance

Today exposes one primary next action over existing Move / Train / Fuel / Recover state.

Current deterministic action order:

1. continue an already-started workout;
2. on a completely blank day, take a 10-minute purposeful walk;
3. do the Quick version of the existing planned workout;
4. log what has been eaten so far;
5. fill the remaining movement gap with a short purposeful walk;
6. complete the recovery check;
7. once all four signals are covered, explicitly say that no extra task is required.

Build 042 does not infer calorie/macronutrient targets, weight-loss direction, medical readiness, device trust or permanent Fitness XP.

## Builds 043–047 — private/local measurement before tuning

### Build 043 — Usage & Friction Measurement

Local-only `zero2fit-usage-v1` instrumentation with 90-day / 1,600-event retention and allow-listed categorical metadata only.

Measures, without raw health/nutrition values:

- Daily Guidance shown/opened
- page visits
- Quick / Standard / Full selection
- workout location choice
- set completion/skipping
- substitutions
- workout finish outcomes
- Fuel logging method
- repeated manual steps/weight interactions
- Adventure run/wall outcomes

### Build 044 — Training Friction Detail

Adds categorical evidence for:

- load-target vs reps-target edits
- guided stepper vs direct/manual edit
- rest extended vs ended early
- skipped-set queue restored
- active workout left before completion
- unfinished workout later resumed

Derived signals are evidence labels only; they do not alter programming.

### Build 045 — Fuel Friction Detail

Extends the same local measurement authority to Fuel interaction outcomes:

- Add Food session completed vs abandoned
- lookup success / empty / error by supported lookup method
- repeated lookup friction
- repeated manual-entry reliance
- explicit Pause / Resume measurement control

Build 045 does not store food names, search text, barcode values, calories/macros, account identity or photos in tuning history and does not change nutrition targets.

### Build 046 — Complete Tuning Review

Progress keeps tuning evidence compact by default while allowing all derived signals to be reviewed:

- top three signals shown by default
- show-all / collapse control when more than three exist
- existing signal derivation and order preserved

This is discoverability only; it does not auto-tune the product.

### Build 047 — Adventure Friction Evidence

Adds explainable Adventure tuning evidence from existing categorical outcomes:

- repeated combat-wall signal after sufficient active progression evidence
- repeated real-capability-gate signal after sufficient gate evidence
- paused/content-complete outcomes excluded from the active progression denominator

Build 047 does not change enemies, bosses, HP/damage, loot, gear power, fitness ceilings, stage progression, workouts, device trust or permanent XP. Adventure wall evidence is not a prompt to train extra or overtrain.

## Core functional systems

### Training

Software-verified:

- Home / Apartment Gym / Full Gym contexts
- Quick / Standard / Full modes
- automatic Full Body A/B selection from completed history
- equipment-aware exercise resolution
- same-location substitutions by training intent
- guided set execution
- load/repetition controls and automatic rest timing
- skip/resume/substitute/instruction controls
- adaptive rep/load progression from completed history
- conservative recovery-aware prescription using only trusted evidence
- observed workout energy preferred when available, with MET fallback/reference
- authenticated workout-session/set continuity

Current generated exercise coverage:

| Dataset | Count |
|---|---:|
| Source/training exercises | **876** |
| Source bodyweight/body-only | **188** |
| Home-compatible | **147** |
| Apartment Gym-compatible | **402** |
| Full Gym-compatible | **876** |
| Official-PDF MET activities | **1,111** |

Apartment Gym includes the confirmed full dumbbell set plus photographed cable/Smith/machine/cardio/bench/pull-up/dip/stability-ball equipment.

### Fuel

Software-verified:

- calories, protein, carbohydrates and fat
- day navigation
- recent foods and saved meals
- Repeat Last
- quick nutrition-line parsing
- optional explicit user-entered targets
- Open Food Facts search/barcode lookup
- normalized nutrition history
- private saved-meal/target sync through preferences
- deletion tombstones

Zero2Fit does not infer a calorie target or weight-loss direction.

### Personal Intelligence

Implemented:

- latest weight and smoothed trend
- strength/bodyweight PRs
- labelled estimated 1RM where appropriate
- strength trends
- weekly review
- Then-vs-Now summary
- recovery/training associations when enough evidence exists
- explainable recommendations with confidence labels
- Fuel and progress-photo context

### Adventure

Implemented:

- automatic staged progression
- zones, ordinary enemies and bosses
- persistent HP through expeditions
- Strength / Endurance / Consistency / Recovery / Nutrition game capabilities
- raw vs effective gear power with a real-fitness ceiling
- weapons, armor, charms, coins, materials and loot
- auto-equip
- capability gates, combat-defeat walls and content-complete wall
- player-vs-enemy battlefield and progression guidance

Adventure never creates permanent Fitness XP.

### Progress photos

Software capability remains implemented:

- front / side / back capture
- camera/library input
- alignment controls and previous-photo ghost overlay
- local IndexedDB blobs
- private Supabase `progress-photos` bucket
- RLS-protected session/asset metadata
- authenticated upload/download/delete path
- deletion tombstones
- user-ID-prefixed Storage paths
- raw photo blobs excluded from JSON backup

**V1 activation decision:** cross-browser progress-photo cloud continuity is deferred and is not an activation blocker. Do not represent photo cloud continuity as accepted until separately proven later.

## Private storage / Supabase

Connected project: `guxdnxnqzhkidtastsfb`

Implemented architecture:

- authenticated per-user Row Level Security
- public publishable key only in browser/iOS clients
- no service-role/secret key committed to the public app
- private `progress-photos` Storage bucket
- normalized events
- user preferences
- device source observations and explicit source verifications
- workout sessions/sets
- progress-photo sessions/assets
- import runs
- RPG/Fitness-XP tables reserved in schema
- deployed `food-lookup` Edge Function

### Live private-store evidence — re-queried 2026-09-09

Confirmed facts from the connected production project:

- project status: **ACTIVE_HEALTHY**
- real Auth users: **1**
- Build 024 cloud marker: **7/7 pass**
- latest confirmed Build 024 `passed_at`: **2026-09-04T15:53:29.838Z**
- normalized events: **7**
- workout sessions: **3**
- workout sets: **22**
- progress-photo sessions/assets: **0 / 0**
- device source observations/verifications: **0 / 0**
- explicit nutrition targets: calories/protein/carbs/fat are still **unset/null**
- at least one saved meal is present in private Fuel preferences
- a real completed Home workout with completed sets is present

Two older `acceptance_browser_snapshot` events exist, but both predate the Build 026 compatibility fix and therefore record infrastructure as false. There is **no post-fix Browser-A Build 026 snapshot** yet. There is also no verified Browser-B continuity evidence.

Do not repeat Build 024 Browser-A acceptance merely to create activity; it is already proven. The next Browser-A action is to set explicit nutrition targets and publish a fresh Build 026 snapshot.

## Browser/private-account acceptance status

### Confirmed complete

- [x] real private account exists and is authenticated
- [x] Browser A Build 024 core infrastructure acceptance passed 7/7
- [x] real Fuel history exists
- [x] at least one Open Food Facts-backed nutrition entry exists
- [x] saved-meal state exists
- [x] real workout history with completed sets exists

### Still required

- [ ] set all four explicit Fuel targets on Browser A
- [ ] run Build 026 `Run checks + sync` on current Build 047 and publish a fresh post-fix Browser-A snapshot
- [ ] sign into the same account on Browser B
- [ ] run Build 024 on Browser B and require a real pass there
- [ ] run Build 026 on Browser B
- [ ] prove Fuel history + saved meal + explicit targets reconstruct on Browser B
- [ ] prove workout/session/set history reconstructs on Browser B
- [ ] explicitly confirm the adaptive next-workout recommendation is consistent with restored history
- [ ] create a representative Fuel deletion/clear-day tombstone and sync
- [ ] prove the deletion propagates in both directions and does not resurrect

Progress-photo cloud continuity is intentionally excluded from these V1 browser-acceptance gates.

## Physical iPhone / HealthKit acceptance status

Intended physical path:

```text
Amazfit Active 2 → Zepp → Apple Health / HealthKit → Zero2FitHealthBridge
RENPHO scale → RENPHO Health → Apple Health / HealthKit → Zero2FitHealthBridge
```

Historical RENPHO CSV and Apple Health XML imports remain supported.

Current production evidence has **zero device source observations and zero source verifications**, so physical activation has not been completed.

Required sequence:

1. sign `Zero2FitHealthBridge` into the real private account on the physical iPhone;
2. authorize HealthKit;
3. capture/sync the last 24 hours; use 30 days only if broader source/metric coverage is needed;
4. identify the exact observed Zepp/Amazfit and RENPHO HealthKit source bundle IDs;
5. compare source-app → Apple Health → Zero2Fit evidence;
6. resolve Build 028 rows honestly as Matched / Not provided / Mismatch;
7. require **Zepp Steps** to match;
8. require **RENPHO Weight** to match;
9. confirm physical background delivery;
10. record the exact RENPHO underside model label;
11. only then use the separate Verify Zepp / Verify RENPHO actions;
12. refresh native private activation status and confirm those exact observed bundles are verified.

Permanent device-driven Fitness XP requires all of the following:

- `source_provider = healthkit_bridge`
- verified native transport metadata
- exact HealthKit source bundle ID
- explicit Zero2Fit source-verification record
- source-verification status `verified`

Source-name text, imported Apple Health labels, candidate selection, parity records, acceptance checkboxes and readiness checkpoints do not authorize permanent XP.

## V1 completion sequence

Zero2Fit is now in:

**Finish Activate → 10–14 days Use → Measure → one Tune pass → V1 baseline**

### 1. Finish Activate

Complete the Browser B continuity and physical HealthKit/Zepp/RENPHO evidence above. Fix only verified blockers at the first incorrect layer.

### 2. Use for 10–14 days

Use the Build 047 app normally and accumulate representative real history across:

- Home / Apartment Gym / Full Gym when available
- Quick / Standard / Full workout modes
- substitutions and skips when genuinely needed
- load/rep edits
- rest overrides
- Fuel logging/search/saved/repeat flows
- Daily Guidance on blank, partial, active-workout and complete days
- normal Adventure progression/walls

Do not change algorithms during the observation window except for verified correctness/blocker defects.

### 3. Measure

Review the existing Builds 043–047 local/private evidence. Do not add third-party analytics merely to measure this window.

### 4. One evidence-based tuning pass

Tune in this order only where representative evidence supports a change:

1. workout location/mode defaults;
2. substitution ranking;
3. adaptive load/repetition behavior;
4. Fuel shortcuts;
5. Daily Guidance order/wording;
6. Adventure pacing/economy.

### 5. Declare V1 complete

After tuning:

- run the full regression suite
- run focused feature/authority tests
- run complete visual QA including iPhone full-height views
- merge only from the exact tested head
- verify GitHub Pages separately on the exact merged SHA
- rerun Supabase security and operational advisors
- preserve the exact final SHA as the personal-use V1 baseline

## Deferred intentionally

Unless direction explicitly changes, defer:

- Garmin/Fitbit integrations
- co-op/PvP
- multiplayer/social features
- another major visual redesign
- another broad Personal Intelligence subsystem
- commercial/multi-user product work

See [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) for the execution checklist.
