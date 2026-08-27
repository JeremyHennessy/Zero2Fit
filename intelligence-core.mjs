const DAY_MS = 86400000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function dayKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDays(day, count) {
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + count);
  return dayKey(d);
}

function average(values = []) {
  const numeric = values.map(Number).filter(Number.isFinite);
  return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : null;
}

function median(values = []) {
  const numeric = values.map(Number).filter(Number.isFinite).sort((a,b) => a-b);
  if (!numeric.length) return null;
  const middle = Math.floor(numeric.length / 2);
  return numeric.length % 2 ? numeric[middle] : (numeric[middle-1] + numeric[middle]) / 2;
}

export function dailyWeights(weights = []) {
  const byDay = new Map();
  for (const row of weights) {
    const value = Number(row?.value);
    const time = Number(row?.date || new Date(row?.observedAt || row?.observed_at).getTime());
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(time)) continue;
    const day = dayKey(time);
    const current = byDay.get(day);
    if (!current || time >= current.time) byDay.set(day, { day, value, time, sourceLabel:row.sourceLabel || row.sourceProvider || row.source || null });
  }
  return [...byDay.values()].sort((a,b) => a.day.localeCompare(b.day));
}

export function smoothWeightTrend(weights = [], window = 7) {
  const daily = dailyWeights(weights);
  const size = Math.max(1, Number(window) || 7);
  return daily.map((row, index) => {
    const sample = daily.slice(Math.max(0, index - size + 1), index + 1);
    return { ...row, smoothed:average(sample.map(item => item.value)), sampleCount:sample.length };
  });
}

export function weightTrendSummary(weights = []) {
  const trend = smoothWeightTrend(weights, 7);
  if (!trend.length) return { status:'insufficient', count:0, latest:null, smoothed:null, change:null, direction:'unknown' };
  const latest = trend.at(-1);
  if (trend.length < 2) return { status:'insufficient', count:trend.length, latest:latest.value, smoothed:latest.smoothed, change:null, direction:'unknown' };
  const baseline = trend[Math.max(0, trend.length - 8)];
  const change = latest.smoothed - baseline.smoothed;
  return {
    status:trend.length >= 4 ? 'usable' : 'limited',
    count:trend.length,
    latest:latest.value,
    smoothed:latest.smoothed,
    baselineSmoothed:baseline.smoothed,
    change,
    direction:Math.abs(change) < 0.2 ? 'stable' : change > 0 ? 'up' : 'down',
    baselineDay:baseline.day,
    latestDay:latest.day
  };
}

export function estimatedOneRepMax(load, reps) {
  const weight = Number(load);
  const count = Number(reps);
  if (!(weight > 0) || !(count > 0) || count > 15) return null;
  return weight * (1 + count / 30);
}

function completedSets(record = {}) {
  return (record.sets || []).filter(set => set?.done && Number(set.reps) > 0);
}

export function sessionStrengthMetrics(record = {}) {
  const sets = completedSets(record);
  const loaded = sets.filter(set => Number(set.load) > 0);
  const maxLoad = loaded.length ? Math.max(...loaded.map(set => Number(set.load))) : null;
  const maxReps = sets.length ? Math.max(...sets.map(set => Number(set.reps))) : null;
  const bestEstimated1rm = loaded
    .map(set => estimatedOneRepMax(set.load, set.reps))
    .filter(Number.isFinite)
    .sort((a,b) => b-a)[0] ?? null;
  const volume = loaded.reduce((sum, set) => sum + Number(set.load) * Number(set.reps), 0);
  const repVolume = sets.reduce((sum, set) => sum + Number(set.reps), 0);
  return { maxLoad, maxReps, bestEstimated1rm, volume, repVolume, completedSets:sets.length };
}

export function personalRecords(exerciseHistory = []) {
  const groups = new Map();
  for (const record of exerciseHistory) {
    if (!record?.exerciseId) continue;
    if (!groups.has(record.exerciseId)) groups.set(record.exerciseId, []);
    groups.get(record.exerciseId).push(record);
  }
  return [...groups.entries()].map(([exerciseId, rows]) => {
    const metrics = rows.map(row => ({ row, metrics:sessionStrengthMetrics(row) }));
    const bestLoad = metrics.filter(item => Number.isFinite(item.metrics.maxLoad)).sort((a,b) => b.metrics.maxLoad - a.metrics.maxLoad)[0] || null;
    const bestReps = metrics.filter(item => Number.isFinite(item.metrics.maxReps)).sort((a,b) => b.metrics.maxReps - a.metrics.maxReps)[0] || null;
    const bestE1rm = metrics.filter(item => Number.isFinite(item.metrics.bestEstimated1rm)).sort((a,b) => b.metrics.bestEstimated1rm - a.metrics.bestEstimated1rm)[0] || null;
    const bestVolume = metrics.sort((a,b) => b.metrics.volume - a.metrics.volume)[0] || null;
    return {
      exerciseId,
      exposureCount:rows.length,
      maxLoad:bestLoad?.metrics.maxLoad ?? null,
      maxLoadDay:bestLoad?.row.day ?? null,
      maxReps:bestReps?.metrics.maxReps ?? null,
      maxRepsDay:bestReps?.row.day ?? null,
      estimated1rm:bestE1rm?.metrics.bestEstimated1rm ?? null,
      estimated1rmDay:bestE1rm?.row.day ?? null,
      maxSessionVolume:bestVolume?.metrics.volume || null,
      maxSessionVolumeDay:bestVolume?.row.day ?? null
    };
  }).sort((a,b) => (b.estimated1rm || b.maxLoad || b.maxReps || 0) - (a.estimated1rm || a.maxLoad || a.maxReps || 0));
}

export function strengthTrends(exerciseHistory = []) {
  const groups = new Map();
  for (const row of exerciseHistory) {
    if (!row?.exerciseId || !row?.day || row.completedSets <= 0) continue;
    if (!groups.has(row.exerciseId)) groups.set(row.exerciseId, []);
    groups.get(row.exerciseId).push(row);
  }
  const trends = [];
  for (const [exerciseId, rows] of groups.entries()) {
    rows.sort((a,b) => a.day.localeCompare(b.day));
    if (rows.length < 2) continue;
    const first = sessionStrengthMetrics(rows[0]);
    const latest = sessionStrengthMetrics(rows.at(-1));
    const loaded = Number.isFinite(first.bestEstimated1rm) && Number.isFinite(latest.bestEstimated1rm);
    const firstValue = loaded ? first.bestEstimated1rm : first.maxReps;
    const latestValue = loaded ? latest.bestEstimated1rm : latest.maxReps;
    if (!Number.isFinite(firstValue) || !Number.isFinite(latestValue) || firstValue <= 0) continue;
    const changePercent = (latestValue - firstValue) / firstValue * 100;
    trends.push({
      exerciseId,
      exposureCount:rows.length,
      metric:loaded ? 'estimated_1rm' : 'max_reps',
      firstValue,
      latestValue,
      changePercent,
      direction:Math.abs(changePercent) < 2 ? 'stable' : changePercent > 0 ? 'up' : 'down',
      firstDay:rows[0].day,
      latestDay:rows.at(-1).day
    });
  }
  return trends.sort((a,b) => b.changePercent - a.changePercent);
}

function asleep(value) {
  const text = String(value || '').toLowerCase();
  return !/awake|inbed/.test(text) && /asleep|core|deep|rem|unspecified/.test(text);
}

function mergeIntervals(intervals) {
  const sorted = intervals.sort((a,b) => a[0]-b[0]);
  const merged = [];
  for (const current of sorted) {
    const last = merged.at(-1);
    if (!last || current[0] > last[1]) merged.push([...current]);
    else last[1] = Math.max(last[1], current[1]);
  }
  return merged;
}

export function dailySleep(events = []) {
  const groups = new Map();
  for (const event of events) {
    if (event?.metric_type !== 'sleep_stage' || !asleep(event.value) || !event.end_at) continue;
    const start = new Date(event.observed_at).getTime();
    const end = new Date(event.end_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const anchor = new Date(start - 12 * 3600000);
    const wakeDay = addDays(dayKey(anchor), 1);
    if (!wakeDay) continue;
    if (!groups.has(wakeDay)) groups.set(wakeDay, []);
    groups.get(wakeDay).push([start,end]);
  }
  return Object.fromEntries([...groups.entries()].map(([day, intervals]) => [day, mergeIntervals(intervals).reduce((sum,[start,end]) => sum + end-start, 0) / 3600000]));
}

export function dailyMetric(events = [], metricType) {
  const groups = new Map();
  for (const event of events) {
    if (event?.metric_type !== metricType) continue;
    const value = Number(event.value);
    const day = dayKey(event.observed_at);
    if (!day || !Number.isFinite(value)) continue;
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(value);
  }
  return Object.fromEntries([...groups.entries()].map(([day, values]) => [day, average(values)]));
}

export function dailyStrengthVolume(exerciseHistory = []) {
  const totals = {};
  for (const row of exerciseHistory) {
    if (!row?.day) continue;
    const metrics = sessionStrengthMetrics(row);
    const score = metrics.volume > 0 ? metrics.volume : metrics.repVolume;
    totals[row.day] = (totals[row.day] || 0) + score;
  }
  return totals;
}

export function pearsonCorrelation(pairs = []) {
  const clean = pairs
    .map(pair => [Number(pair[0]), Number(pair[1])])
    .filter(([x,y]) => Number.isFinite(x) && Number.isFinite(y));
  if (clean.length < 4) return { n:clean.length, r:null, strength:'insufficient' };
  const xs = clean.map(pair => pair[0]);
  const ys = clean.map(pair => pair[1]);
  const mx = average(xs); const my = average(ys);
  const numerator = clean.reduce((sum,[x,y]) => sum + (x-mx)*(y-my), 0);
  const dx = Math.sqrt(xs.reduce((sum,x) => sum + (x-mx)**2, 0));
  const dy = Math.sqrt(ys.reduce((sum,y) => sum + (y-my)**2, 0));
  if (!(dx > 0) || !(dy > 0)) return { n:clean.length, r:null, strength:'insufficient' };
  const r = clamp(numerator / (dx*dy), -1, 1);
  const magnitude = Math.abs(r);
  const strength = magnitude >= 0.7 ? 'strong' : magnitude >= 0.45 ? 'moderate' : magnitude >= 0.25 ? 'weak' : 'very_weak';
  return { n:clean.length, r, strength };
}

export function workoutCorrelations({ exerciseHistory = [], trustedEvents = [] } = {}) {
  const volume = dailyStrengthVolume(exerciseHistory);
  const sleep = dailySleep(trustedEvents);
  const rhr = dailyMetric(trustedEvents, 'resting_heart_rate');
  const hrv = dailyMetric(trustedEvents, 'hrv_sdnn');
  const workoutDays = Object.keys(volume);
  const pairsFor = metric => workoutDays.filter(day => Number.isFinite(metric[day])).map(day => [metric[day], volume[day]]);
  return {
    sleepVsStrengthVolume:pearsonCorrelation(pairsFor(sleep)),
    restingHrVsStrengthVolume:pearsonCorrelation(pairsFor(rhr)),
    hrvVsStrengthVolume:pearsonCorrelation(pairsFor(hrv))
  };
}

function rangeDays(now, startOffset, endOffset) {
  const end = new Date(now); end.setHours(12,0,0,0); end.setDate(end.getDate() - startOffset);
  const start = new Date(now); start.setHours(12,0,0,0); start.setDate(start.getDate() - endOffset);
  return { start:dayKey(start), end:dayKey(end) };
}

function inRange(day, range) { return day && day >= range.start && day <= range.end; }

export function weeklyReview({ workoutHistory = [], steps = {}, exerciseHistory = [], trustedEvents = [], now = Date.now() } = {}) {
  const current = rangeDays(now, 0, 6);
  const previous = rangeDays(now, 7, 13);
  const currentWorkouts = workoutHistory.filter(row => inRange(row?.day || dayKey(row?.date), current));
  const previousWorkouts = workoutHistory.filter(row => inRange(row?.day || dayKey(row?.date), previous));
  const currentStepValues = Object.entries(steps || {}).filter(([day]) => inRange(day,current)).map(([,value]) => Number(value)).filter(Number.isFinite);
  const previousStepValues = Object.entries(steps || {}).filter(([day]) => inRange(day,previous)).map(([,value]) => Number(value)).filter(Number.isFinite);
  const sleep = dailySleep(trustedEvents);
  const currentSleep = Object.entries(sleep).filter(([day]) => inRange(day,current)).map(([,value]) => value);
  const previousSleep = Object.entries(sleep).filter(([day]) => inRange(day,previous)).map(([,value]) => value);
  const currentStrength = exerciseHistory.filter(row => inRange(row?.day,current));
  const previousStrength = exerciseHistory.filter(row => inRange(row?.day,previous));
  return {
    range:current,
    workouts:currentWorkouts.length,
    previousWorkouts:previousWorkouts.length,
    workoutDelta:currentWorkouts.length-previousWorkouts.length,
    averageSteps:average(currentStepValues),
    previousAverageSteps:average(previousStepValues),
    stepDays:currentStepValues.length,
    averageSleep:average(currentSleep),
    previousAverageSleep:average(previousSleep),
    sleepNights:currentSleep.length,
    strengthExposures:currentStrength.length,
    previousStrengthExposures:previousStrength.length
  };
}

export function photoSessionSummary(photoMetadata = []) {
  const sessions = new Map();
  for (const photo of photoMetadata || []) {
    if (!photo?.session_id || !photo?.captured_at) continue;
    if (!sessions.has(photo.session_id)) sessions.set(photo.session_id, { sessionId:photo.session_id, capturedAt:photo.captured_at, views:new Set() });
    const session = sessions.get(photo.session_id);
    if (String(photo.captured_at) < String(session.capturedAt)) session.capturedAt = photo.captured_at;
    session.views.add(photo.view);
  }
  const rows = [...sessions.values()].map(row => ({ ...row, views:[...row.views] })).sort((a,b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
  return { count:rows.length, first:rows[0] || null, latest:rows.at(-1) || null, sessions:rows };
}

export function thenVsNow({ weights = [], exerciseHistory = [], workoutHistory = [], photoMetadata = [] } = {}) {
  const weight = weightTrendSummary(weights);
  const trends = strengthTrends(exerciseHistory);
  const photos = photoSessionSummary(photoMetadata);
  const sortedWorkouts = [...workoutHistory].filter(row => row?.day || row?.date).sort((a,b) => String(a.day || dayKey(a.date)).localeCompare(String(b.day || dayKey(b.date))));
  return {
    weight,
    workoutCount:sortedWorkouts.length,
    firstWorkoutDay:sortedWorkouts[0]?.day || dayKey(sortedWorkouts[0]?.date) || null,
    latestWorkoutDay:sortedWorkouts.at(-1)?.day || dayKey(sortedWorkouts.at(-1)?.date) || null,
    strengthImprovers:trends.filter(row => row.changePercent >= 2).slice(0,5),
    strengthDecliners:trends.filter(row => row.changePercent <= -2).slice(-5),
    photoSessions:photos.count,
    firstPhotoDay:photos.first ? dayKey(photos.first.capturedAt) : null,
    latestPhotoDay:photos.latest ? dayKey(photos.latest.capturedAt) : null
  };
}

export function improvementVerdict({ exerciseHistory = [], workoutHistory = [], weekly = null } = {}) {
  const trends = strengthTrends(exerciseHistory);
  const improving = trends.filter(row => row.changePercent >= 2);
  const declining = trends.filter(row => row.changePercent <= -2);
  const enoughHistory = workoutHistory.length >= 3 || exerciseHistory.length >= 4;
  if (!enoughHistory) return { status:'insufficient', confidence:'low', summary:'More completed sessions are needed before Zero2Fit can answer this reliably.', evidenceCount:workoutHistory.length + exerciseHistory.length };
  if (improving.length > declining.length && improving.length > 0) return { status:'improving', confidence:trends.length >= 3 ? 'high' : 'medium', summary:`Strength is improving across ${improving.length} tracked movement${improving.length === 1 ? '' : 's'}.`, evidenceCount:trends.length };
  if (declining.length > improving.length && declining.length > 0) return { status:'mixed', confidence:trends.length >= 3 ? 'medium' : 'low', summary:'Recent strength trends are mixed or lower; review recovery and recent training consistency before progressing load.', evidenceCount:trends.length };
  if (weekly && weekly.workouts > weekly.previousWorkouts) return { status:'improving', confidence:'medium', summary:'Training consistency improved this week even though strength trends are still developing.', evidenceCount:weekly.workouts + weekly.previousWorkouts };
  return { status:'stable', confidence:'medium', summary:'The available training history looks broadly stable; keep collecting comparable sessions to make the trend clearer.', evidenceCount:trends.length };
}

export function recommendations({ weekly, trends = [], correlations = {}, recovery = null } = {}) {
  const items = [];
  if ((weekly?.workouts || 0) < 2) {
    items.push({ priority:1, title:'Protect two strength exposures', action:'Use Quick or Standard if needed so the week still contains two useful full-body sessions.', why:`${weekly?.workouts || 0} strength workout${weekly?.workouts === 1 ? '' : 's'} recorded in the last 7 days.`, confidence:'high' });
  }
  if (recovery?.level === 'low') {
    items.push({ priority:1, title:'Keep today conservative', action:'Follow the reduced adaptive load/rep targets rather than forcing a progression.', why:(recovery.reasons || []).join('; ') || 'Current verified recovery inputs are below recent baseline.', confidence:'medium' });
  }
  const improving = trends.filter(row => row.changePercent >= 2);
  if (improving.length) {
    items.push({ priority:2, title:'Keep the current progression rule', action:'Continue building the assigned rep range and add load only when the two-exposure threshold is met.', why:`${improving.length} tracked movement${improving.length === 1 ? '' : 's'} improved from first to latest comparable exposure.`, confidence:improving.length >= 3 ? 'high' : 'medium' });
  }
  const sleep = correlations.sleepVsStrengthVolume;
  if (sleep?.n >= 4 && Number.isFinite(sleep.r) && Math.abs(sleep.r) >= 0.45) {
    items.push({ priority:3, title:'Use your sleep pattern as context', action:'When planning harder sessions, note that your own recorded sleep and strength-volume days are associated; do not treat this as proof of causation.', why:`${sleep.n} paired days · correlation r=${sleep.r.toFixed(2)} (${sleep.strength}).`, confidence:sleep.n >= 8 ? 'medium' : 'low' });
  }
  if (!items.length) {
    items.push({ priority:3, title:'Keep collecting comparable sessions', action:'Repeat the same movement patterns and record reps/load so Zero2Fit can distinguish real change from day-to-day noise.', why:'Current data do not support a stronger recommendation yet.', confidence:'high' });
  }
  return items.sort((a,b) => a.priority-b.priority).slice(0,4);
}

export function buildPersonalIntelligence(input = {}) {
  const weekly = weeklyReview(input);
  const trends = strengthTrends(input.exerciseHistory || []);
  const prs = personalRecords(input.exerciseHistory || []);
  const correlations = workoutCorrelations({ exerciseHistory:input.exerciseHistory || [], trustedEvents:input.trustedEvents || [] });
  const thenNow = thenVsNow(input);
  const verdict = improvementVerdict({ exerciseHistory:input.exerciseHistory || [], workoutHistory:input.workoutHistory || [], weekly });
  return {
    weight:weightTrendSummary(input.weights || []),
    personalRecords:prs,
    strengthTrends:trends,
    weekly,
    correlations,
    thenVsNow:thenNow,
    verdict,
    recommendations:recommendations({ weekly, trends, correlations, recovery:input.recovery || null })
  };
}
