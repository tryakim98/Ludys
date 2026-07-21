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
const serverPort = 4184;
const debugPort = 9337;
const profile = await mkdtemp(join(tmpdir(), "wp13-7b-chromium-"));
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
    label: "WP13.7B proof server",
  });
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${debugPort}/json/version`, {
    child: browser,
    label: "Chromium WP13.7B full app proof",
  });
  const create = await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: "PUT" });
  assert.equal(create.ok, true);
  const page = await create.json();
  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.open();
  await client.send("Page.enable");
  await client.send("Page.bringToFront");
  await client.send("Runtime.enable");
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

  async function waitForExpression(expression, attempts = 100) {
    for (let index = 0; index < attempts; index += 1) {
      if (await evaluate(expression)) return;
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
  const pressRole = (role) => press(`[data-app-role=${role}]`);

  await waitForExpression("document.documentElement.dataset.wp13_7bReady === 'true'");
  assert.match(await evaluate("location.pathname"), /\/web\/index\.html$/);
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().screen"), "WELCOME");
  assert.equal(await evaluate("document.querySelector('[data-synthetic-marker]')?.dataset.syntheticMarker"), "SYNTHETIC_TECHNICAL_DRAFT");
  assert.match(await evaluate("document.body.textContent"), /syntetisk proof-innhold/i);
  assert.match(await evaluate("document.body.textContent"), /Ingen innlogging.*nettverkstjeneste.*produksjonslagring/i);

  await client.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate(`[...document.querySelectorAll('button, select')].filter((node) => node.getClientRects().length > 0).every((node) => { const r = node.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })`), true);
  await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
  await evaluate("document.body.focus()");
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement?.classList.contains('skip-link')"), true);
  assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none'"), true);

  await pressAction("create");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().screen"), "ROLE_SELECTION");
  await pressAction("role-child");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().screen"), "LOADING");
  await pressAction("finish-loading");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().screen"), "ORIENTATION");
  await pressAction("start");
  const firstId = await evaluate("window.__WP13_7B__.getSessionId()");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "ACTIVE");

  await press("[data-tile-id=sol-s]");
  await pressRole("ADULT");
  assert.equal(await evaluate("document.querySelector('[data-session-reference]').textContent"), firstId);
  assert.match(await evaluate("document.body.textContent"), /Barnets konkrete valg.*s/is);
  assert.equal(await evaluate("document.querySelector('.adult-card') === null"), true);
  await pressRole("CHILD");
  assert.deepEqual(await evaluate("window.__WP13_7B__.getViewModel().selectedGraphemes"), ["s"]);

  await pressAction("quiet");
  assert.match(await evaluate("document.body.textContent"), /Systemet kan være stille/);
  await pressAction("pause");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "PAUSED");
  assert.equal(await evaluate("document.activeElement?.id"), "screen-title");
  await pressAction("resume");
  await pressAction("wait");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "WAITING");
  await pressAction("resume");
  await pressAction("help");
  await pressRole("ADULT");
  assert.equal(await evaluate("document.querySelector('.adult-card') !== null"), true);
  assert.match(await evaluate("document.querySelector('.human-decision').textContent"), /Et menneske må vurdere/);
  await pressAction("adult-model");
  assert.match(await evaluate("document.body.textContent"), /ADULT: MODEL/);
  await pressAction("resume");
  await pressRole("CHILD");
  assert.match(await evaluate("document.querySelector('.model-panel').textContent"), /sol/);

  await pressAction("detect-stale");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "STALE");
  await pressAction("begin-recovery");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "RECOVERING");
  await pressAction("finish-recovery");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "ACTIVE");
  assert.equal(await evaluate("window.__WP13_7B__.getSessionId()"), firstId);

  await pressAction("stop");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "STOPPED");
  assert.equal(await evaluate("document.activeElement?.id"), "screen-title");
  await pressAction("reconnect");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "STOPPED");
  assert.match(await evaluate("document.querySelector('.terminal-proof').textContent"), /ikke gjenopplivet/);
  await pressAction("delete");
  await pressAction("reconnect");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "DELETED");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lastErrorCode"), "TOMBSTONE");
  await pressAction("new-session");
  const secondId = await evaluate("window.__WP13_7B__.getSessionId()");
  assert.notEqual(secondId, firstId);
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().screen"), "WELCOME");

  for (const action of ["create", "role-child", "finish-loading", "start"]) await pressAction(action);
  assert.deepEqual(await evaluate("window.__WP13_7B__.getViewModel().selectedGraphemes"), []);
  for (const tile of ["sol-s", "sol-o", "sol-l"]) await press(`[data-tile-id=${tile}]`);
  await pressAction("submit");
  await pressRole("ADULT");
  await pressAction("confirm-reading");
  await pressRole("CHILD");
  for (const tile of ["mus-m", "mus-u", "mus-s"]) await press(`[data-tile-id=${tile}]`);
  await pressAction("submit");
  await pressRole("ADULT");
  await pressAction("confirm-reading");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "COMPLETED");
  assert.match(await evaluate("document.querySelector('#screen-title').textContent"), /Nøktern oppsummering/);

  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  assert.ok((await evaluate("window.visualViewport?.scale ?? 1")) >= 2);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  const roles = (ax.nodes ?? []).map((node) => node.role?.value).filter(Boolean);
  assert.ok(names.some((name) => /Nøktern oppsummering/.test(name)));
  assert.ok(names.some((name) => /Slett den lokale økten/.test(name)));
  assert.ok(roles.includes("main"));
  assert.ok(roles.includes("button"));

  await pressAction("delete");
  await pressAction("reconnect");
  await pressAction("new-session");
  const thirdId = await evaluate("window.__WP13_7B__.getSessionId()");
  assert.notEqual(thirdId, secondId);
  await evaluate(`(() => { const select = document.querySelector('#app-locale'); select.value = 'nn-NO'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  assert.equal(await evaluate("document.documentElement.lang"), "nn");
  assert.match(await evaluate("document.querySelector('#screen-title').textContent"), /Velkomen/);

  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await mkdir(join(repo, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
  await writeFile(join(repo, "artifacts", "wp13-7b-full-app-navigation.png"), Buffer.from(screenshot.data, "base64"));
  console.log("Chromium WP13.7B full app journey, roles, Human-First, recovery, terminal and accessibility proof passed.");
} finally {
  await cleanupBrowserProof({
    browser,
    browserLabel: "Chromium WP13.7B full app proof",
    client,
    profile,
    requestBrowserClose: client === undefined
      ? undefined
      : () => client.send("Browser.close"),
    server,
    serverLabel: "WP13.7B proof server",
  });
}
