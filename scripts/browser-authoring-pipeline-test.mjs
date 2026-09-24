import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupBrowserProof, spawnOwnedProcess, waitForOwnedProcessEndpoint } from "./browser-cleanup.mjs";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const serverPort = 4187;
const debugPort = 9340;
const profile = await mkdtemp(join(tmpdir(), "wp13-9-authoring-chromium-"));
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
  cwd: repo, env: { ...process.env, PORT: String(serverPort) }, stdio: ["ignore", "ignore", "ignore"],
});
const browser = spawnOwnedProcess(browserExecutable, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-proxy-server",
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: ["ignore", "ignore", "ignore"] });

let client;
try {
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${serverPort}/web/index.html`, { child: server, label: "WP13.9 authoring proof server" });
  await waitForOwnedProcessEndpoint(`http://127.0.0.1:${debugPort}/json/version`, { child: browser, label: "Chromium WP13.9 authoring proof" });
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

  await waitForExpression("document.documentElement?.dataset.wp13_9Ready === 'true'");
  await waitForExpression("navigator.serviceWorker.controller !== null");
  assert.equal(await evaluate("document.documentElement.dataset.authoringPolicy"), "READY");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().packages.length"), 10);
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "NOT_CREATED");
  await press("[data-authoring-action=open]");
  assert.match(await evaluate("document.querySelector('.authoring-boundary').textContent"), /DRAFT.*EXTERNAL_REVIEW_REQUIRED.*0 EXTERNAL RECEIPTS.*PUBLISHING BLOCKED.*NOT STUDENT BETA/s);
  assert.match(await evaluate("document.querySelector('.authoring-boundary').textContent"), /AUTHORING_PIPELINE_READY.*AUDIO_PRODUCTION_PIPELINE_READY.*SYNTHETIC_ONLY/s);
  assert.equal(await evaluate("document.querySelectorAll('.dimension-grid li').length"), 10);
  assert.match(await evaluate("document.querySelector('#dimensions-heading').textContent"), /ikke barnetyper/i);
  assert.equal(await evaluate("document.querySelectorAll('[data-authoring-audio-spec]').length"), 6);
  assert.equal(await evaluate("document.querySelector('[data-authoring-action=withdraw]') !== null"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Publiser').disabled"), true);

  const originalPackageId = await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.packageId");
  const contentProposals = [
    ["authoring-package-activity-nor-two-syllable-maane-saape-001", "måne", "såpe"],
    ["authoring-package-activity-nor-two-syllable-kake-bake-002", "kake", "bake"],
  ];
  for (const [packageId, target, transfer] of contentProposals) {
    await change("#authoring-package-select", packageId);
    for (const locale of ["nb-NO", "nn-NO"]) {
      await press(`[data-authoring-locale='${locale}']`);
      assert.equal(await evaluate("document.querySelector('[data-authoring-field=targetWord]').value"), target);
      assert.equal(await evaluate("document.querySelector('[data-authoring-field=transferWord]').value"), transfer);
      assert.match(await evaluate("document.querySelector('[data-content-proposal]').textContent"), locale === "nb-NO" ? /venter på fagreview/ : /ventar på fagreview/);
      assert.match(await evaluate("document.querySelector('[data-child-preview]').textContent"), locale === "nb-NO" ? /Se på/ : /Sjå på/);
      assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.audioSpecifications.every((spec) => spec.specificationHumanReviewed === false && spec.specificationReviewSource === null)"), true);
    }
    await press("[data-authoring-action=export]");
    const proposal = JSON.parse(await evaluate("document.querySelector('#authoring-json').value"));
    assert.equal(proposal.pendingPatternReview.humanReviewed, false);
    assert.equal(proposal.localReviewNotes.length, 0);
    await press("[data-authoring-action=import]");
    assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().lastAction"), "VALIDATED_DRAFT_IMPORTED");
  }
  await change("#authoring-package-select", originalPackageId);
  await press("[data-authoring-locale='nb-NO']");

  await change("[data-authoring-field=title]", "Redigert BM-tittel i verksted");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.locales['nb-NO'].title"), "Redigert BM-tittel i verksted");
  await press("[data-authoring-locale='nn-NO']");
  assert.notEqual(await evaluate("document.querySelector('[data-authoring-field=title]').value"), "Redigert BM-tittel i verksted");
  await change("[data-authoring-field=title]", "Redigert NN-tittel i verkstad");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.locales['nn-NO'].title"), "Redigert NN-tittel i verkstad");

  await change("#authoring-clone-id", "activity-nor-browser-draft-009");
  await press("[data-authoring-action=clone]");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().packages.length"), 11);
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.activityId"), "activity-nor-browser-draft-009");

  await press("[data-authoring-action=add-review]");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.localReviewNotes[0].externalReceipt"), false);
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().externalReceiptCount"), 0);
  await press("[data-authoring-action=handoff]");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.reviewStatus"), "REVIEW_PENDING");
  await press("[data-authoring-action=export]");
  const exported = await evaluate("document.querySelector('#authoring-json').value");
  assert.equal(JSON.parse(exported).schemaVersion, "WP13.9-AUTHORING-1");
  await press("[data-authoring-action=import]");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().lastAction"), "VALIDATED_DRAFT_IMPORTED");

  const audioId = await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.audioSpecifications[0].semanticAudioId");
  await change(`[data-audio-script-id=${JSON.stringify(audioId)}]`, "Revidert lokalt manus som krever ny menneskelig lyd.");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.audioSpecifications[0].stale"), true);
  await press(`[data-authoring-action=attach-take-a][data-audio-id=${JSON.stringify(audioId)}]`);
  await press(`[data-authoring-action=attach-take-b][data-audio-id=${JSON.stringify(audioId)}]`);
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.audioSpecifications[0].replacementId"), "wp13-9-technical-take-a");
  await press(`[data-authoring-action=preview-audio][data-audio-id=${JSON.stringify(audioId)}]`);
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().audioPreviewState"), "TECHNICAL_TRIAL_REQUESTED");
  await press("[data-authoring-action=stop-audio]");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().audioPreviewState"), "STOPPED");
  assert.equal(await evaluate("document.querySelector('[data-child-preview]') !== null && document.querySelector('[data-adult-preview]') !== null"), true);

  const initialPackageId = await evaluate("window.__WP13_9__.getAuthoringView().packages[0].packageId");
  await change("#authoring-package-select", initialPackageId);
  await press("[data-authoring-action=withdraw]");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.lifecycle"), "WITHDRAWN");
  assert.equal(await evaluate("window.__WP13_9__.getAuthoringView().selectedPackage.audioSpecifications.every((item) => item.lifecycle === 'WITHDRAWN' && item.activeTakeId === null)"), true);
  assert.equal(await evaluate("window.__WP13_7B__.getViewModel().lifecycleState"), "NOT_CREATED");

  await change("#authoring-package-select", contentProposals[0][0]);
  await press("[data-authoring-locale='nn-NO']");
  await client.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await mkdir(join(repo, "artifacts"), { recursive: true });
  const contentScreenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(join(repo, "artifacts", "content-expansion-workshop-nn.png"), Buffer.from(contentScreenshot.data, "base64"));
  console.log("Content expansion online browser checks passed: both proposals, BM/NN, preview, unreviewed provenance, JSON export/import and 320px reflow.");

  await client.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: "none" });
  await client.send("Network.overrideNetworkState", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: "none" });
  // Verify ordinary offline navigation. In Chromium 153, ignoreCache also
  // bypasses the controlling worker, so a hard refresh requires the network.
  const beforeReload = await evaluate("performance.timeOrigin");
  await client.send("Page.reload");
  await waitForExpression(`performance.timeOrigin !== ${JSON.stringify(beforeReload)}`);
  await waitForExpression("document.documentElement?.dataset.wp13_9Ready === 'true'");
  assert.equal(await evaluate("document.documentElement.dataset.authoringPolicy"), "READY");
  assert.equal(await evaluate(`window.__WP13_9__.getAuthoringView().packages.find((item) => item.packageId === ${JSON.stringify(initialPackageId)}).lifecycle`), "WITHDRAWN");
  assert.equal(await evaluate(`window.__WP13_9__.getAuthoringView().packages.find((item) => item.packageId === ${JSON.stringify(initialPackageId)}).selected`), true);
  await press("[data-authoring-action=open]");
  assert.match(await evaluate("document.body.textContent"), /WITHDRAWN/);
  // The new module and complete proposals must be available after offline reload.
  await change("#authoring-package-select", contentProposals[0][0]);
  await press("[data-authoring-locale='nn-NO']");
  assert.match(await evaluate("document.querySelector('[data-content-proposal]').textContent"), /ventar på fagreview/);

  await client.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  assert.equal(await evaluate(`[...document.querySelectorAll('button, input, select, textarea')].filter((node) => node.getClientRects().length > 0).every((node) => { const r = node.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })`), true);
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  assert.ok((await evaluate("window.visualViewport?.scale ?? 1")) >= 2);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
  await evaluate("document.querySelector('.skip-link').focus()");
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement?.matches('button, input, select, textarea')"), true);
  const ax = await client.send("Accessibility.getFullAXTree");
  const names = (ax.nodes ?? []).map((node) => node.name?.value).filter(Boolean);
  const roles = (ax.nodes ?? []).map((node) => node.role?.value).filter(Boolean);
  assert.ok(names.some((name) => /Innholdsverksted/.test(name)));
  assert.ok(names.some((name) => /Publisering er permanent teknisk blokkert/.test(name)));
  assert.ok(roles.includes("main") && roles.includes("button") && roles.includes("textbox"));

  await client.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: "wifi" });
  await client.send("Network.overrideNetworkState", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: "wifi" });
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await mkdir(join(repo, "artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
  await writeFile(join(repo, "artifacts", "wp13-9-authoring-audio-pipeline.png"), Buffer.from(screenshot.data, "base64"));
  console.log("Chromium WP13.9 authoring, BM/NN, review, import/export, audio lifecycle, offline withdrawal and accessibility proof passed.");
} finally {
  await cleanupBrowserProof({
    browser, browserLabel: "Chromium WP13.9 authoring proof", client, profile,
    requestBrowserClose: client === undefined ? undefined : () => client.send("Browser.close"),
    server, serverLabel: "WP13.9 authoring proof server",
  });
}
