import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  derivePr3ProofFamiliesFromValidatedReceipts,
  validateExternalActivationState,
  validateExternalResourceInventory,
  validateReceipt,
} from "../dist/src/core/staging-validation.js";
import {
  buildExternalActivationChecksumManifest,
  externalActivationChecksumManifestPath,
  externalActivationChecksumTargets,
} from "./wp13-12b-external-activation-checksums.mjs";
import {
  RECEIPT_ARTIFACT_VERIFICATION_MODE,
  verifyExternalResourceInventoryIntegrity,
  verifyReceiptRepositoryIntegrity,
} from "./wp13-12b-receipt-integrity.mjs";
import {
  assertVercelCliRiskContract,
  vercelCliRiskPath,
} from "./wp13-12b-vercel-cli-risk-decision.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const statePath = "release/wp13-12b/external-activation/external-activation-state.json";
const inventoryPath = "release/wp13-12b/external-activation/resource-inventory.json";
const ownerAuthorizationPath =
  "release/wp13-12b/external-activation/owner-authorization.json";

async function bytes(path) {
  return readFile(join(repo, path));
}

async function json(path) {
  return JSON.parse(await readFile(join(repo, path), "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const errors = [];
const state = await json(statePath);
const inventory = await json(inventoryPath);
errors.push(...validateExternalResourceInventory(inventory));
try {
  assertVercelCliRiskContract(await json(vercelCliRiskPath));
} catch {
  errors.push("Vercel CLI tooling risk contract is missing or invalid");
}

const repositoryAuthorization = await json("release/wp13-12b/authorization-status.json");
const repositoryContract = await json(
  "release/wp13-12b/staging-activation/repository-contract.json",
);
for (const [name, baseline] of [
  ["authorization status", repositoryAuthorization],
  ["repository contract", repositoryContract],
]) {
  if (
    baseline.providerActivation !== "BLOCKED"
    || baseline.cloudResources !== 0
    || baseline.externalReceipts !== 0
  ) errors.push(`historical repository ${name} was mutated by external activation`);
}

if (
  state.cloudState?.inventoryStatus !== inventory.inventoryStatus
  || state.cloudState?.resourceCount !== inventory.resourceCount
  || state.cloudState?.zeroResourcesAsserted !== inventory.zeroResourcesAsserted
) errors.push("external activation state and resource inventory disagree");

const ownerAuthorizationChecksum = sha256(await bytes(ownerAuthorizationPath));
let validatedReceiptCount = 0;
const authenticValidatedReceiptTypes = [];
const authenticValidatedReceipts = new Map();
for (const receiptPath of state.evidence?.validatedReceiptPaths ?? []) {
  if (
    typeof receiptPath !== "string"
    || !receiptPath.startsWith("release/wp13-12b/receipts/actual/")
    || receiptPath.includes("..")
  ) {
    errors.push(`invalid receipt path in external activation state: ${String(receiptPath)}`);
    continue;
  }
  try {
    const receipt = await json(receiptPath);
    const integrity = await verifyReceiptRepositoryIntegrity(
      receipt,
      repo,
      {
        receiptPath,
        artifactVerificationMode:
          RECEIPT_ARTIFACT_VERIFICATION_MODE.DESCENDANT_EVIDENCE_COMMIT,
      },
    );
    const receiptResult = validateReceipt(receipt, {
      sourceTree: integrity.resolvedSourceTree,
      decisionRecordChecksum: ownerAuthorizationChecksum,
    });
    for (const error of [...receiptResult.errors, ...integrity.errors]) {
      errors.push(`${receiptPath}: ${error}`);
    }
    if (receiptResult.evidence && integrity.errors.length === 0) {
      validatedReceiptCount += 1;
      authenticValidatedReceiptTypes.push(receipt.receiptType);
      authenticValidatedReceipts.set(receiptPath, receipt);
    }
  } catch {
    errors.push(`external activation receipt is missing or unreadable: ${receiptPath}`);
  }
}
const inventoryIntegrity = await verifyExternalResourceInventoryIntegrity(
  inventory,
  repo,
  authenticValidatedReceipts,
);
for (const error of inventoryIntegrity.errors) {
  errors.push(`${inventoryPath}: ${error}`);
}
const pr3ProofFamilies = derivePr3ProofFamiliesFromValidatedReceipts(
  [...authenticValidatedReceipts.values()],
);
errors.push(...validateExternalActivationState(
  state,
  authenticValidatedReceiptTypes,
  pr3ProofFamilies,
));
if (validatedReceiptCount !== state.evidence?.validatedReceiptCount) {
  errors.push("external activation validated receipt count is not evidence-backed");
}

const checksumManifest = await readFile(
  join(repo, externalActivationChecksumManifestPath),
  "utf8",
).catch(() => {
  errors.push("external activation checksum manifest is missing or unreadable");
  return "";
});
try {
  const expectedChecksumManifest = await buildExternalActivationChecksumManifest(repo);
  if (checksumManifest !== expectedChecksumManifest) {
    errors.push(
      "external activation checksum manifest is stale or non-deterministic; "
      + "run npm run external-activation:checksums",
    );
  }
} catch (error) {
  errors.push(
    error instanceof Error
      ? error.message
      : "external activation checksum coverage could not be evaluated",
  );
}

const checksumLines = checksumManifest === ""
  ? []
  : checksumManifest.trim().split(/\r?\n/u);
const seenChecksumTargets = new Set();
for (const line of checksumLines) {
  const match = /^([a-f0-9]{64})  (.+)$/u.exec(line);
  if (match === null) {
    errors.push(`invalid external activation checksum line: ${line}`);
    continue;
  }
  const [, expected, path] = match;
  if (seenChecksumTargets.has(path)) {
    errors.push(`duplicate external activation checksum target: ${path}`);
  }
  seenChecksumTargets.add(path);
  if (!externalActivationChecksumTargets.includes(path)) {
    errors.push(`unexpected external activation checksum target: ${path}`);
    continue;
  }
  try {
    if (sha256(await bytes(path)) !== expected) {
      errors.push(`external activation checksum mismatch: ${path}`);
    }
  } catch {
    errors.push(`external activation checksummed file is missing: ${path}`);
  }
}
for (const path of externalActivationChecksumTargets) {
  if (!seenChecksumTargets.has(path)) {
    errors.push(`external activation checksum target missing: ${path}`);
  }
}

const result = {
  valid: errors.length === 0,
  errors,
  historicalRepositoryBaselinePreserved: errors.every(
    (error) => !error.startsWith("historical repository"),
  ),
  overlayStatus: state.overlayStatus,
  validatedReceiptCount,
  authenticValidatedReceiptTypes,
  pr3: state.pr3,
  pr3ProofFamilies,
  emulatorProof: state.evidence?.emulatorProof,
  cloudProviderReadback: state.evidence?.cloudProviderReadback,
  inventoryStatus: inventory.inventoryStatus,
  resourceCount: inventory.resourceCount,
  zeroResourcesAsserted: inventory.zeroResourcesAsserted,
  operatorArtifactExists: inventoryIntegrity.operatorArtifactExists,
  operatorArtifactSha256: inventoryIntegrity.artifactSha256,
  operatorInventoryDigest: inventoryIntegrity.inventoryDigest,
  overlayResourcesDigest: inventoryIntegrity.overlayResourcesDigest,
  physicalTwoDeviceProof: state.evidence?.physicalTwoDeviceProof,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.valid) process.exit(1);
