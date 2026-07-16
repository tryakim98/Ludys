import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const debugPort = 9333;
const profile = await mkdtemp(join(tmpdir(), "wp13-2-chromium-"));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url, attempts = 80) {
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

const [
  { VerticalProofController },
  { wordProofContentNb },
  { wordProofNb },
  { renderChildMarkup, renderAdultMarkup },
] = await Promise.all([
  import(new URL("../dist/src/application/vertical-proof-controller.js", import.meta.url)),
  import(new URL("../dist/src/content/fixtures/bm/word-proof-content.js", import.meta.url)),
  import(new URL("../dist/src/content/fixtures/bm/word-proof.js", import.meta.url)),
  import(new URL("../dist/src/ui/browser/templates.js", import.meta.url)),
]);

const css = await readFile(join(repo, "web", "styles.css"), "utf8");
const controller = new VerticalProofController({
  sessionId: "synthetic-browser-wp13-2",
  definition: wordProofNb,
  content: wordProofContentNb,
});

function shell(markup, view = "CHILD") {
  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LUDYS — syntetisk ordbygging</title><style>${css}</style></head><body>
  <a class="skip-link" href="#main-content">Hopp til aktiviteten</a>
  <header class="site-header"><div><p class="eyebrow">WP13.2 · syntetisk læringsproof</p><h1>Lyd for lyd</h1></div><label class="locale-control"><span>Målform</span><select><option>Bokmål</option><option>Nynorsk</option></select></label></header>
  <nav class="role-nav" aria-label="Visning"><button type="button" aria-pressed="${view === "CHILD"}">Barneside</button><button type="button" aria-pressed="${view === "ADULT"}">Voksenside</button></nav>
  <main id="main-content" tabindex="-1">${markup}</main>
  <div class="sr-only" role="status" aria-live="polite"></div><div class="sr-only" role="alert" aria-live="assertive"></div>
  <dialog id="transparency-dialog" aria-labelledby="transparency-title"><h2 id="transparency-title">Hva ser den voksne?</h2><p>Den voksne ser bokstavene du har valgt, om du ber om hjelp, og om aktiviteten er satt på pause eller stoppet.</p><p>Systemet beskriver ikke følelser, motivasjon eller hvem du er som person.</p><button id="close-transparency" type="button">Lukk</button></dialog>
  </body></html>`;
}

const chromium = spawn(
  "/usr/bin/chromium",
  [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--no-proxy-server", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
  ],
  { stdio: ["ignore", "ignore", "ignore"] },
);

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
  await client.send("DOM.enable");
  const frameTree = await client.send("Page.getFrameTree");
  const frameId = frameTree.frameTree.frame.id;

  async function evaluate(expression) {
    const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "browser evaluation failed");
    return result.result?.value;
  }

  async function setMarkup(markup, view = "CHILD") {
    await client.send("Page.setDocumentContent", { frameId, html: shell(markup, view) });
    await wait(20);
    await evaluate(`(() => {
      const opener = document.querySelector('button[data-action=transparency]');
      const dialog = document.querySelector('#transparency-dialog');
      const closer = document.querySelector('#close-transparency');
      if (opener && dialog && closer) {
        opener.addEventListener('click', () => { dialog.showModal(); closer.focus(); });
        closer.addEventListener('click', () => { dialog.close(); opener.focus(); });
        dialog.addEventListener('cancel', () => queueMicrotask(() => opener.focus())); dialog.addEventListener('close', () => opener.focus());
      }
    })()`);
  }

  await setMarkup(renderChildMarkup(controller.snapshot));
  assert.equal(await evaluate("document.title"), "LUDYS — syntetisk ordbygging");
  assert.equal(await evaluate("document.querySelectorAll('main').length"), 1);
  assert.equal(await evaluate("document.querySelectorAll('[role=status]').length"), 1);
  assert.equal(await evaluate("document.querySelectorAll('[role=alert]').length"), 1);

  await client.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 800, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate(`[...document.querySelectorAll('button:not([disabled]), select')].filter((node) => node.getClientRects().length > 0).every((node) => { const r=node.getBoundingClientRect(); return r.width>=44 && r.height>=44; })`), true);

  await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);

  await evaluate("document.body.focus()");
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement?.classList.contains('skip-link')"), true);
  assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none'"), true);

  await evaluate("document.querySelector('button[data-action=transparency]').click()");
  assert.equal(await evaluate("document.querySelector('#transparency-dialog').open"), true);
  assert.equal(await evaluate("document.activeElement?.id"), "close-transparency");
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await wait(20);
  assert.equal(await evaluate("document.querySelector('#transparency-dialog').open"), false);
  assert.equal(await evaluate("document.activeElement?.dataset.action"), "transparency");

  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  const roles = (ax.nodes ?? []).map((node) => node.role?.value).filter(Boolean);
  assert.ok(names.includes("Barneside"));
  assert.ok(names.includes("Voksenside"));
  assert.ok(names.includes("Hør lydene"));
  assert.ok(roles.includes("main"));
  assert.ok(roles.includes("button"));

  controller.dispatch({ kind: "SELECT_TILE", tileId: "sol-s" });
  await setMarkup(renderAdultMarkup(controller.snapshot), "ADULT");
  assert.match(await evaluate("document.querySelector('main').textContent"), /Barnet har valgt:\s*s/);

  controller.dispatch({ kind: "REQUEST_HELP" });
  await setMarkup(renderAdultMarkup(controller.snapshot), "ADULT");
  assert.equal(await evaluate("document.querySelector('.adult-card') !== null"), true);
  assert.match(await evaluate("document.querySelector('.adult-card').textContent"), /Systemet vet ikke hvorfor/);
  controller.dispatch({ kind: "ADULT_WAIT" });
  assert.equal(controller.snapshot.session.supportProvenance.length, 0);

  for (const tileId of ["sol-o", "sol-l"]) controller.dispatch({ kind: "SELECT_TILE", tileId });
  controller.dispatch({ kind: "SUBMIT_BUILD" });
  await setMarkup(renderChildMarkup(controller.snapshot));
  assert.match(await evaluate("document.querySelector('[data-feedback]').textContent"), /Les det høyt/);
  controller.dispatch({ kind: "ADULT_CONFIRM_READING" });
  for (const tileId of ["mus-m", "mus-u", "mus-s"]) controller.dispatch({ kind: "SELECT_TILE", tileId });
  controller.dispatch({ kind: "SUBMIT_BUILD" });
  controller.dispatch({ kind: "ADULT_CONFIRM_READING" });
  assert.equal(controller.snapshot.proof.targetEvidence, "INDEPENDENT");
  assert.equal(controller.snapshot.proof.transferEvidence, "NEAR_TRANSFER");
  assert.equal(controller.snapshot.session.phase, "COMPLETED");
  assert.doesNotMatch(JSON.stringify({ session: controller.snapshot.session, proof: controller.snapshot.proof }), /emotion|frustrat|motivation|diagnos/i);

  await setMarkup(renderChildMarkup(controller.snapshot));
  assert.match(await evaluate("document.querySelector('.completion').textContent"), /Nær transfer/);
  await mkdir(join(repo, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(join(repo, "artifacts", "wp13-3-vertical-proof.png"), Buffer.from(screenshot.data, "base64"));
  console.log("Chromium accessibility, responsive markup and shared-session projection proof passed.");
} finally {
  client?.close();
  chromium.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => chromium.once("exit", resolve)), wait(1000)]);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); break; }
    catch (error) { if (attempt === 4) console.warn(`Temporary Chromium profile remained: ${error}`); await wait(150); }
  }
}
