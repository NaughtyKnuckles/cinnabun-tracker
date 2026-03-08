const CACHE = 'cinnabun-v3';
const ASSETS = [
  './index.html',
  './manifest.json',
  './style.css',
  './app.js',
  './auth.js',
  './firebase.js',
  './render.js',
  './analytics.js',
  './state.js',
  './utils.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});
