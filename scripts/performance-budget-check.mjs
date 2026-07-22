import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const policy = JSON.parse(await readFile(join(root, "release", "wp13-10", "performance-budgets.json"), "utf8"));
const budgets = policy.budgets;

async function collect(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path, extension));
    else if (entry.name.endsWith(extension)) files.push(path);
  }
  return files;
}

async function total(paths) {
  let bytes = 0;
  for (const path of paths) bytes += (await stat(path)).size;
  return bytes;
}

const measurements = {
  compiledRuntimeJavaScriptBytes: await total(await collect(join(root, "dist", "src"), ".js")),
  browserEntryJavaScriptBytes: (await stat(join(root, "dist", "src", "ui", "browser", "app.js"))).size,
  cssBytes: (await stat(join(root, "web", "styles.css"))).size,
  htmlBytes: (await stat(join(root, "web", "index.html"))).size,
  staticIllustrationBytes: await total(await collect(join(root, "web", "icons"), ".svg")),
  technicalAudioBytes: await total(await collect(join(root, "web", "audio", "technical"), ".wav")),
};
for (const [name, value] of Object.entries(measurements)) {
  assert.ok(value <= budgets[name], `${name}: ${value} exceeds ${budgets[name]}`);
}

const releaseModule = await import(pathToFileURL(join(root, "dist", "src", "core", "release-hardening.js")));
const stateModule = await import(pathToFileURL(join(root, "dist", "src", "content", "prototype", "wp13-10-release-state.js")));
const started = performance.now();
for (let index = 0; index < 1000; index += 1) {
  const result = releaseModule.rollbackComponent(stateModule.wp13_10LocalReleaseState, "AUDIO", "TEXT_AND_SILENCE", "2026-07-22T12:00:00.000Z");
  assert.equal(result.accepted, true);
}
const rollbackResponseMs = (performance.now() - started) / 1000;
assert.ok(rollbackResponseMs <= budgets.rollbackResponseMs, `rollback response ${rollbackResponseMs}ms exceeds budget`);
console.log(`WP13.10 performance budgets passed: ${JSON.stringify({ ...measurements, rollbackResponseMs })}`);
