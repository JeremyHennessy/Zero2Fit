# Zero2Fit — Personal Build Specification

## Purpose
Zero2Fit is a one-person fitness operating system. It is tailored for its owner and is not being designed as a commercial SaaS product.

The app should reduce the amount of effort required to answer four questions:

1. What should I do today?
2. What did I actually do?
3. Am I improving?
4. What is the smallest useful next action when motivation is low?

## Product rules

- Personal utility beats generalized configurability.
- Real fitness data remains primary; RPG mechanics summarize and reward it but never replace it.
- No punishment loops. A missed day may reduce Momentum but does not erase levels, achievements, or completed work.
- Raw/observed data and Zero2Fit-derived data must be distinguishable.
- Source provenance must be retained for imported data.
- Device integration should normalize into a common event model instead of leaking vendor-specific schemas into the UI.
- Health targets should not be silently inferred. Explicit user-set targets and observed values should remain distinct.
- GitHub Pages is the primary hosting target for the web UI.

## Core navigation

### Today
Daily action surface: Momentum, quest board, workout recommendation, weight, steps, and fast next actions.

### Character
RPG representation of real progress. Includes character level, XP, attributes, achievements and longer-term boss objectives.

### Train
Workout planner and execution tracker with Quick / Standard / Full variants so a constrained day does not become a failed day.

### Nutrition
Fast calorie/protein logging first. Later phases can add saved meals, barcode/database search, natural-language entry and imports.

### Journey
Longitudinal evidence: weight trend, workout count, weekly activity, XP history, personal records and future Then-vs-Now comparisons.

### Data
Connection status, provenance, normalized records and integration diagnostics.

## RPG system

### XP
XP is permanent. It is awarded only for completed real actions or confirmed milestones.

Initial examples:
- purposeful movement quest: 20 XP
- workout quest: 35 XP if manually completed
- completed tracked workout: 45 XP
- nutrition logging quest: 15 XP
- recovery check: 10 XP

### Character attributes
- Strength — resistance-training progression
- Endurance — walking/cardio activity
- Consistency — showing up over time
- Recovery — sleep/recovery behavior
- Nutrition — food logging and future adherence measures

Attributes should eventually use normalized metrics rather than only XP counters.

### Momentum
Momentum is a 0–100 short-term score representing how much of the current day's plan has been completed. It is intentionally recoverable and does not behave like a brittle streak.

### Boss objectives
Bosses are 4–8 week concrete goals. Example: Foundation Gate = complete 12 workouts. Boss progress never resets because of a missed day.

## Data architecture target

Source → connector/sync → normalized event → local/persistent store → derived metrics → UI

Every normalized event should ultimately support:
- event_id
- metric_type
- value
- unit
- observed_at
- source_provider
- source_record_id when available
- import/sync timestamp
- provenance status: observed | imported | derived | user-entered

## Integration roadmap

### Phase 1 — local/manual
- weight
- steps
- workouts
- calories/protein
- XP and quest state

### Phase 2 — device/app ingestion
- Apple Health via a small iOS sync companion or compatible aggregation layer
- Android Health Connect if needed
- smart scale source such as Withings
- activity wearables such as Garmin/Fitbit
- nutrition import if practical

### Phase 3 — personal intelligence
- weight-trend smoothing
- strength progression and suggested loads
- correlations between sleep, activity and workout performance
- weekly review
- Then vs Now comparisons
- explainable recommendations

## Build 001 scope

Build 001 intentionally has no authentication, backend, cloud persistence or third-party API credentials. It establishes the approved interaction model before adding integration complexity.
