import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  cleanupBrowserProof,
  spawnOwnedProcess,
  waitForOwnedProcessEndpoint,
} from "../../../../scripts/browser-cleanup.mjs";
import { resolveBrowserExecutable } from "../../../../scripts/browser-executable.mjs";

const previewRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commandOrigin = "https://sessioncommand-qbqbamvs6q-lz.a.run.app";
const projectionOrigin = "https://sessionprojection-qbqbamvs6q-lz.a.run.app";
const syntheticSessionId = "synthetic-wp13-12b-browserproof0000000001";
const wait = (milliseconds) =>
  new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

async function waitForPromise(promise, label, timeoutMs = 8_000) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((resolvePromise, rejectPromise) => {
        timeout = setTimeout(
          () => rejectPromise(new Error(`Timed out waiting for ${label}`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function deferred() {
  let resolvePromise;
  const promise = new Promise((resolveDeferred) => {
    resolvePromise = resolveDeferred;
  });
  return Object.freeze({
    promise,
    resolve: resolvePromise,
  });
}

function localeReply(kind, options = {}) {
  const started = deferred();
  const responded = deferred();
  const gate = options.delayed === true ? deferred() : undefined;
  return {
    kind,
    started: started.promise,
    responded: responded.promise,
    signalStarted: started.resolve,
    signalResponded: responded.resolve,
    waitForRelease: gate?.promise,
    release: gate?.resolve ?? (() => {}),
  };
}

function contentType(pathname) {
  switch (extname(pathname)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".mjs":
      return "text/javascript; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function writeResponse(response, status, body, headers = {}) {
  const resolvedBody = body ?? "";
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(resolvedBody),
    ...headers,
  });
  response.end(resolvedBody);
}

function writeJson(response, status, value) {
  writeResponse(response, status, JSON.stringify(value), {
    "content-type": "application/json; charset=utf-8",
  });
}

async function readRequestBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 1024 * 1024) throw new Error("TEST_REQUEST_TOO_LARGE");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function capability(role, expiresAt) {
  const claims = {
    capabilityVersion: "wp13.12b-capability-v1",
    sessionBinding: syntheticSessionId,
    roleBinding: role,
    releaseBinding: "wp13-12b-synthetic-staging-provider-r1",
    authorityGenerationBinding: 1,
    expiresAt,
  };
  return `${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${"s".repeat(64)}`;
}

function childProjection(overrides = {}) {
  return {
    role: "CHILD",
    terminalStatus: "ACTIVE",
    stateVersion: 1,
    locale: "nb-NO",
    wait: false,
    audioStatus: "SILENT",
    helpPending: false,
    canRequestHelp: true,
    canPause: true,
    canStop: true,
    ...overrides,
  };
}

function runtimeConfig() {
  return {
    schemaVersion: "wp13.12b-external-preview-config-v1",
    mode: "EXTERNAL_SYNTHETIC_STAGING",
    syntheticOnly: true,
    studentBeta: "NOT_AUTHORIZED",
    production: "NOT_AUTHORIZED",
    wp13_12c: "BLOCKED",
    commandUrl: commandOrigin,
    projectionUrl: projectionOrigin,
  };
}

async function createLoopbackPreview() {
  let scenario;
  let scenarioNumber = 0;
  const activeReplies = new Set();
  const staticFiles = new Map([
    ["/index.html", "index.html"],
    ["/app.mjs", "app.mjs"],
    ["/styles.css", "styles.css"],
    ["/lib/reviewed-copy.mjs", "lib/reviewed-copy.mjs"],
  ]);

  function beginScenario(options = {}) {
    const expiresAt = options.expiresAt
      ?? new Date(Date.now() + 30 * 60 * 1000).toISOString();
    scenarioNumber += 1;
    scenario = {
      id: scenarioNumber,
      localeQueues: {
        "nb-NO": [...(options.nb ?? [])],
        "nn-NO": [...(options.nn ?? [])],
      },
      localeRequests: [],
      unexpectedLocaleRequests: [],
      requests: [],
      api: {
        runtimeConfig: 0,
        issue: 0,
        delete: 0,
      },
      issueResponse: {
        syntheticSessionId,
        childCapability: capability("CHILD", expiresAt),
        adultCapability: capability("ADULT", expiresAt),
        expiresAt,
      },
      projectionResponse: options.projectionResponse ?? childProjection(),
      stopResponse: options.stopResponse ?? childProjection({
        terminalStatus: "STOPPED",
        stateVersion: 2,
        canRequestHelp: false,
        canPause: false,
        canStop: false,
      }),
    };
    return scenario;
  }

  async function localeSource(locale, reply) {
    const filename = locale === "nb-NO" ? "locales/nb.mjs" : "locales/nn.mjs";
    const source = await readFile(resolve(previewRoot, filename), "utf8");
    if (reply.kind === "valid") return source;
    if (reply.kind === "invalid") {
      return `export const copy = Object.freeze({ locale: ${JSON.stringify(locale)} });\n`;
    }
    if (reply.kind === "missing-key") {
      const incomplete = source.replace(/^  terminalCopy: .*\r?\n/mu, "");
      if (incomplete === source) throw new Error("TEST_COULD_NOT_REMOVE_LOCALE_KEY");
      return incomplete;
    }
    throw new Error(`Unsupported successful locale response: ${reply.kind}`);
  }

  async function handleLocale(request, response, locale, parsedUrl) {
    const reply = scenario?.localeQueues[locale]?.shift();
    scenario?.localeRequests.push({
      locale,
      generation: parsedUrl.searchParams.get("request"),
    });
    if (reply === undefined) {
      scenario?.unexpectedLocaleRequests.push({
        locale,
        generation: parsedUrl.searchParams.get("request"),
      });
      writeResponse(response, 500, "UNPLANNED_LOCALE_REQUEST", {
        "content-type": "text/plain; charset=utf-8",
      });
      return;
    }

    activeReplies.add(reply);
    reply.signalStarted();
    try {
      await reply.waitForRelease;
      if (reply.kind === "reject") {
        writeResponse(response, 503, "export {};\n", {
          "content-type": "text/javascript; charset=utf-8",
        });
        return;
      }
      writeResponse(response, 200, await localeSource(locale, reply), {
        "content-type": "text/javascript; charset=utf-8",
      });
    } finally {
      activeReplies.delete(reply);
      reply.signalResponded();
    }
  }

  const server = createServer((request, response) => {
    void (async () => {
      const parsedUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      scenario?.requests.push({
        method: request.method,
        pathname: parsedUrl.pathname,
        search: parsedUrl.search,
      });

      if (request.method === "GET" && parsedUrl.pathname === "/") {
        writeResponse(
          response,
          302,
          "",
          { location: "/index.html" },
        );
        return;
      }
      if (
        request.method === "GET"
        && parsedUrl.pathname === "/locales/nb.mjs"
      ) {
        await handleLocale(request, response, "nb-NO", parsedUrl);
        return;
      }
      if (
        request.method === "GET"
        && parsedUrl.pathname === "/locales/nn.mjs"
      ) {
        await handleLocale(request, response, "nn-NO", parsedUrl);
        return;
      }
      if (request.method === "GET" && staticFiles.has(parsedUrl.pathname)) {
        const file = staticFiles.get(parsedUrl.pathname);
        writeResponse(
          response,
          200,
          await readFile(resolve(previewRoot, file)),
          { "content-type": contentType(parsedUrl.pathname) },
        );
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname === "/api/runtime-config") {
        scenario.api.runtimeConfig += 1;
        writeJson(response, 200, runtimeConfig());
        return;
      }
      if (request.method === "POST" && parsedUrl.pathname === "/api/issue") {
        await readRequestBody(request);
        scenario.api.issue += 1;
        writeJson(response, 200, scenario.issueResponse);
        return;
      }
      if (request.method === "POST" && parsedUrl.pathname === "/api/delete") {
        await readRequestBody(request);
        scenario.api.delete += 1;
        writeJson(response, 200, {
          terminalStatus: "DELETED",
          audioStatus: "SILENT",
        });
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname === "/favicon.ico") {
        writeResponse(response, 204, "");
        return;
      }
      writeResponse(response, 404, "NOT_FOUND", {
        "content-type": "text/plain; charset=utf-8",
      });
    })().catch((error) => {
      if (!response.headersSent) {
        writeResponse(response, 500, "TEST_SERVER_FAILURE", {
          "content-type": "text/plain; charset=utf-8",
        });
      } else {
        response.destroy(error);
      }
    });
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    origin,
    beginScenario,
    currentScenario() {
      assert.ok(scenario !== undefined, "a scenario must be selected before navigation");
      return scenario;
    },
    assertLocalePlanConsumed() {
      assert.deepEqual(scenario.unexpectedLocaleRequests, []);
      assert.deepEqual(scenario.localeQueues["nb-NO"], []);
      assert.deepEqual(scenario.localeQueues["nn-NO"], []);
    },
    async close() {
      for (const reply of activeReplies) reply.release();
      if (scenario !== undefined) {
        for (const queue of Object.values(scenario.localeQueues)) {
          for (const reply of queue) reply.release();
        }
      }
      server.closeIdleConnections?.();
      await new Promise((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) rejectClose(error);
          else resolveClose();
        });
      });
    },
  };
}

async function reserveLoopbackPort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const port = address.port;
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
  return port;
}

class CdpClient {
  #socket;
  #id = 0;
  #pending = new Map();
  #listeners = new Map();

  constructor(url) {
    this.#socket = new WebSocket(url);
  }

  async open() {
    await new Promise((resolveOpen, rejectOpen) => {
      this.#socket.addEventListener("open", resolveOpen, { once: true });
      this.#socket.addEventListener("error", rejectOpen, { once: true });
    });
    this.#socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id === undefined) {
        for (const listener of this.#listeners.get(message.method) ?? []) {
          listener(message.params ?? {});
        }
        return;
      }
      const pending = this.#pending.get(message.id);
      if (pending === undefined) return;
      this.#pending.delete(message.id);
      if (message.error !== undefined) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result ?? {});
      }
    });
    this.#socket.addEventListener("close", () => {
      for (const pending of this.#pending.values()) {
        pending.reject(new Error("CDP_SOCKET_CLOSED"));
      }
      this.#pending.clear();
    });
  }

  on(method, listener) {
    const listeners = this.#listeners.get(method) ?? [];
    listeners.push(listener);
    this.#listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolveSend, rejectSend) => {
      this.#pending.set(id, {
        resolve: resolveSend,
        reject: rejectSend,
      });
      this.#socket.send(JSON.stringify({
        id,
        method,
        params,
      }));
    });
  }

  close() {
    if (
      this.#socket.readyState === WebSocket.OPEN
      || this.#socket.readyState === WebSocket.CONNECTING
    ) {
      this.#socket.close();
    }
  }
}

function responseHeaders(origin) {
  return [
    { name: "Access-Control-Allow-Origin", value: origin },
    { name: "Access-Control-Allow-Headers", value: "authorization,content-type" },
    { name: "Access-Control-Allow-Methods", value: "POST,OPTIONS" },
    { name: "Cache-Control", value: "no-store" },
    { name: "Content-Type", value: "application/json; charset=utf-8" },
    { name: "Vary", value: "Origin" },
  ];
}

async function openPage({
  browserClient,
  debugOrigin,
  loopback,
}) {
  const descriptorResponse = await fetch(`${debugOrigin}/json/new`, {
    method: "PUT",
  });
  assert.equal(descriptorResponse.ok, true);
  const descriptor = await descriptorResponse.json();
  const client = new CdpClient(descriptor.webSocketDebuggerUrl);
  await client.open();

  const network = {
    externalAttempts: [],
    unexpectedBlocked: [],
    providerIntercepts: [],
    providerPosts: {
      command: 0,
      projection: 0,
    },
    commandKinds: [],
    handlerErrors: [],
    pendingHandlers: new Set(),
    requestUrls: new Map(),
    finishedUrls: [],
  };

  function trackHandler(promise) {
    network.pendingHandlers.add(promise);
    void promise
      .catch((error) => {
        network.handlerErrors.push(error);
      })
      .finally(() => {
        network.pendingHandlers.delete(promise);
      });
  }

  client.on("Network.requestWillBeSent", ({ requestId, request }) => {
    if (request?.url === undefined) return;
    network.requestUrls.set(requestId, request.url);
    if (
      /^https?:/iu.test(request.url)
      && new URL(request.url).origin !== loopback.origin
    ) {
      network.externalAttempts.push({
        method: request.method,
        url: request.url,
      });
    }
  });
  for (const method of ["Network.loadingFinished", "Network.loadingFailed"]) {
    client.on(method, ({ requestId }) => {
      const url = network.requestUrls.get(requestId);
      if (url !== undefined) network.finishedUrls.push(url);
    });
  }

  client.on("Fetch.requestPaused", (event) => {
    trackHandler((async () => {
      const { requestId, request } = event;
      const parsedUrl = new URL(request.url);
      if (parsedUrl.origin === loopback.origin) {
        await client.send("Fetch.continueRequest", { requestId });
        return;
      }

      const providerKind = parsedUrl.origin === commandOrigin
        ? "command"
        : parsedUrl.origin === projectionOrigin ? "projection" : undefined;
      if (
        providerKind !== undefined
        && parsedUrl.pathname === "/"
        && parsedUrl.search === ""
        && parsedUrl.hash === ""
      ) {
        network.providerIntercepts.push({
          kind: providerKind,
          method: request.method,
          url: request.url,
        });
        if (request.method === "OPTIONS") {
          await client.send("Fetch.fulfillRequest", {
            requestId,
            responseCode: 204,
            responseHeaders: responseHeaders(loopback.origin),
          });
          return;
        }
        assert.equal(request.method, "POST");
        network.providerPosts[providerKind] += 1;
        const scenario = loopback.currentScenario();
        let value = scenario.projectionResponse;
        if (providerKind === "command") {
          const body = JSON.parse(request.postData ?? "{}");
          network.commandKinds.push(body.command?.kind);
          value = body.command?.kind === "STOP"
            ? scenario.stopResponse
            : scenario.projectionResponse;
        }
        await client.send("Fetch.fulfillRequest", {
          requestId,
          responseCode: 200,
          responseHeaders: responseHeaders(loopback.origin),
          body: Buffer.from(JSON.stringify(value)).toString("base64"),
        });
        return;
      }

      if (/^https?:$/u.test(parsedUrl.protocol)) {
        network.unexpectedBlocked.push({
          method: request.method,
          url: request.url,
        });
        await client.send("Fetch.failRequest", {
          requestId,
          errorReason: "BlockedByClient",
        });
        return;
      }
      await client.send("Fetch.continueRequest", { requestId });
    })());
  });

  for (const domain of [
    "Page.enable",
    "Runtime.enable",
    "Accessibility.enable",
    "Network.enable",
  ]) {
    await client.send(domain);
  }
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  await client.send("Fetch.enable", {
    patterns: [
      { urlPattern: "http://*/*", requestStage: "Request" },
      { urlPattern: "https://*/*", requestStage: "Request" },
    ],
  });
  await client.send("Page.navigate", {
    url: `${loopback.origin}/index.html?scenario=${loopback.currentScenario().id}`,
  });

  async function evaluate(expression) {
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails !== undefined) {
      throw new Error(
        result.exceptionDetails.exception?.description
          ?? result.exceptionDetails.text
          ?? "EVALUATION_FAILED",
      );
    }
    return result.result?.value;
  }

  async function waitFor(expression, label = expression, timeoutMs = 8_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try {
        if (await evaluate(expression)) return;
      } catch (error) {
        lastError = error;
      }
      await wait(25);
    }
    const detail = lastError instanceof Error ? `; ${lastError.message}` : "";
    throw new Error(`Timed out waiting for ${label}${detail}`);
  }

  async function drainHandlers() {
    while (network.pendingHandlers.size > 0) {
      await Promise.allSettled([...network.pendingHandlers]);
    }
    assert.deepEqual(
      network.handlerErrors.map((error) => error.message),
      [],
    );
  }

  return {
    client,
    descriptor,
    network,
    evaluate,
    waitFor,
    async waitForFinished(url, timeoutMs = 8_000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (network.finishedUrls.includes(url)) return;
        await wait(25);
      }
      throw new Error(`Timed out waiting for network completion: ${url}`);
    },
    async selectLocale(locale) {
      await evaluate(`(() => {
        const locale = document.querySelector("#locale");
        locale.value = ${JSON.stringify(locale)};
        locale.dispatchEvent(new Event("change", { bubbles: true }));
      })()`);
    },
    async click(selector) {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    },
    async key(key, code, windowsVirtualKeyCode, text) {
      await client.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code,
        windowsVirtualKeyCode,
        ...(text === undefined ? {} : { text }),
      });
      await client.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code,
        windowsVirtualKeyCode,
      });
    },
    async accessibilityTree() {
      return client.send("Accessibility.getFullAXTree");
    },
    drainHandlers,
    async close() {
      await drainHandlers();
      try {
        await browserClient.send("Target.closeTarget", {
          targetId: descriptor.id,
        });
      } finally {
        client.close();
      }
    },
  };
}

async function waitForValue(predicate, label, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(25);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function accessibilityNames(tree) {
  return (tree.nodes ?? [])
    .filter((node) => node.ignored !== true)
    .map((node) => node.name?.value)
    .filter((value) => typeof value === "string" && value.length > 0);
}

async function assertLocaleReady(page, copy) {
  const { locale } = copy;
  const htmlLang = locale === "nb-NO" ? "nb" : "nn";
  await page.waitFor(
    `(() => {
      const locale = document.querySelector("#locale");
      const issue = document.querySelector("#issue-session");
      return document.documentElement.lang === ${JSON.stringify(htmlLang)}
        && locale.value === ${JSON.stringify(locale)}
        && !locale.hasAttribute("aria-invalid")
        && issue.disabled === false
        && document.querySelector("#status").textContent === ${JSON.stringify(copy.ready)};
    })()`,
    `${locale} to be operationally ready`,
  );
}

async function assertLocaleFailed(page, options = {}) {
  await page.waitFor(
    `(() => {
      const locale = document.querySelector("#locale");
      return document.documentElement.lang === "und"
        && document.querySelector("#status").textContent === "LOCALE_BUNDLE_INVALID"
        && locale.selectedIndex === -1
        && locale.getAttribute("aria-invalid") === "true";
    })()`,
    "locale failure to close the preview",
  );
  const snapshot = await page.evaluate(`(() => {
    const ordinaryOperations = [
      "#issue-session",
      "#delete-session",
      "#connect-session",
      "#disconnect-session",
      "#refresh-projection",
      "#send-stale",
      "#clear-issued",
      "[data-reveal-capability='CHILD']",
      "[data-reveal-capability='ADULT']",
      "[data-use-issued-role='CHILD']",
      "[data-use-issued-role='ADULT']",
    ].map((selector) => document.querySelector(selector));
    return {
      documentLang: document.documentElement.lang,
      status: document.querySelector("#status").textContent,
      statusRole: document.querySelector("#status").getAttribute("role"),
      statusLive: document.querySelector("#status").getAttribute("aria-live"),
      localeInvalid: document.querySelector("#locale").getAttribute("aria-invalid"),
      localeDescribedBy: document.querySelector("#locale").getAttribute("aria-describedby"),
      localeLabel: document.querySelector("#locale").getAttribute("aria-label"),
      localeDisabled: document.querySelector("#locale").disabled,
      pageTitleHidden: document.querySelector("#page-title").hidden,
      skipLinkHidden: document.querySelector("#skip-link").hidden,
      surfacesHidden: [...document.querySelectorAll("#main-content > :not(#status)")]
        .every((surface) => surface.hidden),
      ordinaryOperationsDisabled: ordinaryOperations.every((operation) => operation.disabled),
      commandsDisabled: [...document.querySelectorAll("[data-command]")]
        .every((command) => command.disabled),
      previousTitleVisible: ${JSON.stringify(options.previousTitle ?? "")}.length > 0
        && document.body.innerText.includes(${JSON.stringify(options.previousTitle ?? "")}),
    };
  })()`);
  assert.deepEqual(snapshot, {
    documentLang: "und",
    status: "LOCALE_BUNDLE_INVALID",
    statusRole: "status",
    statusLive: "polite",
    localeInvalid: "true",
    localeDescribedBy: "status",
    localeLabel: "LOCALE",
    localeDisabled: false,
    pageTitleHidden: true,
    skipLinkHidden: true,
    surfacesHidden: options.activeStop === true ? false : true,
    ordinaryOperationsDisabled: true,
    commandsDisabled: options.activeStop === true ? false : true,
    previousTitleVisible: false,
  });
}

async function assertNetworkContained(page, options = {}) {
  await page.drainHandlers();
  assert.equal(
    page.network.unexpectedBlocked.length,
    options.blockedUnexpected ?? 0,
  );
  const allowedOrigins = new Set(options.allowedProviderOrigins ?? []);
  const blockedAttempts = new Set(
    page.network.unexpectedBlocked.map(({ method, url }) => `${method}\0${url}`),
  );
  for (const attempt of page.network.externalAttempts) {
    if (blockedAttempts.has(`${attempt.method}\0${attempt.url}`)) continue;
    assert.equal(
      allowedOrigins.has(new URL(attempt.url).origin),
      true,
      `uncontained external request attempt: ${attempt.method} ${attempt.url}`,
    );
  }
  for (const blocked of page.network.unexpectedBlocked) {
    assert.equal(new URL(blocked.url).hostname.endsWith(".invalid"), true);
  }
}

test(
  "actual preview fails closed for locale load failures and retains only the active STOP escape",
  { timeout: 240_000 },
  async (t) => {
    const [{ copy: nbCopy }, { copy: nnCopy }] = await Promise.all([
      import("../locales/nb.mjs"),
      import("../locales/nn.mjs"),
    ]);
    const loopback = await createLoopbackPreview();
    const debugPort = await reserveLoopbackPort();
    const debugOrigin = `http://127.0.0.1:${debugPort}`;
    const profile = await mkdtemp(join(tmpdir(), "wp13-12b-locale-fail-closed-"));
    const browser = spawnOwnedProcess(resolveBrowserExecutable(), [
      "--headless=new",
      "--no-sandbox",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-domain-reliability",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-features=AutofillServerCommunication,OptimizationHints,MediaRouter",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-first-run",
      "--no-proxy-server",
      "--password-store=basic",
      "--use-mock-keychain",
      "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ], {
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
    });
    let browserClient;
    const openPages = new Set();

    async function withScenario(options, run) {
      const scenario = loopback.beginScenario(options);
      const page = await openPage({
        browserClient,
        debugOrigin,
        loopback,
      });
      openPages.add(page);
      try {
        await run(page, scenario);
        loopback.assertLocalePlanConsumed();
      } finally {
        openPages.delete(page);
        await page.close();
      }
    }

    try {
      await waitForOwnedProcessEndpoint(`${debugOrigin}/json/version`, {
        child: browser,
        label: "WP13.12B locale fail-closed Chromium",
      });
      const version = await (await fetch(`${debugOrigin}/json/version`)).json();
      browserClient = new CdpClient(version.webSocketDebuggerUrl);
      await browserClient.open();

      await t.test("first-load rejection never exposes the hard-coded BM shell", async () => {
        const rejected = localeReply("reject", { delayed: true });
        await withScenario({ nb: [rejected] }, async (page, scenario) => {
          await waitForPromise(rejected.started, "first rejected NB request");
          const pending = await page.evaluate(`(() => ({
            lang: document.documentElement.lang,
            mainBusy: document.querySelector("#main-content").getAttribute("aria-busy"),
            statusBusy: document.querySelector("#status").getAttribute("aria-busy"),
            status: document.querySelector("#status").textContent,
            titleHidden: document.querySelector("#page-title").hidden,
            skipHidden: document.querySelector("#skip-link").hidden,
            surfacesHidden: [...document.querySelectorAll("#main-content > :not(#status)")]
              .every((surface) => surface.hidden),
            operationsDisabled: [...document.querySelectorAll("button")]
              .every((button) => button.disabled),
            hardCodedBmVisible: document.body.innerText.includes(${JSON.stringify(nbCopy.pageTitle)}),
          }))()`);
          assert.deepEqual(pending, {
            lang: "und",
            mainBusy: "true",
            statusBusy: "true",
            status: "",
            titleHidden: true,
            skipHidden: true,
            surfacesHidden: true,
            operationsDisabled: true,
            hardCodedBmVisible: false,
          });

          rejected.release();
          await waitForPromise(rejected.responded, "first rejected NB response");
          await assertLocaleFailed(page, { previousTitle: nbCopy.pageTitle });
          assert.deepEqual(scenario.api, {
            runtimeConfig: 0,
            issue: 0,
            delete: 0,
          });

          const tree = await page.accessibilityTree();
          const names = accessibilityNames(tree);
          assert.equal(names.includes("LOCALE_BUNDLE_INVALID"), true);
          assert.equal(names.includes(nbCopy.pageTitle), false);

          const probe = await page.evaluate(
            `fetch("https://locale-containment-probe.invalid/probe")`
              + `.then(() => "UNEXPECTED_SUCCESS", () => "BLOCKED")`,
          );
          assert.equal(probe, "BLOCKED");
          await waitForValue(
            () => page.network.unexpectedBlocked.length === 1,
            "the synthetic external containment probe to be counted",
          );
          await assertNetworkContained(page, { blockedUnexpected: 1 });
        });
      });

      for (const kind of ["reject", "invalid", "missing-key"]) {
        await t.test(`BM to NN ${kind} closes every localized surface`, async () => {
          const nnFailure = localeReply(kind);
          await withScenario({
            nb: [localeReply("valid")],
            nn: [nnFailure],
          }, async (page, scenario) => {
            await assertLocaleReady(page, nbCopy);
            assert.equal(
              await page.evaluate("document.querySelector('#page-title').textContent"),
              nbCopy.pageTitle,
            );
            await page.selectLocale("nn-NO");
            await waitForPromise(nnFailure.started, `BM to NN ${kind} request`);
            await assertLocaleFailed(page, { previousTitle: nbCopy.pageTitle });
            const countsBeforeDisabledClicks = { ...scenario.api };
            await page.evaluate(`(() => {
              for (const button of document.querySelectorAll("button:disabled")) button.click();
            })()`);
            assert.deepEqual(scenario.api, countsBeforeDisabledClicks);
            assert.deepEqual(scenario.api, {
              runtimeConfig: 1,
              issue: 0,
              delete: 0,
            });
            assert.deepEqual(
              scenario.localeRequests,
              [
                { locale: "nb-NO", generation: "1" },
                { locale: "nn-NO", generation: "2" },
              ],
            );
            await assertNetworkContained(page);
          });
        });
      }

      await t.test("NN to BM rejection also closes without retaining NN copy", async () => {
        const bmFailure = localeReply("reject");
        await withScenario({
          nb: [localeReply("valid"), bmFailure],
          nn: [localeReply("valid")],
        }, async (page, scenario) => {
          await assertLocaleReady(page, nbCopy);
          await page.selectLocale("nn-NO");
          await assertLocaleReady(page, nnCopy);
          assert.equal(
            await page.evaluate("document.querySelector('#page-title').textContent"),
            nnCopy.pageTitle,
          );
          await page.selectLocale("nb-NO");
          await waitForPromise(bmFailure.started, "NN to BM rejected request");
          await assertLocaleFailed(page, { previousTitle: nnCopy.pageTitle });
          assert.deepEqual(
            scenario.localeRequests,
            [
              { locale: "nb-NO", generation: "1" },
              { locale: "nn-NO", generation: "2" },
              { locale: "nb-NO", generation: "3" },
            ],
          );
          await assertNetworkContained(page);
        });
      });

      await t.test("a stale first BM success cannot overwrite a newer NN commit", async () => {
        const slowBm = localeReply("valid", { delayed: true });
        await withScenario({
          nb: [slowBm],
          nn: [localeReply("valid")],
        }, async (page, scenario) => {
          await waitForPromise(slowBm.started, "delayed BM request");
          await page.selectLocale("nn-NO");
          await assertLocaleReady(page, nnCopy);
          slowBm.release();
          await waitForPromise(slowBm.responded, "delayed BM response");
          await page.waitForFinished(`${loopback.origin}/locales/nb.mjs?request=1`);
          assert.equal(await page.evaluate("document.documentElement.lang"), "nn");
          assert.equal(
            await page.evaluate("document.querySelector('#page-title').textContent"),
            nnCopy.pageTitle,
          );
          assert.equal(
            await page.evaluate("document.querySelector('#locale').getAttribute('aria-invalid')"),
            null,
          );
          assert.deepEqual(
            scenario.localeRequests,
            [
              { locale: "nb-NO", generation: "1" },
              { locale: "nn-NO", generation: "2" },
            ],
          );
          await assertNetworkContained(page);
        });
      });

      await t.test("a stale NN failure cannot close a newer BM commit", async () => {
        const slowNnFailure = localeReply("reject", { delayed: true });
        await withScenario({
          nb: [localeReply("valid"), localeReply("valid")],
          nn: [slowNnFailure],
        }, async (page, scenario) => {
          await assertLocaleReady(page, nbCopy);
          await page.selectLocale("nn-NO");
          await waitForPromise(slowNnFailure.started, "delayed NN request");
          await page.selectLocale("nb-NO");
          await assertLocaleReady(page, nbCopy);
          slowNnFailure.release();
          await waitForPromise(slowNnFailure.responded, "delayed NN response");
          await page.waitForFinished(`${loopback.origin}/locales/nn.mjs?request=2`);
          assert.equal(await page.evaluate("document.documentElement.lang"), "nb");
          assert.equal(
            await page.evaluate("document.querySelector('#page-title').textContent"),
            nbCopy.pageTitle,
          );
          assert.equal(
            await page.evaluate("document.querySelector('#status').textContent"),
            nbCopy.ready,
          );
          assert.deepEqual(
            scenario.localeRequests,
            [
              { locale: "nb-NO", generation: "1" },
              { locale: "nn-NO", generation: "2" },
              { locale: "nb-NO", generation: "3" },
            ],
          );
          await assertNetworkContained(page);
        });
      });

      await t.test(
        "keyboard recovery remains accessible at 320px, 200%, forced colors, and reduced motion",
        async () => {
          const failedNn = localeReply("reject");
          const recoveredNn = localeReply("valid");
          await withScenario({
            nb: [localeReply("valid")],
            nn: [failedNn, recoveredNn],
          }, async (page) => {
            await assertLocaleReady(page, nbCopy);
            await page.selectLocale("nn-NO");
            await waitForPromise(failedNn.started, "failed NN recovery request");
            await assertLocaleFailed(page, { previousTitle: nbCopy.pageTitle });

            const failedTree = await page.accessibilityTree();
            const failedNames = accessibilityNames(failedTree);
            assert.equal(failedNames.includes("LOCALE_BUNDLE_INVALID"), true);
            assert.equal(failedNames.includes(nbCopy.pageTitle), false);

            await page.client.send("Emulation.setDeviceMetricsOverride", {
              width: 320,
              height: 900,
              deviceScaleFactor: 2,
              mobile: true,
            });
            await page.client.send("Emulation.setPageScaleFactor", {
              pageScaleFactor: 2,
            });
            await page.client.send("Emulation.setEmulatedMedia", {
              features: [
                { name: "prefers-reduced-motion", value: "reduce" },
                { name: "forced-colors", value: "active" },
              ],
            });

            await page.evaluate("document.querySelector('#locale').focus()");
            assert.equal(
              await page.evaluate("document.activeElement?.id"),
              "locale",
            );
            await page.key("End", "End", 35);
            await page.key("Enter", "Enter", 13);
            await page.key("Tab", "Tab", 9);
            await waitForPromise(recoveredNn.started, "keyboard NN recovery request");
            await assertLocaleReady(page, nnCopy);

            const responsive = await page.evaluate(`(() => ({
              reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
              forcedColors: matchMedia("(forced-colors: active)").matches,
              noHorizontalOverflow:
                document.documentElement.scrollWidth <= window.innerWidth,
              zoom: window.visualViewport?.scale ?? 1,
              controlsMeetTarget: [...document.querySelectorAll("button, select, a")]
                .filter((node) => node.getClientRects().length > 0)
                .every((node) => {
                  const rect = node.getBoundingClientRect();
                  return rect.width >= 44 && rect.height >= 44;
                }),
            }))()`);
            assert.equal(responsive.reducedMotion, true);
            assert.equal(responsive.forcedColors, true);
            assert.equal(responsive.noHorizontalOverflow, true);
            assert.ok(responsive.zoom >= 2);
            assert.equal(responsive.controlsMeetTarget, true);

            await page.evaluate("document.querySelector('#skip-link').focus()");
            assert.equal(
              await page.evaluate("document.activeElement?.id"),
              "skip-link",
            );
            await page.key("Tab", "Tab", 9);
            assert.equal(
              await page.evaluate("document.activeElement?.id"),
              "locale",
            );
            const recoveredTree = await page.accessibilityTree();
            const recoveredNames = accessibilityNames(recoveredTree);
            assert.equal(recoveredNames.includes(nnCopy.pageTitle), true);
            assert.equal(recoveredNames.includes(nbCopy.pageTitle), false);
            await assertNetworkContained(page);
          });
        },
      );

      await t.test("locale failure remasks and clears every rendered capability", async () => {
        const nnFailure = localeReply("reject");
        await withScenario({
          nb: [localeReply("valid")],
          nn: [nnFailure],
        }, async (page, scenario) => {
          await assertLocaleReady(page, nbCopy);
          await page.click("#issue-session");
          await page.waitFor(
            `!document.querySelector("#issued-session").hidden
              && document.querySelector("#child-capability").value.length >= 64`,
            "issued capabilities to be rendered",
          );
          await page.click("[data-reveal-capability='CHILD']");
          await page.click("[data-reveal-capability='ADULT']");
          await page.evaluate(`(() => {
            document.querySelector("#connect-session-id").value = ${JSON.stringify(syntheticSessionId)};
            document.querySelector("#connect-capability").value = "temporary-sensitive-value";
            document.querySelector("#delete-session-id").value = ${JSON.stringify(syntheticSessionId)};
          })()`);
          assert.deepEqual(
            await page.evaluate(`(() => ({
              childType: document.querySelector("#child-capability").type,
              adultType: document.querySelector("#adult-capability").type,
              childPressed: document.querySelector("[data-reveal-capability='CHILD']")
                .getAttribute("aria-pressed"),
              adultPressed: document.querySelector("[data-reveal-capability='ADULT']")
                .getAttribute("aria-pressed"),
            }))()`),
            {
              childType: "text",
              adultType: "text",
              childPressed: "true",
              adultPressed: "true",
            },
          );

          await page.selectLocale("nn-NO");
          await waitForPromise(nnFailure.started, "sensitive-state NN failure");
          await assertLocaleFailed(page, { previousTitle: nbCopy.pageTitle });
          assert.deepEqual(
            await page.evaluate(`(() => ({
              panelHidden: document.querySelector("#issued-session").hidden,
              issuedSessionId: document.querySelector("#issued-session-id").value,
              childCapability: document.querySelector("#child-capability").value,
              adultCapability: document.querySelector("#adult-capability").value,
              connectSessionId: document.querySelector("#connect-session-id").value,
              connectCapability: document.querySelector("#connect-capability").value,
              deleteSessionId: document.querySelector("#delete-session-id").value,
              childType: document.querySelector("#child-capability").type,
              adultType: document.querySelector("#adult-capability").type,
              childPressed: document.querySelector("[data-reveal-capability='CHILD']")
                .getAttribute("aria-pressed"),
              adultPressed: document.querySelector("[data-reveal-capability='ADULT']")
                .getAttribute("aria-pressed"),
              localStorageKeys: Object.keys(localStorage).length,
              sessionStorageKeys: Object.keys(sessionStorage).length,
            }))()`),
            {
              panelHidden: true,
              issuedSessionId: "",
              childCapability: "",
              adultCapability: "",
              connectSessionId: "",
              connectCapability: "",
              deleteSessionId: "",
              childType: "password",
              adultType: "password",
              childPressed: "false",
              adultPressed: "false",
              localStorageKeys: 0,
              sessionStorageKeys: 0,
            },
          );
          assert.deepEqual(scenario.api, {
            runtimeConfig: 1,
            issue: 1,
            delete: 0,
          });
          await assertNetworkContained(page);
        });
      });

      await t.test("recovery never reuses an expired connected capability", async () => {
        const expiresAt = new Date(Date.now() + 5_000).toISOString();
        const nnFailure = localeReply("reject");
        await withScenario({
          expiresAt,
          nb: [localeReply("valid")],
          nn: [nnFailure, localeReply("valid")],
          projectionResponse: childProjection(),
        }, async (page) => {
          await assertLocaleReady(page, nbCopy);
          await page.click("#issue-session");
          await page.waitFor(
            "!document.querySelector('#issued-session').hidden",
            "issued session before expiry",
          );
          await page.click("[data-use-issued-role='CHILD']");
          await page.waitFor(
            "document.querySelector('#projection-terminal').textContent === 'ACTIVE'",
            "active projection before expiry",
          );
          await page.selectLocale("nn-NO");
          await waitForPromise(nnFailure.started, "pre-expiry NN failure");
          await assertLocaleFailed(page, {
            activeStop: true,
            previousTitle: nbCopy.pageTitle,
          });
          await waitForValue(
            () => Date.now() > Date.parse(expiresAt) + 50,
            "connected capability expiry",
            8_000,
          );
          await page.selectLocale("nn-NO");
          await assertLocaleReady(page, nnCopy);
          assert.deepEqual(
            await page.evaluate(`(() => ({
              commandsDisabled: [...document.querySelectorAll("[data-command]")]
                .every((command) => command.disabled),
              refreshDisabled: document.querySelector("#refresh-projection").disabled,
              staleDisabled: document.querySelector("#send-stale").disabled,
              disconnectDisabled: document.querySelector("#disconnect-session").disabled,
              issuedPanelHidden: document.querySelector("#issued-session").hidden,
              childCapability: document.querySelector("#child-capability").value,
              adultCapability: document.querySelector("#adult-capability").value,
            }))()`),
            {
              commandsDisabled: true,
              refreshDisabled: true,
              staleDisabled: true,
              disconnectDisabled: false,
              issuedPanelHidden: true,
              childCapability: "",
              adultCapability: "",
            },
          );
          await page.click("[data-command='STOP']");
          await wait(100);
          assert.equal(page.network.providerPosts.command, 0);
          await assertNetworkContained(page, {
            allowedProviderOrigins: [projectionOrigin],
          });
        });
      });

      await t.test("an active session retains only one synthetic STOP escape", async () => {
        const nnFailure = localeReply("reject");
        await withScenario({
          nb: [localeReply("valid")],
          nn: [nnFailure],
          projectionResponse: childProjection(),
        }, async (page, scenario) => {
          await assertLocaleReady(page, nbCopy);
          await page.click("#issue-session");
          await page.waitFor(
            "!document.querySelector('#issued-session').hidden",
            "issued session controls",
          );
          await page.click("[data-use-issued-role='CHILD']");
          await page.waitFor(
            `document.querySelector("#projection-terminal").textContent === "ACTIVE"
              && document.querySelector("[data-command='STOP']").disabled === false`,
            "active CHILD projection",
          );
          assert.equal(page.network.providerPosts.projection, 1);

          await page.selectLocale("nn-NO");
          await waitForPromise(nnFailure.started, "active-session NN failure");
          await assertLocaleFailed(page, {
            activeStop: true,
            previousTitle: nbCopy.pageTitle,
          });
          const stopOnly = await page.evaluate(`(() => {
            const stop = document.querySelector("[data-command='STOP']");
            const controls = document.querySelector("#controls-title").closest("section");
            return {
              controlsHidden: controls.hidden,
              stopHidden: stop.hidden,
              stopDisabled: stop.disabled,
              stopText: stop.textContent,
              otherCommandsHidden: [...document.querySelectorAll("[data-command]")]
                .filter((command) => command !== stop)
                .every((command) => command.hidden),
              otherCommandsDisabled: [...document.querySelectorAll("[data-command]")]
                .filter((command) => command !== stop)
                .every((command) => command.disabled),
            };
          })()`);
          assert.deepEqual(stopOnly, {
            controlsHidden: false,
            stopHidden: false,
            stopDisabled: false,
            stopText: "STOP",
            otherCommandsHidden: true,
            otherCommandsDisabled: true,
          });

          const failedTree = await page.accessibilityTree();
          const failedNames = accessibilityNames(failedTree);
          assert.equal(failedNames.includes("STOP"), true);
          assert.equal(failedNames.includes("LOCALE_BUNDLE_INVALID"), true);
          assert.equal(failedNames.includes(nbCopy.pageTitle), false);

          await page.click("[data-command='STOP']");
          await waitForValue(
            () => page.network.providerPosts.command === 1,
            "the intercepted safety STOP command",
          );
          await page.waitFor(
            `document.querySelector("[data-command='STOP']").disabled
              && document.querySelector("#controls-title").closest("section").hidden`,
            "STOP completion to remove the emergency escape",
          );
          assert.deepEqual(page.network.commandKinds, ["STOP"]);
          assert.deepEqual(page.network.providerPosts, {
            command: 1,
            projection: 1,
          });
          assert.equal(
            await page.evaluate("document.querySelector('#status').textContent"),
            "LOCALE_BUNDLE_INVALID",
          );
          assert.deepEqual(scenario.api, {
            runtimeConfig: 1,
            issue: 1,
            delete: 0,
          });
          await assertNetworkContained(page, {
            allowedProviderOrigins: [commandOrigin, projectionOrigin],
          });
        });
      });
    } finally {
      for (const page of openPages) {
        try {
          await page.close();
        } catch {
          // The primary failure remains authoritative; browser cleanup is still attempted below.
        }
      }
      let cleanupError;
      try {
        await cleanupBrowserProof({
          browser,
          browserLabel: "WP13.12B locale fail-closed Chromium",
          client: browserClient,
          profile,
          requestBrowserClose: browserClient === undefined
            ? undefined
            : () => browserClient.send("Browser.close"),
        });
      } catch (error) {
        cleanupError = error;
      }
      try {
        await loopback.close();
      } catch (error) {
        cleanupError ??= error;
      }
      if (cleanupError !== undefined) throw cleanupError;
    }
  },
);
