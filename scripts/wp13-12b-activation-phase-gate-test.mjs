import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  acquireBaseActivationCapability,
  acquireCleanupActivationCapability,
  activationPhaseGateConstants,
  assertBaseActivationCapability,
  assertCleanupActivationCapability,
  assertLiveActivationCapability,
  isActivationCapabilityFresh,
  validateCleanupEvidenceWorktreeEntriesForTesting,
  validateDirectEmulatorEvidenceCommitChainForTesting,
  validateEmulatorReceiptForTesting,
} from "./wp13-12b-activation-phase-gate.mjs";
import { runDeployIdentityControl } from
  "./provider-external-deploy-identity-control.mjs";
import { deployIdentityScope } from "./wp13-12b-deploy-identity.mjs";
import {
  providerPackageArtifactPath,
  providerPackageFilePaths,
} from "./wp13-12b-provider-package-contract.mjs";
import {
  EMULATOR_PROOF_PATH,
  REQUIRED_EMULATOR_PROOF_RESULTS,
} from "./wp13-12b-emulator-confirmation.mjs";
import { externalActivationChecksumTargets } from
  "./wp13-12b-external-activation-checksums.mjs";

const emulatorReceiptPath =
  "release/wp13-12b/receipts/actual/"
  + "emulator-proof-receipt-source-v2.json";

function git(root, args) {
  return execFileSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
}

async function writeRepositoryFile(root, path, contents) {
  const target = join(root, ...path.split("/"));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, "utf8");
}

async function createHermeticRepository() {
  const root = await mkdtemp(join(tmpdir(), "ludys-activation-chain-"));
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "activation-gate-test@example.invalid"]);
  git(root, ["config", "user.name", "Activation Gate Test"]);
  await writeRepositoryFile(root, "baseline.txt", "source\n");
  git(root, ["add", "--all"]);
  git(root, ["commit", "--quiet", "-m", "source"]);
  return root;
}

function commitAll(root, message) {
  git(root, ["add", "--all"]);
  git(root, ["commit", "--quiet", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}

test("production acquisition rejects arbitrary repositories and adapters", async () => {
  await assert.rejects(
    () => acquireBaseActivationCapability({
      repositoryRoot: "C:/attacker-controlled",
      execFileImpl: () => "",
    }),
    /PRODUCTION_ACTIVATION_GATE_ARGUMENTS_FORBIDDEN/u,
  );
  await assert.rejects(
    () => acquireCleanupActivationCapability({
      repositoryRoot: "C:/attacker-controlled",
      execFileImpl: () => "",
    }),
    /PRODUCTION_CLEANUP_GATE_ARGUMENTS_FORBIDDEN/u,
  );
});

test("forged repository and clock assertion inputs are forbidden", () => {
  assert.throws(
    () => assertBaseActivationCapability(Object.freeze({}), {
      repository: {
        workingTreeClean: true,
        commit: "a".repeat(40),
        tree: "b".repeat(40),
      },
    }),
    /PRODUCTION_ACTIVATION_ASSERTION_ARGUMENTS_FORBIDDEN/u,
  );
  assert.throws(
    () => assertCleanupActivationCapability(Object.freeze({})),
    /VALIDATED_CLEANUP_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  assert.throws(
    () => assertLiveActivationCapability(Object.freeze({}), {
      now: () => new Date("2026-07-27T12:00:00.000Z"),
    }),
    /PRODUCTION_ACTIVATION_ASSERTION_ARGUMENTS_FORBIDDEN/u,
  );
});

test("fake capability cannot authorize a real authority-increasing mutator", async () => {
  await assert.rejects(
    () => runDeployIdentityControl([
      "--action", "provision",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--window-expires-at", "2026-07-27T12:45:00.000Z",
      "--authorized", deployIdentityScope.activationAuthorization,
    ], {
      activationCapability: Object.freeze({ productionBound: true }),
    }),
    /VALIDATED_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
});

test("production assertion source always uses actual Git and wall clock", async () => {
  const source = await readFile(
    new URL("./wp13-12b-activation-phase-gate.mjs", import.meta.url),
    "utf8",
  );
  const repositoryAssertion = source.slice(
    source.indexOf("function assertProductionRepositoryBinding"),
    source.indexOf("function assertProductionAssertionOptions"),
  );
  assert.match(repositoryAssertion, /productionRepositoryRoot/u);
  assert.match(repositoryAssertion, /createPinnedGitExecFile/u);
  assert.doesNotMatch(repositoryAssertion, /execFileSync/u);
  assert.match(repositoryAssertion, /status.*--porcelain=v2/su);
  assert.doesNotMatch(repositoryAssertion, /repository\?/u);
  const liveAssertion = source.slice(
    source.indexOf("export function assertLiveActivationCapability"),
    source.indexOf("export const activationPhaseGateConstants"),
  );
  assert.match(liveAssertion, /const instant = new Date\(\)/u);
  assert.doesNotMatch(liveAssertion, /now\s*=/u);
  const previewAssertion = source.slice(
    source.indexOf(
      "export function assertPreviewReadyActivationCapability",
    ),
    source.indexOf(
      "export function assertProtectedPreviewActivationCapability",
    ),
  );
  assert.match(previewAssertion, /const instant = new Date\(\)/u);
  assert.match(
    previewAssertion,
    /previewReadyCapabilityMaximumAgeMilliseconds/u,
  );
  assert.match(previewAssertion, /isActivationCapabilityFresh/u);
  assert.doesNotMatch(previewAssertion, /now\s*=/u);
});

test("authority checksum coverage explicitly includes the provider package", async () => {
  const source = await readFile(
    new URL("./wp13-12b-activation-phase-gate.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /artifacts\/wp13-12b-provider-package\.json/u,
  );
  assert.match(source, /\.\.\.providerPackageFilePaths/u);
  assert.match(
    source,
    /scripts\/wp13-12b-provider-package-contract\.mjs/u,
  );
  assert.match(
    source,
    /provider\/firebase\/firestore\.indexes\.json/u,
  );
  assert.match(
    source,
    /scripts\/wp13-12b-vercel-cli-toolchain\.mjs/u,
  );
  assert.match(
    source,
    /scripts\/wp13-12b-google-oauth-token-helper\.cjs/u,
  );
  assert.match(
    source,
    /scripts\/wp13-12b-external-resource-operator\.mjs/u,
  );
  assert.equal(
    providerPackageArtifactPath,
    "artifacts/wp13-12b-provider-package.json",
  );
  assert.equal(providerPackageFilePaths.length, 12);
  assert.ok(externalActivationChecksumTargets.includes(".gitattributes"));
  assert.ok(externalActivationChecksumTargets.includes(
    "scripts/wp13-12b-google-oauth-token-helper.cjs",
  ));
  assert.equal(
    externalActivationChecksumTargets.includes(EMULATOR_PROOF_PATH),
    false,
  );
});

test("fail-safe cleanup gate is source-bound without emulator/live dependency", async () => {
  const source = await readFile(
    new URL("./wp13-12b-activation-phase-gate.mjs", import.meta.url),
    "utf8",
  );
  const acquisition = source.slice(
    source.indexOf("export async function acquireCleanupActivationCapability"),
    source.indexOf("export function acquirePreviewReadyActivationCapability"),
  );
  assert.match(acquisition, /verifyAuthorityCriticalWorkingBytes/u);
  assert.match(acquisition, /assertOnlyCleanupEvidenceWorktreeChanges/u);
  assert.doesNotMatch(acquisition, /validateBaseEvidence/u);
  assert.doesNotMatch(acquisition, /defaultVercelReadback/u);
  assert.doesNotMatch(acquisition, /defaultWifReadback/u);
  assert.ok(
    activationPhaseGateConstants.cleanupEvidenceWorkingPaths.includes(
      "release/wp13-12b/receipts/actual/"
      + "synthetic-data-deletion-intent.json",
    ),
  );
});

test("cleanup reacquisition accepts only strict interrupted evidence temps", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ludys-cleanup-temp-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const finalPath =
    "release/wp13-12b/receipts/actual/"
    + "deactivation-execution-receipt.json";
  const strictTempPath =
    `${finalPath}.tmp-4812-0123456789abcdef0123456789abcdef`;
  await writeRepositoryFile(root, strictTempPath, "{}\n");
  if (process.platform !== "win32") {
    await chmod(join(root, ...strictTempPath.split("/")), 0o600);
  }

  assert.deepEqual(
    validateCleanupEvidenceWorktreeEntriesForTesting({
      repositoryRoot: root,
      statusEntries: [`?? ${strictTempPath}`],
    }),
    [strictTempPath],
  );
  assert.throws(
    () => validateCleanupEvidenceWorktreeEntriesForTesting({
      repositoryRoot: root,
      statusEntries: [
        `?? ${finalPath}.tmp-4812-not-a-cryptographic-random-suffix`,
      ],
    }),
    /CLEANUP_EVIDENCE_TEMP_NAME_INVALID/u,
  );
  assert.throws(
    () => validateCleanupEvidenceWorktreeEntriesForTesting({
      repositoryRoot: root,
      statusEntries: [
        "?? scripts/authority.mjs.tmp-4812-"
        + "0123456789abcdef0123456789abcdef",
      ],
    }),
    /CLEANUP_CAPABILITY_WORKTREE_DRIFT_FORBIDDEN/u,
  );
});

test("cleanup reacquisition recognizes only the expected interrupted hardlink", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ludys-cleanup-link-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const finalPath =
    "release/wp13-12b/receipts/actual/"
    + "synthetic-data-deletion-execution-receipt.json";
  const tempPath =
    `${finalPath}.tmp-921-abcdef0123456789abcdef0123456789`;
  await writeRepositoryFile(root, finalPath, "{}\n");
  if (process.platform !== "win32") {
    await chmod(join(root, ...finalPath.split("/")), 0o600);
  }
  await link(
    join(root, ...finalPath.split("/")),
    join(root, ...tempPath.split("/")),
  );

  assert.deepEqual(
    validateCleanupEvidenceWorktreeEntriesForTesting({
      repositoryRoot: root,
      statusEntries: [`?? ${finalPath}`, `?? ${tempPath}`],
    }),
    [finalPath, tempPath].sort(),
  );
  assert.throws(
    () => validateCleanupEvidenceWorktreeEntriesForTesting({
      repositoryRoot: root,
      statusEntries: [`?? ${tempPath}`],
    }),
    /CLEANUP_EVIDENCE_TEMP_HARDLINK_INVALID/u,
  );
});

test("cleanup reacquisition rejects a symlinked evidence parent", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ludys-cleanup-parent-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const alternate = join(root, "alternate-actual");
  const receipts = join(root, "release", "wp13-12b", "receipts");
  await mkdir(alternate, { recursive: true });
  await mkdir(receipts, { recursive: true });
  try {
    await symlink(alternate, join(receipts, "actual"), "junction");
  } catch (error) {
    if (["EPERM", "EACCES", "EINVAL"].includes(error?.code)) {
      t.skip("directory symlinks/junctions are unavailable on this host");
      return;
    }
    throw error;
  }
  const finalPath =
    "release/wp13-12b/receipts/actual/"
    + "preview-destruction-evidence.json";
  const tempPath =
    `${finalPath}.tmp-42-fedcba9876543210fedcba9876543210`;
  await writeFile(
    join(alternate, "preview-destruction-evidence.json"
      + ".tmp-42-fedcba9876543210fedcba9876543210"),
    "{}\n",
    { encoding: "utf8", mode: 0o600 },
  );
  assert.throws(
    () => validateCleanupEvidenceWorktreeEntriesForTesting({
      repositoryRoot: root,
      statusEntries: [`?? ${tempPath}`],
    }),
    /CLEANUP_EVIDENCE_CANONICAL_PARENT_REQUIRED/u,
  );
});

test("cleanup canonicalization permits a non-symlink root reached through an ancestor alias", async (t) => {
  const container = await mkdtemp(
    join(tmpdir(), "ludys-cleanup-root-alias-"),
  );
  t.after(() => rm(container, { recursive: true, force: true }));
  const realParent = join(container, "real-parent");
  const realRoot = join(realParent, "repository");
  const aliasParent = join(container, "alias-parent");
  await mkdir(realRoot, { recursive: true });
  try {
    await symlink(realParent, aliasParent, "junction");
  } catch (error) {
    if (["EPERM", "EACCES", "EINVAL"].includes(error?.code)) {
      t.skip("directory symlinks/junctions are unavailable on this host");
      return;
    }
    throw error;
  }
  const rootThroughAncestorAlias = join(aliasParent, "repository");
  const finalPath =
    "release/wp13-12b/receipts/actual/"
    + "synthetic-data-deletion-intent.json";
  const tempPath =
    `${finalPath}.tmp-73-00112233445566778899aabbccddeeff`;
  await writeRepositoryFile(
    rootThroughAncestorAlias,
    tempPath,
    "{}\n",
  );
  if (process.platform !== "win32") {
    await chmod(
      join(rootThroughAncestorAlias, ...tempPath.split("/")),
      0o600,
    );
  }
  assert.deepEqual(
    validateCleanupEvidenceWorktreeEntriesForTesting({
      repositoryRoot: rootThroughAncestorAlias,
      statusEntries: [`?? ${tempPath}`],
    }),
    [tempPath],
  );
});

test("preview capability freshness rejects stale and future-dated proof", () => {
  const instant = new Date("2026-07-27T12:00:00.000Z");
  const maximumAge =
    activationPhaseGateConstants
      .previewReadyCapabilityMaximumAgeMilliseconds;
  assert.equal(isActivationCapabilityFresh(
    instant.toISOString(),
    instant,
    maximumAge,
  ), true);
  assert.equal(isActivationCapabilityFresh(
    new Date(instant.valueOf() - maximumAge - 1).toISOString(),
    instant,
    maximumAge,
  ), false);
  assert.equal(isActivationCapabilityFresh(
    new Date(instant.valueOf() + 60_001).toISOString(),
    instant,
    maximumAge,
  ), false);
});

test("emulator receipt preserves every dual binding and nonce field", () => {
  const commitS = "6".repeat(40);
  const commitT = "e".repeat(40);
  const commitU = "c".repeat(40);
  const commitV = "4".repeat(40);
  const commitW = "8".repeat(40);
  const proofToolCommit = commitW;
  const commitVTree = "5".repeat(40);
  const commitWTree = "a".repeat(40);
  const proofRunnerGitBlob = "0".repeat(40);
  const binding = {
    schemaVersion: "wp13.12b-emulator-proof-binding-v2",
    artifactPath: EMULATOR_PROOF_PATH,
    artifactSha256: "1".repeat(64),
    proofSha256: "1".repeat(64),
    nonce: "2".repeat(32),
    purpose: "WP13_12B_PR3_LOCAL_EMULATOR_PROOF_ONLY",
    jarSha256: "3".repeat(64),
    demoProjectId: "demo-ludys-wp13-12b",
    sourceCommit: proofToolCommit,
    sourceTree: commitWTree,
    commitS,
    commitSTree: "7".repeat(40),
    commitT,
    commitTTree: "f".repeat(40),
    commitU,
    commitUTree: "d".repeat(40),
    commitV,
    commitVTree,
    commitW,
    commitWTree,
    orderedCommitChain: [commitS, commitT, commitU, commitV, commitW],
    proofOriginCommit: commitV,
    proofOriginTree: commitVTree,
    proofToolCommit,
    proofToolTree: commitWTree,
    proofToolCommitChain: [commitT, commitU, commitV, commitW],
    securityRemediationCommit: commitU,
    securityRemediationTree: "d".repeat(40),
    providerSecurityRemediationCommit: commitU,
    providerPackageCommit: commitU,
    providerPackageLockCommit: commitU,
    providerSbomCommit: commitU,
    providerAuditCommit: commitU,
    proofRunnerSha256: "8".repeat(64),
    proofRunnerGitBlob,
    pinnedGitAdapterSha256: "4".repeat(64),
    pinnedGitAdapterGitBlob: "9".repeat(40),
    securityRemediationChangeSetSha256: "5".repeat(64),
    gitDiffCommandContract: {
      schemaVersion: "wp13.12b-pinned-git-diff-command-v1",
      command: "git",
      args: [
        "diff",
        "--name-only",
        "--no-renames",
        "-z",
        commitT,
        commitU,
        "--",
      ],
      output: "NUL_TERMINATED_REPOSITORY_RELATIVE_PATHS",
      renameDetection: false,
    },
    previewSourceSetSha256: "9".repeat(64),
    ownerDecisionSha256: "a".repeat(64),
    providerPackageSha256: "b".repeat(64),
    providerLockSha256: "0".repeat(64),
    providerSbomSha256: "1".repeat(64),
    providerAuditSha256: "2".repeat(64),
    providerSecurityRemediationSha256: "3".repeat(64),
    resolvedFastUriVersion: "3.1.5",
    advisory: "GHSA-7p8r-x3mc-p8w7",
    activationPackageSha256: "c".repeat(64),
    receiptContractSha256: "d".repeat(64),
    generatedAt: "2026-07-30T10:00:00.000Z",
    expiresAt: "2026-07-30T10:30:00.000Z",
    cloudResourceCount: 7,
    deploymentCount: 0,
    validatedReceiptCount: 0,
  };
  const confirmedAt = "2026-07-30T10:10:00.000Z";
  const confirmationText = "exact-owner-confirmation";
  const receipt = {
    schemaVersion: "wp13.12b-receipt-v2",
    templateMarker: "FILLED_AUTHENTIC_EVIDENCE",
    receiptId:
      `wp13-12b-emulator-proof-${binding.sourceCommit.slice(0, 12)}-`
      + `${binding.nonce.slice(0, 12)}-v2`,
    receiptType: "EMULATOR_PROOF_RECEIPT",
    status: "COMPLETED_WITH_AUTHENTIC_EVIDENCE",
    createdAt: confirmedAt,
    sourceCommit: binding.sourceCommit,
    sourceTree: binding.sourceTree,
    expectedSourceCommit: binding.sourceCommit,
    evidenceAnchorCommit: binding.commitS,
    evidenceAnchorTree: binding.commitSTree,
    commitT: binding.commitT,
    commitTTree: binding.commitTTree,
    commitU: binding.commitU,
    commitUTree: binding.commitUTree,
    commitV: binding.commitV,
    commitVTree: binding.commitVTree,
    commitW: binding.commitW,
    commitWTree: binding.commitWTree,
    orderedCommitChain: [...binding.orderedCommitChain],
    proofOriginCommit: binding.proofOriginCommit,
    proofOriginTree: binding.proofOriginTree,
    proofToolCommit: binding.proofToolCommit,
    proofToolTree: binding.proofToolTree,
    proofToolCommitChain: [...binding.proofToolCommitChain],
    securityRemediationCommit: binding.securityRemediationCommit,
    securityRemediationTree: binding.securityRemediationTree,
    providerSecurityRemediationCommit:
      binding.providerSecurityRemediationCommit,
    providerPackageCommit: binding.providerPackageCommit,
    providerPackageLockCommit: binding.providerPackageLockCommit,
    providerSbomCommit: binding.providerSbomCommit,
    providerAuditCommit: binding.providerAuditCommit,
    decisionRecordChecksum: binding.ownerDecisionSha256,
    proofResults: Object.fromEntries(
      REQUIRED_EMULATOR_PROOF_RESULTS.map((name) => [name, true]),
    ),
    artifactHashes: {
      [EMULATOR_PROOF_PATH]: binding.artifactSha256,
      "release/wp13-12b/external-activation/owner-authorization.json":
        binding.ownerDecisionSha256,
      "artifacts/wp13-12b-provider-package.json":
        binding.providerPackageSha256,
      "provider/firebase/functions/package-lock.json":
        binding.providerLockSha256,
      "release/wp13-12b/provider-sbom.cdx.json":
        binding.providerSbomSha256,
      "release/wp13-12b/provider-audit.json":
        binding.providerAuditSha256,
      "release/wp13-12b/provider-security-remediation.json":
        binding.providerSecurityRemediationSha256,
      "release/wp13-12b/external-activation/artifact-checksums.sha256":
        binding.activationPackageSha256,
      "release/wp13-12b/activation-handoff/receipt-contracts.json":
        binding.receiptContractSha256,
      "scripts/run-wp13-12b-emulator-proof.mjs":
        binding.proofRunnerSha256,
    },
    emulatorProofBinding: { ...binding },
    nonceRecord: {
      schemaVersion: "wp13.12b-emulator-proof-challenge-v2",
      generation: 1,
      nonce: binding.nonce,
      purpose: binding.purpose,
      generatedAt: binding.generatedAt,
      expiresAt: binding.expiresAt,
      status: "CONFIRMED_CONSUMED",
      consumedAt: confirmedAt,
      cloudResourceCount: binding.cloudResourceCount,
      deploymentCount: binding.deploymentCount,
      validatedReceiptCount: binding.validatedReceiptCount,
      commitS: binding.commitS,
      commitSTree: binding.commitSTree,
      commitT: binding.commitT,
      commitTTree: binding.commitTTree,
      commitU: binding.commitU,
      commitUTree: binding.commitUTree,
      commitV: binding.commitV,
      commitVTree: binding.commitVTree,
      commitW: binding.commitW,
      commitWTree: binding.commitWTree,
      orderedCommitChain: [...binding.orderedCommitChain],
      proofOriginCommit: binding.proofOriginCommit,
      proofOriginTree: binding.proofOriginTree,
      proofToolCommitChain: [...binding.proofToolCommitChain],
      proofToolCommit: binding.proofToolCommit,
      proofToolTree: binding.proofToolTree,
      securityRemediationCommit: binding.securityRemediationCommit,
      securityRemediationTree: binding.securityRemediationTree,
      providerSecurityRemediationCommit:
        binding.providerSecurityRemediationCommit,
      providerPackageCommit: binding.providerPackageCommit,
      providerPackageLockCommit: binding.providerPackageLockCommit,
      providerSbomCommit: binding.providerSbomCommit,
      providerAuditCommit: binding.providerAuditCommit,
      proofRunnerSha256: binding.proofRunnerSha256,
      proofRunnerGitBlob: binding.proofRunnerGitBlob,
      pinnedGitAdapterSha256: binding.pinnedGitAdapterSha256,
      pinnedGitAdapterGitBlob: binding.pinnedGitAdapterGitBlob,
      securityRemediationChangeSetSha256:
        binding.securityRemediationChangeSetSha256,
      gitDiffCommandContract: structuredClone(binding.gitDiffCommandContract),
      previewSourceSetSha256: binding.previewSourceSetSha256,
      freshEmulatorProofSha256: binding.proofSha256,
      ownerDecisionSha256: binding.ownerDecisionSha256,
      providerPackageSha256: binding.providerPackageSha256,
      providerLockSha256: binding.providerLockSha256,
      providerSbomSha256: binding.providerSbomSha256,
      providerAuditSha256: binding.providerAuditSha256,
      providerSecurityRemediationSha256:
        binding.providerSecurityRemediationSha256,
      resolvedFastUriVersion: binding.resolvedFastUriVersion,
      advisory: binding.advisory,
      activationPackageSha256: binding.activationPackageSha256,
      receiptContractSha256: binding.receiptContractSha256,
    },
    humanSignatureOrExplicitConfirmation: {
      confirmed: true,
      confirmationText,
      confirmedAt,
    },
    realParticipantData: false,
    syntheticOrFabricated: false,
    authorizesStudentBeta: false,
    authorizesProduction: false,
  };
  assert.equal(
    receipt.nonceRecord.proofToolCommit,
    binding.proofToolCommit,
  );
  assert.equal(receipt.nonceRecord.proofToolTree, binding.proofToolTree);
  assert.equal(
    validateEmulatorReceiptForTesting(
      JSON.parse(JSON.stringify(receipt)),
      binding,
      confirmationText,
    ),
    true,
  );
  const tampered = structuredClone(receipt);
  tampered.nonceRecord.cloudResourceCount += 1;
  assert.throws(
    () => validateEmulatorReceiptForTesting(
      tampered,
      binding,
      confirmationText,
    ),
    /CONFIRMED_CHALLENGE_BOUND_EMULATOR_V2_RECEIPT_REQUIRED/u,
  );
  for (const mutate of [
    (value) => { value.orderedCommitChain.reverse(); },
    (value) => { value.proofToolCommitChain.reverse(); },
    (value) => { value.nonceRecord.proofToolCommitChain.pop(); },
    (value) => { value.nonceRecord.proofToolCommit = "0".repeat(40); },
    (value) => { value.nonceRecord.proofToolTree = "0".repeat(40); },
    (value) => { value.commitT = "0".repeat(40); },
    (value) => { value.commitU = "0".repeat(40); },
    (value) => { value.nonceRecord.commitV = "0".repeat(40); },
    (value) => { value.commitW = "0".repeat(40); },
    (value) => { value.nonceRecord.commitWTree = "0".repeat(40); },
    (value) => { value.emulatorProofBinding.providerLockSha256 = "f".repeat(64); },
    (value) => { value.nonceRecord.advisory = "GHSA-wrong"; },
    (value) => { value.emulatorProofBinding.proofRunnerGitBlob = "bad"; },
    (value) => { value.nonceRecord.proofRunnerGitBlob = "1".repeat(40); },
    (value) => { value.nonceRecord.pinnedGitAdapterSha256 = "0".repeat(64); },
    (value) => { value.nonceRecord.gitDiffCommandContract.args.pop(); },
  ]) {
    const invalid = structuredClone(receipt);
    mutate(invalid);
    assert.throws(
      () => validateEmulatorReceiptForTesting(
        invalid,
        binding,
        confirmationText,
      ),
      /CONFIRMED_CHALLENGE_BOUND_EMULATOR_V2_RECEIPT_REQUIRED/u,
    );
  }
});

test("S to T to U to V to W to E chain accepts exact ordered commits", async (t) => {
  const root = await createHermeticRepository();
  t.after(() => rm(root, { recursive: true, force: true }));
  const commitS = git(root, ["rev-parse", "HEAD"]);
  const commitTPath = "scripts/proof-tool-t.mjs";
  await writeRepositoryFile(root, commitTPath, "export const proofT = true;\n");
  const commitT = commitAll(root, "proof tool T");
  const securityPath = "release/provider-security-remediation.json";
  await writeRepositoryFile(root, securityPath, "{\"patched\":true}\n");
  const commitU = commitAll(root, "security remediation U");
  const proofOriginPath = "scripts/proof-origin-v.mjs";
  await writeRepositoryFile(root, proofOriginPath, "export const proofV = true;\n");
  const commitV = commitAll(root, "proof origin V");
  const proofToolPath = "scripts/pinned-git-w.mjs";
  await writeRepositoryFile(root, proofToolPath, "export const proofW = true;\n");
  const commitW = commitAll(root, "pinned git compatibility W");
  const orderedCommitChain = [commitS, commitT, commitU, commitV, commitW];
  const proofToolCommitChain = [commitT, commitU, commitV, commitW];
  const proofOriginChangePaths = [proofOriginPath];
  const proofToolChangePaths = [proofToolPath];
  await writeRepositoryFile(root, EMULATOR_PROOF_PATH, "proof\n");
  await writeRepositoryFile(root, emulatorReceiptPath, "receipt\n");
  const evidenceCommit = commitAll(root, "direct evidence");

  const common = {
    repositoryRoot: root,
    commitS,
    commitT,
    commitU,
    commitV,
    commitW,
    orderedCommitChain,
    proofToolCommit: commitW,
    proofToolCommitChain,
    proofOriginChangePaths,
    proofToolChangePaths,
    emulatorEvidencePaths: [EMULATOR_PROOF_PATH, emulatorReceiptPath],
  };
  assert.deepEqual(
    validateDirectEmulatorEvidenceCommitChainForTesting({
      ...common,
      headCommit: evidenceCommit,
    }),
    {
      commitT,
      commitU,
      commitV,
      commitW,
      orderedCommitChain,
      proofToolCommit: commitW,
      proofToolCommitChain,
      emulatorEvidenceCommit: evidenceCommit,
      additionalEvidenceCommit: null,
    },
  );

  const previewReceiptPath =
    "release/wp13-12b/receipts/actual/protected-preview.json";
  await writeRepositoryFile(root, previewReceiptPath, "preview\n");
  const previewEvidenceCommit = commitAll(root, "preview evidence");
  assert.deepEqual(
    validateDirectEmulatorEvidenceCommitChainForTesting({
      ...common,
      headCommit: previewEvidenceCommit,
      additionalEvidencePaths: [previewReceiptPath],
    }),
    {
      commitT,
      commitU,
      commitV,
      commitW,
      orderedCommitChain,
      proofToolCommit: commitW,
      proofToolCommitChain,
      emulatorEvidenceCommit: evidenceCommit,
      additionalEvidenceCommit: previewEvidenceCommit,
    },
  );

  for (const [invalidOrdered, invalidTool] of [
    [[commitS, commitT, commitU, commitW, commitV], proofToolCommitChain],
    [orderedCommitChain, [commitT, commitU, commitW, commitV]],
    [[commitS, commitT, commitU, commitV], proofToolCommitChain],
    [orderedCommitChain, [commitT, commitU, commitV]],
  ]) {
    assert.throws(
      () => validateDirectEmulatorEvidenceCommitChainForTesting({
        ...common,
        orderedCommitChain: invalidOrdered,
        proofToolCommitChain: invalidTool,
        headCommit: evidenceCommit,
      }),
      /EMULATOR_EVIDENCE_COMMIT_CHAIN_INVALID/u,
    );
  }
});

test("S to T to U to V to W chain rejects every non-direct edge", async (t) => {
  const commitTPath = "scripts/proof-tool-t.mjs";
  const securityPath = "release/provider-security-remediation.json";
  const proofOriginPath = "scripts/proof-origin-v.mjs";
  const proofToolPath = "scripts/pinned-git-w.mjs";

  async function buildChain(intermediaryBefore) {
    const root = await createHermeticRepository();
    t.after(() => rm(root, { recursive: true, force: true }));
    const commitS = git(root, ["rev-parse", "HEAD"]);
    await writeRepositoryFile(root, commitTPath, "export const proofT = true;\n");
    const commitT = commitAll(root, "proof tool T");
    if (intermediaryBefore === "U") {
      await writeRepositoryFile(root, "intermediary-u.txt", "forbidden\n");
      commitAll(root, "intermediary before U");
    }
    await writeRepositoryFile(root, securityPath, "{\"patched\":true}\n");
    const commitU = commitAll(root, "security remediation U");
    if (intermediaryBefore === "V") {
      await writeRepositoryFile(root, "intermediary-v.txt", "forbidden\n");
      commitAll(root, "intermediary before V");
    }
    await writeRepositoryFile(root, proofOriginPath, "export const proofV = true;\n");
    const commitV = commitAll(root, "proof origin V");
    if (intermediaryBefore === "W") {
      await writeRepositoryFile(root, "intermediary-w.txt", "forbidden\n");
      commitAll(root, "intermediary before W");
    }
    await writeRepositoryFile(root, proofToolPath, "export const proofW = true;\n");
    const commitW = commitAll(root, "pinned git compatibility W");
    await writeRepositoryFile(root, EMULATOR_PROOF_PATH, "proof\n");
    await writeRepositoryFile(root, emulatorReceiptPath, "receipt\n");
    const headCommit = commitAll(root, "evidence");
    return {
      repositoryRoot: root,
      commitS,
      commitT,
      commitU,
      commitV,
      commitW,
      orderedCommitChain: [commitS, commitT, commitU, commitV, commitW],
      proofToolCommit: commitW,
      proofToolCommitChain: [commitT, commitU, commitV, commitW],
      headCommit,
      proofOriginChangePaths: [proofOriginPath],
      proofToolChangePaths: [proofToolPath],
      emulatorEvidencePaths: [EMULATOR_PROOF_PATH, emulatorReceiptPath],
    };
  }

  for (const [edge, expectedError] of [
    ["U", /COMMIT_U_NOT_DIRECT_CHILD_OF_COMMIT_T/u],
    ["V", /COMMIT_V_NOT_DIRECT_CHILD_OF_COMMIT_U/u],
    ["W", /COMMIT_W_NOT_DIRECT_CHILD_OF_COMMIT_V/u],
  ]) {
    const chain = await buildChain(edge);
    assert.throws(
      () => validateDirectEmulatorEvidenceCommitChainForTesting(chain),
      expectedError,
    );
  }
});

test("U to V, V to W, and W to evidence allowlists reject drift", async (t) => {
  const commitTPath = "scripts/proof-tool-t.mjs";
  const securityPath = "release/provider-security-remediation.json";
  const proofOriginPath = "scripts/proof-origin-v.mjs";
  const proofToolPath = "scripts/pinned-git-w.mjs";

  async function buildDriftChain(driftAt) {
    const root = await createHermeticRepository();
    t.after(() => rm(root, { recursive: true, force: true }));
    const commitS = git(root, ["rev-parse", "HEAD"]);
    await writeRepositoryFile(root, commitTPath, "export const proofT = true;\n");
    const commitT = commitAll(root, "proof tool T");
    await writeRepositoryFile(root, securityPath, "{\"patched\":true}\n");
    const commitU = commitAll(root, "security remediation U");
    await writeRepositoryFile(root, proofOriginPath, "export const proofV = true;\n");
    if (driftAt === "V") {
      await writeRepositoryFile(root, "unexpected-origin.txt", "origin drift\n");
    }
    const commitV = commitAll(root, "proof origin V");
    await writeRepositoryFile(root, proofToolPath, "export const proofW = true;\n");
    if (driftAt === "W") {
      await writeRepositoryFile(root, "unexpected-tool.txt", "tool drift\n");
    }
    const commitW = commitAll(root, "pinned git compatibility W");
    await writeRepositoryFile(root, EMULATOR_PROOF_PATH, "proof\n");
    await writeRepositoryFile(root, emulatorReceiptPath, "receipt\n");
    if (driftAt === "E") {
      await writeRepositoryFile(root, "unexpected-evidence.txt", "evidence drift\n");
    }
    const headCommit = commitAll(root, "evidence");
    return {
      repositoryRoot: root,
      commitS,
      commitT,
      commitU,
      commitV,
      commitW,
      orderedCommitChain: [commitS, commitT, commitU, commitV, commitW],
      proofToolCommit: commitW,
      proofToolCommitChain: [commitT, commitU, commitV, commitW],
      headCommit,
      proofOriginChangePaths: [proofOriginPath],
      proofToolChangePaths: [proofToolPath],
      emulatorEvidencePaths: [EMULATOR_PROOF_PATH, emulatorReceiptPath],
    };
  }

  for (const point of ["V", "W", "E"]) {
    const chain = await buildDriftChain(point);
    assert.throws(
      () => validateDirectEmulatorEvidenceCommitChainForTesting(chain),
      /CODE_DRIFT_AFTER_EMULATOR_PROOF_FORBIDDEN/u,
    );
  }
});
