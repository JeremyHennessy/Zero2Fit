(() => {
  'use strict';

  const remote = window.Zero2FitRemoteSync;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function ensurePanel() {
    const page = document.getElementById('page-data');
    if (!page || document.getElementById('z8PrivateSync')) return;
    const panel = document.createElement('article');
    panel.id = 'z8PrivateSync';
    panel.className = 'card';
    panel.innerHTML = `
      <div class="card-heading">
        <div><div class="eyebrow">Private sync</div><h2>HealthKit bridge + Supabase</h2></div>
        <span class="small-tag" id="z8RemoteStatus">Checking</span>
      </div>
      <p class="muted">Events are private per authenticated user. HealthKit source names remain evidence only until you explicitly verify the exact source bundle. Unverified device data never awards permanent Fitness XP.</p>
      <div id="z8SignedOut">
        <form id="z8AuthForm" class="meal-form">
          <input id="z8Email" type="email" autocomplete="email" placeholder="Private sync email" required>
          <input id="z8Password" type="password" autocomplete="current-password" placeholder="Password" minlength="6" required>
          <div class="z4-hero-actions">
            <button class="primary-button" type="submit">Sign in</button>
            <button class="z4-secondary" type="button" id="z8SignUp">Create account</button>
          </div>
        </form>
      </div>
      <div id="z8SignedIn" hidden>
        <p class="muted compact" id="z8Account"></p>
        <div class="z4-hero-actions">
          <button class="primary-button" type="button" id="z8SyncNow">Sync now</button>
          <button class="z4-secondary" type="button" id="z8SignOut">Sign out</button>
        </div>
        <p class="muted compact" id="z8LastSync">No private sync completed yet.</p>
      </div>
      <div id="z8Sources" hidden>
        <div class="eyebrow">Observed Apple Health sources</div>
        <h2>Verify source mapping</h2>
        <p class="muted compact">The iPhone bridge records the exact HealthKit bundle ID and source name. Only verify a source after it matches what you see for Zepp or RENPHO on the phone.</p>
        <div id="z8SourceRows" class="data-table"></div>
      </div>
      <p class="muted compact" id="z8Message"></p>`;
    const table = page.querySelector('.data-table-card');
    if (table) table.before(panel);
    else page.appendChild(panel);
  }

  function setMessage(message) {
    const node = document.getElementById('z8Message');
    if (node) node.textContent = message || '';
  }

  function setBusy(busy) {
    document.querySelectorAll('#z8PrivateSync button,#z8PrivateSync input').forEach(node => { node.disabled = Boolean(busy); });
  }

  async function refresh() {
    if (!remote) return;
    const status = remote.status();
    const signedOut = document.getElementById('z8SignedOut');
    const signedIn = document.getElementById('z8SignedIn');
    const sourceSection = document.getElementById('z8Sources');
    const statusTag = document.getElementById('z8RemoteStatus');
    if (statusTag) statusTag.textContent = status.signed_in ? 'Authenticated' : (status.configured ? 'Ready' : 'Not configured');
    if (signedOut) signedOut.hidden = status.signed_in;
    if (signedIn) signedIn.hidden = !status.signed_in;
    if (sourceSection) sourceSection.hidden = !status.signed_in;
    if (!status.signed_in) return;

    const account = document.getElementById('z8Account');
    if (account) account.textContent = status.email ? `Signed in as ${status.email}` : 'Signed in to the private Zero2Fit store.';
    const last = document.getElementById('z8LastSync');
    if (last && status.last_sync?.synced_at) {
      last.textContent = `Last sync ${new Date(status.last_sync.synced_at).toLocaleString()} · ${status.last_sync.pulled} remote events reconciled`;
    }

    try {
      const [observations, verifications] = await Promise.all([remote.pullSourceObservations(), remote.pullVerifications()]);
      renderSources(observations, verifications);
    } catch (error) {
      setMessage(`Source mapping could not be loaded: ${error.message}`);
    }
  }

  function renderSources(observations, verifications) {
    const target = document.getElementById('z8SourceRows');
    if (!target) return;
    const grouped = new Map();
    for (const row of observations || []) {
      const key = row.source_bundle_id;
      if (!grouped.has(key)) grouped.set(key, { bundle:key, name:row.source_name, rows:[] });
      grouped.get(key).rows.push(row);
    }
    if (!grouped.size) {
      target.innerHTML = '<div class="data-row"><span>No source bundles captured yet. Run the iPhone bridge first.</span></div>';
      return;
    }

    target.innerHTML = [...grouped.values()].map(group => {
      const verification = (verifications || []).find(item => item.source_bundle_id === group.bundle);
      const metrics = group.rows.map(row => row.metric_type).sort();
      const count = group.rows.reduce((sum, row) => sum + Number(row.sample_count || 0), 0);
      return `
        <div class="data-row z8-source-row" data-bundle="${escapeHtml(group.bundle)}" data-name="${escapeHtml(group.name || '')}" data-metrics="${escapeHtml(metrics.join(','))}">
          <span><strong>${escapeHtml(group.name || 'Unnamed HealthKit source')}</strong><small>${escapeHtml(group.bundle)}</small></span>
          <span>${escapeHtml(metrics.join(', '))}</span>
          <span>${count.toLocaleString()} samples</span>
          <span>${verification ? `<strong>Verified: ${escapeHtml(verification.provider)}</strong>` : '<button class="text-button z8-verify-zepp" type="button">Verify Zepp</button> <button class="text-button z8-verify-renpho" type="button">Verify RENPHO</button>'}</span>
        </div>`;
    }).join('');

    target.querySelectorAll('.z8-verify-zepp,.z8-verify-renpho').forEach(button => {
      button.addEventListener('click', () => verify(button.closest('.z8-source-row'), button.classList.contains('z8-verify-zepp') ? 'zepp' : 'renpho'));
    });
  }

  async function verify(row, provider) {
    if (!row) return;
    const bundle = row.dataset.bundle;
    const name = row.dataset.name || null;
    const metrics = (row.dataset.metrics || '').split(',').filter(Boolean);
    const accepted = window.confirm(`Verify this exact HealthKit source as ${provider.toUpperCase()}?\n\n${name || 'Unnamed source'}\n${bundle}\n\nThis allows matching bridge events to drive permanent Fitness XP. Only continue if this mapping was checked against the actual phone/source app.`);
    if (!accepted) return;
    setBusy(true);
    try {
      await remote.verifySource({
        provider,
        source_bundle_id:bundle,
        source_name:name,
        metric_types:metrics,
        evidence:{ verification_method:'explicit_user_confirmation_in_zero2fit', verified_from:'healthkit_source_observation' }
      });
      setMessage(`${name || bundle} verified as ${provider}. Run Sync now to apply the verification to local events.`);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function bind() {
    document.getElementById('z8AuthForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      setBusy(true);
      try {
        await remote.signIn(document.getElementById('z8Email').value.trim(), document.getElementById('z8Password').value);
        document.getElementById('z8Password').value = '';
        setMessage('Signed in to private sync.');
        await refresh();
      } catch (error) { setMessage(error.message); }
      finally { setBusy(false); }
    });

    document.getElementById('z8SignUp')?.addEventListener('click', async () => {
      setBusy(true);
      try {
        const result = await remote.signUp(document.getElementById('z8Email').value.trim(), document.getElementById('z8Password').value);
        document.getElementById('z8Password').value = '';
        setMessage(result?.access_token ? 'Private account created and signed in.' : 'Account created. Complete email confirmation if Supabase requires it, then sign in.');
        await refresh();
      } catch (error) { setMessage(error.message); }
      finally { setBusy(false); }
    });

    document.getElementById('z8SignOut')?.addEventListener('click', async () => {
      setBusy(true);
      await remote.signOut();
      setBusy(false);
      setMessage('Signed out.');
      await refresh();
    });

    document.getElementById('z8SyncNow')?.addEventListener('click', async () => {
      setBusy(true);
      try {
        const result = await remote.syncNow();
        setMessage(`Private sync complete: ${result.pushed} local events pushed, ${result.pulled} remote events pulled.`);
        await refresh();
        setTimeout(() => window.location.reload(), 150);
      } catch (error) { setMessage(error.message); }
      finally { setBusy(false); }
    });

    window.addEventListener('zero2fit:remote-session', refresh);
    window.addEventListener('zero2fit:remote-sync', refresh);
  }

  function init() {
    if (!remote) return;
    ensurePanel();
    bind();
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();

import('./build009-adaptive.js').catch(error => console.warn('Zero2Fit Build 009 adaptive engine failed to load', error));
