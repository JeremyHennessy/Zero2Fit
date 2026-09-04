import * as usageCore from './usage-core.mjs';

const USAGE_STORAGE_KEY = 'zero2fit-usage-v1';
const USAGE_SETTINGS_KEY = 'zero2fit-usage-settings-v1';
const APP_STORAGE_KEY = 'zero2fit-v1';
const LIFECYCLE_TYPES = new Set(['workout_session_left','workout_session_resumed','workout_finish']);
let lastLeaveAt = 0;

function readJson(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function measurementEnabled() {
  return readJson(USAGE_SETTINGS_KEY, { enabled:true })?.enabled !== false;
}

function readUsage() {
  return usageCore.normalizeUsageState(readJson(USAGE_STORAGE_KEY, {}));
}

function writeUsage(state) {
  try { localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(state)); }
  catch {}
}

function record(type, metadata = {}, options = {}) {
  if (!measurementEnabled()) return null;
  const result = usageCore.recordUsageEvent(readUsage(), {
    type,
    metadata,
    observedAt:options.observedAt || Date.now()
  }, {
    dedupeWindowMs:options.dedupeWindowMs ?? 700
  });
  if (!result.recorded) return result.event;
  writeUsage(result.state);
  window.dispatchEvent(new CustomEvent('zero2fit:usage-updated', { detail:{ type:result.event.type } }));
  return result.event;
}

function appState() {
  return readJson(APP_STORAGE_KEY, {});
}

function today() {
  return usageCore.dayKey(Date.now());
}

function currentPage() {
  return document.querySelector('.page.active')?.id?.replace('page-','') || 'today';
}

function trainingContext(state = appState()) {
  return {
    mode:String(state.workoutMode || 'standard'),
    location:String(state.workoutLocation || 'home')
  };
}

function hasActiveWorkout(state = appState()) {
  const day = today();
  if (state.awarded?.[`workout:${day}`]) return false;
  return Object.entries(state.workoutSessionStarts || {}).some(([key, value]) => key.startsWith(`${day}:`) && Number(value) > 0);
}

function latestLifecycleEvent() {
  return [...readUsage().events].reverse().find(event => LIFECYCLE_TYPES.has(event.type)) || null;
}

function recordSessionLeft(source = 'navigation') {
  const now = Date.now();
  const state = appState();
  if (!hasActiveWorkout(state) || now - lastLeaveAt < 1500) return;
  lastLeaveAt = now;
  record('workout_session_left', {
    outcome:'incomplete',
    source,
    ...trainingContext(state)
  }, { dedupeWindowMs:0 });
}

function maybeRecordResume(source = 'navigation') {
  const state = appState();
  if (!hasActiveWorkout(state)) return;
  const latest = latestLifecycleEvent();
  if (latest?.type !== 'workout_session_left') return;
  record('workout_session_resumed', {
    outcome:'resumed',
    source,
    ...trainingContext(state)
  }, { dedupeWindowMs:0 });
}

function targetField(target) {
  if (!target) return null;
  if (target.id === 'z14Load') return 'load';
  if (target.id === 'z14Reps') return 'reps';
  const field = target.dataset?.field;
  return field === 'load' || field === 'reps' ? field : null;
}

function onClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const pageControl = target.closest('.nav-item[data-page],[data-go-page]');
  if (pageControl) {
    const nextPage = pageControl.dataset.page || pageControl.dataset.goPage;
    const previousPage = currentPage();
    if (previousPage === 'train' && nextPage !== 'train') recordSessionLeft('navigation');
    if (previousPage !== 'train' && nextPage === 'train') maybeRecordResume('navigation');
  }

  const adjust = target.closest('[data-z14-adjust]');
  if (adjust) {
    const kind = String(adjust.dataset.z14Adjust || '');
    if (kind === 'load' || kind === 'reps') record('workout_target_edited', { kind, method:'stepper' }, { dedupeWindowMs:0 });
  }

  if (target.closest('#z14AddRest')) record('workout_rest_override', { method:'extend' }, { dedupeWindowMs:0 });
  if (target.closest('#z14SkipRest')) record('workout_rest_override', { method:'start_next' }, { dedupeWindowMs:0 });
  if (target.closest('#z14ResumeSkipped')) record('workout_skips_resumed', { outcome:'resumed' }, { dedupeWindowMs:0 });
}

function onChange(event) {
  if (!event.isTrusted) return;
  const target = event.target instanceof HTMLInputElement ? event.target : null;
  if (!target) return;
  const kind = targetField(target);
  if (!kind) return;
  if (!target.matches('#z14Load,#z14Reps,[data-set-key][data-field]')) return;
  record('workout_target_edited', { kind, method:'manual' }, { dedupeWindowMs:0 });
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden' && currentPage() === 'train') recordSessionLeft('background');
  if (document.visibilityState === 'visible' && currentPage() === 'train') maybeRecordResume('foreground');
}

function init() {
  document.documentElement.dataset.zero2fitTrainingFriction = 'ready';
  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', () => {
    if (currentPage() === 'train') recordSessionLeft('pagehide');
  });
  window.addEventListener('focus', () => {
    if (currentPage() === 'train') maybeRecordResume('focus');
  });
  window.addEventListener('zero2fit:remote-sync', () => {
    if (currentPage() === 'train') maybeRecordResume('remote_sync');
  });
  if (currentPage() === 'train') maybeRecordResume('initial');
  window.dispatchEvent(new CustomEvent('zero2fit:training-friction-ready'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();
