(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('qaFocus') !== 'activation') return;
  let attempts = 0;
  function focus() {
    const page = document.getElementById('page-data');
    const panel = document.getElementById('z26ActivationGuide');
    if ((!page || !panel) && attempts < 40) {
      attempts += 1;
      return setTimeout(focus, 100);
    }
    if (!page || !panel) return;
    page.prepend(panel);
    window.scrollTo({ top:0, behavior:'auto' });
    document.documentElement.dataset.zero2fitQaReady = 'activation';
  }
  setTimeout(focus, 1500);
})();
