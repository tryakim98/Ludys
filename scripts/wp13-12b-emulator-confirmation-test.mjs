import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  assertEmulatorBindingSourceBytes,
  assertEmulatorConfirmationRecordPrecondition,
  assertEmulatorProofSourcePrecondition,
  buildChallengeBoundEmulatorReceipt,
  buildEmulatorConfirmationText,
  buildSyntheticEmulatorOriginContract,
  COMMIT_S_SHA,
  COMMIT_S_TREE,
  COMMIT_T_SHA,
  COMMIT_T_TREE,
  COMMIT_U_SHA,
  COMMIT_U_TREE,
  COMMIT_V_SHA,
  COMMIT_V_TREE,
  EMULATOR_CHALLENGE_SCHEMA,
  EMULATOR_DEMO_PROJECT_ID,
  EMULATOR_PROOF_PATH,
  EMULATOR_PR3_PURPOSE,
  PREVIEW_SOURCE_SET_SHA256,
  PINNED_GIT_ADAPTER_GIT_BLOB,
  PINNED_GIT_ADAPTER_SHA256,
  PINNED_GIT_COMPATIBILITY_EXPECTED_CHANGE_PATHS,
  PROOF_ORIGIN_EXPECTED_CHANGE_PATHS,
  REQUIRED_EMULATOR_PROOF_RESULTS,
  SECURITY_REMEDIATION_CHANGE_SET_SHA256,
  SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS,
  validateEmulatorProofArtifact,
} from "./wp13-12b-emulator-confirmation.mjs";

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
  await writeFile(target, contents);
}

async function createHermeticSourceRepository() {
  const root = await mkdtemp(join(tmpdir(), "ludys-emulator-source-"));
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "emulator-proof-test@example.invalid"]);
  git(root, ["config", "user.name", "Emulator Proof Test"]);
  await writeRepositoryFile(root, "baseline.txt", "source\n");
  git(root, ["add", "--all"]);
  git(root, ["commit", "--quiet", "-m", "source"]);
  return root;
}

function proofFixture() {
  const proofRunId = "9".repeat(32);
  const proofToolCommit = "a".repeat(40);
  const proofToolTree = "b".repeat(40);
  const proofRunnerSha256 = "8".repeat(64);
  const proofRunnerGitBlob = "e".repeat(40);
  const ownerDecisionSha256 = "5".repeat(64);
  const providerPackageSha256 = "6".repeat(64);
  const providerLockSha256 = "a".repeat(64);
  const providerSbomSha256 = "b".repeat(64);
  const providerAuditSha256 = "d".repeat(64);
  const providerSecurityRemediationSha256 = "9".repeat(64);
  const activationPackageSha256 = "4".repeat(64);
  const receiptContractSha256 = "7".repeat(64);
  const gitDiffCommandContract = {
    schemaVersion: "wp13.12b-pinned-git-diff-contract-v1",
    command: "git diff",
    arguments: [
      "--name-only",
      "--no-renames",
      "-z",
      COMMIT_T_SHA,
      COMMIT_U_SHA,
      "--",
    ],
    output: "UTF8_NUL_TERMINATED_REPOSITORY_RELATIVE_POSIX_PATHS",
    renameDetection: "DISABLED",
  };
  const securityRemediationChangeRecords =
    SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS.map((path) => ({
      path,
      changeType:
        path === "release/wp13-12b/provider-security-remediation.json"
          ? "A"
          : "M",
    }));
  return {
    schemaVersion: "wp13.12b-actual-emulator-proof-v2",
    status:
      "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_AWAITING_HUMAN_CONFIRMATION",
    proofRunId,
    startedAt: "2026-07-27T11:50:00.000Z",
    completedAt: "2026-07-27T11:59:00.000Z",
    workingTreeDirty: false,
    cloudResourcesCreated: 0,
    cloudWrites: 0,
    providerLoginCount: 0,
    deploymentCountDuringProof: 0,
    iamChangeCount: 0,
    syntheticDataDeleted: true,
    realParticipantData: false,
    sourceCommit: proofToolCommit,
    sourceTree: proofToolTree,
    commitS: COMMIT_S_SHA,
    commitSTree: COMMIT_S_TREE,
    commitT: COMMIT_T_SHA,
    commitTTree: COMMIT_T_TREE,
    commitU: COMMIT_U_SHA,
    commitUTree: COMMIT_U_TREE,
    commitV: COMMIT_V_SHA,
    commitVTree: COMMIT_V_TREE,
    commitW: proofToolCommit,
    commitWTree: proofToolTree,
    orderedCommitChain: [
      COMMIT_S_SHA,
      COMMIT_T_SHA,
      COMMIT_U_SHA,
      COMMIT_V_SHA,
      proofToolCommit,
    ],
    proofOriginCommit: COMMIT_V_SHA,
    proofOriginTree: COMMIT_V_TREE,
    proofToolCommitChain: [
      COMMIT_T_SHA,
      COMMIT_U_SHA,
      COMMIT_V_SHA,
      proofToolCommit,
    ],
    proofToolCommit,
    proofToolTree,
    securityRemediationCommit: COMMIT_U_SHA,
    securityRemediationTree: COMMIT_U_TREE,
    providerSecurityRemediationCommit: COMMIT_U_SHA,
    providerPackageCommit: COMMIT_U_SHA,
    providerPackageLockCommit: COMMIT_U_SHA,
    providerSbomCommit: COMMIT_U_SHA,
    providerAuditCommit: COMMIT_U_SHA,
    securityRemediationChangePaths: [
      ...SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS,
    ],
    securityRemediationChangeRecords,
    securityRemediationChangeSetSha256:
      SECURITY_REMEDIATION_CHANGE_SET_SHA256,
    gitDiffCommandContract,
    proofOriginChangePaths: [...PROOF_ORIGIN_EXPECTED_CHANGE_PATHS],
    proofToolChangePaths: [
      ...PINNED_GIT_COMPATIBILITY_EXPECTED_CHANGE_PATHS,
    ],
    proofRunnerSha256,
    proofRunnerGitBlob,
    pinnedGitAdapterSha256: PINNED_GIT_ADAPTER_SHA256,
    pinnedGitAdapterGitBlob: PINNED_GIT_ADAPTER_GIT_BLOB,
    previewSourceSetSha256: PREVIEW_SOURCE_SET_SHA256,
    providerLockSha256,
    providerSbomSha256,
    providerAuditSha256,
    providerSecurityRemediationSha256,
    resolvedFastUriVersion: "3.1.5",
    advisory: "GHSA-7p8r-x3mc-p8w7",
    originContract: buildSyntheticEmulatorOriginContract(proofRunId),
    transportContract: {
      schemaVersion: "wp13.12b-loopback-emulator-transport-v1",
      firestoreEmulatorBaseUrl: "http://127.0.0.1:8088",
      functionsEmulatorBaseUrl: "http://127.0.0.1:5008",
      requestOrigins: [
        "http://127.0.0.1:8088",
        "http://127.0.0.1:5008",
      ],
      declaredOriginContactAttempts: 0,
      externalNetworkCalls: 0,
      nodeNetworkGuardInitializedProcessCount: 3,
      nodeNetworkGuardObservedRoles: [
        "FIREBASE_CLI",
        "FUNCTIONS_WORKER",
        "INNER_PROOF_RUNNER",
      ],
      networkObservationScope:
        "REPOSITORY_FETCH_GUARD_INHERITED_NODE_NETWORK_GUARD_AND_EXACT_EMULATOR_CONFIGURATION",
    },
    externalNetworkCalls: 0,
    environment: {
      operatingSystem: "Windows 11 x64",
      node: "v22.17.0",
      java: "openjdk 21",
      firebaseCli: "15.22.4",
      firestoreEmulator: "1.21.0",
      demoProjectId: EMULATOR_DEMO_PROJECT_ID,
      runtimePhase: "LOCAL_EMULATOR_PROOF",
      localEmulatorMode: true,
      offlineMode: true,
      firestoreEmulatorHost: "127.0.0.1:8088",
      functionsEmulatorHost: "127.0.0.1:5008",
    },
    artifact: {
      filename: "cloud-firestore-emulator-v1.21.0.jar",
      bytes: 123456,
      sha256: "c".repeat(64),
      downloadMethod: "firebase setup:emulators:firestore",
    },
    repositoryHashes: {
      packageLock: "e".repeat(64),
      providerPackageLock: "f".repeat(64),
      firebaseConfig: "1".repeat(64),
      functionsManifest: "2".repeat(64),
      firestoreRules: "3".repeat(64),
      externalActivationAuthorityManifest: "4".repeat(64),
    },
    hashBindings: {
      ownerDecision: {
        path:
          "release/wp13-12b/external-activation/owner-authorization.json",
        sha256: ownerDecisionSha256,
        commit: COMMIT_S_SHA,
      },
      providerSecurityRemediation: {
        path: "release/wp13-12b/provider-security-remediation.json",
        sha256: providerSecurityRemediationSha256,
        commit: COMMIT_U_SHA,
      },
      providerPackage: {
        path: "artifacts/wp13-12b-provider-package.json",
        sha256: providerPackageSha256,
        commit: COMMIT_U_SHA,
      },
      providerPackageLock: {
        path: "provider/firebase/functions/package-lock.json",
        sha256: providerLockSha256,
        commit: COMMIT_U_SHA,
      },
      providerSbom: {
        path: "release/wp13-12b/provider-sbom.cdx.json",
        sha256: providerSbomSha256,
        commit: COMMIT_U_SHA,
      },
      providerAudit: {
        path: "release/wp13-12b/provider-audit.json",
        sha256: providerAuditSha256,
        commit: COMMIT_U_SHA,
      },
      activationPackage: {
        path:
          "release/wp13-12b/external-activation/artifact-checksums.sha256",
        sha256: activationPackageSha256,
        commit: proofToolCommit,
      },
      receiptContract: {
        path:
          "release/wp13-12b/activation-handoff/receipt-contracts.json",
        sha256: receiptContractSha256,
        commit: proofToolCommit,
      },
      proofRunner: {
        path: "scripts/run-wp13-12b-emulator-proof.mjs",
        sha256: proofRunnerSha256,
        gitBlob: proofRunnerGitBlob,
        commit: proofToolCommit,
      },
    },
    confirmationChallenge: {
      schemaVersion: EMULATOR_CHALLENGE_SCHEMA,
      status: "GENERATED_PENDING_OWNER_CONFIRMATION",
      recordStatus: "DRAFT_PENDING_OWNER_CONFIRMATION",
      evidenceStatus: "NOT_EVIDENCE",
      vercelLoginAuthorizationStatus:
        "NOT_AUTHORIZATION_FOR_VERCEL_LOGIN",
      deploymentAuthorizationStatus:
        "NOT_AUTHORIZATION_FOR_DEPLOYMENT",
      externalDeletionAuthorizationStatus:
        "NOT_AUTHORIZATION_FOR_EXTERNAL_DELETION",
      realDataAuthorizationStatus: "NOT_AUTHORIZATION_FOR_REAL_DATA",
      studentBetaAuthorizationStatus:
        "NOT_AUTHORIZATION_FOR_STUDENT_BETA",
      productionAuthorizationStatus:
        "NOT_AUTHORIZATION_FOR_PRODUCTION",
      generation: 1,
      purpose: EMULATOR_PR3_PURPOSE,
      nonce: "d".repeat(32),
      generatedAt: "2026-07-27T12:00:00.000Z",
      expiresAt: "2026-07-27T12:30:00.000Z",
      commitS: COMMIT_S_SHA,
      commitSTree: COMMIT_S_TREE,
      commitT: COMMIT_T_SHA,
      commitTTree: COMMIT_T_TREE,
      commitU: COMMIT_U_SHA,
      commitUTree: COMMIT_U_TREE,
      commitV: COMMIT_V_SHA,
      commitVTree: COMMIT_V_TREE,
      commitW: proofToolCommit,
      commitWTree: proofToolTree,
      orderedCommitChain: [
        COMMIT_S_SHA,
        COMMIT_T_SHA,
        COMMIT_U_SHA,
        COMMIT_V_SHA,
        proofToolCommit,
      ],
      sourceCommit: proofToolCommit,
      sourceTree: proofToolTree,
      proofOriginCommit: COMMIT_V_SHA,
      proofOriginTree: COMMIT_V_TREE,
      proofToolCommitChain: [
        COMMIT_T_SHA,
        COMMIT_U_SHA,
        COMMIT_V_SHA,
        proofToolCommit,
      ],
      proofToolCommit,
      proofToolTree,
      securityRemediationCommit: COMMIT_U_SHA,
      securityRemediationTree: COMMIT_U_TREE,
      providerSecurityRemediationCommit: COMMIT_U_SHA,
      providerPackageCommit: COMMIT_U_SHA,
      providerPackageLockCommit: COMMIT_U_SHA,
      providerSbomCommit: COMMIT_U_SHA,
      providerAuditCommit: COMMIT_U_SHA,
      proofRunnerSha256,
      proofRunnerGitBlob,
      pinnedGitAdapterSha256: PINNED_GIT_ADAPTER_SHA256,
      pinnedGitAdapterGitBlob: PINNED_GIT_ADAPTER_GIT_BLOB,
      securityRemediationChangeSetSha256:
        SECURITY_REMEDIATION_CHANGE_SET_SHA256,
      gitDiffCommandContract,
      previewSourceSetSha256: PREVIEW_SOURCE_SET_SHA256,
      ownerDecisionSha256,
      providerPackageSha256,
      providerLockSha256,
      providerSbomSha256,
      providerAuditSha256,
      providerSecurityRemediationSha256,
      resolvedFastUriVersion: "3.1.5",
      advisory: "GHSA-7p8r-x3mc-p8w7",
      activationPackageSha256,
      receiptContractSha256,
      cloudResourceCount: 8,
      deploymentCount: 0,
      validatedReceiptCount: 0,
    },
    currentExternalState: {
      resourceInventoryStatus: "AUTHENTIC_PROVIDER_SNAPSHOT",
      cloudResourceCount: 8,
      deploymentCount: 0,
      validatedReceiptCount: 0,
      blockers: [],
    },
    controlStates: {
      initial: {
        serviceHealth: "READY_DISABLED_BY_DEFAULT",
        stagingEnabled: false,
        controlEpoch: 1,
        controlDocumentExists: false,
      },
      enabled: {
        serviceHealth: "READY",
        stagingEnabled: true,
        controlEpoch: 2,
        reasonCode: `LOCAL_PROOF_${"9".repeat(16)}`,
      },
      final: {
        serviceHealth: "READY_DISABLED_BY_DEFAULT",
        stagingEnabled: false,
        controlEpoch: 1,
        controlDocumentExists: false,
      },
    },
    cleanupResult: {
      status: "PASS",
      sessionsRemaining: 0,
      capabilityGrantsRemaining: 0,
      emulatorProcessesRemaining: 0,
      temporaryFilesRemaining: 0,
      tombstonesVerifiedBeforeClear: true,
      cloudWrites: 0,
      externalNetworkCalls: 0,
    },
    roleDenialResult: {
      status: "PASS",
      denialClass: "ROLE_COMMAND_DENIED",
      authoritativeStateUnchanged: true,
      stateVersionUnchanged: true,
      audioStarted: false,
    },
    receiptDraft: {
      status: "DRAFT_PENDING_OWNER_NONCE_CONFIRMATION",
      validationStatus: "NOT_YET_VALIDATED_RECEIPT",
      activationStatus: "NOT_EXTERNAL_ACTIVATION_RECEIPT",
      humanConfirmationPresent: false,
      nonceGenerationBlockedBy: [],
    },
    commandsRun: [
      "firebase setup:emulators:firestore",
      "npm run provider:emulator:import -- "
        + "--artifact cloud-firestore-emulator-v1.21.0.jar "
        + `--sha256 ${"c".repeat(64)}`,
      "npm run provider:emulator:proof -- --authorized-local-emulator-proof",
      "firebase emulators:exec --only firestore,functions "
        + `--project ${EMULATOR_DEMO_PROJECT_ID}`,
    ],
    proofResults: Object.fromEntries(
      REQUIRED_EMULATOR_PROOF_RESULTS.map((name) => [name, true]),
    ),
    limitations: ["Synthetic local proof only."],
  };
}

test("emulator confirmation is bound to every immutable challenge field", () => {
  const proof = proofFixture();
  const proofBytes = Buffer.from(JSON.stringify(proof));
  const confirmation = buildEmulatorConfirmationText(proof, proofBytes);
  const proofSha256 = createHash("sha256").update(proofBytes).digest("hex");
  assert.equal(
    confirmation,
    "BEKREFT_WP13_12B_V2_NONCE; "
      + `nonce=${"d".repeat(32)}; `
      + `commitS=${COMMIT_S_SHA}; `
      + `commitSTree=${COMMIT_S_TREE}; `
      + `commitT=${COMMIT_T_SHA}; `
      + `commitTTree=${COMMIT_T_TREE}; `
      + `commitU=${COMMIT_U_SHA}; `
      + `commitUTree=${COMMIT_U_TREE}; `
      + `commitV=${COMMIT_V_SHA}; `
      + `commitVTree=${COMMIT_V_TREE}; `
      + `commitW=${"a".repeat(40)}; `
      + `commitWTree=${"b".repeat(40)}; `
      + `orderedCommitChain=${COMMIT_S_SHA},${COMMIT_T_SHA},`
      + `${COMMIT_U_SHA},${COMMIT_V_SHA},${"a".repeat(40)}; `
      + `proofOriginCommit=${COMMIT_V_SHA}; `
      + `proofOriginTree=${COMMIT_V_TREE}; `
      + `proofToolCommitChain=${COMMIT_T_SHA},${COMMIT_U_SHA},`
      + `${COMMIT_V_SHA},${"a".repeat(40)}; `
      + `proofToolCommit=${"a".repeat(40)}; `
      + `proofToolTree=${"b".repeat(40)}; `
      + `securityRemediationCommit=${COMMIT_U_SHA}; `
      + `securityRemediationTree=${COMMIT_U_TREE}; `
      + `providerSecurityRemediationCommit=${COMMIT_U_SHA}; `
      + `providerPackageCommit=${COMMIT_U_SHA}; `
      + `providerPackageLockCommit=${COMMIT_U_SHA}; `
      + `providerSbomCommit=${COMMIT_U_SHA}; `
      + `providerAuditCommit=${COMMIT_U_SHA}; `
      + `proofRunnerSha256=${"8".repeat(64)}; `
      + `proofRunnerGitBlob=${"e".repeat(40)}; `
      + `pinnedGitAdapterSha256=${PINNED_GIT_ADAPTER_SHA256}; `
      + `pinnedGitAdapterGitBlob=${PINNED_GIT_ADAPTER_GIT_BLOB}; `
      + `securityRemediationChangeSetSha256=${SECURITY_REMEDIATION_CHANGE_SET_SHA256}; `
      + `previewSourceSetSha256=${PREVIEW_SOURCE_SET_SHA256}; `
      + `freshEmulatorProofSha256=${proofSha256}; `
      + `ownerDecisionSha256=${"5".repeat(64)}; `
      + `providerSecurityRemediationSha256=${"9".repeat(64)}; `
      + `providerPackageSha256=${"6".repeat(64)}; `
      + `providerLockSha256=${"a".repeat(64)}; `
      + `providerSbomSha256=${"b".repeat(64)}; `
      + `providerAuditSha256=${"d".repeat(64)}; `
      + "resolvedFastUriVersion=3.1.5; "
      + "advisory=GHSA-7p8r-x3mc-p8w7; "
      + `activationPackageSha256=${"4".repeat(64)}; `
      + `receiptContractSha256=${"7".repeat(64)}; `
      + "generatedAt=2026-07-27T12:00:00.000Z; "
      + "expiresAt=2026-07-27T12:30:00.000Z; "
      + "cloudResourceCount=8; deploymentCount=0; "
      + "validatedReceiptCount=0; "
      + `purpose=${EMULATOR_PR3_PURPOSE}; `
      + `jarSha256=${"c".repeat(64)}; `
      + `demoProjectId=${EMULATOR_DEMO_PROJECT_ID}`,
  );
});

test("exact challenge records a v2 receipt and a replayed token is rejected", () => {
  const proof = proofFixture();
  const materials = {
    ownerAuthorizationBytes: Buffer.from("owner"),
    providerSecurityRemediationBytes: Buffer.from("provider-remediation"),
    providerPackageBytes: Buffer.from("provider"),
    providerPackageLockBytes: Buffer.from("provider-lock"),
    providerSbomBytes: Buffer.from("provider-sbom"),
    providerAuditBytes: Buffer.from("provider-audit"),
    activationPackageBytes: Buffer.from("activation"),
    receiptContractBytes: Buffer.from("receipt-contract"),
    proofRunnerBytes: Buffer.from("proof-runner"),
    firestoreRulesBytes: Buffer.from("rules"),
  };
  const digest = (bytes) =>
    createHash("sha256").update(bytes).digest("hex");
  const gitBlobObjectId = (bytes) => createHash("sha1")
    .update(`blob ${bytes.byteLength}\0`, "utf8")
    .update(bytes)
    .digest("hex");
  proof.hashBindings.ownerDecision.sha256 =
    digest(materials.ownerAuthorizationBytes);
  proof.hashBindings.providerSecurityRemediation.sha256 =
    digest(materials.providerSecurityRemediationBytes);
  proof.hashBindings.providerPackage.sha256 =
    digest(materials.providerPackageBytes);
  proof.hashBindings.providerPackageLock.sha256 =
    digest(materials.providerPackageLockBytes);
  proof.hashBindings.providerSbom.sha256 =
    digest(materials.providerSbomBytes);
  proof.hashBindings.providerAudit.sha256 =
    digest(materials.providerAuditBytes);
  proof.hashBindings.activationPackage.sha256 =
    digest(materials.activationPackageBytes);
  proof.hashBindings.receiptContract.sha256 =
    digest(materials.receiptContractBytes);
  proof.proofRunnerSha256 = digest(materials.proofRunnerBytes);
  proof.proofRunnerGitBlob = gitBlobObjectId(materials.proofRunnerBytes);
  proof.hashBindings.proofRunner.sha256 = proof.proofRunnerSha256;
  proof.hashBindings.proofRunner.gitBlob = proof.proofRunnerGitBlob;
  proof.providerSecurityRemediationSha256 =
    proof.hashBindings.providerSecurityRemediation.sha256;
  proof.providerLockSha256 = proof.hashBindings.providerPackageLock.sha256;
  proof.providerSbomSha256 = proof.hashBindings.providerSbom.sha256;
  proof.providerAuditSha256 = proof.hashBindings.providerAudit.sha256;
  proof.repositoryHashes.firestoreRules =
    digest(materials.firestoreRulesBytes);
  proof.repositoryHashes.externalActivationAuthorityManifest =
    proof.hashBindings.activationPackage.sha256;
  Object.assign(proof.confirmationChallenge, {
    proofRunnerSha256: proof.proofRunnerSha256,
    proofRunnerGitBlob: proof.proofRunnerGitBlob,
    ownerDecisionSha256:
      proof.hashBindings.ownerDecision.sha256,
    providerSecurityRemediationSha256:
      proof.hashBindings.providerSecurityRemediation.sha256,
    providerPackageSha256:
      proof.hashBindings.providerPackage.sha256,
    providerLockSha256:
      proof.hashBindings.providerPackageLock.sha256,
    providerSbomSha256:
      proof.hashBindings.providerSbom.sha256,
    providerAuditSha256:
      proof.hashBindings.providerAudit.sha256,
    activationPackageSha256:
      proof.hashBindings.activationPackage.sha256,
    receiptContractSha256:
      proof.hashBindings.receiptContract.sha256,
  });
  const proofBytes = Buffer.from(JSON.stringify(proof));
  const confirmationText = buildEmulatorConfirmationText(proof, proofBytes);
  const receipt = buildChallengeBoundEmulatorReceipt({
    proof,
    proofBytes,
    confirmationText,
    ...materials,
    confirmedAt: "2026-07-27T12:15:00.000Z",
  });
  assert.equal(receipt.schemaVersion, "wp13.12b-receipt-v2");
  assert.equal(receipt.nonceRecord.commitS, COMMIT_S_SHA);
  assert.equal(receipt.nonceRecord.commitSTree, COMMIT_S_TREE);
  assert.equal(receipt.nonceRecord.commitT, COMMIT_T_SHA);
  assert.equal(receipt.nonceRecord.commitTTree, COMMIT_T_TREE);
  assert.equal(receipt.nonceRecord.commitU, COMMIT_U_SHA);
  assert.equal(receipt.nonceRecord.commitUTree, COMMIT_U_TREE);
  assert.equal(receipt.nonceRecord.commitV, COMMIT_V_SHA);
  assert.equal(receipt.nonceRecord.commitVTree, COMMIT_V_TREE);
  assert.equal(receipt.nonceRecord.commitW, proof.sourceCommit);
  assert.equal(receipt.nonceRecord.commitWTree, proof.sourceTree);
  assert.deepEqual(
    receipt.nonceRecord.orderedCommitChain,
    [
      COMMIT_S_SHA,
      COMMIT_T_SHA,
      COMMIT_U_SHA,
      COMMIT_V_SHA,
      proof.sourceCommit,
    ],
  );
  assert.deepEqual(
    receipt.nonceRecord.proofToolCommitChain,
    [COMMIT_T_SHA, COMMIT_U_SHA, COMMIT_V_SHA, proof.sourceCommit],
  );
  assert.equal(
    receipt.nonceRecord.proofRunnerSha256,
    proof.proofRunnerSha256,
  );
  assert.equal(
    receipt.nonceRecord.proofRunnerGitBlob,
    proof.proofRunnerGitBlob,
  );
  assert.equal(
    receipt.nonceRecord.previewSourceSetSha256,
    PREVIEW_SOURCE_SET_SHA256,
  );
  assert.equal(
    receipt.nonceRecord.freshEmulatorProofSha256,
    digest(proofBytes),
  );
  assert.equal(
    receipt.nonceRecord.ownerDecisionSha256,
    proof.hashBindings.ownerDecision.sha256,
  );
  assert.equal(
    receipt.nonceRecord.providerSecurityRemediationSha256,
    proof.hashBindings.providerSecurityRemediation.sha256,
  );
  assert.equal(
    receipt.nonceRecord.providerPackageSha256,
    proof.hashBindings.providerPackage.sha256,
  );
  assert.equal(
    receipt.nonceRecord.providerLockSha256,
    proof.hashBindings.providerPackageLock.sha256,
  );
  assert.equal(
    receipt.nonceRecord.providerSbomSha256,
    proof.hashBindings.providerSbom.sha256,
  );
  assert.equal(
    receipt.nonceRecord.providerAuditSha256,
    proof.hashBindings.providerAudit.sha256,
  );
  assert.equal(receipt.nonceRecord.resolvedFastUriVersion, "3.1.5");
  assert.equal(receipt.nonceRecord.advisory, "GHSA-7p8r-x3mc-p8w7");
  assert.equal(
    receipt.nonceRecord.activationPackageSha256,
    proof.hashBindings.activationPackage.sha256,
  );
  assert.equal(
    receipt.nonceRecord.receiptContractSha256,
    proof.hashBindings.receiptContract.sha256,
  );
  assert.equal(
    JSON.stringify(receipt).includes(
      proof.originContract.declaredPreviewOrigin,
    ),
    false,
  );
  assert.equal(
    receipt.humanSignatureOrExplicitConfirmation.confirmationText,
    confirmationText,
  );
  assert.throws(
    () => buildChallengeBoundEmulatorReceipt({
      proof,
      proofBytes,
      confirmationText: confirmationText.replace(
        `nonce=${"d".repeat(32)}`,
        `nonce=${"e".repeat(32)}`,
      ),
      ...materials,
      confirmedAt: "2026-07-27T12:15:00.000Z",
    }),
    /MISMATCH/u,
  );
  assert.throws(
    () => buildChallengeBoundEmulatorReceipt({
      proof,
      proofBytes,
      confirmationText,
      ...materials,
      firestoreRulesBytes: Buffer.from("tampered-rules"),
      confirmedAt: "2026-07-27T12:15:00.000Z",
    }),
    /EMULATOR_FIRESTORE_RULES_BYTES_MISMATCH/u,
  );
});

test("dirty, wrong-purpose and incomplete proofs cannot produce a challenge", () => {
  for (const mutate of [
    (proof) => { proof.workingTreeDirty = true; },
    (proof) => { proof.confirmationChallenge.purpose = "OTHER"; },
    (proof) => { proof.proofResults.firestore_emulator = false; },
    (proof) => { proof.controlStates.initial.controlEpoch = 2; },
    (proof) => { proof.controlStates.initial.controlDocumentExists = true; },
    (proof) => { proof.controlStates.enabled.controlEpoch = 3; },
    (proof) => { proof.controlStates.enabled.reasonCode = "LOCAL_PROOF_OTHER"; },
    (proof) => { proof.controlStates.final.controlEpoch = 3; },
    (proof) => { proof.controlStates.final.controlDocumentExists = true; },
    (proof) => {
      proof.cleanupResult.tombstonesVerifiedBeforeClear = false;
    },
    (proof) => { delete proof.proofResults.firestore_emulator; },
    (proof) => { proof.proofResults.generic_proof_0 = true; },
    (proof) => {
      proof.proofResults = Object.fromEntries(
        Array.from({ length: 28 }, (_, index) => [`proof_${index}`, true]),
      );
    },
  ]) {
    const proof = proofFixture();
    mutate(proof);
    assert.throws(
      () => buildEmulatorConfirmationText(
        proof,
        Buffer.from(JSON.stringify(proof)),
      ),
    );
  }
});

test("10.12 rejects S-T-U-V, provider, origin, transport and runner drift", () => {
  for (const mutate of [
    (proof) => { proof.commitS = "0".repeat(40); },
    (proof) => { proof.commitSTree = "0".repeat(40); },
    (proof) => { proof.commitT = "0".repeat(40); },
    (proof) => { proof.commitTTree = "0".repeat(40); },
    (proof) => { proof.commitU = "0".repeat(40); },
    (proof) => { proof.commitUTree = "0".repeat(40); },
    (proof) => { proof.commitV = "0".repeat(40); },
    (proof) => { proof.commitVTree = "0".repeat(40); },
    (proof) => { delete proof.orderedCommitChain; },
    (proof) => { proof.orderedCommitChain.reverse(); },
    (proof) => { delete proof.proofToolCommitChain; },
    (proof) => { proof.proofToolCommitChain.reverse(); },
    (proof) => {
      proof.proofToolCommitChain = [
        COMMIT_T_SHA,
        COMMIT_T_SHA,
        proof.sourceCommit,
      ];
    },
    (proof) => { proof.sourceCommit = "0".repeat(40); },
    (proof) => { proof.sourceTree = "0".repeat(40); },
    (proof) => { proof.proofOriginCommit = "0".repeat(40); },
    (proof) => { proof.proofOriginTree = "0".repeat(40); },
    (proof) => { proof.proofToolCommit = "0".repeat(40); },
    (proof) => { proof.proofToolTree = "0".repeat(40); },
    (proof) => { proof.proofRunnerSha256 = "0".repeat(64); },
    (proof) => { proof.proofRunnerGitBlob = "0".repeat(40); },
    (proof) => { proof.previewSourceSetSha256 = "0".repeat(64); },
    (proof) => {
      proof.confirmationChallenge.proofRunnerSha256 = "0".repeat(64);
    },
    (proof) => {
      proof.confirmationChallenge.proofRunnerGitBlob = "0".repeat(40);
    },
    (proof) => {
      proof.confirmationChallenge.previewSourceSetSha256 =
        "0".repeat(64);
    },
    (proof) => { proof.confirmationChallenge.commitT = "0".repeat(40); },
    (proof) => { proof.confirmationChallenge.commitTTree = "0".repeat(40); },
    (proof) => { proof.confirmationChallenge.commitU = "0".repeat(40); },
    (proof) => { proof.confirmationChallenge.commitV = "0".repeat(40); },
    (proof) => { proof.confirmationChallenge.orderedCommitChain.reverse(); },
    (proof) => { proof.confirmationChallenge.sourceCommit = "0".repeat(40); },
    (proof) => { proof.confirmationChallenge.sourceTree = "0".repeat(40); },
    (proof) => { proof.confirmationChallenge.proofToolCommitChain.pop(); },
    (proof) => { proof.hashBindings.providerPackage.commit = COMMIT_S_SHA; },
    (proof) => { proof.hashBindings.providerPackageLock.commit = COMMIT_S_SHA; },
    (proof) => { proof.providerSecurityRemediationSha256 = "0".repeat(64); },
    (proof) => { proof.providerLockSha256 = "0".repeat(64); },
    (proof) => { proof.providerSbomSha256 = "0".repeat(64); },
    (proof) => { proof.providerAuditSha256 = "0".repeat(64); },
    (proof) => { proof.resolvedFastUriVersion = "3.1.4"; },
    (proof) => { proof.advisory = "GHSA-WRONG"; },
    (proof) => {
      proof.originContract = {
        ...proof.originContract,
        classification: "REAL_PREVIEW_ORIGIN",
      };
    },
    (proof) => {
      proof.transportContract.functionsEmulatorBaseUrl =
        "https://functions.example";
    },
    (proof) => { proof.transportContract.requestOrigins.reverse(); },
    (proof) => { proof.transportContract.declaredOriginContactAttempts = 1; },
    (proof) => { proof.transportContract.externalNetworkCalls = 1; },
    (proof) => {
      proof.transportContract.nodeNetworkGuardInitializedProcessCount = 2;
    },
    (proof) => {
      proof.transportContract.nodeNetworkGuardObservedRoles.pop();
    },
    (proof) => {
      proof.transportContract.nodeNetworkGuardObservedRoles.reverse();
    },
    (proof) => { proof.externalNetworkCalls = 1; },
    (proof) => {
      proof.receiptDraft.declaredPreviewOrigin =
        proof.originContract.declaredPreviewOrigin;
    },
    (proof) => {
      proof.hashBindings.ownerDecision.sha256 = "0".repeat(64);
    },
    (proof) => {
      proof.confirmationChallenge.cloudResourceCount += 1;
    },
  ]) {
    const proof = proofFixture();
    mutate(proof);
    assert.throws(() => buildEmulatorConfirmationText(
      proof,
      Buffer.from(JSON.stringify(proof)),
    ));
  }
});

test("generated nonce remains draft evidence with no activation authority", () => {
  for (const field of [
    "recordStatus",
    "evidenceStatus",
    "vercelLoginAuthorizationStatus",
    "deploymentAuthorizationStatus",
    "externalDeletionAuthorizationStatus",
    "realDataAuthorizationStatus",
    "studentBetaAuthorizationStatus",
    "productionAuthorizationStatus",
  ]) {
    const proof = proofFixture();
    proof.confirmationChallenge[field] = "AUTHORIZED";
    assert.throws(() => buildEmulatorConfirmationText(
      proof,
      Buffer.from(JSON.stringify(proof)),
    ));
  }
  const proof = proofFixture();
  proof.receiptDraft.activationStatus = "EXTERNAL_ACTIVATION_RECEIPT";
  assert.throws(() => buildEmulatorConfirmationText(
    proof,
    Buffer.from(JSON.stringify(proof)),
  ));
});

test("nonce generation, expiry and current counts fail closed", () => {
  for (const mutate of [
    (proof) => {
      proof.confirmationChallenge.expiresAt =
        "2026-07-27T13:00:00.001Z";
    },
    (proof) => {
      proof.confirmationChallenge.generatedAt =
        "2026-07-27T11:58:00.000Z";
    },
    (proof) => {
      proof.currentExternalState.cloudResourceCount = null;
    },
    (proof) => {
      proof.confirmationChallenge.status =
        "NOT_GENERATED_CURRENT_EXTERNAL_COUNTS_UNAVAILABLE";
      proof.confirmationChallenge.nonce = null;
    },
  ]) {
    const proof = proofFixture();
    mutate(proof);
    assert.throws(() => buildEmulatorConfirmationText(
      proof,
      Buffer.from(JSON.stringify(proof)),
    ));
  }
});

test("count-blocked proof state is explicit and internally coherent", () => {
  const blocked = proofFixture();
  blocked.status =
    "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_NONCE_BLOCKED_BY_CURRENT_EXTERNAL_COUNTS";
  blocked.currentExternalState = {
    resourceInventoryStatus: "PENDING_AUTHENTIC_PROVIDER_READBACK",
    cloudResourceCount: null,
    deploymentCount: null,
    validatedReceiptCount: 0,
    blockers: [
      "CURRENT_CLOUD_RESOURCE_COUNT_UNAVAILABLE",
      "CURRENT_DEPLOYMENT_COUNT_UNAVAILABLE",
    ],
  };
  blocked.confirmationChallenge = {
    schemaVersion: EMULATOR_CHALLENGE_SCHEMA,
    status: "NOT_GENERATED_CURRENT_EXTERNAL_COUNTS_UNAVAILABLE",
    generation: null,
    purpose: EMULATOR_PR3_PURPOSE,
    nonce: null,
    generatedAt: null,
    expiresAt: null,
    commitS: blocked.commitS,
    commitSTree: blocked.commitSTree,
    commitT: blocked.commitT,
    commitTTree: blocked.commitTTree,
    commitU: blocked.commitU,
    commitUTree: blocked.commitUTree,
    commitV: blocked.commitV,
    commitVTree: blocked.commitVTree,
    commitW: blocked.commitW,
    commitWTree: blocked.commitWTree,
    orderedCommitChain: [...blocked.orderedCommitChain],
    sourceCommit: blocked.sourceCommit,
    sourceTree: blocked.sourceTree,
    proofOriginCommit: blocked.proofOriginCommit,
    proofOriginTree: blocked.proofOriginTree,
    proofToolCommitChain: [...blocked.proofToolCommitChain],
    proofToolCommit: blocked.proofToolCommit,
    proofToolTree: blocked.proofToolTree,
    securityRemediationCommit: blocked.securityRemediationCommit,
    securityRemediationTree: blocked.securityRemediationTree,
    providerSecurityRemediationCommit:
      blocked.providerSecurityRemediationCommit,
    providerPackageCommit: blocked.providerPackageCommit,
    providerPackageLockCommit: blocked.providerPackageLockCommit,
    providerSbomCommit: blocked.providerSbomCommit,
    providerAuditCommit: blocked.providerAuditCommit,
    proofRunnerSha256: blocked.proofRunnerSha256,
    proofRunnerGitBlob: blocked.proofRunnerGitBlob,
    pinnedGitAdapterSha256: blocked.pinnedGitAdapterSha256,
    pinnedGitAdapterGitBlob: blocked.pinnedGitAdapterGitBlob,
    securityRemediationChangeSetSha256:
      blocked.securityRemediationChangeSetSha256,
    gitDiffCommandContract: structuredClone(blocked.gitDiffCommandContract),
    previewSourceSetSha256: blocked.previewSourceSetSha256,
    ownerDecisionSha256: blocked.hashBindings.ownerDecision.sha256,
    providerPackageSha256: blocked.hashBindings.providerPackage.sha256,
    providerLockSha256: blocked.hashBindings.providerPackageLock.sha256,
    providerSbomSha256: blocked.hashBindings.providerSbom.sha256,
    providerAuditSha256: blocked.hashBindings.providerAudit.sha256,
    providerSecurityRemediationSha256:
      blocked.hashBindings.providerSecurityRemediation.sha256,
    resolvedFastUriVersion: blocked.resolvedFastUriVersion,
    advisory: blocked.advisory,
    activationPackageSha256: blocked.hashBindings.activationPackage.sha256,
    receiptContractSha256: blocked.hashBindings.receiptContract.sha256,
    blockers: [...blocked.currentExternalState.blockers],
  };
  blocked.receiptDraft.nonceGenerationBlockedBy =
    [...blocked.currentExternalState.blockers];
  assert.doesNotThrow(() => validateEmulatorProofArtifact(
    blocked,
    Buffer.from(JSON.stringify(blocked)),
  ));
  for (const mutate of [
    (proof) => { proof.confirmationChallenge.blockers.pop(); },
    (proof) => { proof.confirmationChallenge.commitT = "0".repeat(40); },
    (proof) => { proof.confirmationChallenge.proofToolCommitChain.reverse(); },
    (proof) => { proof.currentExternalState.blockers.reverse(); },
    (proof) => { proof.receiptDraft.nonceGenerationBlockedBy = []; },
    (proof) => { proof.confirmationChallenge.nonce = "d".repeat(32); },
    (proof) => {
      proof.status =
        "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_AWAITING_HUMAN_CONFIRMATION";
    },
  ]) {
    const proof = structuredClone(blocked);
    mutate(proof);
    assert.throws(() => validateEmulatorProofArtifact(
      proof,
      Buffer.from(JSON.stringify(proof)),
    ));
  }
});

test("confirmation source hashes are re-attested from committed bytes", async (t) => {
  const root = await createHermeticSourceRepository();
  t.after(() => rm(root, { recursive: true, force: true }));
  const paths = {
    owner: "release/wp13-12b/external-activation/owner-authorization.json",
    remediation: "release/wp13-12b/provider-security-remediation.json",
    provider: "artifacts/wp13-12b-provider-package.json",
    providerLock: "provider/firebase/functions/package-lock.json",
    providerSbom: "release/wp13-12b/provider-sbom.cdx.json",
    providerAudit: "release/wp13-12b/provider-audit.json",
    activation:
      "release/wp13-12b/external-activation/artifact-checksums.sha256",
    receipt: "release/wp13-12b/activation-handoff/receipt-contracts.json",
    runner: "scripts/run-wp13-12b-emulator-proof.mjs",
    rules: "provider/firebase/firestore.rules",
  };
  await writeRepositoryFile(root, paths.owner, "owner-S\n");
  await writeRepositoryFile(root, paths.provider, "legacy-provider-S\n");
  git(root, ["add", "--all"]);
  git(root, ["commit", "--quiet", "-m", "evidence anchor S"]);
  const commitS = git(root, ["rev-parse", "HEAD"]);

  for (const [path, contents] of [
    [paths.remediation, "remediation-U\n"],
    [paths.provider, "active-provider-U\n"],
    [paths.providerLock, "provider-lock-U\n"],
    [paths.providerSbom, "provider-sbom-U\n"],
    [paths.providerAudit, "provider-audit-U\n"],
  ]) await writeRepositoryFile(root, path, contents);
  git(root, ["add", "--all"]);
  git(root, ["commit", "--quiet", "-m", "security baseline U"]);
  const commitU = git(root, ["rev-parse", "HEAD"]);

  for (const [path, contents] of [
    [paths.activation, "activation-V\n"],
    [paths.receipt, "receipt-V\n"],
    [paths.runner, "runner-V\n"],
    [paths.rules, "rules-V\n"],
  ]) await writeRepositoryFile(root, path, contents);
  git(root, ["add", "--all"]);
  git(root, ["commit", "--quiet", "-m", "proof origin V"]);
  const commitV = git(root, ["rev-parse", "HEAD"]);

  const digest = async (path) => createHash("sha256")
    .update(await readFile(join(root, ...path.split("/"))))
    .digest("hex");
  const firestoreRulesSha256 = await digest(paths.rules);
  const binding = {
    commitS,
    commitU,
    proofToolCommit: commitV,
    providerSecurityRemediationCommit: commitU,
    providerPackageCommit: commitU,
    providerPackageLockCommit: commitU,
    providerSbomCommit: commitU,
    providerAuditCommit: commitU,
    ownerDecisionSha256: await digest(paths.owner),
    providerSecurityRemediationSha256: await digest(paths.remediation),
    providerPackageSha256: await digest(paths.provider),
    providerLockSha256: await digest(paths.providerLock),
    providerSbomSha256: await digest(paths.providerSbom),
    providerAuditSha256: await digest(paths.providerAudit),
    activationPackageSha256: await digest(paths.activation),
    receiptContractSha256: await digest(paths.receipt),
    proofRunnerSha256: await digest(paths.runner),
  };
  await assert.doesNotReject(() => assertEmulatorBindingSourceBytes({
    repositoryRoot: root,
    binding,
    firestoreRulesSha256,
  }));
  await assert.rejects(
    () => assertEmulatorBindingSourceBytes({
      repositoryRoot: root,
      binding: { ...binding, providerPackageCommit: commitS },
      firestoreRulesSha256,
    }),
    /EMULATOR_CONFIRMATION_SOURCE_BYTES_MISMATCH/u,
  );
  await writeRepositoryFile(root, paths.runner, "tampered\n");
  await assert.rejects(
    () => assertEmulatorBindingSourceBytes({
      repositoryRoot: root,
      binding,
      firestoreRulesSha256,
    }),
    /EMULATOR_CONFIRMATION_SOURCE_BYTES_MISMATCH/u,
  );
});

test("proof source preflight is clean and canonical-output exclusive", async (t) => {
  const root = await createHermeticSourceRepository();
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = await assertEmulatorProofSourcePrecondition(root);
  assert.equal(source.sourceCommit, git(root, ["rev-parse", "HEAD"]));
  assert.equal(source.sourceTree, git(root, ["rev-parse", "HEAD^{tree}"]));

  await writeRepositoryFile(root, "unrelated.txt", "dirty\n");
  await assert.rejects(
    () => assertEmulatorProofSourcePrecondition(root),
    /EMULATOR_PROOF_SOURCE_REPOSITORY_MUST_BE_CLEAN/u,
  );
  await rm(join(root, "unrelated.txt"));

  await writeRepositoryFile(root, EMULATOR_PROOF_PATH, "existing\n");
  await assert.rejects(
    () => assertEmulatorProofSourcePrecondition(root),
    /CANONICAL_EMULATOR_PROOF_MUST_BE_ABSENT_BEFORE_RUN/u,
  );
  git(root, ["add", "--", EMULATOR_PROOF_PATH]);
  git(root, ["commit", "--quiet", "-m", "forbidden tracked proof"]);
  await assert.rejects(
    () => assertEmulatorProofSourcePrecondition(root),
    /EMULATOR_EVIDENCE_PATH_ALREADY_TRACKED/u,
  );
});

test("confirmation record requires the exact proof-only source worktree", async (t) => {
  const root = await createHermeticSourceRepository();
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = await assertEmulatorProofSourcePrecondition(root);
  const proofBytes = Buffer.from("proof\n", "utf8");
  await writeRepositoryFile(root, EMULATOR_PROOF_PATH, proofBytes);
  const receiptPath =
    "release/wp13-12b/receipts/actual/"
    + `emulator-proof-receipt-${source.sourceCommit.slice(0, 12)}-v2.json`;
  await assert.doesNotReject(
    () => assertEmulatorConfirmationRecordPrecondition({
      repositoryRoot: root,
      sourceCommit: source.sourceCommit,
      sourceTree: source.sourceTree,
      proofBytes,
      receiptPath,
    }),
  );

  await writeRepositoryFile(root, "unrelated.txt", "dirty\n");
  await assert.rejects(
    () => assertEmulatorConfirmationRecordPrecondition({
      repositoryRoot: root,
      sourceCommit: source.sourceCommit,
      sourceTree: source.sourceTree,
      proofBytes,
      receiptPath,
    }),
    /EMULATOR_CONFIRMATION_REQUIRES_EXACT_PROOF_ONLY_WORKTREE/u,
  );
  await rm(join(root, "unrelated.txt"));
  git(root, ["add", "--", EMULATOR_PROOF_PATH]);
  await assert.rejects(
    () => assertEmulatorConfirmationRecordPrecondition({
      repositoryRoot: root,
      sourceCommit: source.sourceCommit,
      sourceTree: source.sourceTree,
      proofBytes,
      receiptPath,
    }),
    /EMULATOR_EVIDENCE_PATH_ALREADY_TRACKED/u,
  );
});

test("proof and receipt writers use exclusive fsynced evidence files", async () => {
  const runnerSource = await readFile(
    new URL("./run-wp13-12b-emulator-proof.mjs", import.meta.url),
    "utf8",
  );
  const confirmationSource = await readFile(
    new URL("./wp13-12b-emulator-confirmation.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    runnerSource,
    /outputIdentity = await writeExclusiveFsynced\(output, outputBytes\)/u,
  );
  assert.match(runnerSource, /handle = await open\(path, "wx", 0o600\)/u);
  assert.match(runnerSource, /await handle\.sync\(\)/u);
  assert.ok(
    runnerSource.indexOf("EMULATOR_PROCESS_POSTCONDITION")
      < runnerSource.indexOf(
        "outputIdentity = await writeExclusiveFsynced(output, outputBytes)",
      ),
  );
  assert.match(
    runnerSource,
    /await assertEmulatorConfirmationRecordPrecondition\(\{/u,
  );
  assert.ok(
    runnerSource.match(/await assertCommittedAuthoritySnapshot\(/gu)
      ?.length >= 3,
  );
  assert.match(
    confirmationSource,
    /receiptHandle = await open\(receiptTarget, "wx", 0o600\)/u,
  );
  assert.match(confirmationSource, /await receiptHandle\.sync\(\)/u);
  assert.match(
    confirmationSource,
    /await assertEmulatorEvidencePairPostcondition\(\{/u,
  );
  assert.match(runnerSource, /EMULATOR_PROOF_POSTWRITE_ROLLBACK_FAILED/u);
  assert.match(confirmationSource, /EMULATOR_RECEIPT_WRITE_AND_ROLLBACK_FAILED/u);
});
