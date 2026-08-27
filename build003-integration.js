(() => {
  'use strict';

  const STORAGE_KEY = 'zero2fit-v1';
  const storage = window.Zero2FitStorage;
  const ingestion = window.Zero2FitIngestion;
  let lastRaw = null;
  let previousState = null;
  let syncBusy = false;
  let syncQueued = false;

  const readState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  const clone = value => value ? JSON.parse(JSON.stringify(value)) : value;

  function localDateKey(value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function sourceLabel(provider) {
    return ({ manual:'Manual', renpho:'RENPHO', apple_health:'Apple Health', healthkit_bridge:'HealthKit bridge', zero2fit:'Zero2Fit' })[provider] || provider || 'Manual';
  }

  function weightToPounds(event) {
    const value = Number(event.value);
    if (!Number.isFinite(value)) return null;
    const unit = String(event.unit || '').toLowerCase();
    if (unit === 'lb' || unit === 'lbs') return value;
    if (unit === 'kg') return value * 2.2046226218;
    return null;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function connectionCardByTitle(title) {
    return [...document.querySelectorAll('#page-data .connection-card')].find(card => card.querySelector('strong')?.textContent.trim() === title);
  }

  function configureExistingConnections() {
    const manual = connectionCardByTitle('Manual / local');
    manual?.classList.add('build003-connected');
    if (manual) {
      manual.querySelector('div:nth-child(2) span').textContent = 'Weight, steps, meals and workouts · mirrored locally';
      manual.querySelector(':scope > span').textContent = 'Active';
    }

    const apple = connectionCardByTitle('Apple Health');
    if (apple) {
      apple.querySelector('div:nth-child(2) span').textContent = 'File import active · automatic sync requires native HealthKit companion';
      apple.querySelector(':scope > span').textContent = 'Import ready';
    }

    const watch = connectionCardByTitle('Withings');
    if (watch) {
      watch.querySelector('.connection-icon').textContent = 'A';
      watch.querySelector('strong').textContent = 'Amazfit Active 2 (Round)';
      watch.querySelector('div:nth-child(2) span').textContent = 'Zepp → Apple Health → planned HealthKit bridge';
      watch.querySelector(':scope > span').textContent = 'Bridge planned';
    }

    const renpho = connectionCardByTitle('Garmin / Fitbit');
    if (renpho) {
      renpho.querySelector('.connection-icon').textContent = 'R';
      renpho.querySelector('strong').textContent = 'RENPHO scale';
      renpho.querySelector('div:nth-child(2) span').textContent = 'ES-20M reported; ES-CS20M label pending · CSV import active';
      renpho.querySelector(':scope > span').textContent = 'Import ready';
    }
  }

  function ensureBuild003Ui() {
    if (!document.querySelector('link[href="./build003.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = './build003.css'; document.head.appendChild(link);
    }

    const intro = document.querySelector('.data-intro');
    if (intro) {
      intro.classList.add('build003-ready');
      if (intro.querySelector('.eyebrow')) intro.querySelector('.eyebrow').textContent = 'Data architecture · Build 003';
      if (intro.querySelector('.muted')) intro.querySelector('.muted').textContent = 'Structured local storage and device imports now share one normalized timeline while preserving source, timestamp and confidence.';
      if (intro.querySelector('.small-tag')) intro.querySelector('.small-tag').textContent = 'Structured local storage';
    }

    configureExistingConnections();
    const grid = document.querySelector('#page-data .connection-grid');
    if (grid && !document.getElementById('indexedDbConnection')) {
      grid.insertAdjacentHTML('beforeend', `
        <article class="connection-card connected build003-connected" id="indexedDbConnection"><div class="connection-icon">DB</div><div><strong>IndexedDB</strong><span>Snapshots, normalized events and import history</span></div><span id="indexedDbStatus">Starting…</span></article>
        <article class="connection-card" id="supabaseConnection"><div class="connection-icon">S</div><div><strong>Supabase</strong><span id="supabaseDetail">Target schema/RLS prepared; no project connected.</span></div><span id="supabaseStatus">Not configured</span></article>`);
    }

    const table = document.querySelector('#page-data .data-table-card');
    if (table && !document.getElementById('deviceToolsGrid')) {
      const tools = document.createElement('div');
      tools.id = 'deviceToolsGrid'; tools.className = 'content-grid two-col device-tools-grid';
      tools.innerHTML = `
        <article class="card">
          <div class="eyebrow">Device data</div><h2>Import measurements</h2>
          <p class="muted compact">RENPHO Health CSV, extracted Apple Health <code>export.xml</code>, or normalized JSON from a future HealthKit companion.</p>
          <form id="deviceImportForm" class="device-import-form">
            <label for="deviceImportSource">Source format</label>
            <select id="deviceImportSource"><option value="renpho">RENPHO CSV</option><option value="apple_health">Apple Health export.xml</option><option value="normalized_json">Zero2Fit / HealthKit normalized JSON</option></select>
            <label for="deviceImportFile">File</label>
            <input id="deviceImportFile" type="file" accept=".csv,.xml,.json,text/csv,text/xml,application/xml,application/json" />
            <button id="deviceImportButton" class="primary-button" type="submit">Import into local timeline</button>
          </form>
          <p class="device-status-line" id="deviceImportStatus">No device file imported yet.</p>
        </article>
        <article class="card">
          <div class="eyebrow">Portability</div><h2>Backup local data</h2>
          <p class="muted">Export current app state, normalized events and import history before cloud sync is introduced.</p>
          <button class="secondary-button full-width" id="exportStructuredBackup">Export JSON backup</button>
          <div class="mini-stats storage-mini-stats"><div><span>Events</span><strong id="normalizedEventCount">0</strong></div><div><span>Imports</span><strong id="importRunCount">0</strong></div><div><span>Saved</span><strong id="lastStructuredSave">—</strong></div></div>
          <p class="muted compact storage-source-note">Browser storage is the active runtime. Supabase remains disabled until authenticated RLS is configured and tested.</p>
        </article>`;
      table.before(tools);
    }

    const rows = [...document.querySelectorAll('#page-data .data-row:not(.head)')];
    const weightRow = rows.find(row => row.children[0]?.textContent.trim() === 'Weight');
    const stepsRow = rows.find(row => row.children[0]?.textContent.trim() === 'Steps');
    if (weightRow?.children[2]) weightRow.children[2].id = 'structuredWeightSource';
    if (weightRow?.children[3]) weightRow.children[3].id = 'structuredWeightStatus';
    if (stepsRow?.children[2]) stepsRow.children[2].id = 'structuredStepSource';
    if (stepsRow?.children[3]) stepsRow.children[3].id = 'structuredStepStatus';

    const weightCard = [...document.querySelectorAll('.metric-card')].find(card => card.querySelector('h2')?.textContent.trim() === 'Weight');
    const stepCard = [...document.querySelectorAll('.metric-card')].find(card => card.querySelector('h2')?.textContent.trim() === 'Steps');
    if (weightCard?.querySelector('.source-label')) weightCard.querySelector('.source-label').id = 'structuredWeightSourceCard';
    if (stepCard?.querySelector('.source-label')) stepCard.querySelector('.source-label').id = 'structuredStepSourceCard';
  }

  function deriveNewEvents(previous, current) {
    if (!ingestion || !previous || !current) return [];
    const events = [];
    const previousWeights = new Set((previous.weights || []).map(item => String(item.sourceEventId || item.date)));
    for (const item of current.weights || []) {
      const identity = String(item.sourceEventId || item.date);
      if (previousWeights.has(identity) || item.sourceEventId) continue;
      const value = Number(item.value);
      if (!Number.isFinite(value)) continue;
      const provider = item.sourceProvider || item.source || 'manual';
      events.push(ingestion.makeEvent({ metricType:'weight', value, unit:'lb', observedAt:new Date(Number(item.date) || Date.now()).toISOString(), sourceProvider:provider, sourceDevice:'web_app', sourceRecordId:`weight:${identity}`, provenanceStatus:provider === 'manual' ? 'user-entered' : 'observed', confidence:'measured' }));
    }

    const priorSteps = previous.steps || {};
    for (const [day, value] of Object.entries(current.steps || {})) {
      if (Number(priorSteps[day]) === Number(value)) continue;
      const source = current.stepSources?.[day];
      if (source?.sourceEventId) continue;
      events.push(ingestion.makeEvent({ metricType:'steps', value:Number(value), unit:'count', observedAt:new Date().toISOString(), sourceProvider:source?.provider || 'manual', sourceDevice:'web_app', sourceRecordId:`steps:${day}:${value}`, provenanceStatus:'user-entered', confidence:'measured', metadata:{aggregation:'daily_total', date:day} }));
    }

    const priorWorkouts = new Set((previous.workoutHistory || []).map(item => String(item.date)));
    for (const item of current.workoutHistory || []) {
      if (priorWorkouts.has(String(item.date))) continue;
      events.push(ingestion.makeEvent({ metricType:'workout_completed', value:Number(item.durationMinutes || 0), unit:'min', observedAt:new Date(Number(item.date) || Date.now()).toISOString(), sourceProvider:'zero2fit', sourceDevice:'web_app', sourceRecordId:`workout:${item.date}`, provenanceStatus:'observed', confidence:'user_tracked', metadata:{template_id:item.templateId, template_name:item.templateName, location:item.location, mode:item.mode, exercise_ids:item.completedExerciseIds || [], unavailable_intents:item.unavailableIntents || []} }));
    }
    return events;
  }

  function updateSourceLabels(state) {
    const latestWeight = [...(state?.weights || [])].sort((a,b) => Number(a.date)-Number(b.date)).at(-1);
    const weightProvider = latestWeight?.sourceProvider || latestWeight?.source || 'manual';
    const stepSource = state?.stepSources?.[localDateKey()] || null;
    const weightLabel = sourceLabel(weightProvider);
    const stepLabel = sourceLabel(stepSource?.provider || 'manual');
    for (const id of ['structuredWeightSource','structuredWeightSourceCard']) setText(id, weightLabel);
    for (const id of ['structuredStepSource','structuredStepSourceCard']) setText(id, stepLabel);
    setText('structuredWeightStatus', weightProvider === 'manual' ? 'Observed' : 'Imported');
    setText('structuredStepStatus', stepSource?.provider && stepSource.provider !== 'manual' ? 'Imported' : 'Observed');
  }

  async function renderStorageStatus(state = readState()) {
    if (!storage) return;
    try {
      const stats = await storage.getStats();
      setText('indexedDbStatus', stats.indexedDb ? 'Active' : 'Unavailable');
      setText('normalizedEventCount', Number(stats.events || 0).toLocaleString());
      setText('importRunCount', Number(stats.imports || 0).toLocaleString());
      setText('lastStructuredSave', stats.lastSavedAt ? new Date(stats.lastSavedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—');
      const remote = storage.remoteStatus();
      setText('supabaseStatus', remote.active ? 'Active' : remote.configured ? 'Prepared' : 'Not configured');
      setText('supabaseDetail', remote.note);
      const summary = state?.importSummary;
      if (summary) setText('deviceImportStatus', `${summary.eventCount} events · ${sourceLabel(summary.source)} · ${new Date(summary.at).toLocaleString()}${summary.warnings?.length ? ` · ${summary.warnings.join(' ')}` : ''}`);
    } catch (error) {
      setText('indexedDbStatus', 'Error'); console.warn(error);
    }
  }

  async function syncLocalState() {
    if (!storage || syncBusy) { syncQueued = true; return; }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw === lastRaw) return;
    syncBusy = true;
    try {
      const current = JSON.parse(raw);
      const events = deriveNewEvents(previousState, current);
      if (events.length) await storage.upsertEvents(events);
      await storage.saveSnapshot(current);
      previousState = clone(current); lastRaw = raw;
      updateSourceLabels(current); await renderStorageStatus(current);
    } catch (error) {
      console.warn('Zero2Fit structured-state mirror failed', error);
    } finally {
      syncBusy = false;
      if (syncQueued) { syncQueued = false; queueMicrotask(syncLocalState); }
    }
  }

  function applyImportedEvents(state, events) {
    state.importedEventIds ||= {};
    state.stepSources ||= {};
    state.weights = Array.isArray(state.weights) ? state.weights : [];
    state.steps ||= {};
    let appliedWeight = 0;
    let appliedSteps = 0;
    for (const event of events) {
      if (state.importedEventIds[event.event_id]) continue;
      state.importedEventIds[event.event_id] = true;
      if (event.metric_type === 'weight') {
        const pounds = weightToPounds(event);
        if (pounds !== null) {
          state.weights.push({ date:new Date(event.observed_at).getTime(), value:pounds, sourceProvider:event.source_provider, sourceLabel:sourceLabel(event.source_provider), sourceEventId:event.event_id, observedAt:event.observed_at });
          appliedWeight += 1;
        }
      }
      if (event.metric_type === 'steps' && event.metadata?.aggregation === 'daily_total' && Number.isFinite(Number(event.value))) {
        const day = localDateKey(new Date(event.observed_at));
        state.steps[day] = Math.max(0, Math.round(Number(event.value)));
        state.stepSources[day] = {provider:event.source_provider, label:sourceLabel(event.source_provider), sourceEventId:event.event_id, observedAt:event.observed_at};
        appliedSteps += 1;
      }
    }
    state.weights.sort((a,b) => Number(a.date)-Number(b.date));
    state.weights = state.weights.slice(-1000);
    return {appliedWeight, appliedSteps};
  }

  async function importDeviceFile(event) {
    event.preventDefault();
    const input = document.getElementById('deviceImportFile');
    const source = document.getElementById('deviceImportSource');
    const button = document.getElementById('deviceImportButton');
    const status = document.getElementById('deviceImportStatus');
    const file = input?.files?.[0];
    if (!file || !storage || !ingestion) {
      if (status) { status.textContent = 'Select a supported import file first.'; status.classList.add('error'); }
      return;
    }
    button.disabled = true; status?.classList.remove('error');
    try {
      const result = await ingestion.importFile(file, source?.value || 'auto');
      await storage.upsertEvents(result.events);
      await storage.recordImport(result.importRecord);
      const state = readState() || {};
      const applied = applyImportedEvents(state, result.events);
      state.importSummary = {at:Date.now(), source:result.importRecord.source_provider, eventCount:result.events.length, warnings:result.warnings || []};
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      await storage.saveSnapshot(state);
      if (status) status.textContent = `${result.events.length} normalized events imported${applied.appliedWeight ? ` · ${applied.appliedWeight} weight record(s) added` : ''}${applied.appliedSteps ? ' · daily steps updated' : ''}`;
      setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      if (status) { status.textContent = error.message || 'Import failed.'; status.classList.add('error'); }
      console.warn(error);
    } finally { button.disabled = false; }
  }

  async function exportBackup() {
    if (!storage) return;
    const button = document.getElementById('exportStructuredBackup');
    button.disabled = true;
    try {
      const backup = await storage.exportBackup(readState());
      const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `zero2fit-backup-${localDateKey()}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (error) { console.warn(error); }
    finally { button.disabled = false; }
  }

  function bindBuild003() {
    document.getElementById('deviceImportForm')?.addEventListener('submit', importDeviceFile);
    document.getElementById('exportStructuredBackup')?.addEventListener('click', exportBackup);
    const reset = document.getElementById('resetDemo');
    reset?.addEventListener('click', () => {
      const before = localStorage.getItem(STORAGE_KEY);
      setTimeout(async () => {
        const after = localStorage.getItem(STORAGE_KEY);
        if (after !== before) {
          try { await storage?.clearAll(); lastRaw = null; previousState = null; await syncLocalState(); }
          catch (error) { console.warn(error); }
        }
      }, 0);
    }, true);
  }

  async function init() {
    ensureBuild003Ui(); bindBuild003();
    if (!storage || !ingestion) { setText('deviceImportStatus', 'Structured storage or ingestion module failed to load.'); return; }
    try {
      await storage.openDb();
      const current = readState();
      if (current) {
        previousState = clone(current); lastRaw = localStorage.getItem(STORAGE_KEY);
        await storage.saveSnapshot(current); updateSourceLabels(current);
      }
      await renderStorageStatus(current);
      setInterval(syncLocalState, 1200);
    } catch (error) {
      setText('indexedDbStatus', 'Unavailable'); console.warn('Build 003 storage initialization failed', error);
    }
  }

  init();
})();
