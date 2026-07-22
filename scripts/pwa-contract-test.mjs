import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(repo, "web", "manifest.webmanifest");
const workerPath = join(repo, "web", "service-worker.js");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const workerSource = await readFile(workerPath, "utf8");
const origin = "http://127.0.0.1:4185";

function absoluteUrl(input) {
  if (typeof input === "string") return new URL(input, origin).href;
  return input.url;
}

class FakeRequest {
  constructor(input, init = {}) {
    this.url = absoluteUrl(input);
    this.method = init.method ?? input?.method ?? "GET";
    this.mode = init.mode ?? input?.mode ?? "same-origin";
    this.cache = init.cache;
    this.credentials = init.credentials;
  }
}

class FakeCache {
  entries = new Map();

  async put(request, response) {
    this.entries.set(absoluteUrl(request), response.clone());
  }

  async match(request) {
    return this.entries.get(absoluteUrl(request))?.clone();
  }
}

function createWorkerRuntime(options = {}) {
  const listeners = new Map();
  const cacheStore = new Map();
  let offline = false;
  let claimed = 0;
  let skipped = 0;
  const failurePaths = new Set(options.failurePaths ?? []);
  const caches = {
    open: async (name) => {
      if (!cacheStore.has(name)) cacheStore.set(name, new FakeCache());
      return cacheStore.get(name);
    },
    keys: async () => [...cacheStore.keys()],
    delete: async (name) => cacheStore.delete(name),
    match: async (request) => {
      for (const cache of cacheStore.values()) {
        const response = await cache.match(request);
        if (response !== undefined) return response;
      }
      return undefined;
    },
  };
  const workerSelf = {
    location: { origin },
    clients: { claim: async () => { claimed += 1; } },
    skipWaiting: () => { skipped += 1; },
    addEventListener: (type, listener) => { listeners.set(type, listener); },
  };
  const fetch = async (request) => {
    const url = new URL(absoluteUrl(request));
    if (offline) throw new Error("synthetic offline");
    if (failurePaths.has(url.pathname)) return new Response("missing", { status: 404 });
    if (url.pathname === "/web/corpus-lifecycle-policy.json") {
      return new Response(JSON.stringify({
        policyRevision: 1,
        restrictions: [],
        containsPersonData: false,
        resurrectionAllowed: false,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/web/authoring-lifecycle-policy.json") {
      return new Response(JSON.stringify({
        policyRevision: 1,
        restrictions: [],
        containsPersonData: false,
        resurrectionAllowed: false,
        publishingAuthority: false,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(`shell:${url.pathname}`, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  };
  vm.runInNewContext(workerSource, {
    Request: FakeRequest,
    Response,
    Set,
    URL,
    caches,
    fetch,
    self: workerSelf,
  }, { filename: workerPath });

  async function dispatchLifecycle(type) {
    let completion;
    listeners.get(type)?.({ waitUntil: (promise) => { completion = Promise.resolve(promise); } });
    await completion;
  }

  async function dispatchFetch(request) {
    let responsePromise;
    listeners.get("fetch")?.({
      request,
      respondWith: (promise) => { responsePromise = Promise.resolve(promise); },
    });
    return responsePromise === undefined ? undefined : responsePromise;
  }

  async function dispatchMessage(data, ports = []) {
    let completion;
    listeners.get("message")?.({
      data,
      ports,
      waitUntil: (promise) => { completion = Promise.resolve(promise); },
    });
    await completion;
  }

  return {
    cacheStore,
    caches,
    claimed: () => claimed,
    dispatchFetch,
    dispatchLifecycle,
    dispatchMessage,
    setOffline: (value) => { offline = value; },
    skipped: () => skipped,
  };
}

test("manifest is installable, local, scoped and project-specific", async () => {
  assert.equal(manifest.id, "/web/");
  assert.equal(manifest.name, "LUDYS – lokal syntetisk demonstrasjon");
  assert.equal(manifest.short_name, "LUDYS");
  assert.equal(manifest.start_url, "/web/index.html");
  assert.equal(manifest.scope, "/web/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "nb");
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.ok(manifest.description.length > 20);
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
  for (const icon of manifest.icons) {
    assert.equal(new URL(icon.src, origin).origin, origin);
    await stat(join(repo, icon.src.replace(/^\//, "")));
  }
});

test("service worker install caches the deterministic shell and fails on a missing critical file", async () => {
  const runtime = createWorkerRuntime();
  await runtime.dispatchLifecycle("install");
  const cacheNames = await runtime.caches.keys();
  assert.deepEqual(cacheNames.sort(), [
    "ludys-authoring-policy-1",
    "ludys-content-policy-1",
    "ludys-shell-0.14.0-reconstructed.6",
  ]);
  const shellCache = runtime.cacheStore.get("ludys-shell-0.14.0-reconstructed.6");
  assert.ok(shellCache.entries.size >= 30);
  assert.ok(shellCache.entries.has(`${origin}/web/index.html`));
  assert.ok(shellCache.entries.has(`${origin}/dist/src/ui/browser/app.js`));
  assert.ok(shellCache.entries.has(`${origin}/dist/src/ui/browser/pwa-status.js`));

  const missingRuntime = createWorkerRuntime({ failurePaths: ["/web/styles.css"] });
  await assert.rejects(
    () => missingRuntime.dispatchLifecycle("install"),
    /Critical LUDYS shell resource failed: \/web\/styles\.css \(404\)/,
  );
});

test("activate removes only obsolete LUDYS shell caches", async () => {
  const runtime = createWorkerRuntime();
  await runtime.dispatchLifecycle("install");
  await runtime.caches.open("ludys-shell-obsolete");
  await runtime.caches.open("unrelated-application-cache");
  await runtime.dispatchLifecycle("activate");
  assert.deepEqual(
    (await runtime.caches.keys()).sort(),
    ["ludys-authoring-policy-1", "ludys-content-policy-1", "ludys-shell-0.14.0-reconstructed.6", "unrelated-application-cache"],
  );
  assert.equal(runtime.claimed(), 1);
});

test("offline navigation falls back to cached shell without caching unknown requests", async () => {
  const runtime = createWorkerRuntime();
  await runtime.dispatchLifecycle("install");
  runtime.setOffline(true);
  const navigation = await runtime.dispatchFetch({
    method: "GET",
    mode: "navigate",
    url: `${origin}/web/local-route`,
  });
  assert.equal(await navigation.text(), "shell:/web/index.html");
  const staticResponse = await runtime.dispatchFetch({
    method: "GET",
    mode: "same-origin",
    url: `${origin}/web/styles.css`,
  });
  assert.equal(await staticResponse.text(), "shell:/web/styles.css");
  assert.equal(await runtime.dispatchFetch({
    method: "GET",
    mode: "same-origin",
    url: `${origin}/web/not-in-shell.txt`,
  }), undefined);
});

test("mutating and external requests are never intercepted or cached", async () => {
  const runtime = createWorkerRuntime();
  await runtime.dispatchLifecycle("install");
  const before = [...runtime.cacheStore.values()]
    .reduce((total, cache) => total + cache.entries.size, 0);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(await runtime.dispatchFetch({
      method,
      mode: "same-origin",
      url: `${origin}/web/session`,
    }), undefined);
  }
  assert.equal(await runtime.dispatchFetch({
    method: "GET",
    mode: "cors",
    url: "https://example.invalid/external.js",
  }), undefined);
  const after = [...runtime.cacheStore.values()]
    .reduce((total, cache) => total + cache.entries.size, 0);
  assert.equal(after, before);
});

test("update activation is message-controlled and never automatic", async () => {
  const runtime = createWorkerRuntime();
  assert.equal(runtime.skipped(), 0);
  await runtime.dispatchMessage({ type: "UNRELATED" });
  assert.equal(runtime.skipped(), 0);
  await runtime.dispatchMessage({ type: "LUDYS_ACTIVATE_UPDATE" });
  assert.equal(runtime.skipped(), 1);
  assert.equal((workerSource.match(/self\.skipWaiting\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(workerSource, /caches\.match\(/);
  assert.match(workerSource, /caches\.open\(LUDYS_SHELL_CACHE\)/);
});

test("restrictive corpus policy survives offline reload and cannot be relaxed by cache", async () => {
  const runtime = createWorkerRuntime();
  await runtime.dispatchLifecycle("install");
  let reply;
  await runtime.dispatchMessage({
    type: "LUDYS_APPLY_RESTRICTIVE_CORPUS_POLICY",
    policy: {
      policyRevision: 2,
      restrictions: [{
        scope: "ACTIVITY",
        scopeId: "activity-nor-single-final-ris-sil-001",
        lifecycleStatus: "WITHDRAWN",
      }],
      containsPersonData: false,
      resurrectionAllowed: false,
    },
  }, [{ postMessage: (value) => { reply = value; } }]);
  assert.equal(reply?.ok, true);
  await runtime.dispatchMessage({
    type: "LUDYS_APPLY_RESTRICTIVE_CORPUS_POLICY",
    policy: {
      policyRevision: 3,
      restrictions: [],
      containsPersonData: false,
      resurrectionAllowed: false,
    },
  });
  runtime.setOffline(true);
  const response = await runtime.dispatchFetch({
    method: "GET",
    mode: "same-origin",
    url: `${origin}/web/corpus-lifecycle-policy.json`,
  });
  const persisted = await response.json();
  assert.equal(persisted.resurrectionAllowed, false);
  assert.deepEqual(persisted.restrictions, [{
    scope: "ACTIVITY",
    scopeId: "activity-nor-single-final-ris-sil-001",
    lifecycleStatus: "WITHDRAWN",
  }]);
});

test("restrictive authoring and audio policy survives offline reload without resurrection", async () => {
  const runtime = createWorkerRuntime();
  await runtime.dispatchLifecycle("install");
  let reply;
  await runtime.dispatchMessage({
    type: "LUDYS_APPLY_RESTRICTIVE_AUTHORING_POLICY",
    policy: {
      policyRevision: 2,
      restrictions: [
        { scope: "AUTHORING_PACKAGE", scopeId: "authoring-package-activity-nor-single-final-ris-sil-001", lifecycleStatus: "WITHDRAWN" },
        { scope: "AUDIO_SPEC", scopeId: "audio-draft-ris-nb-target", lifecycleStatus: "WITHDRAWN" },
      ],
      containsPersonData: false,
      resurrectionAllowed: false,
      publishingAuthority: false,
    },
  }, [{ postMessage: (value) => { reply = value; } }]);
  assert.equal(reply?.ok, true);
  await runtime.dispatchMessage({
    type: "LUDYS_APPLY_RESTRICTIVE_AUTHORING_POLICY",
    policy: { policyRevision: 3, restrictions: [], containsPersonData: false, resurrectionAllowed: false, publishingAuthority: false },
  });
  runtime.setOffline(true);
  const response = await runtime.dispatchFetch({ method: "GET", mode: "same-origin", url: `${origin}/web/authoring-lifecycle-policy.json` });
  const persisted = await response.json();
  assert.equal(persisted.resurrectionAllowed, false);
  assert.equal(persisted.publishingAuthority, false);
  assert.equal(persisted.restrictions.length, 2);
  assert.ok(persisted.restrictions.every((item) => item.lifecycleStatus === "WITHDRAWN"));
});

test("terminal offline fallback copy is explicitly human-reviewed in contract", () => {
  assert.match(workerSource, /LUDYS_OFFLINE_FAILURE_COPY/);
  assert.match(workerSource, /humanReviewed:\s*true/);
  assert.match(workerSource, /reviewSource:\s*"WP13\.7C_SCOPE_2026-07-21"/);
});

test("cache inventory contains no session, user, profile, API or external origin", async () => {
  const runtime = createWorkerRuntime();
  await runtime.dispatchLifecycle("install");
  const urls = [...runtime.cacheStore.values()]
    .flatMap((cache) => [...cache.entries.keys()]);
  assert.ok(urls.every((url) => new URL(url).origin === origin));
  assert.ok(urls.every((url) => /\.(?:html|css|js|json|svg|webmanifest|wav)$/i.test(new URL(url).pathname)));
  assert.ok(urls.every((url) => !/\/(?:api|users?|students?|profiles?|sessions?)\//i.test(new URL(url).pathname)));
  assert.doesNotMatch(workerSource, /localStorage|indexedDB|\bsync\b|\bpush\b|Notification/);
});
