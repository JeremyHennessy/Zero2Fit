# Zero2Fit — Build 003

## Preserved baseline

- repository: `JeremyHennessy/Zero2Fit`
- base branch: `main`
- Build 002 baseline: `1318e8f84806c8d3ad23b27dc14d13347ef9f1ca`
- Build 002 purpose: automatic location-aware workout intelligence
- Build 003 branch: `build-003-storage-device-ingestion`

Build 003 was restarted from this baseline after a concurrent older branch was found to conflict with the newly merged workout system. The outdated draft PR was closed without merge rather than overwriting Build 002.

## Scope

1. Preserve/reuse Build 002 exercise and workout intelligence.
2. Add structured local data/storage architecture.
3. Add Amazfit/RENPHO import and future HealthKit bridge boundary.

## Build 002 retained unchanged

Build 003 does not replace:

- `training-core.mjs`
- generated 873-exercise training catalog
- 2024 Adult Compendium MET catalog
- Home / Apartment Gym / Full Gym profiles
- location-aware workout generator
- substitution ranking
- unavailable-movement handling
- MET energy estimator
- monthly fitness-reference sync workflow

## Build 003 additions

- IndexedDB structured stores
- normalized event contract
- local state mirroring without changing the Build 002 app engine
- manual weight/step/workout event capture for later changes
- RENPHO CSV import
- Apple Health XML import
- normalized JSON bridge import
- provenance/confidence classes
- Apple raw-step safeguard
- JSON backup export
- target Supabase/RLS schema
- private progress-photo storage definition
- device-ingestion tests
- expanded browser/CI checks

## Explicitly not complete

- Supabase is not connected/authenticated.
- No native HealthKit companion exists yet.
- Automatic Zepp/RENPHO sync is therefore not active.
- Exact RENPHO underside model remains unverified.
- Apartment-gym equipment remains pending photos from the existing Build 002 plan.
- Imported workouts do not award Fitness XP.
- IndexedDB is not yet the canonical application-state store.

## Merge gates

Before merge to `main`:

- JavaScript syntax checks
- existing fitness-catalog validation
- existing workout-planner tests
- device-ingestion tests
- private-credential pattern check
- headless-browser smoke check confirming Build 002 and Build 003 UI both render
- diff review proving Build 002 training files were not replaced
- GitHub Actions green

The existence of a commit or PR is not sufficient evidence of completion.
