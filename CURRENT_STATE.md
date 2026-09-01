# Zero2Fit — Current State

This file is the concise technical checkpoint for future Zero2Fit work. It distinguishes repository/software verification from real-account and physical-device acceptance.

## Production application checkpoint

**Last functional application build:** Build 024 — `6bf6531c08e21f0070a63e8ac5d72b242e6fca58`

Build 025 is documentation-only and may place a newer commit on `main` without changing the application runtime. Use the Build 024 SHA above when comparing functional application behavior.

Production target:

`https://jeremyhennessy.github.io/Zero2Fit/`

Build 024 post-merge verification on the exact functional SHA:

| Gate | Run | Result |
|---|---:|---|
| Validate Zero2Fit | `33460298228` | success |
| Build 024 focused private-acceptance validation | `33460298374` | success |
| Build 022 focused photo-sync validation | `33460298232` | success |
| Visual QA Screenshots | `33460298214` | success |
| Sync fitness reference data | `33460298243` | success |
| Pages build and deployment | `33460297789` | success |

Reference sync did not advance `main` after Build 024.

## Current product surface

Daily iPhone navigation:

**Today · Train · Fuel · Adventure · Progress**

Devices, private sync, backup, source verification and private-account acceptance live under Settings rather than occupying a daily navigation slot.

Current visual system:

- light/cool-neutral application background
- white/slate surfaces
- cobalt blue primary actions
- teal health/recovery/sync accents
- restrained violet/amber RPG/reward accents
- iPhone safe-area support
- PWA/Home Screen metadata and versioned offline shell

The older dark/neon-lime Build 006 style remains historical implementation underneath later override layers; it is not the current product theme.

## Functional systems

### Training

Implemented and software-verified:

- Home / Apartment Gym / Full Gym context
- Quick / Standard / Full durations
- automatic Full Body A/B selection based on actual completed history
- training-intent-based exercise resolution and same-location substitutions
- guided set-by-set execution
- load/repetition controls
- automatic rest timer
- skip/resume/substitute/instructions controls
- exercise-history projection
- adaptive rep/load progression
- conservative recovery adjustment from trusted HealthKit sleep/RHR/HRV evidence plus workout recency
- observed workout calories preferred when available; MET retained as fallback/reference
- authenticated workout session/set private continuity in Build 021

Build 021 cross-browser model contract verifies that two restored **35 lb × 12** top-range exposures still produce a **40 lb** next-load recommendation.

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

Human two-browser blob round-trip still belongs to Build 020.

### Build 024 private-account acceptance harness

Implemented and software-verified:

- appears only in the signed-in private-sync panel
- uses the public Supabase publishable key plus the real authenticated user JWT; no privileged key
- verifies authenticated account identity
- verifies anonymous application-table REST access is rejected
- exercises normalized-event insert → select → update → delete
- snapshots, writes, reads and restores the existing user-preferences row
- exercises linked workout-session/workout-set insert/read/update/delete behavior
- exercises progress-photo session/asset ownership and Storage-path metadata
- uploads a tiny object to `progress-photos/<user>/acceptance/...`, downloads it, deletes it and verifies it is no longer readable
- cleans synthetic probe data even if a check fails
- runs the real fully wrapped `Sync now` pipeline only after probe cleanup
- persists `settings.zero2fit_acceptance_v1` only after every infrastructure check passes
- records a local per-browser acceptance result

The harness is intentionally **one-browser infrastructure acceptance**. A second browser using the same real account is still required to prove account reconstruction/continuity. Because the live project still has zero auth users, the authenticated harness has not yet been human-executed.

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

Apple Health/source-name text alone is never sufficient authorization for permanent Fitness XP.

## Supabase / private storage

Connected project: `guxdnxnqzhkidtastsfb`

Verified security state:

- application data is protected by authenticated per-user RLS
- browser/iOS clients use only the public publishable key
- no service-role/secret key is committed to the public app
- security advisor: no security lints at the latest review
- private `progress-photos` bucket uses user-folder Storage RLS
- workout and photo tables have authenticated CRUD grants plus own-user policies

Active Edge Functions:

- `food-lookup` — version 1 — **ACTIVE**

Latest live personal-data counts after Build 024 deployment:

| Resource | Rows/users |
|---|---:|
| Auth users | **0** |
| User preferences | **0** |
| Normalized events | **0** |
| Workout sessions | **0** |
| Workout sets | **0** |
| Progress-photo sessions | **0** |
| Progress-photo assets | **0** |

This zero-data state is why software-private-sync completeness must not be confused with real-account acceptance.

## Build 020 — required real-account acceptance

**Status: pending, but now instrumented by Build 024.**

A real Zero2Fit personal account still needs to be created through the application. Do not invent credentials in development automation.

Required acceptance sequence:

1. create/sign into the real private account on browser/device A;
2. run **Run acceptance self-test** and require every Build 024 infrastructure check to pass;
3. sign into the same account on browser/device B and run the acceptance self-test there;
4. log one manual food and one Open Food Facts item, save a meal and set explicit nutrition targets on A;
5. run Sync Now and prove Fuel reconstruction on B;
6. delete an entry / clear a day and prove tombstones prevent reappearance after bidirectional sync;
7. complete a workout on A, sync and prove set/load history plus the adaptive recommendation survive on B;
8. capture a progress photo on A, sync, retrieve it on B, delete it and prove blob + metadata deletion propagate;
9. retain the Build 024 cloud acceptance marker as infrastructure evidence, separate from the human continuity evidence above.

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

Until those checks occur, Zepp/RENPHO source mappings must remain unverified for permanent device XP.

## Deferred until real usage accumulates

Do not prioritize these before Build 020 + physical-device acceptance unless the user explicitly changes direction:

- Garmin/Fitbit integrations
- co-op/PvP
- another major visual redesign
- substantially more Personal Intelligence algorithms

The preferred next cycle after activation is:

**Use → Measure → Tune**

Use actual workout history to refine load progression/substitution preferences, actual nutrition history to improve Fuel shortcuts, and actual Adventure stalls/deaths to tune game difficulty.