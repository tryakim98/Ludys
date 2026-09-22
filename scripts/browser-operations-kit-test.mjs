import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupBrowserProof, spawnOwnedProcess, waitForOwnedProcessEndpoint } from "./browser-cleanup.mjs";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const serverPort = 4192;
const debugPort = 9345;
const origin = `http://127.0.0.1:${serverPort}`;
const profile = await mkdtemp(join(tmpdir(), "wp13-11-operations-chromium-"));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  #socket;
  #id = 0;
  #pending = new Map();
  #listeners = new Map();
  constructor(url) { this.#socket = new WebSocket(url); }
  async open() {
    await new Promise((resolve, reject) => {
      this.#socket.addEventListener("open", resolve, { once: true });
      this.#socket.addEventListener("error", reject, { once: true });
    });
    this.#socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id === undefined) {
        for (const listener of this.#listeners.get(message.method) ?? []) listener(message.params ?? {});
        return;
      }
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
    });
  }
  on(method, listener) {
    const listeners = this.#listeners.get(method) ?? [];
    listeners.push(listener);
    this.#listeners.set(method, listeners);
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
  await waitForOwnedProcessEndpoint(`${origin}/web/index.html`, { child: server, label: "WP13.11 operations proof server" });
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${debugPort}/json/version`, { child: browser, label: "WP13.11 operations Edge/Chromium" });
  const create = await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: "PUT" });
  const page = await create.json();
  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.open();
  const requests = [];
  client.on("Network.requestWillBeSent", ({ request }) => { if (request?.url) requests.push(request.url); });
  for (const domain of ["Page.enable", "Runtime.enable", "Accessibility.enable", "Network.enable"]) await client.send(domain);
  await client.send("Page.navigate", { url: `${origin}/web/index.html` });

  async function evaluate(expression) {
    const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "evaluation failed");
    return result.result?.value;
  }
  async function waitFor(expression, attempts = 160) {
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
    await wait(40);
  }

  await waitFor("Boolean(window.__WP13_11__) && document.documentElement?.dataset.wp13_9Ready === 'true'");
  assert.equal(await evaluate("document.body.innerText.trim().length > 100"), true);
  assert.equal(await evaluate("document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay') === null"), true);
  await evaluate("window.__WP13_11__.openOperations()");
  await waitFor("Boolean(document.querySelector('#operations-integrity-title'))");
  assert.equal(await evaluate("document.querySelectorAll('#operations-artifact-select option').length"), 27);
  assert.match(await evaluate("document.body.innerText"), /27\/27.*BM 27\/27.*NN 27\/27/is);
  assert.match(await evaluate("document.body.innerText"), /Receipts 0.*B8 NOT_DECISION_READY.*STUDENT_BETA NOT_AUTHORIZED/is);

  await evaluate("window.__WP13_11__.selectArtifact('PARENT_INFORMATION_DRAFT')");
  assert.match(await evaluate("document.querySelector('.operations-terminal').textContent"), /IKKE AUTORISERT FOR ELEVBRUK/);
  assert.equal(await evaluate("document.querySelector('.operations-artifact').dataset.artifactLocale"), "nb");
  await evaluate("window.__WP13_11__.setLocale('nn')");
  assert.equal(await evaluate("document.querySelector('.operations-artifact').dataset.artifactLocale"), "nn");
  assert.match(await evaluate("document.querySelector('.operations-terminal').textContent"), /IKKJE AUTORISERT FOR ELEVBRUK/);
  assert.match(await evaluate("(() => { try { window.__WP13_11__.setLocale('missing'); return 'NO_ERROR'; } catch (error) { return String(error); } })()"), /MISSING_LOCALE/);
  await evaluate("window.__WP13_11__.setLocale('nb')");

  await evaluate("window.__WP13_11__.startDryRun()");
  for (const [text, expected] of [
    ["kontakt test@example.no", "POSSIBLE_EMAIL"],
    ["ring 998 88 776", "POSSIBLE_PHONE"],
    ["referanse 123456789", "LONG_DIGIT_SEQUENCE"],
    ["se https://example.invalid", "POSSIBLE_URL"],
  ]) {
    const guard = await evaluate(`window.__WP13_11__.addFinding('TECHNICAL_OPERATION','OPS_GUARD',${JSON.stringify(text)})`);
    assert.equal(guard.accepted, false);
    assert.ok(guard.errors.includes(expected));
  }
  assert.equal(await evaluate("window.__WP13_11__.getOperationsView().findings.length"), 0);
  const safe = await evaluate("window.__WP13_11__.addFinding('ACCESSIBILITY','A11Y_FOCUS','Synlig fokus ble beholdt')");
  assert.equal(safe.accepted, true);
  assert.equal(await evaluate("window.__WP13_11__.getOperationsView().findings.length"), 1);
  const firstExport = JSON.parse(await evaluate("window.__WP13_11__.exportLocalReview()"));
  assert.equal(firstExport.findings.length, 1);
  assert.equal(firstExport.dataBoundary.personalData, false);
  assert.equal(await evaluate("Boolean(document.querySelector('#operations-export-download').href.startsWith('blob:'))"), true);
  await evaluate("window.__WP13_11__.deleteRecords()");
  const secondExport = JSON.parse(await evaluate("window.__WP13_11__.exportLocalReview()"));
  assert.equal(secondExport.findings.length, 0);

  await evaluate("window.__WP13_11__.runSev0()");
  assert.equal(await evaluate("window.__WP13_11__.getOperationsView().dryRunStatus"), "SEV0_CONTAINED");
  assert.equal(await evaluate("window.__WP13_11__.getOperationsView().operationalStop"), true);
  assert.equal(await evaluate("Boolean(document.querySelector('[data-operations-action=stop]'))"), true);
  await evaluate("window.__WP13_11__.startDryRun()");
  await press("[data-operations-action=stop]");
  assert.equal(await evaluate("window.__WP13_11__.getOperationsView().dryRunStatus"), "STOPPED");
  await evaluate("window.__WP13_11__.startDryRun(); window.__WP13_11__.deleteState()");
  assert.equal(await evaluate("window.__WP13_11__.reconnect()"), false);
  assert.equal(await evaluate("window.__WP13_11__.getOperationsView().noResurrectionVerified"), true);

  await press("[data-operations-action=rollback]");
  assert.equal(await evaluate("window.__WP13_10__.getReleaseState().active.operationsReleaseId"), "wp13-11-operations-kit-r0");
  assert.equal(await evaluate("window.__WP13_11__.getOperationsView().drillResults.ROLLBACK"), "PASS");
  await evaluate("window.__WP13_11__.runWithdrawal('KNOWN_ISSUES')");
  assert.equal(await evaluate("window.__WP13_11__.getOperationsView().artifactRows.find((row) => row.artifactType === 'KNOWN_ISSUES').available"), false);

  await client.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 2, mobile: true });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  assert.equal(await evaluate("navigator.maxTouchPoints >= 1"), true);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('button, select, input')].filter((node) => node.getClientRects().length > 0).every((node) => { const rect=node.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44; })"), true);
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  assert.ok((await evaluate("window.visualViewport?.scale ?? 1")) >= 2);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  await client.send("Emulation.setEmulatedMedia", { features: [
    { name: "prefers-reduced-motion", value: "reduce" },
    { name: "forced-colors", value: "active" },
  ] });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
  assert.equal(await evaluate("matchMedia('(forced-colors: active)').matches"), true);
  await evaluate("document.querySelector('.skip-link').focus()");
  assert.equal(await evaluate("document.activeElement?.classList.contains('skip-link')"), true);
  assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none'"), true);
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement?.dataset.operationsAction"), "close");
  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  assert.ok(names.some((name) => /Betaoperasjon/.test(name)));
  assert.ok(names.some((name) => /STOP|STOPP/.test(name)));
  assert.equal(await evaluate("window.__WP13_11__.getOperationsView().audioState"), "STOPPED");

  const external = requests.filter((url) => /^https?:/i.test(url) && !url.startsWith(origin));
  assert.deepEqual(external, []);
  assert.equal(await evaluate(`performance.getEntriesByType('resource').every((entry) => !entry.name.startsWith('http') || entry.name.startsWith(${JSON.stringify(origin)}))`), true);

  await mkdir(join(root, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
  await writeFile(join(root, "artifacts", "wp13-11-complete-beta-operations.png"), Buffer.from(screenshot.data, "base64"));
  console.log("WP13.11 operations browser proof passed: 27 artifacts, BM/NN (nb/nn), identifierguard, SEV0, STOP, deletion, rollback, withdrawal, export, 320px, 200%, touch, keyboard, forced colors, reduced motion, AX tree and zero external calls.");
} finally {
  await cleanupBrowserProof({
    browser, browserLabel: "WP13.11 operations Edge/Chromium", client, profile,
    requestBrowserClose: client === undefined ? undefined : () => client.send("Browser.close"),
    server, serverLabel: "WP13.11 operations proof server",
  });
}
