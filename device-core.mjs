const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function localDateKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sourceText(event = {}) {
  return [event?.metadata?.source_name, event?.source_device, event?.source_provider]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function sourceLabel(event = {}) {
  const text = sourceText(event).toLowerCase();
  if (/renpho/.test(text)) return event.source_provider === 'apple_health' ? 'RENPHO via Apple Health' : 'RENPHO';
  if (/zepp|amazfit/.test(text)) return event.source_provider === 'apple_health' ? 'Amazfit via Apple Health' : 'Amazfit / Zepp';
  if (/apple watch/.test(text)) return 'Apple Watch';
  if (/iphone/.test(text)) return 'iPhone / Apple Health';
  if (event.source_provider === 'healthkit_bridge') return 'HealthKit bridge';
  if (event.source_provider === 'apple_health') return 'Apple Health';
  if (event.source_provider === 'manual') return 'Manual';
  if (event.source_provider === 'zero2fit') return 'Zero2Fit';
  return event.source_provider || 'Unknown';
}

export function sourcePriority(event = {}) {
  const text = sourceText(event).toLowerCase();
  if (/renpho/.test(text)) return 120;
  if (/zepp|amazfit/.test(text)) return 115;
  if (event.source_provider === 'healthkit_bridge' && event?.metadata?.verified === true) return 110;
  if (/apple watch/.test(text)) return 95;
  if (event.source_provider === 'healthkit_bridge') return 90;
  if (/iphone/.test(text)) return 75;
  if (event.source_provider === 'apple_health') return 70;
  if (event.source_provider === 'zero2fit') return 65;
  if (event.source_provider === 'manual') return 30;
  return 50;
}

export function isTrustedDeviceEvent(event = {}) {
  const metadata = event?.metadata || {};
  return event?.source_provider === 'healthkit_bridge'
    && metadata.bridge_transport_verified === true
    && metadata.verified === true
    && metadata.source_verification_status === 'verified'
    && Boolean(metadata.source_bundle_id)
    && Boolean(metadata.source_verification_id);
}

export function durationMinutes(event = {}) {
  const numeric = Number(event.value);
  if (!Number.isFinite(numeric)) return null;
  const unit = String(event.unit || '').toLowerCase();
  if (/^h$|hour/.test(unit)) return numeric * 60;
  if (/^s$|sec/.test(unit)) return numeric / 60;
  return numeric;
}

export function eventEnergyKcal(event = {}) {
  const value = Number(event?.metadata?.total_energy_burned);
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = String(event?.metadata?.total_energy_unit || 'kcal').toLowerCase();
  if (/kj|kilojoule/.test(unit)) return value / 4.184;
  return value;
}

export function activityCategory(event = {}) {
  const raw = String(event?.metadata?.activity_type || event?.metadata?.workout_type || '').toLowerCase();
  if (/strength|functionalstrength|traditionalstrength|cross.?training|coretraining/.test(raw)) return 'strength';
  if (/yoga|pilates|flexibility|mindandbody/.test(raw)) return 'recovery';
  if (/walk|run|cycle|bike|hike|elliptical|row|swim|stair|cardio|highintensity|dance/.test(raw)) return 'endurance';
  return 'endurance';
}

export function activityLabel(event = {}) {
  const raw = String(event?.metadata?.activity_type || event?.metadata?.workout_type || 'Workout');
  return raw
    .replace(/^HKWorkoutActivityType/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim() || 'Workout';
}

function validStepValue(event) {
  const value = Number(event?.value);
  return Number.isFinite(value) && value >= 0 && value <= 150000 ? value : null;
}

export function aggregateDailySteps(events = []) {
  const groups = new Map();
  for (const event of events) {
    if (event?.metric_type !== 'steps') continue;
    const value = validStepValue(event);
    if (value === null) continue;
    const day = event?.metadata?.date || localDateKey(event.observed_at);
    if (!day) continue;
    const sourceName = event?.metadata?.source_name || event?.source_device || event?.source_provider || 'unknown';
    const key = `${day}|${String(sourceName).toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { day, sourceName, events: [], fragments: [], totals: [] });
    const group = groups.get(key);
    group.events.push(event);
    if (event?.metadata?.aggregation === 'daily_total') group.totals.push(value);
    else group.fragments.push(value);
  }

  const byDay = new Map();
  for (const group of groups.values()) {
    const representative = group.events.sort((a, b) => sourcePriority(b) - sourcePriority(a))[0];
    const total = group.totals.length ? Math.max(...group.totals) : group.fragments.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(total) || total < 0 || total > 150000) continue;
    const candidate = {
      day: group.day,
      total: Math.round(total),
      source_provider: representative?.source_provider || 'unknown',
      source_name: representative?.metadata?.source_name || group.sourceName,
      source_device: representative?.source_device || null,
      source_label: sourceLabel(representative),
      trusted: isTrustedDeviceEvent(representative),
      score: sourcePriority(representative) + (group.totals.length ? 8 : 0),
      event_count: group.events.length,
      aggregation: group.totals.length ? 'provided_daily_total' : 'summed_fragments'
    };
    if (!byDay.has(group.day)) byDay.set(group.day, []);
    byDay.get(group.day).push(candidate);
  }

  return [...byDay.entries()]
    .map(([day, candidates]) => candidates.sort((a, b) => b.score - a.score || b.total - a.total)[0])
    .filter(Boolean)
    .sort((a, b) => a.day.localeCompare(b.day));
}

function asleepValue(value) {
  const text = String(value || '').toLowerCase();
  if (/awake|inbed/.test(text)) return false;
  return /asleep|core|deep|rem|unspecified/.test(text);
}

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = intervals
    .map(([start, end]) => [Number(start), Number(end)])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (!last || interval[0] > last[1]) merged.push([...interval]);
    else last[1] = Math.max(last[1], interval[1]);
  }
  return merged;
}

export function summarizeLatestSleep(events = []) {
  const groups = new Map();
  for (const event of events) {
    if (event?.metric_type !== 'sleep_stage' || !asleepValue(event.value) || !event.end_at) continue;
    const start = new Date(event.observed_at).getTime();
    const end = new Date(event.end_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const nightAnchor = new Date(start - 12 * 60 * 60 * 1000);
    const night = localDateKey(nightAnchor);
    const sourceName = event?.metadata?.source_name || event?.source_device || event?.source_provider || 'unknown';
    const key = `${night}|${String(sourceName).toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { night, events: [], intervals: [] });
    const group = groups.get(key);
    group.events.push(event);
    group.intervals.push([start, end]);
  }

  const candidates = [];
  for (const group of groups.values()) {
    const merged = mergeIntervals(group.intervals);
    const milliseconds = merged.reduce((sum, [start, end]) => sum + (end - start), 0);
    const hours = milliseconds / 3600000;
    if (hours < 0.25 || hours > 16) continue;
    const representative = group.events.sort((a, b) => sourcePriority(b) - sourcePriority(a))[0];
    candidates.push({
      night: group.night,
      hours,
      minutes: Math.round(hours * 60),
      source_label: sourceLabel(representative),
      source_provider: representative?.source_provider || 'unknown',
      score: sourcePriority(representative),
      segments: merged.length
    });
  }
  candidates.sort((a, b) => b.night.localeCompare(a.night) || b.score - a.score);
  const latestNight = candidates[0]?.night;
  if (!latestNight) return null;
  return candidates.filter(item => item.night === latestNight).sort((a, b) => b.score - a.score)[0] || null;
}

export function latestMetric(events = [], metricType) {
  const candidates = events
    .filter(event => event?.metric_type === metricType && Number.isFinite(Number(event.value)))
    .map(event => ({ event, time: new Date(event.observed_at).getTime() }))
    .filter(item => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time);
  if (!candidates.length) return null;
  const maxTime = candidates[0].time;
  const nearLatest = candidates.filter(item => maxTime - item.time <= 10 * 60 * 1000);
  return nearLatest.sort((a, b) => sourcePriority(b.event) - sourcePriority(a.event))[0]?.event || candidates[0].event;
}

export function matchLocalWorkout(event, workoutHistory = []) {
  if (event?.metric_type !== 'workout_session') return null;
  const eventDay = localDateKey(event.observed_at);
  const duration = durationMinutes(event);
  if (!eventDay || !Number.isFinite(duration)) return null;
  const eventEnd = new Date(event.end_at || event.observed_at).getTime();

  const candidates = workoutHistory
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (item?.sourceEventId || item?.sourceProvider === 'apple_health' || item?.sourceProvider === 'healthkit_bridge') return false;
      const day = item.day || localDateKey(Number(item.date));
      if (day !== eventDay) return false;
      const localDuration = Number(item.durationMinutes);
      return Number.isFinite(localDuration);
    })
    .map(({ item, index }) => {
      const localDuration = Number(item.durationMinutes);
      const durationDiff = Math.abs(localDuration - duration);
      const threshold = Math.max(12, Math.min(35, duration * 0.4));
      if (durationDiff > threshold) return null;
      const completionTime = Number(item.date);
      const endDiff = Number.isFinite(completionTime) && Number.isFinite(eventEnd) ? Math.abs(completionTime - eventEnd) / 60000 : 999;
      return { index, durationDiff, endDiff, score: durationDiff + Math.min(endDiff, 120) * 0.05 };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  return candidates[0] || null;
}

export function isXpEligibleWorkout(event, eligibilityStartDay, existingAwards = {}, awardsForDay = 0) {
  if (event?.metric_type !== 'workout_session') return false;
  if (!isTrustedDeviceEvent(event)) return false;
  if (existingAwards?.[event.event_id]) return false;
  const day = localDateKey(event.observed_at);
  if (!day || (eligibilityStartDay && day < eligibilityStartDay)) return false;
  const minutes = durationMinutes(event);
  if (!Number.isFinite(minutes) || minutes < 10 || minutes > 240) return false;
  if (awardsForDay >= 2) return false;
  return true;
}

export function percentValue(event) {
  const value = Number(event?.value);
  if (!Number.isFinite(value)) return null;
  return clamp(value, 0, 100);
}
