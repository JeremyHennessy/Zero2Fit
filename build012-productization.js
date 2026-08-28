const MOBILE_QUERY = '(max-width: 820px)';
const qaParams = new URLSearchParams(location.search);
const qaPage = qaParams.get('qaPage');
const qaFocus = qaParams.get('qaFocus');
const qaSettings = qaParams.get('qaSettings') === '1';
let progressTab = sessionStorage.getItem('zero2fit-progress-tab') || 'overview';
let adventurePanel = null;
let resizeTimer = null;
let adventureObserver = null;

function mobile() { return window.matchMedia(MOBILE_QUERY).matches; }

function ensureStylesheet() {
  if (document.querySelector('link[href="./build012.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build012.css';
  document.head.appendChild(link);
}

function ensureMeta() {
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = './manifest.webmanifest';
    document.head.appendChild(manifest);
  }
  const metas = [
    ['apple-mobile-web-app-capable','yes'],
    ['apple-mobile-web-app-status-bar-style','black-translucent'],
    ['apple-mobile-web-app-title','Zero2Fit'],
    ['mobile-web-app-capable','yes']
  ];
  for (const [name, content] of metas) {
    if (document.querySelector(`meta[name="${name}"]`)) continue;
    const meta = document.createElement('meta');
    meta.name = name;
    meta.content = content;
    document.head.appendChild(meta);
  }
}

function correctTrainingCopy() {
  const button = document.querySelector('[data-workout-location="apartmentGym"]');
  const detail = button?.querySelector('span');
  if (detail && /photo inventory pending/i.test(detail.textContent || '')) detail.textContent = 'Machines + cable + Smith + full dumbbell set';
}

function closeSettings() { const backdrop = document.getElementById('z12SettingsBackdrop'); if (backdrop) backdrop.hidden = true; }
function openSettings() { const backdrop = document.getElementById('z12SettingsBackdrop'); if (backdrop) backdrop.hidden = false; }

function ensureSettings() {
  const actions = document.querySelector('.topbar-actions');
  if (!actions || document.getElementById('z12SettingsButton')) return;
  const button = document.createElement('button');
  button.id = 'z12SettingsButton'; button.className = 'icon-button z12-settings-button'; button.type = 'button';
  button.title = 'Settings and devices'; button.setAttribute('aria-label','Settings and devices'); button.textContent = '⚙';
  actions.appendChild(button);
  const backdrop = document.createElement('div');
  backdrop.id = 'z12SettingsBackdrop'; backdrop.className = 'z12-settings-backdrop'; backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="z12-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="z12SettingsTitle">
      <div class="z12-settings-head"><div><div class="eyebrow">Zero2Fit</div><h2 id="z12SettingsTitle">Settings</h2></div><button class="icon-button" type="button" id="z12SettingsClose" aria-label="Close settings">×</button></div>
      <div class="z12-settings-list">
        <button class="z12-settings-action" type="button" data-z12-page="data"><span><strong>Devices & private sync</strong><small>HealthKit sources, imports, backup and account sync</small></span><b>›</b></button>
        <button class="z12-settings-action" type="button" data-z12-page="nutrition"><span><strong>Fuel</strong><small>Open nutrition logging and daily intake</small></span><b>›</b></button>
        <button class="z12-settings-action" type="button" id="z12InstallHelp"><span><strong>Add to iPhone Home Screen</strong><small>Safari → Share → Add to Home Screen for an app-like launch</small></span><b>＋</b></button>
      </div>
      <p class="z12-settings-meta" id="z12OfflineStatus">Checking offline readiness…</p>
    </section>`;
  document.body.appendChild(backdrop);
  const reset = document.getElementById('resetDemo');
  if (reset) { reset.classList.add('z12-reset-action'); reset.textContent = 'Reset local Zero2Fit data'; reset.title = 'Reset local Zero2Fit data'; backdrop.querySelector('.z12-settings-sheet')?.appendChild(reset); }
  button.addEventListener('click', openSettings);
  document.getElementById('z12SettingsClose')?.addEventListener('click', closeSettings);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) closeSettings(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeSettings(); });
  backdrop.querySelectorAll('[data-z12-page]').forEach(link => link.addEventListener('click', () => { closeSettings(); document.querySelector(`.nav-item[data-page="${link.dataset.z12Page}"]`)?.click(); }));
  document.getElementById('z12InstallHelp')?.addEventListener('click', () => {
    const status = document.getElementById('z12OfflineStatus');
    if (status) status.textContent = 'On iPhone Safari, tap Share, then Add to Home Screen. Zero2Fit uses standalone display metadata and a versioned offline shell.';
  });
  updateOfflineStatus();
}

function updateOfflineStatus() {
  const node = document.getElementById('z12OfflineStatus'); if (!node) return;
  const online = navigator.onLine ? 'Online' : 'Offline';
  const sw = 'serviceWorker' in navigator ? 'offline shell supported' : 'offline shell unavailable in this browser';
  node.textContent = `${online} · ${sw}. Devices remain available from Settings instead of occupying a daily iPhone tab.`;
}

function markStrengthBlocks() {
  const intel = document.getElementById('z10Intelligence'); const records = document.getElementById('z10Records');
  if (!intel || !records) return;
  records.classList.add('z12-strength-block');
  [...intel.children].find(node => node.classList?.contains('eyebrow') && /personal records/i.test(node.textContent || ''))?.classList.add('z12-strength-block');
}

function ensureProgressTabs() {
  const page = document.getElementById('page-journey'); const hero = page?.querySelector('.journey-hero');
  if (!page || !hero || document.getElementById('z12ProgressTabs')) return;
  const tabs = document.createElement('nav'); tabs.id = 'z12ProgressTabs'; tabs.className = 'z12-progress-tabs'; tabs.setAttribute('aria-label','Progress sections');
  tabs.innerHTML = `<button type="button" data-z12-progress="overview">Overview</button><button type="button" data-z12-progress="strength">Strength</button><button type="button" data-z12-progress="body">Body</button><button type="button" data-z12-progress="photos">Photos</button>`;
  hero.after(tabs);
  tabs.querySelectorAll('[data-z12-progress]').forEach(button => button.addEventListener('click', () => { progressTab = button.dataset.z12Progress; sessionStorage.setItem('zero2fit-progress-tab', progressTab); applyProgressTab(); }));
  markStrengthBlocks(); applyProgressTab();
}
function setGridChildren(grid, predicate) { if (grid) [...grid.children].forEach((child, index) => { child.hidden = !predicate(child, index); }); }
function applyProgressTab() {
  const tabs = document.getElementById('z12ProgressTabs'); if (!tabs) return;
  tabs.querySelectorAll('[data-z12-progress]').forEach(button => button.classList.toggle('active', button.dataset.z12Progress === progressTab));
  const intel = document.getElementById('z10Intelligence'); const body = document.getElementById('z4BodyComposition'); const photos = document.getElementById('z4PhotoTrackerPreview'); const grid = document.querySelector('#page-journey > .content-grid');
  markStrengthBlocks();
  if (!mobile()) { [intel, body, photos, grid].forEach(node => { if (node) node.hidden = false; }); intel?.classList.remove('z12-strength-view'); setGridChildren(grid, () => true); return; }
  if (intel) { intel.hidden = !['overview','strength'].includes(progressTab); intel.classList.toggle('z12-strength-view', progressTab === 'strength'); }
  if (body) body.hidden = progressTab !== 'body'; if (photos) photos.hidden = progressTab !== 'photos';
  if (grid) { grid.hidden = progressTab === 'strength' || progressTab === 'photos'; if (progressTab === 'overview') setGridChildren(grid, () => true); else if (progressTab === 'body') setGridChildren(grid, child => /weight history/i.test(child.querySelector('h2')?.textContent || '')); }
}

function syncAdventurePrimary() {
  const stage = document.getElementById('z11StageTitle')?.textContent?.trim() || 'Stage pending'; const stageProgress = document.getElementById('z11StageProgress')?.textContent?.trim() || '—'; const wall = document.getElementById('z11Wall');
  const wallTitle = wall?.querySelector('strong')?.textContent?.trim() || 'Frontier advancing'; const wallDetail = wall?.querySelector('span')?.textContent?.trim() || 'Adventure will stop when the current real-world capability ceiling is reached.';
  setTextSafe('z12AdventureStageText', stage); setTextSafe('z12AdventureStageProgress', stageProgress); setTextSafe('z12AdventureWallTitle', wallTitle); setTextSafe('z12AdventureWallDetail', wallDetail);
}
function setTextSafe(id, value) { const node = document.getElementById(id); if (node) node.textContent = value; }
function observeAdventureStatus() {
  const status = document.getElementById('z11AdventureStatus'); if (!status || adventureObserver) return;
  adventureObserver = new MutationObserver(syncAdventurePrimary); adventureObserver.observe(status, { childList:true, subtree:true, characterData:true });
}
function ensureAdventureControls() {
  const frontier = document.getElementById('z4FrontierCard'); const zones = frontier?.querySelector('.z7-zone-list'); if (!frontier || !zones) return;
  let controls = document.getElementById('z12AdventureControls');
  if (!controls) {
    controls = document.createElement('nav'); controls.id = 'z12AdventureControls'; controls.className = 'z12-adventure-controls'; controls.setAttribute('aria-label','Adventure details');
    controls.innerHTML = `<button type="button" data-z12-adventure="stats">Stats</button><button type="button" data-z12-adventure="auto">Auto/Gear</button><button type="button" data-z12-adventure="materials">Materials</button><button type="button" data-z12-adventure="log">Log/Loot</button>`;
    zones.after(controls);
    controls.querySelectorAll('[data-z12-adventure]').forEach(button => button.addEventListener('click', () => { adventurePanel = adventurePanel === button.dataset.z12Adventure ? null : button.dataset.z12Adventure; applyAdventurePanel(); }));
  }
  if (!document.getElementById('z12AdventurePrimary')) {
    const primary = document.createElement('div'); primary.id = 'z12AdventurePrimary'; primary.className = 'z12-adventure-primary';
    primary.innerHTML = `<div class="z12-adventure-stage"><span id="z12AdventureStageText">Stage pending</span><strong id="z12AdventureStageProgress">—</strong></div><div class="z12-adventure-wall-summary"><strong id="z12AdventureWallTitle">Frontier advancing</strong><span id="z12AdventureWallDetail">Adventure will stop when the current real-world capability ceiling is reached.</span></div>`;
    controls.after(primary);
  }
  const materialHeading = document.querySelector('#z11AdventureStatus > section:nth-child(2) .z7-section-title h3'); if (materialHeading) materialHeading.textContent = 'Materials';
  observeAdventureStatus(); syncAdventurePrimary(); applyAdventurePanel();
}
function adventureTargets() { return { stats:document.querySelector('#z11AdventureStatus > section:first-child'), auto:document.querySelector('#page-character .z7-auto-panel'), materials:document.querySelector('#z11AdventureStatus > section:nth-child(2)'), log:[...document.querySelectorAll('#page-character .z7-lower-grid')].find(node => node.id !== 'z11AdventureStatus') || null }; }
function applyAdventurePanel() {
  const controls = document.getElementById('z12AdventureControls'); if (!controls) return;
  controls.querySelectorAll('[data-z12-adventure]').forEach(button => button.classList.toggle('active', button.dataset.z12Adventure === adventurePanel));
  for (const [key, node] of Object.entries(adventureTargets())) if (node) node.classList.toggle('z12-mobile-open', !mobile() || key === adventurePanel);
  syncAdventurePrimary();
}

function applyQaFocus() { if (qaFocus === 'frontier') { document.documentElement.classList.add('z12-qa-frontier'); window.scrollTo({ top:0, behavior:'auto' }); } if (qaSettings) openSettings(); }
function prepareQaPage() {
  if (!qaPage && !qaSettings) return;
  document.documentElement.dataset.zero2fitQa = '1'; const page = ['today','train','character','nutrition','journey','data'].includes(qaPage) ? qaPage : 'today';
  setTimeout(() => { document.querySelector(`.nav-item[data-page="${page}"]`)?.click(); window.scrollTo({ top:0, behavior:'auto' }); setTimeout(() => { applyQaFocus(); document.documentElement.dataset.zero2fitQaReady = qaFocus || (qaSettings ? 'settings' : page); }, 350); }, 650);
}
async function registerServiceWorker() {
  if (qaPage || qaSettings || !('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  try { await navigator.serviceWorker.register('./sw.js', { scope:'./' }); } catch (error) { console.warn('Zero2Fit offline shell registration failed', error); }
}
function refreshResponsiveViews() { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { applyProgressTab(); applyAdventurePanel(); }, 60); }
function init() {
  ensureStylesheet(); ensureMeta(); correctTrainingCopy(); ensureSettings(); ensureProgressTabs(); ensureAdventureControls(); prepareQaPage(); registerServiceWorker();
  window.addEventListener('online', updateOfflineStatus); window.addEventListener('offline', updateOfflineStatus); window.addEventListener('resize', refreshResponsiveViews);
  window.addEventListener('zero2fit:personal-intelligence', () => { markStrengthBlocks(); applyProgressTab(); }); window.addEventListener('zero2fit:remote-sync', syncAdventurePrimary);
  setTimeout(() => { correctTrainingCopy(); ensureProgressTabs(); ensureAdventureControls(); applyProgressTab(); applyAdventurePanel(); }, 500);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();

import('./build014-workout-execution.js').catch(error => console.warn('Zero2Fit Build 014 guided workout execution failed to load', error));
