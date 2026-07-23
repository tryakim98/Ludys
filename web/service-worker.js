const LUDYS_CACHE_PREFIX = "ludys-shell-";
const LUDYS_CACHE_VERSION = "0.14.0-reconstructed.8";
const LUDYS_SHELL_CACHE = `${LUDYS_CACHE_PREFIX}${LUDYS_CACHE_VERSION}`;
const LUDYS_CONTENT_POLICY_CACHE = "ludys-content-policy-1";
const LUDYS_CONTENT_POLICY_PATH = "/web/corpus-lifecycle-policy.json";
const LUDYS_AUTHORING_POLICY_CACHE = "ludys-authoring-policy-1";
const LUDYS_AUTHORING_POLICY_PATH = "/web/authoring-lifecycle-policy.json";
const LUDYS_SCOPE_PATH = "/web/";
const LUDYS_NAVIGATION_FALLBACK = "/web/index.html";
const LUDYS_NAVIGATION_TIMEOUT_MS = 1500;
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
  "/dist/src/ui/browser/authoring-workspace-templates.js",
  "/dist/src/ui/browser/beta-operations-templates.js",
  "/dist/src/ui/browser/runtime-safety.js",
  "/dist/src/composition/create-synthetic-app-navigation.js",
  "/dist/src/composition/create-authoring-pipeline.js",
  "/dist/src/composition/create-beta-operations.js",
  "/dist/src/adapters/in-memory/fixed-clock.js",
  "/dist/src/adapters/in-memory/in-memory-session-lifecycle.js",
  "/dist/src/application/synthetic-app-navigation-controller.js",
  "/dist/src/application/draft-corpus-controller.js",
  "/dist/src/application/authoring-pipeline-controller.js",
  "/dist/src/application/beta-operations-controller.js",
  "/dist/src/application/session-lifecycle-controller.js",
  "/dist/src/content/fixtures/bm/word-proof-content.js",
  "/dist/src/content/fixtures/bm/word-proof.js",
  "/dist/src/content/fixtures/nn/word-proof-content.js",
  "/dist/src/content/fixtures/nn/word-proof.js",
  "/dist/src/content/prototype/legacy-projections.js",
  "/dist/src/content/prototype/knowledge-audio-release.js",
  "/dist/src/content/corpus/wp13-8-draft-corpus.js",
  "/dist/src/content/authoring/wp13-9-authoring-packages.js",
  "/dist/src/content/authoring/wp13-9-technical-audio-fixtures.js",
  "/dist/src/content/prototype/wp13-10-release-state.js",
  "/dist/src/content/prototype/wp13-11-release-state.js",
  "/dist/src/content/operations/wp13-11-operations-kit.js",
  "/dist/src/core/content-contracts.js",
  "/dist/src/core/draft-learning-corpus.js",
  "/dist/src/core/authoring-pipeline.js",
  "/dist/src/core/beta-operations.js",
  "/dist/src/core/evidence.js",
  "/dist/src/core/reliability-hardening.js",
  "/dist/src/core/release-hardening.js",
  "/dist/src/core/runtime-safety.js",
  "/dist/src/core/session-lifecycle.js",
  "/dist/src/core/state.js",
  "/dist/src/core/word-proof.js",
  "/web/audio/technical/wp13-9-technical-tone-a-48k-24bit-mono.wav",
  "/web/audio/technical/wp13-9-technical-tone-b-48k-16bit-mono.wav"
]);
const LUDYS_STATIC_PATHS = new Set(LUDYS_APP_SHELL);

function isRestrictiveCorpusPolicy(policy) {
  return policy !== null
    && typeof policy === "object"
    && Number.isInteger(policy.policyRevision)
    && policy.policyRevision >= 1
    && policy.containsPersonData === false
    && policy.resurrectionAllowed === false
    && Array.isArray(policy.restrictions)
    && policy.restrictions.every((restriction) =>
      restriction !== null
      && typeof restriction === "object"
      && ["PATTERN_CLASS", "ACTIVITY"].includes(restriction.scope)
      && typeof restriction.scopeId === "string"
      && restriction.scopeId.length > 0
      && ["STALE", "SUPERSEDED", "WITHDRAWN"].includes(restriction.lifecycleStatus));
}

function mergeRestrictiveCorpusPolicies(current, incoming) {
  const priority = { STALE: 1, SUPERSEDED: 2, WITHDRAWN: 3 };
  const restrictions = new Map();
  for (const restriction of [...current.restrictions, ...incoming.restrictions]) {
    const key = `${restriction.scope}:${restriction.scopeId}`;
    const existing = restrictions.get(key);
    if (existing === undefined || priority[restriction.lifecycleStatus] > priority[existing.lifecycleStatus]) {
      restrictions.set(key, restriction);
    }
  }
  return {
    policyRevision: Math.max(current.policyRevision, incoming.policyRevision),
    restrictions: [...restrictions.values()],
    containsPersonData: false,
    resurrectionAllowed: false,
  };
}

function isRestrictiveAuthoringPolicy(policy) {
  return policy !== null
    && typeof policy === "object"
    && Number.isInteger(policy.policyRevision)
    && policy.policyRevision >= 1
    && policy.containsPersonData === false
    && policy.resurrectionAllowed === false
    && policy.publishingAuthority === false
    && Array.isArray(policy.restrictions)
    && policy.restrictions.every((restriction) =>
      restriction !== null
      && typeof restriction === "object"
      && ["AUTHORING_PACKAGE", "AUDIO_SPEC"].includes(restriction.scope)
      && typeof restriction.scopeId === "string"
      && restriction.scopeId.length > 0
      && ["STALE", "SUPERSEDED", "WITHDRAWN"].includes(restriction.lifecycleStatus));
}

function mergeRestrictiveAuthoringPolicies(current, incoming) {
  const priority = { STALE: 1, SUPERSEDED: 2, WITHDRAWN: 3 };
  const restrictions = new Map();
  for (const restriction of [...current.restrictions, ...incoming.restrictions]) {
    const key = `${restriction.scope}:${restriction.scopeId}`;
    const existing = restrictions.get(key);
    if (existing === undefined || priority[restriction.lifecycleStatus] > priority[existing.lifecycleStatus]) restrictions.set(key, restriction);
  }
  return {
    policyRevision: Math.max(current.policyRevision, incoming.policyRevision),
    restrictions: [...restrictions.values()],
    containsPersonData: false,
    resurrectionAllowed: false,
    publishingAuthority: false,
  };
}

function corpusPolicyResponse(policy) {
  return new Response(JSON.stringify(policy), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readCorpusPolicy(response) {
  const policy = await response.clone().json();
  if (!isRestrictiveCorpusPolicy(policy)) throw new Error("Invalid restrictive LUDYS corpus policy");
  return policy;
}

async function cachedCorpusPolicy(cache) {
  const response = await cache.match(LUDYS_CONTENT_POLICY_PATH);
  return response === undefined ? undefined : readCorpusPolicy(response);
}

async function storeCorpusPolicy(policy) {
  if (!isRestrictiveCorpusPolicy(policy)) throw new Error("Rejected non-restrictive LUDYS corpus policy");
  const cache = await caches.open(LUDYS_CONTENT_POLICY_CACHE);
  const current = await cachedCorpusPolicy(cache) ?? {
    policyRevision: 1,
    restrictions: [],
    containsPersonData: false,
    resurrectionAllowed: false,
  };
  const merged = mergeRestrictiveCorpusPolicies(current, policy);
  await cache.put(LUDYS_CONTENT_POLICY_PATH, corpusPolicyResponse(merged));
  return merged;
}

async function installCorpusPolicy() {
  const response = await fetch(new Request(LUDYS_CONTENT_POLICY_PATH, {
    cache: "reload",
    credentials: "same-origin",
  }));
  if (!response.ok) throw new Error(`Critical LUDYS corpus policy failed (${response.status})`);
  const policy = await readCorpusPolicy(response);
  await storeCorpusPolicy(policy);
}

function authoringPolicyResponse(policy) {
  return new Response(JSON.stringify(policy), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function readAuthoringPolicy(response) {
  const policy = await response.clone().json();
  if (!isRestrictiveAuthoringPolicy(policy)) throw new Error("Invalid restrictive LUDYS authoring policy");
  return policy;
}

async function cachedAuthoringPolicy(cache) {
  const response = await cache.match(LUDYS_AUTHORING_POLICY_PATH);
  return response === undefined ? undefined : readAuthoringPolicy(response);
}

async function storeAuthoringPolicy(policy) {
  if (!isRestrictiveAuthoringPolicy(policy)) throw new Error("Rejected non-restrictive LUDYS authoring policy");
  const cache = await caches.open(LUDYS_AUTHORING_POLICY_CACHE);
  const current = await cachedAuthoringPolicy(cache) ?? {
    policyRevision: 1,
    restrictions: [],
    containsPersonData: false,
    resurrectionAllowed: false,
    publishingAuthority: false,
  };
  const merged = mergeRestrictiveAuthoringPolicies(current, policy);
  await cache.put(LUDYS_AUTHORING_POLICY_PATH, authoringPolicyResponse(merged));
  return merged;
}

async function installAuthoringPolicy() {
  const response = await fetch(new Request(LUDYS_AUTHORING_POLICY_PATH, { cache: "reload", credentials: "same-origin" }));
  if (!response.ok) throw new Error(`Critical LUDYS authoring policy failed (${response.status})`);
  await storeAuthoringPolicy(await readAuthoringPolicy(response));
}

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
  await installCorpusPolicy();
  await installAuthoringPolicy();
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LUDYS_NAVIGATION_TIMEOUT_MS);
  try {
    const response = await fetch(new Request(request, { signal: controller.signal }));
    if (!response.ok) throw new Error(`Navigation HTTP ${response.status}`);
    return response;
  } catch {
    const cached = await matchCurrentLudysShell(LUDYS_NAVIGATION_FALLBACK);
    return cached ?? new Response(
      LUDYS_OFFLINE_FAILURE_COPY.text,
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function staticResponse(request) {
  const cached = await matchCurrentLudysShell(request);
  return cached ?? fetch(request);
}

async function contentPolicyResponse(request) {
  const cache = await caches.open(LUDYS_CONTENT_POLICY_CACHE);
  const current = await cachedCorpusPolicy(cache);
  try {
    const networkResponse = await fetch(request);
    if (!networkResponse.ok) throw new Error(`Corpus policy HTTP ${networkResponse.status}`);
    const incoming = await readCorpusPolicy(networkResponse);
    const merged = current === undefined
      ? incoming
      : mergeRestrictiveCorpusPolicies(current, incoming);
    await cache.put(LUDYS_CONTENT_POLICY_PATH, corpusPolicyResponse(merged));
    return corpusPolicyResponse(merged);
  } catch (error) {
    if (current !== undefined) return corpusPolicyResponse(current);
    throw error;
  }
}

async function authoringPolicyNetworkResponse(request) {
  const cache = await caches.open(LUDYS_AUTHORING_POLICY_CACHE);
  const current = await cachedAuthoringPolicy(cache);
  try {
    const networkResponse = await fetch(request);
    if (!networkResponse.ok) throw new Error(`Authoring policy HTTP ${networkResponse.status}`);
    const incoming = await readAuthoringPolicy(networkResponse);
    const merged = current === undefined ? incoming : mergeRestrictiveAuthoringPolicies(current, incoming);
    await cache.put(LUDYS_AUTHORING_POLICY_PATH, authoringPolicyResponse(merged));
    return authoringPolicyResponse(merged);
  } catch (error) {
    if (current !== undefined) return authoringPolicyResponse(current);
    throw error;
  }
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
  if (url.pathname === LUDYS_CONTENT_POLICY_PATH) {
    event.respondWith(contentPolicyResponse(request));
    return;
  }
  if (url.pathname === LUDYS_AUTHORING_POLICY_PATH) {
    event.respondWith(authoringPolicyNetworkResponse(request));
    return;
  }
  if (request.mode === "navigate" && url.pathname.startsWith(LUDYS_SCOPE_PATH)) {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (LUDYS_STATIC_PATHS.has(url.pathname)) {
    event.respondWith(staticResponse(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "LUDYS_ACTIVATE_UPDATE") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "LUDYS_CLEAR_SHELL_CACHE") {
    event.waitUntil(caches.delete(LUDYS_SHELL_CACHE)
      .then((cleared) => event.ports?.[0]?.postMessage({ ok: true, cleared }))
      .catch((error) => event.ports?.[0]?.postMessage({ ok: false, error: String(error) })));
    return;
  }
  if (event.data?.type === "LUDYS_APPLY_RESTRICTIVE_AUTHORING_POLICY") {
    event.waitUntil(storeAuthoringPolicy(event.data.policy)
      .then((policy) => event.ports?.[0]?.postMessage({ ok: true, policy }))
      .catch((error) => event.ports?.[0]?.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })));
    return;
  }
  if (event.data?.type !== "LUDYS_APPLY_RESTRICTIVE_CORPUS_POLICY") return;
  event.waitUntil(storeCorpusPolicy(event.data.policy)
    .then((policy) => event.ports?.[0]?.postMessage({ ok: true, policy }))
    .catch((error) => event.ports?.[0]?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })));
});
