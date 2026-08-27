(() => {
  'use strict';

  const exercises = [
    { id:'chair-squat', name:'Chair Squat', movement:'squat', muscles:['quadriceps','glutes'], requiredEquipment:['chair'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:8, repRange:[6,12], cue:'Sit back to the chair under control, then stand tall.', locationRank:{home:1,apartment:2,gym:4}, substitutionGroup:'squat' },
    { id:'bodyweight-squat', name:'Bodyweight Squat', movement:'squat', muscles:['quadriceps','glutes'], requiredEquipment:['bodyweight'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:10, repRange:[8,15], cue:'Use a comfortable depth and keep the whole foot planted.', locationRank:{home:2,apartment:1,gym:3}, substitutionGroup:'squat' },
    { id:'goblet-squat', name:'Goblet Squat', movement:'squat', muscles:['quadriceps','glutes','core'], requiredEquipment:['dumbbell'], locations:['apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:10, repRange:[8,12], cue:'Hold the dumbbell close to the chest and keep the torso controlled.', locationRank:{apartment:3,gym:2}, substitutionGroup:'squat' },
    { id:'leg-press', name:'Leg Press', movement:'squat', muscles:['quadriceps','glutes'], requiredEquipment:['leg_press'], locations:['gym'], difficulty:'beginner', defaultSets:3, defaultReps:10, repRange:[8,15], cue:'Use a pain-free range and keep hips supported.', locationRank:{gym:1}, substitutionGroup:'squat' },

    { id:'supported-split-squat', name:'Supported Split Squat', movement:'unilateral_squat', muscles:['quadriceps','glutes'], requiredEquipment:['stable_surface'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:2, defaultReps:8, repRange:[6,12], cue:'Use support for balance and lower straight down.', locationRank:{home:1,apartment:2,gym:3}, substitutionGroup:'unilateral_squat' },
    { id:'reverse-lunge', name:'Reverse Lunge', movement:'unilateral_squat', muscles:['quadriceps','glutes'], requiredEquipment:['bodyweight'], locations:['home','apartment','gym'], difficulty:'intermediate', defaultSets:2, defaultReps:8, repRange:[6,12], cue:'Step back far enough to keep the front foot stable.', locationRank:{home:2,apartment:1,gym:2}, substitutionGroup:'unilateral_squat' },
    { id:'dumbbell-split-squat', name:'Dumbbell Split Squat', movement:'unilateral_squat', muscles:['quadriceps','glutes'], requiredEquipment:['dumbbell'], locations:['apartment','gym'], difficulty:'intermediate', defaultSets:3, defaultReps:8, repRange:[6,12], cue:'Keep stance fixed and add load only after balance is reliable.', locationRank:{apartment:3,gym:1}, substitutionGroup:'unilateral_squat' },

    { id:'wall-push-up', name:'Wall Push-up', movement:'horizontal_push', muscles:['chest','triceps','front_deltoids'], requiredEquipment:['wall'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:10, repRange:[8,15], cue:'Keep body straight and bring chest toward the wall.', locationRank:{home:1,apartment:3,gym:5}, substitutionGroup:'horizontal_push' },
    { id:'incline-push-up', name:'Incline Push-up', movement:'horizontal_push', muscles:['chest','triceps','front_deltoids'], requiredEquipment:['stable_surface'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:8, repRange:[6,15], cue:'Choose a height that lets every rep stay smooth.', locationRank:{home:2,apartment:2,gym:4}, substitutionGroup:'horizontal_push' },
    { id:'push-up', name:'Push-up', movement:'horizontal_push', muscles:['chest','triceps','front_deltoids','core'], requiredEquipment:['bodyweight'], locations:['home','apartment','gym'], difficulty:'intermediate', defaultSets:3, defaultReps:8, repRange:[5,15], cue:'Brace the trunk and lower as one unit.', locationRank:{home:3,apartment:1,gym:3}, substitutionGroup:'horizontal_push' },
    { id:'dumbbell-bench-press', name:'Dumbbell Bench Press', movement:'horizontal_push', muscles:['chest','triceps','front_deltoids'], requiredEquipment:['dumbbell','bench'], locations:['apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:10, repRange:[8,12], cue:'Keep shoulder blades supported and control the dumbbells.', locationRank:{apartment:4,gym:2}, substitutionGroup:'horizontal_push' },
    { id:'machine-chest-press', name:'Machine Chest Press', movement:'horizontal_push', muscles:['chest','triceps','front_deltoids'], requiredEquipment:['chest_press_machine'], locations:['gym'], difficulty:'beginner', defaultSets:3, defaultReps:10, repRange:[8,15], cue:'Set the seat so handles begin near mid-chest.', locationRank:{gym:1}, substitutionGroup:'horizontal_push' },

    { id:'prone-w-raise', name:'Prone W Raise', movement:'horizontal_pull', muscles:['upper_back','rear_deltoids'], requiredEquipment:['yoga_mat'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:2, defaultReps:10, repRange:[8,15], cue:'Lift only as far as you can without shrugging.', locationRank:{home:1,apartment:3,gym:5}, substitutionGroup:'horizontal_pull' },
    { id:'one-arm-dumbbell-row', name:'One-arm Dumbbell Row', movement:'horizontal_pull', muscles:['lats','upper_back','biceps'], requiredEquipment:['dumbbell','stable_surface'], locations:['apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:10, repRange:[8,15], cue:'Pull the elbow toward the hip and pause briefly.', locationRank:{apartment:2,gym:2}, substitutionGroup:'horizontal_pull' },
    { id:'seated-cable-row', name:'Seated Cable Row', movement:'horizontal_pull', muscles:['lats','upper_back','biceps'], requiredEquipment:['cable_row'], locations:['gym'], difficulty:'beginner', defaultSets:3, defaultReps:10, repRange:[8,15], cue:'Stay tall and finish with the shoulder blades moving back.', locationRank:{gym:1}, substitutionGroup:'horizontal_pull' },

    { id:'wall-slide', name:'Wall Slide', movement:'vertical_push', muscles:['shoulders','upper_back'], requiredEquipment:['wall'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:2, defaultReps:10, repRange:[8,15], cue:'Move only through the range you can control without arching.', locationRank:{home:1,apartment:2,gym:4}, substitutionGroup:'vertical_push' },
    { id:'dumbbell-shoulder-press', name:'Dumbbell Shoulder Press', movement:'vertical_push', muscles:['shoulders','triceps'], requiredEquipment:['dumbbell'], locations:['apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:8, repRange:[6,12], cue:'Press without leaning back; stop before form changes.', locationRank:{apartment:1,gym:1}, substitutionGroup:'vertical_push' },

    { id:'prone-lat-pulldown', name:'Prone Lat Pulldown', movement:'vertical_pull', muscles:['lats','upper_back'], requiredEquipment:['yoga_mat'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:2, defaultReps:10, repRange:[8,15], cue:'Reach overhead, then draw elbows toward your ribs under control.', locationRank:{home:1,apartment:3,gym:5}, substitutionGroup:'vertical_pull' },
    { id:'lat-pulldown', name:'Lat Pulldown', movement:'vertical_pull', muscles:['lats','upper_back','biceps'], requiredEquipment:['lat_pulldown'], locations:['gym'], difficulty:'beginner', defaultSets:3, defaultReps:10, repRange:[8,15], cue:'Pull toward the upper chest without leaning far back.', locationRank:{gym:1}, substitutionGroup:'vertical_pull' },
    { id:'assisted-pull-up', name:'Assisted Pull-up', movement:'vertical_pull', muscles:['lats','upper_back','biceps'], requiredEquipment:['assisted_pullup'], locations:['gym'], difficulty:'intermediate', defaultSets:3, defaultReps:6, repRange:[5,10], cue:'Use enough assistance to keep a controlled full rep.', locationRank:{gym:2}, substitutionGroup:'vertical_pull' },

    { id:'bodyweight-good-morning', name:'Bodyweight Good Morning', movement:'hinge', muscles:['hamstrings','glutes','erectors'], requiredEquipment:['bodyweight'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:2, defaultReps:10, repRange:[8,15], cue:'Push hips back while keeping the trunk long.', locationRank:{home:1,apartment:2,gym:4}, substitutionGroup:'hinge' },
    { id:'dumbbell-rdl', name:'Dumbbell Romanian Deadlift', movement:'hinge', muscles:['hamstrings','glutes','erectors'], requiredEquipment:['dumbbell'], locations:['apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:10, repRange:[8,12], cue:'Keep weights close and stop when hamstrings limit the hinge.', locationRank:{apartment:1,gym:2}, substitutionGroup:'hinge' },
    { id:'barbell-rdl', name:'Barbell Romanian Deadlift', movement:'hinge', muscles:['hamstrings','glutes','erectors'], requiredEquipment:['barbell'], locations:['gym'], difficulty:'intermediate', defaultSets:3, defaultReps:8, repRange:[6,12], cue:'Brace first, keep the bar close, and hinge rather than squat.', locationRank:{gym:1}, substitutionGroup:'hinge' },

    { id:'glute-bridge', name:'Glute Bridge', movement:'hip_extension', muscles:['glutes','hamstrings'], requiredEquipment:['yoga_mat'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:12, repRange:[10,20], cue:'Finish by squeezing the glutes without over-arching the back.', locationRank:{home:1,apartment:2,gym:4}, substitutionGroup:'hip_extension' },
    { id:'dumbbell-hip-thrust', name:'Dumbbell Hip Thrust', movement:'hip_extension', muscles:['glutes','hamstrings'], requiredEquipment:['dumbbell','bench'], locations:['apartment','gym'], difficulty:'intermediate', defaultSets:3, defaultReps:10, repRange:[8,15], cue:'Keep ribs controlled and drive through the feet.', locationRank:{apartment:1,gym:1}, substitutionGroup:'hip_extension' },

    { id:'bird-dog', name:'Bird Dog', movement:'core', muscles:['core','glutes','back'], requiredEquipment:['yoga_mat'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:2, defaultReps:8, repRange:[6,12], cue:'Move slowly without letting the torso rotate.', locationRank:{home:1,apartment:3,gym:5}, substitutionGroup:'core' },
    { id:'dead-bug', name:'Dead Bug', movement:'core', muscles:['core'], requiredEquipment:['yoga_mat'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:2, defaultReps:8, repRange:[6,12], cue:'Keep the trunk braced as the opposite arm and leg extend.', locationRank:{home:2,apartment:2,gym:4}, substitutionGroup:'core' },
    { id:'front-plank', name:'Front Plank', movement:'core', muscles:['core','shoulders'], requiredEquipment:['yoga_mat'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:2, defaultReps:20, repRange:[15,45], repUnit:'seconds', cue:'Keep a straight line and stop before the hips sag.', locationRank:{home:3,apartment:1,gym:3}, substitutionGroup:'core' },
    { id:'pallof-press', name:'Pallof Press', movement:'core', muscles:['core'], requiredEquipment:['cable_machine'], locations:['gym'], difficulty:'beginner', defaultSets:2, defaultReps:10, repRange:[8,15], cue:'Resist rotation as the hands press away from the chest.', locationRank:{gym:1}, substitutionGroup:'core' },

    { id:'standing-calf-raise', name:'Standing Calf Raise', movement:'calf', muscles:['calves'], requiredEquipment:['stable_surface'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:2, defaultReps:12, repRange:[10,20], cue:'Use support for balance and pause briefly at the top.', locationRank:{home:1,apartment:2,gym:3}, substitutionGroup:'calf' },
    { id:'dumbbell-calf-raise', name:'Dumbbell Calf Raise', movement:'calf', muscles:['calves'], requiredEquipment:['dumbbell'], locations:['apartment','gym'], difficulty:'beginner', defaultSets:3, defaultReps:12, repRange:[10,20], cue:'Add load only when balance and range remain controlled.', locationRank:{apartment:1,gym:1}, substitutionGroup:'calf' },

    { id:'brisk-walk', name:'Brisk Walk', movement:'cardio', muscles:['cardiorespiratory'], requiredEquipment:['bodyweight'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:1, defaultReps:20, repRange:[10,45], repUnit:'minutes', cue:'Use a sustainable pace that noticeably raises breathing.', locationRank:{home:1,apartment:3,gym:4}, substitutionGroup:'cardio' },
    { id:'treadmill-walk', name:'Treadmill Walk', movement:'cardio', muscles:['cardiorespiratory'], requiredEquipment:['treadmill'], locations:['apartment','gym'], difficulty:'beginner', defaultSets:1, defaultReps:20, repRange:[10,45], repUnit:'minutes', cue:'Use a comfortable pace and incline appropriate to the session.', locationRank:{apartment:1,gym:1}, substitutionGroup:'cardio' },
    { id:'stationary-bike', name:'Stationary Bike', movement:'cardio', muscles:['cardiorespiratory','quadriceps'], requiredEquipment:['stationary_bike'], locations:['apartment','gym'], difficulty:'beginner', defaultSets:1, defaultReps:20, repRange:[10,45], repUnit:'minutes', cue:'Use a steady resistance that lets cadence stay smooth.', locationRank:{apartment:2,gym:2}, substitutionGroup:'cardio' },

    { id:'cat-cow', name:'Cat-Cow', movement:'mobility', muscles:['spine','core'], requiredEquipment:['yoga_mat'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:1, defaultReps:8, repRange:[6,12], cue:'Move gently through a comfortable spinal range.', locationRank:{home:1,apartment:1,gym:1}, substitutionGroup:'mobility' },
    { id:'childs-pose', name:"Child's Pose", movement:'mobility', muscles:['back','hips'], requiredEquipment:['yoga_mat'], locations:['home','apartment','gym'], difficulty:'beginner', defaultSets:1, defaultReps:30, repRange:[20,60], repUnit:'seconds', cue:'Settle into a comfortable stretch without forcing depth.', locationRank:{home:2,apartment:2,gym:2}, substitutionGroup:'mobility' }
  ];

  const equipmentProfiles = {
    home: {
      id: 'home', label: 'Home', confirmed: true,
      equipment: ['bodyweight','yoga_mat','chair','stable_surface','wall'],
      confirmedEquipment: ['bodyweight','yoga_mat'],
      assumedHouseholdSupport: ['chair','stable_surface','wall'],
      note: 'Confirmed: bodyweight and yoga mat. Chair, wall and a stable household surface are treated as optional supports, not dedicated gym equipment.'
    },
    apartment: {
      id: 'apartment', label: 'Apartment Gym', confirmed: false,
      equipment: ['bodyweight','yoga_mat','wall'],
      confirmedEquipment: [],
      note: 'Apartment gym equipment has not been inventoried from photos yet. Until then, Zero2Fit will not assume dumbbells, cables or machines are available.'
    },
    gym: {
      id: 'gym', label: 'Full Gym', confirmed: true, assumption: 'common_commercial_gym',
      equipment: ['bodyweight','yoga_mat','chair','stable_surface','wall','dumbbell','bench','barbell','leg_press','chest_press_machine','cable_row','cable_machine','lat_pulldown','assisted_pullup','treadmill','stationary_bike'],
      note: 'Full Gym assumes common commercial-gym equipment. Substitute automatically when a specific machine is unavailable.'
    }
  };

  const templates = {
    'foundation-a': { id:'foundation-a', name:'Full Body A', focus:'Foundation strength', movements:['squat','horizontal_push','horizontal_pull','hinge','core'] },
    'foundation-b': { id:'foundation-b', name:'Full Body B', focus:'Foundation strength', movements:['unilateral_squat','vertical_push','vertical_pull','hip_extension','core'] },
    recovery: { id:'recovery', name:'Recovery Session', focus:'Mobility and easy movement', movements:['mobility','core','cardio'] }
  };

  const modeLimits = { quick:3, standard:4, full:5 };
  const modeDurations = { quick:12, standard:30, full:45 };

  function equipmentAvailable(exercise, profile) {
    return exercise.requiredEquipment.every(item => profile.equipment.includes(item));
  }

  function choicesForMovement(movement, location) {
    const profile = equipmentProfiles[location] || equipmentProfiles.home;
    return exercises
      .filter(exercise => exercise.movement === movement && exercise.locations.includes(profile.id) && equipmentAvailable(exercise, profile))
      .sort((a,b) => (a.locationRank?.[profile.id] ?? 99) - (b.locationRank?.[profile.id] ?? 99));
  }

  function buildWorkout(templateId = 'foundation-a', location = 'home', mode = 'standard', overrides = {}) {
    const template = templates[templateId] || templates['foundation-a'];
    const slotCount = Math.min(template.movements.length, modeLimits[mode] || modeLimits.standard);
    const selections = template.movements.slice(0, slotCount).map(movement => {
      const choices = choicesForMovement(movement, location);
      const requestedId = overrides[movement];
      const selected = choices.find(exercise => exercise.id === requestedId) || choices[0] || null;
      return { movement, selected, choices };
    });
    return { template, location, mode, durationMinutes: modeDurations[mode] || modeDurations.standard, selections };
  }

  function estimateSessionEnergy({ templateId = 'foundation-a', mode = 'standard', bodyWeightLb = null } = {}) {
    const minutes = modeDurations[mode] || modeDurations.standard;
    if (!Number.isFinite(Number(bodyWeightLb)) || Number(bodyWeightLb) <= 0) return null;
    if (!['foundation-a','foundation-b'].includes(templateId)) return null;
    const met = 3.5;
    const kg = Number(bodyWeightLb) * 0.45359237;
    const estimatedKcal = met * 3.5 * kg / 200 * minutes;
    return {
      estimatedKcal: Math.round(estimatedKcal), met, minutes,
      confidence: 'estimated',
      source: '2024 Adult Compendium of Physical Activities, resistance training multiple exercises 8–15 reps (code 02054)'
    };
  }

  function exerciseById(id) {
    return exercises.find(exercise => exercise.id === id) || null;
  }

  window.Zero2FitExercises = {
    exercises,
    equipmentProfiles,
    templates,
    modeLimits,
    modeDurations,
    choicesForMovement,
    buildWorkout,
    estimateSessionEnergy,
    exerciseById
  };
})();
