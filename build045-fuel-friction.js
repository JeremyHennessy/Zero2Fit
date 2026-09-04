import * as usageCore from './usage-core.mjs';

const USAGE_STORAGE_KEY = 'zero2fit-usage-v1';
const USAGE_SETTINGS_KEY = 'zero2fit-usage-settings-v1';
const FUEL_STORAGE_KEY = 'zero2fit-fuel-v2';

let panelSession = null;
let pendingLookupMethod = null;
let lookupObserver = null;
let controlTimer = null;

function readJson(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch {}
}

function measurementEnabled() {
  return readJson(USAGE_SETTINGS_KEY, { enabled:true })?.enabled !== false;
}

function setMeasurementEnabled(enabled) {
  writeJson(USAGE_SETTINGS_KEY, { enabled:Boolean(enabled), updatedAt:new Date().toISOString() });
  renderMeasurementControl();
  window.dispatchEvent(new CustomEvent('zero2fit:usage-setting-changed', { detail:{ enabled:Boolean(enabled) } }));
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

function fuelEntryCount() {
  const state = readJson(FUEL_STORAGE_KEY, {});
  return Object.values(state.meals || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
}

function ensureStyle() {
  if (document.querySelector('link[href="./build045.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build045.css';
  document.head.appendChild(link);
}

function beginPanelSession() {
  if (!measurementEnabled()) {
    panelSession = null;
    return;
  }
  panelSession = { entryCount:fuelEntryCount() };
}

function finishPanelSession(method = 'close') {
  if (!panelSession) return;
  const start = panelSession;
  panelSession = null;
  const logged = fuelEntryCount() > start.entryCount;
  record('fuel_panel_closed', {
    outcome:logged ? 'logged' : 'abandoned',
    method
  }, { dedupeWindowMs:0 });
}

function markLookup(method) {
  if (!measurementEnabled()) {
    pendingLookupMethod = null;
    return;
  }
  pendingLookupMethod = method;
  attachLookupObserver();
}

function observeLookupStatus() {
  if (!pendingLookupMethod) return;
  const status = document.getElementById('z18Status');
  if (!status) return;
  const state = String(status.dataset.state || '');
  if (!['success','empty','error'].includes(state)) return;
  const method = pendingLookupMethod;
  pendingLookupMethod = null;
  record('fuel_lookup_result', { method, outcome:state }, { dedupeWindowMs:0 });
}

function attachLookupObserver() {
  const status = document.getElementById('z18Status');
  if (!status || lookupObserver) return;
  lookupObserver = new MutationObserver(observeLookupStatus);
  lookupObserver.observe(status, { attributes:true, attributeFilter:['data-state'], childList:true, subtree:true });
}

function ensureControls() {
  const panel = document.getElementById('z43TuningSignals');
  const footer = panel?.querySelector('footer');
  const clear = document.getElementById('z43ClearUsage');
  if (!panel || !footer || !clear) return false;

  let actions = footer.querySelector('.z45-tuning-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'z45-tuning-actions';
    clear.before(actions);
    actions.appendChild(clear);
  }

  if (!document.getElementById('z45ToggleMeasurement')) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'z45ToggleMeasurement';
    toggle.addEventListener('click', () => setMeasurementEnabled(!measurementEnabled()));
    actions.prepend(toggle);
  }

  if (!document.getElementById('z45MeasurementStatus')) {
    const status = document.createElement('span');
    status.id = 'z45MeasurementStatus';
    status.className = 'z45-measurement-status';
    footer.prepend(status);
  }
  renderMeasurementControl();
  return true;
}

function renderMeasurementControl() {
  const enabled = measurementEnabled();
  const usage = readUsage();
  const toggle = document.getElementById('z45ToggleMeasurement');
  const status = document.getElementById('z45MeasurementStatus');
  const panel = document.getElementById('z43TuningSignals');
  const windowLabel = panel?.querySelector('.z43-window');
  const empty = panel?.querySelector('#z43SignalList .z43-empty');

  if (toggle) toggle.textContent = enabled ? 'Pause measurement' : 'Resume measurement';
  if (status) status.textContent = enabled
    ? 'Local tuning measurement is active.'
    : 'Measurement paused. Existing local history is retained until you clear it.';
  panel?.classList.toggle('z45-measurement-paused', !enabled);
  if (windowLabel) windowLabel.textContent = enabled ? '14 days' : 'Paused';

  if (!usage.events.length && empty) {
    const strong = empty.querySelector('strong');
    const detail = empty.querySelector('span');
    if (strong) strong.textContent = enabled ? 'Measurement is active.' : 'Measurement is paused.';
    if (detail) detail.textContent = enabled
      ? 'Use Zero2Fit normally. Repeated friction patterns will appear here before they are used to tune the app.'
      : 'Resume measurement when you want Zero2Fit to collect privacy-minimized interaction outcomes again.';
  }
}

function scheduleControls() {
  clearTimeout(controlTimer);
  controlTimer = setTimeout(() => {
    ensureControls();
    attachLookupObserver();
  }, 80);
}

function onClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  if (target.closest('#z40AddFood')) beginPanelSession();

  if (target.closest('#z40FuelClose')) finishPanelSession('close_button');
  else if (target.id === 'z40FuelSheet') finishPanelSession('backdrop');

  if (target.closest('#z18Scan') && !target.closest('#z18Scan')?.hasAttribute('disabled')) markLookup('camera');
}

function onSubmit(event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) return;
  if (form.id === 'z18SearchForm') markLookup('search');
  if (form.id === 'z18BarcodeForm') markLookup('barcode');
}

function onKeydown(event) {
  if (event.key !== 'Escape') return;
  const panel = document.getElementById('z40FuelSheet');
  if (panel && !panel.hidden) finishPanelSession('escape');
}

function init() {
  ensureStyle();
  document.documentElement.dataset.zero2fitFuelFriction = 'ready';
  document.addEventListener('click', onClick, true);
  document.addEventListener('submit', onSubmit, true);
  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('zero2fit:usage-updated', scheduleControls);
  window.addEventListener('zero2fit:usage-setting-changed', renderMeasurementControl);
  scheduleControls();
  setTimeout(scheduleControls, 700);
  setTimeout(scheduleControls, 1800);
  window.dispatchEvent(new CustomEvent('zero2fit:fuel-friction-ready'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();
