import * as core from './healthkit-evidence-core.mjs';

const EVIDENCE_KEY = 'zero2fit-healthkit-evidence-v1';
const ACTIVATION_MANUAL_KEY = 'zero2fit-activation-manual-v1';
const remote = window.Zero2FitRemoteSync;
const storage = window.Zero2FitStorage;
const ingestion = window.Zero2FitIngestion;
let initialized = false;
let observations = [];
let verifications = [];
let evidence = core.defaultEvidence();
let busy = false;
let originalVerifySource = null;

function readJson(key, fallback = {}) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function ensureStylesheet() {
  if (document.querySelector('link[href="./build028.css"]')) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = './build028.css'; document.head.appendChild(link);
}
function statusLabel(status) {
  return ({pending:'Pending',matched:'Matched',not_provided:'Not provided',mismatch:'Mismatch'})[status] || 'Pending';
}
function providerLabel(provider) { return provider === 'zepp' ? 'Zepp / Amazfit' : 'RENPHO Health'; }

function ensureUi() {
  const activation = document.getElementById('z26ActivationGuide');
  if (!activation || document.getElementById('z28HealthKitEvidence')) return Boolean(document.getElementById('z28HealthKitEvidence'));
  const panel = document.createElement('article');
  panel.id = 'z28HealthKitEvidence';
  panel.className = 'card z28-evidence';
  panel.innerHTML = `
    <div class="z28-head">
      <div><div class="eyebrow">Physical HealthKit evidence · Build 028</div><h2>Resolve the source before you verify it.</h2><p class="muted">Choose the exact observed bundle for Zepp and RENPHO, compare representative values on the physical phone, then resolve each metric. This stores source IDs and check statuses only—not the health values you compared.</p></div>
      <span class="small-tag" id="z28Overall">Pending</span>
    </div>
    <div class="z28-provider-grid">
      <section class="z28-provider" data-provider="zepp"><div class="z28-provider-head"><div><span>Wearable source</span><h3>Zepp / Amazfit</h3></div><span class="z28-ready" id="z28ZeppReady">Not ready</span></div><label class="z28-bundle"><span>Observed HealthKit bundle</span><select id="z28ZeppBundle"></select></label><div id="z28ZeppMetrics" class="z28-metrics"></div><p class="muted compact" id="z28ZeppBlocker"></p></section>
      <section class="z28-provider" data-provider="renpho"><div class="z28-provider-head"><div><span>Scale source</span><h3>RENPHO Health</h3></div><span class="z28-ready" id="z28RenphoReady">Not ready</span></div><label class="z28-bundle"><span>Observed HealthKit bundle</span><select id="z28RenphoBundle"></select></label><div id="z28RenphoMetrics" class="z28-metrics"></div><label class="z28-model"><span>RENPHO underside model label</span><input id="z28RenphoModel" type="text" autocomplete="off" placeholder="e.g. exact label from underside"></label><p class="muted compact" id="z28RenphoBlocker"></p></section>
    </div>
    <label class="z28-background"><input id="z28Background" type="checkbox"> <span><strong>Physical background delivery confirmed</strong><small>I observed a new HealthKit/source-app change reach Zero2Fit without manually opening/syncing the bridge at that moment.</small></span></label>
    <div class="z28-actions"><button class="primary-button" type="button" id="z28Save">Save evidence locally</button><button class="z4-secondary" type="button" id="z28JumpVerify">Go to source verification</button><span class="z28-sync-note" id="z28SyncNote"></span></div>
    <p class="z28-integrity"><strong>Trust boundary:</strong> this evidence never creates a source verification or Fitness XP. The existing Verify Zepp / Verify RENPHO actions stay disabled until the selected provider's matrix is resolved with no mismatches.</p>`;
  activation.after(panel);
  bindUi();
  return true;
}

function hideCoarsePhysicalCheckboxes() {
  for (const key of ['healthkit_value_parity','healthkit_background_delivery','renpho_model_label']) {
    const input = document.querySelector(`[data-z26-manual="${key}"]`);
    if (input?.closest('label')) input.closest('label').hidden = true;
  }
}

function bundleOptions(selected) {
  const bundles = core.groupObservations(observations);
  const first = `<option value="">${bundles.length ? 'Select observed bundle…' : 'No source bundles captured yet'}</option>`;
  return first + bundles.map(row => {
    const label = `${row.source_name || 'Unnamed HealthKit source'} · ${row.bundle_id} · ${row.metrics.size} metric${row.metrics.size === 1 ? '' : 's'} · ${row.sample_count} samples`;
    return `<option value="${esc(row.bundle_id)}" ${row.bundle_id === selected ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

function renderBundleSelect(provider) {
  const select = document.getElementById(provider === 'zepp' ? 'z28ZeppBundle' : 'z28RenphoBundle');
  if (!select) return;
  const current = evidence.providers[provider].candidate_bundle_id;
  select.innerHTML = bundleOptions(current);
  select.value = current || '';
}

function metricRow(provider, row) {
  const observedText = row.observed
    ? `Observed from selected bundle: ${row.observed_metric_types.join(', ')}`
    : 'Not observed in the current bridge capture.';
  return `<div class="z28-metric" data-status="${row.status}">
    <span class="z28-metric-copy"><strong>${esc(row.label)}</strong><small>${esc(observedText)}</small></span>
    <select data-z28-metric="${esc(provider)}:${esc(row.id)}" aria-label="${esc(row.label)} parity status">
      <option value="pending" ${row.status === 'pending' ? 'selected' : ''}>Pending</option>
      <option value="matched" ${row.status === 'matched' ? 'selected' : ''} ${row.observed ? '' : 'disabled'}>Matched</option>
      <option value="not_provided" ${row.status === 'not_provided' ? 'selected' : ''} ${row.observed ? 'disabled' : ''}>Not provided</option>
      <option value="mismatch" ${row.status === 'mismatch' ? 'selected' : ''}>Mismatch</option>
    </select>
  </div>`;
}

function renderProvider(provider) {
  const parity = core.providerParity(provider, evidence, observations);
  const target = document.getElementById(provider === 'zepp' ? 'z28ZeppMetrics' : 'z28RenphoMetrics');
  const ready = document.getElementById(provider === 'zepp' ? 'z28ZeppReady' : 'z28RenphoReady');
  const blocker = document.getElementById(provider === 'zepp' ? 'z28ZeppBlocker' : 'z28RenphoBlocker');
  if (target) target.innerHTML = parity.rows.length ? parity.rows.map(row => metricRow(provider,row)).join('') : '<div class="empty-state compact">Select the source bundle first.</div>';
  if (ready) { ready.textContent = parity.ready ? 'Ready to verify' : `${parity.resolved} / ${parity.total} resolved`; ready.dataset.state = parity.ready ? 'ready' : parity.has_mismatch ? 'mismatch' : 'pending'; }
  if (blocker) blocker.textContent = parity.ready ? 'Physical metric evidence is resolved. Use the existing source-verification action below to explicitly authorize this exact bundle.' : (parity.blockers[0] || 'Resolve the matrix before source verification.');
  target?.querySelectorAll('[data-z28-metric]').forEach(select => select.addEventListener('change', onMetricChange));
}

function providerVerification(provider) {
  return (verifications || []).find(row => row?.provider === provider) || null;
}

function render() {
  renderBundleSelect('zepp');
  renderBundleSelect('renpho');
  renderProvider('zepp');
  renderProvider('renpho');
  const model = document.getElementById('z28RenphoModel'); if (model && document.activeElement !== model) model.value = evidence.renpho_model_label || '';
  const background = document.getElementById('z28Background'); if (background) background.checked = Boolean(evidence.background_delivery);
  const zepp = core.providerParity('zepp',evidence,observations);
  const renpho = core.providerParity('renpho',evidence,observations);
  const overall = document.getElementById('z28Overall');
  if (overall) {
    overall.textContent = zepp.ready && renpho.ready ? 'Parity resolved' : `${zepp.resolved + renpho.resolved} / ${zepp.total + renpho.total} resolved`;
    overall.dataset.state = zepp.ready && renpho.ready ? 'ready' : (zepp.has_mismatch || renpho.has_mismatch) ? 'mismatch' : 'pending';
  }
  const save = document.getElementById('z28Save'); if (save) save.textContent = remote?.status?.().signed_in ? 'Save evidence + sync' : 'Save evidence locally';
  const note = document.getElementById('z28SyncNote');
  if (note) {
    if (remote?.status?.().signed_in) note.textContent = 'Private sync active · status evidence follows the account.';
    else note.textContent = 'Sign in to private sync to carry this evidence to another browser.';
  }
  applyVerificationGate();
}

function candidateSourceName(bundleId) {
  return core.groupObservations(observations).find(row => row.bundle_id === bundleId)?.source_name || null;
}

function onCandidateChange(provider, value) {
  evidence = core.assignCandidate(evidence, provider, value || null, candidateSourceName(value));
  persistLocal(false);
  render();
}
function onMetricChange(event) {
  const [provider,metric] = String(event.target.dataset.z28Metric || '').split(':');
  evidence = core.setMetricStatus(evidence, provider, metric, event.target.value);
  persistLocal(false);
  render();
}

function syncActivationManual() {
  const manual = readJson(ACTIVATION_MANUAL_KEY, {});
  Object.assign(manual, core.manualActivationFlags(evidence, observations));
  writeJson(ACTIVATION_MANUAL_KEY, manual);
}

async function persistLocal(publishRemote = false) {
  writeJson(EVIDENCE_KEY, evidence);
  syncActivationManual();
  if (!ingestion?.makeEvent || !storage?.upsertEvents) return;
  const event = ingestion.makeEvent(core.evidenceEventInput(evidence));
  await storage.upsertEvents([event]).catch(() => {});
  if (publishRemote && remote?.status?.().signed_in && remote?.pushEvents) await remote.pushEvents([event]);
  window.Zero2FitActivationGuide?.runChecks?.({ sync:false, publish:Boolean(publishRemote && remote?.status?.().signed_in) });
}

async function saveEvidence() {
  if (busy) return;
  busy = true;
  const button = document.getElementById('z28Save'); if (button) button.disabled = true;
  try {
    await persistLocal(Boolean(remote?.status?.().signed_in));
    if (remote?.status?.().signed_in) {
      const pulled = await remote.pullEvents?.(50000).catch(() => []);
      const remoteEvidence = core.latestEvidence(pulled || []);
      evidence = core.mergeEvidence(evidence, remoteEvidence);
      writeJson(EVIDENCE_KEY,evidence);
    }
    render();
    const note = document.getElementById('z28SyncNote'); if (note) note.textContent = remote?.status?.().signed_in ? 'Evidence saved privately and activation snapshot refreshed.' : 'Evidence saved in this browser.';
  } catch (error) {
    const note = document.getElementById('z28SyncNote'); if (note) note.textContent = `Evidence save failed: ${error.message}`;
  } finally { busy = false; if (button) button.disabled = false; }
}

function applyVerificationGate() {
  for (const provider of ['zepp','renpho']) {
    const readiness = core.verificationReadiness(provider,evidence,observations);
    const candidate = evidence.providers[provider].candidate_bundle_id;
    document.querySelectorAll(provider === 'zepp' ? '.z8-verify-zepp' : '.z8-verify-renpho').forEach(button => {
      const row = button.closest('.z8-source-row');
      const allowed = Boolean(readiness.ready && row?.dataset.bundle === candidate);
      button.disabled = !allowed;
      button.title = allowed ? `Physical evidence resolved for ${providerLabel(provider)}. Explicit verification is allowed.` : (row?.dataset.bundle !== candidate ? `Choose this bundle as the ${providerLabel(provider)} evidence candidate first.` : readiness.reason);
    });
  }
}

function wrapVerifySource() {
  if (!remote?.verifySource || remote.verifySource.__z28Wrapped) return;
  originalVerifySource = remote.verifySource.bind(remote);
  const wrapped = async args => {
    const provider = args?.provider;
    if (!['zepp','renpho'].includes(provider)) return originalVerifySource(args);
    const freshObservations = await remote.pullSourceObservations?.().catch(() => observations) || observations;
    const readiness = core.verificationReadiness(provider,evidence,freshObservations);
    const candidate = evidence.providers[provider].candidate_bundle_id;
    if (!readiness.ready || args?.source_bundle_id !== candidate) throw new Error(`Physical evidence gate: ${readiness.ready ? `verify the selected candidate ${candidate}` : readiness.reason}`);
    return originalVerifySource(args);
  };
  wrapped.__z28Wrapped = true;
  remote.verifySource = wrapped;
}

async function refreshRemoteEvidence() {
  const status = remote?.status?.() || { signed_in:false };
  if (!status.signed_in) { observations = []; verifications = []; return; }
  const [observed,verified,events] = await Promise.all([
    remote.pullSourceObservations?.().catch(() => []) || [],
    remote.pullVerifications?.().catch(() => []) || [],
    remote.pullEvents?.(50000).catch(() => []) || []
  ]);
  observations = observed || [];
  verifications = verified || [];
  const remoteEvidence = core.latestEvidence(events || []);
  evidence = core.mergeEvidence(evidence,remoteEvidence);
  writeJson(EVIDENCE_KEY,evidence);
}

function bindUi() {
  document.getElementById('z28ZeppBundle')?.addEventListener('change', e => onCandidateChange('zepp',e.target.value));
  document.getElementById('z28RenphoBundle')?.addEventListener('change', e => onCandidateChange('renpho',e.target.value));
  document.getElementById('z28RenphoModel')?.addEventListener('change', e => { evidence = core.setPhysicalField(evidence,'renpho_model_label',e.target.value); persistLocal(false); render(); });
  document.getElementById('z28Background')?.addEventListener('change', e => { evidence = core.setPhysicalField(evidence,'background_delivery',e.target.checked); persistLocal(false); render(); });
  document.getElementById('z28Save')?.addEventListener('click', saveEvidence);
  document.getElementById('z28JumpVerify')?.addEventListener('click', () => { document.getElementById('z8Sources')?.scrollIntoView({behavior:'smooth',block:'start'}); });
}

function watchSourceRows() {
  const target = document.getElementById('z8SourceRows');
  if (!target) return setTimeout(watchSourceRows,150);
  new MutationObserver(() => setTimeout(applyVerificationGate,0)).observe(target,{childList:true,subtree:true});
  applyVerificationGate();
}

async function refresh() {
  evidence = core.normalizeEvidence(readJson(EVIDENCE_KEY,{}));
  await refreshRemoteEvidence();
  syncActivationManual();
  render();
}

async function init() {
  if (initialized) return;
  if (!remote || !storage || !ingestion || !document.getElementById('z26ActivationGuide')) return setTimeout(init,100);
  initialized = true;
  ensureStylesheet();
  ensureUi();
  hideCoarsePhysicalCheckboxes();
  evidence = core.normalizeEvidence(readJson(EVIDENCE_KEY,{}));
  wrapVerifySource();
  watchSourceRows();
  await refresh();
  window.addEventListener('zero2fit:remote-session', () => setTimeout(refresh,80));
  window.addEventListener('zero2fit:remote-sync', () => setTimeout(refresh,120));
  window.addEventListener('focus', () => setTimeout(refresh,100));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();

window.Zero2FitHealthKitEvidence = {
  getEvidence:() => core.normalizeEvidence(evidence),
  verificationReadiness:(provider) => core.verificationReadiness(provider,evidence,observations),
  saveEvidence,
  refresh
};
