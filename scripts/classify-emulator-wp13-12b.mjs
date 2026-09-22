import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEmulatorConfirmationText,
  buildEmulatorProofBinding,
  validateEmulatorProofArtifact,
} from "./wp13-12b-emulator-confirmation.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const FULL_GIT_SHA = /^[a-f0-9]{40}$/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactBindingValue(actual, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && actual.length === expected.length
      && expected.every(
        (value, index) => exactBindingValue(actual[index], value),
      );
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) return false;
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();
    return expectedKeys.length === actualKeys.length
      && expectedKeys.every((key, index) => (
        key === actualKeys[index]
        && exactBindingValue(actual[key], expected[key])
      ));
  }
  return actual === expected;
}

function exactBinding(actual, expected) {
  if (!isRecord(actual) || !isRecord(expected)) return false;
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  return expectedKeys.length === actualKeys.length
    && expectedKeys.every((key, index) => (
      key === actualKeys[index]
      && exactBindingValue(actual[key], expected[key])
    ));
}

function exactStringArray(actual, expected) {
  return Array.isArray(actual)
    && Array.isArray(expected)
    && actual.length === expected.length
    && expected.every((value, index) => actual[index] === value);
}

function available(command) {
  const result = spawnSync(process.platform === "win32" ? "where.exe" : "which", [command], {
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0;
}

let verifiedJar = false;
const configuredJar = process.env.LUDYS_FIRESTORE_EMULATOR_JAR;
if (configuredJar) {
  try {
    const expected = process.env.LUDYS_FIRESTORE_EMULATOR_SHA256 ?? "";
    const bytes = await readFile(resolve(configuredJar));
    const actual = createHash("sha256").update(bytes).digest("hex");
    verifiedJar = /^[a-f0-9]{64}$/u.test(expected) && actual === expected;
  } catch {
    verifiedJar = false;
  }
}

let actualProofCompleted = false;
let actualProofHumanConfirmed = false;
let actualProofNonceGenerated = false;
let actualProofNonceBlockers = [];
try {
  const proofPath = join(
    repo,
    "artifacts",
    "wp13-12b-actual-emulator-proof.json",
  );
  const proofBytes = await readFile(proofPath);
  const proof = JSON.parse(proofBytes.toString("utf8"));
  validateEmulatorProofArtifact(proof, proofBytes);
  actualProofCompleted = true;
  actualProofNonceBlockers = Array.isArray(
    proof.confirmationChallenge?.blockers,
  ) ? [...proof.confirmationChallenge.blockers] : [];
  const binding = proof.status
    === "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_AWAITING_HUMAN_CONFIRMATION"
    ? buildEmulatorProofBinding(proof, proofBytes)
    : undefined;
  if (binding !== undefined) {
    if (!FULL_GIT_SHA.test(String(binding.proofRunnerGitBlob ?? ""))) {
      throw new Error("EMULATOR_PROOF_RUNNER_GIT_BLOB_INVALID");
    }
    actualProofNonceGenerated = true;
    const expectedConfirmation =
      buildEmulatorConfirmationText(proof, proofBytes);
    const state = JSON.parse(await readFile(
      join(
        repo,
        "release",
        "wp13-12b",
        "external-activation",
        "external-activation-state.json",
      ),
      "utf8",
    ));
    for (const receiptPath of state.evidence?.validatedReceiptPaths ?? []) {
      try {
        const receipt = JSON.parse(
          await readFile(join(repo, receiptPath), "utf8"),
        );
        if (
        receipt.schemaVersion === "wp13.12b-receipt-v2"
        && receipt.receiptType === "EMULATOR_PROOF_RECEIPT"
        && receipt.sourceCommit === binding.sourceCommit
        && receipt.sourceTree === binding.sourceTree
        && receipt.expectedSourceCommit === binding.sourceCommit
        && receipt.evidenceAnchorCommit === binding.commitS
        && receipt.evidenceAnchorTree === binding.commitSTree
        && receipt.commitT === binding.commitT
        && receipt.commitTTree === binding.commitTTree
        && receipt.commitU === binding.commitU
        && receipt.commitUTree === binding.commitUTree
        && receipt.commitV === binding.commitV
        && receipt.commitVTree === binding.commitVTree
        && receipt.commitW === binding.commitW
        && receipt.commitWTree === binding.commitWTree
        && exactStringArray(
          receipt.orderedCommitChain,
          binding.orderedCommitChain,
        )
        && receipt.proofOriginCommit === binding.proofOriginCommit
        && receipt.proofOriginTree === binding.proofOriginTree
        && receipt.proofToolCommit === binding.proofToolCommit
        && receipt.proofToolTree === binding.proofToolTree
        && exactStringArray(
          receipt.proofToolCommitChain,
          binding.proofToolCommitChain,
        )
        && receipt.securityRemediationCommit
          === binding.securityRemediationCommit
        && receipt.securityRemediationTree === binding.securityRemediationTree
        && receipt.providerSecurityRemediationCommit
          === binding.providerSecurityRemediationCommit
        && receipt.providerPackageCommit === binding.providerPackageCommit
        && receipt.providerPackageLockCommit
          === binding.providerPackageLockCommit
        && receipt.providerSbomCommit === binding.providerSbomCommit
        && receipt.providerAuditCommit === binding.providerAuditCommit
        && exactBinding(receipt.emulatorProofBinding, binding)
        && receipt.decisionRecordChecksum === binding.ownerDecisionSha256
        && receipt.artifactHashes?.[binding.artifactPath]
          === binding.artifactSha256
        && receipt.artifactHashes?.[
          "release/wp13-12b/external-activation/owner-authorization.json"
        ] === binding.ownerDecisionSha256
        && receipt.artifactHashes?.[
          "release/wp13-12b/provider-security-remediation.json"
        ] === binding.providerSecurityRemediationSha256
        && receipt.artifactHashes?.["artifacts/wp13-12b-provider-package.json"]
          === binding.providerPackageSha256
        && receipt.artifactHashes?.[
          "provider/firebase/functions/package-lock.json"
        ] === binding.providerLockSha256
        && receipt.artifactHashes?.["release/wp13-12b/provider-sbom.cdx.json"]
          === binding.providerSbomSha256
        && receipt.artifactHashes?.["release/wp13-12b/provider-audit.json"]
          === binding.providerAuditSha256
        && receipt.artifactHashes?.[
          "release/wp13-12b/external-activation/artifact-checksums.sha256"
        ] === binding.activationPackageSha256
        && receipt.artifactHashes?.[
          "release/wp13-12b/activation-handoff/receipt-contracts.json"
        ] === binding.receiptContractSha256
        && receipt.artifactHashes?.["scripts/run-wp13-12b-emulator-proof.mjs"]
          === binding.proofRunnerSha256
        && receipt.nonceRecord?.schemaVersion
          === "wp13.12b-emulator-proof-challenge-v2"
        && receipt.nonceRecord?.generation === 1
        && receipt.nonceRecord?.nonce === binding.nonce
        && receipt.nonceRecord?.purpose === binding.purpose
        && receipt.nonceRecord?.generatedAt === binding.generatedAt
        && receipt.nonceRecord?.expiresAt === binding.expiresAt
        && receipt.nonceRecord?.status === "CONFIRMED_CONSUMED"
        && receipt.nonceRecord?.cloudResourceCount
          === binding.cloudResourceCount
        && receipt.nonceRecord?.deploymentCount === binding.deploymentCount
        && receipt.nonceRecord?.validatedReceiptCount
          === binding.validatedReceiptCount
        && receipt.nonceRecord?.commitS === binding.commitS
        && receipt.nonceRecord?.commitSTree === binding.commitSTree
        && receipt.nonceRecord?.commitT === binding.commitT
        && receipt.nonceRecord?.commitTTree === binding.commitTTree
        && receipt.nonceRecord?.commitU === binding.commitU
        && receipt.nonceRecord?.commitUTree === binding.commitUTree
        && receipt.nonceRecord?.commitV === binding.commitV
        && receipt.nonceRecord?.commitVTree === binding.commitVTree
        && receipt.nonceRecord?.commitW === binding.commitW
        && receipt.nonceRecord?.commitWTree === binding.commitWTree
        && exactStringArray(
          receipt.nonceRecord?.orderedCommitChain,
          binding.orderedCommitChain,
        )
        && receipt.nonceRecord?.proofOriginCommit
          === binding.proofOriginCommit
        && receipt.nonceRecord?.proofOriginTree === binding.proofOriginTree
        && exactStringArray(
          receipt.nonceRecord?.proofToolCommitChain,
          binding.proofToolCommitChain,
        )
        && receipt.nonceRecord?.proofToolCommit === binding.proofToolCommit
        && receipt.nonceRecord?.proofToolTree === binding.proofToolTree
        && receipt.nonceRecord?.securityRemediationCommit
          === binding.securityRemediationCommit
        && receipt.nonceRecord?.securityRemediationTree
          === binding.securityRemediationTree
        && receipt.nonceRecord?.providerSecurityRemediationCommit
          === binding.providerSecurityRemediationCommit
        && receipt.nonceRecord?.providerPackageCommit
          === binding.providerPackageCommit
        && receipt.nonceRecord?.providerPackageLockCommit
          === binding.providerPackageLockCommit
        && receipt.nonceRecord?.providerSbomCommit
          === binding.providerSbomCommit
        && receipt.nonceRecord?.providerAuditCommit
          === binding.providerAuditCommit
        && receipt.nonceRecord?.proofRunnerSha256
          === binding.proofRunnerSha256
        && FULL_GIT_SHA.test(String(
          receipt.nonceRecord?.proofRunnerGitBlob ?? "",
        ))
        && receipt.nonceRecord?.proofRunnerGitBlob
          === binding.proofRunnerGitBlob
        && receipt.nonceRecord?.pinnedGitAdapterSha256
          === binding.pinnedGitAdapterSha256
        && receipt.nonceRecord?.pinnedGitAdapterGitBlob
          === binding.pinnedGitAdapterGitBlob
        && exactBindingValue(
          receipt.nonceRecord?.gitDiffCommandContract,
          binding.gitDiffCommandContract,
        )
        && receipt.nonceRecord?.securityRemediationChangeSetSha256
          === binding.securityRemediationChangeSetSha256
        && receipt.nonceRecord?.previewSourceSetSha256
          === binding.previewSourceSetSha256
        && receipt.nonceRecord?.freshEmulatorProofSha256
          === binding.proofSha256
        && receipt.nonceRecord?.ownerDecisionSha256
          === binding.ownerDecisionSha256
        && receipt.nonceRecord?.providerSecurityRemediationSha256
          === binding.providerSecurityRemediationSha256
        && receipt.nonceRecord?.providerPackageSha256
          === binding.providerPackageSha256
        && receipt.nonceRecord?.providerLockSha256
          === binding.providerLockSha256
        && receipt.nonceRecord?.providerSbomSha256
          === binding.providerSbomSha256
        && receipt.nonceRecord?.providerAuditSha256
          === binding.providerAuditSha256
        && receipt.nonceRecord?.resolvedFastUriVersion
          === binding.resolvedFastUriVersion
        && receipt.nonceRecord?.advisory === binding.advisory
        && receipt.nonceRecord?.activationPackageSha256
          === binding.activationPackageSha256
        && receipt.nonceRecord?.receiptContractSha256
          === binding.receiptContractSha256
        && receipt.humanSignatureOrExplicitConfirmation?.confirmed === true
        && receipt.createdAt
          === receipt.humanSignatureOrExplicitConfirmation?.confirmedAt
        && receipt.nonceRecord?.consumedAt === receipt.createdAt
        && Date.parse(receipt.createdAt) >= Date.parse(binding.generatedAt)
        && Date.parse(receipt.createdAt) <= Date.parse(binding.expiresAt)
        && receipt.humanSignatureOrExplicitConfirmation?.confirmationText
          === expectedConfirmation
        ) {
          actualProofHumanConfirmed = true;
          break;
        }
      } catch {
        // A missing or unreadable candidate receipt is never confirmation.
      }
    }
  }
} catch {
  actualProofHumanConfirmed = false;
}

const configuredJava = process.env.LUDYS_JAVA_HOME
  ? join(
    resolve(process.env.LUDYS_JAVA_HOME),
    "bin",
    process.platform === "win32" ? "java.exe" : "java",
  )
  : undefined;
const configuredFirebaseCli = process.env.LUDYS_FIREBASE_CLI_JS
  ? resolve(process.env.LUDYS_FIREBASE_CLI_JS)
  : undefined;
const pathAvailable = async (path) => {
  if (!path) return false;
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};
const javaAvailable = actualProofCompleted || available("java") || await pathAvailable(configuredJava);
const firebaseCliAvailable = (
  actualProofCompleted
  || available("firebase")
  || await pathAvailable(configuredFirebaseCli)
);
const actualProofPossible = javaAvailable && firebaseCliAvailable && verifiedJar;
const artifact = {
  schemaVersion: "wp13.12b-emulator-proof-status-v1",
  status: actualProofCompleted
    ? actualProofHumanConfirmed
      ? "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_AND_HUMAN_CONFIRMED"
      : actualProofNonceGenerated
        ? "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_AWAITING_HUMAN_CONFIRMATION"
        : "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_NONCE_BLOCKED_BY_CURRENT_EXTERNAL_COUNTS"
    : actualProofPossible
      ? "READY_FOR_EXPLICIT_ACTUAL_EMULATOR_COMMAND"
      : "FIREBASE_EMULATOR_PROOF_BLOCKED_BY_VERIFIED_ARTIFACT_UNAVAILABILITY",
  actualFirebaseEmulatorProof: actualProofCompleted,
  v2NonceGenerated: actualProofNonceGenerated,
  v2NonceBlockers: actualProofNonceBlockers,
  emulatorContractProof: true,
  javaAvailable,
  firebaseCliAvailable,
  verifiedFirestoreEmulatorJarAvailable: verifiedJar || actualProofCompleted,
  exactJarFilenameRequired: true,
  publishedSha256Required: true,
  officialSetupCommandDocumented: "firebase setup:emulators:firestore",
  officialJarSha256Located: verifiedJar || actualProofCompleted,
  offlineImportContract: "release/wp13-12b/activation-handoff/emulator-import-contract.json",
  reason: actualProofCompleted
    ? actualProofHumanConfirmed
      ? "A clean-commit challenge-bound v2 emulator proof records complete synthetic cleanup and an exact proof-bound product-owner confirmation receipt."
      : actualProofNonceGenerated
        ? "A clean-commit challenge-bound v2 emulator proof records complete synthetic cleanup; its exact nonce-bound human confirmation receipt remains separate."
        : "A clean-commit v2 emulator proof records complete synthetic cleanup, but nonce generation remains fail-closed until authoritative current external resource and deployment counts are available."
    : actualProofPossible
      ? "Verified prerequisites are available, but actual proof has not run on a clean commit."
      : "No local Java/CLI/verified JAR combination is available in this environment.",
  cloudResourcesCreated: 0,
  providerLoginAttempted: false,
  billingChanged: false,
};
const output = join(repo, "artifacts", "wp13-12b-emulator-proof-status.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify(artifact, null, 2));
