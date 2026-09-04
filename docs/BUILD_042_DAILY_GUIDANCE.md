# Build 042 — Daily Guidance

## Objective

Build 042 closes the remaining gap between Zero2Fit's large feature set and its primary daily-use question:

> What is the smallest useful next action right now?

It does **not** add a new fitness subsystem. It is an orchestration layer over existing workout, quest, step and Fuel state.

## Today guidance model

The Today page now summarizes four existing daily signals:

- **Move** — purposeful-movement quest or the existing 7,000-step movement threshold
- **Train** — completed workout/quest or an active workout session
- **Fuel** — at least one current-day Fuel entry or the existing nutrition quest
- **Recover** — existing recovery-check quest

The card always presents one primary action. Current priority is deterministic:

1. Continue an already-started workout.
2. On a completely blank day, start with a 10-minute purposeful walk as the lowest-friction action.
3. Do the **Quick** version of today's existing workout.
4. Log what has been eaten so far.
5. Fill the remaining movement gap with a short purposeful walk.
6. Complete the recovery check.
7. When all four signals are complete, explicitly say that no extra task is required.

## Product boundaries

Build 042 deliberately does not:

- infer calorie or macro targets;
- infer weight-loss direction;
- create a medical/readiness score;
- treat unverified device data as trusted;
- award permanent Fitness XP itself;
- mark movement or recovery complete without the user's underlying action;
- change workout planning, adaptive loading, Fuel storage, Adventure progression or sync authority.

It only reads existing local state and routes the user into the existing action surface.

## Files

- `daily-guidance-core.mjs` — pure day-summary and next-action model
- `build042-daily-guidance.js` — Today-page orchestration and action routing
- `build042.css` — responsive guidance-card presentation
- `tools/test-daily-guidance-core.mjs` — deterministic model tests
- `tools/test-build042-ui.mjs` — loader/offline/UI contract
- `tools/browser-smoke-build042.sh` — real headless runtime marker check
- `.github/workflows/validate-build042-daily-guidance.yml` — focused gate

## Why this is the correct next phase

Zero2Fit already has mature training, Fuel, device trust, private sync, progress photos, Personal Intelligence and Adventure systems. The product does not need another large feature family before real use begins. The highest-value improvement is to reduce decision friction and make the existing systems easier to use every day.

Build 042 is therefore part of the broader sequence:

**Activate → Use → Measure → Tune**

After representative real history exists, the same guidance layer can be tuned from actual behavior rather than assumptions—for example, preferred workout modes, substitution choices, repeated meal shortcuts and where Adventure progression most often stalls.
