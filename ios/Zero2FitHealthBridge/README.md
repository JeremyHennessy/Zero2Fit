# Zero2FitHealthBridge

Private iPhone HealthKit companion for Zero2Fit.

## Purpose

GitHub Pages cannot access HealthKit. This native companion is the transport boundary between Apple Health and the private Zero2Fit event store.

It intentionally does **not** hard-code or infer Zepp/RENPHO source bundle identifiers. Every HealthKit event preserves the exact `HKSource` name and bundle identifier observed on the physical iPhone. Those observations are uploaded separately from source-verification records.

Build 030 adds a native **Physical source acceptance console** so the physical-device pass can be performed from evidence already captured on the phone rather than from a raw row list. It groups each exact source bundle, shows metric coverage/sample counts, displays the latest representative value and timestamp for each captured metric, and lets the bundle ID or source summary be copied for comparison. This presentation layer does not verify a source and does not alter Fitness XP.

Build 031 adds the privacy-minimized **Open Zero2Fit HealthKit evidence** handoff into the live web Build 028 matrix.

Build 033 adds a read-only **Activation readiness** checklist. The companion now reads the authenticated user's own RLS-protected source observations and exact source-verification rows and reports six checkpoints:

1. private account signed in;
2. HealthKit access exercised;
3. private source observations uploaded;
4. exact Zepp verification detected for an observed bundle;
5. exact RENPHO verification detected for an observed bundle;
6. successful physical background delivery observed.

A verification only counts when its exact bundle also exists in the account's observed HealthKit source bundles. The companion does not create, update, infer or override source verification; it only detects the result of the gated web workflow.

## Build

The project is described by `project.yml` and generated with XcodeGen:

```bash
cd ios/Zero2FitHealthBridge
xcodegen generate
open Zero2FitHealthBridge.xcodeproj
```

GitHub Actions:

1. compile and execute the pure Swift source-summary contract test;
2. compile and execute the pure Swift activation-readiness contract test;
3. enforce the read-only source-verification boundary;
4. generate the Xcode project;
5. build the application against the iOS simulator with code signing disabled.

A physical-device install still requires the repository owner's Apple signing team/profile.

## Physical iPhone setup

1. Generate/open the Xcode project.
2. Select a personal Apple development team for the `Zero2FitHealthBridge` target.
3. Keep the HealthKit capability enabled.
4. Install on the iPhone that runs Zepp and RENPHO Health.
5. Create/sign in to the same private Zero2Fit account used by the web app.
6. Tap **Authorize HealthKit** and grant only the categories you want Zero2Fit to read.
7. For a quick parity check, tap **Capture + sync last 24 hours**. If some expected categories have not occurred recently, use **Capture + sync last 30 days** for broader coverage.
8. Open **Physical source acceptance console** in the companion. For each source bundle:
   - confirm the source name;
   - copy the exact bundle ID;
   - inspect captured metric coverage/sample counts;
   - compare the latest representative value/timestamp with the source app and Apple Health.
9. Use **Open Zero2Fit HealthKit evidence** to jump to the live Build 028 web matrix.
10. Select the exact observed Zepp and RENPHO candidates.
11. Resolve each row as **Matched**, **Not provided**, or **Mismatch**. Do not mark a mismatch as accepted simply to clear the gate.
12. Confirm the companion's **Last background delivery** time only after a genuine background observer-triggered private sync has occurred.
13. Record the exact RENPHO underside model label in Build 028.
14. Only when Build 028 reports the relevant provider ready should you use the separate **Verify Zepp** or **Verify RENPHO** action for that exact bundle.
15. Return to the companion and tap **Refresh private activation status**. The relevant exact-source checkpoint should complete only after the web verification exists for an observed bundle.

The companion's latest-value display is local acceptance assistance. Build 028 stores source/status evidence rather than copying the numerical health values into the acceptance record.

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

Build 030 records the time of each **successful** observer-triggered private sync in local `UserDefaults` and displays it as **Last background delivery**. This gives the physical acceptance pass concrete on-phone evidence, but it does not itself create a Build 028 verification or permanent XP authorization.

Physical-device background execution remains subject to iOS/HealthKit scheduling and must be verified on the actual phone. The simulator CI validates code paths and compilation only.

## Private storage

The companion authenticates directly to the Zero2Fit Supabase project using the public **publishable** client key and the user's account JWT. The refreshable session is stored in the iOS Keychain.

It writes only:

- normalized events → `public.normalized_events`
- source/metric evidence → `public.device_source_observations`

For activation status it may read the authenticated user's own:

- `public.device_source_observations`
- `public.device_source_verifications`

It does **not** create `device_source_verifications`; those require an explicit confirmation in Zero2Fit after the Build 028 evidence gate is satisfied.

No service-role/secret credential is present in the iOS source or public web app.

## Permanent XP rule

A native bridge record is not trusted merely because it came through HealthKit. Permanent device Fitness XP additionally requires a verified exact source bundle and verification ID applied by browser reconciliation. Historical Apple Health XML imports, acceptance-console displays, Build 028 evidence records, Build 033 readiness displays and unverified bridge events cannot pass that gate.
