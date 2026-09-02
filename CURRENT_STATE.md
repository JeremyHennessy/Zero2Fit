# Zero2Fit — Current State

This is the authoritative technical checkpoint for future Zero2Fit work. It separates **software/production verification** from **real-account and physical-device acceptance**.

## Production checkpoint

**Latest functional application build:** Build 033 — `8f74b4e26c55a380fbefd1ee163c2f7e03efb9a6`

Production target:

`https://jeremyhennessy.github.io/Zero2Fit/`

Build 033 post-merge verification on that exact SHA:

| Gate | Run | Result |
|---|---:|---|
| Validate Zero2Fit | `33654855148` | success on attempt 2 |
| Build 022 photo-sync validation | `33654855170` | success |
| Build 024 private-account validation | `33654855198` | success |
| Build 026 activation-guide validation | `33654855203` | success |
| Build 028 HealthKit-evidence validation | `33654855249` | success |
| Build 031 activation-handoff validation | `33654855120` | success |
| Validate HealthKit Bridge | `33654855155` | success |
| Visual QA Screenshots | `33654855144` | success |
| Pages build and deployment | `33654853945` | success |

The first Validate Zero2Fit attempt passed all deterministic checks but GitHub-hosted Chromium timed out twice before emitting any DOM. Re-running the same exact production SHA succeeded. Build 034 therefore widens the **bounded per-attempt wall-clock allowance** from 30 to 50 seconds while retaining exactly two fresh-profile attempts, the existing virtual-time budget and every fail-closed DOM assertion.

Fitness reference-data sync is path-scoped and does not run for native/checkpoint-only changes unless fitness/planner/reference files change.

## Product surface

Daily iPhone navigation:

**Today · Train · Fuel · Adventure · Progress**

Devices, private sync, source verification, acceptance tooling, backup and destructive reset live under Settings/Devices instead of occupying a daily navigation slot.

Current visual system:

- light/cool-neutral background
- white/slate surfaces
- cobalt-blue primary actions
- teal health/recovery/sync accents
- restrained violet/amber RPG accents
- iPhone safe-area handling
- PWA/Home Screen metadata
- versioned offline shell

The old dark/neon-lime Build 006 layer is historical implementation underneath later overrides; it is not the current product theme.

## Core functional systems

### Training

Software-verified:

- Home / Apartment Gym / Full Gym contexts
- Quick / Standard / Full durations
- automatic Full Body A/B selection from completed history
- location/equipment-aware exercise resolution
- same-location substitutions by training intent
- guided set-by-set execution
- load/repetition controls
- automatic rest timing
- skip/resume/substitute/instructions controls
- adaptive rep/load progression from completed history
- conservative recovery adjustment from trusted HealthKit sleep/RHR/HRV plus workout recency
- observed workout energy preferred when available; MET retained as fallback/reference
- authenticated workout-session/set continuity

Current generated exercise coverage:

| Dataset | Count |
|---|---:|
| Source exercises | **876** |
| Training exercises | **876** |
| Source bodyweight/body-only | **188** |
| Home-compatible | **147** |
| Apartment Gym-compatible | **402** |
| Full Gym-compatible | **876** |
| Official-PDF MET activities | **1,111** |

Apartment Gym includes the confirmed full dumbbell set plus photo-verified cable/Smith/machine/cardio/bench/pull-up/dip/stability-ball equipment.

### Fuel

Software-verified:

- calories / protein / carbohydrates / fat
- day navigation
- recent foods
- saved meals
- Repeat Last
- quick nutrition-line parsing
- optional explicit nutrition targets
- Open Food Facts search and barcode lookup
- normalized nutrition history
- saved-meal/target sync through user preferences
- deletion tombstones

Zero2Fit does not infer a calorie target or weight-loss direction automatically.

### Personal Intelligence

Implemented:

- actual latest weight + smoothed trend
- strength/bodyweight PRs
- clearly labelled estimated 1RM where appropriate
- strength trends
- weekly review
- Then-vs-Now summary
- recovery/training associations when enough evidence exists
- explainable recommendations with confidence labels
- Fuel and progress-photo context

### Adventure

Implemented:

- automatic progression
- staged zones, ordinary enemies and bosses
- persistent HP through expeditions
- Strength / Endurance / Consistency / Recovery / Nutrition as game capabilities
- raw vs effective gear power with real-world fitness ceiling
- weapons / armor / charms
- coins / materials / loot
- auto-equip
- capability gates / combat-defeat walls / content-complete wall
- player-vs-enemy battlefield and progression guidance

Adventure never creates permanent Fitness XP.

### Progress photos

Software-verified:

- front / side / back capture
- camera/library input
- alignment controls and ghost overlay
- local IndexedDB blobs
- private Supabase `progress-photos` bucket
- RLS-protected session/asset metadata
- authenticated upload/download/delete path
- deletion tombstones
- user-ID-prefixed Storage paths
- raw photo blobs excluded from JSON backup

Human two-browser photo round-trip remains acceptance work, not an implementation gap.

## Private storage / Supabase

Connected project: `guxdnxnqzhkidtastsfb`

Verified architecture:

- authenticated per-user RLS
- public publishable key only in browser/iOS clients
- no service-role/secret key committed to the public app
- private `progress-photos` bucket with user-folder Storage RLS
- normalized events
- user preferences
- source observations + explicit source verifications
- workout sessions/sets
- progress-photo sessions/assets
- import runs
- reserved RPG/Fitness-XP tables in schema
- active `food-lookup` Edge Function

Latest live personal-data counts checked September 2, 2026 after Build 033:

| Resource | Rows/users |
|---|---:|
| Auth users | **0** |
| User preferences | **0** |
| Normalized events | **0** |
| Workout sessions | **0** |
| Workout sets | **0** |
| Progress-photo sessions | **0** |
| Progress-photo assets | **0** |
| Device source observations | **0** |
| Device source verifications | **0** |

This is why software completeness must not be described as real-account or physical-device acceptance complete.

## Device path and permanent-XP trust boundary

Intended path:

```text
Amazfit Active 2 → Zepp → Apple Health / HealthKit → Zero2FitHealthBridge
RENPHO scale → RENPHO Health → Apple Health / HealthKit → Zero2FitHealthBridge
```

Historical RENPHO CSV and Apple Health XML imports remain supported.

The native bridge records the exact HealthKit source display name and `source.bundleIdentifier` and uploads per-bundle/per-metric source observations.

Permanent device-driven Fitness XP requires all of the following:

- `source_provider = healthkit_bridge`
- verified native transport metadata
- exact source bundle ID
- explicit Zero2Fit source-verification record
- source-verification status `verified`

Source-name text, an imported Apple Health label, an acceptance checkbox, a candidate bundle, a parity record or a native readiness checkpoint is never sufficient authorization.

## Acceptance instrumentation

### Build 024 — authenticated infrastructure self-test

Build 024 is a one-browser infrastructure acceptance harness. It uses the ordinary publishable key + authenticated user JWT and verifies account identity, anonymous-access rejection, normalized-event CRUD, preference preservation, workout ownership/CRUD, progress-photo metadata/storage ownership, cleanup of synthetic probes and a real wrapped Sync Now after cleanup.

### Build 026 — cross-browser Activation Guide

Build 026 tracks real-account continuity without fabricating it:

- 10 real-account checkpoints
- privacy-minimized per-browser acceptance snapshots
- two-browser Fuel reconstruction and deletion propagation
- workout-history reconstruction/signature matching
- explicit second-browser adaptive-target human confirmation
- progress-photo upload/download/deletion propagation
- physical-device checkpoints

Snapshots contain counts/statuses/signatures only, not food names or health values.

### Build 028 — structured physical HealthKit evidence gate

Build 028 keeps observation, evidence and verification separate.

Zepp/Amazfit evidence covers Steps, heart rate, resting heart rate, HRV SDNN, sleep/stages, workouts and active energy. RENPHO evidence covers Weight plus body-composition metrics actually exposed by the selected bundle.

Every metric resolves as **Pending / Matched / Not provided / Mismatch**.

Fail-closed rules:

- `Matched` requires that the selected bundle actually wrote the metric.
- `Not provided` requires that the selected bundle did not write the metric.
- any Pending or Mismatch row blocks verification.
- Zepp requires matched **Steps**.
- RENPHO requires matched **Weight**.
- Zepp and RENPHO cannot share a candidate bundle.
- physical background delivery and the exact RENPHO underside model label remain separate evidence.

The evidence record stores source/status metadata but not the numerical health values compared. Evidence is privately persisted before an allowed verification, but it never creates the verification or permanent XP itself.

### Build 030 — native physical source acceptance console

The iPhone companion provides:

- 24-hour quick capture/sync
- 30-day broader capture/sync
- exact HealthKit source name + bundle ID
- per-source metric summaries
- representative latest values/timestamps for human parity checking
- copy bundle ID / source summary
- persisted last successful background-delivery timestamp

It deliberately does not auto-classify a bundle as Zepp or RENPHO and does not create a source verification.

### Build 031 — native → web activation handoff

After source bundles are captured and the companion is signed into private sync, **Open Zero2Fit HealthKit evidence** opens:

`https://jeremyhennessy.github.io/Zero2Fit/?activation=healthkit`

The handoff carries only the activation hint. It contains no bundle IDs, source names, health values, account identity, verification state or credentials. The web app focuses the Build 028 panel and removes the activation query parameter; it does not choose candidates, change statuses, verify sources or award XP.

### Build 033 — native activation completion status

Build 033 closes the readback loop on the iPhone without weakening Build 028.

The companion now shows six read-only activation checkpoints:

1. private account signed in;
2. HealthKit access exercised;
3. private source observations uploaded;
4. exact Zepp verification detected;
5. exact RENPHO verification detected;
6. successful physical background delivery observed.

The native client may **read** the authenticated user's own RLS-protected `device_source_observations` and `device_source_verifications` rows. It has no native create/update/upsert path for source verification.

A verification only counts when its exact `source_bundle_id` is also present among that account's observed HealthKit bundles. Stale or unrelated verification rows therefore cannot make activation appear complete.

After completing Build 028 and using the separate web Verify action, **Refresh private activation status** on the iPhone confirms whether that exact gated verification is actually present in the private store.

Pure Swift tests cover empty, partially observed, stale-verification and complete six-check states; the native workflow also builds the iOS simulator target.

## Real-account acceptance — still pending

A real Zero2Fit private account still needs to be created through the app. Development automation must not invent personal credentials.

Required sequence:

1. create/sign into the real private account on browser/device A;
2. run Build 024 and require every infrastructure check to pass;
3. run Build 026 checks + sync so browser A publishes its snapshot;
4. create representative real Fuel data, saved meal, explicit targets, workout history and progress photo;
5. Sync Now;
6. sign into the same account on browser/device B;
7. run Build 024 + Build 026 there;
8. prove Fuel reconstruction/deletion propagation;
9. prove workout history reconstructs and explicitly confirm the adaptive recommendation;
10. prove progress-photo upload → other-browser download → deletion propagation;
11. let Build 026 derive completion from that evidence.

## Physical iPhone / HealthKit acceptance — still pending

Use Build 030 + Build 031 + Build 028 + Build 033:

1. sign the native companion into the real private account;
2. authorize HealthKit;
3. capture + sync the last 24 hours; use 30 days if broader metric coverage is needed;
4. confirm the actual source bundles appear in the native console and private web observations;
5. use **Open Zero2Fit HealthKit evidence** to jump directly into Build 028;
6. select the real Zepp and RENPHO candidate bundles;
7. compare representative source-app → Apple Health → Zero2Fit values;
8. resolve every matrix row honestly as Matched / Not provided / Mismatch;
9. require Zepp Steps and RENPHO Weight to match;
10. resolve mismatches instead of overriding the gate;
11. confirm physical background delivery;
12. record the exact RENPHO underside model label;
13. only then perform the separate Verify Zepp / Verify RENPHO actions;
14. return to the companion and tap **Refresh private activation status**; the corresponding exact-source checkpoints should complete only for observed bundles;
15. sync again and confirm matching native events carry the source-verification metadata required by the permanent-XP trust contract.

Until this occurs, Zepp/RENPHO mappings remain unverified for permanent device XP.

## Verification automation

Current complementary gates:

- full `Validate Zero2Fit` regression/browser workflow
- Build 022 photo-sync validation
- Build 024 private-account harness validation
- Build 026 activation-guide validation
- Build 028 HealthKit evidence/trust-boundary validation
- Build 031 privacy-safe handoff unit + real headless-browser validation
- native HealthKit source-summary + activation-readiness model tests and iOS simulator compilation
- **16 deterministic visual screenshots**, including iPhone Photos, Activation Guide and HealthKit-evidence captures
- browser smoke with exactly two fresh-profile attempts, 22-second virtual-time budget and a 50-second bounded wall-clock allowance per attempt; final missing markers still fail closed
- path-scoped fitness reference-data sync/normalization with commit-on-change only
- GitHub Pages build/deployment on `main`

## Next development priority

Do **not** add another broad subsystem before real activation data exists.

The next high-value cycle is:

**Activate → Use → Measure → Tune**

First complete the real-account and physical-device sequences above. After actual usage accumulates, use real workout history to tune load progression/substitution preferences, real Fuel history to improve shortcuts, and real Adventure stalls/deaths to tune game difficulty.

Defer unless direction explicitly changes:

- Garmin/Fitbit integrations
- co-op/PvP
- another major visual redesign
- substantially more Personal Intelligence algorithms
