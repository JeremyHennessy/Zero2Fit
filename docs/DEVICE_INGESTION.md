# Zero2Fit — Amazfit + RENPHO Ingestion

## Confirmed architecture constraint

The Zero2Fit production UI is a GitHub Pages web application. Apple Health data is accessed through HealthKit authorization in an iOS app/companion; it is not a browser API that GitHub Pages can directly query.

Build 002 therefore separates **ingestion/normalization** from the future HealthKit transport.

## Amazfit Active 2 (Round)

Current path:

```text
Amazfit Active 2 (Round)
        ↓
       Zepp
        ↓
 Apple Health (enabled categories)
        ↓
 future Zero2Fit HealthKit companion/bridge
        ↓
 normalized Zero2Fit events
```

Amazfit documents Apple Health synchronization through Zepp. The exact categories exposed to Apple Health must be verified against the user's real Zepp/Health permissions before Zero2Fit assumes availability.

Potential useful categories include workouts, heart rate, resting heart rate, steps, distance, active energy, sleep, HRV, SpO2 and related fitness/recovery signals where the installed apps actually expose them.

## Step-count safeguard

Apple Health exports may contain many StepCount records and potentially multiple contributing sources. Build 002 stores raw imported step events but **does not overwrite the dashboard step total from a raw record**.

The future HealthKit companion should query/aggregate the authoritative daily total and send a normalized event with:

```json
{
  "metric_type": "steps",
  "metadata": { "aggregation": "daily_total" }
}
```

Only such an aggregated record is eligible to update the app's daily step value. This avoids naïvely summing overlapping sources.

## RENPHO scale

The user reports the scale as **ES-20M**. RENPHO documentation reviewed for Build 002 lists **ES-CS20M** in the relevant scale family. The exact underside model label remains unverified and must be confirmed before the hardware model is locked in documentation.

Current practical paths:

```text
RENPHO scale → RENPHO Health → Apple Health → HealthKit bridge → Zero2Fit
```

and, for richer/history import:

```text
RENPHO Health export CSV → Zero2Fit import → normalized events
```

## RENPHO CSV fields supported in Build 002

When present and recognizable:

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
- heart rate when present — `measured`

Mass units are read from the CSV header where possible instead of being guessed.

## Apple Health XML import

Build 002 can parse an extracted Apple Health `export.xml` for a limited supported set of records, including:

- steps
- weight
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

This file import is a migration/diagnostic path, not the intended daily sync mechanism.

## Normalized bridge JSON

The future iOS HealthKit companion can send already-normalized JSON into the same ingestion layer. This is the preferred long-term design because the companion can resolve HealthKit aggregation and authorization details before data reaches the web app.

## RPG integrity

Imported workout records are retained as fitness evidence but Build 002 does **not** automatically award Fitness XP from imported workouts. Server-side/bridge deduplication and verification rules must be designed before device imports can drive competitive or permanent RPG progression without duplicate awards.

## Remaining device work

1. verify the RENPHO underside model label;
2. inspect Zepp → Apple Health permissions/categories on the actual iPhone;
3. inspect RENPHO Health → Apple Health categories on the actual iPhone;
4. create a minimal HealthKit companion/bridge;
5. emit daily aggregated steps rather than raw StepCount accumulation;
6. define workout deduplication between Zero2Fit-tracked sessions and watch-imported sessions;
7. test with real exports before declaring any field available automatically.
