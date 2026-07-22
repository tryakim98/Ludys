import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const releaseDirectory = join(root, "release", "wp13-10");
const artifactsDirectory = join(root, "artifacts");
const checkOnly = process.argv.includes("--check");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
const stableDate = "2026-07-22";
const stableTimestamp = "2026-07-22T00:00:00.000Z";
const textChecksumExtensions = new Set([".json", ".ts"]);

await mkdir(releaseDirectory, { recursive: true });
await mkdir(artifactsDirectory, { recursive: true });

async function readJsonOr(path, fallback) {
  return JSON.parse(await readFile(path, "utf8").catch(() => JSON.stringify(fallback)));
}

async function artifactChecksum(path) {
  const bytes = await readFile(path);
  const canonicalBytes = textChecksumExtensions.has(extname(path))
    ? Buffer.from(bytes.toString("utf8").replace(/\r\n?/g, "\n"), "utf8")
    : bytes;
  return createHash("sha256").update(canonicalBytes).digest("hex");
}

const reproducibleEvidencePath = join(artifactsDirectory, "wp13-10-reproducible-build-result.json");
const reproducibleEvidence = await readJsonOr(reproducibleEvidencePath, {
  status: "PENDING_LOCAL_VERIFICATION",
  copies: 2,
  distSha256: "PENDING",
  digests: [],
  command: "npm ci --offline --ignore-scripts --audit=false && npm run build",
  nodeVersion: process.version,
  npmVersion: "11.16.0",
  operatingSystem: "Windows",
  timestampPolicy: "SOURCE_CONTENT_ONLY_NO_BUILD_TIMESTAMP",
});

const componentManifest = {
  schemaVersion: "wp13.10-release-v1",
  appVersion: packageJson.version,
  contentReleaseId: "wp13-8-authentic-draft-corpus-r1",
  knowledgeReleaseId: "release-knowledge-audio-prototype-001",
  audioReleaseId: "wp13-9-audio-specifications-r1",
  baselineCommit: "758f9c8f585ba5003c40e9af805863cee86f9407",
  baselineTree: "a6b21e7953efc2489eee64d2d1d7d10dd50ba233",
  sourceClassification: "SYNTHETIC_ONLY",
  externalReceipts: 0,
  b8: "NOT_DECISION_READY",
  studentBeta: "NOT_AUTHORIZED",
  productionDeployment: "NOT_AUTHORIZED",
  runtimeAi: false,
  providerActivation: false,
};

const lockComponents = Object.entries(lock.packages)
  .filter(([path]) => path.startsWith("node_modules/"))
  .map(([path, item]) => ({
    type: "library",
    name: path.replace("node_modules/", ""),
    version: item.version,
    scope: "excluded",
    licenses: [{ license: { id: item.license } }],
    hashes: item.integrity === undefined ? [] : [{ alg: "SHA-512", content: item.integrity.replace(/^sha512-/, "") }],
    properties: [{ name: "ludys:runtimeDependency", value: "false" }],
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: "urn:uuid:13100000-2026-4000-8000-000000000010",
  version: 1,
  metadata: {
    timestamp: stableTimestamp,
    component: { type: "application", name: packageJson.name, version: packageJson.version },
    properties: [
      { name: "ludys:runtimeDependencyCount", value: "0" },
      { name: "ludys:dataClassification", value: "SYNTHETIC_ONLY" },
    ],
  },
  components: lockComponents,
};

const licenseInventory = {
  schemaVersion: "wp13.10-license-inventory-v1",
  generatedFrom: "package-lock.json",
  runtimeDependencies: [],
  developmentDependencies: lockComponents.map((item) => ({ name: item.name, version: item.version, license: item.licenses[0].license.id })),
  unresolvedLicenses: [],
};

const performanceBudgets = {
  schemaVersion: "wp13.10-performance-budgets-v1",
  evidenceLevel: "HEADLESS_BROWSER_PROOF",
  budgets: {
    compiledRuntimeJavaScriptBytes: 600000,
    browserEntryJavaScriptBytes: 30000,
    cssBytes: 30000,
    htmlBytes: 3000,
    staticIllustrationBytes: 50000,
    technicalAudioBytes: 100000,
    initialShellRenderMs: 2000,
    centralInteractionResponseMs: 150,
    rollbackResponseMs: 50,
    cumulativeLayoutShift: 0.05,
  },
  limitation: "Timing is measured in local headless desktop Edge and is not a physical mobile benchmark.",
};

const platformMatrix = {
  schemaVersion: "wp13.10-platform-matrix-v1",
  date: stableDate,
  rows: [
    { platform: "Microsoft Edge desktop", testType: "HEADLESS_BROWSER_PROOF", actualEnvironment: "Locally installed Edge through repository resolver", result: "PASS", limitation: "Headless Windows proof; not a manual AT review" },
    { platform: "Chromium responsive 320px / 200% / touch", testType: "DEVICE_EMULATION", actualEnvironment: "Edge CDP emulation", result: "PASS", limitation: "Emulation, not a physical phone" },
    { platform: "Forced colors and reduced motion", testType: "HEADLESS_BROWSER_PROOF", actualEnvironment: "Edge CDP media emulation", result: "PASS", limitation: "Automated rendering contract only" },
    { platform: "Firefox desktop", testType: "NOT_TESTED", actualEnvironment: "Firefox unavailable locally", result: "NOT_TESTED", limitation: "Requires a real Firefox installation" },
    { platform: "Safari / iOS", testType: "NOT_TESTED", actualEnvironment: "Unavailable on Windows", result: "NOT_TESTED", limitation: "Requires physical or remote Apple environment" },
    { platform: "Android Chrome", testType: "DEVICE_EMULATION", actualEnvironment: "Touch and viewport emulation only", result: "EMULATED_PASS", limitation: "Not a physical Android test" },
    { platform: "Manual screen reader / AT", testType: "MANUAL_REVIEW_REQUIRED", actualEnvironment: "Not performed", result: "OPEN", limitation: "Automation cannot replace human review" },
  ],
};

const knownLimitations = {
  schemaVersion: "wp13.10-known-limitations-v1",
  manualReviewRequired: [
    "Norwegian reading-specialist review",
    "Separate BM and NN review",
    "Construct, pronunciation and naturalness review",
    "Rights and voice-consent review",
    "Manual accessibility and physical-device review",
  ],
  notTested: ["Firefox locally", "Safari/iOS", "Physical Android", "Production service worker", "Production rollback"],
  notAuthorized: ["Real student data", "Provider activation", "Production deployment", "Runtime AI", "B8 decision", "Student beta"],
  p0Open: 0,
  p1Open: 0,
};

const provenance = {
  schemaVersion: "wp13.10-release-provenance-v1",
  baselineCommit: componentManifest.baselineCommit,
  baselineTree: componentManifest.baselineTree,
  candidateBranch: "feature/wp13-10-reliability-security-release-hardening",
  sourceLockfile: "package-lock.json",
  buildCommands: ["npm ci", "npm run build", "npm run check:release"],
  nodeRequirement: packageJson.engines.node,
  localNodeVersion: reproducibleEvidence.nodeVersion,
  localNpmVersion: reproducibleEvidence.npmVersion,
  operatingSystem: reproducibleEvidence.operatingSystem,
  timestampPolicy: "Tracked metadata uses a fixed scope date; dist digest hashes paths and bytes only.",
  artifactChecksumPolicy: "SHA256_CANONICAL_LF_UTF8_TEXT_RAW_BINARY",
  candidateCommitBinding: "Recorded by Git commit and draft PR after all tracked release files are finalized; a tracked file cannot self-contain its own final tree hash.",
  productionDeployment: false,
};

const reproducibleBuild = {
  schemaVersion: "wp13.10-reproducible-build-v1",
  status: reproducibleEvidence.status,
  copies: reproducibleEvidence.copies,
  command: reproducibleEvidence.command,
  distSha256: reproducibleEvidence.distSha256,
  digests: reproducibleEvidence.digests,
  sourceBaselineCommit: componentManifest.baselineCommit,
  sourceBaselineTree: componentManifest.baselineTree,
  lockfileSha256: createHash("sha256").update(await readFile(join(root, "package-lock.json"))).digest("hex"),
  nodeVersion: reproducibleEvidence.nodeVersion,
  npmVersion: reproducibleEvidence.npmVersion,
  operatingSystem: reproducibleEvidence.operatingSystem,
  timestampPolicy: reproducibleEvidence.timestampPolicy,
  limitation: "Reproduced in two independent local clean copies; CI repeats the digest check but is not a production build attestation.",
};

const releaseEvidence = {
  schemaVersion: "wp13.10-release-evidence-v1",
  evidenceDate: stableDate,
  classification: "SYNTHETIC_ONLY",
  reliability: "IMPLEMENTED",
  security: "AUTOMATED_PROOF",
  browser: "HEADLESS_BROWSER_PROOF",
  serviceWorker: "ACTUAL_BROWSER_ORIGIN_PROOF_AND_DETERMINISTIC_CONTRACT_TEST",
  physicalDevices: "NOT_TESTED",
  manualAccessibility: "MANUAL_REVIEW_REQUIRED",
  reproducibleBuild: reproducibleEvidence.status,
  externalReceipts: 0,
  b8: "NOT_DECISION_READY",
  studentBeta: "NOT_AUTHORIZED",
};

const jsonFiles = new Map([
  [join(releaseDirectory, "component-manifest.json"), componentManifest],
  [join(releaseDirectory, "sbom.cdx.json"), sbom],
  [join(releaseDirectory, "license-inventory.json"), licenseInventory],
  [join(releaseDirectory, "release-provenance.json"), provenance],
  [join(releaseDirectory, "performance-budgets.json"), performanceBudgets],
  [join(releaseDirectory, "platform-matrix.json"), platformMatrix],
  [join(releaseDirectory, "reproducible-build.json"), reproducibleBuild],
  [join(releaseDirectory, "known-limitations.json"), knownLimitations],
  [join(artifactsDirectory, "wp13-10-release-evidence.json"), releaseEvidence],
]);

const expected = new Map([...jsonFiles].map(([path, value]) => [path, `${JSON.stringify(value, null, 2)}\n`]));

async function ensure(path, content) {
  if (checkOnly) {
    const actual = await readFile(path, "utf8").catch(() => "");
    if (actual !== content) throw new Error(`${relative(root, path)} is stale; run release artifact generator`);
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
}

for (const [path, content] of expected) await ensure(path, content);

const checksumTargets = [
  ...[...expected.keys()].map((path) => relative(root, path).replaceAll("\\", "/")),
  "src/content/corpus/wp13-8-draft-corpus.ts",
  "src/content/authoring/wp13-9-authoring-packages.ts",
  "web/audio/technical/wp13-9-technical-tone-a-48k-24bit-mono.wav",
  "web/audio/technical/wp13-9-technical-tone-b-48k-16bit-mono.wav",
  "web/corpus-lifecycle-policy.json",
  "web/authoring-lifecycle-policy.json",
].sort();
const checksumLines = [];
for (const path of checksumTargets) {
  const digest = await artifactChecksum(join(root, path));
  checksumLines.push(`${digest}  ${path}`);
}
await ensure(join(releaseDirectory, "artifact-checksums.sha256"), `${checksumLines.join("\n")}\n`);

console.log(checkOnly ? "WP13.10 release metadata is current." : "WP13.10 release metadata generated.");
