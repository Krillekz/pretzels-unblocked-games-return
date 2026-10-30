/* =====================================================================
   Pretzel's Unblocked Games: RETURN — offline shell cache
   Caches the local shell, data and assets only. Game frames and any
   third-party request stay on the network and are never intercepted.
   Bump CACHE when a cached runtime file changes. v6 = the 1.3.1 BETA shell
   with the AI Rehaul engines, the 18+ age gate and network-first code.
   ===================================================================== */

"use strict";

const CACHE = "pretzel-shell-v6";
const SHELL = [
  "./",
  "./index.html",
  "./css/shell.css",
  "./js/app.js",
  "./js/settings.js",
  "./js/ai.js",
  "./data/config.json",
  "./data/library.json",
  "./assets/pretzel-crest.svg",
  "./assets/fonts/chakra-petch-600.woff2",
  "./assets/fonts/chakra-petch-700.woff2",
  "./sw.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key.startsWith("pretzel-shell-")).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    if (fallbackKey && response.ok) cache.put(fallbackKey, response.clone());
    return response;
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) || (fallbackKey ? caches.match(fallbackKey) : null) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline and not cached.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }
  if (url.pathname.endsWith("/data/config.json") || url.pathname.endsWith("/data/library.json")) {
    event.respondWith(networkFirst(request));
    return;
  }
  /* Code and styles are network-first: a cache-first match on an unversioned
     precached copy served a stale engine after a deploy. Fonts and images can
     stay cache-first because they rarely change and are not executable. */
  if (/\.(?:js|css)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
