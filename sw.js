// Service Worker for David King Gym PWA
// Caches the app shell for offline use.
// Strategy: cache-first for app shell, network-first for everything else.

const CACHE_NAME = 'dk-gym-v5';
const APP_SHELL = [
  './',
  './fitness-crm.html',
  './exercise-db.json',
  './food-db.json',
  './manifest.json',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for app shell, network-first otherwise
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Skip non-GET (POST/PUT for IndexedDB sync)
  if (req.method !== 'GET') return;

  // Skip chrome-extension and external URLs
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Cache-first for our own files
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          // Cache successful responses
          if (res.ok && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => {
          // Fix: return cached if available, otherwise a proper Response (not undefined)
          if (cached) return cached;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
    );
  }
  // Network-first for external (images, etc.)
  else {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    );
  }
});

// Listen for messages from the page (e.g., "skip waiting" for updates)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
