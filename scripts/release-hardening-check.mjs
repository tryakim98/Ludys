import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
const errors = [];

function requireCondition(condition, message) {
  if (!condition) errors.push(message);
}

async function artifactChecksum(path) {
  const bytes = await readFile(path);
  const canonicalBytes = new Set([".json", ".ts"]).has(extname(path))
    ? Buffer.from(bytes.toString("utf8").replace(/\r\n?/g, "\n"), "utf8")
    : bytes;
  return createHash("sha256").update(canonicalBytes).digest("hex");
}

requireCondition(Object.keys(packageJson.dependencies ?? {}).length === 0, "runtime dependencies must remain empty");
requireCondition(Object.keys(packageJson.optionalDependencies ?? {}).length === 0, "optional runtime dependencies must remain empty");
requireCondition(packageJson.version === lock.version && packageJson.version === lock.packages[""].version, "package and lock versions must match");
for (const [name, version] of Object.entries(packageJson.devDependencies ?? {})) {
  requireCondition(/^\d+\.\d+\.\d+$/.test(version), `${name} must be exactly pinned`);
  const entry = lock.packages[`node_modules/${name}`];
  requireCondition(entry?.version === version, `${name} lock version mismatch`);
  requireCondition(typeof entry?.integrity === "string" && entry.integrity.startsWith("sha512-"), `${name} requires lock integrity`);
}

async function collect(directory, extensions) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path, extensions));
    else if (extensions.some((extension) => entry.name.endsWith(extension))) files.push(path);
  }
  return files;
}

const runtimeFiles = [
  ...await collect(join(root, "src"), [".ts"]),
  ...await collect(join(root, "web"), [".js", ".json", ".html"]),
];
const forbiddenPatterns = [
  [/\beval\s*\(/, "eval"],
  [/\bnew\s+Function\b/, "new Function"],
  [/\bimport\s*\(/, "dynamic import"],
  [/https?:\/\//, "external runtime URL"],
  [/google-analytics|googletagmanager|segment\.com|mixpanel|posthog|sentry|logrocket/i, "tracker or analytics SDK"],
  [/speechSynthesis|SpeechRecognition|webkitSpeechRecognition/, "dynamic speech runtime"],
  [/[ÃÂâ]/, "mojibake encoding marker"],
];
for (const file of runtimeFiles) {
  const text = await readFile(file, "utf8");
  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(text)) errors.push(`${relative(root, file)} contains forbidden ${label}`);
  }
}

const html = await readFile(join(root, "web", "index.html"), "utf8");
const server = await readFile(join(root, "scripts", "serve-proof.mjs"), "utf8");
const serviceWorker = await readFile(join(root, "web", "service-worker.js"), "utf8");
for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "connect-src 'self'"]) {
  requireCondition(html.includes(directive), `HTML CSP missing ${directive}`);
  requireCondition(server.includes(directive), `proof-server CSP missing ${directive}`);
}
for (const header of ["permissions-policy", "x-content-type-options", "referrer-policy"]) {
  requireCondition(server.includes(header), `proof server missing ${header}`);
}
requireCondition(server.includes("camera=(), microphone=(), geolocation=()"), "sensitive browser capabilities must be blocked");
requireCondition(serviceWorker.includes("url.origin !== self.location.origin"), "service worker must ignore cross-origin requests");
requireCondition(serviceWorker.includes("LUDYS_CLEAR_SHELL_CACHE"), "service worker must support explicit shell-cache clear");
requireCondition(!serviceWorker.includes("sync" + "manager"), "background sync must remain absent");

const releaseDirectory = join(root, "release", "wp13-10");
const componentManifest = JSON.parse(await readFile(join(releaseDirectory, "component-manifest.json"), "utf8"));
const sbom = JSON.parse(await readFile(join(releaseDirectory, "sbom.cdx.json"), "utf8"));
const licenses = JSON.parse(await readFile(join(releaseDirectory, "license-inventory.json"), "utf8"));
const reproducible = JSON.parse(await readFile(join(releaseDirectory, "reproducible-build.json"), "utf8"));
const provenance = JSON.parse(await readFile(join(releaseDirectory, "release-provenance.json"), "utf8"));
requireCondition(componentManifest.appVersion === packageJson.version, "component manifest appVersion mismatch");
requireCondition(componentManifest.externalReceipts === 0, "external receipts must remain zero");
requireCondition(componentManifest.b8 === "NOT_DECISION_READY", "B8 must remain not decision-ready");
requireCondition(componentManifest.studentBeta === "NOT_AUTHORIZED", "student beta must remain unauthorized");
requireCondition(componentManifest.runtimeAi === false && componentManifest.providerActivation === false, "AI/provider boundary opened");
requireCondition(sbom.bomFormat === "CycloneDX" && sbom.specVersion === "1.5", "SBOM must be CycloneDX 1.5");
requireCondition(sbom.components.length === Object.keys(lock.packages).filter((path) => path.startsWith("node_modules/")).length, "SBOM component count mismatch");
requireCondition(licenses.runtimeDependencies.length === 0 && licenses.unresolvedLicenses.length === 0, "license inventory has runtime or unresolved entries");
requireCondition(reproducible.status === "VERIFIED_IDENTICAL", "reproducible build evidence is not verified");
requireCondition(/^[a-f0-9]{64}$/.test(reproducible.distSha256), "reproducible dist digest is invalid");
requireCondition(provenance.artifactChecksumPolicy === "SHA256_CANONICAL_LF_UTF8_TEXT_RAW_BINARY", "cross-platform artifact checksum policy is missing");
requireCondition(
  reproducible.lockfileSha256 === await artifactChecksum(join(root, "package-lock.json")),
  "reproducible build lockfile digest must use canonical LF text bytes",
);

const checksumText = await readFile(join(releaseDirectory, "artifact-checksums.sha256"), "utf8");
for (const line of checksumText.trim().split("\n")) {
  const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
  if (match === null) {
    errors.push(`invalid checksum line: ${line}`);
    continue;
  }
  const actual = await artifactChecksum(join(root, match[2]));
  if (actual !== match[1]) errors.push(`checksum mismatch: ${match[2]}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
assert.equal(errors.length, 0);
console.log(`WP13.10 security, CSP, no-tracker, SBOM, license and checksum gate passed (${checksumText.trim().split("\n").length} artifacts).`);
