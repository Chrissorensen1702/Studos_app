const CACHE_NAME = 'studos-pwa-v2';
const SHELL_ASSETS = [
  '/pwa/',
  '/manifest.webmanifest',
  '/_expo/static/js/web/index-270fa6892c09771fd95639a7baa12d5e.js',
  '/assets/assets/icon.d253a85615408ef1fa62dc4646a785ea.png',
  '/assets/assets/chat-send-rocket.deb227b670d45acc9b0a4c2f00b33687.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => (
      cached || fetch(request).catch(() => caches.match('/pwa/'))
    ))
  );
});
