const STORAGE_KEY = 'zero2fit-v1';
const storage = window.Zero2FitStorage;
let core = null;
let deviceCore = null;
let nameMap = new Map();
let refreshTimer = null;

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  storage?.saveSnapshot?.(state).catch(() => {});
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function fmt(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString(undefined, { minimumFractionDigits:digits, maximumFractionDigits:digits });
}

function exerciseName(id) {
  if (nameMap.has(id)) return nameMap.get(id);
  return String(id || 'Exercise')
    .replace(/^exercise[:-]?/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

async function loadNames() {
  try {
    const response = await fetch('./data/generated/training_exercises.json');
    if (!response.ok) return;
    const exercises = await response.json();
    nameMap = new Map((Array.isArray(exercises) ? exercises : []).map(item => [item.id, item.name]));
  } catch {}
}

function ensureUi() {
  const page = document.getElementById('page-journey');
  if (!page || document.getElementById('z10Intelligence')) return;
  const card = document.createElement('article');
  card.id = 'z10Intelligence';
  card.className = 'card';
  card.innerHTML = `
    <div class="card-heading">
      <div><div class="eyebrow">Personal intelligence</div><h2 id="z10Verdict">Building your baseline</h2></div>
      <span class="small-tag" id="z10Confidence">Low confidence</span>
    </div>
    <p class="muted" id="z10VerdictDetail">Zero2Fit needs comparable training history before it can answer whether you are improving.</p>
    <div class="mini-stats">
      <div><span>Workouts · 7d</span><strong id="z10WeekWorkouts">0</strong></div>
      <div><span>Avg steps · 7d</span><strong id="z10WeekSteps">—</strong></div>
      <div><span>Avg sleep · 7d</span><strong id="z10WeekSleep">—</strong></div>
    </div>
    <div class="data-table" id="z10ThenNow"></div>
    <div class="eyebrow">Personal records & strength</div>
    <div class="xp-log" id="z10Records"></div>
    <div class="eyebrow">Your-data correlations</div>
    <div class="xp-log" id="z10Correlations"></div>
    <div class="eyebrow">Explainable recommendations</div>
    <div class="xp-log" id="z10Recommendations"></div>`;
  const body = document.getElementById('z4BodyComposition');
  const photo = document.getElementById('z4PhotoTrackerPreview');
  if (body) body.after(card);
  else if (photo) photo.before(card);
  else page.querySelector('.content-grid')?.before(card) || page.appendChild(card);
}

function renderVerdict(result) {
  const verdict = result.verdict;
  const title = verdict.status === 'improving' ? 'Yes — measurable progress is showing'
    : verdict.status === 'mixed' ? 'Progress is mixed right now'
      : verdict.status === 'stable' ? 'Progress is broadly stable'
        : 'Still building a reliable baseline';
  const titleNode = document.getElementById('z10Verdict');
  const detail = document.getElementById('z10VerdictDetail');
  const confidence = document.getElementById('z10Confidence');
  if (titleNode) titleNode.textContent = title;
  if (detail) detail.textContent = verdict.summary;
  if (confidence) confidence.textContent = `${verdict.confidence[0].toUpperCase()+verdict.confidence.slice(1)} confidence`;
}

function renderWeekly(result) {
  const weekly = result.weekly;
  const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  set('z10WeekWorkouts', `${weekly.workouts}${weekly.workoutDelta ? ` (${weekly.workoutDelta > 0 ? '+' : ''}${weekly.workoutDelta} vs prior)` : ''}`);
  set('z10WeekSteps', Number.isFinite(weekly.averageSteps) ? fmt(Math.round(weekly.averageSteps)) : '—');
  set('z10WeekSleep', Number.isFinite(weekly.averageSleep) ? `${fmt(weekly.averageSleep,1)} h` : '—');
}

function renderThenNow(result) {
  const target = document.getElementById('z10ThenNow');
  if (!target) return;
  const weight = result.weight;
  const nowWeight = Number.isFinite(weight.smoothed) ? `${fmt(weight.smoothed,1)} lb` : 'Need more weigh-ins';
  const weightChange = Number.isFinite(weight.change) ? `${weight.change > 0 ? '+' : ''}${fmt(weight.change,1)} lb smoothed change` : 'Trend not established';
  const strength = result.thenVsNow.strengthImprovers;
  const photos = result.thenVsNow;
  target.innerHTML = `
    <div class="data-row head"><span>Then → Now</span><span>Current</span><span>Change/evidence</span><span>Status</span></div>
    <div class="data-row"><span>Weight trend</span><span>${esc(nowWeight)}</span><span>${esc(weightChange)}</span><span>Direction only · no goal inferred</span></div>
    <div class="data-row"><span>Training</span><span>${result.thenVsNow.workoutCount} workouts</span><span>${esc(result.thenVsNow.firstWorkoutDay || '—')} → ${esc(result.thenVsNow.latestWorkoutDay || '—')}</span><span>Recorded sessions</span></div>
    <div class="data-row"><span>Strength</span><span>${strength.length} improving</span><span>${strength.length ? esc(exerciseName(strength[0].exerciseId)) : 'Need comparable exposures'}</span><span>First vs latest</span></div>
    <div class="data-row"><span>Progress photos</span><span>${photos.photoSessions} sessions</span><span>${esc(photos.firstPhotoDay || '—')} → ${esc(photos.latestPhotoDay || '—')}</span><span>Local-only timeline</span></div>`;

  const weightHistory = document.getElementById('weightHistoryText');
  if (weightHistory && Number.isFinite(weight.smoothed)) {
    weightHistory.textContent = `${weight.count} weigh-in days · latest actual ${fmt(weight.latest,1)} lb · 7-entry smoothed trend ${fmt(weight.smoothed,1)} lb${Number.isFinite(weight.change) ? ` · ${weight.change > 0 ? '+' : ''}${fmt(weight.change,1)} lb over the comparison window` : ''}`;
  }
}

function recordSummary(pr, trend) {
  const parts = [];
  if (Number.isFinite(pr.maxLoad)) parts.push(`max load ${fmt(pr.maxLoad,1)} lb`);
  if (Number.isFinite(pr.maxReps)) parts.push(`max reps ${fmt(pr.maxReps)}`);
  if (Number.isFinite(pr.estimated1rm)) parts.push(`est. 1RM ${fmt(pr.estimated1rm,1)} lb`);
  if (!parts.length) parts.push('baseline recorded');
  if (trend && Number.isFinite(trend.changePercent)) parts.push(`${trend.changePercent >= 0 ? '+' : ''}${fmt(trend.changePercent,1)}% first→latest ${trend.metric === 'estimated_1rm' ? 'estimated strength' : 'rep PR'}`);
  return parts.join(' · ');
}

function renderRecords(result) {
  const target = document.getElementById('z10Records');
  if (!target) return;
  const rows = result.personalRecords.slice(0, 6);
  if (!rows.length) {
    target.innerHTML = '<div class="empty-state compact">Complete and record workout sets to establish personal records.</div>';
    return;
  }
  target.innerHTML = rows.map(pr => {
    const trend = result.strengthTrends.find(row => row.exerciseId === pr.exerciseId);
    return `<div class="xp-row"><span><strong>${esc(exerciseName(pr.exerciseId))}</strong><small>${esc(recordSummary(pr, trend))}</small></span><strong>${pr.exposureCount}×</strong></div>`;
  }).join('');
}

function correlationText(label, row, inverse = false) {
  if (!row || !Number.isFinite(row.r) || row.n < 4) return `<div class="xp-row"><span><strong>${esc(label)}</strong><small>Need at least 4 paired verified-device/workout days.</small></span><strong>${row?.n || 0} pairs</strong></div>`;
  const direction = row.r > 0 ? 'positive' : 'negative';
  return `<div class="xp-row"><span><strong>${esc(label)}</strong><small>r=${row.r.toFixed(2)} · ${row.strength.replace('_',' ')} ${direction} association · association is not causation</small></span><strong>${row.n} pairs</strong></div>`;
}

function renderCorrelations(result) {
  const target = document.getElementById('z10Correlations');
  if (!target) return;
  target.innerHTML = [
    correlationText('Sleep ↔ recorded strength work', result.correlations.sleepVsStrengthVolume),
    correlationText('Resting HR ↔ recorded strength work', result.correlations.restingHrVsStrengthVolume),
    correlationText('HRV ↔ recorded strength work', result.correlations.hrvVsStrengthVolume)
  ].join('');
}

function renderRecommendations(result) {
  const target = document.getElementById('z10Recommendations');
  if (!target) return;
  target.innerHTML = result.recommendations.map(item => `
    <div class="xp-row"><span><strong>${esc(item.title)}</strong><small>${esc(item.action)} Why: ${esc(item.why)}</small></span><strong>${esc(item.confidence)}</strong></div>`).join('');
}

function persistSummary(state, result, trustedCount, photoCount) {
  const summary = {
    day:core.dayKey(),
    verdict:result.verdict,
    weight:result.weight,
    weekly:result.weekly,
    topStrengthTrends:result.strengthTrends.slice(0,10),
    personalRecords:result.personalRecords.slice(0,20),
    correlations:result.correlations,
    recommendations:result.recommendations,
    trustedCorrelationEventCount:trustedCount,
    photoSessionCount:photoCount
  };
  if (JSON.stringify(state.personalIntelligence || {}) === JSON.stringify(summary)) return;
  state.personalIntelligence = summary;
  writeState(state);
  window.dispatchEvent(new CustomEvent('zero2fit:personal-intelligence', { detail:summary }));
}

async function refresh() {
  if (!core || !deviceCore || !storage) return;
  ensureUi();
  const state = readState();
  let events = [];
  let photos = [];
  try {
    [events, photos] = await Promise.all([storage.getRecentEvents(50000), storage.getAllPhotoMetadata()]);
  } catch {}
  const relevant = new Set(['sleep_stage','resting_heart_rate','hrv_sdnn']);
  const trustedEvents = events.filter(event => relevant.has(event?.metric_type) && deviceCore.isTrustedDeviceEvent(event));
  const result = core.buildPersonalIntelligence({
    weights:state.weights || [],
    exerciseHistory:state.exerciseHistory || [],
    workoutHistory:state.workoutHistory || [],
    steps:state.steps || {},
    trustedEvents,
    photoMetadata:photos,
    recovery:state.adaptiveRecovery || null,
    now:Date.now()
  });
  renderVerdict(result);
  renderWeekly(result);
  renderThenNow(result);
  renderRecords(result);
  renderCorrelations(result);
  renderRecommendations(result);
  persistSummary(state, result, trustedEvents.length, result.thenVsNow.photoSessions);
}

function scheduleRefresh(delay = 0) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refresh().catch(error => console.warn('Zero2Fit Build 010 refresh failed', error)), delay);
}

function bind() {
  document.addEventListener('click', event => {
    if (event.target.closest('#finishWorkout,#z8Save,[data-delete-photo],[data-go-page="journey"],.nav-item[data-page="journey"]')) scheduleRefresh(250);
  });
  document.querySelector('#weightForm')?.addEventListener('submit', () => scheduleRefresh(100));
  document.querySelector('#stepsForm')?.addEventListener('submit', () => scheduleRefresh(100));
  window.addEventListener('zero2fit:remote-sync', () => scheduleRefresh(100));
  window.addEventListener('focus', () => scheduleRefresh(100));
}

async function init() {
  try {
    [core, deviceCore] = await Promise.all([import('./intelligence-core.mjs'), import('./device-core.mjs')]);
    await loadNames();
    ensureUi();
    bind();
    scheduleRefresh(80);
  } catch (error) {
    console.warn('Zero2Fit Build 010 personal intelligence initialization failed', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();

import('./build011-adventure.js').catch(error => console.warn('Zero2Fit Build 011 Adventure extension failed to load', error));
