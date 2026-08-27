# Zero2Fit — Data & Storage Architecture

## Current runtime

Zero2Fit remains **local-first**, with private cloud sync now available as an authenticated replication layer rather than a silent replacement for local state.

```text
Application state
  └─ localStorage (`zero2fit-v1`) — active application state

Structured browser layer
  └─ IndexedDB (`zero2fit`, schema v4)
       ├─ snapshots
       ├─ events
       ├─ imports
       ├─ device_connections
       ├─ photo_metadata
       └─ progress_photos

Authenticated private layer
  └─ Supabase + RLS
       ├─ profiles / preferences
       ├─ device connections
       ├─ device source observations
       ├─ device source verifications
       ├─ normalized events / import runs
       ├─ workout sessions / sets
       ├─ Fitness XP ledger / RPG state
       ├─ progress-photo session metadata
       └─ private `progress-photos` bucket
```

LocalStorage remains the active UI-state source so Build 008 does not rewrite the known-good application runtime. IndexedDB stores normalized events/imports/photos. Authenticated Supabase sync replicates structured events and future cloud-backed records; it does not currently overwrite local application state wholesale.

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

The Supabase representation splits `value` into `numeric_value` and `text_value` while preserving the browser event contract when records are pulled back locally.

Provenance and confidence remain separate. RENPHO body weight can be measured while BIA body-fat/muscle fields remain trend estimates. A HealthKit source observation can also be genuine observed data without being authorized for permanent RPG progression.

## Device source evidence

Build 008 adds a second trust boundary around native device data.

### `device_source_observations`

Created automatically by the iPhone bridge from actual HealthKit data. Keyed by user, exact source bundle ID and metric type. Records source name, counts and first/last observed timestamps.

### `device_source_verifications`

Created only after explicit confirmation of a mapping such as an observed bundle → Zepp or observed bundle → RENPHO. Browser reconciliation enriches matching `healthkit_bridge` events with the verification ID/status.

This means source-name text is never itself an authorization credential.

## Private Supabase deployment

Build 008 uses the connected Zero2Fit Supabase project as the private structured store. The live schema has been applied and checked with Supabase's security advisor.

Security rules:

- every exposed application table has Row Level Security enabled;
- policies apply `TO authenticated` and require `(select auth.uid()) = user_id` for select/insert/update/delete;
- anon has no table privileges;
- authenticated has only select/insert/update/delete on application tables;
- the public repository contains only the Supabase **publishable** client key, never a secret/service-role key;
- authenticated user JWTs provide the per-user authorization boundary;
- the `progress-photos` bucket is private;
- progress-photo object paths must begin with the authenticated user UUID.

The security advisor currently reports no security lints. Covering indexes exist for the composite workout-set and progress-photo foreign keys. Event indexes are intentionally retained even while the brand-new database is empty.

## Authentication state

The private project initially contains **zero auth users**. Zero2Fit therefore exposes explicit create-account/sign-in controls instead of silently creating an identity. Session tokens are stored in browser local storage for the web client and in the iOS Keychain for the companion.

An actual user account must be created/sign-in completed before remote records can be written. RLS prevents unauthenticated access regardless of the publicly visible publishable key.

## Sync behavior

### Browser

`remote-sync.js`:

1. authenticates to Supabase;
2. refreshes sessions when necessary;
3. uploads local normalized events using `(user_id,event_id)` conflict resolution;
4. downloads the private normalized timeline;
5. downloads source verification records;
6. enriches matching native HealthKit bridge records with verified-source metadata;
7. upserts reconciled events into IndexedDB;
8. reloads the app so existing device reconciliation consumes the updated timeline.

### iPhone bridge

`ios/Zero2FitHealthBridge`:

1. authenticates the same private account;
2. requests HealthKit read access;
3. captures normalized events plus exact source observations;
4. uploads both through authenticated RLS;
5. stores the auth session in Keychain;
6. registers HealthKit background observers for short-window follow-up syncs.

## Backup

The browser JSON backup continues to contain:

- current local application state;
- normalized IndexedDB events;
- import history;
- progress-photo metadata.

Raw progress-photo blobs remain excluded from the JSON backup. Cloud sync does not remove the need for an explicit portable backup/recovery mechanism.

## Conflict and authority rules

- Browser/local state is not bulk-replaced by cloud state.
- Normalized events are idempotent by stable `event_id`.
- Native HealthKit samples use stable HealthKit sample UUID-derived IDs; daily steps use source bundle + date.
- Cloud source verification can enrich a local event but does not change the underlying measurement.
- Imported Apple Health XML remains import evidence and cannot be promoted to trusted device XP by source name alone.
- Progress-photo binary cloud upload remains separate from local raw-photo storage until the photo cloud client is explicitly wired/tested.

## Remaining activation verification

The storage infrastructure is deployed, but production use still requires:

1. create/sign in to the personal Zero2Fit account;
2. install the bridge on the physical iPhone;
3. capture actual HealthKit source observations;
4. verify the Zepp/RENPHO bundle mappings only after comparing them with the real apps/Apple Health;
5. sync representative records and compare values/counts local ↔ cloud ↔ source apps;
6. verify physical-device background delivery;
7. only then treat verified native events as an automatic permanent-progression input.
