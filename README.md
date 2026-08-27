# Zero2Fit

Personal fitness, nutrition, workout and progression tracker hosted on GitHub Pages.

Zero2Fit is intentionally a **one-person app**, not a commercial SaaS product. Real fitness data remains primary; RPG mechanics summarize and reward real actions rather than replacing them.

## Build 002 — data, workouts and device ingestion

Build 002 is currently developed on `build-002-data-workouts-devices` from the preserved Build 001 baseline `b4d3480d8e7d2187dd4f96f291e7ef7dabe39727`.

### Data/storage

- Build 001 localStorage compatibility
- IndexedDB v2 structured local storage
- normalized event timeline with provenance/confidence
- import history and portable JSON backup
- target Supabase/Postgres schema with user-owned RLS
- private progress-photo storage policy definition
- **no Supabase project or private credentials connected yet**

### Exercise/workout system

- 36-exercise initial catalog
- movement-pattern templates
- Quick / Standard / Full modes
- Home / Apartment Gym / Full Gym location profiles
- equipment-aware exercise substitutions
- apartment equipment remains deliberately unassumed until photos are inventoried
- estimated fallback energy expenditure for strength sessions; wearable/device energy should supersede it when available

### Device ingestion

- Amazfit Active 2 (Round) architecture: Zepp → Apple Health → future HealthKit companion → Zero2Fit
- RENPHO CSV import for weight/body-composition history
- Apple Health `export.xml` import for supported measurement/workout records
- normalized JSON import contract for a future HealthKit bridge
- raw Apple Health StepCount records are retained but do not overwrite daily steps unless the bridge marks a record as an aggregated daily total
- imported workouts do not automatically award Fitness XP yet

The user reports the RENPHO model as ES-20M. RENPHO documentation reviewed for Build 002 lists ES-CS20M; the hardware label is still pending verification.

## Build 001 baseline

Build 001 established:

- responsive Today dashboard
- recoverable Momentum score
- daily quest board with XP
- RPG character level and attributes
- Quick / Standard / Full workout modes
- set-by-set workout tracking
- manual weight and steps
- calorie/protein food log
- Journey view and progress history
- Data/provenance view
- browser localStorage persistence
- GitHub Pages deployment workflow

## Run locally

No build step is required.

```bash
python -m http.server 8080
```

Open `http://localhost:8080/`.

## Validation

```bash
node --check app.js
node --check storage.js
node --check ingestion.js
node --check data/exercises.js
node tests/smoke.js
```

## Deployment

`.github/workflows/pages.yml` deploys the repository root to GitHub Pages after pushes to `main` once GitHub Pages is configured to use GitHub Actions as its publishing source.

Expected production URL:

`https://jeremyhennessy.github.io/Zero2Fit/`

Build 002 should not be merged to `main` until CI and UI/interaction regression checks pass.

## Architecture documentation

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)
- [`docs/DATA_STORAGE_ARCHITECTURE.md`](docs/DATA_STORAGE_ARCHITECTURE.md)
- [`docs/WORKOUT_SYSTEM.md`](docs/WORKOUT_SYSTEM.md)
- [`docs/DEVICE_INGESTION.md`](docs/DEVICE_INGESTION.md)
- [`docs/BUILD_002.md`](docs/BUILD_002.md)
