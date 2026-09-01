import { localWorkoutRows, mergeWorkoutRows, hydrateWorkoutState, workoutSetSyncKey } from './workout-sync-core.mjs';

const STATE_KEY = 'zero2fit-v1';
const META_KEY = 'zero2fit-workout-sync-meta-v1';
const LAST_SYNC_KEY = 'zero2fit-last-private-sync';
const config = window.ZERO2FIT_CONFIG || {};
const remote = window.Zero2FitRemoteSync;
const storage = window.Zero2FitStorage;
const apiBase = String(config.supabaseUrl || '').replace(/\/+$/, '');
const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey || '';
let initialized = false;
let originalSyncNow = null;

function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readState() { return readJson(STATE_KEY, {}) || {}; }
function readMeta() { return readJson(META_KEY, {}) || {}; }
function writeMeta(meta) { localStorage.setItem(META_KEY, JSON.stringify(meta || {})); }

function writeState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state || {}));
  storage?.saveSnapshot?.(state || {}).catch(() => {});
}

function todayKey() { return new Date().toISOString().slice(0, 10); }

function stampSet(setKey, day = todayKey()) {
  if (!setKey) return;
  const meta = readMeta();
  meta[workoutSetSyncKey(day, setKey)] = new Date().toISOString();
  writeMeta(meta);
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function rest(path, { method = 'GET', body, headers = {} } = {}) {
  const session = remote?.readSession?.();
  if (!session?.access_token) throw new Error('Sign in to private sync first.');
  if (!apiBase || !publishableKey) throw new Error('Private sync is not configured.');
  const response = await fetch(`${apiBase}/rest/v1/${path}`, {
    method,
    headers:{
      apikey:publishableKey,
      Authorization:`Bearer ${session.access_token}`,
      ...(body !== undefined ? { 'Content-Type':'application/json' } : {}),
      ...headers
    },
    body:body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = payload?.message || payload?.error || payload?.hint || `${response.status} ${response.statusText}`;
    throw new Error(String(message));
  }
  return payload;
}

async function pullWorkoutRows() {
  const [sessions, sets] = await Promise.all([
    rest('workout_sessions?select=user_id,session_id,template_id,workout_name,mode,location,started_at,completed_at,completion_fraction,source_provider,source_record_id,metadata,created_at&order=created_at.asc&limit=5000'),
    rest('workout_sets?select=user_id,set_id,session_id,exercise_id,set_number,reps,load_value,load_unit,completed,metadata&limit=20000')
  ]);
  return { sessions:sessions || [], sets:sets || [] };
}

async function upsertWorkoutRows(rows = {}) {
  const sessions = rows.sessions || [];
  const sets = rows.sets || [];
  for (let offset = 0; offset < sessions.length; offset += 250) {
    await rest('workout_sessions?on_conflict=user_id,session_id', {
      method:'POST',
      body:sessions.slice(offset, offset + 250),
      headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
    });
  }
  for (let offset = 0; offset < sets.length; offset += 500) {
    await rest('workout_sets?on_conflict=user_id,set_id', {
      method:'POST',
      body:sets.slice(offset, offset + 500),
      headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
    });
  }
  return { sessions:sessions.length, sets:sets.length };
}

async function syncWorkoutContinuity() {
  const user = await remote?.getUser?.();
  if (!user?.id) throw new Error('Sign in before syncing workout history.');
  const localState = readState();
  const localMeta = readMeta();
  const localRows = localWorkoutRows(localState, user.id, localMeta);
  const remoteRows = await pullWorkoutRows();
  const merged = mergeWorkoutRows(localRows, remoteRows);
  await upsertWorkoutRows(merged);
  const hydrated = hydrateWorkoutState(localState, merged, localMeta);
  const completedSessionCount = merged.sessions.filter(row => Boolean(row.completed_at)).length;
  hydrated.state.completedWorkouts = Math.max(Number(hydrated.state.completedWorkouts || 0), completedSessionCount);
  writeState(hydrated.state);
  writeMeta(hydrated.editMeta);
  return {
    workout_sessions:merged.sessions.length,
    workout_sets:merged.sets.length,
    workout_completed_sessions:completedSessionCount,
    workout_remote_sessions:remoteRows.sessions.length,
    workout_remote_sets:remoteRows.sets.length
  };
}

function wrapSyncNow() {
  if (!remote?.syncNow || remote.syncNow.__z21Wrapped) return;
  originalSyncNow = remote.syncNow.bind(remote);
  const wrapped = async (...args) => {
    const base = await originalSyncNow(...args);
    const workout = await syncWorkoutContinuity();
    const result = { ...base, ...workout, synced_at:new Date().toISOString() };
    localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(result));
    window.dispatchEvent(new CustomEvent('zero2fit:remote-sync', { detail:result }));
    return result;
  };
  wrapped.__z21Wrapped = true;
  remote.syncNow = wrapped;
}

function ensureStylesheet() {
  if (document.querySelector('link[href="./build021.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build021.css';
  document.head.appendChild(link);
}

function ensureWorkoutStatus() {
  const focus = document.getElementById('z14FocusCard');
  if (!focus || document.getElementById('z21WorkoutSyncStatus')) return;
  const status = document.createElement('div');
  status.id = 'z21WorkoutSyncStatus';
  status.className = 'z21-workout-sync';
  status.innerHTML = '<span class="z21-sync-dot"></span><div><strong>Workout continuity</strong><small id="z21WorkoutSyncText">Checking private sync…</small></div>';
  const existing = focus.querySelector('#z14Status');
  if (existing) existing.before(status);
  else focus.appendChild(status);
}

function updateDataCopy() {
  const panel = document.getElementById('z8PrivateSync');
  const description = panel?.querySelector(':scope > p.muted');
  if (description) {
    description.textContent = 'Events are private per authenticated user. Sync now reconciles device events, Fuel, completed workout sessions and set/load history. HealthKit source names remain evidence only until you explicitly verify the exact source bundle; unverified device data never awards permanent Fitness XP.';
  }
}

function renderStatus() {
  ensureWorkoutStatus();
  updateDataCopy();
  const status = remote?.status?.() || { configured:false, signed_in:false };
  const strip = document.getElementById('z21WorkoutSyncStatus');
  const text = document.getElementById('z21WorkoutSyncText');
  if (strip) strip.dataset.state = status.signed_in ? 'signed-in' : status.configured ? 'ready' : 'local';
  if (!text) return;
  if (status.signed_in) {
    const last = status.last_sync;
    if (last?.synced_at && Number.isFinite(Number(last.workout_sets))) {
      text.textContent = `Included with Sync now · ${Number(last.workout_sessions || 0)} sessions and ${Number(last.workout_sets || 0)} sets reconciled.`;
    } else {
      text.textContent = 'Included with Sync now · completed sessions and set/load history follow your private account.';
    }
  } else if (status.configured) {
    text.textContent = 'Workout history is local + backup. Sign in under Data to carry set/load history across browsers.';
  } else {
    text.textContent = 'Workout history is local + backup. Private remote sync is not configured.';
  }
}

function bindEditClock() {
  document.addEventListener('change', event => {
    const input = event.target.closest?.('input[data-set-key]');
    if (input?.dataset?.setKey) stampSet(input.dataset.setKey);
  });
  document.addEventListener('click', event => {
    const check = event.target.closest?.('[data-set-check]');
    const key = check?.dataset?.setCheck;
    if (key) setTimeout(() => stampSet(key), 0);
  });
}

function bindStatus() {
  window.addEventListener('zero2fit:remote-session', () => setTimeout(renderStatus, 0));
  window.addEventListener('zero2fit:remote-sync', event => {
    setTimeout(() => {
      renderStatus();
      const detail = event.detail || {};
      const message = document.getElementById('z8Message');
      if (message && Number.isFinite(Number(detail.workout_sets))) {
        message.textContent = `Private sync complete: ${Number(detail.pushed || 0)} events, ${Number(detail.fuel_history_entries || 0)} Fuel entries, ${Number(detail.workout_sessions || 0)} workout sessions and ${Number(detail.workout_sets || 0)} sets reconciled.`;
      }
    }, 30);
  });
  window.addEventListener('focus', renderStatus);
}

function init() {
  if (initialized) return;
  if (!remote || !document.getElementById('z14FocusCard')) return setTimeout(init, 100);
  initialized = true;
  ensureStylesheet();
  document.body.classList.add('build021-workout-sync');
  wrapSyncNow();
  bindEditClock();
  bindStatus();
  renderStatus();
  setTimeout(renderStatus, 700);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();

window.Zero2FitWorkoutSync = { syncWorkoutContinuity, pullWorkoutRows };
