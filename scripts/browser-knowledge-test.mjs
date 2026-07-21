import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { removeBrowserProfile, stopChildProcess } from "./browser-cleanup.mjs";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const debugPort = 9334;
const profile = await mkdtemp(join(tmpdir(), "wp13-3-chromium-"));

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await wait(50);
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

const [
  { createKnowledgeLibraryController },
  { renderKnowledgeLibraryMarkup },
] = await Promise.all([
  import(new URL("../dist/src/composition/create-knowledge-library.js", import.meta.url)),
  import(new URL("../dist/src/ui/browser/knowledge-templates.js", import.meta.url)),
]);
const css = await readFile(join(repo, "web", "styles.css"), "utf8");
const controller = createKnowledgeLibraryController("nb-NO");

function shell(markup, locale = "nb-NO") {
  const lang = locale === "nn-NO" ? "nn" : "nb";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WP13.3 kunnskapsbank</title><style>${css}</style></head><body>
  <a class="skip-link" href="#main-content">Hopp til innholdet</a>
  <header class="site-header"><div><p class="eyebrow">WP13.3 · intern prototype</p><h1>Kunnskapsbank</h1></div></header>
  <nav class="role-nav" aria-label="Visning"><button>Barneside</button><button>Voksenside</button><button aria-pressed="true">Kunnskapsbank</button></nav>
  <main id="main-content" tabindex="-1">${markup}</main><div class="sr-only" role="status" aria-live="polite"></div></body></html>`;
}

const browserExecutable = resolveBrowserExecutable();
const chromium = spawn(browserExecutable, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--no-proxy-server", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: ["ignore", "ignore", "ignore"] });

let client;
try {
  await waitFor(`http://127.0.0.1:${debugPort}/json/version`);
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
  async function setMarkup(markup, locale = "nb-NO") {
    await client.send("Page.setDocumentContent", { frameId, html: shell(markup, locale) });
    await wait(20);
  }

  await setMarkup(renderKnowledgeLibraryMarkup(controller.snapshot));
  assert.equal(await evaluate("document.querySelectorAll('.knowledge-result').length"), 12);
  assert.equal(await evaluate("document.querySelectorAll('.knowledge-filters select').length"), 5);
  assert.equal(await evaluate("document.querySelector('audio')?.autoplay"), false);
  assert.equal(await evaluate("document.querySelector('audio')?.controls"), true);
  assert.match(await evaluate("document.querySelector('.warning')?.textContent"), /syntetisk lydkladd/i);
  assert.match(await evaluate("document.querySelector('audio')?.getAttribute('src')"), /knowledge-wait-nb-candidate\.wav$/);

  await client.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate(`[...document.querySelectorAll('button, select, summary')].filter((node) => node.getClientRects().length > 0).every((node) => { const r=node.getBoundingClientRect(); return r.height>=44; })`), true);

  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  assert.ok(names.includes("Kunnskapsbank – intern prototype"));
  assert.ok(names.includes("Rolle"));
  assert.ok(names.includes("Alder"));
  assert.ok(names.includes("Lyd"));

  controller.setFilters({ ageBand: "13-16" });
  await setMarkup(renderKnowledgeLibraryMarkup(controller.snapshot));
  assert.equal(await evaluate("document.querySelectorAll('.knowledge-result').length"), 4);
  controller.setFilters({ topic: "WRITING" });
  await setMarkup(renderKnowledgeLibraryMarkup(controller.snapshot));
  assert.equal(await evaluate("document.querySelectorAll('.knowledge-result').length"), 1);
  assert.match(await evaluate("document.querySelector('#knowledge-detail-title')?.textContent"), /melding/i);

  controller.setLocale("nn-NO");
  controller.setFilters({ ageBand: "6-9", topic: "READING" });
  await setMarkup(renderKnowledgeLibraryMarkup(controller.snapshot), "nn-NO");
  assert.equal(await evaluate("document.documentElement.lang"), "nn");
  assert.match(await evaluate("document.querySelector('.knowledge-lead')?.textContent"), /kort pause|tydeleg modell/i);

  await mkdir(join(repo, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
  await writeFile(join(repo, "artifacts", "wp13-3-knowledge-audio.png"), Buffer.from(screenshot.data, "base64"));
  console.log("Chromium knowledge, audio-control, filtering and reflow proof passed.");
} finally {
  try {
    await stopChildProcess(chromium, {
      label: "Chromium knowledge proof",
      windowsProcessTree: true,
      requestGracefulClose: client === undefined
        ? undefined
        : () => client.send("Browser.close"),
    });
  } finally {
    client?.close();
  }
  await removeBrowserProfile(profile, { rootPid: chromium.pid });
}
