# Zero2Fit — Exercise & Workout System

## Goal

The workout system should choose an appropriate exercise for the intended movement without requiring the user to know exercise names or manually rebuild a program when training location changes.

## Initial catalog

Build 002 contains 36 exercises covering:

- squat
- unilateral squat
- horizontal push
- horizontal pull
- vertical push
- vertical pull
- hinge
- hip extension
- core
- calf
- cardio
- mobility

Each exercise records movement pattern, muscles, equipment requirements, valid locations, difficulty, default sets/reps, a form cue, and substitution group.

## Location profiles

### Home

Confirmed equipment:

- bodyweight
- yoga mat

Ordinary household supports may be used when available:

- chair
- stable surface
- wall

These supports are explicitly distinguished from confirmed dedicated fitness equipment.

### Apartment Gym

The equipment inventory is **unverified** until photos are supplied. Build 002 therefore does not assume dumbbells, cable stations or machines. The selection engine currently falls back to bodyweight/mat/wall options that can be performed there.

Once equipment photos are reviewed, update only the apartment equipment profile; the workout templates and history do not need to be rewritten.

### Full Gym

Assumes common commercial-gym equipment and makes machine/free-weight substitutions available.

## Templates

### Full Body A

1. squat
2. horizontal push
3. horizontal pull
4. hinge
5. core

### Full Body B

1. unilateral squat
2. vertical push
3. vertical pull
4. hip extension
5. core

### Recovery Session

1. mobility
2. core
3. easy cardio

## Session modes

- **Quick:** first 3 movements, approximately 12 minutes
- **Standard:** first 4 movements, approximately 30 minutes
- **Full:** up to 5 movements, approximately 45 minutes

Changing location changes the exercise implementation, not the intended movement pattern.

Example:

```text
Vertical pull
  Home       → Prone Lat Pulldown
  Full Gym   → Lat Pulldown / Assisted Pull-up
```

## Substitution rule

A candidate exercise is eligible only when:

1. its movement matches the template slot;
2. the selected location is valid for it; and
3. every required equipment item exists in that location profile.

The location-specific rank then chooses the preferred option. The user can select another eligible substitution without changing the template's training intent.

## Energy estimates

Device-recorded active energy should be preferred when it is available. For a strength-session fallback only, Build 002 uses **3.5 MET** for resistance training involving multiple exercises in the 8–15 repetition range, corresponding to the 2024 Adult Compendium entry used during implementation. It is tagged as an **estimate**, not a measured calorie value.

The standard adult activity framework used for planning is consistent with public-health guidance to accumulate aerobic activity and perform muscle-strengthening work for the major muscle groups on at least two days per week. Zero2Fit should adapt this to actual progress/recovery rather than treating the public guideline as an individualized prescription.

## Next workout-system work

1. inventory the apartment gym from photos;
2. add exact machines/loads to its equipment profile;
3. expand the catalog as substitutions are needed;
4. record performance history per exercise;
5. add progressive-overload suggestions based on completed sets/reps/load;
6. use watch/recovery data to select Quick/Standard/Full or recovery variants;
7. validate exercise instructions and any injury-specific restrictions before presenting them as coaching.
