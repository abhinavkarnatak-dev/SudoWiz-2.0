/**
 * Kill switch for a stale service worker.
 *
 * Sudowiz is not a PWA and registers no service worker. But `localhost:3000` is
 * a shared origin across every project on this machine, and a PWA served here
 * earlier left a service worker registered against it. That worker kept
 * intercepting requests and answering them from its own cache, so the browser
 * ran an old JS bundle while the dev server happily served the new one:
 * hydration mismatches, UI changes that never appeared, and fixes that looked
 * like they had not been applied.
 *
 * Serving this file at /sw.js replaces that worker with one whose only job is
 * to delete every cache, unregister itself, and reload open tabs so they pick
 * up the real assets. Once it has run, the origin is clean.
 *
 * Do not delete this until you are sure no stale registration survives on any
 * browser or phone that has opened a project on this port. It costs nothing to
 * keep: with no worker registered, nothing ever requests it.
 */
self.addEventListener("install", () => {
  // Take over immediately instead of waiting for existing tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));

      await self.registration.unregister();

      // Reload any open tab so it refetches through the network, not the
      // worker that is about to disappear.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});

// While this worker is still alive, never answer from a cache.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
