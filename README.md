# Zero2Fit

Zero2Fit is a personal fitness, nutrition, workout and RPG-style progression system hosted on GitHub Pages.

It is intentionally a **one-person app**. The goal is to automate routine fitness decisions when reliable data exists, preserve source provenance, keep permanent fitness progression tied to real-world actions and reduce the effort required to decide what to do next.

For the authoritative technical checkpoint and acceptance boundaries, see [`CURRENT_STATE.md`](CURRENT_STATE.md).

## Current experience

Zero2Fit currently provides:

- a clean light responsive iPhone + desktop interface using blue for structure/trusted-data state and orange for action/training emphasis
- six primary iPhone destinations: **Today / Train / Fuel / Adventure / Progress / Devices**
- a Build 042 **Next Best Action** card at the top of Today that turns current Move / Train / Fuel / Recover state into one small useful action
- PWA/Home Screen metadata, iPhone safe-area handling and a versioned offline shell
- Momentum, permanent Fitness XP, character attributes, milestones and long-term objectives
- automatic Adventure combat/progression with enemies, bosses, loot, equipment, materials and persistent progression walls
- a real-world capability ceiling so gear cannot replace actual fitness progress
- Quick / Standard / Full workout modes
- automatic Full Body A/B selection from completed history
- location-aware workouts for **Home / Apartment Gym / Full Gym**
- confirmed Apartment Gym equipment support, including the full dumbbell set
- same-location exercise substitutions by training intent and available equipment
- guided set-by-set workout execution with load/repetition controls, rest timing, skip/substitute/instructions and resume support
- adaptive next-workout prescriptions based on completed set/load history
- conservative recovery-aware prescription adjustments using only trusted evidence
- observed device workout energy preferred when available, with MET energy retained as fallback/reference
- Personal Intelligence for weight trends, strength trends, PRs, weekly review, Then-vs-Now and explainable recommendations
- Fuel with daily navigation, calories/protein/carbohydrates/fat, recent foods, saved meals, Repeat Last, quick-line parsing and optional explicit targets
- Open Food Facts text/barcode lookup through the deployed Supabase `food-lookup` Edge Function
- aligned front/side/back progress-photo capture with camera/library input, guide, alignment controls, ghost overlay and private timeline
- structured local state plus authenticated private Supabase sync for normalized events, Fuel preferences/history, workout continuity and progress-photo metadata/blobs
- Build 024 / 026 / 028 / 030 / 031 / 033 acceptance tooling for private-account continuity and exact physical HealthKit source verification
- RENPHO CSV, Apple Health XML and normalized HealthKit JSON import paths
- native iPhone companion source under `ios/Zero2FitHealthBridge`
- exact HealthKit source-bundle observation plus explicit source verification before device data can authorize permanent Fitness XP
- portable JSON backup that intentionally excludes raw progress-photo blobs
- GitHub Pages deployment plus automated data, browser, iOS and visual-regression validation

## Build 042 — Daily Guidance

Build 042 closes the gap between having many capable subsystems and knowing what to do right now.

Today summarizes four existing signals:

- **Move**
- **Train**
- **Fuel**
- **Recover**

It then presents one deterministic action. The current priority is:

1. continue an active workout;
2. on a completely blank day, take a 10-minute purposeful walk;
3. do the Quick version of the existing planned workout;
4. log what has been eaten so far;
5. complete the remaining movement gap;
6. do the recovery check;
7. once all four signals are covered, explicitly say that no extra task is required.

This layer does **not** infer calorie/macronutrient targets, weight-loss direction, medical readiness, device trust or permanent Fitness XP. It only reads existing state and routes into the current Train/Fuel/Today/Progress actions.

See [`docs/BUILD_042_DAILY_GUIDANCE.md`](docs/BUILD_042_DAILY_GUIDANCE.md).

## Training and reference data

Workout templates specify training intent rather than hard-coded exercises. A slot such as `vertical_pull_lats` is resolved against the selected location and available equipment.

Current canonical exercise coverage:

| Dataset | Count |
|---|---:|
| Source/training exercises | **876** |
| Source bodyweight/body-only | **188** |
| Home-compatible | **147** |
| Apartment Gym-compatible | **402** |
| Full Gym-compatible | **876** |
| Official-PDF MET activities | **1,111** |

Home assumes bodyweight, yoga mat and ordinary wall only. Apartment Gym includes the confirmed full dumbbell set plus photographed Smith/cable, pull-up/dip, bench, selectorized machine, cardio and stability-ball equipment.

Energy reference data comes from the **2024 Adult Compendium of Physical Activities**. Device-observed workout energy remains separate observed evidence and is preferred when a verified match exists.

## Device path

### Amazfit Active 2

```text
Amazfit Active 2
  → Zepp
  → Apple Health / HealthKit
  → Zero2FitHealthBridge
  → private Zero2Fit store
```

### RENPHO

```text
RENPHO scale
  → RENPHO Health
  → Apple Health / HealthKit
  → Zero2FitHealthBridge
  → private Zero2Fit store
```

Historical RENPHO CSV and Apple Health `export.xml` imports remain supported.

The native bridge records the exact HealthKit `source.name` and `source.bundleIdentifier`. Zero2Fit does not trust vendor-looking source text by itself. Permanent device-driven Fitness XP requires exact observed source mapping plus an explicit private verification record.

See:

- [`docs/DEVICE_INGESTION.md`](docs/DEVICE_INGESTION.md)
- [`docs/DATA_STORAGE_ARCHITECTURE.md`](docs/DATA_STORAGE_ARCHITECTURE.md)
- [`ios/Zero2FitHealthBridge/README.md`](ios/Zero2FitHealthBridge/README.md)

## Fuel boundaries

Fuel supports explicit user-entered targets but **Zero2Fit does not infer a calorie target or weight-loss direction**.

Food lookup, saved meals, Repeat Last and normalized history are designed to reduce logging effort without converting uncertain nutrition data into an authoritative health target.

## RPG integrity

Real-world activity is the authority for permanent Fitness XP/attributes. Adventure can award game gear, materials and currency but cannot fabricate Fitness XP.

Device-based permanent progression remains fail-closed until the exact HealthKit source bundle has been physically observed and explicitly verified.

## Progress photos

Raw photos remain outside the public repository and ordinary JSON backups. The browser keeps a local IndexedDB copy and authenticated sync uses the private Supabase `progress-photos` bucket plus RLS-protected metadata tables.

## Verification automation

The repository uses complementary gates including:

- full `Validate Zero2Fit` syntax/domain/browser regression
- focused Build 022 / 024 / 026 / 028 / 031 / 035 validation
- Build 040 UI contract
- Build 042 Daily Guidance model/UI/runtime contract
- native HealthKit model tests and iOS simulator compilation
- **36 deterministic visual screenshots** covering 393×852 iPhone views, full-height 393×7000 audits, 430×932 iPhone-class views and desktop screens
- fail-closed whole-app browser smoke with fresh-profile retry
- path-scoped fitness reference-data refresh
- GitHub Pages deployment from `main`

## Current development phase

Zero2Fit has enough major systems. The next high-value cycle is:

**Activate → Use → Measure → Tune**

1. **Activate:** create/sign into the real private account; prove cross-browser continuity; physically verify the actual Zepp and RENPHO HealthKit source bundles.
2. **Use:** collect representative real workout, Fuel, steps/weight, photo and Daily Guidance history.
3. **Measure:** identify real friction—mode choice, substitutions, load edits, repeated meals, ignored guidance and Adventure progression walls.
4. **Tune:** improve defaults and pacing from that evidence rather than assumptions.

Defer for now unless direction explicitly changes: Garmin/Fitbit, co-op/PvP, another major visual redesign and another broad intelligence subsystem.

See [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md).

## Run locally

No frontend package install/build step is required.

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Production

GitHub Pages publishes the repository root from `main`:

`https://jeremyhennessy.github.io/Zero2Fit/`
