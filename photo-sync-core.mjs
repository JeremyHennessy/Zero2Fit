import { normalizeAlignment, normalizePhotoView } from './photo-core.mjs';
import { deterministicUuid } from './workout-sync-core.mjs';

const clean = value => String(value ?? '').trim();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function remoteSessionId(localSessionId) {
  const value = clean(localSessionId);
  if (!value) throw new Error('Local photo session id is required.');
  return deterministicUuid('progress-photo-session', value);
}

export function remotePhotoId(localPhotoId) {
  const value = clean(localPhotoId);
  if (!value) throw new Error('Local photo id is required.');
  return deterministicUuid('progress-photo-asset', value);
}

function assertUserId(userId) {
  const value = clean(userId);
  if (!UUID_RE.test(value)) throw new Error('Authenticated user id must be a UUID.');
  return value;
}

export function remotePhotoPaths(userId, localSessionId, localPhotoId) {
  const user = assertUserId(userId);
  const session = remoteSessionId(localSessionId);
  const photo = remotePhotoId(localPhotoId);
  return {
    full:`${user}/${session}/${photo}.jpg`,
    thumbnail:`${user}/${session}/${photo}-thumb.jpg`
  };
}

export function localViewToRemote(view) {
  const normalized = normalizePhotoView(view);
  return normalized === 'side' ? 'other' : normalized;
}

export function remoteViewToLocal(asset = {}) {
  const explicit = clean(asset?.metadata?.local_view);
  if (explicit) return normalizePhotoView(explicit);
  const value = clean(asset?.view);
  if (value === 'left' || value === 'right' || value === 'other') return 'side';
  return normalizePhotoView(value);
}

export function localPhotoRows(photos = [], userId) {
  const user = assertUserId(userId);
  const sessionGroups = new Map();
  const assets = [];

  for (const raw of photos || []) {
    if (!raw?.photo_id || !raw?.session_id || !raw?.captured_at) continue;
    const localPhotoId = clean(raw.photo_id);
    const localSessionId = clean(raw.session_id);
    const sessionId = remoteSessionId(localSessionId);
    const photoId = remotePhotoId(localPhotoId);
    const paths = remotePhotoPaths(user, localSessionId, localPhotoId);
    const capturedAt = new Date(raw.captured_at).toISOString();
    const alignment = normalizeAlignment(raw.alignment || {});
    const localView = normalizePhotoView(raw.view);
    const prior = sessionGroups.get(localSessionId);
    if (!prior || capturedAt < prior.captured_at) {
      sessionGroups.set(localSessionId, {
        user_id:user,
        session_id:sessionId,
        captured_at:capturedAt,
        notes:null,
        metadata:{
          schema_version:1,
          local_session_id:localSessionId,
          storage_scope:'supabase-private+indexeddb-local'
        }
      });
    }
    assets.push({
      user_id:user,
      photo_id:photoId,
      session_id:sessionId,
      view:localViewToRemote(localView),
      storage_path:paths.full,
      mime_type:raw.mime_type || raw.blob?.type || 'image/jpeg',
      width:Number(raw.width || 0) || null,
      height:Number(raw.height || 0) || null,
      metadata:{
        schema_version:1,
        local_photo_id:localPhotoId,
        local_session_id:localSessionId,
        local_view:localView,
        captured_at:capturedAt,
        alignment,
        thumbnail_storage_path:paths.thumbnail,
        storage_scope:'supabase-private+indexeddb-local'
      }
    });
  }
  return { sessions:[...sessionGroups.values()], assets };
}

export function remoteAssetLocalMetadata(asset = {}, session = {}) {
  const localPhotoId = clean(asset?.metadata?.local_photo_id) || `remote-photo:${clean(asset.photo_id)}`;
  const localSessionId = clean(asset?.metadata?.local_session_id) || clean(session?.metadata?.local_session_id) || `remote-session:${clean(asset.session_id)}`;
  const capturedAt = clean(asset?.metadata?.captured_at) || clean(session?.captured_at) || clean(asset?.created_at) || new Date().toISOString();
  return {
    photo_id:localPhotoId,
    session_id:localSessionId,
    captured_at:new Date(capturedAt).toISOString(),
    view:remoteViewToLocal(asset),
    mime_type:asset.mime_type || 'image/jpeg',
    width:Number(asset.width || 0) || null,
    height:Number(asset.height || 0) || null,
    alignment:normalizeAlignment(asset?.metadata?.alignment || {}),
    storage_scope:'supabase-private+indexeddb-local',
    remote_photo_id:asset.photo_id || null,
    remote_session_id:asset.session_id || null,
    storage_path:asset.storage_path || null,
    thumbnail_storage_path:asset?.metadata?.thumbnail_storage_path || null
  };
}

export function photoDeletionEventInput(photo = {}, deletedAt = new Date().toISOString()) {
  if (!photo?.photo_id || !photo?.session_id) throw new Error('Photo identity is required for a deletion tombstone.');
  const timestamp = new Date(deletedAt).toISOString();
  return {
    metricType:'progress_photo_deleted',
    value:1,
    unit:'flag',
    observedAt:timestamp,
    sourceProvider:'zero2fit',
    sourceDevice:'web_app',
    sourceRecordId:`progress-photo-delete:${clean(photo.photo_id)}`,
    provenanceStatus:'user-entered',
    confidence:'user_tracked',
    metadata:{
      local_photo_id:clean(photo.photo_id),
      local_session_id:clean(photo.session_id),
      local_view:normalizePhotoView(photo.view),
      deleted_at:timestamp
    }
  };
}

export function deletedPhotoIds(events = []) {
  const deleted = new Map();
  for (const event of events || []) {
    if (event?.metric_type !== 'progress_photo_deleted') continue;
    const localId = clean(event?.metadata?.local_photo_id) || clean(event?.source_record_id).replace(/^progress-photo-delete:/, '');
    if (!localId) continue;
    const timestamp = clean(event?.metadata?.deleted_at) || clean(event?.observed_at) || '';
    const prior = deleted.get(localId);
    if (!prior || timestamp > prior) deleted.set(localId, timestamp);
  }
  return deleted;
}

export function assetLocalPhotoId(asset = {}) {
  return clean(asset?.metadata?.local_photo_id) || null;
}

export function activeRemoteAssets(assets = [], deletionEvents = []) {
  const deleted = deletedPhotoIds(deletionEvents);
  return (assets || []).filter(asset => {
    const localId = assetLocalPhotoId(asset);
    return !localId || !deleted.has(localId);
  });
}

export function deletionTargets(userId, deletionEvents = [], assets = []) {
  const user = assertUserId(userId);
  const byLocalId = new Map((assets || []).map(asset => [assetLocalPhotoId(asset), asset]));
  const targets = [];
  for (const [localPhotoId] of deletedPhotoIds(deletionEvents)) {
    const asset = byLocalId.get(localPhotoId);
    const localSessionId = clean(asset?.metadata?.local_session_id) || (deletionEvents.find(event => event?.metadata?.local_photo_id === localPhotoId)?.metadata?.local_session_id || '');
    const paths = localSessionId ? remotePhotoPaths(user, localSessionId, localPhotoId) : null;
    targets.push({
      local_photo_id:localPhotoId,
      remote_photo_id:asset?.photo_id || remotePhotoId(localPhotoId),
      remote_session_id:asset?.session_id || (localSessionId ? remoteSessionId(localSessionId) : null),
      full_path:asset?.storage_path || paths?.full || null,
      thumbnail_path:asset?.metadata?.thumbnail_storage_path || paths?.thumbnail || null
    });
  }
  return targets;
}

export function localPhotosAfterTombstones(photos = [], events = []) {
  const deleted = deletedPhotoIds(events);
  return (photos || []).filter(photo => !deleted.has(clean(photo?.photo_id)));
}
