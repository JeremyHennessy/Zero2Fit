import * as usageCore from './usage-core.mjs';

const USAGE_STORAGE_KEY = 'zero2fit-usage-v1';
const USAGE_SETTINGS_KEY = 'zero2fit-usage-settings-v1';
const APP_STORAGE_KEY = 'zero2fit-v1';
const FUEL_STORAGE_KEY = 'zero2fit-fuel-v2';
const SESSION_KEY = 'zero2fit-usage-session-v1';
const WINDOW_DAYS = 14;

let renderTimer = null;
let lastRenderSignature = '';
let lastPage = null;
let lastPageAt = 0;
let pendingFuelMethod = null;
let pendingFuelAt = 0;
let fuelSnapshot = new Map();

function ensureStyle() {
  if (document.querySelector('link[href="./build043.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build043.css';
  document.head.appendChild(link);
}

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

function writeUsage(state) {
  try { localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(state)); }
  catch {}
}

function readUsage() {
  return usageCore.normalizeUsageState(readJson(USAGE_STORAGE_KEY, {}));
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
  scheduleRender();
  window.dispatchEvent(new CustomEvent('zero2fit:usage-updated', { detail:{ type:result.event.type } }));
  return result.event;
}

function currentPage() {
  return document.querySelector('.page.active')?.id?.replace('page-','') || 'today';
}

function recordPage(page, source = 'nav') {
  const now = Date.now();
  if (!page) return;
  if (page === lastPage && now - lastPageAt < 1500) return;
  lastPage = page;
  lastPageAt = now;
  record('page_view', { page, source });
}

function appState() {
  return readJson(APP_STORAGE_KEY, {});
}

function fuelEntries() {
  const state = readJson(FUEL_STORAGE_KEY, {});
  const entries = [];
  for (const [day, rows] of Object.entries(state.meals || {})) {
    (Array.isArray(rows) ? rows : []).forEach((entry, index) => {
      const id = String(entry?.id || `${day}:${index}:${entry?.loggedAt || ''}`);
      entries.push({ id, day, method:String(entry?.source || 'manual') });
    });
  }
  return entries;
}

function resetFuelSnapshot() {
  fuelSnapshot = new Map(fuelEntries().map(entry => [entry.id, entry]));
}

function markFuelIntent(method) {
  pendingFuelMethod = method;
  pendingFuelAt = Date.now();
}

function observeFuelChange() {
  const current = new Map(fuelEntries().map(entry => [entry.id, entry]));
  const added = [...current.values()].filter(entry => !fuelSnapshot.has(entry.id));
  const removed = [...fuelSnapshot.values()].filter(entry => !current.has(entry.id));
  const recentIntent = pendingFuelMethod && Date.now() - pendingFuelAt < 2500;

  if (recentIntent && added.length) {
    const method = pendingFuelMethod;
    for (const entry of added.slice(0, 4)) {
      record('fuel_entry_logged', {
        method:entry.method === 'open_food_facts' ? 'open_food_facts' : method,
        backfilled:entry.day !== usageCore.dayKey(Date.now())
      }, { dedupeWindowMs:0 });
    }
  }
  if (recentIntent && removed.length) record('fuel_entry_removed', { delta:removed.length }, { dedupeWindowMs:0 });
  fuelSnapshot = current;
  pendingFuelMethod = null;
  pendingFuelAt = 0;
}

function onceToday(type, matcher = () => true) {
  const day = usageCore.dayKey(Date.now());
  return readUsage().events.some(event => event.day === day && event.type === type && matcher(event));
}

function recordGuidance(detail = {}) {
  const action = String(detail.action || 'unknown');
  if (onceToday('guidance_shown', event => event.metadata?.action === action)) return;
  record('guidance_shown', { action, completeCount:Number(detail.completeCount || 0) }, { dedupeWindowMs:0 });
}

function wallOutcome() {
  const text = String(document.getElementById('z16WallState')?.textContent || '').toLowerCase();
  if (text.includes('combat')) return 'combat_wall';
  if (text.includes('real-progress')) return 'capability_gate';
  if (text.includes('arc')) return 'content_complete';
  if (text.includes('paused')) return 'paused';
  if (text.includes('advancing')) return 'advancing';
  return 'unknown';
}

function normalizeFuelMethod(target) {
  if (target.closest('#z17RepeatLast')) return 'repeat';
  if (target.closest('[data-z17-saved-add]')) return 'saved';
  if (target.closest('[data-z17-candidate]')) return 'reusable';
  if (target.closest('[data-z18-log]')) return 'open_food_facts';
  return null;
}

function onClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const nav = target.closest('.nav-item[data-page]');
  if (nav) setTimeout(() => recordPage(nav.dataset.page, 'nav'), 0);

  const quickJump = target.closest('[data-z40-jump]');
  if (quickJump) setTimeout(() => recordPage(quickJump.dataset.z40Jump, 'quick_action'), 0);

  const guidance = target.closest('#z42ActionButton');
  if (guidance) {
    const card = document.getElementById('z42NextAction');
    record('guidance_acted', {
      action:card?.dataset.action || 'unknown',
      kind:card?.dataset.kind || 'unknown'
    });
  }

  const mode = target.closest('[data-workout-mode]');
  if (mode) record('workout_mode_selected', { mode:mode.dataset.workoutMode, source:currentPage() });

  const location = target.closest('[data-workout-location]');
  if (location) record('workout_location_selected', { location:location.dataset.workoutLocation });

  const setCheck = target.closest('[data-set-check]');
  if (setCheck) {
    setTimeout(() => record(setCheck.classList.contains('done') ? 'workout_set_completed' : 'workout_set_uncompleted', {}, { dedupeWindowMs:0 }), 20);
  }

  if (target.closest('#z14SkipSet')) record('workout_set_skipped', {});
  if (target.closest('#z14Substitute,[data-show-substitutes]')) record('workout_substitute_opened', {});

  const substitute = target.closest('[data-choose-substitute]');
  if (substitute) record('workout_substitute_selected', {
    intent:substitute.dataset.substituteIntent || 'unknown',
    location:appState().workoutLocation || 'unknown'
  });

  if (target.closest('#finishWorkout')) {
    const before = Number(appState().completedWorkouts || 0);
    const state = appState();
    setTimeout(() => {
      const after = Number(appState().completedWorkouts || 0);
      record('workout_finish', {
        outcome:after > before ? 'recorded' : 'blocked',
        mode:state.workoutMode || 'unknown',
        location:state.workoutLocation || 'unknown'
      }, { dedupeWindowMs:0 });
    }, 180);
  }

  if (target.closest('#z40AddFood')) record('fuel_panel_opened', {});
  const fuelMethod = normalizeFuelMethod(target);
  if (fuelMethod) markFuelIntent(fuelMethod);

  if (target.closest('#z16Run')) {
    setTimeout(() => record('adventure_run', { outcome:wallOutcome() }, { dedupeWindowMs:0 }), 220);
  }
  if (target.closest('#z16AutoEquip')) record('adventure_auto_equip', {});

  if (target.closest('[data-z17-remove]')) record('fuel_entry_removed', {}, { dedupeWindowMs:0 });

  const quest = target.closest('[data-quest]');
  if (quest) {
    const questId = quest.dataset.quest;
    setTimeout(() => {
      const day = usageCore.dayKey(Date.now());
      const done = Boolean(appState().quests?.[day]?.[questId]);
      record('quest_toggled', { action:questId, outcome:done ? 'done' : 'undone' }, { dedupeWindowMs:0 });
    }, 30);
  }
}

function onSubmit(event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) return;
  if (form.id === 'z17QuickLineForm') markFuelIntent('quick_line');
  if (form.id === 'z17CustomForm') markFuelIntent('manual');
  if (form.id === 'z18SearchForm') record('fuel_lookup', { method:'search' });
  if (form.id === 'z18BarcodeForm') record('fuel_lookup', { method:'barcode' });
  if (form.id === 'stepsForm') record('manual_health_entry', { kind:'steps' });
  if (form.id === 'weightForm') record('manual_health_entry', { kind:'weight' });
}

function pct(value) {
  return `${Math.round(Math.max(0, Math.min(1, Number(value || 0))) * 100)}%`;
}

function modeSummary(modes = {}) {
  const values = ['quick','standard','full'].map(key => `${key[0].toUpperCase()}${key.slice(1)} ${Number(modes[key] || 0)}`);
  return values.join(' · ');
}

function methodLabel(value) {
  return ({quick_line:'Quick line',manual:'Manual',repeat:'Repeat last',saved:'Saved',reusable:'Recent/saved',open_food_facts:'Food database'})[value] || 'Not enough data';
}

function fuelDetail(fuel = {}) {
  const parts = [];
  if (fuel.entriesLogged) parts.push(`${fuel.entriesLogged} logs · ${fuel.shortcutEntries || 0} shortcuts`);
  if (fuel.lookupResolved) parts.push(`${fuel.lookupSuccess || 0}/${fuel.lookupResolved} lookups usable`);
  if (fuel.panelClosed) parts.push(`${fuel.panelAbandoned || 0}/${fuel.panelClosed} sessions abandoned`);
  return parts.join(' · ') || 'Only interaction outcomes are measured, never what you ate.';
}

function ensurePanel() {
  const page = document.getElementById('page-journey');
  if (!page) return null;
  let panel = document.getElementById('z43TuningSignals');
  if (panel) return panel;
  panel = document.createElement('article');
  panel.id = 'z43TuningSignals';
  panel.className = 'card z43-tuning-signals';
  panel.innerHTML = `
    <div class="z43-head">
      <div><span class="z43-eyebrow">TUNING SIGNALS</span><h2>What Zero2Fit is learning</h2><p>Interaction outcomes only. No food names, calorie or macro values, body measurements, heart/sleep values, device bundle IDs, credentials, or account identity are stored here.</p></div>
      <span class="z43-window">14 days</span>
    </div>
    <div class="z43-stats" id="z43Stats"></div>
    <div class="z43-detail-grid">
      <section><span>TRAINING CHOICE</span><strong id="z43Mode">No pattern yet</strong><small id="z43ModeDetail">Use workout modes normally and a preference will emerge.</small></section>
      <section><span>FUEL SHORTCUT</span><strong id="z43FuelMethod">No pattern yet</strong><small id="z43FuelDetail">Only the logging method is measured, never what you ate.</small></section>
    </div>
    <div class="z43-signal-list" id="z43SignalList"></div>
    <footer><span>Stored only in this browser for 90 days, capped at 1,600 interaction events.</span><button type="button" id="z43ClearUsage">Clear tuning history</button></footer>`;
  const anchor = document.getElementById('z10Intelligence')
    || document.getElementById('z4BodyComposition')
    || page.querySelector('.content-grid')
    || page.querySelector('.journey-hero')
    || document.getElementById('z40ProgressIntro');
  if (anchor) anchor.after(panel);
  else page.appendChild(panel);
  panel.querySelector('#z43ClearUsage')?.addEventListener('click', () => {
    if (!window.confirm('Clear local Zero2Fit tuning history? Fitness, Fuel, Adventure, photo and device data are not changed.')) return;
    localStorage.removeItem(USAGE_STORAGE_KEY);
    lastRenderSignature = '';
    render();
  });
  return panel;
}

function stat(label, value, detail) {
  return `<div class="z43-stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`;
}

function render() {
  const panel = ensurePanel();
  if (!panel) return;
  const summary = usageCore.summarizeUsage(readUsage(), { days:WINDOW_DAYS });
  const signature = JSON.stringify(summary);
  if (signature === lastRenderSignature) return;
  lastRenderSignature = signature;

  const handled = summary.workout.setsCompleted + summary.workout.setsSkipped;
  document.getElementById('z43Stats').innerHTML = [
    stat('Guidance', `${summary.guidance.acted}/${summary.guidance.shown}`, summary.guidance.shown ? `${pct(summary.guidance.followRate)} opened` : 'Measurement active'),
    stat('Workout sets', `${summary.workout.setsCompleted}`, handled ? `${summary.workout.setsSkipped} skipped` : 'No handled sets yet'),
    stat('Fuel logs', `${summary.fuel.entriesLogged}`, summary.fuel.panelOpened ? `${summary.fuel.panelOpened} Add Food opens` : 'No local use yet'),
    stat('Adventure', `${summary.adventure.runs}`, summary.adventure.topOutcome ? summary.adventure.topOutcome.replace(/_/g,' ') : 'No expedition use yet')
  ].join('');

  const preferredMode = summary.workout.preferredMode;
  document.getElementById('z43Mode').textContent = preferredMode ? `${preferredMode[0].toUpperCase()}${preferredMode.slice(1)} leads` : 'No pattern yet';
  document.getElementById('z43ModeDetail').textContent = modeSummary(summary.workout.modes);
  document.getElementById('z43FuelMethod').textContent = summary.fuel.preferredMethod ? methodLabel(summary.fuel.preferredMethod) : 'No pattern yet';
  document.getElementById('z43FuelDetail').textContent = fuelDetail(summary.fuel);

  const list = document.getElementById('z43SignalList');
  if (!summary.eventCount) {
    list.innerHTML = '<div class="z43-empty"><strong>Measurement is active.</strong><span>Use Zero2Fit normally. Repeated friction patterns will appear here before they are used to tune the app.</span></div>';
  } else if (!summary.signals.length) {
    list.innerHTML = `<div class="z43-empty"><strong>No repeated friction pattern yet.</strong><span>${summary.eventCount} privacy-minimized interactions across ${summary.activeDays} active day${summary.activeDays === 1 ? '' : 's'} are in the current window.</span></div>`;
  } else {
    list.innerHTML = summary.signals.slice(0, 3).map(signal => `<div class="z43-signal ${signal.severity}"><span></span><div><strong>${signal.title}</strong><small>${signal.detail}</small></div></div>`).join('');
  }
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 70);
}

function init() {
  ensureStyle();
  resetFuelSnapshot();
  if (!sessionStorage.getItem(SESSION_KEY)) {
    sessionStorage.setItem(SESSION_KEY, '1');
    record('app_session', { page:currentPage() });
  }
  recordPage(currentPage(), 'initial');
  const guidanceCard = document.getElementById('z42NextAction');
  if (guidanceCard?.dataset.action) recordGuidance({ action:guidanceCard.dataset.action, completeCount:Number(document.getElementById('z42ActionProgress')?.textContent?.match(/\d+/)?.[0] || 0) });
  render();
  document.addEventListener('click', onClick, true);
  document.addEventListener('submit', onSubmit, true);
  window.addEventListener('zero2fit:daily-guidance', event => recordGuidance(event.detail || {}));
  window.addEventListener('zero2fit:fuel-updated', () => setTimeout(observeFuelChange, 0));
  window.addEventListener('zero2fit:usage-updated', scheduleRender);
  window.addEventListener('focus', scheduleRender);
  setTimeout(render, 700);
  setTimeout(render, 1800);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();
