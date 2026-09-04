# Build 044 — Training Friction Detail

Build 044 extends the existing Build 043 local measurement layer. It does not add a new analytics service and it does not change workout programming automatically.

## Objective

Build 043 can already tell whether training is being selected, completed, skipped or substituted. Build 044 adds the interaction detail needed to answer a narrower question later:

> Where is the guided workout itself creating avoidable friction?

The new local-only outcomes are:

- **set target edited** — whether the user changed a load or repetition target and whether the change came from the guided stepper or direct input;
- **rest override** — whether default rest was extended or ended early;
- **skipped sets resumed** — whether the skipped-set queue was explicitly restored;
- **unfinished session left** — whether an already-started workout was left before completion;
- **unfinished session resumed** — whether that workout was later re-entered.

## Privacy boundary

Build 044 continues to write only to `zero2fit-usage-v1`.

It may record categorical metadata such as:

- `kind = load | reps`
- `method = stepper | manual`
- `method = extend | start_next`
- current workout mode/location
- lifecycle source such as navigation/background/focus

It does **not** record:

- the actual load value;
- the actual repetition count;
- the exercise name or exercise ID;
- duration, calorie, heart-rate, sleep or recovery values;
- health measurements;
- account identity or device-source identity.

There is no `fetch`/Supabase/network persistence in `build044-training-friction.js`.

## Derived signals

The existing deterministic tuning model gains three conservative candidates:

- **Workout targets are frequently edited** after at least four target-edit outcomes in the measurement window;
- **Default rest is often shortened** after at least three explicit early-rest endings;
- **Workouts are often left unfinished** after at least three unfinished-session exits when fewer than half are later resumed.

These are evidence labels only. They do not rewrite the training plan.

## Why automatic tuning still waits

A frequent edit can mean many things: the first working weight is being established, the prescription is too aggressive, the user prefers a different rep target, or one unusual session required adaptation. Build 044 therefore measures first and leaves actual algorithm tuning to the later **Tune** phase after representative history exists.

## Reliability

The runtime:

- loads after Build 043;
- exposes `data-zero2fit-training-friction="ready"` on the document root;
- uses a bounded duplicate guard for background/pagehide navigation overlap;
- recognizes active workouts from the existing `workoutSessionStarts` state rather than creating a second session authority;
- remains included in the versioned PWA shell as `zero2fit-shell-v44-training-friction`.

## Validation

Build 044 adds:

- expanded `usage-core.mjs` tests for target edits, rest overrides and session leave/resume behavior;
- `tools/test-build044-training-friction.mjs` to enforce local-only/privacy/wiring boundaries;
- `Validate Build 044 Training Friction` GitHub Actions workflow;
- Build 044 readiness as a required whole-app browser-smoke sentinel.
