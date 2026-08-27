import assert from 'node:assert/strict';
import { normalizeAlignment, normalizePhotoView, stripPhotoRecord, previousPhotoForView, sessionCoverage, groupPhotoSessions } from '../photo-core.mjs';

assert.equal(normalizePhotoView('side'), 'side');
assert.equal(normalizePhotoView('weird'), 'front');
assert.deepEqual(normalizeAlignment({x:99,y:-99,scale:4,ghostOpacity:2}), {x:25,y:-25,scale:1.6,ghostOpacity:.8});
const photos = [
  { photo_id:'a', session_id:'s1', view:'front', captured_at:'2026-08-01T10:00:00Z', blob:{secret:true} },
  { photo_id:'b', session_id:'s1', view:'side', captured_at:'2026-08-01T10:02:00Z' },
  { photo_id:'c', session_id:'s2', view:'front', captured_at:'2026-08-20T10:00:00Z', thumbnail_blob:{secret:true} }
];
assert.equal(previousPhotoForView(photos, 'front', 's2').photo_id, 'a');
assert.deepEqual(sessionCoverage(photos, 's1').map(x=>x.saved), [true,true,false]);
assert.equal(groupPhotoSessions(photos).length, 2);
const safe = stripPhotoRecord(photos[0]);
assert.equal('blob' in safe, false);
assert.equal(safe.has_blob, true);
console.log('Build 008 photo-core tests passed.');
