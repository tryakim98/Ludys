const LUDYS_CACHE_PREFIX = "ludys-shell-";
const LUDYS_CACHE_VERSION = "0.14.0-reconstructed.4";
const LUDYS_SHELL_CACHE = `${LUDYS_CACHE_PREFIX}${LUDYS_CACHE_VERSION}`;
const LUDYS_SCOPE_PATH = "/web/";
const LUDYS_NAVIGATION_FALLBACK = "/web/index.html";
const LUDYS_OFFLINE_FAILURE_COPY = Object.freeze({
  text: "Det lokale LUDYS-appskallet er ikke tilgjengelig ennå.",
  humanReviewed: true,
  reviewSource: "WP13.7C_SCOPE_2026-07-21",
});
const LUDYS_APP_SHELL = Object.freeze([
  "/web/index.html",
  "/web/styles.css",
  "/web/manifest.webmanifest",
  "/web/icons/ludys-192.svg",
  "/web/icons/ludys-maskable.svg",
  "/dist/src/ui/browser/app.js",
  "/dist/src/ui/browser/pwa-status.js",
  "/dist/src/ui/browser/synthetic-app-navigation-templates.js",
  "/dist/src/composition/create-synthetic-app-navigation.js",
  "/dist/src/adapters/in-memory/fixed-clock.js",
  "/dist/src/adapters/in-memory/in-memory-session-lifecycle.js",
  "/dist/src/application/synthetic-app-navigation-controller.js",
  "/dist/src/application/session-lifecycle-controller.js",
  "/dist/src/content/fixtures/bm/word-proof-content.js",
  "/dist/src/content/fixtures/bm/word-proof.js",
  "/dist/src/content/fixtures/nn/word-proof-content.js",
  "/dist/src/content/fixtures/nn/word-proof.js",
  "/dist/src/content/prototype/legacy-projections.js",
  "/dist/src/content/prototype/knowledge-audio-release.js",
  "/dist/src/core/content-contracts.js",
  "/dist/src/core/session-lifecycle.js",
  "/dist/src/core/word-proof.js"
]);
const LUDYS_STATIC_PATHS = new Set(LUDYS_APP_SHELL);

async function installLudysShell() {
  const cache = await caches.open(LUDYS_SHELL_CACHE);
  for (const path of LUDYS_APP_SHELL) {
    const request = new Request(path, {
      cache: "reload",
      credentials: "same-origin",
    });
    const response = await fetch(request);
    if (!response.ok) {
      throw new Error(`Critical LUDYS shell resource failed: ${path} (${response.status})`);
    }
    await cache.put(request, response);
  }
}

async function activateLudysShell() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames
    .filter((name) => name.startsWith(LUDYS_CACHE_PREFIX) && name !== LUDYS_SHELL_CACHE)
    .map((name) => caches.delete(name)));
  await self.clients.claim();
}

async function matchCurrentLudysShell(request) {
  const cache = await caches.open(LUDYS_SHELL_CACHE);
  return cache.match(request);
}

async function navigationResponse(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await matchCurrentLudysShell(LUDYS_NAVIGATION_FALLBACK);
    return cached ?? new Response(
      LUDYS_OFFLINE_FAILURE_COPY.text,
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
}

async function staticResponse(request) {
  const cached = await matchCurrentLudysShell(request);
  return cached ?? fetch(request);
}

self.addEventListener("install", (event) => {
  event.waitUntil(installLudysShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(activateLudysShell());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && url.pathname.startsWith(LUDYS_SCOPE_PATH)) {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (LUDYS_STATIC_PATHS.has(url.pathname)) {
    event.respondWith(staticResponse(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "LUDYS_ACTIVATE_UPDATE") self.skipWaiting();
});
