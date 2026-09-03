(() => {
  'use strict';

  const modules = [
    './build022-photo-sync.js',
    './build022-copy.js',
    './build024-private-acceptance.js',
    './build026-activation-guide.js',
    './build026-qa-focus.js',
    './build028-healthkit-evidence.js',
    './build028-verification-guard.js',
    './build028-qa-focus.js',
    './build031-activation-handoff.js',
    './build036-ui-overhaul.js'
  ];

  function load() {
    for (const path of modules) {
      import(path).catch(error => console.warn(`Zero2Fit private continuity module failed to load: ${path}`, error));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once:true });
  else load();
})();
