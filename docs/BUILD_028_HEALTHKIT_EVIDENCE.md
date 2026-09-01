# Build 028 — Structured Physical HealthKit Evidence Gate

Build 028 is the production software checkpoint that turns physical HealthKit source acceptance into a fail-closed, auditable process without inventing vendor bundle IDs or treating acceptance evidence as permanent fitness progression.

## Production checkpoint

Functional application SHA:

`7607697ce0eec3c49a1256b99d20b54090edf1f8`

Verified post-merge runs on that exact SHA:

| Gate | Run | Result |
|---|---:|---|
| Validate Zero2Fit | `33523923393` | success |
| Build 022 photo-sync validation | `33523923370` | success |
| Build 024 private-account validation | `33523923408` | success |
| Build 026 activation-guide validation | `33523923565` | success |
| Build 028 evidence validation | `33523923467` | success |
| Visual QA Screenshots | `33523923373` | success |
| Sync fitness reference data | `33523923517` | success |
| Pages build and deployment | `33523922448` | success |

Reference sync completed without advancing `main`.

## Why this build exists

The HealthKit bridge can observe exact `HKSource` display names and bundle identifiers, but software alone cannot prove that a real Zepp or RENPHO value on the physical phone matches the corresponding value in Apple Health and Zero2Fit.

Before Build 028, source observations and explicit source-verification records were already separate. Build 028 adds a structured physical-evidence layer between them so an observed bundle cannot be verified merely because its name looks plausible.

The intended chain is now:

```text
Physical source app
  → Apple Health / HealthKit
  → Zero2FitHealthBridge exact source observation
  → Build 028 candidate bundle
  → per-metric physical parity evidence
  → explicit Verify Zepp / Verify RENPHO action
  → source-verification record
  → trusted matching native events may qualify for permanent Fitness XP
```

Candidate selection and evidence completion never create source verification or permanent Fitness XP by themselves.

## Provider matrices

### Zepp / Amazfit

Build 028 tracks:

- Steps
- Heart rate
- Resting heart rate
- HRV SDNN
- Sleep / sleep stages
- Workouts
- Active energy

The Zepp candidate cannot become verification-ready unless **Steps** is physically confirmed as `Matched`.

### RENPHO Health

Build 028 tracks:

- Weight
- Body-composition metrics exposed by the selected bundle

The RENPHO candidate cannot become verification-ready unless **Weight** is physically confirmed as `Matched`.

The exact RENPHO underside hardware-model label is intentionally separate evidence because HealthKit cannot establish the physical scale model.

## Metric states

Every metric resolves to one of four states:

- **Pending** — not physically resolved yet.
- **Matched** — the selected bundle actually wrote the metric and representative source-app → Apple Health → Zero2Fit values were compared successfully.
- **Not provided** — the selected bundle did not write the metric in the captured source observations.
- **Mismatch** — the physical comparison did not agree and must be investigated.

Validation rules are fail-closed:

- `Matched` is invalid when the selected bundle never wrote that metric.
- `Not provided` is invalid when the bundle did write that metric.
- any `Pending` or `Mismatch` row blocks provider readiness;
- Zepp and RENPHO cannot share the same candidate bundle;
- the required primary anchor must be matched before readiness.

## Privacy model

The Build 028 evidence record is `healthkit_acceptance_evidence` in the existing private normalized-event timeline.

It stores status/source metadata such as:

- candidate bundle ID
- candidate source display name
- per-metric acceptance status
- background-delivery confirmation state
- exact RENPHO model-label text when entered

It intentionally does **not** store the representative numerical health values used for comparison. Weight, heart-rate, sleep and other health measurements remain in their normal data path rather than being duplicated into acceptance evidence.

## Verification guard

Build 028 protects both UI and programmatic verification paths.

- Existing **Verify Zepp** / **Verify RENPHO** buttons remain disabled until the selected provider is ready.
- The wrapped `remote.verifySource` path re-checks readiness and the exact candidate bundle immediately before verification.
- Before an allowed verification proceeds, the current structured evidence is persisted through the private account timeline.
- A mismatch, unresolved row or different bundle ID causes verification to fail closed.

The source-verification record remains the authority consumed by the permanent device-XP trust contract.

## Native companion relationship

`ios/Zero2FitHealthBridge` already provides the physical evidence needed to execute the Build 028 flow:

- 24-hour capture for quick parity checks
- 30-day capture for broader source/metric coverage
- exact HealthKit source name + bundle ID
- per-source metric summaries and representative values
- source bundle ID copy support
- source-summary copy support
- successful background-delivery timestamp

The native companion deliberately does not auto-label a source as Zepp or RENPHO and does not create a source verification.

## Physical acceptance sequence

1. Create/sign into the real Zero2Fit private account.
2. Run the native iPhone bridge and authorize HealthKit.
3. Capture + sync the last 24 hours first; use 30 days if broader metric coverage is needed.
4. Confirm the exact observed source bundles appear privately in Zero2Fit.
5. Select the actual Zepp and RENPHO candidate bundles in Build 028.
6. Compare representative values in source app → Apple Health → Zero2Fit.
7. Resolve every relevant matrix row honestly as Matched / Not provided / Mismatch.
8. Require Zepp Steps and RENPHO Weight to be matched.
9. Resolve every mismatch instead of overriding the gate.
10. Confirm physical background delivery.
11. Enter the exact RENPHO underside model label.
12. Only after readiness, perform the separate Verify Zepp / Verify RENPHO action.
13. Private-sync again and confirm matching native events receive the verification metadata required by the permanent device-XP trust contract.

## Current live boundary

At the post-Build-028 live check on September 1, 2026, the connected private store still had:

- 0 auth users
- 0 user-preference rows
- 0 normalized events
- 0 workout sessions / sets
- 0 progress-photo sessions / assets
- 0 device-source observations
- 0 device-source verifications

Therefore Build 028 is **software-complete and production-verified**, but physical Zepp/RENPHO acceptance is still pending. No vendor source identity should be inferred or marked verified until the real iPhone workflow creates the evidence above.
