# Zero2Fit

Personal fitness, nutrition, workout and RPG-style progression system hosted on GitHub Pages.

Zero2Fit is intentionally a **one-person app**. It should automate routine fitness decisions when reliable data exists, preserve source provenance and assumptions, and keep permanent fitness progression tied to real-world actions.

For the exact production checkpoint and outstanding acceptance boundaries, see [`CURRENT_STATE.md`](CURRENT_STATE.md).

## Current experience

Zero2Fit currently provides:

- a bright, clean responsive iPhone + desktop interface using cool-neutral surfaces, cobalt-blue primary actions, teal health/recovery accents and restrained RPG colors
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
- adaptive next-workout prescriptions based on completed set/load history
- conservative recovery-aware prescription adjustments using only trusted/verified HealthKit sleep, resting-HR and HRV evidence plus workout recency
- observed device workout energy preferred when available, with MET energy retained as the explicit fallback/reference
- Personal Intelligence for smoothed weight trends, strength trends, PRs, weekly review, Then-vs-Now summaries and explainable recommendations
- Fuel 2.0 with daily navigation, calories/protein/carbohydrates/fat, recent foods, saved meals, Repeat Last, quick-line parsing and optional explicit targets
- Open Food Facts text search and barcode lookup through the deployed `food-lookup` Supabase Edge Function
- aligned front/side/back progress-photo capture with camera/library input, pose guide, alignment controls, ghost overlay and timeline
- structured localStorage + IndexedDB state, normalized events/imports and local photo blobs
- authenticated private Supabase sync with Row Level Security for normalized events, Fuel history/preferences, workout session/set history and progress-photo metadata/blobs
- a signed-in Build 024 private-account self-test that verifies the live RLS/CRUD/Storage/sync path without privileged credentials and cleans its synthetic probes automatically
- a Build 026 **Activation Guide** that tracks actual two-browser continuity plus physical HealthKit/hardware acceptance without weakening the device trust boundary
- a Build 028 **Physical HealthKit evidence** matrix that structures source-bundle and per-metric parity evidence before exact Zepp/RENPHO verification is allowed
- RENPHO CSV, Apple Health XML and normalized HealthKit JSON import paths
- native iPhone HealthKit companion source under `ios/Zero2FitHealthBridge`
- exact HealthKit source-bundle observation plus explicit Zepp/RENPHO verification before device data can authorize permanent Fitness XP
- portable JSON backup that intentionally excludes raw progress-photo blobs
- GitHub Pages deployment plus automated data, browser, iOS and visual-regression validation

## Recent continuity and acceptance builds

- **Build 017 — Fuel 2.0:** richer nutrition history, macros, saved/recent meals, Repeat Last, explicit targets and structured nutrition events.
- **Build 018 — food lookup:** Open Food Facts search/barcode ingestion through the `food-lookup` Edge Function without search-as-you-type provider abuse.
- **Build 019 — Fuel private sync:** nutrition history joins normalized events; saved meals and explicit targets use the existing user-preferences row; deletion tombstones prevent removed entries from reappearing.
- **Build 020 — real-account activation:** intentionally reserved for actual authenticated acceptance. It remains pending until a real private account is created in the app.
- **Build 021 — workout private continuity:** completed workout sessions and set/load history use the existing RLS-protected workout tables. Deterministic testing proves restored history still drives the adaptive next-load recommendation.
- **Build 022 — progress-photo private continuity:** aligned photo blobs and metadata use the existing private `progress-photos` bucket and RLS-protected photo tables; deletion tombstones prevent removed photos from reappearing.
- **Build 024 — private-account infrastructure self-test:** self-cleaning authenticated probes cover identity, anonymous-access rejection, normalized-event CRUD, preferences preservation, workout tables, photo metadata, private Storage and the fully wrapped Sync Now pipeline. The cloud marker is written only after every probe passes.
- **Build 026 — cross-browser + physical Activation Guide:** reads the Build 024 cloud marker, publishes privacy-minimized per-browser acceptance snapshots, compares two browsers for Fuel/workout/photo reconstruction and deletion propagation, and separates software-derived acceptance from physical-device evidence.
- **Build 028 — structured HealthKit evidence gate:** maps the exact observed HealthKit bundle candidates to a provider-specific parity matrix, blocks mismatched/unresolved sources, requires Zepp Steps and RENPHO Weight as physical anchors, stores status/source evidence without the compared health values, and only then permits the separate exact-source verification action.

Builds 019/021/022 implement the continuity layer. Build 024 verifies one-browser private infrastructure. Build 026 makes the remaining two-browser acceptance measurable. Build 028 makes the physical source-verification evidence explicit and fail-closed. None of these builds invent the real account, source bundle IDs or physical-device evidence.

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

The native bridge deliberately does **not** guess vendor bundle identifiers. It captures exact HealthKit `source.name` and `source.bundleIdentifier` values from the physical iPhone and records per-bundle/per-metric source observations with sample counts and observation timestamps.

Build 028 then requires the actual observed bundle to be selected as the Zepp or RENPHO **candidate** and physically evaluated. Candidate selection is not verification. `Matched` is only valid when the bundle actually wrote that metric, `Not provided` is only valid when it did not, and any mismatch/unresolved row blocks verification. Zepp requires matched Steps; RENPHO requires matched Weight.

Only after the structured evidence is ready can the existing explicit Verify Zepp / Verify RENPHO action proceed. The evidence record is privately persisted first. The separate source-verification row remains the only route by which matching native events can qualify for permanent device Fitness XP.

An Apple Health import whose `sourceName` merely contains `Zepp`, `Amazfit`, `Apple Watch` or `iPhone` is **not** trusted for permanent progression. Build 026/028 acceptance state also does not itself create a verification record.

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

Build 024's acceptance harness uses only the publishable key + authenticated user JWT available to the ordinary browser app. Its probes are uniquely tagged, cleaned even after failures, and the existing preference row is restored before the real Sync Now pass. It persists `settings.zero2fit_acceptance_v1` only after all infrastructure checks pass.

Build 026 adds one `acceptance_browser_snapshot` per browser through the existing normalized-event path. The snapshot contains browser-random ID, counts/statuses/signatures and acceptance flags only—not food names, body measurements, heart-rate values, sleep values or other health measurements.

Build 028 adds `healthkit_acceptance_evidence` to the same private normalized-event timeline. That record stores source IDs and physical-check statuses, but not the numerical weight/HR/sleep/etc. values used for human comparison.

At the latest live check after Build 028, the Supabase project still contained **0 auth users and 0 personal user-data/source-observation/source-verification rows**. Software implementation therefore remains ahead of real-account activation.

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

Apartment Gym currently includes the confirmed full dumbbell set, Smith/cable trainer, pull-up and dip stations, adjustable bench, lat pulldown/low row, selectorized leg/shoulder/pec/rear-delt machines, Concept2 rower, treadmills, ellipticals and stability balls.

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

Adaptive progression uses the same stored set/load history that Build 021 mirrors to the private workout tables. A deterministic contract verifies that two restored 35 lb × 12 top-range exposures still produce a 40 lb next-load recommendation.

## RPG integrity

Real fitness activity is the authority for permanent Fitness XP/attributes. Adventure progression can award game gear/materials but cannot fabricate Fitness XP.

Device-based permanent progression requires a verified native source mapping and continues to use date/duration/deduplication/per-day safeguards. Historical imports, acceptance snapshots and physical evidence records do not retroactively create game progression.

## Progress photos

Raw progress photos remain outside the public repository and outside ordinary JSON backup files.

The browser keeps a local IndexedDB copy for fast private use. Build 022 additionally supports authenticated private upload/download/delete through the private Supabase `progress-photos` bucket, with metadata in `progress_photo_sessions` / `progress_photo_assets` and deletion tombstones in the normalized event timeline.

The local `side` view is represented remotely using the existing allowed `other` value plus `metadata.local_view = "side"`, so no schema migration was required and round-trip restores the original local view.

Software support is complete; human two-browser upload/download/delete evidence remains part of Build 020 activation.

## Verification automation

The repository currently uses multiple complementary gates:

- `.github/workflows/validate.yml` — full syntax, credential-pattern, reference-data, planner, adaptive workout, guided execution, Fuel, food lookup, Personal Intelligence, device trust, private sync, workout continuity, Adventure, photo helpers, UI contract and browser-smoke validation
- `.github/workflows/validate-build022-photo-sync.yml` — focused progress-photo path/RLS/client-contract/tombstone validation
- `.github/workflows/validate-build024-acceptance.yml` — focused private-account infrastructure self-test validation
- `.github/workflows/validate-build026-activation-guide.yml` — focused cross-browser/physical acceptance model and wiring validation
- `.github/workflows/validate-build028-healthkit-evidence.yml` — focused source/metric evidence, verification-gate and privacy validation
- `.github/workflows/visual-qa.yml` — **16 deterministic screenshots**, including dedicated iPhone Progress → Photos, Activation Guide and HealthKit-evidence screens, with one bounded fresh-profile retry for transient headless-Chrome failures
- browser smoke itself now uses one bounded fresh-profile retry when late-module sentinels are missing; the second attempt still fails on exact missing markers
- `.github/workflows/sync-fitness-data.yml` — source refresh/normalization with commit-on-change only
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

The live project currently has no auth user, so credentials still need to be chosen by the actual user rather than generated by development automation.

Once the account exists:

1. sign up / sign in on browser A;
2. run the Build 024 **private-store self-test** and require every infrastructure check to pass;
3. tap Build 026 **Run checks + sync** so browser A publishes its acceptance snapshot;
4. log a manual food and an Open Food Facts item, save a meal and set explicit nutrition targets, then Sync Now;
5. sign into the same account on browser B, run Build 024, then Build 026 **Run checks + sync**;
6. prove Fuel reconstruction on B;
7. delete food / clear a day and prove tombstones prevent reappearance after bidirectional sync;
8. complete a workout on A and prove set/load history reconstructs on B and the rendered adaptive recommendation matches;
9. capture/sync/delete a progress photo and prove private blob + metadata continuity/deletion in both directions;
10. use the Build 026 checklist as the evidence record instead of manually marking software-derived steps complete.

### Physical iPhone / HealthKit

Software/simulator validation cannot establish what the real iPhone contains. Build 028 now guides the physical sequence:

1. run the native HealthKit bridge on the real iPhone while signed into the real private account;
2. wait for exact source observations to appear;
3. select the actual Zepp and RENPHO candidate bundle IDs in the Build 028 matrix;
4. compare representative source-app → Apple Health → Zero2Fit values and resolve every relevant metric as Matched / Not provided / Mismatch;
5. require Zepp Steps and RENPHO Weight to be matched;
6. resolve every mismatch rather than overriding the gate;
7. confirm physical background delivery and enter the exact RENPHO underside model label;
8. only when the provider matrix reports ready, perform the separate explicit Verify Zepp / Verify RENPHO action;
9. private sync again and confirm the verification metadata is applied to matching native events.

Until those checks occur, source names remain evidence only and unverified native device records cannot earn permanent device Fitness XP.
