import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupBrowserProof,
  spawnOwnedProcess,
  waitForOwnedProcessEndpoint,
} from "./browser-cleanup.mjs";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const serverPort = 4185;
const debugPort = 9338;
const profile = await mkdtemp(join(tmpdir(), "wp13-7c-chromium-"));
const browserExecutable = resolveBrowserExecutable();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  #socket;
  #id = 0;
  #pending = new Map();
  constructor(url) { this.#socket = new WebSocket(url); }
  async open() {
    await new Promise((resolve, reject) => {
      this.#socket.addEventListener("open", resolve, { once: true });
      this.#socket.addEventListener("error", reject, { once: true });
    });
    this.#socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id === undefined) return;
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
    });
  }
  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.#socket.close(); }
}

const server = spawnOwnedProcess(process.execPath, ["scripts/serve-proof.mjs"], {
  cwd: repo,
  env: { ...process.env, PORT: String(serverPort) },
  stdio: ["ignore", "ignore", "ignore"],
});
const browser = spawnOwnedProcess(browserExecutable, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--no-proxy-server",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "ignore"] });

let client;
try {
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${serverPort}/web/index.html`, {
    child: server,
    label: "WP13.7C proof server",
  });
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${debugPort}/json/version`, {
    child: browser,
    label: "Chromium WP13.7C offline proof",
  });
  const create = await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: "PUT" });
  assert.equal(create.ok, true);
  const page = await create.json();
  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.open();
  await client.send("Page.enable");
  await client.send("Page.bringToFront");
  await client.send("Runtime.enable");
  await client.send("Network.enable");
  await client.send("Accessibility.enable");
  await client.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/web/index.html` });

  async function evaluate(expression) {
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "browser evaluation failed");
    }
    return result.result?.value;
  }

  async function waitForExpression(expression, attempts = 600) {
    for (let index = 0; index < attempts; index += 1) {
      try {
        if (await evaluate(expression)) return;
      } catch (error) {
        if (!/context|target|navigation|detached|closed/i.test(String(error))) throw error;
      }
      await wait(50);
    }
    throw new Error(`Timed out waiting for browser expression: ${expression}`);
  }

  async function press(selector) {
    assert.equal(await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), true, selector);
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await client.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: " ", code: "Space", text: " ", unmodifiedText: " ",
      windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32,
    });
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32,
    });
    await wait(30);
  }

  const pressAction = (action) => press(`[data-app-action=${action}]`);

  await waitForExpression("document.documentElement?.dataset.wp13_7cReady === 'true'");
  await waitForExpression("document.documentElement?.dataset.wp13_8Ready === 'true'");
  await waitForExpression("document.querySelector('#pwa-status')?.dataset.worker === 'READY'");
  await waitForExpression("navigator.serviceWorker.controller !== null");
  assert.equal(await evaluate("navigator.serviceWorker.controller.scriptURL.endsWith('/web/service-worker.js')"), true);

  const manifest = await client.send("Page.getAppManifest");
  assert.match(manifest.url, /\/web\/manifest\.webmanifest$/);
  assert.deepEqual(manifest.errors ?? [], []);
  const installability = await client.send("Page.getInstallabilityErrors");
  assert.deepEqual(installability.installabilityErrors ?? [], []);

  const cacheProof = await evaluate(`(async () => {
    const names = await caches.keys();
    const name = names.find((candidate) => candidate === 'ludys-shell-0.14.0-reconstructed.6');
    if (!name) return { names, urls: [] };
    const cache = await caches.open(name);
    return { names, urls: (await cache.keys()).map((request) => new URL(request.url).pathname) };
  })()`);
  assert.ok(cacheProof.names.includes("ludys-shell-0.14.0-reconstructed.6"));
  assert.ok(cacheProof.urls.length >= 20);
  assert.ok(cacheProof.urls.includes("/web/index.html"));
  assert.ok(cacheProof.urls.includes("/dist/src/ui/browser/app.js"));

  for (const action of ["create", "role-child", "finish-loading", "start"]) await pressAction(action);
  const onlineActiveId = await evaluate("window.__WP13_7B__.getSessionId()");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "ACTIVE");
  assert.equal(await evaluate("document.querySelector('[data-app-action=stop]').getBoundingClientRect().height >= 44"), true);

  await client.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: "none",
  });
  await client.send("Network.overrideNetworkState", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: "none",
  });
  await evaluate("window.dispatchEvent(new Event('offline'))");
  await waitForExpression("document.querySelector('#pwa-status')?.dataset.network === 'OFFLINE'");
  await client.send("Page.reload", { ignoreCache: true });
  await waitForExpression("document.documentElement?.dataset.wp13_7cReady === 'true'");
  await waitForExpression("document.documentElement?.dataset.wp13_8Ready === 'true'");
  await evaluate("window.dispatchEvent(new Event('offline'))");
  await waitForExpression("document.querySelector('#pwa-status')?.dataset.network === 'OFFLINE'");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().screen"), "WELCOME");
  assert.notEqual(await evaluate("window.__WP13_7B__.getSessionId()"), onlineActiveId);
  assert.match(await evaluate("document.querySelector('#pwa-network-status').textContent"), /Uten nett/);
  assert.match(await evaluate("document.querySelector('#pwa-local-status').textContent"), /nettleserminnet/);
  assert.doesNotMatch(await evaluate("document.querySelector('#pwa-status').textContent"), /synkroniserer|synkronisert/i);

  for (const action of ["create", "role-child", "finish-loading", "start"]) await pressAction(action);
  await pressAction("wait");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "WAITING");
  await pressAction("resume");
  await pressAction("pause");
  await pressAction("resume");
  await pressAction("stop");
  const offlineTerminalId = await evaluate("window.__WP13_7B__.getSessionId()");
  await pressAction("reconnect");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "STOPPED");
  await pressAction("delete");
  await pressAction("reconnect");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "DELETED");

  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: "wifi",
  });
  await client.send("Network.overrideNetworkState", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: "wifi",
  });
  await evaluate("window.dispatchEvent(new Event('online'))");
  await waitForExpression("document.querySelector('#pwa-status')?.dataset.network === 'ONLINE'");
  await pressAction("reconnect");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "DELETED");
  await pressAction("new-session");
  const postOfflineId = await evaluate("window.__WP13_7B__.getSessionId()");
  assert.notEqual(postOfflineId, offlineTerminalId);
  assert.notEqual(postOfflineId, onlineActiveId);

  await evaluate(`navigator.serviceWorker.register('/web/service-worker-update-proof.js', {
    scope: '/web/', updateViaCache: 'none'
  })`);
  await waitForExpression("document.querySelector('#pwa-status')?.dataset.update === 'READY'");
  assert.equal(await evaluate("document.querySelector('#pwa-apply-update').disabled"), false);
  await press("#pwa-apply-update");
  await waitForExpression("document.documentElement?.dataset.wp13_7cReady === 'true'");
  await waitForExpression("document.documentElement?.dataset.wp13_8Ready === 'true'");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().screen"), "WELCOME");
  assert.notEqual(await evaluate("window.__WP13_7B__.getSessionId()"), offlineTerminalId);

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 320, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  assert.ok((await evaluate("window.visualViewport?.scale ?? 1")) >= 2);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  const roles = (ax.nodes ?? []).map((node) => node.role?.value).filter(Boolean);
  assert.ok(names.some((name) => /Lokal appstatus/.test(name)));
  assert.ok(roles.includes("status"));
  assert.ok(roles.includes("button"));

  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await mkdir(join(repo, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png", fromSurface: true, captureBeyondViewport: true,
  });
  await writeFile(
    join(repo, "artifacts", "wp13-7c-local-pwa-offline-shell.png"),
    Buffer.from(screenshot.data, "base64"),
  );
  console.log("Chromium WP13.7C installable PWA, offline shell, controlled update and no-resurrection proof passed.");
} finally {
  await cleanupBrowserProof({
    browser,
    browserLabel: "Chromium WP13.7C offline proof",
    client,
    profile,
    requestBrowserClose: client === undefined
      ? undefined
      : () => client.send("Browser.close"),
    server,
    serverLabel: "WP13.7C proof server",
  });
}
