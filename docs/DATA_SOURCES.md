# Zero2Fit fitness reference data

Zero2Fit is a one-person application, but its exercise and calorie-estimation logic should still be reproducible and auditable. The app should not require the user to manually build an exercise catalog, describe standard gym equipment, or enter calorie-burn values.

## 1. Exercise catalog

Primary source: **yuhonas/free-exercise-db**

- Repository: https://github.com/yuhonas/free-exercise-db
- Combined JSON: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
- Scope: 800+ exercises with name, difficulty, force, mechanic, equipment, primary/secondary muscles, instructions, category and image references.
- License: **Unlicense / public domain**. The upstream license permits copying, modification and redistribution.
- Zero2Fit does not vendor the upstream exercise images in Build 002. The normalized catalog keeps exercise metadata and instructions while avoiding a large media payload.

The sync script records the exact upstream Git commit used for each generated catalog.

## 2. Energy expenditure / MET catalog

Primary source: **2024 Adult Compendium of Physical Activities**

- Website: https://pacompendium.com/
- Adult Compendium: https://pacompendium.com/adult-compendium/
- Publication: Herrmann SD, Willis EA, Ainsworth BE, et al. *2024 Adult Compendium of Physical Activities: A third update of the energy costs of human activities.* Journal of Sport and Health Science. 2024;13(1):6-12. DOI: 10.1016/j.jshs.2023.10.010.
- Scope: 1,114 physical activities across 22 major headings, including resistance training, bodyweight exercise, circuits, yoga, walking, running, cycling and cardio equipment.
- Use: The Compendium website states that the Adult Compendium is free to use for commercial purposes and asks users not to alter MET values or combine activities with different MET levels.

Zero2Fit stores the Compendium code, MET value, description, heading and source page. It does **not** overwrite source MET values.

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

- **Home** is confirmed as bodyweight + yoga mat.
- **Apartment Gym** remains unverified until user-provided photos are reviewed. The app must not invent equipment. Until verified, it inherits only the safe Home catalog.
- **Full Gym** is treated as a generic all-equipment environment. It can later be refined to a specific facility without changing workout-history records.

When apartment-gym photos arrive, equipment identification should be written into `data/location_profiles.json` from the photo review. The user should not have to type a machine inventory manually.

## 5. Substitute-selection policy

Exercise substitution is based on **training intent**, not matching names. The resolver ranks candidates by:

1. equipment actually available at the selected location;
2. movement pattern;
3. primary muscle overlap;
4. push/pull/static force;
5. compound/isolation mechanic;
6. difficulty proximity.

If no meaningful equivalent exists, the app says so. Example: with only a yoga mat and bodyweight, there may be no true loaded substitute for a cable lat pulldown. A lower-equivalence pattern-practice movement can be offered, but it must not be presented as physiologically identical.

## 6. Refresh process

`node tools/sync-fitness-data.mjs`

This fetches and normalizes the upstream exercise catalog and the current 2024 Adult Compendium tables into `data/generated/`.

`node tools/validate-fitness-data.mjs`

Validation fails if the exercise catalog falls below 800 exercises, the Compendium catalog falls below 1,000 activities, required reference MET codes disappear, duplicate IDs/codes appear, or the apartment-gym profile is accidentally treated as verified before its photo inventory exists.
