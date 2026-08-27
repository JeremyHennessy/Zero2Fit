# Zero2Fit — Build 002

## Baseline

- repository: `JeremyHennessy/Zero2Fit`
- baseline branch: `main`
- pre-change baseline commit: `b4d3480d8e7d2187dd4f96f291e7ef7dabe39727`
- baseline commit timestamp: `2026-08-27T14:51:28Z`
- working branch: `build-002-data-workouts-devices`

Build 002 is intentionally isolated from `main` until validation and review are complete.

## Scope

1. Data/storage architecture
2. Exercise/workout system
3. Amazfit Active 2 + RENPHO ingestion foundation

## Implemented

### Data/storage
- IndexedDB schema v2
- Build 001 localStorage compatibility
- snapshot recovery path
- normalized event store
- import history
- JSON backup/export
- target Supabase/Postgres schema
- Row Level Security policy definitions
- private progress-photo bucket definition
- no cloud credentials embedded

### Workout system
- 36-exercise initial catalog
- movement-pattern templates
- Home / Apartment Gym / Full Gym profiles
- equipment-aware substitution engine
- Quick / Standard / Full variants
- device-preferred / MET-fallback energy-estimate architecture

### Device ingestion
- normalized event contract
- RENPHO CSV parser
- Apple Health export XML parser
- normalized HealthKit-bridge JSON parser
- data-confidence classifications
- daily-step aggregation safeguard
- import provenance and deduplication IDs

## Explicitly not claimed complete

- Supabase project connection/authentication has not been configured or verified.
- A native HealthKit companion has not been built yet.
- Automatic live Zepp or RENPHO synchronization is therefore not active yet.
- The exact RENPHO hardware label is still awaiting underside verification.
- Apartment gym equipment is still awaiting photo inventory.
- Device-imported workouts do not award Fitness XP yet.
- Production visual signoff is required before any merge to `main`.

## Verification gates

Before merge:

- JavaScript syntax checks
- smoke tests for workout substitutions and RENPHO normalization
- branch-to-baseline diff review
- GitHub Actions validation
- static UI load/interaction check
- visual-regression review against Build 001

A merge is not considered successful merely because files or commits exist; the branch must pass these gates first.
