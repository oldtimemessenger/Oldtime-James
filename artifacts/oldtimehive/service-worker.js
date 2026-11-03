// Build placeholders are filled by pwa-build.ts, including hashed JS/CSS names.
const BUILD_VERSION = "__BUILD_VERSION__";
const CACHE_NAME = `old-time-shell-${BUILD_VERSION}`;
const RUNTIME_CACHE_NAME = "old-time-runtime-assets-v1";
const RUNTIME_CACHE_LIMIT = 48;
const SHELL_FILES = ["__PRECACHE_FILES__"];
const SHELL_URLS = new Set(SHELL_FILES.map(path => new URL(path, self.registration.scope).href));
const INDEX_URL = new URL("./index.html", self.registration.scope).href;
const ASSETS_PATH = new URL("./assets/", self.registration.scope).pathname;
const HASHED_ASSET = /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i;

async function fetchCachedBuildAsset(request) {
  let cache;
  try {
    cache = await caches.open(RUNTIME_CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
  } catch {
    return fetch(request);
  }

  const response = await fetch(request);
  if (response.ok && response.type === "basic" &&
      response.headers.get("cache-control")?.includes("immutable")) {
    try {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      const overflow = keys.length - RUNTIME_CACHE_LIMIT;
      if (overflow > 0) {
        await Promise.all(keys.slice(0, overflow).map(key => cache.delete(key)));
      }
    } catch {
      // Storage pressure must not prevent an asset from loading.
    }
  }
  return response;
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([...SHELL_URLS])));
  // Do not forcibly replace the worker during an active edit or upload.
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("old-time-shell-") && key !== CACHE_NAME)
        .map(key => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  // Private responses, API data, writes, and media uploads must never be cached.
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      request.headers.has("Authorization") || /^\/api(?:\/|$)/.test(url.pathname)) return;
  if (request.mode === "navigate" &&
      (url.href.split("?")[0] === self.registration.scope || url.href.split("?")[0] === INDEX_URL)) {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match(INDEX_URL)) || Response.error()));
    return;
  }
  if (SHELL_URLS.has(url.href)) {
    event.respondWith(caches.match(request).then(response => response || fetch(request)));
    return;
  }
  // Lazy feature chunks are cached only after use, so first install does not
  // download maps, charts, video helpers, or background-removal code.
  if (url.pathname.startsWith(ASSETS_PATH) && HASHED_ASSET.test(url.pathname)) {
    event.respondWith(fetchCachedBuildAsset(request));
  }
});
