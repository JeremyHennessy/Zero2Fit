import * as core from './nutrition-core.mjs';

const STORAGE_KEY = 'zero2fit-v1';
const app = () => window.Zero2FitApp || null;
const today = () => core.dayKey(new Date());
let activeDay = sessionStorage.getItem('zero2fit-fuel-day') || today();
let lastState = null;
let searchText = '';
let initialized = false;

function readState() {
  const live = app()?.getState?.();
  if (live) return live;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function fallbackWrite(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.Zero2FitStorage?.saveSnapshot?.(state).catch(() => {});
  window.dispatchEvent(new CustomEvent('zero2fit:statechange'));
}

function mutate(mutator, { render = true } = {}) {
  const api = app();
  if (api?.mutateState) return api.mutateState(mutator, { render });
  const state = readState();
  mutator(state);
  fallbackWrite(state);
  if (render) renderFromState(state);
  return state;
}

function toast(message) {
  if (app()?.showToast) app().showToast(message);
  else console.info(message);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString(undefined, { minimumFractionDigits:digits, maximumFractionDigits:digits });
}

function displayDay(day) {
  if (day === today()) return 'Today';
  const date = new Date(`${day}T12:00:00`);
  return Number.isNaN(date.getTime()) ? day : date.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
}

function shiftDay(day, amount) {
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return today();
  date.setDate(date.getDate() + amount);
  return core.dayKey(date);
}

function mealTypeLabel(value) {
  return ({breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner',snack:'Snacks',meal:'Other'})[value] || 'Other';
}

function sourceLabel(value) {
  return ({manual:'Manual',quick_line:'Quick line',repeat:'Repeated',recent:'Recent',saved:'Saved',search:'Search',barcode:'Barcode',import:'Imported'})[value] || String(value || 'Manual').replace(/[_-]+/g,' ');
}

function ensureStylesheet() {
  if (document.querySelector('link[href="./build017.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build017.css';
  document.head.appendChild(link);
}

function ensureUi() {
  const page = document.getElementById('page-nutrition');
  if (!page || document.getElementById('z17Fuel')) return;
  page.innerHTML = `
    <div id="z17Fuel" class="z17-fuel-shell">
      <article class="card z17-fuel-hero">
        <div class="z17-fuel-head">
          <div>
            <div class="eyebrow">Fuel · Build 017</div>
            <h2>Log once. Reuse what you actually eat.</h2>
            <p class="muted">Recent and saved foods stay one tap away. Targets are optional and never inferred from your weight or health data.</p>
          </div>
          <div class="z17-day-nav" aria-label="Nutrition day">
            <button type="button" data-z17-day="prev" aria-label="Previous day">‹</button>
            <button type="button" data-z17-day="today" id="z17DayLabel">Today</button>
            <button type="button" data-z17-day="next" id="z17DayNext" aria-label="Next day">›</button>
          </div>
        </div>
        <div class="z17-energy-row">
          <div class="z17-calorie-total"><span>Calories logged</span><strong id="z17Calories">0</strong><small id="z17CalorieTarget">No target set</small></div>
          <div class="z17-week-coverage"><span>7-day logging</span><strong id="z17Coverage">0 / 7</strong><small id="z17CoverageDetail">Build a useful food history without streak penalties.</small></div>
        </div>
        <div class="z17-macro-grid" id="z17MacroGrid"></div>
        <button class="text-button z17-target-toggle" type="button" id="z17TargetToggle">Set optional daily targets</button>
        <form class="z17-target-form" id="z17TargetForm" hidden>
          <label><span>Calories</span><input id="z17TargetCalories" type="number" min="1" max="12000" inputmode="numeric" placeholder="Not set"></label>
          <label><span>Protein g</span><input id="z17TargetProtein" type="number" min="1" max="600" inputmode="decimal" placeholder="Not set"></label>
          <label><span>Carbs g</span><input id="z17TargetCarbs" type="number" min="1" max="1200" inputmode="decimal" placeholder="Not set"></label>
          <label><span>Fat g</span><input id="z17TargetFat" type="number" min="1" max="500" inputmode="decimal" placeholder="Not set"></label>
          <div class="z17-form-actions"><button class="primary-button" type="submit">Save targets</button><button class="text-button" type="button" id="z17ClearTargets">Clear targets</button></div>
        </form>
      </article>

      <div class="z17-quick-grid">
        <article class="card z17-quick-card">
          <div class="card-heading"><div><div class="eyebrow">One-tap logging</div><h2>Your foods</h2></div><button class="secondary-button" type="button" id="z17RepeatLast">Repeat last</button></div>
          <label class="z17-search"><span>Search saved + recent</span><input id="z17FoodSearch" type="search" autocomplete="off" placeholder="Chicken bowl, yogurt, coffee…"></label>
          <div class="z17-candidate-list" id="z17Candidates"></div>
          <p class="muted compact">Food candidates retain provider, source-item and barcode fields so a future database/scanner can plug into this same model without rewriting your log.</p>
        </article>

        <article class="card z17-quick-line-card">
          <div class="eyebrow">Fastest manual entry</div>
          <h2>Paste a nutrition line</h2>
          <p class="muted compact">Example: <strong>Turkey wrap · 540 kcal · 42p · 48c · 17f</strong></p>
          <form id="z17QuickLineForm" class="z17-quick-line-form">
            <input id="z17QuickLine" type="text" autocomplete="off" placeholder="Food · kcal · protein · carbs · fat">
            <select id="z17QuickMealType" aria-label="Meal type"><option value="meal">Other</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select>
            <button class="primary-button" type="submit">Log line</button>
          </form>
          <button class="text-button" type="button" id="z17CustomToggle">Or enter fields</button>
          <form id="z17CustomForm" class="z17-custom-form" hidden>
            <input id="z17CustomName" type="text" required placeholder="Food or meal name">
            <div class="z17-nutrient-inputs">
              <input id="z17CustomCalories" type="number" min="0" max="12000" required inputmode="numeric" placeholder="kcal">
              <input id="z17CustomProtein" type="number" min="0" max="600" inputmode="decimal" placeholder="Protein g">
              <input id="z17CustomCarbs" type="number" min="0" max="1200" inputmode="decimal" placeholder="Carbs g">
              <input id="z17CustomFat" type="number" min="0" max="500" inputmode="decimal" placeholder="Fat g">
            </div>
            <input id="z17CustomServing" type="text" placeholder="Serving note (optional)">
            <select id="z17CustomMealType" aria-label="Meal type"><option value="meal">Other</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select>
            <label class="z17-save-check"><input id="z17CustomSave" type="checkbox"> Save to one-tap foods</label>
            <button class="primary-button" type="submit">Add food</button>
          </form>
        </article>
      </div>

      <article class="card z17-saved-card">
        <div class="card-heading"><div><div class="eyebrow">Favorites</div><h2>Saved meals</h2></div><span class="small-tag" id="z17SavedCount">0 saved</span></div>
        <div class="z17-saved-list" id="z17SavedList"></div>
      </article>

      <article class="card z17-log-card">
        <div class="card-heading"><div><div class="eyebrow">Daily log</div><h2 id="z17LogTitle">Today's food</h2></div><button class="text-button" id="z17ClearDay" type="button">Clear day</button></div>
        <div id="z17MealLog" class="z17-meal-log"></div>
      </article>
    </div>`;
  bindUi(page);
}

function saveTargets(event) {
  event.preventDefault();
  const targets = core.normalizeTargets({
    calories:document.getElementById('z17TargetCalories')?.value,
    protein:document.getElementById('z17TargetProtein')?.value,
    carbs:document.getElementById('z17TargetCarbs')?.value,
    fat:document.getElementById('z17TargetFat')?.value
  });
  mutate(state => { state.nutritionTargets = targets; state.nutritionSchemaVersion = 1; });
  document.getElementById('z17TargetForm').hidden = true;
  toast('Fuel targets saved.');
}

function logCandidate(candidate, source = null) {
  if (!candidate) return;
  const entry = core.createMealEntry(candidate, { day:activeDay, source:source || candidate.kind || candidate.source });
  mutate(state => {
    state.meals ||= {};
    state.meals[activeDay] ||= [];
    state.meals[activeDay].push(entry);
  });
  app()?.completeQuest?.('nutrition');
  window.dispatchEvent(new CustomEvent('zero2fit:fuel-updated', { detail:{ day:activeDay, entryId:entry.id } }));
  toast(`${entry.name} logged.`);
}

function removeEntry(entryId) {
  mutate(state => {
    const entries = state.meals?.[activeDay] || [];
    state.meals[activeDay] = entries.filter(entry => entry.id !== entryId);
  });
  window.dispatchEvent(new CustomEvent('zero2fit:fuel-updated', { detail:{ day:activeDay } }));
  toast('Food entry removed.');
}

function saveEntry(entryId) {
  const state = readState();
  const entry = (state.meals?.[activeDay] || []).find(item => item.id === entryId);
  if (!entry) return;
  const saved = core.createSavedMeal(entry);
  mutate(next => {
    next.savedMeals ||= [];
    const fingerprint = core.mealFingerprint(saved);
    if (!next.savedMeals.some(item => core.mealFingerprint(item) === fingerprint)) next.savedMeals.unshift(saved);
  });
  toast(`${entry.name} saved for one-tap logging.`);
}

function deleteSaved(savedId) {
  mutate(state => { state.savedMeals = (state.savedMeals || []).filter(item => item.id !== savedId); });
  toast('Saved meal removed.');
}

function bindUi(page) {
  page.querySelectorAll('[data-z17-day]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.z17Day;
    if (action === 'prev') activeDay = shiftDay(activeDay, -1);
    if (action === 'today') activeDay = today();
    if (action === 'next' && activeDay < today()) activeDay = shiftDay(activeDay, 1);
    sessionStorage.setItem('zero2fit-fuel-day', activeDay);
    renderFromState(readState());
  }));

  document.getElementById('z17TargetToggle')?.addEventListener('click', () => {
    const form = document.getElementById('z17TargetForm');
    if (form) form.hidden = !form.hidden;
  });
  document.getElementById('z17TargetForm')?.addEventListener('submit', saveTargets);
  document.getElementById('z17ClearTargets')?.addEventListener('click', () => {
    mutate(state => { state.nutritionTargets = core.normalizeTargets({}); });
    toast('Fuel targets cleared.');
  });

  document.getElementById('z17FoodSearch')?.addEventListener('input', event => {
    searchText = event.target.value || '';
    renderCandidates(readState());
  });

  document.getElementById('z17Candidates')?.addEventListener('click', event => {
    const button = event.target.closest('[data-z17-candidate]');
    if (!button) return;
    const state = readState();
    const candidates = core.searchMealCandidates(searchText, { savedMeals:state.savedMeals || [], meals:state.meals || {}, limit:8 });
    logCandidate(candidates[Number(button.dataset.z17Candidate)]);
  });

  document.getElementById('z17SavedList')?.addEventListener('click', event => {
    const add = event.target.closest('[data-z17-saved-add]');
    const remove = event.target.closest('[data-z17-saved-remove]');
    const state = readState();
    if (add) {
      const candidate = core.savedMealCandidates(state.savedMeals || []).find(item => item.sourceId === add.dataset.z17SavedAdd);
      logCandidate(candidate, 'saved');
    }
    if (remove) deleteSaved(remove.dataset.z17SavedRemove);
  });

  document.getElementById('z17RepeatLast')?.addEventListener('click', () => {
    const candidate = core.recentMealCandidates(readState().meals || {}, { limit:1 })[0];
    if (!candidate) return toast('Log one food first; then Repeat last becomes one tap.');
    logCandidate(candidate, 'repeat');
  });

  document.getElementById('z17QuickLineForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const input = document.getElementById('z17QuickLine');
    const parsed = core.parseQuickLine(input?.value || '');
    if (!parsed) return toast('Include at least a food name and calories, for example: Turkey wrap · 540 kcal · 42p.');
    parsed.mealType = document.getElementById('z17QuickMealType')?.value || 'meal';
    logCandidate(parsed, 'quick_line');
    if (input) input.value = '';
  });

  document.getElementById('z17CustomToggle')?.addEventListener('click', () => {
    const form = document.getElementById('z17CustomForm');
    if (form) form.hidden = !form.hidden;
  });

  document.getElementById('z17CustomForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const candidate = {
      name:document.getElementById('z17CustomName')?.value || '',
      calories:document.getElementById('z17CustomCalories')?.value || 0,
      protein:document.getElementById('z17CustomProtein')?.value || 0,
      carbs:document.getElementById('z17CustomCarbs')?.value || 0,
      fat:document.getElementById('z17CustomFat')?.value || 0,
      serving:document.getElementById('z17CustomServing')?.value || '',
      mealType:document.getElementById('z17CustomMealType')?.value || 'meal',
      source:'manual'
    };
    const entry = core.createMealEntry(candidate, { day:activeDay, source:'manual' });
    const save = !!document.getElementById('z17CustomSave')?.checked;
    mutate(state => {
      state.meals ||= {};
      state.meals[activeDay] ||= [];
      state.meals[activeDay].push(entry);
      if (save) {
        state.savedMeals ||= [];
        const saved = core.createSavedMeal(entry);
        const fingerprint = core.mealFingerprint(saved);
        if (!state.savedMeals.some(item => core.mealFingerprint(item) === fingerprint)) state.savedMeals.unshift(saved);
      }
    });
    app()?.completeQuest?.('nutrition');
    event.target.reset();
    event.target.hidden = true;
    window.dispatchEvent(new CustomEvent('zero2fit:fuel-updated', { detail:{ day:activeDay, entryId:entry.id } }));
    toast(`${entry.name} logged${save ? ' and saved' : ''}.`);
  });

  document.getElementById('z17MealLog')?.addEventListener('click', event => {
    const remove = event.target.closest('[data-z17-remove]');
    const save = event.target.closest('[data-z17-save]');
    if (remove) removeEntry(remove.dataset.z17Remove);
    if (save) saveEntry(save.dataset.z17Save);
  });

  document.getElementById('z17ClearDay')?.addEventListener('click', () => {
    const entries = readState().meals?.[activeDay] || [];
    if (!entries.length) return;
    if (!window.confirm(`Clear ${entries.length} food entr${entries.length === 1 ? 'y' : 'ies'} from ${displayDay(activeDay)}?`)) return;
    mutate(state => { state.meals[activeDay] = []; });
    window.dispatchEvent(new CustomEvent('zero2fit:fuel-updated', { detail:{ day:activeDay } }));
    toast('Food log cleared for this day.');
  });
}

function macroCard(label, key, value, target, progress) {
  const hasTarget = Number.isFinite(Number(target)) && Number(target) > 0;
  const unit = key === 'calories' ? 'kcal' : 'g';
  return `<div class="z17-macro-card">
    <div><span>${esc(label)}</span><strong>${formatNumber(value,key === 'calories' ? 0 : 1)} ${unit}</strong></div>
    <small>${hasTarget ? `${formatNumber(target,key === 'calories' ? 0 : 1)} ${unit} target` : 'No target set'}</small>
    <div class="z17-macro-track ${hasTarget ? '' : 'no-target'}"><i style="width:${hasTarget ? Math.max(0,Math.min(100,progress || 0)) : 0}%"></i></div>
  </div>`;
}

function renderSummary(state) {
  const entries = state.meals?.[activeDay] || [];
  const summary = core.summarizeDay(entries, state.nutritionTargets || {});
  const consistency = core.nutritionConsistency(state.meals || {}, { now:new Date(`${today()}T12:00:00`).getTime(), days:7 });
  const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  set('z17DayLabel', displayDay(activeDay));
  set('z17Calories', formatNumber(summary.totals.calories));
  set('z17CalorieTarget', summary.targets.calories ? `${formatNumber(summary.targets.calories)} kcal target` : 'No target set');
  set('z17Coverage', `${consistency.daysLogged} / 7`);
  set('z17CoverageDetail', consistency.daysLogged ? `${consistency.entries} entries · ${formatNumber(consistency.averageProtein,1)} g avg protein on logged days` : 'Build a useful food history without streak penalties.');
  set('z17LogTitle', `${displayDay(activeDay)} food`);
  const next = document.getElementById('z17DayNext');
  if (next) next.disabled = activeDay >= today();
  const grid = document.getElementById('z17MacroGrid');
  if (grid) grid.innerHTML = [
    macroCard('Protein','protein',summary.totals.protein,summary.targets.protein,summary.progress.protein),
    macroCard('Carbs','carbs',summary.totals.carbs,summary.targets.carbs,summary.progress.carbs),
    macroCard('Fat','fat',summary.totals.fat,summary.targets.fat,summary.progress.fat)
  ].join('');
  const targetValues = {Calories:'calories',Protein:'protein',Carbs:'carbs',Fat:'fat'};
  for (const [suffix,key] of Object.entries(targetValues)) {
    const input = document.getElementById(`z17Target${suffix}`);
    if (input && document.activeElement !== input) input.value = summary.targets[key] ?? '';
  }
  document.getElementById('z17ClearDay')?.toggleAttribute('disabled', !entries.length);
}

function renderCandidates(state) {
  const target = document.getElementById('z17Candidates');
  if (!target) return;
  const candidates = core.searchMealCandidates(searchText, { savedMeals:state.savedMeals || [], meals:state.meals || {}, limit:8 });
  target.innerHTML = candidates.length ? candidates.map((item,index) => `
    <button class="z17-candidate" type="button" data-z17-candidate="${index}">
      <span><strong>${esc(item.name)}</strong><small>${esc(item.serving || sourceLabel(item.kind))}</small></span>
      <span class="z17-candidate-macros"><b>${formatNumber(item.calories)} kcal</b><small>${formatNumber(item.protein,1)}p · ${formatNumber(item.carbs,1)}c · ${formatNumber(item.fat,1)}f</small></span>
    </button>`).join('') : '<div class="empty-state compact">No saved or recent food matches yet. Use the quick line or custom fields once, then it becomes reusable.</div>';
}

function renderSaved(state) {
  const target = document.getElementById('z17SavedList');
  const saved = core.savedMealCandidates(state.savedMeals || []);
  const count = document.getElementById('z17SavedCount');
  if (count) count.textContent = `${saved.length} saved`;
  if (!target) return;
  target.innerHTML = saved.length ? saved.map(item => `
    <div class="z17-saved-item">
      <button type="button" data-z17-saved-add="${esc(item.sourceId)}"><span><strong>${esc(item.name)}</strong><small>${formatNumber(item.calories)} kcal · ${formatNumber(item.protein,1)}p</small></span><b>＋</b></button>
      <button class="z17-saved-remove" type="button" data-z17-saved-remove="${esc(item.sourceId)}" aria-label="Remove ${esc(item.name)} from saved meals">×</button>
    </div>`).join('') : '<div class="empty-state compact">Save a logged food and it will stay here for one-tap reuse.</div>';
}

function renderLog(state) {
  const target = document.getElementById('z17MealLog');
  if (!target) return;
  const entries = (state.meals?.[activeDay] || []).map((entry,index) => core.normalizeMealEntry(entry,{day:activeDay,index}));
  if (!entries.length) {
    target.innerHTML = '<div class="empty-state">Nothing logged for this day.</div>';
    return;
  }
  const savedFingerprints = new Set((state.savedMeals || []).map(core.mealFingerprint));
  const order = ['breakfast','lunch','dinner','snack','meal'];
  target.innerHTML = order.map(type => {
    const rows = entries.filter(entry => entry.mealType === type);
    if (!rows.length) return '';
    return `<section class="z17-meal-group"><h3>${mealTypeLabel(type)}</h3>${rows.map(entry => `
      <div class="z17-meal-row">
        <div class="z17-meal-copy"><strong>${esc(entry.name)}</strong><small>${esc(entry.serving || sourceLabel(entry.source))}</small></div>
        <div class="z17-meal-macros"><strong>${formatNumber(entry.calories)} kcal</strong><small>${formatNumber(entry.protein,1)}p · ${formatNumber(entry.carbs,1)}c · ${formatNumber(entry.fat,1)}f</small></div>
        <div class="z17-meal-actions">
          <button type="button" data-z17-save="${esc(entry.id)}" ${savedFingerprints.has(core.mealFingerprint(entry)) ? 'disabled title="Already saved"' : 'title="Save for one-tap reuse"'}>☆</button>
          <button type="button" data-z17-remove="${esc(entry.id)}" title="Remove entry">×</button>
        </div>
      </div>`).join('')}</section>`;
  }).join('');
}

export function renderFromState(state = readState()) {
  if (!document.getElementById('z17Fuel')) return;
  lastState = state;
  renderSummary(state);
  renderCandidates(state);
  renderSaved(state);
  renderLog(state);
}

function migrate() {
  const current = readState();
  const result = core.migrateNutritionState(current);
  if (!result.changed) return result.state;
  mutate(state => {
    state.meals = result.state.meals;
    state.savedMeals = result.state.savedMeals;
    state.nutritionTargets = result.state.nutritionTargets;
    state.nutritionSchemaVersion = 1;
  }, { render:false });
  return result.state;
}

function init() {
  if (initialized) return;
  initialized = true;
  ensureStylesheet();
  document.body.classList.add('build017-fuel');
  ensureUi();
  window.Zero2FitFuel = { renderFromState, coreVersion:1 };
  const state = migrate();
  renderFromState(state);
  window.addEventListener('zero2fit:statechange', () => renderFromState(readState()));
  window.addEventListener('focus', () => renderFromState(readState()));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();
