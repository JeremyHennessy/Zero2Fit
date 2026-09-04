# Zero2Fit — Current State

This file is the authoritative technical checkpoint for future Zero2Fit work. It separates **software/production verification** from **real-account and physical-device acceptance**.

## Production checkpoint

**Latest functional application:** Build 042 — Daily Guidance, with the Adventure status-shell readiness hotfix.

**Application-code checkpoint before this docs-only refresh:** `fc147ffe72bb49ac9e7b008db5c08155eb7320d4`

Production target:

`https://jeremyhennessy.github.io/Zero2Fit/`

Verified on that application-code checkpoint:

- full `Validate Zero2Fit` regression: **success**
- whole-app browser smoke, including late Adventure/HealthKit modules: **success**
- Build 022 photo-sync validation: **success**
- Build 024 private-account validation: **success**
- Build 026 activation-guide validation: **success**
- Build 028 HealthKit-evidence validation: **success**
- Build 031 activation-handoff validation: **success**
- Build 035 auth-activation validation: **success**
- Build 040 UI contract validation: **success**
- Build 042 Daily Guidance validation: **success**
- Visual QA Screenshots: **success**
- GitHub Pages build/deployment: **success**

The active offline shell is `zero2fit-shell-v42-daily-guidance`. Presentation/navigation CSS and JavaScript use network revalidation before the offline cache is refreshed, reducing the risk of an iPhone remaining on stale presentation assets after deployment.

## Product purpose

Zero2Fit is a one-person personal fitness operating system. It is not being designed as a commercial multi-user SaaS product.

The product should make four questions easy to answer:

1. What should I do today?
2. What did I actually do?
3. Am I improving?
4. What is the smallest useful next action when motivation or time is low?

Build 042 directly addresses question 4 by adding a deterministic **Next Best Action** layer on Today.

## Current product surface

Primary iPhone navigation:

**Today · Train · Fuel · Adventure · Progress · Devices**

Settings remains available from the top-right control and includes private-sync/setup actions.

Current visual system:

- light-only product shell
- cool neutral background and white surfaces
- blue for navigation, structure, trusted-data state and primary information
- orange for training, energy and action emphasis
- iPhone safe-area bottom navigation
- desktop horizontal product header
- the same light language on Adventure rather than a separate dark game skin
- versioned PWA/offline shell

The historical dark/neon Build 006/007 CSS remains underneath for compatibility with old semantic DOM/classes, but Build 040+ is the active visual authority. New UI work must treat leakage from those legacy layers as a regression.

## Build 042 — Daily Guidance

Today now exposes one primary action before the larger Momentum/Foundation content. It reads existing local state and does not create a new health or fitness authority.

Daily signals:

- **Move** — purposeful-movement completion or the existing 7,000-step movement threshold
- **Train** — completed training or an active workout session
- **Fuel** — a current-day Fuel entry or the existing nutrition completion signal
- **Recover** — the existing recovery-check completion signal

Current deterministic action order:

1. continue an already-started workout;
2. on a completely blank day, take a 10-minute purposeful walk;
3. do the Quick version of the existing planned workout;
4. log what has been eaten so far;
5. fill the remaining movement gap with a short purposeful walk;
6. complete the recovery check;
7. once all four signals are covered, explicitly say that no extra task is required.

Build 042 deliberately does **not** infer calorie targets, macro targets, weight-loss direction, medical readiness, device trust or permanent Fitness XP. It routes into the existing Train/Fuel/Today/Progress surfaces.

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

Apartment Gym includes the confirmed full dumbbell set plus the photographed cable/Smith/machine/cardio/bench/pull-up/dip/stability-ball equipment.

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
- clearly labelled estimated 1RM where appropriate
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

The post-Build-042 reliability hotfix mounts the Adventure status shell before its asynchronous core/catalog load. This removes a UI-readiness race without changing combat, progression, gear, XP or catalog semantics.

### Progress photos

Software-verified:

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

The iPhone photo workspace is explicitly forced to one column so the camera/alignment controls cannot spill outside the viewport.

## Private storage / Supabase

Connected project: `guxdnxnqzhkidtastsfb`

Implemented architecture:

- authenticated per-user Row Level Security
- public publishable key only in browser/iOS clients
- no service-role/secret key committed to the public app
- private `progress-photos` Storage bucket
- normalized events
- user preferences
- source observations and explicit source verifications
- workout sessions/sets
- progress-photo sessions/assets
- import runs
- RPG/Fitness-XP tables reserved in schema
- deployed `food-lookup` Edge Function

A September 2, 2026 checkpoint found no real Zero2Fit auth user or personal-data rows. That count was **not re-queried during the September 4 UI/Build 042 work**, so it must not be treated as a current live database count. Real-account acceptance remains unproven until performed with the actual account.

## Device path and permanent-XP trust boundary

Intended physical path:

```text
Amazfit Active 2 → Zepp → Apple Health / HealthKit → Zero2FitHealthBridge
RENPHO scale → RENPHO Health → Apple Health / HealthKit → Zero2FitHealthBridge
```

Historical RENPHO CSV and Apple Health XML imports remain supported.

Permanent device-driven Fitness XP requires all of the following:

- `source_provider = healthkit_bridge`
- verified native transport metadata
- exact HealthKit source bundle ID
- explicit Zero2Fit source-verification record
- source-verification status `verified`

Source-name text, imported Apple Health labels, candidate selection, parity records, acceptance checkboxes and native readiness checkpoints do not authorize permanent XP by themselves.

## Acceptance tooling already implemented

- **Build 024:** authenticated infrastructure self-test using ordinary publishable-key + user JWT; exercises RLS/CRUD/Storage/sync and cleans synthetic probes.
- **Build 026:** cross-browser Activation Guide using privacy-minimized browser snapshots and explicit human acceptance checkpoints.
- **Build 028:** fail-closed physical HealthKit source/metric evidence gate; Zepp requires matched Steps and RENPHO requires matched Weight.
- **Build 030:** native source-acceptance console for 24-hour/30-day capture, exact bundle IDs, metric summaries and background-delivery evidence.
- **Build 031:** privacy-safe native → web HealthKit-evidence handoff.
- **Build 033:** native read-only activation-completion status for private account, observations, exact verifications and background delivery.

None of these tools may manufacture the real account, physical source IDs or verification evidence.

## Real-account acceptance — still pending

Required high-level sequence:

1. create/sign into the real private account on browser/device A;
2. run Build 024 and require every infrastructure probe to pass;
3. publish the Build 026 browser-A acceptance snapshot;
4. create representative real Fuel, workout and progress-photo history;
5. Sync Now;
6. sign into the same account on browser/device B;
7. run Build 024 + Build 026 there;
8. prove Fuel reconstruction and deletion propagation;
9. prove workout/set history reconstruction and explicitly confirm the adaptive recommendation;
10. prove progress-photo upload → second-browser download → deletion propagation.

## Physical iPhone / HealthKit acceptance — still pending

1. sign the native companion into the real private account;
2. authorize HealthKit;
3. capture and sync recent data;
4. identify the actual Zepp and RENPHO source bundle IDs;
5. compare representative source-app → Apple Health → Zero2Fit evidence;
6. resolve every Build 028 metric honestly as Matched / Not provided / Mismatch;
7. require Zepp Steps and RENPHO Weight to match;
8. confirm physical background delivery;
9. record the exact RENPHO underside model label;
10. only then perform the separate Verify Zepp / Verify RENPHO actions;
11. confirm the native readback sees those exact private verification rows.

Until that happens, Zepp/RENPHO mappings remain unverified for permanent device Fitness XP.

## Verification automation

Current complementary gates include:

- full `Validate Zero2Fit` syntax/domain/browser regression
- Build 022 / 024 / 026 / 028 / 031 / 035 focused validation
- Build 040 UI contract
- Build 042 Daily Guidance model/UI/runtime contract
- native HealthKit tests/iOS simulator compilation
- **36 deterministic visual screenshots** covering standard 393×852 iPhone views, full-height 393×7000 audits, 430×932 iPhone-class views and desktop views
- full-height coverage for Today, Train, Adventure, Fuel, Progress, Devices, Settings plus expanded Activation, HealthKit, Photos and Add Food states
- browser smoke with two fresh-profile attempts and fail-closed late-module assertions
- path-scoped fitness reference-data refresh
- GitHub Pages deployment from `main`

## Next development priority

Do **not** add another broad subsystem before real activation/usage data exists.

The next product cycle is:

**Activate → Use → Measure → Tune**

### 1. Activate

Complete the real private-account and physical HealthKit sequences above.

### 2. Use

Use Zero2Fit for representative real workouts, Fuel logging, weight/steps and progress photos. Let Daily Guidance encounter real blank days, partial days, active workouts and completed days.

### 3. Measure

Measure friction from actual behavior rather than assumptions:

- Quick vs Standard vs Full choice
- workout substitutions and skipped exercises
- load/rep edits
- repeated foods/meals and logging effort
- which Daily Guidance actions are useful or ignored
- Adventure stalls/deaths and usable-vs-banked gear power

### 4. Tune

Use that evidence to tune workout defaults/substitutions, adaptive loading, Fuel shortcuts, Daily Guidance priority and Adventure pacing. Add richer intelligence only when enough real history exists to justify it.

Defer unless direction explicitly changes:

- Garmin/Fitbit integrations
- co-op/PvP
- another major visual redesign
- a new broad intelligence subsystem

See [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) for the execution sequence.
