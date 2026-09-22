import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  derivePr3ProofFamiliesFromValidatedReceipts,
  validateExternalActivationState,
  validateExternalResourceInventory,
  validateOwnerDecisionForWp13_12b,
  validateReceipt,
  validateStagingRepositoryContract,
} from "../dist/src/core/staging-validation.js";
import {
  externalActivationChecksumTargets,
} from "./wp13-12b-external-activation-checksums.mjs";
import {
  RECEIPT_ARTIFACT_VERIFICATION_MODE,
  verifyExternalResourceInventoryIntegrity,
  verifyReceiptRepositoryIntegrity,
} from "./wp13-12b-receipt-integrity.mjs";
import {
  createPinnedGitExecFile,
} from "./wp13-12b-pinned-git-toolchain.mjs";
import {
  assertProviderRuntimeSecuritySourceContracts,
  providerRuntimeSecuritySourcePaths,
} from "./wp13-12b-provider-package-contract.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const release = join(repo, "release", "wp13-12b");
const errors = [];
const warnings = [];

async function json(path) {
  return JSON.parse(await readFile(join(repo, path), "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else files.push(path);
  }
  return files;
}

const ownerDecisionPath = "release/wp13-12a/decision-package/owner-decision.json";
const ownerDecisionBytes = await readFile(join(repo, ownerDecisionPath));
const ownerDecision = JSON.parse(ownerDecisionBytes);
const authorization = await json("release/wp13-12a/decision-package/authorization-status.json");
const sourceChecksumBytes = createPinnedGitExecFile()("git", [
  "-c",
  `safe.directory=${repo.replaceAll("\\", "/")}`,
  "show",
  "929674d8a159ebd9ac6026c066f5dd044ebcea62:release/wp13-12a/decision-package/artifact-checksums.sha256",
], { cwd: repo });
const checksumManifest = await readFile(
  join(repo, "release/wp13-12a/decision-package/artifact-checksums.sha256"),
  "utf8",
);
const manifestDecisionChecksum = checksumManifest
  .split(/\r?\n/u)
  .find((line) => line.endsWith(`  ${ownerDecisionPath}`))
  ?.split(/\s+/u)[0] ?? "";

errors.push(...validateOwnerDecisionForWp13_12b({
  ownerDecision,
  authorization,
  actualSourcePackageChecksum: sha256(sourceChecksumBytes),
  actualDecisionRecordChecksum: sha256(ownerDecisionBytes),
  checksumManifestDecisionRecordChecksum: manifestDecisionChecksum,
}));

const contract = await json("release/wp13-12b/staging-activation/repository-contract.json");
errors.push(...validateStagingRepositoryContract(contract));
const externalActivationState = await json(
  "release/wp13-12b/external-activation/external-activation-state.json",
);
const externalResourceInventory = await json(
  "release/wp13-12b/external-activation/resource-inventory.json",
);
errors.push(...validateExternalResourceInventory(externalResourceInventory));
if (
  externalActivationState.cloudState?.inventoryStatus
  !== externalResourceInventory.inventoryStatus
  || externalActivationState.cloudState?.resourceCount
  !== externalResourceInventory.resourceCount
  || externalActivationState.cloudState?.zeroResourcesAsserted
  !== externalResourceInventory.zeroResourcesAsserted
) errors.push("external activation state and resource inventory disagree");

const requiredFiles = [
  "docs/WP13_12B_SYNTHETIC_STAGING_REPOSITORY_AND_ACTIVATION_HANDOFF.md",
  "release/wp13-12b/validation.json",
  "release/wp13-12b/authorization-status.json",
  "release/wp13-12b/external-activation/owner-authorization.json",
  "release/wp13-12b/external-activation/cloud-field-approval.json",
  "release/wp13-12b/external-activation/external-activation-state.json",
  "release/wp13-12b/external-activation/external-activation-state.schema.json",
  "release/wp13-12b/external-activation/resource-inventory.json",
  "release/wp13-12b/external-activation/resource-inventory.schema.json",
  "release/wp13-12b/external-activation/external-activation-provenance.json",
  "release/wp13-12b/external-activation/artifact-checksums.sha256",
  ...externalActivationChecksumTargets,
  "release/wp13-12b/provider-audit.json",
  "release/wp13-12b/provider-sbom.cdx.json",
  "release/wp13-12b/provider-license-inventory.json",
  "release/wp13-12b/reproducible-build.json",
  "release/wp13-12b/known-limitations.json",
  "release/wp13-12b/artifact-checksums.sha256",
  "release/wp13-12b/staging-provenance.json",
  "release/wp13-12b/activation-handoff/operator-tasks.json",
  "release/wp13-12b/activation-handoff/receipt-contracts.json",
  "release/wp13-12b/activation-handoff/emulator-import-contract.json",
  "release/wp13-12b/staging-activation/cloud-preflight.json",
  "release/wp13-12b/activation-handoff/physical-two-device-proof-template.json",
  "release/wp13-12b/activation-handoff/rollback-plan.json",
  "release/wp13-12b/activation-handoff/destruction-plan.json",
  "release/wp13-12b/activation-handoff/iam-and-secrets-plan.json",
  "provider/firebase/firebase.json",
  "provider/firebase/.firebaserc.example",
  "provider/firebase/firestore.rules",
  "provider/firebase/firestore.indexes.json",
  "provider/firebase/staging.env.example",
  "provider/firebase/functions/index.mjs",
  "provider/firebase/functions/functions.yaml",
  "provider/firebase/functions/package.json",
  "provider/firebase/functions/package-lock.json",
  "provider/firebase/functions/src/authoritative-handler.ts",
  "provider/firebase/tools/operator-gate-contract.mjs",
  "provider/firebase/tools/seed-synthetic-fixtures.mjs",
  "provider/firebase/tools/set-staging-control.mjs",
  "scripts/validate-wp13-12b-receipt.mjs",
  "scripts/validate-wp13-12b-external-activation.mjs",
  "scripts/wp13-12b-receipt-integrity.mjs",
  "scripts/run-wp13-12b-emulator-proof.mjs",
  "artifacts/wp13-12b-reproducible-build-result.json",
  "web/staging-preview.html",
  "web/staging-runtime-config.json",
];
const allFiles = new Set((await collect(repo)).map((path) => relative(repo, path).replaceAll("\\", "/")));
for (const required of requiredFiles) {
  if (!allFiles.has(required)) errors.push(`missing required file: ${required}`);
}

const destructionLifecyclePlan = await json(
  "release/wp13-12b/activation-handoff/destruction-plan.json",
);
const syntheticDataDeletionEvidencePath =
  "release/wp13-12b/receipts/actual/"
  + "synthetic-data-deletion-evidence.json";
const syntheticDataDeletionEvidenceMarker =
  `--synthetic-data-deletion-evidence ${syntheticDataDeletionEvidencePath}`;
const syntheticDataDeletionAuthorization =
  "AUTHORIZE_WP13_12B_SYNTHETIC_DATA_DELETION_EXECUTION;"
  + "project=ludys-12b-stg-20260725;expiry=2027-01-25;"
  + "scope=bounded-synthetic-session-delete";
const deactivationExecutionPrefix =
  "npm run provider:external:deactivation-plan -- "
  + "--control-epoch <DEACTIVATED_CONTROL_EPOCH> ";
const expectedDeactivationEvidenceSequence =
  deactivationExecutionPrefix
  + syntheticDataDeletionEvidenceMarker
  + " --execute ";
const orderedDeactivationCommands = (
  Array.isArray(destructionLifecyclePlan.orderedCommands)
    ? destructionLifecyclePlan.orderedCommands
    : []
).filter((command) => (
  typeof command === "string"
  && command.startsWith(deactivationExecutionPrefix)
));
if (
  orderedDeactivationCommands.length !== 1
  || !orderedDeactivationCommands[0].startsWith(
    expectedDeactivationEvidenceSequence,
  )
  || orderedDeactivationCommands[0].split(
    syntheticDataDeletionEvidenceMarker,
  ).length !== 2
) {
  errors.push(
    "destruction plan deactivation execution must require the exact "
    + "synthetic-data-deletion evidence marker",
  );
}
const destructionOrderedCommands = Array.isArray(
  destructionLifecyclePlan.orderedCommands,
)
  ? destructionLifecyclePlan.orderedCommands
  : [];
const expectedDestructionCommandMarkers = [
  [
    "provider/firebase/tools/set-staging-control.mjs",
    "--enabled false",
    "--reason EXPIRY_DESTRUCTION",
  ],
  [
    "scripts/provider-external-deploy-identity-control.mjs",
    "--action plan",
  ],
  [
    "scripts/provider-external-deploy-identity-control.mjs",
    "--action provision",
  ],
  [
    "scripts/provider-external-deploy-identity-control.mjs",
    "--action verify",
  ],
  [
    "scripts/provider-external-function-deploy.mjs",
    "--action configure-preview-origin",
    "--preview-origin <EXACT_RECEIPT_BOUND_ACTIVE_PREVIEW_ORIGIN>",
  ],
  [
    "scripts/provider-external-function-deploy.mjs",
    "--action deploy-disabled",
  ],
  [
    "scripts/wp13-12b-external-resource-operator.mjs",
    "--action delete-synthetic-data",
    "--window-expires-at <UTC-ISO-WITHIN-30-MINUTES-AND-NO-LATER-THAN-2027-01-26T00:00:00.000Z>",
    syntheticDataDeletionAuthorization,
  ],
  [
    "scripts/wp13-12b-external-resource-operator.mjs",
    "--action synthetic-data-deletion-evidence-plan",
  ],
  [
    "scripts/wp13-12b-external-resource-operator.mjs",
    "--action record-synthetic-data-deletion-confirmation",
    "<EXACT_humanConfirmationText_FROM_SYNTHETIC_EVIDENCE>",
  ],
  [
    "scripts/provider-external-wif-control.mjs",
    "--action disable-workload-identity-provider",
  ],
  [
    "scripts/provider-external-wif-control.mjs",
    "--action disable-workload-identity-pool",
  ],
  [
    "scripts/provider-external-wif-control.mjs",
    "--action verify-disabled",
  ],
  [
    deactivationExecutionPrefix,
    syntheticDataDeletionEvidenceMarker,
  ],
  [
    "--action vercel-destruction-plan",
    "--confirm-vercel-team-id team_1Gnn3VSNrP3mbseXx6a92a4J",
    "--confirm-vercel-project-id prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
  ],
  [
    "scripts/wp13-12b-external-resource-operator.mjs",
    "--action record-preview-destruction-confirmation",
    "<EXACT_humanConfirmationText_FROM_PREVIEW_EVIDENCE>",
  ],
  [
    "provider:external:inventory",
    "<POST_VERCEL_INVENTORY_PATH>",
  ],
  [
    "provider:external:destruction-plan",
    "<POST_VERCEL_INVENTORY_DIGEST>",
  ],
  [
    "provider:external:inventory",
    "<FINAL_ZERO_RESOURCE_INVENTORY_PATH>",
  ],
];
if (
  destructionLifecyclePlan.schemaVersion
    !== "wp13.12b-staging-destruction-v3"
  || destructionLifecyclePlan.executionContract
    !== "release/wp13-12b/external-activation/"
      + "expiry-destruction-execution-contract.json"
  || destructionLifecyclePlan.syntheticDeletionWindow
    ?.separateExactAuthorizationRequired !== true
  || destructionLifecyclePlan.syntheticDeletionWindow?.minimumMinutes !== 5
  || destructionLifecyclePlan.syntheticDeletionWindow?.maximumMinutes !== 30
  || destructionLifecyclePlan.syntheticDeletionWindow?.ordinaryGraceEndsAt
    !== "2027-01-26T00:00:00.000Z"
  || destructionLifecyclePlan.syntheticDeletionWindow
    ?.broadDeployOrRedeployAllowed !== false
  || destructionLifecyclePlan.syntheticDeletionWindow
    ?.executionAfterOrdinaryGrace
    !== "SEPARATE_EXCEPTIONAL_RECOVERY_AUTHORIZATION_REQUIRED"
  || destructionOrderedCommands.length
    !== expectedDestructionCommandMarkers.length
  || !expectedDestructionCommandMarkers.every((markers, index) => (
    typeof destructionOrderedCommands[index] === "string"
    && markers.every((marker) => (
      destructionOrderedCommands[index].includes(marker)
    ))
  ))
  || destructionOrderedCommands.some((command) => (
    typeof command === "string"
    && command.includes("Explicitly delete all synthetic payloads")
  ))
) {
  errors.push(
    "destruction plan must use the exact v3 18-command control, safe backend, "
    + "bounded deletion, immutable evidence/confirmation, WIF, deactivation, "
    + "Vercel confirmation, Google destruction and final-zero sequence",
  );
}
if (
  typeof destructionLifecyclePlan.expiryDeactivationPlanCommand !== "string"
  || !destructionLifecyclePlan.expiryDeactivationPlanCommand.startsWith(
    expectedDeactivationEvidenceSequence,
  )
  || destructionLifecyclePlan.expiryDeactivationPlanCommand.split(
    syntheticDataDeletionEvidenceMarker,
  ).length !== 2
) {
  errors.push(
    "expiry deactivation command must require the exact "
    + "synthetic-data-deletion evidence marker",
  );
}

const rootPackage = await json("package.json");
if (rootPackage.dependencies !== undefined && Object.keys(rootPackage.dependencies).length > 0) {
  errors.push("root runtimeDependencies must remain zero");
}
const providerPackage = await json("provider/firebase/functions/package.json");
if (
  providerPackage.dependencies?.["@google-cloud/functions-framework"] !== "5.0.5"
  || Object.keys(providerPackage.dependencies ?? {}).length !== 1
) errors.push("provider dependency pin or narrow runtime boundary mismatch");

const rules = await readFile(join(repo, "provider/firebase/firestore.rules"), "utf8");
if (!/allow read, write: if false;/u.test(rules)) errors.push("Firestore Rules must deny all direct access");
if (/allow\s+(?:read|write).*if\s+true/iu.test(rules)) errors.push("Firestore Rules contain an allow-all rule");

for (const file of await collect(join(repo, "src/core"))) {
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/gu)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) errors.push(`pure core external import: ${relative(repo, file)}`);
    if (/provider|firebase|@google-cloud/iu.test(specifier)) {
      errors.push(`pure core contains provider import: ${relative(repo, file)}`);
    }
  }
}

const browserSurface = [
  await readFile(join(repo, "src/ui/browser/staging-preview.ts"), "utf8"),
  await readFile(join(repo, "web/staging-preview.html"), "utf8"),
  await readFile(join(repo, "web/staging-runtime-config.json"), "utf8"),
].join("\n");
for (const forbidden of [
  "LUDYS_CAPABILITY_HMAC_KEY",
  "firebase-admin",
  "firebase-functions",
  "localStorage",
  "indexedDB",
]) {
  if (browserSurface.includes(forbidden)) errors.push(`browser surface contains forbidden value: ${forbidden}`);
}

const providerSources = (await collect(join(repo, "provider/firebase")))
  .filter((path) => {
    const providerRelative = relative(join(repo, "provider/firebase"), path).replaceAll("\\", "/");
    return !providerRelative.startsWith("functions/node_modules/")
      && !providerRelative.startsWith("functions/lib/")
      && !providerRelative.startsWith(".emulator-cache/");
  });
const providerText = (await Promise.all(providerSources
  .filter((path) => /\.(?:ts|mjs|json|rules|example)$/u.test(path))
  .map((path) => readFile(path, "utf8")))).join("\n");
for (const { feature, pattern } of [
  {
    feature: "firebase/auth",
    pattern: /(?:["']firebase\/auth["']|\bgetAuth\s*\()/iu,
  },
  {
    feature: "analytics",
    pattern:
      /(?:["'](?:@firebase\/analytics|firebase\/analytics)["']|\b(?:getAnalytics|initializeAnalytics|logEvent|setAnalyticsCollectionEnabled)\s*\(|["']?measurementId["']?\s*:)/iu,
  },
  {
    feature: "crashlytics",
    pattern:
      /(?:["']firebase\/crashlytics["']|\b(?:getCrashlytics|recordCrashlyticsError)\s*\()/iu,
  },
  {
    feature: "performance monitoring",
    pattern:
      /(?:["']firebase\/performance["']|\bgetPerformance\s*\()/iu,
  },
  {
    feature: "remote config",
    pattern:
      /(?:["']firebase\/remote-config["']|\bgetRemoteConfig\s*\()/iu,
  },
  {
    feature: "cloud storage",
    pattern: /(?:["']firebase\/storage["']|\bgetStorage\s*\()/iu,
  },
]) {
  if (pattern.test(providerText)) {
    errors.push(`forbidden provider feature found: ${feature}`);
  }
}
const providerRuntimeText = (await Promise.all([
  join(repo, "provider/firebase/functions/index.mjs"),
  join(repo, "provider/firebase/functions/firestore-store.mjs"),
  ...await collect(join(repo, "provider/firebase/functions/src")),
].map((path) => readFile(path, "utf8")))).join("\n");
if (/console\.(?:log|info|warn|error)\s*\(/u.test(providerRuntimeText)) {
  errors.push("provider runtime source contains application log call");
}
try {
  const providerRuntimeSecuritySources = Object.fromEntries(
    await Promise.all(providerRuntimeSecuritySourcePaths.map(async (path) => [
      path,
      await readFile(join(repo, path), "utf8"),
    ])),
  );
  assertProviderRuntimeSecuritySourceContracts(
    providerRuntimeSecuritySources,
  );
} catch (error) {
  errors.push(
    "provider runtime security source contract failed: "
      + (error?.code ?? "UNKNOWN_SOURCE_CONTRACT_ERROR"),
  );
}

const receiptTemplateDirectory = join(release, "receipts", "templates");
const receiptTemplateFiles = (await readdir(receiptTemplateDirectory))
  .filter((name) => name.endsWith(".json"));
if (receiptTemplateFiles.length !== 5) errors.push("exactly five receipt templates are required");
for (const name of receiptTemplateFiles) {
  const result = validateReceipt(JSON.parse(await readFile(join(receiptTemplateDirectory, name), "utf8")));
  if (!result.valid || result.evidence) errors.push(`receipt template treated as evidence: ${name}`);
}

const physical = await json("release/wp13-12b/activation-handoff/physical-two-device-proof-template.json");
if (physical.performed !== false || physical.status !== "UNFILLED_TEMPLATE_NOT_EVIDENCE") {
  errors.push("physical proof template must remain unperformed");
}
const localeBundles = await json("release/wp13-12b/staging-activation/locale-bundles.json");
if (
  localeBundles.fallbackAllowed !== false
  || localeBundles.bundles?.map((item) => item.locale).join(",") !== "nb,nn"
) errors.push("BM and NN must be first-class without fallback");

const auth12b = await json("release/wp13-12b/authorization-status.json");
const externalAuthorization = await json(
  "release/wp13-12b/external-activation/owner-authorization.json",
);
const cloudFieldApproval = await json(
  "release/wp13-12b/external-activation/cloud-field-approval.json",
);
if (
  externalAuthorization.authorization !== "AUTHORIZE_WP13_12B_EXTERNAL_ACTIVATION"
  || externalAuthorization.authorizationStatus !== "AUTHORIZED_WITHIN_RECORDED_LIMITS"
  || externalAuthorization.scope !== "ISOLATED_SYNTHETIC_DEV_STAGING_ONLY"
  || externalAuthorization.selectedRegion !== "europe-north1"
  || externalAuthorization.monthlyAlertThreshold?.amount !== 400
  || externalAuthorization.monthlyAlertThreshold?.currency !== "NOK"
  || externalAuthorization.maximumMonthlyCost?.amount !== 500
  || externalAuthorization.maximumMonthlyCost?.currency !== "NOK"
  || externalAuthorization.killSwitchOwner !== "PRODUCT_OWNER_SELF"
  || externalAuthorization.billingReviewer !== "PRODUCT_OWNER_SELF"
  || externalAuthorization.stagingExpiryDate !== "2027-01-25"
  || externalAuthorization.automaticDeletionPolicy?.authorized !== true
  || externalAuthorization.authorizationBoundaries?.syntheticDataOnly !== true
  || externalAuthorization.authorizationBoundaries?.realParticipantData !== false
  || externalAuthorization.authorizationBoundaries?.studentBeta !== false
  || externalAuthorization.authorizationBoundaries?.production !== false
  || externalAuthorization.authorizationBoundaries?.wp13_12c !== false
  || externalAuthorization.humanSignatureOrExplicitConfirmation?.confirmed !== true
  || externalAuthorization.humanSignatureOrExplicitConfirmation?.signaturePresent !== false
  || externalAuthorization.cloudResourcesAtRecording !== 0
) errors.push("external activation owner authorization record mismatch");
if (
  cloudFieldApproval.approvalStatus !== "EXPLICITLY_APPROVED_FOR_EXTERNAL_SYNTHETIC_STAGING"
  || cloudFieldApproval.plannedProjectId !== "ludys-12b-stg-20260725"
  || cloudFieldApproval.approvedGoogleAccount !== "tryakim@gmail.com"
  || cloudFieldApproval.approvedOrganizationId !== "724335528970"
  || cloudFieldApproval.approvedBillingAccount !== "01CD9D-0900DF-4FB36A"
  || cloudFieldApproval.selectedRegion !== "europe-north1"
  || cloudFieldApproval.humanSignatureOrExplicitConfirmation?.confirmed !== true
) errors.push("external activation cloud field approval mismatch");
for (const [field, expected] of Object.entries({
  providerActivation: "BLOCKED",
  cloudResources: 0,
  externalReceipts: 0,
  physicalTwoDeviceProof: false,
  b8: "NOT_DECISION_READY",
  studentBeta: "NOT_AUTHORIZED",
  production: "NOT_AUTHORIZED",
  wp13_12c: "BLOCKED",
})) {
  if (auth12b[field] !== expected) errors.push(`authorization ceiling mismatch: ${field}`);
}
if (
  auth12b.wp13_12bExternalActivation
  !== "AUTHORIZED_BY_EXPLICIT_PRODUCT_OWNER_CONFIRMATION"
) errors.push("external activation authorization status mismatch");

const externalDecisionChecksum = sha256(await readFile(
  join(repo, "release/wp13-12b/external-activation/owner-authorization.json"),
));
const authenticValidatedReceiptTypes = [];
const authenticValidatedReceipts = new Map();
for (const receiptPath of externalActivationState.evidence?.validatedReceiptPaths ?? []) {
  if (
    typeof receiptPath !== "string"
    || !receiptPath.startsWith("release/wp13-12b/receipts/actual/")
    || receiptPath.includes("..")
    || !allFiles.has(receiptPath)
  ) {
    errors.push(`external activation receipt path is invalid: ${String(receiptPath)}`);
    continue;
  }
  const receipt = JSON.parse(await readFile(join(repo, receiptPath), "utf8"));
  const repositoryIntegrity = await verifyReceiptRepositoryIntegrity(
    receipt,
    repo,
    {
      receiptPath,
      artifactVerificationMode:
        RECEIPT_ARTIFACT_VERIFICATION_MODE.DESCENDANT_EVIDENCE_COMMIT,
    },
  );
  const receiptResult = validateReceipt(receipt, {
    sourceTree: repositoryIntegrity.resolvedSourceTree,
    decisionRecordChecksum: externalDecisionChecksum,
  });
  for (const error of [...receiptResult.errors, ...repositoryIntegrity.errors]) {
    errors.push(`${receiptPath}: ${error}`);
  }
  if (!receiptResult.evidence) errors.push(`${receiptPath}: receipt is not authentic evidence`);
  if (receiptResult.evidence && repositoryIntegrity.errors.length === 0) {
    authenticValidatedReceiptTypes.push(receipt.receiptType);
    authenticValidatedReceipts.set(receiptPath, receipt);
  }
}
const externalInventoryIntegrity = await verifyExternalResourceInventoryIntegrity(
  externalResourceInventory,
  repo,
  authenticValidatedReceipts,
);
for (const error of externalInventoryIntegrity.errors) {
  errors.push(`external resource inventory: ${error}`);
}
const authenticValidatedPr3ProofFamilies =
  derivePr3ProofFamiliesFromValidatedReceipts(
    [...authenticValidatedReceipts.values()],
  );
errors.push(...validateExternalActivationState(
  externalActivationState,
  authenticValidatedReceiptTypes,
  authenticValidatedPr3ProofFamilies,
));

const checksumLines = (await readFile(join(release, "artifact-checksums.sha256"), "utf8"))
  .trim().split(/\r?\n/u);
for (const line of checksumLines) {
  const match = /^([a-f0-9]{64})  (.+)$/u.exec(line);
  if (match === null) {
    errors.push(`invalid checksum line: ${line}`);
    continue;
  }
  const path = match[2];
  if (!allFiles.has(path)) {
    errors.push(`checksummed file missing: ${path}`);
    continue;
  }
  const actual = sha256(await readFile(join(repo, path)));
  if (actual !== match[1]) errors.push(`checksum mismatch: ${path}`);
}

const externalChecksumLines = (await readFile(
  join(release, "external-activation", "artifact-checksums.sha256"),
  "utf8",
)).trim().split(/\r?\n/u);
const externalChecksummedPaths = new Set();
for (const line of externalChecksumLines) {
  const match = /^([a-f0-9]{64})  (.+)$/u.exec(line);
  if (match === null) {
    errors.push(`invalid external activation checksum line: ${line}`);
    continue;
  }
  const path = match[2];
  externalChecksummedPaths.add(path);
  if (!externalActivationChecksumTargets.includes(path)) {
    errors.push(`unexpected external activation checksum target: ${path}`);
    continue;
  }
  if (!allFiles.has(path)) {
    errors.push(`external activation checksummed file missing: ${path}`);
    continue;
  }
  const actual = sha256(await readFile(join(repo, path)));
  if (actual !== match[1]) errors.push(`external activation checksum mismatch: ${path}`);
}
for (const path of externalActivationChecksumTargets) {
  if (!externalChecksummedPaths.has(path)) {
    errors.push(`external activation checksum target missing from manifest: ${path}`);
  }
}

const result = {
  valid: errors.length === 0,
  errors,
  warnings,
  repositoryImplementation: errors.length === 0 ? "READY" : "BLOCKED",
  ownerDecision: ownerDecision.decision,
  providerActivation: "BLOCKED",
  cloudResources: 0,
  emulatorProof: "NOT_COMPLETED_OR_EXPLICITLY_CLASSIFIED",
  physicalTwoDeviceProof: false,
  externalReceipts: 0,
  wp13_12c: "BLOCKED",
  externalActivationOverlay: {
    status: externalActivationState.overlayStatus,
    validatedReceipts: externalActivationState.evidence?.validatedReceiptCount,
    emulatorProof: externalActivationState.evidence?.emulatorProof,
    cloudProviderReadback: externalActivationState.evidence?.cloudProviderReadback,
    inventoryStatus: externalResourceInventory.inventoryStatus,
    resourceCount: externalResourceInventory.resourceCount,
    zeroResourcesAsserted: externalResourceInventory.zeroResourcesAsserted,
    physicalTwoDeviceProof: externalActivationState.evidence?.physicalTwoDeviceProof,
  },
};
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exit(1);
