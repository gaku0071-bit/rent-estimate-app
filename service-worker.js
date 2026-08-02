const CACHE_NAME = "rent-estimate-v49";
const APP_SHELL = ["/", "/index.html", "/styles.css?v=20260802-3", "/app.js?v=20260802-3", "/app-patch.js?v=20260726-2", "/manifest.json", "/icon.svg", "/store-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET"
    || url.pathname.startsWith("/api/")
    || url.pathname.endsWith(".zip")
    || url.pathname.endsWith("/extension-version.json")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
