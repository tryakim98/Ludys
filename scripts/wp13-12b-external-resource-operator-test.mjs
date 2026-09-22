import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import {
  APPROVED_VERCEL_CLI_AUTH_CONFIG_ROOT,
  APPROVED_SCOPE,
  APPROVED_TRUST,
  EXECUTION_EVIDENCE_PATHS,
  EXECUTION_AUTHORIZATION,
  assertExecutionAuthorization,
  assertExecutionEvidencePath,
  assertCanonicalEvidenceParentChainForTesting,
  assertExternalActionEnvironmentOverridesAbsent,
  assertInventoryOutputPath,
  assertVercelAbsentBeforeGoogleDestruction,
  assertWifProviderFanoutScope,
  buildDestructionCommands,
  buildInventoryReport,
  classifyBucket,
  collectFirestoreNestedCollectionEvidence,
  collectVercelDeployments,
  createDeactivationInMemoryTestAdapter,
  createSyntheticDeletionInMemoryTestAdapter,
  deriveSyntheticGrantRelationshipEvidence,
  executeDeactivationPlan,
  executeDeactivationPlanWithTestDoubles,
  executeExactVercelProjectDeletion,
  executeSyntheticDataDeletionWithTestDoubles,
  executionEvidenceCanonicalPath,
  exactDeleteSyntheticSessionFunctionUri,
  inspectFirestoreSyntheticDocument,
  isVercelAbsentForGoogleDestruction,
  listFirestoreRootCollectionIds,
  listAll,
  loadAndValidateOperatorContracts,
  materializeDeactivationPlan,
  materializeDestructionPlan,
  materializeInventoryEvidenceDocument,
  materializePreviewDestructionConfirmation,
  materializeSyntheticDataDeletionIntent,
  materializeSyntheticDataDeletionConfirmation,
  materializeSyntheticDataDeletionEvidencePlan,
  materializeVercelDestructionPlan,
  redactInventoryForEvidence,
  readExternalResourceOperatorInMemoryTestTranscript,
  recoverInterruptedEvidenceHardLinkForTesting,
  syntheticDataDeletionConfirmationText,
  syntheticDataDeletionInventoryBinding,
  reduceSyntheticDataDeletionTranscript,
  reduceVercelDestructionTranscript,
  validateCanonicalRegularEvidenceFileObservation,
  validateEvidenceTempBasenameForTesting,
  validateDeactivationEvidence,
  validateDestructionEvidence,
  validateExpiryDestructionContract,
  validateGoogleDestructionPreflightInventory,
  validatePinnedGoogleDestructionCommand,
  validatePreviewDestructionEvidence,
  validatePreviewDestructionConfirmation,
  validateSafeBackendForDestructionInventory,
  validateSyntheticDataDeletionConfirmation,
  validateSyntheticDataDeletionExecutionReceipt,
  validateSyntheticDeletionIdentityLifecycleReadback,
  validateSyntheticDataDeletionIntent,
  validateVercelDestructionPreflightInventory,
  vercelDestructionConfirmationText,
} from "./wp13-12b-external-resource-operator.mjs";
import {
  syntheticDeletionWindowCondition,
} from "./wp13-12b-deploy-identity.mjs";
import {
  approvedVercelCliModuleRoot,
} from "./wp13-12b-vercel-cli-toolchain.mjs";
import {
  sanitizedNodeChildEnvironmentForTesting,
} from "./wp13-12b-external-process-boundary.mjs";

const require = createRequire(import.meta.url);
const {
  assertFirebaseToolsTreeEntryMetadata,
  assertGoogleOAuthProductionEnvironment,
  snapshotFirebaseToolsTree,
  verifyFirebaseToolsTree,
} = require("./wp13-12b-google-oauth-token-helper.cjs");

assert.equal(
  APPROVED_VERCEL_CLI_AUTH_CONFIG_ROOT,
  "C:\\Users\\tryak\\AppData\\Local\\com.vercel.cli",
);
assert.equal(
  approvedVercelCliModuleRoot,
  "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
    + "vercel-cli-58.0.0\\node_modules",
);
assert.equal(
  assertGoogleOAuthProductionEnvironment(
    { SystemRoot: "C:\\Windows" },
    [],
  ),
  true,
);
for (const forbiddenEnvironment of [
  { NODE_OPTIONS: "--require=attacker.cjs" },
  { node_path: "C:\\attacker" },
  { HTTPS_PROXY: "http://127.0.0.1:8080" },
  { google_application_credentials: "attacker.json" },
]) {
  assert.throws(
    () => assertGoogleOAuthProductionEnvironment(
      forbiddenEnvironment,
      [],
    ),
    /GOOGLE_OAUTH_PRODUCTION_ENVIRONMENT_FORBIDDEN/u,
  );
}
assert.throws(
  () => assertGoogleOAuthProductionEnvironment({}, ["--inspect"]),
  /GOOGLE_OAUTH_PRODUCTION_ENVIRONMENT_FORBIDDEN/u,
);
assert.equal(
  assertExternalActionEnvironmentOverridesAbsent(
    { SystemRoot: "C:\\Windows" },
    [],
  ),
  true,
);
for (const forbiddenEnvironment of [
  { LUDYS_GCLOUD_BIN: "attacker.exe" },
  { ludys_firebase_bin: "attacker.cmd" },
  { CLOUDSDK_CONFIG: "C:\\attacker\\gcloud-config" },
  { cloudSdk_core_account: "attacker@example.invalid" },
  { NODE_OPTIONS: "--require=attacker.cjs" },
  { https_proxy: "http://127.0.0.1:8080" },
  { PYTHONPATH: "C:\\attacker\\python" },
  { SSL_CERT_FILE: "attacker.pem" },
]) {
  assert.throws(
    () => assertExternalActionEnvironmentOverridesAbsent(
      forbiddenEnvironment,
      [],
    ),
    /PRODUCTION_EXTERNAL_ACTION_ENVIRONMENT_OVERRIDE_FORBIDDEN/u,
  );
}
assert.throws(
  () => assertExternalActionEnvironmentOverridesAbsent({}, ["--inspect"]),
  /PRODUCTION_EXTERNAL_ACTION_ENVIRONMENT_OVERRIDE_FORBIDDEN/u,
);

const firebaseTreeTestRoot = await mkdtemp(
  join(tmpdir(), "ludys-firebase-tree-test-"),
);
try {
  const nestedDirectory = join(firebaseTreeTestRoot, "nested");
  await mkdir(nestedDirectory);
  const firstFile = join(firebaseTreeTestRoot, "z.txt");
  const transitiveFile = join(nestedDirectory, "a.txt");
  await writeFile(firstFile, "first", "utf8");
  await writeFile(transitiveFile, "transitive", "utf8");
  const expectedTree = snapshotFirebaseToolsTree(
    firebaseTreeTestRoot,
  );
  assert.deepEqual(
    snapshotFirebaseToolsTree(firebaseTreeTestRoot),
    expectedTree,
  );
  assert.deepEqual(
    verifyFirebaseToolsTree(firebaseTreeTestRoot, expectedTree),
    expectedTree,
  );

  await writeFile(transitiveFile, "tampered", "utf8");
  assert.throws(
    () => verifyFirebaseToolsTree(firebaseTreeTestRoot, expectedTree),
    /PINNED_FIREBASE_TOOLS_TREE_INTEGRITY_MISMATCH/u,
  );
  await writeFile(transitiveFile, "transitive", "utf8");

  const extraFile = join(firebaseTreeTestRoot, "extra.txt");
  await writeFile(extraFile, "extra", "utf8");
  assert.throws(
    () => verifyFirebaseToolsTree(firebaseTreeTestRoot, expectedTree),
    /PINNED_FIREBASE_TOOLS_TREE_INTEGRITY_MISMATCH/u,
  );
  await unlink(extraFile);

  const hardlinkFile = join(firebaseTreeTestRoot, "hardlink.txt");
  await link(firstFile, hardlinkFile);
  assert.throws(
    () => snapshotFirebaseToolsTree(firebaseTreeTestRoot),
    /PINNED_FIREBASE_TOOLS_HARDLINK_FORBIDDEN/u,
  );
  await unlink(hardlinkFile);

  const symlinkFile = join(firebaseTreeTestRoot, "symlink.txt");
  try {
    await symlink(firstFile, symlinkFile, "file");
    assert.throws(
      () => snapshotFirebaseToolsTree(firebaseTreeTestRoot),
      /PINNED_FIREBASE_TOOLS_SPECIAL_ENTRY_FORBIDDEN/u,
    );
    await unlink(symlinkFile);
  } catch (error) {
    if (!["EPERM", "EACCES"].includes(error?.code)) throw error;
    assert.throws(
      () => assertFirebaseToolsTreeEntryMetadata({
        isDirectory: () => false,
        isFile: () => false,
        isSymbolicLink: () => true,
      }),
      /PINNED_FIREBASE_TOOLS_SPECIAL_ENTRY_FORBIDDEN/u,
    );
  }
  assert.throws(
    () => assertFirebaseToolsTreeEntryMetadata({
      isDirectory: () => false,
      isFile: () => false,
      isSymbolicLink: () => false,
    }),
    /PINNED_FIREBASE_TOOLS_SPECIAL_ENTRY_FORBIDDEN/u,
  );
} finally {
  const canonicalTestRoot = await realpath(firebaseTreeTestRoot);
  const canonicalTmp = await realpath(tmpdir());
  if (!canonicalTestRoot.startsWith(`${canonicalTmp}${sep}`)) {
    throw new Error("FIREBASE_TREE_TEST_CLEANUP_SCOPE_INVALID");
  }
  await rm(canonicalTestRoot, { recursive: true, force: true });
}

const projectNumber = APPROVED_SCOPE.projectNumber;
const expectedPoolName =
  `projects/${projectNumber}/locations/global/workloadIdentityPools/`
  + APPROVED_SCOPE.workloadIdentityPoolId;
const expectedProviderName =
  `${expectedPoolName}/providers/${APPROVED_SCOPE.workloadIdentityProviderId}`;
const approvedFunctionNames = [
  "deleteSyntheticSession",
  "health",
  "issueSyntheticSession",
  "sessionCommand",
  "sessionProjection",
];
const functionUriForName = (name) => (
  `https://${name.toLowerCase()}-qbqbamvs6q-lz.a.run.app`
);
const approvedDeployServiceAccount =
  `ludys-staging-deployer@${APPROVED_SCOPE.projectId}.iam.gserviceaccount.com`;
const approvedBuildServiceAccount =
  `${projectNumber}-compute@developer.gserviceaccount.com`;
const requiredEnabledServices = [
  "artifactregistry.googleapis.com",
  "billingbudgets.googleapis.com",
  "cloudbilling.googleapis.com",
  "cloudbuild.googleapis.com",
  "cloudfunctions.googleapis.com",
  "cloudresourcemanager.googleapis.com",
  "firebase.googleapis.com",
  "firebasehosting.googleapis.com",
  "firebaserules.googleapis.com",
  "firestore.googleapis.com",
  "iam.googleapis.com",
  "iamcredentials.googleapis.com",
  "logging.googleapis.com",
  "run.googleapis.com",
  "secretmanager.googleapis.com",
  "serviceusage.googleapis.com",
  "storage.googleapis.com",
  "sts.googleapis.com",
];
const exactSubjectPrincipal = [
  "principal://iam.googleapis.com",
  `projects/${projectNumber}`,
  "locations/global",
  `workloadIdentityPools/${APPROVED_SCOPE.workloadIdentityPoolId}`,
  `subject/${APPROVED_TRUST.subject}`,
].join("/");
const rawInventory = {
  source: "LOCAL_TEST_FIXTURE",
  project: {
    projectId: APPROVED_SCOPE.projectId,
    projectNumber,
    lifecycleState: "ACTIVE",
    parent: {
      type: "organization",
      id: APPROVED_SCOPE.organizationId,
    },
  },
  billing: {
    projectId: APPROVED_SCOPE.projectId,
    billingAccountName: `billingAccounts/${APPROVED_SCOPE.billingAccount}`,
    billingEnabled: true,
  },
  budgets: [{
    name:
      `billingAccounts/${APPROVED_SCOPE.billingAccount}`
      + "/budgets/bb8cd353-7fed-4558-8242-b90daa37d87d",
    displayName: "LUDYS WP13.12B synthetic staging",
    amount: {
      specifiedAmount: {
        currencyCode: "NOK",
        units: "500",
        nanos: 0,
      },
    },
    budgetFilter: {
      projects: [`projects/${projectNumber}`],
    },
    thresholdRules: [
      { thresholdPercent: 1 },
      { thresholdPercent: 0.8 },
    ],
  }],
  services: requiredEnabledServices.map((name) => ({ config: { name } })),
  firestore: {
    name: `projects/${APPROVED_SCOPE.projectId}/databases/(default)`,
    locationId: APPROVED_SCOPE.region,
    type: "FIRESTORE_NATIVE",
    databaseEdition: "STANDARD",
    pointInTimeRecoveryEnablement: "POINT_IN_TIME_RECOVERY_DISABLED",
    deleteProtectionState: "DELETE_PROTECTION_DISABLED",
  },
  firestoreRootCollectionIds: ["syntheticStagingControl"],
  firestoreDocuments: [
    {
      collectionId: "syntheticCapabilityGrants",
      count: 0,
      documentNames: [],
      schemaValidation: {
        documentsChecked: 0,
        conformantDocuments: 0,
        allDocumentsConformant: true,
        payloadValuesPersistedOrPrinted: false,
      },
    },
    {
      collectionId: "syntheticSessions",
      count: 0,
      documentNames: [],
      schemaValidation: {
        documentsChecked: 0,
        conformantDocuments: 0,
        allDocumentsConformant: true,
        payloadValuesPersistedOrPrinted: false,
      },
    },
    {
      collectionId: "syntheticSessionTombstones",
      count: 0,
      documentNames: [],
      schemaValidation: {
        documentsChecked: 0,
        conformantDocuments: 0,
        allDocumentsConformant: true,
        payloadValuesPersistedOrPrinted: false,
      },
    },
  ],
  firestoreControlDocument: {
    name:
      `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
      + "syntheticStagingControl/current",
    fields: {
      controlEpoch: { integerValue: "2" },
      stagingEnabled: { booleanValue: false },
      reasonCode: { stringValue: "PROOF_WINDOW_CLOSED" },
      changedAt: { timestampValue: "2026-07-27T10:00:00.000Z" },
    },
    updateTime: "2026-07-27T10:00:01.000Z",
  },
  firestoreDatabaseAbsent: false,
  firestoreDataReadbackPerformed: true,
  firestoreNestedCollectionEvidence: {
    parentDocumentsChecked: 1,
    nestedCollectionCount: 0,
    noNestedCollections: true,
    nestedCollectionIdentifiersPersistedOrPrinted: false,
  },
  functions: approvedFunctionNames.map((name) => ({
    name:
      `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
      + `/functions/${name}`,
    state: "ACTIVE",
    environment: "GEN_2",
    buildConfig: {
      runtime: "nodejs24",
      entryPoint: name,
      serviceAccount: approvedBuildServiceAccount,
    },
    serviceConfig: {
      service: (
        `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
        + `/services/${name.toLowerCase()}`
      ),
      serviceAccountEmail: APPROVED_SCOPE.runtimeServiceAccount,
      uri: functionUriForName(name),
      minInstanceCount: 0,
      maxInstanceCount: 1,
      maxInstanceRequestConcurrency: 1,
      availableMemory: "256Mi",
      timeoutSeconds: 60,
      ingressSettings: "ALLOW_ALL",
      allTrafficOnLatestRevision: true,
      environmentVariables: {
        LUDYS_STAGING_RUNTIME_PHASE: "EXTERNAL_SYNTHETIC_STAGING",
        ...(name === "issueSyntheticSession"
          ? { LUDYS_STAGING_SESSION_ISSUANCE_ENABLED: "false" }
          : {}),
      },
      secretEnvironmentVariables: [{
        key: APPROVED_SCOPE.capabilitySecret,
        projectId: APPROVED_SCOPE.projectNumber,
        secret: APPROVED_SCOPE.capabilitySecret,
        version: "1",
      }],
    },
  })),
  runServices: approvedFunctionNames.map((name) => ({
    name:
      `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
      + `/services/${name.toLowerCase()}`,
    uri: functionUriForName(name),
    labels: {
      "cloud.googleapis.com/location": APPROVED_SCOPE.region,
      "goog-managed-by": "cloudfunctions",
    },
    template: {
      serviceAccount: APPROVED_SCOPE.runtimeServiceAccount,
    },
    ingress: "INGRESS_TRAFFIC_ALL",
  })),
  secrets: [{
    name:
      `projects/${projectNumber}/secrets/${APPROVED_SCOPE.capabilitySecret}`,
    replication: {
      userManaged: {
        replicas: [{ location: APPROVED_SCOPE.region }],
      },
    },
  }],
  secretVersions: [{
    name:
      `projects/${projectNumber}/secrets/${APPROVED_SCOPE.capabilitySecret}/versions/1`,
    state: "ENABLED",
  }],
  capabilitySecretIamPolicy: {
    bindings: [{
      role: "roles/secretmanager.secretAccessor",
      members: [`serviceAccount:${APPROVED_SCOPE.runtimeServiceAccount}`],
    }],
  },
  capabilitySecretIamPolicyReadbackPerformed: true,
  serviceAccounts: [
    {
      email: APPROVED_SCOPE.runtimeServiceAccount,
      disabled: false,
    },
    {
      email: APPROVED_SCOPE.previewServiceAccount,
      disabled: false,
    },
    {
      email: approvedDeployServiceAccount,
      disabled: false,
    },
    {
      email: approvedBuildServiceAccount,
      disabled: false,
    },
  ],
  runtimeKeys: [],
  runtimeKeysReadbackPerformed: true,
  deployServiceAccountKeys: [],
  deployServiceAccountKeysReadbackPerformed: true,
  buildServiceAccountKeys: [],
  buildServiceAccountKeysReadbackPerformed: true,
  deployServiceAccountIamPolicy: { bindings: [] },
  runtimeServiceAccountIamPolicy: { bindings: [] },
  buildServiceAccountIamPolicy: { bindings: [] },
  serviceAccountIamPolicyReadbackPerformed: true,
  iamPolicy: {
    bindings: [
      {
        role: "roles/datastore.user",
        members: [`serviceAccount:${APPROVED_SCOPE.runtimeServiceAccount}`],
      },
      {
        role: "roles/logging.logWriter",
        members: [
          `serviceAccount:${APPROVED_SCOPE.runtimeServiceAccount}`,
          `serviceAccount:${approvedBuildServiceAccount}`,
        ],
      },
    ],
  },
  iamPolicyReadbackPerformed: true,
  organizationIamPolicy: {
    version: 3,
    bindings: [],
  },
  organizationIamPolicyReadbackPerformed: true,
  workloadIdentityPools: [{
    name: expectedPoolName,
    state: "ACTIVE",
    disabled: true,
  }],
  workloadIdentityProviders: [{
    name: expectedProviderName,
    observedPoolName: expectedPoolName,
    state: "ACTIVE",
    disabled: true,
    attributeMapping: APPROVED_TRUST.attributeMapping,
    attributeCondition: APPROVED_TRUST.attributeCondition,
    oidc: {
      issuerUri: APPROVED_TRUST.issuer,
      allowedAudiences: [APPROVED_TRUST.audience],
    },
  }],
  previewServiceAccount: {
    name:
      `projects/${APPROVED_SCOPE.projectId}/serviceAccounts/`
      + APPROVED_SCOPE.previewServiceAccount,
    email: APPROVED_SCOPE.previewServiceAccount,
    disabled: false,
  },
  previewServiceAccountKeys: [],
  previewServiceAccountKeysReadbackPerformed: true,
  previewServiceAccountIamPolicy: {
    bindings: [{
      role: "roles/iam.workloadIdentityUser",
      members: [exactSubjectPrincipal],
    }],
  },
  runIamPolicies: [
    {
      serviceName:
        `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
        + "/services/issuesyntheticsession",
      policy: {
        bindings: [{
          role: "roles/run.invoker",
          members: [`serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`],
        }],
      },
    },
    {
      serviceName:
        `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
        + "/services/deletesyntheticsession",
      policy: {
        bindings: [{
          role: "roles/run.invoker",
          members: [`serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`],
        }],
      },
    },
    {
      serviceName:
        `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
        + "/services/health",
      policy: {
        bindings: [],
      },
    },
    {
      serviceName:
        `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
        + "/services/sessioncommand",
      policy: {
        bindings: [{
          role: "roles/run.invoker",
          members: ["allUsers"],
        }],
      },
    },
    {
      serviceName:
        `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
        + "/services/sessionprojection",
      policy: {
        bindings: [{
          role: "roles/run.invoker",
          members: ["allUsers"],
        }],
      },
    },
  ],
  buckets: [
    {
      name: `gcf-v2-sources-${projectNumber}-${APPROVED_SCOPE.region}`,
      location: "EUROPE-NORTH1",
    },
    {
      name: `artifacts.${APPROVED_SCOPE.projectId}.appspot.com`,
      location: "US",
    },
  ],
  artifactRepositories: [{
    name:
      `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
      + "/repositories/gcf-artifacts",
    format: "DOCKER",
  }],
  functionArtifactRepositoryIamPolicy: {
    bindings: [{
      role: "roles/artifactregistry.writer",
      members: [`serviceAccount:${approvedBuildServiceAccount}`],
    }],
  },
  functionSourceBucketIamPolicy: {
    bindings: [{
      role: "roles/storage.objectViewer",
      members: [`serviceAccount:${approvedBuildServiceAccount}`],
    }],
  },
  buildResourceIamPoliciesReadbackPerformed: true,
  hostingSites: [{
    name: `projects/${APPROVED_SCOPE.projectId}/sites/${APPROVED_SCOPE.projectId}`,
    siteId: APPROVED_SCOPE.projectId,
  }],
  hostingReleases: [],
  hostingVersions: [],
  hostingChannels: [],
  hostingContentReadbackPerformed: true,
  vercel: {
    source: "LOCAL_TEST_FIXTURE",
    authenticatedReadback: true,
    tokenPrinted: false,
    oidcTokenPrinted: false,
    team: {
      id: APPROVED_SCOPE.vercelTeamId,
      slug: APPROVED_SCOPE.vercelTeamSlug,
    },
    project: {
      id: APPROVED_SCOPE.vercelProjectId,
      name: APPROVED_SCOPE.vercelProjectName,
      accountId: APPROVED_SCOPE.vercelTeamId,
      createdAt: 1785113902226,
      live: false,
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
      webAnalytics: null,
      speedInsights: null,
      targets: {},
      domains: [],
      link: null,
    },
    deployments: [],
  },
};

assert.equal(
  exactDeleteSyntheticSessionFunctionUri(rawInventory),
  functionUriForName("deleteSyntheticSession"),
);
for (const mutateDeleteUriBinding of [
  (raw) => {
    raw.functions.find(
      ({ name }) => name.endsWith("/deleteSyntheticSession"),
    ).serviceConfig.uri =
      "https://deletesyntheticsession-short-lz.a.run.app";
  },
  (raw) => {
    raw.functions.find(
      ({ name }) => name.endsWith("/deleteSyntheticSession"),
    ).serviceConfig.service =
      `projects/wrong-project/locations/${APPROVED_SCOPE.region}`
      + "/services/deletesyntheticsession";
  },
  (raw) => {
    raw.functions.find(
      ({ name }) => name.endsWith("/deleteSyntheticSession"),
    ).serviceConfig.service =
      `projects/${APPROVED_SCOPE.projectId}/locations/us-central1`
      + "/services/deletesyntheticsession";
  },
  (raw) => {
    raw.runServices.find(
      ({ name }) => name.endsWith("/deletesyntheticsession"),
    ).uri = `${functionUriForName("deleteSyntheticSession")}/path`;
  },
  (raw) => {
    const value =
      `${functionUriForName("deleteSyntheticSession")}?redirect=1`;
    raw.functions.find(
      ({ name }) => name.endsWith("/deleteSyntheticSession"),
    ).serviceConfig.uri = value;
    raw.runServices.find(
      ({ name }) => name.endsWith("/deletesyntheticsession"),
    ).uri = value;
  },
]) {
  const mutated = structuredClone(rawInventory);
  mutateDeleteUriBinding(mutated);
  assert.throws(
    () => exactDeleteSyntheticSessionFunctionUri(mutated),
    /EXACT_PRIVATE_DELETE_SYNTHETIC_SESSION_URI_REQUIRED/u,
  );
}

const safeBackendOrigin =
  "https://ludys-wp13-12b-staging-dplactive-trym-s-projects.vercel.app";
function safeBackendRawInventory({
  controlEpoch = 9,
  poolDisabled = true,
  providerDisabled = true,
  tombstoneIds = [
    "synthetic-wp13-12b-abcdefghijklmnopqrst",
  ],
} = {}) {
  const raw = structuredClone(rawInventory);
  raw.source = "LIVE_READ_ONLY_PROVIDER_QUERIES";
  raw.vercel.source = "LIVE_AUTHENTICATED_VERCEL_API";
  raw.firestoreControlDocument.fields.controlEpoch.integerValue =
    String(controlEpoch);
  raw.firestoreControlDocument.fields.stagingEnabled.booleanValue = false;
  raw.firestoreControlDocument.fields.reasonCode.stringValue =
    "EXPIRY_DESTRUCTION";
  for (const fn of raw.functions) {
    fn.serviceConfig.environmentVariables
      .LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN = safeBackendOrigin;
  }
  raw.workloadIdentityPools[0].disabled = poolDisabled;
  raw.workloadIdentityProviders[0].disabled = providerDisabled;
  const tombstones = raw.firestoreDocuments.find(
    ({ collectionId }) =>
      collectionId === "syntheticSessionTombstones",
  );
  tombstones.count = tombstoneIds.length;
  tombstones.documentNames = tombstoneIds.map(
    (id) =>
      `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
      + `syntheticSessionTombstones/${id}`,
  );
  tombstones.schemaValidation.documentsChecked = tombstoneIds.length;
  tombstones.schemaValidation.conformantDocuments = tombstoneIds.length;
  if (
    tombstoneIds.length > 0
    && !raw.firestoreRootCollectionIds.includes(
      "syntheticSessionTombstones",
    )
  ) {
    raw.firestoreRootCollectionIds.push(
      "syntheticSessionTombstones",
    );
  }
  raw.firestoreNestedCollectionEvidence.parentDocumentsChecked =
    1 + tombstoneIds.length;
  raw.vercel.deployments = [{
    uid: "dpl_active_safe_backend",
    projectId: APPROVED_SCOPE.vercelProjectId,
    name: APPROVED_SCOPE.vercelProjectName,
    target: null,
    state: "READY",
    created: 1785113902226,
    url: safeBackendOrigin,
  }];
  return raw;
}

const syntheticDeletionObservedAt =
  "2027-01-25T00:05:00.000Z";
const syntheticDeletionWindowExpiresAt =
  "2027-01-25T00:20:00.000Z";
function syntheticDeletionAuthorizedRawInventory({
  tombstoneIds,
} = {}) {
  const raw = safeBackendRawInventory({ tombstoneIds });
  const condition = syntheticDeletionWindowCondition(
    syntheticDeletionWindowExpiresAt,
  );
  raw.deployServiceAccountIamPolicy = {
    bindings: [{
      role: "roles/iam.serviceAccountTokenCreator",
      members: [
        `user:${APPROVED_SCOPE.approvedGoogleAccount}`,
      ],
      condition,
    }],
  };
  const deletePolicy = raw.runIamPolicies.find(
    ({ serviceName }) =>
      serviceName.endsWith("/deletesyntheticsession"),
  );
  deletePolicy.policy.bindings.push({
    role: "roles/run.invoker",
    members: [`serviceAccount:${approvedDeployServiceAccount}`],
    condition,
  });
  raw.firestoreGrantRelationshipEvidence =
    deriveSyntheticGrantRelationshipEvidence([], []);
  return raw;
}

function syntheticDeletionRevokedRawInventory({
  tombstoneIds,
} = {}) {
  const raw = safeBackendRawInventory({ tombstoneIds });
  raw.vercel = {
    source:
      "INTENTIONALLY_NOT_COLLECTED_GOOGLE_ONLY_SYNTHETIC_DELETION",
    tokenPrinted: false,
    oidcTokenPrinted: false,
  };
  return raw;
}

function syntheticDeletionIdentityLifecycleReadback(
  action,
  externalWrites = 0,
) {
  const deletionOnly =
    action === "downscope-for-synthetic-deletion";
  const revoked = action === "revoke-deletion-identity";
  const value = {
    schemaVersion: "wp13.12b-ea-deploy-identity-readback-v3",
    action,
    projectId: APPROVED_SCOPE.projectId,
    deployServiceAccount: approvedDeployServiceAccount,
    runtimeServiceAccount: APPROVED_SCOPE.runtimeServiceAccount,
    previewServiceAccount: APPROVED_SCOPE.previewServiceAccount,
    buildServiceAccount: approvedBuildServiceAccount,
    windowExpiresAt: syntheticDeletionWindowExpiresAt,
    authorityState: deletionOnly
      ? "SYNTHETIC_DELETION_ONLY"
      : "ALL_DEPLOY_AND_DELETION_AUTHORITY_REVOKED",
    broadDeployBindingsRevoked: true,
    impersonationAndDeployBindingsRevoked: revoked,
    deletionOnlyAuthorityActive: deletionOnly,
    allDeployAndDeletionAuthorityRevoked: revoked,
    deleteSyntheticSessionResource:
      `projects/${APPROVED_SCOPE.projectId}/locations/`
      + `${APPROVED_SCOPE.region}/services/deletesyntheticsession`,
    syntheticDeletionOrdinaryGraceEndsAt:
      "2027-01-26T00:00:00.000Z",
    parentScopeEvidence: {
      schemaVersion: "wp13.12b-ea-parent-scope-evidence-v1",
      organizationId: APPROVED_SCOPE.organizationId,
      organizationIamPolicyReadbackPerformed: true,
      prohibitedInheritedBindingCount: 0,
      directApprovedServiceAccountBindingsAbsent: true,
      publicBindingsAbsent: true,
      principalSetBindingsAbsent: true,
      unresolvedOrBroadPrincipalBindingsAbsent: true,
      sensitiveDirectPrincipalRoleBindingsAbsent: true,
      unresolvedCustomRoleBindingsAbsent: true,
    },
    projectScopeEvidence: {
      schemaVersion: "wp13.12b-ea-project-scope-evidence-v1",
      projectId: APPROVED_SCOPE.projectId,
      projectIamPolicyReadbackPerformed: true,
      prohibitedBroadPrincipalBindingCount: 0,
      publicBindingsAbsent: true,
      principalSetBindingsAbsent: true,
      unresolvedOrBroadPrincipalBindingsAbsent: true,
    },
    resourcePolicyEvidence: {
      schemaVersion: "wp13.12b-ea-resource-policy-evidence-v1",
      resourcePolicyReadbackPerformed: true,
      prohibitedBindingCount: 0,
      exactApprovedIdentityAllowlistConformant: true,
    },
    deletionRunPolicyEvidence: {
      schemaVersion:
        "wp13.12b-ea-deletion-run-policy-evidence-v1",
      runServicePoliciesReadbackPerformed: true,
      exactRunServicePolicyTargetSet: true,
      deleteSyntheticSessionResource:
        `projects/${APPROVED_SCOPE.projectId}/locations/`
        + `${APPROVED_SCOPE.region}/services/deletesyntheticsession`,
      expectedConditionalDeletionInvokerPresent: deletionOnly,
      directDeployBindingCount: deletionOnly ? 1 : 0,
      prohibitedPrincipalSetBindingCount: 0,
      deployAuthorityLimitedToExactDeletionInvoker: deletionOnly,
      allDeployRunInvokerAuthorityAbsent: revoked,
    },
    externalWrites,
    validationErrors: [],
    tokenPrinted: false,
    credentialFileCreated: false,
  };
  assert.equal(
    validateSyntheticDeletionIdentityLifecycleReadback(
      value,
      action,
      syntheticDeletionWindowExpiresAt,
    ),
    true,
  );
  return value;
}

const scriptedValue = (value) => ({ value });
const scriptedError = (errorCode) => ({ errorCode });

function syntheticDeletionTestAdapter({
  allowDeleteInvoker = false,
  deleteResults = [],
  downscopeSteps,
  evidenceWriteMode = "CAPTURE",
  inventories,
  optionalEvidence = {},
  revokeSteps,
}) {
  return createSyntheticDeletionInMemoryTestAdapter({
    allowDeleteInvoker,
    deleteResults,
    downscopeSteps,
    evidenceWriteMode,
    inventories,
    now: syntheticDeletionObservedAt,
    optionalEvidence,
    revokeSteps,
  });
}

function deactivationTestAdapter({
  commands = [],
  inventories,
  repeatLastInventory = true,
  syntheticDataDeletionConfirmation,
  syntheticDataDeletionEvidence,
}) {
  return createDeactivationInMemoryTestAdapter({
    commands,
    inventories,
    repeatLastInventory,
    syntheticDataDeletionConfirmation,
    syntheticDataDeletionEvidence,
  });
}

function deactivationCommandStep(step, output) {
  return {
    step,
    result: {
      step,
      status: "EXECUTED_PROVIDER_CONFIRMED_EXIT_ZERO",
      stdout: JSON.stringify(output),
    },
  };
}

function disabledWifVerificationOutput() {
  return {
    schemaVersion: "wp13.12b-ea-external-wif-control-v1",
    projectId: APPROVED_SCOPE.projectId,
    action: "verify-disabled",
    complete: true,
    state: {
      provider: {
        present: true,
        name: expectedProviderName,
        disabled: true,
      },
      pool: {
        present: true,
        name: expectedPoolName,
        disabled: true,
      },
    },
    accessTokenPrinted: false,
    oidcTokenPrinted: false,
  };
}

function markAuthenticatedVercelProjectAbsence(raw) {
  raw.vercel.project = null;
  raw.vercel.deployments = [];
  raw.vercel.deploymentsReadbackAfterProjectAbsence = true;
  raw.vercel.domainsObservedAfterProjectAbsence = 0;
  raw.vercel.domainsReadbackAfterProjectAbsence = true;
  raw.vercel.environmentVariablesObservedAfterProjectAbsence = 0;
  raw.vercel.environmentVariablesReadbackAfterProjectAbsence = true;
  raw.vercel.projectSettingsReadbackAfterProjectAbsence = true;
  raw.vercel.projectSettingsAbsentAfterProjectAbsence = true;
  return raw;
}

for (const forbiddenExecutable of [globalThis.fetch, spawnSync]) {
  assert.throws(
    () => createSyntheticDeletionInMemoryTestAdapter({
      allowDeleteInvoker: false,
      deleteResults: [],
      downscopeSteps: [],
      evidenceWriteMode: "CAPTURE",
      inventories: [scriptedValue({ forbiddenExecutable })],
      now: syntheticDeletionObservedAt,
      optionalEvidence: {},
      revokeSteps: [],
    }),
    /DECLARATIVE_IN_MEMORY_TEST_SCRIPT_REQUIRED/u,
  );
}
let legacyWrapperPropertyAccessCount = 0;
const legacySyntheticWrapper = {};
Object.defineProperty(
  legacySyntheticWrapper,
  "collectReadOnlyInventoryImpl",
  {
    get() {
      legacyWrapperPropertyAccessCount += 1;
      return globalThis.fetch;
    },
  },
);
await assert.rejects(
  executeSyntheticDataDeletionWithTestDoubles({}, legacySyntheticWrapper),
  /MODULE_CREATED_IN_MEMORY_TEST_ADAPTER_REQUIRED/u,
);
const legacyDeactivationWrapper = {};
Object.defineProperty(
  legacyDeactivationWrapper,
  "executeCommandImpl",
  {
    get() {
      legacyWrapperPropertyAccessCount += 1;
      return spawnSync;
    },
  },
);
await assert.rejects(
  executeDeactivationPlanWithTestDoubles({}, 0, legacyDeactivationWrapper),
  /MODULE_CREATED_IN_MEMORY_TEST_ADAPTER_REQUIRED/u,
);
assert.equal(legacyWrapperPropertyAccessCount, 0);

const operatorContracts = await loadAndValidateOperatorContracts();
const operatorExports = await import(
  "./wp13-12b-external-resource-operator.mjs"
);
assert.equal(
  Object.hasOwn(
    operatorExports,
    "executeExactVercelProjectDeletionWithTestDoubles",
  ),
  false,
);
assert.equal(
  validateExpiryDestructionContract(
    operatorContracts.executionContract,
    operatorContracts.destructionPlan,
  ),
  true,
);
const canonicalEvidencePathBeforeCwdChange =
  executionEvidenceCanonicalPath(
    "deactivation",
    EXECUTION_EVIDENCE_PATHS.deactivation,
  );
const originalWorkingDirectory = process.cwd();
try {
  process.chdir("..");
  assert.equal(
    executionEvidenceCanonicalPath(
      "deactivation",
      EXECUTION_EVIDENCE_PATHS.deactivation,
    ),
    canonicalEvidencePathBeforeCwdChange,
  );
} finally {
  process.chdir(originalWorkingDirectory);
}
const canonicalRegularFileObservation = {
  lstatIsFile: true,
  lstatIsSymbolicLink: false,
  openedIsFile: true,
  canonicalPathMatches: true,
  sameOpenedFileIdentity: true,
  linkCount: 1,
};
assert.equal(
  validateCanonicalRegularEvidenceFileObservation(
    canonicalRegularFileObservation,
  ),
  true,
);
for (const unsafeObservation of [
  {
    ...canonicalRegularFileObservation,
    lstatIsFile: false,
    lstatIsSymbolicLink: true,
  },
  {
    ...canonicalRegularFileObservation,
    canonicalPathMatches: false,
  },
  {
    ...canonicalRegularFileObservation,
    sameOpenedFileIdentity: false,
  },
  {
    ...canonicalRegularFileObservation,
    linkCount: 2,
  },
]) {
  assert.throws(
    () => validateCanonicalRegularEvidenceFileObservation(
      unsafeObservation,
    ),
    /CANONICAL_REGULAR_UNLINKED_EVIDENCE_FILE_REQUIRED/u,
  );
}
assert.equal(
  validateEvidenceTempBasenameForTesting(
    "deactivation-execution-receipt.json",
    "deactivation-execution-receipt.json.tmp-4812-"
      + "0123456789abcdef0123456789abcdef",
  ),
  true,
);
assert.throws(
  () => validateEvidenceTempBasenameForTesting(
    "deactivation-execution-receipt.json",
    "deactivation-execution-receipt.json.tmp-4812-malicious.mjs",
  ),
  /INTERRUPTED_EVIDENCE_TEMP_NAME_INVALID/u,
);
assert.equal(
  validateEvidenceTempBasenameForTesting(
    "deactivation-execution-receipt.json",
    "unrelated-file.tmp-4812-0123456789abcdef0123456789abcdef",
  ),
  false,
);

const evidenceFilesystemTestRoot = await mkdtemp(
  join(tmpdir(), "ludys-evidence-filesystem-"),
);
try {
  const recoveryPath = EXECUTION_EVIDENCE_PATHS.deactivation;
  const recoveryTarget = join(
    evidenceFilesystemTestRoot,
    ...recoveryPath.split("/"),
  );
  const recoveryTemp =
    `${recoveryTarget}.tmp-731-0123456789abcdef0123456789abcdef`;
  await mkdir(join(recoveryTarget, ".."), { recursive: true });
  await writeFile(recoveryTarget, "{}\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  if (process.platform !== "win32") {
    await chmod(recoveryTarget, 0o600);
  }
  await link(recoveryTarget, recoveryTemp);
  assert.equal((await lstat(recoveryTarget)).nlink, 2);
  assert.equal(
    await recoverInterruptedEvidenceHardLinkForTesting(
      evidenceFilesystemTestRoot,
      recoveryPath,
    ),
    true,
  );
  assert.equal((await lstat(recoveryTarget)).nlink, 1);
  await assert.rejects(
    lstat(recoveryTemp),
    (error) => error?.code === "ENOENT",
  );

  const maliciousSibling =
    `${recoveryTarget}.tmp-731-malicious-sibling.mjs`;
  await writeFile(maliciousSibling, "not evidence\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  await assert.rejects(
    recoverInterruptedEvidenceHardLinkForTesting(
      evidenceFilesystemTestRoot,
      recoveryPath,
    ),
    /INTERRUPTED_EVIDENCE_TEMP_NAME_INVALID/u,
  );
} finally {
  const canonicalEvidenceFilesystemTestRoot =
    await realpath(evidenceFilesystemTestRoot);
  await rm(canonicalEvidenceFilesystemTestRoot, {
    recursive: true,
    force: true,
  });
}

const evidenceParentTestRoot = await mkdtemp(
  join(tmpdir(), "ludys-evidence-parent-"),
);
try {
  const canonicalArtifacts = join(evidenceParentTestRoot, "artifacts");
  await mkdir(canonicalArtifacts);
  assert.equal(
    await assertCanonicalEvidenceParentChainForTesting(
      evidenceParentTestRoot,
      "artifacts/wp13-12b-external-resource-inventory.json",
    ),
    true,
  );

  const alternateActual = join(evidenceParentTestRoot, "alternate-actual");
  const receiptParent = join(
    evidenceParentTestRoot,
    "release",
    "wp13-12b",
    "receipts",
  );
  await mkdir(alternateActual, { recursive: true });
  await mkdir(receiptParent, { recursive: true });
  let symlinkCreated = false;
  try {
    await symlink(
      alternateActual,
      join(receiptParent, "actual"),
      "junction",
    );
    symlinkCreated = true;
  } catch (error) {
    if (!["EPERM", "EACCES", "EINVAL"].includes(error?.code)) throw error;
  }
  if (symlinkCreated) {
    await assert.rejects(
      assertCanonicalEvidenceParentChainForTesting(
        evidenceParentTestRoot,
        EXECUTION_EVIDENCE_PATHS.deactivation,
      ),
      /CANONICAL_EVIDENCE_PARENT_REQUIRED/u,
    );
  }
} finally {
  const canonicalEvidenceParentTestRoot =
    await realpath(evidenceParentTestRoot);
  await rm(canonicalEvidenceParentTestRoot, {
    recursive: true,
    force: true,
  });
}

const operatorSource = await readFile(
  new URL("./wp13-12b-external-resource-operator.mjs", import.meta.url),
  "utf8",
);
const canonicalWriterSource = operatorSource.slice(
  operatorSource.indexOf("async function writeCanonicalExclusiveContent"),
  operatorSource.indexOf("async function writeExecutionEvidence"),
);
assert.match(
  canonicalWriterSource,
  /recoverInterruptedEvidenceHardLink\(path\)/u,
);
assert.match(canonicalWriterSource, /randomBytes\(16\)/u);
assert.match(canonicalWriterSource, /open\(tempPath, "wx", 0o600\)/u);
assert.match(canonicalWriterSource, /handle\.sync\(\)/u);
assert.match(canonicalWriterSource, /await link\(tempPath, parent\.targetPath\)/u);
assert.match(canonicalWriterSource, /syncEvidenceParent/u);
const inventoryWriterSource = operatorSource.slice(
  operatorSource.indexOf("export async function writeInventoryEvidence"),
  operatorSource.indexOf("async function readCanonicalRegularBytes"),
);
assert.match(inventoryWriterSource, /writeCanonicalExclusiveContent/u);
const executionWriterSource = operatorSource.slice(
  operatorSource.indexOf("async function writeExecutionEvidence"),
  operatorSource.indexOf("export async function loadAndValidateOperatorContracts"),
);
assert.match(executionWriterSource, /writeCanonicalExclusiveContent/u);

const unsafeContractMutations = [
  (contract) => {
    contract.executionClockPhases.syntheticDeletionTransition
      .minimumDeletionOnlyWindowMinutes = 4;
  },
  (contract) => {
    contract.runtimeExecutionSafeguards
      .syntheticDeletionIdentityRevocationRunsInGuaranteedFinally = false;
  },
  (contract) => {
    contract.requiredEvidence.syntheticDataDeletionExecutionReceipt
      .acceptedExecutionClassifications.pop();
  },
  (contract) => {
    contract.requiredEvidence.syntheticDataDeletionIntent.path =
      "artifacts/unreviewed-intent.json";
  },
  (contract) => {
    contract.materialization.firebaseToolsOAuthToolchain.treeSha256 =
      "0".repeat(64);
  },
  (contract) => {
    contract.materialization.googleCloudCliToolchain.treeSha256 =
      "0".repeat(64);
  },
  (contract) => {
    [
      contract.destructionOrderActionIds[3],
      contract.destructionOrderActionIds[5],
    ] = [
      contract.destructionOrderActionIds[5],
      contract.destructionOrderActionIds[3],
    ];
  },
  (contract) => {
    contract.runtimeExecutionSafeguards
      .safeBackendReadbackMustPrecedeWifDisable = false;
  },
  (contract) => {
    contract.repeatSafety
      .freshAuthenticatedInventoryRequiredBeforeEveryGoogleResume = false;
  },
  (contract) => {
    contract.repeatSafety.readyVercelDeploymentRequiredAfterVercelDeletion =
      true;
  },
  (contract) => {
    contract.runtimeExecutionSafeguards
      .deactivationExecutionRequiresDirectLiveSafeBackendInventory = false;
  },
  (contract) => {
    contract.requiredEvidence.safeBackendTransition.preTrustRemovalInventory
      .requiredBeforeEveryWifDisableOrResume = false;
  },
  (contract) => {
    contract.repeatSafety
      .alreadyDisabledWifSubstepsAreSkippedOnlyAfterFreshExactReadback = false;
  },
  (contract) => {
    contract.requiredEvidence.syntheticDataDeletion
      .liveInventoryDigestMustMatchAtDeactivationAndGoogleDestruction = false;
  },
  (contract) => {
    contract.materialization.executionEvidencePaths.syntheticDataDeletion =
      "artifacts/unreviewed-evidence.json";
  },
  (contract) => {
    contract.runtimeExecutionSafeguards
      .vercelProductionMutatorUsesOnlyActualWallClockAndRealLiveClients =
      false;
  },
  (contract) => {
    contract.runtimeExecutionSafeguards
      .noExportedVercelMutatorAcceptsInjectedClockInventoryOrProvider =
      false;
  },
  (contract) => {
    contract.runtimeExecutionSafeguards
      .executionEvidenceReadsRequireRegularNonSymlinkSingleLinkFiles =
      false;
  },
  (contract) => {
    contract.runtimeExecutionSafeguards
      .humanConfirmationUsesSeparateImmutableDigestBoundRecorderArtifacts =
      false;
  },
  (contract) => {
    contract.runtimeExecutionSafeguards
      .vercelPostAbsenceReadbacksRequireProjectSettings404AndEmptyDeploymentsDomainsAndEnvironment =
      false;
  },
  (contract) => {
    contract.runtimeExecutionSafeguards
      .billingUnlinkIsEmittedOnlyWhenFreshInventoryShowsLinked = false;
  },
  (contract) => {
    contract.runtimeExecutionSafeguards
      .alreadyAbsentGoogleProjectIsExplicitZeroCommandNoOp = false;
  },
  (contract) => {
    contract.materialization.executionEvidencePaths
      .syntheticDataDeletionConfirmation =
      "artifacts/unreviewed-confirmation.json";
  },
  (contract) => {
    contract.requiredEvidence.protectedPreviewConfirmation
      .requiredFalseFields[1] = "signatureAllowed";
  },
];
for (const mutate of unsafeContractMutations) {
  const executionContract = structuredClone(
    operatorContracts.executionContract,
  );
  mutate(executionContract);
  assert.throws(
    () => validateExpiryDestructionContract(
      executionContract,
      operatorContracts.destructionPlan,
    ),
    /EXPIRY_DESTRUCTION_CONTRACT_SEQUENCE_MISMATCH/u,
  );
}
const unsafeDestructionPlan = structuredClone(operatorContracts.destructionPlan);
[
  unsafeDestructionPlan.orderedCommands[5],
  unsafeDestructionPlan.orderedCommands[9],
] = [
  unsafeDestructionPlan.orderedCommands[9],
  unsafeDestructionPlan.orderedCommands[5],
];
assert.throws(
  () => validateExpiryDestructionContract(
    operatorContracts.executionContract,
    unsafeDestructionPlan,
  ),
  /EXPIRY_DESTRUCTION_CONTRACT_SEQUENCE_MISMATCH/u,
);
const wifBeforeSyntheticEvidencePlan = structuredClone(
  operatorContracts.destructionPlan,
);
[
  wifBeforeSyntheticEvidencePlan.orderedCommands[7],
  wifBeforeSyntheticEvidencePlan.orderedCommands[9],
] = [
  wifBeforeSyntheticEvidencePlan.orderedCommands[9],
  wifBeforeSyntheticEvidencePlan.orderedCommands[7],
];
assert.throws(
  () => validateExpiryDestructionContract(
    operatorContracts.executionContract,
    wifBeforeSyntheticEvidencePlan,
  ),
    /EXPIRY_DESTRUCTION_CONTRACT_SEQUENCE_MISMATCH/u,
  );
const previewConfirmationAfterGooglePlan = structuredClone(
  operatorContracts.destructionPlan,
);
[
  previewConfirmationAfterGooglePlan.orderedCommands[14],
  previewConfirmationAfterGooglePlan.orderedCommands[16],
] = [
  previewConfirmationAfterGooglePlan.orderedCommands[16],
  previewConfirmationAfterGooglePlan.orderedCommands[14],
];
assert.throws(
  () => validateExpiryDestructionContract(
    operatorContracts.executionContract,
    previewConfirmationAfterGooglePlan,
  ),
  /EXPIRY_DESTRUCTION_CONTRACT_SEQUENCE_MISMATCH/u,
);
const wrongDestructionPlanSchema = structuredClone(
  operatorContracts.destructionPlan,
);
wrongDestructionPlanSchema.schemaVersion = "wp13.12b-staging-destruction-v2";
assert.throws(
  () => validateExpiryDestructionContract(
    operatorContracts.executionContract,
    wrongDestructionPlanSchema,
  ),
  /EXPIRY_DESTRUCTION_CONTRACT_SEQUENCE_MISMATCH/u,
);

let googlePage = 0;
assert.deepEqual(
  await listAll(async () => {
    googlePage += 1;
    return {
      value: googlePage === 1
        ? { items: [{ id: 1 }], nextPageToken: "next-page" }
        : { items: [{ id: 2 }] },
    };
  }, "TEST", "https://example.invalid/items", "items"),
  [{ id: 1 }, { id: 2 }],
);
await assert.rejects(
  listAll(
    async () => ({
      value: { items: [], nextPageToken: "repeated-page" },
    }),
    "TEST",
    "https://example.invalid/items",
    "items",
  ),
  /INVENTORY_CURSOR_INVALID_OR_REPEATED_TEST/u,
);
let vercelPage = 0;
assert.deepEqual(
  await collectVercelDeployments(async () => {
    vercelPage += 1;
    return {
      value: vercelPage === 1
        ? {
            deployments: [{ uid: "first" }],
            pagination: { next: 1234 },
          }
        : { deployments: [{ uid: "second" }], pagination: {} },
    };
  }),
  [{ uid: "first" }, { uid: "second" }],
);
await assert.rejects(
  collectVercelDeployments(async () => ({
    value: {
      deployments: [],
      pagination: { next: 1234 },
    },
  })),
  /VERCEL_DEPLOYMENT_CURSOR_INVALID_OR_REPEATED/u,
);
await assert.rejects(
  listFirestoreRootCollectionIds(
    async () => ({
      value: {
        collectionIds: ["syntheticSessions"],
        nextPageToken: "repeated-page",
      },
    }),
    "https://example.invalid/documents:listCollectionIds",
  ),
  /FIRESTORE_COLLECTION_CURSOR_INVALID_OR_REPEATED/u,
);
assert.equal(assertWifProviderFanoutScope([]).length, 0);
assert.equal(assertWifProviderFanoutScope([{ name: expectedPoolName }]).length, 1);
assert.throws(
  () => assertWifProviderFanoutScope([
    { name: expectedPoolName },
    { name: `${expectedPoolName}-unexpected` },
  ]),
  /WIF_PROVIDER_FANOUT_SCOPE_EXCEEDED/u,
);
const nestedParent =
  `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
  + "syntheticSessions/synthetic-wp13-12b-abcdefghijklmnopqrst";
const noNestedEvidence = await collectFirestoreNestedCollectionEvidence(
  async () => ({ value: { collectionIds: [] } }),
  [nestedParent],
);
assert.deepEqual(noNestedEvidence, {
  parentDocumentsChecked: 1,
  nestedCollectionCount: 0,
  noNestedCollections: true,
  nestedCollectionIdentifiersPersistedOrPrinted: false,
});
const nestedEvidence = await collectFirestoreNestedCollectionEvidence(
  async () => ({ value: { collectionIds: ["unexpectedNested"] } }),
  [nestedParent],
);
assert.equal(nestedEvidence.noNestedCollections, false);
assert.equal(JSON.stringify(nestedEvidence).includes("unexpectedNested"), false);

assert.equal(
  classifyBucket(
    `gcf-v2-sources-${projectNumber}-${APPROVED_SCOPE.region}`,
    projectNumber,
  ),
  "FUNCTIONS_BUILD_SUPPORTING_ARTIFACT",
);
assert.equal(
  classifyBucket(`${APPROVED_SCOPE.projectId}.firebasestorage.app`, projectNumber),
  "APP_CLOUD_STORAGE_FORBIDDEN",
);
assert.equal(
  classifyBucket("unrelated-bucket", projectNumber),
  "UNCLASSIFIED_BUCKET_BLOCKING",
);

const report = buildInventoryReport(rawInventory);
const rawInventoryWithDestroyedVercel = structuredClone(rawInventory);
markAuthenticatedVercelProjectAbsence(rawInventoryWithDestroyedVercel);
const googleDestructionReport = buildInventoryReport(
  rawInventoryWithDestroyedVercel,
);
for (const [field, blocker] of [
  [
    "deploymentsReadbackAfterProjectAbsence",
    "VERCEL_DEPLOYMENTS_AFTER_PROJECT_ABSENCE_READBACK_REQUIRED",
  ],
  [
    "domainsReadbackAfterProjectAbsence",
    "VERCEL_DOMAINS_AFTER_PROJECT_ABSENCE_NOT_PROVEN_EMPTY",
  ],
  [
    "environmentVariablesReadbackAfterProjectAbsence",
    "VERCEL_ENVIRONMENT_AFTER_PROJECT_ABSENCE_NOT_PROVEN_EMPTY",
  ],
  [
    "projectSettingsReadbackAfterProjectAbsence",
    "VERCEL_PROJECT_SETTINGS_AFTER_PROJECT_ABSENCE_NOT_PROVEN_ABSENT",
  ],
]) {
  const missingPostAbsenceReadback = structuredClone(
    rawInventoryWithDestroyedVercel,
  );
  delete missingPostAbsenceReadback.vercel[field];
  assert.ok(
    buildInventoryReport(missingPostAbsenceReadback).blockers.includes(
      blocker,
    ),
  );
}
for (const [field, blocker] of [
  [
    "domainsObservedAfterProjectAbsence",
    "VERCEL_DOMAINS_AFTER_PROJECT_ABSENCE_NOT_PROVEN_EMPTY",
  ],
  [
    "environmentVariablesObservedAfterProjectAbsence",
    "VERCEL_ENVIRONMENT_AFTER_PROJECT_ABSENCE_NOT_PROVEN_EMPTY",
  ],
]) {
  const remainingPostAbsenceChild = structuredClone(
    rawInventoryWithDestroyedVercel,
  );
  remainingPostAbsenceChild.vercel[field] = 1;
  assert.ok(
    buildInventoryReport(remainingPostAbsenceChild).blockers.includes(
      blocker,
    ),
  );
}
assert.equal(
  report.schemaVersion,
  "wp13.12b-ea-operator-resource-inventory-v2",
);
assert.equal(report.externalWrites, 0);
assert.equal(report.inventoryPolicyConformant, true);
assert.equal(report.blockers.length, 0);
assert.equal(report.storagePolicy.appCloudStorage, "OFF");
assert.equal(report.storagePolicy.storageApiEnabled, true);
assert.equal(report.storagePolicy.storageApiIsNotAppStorageProof, true);
assert.equal(report.storagePolicy.supportingBuildBuckets.length, 2);
assert.equal(
  report.resources.workloadIdentityFederation.configurationComplete,
  true,
);
assert.equal(
  report.resources.workloadIdentityFederation.pools[0].disabled,
  true,
);
assert.equal(
  report.resources.workloadIdentityFederation.providers[0].disabled,
  true,
);
assert.equal(
  report.resources.workloadIdentityFederation.previewProjectRoles.length,
  0,
);
assert.equal(
  report.resources.workloadIdentityFederation.previewServiceAccountKeys.length,
  0,
);
assert.equal(report.resources.vercel.authenticatedReadback, true);
assert.equal(report.resources.vercel.project.id, APPROVED_SCOPE.vercelProjectId);
assert.equal(report.resources.vercel.project.standardProtection,
  "prod_deployment_urls_and_all_previews");
assert.equal(report.resources.vercel.project.teamOidc.issuerMode, "team");
assert.equal(report.resources.vercel.deployments.length, 0);
assert.equal(
  report.resources.functionRuntimeConfigurationPhase,
  "DISABLED_FIRST_DEPLOY",
);
assert.equal(report.previewInventory, "INCLUDED_AUTHENTICATED_READBACK");
assert.match(report.inventoryDigest, /^[a-f0-9]{64}$/u);

const safeBackendInventory = buildInventoryReport(
  safeBackendRawInventory(),
  { inventoryPhase: "SAFE_BACKEND_FOR_DESTRUCTION" },
);
assert.equal(safeBackendInventory.blockers.length, 0);
assert.equal(
  safeBackendInventory.inventoryLifecyclePhase,
  "SAFE_BACKEND_FOR_DESTRUCTION",
);
assert.deepEqual(
  validateSafeBackendForDestructionInventory(safeBackendInventory, 9),
  {
    controlEpoch: 9,
    inventoryDigest: safeBackendInventory.inventoryDigest,
    poolDisabled: true,
    providerDisabled: true,
    sharedProtectedPreviewOrigin: safeBackendOrigin,
  },
);
const localSafeBackendInventory = buildInventoryReport(
  {
    ...safeBackendRawInventory(),
    source: "LOCAL_TEST_FIXTURE",
  },
  { inventoryPhase: "SAFE_BACKEND_FOR_DESTRUCTION" },
);
assert.throws(
  () => validateSafeBackendForDestructionInventory(
    localSafeBackendInventory,
    9,
  ),
  /FRESH_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY_REQUIRED/u,
);
const unsafeWifOrderInventory = buildInventoryReport(
  safeBackendRawInventory({
    poolDisabled: true,
    providerDisabled: false,
  }),
  { inventoryPhase: "SAFE_BACKEND_FOR_DESTRUCTION" },
);
assert.throws(
  () => validateSafeBackendForDestructionInventory(
    unsafeWifOrderInventory,
    9,
  ),
  /FRESH_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY_REQUIRED/u,
);
for (const indirectPrincipal of [
  "allAuthenticatedUsers",
  "group:staging-operators@example.invalid",
  "domain:example.invalid",
  "principalSet://cloudresourcemanager.googleapis.com/"
    + `projects/${APPROVED_SCOPE.projectNumber}/type/ServiceAccount`,
]) {
  const unsafeProjectIamRaw = safeBackendRawInventory();
  unsafeProjectIamRaw.iamPolicy.bindings.push({
    role: "roles/viewer",
    members: [indirectPrincipal],
  });
  const unsafeProjectIamInventory = buildInventoryReport(
    unsafeProjectIamRaw,
    { inventoryPhase: "SAFE_BACKEND_FOR_DESTRUCTION" },
  );
  assert.ok(
    unsafeProjectIamInventory.blockers.includes(
      "EXACT_PROJECT_DEPLOY_AUTHORITY_ABSENCE_REQUIRED",
    ),
  );
  assert.throws(
    () => validateSafeBackendForDestructionInventory(
      unsafeProjectIamInventory,
      9,
    ),
    /FRESH_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY_REQUIRED/u,
  );
}
for (const inheritedPrincipal of [
  "allUsers",
  "group:organization-operators@example.invalid",
  "domain:example.invalid",
  "principalSet://cloudresourcemanager.googleapis.com/"
    + `organizations/${APPROVED_SCOPE.organizationId}/type/ServiceAccount`,
]) {
  const unsafeOrganizationIamRaw = safeBackendRawInventory();
  unsafeOrganizationIamRaw.organizationIamPolicy.bindings.push({
    role: "roles/viewer",
    members: [inheritedPrincipal],
  });
  const unsafeOrganizationIamInventory = buildInventoryReport(
    unsafeOrganizationIamRaw,
    { inventoryPhase: "SAFE_BACKEND_FOR_DESTRUCTION" },
  );
  assert.ok(
    unsafeOrganizationIamInventory.blockers.includes(
      "EXACT_PARENT_ORGANIZATION_DEPLOY_AUTHORITY_ABSENCE_REQUIRED",
    ),
  );
}

const noOpAdapter = syntheticDeletionTestAdapter({
  inventories: [
    scriptedValue(syntheticDeletionAuthorizedRawInventory()),
    scriptedValue(syntheticDeletionAuthorizedRawInventory()),
    scriptedValue(syntheticDeletionRevokedRawInventory()),
  ],
  downscopeSteps: [
    scriptedValue(
      syntheticDeletionIdentityLifecycleReadback(
        "downscope-for-synthetic-deletion",
        2,
      ),
    ),
  ],
  revokeSteps: [
    scriptedValue(
      syntheticDeletionIdentityLifecycleReadback(
        "revoke-deletion-identity",
        2,
      ),
    ),
  ],
});
const noOpReceipt =
  await executeSyntheticDataDeletionWithTestDoubles(
    {
      executionAuthorization:
        EXECUTION_AUTHORIZATION.syntheticDataDeletion,
      windowExpiresAt: syntheticDeletionWindowExpiresAt,
    },
    noOpAdapter,
  );
const noOpTranscript =
  readExternalResourceOperatorInMemoryTestTranscript(noOpAdapter);
assert.deepEqual(noOpTranscript.events, [
  "DOWNSCOPE",
  "COLLECT",
  "COLLECT",
  "REVOKE",
  "COLLECT",
]);
assert.deepEqual(
  noOpTranscript.evidenceWrites.map(({ kind }) => kind),
  [
    "syntheticDataDeletionIntent",
    "syntheticDataDeletionExecution",
  ],
);
assert.equal(
  noOpReceipt.executionClassification,
  "AUTHENTICATED_ALREADY_ZERO_WITH_TOMBSTONE_HISTORY_NO_OP",
);
assert.equal(noOpReceipt.deleteInvocationsCompletedThisRun, 0);
assert.equal(noOpReceipt.externalWritesThisRun, 0);
assert.equal(
  noOpReceipt.deletionIdentityRevokedBeforeReceiptWrite,
  true,
);
const noOpIntent = noOpTranscript.evidenceWrites.find(
  ({ kind }) => kind === "syntheticDataDeletionIntent",
).evidence;
assert.equal(
  validateSyntheticDataDeletionExecutionReceipt(
    noOpReceipt,
    safeBackendInventory,
    noOpIntent,
  ),
  true,
);
for (const unsafeReceipt of [
  {
    ...noOpReceipt,
    deletionIdentityRevokedBeforeReceiptWrite: false,
  },
  {
    ...noOpReceipt,
    deletionIdentityAuthorityStateAfter: "SYNTHETIC_DELETION_ONLY",
  },
  {
    ...noOpReceipt,
    deletionIdentityRevokeReadbackSha256: "0".repeat(63),
  },
  {
    ...noOpReceipt,
    executionClassification:
      "AUTHENTICATED_INTENT_RECOVERY_AFTER_COMPLETED_DELETION",
  },
]) {
  assert.throws(
    () => validateSyntheticDataDeletionExecutionReceipt(
      unsafeReceipt,
      safeBackendInventory,
      noOpIntent,
    ),
    /VALID_SYNTHETIC_DATA_DELETION_EXECUTION_RECEIPT_REQUIRED/u,
  );
}

const primaryFailureAdapter = syntheticDeletionTestAdapter({
  inventories: [
    scriptedError("ACTIVE_SYNTHETIC_INVENTORY_COLLECTION_FAILED"),
    scriptedValue(syntheticDeletionRevokedRawInventory()),
  ],
  downscopeSteps: [
    scriptedValue(
      syntheticDeletionIdentityLifecycleReadback(
        "downscope-for-synthetic-deletion",
        1,
      ),
    ),
  ],
  evidenceWriteMode: "REJECT",
  revokeSteps: [
    scriptedValue(
      syntheticDeletionIdentityLifecycleReadback(
        "revoke-deletion-identity",
        1,
      ),
    ),
  ],
});
await assert.rejects(
  executeSyntheticDataDeletionWithTestDoubles(
    {
      executionAuthorization:
        EXECUTION_AUTHORIZATION.syntheticDataDeletion,
      windowExpiresAt: syntheticDeletionWindowExpiresAt,
    },
    primaryFailureAdapter,
  ),
  /ACTIVE_SYNTHETIC_INVENTORY_COLLECTION_FAILED/u,
);
assert.equal(
  readExternalResourceOperatorInMemoryTestTranscript(
    primaryFailureAdapter,
  ).events.filter((event) => event === "REVOKE").length,
  1,
);

const revokeFailureAdapter = syntheticDeletionTestAdapter({
  inventories: [
    scriptedError("ACTIVE_COLLECTION_FAILED"),
  ],
  downscopeSteps: [
    scriptedValue(
      syntheticDeletionIdentityLifecycleReadback(
        "downscope-for-synthetic-deletion",
        1,
      ),
    ),
  ],
  revokeSteps: [
    scriptedError("REVOKE_PROVIDER_FAILURE"),
  ],
});
await assert.rejects(
  executeSyntheticDataDeletionWithTestDoubles(
    {
      executionAuthorization:
        EXECUTION_AUTHORIZATION.syntheticDataDeletion,
      windowExpiresAt: syntheticDeletionWindowExpiresAt,
    },
    revokeFailureAdapter,
  ),
  /SYNTHETIC_DELETION_IDENTITY_GUARANTEED_REVOCATION_FAILED/u,
);
assert.equal(
  readExternalResourceOperatorInMemoryTestTranscript(
    revokeFailureAdapter,
  ).events.filter((event) => event === "REVOKE").length,
  1,
);

const zeroHistoryAdapter = syntheticDeletionTestAdapter({
  inventories: [
    scriptedValue(
      syntheticDeletionAuthorizedRawInventory({ tombstoneIds: [] }),
    ),
    scriptedValue(
      syntheticDeletionRevokedRawInventory({ tombstoneIds: [] }),
    ),
  ],
  downscopeSteps: [
    scriptedValue(
      syntheticDeletionIdentityLifecycleReadback(
        "downscope-for-synthetic-deletion",
        1,
      ),
    ),
  ],
  evidenceWriteMode: "REJECT",
  revokeSteps: [
    scriptedValue(
      syntheticDeletionIdentityLifecycleReadback(
        "revoke-deletion-identity",
        1,
      ),
    ),
  ],
});
await assert.rejects(
  executeSyntheticDataDeletionWithTestDoubles(
    {
      executionAuthorization:
        EXECUTION_AUTHORIZATION.syntheticDataDeletion,
      windowExpiresAt: syntheticDeletionWindowExpiresAt,
    },
    zeroHistoryAdapter,
  ),
  /SYNTHETIC_DELETION_FIRST_RUN_ZERO_WITHOUT_TOMBSTONE_HISTORY_NOT_PROOF/u,
);
assert.equal(
  readExternalResourceOperatorInMemoryTestTranscript(
    zeroHistoryAdapter,
  ).events.filter((event) => event === "REVOKE").length,
  1,
);

for (const [projectMutation, blocker] of [
  [{ lifecycleState: "DELETE_REQUESTED" }, "PROJECT_LIFECYCLE_NOT_ACTIVE"],
  [{ lifecycleState: "" }, "PROJECT_LIFECYCLE_NOT_ACTIVE"],
]) {
  const lifecycleReport = buildInventoryReport({
    ...rawInventory,
    project: { ...rawInventory.project, ...projectMutation },
  });
  assert.ok(lifecycleReport.blockers.includes(blocker));
}
for (const billingEnabled of [false, undefined, null]) {
  const billing = structuredClone(rawInventory.billing);
  if (billingEnabled === undefined) delete billing.billingEnabled;
  else billing.billingEnabled = billingEnabled;
  assert.ok(
    buildInventoryReport({ ...rawInventory, billing }).blockers.includes(
      "PROJECT_BILLING_MUST_BE_ENABLED",
    ),
  );
}
for (const [field, blocker] of [
  ["live", "VERCEL_PROJECT_MUST_EXPLICITLY_REMAIN_NON_LIVE"],
  ["passwordProtection", "VERCEL_PASSWORD_PROTECTION_NOT_APPROVED"],
  ["trustedIps", "VERCEL_TRUSTED_IPS_NOT_APPROVED"],
  ["protectionBypass", "VERCEL_PROTECTION_BYPASS_FORBIDDEN"],
  ["deploymentProtectionExceptions", "VERCEL_PROTECTION_EXCEPTIONS_FORBIDDEN"],
  ["webAnalytics", "VERCEL_WEB_ANALYTICS_MUST_REMAIN_OFF"],
  ["speedInsights", "VERCEL_SPEED_INSIGHTS_MUST_REMAIN_OFF"],
  ["link", "VERCEL_GIT_LINK_NOT_APPROVED"],
  ["domains", "VERCEL_CUSTOM_DOMAINS_FORBIDDEN"],
  ["targets", "VERCEL_PRODUCTION_TARGET_FORBIDDEN"],
]) {
  const vercel = structuredClone(rawInventory.vercel);
  delete vercel.project[field];
  assert.ok(
    buildInventoryReport({ ...rawInventory, vercel }).blockers.includes(
      blocker,
    ),
    `${field} must be explicit`,
  );
}

assert.ok(
  buildInventoryReport({
    ...rawInventory,
    services: rawInventory.services.slice(1),
  }).blockers.includes("REQUIRED_ENABLED_SERVICE_SET_INCOMPLETE"),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    services: [
      ...rawInventory.services,
      { config: { name: "example.googleapis.com" } },
    ],
  }).blockers.includes("UNAPPROVED_ENABLED_SERVICE_PRESENT"),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    services: [...rawInventory.services, rawInventory.services[0]],
  }).blockers.includes("DUPLICATE_ENABLED_SERVICE_READBACK"),
);

const protectedPreviewOrigin =
  `https://${APPROVED_SCOPE.vercelProjectName}-abc123`
  + `-${APPROVED_SCOPE.vercelTeamSlug}.vercel.app`;
const activeFunctions = structuredClone(rawInventory.functions);
for (const fn of activeFunctions) {
  fn.serviceConfig.environmentVariables.LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN =
    protectedPreviewOrigin;
  if (fn.name.endsWith("/issueSyntheticSession")) {
    fn.serviceConfig.environmentVariables
      .LUDYS_STAGING_SESSION_ISSUANCE_ENABLED = "true";
  }
}
const activeRuntimeReport = buildInventoryReport({
  ...rawInventory,
  functions: activeFunctions,
  workloadIdentityPools: rawInventory.workloadIdentityPools.map(
    (entry) => ({ ...entry, disabled: false }),
  ),
  workloadIdentityProviders: rawInventory.workloadIdentityProviders.map(
    (entry) => ({ ...entry, disabled: false }),
  ),
  vercel: {
    ...rawInventory.vercel,
    deployments: [{
      uid: "dpl_active_preview",
      projectId: APPROVED_SCOPE.vercelProjectId,
      name: APPROVED_SCOPE.vercelProjectName,
      target: null,
      state: "READY",
      url: protectedPreviewOrigin.replace(/^https:\/\//u, ""),
    }],
  },
});
assert.equal(activeRuntimeReport.inventoryPolicyConformant, true);
assert.equal(
  activeRuntimeReport.resources.functionRuntimeConfigurationPhase,
  "PROTECTED_PREVIEW_ACTIVE",
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    functions: activeFunctions,
    vercel: {
      ...rawInventory.vercel,
      deployments: [{
        uid: "dpl_disabled_trust",
        projectId: APPROVED_SCOPE.vercelProjectId,
        name: APPROVED_SCOPE.vercelProjectName,
        target: null,
        state: "READY",
        url: protectedPreviewOrigin.replace(/^https:\/\//u, ""),
      }],
    },
  }).blockers.includes(
    "WORKLOAD_IDENTITY_TRUST_STATE_MISMATCH_FOR_RUNTIME_PHASE",
  ),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    workloadIdentityPools: rawInventory.workloadIdentityPools.map(
      (entry) => ({ ...entry, disabled: false }),
    ),
    workloadIdentityProviders: rawInventory.workloadIdentityProviders.map(
      (entry) => ({ ...entry, disabled: false }),
    ),
  }).blockers.includes(
    "WORKLOAD_IDENTITY_TRUST_STATE_MISMATCH_FOR_RUNTIME_PHASE",
  ),
);

const configuredDisabledFunctions = structuredClone(activeFunctions);
configuredDisabledFunctions.find(
  (fn) => fn.name.endsWith("/issueSyntheticSession"),
).serviceConfig.environmentVariables.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED =
  "false";
assert.equal(
  buildInventoryReport({
    ...rawInventory,
    functions: configuredDisabledFunctions,
    workloadIdentityPools: rawInventory.workloadIdentityPools.map(
      (entry) => ({ ...entry, disabled: false }),
    ),
    workloadIdentityProviders: rawInventory.workloadIdentityProviders.map(
      (entry) => ({ ...entry, disabled: false }),
    ),
    vercel: {
      ...rawInventory.vercel,
      deployments: [{
        uid: "dpl_configured_preview",
        projectId: APPROVED_SCOPE.vercelProjectId,
        name: APPROVED_SCOPE.vercelProjectName,
        target: null,
        state: "READY",
        url: protectedPreviewOrigin.replace(/^https:\/\//u, ""),
      }],
    },
  }).resources.functionRuntimeConfigurationPhase,
  "PROTECTED_PREVIEW_CONFIGURED_ISSUANCE_DISABLED",
);

const unknownEnvironmentFunctions = structuredClone(rawInventory.functions);
unknownEnvironmentFunctions[0].serviceConfig.environmentVariables
  .UNAPPROVED_ENVIRONMENT_VARIABLE = "present";
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    functions: unknownEnvironmentFunctions,
  }).blockers.includes(
    "FUNCTION_ENVIRONMENT_VARIABLES_MISMATCH_deleteSyntheticSession",
  ),
);
const unboundOriginFunctions = structuredClone(activeFunctions);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    functions: unboundOriginFunctions,
  }).blockers.includes(
    "FUNCTION_PREVIEW_ORIGIN_NOT_BOUND_TO_READY_VERCEL_DEPLOYMENT",
  ),
);
const extraSecretReferenceFunctions = structuredClone(rawInventory.functions);
extraSecretReferenceFunctions[0].serviceConfig.secretEnvironmentVariables.push({
  key: "UNAPPROVED_SECRET",
  projectId: APPROVED_SCOPE.projectId,
  secret: "UNAPPROVED_SECRET",
  version: "1",
});
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    functions: extraSecretReferenceFunctions,
  }).blockers.includes(
    "FUNCTION_SECRET_REFERENCE_MISMATCH_deleteSyntheticSession",
  ),
);

const evidenceOutputPath = "artifacts/wp13-12b-external-resource-inventory.json";
assert.equal(assertInventoryOutputPath(evidenceOutputPath), evidenceOutputPath);
assert.throws(
  () => assertInventoryOutputPath("artifacts/other.json"),
  /EXACT_INVENTORY_EVIDENCE_OUTPUT_PATH_REQUIRED/u,
);
assert.throws(
  () => assertInventoryOutputPath("C:\\temp\\inventory.json"),
  /EXACT_INVENTORY_EVIDENCE_OUTPUT_PATH_REQUIRED/u,
);
assert.equal(
  assertExecutionEvidencePath(
    "syntheticDataDeletion",
    EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion,
  ),
  EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion,
);
assert.throws(
  () => assertExecutionEvidencePath(
    "syntheticDataDeletion",
    "artifacts/unreviewed-evidence.json",
  ),
  /EXACT_SYNTHETICDATADELETION_EVIDENCE_PATH_REQUIRED/u,
);
const inventoryEvidenceDocument = materializeInventoryEvidenceDocument(
  report,
  evidenceOutputPath,
);
assert.equal(inventoryEvidenceDocument.outputPath, evidenceOutputPath);
assert.equal(inventoryEvidenceDocument.inventoryDigest, report.inventoryDigest);
const redactedInventoryEvidence = redactInventoryForEvidence(report);
assert.deepEqual(
  JSON.parse(inventoryEvidenceDocument.content),
  redactedInventoryEvidence,
);
assert.doesNotMatch(
  inventoryEvidenceDocument.content,
  /"(?:documentNames|invokerMembers|members)"\s*:/u,
);
assert.doesNotMatch(
  inventoryEvidenceDocument.content,
  /"(?:accessToken|authorization|credentials|idToken|oidcToken|refreshToken|token)"\s*:/iu,
);
assert.throws(
  () => materializeInventoryEvidenceDocument(
    {
      ...report,
      accessToken: "forbidden",
    },
    evidenceOutputPath,
  ),
  /INVENTORY_EVIDENCE_CREDENTIAL_FIELD_FORBIDDEN/u,
);

const reorderedReport = buildInventoryReport({
  ...rawInventory,
  services: [...rawInventory.services].reverse(),
  budgets: [...rawInventory.budgets].reverse(),
  buckets: [...rawInventory.buckets].reverse(),
  workloadIdentityPools: [...rawInventory.workloadIdentityPools].reverse(),
  workloadIdentityProviders: [...rawInventory.workloadIdentityProviders].reverse(),
  runIamPolicies: [...rawInventory.runIamPolicies].reverse(),
});
assert.equal(reorderedReport.inventoryDigest, report.inventoryDigest);

const unrelatedBudgetName =
  `billingAccounts/${APPROVED_SCOPE.billingAccount}/budgets/unrelated-private-budget`;
const unrelatedBudgetDisplayName = "PRIVATE UNRELATED BILLING LABEL";
const reportWithUnrelatedBudget = buildInventoryReport({
  ...rawInventory,
  budgets: [
    ...rawInventory.budgets,
    {
      name: unrelatedBudgetName,
      displayName: unrelatedBudgetDisplayName,
      amount: {
        specifiedAmount: {
          currencyCode: "NOK",
          units: "999",
          nanos: 0,
        },
      },
      budgetFilter: {
        projects: ["projects/999999999999"],
      },
      thresholdRules: [{ thresholdPercent: 1 }],
    },
  ],
});
assert.equal(reportWithUnrelatedBudget.inventoryPolicyConformant, true);
assert.equal(reportWithUnrelatedBudget.resources.budgets.length, 1);
assert.equal(
  reportWithUnrelatedBudget.resources.budgetScopeSummary
    .ignoredUnrelatedBudgetCount,
  1,
);
assert.doesNotMatch(
  JSON.stringify(reportWithUnrelatedBudget),
  new RegExp(
    `${unrelatedBudgetName}|${unrelatedBudgetDisplayName}`,
    "u",
  ),
);

const mixedBudgetName =
  `billingAccounts/${APPROVED_SCOPE.billingAccount}/budgets/mixed-project-budget`;
const mixedScopeBudgetReport = buildInventoryReport({
  ...rawInventory,
  budgets: [
    ...rawInventory.budgets,
    {
      ...structuredClone(rawInventory.budgets[0]),
      name: mixedBudgetName,
      displayName: "MIXED PRIVATE LABEL",
      budgetFilter: {
        projects: [
          `projects/${projectNumber}`,
          "projects/999999999999",
        ],
      },
    },
  ],
});
assert.ok(
  mixedScopeBudgetReport.blockers.includes(
    "MIXED_PROJECT_SCOPE_BUDGET_REQUIRES_REVIEW",
  ),
);
assert.equal(
  mixedScopeBudgetReport.resources.budgetScopeSummary
    .mixedProjectScopeBudgetCount,
  1,
);
assert.doesNotMatch(
  JSON.stringify(mixedScopeBudgetReport),
  /mixed-project-budget|MIXED PRIVATE LABEL/u,
);

const fractionalBudget = structuredClone(rawInventory.budgets[0]);
fractionalBudget.amount.specifiedAmount.nanos = 1;
const fractionalBudgetReport = buildInventoryReport({
  ...rawInventory,
  budgets: [fractionalBudget],
});
assert.ok(
  fractionalBudgetReport.blockers.includes("PROJECT_BUDGET_POLICY_MISMATCH"),
);
assert.throws(
  () => buildDestructionCommands(fractionalBudgetReport),
  /INVENTORY_BLOCKERS_PREVENT_DESTRUCTION/u,
);

const broadOnlyBudget = structuredClone(rawInventory.budgets[0]);
broadOnlyBudget.budgetFilter.projects.push("projects/999999999999");
const broadOnlyBudgetReport = buildInventoryReport({
  ...rawInventory,
  budgets: [broadOnlyBudget],
});
assert.ok(
  broadOnlyBudgetReport.blockers.includes(
    "EXACTLY_ONE_PROJECT_SCOPED_BUDGET_REQUIRED",
  ),
);
assert.ok(
  broadOnlyBudgetReport.blockers.includes(
    "MIXED_PROJECT_SCOPE_BUDGET_REQUIRES_REVIEW",
  ),
);
assert.equal(broadOnlyBudgetReport.resources.budgets.length, 0);

for (const [field, blocker] of [
  ["name", "FIRESTORE_DEFAULT_DATABASE_NAME_MISMATCH"],
  ["locationId", "FIRESTORE_REGION_MISMATCH"],
  ["type", "FIRESTORE_NATIVE_MODE_REQUIRED"],
  ["databaseEdition", "FIRESTORE_STANDARD_EDITION_REQUIRED"],
  ["pointInTimeRecoveryEnablement", "FIRESTORE_PITR_MUST_REMAIN_OFF"],
  ["deleteProtectionState", "FIRESTORE_DELETE_PROTECTION_MUST_REMAIN_OFF"],
]) {
  const firestore = structuredClone(rawInventory.firestore);
  delete firestore[field];
  const drifted = buildInventoryReport({ ...rawInventory, firestore });
  assert.ok(drifted.blockers.includes(blocker), `${field} must fail closed`);
}
const wrongFirestoreNameReport = buildInventoryReport({
  ...rawInventory,
  firestore: {
    ...rawInventory.firestore,
    name: `projects/${APPROVED_SCOPE.projectId}/databases/other`,
  },
});
assert.ok(
  wrongFirestoreNameReport.blockers.includes(
    "FIRESTORE_DEFAULT_DATABASE_NAME_MISMATCH",
  ),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    firestore: {
      ...rawInventory.firestore,
      databaseEdition: "ENTERPRISE",
    },
  }).blockers.includes("FIRESTORE_STANDARD_EDITION_REQUIRED"),
);
assert.ok(
  buildInventoryReport({ ...rawInventory, firestore: null }).blockers.includes(
    "DEFAULT_FIRESTORE_DATABASE_REQUIRED",
  ),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    firestoreRootCollectionIds: [
      ...rawInventory.firestoreRootCollectionIds,
      "unexpectedRealData",
    ],
  }).blockers.includes("FIRESTORE_ROOT_COLLECTION_ALLOWLIST_MISMATCH"),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    firestoreNestedCollectionEvidence: {
      parentDocumentsChecked: 1,
      nestedCollectionCount: 1,
      noNestedCollections: false,
      nestedCollectionIdentifiersPersistedOrPrinted: false,
    },
  }).blockers.includes("FIRESTORE_NESTED_COLLECTIONS_MUST_BE_PROVEN_ABSENT"),
);
const invalidSyntheticDocuments = structuredClone(
  rawInventory.firestoreDocuments,
);
invalidSyntheticDocuments.find(
  (entry) => entry.collectionId === "syntheticSessions",
).documentNames.push(
  `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
  + "syntheticSessions/real-user-record",
);
invalidSyntheticDocuments.find(
  (entry) => entry.collectionId === "syntheticSessions",
).count = 1;
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    firestoreRootCollectionIds: [
      ...rawInventory.firestoreRootCollectionIds,
      "syntheticSessions",
    ],
    firestoreDocuments: invalidSyntheticDocuments,
  }).blockers.includes(
    "FIRESTORE_SYNTHETIC_DOCUMENT_INVENTORY_MISMATCH_syntheticSessions",
  ),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    firestoreControlDocument: null,
  }).blockers.includes("FIRESTORE_STAGING_CONTROL_READBACK_REQUIRED"),
);
const validSyntheticSessionId =
  "synthetic-wp13-12b-abcdefghijklmnopqrstuv";
const stringValue = (value) => ({ stringValue: value });
const integerValue = (value) => ({ integerValue: String(value) });
const timestampValue = (value) => ({ timestampValue: value });
const validSyntheticSessionDocument = {
  name:
    `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
    + `syntheticSessions/${validSyntheticSessionId}`,
  fields: {
    syntheticSessionId: stringValue(validSyntheticSessionId),
    stateVersion: integerValue(2),
    authorityGeneration: integerValue(1),
    controlEpoch: integerValue(2),
    syntheticSessionState: {
      mapValue: {
        fields: {
          locale: stringValue("nb-NO"),
          state: stringValue("READY"),
          createdAt: stringValue("2026-07-27T10:00:00.000Z"),
          updatedAt: stringValue("2026-07-27T10:00:00.000Z"),
          helpRequested: { booleanValue: false },
          childProjectionToken: stringValue("SYNTHETIC_CHILD_ONLY"),
          adultProjectionToken: stringValue("SYNTHETIC_ADULT_ONLY"),
        },
      },
    },
    releaseIds: {
      mapValue: {
        fields: {
          appVersion: stringValue("0.14.0-reconstructed.9"),
          audioReleaseId: stringValue("wp13-9-audio-specifications-r1"),
          contentReleaseId: stringValue("wp13-8-authentic-draft-corpus-r1"),
          knowledgeReleaseId:
            stringValue("release-knowledge-audio-prototype-001"),
          operationsReleaseId: stringValue("wp13-11-operations-kit-r1"),
          providerDecisionReleaseId:
            stringValue("wp13-12a-provider-decision-r1"),
          schemaVersion: stringValue("wp13.12b-synthetic-staging-v1"),
          stagingProviderReleaseId:
            stringValue("wp13-12b-synthetic-staging-provider-r1"),
        },
      },
    },
    expiresAt: timestampValue("2026-07-27T10:15:00.000Z"),
    tombstone: { booleanValue: false },
    processedCommandIds: { arrayValue: { values: [] } },
    coarseTechnicalStatus: stringValue("READY"),
    dataClassification:
      stringValue("SYNTHETIC_ONLY_NO_PARTICIPANT_DATA"),
  },
};
const validSessionInspection = inspectFirestoreSyntheticDocument(
  "syntheticSessions",
  validSyntheticSessionDocument,
);
assert.equal(validSessionInspection.conformant, true);
assert.equal(
  JSON.stringify(validSessionInspection).includes(validSyntheticSessionId),
  false,
);
const wrongSessionClassification = structuredClone(
  validSyntheticSessionDocument,
);
wrongSessionClassification.fields.dataClassification =
  stringValue("REAL_PARTICIPANT_DATA");
assert.equal(
  inspectFirestoreSyntheticDocument(
    "syntheticSessions",
    wrongSessionClassification,
  ).conformant,
  false,
);
const extraSessionField = structuredClone(validSyntheticSessionDocument);
extraSessionField.fields.email = stringValue("must-never-be-retained@example.invalid");
assert.equal(
  inspectFirestoreSyntheticDocument(
    "syntheticSessions",
    extraSessionField,
  ).exactSchema,
  false,
);
const wrongSessionType = structuredClone(validSyntheticSessionDocument);
wrongSessionType.fields.controlEpoch = stringValue("2");
assert.equal(
  inspectFirestoreSyntheticDocument(
    "syntheticSessions",
    wrongSessionType,
  ).exactSchema,
  false,
);
const populatedFirestoreDocuments = [
  {
    collectionId: "syntheticCapabilityGrants",
    count: 1,
    documentNames: [
      `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
      + "syntheticCapabilityGrants/abcdefghijklmnopqrstuvwx",
    ],
    schemaValidation: {
      documentsChecked: 1,
      conformantDocuments: 1,
      allDocumentsConformant: true,
      payloadValuesPersistedOrPrinted: false,
    },
  },
  {
    collectionId: "syntheticSessions",
    count: 1,
    documentNames: [
      `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
      + `syntheticSessions/${validSyntheticSessionId}`,
    ],
    schemaValidation: {
      documentsChecked: 1,
      conformantDocuments: 1,
      allDocumentsConformant: true,
      payloadValuesPersistedOrPrinted: false,
    },
  },
  {
    collectionId: "syntheticSessionTombstones",
    count: 1,
    documentNames: [
      `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
      + `syntheticSessionTombstones/${validSyntheticSessionId}`,
    ],
    schemaValidation: {
      documentsChecked: 1,
      conformantDocuments: 1,
      allDocumentsConformant: true,
      payloadValuesPersistedOrPrinted: false,
    },
  },
];
const populatedFirestoreReport = buildInventoryReport({
  ...rawInventory,
  firestoreRootCollectionIds: [
    "syntheticCapabilityGrants",
    "syntheticSessions",
    "syntheticSessionTombstones",
    "syntheticStagingControl",
  ],
  firestoreDocuments: populatedFirestoreDocuments,
  firestoreNestedCollectionEvidence: {
    parentDocumentsChecked: 4,
    nestedCollectionCount: 0,
    noNestedCollections: true,
    nestedCollectionIdentifiersPersistedOrPrinted: false,
  },
});
assert.equal(populatedFirestoreReport.inventoryPolicyConformant, true);
assert.equal(
  populatedFirestoreReport.resources.firestoreDataInventory.collections
    .reduce((count, collection) => count + collection.count, 0),
  3,
);
assert.equal(
  JSON.stringify(populatedFirestoreReport).includes(
    "syntheticCapabilityGrants/abcdefghijklmnopqrstuvwx",
  ),
  true,
);

assert.ok(
  buildInventoryReport({ ...rawInventory, secrets: [] }).blockers.includes(
    "EXACTLY_ONE_APPROVED_CAPABILITY_SECRET_REQUIRED",
  ),
);
const wrongSecretReplication = structuredClone(rawInventory.secrets);
wrongSecretReplication[0].replication.userManaged.replicas[0].location =
  "us-central1";
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    secrets: wrongSecretReplication,
  }).blockers.includes("CAPABILITY_SECRET_REPLICATION_MISMATCH"),
);
const extraSecretVersion = structuredClone(rawInventory.secretVersions[0]);
extraSecretVersion.name = extraSecretVersion.name.replace(/\/1$/u, "/2");
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    secretVersions: [...rawInventory.secretVersions, extraSecretVersion],
  }).blockers.includes("EXACT_ENABLED_CAPABILITY_SECRET_VERSION_1_REQUIRED"),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    secretVersions: [{
      ...rawInventory.secretVersions[0],
      state: "DISABLED",
    }],
  }).blockers.includes("EXACT_ENABLED_CAPABILITY_SECRET_VERSION_1_REQUIRED"),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    secretVersions: [{
      ...rawInventory.secretVersions[0],
      state: "DESTROYED",
    }],
  }).blockers.includes("EXACT_ENABLED_CAPABILITY_SECRET_VERSION_1_REQUIRED"),
);
const broadSecretAccessorPolicy = structuredClone(
  rawInventory.capabilitySecretIamPolicy,
);
broadSecretAccessorPolicy.bindings[0].members.push(
  `serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`,
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    capabilitySecretIamPolicy: broadSecretAccessorPolicy,
  }).blockers.includes("CAPABILITY_SECRET_EXACT_RUNTIME_ACCESSOR_REQUIRED"),
);

assert.ok(
  buildInventoryReport({
    ...rawInventory,
    functions: rawInventory.functions.slice(1),
  }).blockers.includes("EXACT_APPROVED_FUNCTION_SET_REQUIRED"),
);
for (const [mutate, blocker] of [
  [
    (fn) => { fn.state = ""; },
    "FUNCTION_NOT_ACTIVE_deleteSyntheticSession",
  ],
  [
    (fn) => { fn.buildConfig.runtime = ""; },
    "FUNCTION_RUNTIME_MISMATCH_deleteSyntheticSession",
  ],
  [
    (fn) => { fn.buildConfig.entryPoint = "unexpectedEntryPoint"; },
    "FUNCTION_ENTRY_POINT_MISMATCH_deleteSyntheticSession",
  ],
  [
    (fn) => { fn.buildConfig.serviceAccount = approvedDeployServiceAccount; },
    "FUNCTION_BUILD_IDENTITY_MISMATCH_deleteSyntheticSession",
  ],
  [
    (fn) => {
      fn.serviceConfig.vpcConnector =
        `projects/${APPROVED_SCOPE.projectId}/locations/`
        + `${APPROVED_SCOPE.region}/connectors/unexpected`;
    },
    "FUNCTION_NETWORK_OR_EXTRA_SECRET_CONFIG_FORBIDDEN_deleteSyntheticSession",
  ],
  [
    (fn) => { fn.serviceConfig.serviceAccountEmail = ""; },
    "FUNCTION_RUNTIME_IDENTITY_MISMATCH_deleteSyntheticSession",
  ],
  [
    (fn) => { fn.serviceConfig.maxInstanceCount = 2; },
    "FUNCTION_DEPLOYMENT_LIMITS_MISMATCH_deleteSyntheticSession",
  ],
]) {
  const functions = structuredClone(rawInventory.functions);
  mutate(functions[0]);
  assert.ok(
    buildInventoryReport({ ...rawInventory, functions }).blockers.includes(
      blocker,
    ),
    blocker,
  );
}
const functionBuildDrift = structuredClone(rawInventory.functions);
functionBuildDrift[0].buildConfig.entryPoint = "unexpectedEntryPoint";
assert.notEqual(
  buildInventoryReport({
    ...rawInventory,
    functions: functionBuildDrift,
  }).inventoryDigest,
  report.inventoryDigest,
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    runServices: rawInventory.runServices.slice(1),
  }).blockers.includes("EXACT_APPROVED_CLOUD_RUN_SERVICE_SET_REQUIRED"),
);
const runServicesWithoutRegion = structuredClone(rawInventory.runServices);
delete runServicesWithoutRegion[0].labels["cloud.googleapis.com/location"];
runServicesWithoutRegion[0].name = "deletesyntheticsession";
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    runServices: runServicesWithoutRegion,
  }).blockers.includes(
    "CLOUD_RUN_REGION_MISMATCH_deletesyntheticsession",
  ),
);

const missingDeployAccountReport = buildInventoryReport({
  ...rawInventory,
  serviceAccounts: rawInventory.serviceAccounts.filter(
    (entry) => entry.email !== approvedDeployServiceAccount,
  ),
});
assert.ok(
  missingDeployAccountReport.blockers.some(
    (blocker) =>
      blocker.startsWith("REQUIRED_SERVICE_ACCOUNT_STATE_MISMATCH_"),
  ),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    serviceAccounts: [
      ...rawInventory.serviceAccounts,
      {
        email:
          `unexpected@${APPROVED_SCOPE.projectId}.iam.gserviceaccount.com`,
        disabled: false,
      },
    ],
  }).blockers.includes("UNAPPROVED_CUSTOM_SERVICE_ACCOUNT_PRESENT"),
);
for (const [field, flag, blocker] of [
  [
    "runtimeKeys",
    "runtimeKeysReadbackPerformed",
    "RUNTIME_SERVICE_ACCOUNT_USER_MANAGED_KEY_FORBIDDEN",
  ],
  [
    "deployServiceAccountKeys",
    "deployServiceAccountKeysReadbackPerformed",
    "DEPLOY_SERVICE_ACCOUNT_USER_MANAGED_KEY_FORBIDDEN",
  ],
  [
    "buildServiceAccountKeys",
    "buildServiceAccountKeysReadbackPerformed",
    "BUILD_SERVICE_ACCOUNT_USER_MANAGED_KEY_FORBIDDEN",
  ],
  [
    "previewServiceAccountKeys",
    "previewServiceAccountKeysReadbackPerformed",
    "PREVIEW_SERVICE_ACCOUNT_USER_MANAGED_KEY_FORBIDDEN",
  ],
]) {
  const keyed = {
    ...rawInventory,
    [field]: [{
      name: `projects/example/serviceAccounts/example/keys/${field}`,
      keyType: "USER_MANAGED",
    }],
  };
  assert.ok(buildInventoryReport(keyed).blockers.includes(blocker));
  assert.ok(
    buildInventoryReport({
      ...rawInventory,
      [flag]: false,
    }).blockers.includes(blocker),
  );
}
const elevatedRuntimePolicy = structuredClone(rawInventory.iamPolicy);
elevatedRuntimePolicy.bindings.push({
  role: "roles/editor",
  members: [`serviceAccount:${APPROVED_SCOPE.runtimeServiceAccount}`],
});
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    iamPolicy: elevatedRuntimePolicy,
  }).blockers.includes(
    "RUNTIME_SERVICE_ACCOUNT_EXACT_PROJECT_ROLE_SET_REQUIRED",
  ),
);
const activeDeployProjectRole = structuredClone(rawInventory.iamPolicy);
activeDeployProjectRole.bindings.push({
  role: "roles/run.admin",
  members: [`serviceAccount:${approvedDeployServiceAccount}`],
});
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    iamPolicy: activeDeployProjectRole,
  }).blockers.includes(
    "DEPLOY_SERVICE_ACCOUNT_PROJECT_ROLES_MUST_BE_REVOKED",
  ),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    runtimeServiceAccountIamPolicy: {
      bindings: [{
        role: "roles/iam.serviceAccountUser",
        members: [`serviceAccount:${approvedDeployServiceAccount}`],
      }],
    },
  }).blockers.includes(
    "DEPLOY_IDENTITY_TEMPORARY_BINDINGS_MUST_BE_REVOKED",
  ),
);
for (const field of [
  "deployServiceAccountIamPolicy",
  "runtimeServiceAccountIamPolicy",
  "buildServiceAccountIamPolicy",
]) {
  assert.ok(
    buildInventoryReport({
      ...rawInventory,
      [field]: {
        bindings: [{
          role: "roles/iam.serviceAccountTokenCreator",
          members: [`serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`],
        }],
      },
    }).blockers.includes(
      "SERVICE_ACCOUNT_RESOURCE_POLICIES_MUST_BE_EXACTLY_EMPTY",
    ),
    `${field} must be exactly empty`,
  );
}
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    functionArtifactRepositoryIamPolicy: { bindings: [] },
  }).blockers.includes(
    "BUILD_SERVICE_ACCOUNT_EXACT_RESOURCE_ROLE_SET_REQUIRED",
  ),
);

const broadImpersonationReport = buildInventoryReport({
  ...rawInventory,
  previewServiceAccountIamPolicy: {
    bindings: [{
      role: "roles/iam.workloadIdentityUser",
      members: [
        exactSubjectPrincipal,
        (
          "principalSet://iam.googleapis.com/"
          + `${expectedPoolName}/attribute.environment/preview`
        ),
      ],
    }],
  },
});
assert.ok(
  broadImpersonationReport.blockers.includes(
    "PREVIEW_IMPERSONATION_MUST_BIND_EXACT_SUBJECT_ONLY",
  ),
);
const extraPreviewServiceAccountRole = structuredClone(
  rawInventory.previewServiceAccountIamPolicy,
);
extraPreviewServiceAccountRole.bindings.push({
  role: "roles/iam.serviceAccountTokenCreator",
  members: [exactSubjectPrincipal],
});
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    previewServiceAccountIamPolicy: extraPreviewServiceAccountRole,
  }).blockers.includes(
    "PREVIEW_SERVICE_ACCOUNT_EXACT_RESOURCE_POLICY_REQUIRED",
  ),
);

const directFederatedProjectRoleReport = buildInventoryReport({
  ...rawInventory,
  iamPolicy: {
    bindings: [
      ...rawInventory.iamPolicy.bindings,
      {
        role: "roles/viewer",
        members: [exactSubjectPrincipal],
      },
    ],
  },
});
assert.ok(
  directFederatedProjectRoleReport.blockers.includes(
    "FEDERATED_PREVIEW_PRINCIPAL_PROJECT_ROLES_FORBIDDEN",
  ),
);

const previewKeyReport = buildInventoryReport({
  ...rawInventory,
  previewServiceAccountKeys: [{
    name: "projects/example/serviceAccounts/example/keys/user-managed",
    keyType: "USER_MANAGED",
  }],
});
assert.ok(
  previewKeyReport.blockers.includes(
    "PREVIEW_SERVICE_ACCOUNT_USER_MANAGED_KEY_FORBIDDEN",
  ),
);

assert.ok(
  buildInventoryReport({
    ...rawInventory,
    runIamPolicies: rawInventory.runIamPolicies.slice(1),
  }).blockers.includes("EXACT_CLOUD_RUN_IAM_POLICY_SET_REQUIRED"),
);
const broadPublicPolicy = structuredClone(rawInventory.runIamPolicies);
const commandPolicy = broadPublicPolicy.find(
  (entry) => entry.serviceName.endsWith("/sessioncommand"),
);
commandPolicy.policy.bindings[0].members.push("serviceAccount:attacker@example.com");
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    runIamPolicies: broadPublicPolicy,
  }).blockers.includes(
    "PUBLIC_BEARER_EXACT_RUN_INVOKER_REQUIRED_sessioncommand",
  ),
);
const healthInvokerPolicy = structuredClone(rawInventory.runIamPolicies);
healthInvokerPolicy.find(
  (entry) => entry.serviceName.endsWith("/health"),
).policy.bindings.push({
  role: "roles/run.invoker",
  members: ["serviceAccount:attacker@example.com"],
});
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    runIamPolicies: healthInvokerPolicy,
  }).blockers.includes("HEALTH_EXACT_PRIVATE_RUN_POLICY_REQUIRED"),
);
const extraRunRolePolicy = structuredClone(rawInventory.runIamPolicies);
extraRunRolePolicy.find(
  (entry) => entry.serviceName.endsWith("/health"),
).policy.bindings.push({
  role: "roles/run.admin",
  members: [`serviceAccount:${APPROVED_SCOPE.runtimeServiceAccount}`],
});
const extraRunRoleReport = buildInventoryReport({
  ...rawInventory,
  runIamPolicies: extraRunRolePolicy,
});
assert.ok(
  extraRunRoleReport.blockers.includes(
    "CLOUD_RUN_EXACT_FULL_IAM_POLICY_REQUIRED_health",
  ),
);
assert.notEqual(extraRunRoleReport.inventoryDigest, report.inventoryDigest);

const publicPrivateTargetReport = buildInventoryReport({
  ...rawInventory,
  runIamPolicies: [{
    ...rawInventory.runIamPolicies[0],
    policy: {
      bindings: [{
        role: "roles/run.invoker",
        members: [
          `serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`,
          "allUsers",
        ],
      }],
    },
  }],
});
assert.ok(
  publicPrivateTargetReport.blockers.includes(
    "PRIVATE_FUNCTION_PUBLIC_INVOKER_FORBIDDEN_issuesyntheticsession",
  ),
);

const conditionalPublicPrivateTargetReport = buildInventoryReport({
  ...rawInventory,
  runIamPolicies: [{
    ...rawInventory.runIamPolicies[0],
    policy: {
      bindings: [{
        role: "roles/run.invoker",
        members: ["allUsers"],
        condition: {
          title: "still-public",
          expression: "request.time < timestamp('2030-01-01T00:00:00Z')",
        },
      }],
    },
  }, ...rawInventory.runIamPolicies.slice(1)],
});
assert.ok(
  conditionalPublicPrivateTargetReport.blockers.includes(
    "PRIVATE_FUNCTION_PUBLIC_INVOKER_FORBIDDEN_issuesyntheticsession",
  ),
);

const conditionalPreviewTargetReport = buildInventoryReport({
  ...rawInventory,
  runIamPolicies: [{
    ...rawInventory.runIamPolicies[0],
    policy: {
      bindings: [{
        role: "roles/run.invoker",
        members: [`serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`],
        condition: {
          title: "conditional-preview",
          expression: "request.time < timestamp('2030-01-01T00:00:00Z')",
        },
      }],
    },
  }, ...rawInventory.runIamPolicies.slice(1)],
});
assert.ok(
  conditionalPreviewTargetReport.blockers.includes(
    "PRIVATE_FUNCTION_EXACT_PREVIEW_INVOKER_REQUIRED_issuesyntheticsession",
  ),
);

const healthPreviewInvokerReport = buildInventoryReport({
  ...rawInventory,
  runIamPolicies: rawInventory.runIamPolicies.map((entry) =>
    entry.serviceName.endsWith("/health")
      ? {
          ...entry,
          policy: {
            bindings: [{
              role: "roles/run.invoker",
              members: [`serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`],
            }],
          },
        }
      : entry),
});
assert.ok(
  healthPreviewInvokerReport.blockers.includes("PREVIEW_INVOKER_FORBIDDEN_health"),
);

const conditionalHealthPreviewInvokerReport = buildInventoryReport({
  ...rawInventory,
  runIamPolicies: rawInventory.runIamPolicies.map((entry) =>
    entry.serviceName.endsWith("/health")
      ? {
          ...entry,
          policy: {
            bindings: [{
              role: "roles/run.invoker",
              members: [`serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`],
              condition: {
                title: "conditional-preview-health",
                expression: "request.time < timestamp('2030-01-01T00:00:00Z')",
              },
            }],
          },
        }
      : entry),
});
assert.ok(
  conditionalHealthPreviewInvokerReport.blockers.includes(
    "PREVIEW_INVOKER_FORBIDDEN_health",
  ),
);

const productionPreviewReport = buildInventoryReport({
  ...rawInventory,
  vercel: {
    ...rawInventory.vercel,
    deployments: [{
      uid: "dpl_forbidden",
      projectId: APPROVED_SCOPE.vercelProjectId,
      name: APPROVED_SCOPE.vercelProjectName,
      target: "production",
      state: "READY",
    }],
  },
});
assert.ok(
  productionPreviewReport.blockers.includes(
    "VERCEL_PRODUCTION_DEPLOYMENT_FORBIDDEN_dpl_forbidden",
  ),
);

const forbiddenStorageReport = buildInventoryReport({
  ...rawInventory,
  buckets: [
    ...rawInventory.buckets,
    { name: `${APPROVED_SCOPE.projectId}.firebasestorage.app`, location: "EU" },
  ],
});
assert.equal(forbiddenStorageReport.inventoryPolicyConformant, false);
assert.ok(forbiddenStorageReport.blockers.includes("APP_CLOUD_STORAGE_MUST_REMAIN_OFF"));

const unknownStorageReport = buildInventoryReport({
  ...rawInventory,
  buckets: [...rawInventory.buckets, { name: "unknown-bucket", location: "EU" }],
});
assert.ok(unknownStorageReport.blockers.includes("UNCLASSIFIED_BUCKET_REQUIRES_REVIEW"));
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    hostingSites: [
      ...rawInventory.hostingSites,
      {
        name: `projects/${APPROVED_SCOPE.projectId}/sites/unexpected`,
        siteId: "unexpected",
      },
    ],
  }).blockers.includes("EXACT_DEFAULT_FIREBASE_HOSTING_SITE_REQUIRED"),
);
assert.ok(
  buildInventoryReport({
    ...rawInventory,
    hostingVersions: [{ name: "sites/example/versions/1" }],
  }).blockers.includes("FIREBASE_HOSTING_CONTENT_OR_CHANNEL_FORBIDDEN"),
);

const deactivationPlan = materializeDeactivationPlan();
assert.equal(deactivationPlan.status, "MATERIALIZED_NOT_EXECUTED");
assert.equal(deactivationPlan.externalWrites, 0);
assert.equal(
  deactivationPlan.expiryExecutionStatus,
  "AUTHORIZED_AT_EXPIRY_NOT_SCHEDULED",
);
assert.ok(deactivationPlan.command.includes("<CURRENT_CONTROL_EPOCH_PLUS_ONE>"));
assert.deepEqual(
  deactivationPlan.commands.map(({ step }) => step),
  [
    "DISABLE_STAGING_AND_ADVANCE_CONTROL_EPOCH",
    "RECOLLECT_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY",
    "VALIDATE_SYNTHETIC_DATA_DELETION_AND_TOMBSTONE_EVIDENCE",
    "DISABLE_EXACT_WORKLOAD_IDENTITY_PROVIDER",
    "DISABLE_EXACT_WORKLOAD_IDENTITY_POOL",
    "VERIFY_EXACT_WORKLOAD_IDENTITY_PROVIDER_AND_POOL_DISABLED",
  ],
);
assert.equal(deactivationPlan.command[0], "node");
assert.match(
  deactivationPlan.command[1].replaceAll("\\", "/"),
  /\/provider\/firebase\/tools\/set-staging-control\.mjs$/u,
);
assert.deepEqual(
  deactivationPlan.command.slice(2, 10),
  [
    "--project",
    APPROVED_SCOPE.projectId,
    "--google-account",
    APPROVED_SCOPE.approvedGoogleAccount,
    "--region",
    APPROVED_SCOPE.region,
    "--enabled",
    "false",
  ],
);
assert.equal(
  deactivationPlan.command.at(-1),
  EXECUTION_AUTHORIZATION.deactivation,
);
const syntheticDeletionEvidencePlan =
  materializeSyntheticDataDeletionEvidencePlan(
    safeBackendInventory,
    (() => {
      const authorizedInventory = buildInventoryReport(
        syntheticDeletionAuthorizedRawInventory(),
        {
          deployWindowExpiresAt:
            syntheticDeletionWindowExpiresAt,
          inventoryPhase: "SYNTHETIC_DELETION_AUTHORIZED",
        },
      );
      assert.deepEqual(authorizedInventory.blockers, []);
      const intent = materializeSyntheticDataDeletionIntent(
        authorizedInventory,
        syntheticDeletionWindowExpiresAt,
        syntheticDeletionObservedAt,
      );
      assert.equal(
        intent.initialStateClassification,
        "ALREADY_ZERO_WITH_RETAINED_TOMBSTONE_HISTORY",
      );
      assert.equal(
        validateSyntheticDataDeletionIntent(
          intent,
          authorizedInventory,
        ),
        true,
      );
      return intent;
    })(),
    (() => {
      const authorizedInventory = buildInventoryReport(
        syntheticDeletionAuthorizedRawInventory(),
        {
          deployWindowExpiresAt:
            syntheticDeletionWindowExpiresAt,
          inventoryPhase: "SYNTHETIC_DELETION_AUTHORIZED",
        },
      );
      const intent = materializeSyntheticDataDeletionIntent(
        authorizedInventory,
        syntheticDeletionWindowExpiresAt,
        syntheticDeletionObservedAt,
      );
      const revokedInventory = buildInventoryReport(
        syntheticDeletionRevokedRawInventory(),
        {
          inventoryPhase:
            "SYNTHETIC_DELETION_REVOKED_READBACK",
        },
      );
      assert.deepEqual(revokedInventory.blockers, []);
      const receipt = reduceSyntheticDataDeletionTranscript({
        afterInventory: authorizedInventory,
        beforeInventory: authorizedInventory,
        deleteInvocationCount: 0,
        deletionIdentityDownscopeReadback:
          syntheticDeletionIdentityLifecycleReadback(
            "downscope-for-synthetic-deletion",
            2,
          ),
        deletionIdentityRevokeReadback:
          syntheticDeletionIdentityLifecycleReadback(
            "revoke-deletion-identity",
            2,
          ),
        intent,
        observedAt: "2027-01-25T00:06:00.000Z",
        revokedInventory,
        windowExpiresAt: syntheticDeletionWindowExpiresAt,
      });
      assert.equal(
        receipt.executionClassification,
        "AUTHENTICATED_ALREADY_ZERO_WITH_TOMBSTONE_HISTORY_NO_OP",
      );
      assert.equal(receipt.externalWritesThisRun, 0);
      assert.equal(
        validateSyntheticDataDeletionExecutionReceipt(
          receipt,
          safeBackendInventory,
          intent,
        ),
        true,
      );
      return receipt;
    })(),
    new Date("2027-01-25T00:07:00.000Z"),
  );
assert.equal(syntheticDeletionEvidencePlan.externalWrites, 0);
assert.equal(syntheticDeletionEvidencePlan.humanConfirmed, false);
assert.equal(
  syntheticDeletionEvidencePlan.humanConfirmationText,
  syntheticDataDeletionConfirmationText(syntheticDeletionEvidencePlan),
);
const syntheticDeletionEvidence = syntheticDeletionEvidencePlan;
const syntheticDeletionConfirmation =
  materializeSyntheticDataDeletionConfirmation(
    syntheticDeletionEvidence,
    syntheticDeletionEvidence.humanConfirmationText,
    "2027-01-25T00:08:00.000Z",
  );
assert.equal(
  validateSyntheticDataDeletionConfirmation(
    syntheticDeletionConfirmation,
    syntheticDeletionEvidence,
  ),
  true,
);
assert.equal(syntheticDeletionConfirmation.actorIdentityClaimed, false);
assert.equal(syntheticDeletionConfirmation.signatureClaimed, false);
assert.equal(
  Object.hasOwn(syntheticDeletionConfirmation, "humanConfirmed"),
  false,
);
assert.throws(
  () => materializeSyntheticDataDeletionConfirmation(
    syntheticDeletionEvidence,
    "I confirm",
    "2027-01-25T00:08:00.000Z",
  ),
  /EXACT_SYNTHETIC_DATA_DELETION_CONFIRMATION_PHRASE_REQUIRED/u,
);
for (const invalidConfirmation of [
  {
    ...syntheticDeletionConfirmation,
    evidenceSha256: "0".repeat(64),
  },
  {
    ...syntheticDeletionConfirmation,
    actor: "unverified-claim",
  },
]) {
  assert.throws(
    () => validateSyntheticDataDeletionConfirmation(
      invalidConfirmation,
      syntheticDeletionEvidence,
    ),
    /VALID_SYNTHETIC_DATA_DELETION_CONFIRMATION_REQUIRED/u,
  );
}
const deactivationAdapter = deactivationTestAdapter({
  inventories: [
    scriptedValue(safeBackendRawInventory({
      poolDisabled: false,
      providerDisabled: false,
    })),
  ],
  commands: [
    deactivationCommandStep(
      "DISABLE_EXACT_WORKLOAD_IDENTITY_PROVIDER",
      {
        projectId: APPROVED_SCOPE.projectId,
        action: "disable-workload-identity-provider",
        provider: { name: expectedProviderName, disabled: true },
        accessTokenPrinted: false,
        oidcTokenPrinted: false,
      },
    ),
    deactivationCommandStep(
      "DISABLE_EXACT_WORKLOAD_IDENTITY_POOL",
      {
        projectId: APPROVED_SCOPE.projectId,
        action: "disable-workload-identity-pool",
        pool: { name: expectedPoolName, disabled: true },
        accessTokenPrinted: false,
        oidcTokenPrinted: false,
      },
    ),
    deactivationCommandStep(
      "VERIFY_EXACT_WORKLOAD_IDENTITY_PROVIDER_AND_POOL_DISABLED",
      disabledWifVerificationOutput(),
    ),
  ],
  syntheticDataDeletionEvidence: syntheticDeletionEvidence,
  syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
});
const deactivationReceipt = await executeDeactivationPlanWithTestDoubles(
  materializeDeactivationPlan(9),
  9,
  deactivationAdapter,
);
assert.deepEqual(
  readExternalResourceOperatorInMemoryTestTranscript(
    deactivationAdapter,
  ).commandSteps,
  [
    "DISABLE_EXACT_WORKLOAD_IDENTITY_PROVIDER",
    "DISABLE_EXACT_WORKLOAD_IDENTITY_POOL",
    "VERIFY_EXACT_WORKLOAD_IDENTITY_PROVIDER_AND_POOL_DISABLED",
  ],
);
assert.equal(deactivationReceipt.executed, true);
assert.equal(deactivationReceipt.projectId, APPROVED_SCOPE.projectId);
assert.equal(
  deactivationReceipt.approvedGoogleAccount,
  APPROVED_SCOPE.approvedGoogleAccount,
);
assert.equal(deactivationReceipt.region, APPROVED_SCOPE.region);
assert.equal(deactivationReceipt.stagingEnabled, false);
assert.equal(deactivationReceipt.controlEpoch, 9);
assert.equal(deactivationReceipt.safeBackendForDestructionVerified, true);
assert.equal(deactivationReceipt.safeBackendInventorySource,
  "LIVE_READ_ONLY_PROVIDER_QUERIES");
assert.equal(deactivationReceipt.sessionIssuanceDisabled, true);
assert.equal(deactivationReceipt.deployIdentityRevoked, true);
assert.equal(deactivationReceipt.syntheticDataDeletionVerified, true);
assert.match(
  deactivationReceipt.syntheticDataDeletionConfirmationSha256,
  /^[a-f0-9]{64}$/u,
);
assert.equal(deactivationReceipt.accessTokenPrinted, false);
assert.equal(deactivationReceipt.capabilityMaterialPrinted, false);
assert.equal(
  JSON.stringify(deactivationReceipt).includes("stdout"),
  false,
);
const scopeMismatchAdapter = deactivationTestAdapter({
  inventories: [scriptedValue(safeBackendRawInventory())],
  syntheticDataDeletionEvidence: syntheticDeletionEvidence,
  syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
});
await assert.rejects(
  executeDeactivationPlanWithTestDoubles({
    ...materializeDeactivationPlan(9),
    approvalBinding: {
      ...APPROVED_SCOPE,
      region: "us-central1",
    },
  }, 9, scopeMismatchAdapter),
  /DEACTIVATION_PLAN_SCOPE_MISMATCH/u,
);
await assert.rejects(
  executeDeactivationPlanWithTestDoubles(
    materializeDeactivationPlan(9),
    9,
    {
      collectReadOnlyInventoryImpl: async () => safeBackendRawInventory(),
    },
  ),
  /MODULE_CREATED_IN_MEMORY_TEST_ADAPTER_REQUIRED/u,
);
const missingDeletionEvidenceAdapter = deactivationTestAdapter({
  inventories: [scriptedValue(safeBackendRawInventory())],
  syntheticDataDeletionEvidence: null,
  syntheticDataDeletionConfirmation: null,
});
await assert.rejects(
  executeDeactivationPlanWithTestDoubles(
    materializeDeactivationPlan(9),
    9,
    missingDeletionEvidenceAdapter,
  ),
  /VALID_SYNTHETIC_DATA_DELETION_EVIDENCE_REQUIRED/u,
);
assert.deepEqual(
  readExternalResourceOperatorInMemoryTestTranscript(
    missingDeletionEvidenceAdapter,
  ).commandSteps,
  [],
);
const wrongSyntheticInventoryDigestEvidence = {
  ...syntheticDeletionEvidence,
  observedSyntheticDataInventoryDigest: "0".repeat(64),
};
wrongSyntheticInventoryDigestEvidence.humanConfirmationText =
  syntheticDataDeletionConfirmationText(
    wrongSyntheticInventoryDigestEvidence,
  );
wrongSyntheticInventoryDigestEvidence.humanConfirmationSha256 =
  createHash("sha256")
    .update(
      wrongSyntheticInventoryDigestEvidence.humanConfirmationText,
      "utf8",
    )
    .digest("hex");
const wrongSyntheticInventoryDigestConfirmation =
  materializeSyntheticDataDeletionConfirmation(
    wrongSyntheticInventoryDigestEvidence,
    wrongSyntheticInventoryDigestEvidence.humanConfirmationText,
    "2027-01-25T00:09:00.000Z",
  );
const incompleteDeletionEvidenceAdapter = deactivationTestAdapter({
  inventories: [scriptedValue(safeBackendRawInventory())],
  syntheticDataDeletionEvidence: {
    schemaVersion: "wp13.12b-synthetic-data-deletion-evidence-v1",
    projectId: APPROVED_SCOPE.projectId,
    stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
    allActiveSyntheticSessionPayloadsDeleted: true,
    tombstoneAndRetentionDecisionSecured: true,
    humanConfirmed: true,
  },
  syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
});
await assert.rejects(
  executeDeactivationPlanWithTestDoubles(
    materializeDeactivationPlan(9),
    9,
    incompleteDeletionEvidenceAdapter,
  ),
  /VALID_SYNTHETIC_DATA_DELETION_EVIDENCE_REQUIRED/u,
);
assert.deepEqual(
  readExternalResourceOperatorInMemoryTestTranscript(
    incompleteDeletionEvidenceAdapter,
  ).commandSteps,
  [],
);
const mismatchedDeletionEvidenceAdapter = deactivationTestAdapter({
  inventories: [scriptedValue(safeBackendRawInventory())],
  syntheticDataDeletionEvidence: wrongSyntheticInventoryDigestEvidence,
  syntheticDataDeletionConfirmation:
    wrongSyntheticInventoryDigestConfirmation,
});
await assert.rejects(
  executeDeactivationPlanWithTestDoubles(
    materializeDeactivationPlan(9),
    9,
    mismatchedDeletionEvidenceAdapter,
  ),
  /SYNTHETIC_DATA_DELETION_EVIDENCE_LIVE_INVENTORY_MISMATCH/u,
);
assert.deepEqual(
  readExternalResourceOperatorInMemoryTestTranscript(
    mismatchedDeletionEvidenceAdapter,
  ).commandSteps,
  [],
);
const localFixtureRawInventory = {
  ...safeBackendRawInventory(),
  source: "LOCAL_TEST_FIXTURE",
};
const localFixtureAdapter = deactivationTestAdapter({
  inventories: [scriptedValue(localFixtureRawInventory)],
  syntheticDataDeletionEvidence: syntheticDeletionEvidence,
  syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
});
await assert.rejects(
  executeDeactivationPlanWithTestDoubles(
    materializeDeactivationPlan(9),
    9,
    localFixtureAdapter,
  ),
  /FRESH_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY_REQUIRED/u,
);
assert.deepEqual(
  readExternalResourceOperatorInMemoryTestTranscript(
    localFixtureAdapter,
  ).commandSteps,
  [],
);
const unsafeIssuanceRaw = safeBackendRawInventory();
unsafeIssuanceRaw.functions.find(
  (fn) => fn.name.endsWith("/issueSyntheticSession"),
).serviceConfig.environmentVariables.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED =
  "true";
const unsafeIssuanceAdapter = deactivationTestAdapter({
  inventories: [scriptedValue(unsafeIssuanceRaw)],
  syntheticDataDeletionEvidence: syntheticDeletionEvidence,
  syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
});
await assert.rejects(
  executeDeactivationPlanWithTestDoubles(
    materializeDeactivationPlan(9),
    9,
    unsafeIssuanceAdapter,
  ),
  /FRESH_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY_REQUIRED/u,
);
assert.deepEqual(
  readExternalResourceOperatorInMemoryTestTranscript(
    unsafeIssuanceAdapter,
  ).commandSteps,
  [],
);
const unrevokedDeployIdentityRaw = safeBackendRawInventory();
unrevokedDeployIdentityRaw.iamPolicy.bindings.push({
  role: "roles/cloudfunctions.developer",
  members: [`serviceAccount:${approvedDeployServiceAccount}`],
});
const unrevokedDeployIdentityAdapter = deactivationTestAdapter({
  inventories: [scriptedValue(unrevokedDeployIdentityRaw)],
  syntheticDataDeletionEvidence: syntheticDeletionEvidence,
  syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
});
await assert.rejects(
  executeDeactivationPlanWithTestDoubles(
    materializeDeactivationPlan(9),
    9,
    unrevokedDeployIdentityAdapter,
  ),
  /FRESH_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY_REQUIRED/u,
);
assert.deepEqual(
  readExternalResourceOperatorInMemoryTestTranscript(
    unrevokedDeployIdentityAdapter,
  ).commandSteps,
  [],
);

const repeatSafeAdapter = deactivationTestAdapter({
  inventories: [scriptedValue(safeBackendRawInventory())],
  commands: [
    deactivationCommandStep(
      "VERIFY_EXACT_WORKLOAD_IDENTITY_PROVIDER_AND_POOL_DISABLED",
      disabledWifVerificationOutput(),
    ),
  ],
  syntheticDataDeletionEvidence: syntheticDeletionEvidence,
  syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
});
const repeatSafeReceipt = await executeDeactivationPlanWithTestDoubles(
  materializeDeactivationPlan(9),
  9,
  repeatSafeAdapter,
);
assert.deepEqual(
  readExternalResourceOperatorInMemoryTestTranscript(
    repeatSafeAdapter,
  ).commandSteps,
  ["VERIFY_EXACT_WORKLOAD_IDENTITY_PROVIDER_AND_POOL_DISABLED"],
);
assert.equal(repeatSafeReceipt.workloadIdentityProviderDisabled, true);
assert.equal(repeatSafeReceipt.workloadIdentityPoolDisabled, true);

const controlBeforeRaw = safeBackendRawInventory({ controlEpoch: 2 });
controlBeforeRaw.firestoreControlDocument.fields.reasonCode.stringValue =
  "PROOF_WINDOW_CLOSED";
const controlAdvancedAdapter = deactivationTestAdapter({
  inventories: [
    scriptedValue(controlBeforeRaw),
    scriptedValue(safeBackendRawInventory({ controlEpoch: 9 })),
  ],
  commands: [
    deactivationCommandStep(
      "DISABLE_STAGING_AND_ADVANCE_CONTROL_EPOCH",
      {
        updated: true,
        project: APPROVED_SCOPE.projectId,
        approvedGoogleAccount: APPROVED_SCOPE.approvedGoogleAccount,
        region: APPROVED_SCOPE.region,
        stagingEnabled: false,
        controlEpoch: 9,
        accessTokenPrinted: false,
        capabilityMaterialPrinted: false,
      },
    ),
    deactivationCommandStep(
      "VERIFY_EXACT_WORKLOAD_IDENTITY_PROVIDER_AND_POOL_DISABLED",
      disabledWifVerificationOutput(),
    ),
  ],
  syntheticDataDeletionEvidence: syntheticDeletionEvidence,
  syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
});
const controlAdvancedReceipt = await executeDeactivationPlanWithTestDoubles(
  materializeDeactivationPlan(9),
  9,
  controlAdvancedAdapter,
);
const controlAdvancedTranscript =
  readExternalResourceOperatorInMemoryTestTranscript(
    controlAdvancedAdapter,
  );
assert.deepEqual(controlAdvancedTranscript.commandSteps, [
  "DISABLE_STAGING_AND_ADVANCE_CONTROL_EPOCH",
  "VERIFY_EXACT_WORKLOAD_IDENTITY_PROVIDER_AND_POOL_DISABLED",
]);
assert.equal(controlAdvancedTranscript.inventoryReadCount, 2);
assert.equal(controlAdvancedReceipt.controlEpoch, 9);
let forgedProductionDeactivationInventoryCalls = 0;
let forgedProductionDeactivationCommandCalls = 0;
await assert.rejects(
  executeDeactivationPlan({
    controlEpoch: 9,
    executionAuthorization: EXECUTION_AUTHORIZATION.deactivation,
    now: new Date("2099-01-25T00:00:00.000Z"),
    collectReadOnlyInventoryImpl: async () => {
      forgedProductionDeactivationInventoryCalls += 1;
      return safeBackendRawInventory();
    },
    executeCommandImpl() {
      forgedProductionDeactivationCommandCalls += 1;
      throw new Error("must not execute");
    },
  }),
  /STAGING_EXPIRY_NOT_REACHED/u,
);
assert.equal(forgedProductionDeactivationInventoryCalls, 0);
assert.equal(forgedProductionDeactivationCommandCalls, 0);
assert.throws(
  () => materializeDeactivationPlan(1),
  /STRICTLY_ADVANCED_CONTROL_EPOCH_REQUIRED/u,
);
assert.throws(
  () =>
    assertExecutionAuthorization(
      "deactivation",
      EXECUTION_AUTHORIZATION.deactivation,
      new Date("2027-01-24T23:59:59.999Z"),
    ),
  /STAGING_EXPIRY_NOT_REACHED/u,
);
assert.throws(
  () =>
    assertExecutionAuthorization(
      "destruction",
      "AUTHORIZE_SOMETHING_ELSE",
      new Date("2027-01-25T00:00:00.000Z"),
    ),
  /EXACT_DESTRUCTION_EXECUTION_AUTHORIZATION_REQUIRED/u,
);
assert.equal(
  assertExecutionAuthorization(
    "destruction",
    EXECUTION_AUTHORIZATION.destruction,
    new Date("2027-01-25T00:00:00.000Z"),
  ),
  true,
);
assert.throws(
  () =>
    assertExecutionAuthorization(
      "vercelDestruction",
      "AUTHORIZE_SOMETHING_ELSE",
      new Date("2027-01-25T00:00:00.000Z"),
    ),
  /EXACT_VERCEL_DESTRUCTION_EXECUTION_AUTHORIZATION_REQUIRED/u,
);
assert.equal(
  assertExecutionAuthorization(
    "vercelDestruction",
    EXECUTION_AUTHORIZATION.vercelDestruction,
    new Date("2027-01-25T00:00:00.000Z"),
  ),
  true,
);

const vercelDestructionPlan = materializeVercelDestructionPlan();
assert.equal(vercelDestructionPlan.externalWrites, 0);
assert.equal(vercelDestructionPlan.status, "MATERIALIZED_NOT_EXECUTED");
assert.equal(
  vercelDestructionPlan.approvalBinding.projectId,
  APPROVED_SCOPE.vercelProjectId,
);
assert.match(
  vercelDestructionPlan.deletionEndpoint,
  new RegExp(APPROVED_SCOPE.vercelProjectId, "u"),
);
assert.equal(vercelDestructionPlan.tokenOutput, false);
let preExpiryVercelProviderCallCount = 0;
let preExpiryVercelInventoryCallCount = 0;
await assert.rejects(
  executeExactVercelProjectDeletion({
    collectReadOnlyInventoryImpl: async () => {
      preExpiryVercelInventoryCallCount += 1;
      return safeBackendRawInventory();
    },
    deactivation: deactivationReceipt,
    executionAuthorization: EXECUTION_AUTHORIZATION.vercelDestruction,
    now: new Date("2099-01-25T00:00:00.000Z"),
    async providerCallImpl() {
      preExpiryVercelProviderCallCount += 1;
      return { absent: true, value: null };
    },
    syntheticDataDeletion: syntheticDeletionEvidence,
  }),
  /STAGING_EXPIRY_NOT_REACHED/u,
);
assert.equal(preExpiryVercelInventoryCallCount, 0);
assert.equal(preExpiryVercelProviderCallCount, 0);
const unsafeVercelPreflightInventory = buildInventoryReport(
  safeBackendRawInventory({
    poolDisabled: false,
    providerDisabled: false,
  }),
  { inventoryPhase: "SAFE_BACKEND_FOR_DESTRUCTION" },
);
assert.throws(
  () => validateVercelDestructionPreflightInventory(
    unsafeVercelPreflightInventory,
    deactivationReceipt,
    syntheticDeletionEvidence,
    syntheticDeletionConfirmation,
  ),
  /FRESH_POST_DEACTIVATION_INVENTORY_REQUIRED_BEFORE_VERCEL_DELETION/u,
);
const validVercelPreflightInventory = buildInventoryReport(
  safeBackendRawInventory(),
  { inventoryPhase: "SAFE_BACKEND_FOR_DESTRUCTION" },
);
assert.throws(
  () => validateVercelDestructionPreflightInventory(
    validVercelPreflightInventory,
    {
      ...deactivationReceipt,
      controlEpoch: 8,
    },
    syntheticDeletionEvidence,
    syntheticDeletionConfirmation,
  ),
  /DEACTIVATION_SYNTHETIC_EVIDENCE_EPOCH_MISMATCH/u,
);
const alreadyAbsentVercelRaw = safeBackendRawInventory();
markAuthenticatedVercelProjectAbsence(alreadyAbsentVercelRaw);
const alreadyAbsentVercelInventory = buildInventoryReport(
  alreadyAbsentVercelRaw,
);
const vercelAlreadyAbsentRecovery =
  reduceVercelDestructionTranscript({
    deactivation: deactivationReceipt,
    deletionRequested: false,
    domainsAfterProjectAbsence: [],
    deploymentsAfterProjectAbsence: [],
    deploymentsBeforeDeletion: [],
    environmentVariablesAfterProjectAbsence: [],
    liveInventory: alreadyAbsentVercelInventory,
    observedAt: "2027-01-25T00:05:00.000Z",
    preDeleteProjectAbsent: true,
    projectAbsentAfterExecution: true,
    projectSettingsAbsentAfterProjectAbsence: true,
    syntheticDataDeletion: syntheticDeletionEvidence,
    syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
  });
assert.equal(vercelAlreadyAbsentRecovery.deletionExecuted, false);
assert.equal(vercelAlreadyAbsentRecovery.alreadyAbsent, true);
assert.equal(vercelAlreadyAbsentRecovery.externalWrites, 0);
assert.equal(
  vercelAlreadyAbsentRecovery.recoveryClassification,
  "AUTHENTICATED_ALREADY_ABSENT_RETRY",
);
assert.equal(vercelAlreadyAbsentRecovery.humanConfirmed, false);
assert.equal(
  vercelAlreadyAbsentRecovery.humanConfirmationText,
  vercelDestructionConfirmationText(vercelAlreadyAbsentRecovery),
);
assert.equal(
  vercelAlreadyAbsentRecovery.deploymentsAfterProjectAbsenceReadbackAuthenticated,
  true,
);
assert.equal(
  vercelAlreadyAbsentRecovery.domainsAfterProjectAbsenceReadbackAuthenticated,
  true,
);
assert.throws(
  () => reduceVercelDestructionTranscript({
    deactivation: deactivationReceipt,
    deletionRequested: false,
    domainsAfterProjectAbsence: [],
    deploymentsAfterProjectAbsence: [{ uid: "dpl_child_remains" }],
    deploymentsBeforeDeletion: [],
    environmentVariablesAfterProjectAbsence: [],
    liveInventory: alreadyAbsentVercelInventory,
    observedAt: "2027-01-25T00:05:00.000Z",
    preDeleteProjectAbsent: true,
    projectAbsentAfterExecution: true,
    projectSettingsAbsentAfterProjectAbsence: true,
    syntheticDataDeletion: syntheticDeletionEvidence,
    syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
  }),
  /VALID_VERCEL_DESTRUCTION_TRANSCRIPT_REQUIRED/u,
);
for (const postAbsenceMutation of [
  { domainsAfterProjectAbsence: [{ name: "example.invalid" }] },
  {
    environmentVariablesAfterProjectAbsence: [{
      id: "env_remaining",
    }],
  },
  { projectSettingsAbsentAfterProjectAbsence: false },
]) {
  assert.throws(
    () => reduceVercelDestructionTranscript({
      deactivation: deactivationReceipt,
      deletionRequested: false,
      domainsAfterProjectAbsence: [],
      deploymentsAfterProjectAbsence: [],
      deploymentsBeforeDeletion: [],
      environmentVariablesAfterProjectAbsence: [],
      liveInventory: alreadyAbsentVercelInventory,
      observedAt: "2027-01-25T00:05:00.000Z",
      preDeleteProjectAbsent: true,
      projectAbsentAfterExecution: true,
      projectSettingsAbsentAfterProjectAbsence: true,
      syntheticDataDeletion: syntheticDeletionEvidence,
      syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
      ...postAbsenceMutation,
    }),
    /VALID_VERCEL_DESTRUCTION_TRANSCRIPT_REQUIRED/u,
  );
}

assert.equal(isVercelAbsentForGoogleDestruction(report), false);
assert.deepEqual(buildDestructionCommands(report), []);
assert.equal(isVercelAbsentForGoogleDestruction(googleDestructionReport), true);
const commands = buildDestructionCommands(googleDestructionReport);
for (const command of commands.filter(
  (candidate) => candidate.file === "gcloud",
)) {
  assert.equal(
    validatePinnedGoogleDestructionCommand(command),
    true,
  );
}
assert.ok(
  commands.every(
    (command) => ["firebase", "gcloud"].includes(command.file),
  ),
);
const exactGoogleCommand = commands.find(
  (command) => command.file === "gcloud",
);
for (const unsafeCommand of [
  {
    ...exactGoogleCommand,
    args: exactGoogleCommand.args.map((value) =>
      value.startsWith("--project=")
        ? "--project=attacker-project"
        : value),
  },
  {
    ...exactGoogleCommand,
    unexpected: true,
  },
  {
    ...exactGoogleCommand,
    args: [...exactGoogleCommand.args, "--log-http"],
  },
  {
    ...exactGoogleCommand,
    file: "C:\\attacker\\gcloud.exe",
  },
]) {
  assert.throws(
    () => validatePinnedGoogleDestructionCommand(unsafeCommand),
    /EXACT_PINNED_GOOGLE_DESTRUCTION_COMMAND_REQUIRED/u,
  );
}
assert.ok(
  commands.some((command) => command.step === "UNLINK_PROJECT_BILLING"),
);
const alreadyUnlinkedGoogleRaw = structuredClone(
  rawInventoryWithDestroyedVercel,
);
alreadyUnlinkedGoogleRaw.billing.billingEnabled = false;
const alreadyUnlinkedGoogleReport = buildInventoryReport(
  alreadyUnlinkedGoogleRaw,
);
assert.equal(alreadyUnlinkedGoogleReport.blockers.length, 0);
assert.equal(
  buildDestructionCommands(alreadyUnlinkedGoogleReport).some(
    (command) => command.step === "UNLINK_PROJECT_BILLING",
  ),
  false,
);
const alreadyAbsentGoogleRaw = structuredClone(
  rawInventoryWithDestroyedVercel,
);
alreadyAbsentGoogleRaw.project = null;
alreadyAbsentGoogleRaw.budgets = [];
const alreadyAbsentGoogleReport = buildInventoryReport(
  alreadyAbsentGoogleRaw,
);
assert.equal(alreadyAbsentGoogleReport.blockers.length, 0);
assert.equal(alreadyAbsentGoogleReport.zeroResourceClaimAllowed, true);
assert.deepEqual(buildDestructionCommands(alreadyAbsentGoogleReport), []);
const alreadyAbsentGooglePlan = materializeDestructionPlan(
  alreadyAbsentGoogleReport,
);
assert.equal(
  alreadyAbsentGooglePlan.status,
  "VERIFIED_ALREADY_DESTROYED_ZERO_COMMAND_NO_OP",
);
assert.equal(alreadyAbsentGooglePlan.verifiedAlreadyAbsent, true);
assert.deepEqual(alreadyAbsentGooglePlan.commands, []);
const destroyedSecretVersionRaw = structuredClone(
  rawInventoryWithDestroyedVercel,
);
destroyedSecretVersionRaw.secretVersions[0].state = "DESTROYED";
const destroyedSecretVersionResumeReport = buildInventoryReport(
  destroyedSecretVersionRaw,
);
assert.equal(destroyedSecretVersionResumeReport.blockers.length, 0);
const destroyedSecretVersionResumeCommands = buildDestructionCommands(
  destroyedSecretVersionResumeReport,
);
assert.equal(
  destroyedSecretVersionResumeCommands.some(
    (command) => command.step === "DESTROY_APPROVED_SECRET_VERSION",
  ),
  false,
);
assert.equal(
  destroyedSecretVersionResumeCommands.some(
    (command) => command.step === "DELETE_APPROVED_SECRET",
  ),
  true,
);
assert.ok(
  commands.some(
    (command) => command.step === "REMOVE_EXACT_PREVIEW_RUN_INVOKER_BINDING",
  ),
);
assert.equal(
  commands.filter(
    (command) => command.step === "REMOVE_EXACT_PREVIEW_RUN_INVOKER_BINDING",
  ).length,
  2,
);
assert.ok(
  commands
    .filter((command) => command.step === "REMOVE_EXACT_PREVIEW_RUN_INVOKER_BINDING")
    .every((command) => !command.args.includes("health")),
);
assert.ok(commands.some((command) => command.step === "DELETE_APPROVED_FUNCTION"));
assert.ok(
  commands.some(
    (command) => command.step === "DELETE_EXACT_WORKLOAD_IDENTITY_PROVIDER",
  ),
);
assert.ok(
  commands.some(
    (command) => command.step === "DELETE_EXACT_WORKLOAD_IDENTITY_POOL",
  ),
);
assert.ok(
  commands.some(
    (command) => command.step === "DELETE_APPROVED_PREVIEW_SERVICE_ACCOUNT",
  ),
);
assert.ok(
  commands.some(
    (command) => command.step === "DELETE_APPROVED_DEPLOY_SERVICE_ACCOUNT",
  ),
);
assert.ok(
  commands.some((command) => command.step === "DESTROY_APPROVED_SECRET_VERSION"),
);
assert.ok(
  commands.some((command) => command.step === "REQUEST_ISOLATED_PROJECT_DELETION"),
);
assert.ok(
  commands.every(
    (command) =>
      !command.args.includes(`gs://gcf-v2-sources-${projectNumber}-${APPROVED_SCOPE.region}`),
  ),
);
assert.ok(
  commands
    .filter((command) => command.step === "REQUEST_ISOLATED_PROJECT_DELETION")
    .every((command) => command.args.includes(APPROVED_SCOPE.projectId)),
);
assert.ok(
  commands.every(
    (command) =>
      !command.args.includes(APPROVED_SCOPE.vercelTeamId)
      && !command.args.includes(APPROVED_SCOPE.vercelProjectId),
  ),
);

const destructionPlan = materializeDestructionPlan(googleDestructionReport);
assert.equal(destructionPlan.externalWrites, 0);
assert.equal(destructionPlan.status, "MATERIALIZED_NOT_EXECUTED");
assert.equal(destructionPlan.directBucketDeletion, false);
assert.equal(destructionPlan.vercelProjectDeletionIncludedInGoogleCommands, false);
assert.equal(destructionPlan.commands.length, commands.length);
const blockedDestructionPlan = materializeDestructionPlan(forbiddenStorageReport);
assert.equal(blockedDestructionPlan.commands.length, 0);
const livePreviewDestructionPlan = materializeDestructionPlan(report);
assert.equal(livePreviewDestructionPlan.commands.length, 0);
assert.ok(
  livePreviewDestructionPlan.inventoryBlockers.includes(
    "VERCEL_PROJECT_MUST_BE_ABSENT_BEFORE_GOOGLE_DESTRUCTION",
  ),
);

const previewDestructionConfirmation =
  materializePreviewDestructionConfirmation(
    vercelAlreadyAbsentRecovery,
    vercelAlreadyAbsentRecovery.humanConfirmationText,
    "2027-01-25T00:06:00.000Z",
  );
assert.equal(
  validatePreviewDestructionConfirmation(
    previewDestructionConfirmation,
    vercelAlreadyAbsentRecovery,
  ),
  true,
);
assert.equal(previewDestructionConfirmation.actorIdentityClaimed, false);
assert.equal(previewDestructionConfirmation.signatureClaimed, false);
assert.equal(
  Object.hasOwn(previewDestructionConfirmation, "humanConfirmed"),
  false,
);
assert.throws(
  () => materializePreviewDestructionConfirmation(
    vercelAlreadyAbsentRecovery,
    "I confirm",
    "2027-01-25T00:06:00.000Z",
  ),
  /EXACT_PREVIEW_DESTRUCTION_CONFIRMATION_PHRASE_REQUIRED/u,
);
for (const invalidConfirmation of [
  {
    ...previewDestructionConfirmation,
    evidenceSha256: "0".repeat(64),
  },
  {
    ...previewDestructionConfirmation,
    signature: "unverified-claim",
  },
]) {
  assert.throws(
    () => validatePreviewDestructionConfirmation(
      invalidConfirmation,
      vercelAlreadyAbsentRecovery,
    ),
    /VALID_PREVIEW_DESTRUCTION_CONFIRMATION_REQUIRED/u,
  );
}
const validEvidence = {
  deactivation: deactivationReceipt,
  syntheticDataDeletion: syntheticDeletionEvidence,
  syntheticDataDeletionConfirmation: syntheticDeletionConfirmation,
  previewDestruction: vercelAlreadyAbsentRecovery,
  previewDestructionConfirmation,
};
assert.equal(validateDeactivationEvidence(validEvidence.deactivation), true);
assert.equal(validateDestructionEvidence(validEvidence), true);
const evidenceBoundGoogleDestructionRaw = safeBackendRawInventory();
markAuthenticatedVercelProjectAbsence(
  evidenceBoundGoogleDestructionRaw,
);
const evidenceBoundGoogleDestructionInventory = buildInventoryReport(
  evidenceBoundGoogleDestructionRaw,
);
assert.equal(
  evidenceBoundGoogleDestructionInventory.inventoryLifecyclePhase,
  "POST_DEACTIVATION_DESTRUCTION_IN_PROGRESS",
);
assert.equal(
  validateGoogleDestructionPreflightInventory(
    evidenceBoundGoogleDestructionInventory,
    validEvidence,
  ).controlEpoch,
  9,
);
const staleReceiptEvidence = {
  ...validEvidence,
  deactivation: {
    ...validEvidence.deactivation,
    controlEpoch: 8,
  },
};
assert.throws(
  () => validateGoogleDestructionPreflightInventory(
    evidenceBoundGoogleDestructionInventory,
    staleReceiptEvidence,
  ),
  /DEACTIVATION_SYNTHETIC_EVIDENCE_EPOCH_MISMATCH/u,
);
const driftedSyntheticInventory = structuredClone(
  evidenceBoundGoogleDestructionInventory,
);
const driftedTombstones =
  driftedSyntheticInventory.resources.firestoreDataInventory.collections
    .find((collection) =>
      collection.collectionId === "syntheticSessionTombstones");
driftedTombstones.count = 2;
driftedTombstones.documentNames = [
  `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
    + "syntheticSessionTombstones/"
    + "synthetic-wp13-12b-abcdefghijklmnopqrst",
  `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
    + "syntheticSessionTombstones/"
    + "synthetic-wp13-12b-ponmlkjihgfedcbazyxw",
];
assert.throws(
  () => validateGoogleDestructionPreflightInventory(
    driftedSyntheticInventory,
    validEvidence,
  ),
  /SYNTHETIC_DATA_DELETION_EVIDENCE_LIVE_INVENTORY_MISMATCH/u,
);
const reenabledIssuanceInventory = structuredClone(
  evidenceBoundGoogleDestructionInventory,
);
reenabledIssuanceInventory.resources.functions.find(
  (fn) => fn.name === "issueSyntheticSession",
).environmentVariables.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED = "true";
assert.throws(
  () => validateGoogleDestructionPreflightInventory(
    reenabledIssuanceInventory,
    validEvidence,
  ),
  /FRESH_LIVE_DESTRUCTION_PHASE_EVIDENCE_PREFLIGHT_REQUIRED/u,
);
const wrongDestructionReasonInventory = structuredClone(
  evidenceBoundGoogleDestructionInventory,
);
wrongDestructionReasonInventory.resources.firestoreDataInventory.control
  .reasonCode = "PROOF_WINDOW_CLOSED";
assert.throws(
  () => validateGoogleDestructionPreflightInventory(
    wrongDestructionReasonInventory,
    validEvidence,
  ),
  /FRESH_LIVE_DESTRUCTION_PHASE_EVIDENCE_PREFLIGHT_REQUIRED/u,
);
assert.throws(
  () => validatePreviewDestructionEvidence({
    ...vercelAlreadyAbsentRecovery,
    humanConfirmationText: "I confirm",
    humanConfirmationSha256: "0".repeat(64),
    humanConfirmed: true,
  }, deactivationReceipt, syntheticDeletionEvidence,
  syntheticDeletionConfirmation),
  /VALID_PREVIEW_DESTRUCTION_EVIDENCE_REQUIRED/u,
);
assert.equal(
  validateDestructionEvidence(validEvidence),
  true,
);
assert.throws(
  () => validateDestructionEvidence({
    ...validEvidence,
    previewDestruction: {
      ...vercelAlreadyAbsentRecovery,
      humanConfirmed: true,
    },
  }),
  /VALID_PREVIEW_DESTRUCTION_EVIDENCE_REQUIRED/u,
);
assert.throws(
  () =>
    assertVercelAbsentBeforeGoogleDestruction(
      report,
      validEvidence.previewDestruction,
    ),
  /VERCEL_PROJECT_MUST_BE_ABSENT_BEFORE_GOOGLE_DESTRUCTION/u,
);
assert.equal(
  assertVercelAbsentBeforeGoogleDestruction(
    googleDestructionReport,
    validEvidence.previewDestruction,
  ),
  true,
);
assert.throws(
  () =>
    validateDestructionEvidence({
      ...validEvidence,
      syntheticDataDeletion: {
        ...validEvidence.syntheticDataDeletion,
        humanConfirmed: true,
      },
    }),
  /VALID_SYNTHETIC_DATA_DELETION_EVIDENCE_REQUIRED/u,
);
assert.throws(
  () =>
    validateDestructionEvidence({
      ...validEvidence,
      previewDestruction: {
        ...validEvidence.previewDestruction,
        vercelProjectId: "prj_wrong",
      },
    }),
  /VALID_PREVIEW_DESTRUCTION_EVIDENCE_REQUIRED/u,
);

const localPlanResult = spawnSync(
  process.execPath,
  [
    "scripts/wp13-12b-external-resource-operator.mjs",
    "--action",
    "deactivation-plan",
  ],
  {
    encoding: "utf8",
    env: sanitizedNodeChildEnvironmentForTesting({}),
    windowsHide: true,
  },
);
assert.equal(localPlanResult.status, 0, localPlanResult.stderr);
const localPlan = JSON.parse(localPlanResult.stdout);
assert.equal(localPlan.status, "MATERIALIZED_NOT_EXECUTED");
assert.equal(localPlan.externalWrites, 0);

const localVercelPlanResult = spawnSync(
  process.execPath,
  [
    "scripts/wp13-12b-external-resource-operator.mjs",
    "--action",
    "vercel-destruction-plan",
  ],
  {
    encoding: "utf8",
    env: sanitizedNodeChildEnvironmentForTesting({}),
    windowsHide: true,
  },
);
assert.equal(localVercelPlanResult.status, 0, localVercelPlanResult.stderr);
const localVercelPlan = JSON.parse(localVercelPlanResult.stdout);
assert.equal(localVercelPlan.status, "MATERIALIZED_NOT_EXECUTED");
assert.equal(localVercelPlan.externalWrites, 0);
assert.equal(
  localVercelPlan.approvalBinding.projectId,
  APPROVED_SCOPE.vercelProjectId,
);

const rejectedExecution = spawnSync(
  process.execPath,
  [
    "scripts/wp13-12b-external-resource-operator.mjs",
    "--action",
    "deactivation-plan",
    "--execute",
    "WRONG_AUTHORIZATION",
    "--control-epoch",
    "9",
  ],
  {
    encoding: "utf8",
    env: sanitizedNodeChildEnvironmentForTesting({}),
    windowsHide: true,
  },
);
assert.notEqual(rejectedExecution.status, 0);
assert.match(
  rejectedExecution.stderr,
  /EXACT_DEACTIVATION_EXECUTION_AUTHORIZATION_REQUIRED/u,
);

const rejectedEnvironmentOverride = spawnSync(
  process.execPath,
  [
    "scripts/wp13-12b-external-resource-operator.mjs",
    "--action",
    "deactivation-plan",
  ],
  {
    encoding: "utf8",
    env: {
      ...sanitizedNodeChildEnvironmentForTesting({}),
      CLOUDSDK_CONFIG: "C:\\attacker-controlled-gcloud-config",
    },
    windowsHide: true,
  },
);
assert.notEqual(rejectedEnvironmentOverride.status, 0);
assert.match(
  rejectedEnvironmentOverride.stderr,
  /PRODUCTION_EXTERNAL_ACTION_ENVIRONMENT_OVERRIDE_FORBIDDEN/u,
);

console.log(
  "WP13.12B external inventory and expiry/destruction operator contracts passed without external writes.",
);
