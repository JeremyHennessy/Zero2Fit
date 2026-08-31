import * as lookupCore from './food-lookup-core.mjs';
import * as nutritionCore from './nutrition-core.mjs';

const CACHE_KEY = 'zero2fit-food-lookup-cache-v1';
const LAST_RESULTS_KEY = 'zero2fit-food-lookup-last-v1';
const FUEL_KEY = 'zero2fit-fuel-v2';
let results = [];
let resultContext = null;
let initialized = false;

function today() { return nutritionCore.dayKey(new Date()); }
function activeDay() { return sessionStorage.getItem('zero2fit-fuel-day') || today(); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function num(value, digits = 1) { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString(undefined,{maximumFractionDigits:digits}) : '—'; }

function toast(message) {
  const node = document.getElementById('toast');
  if (!node) return console.info(message);
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2400);
}

function ensureStyle() {
  if (document.querySelector('link[href="./build018.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build018.css';
  document.head.appendChild(link);
}

function config() {
  const value = window.ZERO2FIT_CONFIG || {};
  return {
    url:String(value.supabaseUrl || '').replace(/\/$/, ''),
    key:String(value.supabasePublishableKey || value.supabaseAnonKey || '')
  };
}

function readJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch {}
}

function cacheGet(key) {
  const cache = readJson(CACHE_KEY, {});
  const row = cache[key];
  if (!row || Number(row.expires || 0) <= Date.now()) return null;
  return row.payload || null;
}
function cachePut(key, payload, ttlMs) {
  const cache = readJson(CACHE_KEY, {});
  for (const [entryKey,row] of Object.entries(cache)) if (Number(row?.expires || 0) <= Date.now()) delete cache[entryKey];
  cache[key] = { expires:Date.now() + ttlMs, payload };
  const entries = Object.entries(cache).sort((a,b) => Number(b[1]?.expires || 0) - Number(a[1]?.expires || 0)).slice(0, 30);
  writeJson(CACHE_KEY, Object.fromEntries(entries));
}

async function providerRequest(mode, value) {
  const { url, key } = config();
  if (!url || !key) throw new Error('Food lookup is not configured.');
  const cacheKey = lookupCore.providerCacheKey(mode, value);
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, local_cached:true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${url}/functions/v1/food-lookup`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', apikey:key },
      body:JSON.stringify(mode === 'barcode' ? { mode, barcode:value } : { mode, query:value }),
      signal:controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429) throw new Error('Food lookup is temporarily rate-limited. Try again shortly.');
      if (payload?.error === 'provider_failed') throw new Error('Open Food Facts is temporarily unavailable. Your saved/recent foods still work.');
      throw new Error('Food lookup failed.');
    }
    cachePut(cacheKey, payload, mode === 'barcode' ? 60 * 60_000 : 15 * 60_000);
    return payload;
  } finally { clearTimeout(timer); }
}

function basisLabel(value) {
  if (value === 'serving') return 'Per serving';
  if (value === 'calculated_serving') return 'Serving from 100 g data';
  return '100 g reference';
}

function ensureUi() {
  const shell = document.getElementById('z17Fuel');
  const hero = shell?.querySelector('.z17-fuel-hero');
  if (!shell || !hero || document.getElementById('z18FoodLookup')) return Boolean(document.getElementById('z18FoodLookup'));
  hero.insertAdjacentHTML('afterend', `
    <article class="card z18-lookup" id="z18FoodLookup">
      <div class="z18-head">
        <div><div class="eyebrow">Food database · Build 018</div><h2>Find food without typing the macros.</h2><p class="muted compact">Search deliberately—not on every keystroke—or look up the barcode on packaged food.</p></div>
        <select id="z18MealType" aria-label="Meal type"><option value="meal">Other</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select>
      </div>
      <div class="z18-forms">
        <form id="z18SearchForm" class="z18-form">
          <label><span>Search Open Food Facts</span><input id="z18Search" type="search" autocomplete="off" placeholder="Greek yogurt, granola, protein bar…"></label>
          <button class="primary-button" type="submit">Search</button>
        </form>
        <form id="z18BarcodeForm" class="z18-form z18-barcode-form">
          <label><span>Barcode</span><input id="z18Barcode" type="text" inputmode="numeric" autocomplete="off" placeholder="UPC / EAN"></label>
          <button class="secondary-button" type="submit">Look up</button>
          <button class="text-button" type="button" id="z18Scan" hidden>Scan camera</button>
          <input id="z18ScanFile" type="file" accept="image/*" capture="environment" hidden>
        </form>
      </div>
      <div class="z18-status" id="z18Status">Search only when you ask. Barcode results use the current Open Food Facts product API.</div>
      <div class="z18-results" id="z18Results"></div>
      <div class="z18-source"><span>Community product data:</span> <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a> <span>· ODbL · verify the package label if a result looks wrong.</span></div>
    </article>`);
  bindUi();
  return true;
}

function setStatus(message, state = '') {
  const node = document.getElementById('z18Status');
  if (!node) return;
  node.textContent = message;
  node.dataset.state = state;
}

function renderResults() {
  const target = document.getElementById('z18Results');
  if (!target) return;
  if (!results.length) {
    target.innerHTML = resultContext ? '<div class="empty-state compact">No products with usable calorie data were returned.</div>' : '';
    return;
  }
  target.innerHTML = results.map((item,index) => `
    <div class="z18-result">
      <div class="z18-result-copy"><span class="z18-basis">${esc(basisLabel(item.nutritionBasis))}</span><strong>${esc(item.name)}</strong><small>${esc(item.serving)}${item.quantity ? ` · pack ${esc(item.quantity)}` : ''}</small></div>
      <div class="z18-macros"><strong>${num(item.calories,0)} kcal</strong><small>${num(item.protein)}p · ${num(item.carbs)}c · ${num(item.fat)}f</small></div>
      <button class="primary-button" type="button" data-z18-log="${index}">Log</button>
    </div>`).join('');
}

function rememberResults(context) {
  resultContext = context;
  writeJson(LAST_RESULTS_KEY, { context, results, saved_at:new Date().toISOString() });
}

async function runSearch(query) {
  const clean = String(query || '').replace(/\s+/g,' ').trim();
  if (clean.length < 2) return setStatus('Type at least two characters, then tap Search.', 'error');
  setStatus(`Searching for “${clean}”…`, 'loading');
  try {
    const payload = await providerRequest('search', clean);
    results = lookupCore.extractOpenFoodFactsProducts(payload).slice(0, 8);
    rememberResults({ mode:'search', value:clean });
    setStatus(results.length ? `${results.length} usable result${results.length === 1 ? '' : 's'} · select the package/serving that matches.` : 'No usable nutrition results found.', results.length ? 'success' : 'empty');
    renderResults();
  } catch (error) {
    results = [];
    resultContext = { mode:'search', value:clean };
    setStatus(error instanceof Error ? error.message : 'Food lookup failed.', 'error');
    renderResults();
  }
}

async function runBarcode(value) {
  const code = lookupCore.normalizeBarcode(value);
  if (!code) return setStatus('Enter an 8–14 digit UPC/EAN barcode.', 'error');
  const input = document.getElementById('z18Barcode');
  if (input) input.value = code;
  setStatus(`Looking up ${code}…`, 'loading');
  try {
    const payload = await providerRequest('barcode', code);
    results = lookupCore.extractOpenFoodFactsProducts(payload).slice(0, 1);
    rememberResults({ mode:'barcode', value:code });
    setStatus(results.length ? 'Barcode found · check the serving basis before logging.' : 'Barcode not found with usable nutrition data.', results.length ? 'success' : 'empty');
    renderResults();
  } catch (error) {
    results = [];
    resultContext = { mode:'barcode', value:code };
    setStatus(error instanceof Error ? error.message : 'Barcode lookup failed.', 'error');
    renderResults();
  }
}

function submitLegacy(entry) {
  if (entry.day !== today()) return;
  const form = document.getElementById('mealForm');
  const name = document.getElementById('mealName');
  const calories = document.getElementById('mealCalories');
  const protein = document.getElementById('mealProtein');
  if (!form || !name || !calories || !protein) return;
  name.value = entry.name;
  calories.value = String(entry.calories || 0);
  protein.value = String(entry.protein || 0);
  form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
}

function recordEvent(entry) {
  const ingestion = window.Zero2FitIngestion;
  const storage = window.Zero2FitStorage;
  if (!ingestion?.makeEvent || !storage?.upsertEvents) return;
  try {
    const event = ingestion.makeEvent({
      metricType:'nutrition_entry', value:Number(entry.calories || 0), unit:'kcal',
      observedAt:entry.day === today() ? entry.loggedAt : `${entry.day}T12:00:00`,
      sourceProvider:'open_food_facts', sourceDevice:'web_app', sourceRecordId:`nutrition:${entry.id}`,
      provenanceStatus:'user-entered', confidence:'provider_reported',
      metadata:{ date:entry.day, name:entry.name, protein_g:entry.protein, carbs_g:entry.carbs, fat_g:entry.fat, meal_type:entry.mealType, serving:entry.serving, barcode:entry.barcode, source_item_id:entry.sourceItemId, selection_provenance:'user-selected-provider', backfilled:entry.day !== today() }
    });
    storage.upsertEvents([event]).catch(() => {});
  } catch {}
}

function logResult(index) {
  const product = results[index];
  if (!product) return;
  const mealType = document.getElementById('z18MealType')?.value || 'meal';
  const candidate = lookupCore.lookupCandidate(product, mealType);
  if (!candidate) return toast('That product does not have usable nutrition data.');
  const day = activeDay();
  const entry = nutritionCore.createMealEntry(candidate,{day,source:'open_food_facts'});
  submitLegacy(entry);
  const state = window.Zero2FitFuel?.readState?.() || readJson(FUEL_KEY,{version:1,meals:{},savedMeals:[],nutritionTargets:{}});
  state.meals ||= {};
  state.meals[day] ||= [];
  state.meals[day].push(entry);
  state.updatedAt = new Date().toISOString();
  writeJson(FUEL_KEY,state);
  window.Zero2FitFuel?.render?.(state);
  window.dispatchEvent(new CustomEvent('zero2fit:fuel-updated',{detail:{day,entryId:entry.id}}));
  recordEvent(entry);
  toast(`${entry.name} logged from Open Food Facts.`);
}

async function enableScanner() {
  const button = document.getElementById('z18Scan');
  const file = document.getElementById('z18ScanFile');
  if (!button || !file) return;
  if (!('BarcodeDetector' in globalThis) || !globalThis.BarcodeDetector?.getSupportedFormats) {
    button.hidden = false;
    button.disabled = true;
    button.textContent = 'Camera scan unavailable';
    return;
  }
  try {
    const supported = await globalThis.BarcodeDetector.getSupportedFormats();
    const formats = ['ean_13','ean_8','upc_a','upc_e'].filter(format => supported.includes(format));
    if (!formats.length) throw new Error('unsupported');
    button.hidden = false;
    button.disabled = false;
    button.textContent = 'Scan camera';
    button.addEventListener('click',() => file.click());
    file.addEventListener('change',async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      setStatus('Reading barcode from camera image…','loading');
      try {
        const bitmap = await createImageBitmap(selected);
        const detector = new globalThis.BarcodeDetector({formats});
        const found = await detector.detect(bitmap);
        bitmap.close?.();
        const code = found.map(item => lookupCore.normalizeBarcode(item.rawValue)).find(Boolean);
        if (!code) return setStatus('No UPC/EAN barcode found in that image.','error');
        await runBarcode(code);
      } catch { setStatus('Camera barcode detection failed in this browser. Type the barcode instead.','error'); }
      finally { file.value = ''; }
    });
  } catch {
    button.hidden = false;
    button.disabled = true;
    button.textContent = 'Camera scan unavailable';
  }
}

function bindUi() {
  document.getElementById('z18SearchForm')?.addEventListener('submit',event => { event.preventDefault(); runSearch(document.getElementById('z18Search')?.value); });
  document.getElementById('z18BarcodeForm')?.addEventListener('submit',event => { event.preventDefault(); runBarcode(document.getElementById('z18Barcode')?.value); });
  document.getElementById('z18Results')?.addEventListener('click',event => {
    const button = event.target.closest('[data-z18-log]');
    if (button) logResult(Number(button.dataset.z18Log));
  });
  enableScanner();
}

function restoreLast() {
  const last = readJson(LAST_RESULTS_KEY,null);
  if (!last || !Array.isArray(last.results)) return;
  results = last.results.map(item => lookupCore.normalizeOpenFoodFactsProduct(item) || item).filter(Boolean);
  resultContext = last.context || null;
  if (resultContext?.mode === 'search') {
    const input = document.getElementById('z18Search');
    if (input) input.value = resultContext.value || '';
  }
  if (resultContext?.mode === 'barcode') {
    const input = document.getElementById('z18Barcode');
    if (input) input.value = resultContext.value || '';
  }
  setStatus(results.length ? `Showing ${results.length} previous lookup result${results.length === 1 ? '' : 's'}.` : 'Ready for a new lookup.', results.length ? 'success' : '');
  renderResults();
}

function init() {
  if (initialized) return;
  if (!window.Zero2FitFuel || !document.getElementById('z17Fuel')) return setTimeout(init,100);
  initialized = true;
  ensureStyle();
  document.body.classList.add('build018-food-lookup');
  if (!ensureUi()) return;
  restoreLast();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();

import('./build019-fuel-sync.js').catch(error => console.warn('Zero2Fit Build 019 Fuel sync extension failed to load', error));
