export const PHOTO_VIEWS = ['front', 'side', 'back'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function normalizePhotoView(view) {
  return PHOTO_VIEWS.includes(view) ? view : 'front';
}

export function normalizeAlignment(value = {}) {
  return {
    x: clamp(Number(value.x) || 0, -25, 25),
    y: clamp(Number(value.y) || 0, -25, 25),
    scale: clamp(Number(value.scale) || 1, 0.75, 1.6),
    ghostOpacity: clamp(Number(value.ghostOpacity) || 0.35, 0, 0.8)
  };
}

export function stripPhotoRecord(record = {}) {
  const { blob, thumbnail_blob, source_blob, ...safe } = record;
  return {
    ...safe,
    alignment: normalizeAlignment(record.alignment),
    has_blob: !!blob,
    has_thumbnail: !!thumbnail_blob
  };
}

export function previousPhotoForView(photos = [], view, sessionId) {
  const normalized = normalizePhotoView(view);
  return photos
    .filter(photo => photo?.view === normalized && photo?.session_id !== sessionId)
    .sort((a, b) => String(b.captured_at).localeCompare(String(a.captured_at)))[0] || null;
}

export function sessionCoverage(photos = [], sessionId) {
  const existing = new Set(photos.filter(photo => photo?.session_id === sessionId).map(photo => photo.view));
  return PHOTO_VIEWS.map(view => ({ view, saved: existing.has(view) }));
}

export function groupPhotoSessions(photos = []) {
  const groups = new Map();
  for (const photo of photos) {
    if (!photo?.session_id) continue;
    if (!groups.has(photo.session_id)) groups.set(photo.session_id, { sessionId: photo.session_id, capturedAt: photo.captured_at, photos: [] });
    const group = groups.get(photo.session_id);
    group.photos.push(photo);
    if (String(photo.captured_at) > String(group.capturedAt)) group.capturedAt = photo.captured_at;
  }
  return [...groups.values()]
    .map(group => ({ ...group, views: sessionCoverage(group.photos, group.sessionId).filter(item => item.saved).map(item => item.view) }))
    .sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));
}
