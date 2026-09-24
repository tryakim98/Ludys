import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupBrowserProof, spawnOwnedProcess, waitForOwnedProcessEndpoint } from "./browser-cleanup.mjs";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const serverPort = 4191;
const debugPort = 9344;
const profile = await mkdtemp(join(tmpdir(), "skynja-exercises-chromium-"));
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
  const downloads = join(profile, "downloads");
  await mkdir(downloads, { recursive: true });
  await client.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  async function download(selector, name) {
    await rm(join(downloads, name), { force: true });
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const content = await readFile(join(downloads, name), "utf8").catch(() => undefined);
      if (content !== undefined && content.length > 0) return content;
      await wait(50);
    }
    throw new Error(`Review download did not complete: ${name}`);
  }
  async function importNotes(path) {
    await evaluate('document.querySelector("#review-notes-message").textContent = ""');
    const document = await client.send('DOM.getDocument');
    const input = await client.send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#review-notes-file' });
    await client.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] });
    await waitForExpression('document.querySelector("#review-notes-message")?.textContent.length > 0');
  }
  async function writeNote(text) {
    await change('#review-note-locale', 'nn-NO');
    await change('#review-note-round', 'evidence-price');
    await evaluate(`(() => { const field = document.querySelector('#review-note-observation'); field.value = ${JSON.stringify(text)}; field.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#review-note-form').requestSubmit(); })()`);
    await waitForExpression('document.querySelectorAll("li[data-review-note-id]").length > 0');
  }

  const view = () => evaluate('window.__SKYNJA_EXERCISES__.getView()');
  async function ready() {
    await waitForExpression('window.__SKYNJA_EXERCISES__ !== undefined');
    await evaluate('window.__SKYNJA_EXERCISES__.ready');
    await waitForExpression('navigator.serviceWorker.controller !== null');
  }
  async function reload() {
    const previousOrigin = await evaluate('performance.timeOrigin');
    await client.send('Page.reload');
    await waitForExpression(`performance.timeOrigin !== ${JSON.stringify(previousOrigin)}`);
    await ready();
  }
  async function screenshot(name) {
    await mkdir(join(repo, 'artifacts'), { recursive: true });
    const shot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(join(repo, 'artifacts', name), Buffer.from(shot.data, 'base64'));
  }
  async function start(id) {
    await press(`[data-exercise-action=select][data-exercise-id="${id}"]`);
    assert.equal((await view()).stage, 'INTRO');
    await press('[data-exercise-action=start]');
    assert.equal((await view()).stage, 'ACTIVE');
    assert.equal(await evaluate('document.activeElement.id'), 'exercise-title');
  }
  async function answer() {
    const { round } = await view();
    if (round.type === 'ARRANGE') {
      const target = round.acceptedAnswers[0];
      const search = (remaining, ids, value) => {
        if (!remaining.length) return value === target ? ids : undefined;
        for (const tile of remaining) {
          const next = value + (ids.length ? round.joiner : '') + tile.label;
          if (!target.startsWith(next)) continue;
          const found = search(remaining.filter(t => t.id !== tile.id), [...ids, tile.id], next);
          if (found) return found;
        }
      };
      const tiles = search(round.tiles, [], '');
      assert.ok(tiles);
      for (const id of tiles) {
        await press(`#exercise-bank-${id}`);
        assert.equal(await evaluate('document.activeElement.id'), `exercise-picked-${id}`);
      }
    } else {
      const candidate = round.options.find(o => o.verdict !== 'TRY_AGAIN');
      await press(`[data-option-id="${candidate.id}"]`);
      assert.equal(await evaluate('document.activeElement.getAttribute("aria-pressed")'), 'true');
      if (round.type === 'EVIDENCE') {
        await press(`[data-evidence-id="${candidate.evidenceIds[0]}"]`);
        assert.equal(await evaluate('document.activeElement.getAttribute("aria-pressed")'), 'true');
      }
    }
    await press('[data-exercise-action=check]');
    assert.notEqual((await view()).feedback.verdict, 'TRY_AGAIN');
    assert.equal(await evaluate('document.activeElement.id'), 'exercise-feedback');
    assert.equal((await view()).canContinue, true);
  }

  await ready();
  assert.equal((await view()).catalog.length, 13);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 950, deviceScaleFactor: 1, mobile: false });
  await press('[data-exercise-action=open]');
  assert.equal(await evaluate('document.querySelectorAll("[data-exercise-card]").length'), 13);
  assert.match(await evaluate('document.querySelector(".exercise-draft").textContent'), /Venter på faglig og språklig/);
  await screenshot('skynja-exercises-catalog.png');
  await press('[data-exercise-action=filter][data-filter=READING]');
  assert.equal(await evaluate('document.querySelectorAll("[data-exercise-card]").length'), 2);
  await press('[data-exercise-action=filter][data-filter=ALL]');

  // A reviewer can inspect both languages and download the actual complete handoff.
  await press('[data-exercise-action=review-open]');
  assert.equal(await evaluate('document.activeElement.id'), 'exercise-title');
  assert.equal(await evaluate('document.querySelectorAll("#exercise-review-select option").length'), 13);
  await change('#exercise-review-select', 'skynja-find-evidence');
  assert.equal(await evaluate('document.activeElement.id'), 'exercise-review-heading');
  assert.equal(await evaluate('document.querySelectorAll(".exercise-review-round").length'), 6);
  assert.equal(await evaluate('document.querySelectorAll(".exercise-review-columns > [lang=nn]").length'), 7);
  const packet = JSON.parse(await download('#exercise-review-json', 'skynja-innhold.json'));
  assert.equal(packet.exerciseCount, 13);
  assert.equal(packet.localizedRoundCount, 112);
  assert.equal(packet.status, 'AWAITING_HUMAN_REVIEW');
  assert.equal(packet.pilotAuthorization, 'NOT_GRANTED');
  const form = JSON.parse(await download('#exercise-review-form', 'skynja-vurderingsmal.json'));
  assert.equal(form.contentSetSha256, packet.contentSetSha256);
  assert.equal(form.reviews.length, 26);
  assert.ok(form.reviews.every(review => review.conclusion === 'NOT_REVIEWED' && review.reviewerReference === ''));
  const markdown = await download('#exercise-review-markdown', 'skynja-innholdsgjennomgang.md');
  assert.equal((markdown.match(/#### Runde /gu) ?? []).length, 112);
  assert.ok(markdown.includes(packet.contentSetSha256));
  await writeNote('Syntetisk funn: spørsmålet bør vurderast på nynorsk.');
  const noteJson = await download('#review-notes-download', 'skynja-arbeidsnotater.json');
  const noteFile = JSON.parse(noteJson);
  assert.equal(noteFile.classification, 'EDITORIAL_NOTES_NOT_APPROVAL');
  assert.equal(noteFile.notes[0].roundId, 'evidence-price');
  assert.equal(noteFile.notes[0].locale, 'nn-NO');
  const validNotePath = join(downloads, 'saved-notes.json');
  await writeFile(validNotePath, noteJson);
  await press('[data-review-note-action=clear]');
  assert.equal(await evaluate('document.querySelectorAll("li[data-review-note-id]").length'), 0);
  await importNotes(validNotePath);
  assert.equal(await evaluate('document.querySelectorAll("li[data-review-note-id]").length'), 1);
  await evaluate(`(() => { const field = document.querySelector('#review-note-observation'); field.value = 'Uferdig notat skal bli verande.'; field.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await change('#exercise-review-select', 'skynja-reading-notice');
  await change('#exercise-review-select', 'skynja-find-evidence');
  assert.equal(await evaluate('document.querySelector("#review-note-observation").value'), 'Uferdig notat skal bli verande.');
  const invalidNotePath = join(downloads, 'stale-notes.json');
  await writeFile(invalidNotePath, JSON.stringify({ ...noteFile, contentSetSha256: '0'.repeat(64) }));
  await importNotes(invalidNotePath);
  assert.equal(await evaluate('document.querySelectorAll("li[data-review-note-id]").length'), 1);
  assert.equal(await evaluate('document.querySelector("#review-note-observation").value'), 'Uferdig notat skal bli verande.');
  assert.match(await evaluate('document.querySelector("#review-notes-message").textContent'), /annen innholdsversjon/);
  await screenshot('skynja-review-notes.png');
  await press('[data-review-note-action=clear]');
  assert.equal(await evaluate('document.querySelector("#review-note-observation").value'), '');
  console.log('Browser: real note file round-trip, explicit Nynorsk/round binding, stale-file rejection and preservation of unfinished notes passed.');
  await screenshot('skynja-review-desktop.png');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  await screenshot('skynja-review-mobile.png');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'review reflows at 320px');
  await press('[data-exercise-action=review-close]');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 950, deviceScaleFactor: 1, mobile: false });
  console.log('Browser: bilingual review, all 112 localized rounds, real Markdown/JSON/form downloads, empty review status and 320px layout passed.');

  // Every exercise is reachable, interactive and explicitly localized in both variants.
  for (const locale of ['nb-NO', 'nn-NO']) {
    await change('#exercise-locale', locale);
    assert.equal(await evaluate('document.documentElement.lang'), locale === 'nb-NO' ? 'nb' : 'nn');
    const catalog = (await view()).catalog;
    for (const exercise of catalog) {
      await start(exercise.id);
      assert.equal((await view()).variant.title, exercise.locales[locale].title);
      assert.equal(await evaluate('document.querySelector("#exercise-locale").disabled'), true);
      for (const round of exercise.locales[locale].rounds) {
        assert.equal((await view()).round.id, round.id);
        await answer();
        await press('[data-exercise-action=next]');
      }
      assert.equal((await view()).stage, 'COMPLETED');
      assert.equal((await view()).records.length, exercise.locales[locale].rounds.length);
      await press('[data-exercise-action=catalog]');
    }
  }
  console.log('Browser: all 112 localized rounds across 13 exercises / seven types complete using keyboard controls.');

  // A correct answer cannot advance until the learner explicitly selects its source.
  for (const locale of ['nb-NO', 'nn-NO']) {
    await change('#exercise-locale', locale);
    await start('skynja-find-evidence');
    await press('[data-option-id=evidence-meeting-option-1]');
    assert.equal(await evaluate('document.querySelector("[data-exercise-action=check]").disabled'), true);
    await press('[data-evidence-id=meeting-end]');
    await press('[data-exercise-action=check]');
    assert.equal((await view()).feedback.verdict, 'TRY_AGAIN');
    assert.equal((await view()).canContinue, false);
    await press('[data-evidence-id=meeting-place]');
    assert.equal((await view()).feedback, undefined);
    assert.equal(await evaluate('document.activeElement.id'), 'exercise-evidence-meeting-place');
    await press('[data-exercise-action=pause]');
    await press('[data-exercise-action=resume]');
    assert.equal((await view()).selectedEvidence, 'meeting-place');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'evidence reflows at 320px');
    assert.equal(await evaluate(`[...document.querySelectorAll('[data-evidence-id]')].every(n => { const r=n.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })`), true);
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate('scrollTo(0, 0)');
    await screenshot(`skynja-evidence-${locale}.png`);
    for (const expected of ['MATCHED', 'MATCHED', 'REASONABLE', 'NEEDS_CONTEXT', 'MATCHED', 'MATCHED']) {
      await answer();
      assert.equal((await view()).feedback.verdict, expected);
      await press('[data-exercise-action=next]');
      assert.equal((await view()).selectedEvidence, undefined);
    }
    assert.equal((await view()).stage, 'COMPLETED');
    assert.equal((await view()).records.length, 6);
    await press('[data-exercise-action=catalog]');
  }
  console.log('Browser: six evidence rounds in both languages require answer + source; wrong source, missing information, pause, keyboard focus and mobile layout passed.');

  await change('#exercise-locale', 'nb-NO');
  await start('skynja-cloze-context');
  await press('[data-option-id=wet-coat-option-0]');
  await press('[data-exercise-action=check]');
  assert.equal((await view()).feedback.verdict, 'TRY_AGAIN');
  assert.equal(await evaluate('document.querySelector("[data-exercise-action=next]").disabled'), true);
  await press('[data-exercise-action=hint]');
  assert.equal(await evaluate('document.activeElement.id'), 'exercise-hint');
  await answer();
  await press('[data-exercise-action=next]');
  await press('[data-exercise-action=model]');
  assert.equal(await evaluate('document.activeElement.id'), 'exercise-model');
  await press('[data-exercise-action=pause]');
  assert.equal((await view()).stage, 'PAUSED');
  assert.equal(await evaluate('document.querySelector(".exercise-stimulus") === null'), true);
  await press('[data-exercise-action=resume]');
  assert.equal((await view()).modelVisible, true);
  await press('[data-exercise-action=next]');
  await press('[data-exercise-action=skip]');
  await press('[data-exercise-action=skip]');
  assert.equal((await view()).stage, 'COMPLETED');
  assert.deepEqual((await view()).records.map(r => r.outcome), ['ANSWERED', 'MODEL_VIEWED', 'SKIPPED', 'SKIPPED']);
  assert.equal((await view()).records[0].hintUsed, true);
  assert.match(await evaluate('document.querySelector("#exercise-main").textContent'), /ikke en vurdering av leseferdighet/);
  await press('[data-exercise-action=catalog]');

  await start('skynja-judgment-support');
  await press('[data-option-id=support-story-option-2]');
  await press('[data-exercise-action=check]');
  assert.equal((await view()).feedback.verdict, 'REASONABLE');
  await press('[data-exercise-action=next]');
  await press('[data-exercise-action=skip]');
  await press('[data-option-id=support-silence-option-2]');
  await press('[data-exercise-action=check]');
  assert.equal((await view()).feedback.verdict, 'NEEDS_CONTEXT');
  assert.equal((await view()).canContinue, true);
  await press('[data-exercise-action=close]');
  assert.equal((await view()).records.length, 0);
  await press('[data-exercise-action=open]');
  assert.equal((await view()).stage, 'CATALOG');

  await change('#exercise-locale', 'nn-NO');
  await start('skynja-reading-garden');
  await screenshot('skynja-exercises-reading-nn.png');
  for (const width of [320, 640]) {
    await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `no overflow at ${width}`);
    assert.equal(await evaluate(`[...document.querySelectorAll('.exercise-room button, .exercise-room select')].filter(n => n.getClientRects().length).every(n => { const r=n.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })`), true);
  }
  await client.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  await screenshot('skynja-exercises-mobile-nn.png');
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  assert.ok(await evaluate('visualViewport.scale >= 2'));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await evaluate('document.querySelector(".skip-link").focus()');
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate('document.activeElement.matches("button,select")'), true);
  const tree = await client.send('Accessibility.getFullAXTree');
  assert.ok(tree.nodes.some(n => n.role?.value === 'main'));
  assert.ok(tree.nodes.some(n => /Hopp over denne runden/.test(n.name?.value ?? '')));
  await press('[data-exercise-action=stop]');
  await press('[data-exercise-action=catalog]');

  // A restrictive policy reaches the new room and remains restrictive after reload.
  await start('skynja-maane-saape');
  await evaluate(`window.__WP13_8__.applyRestrictivePolicy({policyRevision: 2, restrictions: [{scope: 'ACTIVITY', scopeId: 'activity-nor-two-syllable-maane-saape-001', lifecycleStatus: 'WITHDRAWN'}], containsPersonData: false, resurrectionAllowed: false})`);
  assert.equal((await view()).stage, 'STOPPED');
  await press('[data-exercise-action=catalog]');
  assert.equal(await evaluate('document.querySelector("[data-exercise-id=skynja-maane-saape]").disabled'), true);
  await evaluate(`window.__WP13_9__.applyRestrictivePolicy({policyRevision: 2, restrictions: [{scope: 'AUTHORING_PACKAGE', scopeId: 'authoring-package-activity-nor-two-syllable-kake-bake-002', lifecycleStatus: 'WITHDRAWN'}], containsPersonData: false, resurrectionAllowed: false, publishingAuthority: false})`);
  assert.equal(await evaluate('document.querySelector("[data-exercise-id=skynja-kake-bake]").disabled'), true);
  await press('[data-exercise-action=review-open]');
  assert.equal(await evaluate('document.querySelectorAll("#exercise-review-select option").length'), 11);
  assert.equal(await evaluate('document.querySelector("#exercise-review-select option[value=skynja-maane-saape]") === null'), true);
  await change('#exercise-review-select', 'skynja-find-evidence');
  await writeNote('Syntetisk notat som skal fjernast ved sperring.');
  await evaluate(`window.__WP13_8__.applyRestrictivePolicy({policyRevision: 3, restrictions: [{scope: 'ACTIVITY', scopeId: 'skynja-find-evidence', lifecycleStatus: 'WITHDRAWN'}], containsPersonData: false, resurrectionAllowed: false})`);
  assert.equal(await evaluate('document.querySelectorAll("#exercise-review-select option").length'), 10);
  assert.equal(await evaluate('document.querySelector("[data-review-exercise=skynja-find-evidence]") === null'), true);
  assert.match(await evaluate('document.querySelector("#review-notes-download").textContent'), /\(0\)/);
  await press('[data-exercise-action=review-close]');
  await reload();
  assert.equal((await view()).stage, 'CATALOG');
  await press('[data-exercise-action=open]');
  assert.equal(await evaluate('document.querySelector("[data-exercise-id=skynja-maane-saape]").disabled'), true);
  assert.deepEqual(browserErrors, []);
  console.log('Browser: retries, hints, model, pause/resume, stop, summaries, multiple valid choices, 320px reflow, zoom, accessibility tree and persisted restrictions passed.');

  // Normal reload exercises the PWA. Chromium 153's ignoreCache reload bypasses the worker.
  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: 'none' });
  await reload();
  await press('[data-exercise-action=open]');
  assert.equal(await evaluate('document.querySelector("[data-exercise-id=skynja-maane-saape]").disabled'), true);
  await change('#exercise-locale', 'nn-NO');
  await press('[data-exercise-action=review-open]');
  assert.equal(await evaluate('document.querySelectorAll("#exercise-review-select option").length'), 10);
  assert.equal(await evaluate('document.querySelector("#exercise-review-select option[value=skynja-find-evidence]") === null'), true);
  const offlinePacket = JSON.parse(await download('#exercise-review-json', 'skynja-innhold.json'));
  assert.equal(offlinePacket.exerciseCount, 10);
  assert.equal(offlinePacket.exercises.some(entry => entry.exerciseId === 'skynja-find-evidence'), false);
  assert.notEqual(offlinePacket.contentSetSha256, packet.contentSetSha256);
  await importNotes(validNotePath);
  assert.match(await evaluate('document.querySelector("#review-notes-message").textContent'), /annan innhaldsversjon/);
  assert.match(await evaluate('document.querySelector("#review-notes-download").textContent'), /\(0\)/);
  await change('#exercise-review-select', 'skynja-reading-notice');
  await evaluate(`(() => { const field = document.querySelector('#review-note-observation'); field.value = 'Syntetisk notat skrive utan nett.'; field.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#review-note-form').requestSubmit(); })()`);
  const offlineNotes = JSON.parse(await download('#review-notes-download', 'skynja-arbeidsnotater.json'));
  assert.equal(offlineNotes.notes[0].locale, 'nn-NO');
  assert.equal(offlineNotes.notes[0].exerciseId, 'skynja-reading-notice');
  await press('[data-review-note-action=clear]');
  await importNotes(join(downloads, 'skynja-arbeidsnotater.json'));
  assert.equal(await evaluate('document.querySelectorAll("li[data-review-note-id]").length'), 1);
  await press('[data-review-note-action=clear]');
  await press('[data-exercise-action=review-close]');
  await start('skynja-reading-notice');
  await answer();
  await press('[data-exercise-action=stop]');
  await press('[data-exercise-action=catalog]');
  await start('skynja-judgment-support');
  await answer();
  console.log('Browser: offline reload retains restrictions in review and downloaded packets; real note export/import and Nynorsk reading and judgment exercises work offline.');
  assert.deepEqual(browserErrors, []);
} finally {
  await cleanupBrowserProof({
    browser, browserLabel: 'Skynja exercise Chromium', client, profile,
    requestBrowserClose: client === undefined ? undefined : () => client.send('Browser.close'),
    server, serverLabel: 'Skynja exercise server',
  });
}
