# Zero2Fit

Personal fitness, nutrition, workout and RPG-style progression system hosted on GitHub Pages.

Zero2Fit is intentionally a **one-person app**. The product should automate routine fitness decisions when reliable data exists, preserve source provenance and assumptions, and keep permanent fitness progression tied to real-world actions.

For the concise production checkpoint and acceptance boundaries, see [`CURRENT_STATE.md`](CURRENT_STATE.md).

## Current experience

Zero2Fit currently provides:

- a bright, clean responsive iPhone + desktop interface using cool neutral surfaces, cobalt-blue primary actions, teal health/recovery accents and restrained RPG colors
- **Today / Train / Fuel / Adventure / Progress** as the daily iPhone destinations, with Devices/private sync available from Settings
- PWA/Home Screen metadata, versioned offline shell and iPhone safe-area handling
- Momentum, permanent Fitness XP, character attributes, milestones and long-term objectives
- automatic Adventure combat/progression with enemies, bosses, loot, equipment, materials and persistent progression walls
- a real-world capability ceiling so powerful game gear cannot carry a weak real-world fitness base
- Quick / Standard / Full workout modes
- automatic Full Body A/B selection from completed history
- location-aware workouts for **Home / Apartment Gym / Full Gym**
- confirmed Apartment Gym equipment support, including the full dumbbell set
- same-location exercise substitutions by training intent, movement pattern, target muscles and available equipment
- guided set-by-set workout execution with load/repetition steppers, automatic rest timing, skip/substitute/instructions controls and resume support
- adaptive next-workout prescriptions based on completed set/load history; loaded exercises progress only after the top of the assigned rep range is completed for two consecutive exposures at the same working load
- conservative recovery-aware prescription adjustments using only trusted/verified HealthKit sleep, resting-HR and HRV evidence plus workout recency
- observed device workout energy preferred for display when available, with MET energy retained as the explicit fallback/reference
- Personal Intelligence for smoothed weight trends, strength trends, PRs, weekly review, Then-vs-Now summaries and explainable recommendations
- Fuel 2.0 with daily navigation, calories/protein/carbohydrates/fat, recent foods, saved meals, Repeat Last, quick-line parsing and optional explicit targets
- Open Food Facts text search and barcode lookup through the deployed `food-lookup` Supabase Edge Function
- aligned front/side/back progress-photo capture with camera/library input, pose guide, alignment controls, ghost overlay and timeline
- structured localStorage + IndexedDB state, normalized events/imports and local photo blobs
- authenticated private Supabase sync with Row Level Security for normalized events, Fuel history/preferences, workout session/set history and progress-photo metadata/blobs
- RENPHO CSV, Apple Health XML and normalized HealthKit JSON import paths
- native iPhone HealthKit companion source under `ios/Zero2FitHealthBridge`
- exact HealthKit source-bundle observation plus explicit Zepp/RENPHO verification before device data can authorize permanent Fitness XP
- portable JSON backup that intentionally excludes raw progress-photo blobs
- GitHub Pages deployment plus automated data, browser, iOS and visual-regression validation

## Recent continuity builds

The current private-sync architecture was expanded in controlled layers:

- **Build 017 — Fuel 2.0:** richer nutrition history, macros, saved/recent meals, Repeat Last, explicit targets and structured nutrition events.
- **Build 018 — food lookup:** Open Food Facts search/barcode ingestion through the `food-lookup` Edge Function without search-as-you-type provider abuse.
- **Build 019 — Fuel private sync:** nutrition history joins normalized events; saved meals and explicit targets use the existing user-preferences row; deletion tombstones prevent removed entries from reappearing.
- **Build 020 — real-account activation:** intentionally reserved for real authenticated acceptance testing. This remains pending because no personal account has yet been created through the app.
- **Build 021 — workout private continuity:** completed workout sessions and set/load history use the existing RLS-protected workout tables. Deterministic testing proves restored history still drives the adaptive next-load recommendation.
- **Build 022 — progress-photo private continuity:** aligned photo blobs and metadata use the existing private `progress-photos` bucket and RLS-protected photo tables; deletion tombstones prevent removed photos from reappearing on another browser.

Builds 021 and 022 implement the software continuity layer. Their true two-browser authenticated acceptance is still part of Build 020 and must use the real personal account rather than invented credentials.

## Device path — HealthKit bridge

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

The native bridge deliberately does **not** guess vendor bundle identifiers. It captures exact HealthKit source names/bundle IDs from the physical iPhone into `device_source_observations`. The Devices page requires explicit verification of the exact matching bundle before those bridge events can participate in permanent device Fitness XP.

An Apple Health import whose `sourceName` merely contains `Zepp`, `Amazfit`, `Apple Watch` or `iPhone` is **not** trusted for permanent progression.

See:

- [`docs/DEVICE_INGESTION.md`](docs/DEVICE_INGESTION.md)
- [`docs/DATA_STORAGE_ARCHITECTURE.md`](docs/DATA_STORAGE_ARCHITECTURE.md)
- [`docs/BUILD_008_DEVICE_SYNC.md`](docs/BUILD_008_DEVICE_SYNC.md)
- [`ios/Zero2FitHealthBridge/README.md`](ios/Zero2FitHealthBridge/README.md)

## Private storage

The connected Supabase project uses authenticated Row Level Security. Application rows are user-owned; browser/iOS code contains only the public Supabase publishable client key, never a service-role/secret key.

The deployed private architecture includes:

- normalized events
- source observations and explicit source verifications
- user preferences
- import runs
- workout sessions and workout sets
- RPG state / Fitness XP ledger tables reserved in the schema
- progress-photo sessions and assets
- private `progress-photos` Storage bucket with user-folder RLS

Fuel, workout and photo continuity reuse these existing tables/bucket rather than creating parallel cloud stores.

At the latest live acceptance check, the Supabase project still contained **0 auth users and 0 personal user-data rows**. That is intentional evidence that software implementation is ahead of real-account activation; private sync must not be described as human-UAT-complete until Build 020 is exercised with the real account.

The live Supabase security advisor reports no security lints.

## Researched fitness reference data

### Exercise intelligence

Source: [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db), Unlicense/public domain.

Current canonical catalog:

- **876 source exercises**
- **188** source entries marked bodyweight/body-only
- **147** confirmed Home-compatible exercises after hidden apparatus requirements are resolved
- **402** Apartment Gym-compatible exercises after confirmed equipment resolution
- **876** Full Gym-compatible exercises

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
- official website reconciliation by five-digit code
- discrepancies preserved explicitly rather than silently overwritten

Standard gross estimate:

`MET × body mass (kg) × duration (minutes) / 60`

Device-observed workout energy remains separate observed evidence and is preferred for presentation when a verified match exists; MET remains the fallback/reference.

See [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

## Training behavior

Workout templates specify training intent rather than hard-coded exercise names. A slot such as `vertical_pull_lats` is resolved against the selected location and available equipment.

Automatic strength selections must be **good match or better**. Unsupported slots are shown as unavailable rather than filled with unrelated movements. The **Substitute** action returns other valid same-location matches.

Adaptive progression uses the same stored set/load history that Build 021 now mirrors to the private workout tables. A cross-browser contract test verifies that two restored 35 lb × 12 top-range exposures still produce a 40 lb next-load recommendation.

## RPG integrity

Real fitness activity is the authority for permanent Fitness XP/attributes. Adventure progression can award game gear/materials but cannot fabricate Fitness XP.

Device-based permanent progression requires a verified native source mapping and continues to use date/duration/deduplication/per-day safeguards. Historical imports do not retroactively create game progression.

## Progress photos

Raw progress photos remain outside the public repository and outside ordinary JSON backup files.

The browser keeps a local IndexedDB copy for fast private use. Build 022 additionally supports authenticated private upload/download/delete through the private Supabase `progress-photos` bucket, with metadata in `progress_photo_sessions` / `progress_photo_assets` and deletion tombstones in the normalized event timeline.

The local `side` view is represented remotely using the existing allowed `other` value plus `metadata.local_view = "side"`, so no schema migration was required and round-trip restores the original local view.

Software support is complete; real two-browser upload/download/delete acceptance still waits for Build 020 account activation.

## Verification automation

The repository currently uses multiple complementary gates:

- `.github/workflows/validate.yml` — full syntax, credential-pattern, reference-data, planner, adaptive workout, guided execution, Fuel, food lookup, Personal Intelligence, device trust, private sync, workout continuity, Adventure, photo helpers, UI contract and browser-smoke validation
- `.github/workflows/validate-build022-photo-sync.yml` — focused progress-photo path/RLS/client-contract/tombstone validation
- `.github/workflows/visual-qa.yml` — **14 deterministic screenshots**, including a dedicated iPhone Progress → Photos screen, with one bounded fresh-profile retry for transient headless-Chrome failures
- `.github/workflows/sync-fitness-data.yml` — monthly/manual source refresh and normalization with commit-on-change only
- `.github/workflows/validate-healthkit-bridge.yml` — XcodeGen generation and iOS simulator compilation for the native HealthKit companion
- GitHub Pages build/deploy on `main`

## Run the web app locally

No package installation or frontend build step is required.

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Deployment

GitHub Pages publishes the repository root from `main`.

Live target:

`https://jeremyhennessy.github.io/Zero2Fit/`

## Acceptance still required

### Build 020 — real private account

The real account must be created through Zero2Fit, then exercised end-to-end with a second browser/session:

1. sign up / sign in;
2. log a manual food and an Open Food Facts item;
3. save a meal and set explicit nutrition targets;
4. Sync Now and reconstruct the data in a second browser;
5. delete a food / clear a day and prove the tombstone prevents reappearance;
6. complete a workout and prove its set/load history follows the account and still drives the same adaptive recommendation;
7. capture/sync/delete a progress photo and prove private blob + metadata continuity in both directions.

### Physical iPhone / HealthKit

Software/simulator validation cannot establish what the real iPhone contains. Before native device data is allowed to drive permanent progression, the physical device must establish:

1. the exact Zepp HealthKit source name/bundle ID and metric categories actually written;
2. the exact RENPHO Health source name/bundle ID and metric categories actually written;
3. representative value agreement through source app → Apple Health → Zero2Fit for steps, weight/body composition, heart rate, resting HR, HRV, sleep, workouts and active energy;
4. physical-device background delivery;
5. the RENPHO underside model label.

Until those checks occur, source names remain evidence only and unverified native device records cannot earn permanent device Fitness XP.
