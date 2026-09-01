# Zero2Fit — Current State

This file is the concise technical checkpoint for future Zero2Fit work. It distinguishes repository/software verification from real-account and physical-device acceptance.

## Production application checkpoint

**Last functional application build:** Build 022 — `75ad9e664b82405706302ccb80a5b6e47de2c678`

Build 023 is documentation-only and may place a newer commit on `main` without changing the application runtime. Use the Build 022 SHA above when comparing functional application behavior.

Production target:

`https://jeremyhennessy.github.io/Zero2Fit/`

Build 022 post-merge verification on the exact functional SHA:

| Gate | Run | Result |
|---|---:|---|
| Validate Zero2Fit | `33458760424` | success |
| Build 022 focused photo-sync validation | `33458760396` | success |
| Visual QA Screenshots | `33458760380` | success |
| Sync fitness reference data | `33458760299` | success |
| Pages build and deployment | `33458759720` | success |

Reference sync did not advance `main` after Build 022.

## Current product surface

Daily iPhone navigation:

**Today · Train · Fuel · Adventure · Progress**

Devices, private sync, backup and setup live under Settings rather than occupying a daily navigation slot.

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

Latest live personal-data counts before Build 023:

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

**Status: pending.**

A real Zero2Fit personal account still needs to be created through the application. Do not invent credentials in development automation.

Required acceptance sequence:

1. create/sign into the real private account;
2. log one manual food;
3. log one Open Food Facts item;
4. save a meal;
5. set explicit nutrition targets;
6. run Sync Now;
7. sign into a second browser/session and prove reconstruction;
8. delete an entry and clear a day, sync both directions and prove tombstones prevent reappearance;
9. complete a workout, sync, and prove set/load history and adaptive recommendation survive the second browser;
10. capture a progress photo, sync, retrieve it in the second browser, delete it and prove blob + metadata deletion propagate.

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
