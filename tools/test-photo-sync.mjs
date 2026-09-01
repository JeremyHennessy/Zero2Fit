import assert from 'node:assert/strict';
import {
  remoteSessionId,
  remotePhotoId,
  remotePhotoPaths,
  localViewToRemote,
  remoteViewToLocal,
  localPhotoRows,
  remoteAssetLocalMetadata,
  photoDeletionEventInput,
  deletedPhotoIds,
  activeRemoteAssets,
  deletionTargets,
  localPhotosAfterTombstones
} from '../photo-sync-core.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const localSessionId = 'session:2026-08-31T20:00:00.000Z:abc123';
const localPhotoId = 'photo:2026-08-31T20:00:05.000Z:def456';
const photo = {
  photo_id:localPhotoId,
  session_id:localSessionId,
  captured_at:'2026-08-31T20:00:05.000Z',
  view:'side',
  mime_type:'image/jpeg',
  width:1200,
  height:1600,
  alignment:{ x:2, y:-1, scale:1.04, ghostOpacity:.32 }
};

assert.equal(remoteSessionId(localSessionId), remoteSessionId(localSessionId), 'remote session UUID must be stable');
assert.equal(remotePhotoId(localPhotoId), remotePhotoId(localPhotoId), 'remote photo UUID must be stable');
assert.notEqual(remotePhotoId(localPhotoId), remoteSessionId(localSessionId), 'session and photo namespaces must differ');

const paths = remotePhotoPaths(userId, localSessionId, localPhotoId);
assert.equal(paths.full.startsWith(`${userId}/`), true, 'storage path must begin with authenticated user folder');
assert.equal(paths.thumbnail.startsWith(`${userId}/`), true, 'thumbnail path must begin with authenticated user folder');
assert.equal(paths.full.includes('..'), false, 'storage path must not permit traversal');
assert.equal(paths.full.includes('session:'), false, 'raw local ids must not leak into storage paths');
assert.equal(localViewToRemote('side'), 'other', 'local side view must satisfy existing remote view constraint');
assert.equal(remoteViewToLocal({ view:'other', metadata:{local_view:'side'} }), 'side');

const rows = localPhotoRows([photo], userId);
assert.equal(rows.sessions.length, 1);
assert.equal(rows.assets.length, 1);
assert.equal(rows.assets[0].view, 'other');
assert.equal(rows.assets[0].metadata.local_view, 'side');
assert.equal(rows.assets[0].storage_path, paths.full);
assert.equal(rows.assets[0].metadata.thumbnail_storage_path, paths.thumbnail);

const restored = remoteAssetLocalMetadata(rows.assets[0], rows.sessions[0]);
assert.equal(restored.photo_id, localPhotoId);
assert.equal(restored.session_id, localSessionId);
assert.equal(restored.view, 'side');
assert.deepEqual(restored.alignment, { x:2, y:-1, scale:1.04, ghostOpacity:.32 });

const deletionInput = photoDeletionEventInput(photo, '2026-08-31T21:00:00.000Z');
const deletionEvent = {
  event_id:'delete-event',
  metric_type:deletionInput.metricType,
  value:deletionInput.value,
  unit:deletionInput.unit,
  observed_at:deletionInput.observedAt,
  source_record_id:deletionInput.sourceRecordId,
  metadata:deletionInput.metadata
};
assert.equal(deletedPhotoIds([deletionEvent]).has(localPhotoId), true);
assert.equal(activeRemoteAssets(rows.assets, [deletionEvent]).length, 0, 'tombstoned remote photo must not hydrate again');
assert.equal(localPhotosAfterTombstones([photo], [deletionEvent]).length, 0, 'tombstoned local cache must be pruned before upload');

const targets = deletionTargets(userId, [deletionEvent], rows.assets);
assert.equal(targets.length, 1);
assert.equal(targets[0].remote_photo_id, rows.assets[0].photo_id);
assert.equal(targets[0].full_path, paths.full);
assert.equal(targets[0].thumbnail_path, paths.thumbnail);

assert.throws(() => remotePhotoPaths('../bad-user', localSessionId, localPhotoId), /UUID/, 'unsafe user folders must be rejected');

console.log('Build 022 photo private-sync contract tests passed.');
