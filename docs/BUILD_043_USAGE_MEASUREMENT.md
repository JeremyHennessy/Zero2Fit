# Build 043 — Usage & Friction Measurement

Build 043 starts the **Measure** phase of Zero2Fit without adding a third-party analytics product or weakening the personal-data model.

## Objective

Zero2Fit already has enough major subsystems. The next engineering question is whether the existing system fits the user's real behavior.

Build 043 measures interaction outcomes that can later justify product tuning:

- which daily-guidance actions are shown and opened;
- Quick / Standard / Full workout-mode choices;
- workout-location choices;
- completed, uncompleted and skipped sets;
- how often exercise substitution is opened and selected;
- whether a workout Finish action records successfully or is blocked;
- Add Food opens and the logging method that completes an entry;
- manual weight/steps interactions as evidence that automation is still leaving work behind;
- Adventure expedition runs, auto-equip use and the resulting wall class;
- page visits needed to understand which product surfaces are actually used.

## Privacy contract

The Build 043 store is local-only under `zero2fit-usage-v1`.

It does **not** persist:

- food names;
- calories, protein, carbohydrates or fat values;
- weight or body-composition measurements;
- step counts;
- heart rate, HRV, sleep or workout-health values;
- HealthKit bundle IDs or source names;
- credentials, user IDs, email addresses or account identity;
- progress photos;
- exercise names or exercise IDs.

Metadata is allow-listed in `usage-core.mjs`. Unknown metadata keys are discarded before storage.

The store retains at most 90 days and 1,600 interaction events. The Progress screen exposes **Clear tuning history**, which removes this measurement store without changing fitness, Fuel, Adventure, device or photo data.

Build 043 does not call Supabase or any other network service. Future private aggregation may be considered only after real-account activation proves the ordinary private-sync path.

## Tuning signals

The first deterministic signals are intentionally conservative. A pattern is shown only after repeated evidence, for example:

- low follow-through on several Daily Guidance actions;
- repeated workout set skipping;
- repeated exercise substitutions;
- Add Food opens that often do not end in a log;
- repeated manual weight/steps interactions;
- Quick mode becoming the clear majority of recorded workout-mode choices.

These are **tuning candidates**, not automatic changes. Build 043 does not change workout programming, nutrition targets, device trust, permanent Fitness XP or Adventure difficulty.

## Product surface

Progress contains a compact **What Zero2Fit is learning** card with a 14-day window. It shows:

- guidance follow-through;
- completed vs skipped workout sets;
- Fuel logging count vs Add Food opens;
- Adventure run count/outcome class;
- current workout-mode preference;
- current Fuel shortcut preference;
- up to three repeated friction signals.

With little or no usage, the card reports that measurement is active rather than inventing a conclusion.

## Validation

Build 043 adds:

- `tools/test-usage-core.mjs` for sanitization, retention, summaries and friction thresholds;
- `tools/test-build043-ui.mjs` for local-only/privacy/wiring/offline-shell contracts;
- `Validate Build 043 Usage Measurement` GitHub Actions workflow;
- Build 042 and Build 043 as required late-module sentinels in the full browser smoke test;
- `zero2fit-shell-v43-usage-measurement` offline-cache lineage.

The existing visual QA remains the authority for iPhone and desktop layout regressions.
