import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
const debugPort = 9335;
const profile = await mkdtemp(join(tmpdir(), "wp13-4-chromium-"));
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

const [
  { createB8ReadinessController },
  { renderB8ReadinessMarkup },
] = await Promise.all([
  import(new URL("../dist/src/composition/create-b8-readiness.js", import.meta.url)),
  import(new URL("../dist/src/ui/browser/readiness-templates.js", import.meta.url)),
]);
const css = await readFile(join(repo, "web", "styles.css"), "utf8");
const controller = createB8ReadinessController();

function shell(markup) {
  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WP13.4 B8-beredskap</title><style>${css}</style></head><body>
  <a class="skip-link" href="#main-content">Hopp til innholdet</a>
  <header class="site-header"><div><p class="eyebrow">WP13.4 · intern evidensvisning</p><h1>B8-beredskap</h1></div></header>
  <main id="main-content" tabindex="-1">${markup}</main><div class="sr-only" role="status" aria-live="polite"></div></body></html>`;
}

const browserExecutable = resolveBrowserExecutable();
const chromium = spawnOwnedProcess(browserExecutable, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--no-proxy-server", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: ["ignore", "ignore", "ignore"] });

let client;
try {
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${debugPort}/json/version`, {
    child: chromium,
    label: "Chromium readiness proof",
  });
  const create = await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: "PUT" });
  assert.equal(create.ok, true);
  const page = await create.json();
  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.open();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Accessibility.enable");
  const frameTree = await client.send("Page.getFrameTree");
  const frameId = frameTree.frameTree.frame.id;

  async function evaluate(expression) {
    const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "browser evaluation failed");
    return result.result?.value;
  }
  async function setMarkup(markup) {
    await client.send("Page.setDocumentContent", { frameId, html: shell(markup) });
    await wait(20);
  }

  await setMarkup(renderB8ReadinessMarkup(controller.snapshot));
  assert.match(await evaluate("document.querySelector('#readiness-title')?.textContent"), /ikke beslutningsklar/i);
  assert.equal(await evaluate("document.querySelectorAll('.readiness-gate').length"), 9);
  assert.ok((await evaluate("document.querySelectorAll('.readiness-requirement').length")) >= 20);
  assert.match(await evaluate("document.querySelector('.readiness-decision')?.textContent"), /rekruttering: ikke autorisert/i);
  assert.match(await evaluate("document.querySelector('.warning')?.textContent"), /ingen knapp.*starter pilot/i);
  assert.equal(await evaluate("[...document.querySelectorAll('button')].some((b) => /start.*pilot/i.test(b.textContent ?? ''))"), false);

  await client.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate(`[...document.querySelectorAll('select')].filter((node) => node.getClientRects().length > 0).every((node) => node.getBoundingClientRect().height >= 44)`), true);

  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  assert.ok(names.some((name) => /B8 er ikke beslutningsklar/i.test(name)));
  assert.ok(names.includes("Vis port"));
  assert.ok(names.includes("Stoppregler"));

  controller.selectGate("PRIVACY_LEGAL_ETHICS");
  await setMarkup(renderB8ReadinessMarkup(controller.snapshot));
  assert.ok((await evaluate("document.querySelectorAll('.readiness-requirement').length")) >= 5);
  assert.equal(await evaluate("[...document.querySelectorAll('.readiness-requirement .eyebrow')].every((n) => /Personvern, juss og etikk/.test(n.textContent ?? ''))"), true);

  controller.selectGate("ALL");
  await setMarkup(renderB8ReadinessMarkup(controller.snapshot));
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await mkdir(join(repo, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
  await writeFile(join(repo, "artifacts", "wp13-4-b8-readiness.png"), Buffer.from(screenshot.data, "base64"));
  console.log("Chromium B8 readiness, no-authorization, accessibility and reflow proof passed.");
} finally {
  await cleanupBrowserProof({
    browser: chromium,
    browserLabel: "Chromium readiness proof",
    client,
    profile,
    requestBrowserClose: client === undefined
      ? undefined
      : () => client.send("Browser.close"),
  });
}
