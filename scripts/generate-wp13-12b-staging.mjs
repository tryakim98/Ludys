import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureExternalActivationChecksumManifest,
  externalActivationChecksumManifestPath,
  externalActivationChecksumTargets,
} from "./wp13-12b-external-activation-checksums.mjs";
import {
  assertProviderRuntimeSecuritySourceContracts,
  providerRuntimeSecuritySourcePaths,
} from "./wp13-12b-provider-package-contract.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const releaseRoot = "release/wp13-12b";
const checkOnly = process.argv.includes("--check");
const emulatorCommitV = "2e38ce83c9b4cfd70f515a31610ddf23374631bd";
const emulatorCommitVTree = "eb183ef860ee9cc16ef1167e56ea2c8a2de96cc2";
const emulatorPinnedGitAdapterSha256 =
  "0242641775cbf43b3c3d09276c6462d7b97de24cc2f13a32bf52c7bc8ed0dfbf";
const emulatorPinnedGitAdapterGitBlob =
  "a0c37fba2ab6625180bfa3691642acb38e86af29";
const emulatorSecurityRemediationChangeSetSha256 =
  "983d11050f1f299096797aea9a9179882411b355ffffc14ec5c98323e4f3b402";
const emulatorGitDiffCommandContract = () => ({
  schemaVersion: "wp13.12b-pinned-git-diff-contract-v1",
  command: "git diff",
  arguments: [
    "--name-only",
    "--no-renames",
    "-z",
    "568d9f9e306075a81f6e4b243d3812507f97b230",
    "190fff88808bbafe605cdde4cfe9fe943f4543a4",
    "--",
  ],
  output: "UTF8_NUL_TERMINATED_REPOSITORY_RELATIVE_POSIX_PATHS",
  renameDetection: "DISABLED",
});
const decisionChecksum = "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754";
const sourcePackageChecksum = "f3830a640fd901f193279ed99338d923848acaef662e79e8a831e870a7813de7";
const baselineCommit = "e5846735a3744a07febd93d5f75e776700c1013d";
const baselineTree = "85a618cf567131be9f36fecfc038ab5f45c6732d";
const approvedCloudProjectId = "ludys-12b-stg-20260725";
const approvedGoogleAccount = "tryakim@gmail.com";
const approvedCloudRegion = "europe-north1";
const approvedDeployServiceAccount =
  "ludys-staging-deployer@ludys-12b-stg-20260725.iam.gserviceaccount.com";
const approvedVercelTeamId =
  "team_1Gnn3VSNrP3mbseXx6a92a4J";
const approvedVercelTeamSlug = "trym-s-projects";
const approvedVercelProjectId =
  "prj_nHs1hbdyfcMMMglNUTwoYRS43naN";
const approvedVercelProjectName = "ludys-wp13-12b-staging";
const approvedIssueFunctionUrl =
  "https://issuesyntheticsession-qbqbamvs6q-lz.a.run.app";
const syntheticDataDeletionEvidencePath =
  "release/wp13-12b/receipts/actual/synthetic-data-deletion-evidence.json";
const syntheticDataDeletionIntentPath =
  "release/wp13-12b/receipts/actual/synthetic-data-deletion-intent.json";
const syntheticDataDeletionExecutionReceiptPath =
  "release/wp13-12b/receipts/actual/synthetic-data-deletion-execution-receipt.json";
const syntheticDataDeletionConfirmationPath =
  "release/wp13-12b/receipts/actual/synthetic-data-deletion-confirmation.json";
const deactivationExecutionReceiptPath =
  "release/wp13-12b/receipts/actual/deactivation-execution-receipt.json";
const previewDestructionEvidencePath =
  "release/wp13-12b/receipts/actual/preview-destruction-evidence.json";
const previewDestructionConfirmationPath =
  "release/wp13-12b/receipts/actual/preview-destruction-confirmation.json";
const activationAuthorization = "AUTHORIZE_WP13_12B_EXTERNAL_ACTIVATION";
const syntheticDataDeletionAuthorization =
  "AUTHORIZE_WP13_12B_SYNTHETIC_DATA_DELETION_EXECUTION;"
  + "project=ludys-12b-stg-20260725;expiry=2027-01-25;"
  + "scope=bounded-synthetic-session-delete";
const deactivationAuthorization =
  "AUTHORIZE_WP13_12B_DEACTIVATION_EXECUTION;"
  + "ludys-12b-stg-20260725;expiry=2027-01-25";
const vercelDestructionAuthorization =
  "AUTHORIZE_WP13_12B_VERCEL_DESTRUCTION_EXECUTION;"
  + "team=team_1Gnn3VSNrP3mbseXx6a92a4J;"
  + "project=prj_nHs1hbdyfcMMMglNUTwoYRS43naN;expiry=2027-01-25";
const googleDestructionAuthorization =
  "AUTHORIZE_WP13_12B_DESTRUCTION_EXECUTION;"
  + "ludys-12b-stg-20260725;expiry=2027-01-25";
const activationOrchestratorCommand = [
  "npm run provider:external:activate --",
  "--action activate",
  `--project ${approvedCloudProjectId}`,
  `--google-account ${approvedGoogleAccount}`,
  `--region ${approvedCloudRegion}`,
  `--impersonate-service-account ${approvedDeployServiceAccount}`,
  "--window-expires-at <UTC-ISO-WITHIN-60-MINUTES>",
  "--source-commit <CURRENT-FULL-40-CHAR-COMMIT>",
  "--source-tree <CURRENT-FULL-40-CHAR-TREE>",
  "--source-sha256 <CURRENT-DETERMINISTIC-FUNCTIONS-SOURCE-SHA256>",
  "--preview-origin <EXACT_PROTECTED_PREVIEW_ORIGIN>",
  "--control-epoch <APPROVED_MONOTONIC_EPOCH>",
  `--issue-url ${approvedIssueFunctionUrl}`,
  `--authorized ${activationAuthorization}`,
].join(" ");
const deactivationControlCommand = [
  "node provider/firebase/tools/set-staging-control.mjs",
  `--project ${approvedCloudProjectId}`,
  `--google-account ${approvedGoogleAccount}`,
  `--region ${approvedCloudRegion}`,
  "--enabled false",
  "--control-epoch <current-control-epoch-plus-one>",
  "--reason EXPIRY_DESTRUCTION",
  `--authorized "${deactivationAuthorization}"`,
].join(" ");
const destructionDeactivationExecutionCommand = [
  "npm run provider:external:deactivation-plan --",
  "--control-epoch <DEACTIVATED_CONTROL_EPOCH>",
  `--synthetic-data-deletion-evidence ${syntheticDataDeletionEvidencePath}`,
  `--execute "${deactivationAuthorization}"`,
].join(" ");
const syntheticDataDeletionExecutionCommand = [
  "node scripts/wp13-12b-external-resource-operator.mjs",
  "--action delete-synthetic-data",
  "--window-expires-at",
  "<UTC-ISO-WITHIN-30-MINUTES-AND-NO-LATER-THAN-2027-01-26T00:00:00.000Z>",
  `--execute "${syntheticDataDeletionAuthorization}"`,
].join(" ");
const syntheticDataDeletionEvidencePlanCommand = [
  "node scripts/wp13-12b-external-resource-operator.mjs",
  "--action synthetic-data-deletion-evidence-plan",
].join(" ");
const syntheticDataDeletionConfirmationCommand = [
  "node scripts/wp13-12b-external-resource-operator.mjs",
  "--action record-synthetic-data-deletion-confirmation",
  "--confirm-human-phrase",
  "\"<EXACT_humanConfirmationText_FROM_SYNTHETIC_EVIDENCE>\"",
].join(" ");
const previewDestructionConfirmationCommand = [
  "node scripts/wp13-12b-external-resource-operator.mjs",
  "--action record-preview-destruction-confirmation",
  "--confirm-human-phrase",
  "\"<EXACT_humanConfirmationText_FROM_PREVIEW_EVIDENCE>\"",
].join(" ");
const wifDisabledStateCommand = (action) => [
  "node scripts/provider-external-wif-control.mjs",
  `--action ${action}`,
].join(" ");
const cloudControlCommand = (action, {
  mutation = true,
} = {}) => [
  "node scripts/provider-external-cloud-control.mjs",
  `--action ${action}`,
  ...(mutation
    ? [
        `--project ${approvedCloudProjectId}`,
        `--google-account ${approvedGoogleAccount}`,
        `--region ${approvedCloudRegion}`,
        `--authorized ${activationAuthorization}`,
      ]
    : []),
].join(" ");
const functionDeployCommand = (action, {
  previewOrigin,
} = {}) => [
  "node scripts/provider-external-function-deploy.mjs",
  `--action ${action}`,
  `--project ${approvedCloudProjectId}`,
  `--google-account ${approvedGoogleAccount}`,
  `--region ${approvedCloudRegion}`,
  `--impersonate-service-account ${approvedDeployServiceAccount}`,
  "--window-expires-at <UTC-ISO-WITHIN-60-MINUTES>",
  "--source-commit <CURRENT-FULL-40-CHAR-COMMIT>",
  "--source-tree <CURRENT-FULL-40-CHAR-TREE>",
  "--source-sha256 <CURRENT-DETERMINISTIC-FUNCTIONS-SOURCE-SHA256>",
  ...(previewOrigin === undefined
    ? []
    : [`--preview-origin ${previewOrigin}`]),
  `--authorized ${activationAuthorization}`,
].join(" ");
const deployIdentityControlCommand = (action) => [
  "node scripts/provider-external-deploy-identity-control.mjs",
  `--action ${action}`,
  `--project ${approvedCloudProjectId}`,
  `--google-account ${approvedGoogleAccount}`,
  `--region ${approvedCloudRegion}`,
  "--window-expires-at <UTC-ISO-WITHIN-60-MINUTES>",
  ...(
    action === "provision" || action === "revoke"
      ? [`--authorized ${activationAuthorization}`]
      : []
  ),
].join(" ");
const vercelPreviewDeployCommand = (deploymentRole) => [
  "node scripts/provider-external-vercel-preview-deploy.mjs",
  "--action deploy-preview",
  `--team-id ${approvedVercelTeamId}`,
  `--team-slug ${approvedVercelTeamSlug}`,
  `--project-id ${approvedVercelProjectId}`,
  `--project-name ${approvedVercelProjectName}`,
  "--target preview",
  `--deployment-role ${deploymentRole}`,
  "--source-commit <CURRENT-FULL-40-CHAR-COMMIT>",
  "--source-tree <CURRENT-FULL-40-CHAR-TREE>",
  ...(deploymentRole === "active"
    ? [
        "--rollback-deployment-id <ROLLBACK_DEPLOYMENT_ID>",
        "--rollback-deployment-url <ROLLBACK_DEPLOYMENT_ORIGIN>",
        "--rollback-source-commit <ROLLBACK_SOURCE_COMMIT>",
        "--rollback-source-tree <ROLLBACK_SOURCE_TREE>",
        "--rollback-evidence-sha256 <ROLLBACK_EVIDENCE_SHA256>",
      ]
    : []),
  `--authorized ${activationAuthorization}`,
].join(" ");
const vercelFinalReadbackCommand = [
  "node scripts/provider-external-vercel-control.mjs",
  "--action inspect-project",
].join(" ");
const loggedInBrowserProtectionProof =
  "Using a separate already logged-in Chrome/browser session, open the exact active "
  + "and rollback protected preview origins, record the authenticated protection proof, "
  + "and create neither a protection bypass token nor a shareable link";
const useReceiptBoundRollbackPreview =
  "Open only <RECEIPT_BOUND_ROLLBACK_PREVIEW_ORIGIN> in the separate logged-in "
  + "Chrome/browser session and re-run the deletion/tombstone/no-resurrection proof; "
  + "do not redeploy, promote, bypass protection or create a shareable link";

const noGo = [
  "NO_REAL_DATA",
  "NO_STUDENT_BETA",
  "NO_RECRUITMENT",
  "NO_PARENT_CONTACT_FOR_PARTICIPATION",
  "NO_PRODUCTION_DOMAIN",
  "NO_FIREBASE_AUTH",
  "NO_STABLE_UID",
  "NO_ANALYTICS",
  "NO_CRASHLYTICS",
  "NO_PERFORMANCE_MONITORING",
  "NO_REMOTE_CONFIG",
  "NO_CLOUD_STORAGE",
  "NO_DIRECT_CLIENT_WRITE",
  "NO_CLIENT_SELECTED_AUTHORITY",
  "NO_PROVIDER_SECRET_IN_BROWSER",
  "NO_SHARED_CREDENTIALS",
  "NO_BACKUP_WITHOUT_NEW_DECISION",
  "NO_RUNTIME_AI",
  "NO_CLOUD_RESOURCE_CREATION_IN_REPOSITORY_PHASE",
  "NO_WP13_12C",
];

const contract = {
  schemaVersion: "wp13.12b-repository-contract-v1",
  repositoryWorkAuthorized: true,
  providerActivation: "BLOCKED",
  cloudResources: 0,
  selectedRegion: "europe-north1",
  selectedRegionStatus: "SELECTED_CANDIDATE_NOT_PROVISIONED_OR_LOCKED",
  selectedCapabilityModel: "FUNCTION_ISSUED_SHORT_LIVED_SESSION_CAPABILITY",
  providerIsolation: true,
  pureCoreProviderFree: true,
  rootRuntimeDependencies: 0,
  firebaseAuthentication: false,
  stableUid: false,
  directClientWrite: false,
  firestoreRulesDenyByDefault: true,
  serverAuthoritativeHandler: true,
  capabilityBearerOnly: true,
  explicitDeletion: true,
  tombstone: true,
  ttlBackstopOnly: true,
  ttlConfigured: false,
  ttlStatus: "NOT_CONFIGURED_OWNER_DELETION_POLICY_UNRESOLVED",
  backupAndPitrEnabled: false,
  killSwitch: true,
  noResurrection: true,
  roleProjectionIsolation: true,
  syntheticDataOnly: true,
  runtimeAi: false,
  multiDevice: "OPTIONAL_TECHNICAL_STAGING_PROOF",
  singleDevice: "CANONICAL_PRODUCT_MODE",
  externalReceipts: 0,
  physicalTwoDeviceProof: false,
  b8: "NOT_DECISION_READY",
  studentBeta: "NOT_AUTHORIZED",
  recruitment: "NOT_AUTHORIZED",
  realParticipantData: "NOT_AUTHORIZED",
  production: "NOT_AUTHORIZED",
  wp13_12c: "BLOCKED",
  noGo,
};

const authorizationStatus = {
  schemaVersion: "wp13.12b-authorization-v1",
  ownerDecision: "APPROVE_RECOMMENDED_SYNTHETIC_DEV",
  ownerDecisionStatus: "OWNER_DECISION_RECORDED",
  wp13_12bRepositoryWork: "AUTHORIZED",
  wp13_12bRepositoryImplementation: "READY_AFTER_ALL_LOCAL_CHECKS",
  wp13_12bExternalActivation: "AUTHORIZED_BY_EXPLICIT_PRODUCT_OWNER_CONFIRMATION",
  providerActivation: "BLOCKED",
  cloudResources: 0,
  firebaseProjectCreated: false,
  firestoreDatabaseCreated: false,
  billingConfigured: false,
  serviceAccountCreated: false,
  cloudDeployment: false,
  vercelDeployment: false,
  externalReceipts: 0,
  physicalTwoDeviceProof: false,
  pr3: "NOT_ACHIEVED",
  b8: "NOT_DECISION_READY",
  studentBeta: "NOT_AUTHORIZED",
  recruitment: "NOT_AUTHORIZED",
  parentContactForParticipation: "NOT_AUTHORIZED",
  realParticipantData: "NOT_AUTHORIZED",
  production: "NOT_AUTHORIZED",
  runtimeAi: "NOT_PRESENT",
  wp13_12c: "BLOCKED",
};

const loggingPolicy = {
  schemaVersion: "wp13.12b-logging-v1",
  applicationLogging: "COARSE_ALLOWLIST_ONLY",
  allowed: [
    "releaseId",
    "functionVersion",
    "region",
    "coarseErrorCode",
    "denialClass",
    "rollbackClass",
    "serviceHealth",
    "nonidentifyingLatencyBucket",
  ],
  prohibited: [
    "capability",
    "capabilityHash",
    "requestBody",
    "sessionState",
    "stimulus",
    "response",
    "supportHistory",
    "roleProjectionPayload",
    "name",
    "email",
    "school",
    "stableUID",
    "tenant",
    "freeText",
    "analyticsIdentifier",
  ],
  providerServiceLogs: {
    controlledByApplicationPolicy: false,
    residualArea: "Google Cloud request, audit and service logs require operator retention review.",
    currentCloudResources: 0,
  },
};

const dataModel = {
  schemaVersion: "wp13.12b-firestore-data-v1",
  collections: {
    syntheticSessions: {
      purpose: "active authoritative synthetic payload",
      allowedFields: [
        "syntheticSessionId",
        "stateVersion",
        "authorityGeneration",
        "controlEpoch",
        "syntheticSessionState",
        "releaseIds",
        "expiresAt",
        "tombstone",
        "processedCommandIds",
        "coarseTechnicalStatus",
        "dataClassification",
      ],
      explicitDeletion: "transaction deletes active document before tombstone create",
    },
    syntheticCapabilityGrants: {
      purpose: "short-lived role/session/generation-bound server metadata",
      allowedFields: [
        "nonce",
        "syntheticSessionId",
        "role",
        "expiresAt",
        "remainingCommands",
        "revoked",
        "dataClassification",
      ],
    },
    syntheticSessionTombstones: {
      purpose: "minimum no-resurrection record",
      allowedFields: [
        "syntheticSessionId",
        "terminalStateVersion",
        "terminalAuthorityGeneration",
        "controlEpoch",
        "deletedAt",
        "noResurrection",
        "dataClassification",
      ],
    },
    syntheticStagingControl: {
      purpose: "operator-owned kill switch",
      allowedFields: ["controlEpoch", "stagingEnabled", "reasonCode", "changedAt"],
    },
  },
  prohibitedFields: [
    "name",
    "email",
    "phone",
    "school",
    "studentNumber",
    "birthDate",
    "diagnosis",
    "healthData",
    "stableUID",
    "tenant",
    "realLearningResponse",
    "freeTextAboutParticipant",
    "audio",
    "video",
    "image",
    "microphoneData",
    "cameraData",
    "engagementScore",
    "crossSessionProfile",
    "analyticsIdentifier",
    "sessionReplay",
    "heatmap",
    "fingerprint",
  ],
  ttl: "BACKSTOP_ONLY_NOT_CONFIGURED_UNTIL_OWNER_DELETION_POLICY_IS_RESOLVED",
  backup: false,
  pitr: false,
};

const officialSources = {
  schemaVersion: "wp13.12b-official-sources-v1",
  checkedAt: "2026-07-27",
  sources: [
    {
      sourceId: "FIRESTORE-LOCATIONS",
      url: "https://firebase.google.com/docs/firestore/locations",
      fact: "europe-north1 remains a regional Firestore location and location cannot be changed after provisioning.",
    },
    {
      sourceId: "FUNCTIONS-LOCATIONS",
      url: "https://firebase.google.com/docs/functions/locations",
      fact: "europe-north1 supports Cloud Functions 2nd gen.",
    },
    {
      sourceId: "FIRESTORE-INSECURE-RULES",
      url: "https://firebase.google.com/docs/firestore/security/insecure-rules",
      fact: "server client libraries bypass Security Rules and require separate IAM.",
    },
    {
      sourceId: "FIRESTORE-TTL",
      url: "https://firebase.google.com/docs/firestore/ttl",
      fact: "TTL is not instantaneous and deletion is typically within 24 hours.",
    },
  ],
  cannotAuthorize: [
    "provider activation",
    "billing",
    "project creation",
    "real participant data",
    "B8",
    "student beta",
    "production",
  ],
};

const unresolvedOwnerFields = [];
const irreversibleFieldsStillRequiringApproval = [
  "plannedProjectId",
  "projectDisplayName",
  "approvedGoogleAccountOrOrganizationContext",
  "approvedBillingAccount",
];

const cloudPreflight = {
  schemaVersion: "wp13.12b-cloud-preflight-v1",
  command: "npm run provider:cloud:preflight",
  mode: "NON_MUTATING_LOCAL_VALIDATION_ONLY",
  externalWrites: 0,
  loginAttempted: false,
  browserLoginOpened: false,
  resourceCreationAttempted: false,
  deploymentAttempted: false,
  expectedCloudResources: 0,
  ownerAuthorization:
    "release/wp13-12b/external-activation/owner-authorization.json",
  externalActivationAuthorized: true,
  checks: [
    "owner decision and source checksums",
    "europe-north1 selected but not locked",
    "function-issued short-lived capability",
    "cost and expiry fields",
    "project ID format placeholder only",
    "deny-by-default rules",
    "empty indexes",
    "Functions 2nd gen config",
    "no Firebase Authentication",
    "no Analytics, Storage, Remote Config, Crashlytics or Performance Monitoring",
    "no backup or PITR",
    "no repository or browser secrets",
    "least-privilege IAM plan",
    "receipt, rollback, destruction and kill-switch plans",
  ],
  unresolvedOwnerFields,
  irreversibleFieldsStillRequiringApproval,
  externalActivationReady: false,
  stopCondition:
    "Do not provision until planned project ID, display name, Google account or organization context and billing account are explicitly shown and approved.",
};

const iamPlan = {
  schemaVersion: "wp13.12b-iam-secrets-handoff-v1",
  status: "UNEXECUTED_OPERATOR_PLAN",
  deployIdentity: {
    purpose: "CI or operator deployment only",
    proposedRoles: [
      "roles/cloudfunctions.developer scoped to approved project",
      "roles/run.admin scoped to approved functions",
      "roles/iam.serviceAccountUser scoped to runtime service account",
      "roles/datastore.indexAdmin only during authorized index deployment",
    ],
    ownerRoleRequired: false,
  },
  runtimeServiceAccount: {
    purpose: "Cloud Functions 2nd gen runtime",
    proposedRoles: [
      "roles/datastore.user scoped to approved database",
      "roles/secretmanager.secretAccessor scoped to LUDYS capability secret only",
      "roles/logging.logWriter",
    ],
    ownerRoleRequired: false,
  },
  ciAccess: "short-lived workload identity; no service-account JSON",
  breakGlass: "separate time-limited identity, owner-approved, audited, revoked immediately after use",
  revocation: [
    "disable staging and advance controlEpoch",
    "remove deploy identity bindings",
    "remove runtime service account access",
    "destroy secret version after staging destruction",
  ],
  forbidden: [
    "service-account JSON in repository",
    "production credentials",
    "shared project credentials",
    "Owner role as runtime requirement",
    "browser secrets",
    "secret input in decision or staging UI",
  ],
  resourcesCreated: 0,
};

function task(taskId, authorizationRequired, prerequisites, commands, expectedResult, evidenceRequired, rollback, stopCondition) {
  return {
    taskId,
    authorizationRequired,
    prerequisites,
    commands,
    expectedResult,
    forbiddenActions: [
      "use real participant data",
      "reuse credentials from another project",
      "open B8, student beta, recruitment or production",
      "continue after stopCondition",
    ],
    evidenceRequired,
    rollback,
    stopCondition,
  };
}

const operatorTasks = {
  schemaVersion: "wp13.12b-operator-tasks-v1",
  status: "UNEXECUTED_EXTERNAL_ACTIVATION_HANDOFF",
  tasks: [
    task("OP-01", "REPOSITORY_SCOPE", ["checked-out final WP13.12B commit"], [
      "npm run provider:decision:validate",
      "npm run staging:validate",
      "npm run provider:cloud:preflight",
    ], "Decision, checksums and blocked activation ceiling are verified.", ["terminal transcript", "SHA-256 list"], "No external state changed.", "Any checksum or decision mismatch."),
    task("OP-02", "SEPARATE_EMULATOR_DOWNLOAD_AUTHORIZATION", ["exact artifact name and published SHA-256"], [
      "npm run provider:emulator:import -- --artifact <exact-jar> --sha256 <published-sha256>",
    ], "Exact JAR is imported only after file type and checksum validation.", ["artifact hash", "download source"], "Delete only the verified local imported artifact.", "Artifact is unavailable, non-JAR or checksum differs."),
    task("OP-03", "LOCAL_EMULATOR_SCOPE", [
      "OP-02 complete",
      "implementation committed and worktree clean before proof execution",
    ], [
      "npm run provider:emulator:proof -- --authorized-local-emulator-proof",
      "npm run provider:emulator:confirmation",
      "npm run provider:emulator:confirmation -- --record --confirmation \"<EXACT_V2_NONCE_COMMIT_S_PROOF_TOOL_RUNNER_PREVIEW_PROOF_HASHES_COUNTS_EXPIRY_BOUND_OWNER_RESPONSE>\"",
    ], "Firestore Rules and local Function contract proof complete with zero cloud resources; only the exact v2 challenge response creates the receipt.", ["immutable actual emulator proof artifact", "challenge-bound EMULATOR_PROOF_RECEIPT"], "Stop emulator and remove owned temporary state.", "Any emulator proof fails or the exact proof-bound owner response is absent."),
    task("OP-04", "LOCAL_DEPENDENCY_AUDIT_SCOPE", [
      "provider security remediation record is current and package lock is hash-bound",
    ], [
      "npm --prefix provider/firebase/functions ci --ignore-scripts",
      "npm --prefix provider/firebase/functions audit --omit=dev",
    ], "Provider dependency tree is re-audited and the active provider package resolves fast-uri@3.1.5.", ["audit JSON", "SBOM", "license inventory", "provider security remediation provenance"], "Remove local node_modules only; keep lockfile.", "Any moderate-or-higher unresolved runtime finding or any mismatch between lock, provider package, audit, SBOM, license inventory and remediation provenance."),
    task("OP-05", "NEW_EXPLICIT_CLOUD_PROJECT_CREATION_AUTHORIZATION", ["OP-01 through OP-04", "all unresolved owner fields resolved"], [
      "LOGICAL_OPERATOR_GATE_ONLY_NO_DIRECT_COMMAND: create the exact approved isolated project only after a bounded project-creation wrapper is implemented and reviewed",
    ], "Project creation remains a separately authorized logical gate; this handoff exposes no ambient or direct creation command.", ["FIREBASE_PROJECT_AND_REGION_RECEIPT", "bounded wrapper review before any future execution"], "No external state changed by this logical gate.", "A reviewed bounded project-creation wrapper is absent, or authorization, project ID, ownership or cost field is missing."),
    task("OP-06", "BILLING_CONFIGURATION_AUTHORIZATION", ["OP-05", "approved cost ceiling and alert threshold"], [
      cloudControlCommand("link-billing"),
      cloudControlCommand("create-budget"),
      cloudControlCommand("inspect-billing", { mutation: false }),
    ], "Billing and alerts match recorded owner values; alert is not represented as a hard cap.", ["IAM_AND_BILLING_RECEIPT"], "Unlink billing and stop staging.", "Values differ from owner record or billing reviewer unavailable."),
    task("OP-07", "FIRESTORE_DATABASE_CREATION_AUTHORIZATION", ["OP-05", "region reverified immediately before creation"], [
      "LOGICAL_OPERATOR_GATE_ONLY_NO_DIRECT_COMMAND: create the default regional Firestore database only after a bounded database-creation wrapper is implemented and reviewed",
    ], "Firestore creation remains a separately authorized logical gate; this handoff exposes no ambient or direct creation command.", ["project and region receipt", "bounded wrapper review before any future execution"], "No external state changed by this logical gate.", "A reviewed bounded Firestore creation wrapper is absent, region support changed or region approval is absent."),
    task("OP-08", "IAM_AND_SECRET_CREATION_AUTHORIZATION", [
      "OP-05 through OP-07",
      "IAM plan owner-approved",
      "separate keyless deploy identity contract/control reviewed; deploy identity is not runtime or preview identity",
    ], [
      cloudControlCommand("create-runtime-service-account"),
      cloudControlCommand("grant-runtime-project-roles"),
      cloudControlCommand("create-capability-secret"),
      cloudControlCommand("grant-secret-access"),
      cloudControlCommand("inspect-security", { mutation: false }),
    ], "Least-privilege runtime identity and one server secret exist without JSON keys; the separate keyless deploy identity remains bound to its time-limited OP-09 control.", ["IAM_AND_BILLING_RECEIPT"], "Revoke bindings, disable identity and destroy secret.", "Deploy, runtime, build or preview identities overlap; Owner role, JSON key or browser secret would be required."),
    task("OP-09", "CLOUD_FUNCTION_AND_RULE_DEPLOYMENT_AUTHORIZATION", [
      "OP-08",
      "kill switch disabled-by-default control document",
      "time-limited exact deploy identity grant expires within 60 minutes",
    ], [
      "npm run provider:package",
      deployIdentityControlCommand("plan"),
      deployIdentityControlCommand("provision"),
      deployIdentityControlCommand("verify"),
      functionDeployCommand("deploy-firestore-rules"),
      functionDeployCommand("deploy-disabled"),
      deployIdentityControlCommand("revoke"),
    ], "Backend is deployed disabled-by-default with deny-all direct access.", ["deployment transcript", "artifact hashes"], "Revoke deploy identity bindings, advance controlEpoch, disable staging and deploy prior safe provider revision.", "Any endpoint is enabled before control and receipts are ready, or deploy identity cannot be revoked."),
    task("OP-10", "VERCEL_PROJECT_AND_PREVIEW_AUTHORIZATION", [
      "OP-09",
      "approved protected-preview plan",
      "WIF provider and pool are both disabled",
    ], [
      wifDisabledStateCommand("verify-disabled"),
      vercelPreviewDeployCommand("rollback"),
      wifDisabledStateCommand("verify-disabled"),
      vercelPreviewDeployCommand("active"),
      wifDisabledStateCommand("verify-disabled"),
      "Complete and validate the PROTECTED_PREVIEW_RECEIPT from both deployment outputs before final project readback",
      vercelFinalReadbackCommand,
      loggedInBrowserProtectionProof,
    ], "Rollback is deployed first in a real safe-disabled role; active is deployed second and binds the rollback ID, origin, source commit/tree and evidence digest. Final inventory is exactly one active plus one receipt-bound rollback, zero unrelated deployments and two total, while WIF remains disabled.", ["authenticated deployment/project/domain readback", "rollback safe-disabled source and deployment evidence", "active-to-rollback binding evidence", "final exact 1 active + 1 receipt-bound rollback + 0 unrelated + 2 total inventory", "separate logged-in Chrome/browser protection proof with no bypass token or shareable link", "PROTECTED_PREVIEW_RECEIPT"], "Keep WIF disabled, delete only the exact two preview deployments and remove the local project link; do not create or promote a production deployment.", "Copy review, clean commit/tree binding, nested preview root, exact team/project, preview target, safe-disabled rollback behavior, active-to-rollback evidence binding, Standard Protection, separate logged-in browser proof, final exact deployment inventory, zero production/custom-domain proof or WIF-disabled readback fails."),
    task("OP-11", activationAuthorization, [
      "OP-10",
      "current date is before 2027-01-25",
      "issueSyntheticSession issuance flag is false",
      "staging control is disabled",
      "exact protected preview origin is known",
      "final Vercel readback proves exactly 1 active + 1 receipt-bound rollback + 0 unrelated + 2 total",
      "separate logged-in Chrome/browser proof verifies Standard Protection for both exact origins without a protection bypass token or shareable link",
      "WIF remained disabled through both deployment transitions",
      "genuine confirmed challenge-bound v2 emulator proof receipt is committed and current",
      "activation repository differs from the emulator proof source only by exact hash-bound evidence",
      "individual authority-increasing WIF, issuance, control and seed mutators are internal to the fail-closed orchestrator and are not operator commands",
    ], [
      activationOrchestratorCommand,
    ], "The single fail-closed orchestrator revalidates phase-bound proof before each authority increase, enables WIF then issuance then control then exact NB/NN synthetic fixtures, and verifies deploy-identity revocation. Any mid-sequence failure compensates by advancing disabled control, deploying the safe-disabled backend, disabling and verifying WIF, and revoking deploy identity.", ["final exact 1 active + 1 receipt-bound rollback + 0 unrelated + 2 total readback", "separate logged-in Chrome/browser protection proof with no bypass token or shareable link", "genuine challenge-bound emulator v2 receipt and exact evidence-only Git diff", "WIF enabled readback", "issuance flag readback", "fixture manifest", "data allowlist scan", "deploy identity revoked readback", "orchestrator step/compensation result"], "Use the independently callable fail-safe decrease commands: disable control at an advanced epoch, deploy the safe-disabled backend, disable and verify WIF, revoke deploy identity, explicitly delete fixtures and confirm tombstones.", "Expiry is reached, any activation or receipt binding differs, repository or clock state is stale, separate logged-in browser protection proof is absent, a bypass/share link exists, compensation or deploy-identity revocation is incomplete, or any field resembles participant, school, health or free-text data."),
    task("OP-12", "PHYSICAL_TWO_DEVICE_PROOF_AUTHORIZATION", ["OP-10", "two controlled devices", "no participant present"], [
      "Follow release/wp13-12b/activation-handoff/physical-two-device-proof-template.json step by step",
    ], "Two physical devices complete the exact 27-step sequence with one primary session, one distinct deletion session and a distinct receipt-bound known-valid safe-disabled rollback deployment.", ["PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT", "active and rollback deployment evidence"], "Close browsers, clear memory/cache and delete both synthetic sessions.", "Any screenshot or video could contain person data, the two session IDs are reused, or active/rollback deployment evidence does not bind exactly."),
    task("OP-13", "PHYSICAL_SAFETY_PROOF_AUTHORIZATION", ["OP-12"], [
      "Execute STOP, explicit deletion, reconnect and delayed-command steps from the physical proof template",
    ], "STOP, deletion and no-resurrection are physically observed.", ["signed step results", "non-personal screenshots if used"], "Keep kill switch active until discrepancy is resolved.", "Any session can resume or payload remains after deletion."),
    task("OP-14", "ROLLBACK_AND_KILL_SWITCH_AUTHORIZATION", [
      "OP-13",
      "final inventory is exactly 1 active + 1 receipt-bound rollback + 0 unrelated + 2 total",
      "receipt-bound rollback safe-disabled behavior verified",
    ], [
      deactivationControlCommand.replace(
        "--reason EXPIRY_DESTRUCTION",
        "--reason ROLLBACK",
      ),
      deployIdentityControlCommand("plan"),
      deployIdentityControlCommand("provision"),
      deployIdentityControlCommand("verify"),
      functionDeployCommand("configure-preview-origin", {
        previewOrigin: "<EXACT_RECEIPT_BOUND_ACTIVE_PREVIEW_ORIGIN>",
      }),
      functionDeployCommand("deploy-disabled"),
      deployIdentityControlCommand("revoke"),
      wifDisabledStateCommand("disable-workload-identity-provider"),
      wifDisabledStateCommand("disable-workload-identity-pool"),
      wifDisabledStateCommand("verify-disabled"),
      useReceiptBoundRollbackPreview,
    ], "Control is false at a strictly advanced epoch before issuance is disabled and all functions enter the safe-disabled/origin state; WIF is then disabled and verified before the existing receipt-bound rollback preview is used. Previously issued STS tokens may linger until expiry, but the backend is already non-issuing and disabled, so cached capabilities remain invalid and no session resurrects.", ["kill-switch and advanced-epoch proof", "issuance-disabled and safe function/origin readback", "deploy identity revoked readback", "WIF provider/pool disabled verification", "receipt-bound rollback use proof", "deleted-session tombstone and no-resurrection proof", "rollback receipt section"], "Keep control, issuance, safe functions and WIF disabled; never restore the active deployment.", "Rollback lowers controlEpoch, issuance or any function remains active, WIF is disabled before backend safety is proven, rollback evidence does not bind, a bypass/share link is created, or active state is restored."),
    task("OP-15", "RECEIPT_SIGNING_AUTHORIZATION", ["all applicable proof tasks complete"], [
      "npm run receipt:validate -- --receipt <filled-receipt-path>",
    ], "Authentic receipts are checksum-bound and human-confirmed.", ["five applicable signed receipts"], "Invalidate erroneous receipt; never edit signed evidence silently.", "Any receipt is incomplete, fabricated or bound to wrong commit."),
    task("OP-16", "PHASE_SPECIFIC_AUTHORIZATIONS_FROM_EXPIRY_EXECUTION_CONTRACT", [
      "owner stop or pre-expiry shutdown window has started",
      "safe backend transition can finish before the staging term ends",
      "separate exact bounded synthetic deletion authorization is present",
      "synthetic deletion window is 5 to 30 minutes and ends no later than 2027-01-26T00:00:00.000Z",
      "approved staging expiry is reached before irreversible Vercel or Google deletion",
      "exact immutable synthetic-deletion and preview-absence human confirmation phrases will be recorded before their dependent phase",
    ], [
      deactivationControlCommand,
      "After recording the control-disable result, continue "
        + "release/wp13-12b/activation-handoff/destruction-plan.json "
        + "from ordered command 2",
    ], "Control is disabled with an advanced epoch; the backend is made safe; deletion authority is downscoped, used and guaranteed-finally revoked; immutable intent, execution, zero-state and confirmation evidence is secured; WIF is disabled and verified; deactivation is materialized at or after expiry; Vercel absence is authenticated and confirmed; only then are approved Google resources destroyed and both scopes verified zero.", [
      "ordered backend-before-deletion-before-trust-before-Vercel-before-Google destruction transcript",
      syntheticDataDeletionIntentPath,
      syntheticDataDeletionExecutionReceiptPath,
      syntheticDataDeletionEvidencePath,
      syntheticDataDeletionConfirmationPath,
      deactivationExecutionReceiptPath,
      previewDestructionEvidencePath,
      previewDestructionConfirmationPath,
      "fresh post-Vercel combined inventory with confirmed digest",
      "final fresh combined zero-resource inventory",
    ], "Not applicable; destruction is the exit path.", "Safe backend transition cannot complete before expiry; deletion authorization or the 5-to-30-minute window is invalid; ordinary deletion is attempted after the 2027-01-26 grace without separate exceptional recovery authorization; broad deploy or redeploy is attempted after expiry without separate exceptional recovery authorization; deletion-only identity revocation/readback is incomplete; WIF would be disabled before backend and synthetic-zero evidence are secured; Vercel would be deleted before WIF verification and deactivation; preview absence is not authenticated and confirmed; Google destruction would start before confirmed Vercel absence; or required immutable tombstone evidence is absent."),
  ],
};

const receiptTypes = [
  "EMULATOR_PROOF_RECEIPT",
  "FIREBASE_PROJECT_AND_REGION_RECEIPT",
  "IAM_AND_BILLING_RECEIPT",
  "PROTECTED_PREVIEW_RECEIPT",
  "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
];

const emulatorReceiptProofResults = [
  "firestore_emulator",
  "functions_emulator",
  "emulator_environment_binding",
  "initial_staging_disabled",
  "explicit_proof_enable_transition",
  "enabled_staging_ready",
  "deny_by_default_rules",
  "no_direct_client_write",
  "capability_issuance",
  "child_capability",
  "adult_capability",
  "expiry",
  "wrong_role",
  "wrong_session",
  "stale_version",
  "stale_authority_generation",
  "duplicate_command",
  "wait",
  "help",
  "pause",
  "stop",
  "delayed_command_after_stop",
  "deletion",
  "tombstone",
  "reconnect_after_deletion",
  "kill_switch",
  "cached_capability_after_kill_switch",
  "child_adult_projection_isolation",
  "no_resurrection",
  "rollback_to_safe_disabled_state",
  "forbidden_data_classes_absent",
  "cleanup_after_proof",
  "final_staging_disabled",
  "emulator_processes_stopped",
  "cloud_guard",
  "capability_and_payload_absent_from_logs",
];

const receiptContracts = {
  schemaVersion: "wp13.12b-receipt-contracts-v1",
  status: "CONTRACTS_ONLY_NO_RECEIPTS_CREATED",
  externalReceipts: 0,
  sourceBindingSemantics:
    "A filled receipt binds to its explicit sourceCommit and sourceTree; both objects must exist and the tree must belong to that commit. Current HEAD is informational only.",
  artifactHashSemantics:
    "Every artifactHashes key is a repository-relative path to an actual file whose SHA-256 must match.",
  genericProofResultSemantics:
    "Every filled receipt must have nonempty proofResults and every result value must be true; the sole historical emulator exception is cloud_resources_created=0.",
  emulatorProofBindingSemantics:
    "A PR3-eligible emulator receipt must be v2; contain exactly the 36 named runner proof results with every value true and no omissions, extras or generic proof_n substitutions; prove disabled-by-default -> explicit local enable -> READY -> mandatory cleanup -> disabled-by-default; and bind immutable Commit S/tree as historical evidence, immutable Commit T/tree as the historical proof-tool follow-up, immutable Commit U/tree as the security remediation and active provider-package origin, immutable Commit V/tree as the proof origin, and current source/proof-tool Commit W/tree as the pinned-Git compatibility follow-up. It must bind the exact ordered chain S -> T -> U -> V -> W and proof-tool chain T -> U -> V -> W, proof-runner SHA-256 and Git blob, the pinned-Git adapter SHA-256 and Git blob, the exact canonical pinned-Git diff command contract and security-remediation change-set SHA-256, provider lock/package/SBOM/audit/remediation hashes, fast-uri@3.1.5 and GHSA-7p8r-x3mc-p8w7, approved preview sourceSetSha256, fresh proof SHA-256, owner decision, activation manifest, receipt contract, short-lived nonce timestamps, authoritative current external counts, official emulator JAR, demo project and fixed local-proof-only purpose in one exact product-owner confirmation. A historical generic confirmation remains historical evidence only, the superseded fast-uri@3.1.4 provider package is prohibited, and historical resource counts cannot substitute for current authenticated counts.",
  humanConfirmationBindingSemantics:
    "Every Firebase, IAM/billing, protected-preview and physical receipt requires an exact type-specific confirmation text bound to receiptId, source commit/tree, exact provider/deployment scope and a SHA-256 that is also bound in artifactHashes; generic or reused confirmation text is invalid.",
  physicalProofSemantics:
    "Physical proof requires adultOperatorsOnly=true, participantsPresent=false, physicallySeparateDevicesConfirmed=true, two distinct ephemeral deviceEvidenceId values, one shared primary session/deployment for both devices, a distinct deletionSyntheticSessionId for steps 19-27, capability values never recorded, the prompt section 14 operational step IDs exactly once in order, and exact active-preview plus known-valid safe-disabled rollback bindings for deployment ID/URL, source commit/tree and hash-bound evidence.",
  receiptSpecificProofRequirements: {
    EMULATOR_PROOF_RECEIPT: emulatorReceiptProofResults,
    FIREBASE_PROJECT_AND_REGION_RECEIPT: [
      "approved_project_id_exact",
      "approved_region_exact",
      "firestore_database_regional",
      "firestore_rules_deny_all",
      "five_gen2_functions_deployed",
      "functions_disabled_first",
      "logging_excludes_capability_and_payload",
      "session_issuance_disabled",
      "staging_control_absent_or_disabled",
    ],
    IAM_AND_BILLING_RECEIPT: [
      "billing_account_exact",
      "budget_500_nok",
      "billing_alert_400_nok",
      "budget_thresholds_400_and_500_nok",
      "billing_reviewer_product_owner",
      "owner_one_hundred_percent",
      "expiry_2027_01_25",
      "function_quotas_bounded",
      "deploy_identity_least_privilege",
      "deploy_identity_keyless",
      "deploy_identity_distinct",
      "deploy_commands_impersonated",
      "deploy_identity_revoked",
      "owner_role_absent",
      "runtime_roles_least_privilege",
      "runtime_service_account_keyless",
      "preview_service_account_keyless",
      "capability_secret_regional",
      "secret_value_not_printed_or_written",
      "secret_absent_from_browser",
    ],
    PROTECTED_PREVIEW_RECEIPT: [
      "vercel_team_exact",
      "vercel_project_exact",
      "preview_deployment_exact",
      "preview_https_url_exact",
      "standard_protection_all_previews",
      "team_oidc_enabled",
      "deployment_source_commit_exact",
      "web_analytics_off",
      "speed_insights_off",
      "custom_domains_absent",
      "production_deployment_absent",
      "git_link_absent",
      "rollback_target_verified",
      "rollback_to_safe_disabled_state",
    ],
    PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT: [
      "child_adult_projection_isolation",
      "wait",
      "help",
      "pause",
      "network_reconnect",
      "state_version_after_reconnect",
      "stale_command_rejected",
      "stop",
      "delayed_command_after_stop",
      "reconnect_after_stop_terminal",
      "deletion",
      "cached_capability_after_deletion",
      "no_resurrection",
      "kill_switch",
      "rollback_to_safe_disabled_state",
      "deleted_session_after_rollback",
      "synthetic_data_deleted",
    ],
  },
  exactProviderBindings: {
    googleProjectId: approvedCloudProjectId,
    googleProjectNumber: "134654966474",
    googleRegion: approvedCloudRegion,
    billingAccount: "01CD9D-0900DF-4FB36A",
    vercelTeamId: "team_1Gnn3VSNrP3mbseXx6a92a4J",
    vercelProjectId: "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
    stagingExpiryDate: "2027-01-25",
    stagingExpiryInstant: "2027-01-25T00:00:00.000Z",
  },
  physicalDeviceEvidenceSemantics:
    "Exactly two distinct ephemeral deviceEvidenceId values are required. observedAt is a timestamp, never device identity. Both records bind the same exact primary syntheticSessionId, active deploymentId/stagingUrl and source commit/tree, assert capabilityPresent=true, and assert capabilityValueRecorded=false.",
  physicalStepBindingSemantics:
    "Each of the 27 ordered step results binds an exact session and deployment: steps 1-18 use the primary syntheticSessionId, steps 19-27 use the distinct deletionSyntheticSessionId, steps 1-24 use the active deploymentId, and steps 25-27 use the distinct rollbackDeploymentId.",
  requiredFields: [
    "receiptId",
    "receiptType",
    "status",
    "createdAt",
    "performedBy",
    "environment",
    "sourceCommit",
    "sourceTree",
    "decisionRecordChecksum",
    "commandsRun",
    "providerResourceIds",
    "proofResults",
    "artifactHashes",
    "limitations",
    "humanSignatureOrExplicitConfirmation",
  ],
  receiptTypes,
  rejectionRules: [
    "unsigned filled receipt",
    "missing provider ID where required",
    "wrong source commit or tree",
    "missing artifact hashes",
    "artifact hash key that is not a repository-relative actual file path",
    "synthetic or fabricated completed status",
    "missing actual commands",
    "physical proof without two device records",
    "receipt that opens B8, student beta or production",
  ],
};

const falseProofResults = (names) => Object.fromEntries(
  names.map((name) => [name, false]),
);

const firebaseReceiptProofResults = [
  "approved_project_id_exact",
  "approved_region_exact",
  "firestore_database_regional",
  "firestore_rules_deny_all",
  "five_gen2_functions_deployed",
  "functions_disabled_first",
  "logging_excludes_capability_and_payload",
  "session_issuance_disabled",
  "staging_control_absent_or_disabled",
];

const iamReceiptProofResults = [
  "billing_account_exact",
  "budget_500_nok",
  "billing_alert_400_nok",
  "budget_thresholds_400_and_500_nok",
  "billing_reviewer_product_owner",
  "owner_one_hundred_percent",
  "expiry_2027_01_25",
  "function_quotas_bounded",
  "deploy_identity_least_privilege",
  "deploy_identity_keyless",
  "deploy_identity_distinct",
  "deploy_commands_impersonated",
  "deploy_identity_revoked",
  "owner_role_absent",
  "runtime_roles_least_privilege",
  "runtime_service_account_keyless",
  "preview_service_account_keyless",
  "capability_secret_regional",
  "secret_value_not_printed_or_written",
  "secret_absent_from_browser",
];

const previewReceiptProofResults = [
  "vercel_team_exact",
  "vercel_project_exact",
  "preview_deployment_exact",
  "preview_https_url_exact",
  "standard_protection_all_previews",
  "team_oidc_enabled",
  "deployment_source_commit_exact",
  "web_analytics_off",
  "speed_insights_off",
  "custom_domains_absent",
  "production_deployment_absent",
  "git_link_absent",
  "rollback_target_verified",
  "rollback_to_safe_disabled_state",
];

const physicalReceiptProofResults = [
  "child_adult_projection_isolation",
  "wait",
  "help",
  "pause",
  "network_reconnect",
  "state_version_after_reconnect",
  "stale_command_rejected",
  "stop",
  "delayed_command_after_stop",
  "reconnect_after_stop_terminal",
  "deletion",
  "cached_capability_after_deletion",
  "no_resurrection",
  "kill_switch",
  "rollback_to_safe_disabled_state",
  "deleted_session_after_rollback",
  "synthetic_data_deleted",
];

const physicalStepDefinitions = [
  ["create_primary_synthetic_session", "Create the primary synthetic session."],
  ["connect_child_device", "Connect the CHILD device to the shared synthetic session."],
  ["connect_adult_device", "Connect the ADULT device to the shared synthetic session."],
  ["verify_separate_role_projections", "Verify separate CHILD and ADULT role projections."],
  ["execute_wait", "Execute WAIT from the CHILD device."],
  ["execute_help", "Execute the help action."],
  ["execute_pause", "Execute PAUSE and verify the shared state version."],
  ["interrupt_one_device_network", "Break the network connection on one physical device."],
  ["execute_other_device_command", "Execute a command from the other physical device."],
  ["reconnect_interrupted_device", "Reconnect the interrupted physical device."],
  ["verify_state_version", "Verify the authoritative stateVersion."],
  ["send_stale_command", "Send and reject a stale-state command without mutation."],
  ["verify_stale_command_rejected", "Verify the stale command was rejected without mutation."],
  ["execute_stop", "Execute STOP on the primary synthetic session."],
  ["attempt_delayed_command", "Attempt the delayed command after STOP."],
  ["verify_delayed_command_rejected", "Verify the delayed command was rejected."],
  ["attempt_reconnect_after_stop", "Attempt reconnect after STOP."],
  ["verify_terminal_state", "Verify the primary session remains terminal after reconnect."],
  ["create_deletion_synthetic_session", "Create a second, distinct synthetic session for deletion proof."],
  ["execute_deletion", "Delete the second session's active payload and write its tombstone."],
  ["attempt_reconnect_and_cached_capability_after_deletion", "Attempt reconnect and cached-capability use after deletion."],
  ["verify_no_resurrection", "Verify the deleted session cannot be resurrected."],
  ["activate_kill_switch", "Activate the staging kill switch."],
  ["verify_new_sessions_blocked", "Verify the kill switch blocks new sessions."],
  ["rollback_to_known_valid_deployment", "Rollback to the receipt-bound known-valid safe-disabled deployment."],
  ["verify_deleted_session_not_resurrected_after_rollback", "Verify the deleted session remains deleted after rollback."],
  ["delete_all_synthetic_data", "End the proof and delete all remaining synthetic data."],
].map(([stepId, instruction]) => ({ stepId, instruction }));

const functionIds = [
  "deleteSyntheticSession",
  "health",
  "issueSyntheticSession",
  "sessionCommand",
  "sessionProjection",
].map(
  (name) =>
    `projects/${approvedCloudProjectId}/locations/${approvedCloudRegion}`
    + `/functions/${name}`,
);

const receiptTemplate = (receiptType) => {
  const base = {
    schemaVersion: "wp13.12b-receipt-template-v1",
    templateMarker: "UNFILLED_TEMPLATE_NOT_EVIDENCE",
    receiptId: "",
    receiptType,
    status: "UNFILLED_TEMPLATE_NOT_EVIDENCE",
    createdAt: "",
    performedBy: "",
    environment: "",
    sourceCommit: "",
    sourceTree: "",
    expectedSourceCommit: "",
    decisionRecordChecksum: decisionChecksum,
    commandsRun: [],
    providerResourceIds: {},
    proofResults: {},
    artifactHashes: {},
    limitations: [],
    humanSignatureOrExplicitConfirmation: {
      confirmed: false,
      confirmationText: "",
      confirmedAt: "",
    },
    opensB8: false,
    authorizesStudentBeta: false,
    authorizesProduction: false,
    realParticipantData: false,
    syntheticOrFabricated: false,
    physicalProof: false,
    devices: [],
  };
  if (receiptType === "EMULATOR_PROOF_RECEIPT") {
    return {
      ...base,
      machineEnvironment: {
        operatingSystem: "",
        node: "",
        java: "",
        firebaseCli: "",
        firestoreEmulator: "",
        demoProjectId: "demo-ludys-wp13-12b",
        runtimePhase: "LOCAL_EMULATOR_PROOF",
        localEmulatorMode: true,
        offlineMode: true,
        firestoreEmulatorHost: "127.0.0.1:8088",
        functionsEmulatorHost: "127.0.0.1:5008",
      },
      firebaseCliVersion: "",
      emulatorArtifact: {
        filename: "",
        version: "",
        bytes: 0,
        sha256: "",
        downloadMethod: "firebase setup:emulators:firestore",
      },
      emulatorProofBinding: {
        schemaVersion: "wp13.12b-emulator-proof-binding-v2",
        artifactPath: "",
        artifactSha256: "",
        proofSha256: "",
        nonce: "",
        purpose: "WP13_12B_PR3_LOCAL_EMULATOR_PROOF_ONLY",
        jarSha256: "",
        demoProjectId: "demo-ludys-wp13-12b",
        sourceCommit: "",
        sourceTree: "",
        commitS: "b7b0af2b679a98b0e61ef17e606a5183a1de6323",
        commitSTree: "a86137594062e696a00a547c55827b8d95719d6d",
        commitT: "568d9f9e306075a81f6e4b243d3812507f97b230",
        commitTTree: "64911ea615a1814acb1d03a2bb244152dc1fdee2",
        commitU: "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        commitUTree: "6a9634f4e096b736f4699a209f2152e4e083127d",
        commitV: emulatorCommitV,
        commitVTree: emulatorCommitVTree,
        commitW: "",
        commitWTree: "",
        securityRemediationCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        securityRemediationTree:
          "6a9634f4e096b736f4699a209f2152e4e083127d",
        proofOriginCommit: emulatorCommitV,
        proofOriginTree: emulatorCommitVTree,
        providerSecurityRemediationCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        providerPackageCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        providerPackageLockCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        providerSbomCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        providerAuditCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        proofToolCommit: "",
        proofToolTree: "",
        orderedCommitChain: [
          "b7b0af2b679a98b0e61ef17e606a5183a1de6323",
          "568d9f9e306075a81f6e4b243d3812507f97b230",
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
          emulatorCommitV,
          "",
        ],
        proofToolCommitChain: [
          "568d9f9e306075a81f6e4b243d3812507f97b230",
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
          emulatorCommitV,
          "",
        ],
        proofRunnerSha256: "",
        proofRunnerGitBlob: "",
        pinnedGitAdapterSha256: emulatorPinnedGitAdapterSha256,
        pinnedGitAdapterGitBlob: emulatorPinnedGitAdapterGitBlob,
        gitDiffCommandContract: emulatorGitDiffCommandContract(),
        securityRemediationChangeSetSha256:
          emulatorSecurityRemediationChangeSetSha256,
        previewSourceSetSha256:
          "bf3ecfc58ae713bf91dd53f27b6ad5b9750a65b76bf5b73261526cae7db21d80",
        ownerDecisionSha256: "",
        providerPackageSha256:
          "8ce5655fd797a97c9d537f040e360fef6e3e05ba302769e2861aa1896e5dee0b",
        providerLockSha256:
          "2bb3e7021ca055853ef34c80ca872a1eccb5f2e4d406c15d5e7b87ffb3c69249",
        providerSbomSha256:
          "c6259220286a88e6b5b53605d6d9ca0a8f9091d3cca391908d5908923e9c93c4",
        providerAuditSha256:
          "e7b6f802df5a33df78e6951870e0da492f0ce9fdbc9a3b20ee74a2dd659e70d4",
        providerSecurityRemediationSha256:
          "fe4884c82d5c13b4209ae2d543a4c171dfed31d8fea4621cb606d08291bccded",
        resolvedFastUriVersion: "3.1.5",
        advisory: "GHSA-7p8r-x3mc-p8w7",
        activationPackageSha256: "",
        receiptContractSha256: "",
        generatedAt: "",
        expiresAt: "",
        cloudResourceCount: null,
        deploymentCount: null,
        validatedReceiptCount: null,
      },
      evidenceAnchorCommit:
        "b7b0af2b679a98b0e61ef17e606a5183a1de6323",
      evidenceAnchorTree:
        "a86137594062e696a00a547c55827b8d95719d6d",
      commitT: "568d9f9e306075a81f6e4b243d3812507f97b230",
      commitTTree: "64911ea615a1814acb1d03a2bb244152dc1fdee2",
      commitU: "190fff88808bbafe605cdde4cfe9fe943f4543a4",
      commitUTree: "6a9634f4e096b736f4699a209f2152e4e083127d",
      commitV: emulatorCommitV,
      commitVTree: emulatorCommitVTree,
      commitW: "",
      commitWTree: "",
      securityRemediationCommit:
        "190fff88808bbafe605cdde4cfe9fe943f4543a4",
      securityRemediationTree:
        "6a9634f4e096b736f4699a209f2152e4e083127d",
      proofOriginCommit: emulatorCommitV,
      proofOriginTree: emulatorCommitVTree,
      providerSecurityRemediationCommit:
        "190fff88808bbafe605cdde4cfe9fe943f4543a4",
      providerPackageCommit:
        "190fff88808bbafe605cdde4cfe9fe943f4543a4",
      providerPackageLockCommit:
        "190fff88808bbafe605cdde4cfe9fe943f4543a4",
      providerSbomCommit:
        "190fff88808bbafe605cdde4cfe9fe943f4543a4",
      providerAuditCommit:
        "190fff88808bbafe605cdde4cfe9fe943f4543a4",
      proofToolCommit: "",
      proofToolTree: "",
      orderedCommitChain: [
        "b7b0af2b679a98b0e61ef17e606a5183a1de6323",
        "568d9f9e306075a81f6e4b243d3812507f97b230",
        "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        emulatorCommitV,
        "",
      ],
      proofToolCommitChain: [
        "568d9f9e306075a81f6e4b243d3812507f97b230",
        "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        emulatorCommitV,
        "",
      ],
      nonceRecord: {
        schemaVersion: "wp13.12b-emulator-proof-challenge-v2",
        generation: 1,
        nonce: "",
        purpose: "WP13_12B_PR3_LOCAL_EMULATOR_PROOF_ONLY",
        generatedAt: "",
        expiresAt: "",
        status: "UNFILLED_TEMPLATE_NOT_EVIDENCE",
        consumedAt: "",
        commitS: "b7b0af2b679a98b0e61ef17e606a5183a1de6323",
        commitSTree: "a86137594062e696a00a547c55827b8d95719d6d",
        commitT: "568d9f9e306075a81f6e4b243d3812507f97b230",
        commitTTree: "64911ea615a1814acb1d03a2bb244152dc1fdee2",
        commitU: "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        commitUTree: "6a9634f4e096b736f4699a209f2152e4e083127d",
        commitV: emulatorCommitV,
        commitVTree: emulatorCommitVTree,
        commitW: "",
        commitWTree: "",
        securityRemediationCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        securityRemediationTree:
          "6a9634f4e096b736f4699a209f2152e4e083127d",
        proofOriginCommit: emulatorCommitV,
        proofOriginTree: emulatorCommitVTree,
        providerSecurityRemediationCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        providerPackageCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        providerPackageLockCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        providerSbomCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        providerAuditCommit:
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
        orderedCommitChain: [
          "b7b0af2b679a98b0e61ef17e606a5183a1de6323",
          "568d9f9e306075a81f6e4b243d3812507f97b230",
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
          emulatorCommitV,
          "",
        ],
        proofToolCommitChain: [
          "568d9f9e306075a81f6e4b243d3812507f97b230",
          "190fff88808bbafe605cdde4cfe9fe943f4543a4",
          emulatorCommitV,
          "",
        ],
        proofToolCommit: "",
        proofToolTree: "",
        proofRunnerSha256: "",
        proofRunnerGitBlob: "",
        pinnedGitAdapterSha256: emulatorPinnedGitAdapterSha256,
        pinnedGitAdapterGitBlob: emulatorPinnedGitAdapterGitBlob,
        gitDiffCommandContract: emulatorGitDiffCommandContract(),
        securityRemediationChangeSetSha256:
          emulatorSecurityRemediationChangeSetSha256,
        previewSourceSetSha256:
          "bf3ecfc58ae713bf91dd53f27b6ad5b9750a65b76bf5b73261526cae7db21d80",
        freshEmulatorProofSha256: "",
        ownerDecisionSha256: "",
        providerPackageSha256:
          "8ce5655fd797a97c9d537f040e360fef6e3e05ba302769e2861aa1896e5dee0b",
        providerLockSha256:
          "2bb3e7021ca055853ef34c80ca872a1eccb5f2e4d406c15d5e7b87ffb3c69249",
        providerSbomSha256:
          "c6259220286a88e6b5b53605d6d9ca0a8f9091d3cca391908d5908923e9c93c4",
        providerAuditSha256:
          "e7b6f802df5a33df78e6951870e0da492f0ce9fdbc9a3b20ee74a2dd659e70d4",
        providerSecurityRemediationSha256:
          "fe4884c82d5c13b4209ae2d543a4c171dfed31d8fea4621cb606d08291bccded",
        resolvedFastUriVersion: "3.1.5",
        advisory: "GHSA-7p8r-x3mc-p8w7",
        activationPackageSha256: "",
        receiptContractSha256: "",
        cloudResourceCount: null,
        deploymentCount: null,
        validatedReceiptCount: null,
      },
      proofResults: falseProofResults(emulatorReceiptProofResults),
    };
  }
  if (receiptType === "FIREBASE_PROJECT_AND_REGION_RECEIPT") {
    const firestoreDatabase =
      `projects/${approvedCloudProjectId}/databases/(default)`;
    return {
      ...base,
      environment: "EXTERNAL_SYNTHETIC_STAGING",
      selectedProjectId: approvedCloudProjectId,
      selectedRegion: approvedCloudRegion,
      deploymentMode: "DISABLED_FIRST",
      providerResourceIds: {
        googleProjectId: approvedCloudProjectId,
        googleProjectNumber: "134654966474",
        firestoreDatabase,
        functionIds,
        resourceIds: [
          `projects/${approvedCloudProjectId}`,
          firestoreDatabase,
          ...functionIds,
        ],
      },
      proofResults: falseProofResults(firebaseReceiptProofResults),
      confirmationEvidencePath: "",
      confirmationBindingSha256: "",
      requiredHumanConfirmationFormat:
        "BEKREFT_WP13_12B_FIREBASE_PROJECT_AND_REGION_V1; "
        + "receiptId=<receiptId>; sourceCommit=<sourceCommit>; sourceTree=<sourceTree>; "
        + `projectId=${approvedCloudProjectId}; region=${approvedCloudRegion}; `
        + "evidenceSha256=<confirmationBindingSha256>",
    };
  }
  if (receiptType === "IAM_AND_BILLING_RECEIPT") {
    const deployPrincipal =
      "ludys-staging-deployer@ludys-12b-stg-20260725.iam.gserviceaccount.com";
    const runtimeServiceAccount =
      "ludys-staging-runtime@ludys-12b-stg-20260725.iam.gserviceaccount.com";
    const previewServiceAccount =
      "ludys-preview-invoker@ludys-12b-stg-20260725.iam.gserviceaccount.com";
    const capabilitySecret =
      "projects/134654966474/secrets/LUDYS_CAPABILITY_HMAC_KEY";
    return {
      ...base,
      environment: "EXTERNAL_SYNTHETIC_STAGING",
      providerResourceIds: {
        googleProjectId: approvedCloudProjectId,
        billingAccount: "01CD9D-0900DF-4FB36A",
        budgetId: "",
        runtimeServiceAccount,
        previewServiceAccount,
        deployServiceAccount: deployPrincipal,
        capabilitySecret,
        resourceIds: [
          `projects/${approvedCloudProjectId}`,
          runtimeServiceAccount,
          previewServiceAccount,
          deployPrincipal,
          capabilitySecret,
        ],
      },
      billingAlertConfigured: false,
      monthlyAlertThreshold: { currency: "NOK", amount: 400 },
      maximumMonthlyCost: { currency: "NOK", amount: 500 },
      budgetThresholdsNok: ["400", "500"],
      billingReviewer: "PRODUCT_OWNER_SELF",
      ownerSelfAttestation: "ONE_HUNDRED_PERCENT_OWNER",
      stagingExpiryDate: "2027-01-25",
      stagingExpiryInstant: "2027-01-25T00:00:00.000Z",
      quotaConfiguration: {
        functionMinInstances: 0,
        functionMaxInstances: 1,
        functionConcurrency: 1,
        functionTimeoutSeconds: 60,
      },
      deployPrincipal,
      operatorPrincipal: "user:tryakim@gmail.com",
      deployIdentityAuthenticationMode: "TIME_BOUND_HUMAN_IMPERSONATION",
      deployIdentityDistinctFromRuntimeAndPreview: true,
      deployIdentityRoles: [
        "roles/cloudfunctions.developer",
        "roles/firebaserules.admin",
        "roles/run.admin",
        "roles/serviceusage.serviceUsageConsumer",
      ],
      deployIdentityUserManagedKeyCount: 0,
      deployIdentityKeyless: true,
      deployIdentityOwnerRole: false,
      deployProjectRolesConditioned: true,
      deployBindingWindowMaxSeconds: 3600,
      impersonationStartedAt: "",
      impersonationExpiresAt: "",
      deploymentObservedAt: "",
      serviceAccountUserBindings: {
        role: "roles/iam.serviceAccountUser",
        member: `serviceAccount:${deployPrincipal}`,
        runtimeServiceAccount,
        buildServiceAccount:
          "134654966474-compute@developer.gserviceaccount.com",
        conditioned: true,
        windowMaxSeconds: 3600,
        revoked: false,
      },
      conditionedTokenCreatorBinding: {
        role: "roles/iam.serviceAccountTokenCreator",
        member: "user:tryakim@gmail.com",
        resource: deployPrincipal,
        conditioned: true,
        windowMaxSeconds: 3600,
        revoked: false,
      },
      deploymentCommands: [],
      callerIdentityReadback: "",
      postDeployImpersonationRevoked: false,
      postDeployProjectRolesRevoked: false,
      postDeployRevocationEvidencePath: "",
      runtimeProjectRoles: [
        "roles/datastore.user",
        "roles/logging.logWriter",
      ],
      runtimeSecretRoles: ["roles/secretmanager.secretAccessor"],
      runtimeUserManagedKeyCount: 0,
      previewUserManagedKeyCount: 0,
      capabilitySecretRegion: approvedCloudRegion,
      secretValuePrinted: false,
      secretValueWrittenToDisk: false,
      secretValueExposedToBrowser: false,
      proofResults: falseProofResults(iamReceiptProofResults),
      confirmationEvidencePath: "",
      confirmationBindingSha256: "",
      requiredHumanConfirmationFormat:
        "BEKREFT_WP13_12B_IAM_AND_BILLING_V1; "
        + "receiptId=<receiptId>; sourceCommit=<sourceCommit>; sourceTree=<sourceTree>; "
        + `projectId=${approvedCloudProjectId}; billingAccount=01CD9D-0900DF-4FB36A; `
        + "alertNok=400; maximumNok=500; expiry=2027-01-25; "
        + "expiryInstant=2027-01-25T00:00:00.000Z; "
        + "evidenceSha256=<confirmationBindingSha256>",
    };
  }
  if (receiptType === "PROTECTED_PREVIEW_RECEIPT") {
    return {
      ...base,
      environment: "EXTERNAL_SYNTHETIC_STAGING",
      stagingUrl: "",
      providerResourceIds: {
        vercelTeamId: "team_1Gnn3VSNrP3mbseXx6a92a4J",
        vercelTeamSlug: "trym-s-projects",
        vercelProjectId: "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
        vercelProjectName: "ludys-wp13-12b-staging",
        deploymentId: "",
        deploymentUrl: "",
        rollbackDeploymentId: "",
        rollbackDeploymentUrl: "",
        resourceIds: [
          "team_1Gnn3VSNrP3mbseXx6a92a4J",
          "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
        ],
      },
      deploymentEnvironment: "preview",
      protectionMode: "prod_deployment_urls_and_all_previews",
      oidcIssuerMode: "team",
      webAnalyticsEnabled: false,
      speedInsightsEnabled: false,
      customDomains: [],
      productionDeployment: false,
      gitLinked: false,
      deploymentSourceCommit: "",
      deploymentSourceTree: "",
      rollbackDeploymentId: "",
      rollbackDeploymentBinding: {
        deploymentId: "",
        stagingUrl: "",
        sourceCommit: "",
        sourceTree: "",
        safeDisabled: false,
        evidencePath: "",
        evidenceSha256: "",
      },
      rollbackPlanReference:
        "release/wp13-12b/activation-handoff/rollback-plan.json",
      rollbackMode: "DELETE_PREVIEW_AND_KEEP_BACKEND_DISABLED",
      proofResults: falseProofResults(previewReceiptProofResults),
      confirmationEvidencePath: "",
      confirmationBindingSha256: "",
      requiredHumanConfirmationFormat:
        "BEKREFT_WP13_12B_PROTECTED_PREVIEW_V1; "
        + "receiptId=<receiptId>; sourceCommit=<sourceCommit>; sourceTree=<sourceTree>; "
        + "teamId=team_1Gnn3VSNrP3mbseXx6a92a4J; "
        + "projectId=prj_nHs1hbdyfcMMMglNUTwoYRS43naN; "
        + "deploymentId=<deploymentId>; stagingUrl=<stagingUrl>; "
        + "rollbackDeploymentId=<rollbackDeploymentId>; "
        + "rollbackStagingUrl=<rollbackDeploymentBinding.stagingUrl>; "
        + "rollbackSourceCommit=<rollbackDeploymentBinding.sourceCommit>; "
        + "rollbackSourceTree=<rollbackDeploymentBinding.sourceTree>; "
        + "rollbackEvidenceSha256=<rollbackDeploymentBinding.evidenceSha256>; "
        + "evidenceSha256=<confirmationBindingSha256>",
    };
  }
  return {
    ...base,
    environment: "EXTERNAL_SYNTHETIC_STAGING",
    syntheticSessionId: "",
    deletionSyntheticSessionId: "",
    deploymentId: "",
    rollbackDeploymentId: "",
    stagingUrl: "",
    sessionFixture: "synthetic-wp13-12b-only",
    checksum: "",
    physicalEvidencePath:
      "artifacts/wp13-12b-physical-two-device-proof.json",
    protectedPreviewReceiptBinding: {
      receiptId: "",
      deploymentId: "",
      stagingUrl: "",
      sourceCommit: "",
      sourceTree: "",
      confirmationEvidencePath: "",
      confirmationBindingSha256: "",
    },
    rollbackDeploymentBinding: {
      deploymentId: "",
      stagingUrl: "",
      sourceCommit: "",
      sourceTree: "",
      safeDisabled: false,
      evidencePath: "",
      evidenceSha256: "",
    },
    containsPersonData: false,
    stepResults: [],
    requiredStepIds: physicalStepDefinitions.map(({ stepId }) => stepId),
    physicalProof: false,
    adultOperatorsOnly: false,
    participantsPresent: false,
    physicallySeparateDevicesConfirmed: false,
    requiredHumanConfirmationFormat:
      "BEKREFT_WP13_12B_PHYSICAL_PROOF_V1; "
      + "receiptId=<receiptId>; sourceCommit=<sourceCommit>; sourceTree=<sourceTree>; "
      + "deploymentId=<deploymentId>; syntheticSessionId=<syntheticSessionId>; "
      + "deletionSyntheticSessionId=<deletionSyntheticSessionId>; "
      + "previewReceiptId=<protectedPreviewReceiptBinding.receiptId>; "
      + "previewEvidenceSha256=<protectedPreviewReceiptBinding.confirmationBindingSha256>; "
      + "rollbackDeploymentId=<rollbackDeploymentId>; "
      + "rollbackStagingUrl=<rollbackDeploymentBinding.stagingUrl>; "
      + "rollbackSourceCommit=<rollbackDeploymentBinding.sourceCommit>; "
      + "rollbackSourceTree=<rollbackDeploymentBinding.sourceTree>; "
      + "rollbackEvidenceSha256=<rollbackDeploymentBinding.evidenceSha256>; "
      + "evidenceSha256=<checksum>; adultOperatorsOnly=true; participantsPresent=false; "
      + "physicallySeparateDevicesConfirmed=true",
    providerResourceIds: {
      vercelProjectId: "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
      deploymentId: "",
      deploymentUrl: "",
      rollbackDeploymentId: "",
      rollbackDeploymentUrl: "",
      resourceIds: [],
    },
    proofResults: falseProofResults(physicalReceiptProofResults),
  };
};

const physicalProofTemplate = {
  schemaVersion: "wp13.12b-physical-two-device-proof-v1",
  status: "UNFILLED_TEMPLATE_NOT_EVIDENCE",
  templateMarker: "UNFILLED_TEMPLATE_NOT_EVIDENCE",
  performed: false,
  sourceCommit: "",
  sourceTree: "",
  stagingUrl: "",
  sessionFixture: "synthetic-wp13-12b-only",
  syntheticSessionId: "",
  deletionSyntheticSessionId: "",
  deploymentId: "",
  rollbackDeploymentId: "",
  protectedPreviewReceiptBinding: {
    receiptId: "",
    deploymentId: "",
    stagingUrl: "",
    sourceCommit: "",
    sourceTree: "",
    confirmationEvidencePath: "",
    confirmationBindingSha256: "",
  },
  rollbackDeploymentBinding: {
    deploymentId: "",
    stagingUrl: "",
    sourceCommit: "",
    sourceTree: "",
    safeDisabled: false,
    evidencePath: "",
    evidenceSha256: "",
  },
  devices: [
    {
      role: "CHILD",
      deviceEvidenceId: "",
      deviceType: "",
      operatingSystem: "",
      browser: "",
      observedAt: "",
      syntheticSessionId: "",
      deploymentId: "",
      stagingUrl: "",
      sourceCommit: "",
      sourceTree: "",
      capabilityPresent: false,
      capabilityValueRecorded: false,
      networkEvidence: "",
    },
    {
      role: "ADULT",
      deviceEvidenceId: "",
      deviceType: "",
      operatingSystem: "",
      browser: "",
      observedAt: "",
      syntheticSessionId: "",
      deploymentId: "",
      stagingUrl: "",
      sourceCommit: "",
      sourceTree: "",
      capabilityPresent: false,
      capabilityValueRecorded: false,
      networkEvidence: "",
    },
  ],
  adultOperatorsOnly: false,
  participantsPresent: false,
  physicallySeparateDevicesConfirmed: false,
  steps: physicalStepDefinitions,
  stepResults: [],
  stepResultBinding:
    "Each stepResult must include its exact syntheticSessionId and deploymentId. Steps 1-18 bind the primary session; 19-27 bind deletionSyntheticSessionId. Steps 1-24 bind the active deployment; 25-27 bind rollbackDeploymentId.",
  screenshotsOrVideo: [],
  containsPersonData: false,
  physicalEvidencePath:
    "artifacts/wp13-12b-physical-two-device-proof.json",
  checksum: "",
  requiredHumanConfirmationFormat:
    "BEKREFT_WP13_12B_PHYSICAL_PROOF_V1; "
    + "receiptId=<receiptId>; sourceCommit=<sourceCommit>; sourceTree=<sourceTree>; "
    + "deploymentId=<deploymentId>; syntheticSessionId=<syntheticSessionId>; "
    + "deletionSyntheticSessionId=<deletionSyntheticSessionId>; "
    + "previewReceiptId=<protectedPreviewReceiptBinding.receiptId>; "
    + "previewEvidenceSha256=<protectedPreviewReceiptBinding.confirmationBindingSha256>; "
    + "rollbackDeploymentId=<rollbackDeploymentId>; "
    + "rollbackStagingUrl=<rollbackDeploymentBinding.stagingUrl>; "
    + "rollbackSourceCommit=<rollbackDeploymentBinding.sourceCommit>; "
    + "rollbackSourceTree=<rollbackDeploymentBinding.sourceTree>; "
    + "rollbackEvidenceSha256=<rollbackDeploymentBinding.evidenceSha256>; "
    + "evidenceSha256=<checksum>; adultOperatorsOnly=true; participantsPresent=false; "
    + "physicallySeparateDevicesConfirmed=true",
  humanSignatureOrExplicitConfirmation: {
    confirmed: false,
    confirmationText: "",
  },
};

const rollbackPlan = {
  schemaVersion: "wp13.12b-provider-rollback-v1",
  component: "SYNTHETIC_STAGING_PROVIDER",
  status: "UNEXECUTED_PLAN",
  invariants: [
    "rollback never activates cloud resources",
    "controlEpoch never decreases",
    "control is false at a strictly advanced epoch before issuance is disabled",
    "issuance and every function are safe-disabled before WIF is disabled",
    "WIF provider and pool are disabled and verified before the rollback preview is used",
    "rollback uses the existing receipt-bound safe-disabled deployment and never creates or promotes another deployment",
    "final pre-rollback inventory is exactly one active plus one receipt-bound rollback, zero unrelated and two total",
    "withdrawn provider revision cannot be selected",
    "schemaVersion must be compatible",
    "tombstone dominates cached or rolled-back state",
    "pure core and in-memory adapter remain runnable without provider package",
    "an already issued STS token may linger until its own expiry, but backend control, issuance and functions are disabled first",
  ],
  steps: [
    "Set stagingEnabled=false and increment controlEpoch",
    "Provision and verify only the time-bounded keyless deploy identity",
    "Deploy configure-preview-origin for the exact receipt-bound active origin and verify issueSyntheticSession issuance is false",
    "Deploy the safe-disabled function set and verify the safe origin/function readback",
    "Revoke and verify the deploy identity",
    "Disable the exact WIF provider, then the exact WIF pool, and verify both disabled",
    "Use only the existing receipt-bound safe-disabled rollback preview in a separate logged-in Chrome/browser session without a protection bypass token or shareable link",
    "Verify active, delayed, reconnect and cached-capability commands are denied",
    "Re-run STOP, deletion, tombstone and no-resurrection proof",
  ],
  commands: [
    deactivationControlCommand.replace(
      "--reason EXPIRY_DESTRUCTION",
      "--reason ROLLBACK",
    ),
    deployIdentityControlCommand("plan"),
    deployIdentityControlCommand("provision"),
    deployIdentityControlCommand("verify"),
    functionDeployCommand("configure-preview-origin", {
      previewOrigin: "<EXACT_RECEIPT_BOUND_ACTIVE_PREVIEW_ORIGIN>",
    }),
    functionDeployCommand("deploy-disabled"),
    deployIdentityControlCommand("revoke"),
    wifDisabledStateCommand("disable-workload-identity-provider"),
    wifDisabledStateCommand("disable-workload-identity-pool"),
    wifDisabledStateCommand("verify-disabled"),
    useReceiptBoundRollbackPreview,
  ],
  requiredDeploymentInventoryBeforeRollback: {
    active: 1,
    receiptBoundRollback: 1,
    unrelated: 0,
    total: 2,
  },
  residualTokenNote:
    "Previously issued STS tokens may remain valid until their own expiry, "
    + "but staging control, issuance and safe-disabled functions deny useful backend access first.",
  deactivationCommand: deactivationControlCommand.replace(
    "--reason EXPIRY_DESTRUCTION",
    "--reason ROLLBACK",
  ),
  externalActionsExecuted: false,
};

const destructionPlan = {
  schemaVersion: "wp13.12b-staging-destruction-v3",
  status: "UNEXECUTED_PLAN",
  ownerApprovedExpiryDate: "2027-01-25",
  expiryExecutionStatus: "AUTHORIZED_AT_EXPIRY_NOT_SCHEDULED",
  schedulerReceipt: null,
  responsibleOperator: "PRODUCT_OWNER_SELF_OR_EXPLICITLY_DELEGATED_OPERATOR",
  extensionPolicy: "NEW_EXPLICIT_PRODUCT_OWNER_DECISION_REQUIRED",
  executionContract:
    "release/wp13-12b/external-activation/expiry-destruction-execution-contract.json",
  syntheticDeletionWindow: {
    separateExactAuthorizationRequired: true,
    minimumMinutes: 5,
    maximumMinutes: 30,
    ordinaryGraceEndsAt: "2027-01-26T00:00:00.000Z",
    broadDeployOrRedeployAllowed: false,
    executionAfterOrdinaryGrace:
      "SEPARATE_EXCEPTIONAL_RECOVERY_AUTHORIZATION_REQUIRED",
  },
  triggers: [
    "approved staging expiry date",
    "owner stop",
    "cost or security stop condition",
    "completion of authorized technical proof",
  ],
  orderedSteps: [
    "before the staging term ends, disable staging and advance controlEpoch",
    "provision and verify only the time-bounded keyless deploy identity",
    "deploy configure-preview-origin for the exact receipt-bound active origin and verify issuance false",
    "deploy and verify the safe-disabled origin/function set",
    "under separate exact authorization, downscope and verify deploy identity to conditional TokenCreator plus exact deleteSyntheticSession run.invoker for only 5 to 30 minutes",
    "write the immutable deletion intent, then delete all bounded active synthetic sessions or authenticate an already-zero state with retained tombstone history",
    "in guaranteed finally cleanup, revoke deletion-only authority and authenticate the revoked Google-only readback before writing the execution receipt",
    "materialize zero-state tombstone-retention evidence and record its exact immutable digest-bound confirmation phrase",
    "disable the exact WIF provider, then the exact WIF pool, and verify both disabled",
    "record that previously issued STS tokens may linger until expiry but the backend was disabled first",
    "at or after approved expiry, materialize the deactivation receipt without weakening the already-safe state",
    "delete the exact Vercel project and verify its deployments, domains, environment and settings are absent",
    "record the exact immutable digest-bound Vercel-absence confirmation phrase",
    "collect fresh authenticated combined inventory proving Vercel absent and confirm its digest",
    "only after Vercel absence, remove Functions, Firestore Rules and remaining Google resources under authorization",
    "destroy server secret versions and revoke IAM",
    "delete database and isolated project under authorization",
    "repeat authenticated combined read-only inventory until both provider scopes are verified zero",
  ],
  orderedCommands: [
    deactivationControlCommand,
    deployIdentityControlCommand("plan"),
    deployIdentityControlCommand("provision"),
    deployIdentityControlCommand("verify"),
    functionDeployCommand("configure-preview-origin", {
      previewOrigin: "<EXACT_RECEIPT_BOUND_ACTIVE_PREVIEW_ORIGIN>",
    }),
    functionDeployCommand("deploy-disabled"),
    syntheticDataDeletionExecutionCommand,
    syntheticDataDeletionEvidencePlanCommand,
    syntheticDataDeletionConfirmationCommand,
    wifDisabledStateCommand("disable-workload-identity-provider"),
    wifDisabledStateCommand("disable-workload-identity-pool"),
    wifDisabledStateCommand("verify-disabled"),
    destructionDeactivationExecutionCommand,
    "node scripts/wp13-12b-external-resource-operator.mjs "
      + "--action vercel-destruction-plan "
      + `--confirm-vercel-team-id ${approvedVercelTeamId} `
      + `--confirm-vercel-project-id ${approvedVercelProjectId} `
      + `--deactivation-receipt ${deactivationExecutionReceiptPath} `
      + `--synthetic-data-deletion-evidence ${syntheticDataDeletionEvidencePath} `
      + `--execute "${vercelDestructionAuthorization}"`,
    previewDestructionConfirmationCommand,
    "npm run provider:external:inventory -- --output <POST_VERCEL_INVENTORY_PATH>",
    "npm run provider:external:destruction-plan -- "
      + "--confirm-inventory-digest <POST_VERCEL_INVENTORY_DIGEST> "
      + "--confirm-project-number 134654966474 "
      + `--deactivation-receipt ${deactivationExecutionReceiptPath} `
      + `--synthetic-data-deletion-evidence ${syntheticDataDeletionEvidencePath} `
      + `--preview-destruction-evidence ${previewDestructionEvidencePath} `
      + `--execute "${googleDestructionAuthorization}"`,
    "npm run provider:external:inventory -- --output <FINAL_ZERO_RESOURCE_INVENTORY_PATH>",
  ],
  deactivationCommand: deactivationControlCommand,
  expiryDeactivationPlanCommand: destructionDeactivationExecutionCommand,
  stopConditions: [
    "safe backend transition cannot complete before the staging term ends",
    "issuance false or safe-disabled function/origin readback is absent",
    "separate exact synthetic deletion authorization or a valid 5-to-30-minute deletion window is absent",
    "ordinary synthetic deletion is attempted after 2027-01-26T00:00:00.000Z without separate exceptional recovery authorization",
    "broad deploy or redeploy is attempted after expiry without separate exceptional recovery authorization",
    "immutable intent, execution receipt, guaranteed-finally revocation readback, zero-state evidence or its exact human confirmation is absent",
    "WIF would be disabled before backend safety and confirmed synthetic-zero evidence are proven",
    "Vercel would be deleted before WIF disabled verification and deactivation receipt",
    "Google destruction would start before authenticated and human-confirmed Vercel absence",
    "minimum tombstone, immutable confirmation or required destruction evidence is absent",
  ],
  residualTokenNote:
    "Previously issued STS tokens may remain valid until their own expiry, "
    + "but staging control, issuance and functions are disabled before trust or preview removal.",
  ttlIsNotDestruction: true,
  backupAndPitrExpected: false,
  externalActionsExecuted: false,
};

const emulatorImportContract = {
  schemaVersion: "wp13.12b-emulator-import-v1",
  status: "NO_ARTIFACT_IMPORTED",
  exactFilenameRequired: true,
  acceptedFileType: "JAR",
  sha256Required: true,
  publishedChecksumRequired: true,
  reject: [
    "non-JAR file",
    "renamed archive",
    "missing checksum",
    "checksum mismatch",
    "artifact from unverified source",
  ],
  offlineImportCommand: "npm run provider:emulator:import -- --artifact <exact-jar> --sha256 <published-sha256>",
  cloudResourcesCreated: 0,
};

const knownLimitations = {
  schemaVersion: "wp13.12b-known-limitations-v1",
  limitations: [
    "The Commit-S/Commit-T provider package containing fast-uri@3.1.4 is SUPERSEDED_SECURITY_VULNERABILITY and prohibited for deployment; only the package bound by provider-security-remediation.json may be used after its introducing commit is verified.",
    "Provider activation remains blocked and no cloud proof exists.",
    "Cost ceiling, billing alert, kill-switch owner, staging expiry and automatic deletion policy remain unresolved.",
    "Actual Firebase emulator proof requires a verified emulator artifact and is tracked separately.",
    "Physical two-device proof has not been performed.",
    "No external receipts exist.",
    "Browser automation is Chromium/Edge based; manual screen-reader and broad physical-device review remain outstanding.",
    "Application logging policy cannot control all Google Cloud or Vercel service logs.",
    "TTL is not configured and would only be a delayed backstop, never explicit deletion.",
  ],
  blocksExternalActivation: true,
};

const provenance = {
  schemaVersion: "wp13.12b-staging-provenance-v1",
  baselineCommit,
  baselineTree,
  ownerDecisionSourceCommit: "929674d8a159ebd9ac6026c066f5dd044ebcea62",
  ownerDecisionRegistrationCommit: baselineCommit,
  ownerDecisionRecordChecksum: decisionChecksum,
  sourcePackageChecksum,
  branch: "feature/wp13-12b-synthetic-staging-repository-and-handoff",
  parentBranch: "feature/wp13-12a-provider-region-capability-decision-package",
  prBasePolicy: "STACKED_ON_WP13_12A_WHILE_PR_9_IS_UNMERGED",
  historicalReferenceClassification: "HISTORICAL_REQUIREMENTS_AND_IMPLEMENTATION_REFERENCE",
  historicalFilesFound: false,
  historicalCodeImported: false,
  historicalTestsImported: false,
  providerPackage: "provider/firebase",
  stagingProviderReleaseId: "wp13-12b-synthetic-staging-provider-r1",
  externalCloudWrites: 0,
  providerAccountsAccessed: false,
  candidateCommitBinding: "Final Git commit and tree are reported after all checks; receipt templates require the final full SHA.",
};

const validation = {
  valid: true,
  errors: [],
  warnings: irreversibleFieldsStillRequiringApproval.map(
    (field) => `${field} requires explicit display and approval before provisioning`,
  ),
  repositoryImplementation: "READY",
  ownerDecision: "APPROVE_RECOMMENDED_SYNTHETIC_DEV",
  ownerDecisionStatus: "OWNER_DECISION_RECORDED",
  providerActivation: "BLOCKED",
  cloudResources: 0,
  emulatorProof: "NOT_COMPLETED_OR_EXPLICITLY_CLASSIFIED",
  physicalTwoDeviceProof: false,
  externalReceipts: 0,
  b8: "NOT_DECISION_READY",
  studentBeta: "NOT_AUTHORIZED",
  production: "NOT_AUTHORIZED",
  wp13_12c: "BLOCKED",
};

const baselineArtifact = {
  schemaVersion: "wp13.12b-baseline-proof-v1",
  checkedAt: "2026-07-25",
  branchAtCheck: "feature/wp13-12a-provider-region-capability-decision-package",
  head: baselineCommit,
  tree: baselineTree,
  originMain: "19f6ad7da12ef5c721ed4f3a7e7ec5fd3ece4b5f",
  ownerDecisionImplementationCommit: "929674d8a159ebd9ac6026c066f5dd044ebcea62",
  ownerDecisionRegistrationCommit: baselineCommit,
  ownerDecisionRecordChecksum: decisionChecksum,
  sourcePackageChecksum,
  cleanWorktree: true,
  worktreeCount: 1,
  branchRemoteDivergence: [0, 0],
  preChangeCheckRelease: {
    passed: true,
    tests: 207,
    wp13_12aTests: 59,
    productionAuditVulnerabilities: 0,
    reproducibleBuildDigest: "297c0f52dcbbb153f6048f2554c3a26b12766f009dca1570073bb6c58c79f2dc",
    cleanCopies: 2,
  },
  baselineDeviations: 0,
};

const providerFactsArtifact = {
  schemaVersion: "wp13.12b-provider-fact-proof-v1",
  checkedAt: "2026-07-27",
  selectedRegion: "europe-north1",
  firestoreRegionalSupport: "VERIFIED",
  functions2ndGenSupport: "VERIFIED",
  adminSdkBypassesRules: "VERIFIED_REQUIRES_IAM",
  ttlNotInstantaneous: "VERIFIED_TYPICALLY_WITHIN_24_HOURS",
  ownerDecisionChanged: false,
  providerActivation: "BLOCKED",
  officialSourceRegister: `${releaseRoot}/staging-activation/official-source-register.json`,
};

const files = new Map([
  [`${releaseRoot}/staging-activation/repository-contract.json`, contract],
  [`${releaseRoot}/staging-activation/data-model.json`, dataModel],
  [`${releaseRoot}/staging-activation/logging-policy.json`, loggingPolicy],
  [`${releaseRoot}/staging-activation/official-source-register.json`, officialSources],
  [`${releaseRoot}/staging-activation/cloud-preflight.json`, cloudPreflight],
  [`${releaseRoot}/staging-activation/release-components.json`, {
    appVersion: "0.14.0-reconstructed.9",
    contentReleaseId: "wp13-8-authentic-draft-corpus-r1",
    knowledgeReleaseId: "release-knowledge-audio-prototype-001",
    audioReleaseId: "wp13-9-audio-specifications-r1",
    operationsReleaseId: "wp13-11-operations-kit-r1",
    providerDecisionReleaseId: "wp13-12a-provider-decision-r1",
    stagingProviderReleaseId: "wp13-12b-synthetic-staging-provider-r1",
    schemaVersion: "wp13.12b-synthetic-staging-v1",
  }],
  [`${releaseRoot}/staging-activation/locale-bundles.json`, {
    schemaVersion: "wp13.12b-preview-locales-v1",
    fallbackAllowed: false,
    bundles: [
      { locale: "nb", source: "src/ui/browser/staging-preview.ts", humanReviewStatus: "REVIEW_REQUIRED_BEFORE_EXTERNAL_PREVIEW" },
      { locale: "nn", source: "src/ui/browser/staging-preview.ts", humanReviewStatus: "REVIEW_REQUIRED_BEFORE_EXTERNAL_PREVIEW" },
    ],
  }],
  [`${releaseRoot}/activation-handoff/operator-tasks.json`, operatorTasks],
  [`${releaseRoot}/activation-handoff/receipt-contracts.json`, receiptContracts],
  [`${releaseRoot}/activation-handoff/emulator-import-contract.json`, emulatorImportContract],
  [`${releaseRoot}/activation-handoff/physical-two-device-proof-template.json`, physicalProofTemplate],
  [`${releaseRoot}/activation-handoff/rollback-plan.json`, rollbackPlan],
  [`${releaseRoot}/activation-handoff/destruction-plan.json`, destructionPlan],
  [`${releaseRoot}/activation-handoff/iam-and-secrets-plan.json`, iamPlan],
  [`${releaseRoot}/validation.json`, validation],
  [`${releaseRoot}/authorization-status.json`, authorizationStatus],
  [`${releaseRoot}/known-limitations.json`, knownLimitations],
  [`${releaseRoot}/staging-provenance.json`, provenance],
  ["artifacts/wp13-12b-baseline-verification.json", baselineArtifact],
  ["artifacts/wp13-12b-provider-facts.json", providerFactsArtifact],
]);

for (const receiptType of receiptTypes) {
  files.set(
    `${releaseRoot}/receipts/templates/${receiptType.toLowerCase()}.json`,
    receiptTemplate(receiptType),
  );
}

async function ensureText(path, content) {
  const target = new URL(`../${path.replaceAll("\\", "/")}`, import.meta.url);
  if (checkOnly) {
    const actual = await readFile(target, "utf8").catch(() => "");
    if (actual !== content) {
      throw new Error(`${path} is stale; run npm run staging:generate`);
    }
    return;
  }
  await mkdir(dirname(fileURLToPath(target)), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function writeJson(path, value) {
  await ensureText(path, `${JSON.stringify(value, null, 2)}\n`);
}

const generatorProtectedProviderRuntimeSources = Object.fromEntries(
  await Promise.all(providerRuntimeSecuritySourcePaths.map(async (path) => [
    path,
    await readFile(new URL(`../${path}`, import.meta.url), "utf8"),
  ])),
);
assertProviderRuntimeSecuritySourceContracts(
  generatorProtectedProviderRuntimeSources,
);

for (const [path, value] of files) await writeJson(path, value);

await ensureExternalActivationChecksumManifest(repo, { checkOnly });

const checksumTargets = [...new Set([
  ...files.keys(),
  "package.json",
  "docs/WP13_12B_SYNTHETIC_STAGING_REPOSITORY_AND_ACTIVATION_HANDOFF.md",
  "release/wp13-12b/provider-audit.json",
  "release/wp13-12b/provider-sbom.cdx.json",
  "release/wp13-12b/provider-license-inventory.json",
  "release/wp13-12b/provider-security-remediation.json",
  "release/wp13-12b/reproducible-build.json",
  "provider/firebase/.firebaserc.example",
  "provider/firebase/firebase.json",
  "provider/firebase/firestore.indexes.json",
  "provider/firebase/firestore.rules",
  "provider/firebase/staging.env.example",
  "provider/firebase/functions/package.json",
  "provider/firebase/functions/package-lock.json",
  "provider/firebase/functions/functions.yaml",
  "provider/firebase/functions/index.mjs",
  "provider/firebase/functions/firestore-store.mjs",
  "provider/firebase/functions/src/authoritative-handler.ts",
  "provider/firebase/functions/src/in-memory-store.ts",
  ...externalActivationChecksumTargets,
  externalActivationChecksumManifestPath,
  "provider/firebase/tools/seed-synthetic-fixtures.mjs",
  "provider/firebase/tools/set-staging-control.mjs",
  "provider/firebase/tools/operator-gate-contract.mjs",
  "scripts/provider-staging-operator-gates-test.mjs",
  "scripts/provider-functions-runtime-test.mjs",
  "scripts/classify-emulator-wp13-12b.mjs",
  "scripts/run-wp13-12b-emulator-proof.mjs",
  "scripts/wp13-12b-emulator-confirmation.mjs",
  "scripts/wp13-12b-emulator-confirmation-test.mjs",
  "scripts/serve-proof.mjs",
  "scripts/validate-wp13-12b-receipt.mjs",
  "scripts/validate-wp13-12b-external-activation.mjs",
  "scripts/wp13-12b-receipt-integrity.mjs",
  "src/core/synthetic-staging.ts",
  "src/core/staging-validation.ts",
  "tests/properties/staging-validation.test.ts",
  "tests/scenarios/firebase-authoritative-handler.test.ts",
  "src/application/synthetic-staging-preview-controller.ts",
  "src/ui/browser/staging-preview.ts",
  "web/staging-preview.html",
  "web/staging-runtime-config.json",
  "artifacts/wp13-12b-provider-package.json",
  "artifacts/wp13-12b-preview-build.json",
  "artifacts/wp13-12b-functions-framework-proof.json",
  "artifacts/wp13-12b-browser-proof.json",
  "artifacts/wp13-12b-browser-proof.png",
  "artifacts/wp13-12b-emulator-proof-status.json",
  "artifacts/wp13-12b-reproducible-build-result.json",
  "artifacts/wp13-12b-actual-emulator-proof-aea01ab.json",
])].sort();

const checksumLines = [];
for (const path of checksumTargets) {
  const content = await readFile(new URL(`../${path}`, import.meta.url));
  checksumLines.push(`${createHash("sha256").update(content).digest("hex")}  ${path}`);
}
await ensureText(
  `${releaseRoot}/artifact-checksums.sha256`,
  `${checksumLines.join("\n")}\n`,
);

console.log(checkOnly
  ? `WP13.12B staging repository generation is deterministic and current (${checksumTargets.length} checksummed files).`
  : `WP13.12B staging repository package generated deterministically (${checksumTargets.length} checksummed files).`);
