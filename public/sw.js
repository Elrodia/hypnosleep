/**
 * HypnoSleep Service Worker
 *
 * Provides offline caching for the app shell (HTML, CSS, JS, fonts, icons)
 * so the PWA is installable and loads instantly on repeat visits.
 *
 * Audio and API requests are NOT cached — they always go to the network.
 */

const CACHE_NAME = "hypnosleep-v1";

const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
];

/* ---------- Install ---------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ---------- Activate ---------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- Fetch ---------- */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API calls, SSE streams, or auth routes.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    request.method !== "GET"
  ) {
    return;
  }

  // Network-first for navigation requests so users always get fresh HTML.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Stale-while-revalidate for static assets (JS, CSS, images, fonts).
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Network failed — return cached version if available, otherwise
          // let the browser handle the failure normally.
          if (cached) return cached;
          return new Response("Network error", {
            status: 408,
            headers: { "Content-Type": "text/plain" },
          });
        });

      return cached || networkFetch;
    })
  );
});
