const scope = new URL(self.registration.scope);
const CACHE_PREFIX = 'tin-shooting-' + encodeURIComponent(scope.pathname) + '-';
const CACHE_NAME = CACHE_PREFIX + '1.3.2';
const indexUrl = new URL('./index.html', scope).href;
const appFiles = [
  './index.html',
  './style.css',
  './app.mjs',
  './game.mjs',
  './manifest.webmanifest',
  './icons/comic-192.png',
  './icons/comic-512.png',
  './icons/comic-maskable-512.png',
  './icons/comic-apple-touch.png',
].map(path => new URL(path, scope).href);
const cachedUrls = new Set(appFiles);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(appFiles.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'activate-update') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(scope.href)) return;
  if (event.request.mode === 'navigate'
      && (url.pathname === scope.pathname || url.href.split('?')[0] === indexUrl)) {
    event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(indexUrl))
      .then(response => response || fetch(event.request)));
  } else if (cachedUrls.has(url.href)) {
    event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(url.href))
      .then(response => response || fetch(event.request)));
  }
});
