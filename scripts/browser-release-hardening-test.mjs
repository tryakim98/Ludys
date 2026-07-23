import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupBrowserProof, spawnOwnedProcess, waitForOwnedProcessEndpoint } from "./browser-cleanup.mjs";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const serverPort = 4191;
const debugPort = 9344;
const profile = await mkdtemp(join(tmpdir(), "wp13-10-release-chromium-"));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  #socket; #id = 0; #pending = new Map();
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
  cwd: root, env: { ...process.env, PORT: String(serverPort) }, stdio: ["ignore", "ignore", "ignore"],
});
const browser = spawnOwnedProcess(resolveBrowserExecutable(), [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-proxy-server",
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: ["ignore", "ignore", "ignore"] });

let client;
try {
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${serverPort}/web/index.html`, { child: server, label: "WP13.10 proof server" });
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${debugPort}/json/version`, { child: browser, label: "WP13.10 Edge/Chromium proof" });
  const shellResponse = await fetch(`http://127.0.0.1:${serverPort}/web/index.html`);
  assert.match(shellResponse.headers.get("content-security-policy") ?? "", /default-src 'self'.*object-src 'none'/);
  assert.equal(shellResponse.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
  assert.equal(shellResponse.headers.get("x-content-type-options"), "nosniff");
  const create = await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: "PUT" });
  const page = await create.json();
  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.open();
  for (const domain of ["Page.enable", "Runtime.enable", "Accessibility.enable"]) await client.send(domain);
  await client.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/web/index.html` });

  async function evaluate(expression) {
    const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "evaluation failed");
    return result.result?.value;
  }
  async function waitFor(expression, attempts = 120) {
    for (let index = 0; index < attempts; index += 1) {
      if (await evaluate(expression)) return;
      await wait(50);
    }
    throw new Error(`Timed out: ${expression}`);
  }
  async function press(selector) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", text: " ", windowsVirtualKeyCode: 32 });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await wait(30);
  }
  const pressAction = (action) => press(`[data-app-action=${action}]`);

  await waitFor("document.documentElement?.dataset.wp13_9Ready === 'true'");
  assert.equal(await evaluate("document.body.innerText.trim().length > 100"), true);
  assert.equal(await evaluate("window.__WP13_10__.getRuntimeSafety().mode"), "NORMAL");
  assert.equal(await evaluate("window.__WP13_10__.getReleaseState().externalReceipts"), 0);
  assert.equal(await evaluate("window.__WP13_10__.getReleaseState().productionDeploymentAuthorized"), false);

  await client.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 2, mobile: true });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  assert.equal(await evaluate("navigator.maxTouchPoints >= 1"), true);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('button, select')].filter((node) => node.getClientRects().length > 0).every((node) => { const r=node.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })"), true);
  await client.send("Emulation.setEmulatedMedia", { features: [
    { name: "prefers-reduced-motion", value: "reduce" },
    { name: "forced-colors", value: "active" },
  ] });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
  assert.equal(await evaluate("matchMedia('(forced-colors: active)').matches"), true);
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  assert.ok((await evaluate("window.visualViewport?.scale ?? 1")) >= 2);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);

  await evaluate("document.body.focus()");
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement?.classList.contains('skip-link')"), true);
  assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none'"), true);

  for (const action of ["create", "role-child", "finish-loading", "start"]) await pressAction(action);
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "ACTIVE");
  const responseMs = await evaluate("(() => { const start=performance.now(); document.querySelector('[data-app-action=quiet]').click(); return performance.now()-start; })()");
  assert.ok(responseMs <= 150, `central interaction ${responseMs}ms`);

  await evaluate("window.__WP13_10__.triggerRuntimeFailure('AUDIO_FAILURE')");
  assert.equal(await evaluate("window.__WP13_10__.getRuntimeSafety().mode"), "TECHNICAL_RECOVERY");
  assert.equal(await evaluate("document.querySelector('#runtime-recovery').hidden"), false);
  assert.match(await evaluate("document.querySelector('#runtime-recovery').textContent"), /sier ikke noe om barnet/i);
  assert.equal(await evaluate("document.activeElement?.id"), "runtime-recovery-title");

  const stopRect = await evaluate("(() => { const r=document.querySelector('[data-runtime-action=stop]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}; })()");
  assert.ok(stopRect.width >= 44 && stopRect.height >= 44);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: stopRect.x, y: stopRect.y, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await waitFor("window.__WP13_7B__.getViewModel().lifecycleState === 'STOPPED'");

  await evaluate("window.__WP13_10__.triggerRuntimeFailure('STORAGE_FAILURE')");
  await press("[data-runtime-action=safe-start]");
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "NOT_CREATED");
  for (const failure of ["RENDER_FAILURE", "WINDOW_ERROR", "UNHANDLED_REJECTION"]) {
    if (failure === "WINDOW_ERROR") await evaluate("window.dispatchEvent(new ErrorEvent('error', { message: 'synthetic technical proof' }))");
    else if (failure === "UNHANDLED_REJECTION") await evaluate("window.dispatchEvent(new Event('unhandledrejection', { cancelable: true }))");
    else await evaluate(`window.__WP13_10__.triggerRuntimeFailure(${JSON.stringify(failure)})`);
    assert.equal(await evaluate("window.__WP13_10__.getRuntimeSafety().failure"), failure);
  }

  const rollback = await evaluate("(() => { const before=window.__WP13_10__.getReleaseState().active; const start=performance.now(); const result=window.__WP13_10__.rollbackComponent('AUDIO','TEXT_AND_SILENCE'); return {accepted:result.accepted,ms:performance.now()-start,before,after:window.__WP13_10__.getReleaseState().active}; })()");
  assert.equal(rollback.accepted, true);
  assert.ok(rollback.ms <= 50, `rollback ${rollback.ms}ms`);
  assert.equal(rollback.before.appVersion, rollback.after.appVersion);
  assert.equal(rollback.before.contentReleaseId, rollback.after.contentReleaseId);
  assert.equal(rollback.after.audioReleaseId, "TEXT_AND_SILENCE");

  await evaluate("window.__WP13_9__.openWorkspace()");
  assert.equal(await evaluate("Boolean(document.querySelector('#authoring-title'))"), true);
  assert.match(await evaluate("document.body.textContent"), /BM.*NN|Bokmål.*Nynorsk/is);
  assert.equal(await evaluate("Boolean(document.querySelector('[data-authoring-action=stop-audio]'))"), true);

  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  assert.ok(names.some((name) => /Teknisk pause/.test(name)));
  assert.ok(names.some((name) => /Stopp økt|Stopp økta/.test(name)));

  const cacheClear = await evaluate(`(async () => { const registration=await navigator.serviceWorker.ready; const worker=navigator.serviceWorker.controller ?? registration.active; return new Promise((resolve) => { const channel=new MessageChannel(); channel.port1.onmessage=(event)=>resolve(event.data); worker.postMessage({type:'LUDYS_CLEAR_SHELL_CACHE'},[channel.port2]); }); })()`);
  assert.equal(cacheClear.ok, true);

  await mkdir(join(root, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
  await writeFile(join(root, "artifacts", "wp13-10-release-hardening.png"), Buffer.from(screenshot.data, "base64"));
  console.log(`WP13.10 Edge/Chromium release hardening proof passed: 320px, 200%, touch, keyboard, forced colors, runtime recovery, rollback, authoring and secure origin (${responseMs.toFixed(3)}ms interaction).`);
} finally {
  await cleanupBrowserProof({
    browser, browserLabel: "WP13.10 Edge/Chromium proof", client, profile,
    requestBrowserClose: client === undefined ? undefined : () => client.send("Browser.close"),
    server, serverLabel: "WP13.10 proof server",
  });
}
