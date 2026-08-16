const CACHE_NAME = 'chauka-v3';

// Assets to cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/app/hub.html',
  '/app/waiter.html',
  '/app/kitchen.html',
  '/app/manager.html',
  '/app/customer.html',
  '/css/style.css',
  '/app/css/waiter.css',
  '/app/css/kitchen.css',
  '/app/css/manager.css',
  '/app/css/customer.css',
  '/app/js/socket-client.js',
  '/app/js/waiter.js',
  '/app/js/kitchen.js',
  '/app/js/manager.js',
  '/app/js/customer.js',
  '/app/js/license-client.js',
  '/manifest.json',
];

// Install event — cache core assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE);
    })
  );
});

// Activate event — clean old caches & take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      }),
      clients.claim(),
    ])
  );
});

// Fetch event — network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip Socket.io and API calls — don't intercept, let the browser handle normally
  if (
    event.request.url.includes('/socket.io/') ||
    event.request.url.includes('/api/')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
