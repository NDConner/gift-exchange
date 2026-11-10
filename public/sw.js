// Minimal, privacy-conscious service worker: enables installability and speeds
// up static build assets. It never caches pages or data (which are personal) —
// those always go to the network.
const CACHE = "ww-static-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // never touch Supabase / external calls

  // Cache only static build assets (immutable, non-personal). Everything else
  // (navigations, RSC, /api) passes straight through to the network.
  const cacheable = ["script", "style", "image", "font"].includes(request.destination);
  if (!cacheable) return;

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.match(request);
        return cached || Response.error();
      }
    })(),
  );
});
