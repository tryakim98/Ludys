import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  validateVercelActivationReadback,
} from "../provider/firebase/tools/operator-gate-contract.mjs";
import {
  approvedVercelCli,
  approvedVercelCliIntegritySha256,
  approvedVercelNodeVersion,
  approvedVercelUserEnvironmentKeys,
  approvedVercelUploadPaths,
  authenticatedBrowserProofMaximumAgeMilliseconds,
  authenticatedBrowserProofSchemaVersion,
  committedPreviewSourceBinding,
  createInMemoryVercelApiForTesting,
  previewSourceSha256,
  previewUploadManifest,
  repositoryReadback,
  runVercelControl as runVercelControlProduction,
  runVercelControlForTesting as runVercelControl,
  terminalReceiptRepositoryReadback,
  validateAuthenticatedBrowserProof,
  vercelScope,
} from "./provider-external-vercel-control.mjs";
import {
  boundedCapturedCliStdout,
  buildFailedPreviewCleanupPlan,
  createScriptedVercelPreviewCliForTesting,
  createScriptedVercelPreviewControlForTesting,
  createScriptedVercelProtectedProbeForTesting,
  createScriptedVercelWifReadbackForTesting,
  exactPreviewDeploymentArgs,
  inspectPinnedVercelCli,
  parseCreatedDeployment,
  returnedDeploymentIdentity,
  runVercelPreviewDeploy,
  runVercelPreviewDeployForTesting,
  validateDryRunManifest,
  validateFailedDeploymentCleanupReadback,
  verifyRollbackSafetySource,
} from "./provider-external-vercel-preview-deploy.mjs";
import {
  canonicalVercelToolchainTreeSnapshot,
  compareVercelToolchainPaths,
  verifyVercelToolchainTreeForTesting,
} from "./wp13-12b-vercel-cli-toolchain.mjs";

const repository = Object.freeze({
  commit: "a".repeat(40),
  tree: "b".repeat(40),
  workingTreeClean: true,
});
const sourceSha256 = "c".repeat(64);
const uploadManifest = Object.freeze({
  schemaVersion: "wp13.12b-vercel-upload-manifest-v1",
  sha256: "d".repeat(64),
  files: Object.freeze(approvedVercelUploadPaths.map((
    path,
    index,
  ) => Object.freeze({
    path,
    bytes: index + 1,
    sha1: index.toString(16).padStart(40, "0"),
    sha256: index.toString(16).padStart(64, "0"),
  }))),
});
const dryRunSha256 = "e".repeat(64);
const staticArtifactSha256 = "f".repeat(64);
const deploymentId = "dpl_89qyp1cskzkLrVicDaZoDbjyHuDJ";
const rollbackDeploymentId =
  "dpl_19qyp1cskzkLrVicDaZoDbjyHuDK";
const deploymentHost =
  "ludys-wp13-12b-staging-a1b2c3-trym-s-projects.vercel.app";
const deploymentOrigin = `https://${deploymentHost}`;
const rollbackHost =
  "ludys-wp13-12b-staging-r1b2c3-trym-s-projects.vercel.app";
const rollbackOrigin = `https://${rollbackHost}`;
const rollbackEvidenceSha256 = "3".repeat(64);
const evidenceCommit = "4".repeat(40);
const evidenceTree = "5".repeat(40);
const receiptPath =
  "release/wp13-12b/receipts/actual/"
  + "protected-preview-receipt-test.json";
const browserProofPath =
  "release/wp13-12b/receipts/actual/"
  + "authenticated-browser-proof-test.json";
const rollbackProofPath =
  "release/wp13-12b/receipts/actual/"
  + "rollback-safety-proof-test.json";
const receiptBytes = "{\"receipt\":\"validated\"}\n";
const browserProofBytes = "{\"browser\":\"verified\"}\n";
const rollbackProofBytes = "{\"rollback\":\"safe\"}\n";
const sha256 = (value) => createHash("sha256")
  .update(value, "utf8")
  .digest("hex");
const receiptRepositoryBinding = Object.freeze({
  sourceCommit: repository.commit,
  sourceTree: repository.tree,
  rollbackSourceCommit: repository.commit,
  rollbackSourceTree: repository.tree,
  configuredPath: receiptPath,
  configuredReceiptSha256: sha256(receiptBytes),
  integrityVerified: true,
  artifactHashes: Object.freeze({
    [browserProofPath]: sha256(browserProofBytes),
    [rollbackProofPath]: sha256(rollbackProofBytes),
  }),
});
const trust = Object.freeze({
  vercel: {
    teamId: vercelScope.teamId,
    teamSlug: vercelScope.teamSlug,
    projectId: vercelScope.projectId,
    projectName: vercelScope.projectName,
  },
  securityBoundary: {
    oidcSubjectGranularity:
      "PROJECT_AND_ENVIRONMENT_NOT_DEPLOYMENT",
    deploymentSpecificOidcSubject: false,
    newPreviewDeploymentsWhileTrustEnabled: false,
    gitLinkWhileTrustEnabled: false,
    freshExactDeploymentInventoryRequiredBeforeEveryTrustEnable:
      true,
    authenticatedBrowserProofRequiredBeforeEveryTrustEnable:
      true,
  },
});

function repositoryExec({
  head = evidenceCommit,
  headTree = evidenceTree,
  status = "",
  resolvedSourceTree = repository.tree,
  parents = [head, repository.commit],
  changedPaths = [
    receiptPath,
    browserProofPath,
    rollbackProofPath,
  ],
  files = {
    [receiptPath]: receiptBytes,
    [browserProofPath]: browserProofBytes,
    [rollbackProofPath]: rollbackProofBytes,
  },
} = {}) {
  return (command, args) => {
    assert.equal(command, "git");
    if (
      args[0] === "rev-parse"
      && args[1] === "HEAD"
    ) return `${head}\n`;
    if (
      args[0] === "rev-parse"
      && args[1] === "HEAD^{tree}"
    ) return `${headTree}\n`;
    if (
      args[0] === "rev-parse"
      && args[1] === `${repository.commit}^{tree}`
    ) return `${resolvedSourceTree}\n`;
    if (args[0] === "status") return status;
    if (args[0] === "rev-list") {
      return `${parents.join(" ")}\n`;
    }
    if (args[0] === "diff") {
      return changedPaths.length === 0
        ? ""
        : `${changedPaths.join("\0")}\0`;
    }
    if (args[0] === "show") {
      const [commitAndPath] = args.slice(1);
      const separator = commitAndPath.indexOf(":");
      const commit = commitAndPath.slice(0, separator);
      const path = commitAndPath.slice(separator + 1);
      if (commit !== head || files[path] === undefined) {
        throw new Error("missing mock Git object");
      }
      return files[path];
    }
    throw new Error(`unexpected mock Git call: ${args.join(" ")}`);
  };
}

function committedPreviewExec(sourceFiles, sourceCommit) {
  const objectBytes = new Map();
  const entries = Object.entries(sourceFiles).map(([
    path,
    bytes,
  ], index) => {
    const objectId = (index + 1).toString(16).padStart(40, "0");
    objectBytes.set(objectId, Buffer.from(bytes));
    return `100644 blob ${objectId}\t`
      + `provider/vercel/wp13-12b-preview/${path}`;
  });
  return (command, args) => {
    assert.equal(command, "git");
    if (args[0] === "ls-tree") {
      assert.equal(args[4], sourceCommit);
      return Buffer.from(`${entries.join("\0")}\0`, "utf8");
    }
    if (args[0] === "cat-file" && args[1] === "blob") {
      const bytes = objectBytes.get(args[2]);
      if (bytes === undefined) throw new Error("unknown blob");
      return bytes;
    }
    throw new Error(`unexpected mock Git call: ${args.join(" ")}`);
  };
}

function project(overrides = {}) {
  return {
    id: vercelScope.projectId,
    name: vercelScope.projectName,
    accountId: vercelScope.teamId,
    createdAt: 1,
    updatedAt: 2,
    framework: null,
    rootDirectory: null,
    buildCommand: null,
    outputDirectory: null,
    installCommand: null,
    devCommand: null,
    autoExposeSystemEnvs: true,
    nodeVersion: approvedVercelNodeVersion,
    live: false,
    link: null,
    webAnalytics: null,
    speedInsights: null,
    oidcTokenConfig: {
      enabled: true,
      issuerMode: "team",
    },
    ssoProtection: {
      deploymentType: "prod_deployment_urls_and_all_previews",
    },
    passwordProtection: null,
    trustedIps: null,
    protectionBypass: {},
    deploymentProtectionExceptions: [],
    ...overrides,
  };
}

function deploymentMeta() {
  return {
    ludysSourceCommit: repository.commit,
    ludysSourceTree: repository.tree,
    ludysPreviewRoot: "provider/vercel/wp13-12b-preview",
    ludysPreviewSourceSha256: sourceSha256,
    ludysDeploymentRole: "active",
    ludysSafeDisabled: "false",
    ludysRollbackDeploymentId: rollbackDeploymentId,
    ludysRollbackEvidenceSha256: rollbackEvidenceSha256,
    ludysPreviewUploadManifestSha256: uploadManifest.sha256,
    ludysDryRunManifestSha256: dryRunSha256,
    ludysStaticArtifactSha256: staticArtifactSha256,
    ludysVercelCliVersion: approvedVercelCli.version,
    ludysVercelCliIntegritySha256:
      approvedVercelCliIntegritySha256,
  };
}

function rollbackDeploymentMeta() {
  return {
    ...deploymentMeta(),
    ludysDeploymentRole: "rollback",
    ludysSafeDisabled: "true",
    ludysRollbackDeploymentId: undefined,
    ludysRollbackEvidenceSha256: undefined,
  };
}

function deploymentSummary() {
  return {
    id: deploymentId,
    projectId: vercelScope.projectId,
    readyState: "READY",
    target: null,
    createdAt: 123,
    meta: deploymentMeta(),
  };
}

function deploymentDetails() {
  return {
    ...deploymentSummary(),
    env: [...approvedVercelUserEnvironmentKeys],
    ownerId: vercelScope.teamId,
    name: vercelScope.projectName,
    source: "cli",
    url: deploymentHost,
    oidcTokenClaims: {
      environment: "preview",
      owner_id: vercelScope.teamId,
      project_id: vercelScope.projectId,
      sub:
        "owner:trym-s-projects:project:"
        + "ludys-wp13-12b-staging:environment:preview",
    },
  };
}

function rollbackDeploymentSummary() {
  return {
    id: rollbackDeploymentId,
    projectId: vercelScope.projectId,
    readyState: "READY",
    target: null,
    createdAt: 122,
    meta: rollbackDeploymentMeta(),
  };
}

function rollbackDeploymentDetails() {
  return {
    ...rollbackDeploymentSummary(),
    env: [...approvedVercelUserEnvironmentKeys],
    ownerId: vercelScope.teamId,
    name: vercelScope.projectName,
    source: "cli",
    url: rollbackHost,
    oidcTokenClaims: {
      environment: "preview",
      owner_id: vercelScope.teamId,
      project_id: vercelScope.projectId,
      sub:
        "owner:trym-s-projects:project:"
        + "ludys-wp13-12b-staging:environment:preview",
    },
  };
}

function fakeVercelApi({
  productionDeployments = [],
  domains = [],
  deployments = [
    deploymentSummary(),
    rollbackDeploymentSummary(),
  ],
  environmentVariables = [],
  projectOverrides = {},
  activeDetailsOverrides = {},
  rollbackDetailsOverrides = {},
} = {}) {
  return createInMemoryVercelApiForTesting({
    project: project(projectOverrides),
    domains,
    productionDeployments,
    deployments,
    environmentVariables,
    deploymentDetails: {
      [deploymentId]: {
        ...deploymentDetails(),
        ...activeDetailsOverrides,
      },
      [rollbackDeploymentId]: {
        ...rollbackDeploymentDetails(),
        ...rollbackDetailsOverrides,
      },
    },
    deploymentFiles: {
      [deploymentId]: uploadManifest.files.map((file) => ({
        file: file.path,
        sha256: file.sha256,
      })),
      [rollbackDeploymentId]: uploadManifest.files.map((file) => ({
        file: file.path,
        sha256: file.sha256,
      })),
    },
  });
}

function controlOptions(fetchImpl) {
  return {
    fetchImpl,
    repository,
    sourceSha256,
    uploadManifest,
    rollbackReceipt: null,
  };
}

function browserProof(observedAt = new Date().toISOString()) {
  return {
    schemaVersion: authenticatedBrowserProofSchemaVersion,
    status: "VERIFIED",
    observedAt,
    teamId: vercelScope.teamId,
    teamSlug: vercelScope.teamSlug,
    projectId: vercelScope.projectId,
    projectName: vercelScope.projectName,
    sourceCommit: repository.commit,
    sourceTree: repository.tree,
    previewSourceSha256: sourceSha256,
    uploadManifestSha256: uploadManifest.sha256,
    inventory: {
      activeDeploymentCount: 1,
      receiptBoundRollbackDeploymentCount: 1,
      unrelatedLiveDeploymentCount: 0,
      totalLiveDeploymentCount: 2,
    },
    active: {
      deploymentId,
      deploymentUrl: deploymentOrigin,
      standardProtectionSessionAuthenticated: true,
      runtimeConfigStatus: 200,
      runtimeConfigSchemaVersion:
        "wp13.12b-external-preview-config-v1",
      deploymentRole: "active",
      issuanceEnabled: true,
    },
    rollback: {
      deploymentId: rollbackDeploymentId,
      deploymentUrl: rollbackOrigin,
      standardProtectionSessionAuthenticated: true,
      runtimeConfigStatus: 200,
      runtimeConfigSchemaVersion:
        "wp13.12b-external-preview-config-v1",
      deploymentRole: "rollback",
      issuanceEnabled: false,
      issueStatus: 503,
      issueDenialClass: "ROLLBACK_SAFE_DISABLED",
    },
    safeguards: {
      authenticationMode:
        "VERCEL_STANDARD_PROTECTION_SESSION",
      protectionBypassUsed: false,
      protectionBypassCreated: false,
      shareableLinkCreated: false,
      oidcTokenRecorded: false,
      vercelTokenRecorded: false,
      participantsPresent: false,
      adultOperatorOnly: true,
    },
  };
}

function browserProofInventory() {
  return {
    previewDeployment: {
      id: deploymentId,
      url: deploymentOrigin,
    },
    receiptBoundRollbackDeployment: {
      id: rollbackDeploymentId,
      url: rollbackOrigin,
    },
    currentCommitPreviewCount: 1,
    receiptBoundRollbackDeploymentCount: 1,
    unrelatedLiveDeploymentCount: 0,
    liveDeploymentCount: 2,
  };
}

function finalActivationReadback(activeOnly) {
  const readback = structuredClone(activeOnly);
  readback.repository.deploymentSourceCommit = repository.commit;
  readback.repository.deploymentSourceTree = repository.tree;
  readback.repository.currentEvidenceHeadCommit = evidenceCommit;
  readback.repository.currentEvidenceHeadTree = evidenceTree;
  readback.repository.evidenceCommitRelationship =
    "DIRECT_RECEIPT_EVIDENCE_CHILD";
  readback.repository.receiptEvidenceBinding = {
    receiptPath,
    receiptSha256: sha256(receiptBytes),
    artifactPaths: [browserProofPath, rollbackProofPath].sort(),
    artifactHashes: {
      [browserProofPath]: "4".repeat(64),
      [rollbackProofPath]: rollbackEvidenceSha256,
    },
    exactDiffVerified: true,
    receiptSelfHashOmittedByConstruction: true,
  };
  readback.receiptBoundRollbackDeployment = {
    id: rollbackDeploymentId,
    url: rollbackOrigin,
    projectId: vercelScope.projectId,
    ownerId: vercelScope.teamId,
    name: vercelScope.projectName,
    readyState: "READY",
    target: "preview",
    source: "cli",
    sourceCommit: repository.commit,
    sourceTree: repository.tree,
    evidenceSha256: rollbackEvidenceSha256,
    safeDisabled: true,
    deploymentRoleClaimSource:
      "AUTHENTICATED_DEPLOYMENT_METADATA_NOT_ENV_VALUE",
    activeDeploymentId: deploymentId,
    receiptValidated: true,
    deploymentUserEnvironmentKeys:
      [...approvedVercelUserEnvironmentKeys],
    deploymentEnvironmentValuesExposedByProvider: false,
    deploymentRoleValueRequiresAuthenticatedBrowserProof: true,
  };
  readback.environmentInventory
    .pendingRollbackDeploymentUserEnvironmentKeys = null;
  readback.environmentInventory
    .receiptBoundRollbackDeploymentUserEnvironmentKeys =
      [...approvedVercelUserEnvironmentKeys];
  readback.deploymentInventory
    .receiptBoundRollbackDeploymentCount = 1;
  readback.deploymentInventory.readyDeploymentCount = 2;
  readback.deploymentInventory.liveDeploymentCount = 2;
  const observedAt =
    readback.wifLiveGuard.providerReadbackObservedAt;
  const proof = browserProof(observedAt);
  readback.authenticatedBrowserProof = {
    schemaVersion: proof.schemaVersion,
    status: proof.status,
    observedAt: proof.observedAt,
    teamId: proof.teamId,
    teamSlug: proof.teamSlug,
    projectId: proof.projectId,
    projectName: proof.projectName,
    sourceCommit: proof.sourceCommit,
    sourceTree: proof.sourceTree,
    previewSourceSha256: proof.previewSourceSha256,
    uploadManifestSha256: proof.uploadManifestSha256,
    maximumAgeMilliseconds:
      authenticatedBrowserProofMaximumAgeMilliseconds,
    inventory: proof.inventory,
    active: proof.active,
    rollback: proof.rollback,
    safeguards: proof.safeguards,
    artifactPath:
      "release/wp13-12b/receipts/actual/"
      + "authenticated-browser-proof-test.json",
    artifactSha256: "4".repeat(64),
    receiptBound: true,
  };
  readback.wifLiveGuard.freshExactInventoryReadback = true;
  readback.wifLiveGuard
    .receiptBoundRollbackDeploymentCount = 1;
  readback.wifLiveGuard.authenticatedBrowserProofVerified = true;
  return readback;
}

function dryRunJson() {
  return {
    framework: null,
    files: uploadManifest.files.map((file) => ({
      path: file.path,
      size: file.bytes,
      mode: "0644",
      sha: file.sha1,
    })),
  };
}

test("repository readback permits only an exact clean receipt-evidence child of the deployed source", () => {
  const preReceipt = repositoryReadback(repositoryExec());
  assert.equal(preReceipt.commit, evidenceCommit);
  assert.equal(preReceipt.tree, evidenceTree);
  assert.equal(
    preReceipt.evidenceCommitRelationship,
    "DEPLOYMENT_SOURCE_HEAD",
  );
  assert.equal(preReceipt.receiptEvidenceBinding, null);

  const evidenceChild = repositoryReadback(
    repositoryExec(),
    receiptRepositoryBinding,
  );
  assert.equal(evidenceChild.commit, repository.commit);
  assert.equal(evidenceChild.tree, repository.tree);
  assert.equal(
    evidenceChild.deploymentSourceCommit,
    repository.commit,
  );
  assert.equal(
    evidenceChild.currentEvidenceHeadCommit,
    evidenceCommit,
  );
  assert.equal(
    evidenceChild.evidenceCommitRelationship,
    "DIRECT_RECEIPT_EVIDENCE_CHILD",
  );
  assert.deepEqual(
    evidenceChild.receiptEvidenceBinding.artifactPaths,
    [browserProofPath, rollbackProofPath].sort(),
  );
  assert.equal(
    evidenceChild.receiptEvidenceBinding.exactDiffVerified,
    true,
  );
  assert.equal(
    evidenceChild.receiptEvidenceBinding
      .receiptSelfHashOmittedByConstruction,
    true,
  );

  assert.throws(
    () => repositoryReadback(repositoryExec({
      head: repository.commit,
      headTree: repository.tree,
      parents: [repository.commit],
      changedPaths: [],
    }), receiptRepositoryBinding),
    /VERCEL_RECEIPT_EVIDENCE_DIRECT_CHILD_REQUIRED/u,
  );

  assert.throws(
    () => repositoryReadback(repositoryExec({
      changedPaths: [
        receiptPath,
        browserProofPath,
        rollbackProofPath,
        "README.md",
      ],
    }), receiptRepositoryBinding),
    /VERCEL_RECEIPT_EVIDENCE_EXACT_DIFF_REQUIRED/u,
  );
  const intermediate = "6".repeat(40);
  assert.throws(
    () => repositoryReadback(repositoryExec({
      parents: [evidenceCommit, intermediate],
    }), receiptRepositoryBinding),
    /VERCEL_RECEIPT_EVIDENCE_DIRECT_CHILD_REQUIRED/u,
  );
  assert.throws(
    () => repositoryReadback(repositoryExec({
      parents: [
        evidenceCommit,
        repository.commit,
        "7".repeat(40),
      ],
    }), receiptRepositoryBinding),
    /VERCEL_RECEIPT_EVIDENCE_DIRECT_CHILD_REQUIRED/u,
  );
  assert.throws(
    () => repositoryReadback(repositoryExec({
      parents: [evidenceCommit, "8".repeat(40)],
    }), receiptRepositoryBinding),
    /VERCEL_RECEIPT_EVIDENCE_DIRECT_CHILD_REQUIRED/u,
  );
  assert.throws(
    () => repositoryReadback(repositoryExec({
      status: "1 .M N... 100644 100644 100644 a b README.md\n",
    }), receiptRepositoryBinding),
    /REPOSITORY_WORKTREE_MUST_BE_CLEAN/u,
  );
  assert.throws(
    () => repositoryReadback(repositoryExec({
      resolvedSourceTree: "9".repeat(40),
    }), receiptRepositoryBinding),
    /VERCEL_RECEIPT_SOURCE_BINDING_MISMATCH/u,
  );
  assert.throws(
    () => repositoryReadback(repositoryExec(), {
      ...receiptRepositoryBinding,
      rollbackSourceCommit: "0".repeat(40),
    }),
    /VERCEL_RECEIPT_EVIDENCE_BINDING_INVALID/u,
  );
  assert.throws(
    () => repositoryReadback(repositoryExec({
      files: {
        [receiptPath]: "{\"receipt\":\"tampered\"}\n",
        [browserProofPath]: browserProofBytes,
        [rollbackProofPath]: rollbackProofBytes,
      },
    }), receiptRepositoryBinding),
    /VERCEL_RECEIPT_EVIDENCE_RECEIPT_HASH_MISMATCH/u,
  );
  assert.throws(
    () => repositoryReadback(repositoryExec({
      files: {
        [receiptPath]: receiptBytes,
        [browserProofPath]: "{\"browser\":\"tampered\"}\n",
        [rollbackProofPath]: rollbackProofBytes,
      },
    }), receiptRepositoryBinding),
    /VERCEL_RECEIPT_EVIDENCE_ARTIFACT_HASH_MISMATCH/u,
  );

  assert.throws(
    () => terminalReceiptRepositoryReadback(
      repositoryExec({
        head: "9".repeat(40),
        headTree: "8".repeat(40),
        parents: ["9".repeat(40), repository.commit],
      }),
      receiptRepositoryBinding,
      evidenceChild,
    ),
    /VERCEL_RECEIPT_REPOSITORY_RACE_DETECTED/u,
  );
});

test("receipt mode rejects every injectable repository or source override", async () => {
  const fake = fakeVercelApi();
  const environment = {
    LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH:
      "release/wp13-12b/receipts/actual/receipt.json",
  };
  const overrideSets = [
    { repository },
    { sourceSha256 },
    { uploadManifest },
    { rollbackReceipt: null },
    { rollbackReceipt: { receiptType: "PROTECTED_PREVIEW_RECEIPT" } },
  ];
  for (const overrides of overrideSets) {
    await assert.rejects(
      runVercelControl(
        ["--action", "inspect-project"],
        {
          environment,
          fetchImpl: fake.fetchImpl,
          ...overrides,
        },
      ),
      /VERCEL_RECEIPT_MODE_OVERRIDES_FORBIDDEN/u,
    );
  }
});

test("production control forbids token, provider, repository, source, upload, environment, and clock adapters", async () => {
  const injectedOptions = [
    { token: "test-vercel-token-at-least-twenty" },
    { fetchImpl: async () => {} },
    { execFileImpl: () => "" },
    { repository },
    { sourceSha256 },
    { uploadManifest },
    { environment: {} },
    { now: () => new Date("2026-07-27T12:00:00.000Z") },
    { rollbackReceipt: null },
  ];
  for (const options of injectedOptions) {
    await assert.rejects(
      runVercelControlProduction(
        ["--action", "inspect-project"],
        options,
      ),
      /PRODUCTION_VERCEL_DEPENDENCY_INJECTION_FORBIDDEN/u,
    );
  }
  let wrapperInvocations = 0;
  const realProviderWrapper = (...args) => {
    wrapperInvocations += 1;
    return globalThis.fetch(...args);
  };
  assert.throws(
    () => runVercelControl(
      ["--action", "inspect-project"],
      {
        ...controlOptions(realProviderWrapper),
      },
    ),
    /IN_MEMORY_VERCEL_TEST_ADAPTER_REQUIRED/u,
  );
  assert.equal(wrapperInvocations, 0);
});

test("production Vercel paths pin native fetch at module initialization", async () => {
  const [controlSource, previewSource] = await Promise.all([
    readFile(
      new URL("./provider-external-vercel-control.mjs", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "./provider-external-vercel-preview-deploy.mjs",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  for (const source of [controlSource, previewSource]) {
    assert.match(
      source,
      /const nativeFetch = globalThis\.fetch\.bind\(globalThis\);/u,
    );
    assert.doesNotMatch(source, /fetchImpl = globalThis\.fetch/u);
    assert.match(source, /fetchImpl: nativeFetch/u);
  }
});

test("mutating control requires and reasserts capability and window immediately before each PATCH", async () => {
  const mutationCases = [
    {
      action: "ensure-standard-protection",
      projectOverrides: {
        ssoProtection: { deploymentType: "none" },
      },
    },
    {
      action: "ensure-team-oidc",
      projectOverrides: {
        oidcTokenConfig: {
          enabled: false,
          issuerMode: "project",
        },
      },
    },
  ];
  for (const mutationCase of mutationCases) {
    const fake = fakeVercelApi({
      projectOverrides: mutationCase.projectOverrides,
    });
    const activationCapability = Object.freeze({});
    let capabilityAssertions = 0;
    let windowAssertions = 0;
    const result = await runVercelControl([
      "--action", mutationCase.action,
      "--authorized", vercelScope.activationAuthorization,
    ], {
      ...controlOptions(fake.fetchImpl),
      activationCapability,
      assertBaseActivationCapabilityImpl(value) {
        assert.equal(value, activationCapability);
        capabilityAssertions += 1;
      },
      assertActivationWindowOpenImpl({ now }) {
        assert.equal(typeof now, "function");
        windowAssertions += 1;
      },
    });
    assert.equal(result.externalWrites, 1);
    assert.equal(capabilityAssertions, 2);
    assert.equal(windowAssertions, 2);
    assert.equal(
      fake.calls.filter((call) => call.method === "PATCH").length,
      1,
    );
  }

  const blocked = fakeVercelApi({
    projectOverrides: {
      ssoProtection: { deploymentType: "none" },
    },
  });
  let assertions = 0;
  await assert.rejects(
    runVercelControl([
      "--action", "ensure-standard-protection",
      "--authorized", vercelScope.activationAuthorization,
    ], {
      ...controlOptions(blocked.fetchImpl),
      activationCapability: Object.freeze({}),
      assertBaseActivationCapabilityImpl() {
        assertions += 1;
        if (assertions === 2) {
          throw new Error("ACTIVATION_CAPABILITY_REVOKED");
        }
      },
      assertActivationWindowOpenImpl() {},
    }),
    /ACTIVATION_CAPABILITY_REVOKED/u,
  );
  assert.equal(
    blocked.calls.filter((call) => call.method === "PATCH").length,
    0,
  );
});

test("receipt source digest and upload manifest derive exactly from committed Git blobs", async () => {
  const root = await mkdtemp(join(
    tmpdir(),
    "ludys-vercel-committed-source-",
  ));
  const sourceFiles = Object.fromEntries(
    approvedVercelUploadPaths.map((path, index) => [
      path,
      Buffer.from(`source-${index}-${path}\r\n`, "utf8"),
    ]),
  );
  try {
    for (const [path, bytes] of Object.entries(sourceFiles)) {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    const committed = committedPreviewSourceBinding(
      committedPreviewExec(sourceFiles, repository.commit),
      repository.commit,
    );
    assert.equal(
      committed.sourceSha256,
      await previewSourceSha256(root),
    );
    assert.deepEqual(
      committed.uploadManifest,
      await previewUploadManifest(root),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("control derives rollback-first sequential pair and final gate requires the receipt binding", async () => {
  const fake = fakeVercelApi();
  const result = await runVercelControl([
    "--action", "inspect-project",
  ], controlOptions(fake.fetchImpl));
  assert.equal(result.previewOnly, false);
  assert.equal(result.sequentialPairPrepared, true);
  assert.equal(result.previewDeployment.id, deploymentId);
  assert.equal(
    result.pendingRollbackDeployment.id,
    rollbackDeploymentId,
  );
  assert.equal(result.previewDeployment.sourceFilesVerified, true);
  assert.equal(
    result.previewDeployment.uploadManifestSha256,
    uploadManifest.sha256,
  );
  assert.deepEqual(
    result.previewDeployment.deploymentUserEnvironmentKeys,
    approvedVercelUserEnvironmentKeys,
  );
  assert.deepEqual(
    result.pendingRollbackDeployment
      .deploymentUserEnvironmentKeys,
    approvedVercelUserEnvironmentKeys,
  );
  assert.deepEqual(
    result.environmentInventory
      .activeDeploymentUserEnvironmentKeys,
    approvedVercelUserEnvironmentKeys,
  );
  assert.deepEqual(
    result.environmentInventory
      .pendingRollbackDeploymentUserEnvironmentKeys,
    approvedVercelUserEnvironmentKeys,
  );
  assert.equal(
    result.environmentInventory
      .deploymentEnvironmentValuesExposedByProvider,
    false,
  );
  assert.equal(result.deploymentInventory.liveDeploymentCount, 2);
  assert.equal(
    result.deploymentInventory
      .unrelatedNonterminalDeploymentCount,
    0,
  );
  assert.throws(
    () => validateVercelActivationReadback(result, trust),
    /CURRENT_AUTHENTICATED_PROTECTED_VERCEL_PREVIEW_READBACK_REQUIRED/u,
  );
  const final = finalActivationReadback(result);
  final.pendingRollbackDeployment = null;
  final.deploymentInventory.rollbackPreparationDeploymentCount = 0;
  final.sequentialPairPrepared = false;
  final.previewOnly = true;
  assert.deepEqual(
    validateVercelActivationReadback(final, trust),
    {
      teamId: vercelScope.teamId,
      teamSlug: vercelScope.teamSlug,
      projectId: vercelScope.projectId,
      projectName: vercelScope.projectName,
      protection: "prod_deployment_urls_and_all_previews",
      oidcIssuerMode: "team",
      deploymentId,
      deploymentUrl: deploymentOrigin,
      sourceCommit: repository.commit,
      sourceTree: repository.tree,
      rollbackDeploymentId,
      rollbackDeploymentUrl: rollbackOrigin,
      rollbackEvidenceSha256: "3".repeat(64),
      authenticatedBrowserProofObservedAt:
        final.authenticatedBrowserProof.observedAt,
      providerReadbackObservedAt:
        final.wifLiveGuard.providerReadbackObservedAt,
      oidcSubjectGranularity: "PROJECT_AND_ENVIRONMENT",
    },
  );
  const invalidEvidenceReadbacks = [
    structuredClone(final),
    structuredClone(final),
    structuredClone(final),
    structuredClone(final),
    structuredClone(final),
  ];
  delete invalidEvidenceReadbacks[0].repository
    .currentEvidenceHeadCommit;
  invalidEvidenceReadbacks[1].repository
    .evidenceCommitRelationship = "DEPLOYMENT_SOURCE_HEAD";
  invalidEvidenceReadbacks[2].repository
    .receiptEvidenceBinding.exactDiffVerified = false;
  delete invalidEvidenceReadbacks[3].repository
    .receiptEvidenceBinding.artifactHashes;
  invalidEvidenceReadbacks[4].authenticatedBrowserProof
    .sourceCommit = evidenceCommit;
  for (const invalid of invalidEvidenceReadbacks) {
    assert.throws(
      () => validateVercelActivationReadback(invalid, trust),
      /CURRENT_AUTHENTICATED_PROTECTED_VERCEL_PREVIEW_READBACK_REQUIRED/u,
    );
  }
});

test("authenticated control verifies one exact deployment ID is absent", async () => {
  const absentDeploymentId = "dpl_AbsentDeployment123456789";
  const fake = fakeVercelApi();
  const candidate = await runVercelControl([
    "--action", "inspect-deployment-candidate",
    "--deployment-id", deploymentId,
  ], controlOptions(fake.fetchImpl));
  assert.equal(candidate.deploymentId, deploymentId);
  assert.equal(candidate.deploymentUrl, deploymentOrigin);
  assert.equal(candidate.deploymentRole, "active");
  assert.equal(candidate.projectId, vercelScope.projectId);
  assert.equal(candidate.teamId, vercelScope.teamId);
  assert.equal(candidate.authenticatedProviderReadback, true);
  const result = await runVercelControl([
    "--action", "verify-deployment-absent",
    "--deployment-id", absentDeploymentId,
  ], controlOptions(fake.fetchImpl));
  assert.deepEqual(result, {
    schemaVersion:
      "wp13.12b-ea-vercel-deployment-absence-readback-v1",
    action: "verify-deployment-absent",
    deploymentId: absentDeploymentId,
    absent: true,
    projectId: vercelScope.projectId,
    teamId: vercelScope.teamId,
    authenticatedProviderReadback: true,
    externalWrites: 0,
    tokenPrinted: false,
  });
  assert.ok(fake.calls.some((call) => (
    call.path === `/v13/deployments/${absentDeploymentId}`
    && call.method === "GET"
  )));
  await assert.rejects(
    () => runVercelControl([
      "--action", "verify-deployment-absent",
      "--deployment-id", deploymentId,
    ], controlOptions(fake.fetchImpl)),
    /VERCEL_FAILED_DEPLOYMENT_STILL_PRESENT/u,
  );
});

test("failed preview cleanup binds nonzero stdout; invalid or prior IDs cannot delete", () => {
  const deploymentOutput = JSON.stringify({
    id: deploymentId,
    url: deploymentOrigin,
    target: null,
    readyState: "READY",
  });
  assert.deepEqual(returnedDeploymentIdentity(deploymentOutput), {
    id: deploymentId,
    url: deploymentOrigin,
  });
  assert.deepEqual(parseCreatedDeployment(deploymentOutput), {
    id: deploymentId,
    url: deploymentOrigin,
  });
  assert.equal(
    boundedCapturedCliStdout({
      stdout: Buffer.from(deploymentOutput, "utf8"),
    }),
    deploymentOutput,
  );
  const malformedButIdentified = JSON.stringify({
    id: deploymentId,
    url: "https://example.invalid",
    target: null,
    readyState: "READY",
  });
  let invalidOutputDeleteCalls = 0;
  assert.throws(
    () => {
      returnedDeploymentIdentity(malformedButIdentified);
      invalidOutputDeleteCalls += 1;
    },
    /VERCEL_FAILED_ATTEMPT_MANUAL_INVENTORY_REQUIRED/u,
  );
  assert.equal(invalidOutputDeleteCalls, 0);
  assert.throws(
    () => returnedDeploymentIdentity("{}"),
    /VERCEL_FAILED_ATTEMPT_MANUAL_INVENTORY_REQUIRED/u,
  );

  const beforeObservedAt = "2026-07-27T12:00:00.000Z";
  const absenceReadback = {
    schemaVersion:
      "wp13.12b-ea-vercel-deployment-absence-readback-v1",
    action: "verify-deployment-absent",
    deploymentId,
    absent: true,
    projectId: vercelScope.projectId,
    teamId: vercelScope.teamId,
    authenticatedProviderReadback: true,
    externalWrites: 0,
    tokenPrinted: false,
  };
  const before = {
    rollbackPreparationOnly: true,
    sequentialPairPrepared: false,
    previewDeployment: null,
    pendingRollbackDeployment: {
      id: rollbackDeploymentId,
      url: rollbackOrigin,
    },
    receiptBoundRollbackDeployment: null,
    repository: {
      commit: repository.commit,
      tree: repository.tree,
    },
    wifLiveGuard: {
      providerReadbackObservedAt: beforeObservedAt,
    },
    deploymentInventory: {
      liveDeploymentCount: 1,
      unrelatedLiveDeploymentCount: 0,
      unrelatedNonterminalDeploymentCount: 0,
    },
    productionDeploymentCreated: false,
    customDomainCreated: false,
    claimsDerivedFromAuthenticatedProviderReadback: true,
  };
  const candidateReadback = {
    schemaVersion:
      "wp13.12b-ea-vercel-cleanup-candidate-readback-v1",
    action: "inspect-deployment-candidate",
    deploymentId,
    deploymentUrl: deploymentOrigin,
    deploymentRole: "active",
    createdAt: Date.parse(beforeObservedAt) + 1,
    projectId: vercelScope.projectId,
    teamId: vercelScope.teamId,
    sourceCommit: repository.commit,
    sourceTree: repository.tree,
    rollbackDeploymentId,
    rollbackEvidenceSha256,
    authenticatedProviderReadback: true,
    externalWrites: 0,
    tokenPrinted: false,
  };
  const afterFailure = {
    ...before,
    rollbackPreparationOnly: false,
    sequentialPairPrepared: true,
    previewDeployment: {
      id: deploymentId,
      url: deploymentOrigin,
    },
    deploymentInventory: {
      liveDeploymentCount: 2,
      unrelatedLiveDeploymentCount: 0,
      unrelatedNonterminalDeploymentCount: 0,
    },
  };
  const verified = {
    ...before,
    deploymentInventory: {
      liveDeploymentCount: 1,
      unrelatedLiveDeploymentCount: 0,
      unrelatedNonterminalDeploymentCount: 0,
    },
    productionDeploymentCreated: false,
    customDomainCreated: false,
  };
  const cleanupPlan = buildFailedPreviewCleanupPlan({
    returnedIdentity: returnedDeploymentIdentity(deploymentOutput),
    candidateReadback,
    before,
    afterFailure,
    deploymentRole: "active",
    rollbackBinding: {
      id: rollbackDeploymentId,
      url: rollbackOrigin,
      evidenceSha256: rollbackEvidenceSha256,
    },
  });
  assert.deepEqual(cleanupPlan.removeArgs, [
    "remove",
    deploymentId,
    "--yes",
    "--scope",
    vercelScope.teamSlug,
  ]);
  assert.deepEqual(validateFailedDeploymentCleanupReadback({
    createdDeploymentId: deploymentId,
    absenceReadback,
    before,
    verified,
    deploymentRole: "active",
    rollbackBinding: {
      id: rollbackDeploymentId,
      url: rollbackOrigin,
    },
  }), {
    deletedDeploymentId: deploymentId,
    verifiedAbsent: true,
    preExistingDeploymentPreserved: true,
  });
  assert.throws(
    () => validateFailedDeploymentCleanupReadback({
      createdDeploymentId: deploymentId,
      absenceReadback: {
        ...absenceReadback,
        deploymentId: rollbackDeploymentId,
      },
      before,
      verified,
      deploymentRole: "active",
      rollbackBinding: {
        id: rollbackDeploymentId,
        url: rollbackOrigin,
      },
    }),
    /VERCEL_FAILED_DEPLOYMENT_CLEANUP_INCOMPLETE/u,
  );

  let removeCalls = 0;
  assert.throws(
    () => {
      buildFailedPreviewCleanupPlan({
        returnedIdentity: {
          id: rollbackDeploymentId,
          url: rollbackOrigin,
        },
        candidateReadback: {
          ...candidateReadback,
          deploymentId: rollbackDeploymentId,
          deploymentUrl: rollbackOrigin,
        },
        before,
        afterFailure,
        deploymentRole: "active",
        rollbackBinding: {
          id: rollbackDeploymentId,
          url: rollbackOrigin,
          evidenceSha256: rollbackEvidenceSha256,
        },
      });
      removeCalls += 1;
    },
    /VERCEL_FAILED_ATTEMPT_MANUAL_INVENTORY_REQUIRED/u,
  );
  assert.equal(removeCalls, 0);
});

test("production, project env, missing critical fields, and unrelated queued deploys fail closed", async () => {
  const production = fakeVercelApi({
    productionDeployments: [{
      id: "dpl_production12345678",
      projectId: vercelScope.projectId,
      target: "production",
      readyState: "READY",
    }],
  });
  const productionResult = await runVercelControl([
    "--action", "inspect-project",
  ], controlOptions(production.fetchImpl));
  assert.equal(productionResult.previewOnly, false);
  assert.equal(productionResult.productionDeploymentCreated, true);

  const queued = fakeVercelApi({
    deployments: [
      deploymentSummary(),
      {
        id: "dpl_unrelated123456789",
        projectId: vercelScope.projectId,
        readyState: "QUEUED",
        target: null,
      },
    ],
  });
  const queuedResult = await runVercelControl([
    "--action", "inspect-project",
  ], controlOptions(queued.fetchImpl));
  assert.equal(queuedResult.previewOnly, false);
  assert.equal(
    queuedResult.deploymentInventory
      .unrelatedNonterminalDeploymentCount,
    1,
  );

  const env = fakeVercelApi({
    environmentVariables: [{
      key: "UNEXPECTED",
      target: ["preview"],
    }],
  });
  await assert.rejects(
    runVercelControl(
      ["--action", "inspect-project"],
      controlOptions(env.fetchImpl),
    ),
    /VERCEL_PREVIEW_PROJECT_ENV_MUST_BE_EMPTY/u,
  );

  const activeWithoutDeploymentEnv = fakeVercelApi({
    activeDetailsOverrides: { env: undefined },
  });
  await assert.rejects(
    runVercelControl(
      ["--action", "inspect-project"],
      controlOptions(activeWithoutDeploymentEnv.fetchImpl),
    ),
    /VERCEL_DEPLOYMENT_ENV_READBACK_REQUIRED/u,
  );

  const rollbackWithExtraDeploymentEnv = fakeVercelApi({
    rollbackDetailsOverrides: {
      env: [
        ...approvedVercelUserEnvironmentKeys,
        "UNAPPROVED_DEPLOYMENT_KEY",
      ],
    },
  });
  await assert.rejects(
    runVercelControl(
      ["--action", "inspect-project"],
      controlOptions(rollbackWithExtraDeploymentEnv.fetchImpl),
    ),
    /VERCEL_DEPLOYMENT_ENV_ALLOWLIST_MISMATCH/u,
  );

  const missing = fakeVercelApi({
    projectOverrides: { autoExposeSystemEnvs: undefined },
  });
  await assert.rejects(
    runVercelControl(
      ["--action", "inspect-project"],
      controlOptions(missing.fetchImpl),
    ),
    /VERCEL_PROJECT_SCOPE_MISMATCH/u,
  );

  const driftingNodeRuntime = fakeVercelApi({
    projectOverrides: { nodeVersion: "22.x" },
  });
  await assert.rejects(
    runVercelControl(
      ["--action", "inspect-project"],
      controlOptions(driftingNodeRuntime.fetchImpl),
    ),
    /VERCEL_PROJECT_SCOPE_MISMATCH/u,
  );
});

test("authenticated browser proof binds both runtime roles and rollback denial without bypasses", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");
  const proof = browserProof("2026-07-27T11:59:00.000Z");
  const options = {
    repository,
    sourceSha256,
    uploadManifestSha256: uploadManifest.sha256,
    inventory: browserProofInventory(),
    now: () => now,
  };
  const valid = validateAuthenticatedBrowserProof(proof, options);
  assert.equal(valid.active.deploymentRole, "active");
  assert.equal(valid.rollback.deploymentRole, "rollback");
  assert.equal(valid.rollback.issueStatus, 503);
  assert.equal(
    valid.rollback.issueDenialClass,
    "ROLLBACK_SAFE_DISABLED",
  );

  const invalidProofs = [];
  const wrongActiveRole = structuredClone(proof);
  wrongActiveRole.active.deploymentRole = "rollback";
  invalidProofs.push(wrongActiveRole);
  const wrongRollbackRole = structuredClone(proof);
  wrongRollbackRole.rollback.deploymentRole = "active";
  invalidProofs.push(wrongRollbackRole);
  const wrongRollbackDenial = structuredClone(proof);
  wrongRollbackDenial.rollback.issueStatus = 200;
  invalidProofs.push(wrongRollbackDenial);
  const bypassUsed = structuredClone(proof);
  bypassUsed.safeguards.protectionBypassUsed = true;
  invalidProofs.push(bypassUsed);
  const shareLink = structuredClone(proof);
  shareLink.safeguards.shareableLinkCreated = true;
  invalidProofs.push(shareLink);
  const wrongInventory = structuredClone(proof);
  wrongInventory.inventory.totalLiveDeploymentCount = 3;
  invalidProofs.push(wrongInventory);
  const stale = browserProof("2026-07-27T11:29:59.999Z");
  invalidProofs.push(stale);
  for (const invalid of invalidProofs) {
    assert.throws(
      () => validateAuthenticatedBrowserProof(invalid, options),
      /VERCEL_AUTHENTICATED_BROWSER_PROOF_INVALID/u,
    );
  }
});

test("dry-run manifest binds the exact upload allowlist and rejects an extra file", () => {
  const valid = validateDryRunManifest(
    dryRunJson(),
    uploadManifest,
  );
  assert.equal(valid.fileCount, approvedVercelUploadPaths.length);
  assert.match(valid.sha256, /^[a-f0-9]{64}$/u);
  const extra = dryRunJson();
  extra.files.push({
    path: "README.md",
    size: 1,
    mode: "0644",
    sha: "9".repeat(40),
  });
  assert.throws(
    () => validateDryRunManifest(extra, uploadManifest),
    /VERCEL_DRY_RUN_UPLOAD_ALLOWLIST_MISMATCH/u,
  );
  const legacyDigestField = dryRunJson();
  legacyDigestField.files[0].sha256 =
    legacyDigestField.files[0].sha;
  delete legacyDigestField.files[0].sha;
  assert.throws(
    () => validateDryRunManifest(
      legacyDigestField,
      uploadManifest,
    ),
    /VERCEL_DRY_RUN_MANIFEST_INVALID/u,
  );
});

test("rollback safety proof is bound to uploaded issue, delete, and runtime sources", async () => {
  const actualUploadManifest = await previewUploadManifest();
  const proof = await verifyRollbackSafetySource({
    uploadManifest: actualUploadManifest,
  });
  assert.equal(proof.uploadManifestBound, true);
  assert.equal(proof.issuanceDeniedBeforeIdentityExchange, true);
  assert.equal(proof.deleteRouteAvailable, true);
  assert.deepEqual(
    proof.files.map((file) => file.path),
    [
      "api/delete.mjs",
      "api/issue.mjs",
      "lib/runtime-config.mjs",
    ],
  );
});

test("scripted in-memory preview adapter reasserts gates and workspace binding for both roles", async () => {
  const dryRunManifestSha256 = validateDryRunManifest(
    dryRunJson(),
    uploadManifest,
  ).sha256;
  const rollbackBinding = Object.freeze({
    id: rollbackDeploymentId,
    url: rollbackOrigin,
    sourceCommit: repository.commit,
    sourceTree: repository.tree,
    evidenceSha256: rollbackEvidenceSha256,
  });
  const projectReadback = {
    framework: null,
    rootDirectory: null,
    buildCommand: null,
    outputDirectory: null,
    installCommand: null,
    devCommand: null,
    autoExposeSystemEnvs: true,
    nodeVersion: approvedVercelNodeVersion,
    live: false,
    link: null,
    webAnalytics: null,
    speedInsights: null,
    passwordProtectionConfigured: false,
    trustedIpsConfigured: false,
    protectionBypassConfigured: false,
    ssoProtection: {
      deploymentType:
        "prod_deployment_urls_and_all_previews",
    },
    oidcTokenConfig: {
      enabled: true,
      issuerMode: "team",
    },
  };
  const rollbackDeployment = {
    id: rollbackDeploymentId,
    url: rollbackOrigin,
    sourceCommit: repository.commit,
    sourceTree: repository.tree,
    target: "preview",
    deploymentRole: "rollback",
    safeDisabled: true,
    protectionVerified: true,
    sourceFilesVerified: true,
    deploymentUserEnvironmentKeys:
      [...approvedVercelUserEnvironmentKeys],
    deploymentEnvironmentValuesExposedByProvider: false,
    deploymentRoleValueRequiresAuthenticatedBrowserProof: true,
    uploadManifestSha256: uploadManifest.sha256,
    dryRunManifestSha256,
    staticArtifactSha256,
  };
  const activeDeployment = {
    id: deploymentId,
    url: deploymentOrigin,
    sourceCommit: repository.commit,
    sourceTree: repository.tree,
    target: "preview",
    deploymentRole: "active",
    safeDisabled: false,
    rollbackDeploymentId,
    rollbackEvidenceSha256,
    protectionVerified: true,
    sourceFilesVerified: true,
    deploymentUserEnvironmentKeys:
      [...approvedVercelUserEnvironmentKeys],
    deploymentEnvironmentValuesExposedByProvider: false,
    deploymentRoleValueRequiresAuthenticatedBrowserProof: true,
    uploadManifestSha256: uploadManifest.sha256,
    dryRunManifestSha256,
    staticArtifactSha256,
  };

  async function exercise(deploymentRole) {
    const activationCapability = Object.freeze({});
    const execFileImpl = () => {
      throw new Error("UNEXPECTED_TEST_GIT_EXECUTION");
    };
    let capabilityAssertions = 0;
    let windowAssertions = 0;
    const workspaceBindings = [];
    const beforeInventory = {
      liveDeploymentCount: deploymentRole === "rollback" ? 0 : 1,
      unrelatedLiveDeploymentCount: 0,
      unrelatedNonterminalDeploymentCount: 0,
    };
    const before = {
      productionDeploymentCreated: false,
      customDomainCreated: false,
      claimsDerivedFromAuthenticatedProviderReadback: true,
      project: projectReadback,
      environmentInventory: {
        exactAllowlistVerified: true,
        previewProjectEnvironmentKeys: [],
      },
      deploymentInventory: beforeInventory,
      rollbackPreparationOnly: deploymentRole === "active",
      previewDeployment: null,
      pendingRollbackDeployment:
        deploymentRole === "active" ? rollbackDeployment : null,
    };
    const after = {
      ...before,
      previewDeployment:
        deploymentRole === "active" ? activeDeployment : null,
      pendingRollbackDeployment: rollbackDeployment,
      rollbackPreparationOnly: deploymentRole === "rollback",
      sequentialPairPrepared: deploymentRole === "active",
      deploymentInventory: {
        liveDeploymentCount:
          deploymentRole === "rollback" ? 1 : 2,
        unrelatedLiveDeploymentCount: 0,
        unrelatedNonterminalDeploymentCount: 0,
      },
    };
    const controlAdapter =
      createScriptedVercelPreviewControlForTesting([
        { action: "inspect-project", result: before },
        {
          action: "ensure-standard-protection",
          result: { ...before, externalWrites: 1 },
        },
        {
          action: "ensure-team-oidc",
          result: { ...before, externalWrites: 1 },
        },
        { action: "inspect-project", result: after },
      ]);
    const cliAdapter = createScriptedVercelPreviewCliForTesting([
      { kind: "version", output: approvedVercelCli.version },
      { kind: "link", output: "" },
      { kind: "dry-run", output: JSON.stringify(dryRunJson()) },
      {
        kind: "deploy",
        output: JSON.stringify({
          id: deploymentRole === "active"
            ? deploymentId
            : rollbackDeploymentId,
          url: deploymentRole === "active"
            ? deploymentOrigin
            : rollbackOrigin,
          target: null,
          readyState: "READY",
        }),
      },
    ]);
    const wifAdapter = createScriptedVercelWifReadbackForTesting([
      { complete: true },
      { complete: true },
      { complete: true },
    ]);
    const probeAdapter =
      createScriptedVercelProtectedProbeForTesting({
        protectionChallengeStatus: 401,
        deploymentRole,
        authenticatedProbePerformed: false,
        authenticatedBrowserProofRequired: true,
        protectionBypassCreated: false,
        shareableLinkCreated: false,
        tokenPrinted: false,
      });
    const argv = [
      "--action", "deploy-preview",
      "--team-id", vercelScope.teamId,
      "--team-slug", vercelScope.teamSlug,
      "--project-id", vercelScope.projectId,
      "--project-name", vercelScope.projectName,
      "--target", "preview",
      "--deployment-role", deploymentRole,
      "--source-commit", repository.commit,
      "--source-tree", repository.tree,
      ...(deploymentRole === "active" ? [
        "--rollback-deployment-id", rollbackBinding.id,
        "--rollback-deployment-url", rollbackBinding.url,
        "--rollback-source-commit", rollbackBinding.sourceCommit,
        "--rollback-source-tree", rollbackBinding.sourceTree,
        "--rollback-evidence-sha256", rollbackBinding.evidenceSha256,
      ] : []),
      "--authorized", vercelScope.activationAuthorization,
    ];
    const result = await runVercelPreviewDeployForTesting(argv, {
      activationCapability,
      assertBaseActivationCapabilityImpl(value) {
        assert.equal(value, activationCapability);
        capabilityAssertions += 1;
      },
      assertActivationWindowOpenImpl({ now }) {
        assert.equal(typeof now, "function");
        windowAssertions += 1;
      },
      execFileImpl,
      repository,
      sourceSha256,
      uploadManifest,
      assertPreviewWorkspaceBindingImpl: async (
        repositoryState,
        committedBinding,
        receivedExecFileImpl,
      ) => {
        assert.equal(repositoryState, repository);
        assert.equal(committedBinding.sourceSha256, sourceSha256);
        assert.equal(receivedExecFileImpl, execFileImpl);
        workspaceBindings.push(receivedExecFileImpl);
      },
      verifyRollbackSafetySourceImpl: async () => ({
        schemaVersion:
          "wp13.12b-vercel-rollback-safety-source-binding-v1",
        sha256: "6".repeat(64),
        uploadManifestSha256: uploadManifest.sha256,
        uploadManifestBound: true,
        issuanceDeniedBeforeIdentityExchange: true,
        deleteRouteAvailable: true,
      }),
      evaluateCopyReviewImpl: async () => ({
        valid: true,
        deploymentAllowed: true,
        externalWrites: 0,
        sourceSetSha256: "7".repeat(64),
      }),
      buildDistImpl: async () => ({
        schemaVersion: "wp13.12b-vercel-static-dist-v1",
        artifactSha256: staticArtifactSha256,
        sourceSetSha256: "7".repeat(64),
        files: [],
      }),
      inspectCliImpl: async () => ({
        version: approvedVercelCli.version,
        npmIntegrity: approvedVercelCli.npmIntegrity,
        npmIntegritySha256: approvedVercelCliIntegritySha256,
        packageManifestSha256: "8".repeat(64),
        entrySha256: "9".repeat(64),
        entryPath: "test",
      }),
      verifyVercelCliRiskDecisionImpl: async () => ({
        decisionId: "wp13-12b-vercel-cli-58-risk-20260728-r1",
        status: "CONDITIONALLY_ACCEPTED_NOT_EXECUTED",
        executionStatus: "AUTHORIZED_FOR_CURRENT_EXACT_EXECUTION",
        conditionalAcceptanceRecorded: true,
        executionAuthorized: true,
        loginAuthorized: true,
        deploymentAuthorized: true,
        cleanupAuthorized: true,
        blocksCurrentExecution: false,
        toolchain: { version: approvedVercelCli.version },
        blocksExternalDeployment: false,
      }),
      runControlImpl: controlAdapter.runControlImpl,
      runCliImpl: cliAdapter.runCliImpl,
      readLinkedProjectImpl: async () => ({
        orgId: vercelScope.teamId,
        projectId: vercelScope.projectId,
        projectName: vercelScope.projectName,
      }),
      verifyWifDisabledImpl: wifAdapter.verifyWifDisabledImpl,
      protectedProbeImpl: probeAdapter.protectedProbeImpl,
      verifyPinnedVercelCliSnapshotImpl: () => ({}),
      now: () => new Date("2026-07-27T12:00:00.000Z"),
      waitImpl: async () => {},
    });
    const cliCalls = cliAdapter.calls;
    assert.equal(result.externalWrites, 3);
    assert.equal(result.target, "preview");
    assert.equal(result.deploymentRole, deploymentRole);
    assert.equal(result.vercelCli.version, approvedVercelCli.version);
    assert.equal(
      result.wifTransition.verifiedImmediatelyBeforeDeploy,
      true,
    );
    assert.equal(wifAdapter.calls.length, 3);
    assert.equal(controlAdapter.calls.length, 4);
    assert.equal(cliCalls.length, 4);
    assert.deepEqual(cliCalls[1].args.slice(0, 3), [
      "link",
      "--yes",
      "--project",
    ]);
    assert.equal(cliCalls[2].args.includes("--dry"), true);
    assert.equal(cliCalls[3].args.includes("--target=preview"), true);
    assert.equal(cliCalls[3].args.includes("--prod"), false);
    assert.equal(cliCalls.some(({ args }) => args[0] === "curl"), false);
    assert.equal(
      result.authenticatedBrowserProofContract
        .requiredBeforeEveryWifTrustEnable,
      true,
    );
    assert.equal(
      result.authenticatedBrowserProofContract
        .rollbackIssueProbe.denialClass,
      "ROLLBACK_SAFE_DISABLED",
    );
    assert.equal(
      result.authenticatedBrowserProofContract
        .protectionBypassPermitted,
      false,
    );
    assert.equal(
      result.authenticatedBrowserProofContract
        .newDeploymentsWhileWifLivePermitted,
      false,
    );
    assert.ok(cliCalls[3].args.includes(
      `ludysDryRunManifestSha256=${result.dryRunManifest.sha256}`,
    ));
    assert.equal(
      cliCalls[3].args.filter((value) => value === "--env").length,
      9,
    );
    assert.deepEqual(result.toolingRiskDecision, {
      decisionId: "wp13-12b-vercel-cli-58-risk-20260728-r1",
      version: approvedVercelCli.version,
      conditionalRiskAccepted: true,
      executionAuthorized: true,
      blocksExternalDeployment: false,
    });
    assert.equal(workspaceBindings.length, 6);
    assert.equal(
      workspaceBindings.every((value) => value === execFileImpl),
      true,
    );
    assert.equal(capabilityAssertions, 8);
    assert.equal(windowAssertions, 7);
    return result;
  }

  assert.equal((await exercise("rollback")).deploymentRole, "rollback");
  assert.equal((await exercise("active")).deploymentRole, "active");
});

test("preview test adapter rejects real CLI and global-fetch wrappers before invocation", () => {
  const controlAdapter =
    createScriptedVercelPreviewControlForTesting([
      { action: "inspect-project", result: {} },
    ]);
  const wifAdapter = createScriptedVercelWifReadbackForTesting([
    { complete: true },
  ]);
  const probeAdapter =
    createScriptedVercelProtectedProbeForTesting({});
  let cliInvocations = 0;
  let fetchInvocations = 0;
  const realCliWrapper = (...args) => {
    cliInvocations += 1;
    return execFileSync(...args);
  };
  const realFetchWrapper = (...args) => {
    fetchInvocations += 1;
    return globalThis.fetch(...args);
  };
  const common = {
    activationCapability: Object.freeze({}),
    assertBaseActivationCapabilityImpl() {},
    assertActivationWindowOpenImpl() {},
    runControlImpl: controlAdapter.runControlImpl,
    verifyWifDisabledImpl: wifAdapter.verifyWifDisabledImpl,
    protectedProbeImpl: probeAdapter.protectedProbeImpl,
  };
  assert.throws(
    () => runVercelPreviewDeployForTesting([], {
      ...common,
      runCliImpl: realCliWrapper,
    }),
    /IN_MEMORY_PREVIEW_TEST_ADAPTERS_REQUIRED/u,
  );
  const cliAdapter = createScriptedVercelPreviewCliForTesting([
    { kind: "version", output: approvedVercelCli.version },
  ]);
  assert.throws(
    () => runVercelPreviewDeployForTesting([], {
      ...common,
      runCliImpl: cliAdapter.runCliImpl,
      fetchImpl: realFetchWrapper,
    }),
    /IN_MEMORY_PREVIEW_TEST_ADAPTERS_REQUIRED/u,
  );
  assert.equal(cliInvocations, 0);
  assert.equal(fetchInvocations, 0);
});

test("preview wrapper rejects wrong authorization before preflight or CLI", () => {
  let calls = 0;
  assert.throws(
    () => runVercelPreviewDeploy([
      "--action", "deploy-preview",
      "--team-id", vercelScope.teamId,
      "--team-slug", vercelScope.teamSlug,
      "--project-id", vercelScope.projectId,
      "--project-name", vercelScope.projectName,
      "--target", "preview",
      "--deployment-role", "rollback",
      "--source-commit", repository.commit,
      "--source-tree", repository.tree,
      "--authorized", "WRONG",
    ], {
      repository,
      sourceSha256,
      evaluateCopyReviewImpl: async () => {
        calls += 1;
        return {};
      },
      runCliImpl: () => {
        calls += 1;
        return "";
      },
    }),
    /EXACT_EXTERNAL_ACTIVATION_AUTHORIZATION_REQUIRED/u,
  );
  assert.equal(calls, 0);
});

test("preview wrapper rejects injected tooling decision before preflight or CLI", () => {
  let calls = 0;
  assert.throws(
    () => runVercelPreviewDeploy([
      "--action", "deploy-preview",
      "--team-id", vercelScope.teamId,
      "--team-slug", vercelScope.teamSlug,
      "--project-id", vercelScope.projectId,
      "--project-name", vercelScope.projectName,
      "--target", "preview",
      "--deployment-role", "rollback",
      "--source-commit", repository.commit,
      "--source-tree", repository.tree,
      "--authorized", vercelScope.activationAuthorization,
    ], {
      repository,
      sourceSha256,
      verifyVercelCliRiskDecisionImpl: async () => {
        throw new Error("VERCEL_CLI_TOOLING_RISK_DECISION_REQUIRED");
      },
      evaluateCopyReviewImpl: async () => {
        calls += 1;
        return {};
      },
      runCliImpl: () => {
        calls += 1;
        return "";
      },
    }),
    /PRODUCTION_PREVIEW_DEPENDENCY_INJECTION_FORBIDDEN/u,
  );
  assert.equal(calls, 0);
});

test("preview CLI command cannot contain production flags", () => {
  const args = exactPreviewDeploymentArgs({
    commit: repository.commit,
    tree: repository.tree,
    sourceSha256,
    uploadManifestSha256: uploadManifest.sha256,
    dryRunManifestSha256: dryRunSha256,
    staticArtifactSha256,
    role: "active",
    rollbackBinding: {
      id: rollbackDeploymentId,
      url: rollbackOrigin,
      sourceCommit: repository.commit,
      sourceTree: repository.tree,
      evidenceSha256: rollbackEvidenceSha256,
    },
  });
  assert.ok(args.includes("--target=preview"));
  assert.equal(args.filter((value) => value === "--json").length, 1);
  assert.equal(args.includes("--prod"), false);
  assert.equal(args.includes("--target=production"), false);
  assert.ok(args.includes("ludysDeploymentRole=active"));
});

test("pinned CLI inspector rejects incomplete and synthetic toolchains", async () => {
  const root = await mkdtemp(join(tmpdir(), "ludys-vercel-cli-"));
  const moduleRoot = join(root, "node_modules");
  const packageRoot = join(moduleRoot, "vercel");
  const entryPath = join(packageRoot, "dist", "index.js");
  try {
    await mkdir(join(packageRoot, "dist"), { recursive: true });
    await writeFile(entryPath, "export {};\n", "utf8");
    await writeFile(join(packageRoot, "package.json"), JSON.stringify({
      name: "vercel",
      version: approvedVercelCli.version,
      bin: { vercel: "dist/index.js" },
    }), "utf8");
    const lock = {
      lockfileVersion: 3,
      packages: {
        "node_modules/vercel": {
          version: approvedVercelCli.version,
          resolved: approvedVercelCli.tarball,
          integrity: approvedVercelCli.npmIntegrity,
        },
      },
    };
    await writeFile(
      join(root, "package-lock.json"),
      JSON.stringify(lock),
      "utf8",
    );
    await assert.rejects(
      inspectPinnedVercelCli(moduleRoot),
      /PINNED_VERCEL_CLI_REQUIRED/u,
    );

    await writeFile(join(root, "package.json"), "{}\n", "utf8");
    lock.packages["node_modules/vercel"].integrity =
      "sha512-WRONG";
    await writeFile(
      join(root, "package-lock.json"),
      JSON.stringify(lock),
      "utf8",
    );
    await assert.rejects(
      inspectPinnedVercelCli(moduleRoot),
      /PINNED_VERCEL_CLI_INTEGRITY_MISMATCH/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("whole-tree verifier rejects a tampered unrelated transitive module", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ludys-vercel-tree-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const transitivePath = join(
    root,
    "node_modules",
    "transitive-dependency",
    "lib",
    "runtime.js",
  );
  await mkdir(dirname(transitivePath), { recursive: true });
  await writeFile(join(root, "package.json"), "{}\n", "utf8");
  await writeFile(join(root, "package-lock.json"), "{}\n", "utf8");
  await writeFile(transitivePath, "export const trusted = true;\n", "utf8");
  const approved =
    canonicalVercelToolchainTreeSnapshot(root);
  assert.doesNotThrow(
    () => verifyVercelToolchainTreeForTesting(root, approved),
  );
  const forbiddenInstallLog = join(
    root,
    "npm-install.stdout.log",
  );
  await writeFile(
    forbiddenInstallLog,
    "must not remain beside the audited runtime tree\n",
    "utf8",
  );
  assert.throws(
    () => canonicalVercelToolchainTreeSnapshot(root),
    /PINNED_VERCEL_CLI_INSTALL_LOG_FORBIDDEN/u,
  );
  await rm(forbiddenInstallLog, { force: true });
  await writeFile(
    transitivePath,
    "export const stealsCredential = true;\n",
    "utf8",
  );
  assert.throws(
    () => verifyVercelToolchainTreeForTesting(root, approved),
    /PINNED_VERCEL_CLI_TREE_INTEGRITY_MISMATCH/u,
  );

  const controlSource = await readFile(
    new URL("./provider-external-vercel-control.mjs", import.meta.url),
    "utf8",
  );
  const tokenLoader = controlSource.slice(
    controlSource.indexOf("function tokenFromCliConfig"),
    controlSource.indexOf("function createApiCaller"),
  );
  assert.ok(
    tokenLoader.indexOf("verifyPinnedVercelCliSnapshot(cli)")
      < tokenLoader.indexOf("cliConfig = require"),
  );
});

test("toolchain path ordering is explicit ASCII code-unit order", () => {
  const paths = ["a", "B", "b", ".x", "@x", "_x", "a-b", "a/b"];
  assert.deepEqual(
    paths.sort(compareVercelToolchainPaths),
    [".x", "@x", "B", "_x", "a", "a-b", "a/b", "b"],
  );
  assert.throws(
    () => compareVercelToolchainPaths("ascii", "norsk-ø"),
    /PINNED_VERCEL_CLI_NON_ASCII_PATH_FORBIDDEN/u,
  );
  assert.equal(
    approvedVercelCli.canonicalTreeSha256,
    "4d97f7ef1a2631946dd5344d29db7ad9b931782e24bd478ea2a4241e2a0f57fc",
  );
});
