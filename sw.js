/* Offline support. Change VERSION whenever you publish an update so devices fetch the new files. */
const VERSION = 'portion-1.0.0';
const FILES = ['./', 'index.html', 'styles.css', 'foods-data.js', 'exercises.js', 'calc.js', 'store.js', 'foods.js', 'ui.js', 'addfood.js', 'library.js', 'track.js', 'profile.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).catch(() => caches.match('index.html'))));
});
