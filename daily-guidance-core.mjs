export const QUEST_IDS = Object.freeze({
  move: 'move',
  train: 'train',
  nutrition: 'nutrition',
  recovery: 'recovery'
});

export function dayKey(input = new Date()) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeDay({ appState = {}, fuelState = {}, day = dayKey() } = {}) {
  const app = asObject(appState);
  const fuel = asObject(fuelState);
  const quests = asObject(asObject(app.quests)[day]);
  const steps = number(asObject(app.steps)[day]);
  const fuelMeals = asArray(asObject(fuel.meals)[day]);
  const legacyMeals = asArray(asObject(app.meals)[day]);
  const meals = fuelMeals.length ? fuelMeals : legacyMeals;
  const workoutDates = new Set(asArray(app.workoutDates).map(String));
  const activeSessionKeys = Object.entries(asObject(app.workoutSessionStarts))
    .filter(([key, startedAt]) => String(key).startsWith(`${day}:`) && number(startedAt) > 0)
    .map(([key]) => key);

  const status = {
    move: Boolean(quests[QUEST_IDS.move]) || steps >= 7000,
    train: Boolean(quests[QUEST_IDS.train]) || workoutDates.has(day),
    nutrition: Boolean(quests[QUEST_IDS.nutrition]) || meals.length > 0,
    recovery: Boolean(quests[QUEST_IDS.recovery])
  };

  const completeCount = Object.values(status).filter(Boolean).length;
  return {
    day,
    steps,
    mealsLogged: meals.length,
    activeWorkout: activeSessionKeys.length > 0 && !status.train,
    activeSessionKeys,
    status,
    completeCount,
    allComplete: completeCount === 4
  };
}

export function recommendNextAction(summary = {}) {
  const status = asObject(summary.status);
  const completeCount = number(summary.completeCount);
  const steps = number(summary.steps);

  if (summary.activeWorkout && !status.train) {
    return {
      id: 'continue_workout',
      kind: 'train',
      eyebrow: 'IN PROGRESS',
      title: 'Finish the session you already started',
      detail: 'Do the next unfinished set. You do not need to restart or make a new plan.',
      cta: 'Continue workout',
      page: 'train',
      mode: null,
      priority: 100
    };
  }

  if (summary.allComplete) {
    return {
      id: 'day_complete',
      kind: 'done',
      eyebrow: 'ENOUGH FOR TODAY',
      title: 'The useful work is done',
      detail: 'No extra task is required. Keep the win and let tomorrow be tomorrow.',
      cta: 'View progress',
      page: 'journey',
      mode: null,
      priority: 0
    };
  }

  if (completeCount === 0 && !status.move) {
    return {
      id: 'start_move',
      kind: 'move',
      eyebrow: 'LOWEST FRICTION',
      title: 'Take a 10-minute purposeful walk',
      detail: steps > 0
        ? `${steps.toLocaleString()} steps are already on the board. A short walk is the smallest useful way to create momentum.`
        : 'No completed action is on the board yet. Start with movement that requires no setup.',
      cta: 'Show today’s goals',
      page: 'today',
      anchor: 'questList',
      mode: null,
      priority: 90
    };
  }

  if (!status.train) {
    return {
      id: 'quick_workout',
      kind: 'train',
      eyebrow: 'NEXT BEST ACTION',
      title: 'Do the Quick version of today’s workout',
      detail: 'Keep the training intent, cut the time commitment, and bank a real session instead of waiting for a perfect window.',
      cta: 'Start Quick workout',
      page: 'train',
      mode: 'quick',
      priority: 80
    };
  }

  if (!status.nutrition) {
    return {
      id: 'log_food',
      kind: 'nutrition',
      eyebrow: 'NEXT BEST ACTION',
      title: 'Log what you have eaten so far',
      detail: 'One honest entry is enough to make today’s Fuel record useful. No calorie target is inferred.',
      cta: 'Add food',
      page: 'nutrition',
      openFuel: true,
      mode: null,
      priority: 70
    };
  }

  if (!status.move) {
    return {
      id: 'finish_move',
      kind: 'move',
      eyebrow: 'NEXT BEST ACTION',
      title: 'Add a short purposeful walk',
      detail: steps > 0
        ? `${steps.toLocaleString()} steps are recorded. Movement is the smallest remaining gap in today’s plan.`
        : 'Movement is the smallest remaining gap in today’s plan.',
      cta: 'Show movement goal',
      page: 'today',
      anchor: 'questList',
      mode: null,
      priority: 60
    };
  }

  return {
    id: 'recovery_check',
    kind: 'recovery',
    eyebrow: 'LAST SMALL WIN',
    title: 'Do the recovery check',
    detail: 'Acknowledge recovery without changing any health target or inventing a readiness score.',
    cta: 'Open recovery goal',
    page: 'today',
    anchor: 'questList',
    mode: null,
    priority: 50
  };
}

export function buildDailyGuidance(input = {}) {
  const summary = summarizeDay(input);
  const action = recommendNextAction(summary);
  return { summary, action };
}
