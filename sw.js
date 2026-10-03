// OpenENTC Studio service worker: makes the studio work offline after the first visit.
// Strategy: network first (so a connected user always gets the latest code), falling back to the
// cache when the network fails; every same-origin GET that succeeds refreshes the cache.
const CACHE = 'openentc-studio-v1';
const SHELL = ['./', './index.html', './src/app.js', './src/styles.css', './manifest.webmanifest', './assets/openentc-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('openentc-studio-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request, { ignoreSearch: true }) ?? (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
      if (cached) return cached;
      throw error;
    }
  })());
});
