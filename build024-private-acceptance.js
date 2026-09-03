import {
  acceptanceProbeRows,
  preferenceProbeRow,
  restoredPreferenceRow,
  acceptanceMarker,
  summarizeChecks,
  acceptanceDisplay
} from './acceptance-core.mjs';

const RESULT_KEY = 'zero2fit-private-acceptance-v1';
const config = window.ZERO2FIT_CONFIG || {};
const remote = window.Zero2FitRemoteSync;
const apiBase = String(config.supabaseUrl || '').replace(/\/+$/, '');
const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey || '';
let initialized = false;

function encodedPath(path) {
  return String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (/json/i.test(contentType)) return await response.json().catch(() => null);
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function currentSession() {
  const session = remote?.readSession?.();
  if (!session?.access_token) throw new Error('Sign in to private sync first.');
  if (!apiBase || !publishableKey) throw new Error('Private sync is not configured.');
  return session;
}

async function waitForPhotoContinuity() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (remote?.syncNow?.__z22Wrapped) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Private photo continuity is still initializing. Wait a moment and run the self-test again.');
}

async function dbRest(path, { method = 'GET', body, headers = {} } = {}) {
  const session = currentSession();
  const response = await fetch(`${apiBase}/rest/v1/${path}`, {
    method,
    headers:{
      apikey:publishableKey,
      Authorization:`Bearer ${session.access_token}`,
      ...(body !== undefined ? { 'Content-Type':'application/json' } : {}),
      ...headers
    },
    body:body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = payload?.message || payload?.error || payload?.hint || `${response.status} ${response.statusText}`;
    throw new Error(String(message));
  }
  return payload;
}

async function anonymousRest(path) {
  const response = await fetch(`${apiBase}/rest/v1/${path}`, {
    headers:{ apikey:publishableKey }
  });
  return { ok:response.ok, status:response.status, payload:await parseResponse(response) };
}

async function storageUpload(path, blob) {
  const session = currentSession();
  const response = await fetch(`${apiBase}/storage/v1/object/progress-photos/${encodedPath(path)}`, {
    method:'POST',
    headers:{
      apikey:publishableKey,
      Authorization:`Bearer ${session.access_token}`,
      'Content-Type':blob.type || 'image/jpeg',
      'cache-control':'60',
      'x-upsert':'true'
    },
    body:blob
  });
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(String(payload?.message || payload?.error || `Storage upload failed: ${response.status}`));
  return payload;
}

async function storageDownload(path) {
  const session = currentSession();
  const response = await fetch(`${apiBase}/storage/v1/object/authenticated/progress-photos/${encodedPath(path)}`, {
    headers:{ apikey:publishableKey, Authorization:`Bearer ${session.access_token}` }
  });
  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new Error(String(payload?.message || payload?.error || `Storage download failed: ${response.status}`));
  }
  return await response.blob();
}

async function storageRemove(paths = []) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return;
  const session = currentSession();
  const response = await fetch(`${apiBase}/storage/v1/object/progress-photos`, {
    method:'DELETE',
    headers:{
      apikey:publishableKey,
      Authorization:`Bearer ${session.access_token}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({ prefixes:unique })
  });
  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new Error(String(payload?.message || payload?.error || `Storage delete failed: ${response.status}`));
  }
}

async function storageMissing(path) {
  const session = currentSession();
  const url = `${apiBase}/storage/v1/object/authenticated/progress-photos/${encodedPath(path)}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(url, {
      headers:{ apikey:publishableKey, Authorization:`Bearer ${session.access_token}` }
    });
    if (!response.ok) return true;
    if (attempt < 9) await new Promise(resolve => setTimeout(resolve, 150));
  }
  return false;
}

function tinyJpeg() {
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type:'image/jpeg' });
}

async function pullPreference() {
  const rows = await dbRest('user_preferences?select=preferred_units,workout_location,settings,updated_at&limit=1');
  return rows?.[0] || null;
}

async function upsertPreference(row) {
  await dbRest('user_preferences?on_conflict=user_id', {
    method:'POST',
    body:[row],
    headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
  });
}

async function restorePreference(existing, userId) {
  const restored = restoredPreferenceRow(existing, userId);
  if (restored) await upsertPreference(restored);
  else await dbRest(`user_preferences?user_id=eq.${encodeURIComponent(userId)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' } });
}

async function cleanupProbe(rows) {
  const safe = async operation => { try { await operation(); } catch {} };
  await safe(() => storageRemove([rows.storagePath]));
  await safe(() => dbRest(`progress_photo_assets?photo_id=eq.${encodeURIComponent(rows.photoAsset.photo_id)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' }));
  await safe(() => dbRest(`progress_photo_sessions?session_id=eq.${encodeURIComponent(rows.photoSession.session_id)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' }));
  await safe(() => dbRest(`workout_sets?set_id=eq.${encodeURIComponent(rows.workoutSet.set_id)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' }));
  await safe(() => dbRest(`workout_sessions?session_id=eq.${encodeURIComponent(rows.workoutSession.session_id)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' }));
  await safe(() => dbRest(`normalized_events?event_id=eq.${encodeURIComponent(rows.eventId)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' }));
}

async function runAcceptanceSelfTest() {
  await waitForPhotoContinuity();
  const user = await remote?.getUser?.();
  if (!user?.id) throw new Error('Sign in before running private-account acceptance.');

  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const ids = {
    sessionId:crypto.randomUUID(),
    setId:crypto.randomUUID(),
    photoSessionId:crypto.randomUUID(),
    photoId:crypto.randomUUID()
  };
  const rows = acceptanceProbeRows({ userId:user.id, runId, now, ids });
  const originalPreference = await pullPreference();
  let preferenceTouched = false;
  const checks = [];
  let syncResult = null;

  async function check(id, label, operation) {
    try {
      const detail = await operation();
      checks.push({ id, label, status:'pass', detail:String(detail || 'Passed') });
    } catch (error) {
      checks.push({ id, label, status:'fail', detail:error.message || String(error) });
      throw error;
    }
  }

  try {
    await check('auth', 'Authenticated account', async () => {
      if (currentSession()?.user?.id && currentSession().user.id !== user.id) throw new Error('Session user does not match authenticated user.');
      return `Authenticated user ${user.id.slice(0, 8)}… confirmed.`;
    });

    await check('anon_block', 'Anonymous application-table access blocked', async () => {
      const response = await anonymousRest('user_preferences?select=user_id&limit=1');
      if (response.ok) throw new Error('Anonymous REST access unexpectedly succeeded.');
      return `Anonymous request rejected with HTTP ${response.status}.`;
    });

    await check('event_crud', 'Normalized event CRUD', async () => {
      await dbRest('normalized_events?on_conflict=user_id,event_id', {
        method:'POST', body:[rows.event], headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
      });
      let selected = await dbRest(`normalized_events?event_id=eq.${encodeURIComponent(rows.eventId)}&select=user_id,event_id,numeric_value,metadata`);
      if (selected?.length !== 1 || selected[0].user_id !== user.id || selected[0].numeric_value !== 1) throw new Error('Inserted probe event did not round-trip.');
      await dbRest(`normalized_events?event_id=eq.${encodeURIComponent(rows.eventId)}`, {
        method:'PATCH', body:{ numeric_value:2, metadata:{ acceptance_probe:true, run_id:runId, phase:'update' } }, headers:{ Prefer:'return=minimal' }
      });
      selected = await dbRest(`normalized_events?event_id=eq.${encodeURIComponent(rows.eventId)}&select=numeric_value,metadata`);
      if (selected?.[0]?.numeric_value !== 2 || selected[0]?.metadata?.phase !== 'update') throw new Error('Probe event update did not round-trip.');
      await dbRest(`normalized_events?event_id=eq.${encodeURIComponent(rows.eventId)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' } });
      return 'Insert → select → update → delete passed.';
    });

    await check('preferences', 'Fuel/preferences round-trip', async () => {
      const probe = preferenceProbeRow(originalPreference, user.id, runId, new Date().toISOString());
      await upsertPreference(probe);
      preferenceTouched = true;
      const selected = await pullPreference();
      if (selected?.settings?.acceptance_probe?.run_id !== runId) throw new Error('Preference probe did not round-trip.');
      await restorePreference(originalPreference, user.id);
      preferenceTouched = false;
      const restored = await pullPreference();
      if (originalPreference && JSON.stringify(restored?.settings || {}) !== JSON.stringify(originalPreference.settings || {})) throw new Error('Existing preference settings were not restored exactly.');
      if (!originalPreference && restored) throw new Error('Temporary preference row was not removed.');
      return originalPreference ? 'Existing preferences preserved after write/read test.' : 'Temporary preference row created, verified and removed.';
    });

    await check('workout_crud', 'Workout session/set continuity tables', async () => {
      await dbRest('workout_sessions?on_conflict=user_id,session_id', {
        method:'POST', body:[rows.workoutSession], headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
      });
      await dbRest('workout_sets?on_conflict=user_id,set_id', {
        method:'POST', body:[rows.workoutSet], headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
      });
      let selected = await dbRest(`workout_sets?set_id=eq.${encodeURIComponent(rows.workoutSet.set_id)}&select=user_id,session_id,reps,load_value,metadata`);
      if (selected?.length !== 1 || selected[0].user_id !== user.id || selected[0].session_id !== rows.workoutSession.session_id || selected[0].load_value !== 10) throw new Error('Workout probe did not preserve session/set linkage.');
      await dbRest(`workout_sets?set_id=eq.${encodeURIComponent(rows.workoutSet.set_id)}`, {
        method:'PATCH', body:{ load_value:12, metadata:{ acceptance_probe:true, run_id:runId, phase:'update' } }, headers:{ Prefer:'return=minimal' }
      });
      selected = await dbRest(`workout_sets?set_id=eq.${encodeURIComponent(rows.workoutSet.set_id)}&select=load_value,metadata`);
      if (selected?.[0]?.load_value !== 12 || selected[0]?.metadata?.phase !== 'update') throw new Error('Workout set update did not round-trip.');
      await dbRest(`workout_sets?set_id=eq.${encodeURIComponent(rows.workoutSet.set_id)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' } });
      await dbRest(`workout_sessions?session_id=eq.${encodeURIComponent(rows.workoutSession.session_id)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' } });
      return 'Session FK, set read/update and cleanup passed.';
    });

    await check('photo_metadata', 'Progress-photo metadata tables', async () => {
      await dbRest('progress_photo_sessions?on_conflict=user_id,session_id', {
        method:'POST', body:[rows.photoSession], headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
      });
      await dbRest('progress_photo_assets?on_conflict=user_id,photo_id', {
        method:'POST', body:[rows.photoAsset], headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
      });
      const selected = await dbRest(`progress_photo_assets?photo_id=eq.${encodeURIComponent(rows.photoAsset.photo_id)}&select=user_id,session_id,storage_path,metadata`);
      if (selected?.length !== 1 || selected[0].user_id !== user.id || selected[0].storage_path !== rows.storagePath) throw new Error('Progress-photo metadata did not round-trip.');
      return 'Session/asset ownership and storage path passed.';
    });

    await check('storage_crud', 'Private progress-photo Storage', async () => {
      const blob = tinyJpeg();
      await storageUpload(rows.storagePath, blob);
      const downloaded = await storageDownload(rows.storagePath);
      if (downloaded.size !== blob.size) throw new Error(`Downloaded probe size ${downloaded.size} did not match upload size ${blob.size}.`);
      await storageRemove([rows.storagePath]);
      if (!(await storageMissing(rows.storagePath))) throw new Error('Deleted private Storage probe remained readable.');
      await dbRest(`progress_photo_assets?photo_id=eq.${encodeURIComponent(rows.photoAsset.photo_id)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' } });
      await dbRest(`progress_photo_sessions?session_id=eq.${encodeURIComponent(rows.photoSession.session_id)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' } });
      return 'Authenticated upload → download → delete passed.';
    });

    await cleanupProbe(rows);

    await check('full_sync', 'Zero2Fit full private sync', async () => {
      syncResult = await remote.syncNow();
      if (!syncResult?.synced_at || syncResult?.user_id !== user.id) throw new Error('Sync now did not return the authenticated user result.');
      return `${Number(syncResult.pulled || 0)} events, ${Number(syncResult.workout_sessions || 0)} workout sessions, ${Number(syncResult.progress_photo_remote_assets || 0)} private photo assets reconciled.`;
    });

    const preMarkerSummary = summarizeChecks(checks);
    if (!preMarkerSummary.passed) throw new Error('Acceptance checks did not all pass.');
    const provisional = {
      version:1,
      run_id:runId,
      user_id:user.id,
      started_at:now,
      finished_at:new Date().toISOString(),
      passed:true,
      checks:[...checks]
    };

    await check('cloud_marker', 'Cloud acceptance marker', async () => {
      const current = await pullPreference();
      await upsertPreference(acceptanceMarker(current, user.id, provisional));
      const selected = await pullPreference();
      if (selected?.settings?.zero2fit_acceptance_v1?.run_id !== runId) throw new Error('Acceptance marker did not round-trip through user preferences.');
      return 'Acceptance checkpoint persisted to the authenticated account.';
    });

    const result = {
      version:1,
      run_id:runId,
      user_id:user.id,
      started_at:now,
      finished_at:new Date().toISOString(),
      passed:true,
      checks,
      sync_result:syncResult
    };
    const current = await pullPreference();
    await upsertPreference(acceptanceMarker(current, user.id, result));
    localStorage.setItem(RESULT_KEY, JSON.stringify(result));
    window.dispatchEvent(new CustomEvent('zero2fit:private-acceptance', { detail:result }));
    return result;
  } catch (error) {
    const result = {
      version:1,
      run_id:runId,
      user_id:user.id,
      started_at:now,
      finished_at:new Date().toISOString(),
      passed:false,
      checks,
      error:error.message || String(error)
    };
    localStorage.setItem(RESULT_KEY, JSON.stringify(result));
    error.acceptanceResult = result;
    throw error;
  } finally {
    await cleanupProbe(rows);
    if (preferenceTouched) {
      try { await restorePreference(originalPreference, user.id); } catch {}
    }
  }
}

function readResult() {
  try { return JSON.parse(localStorage.getItem(RESULT_KEY) || 'null'); } catch { return null; }
}

function ensureStylesheet() {
  if (document.querySelector('link[href="./build024.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build024.css';
  document.head.appendChild(link);
}

function ensurePanel() {
  const signedIn = document.getElementById('z8SignedIn');
  if (!signedIn || document.getElementById('z24Acceptance')) return;
  const panel = document.createElement('section');
  panel.id = 'z24Acceptance';
  panel.className = 'z24-acceptance';
  panel.innerHTML = `
    <div class="z24-head">
      <div><span>Private-account acceptance</span><strong>Verify this browser against the live private store</strong></div>
      <span class="z24-badge" id="z24AcceptanceBadge">Not run</span>
    </div>
    <p>This self-test creates uniquely tagged probe rows and one tiny private Storage object, verifies authenticated read/update/delete behavior, cleans the probes, then runs the real Zero2Fit Sync now pipeline. Existing Fuel preferences are restored before the full sync.</p>
    <div class="z24-actions">
      <button class="z4-secondary" type="button" id="z24RunAcceptance">Run acceptance self-test</button>
    </div>
    <div class="z24-checks" id="z24AcceptanceChecks"></div>
    <small id="z24AcceptanceNote">One-browser infrastructure acceptance only. Run the same account on a second browser later to complete cross-browser acceptance.</small>`;
  signedIn.appendChild(panel);
}

function render() {
  ensurePanel();
  const status = remote?.status?.() || { signed_in:false };
  const panel = document.getElementById('z24Acceptance');
  if (!panel) return;
  panel.hidden = !status.signed_in;
  if (!status.signed_in) return;

  const result = readResult();
  const sameUser = result?.user_id && status.user_id && result.user_id === status.user_id;
  const current = sameUser ? result : null;
  const badge = document.getElementById('z24AcceptanceBadge');
  const target = document.getElementById('z24AcceptanceChecks');
  if (badge) {
    badge.textContent = current?.passed ? 'Passed' : current ? 'Needs attention' : 'Not run';
    badge.dataset.state = current?.passed ? 'passed' : current ? 'failed' : 'pending';
  }
  if (!target) return;
  if (!current) {
    target.innerHTML = '<div class="z24-empty">No acceptance run recorded for this account on this browser.</div>';
    return;
  }
  target.innerHTML = `<div class="z24-summary">${acceptanceDisplay(current)}</div>${(current.checks || []).map(check => `
    <div class="z24-check ${check.status === 'pass' ? 'pass' : 'fail'}"><span>${check.status === 'pass' ? '✓' : '!'}</span><div><strong>${escapeHtml(check.label)}</strong><small>${escapeHtml(check.detail)}</small></div></div>`).join('')}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function bind() {
  document.getElementById('z24RunAcceptance')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Running acceptance…';
    const message = document.getElementById('z8Message');
    if (message) message.textContent = 'Running authenticated private-store acceptance. Probe data will be cleaned automatically.';
    try {
      const result = await runAcceptanceSelfTest();
      if (message) message.textContent = `Private-account acceptance passed: ${result.checks.length}/${result.checks.length} checks. Repeat with the same account on a second browser for cross-browser acceptance.`;
    } catch (error) {
      const result = error.acceptanceResult;
      const summary = result ? summarizeChecks(result.checks) : null;
      if (message) message.textContent = `Private-account acceptance failed${summary ? ` after ${summary.passed_count}/${summary.checks.length} checks` : ''}: ${error.message}`;
    } finally {
      button.disabled = false;
      button.textContent = 'Run acceptance self-test';
      render();
    }
  });
  window.addEventListener('zero2fit:remote-session', () => setTimeout(render, 0));
  window.addEventListener('zero2fit:private-acceptance', () => setTimeout(render, 0));
}

function init() {
  if (initialized) return;
  if (!remote || !document.getElementById('z8PrivateSync')) return setTimeout(init, 100);
  initialized = true;
  ensureStylesheet();
  ensurePanel();
  bind();
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();

window.Zero2FitPrivateAcceptance = { runAcceptanceSelfTest, readResult };
