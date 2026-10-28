/* Sunday Cricket service worker: makes the app installable and keeps working with patchy signal.
   - App files (/_next/static, icons) are cached for speed.
   - Public pages use the network first, falling back to the last copy seen, then an offline page.
   - Nothing is cached for the umpire desk, logins or any API call, so scores are never stale. */
const VERSION = "v3";
const STATIC = `sc-static-${VERSION}`;
const PAGES = `sc-pages-${VERSION}`;
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const PRIVATE = /^\/(admin|login|api)(\/|$)/;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // built app files never change for a given name: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone(); // copy before the page reads the body
          e.waitUntil(caches.open(STATIC).then((c) => c.put(req, copy)));
        }
        return res;
      })),
    );
    return;
  }

  // full page loads
  if (req.mode === "navigate") {
    if (PRIVATE.test(url.pathname)) {
      e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
      return;
    }
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone(); // copy before the page reads the body
            e.waitUntil(caches.open(PAGES).then((c) => c.put(req, copy)).then(() => caches.open(PAGES)).then((c) => trim(c, 40)));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE))),
    );
  }
});

// keep only the most recent pages so the cache stays small
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
