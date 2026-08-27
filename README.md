# Zero2Fit

Personal fitness, nutrition, workout and RPG-style progression tracker hosted on GitHub Pages.

Zero2Fit is intentionally a **one-person app**. It is built around one rule: routine fitness decisions should be automated when reliable data exists, while the underlying source and assumptions remain inspectable.

## Current capabilities

- responsive Today dashboard
- recoverable Momentum score, XP, character attributes, milestones and boss objectives
- Quick / Standard / Full workout modes
- automatic Full Body A/B workout generation
- location-aware workouts for **Home / Apartment Gym / Full Gym**
- automatic same-location exercise substitutions based on training intent, muscle group, movement pattern and available equipment
- set-by-set workout tracking
- automatic workout-duration and MET-based calorie estimates when a body weight is available
- manual weight/steps/food entry
- structured IndexedDB snapshots/events/import history alongside the existing local app state
- RENPHO CSV, Apple Health XML and normalized HealthKit-bridge JSON import paths
- portable local JSON backup
- Journey and data/provenance views
- GitHub Pages deployment

## Build 003 — storage + device ingestion

Build 003 is intentionally additive to Build 002. It is based on `1318e8f84806c8d3ad23b27dc14d13347ef9f1ca` and does not replace the researched workout engine.

### Local storage architecture

The existing application continues to use `localStorage` for its active state so the approved Build 002 runtime is not rewritten during this integration. Build 003 adds IndexedDB stores for:

- state snapshots
- normalized health/fitness events
- import history
- future device connection records
- future progress-photo metadata

Later local app-state changes are mirrored into IndexedDB and new manual weight/step/workout activity is normalized into structured events when detected.

### Device paths

**Amazfit Active 2 (Round)**

`Amazfit → Zepp → Apple Health → future native HealthKit companion → Zero2Fit`

**RENPHO scale**

`RENPHO → RENPHO Health → Apple Health → future HealthKit companion → Zero2Fit`

and for history/import:

`RENPHO Health CSV → Zero2Fit normalized event import`

The user reports the scale as ES-20M. RENPHO documentation reviewed for this work lists ES-CS20M in the relevant family; the underside model label remains pending verification.

Build 003 also accepts an extracted Apple Health `export.xml`. This is a migration/diagnostic path, not a substitute for a native HealthKit companion.

Raw Apple Health StepCount events are stored but do not overwrite the daily step total unless a future bridge explicitly marks the event as an aggregated `daily_total`. Imported workouts also do not award Fitness XP yet; deduplication and verification must exist first.

### Future private cloud target

`supabase/schema.sql` defines the planned authenticated/RLS-protected schema and private progress-photo bucket. **No Supabase project, cloud account or private credential is connected by Build 003.**

See:

- [`docs/DATA_STORAGE_ARCHITECTURE.md`](docs/DATA_STORAGE_ARCHITECTURE.md)
- [`docs/DEVICE_INGESTION.md`](docs/DEVICE_INGESTION.md)
- [`docs/BUILD_003.md`](docs/BUILD_003.md)

## Researched fitness reference data

Build 002 maintains reproducible reference catalogs in the repository rather than requiring a manual exercise or calorie-burn library.

### Exercise intelligence

Source: [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db), Unlicense/public domain.

Current generated catalog:

- **873 exercises**
- **188** upstream entries marked bodyweight/body-only
- **147 confirmed Home-compatible exercises** after Zero2Fit resolves hidden apparatus requirements
- **873 Full Gym-compatible exercises**

The 188 and 147 counts are intentionally different. An upstream exercise can say `body only` while still requiring a pull-up bar, dip station, bench, chair, box, low bar, anchor or similar apparatus. `data/generated/training_exercises.json` stores those derived requirements explicitly, and the location-aware planner uses that apparatus-resolved catalog.

### Energy / calorie estimates

Source: **2024 Adult Compendium of Physical Activities**.

Current canonical catalog:

- **1,111 identifiable official activity codes** from the downloadable 2024 Compendium PDF
- current official website reconciled against the PDF by five-digit activity code
- one current PDF-vs-website MET disagreement preserved explicitly rather than silently resolved

For standard adult MET values Zero2Fit estimates gross workout energy as:

`MET × body mass (kg) × duration (minutes) / 60`

Workout calories are always labeled as estimates. A connected-device energy measurement should later be preserved separately as an observed value rather than overwritten by the estimate.

See [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) for exact source versions, reconciliation, formulas and validation rules.

## Training locations

### Home

Confirmed equipment profile:

- bodyweight
- yoga mat
- ordinary wall

Zero2Fit does not assume a chair, bench, pull-up bar, band, anchor or weights. The current researched catalog therefore has **no good-or-better true horizontal-pull or lat-pull strength substitute at Home**. Those slots are shown as unavailable instead of being replaced with an unrelated exercise or stretch.

### Apartment Gym

Equipment profile status: **pending photos**.

Until the gym is visually inventoried, Zero2Fit deliberately inherits the conservative Home-safe equipment profile. Equipment will be identified from the user's photos and added to the repository profile; the user should not need to type a machine list.

### Full Gym

Uses a generic standard full-gym inventory including free weights, machines, cable stations and common training apparatus. The profile can later be narrowed to a specific gym without changing workout-history records.

## Automatic workout selection

Workout templates describe **training intent**, not hard-coded exercise names. For example, a slot can request `vertical_pull_lats`; the planner then selects the best available exercise for the current location.

Automatic strength selections must be **good match or better**. A partial/fallback match is not silently inserted. If the selected location cannot support the movement, the app says so and excludes the unavailable slot from workout-completion scoring.

Users can still tap **Substitute** to choose among other good/direct same-location matches without managing equipment metadata themselves.

## Data refresh and verification

`.github/workflows/sync-fitness-data.yml` can be run manually and also refreshes the reference catalogs monthly. It:

1. fetches and normalizes the exercise source;
2. downloads/parses the official 2024 Adult Compendium PDF;
3. reconciles the current Compendium webpages;
4. derives hidden apparatus requirements and location compatibility;
5. removes volatile generated metadata;
6. validates catalog integrity;
7. tests real generated Home/Apartment/Full Gym workouts;
8. runs the static app in headless Chrome and checks that researched workout data actually renders.

Generated data is committed only when normalized source content changes.

## Run locally

No package install or build step is required.

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Deployment

`.github/workflows/pages.yml` deploys the repository root to GitHub Pages after pushes to `main`.

Expected URL:

`https://jeremyhennessy.github.io/Zero2Fit/`

## Data/privacy architecture

Health measurements, device exports, backups and future progress photos must remain outside the public repository. Browser-local data is currently active; future cloud sync must use authenticated private storage and Row Level Security without embedding service-role credentials in GitHub Pages.

See [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md), [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md), [`docs/DATA_STORAGE_ARCHITECTURE.md`](docs/DATA_STORAGE_ARCHITECTURE.md), and [`docs/DEVICE_INGESTION.md`](docs/DEVICE_INGESTION.md).
