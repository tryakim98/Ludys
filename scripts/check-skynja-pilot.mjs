import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const output = join(repo, "artifacts", "skynja-pilot-technical");
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run with npm run check:pilot:technical");
const browser = resolveBrowserExecutable();
const git = (...args) => spawnSync("git", args, { cwd: repo, encoding: "utf8" }).stdout?.trim() ?? "";
const sourceCommit = git("rev-parse", "HEAD");
const worktreeDirty = git("status", "--porcelain").length > 0;
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const report = {
  schemaVersion: "skynja-pilot-technical.v1",
  scope: "LOCAL_APP_AND_EXERCISE_REVIEW",
  sourceCommit,
  worktreeDirty,
  startedAt: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  browser,
  browserVersion: spawnSync(browser, ["--version"], { encoding: "utf8", timeout: 10000 }).stdout?.trim() || "NOT_REPORTED",
  servedRoot: "deploy",
  fullReleaseVerification: "SEPARATE_GATE_REQUIRED",
  humanReview: "NOT_PROVEN_BY_TECHNICAL_TESTS",
  pilotAuthorization: "NOT_GRANTED",
  steps: [],
  status: "RUNNING",
};
function save() { writeFileSync(join(output, "result.json"), JSON.stringify(report, null, 2) + "\n"); }
save();

// Additive gate: the pinned Windows release/proof chain is retained without exceptions.
const steps = ["canon:check", "test:canon", "lint", "architecture", "secret:scan", "build:installable", "pilot:review:check", "test:compiled", "test:pwa-contract", "test:app-browser", "test:exercises-browser", "test:authoring-browser", "test:pwa-browser", "test:visual-browser"];
for (const step of steps) {
  const started = Date.now();
  console.log(`Skynja technical check: ${step}`);
  const result = spawnSync(process.execPath, [npm, "run", step], {
    cwd: repo, encoding: "utf8", timeout: 240000, maxBuffer: 12 * 1024 * 1024,
    env: { ...process.env, LUDYS_BROWSER_PATH: browser, LUDYS_PROOF_ROOT: "deploy" },
  });
  const logName = `${String(report.steps.length + 1).padStart(2, "0")}-${step.replaceAll(":", "-")}.log`;
  writeFileSync(join(output, logName), (result.stdout ?? "") + (result.stderr ?? "") + (result.error ? `\n${result.error.message}\n` : ""));
  report.steps.push({ command: `npm run ${step}`, exitCode: result.status, signal: result.signal, durationMs: Date.now() - started, log: logName });
  if (result.status !== 0 || result.error) {
    report.status = "FAILED";
    report.finishedAt = new Date().toISOString();
    save();
    console.error(`FAILED: ${step}; ${join(output, logName)}`);
    console.error(((result.stdout ?? "") + (result.stderr ?? "")).slice(-6000));
    process.exit(1);
  }
  save();
}
report.contentSetSha256 = JSON.parse(readFileSync(join(repo, "release/skynja-pilot-review/content-snapshot.json"), "utf8")).contentSetSha256;
report.status = "TECHNICAL_CHECKS_PASSED";
report.finishedAt = new Date().toISOString();
save();
console.log(`Skynja local app checks passed. Evidence: ${output}. Human review and full release verification remain separate.`);
