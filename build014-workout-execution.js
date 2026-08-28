const EXECUTION_ACTIVE_KEY = 'zero2fit-execution-active-set';
const EXECUTION_SKIPS_KEY = 'zero2fit-execution-skipped-sets';
const EXECUTION_REST_KEY = 'zero2fit-execution-rest';
const EXECUTION_LIST_KEY = 'zero2fit-execution-list-expanded';
let executionCore = null;
let activeKey = sessionStorage.getItem(EXECUTION_ACTIVE_KEY) || null;
let skippedKeys = readSkipped();
let restState = readRest();
let restInterval = null;
let renderTimer = null;
let listObserver = null;
let wakeLock = null;

function readSkipped() {
  try { return new Set(JSON.parse(sessionStorage.getItem(EXECUTION_SKIPS_KEY) || '[]')); }
  catch { return new Set(); }
}

function writeSkipped() {
  sessionStorage.setItem(EXECUTION_SKIPS_KEY, JSON.stringify([...skippedKeys]));
}

function readRest() {
  try {
    const value = JSON.parse(sessionStorage.getItem(EXECUTION_REST_KEY) || 'null');
    return value?.endAt > Date.now() ? value : null;
  } catch { return null; }
}

function writeRest() {
  if (!restState) sessionStorage.removeItem(EXECUTION_REST_KEY);
  else sessionStorage.setItem(EXECUTION_REST_KEY, JSON.stringify(restState));
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function ensureUi() {
  const list = document.getElementById('exerciseList');
  if (!list || document.getElementById('z14FocusCard')) return;
  const card = document.createElement('article');
  card.id = 'z14FocusCard';
  card.className = 'card z14-focus-card';
  card.innerHTML = `
    <div class="z14-focus-top">
      <div class="z14-focus-copy">
        <div class="eyebrow" id="z14ExercisePosition">Guided workout</div>
        <h2 id="z14ExerciseName">Preparing first set…</h2>
        <p class="z14-meta" id="z14ExerciseMeta">Adaptive targets will appear here.</p>
      </div>
      <div class="z14-progress-chip"><strong id="z14Completion">0%</strong><small>workout</small></div>
    </div>
    <div class="z14-set-progress"><span id="z14SetPosition">Set —</span><strong id="z14Target">—</strong></div>
    <div class="z14-input-grid">
      <div class="z14-stepper" id="z14LoadBlock">
        <span>Load</span>
        <div><button type="button" data-z14-adjust="load" data-delta="-5" aria-label="Decrease load by 5 pounds">−5</button><input id="z14Load" type="number" min="0" max="1000" step="0.5" inputmode="decimal" aria-label="Current set load in pounds"><button type="button" data-z14-adjust="load" data-delta="5" aria-label="Increase load by 5 pounds">+5</button></div>
        <small>lb</small>
      </div>
      <div class="z14-stepper">
        <span>Reps</span>
        <div><button type="button" data-z14-adjust="reps" data-delta="-1" aria-label="Decrease repetitions">−</button><input id="z14Reps" type="number" min="0" max="100" step="1" inputmode="numeric" aria-label="Current set repetitions"><button type="button" data-z14-adjust="reps" data-delta="1" aria-label="Increase repetitions">+</button></div>
        <small>reps</small>
      </div>
    </div>
    <button class="primary-button z14-complete" type="button" id="z14CompleteSet">Complete set</button>
    <div class="z14-rest" id="z14Rest" hidden>
      <div><span>Rest</span><strong id="z14RestClock">1:30</strong><small id="z14RestNext">Next set is queued.</small></div>
      <div class="z14-rest-actions"><button type="button" id="z14AddRest">+30 sec</button><button type="button" id="z14SkipRest">Start next set</button></div>
    </div>
    <div class="z14-quick-actions">
      <button type="button" id="z14Substitute">Substitute</button>
      <button type="button" id="z14SkipSet">Skip for now</button>
      <button type="button" id="z14Instructions">Instructions</button>
      <button type="button" id="z14ToggleList">Full workout</button>
    </div>
    <div class="z14-instructions" id="z14InstructionText" hidden></div>
    <button class="z14-resume-skipped" type="button" id="z14ResumeSkipped" hidden>Resume skipped sets</button>
    <p class="z14-status" id="z14Status">Choose location and workout length above. Zero2Fit will guide the available sets in order.</p>`;
  list.before(card);
  bindUi();
  applyListPreference();
}

function parseDescriptor(card, row, rowIndex) {
  const repsInput = row.querySelector('input[data-field="reps"][data-set-key]');
  if (!repsInput || !executionCore) return null;
  const key = repsInput.dataset.setKey;
  const parsed = executionCore.parseWorkoutSetKey(key);
  if (!parsed) return null;
  const loadInput = row.querySelector('input[data-field="load"][data-set-key]');
  const checkButton = row.querySelector('[data-set-check]');
  const rows = [...card.querySelectorAll('.set-row')];
  const instruction = card.querySelector('.exercise-instructions p')?.textContent?.trim() || '';
  return {
    key,
    card,
    row,
    repsInput,
    loadInput,
    checkButton,
    exerciseId:parsed.exerciseId,
    intent:parsed.intent,
    setIndex:parsed.setIndex,
    setNumber:rowIndex + 1,
    exerciseSetCount:rows.length,
    name:card.querySelector('h3')?.textContent?.trim() || 'Exercise',
    meta:card.querySelector('.exercise-meta')?.textContent?.trim() || '',
    adaptive:card.querySelector('.z9-adaptive-line')?.textContent?.trim() || '',
    instruction,
    substituteButton:card.querySelector('[data-show-substitutes]'),
    done:Boolean(checkButton?.classList.contains('done')),
    reps:Number(repsInput.value || 0),
    load:loadInput && loadInput.value !== '' ? Number(loadInput.value) : null,
    bodyweight:!loadInput
  };
}

function collectSets() {
  const sets = [];
  document.querySelectorAll('#exerciseList .exercise-card:not(.unavailable-card)').forEach(card => {
    [...card.querySelectorAll('.set-row')].forEach((row, index) => {
      const descriptor = parseDescriptor(card, row, index);
      if (descriptor) sets.push(descriptor);
    });
  });
  const validKeys = new Set(sets.map(item => item.key));
  let changed = false;
  for (const key of [...skippedKeys]) {
    if (!validKeys.has(key)) { skippedKeys.delete(key); changed = true; }
  }
  if (changed) writeSkipped();
  return sets;
}

function currentDescriptor(sets = collectSets()) {
  if (!sets.length || !executionCore) return null;
  const active = executionCore.chooseActiveSet(sets, { preferredKey:activeKey, skippedKeys:[...skippedKeys] });
  if (active && active.key !== activeKey) {
    activeKey = active.key;
    sessionStorage.setItem(EXECUTION_ACTIVE_KEY, activeKey);
  }
  return active;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value);
}

function setStatus(value) { setText('z14Status', value); }

function syncFocusValue(field, value) {
  const sets = collectSets();
  const current = sets.find(item => item.key === activeKey);
  if (!current) return;
  const input = field === 'load' ? current.loadInput : current.repsInput;
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles:true }));
}

function renderRest(current) {
  const panel = document.getElementById('z14Rest');
  if (!panel) return;
  if (!restState || restState.endAt <= Date.now()) {
    restState = null;
    writeRest();
    panel.hidden = true;
    document.getElementById('z14CompleteSet').disabled = false;
    clearInterval(restInterval);
    restInterval = null;
    return;
  }
  panel.hidden = false;
  document.getElementById('z14CompleteSet').disabled = true;
  const seconds = Math.max(0, Math.ceil((restState.endAt - Date.now()) / 1000));
  const minutes = Math.floor(seconds / 60);
  setText('z14RestClock', `${minutes}:${String(seconds % 60).padStart(2,'0')}`);
  setText('z14RestNext', current ? `${current.name} · set ${current.setNumber} of ${current.exerciseSetCount}` : 'Workout complete.');
  if (!restInterval) {
    restInterval = setInterval(() => {
      if (!restState || restState.endAt <= Date.now()) {
        endRest('Rest complete. Next set ready.');
      } else renderRest(currentDescriptor());
    }, 1000);
  }
}

function renderFocus() {
  if (!executionCore) return;
  ensureUi();
  const sets = collectSets();
  const summary = executionCore.completionSummary(sets);
  setText('z14Completion', `${summary.percent}%`);

  const active = currentDescriptor(sets);
  const resume = document.getElementById('z14ResumeSkipped');
  if (!active) {
    const incomplete = sets.filter(item => !item.done);
    if (resume) resume.hidden = !incomplete.length || !skippedKeys.size;
    setText('z14ExercisePosition', summary.complete ? 'Workout sets complete' : 'Guided workout');
    setText('z14ExerciseName', summary.complete ? 'All available sets are complete' : (sets.length ? 'All remaining sets are skipped' : 'Preparing workout…'));
    setText('z14ExerciseMeta', summary.complete ? 'Use the existing Finish workout button below to record the session and Fitness XP.' : 'Resume skipped sets or change the workout context above.');
    setText('z14SetPosition', summary.complete ? `${summary.completed} of ${summary.total} sets` : 'No active set');
    setText('z14Target', summary.complete ? 'Session ready to finish' : '—');
    document.getElementById('z14LoadBlock').hidden = true;
    document.getElementById('z14CompleteSet').disabled = true;
    document.getElementById('z14Reps').value = '';
    document.getElementById('z14InstructionText').hidden = true;
    renderRest(null);
    return;
  }

  if (resume) resume.hidden = true;
  const exercisePosition = executionCore.exercisePosition(sets, active.key);
  setText('z14ExercisePosition', exercisePosition.label);
  setText('z14ExerciseName', active.name);
  setText('z14ExerciseMeta', active.adaptive || active.meta || 'Follow the target below, then complete the set.');
  setText('z14SetPosition', `Set ${active.setNumber} of ${active.exerciseSetCount}`);
  setText('z14Target', executionCore.formatTarget({ reps:active.reps, load:active.load, bodyweight:active.bodyweight }));

  const loadBlock = document.getElementById('z14LoadBlock');
  loadBlock.hidden = active.bodyweight;
  const loadInput = document.getElementById('z14Load');
  if (loadInput) loadInput.value = active.bodyweight || active.load === null ? '' : active.load;
  const repsInput = document.getElementById('z14Reps');
  if (repsInput) repsInput.value = active.reps;
  document.getElementById('z14CompleteSet').disabled = Boolean(restState && restState.endAt > Date.now());
  document.getElementById('z14Substitute').disabled = !active.substituteButton;
  document.getElementById('z14Instructions').disabled = !active.instruction;
  const instructionBox = document.getElementById('z14InstructionText');
  if (instructionBox && !instructionBox.hidden) instructionBox.textContent = active.instruction || 'No instructions available for this movement.';
  renderRest(active);
}

function scheduleRender(delay = 0) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderFocus, delay);
}

function beginRest(intent) {
  const seconds = executionCore.restSecondsForIntent(intent);
  restState = { endAt:Date.now() + seconds * 1000, seconds, intent };
  writeRest();
  setStatus(`Set complete. ${seconds}-second rest started automatically.`);
  renderFocus();
}

function endRest(message = 'Next set ready.') {
  restState = null;
  writeRest();
  clearInterval(restInterval);
  restInterval = null;
  setStatus(message);
  renderFocus();
}

function completeCurrent() {
  const sets = collectSets();
  const current = sets.find(item => item.key === activeKey) || currentDescriptor(sets);
  if (!current?.checkButton || current.done) return;
  syncFocusValue('reps', Number(document.getElementById('z14Reps').value || 0));
  if (!current.bodyweight) syncFocusValue('load', Number(document.getElementById('z14Load').value || 0));

  const projected = sets.map(item => item.key === current.key ? { ...item, done:true } : item);
  const next = executionCore.nextIncompleteSet(projected, current.key, { skippedKeys:[...skippedKeys] });
  activeKey = next && !skippedKeys.has(next.key) ? next.key : null;
  if (activeKey) sessionStorage.setItem(EXECUTION_ACTIVE_KEY, activeKey);
  else sessionStorage.removeItem(EXECUTION_ACTIVE_KEY);

  current.checkButton.click();
  navigator.vibrate?.(20);
  if (next && !skippedKeys.has(next.key)) beginRest(current.intent);
  else {
    endRest('Set complete. No unskipped set remains.');
    scheduleRender(80);
  }
  requestWakeLock();
}

function adjust(field, delta) {
  const input = document.getElementById(field === 'load' ? 'z14Load' : 'z14Reps');
  if (!input) return;
  const value = executionCore.adjustNumber(input.value, delta, {
    min:Number(input.min || 0), max:Number(input.max || (field === 'load' ? 1000 : 100)), precision:field === 'load' ? 1 : 0
  });
  input.value = value;
  syncFocusValue(field, value);
  scheduleRender(0);
}

function skipCurrent() {
  const sets = collectSets();
  const current = sets.find(item => item.key === activeKey) || currentDescriptor(sets);
  if (!current) return;
  skippedKeys.add(current.key);
  writeSkipped();
  const next = executionCore.nextIncompleteSet(sets, current.key, { skippedKeys:[...skippedKeys] });
  if (next && !skippedKeys.has(next.key)) {
    activeKey = next.key;
    sessionStorage.setItem(EXECUTION_ACTIVE_KEY, activeKey);
    setStatus(`${current.name} set ${current.setNumber} skipped for now. It is not counted complete.`);
  } else {
    activeKey = null;
    sessionStorage.removeItem(EXECUTION_ACTIVE_KEY);
    setStatus('All remaining sets are skipped for now. Resume skipped sets when ready.');
  }
  renderFocus();
}

function resumeSkipped() {
  skippedKeys.clear();
  writeSkipped();
  activeKey = null;
  sessionStorage.removeItem(EXECUTION_ACTIVE_KEY);
  setStatus('Skipped sets restored to the guided queue.');
  renderFocus();
}

function showCurrentInList({ substitute = false } = {}) {
  const current = currentDescriptor();
  if (!current) return;
  setListExpanded(true);
  if (substitute) current.substituteButton?.click();
  setTimeout(() => current.card.scrollIntoView({ behavior:'smooth', block:'center' }), 40);
}

function toggleInstructions() {
  const current = currentDescriptor();
  const box = document.getElementById('z14InstructionText');
  if (!box || !current?.instruction) return;
  box.textContent = current.instruction;
  box.hidden = !box.hidden;
}

function setListExpanded(expanded) {
  const page = document.getElementById('page-train');
  if (!page) return;
  page.classList.toggle('z14-list-expanded', expanded);
  sessionStorage.setItem(EXECUTION_LIST_KEY, expanded ? '1' : '0');
  setText('z14ToggleList', expanded ? 'Hide workout' : 'Full workout');
}

function applyListPreference() {
  const expanded = sessionStorage.getItem(EXECUTION_LIST_KEY) === '1';
  setListExpanded(expanded);
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    if (!wakeLock) wakeLock = await navigator.wakeLock.request('screen');
  } catch {}
}

function bindUi() {
  document.querySelectorAll('[data-z14-adjust]').forEach(button => button.addEventListener('click', () => adjust(button.dataset.z14Adjust, Number(button.dataset.delta))));
  document.getElementById('z14Load')?.addEventListener('change', event => { syncFocusValue('load', Number(event.target.value || 0)); scheduleRender(0); });
  document.getElementById('z14Reps')?.addEventListener('change', event => { syncFocusValue('reps', Number(event.target.value || 0)); scheduleRender(0); });
  document.getElementById('z14CompleteSet')?.addEventListener('click', completeCurrent);
  document.getElementById('z14SkipSet')?.addEventListener('click', skipCurrent);
  document.getElementById('z14ResumeSkipped')?.addEventListener('click', resumeSkipped);
  document.getElementById('z14Substitute')?.addEventListener('click', () => showCurrentInList({ substitute:true }));
  document.getElementById('z14Instructions')?.addEventListener('click', toggleInstructions);
  document.getElementById('z14ToggleList')?.addEventListener('click', () => setListExpanded(!document.getElementById('page-train')?.classList.contains('z14-list-expanded')));
  document.getElementById('z14AddRest')?.addEventListener('click', () => {
    if (!restState) return;
    restState.endAt += 30000;
    restState.seconds += 30;
    writeRest();
    renderRest(currentDescriptor());
  });
  document.getElementById('z14SkipRest')?.addEventListener('click', () => endRest('Rest skipped. Next set ready.'));
}

function bindPage() {
  const list = document.getElementById('exerciseList');
  if (list && !listObserver) {
    listObserver = new MutationObserver(() => scheduleRender(40));
    listObserver.observe(list, { childList:true, subtree:true, characterData:true });
  }
  document.addEventListener('change', event => {
    if (event.target.closest('#exerciseList input[data-set-key]')) scheduleRender(10);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-workout-location],[data-workout-mode],[data-set-check],[data-choose-substitute],[data-auto-substitute]')) scheduleRender(80);
  });
  document.querySelector('.nav-item[data-page="train"]')?.addEventListener('click', () => scheduleRender(80));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && restState) renderRest(currentDescriptor());
  });
  window.addEventListener('focus', () => scheduleRender(80));
}

async function init() {
  try {
    executionCore = await import('./workout-execution-core.mjs');
    ensureUi();
    bindPage();
    scheduleRender(250);
  } catch (error) {
    console.warn('Zero2Fit Build 014 workout execution failed', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();
