# Zero2FitHealthBridge

Minimal private iPhone companion for Zero2Fit Build 008.

## Purpose

GitHub Pages cannot access HealthKit. This native companion is the transport boundary between Apple Health and the private Zero2Fit event store.

It intentionally does **not** hard-code or infer Zepp/RENPHO source bundle identifiers. Every HealthKit event preserves the exact `HKSource` name and bundle identifier observed on the physical iPhone. Those observations are uploaded separately from source-verification records.

## Build

The project is described by `project.yml` and generated with XcodeGen:

```bash
cd ios/Zero2FitHealthBridge
xcodegen generate
open Zero2FitHealthBridge.xcodeproj
```

GitHub Actions performs the same generation and builds the target against the iOS simulator with code signing disabled. A physical-device install still requires the repository owner's Apple signing team/profile.

## Physical iPhone setup

1. Generate/open the Xcode project.
2. Select a personal Apple development team for the `Zero2FitHealthBridge` target.
3. Keep the HealthKit capability enabled.
4. Install on the iPhone that runs Zepp and RENPHO Health.
5. Create/sign in to the same private Zero2Fit account used by the web app.
6. Tap **Authorize HealthKit** and grant only the categories you want Zero2Fit to read.
7. Tap **Capture and sync last 30 days**.
8. In the Zero2Fit Data/Devices page, inspect the observed source names/bundle IDs.
9. Compare those source entries and representative values with Apple Health, Zepp and RENPHO Health.
10. Only then use **Verify Zepp** or **Verify RENPHO** for the exact matching bundle.

## Metrics requested

The companion requests read access to:

- steps (source-separated daily totals)
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
- Apple exercise time
- VO2 max
- sleep analysis
- workouts

Authorization does not prove the source apps populate every category. `device_source_observations` is the evidence for what is actually present on the phone.

## Background behavior

After HealthKit authorization the app registers `HKObserverQuery` instances and enables hourly HealthKit background delivery for the requested sample types. An observed HealthKit change triggers a three-day capture window and authenticated upload.

Physical-device background execution is subject to iOS/HealthKit scheduling and must be verified on the actual phone. The simulator CI validates compilation only.

## Private storage

The companion authenticates directly to the Zero2Fit Supabase project using the public **publishable** client key and the user's account JWT. The refreshable session is stored in the iOS Keychain.

It uploads:

- normalized events → `public.normalized_events`
- source/metric evidence → `public.device_source_observations`

It does **not** create `device_source_verifications`; those require an explicit confirmation in Zero2Fit.

No service-role/secret credential is present in the iOS source or public web app.

## Permanent XP rule

A native bridge record is not trusted merely because it came through HealthKit. Permanent device Fitness XP additionally requires a verified exact source bundle and verification ID applied by browser reconciliation. Historical Apple Health XML imports and unverified bridge events cannot pass that gate.
