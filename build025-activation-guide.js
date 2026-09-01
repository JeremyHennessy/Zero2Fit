import * as core from './activation-guide-core.mjs';

const APP_KEY = 'zero2fit-v1';
const FUEL_KEY = 'zero2fit-fuel-v2';
const BROWSER_KEY = 'zero2fit-activation-browser-v1';
const MANUAL_KEY = 'zero2fit-activation-manual-v1';
const PRIVATE_ACCEPTANCE_KEY = 'zero2fit-private-acceptance-v1';
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
  if (document.querySelector('link[href="./build025.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build025.css';
  document.head.appendChild(link);
}

function ensureUi() {
  const sync = document.getElementById('z8PrivateSync');
  if (!sync || document.getElementById('z25ActivationGuide')) return Boolean(document.getElementById('z25ActivationGuide'));
  const card = document.createElement('article');
  card.id = 'z25ActivationGuide';
  card.className = 'card z25-activation';
  card.innerHTML = `
    <div class="z25-head">
      <div><div class="eyebrow">Activation guide · Build 025</div><h2>Finish real-account and iPhone acceptance.</h2><p class="muted">The Build 024 self-test proves the private store itself. This guide tracks the remaining real data flow across two browsers and the physical HealthKit checks software cannot manufacture.</p></div>
      <span class="small-tag" id="z25Overall">Checking</span>
    </div>
    <div class="z25-prereq" id="z25Infrastructure" data-state="pending">
      <span class="z25-prereq-icon">○</span><div><strong>Private-store infrastructure self-test</strong><small>Sign in, then run the Build 024 acceptance self-test above before cross-browser acceptance.</small></div>
    </div>
    <div class="z25-actions">
      <button class="primary-button" type="button" id="z25Run">Run local checks</button>
      <button class="secondary-button" type="button" id="z25RunInfrastructure" hidden>Run private-store self-test</button>
      <span id="z25Browser" class="z25-browser"></span>
    </div>
    <p class="muted compact" id="z25Message">Reading local evidence…</p>
    <div class="z25-grid">
      <section class="z25-section">
        <div class="z25-section-head"><div><span>Build 020</span><h3>Real-account acceptance</h3></div><strong id="z25Build020Score">0 / 10</strong></div>
        <div id="z25Build020Steps" class="z25-steps"></div>
      </section>
      <section class="z25-section">
        <div class="z25-section-head"><div><span>Physical iPhone</span><h3>HealthKit acceptance</h3></div><strong id="z25DeviceScore">0 / 5</strong></div>
        <div id="z25DeviceSteps" class="z25-steps"></div>
        <div class="z25-manual">
          <label><input type="checkbox" data-z25-manual="healthkit_value_parity"> I compared representative values through source app → Apple Health → Zero2Fit.</label>
          <label><input type="checkbox" data-z25-manual="healthkit_background_delivery"> I confirmed physical HealthKit background delivery.</label>
          <label><input type="checkbox" data-z25-manual="renpho_model_label"> I checked the RENPHO underside model label.</label>
        </div>
      </section>
    </div>
    <div class="z25-manual z25-adaptive-confirm">
      <label><input type="checkbox" data-z25-manual="adaptive_second_browser_confirmed"> On the second browser, the adaptive target matched after workout history reconstructed.</label>
      <small>Manual confirmations are evidence only. They never create workouts, verify a HealthKit bundle, award Fitness XP or change RPG stats.</small>
    </div>
    <div class="z25-evidence" id="z25Evidence"></div>`;
  sync.after(card);
  bindUi();
  return true;
}

function stateLabel(step) { return step.done ? 'complete' : step.partial ? 'partial' : 'pending'; }
function stateIcon(step) { return step.done ? '✓' : step.partial ? '◐' : '○'; }

function build020Detail(step, report) {
  const { fuel, workout, photos, cross, account, infrastructure } = report;
  const map = {
    account:account.signed_in ? 'Authenticated session is active.' : 'Create/sign in above with the private account you want to keep.',
    'manual-food':`${fuel.manual_entries} manual/quick-line entr${fuel.manual_entries === 1 ? 'y' : 'ies'} detected.`,
    'provider-food':`${fuel.provider_entries} Open Food Facts entr${fuel.provider_entries === 1 ? 'y' : 'ies'} detected.`,
    'saved-meal':`${fuel.saved_meals} saved meal${fuel.saved_meals === 1 ? '' : 's'} detected.`,
    targets:`${fuel.targets_set} / 4 explicit macro/calorie targets set.`,
    sync:infrastructure.passed ? (fuel.synced ? `${fuel.remote_entries} Fuel entries reconciled after the private-store self-test.` : 'Private store passed; run checks + sync.') : 'Private sync may work, but the Build 024 infrastructure self-test has not passed for this account yet.',
    'second-browser':`${cross.browser_count} authenticated browser instance${cross.browser_count === 1 ? '' : 's'} recorded · Fuel reconstructed on two: ${cross.fuel_reconstructed ? 'yes' : 'not yet'}.`,
    'fuel-delete':`${fuel.tombstones} deletion tombstone${fuel.tombstones === 1 ? '' : 's'} visible here · seen in two browser snapshots: ${cross.fuel_deletion_propagated ? 'yes' : 'not yet'}.`,
    workout:`${workout.history_rows} exercise-history rows · ${workout.synced_sets} synced sets · two-browser history match: ${cross.matching_workout_history ? 'yes' : 'not yet'}.`,
    photo:`${photos.remote_assets} remote photo assets · upload→other-browser download: ${cross.photo_round_trip ? 'yes' : 'not yet'} · deletion propagation: ${cross.photo_deletion_propagated ? 'yes' : 'not yet'}.`
  };
  return map[step.id] || '';
}

function deviceDetail(step, devices) {
  const map = {
    zepp:`Exact source verified: ${devices.zepp_verified ? 'yes' : 'no'} · observed metric types on that verified bundle: ${devices.zepp_metric_types}.`,
    renpho:`Exact source verified: ${devices.renpho_verified ? 'yes' : 'no'} · observed metric types on that verified bundle: ${devices.renpho_metric_types}.`,
    parity:'Manual physical evidence checkpoint; it does not authorize device Fitness XP.',
    background:'Physical-device checkpoint; simulator/browser tests cannot establish background delivery.',
    'renpho-label':'Hardware-label checkpoint; keep the RENPHO model unresolved until the underside label is checked.'
  };
  return map[step.id] || '';
}

function renderSteps(targetId, steps, detailFn, evidence) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = steps.map(step => `
    <div class="z25-step" data-state="${stateLabel(step)}">
      <span class="z25-step-icon">${stateIcon(step)}</span>
      <span><strong>${esc(step.label)}</strong><small>${esc(detailFn(step, evidence))}</small></span>
    </div>`).join('');
}

function renderManual(manual, cross) {
  document.querySelectorAll('[data-z25-manual]').forEach(input => {
    input.checked = Boolean(manual[input.dataset.z25Manual]);
    if (input.dataset.z25Manual === 'adaptive_second_browser_confirmed') {
      input.disabled = !(cross.browser_count >= 2 && cross.workout_reconstructed && cross.matching_workout_history);
      input.closest('label')?.classList.toggle('z25-disabled', input.disabled);
    }
  });
}

function render(report) {
  lastReport = report;
  const buildSummary = core.summarizeSteps(report.build020Steps);
  const deviceSummary = core.summarizeSteps(report.deviceSteps);
  const overall = document.getElementById('z25Overall');
  const buildScore = document.getElementById('z25Build020Score');
  const deviceScore = document.getElementById('z25DeviceScore');
  const browser = document.getElementById('z25Browser');
  const run = document.getElementById('z25Run');
  const infraRun = document.getElementById('z25RunInfrastructure');
  const infra = document.getElementById('z25Infrastructure');
  if (overall) overall.textContent = buildSummary.done && deviceSummary.done ? 'Activated' : `${buildSummary.complete + deviceSummary.complete} / ${buildSummary.total + deviceSummary.total}`;
  if (buildScore) buildScore.textContent = `${buildSummary.complete} / ${buildSummary.total}`;
  if (deviceScore) deviceScore.textContent = `${deviceSummary.complete} / ${deviceSummary.total}`;
  if (browser) browser.textContent = `Browser ${shortBrowser()} · ${report.cross.browser_count} authenticated snapshot${report.cross.browser_count === 1 ? '' : 's'}`;
  if (run) run.textContent = report.account.signed_in ? 'Run checks + sync' : 'Run local checks';
  if (infraRun) infraRun.hidden = !(report.account.signed_in && !report.infrastructure.passed && window.Zero2FitPrivateAcceptance?.runAcceptanceSelfTest);
  if (infra) {
    infra.dataset.state = report.infrastructure.passed ? 'complete' : report.account.signed_in ? 'ready' : 'pending';
    infra.querySelector('.z25-prereq-icon').textContent = report.infrastructure.passed ? '✓' : '○';
    const detail = infra.querySelector('small');
    if (detail) detail.textContent = report.infrastructure.passed
      ? `Passed${report.infrastructure.finished_at ? ` · ${new Date(report.infrastructure.finished_at).toLocaleString()}` : ''} · ${report.infrastructure.check_count || 0} recorded checks.`
      : report.account.signed_in ? 'Authenticated. Run the self-test once; probe data is cleaned automatically.' : 'Sign in above, then run the Build 024 self-test.';
  }
  renderSteps('z25Build020Steps', report.build020Steps, build020Detail, report);
  renderSteps('z25DeviceSteps', report.deviceSteps, deviceDetail, report.devices);
  renderManual(report.manual, report.cross);

  const evidence = document.getElementById('z25Evidence');
  if (evidence) evidence.innerHTML = `
    <span><strong>${report.fuel.entries}</strong> Fuel entries</span>
    <span><strong>${report.workout.history_rows}</strong> exercise-history rows</span>
    <span><strong>${report.photos.local_assets}</strong> local photos</span>
    <span><strong>${report.devices.observed_bundles}</strong> observed HealthKit bundles</span>`;
  const message = document.getElementById('z25Message');
  if (message) {
    if (!report.account.signed_in) message.textContent = 'Local evidence checked. Sign in above when you are ready to exercise the real private-account path.';
    else if (!report.infrastructure.passed) message.textContent = 'The account is signed in, but the private-store infrastructure self-test still needs to pass before Build 020 can complete.';
    else if (buildSummary.done && deviceSummary.done) message.textContent = 'Build 020 and physical-device evidence are complete. Continue with Use → Measure → Tune.';
    else if (report.cross.browser_count < 2) message.textContent = 'This browser is registered. Open Zero2Fit in a second browser/private session, sign in to the same account, and run checks + sync there.';
    else message.textContent = 'Two-browser evidence is active. Complete the remaining real actions shown below and rerun checks after each sync.';
  }
}

async function localEvidence() {
  const [events, photos] = await Promise.all([
    storage?.getRecentEvents?.(50000).catch(() => []) || [],
    storage?.getAllPhotoMetadata?.().catch(() => []) || []
  ]);
  return { app:readJson(APP_KEY,{}), fuel:readJson(FUEL_KEY,{}), events:events || [], photos:photos || [] };
}

async function collectReport({ remoteEvents = null } = {}) {
  const id = browserId();
  const status = remote?.status?.() || {configured:false,signed_in:false,last_sync:null};
  const local = await localEvidence();
  let observations=[];
  let verifications=[];
  let preference=null;
  let allEvents=remoteEvents || local.events;
  if (status.signed_in) {
    try {
      const [pulled,observed,verified,prefs]=await Promise.all([
        remote.pullEvents?.(50000) || [],
        remote.pullSourceObservations?.() || [],
        remote.pullVerifications?.() || [],
        remote.pullUserPreferencesRow?.() || null
      ]);
      allEvents=pulled || allEvents;
      observations=observed || [];
      verifications=verified || [];
      preference=prefs || null;
    } catch {}
  }

  const snapshots=core.latestBrowserSnapshots(allEvents);
  const prior=snapshots.find(row=>row.browser_instance_id===id) || {};
  const manual=core.mergedManualEvidence(snapshots,manualState());
  const fuel=core.fuelEvidence(local.fuel,allEvents,status.last_sync || {});
  const workout=core.workoutEvidence(local.app,status.last_sync || {});
  const photos=core.photoEvidence(local.photos,allEvents,status.last_sync || {},prior.photos || {});
  const infrastructure=core.privateAcceptanceEvidence(readJson(PRIVATE_ACCEPTANCE_KEY,null),preference);
  const devices=core.deviceEvidence(observations,verifications,manual);
  const snapshot={
    version:1,
    browser_instance_id:id,
    recorded_at:new Date().toISOString(),
    account:{signed_in:Boolean(status.signed_in)},
    infrastructure:{passed:infrastructure.passed,run_id:infrastructure.run_id},
    fuel,workout,photos,manual
  };
  const withoutCurrent=snapshots.filter(row=>row.browser_instance_id!==id);
  const cross=core.crossBrowserEvidence([...withoutCurrent,snapshot]);
  const build020Steps=core.build020Steps({account:snapshot.account,infrastructure,fuel,workout,photos,cross,manual});
  const deviceSteps=core.physicalDeviceSteps(devices);
  return {account:snapshot.account,infrastructure,fuel,workout,photos,devices,manual,snapshot,cross,build020Steps,deviceSteps};
}

async function publishSnapshot(snapshot) {
  if (!snapshot?.browser_instance_id || !ingestion?.makeEvent || !storage?.upsertEvents) return null;
  const event=ingestion.makeEvent(core.activationSnapshotEventInput(snapshot));
  await storage.upsertEvents([event]);
  if (remote?.status?.().signed_in && remote?.pushEvents) await remote.pushEvents([event]);
  return event;
}

async function runChecks({sync=false,publish=false}={}) {
  if (busy) return;
  busy=true;
  document.getElementById('z25Run')?.setAttribute('disabled','');
  try {
    const signedIn=Boolean(remote?.status?.().signed_in);
    if (sync && signedIn && remote?.syncNow) await remote.syncNow();
    let report=await collectReport();
    if (publish) {
      await publishSnapshot(report.snapshot);
      const pulled=signedIn && remote?.pullEvents ? await remote.pullEvents(50000).catch(()=>null) : null;
      report=await collectReport({remoteEvents:pulled});
    }
    render(report);
  } catch (error) {
    const message=document.getElementById('z25Message');
    if (message) message.textContent=`Activation checks could not finish: ${error.message}`;
  } finally {
    busy=false;
    document.getElementById('z25Run')?.removeAttribute('disabled');
  }
}

function bindUi() {
  document.getElementById('z25Run')?.addEventListener('click',()=>{
    const signedIn=Boolean(remote?.status?.().signed_in);
    runChecks({sync:signedIn,publish:signedIn});
  });
  document.getElementById('z25RunInfrastructure')?.addEventListener('click',async()=>{
    if (!window.Zero2FitPrivateAcceptance?.runAcceptanceSelfTest || busy) return;
    busy=true;
    const button=document.getElementById('z25RunInfrastructure');
    if (button) { button.disabled=true; button.textContent='Running self-test…'; }
    try {
      await window.Zero2FitPrivateAcceptance.runAcceptanceSelfTest();
      await runChecks({sync:false,publish:false});
    } catch (error) {
      const message=document.getElementById('z25Message');
      if (message) message.textContent=`Private-store self-test needs attention: ${error.message}`;
    } finally {
      busy=false;
      if (button) { button.disabled=false; button.textContent='Run private-store self-test'; }
      runChecks({sync:false,publish:false});
    }
  });
  document.querySelectorAll('[data-z25-manual]').forEach(input=>input.addEventListener('change',()=>{
    const manual=manualState();
    manual[input.dataset.z25Manual]=Boolean(input.checked);
    writeManual(manual);
    runChecks({sync:false,publish:false});
  }));
}

function bindEvents() {
  window.addEventListener('zero2fit:remote-session',()=>setTimeout(()=>runChecks({sync:false,publish:false}),50));
  window.addEventListener('zero2fit:remote-sync',()=>setTimeout(()=>runChecks({sync:false,publish:false}),120));
  window.addEventListener('zero2fit:private-acceptance',()=>setTimeout(()=>runChecks({sync:false,publish:false}),100));
  window.addEventListener('zero2fit:fuel-updated',()=>setTimeout(()=>runChecks({sync:false,publish:false}),80));
  window.addEventListener('focus',()=>setTimeout(()=>runChecks({sync:false,publish:false}),80));
}

function qaFocus() {
  if (new URLSearchParams(location.search).get('qaFocus') !== 'activation') return;
  setTimeout(()=>{
    document.getElementById('z25ActivationGuide')?.scrollIntoView({block:'start',behavior:'auto'});
    document.documentElement.dataset.zero2fitQaReady='activation';
  },1200);
}

function init() {
  if (initialized) return;
  if (!remote || !storage || !ingestion || !document.getElementById('z8PrivateSync') || !window.Zero2FitPrivateAcceptance) return setTimeout(init,100);
  initialized=true;
  ensureStylesheet();
  if (!ensureUi()) return;
  document.body.classList.add('build025-activation-guide');
  bindEvents();
  runChecks({sync:false,publish:false});
  qaFocus();
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();

window.Zero2FitActivationGuide={runChecks,collectReport,browserId,get lastReport(){return lastReport;}};
