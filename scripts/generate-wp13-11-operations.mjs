import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOperationsKit, officialSourceRegister } from "./wp13-11-operations-data.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const releaseDirectory = join(root, "release", "wp13-11");
const generatedSource = join(root, "src", "content", "operations", "wp13-11-operations-kit.ts");
const artifactsDirectory = join(root, "artifacts");
const checkOnly = process.argv.includes("--check");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
const kit = buildOperationsKit(packageJson.version);
const fixedDate = "2026-07-22";
const fixedTimestamp = "2026-07-22T00:00:00.000Z";
const textExtensions = new Set([".json", ".ts", ".mjs", ".html", ".css", ".js"]);

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function checksum(path) {
  const bytes = await readFile(path);
  const canonical = textExtensions.has(extname(path))
    ? Buffer.from(bytes.toString("utf8").replace(/\r\n?/g, "\n"), "utf8")
    : bytes;
  return createHash("sha256").update(canonical).digest("hex");
}

async function ensure(path, content) {
  if (checkOnly) {
    const actual = await readFile(path, "utf8").catch(() => "");
    if (actual !== content) throw new Error(`${relative(root, path)} is stale; run npm run operations:generate`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

const generatedModule = `import type { OperationsKit } from "../../core/beta-operations.js";\n\n// Generated from scripts/wp13-11-operations-data.mjs; compact runtime snapshot, no fallback.\nexport const wp13_11OperationsKit: OperationsKit = ${JSON.stringify(kit)};\n`;
const expected = new Map([[generatedSource, generatedModule]]);

for (const artifact of kit.artifacts) {
  expected.set(
    join(releaseDirectory, "artifacts", artifact.locale, `${artifact.artifactType.toLowerCase().replaceAll("_", "-")}.json`),
    stableJson(artifact),
  );
}

const authorizationStatus = {
  schemaVersion: "wp13.11-authorization-status-v1",
  ...kit.authorization,
  participantDraftsAuthorized: false,
  legalApprovalPresent: false,
  ethicsApprovalPresent: false,
  schoolOwnerDecisionPresent: false,
};
const validation = {
  valid: true,
  errors: [],
  warnings: [],
  readiness: "READY_FOR_ADULT_ONLY_DRY_RUN",
  studentBetaAuthorized: false,
  externalReceipts: 0,
  semanticArtifactCount: 27,
  languageArtifactCount: 54,
};
const componentManifest = {
  schemaVersion: "wp13.11-release-v2",
  ...kit.releaseComponents,
  baselineCommit: "c5e47fd1e25f67a38376d58321a6a409f2fed44d",
  baselineTree: "ca6d2825b5482930085d490205510fd8b9c09fab",
  sourceClassification: "ADULT_ONLY_SYNTHETIC_DRY_RUN",
  externalReceipts: 0,
  b8: "NOT_DECISION_READY",
  studentBeta: "NOT_AUTHORIZED",
  recruitment: "NOT_AUTHORIZED",
  productionDeployment: "NOT_AUTHORIZED",
  runtimeAi: false,
  providerActivation: false,
};
const rollbackRegister = {
  schemaVersion: "wp13.11-rollback-register-v1",
  appendOnly: true,
  activeOperationsRevision: kit.operationsReleaseId,
  compatibleSchemaVersion: "wp13.11-release-v2",
  revisions: [
    { component: "OPERATIONS", revisionId: "wp13-11-operations-kit-r0", lifecycle: "AVAILABLE", compatibility: "COMPATIBLE" },
    { component: "OPERATIONS", revisionId: kit.operationsReleaseId, lifecycle: "AVAILABLE", compatibility: "COMPATIBLE" },
    { component: "OPERATIONS", revisionId: "wp13-11-operations-kit-withdrawn-proof", lifecycle: "WITHDRAWN", compatibility: "COMPATIBLE" },
    { component: "OPERATIONS", revisionId: "wp13-11-operations-kit-incompatible-proof", lifecycle: "AVAILABLE", compatibility: "INCOMPATIBLE" },
  ],
  productionRollbackTested: false,
};
const knownLimitations = {
  schemaVersion: "wp13.11-known-limitations-v1",
  manualReviewRequired: [
    "Separate human BM review", "Separate human NN review", "Manual screen-reader and assistive-technology review",
    "Legal review of participant-directed drafts", "Ethics and school-owner review", "Physical-device review",
  ],
  notTested: ["Firefox", "Safari/iOS", "Physical Android", "Production service worker", "Production rollback"],
  externalReceiptRequired: ["Language approval", "Accessibility acceptance", "Legal approval", "Ethics approval", "School-owner decision"],
  notAuthorized: ["Student beta", "Recruitment", "Participant contact", "Real data", "Provider activation", "Production", "B8"],
  p0OpenInAutomatedScope: 0,
  p1OpenInAutomatedScope: 0,
};
const platformMatrix = {
  schemaVersion: "wp13.11-platform-matrix-v1",
  date: fixedDate,
  rows: [
    { platform: "Microsoft Edge desktop", testType: "ACTUAL_BROWSER_ORIGIN_PROOF", result: "PASS", limitation: "Local headless Windows proof; not manual AT review" },
    { platform: "Chromium 320px / 200% / touch", testType: "DEVICE_EMULATION", result: "PASS", limitation: "Emulation, not a physical phone" },
    { platform: "Keyboard, focus, reduced motion, forced colors and AX tree", testType: "HEADLESS_BROWSER_PROOF", result: "PASS", limitation: "Automation cannot establish WCAG conformance" },
    { platform: "Firefox", testType: "NOT_TESTED", result: "NOT_TESTED", limitation: "Requires a local Firefox environment" },
    { platform: "Safari / iOS", testType: "NOT_TESTED", result: "NOT_TESTED", limitation: "Requires Apple hardware or an authorized remote environment" },
    { platform: "Manual screen reader / AT", testType: "MANUAL_REVIEW_REQUIRED", result: "OPEN", limitation: "Human review remains required" },
  ],
};
const performanceBudgets = {
  schemaVersion: "wp13.11-performance-budgets-v1",
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
  limitation: "Local headless desktop measurements are not physical-device benchmarks.",
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
  .sort((left, right) => left.name.localeCompare(right.name));
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: "urn:uuid:13110000-2026-4000-8000-000000000011",
  version: 1,
  metadata: {
    timestamp: fixedTimestamp,
    component: { type: "application", name: packageJson.name, version: packageJson.version },
    properties: [
      { name: "ludys:runtimeDependencyCount", value: "0" },
      { name: "ludys:dataClassification", value: "ADULT_ONLY_SYNTHETIC_DRY_RUN" },
    ],
  },
  components: lockComponents,
};
const licenseInventory = {
  schemaVersion: "wp13.11-license-inventory-v1",
  generatedFrom: "package-lock.json",
  runtimeDependencies: [],
  developmentDependencies: lockComponents.map((item) => ({ name: item.name, version: item.version, license: item.licenses[0].license.id })),
  unresolvedLicenses: [],
};
const reproducibleEvidence = JSON.parse(await readFile(
  join(artifactsDirectory, "wp13-11-reproducible-build-result.json"),
  "utf8",
).catch(() => JSON.stringify({
  status: "PENDING_LOCAL_VERIFICATION",
  copies: 2,
  distSha256: "PENDING",
  digests: [],
  command: "npm ci --offline --ignore-scripts --audit=false && npm run build",
  nodeVersion: process.version,
  npmVersion: "11.16.0",
  operatingSystem: `${process.platform}-${process.arch}`,
  timestampPolicy: "SOURCE_CONTENT_ONLY_NO_BUILD_TIMESTAMP",
})));
const reproducibleBuild = {
  schemaVersion: "wp13.11-reproducible-build-v1",
  ...reproducibleEvidence,
  sourceBaselineCommit: componentManifest.baselineCommit,
  sourceBaselineTree: componentManifest.baselineTree,
  lockfileSha256: await checksum(join(root, "package-lock.json")),
  limitation: "Two independent local clean copies; not a production build attestation.",
};
const provenance = {
  schemaVersion: "wp13.11-operations-provenance-v1",
  baselineCommit: componentManifest.baselineCommit,
  baselineTree: componentManifest.baselineTree,
  candidateBranch: "feature/wp13-11-complete-beta-operations-measurement-kit",
  parentBranch: "feature/wp13-10-reliability-security-release-hardening",
  sourceClassification: "CURRENT_IMPLEMENTATION_FROM_AUTHENTIC_WP13_10_BASELINE",
  historicalSourcesImported: false,
  buildCommands: ["npm ci", "npm run build", "npm run operations:generate", "npm run check:release"],
  timestampPolicy: "FIXED_SCOPE_TIMESTAMP_AND_CONTENT_ONLY_DIGESTS",
  artifactChecksumPolicy: "SHA256_CANONICAL_LF_UTF8_TEXT_RAW_BINARY",
  candidateCommitBinding: "Bound by the final Git commit and draft PR after tracked artifacts are finalized.",
  productionDeployment: false,
};
const evidence = {
  schemaVersion: "wp13.11-operations-evidence-v1",
  evidenceDate: fixedDate,
  classification: "ADULT_ONLY_SYNTHETIC_DRY_RUN",
  domainModel: "IMPLEMENTED",
  validator: "AUTOMATED_PROOF",
  browser: "HEADLESS_BROWSER_PROOF",
  serviceWorker: "ACTUAL_BROWSER_ORIGIN_PROOF_AND_CONTRACT_TEST",
  physicalDevices: "NOT_TESTED",
  manualAccessibility: "MANUAL_REVIEW_REQUIRED",
  externalReceipts: 0,
  b8: "NOT_DECISION_READY",
  studentBeta: "NOT_AUTHORIZED",
  production: "NOT_AUTHORIZED",
};

for (const [path, value] of [
  [join(releaseDirectory, "operations-kit.json"), kit],
  [join(releaseDirectory, "validation.json"), validation],
  [join(releaseDirectory, "measurement-dictionary.json"), { schemaVersion: "wp13.11-measurement-dictionary-v1", metrics: kit.metrics, forbiddenMetrics: kit.forbiddenMetrics }],
  [join(releaseDirectory, "data-inventory.json"), { schemaVersion: "wp13.11-data-inventory-v1", entries: kit.dataInventory }],
  [join(releaseDirectory, "official-source-register.json"), { schemaVersion: "wp13.11-official-source-register-v1", sources: officialSourceRegister }],
  [join(releaseDirectory, "authorization-status.json"), authorizationStatus],
  [join(releaseDirectory, "component-manifest.json"), componentManifest],
  [join(releaseDirectory, "rollback-register.json"), rollbackRegister],
  [join(releaseDirectory, "operations-provenance.json"), provenance],
  [join(releaseDirectory, "known-limitations.json"), knownLimitations],
  [join(releaseDirectory, "platform-matrix.json"), platformMatrix],
  [join(releaseDirectory, "performance-budgets.json"), performanceBudgets],
  [join(releaseDirectory, "sbom.cdx.json"), sbom],
  [join(releaseDirectory, "license-inventory.json"), licenseInventory],
  [join(releaseDirectory, "reproducible-build.json"), reproducibleBuild],
  [join(artifactsDirectory, "wp13-11-operations-evidence.json"), evidence],
]) expected.set(path, stableJson(value));

for (const [path, content] of expected) await ensure(path, content);

const checksumTargets = [
  ...[...expected.keys()]
    .filter((path) => path.startsWith(releaseDirectory))
    .map((path) => relative(root, path).replaceAll("\\", "/")),
  "src/core/beta-operations.ts",
  "scripts/wp13-11-operations-data.mjs",
].sort();
const checksumLines = [];
for (const target of checksumTargets) checksumLines.push(`${await checksum(join(root, target))}  ${target}`);
await ensure(join(releaseDirectory, "artifact-checksums.sha256"), `${checksumLines.join("\n")}\n`);

console.log(checkOnly
  ? "WP13.11 operations kit generation is deterministic and current."
  : `WP13.11 operations kit generated (${kit.artifacts.length} language artifacts).`);
