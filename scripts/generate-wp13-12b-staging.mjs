import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const releaseRoot = "release/wp13-12b";
const decisionChecksum = "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754";
const sourcePackageChecksum = "f3830a640fd901f193279ed99338d923848acaef662e79e8a831e870a7813de7";
const baselineCommit = "e5846735a3744a07febd93d5f75e776700c1013d";
const baselineTree = "85a618cf567131be9f36fecfc038ab5f45c6732d";

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
  wp13_12bExternalActivation: "BLOCKED_PENDING_AUTHORIZED_OPERATOR",
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
  checkedAt: "2026-07-25",
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

const unresolvedOwnerFields = [
  "monthlyAlertThreshold",
  "maximumMonthlyCost",
  "killSwitchOwner",
  "billingReviewer",
  "stagingExpiryDate",
  "automaticDeletionPolicy",
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
  externalActivationReady: false,
  stopCondition: "Do not provision until every unresolved owner field has a separately recorded value and authorization.",
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
    task("OP-03", "LOCAL_EMULATOR_SCOPE", ["OP-02 complete"], [
      "npm run provider:emulator:proof -- --authorized-local-emulator-proof",
    ], "Firestore Rules and local Function contract proof complete with zero cloud resources.", ["EMULATOR_PROOF_RECEIPT"], "Stop emulator and remove owned temporary state.", "Any emulator proof fails."),
    task("OP-04", "LOCAL_DEPENDENCY_AUDIT_SCOPE", ["provider package lock unchanged"], [
      "npm --prefix provider/firebase/functions ci --ignore-scripts",
      "npm --prefix provider/firebase/functions audit --omit=dev",
    ], "Provider dependency tree is re-audited.", ["audit JSON", "SBOM", "license inventory"], "Remove local node_modules only; keep lockfile.", "Any moderate-or-higher unresolved runtime finding."),
    task("OP-05", "NEW_EXPLICIT_CLOUD_PROJECT_CREATION_AUTHORIZATION", ["OP-01 through OP-04", "all unresolved owner fields resolved"], [
      "gcloud projects create <approved-project-id> --name='LUDYS synthetic staging'",
    ], "One isolated synthetic dev project exists.", ["FIREBASE_PROJECT_AND_REGION_RECEIPT"], "Schedule project deletion using approved owner path.", "Authorization, project ID, ownership or cost field missing."),
    task("OP-06", "BILLING_CONFIGURATION_AUTHORIZATION", ["OP-05", "approved cost ceiling and alert threshold"], [
      "gcloud billing projects link <approved-project-id> --billing-account=<approved-billing-account>",
      "gcloud billing budgets create --billing-account=<approved-billing-account> --display-name='LUDYS synthetic staging' --budget-amount=<approved-maximum>",
    ], "Billing and alerts match recorded owner values; alert is not represented as a hard cap.", ["IAM_AND_BILLING_RECEIPT"], "Unlink billing and stop staging.", "Values differ from owner record or billing reviewer unavailable."),
    task("OP-07", "FIRESTORE_DATABASE_CREATION_AUTHORIZATION", ["OP-05", "region reverified immediately before creation"], [
      "gcloud firestore databases create --project=<approved-project-id> --location=europe-north1 --type=firestore-native",
    ], "Regional Standard Firestore is created once in europe-north1.", ["project and region receipt", "provider output"], "Follow destruction plan; region cannot be changed in place.", "Region support changed or region approval absent."),
    task("OP-08", "IAM_AND_SECRET_CREATION_AUTHORIZATION", ["OP-05 through OP-07", "IAM plan owner-approved"], [
      "gcloud iam service-accounts create ludys-staging-runtime --project=<approved-project-id>",
      "gcloud secrets create LUDYS_CAPABILITY_HMAC_KEY --replication-policy=user-managed --locations=europe-north1 --project=<approved-project-id>",
      "gcloud secrets versions add LUDYS_CAPABILITY_HMAC_KEY --data-file=<operator-owned-one-line-secret-file> --project=<approved-project-id>",
      "gcloud projects add-iam-policy-binding <approved-project-id> --member=serviceAccount:ludys-staging-runtime@<approved-project-id>.iam.gserviceaccount.com --role=roles/datastore.user",
      "gcloud projects add-iam-policy-binding <approved-project-id> --member=serviceAccount:ludys-staging-runtime@<approved-project-id>.iam.gserviceaccount.com --role=roles/logging.logWriter",
      "gcloud secrets add-iam-policy-binding LUDYS_CAPABILITY_HMAC_KEY --member=serviceAccount:ludys-staging-runtime@<approved-project-id>.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --project=<approved-project-id>",
    ], "Least-privilege runtime identity and one server secret exist without JSON keys.", ["IAM_AND_BILLING_RECEIPT"], "Revoke bindings, disable identity and destroy secret.", "Owner role, JSON key or browser secret would be required."),
    task("OP-09", "CLOUD_FUNCTION_AND_RULE_DEPLOYMENT_AUTHORIZATION", ["OP-08", "kill switch disabled-by-default control document"], [
      "npm run provider:package",
      "firebase deploy --project <approved-project-id> --only firestore:rules,firestore:indexes",
      "gcloud functions deploy issueSyntheticSession --gen2 --runtime=nodejs24 --region=europe-north1 --source=provider/firebase/functions --entry-point=issueSyntheticSession --trigger-http --no-allow-unauthenticated --service-account=ludys-staging-runtime@<approved-project-id>.iam.gserviceaccount.com --set-env-vars=LUDYS_STAGING_SESSION_ISSUANCE_ENABLED=true --set-secrets=LUDYS_CAPABILITY_HMAC_KEY=LUDYS_CAPABILITY_HMAC_KEY:latest --project=<approved-project-id>",
      "gcloud functions deploy sessionCommand --gen2 --runtime=nodejs24 --region=europe-north1 --source=provider/firebase/functions --entry-point=sessionCommand --trigger-http --allow-unauthenticated --service-account=ludys-staging-runtime@<approved-project-id>.iam.gserviceaccount.com --set-secrets=LUDYS_CAPABILITY_HMAC_KEY=LUDYS_CAPABILITY_HMAC_KEY:latest --project=<approved-project-id>",
      "gcloud functions deploy sessionProjection --gen2 --runtime=nodejs24 --region=europe-north1 --source=provider/firebase/functions --entry-point=sessionProjection --trigger-http --allow-unauthenticated --service-account=ludys-staging-runtime@<approved-project-id>.iam.gserviceaccount.com --set-secrets=LUDYS_CAPABILITY_HMAC_KEY=LUDYS_CAPABILITY_HMAC_KEY:latest --project=<approved-project-id>",
      "gcloud functions deploy deleteSyntheticSession --gen2 --runtime=nodejs24 --region=europe-north1 --source=provider/firebase/functions --entry-point=deleteSyntheticSession --trigger-http --no-allow-unauthenticated --service-account=ludys-staging-runtime@<approved-project-id>.iam.gserviceaccount.com --set-secrets=LUDYS_CAPABILITY_HMAC_KEY=LUDYS_CAPABILITY_HMAC_KEY:latest --project=<approved-project-id>",
      "gcloud functions deploy health --gen2 --runtime=nodejs24 --region=europe-north1 --source=provider/firebase/functions --entry-point=health --trigger-http --no-allow-unauthenticated --service-account=ludys-staging-runtime@<approved-project-id>.iam.gserviceaccount.com --set-secrets=LUDYS_CAPABILITY_HMAC_KEY=LUDYS_CAPABILITY_HMAC_KEY:latest --project=<approved-project-id>",
    ], "Backend is deployed disabled-by-default with deny-all direct access.", ["deployment transcript", "artifact hashes"], "Advance controlEpoch, disable staging and deploy prior safe provider revision.", "Any endpoint is enabled before control and receipts are ready."),
    task("OP-10", "VERCEL_PROJECT_AND_PREVIEW_AUTHORIZATION", ["OP-09", "approved protected-preview plan"], [
      "vercel link --project <approved-preview-project>",
      "vercel deploy --target=preview",
    ], "A non-production protected preview exists with no secrets in browser.", ["PROTECTED_PREVIEW_RECEIPT"], "Remove preview and revoke project link.", "Deployment protection is absent or production domain would be used."),
    task("OP-11", "SYNTHETIC_FIXTURE_SEED_AUTHORIZATION", ["OP-09", "staging still disabled"], [
      "node provider/firebase/tools/set-staging-control.mjs --project <approved-project-id> --enabled true --control-epoch <approved-monotonic-epoch> --reason EXPLICIT_SYNTHETIC_PROOF_WINDOW --authorized WP13_12B_OPERATOR_AUTHORIZED",
      "node provider/firebase/tools/seed-synthetic-fixtures.mjs --project <approved-project-id> --issue-url <iam-protected-issue-function-url> --fixture synthetic-wp13-12b-only --locale nb --authorized WP13_12B_OPERATOR_AUTHORIZED",
    ], "Only explicit synthetic fixture records exist.", ["fixture manifest", "data allowlist scan"], "Run explicit deletion and confirm tombstones.", "Any field resembles participant, school, health or free-text data."),
    task("OP-12", "PHYSICAL_TWO_DEVICE_PROOF_AUTHORIZATION", ["OP-10", "two controlled devices", "no participant present"], [
      "Follow release/wp13-12b/activation-handoff/physical-two-device-proof-template.json step by step",
    ], "Two physical devices prove separate role capabilities for one synthetic session.", ["PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT"], "Close browsers, clear memory/cache and delete fixture.", "Any screenshot or video could contain person data."),
    task("OP-13", "PHYSICAL_SAFETY_PROOF_AUTHORIZATION", ["OP-12"], [
      "Execute STOP, explicit deletion, reconnect and delayed-command steps from the physical proof template",
    ], "STOP, deletion and no-resurrection are physically observed.", ["signed step results", "non-personal screenshots if used"], "Keep kill switch active until discrepancy is resolved.", "Any session can resume or payload remains after deletion."),
    task("OP-14", "ROLLBACK_AND_KILL_SWITCH_AUTHORIZATION", ["OP-13", "rollback revision verified"], [
      "Advance controlEpoch and set stagingEnabled=false",
      "Execute the approved provider rollback command from rollback-plan.json",
    ], "All cached capabilities remain invalid and no session resurrects.", ["kill-switch proof", "rollback receipt section"], "Keep staging disabled and deploy the last safe revision.", "Rollback lowers controlEpoch or restores active state."),
    task("OP-15", "RECEIPT_SIGNING_AUTHORIZATION", ["all applicable proof tasks complete"], [
      "npm run receipt:validate -- --receipt <filled-receipt-path>",
    ], "Authentic receipts are checksum-bound and human-confirmed.", ["five applicable signed receipts"], "Invalidate erroneous receipt; never edit signed evidence silently.", "Any receipt is incomplete, fabricated or bound to wrong commit."),
    task("OP-16", "STAGING_DESTRUCTION_AUTHORIZATION", ["approved staging expiry reached or owner stop"], [
      "Follow release/wp13-12b/activation-handoff/destruction-plan.json in order",
    ], "Preview, functions, database, secret, IAM and isolated project are removed or expiration is evidenced.", ["destruction transcript", "final zero-resource confirmation"], "Not applicable; destruction is the exit path.", "Required evidence or minimum tombstone export is not secured."),
  ],
};

const receiptTypes = [
  "EMULATOR_PROOF_RECEIPT",
  "FIREBASE_PROJECT_AND_REGION_RECEIPT",
  "IAM_AND_BILLING_RECEIPT",
  "PROTECTED_PREVIEW_RECEIPT",
  "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
];

const receiptContracts = {
  schemaVersion: "wp13.12b-receipt-contracts-v1",
  status: "CONTRACTS_ONLY_NO_RECEIPTS_CREATED",
  externalReceipts: 0,
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
    "synthetic or fabricated completed status",
    "missing actual commands",
    "physical proof without two device records",
    "receipt that opens B8, student beta or production",
  ],
};

const receiptTemplate = (receiptType) => ({
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
});

const physicalProofTemplate = {
  schemaVersion: "wp13.12b-physical-two-device-proof-v1",
  status: "UNFILLED_TEMPLATE_NOT_EVIDENCE",
  templateMarker: "UNFILLED_TEMPLATE_NOT_EVIDENCE",
  performed: false,
  sourceCommit: "",
  sourceTree: "",
  stagingUrl: "",
  sessionFixture: "synthetic-wp13-12b-only",
  devices: [
    { role: "CHILD", deviceType: "", operatingSystem: "", browser: "", observedAt: "" },
    { role: "ADULT", deviceType: "", operatingSystem: "", browser: "", observedAt: "" },
  ],
  steps: [
    "Verify protected preview and SYNTHETIC ONLY marking",
    "Issue separate CHILD and ADULT capabilities for the same session",
    "Prove WAIT and help projection isolation",
    "Interrupt network and reconnect",
    "Send delayed and stale-state commands",
    "Prove STOP dominates pending actions and audio",
    "Explicitly delete active payload and create tombstone",
    "Reconnect both devices and prove no-resurrection",
    "Activate kill switch and prove cached capability rejection",
    "Rollback provider revision without lowering controlEpoch",
    "Clear browser memory/cache and close the staging run",
  ],
  stepResults: [],
  screenshotsOrVideo: [],
  containsPersonData: false,
  checksum: "",
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
    "withdrawn provider revision cannot be selected",
    "schemaVersion must be compatible",
    "tombstone dominates cached or rolled-back state",
    "pure core and in-memory adapter remain runnable without provider package",
  ],
  steps: [
    "Set stagingEnabled=false and increment controlEpoch",
    "Verify active, delayed, reconnect and cached-capability commands are denied",
    "Select only a checksum-verified compatible provider revision",
    "Deploy only under separate external deployment authorization",
    "Re-run STOP, deletion, tombstone and no-resurrection proof",
  ],
  externalActionsExecuted: false,
};

const destructionPlan = {
  schemaVersion: "wp13.12b-staging-destruction-v1",
  status: "UNEXECUTED_PLAN",
  triggers: [
    "approved staging expiry date",
    "owner stop",
    "cost or security stop condition",
    "completion of authorized technical proof",
  ],
  orderedSteps: [
    "disable staging and advance controlEpoch",
    "explicitly delete all active synthetic session payloads",
    "verify minimum tombstones and evidence retention decision",
    "remove protected preview",
    "remove Functions and Firestore Rules only under authorization",
    "destroy server secret versions and revoke IAM",
    "delete database and isolated project under authorization",
    "verify provider inventory is zero and sign destruction evidence",
  ],
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
  warnings: unresolvedOwnerFields.map((field) => `${field} unresolved; external activation remains blocked`),
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
    reproducibleBuildDigest: "f489e119d859dd09870d747eb00c3c071d19f08461f0684eae39a7a42d3d7997",
    cleanCopies: 2,
  },
  baselineDeviations: 0,
};

const providerFactsArtifact = {
  schemaVersion: "wp13.12b-provider-fact-proof-v1",
  checkedAt: "2026-07-25",
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

async function writeJson(path, value) {
  const target = new URL(`../${path.replaceAll("\\", "/")}`, import.meta.url);
  await mkdir(dirname(fileURLToPath(target)), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

for (const [path, value] of files) await writeJson(path, value);

const checksumTargets = [
  ...files.keys(),
  "docs/WP13_12B_SYNTHETIC_STAGING_REPOSITORY_AND_ACTIVATION_HANDOFF.md",
  "release/wp13-12b/provider-audit.json",
  "release/wp13-12b/provider-sbom.cdx.json",
  "release/wp13-12b/provider-license-inventory.json",
  "release/wp13-12b/reproducible-build.json",
  "provider/firebase/.firebaserc.example",
  "provider/firebase/firebase.json",
  "provider/firebase/firestore.indexes.json",
  "provider/firebase/firestore.rules",
  "provider/firebase/staging.env.example",
  "provider/firebase/functions/package.json",
  "provider/firebase/functions/package-lock.json",
  "provider/firebase/functions/index.mjs",
  "provider/firebase/functions/firestore-store.mjs",
  "provider/firebase/functions/src/authoritative-handler.ts",
  "provider/firebase/functions/src/in-memory-store.ts",
  "provider/firebase/tools/seed-synthetic-fixtures.mjs",
  "provider/firebase/tools/set-staging-control.mjs",
  "scripts/run-wp13-12b-emulator-proof.mjs",
  "scripts/validate-wp13-12b-receipt.mjs",
  "src/core/synthetic-staging.ts",
  "src/core/staging-validation.ts",
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
].sort();

const checksumLines = [];
for (const path of checksumTargets) {
  const content = await readFile(new URL(`../${path}`, import.meta.url));
  checksumLines.push(`${createHash("sha256").update(content).digest("hex")}  ${path}`);
}
await writeFile(
  new URL(`../${releaseRoot}/artifact-checksums.sha256`, import.meta.url),
  `${checksumLines.join("\n")}\n`,
  "utf8",
);

console.log(`WP13.12B staging repository package generated deterministically (${checksumTargets.length} checksummed files).`);
