import {
  localPhotoRows,
  remoteAssetLocalMetadata,
  photoDeletionEventInput,
  deletedPhotoIds,
  activeRemoteAssets,
  deletionTargets,
  localPhotosAfterTombstones
} from './photo-sync-core.mjs';

const BUCKET = 'progress-photos';
const LAST_SYNC_KEY = 'zero2fit-last-private-sync';
const config = window.ZERO2FIT_CONFIG || {};
const remote = window.Zero2FitRemoteSync;
const storage = window.Zero2FitStorage;
const ingestion = window.Zero2FitIngestion;
const apiBase = String(config.supabaseUrl || '').replace(/\/+$/, '');
const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey || '';
let initialized = false;
let originalSyncNow = null;
let originalDeleteProgressPhoto = null;

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

async function storageUpload(path, blob) {
  if (!(blob instanceof Blob)) throw new Error('A local photo blob is required for private upload.');
  const session = currentSession();
  const response = await fetch(`${apiBase}/storage/v1/object/${BUCKET}/${encodedPath(path)}`, {
    method:'POST',
    headers:{
      apikey:publishableKey,
      Authorization:`Bearer ${session.access_token}`,
      'Content-Type':blob.type || 'image/jpeg',
      'cache-control':'3600',
      'x-upsert':'true'
    },
    body:blob
  });
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(String(payload?.message || payload?.error || `Photo upload failed: ${response.status}`));
  return payload;
}

async function storageDownload(path) {
  const session = currentSession();
  const response = await fetch(`${apiBase}/storage/v1/object/authenticated/${BUCKET}/${encodedPath(path)}`, {
    headers:{ apikey:publishableKey, Authorization:`Bearer ${session.access_token}` }
  });
  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new Error(String(payload?.message || payload?.error || `Photo download failed: ${response.status}`));
  }
  return await response.blob();
}

async function storageRemove(paths = []) {
  const unique = [...new Set((paths || []).filter(Boolean))];
  if (!unique.length) return [];
  const session = currentSession();
  const response = await fetch(`${apiBase}/storage/v1/object/${BUCKET}`, {
    method:'DELETE',
    headers:{
      apikey:publishableKey,
      Authorization:`Bearer ${session.access_token}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({ prefixes:unique })
  });
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(String(payload?.message || payload?.error || `Photo delete failed: ${response.status}`));
  return payload || [];
}

async function pullRemotePhotoRows() {
  const [sessions, assets] = await Promise.all([
    dbRest('progress_photo_sessions?select=user_id,session_id,captured_at,notes,metadata,created_at&order=captured_at.asc&limit=5000'),
    dbRest('progress_photo_assets?select=user_id,photo_id,session_id,view,storage_path,mime_type,width,height,metadata,created_at&order=created_at.asc&limit=15000')
  ]);
  return { sessions:sessions || [], assets:assets || [] };
}

async function upsertPhotoMetadata(rows = {}) {
  if (rows.sessions?.length) {
    await dbRest('progress_photo_sessions?on_conflict=user_id,session_id', {
      method:'POST',
      body:rows.sessions,
      headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
    });
  }
  if (rows.assets?.length) {
    await dbRest('progress_photo_assets?on_conflict=user_id,photo_id', {
      method:'POST',
      body:rows.assets,
      headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
    });
  }
}

async function recordDeletion(photo) {
  if (!photo?.photo_id || !photo?.session_id || !ingestion?.makeEvent || !storage?.upsertEvents) return false;
  const event = ingestion.makeEvent(photoDeletionEventInput(photo));
  await storage.upsertEvents([event]);
  return true;
}

function wrapLocalDelete() {
  if (!storage?.deleteProgressPhoto || storage.deleteProgressPhoto.__z22Wrapped) return;
  originalDeleteProgressPhoto = storage.deleteProgressPhoto.bind(storage);
  const wrapped = async photoId => {
    const photo = await storage.getProgressPhoto?.(photoId).catch(() => null);
    if (photo) await recordDeletion(photo);
    return await originalDeleteProgressPhoto(photoId);
  };
  wrapped.__z22Wrapped = true;
  storage.deleteProgressPhoto = wrapped;
}

async function pruneTombstonedLocalPhotos(events) {
  const current = await storage.getProgressPhotos(2000);
  const active = localPhotosAfterTombstones(current, events);
  const activeIds = new Set(active.map(photo => photo.photo_id));
  let removed = 0;
  for (const photo of current) {
    if (activeIds.has(photo.photo_id)) continue;
    await originalDeleteProgressPhoto?.(photo.photo_id);
    removed += 1;
  }
  return { photos:active, removed };
}

async function applyRemoteDeletions(userId, events, remoteRows) {
  const targets = deletionTargets(userId, events, remoteRows.assets);
  if (!targets.length) return { deleted_assets:0, deleted_sessions:0 };
  let deletedAssets = 0;
  for (const target of targets) {
    await storageRemove([target.full_path, target.thumbnail_path]);
    await dbRest(`progress_photo_assets?photo_id=eq.${encodeURIComponent(target.remote_photo_id)}`, {
      method:'DELETE', headers:{ Prefer:'return=minimal' }
    });
    deletedAssets += 1;
  }

  const afterAssets = (await pullRemotePhotoRows()).assets;
  const remainingSessions = new Set(afterAssets.map(asset => asset.session_id));
  const sessionIds = [...new Set(targets.map(target => target.remote_session_id).filter(Boolean))];
  let deletedSessions = 0;
  for (const sessionId of sessionIds) {
    if (remainingSessions.has(sessionId)) continue;
    await dbRest(`progress_photo_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
      method:'DELETE', headers:{ Prefer:'return=minimal' }
    });
    deletedSessions += 1;
  }
  return { deleted_assets:deletedAssets, deleted_sessions:deletedSessions };
}

async function uploadLocalPhotos(userId, photos, deletionEvents, remoteRows) {
  const deleted = deletedPhotoIds(deletionEvents);
  const remoteByLocal = new Map(remoteRows.assets.map(asset => [asset?.metadata?.local_photo_id, asset]));
  const active = photos.filter(photo => !deleted.has(photo.photo_id));
  const rows = localPhotoRows(active, userId);
  let uploaded = 0;
  for (const photo of active) {
    const asset = rows.assets.find(row => row.metadata.local_photo_id === photo.photo_id);
    if (!asset) continue;
    const prior = remoteByLocal.get(photo.photo_id);
    if (!prior || prior.storage_path !== asset.storage_path) {
      await storageUpload(asset.storage_path, photo.blob);
      if (photo.thumbnail_blob) await storageUpload(asset.metadata.thumbnail_storage_path, photo.thumbnail_blob);
      uploaded += 1;
    }
  }
  await upsertPhotoMetadata(rows);

  for (const photo of active) {
    if (photo.storage_scope === 'supabase-private+indexeddb-local') continue;
    await storage.saveProgressPhoto({ ...photo, storage_scope:'supabase-private+indexeddb-local' });
  }
  return { uploaded, rows };
}

async function hydrateRemotePhotos(remoteRows, deletionEvents) {
  const activeAssets = activeRemoteAssets(remoteRows.assets, deletionEvents);
  const sessions = new Map(remoteRows.sessions.map(row => [row.session_id, row]));
  const local = await storage.getProgressPhotos(2000);
  const localIds = new Set(local.map(photo => photo.photo_id));
  let downloaded = 0;

  for (const asset of activeAssets) {
    const metadata = remoteAssetLocalMetadata(asset, sessions.get(asset.session_id) || {});
    if (localIds.has(metadata.photo_id)) continue;
    const blob = await storageDownload(asset.storage_path);
    let thumbnail = null;
    if (metadata.thumbnail_storage_path) {
      try { thumbnail = await storageDownload(metadata.thumbnail_storage_path); } catch {}
    }
    await storage.saveProgressPhoto({
      ...metadata,
      blob,
      thumbnail_blob:thumbnail,
      storage_scope:'supabase-private+indexeddb-local'
    });
    localIds.add(metadata.photo_id);
    downloaded += 1;
  }
  return { downloaded, remote_assets:activeAssets.length };
}

async function syncPhotoContinuity() {
  if (!storage?.getProgressPhotos) throw new Error('Local progress-photo storage is unavailable.');
  const user = await remote?.getUser?.();
  if (!user?.id) throw new Error('Sign in before syncing progress photos.');
  const events = await storage.getRecentEvents(50000);
  const localResult = await pruneTombstonedLocalPhotos(events);
  let remoteRows = await pullRemotePhotoRows();
  const deleted = await applyRemoteDeletions(user.id, events, remoteRows);
  remoteRows = await pullRemotePhotoRows();
  const uploaded = await uploadLocalPhotos(user.id, localResult.photos, events, remoteRows);
  remoteRows = await pullRemotePhotoRows();
  const hydrated = await hydrateRemotePhotos(remoteRows, events);
  return {
    progress_photo_local:localResult.photos.length,
    progress_photo_uploaded:uploaded.uploaded,
    progress_photo_downloaded:hydrated.downloaded,
    progress_photo_remote_assets:hydrated.remote_assets,
    progress_photo_deleted_assets:deleted.deleted_assets,
    progress_photo_deleted_sessions:deleted.deleted_sessions
  };
}

function wrapSyncNow() {
  if (!remote?.syncNow || remote.syncNow.__z22Wrapped) return;
  originalSyncNow = remote.syncNow.bind(remote);
  const wrapped = async (...args) => {
    const base = await originalSyncNow(...args);
    const photos = await syncPhotoContinuity();
    const result = { ...base, ...photos, synced_at:new Date().toISOString() };
    localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(result));
    window.dispatchEvent(new CustomEvent('zero2fit:remote-sync', { detail:result }));
    return result;
  };
  wrapped.__z22Wrapped = true;
  remote.syncNow = wrapped;
}

function ensureStylesheet() {
  if (document.querySelector('link[href="./build022.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build022.css';
  document.head.appendChild(link);
}

function ensureStatus() {
  const module = document.querySelector('.z8-photo-module');
  if (!module) return;
  const header = module.querySelector('.z8-photo-header');
  if (header && !document.getElementById('z22PhotoSyncStatus')) {
    const status = document.createElement('div');
    status.id = 'z22PhotoSyncStatus';
    status.className = 'z22-photo-sync';
    status.innerHTML = '<span class="z22-sync-dot"></span><div><strong>Private photo continuity</strong><small id="z22PhotoSyncText">Checking private sync…</small></div>';
    header.after(status);
  }
}

function renderStatus() {
  ensureStatus();
  const status = remote?.status?.() || { configured:false, signed_in:false };
  const badge = document.querySelector('.z8-private-badge');
  const strip = document.getElementById('z22PhotoSyncStatus');
  const text = document.getElementById('z22PhotoSyncText');
  const intro = document.querySelector('.z8-photo-header p');
  if (intro) intro.textContent = 'Capture front, side and back against the same guide. Raw images stay out of JSON backups; authenticated private sync can carry them across your own browsers.';
  if (strip) strip.dataset.state = status.signed_in ? 'signed-in' : status.configured ? 'ready' : 'local';
  if (status.signed_in) {
    if (badge) badge.textContent = 'Local + private';
    const last = status.last_sync;
    if (text) text.textContent = last?.synced_at && Number.isFinite(Number(last.progress_photo_remote_assets))
      ? `Included with Sync now · ${Number(last.progress_photo_remote_assets || 0)} private assets reconciled.`
      : 'Included with Sync now · raw photos use your private Supabase bucket and remain excluded from JSON backup.';
  } else if (status.configured) {
    if (badge) badge.textContent = 'Local only';
    if (text) text.textContent = 'Raw photos remain in this browser until you sign in under Data and use Sync now.';
  } else {
    if (badge) badge.textContent = 'Local only';
    if (text) text.textContent = 'Raw photos remain in this browser. Private remote sync is not configured.';
  }
}

function bindStatus() {
  window.addEventListener('zero2fit:remote-session', () => setTimeout(renderStatus, 0));
  window.addEventListener('zero2fit:remote-sync', event => {
    setTimeout(() => {
      renderStatus();
      const detail = event.detail || {};
      const message = document.getElementById('z8Message');
      if (message && Number.isFinite(Number(detail.progress_photo_remote_assets))) {
        message.textContent = `Private sync complete: ${Number(detail.workout_sessions || 0)} workouts, ${Number(detail.fuel_history_entries || 0)} Fuel entries and ${Number(detail.progress_photo_remote_assets || 0)} private photo assets reconciled.`;
      }
    }, 30);
  });
  window.addEventListener('focus', renderStatus);
}

function init() {
  if (initialized) return;
  if (!remote || !storage?.getProgressPhotos || !document.querySelector('.z8-photo-module')) return setTimeout(init, 100);
  initialized = true;
  ensureStylesheet();
  document.body.classList.add('build022-photo-sync');
  wrapLocalDelete();
  wrapSyncNow();
  bindStatus();
  renderStatus();
  setTimeout(renderStatus, 700);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();

window.Zero2FitPhotoSync = { syncPhotoContinuity, recordDeletion, pullRemotePhotoRows };
