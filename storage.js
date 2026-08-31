(() => {
  'use strict';

  const DB_NAME = 'zero2fit';
  const DB_VERSION = 4;
  const SNAPSHOT_KEY = 'current';
  let dbPromise = null;

  function hasIndexedDb() { return typeof indexedDB !== 'undefined'; }

  function openDb() {
    if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB is not available in this browser.'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'snapshot_id' });
        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events', { keyPath: 'event_id' });
          store.createIndex('metric_type', 'metric_type', { unique: false });
          store.createIndex('observed_at', 'observed_at', { unique: false });
          store.createIndex('source_provider', 'source_provider', { unique: false });
        }
        if (!db.objectStoreNames.contains('imports')) {
          const store = db.createObjectStore('imports', { keyPath: 'import_id' });
          store.createIndex('imported_at', 'imported_at', { unique: false });
          store.createIndex('source_provider', 'source_provider', { unique: false });
        }
        if (!db.objectStoreNames.contains('device_connections')) db.createObjectStore('device_connections', { keyPath: 'connection_id' });
        if (!db.objectStoreNames.contains('photo_metadata')) {
          const store = db.createObjectStore('photo_metadata', { keyPath: 'photo_id' });
          store.createIndex('captured_at', 'captured_at', { unique: false });
          store.createIndex('view', 'view', { unique: false });
        }
        if (!db.objectStoreNames.contains('progress_photos')) {
          const store = db.createObjectStore('progress_photos', { keyPath: 'photo_id' });
          store.createIndex('captured_at', 'captured_at', { unique: false });
          store.createIndex('view', 'view', { unique: false });
          store.createIndex('session_id', 'session_id', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open Zero2Fit IndexedDB.'));
      request.onblocked = () => reject(new Error('Zero2Fit IndexedDB upgrade was blocked by another open tab. Close other Zero2Fit tabs and reload.'));
    });
    return dbPromise;
  }

  function transactionDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction was aborted.'));
    });
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
    });
  }

  function photoMetadata(record = {}) {
    const { blob, thumbnail_blob, source_blob, ...metadata } = record;
    return {
      ...metadata,
      has_blob: !!blob,
      has_thumbnail: !!thumbnail_blob
    };
  }

  function localJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function saveSnapshot(state) {
    if (!hasIndexedDb()) return { persisted: false, reason: 'indexeddb-unavailable' };
    const db = await openDb();
    const tx = db.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').put({ snapshot_id: SNAPSHOT_KEY, schema_version: Number(state?.version || 1), saved_at: new Date().toISOString(), state });
    await transactionDone(tx);
    return { persisted: true };
  }

  async function loadSnapshot() {
    if (!hasIndexedDb()) return null;
    const db = await openDb();
    const tx = db.transaction('snapshots', 'readonly');
    const done = transactionDone(tx);
    const result = await requestPromise(tx.objectStore('snapshots').get(SNAPSHOT_KEY));
    await done;
    return result?.state || null;
  }

  async function upsertEvents(events) {
    if (!Array.isArray(events) || !events.length) return { written: 0 };
    if (!hasIndexedDb()) return { written: 0, reason: 'indexeddb-unavailable' };
    const db = await openDb();
    const tx = db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');
    events.forEach(event => store.put(event));
    await transactionDone(tx);
    return { written: events.length };
  }

  async function recordImport(record) {
    if (!hasIndexedDb()) return { persisted: false, reason: 'indexeddb-unavailable' };
    const db = await openDb();
    const tx = db.transaction('imports', 'readwrite');
    tx.objectStore('imports').put(record);
    await transactionDone(tx);
    return { persisted: true };
  }

  async function getRecentEvents(limit = 50) {
    if (!hasIndexedDb()) return [];
    const db = await openDb();
    const tx = db.transaction('events', 'readonly');
    const done = transactionDone(tx);
    const all = await requestPromise(tx.objectStore('events').getAll());
    await done;
    return all.sort((a,b) => String(b.observed_at).localeCompare(String(a.observed_at))).slice(0, Math.max(0, limit));
  }

  async function getAllImports() {
    if (!hasIndexedDb()) return [];
    const db = await openDb();
    const tx = db.transaction('imports', 'readonly');
    const done = transactionDone(tx);
    const all = await requestPromise(tx.objectStore('imports').getAll());
    await done;
    return all.sort((a,b) => String(b.imported_at).localeCompare(String(a.imported_at)));
  }

  async function saveProgressPhoto(record) {
    if (!record?.photo_id || !record?.blob) throw new Error('A progress photo requires photo_id and blob.');
    if (!hasIndexedDb()) return { persisted: false, reason: 'indexeddb-unavailable' };
    const db = await openDb();
    const tx = db.transaction(['progress_photos', 'photo_metadata'], 'readwrite');
    tx.objectStore('progress_photos').put(record);
    tx.objectStore('photo_metadata').put(photoMetadata(record));
    await transactionDone(tx);
    return { persisted: true, photo_id: record.photo_id };
  }

  async function getProgressPhotos(limit = 200) {
    if (!hasIndexedDb()) return [];
    const db = await openDb();
    const tx = db.transaction('progress_photos', 'readonly');
    const done = transactionDone(tx);
    const all = await requestPromise(tx.objectStore('progress_photos').getAll());
    await done;
    return all.sort((a,b) => String(b.captured_at).localeCompare(String(a.captured_at))).slice(0, Math.max(0, limit));
  }

  async function getProgressPhoto(photoId) {
    if (!hasIndexedDb()) return null;
    const db = await openDb();
    const tx = db.transaction('progress_photos', 'readonly');
    const done = transactionDone(tx);
    const result = await requestPromise(tx.objectStore('progress_photos').get(photoId));
    await done;
    return result || null;
  }

  async function deleteProgressPhoto(photoId) {
    if (!hasIndexedDb()) return { deleted:false, reason:'indexeddb-unavailable' };
    const db = await openDb();
    const tx = db.transaction(['progress_photos', 'photo_metadata'], 'readwrite');
    tx.objectStore('progress_photos').delete(photoId);
    tx.objectStore('photo_metadata').delete(photoId);
    await transactionDone(tx);
    return { deleted:true };
  }

  async function getAllPhotoMetadata() {
    if (!hasIndexedDb()) return [];
    const db = await openDb();
    const tx = db.transaction('photo_metadata', 'readonly');
    const done = transactionDone(tx);
    const all = await requestPromise(tx.objectStore('photo_metadata').getAll());
    await done;
    return all.sort((a,b) => String(b.captured_at).localeCompare(String(a.captured_at)));
  }

  async function getStats() {
    if (!hasIndexedDb()) return { indexedDb:false, events:0, imports:0, photos:0, snapshot:false, lastSavedAt:null };
    const db = await openDb();
    const tx = db.transaction(['events','imports','snapshots','progress_photos'], 'readonly');
    const done = transactionDone(tx);
    const events = requestPromise(tx.objectStore('events').count());
    const imports = requestPromise(tx.objectStore('imports').count());
    const photos = requestPromise(tx.objectStore('progress_photos').count());
    const snapshot = requestPromise(tx.objectStore('snapshots').get(SNAPSHOT_KEY));
    const [eventCount, importCount, photoCount, snapshotRecord] = await Promise.all([events, imports, photos, snapshot]);
    await done;
    return { indexedDb:true, events:eventCount, imports:importCount, photos:photoCount, snapshot:!!snapshotRecord, lastSavedAt:snapshotRecord?.saved_at || null };
  }

  async function exportBackup(localState) {
    return {
      format: 'zero2fit-backup-v5',
      exported_at: new Date().toISOString(),
      state: localState || null,
      fuel_state: localJson('zero2fit-fuel-v2'),
      normalized_events: await getRecentEvents(Number.MAX_SAFE_INTEGER),
      imports: await getAllImports(),
      photo_metadata: await getAllPhotoMetadata(),
      raw_photos_included: false
    };
  }

  async function clearAll() {
    if (!hasIndexedDb()) return { cleared:false, reason:'indexeddb-unavailable' };
    const db = await openDb();
    const stores = ['snapshots','events','imports','device_connections','photo_metadata','progress_photos'];
    const tx = db.transaction(stores, 'readwrite');
    stores.forEach(name => tx.objectStore(name).clear());
    await transactionDone(tx);
    return { cleared:true };
  }

  function remoteStatus() {
    const config = window.ZERO2FIT_CONFIG || {};
    const configured = Boolean(config.supabaseUrl && (config.supabasePublishableKey || config.supabaseAnonKey));
    const remote = window.Zero2FitRemoteSync?.status?.();
    return {
      configured,
      active:Boolean(remote?.signed_in),
      mode: remote?.signed_in ? 'authenticated-private-sync' : (configured ? 'configured-sign-in-required' : 'not-configured'),
      note: remote?.signed_in
        ? 'Authenticated Supabase sync is active with per-user RLS.'
        : (configured ? 'Private storage is configured. Sign in on Devices to sync.' : 'Local structured storage is active. No remote project is configured.')
    };
  }

  window.Zero2FitStorage = {
    DB_NAME, DB_VERSION, openDb, saveSnapshot, loadSnapshot, upsertEvents, recordImport,
    getRecentEvents, getAllImports, getStats, exportBackup, clearAll, remoteStatus,
    saveProgressPhoto, getProgressPhotos, getProgressPhoto, deleteProgressPhoto, getAllPhotoMetadata
  };
})();