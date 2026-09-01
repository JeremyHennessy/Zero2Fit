(() => {
  'use strict';
  function update() {
    const status = window.Zero2FitRemoteSync?.status?.() || { configured:false, signed_in:false };
    const rows = [...document.querySelectorAll('#z10ThenNow .data-row')];
    const photoRow = rows.find(row => row.children?.[0]?.textContent?.trim() === 'Progress photos');
    if (photoRow?.children?.[3]) {
      photoRow.children[3].textContent = status.signed_in
        ? 'Private + local timeline'
        : status.configured
          ? 'Local cache · private-sync ready'
          : 'Local timeline';
    }
  }
  window.addEventListener('zero2fit:remote-session', () => setTimeout(update, 20));
  window.addEventListener('zero2fit:remote-sync', () => setTimeout(update, 60));
  window.addEventListener('zero2fit:personal-intelligence', () => setTimeout(update, 20));
  window.addEventListener('focus', update);
  const observer = new MutationObserver(() => update());
  const start = () => {
    const target = document.getElementById('z10ThenNow');
    if (!target) return setTimeout(start, 100);
    observer.observe(target, { childList:true, subtree:true });
    update();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
