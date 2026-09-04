# Zero2Fit — Next Steps

## Operating sequence

The next phase is deliberately:

**Activate → Use → Measure → Tune**

Zero2Fit already has mature Training, Fuel, Personal Intelligence, Adventure, progress-photo, private-sync and HealthKit trust systems. Another broad subsystem would add complexity before the existing systems have been exercised with enough real history.

## Priority 1 — Activate the real private account

Goal: prove that the implemented private architecture works for the actual account across two browser/device contexts.

Required acceptance:

1. create/sign into the real Zero2Fit account on browser/device A;
2. run the Build 024 private-store self-test and require every probe to pass;
3. run Build 026 checks + sync so browser A publishes its privacy-minimized acceptance snapshot;
4. create representative real data: Fuel entries, a saved meal, explicit nutrition targets, a completed workout/set history and a progress photo;
5. Sync Now;
6. sign into the same account on browser/device B;
7. run Build 024 + Build 026 there;
8. prove Fuel reconstruction and deletion propagation;
9. prove workout/set history reconstruction and explicitly confirm the adaptive next-load recommendation;
10. prove progress-photo upload → browser-B download → deletion propagation.

Do not add special development credentials or bypass RLS to make this pass.

## Priority 2 — Physically verify Amazfit/Zepp and RENPHO

Goal: move device data from “observed candidate” to an exact, evidence-backed source mapping that is allowed to authorize permanent device Fitness XP.

Required acceptance:

1. sign the native companion into the real private account;
2. authorize HealthKit;
3. capture/sync the last 24 hours; use 30 days if a broader metric window is needed;
4. identify the real HealthKit source bundle IDs for Zepp/Amazfit and RENPHO;
5. open the Build 028 HealthKit evidence panel through the native handoff;
6. compare representative source-app → Apple Health → Zero2Fit evidence;
7. resolve every relevant metric as Matched / Not provided / Mismatch;
8. require Zepp Steps and RENPHO Weight to match;
9. resolve mismatches rather than overriding the gate;
10. confirm physical background delivery;
11. record the exact RENPHO underside model label;
12. only then perform the separate Verify Zepp / Verify RENPHO actions;
13. refresh native private activation status and confirm those exact observed bundles are now verified.

Permanent device Fitness XP remains disabled for unverified sources.

## Priority 3 — Use Zero2Fit as the daily app

Goal: generate enough representative history to distinguish actual friction from imagined product problems.

Use the app for:

- real Home / Apartment Gym / Full Gym workouts;
- Quick / Standard / Full sessions;
- actual substitutions when equipment or preference requires them;
- load/rep editing during guided execution;
- routine Fuel logging, saved meals, Repeat Last and food lookup;
- weight/steps and trusted device metrics;
- progress-photo sessions;
- Daily Guidance on blank, partial, active-workout and complete days;
- normal Adventure automatic progression.

Do not tune algorithms from a single unusual day.

## Priority 4 — Measure friction privately

After representative use exists, evaluate:

### Training

- Quick vs Standard vs Full frequency;
- location choice frequency;
- exercises repeatedly substituted or skipped;
- exercises whose prescribed load/reps are repeatedly edited;
- rest-timer overrides;
- sessions abandoned and later resumed;
- adaptive recommendations accepted vs manually changed.

### Fuel

- foods repeatedly entered through the slowest path;
- saved meals actually reused;
- Repeat Last usage;
- food-lookup failures or normalization corrections;
- logging points where the user stops before the day is useful.

### Daily Guidance

- which recommendation appears most often;
- which CTA is acted on immediately;
- which recommendations are repeatedly ignored;
- whether Quick workout is the right default after movement is covered;
- whether the blank-day walk meaningfully reduces decision friction.

### Adventure

- stages/enemies that repeatedly cause a wall;
- deaths caused by low capability vs poor usable gear;
- raw vs effective/banked gear power;
- material accumulation and auto-equip usefulness;
- whether progression feels motivating without creating pressure to overtrain.

Prefer existing local/private state over adding a third-party analytics service.

## Priority 5 — Tune from evidence

Likely tuning order once real history exists:

1. workout location/mode defaults;
2. substitution ranking from actual choices;
3. adaptive loading/repetition behavior from actual edits/completions;
4. Fuel shortcuts around repeated real meals;
5. Daily Guidance recommendation order/wording;
6. Adventure enemy/boss/pacing curves and material economy;
7. richer Personal Intelligence explanations only when history is sufficient.

## Deferred intentionally

Unless direction explicitly changes, defer:

- Garmin/Fitbit integrations;
- co-op/PvP;
- multiplayer/social features;
- another major visual redesign;
- another broad Personal Intelligence algorithm family;
- commercial/multi-user product work.

## Development discipline

For each future change:

1. state the user problem and existing data authority;
2. change the first incorrect layer only;
3. preserve device trust and permanent-XP boundaries;
4. preserve explicit-vs-derived nutrition semantics;
5. run full domain regression;
6. run focused feature tests;
7. screen the complete iPhone page, not only the first viewport;
8. verify Pages on the exact merged SHA;
9. treat visual regressions and stale-cache behavior as production bugs.
