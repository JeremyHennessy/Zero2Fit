# Zero2Fit

Personal fitness, nutrition, workout and RPG-style progression system hosted on GitHub Pages.

Zero2Fit is intentionally a **one-person app**. Routine fitness decisions should be automated when reliable data exists, while observed values, derived values, source provenance and assumptions remain inspectable.

## Current capabilities

- approved responsive dark/high-contrast/lime mobile + desktop UI
- Today / Adventure / Train / Fuel / Progress / Devices experience
- Momentum, permanent Fitness XP, character attributes, milestones and boss objectives
- automatic Adventure combat/progression with enemies, loot, equipment and progression stalls driven by real fitness-derived capability
- Quick / Standard / Full workout modes
- automatic Full Body A/B generation
- location-aware workouts for **Home / Apartment Gym / Full Gym**
- photo/user-evidence-based Apartment Gym profile, including the confirmed full dumbbell set
- same-location exercise substitutions by training intent, muscle group, movement pattern and available equipment
- set-by-set workout tracking
- MET-based energy estimates with observed device workout energy preserved separately
- manual weight/steps/food entry
- localStorage active state + structured IndexedDB events/imports/progress photos
- RENPHO CSV, Apple Health XML and normalized HealthKit JSON import paths
- source-aware reconciliation for steps, workouts, sleep, resting HR, HRV and body-composition trends
- duplicate/historical-import protections around device progression
- local progress-photo capture/alignment/ghosting workflow
- authenticated private Supabase event sync with Row Level Security
- native iPhone HealthKit companion source under `ios/Zero2FitHealthBridge`
- exact HealthKit source-bundle observation + explicit Zepp/RENPHO source verification
- portable JSON backup without raw progress-photo blobs
- GitHub Pages deployment and automated browser/data/iOS validation

## Device path — Build 008

### Amazfit Active 2 (Round)

```text
Amazfit Active 2
  → Zepp
  → Apple Health / HealthKit
  → Zero2FitHealthBridge
  → private Supabase event store
  → Zero2Fit browser reconciliation
```

### RENPHO

```text
RENPHO scale
  → RENPHO Health
  → Apple Health / HealthKit
  → Zero2FitHealthBridge
  → private Zero2Fit store
```

Historical RENPHO CSV and Apple Health `export.xml` imports remain supported.

The native bridge deliberately does **not** guess vendor bundle identifiers. It captures exact HealthKit source names/bundle IDs from the physical iPhone into `device_source_observations`. The Devices page requires explicit verification of the matching bundle before the source can participate in permanent device Fitness XP.

An Apple Health import whose `sourceName` merely contains `Zepp`, `Amazfit`, `Apple Watch` or `iPhone` is **not** trusted for permanent progression.

See:

- [`docs/DEVICE_INGESTION.md`](docs/DEVICE_INGESTION.md)
- [`docs/DATA_STORAGE_ARCHITECTURE.md`](docs/DATA_STORAGE_ARCHITECTURE.md)
- [`docs/BUILD_008_DEVICE_SYNC.md`](docs/BUILD_008_DEVICE_SYNC.md)
- [`ios/Zero2FitHealthBridge/README.md`](ios/Zero2FitHealthBridge/README.md)

## Private storage

The connected Supabase project uses authenticated Row Level Security. Application tables are user-owned; anon has no application-table privileges; the browser/iOS clients contain only the public Supabase publishable client key, never a service-role/secret key.

Build 008 adds:

- normalized events
- source observations
- source verifications
- import runs
- workout sessions/sets
- RPG state/XP ledger
- progress-photo metadata
- private `progress-photos` bucket

The live Supabase security advisor reports no security lints. At implementation time the project contains zero auth users, so a personal account must be explicitly created/sign-in completed before private sync writes data.

## Researched fitness reference data

### Exercise intelligence

Source: [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db), Unlicense/public domain.

Current canonical source catalog:

- **873 exercises**
- **188** source entries marked bodyweight/body-only
- **147** confirmed Home-compatible exercises after hidden apparatus requirements are resolved
- **402** Apartment Gym-compatible exercises after the confirmed dumbbell set plus photo-verified stations are applied
- **873** Full Gym-compatible exercises

Home intentionally assumes only bodyweight, yoga mat and ordinary wall. It does not silently invent a chair, bench, pull-up bar, band, weight or anchor.

Apartment Gym currently includes:

- confirmed full dumbbell set
- HOIST Mi7Smith / cable functional trainer / Smith bar
- pull-up and dip stations
- adjustable bench
- selectorized lat pulldown / low row
- Life Fitness leg extension / seated leg curl
- Life Fitness shoulder press
- Life Fitness pec fly / rear delt
- Concept2 rower
- treadmills / elliptical trainers
- stability balls

Generic `machine` exercises remain capability-filtered so the presence of several machines does not unlock every machine exercise in the source catalog.

### Energy / calorie estimates

Source: **2024 Adult Compendium of Physical Activities**.

- **1,111 identifiable official activity codes** from the canonical downloadable PDF
- current official website reconciled by five-digit code
- discrepancies preserved explicitly rather than silently overwritten

Standard gross estimate:

`MET × body mass (kg) × duration (minutes) / 60`

Device-observed workout energy remains a separate observed field and is preferred for presentation when available; the MET estimate remains the fallback/reference.

See [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

## Training behavior

Workout templates specify training intent rather than hard-coded exercise names. A slot such as `vertical_pull_lats` is resolved against the selected location and available equipment.

Automatic strength selections must be **good match or better**. Unsupported slots are shown as unavailable rather than filled with unrelated exercises. The **Substitute** action returns other valid same-location matches.

## RPG integrity

Real fitness activity is the authority for permanent Fitness XP/attributes. Adventure progression can award game gear/materials but cannot fabricate Fitness XP.

Device-based permanent progression requires a verified native source mapping and continues to use date/duration/deduplication/per-day safeguards. Historical imports do not retroactively create game progression.

## Progress photos

Raw progress photos remain outside the public repository. Current browser storage keeps raw blobs locally in IndexedDB; JSON backups include metadata only. The Supabase schema contains a private `progress-photos` bucket for authenticated cloud photo storage, but raw-photo cloud upload remains a separate activation/verification step.

## Verification automation

`.github/workflows/validate.yml` checks:

- JavaScript syntax
- credential-pattern rejection
- reference-data integrity
- Home/Apartment/Full Gym workout generation
- device ingestion/reconciliation and permanent-XP trust gates
- private-sync contract
- Adventure engine
- progress-photo helpers
- UI compatibility contract
- headless-browser smoke behavior

`.github/workflows/sync-fitness-data.yml` refreshes the research catalogs monthly/manual and commits normalized changes only when source content changes.

`.github/workflows/validate-healthkit-bridge.yml` generates the iOS project with XcodeGen and compiles the HealthKit companion against the iOS simulator.

## Run web app locally

No package installation or frontend build step is required.

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Deployment

GitHub Pages publishes the repository root from `main` using GitHub's branch-based Pages workflow.

Expected URL:

`https://jeremyhennessy.github.io/Zero2Fit/`

## Physical-device verification still required

Software implementation and simulator/browser validation cannot establish the real HealthKit contents of the user's iPhone. Before verified native data is allowed to drive permanent progression, the physical device must establish:

1. the exact Zepp HealthKit source name/bundle ID and categories actually written;
2. the exact RENPHO Health source name/bundle ID and categories actually written;
3. representative value agreement against Zepp, RENPHO Health and Apple Health;
4. physical-device HealthKit background delivery;
5. the RENPHO underside model label.

Until those checks occur, native/imported data can inform trends and reconciliation but the unverified source cannot earn permanent device XP.
