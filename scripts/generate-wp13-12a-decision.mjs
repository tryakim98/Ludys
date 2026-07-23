import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProviderDecisionPackage } from "./wp13-12a-decision-data.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const releaseDirectory = join(root, "release", "wp13-12a");
const packageDirectory = join(releaseDirectory, "decision-package");
const artifactsDirectory = join(root, "artifacts");
const generatedSource = join(root, "src", "content", "provider-decision", "wp13-12a-decision-package.ts");
const checkOnly = process.argv.includes("--check");
const generatedReproducibleEvidence = join(artifactsDirectory, "wp13-12a-reproducible-build-result.json");
const committedReproducibleEvidence = join(releaseDirectory, "reproducible-build.json");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
const decision = buildProviderDecisionPackage(packageJson.version);
const expected = new Map();
const textExtensions = new Set([".json", ".ts", ".mjs", ".md", ".html", ".css", ".js"]);

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
    if (actual !== content) throw new Error(`${relative(root, path)} is stale; run npm run provider:decision:generate`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

const generatedModule = `import type { ProviderDecisionPackage } from "../../core/provider-decision.js";\n\n// Generated from scripts/wp13-12a-decision-data.mjs; current decision evidence, no runtime provider and no locale fallback.\nexport const wp13_12aProviderDecisionPackage: ProviderDecisionPackage = ${JSON.stringify(decision)};\n`;
expected.set(generatedSource, generatedModule);

const recommended = decision.providerOptions.find((option) => option.optionId === decision.recommendedOptionId);
const packageFiles = {
  "provider-options.json": {
    schemaVersion: "wp13.12a-provider-options-v1",
    recommendedOptionId: decision.recommendedOptionId,
    recommendationIsOwnerDecision: false,
    options: decision.providerOptions,
  },
  "recommended-minimum.json": {
    schemaVersion: "wp13.12a-recommended-minimum-v1",
    optionId: decision.recommendedOptionId,
    option: recommended,
    region: decision.recommendedRegion,
    regionLockNotExecuted: decision.regionLockNotExecuted,
    capabilityOptionId: decision.recommendedCapabilityOptionId,
    capability: decision.recommendedCapability,
    directClientWrite: false,
    providerFreeCore: true,
    runtimeProviderSdkPresent: false,
  },
  "region-analysis.json": {
    schemaVersion: "wp13.12a-region-analysis-v1",
    recommendation: decision.recommendedRegion,
    regionLockNotExecuted: decision.regionLockNotExecuted,
    rows: decision.regionAnalysis,
  },
  "capability-options.json": {
    schemaVersion: "wp13.12a-capability-options-v1",
    recommendation: decision.recommendedCapabilityOptionId,
    options: decision.capabilityOptions,
    specification: decision.recommendedCapability,
    activated: false,
  },
  "dataflow-and-trust-boundaries.json": {
    schemaVersion: "wp13.12a-dataflow-trust-v1",
    dataflow: decision.dataflow,
    trustBoundaries: decision.trustBoundaries,
  },
  "role-model.json": {
    schemaVersion: "wp13.12a-role-model-v1",
    roles: [
      { role: "SYNTHETIC_CHILD_PROJECTION", account: false, stableIdentity: false, authority: false },
      { role: "SYNTHETIC_ADULT_AUTHORITY", account: false, stableIdentity: false, authority: true },
      { role: "TECHNICAL_OPERATOR", participant: false, authority: "OPERATIONS_ONLY" },
    ],
    capabilityBindsExactlyOneRole: true,
    crossRoleProjection: false,
    childOrStudentAccount: false,
  },
  "allowed-and-prohibited-data.json": {
    schemaVersion: "wp13.12a-data-classes-v1",
    classes: decision.dataClasses,
  },
  "data-processing-requirements.json": {
    schemaVersion: "wp13.12a-data-processing-requirements-v1",
    syntheticScopeDoesNotResolveLegalQuestions: true,
    requirements: decision.dataProcessingRequirements,
  },
  "retention-deletion.json": {
    schemaVersion: "wp13.12a-retention-deletion-v1",
    ...decision.retentionDeletion,
  },
  "logging-observability.json": {
    schemaVersion: "wp13.12a-logging-observability-v1",
    ...decision.loggingObservability,
  },
  "iam-and-secrets.json": {
    schemaVersion: "wp13.12a-iam-secrets-v1",
    resourcesCreated: 0,
    secretsCreated: 0,
    ...decision.iamAndSecrets,
  },
  "cost-model.json": {
    schemaVersion: "wp13.12a-cost-model-v1",
    ...decision.costModel,
  },
  "threat-model-delta.json": {
    schemaVersion: "wp13.12a-threat-model-v1",
    transition: "LOCAL_PROVIDER_FREE_TO_POSSIBLE_SYNTHETIC_CLOUD_STAGING",
    threats: decision.threats,
  },
  "migration-exit.json": {
    schemaVersion: "wp13.12a-migration-exit-v1",
    ...decision.migrationExit,
    executed: false,
  },
  "deployment-runbook.json": {
    schemaVersion: "wp13.12a-deployment-runbook-v1",
    scope: "FUTURE_WP13_12B_ONLY_IF_OWNER_APPROVES",
    executedSteps: 0,
    steps: decision.deploymentRunbook,
  },
  "no-go.json": {
    schemaVersion: "wp13.12a-no-go-v1",
    entries: decision.noGo,
  },
  "authorization-status.json": {
    schemaVersion: "wp13.12a-authorization-v1",
    ...decision.authorization,
    firebaseProjectCreated: false,
    vercelProjectCreatedByWorkPackage: false,
    firestoreCreated: false,
    functionsCreated: false,
    serviceAccountsCreated: 0,
    secretsCreated: 0,
  },
  "official-source-register.json": {
    schemaVersion: "wp13.12a-official-sources-v1",
    sources: decision.officialSources,
  },
  "validation.json": {
    valid: true,
    errors: [],
    warnings: [],
    packageStatus: "READY_FOR_OWNER_DECISION",
    ownerDecision: "PENDING_OWNER_ACTION",
    providerActivation: "BLOCKED",
    cloudResources: 0,
    externalReceipts: 0,
    studentBetaAuthorized: false,
  },
  "decision-package-provenance.json": {
    schemaVersion: "wp13.12a-provenance-v1",
    baselineCommit: "166e901bcd8f799bec21c5fcafbdbc2deae5e284",
    baselineTree: "805f9eec758f9e52bb308b8e3977b7a261443a51",
    candidateBranch: "feature/wp13-12a-provider-region-capability-decision-package",
    parentBranch: "feature/wp13-11-complete-beta-operations-measurement-kit",
    sourceClassification: "CURRENT_IMPLEMENTATION_FROM_AUTHENTIC_WP13_11_BASELINE",
    historicalReferenceClassification: "HISTORICAL_REQUIREMENTS_AND_IMPLEMENTATION_REFERENCE",
    historicalFileFound: false,
    historicalCodeImported: false,
    historicalTestsImported: false,
    externalCloudWrites: 0,
    providerAccountsAccessed: false,
    timestampPolicy: "FIXED_CHECK_DATE_AND_CONTENT_ONLY_DIGESTS",
    checksumPolicy: "SHA256_CANONICAL_LF_UTF8_TEXT_RAW_BINARY",
    buildCommands: ["npm run build", "npm run provider:decision:generate", "npm run provider:decision:validate", "npm run check:release"],
    candidateCommitBinding: "Final Git commit and draft PR bind the tracked package after all checks pass.",
  },
  "known-limitations.json": {
    schemaVersion: "wp13.12a-known-limitations-v1",
    manualReviewRequired: [
      "Human BM review", "Human NN review", "Manual screen-reader and assistive-technology review",
      "Product-owner decision", "Legal and DPA review", "School-owner review", "DPIA decision", "Ethical review",
    ],
    notTested: ["Physical two-device flow", "Actual provider project", "Actual regional latency", "Actual IAM", "Actual deletion from provider backups", "Safari/iOS", "Firefox"],
    cannotBeProvedByThisPackage: ["Provider contract acceptance", "Norwegian-school legality", "Hard billing guarantee", "Production readiness"],
    p0OpenInAutomatedScope: 0,
    p1OpenInAutomatedScope: 0,
  },
  "locale-bundles.json": {
    schemaVersion: "wp13.12a-locale-bundles-v1",
    fallback: false,
    bundles: decision.localeBundles,
  },
  "component-manifest.json": {
    schemaVersion: "wp13.12a-release-v3",
    ...decision.releaseComponents,
    baselineCommit: "166e901bcd8f799bec21c5fcafbdbc2deae5e284",
    baselineTree: "805f9eec758f9e52bb308b8e3977b7a261443a51",
    sourceClassification: "SYNTHETIC_PROVIDER_DECISION_ONLY",
    externalReceipts: 0,
    b8: "NOT_DECISION_READY",
    ownerDecision: "PENDING_OWNER_ACTION",
    studentBeta: "NOT_AUTHORIZED",
    recruitment: "NOT_AUTHORIZED",
    parentContactForParticipation: "NOT_AUTHORIZED",
    realParticipantData: "NOT_AUTHORIZED",
    wp13_12b: "BLOCKED",
    productionDeployment: "NOT_AUTHORIZED",
    providerActivation: "BLOCKED",
    cloudResources: 0,
    runtimeAi: false,
  },
  "rollback-register.json": {
    schemaVersion: "wp13.12a-rollback-v1",
    appendOnly: true,
    activeProviderDecisionRevision: decision.providerDecisionReleaseId,
    revisions: [
      { component: "PROVIDER_DECISION", revisionId: "wp13-12a-provider-decision-r0", lifecycle: "AVAILABLE", compatibility: "COMPATIBLE" },
      { component: "PROVIDER_DECISION", revisionId: decision.providerDecisionReleaseId, lifecycle: "AVAILABLE", compatibility: "COMPATIBLE" },
      { component: "PROVIDER_DECISION", revisionId: "wp13-12a-provider-decision-withdrawn-proof", lifecycle: "WITHDRAWN", compatibility: "COMPATIBLE" },
      { component: "PROVIDER_DECISION", revisionId: "wp13-12a-provider-decision-incompatible-proof", lifecycle: "AVAILABLE", compatibility: "INCOMPATIBLE" },
    ],
    rollbackActivatesProvider: false,
    productionRollbackTested: false,
  },
};

const ownerTemplate = `# WP13.12A – blank produkteierbeslutning

> STATUS: PENDING_OWNER_ACTION  
> PROVIDER_ACTIVATION: BLOCKED  
> CLOUD_RESOURCES: 0  
> This template is intentionally blank. Completing it does not itself provision or activate anything.

| Required field | Owner entry |
|---|---|
${decision.ownerDecisionTemplate.requiredFields.map((field) => `| ${field} | |`).join("\n")}

Allowed decision values: \`APPROVE_RECOMMENDED_SYNTHETIC_DEV\`, \`APPROVE_WITH_CONDITIONS\`, \`DEFER\`, \`REJECT\`.

No owner name, signature, confirmation, selection, region, cost limit or date has been fabricated.
`;

for (const [name, value] of Object.entries(packageFiles)) expected.set(join(packageDirectory, name), stableJson(value));
expected.set(join(packageDirectory, "WP13_12A_OWNER_DECISION_TEMPLATE.md"), ownerTemplate);

const lockComponents = Object.entries(lock.packages)
  .filter(([path]) => path.startsWith("node_modules/"))
  .map(([path, item]) => ({
    type: "library",
    name: path.replace("node_modules/", ""),
    version: item.version,
    scope: "excluded",
    licenses: [{ license: { id: item.license } }],
    properties: [{ name: "ludys:runtimeDependency", value: "false" }],
  }))
  .sort((left, right) => left.name.localeCompare(right.name));
const reproducibleEvidence = JSON.parse(await readFile(
  checkOnly ? committedReproducibleEvidence : generatedReproducibleEvidence,
  "utf8",
).catch(() => JSON.stringify({
  status: "PENDING_LOCAL_VERIFICATION", copies: 2, distSha256: "PENDING", digests: [],
  command: "npm ci --offline --ignore-scripts --audit=false && npm run build",
  timestampPolicy: "SOURCE_CONTENT_ONLY_NO_BUILD_TIMESTAMP",
})));

const releaseFiles = {
  "sbom.cdx.json": {
    bomFormat: "CycloneDX", specVersion: "1.5", serialNumber: "urn:uuid:13120000-2026-4000-8000-000000000012",
    version: 1,
    metadata: {
      timestamp: "2026-07-23T00:00:00.000Z",
      component: { type: "application", name: packageJson.name, version: packageJson.version },
      properties: [{ name: "ludys:runtimeDependencyCount", value: "0" }, { name: "ludys:dataClassification", value: "SYNTHETIC_PROVIDER_DECISION_ONLY" }],
    },
    components: lockComponents,
  },
  "license-inventory.json": {
    schemaVersion: "wp13.12a-license-inventory-v1", generatedFrom: "package-lock.json",
    runtimeDependencies: [],
    developmentDependencies: lockComponents.map((item) => ({ name: item.name, version: item.version, license: item.licenses[0].license.id })),
    unresolvedLicenses: [],
  },
  "performance-budgets.json": {
    schemaVersion: "wp13.12a-performance-budgets-v1", evidenceLevel: "HEADLESS_BROWSER_PROOF",
    budgets: {
      compiledRuntimeJavaScriptBytes: 1100000, browserEntryJavaScriptBytes: 38000, cssBytes: 40000,
      htmlBytes: 3000, staticIllustrationBytes: 50000, technicalAudioBytes: 100000,
      initialShellRenderMs: 2000, centralInteractionResponseMs: 150, rollbackResponseMs: 50, cumulativeLayoutShift: 0.05,
    },
    limitation: "Local headless desktop measurements are not physical-device benchmarks.",
  },
  "platform-matrix.json": {
    schemaVersion: "wp13.12a-platform-matrix-v1", date: "2026-07-23",
    rows: [
      { platform: "Microsoft Edge desktop", testType: "ACTUAL_BROWSER_ORIGIN_PROOF", result: "PASS", limitation: "Local headless Windows proof; no provider connection" },
      { platform: "Chromium 320px / 200% / touch", testType: "DEVICE_EMULATION", result: "PASS", limitation: "Emulation, not a physical phone" },
      { platform: "Keyboard, focus, reduced motion, forced colors and AX tree", testType: "HEADLESS_BROWSER_PROOF", result: "PASS", limitation: "Automation cannot establish WCAG conformance" },
      { platform: "External network isolation", testType: "CONTRACT_TEST", result: "PASS", limitation: "Decision surface only" },
      { platform: "Firefox", testType: "NOT_TESTED", result: "NOT_TESTED", limitation: "Requires local Firefox" },
      { platform: "Safari / iOS", testType: "NOT_TESTED", result: "NOT_TESTED", limitation: "Requires Apple hardware" },
      { platform: "Manual screen reader / AT", testType: "MANUAL_REVIEW_REQUIRED", result: "OPEN", limitation: "Human review remains required" },
    ],
  },
  "reproducible-build.json": {
    schemaVersion: "wp13.12a-reproducible-build-v1", ...reproducibleEvidence,
    sourceBaselineCommit: "166e901bcd8f799bec21c5fcafbdbc2deae5e284",
    sourceBaselineTree: "805f9eec758f9e52bb308b8e3977b7a261443a51",
    lockfileSha256: await checksum(join(root, "package-lock.json")),
    limitation: "Two independent local clean copies; not a provider or production attestation.",
  },
};
for (const [name, value] of Object.entries(releaseFiles)) expected.set(join(releaseDirectory, name), stableJson(value));

expected.set(join(artifactsDirectory, "wp13-12a-decision-evidence.json"), stableJson({
  schemaVersion: "wp13.12a-decision-evidence-v1", evidenceDate: "2026-07-23",
  packageStatus: "READY_FOR_OWNER_DECISION", ownerDecision: "PENDING_OWNER_ACTION",
  browser: "HEADLESS_BROWSER_PROOF", accessibility: "HEADLESS_BROWSER_PROOF_AND_MANUAL_REVIEW_REQUIRED",
  cloudResources: 0, providerReceipts: 0, externalReceipts: 0,
  b8: "NOT_DECISION_READY", studentBeta: "NOT_AUTHORIZED", production: "NOT_AUTHORIZED",
}));

for (const [path, content] of expected) await ensure(path, content);

const checksumTargets = [...expected.keys()]
  .filter((path) => path.startsWith(packageDirectory) && !path.endsWith("artifact-checksums.sha256"))
  .map((path) => relative(root, path).replaceAll("\\", "/"))
  .concat([
    "src/core/provider-decision.ts",
    "scripts/wp13-12a-decision-data.mjs",
    "scripts/generate-wp13-12a-decision.mjs",
  ])
  .sort();
const checksumLines = [];
for (const target of checksumTargets) checksumLines.push(`${await checksum(join(root, target))}  ${target}`);
await ensure(join(packageDirectory, "artifact-checksums.sha256"), `${checksumLines.join("\n")}\n`);

console.log(checkOnly
  ? "WP13.12A provider decision package generation is deterministic and current."
  : `WP13.12A provider decision package generated (${decision.providerOptions.length} options, ${decision.officialSources.length} current official sources).`);
