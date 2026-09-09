# Zero2Fit — Next Steps

## Operating rule

Build 047 is the locked V1 activation/use baseline:

`3a9925d403887d6ee700ab6fb7311987b2912d88`

Preserved ref:

`baseline/build-047-v1-activation`

Until V1 completion, do not add another broad subsystem, redesign the approved UI, refactor working architecture, or tune behavior from synthetic/one-off evidence.

The sequence is:

**Finish Activate → 10–14 days Use → Measure → one Tune pass → V1 baseline**

## Current evidence — 2026-09-09

Do not repeat already-proven steps merely to create activity.

### Already proven

- [x] real private account exists
- [x] Browser A Build 024 core infrastructure acceptance passed 7/7
- [x] latest confirmed Build 024 pass is 2026-09-04T15:53:29.838Z
- [x] real Fuel history exists
- [x] at least one Open Food Facts nutrition entry exists
- [x] at least one saved meal exists
- [x] real Home workout history with completed sets exists
- [x] Build 047 application deployed and visual-QA verified

### Live private-store facts

- normalized events: 7
- workout sessions: 3
- workout sets: 22
- progress-photo sessions/assets: 0 / 0
- device source observations/verifications: 0 / 0
- explicit nutrition targets: all four still unset/null
- two older Build 026 browser snapshots exist, but both predate the compatibility fix and record infrastructure as false
- no fresh post-fix Browser-A Build 026 snapshot exists
- no Browser-B continuity evidence exists

Progress-photo cloud continuity is deliberately deferred and is **not** a V1 activation blocker.

## Priority 1 — Finish Browser A state

Goal: publish a current Build 026 Browser-A snapshot without repeating already-proven Fuel/workout/Build024 work.

Required:

1. [ ] set explicit calorie target;
2. [ ] set explicit protein target;
3. [ ] set explicit carbohydrate target;
4. [ ] set explicit fat target;
5. [ ] run Build 026 `Run checks + sync` once on the current Build 047 production app;
6. [ ] confirm a new `acceptance_browser_snapshot` is persisted with the current Build 024 pass recognized;
7. [ ] confirm the snapshot reflects current Fuel/workout state.

Do not rerun Browser-A Build 024 unless new evidence shows the existing 7/7 marker is invalid.

## Priority 2 — Browser B continuity

Goal: prove the same private account reconstructs meaningful state on an independent browser/device context.

Required:

1. [ ] sign into the same account on Browser B;
2. [ ] run Build 024 on Browser B and require a real pass there;
3. [ ] run Build 026 `Run checks + sync` on Browser B;
4. [ ] confirm Fuel history reconstructs;
5. [ ] confirm saved meal reconstructs;
6. [ ] confirm all four explicit targets reconstruct;
7. [ ] confirm workout sessions and sets reconstruct;
8. [ ] explicitly compare the adaptive next-workout recommendation with the recommendation expected from the restored history;
9. [ ] on one browser, delete/clear representative Fuel data so a tombstone is created;
10. [ ] Sync Now;
11. [ ] sync the other browser and confirm the deletion propagates;
12. [ ] sync back and confirm the deleted data does not resurrect.

Exit criteria:

- Browser A and B both have current Build 026 evidence;
- Browser B has a real Build 024 pass;
- Fuel/preferences/workout continuity is proven;
- Fuel deletion propagation is proven in both directions.

Do not add special credentials, bypass RLS, or directly edit user rows to force acceptance.

## Priority 3 — Physical iPhone / HealthKit activation

Goal: move Zepp/Amazfit and RENPHO from vendor-looking candidates to exact observed and explicitly verified HealthKit sources.

Current evidence: production has **zero** `device_source_observations` and **zero** `device_source_verifications`.

Required:

1. [ ] build/run `ios/Zero2FitHealthBridge` on the physical iPhone;
2. [ ] sign the native companion into the same private account;
3. [ ] authorize HealthKit;
4. [ ] capture/sync the last 24 hours;
5. [ ] use a 30-day capture only if needed for broader source/metric coverage;
6. [ ] identify the exact Zepp/Amazfit `source.bundleIdentifier`;
7. [ ] identify the exact RENPHO `source.bundleIdentifier`;
8. [ ] confirm source observations appear in the private store;
9. [ ] open the Build 028 HealthKit evidence flow through the native handoff;
10. [ ] compare Zepp → Apple Health → Zero2Fit for **Steps** and require a match;
11. [ ] assess other Zepp metrics as Matched / Not provided / Mismatch;
12. [ ] compare RENPHO → Apple Health → Zero2Fit for **Weight** and require a match;
13. [ ] assess only the RENPHO body-composition metrics actually exposed by the observed source;
14. [ ] resolve every mismatch instead of overriding it;
15. [ ] record the exact RENPHO underside model label;
16. [ ] confirm physical background delivery;
17. [ ] only then use the separate **Verify Zepp** action;
18. [ ] only then use the separate **Verify RENPHO** action;
19. [ ] refresh native private activation status;
20. [ ] confirm the exact observed bundles are read back as verified.

### Permanent-XP boundary

Device-driven permanent Fitness XP remains fail-closed until the event has:

- `source_provider = healthkit_bridge`
- verified native transport metadata
- the exact HealthKit source bundle ID
- an explicit private source-verification row
- source-verification status `verified`

Source display names, imported Apple Health labels, candidate selection, evidence rows, readiness checkpoints and acceptance checkboxes are not sufficient.

## Priority 4 — 10–14 day real-use observation window

Start only after the activation gates above are materially complete enough that the app can be used normally without confusing missing infrastructure with product friction.

During the observation window:

- [ ] use real Home workouts;
- [ ] use Apartment Gym when available;
- [ ] use Full Gym when available;
- [ ] use Quick / Standard / Full naturally rather than forcing equal counts;
- [ ] make substitutions only when genuinely needed;
- [ ] edit load/reps when the prescription genuinely needs correction;
- [ ] let rest timers run normally and override only when genuinely desired;
- [ ] leave/resume a workout only if that happens naturally;
- [ ] use routine Fuel logging;
- [ ] use saved meals / Repeat Last where useful;
- [ ] use Open Food Facts search/barcode where useful;
- [ ] let lookup failures/empty results occur naturally rather than manufacturing them;
- [ ] use Daily Guidance on blank, partial, active-workout and completed days;
- [ ] allow normal Adventure automatic progression;
- [ ] do not deliberately overtrain to create Adventure wall evidence.

Do not change workout algorithms, Fuel targets/defaults, Daily Guidance ordering or Adventure balance during this window unless a verified correctness/blocker defect is found.

## Priority 5 — Measure existing evidence

Use Builds 043–047. Do not add third-party analytics for this phase.

### Training evidence

Review:

- Quick vs Standard vs Full frequency;
- location choice frequency;
- substitutions/skips;
- load-target vs rep-target edits;
- guided stepper vs direct/manual edits;
- rest extended vs ended early;
- unfinished sessions and resume rate;
- adaptive recommendations that were accepted vs manually changed.

### Fuel evidence

Review:

- Add Food completion vs abandonment;
- search/barcode/camera lookup success / empty / error outcomes;
- repeated lookup friction;
- manual-entry reliance;
- saved meal reuse;
- Repeat Last usefulness.

### Daily Guidance evidence

Review:

- recommendation frequency;
- immediate CTA follow-through;
- repeatedly ignored recommendations;
- whether Quick is the right default after movement is covered;
- whether the blank-day walk reduces decision friction.

### Adventure evidence

Review:

- repeated combat-wall signal;
- repeated real-capability-gate signal;
- raw vs effective/banked gear power;
- material accumulation and auto-equip usefulness;
- whether progression remains motivating without encouraging extra training.

## Priority 6 — One evidence-based tuning pass

Make the smallest supported changes, one hypothesis at a time, in this order:

1. workout location/mode defaults;
2. substitution ranking from actual choices;
3. adaptive load/repetition behavior from actual edits/completions;
4. Fuel shortcuts around repeated real behavior;
5. Daily Guidance recommendation order/wording;
6. Adventure enemy/boss/pacing/material economy.

For each tuning change:

1. state the observed evidence;
2. state the hypothesis;
3. identify the first layer to change;
4. make the smallest reversible change;
5. run focused tests;
6. run full regression before combining with another tuning change.

## Priority 7 — V1 release closure

When the tuning pass is complete:

1. [ ] run full `Validate Zero2Fit` regression;
2. [ ] run Build 022 / 024 / 026 / 028 / 031 / 035 focused gates;
3. [ ] run Build 040 UI contract;
4. [ ] run Builds 042–047 focused model/privacy/authority gates;
5. [ ] run native HealthKit tests / iOS compilation;
6. [ ] run complete visual QA, including iPhone full-height views;
7. [ ] inspect the exact generated screenshot set;
8. [ ] merge only from the exact tested head;
9. [ ] verify GitHub Pages separately on the exact merged SHA;
10. [ ] verify the PWA shell version matches the final application tree;
11. [ ] run Supabase security advisors;
12. [ ] run Supabase performance/operational advisors;
13. [ ] recheck Data API grants/RLS because Supabase is moving existing projects toward explicit Data API grants by 2026-10-30;
14. [ ] preserve the exact final application SHA as `baseline/v1-personal-use`;
15. [ ] update `CURRENT_STATE.md` with the final V1 evidence and explicitly list anything deferred.

## Deferred intentionally

Unless direction explicitly changes, defer:

- progress-photo cloud continuity as an activation blocker;
- Garmin/Fitbit integrations;
- co-op/PvP;
- multiplayer/social features;
- another major visual redesign;
- another broad Personal Intelligence algorithm family;
- commercial/multi-user product work.

## Development discipline

For every remaining change:

1. compare against `baseline/build-047-v1-activation`;
2. preserve approved UI unless the defect is actually presentation-layer;
3. change the first incorrect layer only;
4. preserve device trust and permanent-XP boundaries;
5. preserve explicit-vs-derived nutrition semantics;
6. do not stack speculative fixes;
7. make experiments reversible;
8. verify the exact deployed SHA separately from CI;
9. treat visual regressions and stale-cache behavior as production bugs.
