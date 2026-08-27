const DEFAULT_WEIGHTS = {
  sameMovementPattern: 40,
  preferredMovementPattern: 28,
  samePrimaryMuscle: 22,
  primaryMuscleOverlapPerMuscle: 10,
  sameForce: 8,
  sameMechanic: 5,
  sameDifficulty: 4,
  oneDifficultyStepAway: 2
};

const LEVEL_ORDER = { beginner: 0, intermediate: 1, expert: 2 };

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function overlapCount(a = [], b = []) {
  const right = new Set(b);
  return unique(a).filter(value => right.has(value)).length;
}

function qualityBand(score, qualityBands = {}) {
  const thresholds = Object.entries(qualityBands)
    .map(([threshold, label]) => [Number(threshold), label])
    .filter(([threshold]) => Number.isFinite(threshold))
    .sort((a, b) => b[0] - a[0]);
  for (const [threshold, label] of thresholds) if (score >= threshold) return label;
  if (score >= 80) return 'direct_substitute';
  if (score >= 55) return 'good_substitute';
  if (score >= 35) return 'partial_substitute';
  return 'fallback_only';
}

export function locationCompatible(exercise, locationKey) {
  return !!exercise?.locationCompatibility?.[locationKey];
}

export function scoreExerciseForSlot(exercise, slot, options = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
  const preferredPatterns = slot.preferredPatterns || [];
  const targetMuscles = slot.primaryMuscles || [];
  const patternRank = preferredPatterns.indexOf(exercise.movementPattern);
  const muscleOverlap = overlapCount(exercise.primaryMuscles, targetMuscles);
  let score = 0;
  const reasons = [];

  if (patternRank === 0) {
    score += weights.sameMovementPattern;
    reasons.push(`matches ${slot.intent || exercise.movementPattern} movement pattern`);
  } else if (patternRank > 0) {
    score += Math.max(8, weights.preferredMovementPattern - patternRank * 4);
    reasons.push(`matches a preferred ${exercise.movementPattern} pattern`);
  }

  if (targetMuscles[0] && exercise.primaryMuscles?.includes(targetMuscles[0])) {
    score += weights.samePrimaryMuscle;
    reasons.push(`directly targets ${targetMuscles[0]}`);
  }
  if (muscleOverlap) {
    score += muscleOverlap * weights.primaryMuscleOverlapPerMuscle;
    if (!reasons.some(reason => reason.startsWith('directly targets'))) reasons.push(`targets ${muscleOverlap} requested muscle group${muscleOverlap === 1 ? '' : 's'}`);
  }

  if (exercise.category === 'strength') score += 12;
  else if (exercise.category === 'stretching') score -= slot.intent?.includes('core') ? 0 : 12;
  else if (exercise.category === 'plyometrics') score -= 5;
  else if (exercise.category === 'olympic weightlifting' || exercise.category === 'strongman') score -= 18;

  if (exercise.level === 'beginner') {
    score += 12;
    reasons.push('beginner-friendly catalog entry');
  } else if (exercise.level === 'intermediate') {
    score += 4;
  } else if (exercise.level === 'expert') {
    score -= 12;
  }

  if (exercise.mechanic === 'compound' && !slot.intent?.includes('core')) score += 4;
  if (exercise.requiredEquipment?.length === 0) score += options.preferSimpleEquipment ? 4 : 0;

  return { score, reasons: unique(reasons) };
}

export function rankCandidates(exercises, slot, locationKey, options = {}) {
  return exercises
    .filter(exercise => locationCompatible(exercise, locationKey))
    .map(exercise => ({ exercise, ...scoreExerciseForSlot(exercise, slot, options) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
}

export function scoreSubstitute(candidate, current, slot, options = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
  const base = scoreExerciseForSlot(candidate, slot, options);
  let score = base.score;
  const reasons = [...base.reasons];

  if (candidate.movementPattern === current.movementPattern) {
    score += weights.sameMovementPattern;
    reasons.push('same movement pattern as current exercise');
  }
  if (candidate.primaryMuscles?.[0] && candidate.primaryMuscles[0] === current.primaryMuscles?.[0]) {
    score += weights.samePrimaryMuscle;
    reasons.push('same primary muscle as current exercise');
  }
  const sharedMuscles = overlapCount(candidate.primaryMuscles, current.primaryMuscles);
  if (sharedMuscles) score += sharedMuscles * weights.primaryMuscleOverlapPerMuscle;
  if (candidate.force && current.force && candidate.force === current.force) score += weights.sameForce;
  if (candidate.mechanic && current.mechanic && candidate.mechanic === current.mechanic) score += weights.sameMechanic;

  const currentLevel = LEVEL_ORDER[current.level];
  const candidateLevel = LEVEL_ORDER[candidate.level];
  if (Number.isFinite(currentLevel) && Number.isFinite(candidateLevel)) {
    const distance = Math.abs(currentLevel - candidateLevel);
    if (distance === 0) score += weights.sameDifficulty;
    else if (distance === 1) score += weights.oneDifficultyStepAway;
  }

  return { score, reasons: unique(reasons) };
}

export function rankSubstitutes(exercises, currentExercise, slot, locationKey, substitutionRules = {}) {
  const options = {
    weights: substitutionRules.scoreWeights || DEFAULT_WEIGHTS,
    preferSimpleEquipment: locationKey !== 'fullGym'
  };
  return exercises
    .filter(candidate => candidate.id !== currentExercise.id && locationCompatible(candidate, locationKey))
    .map(candidate => ({
      exercise: candidate,
      ...scoreSubstitute(candidate, currentExercise, slot, options)
    }))
    .filter(item => item.score > 0)
    .map(item => ({
      ...item,
      quality: qualityBand(item.score, substitutionRules.qualityBands)
    }))
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
}

function modeSettings(programmingRules, mode) {
  const key = `${mode}Mode`;
  return programmingRules?.foundationPhase?.[key] || {
    targetMinutes: mode === 'quick' ? 12 : mode === 'full' ? 45 : 30,
    slotLimit: mode === 'quick' ? 3 : mode === 'full' ? 5 : 4,
    defaultSetsPerExercise: mode === 'quick' ? 1 : 2
  };
}

export function generateWorkout({ exercises, template, locationKey, mode = 'standard', previousSelections = {}, programmingRules = {}, substitutionRules = {} }) {
  if (!template?.slots?.length) return { slots: [], targetMinutes: 0, warnings: ['Workout template has no slots.'] };
  const settings = modeSettings(programmingRules, mode);
  const selectedIds = new Set();
  const warnings = [];
  const slots = template.slots.slice(0, settings.slotLimit).map(slot => {
    const ranked = rankCandidates(exercises, slot, locationKey, { preferSimpleEquipment: locationKey !== 'fullGym' });
    const previousId = previousSelections[slot.intent];
    let chosen = previousId ? ranked.find(item => item.exercise.id === previousId) : null;
    if (!chosen || selectedIds.has(chosen.exercise.id)) chosen = ranked.find(item => !selectedIds.has(item.exercise.id));
    if (!chosen) {
      warnings.push(`No compatible exercise found for ${slot.intent}.`);
      return { slot, exercise: null, score: 0, quality: 'unavailable', reasons: [], sets: settings.defaultSetsPerExercise };
    }
    selectedIds.add(chosen.exercise.id);
    const quality = qualityBand(chosen.score, substitutionRules.qualityBands);
    if ((slot.intent === 'vertical_pull_lats' || slot.primaryMuscles?.includes('lats')) && locationKey !== 'fullGym' && quality === 'fallback_only') {
      warnings.push('No true loaded lat pull is available with the confirmed equipment; the selected movement is pattern practice only.');
    }
    return {
      slot,
      exercise: chosen.exercise,
      score: chosen.score,
      quality,
      reasons: chosen.reasons,
      sets: settings.defaultSetsPerExercise,
      repRange: slot.repRange || [8, 12]
    };
  });

  return { slots, targetMinutes: settings.targetMinutes, warnings };
}

export function estimateEnergy({ met, weightLb, durationMinutes }) {
  const weightKg = Number(weightLb) * 0.45359237;
  const minutes = Number(durationMinutes);
  const numericMet = Number(met);
  if (!(weightKg > 0) || !(minutes > 0) || !(numericMet > 0)) return null;
  return {
    grossKcal: numericMet * weightKg * minutes / 60,
    activeKcal: Math.max(0, (numericMet - 1) * weightKg * minutes / 60),
    weightKg,
    durationMinutes: minutes,
    met: numericMet
  };
}

export function sessionEnergyProfile({ locationKey, mode, energyModel }) {
  const profiles = energyModel?.referenceProfiles || {};
  if (mode === 'quick') return profiles.circuit_light || { code: '02034', met: 3.5, description: 'Circuit training, light effort' };
  if (locationKey === 'home' || locationKey === 'apartmentGym') return profiles.bodyweight_general || { code: '02056', met: 3.0, description: 'Body weight resistance exercises, general' };
  return profiles.resistance_general || { code: '02054', met: 3.5, description: 'Resistance training, multiple exercises' };
}

export function formatQuality(quality) {
  return ({
    direct_substitute: 'Direct match',
    good_substitute: 'Good match',
    partial_substitute: 'Partial match',
    fallback_only: 'Fallback',
    unavailable: 'Unavailable'
  })[quality] || 'Match';
}
