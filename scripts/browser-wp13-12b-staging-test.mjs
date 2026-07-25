import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupBrowserProof, spawnOwnedProcess, waitForOwnedProcessEndpoint } from "./browser-cleanup.mjs";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const serverPort = 4194;
const debugPort = 9347;
const origin = `http://127.0.0.1:${serverPort}`;
const profile = await mkdtemp(join(tmpdir(), "wp13-12b-staging-chromium-"));
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
  cwd: root,
  env: { ...process.env, PORT: String(serverPort) },
  stdio: ["ignore", "ignore", "ignore"],
});
const browser = spawnOwnedProcess(resolveBrowserExecutable(), [
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
  await waitForOwnedProcessEndpoint(`${origin}/web/staging-preview.html`, {
    child: server,
    label: "WP13.12B staging proof server",
  });
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${debugPort}/json/version`, {
    child: browser,
    label: "WP13.12B staging Edge/Chromium",
  });
  const page = await (await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: "PUT" })).json();
  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.open();
  const requests = [];
  client.on("Network.requestWillBeSent", ({ request }) => { if (request?.url) requests.push(request.url); });
  for (const domain of ["Page.enable", "Runtime.enable", "Accessibility.enable", "Network.enable"]) {
    await client.send(domain);
  }
  await client.send("Page.navigate", { url: `${origin}/web/staging-preview.html` });

  async function evaluate(expression) {
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "evaluation failed");
    }
    return result.result?.value;
  }
  async function waitFor(expression, attempts = 160) {
    for (let index = 0; index < attempts; index += 1) {
      if (await evaluate(expression)) return;
      await wait(50);
    }
    throw new Error(`Timed out: ${expression}`);
  }

  await waitFor("Boolean(window.__WP13_12B__) && document.documentElement.dataset.wp13_12bReady === 'true'");
  assert.equal(await evaluate("window.__WP13_12B__.getView().providerStatus"), "DISABLED");
  assert.equal(await evaluate("window.__WP13_12B__.getView().cloudResources"), 0);
  assert.equal(await evaluate("window.__WP13_12B__.getView().classification"), "SYNTHETIC_ONLY");
  assert.match(await evaluate("document.body.innerText"), /SYNTHETIC ONLY.*Provider deaktivert.*Skyressurser: 0/is);
  assert.match(await evaluate("document.body.innerText"), /OPTIONAL_TECHNICAL_STAGING_PROOF.*CANONICAL_PRODUCT_MODE/is);
  assert.equal(await evaluate("document.querySelectorAll('.staging-projections > section').length"), 2);
  assert.equal(await evaluate("document.querySelector('#child-projection-title').textContent"), "Barnets minsteprojeksjon");
  assert.equal(await evaluate("document.querySelector('#adult-projection-title').textContent"), "Voksenprojeksjon");
  assert.equal(await evaluate("document.querySelector('#child-projection-title').parentElement.innerText.includes('SYNTHETIC_HELP_REQUESTED')"), false);

  await evaluate("window.__WP13_12B__.command('CHILD','ENTER_WAIT')");
  assert.equal(await evaluate("window.__WP13_12B__.getView().child.wait"), true);
  assert.equal(await evaluate("window.__WP13_12B__.getView().adult.adultCard === undefined"), true);
  await evaluate("window.__WP13_12B__.command('ADULT','RESUME')");
  await evaluate("window.__WP13_12B__.command('CHILD','REQUEST_HELP')");
  assert.equal(await evaluate("window.__WP13_12B__.getView().child.helpPending"), true);
  assert.equal(await evaluate("window.__WP13_12B__.getView().adult.adultCard"), "SYNTHETIC_HELP_REQUESTED");
  assert.equal(await evaluate("document.querySelector('#child-projection-title').parentElement.innerText.includes('SYNTHETIC_HELP_REQUESTED')"), false);
  await evaluate("window.__WP13_12B__.command('CHILD','PAUSE')");
  await evaluate("window.__WP13_12B__.command('ADULT','RESUME')");
  assert.equal(await evaluate("window.__WP13_12B__.staleCommand().lastOutcome"), "STALE_VERSION");
  await evaluate("window.__WP13_12B__.command('CHILD','STOP')");
  assert.equal(await evaluate("window.__WP13_12B__.getView().child.terminalStatus"), "STOPPED");
  assert.equal(await evaluate("window.__WP13_12B__.reconnect().child.terminalStatus"), "STOPPED");
  assert.equal(await evaluate("window.__WP13_12B__.getView().child.audioStatus"), "SILENT");

  await evaluate(`(() => {
    const select = document.querySelector('#staging-locale');
    select.value = 'nn-NO';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal(await evaluate("document.documentElement.lang"), "nn");
  assert.match(await evaluate("document.querySelector('h1').textContent"), /stagingførehandsvising/);
  assert.equal(await evaluate("window.__WP13_12B__.getView().locale"), "nn-NO");
  await evaluate("window.__WP13_12B__.delete()");
  assert.equal(await evaluate("window.__WP13_12B__.getView().tombstone"), true);
  assert.equal(await evaluate("window.__WP13_12B__.reconnect().lastOutcome"), "TOMBSTONE_NO_RESURRECTION");

  await evaluate(`(() => {
    const select = document.querySelector('#staging-locale');
    select.value = 'nb-NO';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.match(await evaluate("window.__WP13_12B__.killSwitch().lastOutcome"), /KILL_SWITCH_ACTIVE/);
  assert.equal(await evaluate("window.__WP13_12B__.getView().stagingEnabled"), false);
  assert.equal(await evaluate("window.__WP13_12B__.command('CHILD','ENTER_WAIT').lastOutcome"), "KILL_SWITCH_ACTIVE");

  assert.equal(await evaluate("document.querySelectorAll('input[type=password], input[type=email], input[type=tel]').length"), 0);
  assert.equal(await evaluate("document.body.innerText.includes('LUDYS_CAPABILITY_HMAC_KEY')"), false);
  assert.equal(await evaluate("Object.keys(localStorage).length"), 0);
  assert.equal(await evaluate("Object.keys(sessionStorage).length"), 0);

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 900,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  assert.equal(await evaluate("navigator.maxTouchPoints >= 1"), true);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('button, select, a')].filter((node) => node.getClientRects().length > 0).every((node) => { const rect = node.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44; })"), true);
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
  assert.equal(await evaluate("document.activeElement.classList.contains('skip-link')"), true);
  await client.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
  });
  assert.equal(await evaluate("document.activeElement?.id"), "staging-locale");

  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  assert.ok(names.some((name) => /Syntetisk stagingforhåndsvisning/.test(name)));
  assert.ok(names.some((name) => /Barnets minsteprojeksjon/.test(name)));
  assert.ok(names.some((name) => /Voksenprojeksjon/.test(name)));
  assert.ok(names.some((name) => /STOPP/.test(name)));

  const external = requests.filter((url) => /^https?:/iu.test(url) && !url.startsWith(origin));
  assert.deepEqual(external, []);
  assert.equal(await evaluate(`performance.getEntriesByType('resource').every((entry) => !entry.name.startsWith('http') || entry.name.startsWith(${JSON.stringify(origin)}))`), true);

  await mkdir(join(root, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
  });
  await writeFile(
    join(root, "artifacts", "wp13-12b-browser-proof.png"),
    Buffer.from(screenshot.data, "base64"),
  );
  await writeFile(
    join(root, "artifacts", "wp13-12b-browser-proof.json"),
    `${JSON.stringify({
      schemaVersion: "wp13.12b-browser-proof-v1",
      status: "HEADLESS_BROWSER_PROOF_PASSED",
      actualLocalBrowserOriginProof: true,
      deviceEmulation: true,
      actualFirebaseEmulatorProof: false,
      physicalDeviceProof: false,
      width: 320,
      zoomPercent: 200,
      touchEmulation: true,
      keyboard: true,
      visibleFocus: true,
      logicalFocusOrder: true,
      reducedMotion: true,
      forcedColors: true,
      accessibilityTree: true,
      bm: true,
      nn: true,
      localeFallback: false,
      externalProviderCalls: 0,
      secrets: 0,
      cloudResources: 0,
    }, null, 2)}\n`,
    "utf8",
  );
  console.log("WP13.12B staging browser proof passed: synthetic marking, CHILD/ADULT, WAIT, help, pause, STOP, deletion, reconnect, stale command, kill switch, BM/NN, 320px, 200%, touch, keyboard, focus, forced colors, reduced motion, AX tree, no secrets and zero external calls.");
} finally {
  await cleanupBrowserProof({
    browser,
    browserLabel: "WP13.12B staging Edge/Chromium",
    client,
    profile,
    requestBrowserClose: client === undefined ? undefined : () => client.send("Browser.close"),
    server,
    serverLabel: "WP13.12B staging proof server",
  });
}
