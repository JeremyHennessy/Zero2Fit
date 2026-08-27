# Zero2Fit — Data & Storage Architecture

## Baseline

Build 003 is based on the merged Build 002 workout-intelligence commit `1318e8f84806c8d3ad23b27dc14d13347ef9f1ca`. It does not replace the Build 002 training engine, generated exercise catalog or location/substitution logic.

## Current runtime

Zero2Fit remains local-first:

```text
Existing app state
  └─ localStorage (`zero2fit-v1`) — active application state

Build 003 structured layer
  └─ IndexedDB (`zero2fit`, schema v3)
       ├─ snapshots
       ├─ events
       ├─ imports
       ├─ device_connections
       └─ photo_metadata
```

Build 003 observes changes to the existing localStorage state and mirrors later state snapshots into IndexedDB. New manual weight/step changes and completed Zero2Fit workouts are normalized into structured events when detected. Device imports are written directly to the event/import stores.

**Important:** IndexedDB is not yet the canonical app-state store and Build 003 does not silently restore an old IndexedDB snapshot over localStorage. That migration requires an explicit reconciliation step so a stale browser snapshot cannot overwrite newer app state.

## Normalized event contract

Each structured measurement/event carries:

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

Provenance and confidence are separate. For example, RENPHO body weight can be marked measured while BIA body-fat/muscle fields are stored as trend estimates rather than treated as laboratory measurements.

## Backup

The Data page can export a JSON package containing:

- current local application state
- normalized IndexedDB events
- import history

The export is a portability/recovery artifact. It does not imply cloud backup is already enabled.

## Target cloud architecture

`supabase/schema.sql` defines a future private cloud model for:

- authenticated profile/preferences
- device connections
- normalized events/import history
- workout sessions/sets
- Fitness XP ledger and RPG state
- progress-photo sessions/metadata
- private progress-photo objects

Every application table is user-owned with RLS based on `auth.uid() = user_id`; the progress-photo bucket is private and expects paths prefixed with the authenticated user UUID.

## Security boundary

- No Supabase project URL or private credential is required for Build 003 local operation.
- Never embed a Supabase service-role key in GitHub Pages or repository files.
- A browser anon key may only be introduced after authentication and RLS have been tested.
- Health data and progress photos must never be committed to the public repository.

## Next cloud checkpoint

Before cloud sync is declared active:

1. create the private Supabase project;
2. apply/review the schema;
3. create the personal account;
4. test authenticated and unauthenticated RLS access;
5. migrate a copy of local data;
6. compare record counts/content between local and cloud;
7. define conflict/recovery behavior;
8. only then make cloud persistence canonical.
