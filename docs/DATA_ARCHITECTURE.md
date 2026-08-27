# Zero2Fit private data architecture

## Goal

Keep the GitHub Pages application public while keeping personal fitness, health and progress-photo data private. Zero2Fit is a one-person application today, but records use a user owner key so future co-op/PvP does not require a destructive schema rewrite.

## Storage tiers

1. **GitHub Pages / repository** — application code plus non-personal reference catalogs only.
2. **Browser IndexedDB/localStorage** — offline working cache and current local-first persistence.
3. **Supabase Postgres** — planned canonical store for normalized personal records, workout history, device imports, progression state and photo metadata.
4. **Private object storage** — progress-photo binaries. Supabase Storage can be used initially; Cloudflare R2 is the intended capacity escape hatch.

No private health payload, body photo, Supabase service-role key, R2 secret or other privileged credential belongs in this public repository or client bundle.

## Current Build 003 state

Build 003 deliberately does **not** pretend a cloud backend is connected. It adds:

- a concrete Supabase schema and Row Level Security migration;
- normalized ingestion contracts;
- Apple Health export parsing for data Zepp/Amazfit can write into Apple Health;
- RENPHO CSV parsing with flexible header aliases;
- deterministic import IDs for deduplication;
- source/provenance fields on every normalized record;
- browser-side imports that continue to work with local persistence.

A native HealthKit bridge or secure backend sync can later emit the same normalized record shape, so the UI and fitness engine do not need to know whether a value arrived from an export, an iPhone companion, or a cloud connector.

## Canonical normalized measurement

```json
{
  "id": "deterministic-source-record-id",
  "metric": "body_mass",
  "value": 108.4,
  "unit": "kg",
  "observedAt": "2026-08-27T11:30:00-03:00",
  "source": {
    "family": "renpho",
    "app": "RENPHO Health",
    "device": "ES-CS20M (pending physical-label verification)",
    "transport": "csv_export"
  },
  "quality": "observed",
  "raw": {}
}
```

`quality` values:

- `observed` — directly measured/reported by the source device/app.
- `estimated` — source-provided estimate such as BIA body-fat percentage.
- `derived` — calculated by Zero2Fit or source software from other values.

## Canonical workout record

Workout records preserve the source duration/type/energy separately from Zero2Fit's own exercise-plan history. Device-measured energy must never silently overwrite the 2024 Adult Compendium estimate; both can coexist and be compared.

## Device routes

### Amazfit Active 2 (Round)

Current route:

`Amazfit Active 2 -> Zepp -> Apple Health -> Zero2Fit import/bridge`

Build 003 can ingest common Apple Health records and workouts from an exported `export.xml`. A future iPhone HealthKit companion should produce the same normalized records.

Expected useful fields when Zepp writes them to Apple Health include steps, heart rate, resting heart rate, HRV where available, SpO2 where available, active energy, distance and workouts. Zepp-only readiness/stress/skin-temperature values must be treated as unavailable unless an actual supported export/bridge exposes them.

### RENPHO scale

Current route:

`RENPHO scale -> RENPHO Health -> Apple Health and/or RENPHO CSV -> Zero2Fit`

The exact scale model remains **unverified** until the underside label is checked; `ES-CS20M` is the current likely model and must not be promoted to confirmed fact in stored device metadata yet.

RENPHO CSV parsing supports common header aliases for weight, BMI, body fat, fat-free mass, subcutaneous fat, visceral fat, body water, skeletal muscle, muscle mass, bone mass, protein, BMR and metabolic age.

## Confidence policy

- Weight is treated as an observed scale measurement.
- BIA composition fields are retained as useful trend estimates, not laboratory measurements.
- BMI, BMR and metabolic age are marked derived when their source representation is calculated.
- Single-day BIA changes must not be interpreted as actual day-over-day muscle or fat gain/loss.

## Deduplication

Each import record receives a deterministic ID generated from its source family, metric, timestamp, value and unit (or source record ID when provided). Re-importing the same export is idempotent.

## Security boundary

The browser may contain only public Supabase configuration such as project URL and anon key. Row Level Security is mandatory. Service-role credentials remain server-side only. Private object-storage access must use authenticated policies or short-lived signed URLs.

## Migration path

1. Build 003: local-first imports + schema/contracts.
2. Provision Supabase and run `supabase/migrations/001_private_data_foundation.sql`.
3. Add authenticated sync queue from IndexedDB/local state to Supabase.
4. Add native/secure HealthKit bridge when desired.
5. Move photo binaries to private R2 only if Supabase Storage becomes limiting.
