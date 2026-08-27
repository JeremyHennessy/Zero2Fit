# Zero2Fit fitness reference data

Zero2Fit is a one-person application, but its exercise and calorie-estimation logic should still be reproducible and auditable. The app should not require the user to manually build an exercise catalog, describe standard gym equipment, or enter calorie-burn values.

## 1. Exercise catalog

Primary source: **yuhonas/free-exercise-db**

- Repository: https://github.com/yuhonas/free-exercise-db
- Combined JSON: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
- Current normalized Build 002 catalog: **873 exercises**.
- The upstream catalog labels **188** entries as bodyweight/body-only.
- Zero2Fit separately resolves hidden apparatus requirements from exercise names/instructions. After that equipment-resolution step, **147** exercises are compatible with the confirmed Home profile (bodyweight + yoga mat + ordinary wall; no chair, bench, bar, anchor, band or weights assumed).
- Scope: name, difficulty, force, mechanic, equipment, primary/secondary muscles, instructions and category.
- License: **Unlicense / public domain**. The upstream license permits copying, modification and redistribution.
- Zero2Fit does not vendor the upstream exercise images in Build 002. The normalized catalog keeps exercise metadata and instructions while avoiding a large media payload.

The sync script records the exact upstream Git commit used for each generated catalog. Build 002 currently records upstream commit `b0eed061e1c832b3ed815fbaa4b45b3cdc14df49`.

### Hidden-apparatus resolution

A source exercise marked `body only` is not automatically considered mat-only. Build 002 derives common apparatus requirements such as pull-up bars, dip stations, low bars, benches, chairs, boxes, steps, GHD/anchors, Roman chairs, climbing ropes and sleds from the exercise name/instructions. The derived requirements are stored in `data/generated/training_exercises.json` as `implicitEquipment` and `requiredEquipment`.

This currently removes 41 source bodyweight/body-only entries from the confirmed Home-compatible set. The count is validation-controlled and can change only when the upstream catalog or equipment-resolution rules change.

## 2. Energy expenditure / MET catalog

Primary source: **2024 Adult Compendium of Physical Activities**

- Website: https://pacompendium.com/
- Adult Compendium: https://pacompendium.com/adult-compendium/
- Canonical downloadable PDF used by the data pipeline: https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf
- Publication: Herrmann SD, Willis EA, Ainsworth BE, et al. *2024 Adult Compendium of Physical Activities: A third update of the energy costs of human activities.* Journal of Sport and Health Science. 2024;13(1):6-12. DOI: 10.1016/j.jshs.2023.10.010.
- Use: The Compendium website states that the Adult Compendium is free to use for commercial purposes and asks users not to alter MET values or combine activities with different MET levels.

### Source reconciliation

The source itself has a count discrepancy, so Zero2Fit records rather than hides it:

- publication narrative reports **1,114** activities;
- the publication's per-heading counts sum to **1,113**;
- the current official downloadable PDF contains **1,111 identifiable activity codes**;
- the current official website contains the same **1,111 activity codes**;
- the PDF and website currently both expose **156 Sports codes**, while the publication heading table reports 158;
- the PDF and website code sets otherwise reconcile exactly.

Zero2Fit does **not** invent records to force the catalog to 1,114. `data/generated/met_reconciliation.json` records the published counts, actual parsed counts, heading counts, PDF-only/website-only codes and MET-value disagreements.

There is currently one official-source MET disagreement: activity code `19144` (biathlon training at 10.7 km/h) is **12.8 MET in the downloadable PDF** and **15.8 MET on the current Winter Activities webpage**. Zero2Fit preserves 12.8 as the canonical published-PDF value and stores 15.8 as `currentWebsiteMet`, with `sourceAgreement: met_mismatch`. It is never silently resolved.

### Calorie calculation

For standard adult MET values, the app estimates gross energy with:

`gross kcal = MET × body mass (kg) × duration (minutes) / 60`

For an optional active-energy view above resting metabolism:

`active kcal = max(0, (MET - 1) × body mass (kg) × duration (minutes) / 60)`

These values are estimates. When a connected device supplies workout energy, Zero2Fit should preserve the device value as an observed source and keep the MET estimate separately rather than silently replacing one with the other.

For resistance training, Zero2Fit estimates a timed workout/session or timed segment. It does not assign a fake fixed calorie value to an individual rep, set or named lift.

## 3. Workout-generation evidence

### ACSM 2026 resistance-training position stand

- Publication: Currier BS, D'Souza AC, Fiatarone Singh MA, et al. *American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews.* Medicine & Science in Sports & Exercise. 2026;58(4):851-872.
- DOI: 10.1249/MSS.0000000000003897
- Evidence base: umbrella review of 137 systematic reviews and more than 30,000 participants.
- Zero2Fit use: resistance training at least twice weekly across major muscle groups; favor simple progressive training; home/bodyweight resistance remains a valid training option; advanced methods are not required for the Foundation phase.

### General activity target reference

- CDC adult activity overview: https://www.cdc.gov/physical-activity-basics/guidelines/adults.html
- General public-health reference: adults work toward at least 150 minutes of moderate-intensity aerobic activity per week (or equivalent) plus muscle-strengthening activity on at least two days per week.

These public-health targets are reference points, not rigid daily pass/fail streaks in Zero2Fit.

## 4. Location inventory policy

- **Home** is confirmed as bodyweight + yoga mat + ordinary wall. No other apparatus is assumed.
- **Apartment Gym** remains unverified until user-provided photos are reviewed. The app must not invent equipment. Until verified, it inherits only the conservative Home-safe catalog.
- **Full Gym** is treated as a generic all-equipment environment. It can later be refined to a specific facility without changing workout-history records.

When apartment-gym photos arrive, equipment identification should be written into `data/location_profiles.json` from the photo review. The user should not have to type a machine inventory manually.

## 5. Automatic workout and substitution policy

Workout slots describe **training intent** (for example horizontal pull/back or vertical pull/lats), not a hard-coded exercise name. The planner filters and ranks candidates by:

1. equipment actually available at the selected location;
2. strength-category suitability for strength sessions;
3. movement pattern;
4. primary muscle overlap;
5. push/pull/static force;
6. compound/isolation mechanic;
7. difficulty proximity.

Automatic selections must score **good match or better**. Partial/fallback matches are never silently inserted into the workout.

This matters at Home: the researched catalog currently contains no good-or-better strength substitute for a true horizontal pull or lat pull using only the confirmed Home equipment. Zero2Fit therefore renders that workout slot as **Unavailable at this location**, excludes it from the completion denominator, and can show what a Full Gym would unlock. A stretch or unrelated abdominal exercise is not allowed to masquerade as back/lat strength work.

For available exercises, the app can rank same-location substitutes automatically. The user can change the exercise with one tap without needing to know the equipment taxonomy or manually recreate the workout.

## 6. Refresh and verification process

`node tools/sync-fitness-data.mjs`

The sync process:

1. fetches the upstream public-domain exercise catalog;
2. records the exact upstream Git commit;
3. fetches the official Adult Compendium index and downloadable PDF;
4. extracts the canonical PDF table with `pdftotext`;
5. fetches all current Compendium category webpages;
6. reconciles PDF and website records by five-digit activity code;
7. writes normalized source data into `data/generated/`;
8. derives hidden apparatus and location compatibility with `tools/build-training-catalog.mjs`;
9. removes volatile timestamps from committed generated metadata so unchanged sources do not create meaningless commits.

`node tools/validate-fitness-data.mjs`

Validation fails if:

- the exercise catalog falls below 800 exercises;
- the canonical PDF extraction falls below 1,100 activities;
- exercise or MET IDs are duplicated;
- hidden-apparatus resolution leaves an unavailable requirement on a Home-compatible exercise;
- pull-up/hanging exercises become Home-compatible without a pull-up bar;
- required resistance/bodyweight/yoga/walking reference codes disappear;
- PDF provenance is missing;
- the publication-count reconciliation metadata changes unexpectedly;
- generated summary counts disagree with the catalogs; or
- the apartment-gym profile is accidentally treated as verified before its photo inventory exists.

`node tools/test-training-planner.mjs` verifies real generated workouts across Home, Apartment Gym and Full Gym, including the intentional Home pulling limitation, substitution quality, equipment compatibility and the MET energy formula.

`bash tools/browser-smoke.sh` serves the actual static app over HTTP in headless Chrome and verifies that the researched catalog loads, the Home workout renders, the unavailable pull slot remains visible, the location controls appear and catalog counts reach the UI.

The GitHub Actions workflow refreshes the catalogs monthly and can also be run manually. Refreshes are serialized per branch, and the workflow commits generated data only when the normalized source content actually changes.
