const CACHE_NAME = 'pwa-currency-v1';
const DATA_CACHE = 'pwa-currency-data-v1';

const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json',
  '/file.svg'
];

self.addEventListener('install', (evt) => {
  console.log('[ServiceWorker] Install');
  self.skipWaiting();
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (evt) => {
  console.log('[ServiceWorker] Activate');
  evt.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME && key !== DATA_CACHE) {
            console.log('[ServiceWorker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  const { request } = evt;
  const url = new URL(request.url);

  // Network-first for API requests to our /api/price
  if (url.pathname.startsWith('/api/price')) {
    evt.respondWith(
      caches.open(DATA_CACHE).then((cache) => {
        return fetch(request)
          .then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => {
            return cache.match(request);
          });
      })
    );
    return;
  }

  // Otherwise, cache-first for app shell
  evt.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).then((res) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, res.clone());
          return res;
        });
      });
    })
  );
});
