const STORAGE_KEY = 'zero2fit-v1';
const storage = window.Zero2FitStorage;
let adaptive = null;
let deviceCore = null;
let recovery = { score:75, level:'ready', reasons:[], note:'Conservative Zero2Fit training heuristic; not a medical readiness assessment.' };
let trustedRecoveryEventCount = 0;
let enhanceTimer = null;

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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function workoutTouchedToday(state, day) {
  const bucket = state.workoutSets?.[day] || {};
  if (Object.values(bucket).some(row => row?.done || hasOwn(row, 'reps') || hasOwn(row, 'load'))) return true;
  if (Object.entries(state.workoutSessionStarts || {}).some(([key, value]) => key.startsWith(`${day}:`) && Number(value) > 0)) return true;
  if (state.awarded?.[`workout:${day}`]) return true;
  return false;
}

function applySmartTemplate(state) {
  const day = adaptive.localDay();
  if (!day || workoutTouchedToday(state, day)) return false;
  const decision = adaptive.chooseNextTemplate({ workoutHistory:state.workoutHistory || [], today:day });
  if (!decision?.templateId) return false;
  state.plannedTemplates ||= {};
  state.adaptiveTemplateDecisions ||= {};
  state.adaptiveTemplateDecisions[day] = { templateId:decision.templateId, reason:decision.reason };
  if (state.plannedTemplates[day] === decision.templateId) return false;
  state.plannedTemplates[day] = decision.templateId;
  writeState(state);
  return true;
}

function synchronizeExerciseHistory(state) {
  const exposures = adaptive.collectExerciseExposures(state.workoutSets || {});
  const sessions = state.workoutHistory || [];
  const derived = exposures
    .filter(item => item.completedSets > 0)
    .map(item => {
      const session = sessions.find(row => row?.day === item.day && row?.templateId === item.templateId && row?.location === item.location);
      return {
        historyId:`${item.day}|${item.location}|${item.templateId}|${item.intent}|${item.exerciseId}`,
        day:item.day,
        exerciseId:item.exerciseId,
        location:item.location,
        templateId:item.templateId,
        intent:item.intent,
        mode:session?.mode || null,
        sessionCompleted:Boolean(session),
        completedSets:item.completedSets,
        setCount:item.setCount,
        allSetsCompleted:item.allSetsCompleted,
        minReps:item.minReps,
        maxReps:item.maxReps,
        avgReps:item.avgReps,
        workingLoad:item.workingLoad,
        sets:item.sets
      };
    })
    .sort((a,b) => b.day.localeCompare(a.day))
    .slice(0, 1000);
  const oldValue = JSON.stringify(state.exerciseHistory || []);
  const newValue = JSON.stringify(derived);
  if (oldValue === newValue) return false;
  state.exerciseHistory = derived;
  return true;
}

async function loadRecovery(state) {
  let events = [];
  try { events = storage ? await storage.getRecentEvents(50000) : []; } catch {}
  const relevant = new Set(['sleep_stage','resting_heart_rate','hrv_sdnn']);
  const trusted = events.filter(event => relevant.has(event?.metric_type) && deviceCore.isTrustedDeviceEvent(event));
  trustedRecoveryEventCount = trusted.length;
  recovery = adaptive.computeRecoveryStatus({ events:trusted, workoutHistory:state.workoutHistory || [] });
  const summary = {
    score:recovery.score,
    level:recovery.level,
    reasons:recovery.reasons,
    latestSleepHours:recovery.latestSleepHours,
    baselineSleepHours:recovery.baselineSleepHours,
    latestRestingHr:recovery.latestRestingHr,
    baselineRestingHr:recovery.baselineRestingHr,
    latestHrv:recovery.latestHrv,
    baselineHrv:recovery.baselineHrv,
    hoursSinceWorkout:recovery.hoursSinceWorkout,
    trustedRecoveryEventCount
  };
  if (JSON.stringify(state.adaptiveRecovery || {}) !== JSON.stringify(summary)) {
    state.adaptiveRecovery = summary;
    writeState(state);
  }
}

function repRangeForCard(card) {
  const text = card.querySelector('.exercise-guidance span')?.textContent || '';
  const match = text.match(/(\d+)\s*[–-]\s*(\d+)\s*reps/i);
  return match ? [Number(match[1]), Number(match[2])] : [8,12];
}

function externalLoadExercise(card) {
  if (!card.querySelector('input[data-field="load"]')) return false;
  const text = card.textContent || '';
  return /dumbbell|barbell|cable machine|machine|kettlebell|medicine ball|ez bar|sled/i.test(text);
}

function adaptiveLine(card) {
  let line = card.querySelector('.z9-adaptive-line');
  if (!line) {
    line = document.createElement('p');
    line.className = 'exercise-meta muted compact z9-adaptive-line';
    const guidance = card.querySelector('.exercise-guidance');
    if (guidance) guidance.after(line);
    else card.appendChild(line);
  }
  return line;
}

function prescriptionText(prescription, hasExternalLoad) {
  const load = Number.isFinite(Number(prescription.suggestedLoad)) ? `${Number(prescription.suggestedLoad).toFixed(Number(prescription.suggestedLoad) % 1 ? 1 : 0)} lb × ` : '';
  const target = `${load}${prescription.suggestedReps} reps`;
  if (prescription.action === 'establish_baseline') {
    return `Adaptive target: ${prescription.suggestedReps} reps · ${hasExternalLoad ? 'Choose a controlled starting load; Zero2Fit will learn it.' : 'Establish a controlled bodyweight baseline.'}`;
  }
  if (prescription.action === 'increase_load') return `Adaptive target: ${target} · Load progresses after two consecutive top-range exposures.`;
  if (prescription.action === 'recovery_hold') return `Adaptive target: ${target} · Progression held because recovery evidence is not strong enough today.`;
  if (prescription.action === 'recovery_reduce') return `Adaptive target: ${target} · Conservative reduction for a low-recovery day.`;
  if (prescription.action === 'harder_variant_ready') return `Adaptive target: ${prescription.suggestedReps} reps · Ready for a harder bodyweight variation; the current movement stays until you substitute it.`;
  return `Adaptive target: ${target} · Build controlled reps before adding load or difficulty.`;
}

function fillUntouchedInputs(card, state) {
  const repsInputs = [...card.querySelectorAll('input[data-field="reps"][data-set-key]')];
  if (!repsInputs.length) return;
  const parsed = adaptive.parseSetKey(repsInputs[0].dataset.setKey);
  if (!parsed) return;
  const range = repRangeForCard(card);
  const hasExternalLoad = externalLoadExercise(card);
  const prescription = adaptive.suggestNextPrescription({
    exerciseId:parsed.exerciseId,
    repRange:range,
    workoutSets:state.workoutSets || {},
    currentDay:adaptive.localDay(),
    hasExternalLoad,
    loadIncrementLb:5,
    recovery
  });

  const dayBucket = state.workoutSets?.[adaptive.localDay()] || {};
  for (const input of repsInputs) {
    const saved = dayBucket[input.dataset.setKey] || {};
    if (!hasOwn(saved, 'reps')) {
      input.value = prescription.suggestedReps;
      input.dispatchEvent(new Event('change', { bubbles:true }));
    }
  }
  if (hasExternalLoad && Number.isFinite(Number(prescription.suggestedLoad))) {
    for (const input of card.querySelectorAll('input[data-field="load"][data-set-key]')) {
      const saved = dayBucket[input.dataset.setKey] || {};
      if (!hasOwn(saved, 'load')) {
        input.value = prescription.suggestedLoad;
        input.dispatchEvent(new Event('change', { bubbles:true }));
      }
    }
  }
  adaptiveLine(card).textContent = prescriptionText(prescription, hasExternalLoad);
}

function renderRecoveryNote() {
  const header = document.querySelector('#page-train .train-header > div');
  if (!header) return;
  let note = document.getElementById('z9RecoveryNote');
  if (!note) {
    note = document.createElement('p');
    note.id = 'z9RecoveryNote';
    note.className = 'muted compact';
    header.appendChild(note);
  }
  const label = recovery.level === 'low' ? 'Low' : recovery.level === 'moderate' ? 'Moderate' : 'Ready';
  const evidence = trustedRecoveryEventCount
    ? `${trustedRecoveryEventCount} verified HealthKit recovery events considered`
    : 'No verified biometric recovery inputs yet; using workout recency only';
  note.textContent = `Adaptive readiness: ${label} · ${evidence}. Conservative training heuristic, not a medical readiness score.`;
}

function applyObservedEnergy(state) {
  const day = adaptive.localDay();
  const templateId = state.plannedTemplates?.[day] || null;
  const selected = adaptive.selectWorkoutEnergy({
    workoutHistory:state.workoutHistory || [],
    workoutEnergyLog:state.workoutEnergyLog || [],
    day,
    templateId,
    location:state.workoutLocation || null
  });
  if (!selected || selected.preferred !== 'observed') return;
  const value = document.getElementById('energyValue');
  const meta = document.getElementById('energyMeta');
  const preview = document.getElementById('todayEnergyPreview');
  if (value) value.textContent = `${Math.round(selected.kcal)} kcal`;
  const fallback = Number.isFinite(Number(selected.fallbackKcal)) ? ` · MET fallback ~${Math.round(selected.fallbackKcal)} kcal` : '';
  if (meta) meta.textContent = `${selected.source} observed${fallback}`;
  if (preview) preview.textContent = `${Math.round(selected.kcal)} kcal observed from ${selected.source}${fallback}.`;
}

function enhanceWorkout() {
  if (!adaptive) return;
  const state = readState();
  document.querySelectorAll('#exerciseList .exercise-card').forEach(card => fillUntouchedInputs(card, state));
  renderRecoveryNote();
  applyObservedEnergy(readState());
  const latest = readState();
  if (synchronizeExerciseHistory(latest)) writeState(latest);
}

function scheduleEnhance(delay = 0) {
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(enhanceWorkout, delay);
}

function bindRefreshes() {
  const list = document.getElementById('exerciseList');
  if (list) {
    new MutationObserver(() => scheduleEnhance(0)).observe(list, { childList:true, subtree:false });
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-workout-location],[data-workout-mode],[data-set-check],[data-choose-substitute],[data-auto-substitute]')) scheduleEnhance(25);
  });
  window.addEventListener('zero2fit:remote-sync', () => scheduleEnhance(80));
  window.addEventListener('focus', () => scheduleEnhance(80));
}

async function init() {
  try {
    [adaptive, deviceCore] = await Promise.all([import('./adaptive-core.mjs'), import('./device-core.mjs')]);
    let state = readState();
    if (applySmartTemplate(state)) {
      const day = adaptive.localDay();
      const guard = `zero2fit-build009-template:${day}:${readState().plannedTemplates?.[day] || ''}`;
      if (!sessionStorage.getItem(guard)) {
        sessionStorage.setItem(guard, '1');
        window.location.reload();
        return;
      }
    }
    state = readState();
    if (synchronizeExerciseHistory(state)) writeState(state);
    await loadRecovery(readState());
    bindRefreshes();
    scheduleEnhance(0);
  } catch (error) {
    console.warn('Zero2Fit Build 009 adaptive engine initialization failed', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();

import('./build010-intelligence.js').catch(error => console.warn('Zero2Fit Build 010 personal intelligence failed to load', error));
