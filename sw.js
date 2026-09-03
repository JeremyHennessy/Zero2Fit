// zero2fit-shell-v36-modern-ui supersedes zero2fit-shell-v31-activation-handoff, zero2fit-shell-v28-healthkit-evidence, zero2fit-shell-v26-activation-guide, zero2fit-shell-v24-private-acceptance, zero2fit-shell-v22-photo-sync, and zero2fit-shell-v21-workout-sync.
const CACHE = 'zero2fit-shell-v36-modern-ui';
const SHELL = [
  './', './index.html', './styles.css', './build002.css', './build003.css', './build004.css', './build006.css', './build007.css', './build012.css', './build014.css', './build016.css', './build017.css', './build018.css', './build019.css', './build021.css', './build022.css', './build024.css', './build026.css', './build028.css', './build031.css', './build036.css',
  './zero2fit-config.js', './app.js', './storage.js', './remote-sync.js', './ingestion.js', './device-core.mjs', './training-core.mjs', './adaptive-core.mjs', './intelligence-core.mjs', './adventure-core.mjs', './adventure-visual-core.mjs', './photo-core.mjs', './photo-sync-core.mjs', './acceptance-core.mjs', './activation-guide-core.mjs', './healthkit-evidence-core.mjs', './activation-handoff-core.mjs', './workout-execution-core.mjs', './nutrition-core.mjs', './food-lookup-core.mjs', './workout-sync-core.mjs',
  './build003-integration.js', './build004-integration.js', './build007-adventure.js', './build008-photos.js', './build008-device-sync.js', './build009-adaptive.js', './build010-intelligence.js', './build011-adventure.js', './build012-productization.js', './build014-workout-execution.js', './build016-adventure-visual.js', './build017-fuel.js', './build018-food-lookup.js', './build019-fuel-sync.js', './build021-workout-sync.js', './build022-loader.js', './build022-photo-sync.js', './build022-copy.js', './build024-private-acceptance.js', './build026-activation-guide.js', './build026-qa-focus.js', './build028-healthkit-evidence.js', './build028-verification-guard.js', './build028-qa-focus.js', './build031-activation-handoff.js', './build036-ui-overhaul.js',
  './data/generated/training_exercises.json', './data/generated/catalog_summary.json', './data/generated/training_catalog_summary.json',
  './data/programming_rules.json', './data/substitution_rules.json', './data/location_profiles.json', './data/energy_model.json', './data/adventure_catalog.json',
  './manifest.webmanifest', './assets/z2f-icon-180.png', './assets/z2f-icon-192.png', './assets/z2f-icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('zero2fit-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
      if (cached) return cached;
      if (request.mode === 'navigate') return cache.match('./index.html');
      throw new Error('Zero2Fit offline resource unavailable');
    }
  })());
});
