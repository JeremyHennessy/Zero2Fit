(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('qaFocus') !== 'healthkitEvidence') return;
  let attempts = 0;
  function focus() {
    const page = document.getElementById('page-data');
    const panel = document.getElementById('z28HealthKitEvidence');
    if ((!page || !panel) && attempts < 200) {
      attempts += 1;
      setTimeout(focus, 100);
      return;
    }
    if (!page || !panel) return;
    page.prepend(panel);
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.documentElement.dataset.zero2fitQaReady = 'healthkit-evidence';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', focus, { once:true });
  else focus();
})();
