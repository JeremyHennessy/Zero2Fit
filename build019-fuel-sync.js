import { normalizeTargets, mealFingerprint } from './nutrition-core.mjs';
import { fuelDeletionEventInput } from './remote-sync-core.mjs';

const FUEL_KEY = 'zero2fit-fuel-v2';
let initialized = false;
let previousFuel = null;

function readFuel() {
  try {
    const raw = localStorage.getItem(FUEL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeFuel(state) {
  if (!state) return;
  localStorage.setItem(FUEL_KEY, JSON.stringify(state));
}

function targetsKey(state = {}) {
  return JSON.stringify(normalizeTargets(state.nutritionTargets || {}));
}

function savedKey(state = {}) {
  return JSON.stringify((Array.isArray(state.savedMeals) ? state.savedMeals : [])
    .map(item => `${item.id || ''}|${mealFingerprint(item)}`)
    .sort());
}

function mealMap(state = {}) {
  const map = new Map();
  for (const [day, entries] of Object.entries(state.meals || {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry?.id) continue;
      map.set(entry.id, { ...entry, day:entry.day || day });
    }
  }
  return map;
}

async function emitDeletionEvents(entries = [], deletedAt = new Date().toISOString()) {
  const ingestion = window.Zero2FitIngestion;
  const storage = window.Zero2FitStorage;
  if (!entries.length || !ingestion?.makeEvent || !storage?.upsertEvents) return;
  const events = entries.map(entry => ingestion.makeEvent(fuelDeletionEventInput(entry, deletedAt)));
  await storage.upsertEvents(events).catch(() => {});
}

function stampChangedPreferences(before, after) {
  if (!after) return after;
  const now = new Date().toISOString();
  const syncMeta = { ...(after.syncMeta || {}) };
  let changed = false;
  if (targetsKey(before || {}) !== targetsKey(after)) {
    syncMeta.targetsUpdatedAt = now;
    changed = true;
  }
  if (savedKey(before || {}) !== savedKey(after)) {
    syncMeta.savedMealsUpdatedAt = now;
    changed = true;
  }
  if (!changed) return after;
  return { ...after, syncMeta, updatedAt:now };
}

function reconcileFuelUpdate(event) {
  const current = readFuel();
  if (!current) {
    previousFuel = null;
    renderSyncStatus();
    return;
  }
  if (event?.detail?.source === 'private-sync') {
    previousFuel = current;
    renderSyncStatus();
    return;
  }

  const before = previousFuel;
  const stamped = stampChangedPreferences(before, current);
  if (stamped !== current) writeFuel(stamped);

  const beforeMeals = mealMap(before || {});
  const afterMeals = mealMap(stamped || {});
  const removed = [...beforeMeals.entries()]
    .filter(([id]) => !afterMeals.has(id))
    .map(([,entry]) => entry);
  if (removed.length) emitDeletionEvents(removed).catch(() => {});

  previousFuel = stamped;
  renderSyncStatus();
}

function ensureStylesheet() {
  if (document.querySelector('link[href="./build019.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build019.css';
  document.head.appendChild(link);
}

function ensureFuelStatus() {
  const hero = document.querySelector('#z17Fuel .z17-fuel-hero');
  if (!hero || document.getElementById('z19FuelSync')) return;
  const targetToggle = hero.querySelector('#z17TargetToggle');
  const strip = document.createElement('div');
  strip.id = 'z19FuelSync';
  strip.className = 'z19-fuel-sync';
  strip.innerHTML = '<span class="z19-sync-dot"></span><div><strong>Fuel private sync</strong><small id="z19FuelSyncText">Checking private sync…</small></div>';
  if (targetToggle) targetToggle.before(strip);
  else hero.appendChild(strip);
}

function ensureDataCopy() {
  const panel = document.getElementById('z8PrivateSync');
  if (panel) {
    const description = panel.querySelector(':scope > p.muted');
    if (description && !description.dataset.z19FuelCopy) {
      description.dataset.z19FuelCopy = '1';
      description.textContent = 'Events are private per authenticated user. Sync now reconciles device events plus Fuel history, saved meals and explicit nutrition targets. HealthKit source names remain evidence only until you explicitly verify the exact source bundle; unverified device data never awards permanent Fitness XP.';
    }
  }

  const storageNote = document.querySelector('#deviceToolsGrid .storage-source-note');
  if (storageNote) {
    storageNote.textContent = 'Browser storage remains the local cache. Authenticated Supabase sync is configured with per-user RLS; sign in under Private sync to reconcile supported data across browsers.';
  }

  const backupCard = [...document.querySelectorAll('#deviceToolsGrid .card')]
    .find(card => card.querySelector('h2')?.textContent?.trim() === 'Backup local data');
  const backupDescription = backupCard?.querySelector(':scope > p.muted');
  if (backupDescription) {
    backupDescription.textContent = 'Export a portable JSON snapshot of local state, normalized events, imports, photo metadata and the full Fuel store. Raw progress-photo image blobs remain local and are excluded from this backup.';
  }
}

function renderDataLastSync(status) {
  const node = document.getElementById('z8LastSync');
  const last = status?.last_sync;
  if (!node || !last?.synced_at) return;
  const fuel = Number(last.fuel_history_entries || 0);
  const saved = Number(last.fuel_saved_meals || 0);
  const targets = Number(last.fuel_targets_set || 0);
  node.textContent = `Last sync ${new Date(last.synced_at).toLocaleString()} · ${Number(last.pulled || 0)} remote events · ${fuel} Fuel entries · ${saved} saved meals${targets ? ` · ${targets} targets` : ''}`;
}

function renderSyncStatus() {
  ensureFuelStatus();
  ensureDataCopy();
  const remote = window.Zero2FitRemoteSync;
  const status = remote?.status?.() || { configured:false, signed_in:false };
  const node = document.getElementById('z19FuelSyncText');
  const strip = document.getElementById('z19FuelSync');
  if (strip) strip.dataset.state = status.signed_in ? 'signed-in' : status.configured ? 'ready' : 'local';
  if (node) {
    if (status.signed_in) {
      const last = status.last_sync;
      node.textContent = last?.synced_at
        ? `Included with Sync now · last reconciled ${new Date(last.synced_at).toLocaleString()}.`
        : 'Included with Sync now · history, saved meals and explicit targets sync to your private account.';
    } else if (status.configured) {
      node.textContent = 'Fuel history is local + backup. Sign in under Data to sync history, saved meals and targets privately.';
    } else {
      node.textContent = 'Fuel history is local + backup. Private remote sync is not configured.';
    }
  }
  renderDataLastSync(status);
}

function bind() {
  window.addEventListener('zero2fit:fuel-updated', reconcileFuelUpdate);
  window.addEventListener('zero2fit:remote-session', () => setTimeout(renderSyncStatus, 0));
  window.addEventListener('zero2fit:remote-sync', event => {
    previousFuel = readFuel();
    setTimeout(() => {
      renderSyncStatus();
      const node = document.getElementById('z8Message');
      const detail = event.detail || {};
      if (node && Number.isFinite(Number(detail.fuel_history_entries))) {
        node.textContent = `Private sync complete: ${Number(detail.pushed || 0)} local events pushed, ${Number(detail.pulled || 0)} remote events pulled, ${Number(detail.fuel_history_entries || 0)} Fuel entries reconciled, ${Number(detail.fuel_saved_meals || 0)} saved meals synced.`;
      }
    }, 20);
  });
  window.addEventListener('focus', renderSyncStatus);
}

function init() {
  if (initialized) return;
  if (!window.Zero2FitFuel || !document.getElementById('z17Fuel')) return setTimeout(init, 100);
  initialized = true;
  ensureStylesheet();
  document.body.classList.add('build019-fuel-sync');
  previousFuel = readFuel();
  ensureFuelStatus();
  ensureDataCopy();
  bind();
  renderSyncStatus();
  setTimeout(renderSyncStatus, 700);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();