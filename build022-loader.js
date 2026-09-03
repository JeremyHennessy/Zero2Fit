(() => {
  'use strict';

  function load() {
    Promise.all([
      import('./build022-photo-sync.js'),
      import('./build022-copy.js')
    ])
      .then(() => import('./build024-private-acceptance.js'))
      .then(() => import('./build026-activation-guide.js'))
      .then(() => import('./build026-qa-focus.js'))
      .then(() => import('./build028-healthkit-evidence.js'))
      .then(() => Promise.all([
        import('./build028-verification-guard.js'),
        import('./build028-qa-focus.js')
      ]))
      .then(() => import('./build031-activation-handoff.js'))
      .catch(error => console.warn('Zero2Fit Build 022/024/026/028/031 private continuity failed to load', error));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once:true });
  else load();
})();
