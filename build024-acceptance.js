import * as core from './acceptance-core.mjs';

const APP_KEY = 'zero2fit-v1';
const FUEL_KEY = 'zero2fit-fuel-v2';
const BROWSER_KEY = 'zero2fit-acceptance-browser-v1';
const MANUAL_KEY = 'zero2fit-acceptance-manual-v1';
const remote = window.Zero2FitRemoteSync;
const storage = window.Zero2FitStorage;
const ingestion = window.Zero2FitIngestion;
let initialized = false;
let busy = false;
let lastReport = null;

function readJson(key, fallback = {}) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function browserId() {
  let id = localStorage.getItem(BROWSER_KEY);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `browser-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    localStorage.setItem(BROWSER_KEY, id);
  }
  return id;
}
function manualState() { return readJson(MANUAL_KEY, {}); }
function writeManual(next) { writeJson(MANUAL_KEY, next || {}); }
function shortBrowser(id = browserId()) { return String(id).replace(/^browser-/, '').slice(0, 8); }

function ensureStylesheet() {
  if (document.querySelector('link[href="./build024.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build024.css';
  document.head.appendChild(link);
}

function ensureUi() {
  const page = document.getElementById('page-data');
  const sync = document.getElementById('z8PrivateSync');
  if (!page || !sync || document.getElementById('z24Acceptance')) return Boolean(document.getElementById('z24Acceptance'));
  const card = document.createElement('article');
  card.id = 'z24Acceptance';
  card.className = 'card z24-acceptance';
  card.innerHTML = `
    <div class="z24-head">
      <div><div class="eyebrow">Activation & acceptance · Build 024</div><h2>Finish the real-world setup without guessing.</h2><p class="muted">Zero2Fit checks what the app can prove automatically. The few physical-device checks stay explicit and never authorize Fitness XP by themselves.</p></div>
      <span class="small-tag" id="z24Overall">Checking</span>
    </div>
    <div class="z24-actions">
      <button class="primary-button" type="button" id="z24Run">Run checks + sync</button>
      <span id="z24Browser" class="z24-browser"></span>
    </div>
    <p class="muted compact" id="z24Message">Reading local evidence…</p>
    <div class="z24-grid">
      <section class="z24-section">
        <div class="z24-section-head"><div><span>Build 020</span><h3>Private account acceptance</h3></div><strong id="z24Build020Score">0 / 10</strong></div>
        <div id="z24Build020Steps" class="z24-steps"></div>
      </section>
      <section class="z24-section">
        <div class="z24-section-head"><div><span>Physical iPhone</span><h3>HealthKit acceptance</h3></div><strong id="z24DeviceScore">0 / 5</strong></div>
        <div id="z24DeviceSteps" class="z24-steps"></div>
        <div class="z24-manual">
          <label><input type="checkbox" data-z24-manual="healthkit_value_parity"> I compared representative values through source app → Apple Health → Zero2Fit.</label>
          <label><input type="checkbox" data-z24-manual="healthkit_background_delivery"> I confirmed physical HealthKit background delivery.</label>
          <label><input type="checkbox" data-z24-manual="renpho_model_label"> I checked the RENPHO underside model label.</label>
        </div>
      </section>
    </div>
    <div class="z24-manual z24-adaptive-confirm">
      <label><input type="checkbox" data-z24-manual="adaptive_second_browser_confirmed"> On the second browser, the adaptive target matched after workout history reconstructed.</label>
      <small>This confirmation records acceptance evidence only. It does not alter workout history, device verification, Fitness XP or RPG stats.</small>
    </div>
    <div class="z24-evidence" id="z24Evidence"></div>`;
  sync.after(card);
  bindUi();
  return true;
}

function stateLabel(step) { return step.done ? 'complete' : step.partial ? 'partial' : 'pending'; }
function stateIcon(step) { return step.done ? '✓' : step.partial ? '◐' : '○'; }

function build020Detail(step, evidence) {
  const { fuel, workout, photos, cross, account } = evidence;
  const map = {
    account: account.signed_in ? 'Authenticated session is active.' : 'Create/sign in above with the private account you want to keep.',
    'manual-food': `${fuel.manual_entries} manual/quick-line entr${fuel.manual_entries === 1 ? 'y' : 'ies'} detected.`,
    'provider-food': `${fuel.provider_entries} Open Food Facts entr${fuel.provider_entries === 1 ? 'y' : 'ies'} detected.`,
    'saved-meal': `${fuel.saved_meals} saved meal${fuel.saved_meals === 1 ? '' : 's'} detected.`,
    targets: `${fuel.targets_set} / 4 explicit macro/calorie targets set.`,
    sync: fuel.synced ? `${fuel.remote_entries} Fuel entries reconciled on the last private sync.` : 'Use Run checks + sync after signing in.',
    'second-browser': `${cross.browser_count} authenticated browser instance${cross.browser_count === 1 ? '' : 's'} recorded · Fuel reconstructed on two: ${cross.fuel_reconstructed ? 'yes' : 'not yet'}.`,
    'fuel-delete': `${fuel.tombstones} local deletion tombstone${fuel.tombstones === 1 ? '' : 's'} · seen on two browsers: ${cross.fuel_deletion_propagated ? 'yes' : 'not yet'}.`,
    workout: `${workout.history_rows} exercise-history rows · ${workout.synced_sets} synced sets · two-browser history match: ${cross.matching_workout_history ? 'yes' : 'not yet'}.`,
    photo: `${photos.remote_assets} remote photo assets · upload→other-browser download: ${cross.photo_round_trip ? 'yes' : 'not yet'} · deletion propagation: ${cross.photo_deletion_propagated ? 'yes' : 'not yet'}.`
  };
  return map[step.id] || '';
}

function deviceDetail(step, devices) {
  const map = {
    zepp:`Verified: ${devices.zepp_verified ? 'yes' : 'no'} · observed metric types on verified bundle: ${devices.zepp_metric_types}.`,
    renpho:`Verified: ${devices.renpho_verified ? 'yes' : 'no'} · observed metric types on verified bundle: ${devices.renpho_metric_types}.`,
    parity:'Manual evidence checkpoint; does not authorize device Fitness XP.',
    background:'Manual physical-device checkpoint; simulator/browser tests cannot establish this.',
    'renpho-label':'Manual hardware-label checkpoint; keep the model unresolved until the underside label is checked.'
  };
  return map[step.id] || '';
}

function renderSteps(targetId, steps, detailFn, evidence) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = steps.map(step => `
    <div class="z24-step" data-state="${stateLabel(step)}">
      <span class="z24-step-icon">${stateIcon(step)}</span>
      <span><strong>${esc(step.label)}</strong><small>${esc(detailFn(step, evidence))}</small></span>
    </div>`).join('');
}

function renderManual(manual, cross) {
  document.querySelectorAll('[data-z24-manual]').forEach(input => {
    input.checked = Boolean(manual[input.dataset.z24Manual]);
    if (input.dataset.z24Manual === 'adaptive_second_browser_confirmed') {
      input.disabled = !(cross.browser_count >= 2 && cross.workout_reconstructed && cross.matching_workout_history);
      input.closest('label')?.classList.toggle('z24-disabled', input.disabled);
    }
  });
}

function render(report) {
  lastReport = report;
  const buildSummary = core.summarizeSteps(report.build020Steps);
  const deviceSummary = core.summarizeSteps(report.deviceSteps);
  const overall = document.getElementById('z24Overall');
  const buildScore = document.getElementById('z24Build020Score');
  const deviceScore = document.getElementById('z24DeviceScore');
  const browser = document.getElementById('z24Browser');
  const run = document.getElementById('z24Run');
  if (overall) overall.textContent = buildSummary.done && deviceSummary.done ? 'Activated' : `${buildSummary.complete + deviceSummary.complete} / ${buildSummary.total + deviceSummary.total}`;
  if (buildScore) buildScore.textContent = `${buildSummary.complete} / ${buildSummary.total}`;
  if (deviceScore) deviceScore.textContent = `${deviceSummary.complete} / ${deviceSummary.total}`;
  if (browser) browser.textContent = `Browser ${shortBrowser()} · ${report.cross.browser_count} recorded`;
  if (run) run.textContent = report.account.signed_in ? 'Run checks + sync' : 'Run local checks';
  renderSteps('z24Build020Steps', report.build020Steps, build020Detail, report);
  renderSteps('z24DeviceSteps', report.deviceSteps, deviceDetail, report.devices);
  renderManual(report.manual, report.cross);

  const evidence = document.getElementById('z24Evidence');
  if (evidence) evidence.innerHTML = `
    <span><strong>${report.fuel.entries}</strong> Fuel entries</span>
    <span><strong>${report.workout.history_rows}</strong> exercise-history rows</span>
    <span><strong>${report.photos.local_assets}</strong> local photos</span>
    <span><strong>${report.devices.observed_bundles}</strong> observed HealthKit bundles</span>`;
  const message = document.getElementById('z24Message');
  if (message) {
    if (!report.account.signed_in) message.textContent = 'Local evidence checked. Sign in above when you are ready to exercise the authenticated cross-browser acceptance path.';
    else if (buildSummary.done && deviceSummary.done) message.textContent = 'Build 020 and physical-device acceptance evidence are complete. Continue with Use → Measure → Tune.';
    else if (report.cross.browser_count < 2) message.textContent = 'This browser is registered. Open Zero2Fit in a second browser/private session, sign in to the same account, then tap Run checks + sync there.';
    else message.textContent = 'Two-browser evidence is active. Complete the remaining real actions shown below; rerun checks after each sync.';
  }
}

async function localEvidence() {
  const [events, photos] = await Promise.all([
    storage?.getRecentEvents?.(50000).catch(() => []) || [],
    storage?.getAllPhotoMetadata?.().catch(() => []) || []
  ]);
  return {
    app:readJson(APP_KEY, {}),
    fuel:readJson(FUEL_KEY, {}),
    events:events || [],
    photos:photos || []
  };
}

async function collectReport({ remoteEvents = null } = {}) {
  const id = browserId();
  const status = remote?.status?.() || { configured:false, signed_in:false, last_sync:null };
  const local = await localEvidence();
  let observations = [];
  let verifications = [];
  let allEvents = remoteEvents || local.events;
  if (status.signed_in) {
    try {
      const [pulled, observed, verified] = await Promise.all([
        remote.pullEvents?.(50000) || [],
        remote.pullSourceObservations?.() || [],
        remote.pullVerifications?.() || []
      ]);
      allEvents = pulled || allEvents;
      observations = observed || [];
      verifications = verified || [];
    } catch {}
  }

  const snapshots = core.latestAcceptanceSnapshots(allEvents);
  const prior = snapshots.find(row => row.browser_instance_id === id) || {};
  const manual = { ...(prior.manual || {}), ...manualState() };
  const fuel = core.fuelEvidence(local.fuel, allEvents, status.last_sync || {});
  const workout = core.workoutEvidence(local.app, status.last_sync || {});
  const photos = core.photoEvidence(local.photos, allEvents, status.last_sync || {}, prior.photos || {});
  const devices = core.deviceEvidence(observations, verifications, manual);
  const snapshot = {
    version:1,
    browser_instance_id:id,
    recorded_at:new Date().toISOString(),
    account:{ signed_in:Boolean(status.signed_in) },
    fuel,
    workout,
    photos,
    devices,
    manual
  };
  const withoutCurrent = snapshots.filter(row => row.browser_instance_id !== id);
  const cross = core.crossBrowserEvidence([...withoutCurrent, snapshot]);
  const build020Steps = core.build020Steps({ account:snapshot.account, fuel, workout, photos, cross, manual });
  const deviceSteps = core.physicalDeviceSteps(devices);
  return { account:snapshot.account, fuel, workout, photos, devices, manual, snapshot, cross, build020Steps, deviceSteps };
}

async function publishSnapshot(snapshot) {
  if (!snapshot?.browser_instance_id || !ingestion?.makeEvent || !storage?.upsertEvents) return null;
  const event = ingestion.makeEvent(core.acceptanceEventInput(snapshot));
  await storage.upsertEvents([event]);
  if (remote?.status?.().signed_in && remote?.pushEvents) await remote.pushEvents([event]);
  return event;
}

async function runChecks({ sync = false, publish = false } = {}) {
  if (busy) return;
  busy = true;
  document.getElementById('z24Run')?.setAttribute('disabled','');
  try {
    const signedIn = Boolean(remote?.status?.().signed_in);
    if (sync && signedIn && remote?.syncNow) await remote.syncNow();
    let report = await collectReport();
    if (publish) {
      await publishSnapshot(report.snapshot);
      let pulled = null;
      if (signedIn && remote?.pullEvents) pulled = await remote.pullEvents(50000).catch(() => null);
      report = await collectReport({ remoteEvents:pulled });
    }
    render(report);
  } catch (error) {
    const message = document.getElementById('z24Message');
    if (message) message.textContent = `Acceptance checks could not finish: ${error.message}`;
  } finally {
    busy = false;
    document.getElementById('z24Run')?.removeAttribute('disabled');
  }
}

function bindUi() {
  document.getElementById('z24Run')?.addEventListener('click', () => {
    const signedIn = Boolean(remote?.status?.().signed_in);
    runChecks({ sync:signedIn, publish:signedIn });
  });
  document.querySelectorAll('[data-z24-manual]').forEach(input => input.addEventListener('change', () => {
    const manual = manualState();
    manual[input.dataset.z24Manual] = Boolean(input.checked);
    writeManual(manual);
    runChecks({ sync:false, publish:false });
  }));
}

function bindEvents() {
  window.addEventListener('zero2fit:remote-session', () => setTimeout(() => runChecks({sync:false,publish:false}), 50));
  window.addEventListener('zero2fit:remote-sync', () => setTimeout(() => runChecks({sync:false,publish:false}), 120));
  window.addEventListener('zero2fit:fuel-updated', () => setTimeout(() => runChecks({sync:false,publish:false}), 80));
  window.addEventListener('focus', () => setTimeout(() => runChecks({sync:false,publish:false}), 80));
}

function qaFocus() {
  if (sessionStorage.getItem('zero2fit-qa-acceptance') !== '1') return;
  setTimeout(() => {
    document.getElementById('z24Acceptance')?.scrollIntoView({ block:'start', behavior:'auto' });
    document.documentElement.dataset.zero2fitQaReady = 'acceptance';
  }, 1200);
}

function init() {
  if (initialized) return;
  if (!remote || !storage || !ingestion || !document.getElementById('z8PrivateSync')) return setTimeout(init, 100);
  initialized = true;
  ensureStylesheet();
  if (!ensureUi()) return;
  document.body.classList.add('build024-acceptance');
  bindEvents();
  runChecks({sync:false,publish:false});
  qaFocus();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
else init();

window.Zero2FitAcceptance = { runChecks, collectReport, browserId, get lastReport(){ return lastReport; } };
