(() => {
  'use strict';

  const SESSION_KEY = 'zero2fit-supabase-session-v1';
  const config = window.ZERO2FIT_CONFIG || {};
  const storage = window.Zero2FitStorage;
  let corePromise = null;

  const apiBase = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey || '';

  function configured() {
    return /^https:\/\//.test(apiBase) && Boolean(publishableKey);
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    if (!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('zero2fit:remote-session', { detail: { signedIn: Boolean(session?.access_token) } }));
  }

  function sessionExpired(session) {
    const expiresAt = Number(session?.expires_at || 0);
    return !expiresAt || (expiresAt * 1000) < Date.now() + 30000;
  }

  async function core() {
    corePromise ||= import('./remote-sync-core.mjs');
    return corePromise;
  }

  async function parseResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  async function request(path, { method = 'GET', body, accessToken, headers = {} } = {}) {
    if (!configured()) throw new Error('Private sync is not configured.');
    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        apikey: publishableKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || `${response.status} ${response.statusText}`;
      throw new Error(String(message));
    }
    return payload;
  }

  async function signUp(email, password) {
    const payload = await request('/auth/v1/signup', { method:'POST', body:{ email, password } });
    if (payload?.access_token) writeSession(payload);
    return payload;
  }

  async function signIn(email, password) {
    const payload = await request('/auth/v1/token?grant_type=password', { method:'POST', body:{ email, password } });
    if (!payload?.access_token || !payload?.user?.id) throw new Error('Supabase did not return an authenticated session.');
    writeSession(payload);
    return payload;
  }

  async function refreshSession(session = readSession()) {
    if (!session?.refresh_token) return null;
    const payload = await request('/auth/v1/token?grant_type=refresh_token', {
      method:'POST',
      body:{ refresh_token:session.refresh_token }
    });
    if (!payload?.access_token) throw new Error('Could not refresh the private-sync session.');
    writeSession(payload);
    return payload;
  }

  async function authenticatedSession() {
    let session = readSession();
    if (!session?.access_token) return null;
    if (sessionExpired(session)) {
      try { session = await refreshSession(session); }
      catch {
        writeSession(null);
        return null;
      }
    }
    return session;
  }

  async function signOut() {
    const session = await authenticatedSession();
    if (session?.access_token) {
      try { await request('/auth/v1/logout', { method:'POST', accessToken:session.access_token }); } catch {}
    }
    writeSession(null);
  }

  async function rest(path, options = {}) {
    const session = await authenticatedSession();
    if (!session?.access_token) throw new Error('Sign in to private sync first.');
    return request(`/rest/v1/${path}`, { ...options, accessToken:session.access_token });
  }

  async function getUser() {
    const session = await authenticatedSession();
    if (!session?.access_token) return null;
    const user = await request('/auth/v1/user', { accessToken:session.access_token });
    if (!user?.id) return null;
    if (!session.user || session.user.id !== user.id) writeSession({ ...session, user });
    return user;
  }

  async function pullVerifications() {
    return await rest('device_source_verifications?select=verification_id,provider,source_bundle_id,source_name,metric_types,verified_at,evidence&order=verified_at.desc') || [];
  }

  async function pullSourceObservations() {
    return await rest('device_source_observations?select=source_bundle_id,source_name,metric_type,sample_count,first_observed_at,last_observed_at,last_sync_at,metadata&order=source_name.asc,metric_type.asc') || [];
  }

  async function verifySource({ provider, source_bundle_id, source_name = null, metric_types = [], evidence = {} }) {
    const user = await getUser();
    if (!user?.id) throw new Error('Sign in before verifying a device source.');
    const verification_id = crypto.randomUUID();
    const body = [{
      user_id:user.id,
      verification_id,
      provider,
      source_bundle_id,
      source_name,
      metric_types,
      verified_at:new Date().toISOString(),
      evidence
    }];
    await rest('device_source_verifications?on_conflict=user_id,provider,source_bundle_id', {
      method:'POST',
      body,
      headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
    });
    return verification_id;
  }

  async function pushEvents(events = []) {
    const user = await getUser();
    if (!user?.id) throw new Error('Sign in before syncing device events.');
    const contract = await core();
    let written = 0;
    for (let offset = 0; offset < events.length; offset += 250) {
      const rows = events.slice(offset, offset + 250).map(event => contract.eventToRemoteRow(event, user.id));
      if (!rows.length) continue;
      await rest('normalized_events?on_conflict=user_id,event_id', {
        method:'POST',
        body:rows,
        headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
      });
      written += rows.length;
    }
    return { written };
  }

  async function pullEvents(limit = 10000) {
    const safeLimit = Math.max(1, Math.min(50000, Number(limit) || 10000));
    const rows = await rest(`normalized_events?select=event_id,metric_type,numeric_value,text_value,unit,observed_at,end_at,source_provider,source_device,source_record_id,imported_at,provenance_status,confidence,metadata&order=observed_at.desc&limit=${safeLimit}`) || [];
    const contract = await core();
    const verifications = await pullVerifications();
    return contract.applySourceVerifications(rows.map(contract.remoteRowToEvent), verifications);
  }

  async function syncNow() {
    if (!storage) throw new Error('Local structured storage is unavailable.');
    const user = await getUser();
    if (!user?.id) throw new Error('Sign in to private sync first.');
    const localEvents = await storage.getRecentEvents(50000);
    const pushed = await pushEvents(localEvents);
    const remoteEvents = await pullEvents(50000);
    await storage.upsertEvents(remoteEvents);
    const stats = await storage.getStats();
    const result = {
      user_id:user.id,
      pushed:pushed.written,
      pulled:remoteEvents.length,
      local_events:stats.events,
      synced_at:new Date().toISOString()
    };
    localStorage.setItem('zero2fit-last-private-sync', JSON.stringify(result));
    window.dispatchEvent(new CustomEvent('zero2fit:remote-sync', { detail:result }));
    return result;
  }

  function status() {
    const session = readSession();
    let lastSync = null;
    try { lastSync = JSON.parse(localStorage.getItem('zero2fit-last-private-sync') || 'null'); } catch {}
    return {
      configured:configured(),
      signed_in:Boolean(session?.access_token),
      user_id:session?.user?.id || null,
      email:session?.user?.email || null,
      last_sync:lastSync
    };
  }

  window.Zero2FitRemoteSync = {
    configured, status, readSession, signUp, signIn, signOut, getUser, syncNow,
    pushEvents, pullEvents, pullVerifications, pullSourceObservations, verifySource
  };
})();
