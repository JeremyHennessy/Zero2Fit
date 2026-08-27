# Zero2Fit — Amazfit + RENPHO Ingestion

## Device targets

### Amazfit Active 2 (Round)

Build 008 target path:

```text
Amazfit Active 2 (Round)
        ↓
       Zepp
        ↓
 Apple Health / HealthKit
        ↓
 Zero2FitHealthBridge iPhone companion
        ↓
 private Supabase normalized events + source observations
        ↓
 Zero2Fit browser reconciliation
```

The bridge does **not** guess Zepp's HealthKit bundle identifier. It records the exact `HKSource` name and bundle ID observed on the real iPhone for each metric. That source is only trusted for permanent progression after explicit verification in Zero2Fit.

### RENPHO scale

The user reports the model as **ES-20M**. RENPHO documentation reviewed during implementation lists **ES-CS20M** in the relevant scale family, so the underside hardware label remains a required real-device verification step.

Current paths:

```text
RENPHO scale → RENPHO Health → Apple Health / HealthKit → Zero2FitHealthBridge → private Zero2Fit store
```

and for history/import:

```text
RENPHO Health CSV export → Zero2Fit import → normalized events
```

## Why a HealthKit companion is required

GitHub Pages cannot directly request HealthKit authorization. Build 008 adds an iOS companion under `ios/Zero2FitHealthBridge` with the HealthKit entitlement. The companion:

- requests read access only to the metrics Zero2Fit currently understands;
- captures the real HealthKit source name and bundle ID for every sample;
- produces source-specific aggregated daily step totals using HealthKit statistics rather than summing arbitrary raw exports;
- captures quantity metrics, sleep stages and workouts;
- uploads normalized events to the authenticated private store;
- uploads source observations separately from source verification;
- registers HealthKit observer queries/background delivery so new HealthKit data can trigger a short-window private sync.

The iOS target is generated with XcodeGen and compiled in GitHub Actions against the iOS simulator. Real source identities and real-device background behavior still require installation on the physical iPhone.

## Metrics requested by the native bridge

- steps — source-specific `daily_total`
- body mass / weight
- body-fat percentage
- BMI
- lean body mass
- heart rate
- resting heart rate
- HRV SDNN
- oxygen saturation
- active energy
- walking/running distance
- Apple exercise time
- VO2 max
- sleep-stage records
- workouts, including duration/activity type and workout energy when HealthKit supplies it

This is the **capability request list**, not a claim that Zepp or RENPHO currently writes every one of these categories on the user's phone. The source-observation table provides the evidence for what is actually present.

## Current import formats

The browser Data page continues to accept:

- RENPHO CSV
- extracted Apple Health `export.xml`
- normalized Zero2Fit/HealthKit JSON

Apple Health XML remains useful for migration and diagnostics. It is no longer eligible to authorize permanent device progression merely because a `sourceName` contains `Zepp`, `Amazfit`, `Apple Watch`, or `iPhone`.

## RENPHO fields normalized when present

- weight — `measured`
- BMI — `derived`
- body-fat percentage — `trend_estimate`
- fat-free weight — `trend_estimate`
- subcutaneous fat — `trend_estimate`
- visceral fat — `trend_estimate`
- body water — `trend_estimate`
- skeletal muscle — `trend_estimate`
- muscle mass — `trend_estimate`
- bone mass — `trend_estimate`
- protein — `trend_estimate`
- BMR — `derived`
- metabolic age — `derived`
- heart rate, when present — `measured`

Mass units are taken from the export header where possible rather than guessed.

## Step-count safeguard

The bridge uses `HKStatisticsCollectionQuery` with cumulative sum separated by HealthKit source. Each source/day becomes a normalized event with:

```json
{
  "metric_type": "steps",
  "source_provider": "healthkit_bridge",
  "metadata": {
    "source_name": "<observed on phone>",
    "source_bundle_id": "<observed on phone>",
    "aggregation": "daily_total",
    "bridge_transport_verified": true
  }
}
```

`bridge_transport_verified` means the record came through the native bridge. It does **not** mean the source is Zepp or RENPHO.

## Source observation vs verification

Build 008 deliberately separates two concepts.

### Observation

`device_source_observations` records:

- exact HealthKit source bundle ID;
- source display name;
- metric type;
- sample count;
- first/last observed timestamps.

An observation is evidence only.

### Verification

`device_source_verifications` records an explicit mapping such as:

```text
<exact bundle from this iPhone> → Zepp
<exact bundle from this iPhone> → RENPHO
```

The Devices page shows observed sources after the bridge uploads them. A verification requires an explicit user confirmation and is stored with the exact bundle and metric set.

## Permanent RPG progression gate

A device event can drive permanent device Fitness XP only when all of the following are true:

1. `source_provider` is `healthkit_bridge`;
2. the bridge marked the transport as native (`bridge_transport_verified: true`);
3. the exact source bundle has a stored verification;
4. the downloaded event is enriched with `source_verification_status: verified` and a `source_verification_id`;
5. the existing date, duration, deduplication and per-day award limits also pass.

Historical Apple Health XML imports and unverified bridge events remain available for charts/reconciliation but cannot create permanent progression.

## Private sync

Build 008 connects Zero2Fit to an authenticated Supabase store with Row Level Security. The public web/iOS clients use only the project's publishable client key plus the authenticated user's JWT. No service-role/secret key is included client-side.

Private tables include normalized events, import history, workout records, RPG state, source observations/verifications and progress-photo metadata. The `progress-photos` storage bucket is private and requires the authenticated user ID as the first path segment.

## Remaining real-device verification

The software path is implemented, but the following facts cannot be established without the physical iPhone/scale:

1. confirm the RENPHO underside model label;
2. install the bridge on the iPhone and grant HealthKit read access;
3. capture the actual Zepp and RENPHO `HKSource` names/bundle IDs and metric categories;
4. compare representative values against Zepp, RENPHO Health and Apple Health screens;
5. explicitly verify only the matching source bundles in Zero2Fit;
6. confirm HealthKit background delivery on the physical device.

Until items 3–5 occur, imported/device values can inform trends but permanent device XP remains intentionally locked.
