const CACHE_NAME = 'studos-pwa-v15';
const scopeUrl = (path) => new URL(path, self.registration.scope).toString();
const SHELL_ASSETS = [
  scopeUrl('pwa/?v=15'),
  scopeUrl('manifest.webmanifest'),
  scopeUrl('_expo/static/js/web/index-8a0cb6f74838a39dd74bc0e17b677f4f.js'),
  scopeUrl('assets/assets/icon.d253a85615408ef1fa62dc4646a785ea.png'),
  scopeUrl('assets/assets/chat-send-rocket.deb227b670d45acc9b0a4c2f00b33687.png')
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

  const requestUrl = new URL(request.url);

  if (requestUrl.pathname === '/api' || requestUrl.pathname.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => (
      cached || fetch(request).catch(() => caches.match(scopeUrl('pwa/?v=15')))
    ))
  );
});
