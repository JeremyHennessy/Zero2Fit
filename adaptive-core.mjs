const HOUR_MS = 3600000;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function localDay(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseSetKey(key = '') {
  const parts = String(key).split(':');
  if (parts.length < 5) return null;
  const setIndex = Number(parts.at(-1));
  if (!Number.isInteger(setIndex) || setIndex < 0) return null;
  return {
    location: parts[0],
    templateId: parts[1],
    intent: parts[2],
    exerciseId: parts.slice(3, -1).join(':'),
    setIndex
  };
}

function median(values = []) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function exposureSummary(day, parsed, sets) {
  const completed = sets.filter(item => item.done);
  const reps = completed.map(item => Number(item.reps)).filter(Number.isFinite);
  const loads = completed.map(item => Number(item.load)).filter(value => Number.isFinite(value) && value > 0);
  return {
    day,
    exerciseId: parsed.exerciseId,
    location: parsed.location,
    templateId: parsed.templateId,
    intent: parsed.intent,
    setCount: sets.length,
    completedSets: completed.length,
    allSetsCompleted: sets.length > 0 && completed.length === sets.length,
    minReps: reps.length ? Math.min(...reps) : null,
    maxReps: reps.length ? Math.max(...reps) : null,
    avgReps: reps.length ? reps.reduce((sum, value) => sum + value, 0) / reps.length : null,
    workingLoad: median(loads),
    sets: sets.map(item => ({ setIndex:item.setIndex, reps:item.reps ?? null, load:item.load ?? null, done:Boolean(item.done) }))
  };
}

export function collectExerciseExposures(workoutSets = {}, { excludeDay = null } = {}) {
  const grouped = new Map();
  for (const [day, bucket] of Object.entries(workoutSets || {})) {
    if (excludeDay && day === excludeDay) continue;
    for (const [key, raw] of Object.entries(bucket || {})) {
      const parsed = parseSetKey(key);
      if (!parsed) continue;
      const groupKey = `${day}|${parsed.location}|${parsed.templateId}|${parsed.intent}|${parsed.exerciseId}`;
      if (!grouped.has(groupKey)) grouped.set(groupKey, { day, parsed, sets:[] });
      grouped.get(groupKey).sets.push({ setIndex:parsed.setIndex, reps:raw?.reps, load:raw?.load, done:Boolean(raw?.done) });
    }
  }
  return [...grouped.values()]
    .map(group => exposureSummary(group.day, group.parsed, group.sets.sort((a,b) => a.setIndex - b.setIndex)))
    .sort((a, b) => b.day.localeCompare(a.day));
}

export function exerciseHistory(workoutSets = {}, exerciseId, options = {}) {
  return collectExerciseExposures(workoutSets, options).filter(item => item.exerciseId === exerciseId);
}

function roundToStep(value, step) {
  if (!(Number(step) > 0)) return value;
  return Math.round(value / step) * step;
}

function recoveryMode(recovery = {}) {
  const level = recovery.level || 'normal';
  if (level === 'low') return { level, loadFactor:0.9, repTrim:2, allowProgression:false };
  if (level === 'moderate') return { level, loadFactor:1, repTrim:1, allowProgression:false };
  return { level:'ready', loadFactor:1, repTrim:0, allowProgression:true };
}

export function suggestNextPrescription({
  exerciseId,
  repRange = [8, 12],
  workoutSets = {},
  currentDay = localDay(),
  hasExternalLoad = true,
  loadIncrementLb = 5,
  recovery = {}
} = {}) {
  const low = Number(repRange?.[0] ?? 8);
  const high = Number(repRange?.[1] ?? Math.max(low, 12));
  const history = exerciseHistory(workoutSets, exerciseId, { excludeDay:currentDay });
  const recent = history.filter(item => item.completedSets > 0).slice(0, 3);
  const latest = recent[0] || null;
  const readiness = recoveryMode(recovery);

  if (!latest) {
    return {
      exerciseId,
      action:'establish_baseline',
      suggestedReps:low,
      suggestedLoad:null,
      workingLoad:null,
      previousReps:null,
      historyCount:0,
      recoveryLevel:readiness.level,
      reason:'No completed exposure yet; establish a controlled baseline before automatic load progression.'
    };
  }

  const previousReps = Number.isFinite(latest.minReps) ? latest.minReps : (Number.isFinite(latest.avgReps) ? Math.round(latest.avgReps) : low);
  const workingLoad = Number.isFinite(latest.workingLoad) ? latest.workingLoad : null;
  const topHit = latest.allSetsCompleted && Number.isFinite(latest.minReps) && latest.minReps >= high;
  const previous = recent[1];
  const previousTopHit = previous?.allSetsCompleted && Number.isFinite(previous.minReps) && previous.minReps >= high;
  const sameWorkingLoad = workingLoad !== null && previous?.workingLoad !== null && Math.abs(Number(previous.workingLoad) - workingLoad) < 0.01;
  const progressionQualified = topHit && previousTopHit && (!hasExternalLoad || sameWorkingLoad);

  if (hasExternalLoad && workingLoad !== null) {
    if (progressionQualified && readiness.allowProgression) {
      return {
        exerciseId,
        action:'increase_load',
        suggestedReps:low,
        suggestedLoad:roundToStep(workingLoad + Number(loadIncrementLb || 5), Number(loadIncrementLb || 5)),
        workingLoad,
        previousReps,
        historyCount:recent.length,
        recoveryLevel:readiness.level,
        reason:`Top of the rep range was completed for two consecutive exposures at ${workingLoad} lb.`
      };
    }

    const recoveryAdjustedLoad = readiness.level === 'low'
      ? roundToStep(Math.max(Number(loadIncrementLb || 5), workingLoad * readiness.loadFactor), Number(loadIncrementLb || 5))
      : workingLoad;
    const suggestedReps = clamp(previousReps + (latest.allSetsCompleted ? 1 : 0) - readiness.repTrim, low, high);
    return {
      exerciseId,
      action: readiness.level === 'low' ? 'recovery_reduce' : progressionQualified ? 'recovery_hold' : 'build_reps',
      suggestedReps,
      suggestedLoad:recoveryAdjustedLoad,
      workingLoad,
      previousReps,
      historyCount:recent.length,
      recoveryLevel:readiness.level,
      reason: readiness.level === 'low'
        ? 'Recovery signals are low; reduce the suggested working load and stay inside the assigned rep range.'
        : progressionQualified
          ? 'Progression threshold was met, but recovery is not strong enough to add load today.'
          : 'Keep the current working load and build repetitions before adding load.'
    };
  }

  if (progressionQualified) {
    return {
      exerciseId,
      action: readiness.allowProgression ? 'harder_variant_ready' : 'recovery_hold',
      suggestedReps:readiness.allowProgression ? low : clamp(high - readiness.repTrim, low, high),
      suggestedLoad:null,
      workingLoad:null,
      previousReps,
      historyCount:recent.length,
      recoveryLevel:readiness.level,
      reason: readiness.allowProgression
        ? 'Top of the rep range was completed twice; a harder bodyweight variation is appropriate when available.'
        : 'Bodyweight progression threshold was met, but recovery is not strong enough to advance the variation today.'
    };
  }

  return {
    exerciseId,
    action:readiness.level === 'low' ? 'recovery_reduce' : 'build_reps',
    suggestedReps:clamp(previousReps + (latest.allSetsCompleted ? 1 : 0) - readiness.repTrim, low, high),
    suggestedLoad:null,
    workingLoad:null,
    previousReps,
    historyCount:recent.length,
    recoveryLevel:readiness.level,
    reason:readiness.level === 'low'
      ? 'Recovery signals are low; stay near the lower end of the assigned rep range.'
      : 'Build repetitions with controlled form before moving to a harder variation.'
  };
}

function completedTemplateHistory(history = []) {
  return history
    .filter(item => ['full_body_a','full_body_b'].includes(item?.templateId))
    .filter(item => Number.isFinite(Number(item?.date)) || item?.day)
    .sort((a, b) => Number(b.date || 0) - Number(a.date || 0));
}

export function chooseNextTemplate({ workoutHistory = [], today = localDay() } = {}) {
  const history = completedTemplateHistory(workoutHistory).filter(item => item.day !== today);
  if (!history.length) return { templateId:'full_body_a', reason:'No prior A/B workout history.' };

  const recent = history.slice(0, 8);
  const counts = { full_body_a:0, full_body_b:0 };
  for (const item of recent) counts[item.templateId] += 1;
  const last = recent[0]?.templateId;
  const other = last === 'full_body_a' ? 'full_body_b' : 'full_body_a';

  if (counts[other] <= counts[last]) {
    return { templateId:other, reason:`Alternate from the most recent completed ${last === 'full_body_a' ? 'Full Body A' : 'Full Body B'} exposure.` };
  }

  const lastByTemplate = {};
  for (const item of history) if (!lastByTemplate[item.templateId]) lastByTemplate[item.templateId] = item;
  const aTime = Number(lastByTemplate.full_body_a?.date || 0);
  const bTime = Number(lastByTemplate.full_body_b?.date || 0);
  const templateId = aTime <= bTime ? 'full_body_a' : 'full_body_b';
  return { templateId, reason:'Choose the less recently exposed A/B template to balance movement patterns.' };
}

function numericEvents(events, metricType) {
  return (events || [])
    .filter(event => event?.metric_type === metricType)
    .map(event => ({ value:Number(event.value), time:new Date(event.observed_at).getTime() }))
    .filter(item => Number.isFinite(item.value) && Number.isFinite(item.time))
    .sort((a,b) => b.time - a.time);
}

function asleep(value) {
  const text = String(value || '').toLowerCase();
  if (/awake|inbed/.test(text)) return false;
  return /asleep|core|deep|rem|unspecified/.test(text);
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .filter(([start,end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a,b) => a[0] - b[0]);
  const merged = [];
  for (const current of sorted) {
    const last = merged.at(-1);
    if (!last || current[0] > last[1]) merged.push([...current]);
    else last[1] = Math.max(last[1], current[1]);
  }
  return merged;
}

export function sleepNightSummaries(events = []) {
  const groups = new Map();
  for (const event of events) {
    if (event?.metric_type !== 'sleep_stage' || !asleep(event.value) || !event.end_at) continue;
    const start = new Date(event.observed_at).getTime();
    const end = new Date(event.end_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const anchor = new Date(start - 12 * HOUR_MS);
    const night = localDay(anchor);
    if (!groups.has(night)) groups.set(night, []);
    groups.get(night).push([start,end]);
  }
  return [...groups.entries()].map(([night, intervals]) => {
    const hours = mergeIntervals(intervals).reduce((sum,[start,end]) => sum + end - start, 0) / HOUR_MS;
    return { night, hours };
  }).filter(item => item.hours >= 0.25 && item.hours <= 16).sort((a,b) => b.night.localeCompare(a.night));
}

export function computeRecoveryStatus({ events = [], workoutHistory = [], now = Date.now() } = {}) {
  const nights = sleepNightSummaries(events).slice(0, 14);
  const latestSleep = nights[0]?.hours ?? null;
  const baselineSleep = median(nights.slice(1).map(item => item.hours));
  const rhr = numericEvents(events, 'resting_heart_rate');
  const hrv = numericEvents(events, 'hrv_sdnn');
  const latestRhr = rhr[0]?.value ?? null;
  const baselineRhr = median(rhr.slice(1, 15).map(item => item.value));
  const latestHrv = hrv[0]?.value ?? null;
  const baselineHrv = median(hrv.slice(1, 15).map(item => item.value));
  const latestWorkout = [...(workoutHistory || [])]
    .map(item => Number(item?.date))
    .filter(Number.isFinite)
    .sort((a,b) => b-a)[0] || null;
  const hoursSinceWorkout = latestWorkout ? Math.max(0, (Number(now) - latestWorkout) / HOUR_MS) : null;

  let score = 75;
  const reasons = [];
  if (latestSleep !== null) {
    if (latestSleep < 5.5) { score -= 30; reasons.push('sleep below 5.5 h'); }
    else if (latestSleep < 6.5) { score -= 15; reasons.push('short sleep'); }
    else if (baselineSleep && latestSleep < baselineSleep - 1) { score -= 10; reasons.push('sleep below recent baseline'); }
    else if (latestSleep >= 7) { score += 5; }
  }
  if (latestRhr !== null && baselineRhr !== null && latestRhr >= baselineRhr + 8) {
    score -= 15; reasons.push('resting HR above recent baseline');
  }
  if (latestHrv !== null && baselineHrv !== null && latestHrv <= baselineHrv * 0.75) {
    score -= 15; reasons.push('HRV below recent baseline');
  }
  if (hoursSinceWorkout !== null) {
    if (hoursSinceWorkout < 20) { score -= 20; reasons.push('recent workout within 20 h'); }
    else if (hoursSinceWorkout < 36) { score -= 8; reasons.push('recent workout within 36 h'); }
  }
  score = clamp(Math.round(score), 0, 100);
  const level = score < 45 ? 'low' : score < 70 ? 'moderate' : 'ready';
  return {
    score,
    level,
    latestSleepHours:latestSleep,
    baselineSleepHours:baselineSleep,
    latestRestingHr:latestRhr,
    baselineRestingHr:baselineRhr,
    latestHrv,
    baselineHrv,
    hoursSinceWorkout,
    reasons,
    note:'Conservative Zero2Fit training heuristic; not a medical readiness assessment.'
  };
}

export function selectWorkoutEnergy({ workoutHistory = [], workoutEnergyLog = [], day, templateId = null, location = null } = {}) {
  const matches = workoutHistory
    .filter(item => item?.day === day)
    .filter(item => !templateId || !item.templateId || item.templateId === templateId)
    .filter(item => !location || !item.location || item.location === location)
    .filter(item => Number.isFinite(Number(item.deviceEnergyKcal)))
    .sort((a,b) => Number(b.date || 0) - Number(a.date || 0));
  const observed = matches[0] || null;
  const fallback = workoutEnergyLog
    .filter(item => item?.day === day)
    .filter(item => !templateId || !item.templateId || item.templateId === templateId)
    .filter(item => !location || !item.location || item.location === location)
    .sort((a,b) => Number(b.date || 0) - Number(a.date || 0))[0] || null;
  if (observed) {
    return {
      preferred:'observed',
      kcal:Number(observed.deviceEnergyKcal),
      source:observed.deviceSourceLabel || observed.sourceLabel || 'verified device',
      fallbackKcal:Number.isFinite(Number(fallback?.grossKcal)) ? Number(fallback.grossKcal) : null,
      fallbackMethod:fallback?.method || null
    };
  }
  if (fallback && Number.isFinite(Number(fallback.grossKcal))) {
    return { preferred:'estimate', kcal:Number(fallback.grossKcal), source:fallback.method || 'MET estimate', fallbackKcal:Number(fallback.grossKcal), fallbackMethod:fallback.method || null };
  }
  return null;
}
