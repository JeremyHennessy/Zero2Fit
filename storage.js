(() => {
  'use strict';

  const DB_NAME = 'zero2fit';
  const DB_VERSION = 2;
  const SNAPSHOT_KEY = 'current';
  let dbPromise = null;

  function hasIndexedDb() {
    return typeof indexedDB !== 'undefined';
  }

  function openDb() {
    if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB is not available in this browser.'));
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'snapshot_id' });
        }

        if (!db.objectStoreNames.contains('events')) {
          const events = db.createObjectStore('events', { keyPath: 'event_id' });
          events.createIndex('metric_type', 'metric_type', { unique: false });
          events.createIndex('observed_at', 'observed_at', { unique: false });
          events.createIndex('source_provider', 'source_provider', { unique: false });
        }

        if (!db.objectStoreNames.contains('imports')) {
          const imports = db.createObjectStore('imports', { keyPath: 'import_id' });
          imports.createIndex('imported_at', 'imported_at', { unique: false });
          imports.createIndex('source_provider', 'source_provider', { unique: false });
        }

        if (!db.objectStoreNames.contains('device_connections')) {
          db.createObjectStore('device_connections', { keyPath: 'connection_id' });
        }

        if (!db.objectStoreNames.contains('photo_metadata')) {
          const photos = db.createObjectStore('photo_metadata', { keyPath: 'photo_id' });
          photos.createIndex('captured_at', 'captured_at', { unique: false });
          photos.createIndex('view', 'view', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open Zero2Fit IndexedDB.'));
      request.onblocked = () => reject(new Error('Zero2Fit IndexedDB upgrade was blocked by another open tab.'));
    });

    return dbPromise;
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
    });
  }

  async function saveSnapshot(state) {
    if (!hasIndexedDb()) return { persisted: false, reason: 'indexeddb-unavailable' };
    const db = await openDb();
    const tx = db.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').put({
      snapshot_id: SNAPSHOT_KEY,
      schema_version: Number(state?.version || 1),
      saved_at: new Date().toISOString(),
      state
    });
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

  async function recordImport(importRecord) {
    if (!hasIndexedDb()) return { persisted: false, reason: 'indexeddb-unavailable' };
    const db = await openDb();
    const tx = db.transaction('imports', 'readwrite');
    tx.objectStore('imports').put(importRecord);
    await transactionDone(tx);
    return { persisted: true };
  }

  async function getRecentEvents(limit = 50) {
    if (!hasIndexedDb()) return [];
    const db = await openDb();
    const tx = db.transaction('events', 'readonly');
    const done = transactionDone(tx);
    const store = tx.objectStore('events');
    const all = await requestPromise(store.getAll());
    await done;
    return all
      .sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at)))
      .slice(0, Math.max(0, limit));
  }

  async function getStats() {
    if (!hasIndexedDb()) {
      return { indexedDb: false, events: 0, imports: 0, snapshot: false };
    }
    const db = await openDb();
    const tx = db.transaction(['events', 'imports', 'snapshots'], 'readonly');
    const done = transactionDone(tx);
    const eventsRequest = requestPromise(tx.objectStore('events').count());
    const importsRequest = requestPromise(tx.objectStore('imports').count());
    const snapshotRequest = requestPromise(tx.objectStore('snapshots').get(SNAPSHOT_KEY));
    const [events, imports, snapshot] = await Promise.all([eventsRequest, importsRequest, snapshotRequest]);
    await done;
    return { indexedDb: true, events, imports, snapshot: !!snapshot, lastSavedAt: snapshot?.saved_at || null };
  }

  async function clearAll() {
    if (!hasIndexedDb()) return { cleared: false, reason: 'indexeddb-unavailable' };
    const db = await openDb();
    const stores = ['snapshots', 'events', 'imports', 'device_connections', 'photo_metadata'];
    const tx = db.transaction(stores, 'readwrite');
    stores.forEach(name => tx.objectStore(name).clear());
    await transactionDone(tx);
    return { cleared: true };
  }

  async function exportBackup(localState) {
    const events = await getRecentEvents(Number.MAX_SAFE_INTEGER);
    const db = hasIndexedDb() ? await openDb() : null;
    let imports = [];
    if (db) {
      const tx = db.transaction('imports', 'readonly');
      const done = transactionDone(tx);
      imports = await requestPromise(tx.objectStore('imports').getAll());
      await done;
    }
    return {
      format: 'zero2fit-backup-v2',
      exported_at: new Date().toISOString(),
      state: localState || null,
      normalized_events: events,
      imports
    };
  }

  function transactionDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction was aborted.'));
    });
  }

  function remoteStatus() {
    const config = window.ZERO2FIT_CONFIG || {};
    const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
    return {
      configured,
      active: false,
      mode: configured ? 'credentials-present-auth-not-enabled' : 'not-configured',
      note: configured
        ? 'Supabase project values are present, but remote sync stays disabled until authenticated RLS access is wired.'
        : 'Local IndexedDB is active. No Supabase project credentials are embedded in this build.'
    };
  }

  window.Zero2FitStorage = {
    DB_NAME,
    DB_VERSION,
    openDb,
    saveSnapshot,
    loadSnapshot,
    upsertEvents,
    recordImport,
    getRecentEvents,
    getStats,
    exportBackup,
    clearAll,
    remoteStatus
  };
})();
