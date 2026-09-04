# Build 040 — Zero2Fit UI Reset

## Why this build exists

Build 040 is a deliberate visual reset. It does not iterate on Build 038 and it does not use the previous product shell as a design reference. The prior UI remains available in Git history for rollback, but it is no longer part of the active composition layer or offline shell.

The backend, domain model, data sources, persistence, sync, workout programming, nutrition model, device trust boundary, HealthKit evidence gate, personal-intelligence logic, progress-photo handling and Adventure rules are protected.

## Product center

Zero2Fit remains a one-person fitness operating system. The interface is organized around four questions:

1. What should I do today?
2. What did I actually do?
3. Am I improving?
4. What is the smallest useful next action when motivation is low?

The UI should make those answers obvious before exposing implementation detail.

## New design language

- light theme only
- soft cool background and white working surfaces
- blue for structure, navigation, trust, data and primary state
- orange for energy, action, training and game emphasis
- dark navy reserved for readable text, never large dark surfaces
- no dark desktop rail
- no dark mobile dock
- no dark Adventure mode
- no inherited dashboard-card grid as the default composition
- restrained shadows; borders, spacing and typography establish hierarchy
- iPhone safe-area support and touch targets are first-class
- technical and acceptance tooling is progressively disclosed rather than mixed into daily use

Canonical tokens:

- background: `#f6f8fc`
- surface: `#ffffff`
- blue: `#1e66e8`
- orange: `#f47a22`
- ink: `#14213a`
- border: `#dce3ee`

## Information architecture

### Today — daily brief

Purpose: answer "what should I do today?" without requiring dashboard scanning.

Hierarchy:

1. daily brief / Momentum
2. fast actions: Train, Log Food, Check Progress
3. trusted health snapshot
4. next recommended workout
5. small daily goals
6. manual entry as a fallback disclosure

Manual weight/steps controls remain available for compatibility, but connected observations should be visually primary whenever they exist.

### Train — focused execution

Purpose: keep the user focused on the current set.

Hierarchy:

1. current workout/session context
2. oversized current-set execution surface
3. completion action
4. remaining exercise list
5. workout setup disclosure
6. private history/sync disclosure

The planner continues to resolve training intent by Home / Apartment Gym / Full Gym, Quick / Standard / Full, available equipment and adaptive history. Build 040 changes none of that logic.

### Fuel — fast logging workspace

Purpose: reduce nutrition logging friction.

Hierarchy:

1. today/macros summary
2. one orange Add Food action
3. food timeline
4. private sync state
5. Add Food panel containing provider search, barcode path, quick entry, recent/saved meals

Targets remain explicit. The interface must never imply that a calorie target was medically or automatically selected when it was not.

### Adventure — light game surface

Purpose: make the RPG motivating without visually becoming a separate product.

Hierarchy:

1. current expedition/frontier state
2. battlefield and next action
3. character capability/equipment
4. longer progression context

Adventure can award game gear/materials, but permanent Fitness XP remains controlled by completed real actions and the existing trusted-source rules.

### Progress — evidence over impressions

Purpose: answer "am I improving?" using longitudinal evidence.

Hierarchy:

1. top-level trend summary
2. time/tab controls
3. body and training trends
4. Personal Intelligence / recommendations with confidence
5. progress photos
6. historical detail

### Devices — trust and setup

Purpose: keep data provenance understandable while moving technical setup out of the daily experience.

Hierarchy:

1. source list and status
2. normalized timeline disclosure
3. private-account self-test disclosure
4. activation checklist disclosure
5. exact HealthKit source-verification disclosure

Verification remains fail-closed. A source label or candidate selection is not verification.

## Protected implementation contracts

Build 040 must not change:

- normalized event schema or provenance semantics
- localStorage / IndexedDB behavior
- Supabase schema, RLS or Storage policy
- food lookup Edge Function behavior
- workout programming/substitution rules
- adaptive progression calculations
- HealthKit source observation or verification criteria
- permanent Fitness XP trust boundary
- Adventure progression rules
- photo sync/tombstone behavior
- iOS HealthKit bridge behavior

The visible layer may move, group, relabel or disclose existing DOM surfaces while retaining the IDs/hooks that these systems use.

## Current capability baseline

At the Build 040 branch point, Zero2Fit already includes:

- 876 canonical exercises
- 147 Home-compatible exercises
- 402 Apartment Gym-compatible exercises
- 876 Full Gym-compatible exercises
- 1,111 official-PDF MET activities
- location-aware workout planning and same-location substitutions
- guided set-by-set execution and adaptive progression
- Fuel history, macros, saved meals, Repeat Last, quick parsing and Open Food Facts lookup
- private authenticated continuity for normalized events, preferences, workouts and progress photos
- structured real-account acceptance tooling
- native HealthKit source observation and gated Zepp/RENPHO verification evidence
- Personal Intelligence
- automatic RPG Adventure progression with a real-fitness capability ceiling

These are existing capabilities, not new UI claims.

## Acceptance boundary

The UI reset does not make real-account or physical-device acceptance complete. Those still require a real private account plus physical iPhone/Zepp/RENPHO evidence. Software verification and physical acceptance remain separate.

## Future product sequence

The next value cycle after the UI is accepted should remain:

**Activate → Use → Measure → Tune**

1. Complete real-account continuity acceptance.
2. Complete physical HealthKit source verification for the actual Zepp and RENPHO bundles.
3. Use the app for real workouts and food logging long enough to establish representative history.
4. Tune workout substitutions and adaptive loading from observed behavior rather than assumptions.
5. Tune Fuel shortcuts around repeated real meals and logging friction.
6. Tune Adventure pacing from actual stalls/deaths without changing the Fitness-XP authority model.
7. Add richer trend explanations only where real history supports them.
8. Consider additional integrations or multiplayer concepts only after the personal core is demonstrably useful.