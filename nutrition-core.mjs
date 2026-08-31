const MAX = {
  calories: 12000,
  protein: 600,
  carbs: 1200,
  fat: 500
};

const MEAL_TYPES = new Set(['breakfast','lunch','dinner','snack','meal']);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function bounded(value, max) {
  return Math.max(0, Math.min(max, finite(value, 0)));
}

function cleanText(value, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function dayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export function normalizeTargets(targets = {}) {
  const result = {};
  for (const key of ['calories','protein','carbs','fat']) {
    const value = finite(targets?.[key], NaN);
    result[key] = Number.isFinite(value) && value > 0 ? bounded(value, MAX[key]) : null;
  }
  return result;
}

export function mealFingerprint(entry = {}) {
  return [
    cleanText(entry.name).toLowerCase(),
    Math.round(bounded(entry.calories, MAX.calories)),
    Math.round(bounded(entry.protein, MAX.protein) * 10) / 10,
    Math.round(bounded(entry.carbs, MAX.carbs) * 10) / 10,
    Math.round(bounded(entry.fat, MAX.fat) * 10) / 10,
    cleanText(entry.serving).toLowerCase()
  ].join('|');
}

export function normalizeMealEntry(entry = {}, { day = null, index = 0, now = Date.now() } = {}) {
  const resolvedDay = cleanText(entry.day) || day || dayKey(entry.loggedAt || entry.logged_at || now) || dayKey(now);
  const legacyTime = `${resolvedDay}T12:${String(index % 60).padStart(2,'0')}:00`;
  const loggedAt = cleanText(entry.loggedAt || entry.logged_at || entry.observedAt || entry.observed_at, legacyTime);
  const mealType = MEAL_TYPES.has(String(entry.mealType || entry.meal_type || '').toLowerCase())
    ? String(entry.mealType || entry.meal_type).toLowerCase()
    : 'meal';
  const normalized = {
    id: cleanText(entry.id || entry.entry_id),
    day: resolvedDay,
    name: cleanText(entry.name, 'Food entry'),
    calories: Math.round(bounded(entry.calories ?? entry.kcal, MAX.calories)),
    protein: Math.round(bounded(entry.protein ?? entry.protein_g, MAX.protein) * 10) / 10,
    carbs: Math.round(bounded(entry.carbs ?? entry.carbs_g, MAX.carbs) * 10) / 10,
    fat: Math.round(bounded(entry.fat ?? entry.fat_g, MAX.fat) * 10) / 10,
    serving: cleanText(entry.serving || entry.servingText || entry.serving_text),
    mealType,
    source: cleanText(entry.source || entry.sourceProvider || entry.source_provider, 'manual'),
    sourceItemId: cleanText(entry.sourceItemId || entry.source_item_id),
    barcode: cleanText(entry.barcode),
    loggedAt
  };
  if (!normalized.id) normalized.id = `meal_${hashText(`${resolvedDay}|${loggedAt}|${mealFingerprint(normalized)}|${index}`)}`;
  return normalized;
}

export function normalizeMealMap(meals = {}) {
  const result = {};
  for (const [day, entries] of Object.entries(meals || {})) {
    if (!Array.isArray(entries)) continue;
    result[day] = entries.map((entry, index) => normalizeMealEntry(entry, { day, index }));
  }
  return result;
}

export function normalizeSavedMeal(entry = {}, index = 0) {
  const normalized = normalizeMealEntry(entry, { day:entry.day || dayKey(), index });
  return {
    id: cleanText(entry.id || entry.saved_id, `saved_${hashText(`${mealFingerprint(normalized)}|${index}`)}`),
    name: normalized.name,
    calories: normalized.calories,
    protein: normalized.protein,
    carbs: normalized.carbs,
    fat: normalized.fat,
    serving: normalized.serving,
    mealType: normalized.mealType,
    source: cleanText(entry.source, 'saved'),
    sourceItemId: normalized.sourceItemId,
    barcode: normalized.barcode,
    savedAt: cleanText(entry.savedAt || entry.saved_at, new Date().toISOString())
  };
}

export function migrateNutritionState(input = {}) {
  const state = clone(input) || {};
  const before = JSON.stringify({
    meals:state.meals || {},
    savedMeals:state.savedMeals || [],
    nutritionTargets:state.nutritionTargets || null,
    nutritionSchemaVersion:state.nutritionSchemaVersion || 0
  });
  state.meals = normalizeMealMap(state.meals || {});
  state.savedMeals = Array.isArray(state.savedMeals) ? state.savedMeals.map(normalizeSavedMeal) : [];
  state.nutritionTargets = normalizeTargets(state.nutritionTargets || {});
  state.nutritionSchemaVersion = 1;
  const after = JSON.stringify({
    meals:state.meals,
    savedMeals:state.savedMeals,
    nutritionTargets:state.nutritionTargets,
    nutritionSchemaVersion:state.nutritionSchemaVersion
  });
  return { state, changed:before !== after };
}

export function summarizeDay(entries = [], targets = {}) {
  const normalized = entries.map((entry, index) => normalizeMealEntry(entry, { day:entry?.day, index }));
  const totals = normalized.reduce((sum, entry) => ({
    calories:sum.calories + entry.calories,
    protein:sum.protein + entry.protein,
    carbs:sum.carbs + entry.carbs,
    fat:sum.fat + entry.fat
  }), { calories:0, protein:0, carbs:0, fat:0 });
  const explicit = normalizeTargets(targets);
  const progress = Object.fromEntries(Object.keys(totals).map(key => [key,
    explicit[key] ? Math.max(0, Math.min(100, totals[key] / explicit[key] * 100)) : null
  ]));
  const macroCalories = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
  return {
    entries:normalized,
    count:normalized.length,
    totals,
    targets:explicit,
    progress,
    macroCalories,
    unallocatedCalories:Math.max(0, totals.calories - macroCalories)
  };
}

function candidateFromEntry(entry, kind, rankDate = '') {
  const normalized = normalizeMealEntry(entry, { day:entry?.day });
  return {
    id:`${kind}:${entry.id || normalized.id}`,
    kind,
    sourceId:entry.id || normalized.id,
    name:normalized.name,
    calories:normalized.calories,
    protein:normalized.protein,
    carbs:normalized.carbs,
    fat:normalized.fat,
    serving:normalized.serving,
    mealType:normalized.mealType,
    source:kind,
    sourceItemId:normalized.sourceItemId,
    barcode:normalized.barcode,
    rankDate
  };
}

export function recentMealCandidates(meals = {}, { limit = 10 } = {}) {
  const rows = [];
  for (const [day, entries] of Object.entries(normalizeMealMap(meals))) {
    for (const entry of entries) rows.push(candidateFromEntry(entry, 'recent', `${day}|${entry.loggedAt}`));
  }
  rows.sort((a,b) => String(b.rankDate).localeCompare(String(a.rankDate)));
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const fingerprint = mealFingerprint(row);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    unique.push(row);
    if (unique.length >= Math.max(1, limit)) break;
  }
  return unique;
}

export function savedMealCandidates(savedMeals = []) {
  return (Array.isArray(savedMeals) ? savedMeals : [])
    .map((entry, index) => {
      const saved = normalizeSavedMeal(entry, index);
      return candidateFromEntry({ ...saved, day:dayKey(), loggedAt:saved.savedAt }, 'saved', saved.savedAt);
    })
    .sort((a,b) => String(b.rankDate).localeCompare(String(a.rankDate)));
}

export function searchMealCandidates(query, { savedMeals = [], meals = {}, limit = 8 } = {}) {
  const text = cleanText(query).toLowerCase();
  const combined = [...savedMealCandidates(savedMeals), ...recentMealCandidates(meals, { limit:Math.max(limit * 3, 20) })];
  const deduped = new Map();
  for (const row of combined) {
    const fingerprint = mealFingerprint(row);
    if (!deduped.has(fingerprint) || row.kind === 'saved') deduped.set(fingerprint, row);
  }
  return [...deduped.values()]
    .map((row, index) => {
      const name = row.name.toLowerCase();
      const score = !text ? (row.kind === 'saved' ? 40 : 20) - index * 0.01
        : name === text ? 100
          : name.startsWith(text) ? 80
            : name.includes(text) ? 60
              : text.split(' ').every(token => name.includes(token)) ? 45
                : -1;
      return { ...row, score };
    })
    .filter(row => row.score >= 0)
    .sort((a,b) => b.score - a.score || String(b.rankDate).localeCompare(String(a.rankDate)))
    .slice(0, Math.max(1, limit));
}

export function createMealEntry(candidate = {}, { day = dayKey(), mealType = null, source = null, now = Date.now() } = {}) {
  const loggedAt = new Date(now).toISOString();
  const base = normalizeMealEntry({
    ...candidate,
    id:'',
    day,
    mealType:mealType || candidate.mealType,
    source:source || candidate.kind || candidate.source || 'manual',
    loggedAt
  }, { day, now });
  base.id = `meal_${hashText(`${day}|${loggedAt}|${mealFingerprint(base)}|${Math.random()}`)}`;
  return base;
}

export function createSavedMeal(entry = {}, { now = Date.now() } = {}) {
  const normalized = normalizeMealEntry(entry, { day:entry.day || dayKey(now) });
  return normalizeSavedMeal({
    ...normalized,
    id:`saved_${hashText(`${mealFingerprint(normalized)}|${now}`)}`,
    source:'saved',
    savedAt:new Date(now).toISOString()
  });
}

export function parseQuickLine(value) {
  const text = cleanText(value);
  if (!text) return null;
  const calories = text.match(/(\d+(?:\.\d+)?)\s*(?:kcal|cal(?:ories)?\b)/i);
  const protein = text.match(/(\d+(?:\.\d+)?)\s*(?:g\s*)?p(?:rotein)?\b/i);
  const carbs = text.match(/(\d+(?:\.\d+)?)\s*(?:g\s*)?c(?:arbs?|arbohydrate(?:s)?)?\b/i);
  const fat = text.match(/(\d+(?:\.\d+)?)\s*(?:g\s*)?f(?:at)?\b/i);
  const name = cleanText(text
    .replace(/\d+(?:\.\d+)?\s*(?:kcal|cal(?:ories)?\b)/ig, '')
    .replace(/\d+(?:\.\d+)?\s*(?:g\s*)?p(?:rotein)?\b/ig, '')
    .replace(/\d+(?:\.\d+)?\s*(?:g\s*)?c(?:arbs?|arbohydrate(?:s)?)?\b/ig, '')
    .replace(/\d+(?:\.\d+)?\s*(?:g\s*)?f(?:at)?\b/ig, '')
    .replace(/[|,;·]+/g, ' '));
  if (!name || !calories) return null;
  return {
    name,
    calories:bounded(calories[1], MAX.calories),
    protein:protein ? bounded(protein[1], MAX.protein) : 0,
    carbs:carbs ? bounded(carbs[1], MAX.carbs) : 0,
    fat:fat ? bounded(fat[1], MAX.fat) : 0,
    source:'quick_line'
  };
}

function addDays(day, offset) {
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + offset);
  return dayKey(date);
}

export function nutritionConsistency(meals = {}, { now = Date.now(), days = 7 } = {}) {
  const end = dayKey(now);
  const size = Math.max(1, Math.round(finite(days, 7)));
  const keys = Array.from({ length:size }, (_, index) => addDays(end, -(size - 1 - index)));
  const normalized = normalizeMealMap(meals);
  const summaries = keys.map(day => ({ day, ...summarizeDay(normalized[day] || {}) }));
  const logged = summaries.filter(row => row.count > 0);
  const average = key => logged.length ? logged.reduce((sum,row) => sum + row.totals[key], 0) / logged.length : null;
  return {
    days:size,
    daysLogged:logged.length,
    coverage:logged.length / size,
    entries:logged.reduce((sum,row) => sum + row.count, 0),
    averageCalories:average('calories'),
    averageProtein:average('protein'),
    averageCarbs:average('carbs'),
    averageFat:average('fat'),
    daySummaries:summaries
  };
}
