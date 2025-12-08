// Versioned cache name so we can easily invalidate older caches on deploys
const CACHE_NAME = "transafe-driver-pwa-v2";

// A basic "offline shell" URL we can fall back to if navigation fails
const OFFLINE_URL = "/driver";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  // Activate this service worker immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

// Fetch handler:
// - For navigations (HTML pages): network-first, fallback to cache/offline shell.
// - For other GET requests (assets/API): cache-first with network fallback.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  // 1) Handle navigations (page loads) with NETWORK-FIRST
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Try to get the latest page from the network
          const networkResponse = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch (error) {
          // If network fails (offline), try cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // If not in cache, fall back to a basic offline shell
          const offlineResponse = await caches.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }

          // As a last resort, just throw the error
          throw error;
        }
      })()
    );

    return;
  }

  // 2) For non-navigation GET requests (assets) use CACHE-FIRST
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          // Only cache successful, basic responses
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== "basic"
          ) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return networkResponse;
        })
        .catch(() => {
          // If network fails and nothing in cache, just give up for this request
          return cachedResponse;
        });
    })
  );
});
