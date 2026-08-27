# Zero2Fit — Amazfit + RENPHO Ingestion

## Device targets

### Amazfit Active 2 (Round)

Current device path:

```text
Amazfit Active 2 (Round)
        ↓
       Zepp
        ↓
 Apple Health
        ↓
 future native HealthKit companion
        ↓
 normalized Zero2Fit events
```

Amazfit documents Apple Health synchronization through Zepp. The actual categories enabled on the user's iPhone still need to be inspected before Zero2Fit claims any specific watch metric is automatically available.

### RENPHO scale

The user reports the model as **ES-20M**. RENPHO documentation reviewed during implementation lists **ES-CS20M** in the relevant scale family, so the underside hardware label remains a required verification step.

Two ingestion paths are supported/planned:

```text
RENPHO scale → RENPHO Health → Apple Health → future HealthKit companion → Zero2Fit
```

and for existing/history data:

```text
RENPHO Health CSV export → Zero2Fit import → normalized events
```

## Why a HealthKit companion is required

GitHub Pages is a browser application. HealthKit access is authorized to an iOS app with the HealthKit capability; Zero2Fit cannot correctly represent direct Apple Health browser access as available.

Build 003 therefore implements the normalization/import boundary now while leaving the transport as a future native companion.

## Current import formats

The Data page accepts:

- RENPHO CSV
- extracted Apple Health `export.xml`
- normalized Zero2Fit/HealthKit JSON

Apple Health XML import is a migration/diagnostic path, not the intended daily sync mechanism.

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

## Apple Health XML fields currently recognized

- step records
- body mass
- body-fat percentage
- BMI
- lean body mass
- heart rate
- resting heart rate
- HRV SDNN
- oxygen saturation
- active energy
- walking/running distance
- exercise time
- VO2 max
- sleep-stage records
- workouts

## Step-count safeguard

Raw Apple Health exports may contain multiple StepCount records and potentially overlapping contributing sources. Build 003 therefore stores raw step records but **does not replace the app's daily step total from an arbitrary raw record**.

A future HealthKit companion should send an authoritative aggregated daily event with:

```json
{
  "metric_type": "steps",
  "metadata": { "aggregation": "daily_total" }
}
```

Only a record explicitly identified as a daily total is applied to the Zero2Fit daily-step field.

## RPG integrity

Imported workout records are evidence in the normalized event store, but Build 003 does not award permanent Fitness XP from them. Workout deduplication/verification must be established before device-imported activity can drive permanent RPG progression.

This avoids awarding XP twice when the same session exists as both a Zero2Fit tracked workout and a watch/HealthKit workout.

## Remaining device work

1. verify the RENPHO underside model label;
2. inspect Zepp → Apple Health permissions/categories on the actual iPhone;
3. inspect RENPHO Health → Apple Health permissions/categories;
4. create the minimal native HealthKit companion;
5. aggregate daily steps through HealthKit rather than summing raw export records;
6. define workout deduplication and source-priority rules;
7. test real exports and compare values against Zepp/RENPHO Health/Apple Health screens;
8. only then enable automatic Fitness XP from verified device events.
