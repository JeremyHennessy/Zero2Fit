(() => {
  'use strict';
  let attempts = 0;
  function load() {
    const workoutWrapped = Boolean(window.Zero2FitRemoteSync?.syncNow?.__z21Wrapped);
    const photosReady = Boolean(document.querySelector('.z8-photo-module'));
    if ((!workoutWrapped || !photosReady) && attempts < 200) {
      attempts += 1;
      setTimeout(load, 100);
      return;
    }
    Promise.all([
      import('./build022-photo-sync.js'),
      import('./build022-copy.js')
    ])
      .then(() => import('./build024-private-acceptance.js'))
      .then(() => import('./build025-activation-guide.js'))
      .catch(error => console.warn('Zero2Fit Build 022/024/025 private continuity failed to load', error));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once:true });
  else load();
})();