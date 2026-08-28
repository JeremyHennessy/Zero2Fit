const Z16_STATE_KEY = 'zero2fit-v1';
const Z16_SAVED_KEY = 'zero2fit-fuel-saved-v1';
const Z16_TARGET_KEY = 'zero2fit-fuel-targets-v1';
let z16Core = null;
let z16Multiplier = Number(sessionStorage.getItem('zero2fit-fuel-multiplier') || 1) || 1;
let z16Timer = null;

function z16ReadState() {
  try { return JSON.parse(localStorage.getItem(Z16_STATE_KEY) || '{}'); }
  catch { return {}; }
}
function z16ReadSaved() {
  try { return JSON.parse(localStorage.getItem(Z16_SAVED_KEY) || '[]'); }
  catch { return []; }
}
function z16WriteSaved(items) { localStorage.setItem(Z16_SAVED_KEY, JSON.stringify(items || [])); }
function z16ReadTargets() {
  try { return JSON.parse(localStorage.getItem(Z16_TARGET_KEY) || '{}'); }
  catch { return {}; }
}
function z16WriteTargets(value) { localStorage.setItem(Z16_TARGET_KEY, JSON.stringify(value || {})); }
function z16Esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function z16SetText(id, value) { const node = document.getElementById(id); if (node) node.textContent = String(value); }

function z16EnsureUi() {
  const page = document.getElementById('page-nutrition');
  const grid = page?.querySelector('.nutrition-grid');
  const log = document.getElementById('mealList')?.closest('.card');
  if (!page || !grid || document.getElementById('z16FuelAssist')) return;

  const summary = page.querySelector('.nutrition-summary');
  const summaryNumbers = summary?.querySelector('.nutrition-numbers');
  if (summaryNumbers) {
    const calorieSmall = summaryNumbers.children[0]?.querySelector('small');
    const proteinSmall = summaryNumbers.children[1]?.querySelector('small');
    if (calorieSmall) calorieSmall.id = 'z16CaloriesTarget';
    if (proteinSmall) proteinSmall.id = 'z16ProteinTarget';
  }
  const note = summary?.querySelector('.muted');
  if (note) note.textContent = 'Targets are shown only when you explicitly set them. Zero2Fit does not infer a calorie deficit, body-weight goal or protein prescription.';
  if (summary && !document.getElementById('z16TargetToggle')) {
    const controls = document.createElement('div');
    controls.className = 'z16-target-controls';
    controls.innerHTML = `
      <button type="button" id="z16TargetToggle">Set personal targets</button>
      <div class="z16-target-editor" id="z16TargetEditor" hidden>
        <label>Calories<input id="z16TargetCalories" type="number" min="500" max="6000" step="50" inputmode="numeric" placeholder="Optional"></label>
        <label>Protein<input id="z16TargetProtein" type="number" min="20" max="400" step="5" inputmode="numeric" placeholder="Optional"></label>
        <button type="button" id="z16SaveTargets">Save targets</button>
        <button type="button" id="z16ClearTargets">Clear</button>
      </div>`;
    summary.appendChild(controls);
  }

  const panel = document.createElement('article');
  panel.id = 'z16FuelAssist';
  panel.className = 'card z16-fuel-assist';
  panel.innerHTML = `
    <div class="z16-head">
      <div><div class="eyebrow">Quick Fuel</div><h2>Repeat food without retyping it</h2><p>Recent and saved entries replay through the same Zero2Fit meal form. Adjust the serving first if today is different.</p></div>
      <button type="button" id="z16RepeatYesterday">Repeat yesterday</button>
    </div>
    <div class="z16-multiplier" aria-label="Serving multiplier">
      <span>Serving</span>
      <div>${[0.5,1,1.5,2].map(value => `<button type="button" data-z16-multiplier="${value}" class="${value===z16Multiplier?'active':''}">${value}×</button>`).join('')}</div>
    </div>
    <section class="z16-section">
      <div class="z16-section-head"><div><span>Saved</span><strong>Your repeat meals</strong></div><button type="button" id="z16SaveCurrent">Save typed meal</button></div>
      <div class="z16-meal-grid" id="z16SavedMeals"></div>
    </section>
    <section class="z16-section">
      <div class="z16-section-head"><div><span>Recent</span><strong>Used lately</strong></div><small>Most recent first</small></div>
      <div class="z16-meal-grid" id="z16RecentMeals"></div>
    </section>
    <p class="z16-status" id="z16FuelStatus">One tap adds the selected serving to today.</p>`;
  if (log) log.before(panel); else grid.after(panel);
  z16Bind();
}

function z16MealCard(meal, { saved = false } = {}) {
  const id = meal.id || z16Core.mealIdentity(meal);
  const scaled = z16Core.scaleMeal(meal, z16Multiplier);
  const meta = saved ? 'Saved meal' : `${meal.uses || 1} use${Number(meal.uses||1)===1?'':'s'} · last ${meal.lastDay || 'recently'}`;
  return `<article class="z16-meal-card" data-meal-id="${z16Esc(id)}">
    <div><span>${z16Esc(meta)}</span><strong>${z16Esc(meal.name)}</strong><small>${scaled.calories} kcal · ${scaled.protein} g protein${z16Multiplier!==1?` · ${z16Multiplier}× serving`:''}</small></div>
    <div class="z16-meal-actions"><button type="button" data-z16-add="${z16Esc(id)}" data-source="${saved?'saved':'recent'}">Add</button><button type="button" data-z16-save="${z16Esc(id)}" data-source="${saved?'saved':'recent'}">${saved?'Unsave':'Save'}</button></div>
  </article>`;
}

function z16RenderTargets() {
  const targets = z16Core.normalizeTargets(z16ReadTargets());
  z16SetText('z16CaloriesTarget', targets.calories ? `/ ${targets.calories.toLocaleString()}` : '/ no target');
  z16SetText('z16ProteinTarget', targets.protein ? `/ ${targets.protein} g` : '/ no target');
  const calories = document.getElementById('z16TargetCalories');
  const protein = document.getElementById('z16TargetProtein');
  if (calories) calories.value = targets.calories || '';
  if (protein) protein.value = targets.protein || '';
}

function z16Render() {
  if (!z16Core) return;
  z16EnsureUi();
  const state = z16ReadState();
  const saved = z16ReadSaved().map(z16Core.normalizeMeal).filter(Boolean).map(meal => ({ id:z16Core.mealIdentity(meal), ...meal }));
  const recent = z16Core.recentMealOptions(state.meals || {}, 10);
  const savedTarget = document.getElementById('z16SavedMeals');
  const recentTarget = document.getElementById('z16RecentMeals');
  if (savedTarget) savedTarget.innerHTML = saved.length ? saved.map(meal => z16MealCard(meal,{saved:true})).join('') : '<div class="z16-empty">Save a meal you repeat often and it will stay here.</div>';
  if (recentTarget) recentTarget.innerHTML = recent.length ? recent.map(meal => z16MealCard(meal)).join('') : '<div class="z16-empty">Recent meals appear after you log food.</div>';
  document.querySelectorAll('[data-z16-multiplier]').forEach(button => button.classList.toggle('active', Number(button.dataset.z16Multiplier)===z16Multiplier));
  z16RenderTargets();
  z16BindDynamic();
}

function z16FindMeal(id, source) {
  const state = z16ReadState();
  if (source === 'saved') return z16ReadSaved().map(z16Core.normalizeMeal).filter(Boolean).find(meal => z16Core.mealIdentity(meal)===id) || null;
  return z16Core.recentMealOptions(state.meals || {}, 50).find(meal => meal.id===id) || null;
}

function z16SubmitMeal(meal) {
  const scaled = z16Core.scaleMeal(meal, z16Multiplier);
  const form = document.getElementById('mealForm');
  const name = document.getElementById('mealName');
  const calories = document.getElementById('mealCalories');
  const protein = document.getElementById('mealProtein');
  if (!scaled || !form || !name || !calories || !protein) return false;
  name.value = scaled.name;
  calories.value = scaled.calories;
  protein.value = scaled.protein;
  form.dispatchEvent(new SubmitEvent('submit', { bubbles:true, cancelable:true }));
  return true;
}

function z16Add(id, source) {
  const meal = z16FindMeal(id, source);
  if (!meal) return;
  if (z16SubmitMeal(meal)) {
    z16SetText('z16FuelStatus', `${meal.name} added at ${z16Multiplier}× serving.`);
    z16Schedule(100);
  }
}

function z16ToggleSave(id, source) {
  const meal = z16FindMeal(id, source);
  if (!meal) return;
  let saved = z16ReadSaved();
  const already = saved.some(item => z16Core.mealIdentity(item)===z16Core.mealIdentity(meal));
  saved = already ? z16Core.removeSavedMeal(saved, z16Core.mealIdentity(meal)) : z16Core.mergeSavedMeals(saved, meal);
  z16WriteSaved(saved);
  z16SetText('z16FuelStatus', already ? `${meal.name} removed from saved meals.` : `${meal.name} saved for one-tap logging.`);
  z16Render();
}

function z16SaveTyped() {
  const meal = z16Core.normalizeMeal({
    name:document.getElementById('mealName')?.value,
    calories:document.getElementById('mealCalories')?.value,
    protein:document.getElementById('mealProtein')?.value
  });
  if (!meal) { z16SetText('z16FuelStatus','Type a meal name, calories and protein first. Saving does not log it.'); return; }
  z16WriteSaved(z16Core.mergeSavedMeals(z16ReadSaved(), meal));
  z16SetText('z16FuelStatus', `${meal.name} saved without adding it to today.`);
  z16Render();
}

function z16RepeatYesterday() {
  const state = z16ReadState();
  const yesterday = z16Core.dayOffset(new Date(), -1);
  const meals = z16Core.mealsForDay(state.meals || {}, yesterday);
  if (!meals.length) { z16SetText('z16FuelStatus','No meals were logged yesterday.'); return; }
  let count = 0;
  for (const meal of meals) if (z16SubmitMeal(meal)) count += 1;
  z16SetText('z16FuelStatus', `${count} yesterday meal${count===1?'':'s'} added at ${z16Multiplier}× serving.`);
  z16Schedule(120);
}

function z16SaveTargets() {
  const targets = z16Core.normalizeTargets({ calories:document.getElementById('z16TargetCalories')?.value, protein:document.getElementById('z16TargetProtein')?.value });
  z16WriteTargets(targets);
  z16SetText('z16FuelStatus','Personal Fuel targets saved. They are display goals only and do not change Fitness XP.');
  z16RenderTargets();
  document.getElementById('z16TargetEditor').hidden = true;
}

function z16ClearTargets() {
  z16WriteTargets({});
  z16RenderTargets();
  z16SetText('z16FuelStatus','Fuel targets cleared. No calorie or protein target is being inferred.');
}

function z16BindDynamic() {
  document.querySelectorAll('[data-z16-add]').forEach(button => button.onclick = () => z16Add(button.dataset.z16Add, button.dataset.source));
  document.querySelectorAll('[data-z16-save]').forEach(button => button.onclick = () => z16ToggleSave(button.dataset.z16Save, button.dataset.source));
}

function z16Bind() {
  document.querySelectorAll('[data-z16-multiplier]').forEach(button => button.addEventListener('click', () => {
    z16Multiplier = Number(button.dataset.z16Multiplier) || 1;
    sessionStorage.setItem('zero2fit-fuel-multiplier', String(z16Multiplier));
    z16Render();
  }));
  document.getElementById('z16RepeatYesterday')?.addEventListener('click', z16RepeatYesterday);
  document.getElementById('z16SaveCurrent')?.addEventListener('click', z16SaveTyped);
  document.getElementById('z16TargetToggle')?.addEventListener('click', () => {
    const editor = document.getElementById('z16TargetEditor'); if (editor) editor.hidden = !editor.hidden;
  });
  document.getElementById('z16SaveTargets')?.addEventListener('click', z16SaveTargets);
  document.getElementById('z16ClearTargets')?.addEventListener('click', z16ClearTargets);
  document.getElementById('mealForm')?.addEventListener('submit', () => z16Schedule(80));
  document.getElementById('clearMeals')?.addEventListener('click', () => z16Schedule(80));
}

function z16Schedule(delay = 0) { clearTimeout(z16Timer); z16Timer = setTimeout(z16Render, delay); }

async function z16Init() {
  try {
    z16Core = await import('./fuel-core.mjs');
    z16EnsureUi();
    z16Render();
    window.addEventListener('focus', () => z16Schedule(80));
  } catch (error) { console.warn('Zero2Fit Build 016 Fuel failed', error); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', z16Init, { once:true }); else z16Init();
