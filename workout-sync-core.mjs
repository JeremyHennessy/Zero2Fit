import { parseSetKey } from './adaptive-core.mjs';

const clean = value => String(value ?? '').trim();
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

function validIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dayFallback(day) {
  return validIso(`${clean(day)}T12:00:00Z`) || '1970-01-01T00:00:00.000Z';
}

function hash32(text, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
    hash ^= hash >>> 13;
  }
  return hash >>> 0;
}

export function deterministicUuid(namespace, key) {
  const text = `${clean(namespace)}|${clean(key)}`;
  const seeds = [2166136261, 2246822519, 3266489917, 668265263];
  let hex = seeds.map(seed => hash32(text, seed).toString(16).padStart(8, '0')).join('');
  hex = `${hex.slice(0, 12)}5${hex.slice(13, 16)}a${hex.slice(17)}`;
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

export function workoutSessionKey(day, location, templateId) {
  return `${clean(day)}|${clean(location)}|${clean(templateId)}`;
}

export function workoutSetSyncKey(day, setKey) {
  return `${clean(day)}|${clean(setKey)}`;
}

function historyIdentity(item = {}) {
  return workoutSessionKey(item.day, item.location, item.templateId);
}

function historyTime(item = {}) {
  return validIso(item.completedAt || item.date) || null;
}

function latestIso(values = [], fallback = null) {
  return values.map(validIso).filter(Boolean).sort().at(-1) || fallback;
}

function historyMap(state = {}) {
  const map = new Map();
  for (const item of state.workoutHistory || []) {
    const key = historyIdentity(item);
    if (key === '||') continue;
    const prior = map.get(key);
    if (!prior || (historyTime(item) || '') > (historyTime(prior) || '')) map.set(key, item);
  }
  return map;
}

function startForSession(state, day, location, templateId) {
  const prefix = `${day}:${location}:${templateId}:`;
  const values = Object.entries(state.workoutSessionStarts || {})
    .filter(([key]) => key.startsWith(prefix))
    .map(([, value]) => Number(value))
    .filter(Number.isFinite)
    .sort((a,b) => a-b);
  return values.length ? new Date(values[0]).toISOString() : null;
}

function sessionMode(state, history, day, location, templateId) {
  if (history?.mode) return history.mode;
  const prefix = `${day}:${location}:${templateId}:`;
  const key = Object.keys(state.workoutSessionStarts || {}).find(item => item.startsWith(prefix));
  return key ? key.slice(prefix.length) : null;
}

export function localWorkoutRows(state = {}, userId, editMeta = {}) {
  if (!userId) throw new Error('Workout sync requires a user id.');
  const histories = historyMap(state);
  const groups = new Map();
  const sets = [];

  for (const [day, bucket] of Object.entries(state.workoutSets || {})) {
    for (const [setKey, raw] of Object.entries(bucket || {})) {
      const parsed = parseSetKey(setKey);
      if (!parsed) continue;
      const sessionKey = workoutSessionKey(day, parsed.location, parsed.templateId);
      const history = histories.get(sessionKey);
      const syncKey = workoutSetSyncKey(day, setKey);
      const updatedAt = validIso(editMeta[syncKey]) || historyTime(history) || dayFallback(day);
      const sessionId = deterministicUuid('workout-session', sessionKey);
      const setId = deterministicUuid('workout-set', syncKey);
      const row = {
        user_id:userId,
        set_id:setId,
        session_id:sessionId,
        exercise_id:parsed.exerciseId,
        set_number:parsed.setIndex + 1,
        reps:hasOwn(raw, 'reps') && Number.isFinite(Number(raw.reps)) ? Number(raw.reps) : null,
        load_value:hasOwn(raw, 'load') && Number.isFinite(Number(raw.load)) ? Number(raw.load) : null,
        load_unit:hasOwn(raw, 'load') ? 'lb' : null,
        completed:Boolean(raw?.done),
        metadata:{
          set_key:setKey,
          day,
          location:parsed.location,
          template_id:parsed.templateId,
          intent:parsed.intent,
          updated_at:updatedAt
        }
      };
      sets.push(row);
      if (!groups.has(sessionKey)) groups.set(sessionKey, { day, parsed, rows:[] });
      groups.get(sessionKey).rows.push(row);
    }
  }

  for (const [sessionKey, history] of histories.entries()) {
    if (!groups.has(sessionKey)) {
      const [day, location, templateId] = sessionKey.split('|');
      groups.set(sessionKey, { day, parsed:{ location, templateId }, rows:[] });
    }
  }

  const sessions = [...groups.entries()].map(([sessionKey, group]) => {
    const history = histories.get(sessionKey);
    const rows = group.rows || [];
    const done = rows.filter(row => row.completed).length;
    const completedAt = historyTime(history);
    const fallback = dayFallback(group.day);
    const updatedAt = latestIso([
      completedAt,
      ...rows.map(row => row.metadata?.updated_at)
    ], fallback);
    const mode = sessionMode(state, history, group.day, group.parsed.location, group.parsed.templateId);
    return {
      user_id:userId,
      session_id:deterministicUuid('workout-session', sessionKey),
      template_id:group.parsed.templateId || null,
      workout_name:history?.templateName || history?.workoutName || group.parsed.templateId || 'Zero2Fit workout',
      mode:mode || null,
      location:group.parsed.location || null,
      started_at:startForSession(state, group.day, group.parsed.location, group.parsed.templateId),
      completed_at:completedAt,
      completion_fraction:rows.length ? done / rows.length : (completedAt ? 1 : 0),
      source_provider:'zero2fit',
      source_record_id:`workout:${sessionKey}`,
      metadata:{
        session_key:sessionKey,
        day:group.day,
        template_name:history?.templateName || null,
        duration_minutes:Number.isFinite(Number(history?.durationMinutes)) ? Number(history.durationMinutes) : null,
        completed_exercise_ids:Array.isArray(history?.completedExerciseIds) ? history.completedExerciseIds : [],
        unavailable_intents:Array.isArray(history?.unavailableIntents) ? history.unavailableIntents : [],
        updated_at:updatedAt
      },
      created_at:startForSession(state, group.day, group.parsed.location, group.parsed.templateId) || completedAt || fallback
    };
  });

  return { sessions, sets };
}

function rowUpdatedAt(row = {}) {
  return validIso(row?.metadata?.updated_at) || validIso(row.completed_at) || validIso(row.created_at) || '1970-01-01T00:00:00.000Z';
}

export function mergeRows(localRows = [], remoteRows = [], idField) {
  const merged = new Map();
  for (const row of remoteRows || []) {
    const id = clean(row?.[idField]);
    if (id) merged.set(id, { ...row, metadata:{ ...(row.metadata || {}) } });
  }
  for (const row of localRows || []) {
    const id = clean(row?.[idField]);
    if (!id) continue;
    const prior = merged.get(id);
    if (!prior || rowUpdatedAt(row) >= rowUpdatedAt(prior)) merged.set(id, { ...row, metadata:{ ...(row.metadata || {}) } });
  }
  return [...merged.values()];
}

export function mergeWorkoutRows(local = {}, remote = {}) {
  return {
    sessions:mergeRows(local.sessions || [], remote.sessions || [], 'session_id'),
    sets:mergeRows(local.sets || [], remote.sets || [], 'set_id')
  };
}

function sessionIdentityFromRow(row = {}) {
  const metadata = row.metadata || {};
  if (metadata.session_key) return clean(metadata.session_key);
  return workoutSessionKey(metadata.day, row.location, row.template_id);
}

function historyFromSession(row = {}) {
  if (!row.completed_at) return null;
  const metadata = row.metadata || {};
  const day = clean(metadata.day) || clean(row.completed_at).slice(0,10);
  return {
    date:new Date(row.completed_at).getTime(),
    day,
    templateId:row.template_id || null,
    templateName:metadata.template_name || row.workout_name || row.template_id || 'Zero2Fit workout',
    location:row.location || null,
    mode:row.mode || null,
    durationMinutes:Number.isFinite(Number(metadata.duration_minutes)) ? Number(metadata.duration_minutes) : null,
    completedExerciseIds:Array.isArray(metadata.completed_exercise_ids) ? metadata.completed_exercise_ids : [],
    unavailableIntents:Array.isArray(metadata.unavailable_intents) ? metadata.unavailable_intents : []
  };
}

export function hydrateWorkoutState(state = {}, merged = {}, editMeta = {}) {
  const next = {
    ...state,
    workoutSets:{ ...(state.workoutSets || {}) },
    workoutHistory:[...(state.workoutHistory || [])],
    workoutDates:[...(state.workoutDates || [])]
  };
  const nextMeta = { ...(editMeta || {}) };

  for (const row of merged.sets || []) {
    const metadata = row.metadata || {};
    const day = clean(metadata.day);
    const setKey = clean(metadata.set_key);
    if (!day || !setKey || !parseSetKey(setKey)) continue;
    next.workoutSets[day] = { ...(next.workoutSets[day] || {}) };
    const value = { done:Boolean(row.completed) };
    if (row.reps !== null && row.reps !== undefined && Number.isFinite(Number(row.reps))) value.reps = Number(row.reps);
    if (row.load_value !== null && row.load_value !== undefined && Number.isFinite(Number(row.load_value))) value.load = Number(row.load_value);
    next.workoutSets[day][setKey] = value;
    nextMeta[workoutSetSyncKey(day, setKey)] = rowUpdatedAt(row);
  }

  const history = new Map();
  for (const item of next.workoutHistory) {
    const key = historyIdentity(item);
    if (key !== '||') history.set(key, item);
  }
  for (const row of merged.sessions || []) {
    const item = historyFromSession(row);
    if (!item) continue;
    const key = sessionIdentityFromRow(row);
    const prior = history.get(key);
    if (!prior || Number(item.date || 0) >= Number(prior.date || 0)) history.set(key, item);
  }
  next.workoutHistory = [...history.values()]
    .sort((a,b) => Number(b.date || 0) - Number(a.date || 0))
    .slice(0, 180);
  next.workoutDates = [...new Set([
    ...next.workoutDates,
    ...next.workoutHistory.map(item => item.day).filter(Boolean)
  ])].sort();
  next.completedWorkouts = Math.max(Number(state.completedWorkouts || 0), next.workoutHistory.length);

  return { state:next, editMeta:nextMeta };
}

export function workoutStateFingerprint(state = {}) {
  return JSON.stringify({
    workoutSets:state.workoutSets || {},
    workoutHistory:state.workoutHistory || [],
    workoutDates:state.workoutDates || [],
    completedWorkouts:Number(state.completedWorkouts || 0),
    totalXp:Number(state.totalXp || 0),
    attributes:state.attributes || {},
    awarded:state.awarded || {}
  });
}
