# Build 004 — Device-driven progress + responsive UI redesign

Baseline: `4d6093baf781a5b0d0df5fff8a025a62a9057412` (Build 003).

## Scope

Build 004 connects normalized device events to the active personal fitness experience and replaces the Build 001/003 visual shell with a mobile-first responsive interface. The researched Build 002 workout planner and Build 003 storage/import behavior remain intact.

## Device reconciliation rules

### Steps

Apple Health can contain overlapping step records from multiple apps/devices. Zero2Fit does not sum every source together.

1. Group step records by local day and source.
2. Prefer a provided daily total over fragments from the same source.
3. Otherwise sum fragments within that one source.
4. Select one canonical source for the day.
5. Prefer Amazfit/Zepp for this personal configuration, then verified HealthKit bridge / Apple Watch / generic Apple Health sources.
6. Preserve raw normalized events in IndexedDB.

A verified current-day 7,000-step total can complete the movement quest. Historical imports do not retroactively award XP.

### Workouts

A device workout is matched to an existing Zero2Fit session when date and duration are sufficiently close. A match enriches the local workout with device source and device energy while retaining the MET estimate separately. It does **not** award a second workout reward.

An unmatched workout can earn conservative device Fitness XP only when:

- the source is trusted (Amazfit/Zepp through Apple Health, or a future verified HealthKit bridge record);
- duration is between 10 and 240 minutes;
- the event has not already been rewarded;
- it is on/after the Build 004 device-XP eligibility start day;
- fewer than two unmatched device-workout awards have been granted for that day.

Imported history before Build 004 remains useful for charts/trends but does not create retroactive game progression.

### Energy

Device energy and the 2024 Adult Compendium MET estimate remain separate fields. A matched device value is preferred for display when available; the estimate is not overwritten.

### Body composition

RENPHO body-composition fields are displayed as trend estimates except explicitly derived fields such as BMR/BMI. Weight remains the primary measured scale value. Source provenance remains visible.

### Sleep

Sleep stage intervals are merged before total sleep duration is calculated so overlapping records do not double-count time. Preferred source selection follows the same device-priority principle.

## UI direction

The prior mockup work was exploratory rather than an approved pixel baseline. Build 004 therefore implements the shared direction:

- light, clean adult interface;
- responsive desktop + iPhone layouts;
- persistent but subtle RPG identity;
- prominent daily workout CTA;
- compact live sensor strip;
- Adventure / Progress / Devices as first-class destinations;
- mobile bottom navigation;
- clear source/confidence labels rather than pretending derived values are measured facts.

## New files

- `device-core.mjs` — pure/testable reconciliation rules.
- `build004-integration.js` — device-to-state reconciliation and new UI composition.
- `build004.css` — complete visual redesign / responsive layer.
- `tools/test-device-driven-progress.mjs` — deterministic Build 004 tests.

## Preserved systems

- Build 002 exercise catalog and location-aware planner.
- Build 002 substitution rules and MET model.
- Build 003 IndexedDB event store/import history.
- Build 003 RENPHO CSV / Apple Health XML / normalized JSON imports.
- Existing local state semantics and manual logging.

## Explicitly not claimed complete

- automatic native HealthKit sync;
- Supabase live sync;
- progress-photo capture/overlay engine;
- auto-adventure combat simulation;
- multiplayer/co-op/PvP.

The redesigned Adventure and Progress screens reserve product space for those later systems without presenting them as already implemented.
