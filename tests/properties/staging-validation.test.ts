import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  derivePr3ProofFamiliesFromValidatedReceipts,
  REQUIRED_EMULATOR_PROOF_RESULTS,
  REQUIRED_PHYSICAL_STEP_IDS,
  REQUIRED_PR3_PROOF_FAMILIES,
  validateExternalActivationState,
  validateExternalResourceInventory,
  isChallengeBoundEmulatorReceipt,
  validateOwnerDecisionForWp13_12b,
  validateReceipt,
  validateStagingRepositoryContract,
} from "../../src/core/staging-validation.js";

const ownerDecision = JSON.parse(readFileSync(
  "release/wp13-12a/decision-package/owner-decision.json",
  "utf8",
)) as Record<string, unknown>;
const authorization = JSON.parse(readFileSync(
  "release/wp13-12a/decision-package/authorization-status.json",
  "utf8",
)) as Record<string, unknown>;
const contract = JSON.parse(readFileSync(
  "release/wp13-12b/staging-activation/repository-contract.json",
  "utf8",
)) as Record<string, unknown>;
const externalActivationState = JSON.parse(readFileSync(
  "release/wp13-12b/external-activation/external-activation-state.json",
  "utf8",
)) as Record<string, unknown>;
const externalResourceInventory = JSON.parse(readFileSync(
  "release/wp13-12b/external-activation/resource-inventory.json",
  "utf8",
)) as Record<string, unknown>;
const externalResourceInventorySchema = JSON.parse(readFileSync(
  "release/wp13-12b/external-activation/resource-inventory.schema.json",
  "utf8",
)) as Record<string, unknown>;
const actualEmulatorReceipt = JSON.parse(readFileSync(
  "release/wp13-12b/receipts/actual/emulator-proof-receipt-2026-07-26.json",
  "utf8",
)) as Record<string, unknown>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function authenticResourceInventory(): Record<string, unknown> {
  const inventory = clone(externalResourceInventory);
  inventory.inventoryStatus = "AUTHENTIC_PROVIDER_SNAPSHOT";
  inventory.resourceCount = 1;
  inventory.zeroResourcesAsserted = false;
  inventory.observation = {
    observedAt: "2026-07-27T10:30:00.000Z",
    performedBy: "authorized-operator",
    providerReadbackCommands: ["sanitized authenticated provider inventory readback"],
    evidencePaths: ["artifacts/wp13-12b-external-resource-inventory.json"],
  };
  inventory.operatorEvidence = {
    path: "artifacts/wp13-12b-external-resource-inventory.json",
    artifactSha256: "1".repeat(64),
    inventoryDigest: "2".repeat(64),
    overlayResourcesDigest: "3".repeat(64),
    schemaVersion: "wp13.12b-ea-operator-resource-inventory-v2",
    source: "LIVE_READ_ONLY_PROVIDER_QUERIES",
    mode: "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION",
    authenticatedVercelReadback: true,
    blockerCount: 0,
  };
  inventory.resources = [{
    resourceId: "projects/ludys-12b-stg-20260725",
    provider: "GOOGLE_CLOUD",
    region: "global",
    purpose: "Isolated synthetic staging project",
    createdAt: "2026-07-25T12:30:00.000Z",
    owner: "tryakim@gmail.com",
    retention: "Until the authorized staging destruction deadline",
    deletionMethod: "Delete through the authenticated expiry destruction procedure",
    costRisk: "Project can incur bounded synthetic staging costs",
    containsRealData: false,
    destructionDeadline: "2027-01-25",
    receiptReference: "release/wp13-12b/receipts/actual/emulator-proof-receipt-2026-07-26.json",
    lifecycleStatus: "ACTIVE",
    evidencePath: "artifacts/wp13-12b-external-resource-inventory.json",
    syntheticOnly: true,
  }];
  return inventory;
}

const activeExternalReceiptTypes = [
  "EMULATOR_PROOF_RECEIPT",
  "FIREBASE_PROJECT_AND_REGION_RECEIPT",
  "IAM_AND_BILLING_RECEIPT",
  "PROTECTED_PREVIEW_RECEIPT",
] as const;

const allPr3ProofFamilies = [...REQUIRED_PR3_PROOF_FAMILIES];

function activeExternalActivationOverlay(
  physicalProof = false,
): Record<string, unknown> {
  const state = clone(externalActivationState);
  state.overlayStatus = "ACTIVE_SYNTHETIC_STAGING_WITH_AUTHENTIC_EVIDENCE";
  state.evidence = {
    validatedReceiptPaths: [
      "release/wp13-12b/receipts/actual/emulator-proof.json",
      "release/wp13-12b/receipts/actual/firebase-project-and-region.json",
      "release/wp13-12b/receipts/actual/iam-and-billing.json",
      "release/wp13-12b/receipts/actual/protected-preview.json",
      ...(physicalProof
        ? ["release/wp13-12b/receipts/actual/device-safety-proof.json"]
        : []),
    ],
    validatedReceiptCount: physicalProof ? 5 : 4,
    emulatorProof: "AUTHENTIC_EVIDENCE_RECORDED",
    cloudProviderReadback: "AUTHENTIC_RECEIPTS_RECORDED",
    physicalTwoDeviceProof: physicalProof
      ? "AUTHENTIC_EVIDENCE_RECORDED"
      : "NOT_PERFORMED",
  };
  state.cloudState = {
    inventoryPath: "release/wp13-12b/external-activation/resource-inventory.json",
    inventoryStatus: "AUTHENTIC_PROVIDER_SNAPSHOT",
    resourceCount: 1,
    zeroResourcesAsserted: false,
    providerActivation: "ACTIVE_WITH_AUTHENTIC_EVIDENCE",
  };
  return state;
}

function authenticPhysicalReceipt(): Record<string, unknown> {
  const syntheticSessionId =
    "synthetic-wp13-12b-abcdefghijklmnopqrstuv";
  const deletionSyntheticSessionId =
    "synthetic-wp13-12b-deletionabcdefghijklmnop";
  const deploymentId = "dpl_syntheticpreview123";
  const rollbackDeploymentId = "dpl_syntheticrollback123";
  const receiptId = "physical-proof-2026-07-27";
  const sourceCommit = "a".repeat(40);
  const sourceTree = "b".repeat(40);
  const physicalEvidencePath = "artifacts/wp13-12b-physical-proof.json";
  const previewEvidencePath = "artifacts/provider-proof.json";
  const rollbackEvidencePath = "artifacts/rollback-provider-proof.json";
  const previewReceiptId = "receipt-protected_preview_receipt";
  const stagingUrl =
    "https://ludys-wp13-12b-staging-proof-abc123.vercel.app/";
  const rollbackStagingUrl =
    "https://ludys-wp13-12b-safe-disabled-rollback.vercel.app/";
  const rollbackSourceCommit = "9".repeat(40);
  const rollbackSourceTree = "8".repeat(40);
  const rollbackEvidenceSha256 = "d".repeat(64);
  const checksum = "c".repeat(64);
  return {
    receiptId,
    receiptType: "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
    status: "COMPLETED_WITH_AUTHENTIC_EVIDENCE",
    createdAt: "2026-07-27T10:00:00.000Z",
    performedBy: "two-adult-physical-proof-operators",
    environment: "EXTERNAL_SYNTHETIC_STAGING",
    sourceCommit,
    expectedSourceCommit: sourceCommit,
    sourceTree,
    decisionRecordChecksum: "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754",
    commandsRun: ["run the documented physical two-device proof sequence"],
    providerResourceIds: {
      project: "ludys-12b-stg-20260725",
      vercelProjectId: "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
      deploymentId,
      deploymentUrl: stagingUrl,
      rollbackDeploymentId,
      rollbackDeploymentUrl: rollbackStagingUrl,
      resourceIds: [
        "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
        deploymentId,
        stagingUrl,
        rollbackDeploymentId,
        rollbackStagingUrl,
      ],
    },
    protectedPreviewReceiptBinding: {
      receiptId: previewReceiptId,
      deploymentId,
      stagingUrl,
      sourceCommit,
      sourceTree,
      confirmationEvidencePath: previewEvidencePath,
      confirmationBindingSha256: checksum,
    },
    rollbackDeploymentId,
    rollbackDeploymentBinding: {
      deploymentId: rollbackDeploymentId,
      stagingUrl: rollbackStagingUrl,
      sourceCommit: rollbackSourceCommit,
      sourceTree: rollbackSourceTree,
      safeDisabled: true,
      evidencePath: rollbackEvidencePath,
      evidenceSha256: rollbackEvidenceSha256,
    },
    proofResults: {
      child_adult_projection_isolation: true,
      wait: true,
      help: true,
      pause: true,
      network_reconnect: true,
      state_version_after_reconnect: true,
      stale_command_rejected: true,
      stop: true,
      delayed_command_after_stop: true,
      reconnect_after_stop_terminal: true,
      deletion: true,
      cached_capability_after_deletion: true,
      no_resurrection: true,
      kill_switch: true,
      rollback_to_safe_disabled_state: true,
      deleted_session_after_rollback: true,
      synthetic_data_deleted: true,
    },
    artifactHashes: {
      [physicalEvidencePath]: checksum,
      [previewEvidencePath]: checksum,
      [rollbackEvidencePath]: rollbackEvidenceSha256,
    },
    limitations: ["Synthetic staging proof only"],
    humanSignatureOrExplicitConfirmation: {
      confirmed: true,
      confirmationText: [
        "BEKREFT_WP13_12B_PHYSICAL_PROOF_V1",
        `receiptId=${receiptId}`,
        `sourceCommit=${sourceCommit}`,
        `sourceTree=${sourceTree}`,
        `deploymentId=${deploymentId}`,
        `syntheticSessionId=${syntheticSessionId}`,
        `deletionSyntheticSessionId=${deletionSyntheticSessionId}`,
        `previewReceiptId=${previewReceiptId}`,
        `previewEvidenceSha256=${checksum}`,
        `rollbackDeploymentId=${rollbackDeploymentId}`,
        `rollbackStagingUrl=${rollbackStagingUrl}`,
        `rollbackSourceCommit=${rollbackSourceCommit}`,
        `rollbackSourceTree=${rollbackSourceTree}`,
        `rollbackEvidenceSha256=${rollbackEvidenceSha256}`,
        `evidenceSha256=${checksum}`,
        "adultOperatorsOnly=true",
        "participantsPresent=false",
        "physicallySeparateDevicesConfirmed=true",
      ].join("; "),
      confirmedAt: "2026-07-27T10:59:00.000Z",
    },
    opensB8: false,
    authorizesStudentBeta: false,
    authorizesProduction: false,
    realParticipantData: false,
    syntheticOrFabricated: false,
    physicalProof: true,
    adultOperatorsOnly: true,
    participantsPresent: false,
    physicallySeparateDevicesConfirmed: true,
    devices: [
      {
        role: "CHILD",
        deviceEvidenceId: "ephemeral-device-evidence-child-8f42d1a0",
        deviceType: "phone",
        operatingSystem: "Android 16",
        browser: "Chrome 140",
        networkEvidence: "Wi-Fi interrupted and reconnected during the proof",
        observedAt: "2026-07-27T10:05:00.000Z",
        syntheticSessionId,
        deploymentId,
        stagingUrl,
        sourceCommit,
        sourceTree,
        capabilityPresent: true,
        capabilityValueRecorded: false,
      },
      {
        role: "ADULT",
        deviceEvidenceId: "ephemeral-device-evidence-adult-41c90e7b",
        deviceType: "tablet",
        operatingSystem: "iPadOS 20",
        browser: "Safari 20",
        network: "Separate connection remained online during the interruption",
        observedAt: "2026-07-27T10:05:05.000Z",
        syntheticSessionId,
        deploymentId,
        stagingUrl,
        sourceCommit,
        sourceTree,
        capabilityPresent: true,
        capabilityValueRecorded: false,
      },
    ],
    checksum,
    physicalEvidencePath,
    stagingUrl,
    sessionFixture: "synthetic-wp13-12b-only",
    syntheticSessionId,
    deletionSyntheticSessionId,
    deploymentId,
    stepResults: REQUIRED_PHYSICAL_STEP_IDS.map((stepId, index) => ({
      stepId,
      passed: true,
      observedAt: `2026-07-27T10:${String(index).padStart(2, "0")}:00.000Z`,
      syntheticSessionId: index < 18
        ? syntheticSessionId
        : deletionSyntheticSessionId,
      deploymentId: index < 24
        ? deploymentId
        : rollbackDeploymentId,
    })),
    containsPersonData: false,
  };
}

function trueProofResults(names: readonly string[]): Record<string, true> {
  return Object.fromEntries(names.map((name) => [name, true]));
}

function authenticProviderReceipt(
  receiptType: string,
  proofResults: readonly string[],
): Record<string, unknown> {
  return {
    schemaVersion: "wp13.12b-receipt-v2",
    templateMarker: "FILLED_AUTHENTIC_EVIDENCE",
    receiptId: `receipt-${receiptType.toLowerCase()}`,
    receiptType,
    status: "COMPLETED_WITH_AUTHENTIC_EVIDENCE",
    createdAt: "2026-07-27T10:30:00.000Z",
    performedBy: "authorized-operator",
    environment: "EXTERNAL_SYNTHETIC_STAGING",
    sourceCommit: "a".repeat(40),
    expectedSourceCommit: "a".repeat(40),
    sourceTree: "b".repeat(40),
    decisionRecordChecksum: "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754",
    commandsRun: ["authenticated read-only provider proof"],
    providerResourceIds: {},
    proofResults: trueProofResults(proofResults),
    artifactHashes: {
      "artifacts/provider-proof.json": "c".repeat(64),
    },
    confirmationEvidencePath: "artifacts/provider-proof.json",
    confirmationBindingSha256: "c".repeat(64),
    limitations: ["Synthetic staging only"],
    humanSignatureOrExplicitConfirmation: {
      confirmed: true,
      confirmationText: "",
      confirmedAt: "2026-07-27T10:31:00.000Z",
    },
    opensB8: false,
    authorizesStudentBeta: false,
    authorizesProduction: false,
    realParticipantData: false,
    syntheticOrFabricated: false,
    physicalProof: false,
    devices: [],
  };
}

function bindProviderConfirmation(
  receipt: Record<string, unknown>,
  prefix: string,
  providerFields: readonly string[],
): void {
  const confirmation =
    receipt.humanSignatureOrExplicitConfirmation as Record<string, unknown>;
  confirmation.confirmationText = [
    prefix,
    `receiptId=${String(receipt.receiptId)}`,
    `sourceCommit=${String(receipt.sourceCommit)}`,
    `sourceTree=${String(receipt.sourceTree)}`,
    ...providerFields,
    `evidenceSha256=${String(receipt.confirmationBindingSha256)}`,
  ].join("; ");
}

const firebaseProofResults = [
  "approved_project_id_exact",
  "approved_region_exact",
  "firestore_database_regional",
  "firestore_rules_deny_all",
  "five_gen2_functions_deployed",
  "functions_disabled_first",
  "logging_excludes_capability_and_payload",
  "session_issuance_disabled",
  "staging_control_absent_or_disabled",
] as const;

function authenticFirebaseReceipt(): Record<string, unknown> {
  const receipt = authenticProviderReceipt(
    "FIREBASE_PROJECT_AND_REGION_RECEIPT",
    firebaseProofResults,
  );
  const functionIds = [
    "deleteSyntheticSession",
    "health",
    "issueSyntheticSession",
    "sessionCommand",
    "sessionProjection",
  ].map(
    (name) =>
      `projects/ludys-12b-stg-20260725/locations/europe-north1/functions/${name}`,
  );
  const firestoreDatabase =
    "projects/ludys-12b-stg-20260725/databases/(default)";
  receipt.selectedProjectId = "ludys-12b-stg-20260725";
  receipt.selectedRegion = "europe-north1";
  receipt.deploymentMode = "DISABLED_FIRST";
  receipt.providerResourceIds = {
    googleProjectId: "ludys-12b-stg-20260725",
    googleProjectNumber: "134654966474",
    firestoreDatabase,
    functionIds,
    resourceIds: [
      "projects/ludys-12b-stg-20260725",
      firestoreDatabase,
      ...functionIds,
    ],
  };
  bindProviderConfirmation(
    receipt,
    "BEKREFT_WP13_12B_FIREBASE_PROJECT_AND_REGION_V1",
    [
      "projectId=ludys-12b-stg-20260725",
      "region=europe-north1",
    ],
  );
  return receipt;
}

const iamProofResults = [
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
] as const;

function authenticIamReceipt(): Record<string, unknown> {
  const receipt = authenticProviderReceipt(
    "IAM_AND_BILLING_RECEIPT",
    iamProofResults,
  );
  const deployPrincipal =
    "ludys-staging-deployer@ludys-12b-stg-20260725.iam.gserviceaccount.com";
  const runtimeServiceAccount =
    "ludys-staging-runtime@ludys-12b-stg-20260725.iam.gserviceaccount.com";
  const previewServiceAccount =
    "ludys-preview-invoker@ludys-12b-stg-20260725.iam.gserviceaccount.com";
  const budgetId =
    "billingAccounts/01CD9D-0900DF-4FB36A/budgets/bb8cd353-test";
  const capabilitySecret =
    "projects/134654966474/secrets/LUDYS_CAPABILITY_HMAC_KEY";
  const deploymentCommand =
    "gcloud functions deploy issueSyntheticSession "
    + `--impersonate-service-account=${deployPrincipal}`;
  const revocationEvidencePath = "artifacts/deploy-identity-revocation.json";
  receipt.commandsRun = [
    deploymentCommand,
    "gcloud auth list --filter=status:ACTIVE",
    "revoke temporary deploy identity bindings",
  ];
  receipt.artifactHashes = {
    "artifacts/provider-proof.json": "c".repeat(64),
    [revocationEvidencePath]: "d".repeat(64),
  };
  receipt.providerResourceIds = {
    googleProjectId: "ludys-12b-stg-20260725",
    billingAccount: "01CD9D-0900DF-4FB36A",
    budgetId,
    runtimeServiceAccount,
    previewServiceAccount,
    deployServiceAccount: deployPrincipal,
    capabilitySecret,
    resourceIds: [
      "projects/ludys-12b-stg-20260725",
      budgetId,
      runtimeServiceAccount,
      previewServiceAccount,
      deployPrincipal,
      capabilitySecret,
    ],
  };
  Object.assign(receipt, {
    billingAlertConfigured: true,
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
    impersonationStartedAt: "2026-07-27T10:00:00.000Z",
    impersonationExpiresAt: "2026-07-27T11:00:00.000Z",
    deploymentObservedAt: "2026-07-27T10:20:00.000Z",
    serviceAccountUserBindings: {
      role: "roles/iam.serviceAccountUser",
      member: `serviceAccount:${deployPrincipal}`,
      runtimeServiceAccount,
      buildServiceAccount:
        "134654966474-compute@developer.gserviceaccount.com",
      conditioned: true,
      windowMaxSeconds: 3600,
      revoked: true,
    },
    conditionedTokenCreatorBinding: {
      role: "roles/iam.serviceAccountTokenCreator",
      member: "user:tryakim@gmail.com",
      resource: deployPrincipal,
      conditioned: true,
      windowMaxSeconds: 3600,
      revoked: true,
    },
    deploymentCommands: [deploymentCommand],
    callerIdentityReadback: deployPrincipal,
    postDeployImpersonationRevoked: true,
    postDeployProjectRolesRevoked: true,
    postDeployRevocationEvidencePath: revocationEvidencePath,
    runtimeProjectRoles: [
      "roles/datastore.user",
      "roles/logging.logWriter",
    ],
    runtimeSecretRoles: ["roles/secretmanager.secretAccessor"],
    runtimeUserManagedKeyCount: 0,
    previewUserManagedKeyCount: 0,
    capabilitySecretRegion: "europe-north1",
    secretValuePrinted: false,
    secretValueWrittenToDisk: false,
    secretValueExposedToBrowser: false,
  });
  bindProviderConfirmation(
    receipt,
    "BEKREFT_WP13_12B_IAM_AND_BILLING_V1",
    [
      "projectId=ludys-12b-stg-20260725",
      "billingAccount=01CD9D-0900DF-4FB36A",
      "alertNok=400",
      "maximumNok=500",
      "expiry=2027-01-25",
      "expiryInstant=2027-01-25T00:00:00.000Z",
    ],
  );
  return receipt;
}

const previewProofResults = [
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
] as const;

function authenticPreviewReceipt(): Record<string, unknown> {
  const receipt = authenticProviderReceipt(
    "PROTECTED_PREVIEW_RECEIPT",
    previewProofResults,
  );
  const stagingUrl =
    "https://ludys-wp13-12b-staging-proof-abc123.vercel.app/";
  const deploymentId = "dpl_syntheticpreview123";
  const rollbackDeploymentId = "dpl_syntheticrollback123";
  const rollbackStagingUrl =
    "https://ludys-wp13-12b-safe-disabled-rollback.vercel.app/";
  const rollbackEvidencePath = "artifacts/rollback-provider-proof.json";
  const rollbackEvidenceSha256 = "d".repeat(64);
  const rollbackSourceCommit = "9".repeat(40);
  const rollbackSourceTree = "8".repeat(40);
  receipt.stagingUrl = stagingUrl;
  receipt.rollbackDeploymentId = rollbackDeploymentId;
  receipt.rollbackDeploymentBinding = {
    deploymentId: rollbackDeploymentId,
    stagingUrl: rollbackStagingUrl,
    sourceCommit: rollbackSourceCommit,
    sourceTree: rollbackSourceTree,
    safeDisabled: true,
    evidencePath: rollbackEvidencePath,
    evidenceSha256: rollbackEvidenceSha256,
  };
  (receipt.artifactHashes as Record<string, unknown>)[rollbackEvidencePath] =
    rollbackEvidenceSha256;
  receipt.providerResourceIds = {
    vercelTeamId: "team_1Gnn3VSNrP3mbseXx6a92a4J",
    vercelTeamSlug: "trym-s-projects",
    vercelProjectId: "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
    vercelProjectName: "ludys-wp13-12b-staging",
    deploymentId,
    deploymentUrl: stagingUrl,
    rollbackDeploymentId,
    rollbackDeploymentUrl: rollbackStagingUrl,
    resourceIds: [
      "team_1Gnn3VSNrP3mbseXx6a92a4J",
      "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
      deploymentId,
      stagingUrl,
      rollbackDeploymentId,
      rollbackStagingUrl,
    ],
  };
  Object.assign(receipt, {
    deploymentEnvironment: "preview",
    protectionMode: "prod_deployment_urls_and_all_previews",
    oidcIssuerMode: "team",
    webAnalyticsEnabled: false,
    speedInsightsEnabled: false,
    customDomains: [],
    productionDeployment: false,
    gitLinked: false,
    deploymentSourceCommit: receipt.sourceCommit,
    deploymentSourceTree: receipt.sourceTree,
    rollbackPlanReference:
      "release/wp13-12b/activation-handoff/rollback-plan.json",
    rollbackMode: "DELETE_PREVIEW_AND_KEEP_BACKEND_DISABLED",
  });
  bindProviderConfirmation(
    receipt,
    "BEKREFT_WP13_12B_PROTECTED_PREVIEW_V1",
    [
      "teamId=team_1Gnn3VSNrP3mbseXx6a92a4J",
      "projectId=prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
      `deploymentId=${deploymentId}`,
      `stagingUrl=${stagingUrl}`,
      `rollbackDeploymentId=${rollbackDeploymentId}`,
      `rollbackStagingUrl=${rollbackStagingUrl}`,
      `rollbackSourceCommit=${rollbackSourceCommit}`,
      `rollbackSourceTree=${rollbackSourceTree}`,
      `rollbackEvidenceSha256=${rollbackEvidenceSha256}`,
    ],
  );
  return receipt;
}

function ownerErrors(
  decision: unknown = ownerDecision,
  auth: unknown = authorization,
  sourceChecksum = "f3830a640fd901f193279ed99338d923848acaef662e79e8a831e870a7813de7",
  decisionChecksum = "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754",
) {
  return validateOwnerDecisionForWp13_12b({
    ownerDecision: decision,
    authorization: auth,
    actualSourcePackageChecksum: sourceChecksum,
    actualDecisionRecordChecksum: decisionChecksum,
    checksumManifestDecisionRecordChecksum: "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754",
  });
}

test("valid owner decision authorizes repository work without provider activation", () => {
  assert.deepEqual(ownerErrors(), []);
});

test("missing owner-decision record fails closed", () => {
  assert.match(ownerErrors(null).join(";"), /missing|invalid/);
});

test("wrong owner-decision checksum and source package checksum fail closed", () => {
  assert.match(ownerErrors(ownerDecision, authorization, "0".repeat(64)).join(";"), /source package checksum/);
  assert.match(ownerErrors(ownerDecision, authorization, undefined, "0".repeat(64)).join(";"), /decision record checksum/);
});

for (const decision of ["DEFER", "REJECT", "UNKNOWN"]) {
  test(`${decision} cannot authorize WP13.12B repository implementation`, () => {
    const changed = clone(ownerDecision);
    changed.decision = decision;
    assert.match(ownerErrors(changed).join(";"), /APPROVE_RECOMMENDED_SYNTHETIC_DEV/);
  });
}

test("incomplete decision, fabricated signature and wrong release binding fail closed", () => {
  const incomplete = clone(ownerDecision);
  delete incomplete.maximumMonthlyCost;
  assert.match(ownerErrors(incomplete).join(";"), /maximumMonthlyCost/);
  const signature = clone(ownerDecision);
  (signature.signatureOrExplicitOwnerConfirmation as Record<string, unknown>).signaturePresent = true;
  assert.match(ownerErrors(signature).join(";"), /fabricated signature/);
  const release = clone(ownerDecision);
  release.sourcePackageVersion = "13.12B";
  assert.match(ownerErrors(release).join(";"), /source package version/);
});

test("missing or contradictory owner conditions and automatic activation fail closed", () => {
  const conditions = clone(ownerDecision);
  conditions.conditions = [];
  assert.match(ownerErrors(conditions).join(";"), /owner condition missing/);
  const activated = clone(ownerDecision);
  (activated.effects as Record<string, unknown>).activatesProvider = true;
  assert.match(ownerErrors(activated).join(";"), /authorization ceiling/);
});

test("provider activation, cloud resources, B8, student beta and production fail closed", () => {
  for (const [field, value] of [
    ["providerActivation", "ACTIVE"],
    ["cloudResources", 1],
    ["b8", "APPROVED"],
    ["studentBeta", "AUTHORIZED"],
    ["production", "AUTHORIZED"],
  ] as const) {
    const changed = clone(authorization);
    changed[field] = value;
    assert.ok(ownerErrors(ownerDecision, changed).length > 0, field);
  }
});

test("valid staging repository contract preserves every scope ceiling", () => {
  assert.deepEqual(validateStagingRepositoryContract(contract), []);
});

for (const [field, value] of [
  ["providerActivation", "ACTIVE"],
  ["cloudResources", 1],
  ["firebaseAuthentication", true],
  ["stableUid", true],
  ["directClientWrite", true],
  ["providerIsolation", false],
  ["pureCoreProviderFree", false],
  ["firestoreRulesDenyByDefault", false],
  ["serverAuthoritativeHandler", false],
  ["capabilityBearerOnly", false],
  ["explicitDeletion", false],
  ["tombstone", false],
  ["ttlBackstopOnly", false],
  ["backupAndPitrEnabled", true],
  ["killSwitch", false],
  ["noResurrection", false],
  ["roleProjectionIsolation", false],
  ["syntheticDataOnly", false],
  ["runtimeAi", true],
  ["externalReceipts", 1],
  ["physicalTwoDeviceProof", true],
  ["b8", "APPROVED"],
  ["studentBeta", "AUTHORIZED"],
  ["production", "AUTHORIZED"],
  ["wp13_12c", "OPEN"],
] as const) {
  test(`staging validator rejects ${field}=${String(value)}`, () => {
    const changed = clone(contract);
    changed[field] = value;
    assert.ok(validateStagingRepositoryContract(changed).length > 0);
  });
}

test("staging validator rejects missing no-go rules", () => {
  const changed = clone(contract);
  changed.noGo = [];
  assert.match(validateStagingRepositoryContract(changed).join(";"), /no-go missing/);
});

test("unfilled receipt template is valid structure but never evidence", () => {
  const template = JSON.parse(readFileSync(
    "release/wp13-12b/receipts/templates/emulator_proof_receipt.json",
    "utf8",
  ));
  assert.deepEqual(validateReceipt(template), { valid: true, evidence: false, errors: [] });
});

test("authentic receipt is bound to its explicit source commit and tree rather than current HEAD", () => {
  const result = validateReceipt(actualEmulatorReceipt, {
    sourceCommit: "aea01ab61f49e6fa56160cf748ec3d3e1f7ced5a",
    sourceTree: "e431ae11d4ad1fa1d4dae0a95a0da35bd212e613",
    decisionRecordChecksum: "ae8c3b70cc7bc137463b08d8bb938bbbf3e42a55f48ae28cd0246a40fe8db6dc",
  });
  assert.deepEqual(result, { valid: true, evidence: true, errors: [] });
});

test("receipt rejects a wrong source tree and non-path artifact aliases", () => {
  const changed = clone(actualEmulatorReceipt);
  changed.sourceTree = "0".repeat(40);
  changed.artifactHashes = { proofAlias: "0".repeat(64) };
  const result = validateReceipt(changed, {
    sourceTree: "e431ae11d4ad1fa1d4dae0a95a0da35bd212e613",
    decisionRecordChecksum: "ae8c3b70cc7bc137463b08d8bb938bbbf3e42a55f48ae28cd0246a40fe8db6dc",
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(";"), /source tree|repository-relative/i);
});

test("filled receipt without signature, commands, hashes or provider ID is rejected", () => {
  const receipt = {
    receiptId: "receipt-1",
    receiptType: "FIREBASE_PROJECT_AND_REGION_RECEIPT",
    status: "COMPLETED_WITH_AUTHENTIC_EVIDENCE",
    createdAt: "2026-07-25T10:00:00.000Z",
    performedBy: "operator",
    environment: "SYNTHETIC_DEV",
    sourceCommit: "a".repeat(40),
    sourceTree: "b".repeat(40),
    decisionRecordChecksum: "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754",
    commandsRun: [],
    providerResourceIds: {},
    proofResults: {},
    artifactHashes: {},
    limitations: [],
    humanSignatureOrExplicitConfirmation: { confirmed: false },
    selectedRegion: "europe-north1",
  };
  const result = validateReceipt(receipt);
  assert.equal(result.valid, false);
  assert.equal(result.evidence, false);
  assert.match(result.errors.join(";"), /signature|commands|hashes|provider ID/i);
});

test("filled receipts require nonempty proofResults whose values are true", () => {
  const empty = authenticFirebaseReceipt();
  empty.proofResults = {};
  assert.match(
    validateReceipt(empty).errors.join(";"),
    /nonempty proofResults|proof result must be true/i,
  );

  const arbitrary = authenticFirebaseReceipt();
  (arbitrary.proofResults as Record<string, unknown>).unverified = "PASSED";
  assert.match(
    validateReceipt(arbitrary).errors.join(";"),
    /proof result must be true: unverified/i,
  );
});

test("Firebase receipt binds exact project, region, functions and disabled-first safety proof", () => {
  assert.deepEqual(
    validateReceipt(authenticFirebaseReceipt()),
    { valid: true, evidence: true, errors: [] },
  );
  for (const [mutate, expected] of [
    [
      (receipt: Record<string, unknown>) => {
        receipt.selectedProjectId = "wrong-project";
      },
      /project ID mismatch/i,
    ],
    [
      (receipt: Record<string, unknown>) => {
        receipt.deploymentMode = "ACTIVE_FIRST";
      },
      /disabled-first/i,
    ],
    [
      (receipt: Record<string, unknown>) => {
        const ids = receipt.providerResourceIds as Record<string, unknown>;
        (ids.functionIds as unknown[]).pop();
      },
      /five exact regional function IDs/i,
    ],
    [
      (receipt: Record<string, unknown>) => {
        (receipt.proofResults as Record<string, unknown>)
          .staging_control_absent_or_disabled = false;
      },
      /staging_control_absent_or_disabled/i,
    ],
  ] as const) {
    const changed = authenticFirebaseReceipt();
    mutate(changed);
    assert.match(validateReceipt(changed).errors.join(";"), expected);
  }
});

test("IAM and billing receipt binds 400/500 NOK, owner, expiry, quotas, roles, keys and secret", () => {
  assert.deepEqual(
    validateReceipt(authenticIamReceipt()),
    { valid: true, evidence: true, errors: [] },
  );
  for (const [field, value, expected] of [
    ["billingReviewer", "OTHER", /owner, reviewer or expiry/i],
    ["runtimeUserManagedKeyCount", 1, /keyless service accounts/i],
    ["capabilitySecretRegion", "us-central1", /secret boundary/i],
    ["deployIdentityUserManagedKeyCount", 1, /distinct, keyless/i],
    ["callerIdentityReadback", "tryakim@gmail.com", /caller identity/i],
    ["postDeployProjectRolesRevoked", false, /revocation evidence/i],
  ] as const) {
    const changed = authenticIamReceipt();
    changed[field] = value;
    assert.match(validateReceipt(changed).errors.join(";"), expected, field);
  }

  const tooLong = authenticIamReceipt();
  tooLong.impersonationExpiresAt = "2026-07-27T11:00:00.001Z";
  assert.match(validateReceipt(tooLong).errors.join(";"), /exceeds 60 minutes/i);

  const exactExpiryBoundary = authenticIamReceipt();
  exactExpiryBoundary.impersonationStartedAt = "2027-01-24T23:00:00.000Z";
  exactExpiryBoundary.impersonationExpiresAt = "2027-01-25T00:00:00.000Z";
  exactExpiryBoundary.deploymentObservedAt = "2027-01-24T23:59:59.999Z";
  assert.deepEqual(
    validateReceipt(exactExpiryBoundary),
    { valid: true, evidence: true, errors: [] },
  );

  const pastExpiryBoundary = authenticIamReceipt();
  pastExpiryBoundary.impersonationStartedAt = "2027-01-24T23:30:00.001Z";
  pastExpiryBoundary.impersonationExpiresAt = "2027-01-25T00:00:00.001Z";
  pastExpiryBoundary.deploymentObservedAt = "2027-01-24T23:45:00.000Z";
  assert.match(
    validateReceipt(pastExpiryBoundary).errors.join(";"),
    /impersonation window is invalid/i,
  );

  const unimpersonated = authenticIamReceipt();
  unimpersonated.deploymentCommands = ["gcloud functions deploy health"];
  assert.match(
    validateReceipt(unimpersonated).errors.join(";"),
    /deployment commands must all use exact impersonation/i,
  );
});

test("protected preview receipt binds exact protected non-production deployment and rollback", () => {
  assert.deepEqual(
    validateReceipt(authenticPreviewReceipt()),
    { valid: true, evidence: true, errors: [] },
  );
  for (const [field, value, expected] of [
    ["protectionMode", "preview", /protection or OIDC mode/i],
    ["webAnalyticsEnabled", true, /forbidden deployment feature/i],
    ["productionDeployment", true, /forbidden deployment feature/i],
    ["deploymentSourceCommit", "0".repeat(40), /commit-and-tree specific/i],
    ["rollbackMode", "NO_ROLLBACK", /rollback binding/i],
  ] as const) {
    const changed = authenticPreviewReceipt();
    changed[field] = value;
    assert.match(validateReceipt(changed).errors.join(";"), expected, field);
  }
});

test("provider receipt confirmation cannot be generic, reused or detached from evidence", () => {
  const reused = authenticPreviewReceipt();
  (reused.humanSignatureOrExplicitConfirmation as Record<string, unknown>)
    .confirmationText = (
      authenticFirebaseReceipt().humanSignatureOrExplicitConfirmation as Record<string, unknown>
    ).confirmationText;
  assert.match(
    validateReceipt(reused).errors.join(";"),
    /exact evidence-bound human confirmation/i,
  );

  const detached = authenticIamReceipt();
  detached.confirmationBindingSha256 = "f".repeat(64);
  assert.match(
    validateReceipt(detached).errors.join(";"),
    /confirmation evidence binding mismatch|exact evidence-bound/i,
  );
});

test("only exact v2 emulator challenge confirmation qualifies as challenge-bound", () => {
  assert.equal(isChallengeBoundEmulatorReceipt(actualEmulatorReceipt), false);
  const changed = clone(actualEmulatorReceipt);
  changed.schemaVersion = "wp13.12b-receipt-v2";
  const artifactPath = "artifacts/wp13-12b-actual-emulator-proof.json";
  const artifactSha256 = "1".repeat(64);
  const jarSha256 = "2".repeat(64);
  const nonce = "3".repeat(32);
  const commitS = "b7b0af2b679a98b0e61ef17e606a5183a1de6323";
  const commitSTree = "a86137594062e696a00a547c55827b8d95719d6d";
  const commitT = "568d9f9e306075a81f6e4b243d3812507f97b230";
  const commitTTree = "64911ea615a1814acb1d03a2bb244152dc1fdee2";
  const commitU = "190fff88808bbafe605cdde4cfe9fe943f4543a4";
  const commitUTree = "6a9634f4e096b736f4699a209f2152e4e083127d";
  const commitV = "2e38ce83c9b4cfd70f515a31610ddf23374631bd";
  const commitVTree = "eb183ef860ee9cc16ef1167e56ea2c8a2de96cc2";
  const proofToolCommit = String(changed.sourceCommit);
  const proofToolTree = String(changed.sourceTree);
  const commitW = proofToolCommit;
  const commitWTree = proofToolTree;
  const orderedCommitChain = [commitS, commitT, commitU, commitV, commitW];
  const proofToolCommitChain = [commitT, commitU, commitV, commitW];
  const proofRunnerSha256 = "4".repeat(64);
  const proofRunnerGitBlob = "8".repeat(40);
  const pinnedGitAdapterSha256 =
    "0242641775cbf43b3c3d09276c6462d7b97de24cc2f13a32bf52c7bc8ed0dfbf";
  const pinnedGitAdapterGitBlob =
    "a0c37fba2ab6625180bfa3691642acb38e86af29";
  const securityRemediationChangeSetSha256 =
    "983d11050f1f299096797aea9a9179882411b355ffffc14ec5c98323e4f3b402";
  const gitDiffCommandContract = {
    schemaVersion: "wp13.12b-pinned-git-diff-contract-v1",
    command: "git diff",
    arguments: [
      "--name-only",
      "--no-renames",
      "-z",
      commitT,
      commitU,
      "--",
    ],
    output: "UTF8_NUL_TERMINATED_REPOSITORY_RELATIVE_POSIX_PATHS",
    renameDetection: "DISABLED",
  };
  const previewSourceSetSha256 =
    "bf3ecfc58ae713bf91dd53f27b6ad5b9750a65b76bf5b73261526cae7db21d80";
  const ownerDecisionSha256 =
    "ae8c3b70cc7bc137463b08d8bb938bbbf3e42a55f48ae28cd0246a40fe8db6dc";
  const providerPackageSha256 = "5".repeat(64);
  const providerLockSha256 = "8".repeat(64);
  const providerSbomSha256 = "9".repeat(64);
  const providerAuditSha256 = "a".repeat(64);
  const providerSecurityRemediationSha256 = "b".repeat(64);
  const resolvedFastUriVersion = "3.1.5";
  const advisory = "GHSA-7p8r-x3mc-p8w7";
  const activationPackageSha256 = "6".repeat(64);
  const receiptContractSha256 = "7".repeat(64);
  const generatedAt = "2026-07-30T10:00:00.000Z";
  const expiresAt = "2026-07-30T10:30:00.000Z";
  const confirmedAt = "2026-07-30T10:10:00.000Z";
  changed.receiptId =
    `wp13-12b-emulator-proof-${proofToolCommit.slice(0, 12)}-`
    + `${nonce.slice(0, 12)}-v2`;
  changed.createdAt = confirmedAt;
  changed.expectedSourceCommit = proofToolCommit;
  changed.evidenceAnchorCommit = commitS;
  changed.evidenceAnchorTree = commitSTree;
  changed.commitT = commitT;
  changed.commitTTree = commitTTree;
  changed.commitU = commitU;
  changed.commitUTree = commitUTree;
  changed.commitV = commitV;
  changed.commitVTree = commitVTree;
  changed.commitW = commitW;
  changed.commitWTree = commitWTree;
  changed.orderedCommitChain = [...orderedCommitChain];
  changed.proofOriginCommit = commitV;
  changed.proofOriginTree = commitVTree;
  changed.proofToolCommit = proofToolCommit;
  changed.proofToolTree = proofToolTree;
  changed.proofToolCommitChain = [...proofToolCommitChain];
  changed.securityRemediationCommit = commitU;
  changed.securityRemediationTree = commitUTree;
  changed.providerSecurityRemediationCommit = commitU;
  changed.providerPackageCommit = commitU;
  changed.providerPackageLockCommit = commitU;
  changed.providerSbomCommit = commitU;
  changed.providerAuditCommit = commitU;
  changed.decisionRecordChecksum = ownerDecisionSha256;
  changed.commandsRun = [
    "firebase setup:emulators:firestore",
    "firebase emulators:exec --only firestore,functions --project demo-ludys-wp13-12b",
  ];
  changed.proofResults = trueProofResults(REQUIRED_EMULATOR_PROOF_RESULTS);
  changed.machineEnvironment = {
    operatingSystem: "win32 10.0.26200 x64",
    node: "v24.18.0",
    java: "openjdk version 21.0.12",
    firebaseCli: "15.22.4",
    firestoreEmulator: "1.21.0",
    demoProjectId: "demo-ludys-wp13-12b",
  };
  changed.firebaseCliVersion = "15.22.4";
  changed.emulatorArtifact = {
    filename: "cloud-firestore-emulator-v1.21.0.jar",
    version: "1.21.0",
    bytes: 138093843,
    sha256: jarSha256,
    downloadMethod: "firebase setup:emulators:firestore",
  };
  changed.artifactHashes = {
    [artifactPath]: artifactSha256,
    "release/wp13-12b/external-activation/owner-authorization.json":
      ownerDecisionSha256,
    "artifacts/wp13-12b-provider-package.json": providerPackageSha256,
    "provider/firebase/functions/package-lock.json": providerLockSha256,
    "release/wp13-12b/provider-sbom.cdx.json": providerSbomSha256,
    "release/wp13-12b/provider-audit.json": providerAuditSha256,
    "release/wp13-12b/provider-security-remediation.json":
      providerSecurityRemediationSha256,
    "release/wp13-12b/external-activation/artifact-checksums.sha256":
      activationPackageSha256,
    "release/wp13-12b/activation-handoff/receipt-contracts.json":
      receiptContractSha256,
    "scripts/run-wp13-12b-emulator-proof.mjs": proofRunnerSha256,
  };
  changed.emulatorProofBinding = {
    schemaVersion: "wp13.12b-emulator-proof-binding-v2",
    artifactPath,
    artifactSha256,
    proofSha256: artifactSha256,
    nonce,
    purpose: "WP13_12B_PR3_LOCAL_EMULATOR_PROOF_ONLY",
    jarSha256,
    demoProjectId: "demo-ludys-wp13-12b",
    sourceCommit: proofToolCommit,
    sourceTree: proofToolTree,
    commitS,
    commitSTree,
    commitT,
    commitTTree,
    commitU,
    commitUTree,
    commitV,
    commitVTree,
    commitW,
    commitWTree,
    orderedCommitChain: [...orderedCommitChain],
    proofOriginCommit: commitV,
    proofOriginTree: commitVTree,
    proofToolCommit,
    proofToolTree,
    proofToolCommitChain: [...proofToolCommitChain],
    securityRemediationCommit: commitU,
    securityRemediationTree: commitUTree,
    providerSecurityRemediationCommit: commitU,
    providerPackageCommit: commitU,
    providerPackageLockCommit: commitU,
    providerSbomCommit: commitU,
    providerAuditCommit: commitU,
    proofRunnerSha256,
    proofRunnerGitBlob,
    pinnedGitAdapterSha256,
    pinnedGitAdapterGitBlob,
    securityRemediationChangeSetSha256,
    gitDiffCommandContract: {
      ...gitDiffCommandContract,
      arguments: [...gitDiffCommandContract.arguments],
    },
    previewSourceSetSha256,
    ownerDecisionSha256,
    providerPackageSha256,
    providerLockSha256,
    providerSbomSha256,
    providerAuditSha256,
    providerSecurityRemediationSha256,
    resolvedFastUriVersion,
    advisory,
    activationPackageSha256,
    receiptContractSha256,
    generatedAt,
    expiresAt,
    cloudResourceCount: 7,
    deploymentCount: 0,
    validatedReceiptCount: 0,
  };
  changed.nonceRecord = {
    schemaVersion: "wp13.12b-emulator-proof-challenge-v2",
    generation: 1,
    nonce,
    purpose: "WP13_12B_PR3_LOCAL_EMULATOR_PROOF_ONLY",
    generatedAt,
    expiresAt,
    status: "CONFIRMED_CONSUMED",
    consumedAt: confirmedAt,
    cloudResourceCount: 7,
    deploymentCount: 0,
    validatedReceiptCount: 0,
    commitS,
    commitSTree,
    commitT,
    commitTTree,
    commitU,
    commitUTree,
    commitV,
    commitVTree,
    commitW,
    commitWTree,
    orderedCommitChain: [...orderedCommitChain],
    proofOriginCommit: commitV,
    proofOriginTree: commitVTree,
    proofToolCommitChain: [...proofToolCommitChain],
    proofToolCommit,
    proofToolTree,
    securityRemediationCommit: commitU,
    securityRemediationTree: commitUTree,
    providerSecurityRemediationCommit: commitU,
    providerPackageCommit: commitU,
    providerPackageLockCommit: commitU,
    providerSbomCommit: commitU,
    providerAuditCommit: commitU,
    proofRunnerSha256,
    proofRunnerGitBlob,
    pinnedGitAdapterSha256,
    pinnedGitAdapterGitBlob,
    securityRemediationChangeSetSha256,
    gitDiffCommandContract: {
      ...gitDiffCommandContract,
      arguments: [...gitDiffCommandContract.arguments],
    },
    previewSourceSetSha256,
    freshEmulatorProofSha256: artifactSha256,
    ownerDecisionSha256,
    providerPackageSha256,
    providerLockSha256,
    providerSbomSha256,
    providerAuditSha256,
    providerSecurityRemediationSha256,
    resolvedFastUriVersion,
    advisory,
    activationPackageSha256,
    receiptContractSha256,
  };
  const confirmation =
    changed.humanSignatureOrExplicitConfirmation as Record<string, unknown>;
  confirmation.confirmed = true;
  confirmation.confirmedAt = confirmedAt;
  confirmation.confirmationText = [
      "BEKREFT_WP13_12B_V2_NONCE",
      `nonce=${nonce}`,
      `commitS=${commitS}`,
      `commitSTree=${commitSTree}`,
      `commitT=${commitT}`,
      `commitTTree=${commitTTree}`,
      `commitU=${commitU}`,
      `commitUTree=${commitUTree}`,
      `commitV=${commitV}`,
      `commitVTree=${commitVTree}`,
      `commitW=${commitW}`,
      `commitWTree=${commitWTree}`,
      `orderedCommitChain=${orderedCommitChain.join(",")}`,
      `proofOriginCommit=${commitV}`,
      `proofOriginTree=${commitVTree}`,
      `proofToolCommitChain=${proofToolCommitChain.join(",")}`,
      `proofToolCommit=${proofToolCommit}`,
      `proofToolTree=${proofToolTree}`,
      `securityRemediationCommit=${commitU}`,
      `securityRemediationTree=${commitUTree}`,
      `providerSecurityRemediationCommit=${commitU}`,
      `providerPackageCommit=${commitU}`,
      `providerPackageLockCommit=${commitU}`,
      `providerSbomCommit=${commitU}`,
      `providerAuditCommit=${commitU}`,
      `proofRunnerSha256=${proofRunnerSha256}`,
      `proofRunnerGitBlob=${proofRunnerGitBlob}`,
      `pinnedGitAdapterSha256=${pinnedGitAdapterSha256}`,
      `pinnedGitAdapterGitBlob=${pinnedGitAdapterGitBlob}`,
      `securityRemediationChangeSetSha256=${securityRemediationChangeSetSha256}`,
      `previewSourceSetSha256=${previewSourceSetSha256}`,
      `freshEmulatorProofSha256=${artifactSha256}`,
      `ownerDecisionSha256=${ownerDecisionSha256}`,
      `providerSecurityRemediationSha256=${providerSecurityRemediationSha256}`,
      `providerPackageSha256=${providerPackageSha256}`,
      `providerLockSha256=${providerLockSha256}`,
      `providerSbomSha256=${providerSbomSha256}`,
      `providerAuditSha256=${providerAuditSha256}`,
      `resolvedFastUriVersion=${resolvedFastUriVersion}`,
      `advisory=${advisory}`,
      `activationPackageSha256=${activationPackageSha256}`,
      `receiptContractSha256=${receiptContractSha256}`,
      `generatedAt=${generatedAt}`,
      `expiresAt=${expiresAt}`,
      "cloudResourceCount=7",
      "deploymentCount=0",
      "validatedReceiptCount=0",
      "purpose=WP13_12B_PR3_LOCAL_EMULATOR_PROOF_ONLY",
      `jarSha256=${jarSha256}`,
      "demoProjectId=demo-ludys-wp13-12b",
    ].join("; ");
  assert.equal(
    (changed.nonceRecord as Record<string, unknown>).proofToolCommit,
    proofToolCommit,
  );
  assert.equal(
    (changed.nonceRecord as Record<string, unknown>).proofToolTree,
    proofToolTree,
  );
  assert.equal(isChallengeBoundEmulatorReceipt(changed), true);
  assert.deepEqual(validateReceipt(changed, {
    decisionRecordChecksum: ownerDecisionSha256,
  }), { valid: true, evidence: true, errors: [] });

  for (const [label, mutate] of [
    ["confirmation whitespace", (receipt: Record<string, unknown>) => {
      const value =
        receipt.humanSignatureOrExplicitConfirmation as Record<string, unknown>;
      value.confirmationText = `${String(value.confirmationText)} `;
    }],
    ["tool commit", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .proofToolCommit = "f".repeat(40);
    }],
    ["wrong commit T", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .commitT = "f".repeat(40);
    }],
    ["wrong commit U", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .commitU = "f".repeat(40);
    }],
    ["wrong commit V", (receipt: Record<string, unknown>) => {
      receipt.commitV = "f".repeat(40);
    }],
    ["binding immutable commit V", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>).commitV =
        commitW;
    }],
    ["binding commit W differs from source", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>).commitW =
        commitV;
    }],
    ["wrong top-level commit W", (receipt: Record<string, unknown>) => {
      receipt.commitW = "f".repeat(40);
    }],
    ["proof origin points at W", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .proofOriginCommit = commitW;
    }],
    ["proof tool points at V", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .proofToolCommit = commitV;
    }],
    ["invalid runner Git blob", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .proofRunnerGitBlob = "not-a-git-object";
    }],
    ["nonce runner Git blob mismatch", (receipt: Record<string, unknown>) => {
      (receipt.nonceRecord as Record<string, unknown>)
        .proofRunnerGitBlob = "9".repeat(40);
    }],
    ["binding pinned adapter SHA mismatch", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .pinnedGitAdapterSha256 = "f".repeat(64);
    }],
    ["binding pinned adapter blob mismatch", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .pinnedGitAdapterGitBlob = "f".repeat(40);
    }],
    ["nonce pinned adapter SHA mismatch", (receipt: Record<string, unknown>) => {
      (receipt.nonceRecord as Record<string, unknown>)
        .pinnedGitAdapterSha256 = "f".repeat(64);
    }],
    ["nonce pinned adapter blob mismatch", (receipt: Record<string, unknown>) => {
      (receipt.nonceRecord as Record<string, unknown>)
        .pinnedGitAdapterGitBlob = "f".repeat(40);
    }],
    ["binding security change-set mismatch", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .securityRemediationChangeSetSha256 = "f".repeat(64);
    }],
    ["nonce security change-set mismatch", (receipt: Record<string, unknown>) => {
      (receipt.nonceRecord as Record<string, unknown>)
        .securityRemediationChangeSetSha256 = "f".repeat(64);
    }],
    ["binding Git diff command mismatch", (receipt: Record<string, unknown>) => {
      const binding = receipt.emulatorProofBinding as Record<string, unknown>;
      (binding.gitDiffCommandContract as Record<string, unknown>).command =
        "git status";
    }],
    ["binding Git diff arguments mismatch", (receipt: Record<string, unknown>) => {
      const binding = receipt.emulatorProofBinding as Record<string, unknown>;
      const contract = binding.gitDiffCommandContract as Record<string, unknown>;
      (contract.arguments as unknown[])[0] = "--name-status";
    }],
    ["binding Git diff contract extra field", (receipt: Record<string, unknown>) => {
      const binding = receipt.emulatorProofBinding as Record<string, unknown>;
      (binding.gitDiffCommandContract as Record<string, unknown>).extra = true;
    }],
    ["nonce Git diff missing delimiter", (receipt: Record<string, unknown>) => {
      const nonceValue = receipt.nonceRecord as Record<string, unknown>;
      const contract = nonceValue.gitDiffCommandContract as Record<string, unknown>;
      (contract.arguments as unknown[]).pop();
    }],
    ["nonce Git diff output mismatch", (receipt: Record<string, unknown>) => {
      const nonceValue = receipt.nonceRecord as Record<string, unknown>;
      (nonceValue.gitDiffCommandContract as Record<string, unknown>).output =
        "LINES";
    }],
    ["nonce Git diff rename mode mismatch", (receipt: Record<string, unknown>) => {
      const nonceValue = receipt.nonceRecord as Record<string, unknown>;
      (nonceValue.gitDiffCommandContract as Record<string, unknown>)
        .renameDetection = "ENABLED";
    }],
    ["wrong commit T tree", (receipt: Record<string, unknown>) => {
      receipt.commitTTree = "f".repeat(40);
    }],
    ["reordered binding chain", (receipt: Record<string, unknown>) => {
      ((receipt.emulatorProofBinding as Record<string, unknown>)
        .proofToolCommitChain as unknown[]).reverse();
    }],
    ["reordered ordered chain", (receipt: Record<string, unknown>) => {
      ((receipt.emulatorProofBinding as Record<string, unknown>)
        .orderedCommitChain as unknown[]).reverse();
    }],
    ["missing receipt chain member", (receipt: Record<string, unknown>) => {
      (receipt.proofToolCommitChain as unknown[]).pop();
    }],
    ["reordered nonce chain", (receipt: Record<string, unknown>) => {
      ((receipt.nonceRecord as Record<string, unknown>)
        .proofToolCommitChain as unknown[]).reverse();
    }],
    ["nonce tool commit mismatch", (receipt: Record<string, unknown>) => {
      (receipt.nonceRecord as Record<string, unknown>).proofToolCommit =
        "f".repeat(40);
    }],
    ["nonce tool tree mismatch", (receipt: Record<string, unknown>) => {
      (receipt.nonceRecord as Record<string, unknown>).proofToolTree =
        "f".repeat(40);
    }],
    ["missing nonce V", (receipt: Record<string, unknown>) => {
      delete (receipt.nonceRecord as Record<string, unknown>).commitV;
    }],
    ["missing nonce W", (receipt: Record<string, unknown>) => {
      delete (receipt.nonceRecord as Record<string, unknown>).commitW;
    }],
    ["nonce W tree mismatch", (receipt: Record<string, unknown>) => {
      (receipt.nonceRecord as Record<string, unknown>).commitWTree =
        "f".repeat(40);
    }],
    ["provider lock hash", (receipt: Record<string, unknown>) => {
      (receipt.nonceRecord as Record<string, unknown>).providerLockSha256 =
        "f".repeat(64);
    }],
    ["fast-uri version", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .resolvedFastUriVersion = "3.1.4";
    }],
    ["advisory", (receipt: Record<string, unknown>) => {
      (receipt.emulatorProofBinding as Record<string, unknown>)
        .advisory = "GHSA-wrong";
    }],
    ["anchor tree", (receipt: Record<string, unknown>) => {
      receipt.evidenceAnchorTree = "f".repeat(40);
    }],
    ["runner artifact hash", (receipt: Record<string, unknown>) => {
      (receipt.artifactHashes as Record<string, unknown>)[
        "scripts/run-wp13-12b-emulator-proof.mjs"
      ] = "f".repeat(64);
    }],
    ["nonce expiry", (receipt: Record<string, unknown>) => {
      (receipt.nonceRecord as Record<string, unknown>).expiresAt =
        "2026-07-30T10:05:00.000Z";
    }],
    ["confirmation after expiry", (receipt: Record<string, unknown>) => {
      const late = "2026-07-30T10:31:00.000Z";
      receipt.createdAt = late;
      (receipt.humanSignatureOrExplicitConfirmation as Record<string, unknown>)
        .confirmedAt = late;
      (receipt.nonceRecord as Record<string, unknown>).consumedAt = late;
    }],
    ["nonce count", (receipt: Record<string, unknown>) => {
      (receipt.nonceRecord as Record<string, unknown>).cloudResourceCount = 8;
    }],
    ["missing proof result", (receipt: Record<string, unknown>) => {
      delete (receipt.proofResults as Record<string, unknown>).firestore_emulator;
    }],
    ["extra proof result", (receipt: Record<string, unknown>) => {
      (receipt.proofResults as Record<string, unknown>).generic_proof_0 = true;
    }],
    ["generic proof result set", (receipt: Record<string, unknown>) => {
      receipt.proofResults = Object.fromEntries(
        REQUIRED_EMULATOR_PROOF_RESULTS.map(
          (_, index) => [`proof_${index}`, true],
        ),
      );
    }],
  ] as const) {
    const invalidProofSet = clone(changed);
    mutate(invalidProofSet);
    assert.equal(
      isChallengeBoundEmulatorReceipt(invalidProofSet),
      false,
      label,
    );
    assert.match(validateReceipt(invalidProofSet, {
      decisionRecordChecksum: ownerDecisionSha256,
    }).errors.join(";"), /exact PR3 challenge/i, label);
  }
});

test("receipt bound to wrong commit or claiming physical proof without devices is rejected", () => {
  const receipt = {
    receiptId: "physical-1",
    receiptType: "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
    status: "COMPLETED_WITH_AUTHENTIC_EVIDENCE",
    createdAt: "2026-07-25T10:00:00.000Z",
    performedBy: "operator",
    environment: "SYNTHETIC_DEV",
    sourceCommit: "a".repeat(40),
    expectedSourceCommit: "b".repeat(40),
    sourceTree: "c".repeat(40),
    decisionRecordChecksum: "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754",
    commandsRun: ["physical proof steps"],
    providerResourceIds: { preview: "preview-id" },
    proofResults: { stop: true },
    artifactHashes: { proof: "d".repeat(64) },
    limitations: [],
    humanSignatureOrExplicitConfirmation: { confirmed: true },
    physicalProof: true,
    devices: [],
    checksum: "e".repeat(64),
    stagingUrl: "https://synthetic.invalid",
    sessionFixture: "synthetic-only",
    stepResults: [],
    containsPersonData: false,
  };
  const result = validateReceipt(receipt, {
    sourceCommit: "b".repeat(40),
    providerIdRequired: true,
    physicalDeviceProof: true,
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(";"), /wrong|device|two physical/i);
});

test("complete physical receipt requires two distinct CHILD and ADULT devices and safety proof", () => {
  assert.deepEqual(
    validateReceipt(authenticPhysicalReceipt(), { physicalDeviceProof: true }),
    { valid: true, evidence: true, errors: [] },
  );
});

test("physical proof binds a distinct deletion session and each exact step scope", () => {
  const reusedSession = authenticPhysicalReceipt();
  reusedSession.deletionSyntheticSessionId = reusedSession.syntheticSessionId;
  assert.match(
    validateReceipt(reusedSession).errors.join(";"),
    /second, exact and distinct deletion synthetic session ID/i,
  );

  const wrongSessionStep = authenticPhysicalReceipt();
  const wrongSessionSteps =
    wrongSessionStep.stepResults as Record<string, unknown>[];
  assert.ok(wrongSessionSteps[18]);
  wrongSessionSteps[18].syntheticSessionId = wrongSessionStep.syntheticSessionId;
  assert.match(
    validateReceipt(wrongSessionStep).errors.join(";"),
    /step 19 must bind its exact session and deployment/i,
  );

  const wrongRollbackStep = authenticPhysicalReceipt();
  const wrongRollbackSteps =
    wrongRollbackStep.stepResults as Record<string, unknown>[];
  assert.ok(wrongRollbackSteps[24]);
  wrongRollbackSteps[24].deploymentId = wrongRollbackStep.deploymentId;
  assert.match(
    validateReceipt(wrongRollbackStep).errors.join(";"),
    /step 25 must bind its exact session and deployment/i,
  );
});

test("physical proof binds a distinct known-valid rollback deployment and evidence", () => {
  const reusedDeployment = authenticPhysicalReceipt();
  reusedDeployment.rollbackDeploymentId = reusedDeployment.deploymentId;
  assert.match(
    validateReceipt(reusedDeployment).errors.join(";"),
    /distinct, protected, source-bound and safe-disabled rollback deployment/i,
  );

  const detachedEvidence = authenticPhysicalReceipt();
  const rollback =
    detachedEvidence.rollbackDeploymentBinding as Record<string, unknown>;
  rollback.evidenceSha256 = "f".repeat(64);
  assert.match(
    validateReceipt(detachedEvidence).errors.join(";"),
    /hash-bind the known-valid rollback deployment evidence/i,
  );
});

test("physical PR3 families require exact protected-preview receipt and evidence binding", () => {
  const preview = authenticPreviewReceipt();
  const physical = authenticPhysicalReceipt();
  const physicalFamilies = [
    "PHYSICAL_TWO_DEVICE",
    "STOP_DELETION_NO_RESURRECTION",
    "KILL_SWITCH",
    "ROLLBACK_TO_SAFE_DISABLED_STATE",
  ] as const;
  const derived = derivePr3ProofFamiliesFromValidatedReceipts([
    preview,
    physical,
  ]);
  assert.equal(derived.includes("PROTECTED_PREVIEW"), true);
  for (const family of physicalFamilies) {
    assert.equal(derived.includes(family), true, family);
  }

  const rebindPreviewConfirmation = (
    receipt: Record<string, unknown>,
  ): void => {
    const ids = receipt.providerResourceIds as Record<string, unknown>;
    const rollback =
      receipt.rollbackDeploymentBinding as Record<string, unknown>;
    ids.resourceIds = [
      "team_1Gnn3VSNrP3mbseXx6a92a4J",
      "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
      String(ids.deploymentId),
      String(receipt.stagingUrl),
      String(ids.rollbackDeploymentId),
      String(rollback.stagingUrl),
    ];
    bindProviderConfirmation(
      receipt,
      "BEKREFT_WP13_12B_PROTECTED_PREVIEW_V1",
      [
        "teamId=team_1Gnn3VSNrP3mbseXx6a92a4J",
        "projectId=prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
        `deploymentId=${String(ids.deploymentId)}`,
        `stagingUrl=${String(receipt.stagingUrl)}`,
        `rollbackDeploymentId=${String(receipt.rollbackDeploymentId)}`,
        `rollbackStagingUrl=${String(rollback.stagingUrl)}`,
        `rollbackSourceCommit=${String(rollback.sourceCommit)}`,
        `rollbackSourceTree=${String(rollback.sourceTree)}`,
        `rollbackEvidenceSha256=${String(rollback.evidenceSha256)}`,
      ],
    );
  };
  const mismatches: readonly ((
    receipt: Record<string, unknown>,
  ) => void)[] = [
    (receipt) => {
      const ids = receipt.providerResourceIds as Record<string, unknown>;
      ids.deploymentId = "dpl_otherpreview123";
    },
    (receipt) => {
      const stagingUrl =
        "https://ludys-wp13-12b-staging-proof-other.vercel.app/";
      receipt.stagingUrl = stagingUrl;
      (receipt.providerResourceIds as Record<string, unknown>).deploymentUrl =
        stagingUrl;
    },
    (receipt) => {
      receipt.sourceCommit = "d".repeat(40);
      receipt.expectedSourceCommit = receipt.sourceCommit;
      receipt.deploymentSourceCommit = receipt.sourceCommit;
    },
    (receipt) => {
      receipt.sourceTree = "e".repeat(40);
      receipt.deploymentSourceTree = receipt.sourceTree;
    },
    (receipt) => {
      receipt.receiptId = "receipt-protected_preview_receipt-other";
    },
    (receipt) => {
      const evidencePath = "artifacts/provider-proof-other.json";
      const evidenceSha256 = "d".repeat(64);
      receipt.confirmationEvidencePath = evidencePath;
      receipt.confirmationBindingSha256 = evidenceSha256;
      (receipt.artifactHashes as Record<string, unknown>)[evidencePath] =
        evidenceSha256;
    },
    (receipt) => {
      const ids = receipt.providerResourceIds as Record<string, unknown>;
      const rollback =
        receipt.rollbackDeploymentBinding as Record<string, unknown>;
      const rollbackDeploymentId = "dpl_syntheticrollbackother123";
      receipt.rollbackDeploymentId = rollbackDeploymentId;
      ids.rollbackDeploymentId = rollbackDeploymentId;
      rollback.deploymentId = rollbackDeploymentId;
    },
    (receipt) => {
      const ids = receipt.providerResourceIds as Record<string, unknown>;
      const rollback =
        receipt.rollbackDeploymentBinding as Record<string, unknown>;
      const rollbackStagingUrl =
        "https://ludys-wp13-12b-safe-disabled-other.vercel.app/";
      ids.rollbackDeploymentUrl = rollbackStagingUrl;
      rollback.stagingUrl = rollbackStagingUrl;
    },
    (receipt) => {
      const rollback =
        receipt.rollbackDeploymentBinding as Record<string, unknown>;
      rollback.sourceCommit = "7".repeat(40);
    },
    (receipt) => {
      const rollback =
        receipt.rollbackDeploymentBinding as Record<string, unknown>;
      rollback.sourceTree = "6".repeat(40);
    },
    (receipt) => {
      const rollback =
        receipt.rollbackDeploymentBinding as Record<string, unknown>;
      const evidencePath = "artifacts/rollback-provider-proof-other.json";
      const evidenceSha256 = "5".repeat(64);
      rollback.evidencePath = evidencePath;
      rollback.evidenceSha256 = evidenceSha256;
      (receipt.artifactHashes as Record<string, unknown>)[evidencePath] =
        evidenceSha256;
    },
  ];
  for (const mutate of mismatches) {
    const mismatchedPreview = authenticPreviewReceipt();
    mutate(mismatchedPreview);
    rebindPreviewConfirmation(mismatchedPreview);
    assert.deepEqual(
      validateReceipt(mismatchedPreview),
      { valid: true, evidence: true, errors: [] },
    );
    const mismatchedFamilies = derivePr3ProofFamiliesFromValidatedReceipts([
      mismatchedPreview,
      physical,
    ]);
    assert.equal(mismatchedFamilies.includes("PROTECTED_PREVIEW"), true);
    for (const family of physicalFamilies) {
      assert.equal(mismatchedFamilies.includes(family), false, family);
    }
  }
});

test("physical handoff template documents the exact 27-step proof sequence", () => {
  const template = JSON.parse(readFileSync(
    "release/wp13-12b/activation-handoff/physical-two-device-proof-template.json",
    "utf8",
  )) as Record<string, unknown>;
  const steps = template.steps as Record<string, unknown>[];
  assert.deepEqual(
    steps.map((step) => step.stepId),
    REQUIRED_PHYSICAL_STEP_IDS,
  );
  assert.equal(template.adultOperatorsOnly, false);
  assert.equal(template.participantsPresent, false);
  assert.equal(template.physicallySeparateDevicesConfirmed, false);
  assert.equal(template.syntheticSessionId, "");
  assert.equal(template.deletionSyntheticSessionId, "");
  assert.equal(template.rollbackDeploymentId, "");
  assert.match(
    String(template.stepResultBinding),
    /Steps 1-18.*19-27.*1-24.*25-27/i,
  );
});

test("physical receipt rejects empty device shells, duplicate roles and indistinguishable records", () => {
  const emptyShell = authenticPhysicalReceipt();
  const [emptyDevice] = emptyShell.devices as Record<string, unknown>[];
  assert.ok(emptyDevice);
  emptyDevice.deviceType = "";
  emptyDevice.operatingSystem = "";
  emptyDevice.browser = "";
  emptyDevice.networkEvidence = "";
  emptyDevice.observedAt = "";
  assert.match(
    validateReceipt(emptyShell).errors.join(";"),
    /deviceType|operatingSystem|browser|network evidence|observedAt/i,
  );

  const duplicateRole = authenticPhysicalReceipt();
  const duplicateRoleDevices = duplicateRole.devices as Record<string, unknown>[];
  assert.ok(duplicateRoleDevices[1]);
  duplicateRoleDevices[1].role = "CHILD";
  assert.match(
    validateReceipt(duplicateRole).errors.join(";"),
    /role must be unique|one CHILD and one ADULT/i,
  );

  const indistinguishable = authenticPhysicalReceipt();
  const indistinguishableDevices = indistinguishable.devices as Record<string, unknown>[];
  assert.ok(indistinguishableDevices[0]);
  indistinguishableDevices[1] = {
    ...clone(indistinguishableDevices[0]),
    role: "ADULT",
  };
  assert.match(
    validateReceipt(indistinguishable).errors.join(";"),
    /two distinct ephemeral deviceEvidenceId/i,
  );
});

test("physical device distinctness uses ephemeral evidence IDs, never timestamps", () => {
  const changed = authenticPhysicalReceipt();
  const devices = changed.devices as Record<string, unknown>[];
  assert.ok(devices[0]);
  assert.ok(devices[1]);
  devices[1].deviceEvidenceId = devices[0].deviceEvidenceId;
  devices[1].observedAt = "2026-07-27T10:55:55.000Z";
  assert.match(
    validateReceipt(changed).errors.join(";"),
    /two distinct ephemeral deviceEvidenceId/i,
  );
});

test("physical devices bind one session/deployment and never record capability values", () => {
  for (const [field, value, expected] of [
    ["syntheticSessionId", "synthetic-wp13-12b-otherabcdefghijkl", /shared syntheticSessionId/i],
    ["deploymentId", "dpl_otherpreview123", /shared deploymentId/i],
    ["capabilityPresent", false, /capabilityPresent=true/i],
    ["capabilityValueRecorded", true, /capabilityValueRecorded=false/i],
  ] as const) {
    const changed = authenticPhysicalReceipt();
    const devices = changed.devices as Record<string, unknown>[];
    assert.ok(devices[1]);
    devices[1][field] = value;
    assert.match(validateReceipt(changed).errors.join(";"), expected, field);
  }

  for (const [field, value, expected] of [
    ["stagingUrl", "https://other-preview.vercel.app/", /active staging URL/i],
    ["sourceCommit", "f".repeat(40), /source commit and tree/i],
    ["sourceTree", "e".repeat(40), /source commit and tree/i],
  ] as const) {
    const changed = authenticPhysicalReceipt();
    const devices = changed.devices as Record<string, unknown>[];
    assert.ok(devices[0]);
    devices[0][field] = value;
    assert.match(validateReceipt(changed).errors.join(";"), expected, field);
  }
});

test("physical receipt rejects a hollow checksum, fixture, preview, steps or confirmation", () => {
  const mutations: readonly [
    field: string,
    value: unknown,
    expectedError: RegExp,
  ][] = [
    ["checksum", "", /hash-bound physical evidence/i],
    ["checksum", "not-a-checksum", /hash-bound physical evidence/i],
    ["sessionFixture", "synthetic-only", /exact synthetic-wp13-12b-only fixture/i],
    ["stagingUrl", "http://ludys-preview.vercel.app", /protected HTTPS Vercel preview/i],
    ["stagingUrl", "https://synthetic.invalid", /protected HTTPS Vercel preview/i],
    ["stepResults", [], /all 27 documented step IDs/i],
  ];
  for (const [field, value, expectedError] of mutations) {
    const changed = authenticPhysicalReceipt();
    changed[field] = value;
    assert.match(validateReceipt(changed).errors.join(";"), expectedError, field);
  }

  const confirmation = authenticPhysicalReceipt();
  (confirmation.humanSignatureOrExplicitConfirmation as Record<string, unknown>)
    .confirmationText = "";
  assert.match(
    validateReceipt(confirmation).errors.join(";"),
    /exact evidence-bound human confirmation/i,
  );
});

test("physical proof requires adult operators, no participants and physically separate devices", () => {
  for (const [field, value] of [
    ["adultOperatorsOnly", false],
    ["participantsPresent", true],
    ["physicallySeparateDevicesConfirmed", false],
    ["realParticipantData", true],
  ] as const) {
    const changed = authenticPhysicalReceipt();
    changed[field] = value;
    assert.match(
      validateReceipt(changed).errors.join(";"),
      /adult-only operators.*no participants.*physically separate/i,
      field,
    );
  }
});

test("physical proof rejects missing, duplicate and unknown documented steps", () => {
  const mutations = [
    (steps: Record<string, unknown>[]) => {
      steps.pop();
    },
    (steps: Record<string, unknown>[]) => {
      const first = steps[0];
      assert.ok(first);
      steps[1] = structuredClone(first);
    },
    (steps: Record<string, unknown>[]) => {
      const sixth = steps[5];
      assert.ok(sixth);
      sixth.stepId = "unknown_step";
    },
  ];
  for (const mutate of mutations) {
    const changed = authenticPhysicalReceipt();
    const steps = changed.stepResults as Record<string, unknown>[];
    mutate(steps);
    assert.match(
      validateReceipt(changed).errors.join(";"),
      /all 27 documented step IDs in exact order/i,
    );
  }
});

test("physical proof checksum and confirmation bind the exact evidence artifact", () => {
  const changed = authenticPhysicalReceipt();
  changed.checksum = "f".repeat(64);
  assert.match(
    validateReceipt(changed).errors.join(";"),
    /hash-bound physical evidence|exact evidence-bound human confirmation/i,
  );
});

test("physical receipt requires every role, lifecycle and safety result to be true", () => {
  for (const result of [
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
  ]) {
    const changed = authenticPhysicalReceipt();
    const results = changed.proofResults as Record<string, unknown>;
    results[result] = false;
    assert.match(
      validateReceipt(changed).errors.join(";"),
      new RegExp(`must be true: ${result}`, "i"),
      result,
    );
  }
});

test("physicalProof=true and expected physical proof both require the physical receipt type", () => {
  const changed = authenticPhysicalReceipt();
  changed.receiptType = "PROTECTED_PREVIEW_RECEIPT";
  assert.match(
    validateReceipt(changed, { physicalDeviceProof: true }).errors.join(";"),
    /physicalProof=true requires|expected physical proof requires/i,
  );
});

test("receipt cannot open B8, authorize beta/production or claim fabricated status", () => {
  const template = JSON.parse(readFileSync(
    "release/wp13-12b/receipts/templates/protected_preview_receipt.json",
    "utf8",
  ));
  template.status = "COMPLETED_WITH_AUTHENTIC_EVIDENCE";
  template.templateMarker = "FILLED";
  template.opensB8 = true;
  template.authorizesStudentBeta = true;
  template.authorizesProduction = true;
  template.syntheticOrFabricated = true;
  const result = validateReceipt(template);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(";"), /B8|fabricated|production/i);
});

test("external activation overlay preserves the historical repository snapshot", () => {
  assert.deepEqual(validateExternalActivationState(externalActivationState), []);
});

test("historical emulator evidence cannot substitute for fresh v2 receipt evidence", () => {
  const historical = clone(externalActivationState);
  const evidence = historical.evidence as Record<string, unknown>;
  assert.equal(
    evidence.historicalEmulatorProof,
    "PRESERVED_NOT_FRESH_V2_NONCE_EVIDENCE",
  );
  assert.equal(evidence.emulatorProof, "NOT_RECORDED");
  assert.equal(evidence.validatedReceiptCount, 0);

  evidence.validatedReceiptPaths = [
    ...(evidence.historicalReceiptPaths as string[]),
  ];
  evidence.validatedReceiptCount = 1;
  evidence.emulatorProof = "AUTHENTIC_EVIDENCE_RECORDED";
  assert.match(
    validateExternalActivationState(historical).join(";"),
    /historical receipts cannot substitute/i,
  );
});

test("active external overlay requires all four authentic validated receipt types", () => {
  const active = activeExternalActivationOverlay();
  assert.deepEqual(
    validateExternalActivationState(active, activeExternalReceiptTypes),
    [],
  );
  assert.match(
    validateExternalActivationState(active).join(";"),
    /receipt paths must all resolve|EMULATOR_PROOF_RECEIPT/i,
  );
  for (const missing of activeExternalReceiptTypes) {
    const types = activeExternalReceiptTypes.filter((type) => type !== missing);
    assert.match(
      validateExternalActivationState(active, types).join(";"),
      new RegExp(`authentic validated receipt type: ${missing}`, "i"),
      missing,
    );
  }
});

test("recorded physical overlay proof requires an authentically validated physical receipt", () => {
  const active = activeExternalActivationOverlay(true);
  assert.match(
    validateExternalActivationState(active, activeExternalReceiptTypes).join(";"),
    /authentic validated physical receipt/i,
  );
  assert.deepEqual(validateExternalActivationState(active, [
    ...activeExternalReceiptTypes,
    "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
  ]), []);
});

test("PR3 remains not achieved until every exact proof family is receipt-derived", () => {
  const incomplete = activeExternalActivationOverlay(true);
  incomplete.pr3 = "ACHIEVED";
  assert.match(
    validateExternalActivationState(incomplete, [
      ...activeExternalReceiptTypes,
      "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
    ]).join(";"),
    /PR3 status must be derived/i,
  );

  const forgedMap = activeExternalActivationOverlay(true);
  forgedMap.pr3 = "ACHIEVED";
  forgedMap.pr3ProofFamilies = Object.fromEntries(
    allPr3ProofFamilies.map((family) => [
      family,
      "AUTHENTIC_EVIDENCE_RECORDED",
    ]),
  );
  assert.match(
    validateExternalActivationState(forgedMap, [
      ...activeExternalReceiptTypes,
      "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
    ]).join(";"),
    /not receipt-derived/i,
  );
});

test("PR3 is achieved iff the complete exact proof-family set validates", () => {
  const achieved = activeExternalActivationOverlay(true);
  achieved.pr3 = "ACHIEVED";
  achieved.pr3ProofFamilies = Object.fromEntries(
    allPr3ProofFamilies.map((family) => [
      family,
      "AUTHENTIC_EVIDENCE_RECORDED",
    ]),
  );
  assert.deepEqual(validateExternalActivationState(
    achieved,
    [
      ...activeExternalReceiptTypes,
      "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
    ],
    allPr3ProofFamilies,
  ), []);

  const extra = clone(achieved);
  (extra.pr3ProofFamilies as Record<string, unknown>).UNREVIEWED_PROOF = (
    "AUTHENTIC_EVIDENCE_RECORDED"
  );
  assert.match(
    validateExternalActivationState(
      extra,
      [
        ...activeExternalReceiptTypes,
        "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
      ],
      allPr3ProofFamilies,
    ).join(";"),
    /exact required families/i,
  );
});

test("external activation overlay cannot rewrite baseline or turn unknown inventory into zero", () => {
  const changed = clone(externalActivationState);
  const baseline = changed.historicalRepositoryBaseline as Record<string, unknown>;
  baseline.cloudResourcesAtRepositoryPhase = 1;
  const cloud = changed.cloudState as Record<string, unknown>;
  cloud.resourceCount = 0;
  cloud.zeroResourcesAsserted = true;
  assert.match(
    validateExternalActivationState(changed).join(";"),
    /immutable zero-resource snapshot|pending cloud inventory/i,
  );
});

test("pending external resource inventory is valid without claiming zero resources", () => {
  assert.deepEqual(validateExternalResourceInventory(externalResourceInventory), []);
});

test("resource inventory schema allowlists the exact authenticated resource fields", () => {
  const definitions = externalResourceInventorySchema.$defs as Record<string, unknown>;
  const resourceSchema = definitions.resource as Record<string, unknown>;
  const properties = resourceSchema.properties as Record<string, unknown>;
  const exactFields = [
    "resourceId",
    "provider",
    "region",
    "purpose",
    "createdAt",
    "owner",
    "retention",
    "deletionMethod",
    "costRisk",
    "containsRealData",
    "destructionDeadline",
    "receiptReference",
    "lifecycleStatus",
    "evidencePath",
    "syntheticOnly",
  ].sort();
  assert.equal(resourceSchema.additionalProperties, false);
  assert.deepEqual([...(resourceSchema.required as string[])].sort(), exactFields);
  assert.deepEqual(Object.keys(properties).sort(), exactFields);
});

test("pending inventory rejects invented resources and provider observation claims", () => {
  const changed = clone(externalResourceInventory);
  changed.resourceCount = 1;
  changed.zeroResourcesAsserted = true;
  changed.resources = [{
    resourceType: "PROJECT",
    providerResourceId: "unverified-project",
    lifecycleStatus: "ACTIVE",
    evidencePath: "unverified",
    syntheticOnly: true,
  }];
  (changed.observation as Record<string, unknown>).performedBy = "UNCONFIRMED";
  assert.match(
    validateExternalResourceInventory(changed).join(";"),
    /must be null|cannot assert zero|unverified resources|provider observation/i,
  );
});

test("authenticated inventory accepts only the complete synthetic resource contract", () => {
  assert.deepEqual(validateExternalResourceInventory(authenticResourceInventory()), []);
});

test("authenticated inventory requires every exact resource field", () => {
  const requiredFields = [
    "resourceId",
    "provider",
    "region",
    "purpose",
    "createdAt",
    "owner",
    "retention",
    "deletionMethod",
    "costRisk",
    "containsRealData",
    "destructionDeadline",
    "receiptReference",
    "lifecycleStatus",
    "evidencePath",
    "syntheticOnly",
  ];
  for (const field of requiredFields) {
    const changed = authenticResourceInventory();
    const [resource] = changed.resources as Record<string, unknown>[];
    assert.ok(resource);
    delete resource[field];
    assert.match(
      validateExternalResourceInventory(changed).join(";"),
      new RegExp(`${field}|synthetic-only|real data|deadline`, "i"),
      field,
    );
  }
});

test("authenticated inventory rejects legacy, extra and secret-bearing fields", () => {
  const changed = authenticResourceInventory();
  const [resource] = changed.resources as Record<string, unknown>[];
  assert.ok(resource);
  resource.providerResourceId = resource.resourceId;
  resource.resourceType = "PROJECT";
  resource.accessToken = "forbidden";
  assert.match(
    validateExternalResourceInventory(changed).join(";"),
    /unexpected field.*providerResourceId|unexpected field.*resourceType/i,
  );
  assert.match(
    validateExternalResourceInventory(changed).join(";"),
    /forbidden secret field.*accessToken/i,
  );
});

test("authenticated inventory rejects duplicate resource IDs and unsafe paths", () => {
  const changed = authenticResourceInventory();
  const [first] = changed.resources as Record<string, unknown>[];
  assert.ok(first);
  const second = clone(first);
  second.evidencePath = "https://provider.invalid/readback.json";
  second.receiptReference = "../receipts/fabricated.json";
  changed.resources = [first, second];
  changed.resourceCount = 2;
  assert.match(
    validateExternalResourceInventory(changed).join(";"),
    /resourceId must be unique|evidence path must be repository-relative|receipt reference is invalid/i,
  );

  const observationPath = authenticResourceInventory();
  (observationPath.observation as Record<string, unknown>).evidencePaths = [
    "C:\\outside\\provider-readback.json",
  ];
  assert.match(
    validateExternalResourceInventory(observationPath).join(";"),
    /observation evidence path is invalid/i,
  );
});

test("authenticated inventory requires real ISO timestamps and immutable safety declarations", () => {
  const changed = authenticResourceInventory();
  const [resource] = changed.resources as Record<string, unknown>[];
  assert.ok(resource);
  resource.createdAt = "2026-02-30T12:00:00.000Z";
  resource.containsRealData = true;
  resource.syntheticOnly = false;
  resource.destructionDeadline = "2027-01-26";
  (changed.observation as Record<string, unknown>).observedAt = "not-a-timestamp";
  assert.match(
    validateExternalResourceInventory(changed).join(";"),
    /createdAt timestamp|containsRealData=false|synthetic-only|destruction deadline|observation evidence/i,
  );
});
