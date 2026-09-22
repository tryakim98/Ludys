import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupBrowserProof, spawnOwnedProcess, waitForOwnedProcessEndpoint } from "./browser-cleanup.mjs";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const serverPort = 4193;
const debugPort = 9346;
const origin = `http://127.0.0.1:${serverPort}`;
const profile = await mkdtemp(join(tmpdir(), "wp13-12a-provider-decision-chromium-"));
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
  await waitForOwnedProcessEndpoint(`${origin}/web/index.html`, { child: server, label: "WP13.12A provider-decision proof server" });
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${debugPort}/json/version`, { child: browser, label: "WP13.12A provider-decision Edge/Chromium" });
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

  await waitFor("Boolean(window.__WP13_12A__) && document.documentElement?.dataset.wp13_9Ready === 'true'");
  assert.equal(await evaluate("document.body.innerText.trim().length > 100"), true);
  assert.equal(await evaluate("document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay') === null"), true);
  await evaluate("window.__WP13_12A__.openDecision()");
  await waitFor("Boolean(document.querySelector('#provider-decision-title'))");

  assert.equal(await evaluate("document.querySelectorAll('[data-provider-option]').length"), 5);
  assert.equal(await evaluate("document.querySelectorAll('[data-provider-status=RECOMMENDED]').length"), 1);
  assert.equal(await evaluate("document.querySelector('[data-provider-status=RECOMMENDED]').dataset.providerOption"), "FIREBASE_CAPABILITY");
  assert.match(await evaluate("document.body.innerText"), /APPROVE_RECOMMENDED_SYNTHETIC_DEV.*PROVIDER_ACTIVATION BLOCKED.*CLOUD_RESOURCES 0/is);
  assert.match(await evaluate("document.body.innerText"), /WP13\.12B (?:= )?BLOCKED/is);
  assert.match(await evaluate("document.body.innerText"), /STUDENT_BETA = NOT_AUTHORIZED/is);
  assert.match(await evaluate("document.body.innerText"), /PRODUCTION = NOT_AUTHORIZED/is);
  assert.equal(await evaluate("document.querySelectorAll('[data-decision-section]').length"), 16);
  for (const section of ["options", "region", "capability", "dataflow", "trust", "data", "retention", "logging", "iam", "cost", "threats", "legal", "exit", "no-go", "sources", "owner"]) {
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-decision-section=${JSON.stringify(section)}]'))`), true);
  }
  assert.equal(await evaluate("document.querySelectorAll('[data-threat-id]').length"), 21);
  assert.match(await evaluate("document.body.innerText"), /europe-north1.*REGION_LOCK_NOT_EXECUTED = true/is);
  assert.match(await evaluate("document.body.innerText"), /OPAQUE_RANDOM_SHORT_LIVED_SESSION_CAPABILITY.*15_MINUTES_HARD_MAXIMUM/is);
  assert.match(await evaluate("document.body.innerText"), /EXPLICIT_DELETION_DOMINATES_TTL.*STOP_DOMINATES_ALL_PENDING_ACTIONS.*DELETED_SESSION_CANNOT_RESURRECT/is);

  const forbiddenControl = await evaluate(`(() => {
    const labels = [...document.querySelectorAll('button, a, input, select')].map((node) => (node.textContent || node.value || '').trim());
    return labels.find((label) => /activate provider|create project|deploy|log in to provider|enter billing|upload secret/i.test(label)) || null;
  })()`);
  assert.equal(forbiddenControl, null);
  assert.equal(await evaluate("document.querySelectorAll('input[type=password], input[type=email], input[type=tel]').length"), 0);

  await evaluate("window.__WP13_12A__.selectOption('LOCAL_ONLY')");
  assert.match(await evaluate("document.querySelector('.decision-selected h3').textContent"), /LOCAL_ONLY/);
  assert.equal(await evaluate("window.__WP13_12A__.getDecisionView().recommendedOptionId"), "FIREBASE_CAPABILITY");
  assert.equal(await evaluate("window.__WP13_12A__.getDecisionView().authorization.ownerDecision"), "APPROVE_RECOMMENDED_SYNTHETIC_DEV");
  assert.equal(await evaluate("window.__WP13_12A__.getDecisionView().ownerDecisionRecord.effects.opensWp13_12b"), false);

  const dossier = JSON.parse(await evaluate("window.__WP13_12A__.exportDossier()"));
  assert.equal(dossier.recommendationAcceptedByOwner, true);
  assert.equal(dossier.ownerDecision, "APPROVE_RECOMMENDED_SYNTHETIC_DEV");
  assert.equal(dossier.ownerDecisionRecord.effects.activatesProvider, false);
  assert.equal(dossier.providerActivation, "BLOCKED");
  assert.equal(dossier.cloudResources, 0);
  assert.equal(await evaluate("document.querySelector('#provider-dossier-download').href.startsWith('blob:')"), true);
  const ownerTemplate = await evaluate("window.__WP13_12A__.exportOwnerTemplate()");
  assert.match(ownerTemplate, /STATUS: PENDING_OWNER_ACTION/);
  assert.match(ownerTemplate, /PROVIDER_ACTIVATION: BLOCKED/);
  assert.doesNotMatch(ownerTemplate, /APPROVED|SIGNED|OWNER_CONFIRMED/);
  assert.equal(await evaluate("document.querySelector('#provider-owner-template-download').href.startsWith('blob:')"), true);

  await evaluate("window.__WP13_12A__.setLocale('nn')");
  assert.equal(await evaluate("document.documentElement.lang"), "nn");
  assert.match(await evaluate("document.querySelector('h1').textContent"), /Provideravgjerd/);
  assert.match(await evaluate("(() => { try { window.__WP13_12A__.setLocale('missing'); return 'NO_ERROR'; } catch (error) { return String(error); } })()"), /MISSING_LOCALE/);
  await evaluate("window.__WP13_12A__.setLocale('nb')");
  assert.equal(await evaluate("document.documentElement.lang"), "nb");

  await client.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 2, mobile: true });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  assert.equal(await evaluate("navigator.maxTouchPoints >= 1"), true);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('button, select, a')].filter((node) => node.getClientRects().length > 0).every((node) => { const rect=node.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44; })"), true);
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
  assert.equal(await evaluate("getComputedStyle(document.activeElement).top !== '-999px'"), true);
  assert.equal(await evaluate("[...document.styleSheets].some((sheet) => [...sheet.cssRules].some((rule) => rule.selectorText?.includes('a:focus-visible') && rule.style.outline !== ''))"), true);
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement?.dataset.providerDecisionAction"), "close");

  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  assert.ok(names.some((name) => /Providerbeslutning/.test(name)));
  assert.ok(names.some((name) => /Eksporter beslutningsdossier/.test(name)));
  assert.ok(names.some((name) => /Produkteierbeslutning registrert/.test(name)));

  const external = requests.filter((url) => /^https?:/i.test(url) && !url.startsWith(origin));
  assert.deepEqual(external, []);
  assert.equal(await evaluate(`performance.getEntriesByType('resource').every((entry) => !entry.name.startsWith('http') || entry.name.startsWith(${JSON.stringify(origin)}))`), true);

  await mkdir(join(root, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
  await writeFile(join(root, "artifacts", "wp13-12a-provider-decision.png"), Buffer.from(screenshot.data, "base64"));
  console.log("WP13.12A provider-decision browser proof passed: five options, recorded owner decision without activation, BM/NN, blank-template provenance, full decision sections, 320px, 200%, touch, keyboard, forced colors, reduced motion, AX tree, zero external calls and no activation controls.");
} finally {
  await cleanupBrowserProof({
    browser, browserLabel: "WP13.12A provider-decision Edge/Chromium", client, profile,
    requestBrowserClose: client === undefined ? undefined : () => client.send("Browser.close"),
    server, serverLabel: "WP13.12A provider-decision proof server",
  });
}
