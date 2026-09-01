# Zero2Fit — Current State

This file is the concise technical checkpoint for future Zero2Fit work. It distinguishes repository/software verification from real-account and physical-device acceptance.

## Production application checkpoint

**Last functional application build:** Build 026 — `405cff4391b2161bd1738f75cc1427da9583cb70`

Build 027 is documentation-only and may place a newer commit on `main` without changing application runtime. Use the Build 026 SHA above when comparing functional behavior.

Production target:

`https://jeremyhennessy.github.io/Zero2Fit/`

Build 026 post-merge verification on the exact functional SHA:

| Gate | Run | Result |
|---|---:|---|
| Validate Zero2Fit | `33461498731` | success |
| Build 022 focused photo-sync validation | `33461498810` | success |
| Build 024 private-account acceptance validation | `33461498793` | success |
| Build 026 activation-guide validation | `33461498707` | success |
| Visual QA Screenshots | `33461498790` | success |
| Sync fitness reference data | `33461498735` | success |
| Pages build and deployment | `33461498107` | success |

Reference sync did not advance `main` after Build 026.

## Current product surface

Daily iPhone navigation:

**Today · Train · Fuel · Adventure · Progress**

Devices, private sync, backup, source verification, private-account self-test and the Activation Guide live under Settings rather than occupying a daily navigation slot.

Current visual system:

- light/cool-neutral application background
- white/slate surfaces
- cobalt blue primary actions
- teal health/recovery/sync accents
- restrained violet/amber RPG/reward accents
- iPhone safe-area support
- PWA/Home Screen metadata and versioned offline shell

The older dark/neon-lime Build 006 layer remains historical implementation underneath later overrides; it is not the current product theme.

## Functional systems

### Training

Implemented and software-verified:

- Home / Apartment Gym / Full Gym context
- Quick / Standard / Full durations
- automatic Full Body A/B selection based on completed history
- training-intent-based exercise resolution and same-location substitutions
- guided set-by-set execution
- load/repetition controls
- automatic rest timer
- skip/resume/substitute/instructions controls
- exercise-history projection
- adaptive rep/load progression
- conservative recovery adjustment from trusted HealthKit sleep/RHR/HRV evidence plus workout recency
- observed workout calories preferred when available; MET retained as fallback/reference
- authenticated workout session/set private continuity from Build 021

Build 021's cross-browser model contract verifies that two restored **35 lb × 12** top-range exposures still produce a **40 lb** next-load recommendation.

### Fuel

Implemented and software-verified:

- calories / protein / carbohydrate / fat logging
- day navigation
- recent foods
- saved meals
- Repeat Last
- quick nutrition-line parsing
- optional explicit nutrition targets
- Open Food Facts search and barcode lookup
- normalized `nutrition_entry` history
- saved-meal/target sync through user preferences
- deletion tombstones so removed food does not reappear

### Personal Intelligence

Implemented:

- actual latest weight + smoothed weight trend
- loaded/bodyweight personal records
- clearly labelled estimated 1RM where appropriate
- strength trends
- weekly review
- Then-vs-Now summary
- recovery/training associations when enough evidence exists
- explainable recommendations and confidence labels
- Fuel logging context
- progress-photo session context

No weight-loss direction or calorie target is inferred automatically.

### Adventure

Implemented:

- automatic progression
- 4-stage production zones
- ordinary enemies and bosses
- persistent player HP through expeditions
- Strength / Endurance / Consistency / Recovery / Nutrition as real game capabilities
- raw vs effective gear power with a real-world fitness ceiling
- weapons / armor / charms
- coins / materials / loot
- auto-equip
- capability gates
- combat-defeat walls
- content-complete wall
- visual player-vs-enemy battlefield
- stage path / gear / progression guidance

Adventure does not create permanent Fitness XP.

### Progress photos

Implemented and software-verified through Build 022:

- front / side / back capture
- camera or photo-library input
- alignment controls
- ghost overlay
- local IndexedDB blob storage
- private Supabase `progress-photos` bucket
- RLS-protected photo session/asset metadata
- authenticated upload/download/delete software path
- deletion tombstones
- user-ID-prefixed Storage paths
- local `side` ↔ remote `other` schema bridge with `metadata.local_view = "side"`
- raw images excluded from JSON backup
- dedicated iPhone Photos-tab visual regression screenshot

Human two-browser blob round-trip remains a Build 020 acceptance action, not a software-implementation gap.

## Acceptance instrumentation

### Build 024 — private-account infrastructure self-test

Implemented and software-verified:

- appears only for an authenticated private-sync session
- uses the public Supabase publishable key plus the real authenticated user JWT; no privileged key
- verifies authenticated account identity
- verifies anonymous application-table REST access is rejected
- exercises normalized-event insert → select → update → delete
- snapshots, writes, reads and restores the existing user-preferences row
- exercises linked workout-session/workout-set insert/read/update/delete behavior
- exercises progress-photo session/asset ownership and Storage-path metadata
- uploads a tiny object to `progress-photos/<user>/acceptance/...`, downloads it, deletes it and confirms it is no longer readable
- cleans synthetic probes even after failures
- runs the real fully wrapped `Sync now` pipeline only after probe cleanup
- persists `settings.zero2fit_acceptance_v1` only after every infrastructure check passes
- records a local per-browser result

Build 024 is intentionally **one-browser infrastructure acceptance**. It is stronger than a unit test, but it is not proof that actual Fuel/workout/photo data reconstructed on another browser.

### Build 026 — cross-browser + physical Activation Guide

Implemented and software-verified:

- always-visible **Activation Guide** under Devices
- reads the Build 024 cloud marker as its infrastructure prerequisite rather than duplicating Build 024 probes
- tracks **10 real-account acceptance checkpoints + 5 physical-device checkpoints**
- assigns each browser a random local instance ID; no user-agent/device fingerprinting is stored
- authenticated browsers publish one stable `acceptance_browser_snapshot` through the existing RLS-protected normalized-event path
- browser snapshots contain counts/statuses/signatures only; they do not publish weight, food names, heart-rate values, sleep values or other health measurements
- compares two browser snapshots to establish Fuel reconstruction, Fuel deletion propagation, workout-history reconstruction/matching signatures, photo upload→other-browser download and photo deletion propagation
- keeps second-browser adaptive-target confirmation as explicit human evidence because matching history alone cannot prove the rendered recommendation was visually checked
- keeps source-app→Apple Health→Zero2Fit value parity, physical HealthKit background delivery and RENPHO underside-model label as explicit physical evidence
- manual acceptance evidence never creates source verification records and never creates Fitness XP or RPG progression
- exact Zepp/RENPHO bundle verification remains the only source-mapping authority for permanent device XP
- dedicated iPhone Activation Guide screenshot is part of the permanent visual-regression suite

Build 026 makes the remaining acceptance work measurable; it does **not** fabricate the real account, second browser or physical-device evidence.

## Reference data

Current generated catalogs:

| Dataset | Current count |
|---|---:|
| Source exercises | **876** |
| Training exercises | **876** |
| Source bodyweight/body-only | **188** |
| Home-compatible | **147** |
| Apartment Gym-compatible | **402** |
| Full Gym-compatible | **876** |
| Official-PDF MET activities | **1,111** |

Apartment Gym equipment includes the confirmed full dumbbell set plus photo-verified cable/Smith/machine/cardio/bench/pull-up/dip/stability-ball equipment.

## Device ingestion / trust

Current intended data path:

```text
Amazfit Active 2 → Zepp → Apple Health / HealthKit → Zero2FitHealthBridge
RENPHO scale → RENPHO Health → Apple Health / HealthKit → Zero2FitHealthBridge
```

Historical RENPHO CSV and Apple Health XML import paths remain supported.

Permanent device-driven Fitness XP requires:

- `source_provider = healthkit_bridge`
- verified native transport metadata
- exact source bundle ID present
- explicit Zero2Fit source verification record
- source verification status `verified`

Apple Health/source-name text or a Build 026 manual checkbox alone is never sufficient authorization for permanent Fitness XP.

## Supabase / private storage

Connected project: `guxdnxnqzhkidtastsfb`

Verified security state:

- application data is protected by authenticated per-user RLS
- browser/iOS clients use only the public publishable key
- no service-role/secret key is committed to the public app
- private `progress-photos` bucket uses user-folder Storage RLS
- workout and photo tables have authenticated CRUD grants plus own-user policies

Active Edge Functions:

- `food-lookup` — version 1 — **ACTIVE**

Latest live personal-data counts checked **September 1, 2026 after Build 026 deployment**:

| Resource | Rows/users |
|---|---:|
| Auth users | **0** |
| User preferences | **0** |
| Normalized events | **0** |
| Workout sessions | **0** |
| Workout sets | **0** |
| Progress-photo sessions | **0** |
| Progress-photo assets | **0** |
| Device source observations | **0** |
| Device source verifications | **0** |

This zero-data state is why software-private-sync completeness must not be described as human-UAT-complete.

## Build 020 — required real-account acceptance

**Status: pending, now fully instrumented by Builds 024 and 026.**

A real Zero2Fit personal account still needs to be created through the application. Do not invent credentials in development automation.

Required acceptance sequence:

1. create/sign into the real private account on browser/device A;
2. run **Run private-store self-test** / Build 024 and require every infrastructure check to pass;
3. run **Run checks + sync** in the Build 026 Activation Guide so browser A publishes its acceptance snapshot;
4. log one manual food and one Open Food Facts item, save a meal and set explicit nutrition targets on A;
5. Sync Now;
6. sign into the same account on browser/device B, run the Build 024 self-test, then **Run checks + sync** in Build 026;
7. prove Fuel reconstruction on B;
8. delete an entry / clear a day on A and prove tombstones prevent reappearance after bidirectional sync;
9. complete a workout on A, sync, prove set/load history reconstructs on B, and explicitly confirm the adaptive recommendation matches;
10. capture a progress photo on A, sync, retrieve it on B, delete it and prove blob + metadata deletion propagate;
11. require the Build 026 account checklist to reflect the completed evidence rather than manually declaring software-derived steps complete.

## Physical iPhone / HealthKit acceptance

**Status: pending.**

Required physical-device evidence:

1. exact Zepp HKSource display name + bundle ID;
2. exact RENPHO Health HKSource display name + bundle ID;
3. metric categories each source actually writes;
4. representative parity through source app → Apple Health → Zero2Fit for:
   - steps
   - weight
   - body composition
   - heart rate
   - resting HR
   - HRV
   - sleep/stages
   - workouts
   - active energy
5. physical background-delivery behavior;
6. RENPHO underside model label.

The Build 026 guide displays these checkpoints and can store the explicitly human-observed acceptance state, but it cannot discover those physical facts by itself.

Until those checks occur, Zepp/RENPHO source mappings must remain unverified for permanent device XP.

## Verification automation

Current complementary gates include:

- full `Validate Zero2Fit` regression/browser workflow
- Build 022 focused photo-sync validation
- Build 024 private-account acceptance harness validation
- Build 026 activation-guide model/wiring validation
- **15 deterministic visual screenshots**, including dedicated iPhone Photos and Activation Guide captures, with one bounded fresh-profile retry for transient Chrome failures
- fitness reference-data sync/normalization with commit-on-change only
- native HealthKit bridge simulator compilation
- GitHub Pages build/deployment on `main`

## Deferred until real usage accumulates

Do not prioritize these before Build 020 + physical-device acceptance unless direction is explicitly changed:

- Garmin/Fitbit integrations
- co-op/PvP
- another major visual redesign
- substantially more Personal Intelligence algorithms

The preferred next cycle after activation is:

**Use → Measure → Tune**

Use actual workout history to refine load progression/substitution preferences, actual nutrition history to improve Fuel shortcuts, and actual Adventure stalls/deaths to tune game difficulty.
