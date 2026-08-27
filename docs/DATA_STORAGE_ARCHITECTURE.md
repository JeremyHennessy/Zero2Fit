# Zero2Fit — Data & Storage Architecture

## Status

Build 002 establishes a local-first data layer while preserving the Build 001 UI and localStorage compatibility. **No Supabase project is connected by this repository change.** The checked-in SQL is a target schema only; no private credentials are stored in GitHub.

## Current runtime

```text
UI / app state
   ├─ localStorage (`zero2fit-v1`) — immediate Build 001 compatibility
   └─ IndexedDB (`zero2fit`, schema v2)
        ├─ snapshots
        ├─ events
        ├─ imports
        ├─ device_connections
        └─ photo_metadata
```

The app writes its working state to localStorage and mirrors it into IndexedDB. If localStorage is missing but the IndexedDB snapshot exists, Build 002 can restore the stored snapshot rather than silently starting from a blank state.

## Normalized event contract

Device/manual measurements normalize to a common event shape:

- `event_id`
- `metric_type`
- `value`
- `unit`
- `observed_at`
- `end_at` when applicable
- `source_provider`
- `source_device`
- `source_record_id` when available
- `imported_at`
- `provenance_status`
- `confidence`
- `metadata`

`provenance_status` distinguishes observed/imported/derived/user-entered information. `confidence` is deliberately separate so a measured body weight can coexist with a BIA-derived body-composition trend without treating both as equally precise.

## Target cloud architecture

```text
GitHub Pages
     │
     ├─ authenticated browser client
     │
     ▼
Supabase Auth + Postgres + RLS
     │
     ├─ private structured fitness data
     ├─ workout history
     ├─ normalized health/device events
     ├─ XP/RPG state
     └─ progress-photo metadata

Private object storage
     └─ progress photos
```

`supabase/schema.sql` defines the initial target tables, indexes, user-owned Row Level Security policies and a private `progress-photos` bucket. Cloud sync is intentionally **disabled** until a private project is actually created and authenticated RLS access can be tested.

## Security rules

1. GitHub Pages contains no service-role key or private storage credential.
2. Supabase service-role credentials must never be shipped to client JavaScript.
3. Every user-owned table uses RLS with `auth.uid() = user_id`.
4. Progress photos use a private bucket and user-ID-prefixed object paths.
5. Local browser storage is not treated as the only long-term backup.
6. A JSON backup/export path is included before cloud sync is enabled.

## Backup / recovery

Build 002 exposes an export containing:

- current local application state
- normalized IndexedDB events
- import history

This is a portability/recovery artifact, not a substitute for a future automated cloud backup.

## Next storage checkpoint

Before enabling Supabase in production:

1. create a private Supabase project;
2. apply and review `supabase/schema.sql`;
3. create the personal Zero2Fit account;
4. verify every RLS policy with authenticated/unauthenticated tests;
5. implement browser auth with the public anon key only;
6. migrate a copy of local data;
7. compare local vs cloud record counts/content;
8. only then declare cloud sync canonical.
