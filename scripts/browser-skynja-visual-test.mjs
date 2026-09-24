import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupBrowserProof, spawnOwnedProcess, waitForOwnedProcessEndpoint } from "./browser-cleanup.mjs";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const serverPort = 4192;
const debugPort = 9345;
const profile = await mkdtemp(join(tmpdir(), "skynja-design-chromium-"));
const browserExecutable = resolveBrowserExecutable();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browserErrors = [];
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
      if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") browserErrors.push(JSON.stringify(message.params.args));
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
  cwd: repo, env: { ...process.env, PORT: String(serverPort) }, stdio: ["ignore", "ignore", "ignore"],
});
const browser = spawnOwnedProcess(browserExecutable, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-proxy-server",
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: ["ignore", "ignore", "ignore"] });

let client;
try {
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${serverPort}/web/index.html`, { child: server, label: "Skynja exercise proof server" });
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${debugPort}/json/version`, { child: browser, label: "Chromium Skynja exercise proof" });
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
    const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "browser evaluation failed");
    return result.result?.value;
  }
  async function waitForExpression(expression, attempts = 900) {
    for (let index = 0; index < attempts; index += 1) {
      try { if (await evaluate(expression)) return; } catch (error) {
        if (!/context|target|navigation|detached|closed|null/i.test(String(error))) throw error;
      }
      await wait(50);
    }
    const diagnostic = await evaluate("JSON.stringify({ url: location.href, title: document.title, state: document.readyState, flags: document.documentElement?.dataset, body: document.body?.innerText?.slice(0, 400) })").catch(() => "unavailable");
    throw new Error(`Timed out waiting for browser expression: ${expression}; diagnostic=${diagnostic}`);
  }
  async function press(selector) {
    assert.equal(await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), true, selector);
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", text: " ", unmodifiedText: " ", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await wait(40);
  }
  async function change(selector, value) {
    await evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); node.value = ${JSON.stringify(value)}; node.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await wait(40);
  }

  async function settle() { await evaluate('Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})))'); }
  async function viewport(width, height = 960) {
    await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await settle();
    const fits = await evaluate('document.documentElement.scrollWidth <= innerWidth');
    if (!fits) {
      console.error(await evaluate(`JSON.stringify([...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1 && node.getClientRects().length).map(node => ({tag:node.tagName, class:node.className, text:node.textContent.slice(0,80), width:node.getBoundingClientRect().width})).slice(0,12))`));
      await screenshot('overflow');
    }
    assert.equal(fits, true, `Reflow at ${width}px`);
  }
  async function screenshot(name) {
    await settle();
    await evaluate('window.scrollTo(0, 0)');
    await mkdir(join(repo, 'artifacts'), { recursive: true });
    const shot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(join(repo, 'artifacts', `skynja-design-${name}.png`), Buffer.from(shot.data, 'base64'));
  }
  async function primaryContrast() {
    return evaluate(`(() => {
      const style = getComputedStyle(document.querySelector('[data-exercise-action=start]'));
      const luminance = color => {
        const channels = color.match(/[\\d.]+/g).slice(0,3).map(Number).map(v => { v /= 255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; });
        return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
      };
      const a = luminance(style.color), b = luminance(style.backgroundColor);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    })()`);
  }

  await waitForExpression('window.__SKYNJA_EXERCISES__ !== undefined');
  await evaluate('window.__SKYNJA_EXERCISES__.ready');
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await viewport(1440);
  assert.match(await evaluate('document.title'), /^Skynja/);
  assert.doesNotMatch(await evaluate('document.body.innerText'), /WP13|syntetisk proof|EXTERNAL_REVIEW|AI-assistert/);
  await screenshot('home-desktop');
  await viewport(320);
  assert.equal(await evaluate(`[...document.querySelectorAll('button, select')].filter(node => node.getClientRects().length > 0).every(node => { const r = node.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })`), true);
  await change('#app-locale', 'nn-NO');
  assert.match(await evaluate('document.querySelector("h1").textContent'), /Kva vil du/);
  await screenshot('home-mobile');
  await change('#app-locale', 'nb-NO');
  await viewport(1440);
  await press('[data-exercise-action=open]');
  assert.ok(await evaluate('document.getAnimations().length > 0'), 'Catalog has a short entry transition');
  await screenshot('catalog-desktop');
  await viewport(320);
  await screenshot('catalog-mobile');
  await viewport(1440);
  await press('[data-exercise-action=select][data-exercise-id=skynja-maane-saape]');
  assert.ok(await primaryContrast() >= 4.5, 'Primary button contrast in light mode');
  await press('[data-exercise-action=start]');
  await settle();
  const tile = await evaluate('document.querySelector("button[data-tile-id]:not(:disabled)").dataset.tileId');
  await press(`#exercise-bank-${tile}`);
  assert.equal(await evaluate(`document.activeElement.id`), `exercise-picked-${tile}`);
  assert.ok(await evaluate('document.getAnimations().length > 0'), 'Chosen tile moves to the answer');
  await screenshot('word-desktop');
  await press('[data-exercise-action=hint]');
  assert.equal(await evaluate('document.activeElement.id'), 'exercise-hint');
  await press('[data-exercise-action=pause]');
  assert.equal(await evaluate('window.__SKYNJA_EXERCISES__.getView().stage'), 'PAUSED');
  await press('[data-exercise-action=resume]');
  await press('[data-exercise-action=stop]');
  await press('[data-exercise-action=catalog]');

  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }] });
  await settle();
  await press('[data-exercise-action=select][data-exercise-id=skynja-reading-notice]');
  assert.equal(await evaluate('document.getAnimations().length'), 0, 'Reduced motion disables new page animation');
  assert.ok(await primaryContrast() >= 4.5, 'Primary button contrast in dark mode');
  await screenshot('dark');
  await press('[data-exercise-action=start]');
  await press('[data-exercise-action=option]');
  assert.equal(await evaluate('document.getAnimations().length'), 0);
  await viewport(320);
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  assert.ok(await evaluate('visualViewport.scale >= 2'));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  await press('[data-exercise-action=stop]');
  await press('[data-exercise-action=catalog]');
  await press('[data-exercise-action=review-open]');
  await viewport(320);
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#review-note-observation")).fontSize'), '18px');
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }] });
  await viewport(1440);
  await screenshot('review-desktop');
  await press('[data-exercise-action=review-close]');
  await press('[data-exercise-action=close]');
  await press('[data-authoring-action=open]');
  await screenshot('workshop-desktop');
  await viewport(320);
  const ax = await client.send('Accessibility.getFullAXTree');
  assert.ok(ax.nodes.some(node => node.role?.value === 'main'));
  assert.deepEqual(browserErrors, []);
  console.log('Skynja design: desktop/320px reflow, bilingual home, visible product copy, actual transitions, tile/focus/pause controls, light/dark primary contrast, reduced motion, 200% zoom, review and workshop passed. Eight visual captures saved.');
} finally {
  await cleanupBrowserProof({ browser, browserLabel: 'Skynja design Chromium', client, profile,
    requestBrowserClose: client === undefined ? undefined : () => client.send('Browser.close'),
    server, serverLabel: 'Skynja design server' });
}
