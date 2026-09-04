import * as guidanceCore from './daily-guidance-core.mjs';

const APP_STORAGE_KEY = 'zero2fit-v1';
const FUEL_STORAGE_KEY = 'zero2fit-fuel-v2';
let observer = null;
let renderTimer = null;
let lastSignature = '';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function ensureStyle() {
  if (document.querySelector('link[href="./build042.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build042.css';
  document.head.appendChild(link);
}

function today() {
  return guidanceCore.dayKey(new Date());
}

function snapshot() {
  return guidanceCore.buildDailyGuidance({
    appState: readJson(APP_STORAGE_KEY),
    fuelState: readJson(FUEL_STORAGE_KEY),
    day: today()
  });
}

function statusLabel(key, summary) {
  const done = Boolean(summary.status?.[key]);
  if (key === 'move') return done ? 'Movement covered' : `${Number(summary.steps || 0).toLocaleString()} steps`;
  if (key === 'train') return summary.activeWorkout ? 'In progress' : (done ? 'Training done' : 'Training open');
  if (key === 'nutrition') return done ? `${summary.mealsLogged} food entr${summary.mealsLogged === 1 ? 'y' : 'ies'}` : 'No food logged';
  return done ? 'Checked' : 'Not checked';
}

function statusHtml(key, label, summary) {
  const done = Boolean(summary.status?.[key]);
  const active = key === 'train' && summary.activeWorkout;
  return `<div class="z42-status ${done ? 'done' : ''} ${active ? 'active' : ''}">
    <span class="z42-status-mark" aria-hidden="true">${done ? '✓' : active ? '→' : '○'}</span>
    <span><strong>${label}</strong><small>${statusLabel(key, summary)}</small></span>
  </div>`;
}

function contextText(action) {
  if (action.kind !== 'train') return '';
  const workout = document.getElementById('todayWorkoutName')?.textContent?.trim();
  const location = document.getElementById('todayTrainingLocation')?.textContent?.trim();
  const parts = [workout, location].filter(value => value && !/loading/i.test(value));
  return parts.length ? parts.join(' · ') : '';
}

function ensureCard() {
  const page = document.getElementById('page-today');
  if (!page) return null;
  let card = document.getElementById('z42NextAction');
  if (card) return card;

  card = document.createElement('section');
  card.id = 'z42NextAction';
  card.className = 'z42-next-action';
  card.innerHTML = `
    <div class="z42-action-copy">
      <span class="z42-eyebrow" id="z42ActionEyebrow">NEXT BEST ACTION</span>
      <h2 id="z42ActionTitle">Finding the smallest useful next action…</h2>
      <p id="z42ActionDetail">Zero2Fit is reading today’s local state.</p>
      <div class="z42-action-context" id="z42ActionContext" hidden></div>
    </div>
    <div class="z42-action-side">
      <button type="button" id="z42ActionButton" class="z42-action-button">Open</button>
      <small id="z42ActionProgress">0 of 4 daily signals covered</small>
    </div>
    <div class="z42-status-row" id="z42StatusRow"></div>`;

  const intro = document.getElementById('z40TodayIntro');
  const brief = document.querySelector('#page-today .z40-day-brief') || document.querySelector('#page-today .hero-grid');
  if (intro) intro.after(card);
  else if (brief) brief.before(card);
  else page.prepend(card);

  card.querySelector('#z42ActionButton')?.addEventListener('click', act);
  return card;
}

function signatureFor(guidance) {
  const context = contextText(guidance.action);
  return JSON.stringify({
    action: guidance.action.id,
    detail: guidance.action.detail,
    summary: guidance.summary,
    context
  });
}

function render() {
  ensureStyle();
  const card = ensureCard();
  if (!card) return;

  const guidance = snapshot();
  const signature = signatureFor(guidance);
  if (signature === lastSignature) return;
  lastSignature = signature;

  const { action, summary } = guidance;
  card.dataset.action = action.id;
  card.dataset.kind = action.kind;
  card.classList.toggle('z42-complete', action.kind === 'done');
  card.classList.toggle('z42-train', action.kind === 'train');
  card.classList.toggle('z42-move', action.kind === 'move');
  card.classList.toggle('z42-fuel', action.kind === 'nutrition');
  card.classList.toggle('z42-recovery', action.kind === 'recovery');

  document.getElementById('z42ActionEyebrow').textContent = action.eyebrow;
  document.getElementById('z42ActionTitle').textContent = action.title;
  document.getElementById('z42ActionDetail').textContent = action.detail;
  document.getElementById('z42ActionButton').textContent = action.cta;
  document.getElementById('z42ActionProgress').textContent = `${summary.completeCount} of 4 daily signals covered`;

  const context = contextText(action);
  const contextNode = document.getElementById('z42ActionContext');
  if (contextNode) {
    contextNode.hidden = !context;
    contextNode.textContent = context;
  }

  document.getElementById('z42StatusRow').innerHTML = [
    statusHtml('move','Move',summary),
    statusHtml('train','Train',summary),
    statusHtml('nutrition','Fuel',summary),
    statusHtml('recovery','Recover',summary)
  ].join('');

  window.dispatchEvent(new CustomEvent('zero2fit:daily-guidance', { detail:{ action:action.id, completeCount:summary.completeCount } }));
}

function currentAction() {
  return snapshot().action;
}

function scrollToId(id) {
  const node = document.getElementById(id);
  if (!node) return;
  node.scrollIntoView({ behavior:'smooth', block:'center' });
  node.classList.add('z42-attention');
  setTimeout(() => node.classList.remove('z42-attention'), 1200);
}

function act() {
  const action = currentAction();
  if (!action) return;

  if (action.page && action.page !== 'today') {
    document.querySelector(`.nav-item[data-page="${action.page}"]`)?.click();
  }

  if (action.kind === 'train') {
    setTimeout(() => {
      if (action.mode) document.querySelector(`[data-workout-mode="${action.mode}"]`)?.click();
      setTimeout(() => scrollToId('z40TrainStage'), 80);
    }, 80);
    return;
  }

  if (action.kind === 'nutrition') {
    setTimeout(() => document.getElementById('z40AddFood')?.click(), 100);
    return;
  }

  if (action.anchor) {
    setTimeout(() => scrollToId(action.anchor), 60);
    return;
  }

  if (action.kind === 'done') {
    setTimeout(() => scrollToId('z40ProgressIntro'), 80);
  }
}

function schedule() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 70);
}

function observe() {
  if (observer || !document.body) return;
  observer = new MutationObserver(mutations => {
    if (mutations.every(mutation => mutation.target?.closest?.('#z42NextAction'))) return;
    schedule();
  });
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });
}

function init() {
  ensureStyle();
  render();
  observe();
  window.addEventListener('zero2fit:fuel-updated', schedule);
  window.addEventListener('zero2fit:remote-sync', schedule);
  window.addEventListener('zero2fit:personal-intelligence', schedule);
  window.addEventListener('storage', event => {
    if ([APP_STORAGE_KEY,FUEL_STORAGE_KEY].includes(event.key)) schedule();
  });
  window.addEventListener('focus', schedule);
  setTimeout(render, 700);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();
