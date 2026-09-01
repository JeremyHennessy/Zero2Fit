(() => {
  'use strict';
  const MOBILE_QUERY = '(max-width: 820px)';
  let routeTimer = null;

  function activeProgressTab() {
    return document.querySelector('#z12ProgressTabs [data-z12-progress].active')?.dataset?.z12Progress
      || sessionStorage.getItem('zero2fit-progress-tab')
      || 'overview';
  }

  function updateIntelligenceCopy() {
    const status = window.Zero2FitRemoteSync?.status?.() || { configured:false, signed_in:false };
    const rows = [...document.querySelectorAll('#z10ThenNow .data-row')];
    const photoRow = rows.find(row => row.children?.[0]?.textContent?.trim() === 'Progress photos');
    const target = photoRow?.children?.[3];
    if (!target) return;
    const next = status.signed_in
      ? 'Private + local timeline'
      : status.configured
        ? 'Local cache · private-sync ready'
        : 'Local timeline';
    if (target.textContent !== next) target.textContent = next;
  }

  function clearPhotoRoutingOverride(nodes) {
    for (const node of nodes) node?.style?.removeProperty('display');
  }

  function applyPhotoTabRouting() {
    const page = document.getElementById('page-journey');
    const tabs = document.getElementById('z12ProgressTabs');
    const photos = document.querySelector('#page-journey #z4PhotoTrackerPreview.z8-photo-module')
      || document.querySelector('#page-journey .z8-photo-module');
    if (!page || !tabs || !photos) return;

    const intel = document.getElementById('z10Intelligence');
    const body = document.getElementById('z4BodyComposition');
    const grid = document.querySelector('#page-journey > .content-grid');
    const nodes = [intel, body, grid, photos];
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const tab = activeProgressTab();

    clearPhotoRoutingOverride(nodes);
    page.classList.toggle('z22-photos-active', isMobile && tab === 'photos');

    if (!isMobile) {
      photos.hidden = false;
      return;
    }

    if (tab === 'photos') {
      if (intel) { intel.hidden = true; intel.style.setProperty('display', 'none', 'important'); }
      if (body) { body.hidden = true; body.style.setProperty('display', 'none', 'important'); }
      if (grid) { grid.hidden = true; grid.style.setProperty('display', 'none', 'important'); }
      photos.hidden = false;
      photos.style.setProperty('display', 'block', 'important');
      return;
    }

    photos.hidden = true;
    photos.style.setProperty('display', 'none', 'important');
  }

  function scheduleRouting(delay = 0) {
    clearTimeout(routeTimer);
    routeTimer = setTimeout(applyPhotoTabRouting, delay);
  }

  function updateAll() {
    updateIntelligenceCopy();
    scheduleRouting(0);
  }

  window.addEventListener('zero2fit:remote-session', () => setTimeout(updateAll, 20));
  window.addEventListener('zero2fit:remote-sync', () => setTimeout(updateAll, 60));
  window.addEventListener('zero2fit:personal-intelligence', () => setTimeout(updateAll, 20));
  window.addEventListener('focus', updateAll);
  window.addEventListener('resize', () => scheduleRouting(60));

  const observer = new MutationObserver(() => updateAll());
  const start = () => {
    const intelligence = document.getElementById('z10ThenNow');
    const tabs = document.getElementById('z12ProgressTabs');
    const photos = document.querySelector('#page-journey .z8-photo-module');
    if (!intelligence || !tabs || !photos) return setTimeout(start, 100);

    observer.observe(intelligence, { childList:true, subtree:true });
    tabs.querySelectorAll('[data-z12-progress]').forEach(button => {
      button.addEventListener('click', () => scheduleRouting(0));
    });
    updateAll();
    setTimeout(updateAll, 400);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
