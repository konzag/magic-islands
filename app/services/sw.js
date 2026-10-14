/* Τα Μαγικά Νησιά: service worker for offline play (served at /sw.js by app/api/game.py).
   The server fills in VERSION (build commit + page hash) and ASSETS (the page, the font CSS and files, the
   manifest and icons). A new deploy changes VERSION, so the browser installs a new worker with a fresh cache
   and the old cache is deleted on activate. Same-origin GETs only; nothing is ever sent anywhere. */
'use strict';
const VERSION = '__VERSION__';
const ASSETS = ["__ASSETS__"];
const PREFIX = 'magic-islands-';
const CACHE = PREFIX + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // The page: network first (a new deploy shows at once), the cached copy when offline.
    event.respondWith(fetch(req).catch(() => caches.match('/', { cacheName: CACHE })));
    return;
  }
  // Fonts, CSS, icons: from the cache of this version, else the network.
  event.respondWith(caches.match(req, { cacheName: CACHE }).then((hit) => hit || fetch(req)));
});
