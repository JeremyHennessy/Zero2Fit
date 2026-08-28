const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function normalizeMeal(meal = {}) {
  const name = String(meal.name || '').trim().replace(/\s+/g, ' ');
  const calories = Number(meal.calories);
  const protein = Number(meal.protein);
  if (!name || !Number.isFinite(calories) || calories < 0 || !Number.isFinite(protein) || protein < 0) return null;
  return {
    name,
    calories:Math.round(calories),
    protein:Math.round(protein * 10) / 10
  };
}

export function mealIdentity(meal = {}) {
  const normalized = normalizeMeal(meal);
  if (!normalized) return null;
  return `${normalized.name.toLowerCase()}|${normalized.calories}|${normalized.protein}`;
}

export function scaleMeal(meal = {}, multiplier = 1) {
  const normalized = normalizeMeal(meal);
  if (!normalized) return null;
  const factor = clamp(Number(multiplier) || 1, 0.25, 4);
  return {
    ...normalized,
    calories:Math.round(normalized.calories * factor),
    protein:Math.round(normalized.protein * factor * 10) / 10,
    multiplier:factor
  };
}

export function recentMealOptions(mealsByDay = {}, limit = 8) {
  const groups = new Map();
  for (const [day, meals] of Object.entries(mealsByDay || {})) {
    for (const raw of Array.isArray(meals) ? meals : []) {
      const meal = normalizeMeal(raw);
      const id = mealIdentity(meal);
      if (!meal || !id) continue;
      const prior = groups.get(id) || { id, ...meal, uses:0, lastDay:null };
      prior.uses += 1;
      if (!prior.lastDay || String(day) > prior.lastDay) prior.lastDay = String(day);
      groups.set(id, prior);
    }
  }
  return [...groups.values()]
    .sort((a,b) => String(b.lastDay).localeCompare(String(a.lastDay)) || b.uses - a.uses || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, Number(limit) || 0));
}

export function mealsForDay(mealsByDay = {}, day) {
  return (Array.isArray(mealsByDay?.[day]) ? mealsByDay[day] : []).map(normalizeMeal).filter(Boolean);
}

export function mergeSavedMeals(saved = [], meal) {
  const normalized = normalizeMeal(meal);
  const id = mealIdentity(normalized);
  if (!normalized || !id) return saved.filter(Boolean);
  const filtered = saved.filter(item => mealIdentity(item) !== id).map(normalizeMeal).filter(Boolean);
  return [{ id, ...normalized }, ...filtered].slice(0, 24);
}

export function removeSavedMeal(saved = [], id) {
  return saved.filter(item => mealIdentity(item) !== id && item?.id !== id);
}

export function normalizeTargets(value = {}) {
  const calories = Number(value.calories);
  const protein = Number(value.protein);
  return {
    calories:Number.isFinite(calories) && calories >= 500 && calories <= 6000 ? Math.round(calories) : null,
    protein:Number.isFinite(protein) && protein >= 20 && protein <= 400 ? Math.round(protein) : null
  };
}

export function dayOffset(day = new Date(), offsetDays = 0) {
  const d = day instanceof Date ? new Date(day) : new Date(day);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + Number(offsetDays || 0));
  return d.toISOString().slice(0,10);
}
