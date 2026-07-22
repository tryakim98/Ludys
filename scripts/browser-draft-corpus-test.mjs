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
const serverPort = 4186;
const debugPort = 9339;
const profile = await mkdtemp(join(tmpdir(), "wp13-8-corpus-chromium-"));
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
    label: "WP13.8 corpus proof server",
  });
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${debugPort}/json/version`, {
    child: browser,
    label: "Chromium WP13.8 corpus proof",
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
  const pressRole = (role) => press(`[data-app-role=${role}]`);
  const pressClass = (classId) => press(`[data-pattern-class-id=${classId}]`);
  const pressMode = (mode) => press(`button[data-corpus-mode=${mode}]`);

  async function buildVisibleWord() {
    const tileIds = await evaluate("[...document.querySelectorAll('[data-tile-id]')].map((node) => node.dataset.tileId)");
    assert.ok(tileIds.length >= 3);
    for (const tileId of tileIds) await press(`[data-tile-id=${JSON.stringify(tileId)}]`);
    await pressAction("submit");
  }

  async function newOrientation() {
    for (const action of ["create", "role-child", "finish-loading"]) await pressAction(action);
    assert.equal(await evaluate("window.__WP13_7B__.getViewModel().screen"), "ORIENTATION");
  }

  await waitForExpression("document.documentElement?.dataset.wp13_8Ready === 'true'");
  await waitForExpression("navigator.serviceWorker.controller !== null");
  assert.equal(await evaluate("document.documentElement.dataset.corpusPolicy"), "READY");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().patternClasses.length"), 4);
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().activities.length"), 8);

  await newOrientation();
  assert.match(await evaluate("document.querySelector('.corpus-boundary').textContent"), /DRAFT.*EXTERNAL_REVIEW_REQUIRED.*SYNTHETIC_ONLY.*NOT_STUDENT_BETA/);
  assert.equal(await evaluate("document.querySelectorAll('[data-pattern-class-id]').length"), 4);
  for (const classId of [
    "NOR-PC-SINGLE-FINAL-001",
    "NOR-PC-DOUBLE-FINAL-001",
    "NOR-PC-CONSONANT-CLUSTER-001",
    "NOR-PC-NG-GRAPHEME-001",
  ]) {
    await pressClass(classId);
    assert.equal(await evaluate("window.__WP13_8__.getCorpusView().selectedPatternClassId"), classId);
  }

  await pressClass("NOR-PC-SINGLE-FINAL-001");
  await press("[data-corpus-activity-id=activity-nor-single-final-ris-sil-001]");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().selectedActivityId"), "activity-nor-single-final-ris-sil-001");
  await pressAction("start");
  assert.match(await evaluate("document.querySelector('[data-draft-feedback]').textContent"), /ris/);
  assert.match(await evaluate("document.body.textContent"), /DRAFT.*EXTERNAL_REVIEW_REQUIRED.*SYNTHETIC_ONLY.*NOT_STUDENT_BETA/s);

  await pressAction("help");
  await pressRole("ADULT");
  assert.equal(await evaluate("document.querySelector('.adult-card') !== null"), true);
  assert.match(await evaluate("document.querySelector('.adult-card').textContent"), /Forstå.*Kan si.*Unngå.*Fordyp deg.*Utløper/s);
  await pressAction("adult-prompt");
  assert.match(await evaluate("document.body.textContent"), /ADULT: PROMPT/);
  await pressAction("resume");
  await pressRole("CHILD");
  await buildVisibleWord();
  await pressRole("ADULT");
  await pressAction("confirm-reading");
  assert.match(await evaluate("document.querySelector('[data-attempt-evidence]').textContent"), /TARGET.*INDEPENDENT.*SUPPORTED_RETRY.*TRANSFER.*TRANSFER_SEPARATE/s);
  await pressRole("CHILD");
  assert.match(await evaluate("document.querySelector('[data-draft-feedback]').textContent"), /sil/);
  await buildVisibleWord();
  await pressRole("ADULT");
  await pressAction("confirm-reading");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "COMPLETED");

  await pressAction("delete");
  await pressAction("new-session");
  await evaluate(`(() => { const select = document.querySelector('#app-locale'); select.value = 'nn-NO'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  assert.equal(await evaluate("document.documentElement.lang"), "nn");
  await newOrientation();
  assert.match(await evaluate("document.querySelector('#corpus-title').textContent"), /Urevidert norsk utkastkorpus/);
  await pressAction("start");
  await pressAction("audio-spec");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().audioState"), "SPEC_REQUESTED");
  await pressAction("stop");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().audioState"), "STOPPED");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().pendingFeedback"), false);
  await pressAction("delete");
  await pressAction("new-session");
  await evaluate(`(() => { const select = document.querySelector('#app-locale'); select.value = 'nb-NO'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await newOrientation();

  await pressClass("NOR-PC-CONSONANT-CLUSTER-001");
  assert.equal(await evaluate("document.querySelector('[data-corpus-activity-card=activity-nor-cluster-fisk-vest-002]') === null"), true);
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().activities.find((item) => item.activityId === 'activity-nor-cluster-fisk-vest-002').selectable"), false);
  await pressMode("REVIEW");
  assert.equal(await evaluate("document.querySelector('[data-corpus-activity-card=activity-nor-cluster-fisk-vest-002]') !== null"), true);
  assert.match(await evaluate("document.querySelector('[data-corpus-activity-card=activity-nor-cluster-fisk-vest-002]').textContent"), /CHANGES_REQUIRED.*Bare reviewmodus/s);
  await press("[data-corpus-activity-id=activity-nor-cluster-fisk-vest-002]");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().selectedActivityId"), "activity-nor-cluster-fisk-vest-002");
  await pressMode("NORMAL_SYNTHETIC");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().selectedActivityId"), "activity-nor-cluster-pris-gris-001");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().activities.find((item) => item.activityId === 'activity-nor-cluster-fisk-vest-002').visible"), false);

  await pressClass("NOR-PC-SINGLE-FINAL-001");
  await press("[data-corpus-activity-id=activity-nor-single-final-ris-sil-001]");
  await evaluate(`window.__WP13_8__.applyRestrictivePolicy({
    policyRevision: 2,
    restrictions: [{
      scope: 'ACTIVITY',
      scopeId: 'activity-nor-single-final-ris-sil-001',
      lifecycleStatus: 'WITHDRAWN'
    }],
    containsPersonData: false,
    resurrectionAllowed: false
  })`);
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().runStage"), "BLOCKED");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().canStartSelected"), false);

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
  await client.send("Page.reload", { ignoreCache: true });
  await waitForExpression("document.documentElement?.dataset.wp13_8Ready === 'true'");
  assert.equal(await evaluate("document.documentElement.dataset.corpusPolicy"), "READY");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().activities.find((item) => item.activityId === 'activity-nor-single-final-ris-sil-001').lifecycleStatus"), "WITHDRAWN");
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().canStartSelected"), false);
  assert.equal(await evaluate("window.__WP13_8__.getCorpusView().runStage"), "BLOCKED");
  await newOrientation();
  assert.equal(await evaluate("document.querySelector('[data-app-action=start]').disabled"), true);

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 320, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate(`[...document.querySelectorAll('button, select')].filter((node) => node.getClientRects().length > 0).every((node) => { const r = node.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })`), true);
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  assert.ok((await evaluate("window.visualViewport?.scale ?? 1")) >= 2);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
  await evaluate("document.querySelector('.skip-link').focus()");
  assert.equal(await evaluate("document.activeElement?.classList.contains('skip-link')"), true);
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement?.matches('button, select')"), true);
  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  const roles = (ax.nodes ?? []).map((node) => node.role?.value).filter(Boolean);
  assert.ok(names.some((name) => /Urevidert norsk draftcorpus/.test(name)));
  assert.ok(roles.includes("button"));
  assert.ok(roles.includes("main"));

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
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await mkdir(join(repo, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png", fromSurface: true, captureBeyondViewport: true,
  });
  await writeFile(
    join(repo, "artifacts", "wp13-8-authentic-draft-corpus.png"),
    Buffer.from(screenshot.data, "base64"),
  );
  console.log("Chromium WP13.8 corpus, review gate, provenance, withdrawal, offline no-resurrection and reflow proof passed.");
} finally {
  await cleanupBrowserProof({
    browser,
    browserLabel: "Chromium WP13.8 corpus proof",
    client,
    profile,
    requestBrowserClose: client === undefined
      ? undefined
      : () => client.send("Browser.close"),
    server,
    serverLabel: "WP13.8 corpus proof server",
  });
}
