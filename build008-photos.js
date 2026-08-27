(() => {
  'use strict';

  const storage = window.Zero2FitStorage;
  let core = null;
  let photos = [];
  let sessionId = createSessionId();
  let view = 'front';
  let alignment = { x: 0, y: 0, scale: 1, ghostOpacity: 0.35 };
  let sourceBlob = null;
  let sourceUrl = null;
  let ghostUrl = null;
  let stream = null;
  let facingMode = 'user';

  function createSessionId() {
    return `session:${new Date().toISOString()}:${Math.random().toString(36).slice(2, 8)}`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    const video = document.getElementById('z8Video');
    if (video) { video.srcObject = null; video.hidden = true; }
    const capture = document.getElementById('z8Capture');
    if (capture) capture.hidden = true;
  }

  function revokeUrl(name) {
    if (name === 'source' && sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (name === 'ghost' && ghostUrl) URL.revokeObjectURL(ghostUrl);
    if (name === 'source') sourceUrl = null;
    if (name === 'ghost') ghostUrl = null;
  }

  function guideSvg() {
    return `<svg class="z8-guide" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true">
      <line x1="150" y1="18" x2="150" y2="382" />
      <circle cx="150" cy="67" r="27" />
      <line x1="92" y1="120" x2="208" y2="120" />
      <path d="M112 120 C120 160, 122 210, 118 270 M188 120 C180 160,178 210,182 270" />
      <line x1="95" y1="365" x2="205" y2="365" />
    </svg>`;
  }

  function ensureUi() {
    const preview = document.getElementById('z4PhotoTrackerPreview');
    if (!preview) return false;
    preview.className = 'card z8-photo-module';
    preview.innerHTML = `
      <div class="z8-photo-header">
        <div><div class="eyebrow">Progress photos</div><h2>Private aligned visual timeline</h2><p>Capture front, side and back against the same guide. Images stay in this browser's IndexedDB and are excluded from JSON backups.</p></div>
        <span class="z8-private-badge">Local only</span>
      </div>
      <div class="z8-view-tabs" id="z8ViewTabs">
        <button data-photo-view="front" class="active">Front</button><button data-photo-view="side">Side</button><button data-photo-view="back">Back</button>
      </div>
      <div class="z8-photo-workspace">
        <div class="z8-stage" id="z8Stage">
          <video id="z8Video" autoplay playsinline muted hidden></video>
          <img id="z8Ghost" class="z8-ghost" alt="Previous aligned progress photo" hidden>
          <img id="z8Current" class="z8-current" alt="Current progress photo alignment preview" hidden>
          ${guideSvg()}
          <div class="z8-stage-label"><span id="z8StageView">Front</span><small>Align head · shoulders · centerline · feet</small></div>
        </div>
        <div class="z8-controls">
          <div class="z8-button-row">
            <button class="primary-button" id="z8StartCamera">Use camera</button>
            <button class="z4-secondary" id="z8Capture" hidden>Capture frame</button>
            <button class="z4-secondary" id="z8Choose">Choose photo</button>
            <input id="z8File" type="file" accept="image/*" hidden>
          </div>
          <div class="z8-button-row compact">
            <button class="z4-secondary" id="z8Flip">Flip camera</button>
            <button class="z4-secondary" id="z8NewSession">New session</button>
          </div>
          <label>Zoom <output id="z8ScaleOut">100%</output><input id="z8Scale" type="range" min="75" max="160" value="100"></label>
          <label>Horizontal <output id="z8XOut">0</output><input id="z8X" type="range" min="-25" max="25" value="0"></label>
          <label>Vertical <output id="z8YOut">0</output><input id="z8Y" type="range" min="-25" max="25" value="0"></label>
          <label>Previous-photo ghost <output id="z8GhostOut">35%</output><input id="z8GhostOpacity" type="range" min="0" max="80" value="35"></label>
          <div id="z8Coverage" class="z8-coverage"></div>
          <button class="primary-button full-width" id="z8Save" disabled>Save aligned photo</button>
          <p class="z8-status" id="z8Status">Camera or photo library is ready. Nothing is uploaded.</p>
        </div>
      </div>
      <div class="z8-timeline-head"><div><span>Timeline</span><h3>Saved sessions</h3></div><strong id="z8PhotoCount">0 photos</strong></div>
      <div id="z8Timeline" class="z8-timeline"></div>`;
    bindUi();
    return true;
  }

  function setStatus(message) {
    const node = document.getElementById('z8Status');
    if (node) node.textContent = message;
  }

  function updateAlignment() {
    alignment = core.normalizeAlignment(alignment);
    const current = document.getElementById('z8Current');
    if (current) current.style.transform = `translate(calc(-50% + ${alignment.x}%), calc(-50% + ${alignment.y}%)) scale(${alignment.scale})`;
    const ghost = document.getElementById('z8Ghost');
    if (ghost) ghost.style.opacity = alignment.ghostOpacity;
    document.getElementById('z8ScaleOut').value = `${Math.round(alignment.scale * 100)}%`;
    document.getElementById('z8XOut').value = `${alignment.x}`;
    document.getElementById('z8YOut').value = `${alignment.y}`;
    document.getElementById('z8GhostOut').value = `${Math.round(alignment.ghostOpacity * 100)}%`;
  }

  async function setSource(blob) {
    stopCamera();
    revokeUrl('source');
    sourceBlob = blob;
    sourceUrl = URL.createObjectURL(blob);
    const img = document.getElementById('z8Current');
    img.src = sourceUrl;
    img.hidden = false;
    document.getElementById('z8Save').disabled = false;
    alignment = { x: 0, y: 0, scale: 1, ghostOpacity: alignment.ghostOpacity };
    syncControlValues();
    updateAlignment();
    setStatus('Photo loaded. Align it to the guide, then save.');
  }

  function syncControlValues() {
    document.getElementById('z8Scale').value = Math.round(alignment.scale * 100);
    document.getElementById('z8X').value = alignment.x;
    document.getElementById('z8Y').value = alignment.y;
    document.getElementById('z8GhostOpacity').value = Math.round(alignment.ghostOpacity * 100);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Live camera is unavailable here; use Choose photo instead.');
      return;
    }
    stopCamera();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 1700 } }
      });
      const video = document.getElementById('z8Video');
      video.srcObject = stream;
      video.hidden = false;
      document.getElementById('z8Current').hidden = true;
      document.getElementById('z8Capture').hidden = false;
      setStatus(`Camera active · ${facingMode === 'user' ? 'front' : 'rear'} lens preference.`);
    } catch (error) {
      setStatus(`Camera permission unavailable: ${error.name || 'error'}. Choose a photo instead.`);
    }
  }

  async function captureFrame() {
    const video = document.getElementById('z8Video');
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (blob) await setSource(blob);
  }

  async function imageFromBlob(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }

  async function renderNormalizedBlob(blob, size = { width: 1200, height: 1600 }, quality = .86) {
    const img = await imageFromBlob(blob);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#090d0b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cover = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const drawScale = cover * alignment.scale;
    const w = img.naturalWidth * drawScale;
    const h = img.naturalHeight * drawScale;
    const x = (canvas.width - w) / 2 + alignment.x / 100 * canvas.width;
    const y = (canvas.height - h) / 2 + alignment.y / 100 * canvas.height;
    ctx.drawImage(img, x, y, w, h);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  async function savePhoto() {
    if (!sourceBlob || !storage?.saveProgressPhoto) return;
    const saveButton = document.getElementById('z8Save');
    saveButton.disabled = true;
    setStatus('Normalizing and saving privately…');
    try {
      const [blob, thumbnail] = await Promise.all([
        renderNormalizedBlob(sourceBlob, { width: 1200, height: 1600 }, .86),
        renderNormalizedBlob(sourceBlob, { width: 270, height: 360 }, .76)
      ]);
      const capturedAt = new Date().toISOString();
      const record = {
        photo_id: `photo:${capturedAt}:${Math.random().toString(36).slice(2, 8)}`,
        session_id: sessionId,
        captured_at: capturedAt,
        view,
        mime_type: 'image/jpeg',
        width: 1200,
        height: 1600,
        alignment: core.normalizeAlignment(alignment),
        blob,
        thumbnail_blob: thumbnail,
        storage_scope: 'indexeddb-local'
      };
      await storage.saveProgressPhoto(record);
      await refreshPhotos();
      setStatus(`${view[0].toUpperCase() + view.slice(1)} photo saved locally. Raw image is not included in backups.`);
      sourceBlob = null;
      revokeUrl('source');
      document.getElementById('z8Current').hidden = true;
      await updateGhost();
    } catch (error) {
      setStatus(`Photo could not be saved: ${error.message}`);
      saveButton.disabled = false;
    }
  }

  async function updateGhost() {
    revokeUrl('ghost');
    const previous = core.previousPhotoForView(photos, view, sessionId);
    const ghost = document.getElementById('z8Ghost');
    if (!previous?.blob) { ghost.hidden = true; return; }
    ghostUrl = URL.createObjectURL(previous.blob);
    ghost.src = ghostUrl;
    ghost.hidden = false;
    updateAlignment();
  }

  function timelineItem(photo) {
    const thumb = photo.thumbnail_blob ? URL.createObjectURL(photo.thumbnail_blob) : null;
    if (thumb) setTimeout(() => URL.revokeObjectURL(thumb), 60000);
    return `<article class="z8-timeline-item" data-photo-id="${esc(photo.photo_id)}">
      <div class="z8-thumb">${thumb ? `<img src="${thumb}" alt="${esc(photo.view)} progress photo thumbnail">` : '<span>Photo</span>'}</div>
      <div><span>${esc(photo.view)}</span><strong>${new Date(photo.captured_at).toLocaleDateString()}</strong><small>${new Date(photo.captured_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>
      <button data-delete-photo="${esc(photo.photo_id)}">Delete</button>
    </article>`;
  }

  function renderTimeline() {
    document.getElementById('z8PhotoCount').textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
    const groups = core.groupPhotoSessions(photos).slice(0, 6);
    const timeline = document.getElementById('z8Timeline');
    if (!groups.length) {
      timeline.innerHTML = '<div class="z8-empty">No saved photo sessions yet.</div>';
      return;
    }
    timeline.innerHTML = groups.map(group => `<section class="z8-session"><header><div><span>Session</span><strong>${new Date(group.capturedAt).toLocaleDateString()}</strong></div><small>${group.views.map(v=>v[0].toUpperCase()+v.slice(1)).join(' · ')}</small></header><div class="z8-session-photos">${group.photos.sort((a,b)=>core.PHOTO_VIEWS.indexOf(a.view)-core.PHOTO_VIEWS.indexOf(b.view)).map(timelineItem).join('')}</div></section>`).join('');
    timeline.querySelectorAll('[data-delete-photo]').forEach(button => button.addEventListener('click', async () => {
      await storage.deleteProgressPhoto(button.dataset.deletePhoto);
      await refreshPhotos();
      await updateGhost();
      setStatus('Photo deleted from local storage.');
    }));
  }

  function renderCoverage() {
    const coverage = core.sessionCoverage(photos, sessionId);
    document.getElementById('z8Coverage').innerHTML = coverage.map(item => `<span class="${item.saved ? 'saved' : ''}">${item.saved ? '✓' : '○'} ${item.view}</span>`).join('');
  }

  async function refreshPhotos() {
    photos = await storage.getProgressPhotos(200);
    renderCoverage();
    renderTimeline();
  }

  async function setView(nextView) {
    view = core.normalizePhotoView(nextView);
    document.getElementById('z8StageView').textContent = view[0].toUpperCase() + view.slice(1);
    document.querySelectorAll('[data-photo-view]').forEach(button => button.classList.toggle('active', button.dataset.photoView === view));
    sourceBlob = null;
    revokeUrl('source');
    document.getElementById('z8Current').hidden = true;
    document.getElementById('z8Save').disabled = true;
    await updateGhost();
    renderCoverage();
  }

  function bindUi() {
    document.querySelectorAll('[data-photo-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.photoView)));
    document.getElementById('z8StartCamera').addEventListener('click', startCamera);
    document.getElementById('z8Capture').addEventListener('click', captureFrame);
    document.getElementById('z8Choose').addEventListener('click', () => document.getElementById('z8File').click());
    document.getElementById('z8File').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      await setSource(file);
      event.target.value = '';
    });
    document.getElementById('z8Flip').addEventListener('click', async () => {
      facingMode = facingMode === 'user' ? 'environment' : 'user';
      if (stream) await startCamera();
      else setStatus(`Camera preference changed to ${facingMode === 'user' ? 'front' : 'rear'} lens.`);
    });
    document.getElementById('z8NewSession').addEventListener('click', async () => {
      sessionId = createSessionId();
      stopCamera();
      sourceBlob = null;
      revokeUrl('source');
      document.getElementById('z8Current').hidden = true;
      document.getElementById('z8Save').disabled = true;
      await updateGhost();
      renderCoverage();
      setStatus('New progress-photo session started.');
    });
    document.getElementById('z8Scale').addEventListener('input', event => { alignment.scale = Number(event.target.value) / 100; updateAlignment(); });
    document.getElementById('z8X').addEventListener('input', event => { alignment.x = Number(event.target.value); updateAlignment(); });
    document.getElementById('z8Y').addEventListener('input', event => { alignment.y = Number(event.target.value); updateAlignment(); });
    document.getElementById('z8GhostOpacity').addEventListener('input', event => { alignment.ghostOpacity = Number(event.target.value) / 100; updateAlignment(); });
    document.getElementById('z8Save').addEventListener('click', savePhoto);
    window.addEventListener('pagehide', stopCamera);
  }

  async function init() {
    if (!storage?.saveProgressPhoto) return;
    try {
      core = await import('./photo-core.mjs');
      if (!ensureUi()) return;
      await storage.openDb();
      await refreshPhotos();
      await updateGhost();
      updateAlignment();
    } catch (error) {
      console.warn('Zero2Fit Build 008 photos failed', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
