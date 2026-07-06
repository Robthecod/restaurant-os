const CACHE_NAME = 'restaurant-os-v1';

// Assets to cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/waiter.html',
  '/kitchen.html',
  '/manager.html',
  '/css/style.css',
  '/css/waiter.css',
  '/css/kitchen.css',
  '/css/manager.css',
  '/js/socket-client.js',
  '/js/waiter.js',
  '/js/kitchen.js',
  '/js/manager.js',
  '/manifest.json',
];

// Install event — cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE);
    })
  );
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch event — network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip Socket.io and API calls
  if (
    event.request.url.includes('/socket.io/') ||
    event.request.url.includes('/api/')
  ) {
    return fetch(event.request);
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
