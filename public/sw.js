const VERSION = new URL(self.location.href).searchParams.get("v") || "development";
const CACHE_NAME = `buku-warung-shell-${VERSION.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
const BASE_SHELL = ["/manifest.webmanifest", "/icons/icon-192x192.png", "/icons/icon-512x512.png"];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(BASE_SHELL);
}

self.addEventListener("install", event => {
  event.waitUntil(precacheAppShell());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Authenticated HTML must never be cached or replayed to another account.
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }

  event.respondWith(fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match(request)));
});
