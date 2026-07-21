import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupBrowserProof, spawnOwnedProcess } from "./browser-cleanup.mjs";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const serverPort = 4174;
const debugPort = 9336;
const profile = await mkdtemp(join(tmpdir(), "wp13-7a-chromium-"));
const browserExecutable = resolveBrowserExecutable();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url, attempts = 100) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

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
  await waitFor(`http://127.0.0.1:${serverPort}/web/session-lifecycle.html`);
  await waitFor(`http://127.0.0.1:${debugPort}/json/version`);
  const create = await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: "PUT" });
  assert.equal(create.ok, true);
  const page = await create.json();
  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.open();
  await client.send("Page.enable");
  await client.send("Page.bringToFront");
  await client.send("Runtime.enable");
  await client.send("Accessibility.enable");
  await client.send("Page.navigate", {
    url: `http://127.0.0.1:${serverPort}/web/session-lifecycle.html`,
  });

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

  async function waitForExpression(expression, attempts = 100) {
    for (let index = 0; index < attempts; index += 1) {
      if (await evaluate(expression)) return;
      await wait(50);
    }
    throw new Error(`Timed out waiting for browser expression: ${expression}`);
  }

  async function pressEnter(selector) {
    assert.equal(await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), true, selector);
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await client.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: " ",
      code: "Space",
      text: " ",
      unmodifiedText: " ",
      windowsVirtualKeyCode: 32,
      nativeVirtualKeyCode: 32,
    });
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: " ",
      code: "Space",
      windowsVirtualKeyCode: 32,
      nativeVirtualKeyCode: 32,
    });
    await wait(30);
  }

  async function pressAction(action) {
    await pressEnter(`[data-lifecycle-action=${action}]`);
  }

  async function reloadProof() {
    await client.send("Page.reload", { ignoreCache: true });
    await waitForExpression("document.documentElement?.dataset.lifecycleReady === 'true'");
  }

  await waitForExpression("document.documentElement?.dataset.lifecycleReady === 'true'");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "NOT_CREATED");
  assert.equal(await evaluate("document.querySelector('[data-synthetic-marker]')?.dataset.syntheticMarker"), "SYNTHETIC_TECHNICAL_DRAFT");
  assert.match(await evaluate("document.body.textContent"), /DRAFT_TECHNICAL_COPY/);
  assert.match(await evaluate("document.querySelector('#lifecycle-state').textContent"), /Tom/);
  assert.equal(await evaluate("document.querySelectorAll('audio').length"), 0);

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate(`[...document.querySelectorAll('button, select')].filter((node) => node.getClientRects().length > 0).every((node) => { const r = node.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })`), true);
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);

  await evaluate("document.body.focus()");
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement?.classList.contains('skip-link')"), true);
  assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none'"), true);

  await pressEnter("[data-lifecycle-role=ADULT]");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().role"), "ADULT");
  assert.equal(await evaluate("document.activeElement?.id"), "lifecycle-title");
  assert.equal(await evaluate("document.querySelector('[data-session-reference]') !== null"), true);
  await pressEnter("[data-lifecycle-role=CHILD]");
  assert.equal(await evaluate("document.querySelector('[data-session-reference]') === null"), true);

  await pressAction("CREATE");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "CREATING");
  assert.match(await evaluate("document.querySelector('#lifecycle-state').textContent"), /Laster/);
  assert.equal(await evaluate("document.activeElement?.id"), "lifecycle-state");
  await pressAction("CREATED");
  await pressAction("ACTIVATE");
  await pressAction("REQUEST_HELP");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "WAITING");
  assert.match(await evaluate("document.querySelector('[data-child-cue]').textContent"), /menneske/);
  await pressAction("PAUSE");
  await pressAction("RESUME");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "WAITING");
  await pressAction("RESUME");
  await pressAction("STOP");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "STOPPED");
  await pressAction("RECONNECT");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "STOPPED");
  await pressAction("DELETE");
  await pressAction("RECONNECT");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "DELETED");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().error.code"), "TOMBSTONE");
  assert.equal(await evaluate("document.activeElement?.id"), "lifecycle-error");

  await reloadProof();
  for (const action of ["CREATE", "CREATED", "ACTIVATE", "DETECT_STALE"]) await pressAction(action);
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "STALE");
  await pressAction("BEGIN_RECOVERY");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "RECOVERING");
  await pressAction("RECOVERY_SUCCEEDED");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "ACTIVE");
  await pressAction("DETECT_INVALID");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "INVALID");
  await pressAction("BEGIN_RECOVERY");
  await pressAction("RECOVERY_FAILED");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "INVALID");
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().error.code"), "RECOVERY_FAILED");
  assert.equal(await evaluate("document.activeElement?.id"), "lifecycle-error");

  await reloadProof();
  for (const action of ["CREATE", "CREATED", "ACTIVATE", "COMPLETE"]) await pressAction(action);
  assert.equal(await evaluate("window.__WP13_7A__.getViewModel().state"), "COMPLETED");

  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  assert.ok((await evaluate("window.visualViewport?.scale ?? 1")) >= 2);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);

  await evaluate(`(() => { const select = document.querySelector('#lifecycle-locale'); select.value = 'nn-NO'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  assert.equal(await evaluate("document.documentElement.lang"), "nn");
  assert.match(await evaluate("document.querySelector('#lifecycle-state').textContent"), /ikkje oppretta/);

  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  const roles = (ax.nodes ?? []).map((node) => node.role?.value).filter(Boolean);
  assert.ok(names.some((name) => /Tilstand: NOT_CREATED/.test(name)));
  assert.ok(names.some((name) => /Barnet si tekniske visning/.test(name)));
  assert.ok(names.some((name) => /Den vaksne si tekniske visning/.test(name)));
  assert.ok(roles.includes("status"));
  assert.ok(roles.includes("button"));

  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await mkdir(join(repo, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
  });
  await writeFile(
    join(repo, "artifacts", "wp13-7a-session-lifecycle.png"),
    Buffer.from(screenshot.data, "base64"),
  );
  console.log("Chromium WP13.7A lifecycle, keyboard, role, recovery, terminal and responsive proof passed.");
} finally {
  await cleanupBrowserProof({
    browser,
    browserLabel: "Chromium WP13.7A lifecycle proof",
    client,
    profile,
    requestBrowserClose: client === undefined
      ? undefined
      : () => client.send("Browser.close"),
    server,
    serverLabel: "WP13.7A proof server",
  });
}
