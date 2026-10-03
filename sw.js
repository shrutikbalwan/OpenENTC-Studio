// OpenENTC Studio service worker: makes the studio work offline after the first visit.
// Strategy: network first (so a connected user always gets the latest code), falling back to the
// cache when the network fails; every same-origin GET that succeeds refreshes the cache.
// Install precaches every web asset listed in precache.json (written by `npm run build`), so the
// first visit is enough to work offline. In development, where no list exists, only the shell is
// precached and other files are cached as they are fetched.
const CACHE = 'openentc-studio-v2';
const SHELL = ['./', './index.html', './src/app.js', './src/styles.css', './manifest.webmanifest', './assets/openentc-icon.svg'];

async function precacheList() {
  try {
    const response = await fetch('./precache.json', { cache: 'no-store' });
    if (response.ok) {
      const list = await response.json();
      if (Array.isArray(list) && list.every((path) => typeof path === 'string' && path.startsWith('./'))) return [...new Set([...SHELL, ...list])];
    }
  } catch { /* fall back to the shell */ }
  return SHELL;
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => cache.addAll(await precacheList())).then(() => self.skipWaiting()));
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
