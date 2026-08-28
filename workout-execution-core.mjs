const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function parseWorkoutSetKey(key) {
  const parts = String(key || '').split(':');
  if (parts.length < 5) return null;
  const setIndex = Number(parts.at(-1));
  if (!Number.isInteger(setIndex) || setIndex < 0) return null;
  return {
    location:parts[0],
    templateId:parts[1],
    intent:parts[2],
    exerciseId:parts.slice(3, -1).join(':'),
    setIndex
  };
}

export function completionSummary(sets = []) {
  const eligible = sets.filter(item => item && item.key);
  const completed = eligible.filter(item => item.done).length;
  return {
    total:eligible.length,
    completed,
    remaining:Math.max(0, eligible.length - completed),
    percent:eligible.length ? Math.round(completed / eligible.length * 100) : 0,
    complete:Boolean(eligible.length) && completed === eligible.length
  };
}

export function chooseActiveSet(sets = [], { preferredKey = null, skippedKeys = [] } = {}) {
  const skipped = new Set(skippedKeys || []);
  const incomplete = sets.filter(item => item?.key && !item.done);
  if (!incomplete.length) return null;
  if (preferredKey) {
    const preferred = incomplete.find(item => item.key === preferredKey && !skipped.has(item.key));
    if (preferred) return preferred;
  }
  return incomplete.find(item => !skipped.has(item.key)) || incomplete[0];
}

export function nextIncompleteSet(sets = [], currentKey, { skippedKeys = [] } = {}) {
  const skipped = new Set(skippedKeys || []);
  const currentIndex = Math.max(-1, sets.findIndex(item => item?.key === currentKey));
  const after = sets.slice(currentIndex + 1).find(item => item?.key && !item.done && !skipped.has(item.key));
  if (after) return after;
  const before = sets.slice(0, Math.max(0, currentIndex + 1)).find(item => item?.key && !item.done && !skipped.has(item.key));
  if (before) return before;
  return sets.find(item => item?.key && !item.done) || null;
}

export function restSecondsForIntent(intent, overrides = {}) {
  if (Number.isFinite(Number(overrides?.[intent]))) return clamp(Math.round(Number(overrides[intent])), 15, 300);
  if (['core','core_stability'].includes(intent)) return 60;
  if (['knee_dominant','horizontal_push','horizontal_pull','hip_hinge','single_leg','vertical_push','vertical_pull_lats','posterior_chain'].includes(intent)) return 90;
  return 75;
}

export function adjustNumber(value, delta, { min = 0, max = 1000, precision = 1 } = {}) {
  const current = Number(value);
  const base = Number.isFinite(current) ? current : 0;
  const next = clamp(base + Number(delta || 0), min, max);
  const factor = 10 ** Math.max(0, Math.min(4, Number(precision) || 0));
  return Math.round(next * factor) / factor;
}

export function formatTarget({ reps, load = null, bodyweight = false } = {}) {
  const numericReps = Number(reps);
  const repsText = Number.isFinite(numericReps) ? `${numericReps} reps` : 'reps not set';
  if (bodyweight || !Number.isFinite(Number(load))) return `Bodyweight × ${repsText}`;
  const numericLoad = Number(load);
  const loadText = Number.isInteger(numericLoad) ? String(numericLoad) : numericLoad.toFixed(1);
  return `${loadText} lb × ${repsText}`;
}

export function setPosition(sets = [], key) {
  const index = sets.findIndex(item => item?.key === key);
  if (index < 0) return { index:0, total:sets.length, label:sets.length ? `Set 1 of ${sets.length}` : 'No sets' };
  return { index:index + 1, total:sets.length, label:`Set ${index + 1} of ${sets.length}` };
}

export function exercisePosition(sets = [], key) {
  const ordered = [];
  for (const item of sets) {
    if (!item?.exerciseId || ordered.includes(item.exerciseId)) continue;
    ordered.push(item.exerciseId);
  }
  const active = sets.find(item => item?.key === key);
  const index = active ? ordered.indexOf(active.exerciseId) : -1;
  return {
    index:index >= 0 ? index + 1 : 0,
    total:ordered.length,
    label:index >= 0 ? `Exercise ${index + 1} of ${ordered.length}` : `Exercise 0 of ${ordered.length}`
  };
}
