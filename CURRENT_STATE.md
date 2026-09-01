# Zero2Fit — Current State

This is the authoritative technical checkpoint for future Zero2Fit work. It separates **software/production verification** from **real-account and physical-device acceptance**.

## Production checkpoint

**Latest functional application build:** Build 031 — `b2d7f52daf2473eac90204e68cf3e65b2273a213`

Production target:

`https://jeremyhennessy.github.io/Zero2Fit/`

Build 031 post-merge verification on that exact SHA:

| Gate | Run | Result |
|---|---:|---|
| Validate Zero2Fit | `33547795502` | success |
| Build 022 photo-sync validation | `33547795527` | success |
| Build 024 private-account validation | `33547795652` | success |
| Build 026 activation-guide validation | `33547795501` | success |
| Build 028 HealthKit-evidence validation | `33547795636` | success |
| Build 031 activation-handoff validation | `33547795564` | success |
| Validate HealthKit Bridge | `33547795422` | success |
| Visual QA Screenshots | `33547795477` | success |
| Pages build and deployment | `33547795358` | success |

Fitness reference-data sync did not run for Build 031 by design: its workflow is path-scoped to fitness/planner/reference files, and Build 031 changed only activation-handoff/native UI files.

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

Latest live personal-data counts checked September 1, 2026 after Build 031:

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

This is why production/software completeness must not be described as human acceptance complete.

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

Source-name text, an imported Apple Health label, an acceptance checkbox, a candidate bundle or a parity record is never sufficient authorization.

## Acceptance instrumentation

### Build 024 — authenticated infrastructure self-test

Build 024 is a **one-browser infrastructure acceptance** harness. It uses the ordinary publishable key + authenticated user JWT and verifies:

- account identity
- anonymous application-table access rejection
- normalized-event CRUD
- user-preference preservation/restore
- workout session/set ownership + CRUD
- progress-photo session/asset ownership
- private Storage upload/download/delete
- cleanup of synthetic probes
- real wrapped Sync Now after cleanup

It writes the cloud acceptance marker only when every infrastructure check passes.

### Build 026 — cross-browser Activation Guide

Build 026 tracks real-account continuity without fabricating it:

- 10 real-account checkpoints
- privacy-minimized per-browser acceptance snapshots
- two-browser Fuel reconstruction and deletion propagation
- workout-history reconstruction/signature matching
- explicit second-browser adaptive-target human confirmation
- progress-photo upload/download/deletion propagation
- physical-device checkpoints

The snapshots contain counts/statuses/signatures only, not food names or health values.

### Build 028 — structured physical HealthKit evidence gate

Build 028 keeps observation, evidence and verification separate.

Zepp/Amazfit evidence covers:

- Steps
- heart rate
- resting heart rate
- HRV SDNN
- sleep/stages
- workouts
- active energy

RENPHO evidence covers:

- Weight
- body-composition metrics actually exposed by the selected bundle

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

The iPhone companion now provides the evidence needed to execute Build 028 on the actual device:

- 24-hour quick capture/sync
- 30-day broader capture/sync
- exact HealthKit source name + bundle ID
- per-source metric summaries
- representative latest values/timestamps for human parity checking
- copy bundle ID
- copy source summary
- persisted last successful background-delivery timestamp

The native companion deliberately does **not** auto-classify a bundle as Zepp or RENPHO and does not create a source verification.

### Build 031 — native → web activation handoff

Build 031 removes the navigation friction between Build 030 and Build 028.

After source bundles are captured and the companion is signed into private sync, the native console exposes:

**Open Zero2Fit HealthKit evidence**

The handoff URL is intentionally privacy-minimized:

`https://jeremyhennessy.github.io/Zero2Fit/?activation=healthkit`

It carries only the activation hint. It does **not** include bundle IDs, source names, health values, account identity, verification state or credentials.

The web app then:

1. navigates to Devices;
2. waits for the real Build 028 evidence panel;
3. focuses that panel and shows an “Opened from Zero2Fit Bridge” context note;
4. removes the activation query parameter from browser history.

The handoff does not select a candidate, change a metric status, create a source verification or award Fitness XP.

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
11. let the Build 026 checklist derive completion from that evidence.

## Physical iPhone / HealthKit acceptance — still pending

Use the Build 030 console + Build 031 handoff + Build 028 evidence matrix:

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
14. sync again and confirm matching native events carry the source-verification metadata required by the permanent-XP trust contract.

Until this occurs, Zepp/RENPHO mappings remain unverified for permanent device XP.

## Verification automation

Current complementary gates:

- full `Validate Zero2Fit` regression/browser workflow
- Build 022 photo-sync validation
- Build 024 private-account harness validation
- Build 026 activation-guide validation
- Build 028 HealthKit evidence/trust-boundary validation
- Build 031 privacy-safe handoff unit + real headless-browser validation
- native HealthKit source-summary model tests and iOS simulator compilation
- **16 deterministic visual screenshots**, including iPhone Photos, Activation Guide and HealthKit-evidence captures
- bounded fresh-profile retry for known late-module/headless-Chrome timing flakes; final missing markers still fail closed
- path-scoped fitness reference-data sync/normalization with commit-on-change only
- GitHub Pages build/deployment on `main`

## Next development priority

Do **not** add another broad subsystem before real activation data exists.

The next high-value cycle is:

**Activate → Use → Measure → Tune**

First complete the real-account and physical-device sequence above. After actual usage accumulates, use real workout history to tune load progression/substitution preferences, real Fuel history to improve shortcuts, and real Adventure stalls/deaths to tune game difficulty.

Defer unless direction explicitly changes:

- Garmin/Fitbit integrations
- co-op/PvP
- another major visual redesign
- substantially more Personal Intelligence algorithms
