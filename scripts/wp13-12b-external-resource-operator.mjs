import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  link,
  lstat,
  open,
  readFile,
  readdir,
  realpath,
  unlink,
} from "node:fs/promises";
import {
  lstatSync,
  realpathSync,
} from "node:fs";
import { createRequire } from "node:module";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertRecordedSyntheticDeletionWindow,
  assertSyntheticDeletionWindow,
  deployDeletionRunServiceScope,
  deployIdentityAuthorityStates,
  deployIdentityScope,
  SYNTHETIC_DELETION_GRACE_END,
  syntheticDeletionWindowCondition,
} from "./wp13-12b-deploy-identity.mjs";
import {
  runDeployIdentityControl,
} from "./provider-external-deploy-identity-control.mjs";
import {
  createPinnedGoogleCloudCliExecFile,
} from "./wp13-12b-external-process-boundary.mjs";
import {
  acquireCleanupActivationCapability,
  assertCleanupActivationCapability,
} from "./wp13-12b-activation-phase-gate.mjs";
import {
  approvedVercelCliModuleRoot,
  inspectPinnedVercelCli,
  verifyPinnedVercelCliSnapshot,
} from "./wp13-12b-vercel-cli-toolchain.mjs";

const nativeFetch = globalThis.fetch.bind(globalThis);
const commonRequire = createRequire(import.meta.url);
const {
  acquirePinnedGoogleOAuthAccessToken,
} = commonRequire("./wp13-12b-google-oauth-token-helper.cjs");
let isolatedOAuthAccessTokenPromise;

export const APPROVED_VERCEL_CLI_AUTH_CONFIG_ROOT =
  "C:\\Users\\tryak\\AppData\\Local\\com.vercel.cli";

export const APPROVED_SCOPE = Object.freeze({
  projectId: "ludys-12b-stg-20260725",
  projectNumber: "134654966474",
  organizationId: "724335528970",
  billingAccount: "01CD9D-0900DF-4FB36A",
  approvedGoogleAccount: "tryakim@gmail.com",
  region: "europe-north1",
  stagingExpiryDate: "2027-01-25",
  runtimeServiceAccount:
    "ludys-staging-runtime@ludys-12b-stg-20260725.iam.gserviceaccount.com",
  capabilitySecret: "LUDYS_CAPABILITY_HMAC_KEY",
  workloadIdentityPoolId: "ludys-vercel-preview",
  workloadIdentityProviderId: "vercel-preview",
  previewServiceAccount:
    "ludys-preview-invoker@ludys-12b-stg-20260725.iam.gserviceaccount.com",
  vercelTeamId: "team_1Gnn3VSNrP3mbseXx6a92a4J",
  vercelTeamSlug: "trym-s-projects",
  vercelProjectId: "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
  vercelProjectName: "ludys-wp13-12b-staging",
});

export const EXECUTION_AUTHORIZATION = Object.freeze({
  syntheticDataDeletion:
    "AUTHORIZE_WP13_12B_SYNTHETIC_DATA_DELETION_EXECUTION;"
    + "project=ludys-12b-stg-20260725;expiry=2027-01-25;"
    + "scope=bounded-synthetic-session-delete",
  deactivation:
    "AUTHORIZE_WP13_12B_DEACTIVATION_EXECUTION;ludys-12b-stg-20260725;expiry=2027-01-25",
  vercelDestruction:
    "AUTHORIZE_WP13_12B_VERCEL_DESTRUCTION_EXECUTION;"
    + "team=team_1Gnn3VSNrP3mbseXx6a92a4J;"
    + "project=prj_nHs1hbdyfcMMMglNUTwoYRS43naN;expiry=2027-01-25",
  destruction:
    "AUTHORIZE_WP13_12B_DESTRUCTION_EXECUTION;ludys-12b-stg-20260725;expiry=2027-01-25",
});

const SYNTHETIC_TOMBSTONE_RETENTION_DISPOSITION =
  "RETAIN_MINIMUM_TOMBSTONES_UNTIL_FINAL_ZERO_RESOURCE_EVIDENCE";
const SYNTHETIC_DATA_DELETION_CONFIRMATION_TEMPLATE =
  "CONFIRM_WP13_12B_SYNTHETIC_DATA_DELETION;"
  + "projectId=<projectId>;stagingExpiryDate=<stagingExpiryDate>;"
  + "operatorGoogleAccount=<operatorGoogleAccount>;controlEpoch=<controlEpoch>;"
  + "activeSyntheticSessionCount=<activeSyntheticSessionCount>;"
  + "activeCapabilityGrantCount=<activeCapabilityGrantCount>;"
  + "tombstoneCount=<tombstoneCount>;"
  + "tombstoneRetentionDisposition=<tombstoneRetentionDisposition>;"
  + "observedAt=<observedAt>;"
  + "observedSyntheticDataInventoryDigest="
  + "<observedSyntheticDataInventoryDigest>;"
  + "syntheticDataDeletionIntentSha256="
  + "<syntheticDataDeletionIntentSha256>;"
  + "syntheticDataDeletionExecutionReceiptSha256="
  + "<syntheticDataDeletionExecutionReceiptSha256>";
const VERCEL_DESTRUCTION_CONFIRMATION_TEMPLATE =
  "CONFIRM_WP13_12B_VERCEL_PROJECT_ABSENCE;"
  + "teamId=<teamId>;vercelProjectId=<vercelProjectId>;"
  + "vercelProjectName=<vercelProjectName>;observedAt=<observedAt>;"
  + "canonicalAbsenceEvidenceDigest=<canonicalAbsenceEvidenceDigest>;"
  + "deactivationReceiptSha256=<deactivationReceiptSha256>;"
  + "syntheticDataDeletionEvidenceSha256="
  + "<syntheticDataDeletionEvidenceSha256>;"
  + "syntheticDataDeletionConfirmationSha256="
  + "<syntheticDataDeletionConfirmationSha256>";
const CONFIRMATION_RECORDER_CLASSIFICATION =
  "EXPLICIT_LOCAL_PHRASE_ENTRY_NO_ACTOR_IDENTITY_OR_SIGNATURE_CLAIM";

export function syntheticDataDeletionConfirmationText(value) {
  return (
    "CONFIRM_WP13_12B_SYNTHETIC_DATA_DELETION;"
    + `projectId=${value?.projectId};`
    + `stagingExpiryDate=${value?.stagingExpiryDate};`
    + `operatorGoogleAccount=${value?.operatorGoogleAccount};`
    + `controlEpoch=${value?.controlEpoch};`
    + `activeSyntheticSessionCount=${value?.activeSyntheticSessionCount};`
    + `activeCapabilityGrantCount=${value?.activeCapabilityGrantCount};`
    + `tombstoneCount=${value?.tombstoneCount};`
    + `tombstoneRetentionDisposition=${value?.tombstoneRetentionDisposition};`
    + `observedAt=${value?.observedAt};`
    + "observedSyntheticDataInventoryDigest="
    + `${value?.observedSyntheticDataInventoryDigest};`
    + "syntheticDataDeletionIntentSha256="
    + `${value?.syntheticDataDeletionIntentSha256};`
    + "syntheticDataDeletionExecutionReceiptSha256="
    + `${value?.syntheticDataDeletionExecutionReceiptSha256}`
  );
}

export const APPROVED_TRUST = Object.freeze({
  issuer: "https://oidc.vercel.com/trym-s-projects",
  audience: "https://vercel.com/trym-s-projects",
  subject:
    "owner:trym-s-projects:project:ludys-wp13-12b-staging:environment:preview",
  attributeMapping: Object.freeze({
    "attribute.environment": "assertion.environment",
    "attribute.owner_id": "assertion.owner_id",
    "attribute.project_id": "assertion.project_id",
    "google.subject": "assertion.sub",
  }),
  attributeCondition:
    "attribute.owner_id == 'team_1Gnn3VSNrP3mbseXx6a92a4J'"
    + " && attribute.project_id == 'prj_nHs1hbdyfcMMMglNUTwoYRS43naN'"
    + " && attribute.environment == 'preview'"
    + " && google.subject == "
    + "'owner:trym-s-projects:project:ludys-wp13-12b-staging:environment:preview'",
});

const APPROVED_FUNCTIONS = new Set([
  "deleteSyntheticSession",
  "health",
  "issueSyntheticSession",
  "sessionCommand",
  "sessionProjection",
]);
const APPROVED_RUN_SERVICES = new Set(
  [...APPROVED_FUNCTIONS].map((name) => name.toLowerCase()),
);
const APPROVED_DEPLOY_SERVICE_ACCOUNT =
  "ludys-staging-deployer@ludys-12b-stg-20260725.iam.gserviceaccount.com";
const APPROVED_BUILD_SERVICE_ACCOUNT =
  "134654966474-compute@developer.gserviceaccount.com";
const REQUIRED_ENABLED_SERVICES = new Set([
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
]);
const APPROVED_FIRESTORE_ROOT_COLLECTIONS = new Set([
  "syntheticCapabilityGrants",
  "syntheticSessions",
  "syntheticSessionTombstones",
  "syntheticStagingControl",
]);
const APPROVED_FIRESTORE_DATA_COLLECTIONS = [
  "syntheticCapabilityGrants",
  "syntheticSessions",
  "syntheticSessionTombstones",
];
const CONTROL_DISABLED_REASONS = new Set([
  "COST_KILL_SWITCH",
  "EXPIRY_DESTRUCTION",
  "OWNER_STOP",
  "PROOF_WINDOW_CLOSED",
  "ROLLBACK",
  "SECURITY_KILL_SWITCH",
]);
const PRIVATE_PREVIEW_INVOKER_FUNCTIONS = new Set([
  "deleteSyntheticSession",
  "issueSyntheticSession",
]);
const PRIVATE_PREVIEW_INVOKER_RUN_SERVICES = new Set(
  [...PRIVATE_PREVIEW_INVOKER_FUNCTIONS].map((name) => name.toLowerCase()),
);
const ALL_PRIVATE_FUNCTIONS = new Set([
  ...PRIVATE_PREVIEW_INVOKER_FUNCTIONS,
  "health",
]);
const ALL_PRIVATE_RUN_SERVICES = new Set(
  [...ALL_PRIVATE_FUNCTIONS].map((name) => name.toLowerCase()),
);
const PUBLIC_BEARER_RUN_SERVICES = new Set([
  "sessioncommand",
  "sessionprojection",
]);

const FORBIDDEN_SERVICES = new Set([
  "aiplatform.googleapis.com",
  "firebaseanalytics.googleapis.com",
  "firebaseauth.googleapis.com",
  "firebasecrashlytics.googleapis.com",
  "firebaseperformance.googleapis.com",
  "firebaseremoteconfig.googleapis.com",
  "generativelanguage.googleapis.com",
  "identitytoolkit.googleapis.com",
]);

const LOCAL_PATHS = Object.freeze({
  approval: "release/wp13-12b/external-activation/cloud-field-approval.json",
  ownerAuthorization: "release/wp13-12b/external-activation/owner-authorization.json",
  inventoryContract:
    "release/wp13-12b/external-activation/resource-inventory-contract.json",
  executionContract:
    "release/wp13-12b/external-activation/expiry-destruction-execution-contract.json",
  destructionPlan: "release/wp13-12b/activation-handoff/destruction-plan.json",
  trustContract:
    "release/wp13-12b/external-activation/vercel-google-trust-contract.json",
});
export const EXECUTION_EVIDENCE_PATHS = Object.freeze({
  syntheticDataDeletionIntent:
    "release/wp13-12b/receipts/actual/"
    + "synthetic-data-deletion-intent.json",
  syntheticDataDeletionExecution:
    "release/wp13-12b/receipts/actual/"
    + "synthetic-data-deletion-execution-receipt.json",
  syntheticDataDeletion:
    "release/wp13-12b/receipts/actual/synthetic-data-deletion-evidence.json",
  syntheticDataDeletionConfirmation:
    "release/wp13-12b/receipts/actual/"
    + "synthetic-data-deletion-confirmation.json",
  deactivation:
    "release/wp13-12b/receipts/actual/deactivation-execution-receipt.json",
  previewDestruction:
    "release/wp13-12b/receipts/actual/preview-destruction-evidence.json",
  previewDestructionConfirmation:
    "release/wp13-12b/receipts/actual/"
    + "preview-destruction-confirmation.json",
});
const SYNTHETIC_DELETION_INTENT_KEYS = Object.freeze([
  "action",
  "capabilitiesPersistedOrPrinted",
  "capabilityGrantsObservedBefore",
  "controlEpoch",
  "expectedPostTombstoneCount",
  "expectedPostTombstoneSetSha256",
  "externalWrites",
  "grantRelationshipDigest",
  "identityTokenPrintedOrPersisted",
  "immutableIntent",
  "initialStateClassification",
  "initialWindowExpiresAt",
  "observedAt",
  "operatorGoogleAccount",
  "payloadsPersistedOrPrinted",
  "preDeletionInventoryDigest",
  "preDeletionSessionSetSha256",
  "preDeletionSyntheticDataInventoryDigest",
  "preDeletionTombstoneSetSha256",
  "projectId",
  "schemaVersion",
  "sessionIdentifiersPersistedOrPrinted",
  "stagingExpiryDate",
  "syntheticSessionsObservedBefore",
  "tombstonesObservedBefore",
  "workloadIdentityPoolDisabledObserved",
  "workloadIdentityProviderDisabledObserved",
].sort());
const SYNTHETIC_DELETION_EXECUTION_RECEIPT_KEYS = Object.freeze([
  "action",
  "authenticatedReadbackAfter",
  "authenticatedReadbackBefore",
  "capabilitiesPersistedOrPrinted",
  "capabilityGrantsObservedAfter",
  "capabilityGrantsObservedBefore",
  "controlEpoch",
  "deleteInvocationsCompletedThisRun",
  "deletionIntentSha256",
  "deletionIdentityAuthorityStateAfter",
  "deletionIdentityDownscopeReadbackSha256",
  "deletionIdentityRevokeReadbackSha256",
  "deletionIdentityRevokedBeforeReceiptWrite",
  "deployIdentityWindowVerified",
  "executionClassification",
  "externalWritesThisRun",
  "identityTokenPrintedOrPersisted",
  "identityDownscopeExternalWritesThisRun",
  "identityRevokeExternalWritesThisRun",
  "newlyObservedTombstoneSetSha256",
  "observedAt",
  "operatorGoogleAccount",
  "payloadsPersistedOrPrinted",
  "postDeletionInventoryDigest",
  "postDeletionSyntheticDataInventoryDigest",
  "postDeletionTombstoneSetSha256",
  "postRevokeInventoryDigest",
  "preDeletionInventoryDigest",
  "preDeletionSessionSetSha256",
  "preDeletionSyntheticDataInventoryDigest",
  "projectId",
  "schemaVersion",
  "sessionIdentifiersPersistedOrPrinted",
  "stagingExpiryDate",
  "syntheticSessionsObservedAfter",
  "syntheticSessionsObservedBefore",
  "syntheticSessionsObservedThisRunBefore",
  "tombstonesObservedAfter",
  "tombstonesObservedBefore",
  "windowExpiresAt",
  "workloadIdentityPoolDisabledObserved",
  "workloadIdentityProviderDisabledObserved",
].sort());
const SYNTHETIC_DELETION_EVIDENCE_KEYS = Object.freeze([
  "activeCapabilityGrantCount",
  "activeSyntheticSessionCount",
  "allActiveSyntheticSessionPayloadsDeleted",
  "controlEpoch",
  "evidenceStatus",
  "externalWrites",
  "humanConfirmationSha256",
  "humanConfirmationText",
  "humanConfirmed",
  "observedAt",
  "observedSyntheticDataInventoryDigest",
  "operatorGoogleAccount",
  "projectId",
  "requiredHumanAction",
  "schemaVersion",
  "stagingExpiryDate",
  "syntheticDataDeletionExecutionReceiptSha256",
  "syntheticDataDeletionIntentSha256",
  "tombstoneAndRetentionDecisionSecured",
  "tombstoneCount",
  "tombstoneRetentionDisposition",
].sort());
const MAX_PROVIDER_INVENTORY_PAGES = 100;
const MAX_PROVIDER_INVENTORY_RESOURCES = 10_000;
const MAX_WIF_POOLS_FOR_PROVIDER_FANOUT = 1;
const MAX_FIRESTORE_DOCUMENTS_FOR_NESTED_SCAN = 256;
const PROVIDER_REQUEST_TIMEOUT_MS = 15_000;
const EXPIRY_DESTRUCTION_ACTION_IDS = Object.freeze([
  "CONTROL_FALSE_EPOCH_STRICTLY_ADVANCED",
  "TIME_BOUNDED_KEYLESS_DEPLOY_IDENTITY_PROVISIONED_AND_VERIFIED",
  "EXACT_PREVIEW_ORIGIN_CONFIGURED_WITH_ISSUANCE_FALSE",
  "SAFE_DISABLED_FUNCTION_SET_DEPLOYED_AND_READ_BACK",
  "TIME_BOUNDED_DEPLOY_IDENTITY_DOWNSCOPED_TO_SYNTHETIC_DELETION_ONLY_AND_VERIFIED",
  "SYNTHETIC_DELETION_INTENT_RECORDED_AND_PAYLOADS_DELETED_OR_AUTHENTICATED_TOMBSTONE_HISTORY_NO_OP",
  "DELETION_ONLY_IDENTITY_REVOKED_IN_GUARANTEED_FINALLY_AND_VERIFIED",
  "SYNTHETIC_ZERO_STATE_EVIDENCE_AND_HUMAN_CONFIRMATION_SECURED",
  "WIF_PROVIDER_DISABLED_THEN_POOL_DISABLED_AND_BOTH_VERIFIED",
  "DEACTIVATION_RECEIPT_MATERIALIZED_AT_OR_AFTER_EXPIRY",
  "EXACT_VERCEL_PROJECT_DELETED",
  "EXACT_VERCEL_ABSENCE_AUTHENTICATED_AND_HUMAN_CONFIRMED",
  "FRESH_POST_VERCEL_COMBINED_INVENTORY_CONFIRMED",
  "GOOGLE_DESTRUCTION_MATERIALIZED_FOR_OBSERVED_APPROVED_REMAINDER",
  "FRESH_COMBINED_ZERO_RESOURCE_INVENTORY_VERIFIED",
]);
const SAFE_BACKEND_EVIDENCE_ASSERTIONS = Object.freeze([
  "stagingEnabled=false at a strictly advanced controlEpoch",
  "only the time-bounded keyless deploy identity was provisioned and verified",
  "the exact receipt-bound preview origin was configured with issueSyntheticSession issuance=false",
  "the safe-disabled function set was deployed and read back before trust removal",
  "all broad deploy authority was replaced by the exact time-bounded deletion-only identity and verified",
]);
const FIRESTORE_VALUE_TYPES = new Set([
  "arrayValue",
  "booleanValue",
  "bytesValue",
  "doubleValue",
  "geoPointValue",
  "integerValue",
  "mapValue",
  "nullValue",
  "referenceValue",
  "stringValue",
  "timestampValue",
]);
const EXPECTED_SESSION_RELEASE_IDS = Object.freeze({
  appVersion: "0.14.0-reconstructed.9",
  audioReleaseId: "wp13-9-audio-specifications-r1",
  contentReleaseId: "wp13-8-authentic-draft-corpus-r1",
  knowledgeReleaseId: "release-knowledge-audio-prototype-001",
  operationsReleaseId: "wp13-11-operations-kit-r1",
  providerDecisionReleaseId: "wp13-12a-provider-decision-r1",
  schemaVersion: "wp13.12b-synthetic-staging-v1",
  stagingProviderReleaseId: "wp13-12b-synthetic-staging-provider-r1",
});
const FIRESTORE_DOCUMENT_SCHEMAS = Object.freeze({
  syntheticCapabilityGrants: Object.freeze({
    dataClassification: "SYNTHETIC_CAPABILITY_METADATA",
    fields: Object.freeze({
      dataClassification: "stringValue",
      expiresAt: "timestampValue",
      nonce: "stringValue",
      remainingCommands: "integerValue",
      revoked: "booleanValue",
      role: "stringValue",
      syntheticSessionId: "stringValue",
    }),
  }),
  syntheticSessions: Object.freeze({
    dataClassification: "SYNTHETIC_ONLY_NO_PARTICIPANT_DATA",
    fields: Object.freeze({
      authorityGeneration: "integerValue",
      coarseTechnicalStatus: "stringValue",
      controlEpoch: "integerValue",
      dataClassification: "stringValue",
      expiresAt: "timestampValue",
      processedCommandIds: "arrayValue",
      releaseIds: "mapValue",
      stateVersion: "integerValue",
      syntheticSessionId: "stringValue",
      syntheticSessionState: "mapValue",
      tombstone: "booleanValue",
    }),
  }),
  syntheticSessionTombstones: Object.freeze({
    dataClassification: "MINIMUM_NO_RESURRECTION_TOMBSTONE",
    fields: Object.freeze({
      controlEpoch: "integerValue",
      dataClassification: "stringValue",
      deletedAt: "timestampValue",
      noResurrection: "booleanValue",
      syntheticSessionId: "stringValue",
      terminalAuthorityGeneration: "integerValue",
      terminalStateVersion: "integerValue",
    }),
  }),
});

const rootUrl = new URL("../", import.meta.url);
const repositoryRootPath = fileURLToPath(rootUrl);
const exactChildScriptPaths = Object.freeze({
  setStagingControl: fileURLToPath(
    new URL(
      "provider/firebase/tools/set-staging-control.mjs",
      rootUrl,
    ),
  ),
  wifControl: fileURLToPath(
    new URL(
      "scripts/provider-external-wif-control.mjs",
      rootUrl,
    ),
  ),
});
const INVENTORY_EVIDENCE_OUTPUT =
  "artifacts/wp13-12b-external-resource-inventory.json";

function operatorError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function assertProductionCleanupAuthority(capability) {
  return assertCleanupActivationCapability(capability);
}

const syntheticDeletionInMemoryAdapters = new WeakMap();
const deactivationInMemoryAdapters = new WeakMap();

function cloneDeclarativeTestValue(value, path = "script") {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (
      typeof value === "number"
      && Number.isFinite(value)
    )
  ) return value;
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      cloneDeclarativeTestValue(entry, `${path}[${index}]`));
  }
  if (
    typeof value !== "object"
    || Object.getPrototypeOf(value) !== Object.prototype
  ) throw operatorError("DECLARATIVE_IN_MEMORY_TEST_SCRIPT_REQUIRED");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some((descriptor) => (
    typeof descriptor.get === "function"
    || typeof descriptor.set === "function"
  ))) throw operatorError("DECLARATIVE_IN_MEMORY_TEST_SCRIPT_REQUIRED");
  const clone = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (
      key === "__proto__"
      || typeof descriptor.value === "function"
      || typeof descriptor.value === "symbol"
      || typeof descriptor.value === "bigint"
      || descriptor.value === undefined
    ) throw operatorError("DECLARATIVE_IN_MEMORY_TEST_SCRIPT_REQUIRED");
    clone[key] = cloneDeclarativeTestValue(
      descriptor.value,
      `${path}.${key}`,
    );
  }
  return clone;
}

function exactDeclarativeKeys(value, expected) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort())
      === JSON.stringify([...expected].sort())
  );
}

function scriptedValue(queue, code) {
  if (!Array.isArray(queue) || queue.length === 0) {
    throw operatorError(code);
  }
  const step = queue.shift();
  if (
    !exactDeclarativeKeys(
      step,
      step?.errorCode === undefined ? ["value"] : ["errorCode"],
    )
  ) throw operatorError("DECLARATIVE_IN_MEMORY_TEST_SCRIPT_REQUIRED");
  if (step.errorCode !== undefined) {
    throw operatorError(String(step.errorCode));
  }
  return structuredClone(step.value);
}

export function createSyntheticDeletionInMemoryTestAdapter(script) {
  const value = cloneDeclarativeTestValue(script);
  const expectedKeys = [
    "allowDeleteInvoker",
    "deleteResults",
    "downscopeSteps",
    "evidenceWriteMode",
    "inventories",
    "now",
    "optionalEvidence",
    "revokeSteps",
  ];
  if (
    !exactDeclarativeKeys(value, expectedKeys)
    || !Number.isFinite(Date.parse(value.now))
    || new Date(value.now).toISOString() !== value.now
    || !Array.isArray(value.inventories)
    || !Array.isArray(value.downscopeSteps)
    || !Array.isArray(value.revokeSteps)
    || !Array.isArray(value.deleteResults)
    || typeof value.allowDeleteInvoker !== "boolean"
    || !["CAPTURE", "REJECT"].includes(value.evidenceWriteMode)
    || value.optionalEvidence === null
    || typeof value.optionalEvidence !== "object"
    || Array.isArray(value.optionalEvidence)
  ) throw operatorError("DECLARATIVE_IN_MEMORY_TEST_SCRIPT_REQUIRED");
  const adapter = Object.freeze({});
  syntheticDeletionInMemoryAdapters.set(adapter, {
    script: value,
    transcript: {
      events: [],
      evidenceWrites: [],
      deleteInvocationCount: 0,
    },
  });
  return adapter;
}

export function createDeactivationInMemoryTestAdapter(script) {
  const value = cloneDeclarativeTestValue(script);
  if (
    !exactDeclarativeKeys(value, [
      "commands",
      "inventories",
      "repeatLastInventory",
      "syntheticDataDeletionConfirmation",
      "syntheticDataDeletionEvidence",
    ])
    || !Array.isArray(value.commands)
    || !Array.isArray(value.inventories)
    || typeof value.repeatLastInventory !== "boolean"
  ) throw operatorError("DECLARATIVE_IN_MEMORY_TEST_SCRIPT_REQUIRED");
  const adapter = Object.freeze({});
  deactivationInMemoryAdapters.set(adapter, {
    script: value,
    transcript: {
      commandSteps: [],
      inventoryReadCount: 0,
    },
  });
  return adapter;
}

export function readExternalResourceOperatorInMemoryTestTranscript(adapter) {
  const state = syntheticDeletionInMemoryAdapters.get(adapter)
    ?? deactivationInMemoryAdapters.get(adapter);
  if (state === undefined) {
    throw operatorError("MODULE_CREATED_IN_MEMORY_TEST_ADAPTER_REQUIRED");
  }
  return structuredClone(state.transcript);
}

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, rootUrl), "utf8"));
}

function normalizeProjectNumber(value) {
  const text = String(value ?? "").replace(/^projects\//u, "");
  if (!/^[0-9]{6,20}$/u.test(text)) throw operatorError("VALID_PROJECT_NUMBER_REQUIRED");
  return text;
}

function normalizeBucketName(value) {
  return String(value ?? "").replace(/^gs:\/\//u, "");
}

function resourceId(value) {
  const text = String(value ?? "");
  return text.split("/").filter(Boolean).at(-1) ?? "";
}

function locationFromName(value) {
  const match = String(value ?? "").match(/\/locations\/([^/]+)/u);
  return match?.[1] ?? "";
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(stableValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

function digestValue(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function syntheticDataDeletionInventoryBinding(inventory) {
  const collections =
    inventory?.resources?.firestoreDataInventory?.collections ?? [];
  const control = inventory?.resources?.firestoreDataInventory?.control;
  const collection = (collectionId) =>
    collections.find((entry) => entry.collectionId === collectionId);
  const sessions = collection("syntheticSessions");
  const grants = collection("syntheticCapabilityGrants");
  const tombstones = collection("syntheticSessionTombstones");
  if (
    inventory?.schemaVersion
      !== "wp13.12b-ea-operator-resource-inventory-v2"
    || ![
      "SYNTHETIC_DELETION_AUTHORIZED",
      "SYNTHETIC_DELETION_REVOKED_READBACK",
      "SAFE_BACKEND_FOR_DESTRUCTION",
      "POST_DEACTIVATION_DESTRUCTION_IN_PROGRESS",
    ].includes(inventory?.inventoryLifecyclePhase)
    || !Number.isSafeInteger(control?.controlEpoch)
    || sessions === undefined
    || grants === undefined
    || tombstones === undefined
    || ![sessions, grants, tombstones].every(
      (entry) =>
        Number.isSafeInteger(entry.count)
        && entry.count >= 0
        && Array.isArray(entry.documentNames)
        && entry.count === entry.documentNames.length,
    )
  ) {
    throw operatorError(
      "SAFE_BACKEND_SYNTHETIC_DATA_INVENTORY_BINDING_REQUIRED",
    );
  }
  const binding = {
    projectId: APPROVED_SCOPE.projectId,
    stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
    controlEpoch: control.controlEpoch,
    controlChangedAt: control.changedAt,
    controlUpdateTime: control.updateTime,
    activeSyntheticSessionCount: sessions.count,
    activeCapabilityGrantCount: grants.count,
    tombstoneCount: tombstones.count,
    tombstoneDocumentNames: [...tombstones.documentNames].sort(),
  };
  return {
    inventoryPhase: inventory.inventoryLifecyclePhase,
    ...binding,
    observedSyntheticDataInventoryDigest: digestValue(binding),
  };
}

function syntheticCollection(inventory, collectionId) {
  return (
    inventory?.resources?.firestoreDataInventory?.collections ?? []
  ).find((entry) => entry.collectionId === collectionId);
}

function exactSyntheticDocumentIds(inventory, collectionId) {
  const collection = syntheticCollection(inventory, collectionId);
  const prefix =
    `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
    + `${collectionId}/`;
  if (
    collection === undefined
    || !Array.isArray(collection.documentNames)
    || collection.documentNames.length !== collection.count
  ) {
    throw operatorError("EXACT_SYNTHETIC_DOCUMENT_INVENTORY_REQUIRED");
  }
  const ids = collection.documentNames.map((name) => (
    typeof name === "string" && name.startsWith(prefix)
      ? name.slice(prefix.length)
      : ""
  ));
  if (
    ids.some((id) => id.length === 0 || id.includes("/"))
    || new Set(ids).size !== ids.length
  ) throw operatorError("EXACT_SYNTHETIC_DOCUMENT_INVENTORY_REQUIRED");
  return ids;
}

export function validateSyntheticDeletionAuthorizedInventory(
  inventory,
  windowExpiresAt,
) {
  const binding = syntheticDataDeletionInventoryBinding(inventory);
  const functions = inventory?.resources?.functions ?? [];
  const control = inventory?.resources?.firestoreDataInventory?.control;
  const identity = inventory?.resources?.workloadIdentityFederation ?? {};
  const pools = identity.pools ?? [];
  const providers = identity.providers ?? [];
  const sessionIds = exactSyntheticDocumentIds(
    inventory,
    "syntheticSessions",
  );
  const tombstoneIds = new Set(exactSyntheticDocumentIds(
    inventory,
    "syntheticSessionTombstones",
  ));
  const issueFunction = functions.find(
    (fn) => fn.name === "issueSyntheticSession",
  );
  const deleteFunction = functions.find(
    (fn) => fn.name === "deleteSyntheticSession",
  );
  const grantRelationship =
    inventory?.resources?.firestoreDataInventory
      ?.grantRelationshipEvidence;
  let deletionWindowCondition;
  try {
    deletionWindowCondition =
      syntheticDeletionWindowCondition(windowExpiresAt);
  } catch {
    throw operatorError(
      "FRESH_AUTHENTICATED_SYNTHETIC_DELETION_INVENTORY_REQUIRED",
    );
  }
  const deployMember =
    `serviceAccount:${APPROVED_DEPLOY_SERVICE_ACCOUNT}`;
  const deployAccount = (
    inventory?.resources?.serviceAccounts ?? []
  ).find(
    (account) => account.email === APPROVED_DEPLOY_SERVICE_ACCOUNT,
  );
  const serviceAccountBindings =
    inventory?.resources?.serviceAccountIamBindings ?? {};
  const deployResourceBindings = serviceAccountBindings.deploy ?? [];
  const deleteRunPolicy = (
    identity.runIamBindings ?? []
  ).find(
    (binding) =>
      binding.serviceId.toLowerCase() === "deletesyntheticsession",
  );
  const exactDeletionRunInvoker = (
    deleteRunPolicy?.bindings?.filter((binding) => (
      binding.role === "roles/run.invoker"
      && binding.members.length === 1
      && binding.members[0] === deployMember
      && exactNormalizedIamCondition(
        binding.condition,
        deletionWindowCondition,
      )
    )).length === 1
  );
  const organizationIamScopeEvidence =
    inventory?.resources?.organizationIamScopeEvidence;
  const inheritedDeployAuthorityAbsent =
    exactOrganizationIamScopeAbsence(
      organizationIamScopeEvidence,
    );
  const indirectProjectDeployAuthorityAbsent =
    exactProjectIamScopeAbsence(
      inventory?.resources?.projectIamScopeEvidence,
    );
  const deployMemberAbsentFromOtherResourcePolicies = [
    inventory?.resources?.capabilitySecretIamBindings ?? [],
    inventory?.resources?.buildIdentityResourceIamBindings
      ?.functionArtifactRepository ?? [],
    inventory?.resources?.buildIdentityResourceIamBindings
      ?.functionSourceBucket ?? [],
    serviceAccountBindings.runtime ?? [],
    serviceAccountBindings.build ?? [],
  ].every((bindings) => bindings.every(
    (binding) => !binding.members.includes(deployMember),
  ));
  const valid = (
    inventory?.schemaVersion
      === "wp13.12b-ea-operator-resource-inventory-v2"
    && inventory?.mode === "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION"
    && inventory?.source === "LIVE_READ_ONLY_PROVIDER_QUERIES"
    && inventory?.externalWrites === 0
    && inventory?.inventoryLifecyclePhase
      === "SYNTHETIC_DELETION_AUTHORIZED"
    && inventory?.inventoryPolicyConformant === true
    && Array.isArray(inventory?.blockers)
    && inventory.blockers.length === 0
    && /^[a-f0-9]{64}$/u.test(inventory?.inventoryDigest ?? "")
    && inventory?.project?.projectId === APPROVED_SCOPE.projectId
    && inventory?.project?.projectNumber === APPROVED_SCOPE.projectNumber
    && inventory?.project?.lifecycleState === "ACTIVE"
    && control?.stagingEnabled === false
    && control?.reasonCode === "EXPIRY_DESTRUCTION"
    && Number.isSafeInteger(control?.controlEpoch)
    && control.controlEpoch >= 2
    && inventory?.resources?.functionRuntimeConfigurationPhase
      === "PROTECTED_PREVIEW_CONFIGURED_ISSUANCE_DISABLED"
    && functions.length === APPROVED_FUNCTIONS.size
    && issueFunction?.environmentVariables
      ?.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED === "false"
    && deleteFunction !== undefined
    && deployAccount?.disabled === false
    && Array.isArray(inventory?.resources?.deployServiceAccountKeys)
    && inventory.resources.deployServiceAccountKeys.length === 0
    && !(inventory?.resources?.iamBindings ?? []).some(
      (binding) => binding.members?.includes(deployMember),
    )
    && deployResourceBindings.length === 1
    && deployResourceBindings[0]?.role
      === "roles/iam.serviceAccountTokenCreator"
    && deployResourceBindings[0]?.members.length === 1
    && deployResourceBindings[0]?.members[0]
      === `user:${APPROVED_SCOPE.approvedGoogleAccount}`
    && exactNormalizedIamCondition(
      deployResourceBindings[0]?.condition,
      deletionWindowCondition,
    )
    && Array.isArray(serviceAccountBindings.runtime)
    && serviceAccountBindings.runtime.length === 0
    && Array.isArray(serviceAccountBindings.build)
    && serviceAccountBindings.build.length === 0
    && exactDeletionRunInvoker
    && inheritedDeployAuthorityAbsent
    && indirectProjectDeployAuthorityAbsent
    && deployMemberAbsentFromOtherResourcePolicies
    && grantRelationship?.sessionsChecked
      === binding.activeSyntheticSessionCount
    && grantRelationship?.grantsChecked
      === binding.activeCapabilityGrantCount
    && grantRelationship?.everyGrantPointsToObservedSession === true
    && grantRelationship?.maximumGrantsPerSession === 2
    && grantRelationship?.boundedGrantMultiplicity === true
    && grantRelationship?.allDocumentsConformant === true
    && /^[a-f0-9]{64}$/u.test(
      grantRelationship?.relationshipDigest ?? "",
    )
    && grantRelationship?.identifiersPersistedOrPrinted === false
    && pools.length === 1
    && pools[0]?.id === APPROVED_SCOPE.workloadIdentityPoolId
    && pools[0]?.state === "ACTIVE"
    && typeof pools[0]?.disabled === "boolean"
    && providers.length === 1
    && providers[0]?.id === APPROVED_SCOPE.workloadIdentityProviderId
    && providers[0]?.state === "ACTIVE"
    && typeof providers[0]?.disabled === "boolean"
    && !(pools[0].disabled === true && providers[0].disabled === false)
    && sessionIds.length <= MAX_FIRESTORE_DOCUMENTS_FOR_NESTED_SCAN
    && !sessionIds.some((id) => tombstoneIds.has(id))
    && (
      binding.activeSyntheticSessionCount > 0
      || binding.activeCapabilityGrantCount === 0
    )
  );
  if (!valid) {
    throw operatorError(
      "FRESH_AUTHENTICATED_SYNTHETIC_DELETION_INVENTORY_REQUIRED",
    );
  }
  return {
    binding,
    inventoryDigest: inventory.inventoryDigest,
    poolDisabled: pools[0].disabled,
    providerDisabled: providers[0].disabled,
    sessionIds,
  };
}

export function validateSyntheticDeletionRevokedReadbackInventory(
  inventory,
  minimumControlEpoch,
) {
  const binding = syntheticDataDeletionInventoryBinding(inventory);
  const requiredEpoch = Number(minimumControlEpoch);
  const functions = inventory?.resources?.functions ?? [];
  const control = inventory?.resources?.firestoreDataInventory?.control;
  const identity = inventory?.resources?.workloadIdentityFederation ?? {};
  const pools = identity.pools ?? [];
  const providers = identity.providers ?? [];
  const deployMember =
    `serviceAccount:${APPROVED_DEPLOY_SERVICE_ACCOUNT}`;
  const deployAccount = (
    inventory?.resources?.serviceAccounts ?? []
  ).find(
    (account) => account.email === APPROVED_DEPLOY_SERVICE_ACCOUNT,
  );
  const serviceAccountBindings =
    inventory?.resources?.serviceAccountIamBindings ?? {};
  const deployBindingAbsentEverywhere = (
    !(inventory?.resources?.iamBindings ?? []).some(
      (entry) => entry.members?.includes(deployMember),
    )
    && !(identity.runIamBindings ?? []).some(
      (policy) => policy.bindings?.some(
        (entry) => entry.members?.includes(deployMember),
      ),
    )
    && [
      inventory?.resources?.capabilitySecretIamBindings ?? [],
      inventory?.resources?.buildIdentityResourceIamBindings
        ?.functionArtifactRepository ?? [],
      inventory?.resources?.buildIdentityResourceIamBindings
        ?.functionSourceBucket ?? [],
      serviceAccountBindings.deploy ?? [],
      serviceAccountBindings.runtime ?? [],
      serviceAccountBindings.build ?? [],
    ].every((bindings) => bindings.every(
      (entry) => !entry.members.includes(deployMember),
    ))
  );
  const valid = (
    Number.isSafeInteger(requiredEpoch)
    && requiredEpoch >= 2
    && inventory?.schemaVersion
      === "wp13.12b-ea-operator-resource-inventory-v2"
    && inventory?.mode === "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION"
    && inventory?.source === "LIVE_READ_ONLY_PROVIDER_QUERIES"
    && inventory?.externalWrites === 0
    && inventory?.inventoryLifecyclePhase
      === "SYNTHETIC_DELETION_REVOKED_READBACK"
    && inventory?.inventoryPolicyConformant === true
    && Array.isArray(inventory?.blockers)
    && inventory.blockers.length === 0
    && /^[a-f0-9]{64}$/u.test(inventory?.inventoryDigest ?? "")
    && inventory?.project?.projectId === APPROVED_SCOPE.projectId
    && inventory?.project?.projectNumber === APPROVED_SCOPE.projectNumber
    && inventory?.project?.lifecycleState === "ACTIVE"
    && control?.stagingEnabled === false
    && control?.reasonCode === "EXPIRY_DESTRUCTION"
    && Number.isSafeInteger(control?.controlEpoch)
    && control.controlEpoch >= requiredEpoch
    && inventory?.resources?.functionRuntimeConfigurationPhase
      === "PROTECTED_PREVIEW_CONFIGURED_ISSUANCE_DISABLED"
    && functions.length === APPROVED_FUNCTIONS.size
    && functions.find((fn) => fn.name === "issueSyntheticSession")
      ?.environmentVariables
      ?.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED === "false"
    && binding.activeSyntheticSessionCount === 0
    && binding.activeCapabilityGrantCount === 0
    && deployAccount?.disabled === false
    && Array.isArray(inventory?.resources?.deployServiceAccountKeys)
    && inventory.resources.deployServiceAccountKeys.length === 0
    && Array.isArray(serviceAccountBindings.deploy)
    && serviceAccountBindings.deploy.length === 0
    && Array.isArray(serviceAccountBindings.runtime)
    && serviceAccountBindings.runtime.length === 0
    && Array.isArray(serviceAccountBindings.build)
    && serviceAccountBindings.build.length === 0
    && deployBindingAbsentEverywhere
    && exactOrganizationIamScopeAbsence(
      inventory?.resources?.organizationIamScopeEvidence,
    )
    && exactProjectIamScopeAbsence(
      inventory?.resources?.projectIamScopeEvidence,
    )
    && exactProjectIamScopeAbsence(
      inventory?.resources?.projectIamScopeEvidence,
    )
    && pools.length === 1
    && pools[0]?.id === APPROVED_SCOPE.workloadIdentityPoolId
    && pools[0]?.state === "ACTIVE"
    && typeof pools[0]?.disabled === "boolean"
    && providers.length === 1
    && providers[0]?.id === APPROVED_SCOPE.workloadIdentityProviderId
    && providers[0]?.state === "ACTIVE"
    && typeof providers[0]?.disabled === "boolean"
    && !(pools[0].disabled === true && providers[0].disabled === false)
    && inventory?.resources?.vercel
      ?.collectionSkippedForGoogleOnlySyntheticDeletion === true
  );
  if (!valid) {
    throw operatorError(
      "FRESH_GOOGLE_ONLY_REVOKED_SYNTHETIC_DELETION_READBACK_REQUIRED",
    );
  }
  return {
    binding,
    inventoryDigest: inventory.inventoryDigest,
    poolDisabled: pools[0].disabled,
    providerDisabled: providers[0].disabled,
  };
}

export function materializeSyntheticDataDeletionExecutionPlan(
  inventory,
  windowExpiresAt,
  now = new Date(),
) {
  try {
    assertSyntheticDeletionWindow(windowExpiresAt, now);
  } catch {
    throw operatorError(
      "ACTIVE_DELETION_ONLY_IDENTITY_WINDOW_REQUIRED_FOR_SYNTHETIC_DELETION",
    );
  }
  const preflight = validateSyntheticDeletionAuthorizedInventory(
    inventory,
    windowExpiresAt,
  );
  return {
    schemaVersion: "wp13.12b-synthetic-data-deletion-execution-plan-v1",
    status: "MATERIALIZED_NOT_EXECUTED",
    projectId: APPROVED_SCOPE.projectId,
    stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
    controlEpoch: preflight.binding.controlEpoch,
    windowExpiresAt,
    authenticatedInventoryDigest: preflight.inventoryDigest,
    syntheticSessionsObserved:
      preflight.binding.activeSyntheticSessionCount,
    capabilityGrantsObserved:
      preflight.binding.activeCapabilityGrantCount,
    tombstonesObserved: preflight.binding.tombstoneCount,
    deletionTargetClassification:
      "ONLY_SCHEMA_CONFORMANT_SYNTHETIC_SESSION_DOCUMENTS",
    maximumBoundedDeleteInvocations:
      MAX_FIRESTORE_DOCUMENTS_FOR_NESTED_SCAN,
    externalWrites: 0,
    sessionIdentifiersPersistedOrPrinted: false,
    payloadsPersistedOrPrinted: false,
    capabilitiesPersistedOrPrinted: false,
    identityTokenPrintedOrPersisted: false,
    immutableIntentPath:
      EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionIntent,
  };
}

export function materializeSyntheticDataDeletionIntent(
  inventory,
  windowExpiresAt,
  observedAt = new Date(),
) {
  const preflight = validateSyntheticDeletionAuthorizedInventory(
    inventory,
    windowExpiresAt,
  );
  const timestamp = observedAt instanceof Date
    ? observedAt.toISOString()
    : String(observedAt);
  try {
    assertSyntheticDeletionWindow(
      windowExpiresAt,
      new Date(timestamp),
    );
  } catch {
    throw operatorError(
      "ACTIVE_DELETION_ONLY_IDENTITY_WINDOW_REQUIRED_FOR_SYNTHETIC_DELETION",
    );
  }
  const sessionCount =
    preflight.binding.activeSyntheticSessionCount;
  const grantCount =
    preflight.binding.activeCapabilityGrantCount;
  const tombstoneCount = preflight.binding.tombstoneCount;
  if (
    sessionCount === 0
    && (grantCount !== 0 || tombstoneCount < 1)
  ) {
    throw operatorError(
      "SYNTHETIC_DELETION_INTENT_REQUIRES_ACTIVE_DATA_OR_TOMBSTONE_HISTORY",
    );
  }
  const sessionIds = exactSyntheticDocumentIds(
    inventory,
    "syntheticSessions",
  ).sort();
  const tombstoneIds = exactSyntheticDocumentIds(
    inventory,
    "syntheticSessionTombstones",
  ).sort();
  const expectedPostTombstoneIds = [
    ...new Set([...tombstoneIds, ...sessionIds]),
  ].sort();
  return {
    schemaVersion: "wp13.12b-synthetic-data-deletion-intent-v1",
    projectId: APPROVED_SCOPE.projectId,
    stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
    operatorGoogleAccount: APPROVED_SCOPE.approvedGoogleAccount,
    action: "BOUNDED_IDEMPOTENT_SYNTHETIC_SESSION_DELETION",
    initialStateClassification: sessionCount > 0
      ? "ACTIVE_SYNTHETIC_DATA_REQUIRES_DELETION"
      : "ALREADY_ZERO_WITH_RETAINED_TOMBSTONE_HISTORY",
    controlEpoch: preflight.binding.controlEpoch,
    initialWindowExpiresAt: windowExpiresAt,
    preDeletionInventoryDigest: preflight.inventoryDigest,
    preDeletionSyntheticDataInventoryDigest:
      preflight.binding.observedSyntheticDataInventoryDigest,
    syntheticSessionsObservedBefore:
      preflight.binding.activeSyntheticSessionCount,
    capabilityGrantsObservedBefore:
      preflight.binding.activeCapabilityGrantCount,
    tombstonesObservedBefore: preflight.binding.tombstoneCount,
    preDeletionSessionSetSha256: digestValue(sessionIds),
    preDeletionTombstoneSetSha256: digestValue(tombstoneIds),
    expectedPostTombstoneSetSha256:
      digestValue(expectedPostTombstoneIds),
    expectedPostTombstoneCount: expectedPostTombstoneIds.length,
    grantRelationshipDigest:
      inventory.resources.firestoreDataInventory
        .grantRelationshipEvidence.relationshipDigest,
    workloadIdentityProviderDisabledObserved:
      preflight.providerDisabled,
    workloadIdentityPoolDisabledObserved: preflight.poolDisabled,
    observedAt: timestamp,
    immutableIntent: true,
    externalWrites: 0,
    sessionIdentifiersPersistedOrPrinted: false,
    payloadsPersistedOrPrinted: false,
    capabilitiesPersistedOrPrinted: false,
    identityTokenPrintedOrPersisted: false,
  };
}

export function validateSyntheticDataDeletionIntent(
  intent,
  initialInventory,
) {
  let recordedWindowValid = false;
  try {
    assertRecordedSyntheticDeletionWindow(
      intent?.initialWindowExpiresAt,
    );
    assertSyntheticDeletionWindow(
      intent?.initialWindowExpiresAt,
      new Date(intent?.observedAt),
    );
    recordedWindowValid = true;
  } catch {
    recordedWindowValid = false;
  }
  const valid = (
    exactOrderedStrings(
      Object.keys(intent ?? {}).sort(),
      SYNTHETIC_DELETION_INTENT_KEYS,
    )
    && intent?.schemaVersion
      === "wp13.12b-synthetic-data-deletion-intent-v1"
    && intent?.projectId === APPROVED_SCOPE.projectId
    && intent?.stagingExpiryDate === APPROVED_SCOPE.stagingExpiryDate
    && intent?.operatorGoogleAccount === APPROVED_SCOPE.approvedGoogleAccount
    && intent?.action
      === "BOUNDED_IDEMPOTENT_SYNTHETIC_SESSION_DELETION"
    && [
      "ACTIVE_SYNTHETIC_DATA_REQUIRES_DELETION",
      "ALREADY_ZERO_WITH_RETAINED_TOMBSTONE_HISTORY",
    ].includes(intent?.initialStateClassification)
    && Number.isSafeInteger(intent?.controlEpoch)
    && intent.controlEpoch >= 2
    && typeof intent?.initialWindowExpiresAt === "string"
    && Number.isFinite(Date.parse(intent.initialWindowExpiresAt))
    && new Date(intent.initialWindowExpiresAt).toISOString()
      === intent.initialWindowExpiresAt
    && /^[a-f0-9]{64}$/u.test(intent?.preDeletionInventoryDigest ?? "")
    && /^[a-f0-9]{64}$/u.test(
      intent?.preDeletionSyntheticDataInventoryDigest ?? "",
    )
    && Number.isSafeInteger(intent?.syntheticSessionsObservedBefore)
    && intent.syntheticSessionsObservedBefore >= 0
    && Number.isSafeInteger(intent?.capabilityGrantsObservedBefore)
    && intent.capabilityGrantsObservedBefore >= 0
    && Number.isSafeInteger(intent?.tombstonesObservedBefore)
    && intent.tombstonesObservedBefore >= 0
    && (
      (
        intent.initialStateClassification
          === "ACTIVE_SYNTHETIC_DATA_REQUIRES_DELETION"
        && intent.syntheticSessionsObservedBefore > 0
      )
      || (
        intent.initialStateClassification
          === "ALREADY_ZERO_WITH_RETAINED_TOMBSTONE_HISTORY"
        && intent.syntheticSessionsObservedBefore === 0
        && intent.capabilityGrantsObservedBefore === 0
        && intent.tombstonesObservedBefore > 0
      )
    )
    && /^[a-f0-9]{64}$/u.test(intent?.preDeletionSessionSetSha256 ?? "")
    && /^[a-f0-9]{64}$/u.test(intent?.preDeletionTombstoneSetSha256 ?? "")
    && /^[a-f0-9]{64}$/u.test(
      intent?.expectedPostTombstoneSetSha256 ?? "",
    )
    && intent?.expectedPostTombstoneCount
      === intent.tombstonesObservedBefore
        + intent.syntheticSessionsObservedBefore
    && /^[a-f0-9]{64}$/u.test(intent?.grantRelationshipDigest ?? "")
    && typeof intent?.workloadIdentityProviderDisabledObserved
      === "boolean"
    && typeof intent?.workloadIdentityPoolDisabledObserved === "boolean"
    && !(
      intent.workloadIdentityPoolDisabledObserved === true
      && intent.workloadIdentityProviderDisabledObserved === false
    )
    && typeof intent?.observedAt === "string"
    && Number.isFinite(Date.parse(intent.observedAt))
    && new Date(intent.observedAt).toISOString() === intent.observedAt
    && intent?.immutableIntent === true
    && intent?.externalWrites === 0
    && intent?.sessionIdentifiersPersistedOrPrinted === false
    && intent?.payloadsPersistedOrPrinted === false
    && intent?.capabilitiesPersistedOrPrinted === false
    && intent?.identityTokenPrintedOrPersisted === false
    && recordedWindowValid
  );
  if (!valid) {
    throw operatorError("VALID_SYNTHETIC_DATA_DELETION_INTENT_REQUIRED");
  }
  assertNoCredentialFields(intent);
  assertNoSyntheticIdentifierFieldsOrValues(intent);
  if (initialInventory !== undefined) {
    const expected = materializeSyntheticDataDeletionIntent(
      initialInventory,
      intent.initialWindowExpiresAt,
      intent.observedAt,
    );
    if (digestValue(expected) !== digestValue(intent)) {
      throw operatorError(
        "SYNTHETIC_DATA_DELETION_INTENT_INITIAL_BINDING_MISMATCH",
      );
    }
  }
  return true;
}

export function validateSyntheticDeletionIntentRecoveryState(
  intent,
  currentInventory,
  windowExpiresAt,
) {
  validateSyntheticDataDeletionIntent(intent);
  const current = validateSyntheticDeletionAuthorizedInventory(
    currentInventory,
    windowExpiresAt,
  );
  const currentSessionIds = exactSyntheticDocumentIds(
    currentInventory,
    "syntheticSessions",
  );
  const currentTombstoneIds = exactSyntheticDocumentIds(
    currentInventory,
    "syntheticSessionTombstones",
  );
  const currentUnion = [
    ...new Set([...currentSessionIds, ...currentTombstoneIds]),
  ].sort();
  if (
    current.binding.controlEpoch !== intent.controlEpoch
    || currentSessionIds.length + currentTombstoneIds.length
      !== intent.expectedPostTombstoneCount
    || digestValue(currentUnion)
      !== intent.expectedPostTombstoneSetSha256
  ) {
    throw operatorError(
      "SYNTHETIC_DELETION_INTENT_RECOVERY_STATE_MISMATCH",
    );
  }
  return current;
}

export function validateSyntheticDeletionIdentityLifecycleReadback(
  readback,
  expectedAction,
  windowExpiresAt,
) {
  const deletionOnly =
    expectedAction === "downscope-for-synthetic-deletion";
  const revoked =
    expectedAction === "revoke-deletion-identity";
  const expectedAuthorityState = deletionOnly
    ? deployIdentityAuthorityStates.deletionOnly
    : deployIdentityAuthorityStates.allAuthorityRevoked;
  const runEvidence = readback?.deletionRunPolicyEvidence;
  const parentEvidence = readback?.parentScopeEvidence;
  const projectEvidence = readback?.projectScopeEvidence;
  const resourceEvidence = readback?.resourcePolicyEvidence;
  const valid = (
    (deletionOnly || revoked)
    && readback?.schemaVersion
      === "wp13.12b-ea-deploy-identity-readback-v3"
    && readback?.action === expectedAction
    && readback?.projectId === APPROVED_SCOPE.projectId
    && readback?.deployServiceAccount
      === deployIdentityScope.deployServiceAccount
    && readback?.windowExpiresAt === windowExpiresAt
    && readback?.authorityState === expectedAuthorityState
    && readback?.broadDeployBindingsRevoked === true
    && readback?.deletionOnlyAuthorityActive === deletionOnly
    && readback?.allDeployAndDeletionAuthorityRevoked === revoked
    && readback?.deleteSyntheticSessionResource
      === deployDeletionRunServiceScope.resource
    && readback?.syntheticDeletionOrdinaryGraceEndsAt
      === SYNTHETIC_DELETION_GRACE_END
    && Number.isSafeInteger(readback?.externalWrites)
    && readback.externalWrites >= 0
    && readback.externalWrites <= 64
    && Array.isArray(readback?.validationErrors)
    && readback.validationErrors.length === 0
    && readback?.tokenPrinted === false
    && readback?.credentialFileCreated === false
    && parentEvidence?.schemaVersion
      === "wp13.12b-ea-parent-scope-evidence-v1"
    && parentEvidence?.organizationId
      === APPROVED_SCOPE.organizationId
    && parentEvidence?.organizationIamPolicyReadbackPerformed === true
    && parentEvidence?.prohibitedInheritedBindingCount === 0
    && parentEvidence?.directApprovedServiceAccountBindingsAbsent === true
    && parentEvidence?.publicBindingsAbsent === true
    && parentEvidence?.principalSetBindingsAbsent === true
    && parentEvidence?.unresolvedOrBroadPrincipalBindingsAbsent === true
    && parentEvidence?.sensitiveDirectPrincipalRoleBindingsAbsent === true
    && parentEvidence?.unresolvedCustomRoleBindingsAbsent === true
    && projectEvidence?.schemaVersion
      === "wp13.12b-ea-project-scope-evidence-v1"
    && projectEvidence?.projectId === APPROVED_SCOPE.projectId
    && projectEvidence?.projectIamPolicyReadbackPerformed === true
    && projectEvidence?.prohibitedBroadPrincipalBindingCount === 0
    && projectEvidence?.publicBindingsAbsent === true
    && projectEvidence?.principalSetBindingsAbsent === true
    && projectEvidence?.unresolvedOrBroadPrincipalBindingsAbsent === true
    && resourceEvidence?.schemaVersion
      === "wp13.12b-ea-resource-policy-evidence-v1"
    && resourceEvidence?.resourcePolicyReadbackPerformed === true
    && resourceEvidence?.prohibitedBindingCount === 0
    && resourceEvidence?.exactApprovedIdentityAllowlistConformant === true
    && runEvidence?.schemaVersion
      === "wp13.12b-ea-deletion-run-policy-evidence-v1"
    && runEvidence?.runServicePoliciesReadbackPerformed === true
    && runEvidence?.exactRunServicePolicyTargetSet === true
    && runEvidence?.deleteSyntheticSessionResource
      === deployDeletionRunServiceScope.resource
    && runEvidence?.expectedConditionalDeletionInvokerPresent
      === deletionOnly
    && runEvidence?.directDeployBindingCount === (deletionOnly ? 1 : 0)
    && runEvidence?.prohibitedPrincipalSetBindingCount === 0
    && runEvidence?.deployAuthorityLimitedToExactDeletionInvoker
      === deletionOnly
    && runEvidence?.allDeployRunInvokerAuthorityAbsent === revoked
  );
  if (!valid) {
    throw operatorError(
      "VALID_SYNTHETIC_DELETION_IDENTITY_LIFECYCLE_READBACK_REQUIRED",
    );
  }
  assertNoCredentialFields(readback);
  return true;
}

export function reduceSyntheticDataDeletionTranscript({
  afterInventory,
  beforeInventory,
  deleteInvocationCount,
  deletionIdentityDownscopeReadback,
  deletionIdentityRevokeReadback,
  intent,
  observedAt,
  revokedInventory,
  windowExpiresAt,
}) {
  validateSyntheticDeletionIdentityLifecycleReadback(
    deletionIdentityDownscopeReadback,
    "downscope-for-synthetic-deletion",
    windowExpiresAt,
  );
  validateSyntheticDeletionIdentityLifecycleReadback(
    deletionIdentityRevokeReadback,
    "revoke-deletion-identity",
    windowExpiresAt,
  );
  const before = validateSyntheticDeletionIntentRecoveryState(
    intent,
    beforeInventory,
    windowExpiresAt,
  );
  const after = validateSyntheticDeletionAuthorizedInventory(
    afterInventory,
    windowExpiresAt,
  );
  const revoked = validateSyntheticDeletionRevokedReadbackInventory(
    revokedInventory,
    after.binding.controlEpoch,
  );
  const afterTombstoneIds = exactSyntheticDocumentIds(
    afterInventory,
    "syntheticSessionTombstones",
  ).sort();
  const timestamp = observedAt instanceof Date
    ? observedAt.toISOString()
    : String(observedAt);
  try {
    assertSyntheticDeletionWindow(
      windowExpiresAt,
      new Date(timestamp),
    );
  } catch {
    throw operatorError(
      "ACTIVE_DELETION_ONLY_IDENTITY_WINDOW_REQUIRED_FOR_SYNTHETIC_DELETION",
    );
  }
  if (
    !Number.isSafeInteger(deleteInvocationCount)
    || deleteInvocationCount !== before.binding.activeSyntheticSessionCount
    || after.binding.controlEpoch !== before.binding.controlEpoch
    || after.binding.activeSyntheticSessionCount !== 0
    || after.binding.activeCapabilityGrantCount !== 0
    || after.binding.tombstoneCount
      !== intent.expectedPostTombstoneCount
    || digestValue(afterTombstoneIds)
      !== intent.expectedPostTombstoneSetSha256
    || after.poolDisabled !== before.poolDisabled
    || after.providerDisabled !== before.providerDisabled
    || revoked.binding.observedSyntheticDataInventoryDigest
      !== after.binding.observedSyntheticDataInventoryDigest
    || !Number.isFinite(Date.parse(timestamp))
    || new Date(timestamp).toISOString() !== timestamp
  ) {
    throw operatorError(
      "FRESH_ZERO_SYNTHETIC_DELETION_READBACK_REQUIRED",
    );
  }
  return {
    schemaVersion:
      "wp13.12b-synthetic-data-deletion-execution-receipt-v1",
    projectId: APPROVED_SCOPE.projectId,
    stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
    operatorGoogleAccount: APPROVED_SCOPE.approvedGoogleAccount,
    action: "BOUNDED_IDEMPOTENT_SYNTHETIC_SESSION_DELETION",
    executionClassification:
      intent.initialStateClassification
        === "ALREADY_ZERO_WITH_RETAINED_TOMBSTONE_HISTORY"
        ? "AUTHENTICATED_ALREADY_ZERO_WITH_TOMBSTONE_HISTORY_NO_OP"
        : deleteInvocationCount === 0
          ? "AUTHENTICATED_INTENT_RECOVERY_AFTER_COMPLETED_DELETION"
          : "AUTHENTICATED_BOUNDED_DELETION_EXECUTED",
    controlEpoch: before.binding.controlEpoch,
    windowExpiresAt,
    deletionIntentSha256: digestValue(intent),
    deletionIdentityAuthorityStateAfter:
      deployIdentityAuthorityStates.allAuthorityRevoked,
    deletionIdentityDownscopeReadbackSha256:
      digestValue(deletionIdentityDownscopeReadback),
    deletionIdentityRevokeReadbackSha256:
      digestValue(deletionIdentityRevokeReadback),
    deletionIdentityRevokedBeforeReceiptWrite: true,
    preDeletionInventoryDigest: intent.preDeletionInventoryDigest,
    postDeletionInventoryDigest: after.inventoryDigest,
    postRevokeInventoryDigest: revoked.inventoryDigest,
    preDeletionSyntheticDataInventoryDigest:
      intent.preDeletionSyntheticDataInventoryDigest,
    postDeletionSyntheticDataInventoryDigest:
      after.binding.observedSyntheticDataInventoryDigest,
    preDeletionSessionSetSha256:
      intent.preDeletionSessionSetSha256,
    newlyObservedTombstoneSetSha256:
      intent.preDeletionSessionSetSha256,
    postDeletionTombstoneSetSha256:
      digestValue(afterTombstoneIds),
    syntheticSessionsObservedBefore:
      intent.syntheticSessionsObservedBefore,
    capabilityGrantsObservedBefore:
      intent.capabilityGrantsObservedBefore,
    tombstonesObservedBefore: intent.tombstonesObservedBefore,
    syntheticSessionsObservedThisRunBefore:
      before.binding.activeSyntheticSessionCount,
    deleteInvocationsCompletedThisRun: deleteInvocationCount,
    syntheticSessionsObservedAfter: 0,
    capabilityGrantsObservedAfter: 0,
    tombstonesObservedAfter: after.binding.tombstoneCount,
    deployIdentityWindowVerified: true,
    workloadIdentityProviderDisabledObserved:
      before.providerDisabled,
    workloadIdentityPoolDisabledObserved: before.poolDisabled,
    authenticatedReadbackBefore: true,
    authenticatedReadbackAfter: true,
    observedAt: timestamp,
    externalWritesThisRun: deleteInvocationCount,
    sessionIdentifiersPersistedOrPrinted: false,
    payloadsPersistedOrPrinted: false,
    capabilitiesPersistedOrPrinted: false,
    identityTokenPrintedOrPersisted: false,
    identityDownscopeExternalWritesThisRun:
      deletionIdentityDownscopeReadback.externalWrites,
    identityRevokeExternalWritesThisRun:
      deletionIdentityRevokeReadback.externalWrites,
  };
}

export function validateSyntheticDataDeletionExecutionReceipt(
  receipt,
  liveInventory,
  intent,
) {
  let recordedWindowValid = false;
  try {
    assertRecordedSyntheticDeletionWindow(receipt?.windowExpiresAt);
    assertSyntheticDeletionWindow(
      receipt?.windowExpiresAt,
      new Date(receipt?.observedAt),
    );
    recordedWindowValid = true;
  } catch {
    recordedWindowValid = false;
  }
  const exactBooleans = (
    receipt?.deployIdentityWindowVerified === true
    && receipt?.deletionIdentityRevokedBeforeReceiptWrite === true
    && receipt?.authenticatedReadbackBefore === true
    && receipt?.authenticatedReadbackAfter === true
    && receipt?.sessionIdentifiersPersistedOrPrinted === false
    && receipt?.payloadsPersistedOrPrinted === false
    && receipt?.capabilitiesPersistedOrPrinted === false
    && receipt?.identityTokenPrintedOrPersisted === false
  );
  const valid = (
    exactOrderedStrings(
      Object.keys(receipt ?? {}).sort(),
      SYNTHETIC_DELETION_EXECUTION_RECEIPT_KEYS,
    )
    && receipt?.schemaVersion
      === "wp13.12b-synthetic-data-deletion-execution-receipt-v1"
    && receipt?.projectId === APPROVED_SCOPE.projectId
    && receipt?.stagingExpiryDate === APPROVED_SCOPE.stagingExpiryDate
    && receipt?.operatorGoogleAccount
      === APPROVED_SCOPE.approvedGoogleAccount
    && receipt?.action
      === "BOUNDED_IDEMPOTENT_SYNTHETIC_SESSION_DELETION"
    && [
      "AUTHENTICATED_BOUNDED_DELETION_EXECUTED",
      "AUTHENTICATED_INTENT_RECOVERY_AFTER_COMPLETED_DELETION",
      "AUTHENTICATED_ALREADY_ZERO_WITH_TOMBSTONE_HISTORY_NO_OP",
    ].includes(receipt?.executionClassification)
    && Number.isSafeInteger(receipt?.controlEpoch)
    && receipt.controlEpoch >= 2
    && typeof receipt?.windowExpiresAt === "string"
    && Number.isFinite(Date.parse(receipt.windowExpiresAt))
    && new Date(receipt.windowExpiresAt).toISOString()
      === receipt.windowExpiresAt
    && /^[a-f0-9]{64}$/u.test(receipt?.deletionIntentSha256 ?? "")
    && receipt?.deletionIdentityAuthorityStateAfter
      === deployIdentityAuthorityStates.allAuthorityRevoked
    && /^[a-f0-9]{64}$/u.test(
      receipt?.deletionIdentityDownscopeReadbackSha256 ?? "",
    )
    && /^[a-f0-9]{64}$/u.test(
      receipt?.deletionIdentityRevokeReadbackSha256 ?? "",
    )
    && /^[a-f0-9]{64}$/u.test(receipt?.preDeletionInventoryDigest ?? "")
    && /^[a-f0-9]{64}$/u.test(receipt?.postDeletionInventoryDigest ?? "")
    && /^[a-f0-9]{64}$/u.test(receipt?.postRevokeInventoryDigest ?? "")
    && /^[a-f0-9]{64}$/u.test(
      receipt?.preDeletionSyntheticDataInventoryDigest ?? "",
    )
    && /^[a-f0-9]{64}$/u.test(
      receipt?.postDeletionSyntheticDataInventoryDigest ?? "",
    )
    && /^[a-f0-9]{64}$/u.test(
      receipt?.preDeletionSessionSetSha256 ?? "",
    )
    && receipt?.newlyObservedTombstoneSetSha256
      === receipt.preDeletionSessionSetSha256
    && /^[a-f0-9]{64}$/u.test(
      receipt?.postDeletionTombstoneSetSha256 ?? "",
    )
    && Number.isSafeInteger(receipt?.syntheticSessionsObservedBefore)
    && receipt.syntheticSessionsObservedBefore >= 0
    && Number.isSafeInteger(receipt?.capabilityGrantsObservedBefore)
    && receipt.capabilityGrantsObservedBefore >= 0
    && Number.isSafeInteger(receipt?.tombstonesObservedBefore)
    && receipt.tombstonesObservedBefore >= 0
    && Number.isSafeInteger(
      receipt?.syntheticSessionsObservedThisRunBefore,
    )
    && receipt.syntheticSessionsObservedThisRunBefore >= 0
    && receipt.syntheticSessionsObservedThisRunBefore
      <= receipt.syntheticSessionsObservedBefore
    && receipt?.deleteInvocationsCompletedThisRun
      === receipt.syntheticSessionsObservedThisRunBefore
    && receipt?.syntheticSessionsObservedAfter === 0
    && receipt?.capabilityGrantsObservedAfter === 0
    && receipt?.tombstonesObservedAfter
      === receipt.tombstonesObservedBefore
        + receipt.syntheticSessionsObservedBefore
    && receipt?.externalWritesThisRun
      === receipt.deleteInvocationsCompletedThisRun
    && Number.isSafeInteger(
      receipt?.identityDownscopeExternalWritesThisRun,
    )
    && receipt.identityDownscopeExternalWritesThisRun >= 0
    && receipt.identityDownscopeExternalWritesThisRun <= 64
    && Number.isSafeInteger(
      receipt?.identityRevokeExternalWritesThisRun,
    )
    && receipt.identityRevokeExternalWritesThisRun >= 0
    && receipt.identityRevokeExternalWritesThisRun <= 64
    && (
      (
        receipt.executionClassification
          === "AUTHENTICATED_BOUNDED_DELETION_EXECUTED"
        && receipt.deleteInvocationsCompletedThisRun > 0
      )
      || (
        receipt.executionClassification
          === "AUTHENTICATED_INTENT_RECOVERY_AFTER_COMPLETED_DELETION"
        && receipt.deleteInvocationsCompletedThisRun === 0
        && receipt.syntheticSessionsObservedBefore > 0
      )
      || (
        receipt.executionClassification
          === "AUTHENTICATED_ALREADY_ZERO_WITH_TOMBSTONE_HISTORY_NO_OP"
        && receipt.syntheticSessionsObservedBefore === 0
        && receipt.capabilityGrantsObservedBefore === 0
        && receipt.tombstonesObservedBefore > 0
        && receipt.deleteInvocationsCompletedThisRun === 0
        && receipt.externalWritesThisRun === 0
      )
    )
    && typeof receipt?.workloadIdentityProviderDisabledObserved
      === "boolean"
    && typeof receipt?.workloadIdentityPoolDisabledObserved === "boolean"
    && !(
      receipt.workloadIdentityPoolDisabledObserved === true
      && receipt.workloadIdentityProviderDisabledObserved === false
    )
    && typeof receipt?.observedAt === "string"
    && Number.isFinite(Date.parse(receipt.observedAt))
    && new Date(receipt.observedAt).toISOString() === receipt.observedAt
    && exactBooleans
    && recordedWindowValid
  );
  if (!valid) {
    throw operatorError(
      "VALID_SYNTHETIC_DATA_DELETION_EXECUTION_RECEIPT_REQUIRED",
    );
  }
  assertNoCredentialFields(receipt);
  assertNoSyntheticIdentifierFieldsOrValues(receipt);
  if (intent !== undefined) {
    validateSyntheticDataDeletionIntent(intent);
    if (
      receipt.deletionIntentSha256 !== digestValue(intent)
      || receipt.controlEpoch !== intent.controlEpoch
      || receipt.preDeletionInventoryDigest
        !== intent.preDeletionInventoryDigest
      || receipt.preDeletionSyntheticDataInventoryDigest
        !== intent.preDeletionSyntheticDataInventoryDigest
      || receipt.preDeletionSessionSetSha256
        !== intent.preDeletionSessionSetSha256
      || receipt.newlyObservedTombstoneSetSha256
        !== intent.preDeletionSessionSetSha256
      || receipt.postDeletionTombstoneSetSha256
        !== intent.expectedPostTombstoneSetSha256
      || receipt.syntheticSessionsObservedBefore
        !== intent.syntheticSessionsObservedBefore
      || receipt.capabilityGrantsObservedBefore
        !== intent.capabilityGrantsObservedBefore
      || receipt.tombstonesObservedBefore
        !== intent.tombstonesObservedBefore
      || receipt.tombstonesObservedAfter
        !== intent.expectedPostTombstoneCount
      || (
        intent.initialStateClassification
          === "ALREADY_ZERO_WITH_RETAINED_TOMBSTONE_HISTORY"
        && receipt.executionClassification
          !== "AUTHENTICATED_ALREADY_ZERO_WITH_TOMBSTONE_HISTORY_NO_OP"
      )
      || (
        intent.initialStateClassification
          === "ACTIVE_SYNTHETIC_DATA_REQUIRES_DELETION"
        && receipt.executionClassification
          === "AUTHENTICATED_ALREADY_ZERO_WITH_TOMBSTONE_HISTORY_NO_OP"
      )
    ) {
      throw operatorError(
        "SYNTHETIC_DELETION_RECEIPT_INTENT_BINDING_MISMATCH",
      );
    }
  }
  if (liveInventory !== undefined) {
    const binding = syntheticDataDeletionInventoryBinding(liveInventory);
    const tombstoneIds = exactSyntheticDocumentIds(
      liveInventory,
      "syntheticSessionTombstones",
    ).sort();
    if (
      binding.activeSyntheticSessionCount !== 0
      || binding.activeCapabilityGrantCount !== 0
      || binding.controlEpoch !== receipt.controlEpoch
      || binding.tombstoneCount !== receipt.tombstonesObservedAfter
      || binding.observedSyntheticDataInventoryDigest
        !== receipt.postDeletionSyntheticDataInventoryDigest
      || digestValue(tombstoneIds)
        !== receipt.postDeletionTombstoneSetSha256
    ) {
      throw operatorError(
        "SYNTHETIC_DELETION_RECEIPT_LIVE_INVENTORY_MISMATCH",
      );
    }
  }
  return true;
}

export function exactDeleteSyntheticSessionFunctionUri(rawInventory) {
  const expectedName =
    `projects/${APPROVED_SCOPE.projectId}/locations/`
    + `${APPROVED_SCOPE.region}/functions/deleteSyntheticSession`;
  const expectedRunService =
    `projects/${APPROVED_SCOPE.projectId}/locations/`
    + `${APPROVED_SCOPE.region}/services/deletesyntheticsession`;
  const functions = asArray(rawInventory?.functions);
  const matches = functions.filter(
    (fn) => fn?.name === expectedName,
  );
  const runMatches = asArray(rawInventory?.runServices).filter(
    (service) => service?.name === expectedRunService,
  );
  const value = matches[0]?.serviceConfig?.uri;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw operatorError(
      "EXACT_PRIVATE_DELETE_SYNTHETIC_SESSION_URI_REQUIRED",
    );
  }
  if (
    matches.length !== 1
    || runMatches.length !== 1
    || matches[0]?.serviceConfig?.service !== expectedRunService
    || runMatches[0]?.uri !== value
    || typeof value !== "string"
    || value.length < 30
    || value.length > 253
    || parsed.protocol !== "https:"
    || parsed.origin !== value
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.port !== ""
    || parsed.pathname !== "/"
    || parsed.search !== ""
    || parsed.hash !== ""
    || !/^deletesyntheticsession-[a-z0-9]{10}-[a-z]{2}\.a\.run\.app$/u.test(
      parsed.hostname,
    )
  ) {
    throw operatorError(
      "EXACT_PRIVATE_DELETE_SYNTHETIC_SESSION_URI_REQUIRED",
    );
  }
  return value;
}

function validateDeleteSyntheticSessionIdentityToken(
  token,
  audience,
  now,
) {
  if (
    typeof token !== "string"
    || token.length < 100
    || token.length > 16_384
    || /\s/u.test(token)
  ) {
    throw operatorError(
      "KEYLESS_DELETE_SYNTHETIC_SESSION_ID_TOKEN_INVALID",
    );
  }
  const segments = token.split(".");
  let claims;
  try {
    if (
      segments.length !== 3
      || segments.some(
        (segment) => !/^[A-Za-z0-9_-]+$/u.test(segment),
      )
    ) throw new Error("INVALID_JWT");
    claims = JSON.parse(
      Buffer.from(segments[1], "base64url").toString("utf8"),
    );
  } catch {
    throw operatorError(
      "KEYLESS_DELETE_SYNTHETIC_SESSION_ID_TOKEN_INVALID",
    );
  }
  const nowSeconds = Math.floor(now.valueOf() / 1000);
  if (
    claims?.aud !== audience
    || !["accounts.google.com", "https://accounts.google.com"].includes(
      claims?.iss,
    )
    || !Number.isSafeInteger(claims?.iat)
    || claims.iat > nowSeconds + 60
    || !Number.isSafeInteger(claims?.exp)
    || claims.exp <= nowSeconds + 60
    || typeof claims?.sub !== "string"
    || !/^[0-9]{6,32}$/u.test(claims.sub)
    || claims?.email !== APPROVED_DEPLOY_SERVICE_ACCOUNT
    || claims?.email_verified !== true
  ) {
    throw operatorError(
      "KEYLESS_DELETE_SYNTHETIC_SESSION_ID_TOKEN_INVALID",
    );
  }
  return Object.freeze({
    expiresAtSeconds: claims.exp,
  });
}

function assertSyntheticDeletionDeployWindow(
  windowExpiresAt,
  now,
  { exceptionalRecoveryRequired = false } = {},
) {
  if (exceptionalRecoveryRequired) {
    throw operatorError("DESTRUCTION_RECOVERY_AUTHORIZATION_REQUIRED");
  }
  try {
    assertSyntheticDeletionWindow(windowExpiresAt, now);
  } catch {
    throw operatorError(
      "ACTIVE_DELETION_ONLY_IDENTITY_WINDOW_REQUIRED_FOR_SYNTHETIC_DELETION",
    );
  }
  return true;
}

function readActualNow(nowImpl) {
  const now = nowImpl();
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) {
    throw operatorError("ACTUAL_SYNTHETIC_DELETION_CLOCK_REQUIRED");
  }
  return now;
}

export function assertExternalActionEnvironmentOverridesAbsent(
  environment = process.env,
  execArgv = process.execArgv,
) {
  const forbiddenOverrides = new Set([
    "ALL_PROXY",
    "CLOUDSDK_AUTH_ACCESS_TOKEN",
    "CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE",
    "CLOUDSDK_CONFIG",
    "CLOUDSDK_CORE_ACCOUNT",
    "CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE",
    "CLOUDSDK_CORE_PROJECT",
    "CURL_CA_BUNDLE",
    "DYLD_INSERT_LIBRARIES",
    "FIREBASE_TOKEN",
    "GCLOUD_PROJECT",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "GOOGLE_CLOUD_PROJECT",
    "GOOGLE_OAUTH_ACCESS_TOKEN",
    "LUDYS_FIREBASE_CLI_LIB",
    "LUDYS_FIREBASE_BIN",
    "LUDYS_GCLOUD_BIN",
    "LUDYS_VERCEL_MODULE_ROOT",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "LD_PRELOAD",
    "NPM_CONFIG_PREFIX",
    "NPM_CONFIG_USERCONFIG",
    "NPM_TOKEN",
    "NO_PROXY",
    "NODE_EXTRA_CA_CERTS",
    "NODE_OPTIONS",
    "NODE_PATH",
    "NODE_REPL_EXTERNAL_MODULE",
    "NODE_TLS_REJECT_UNAUTHORIZED",
    "NODE_USE_ENV_PROXY",
    "PYTHONHOME",
    "PYTHONPATH",
    "PYTHONSTARTUP",
    "REQUESTS_CA_BUNDLE",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "SSH_AUTH_SOCK",
    "VERCEL_TOKEN",
  ]);
  if (
    environment === null
    || typeof environment !== "object"
    || Array.isArray(environment)
    || !Array.isArray(execArgv)
    || execArgv.length !== 0
    || Object.entries(environment).some(
      ([key, value]) =>
        forbiddenOverrides.has(String(key).toUpperCase())
        && typeof value === "string"
        && value.length > 0,
    )
  ) {
    throw operatorError(
      "PRODUCTION_EXTERNAL_ACTION_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  return true;
}

async function assertProductionExternalActionEnvironment() {
  assertExternalActionEnvironmentOverridesAbsent();
  if (typeof process.argv[1] !== "string") {
    throw operatorError(
      "PRODUCTION_EXTERNAL_ACTION_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  const [entryPath, operatorPath] = await Promise.all([
    realpath(process.argv[1]),
    realpath(fileURLToPath(import.meta.url)),
  ]);
  const operatorStat = await lstat(operatorPath);
  if (
    !sameCanonicalPath(entryPath, operatorPath)
    || !operatorStat.isFile()
    || operatorStat.isSymbolicLink()
    || operatorStat.nlink !== 1
  ) {
    throw operatorError(
      "DIRECT_CANONICAL_PRODUCTION_OPERATOR_INVOCATION_REQUIRED",
    );
  }
  return true;
}

async function createProductionSyntheticSessionDeleteInvoker({
  assertMutationAuthorityImpl,
  functionUri,
  nowImpl,
  windowExpiresAt,
}) {
  if (typeof assertMutationAuthorityImpl !== "function") {
    throw operatorError("CLEANUP_MUTATION_AUTHORITY_GUARD_REQUIRED");
  }
  const tokenNow = readActualNow(nowImpl);
  assertSyntheticDeletionDeployWindow(
    windowExpiresAt,
    tokenNow,
    { exceptionalRecoveryRequired: false },
  );
  const oauthAccessToken = await isolatedGoogleOAuthAccessToken();
  assertSyntheticDeletionDeployWindow(
    windowExpiresAt,
    readActualNow(nowImpl),
    { exceptionalRecoveryRequired: false },
  );
  const generateIdTokenUrl =
    "https://iamcredentials.googleapis.com/v1/projects/-/"
    + `serviceAccounts/${
      encodeURIComponent(APPROVED_DEPLOY_SERVICE_ACCOUNT)
    }:generateIdToken`;
  const mintIdentityToken = async () => {
    const beforeMint = readActualNow(nowImpl);
    assertSyntheticDeletionDeployWindow(
      windowExpiresAt,
      beforeMint,
      { exceptionalRecoveryRequired: false },
    );
    assertMutationAuthorityImpl();
    assertSyntheticDeletionDeployWindow(
      windowExpiresAt,
      readActualNow(nowImpl),
      { exceptionalRecoveryRequired: false },
    );
    let response;
    try {
      response = await nativeFetch(generateIdTokenUrl, {
        method: "POST",
        signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${oauthAccessToken}`,
          "Content-Type": "application/json",
          "x-goog-user-project": APPROVED_SCOPE.projectId,
        },
        body: JSON.stringify({
          audience: functionUri,
          includeEmail: true,
        }),
      });
    } catch {
      throw operatorError(
        "KEYLESS_DELETE_SYNTHETIC_SESSION_ID_TOKEN_UNAVAILABLE",
      );
    }
    const text = await response.text();
    if (!response.ok || text.length > 20_000) {
      throw operatorError(
        "KEYLESS_DELETE_SYNTHETIC_SESSION_ID_TOKEN_UNAVAILABLE",
      );
    }
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw operatorError(
        "KEYLESS_DELETE_SYNTHETIC_SESSION_ID_TOKEN_UNAVAILABLE",
      );
    }
    const identityToken = value?.token;
    if (
      JSON.stringify(Object.keys(value ?? {}).sort())
        !== JSON.stringify(["token"])
    ) {
      throw operatorError(
        "KEYLESS_DELETE_SYNTHETIC_SESSION_ID_TOKEN_UNAVAILABLE",
      );
    }
    const afterMint = readActualNow(nowImpl);
    assertSyntheticDeletionDeployWindow(
      windowExpiresAt,
      afterMint,
      { exceptionalRecoveryRequired: false },
    );
    const claims = validateDeleteSyntheticSessionIdentityToken(
      identityToken,
      functionUri,
      afterMint,
    );
    return {
      expiresAtSeconds: claims.expiresAtSeconds,
      token: identityToken,
    };
  };
  let identity = await mintIdentityToken();
  return async function invokeDeleteSyntheticSession(
    syntheticSessionId,
  ) {
    if (
      typeof syntheticSessionId !== "string"
      || !/^synthetic-wp13-12b-[A-Za-z0-9_-]{20,64}$/u.test(
        syntheticSessionId,
      )
    ) {
      throw operatorError(
        "EXACT_SYNTHETIC_SESSION_DELETE_TARGET_REQUIRED",
      );
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const callNow = readActualNow(nowImpl);
      assertSyntheticDeletionDeployWindow(
        windowExpiresAt,
        callNow,
        { exceptionalRecoveryRequired: false },
      );
      if (
        identity.expiresAtSeconds * 1000
          <= callNow.valueOf() + 120_000
      ) {
        identity = await mintIdentityToken();
      }
      assertMutationAuthorityImpl();
      assertSyntheticDeletionDeployWindow(
        windowExpiresAt,
        readActualNow(nowImpl),
        { exceptionalRecoveryRequired: false },
      );
      let response;
      try {
        response = await nativeFetch(functionUri, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${identity.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ syntheticSessionId }),
        });
      } catch {
        if (attempt < 2) continue;
        throw operatorError(
          "DELETE_SYNTHETIC_SESSION_PROVIDER_CALL_FAILED",
        );
      }
      assertSyntheticDeletionDeployWindow(
        windowExpiresAt,
        readActualNow(nowImpl),
        { exceptionalRecoveryRequired: false },
      );
      if (
        attempt < 2
        && (
          response.status === 409
          || response.status === 429
          || response.status >= 500
        )
      ) {
        await response.body?.cancel().catch(() => {});
        continue;
      }
      const text = await response.text();
      if (!response.ok || text.length > 1024) {
        throw operatorError(
          "DELETE_SYNTHETIC_SESSION_PROVIDER_CALL_FAILED",
        );
      }
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        throw operatorError(
          "DELETE_SYNTHETIC_SESSION_PROVIDER_RESPONSE_INVALID",
        );
      }
      if (
        JSON.stringify(Object.keys(value ?? {}).sort())
          !== JSON.stringify(["audioStatus", "terminalStatus"])
        || value.terminalStatus !== "DELETED"
        || value.audioStatus !== "SILENT"
      ) {
        throw operatorError(
          "DELETE_SYNTHETIC_SESSION_PROVIDER_RESPONSE_INVALID",
        );
      }
      return Object.freeze({
        terminalStatus: "DELETED",
        audioStatus: "SILENT",
        identifiersPersistedOrPrinted: false,
        identityTokenPrintedOrPersisted: false,
      });
    }
    throw operatorError(
      "DELETE_SYNTHETIC_SESSION_PROVIDER_CALL_FAILED",
    );
  };
}

export function materializeSyntheticDataDeletionEvidencePlan(
  safeBackendInventory,
  syntheticDataDeletionIntent,
  syntheticDataDeletionExecutionReceipt,
  now = new Date(),
) {
  const binding = syntheticDataDeletionInventoryBinding(safeBackendInventory);
  if (
    binding.activeSyntheticSessionCount !== 0
    || binding.activeCapabilityGrantCount !== 0
  ) {
    throw operatorError(
      "ZERO_SYNTHETIC_SESSION_AND_GRANT_READBACK_REQUIRED_BEFORE_EVIDENCE",
    );
  }
  validateSafeBackendForDestructionInventory(
    safeBackendInventory,
    binding.controlEpoch,
  );
  validateSyntheticDataDeletionExecutionReceipt(
    syntheticDataDeletionExecutionReceipt,
    safeBackendInventory,
    syntheticDataDeletionIntent,
  );
  const observedAt = now instanceof Date ? now.toISOString() : String(now);
  if (
    !Number.isFinite(Date.parse(observedAt))
    || new Date(observedAt).toISOString() !== observedAt
  ) {
    throw operatorError("CANONICAL_SYNTHETIC_DATA_OBSERVED_AT_REQUIRED");
  }
  const evidence = {
    schemaVersion: "wp13.12b-synthetic-data-deletion-evidence-v1",
    projectId: APPROVED_SCOPE.projectId,
    stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
    allActiveSyntheticSessionPayloadsDeleted: true,
    tombstoneAndRetentionDecisionSecured: true,
    operatorGoogleAccount: APPROVED_SCOPE.approvedGoogleAccount,
    controlEpoch: binding.controlEpoch,
    activeSyntheticSessionCount: binding.activeSyntheticSessionCount,
    activeCapabilityGrantCount: binding.activeCapabilityGrantCount,
    tombstoneCount: binding.tombstoneCount,
    tombstoneRetentionDisposition:
      SYNTHETIC_TOMBSTONE_RETENTION_DISPOSITION,
    observedAt,
    observedSyntheticDataInventoryDigest:
      binding.observedSyntheticDataInventoryDigest,
    syntheticDataDeletionIntentSha256:
      digestValue(syntheticDataDeletionIntent),
    syntheticDataDeletionExecutionReceiptSha256:
      digestValue(syntheticDataDeletionExecutionReceipt),
  };
  const humanConfirmationText =
    syntheticDataDeletionConfirmationText(evidence);
  return {
    ...evidence,
    humanConfirmationText,
    humanConfirmationSha256: sha256Text(humanConfirmationText),
    humanConfirmed: false,
    evidenceStatus: "AWAITING_IMMUTABLE_CONFIRMATION_RECORD",
    externalWrites: 0,
    requiredHumanAction:
      "REVIEW_EXACT_LIVE_BINDING_THEN_RUN_EXACT_CONFIRMATION_RECORDER",
  };
}

function firestoreValueType(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const types = Object.keys(value).filter((key) => FIRESTORE_VALUE_TYPES.has(key));
  return types.length === 1 && Object.keys(value).length === 1 ? types[0] : null;
}

function firestoreString(value) {
  return firestoreValueType(value) === "stringValue"
    && typeof value.stringValue === "string"
    ? value.stringValue
    : null;
}

function firestoreSafeInteger(value, { minimum = 0 } = {}) {
  if (
    firestoreValueType(value) !== "integerValue"
    || !/^-?[0-9]+$/u.test(value.integerValue ?? "")
  ) return null;
  const number = Number(value.integerValue);
  return Number.isSafeInteger(number) && number >= minimum ? number : null;
}

function firestoreTimestampValid(value) {
  return (
    firestoreValueType(value) === "timestampValue"
    && typeof value.timestampValue === "string"
    && Number.isFinite(Date.parse(value.timestampValue))
  );
}

function exactFirestoreFields(fields, schema) {
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    return false;
  }
  const expected = Object.entries(schema).sort(([left], [right]) =>
    left.localeCompare(right));
  const actual = Object.entries(fields)
    .map(([name, value]) => [name, firestoreValueType(value)])
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function firestoreMapFields(value) {
  if (firestoreValueType(value) !== "mapValue") return null;
  const fields = value.mapValue?.fields ?? {};
  return fields !== null && typeof fields === "object" && !Array.isArray(fields)
    ? fields
    : null;
}

function firestoreArrayValues(value) {
  if (firestoreValueType(value) !== "arrayValue") return null;
  const values = value.arrayValue?.values ?? [];
  return Array.isArray(values) ? values : null;
}

function exactSessionState(fields) {
  const allowed = {
    adultProjectionToken: "stringValue",
    childProjectionToken: "stringValue",
    createdAt: "stringValue",
    helpRequested: "booleanValue",
    locale: "stringValue",
    recoveryTarget: "stringValue",
    resumeTarget: "stringValue",
    state: "stringValue",
    updatedAt: "stringValue",
  };
  const required = new Set([
    "adultProjectionToken",
    "childProjectionToken",
    "createdAt",
    "helpRequested",
    "locale",
    "state",
    "updatedAt",
  ]);
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    return false;
  }
  const names = Object.keys(fields);
  if (
    names.some((name) => !Object.hasOwn(allowed, name))
    || [...required].some((name) => !Object.hasOwn(fields, name))
    || names.some((name) => firestoreValueType(fields[name]) !== allowed[name])
  ) return false;
  const locale = firestoreString(fields.locale);
  const state = firestoreString(fields.state);
  const childProjectionToken = firestoreString(fields.childProjectionToken);
  const adultProjectionToken = firestoreString(fields.adultProjectionToken);
  const timestamps = [fields.createdAt, fields.updatedAt]
    .map(firestoreString);
  return (
    ["nb-NO", "nn-NO"].includes(locale)
    && [
      "ACTIVE",
      "COMPLETED",
      "CREATING",
      "DELETED",
      "INVALID",
      "NOT_CREATED",
      "PAUSED",
      "READY",
      "RECOVERING",
      "STALE",
      "STOPPED",
      "WAITING",
    ].includes(state)
    && childProjectionToken === "SYNTHETIC_CHILD_ONLY"
    && adultProjectionToken === "SYNTHETIC_ADULT_ONLY"
    && timestamps.every((value) =>
      typeof value === "string" && Number.isFinite(Date.parse(value)))
    && (
      !Object.hasOwn(fields, "resumeTarget")
      || ["ACTIVE", "WAITING"].includes(firestoreString(fields.resumeTarget))
    )
    && (
      !Object.hasOwn(fields, "recoveryTarget")
      || ["ACTIVE", "PAUSED", "READY", "WAITING"].includes(
        firestoreString(fields.recoveryTarget),
      )
    )
  );
}

function exactReleaseIds(fields) {
  if (!exactFirestoreFields(
    fields,
    Object.fromEntries(
      Object.keys(EXPECTED_SESSION_RELEASE_IDS).map((name) => [name, "stringValue"]),
    ),
  )) return false;
  return Object.entries(EXPECTED_SESSION_RELEASE_IDS).every(
    ([name, expected]) => firestoreString(fields[name]) === expected,
  );
}

export function inspectFirestoreSyntheticDocument(collectionId, document) {
  const schema = FIRESTORE_DOCUMENT_SCHEMAS[collectionId];
  const fields = document?.fields;
  const expectedPrefix = (
    `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
    + `${collectionId}/`
  );
  const documentName = typeof document?.name === "string" ? document.name : "";
  const documentId = documentName.startsWith(expectedPrefix)
    ? documentName.slice(expectedPrefix.length)
    : "";
  const expectedIdPattern = collectionId === "syntheticCapabilityGrants"
    ? /^[A-Za-z0-9_-]{24}$/u
    : /^synthetic-wp13-12b-[A-Za-z0-9_-]{20,64}$/u;
  const nameConformant = (
    schema !== undefined
    && expectedIdPattern.test(documentId)
    && !documentId.includes("/")
  );
  const exactSchema = (
    schema !== undefined
    && exactFirestoreFields(fields, schema.fields)
  );
  const exactDataClassification = (
    schema !== undefined
    && firestoreString(fields?.dataClassification)
      === schema.dataClassification
  );
  let exactSyntheticValues = false;
  if (exactSchema && exactDataClassification && nameConformant) {
    const sessionId = firestoreString(fields.syntheticSessionId);
    if (collectionId === "syntheticCapabilityGrants") {
      exactSyntheticValues = (
        firestoreString(fields.nonce) === documentId
        && /^synthetic-wp13-12b-[A-Za-z0-9_-]{20,64}$/u.test(sessionId ?? "")
        && ["ADULT", "CHILD"].includes(firestoreString(fields.role))
        && firestoreTimestampValid(fields.expiresAt)
        && firestoreSafeInteger(fields.remainingCommands) !== null
        && firestoreValueType(fields.revoked) === "booleanValue"
      );
    } else if (collectionId === "syntheticSessions") {
      const processedCommandIds = firestoreArrayValues(fields.processedCommandIds);
      exactSyntheticValues = (
        sessionId === documentId
        && firestoreSafeInteger(fields.stateVersion, { minimum: 1 }) !== null
        && firestoreSafeInteger(fields.authorityGeneration, { minimum: 1 }) !== null
        && firestoreSafeInteger(fields.controlEpoch, { minimum: 1 }) !== null
        && exactSessionState(firestoreMapFields(fields.syntheticSessionState))
        && exactReleaseIds(firestoreMapFields(fields.releaseIds))
        && firestoreTimestampValid(fields.expiresAt)
        && fields.tombstone.booleanValue === false
        && Array.isArray(processedCommandIds)
        && processedCommandIds.length <= 4096
        && processedCommandIds.every(
          (value) =>
            firestoreValueType(value) === "stringValue"
            && typeof value.stringValue === "string"
            && value.stringValue.length >= 1
            && value.stringValue.length <= 128,
        )
        && ["ACTIVE", "READY", "TERMINAL"].includes(
          firestoreString(fields.coarseTechnicalStatus),
        )
      );
    } else if (collectionId === "syntheticSessionTombstones") {
      exactSyntheticValues = (
        sessionId === documentId
        && firestoreSafeInteger(fields.terminalStateVersion, { minimum: 1 }) !== null
        && firestoreSafeInteger(
          fields.terminalAuthorityGeneration,
          { minimum: 1 },
        ) !== null
        && firestoreSafeInteger(fields.controlEpoch, { minimum: 1 }) !== null
        && firestoreTimestampValid(fields.deletedAt)
        && fields.noResurrection.booleanValue === true
      );
    }
  }
  return Object.freeze({
    nameConformant,
    exactSchema,
    exactDataClassification,
    exactSyntheticValues,
    conformant:
      nameConformant
      && exactSchema
      && exactDataClassification
      && exactSyntheticValues,
    payloadValuesPersistedOrPrinted: false,
  });
}

export function deriveSyntheticGrantRelationshipEvidence(
  sessionDocuments,
  grantDocuments,
) {
  if (!Array.isArray(sessionDocuments) || !Array.isArray(grantDocuments)) {
    throw operatorError("SYNTHETIC_GRANT_RELATIONSHIP_INPUT_REQUIRED");
  }
  const sessionPrefix =
    `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
    + "syntheticSessions/";
  const grantPrefix =
    `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
    + "syntheticCapabilityGrants/";
  const sessions = sessionDocuments.map((document) => ({
    id: typeof document?.name === "string"
        && document.name.startsWith(sessionPrefix)
      ? document.name.slice(sessionPrefix.length)
      : "",
    conformant:
      inspectFirestoreSyntheticDocument("syntheticSessions", document)
        .conformant,
  }));
  const grants = grantDocuments.map((document) => ({
    id: typeof document?.name === "string"
        && document.name.startsWith(grantPrefix)
      ? document.name.slice(grantPrefix.length)
      : "",
    sessionId: firestoreString(document?.fields?.syntheticSessionId) ?? "",
    role: firestoreString(document?.fields?.role) ?? "",
    conformant:
      inspectFirestoreSyntheticDocument(
        "syntheticCapabilityGrants",
        document,
      ).conformant,
  }));
  const sessionIds = new Set(sessions.map(({ id }) => id));
  const rolesBySession = new Map();
  for (const grant of grants) {
    const roles = rolesBySession.get(grant.sessionId) ?? [];
    roles.push(grant.role);
    rolesBySession.set(grant.sessionId, roles);
  }
  const everyGrantPointsToObservedSession = grants.every(
    (grant) => sessionIds.has(grant.sessionId),
  );
  const boundedGrantMultiplicity = [...rolesBySession.values()].every(
    (roles) =>
      roles.length <= 2
      && new Set(roles).size === roles.length
      && roles.every((role) => role === "ADULT" || role === "CHILD"),
  );
  const allDocumentsConformant = (
    sessions.every(({ conformant }) => conformant)
    && grants.every(({ conformant }) => conformant)
  );
  const relationshipBinding = {
    sessionIds: sessions.map(({ id }) => id).sort(),
    grants: grants
      .map(({ id, role, sessionId }) => ({ id, role, sessionId }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right))),
  };
  return Object.freeze({
    sessionsChecked: sessions.length,
    grantsChecked: grants.length,
    everyGrantPointsToObservedSession,
    maximumGrantsPerSession: 2,
    boundedGrantMultiplicity,
    allDocumentsConformant,
    relationshipDigest: digestValue(relationshipBinding),
    identifiersPersistedOrPrinted: false,
  });
}

function sanitizedFirestoreDocumentName(document, inspection) {
  if (inspection.nameConformant) return document.name;
  return `INVALID_DOCUMENT_NAME_SHA256_${digestValue(document?.name ?? "")}`;
}

function exactOrderedStrings(actual, expected) {
  return (
    Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
  );
}

export function validateExpiryDestructionContract(
  executionContract,
  destructionPlan,
) {
  const planCommandMarkers = [
    [
      "provider/firebase/tools/set-staging-control.mjs",
      "--enabled false",
      "--reason EXPIRY_DESTRUCTION",
      EXECUTION_AUTHORIZATION.deactivation,
    ],
    [
      "scripts/provider-external-deploy-identity-control.mjs",
      "--action plan",
      "--window-expires-at <UTC-ISO-WITHIN-60-MINUTES>",
    ],
    [
      "scripts/provider-external-deploy-identity-control.mjs",
      "--action provision",
      "--window-expires-at <UTC-ISO-WITHIN-60-MINUTES>",
      "AUTHORIZE_WP13_12B_EXTERNAL_ACTIVATION",
    ],
    [
      "scripts/provider-external-deploy-identity-control.mjs",
      "--action verify",
      "--window-expires-at <UTC-ISO-WITHIN-60-MINUTES>",
    ],
    [
      "scripts/provider-external-function-deploy.mjs",
      "--action configure-preview-origin",
      "--preview-origin <EXACT_RECEIPT_BOUND_ACTIVE_PREVIEW_ORIGIN>",
      "--window-expires-at <UTC-ISO-WITHIN-60-MINUTES>",
    ],
    [
      "scripts/provider-external-function-deploy.mjs",
      "--action deploy-disabled",
      "--window-expires-at <UTC-ISO-WITHIN-60-MINUTES>",
    ],
    [
      "scripts/wp13-12b-external-resource-operator.mjs",
      "--action delete-synthetic-data",
      "--window-expires-at <UTC-ISO-WITHIN-30-MINUTES-AND-NO-LATER-THAN-2027-01-26T00:00:00.000Z>",
      EXECUTION_AUTHORIZATION.syntheticDataDeletion,
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
      "provider:external:deactivation-plan",
      `--synthetic-data-deletion-evidence ${
        EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion
      }`,
      EXECUTION_AUTHORIZATION.deactivation,
    ],
    [
      "--action vercel-destruction-plan",
      `--confirm-vercel-team-id ${APPROVED_SCOPE.vercelTeamId}`,
      `--confirm-vercel-project-id ${APPROVED_SCOPE.vercelProjectId}`,
      `--deactivation-receipt ${EXECUTION_EVIDENCE_PATHS.deactivation}`,
      `--synthetic-data-deletion-evidence ${
        EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion
      }`,
      EXECUTION_AUTHORIZATION.vercelDestruction,
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
      EXECUTION_EVIDENCE_PATHS.deactivation,
      EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion,
      EXECUTION_EVIDENCE_PATHS.previewDestruction,
      EXECUTION_AUTHORIZATION.destruction,
    ],
    [
      "provider:external:inventory",
      "<FINAL_ZERO_RESOURCE_INVENTORY_PATH>",
    ],
  ];
  const orderedCommands = destructionPlan?.orderedCommands;
  const planCommandsExact = (
    Array.isArray(orderedCommands)
    && orderedCommands.length === planCommandMarkers.length
    && planCommandMarkers.every((markers, index) =>
      typeof orderedCommands[index] === "string"
      && markers.every((marker) => orderedCommands[index].includes(marker)))
  );
  const safeClock = executionContract?.executionClockPhases
    ?.safeBackendTransition;
  const destructionClock = executionContract?.executionClockPhases
    ?.irreversibleDestruction;
  const syntheticDeletionClock = executionContract
    ?.executionClockPhases?.syntheticDeletionTransition;
  const safeguards = executionContract?.runtimeExecutionSafeguards;
  const safeEvidence = executionContract?.requiredEvidence
    ?.safeBackendTransition;
  const preTrustRemovalInventory = safeEvidence?.preTrustRemovalInventory;
  const deactivationEvidence = executionContract?.requiredEvidence
    ?.deactivation;
  const syntheticDataDeletionEvidence = executionContract?.requiredEvidence
    ?.syntheticDataDeletion;
  const syntheticDataDeletionIntentEvidence =
    executionContract?.requiredEvidence?.syntheticDataDeletionIntent;
  const syntheticDataDeletionExecutionReceiptEvidence =
    executionContract?.requiredEvidence
      ?.syntheticDataDeletionExecutionReceipt;
  const syntheticDataDeletionConfirmationEvidence =
    executionContract?.requiredEvidence?.syntheticDataDeletionConfirmation;
  const protectedPreviewEvidence = executionContract?.requiredEvidence
    ?.protectedPreview;
  const protectedPreviewConfirmationEvidence =
    executionContract?.requiredEvidence?.protectedPreviewConfirmation;
  const materialization = executionContract?.materialization;
  const repeatSafety = executionContract?.repeatSafety;
  const vercelDestructionBoundary =
    executionContract?.vercelDestructionBoundary;
  const valid = (
    destructionPlan?.schemaVersion === "wp13.12b-staging-destruction-v3"
    && destructionPlan?.executionContract === LOCAL_PATHS.executionContract
    && destructionPlan?.syntheticDeletionWindow
      ?.separateExactAuthorizationRequired === true
    && destructionPlan?.syntheticDeletionWindow?.minimumMinutes === 5
    && destructionPlan?.syntheticDeletionWindow?.maximumMinutes === 30
    && destructionPlan?.syntheticDeletionWindow?.ordinaryGraceEndsAt
      === SYNTHETIC_DELETION_GRACE_END
    && destructionPlan?.syntheticDeletionWindow?.broadDeployOrRedeployAllowed
      === false
    && destructionPlan?.syntheticDeletionWindow?.executionAfterOrdinaryGrace
      === "SEPARATE_EXCEPTIONAL_RECOVERY_AUTHORIZATION_REQUIRED"
    && executionContract?.schemaVersion
      === "wp13.12b-ea-expiry-destruction-execution-contract-v4"
    && executionContract?.approvalBinding?.destructionPlan
      === LOCAL_PATHS.destructionPlan
    && exactOrderedStrings(
      executionContract?.destructionOrderActionIds,
      EXPIRY_DESTRUCTION_ACTION_IDS,
    )
    && safeClock?.mayStartBeforeExpiryOnOwnerStop === true
    && safeClock?.mustCompleteBeforeExpiry === true
    && safeClock
      ?.externalActivationWindowMustRemainOpenForDeployIdentityAndFunctionDeployment
      === true
    && syntheticDeletionClock?.classification
      === "BOUNDED_PRE_DESTRUCTION_SAFETY_CLEANUP_EXCEPTION"
    && syntheticDeletionClock?.separateExactAuthorizationRequired === true
    && syntheticDeletionClock?.minimumDeletionOnlyWindowMinutes === 5
    && syntheticDeletionClock?.maximumDeletionOnlyWindowMinutes === 30
    && syntheticDeletionClock?.ordinaryExecutionMayStartBeforeExpiry === true
    && syntheticDeletionClock?.ordinaryPostExpiryGraceEndsAt
      === SYNTHETIC_DELETION_GRACE_END
    && syntheticDeletionClock
      ?.executionAfterOrdinaryGraceRequiresSeparateExceptionalRecoveryAuthorization
      === true
    && syntheticDeletionClock
      ?.fullDeployOrRedeployAuthorityIsForbiddenInDeletionOnlyWindow
      === true
    && syntheticDeletionClock
      ?.fullDeployRecoveryAfterExpiryRequiresSeparateExceptionalRecoveryAuthorization
      === true
    && destructionClock?.mustNotStartBeforeExpiry === true
    && destructionClock?.excludesBoundedSyntheticSafetyCleanup === true
    && destructionClock?.deactivationReceiptMaterializationAtOrAfterExpiry
      === true
    && destructionClock?.systemClockIsAuthoritative === true
    && safeguards?.controlFalseAndStrictlyAdvancedEpochMustPrecedeSafeBackendDeployment
      === true
    && safeguards?.safeBackendReadbackMustPrecedeWifDisable === true
    && safeguards?.deployIdentityRevocationMustPrecedeWifDisable === true
    && safeguards?.syntheticDeletionUsesOnlyExactDeletionOnlyIdentity
      === true
    && safeguards
      ?.syntheticDeletionDownscopeRequiresSeparateExactAuthorization === true
    && safeguards?.syntheticDeletionIdentityRevocationRunsInGuaranteedFinally
      === true
    && safeguards?.syntheticDeletionIdentityRevocationRequiresNoAuthorization
      === true
    && safeguards
      ?.syntheticDeletionReceiptIsWrittenOnlyAfterAuthenticatedRevokedReadback
      === true
    && safeguards
      ?.syntheticDeletionFirstRunZeroRequiresRetainedTombstoneHistory === true
    && safeguards?.syntheticDeletionZeroWithoutTombstoneHistoryFailsClosed
      === true
    && safeguards?.syntheticDeletionIntentAndReceiptAreImmutableAndCrossBound
      === true
    && safeguards?.syntheticDeletionProductionMutatorRejectsDependencyInjection
      === true
    && safeguards
      ?.externalMutatorsRejectToolModuleTlsProxyAndNodeEnvironmentOverrides
      === true
    && safeguards
      ?.externalNodeChildScriptsUseCanonicalAbsoluteRepositoryPathsAndExplicitCwd
      === true
    && safeguards?.externalChildProcessesUseCleanEnvironmentAndBoundedTimeouts
      === true
    && safeguards?.deactivationExecutionRequiresDirectLiveSafeBackendInventory
      === true
    && safeguards?.deactivationExecutionMustRecollectOnEveryResume === true
    && safeguards
      ?.deactivationProductionMutatorUsesOnlyActualWallClockRealCollectorAndRealCommands
      === true
    && safeguards?.deactivationProductionMutatorReadsExactEvidencePathsInternally
      === true
    && safeguards
      ?.deactivationTestCoreRequiresAllTestDoublesWithoutProductionDefaults
      === true
    && safeguards?.deactivationReceiptMustFollowSafeBackendAndWifVerification
      === true
    && safeguards?.syntheticPayloadDeletionMustPrecedeDeactivationReceipt
      === true
    && safeguards
      ?.syntheticPayloadDeletionEvidenceMustBeValidatedBeforeWifDisable
      === true
    && safeguards
      ?.syntheticPayloadDeletionEvidenceMustMatchFreshLiveInventoryBinding
      === true
    && safeguards?.executionEvidencePathsMustMatchAuthoritativeReceiptPaths
      === true
    && safeguards?.executionEvidenceReadsResolveFromCanonicalRepositoryRoot
      === true
    && safeguards
      ?.executionEvidenceReadsRequireRegularNonSymlinkSingleLinkFiles
      === true
    && safeguards
      ?.executionEvidenceReadsVerifyCanonicalPathAndOpenedFileIdentity
      === true
    && safeguards?.canonicalEvidenceDigestsMustBeCrossBound === true
    && safeguards
      ?.humanConfirmationUsesSeparateImmutableDigestBoundRecorderArtifacts
      === true
    && safeguards?.humanConfirmationRecorderClaimsNoActorIdentityOrSignature
      === true
    && safeguards
      ?.vercelProductionMutatorUsesOnlyActualWallClockAndRealLiveClients
      === true
    && safeguards?.vercelProductionMutatorReadsExactEvidencePathsInternally
      === true
    && safeguards?.noExportedVercelMutatorAcceptsInjectedClockInventoryOrProvider
      === true
    && safeguards
      ?.vercelPostAbsenceReadbacksRequireProjectSettings404AndEmptyDeploymentsDomainsAndEnvironment
      === true
    && safeguards?.wifProviderAndPoolMustBeDisabledBeforeVercelDeletion
      === true
    && safeguards?.humanConfirmationOfVercelAbsenceRequiredBeforeGoogleDestruction
      === true
    && safeguards?.googleDestructionReadsBothExactImmutableConfirmationArtifacts
      === true
    && safeguards?.billingUnlinkIsEmittedOnlyWhenFreshInventoryShowsLinked
      === true
    && safeguards?.alreadyAbsentGoogleProjectIsExplicitZeroCommandNoOp
      === true
    && safeguards?.freshPostVercelInventoryMustUseDestructionPhaseRules
      === true
    && safeguards?.readyVercelDeploymentRequiredAfterVercelDeletion === false
    && safeguards?.enabledWifRequiredAfterDeactivation === false
    && safeEvidence?.evidenceKind
      === "ORDERED_OPERATOR_TRANSCRIPT_AND_AUTHENTICATED_READBACKS"
    && exactOrderedStrings(
      safeEvidence?.requiredAssertions,
      SAFE_BACKEND_EVIDENCE_ASSERTIONS,
    )
    && exactOrderedStrings(
      safeEvidence?.mustPrecedeEvidence,
      ["syntheticDataDeletion", "deactivation"],
    )
    && preTrustRemovalInventory?.inventoryPhase
      === "SAFE_BACKEND_FOR_DESTRUCTION"
    && preTrustRemovalInventory?.source
      === "DIRECT_LIVE_MULTI_PROVIDER_READBACK"
    && preTrustRemovalInventory?.requiredBeforeEveryWifDisableOrResume
      === true
    && preTrustRemovalInventory?.requiresControlFalseAtStrictlyAdvancedEpoch
      === true
    && preTrustRemovalInventory?.requiresIssuanceFalseAtExactProtectedOrigin
      === true
    && preTrustRemovalInventory?.requiresSafeDisabledExactFunctionSet === true
    && preTrustRemovalInventory?.requiresBroadDeployAuthorityRevoked === true
    && preTrustRemovalInventory?.requiresExactDeletionOnlyAuthorityActive
      === true
    && deactivationEvidence?.schemaVersion
      === "wp13.12b-ea-deactivation-execution-receipt-v3"
    && exactOrderedStrings(
      deactivationEvidence?.requiredFields,
      [
        "projectId",
        "stagingExpiryDate",
        "controlEpoch",
        "safeBackendInventoryDigest",
        "syntheticDataDeletionEvidenceSha256",
        "syntheticDataDeletionConfirmationSha256",
      ],
    )
    && exactOrderedStrings(
      protectedPreviewEvidence?.acceptedExecutionClassifications,
      [
        "deletionExecuted=true and alreadyAbsent=false",
        "deletionExecuted=false and alreadyAbsent=true with authenticated retry readback",
      ],
    )
    && exactOrderedStrings(
      deactivationEvidence?.mustBeMaterializedAfter,
      [
        "safeBackendTransition",
        "syntheticDataDeletion",
        "syntheticDataDeletionConfirmation",
      ],
    )
    && syntheticDataDeletionIntentEvidence?.schemaVersion
      === "wp13.12b-synthetic-data-deletion-intent-v1"
    && syntheticDataDeletionIntentEvidence?.path
      === EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionIntent
    && syntheticDataDeletionIntentEvidence?.immutableAtomicFailClosedWrite
      === true
    && syntheticDataDeletionIntentEvidence?.mustPrecedeAnyDeleteInvocation
      === true
    && exactOrderedStrings(
      syntheticDataDeletionIntentEvidence
        ?.acceptedInitialStateClassifications,
      [
        "ACTIVE_SYNTHETIC_DATA_REQUIRES_DELETION",
        "ALREADY_ZERO_WITH_RETAINED_TOMBSTONE_HISTORY",
      ],
    )
    && syntheticDataDeletionIntentEvidence
      ?.zeroSessionIntentRequiresZeroGrantsAndAtLeastOneTombstone === true
    && syntheticDataDeletionIntentEvidence
      ?.bindsPreDeletionInventoryAndSessionAndTombstoneSetDigests === true
    && syntheticDataDeletionIntentEvidence
      ?.bindsExpectedPostDeletionTombstoneSetDigestAndCount === true
    && syntheticDataDeletionIntentEvidence
      ?.syntheticIdentifiersPersistedOrPrinted === false
    && syntheticDataDeletionExecutionReceiptEvidence?.schemaVersion
      === "wp13.12b-synthetic-data-deletion-execution-receipt-v1"
    && syntheticDataDeletionExecutionReceiptEvidence?.path
      === EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionExecution
    && syntheticDataDeletionExecutionReceiptEvidence
      ?.immutableAtomicFailClosedWrite === true
    && exactOrderedStrings(
      syntheticDataDeletionExecutionReceiptEvidence
        ?.acceptedExecutionClassifications,
      [
        "AUTHENTICATED_BOUNDED_DELETION_EXECUTED",
        "AUTHENTICATED_INTENT_RECOVERY_AFTER_COMPLETED_DELETION",
        "AUTHENTICATED_ALREADY_ZERO_WITH_TOMBSTONE_HISTORY_NO_OP",
      ],
    )
    && syntheticDataDeletionExecutionReceiptEvidence
      ?.requiredExactAuthorityStateAfter
      === deployIdentityAuthorityStates.allAuthorityRevoked
    && syntheticDataDeletionExecutionReceiptEvidence
      ?.deletionIdentityRevokedBeforeReceiptWrite === true
    && syntheticDataDeletionExecutionReceiptEvidence
      ?.requiresAuthenticatedPostRevokeGoogleOnlyInventory === true
    && syntheticDataDeletionExecutionReceiptEvidence
      ?.bindsIntentDownscopeRevokeAndPostRevokeDigests === true
    && syntheticDataDeletionExecutionReceiptEvidence
      ?.noOpRequiresZeroDeleteInvocationsAndZeroSyntheticWrites === true
    && syntheticDataDeletionExecutionReceiptEvidence
      ?.syntheticIdentifiersPersistedOrPrinted === false
    && syntheticDataDeletionEvidence?.schemaVersion
      === "wp13.12b-synthetic-data-deletion-evidence-v1"
    && exactOrderedStrings(
      syntheticDataDeletionEvidence?.requiredTrueFields,
      [
        "allActiveSyntheticSessionPayloadsDeleted",
        "tombstoneAndRetentionDecisionSecured",
      ],
    )
    && exactOrderedStrings(
      syntheticDataDeletionEvidence?.requiredFalseFields,
      ["humanConfirmed"],
    )
    && exactOrderedStrings(
      syntheticDataDeletionEvidence?.requiredFields,
      [
        "projectId",
        "stagingExpiryDate",
        "operatorGoogleAccount",
        "controlEpoch",
        "activeSyntheticSessionCount",
        "activeCapabilityGrantCount",
        "tombstoneCount",
        "tombstoneRetentionDisposition",
        "observedAt",
        "observedSyntheticDataInventoryDigest",
        "syntheticDataDeletionIntentSha256",
        "syntheticDataDeletionExecutionReceiptSha256",
        "humanConfirmationText",
        "humanConfirmationSha256",
      ],
    )
    && syntheticDataDeletionEvidence?.requiredExactFields?.projectId
      === APPROVED_SCOPE.projectId
    && syntheticDataDeletionEvidence?.requiredExactFields?.stagingExpiryDate
      === APPROVED_SCOPE.stagingExpiryDate
    && syntheticDataDeletionEvidence?.requiredExactFields
      ?.operatorGoogleAccount === APPROVED_SCOPE.approvedGoogleAccount
    && syntheticDataDeletionEvidence?.requiredExactFields
      ?.activeSyntheticSessionCount === 0
    && syntheticDataDeletionEvidence?.requiredExactFields
      ?.activeCapabilityGrantCount === 0
    && syntheticDataDeletionEvidence?.requiredExactFields
      ?.tombstoneRetentionDisposition
      === SYNTHETIC_TOMBSTONE_RETENTION_DISPOSITION
    && syntheticDataDeletionEvidence?.minimumControlEpoch === 2
    && syntheticDataDeletionEvidence
      ?.tombstoneCountMustBeNonnegativeSafeInteger === true
    && syntheticDataDeletionEvidence
      ?.observedAtMustBeCanonicalIsoTimestamp === true
    && syntheticDataDeletionEvidence
      ?.observedSyntheticDataInventoryDigestMustBeSha256 === true
    && syntheticDataDeletionEvidence
      ?.liveInventoryDigestMustMatchAtDeactivationAndGoogleDestruction
      === true
    && syntheticDataDeletionEvidence?.humanConfirmationTextTemplate
      === SYNTHETIC_DATA_DELETION_CONFIRMATION_TEMPLATE
    && syntheticDataDeletionEvidence
      ?.humanConfirmationSha256MustMatchExactText === true
    && syntheticDataDeletionConfirmationEvidence?.schemaVersion
      === "wp13.12b-synthetic-data-deletion-confirmation-v1"
    && syntheticDataDeletionConfirmationEvidence?.path
      === EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionConfirmation
    && syntheticDataDeletionConfirmationEvidence?.evidencePath
      === EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion
    && syntheticDataDeletionConfirmationEvidence?.evidenceKind
      === "SYNTHETIC_DATA_DELETION"
    && exactOrderedStrings(
      syntheticDataDeletionConfirmationEvidence?.requiredFields,
      [
        "evidenceSha256",
        "confirmationPhrase",
        "confirmationPhraseSha256",
        "recordedAt",
        "recorderClassification",
      ],
    )
    && exactOrderedStrings(
      syntheticDataDeletionConfirmationEvidence?.requiredTrueFields,
      ["immutableRecord"],
    )
    && exactOrderedStrings(
      syntheticDataDeletionConfirmationEvidence?.requiredFalseFields,
      ["actorIdentityClaimed", "signatureClaimed"],
    )
    && syntheticDataDeletionConfirmationEvidence?.recorderClassification
      === CONFIRMATION_RECORDER_CLASSIFICATION
    && syntheticDataDeletionConfirmationEvidence
      ?.recordedAtMustUseActualWallClockAndNotPrecedeEvidenceObservation
      === true
    && syntheticDataDeletionConfirmationEvidence
      ?.confirmationPhraseMustExactlyMatchEvidenceHumanConfirmationText
      === true
    && syntheticDataDeletionConfirmationEvidence
      ?.evidenceSha256MustMatchCanonicalEvidence === true
    && syntheticDataDeletionConfirmationEvidence?.additionalFieldsForbidden
      === true
    && exactOrderedStrings(
      protectedPreviewEvidence?.requiredBindingFields,
      [
        "observedAt",
        "safeBackendInventoryDigest",
        "controlEpoch",
        "deactivationReceiptSha256",
        "syntheticDataDeletionEvidenceSha256",
        "syntheticDataDeletionConfirmationSha256",
        "deploymentsObservedAfterProjectAbsence",
        "domainsObservedAfterProjectAbsence",
        "environmentVariablesObservedAfterProjectAbsence",
        "canonicalAbsenceEvidenceDigest",
        "humanConfirmationText",
        "humanConfirmationSha256",
      ],
    )
    && exactOrderedStrings(
      protectedPreviewEvidence?.requiredTrueFields,
      [
        "authenticatedProviderReadback",
        "projectAbsentAfterDeletion",
        "deploymentsAfterProjectAbsenceReadbackAuthenticated",
        "domainsAfterProjectAbsenceReadbackAuthenticated",
        "environmentVariablesAfterProjectAbsenceReadbackAuthenticated",
        "projectSettingsAfterProjectAbsenceReadbackAuthenticated",
        "projectSettingsAbsentAfterProjectAbsence",
      ],
    )
    && exactOrderedStrings(
      protectedPreviewEvidence?.requiredFalseFields,
      ["humanConfirmed", "tokenPrinted", "oidcTokenPrinted"],
    )
    && protectedPreviewEvidence?.observedAtMustBeCanonicalIsoTimestamp
      === true
    && protectedPreviewEvidence
      ?.canonicalAbsenceEvidenceDigestMustBeSha256 === true
    && protectedPreviewEvidence
      ?.canonicalEvidenceMustCrossBindDeactivationAndSyntheticDigests
      === true
    && protectedPreviewEvidence?.humanConfirmationTextTemplate
      === VERCEL_DESTRUCTION_CONFIRMATION_TEMPLATE
    && protectedPreviewEvidence
      ?.humanConfirmationSha256MustMatchExactText === true
    && protectedPreviewEvidence?.postAbsenceObservedCountsMustAllBeZero
      === true
    && protectedPreviewConfirmationEvidence?.schemaVersion
      === "wp13.12b-preview-destruction-confirmation-v1"
    && protectedPreviewConfirmationEvidence?.path
      === EXECUTION_EVIDENCE_PATHS.previewDestructionConfirmation
    && protectedPreviewConfirmationEvidence?.evidencePath
      === EXECUTION_EVIDENCE_PATHS.previewDestruction
    && protectedPreviewConfirmationEvidence?.evidenceKind
      === "PREVIEW_DESTRUCTION"
    && exactOrderedStrings(
      protectedPreviewConfirmationEvidence?.requiredFields,
      [
        "evidenceSha256",
        "confirmationPhrase",
        "confirmationPhraseSha256",
        "recordedAt",
        "recorderClassification",
      ],
    )
    && exactOrderedStrings(
      protectedPreviewConfirmationEvidence?.requiredTrueFields,
      ["immutableRecord"],
    )
    && exactOrderedStrings(
      protectedPreviewConfirmationEvidence?.requiredFalseFields,
      ["actorIdentityClaimed", "signatureClaimed"],
    )
    && protectedPreviewConfirmationEvidence?.recorderClassification
      === CONFIRMATION_RECORDER_CLASSIFICATION
    && protectedPreviewConfirmationEvidence
      ?.recordedAtMustUseActualWallClockAndNotPrecedeEvidenceObservation
      === true
    && protectedPreviewConfirmationEvidence
      ?.confirmationPhraseMustExactlyMatchEvidenceHumanConfirmationText
      === true
    && protectedPreviewConfirmationEvidence
      ?.evidenceSha256MustMatchCanonicalEvidence === true
    && protectedPreviewConfirmationEvidence?.additionalFieldsForbidden
      === true
    && materialization?.safeBackendSequenceSource
      === `${LOCAL_PATHS.destructionPlan}#orderedCommands`
    && materialization?.syntheticDataDeletionExecutionCommand
      === (
        "node scripts/wp13-12b-external-resource-operator.mjs "
        + "--action delete-synthetic-data --window-expires-at "
        + "<UTC-ISO-WITHIN-30-MINUTES-AND-NO-LATER-THAN-"
        + "2027-01-26T00:00:00.000Z> --execute "
        + `"${EXECUTION_AUTHORIZATION.syntheticDataDeletion}"`
      )
    && materialization?.syntheticDataDeletionEvidencePlanCommand
      === (
        "node scripts/wp13-12b-external-resource-operator.mjs "
        + "--action synthetic-data-deletion-evidence-plan"
      )
    && materialization?.syntheticDataDeletionConfirmationCommand
      === (
        "node scripts/wp13-12b-external-resource-operator.mjs "
        + "--action record-synthetic-data-deletion-confirmation "
        + '--confirm-human-phrase "<EXACT_humanConfirmationText_'
        + 'FROM_SYNTHETIC_EVIDENCE>"'
      )
    && materialization?.previewDestructionConfirmationCommand
      === (
        "node scripts/wp13-12b-external-resource-operator.mjs "
        + "--action record-preview-destruction-confirmation "
        + '--confirm-human-phrase "<EXACT_humanConfirmationText_'
        + 'FROM_PREVIEW_EVIDENCE>"'
      )
    && materialization?.executionEvidencePaths?.syntheticDataDeletion
      === EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion
    && materialization?.executionEvidencePaths?.syntheticDataDeletionIntent
      === EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionIntent
    && materialization?.executionEvidencePaths
      ?.syntheticDataDeletionExecution
      === EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionExecution
    && materialization?.executionEvidencePaths
      ?.syntheticDataDeletionConfirmation
      === EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionConfirmation
    && materialization?.executionEvidencePaths?.deactivation
      === EXECUTION_EVIDENCE_PATHS.deactivation
    && materialization?.executionEvidencePaths?.previewDestruction
      === EXECUTION_EVIDENCE_PATHS.previewDestruction
    && materialization?.executionEvidencePaths
      ?.previewDestructionConfirmation
      === EXECUTION_EVIDENCE_PATHS.previewDestructionConfirmation
    && materialization?.executionEvidenceWritesAreAtomicAndFailClosed
      === true
    && materialization
      ?.executionEvidenceReadsAreCanonicalRegularSingleLinkFiles === true
    && materialization?.identicalExistingEvidenceIsAnIdempotentNoOp
      === true
    && materialization?.differentExistingEvidenceBlocksReplacement === true
    && materialization?.deactivationCommandRole
      === (
        "AT_OR_AFTER_EXPIRY_RECEIPT_MATERIALIZATION_AFTER_SAFE_BACKEND_TRANSITION; "
        + "NOT_A_STANDALONE_SAFE_BACKEND_ORCHESTRATOR"
      )
    && materialization?.freshInventoryRequiredBeforeEveryGoogleResume === true
    && materialization?.firebaseToolsOAuthToolchain?.moduleRoot
      === (
        "C:\\Users\\tryak\\AppData\\Roaming\\npm\\node_modules\\"
        + "firebase-tools"
      )
    && materialization?.firebaseToolsOAuthToolchain?.version === "15.22.4"
    && materialization?.firebaseToolsOAuthToolchain?.treeAlgorithm
      === "SORTED_RELATIVE_PATH_CODE_UNIT_NUL_SIZE_NUL_SHA256_LF_V1"
    && materialization?.firebaseToolsOAuthToolchain?.regularFileCount
      === 19_417
    && materialization?.firebaseToolsOAuthToolchain?.totalBytes
      === 189_433_946
    && materialization?.firebaseToolsOAuthToolchain?.treeSha256
      === "fdbf5c3e8c960490a3bec6097989127616f33d396115a6b5f911372722fbe7fa"
    && materialization?.firebaseToolsOAuthToolchain
      ?.verifiedBeforeAnyFirebaseToolsRequire === true
    && materialization?.firebaseToolsOAuthToolchain
      ?.oauthAccessTokenTransferredOnlyOverIsolatedIpc === true
    && materialization?.firebaseToolsOAuthToolchain
      ?.tokenPrintedOrPersisted === false
    && materialization?.vercelCliToolchain?.moduleRoot
      === approvedVercelCliModuleRoot
    && materialization?.vercelCliToolchain?.version === "58.0.0"
    && materialization?.vercelCliToolchain?.treeAlgorithm
      === "ASCII_CODE_UNIT_SORTED_RELATIVE_PATH_NUL_SIZE_NUL_SHA256_LF_V2"
    && materialization?.vercelCliToolchain?.regularFileCount === 6_731
    && materialization?.vercelCliToolchain?.treeSha256
      === "4d97f7ef1a2631946dd5344d29db7ad9b931782e24bd478ea2a4241e2a0f57fc"
    && exactOrderedStrings(
      materialization?.vercelCliToolchain
        ?.forbiddenInstallLogPaths,
      [
        "npm-install.stderr.log",
        "npm-install.stdout.log",
      ],
    )
    && materialization?.vercelCliToolchain
      ?.forbiddenInstallLogsAbsent === true
    && materialization?.vercelCliToolchain?.globalAuthConfigRoot
      === APPROVED_VERCEL_CLI_AUTH_CONFIG_ROOT
    && materialization?.vercelCliToolchain?.ambientModuleRootAllowed
      === false
    && materialization?.vercelCliToolchain?.verifiedBeforeCredentialLoad
      === true
    && materialization?.vercelCliToolchain?.tokenPrintedOrPersisted
      === false
    && materialization?.googleCloudCliToolchain?.moduleRoot
      === (
        "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
        + "gcloud-577.0.0\\google-cloud-sdk"
      )
    && materialization?.googleCloudCliToolchain?.version === "577.0.0"
    && materialization?.googleCloudCliToolchain?.archiveName
      === "google-cloud-sdk-577.0.0-windows-x86_64-bundled-python.zip"
    && materialization?.googleCloudCliToolchain?.acquiredFrom
      === (
        "https://storage.googleapis.com/cloud-sdk-release/"
        + "google-cloud-sdk-577.0.0-windows-x86_64-bundled-python.zip"
      )
    && materialization?.googleCloudCliToolchain?.officialMirror
      === (
        "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/"
        + "google-cloud-sdk-577.0.0-windows-x86_64-bundled-python.zip"
      )
    && materialization?.googleCloudCliToolchain?.archiveBytes
      === 110_769_066
    && materialization?.googleCloudCliToolchain?.archiveSha256
      === "dcf9097b2c7a0a29bd6322571f5090c6046bed96b19c0750e62f549b735b80eb"
    && materialization?.googleCloudCliToolchain?.logicalCommand
      === "gcloud"
    && materialization?.googleCloudCliToolchain?.commandShim
      === (
        "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
        + "gcloud-577.0.0\\google-cloud-sdk\\bin\\gcloud.cmd"
      )
    && materialization?.googleCloudCliToolchain?.commandShimExecuted
      === false
    && materialization?.googleCloudCliToolchain?.physicalExecutable
      === (
        "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
        + "gcloud-577.0.0\\google-cloud-sdk\\platform\\"
        + "bundledpython\\python.exe"
      )
    && materialization?.googleCloudCliToolchain
      ?.physicalExecutableBytes === 106_208
    && materialization?.googleCloudCliToolchain
      ?.physicalExecutableSha256
      === "03168c01b7b7491423350e82c26fee71f35b43694d1319d3c668bda6903a0c38"
    && materialization?.googleCloudCliToolchain?.pythonEntrypoint
      === (
        "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
        + "gcloud-577.0.0\\google-cloud-sdk\\lib\\gcloud.py"
      )
    && materialization?.googleCloudCliToolchain
      ?.pythonEntrypointBytes === 6_579
    && materialization?.googleCloudCliToolchain
      ?.pythonEntrypointSha256
      === "d223bce54ff2e1441268e73b06eec4830032dd7b4b17b8fa9e2638d4f6d8d39d"
    && exactOrderedStrings(
      materialization?.googleCloudCliToolchain?.pythonFlags,
      ["-I", "-S", "-B"],
    )
    && materialization?.googleCloudCliToolchain?.treeAlgorithm
      === "SORTED_RELATIVE_PATH_CODE_UNIT_NUL_SIZE_NUL_SHA256_LF_V1"
    && materialization?.googleCloudCliToolchain?.regularFileCount === 29_931
    && materialization?.googleCloudCliToolchain?.directoryCount === 5_662
    && materialization?.googleCloudCliToolchain?.totalBytes === 459_287_508
    && materialization?.googleCloudCliToolchain?.treeSha256
      === "da1f9c6799bb76a3bae3e59bd138b68ef4954dbc396306357c5babf46c34423d"
    && materialization?.googleCloudCliToolchain
      ?.symlinkReparseSpecialEntryCount === 0
    && materialization?.googleCloudCliToolchain?.hardlinkEntryCount === 0
    && materialization?.googleCloudCliToolchain
      ?.archiveSymlinkModeEntryCount === 6
    && materialization?.googleCloudCliToolchain
      ?.archiveSymlinkEntriesMaterializedAsRegularFiles === 6
    && materialization?.googleCloudCliToolchain
      ?.requiredBeforeAnyGoogleCliProcess === true
    && materialization?.googleCloudCliToolchain
      ?.pathOrEnvironmentOverrideAllowed === false
    && materialization?.googleCloudCliToolchain?.oauthAccessTokenSource
      === "PINNED_FIREBASE_TOOLS_ISOLATED_IPC_HELPER"
    && materialization?.googleCloudCliToolchain
      ?.oauthAccessTokenInjectedOnlyIntoCleanChildEnvironment === true
    && materialization?.googleCloudCliToolchain
      ?.ownedCloudSdkConfigCreatedPerCommand === true
    && materialization?.googleCloudCliToolchain
      ?.ownedCloudSdkConfigRemovedInFinally === true
    && materialization?.googleCloudCliToolchain
      ?.maximumCommandTimeoutMs === 600_000
    && materialization?.googleCloudCliToolchain
      ?.maximumOutputBytes === 1_048_576
    && materialization?.googleCloudCliToolchain
      ?.inheritedDangerousEnvironmentRejected === true
    && materialization?.googleCloudCliToolchain?.execArgvMustBeEmpty
      === true
    && materialization?.googleCloudCliToolchain
      ?.accessTokenPrintedOrPersisted === false
    && materialization?.googleCloudCliToolchain
      ?.firebaseHostingDestructionFailsClosedUntilPinnedAdapter === true
    && exactOrderedStrings(
      materialization?.deactivationExecutionRequires,
      [
        "--execute <exact deactivation authorization string>",
        "--control-epoch <strictly advanced safe integer>",
        `--synthetic-data-deletion-evidence ${
          EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion
        }`,
        "exact synthetic deletion evidence and immutable confirmation read internally",
        "direct live SAFE_BACKEND_FOR_DESTRUCTION inventory recollected in-process",
      ],
    )
    && exactOrderedStrings(
      materialization?.vercelExecutionRequires,
      [
        "--execute <exact vercelDestruction authorization string>",
        `--confirm-vercel-team-id ${APPROVED_SCOPE.vercelTeamId}`,
        `--confirm-vercel-project-id ${APPROVED_SCOPE.vercelProjectId}`,
        `--deactivation-receipt ${EXECUTION_EVIDENCE_PATHS.deactivation}`,
        `--synthetic-data-deletion-evidence ${
          EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion
        }`,
        "exact deactivation, synthetic deletion evidence and immutable confirmation read internally",
        "fresh combined live inventory proving exact deactivation epoch, deletion binding, and disabled WIF",
      ],
    )
    && exactOrderedStrings(
      materialization?.googleDestructionExecutionRequires,
      [
        EXECUTION_EVIDENCE_PATHS.deactivation,
        EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion,
        EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionConfirmation,
        EXECUTION_EVIDENCE_PATHS.previewDestruction,
        EXECUTION_EVIDENCE_PATHS.previewDestructionConfirmation,
        "fresh authenticated combined inventory and exact confirmed inventory digest",
      ],
    )
    && repeatSafety?.freshAuthenticatedInventoryRequiredBeforeEveryGoogleResume
      === true
    && repeatSafety
      ?.freshAuthenticatedSafeBackendInventoryRequiredBeforeEveryDeactivationResume
      === true
    && repeatSafety
      ?.alreadyDisabledWifSubstepsAreSkippedOnlyAfterFreshExactReadback
      === true
    && repeatSafety?.postVercelAbsenceSelectsDestructionInventoryPhase === true
    && repeatSafety?.readyVercelDeploymentRequiredAfterVercelDeletion === false
    && repeatSafety?.enabledWifRequiredAfterDeactivation === false
    && repeatSafety?.onlyObservedApprovedRemainingResourcesAreMaterialized
      === true
    && repeatSafety?.alreadyAbsentApprovedResourcesAreNoOp === true
    && repeatSafety
      ?.alreadyZeroSyntheticDataWithRetainedTombstoneHistoryIsAuthenticatedNoOp
      === true
    && repeatSafety
      ?.alreadyZeroSyntheticDataWithoutTombstoneHistoryBlocksFirstRun
      === true
    && repeatSafety
      ?.existingSyntheticDeletionReceiptRetryRevokesIdentityAgainBeforeReadback
      === true
    && repeatSafety
      ?.syntheticDeletionFailureNeverSkipsGuaranteedIdentityRevocation
      === true
    && repeatSafety
      ?.broadRedeployRecoveryAfterExpiryIsNeverImplicitlyReenabled
      === true
    && repeatSafety?.alreadyAbsentGoogleProjectIsVerifiedZeroCommandNoOp
      === true
    && repeatSafety
      ?.billingUnlinkIsSkippedWhenFreshInventoryShowsAlreadyUnlinked
      === true
    && repeatSafety?.partialApprovedFunctionSetMayBeRetiredAcrossRetries
      === true
    && repeatSafety?.issueSyntheticSessionDeletedFirstWhenPresent === true
    && repeatSafety?.staleMaterializedCommandsMustNotBeReplayed === true
    && repeatSafety?.unknownOrUnapprovedResourcesBlockResume === true
    && repeatSafety?.completionRequiresFreshCombinedZeroResourceInventory
      === true
    && repeatSafety?.resumeRule
      === (
        "RECOLLECT_AUTHENTICATED_COMBINED_INVENTORY_AND_MATERIALIZE_ONLY_"
        + "THE_OBSERVED_APPROVED_REMAINDER"
      )
    && exactOrderedStrings(
      vercelDestructionBoundary?.authenticatedPostAbsenceReadbacksRequired,
      [
        "exact project settings endpoint returns authenticated 404",
        "deployments",
        "domains",
        "project environment variables",
      ],
    )
    && vercelDestructionBoundary?.allPostAbsenceChildCountsMustBeZero
      === true
    && vercelDestructionBoundary
      ?.projectCascadeAbsenceIsNotAssumedWithoutReadback === true
    && planCommandsExact
  );
  if (!valid) {
    throw operatorError("EXPIRY_DESTRUCTION_CONTRACT_SEQUENCE_MISMATCH");
  }
  return true;
}

export function assertInventoryOutputPath(path) {
  if (path !== INVENTORY_EVIDENCE_OUTPUT) {
    throw operatorError("EXACT_INVENTORY_EVIDENCE_OUTPUT_PATH_REQUIRED");
  }
  return path;
}

function assertNoCredentialFields(value, path = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoCredentialFields(entry, [...path, index]));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (
      /^(accessToken|authorization|credentials|idToken|oidcToken|refreshToken|token)$/iu
        .test(key)
    ) {
      throw operatorError(
        `INVENTORY_EVIDENCE_CREDENTIAL_FIELD_FORBIDDEN_${[...path, key].join("_")}`,
      );
    }
    assertNoCredentialFields(entry, [...path, key]);
  }
}

function assertNoSyntheticIdentifierFieldsOrValues(
  value,
  path = [],
) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoSyntheticIdentifierFieldsOrValues(
        entry,
        [...path, index],
      ));
    return;
  }
  if (typeof value === "string") {
    if (
      /synthetic-wp13-12b-[A-Za-z0-9_-]{20,64}/u.test(value)
      || /\/documents\/synthetic(?:CapabilityGrants|Sessions|SessionTombstones)\//u
        .test(value)
      || /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/u
        .test(value)
    ) {
      throw operatorError(
        `SYNTHETIC_IDENTIFIER_OR_TOKEN_VALUE_FORBIDDEN_${
          path.join("_")
        }`,
      );
    }
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (
      /^(capability|capabilityGrant|capabilityGrantId|documentName|documentNames|grantId|nonce|sessionId|syntheticSessionId)$/iu
        .test(key)
    ) {
      throw operatorError(
        `SYNTHETIC_IDENTIFIER_FIELD_FORBIDDEN_${[...path, key].join("_")}`,
      );
    }
    assertNoSyntheticIdentifierFieldsOrValues(
      entry,
      [...path, key],
    );
  }
}

function iamMemberCategoryCounts(members) {
  const counts = {
    domain: 0,
    group: 0,
    principal: 0,
    principalSet: 0,
    public: 0,
    serviceAccount: 0,
    user: 0,
    other: 0,
  };
  for (const member of members) {
    if (
      member === "allUsers"
      || member === "allAuthenticatedUsers"
    ) {
      counts.public += 1;
      continue;
    }
    const prefix = String(member).split(":", 1)[0];
    if (Object.hasOwn(counts, prefix)) {
      counts[prefix] += 1;
    } else if (String(member).startsWith("principal://")) {
      counts.principal += 1;
    } else if (String(member).startsWith("principalSet://")) {
      counts.principalSet += 1;
    } else {
      counts.other += 1;
    }
  }
  return counts;
}

function redactIamMemberArrays(value) {
  if (Array.isArray(value)) {
    value.forEach(redactIamMemberArrays);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const key of ["members", "invokerMembers"]) {
    if (!Array.isArray(value[key])) continue;
    const members = value[key].map(String).sort();
    const prefix = key === "members" ? "member" : "invokerMember";
    value[`${prefix}Count`] = members.length;
    value[`${prefix}SetSha256`] = digestValue(members);
    value[`${prefix}CategoryCounts`] =
      iamMemberCategoryCounts(members);
    value[`${prefix}IdentifiersPersistedOrPrinted`] = false;
    delete value[key];
  }
  for (const entry of Object.values(value)) {
    redactIamMemberArrays(entry);
  }
}

export function redactInventoryForEvidence(report) {
  if (
    report?.schemaVersion
      !== "wp13.12b-ea-operator-resource-inventory-v2"
    || report?.mode !== "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION"
  ) throw operatorError("SANITIZED_INVENTORY_REPORT_REQUIRED");
  const redacted = structuredClone(report);
  const collections =
    redacted?.resources?.firestoreDataInventory?.collections;
  if (Array.isArray(collections)) {
    for (const collection of collections) {
      if (
        !Array.isArray(collection.documentNames)
        || collection.documentNames.length !== collection.count
      ) throw operatorError("EXACT_SYNTHETIC_DOCUMENT_INVENTORY_REQUIRED");
      collection.documentSetSha256 = digestValue(
        [...collection.documentNames].sort(),
      );
      delete collection.documentNames;
    }
  }
  if (
    redacted?.resources?.firestoreDataInventory !== undefined
  ) {
    redacted.resources.firestoreDataInventory
      .syntheticDocumentIdentifiersPersistedOrPrinted = false;
  }
  redactIamMemberArrays(redacted);
  assertNoCredentialFields(redacted);
  assertNoSyntheticIdentifierFieldsOrValues(redacted);
  return redacted;
}

export function materializeInventoryEvidenceDocument(
  report,
  outputPath,
) {
  const exactPath = assertInventoryOutputPath(outputPath);
  const redactedReport = redactInventoryForEvidence(report);
  if (
    redactedReport.externalWrites !== 0
    || !/^[a-f0-9]{64}$/u.test(
      redactedReport.inventoryDigest ?? "",
    )
    || redactedReport.resources?.vercel?.tokenPrinted !== false
    || redactedReport.resources?.vercel?.oidcTokenPrinted !== false
  ) throw operatorError("SANITIZED_INVENTORY_REPORT_REQUIRED");
  return Object.freeze({
    content: `${JSON.stringify(redactedReport, null, 2)}\n`,
    inventoryDigest: report.inventoryDigest,
    outputPath: exactPath,
  });
}

export async function writeInventoryEvidence(
  report,
  outputPath,
) {
  const document = materializeInventoryEvidenceDocument(
    report,
    outputPath,
  );
  const localEvidenceWrites = await writeCanonicalExclusiveContent(
    document.outputPath,
    document.content,
  );
  return {
    schemaVersion: "wp13.12b-ea-inventory-evidence-write-result-v1",
    outputPath: document.outputPath,
    inventoryDigest: document.inventoryDigest,
    providerExternalWrites: 0,
    localEvidenceWrites,
    tokenPrinted: false,
    oidcTokenPrinted: false,
  };
}

async function readCanonicalRegularBytes(path) {
  const parent = await recoverInterruptedEvidenceHardLink(path);
  const before = await assertCanonicalEvidenceFile(
    parent.targetPath,
    parent.expectedTarget,
  );
  const handle = await open(parent.targetPath, "r");
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== before.dev
      || opened.ino !== before.ino
      || opened.nlink !== 1
    ) throw operatorError(
      "CANONICAL_REGULAR_UNLINKED_EVIDENCE_FILE_REQUIRED",
    );
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function writeCanonicalExclusiveContent(
  path,
  content,
  {
    cleanupFailureCode =
      "ATOMIC_INVENTORY_EVIDENCE_CLEANUP_FAILED",
    differingEvidenceCode =
      "EXISTING_INVENTORY_EVIDENCE_DIFFERS_FAIL_CLOSED",
    existingContentMatches = async () => (
      await readCanonicalRegularBytes(path)
    ).equals(Buffer.from(content, "utf8")),
    linkFailureCode = "ATOMIC_INVENTORY_EVIDENCE_LINK_FAILED",
  } = {},
) {
  const parent = await recoverInterruptedEvidenceHardLink(path);
  const tempPath =
    `${parent.targetPath}.tmp-${process.pid}-${randomBytes(16).toString("hex")}`;
  let handle;
  let openedIdentity;
  let tempWasCreated = false;
  let targetWasLinked = false;
  try {
    handle = await open(tempPath, "wx", 0o600);
    tempWasCreated = true;
    openedIdentity = await handle.stat();
    if (
      !openedIdentity.isFile()
      || openedIdentity.nlink !== 1
    ) throw operatorError("ATOMIC_EVIDENCE_TEMP_FILE_INVALID");
    const linkedTemp = await assertCanonicalEvidenceFile(
      tempPath,
      `${parent.expectedTarget}${tempPath.slice(parent.targetPath.length)}`,
      {
        parentMetadata: parent.parentMetadata,
        requireOperatorOwnedTemp: true,
      },
    );
    if (
      linkedTemp.dev !== openedIdentity.dev
      || linkedTemp.ino !== openedIdentity.ino
    ) throw operatorError("ATOMIC_EVIDENCE_TEMP_FILE_INVALID");
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await reassertCanonicalEvidenceParentChain(parent);
    await handle.close();
    handle = undefined;
    const closedTemp = await assertCanonicalEvidenceFile(
      tempPath,
      `${parent.expectedTarget}${tempPath.slice(parent.targetPath.length)}`,
      {
        parentMetadata: parent.parentMetadata,
        requireOperatorOwnedTemp: true,
      },
    );
    if (
      closedTemp.dev !== openedIdentity.dev
      || closedTemp.ino !== openedIdentity.ino
    ) throw operatorError("ATOMIC_EVIDENCE_TEMP_FILE_INVALID");
    try {
      await link(tempPath, parent.targetPath);
      targetWasLinked = true;
      await reassertCanonicalEvidenceParentChain(parent);
      const linkedTarget = await assertCanonicalEvidenceFile(
        parent.targetPath,
        parent.expectedTarget,
        { allowedLinkCounts: [2] },
      );
      if (
        linkedTarget.dev !== openedIdentity.dev
        || linkedTarget.ino !== openedIdentity.ino
      ) throw operatorError("ATOMIC_EVIDENCE_TARGET_FILE_INVALID");
      await syncEvidenceParent(parent.parentPath);
      return 1;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        if (error?.message === error?.code) throw error;
        throw operatorError(linkFailureCode);
      }
      if (!await existingContentMatches()) {
        throw operatorError(differingEvidenceCode);
      }
      return 0;
    }
  } finally {
    if (handle !== undefined) await handle.close().catch(() => {});
    if (tempWasCreated) {
      await reassertCanonicalEvidenceParentChain(parent);
      let removed = false;
      await unlink(tempPath).then(
        () => {
          removed = true;
        },
        (error) => {
          if (error?.code !== "ENOENT") {
            throw operatorError(cleanupFailureCode);
          }
        },
      );
      if (removed) await syncEvidenceParent(parent.parentPath);
      if (targetWasLinked) {
        await reassertCanonicalEvidenceParentChain(parent);
        const materializedTarget = await assertCanonicalEvidenceFile(
          parent.targetPath,
          parent.expectedTarget,
        );
        if (
          materializedTarget.dev !== openedIdentity.dev
          || materializedTarget.ino !== openedIdentity.ino
        ) throw operatorError("ATOMIC_EVIDENCE_TARGET_FILE_INVALID");
      }
    }
  }
}

async function writeExecutionEvidence(kind, evidence) {
  const outputPath = assertExecutionEvidencePath(
    kind,
    EXECUTION_EVIDENCE_PATHS[kind],
  );
  assertNoCredentialFields(evidence);
  assertNoSyntheticIdentifierFieldsOrValues(evidence);
  const content = `${JSON.stringify(stableValue(evidence), null, 2)}\n`;
  const localEvidenceWrites = await writeCanonicalExclusiveContent(
    outputPath,
    content,
    {
      cleanupFailureCode:
        "ATOMIC_EXECUTION_EVIDENCE_CLEANUP_FAILED",
      differingEvidenceCode:
        "EXISTING_EXECUTION_EVIDENCE_DIFFERS_FAIL_CLOSED",
      existingContentMatches: async () => {
      const existing = await readCanonicalRegularEvidenceFile(
        kind,
        outputPath,
      );
        return digestValue(existing) === digestValue(evidence);
      },
      linkFailureCode: "ATOMIC_EXECUTION_EVIDENCE_LINK_FAILED",
    },
  );
  return {
    outputPath,
    canonicalEvidenceSha256: digestValue(evidence),
    localEvidenceWrites,
    retryClassification: localEvidenceWrites === 0
      ? "IDENTICAL_EVIDENCE_ALREADY_MATERIALIZED"
      : "ATOMIC_FIRST_MATERIALIZATION",
  };
}

export async function loadAndValidateOperatorContracts() {
  const [
    approval,
    ownerAuthorization,
    inventoryContract,
    executionContract,
    destructionPlan,
    trustContract,
  ] =
    await Promise.all([
      readJson(LOCAL_PATHS.approval),
      readJson(LOCAL_PATHS.ownerAuthorization),
      readJson(LOCAL_PATHS.inventoryContract),
      readJson(LOCAL_PATHS.executionContract),
      readJson(LOCAL_PATHS.destructionPlan),
      readJson(LOCAL_PATHS.trustContract),
    ]);
  const errors = [];
  const bindings = [
    approval,
    inventoryContract.approvalBinding,
    executionContract.approvalBinding,
  ];
  for (const binding of bindings) {
    if ((binding.plannedProjectId ?? binding.projectId) !== APPROVED_SCOPE.projectId) {
      errors.push("PROJECT_ID_BINDING_MISMATCH");
    }
    if (
      (binding.approvedGoogleAccount ?? binding.approvedGoogleAccountOrOrganizationContext)
      !== APPROVED_SCOPE.approvedGoogleAccount
    ) errors.push("GOOGLE_ACCOUNT_BINDING_MISMATCH");
    if ((binding.approvedOrganizationId ?? binding.organizationId) !== APPROVED_SCOPE.organizationId) {
      errors.push("ORGANIZATION_BINDING_MISMATCH");
    }
    if ((binding.approvedBillingAccount ?? binding.billingAccount) !== APPROVED_SCOPE.billingAccount) {
      errors.push("BILLING_BINDING_MISMATCH");
    }
    if ((binding.selectedRegion ?? binding.region) !== APPROVED_SCOPE.region) {
      errors.push("REGION_BINDING_MISMATCH");
    }
    if (binding.stagingExpiryDate !== APPROVED_SCOPE.stagingExpiryDate) {
      errors.push("EXPIRY_BINDING_MISMATCH");
    }
  }
  if (
    ownerAuthorization.authorization !== "AUTHORIZE_WP13_12B_EXTERNAL_ACTIVATION"
    || ownerAuthorization.stagingExpiryDate !== APPROVED_SCOPE.stagingExpiryDate
    || ownerAuthorization.automaticDeletionPolicy?.authorized !== true
    || !ownerAuthorization.servicesRequiredToRemainOff?.includes("Cloud Storage")
  ) errors.push("OWNER_EXPIRY_AUTHORIZATION_MISMATCH");
  if (
    destructionPlan.schemaVersion !== "wp13.12b-staging-destruction-v3"
    || destructionPlan.ownerApprovedExpiryDate !== APPROVED_SCOPE.stagingExpiryDate
    || destructionPlan.executionContract !== LOCAL_PATHS.executionContract
    || destructionPlan.syntheticDeletionWindow
      ?.separateExactAuthorizationRequired !== true
    || destructionPlan.syntheticDeletionWindow?.minimumMinutes !== 5
    || destructionPlan.syntheticDeletionWindow?.maximumMinutes !== 30
    || destructionPlan.syntheticDeletionWindow?.ordinaryGraceEndsAt
      !== SYNTHETIC_DELETION_GRACE_END
    || destructionPlan.syntheticDeletionWindow?.broadDeployOrRedeployAllowed
      !== false
    || destructionPlan.syntheticDeletionWindow?.executionAfterOrdinaryGrace
      !== "SEPARATE_EXCEPTIONAL_RECOVERY_AUTHORIZATION_REQUIRED"
    || destructionPlan.expiryExecutionStatus
      !== "AUTHORIZED_AT_EXPIRY_NOT_SCHEDULED"
    || destructionPlan.schedulerReceipt !== null
    || destructionPlan.externalActionsExecuted !== false
  ) errors.push("DESTRUCTION_PLAN_BINDING_MISMATCH");
  if (
    executionContract.schemaVersion
      !== "wp13.12b-ea-expiry-destruction-execution-contract-v4"
    || executionContract.existingOwnerAuthorization?.expiryExecutionStatus
      !== "AUTHORIZED_AT_EXPIRY_NOT_SCHEDULED"
    || executionContract.existingOwnerAuthorization?.schedulerReceipt !== null
  ) errors.push("EXPIRY_EXECUTION_SCHEDULING_STATUS_MISMATCH");
  try {
    validateExpiryDestructionContract(executionContract, destructionPlan);
  } catch (error) {
    errors.push(
      error?.code ?? "EXPIRY_DESTRUCTION_CONTRACT_SEQUENCE_MISMATCH",
    );
  }
  if (
    executionContract.executionAuthorizationStrings
      ?.syntheticDataDeletion
      !== EXECUTION_AUTHORIZATION.syntheticDataDeletion
    || executionContract.executionAuthorizationStrings?.deactivation
      !== EXECUTION_AUTHORIZATION.deactivation
    || executionContract.executionAuthorizationStrings?.vercelDestruction
      !== EXECUTION_AUTHORIZATION.vercelDestruction
    || executionContract.executionAuthorizationStrings?.destruction
      !== EXECUTION_AUTHORIZATION.destruction
  ) errors.push("EXECUTION_AUTHORIZATION_BINDING_MISMATCH");
  if (
    inventoryContract.storagePolicy?.appCloudStorage !== "MUST_REMAIN_OFF"
    || inventoryContract.storagePolicy?.supportingBuildArtifactsAreAppStorage !== false
  ) errors.push("STORAGE_CLASSIFICATION_CONTRACT_MISMATCH");
  if (
    trustContract.google?.projectId !== APPROVED_SCOPE.projectId
    || trustContract.google?.projectNumber !== APPROVED_SCOPE.projectNumber
    || trustContract.google?.workloadIdentityPoolId !== APPROVED_SCOPE.workloadIdentityPoolId
    || trustContract.google?.workloadIdentityProviderId
      !== APPROVED_SCOPE.workloadIdentityProviderId
    || trustContract.google?.previewServiceAccountEmail
      !== APPROVED_SCOPE.previewServiceAccount
    || JSON.stringify(
      [...asArray(trustContract.google?.privateFunctionInvokerTargets)].sort(),
    ) !== JSON.stringify([...PRIVATE_PREVIEW_INVOKER_FUNCTIONS].sort())
    || JSON.stringify(
      [...asArray(trustContract.google?.previewInvokerRevocationTargets)].sort(),
    ) !== JSON.stringify(["health"])
    || trustContract.vercel?.teamId !== APPROVED_SCOPE.vercelTeamId
    || trustContract.vercel?.teamSlug !== APPROVED_SCOPE.vercelTeamSlug
    || trustContract.vercel?.projectId !== APPROVED_SCOPE.vercelProjectId
    || trustContract.vercel?.projectName !== APPROVED_SCOPE.vercelProjectName
    || trustContract.vercel?.environment !== "preview"
    || trustContract.vercel?.issuerMode !== "team"
    || trustContract.vercel?.issuer !== APPROVED_TRUST.issuer
    || trustContract.vercel?.audience !== APPROVED_TRUST.audience
    || trustContract.vercel?.subject !== APPROVED_TRUST.subject
    || JSON.stringify(stableValue(trustContract.provider?.attributeMapping))
      !== JSON.stringify(stableValue(APPROVED_TRUST.attributeMapping))
    || trustContract.provider?.attributeCondition !== APPROVED_TRUST.attributeCondition
    || trustContract.securityBoundary?.exactSubjectBindingOnly !== true
    || trustContract.securityBoundary?.wholePoolImpersonationBinding !== false
    || trustContract.securityBoundary?.serviceAccountKeys !== false
  ) errors.push("VERCEL_GOOGLE_TRUST_CONTRACT_MISMATCH");
  if (
    inventoryContract.previewBoundary?.teamId !== APPROVED_SCOPE.vercelTeamId
    || inventoryContract.previewBoundary?.projectId !== APPROVED_SCOPE.vercelProjectId
    || inventoryContract.previewBoundary?.inventoryStatus
      !== "REQUIRED_IN_SAME_OPERATOR_SNAPSHOT"
  ) errors.push("VERCEL_INVENTORY_CONTRACT_MISMATCH");
  if (errors.length > 0) throw operatorError([...new Set(errors)].join(","));
  return {
    approval,
    ownerAuthorization,
    inventoryContract,
    executionContract,
    destructionPlan,
    trustContract,
  };
}

function commandEnvironment() {
  const allowed = new Set([
    "APPDATA",
    "HOMEDRIVE",
    "HOMEPATH",
    "LOCALAPPDATA",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR",
  ]);
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([key, value]) =>
          allowed.has(String(key).toUpperCase())
          && typeof value === "string"
          && value.length > 0,
      ),
    ),
    CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK: "1",
    CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
    CLOUDSDK_CORE_DISABLE_USAGE_REPORTING: "1",
    FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1",
  };
}

export function inventoryQueryDefinitions() {
  const projectId = APPROVED_SCOPE.projectId;
  const projectNumber = APPROVED_SCOPE.projectNumber;
  const poolName =
    `projects/${projectNumber}/locations/global/workloadIdentityPools/`
    + APPROVED_SCOPE.workloadIdentityPoolId;
  const previewServiceAccountResource =
    `projects/${projectId}/serviceAccounts/`
    + encodeURIComponent(APPROVED_SCOPE.previewServiceAccount);
  const runtimeServiceAccountResource =
    `projects/${projectId}/serviceAccounts/`
    + encodeURIComponent(APPROVED_SCOPE.runtimeServiceAccount);
  const deployServiceAccountResource =
    `projects/${projectId}/serviceAccounts/`
    + encodeURIComponent(APPROVED_DEPLOY_SERVICE_ACCOUNT);
  const buildServiceAccountResource =
    `projects/${projectId}/serviceAccounts/`
    + encodeURIComponent(APPROVED_BUILD_SERVICE_ACCOUNT);
  return Object.freeze({
    project: `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`,
    billing: `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
    budgets:
      "https://billingbudgets.googleapis.com/v1/"
      + `billingAccounts/${APPROVED_SCOPE.billingAccount}/budgets`,
    services: (projectNumber) =>
      `https://serviceusage.googleapis.com/v1/projects/${projectNumber}/services`
      + "?filter=state%3AENABLED&pageSize=200",
    firestore:
      `https://firestore.googleapis.com/v1/projects/${projectId}`
      + "/databases/(default)",
    firestoreRootCollectionIds:
      `https://firestore.googleapis.com/v1/projects/${projectId}`
      + "/databases/(default)/documents:listCollectionIds",
    firestoreCollectionDocuments: (collectionId) =>
      `https://firestore.googleapis.com/v1/projects/${projectId}`
      + `/databases/(default)/documents/${collectionId}?pageSize=100`,
    firestoreControlDocument:
      `https://firestore.googleapis.com/v1/projects/${projectId}`
      + "/databases/(default)/documents/syntheticStagingControl/current",
    functions:
      `https://cloudfunctions.googleapis.com/v2/projects/${projectId}`
      + "/locations/-/functions",
    runServices:
      `https://run.googleapis.com/v2/projects/${projectId}/locations/-/services`,
    secrets:
      `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets`,
    secretVersions:
      `https://secretmanager.googleapis.com/v1/projects/${projectId}`
      + `/secrets/${APPROVED_SCOPE.capabilitySecret}/versions`,
    capabilitySecretIamPolicy:
      `https://secretmanager.googleapis.com/v1/projects/${projectId}`
      + `/secrets/${APPROVED_SCOPE.capabilitySecret}:getIamPolicy`,
    serviceAccounts:
      `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`,
    runtimeKeys:
      "https://iam.googleapis.com/v1/projects/-/serviceAccounts/"
      + `${encodeURIComponent(APPROVED_SCOPE.runtimeServiceAccount)}`
      + "/keys?keyTypes=USER_MANAGED",
    deployServiceAccountKeys:
      "https://iam.googleapis.com/v1/projects/-/serviceAccounts/"
      + `${encodeURIComponent(APPROVED_DEPLOY_SERVICE_ACCOUNT)}`
      + "/keys?keyTypes=USER_MANAGED",
    buildServiceAccountKeys:
      "https://iam.googleapis.com/v1/projects/-/serviceAccounts/"
      + `${encodeURIComponent(APPROVED_BUILD_SERVICE_ACCOUNT)}`
      + "/keys?keyTypes=USER_MANAGED",
    deployServiceAccountIamPolicy:
      `https://iam.googleapis.com/v1/${deployServiceAccountResource}:getIamPolicy`,
    runtimeServiceAccountIamPolicy:
      `https://iam.googleapis.com/v1/${runtimeServiceAccountResource}:getIamPolicy`,
    buildServiceAccountIamPolicy:
      `https://iam.googleapis.com/v1/${buildServiceAccountResource}:getIamPolicy`,
    iamPolicy:
      `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
    organizationIamPolicy:
      "https://cloudresourcemanager.googleapis.com/v1/organizations/"
      + `${APPROVED_SCOPE.organizationId}:getIamPolicy`,
    buckets:
      `https://storage.googleapis.com/storage/v1/b?project=${projectId}`,
    artifactRepositories:
      `https://artifactregistry.googleapis.com/v1/projects/${projectId}`
      + "/locations/-/repositories",
    functionArtifactRepositoryIamPolicy:
      `https://artifactregistry.googleapis.com/v1/projects/${projectId}`
      + `/locations/${APPROVED_SCOPE.region}/repositories/gcf-artifacts:getIamPolicy`,
    functionSourceBucketIamPolicy:
      "https://storage.googleapis.com/storage/v1/b/"
      + encodeURIComponent(
        `gcf-v2-sources-${projectNumber}-${APPROVED_SCOPE.region}`,
      )
      + "/iam",
    hostingSites:
      `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites`,
    hostingReleases:
      `https://firebasehosting.googleapis.com/v1beta1/sites/${projectId}/releases`
      + "?pageSize=100",
    hostingVersions:
      `https://firebasehosting.googleapis.com/v1beta1/sites/${projectId}/versions`
      + "?pageSize=100",
    hostingChannels:
      `https://firebasehosting.googleapis.com/v1beta1/sites/${projectId}/channels`
      + "?pageSize=100",
    workloadIdentityPools:
      `https://iam.googleapis.com/v1/projects/${projectNumber}`
      + "/locations/global/workloadIdentityPools?showDeleted=false&pageSize=100",
    workloadIdentityProviders:
      (workloadIdentityPoolName) =>
        `https://iam.googleapis.com/v1/${workloadIdentityPoolName}`
        + "/providers?showDeleted=false&pageSize=100",
    previewServiceAccount:
      `https://iam.googleapis.com/v1/${previewServiceAccountResource}`,
    previewServiceAccountKeys:
      `https://iam.googleapis.com/v1/${previewServiceAccountResource}`
      + "/keys?keyTypes=USER_MANAGED",
    previewServiceAccountIamPolicy:
      `https://iam.googleapis.com/v1/${previewServiceAccountResource}:getIamPolicy`,
    runIamPolicy: (runServiceName) =>
      `https://run.googleapis.com/v2/${runServiceName}:getIamPolicy`,
    expectedWorkloadIdentityPoolName: poolName,
  });
}

async function isolatedGoogleOAuthAccessTokenUncached() {
  try {
    const result = await acquirePinnedGoogleOAuthAccessToken();
    return result.accessToken;
  } catch {
    throw operatorError("PINNED_GOOGLE_OAUTH_HELPER_FAILED");
  }
}

async function isolatedGoogleOAuthAccessToken() {
  if (isolatedOAuthAccessTokenPromise === undefined) {
    isolatedOAuthAccessTokenPromise =
      isolatedGoogleOAuthAccessTokenUncached();
  }
  try {
    return await isolatedOAuthAccessTokenPromise;
  } catch (error) {
    isolatedOAuthAccessTokenPromise = undefined;
    throw error;
  }
}

async function createReadOnlyProviderClient() {
  const accessToken = await isolatedGoogleOAuthAccessToken();
  return async function call(id, url, {
    method = "GET",
    body,
    allowAbsent = false,
  } = {}) {
    let response;
    try {
      response = await nativeFetch(url, {
        method,
        signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-goog-user-project": APPROVED_SCOPE.projectId,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw operatorError(`READ_ONLY_INVENTORY_QUERY_FAILED_${id}`);
    }
    const text = await response.text();
    let data = {};
    try {
      data = text.length === 0 ? {} : JSON.parse(text);
    } catch {
      throw operatorError(`NON_JSON_INVENTORY_RESPONSE_${id}`);
    }
    if (allowAbsent && response.status === 404) {
      return { absent: true, value: null };
    }
    if (!response.ok) throw operatorError(`READ_ONLY_INVENTORY_QUERY_FAILED_${id}`);
    return { absent: false, value: data };
  };
}

async function loadVercelCliAuth() {
  const require = createRequire(import.meta.url);
  try {
    const cli = await inspectPinnedVercelCli(
      approvedVercelCliModuleRoot,
    );
    verifyPinnedVercelCliSnapshot(cli);
    const validateAuthConfigRoot = async () => {
      const [canonicalRoot, rootStat, entries] = await Promise.all([
        realpath(APPROVED_VERCEL_CLI_AUTH_CONFIG_ROOT),
        lstat(APPROVED_VERCEL_CLI_AUTH_CONFIG_ROOT),
        readdir(
          APPROVED_VERCEL_CLI_AUTH_CONFIG_ROOT,
          { withFileTypes: true },
        ),
      ]);
      if (
        !sameCanonicalPath(
          canonicalRoot,
          APPROVED_VERCEL_CLI_AUTH_CONFIG_ROOT,
        )
        || !rootStat.isDirectory()
        || rootStat.isSymbolicLink()
        || entries.some(
          (entry) =>
            !["auth.json", "config.json"].includes(entry.name)
            || !entry.isFile()
            || entry.isSymbolicLink(),
        )
      ) {
        throw operatorError(
          "CANONICAL_VERCEL_CLI_AUTH_CONFIG_ROOT_REQUIRED",
        );
      }
      for (const entry of entries) {
        const path = join(
          APPROVED_VERCEL_CLI_AUTH_CONFIG_ROOT,
          entry.name,
        );
        const [canonicalPath, stat] = await Promise.all([
          realpath(path),
          lstat(path),
        ]);
        if (
          !sameCanonicalPath(canonicalPath, path)
          || !stat.isFile()
          || stat.isSymbolicLink()
          || stat.nlink !== 1
        ) {
          throw operatorError(
            "CANONICAL_VERCEL_CLI_AUTH_CONFIG_ROOT_REQUIRED",
          );
        }
      }
      return canonicalRoot;
    };
    const configRoot = await validateAuthConfigRoot();
    const cliAuth = require(join(
      cli.moduleRoot,
      "@vercel",
      "cli-auth",
      "credentials-store.js",
    ));
    const credentials = cliAuth.readCliAuthConfig(configRoot);
    await validateAuthConfigRoot();
    if (
      typeof credentials?.token !== "string"
      || credentials.token.length < 20
      || credentials.token.length > 8192
      || /\s/u.test(credentials.token)
    ) {
      throw operatorError("VERCEL_AUTH_TOKEN_UNAVAILABLE");
    }
    return credentials.token;
  } catch (error) {
    if (error?.code === "VERCEL_AUTH_TOKEN_UNAVAILABLE") throw error;
    throw operatorError("VERCEL_CLI_AUTH_LIBRARY_UNAVAILABLE");
  }
}

function vercelPathWithTeam(path) {
  const url = new URL(path, "https://api.vercel.com");
  url.searchParams.set("teamId", APPROVED_SCOPE.vercelTeamId);
  return url;
}

async function createVercelProviderClient({ allowExactProjectDeletion = false } = {}) {
  const accessToken = await loadVercelCliAuth();
  return async function call(id, path, {
    method = "GET",
    allowAbsent = false,
  } = {}) {
    const url = vercelPathWithTeam(path);
    const exactDeletionPath = `/v9/projects/${APPROVED_SCOPE.vercelProjectId}`;
    if (
      method !== "GET"
      && !(
        allowExactProjectDeletion
        && method === "DELETE"
        && url.pathname === exactDeletionPath
      )
    ) throw operatorError("VERCEL_CLIENT_MUTATION_NOT_ALLOWED");
    let response;
    try {
      response = await nativeFetch(url, {
        method,
        signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
    } catch {
      throw operatorError(`VERCEL_PROVIDER_QUERY_FAILED_${id}`);
    }
    const text = await response.text();
    let data = {};
    try {
      data = text.length === 0 ? {} : JSON.parse(text);
    } catch {
      throw operatorError(`NON_JSON_VERCEL_RESPONSE_${id}`);
    }
    if (allowAbsent && response.status === 404) {
      return { absent: true, value: null };
    }
    if (!response.ok) throw operatorError(`VERCEL_PROVIDER_QUERY_FAILED_${id}`);
    return { absent: false, value: data };
  };
}

function validGooglePageToken(value) {
  return (
    typeof value === "string"
    && value.length > 0
    && value.length <= 4096
    && !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function canonicalVercelCursor(value) {
  if (
    (typeof value !== "string" && typeof value !== "number")
    || !/^[0-9]+$/u.test(String(value))
  ) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0
    ? String(number)
    : null;
}

export async function collectVercelDeployments(call) {
  const deployments = [];
  const seenCursors = new Set();
  let until;
  let pageCount = 0;
  do {
    pageCount += 1;
    if (pageCount > MAX_PROVIDER_INVENTORY_PAGES) {
      throw operatorError("VERCEL_DEPLOYMENT_PAGINATION_LIMIT_EXCEEDED");
    }
    const path = new URL("/v6/deployments", "https://api.vercel.com");
    path.searchParams.set("projectId", APPROVED_SCOPE.vercelProjectId);
    path.searchParams.set("limit", "100");
    if (until !== undefined && until !== null) path.searchParams.set("until", String(until));
    const page = (await call(
      "DEPLOYMENTS",
      `${path.pathname}${path.search}`,
    )).value;
    const pageDeployments = page?.deployments ?? [];
    if (!Array.isArray(pageDeployments)) {
      throw operatorError("VERCEL_DEPLOYMENT_PAGE_INVALID");
    }
    if (
      deployments.length + pageDeployments.length
        > MAX_PROVIDER_INVENTORY_RESOURCES
    ) throw operatorError("VERCEL_DEPLOYMENT_RESOURCE_LIMIT_EXCEEDED");
    deployments.push(...pageDeployments);
    const next = page?.pagination?.next;
    if (next === undefined || next === null) {
      until = undefined;
      continue;
    }
    const canonicalNext = canonicalVercelCursor(next);
    if (canonicalNext === null || seenCursors.has(canonicalNext)) {
      throw operatorError("VERCEL_DEPLOYMENT_CURSOR_INVALID_OR_REPEATED");
    }
    seenCursors.add(canonicalNext);
    until = canonicalNext;
  } while (until !== undefined && until !== null);
  return deployments;
}

async function collectVercelPostProjectAbsenceReadbacks(call) {
  const deployments = await collectVercelDeployments(call);
  const domainsObservation = await call(
    "POST_ABSENCE_PROJECT_DOMAINS",
    `/v9/projects/${APPROVED_SCOPE.vercelProjectId}/domains`,
    { allowAbsent: true },
  );
  const environmentObservation = await call(
    "POST_ABSENCE_PROJECT_ENVIRONMENT_VARIABLES",
    `/v10/projects/${APPROVED_SCOPE.vercelProjectId}/env`,
    { allowAbsent: true },
  );
  const settingsObservation = await call(
    "POST_ABSENCE_PROJECT_SETTINGS",
    `/v9/projects/${APPROVED_SCOPE.vercelProjectId}`,
    { allowAbsent: true },
  );
  const domains = domainsObservation.absent
    ? []
    : domainsObservation.value?.domains;
  const environmentVariables = environmentObservation.absent
    ? []
    : environmentObservation.value?.envs;
  if (!Array.isArray(domains)) {
    throw operatorError("VERCEL_POST_ABSENCE_DOMAIN_READBACK_INVALID");
  }
  if (!Array.isArray(environmentVariables)) {
    throw operatorError(
      "VERCEL_POST_ABSENCE_ENVIRONMENT_READBACK_INVALID",
    );
  }
  return {
    deployments,
    domains,
    environmentVariables,
    projectSettingsAbsent: settingsObservation.absent === true,
  };
}

export async function collectReadOnlyVercelInventory() {
  const call = await createVercelProviderClient();
  const project = await call(
    "PROJECT",
    `/v9/projects/${APPROVED_SCOPE.vercelProjectId}`,
    { allowAbsent: true },
  );
  if (project.absent) {
    const postAbsence =
      await collectVercelPostProjectAbsenceReadbacks(call);
    return {
      source: "LIVE_AUTHENTICATED_VERCEL_API",
      team: {
        id: APPROVED_SCOPE.vercelTeamId,
        slug: APPROVED_SCOPE.vercelTeamSlug,
      },
      project: null,
      deployments: postAbsence.deployments,
      deploymentsReadbackAfterProjectAbsence: true,
      domainsObservedAfterProjectAbsence: postAbsence.domains.length,
      domainsReadbackAfterProjectAbsence: true,
      environmentVariablesObservedAfterProjectAbsence:
        postAbsence.environmentVariables.length,
      environmentVariablesReadbackAfterProjectAbsence: true,
      projectSettingsReadbackAfterProjectAbsence: true,
      projectSettingsAbsentAfterProjectAbsence:
        postAbsence.projectSettingsAbsent,
      authenticatedReadback: true,
      tokenPrinted: false,
      oidcTokenPrinted: false,
    };
  }
  return {
    source: "LIVE_AUTHENTICATED_VERCEL_API",
    team: {
      id: APPROVED_SCOPE.vercelTeamId,
      slug: APPROVED_SCOPE.vercelTeamSlug,
    },
    project: project.value,
    deployments: await collectVercelDeployments(call),
    authenticatedReadback: true,
    tokenPrinted: false,
    oidcTokenPrinted: false,
  };
}

export async function listAll(
  call,
  id,
  initialUrl,
  field,
  { allowAbsent = false } = {},
) {
  const values = [];
  const seenPageTokens = new Set();
  let pageToken;
  let pageCount = 0;
  do {
    pageCount += 1;
    if (pageCount > MAX_PROVIDER_INVENTORY_PAGES) {
      throw operatorError(`INVENTORY_PAGINATION_LIMIT_EXCEEDED_${id}`);
    }
    const url = new URL(initialUrl);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const observed = await call(id, url.href, { allowAbsent });
    if (observed.absent) return values;
    const response = observed.value;
    const pageValues = response?.[field] ?? [];
    if (!Array.isArray(pageValues)) {
      throw operatorError(`INVENTORY_PAGE_INVALID_${id}`);
    }
    if (
      values.length + pageValues.length > MAX_PROVIDER_INVENTORY_RESOURCES
    ) throw operatorError(`INVENTORY_RESOURCE_LIMIT_EXCEEDED_${id}`);
    values.push(...pageValues);
    const nextPageToken = response?.nextPageToken;
    if (nextPageToken === undefined || nextPageToken === null) {
      pageToken = undefined;
      continue;
    }
    if (
      !validGooglePageToken(nextPageToken)
      || seenPageTokens.has(nextPageToken)
    ) throw operatorError(`INVENTORY_CURSOR_INVALID_OR_REPEATED_${id}`);
    seenPageTokens.add(nextPageToken);
    pageToken = nextPageToken;
  } while (pageToken);
  return values;
}

async function listFirestoreCollectionIds(call, url, id) {
  const collectionIds = [];
  const seenPageTokens = new Set();
  let pageToken;
  let pageCount = 0;
  do {
    pageCount += 1;
    if (pageCount > MAX_PROVIDER_INVENTORY_PAGES) {
      throw operatorError(`FIRESTORE_COLLECTION_PAGINATION_LIMIT_EXCEEDED_${id}`);
    }
    const response = (
      await call(id, url, {
        method: "POST",
        body: {
          pageSize: 100,
          ...(pageToken === undefined ? {} : { pageToken }),
        },
      })
    ).value;
    const pageCollectionIds = response?.collectionIds ?? [];
    if (
      !Array.isArray(pageCollectionIds)
      || pageCollectionIds.some(
        (collectionId) =>
          typeof collectionId !== "string"
          || collectionId.length === 0
          || collectionId.length > 1500
          || collectionId.includes("/"),
      )
    ) throw operatorError(`FIRESTORE_COLLECTION_PAGE_INVALID_${id}`);
    if (
      collectionIds.length + pageCollectionIds.length
        > MAX_PROVIDER_INVENTORY_RESOURCES
    ) throw operatorError(`FIRESTORE_COLLECTION_RESOURCE_LIMIT_EXCEEDED_${id}`);
    collectionIds.push(...pageCollectionIds);
    const nextPageToken = response?.nextPageToken;
    if (nextPageToken === undefined || nextPageToken === null) {
      pageToken = undefined;
      continue;
    }
    if (
      !validGooglePageToken(nextPageToken)
      || seenPageTokens.has(nextPageToken)
    ) throw operatorError(`FIRESTORE_COLLECTION_CURSOR_INVALID_OR_REPEATED_${id}`);
    seenPageTokens.add(nextPageToken);
    pageToken = nextPageToken;
  } while (pageToken);
  return collectionIds;
}

export async function listFirestoreRootCollectionIds(call, url) {
  return listFirestoreCollectionIds(call, url, "FIRESTORE_ROOT_COLLECTION_IDS");
}

export async function collectFirestoreNestedCollectionEvidence(
  call,
  documentNames,
) {
  if (
    !Array.isArray(documentNames)
    || documentNames.length > MAX_FIRESTORE_DOCUMENTS_FOR_NESTED_SCAN
    || new Set(documentNames).size !== documentNames.length
    || documentNames.some(
      (name) =>
        typeof name !== "string"
        || !name.startsWith(
          `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`,
        ),
    )
  ) throw operatorError("FIRESTORE_NESTED_SCAN_PARENT_SCOPE_INVALID");
  let nestedCollectionCount = 0;
  for (const [index, documentName] of documentNames.entries()) {
    const url = `https://firestore.googleapis.com/v1/${documentName}:listCollectionIds`;
    const collectionIds = await listFirestoreCollectionIds(
      call,
      url,
      `FIRESTORE_NESTED_COLLECTION_IDS_${index}`,
    );
    nestedCollectionCount += collectionIds.length;
    if (nestedCollectionCount > MAX_PROVIDER_INVENTORY_RESOURCES) {
      throw operatorError("FIRESTORE_NESTED_COLLECTION_RESOURCE_LIMIT_EXCEEDED");
    }
  }
  return Object.freeze({
    parentDocumentsChecked: documentNames.length,
    nestedCollectionCount,
    noNestedCollections: nestedCollectionCount === 0,
    nestedCollectionIdentifiersPersistedOrPrinted: false,
  });
}

export function assertWifProviderFanoutScope(workloadIdentityPools) {
  if (
    !Array.isArray(workloadIdentityPools)
    || workloadIdentityPools.length > MAX_WIF_POOLS_FOR_PROVIDER_FANOUT
  ) throw operatorError("WIF_PROVIDER_FANOUT_SCOPE_EXCEEDED");
  return workloadIdentityPools;
}

export async function collectReadOnlyInventory({
  googleOnlySyntheticDeletion = false,
} = {}) {
  if (typeof googleOnlySyntheticDeletion !== "boolean") {
    throw operatorError("VALID_INVENTORY_COLLECTION_SCOPE_REQUIRED");
  }
  const definitions = inventoryQueryDefinitions();
  const [call, vercel] = await Promise.all([
    createReadOnlyProviderClient(),
    googleOnlySyntheticDeletion
      ? Promise.resolve({
          source:
            "INTENTIONALLY_NOT_COLLECTED_GOOGLE_ONLY_SYNTHETIC_DELETION",
          tokenPrinted: false,
          oidcTokenPrinted: false,
        })
      : collectReadOnlyVercelInventory(),
  ]);
  const providerDestructionTransition = vercel.project === null;
  const [projectResult, budgetsResult] = await Promise.all([
    call("PROJECT", definitions.project, { allowAbsent: true }),
    listAll(call, "BUDGETS", definitions.budgets, "budgets"),
  ]);
  if (projectResult.absent) {
    return {
      source: "LIVE_READ_ONLY_PROVIDER_QUERIES",
      project: null,
      budgets: budgetsResult,
      vercel,
      queryAbsences: ["project"],
      skippedAfterProjectAbsence: Object.keys(definitions).filter(
        (id) => id !== "project" && id !== "budgets",
      ),
    };
  }
  const projectNumber = normalizeProjectNumber(
    projectResult.value.projectNumber ?? resourceId(projectResult.value.name),
  );
  const firestore = await call(
    "FIRESTORE",
    definitions.firestore,
    { allowAbsent: true },
  );
  let firestoreRootCollectionIds = [];
  let firestoreDocuments = APPROVED_FIRESTORE_DATA_COLLECTIONS.map(
    (collectionId) => ({
      collectionId,
      count: 0,
      documentNames: [],
      schemaValidation: {
        documentsChecked: 0,
        conformantDocuments: 0,
        allDocumentsConformant: true,
        payloadValuesPersistedOrPrinted: false,
      },
    }),
  );
  let firestoreControlDocument = { absent: true, value: null };
  let firestoreGrantRelationshipEvidence =
    deriveSyntheticGrantRelationshipEvidence([], []);
  let firestoreNestedCollectionEvidence = {
    parentDocumentsChecked: 0,
    nestedCollectionCount: 0,
    noNestedCollections: true,
    nestedCollectionIdentifiersPersistedOrPrinted: false,
  };
  if (!firestore.absent) {
    firestoreRootCollectionIds = await listFirestoreRootCollectionIds(
      call,
      definitions.firestoreRootCollectionIds,
    );
    const listedDocuments = await Promise.all(
      APPROVED_FIRESTORE_DATA_COLLECTIONS.map(async (collectionId) => ({
        collectionId,
        documents: await listAll(
          call,
          `FIRESTORE_DOCUMENTS_${collectionId}`,
          definitions.firestoreCollectionDocuments(collectionId),
          "documents",
        ),
      })),
    );
    firestoreDocuments = listedDocuments.map(({ collectionId, documents }) => {
      const inspections = documents.map((document) =>
        inspectFirestoreSyntheticDocument(collectionId, document));
      return {
        collectionId,
        count: documents.length,
        documentNames: documents.map((document, index) =>
          sanitizedFirestoreDocumentName(document, inspections[index])),
        schemaValidation: {
          documentsChecked: documents.length,
          conformantDocuments:
            inspections.filter((inspection) => inspection.conformant).length,
          allDocumentsConformant:
            inspections.every((inspection) => inspection.conformant),
          payloadValuesPersistedOrPrinted: false,
        },
      };
    });
    firestoreGrantRelationshipEvidence =
      deriveSyntheticGrantRelationshipEvidence(
        listedDocuments.find(
          ({ collectionId }) => collectionId === "syntheticSessions",
        )?.documents ?? [],
        listedDocuments.find(
          ({ collectionId }) =>
            collectionId === "syntheticCapabilityGrants",
        )?.documents ?? [],
      );
    firestoreControlDocument = await call(
      "FIRESTORE_CONTROL_DOCUMENT",
      definitions.firestoreControlDocument,
      { allowAbsent: true },
    );
    const nestedScanParents = [
      ...listedDocuments.flatMap(({ documents }) =>
        documents.map((document) => document?.name ?? "")),
      ...(firestoreControlDocument.absent
        ? []
        : [firestoreControlDocument.value?.name ?? ""]),
    ];
    firestoreNestedCollectionEvidence =
      await collectFirestoreNestedCollectionEvidence(call, nestedScanParents);
  }
  const [
    billing,
    services,
    functions,
    runServices,
    secrets,
    capabilitySecretIamPolicy,
    serviceAccounts,
    runtimeKeys,
    deployServiceAccountKeys,
    buildServiceAccountKeys,
    deployServiceAccountIamPolicy,
    runtimeServiceAccountIamPolicy,
    buildServiceAccountIamPolicy,
    iamPolicy,
    organizationIamPolicy,
    buckets,
    artifactRepositories,
    functionArtifactRepositoryIamPolicy,
    functionSourceBucketIamPolicy,
    hostingSites,
    hostingReleases,
    hostingVersions,
    hostingChannels,
    workloadIdentityPools,
    previewServiceAccount,
    previewServiceAccountKeys,
    previewServiceAccountIamPolicy,
  ] = await Promise.all([
    call("BILLING", definitions.billing),
    listAll(call, "SERVICES", definitions.services(projectNumber), "services"),
    listAll(call, "FUNCTIONS", definitions.functions, "functions"),
    listAll(call, "RUN_SERVICES", definitions.runServices, "services"),
    listAll(call, "SECRETS", definitions.secrets, "secrets"),
    call(
      "CAPABILITY_SECRET_IAM_POLICY",
      definitions.capabilitySecretIamPolicy,
      {
        method: "POST",
        body: { options: { requestedPolicyVersion: 3 } },
        allowAbsent: providerDestructionTransition,
      },
    ),
    listAll(call, "SERVICE_ACCOUNTS", definitions.serviceAccounts, "accounts"),
    listAll(
      call,
      "RUNTIME_KEYS",
      definitions.runtimeKeys,
      "keys",
      { allowAbsent: providerDestructionTransition },
    ),
    listAll(
      call,
      "DEPLOY_SERVICE_ACCOUNT_KEYS",
      definitions.deployServiceAccountKeys,
      "keys",
      { allowAbsent: providerDestructionTransition },
    ),
    listAll(
      call,
      "BUILD_SERVICE_ACCOUNT_KEYS",
      definitions.buildServiceAccountKeys,
      "keys",
      { allowAbsent: providerDestructionTransition },
    ),
    call(
      "DEPLOY_SERVICE_ACCOUNT_IAM_POLICY",
      definitions.deployServiceAccountIamPolicy,
      {
        method: "POST",
        body: { options: { requestedPolicyVersion: 3 } },
        allowAbsent: true,
      },
    ),
    call(
      "RUNTIME_SERVICE_ACCOUNT_IAM_POLICY",
      definitions.runtimeServiceAccountIamPolicy,
      {
        method: "POST",
        body: { options: { requestedPolicyVersion: 3 } },
        allowAbsent: true,
      },
    ),
    call(
      "BUILD_SERVICE_ACCOUNT_IAM_POLICY",
      definitions.buildServiceAccountIamPolicy,
      {
        method: "POST",
        body: { options: { requestedPolicyVersion: 3 } },
        allowAbsent: true,
      },
    ),
    call("IAM_POLICY", definitions.iamPolicy, { method: "POST", body: {} }),
    call(
      "ORGANIZATION_IAM_POLICY",
      definitions.organizationIamPolicy,
      {
        method: "POST",
        body: { options: { requestedPolicyVersion: 3 } },
      },
    ),
    listAll(call, "BUCKETS", definitions.buckets, "items"),
    listAll(
      call,
      "ARTIFACT_REPOSITORIES",
      definitions.artifactRepositories,
      "repositories",
    ),
    call(
      "FUNCTION_ARTIFACT_REPOSITORY_IAM_POLICY",
      definitions.functionArtifactRepositoryIamPolicy,
      {
        method: "POST",
        body: { options: { requestedPolicyVersion: 3 } },
        allowAbsent: providerDestructionTransition,
      },
    ),
    call("FUNCTION_SOURCE_BUCKET_IAM_POLICY", definitions.functionSourceBucketIamPolicy, {
      allowAbsent: providerDestructionTransition,
    }),
    listAll(call, "FIREBASE_HOSTING_SITES", definitions.hostingSites, "sites"),
    listAll(
      call,
      "FIREBASE_HOSTING_RELEASES",
      definitions.hostingReleases,
      "releases",
      { allowAbsent: providerDestructionTransition },
    ),
    listAll(
      call,
      "FIREBASE_HOSTING_VERSIONS",
      definitions.hostingVersions,
      "versions",
      { allowAbsent: providerDestructionTransition },
    ),
    listAll(
      call,
      "FIREBASE_HOSTING_CHANNELS",
      definitions.hostingChannels,
      "channels",
      { allowAbsent: providerDestructionTransition },
    ),
    listAll(
      call,
      "WORKLOAD_IDENTITY_POOLS",
      definitions.workloadIdentityPools,
      "workloadIdentityPools",
    ),
    call(
      "PREVIEW_SERVICE_ACCOUNT",
      definitions.previewServiceAccount,
      { allowAbsent: true },
    ),
    call(
      "PREVIEW_SERVICE_ACCOUNT_KEYS",
      definitions.previewServiceAccountKeys,
      { allowAbsent: true },
    ),
    call(
      "PREVIEW_SERVICE_ACCOUNT_IAM_POLICY",
      definitions.previewServiceAccountIamPolicy,
      {
        method: "POST",
        body: { options: { requestedPolicyVersion: 3 } },
        allowAbsent: true,
      },
    ),
  ]);
  assertWifProviderFanoutScope(workloadIdentityPools);
  const workloadIdentityProviders = (
    await Promise.all(workloadIdentityPools.map(async (pool) => ({
      poolName: pool.name ?? "",
      providers: await listAll(
        call,
        `WORKLOAD_IDENTITY_PROVIDERS_${resourceId(pool.name)}`,
        definitions.workloadIdentityProviders(pool.name),
        "workloadIdentityPoolProviders",
      ),
    })))
  ).flatMap(({ poolName, providers }) =>
    providers.map((provider) => ({ ...provider, observedPoolName: poolName })));
  const runIamPolicies = await Promise.all(
    runServices
      .filter((service) =>
        APPROVED_RUN_SERVICES.has(resourceId(service.name).toLowerCase()))
      .map(async (service) => ({
        serviceName: service.name,
        policy: (
          await call(
            `RUN_IAM_POLICY_${resourceId(service.name)}`,
            definitions.runIamPolicy(service.name),
            { allowAbsent: true },
          )
        ).value,
      })),
  );
  const hasCapabilitySecret = secrets.some(
    (secret) => resourceId(secret.name) === APPROVED_SCOPE.capabilitySecret,
  );
  const secretVersions = hasCapabilitySecret
    ? await listAll(call, "SECRET_VERSIONS", definitions.secretVersions, "versions")
    : [];
  const raw = {
    source: "LIVE_READ_ONLY_PROVIDER_QUERIES",
    project: projectResult.value,
    billing: billing.value,
    budgets: budgetsResult,
    services,
    firestore: firestore.value,
    firestoreRootCollectionIds,
    firestoreDocuments,
    firestoreControlDocument: firestoreControlDocument.value,
    firestoreDatabaseAbsent: firestore.absent,
    firestoreDataReadbackPerformed: true,
    firestoreNestedCollectionEvidence,
    firestoreGrantRelationshipEvidence,
    functions,
    runServices,
    secrets,
    secretVersions,
    capabilitySecretIamPolicy: capabilitySecretIamPolicy.value,
    capabilitySecretIamPolicyReadbackPerformed: true,
    serviceAccounts,
    runtimeKeys,
    runtimeKeysReadbackPerformed: true,
    deployServiceAccountKeys,
    deployServiceAccountKeysReadbackPerformed: true,
    buildServiceAccountKeys,
    buildServiceAccountKeysReadbackPerformed: true,
    deployServiceAccountIamPolicy: deployServiceAccountIamPolicy.value,
    runtimeServiceAccountIamPolicy: runtimeServiceAccountIamPolicy.value,
    buildServiceAccountIamPolicy: buildServiceAccountIamPolicy.value,
    serviceAccountIamPolicyReadbackPerformed: true,
    iamPolicy: iamPolicy.value,
    iamPolicyReadbackPerformed: true,
    organizationIamPolicy: organizationIamPolicy.value,
    organizationIamPolicyReadbackPerformed: true,
    buckets,
    artifactRepositories,
    functionArtifactRepositoryIamPolicy:
      functionArtifactRepositoryIamPolicy.value,
    functionSourceBucketIamPolicy: functionSourceBucketIamPolicy.value,
    buildResourceIamPoliciesReadbackPerformed: true,
    hostingSites,
    hostingReleases,
    hostingVersions,
    hostingChannels,
    hostingContentReadbackPerformed: true,
    workloadIdentityPools,
    workloadIdentityProviders,
    previewServiceAccount: previewServiceAccount.value,
    previewServiceAccountKeys: previewServiceAccountKeys.value?.keys ?? [],
    previewServiceAccountKeysReadbackPerformed: true,
    previewServiceAccountIamPolicy: previewServiceAccountIamPolicy.value,
    runIamPolicies,
    vercel,
  };
  return raw;
}

export function classifyBucket(bucketName, projectNumber) {
  const name = normalizeBucketName(bucketName);
  const number = normalizeProjectNumber(projectNumber);
  if (
    name === `${APPROVED_SCOPE.projectId}.firebasestorage.app`
    || name === `${APPROVED_SCOPE.projectId}.appspot.com`
  ) {
    return "APP_CLOUD_STORAGE_FORBIDDEN";
  }
  const supportingPatterns = [
    new RegExp(`^gcf-v2-sources-${number}-${APPROVED_SCOPE.region}$`, "u"),
    new RegExp(
      `^gcf-v2-uploads-${number}\\.${APPROVED_SCOPE.region}\\.cloudfunctions\\.appspot\\.com$`,
      "u",
    ),
    new RegExp(`^gcf-sources-${number}-${APPROVED_SCOPE.region}$`, "u"),
    new RegExp(`^${number}\\.cloudbuild-logs\\.googleusercontent\\.com$`, "u"),
  ];
  if (
    name === `artifacts.${APPROVED_SCOPE.projectId}.appspot.com`
    || name === `staging.${APPROVED_SCOPE.projectId}.appspot.com`
    || supportingPatterns.some((pattern) => pattern.test(name))
  ) {
    return "FUNCTIONS_BUILD_SUPPORTING_ARTIFACT";
  }
  return "UNCLASSIFIED_BUCKET_BLOCKING";
}

function normalizeFunction(entry) {
  const serviceConfig = entry.serviceConfig ?? {};
  return {
    name: resourceId(entry.name),
    location: locationFromName(entry.name) || entry.region || "",
    state: entry.state ?? "",
    environment: entry.environment ?? "",
    runtime: entry.buildConfig?.runtime ?? entry.runtime ?? "",
    entryPoint: entry.buildConfig?.entryPoint ?? "",
    buildServiceAccount: entry.buildConfig?.serviceAccount ?? "",
    buildWorkerPool: entry.buildConfig?.workerPool ?? "",
    runtimeServiceAccount:
      serviceConfig.serviceAccountEmail ?? entry.serviceAccountEmail ?? "",
    runService: serviceConfig.service ?? "",
    minInstanceCount: serviceConfig.minInstanceCount ?? 0,
    maxInstanceCount: serviceConfig.maxInstanceCount ?? null,
    concurrency: serviceConfig.maxInstanceRequestConcurrency ?? null,
    availableMemory: serviceConfig.availableMemory ?? "",
    timeoutSeconds: serviceConfig.timeoutSeconds ?? null,
    ingressSettings: serviceConfig.ingressSettings ?? "",
    vpcConnector: serviceConfig.vpcConnector ?? "",
    vpcConnectorEgressSettings:
      serviceConfig.vpcConnectorEgressSettings ?? "",
    binaryAuthorizationPolicy:
      serviceConfig.binaryAuthorizationPolicy ?? "",
    secretVolumes: asArray(serviceConfig.secretVolumes).map((volume) => ({
      mountPath: volume.mountPath ?? "",
      projectId: String(volume.projectId ?? ""),
      secret: volume.secret ?? "",
      versions: asArray(volume.versions).map((version) => ({
        path: version.path ?? "",
        version: version.version ?? "",
      })),
    })),
    allTrafficOnLatestRevision:
      serviceConfig.allTrafficOnLatestRevision === true,
    environmentVariables:
      serviceConfig.environmentVariables ?? {},
    secretEnvironmentVariables: asArray(
      serviceConfig.secretEnvironmentVariables,
    ).map((secret) => ({
      key: secret.key ?? "",
      projectId: String(secret.projectId ?? ""),
      secret: secret.secret ?? "",
      version: secret.version ?? "",
    })),
  };
}

function normalizeRunService(entry) {
  const labels = entry.labels ?? entry.metadata?.labels ?? {};
  return {
    name: resourceId(entry.name ?? entry.metadata?.name),
    resourceName: entry.name ?? "",
    location:
      labels["cloud.googleapis.com/location"]
      ?? locationFromName(entry.name)
      ?? entry.location
      ?? "",
    managedBy:
      labels["goog-managed-by"]
      ?? labels["deployment-tool"]
      ?? "",
    runtimeServiceAccount: entry.template?.serviceAccount ?? "",
    ingress: entry.ingress ?? "",
  };
}

function exactSafeInteger(value) {
  if (
    (typeof value !== "string" && typeof value !== "number")
    || !/^-?\d+$/u.test(String(value))
  ) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function exactThresholdPercents(value) {
  const thresholds = asArray(value)
    .map((rule) => Number(rule.thresholdPercent))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  return thresholds.length === 2
    && thresholds[0] === 0.8
    && thresholds[1] === 1;
}

function memoryQuantityBytes(value) {
  if (typeof value !== "string") return null;
  const match = /^([0-9]+)(k|M|G|Ki|Mi|Gi)?$/u.exec(value);
  if (match === null) return null;
  const units = {
    "": 1n,
    k: 1_000n,
    M: 1_000_000n,
    G: 1_000_000_000n,
    Ki: 1_024n,
    Mi: 1_048_576n,
    Gi: 1_073_741_824n,
  };
  const bytes = BigInt(match[1]) * units[match[2] ?? ""];
  return bytes <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(bytes)
    : null;
}

function exactStringRecord(actual, expected) {
  if (
    actual === null
    || typeof actual !== "object"
    || Array.isArray(actual)
  ) return false;
  const actualEntries = Object.entries(actual)
    .map(([key, value]) => [key, String(value)])
    .sort(([left], [right]) => left.localeCompare(right));
  const expectedEntries = Object.entries(expected)
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(actualEntries) === JSON.stringify(expectedEntries);
}

function approvedBuildServiceAccountReference(value) {
  return [
    APPROVED_BUILD_SERVICE_ACCOUNT,
    `projects/${APPROVED_SCOPE.projectId}/serviceAccounts/`
      + APPROVED_BUILD_SERVICE_ACCOUNT,
    `projects/${APPROVED_SCOPE.projectNumber}/serviceAccounts/`
      + APPROVED_BUILD_SERVICE_ACCOUNT,
  ].includes(value);
}

function canonicalProtectedPreviewOrigin(value) {
  if (typeof value !== "string") return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:"
    || parsed.origin !== value
    || !parsed.hostname.startsWith(`${APPROVED_SCOPE.vercelProjectName}-`)
    || !parsed.hostname.endsWith(
      `-${APPROVED_SCOPE.vercelTeamSlug}.vercel.app`,
    )
  ) return null;
  return parsed.origin;
}

function canonicalInventoryDeploymentOrigin(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const candidate = value.startsWith("https://") ? value : `https://${value}`;
  return canonicalProtectedPreviewOrigin(candidate);
}

function normalizeBudget(entry, projectNumber) {
  const filteredProjects = asArray(entry.budgetFilter?.projects ?? entry.filter?.projects)
    .map((value) => String(value));
  const expectedProject = `projects/${projectNumber}`;
  const specifiedAmount = entry.amount?.specifiedAmount ?? {};
  const units = exactSafeInteger(
    specifiedAmount.units ?? specifiedAmount.amount,
  );
  const nanos = specifiedAmount.nanos === undefined
    ? 0
    : exactSafeInteger(specifiedAmount.nanos);
  const thresholdPercents = asArray(entry.thresholdRules)
    .map((rule) => Number(rule.thresholdPercent))
    .filter(Number.isFinite);
  const projectScoped = (
    filteredProjects.length === 1
    && (
      filteredProjects[0] === expectedProject
      || filteredProjects[0] === projectNumber
    )
  );
  const includesApprovedProject = filteredProjects.includes(expectedProject)
    || filteredProjects.includes(projectNumber);
  const name = entry.name ?? "";
  const expectedBudgetPrefix =
    `billingAccounts/${APPROVED_SCOPE.billingAccount}/budgets/`;
  const exactApprovedBudget = (
    projectScoped
    && name.startsWith(expectedBudgetPrefix)
    && /^[A-Za-z0-9-]{8,128}$/u.test(name.slice(expectedBudgetPrefix.length))
    && (
      specifiedAmount.currencyCode
      ?? specifiedAmount.currency
      ?? ""
    ) === "NOK"
    && units === 500
    && nanos === 0
    && exactThresholdPercents(entry.thresholdRules)
  );
  return {
    name,
    currency:
      specifiedAmount.currencyCode
      ?? specifiedAmount.currency
      ?? "",
    units,
    nanos,
    thresholdPercents,
    projects: projectScoped ? [expectedProject] : [],
    includesApprovedProject,
    projectScoped,
    exactApprovedBudget,
  };
}

function normalizeIamBindings(policy) {
  return asArray(policy?.bindings).map((entry) => ({
    role: entry.role ?? "",
    members: asArray(entry.members).map(String),
    condition: entry.condition === undefined
      ? null
      : {
          description: entry.condition.description ?? "",
          expression: entry.condition.expression ?? "",
          title: entry.condition.title ?? "",
        },
  }));
}

function hasUnconditionalMember(bindings, role, member) {
  return bindings.some(
    (binding) =>
      binding.role === role
      && binding.condition === null
      && binding.members.includes(member),
  );
}

function exactNormalizedIamCondition(actual, expected) {
  return (
    actual?.title === expected?.title
    && actual?.description === expected?.description
    && actual?.expression === expected?.expression
  );
}

function organizationMemberCouldGrantDeployIdentity(
  member,
  deployMember,
) {
  return (
    member === deployMember
    || member === "allUsers"
    || member === "allAuthenticatedUsers"
    || (
      typeof member === "string"
      && (
        member.startsWith("group:")
        || member.startsWith("domain:")
      )
    )
    || (
      typeof member === "string"
      && member.startsWith(
        "principalSet://cloudresourcemanager.googleapis.com/",
      )
      && /\/type\/ServiceAccount$/u.test(member)
    )
  );
}

function exactDeployIdentityIamScopeAbsence(evidence, expectedScope) {
  return (
    evidence?.scope === expectedScope
    && evidence?.readbackPerformed === true
    && /^[a-f0-9]{64}$/u.test(evidence?.policyDigest ?? "")
    && Number.isSafeInteger(evidence?.bindingCount)
    && evidence.bindingCount >= 0
    && evidence?.directDeployMemberBindingCount === 0
    && evidence?.publicPrincipalBindingCount === 0
    && evidence?.groupOrDomainPrincipalBindingCount === 0
    && evidence?.serviceAccountPrincipalSetBindingCount === 0
    && evidence?.applicableDeployAuthorityBindingCount === 0
    && evidence?.exactApplicableDeployAuthorityAbsent === true
    && evidence?.principalIdentifiersPersistedOrPrinted === false
  );
}

function exactOrganizationIamScopeAbsence(evidence) {
  return (
    evidence?.organizationId === APPROVED_SCOPE.organizationId
    && exactDeployIdentityIamScopeAbsence(
      evidence,
      `organizations/${APPROVED_SCOPE.organizationId}`,
    )
  );
}

function exactProjectIamScopeAbsence(evidence) {
  return (
    evidence?.projectId === APPROVED_SCOPE.projectId
    && exactDeployIdentityIamScopeAbsence(
      evidence,
      `projects/${APPROVED_SCOPE.projectId}`,
    )
  );
}

function exactPreviewSubjectPrincipal() {
  return [
    "principal://iam.googleapis.com",
    `projects/${APPROVED_SCOPE.projectNumber}`,
    "locations/global",
    `workloadIdentityPools/${APPROVED_SCOPE.workloadIdentityPoolId}`,
    `subject/${APPROVED_TRUST.subject}`,
  ].join("/");
}

function directFederatedProjectBindings(bindings) {
  const poolName = (
    `projects/${APPROVED_SCOPE.projectNumber}/locations/global/workloadIdentityPools/`
    + APPROVED_SCOPE.workloadIdentityPoolId
  );
  const prefixes = [
    `principal://iam.googleapis.com/${poolName}/`,
    `principalSet://iam.googleapis.com/${poolName}/`,
  ];
  return bindings.flatMap((binding) => (
    binding.members
      .filter((member) => prefixes.some((prefix) => member.startsWith(prefix)))
      .map((member) => ({
        role: binding.role,
        member,
        conditional: binding.condition !== null,
      }))
  ));
}

function normalizeVercelInventory(
  raw,
  blockers,
  { allowGoogleOnlySyntheticDeletion = false } = {},
) {
  if (
    allowGoogleOnlySyntheticDeletion
    && raw?.source
      === "INTENTIONALLY_NOT_COLLECTED_GOOGLE_ONLY_SYNTHETIC_DELETION"
    && raw?.tokenPrinted === false
    && raw?.oidcTokenPrinted === false
  ) {
    return {
      provider: "VERCEL_NOT_IN_SYNTHETIC_DELETION_SCOPE",
      authenticatedReadback: false,
      collectionSkippedForGoogleOnlySyntheticDeletion: true,
      project: null,
      deployments: [],
      projectAbsent: false,
      tokenPrinted: false,
      oidcTokenPrinted: false,
    };
  }
  if (
    raw?.source !== "LIVE_AUTHENTICATED_VERCEL_API"
    && raw?.source !== "LOCAL_TEST_FIXTURE"
  ) blockers.push("VERCEL_INVENTORY_SOURCE_NOT_AUTHENTICATED");
  if (
    raw?.team?.id !== APPROVED_SCOPE.vercelTeamId
    || raw?.team?.slug !== APPROVED_SCOPE.vercelTeamSlug
  ) blockers.push("VERCEL_TEAM_BINDING_MISMATCH");
  if (raw?.authenticatedReadback !== true) {
    blockers.push("VERCEL_AUTHENTICATED_READBACK_REQUIRED");
  }
  if (raw?.tokenPrinted !== false || raw?.oidcTokenPrinted !== false) {
    blockers.push("VERCEL_TOKEN_NONDISCLOSURE_NOT_ATTESTED");
  }
  if (raw?.project === null) {
    if (raw?.deploymentsReadbackAfterProjectAbsence !== true) {
      blockers.push(
        "VERCEL_DEPLOYMENTS_AFTER_PROJECT_ABSENCE_READBACK_REQUIRED",
      );
    }
    if (asArray(raw?.deployments).length > 0) {
      blockers.push("VERCEL_PROJECT_ABSENT_BUT_DEPLOYMENTS_REPORTED");
    }
    if (
      raw?.domainsReadbackAfterProjectAbsence !== true
      || raw?.domainsObservedAfterProjectAbsence !== 0
    ) blockers.push("VERCEL_DOMAINS_AFTER_PROJECT_ABSENCE_NOT_PROVEN_EMPTY");
    if (
      raw?.environmentVariablesReadbackAfterProjectAbsence !== true
      || raw?.environmentVariablesObservedAfterProjectAbsence !== 0
    ) {
      blockers.push(
        "VERCEL_ENVIRONMENT_AFTER_PROJECT_ABSENCE_NOT_PROVEN_EMPTY",
      );
    }
    if (
      raw?.projectSettingsReadbackAfterProjectAbsence !== true
      || raw?.projectSettingsAbsentAfterProjectAbsence !== true
    ) {
      blockers.push(
        "VERCEL_PROJECT_SETTINGS_AFTER_PROJECT_ABSENCE_NOT_PROVEN_ABSENT",
      );
    }
    return {
      provider: "VERCEL_PROTECTED_PREVIEW",
      authenticatedReadback: raw?.authenticatedReadback === true,
      team: {
        id: raw?.team?.id ?? "",
        slug: raw?.team?.slug ?? "",
      },
      project: null,
      deployments: [],
      deploymentsReadbackAfterProjectAbsence:
        raw?.deploymentsReadbackAfterProjectAbsence === true,
      domainsObservedAfterProjectAbsence:
        raw?.domainsObservedAfterProjectAbsence ?? null,
      domainsReadbackAfterProjectAbsence:
        raw?.domainsReadbackAfterProjectAbsence === true,
      environmentVariablesObservedAfterProjectAbsence:
        raw?.environmentVariablesObservedAfterProjectAbsence ?? null,
      environmentVariablesReadbackAfterProjectAbsence:
        raw?.environmentVariablesReadbackAfterProjectAbsence === true,
      projectSettingsReadbackAfterProjectAbsence:
        raw?.projectSettingsReadbackAfterProjectAbsence === true,
      projectSettingsAbsentAfterProjectAbsence:
        raw?.projectSettingsAbsentAfterProjectAbsence === true,
      projectAbsent: true,
      tokenPrinted: raw?.tokenPrinted !== false,
      oidcTokenPrinted: raw?.oidcTokenPrinted !== false,
    };
  }

  const project = raw?.project ?? {};
  if (project.id !== APPROVED_SCOPE.vercelProjectId) {
    blockers.push("VERCEL_PROJECT_ID_MISMATCH");
  }
  if (project.name !== APPROVED_SCOPE.vercelProjectName) {
    blockers.push("VERCEL_PROJECT_NAME_MISMATCH");
  }
  if (project.accountId !== APPROVED_SCOPE.vercelTeamId) {
    blockers.push("VERCEL_PROJECT_TEAM_MISMATCH");
  }
  if (
    project.ssoProtection?.deploymentType
      !== "prod_deployment_urls_and_all_previews"
  ) blockers.push("VERCEL_STANDARD_PROTECTION_REQUIRED");
  if (
    project.oidcTokenConfig?.enabled !== true
    || project.oidcTokenConfig?.issuerMode !== "team"
  ) blockers.push("VERCEL_TEAM_OIDC_REQUIRED");
  if (!Object.hasOwn(project, "live") || project.live !== false) {
    blockers.push("VERCEL_PROJECT_MUST_EXPLICITLY_REMAIN_NON_LIVE");
  }
  if (
    !Object.hasOwn(project, "passwordProtection")
    || project.passwordProtection !== null
  ) blockers.push("VERCEL_PASSWORD_PROTECTION_NOT_APPROVED");
  if (
    !Object.hasOwn(project, "trustedIps")
    || project.trustedIps !== null
  ) blockers.push("VERCEL_TRUSTED_IPS_NOT_APPROVED");
  if (
    !Object.hasOwn(project, "protectionBypass")
    || project.protectionBypass === null
    || typeof project.protectionBypass !== "object"
    || Array.isArray(project.protectionBypass)
    || Object.keys(project.protectionBypass).length > 0
  ) blockers.push("VERCEL_PROTECTION_BYPASS_FORBIDDEN");
  if (
    !Array.isArray(project.deploymentProtectionExceptions)
    || project.deploymentProtectionExceptions.length > 0
  ) {
    blockers.push("VERCEL_PROTECTION_EXCEPTIONS_FORBIDDEN");
  }
  if (!Object.hasOwn(project, "webAnalytics") || project.webAnalytics !== null) {
    blockers.push("VERCEL_WEB_ANALYTICS_MUST_REMAIN_OFF");
  }
  if (!Object.hasOwn(project, "speedInsights") || project.speedInsights !== null) {
    blockers.push("VERCEL_SPEED_INSIGHTS_MUST_REMAIN_OFF");
  }
  if (!Object.hasOwn(project, "link") || project.link !== null) {
    blockers.push("VERCEL_GIT_LINK_NOT_APPROVED");
  }
  const domains = Array.isArray(project.domains)
    ? project.domains.map(String)
    : [];
  if (!Array.isArray(project.domains) || domains.length > 0) {
    blockers.push("VERCEL_CUSTOM_DOMAINS_FORBIDDEN");
  }

  const deployments = asArray(raw?.deployments).map((entry) => ({
    id: entry.uid ?? entry.id ?? "",
    projectId: entry.projectId ?? entry.project?.id ?? "",
    name: entry.name ?? "",
    target: entry.target ?? null,
    state: entry.state ?? entry.readyState ?? "",
    createdAt: entry.created ?? entry.createdAt ?? null,
    url: entry.url ?? "",
  }));
  for (const deployment of deployments) {
    if (deployment.projectId !== APPROVED_SCOPE.vercelProjectId) {
      blockers.push(`VERCEL_DEPLOYMENT_PROJECT_MISMATCH_${deployment.id}`);
    }
    if (deployment.name !== APPROVED_SCOPE.vercelProjectName) {
      blockers.push(`VERCEL_DEPLOYMENT_NAME_MISMATCH_${deployment.id}`);
    }
    if (deployment.target === "production") {
      blockers.push(`VERCEL_PRODUCTION_DEPLOYMENT_FORBIDDEN_${deployment.id}`);
    }
    if (!["READY", "CANCELED", "ERROR"].includes(deployment.state)) {
      blockers.push(`VERCEL_NONTERMINAL_OR_UNKNOWN_DEPLOYMENT_${deployment.id}`);
    }
    if (
      deployment.state === "READY"
      && canonicalInventoryDeploymentOrigin(deployment.url) === null
    ) blockers.push(`VERCEL_READY_DEPLOYMENT_URL_INVALID_${deployment.id}`);
  }
  const targetsAreObject = project.targets !== null
    && typeof project.targets === "object"
    && !Array.isArray(project.targets);
  const targetEntries = targetsAreObject
    ? Object.entries(project.targets)
    : [];
  if (
    !Object.hasOwn(project, "targets")
    || !targetsAreObject
    || targetEntries.some(
      ([target, value]) => target === "production" && value !== null,
    )
  ) {
    blockers.push("VERCEL_PRODUCTION_TARGET_FORBIDDEN");
  }

  return {
    provider: "VERCEL_PROTECTED_PREVIEW",
    authenticatedReadback: raw?.authenticatedReadback === true,
    team: {
      id: raw?.team?.id ?? "",
      slug: raw?.team?.slug ?? "",
    },
    project: {
      id: project.id ?? "",
      name: project.name ?? "",
      accountId: project.accountId ?? "",
      createdAt: project.createdAt ?? null,
      updatedAt: project.updatedAt ?? null,
      live: project.live ?? false,
      standardProtection: project.ssoProtection?.deploymentType ?? null,
      teamOidc: {
        enabled: project.oidcTokenConfig?.enabled ?? false,
        issuerMode: project.oidcTokenConfig?.issuerMode ?? null,
      },
      domains,
      gitLinked: project.link !== undefined && project.link !== null,
      webAnalyticsEnabled:
        project.webAnalytics !== undefined && project.webAnalytics !== null,
      speedInsightsEnabled:
        project.speedInsights !== undefined && project.speedInsights !== null,
    },
    deployments,
    projectAbsent: false,
    productionDeploymentCount: deployments.filter(
      (deployment) => deployment.target === "production",
    ).length,
    tokenPrinted: raw?.tokenPrinted !== false,
    oidcTokenPrinted: raw?.oidcTokenPrinted !== false,
  };
}

export function buildInventoryReport(raw, {
  deployWindowExpiresAt,
  inventoryPhase = "AUTO",
} = {}) {
  if (
    inventoryPhase !== "AUTO"
    && inventoryPhase !== "SAFE_BACKEND_FOR_DESTRUCTION"
    && inventoryPhase !== "SYNTHETIC_DELETION_AUTHORIZED"
    && inventoryPhase !== "SYNTHETIC_DELETION_REVOKED_READBACK"
  ) throw operatorError("UNKNOWN_INVENTORY_PHASE");
  const safeBackendForDestruction =
    inventoryPhase === "SAFE_BACKEND_FOR_DESTRUCTION";
  const syntheticDeletionAuthorized =
    inventoryPhase === "SYNTHETIC_DELETION_AUTHORIZED";
  const syntheticDeletionRevokedReadback =
    inventoryPhase === "SYNTHETIC_DELETION_REVOKED_READBACK";
  const blockers = [];
  let expectedSyntheticDeletionWindowCondition = null;
  if (syntheticDeletionAuthorized) {
    try {
      expectedSyntheticDeletionWindowCondition =
        syntheticDeletionWindowCondition(deployWindowExpiresAt);
    } catch {
      blockers.push(
        "EXACT_SYNTHETIC_DELETION_IDENTITY_WINDOW_REQUIRED",
      );
    }
  }
  if (raw.source !== "LIVE_READ_ONLY_PROVIDER_QUERIES" && raw.source !== "LOCAL_TEST_FIXTURE") {
    blockers.push("UNTRUSTED_INVENTORY_SOURCE");
  }
  const vercel = normalizeVercelInventory(
    raw.vercel,
    blockers,
    {
      allowGoogleOnlySyntheticDeletion:
        syntheticDeletionAuthorized
        || syntheticDeletionRevokedReadback,
    },
  );
  if (raw.project === null) {
    const normalizedBudgets = asArray(raw.budgets).map(
      (entry) => normalizeBudget(entry, APPROVED_SCOPE.projectNumber),
    );
    const projectBudgets = normalizedBudgets.filter(
      (entry) => entry.projectScoped,
    );
    const mixedProjectBudgets = normalizedBudgets.filter(
      (entry) => entry.includesApprovedProject && !entry.projectScoped,
    );
    const ignoredUnrelatedBudgetCount =
      normalizedBudgets.length - projectBudgets.length - mixedProjectBudgets.length;
    if (projectBudgets.length > 0 || mixedProjectBudgets.length > 0) {
      blockers.push("PROJECT_ABSENT_BUT_BILLING_BUDGETS_REMAIN");
    }
    if (vercel.project !== null) {
      blockers.push("GOOGLE_PROJECT_ABSENT_BUT_VERCEL_PROJECT_REMAINS");
    }
    const absentReport = {
      schemaVersion: "wp13.12b-ea-operator-resource-inventory-v2",
      mode: "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION",
      externalWrites: 0,
      approvalBinding: APPROVED_SCOPE,
      source: raw.source,
      project: null,
      resources: {
        budgets: projectBudgets,
        budgetScopeSummary: {
          exactProjectBudgetCount: projectBudgets.length,
          mixedProjectScopeBudgetCount: mixedProjectBudgets.length,
          ignoredUnrelatedBudgetCount,
        },
        vercel,
      },
      storagePolicy: {
        appCloudStorage: "NOT_OBSERVED_PROJECT_ABSENT",
        supportingBuildBuckets: [],
        forbiddenAppBuckets: [],
        unclassifiedBuckets: [],
      },
      previewInventory: "INCLUDED_AUTHENTICATED_READBACK",
      blockers: [...new Set(blockers)].sort(),
      inventoryPolicyConformant: blockers.length === 0,
      zeroResourceClaimAllowed:
        projectBudgets.length === 0
        && mixedProjectBudgets.length === 0
        && vercel.project === null
        && blockers.length === 0,
    };
    return {
      ...absentReport,
      inventoryDigest: digestValue(absentReport),
    };
  }

  const destructionTransition = (
    vercel.project === null
    && vercel.projectAbsent === true
    && vercel.authenticatedReadback === true
  );
  const projectId = raw.project.projectId ?? resourceId(raw.project.name);
  const projectNumber = normalizeProjectNumber(
    raw.project.projectNumber ?? raw.project.number,
  );
  if (projectNumber !== APPROVED_SCOPE.projectNumber) {
    blockers.push("PROJECT_NUMBER_MISMATCH");
  }
  const parent = raw.project.parent ?? {};
  if (projectId !== APPROVED_SCOPE.projectId) blockers.push("PROJECT_ID_MISMATCH");
  if (
    String(parent.id ?? parent).replace(/^organizations\//u, "")
      !== APPROVED_SCOPE.organizationId
  ) blockers.push("ORGANIZATION_PARENT_MISMATCH");
  const lifecycleState = raw.project.lifecycleState ?? raw.project.state ?? "";
  if (
    lifecycleState !== "ACTIVE"
    && !(destructionTransition && lifecycleState === "DELETE_REQUESTED")
  ) blockers.push("PROJECT_LIFECYCLE_NOT_ACTIVE");

  const billingAccount = String(
    raw.billing?.billingAccountName ?? raw.billing?.billingAccount ?? "",
  ).replace(/^billingAccounts\//u, "");
  if (
    billingAccount !== APPROVED_SCOPE.billingAccount
    && !(destructionTransition && billingAccount === "")
  ) blockers.push("BILLING_ACCOUNT_MISMATCH");
  if (
    raw.billing?.billingEnabled !== true
    && !(destructionTransition && raw.billing?.billingEnabled === false)
  ) {
    blockers.push("PROJECT_BILLING_MUST_BE_ENABLED");
  }

  const functions = asArray(raw.functions).map(normalizeFunction);
  const observedFunctionNames = functions.map((fn) => fn.name);
  const exactFunctionSet = (
    functions.length === APPROVED_FUNCTIONS.size
    && new Set(observedFunctionNames).size === APPROVED_FUNCTIONS.size
    && [...APPROVED_FUNCTIONS].every(
      (name) => observedFunctionNames.includes(name),
    )
  );
  const safeDestructionFunctionSubset = (
    new Set(observedFunctionNames).size === observedFunctionNames.length
    && observedFunctionNames.every((name) => APPROVED_FUNCTIONS.has(name))
  );
  if (
    (!destructionTransition && !exactFunctionSet)
    || (destructionTransition && !safeDestructionFunctionSubset)
  ) blockers.push("EXACT_APPROVED_FUNCTION_SET_REQUIRED");
  for (const fn of functions) {
    if (!APPROVED_FUNCTIONS.has(fn.name)) blockers.push(`UNAPPROVED_FUNCTION_${fn.name}`);
    if (fn.location !== APPROVED_SCOPE.region) blockers.push(`FUNCTION_REGION_MISMATCH_${fn.name}`);
    if (fn.state !== "ACTIVE") blockers.push(`FUNCTION_NOT_ACTIVE_${fn.name}`);
    if (fn.environment !== "GEN_2") blockers.push(`FUNCTION_NOT_GEN2_${fn.name}`);
    if (fn.runtime !== "nodejs24") blockers.push(`FUNCTION_RUNTIME_MISMATCH_${fn.name}`);
    if (fn.entryPoint !== fn.name) {
      blockers.push(`FUNCTION_ENTRY_POINT_MISMATCH_${fn.name}`);
    }
    if (!approvedBuildServiceAccountReference(fn.buildServiceAccount)) {
      blockers.push(`FUNCTION_BUILD_IDENTITY_MISMATCH_${fn.name}`);
    }
    if (
      fn.buildWorkerPool !== ""
      || fn.vpcConnector !== ""
      || !["", "PRIVATE_RANGES_ONLY"].includes(
        fn.vpcConnectorEgressSettings,
      )
      || fn.binaryAuthorizationPolicy !== ""
      || fn.secretVolumes.length !== 0
    ) blockers.push(`FUNCTION_NETWORK_OR_EXTRA_SECRET_CONFIG_FORBIDDEN_${fn.name}`);
    if (fn.runtimeServiceAccount !== APPROVED_SCOPE.runtimeServiceAccount) {
      blockers.push(`FUNCTION_RUNTIME_IDENTITY_MISMATCH_${fn.name}`);
    }
    const expectedRunService = (
      `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
      + `/services/${fn.name.toLowerCase()}`
    );
    if (fn.runService !== expectedRunService) {
      blockers.push(`FUNCTION_RUN_SERVICE_MISMATCH_${fn.name}`);
    }
    if (
      fn.minInstanceCount !== 0
      || fn.maxInstanceCount !== 1
      || fn.concurrency !== 1
      || memoryQuantityBytes(fn.availableMemory) !== 256 * 1024 * 1024
      || fn.timeoutSeconds !== 60
      || fn.ingressSettings !== "ALLOW_ALL"
      || fn.allTrafficOnLatestRevision !== true
    ) blockers.push(`FUNCTION_DEPLOYMENT_LIMITS_MISMATCH_${fn.name}`);
  }

  const configuredOrigins = functions
    .map((fn) => fn.environmentVariables.LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN)
    .filter((value) => value !== undefined);
  const allOriginsAbsent = configuredOrigins.length === 0;
  const sharedOriginCandidate = (
    functions.length > 0
    && configuredOrigins.length === functions.length
    && new Set(configuredOrigins).size === 1
  )
    ? configuredOrigins[0]
    : null;
  const sharedProtectedPreviewOrigin =
    canonicalProtectedPreviewOrigin(sharedOriginCandidate);
  const readyPreviewDeployments = vercel.deployments.filter(
    (deployment) =>
      deployment.state === "READY"
      && deployment.target !== "production",
  );
  const readyPreviewDeploymentOrigins = new Set(
    readyPreviewDeployments
      .map((deployment) => canonicalInventoryDeploymentOrigin(deployment.url))
      .filter(Boolean),
  );
  const previewOriginBoundToInventory = (
    sharedProtectedPreviewOrigin !== null
    && readyPreviewDeploymentOrigins.has(sharedProtectedPreviewOrigin)
  );
  const googleOnlySyntheticDeletionInventory = (
    (
      syntheticDeletionAuthorized
      || syntheticDeletionRevokedReadback
    )
    && vercel.collectionSkippedForGoogleOnlySyntheticDeletion === true
  );
  if (
    !allOriginsAbsent
    && sharedProtectedPreviewOrigin === null
  ) blockers.push("FUNCTION_PROTECTED_PREVIEW_ORIGIN_MISMATCH");
  if (
    !destructionTransition
    && !googleOnlySyntheticDeletionInventory
    &&
    sharedProtectedPreviewOrigin !== null
    && !previewOriginBoundToInventory
  ) blockers.push("FUNCTION_PREVIEW_ORIGIN_NOT_BOUND_TO_READY_VERCEL_DEPLOYMENT");
  if (
    !destructionTransition
    && !googleOnlySyntheticDeletionInventory
    && (
      (allOriginsAbsent && readyPreviewDeployments.length !== 0)
      || (
        sharedProtectedPreviewOrigin !== null
        && readyPreviewDeployments.length !== 1
      )
    )
  ) blockers.push("EXACT_RUNTIME_BOUND_READY_VERCEL_DEPLOYMENT_SET_REQUIRED");

  const issueFunction = functions.find(
    (fn) => fn.name === "issueSyntheticSession",
  );
  const issuanceValue =
    issueFunction?.environmentVariables
      ?.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED;
  let functionRuntimeConfigurationPhase = "INVALID";
  if (destructionTransition && functions.length === 0) {
    functionRuntimeConfigurationPhase =
      "POST_DEACTIVATION_FUNCTIONS_ABSENT";
  } else if (
    destructionTransition
    && allOriginsAbsent
    && (issueFunction === undefined || issuanceValue === "false")
  ) {
    functionRuntimeConfigurationPhase =
      "POST_DEACTIVATION_FUNCTION_RETIREMENT_DISABLED";
  } else if (
    destructionTransition
    && sharedProtectedPreviewOrigin !== null
    && (
      issueFunction === undefined
      || issuanceValue === "false"
      || issuanceValue === "true"
    )
  ) {
    functionRuntimeConfigurationPhase =
      "POST_DEACTIVATION_FUNCTION_RETIREMENT_CONFIGURED";
  } else if (allOriginsAbsent && issuanceValue === "false") {
    functionRuntimeConfigurationPhase = "DISABLED_FIRST_DEPLOY";
  } else if (
    (
      previewOriginBoundToInventory
      || (
        googleOnlySyntheticDeletionInventory
        && sharedProtectedPreviewOrigin !== null
      )
    )
    && issuanceValue === "false"
  ) {
    functionRuntimeConfigurationPhase =
      "PROTECTED_PREVIEW_CONFIGURED_ISSUANCE_DISABLED";
  } else if (
    previewOriginBoundToInventory
    && issuanceValue === "true"
  ) {
    functionRuntimeConfigurationPhase = "PROTECTED_PREVIEW_ACTIVE";
  } else {
    blockers.push("FUNCTION_RUNTIME_CONFIGURATION_PHASE_INVALID");
  }
  for (const fn of functions) {
    const expectedIssuanceValue = (
      functionRuntimeConfigurationPhase === "PROTECTED_PREVIEW_ACTIVE"
      || (
        destructionTransition
        && fn.name === "issueSyntheticSession"
        && issuanceValue === "true"
      )
    ) ? "true" : "false";
    const expectedEnvironment = {
      LUDYS_STAGING_RUNTIME_PHASE: "EXTERNAL_SYNTHETIC_STAGING",
      ...(sharedProtectedPreviewOrigin === null
        ? {}
        : {
            LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN:
              sharedProtectedPreviewOrigin,
          }),
      ...(fn.name === "issueSyntheticSession"
        ? {
            LUDYS_STAGING_SESSION_ISSUANCE_ENABLED:
              expectedIssuanceValue,
          }
        : {}),
    };
    if (!exactStringRecord(fn.environmentVariables, expectedEnvironment)) {
      blockers.push(`FUNCTION_ENVIRONMENT_VARIABLES_MISMATCH_${fn.name}`);
    }
    const [secretReference] = fn.secretEnvironmentVariables;
    if (
      fn.secretEnvironmentVariables.length !== 1
      || secretReference?.key !== APPROVED_SCOPE.capabilitySecret
      || secretReference?.secret !== APPROVED_SCOPE.capabilitySecret
      || secretReference?.version !== "1"
      || ![
        APPROVED_SCOPE.projectId,
        APPROVED_SCOPE.projectNumber,
      ].includes(secretReference?.projectId)
    ) blockers.push(`FUNCTION_SECRET_REFERENCE_MISMATCH_${fn.name}`);
  }

  const runServices = asArray(raw.runServices).map(normalizeRunService);
  const observedRunServiceNames = runServices.map(
    (service) => service.name.toLowerCase(),
  );
  const exactRunServiceSet = (
    runServices.length === APPROVED_RUN_SERVICES.size
    && new Set(observedRunServiceNames).size === APPROVED_RUN_SERVICES.size
    && [...APPROVED_RUN_SERVICES].every(
      (name) => observedRunServiceNames.includes(name),
    )
  );
  const safeDestructionRunSubset = (
    new Set(observedRunServiceNames).size === observedRunServiceNames.length
    && observedRunServiceNames.every((name) => APPROVED_RUN_SERVICES.has(name))
    && JSON.stringify([...observedRunServiceNames].sort())
      === JSON.stringify(
        observedFunctionNames.map((name) => name.toLowerCase()).sort(),
      )
  );
  if (
    (!destructionTransition && !exactRunServiceSet)
    || (destructionTransition && !safeDestructionRunSubset)
  ) blockers.push("EXACT_APPROVED_CLOUD_RUN_SERVICE_SET_REQUIRED");
  for (const service of runServices) {
    const serviceId = service.name.toLowerCase();
    if (!APPROVED_RUN_SERVICES.has(serviceId)) {
      blockers.push(`UNAPPROVED_CLOUD_RUN_SERVICE_${service.name}`);
    }
    if (service.location !== APPROVED_SCOPE.region) {
      blockers.push(`CLOUD_RUN_REGION_MISMATCH_${service.name}`);
    }
    const expectedRunService = (
      `projects/${APPROVED_SCOPE.projectId}/locations/${APPROVED_SCOPE.region}`
      + `/services/${serviceId}`
    );
    if (service.resourceName !== expectedRunService) {
      blockers.push(`CLOUD_RUN_RESOURCE_NAME_MISMATCH_${service.name}`);
    }
    if (service.managedBy !== "cloudfunctions") {
      blockers.push(`CLOUD_RUN_MANAGER_MISMATCH_${service.name}`);
    }
    if (service.runtimeServiceAccount !== APPROVED_SCOPE.runtimeServiceAccount) {
      blockers.push(`CLOUD_RUN_RUNTIME_IDENTITY_MISMATCH_${service.name}`);
    }
    if (service.ingress !== "INGRESS_TRAFFIC_ALL") {
      blockers.push(`CLOUD_RUN_INGRESS_MISMATCH_${service.name}`);
    }
  }

  const firestore = raw.firestore === null
    ? null
    : {
        name: raw.firestore?.name ?? "",
        location: raw.firestore?.locationId ?? "",
        type: raw.firestore?.type ?? "",
        edition: raw.firestore?.databaseEdition ?? "",
        pitr: raw.firestore?.pointInTimeRecoveryEnablement ?? "",
        deleteProtection: raw.firestore?.deleteProtectionState ?? "",
      };
  if (firestore === null) {
    if (
      !destructionTransition
      || raw.firestoreDatabaseAbsent !== true
    ) blockers.push("DEFAULT_FIRESTORE_DATABASE_REQUIRED");
  } else {
    const expectedFirestoreName =
      `projects/${APPROVED_SCOPE.projectId}/databases/(default)`;
    if (firestore.name !== expectedFirestoreName) {
      blockers.push("FIRESTORE_DEFAULT_DATABASE_NAME_MISMATCH");
    }
    if (firestore.location !== APPROVED_SCOPE.region) {
      blockers.push("FIRESTORE_REGION_MISMATCH");
    }
    if (firestore.type !== "FIRESTORE_NATIVE") {
      blockers.push("FIRESTORE_NATIVE_MODE_REQUIRED");
    }
    if (firestore.edition !== "STANDARD") {
      blockers.push("FIRESTORE_STANDARD_EDITION_REQUIRED");
    }
    if (firestore.pitr !== "POINT_IN_TIME_RECOVERY_DISABLED") {
      blockers.push("FIRESTORE_PITR_MUST_REMAIN_OFF");
    }
    if (firestore.deleteProtection !== "DELETE_PROTECTION_DISABLED") {
      blockers.push("FIRESTORE_DELETE_PROTECTION_MUST_REMAIN_OFF");
    }
  }

  const firestoreRootCollectionIds = asArray(
    raw.firestoreRootCollectionIds,
  ).map(String);
  const uniqueFirestoreRootCollectionIds = new Set(
    firestoreRootCollectionIds,
  );
  if (
    raw.firestoreDataReadbackPerformed !== true
    || uniqueFirestoreRootCollectionIds.size
      !== firestoreRootCollectionIds.length
    || firestoreRootCollectionIds.some(
      (collectionId) =>
        !APPROVED_FIRESTORE_ROOT_COLLECTIONS.has(collectionId),
    )
  ) blockers.push("FIRESTORE_ROOT_COLLECTION_ALLOWLIST_MISMATCH");

  const firestoreDocuments = asArray(raw.firestoreDocuments).map((entry) => ({
    collectionId: entry.collectionId ?? "",
    count: entry.count ?? null,
    documentNames: asArray(entry.documentNames).map(String),
    schemaValidation: {
      documentsChecked:
        entry.schemaValidation?.documentsChecked ?? null,
      conformantDocuments:
        entry.schemaValidation?.conformantDocuments ?? null,
      allDocumentsConformant:
        entry.schemaValidation?.allDocumentsConformant === true,
      payloadValuesPersistedOrPrinted:
        entry.schemaValidation?.payloadValuesPersistedOrPrinted !== false,
    },
  }));
  const observedFirestoreDataCollections = firestoreDocuments.map(
    (entry) => entry.collectionId,
  );
  if (
    firestoreDocuments.length !== APPROVED_FIRESTORE_DATA_COLLECTIONS.length
    || new Set(observedFirestoreDataCollections).size
      !== APPROVED_FIRESTORE_DATA_COLLECTIONS.length
    || APPROVED_FIRESTORE_DATA_COLLECTIONS.some(
      (collectionId) =>
        !observedFirestoreDataCollections.includes(collectionId),
    )
  ) blockers.push("FIRESTORE_DATA_COLLECTION_INVENTORY_INCOMPLETE");
  for (const collection of firestoreDocuments) {
    const prefix =
      `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
      + `${collection.collectionId}/`;
    const ids = collection.documentNames.map(
      (name) => name.startsWith(prefix) ? name.slice(prefix.length) : "",
    );
    const idPattern = collection.collectionId === "syntheticCapabilityGrants"
      ? /^[A-Za-z0-9_-]{24}$/u
      : /^synthetic-wp13-12b-[A-Za-z0-9_-]{20,64}$/u;
    if (
      !APPROVED_FIRESTORE_DATA_COLLECTIONS.includes(collection.collectionId)
      || !Number.isSafeInteger(collection.count)
      || collection.count < 0
      || collection.count !== collection.documentNames.length
      || new Set(collection.documentNames).size
        !== collection.documentNames.length
      || ids.some((id) => !idPattern.test(id))
      || collection.schemaValidation.documentsChecked !== collection.count
      || collection.schemaValidation.conformantDocuments !== collection.count
      || !collection.schemaValidation.allDocumentsConformant
      || collection.schemaValidation.payloadValuesPersistedOrPrinted
      || (
        collection.count > 0
        && !uniqueFirestoreRootCollectionIds.has(collection.collectionId)
      )
    ) blockers.push(
      `FIRESTORE_SYNTHETIC_DOCUMENT_INVENTORY_MISMATCH_${collection.collectionId}`,
    );
  }
  const firestoreGrantRelationshipEvidence = {
    sessionsChecked:
      raw.firestoreGrantRelationshipEvidence?.sessionsChecked ?? null,
    grantsChecked:
      raw.firestoreGrantRelationshipEvidence?.grantsChecked ?? null,
    everyGrantPointsToObservedSession:
      raw.firestoreGrantRelationshipEvidence
        ?.everyGrantPointsToObservedSession === true,
    maximumGrantsPerSession:
      raw.firestoreGrantRelationshipEvidence?.maximumGrantsPerSession
      ?? null,
    boundedGrantMultiplicity:
      raw.firestoreGrantRelationshipEvidence?.boundedGrantMultiplicity
      === true,
    allDocumentsConformant:
      raw.firestoreGrantRelationshipEvidence?.allDocumentsConformant
      === true,
    relationshipDigest:
      raw.firestoreGrantRelationshipEvidence?.relationshipDigest ?? "",
    identifiersPersistedOrPrinted:
      raw.firestoreGrantRelationshipEvidence
        ?.identifiersPersistedOrPrinted !== false,
  };
  if (syntheticDeletionAuthorized) {
    const sessions = firestoreDocuments.find(
      ({ collectionId }) => collectionId === "syntheticSessions",
    );
    const grants = firestoreDocuments.find(
      ({ collectionId }) => collectionId === "syntheticCapabilityGrants",
    );
    if (
      firestoreGrantRelationshipEvidence.sessionsChecked
        !== sessions?.count
      || firestoreGrantRelationshipEvidence.grantsChecked !== grants?.count
      || firestoreGrantRelationshipEvidence
        .everyGrantPointsToObservedSession !== true
      || firestoreGrantRelationshipEvidence.maximumGrantsPerSession !== 2
      || firestoreGrantRelationshipEvidence.boundedGrantMultiplicity
        !== true
      || firestoreGrantRelationshipEvidence.allDocumentsConformant !== true
      || !/^[a-f0-9]{64}$/u.test(
        firestoreGrantRelationshipEvidence.relationshipDigest,
      )
      || firestoreGrantRelationshipEvidence
        .identifiersPersistedOrPrinted !== false
    ) {
      blockers.push(
        "SYNTHETIC_GRANT_TO_SESSION_RELATIONSHIP_PROOF_REQUIRED",
      );
    }
  }
  const nestedCollectionEvidence = {
    parentDocumentsChecked:
      raw.firestoreNestedCollectionEvidence?.parentDocumentsChecked ?? null,
    nestedCollectionCount:
      raw.firestoreNestedCollectionEvidence?.nestedCollectionCount ?? null,
    noNestedCollections:
      raw.firestoreNestedCollectionEvidence?.noNestedCollections === true,
    nestedCollectionIdentifiersPersistedOrPrinted:
      raw.firestoreNestedCollectionEvidence
        ?.nestedCollectionIdentifiersPersistedOrPrinted !== false,
  };
  const expectedNestedParents = firestoreDocuments.reduce(
    (count, collection) => count + (
      Number.isSafeInteger(collection.count) ? collection.count : 0
    ),
    firestore === null ? 0 : 1,
  );
  if (
    nestedCollectionEvidence.parentDocumentsChecked !== expectedNestedParents
    || nestedCollectionEvidence.nestedCollectionCount !== 0
    || !nestedCollectionEvidence.noNestedCollections
    || nestedCollectionEvidence.nestedCollectionIdentifiersPersistedOrPrinted
  ) blockers.push("FIRESTORE_NESTED_COLLECTIONS_MUST_BE_PROVEN_ABSENT");
  if (
    firestore === null
    && (
      firestoreRootCollectionIds.length !== 0
      || firestoreDocuments.some((collection) => collection.count !== 0)
      || raw.firestoreControlDocument !== null
    )
  ) blockers.push("FIRESTORE_ABSENCE_READBACK_INCONSISTENT");

  const controlDocument = raw.firestoreControlDocument;
  let firestoreControl = null;
  if (controlDocument !== null && controlDocument !== undefined) {
    const fields = controlDocument.fields ?? {};
    const fieldNames = Object.keys(fields).sort();
    const controlEpochText = fields.controlEpoch?.integerValue;
    const controlEpoch = /^[1-9][0-9]*$/u.test(controlEpochText ?? "")
      ? Number(controlEpochText)
      : null;
    const stagingEnabled = fields.stagingEnabled?.booleanValue;
    const reasonCode = fields.reasonCode?.stringValue;
    const changedAt = fields.changedAt?.timestampValue;
    firestoreControl = {
      name: controlDocument.name ?? "",
      controlEpoch,
      stagingEnabled:
        typeof stagingEnabled === "boolean" ? stagingEnabled : null,
      reasonCode: typeof reasonCode === "string" ? reasonCode : "",
      changedAt: typeof changedAt === "string" ? changedAt : "",
      updateTime: controlDocument.updateTime ?? "",
    };
    const reasonMatchesState = stagingEnabled === true
      ? reasonCode === "EXPLICIT_SYNTHETIC_PROOF_WINDOW"
      : CONTROL_DISABLED_REASONS.has(reasonCode);
    if (
      firestoreControl.name
        !== (
          `projects/${APPROVED_SCOPE.projectId}/databases/(default)/documents/`
          + "syntheticStagingControl/current"
        )
      || JSON.stringify(fieldNames)
        !== JSON.stringify([
          "changedAt",
          "controlEpoch",
          "reasonCode",
          "stagingEnabled",
        ])
      || !Number.isSafeInteger(controlEpoch)
      || controlEpoch < 1
      || typeof stagingEnabled !== "boolean"
      || !reasonMatchesState
      || typeof changedAt !== "string"
      || !Number.isFinite(Date.parse(changedAt))
      || typeof controlDocument.updateTime !== "string"
      || !Number.isFinite(Date.parse(controlDocument.updateTime))
    ) blockers.push("FIRESTORE_STAGING_CONTROL_READBACK_INVALID");
  } else if (firestore !== null) {
    blockers.push("FIRESTORE_STAGING_CONTROL_READBACK_REQUIRED");
  }
  if (
    firestore !== null
    && (
      !uniqueFirestoreRootCollectionIds.has("syntheticStagingControl")
      || (
        (
          destructionTransition
          || functionRuntimeConfigurationPhase !== "PROTECTED_PREVIEW_ACTIVE"
        )
        && firestoreControl?.stagingEnabled !== false
      )
    )
  ) blockers.push("FIRESTORE_CONTROL_STATE_MISMATCH_FOR_RUNTIME_PHASE");

  const secrets = asArray(raw.secrets).map((entry) => ({
    resourceName: entry.name ?? "",
    name: resourceId(entry.name),
    replication: entry.replication ?? {},
  }));
  if (
    (!destructionTransition && secrets.length !== 1)
    || (destructionTransition && secrets.length > 1)
  ) {
    blockers.push("EXACTLY_ONE_APPROVED_CAPABILITY_SECRET_REQUIRED");
  }
  for (const secret of secrets) {
    const exactResourceNames = [
      APPROVED_SCOPE.projectId,
      APPROVED_SCOPE.projectNumber,
    ].map(
      (project) =>
        `projects/${project}/secrets/${APPROVED_SCOPE.capabilitySecret}`,
    );
    const replicas = asArray(secret.replication?.userManaged?.replicas);
    if (
      secret.name !== APPROVED_SCOPE.capabilitySecret
      || !exactResourceNames.includes(secret.resourceName)
    ) blockers.push(`UNAPPROVED_SECRET_${secret.name}`);
    if (
      Object.hasOwn(secret.replication, "automatic")
      || replicas.length !== 1
      || replicas[0]?.location !== APPROVED_SCOPE.region
    ) blockers.push("CAPABILITY_SECRET_REPLICATION_MISMATCH");
  }
  const secretVersions = asArray(raw.secretVersions).map((entry) => ({
    resourceName: entry.name ?? "",
    name: resourceId(entry.name),
    state: entry.state ?? "",
  }));
  const exactVersionNames = [
    APPROVED_SCOPE.projectId,
    APPROVED_SCOPE.projectNumber,
  ].map(
    (project) =>
      `projects/${project}/secrets/${APPROVED_SCOPE.capabilitySecret}/versions/1`,
  );
  const exactEnabledSecretVersionOne = (
    secretVersions.length === 1
    && secretVersions[0]?.name === "1"
    && secretVersions[0]?.state === "ENABLED"
    && exactVersionNames.includes(secretVersions[0]?.resourceName)
  );
  const exactDestroyedSecretVersionOne = (
    secretVersions.length === 1
    && secretVersions[0]?.name === "1"
    && secretVersions[0]?.state === "DESTROYED"
    && exactVersionNames.includes(secretVersions[0]?.resourceName)
  );
  if (
    (!destructionTransition && !exactEnabledSecretVersionOne)
    || (
      destructionTransition
      && !(
        (secrets.length === 0 && secretVersions.length === 0)
        || (
          secrets.length === 1
          && (
            exactEnabledSecretVersionOne
            || exactDestroyedSecretVersionOne
          )
        )
      )
    )
  ) blockers.push("EXACT_ENABLED_CAPABILITY_SECRET_VERSION_1_REQUIRED");

  const serviceAccounts = asArray(raw.serviceAccounts).map((entry) => ({
    email: entry.email ?? "",
    disabled: entry.disabled === true,
  }));
  const requiredServiceAccounts = new Set([
    APPROVED_SCOPE.runtimeServiceAccount,
    APPROVED_SCOPE.previewServiceAccount,
    APPROVED_DEPLOY_SERVICE_ACCOUNT,
    APPROVED_BUILD_SERVICE_ACCOUNT,
  ]);
  for (const email of requiredServiceAccounts) {
    const matches = serviceAccounts.filter((entry) => entry.email === email);
    const mayBeDeletedDuringDestruction = (
      destructionTransition
      && email !== APPROVED_BUILD_SERVICE_ACCOUNT
    );
    if (
      matches.length > 1
      || (!mayBeDeletedDuringDestruction && matches.length !== 1)
      || (matches.length === 1 && matches[0].disabled)
    ) {
      blockers.push(`REQUIRED_SERVICE_ACCOUNT_STATE_MISMATCH_${email}`);
    }
  }
  const customServiceAccountSuffix =
    `@${APPROVED_SCOPE.projectId}.iam.gserviceaccount.com`;
  if (
    serviceAccounts.some(
      (entry) =>
        entry.email.endsWith(customServiceAccountSuffix)
        && !requiredServiceAccounts.has(entry.email),
    )
  ) blockers.push("UNAPPROVED_CUSTOM_SERVICE_ACCOUNT_PRESENT");

  const normalizeUserManagedKeys = (entries) =>
    asArray(entries).map((entry) => ({
      name: entry.name ?? "",
      keyType: entry.keyType ?? "USER_MANAGED",
    }));
  const runtimeKeys = asArray(raw.runtimeKeys).map((entry) => ({
    name: entry.name ?? "",
    keyType: entry.keyType ?? "USER_MANAGED",
  }));
  const deployServiceAccountKeys = normalizeUserManagedKeys(
    raw.deployServiceAccountKeys,
  );
  const buildServiceAccountKeys = normalizeUserManagedKeys(
    raw.buildServiceAccountKeys,
  );
  if (
    raw.runtimeKeysReadbackPerformed !== true
    || runtimeKeys.length > 0
  ) {
    blockers.push("RUNTIME_SERVICE_ACCOUNT_USER_MANAGED_KEY_FORBIDDEN");
  }
  if (
    raw.deployServiceAccountKeysReadbackPerformed !== true
    || deployServiceAccountKeys.length > 0
  ) blockers.push("DEPLOY_SERVICE_ACCOUNT_USER_MANAGED_KEY_FORBIDDEN");
  if (
    raw.buildServiceAccountKeysReadbackPerformed !== true
    || buildServiceAccountKeys.length > 0
  ) blockers.push("BUILD_SERVICE_ACCOUNT_USER_MANAGED_KEY_FORBIDDEN");

  const iamBindings = normalizeIamBindings(raw.iamPolicy);
  const organizationIamBindings = normalizeIamBindings(
    raw.organizationIamPolicy,
  );
  const runtimeMember =
    `serviceAccount:${APPROVED_SCOPE.runtimeServiceAccount}`;
  const capabilitySecretIamBindings = normalizeIamBindings(
    raw.capabilitySecretIamPolicy,
  );
  const exactCapabilitySecretPolicy = (
    capabilitySecretIamBindings.length === 1
    && capabilitySecretIamBindings[0]?.role
      === "roles/secretmanager.secretAccessor"
    && capabilitySecretIamBindings[0]?.condition === null
    && capabilitySecretIamBindings[0]?.members.length === 1
    && capabilitySecretIamBindings[0]?.members[0] === runtimeMember
  );
  if (
    raw.capabilitySecretIamPolicyReadbackPerformed !== true
    || (
      secrets.length === 1
        ? !exactCapabilitySecretPolicy
        : capabilitySecretIamBindings.length !== 0
    )
  ) blockers.push("CAPABILITY_SECRET_EXACT_RUNTIME_ACCESSOR_REQUIRED");

  const runtimeBindings = iamBindings.filter(
    (binding) => binding.members.includes(runtimeMember),
  );
  const expectedRuntimeRoles = [
    "roles/datastore.user",
    "roles/logging.logWriter",
  ];
  const runtimeAccountPresent = serviceAccounts.some(
    (entry) => entry.email === APPROVED_SCOPE.runtimeServiceAccount,
  );
  const exactRuntimeProjectRoles = (
    runtimeBindings.length === expectedRuntimeRoles.length
    && runtimeBindings.every((binding) => binding.condition === null)
    && JSON.stringify(runtimeBindings.map((binding) => binding.role).sort())
      === JSON.stringify(expectedRuntimeRoles)
  );
  if (
    runtimeAccountPresent
      ? !exactRuntimeProjectRoles
      : runtimeBindings.length !== 0
  ) blockers.push("RUNTIME_SERVICE_ACCOUNT_EXACT_PROJECT_ROLE_SET_REQUIRED");

  const deployMember = `serviceAccount:${APPROVED_DEPLOY_SERVICE_ACCOUNT}`;
  const deployProjectBindings = iamBindings.filter(
    (binding) => binding.members.includes(deployMember),
  );
  const indirectProjectDeployAuthorityBindings =
    iamBindings.filter((binding) =>
      binding.members.some((member) =>
        organizationMemberCouldGrantDeployIdentity(
          member,
          deployMember,
        )));
  const inheritedDeployAuthorityBindings =
    organizationIamBindings.filter((binding) =>
      binding.members.some((member) =>
        organizationMemberCouldGrantDeployIdentity(
          member,
          deployMember,
        )));
  const deployIdentityIamScopeEvidence = (
    bindings,
    rawPolicy,
    readbackPerformed,
    scope,
  ) => {
    const applicableBindings = bindings.filter((binding) =>
      binding.members.some((member) =>
        organizationMemberCouldGrantDeployIdentity(
          member,
          deployMember,
        )));
    return {
      scope,
      readbackPerformed: readbackPerformed === true,
      policyDigest: digestValue(rawPolicy ?? {}),
      bindingCount: bindings.length,
      directDeployMemberBindingCount: bindings.filter(
        (binding) => binding.members.includes(deployMember),
      ).length,
      publicPrincipalBindingCount: bindings.filter(
        (binding) => binding.members.some(
          (member) =>
            member === "allUsers"
            || member === "allAuthenticatedUsers",
        ),
      ).length,
      groupOrDomainPrincipalBindingCount:
        bindings.filter((binding) =>
          binding.members.some(
            (member) =>
              member.startsWith("group:")
              || member.startsWith("domain:"),
          )).length,
      serviceAccountPrincipalSetBindingCount:
        bindings.filter((binding) =>
          binding.members.some(
            (member) =>
              typeof member === "string"
              && member.startsWith(
                "principalSet://cloudresourcemanager.googleapis.com/",
              )
              && /\/type\/ServiceAccount$/u.test(member),
          )).length,
      applicableDeployAuthorityBindingCount:
        applicableBindings.length,
      exactApplicableDeployAuthorityAbsent:
        readbackPerformed === true
        && applicableBindings.length === 0,
      principalIdentifiersPersistedOrPrinted: false,
    };
  };
  const projectIamScopeEvidence = {
    projectId: APPROVED_SCOPE.projectId,
    ...deployIdentityIamScopeEvidence(
      iamBindings,
      raw.iamPolicy,
      raw.iamPolicyReadbackPerformed,
      `projects/${APPROVED_SCOPE.projectId}`,
    ),
  };
  const organizationIamScopeEvidence = {
    organizationId: APPROVED_SCOPE.organizationId,
    ...deployIdentityIamScopeEvidence(
      organizationIamBindings,
      raw.organizationIamPolicy,
      raw.organizationIamPolicyReadbackPerformed,
      `organizations/${APPROVED_SCOPE.organizationId}`,
    ),
  };
  /*
   * Keep these summaries identifier-free. The raw policies are needed only
   * while deriving policy conformance and are redacted from persisted
   * inventory evidence.
   */
  if (
    (
      syntheticDeletionAuthorized
      || syntheticDeletionRevokedReadback
      || safeBackendForDestruction
    )
    && (
      raw.iamPolicyReadbackPerformed !== true
      || indirectProjectDeployAuthorityBindings.length > 0
    )
  ) {
    blockers.push(
      "EXACT_PROJECT_DEPLOY_AUTHORITY_ABSENCE_REQUIRED",
    );
  }
  /*
   * A broad organization principal can also contain the deploy identity.
   * Fail closed rather than inferring effective membership.
   */
  if (
    (
      syntheticDeletionAuthorized
      || syntheticDeletionRevokedReadback
      || safeBackendForDestruction
    )
    && (
      raw.organizationIamPolicyReadbackPerformed !== true
      || inheritedDeployAuthorityBindings.length > 0
    )
  ) {
    blockers.push(
      "EXACT_PARENT_ORGANIZATION_DEPLOY_AUTHORITY_ABSENCE_REQUIRED",
    );
  }
  if (!syntheticDeletionAuthorized && deployProjectBindings.length > 0) {
    blockers.push("DEPLOY_SERVICE_ACCOUNT_PROJECT_ROLES_MUST_BE_REVOKED");
  }

  const buildMember = `serviceAccount:${APPROVED_BUILD_SERVICE_ACCOUNT}`;
  const buildProjectBindings = iamBindings.filter(
    (binding) => binding.members.includes(buildMember),
  );
  const buildAccountPresent = serviceAccounts.some(
    (entry) => entry.email === APPROVED_BUILD_SERVICE_ACCOUNT,
  );
  if (
    (buildAccountPresent && (
      buildProjectBindings.length !== 1
    || buildProjectBindings[0]?.role !== "roles/logging.logWriter"
    || buildProjectBindings[0]?.condition !== null
    ))
    || (!buildAccountPresent && buildProjectBindings.length !== 0)
  ) blockers.push("BUILD_SERVICE_ACCOUNT_EXACT_PROJECT_ROLE_SET_REQUIRED");

  const functionArtifactRepositoryIamBindings = normalizeIamBindings(
    raw.functionArtifactRepositoryIamPolicy,
  );
  const functionSourceBucketIamBindings = normalizeIamBindings(
    raw.functionSourceBucketIamPolicy,
  );
  const artifactBuildBindings = functionArtifactRepositoryIamBindings.filter(
    (binding) => binding.members.includes(buildMember),
  );
  const sourceBucketBuildBindings = functionSourceBucketIamBindings.filter(
    (binding) => binding.members.includes(buildMember),
  );
  if (
    [
      capabilitySecretIamBindings,
      functionArtifactRepositoryIamBindings,
      functionSourceBucketIamBindings,
    ].some((bindings) => bindings.some(
      (binding) => binding.members.includes(deployMember),
    ))
  ) {
    blockers.push(
      "DEPLOY_IDENTITY_FORBIDDEN_ON_NON_DELETE_RESOURCE_POLICY",
    );
  }
  const sourceBucketExpected = asArray(raw.buckets).some(
    (entry) =>
      normalizeBucketName(entry.name ?? entry.url)
        === `gcf-v2-sources-${projectNumber}-${APPROVED_SCOPE.region}`,
  );
  const artifactRepositoryExpected = asArray(raw.artifactRepositories).some(
    (entry) =>
      resourceId(entry.name) === "gcf-artifacts"
      && (locationFromName(entry.name) || entry.location)
        === APPROVED_SCOPE.region,
  );
  if (
    raw.buildResourceIamPoliciesReadbackPerformed !== true
    || (
      artifactRepositoryExpected
        ? (
          artifactBuildBindings.length !== 1
          || artifactBuildBindings[0]?.role !== "roles/artifactregistry.writer"
          || artifactBuildBindings[0]?.condition !== null
        )
        : artifactBuildBindings.length !== 0
    )
    || (
      sourceBucketExpected
        ? (
          sourceBucketBuildBindings.length !== 1
          || sourceBucketBuildBindings[0]?.role !== "roles/storage.objectViewer"
          || sourceBucketBuildBindings[0]?.condition !== null
        )
        : sourceBucketBuildBindings.length !== 0
    )
  ) blockers.push("BUILD_SERVICE_ACCOUNT_EXACT_RESOURCE_ROLE_SET_REQUIRED");

  const deployServiceAccountIamBindings = normalizeIamBindings(
    raw.deployServiceAccountIamPolicy,
  );
  const runtimeServiceAccountIamBindings = normalizeIamBindings(
    raw.runtimeServiceAccountIamPolicy,
  );
  const buildServiceAccountIamBindings = normalizeIamBindings(
    raw.buildServiceAccountIamPolicy,
  );
  if (syntheticDeletionAuthorized) {
    const deployAccount = serviceAccounts.find(
      (entry) => entry.email === APPROVED_DEPLOY_SERVICE_ACCOUNT,
    );
    const exactConditionalOwnerTokenCreator = (
      deployServiceAccountIamBindings.length === 1
      && deployServiceAccountIamBindings[0]?.role
        === "roles/iam.serviceAccountTokenCreator"
      && deployServiceAccountIamBindings[0]?.members.length === 1
      && deployServiceAccountIamBindings[0]?.members[0]
        === `user:${APPROVED_SCOPE.approvedGoogleAccount}`
      && exactNormalizedIamCondition(
        deployServiceAccountIamBindings[0]?.condition,
        expectedSyntheticDeletionWindowCondition,
      )
    );
    const deployMemberOnOtherCollectedResource = [
      capabilitySecretIamBindings,
      functionArtifactRepositoryIamBindings,
      functionSourceBucketIamBindings,
      runtimeServiceAccountIamBindings,
      buildServiceAccountIamBindings,
    ].some((bindings) => bindings.some(
      (binding) => binding.members.includes(deployMember),
    ));
    if (
      raw.serviceAccountIamPolicyReadbackPerformed !== true
      || deployAccount?.email !== APPROVED_DEPLOY_SERVICE_ACCOUNT
      || deployAccount?.disabled === true
      || deployServiceAccountKeys.length !== 0
      || deployProjectBindings.length !== 0
      || !exactConditionalOwnerTokenCreator
      || runtimeServiceAccountIamBindings.length !== 0
      || buildServiceAccountIamBindings.length !== 0
      || deployMemberOnOtherCollectedResource
    ) {
      blockers.push(
        "EXACT_DOWNSCOPED_KEYLESS_SYNTHETIC_DELETION_IDENTITY_REQUIRED",
      );
    }
  } else if (
    raw.serviceAccountIamPolicyReadbackPerformed !== true
    || deployServiceAccountIamBindings.length > 0
    || runtimeServiceAccountIamBindings.length > 0
    || buildServiceAccountIamBindings.length > 0
  ) {
    blockers.push(
      "DEPLOY_IDENTITY_TEMPORARY_BINDINGS_MUST_BE_REVOKED",
      "SERVICE_ACCOUNT_RESOURCE_POLICIES_MUST_BE_EXACTLY_EMPTY",
    );
  }

  const previewMember = `serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`;
  const previewProjectRoles = iamBindings
    .filter((binding) => binding.members.includes(previewMember))
    .map((binding) => binding.role);
  if (previewProjectRoles.length > 0) {
    blockers.push("PREVIEW_SERVICE_ACCOUNT_PROJECT_ROLES_FORBIDDEN");
  }
  const federatedProjectBindings = directFederatedProjectBindings(iamBindings);
  if (federatedProjectBindings.length > 0) {
    blockers.push("FEDERATED_PREVIEW_PRINCIPAL_PROJECT_ROLES_FORBIDDEN");
  }

  const workloadIdentityPools = asArray(raw.workloadIdentityPools).map((entry) => ({
    id: resourceId(entry.name),
    name: entry.name ?? "",
    state: entry.state ?? "",
    disabled: entry.disabled === true,
  }));
  if (
    (!destructionTransition && workloadIdentityPools.length !== 1)
    || (destructionTransition && workloadIdentityPools.length > 1)
  ) {
    blockers.push("EXACT_APPROVED_WORKLOAD_IDENTITY_POOL_REQUIRED");
  }
  for (const pool of workloadIdentityPools) {
    if (pool.id !== APPROVED_SCOPE.workloadIdentityPoolId) {
      blockers.push(`UNAPPROVED_WORKLOAD_IDENTITY_POOL_${pool.id}`);
    }
    if (pool.id === APPROVED_SCOPE.workloadIdentityPoolId && pool.state !== "ACTIVE") {
      blockers.push("APPROVED_WORKLOAD_IDENTITY_POOL_NOT_ACTIVE");
    }
  }

  const expectedPoolName =
    `projects/${projectNumber}/locations/global/workloadIdentityPools/`
    + APPROVED_SCOPE.workloadIdentityPoolId;
  const expectedProviderName =
    `${expectedPoolName}/providers/${APPROVED_SCOPE.workloadIdentityProviderId}`;
  const workloadIdentityProviders = asArray(raw.workloadIdentityProviders).map((entry) => ({
    id: resourceId(entry.name),
    name: entry.name ?? "",
    poolName: entry.observedPoolName ?? String(entry.name ?? "").split("/providers/")[0],
    state: entry.state ?? "",
    disabled: entry.disabled === true,
    attributeMapping: entry.attributeMapping ?? {},
    attributeCondition: entry.attributeCondition ?? "",
    issuer: entry.oidc?.issuerUri ?? "",
    allowedAudiences: asArray(entry.oidc?.allowedAudiences).map(String),
  }));
  if (
    (!destructionTransition && workloadIdentityProviders.length !== 1)
    || (destructionTransition && workloadIdentityProviders.length > 1)
    || (
      destructionTransition
      && workloadIdentityPools.length === 0
      && workloadIdentityProviders.length > 0
    )
  ) {
    blockers.push("EXACT_APPROVED_WORKLOAD_IDENTITY_PROVIDER_REQUIRED");
  }
  for (const provider of workloadIdentityProviders) {
    if (
      provider.name !== expectedProviderName
      || provider.poolName !== expectedPoolName
      || provider.id !== APPROVED_SCOPE.workloadIdentityProviderId
    ) blockers.push(`UNAPPROVED_WORKLOAD_IDENTITY_PROVIDER_${provider.id}`);
    if (provider.name !== expectedProviderName) continue;
    if (provider.state !== "ACTIVE") {
      blockers.push("APPROVED_WORKLOAD_IDENTITY_PROVIDER_NOT_ACTIVE");
    }
    if (
      JSON.stringify(stableValue(provider.attributeMapping))
        !== JSON.stringify(stableValue(APPROVED_TRUST.attributeMapping))
      || provider.attributeCondition !== APPROVED_TRUST.attributeCondition
      || provider.issuer !== APPROVED_TRUST.issuer
      || JSON.stringify([...provider.allowedAudiences].sort())
        !== JSON.stringify([APPROVED_TRUST.audience])
    ) blockers.push("WORKLOAD_IDENTITY_PROVIDER_TRUST_MISMATCH");
  }

  const previewServiceAccount = raw.previewServiceAccount === null
    ? null
    : {
        name: raw.previewServiceAccount?.name ?? "",
        email: raw.previewServiceAccount?.email ?? "",
        disabled: raw.previewServiceAccount?.disabled === true,
      };
  if (
    (
      !destructionTransition
      && previewServiceAccount === null
    )
    || (
      previewServiceAccount !== null
      && (
        previewServiceAccount.email !== APPROVED_SCOPE.previewServiceAccount
        || previewServiceAccount.disabled
      )
    )
  ) blockers.push("PREVIEW_SERVICE_ACCOUNT_IDENTITY_MISMATCH");
  const previewServiceAccountKeys = asArray(raw.previewServiceAccountKeys).map((entry) => ({
    name: entry.name ?? "",
    keyType: entry.keyType ?? "USER_MANAGED",
  }));
  if (
    raw.previewServiceAccountKeysReadbackPerformed !== true
    || previewServiceAccountKeys.length > 0
  ) {
    blockers.push("PREVIEW_SERVICE_ACCOUNT_USER_MANAGED_KEY_FORBIDDEN");
  }
  const previewServiceAccountIamBindings = normalizeIamBindings(
    raw.previewServiceAccountIamPolicy,
  );
  const exactSubjectPrincipal = exactPreviewSubjectPrincipal();
  const workloadIdentityUserMembers = previewServiceAccountIamBindings
    .filter((binding) => binding.role === "roles/iam.workloadIdentityUser")
    .flatMap((binding) => binding.members);
  if (
    workloadIdentityUserMembers.some((member) => member !== exactSubjectPrincipal)
  ) blockers.push("PREVIEW_IMPERSONATION_MUST_BIND_EXACT_SUBJECT_ONLY");
  const exactSubjectImpersonationPresent = hasUnconditionalMember(
    previewServiceAccountIamBindings,
    "roles/iam.workloadIdentityUser",
    exactSubjectPrincipal,
  );
  const exactPreviewServiceAccountPolicy = (
    previewServiceAccountIamBindings.length === 1
    && previewServiceAccountIamBindings[0]?.role
      === "roles/iam.workloadIdentityUser"
    && previewServiceAccountIamBindings[0]?.condition === null
    && previewServiceAccountIamBindings[0]?.members.length === 1
    && previewServiceAccountIamBindings[0]?.members[0]
      === exactSubjectPrincipal
  );
  if (
    previewServiceAccount === null
      ? previewServiceAccountIamBindings.length !== 0
      : !exactPreviewServiceAccountPolicy
  ) blockers.push("PREVIEW_SERVICE_ACCOUNT_EXACT_RESOURCE_POLICY_REQUIRED");

  const runIamBindings = asArray(raw.runIamPolicies).map((entry) => {
    const serviceId = resourceId(entry.serviceName);
    const bindings = normalizeIamBindings(entry.policy);
    const invokerBindings = bindings.filter((binding) => (
      binding.role === "roles/run.invoker"
    ));
    const invokerMembers = invokerBindings
      .flatMap((binding) => binding.members);
    return {
      serviceId,
      serviceName: entry.serviceName ?? "",
      previewInvokerPresent: hasUnconditionalMember(
        bindings,
        "roles/run.invoker",
        previewMember,
      ),
      previewInvokerAnyPresent: invokerMembers.includes(previewMember),
      publicInvokerPresent: invokerMembers.includes("allUsers"),
      conditionalInvokerPresent: invokerBindings.some(
        (binding) => binding.condition !== null,
      ),
      bindings,
      invokerBindingCount: invokerBindings.length,
      invokerMembers,
    };
  });
  const observedRunPolicyTargets = runIamBindings.map(
    (binding) => binding.serviceId.toLowerCase(),
  );
  const exactRunPolicyTargetSet = (
    runIamBindings.length === APPROVED_RUN_SERVICES.size
    && new Set(observedRunPolicyTargets).size === APPROVED_RUN_SERVICES.size
    && [...APPROVED_RUN_SERVICES].every(
      (serviceId) => observedRunPolicyTargets.includes(serviceId),
    )
  );
  const exactDestructionRunPolicyTargetSet = (
    new Set(observedRunPolicyTargets).size === observedRunPolicyTargets.length
    && JSON.stringify([...observedRunPolicyTargets].sort())
      === JSON.stringify([...observedRunServiceNames].sort())
  );
  if (
    (!destructionTransition && !exactRunPolicyTargetSet)
    || (destructionTransition && !exactDestructionRunPolicyTargetSet)
  ) blockers.push("EXACT_CLOUD_RUN_IAM_POLICY_SET_REQUIRED");
  for (
    const expectedServiceId of (
      destructionTransition
        ? observedRunServiceNames
        : APPROVED_RUN_SERVICES
    )
  ) {
    if (!observedRunPolicyTargets.includes(expectedServiceId)) {
      blockers.push(`RUN_POLICY_READBACK_MISSING_${expectedServiceId}`);
    }
  }
  for (const binding of runIamBindings) {
    const serviceId = binding.serviceId.toLowerCase();
    const deletionOnlyInvokerExpected = (
      syntheticDeletionAuthorized
      && serviceId === "deletesyntheticsession"
    );
    const exactConditionalDeletionInvoker = (
      binding.bindings.filter((entry) => (
        entry.role === "roles/run.invoker"
        && entry.members.length === 1
        && entry.members[0] === deployMember
        && exactNormalizedIamCondition(
          entry.condition,
          expectedSyntheticDeletionWindowCondition,
        )
      )).length === 1
    );
    const approvedPrivateInvokerMembers =
      deletionOnlyInvokerExpected
        ? new Set([previewMember, deployMember])
        : new Set([previewMember]);
    if (!APPROVED_RUN_SERVICES.has(serviceId)) {
      blockers.push(`UNAPPROVED_RUN_POLICY_TARGET_${binding.serviceId}`);
    }
    if (
      ALL_PRIVATE_RUN_SERVICES.has(serviceId)
      && binding.publicInvokerPresent
    ) {
      blockers.push(`PRIVATE_FUNCTION_PUBLIC_INVOKER_FORBIDDEN_${binding.serviceId}`);
    }
    if (
      PRIVATE_PREVIEW_INVOKER_RUN_SERVICES.has(serviceId)
      && binding.invokerMembers.some(
        (member) => !approvedPrivateInvokerMembers.has(member),
      )
    ) {
      blockers.push(`PRIVATE_FUNCTION_UNAPPROVED_INVOKER_${binding.serviceId}`);
    }
    if (
      PRIVATE_PREVIEW_INVOKER_RUN_SERVICES.has(serviceId)
      && (
        !binding.previewInvokerPresent
        || (
          deletionOnlyInvokerExpected
            ? (
              !exactConditionalDeletionInvoker
              || binding.invokerBindingCount !== 2
              || binding.invokerMembers.length !== 2
            )
            : (
              binding.conditionalInvokerPresent
              || binding.invokerBindingCount !== 1
              || binding.invokerMembers.length !== 1
            )
        )
      )
    ) blockers.push(`PRIVATE_FUNCTION_EXACT_PREVIEW_INVOKER_REQUIRED_${binding.serviceId}`);
    if (
      !PRIVATE_PREVIEW_INVOKER_RUN_SERVICES.has(serviceId)
      && binding.previewInvokerAnyPresent
    ) blockers.push(`PREVIEW_INVOKER_FORBIDDEN_${binding.serviceId}`);
    if (
      serviceId === "health"
      && (
        binding.invokerBindingCount !== 0
        || binding.invokerMembers.length !== 0
      )
    ) blockers.push("HEALTH_EXACT_PRIVATE_RUN_POLICY_REQUIRED");
    if (
      PUBLIC_BEARER_RUN_SERVICES.has(serviceId)
      && (
        binding.invokerBindingCount !== 1
        || !binding.publicInvokerPresent
        || binding.conditionalInvokerPresent
        || binding.invokerMembers.length !== 1
        || binding.invokerMembers[0] !== "allUsers"
      )
    ) blockers.push(`PUBLIC_BEARER_EXACT_RUN_INVOKER_REQUIRED_${binding.serviceId}`);
    const expectedFullPolicy = serviceId === "health"
      ? []
      : [
        {
          role: "roles/run.invoker",
          members: [
            PRIVATE_PREVIEW_INVOKER_RUN_SERVICES.has(serviceId)
              ? previewMember
              : "allUsers",
          ],
          condition: null,
        },
        ...(deletionOnlyInvokerExpected
          ? [{
              role: "roles/run.invoker",
              members: [deployMember],
              condition: {
                description:
                  expectedSyntheticDeletionWindowCondition?.description
                    ?? "",
                expression:
                  expectedSyntheticDeletionWindowCondition?.expression
                    ?? "",
                title:
                  expectedSyntheticDeletionWindowCondition?.title ?? "",
              },
            }]
          : []),
      ];
    if (
      JSON.stringify(stableValue(binding.bindings))
        !== JSON.stringify(stableValue(expectedFullPolicy))
    ) blockers.push(`CLOUD_RUN_EXACT_FULL_IAM_POLICY_REQUIRED_${binding.serviceId}`);
  }
  const expectedTrustDisabled = (
    functionRuntimeConfigurationPhase === "DISABLED_FIRST_DEPLOY"
    || destructionTransition
  );
  const expectedTrustEnabled = (
    functionRuntimeConfigurationPhase
      === "PROTECTED_PREVIEW_CONFIGURED_ISSUANCE_DISABLED"
    || functionRuntimeConfigurationPhase === "PROTECTED_PREVIEW_ACTIVE"
  );
  const safeBackendTrustStateConformant = (
    (
      safeBackendForDestruction
      || syntheticDeletionAuthorized
      || syntheticDeletionRevokedReadback
    )
    && workloadIdentityPools.length === 1
    && workloadIdentityProviders.length === 1
    && !(
      workloadIdentityPools[0].disabled === true
      && workloadIdentityProviders[0].disabled !== true
    )
  );
  const phaseAwareTrustStateConformant = (
    safeBackendTrustStateConformant
    ||
    (
      destructionTransition
      && workloadIdentityPools.length <= 1
      && workloadIdentityProviders.length <= 1
      && workloadIdentityPools.every((pool) => pool.disabled === true)
      && workloadIdentityProviders.every((provider) => provider.disabled === true)
      && !(
        workloadIdentityPools.length === 0
        && workloadIdentityProviders.length > 0
      )
    )
    ||
    (
      !destructionTransition
      &&
      expectedTrustDisabled
      && workloadIdentityPools.length === 1
      && workloadIdentityProviders.length === 1
      && workloadIdentityPools[0].disabled === true
      && workloadIdentityProviders[0].disabled === true
    )
    || (
      !destructionTransition
      &&
      expectedTrustEnabled
      && workloadIdentityPools.length === 1
      && workloadIdentityProviders.length === 1
      && workloadIdentityPools[0].disabled === false
      && workloadIdentityProviders[0].disabled === false
    )
  );
  if (!phaseAwareTrustStateConformant) {
    blockers.push("WORKLOAD_IDENTITY_TRUST_STATE_MISMATCH_FOR_RUNTIME_PHASE");
  }
  const activeTrustConfigurationComplete =
    workloadIdentityPools.some((pool) => pool.name === expectedPoolName)
    && workloadIdentityProviders.some((provider) => provider.name === expectedProviderName)
    && previewServiceAccount?.email === APPROVED_SCOPE.previewServiceAccount
    && exactSubjectImpersonationPresent
    && exactPreviewServiceAccountPolicy
    && previewProjectRoles.length === 0
    && federatedProjectBindings.length === 0
    && phaseAwareTrustStateConformant
    && [...PRIVATE_PREVIEW_INVOKER_RUN_SERVICES].every((serviceId) =>
      runIamBindings.some(
        (binding) => {
          if (
            binding.serviceId.toLowerCase() !== serviceId
            || !binding.previewInvokerPresent
            || binding.publicInvokerPresent
          ) return false;
          if (
            syntheticDeletionAuthorized
            && serviceId === "deletesyntheticsession"
          ) {
            return (
              binding.conditionalInvokerPresent
              && binding.invokerBindingCount === 2
              && binding.invokerMembers.length === 2
              && binding.invokerMembers.includes(deployMember)
            );
          }
          return (
            !binding.conditionalInvokerPresent
            && binding.invokerBindingCount === 1
            && binding.invokerMembers.length === 1
          );
        },
      ))
    && runIamBindings.some(
      (binding) =>
        binding.serviceId.toLowerCase() === "health"
        && !binding.previewInvokerAnyPresent
        && !binding.publicInvokerPresent
        && binding.invokerBindingCount === 0,
    )
    && [...PUBLIC_BEARER_RUN_SERVICES].every((serviceId) =>
      runIamBindings.some(
        (binding) =>
          binding.serviceId.toLowerCase() === serviceId
          && binding.invokerBindingCount === 1
          && binding.publicInvokerPresent
          && !binding.conditionalInvokerPresent
          && binding.invokerMembers.length === 1,
      ));
  const destructionTrustConfigurationComplete = (
    destructionTransition
    && phaseAwareTrustStateConformant
    && previewProjectRoles.length === 0
    && federatedProjectBindings.length === 0
    && (
      previewServiceAccount === null
        ? previewServiceAccountIamBindings.length === 0
        : exactPreviewServiceAccountPolicy
    )
    && exactDestructionRunPolicyTargetSet
    && runIamBindings.every((binding) => !blockers.includes(
      `CLOUD_RUN_EXACT_FULL_IAM_POLICY_REQUIRED_${binding.serviceId}`,
    ))
  );
  const trustConfigurationComplete = destructionTransition
    ? destructionTrustConfigurationComplete
    : activeTrustConfigurationComplete;
  if (!trustConfigurationComplete) {
    blockers.push("PREVIEW_TRUST_CONFIGURATION_INCOMPLETE");
  }

  const buckets = asArray(raw.buckets).map((entry) => {
    const name = normalizeBucketName(entry.name ?? entry.url);
    return {
      name,
      location: entry.location ?? "",
      classification: classifyBucket(name, projectNumber),
    };
  });
  const supportingBuildBuckets = buckets.filter(
    (entry) => entry.classification === "FUNCTIONS_BUILD_SUPPORTING_ARTIFACT",
  );
  const forbiddenAppBuckets = buckets.filter(
    (entry) => entry.classification === "APP_CLOUD_STORAGE_FORBIDDEN",
  );
  const unclassifiedBuckets = buckets.filter(
    (entry) => entry.classification === "UNCLASSIFIED_BUCKET_BLOCKING",
  );
  if (forbiddenAppBuckets.length > 0) blockers.push("APP_CLOUD_STORAGE_MUST_REMAIN_OFF");
  if (unclassifiedBuckets.length > 0) blockers.push("UNCLASSIFIED_BUCKET_REQUIRES_REVIEW");

  const artifactRepositories = asArray(raw.artifactRepositories).map((entry) => ({
    name: resourceId(entry.name),
    location: locationFromName(entry.name) || entry.location || "",
    format: entry.format ?? "",
    classification:
      resourceId(entry.name) === "gcf-artifacts"
      && (locationFromName(entry.name) || entry.location) === APPROVED_SCOPE.region
        ? "FUNCTIONS_BUILD_SUPPORTING_ARTIFACT"
        : "UNCLASSIFIED_ARTIFACT_REPOSITORY_BLOCKING",
  }));
  for (const repository of artifactRepositories) {
    if (repository.classification.endsWith("_BLOCKING")) {
      blockers.push(`UNCLASSIFIED_ARTIFACT_REPOSITORY_${repository.name}`);
    }
  }
  if (
    (!destructionTransition && artifactRepositories.length !== 1)
    || (destructionTransition && artifactRepositories.length > 1)
  ) blockers.push("EXACT_FUNCTION_ARTIFACT_REPOSITORY_SET_REQUIRED");

  const enabledServices = asArray(raw.services)
    .map((entry) => entry.config?.name ?? entry.serviceName ?? entry.name ?? "")
    .filter(Boolean);
  const uniqueEnabledServices = new Set(enabledServices);
  if (uniqueEnabledServices.size !== enabledServices.length) {
    blockers.push("DUPLICATE_ENABLED_SERVICE_READBACK");
  }
  const missingRequiredServices = [...REQUIRED_ENABLED_SERVICES].filter(
    (name) => !uniqueEnabledServices.has(name),
  );
  const unapprovedEnabledServices = [...uniqueEnabledServices].filter(
    (name) => !REQUIRED_ENABLED_SERVICES.has(name),
  );
  if (missingRequiredServices.length > 0) {
    blockers.push("REQUIRED_ENABLED_SERVICE_SET_INCOMPLETE");
  }
  if (unapprovedEnabledServices.length > 0) {
    blockers.push("UNAPPROVED_ENABLED_SERVICE_PRESENT");
  }
  const forbiddenServices = enabledServices.filter((name) => FORBIDDEN_SERVICES.has(name));
  if (forbiddenServices.length > 0) blockers.push("FORBIDDEN_RUNTIME_SERVICE_ENABLED");

  const normalizedBudgets = asArray(raw.budgets).map(
    (entry) => normalizeBudget(entry, projectNumber),
  );
  const projectBudgets = normalizedBudgets.filter(
    (entry) => entry.projectScoped,
  );
  const mixedProjectBudgets = normalizedBudgets.filter(
    (entry) => entry.includesApprovedProject && !entry.projectScoped,
  );
  const ignoredUnrelatedBudgetCount =
    normalizedBudgets.length - projectBudgets.length - mixedProjectBudgets.length;
  if (
    (!destructionTransition && projectBudgets.length !== 1)
    || (destructionTransition && projectBudgets.length > 1)
  ) blockers.push("EXACTLY_ONE_PROJECT_SCOPED_BUDGET_REQUIRED");
  if (mixedProjectBudgets.length > 0) {
    blockers.push("MIXED_PROJECT_SCOPE_BUDGET_REQUIRES_REVIEW");
  }
  if (projectBudgets.some((entry) => !entry.exactApprovedBudget)) {
    blockers.push("PROJECT_BUDGET_POLICY_MISMATCH");
  }

  const hostingSites = asArray(raw.hostingSites).map((entry) => ({
    name: entry.name ?? "",
    siteId: entry.site ?? entry.siteId ?? resourceId(entry.name),
    classification: "PROVIDER_CREATED_EMPTY_SUPPORTING_RESOURCE",
  }));
  const exactDefaultHostingSiteName =
    `projects/${APPROVED_SCOPE.projectId}/sites/${APPROVED_SCOPE.projectId}`;
  if (
    (
      !destructionTransition
      && hostingSites.length !== 1
    )
    || (
      destructionTransition
      && hostingSites.length > 1
    )
    || hostingSites.some(
      (site) =>
        site.name !== exactDefaultHostingSiteName
        || site.siteId !== APPROVED_SCOPE.projectId,
    )
  ) blockers.push("EXACT_DEFAULT_FIREBASE_HOSTING_SITE_REQUIRED");
  const hostingReleases = asArray(raw.hostingReleases);
  const hostingVersions = asArray(raw.hostingVersions);
  const hostingChannels = asArray(raw.hostingChannels);
  if (
    raw.hostingContentReadbackPerformed !== true
    || hostingReleases.length > 0
    || hostingVersions.length > 0
    || hostingChannels.length > 0
  ) blockers.push("FIREBASE_HOSTING_CONTENT_OR_CHANNEL_FORBIDDEN");
  const hostingContentInventory = {
    defaultSiteName: exactDefaultHostingSiteName,
    releaseCount: hostingReleases.length,
    versionCount: hostingVersions.length,
    channelCount: hostingChannels.length,
    empty: (
      hostingReleases.length === 0
      && hostingVersions.length === 0
      && hostingChannels.length === 0
    ),
  };

  const reportWithoutDigest = {
    schemaVersion: "wp13.12b-ea-operator-resource-inventory-v2",
    mode: "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION",
    externalWrites: 0,
    approvalBinding: APPROVED_SCOPE,
    source: raw.source,
    project: {
      projectId,
      projectNumber,
      lifecycleState,
      organizationId: APPROVED_SCOPE.organizationId,
      billingAccount,
      billingEnabled: raw.billing?.billingEnabled === true,
    },
    resources: {
      budgets: projectBudgets,
      budgetScopeSummary: {
        exactProjectBudgetCount: projectBudgets.length,
        mixedProjectScopeBudgetCount: mixedProjectBudgets.length,
        ignoredUnrelatedBudgetCount,
      },
      enabledServices,
      forbiddenServices,
      firestore,
      firestoreDataInventory: {
        rootCollectionIds: firestoreRootCollectionIds,
        collections: firestoreDocuments,
        control: firestoreControl,
        nestedCollectionEvidence,
        grantRelationshipEvidence:
          firestoreGrantRelationshipEvidence,
        fieldsPersistedOrPrinted: false,
      },
      functions,
      functionRuntimeConfigurationPhase,
      runServices,
      secrets,
      secretVersions,
      capabilitySecretIamBindings,
      serviceAccounts,
      runtimeKeys,
      deployServiceAccountKeys,
      buildServiceAccountKeys,
      serviceAccountIamBindings: {
        deploy: deployServiceAccountIamBindings,
        runtime: runtimeServiceAccountIamBindings,
        build: buildServiceAccountIamBindings,
      },
      buildIdentityResourceIamBindings: {
        functionArtifactRepository: functionArtifactRepositoryIamBindings,
        functionSourceBucket: functionSourceBucketIamBindings,
      },
      iamBindings,
      projectIamScopeEvidence,
      organizationIamScopeEvidence,
      workloadIdentityFederation: {
        trustBoundary: {
          scope: "VERCEL_TEAM_PROJECT_PREVIEW_ENVIRONMENT",
          deploymentSpecific: false,
          subject: APPROVED_TRUST.subject,
        },
        pools: workloadIdentityPools,
        providers: workloadIdentityProviders,
        previewServiceAccount,
        previewServiceAccountKeys,
        previewServiceAccountIamBindings,
        previewProjectRoles,
        directFederatedProjectBindings: federatedProjectBindings,
        exactSubjectPrincipal,
        exactSubjectImpersonationPresent,
        runIamBindings,
        configurationComplete: trustConfigurationComplete,
      },
      buckets,
      artifactRepositories,
      hostingSites,
      hostingContentInventory,
      vercel,
    },
    inventoryLifecyclePhase: syntheticDeletionAuthorized
      ? "SYNTHETIC_DELETION_AUTHORIZED"
      : syntheticDeletionRevokedReadback
        ? "SYNTHETIC_DELETION_REVOKED_READBACK"
      : safeBackendForDestruction
        ? "SAFE_BACKEND_FOR_DESTRUCTION"
      : destructionTransition
        ? "POST_DEACTIVATION_DESTRUCTION_IN_PROGRESS"
        : "STAGING_CONFIGURED",
    storagePolicy: {
      appCloudStorage: forbiddenAppBuckets.length === 0 ? "OFF" : "FORBIDDEN_BUCKET_OBSERVED",
      storageApiEnabled: enabledServices.includes("storage.googleapis.com"),
      storageApiIsNotAppStorageProof: true,
      supportingBuildBuckets,
      forbiddenAppBuckets,
      unclassifiedBuckets,
    },
    previewInventory: "INCLUDED_AUTHENTICATED_READBACK",
    blockers: [...new Set(blockers)].sort(),
    inventoryPolicyConformant: blockers.length === 0,
    zeroResourceClaimAllowed: false,
  };
  return {
    ...stableValue(reportWithoutDigest),
    inventoryDigest: digestValue(reportWithoutDigest),
  };
}

export function assertExecutionAuthorization(action, token, now = new Date()) {
  if (
    action !== "syntheticDataDeletion"
    && action !== "deactivation"
    && action !== "vercelDestruction"
    && action !== "destruction"
  ) {
    throw operatorError("UNKNOWN_EXECUTION_ACTION");
  }
  if (token !== EXECUTION_AUTHORIZATION[action]) {
    const label = action === "vercelDestruction"
      ? "VERCEL_DESTRUCTION"
      : action.toUpperCase();
    throw operatorError(`EXACT_${label}_EXECUTION_AUTHORIZATION_REQUIRED`);
  }
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) {
    throw operatorError("VALID_SYSTEM_TIME_REQUIRED");
  }
  if (action === "syntheticDataDeletion") return true;
  const expiryStart = new Date(`${APPROVED_SCOPE.stagingExpiryDate}T00:00:00.000Z`);
  if (now < expiryStart) throw operatorError("STAGING_EXPIRY_NOT_REACHED");
  return true;
}

function wifControlCommand(step, action) {
  return {
    step,
    file: process.execPath,
    args: [
      exactChildScriptPaths.wifControl,
      "--action",
      action,
    ],
    cwd: repositoryRootPath,
  };
}

export function validateSafeBackendForDestructionInventory(
  inventory,
  minimumControlEpoch,
) {
  const requiredEpoch = Number(minimumControlEpoch);
  const functions = inventory?.resources?.functions ?? [];
  const control = inventory?.resources?.firestoreDataInventory?.control;
  const collections = inventory?.resources?.firestoreDataInventory?.collections ?? [];
  const identity = inventory?.resources?.workloadIdentityFederation ?? {};
  const pools = identity.pools ?? [];
  const providers = identity.providers ?? [];
  const deployMember = `serviceAccount:${APPROVED_DEPLOY_SERVICE_ACCOUNT}`;
  const deployAccount = (inventory?.resources?.serviceAccounts ?? []).find(
    (account) => account.email === APPROVED_DEPLOY_SERVICE_ACCOUNT,
  );
  const issueFunction = functions.find(
    (fn) => fn.name === "issueSyntheticSession",
  );
  const configuredOrigins = functions.map(
    (fn) => fn.environmentVariables?.LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN,
  );
  const sharedOrigin = configuredOrigins.length === APPROVED_FUNCTIONS.size
    && new Set(configuredOrigins).size === 1
    ? canonicalProtectedPreviewOrigin(configuredOrigins[0])
    : null;
  const activePayloadCollectionsEmpty = [
    "syntheticCapabilityGrants",
    "syntheticSessions",
  ].every((collectionId) => (
    collections.find((collection) => collection.collectionId === collectionId)
      ?.count === 0
  ));
  const providerDisabled = providers[0]?.disabled === true;
  const poolDisabled = pools[0]?.disabled === true;
  const valid = (
    Number.isSafeInteger(requiredEpoch)
    && requiredEpoch >= 2
    && inventory?.schemaVersion
      === "wp13.12b-ea-operator-resource-inventory-v2"
    && inventory?.mode === "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION"
    && inventory?.source === "LIVE_READ_ONLY_PROVIDER_QUERIES"
    && inventory?.externalWrites === 0
    && inventory?.inventoryLifecyclePhase === "SAFE_BACKEND_FOR_DESTRUCTION"
    && inventory?.inventoryPolicyConformant === true
    && Array.isArray(inventory?.blockers)
    && inventory.blockers.length === 0
    && /^[a-f0-9]{64}$/u.test(inventory?.inventoryDigest ?? "")
    && inventory?.project?.projectId === APPROVED_SCOPE.projectId
    && inventory?.project?.projectNumber === APPROVED_SCOPE.projectNumber
    && inventory?.project?.lifecycleState === "ACTIVE"
    && inventory?.resources?.functionRuntimeConfigurationPhase
      === "PROTECTED_PREVIEW_CONFIGURED_ISSUANCE_DISABLED"
    && functions.length === APPROVED_FUNCTIONS.size
    && new Set(functions.map((fn) => fn.name)).size === APPROVED_FUNCTIONS.size
    && [...APPROVED_FUNCTIONS].every(
      (name) => functions.some((fn) => fn.name === name),
    )
    && sharedOrigin !== null
    && issueFunction?.environmentVariables
      ?.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED === "false"
    && control?.stagingEnabled === false
    && control?.reasonCode === "EXPIRY_DESTRUCTION"
    && Number.isSafeInteger(control?.controlEpoch)
    && control.controlEpoch >= requiredEpoch
    && activePayloadCollectionsEmpty
    && deployAccount?.disabled === false
    && Array.isArray(inventory?.resources?.deployServiceAccountKeys)
    && inventory.resources.deployServiceAccountKeys.length === 0
    && Array.isArray(
      inventory?.resources?.serviceAccountIamBindings?.deploy,
    )
    && inventory.resources.serviceAccountIamBindings.deploy.length === 0
    && !(inventory?.resources?.iamBindings ?? []).some(
      (binding) => binding.members?.includes(deployMember),
    )
    && pools.length === 1
    && pools[0]?.id === APPROVED_SCOPE.workloadIdentityPoolId
    && pools[0]?.state === "ACTIVE"
    && providers.length === 1
    && providers[0]?.id === APPROVED_SCOPE.workloadIdentityProviderId
    && providers[0]?.state === "ACTIVE"
    && !(poolDisabled && !providerDisabled)
    && identity.configurationComplete === true
    && exactOrganizationIamScopeAbsence(
      inventory?.resources?.organizationIamScopeEvidence,
    )
    && inventory?.resources?.vercel?.authenticatedReadback === true
    && inventory?.resources?.vercel?.project?.id
      === APPROVED_SCOPE.vercelProjectId
    && inventory?.resources?.vercel?.project?.name
      === APPROVED_SCOPE.vercelProjectName
    && inventory?.resources?.vercel?.projectAbsent === false
    && inventory?.resources?.vercel?.tokenPrinted === false
    && inventory?.resources?.vercel?.oidcTokenPrinted === false
  );
  if (!valid) {
    throw operatorError(
      "FRESH_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY_REQUIRED",
    );
  }
  return {
    controlEpoch: control.controlEpoch,
    inventoryDigest: inventory.inventoryDigest,
    poolDisabled,
    providerDisabled,
    sharedProtectedPreviewOrigin: sharedOrigin,
  };
}

function parseExecutedJson(result, errorCode) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw operatorError(errorCode);
  }
}

function completedStep(result) {
  return {
    step: result.step,
    status: result.status,
  };
}

export function materializeDeactivationPlan(controlEpoch) {
  const numericEpoch = controlEpoch === undefined ? undefined : Number(controlEpoch);
  if (
    numericEpoch !== undefined
    && (!Number.isSafeInteger(numericEpoch) || numericEpoch < 2)
  ) throw operatorError("STRICTLY_ADVANCED_CONTROL_EPOCH_REQUIRED");
  const controlCommand = [
    "node",
    exactChildScriptPaths.setStagingControl,
    "--project",
    APPROVED_SCOPE.projectId,
    "--google-account",
    APPROVED_SCOPE.approvedGoogleAccount,
    "--region",
    APPROVED_SCOPE.region,
    "--enabled",
    "false",
    "--control-epoch",
    numericEpoch === undefined ? "<CURRENT_CONTROL_EPOCH_PLUS_ONE>" : String(numericEpoch),
    "--reason",
    "EXPIRY_DESTRUCTION",
    "--authorized",
    EXECUTION_AUTHORIZATION.deactivation,
  ];
  const commands = [
    {
      step: "DISABLE_STAGING_AND_ADVANCE_CONTROL_EPOCH",
      file: process.execPath,
      args: controlCommand.slice(1),
      cwd: repositoryRootPath,
    },
    {
      step: "RECOLLECT_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY",
      internalAction:
        "COLLECT_LIVE_MULTI_PROVIDER_INVENTORY_WITH_SAFE_BACKEND_PHASE",
    },
    {
      step: "VALIDATE_SYNTHETIC_DATA_DELETION_AND_TOMBSTONE_EVIDENCE",
      internalAction:
        "VALIDATE_EXACT_EVIDENCE_AND_IMMUTABLE_DIGEST_BOUND_CONFIRMATION",
    },
    wifControlCommand(
      "DISABLE_EXACT_WORKLOAD_IDENTITY_PROVIDER",
      "disable-workload-identity-provider",
    ),
    wifControlCommand(
      "DISABLE_EXACT_WORKLOAD_IDENTITY_POOL",
      "disable-workload-identity-pool",
    ),
    wifControlCommand(
      "VERIFY_EXACT_WORKLOAD_IDENTITY_PROVIDER_AND_POOL_DISABLED",
      "verify-disabled",
    ),
  ];
  return {
    schemaVersion: "wp13.12b-ea-deactivation-plan-v3",
    status: "MATERIALIZED_NOT_EXECUTED",
    approvalBinding: APPROVED_SCOPE,
    externalWrites: 0,
    expiryExecutionStatus: "AUTHORIZED_AT_EXPIRY_NOT_SCHEDULED",
    earliestExecutionDate: APPROVED_SCOPE.stagingExpiryDate,
    executeAuthorizationRequired: EXECUTION_AUTHORIZATION.deactivation,
    executionEvidenceRequired: [
      "DIRECT_LIVE_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY",
      "wp13.12b-synthetic-data-deletion-evidence-v1",
      "wp13.12b-synthetic-data-deletion-confirmation-v1",
    ],
    executionEvidenceFlag:
      "--synthetic-data-deletion-evidence <reviewed evidence path>",
    fullSequenceActionIds: [
      "CONTROL_FALSE_EPOCH_STRICTLY_ADVANCED",
      "TIME_BOUNDED_KEYLESS_DEPLOY_IDENTITY_PROVISIONED_AND_VERIFIED",
      "EXACT_PREVIEW_ORIGIN_CONFIGURED_WITH_ISSUANCE_FALSE",
      "SAFE_DISABLED_FUNCTION_SET_DEPLOYED_AND_READ_BACK",
      "TIME_BOUNDED_DEPLOY_IDENTITY_REVOKED_AND_VERIFIED",
      "SYNTHETIC_PAYLOADS_DELETED_AND_TOMBSTONE_RETENTION_EVIDENCE_SECURED",
      "WIF_PROVIDER_DISABLED_THEN_POOL_DISABLED_AND_BOTH_VERIFIED",
      "DEACTIVATION_RECEIPT_MATERIALIZED_AT_OR_AFTER_EXPIRY",
    ],
    orchestrationBoundary:
      "THE_CALLER_COMPLETES_AND_READS_BACK_SAFE_BACKEND_PREREQUISITES; "
      + "EXECUTION_RECOLLECTS_AND_REFUSES_WIF_DISABLE_UNLESS_ALL ARE PROVEN",
    repeatSafety:
      "RECOLLECT_BEFORE_EACH_RESUME_AND_SKIP_ONLY_EXACTLY_VERIFIED_COMPLETED_SUBSTEPS",
    command: controlCommand,
    commands,
    stopConditions: [
      "system date is before 2027-01-25",
      "project or approval binding differs",
      "controlEpoch is not strictly advanced",
      "exact deactivation execution authorization is absent",
      "fresh authenticated SAFE_BACKEND_FOR_DESTRUCTION inventory is absent",
      "issueSyntheticSession issuance is not false at the exact protected origin",
      "deploy identity bindings, policies or user-managed keys remain",
      "synthetic deletion evidence or its immutable confirmation is absent or invalid",
      "the exact WIF provider or pool cannot be disabled and verified",
    ],
  };
}

async function executeDeactivationPlanCore(plan, controlEpoch, {
  assertMutationAuthorityImpl,
  collectReadOnlyInventoryImpl,
  executeCommandImpl,
  syntheticDataDeletionConfirmation,
  syntheticDataDeletionEvidence,
}) {
  if (
    typeof assertMutationAuthorityImpl !== "function"
    || typeof collectReadOnlyInventoryImpl !== "function"
    || typeof executeCommandImpl !== "function"
  ) throw operatorError("DEACTIVATION_CORE_DEPENDENCIES_REQUIRED");
  const epoch = Number(controlEpoch);
  assertMutationAuthorityImpl();
  if (!Number.isSafeInteger(epoch) || epoch < 2) {
    throw operatorError("STRICTLY_ADVANCED_CONTROL_EPOCH_REQUIRED");
  }
  const expectedPlan = materializeDeactivationPlan(epoch);
  if (
    plan?.schemaVersion !== expectedPlan.schemaVersion
    || plan?.status !== "MATERIALIZED_NOT_EXECUTED"
    || plan?.approvalBinding?.projectId !== APPROVED_SCOPE.projectId
    || plan?.approvalBinding?.approvedGoogleAccount
      !== APPROVED_SCOPE.approvedGoogleAccount
    || plan?.approvalBinding?.region !== APPROVED_SCOPE.region
    || plan?.approvalBinding?.stagingExpiryDate
      !== APPROVED_SCOPE.stagingExpiryDate
    || plan?.executeAuthorizationRequired
      !== EXECUTION_AUTHORIZATION.deactivation
    || !exactOrderedStrings(
      plan?.fullSequenceActionIds,
      expectedPlan.fullSequenceActionIds,
    )
    || JSON.stringify(plan?.commands) !== JSON.stringify(expectedPlan.commands)
  ) {
    throw operatorError("DEACTIVATION_PLAN_SCOPE_MISMATCH");
  }
  validateSyntheticDataDeletionEvidence(syntheticDataDeletionEvidence);
  validateSyntheticDataDeletionConfirmation(
    syntheticDataDeletionConfirmation,
    syntheticDataDeletionEvidence,
  );
  const completed = [];
  const preflightInventory = buildInventoryReport(
    await collectReadOnlyInventoryImpl(),
    { inventoryPhase: "SAFE_BACKEND_FOR_DESTRUCTION" },
  );
  if (
    preflightInventory.source !== "LIVE_READ_ONLY_PROVIDER_QUERIES"
    || preflightInventory.project?.projectId !== APPROVED_SCOPE.projectId
    || preflightInventory.project?.projectNumber !== APPROVED_SCOPE.projectNumber
  ) {
    throw operatorError(
      "FRESH_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY_REQUIRED",
    );
  }
  const preflightControl =
    preflightInventory.resources?.firestoreDataInventory?.control;
  const controlAlreadySatisfied = (
    preflightControl?.stagingEnabled === false
    && preflightControl?.reasonCode === "EXPIRY_DESTRUCTION"
    && Number.isSafeInteger(preflightControl?.controlEpoch)
    && preflightControl.controlEpoch >= epoch
  );
  if (controlAlreadySatisfied) {
    completed.push({
      step: "DISABLE_STAGING_AND_ADVANCE_CONTROL_EPOCH",
      status: "SKIPPED_ALREADY_VERIFIED_BY_FRESH_INVENTORY",
    });
  } else {
    if (
      Number.isSafeInteger(preflightControl?.controlEpoch)
      && preflightControl.controlEpoch >= epoch
    ) {
      throw operatorError("STRICTLY_ADVANCED_CONTROL_EPOCH_REQUIRED");
    }
    assertMutationAuthorityImpl();
    const result = executeCommandImpl(plan.commands[0]);
    const confirmation = parseExecutedJson(
      result,
      "DEACTIVATION_PROVIDER_CONFIRMATION_INVALID",
    );
    if (
      confirmation.updated !== true
      || confirmation.project !== APPROVED_SCOPE.projectId
      || confirmation.approvedGoogleAccount
        !== APPROVED_SCOPE.approvedGoogleAccount
      || confirmation.region !== APPROVED_SCOPE.region
      || confirmation.stagingEnabled !== false
      || confirmation.controlEpoch !== epoch
      || confirmation.accessTokenPrinted !== false
      || confirmation.capabilityMaterialPrinted !== false
    ) throw operatorError("DEACTIVATION_PROVIDER_CONFIRMATION_MISMATCH");
    completed.push(completedStep(result));
  }

  const safeBackendInventory = buildInventoryReport(
    await collectReadOnlyInventoryImpl(),
    { inventoryPhase: "SAFE_BACKEND_FOR_DESTRUCTION" },
  );
  const safeBackend = validateSafeBackendForDestructionInventory(
    safeBackendInventory,
    epoch,
  );
  validateSyntheticDataDeletionEvidence(
    syntheticDataDeletionEvidence,
    safeBackendInventory,
  );
  const expectedPoolName = (
    `projects/${APPROVED_SCOPE.projectNumber}/locations/global/`
    + `workloadIdentityPools/${APPROVED_SCOPE.workloadIdentityPoolId}`
  );
  const expectedProviderName =
    `${expectedPoolName}/providers/${APPROVED_SCOPE.workloadIdentityProviderId}`;
  completed.push({
    step: "RECOLLECT_AUTHENTICATED_SAFE_BACKEND_FOR_DESTRUCTION_INVENTORY",
    status: "LIVE_PROVIDER_READBACK_VERIFIED",
  });
  completed.push({
    step: "VALIDATE_SYNTHETIC_DATA_DELETION_AND_TOMBSTONE_EVIDENCE",
    status: "EXACT_EVIDENCE_VERIFIED",
  });

  if (!safeBackend.providerDisabled) {
    assertMutationAuthorityImpl();
    const result = executeCommandImpl(plan.commands[3]);
    const confirmation = parseExecutedJson(
      result,
      "DEACTIVATION_WIF_CONFIRMATION_INVALID",
    );
    if (
      confirmation.projectId !== APPROVED_SCOPE.projectId
      || confirmation.action !== "disable-workload-identity-provider"
      || confirmation.provider?.name !== expectedProviderName
      || confirmation.provider?.disabled !== true
      || confirmation.accessTokenPrinted !== false
      || confirmation.oidcTokenPrinted !== false
    ) throw operatorError("DEACTIVATION_WIF_CONFIRMATION_MISMATCH");
    completed.push(completedStep(result));
  } else {
    completed.push({
      step: "DISABLE_EXACT_WORKLOAD_IDENTITY_PROVIDER",
      status: "SKIPPED_ALREADY_VERIFIED_BY_FRESH_INVENTORY",
    });
  }
  if (!safeBackend.poolDisabled) {
    assertMutationAuthorityImpl();
    const result = executeCommandImpl(plan.commands[4]);
    const confirmation = parseExecutedJson(
      result,
      "DEACTIVATION_WIF_CONFIRMATION_INVALID",
    );
    if (
      confirmation.projectId !== APPROVED_SCOPE.projectId
      || confirmation.action !== "disable-workload-identity-pool"
      || confirmation.pool?.name !== expectedPoolName
      || confirmation.pool?.disabled !== true
      || confirmation.accessTokenPrinted !== false
      || confirmation.oidcTokenPrinted !== false
    ) throw operatorError("DEACTIVATION_WIF_CONFIRMATION_MISMATCH");
    completed.push(completedStep(result));
  } else {
    completed.push({
      step: "DISABLE_EXACT_WORKLOAD_IDENTITY_POOL",
      status: "SKIPPED_ALREADY_VERIFIED_BY_FRESH_INVENTORY",
    });
  }
  assertMutationAuthorityImpl();
  const verificationResult = executeCommandImpl(plan.commands[5]);
  const verification = parseExecutedJson(
    verificationResult,
    "DEACTIVATION_WIF_VERIFICATION_INVALID",
  );
  if (
    verification.schemaVersion !== "wp13.12b-ea-external-wif-control-v1"
    || verification.projectId !== APPROVED_SCOPE.projectId
    || verification.action !== "verify-disabled"
    || verification.complete !== true
    || verification.state?.provider?.present !== true
    || verification.state.provider.name !== expectedProviderName
    || verification.state.provider.disabled !== true
    || verification.state?.pool?.present !== true
    || verification.state.pool.name !== expectedPoolName
    || verification.state.pool.disabled !== true
    || verification.accessTokenPrinted !== false
    || verification.oidcTokenPrinted !== false
  ) throw operatorError("DEACTIVATION_WIF_VERIFICATION_MISMATCH");
  completed.push(completedStep(verificationResult));

  return {
    schemaVersion: "wp13.12b-ea-deactivation-execution-receipt-v3",
    projectId: APPROVED_SCOPE.projectId,
    approvedGoogleAccount: APPROVED_SCOPE.approvedGoogleAccount,
    region: APPROVED_SCOPE.region,
    stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
    executed: true,
    stagingEnabled: false,
    controlEpoch: safeBackend.controlEpoch,
    safeBackendForDestructionVerified: true,
    safeBackendInventoryDigest: safeBackend.inventoryDigest,
    safeBackendInventorySource: "LIVE_READ_ONLY_PROVIDER_QUERIES",
    sessionIssuanceDisabled: true,
    protectedPreviewOrigin: safeBackend.sharedProtectedPreviewOrigin,
    deployIdentityRevoked: true,
    syntheticDataDeletionVerified: true,
    syntheticDataDeletionEvidenceSha256:
      digestValue(syntheticDataDeletionEvidence),
    syntheticDataDeletionConfirmationSha256:
      digestValue(syntheticDataDeletionConfirmation),
    workloadIdentityProviderDisabled: true,
    workloadIdentityPoolDisabled: true,
    federatedPreviewTrustDisabled: true,
    accessTokenPrinted: false,
    capabilityMaterialPrinted: false,
    completed,
    zeroResourceClaimed: false,
  };
}

export async function executeDeactivationPlanWithTestDoubles(
  plan,
  controlEpoch,
  adapter,
) {
  const state = deactivationInMemoryAdapters.get(adapter);
  if (state === undefined) {
    throw operatorError("MODULE_CREATED_IN_MEMORY_TEST_ADAPTER_REQUIRED");
  }
  const { script, transcript } = state;
  let lastInventoryStep;
  const collectReadOnlyInventoryImpl = async () => {
    transcript.inventoryReadCount += 1;
    if (script.inventories.length > 0) {
      lastInventoryStep = script.inventories.shift();
    } else if (!script.repeatLastInventory) {
      throw operatorError("UNSCRIPTED_IN_MEMORY_INVENTORY_READ_FORBIDDEN");
    }
    return scriptedValue(
      [lastInventoryStep],
      "UNSCRIPTED_IN_MEMORY_INVENTORY_READ_FORBIDDEN",
    );
  };
  const executeCommandImpl = (command) => {
    const scripted = script.commands.shift();
    if (
      scripted === undefined
      || typeof scripted?.step !== "string"
      || scripted.step !== command?.step
      || !exactDeclarativeKeys(
        scripted,
        scripted.errorCode === undefined
          ? ["result", "step"]
          : ["errorCode", "step"],
      )
    ) throw operatorError("UNSCRIPTED_IN_MEMORY_COMMAND_FORBIDDEN");
    transcript.commandSteps.push(command.step);
    if (scripted.errorCode !== undefined) {
      throw operatorError(scripted.errorCode);
    }
    return structuredClone(scripted.result);
  };
  return executeDeactivationPlanCore(plan, controlEpoch, {
    assertMutationAuthorityImpl: () => true,
    collectReadOnlyInventoryImpl,
    executeCommandImpl,
    syntheticDataDeletionConfirmation:
      structuredClone(script.syntheticDataDeletionConfirmation),
    syntheticDataDeletionEvidence:
      structuredClone(script.syntheticDataDeletionEvidence),
  });
}

export async function executeDeactivationPlan({
  controlEpoch,
  executionAuthorization,
} = {}) {
  const now = new Date();
  assertExecutionAuthorization(
    "deactivation",
    executionAuthorization,
    now,
  );
  await assertProductionExternalActionEnvironment();
  const cleanupCapability =
    await acquireCleanupActivationCapability();
  const assertMutationAuthorityImpl = () =>
    assertProductionCleanupAuthority(cleanupCapability);
  assertMutationAuthorityImpl();
  const [syntheticDataDeletionEvidence, syntheticDataDeletionConfirmation] =
    await Promise.all([
      readEvidence(
        EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion,
        "SYNTHETIC_DATA_DELETION_EVIDENCE_FILE_REQUIRED",
        "syntheticDataDeletion",
      ),
      readEvidence(
        EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionConfirmation,
        "SYNTHETIC_DATA_DELETION_CONFIRMATION_FILE_REQUIRED",
        "syntheticDataDeletionConfirmation",
      ),
    ]);
  const plan = materializeDeactivationPlan(controlEpoch);
  const receipt = await executeDeactivationPlanCore(
    plan,
    controlEpoch,
    {
      assertMutationAuthorityImpl,
      collectReadOnlyInventoryImpl: collectReadOnlyInventory,
      executeCommandImpl: executeCommand,
      syntheticDataDeletionConfirmation,
      syntheticDataDeletionEvidence,
    },
  );
  await writeExecutionEvidence("deactivation", receipt);
  return receipt;
}

export function materializeVercelDestructionPlan() {
  return {
    schemaVersion: "wp13.12b-ea-vercel-destruction-plan-v1",
    status: "MATERIALIZED_NOT_EXECUTED",
    approvalBinding: {
      googleProjectId: APPROVED_SCOPE.projectId,
      stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
      teamId: APPROVED_SCOPE.vercelTeamId,
      teamSlug: APPROVED_SCOPE.vercelTeamSlug,
      projectId: APPROVED_SCOPE.vercelProjectId,
      projectName: APPROVED_SCOPE.vercelProjectName,
    },
    externalWrites: 0,
    earliestExecutionDate: APPROVED_SCOPE.stagingExpiryDate,
    executeAuthorizationRequired: EXECUTION_AUTHORIZATION.vercelDestruction,
    exactConfirmationFlags: {
      teamId: "--confirm-vercel-team-id",
      projectId: "--confirm-vercel-project-id",
    },
    evidenceRequiredBeforeExecution: [
      "wp13.12b-ea-deactivation-execution-receipt-v3",
      "wp13.12b-synthetic-data-deletion-evidence-v1",
      "wp13.12b-synthetic-data-deletion-confirmation-v1",
    ],
    deletionEndpoint:
      `/v9/projects/${APPROVED_SCOPE.vercelProjectId}`
      + `?teamId=${APPROVED_SCOPE.vercelTeamId}`,
    authentication:
      "EXISTING_VERCEL_CLI_OS_CREDENTIAL_STORE_TOKEN_USED_IN_MEMORY_ONLY",
    childResourceEvidence:
      "AUTHENTICATED_POST_ABSENCE_PROJECT_SETTINGS_404_AND_EMPTY_"
      + "DEPLOYMENT_DOMAIN_ENVIRONMENT_READBACKS_REQUIRED",
    outputEvidenceSchema: "wp13.12b-preview-destruction-evidence-v2",
    humanConfirmationStillRequired: true,
    immutableConfirmationArtifactRequiredBeforeGoogleDestruction:
      EXECUTION_EVIDENCE_PATHS.previewDestructionConfirmation,
    tokenOutput: false,
    stopConditions: [
      "system date is before 2027-01-25",
      "deactivation receipt does not prove staging and WIF trust disabled",
      "authenticated project readback does not match the exact team/project/name",
      "exact team and project confirmation flags are absent",
      "exact Vercel destruction authorization is absent",
    ],
  };
}

export function isVercelAbsentForGoogleDestruction(inventory) {
  const vercel = inventory?.resources?.vercel;
  return (
    Array.isArray(inventory?.blockers)
    && inventory.blockers.length === 0
    && vercel?.authenticatedReadback === true
    && vercel?.team?.id === APPROVED_SCOPE.vercelTeamId
    && vercel?.team?.slug === APPROVED_SCOPE.vercelTeamSlug
    && vercel?.project === null
    && vercel?.projectAbsent === true
    && Array.isArray(vercel?.deployments)
    && vercel.deployments.length === 0
    && vercel?.deploymentsReadbackAfterProjectAbsence === true
    && vercel?.domainsObservedAfterProjectAbsence === 0
    && vercel?.domainsReadbackAfterProjectAbsence === true
    && vercel?.environmentVariablesObservedAfterProjectAbsence === 0
    && vercel?.environmentVariablesReadbackAfterProjectAbsence === true
    && vercel?.projectSettingsReadbackAfterProjectAbsence === true
    && vercel?.projectSettingsAbsentAfterProjectAbsence === true
    && vercel?.tokenPrinted === false
    && vercel?.oidcTokenPrinted === false
  );
}

export function assertVercelAbsentBeforeGoogleDestruction(
  inventory,
  previewDestructionEvidence,
) {
  if (
    !isVercelAbsentForGoogleDestruction(inventory)
    || previewDestructionEvidence?.teamId !== APPROVED_SCOPE.vercelTeamId
    || previewDestructionEvidence?.teamSlug !== APPROVED_SCOPE.vercelTeamSlug
    || previewDestructionEvidence?.vercelProjectId !== APPROVED_SCOPE.vercelProjectId
    || previewDestructionEvidence?.vercelProjectName !== APPROVED_SCOPE.vercelProjectName
    || previewDestructionEvidence?.authenticatedProviderReadback !== true
    || previewDestructionEvidence?.projectAbsentAfterDeletion !== true
  ) {
    throw operatorError("VERCEL_PROJECT_MUST_BE_ABSENT_BEFORE_GOOGLE_DESTRUCTION");
  }
  return true;
}

export function buildDestructionCommands(inventory) {
  if (
    inventory?.project === null
    && inventory?.zeroResourceClaimAllowed === true
    && inventory?.blockers?.length === 0
    && isVercelAbsentForGoogleDestruction(inventory)
  ) return [];
  if (inventory.project?.projectId !== APPROVED_SCOPE.projectId) {
    throw operatorError("DESTRUCTION_PROJECT_BINDING_MISMATCH");
  }
  if (inventory.blockers?.length > 0) throw operatorError("INVENTORY_BLOCKERS_PREVENT_DESTRUCTION");
  if (!isVercelAbsentForGoogleDestruction(inventory)) return [];
  const projectFlag = `--project=${APPROVED_SCOPE.projectId}`;
  const commands = [];
  const previewIdentity = inventory.resources.workloadIdentityFederation ?? {};
  const functionRetirementOrder = [
    "issueSyntheticSession",
    "sessionCommand",
    "sessionProjection",
    "health",
    "deleteSyntheticSession",
  ];
  const remainingFunctions = [...(inventory.resources.functions ?? [])]
    .sort(
      (left, right) =>
        functionRetirementOrder.indexOf(left.name)
        - functionRetirementOrder.indexOf(right.name),
    );
  for (const fn of remainingFunctions) {
    commands.push({
      step: fn.name === "issueSyntheticSession"
        ? "DELETE_SESSION_ISSUANCE_FUNCTION_FIRST"
        : "DELETE_APPROVED_FUNCTION",
      file: "gcloud",
      args: [
        "functions",
        "delete",
        fn.name,
        `--region=${APPROVED_SCOPE.region}`,
        projectFlag,
        "--quiet",
      ],
    });
  }
  for (const binding of previewIdentity.runIamBindings ?? []) {
    if (
      !binding.previewInvokerPresent
      || !PRIVATE_PREVIEW_INVOKER_RUN_SERVICES.has(binding.serviceId.toLowerCase())
    ) continue;
    commands.push({
      step: "REMOVE_EXACT_PREVIEW_RUN_INVOKER_BINDING",
      file: "gcloud",
      args: [
        "run",
        "services",
        "remove-iam-policy-binding",
        binding.serviceId,
        `--region=${APPROVED_SCOPE.region}`,
        `--member=serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`,
        "--role=roles/run.invoker",
        projectFlag,
        "--quiet",
      ],
    });
  }
  for (const provider of previewIdentity.providers ?? []) {
    if (
      provider.id !== APPROVED_SCOPE.workloadIdentityProviderId
      || provider.poolName
        !== (
          `projects/${APPROVED_SCOPE.projectNumber}`
          + `/locations/global/workloadIdentityPools/${APPROVED_SCOPE.workloadIdentityPoolId}`
        )
    ) continue;
    commands.push({
      step: "DELETE_EXACT_WORKLOAD_IDENTITY_PROVIDER",
      file: "gcloud",
      args: [
        "iam",
        "workload-identity-pools",
        "providers",
        "delete",
        APPROVED_SCOPE.workloadIdentityProviderId,
        `--workload-identity-pool=${APPROVED_SCOPE.workloadIdentityPoolId}`,
        "--location=global",
        projectFlag,
        "--quiet",
      ],
    });
  }
  for (const pool of previewIdentity.pools ?? []) {
    if (pool.id !== APPROVED_SCOPE.workloadIdentityPoolId) continue;
    commands.push({
      step: "DELETE_EXACT_WORKLOAD_IDENTITY_POOL",
      file: "gcloud",
      args: [
        "iam",
        "workload-identity-pools",
        "delete",
        APPROVED_SCOPE.workloadIdentityPoolId,
        "--location=global",
        projectFlag,
        "--quiet",
      ],
    });
  }
  if (
    previewIdentity.previewServiceAccount?.email
      === APPROVED_SCOPE.previewServiceAccount
  ) {
    commands.push({
      step: "DELETE_APPROVED_PREVIEW_SERVICE_ACCOUNT",
      file: "gcloud",
      args: [
        "iam",
        "service-accounts",
        "delete",
        APPROVED_SCOPE.previewServiceAccount,
        projectFlag,
        "--quiet",
      ],
    });
  }
  if (
    (inventory.resources.serviceAccounts ?? []).some(
      (account) => account.email === APPROVED_DEPLOY_SERVICE_ACCOUNT,
    )
  ) {
    commands.push({
      step: "DELETE_APPROVED_DEPLOY_SERVICE_ACCOUNT",
      file: "gcloud",
      args: [
        "iam",
        "service-accounts",
        "delete",
        APPROVED_DEPLOY_SERVICE_ACCOUNT,
        projectFlag,
        "--quiet",
      ],
    });
  }
  for (const version of inventory.resources.secretVersions ?? []) {
    if (version.state === "DESTROYED") continue;
    commands.push({
      step: "DESTROY_APPROVED_SECRET_VERSION",
      file: "gcloud",
      args: [
        "secrets",
        "versions",
        "destroy",
        version.name,
        `--secret=${APPROVED_SCOPE.capabilitySecret}`,
        projectFlag,
        "--quiet",
      ],
    });
  }
  if (
    (inventory.resources.secrets ?? []).some(
      (secret) => secret.name === APPROVED_SCOPE.capabilitySecret,
    )
  ) {
    commands.push({
      step: "DELETE_APPROVED_SECRET",
      file: "gcloud",
      args: [
        "secrets",
        "delete",
        APPROVED_SCOPE.capabilitySecret,
        projectFlag,
        "--quiet",
      ],
    });
  }
  if (
    (inventory.resources.serviceAccounts ?? []).some(
      (account) => account.email === APPROVED_SCOPE.runtimeServiceAccount,
    )
  ) {
    commands.push({
      step: "DELETE_APPROVED_RUNTIME_SERVICE_ACCOUNT",
      file: "gcloud",
      args: [
        "iam",
        "service-accounts",
        "delete",
        APPROVED_SCOPE.runtimeServiceAccount,
        projectFlag,
        "--quiet",
      ],
    });
  }
  if (inventory.resources.firestore !== null) {
    commands.push({
      step: "DELETE_DEFAULT_FIRESTORE_DATABASE",
      file: "gcloud",
      args: [
        "firestore",
        "databases",
        "delete",
        "--database=(default)",
        projectFlag,
        "--quiet",
      ],
    });
  }
  for (const repository of inventory.resources.artifactRepositories ?? []) {
    commands.push({
      step: "DELETE_FUNCTIONS_BUILD_ARTIFACT_REPOSITORY",
      file: "gcloud",
      args: [
        "artifacts",
        "repositories",
        "delete",
        repository.name,
        `--location=${repository.location}`,
        projectFlag,
        "--quiet",
      ],
    });
  }
  if ((inventory.resources.hostingSites ?? []).length > 0) {
    commands.push({
      step: "DISABLE_UNUSED_FIREBASE_HOSTING",
      file: "firebase",
      args: [
        "hosting:disable",
        "--project",
        APPROVED_SCOPE.projectId,
        "--force",
        "--non-interactive",
      ],
    });
  }
  if (inventory.project.billingEnabled === true) {
    commands.push({
      step: "UNLINK_PROJECT_BILLING",
      file: "gcloud",
      args: [
        "billing",
        "projects",
        "unlink",
        APPROVED_SCOPE.projectId,
        "--quiet",
      ],
    });
  }
  for (const budget of inventory.resources.budgets ?? []) {
    const expectedBudgetPrefix =
      `billingAccounts/${APPROVED_SCOPE.billingAccount}/budgets/`;
    if (
      budget.projectScoped !== true
      || budget.exactApprovedBudget !== true
      || !String(budget.name ?? "").startsWith(expectedBudgetPrefix)
      || !/^[A-Za-z0-9-]{8,128}$/u.test(
        String(budget.name ?? "").slice(expectedBudgetPrefix.length),
      )
      || budget.currency !== "NOK"
      || budget.units !== 500
      || budget.nanos !== 0
      || JSON.stringify([...(budget.projects ?? [])].sort())
        !== JSON.stringify([`projects/${APPROVED_SCOPE.projectNumber}`])
      || !Array.isArray(budget.thresholdPercents)
      || budget.thresholdPercents.length !== 2
      || !budget.thresholdPercents.includes(0.8)
      || !budget.thresholdPercents.includes(1)
    ) throw operatorError("DESTRUCTION_BUDGET_BINDING_MISMATCH");
    commands.push({
      step: "DELETE_APPROVED_PROJECT_SCOPED_BUDGET",
      file: "gcloud",
      args: ["billing", "budgets", "delete", budget.name, "--quiet"],
    });
  }
  if (inventory.project.lifecycleState !== "DELETE_REQUESTED") {
    commands.push({
      step: "REQUEST_ISOLATED_PROJECT_DELETION",
      file: "gcloud",
      args: ["projects", "delete", APPROVED_SCOPE.projectId, "--quiet"],
    });
  }
  return commands;
}

export function validatePinnedGoogleDestructionCommand(command) {
  const projectFlag = `--project=${APPROVED_SCOPE.projectId}`;
  const exactArgs = (...expected) =>
    JSON.stringify(command?.args) === JSON.stringify(expected);
  const exactShape = (
    command !== null
    && typeof command === "object"
    && !Array.isArray(command)
    && JSON.stringify(Object.keys(command).sort())
      === JSON.stringify(["args", "file", "step"])
    && command.file === "gcloud"
    && typeof command.step === "string"
    && Array.isArray(command.args)
    && command.args.every(
      (value) =>
        typeof value === "string"
        && value.length > 0
        && value.length <= 1024
        && !/[\0\r\n]/u.test(value),
    )
  );
  if (!exactShape) {
    throw operatorError(
      "EXACT_PINNED_GOOGLE_DESTRUCTION_COMMAND_REQUIRED",
    );
  }
  let valid = false;
  switch (command.step) {
    case "DELETE_SESSION_ISSUANCE_FUNCTION_FIRST":
      valid = exactArgs(
        "functions",
        "delete",
        "issueSyntheticSession",
        `--region=${APPROVED_SCOPE.region}`,
        projectFlag,
        "--quiet",
      );
      break;
    case "DELETE_APPROVED_FUNCTION": {
      const functionName = command.args[2];
      valid = (
        APPROVED_FUNCTIONS.has(functionName)
        && functionName !== "issueSyntheticSession"
        && exactArgs(
          "functions",
          "delete",
          functionName,
          `--region=${APPROVED_SCOPE.region}`,
          projectFlag,
          "--quiet",
        )
      );
      break;
    }
    case "REMOVE_EXACT_PREVIEW_RUN_INVOKER_BINDING": {
      const serviceId = command.args[3];
      valid = (
        PRIVATE_PREVIEW_INVOKER_RUN_SERVICES.has(
          String(serviceId).toLowerCase(),
        )
        && exactArgs(
          "run",
          "services",
          "remove-iam-policy-binding",
          serviceId,
          `--region=${APPROVED_SCOPE.region}`,
          `--member=serviceAccount:${APPROVED_SCOPE.previewServiceAccount}`,
          "--role=roles/run.invoker",
          projectFlag,
          "--quiet",
        )
      );
      break;
    }
    case "DELETE_EXACT_WORKLOAD_IDENTITY_PROVIDER":
      valid = exactArgs(
        "iam",
        "workload-identity-pools",
        "providers",
        "delete",
        APPROVED_SCOPE.workloadIdentityProviderId,
        `--workload-identity-pool=${APPROVED_SCOPE.workloadIdentityPoolId}`,
        "--location=global",
        projectFlag,
        "--quiet",
      );
      break;
    case "DELETE_EXACT_WORKLOAD_IDENTITY_POOL":
      valid = exactArgs(
        "iam",
        "workload-identity-pools",
        "delete",
        APPROVED_SCOPE.workloadIdentityPoolId,
        "--location=global",
        projectFlag,
        "--quiet",
      );
      break;
    case "DELETE_APPROVED_PREVIEW_SERVICE_ACCOUNT":
      valid = exactArgs(
        "iam",
        "service-accounts",
        "delete",
        APPROVED_SCOPE.previewServiceAccount,
        projectFlag,
        "--quiet",
      );
      break;
    case "DELETE_APPROVED_DEPLOY_SERVICE_ACCOUNT":
      valid = exactArgs(
        "iam",
        "service-accounts",
        "delete",
        APPROVED_DEPLOY_SERVICE_ACCOUNT,
        projectFlag,
        "--quiet",
      );
      break;
    case "DESTROY_APPROVED_SECRET_VERSION":
      valid = exactArgs(
        "secrets",
        "versions",
        "destroy",
        "1",
        `--secret=${APPROVED_SCOPE.capabilitySecret}`,
        projectFlag,
        "--quiet",
      );
      break;
    case "DELETE_APPROVED_SECRET":
      valid = exactArgs(
        "secrets",
        "delete",
        APPROVED_SCOPE.capabilitySecret,
        projectFlag,
        "--quiet",
      );
      break;
    case "DELETE_APPROVED_RUNTIME_SERVICE_ACCOUNT":
      valid = exactArgs(
        "iam",
        "service-accounts",
        "delete",
        APPROVED_SCOPE.runtimeServiceAccount,
        projectFlag,
        "--quiet",
      );
      break;
    case "DELETE_DEFAULT_FIRESTORE_DATABASE":
      valid = exactArgs(
        "firestore",
        "databases",
        "delete",
        "--database=(default)",
        projectFlag,
        "--quiet",
      );
      break;
    case "DELETE_FUNCTIONS_BUILD_ARTIFACT_REPOSITORY":
      valid = exactArgs(
        "artifacts",
        "repositories",
        "delete",
        "gcf-artifacts",
        `--location=${APPROVED_SCOPE.region}`,
        projectFlag,
        "--quiet",
      );
      break;
    case "UNLINK_PROJECT_BILLING":
      valid = exactArgs(
        "billing",
        "projects",
        "unlink",
        APPROVED_SCOPE.projectId,
        "--quiet",
      );
      break;
    case "DELETE_APPROVED_PROJECT_SCOPED_BUDGET": {
      const budgetName = command.args[3];
      valid = (
        new RegExp(
          `^billingAccounts/${APPROVED_SCOPE.billingAccount}`
            + "/budgets/[A-Za-z0-9-]{8,128}$",
          "u",
        ).test(String(budgetName))
        && exactArgs(
          "billing",
          "budgets",
          "delete",
          budgetName,
          "--quiet",
        )
      );
      break;
    }
    case "REQUEST_ISOLATED_PROJECT_DELETION":
      valid = exactArgs(
        "projects",
        "delete",
        APPROVED_SCOPE.projectId,
        "--quiet",
      );
      break;
    default:
      valid = false;
  }
  if (!valid) {
    throw operatorError(
      "EXACT_PINNED_GOOGLE_DESTRUCTION_COMMAND_REQUIRED",
    );
  }
  return true;
}

export function materializeDestructionPlan(inventory) {
  const vercelAbsent = isVercelAbsentForGoogleDestruction(inventory);
  const verifiedAlreadyAbsent = (
    inventory?.project === null
    && inventory?.zeroResourceClaimAllowed === true
    && inventory?.blockers?.length === 0
    && vercelAbsent
  );
  const destructionBlockers = [
    ...(inventory.blockers ?? []),
    ...(vercelAbsent ? [] : ["VERCEL_PROJECT_MUST_BE_ABSENT_BEFORE_GOOGLE_DESTRUCTION"]),
  ];
  const commands = verifiedAlreadyAbsent
    ? []
    : destructionBlockers.length === 0
    ? buildDestructionCommands(inventory)
    : [];
  return {
    schemaVersion: "wp13.12b-ea-destruction-materialization-v2",
    status: verifiedAlreadyAbsent
      ? "VERIFIED_ALREADY_DESTROYED_ZERO_COMMAND_NO_OP"
      : "MATERIALIZED_NOT_EXECUTED",
    approvalBinding: APPROVED_SCOPE,
    externalWrites: 0,
    inventoryDigest: inventory.inventoryDigest,
    inventoryBlockers: [...new Set(destructionBlockers)].sort(),
    executeAuthorizationRequired: EXECUTION_AUTHORIZATION.destruction,
    evidenceRequiredBeforeExecution: [
      "wp13.12b-ea-deactivation-execution-receipt-v3",
      "wp13.12b-synthetic-data-deletion-evidence-v1",
      "wp13.12b-synthetic-data-deletion-confirmation-v1",
      "wp13.12b-preview-destruction-evidence-v2",
      "wp13.12b-preview-destruction-confirmation-v1",
    ],
    separateVercelDestruction:
      "RUN_VERCEL_DESTRUCTION_PLAN_WITH_ITS_OWN_EXACT_AUTHORIZATION_AND_CONFIRMATION_FLAGS",
    vercelProjectDeletionIncludedInGoogleCommands: false,
    directBucketDeletion: false,
    supportingBuildBucketDisposition:
      "CASCADE_WITH_EXACT_ISOLATED_PROJECT_DELETE_THEN_VERIFY_ZERO",
    commands,
    verifiedAlreadyAbsent,
    functionRetirementOrdering:
      "SESSION_ISSUANCE_FUNCTION_IS_THE_FIRST_GOOGLE_DESTRUCTION_COMMAND_WHEN_PRESENT",
    repeatSafety:
      "RECOLLECT_FRESH_INVENTORY_AFTER_ANY_INTERRUPTION_AND_MATERIALIZE_ONLY_REMAINING_APPROVED_RESOURCES",
    completionRule:
      "COMMAND_COMPLETION_ONLY_REQUESTS_DESTRUCTION; FRESH ZERO-RESOURCE INVENTORY IS REQUIRED",
  };
}

function assertEvidence(evidence, expectedSchema, predicate, errorCode) {
  if (
    evidence?.schemaVersion !== expectedSchema
    || evidence.projectId !== APPROVED_SCOPE.projectId
    || evidence.stagingExpiryDate !== APPROVED_SCOPE.stagingExpiryDate
    || !predicate(evidence)
  ) throw operatorError(errorCode);
}

export function validateDeactivationEvidence(deactivation) {
  assertEvidence(
    deactivation,
    "wp13.12b-ea-deactivation-execution-receipt-v3",
    (value) =>
      value.executed === true
      && value.stagingEnabled === false
      && Number.isSafeInteger(value.controlEpoch)
      && value.controlEpoch >= 2
      && value.safeBackendForDestructionVerified === true
      && /^[a-f0-9]{64}$/u.test(value.safeBackendInventoryDigest ?? "")
      && value.safeBackendInventorySource
        === "LIVE_READ_ONLY_PROVIDER_QUERIES"
      && value.sessionIssuanceDisabled === true
      && canonicalProtectedPreviewOrigin(value.protectedPreviewOrigin) !== null
      && value.deployIdentityRevoked === true
      && value.syntheticDataDeletionVerified === true
      && /^[a-f0-9]{64}$/u.test(
        value.syntheticDataDeletionEvidenceSha256 ?? "",
      )
      && /^[a-f0-9]{64}$/u.test(
        value.syntheticDataDeletionConfirmationSha256 ?? "",
      )
      && value.workloadIdentityProviderDisabled === true
      && value.workloadIdentityPoolDisabled === true
      && value.federatedPreviewTrustDisabled === true,
    "VALID_DEACTIVATION_EXECUTION_RECEIPT_REQUIRED",
  );
  return true;
}

export function validateSyntheticDataDeletionEvidence(
  syntheticDataDeletion,
  liveInventory,
) {
  const expectedConfirmationText =
    syntheticDataDeletionConfirmationText(syntheticDataDeletion);
  assertEvidence(
    syntheticDataDeletion,
    "wp13.12b-synthetic-data-deletion-evidence-v1",
    (value) =>
      exactOrderedStrings(
        Object.keys(value ?? {}).sort(),
        SYNTHETIC_DELETION_EVIDENCE_KEYS,
      )
      && value.allActiveSyntheticSessionPayloadsDeleted === true
      && value.tombstoneAndRetentionDecisionSecured === true
      && value.humanConfirmed === false
      && value.operatorGoogleAccount
        === APPROVED_SCOPE.approvedGoogleAccount
      && Number.isSafeInteger(value.controlEpoch)
      && value.controlEpoch >= 2
      && value.activeSyntheticSessionCount === 0
      && value.activeCapabilityGrantCount === 0
      && Number.isSafeInteger(value.tombstoneCount)
      && value.tombstoneCount >= 0
      && value.tombstoneRetentionDisposition
        === SYNTHETIC_TOMBSTONE_RETENTION_DISPOSITION
      && typeof value.observedAt === "string"
      && Number.isFinite(Date.parse(value.observedAt))
      && new Date(value.observedAt).toISOString() === value.observedAt
      && /^[a-f0-9]{64}$/u.test(
        value.observedSyntheticDataInventoryDigest ?? "",
      )
      && /^[a-f0-9]{64}$/u.test(
        value.syntheticDataDeletionIntentSha256 ?? "",
      )
      && /^[a-f0-9]{64}$/u.test(
        value.syntheticDataDeletionExecutionReceiptSha256 ?? "",
      )
      && value.humanConfirmationText
        === expectedConfirmationText
      && value.humanConfirmationSha256
        === sha256Text(expectedConfirmationText),
    "VALID_SYNTHETIC_DATA_DELETION_EVIDENCE_REQUIRED",
  );
  assertNoCredentialFields(syntheticDataDeletion);
  assertNoSyntheticIdentifierFieldsOrValues(syntheticDataDeletion);
  if (liveInventory !== undefined) {
    const binding =
      syntheticDataDeletionInventoryBinding(liveInventory);
    if (
      binding.activeSyntheticSessionCount !== 0
      || binding.activeCapabilityGrantCount !== 0
      || syntheticDataDeletion.controlEpoch !== binding.controlEpoch
      || syntheticDataDeletion.activeSyntheticSessionCount
        !== binding.activeSyntheticSessionCount
      || syntheticDataDeletion.activeCapabilityGrantCount
        !== binding.activeCapabilityGrantCount
      || syntheticDataDeletion.tombstoneCount !== binding.tombstoneCount
      || syntheticDataDeletion.observedSyntheticDataInventoryDigest
        !== binding.observedSyntheticDataInventoryDigest
    ) {
      throw operatorError(
        "SYNTHETIC_DATA_DELETION_EVIDENCE_LIVE_INVENTORY_MISMATCH",
      );
    }
  }
  return true;
}

function canonicalConfirmationRecordedAt(recordedAt, observedAt) {
  if (
    typeof recordedAt !== "string"
    || !Number.isFinite(Date.parse(recordedAt))
    || new Date(recordedAt).toISOString() !== recordedAt
    || !Number.isFinite(Date.parse(observedAt))
    || Date.parse(recordedAt) < Date.parse(observedAt)
  ) throw operatorError("CANONICAL_CONFIRMATION_RECORDED_AT_REQUIRED");
  return recordedAt;
}

function exactConfirmationRecordKeys(value) {
  return exactOrderedStrings(
    Object.keys(value ?? {}).sort(),
    [
      "actorIdentityClaimed",
      "confirmationPhrase",
      "confirmationPhraseSha256",
      "evidenceKind",
      "evidencePath",
      "evidenceSha256",
      "immutableRecord",
      "projectId",
      "recordedAt",
      "recorderClassification",
      "schemaVersion",
      "signatureClaimed",
      "stagingExpiryDate",
    ],
  );
}

export function materializeSyntheticDataDeletionConfirmation(
  syntheticDataDeletion,
  confirmationPhrase,
  recordedAt,
) {
  validateSyntheticDataDeletionEvidence(syntheticDataDeletion);
  const expectedPhrase =
    syntheticDataDeletionConfirmationText(syntheticDataDeletion);
  if (confirmationPhrase !== expectedPhrase) {
    throw operatorError(
      "EXACT_SYNTHETIC_DATA_DELETION_CONFIRMATION_PHRASE_REQUIRED",
    );
  }
  return {
    schemaVersion:
      "wp13.12b-synthetic-data-deletion-confirmation-v1",
    projectId: APPROVED_SCOPE.projectId,
    stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
    evidenceKind: "SYNTHETIC_DATA_DELETION",
    evidencePath: EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion,
    evidenceSha256: digestValue(syntheticDataDeletion),
    confirmationPhrase,
    confirmationPhraseSha256: sha256Text(confirmationPhrase),
    recordedAt: canonicalConfirmationRecordedAt(
      recordedAt,
      syntheticDataDeletion.observedAt,
    ),
    recorderClassification: CONFIRMATION_RECORDER_CLASSIFICATION,
    actorIdentityClaimed: false,
    signatureClaimed: false,
    immutableRecord: true,
  };
}

export function validateSyntheticDataDeletionConfirmation(
  confirmation,
  syntheticDataDeletion,
) {
  const expected = materializeSyntheticDataDeletionConfirmation(
    syntheticDataDeletion,
    confirmation?.confirmationPhrase,
    confirmation?.recordedAt,
  );
  if (
    !exactConfirmationRecordKeys(confirmation)
    || digestValue(confirmation) !== digestValue(expected)
  ) throw operatorError("VALID_SYNTHETIC_DATA_DELETION_CONFIRMATION_REQUIRED");
  return true;
}

export function validateDestructionEvidence({
  deactivation,
  syntheticDataDeletion,
  syntheticDataDeletionConfirmation,
  previewDestruction,
  previewDestructionConfirmation,
}) {
  validateDeactivationEvidence(deactivation);
  validateSyntheticDataDeletionEvidence(syntheticDataDeletion);
  validateSyntheticDataDeletionConfirmation(
    syntheticDataDeletionConfirmation,
    syntheticDataDeletion,
  );
  if (
    deactivation.syntheticDataDeletionEvidenceSha256
      !== digestValue(syntheticDataDeletion)
  ) throw operatorError("DEACTIVATION_SYNTHETIC_EVIDENCE_BINDING_MISMATCH");
  if (
    deactivation.controlEpoch !== syntheticDataDeletion.controlEpoch
  ) throw operatorError("DEACTIVATION_SYNTHETIC_EVIDENCE_EPOCH_MISMATCH");
  if (
    deactivation.syntheticDataDeletionConfirmationSha256
      !== digestValue(syntheticDataDeletionConfirmation)
  ) {
    throw operatorError(
      "DEACTIVATION_SYNTHETIC_CONFIRMATION_BINDING_MISMATCH",
    );
  }
  validatePreviewDestructionEvidence(
    previewDestruction,
    deactivation,
    syntheticDataDeletion,
    syntheticDataDeletionConfirmation,
  );
  validatePreviewDestructionConfirmation(
    previewDestructionConfirmation,
    previewDestruction,
  );
  return true;
}

function canonicalPreviewAbsenceBinding(value) {
  return {
    schemaVersion: value?.schemaVersion,
    projectId: value?.projectId,
    stagingExpiryDate: value?.stagingExpiryDate,
    provider: value?.provider,
    teamId: value?.teamId,
    teamSlug: value?.teamSlug,
    vercelProjectId: value?.vercelProjectId,
    vercelProjectName: value?.vercelProjectName,
    previewStatus: value?.previewStatus,
    authenticatedProviderReadback: value?.authenticatedProviderReadback,
    projectAbsentAfterDeletion: value?.projectAbsentAfterDeletion,
    deploymentsObservedBeforeDeletion:
      value?.deploymentsObservedBeforeDeletion,
    deploymentsObservedAfterProjectAbsence:
      value?.deploymentsObservedAfterProjectAbsence,
    deploymentsAfterProjectAbsenceReadbackAuthenticated:
      value?.deploymentsAfterProjectAbsenceReadbackAuthenticated,
    domainsObservedAfterProjectAbsence:
      value?.domainsObservedAfterProjectAbsence,
    domainsAfterProjectAbsenceReadbackAuthenticated:
      value?.domainsAfterProjectAbsenceReadbackAuthenticated,
    environmentVariablesObservedAfterProjectAbsence:
      value?.environmentVariablesObservedAfterProjectAbsence,
    environmentVariablesAfterProjectAbsenceReadbackAuthenticated:
      value?.environmentVariablesAfterProjectAbsenceReadbackAuthenticated,
    projectSettingsAfterProjectAbsenceReadbackAuthenticated:
      value?.projectSettingsAfterProjectAbsenceReadbackAuthenticated,
    projectSettingsAbsentAfterProjectAbsence:
      value?.projectSettingsAbsentAfterProjectAbsence,
    deletionExecuted: value?.deletionExecuted,
    alreadyAbsent: value?.alreadyAbsent,
    recoveryClassification: value?.recoveryClassification,
    observedAt: value?.observedAt,
    safeBackendInventoryDigest: value?.safeBackendInventoryDigest,
    controlEpoch: value?.controlEpoch,
    deactivationReceiptSha256: value?.deactivationReceiptSha256,
    syntheticDataDeletionEvidenceSha256:
      value?.syntheticDataDeletionEvidenceSha256,
    syntheticDataDeletionConfirmationSha256:
      value?.syntheticDataDeletionConfirmationSha256,
    tokenPrinted: value?.tokenPrinted,
    oidcTokenPrinted: value?.oidcTokenPrinted,
  };
}

export function vercelDestructionConfirmationText(value) {
  return (
    "CONFIRM_WP13_12B_VERCEL_PROJECT_ABSENCE;"
    + `teamId=${value?.teamId};`
    + `vercelProjectId=${value?.vercelProjectId};`
    + `vercelProjectName=${value?.vercelProjectName};`
    + `observedAt=${value?.observedAt};`
    + `canonicalAbsenceEvidenceDigest=${value?.canonicalAbsenceEvidenceDigest};`
    + `deactivationReceiptSha256=${value?.deactivationReceiptSha256};`
    + "syntheticDataDeletionEvidenceSha256="
    + `${value?.syntheticDataDeletionEvidenceSha256};`
    + "syntheticDataDeletionConfirmationSha256="
    + `${value?.syntheticDataDeletionConfirmationSha256}`
  );
}

export function validatePreviewDestructionEvidence(
  previewDestruction,
  deactivation,
  syntheticDataDeletion,
  syntheticDataDeletionConfirmation,
) {
  const canonicalDigest = digestValue(
    canonicalPreviewAbsenceBinding(previewDestruction),
  );
  const expectedConfirmationText =
    vercelDestructionConfirmationText(previewDestruction);
  assertEvidence(
    previewDestruction,
    "wp13.12b-preview-destruction-evidence-v2",
    (value) =>
      value.previewStatus === "VERIFIED_DESTROYED"
      && value.provider === "VERCEL"
      && value.teamId === APPROVED_SCOPE.vercelTeamId
      && value.teamSlug === APPROVED_SCOPE.vercelTeamSlug
      && value.vercelProjectId === APPROVED_SCOPE.vercelProjectId
      && value.vercelProjectName === APPROVED_SCOPE.vercelProjectName
      && value.authenticatedProviderReadback === true
      && value.projectAbsentAfterDeletion === true
      && value.deploymentsObservedAfterProjectAbsence === 0
      && value.deploymentsAfterProjectAbsenceReadbackAuthenticated === true
      && value.domainsObservedAfterProjectAbsence === 0
      && value.domainsAfterProjectAbsenceReadbackAuthenticated === true
      && value.environmentVariablesObservedAfterProjectAbsence === 0
      && value
        .environmentVariablesAfterProjectAbsenceReadbackAuthenticated
        === true
      && value.projectSettingsAfterProjectAbsenceReadbackAuthenticated
        === true
      && value.projectSettingsAbsentAfterProjectAbsence === true
      && (
        (
          value.deletionExecuted === true
          && value.alreadyAbsent === false
          && value.recoveryClassification
            === "EXACT_PROJECT_DELETION_EXECUTED_AND_VERIFIED"
        )
        || (
          value.deletionExecuted === false
          && value.alreadyAbsent === true
          && value.recoveryClassification
            === "AUTHENTICATED_ALREADY_ABSENT_RETRY"
        )
      )
      && value.tokenPrinted === false
      && value.oidcTokenPrinted === false
      && typeof value.observedAt === "string"
      && Number.isFinite(Date.parse(value.observedAt))
      && new Date(value.observedAt).toISOString() === value.observedAt
      && /^[a-f0-9]{64}$/u.test(value.safeBackendInventoryDigest ?? "")
      && Number.isSafeInteger(value.controlEpoch)
      && value.controlEpoch >= 2
      && value.canonicalAbsenceEvidenceDigest === canonicalDigest
      && value.humanConfirmationText === expectedConfirmationText
      && value.humanConfirmationSha256
        === sha256Text(expectedConfirmationText)
      && value.humanConfirmed === false,
    "VALID_PREVIEW_DESTRUCTION_EVIDENCE_REQUIRED",
  );
  if (
    deactivation !== undefined
    && (
      previewDestruction.deactivationReceiptSha256
        !== digestValue(deactivation)
      || previewDestruction.controlEpoch !== deactivation.controlEpoch
    )
  ) throw operatorError("PREVIEW_DEACTIVATION_EVIDENCE_BINDING_MISMATCH");
  if (
    syntheticDataDeletion !== undefined
    && previewDestruction.syntheticDataDeletionEvidenceSha256
      !== digestValue(syntheticDataDeletion)
  ) {
    throw operatorError(
      "PREVIEW_SYNTHETIC_DATA_DELETION_EVIDENCE_BINDING_MISMATCH",
    );
  }
  if (
    syntheticDataDeletionConfirmation !== undefined
    && previewDestruction.syntheticDataDeletionConfirmationSha256
      !== digestValue(syntheticDataDeletionConfirmation)
  ) {
    throw operatorError(
      "PREVIEW_SYNTHETIC_DATA_DELETION_CONFIRMATION_BINDING_MISMATCH",
    );
  }
  return true;
}

export function materializePreviewDestructionConfirmation(
  previewDestruction,
  confirmationPhrase,
  recordedAt,
) {
  validatePreviewDestructionEvidence(previewDestruction);
  const expectedPhrase =
    vercelDestructionConfirmationText(previewDestruction);
  if (confirmationPhrase !== expectedPhrase) {
    throw operatorError(
      "EXACT_PREVIEW_DESTRUCTION_CONFIRMATION_PHRASE_REQUIRED",
    );
  }
  return {
    schemaVersion: "wp13.12b-preview-destruction-confirmation-v1",
    projectId: APPROVED_SCOPE.projectId,
    stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
    evidenceKind: "VERCEL_PROJECT_ABSENCE",
    evidencePath: EXECUTION_EVIDENCE_PATHS.previewDestruction,
    evidenceSha256: digestValue(previewDestruction),
    confirmationPhrase,
    confirmationPhraseSha256: sha256Text(confirmationPhrase),
    recordedAt: canonicalConfirmationRecordedAt(
      recordedAt,
      previewDestruction.observedAt,
    ),
    recorderClassification: CONFIRMATION_RECORDER_CLASSIFICATION,
    actorIdentityClaimed: false,
    signatureClaimed: false,
    immutableRecord: true,
  };
}

export function validatePreviewDestructionConfirmation(
  confirmation,
  previewDestruction,
) {
  const expected = materializePreviewDestructionConfirmation(
    previewDestruction,
    confirmation?.confirmationPhrase,
    confirmation?.recordedAt,
  );
  if (
    !exactConfirmationRecordKeys(confirmation)
    || digestValue(confirmation) !== digestValue(expected)
  ) throw operatorError("VALID_PREVIEW_DESTRUCTION_CONFIRMATION_REQUIRED");
  return true;
}

export function validateGoogleDestructionPreflightInventory(
  inventory,
  evidence,
) {
  validateDestructionEvidence(evidence);
  const resources = inventory?.resources ?? {};
  const control = resources.firestoreDataInventory?.control;
  const issueFunction = (resources.functions ?? []).find(
    (fn) => fn.name === "issueSyntheticSession",
  );
  const identity = resources.workloadIdentityFederation ?? {};
  const pools = identity.pools ?? [];
  const providers = identity.providers ?? [];
  const vercel = resources.vercel;
  const exactDisabledOrAbsent = (
    entries,
    id,
  ) => (
    entries.length === 0
    || (
      entries.length === 1
      && entries[0]?.id === id
      && entries[0]?.state === "ACTIVE"
      && entries[0]?.disabled === true
    )
  );
  const valid = (
    inventory?.schemaVersion
      === "wp13.12b-ea-operator-resource-inventory-v2"
    && inventory?.mode === "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION"
    && inventory?.source === "LIVE_READ_ONLY_PROVIDER_QUERIES"
    && inventory?.externalWrites === 0
    && inventory?.inventoryLifecyclePhase
      === "POST_DEACTIVATION_DESTRUCTION_IN_PROGRESS"
    && inventory?.inventoryPolicyConformant === true
    && Array.isArray(inventory?.blockers)
    && inventory.blockers.length === 0
    && /^[a-f0-9]{64}$/u.test(inventory?.inventoryDigest ?? "")
    && inventory?.project?.projectId === APPROVED_SCOPE.projectId
    && inventory?.project?.projectNumber === APPROVED_SCOPE.projectNumber
    && control?.stagingEnabled === false
    && control?.reasonCode === "EXPIRY_DESTRUCTION"
    && control?.controlEpoch === evidence.deactivation.controlEpoch
    && control.controlEpoch === evidence.syntheticDataDeletion.controlEpoch
    && (
      issueFunction === undefined
      || issueFunction.environmentVariables
        ?.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED === "false"
    )
    && exactDisabledOrAbsent(
      pools,
      APPROVED_SCOPE.workloadIdentityPoolId,
    )
    && exactDisabledOrAbsent(
      providers,
      APPROVED_SCOPE.workloadIdentityProviderId,
    )
    && vercel?.authenticatedReadback === true
    && vercel?.projectAbsent === true
    && vercel?.project === null
    && vercel?.tokenPrinted === false
    && vercel?.oidcTokenPrinted === false
  );
  if (!valid) {
    throw operatorError(
      "FRESH_LIVE_DESTRUCTION_PHASE_EVIDENCE_PREFLIGHT_REQUIRED",
    );
  }
  validateSyntheticDataDeletionEvidence(
    evidence.syntheticDataDeletion,
    inventory,
  );
  return {
    controlEpoch: control.controlEpoch,
    inventoryDigest: inventory.inventoryDigest,
    syntheticDataDeletionEvidenceSha256:
      digestValue(evidence.syntheticDataDeletion),
    previewDestructionEvidenceSha256:
      digestValue(evidence.previewDestruction),
  };
}

function executeCommand(
  command,
  { googleCloudExecFile } = {},
) {
  if (command?.file === "gcloud") {
    validatePinnedGoogleDestructionCommand(command);
    if (typeof googleCloudExecFile !== "function") {
      throw operatorError(
        "PINNED_GOOGLE_CLOUD_CLI_EXECUTION_ADAPTER_REQUIRED",
      );
    }
    let stdout;
    try {
      stdout = googleCloudExecFile(
        "gcloud",
        command.args,
        {
          cwd: repositoryRootPath,
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
          timeout: 10 * 60 * 1000,
          windowsHide: true,
        },
      );
    } catch {
      throw operatorError(`EXTERNAL_ACTION_FAILED_${command.step}`);
    }
    if (
      typeof stdout !== "string"
      || stdout.length > 1024 * 1024
    ) {
      throw operatorError(`EXTERNAL_ACTION_FAILED_${command.step}`);
    }
    return {
      step: command.step,
      status: "EXECUTED_PROVIDER_CONFIRMED_EXIT_ZERO",
      stdout,
    };
  }
  const allowedNodeScripts = new Set(
    Object.values(exactChildScriptPaths),
  );
  if (
    command?.file !== process.execPath
    || !Array.isArray(command?.args)
    || !allowedNodeScripts.has(command.args[0])
    || command?.cwd !== repositoryRootPath
  ) {
    throw operatorError(
      "PINNED_EXTERNAL_TOOLCHAIN_COMMAND_REQUIRED",
    );
  }
  const scriptStat = lstatSync(command.args[0]);
  const canonicalScript = realpathSync(command.args[0]);
  const canonicalRoot = realpathSync(repositoryRootPath);
  if (
    !scriptStat.isFile()
    || scriptStat.isSymbolicLink()
    || scriptStat.nlink !== 1
    || !sameCanonicalPath(canonicalScript, command.args[0])
    || !sameCanonicalPath(canonicalRoot, repositoryRootPath)
    || !canonicalScript.toLowerCase().startsWith(
      `${canonicalRoot.toLowerCase()}${sep}`,
    )
  ) {
    throw operatorError(
      "CANONICAL_REPOSITORY_CHILD_SCRIPT_REQUIRED",
    );
  }
  const result = spawnSync(command.file, command.args, {
    cwd: command.cwd,
    encoding: "utf8",
    env: commandEnvironment(),
    maxBuffer: 1024 * 1024,
    timeout: 60_000,
    windowsHide: true,
  });
  if (
    result.error
    || result.status !== 0
    || typeof result.stdout !== "string"
    || result.stdout.length > 1024 * 1024
  ) {
    throw operatorError(`EXTERNAL_ACTION_FAILED_${command.step}`);
  }
  return {
    step: command.step,
    status: "EXECUTED_PROVIDER_CONFIRMED_EXIT_ZERO",
    stdout: result.stdout,
  };
}

export function validateVercelDestructionPreflightInventory(
  inventory,
  deactivation,
  syntheticDataDeletion,
  syntheticDataDeletionConfirmation,
) {
  validateDeactivationEvidence(deactivation);
  validateSyntheticDataDeletionEvidence(syntheticDataDeletion);
  validateSyntheticDataDeletionConfirmation(
    syntheticDataDeletionConfirmation,
    syntheticDataDeletion,
  );
  if (
    deactivation.syntheticDataDeletionEvidenceSha256
      !== digestValue(syntheticDataDeletion)
  ) throw operatorError("DEACTIVATION_SYNTHETIC_EVIDENCE_BINDING_MISMATCH");
  if (deactivation.controlEpoch !== syntheticDataDeletion.controlEpoch) {
    throw operatorError("DEACTIVATION_SYNTHETIC_EVIDENCE_EPOCH_MISMATCH");
  }
  if (
    deactivation.syntheticDataDeletionConfirmationSha256
      !== digestValue(syntheticDataDeletionConfirmation)
  ) {
    throw operatorError(
      "DEACTIVATION_SYNTHETIC_CONFIRMATION_BINDING_MISMATCH",
    );
  }
  const phase = inventory?.inventoryLifecyclePhase;
  const resources = inventory?.resources ?? {};
  const control = resources.firestoreDataInventory?.control;
  const functions = resources.functions ?? [];
  const issueFunction = functions.find(
    (fn) => fn.name === "issueSyntheticSession",
  );
  const identity = resources.workloadIdentityFederation ?? {};
  const pools = identity.pools ?? [];
  const providers = identity.providers ?? [];
  const deployMember = `serviceAccount:${APPROVED_DEPLOY_SERVICE_ACCOUNT}`;
  const deployAccount = (resources.serviceAccounts ?? []).find(
    (account) => account.email === APPROVED_DEPLOY_SERVICE_ACCOUNT,
  );
  const vercel = resources.vercel;
  const phaseAndVercelMatch = (
    (
      phase === "SAFE_BACKEND_FOR_DESTRUCTION"
      && vercel?.projectAbsent === false
      && vercel?.project?.id === APPROVED_SCOPE.vercelProjectId
      && vercel?.project?.name === APPROVED_SCOPE.vercelProjectName
    )
    || (
      phase === "POST_DEACTIVATION_DESTRUCTION_IN_PROGRESS"
      && vercel?.projectAbsent === true
      && vercel?.project === null
    )
  );
  const valid = (
    inventory?.schemaVersion
      === "wp13.12b-ea-operator-resource-inventory-v2"
    && inventory?.mode === "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION"
    && inventory?.source === "LIVE_READ_ONLY_PROVIDER_QUERIES"
    && inventory?.externalWrites === 0
    && inventory?.inventoryPolicyConformant === true
    && Array.isArray(inventory?.blockers)
    && inventory.blockers.length === 0
    && /^[a-f0-9]{64}$/u.test(inventory?.inventoryDigest ?? "")
    && inventory?.project?.projectId === APPROVED_SCOPE.projectId
    && inventory?.project?.projectNumber === APPROVED_SCOPE.projectNumber
    && phaseAndVercelMatch
    && control?.stagingEnabled === false
    && control?.reasonCode === "EXPIRY_DESTRUCTION"
    && control?.controlEpoch === deactivation.controlEpoch
    && (
      issueFunction === undefined
      || issueFunction.environmentVariables
        ?.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED === "false"
    )
    && deployAccount?.disabled === false
    && Array.isArray(resources.deployServiceAccountKeys)
    && resources.deployServiceAccountKeys.length === 0
    && Array.isArray(resources.serviceAccountIamBindings?.deploy)
    && resources.serviceAccountIamBindings.deploy.length === 0
    && !(resources.iamBindings ?? []).some(
      (binding) => binding.members?.includes(deployMember),
    )
    && pools.length === 1
    && pools[0]?.id === APPROVED_SCOPE.workloadIdentityPoolId
    && pools[0]?.state === "ACTIVE"
    && pools[0]?.disabled === true
    && providers.length === 1
    && providers[0]?.id === APPROVED_SCOPE.workloadIdentityProviderId
    && providers[0]?.state === "ACTIVE"
    && providers[0]?.disabled === true
    && vercel?.authenticatedReadback === true
    && vercel?.tokenPrinted === false
    && vercel?.oidcTokenPrinted === false
  );
  if (!valid) {
    throw operatorError(
      "FRESH_POST_DEACTIVATION_INVENTORY_REQUIRED_BEFORE_VERCEL_DELETION",
    );
  }
  validateSyntheticDataDeletionEvidence(
    syntheticDataDeletion,
    inventory,
  );
  return {
    controlEpoch: control.controlEpoch,
    inventoryDigest: inventory.inventoryDigest,
    vercelProjectAbsent: vercel.projectAbsent,
  };
}

function vercelDestructionEvidence({
  alreadyAbsent,
  deletionExecuted,
  domainsObservedAfterProjectAbsence,
  deploymentsObservedBeforeDeletion,
  deploymentsObservedAfterProjectAbsence,
  deactivation,
  environmentVariablesObservedAfterProjectAbsence,
  syntheticDataDeletion,
  syntheticDataDeletionConfirmation,
  preflight,
  observedAt,
}) {
  const evidence = {
    schemaVersion: "wp13.12b-preview-destruction-evidence-v2",
    projectId: APPROVED_SCOPE.projectId,
    stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
    provider: "VERCEL",
    teamId: APPROVED_SCOPE.vercelTeamId,
    teamSlug: APPROVED_SCOPE.vercelTeamSlug,
    vercelProjectId: APPROVED_SCOPE.vercelProjectId,
    vercelProjectName: APPROVED_SCOPE.vercelProjectName,
    previewStatus: "VERIFIED_DESTROYED",
    authenticatedProviderReadback: true,
    projectAbsentAfterDeletion: true,
    deploymentsObservedBeforeDeletion,
    deploymentsObservedAfterProjectAbsence,
    deploymentsAfterProjectAbsenceReadbackAuthenticated: true,
    domainsObservedAfterProjectAbsence,
    domainsAfterProjectAbsenceReadbackAuthenticated: true,
    environmentVariablesObservedAfterProjectAbsence,
    environmentVariablesAfterProjectAbsenceReadbackAuthenticated: true,
    projectSettingsAfterProjectAbsenceReadbackAuthenticated: true,
    projectSettingsAbsentAfterProjectAbsence: true,
    deletionExecuted,
    alreadyAbsent,
    recoveryClassification: alreadyAbsent
      ? "AUTHENTICATED_ALREADY_ABSENT_RETRY"
      : "EXACT_PROJECT_DELETION_EXECUTED_AND_VERIFIED",
    observedAt,
    safeBackendInventoryDigest: preflight.inventoryDigest,
    controlEpoch: preflight.controlEpoch,
    deactivationReceiptSha256: digestValue(deactivation),
    syntheticDataDeletionEvidenceSha256:
      digestValue(syntheticDataDeletion),
    syntheticDataDeletionConfirmationSha256:
      digestValue(syntheticDataDeletionConfirmation),
    externalWrites: deletionExecuted ? 1 : 0,
    tokenPrinted: false,
    oidcTokenPrinted: false,
  };
  const canonicalAbsenceEvidenceDigest = digestValue(
    canonicalPreviewAbsenceBinding(evidence),
  );
  const confirmationBoundEvidence = {
    ...evidence,
    canonicalAbsenceEvidenceDigest,
  };
  const humanConfirmationText =
    vercelDestructionConfirmationText(confirmationBoundEvidence);
  return {
    ...confirmationBoundEvidence,
    humanConfirmationText,
    humanConfirmationSha256: sha256Text(humanConfirmationText),
    humanConfirmed: false,
    requiresHumanConfirmationBeforeGoogleDestruction: true,
  };
}

export function reduceVercelDestructionTranscript({
  deactivation,
  deletionRequested,
  domainsAfterProjectAbsence,
  deploymentsAfterProjectAbsence,
  deploymentsBeforeDeletion,
  environmentVariablesAfterProjectAbsence,
  liveInventory,
  observedAt,
  preDeleteProjectAbsent,
  projectAbsentAfterExecution,
  projectSettingsAbsentAfterProjectAbsence,
  syntheticDataDeletion,
  syntheticDataDeletionConfirmation,
}) {
  const preflight = validateVercelDestructionPreflightInventory(
    liveInventory,
    deactivation,
    syntheticDataDeletion,
    syntheticDataDeletionConfirmation,
  );
  if (
    !Array.isArray(deploymentsBeforeDeletion)
    || !Array.isArray(deploymentsAfterProjectAbsence)
    || !Array.isArray(domainsAfterProjectAbsence)
    || !Array.isArray(environmentVariablesAfterProjectAbsence)
    || deploymentsAfterProjectAbsence.length !== 0
    || domainsAfterProjectAbsence.length !== 0
    || environmentVariablesAfterProjectAbsence.length !== 0
    || projectSettingsAbsentAfterProjectAbsence !== true
    || projectAbsentAfterExecution !== true
    || preflight.vercelProjectAbsent !== preDeleteProjectAbsent
    || (
      preDeleteProjectAbsent
        ? deletionRequested !== false
          || deploymentsBeforeDeletion.length !== 0
        : deletionRequested !== true
    )
    || typeof observedAt !== "string"
    || !Number.isFinite(Date.parse(observedAt))
    || new Date(observedAt).toISOString() !== observedAt
  ) throw operatorError("VALID_VERCEL_DESTRUCTION_TRANSCRIPT_REQUIRED");
  return vercelDestructionEvidence({
    alreadyAbsent: preDeleteProjectAbsent,
    deactivation,
    deletionExecuted: deletionRequested,
    domainsObservedAfterProjectAbsence:
      domainsAfterProjectAbsence.length,
    deploymentsObservedAfterProjectAbsence:
      deploymentsAfterProjectAbsence.length,
    deploymentsObservedBeforeDeletion:
      deploymentsBeforeDeletion.length,
    environmentVariablesObservedAfterProjectAbsence:
      environmentVariablesAfterProjectAbsence.length,
    observedAt,
    preflight,
    syntheticDataDeletion,
    syntheticDataDeletionConfirmation,
  });
}

async function executeExactVercelProjectDeletionCore({
  assertMutationAuthorityImpl,
  collectReadOnlyInventoryImpl,
  deactivation,
  executionAuthorization,
  now,
  providerCallFactory,
  syntheticDataDeletion,
  syntheticDataDeletionConfirmation,
}) {
  if (
    typeof assertMutationAuthorityImpl !== "function"
    || typeof collectReadOnlyInventoryImpl !== "function"
    || typeof providerCallFactory !== "function"
  ) throw operatorError("VERCEL_DELETION_CORE_DEPENDENCIES_REQUIRED");
  assertExecutionAuthorization(
    "vercelDestruction",
    executionAuthorization,
    now,
  );
  assertMutationAuthorityImpl();
  validateDeactivationEvidence(deactivation);
  validateSyntheticDataDeletionEvidence(syntheticDataDeletion);
  validateSyntheticDataDeletionConfirmation(
    syntheticDataDeletionConfirmation,
    syntheticDataDeletion,
  );
  const rawInventory = await collectReadOnlyInventoryImpl();
  const combinedInventory = buildInventoryReport(
    rawInventory,
    {
      inventoryPhase: rawInventory?.vercel?.project === null
        ? "AUTO"
        : "SAFE_BACKEND_FOR_DESTRUCTION",
    },
  );
  const preflight = validateVercelDestructionPreflightInventory(
    combinedInventory,
    deactivation,
    syntheticDataDeletion,
    syntheticDataDeletionConfirmation,
  );
  const call = await providerCallFactory();
  if (typeof call !== "function") {
    throw operatorError("VERCEL_DELETION_PROVIDER_CALL_REQUIRED");
  }
  const project = await call(
    "PRE_DELETE_PROJECT",
    `/v9/projects/${APPROVED_SCOPE.vercelProjectId}`,
    { allowAbsent: true },
  );
  if (project.absent) {
    if (!preflight.vercelProjectAbsent) {
      throw operatorError("VERCEL_PROJECT_STATE_CHANGED_AFTER_LIVE_PREFLIGHT");
    }
    const postAbsence =
      await collectVercelPostProjectAbsenceReadbacks(call);
    if (
      postAbsence.deployments.length !== 0
      || postAbsence.domains.length !== 0
      || postAbsence.environmentVariables.length !== 0
      || postAbsence.projectSettingsAbsent !== true
    ) {
      throw operatorError(
        "VERCEL_PROJECT_ABSENT_BUT_CHILD_RESOURCES_OR_SETTINGS_REMAIN",
      );
    }
    return reduceVercelDestructionTranscript({
      deactivation,
      deletionRequested: false,
      domainsAfterProjectAbsence: postAbsence.domains,
      deploymentsAfterProjectAbsence: postAbsence.deployments,
      deploymentsBeforeDeletion: [],
      environmentVariablesAfterProjectAbsence:
        postAbsence.environmentVariables,
      liveInventory: combinedInventory,
      observedAt: now.toISOString(),
      preDeleteProjectAbsent: true,
      projectAbsentAfterExecution: true,
      projectSettingsAbsentAfterProjectAbsence:
        postAbsence.projectSettingsAbsent,
      syntheticDataDeletion,
      syntheticDataDeletionConfirmation,
    });
  }
  if (preflight.vercelProjectAbsent) {
    throw operatorError("VERCEL_PROJECT_STATE_CHANGED_AFTER_LIVE_PREFLIGHT");
  }
  const deployments = await collectVercelDeployments(call);
  const blockers = [];
  const normalized = normalizeVercelInventory({
    source: "LIVE_AUTHENTICATED_VERCEL_API",
    team: {
      id: APPROVED_SCOPE.vercelTeamId,
      slug: APPROVED_SCOPE.vercelTeamSlug,
    },
    project: project.value,
    deployments,
    authenticatedReadback: true,
    tokenPrinted: false,
    oidcTokenPrinted: false,
  }, blockers);
  if (blockers.length > 0 || normalized.project === null) {
    throw operatorError("VERCEL_INVENTORY_BLOCKERS_PREVENT_EXACT_PROJECT_DELETION");
  }
  assertMutationAuthorityImpl();
  await call(
    "DELETE_EXACT_PROJECT",
    `/v9/projects/${APPROVED_SCOPE.vercelProjectId}`,
    { method: "DELETE" },
  );
  let absent = false;
  for (let attempt = 0; attempt < 10 && !absent; attempt += 1) {
    const observed = await call(
      "POST_DELETE_PROJECT",
      `/v9/projects/${APPROVED_SCOPE.vercelProjectId}`,
      { allowAbsent: true },
    );
    absent = observed.absent;
    if (!absent) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  if (!absent) throw operatorError("VERCEL_PROJECT_DELETION_NOT_CONFIRMED");
  const postAbsence =
    await collectVercelPostProjectAbsenceReadbacks(call);
  if (
    postAbsence.deployments.length !== 0
    || postAbsence.domains.length !== 0
    || postAbsence.environmentVariables.length !== 0
    || postAbsence.projectSettingsAbsent !== true
  ) {
    throw operatorError(
      "VERCEL_PROJECT_DELETED_BUT_CHILD_RESOURCES_OR_SETTINGS_REMAIN",
    );
  }
  return reduceVercelDestructionTranscript({
    deactivation,
    deletionRequested: true,
    domainsAfterProjectAbsence: postAbsence.domains,
    deploymentsAfterProjectAbsence: postAbsence.deployments,
    deploymentsBeforeDeletion: deployments,
    environmentVariablesAfterProjectAbsence:
      postAbsence.environmentVariables,
    liveInventory: combinedInventory,
    observedAt: now.toISOString(),
    preDeleteProjectAbsent: false,
    projectAbsentAfterExecution: true,
    projectSettingsAbsentAfterProjectAbsence:
      postAbsence.projectSettingsAbsent,
    syntheticDataDeletion,
    syntheticDataDeletionConfirmation,
  });
}

export async function executeExactVercelProjectDeletion({
  executionAuthorization,
} = {}) {
  const now = new Date();
  assertExecutionAuthorization(
    "vercelDestruction",
    executionAuthorization,
    now,
  );
  await assertProductionExternalActionEnvironment();
  const cleanupCapability =
    await acquireCleanupActivationCapability();
  const assertMutationAuthorityImpl = () =>
    assertProductionCleanupAuthority(cleanupCapability);
  assertMutationAuthorityImpl();
  const [
    deactivation,
    syntheticDataDeletion,
    syntheticDataDeletionConfirmation,
  ] = await Promise.all([
    readEvidence(
      EXECUTION_EVIDENCE_PATHS.deactivation,
      "DEACTIVATION_RECEIPT_FILE_REQUIRED",
      "deactivation",
    ),
    readEvidence(
      EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion,
      "SYNTHETIC_DATA_DELETION_EVIDENCE_FILE_REQUIRED",
      "syntheticDataDeletion",
    ),
    readEvidence(
      EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionConfirmation,
      "SYNTHETIC_DATA_DELETION_CONFIRMATION_FILE_REQUIRED",
      "syntheticDataDeletionConfirmation",
    ),
  ]);
  const previewDestruction = await executeExactVercelProjectDeletionCore({
    assertMutationAuthorityImpl,
    collectReadOnlyInventoryImpl: collectReadOnlyInventory,
    deactivation,
    executionAuthorization,
    now,
    providerCallFactory: () =>
      createVercelProviderClient({ allowExactProjectDeletion: true }),
    syntheticDataDeletion,
    syntheticDataDeletionConfirmation,
  });
  await writeExecutionEvidence(
    "previewDestruction",
    previewDestruction,
  );
  return previewDestruction;
}

function parseArgs(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw operatorError("EXPLICIT_FLAG_VALUE_PAIRS_REQUIRED");
    }
    if (parsed.has(key)) throw operatorError(`DUPLICATE_FLAG_${key}`);
    parsed.set(key, value);
  }
  const allowed = new Set([
    "--action",
    "--confirm-inventory-digest",
    "--confirm-human-phrase",
    "--confirm-project-number",
    "--confirm-vercel-project-id",
    "--confirm-vercel-team-id",
    "--control-epoch",
    "--deactivation-receipt",
    "--execute",
    "--output",
    "--preview-destruction-evidence",
    "--synthetic-data-deletion-evidence",
    "--window-expires-at",
  ]);
  for (const key of parsed.keys()) {
    if (!allowed.has(key)) throw operatorError(`UNKNOWN_FLAG_${key}`);
  }
  return parsed;
}

export function assertExecutionEvidencePath(kind, path) {
  if (
    !Object.hasOwn(EXECUTION_EVIDENCE_PATHS, kind)
    || path !== EXECUTION_EVIDENCE_PATHS[kind]
  ) throw operatorError(`EXACT_${String(kind).toUpperCase()}_EVIDENCE_PATH_REQUIRED`);
  return path;
}

function sameCanonicalPath(left, right) {
  const normalize = (value) =>
    process.platform === "win32" ? value.toLowerCase() : value;
  return normalize(left) === normalize(right);
}

const EVIDENCE_TEMP_SUFFIX =
  /^\.tmp-([1-9][0-9]*)-([a-f0-9]{32})$/u;
const MAXIMUM_INTERRUPTED_EVIDENCE_TEMPS = 32;

function assertRepositoryRelativeEvidencePath(path) {
  if (
    typeof path !== "string"
    || path.length === 0
    || isAbsolute(path)
    || path.includes("\\")
    || path.includes("\0")
    || path.split("/").some((part) => (
      part.length === 0
      || part === "."
      || part === ".."
    ))
  ) throw operatorError("CANONICAL_EVIDENCE_PATH_REQUIRED");
  return path;
}

function validateEvidenceTempBasename(targetBasename, candidateBasename) {
  if (
    typeof targetBasename !== "string"
    || targetBasename.length === 0
    || targetBasename.includes("/")
    || targetBasename.includes("\\")
    || typeof candidateBasename !== "string"
  ) throw operatorError("INTERRUPTED_EVIDENCE_TEMP_NAME_INVALID");
  const prefix = `${targetBasename}.tmp-`;
  if (!candidateBasename.startsWith(prefix)) return false;
  const suffix = candidateBasename.slice(targetBasename.length);
  if (!EVIDENCE_TEMP_SUFFIX.test(suffix)) {
    throw operatorError("INTERRUPTED_EVIDENCE_TEMP_NAME_INVALID");
  }
  return true;
}

export function validateEvidenceTempBasenameForTesting(
  targetBasename,
  candidateBasename,
) {
  return validateEvidenceTempBasename(
    targetBasename,
    candidateBasename,
  );
}

async function assertCanonicalEvidenceParentChainAtRoot(
  path,
  repositoryRoot = repositoryRootPath,
) {
  const requestedPath = assertRepositoryRelativeEvidencePath(path);
  const resolvedRoot = resolve(repositoryRoot);
  let canonicalRoot;
  let rootMetadata;
  try {
    [canonicalRoot, rootMetadata] = await Promise.all([
      realpath(resolvedRoot),
      lstat(resolvedRoot),
    ]);
  } catch {
    throw operatorError("CANONICAL_EVIDENCE_PARENT_REQUIRED");
  }
  if (
    !rootMetadata.isDirectory()
    || rootMetadata.isSymbolicLink()
  ) throw operatorError("CANONICAL_EVIDENCE_PARENT_REQUIRED");

  const parts = requestedPath.split("/");
  const parentParts = parts.slice(0, -1);
  const chain = [{
    dev: rootMetadata.dev,
    ino: rootMetadata.ino,
    path: resolvedRoot,
  }];
  let current = resolvedRoot;
  let expected = canonicalRoot;
  let parentMetadata = rootMetadata;
  for (const part of parentParts) {
    current = join(current, part);
    expected = join(expected, part);
    let metadata;
    let canonical;
    try {
      [metadata, canonical] = await Promise.all([
        lstat(current),
        realpath(current),
      ]);
    } catch {
      throw operatorError("CANONICAL_EVIDENCE_PARENT_REQUIRED");
    }
    if (
      !metadata.isDirectory()
      || metadata.isSymbolicLink()
      || !sameCanonicalPath(canonical, expected)
    ) throw operatorError("CANONICAL_EVIDENCE_PARENT_REQUIRED");
    chain.push({
      dev: metadata.dev,
      ino: metadata.ino,
      path: current,
    });
    parentMetadata = metadata;
  }
  const targetPath = join(resolvedRoot, ...parts);
  const expectedTarget = join(canonicalRoot, ...parts);
  return Object.freeze({
    canonicalRoot,
    chain: Object.freeze(chain.map((entry) => Object.freeze(entry))),
    expectedTarget,
    parentMetadata,
    parentPath: dirname(targetPath),
    path: requestedPath,
    repositoryRoot: resolvedRoot,
    targetPath,
  });
}

async function reassertCanonicalEvidenceParentChain(observation) {
  const current = await assertCanonicalEvidenceParentChainAtRoot(
    observation.path,
    observation.repositoryRoot,
  );
  if (
    current.chain.length !== observation.chain.length
    || current.chain.some((entry, index) => (
      entry.dev !== observation.chain[index].dev
      || entry.ino !== observation.chain[index].ino
      || !sameCanonicalPath(entry.path, observation.chain[index].path)
    ))
  ) throw operatorError("CANONICAL_EVIDENCE_PARENT_CHANGED");
  return current;
}

export async function assertCanonicalEvidenceParentChainForTesting(
  repositoryRoot,
  path,
) {
  await assertCanonicalEvidenceParentChainAtRoot(path, repositoryRoot);
  return true;
}

async function assertCanonicalEvidenceFile(
  path,
  expectedCanonicalPath,
  {
    allowedLinkCounts = [1],
    parentMetadata,
    requireOperatorOwnedTemp = false,
  } = {},
) {
  let metadata;
  let canonical;
  try {
    [metadata, canonical] = await Promise.all([
      lstat(path),
      realpath(path),
    ]);
  } catch (error) {
    if (error?.code === "ENOENT") throw error;
    throw operatorError(
      "CANONICAL_REGULAR_UNLINKED_EVIDENCE_FILE_REQUIRED",
    );
  }
  if (
    !metadata.isFile()
    || metadata.isSymbolicLink()
    || !sameCanonicalPath(canonical, expectedCanonicalPath)
    || !allowedLinkCounts.includes(metadata.nlink)
    || (
      requireOperatorOwnedTemp
      && process.platform !== "win32"
      && (
        (metadata.mode & 0o777) !== 0o600
        || metadata.uid !== parentMetadata?.uid
      )
    )
  ) throw operatorError(
    "CANONICAL_REGULAR_UNLINKED_EVIDENCE_FILE_REQUIRED",
  );
  return metadata;
}

async function syncEvidenceParent(parentPath) {
  let handle;
  try {
    handle = await open(parentPath, "r");
    await handle.sync();
  } catch (error) {
    if (
      process.platform === "win32"
      && ["EACCES", "EINVAL", "EISDIR", "EPERM"].includes(error?.code)
    ) return;
    throw operatorError("ATOMIC_EVIDENCE_PARENT_FSYNC_FAILED");
  } finally {
    if (handle !== undefined) await handle.close().catch(() => {});
  }
}

async function recoverInterruptedEvidenceHardLink(
  path,
  repositoryRoot = repositoryRootPath,
) {
  const parent = await assertCanonicalEvidenceParentChainAtRoot(
    path,
    repositoryRoot,
  );
  let target;
  try {
    target = await assertCanonicalEvidenceFile(
      parent.targetPath,
      parent.expectedTarget,
      { allowedLinkCounts: [1, 2] },
    );
  } catch (error) {
    if (error?.code === "ENOENT") target = undefined;
    else throw error;
  }

  const targetBasename = basename(parent.targetPath);
  const entries = await readdir(parent.parentPath, {
    withFileTypes: true,
  });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.name.startsWith(`${targetBasename}.tmp-`)) continue;
    validateEvidenceTempBasename(targetBasename, entry.name);
    candidates.push(entry);
  }
  if (candidates.length > MAXIMUM_INTERRUPTED_EVIDENCE_TEMPS) {
    throw operatorError(
      "INTERRUPTED_EXECUTION_EVIDENCE_RECOVERY_SCOPE_EXCEEDED",
    );
  }

  const matchingHardLinks = [];
  for (const entry of candidates) {
    const candidatePath = join(parent.parentPath, entry.name);
    const candidate = await assertCanonicalEvidenceFile(
      candidatePath,
      join(dirname(parent.expectedTarget), entry.name),
      {
        allowedLinkCounts: [1, 2],
        parentMetadata: parent.parentMetadata,
        requireOperatorOwnedTemp: true,
      },
    );
    if (candidate.nlink !== 2) continue;
    if (
      target === undefined
      || target.nlink !== 2
      || candidate.dev !== target.dev
      || candidate.ino !== target.ino
    ) throw operatorError("INTERRUPTED_EVIDENCE_TEMP_HARDLINK_INVALID");
    matchingHardLinks.push({
      dev: candidate.dev,
      ino: candidate.ino,
      path: candidatePath,
    });
  }
  if (
    target?.nlink === 2
    && matchingHardLinks.length !== 1
  ) throw operatorError("INTERRUPTED_EVIDENCE_TEMP_HARDLINK_INVALID");
  if (matchingHardLinks.length === 1) {
    await reassertCanonicalEvidenceParentChain(parent);
    await unlink(matchingHardLinks[0].path);
    await syncEvidenceParent(parent.parentPath);
    target = await assertCanonicalEvidenceFile(
      parent.targetPath,
      parent.expectedTarget,
    );
    if (
      target.dev !== matchingHardLinks[0].dev
      || target.ino !== matchingHardLinks[0].ino
    ) throw operatorError(
      "CANONICAL_REGULAR_UNLINKED_EVIDENCE_FILE_REQUIRED",
    );
  }
  return parent;
}

export async function recoverInterruptedEvidenceHardLinkForTesting(
  repositoryRoot,
  path,
) {
  if (
    path !== INVENTORY_EVIDENCE_OUTPUT
    && !Object.values(EXECUTION_EVIDENCE_PATHS).includes(path)
  ) throw operatorError("EXACT_EVIDENCE_RECOVERY_PATH_REQUIRED");
  await recoverInterruptedEvidenceHardLink(path, repositoryRoot);
  return true;
}

export function executionEvidenceCanonicalPath(kind, path) {
  assertExecutionEvidencePath(kind, path);
  return fileURLToPath(new URL(path, rootUrl));
}

export function validateCanonicalRegularEvidenceFileObservation(
  observation,
) {
  if (
    observation?.lstatIsFile !== true
    || observation?.lstatIsSymbolicLink !== false
    || observation?.openedIsFile !== true
    || observation?.canonicalPathMatches !== true
    || observation?.sameOpenedFileIdentity !== true
    || observation?.linkCount !== 1
  ) throw operatorError("CANONICAL_REGULAR_UNLINKED_EVIDENCE_FILE_REQUIRED");
  return true;
}

async function recoverInterruptedExecutionEvidenceHardLink(
  kind,
  path,
) {
  assertExecutionEvidencePath(kind, path);
  await recoverInterruptedEvidenceHardLink(path);
}

async function readCanonicalRegularEvidenceFile(kind, path) {
  const requestedPath = assertExecutionEvidencePath(kind, path);
  await recoverInterruptedExecutionEvidenceHardLink(
    kind,
    requestedPath,
  );
  const parent = await assertCanonicalEvidenceParentChainAtRoot(
    requestedPath,
  );
  const before = await assertCanonicalEvidenceFile(
    parent.targetPath,
    parent.expectedTarget,
  );
  let handle;
  try {
    handle = await open(parent.targetPath, "r");
    const opened = await handle.stat();
    validateCanonicalRegularEvidenceFileObservation({
      lstatIsFile: before.isFile(),
      lstatIsSymbolicLink: before.isSymbolicLink(),
      openedIsFile: opened.isFile(),
      canonicalPathMatches: sameCanonicalPath(
        await realpath(parent.targetPath),
        parent.expectedTarget,
      ),
      sameOpenedFileIdentity:
        before.dev === opened.dev && before.ino === opened.ino,
      linkCount: opened.nlink,
    });
    let evidence;
    try {
      evidence = JSON.parse(await handle.readFile("utf8"));
    } catch {
      throw operatorError(
        "CANONICAL_EXECUTION_EVIDENCE_JSON_REQUIRED",
      );
    }
    assertNoCredentialFields(evidence);
    assertNoSyntheticIdentifierFieldsOrValues(evidence);
    return evidence;
  } finally {
    if (handle !== undefined) await handle.close();
  }
}

async function readEvidence(path, missingCode, kind) {
  if (!path) throw operatorError(missingCode);
  try {
    return await readCanonicalRegularEvidenceFile(kind, path);
  } catch (error) {
    if (error?.message === error?.code) throw error;
    throw operatorError(missingCode);
  }
}

async function readOptionalExecutionEvidence(kind) {
  const path = EXECUTION_EVIDENCE_PATHS[kind];
  try {
    return await readCanonicalRegularEvidenceFile(kind, path);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    if (error?.message === error?.code) throw error;
    throw operatorError(
      "OPTIONAL_EXECUTION_EVIDENCE_READ_FAILED",
    );
  }
}

function validateSyntheticDeleteInvocationResult(value) {
  if (
    value?.terminalStatus !== "DELETED"
    || value?.audioStatus !== "SILENT"
    || value?.identifiersPersistedOrPrinted !== false
    || value?.identityTokenPrintedOrPersisted !== false
  ) {
    throw operatorError(
      "DELETE_SYNTHETIC_SESSION_PROVIDER_RESPONSE_INVALID",
    );
  }
  return true;
}

function validateExistingSyntheticDeletionReceiptReadback({
  intent,
  rawInventory,
  receipt,
}) {
  const revokedInventory = buildInventoryReport(
    rawInventory,
    { inventoryPhase: "SYNTHETIC_DELETION_REVOKED_READBACK" },
  );
  validateSyntheticDeletionRevokedReadbackInventory(
    revokedInventory,
    receipt.controlEpoch,
  );
  validateSyntheticDataDeletionExecutionReceipt(
    receipt,
    revokedInventory,
    intent,
  );
  return revokedInventory;
}

function syntheticDeletionIdentityControlArgs(
  action,
  windowExpiresAt,
  authorization,
) {
  return [
    "--action",
    action,
    "--project",
    APPROVED_SCOPE.projectId,
    "--google-account",
    APPROVED_SCOPE.approvedGoogleAccount,
    "--region",
    APPROVED_SCOPE.region,
    "--window-expires-at",
    windowExpiresAt,
    ...(authorization === undefined
      ? []
      : ["--authorized", authorization]),
  ];
}

async function productionSyntheticDeletionIdentityControl({
  action,
  assertMutationAuthorityImpl,
  executionAuthorization,
  nowImpl,
  windowExpiresAt,
}) {
  if (
    typeof assertMutationAuthorityImpl !== "function"
    || typeof nowImpl !== "function"
  ) throw operatorError("CLEANUP_MUTATION_AUTHORITY_GUARD_REQUIRED");
  if (action === "downscope-for-synthetic-deletion") {
    assertSyntheticDeletionDeployWindow(
      windowExpiresAt,
      readActualNow(nowImpl),
      { exceptionalRecoveryRequired: false },
    );
  }
  assertMutationAuthorityImpl();
  if (action === "downscope-for-synthetic-deletion") {
    assertSyntheticDeletionDeployWindow(
      windowExpiresAt,
      readActualNow(nowImpl),
      { exceptionalRecoveryRequired: false },
    );
  }
  return runDeployIdentityControl(
    syntheticDeletionIdentityControlArgs(
      action,
      windowExpiresAt,
      action === "downscope-for-synthetic-deletion"
        ? executionAuthorization
        : undefined,
    ),
  );
}

async function executeSyntheticDataDeletionCore({
  assertMutationAuthorityImpl,
  collectReadOnlyInventoryImpl,
  createDeleteInvokerImpl,
  downscopeDeletionIdentityImpl,
  executionAuthorization,
  loadOptionalEvidenceImpl,
  nowImpl,
  revokeDeletionIdentityImpl,
  windowExpiresAt,
  writeEvidenceImpl,
}) {
  if (
    typeof assertMutationAuthorityImpl !== "function"
    || typeof collectReadOnlyInventoryImpl !== "function"
    || typeof createDeleteInvokerImpl !== "function"
    || typeof downscopeDeletionIdentityImpl !== "function"
    || typeof loadOptionalEvidenceImpl !== "function"
    || typeof nowImpl !== "function"
    || typeof revokeDeletionIdentityImpl !== "function"
    || typeof writeEvidenceImpl !== "function"
  ) {
    throw operatorError(
      "EXPLICIT_SYNTHETIC_DELETION_EXECUTION_DEPENDENCIES_REQUIRED",
    );
  }
  const authorizationNow = readActualNow(nowImpl);
  assertMutationAuthorityImpl();
  assertExecutionAuthorization(
    "syntheticDataDeletion",
    executionAuthorization,
    authorizationNow,
  );
  const [existingIntent, existingReceipt] = await Promise.all([
    loadOptionalEvidenceImpl("syntheticDataDeletionIntent"),
    loadOptionalEvidenceImpl("syntheticDataDeletionExecution"),
  ]);
  if (existingReceipt !== undefined && existingIntent === undefined) {
    throw operatorError(
      "SYNTHETIC_DELETION_RECEIPT_REQUIRES_IMMUTABLE_INTENT",
    );
  }
  if (existingIntent !== undefined) {
    validateSyntheticDataDeletionIntent(existingIntent);
  }
  if (existingReceipt !== undefined) {
    validateSyntheticDataDeletionExecutionReceipt(
      existingReceipt,
      undefined,
      existingIntent,
    );
    let retryRevokeReadback;
    try {
      retryRevokeReadback = await revokeDeletionIdentityImpl({
        action: "revoke-deletion-identity",
        assertMutationAuthorityImpl,
        nowImpl,
        windowExpiresAt: existingReceipt.windowExpiresAt,
      });
      validateSyntheticDeletionIdentityLifecycleReadback(
        retryRevokeReadback,
        "revoke-deletion-identity",
        existingReceipt.windowExpiresAt,
      );
    } catch {
      throw operatorError(
        "SYNTHETIC_DELETION_IDENTITY_GUARANTEED_REVOCATION_FAILED",
      );
    }
    const retryRawInventory = await collectReadOnlyInventoryImpl();
    validateExistingSyntheticDeletionReceiptReadback({
      intent: existingIntent,
      rawInventory: retryRawInventory,
      receipt: existingReceipt,
    });
    return existingReceipt;
  }

  assertSyntheticDeletionDeployWindow(
    windowExpiresAt,
    readActualNow(nowImpl),
    { exceptionalRecoveryRequired: false },
  );
  assertMutationAuthorityImpl();
  let afterInventory;
  let beforeInventory;
  let deletionIdentityDownscopeReadback;
  let deletionIdentityRevokeReadback;
  let deleteInvocationCount = 0;
  let intent = existingIntent;
  let observedAfterAt;
  let primaryError;
  let revokedInventory;
  try {
    deletionIdentityDownscopeReadback =
      await downscopeDeletionIdentityImpl({
        action: "downscope-for-synthetic-deletion",
        assertMutationAuthorityImpl,
        executionAuthorization,
        nowImpl,
        windowExpiresAt,
      });
    validateSyntheticDeletionIdentityLifecycleReadback(
      deletionIdentityDownscopeReadback,
      "downscope-for-synthetic-deletion",
      windowExpiresAt,
    );

    const rawBefore = await collectReadOnlyInventoryImpl();
    const observedBeforeAt = readActualNow(nowImpl);
    assertSyntheticDeletionDeployWindow(
      windowExpiresAt,
      observedBeforeAt,
      { exceptionalRecoveryRequired: false },
    );
    beforeInventory = buildInventoryReport(
      rawBefore,
      {
        deployWindowExpiresAt: windowExpiresAt,
        inventoryPhase: "SYNTHETIC_DELETION_AUTHORIZED",
      },
    );
    const preflight = validateSyntheticDeletionAuthorizedInventory(
      beforeInventory,
      windowExpiresAt,
    );
    const functionUri =
      exactDeleteSyntheticSessionFunctionUri(rawBefore);

    if (intent === undefined) {
      if (
        preflight.binding.activeSyntheticSessionCount === 0
        && preflight.binding.activeCapabilityGrantCount === 0
        && preflight.binding.tombstoneCount === 0
      ) {
        throw operatorError(
          "SYNTHETIC_DELETION_FIRST_RUN_ZERO_WITHOUT_TOMBSTONE_HISTORY_NOT_PROOF",
        );
      }
      intent = materializeSyntheticDataDeletionIntent(
        beforeInventory,
        windowExpiresAt,
        observedBeforeAt,
      );
      await writeEvidenceImpl(
        "syntheticDataDeletionIntent",
        intent,
      );
    } else {
      validateSyntheticDeletionIntentRecoveryState(
        intent,
        beforeInventory,
        windowExpiresAt,
      );
    }

    if (preflight.sessionIds.length > 0) {
      assertSyntheticDeletionDeployWindow(
        windowExpiresAt,
        readActualNow(nowImpl),
        { exceptionalRecoveryRequired: false },
      );
      const invokeDelete = await createDeleteInvokerImpl({
        assertMutationAuthorityImpl,
        functionUri,
        nowImpl,
        windowExpiresAt,
      });
      if (typeof invokeDelete !== "function") {
        throw operatorError(
          "DELETE_SYNTHETIC_SESSION_PROVIDER_INVOKER_REQUIRED",
        );
      }
      for (const syntheticSessionId of preflight.sessionIds) {
        assertSyntheticDeletionDeployWindow(
          windowExpiresAt,
          readActualNow(nowImpl),
          { exceptionalRecoveryRequired: false },
        );
        let result;
        try {
          result = await invokeDelete(syntheticSessionId);
        } catch {
          throw operatorError(
            "DELETE_SYNTHETIC_SESSION_PROVIDER_CALL_FAILED",
          );
        }
        validateSyntheticDeleteInvocationResult(result);
        deleteInvocationCount += 1;
      }
    }

    assertSyntheticDeletionDeployWindow(
      windowExpiresAt,
      readActualNow(nowImpl),
      { exceptionalRecoveryRequired: false },
    );
    const rawAfter = await collectReadOnlyInventoryImpl();
    observedAfterAt = readActualNow(nowImpl);
    assertSyntheticDeletionDeployWindow(
      windowExpiresAt,
      observedAfterAt,
      { exceptionalRecoveryRequired: false },
    );
    afterInventory = buildInventoryReport(
      rawAfter,
      {
        deployWindowExpiresAt: windowExpiresAt,
        inventoryPhase: "SYNTHETIC_DELETION_AUTHORIZED",
      },
    );
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      deletionIdentityRevokeReadback =
        await revokeDeletionIdentityImpl({
          action: "revoke-deletion-identity",
          assertMutationAuthorityImpl,
          nowImpl,
          windowExpiresAt,
        });
      validateSyntheticDeletionIdentityLifecycleReadback(
        deletionIdentityRevokeReadback,
        "revoke-deletion-identity",
        windowExpiresAt,
      );
      const rawRevoked = await collectReadOnlyInventoryImpl();
      revokedInventory = buildInventoryReport(
        rawRevoked,
        { inventoryPhase: "SYNTHETIC_DELETION_REVOKED_READBACK" },
      );
      validateSyntheticDeletionRevokedReadbackInventory(
        revokedInventory,
        intent?.controlEpoch ?? 2,
      );
    } catch {
      throw operatorError(
        "SYNTHETIC_DELETION_IDENTITY_GUARANTEED_REVOCATION_FAILED",
      );
    }
  }
  if (primaryError !== undefined) throw primaryError;

  const receipt = reduceSyntheticDataDeletionTranscript({
    afterInventory,
    beforeInventory,
    deleteInvocationCount,
    deletionIdentityDownscopeReadback,
    deletionIdentityRevokeReadback,
    intent,
    observedAt: observedAfterAt,
    revokedInventory,
    windowExpiresAt,
  });
  validateSyntheticDataDeletionExecutionReceipt(
    receipt,
    afterInventory,
    intent,
  );
  await writeEvidenceImpl(
    "syntheticDataDeletionExecution",
    receipt,
  );
  return receipt;
}

export async function executeSyntheticDataDeletionWithTestDoubles(
  {
    executionAuthorization,
    windowExpiresAt,
  } = {},
  adapter,
) {
  const state = syntheticDeletionInMemoryAdapters.get(adapter);
  if (state === undefined) {
    throw operatorError("MODULE_CREATED_IN_MEMORY_TEST_ADAPTER_REQUIRED");
  }
  const { script, transcript } = state;
  const collectReadOnlyInventoryImpl = async () => {
    transcript.events.push("COLLECT");
    return scriptedValue(
      script.inventories,
      "UNSCRIPTED_IN_MEMORY_INVENTORY_READ_FORBIDDEN",
    );
  };
  const downscopeDeletionIdentityImpl = async () => {
    transcript.events.push("DOWNSCOPE");
    return scriptedValue(
      script.downscopeSteps,
      "UNSCRIPTED_IN_MEMORY_DOWNSCOPE_FORBIDDEN",
    );
  };
  const revokeDeletionIdentityImpl = async () => {
    transcript.events.push("REVOKE");
    return scriptedValue(
      script.revokeSteps,
      "UNSCRIPTED_IN_MEMORY_REVOKE_FORBIDDEN",
    );
  };
  const createDeleteInvokerImpl = async () => {
    transcript.events.push("CREATE_DELETE_INVOKER");
    if (!script.allowDeleteInvoker) {
      throw operatorError("IN_MEMORY_DELETE_INVOKER_FORBIDDEN");
    }
    return async () => {
      transcript.events.push("DELETE");
      transcript.deleteInvocationCount += 1;
      return scriptedValue(
        script.deleteResults,
        "UNSCRIPTED_IN_MEMORY_DELETE_FORBIDDEN",
      );
    };
  };
  const loadOptionalEvidenceImpl = async (kind) => (
    Object.hasOwn(script.optionalEvidence, kind)
      ? structuredClone(script.optionalEvidence[kind])
      : undefined
  );
  const writeEvidenceImpl = async (kind, evidence) => {
    if (script.evidenceWriteMode !== "CAPTURE") {
      throw operatorError("IN_MEMORY_EVIDENCE_WRITE_FORBIDDEN");
    }
    transcript.evidenceWrites.push({
      kind,
      evidence: structuredClone(evidence),
    });
  };
  return executeSyntheticDataDeletionCore({
    assertMutationAuthorityImpl: () => true,
    collectReadOnlyInventoryImpl,
    createDeleteInvokerImpl,
    downscopeDeletionIdentityImpl,
    executionAuthorization,
    loadOptionalEvidenceImpl,
    nowImpl: () => new Date(script.now),
    revokeDeletionIdentityImpl,
    windowExpiresAt,
    writeEvidenceImpl,
  });
}

export async function executeSyntheticDataDeletion({
  executionAuthorization,
  windowExpiresAt,
} = {}) {
  await assertProductionExternalActionEnvironment();
  const cleanupCapability =
    await acquireCleanupActivationCapability();
  const assertMutationAuthorityImpl = () =>
    assertProductionCleanupAuthority(cleanupCapability);
  assertMutationAuthorityImpl();
  return executeSyntheticDataDeletionCore({
    assertMutationAuthorityImpl,
    collectReadOnlyInventoryImpl: () =>
      collectReadOnlyInventory({
        googleOnlySyntheticDeletion: true,
      }),
    createDeleteInvokerImpl:
      createProductionSyntheticSessionDeleteInvoker,
    downscopeDeletionIdentityImpl:
      productionSyntheticDeletionIdentityControl,
    executionAuthorization,
    loadOptionalEvidenceImpl: readOptionalExecutionEvidence,
    nowImpl: () => new Date(),
    revokeDeletionIdentityImpl:
      productionSyntheticDeletionIdentityControl,
    windowExpiresAt,
    writeEvidenceImpl: writeExecutionEvidence,
  });
}

async function recordSyntheticDataDeletionConfirmation(
  confirmationPhrase,
) {
  const evidence = await readEvidence(
    EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion,
    "SYNTHETIC_DATA_DELETION_EVIDENCE_FILE_REQUIRED",
    "syntheticDataDeletion",
  );
  const confirmation = materializeSyntheticDataDeletionConfirmation(
    evidence,
    confirmationPhrase,
    new Date().toISOString(),
  );
  await writeExecutionEvidence(
    "syntheticDataDeletionConfirmation",
    confirmation,
  );
  return confirmation;
}

async function recordPreviewDestructionConfirmation(confirmationPhrase) {
  const evidence = await readEvidence(
    EXECUTION_EVIDENCE_PATHS.previewDestruction,
    "PREVIEW_DESTRUCTION_EVIDENCE_FILE_REQUIRED",
    "previewDestruction",
  );
  const confirmation = materializePreviewDestructionConfirmation(
    evidence,
    confirmationPhrase,
    new Date().toISOString(),
  );
  await writeExecutionEvidence(
    "previewDestructionConfirmation",
    confirmation,
  );
  return confirmation;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await assertProductionExternalActionEnvironment();
  await loadAndValidateOperatorContracts();
  const action = args.get("--action");
  if (action === "inventory") {
    if (args.size > 2 || (args.size === 2 && !args.has("--output"))) {
      throw operatorError("INVENTORY_ACCEPTS_ONLY_EXACT_OUTPUT_FLAG");
    }
    const rawInventory = await collectReadOnlyInventory();
    const report = buildInventoryReport(rawInventory);
    const outputPath = args.get("--output");
    if (outputPath === undefined) {
      process.stdout.write(
        `${JSON.stringify(redactInventoryForEvidence(report), null, 2)}\n`,
      );
      return;
    }
    process.stdout.write(
      `${JSON.stringify(await writeInventoryEvidence(report, outputPath), null, 2)}\n`,
    );
    return;
  }
  if (action === "delete-synthetic-data") {
    if (
      args.size !== 3
      || !args.has("--window-expires-at")
      || !args.has("--execute")
    ) {
      throw operatorError(
        "DELETE_SYNTHETIC_DATA_REQUIRES_EXACT_WINDOW_AND_AUTHORIZATION_FLAGS",
      );
    }
    const receipt = await executeSyntheticDataDeletion({
      executionAuthorization: args.get("--execute"),
      windowExpiresAt: args.get("--window-expires-at"),
    });
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    return;
  }
  if (action === "synthetic-data-deletion-evidence-plan") {
    if (args.size !== 1) {
      throw operatorError(
        "SYNTHETIC_DATA_DELETION_EVIDENCE_PLAN_ACCEPTS_NO_FLAGS",
      );
    }
    const inventory = buildInventoryReport(
      await collectReadOnlyInventory(),
      { inventoryPhase: "SAFE_BACKEND_FOR_DESTRUCTION" },
    );
    const [intent, receipt] = await Promise.all([
      readEvidence(
        EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionIntent,
        "SYNTHETIC_DATA_DELETION_INTENT_FILE_REQUIRED",
        "syntheticDataDeletionIntent",
      ),
      readEvidence(
        EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionExecution,
        "SYNTHETIC_DATA_DELETION_EXECUTION_RECEIPT_FILE_REQUIRED",
        "syntheticDataDeletionExecution",
      ),
    ]);
    const evidence = materializeSyntheticDataDeletionEvidencePlan(
      inventory,
      intent,
      receipt,
    );
    await writeExecutionEvidence("syntheticDataDeletion", evidence);
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    return;
  }
  if (action === "record-synthetic-data-deletion-confirmation") {
    if (args.size !== 2 || !args.has("--confirm-human-phrase")) {
      throw operatorError(
        "SYNTHETIC_CONFIRMATION_REQUIRES_EXACT_PHRASE_FLAG",
      );
    }
    process.stdout.write(`${JSON.stringify(
      await recordSyntheticDataDeletionConfirmation(
        args.get("--confirm-human-phrase"),
      ),
      null,
      2,
    )}\n`);
    return;
  }
  if (action === "record-preview-destruction-confirmation") {
    if (args.size !== 2 || !args.has("--confirm-human-phrase")) {
      throw operatorError(
        "PREVIEW_CONFIRMATION_REQUIRES_EXACT_PHRASE_FLAG",
      );
    }
    process.stdout.write(`${JSON.stringify(
      await recordPreviewDestructionConfirmation(
        args.get("--confirm-human-phrase"),
      ),
      null,
      2,
    )}\n`);
    return;
  }
  if (action === "deactivation-plan") {
    const plan = materializeDeactivationPlan(args.get("--control-epoch"));
    const executionToken = args.get("--execute");
    if (executionToken === undefined) {
      if (
        args.size > 2
        || (
          args.size === 2
          && !args.has("--control-epoch")
        )
      ) throw operatorError("DEACTIVATION_PLAN_ACCEPTS_ONLY_CONTROL_EPOCH");
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
      return;
    }
    assertExecutionAuthorization("deactivation", executionToken);
    if (
      args.size !== 4
      || !args.has("--control-epoch")
      || !args.has("--synthetic-data-deletion-evidence")
    ) {
      throw operatorError(
        "DEACTIVATION_EXECUTION_REQUIRES_EXACT_SAFE_EVIDENCE_FLAGS",
      );
    }
    const epoch = Number(args.get("--control-epoch"));
    if (!Number.isSafeInteger(epoch) || epoch < 2) {
      throw operatorError("STRICTLY_ADVANCED_CONTROL_EPOCH_REQUIRED");
    }
    assertExecutionEvidencePath(
      "syntheticDataDeletion",
      args.get("--synthetic-data-deletion-evidence"),
    );
    const receipt = await executeDeactivationPlan({
      controlEpoch: epoch,
      executionAuthorization: executionToken,
    });
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    return;
  }
  if (action === "vercel-destruction-plan") {
    const plan = materializeVercelDestructionPlan();
    const executionToken = args.get("--execute");
    if (executionToken === undefined) {
      if (args.size !== 1) {
        throw operatorError("VERCEL_DESTRUCTION_PLAN_ACCEPTS_NO_EXECUTION_FLAGS");
      }
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
      return;
    }
    assertExecutionAuthorization("vercelDestruction", executionToken);
    if (args.get("--confirm-vercel-team-id") !== APPROVED_SCOPE.vercelTeamId) {
      throw operatorError("EXACT_VERCEL_TEAM_ID_CONFIRMATION_REQUIRED");
    }
    if (args.get("--confirm-vercel-project-id") !== APPROVED_SCOPE.vercelProjectId) {
      throw operatorError("EXACT_VERCEL_PROJECT_ID_CONFIRMATION_REQUIRED");
    }
    if (
      args.size !== 6
      || !args.has("--deactivation-receipt")
      || !args.has("--synthetic-data-deletion-evidence")
    ) {
      throw operatorError(
        "VERCEL_DESTRUCTION_EXECUTION_REQUIRES_EXACT_EVIDENCE_FLAGS",
      );
    }
    assertExecutionEvidencePath(
      "deactivation",
      args.get("--deactivation-receipt"),
    );
    assertExecutionEvidencePath(
      "syntheticDataDeletion",
      args.get("--synthetic-data-deletion-evidence"),
    );
    const previewDestruction = await executeExactVercelProjectDeletion({
      executionAuthorization: executionToken,
    });
    process.stdout.write(
      `${JSON.stringify(previewDestruction, null, 2)}\n`,
    );
    return;
  }
  if (action === "destruction-plan") {
    const inventory = buildInventoryReport(await collectReadOnlyInventory());
    const plan = materializeDestructionPlan(inventory);
    const executionToken = args.get("--execute");
    if (executionToken === undefined) {
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
      return;
    }
    assertExecutionAuthorization("destruction", executionToken);
    if (inventory.blockers.length > 0) {
      throw operatorError("INVENTORY_BLOCKERS_PREVENT_DESTRUCTION");
    }
    if (args.get("--confirm-inventory-digest") !== inventory.inventoryDigest) {
      throw operatorError("LIVE_INVENTORY_DIGEST_CONFIRMATION_REQUIRED");
    }
    if (
      args.size !== 7
      || !args.has("--deactivation-receipt")
      || !args.has("--synthetic-data-deletion-evidence")
      || !args.has("--preview-destruction-evidence")
    ) throw operatorError("DESTRUCTION_EXECUTION_REQUIRES_EXACT_EVIDENCE_FLAGS");
    assertExecutionEvidencePath(
      "deactivation",
      args.get("--deactivation-receipt"),
    );
    assertExecutionEvidencePath(
      "syntheticDataDeletion",
      args.get("--synthetic-data-deletion-evidence"),
    );
    assertExecutionEvidencePath(
      "previewDestruction",
      args.get("--preview-destruction-evidence"),
    );
    const confirmedProjectNumber =
      normalizeProjectNumber(args.get("--confirm-project-number"));
    if (inventory.project === null) {
      if (
        confirmedProjectNumber !== APPROVED_SCOPE.projectNumber
        || plan.verifiedAlreadyAbsent !== true
        || plan.commands.length !== 0
      ) throw operatorError("EXACT_PROJECT_NUMBER_CONFIRMATION_REQUIRED");
      process.stdout.write(`${JSON.stringify({
        schemaVersion: "wp13.12b-ea-destruction-execution-result-v1",
        status: "VERIFIED_ALREADY_DESTROYED_ZERO_COMMAND_NO_OP",
        projectId: APPROVED_SCOPE.projectId,
        projectNumber: APPROVED_SCOPE.projectNumber,
        stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
        inventoryDigestBeforeExecution: inventory.inventoryDigest,
        completed: [],
        externalWrites: 0,
        zeroResourceClaimed: true,
        requiredNextAction: "NONE_DESTRUCTION_ALREADY_VERIFIED_ZERO",
      }, null, 2)}\n`);
      return;
    }
    if (confirmedProjectNumber !== inventory.project.projectNumber) {
      throw operatorError("EXACT_PROJECT_NUMBER_CONFIRMATION_REQUIRED");
    }
    const evidence = {
      deactivation: await readEvidence(
        EXECUTION_EVIDENCE_PATHS.deactivation,
        "DEACTIVATION_RECEIPT_FILE_REQUIRED",
        "deactivation",
      ),
      syntheticDataDeletion: await readEvidence(
        EXECUTION_EVIDENCE_PATHS.syntheticDataDeletion,
        "SYNTHETIC_DATA_DELETION_EVIDENCE_FILE_REQUIRED",
        "syntheticDataDeletion",
      ),
      syntheticDataDeletionConfirmation: await readEvidence(
        EXECUTION_EVIDENCE_PATHS.syntheticDataDeletionConfirmation,
        "SYNTHETIC_DATA_DELETION_CONFIRMATION_FILE_REQUIRED",
        "syntheticDataDeletionConfirmation",
      ),
      previewDestruction: await readEvidence(
        EXECUTION_EVIDENCE_PATHS.previewDestruction,
        "PREVIEW_DESTRUCTION_EVIDENCE_FILE_REQUIRED",
        "previewDestruction",
      ),
      previewDestructionConfirmation: await readEvidence(
        EXECUTION_EVIDENCE_PATHS.previewDestructionConfirmation,
        "PREVIEW_DESTRUCTION_CONFIRMATION_FILE_REQUIRED",
        "previewDestructionConfirmation",
      ),
    };
    validateGoogleDestructionPreflightInventory(inventory, evidence);
    if (plan.commands.some((command) => command.file === "firebase")) {
      throw operatorError(
        "PINNED_FIREBASE_HOSTING_DESTRUCTION_ADAPTER_REQUIRED",
      );
    }
    for (const command of plan.commands) {
      validatePinnedGoogleDestructionCommand(command);
    }
    const cleanupCapability =
      await acquireCleanupActivationCapability();
    const assertMutationAuthorityImpl = () =>
      assertProductionCleanupAuthority(cleanupCapability);
    assertMutationAuthorityImpl();
    let googleCloudExecFile;
    if (plan.commands.length > 0) {
      const googleOAuth =
        await acquirePinnedGoogleOAuthAccessToken();
      googleCloudExecFile =
        createPinnedGoogleCloudCliExecFile({
          environment: process.env,
          googleOAuth,
        });
    }
    const completed = [];
    for (const command of plan.commands) {
      assertMutationAuthorityImpl();
      const result = executeCommand(
        command,
        { googleCloudExecFile },
      );
      delete result.stdout;
      completed.push(result);
    }
    process.stdout.write(`${JSON.stringify({
      schemaVersion: "wp13.12b-ea-destruction-execution-result-v1",
      status: "DESTRUCTION_REQUESTED_PENDING_ZERO_RESOURCE_VERIFICATION",
      projectId: APPROVED_SCOPE.projectId,
      projectNumber: inventory.project.projectNumber,
      stagingExpiryDate: APPROVED_SCOPE.stagingExpiryDate,
      inventoryDigestBeforeExecution: inventory.inventoryDigest,
      completed,
      appCloudStorageWasExpectedOff: true,
      supportingBuildBucketsRemovedByProjectCascade:
        inventory.storagePolicy.supportingBuildBuckets.map((bucket) => bucket.name),
      zeroResourceClaimed: false,
      requiredNextAction: "RUN_FRESH_READ_ONLY_INVENTORY_UNTIL_VERIFIED_ZERO",
    }, null, 2)}\n`);
    return;
  }
  throw operatorError(
    "ACTION_MUST_BE_INVENTORY_DEACTIVATION_VERCEL_DESTRUCTION_OR_GOOGLE_DESTRUCTION_PLAN",
  );
}

const invokedAsScript =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedAsScript) {
  main().catch((error) => {
    process.stderr.write(`${error.code ?? error.message ?? "OPERATOR_TOOL_FAILED"}\n`);
    process.exitCode = 1;
  });
}
