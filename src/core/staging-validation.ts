export const REQUIRED_OWNER_CONDITIONS = [
  "ISOLATED_AND_TIME_LIMITED_SYNTHETIC_STAGING_ONLY",
  "FIREBASE_CAPABILITY_ONLY_NO_STABLE_ACCOUNT_OR_ANONYMOUS_AUTH",
  "NO_REAL_PARTICIPANT_SCHOOL_HEALTH_AUDIO_OR_DIAGNOSIS_DATA",
  "NO_DIRECT_CLIENT_WRITE_TO_AUTHORITATIVE_STATE",
  "NO_ANALYTICS_CRASHLYTICS_REMOTE_CONFIG_OR_CLOUD_STORAGE",
  "STUDENT_BETA_B8_RECRUITMENT_AND_PRODUCTION_REMAIN_BLOCKED",
] as const;

export const REQUIRED_NO_GO = [
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
] as const;

export interface Wp13_12bValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly repositoryImplementation: "READY" | "BLOCKED";
  readonly ownerDecision: string;
  readonly providerActivation: "BLOCKED";
  readonly cloudResources: 0;
  readonly emulatorProof: string;
  readonly physicalTwoDeviceProof: false;
  readonly externalReceipts: 0;
  readonly wp13_12c: "BLOCKED";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

export function validateOwnerDecisionForWp13_12b(input: {
  readonly ownerDecision: unknown;
  readonly authorization: unknown;
  readonly actualSourcePackageChecksum: string;
  readonly actualDecisionRecordChecksum: string;
  readonly checksumManifestDecisionRecordChecksum: string;
}): readonly string[] {
  const errors: string[] = [];
  if (!isRecord(input.ownerDecision)) return ["owner decision record is missing or invalid"];
  if (!isRecord(input.authorization)) return ["authorization status is missing or invalid"];
  const decision = input.ownerDecision;
  const authorization = input.authorization;
  if (decision.decision !== "APPROVE_RECOMMENDED_SYNTHETIC_DEV") {
    errors.push("owner decision must be APPROVE_RECOMMENDED_SYNTHETIC_DEV");
  }
  if (authorization.packageStatus !== "OWNER_DECISION_RECORDED") {
    errors.push("owner decision status must be OWNER_DECISION_RECORDED");
  }
  if (authorization.ownerDecision !== decision.decision) {
    errors.push("authorization and owner decision conflict");
  }
  if (decision.selectedOption !== "FIREBASE_CAPABILITY") {
    errors.push("selected option must be FIREBASE_CAPABILITY");
  }
  if (decision.selectedRegion !== "europe-north1") {
    errors.push("selected region must be europe-north1");
  }
  if (decision.selectedCapabilityModel !== "FUNCTION_ISSUED_SHORT_LIVED_SESSION_CAPABILITY") {
    errors.push("selected capability model mismatch");
  }
  for (const field of [
    "sourcePackageVersion",
    "sourcePackageChecksum",
    "monthlyAlertThreshold",
    "maximumMonthlyCost",
    "killSwitchOwner",
    "stagingExpiryDate",
    "acknowledgedOpenRisks",
  ]) {
    if (!(field in decision)) errors.push(`owner decision is missing ${field}`);
  }
  if (decision.sourcePackageVersion !== "13.12A.1") errors.push("source package version mismatch");
  if (
    decision.sourcePackageChecksum !== input.actualSourcePackageChecksum
    || decision.sourcePackageChecksum !== "f3830a640fd901f193279ed99338d923848acaef662e79e8a831e870a7813de7"
  ) errors.push("source package checksum mismatch");
  if (
    input.actualDecisionRecordChecksum !== input.checksumManifestDecisionRecordChecksum
    || input.actualDecisionRecordChecksum !== "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754"
  ) errors.push("decision record checksum mismatch");
  const confirmation = isRecord(decision.signatureOrExplicitOwnerConfirmation)
    ? decision.signatureOrExplicitOwnerConfirmation
    : undefined;
  if (
    confirmation?.kind !== "EXPLICIT_OWNER_CONFIRMATION"
    || confirmation.explicitOwnerConfirmationPresent !== true
    || typeof confirmation.confirmationText !== "string"
    || confirmation.confirmationText.trim().length === 0
  ) errors.push("explicit owner confirmation is missing");
  if (confirmation?.signaturePresent !== false) errors.push("fabricated signature is forbidden");
  const conditions = stringArray(decision.conditions);
  for (const condition of REQUIRED_OWNER_CONDITIONS) {
    if (!conditions.includes(condition)) errors.push(`owner condition missing: ${condition}`);
  }
  const effects = isRecord(decision.effects) ? decision.effects : undefined;
  if (
    effects?.recordsOwnerDecisionOnly !== true
    || effects.opensWp13_12b !== false
    || effects.activatesProvider !== false
    || effects.createsCloudResources !== false
    || effects.realDataOrParticipantUseAuthorized !== false
    || effects.studentBetaAuthorized !== false
    || effects.b8Authorized !== false
    || effects.productionAuthorized !== false
  ) errors.push("owner decision effects exceed the recorded authorization ceiling");
  if (
    authorization.providerActivation !== "BLOCKED"
    || authorization.cloudResources !== 0
    || authorization.externalReceipts !== 0
    || authorization.b8 !== "NOT_DECISION_READY"
    || authorization.studentBeta !== "NOT_AUTHORIZED"
    || authorization.production !== "NOT_AUTHORIZED"
  ) errors.push("authorization status exceeds WP13.12B repository scope");
  return errors;
}

export function validateStagingRepositoryContract(contract: unknown): readonly string[] {
  if (!isRecord(contract)) return ["staging repository contract is missing or invalid"];
  const errors: string[] = [];
  const exact: Readonly<Record<string, unknown>> = {
    repositoryWorkAuthorized: true,
    providerActivation: "BLOCKED",
    cloudResources: 0,
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
    backupAndPitrEnabled: false,
    killSwitch: true,
    noResurrection: true,
    roleProjectionIsolation: true,
    syntheticDataOnly: true,
    runtimeAi: false,
    externalReceipts: 0,
    physicalTwoDeviceProof: false,
    b8: "NOT_DECISION_READY",
    studentBeta: "NOT_AUTHORIZED",
    recruitment: "NOT_AUTHORIZED",
    realParticipantData: "NOT_AUTHORIZED",
    production: "NOT_AUTHORIZED",
    wp13_12c: "BLOCKED",
  };
  for (const [field, expected] of Object.entries(exact)) {
    if (contract[field] !== expected) errors.push(`${field} must equal ${String(expected)}`);
  }
  if (contract.selectedRegion !== "europe-north1") errors.push("contract region mismatch");
  if (contract.selectedCapabilityModel !== "FUNCTION_ISSUED_SHORT_LIVED_SESSION_CAPABILITY") {
    errors.push("contract capability model mismatch");
  }
  const noGo = stringArray(contract.noGo);
  for (const item of REQUIRED_NO_GO) {
    if (!noGo.includes(item)) errors.push(`no-go missing: ${item}`);
  }
  return errors;
}

export interface ReceiptValidationResult {
  readonly valid: boolean;
  readonly evidence: boolean;
  readonly errors: readonly string[];
}

export const REQUIRED_ACTIVE_EXTERNAL_RECEIPT_TYPES = [
  "EMULATOR_PROOF_RECEIPT",
  "FIREBASE_PROJECT_AND_REGION_RECEIPT",
  "IAM_AND_BILLING_RECEIPT",
  "PROTECTED_PREVIEW_RECEIPT",
] as const;

export const REQUIRED_PR3_PROOF_FAMILIES = [
  "EMULATOR",
  "IAM_AND_BILLING",
  "FIREBASE_DISABLED_FIRST_DEPLOYMENT",
  "PROTECTED_PREVIEW",
  "PHYSICAL_TWO_DEVICE",
  "STOP_DELETION_NO_RESURRECTION",
  "KILL_SWITCH",
  "ROLLBACK_TO_SAFE_DISABLED_STATE",
] as const;

const PHYSICAL_RECEIPT_TYPE = "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT";

export const REQUIRED_EMULATOR_PROOF_RESULTS = [
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
] as const;

const REQUIRED_PHYSICAL_PROOF_RESULTS = [
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
] as const;

export const REQUIRED_PHYSICAL_STEP_IDS = [
  "create_primary_synthetic_session",
  "connect_child_device",
  "connect_adult_device",
  "verify_separate_role_projections",
  "execute_wait",
  "execute_help",
  "execute_pause",
  "interrupt_one_device_network",
  "execute_other_device_command",
  "reconnect_interrupted_device",
  "verify_state_version",
  "send_stale_command",
  "verify_stale_command_rejected",
  "execute_stop",
  "attempt_delayed_command",
  "verify_delayed_command_rejected",
  "attempt_reconnect_after_stop",
  "verify_terminal_state",
  "create_deletion_synthetic_session",
  "execute_deletion",
  "attempt_reconnect_and_cached_capability_after_deletion",
  "verify_no_resurrection",
  "activate_kill_switch",
  "verify_new_sessions_blocked",
  "rollback_to_known_valid_deployment",
  "verify_deleted_session_not_resurrected_after_rollback",
  "delete_all_synthetic_data",
] as const;

const APPROVED_GOOGLE_PROJECT_ID = "ludys-12b-stg-20260725";
const APPROVED_GOOGLE_PROJECT_NUMBER = "134654966474";
const APPROVED_GOOGLE_REGION = "europe-north1";
const APPROVED_BILLING_ACCOUNT = "01CD9D-0900DF-4FB36A";
const APPROVED_RUNTIME_SERVICE_ACCOUNT =
  "ludys-staging-runtime@ludys-12b-stg-20260725.iam.gserviceaccount.com";
const APPROVED_PREVIEW_SERVICE_ACCOUNT =
  "ludys-preview-invoker@ludys-12b-stg-20260725.iam.gserviceaccount.com";
const APPROVED_DEPLOY_SERVICE_ACCOUNT =
  "ludys-staging-deployer@ludys-12b-stg-20260725.iam.gserviceaccount.com";
const APPROVED_CAPABILITY_SECRET =
  "projects/134654966474/secrets/LUDYS_CAPABILITY_HMAC_KEY";
const APPROVED_VERCEL_TEAM_ID = "team_1Gnn3VSNrP3mbseXx6a92a4J";
const APPROVED_VERCEL_TEAM_SLUG = "trym-s-projects";
const APPROVED_VERCEL_PROJECT_ID = "prj_nHs1hbdyfcMMMglNUTwoYRS43naN";
const APPROVED_VERCEL_PROJECT_NAME = "ludys-wp13-12b-staging";
const APPROVED_STAGING_EXPIRY = "2027-01-25";
const APPROVED_STAGING_EXPIRY_INSTANT = "2027-01-25T00:00:00.000Z";
const EXTERNAL_SYNTHETIC_STAGING_ENVIRONMENT = "EXTERNAL_SYNTHETIC_STAGING";

const APPROVED_FUNCTION_NAMES = [
  "deleteSyntheticSession",
  "health",
  "issueSyntheticSession",
  "sessionCommand",
  "sessionProjection",
] as const;

const APPROVED_FUNCTION_IDS = APPROVED_FUNCTION_NAMES.map(
  (name) =>
    `projects/${APPROVED_GOOGLE_PROJECT_ID}/locations/${APPROVED_GOOGLE_REGION}`
    + `/functions/${name}`,
);

const REQUIRED_FIREBASE_PROOF_RESULTS = [
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

const REQUIRED_IAM_AND_BILLING_PROOF_RESULTS = [
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

const REQUIRED_PROTECTED_PREVIEW_PROOF_RESULTS = [
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

function isRepositoryRelativePath(value: string): boolean {
  return value.length > 0
    && !value.startsWith("/")
    && !value.startsWith("\\")
    && !/^[a-z]:[\\/]/iu.test(value)
    && !/^[a-z][a-z0-9+.-]*:/iu.test(value)
    && !value.includes("\\")
    && !value.includes("\0")
    && !value.includes("?")
    && !value.includes("#")
    && !value.split("/").includes("..")
    && !value.split("/").includes(".git");
}

function isIsoDateTime(value: unknown): value is string {
  if (
    typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
    || !Number.isFinite(Date.parse(value))
  ) return false;
  const [yearText, monthText, dayText] = value.slice(0, 10).split("-");
  const [hourText, minuteText, secondText] = value.slice(11, 19).split(":");
  if (
    yearText === undefined
    || monthText === undefined
    || dayText === undefined
    || hourText === undefined
    || minuteText === undefined
    || secondText === undefined
  ) return false;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    year < 1
    || month < 1
    || month > 12
    || day < 1
    || hour < 0
    || hour > 23
    || minute < 0
    || minute > 59
    || second < 0
    || second > 59
  ) return false;
  const offset = /[+-](\d{2}):(\d{2})$/u.exec(value);
  if (
    offset !== null
    && (Number(offset[1]) > 23 || Number(offset[2]) > 59)
  ) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  return daysInMonth !== undefined && day <= daysInMonth;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isProtectedVercelPreviewUrl(value: unknown): value is string {
  if (!nonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.port === ""
      && url.username === ""
      && url.password === ""
      && url.search === ""
      && url.hash === ""
      && url.hostname.endsWith(".vercel.app")
      && url.hostname !== "vercel.app";
  } catch {
    return false;
  }
}

function exactUnorderedStringArray(
  value: unknown,
  expected: readonly string[],
): boolean {
  if (!Array.isArray(value) || !value.every(nonEmptyString)) return false;
  const actual = [...value].sort();
  const required = [...expected].sort();
  return actual.length === required.length
    && actual.every((entry, index) => entry === required[index]);
}

function containsEveryString(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value)
    && value.every(nonEmptyString)
    && expected.every((entry) => value.includes(entry));
}

function isExactMoney(
  value: unknown,
  amount: number,
): boolean {
  return isRecord(value)
    && value.currency === "NOK"
    && value.amount === amount;
}

function isExactQuotaConfiguration(value: unknown): boolean {
  return isRecord(value)
    && value.functionMinInstances === 0
    && value.functionMaxInstances === 1
    && value.functionConcurrency === 1
    && value.functionTimeoutSeconds === 60;
}

function requireTrueProofResults(
  input: Record<string, unknown>,
  required: readonly string[],
  label: string,
): readonly string[] {
  const errors: string[] = [];
  const proofResults = isRecord(input.proofResults) ? input.proofResults : undefined;
  for (const result of required) {
    if (proofResults?.[result] !== true) {
      errors.push(`${label} proof result must be true: ${result}`);
    }
  }
  return errors;
}

function hasExactTrueProofResults(
  input: Record<string, unknown>,
  required: readonly string[],
): boolean {
  const proofResults = isRecord(input.proofResults)
    ? input.proofResults
    : undefined;
  if (proofResults === undefined) return false;
  const keys = Object.keys(proofResults);
  return keys.length === required.length
    && required.every((name) => proofResults[name] === true);
}

function validateGenericProofResults(input: Record<string, unknown>): readonly string[] {
  if (!isRecord(input.proofResults)) return ["proofResults must be a record"];
  const entries = Object.entries(input.proofResults);
  if (entries.length === 0) return ["filled receipt requires nonempty proofResults"];
  const errors: string[] = [];
  for (const [key, value] of entries) {
    if (!nonEmptyString(key)) {
      errors.push("proofResults keys must be nonempty strings");
      continue;
    }
    const allowedEmulatorZero =
      input.receiptType === "EMULATOR_PROOF_RECEIPT"
      && key === "cloud_resources_created"
      && value === 0;
    if (value !== true && !allowedEmulatorZero) {
      errors.push(`proof result must be true: ${key}`);
    }
  }
  return errors;
}

function validateExactProviderConfirmation(
  input: Record<string, unknown>,
  prefix: string,
  providerFields: readonly string[],
): readonly string[] {
  const errors: string[] = [];
  const evidencePath = input.confirmationEvidencePath;
  const bindingSha256 = input.confirmationBindingSha256;
  const artifactHashes = isRecord(input.artifactHashes)
    ? input.artifactHashes
    : undefined;
  if (
    !nonEmptyString(evidencePath)
    || !isRepositoryRelativePath(evidencePath)
    || !isSha256(bindingSha256)
    || artifactHashes?.[evidencePath] !== bindingSha256
  ) errors.push("provider receipt confirmation evidence binding mismatch");
  const confirmation = isRecord(input.humanSignatureOrExplicitConfirmation)
    ? input.humanSignatureOrExplicitConfirmation
    : undefined;
  const expectedText = [
    prefix,
    `receiptId=${String(input.receiptId ?? "")}`,
    `sourceCommit=${String(input.sourceCommit ?? "")}`,
    `sourceTree=${String(input.sourceTree ?? "")}`,
    ...providerFields,
    `evidenceSha256=${String(bindingSha256 ?? "")}`,
  ].join("; ");
  if (
    confirmation?.confirmed !== true
    || confirmation.confirmationText !== expectedText
    || !isIsoDateTime(confirmation.confirmedAt)
  ) errors.push("provider receipt requires exact evidence-bound human confirmation");
  return errors;
}

function validateFirebaseProjectAndRegionReceipt(
  input: Record<string, unknown>,
): readonly string[] {
  const errors: string[] = [];
  const ids = isRecord(input.providerResourceIds)
    ? input.providerResourceIds
    : undefined;
  const firestoreDatabase =
    `projects/${APPROVED_GOOGLE_PROJECT_ID}/databases/(default)`;
  if (input.environment !== EXTERNAL_SYNTHETIC_STAGING_ENVIRONMENT) {
    errors.push("Firebase receipt environment must be external synthetic staging");
  }
  if (input.selectedProjectId !== APPROVED_GOOGLE_PROJECT_ID) {
    errors.push("Firebase receipt project ID mismatch");
  }
  if (input.selectedRegion !== APPROVED_GOOGLE_REGION) {
    errors.push("project receipt region mismatch");
  }
  if (input.deploymentMode !== "DISABLED_FIRST") {
    errors.push("Firebase receipt must record disabled-first deployment");
  }
  if (
    ids?.googleProjectId !== APPROVED_GOOGLE_PROJECT_ID
    || ids.googleProjectNumber !== APPROVED_GOOGLE_PROJECT_NUMBER
    || ids.firestoreDatabase !== firestoreDatabase
  ) errors.push("Firebase receipt provider resource binding mismatch");
  if (!exactUnorderedStringArray(ids?.functionIds, APPROVED_FUNCTION_IDS)) {
    errors.push("Firebase receipt must bind all five exact regional function IDs");
  }
  if (
    !containsEveryString(
      ids?.resourceIds,
      [
        `projects/${APPROVED_GOOGLE_PROJECT_ID}`,
        firestoreDatabase,
        ...APPROVED_FUNCTION_IDS,
      ],
    )
  ) errors.push("Firebase receipt resourceIds must include its exact provider resources");
  errors.push(...requireTrueProofResults(
    input,
    REQUIRED_FIREBASE_PROOF_RESULTS,
    "Firebase",
  ));
  errors.push(...validateExactProviderConfirmation(
    input,
    "BEKREFT_WP13_12B_FIREBASE_PROJECT_AND_REGION_V1",
    [
      `projectId=${APPROVED_GOOGLE_PROJECT_ID}`,
      `region=${APPROVED_GOOGLE_REGION}`,
    ],
  ));
  return errors;
}

function validateIamAndBillingReceipt(
  input: Record<string, unknown>,
): readonly string[] {
  const errors: string[] = [];
  const ids = isRecord(input.providerResourceIds)
    ? input.providerResourceIds
    : undefined;
  if (input.environment !== EXTERNAL_SYNTHETIC_STAGING_ENVIRONMENT) {
    errors.push("IAM and billing receipt environment must be external synthetic staging");
  }
  if (
    ids?.googleProjectId !== APPROVED_GOOGLE_PROJECT_ID
    || ids.billingAccount !== APPROVED_BILLING_ACCOUNT
    || !nonEmptyString(ids.budgetId)
    || !String(ids.budgetId).startsWith(
      `billingAccounts/${APPROVED_BILLING_ACCOUNT}/budgets/`,
    )
    || ids.runtimeServiceAccount !== APPROVED_RUNTIME_SERVICE_ACCOUNT
    || ids.previewServiceAccount !== APPROVED_PREVIEW_SERVICE_ACCOUNT
    || ids.deployServiceAccount !== APPROVED_DEPLOY_SERVICE_ACCOUNT
    || ids.capabilitySecret !== APPROVED_CAPABILITY_SECRET
  ) errors.push("IAM and billing receipt provider resource binding mismatch");
  if (
    !containsEveryString(
      ids?.resourceIds,
      [
        `projects/${APPROVED_GOOGLE_PROJECT_ID}`,
        String(ids?.budgetId ?? ""),
        APPROVED_RUNTIME_SERVICE_ACCOUNT,
        APPROVED_PREVIEW_SERVICE_ACCOUNT,
        APPROVED_DEPLOY_SERVICE_ACCOUNT,
        APPROVED_CAPABILITY_SECRET,
      ],
    )
  ) errors.push("IAM and billing receipt resourceIds must include its exact resources");
  if (
    input.billingAlertConfigured !== true
    || !isExactMoney(input.monthlyAlertThreshold, 400)
    || !isExactMoney(input.maximumMonthlyCost, 500)
    || !exactUnorderedStringArray(input.budgetThresholdsNok, ["400", "500"])
  ) errors.push("IAM and billing receipt requires exact 400/500 NOK budget evidence");
  if (
    input.billingReviewer !== "PRODUCT_OWNER_SELF"
    || input.ownerSelfAttestation !== "ONE_HUNDRED_PERCENT_OWNER"
    || input.stagingExpiryDate !== APPROVED_STAGING_EXPIRY
    || input.stagingExpiryInstant !== APPROVED_STAGING_EXPIRY_INSTANT
  ) errors.push("IAM and billing receipt owner, reviewer or expiry binding mismatch");
  if (!isExactQuotaConfiguration(input.quotaConfiguration)) {
    errors.push("IAM and billing receipt function quota evidence mismatch");
  }
  if (!exactUnorderedStringArray(input.deployIdentityRoles, [
    "roles/cloudfunctions.developer",
    "roles/firebaserules.admin",
    "roles/run.admin",
    "roles/serviceusage.serviceUsageConsumer",
  ])) errors.push("IAM and billing receipt deploy identity roles mismatch");
  if (
    input.deployPrincipal !== APPROVED_DEPLOY_SERVICE_ACCOUNT
    || input.operatorPrincipal !== "user:tryakim@gmail.com"
    || input.deployIdentityAuthenticationMode !== "TIME_BOUND_HUMAN_IMPERSONATION"
    || input.deployIdentityDistinctFromRuntimeAndPreview !== true
    || input.deployIdentityUserManagedKeyCount !== 0
    || input.deployIdentityKeyless !== true
    || input.deployIdentityOwnerRole !== false
  ) {
    errors.push(
      "IAM and billing receipt requires the exact distinct, keyless, time-bound deploy identity",
    );
  }
  const impersonationStartedAt = isIsoDateTime(input.impersonationStartedAt)
    ? Date.parse(input.impersonationStartedAt)
    : Number.NaN;
  const impersonationExpiresAt = isIsoDateTime(input.impersonationExpiresAt)
    ? Date.parse(input.impersonationExpiresAt)
    : Number.NaN;
  const deploymentObservedAt = isIsoDateTime(input.deploymentObservedAt)
    ? Date.parse(input.deploymentObservedAt)
    : Number.NaN;
  if (
    !Number.isFinite(impersonationStartedAt)
    || !Number.isFinite(impersonationExpiresAt)
    || !Number.isFinite(deploymentObservedAt)
    || impersonationExpiresAt <= impersonationStartedAt
    || impersonationExpiresAt - impersonationStartedAt > 60 * 60 * 1000
    || deploymentObservedAt < impersonationStartedAt
    || deploymentObservedAt >= impersonationExpiresAt
    || impersonationExpiresAt > Date.parse(APPROVED_STAGING_EXPIRY_INSTANT)
  ) errors.push("IAM and billing receipt impersonation window is invalid or exceeds 60 minutes");
  const serviceAccountUserBindings =
    isRecord(input.serviceAccountUserBindings)
      ? input.serviceAccountUserBindings
      : undefined;
  if (
    serviceAccountUserBindings?.role !== "roles/iam.serviceAccountUser"
    || serviceAccountUserBindings.member
      !== `serviceAccount:${APPROVED_DEPLOY_SERVICE_ACCOUNT}`
    || serviceAccountUserBindings.runtimeServiceAccount
      !== APPROVED_RUNTIME_SERVICE_ACCOUNT
    || serviceAccountUserBindings.buildServiceAccount
      !== "134654966474-compute@developer.gserviceaccount.com"
    || serviceAccountUserBindings.conditioned !== true
    || serviceAccountUserBindings.windowMaxSeconds !== 3600
    || serviceAccountUserBindings.revoked !== true
  ) errors.push("IAM and billing receipt scoped serviceAccountUser bindings mismatch");
  const tokenCreatorBinding = isRecord(input.conditionedTokenCreatorBinding)
    ? input.conditionedTokenCreatorBinding
    : undefined;
  if (
    tokenCreatorBinding?.role !== "roles/iam.serviceAccountTokenCreator"
    || tokenCreatorBinding.member !== "user:tryakim@gmail.com"
    || tokenCreatorBinding.resource !== APPROVED_DEPLOY_SERVICE_ACCOUNT
    || tokenCreatorBinding.conditioned !== true
    || tokenCreatorBinding.windowMaxSeconds !== 3600
    || tokenCreatorBinding.revoked !== true
  ) errors.push("IAM and billing receipt conditioned TokenCreator binding mismatch");
  if (
    input.deployProjectRolesConditioned !== true
    || input.deployBindingWindowMaxSeconds !== 3600
  ) errors.push("IAM and billing receipt deploy project roles must be conditioned to 60 minutes");
  const deploymentCommands = Array.isArray(input.deploymentCommands)
    && input.deploymentCommands.every(nonEmptyString)
    ? input.deploymentCommands
    : [];
  const impersonationFlag =
    `--impersonate-service-account=${APPROVED_DEPLOY_SERVICE_ACCOUNT}`;
  if (
    deploymentCommands.length === 0
    || deploymentCommands.some((command) => !command.includes(impersonationFlag))
    || deploymentCommands.some(
      (command) =>
        !Array.isArray(input.commandsRun)
        || !input.commandsRun.includes(command),
    )
  ) errors.push("IAM and billing receipt deployment commands must all use exact impersonation");
  if (input.callerIdentityReadback !== APPROVED_DEPLOY_SERVICE_ACCOUNT) {
    errors.push("IAM and billing receipt caller identity readback mismatch");
  }
  if (
    input.postDeployImpersonationRevoked !== true
    || input.postDeployProjectRolesRevoked !== true
    || !nonEmptyString(input.postDeployRevocationEvidencePath)
    || !isRepositoryRelativePath(input.postDeployRevocationEvidencePath)
    || !isRecord(input.artifactHashes)
    || !isSha256(input.artifactHashes[input.postDeployRevocationEvidencePath])
  ) errors.push("IAM and billing receipt requires hash-bound post-deploy revocation evidence");
  if (!exactUnorderedStringArray(input.runtimeProjectRoles, [
    "roles/datastore.user",
    "roles/logging.logWriter",
  ])) errors.push("IAM and billing receipt runtime project roles mismatch");
  if (!exactUnorderedStringArray(input.runtimeSecretRoles, [
    "roles/secretmanager.secretAccessor",
  ])) errors.push("IAM and billing receipt runtime secret roles mismatch");
  if (
    input.runtimeUserManagedKeyCount !== 0
    || input.previewUserManagedKeyCount !== 0
  ) errors.push("IAM and billing receipt requires keyless service accounts");
  if (
    input.capabilitySecretRegion !== APPROVED_GOOGLE_REGION
    || input.secretValuePrinted !== false
    || input.secretValueWrittenToDisk !== false
    || input.secretValueExposedToBrowser !== false
  ) errors.push("IAM and billing receipt secret boundary mismatch");
  errors.push(...requireTrueProofResults(
    input,
    REQUIRED_IAM_AND_BILLING_PROOF_RESULTS,
    "IAM and billing",
  ));
  errors.push(...validateExactProviderConfirmation(
    input,
    "BEKREFT_WP13_12B_IAM_AND_BILLING_V1",
    [
      `projectId=${APPROVED_GOOGLE_PROJECT_ID}`,
      `billingAccount=${APPROVED_BILLING_ACCOUNT}`,
      "alertNok=400",
      "maximumNok=500",
      `expiry=${APPROVED_STAGING_EXPIRY}`,
      `expiryInstant=${APPROVED_STAGING_EXPIRY_INSTANT}`,
    ],
  ));
  return errors;
}

function validateProtectedPreviewReceipt(
  input: Record<string, unknown>,
): readonly string[] {
  const errors: string[] = [];
  const ids = isRecord(input.providerResourceIds)
    ? input.providerResourceIds
    : undefined;
  const rollbackDeploymentBinding = isRecord(input.rollbackDeploymentBinding)
    ? input.rollbackDeploymentBinding
    : undefined;
  const artifactHashes = isRecord(input.artifactHashes)
    ? input.artifactHashes
    : undefined;
  if (input.environment !== EXTERNAL_SYNTHETIC_STAGING_ENVIRONMENT) {
    errors.push("preview receipt environment must be external synthetic staging");
  }
  if (
    ids?.vercelTeamId !== APPROVED_VERCEL_TEAM_ID
    || ids.vercelTeamSlug !== APPROVED_VERCEL_TEAM_SLUG
    || ids.vercelProjectId !== APPROVED_VERCEL_PROJECT_ID
    || ids.vercelProjectName !== APPROVED_VERCEL_PROJECT_NAME
    || !nonEmptyString(ids.deploymentId)
    || !/^dpl_[A-Za-z0-9]+$/u.test(ids.deploymentId)
    || !nonEmptyString(ids.rollbackDeploymentId)
    || !/^dpl_[A-Za-z0-9]+$/u.test(ids.rollbackDeploymentId)
  ) errors.push("preview receipt Vercel team, project or deployment binding mismatch");
  if (
    !isProtectedVercelPreviewUrl(input.stagingUrl)
    || ids?.deploymentUrl !== input.stagingUrl
  ) errors.push("preview receipt requires its exact protected HTTPS deployment URL");
  if (
    !nonEmptyString(input.rollbackDeploymentId)
    || input.rollbackDeploymentId === ids?.deploymentId
    || ids?.rollbackDeploymentId !== input.rollbackDeploymentId
    || rollbackDeploymentBinding?.deploymentId !== input.rollbackDeploymentId
    || !isProtectedVercelPreviewUrl(rollbackDeploymentBinding.stagingUrl)
    || rollbackDeploymentBinding.stagingUrl === input.stagingUrl
    || ids?.rollbackDeploymentUrl !== rollbackDeploymentBinding.stagingUrl
    || typeof rollbackDeploymentBinding.sourceCommit !== "string"
    || !/^[a-f0-9]{40}$/u.test(rollbackDeploymentBinding.sourceCommit)
    || typeof rollbackDeploymentBinding.sourceTree !== "string"
    || !/^[a-f0-9]{40}$/u.test(rollbackDeploymentBinding.sourceTree)
    || rollbackDeploymentBinding.safeDisabled !== true
    || !nonEmptyString(rollbackDeploymentBinding.evidencePath)
    || !isRepositoryRelativePath(rollbackDeploymentBinding.evidencePath)
    || !isSha256(rollbackDeploymentBinding.evidenceSha256)
    || artifactHashes?.[rollbackDeploymentBinding.evidencePath]
      !== rollbackDeploymentBinding.evidenceSha256
  ) {
    errors.push(
      "preview receipt requires a distinct, protected, source-bound and hash-bound known-valid safe-disabled rollback deployment",
    );
  }
  if (
    !containsEveryString(
      ids?.resourceIds,
      [
        APPROVED_VERCEL_TEAM_ID,
        APPROVED_VERCEL_PROJECT_ID,
        String(ids?.deploymentId ?? ""),
        String(input.stagingUrl ?? ""),
        String(ids?.rollbackDeploymentId ?? ""),
        String(rollbackDeploymentBinding?.stagingUrl ?? ""),
      ],
    )
  ) errors.push("preview receipt resourceIds must include its exact Vercel resources");
  if (
    input.deploymentEnvironment !== "preview"
    || input.protectionMode !== "prod_deployment_urls_and_all_previews"
    || input.oidcIssuerMode !== "team"
  ) errors.push("preview receipt protection or OIDC mode mismatch");
  if (
    input.webAnalyticsEnabled !== false
    || input.speedInsightsEnabled !== false
    || !Array.isArray(input.customDomains)
    || input.customDomains.length !== 0
    || input.productionDeployment !== false
    || input.gitLinked !== false
  ) errors.push("preview receipt forbidden deployment feature boundary mismatch");
  if (
    input.deploymentSourceCommit !== input.sourceCommit
    || input.deploymentSourceTree !== input.sourceTree
  ) errors.push("preview receipt deployment is not commit-and-tree specific");
  if (
    input.rollbackPlanReference
      !== "release/wp13-12b/activation-handoff/rollback-plan.json"
    || input.rollbackMode !== "DELETE_PREVIEW_AND_KEEP_BACKEND_DISABLED"
  ) errors.push("preview receipt rollback binding mismatch");
  errors.push(...requireTrueProofResults(
    input,
    REQUIRED_PROTECTED_PREVIEW_PROOF_RESULTS,
    "protected preview",
  ));
  errors.push(...validateExactProviderConfirmation(
    input,
    "BEKREFT_WP13_12B_PROTECTED_PREVIEW_V1",
    [
      `teamId=${APPROVED_VERCEL_TEAM_ID}`,
      `projectId=${APPROVED_VERCEL_PROJECT_ID}`,
      `deploymentId=${String(ids?.deploymentId ?? "")}`,
      `stagingUrl=${String(input.stagingUrl ?? "")}`,
      `rollbackDeploymentId=${String(input.rollbackDeploymentId ?? "")}`,
      `rollbackStagingUrl=${String(rollbackDeploymentBinding?.stagingUrl ?? "")}`,
      `rollbackSourceCommit=${String(rollbackDeploymentBinding?.sourceCommit ?? "")}`,
      `rollbackSourceTree=${String(rollbackDeploymentBinding?.sourceTree ?? "")}`,
      `rollbackEvidenceSha256=${String(rollbackDeploymentBinding?.evidenceSha256 ?? "")}`,
    ],
  ));
  return errors;
}

const EMULATOR_PR3_PURPOSE = "WP13_12B_PR3_LOCAL_EMULATOR_PROOF_ONLY";
const EMULATOR_DEMO_PROJECT_ID = "demo-ludys-wp13-12b";
const EMULATOR_COMMIT_S =
  "b7b0af2b679a98b0e61ef17e606a5183a1de6323";
const EMULATOR_COMMIT_S_TREE =
  "a86137594062e696a00a547c55827b8d95719d6d";
const EMULATOR_COMMIT_T =
  "568d9f9e306075a81f6e4b243d3812507f97b230";
const EMULATOR_COMMIT_T_TREE =
  "64911ea615a1814acb1d03a2bb244152dc1fdee2";
const EMULATOR_COMMIT_U =
  "190fff88808bbafe605cdde4cfe9fe943f4543a4";
const EMULATOR_COMMIT_U_TREE =
  "6a9634f4e096b736f4699a209f2152e4e083127d";
const EMULATOR_COMMIT_V =
  "2e38ce83c9b4cfd70f515a31610ddf23374631bd";
const EMULATOR_COMMIT_V_TREE =
  "eb183ef860ee9cc16ef1167e56ea2c8a2de96cc2";
const EMULATOR_PINNED_GIT_ADAPTER_SHA256 =
  "0242641775cbf43b3c3d09276c6462d7b97de24cc2f13a32bf52c7bc8ed0dfbf";
const EMULATOR_PINNED_GIT_ADAPTER_GIT_BLOB =
  "a0c37fba2ab6625180bfa3691642acb38e86af29";
const EMULATOR_SECURITY_REMEDIATION_CHANGE_SET_SHA256 =
  "983d11050f1f299096797aea9a9179882411b355ffffc14ec5c98323e4f3b402";
const EMULATOR_PREVIEW_SOURCE_SET_SHA256 =
  "bf3ecfc58ae713bf91dd53f27b6ad5b9750a65b76bf5b73261526cae7db21d80";
const EMULATOR_FAST_URI_VERSION = "3.1.5";
const EMULATOR_FAST_URI_ADVISORY = "GHSA-7p8r-x3mc-p8w7";
const EMULATOR_PROOF_PATH =
  "artifacts/wp13-12b-actual-emulator-proof.json";
const EMULATOR_OWNER_DECISION_PATH =
  "release/wp13-12b/external-activation/owner-authorization.json";
const EMULATOR_PROVIDER_PACKAGE_PATH =
  "artifacts/wp13-12b-provider-package.json";
const EMULATOR_PROVIDER_LOCK_PATH =
  "provider/firebase/functions/package-lock.json";
const EMULATOR_PROVIDER_SBOM_PATH =
  "release/wp13-12b/provider-sbom.cdx.json";
const EMULATOR_PROVIDER_AUDIT_PATH =
  "release/wp13-12b/provider-audit.json";
const EMULATOR_PROVIDER_SECURITY_REMEDIATION_PATH =
  "release/wp13-12b/provider-security-remediation.json";
const EMULATOR_ACTIVATION_PACKAGE_PATH =
  "release/wp13-12b/external-activation/artifact-checksums.sha256";
const EMULATOR_RECEIPT_CONTRACT_PATH =
  "release/wp13-12b/activation-handoff/receipt-contracts.json";
const EMULATOR_PROOF_RUNNER_PATH =
  "scripts/run-wp13-12b-emulator-proof.mjs";
const EMULATOR_CHALLENGE_SCHEMA =
  "wp13.12b-emulator-proof-challenge-v2";
const EMULATOR_CHALLENGE_TTL_MS = 30 * 60 * 1000;

function isExactUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isExactStringArray(
  value: unknown,
  expected: readonly string[],
): value is readonly string[] {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((entry, index) => entry === expected[index]);
}

function isExactPinnedGitDiffCommandContract(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isExactStringArray(
    Object.keys(value).sort(),
    ["arguments", "command", "output", "renameDetection", "schemaVersion"],
  )
    && value.schemaVersion === "wp13.12b-pinned-git-diff-contract-v1"
    && value.command === "git diff"
    && isExactStringArray(value.arguments, [
      "--name-only",
      "--no-renames",
      "-z",
      EMULATOR_COMMIT_T,
      EMULATOR_COMMIT_U,
      "--",
    ])
    && value.output
      === "UTF8_NUL_TERMINATED_REPOSITORY_RELATIVE_POSIX_PATHS"
    && value.renameDetection === "DISABLED";
}

export function isChallengeBoundEmulatorReceipt(input: unknown): boolean {
  if (
    !isRecord(input)
    || input.schemaVersion !== "wp13.12b-receipt-v2"
    || input.receiptType !== "EMULATOR_PROOF_RECEIPT"
    || !isRecord(input.emulatorProofBinding)
    || !isRecord(input.nonceRecord)
    || !isRecord(input.humanSignatureOrExplicitConfirmation)
  ) return false;
  const binding = input.emulatorProofBinding;
  const nonceRecord = input.nonceRecord;
  const confirmation = input.humanSignatureOrExplicitConfirmation;
  const artifactHashes = isRecord(input.artifactHashes)
    ? input.artifactHashes
    : undefined;
  const machineEnvironment = isRecord(input.machineEnvironment)
    ? input.machineEnvironment
    : undefined;
  const emulatorArtifact = isRecord(input.emulatorArtifact)
    ? input.emulatorArtifact
    : undefined;
  const generatedAt = binding.generatedAt;
  const expiresAt = binding.expiresAt;
  const confirmedAt = confirmation.confirmedAt;
  const sourceCommit = input.sourceCommit;
  const sourceTree = input.sourceTree;
  if (
    binding.schemaVersion !== "wp13.12b-emulator-proof-binding-v2"
    || binding.artifactPath !== EMULATOR_PROOF_PATH
    || !isSha256(binding.artifactSha256)
    || binding.proofSha256 !== binding.artifactSha256
    || typeof binding.nonce !== "string"
    || !/^[a-f0-9]{32}$/u.test(binding.nonce)
    || binding.purpose !== EMULATOR_PR3_PURPOSE
    || !isSha256(binding.jarSha256)
    || binding.demoProjectId !== EMULATOR_DEMO_PROJECT_ID
    || typeof binding.sourceCommit !== "string"
    || !/^[a-f0-9]{40}$/u.test(binding.sourceCommit)
    || typeof binding.sourceTree !== "string"
    || !/^[a-f0-9]{40}$/u.test(binding.sourceTree)
    || binding.commitS !== EMULATOR_COMMIT_S
    || binding.commitSTree !== EMULATOR_COMMIT_S_TREE
    || binding.commitT !== EMULATOR_COMMIT_T
    || binding.commitTTree !== EMULATOR_COMMIT_T_TREE
    || binding.commitU !== EMULATOR_COMMIT_U
    || binding.commitUTree !== EMULATOR_COMMIT_U_TREE
    || binding.commitV !== EMULATOR_COMMIT_V
    || binding.commitVTree !== EMULATOR_COMMIT_V_TREE
    || binding.commitW !== binding.sourceCommit
    || binding.commitWTree !== binding.sourceTree
    || binding.proofOriginCommit !== binding.commitV
    || binding.proofOriginTree !== binding.commitVTree
    || binding.securityRemediationCommit !== binding.commitU
    || binding.securityRemediationTree !== binding.commitUTree
    || binding.providerSecurityRemediationCommit !== binding.commitU
    || binding.providerPackageCommit !== binding.commitU
    || binding.providerPackageLockCommit !== binding.commitU
    || binding.providerSbomCommit !== binding.commitU
    || binding.providerAuditCommit !== binding.commitU
    || binding.proofToolCommit !== binding.commitW
    || binding.proofToolTree !== binding.commitWTree
    || new Set([
      binding.commitS,
      binding.commitT,
      binding.commitU,
      binding.commitV,
      binding.commitW,
    ]).size !== 5
    || !isExactStringArray(
      binding.orderedCommitChain,
      [
        binding.commitS,
        binding.commitT,
        binding.commitU,
        binding.commitV,
        binding.commitW,
      ] as string[],
    )
    || !isExactStringArray(
      binding.proofToolCommitChain,
      [
        binding.commitT,
        binding.commitU,
        binding.commitV,
        binding.commitW,
      ] as string[],
    )
    || !isSha256(binding.proofRunnerSha256)
    || typeof binding.proofRunnerGitBlob !== "string"
    || !/^[a-f0-9]{40}$/u.test(binding.proofRunnerGitBlob)
    || binding.pinnedGitAdapterSha256
      !== EMULATOR_PINNED_GIT_ADAPTER_SHA256
    || binding.pinnedGitAdapterGitBlob
      !== EMULATOR_PINNED_GIT_ADAPTER_GIT_BLOB
    || binding.securityRemediationChangeSetSha256
      !== EMULATOR_SECURITY_REMEDIATION_CHANGE_SET_SHA256
    || !isExactPinnedGitDiffCommandContract(binding.gitDiffCommandContract)
    || binding.previewSourceSetSha256
      !== EMULATOR_PREVIEW_SOURCE_SET_SHA256
    || !isSha256(binding.ownerDecisionSha256)
    || !isSha256(binding.providerPackageSha256)
    || !isSha256(binding.providerLockSha256)
    || !isSha256(binding.providerSbomSha256)
    || !isSha256(binding.providerAuditSha256)
    || !isSha256(binding.providerSecurityRemediationSha256)
    || binding.resolvedFastUriVersion !== EMULATOR_FAST_URI_VERSION
    || binding.advisory !== EMULATOR_FAST_URI_ADVISORY
    || !isSha256(binding.activationPackageSha256)
    || !isSha256(binding.receiptContractSha256)
    || !isExactUtcTimestamp(generatedAt)
    || !isExactUtcTimestamp(expiresAt)
    || Date.parse(expiresAt) <= Date.parse(generatedAt)
    || Date.parse(expiresAt) - Date.parse(generatedAt)
      > EMULATOR_CHALLENGE_TTL_MS
    || !isNonNegativeInteger(binding.cloudResourceCount)
    || !isNonNegativeInteger(binding.deploymentCount)
    || !isNonNegativeInteger(binding.validatedReceiptCount)
    || sourceCommit !== binding.sourceCommit
    || sourceTree !== binding.sourceTree
    || input.expectedSourceCommit !== binding.sourceCommit
    || input.evidenceAnchorCommit !== binding.commitS
    || input.evidenceAnchorTree !== binding.commitSTree
    || input.commitT !== binding.commitT
    || input.commitTTree !== binding.commitTTree
    || input.commitU !== binding.commitU
    || input.commitUTree !== binding.commitUTree
    || input.commitV !== binding.commitV
    || input.commitVTree !== binding.commitVTree
    || input.commitW !== binding.commitW
    || input.commitWTree !== binding.commitWTree
    || !isExactStringArray(
      input.orderedCommitChain,
      binding.orderedCommitChain as string[],
    )
    || input.proofOriginCommit !== binding.proofOriginCommit
    || input.proofOriginTree !== binding.proofOriginTree
    || input.securityRemediationCommit
      !== binding.securityRemediationCommit
    || input.securityRemediationTree !== binding.securityRemediationTree
    || input.providerSecurityRemediationCommit
      !== binding.providerSecurityRemediationCommit
    || input.providerPackageCommit !== binding.providerPackageCommit
    || input.providerPackageLockCommit
      !== binding.providerPackageLockCommit
    || input.providerSbomCommit !== binding.providerSbomCommit
    || input.providerAuditCommit !== binding.providerAuditCommit
    || input.proofToolCommit !== binding.proofToolCommit
    || input.proofToolTree !== binding.proofToolTree
    || !isExactStringArray(
      input.proofToolCommitChain,
      binding.proofToolCommitChain as string[],
    )
    || input.decisionRecordChecksum !== binding.ownerDecisionSha256
    || !nonEmptyString(machineEnvironment?.operatingSystem)
    || !nonEmptyString(machineEnvironment.node)
    || !nonEmptyString(machineEnvironment.java)
    || !nonEmptyString(machineEnvironment.firebaseCli)
    || !nonEmptyString(machineEnvironment.firestoreEmulator)
    || machineEnvironment.demoProjectId !== EMULATOR_DEMO_PROJECT_ID
    || input.firebaseCliVersion !== machineEnvironment.firebaseCli
    || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(
      String(input.firebaseCliVersion ?? ""),
    )
    || emulatorArtifact?.filename
      !== `cloud-firestore-emulator-v${String(emulatorArtifact?.version ?? "")}.jar`
    || emulatorArtifact.version !== machineEnvironment.firestoreEmulator
    || !Number.isSafeInteger(emulatorArtifact.bytes)
    || Number(emulatorArtifact.bytes) <= 0
    || !isSha256(emulatorArtifact.sha256)
    || emulatorArtifact.sha256 !== binding.jarSha256
    || emulatorArtifact.downloadMethod !== "firebase setup:emulators:firestore"
    || !Array.isArray(input.commandsRun)
    || input.commandsRun.length === 0
    || input.commandsRun.some(
      (command) =>
        !nonEmptyString(command)
        || /<[^>\r\n]+>/u.test(command),
    )
    || artifactHashes?.[EMULATOR_PROOF_PATH] !== binding.artifactSha256
    || artifactHashes?.[EMULATOR_OWNER_DECISION_PATH]
      !== binding.ownerDecisionSha256
    || artifactHashes?.[EMULATOR_PROVIDER_PACKAGE_PATH]
      !== binding.providerPackageSha256
    || artifactHashes?.[EMULATOR_PROVIDER_LOCK_PATH]
      !== binding.providerLockSha256
    || artifactHashes?.[EMULATOR_PROVIDER_SBOM_PATH]
      !== binding.providerSbomSha256
    || artifactHashes?.[EMULATOR_PROVIDER_AUDIT_PATH]
      !== binding.providerAuditSha256
    || artifactHashes?.[EMULATOR_PROVIDER_SECURITY_REMEDIATION_PATH]
      !== binding.providerSecurityRemediationSha256
    || artifactHashes?.[EMULATOR_ACTIVATION_PACKAGE_PATH]
      !== binding.activationPackageSha256
    || artifactHashes?.[EMULATOR_RECEIPT_CONTRACT_PATH]
      !== binding.receiptContractSha256
    || artifactHashes?.[EMULATOR_PROOF_RUNNER_PATH]
      !== binding.proofRunnerSha256
    || confirmation.confirmed !== true
    || !isExactUtcTimestamp(confirmedAt)
    || input.createdAt !== confirmedAt
    || Date.parse(confirmedAt) < Date.parse(generatedAt)
    || Date.parse(confirmedAt) > Date.parse(expiresAt)
    || nonceRecord.schemaVersion !== EMULATOR_CHALLENGE_SCHEMA
    || nonceRecord.generation !== 1
    || nonceRecord.nonce !== binding.nonce
    || nonceRecord.purpose !== binding.purpose
    || nonceRecord.generatedAt !== generatedAt
    || nonceRecord.expiresAt !== expiresAt
    || nonceRecord.status !== "CONFIRMED_CONSUMED"
    || nonceRecord.consumedAt !== confirmedAt
    || nonceRecord.cloudResourceCount !== binding.cloudResourceCount
    || nonceRecord.deploymentCount !== binding.deploymentCount
    || nonceRecord.validatedReceiptCount !== binding.validatedReceiptCount
    || nonceRecord.commitS !== binding.commitS
    || nonceRecord.commitSTree !== binding.commitSTree
    || nonceRecord.commitT !== binding.commitT
    || nonceRecord.commitTTree !== binding.commitTTree
    || nonceRecord.commitU !== binding.commitU
    || nonceRecord.commitUTree !== binding.commitUTree
    || nonceRecord.commitV !== binding.commitV
    || nonceRecord.commitVTree !== binding.commitVTree
    || nonceRecord.commitW !== binding.commitW
    || nonceRecord.commitWTree !== binding.commitWTree
    || !isExactStringArray(
      nonceRecord.orderedCommitChain,
      binding.orderedCommitChain as string[],
    )
    || nonceRecord.proofOriginCommit !== binding.proofOriginCommit
    || nonceRecord.proofOriginTree !== binding.proofOriginTree
    || nonceRecord.securityRemediationCommit
      !== binding.securityRemediationCommit
    || nonceRecord.securityRemediationTree
      !== binding.securityRemediationTree
    || nonceRecord.providerSecurityRemediationCommit
      !== binding.providerSecurityRemediationCommit
    || nonceRecord.providerPackageCommit
      !== binding.providerPackageCommit
    || nonceRecord.providerPackageLockCommit
      !== binding.providerPackageLockCommit
    || nonceRecord.providerSbomCommit !== binding.providerSbomCommit
    || nonceRecord.providerAuditCommit !== binding.providerAuditCommit
    || !isExactStringArray(
      nonceRecord.proofToolCommitChain,
      binding.proofToolCommitChain as string[],
    )
    || nonceRecord.proofToolCommit !== binding.proofToolCommit
    || nonceRecord.proofToolTree !== binding.proofToolTree
    || nonceRecord.proofRunnerSha256 !== binding.proofRunnerSha256
    || typeof nonceRecord.proofRunnerGitBlob !== "string"
    || !/^[a-f0-9]{40}$/u.test(nonceRecord.proofRunnerGitBlob)
    || nonceRecord.proofRunnerGitBlob !== binding.proofRunnerGitBlob
    || nonceRecord.pinnedGitAdapterSha256
      !== binding.pinnedGitAdapterSha256
    || nonceRecord.pinnedGitAdapterGitBlob
      !== binding.pinnedGitAdapterGitBlob
    || nonceRecord.securityRemediationChangeSetSha256
      !== binding.securityRemediationChangeSetSha256
    || !isExactPinnedGitDiffCommandContract(nonceRecord.gitDiffCommandContract)
    || nonceRecord.previewSourceSetSha256
      !== binding.previewSourceSetSha256
    || nonceRecord.freshEmulatorProofSha256 !== binding.proofSha256
    || nonceRecord.ownerDecisionSha256 !== binding.ownerDecisionSha256
    || nonceRecord.providerPackageSha256 !== binding.providerPackageSha256
    || nonceRecord.providerLockSha256 !== binding.providerLockSha256
    || nonceRecord.providerSbomSha256 !== binding.providerSbomSha256
    || nonceRecord.providerAuditSha256 !== binding.providerAuditSha256
    || nonceRecord.providerSecurityRemediationSha256
      !== binding.providerSecurityRemediationSha256
    || nonceRecord.resolvedFastUriVersion
      !== EMULATOR_FAST_URI_VERSION
    || nonceRecord.resolvedFastUriVersion
      !== binding.resolvedFastUriVersion
    || nonceRecord.advisory !== EMULATOR_FAST_URI_ADVISORY
    || nonceRecord.advisory !== binding.advisory
    || nonceRecord.activationPackageSha256
      !== binding.activationPackageSha256
    || nonceRecord.receiptContractSha256
      !== binding.receiptContractSha256
    || !hasExactTrueProofResults(input, REQUIRED_EMULATOR_PROOF_RESULTS)
  ) return false;
  const expectedReceiptId =
    `wp13-12b-emulator-proof-${binding.sourceCommit.slice(0, 12)}-`
    + `${binding.nonce.slice(0, 12)}-v2`;
  if (input.receiptId !== expectedReceiptId) return false;
  const expectedConfirmation = [
    "BEKREFT_WP13_12B_V2_NONCE",
    `nonce=${binding.nonce}`,
    `commitS=${binding.commitS}`,
    `commitSTree=${binding.commitSTree}`,
    `commitT=${binding.commitT}`,
    `commitTTree=${binding.commitTTree}`,
    `commitU=${binding.commitU}`,
    `commitUTree=${binding.commitUTree}`,
    `commitV=${binding.commitV}`,
    `commitVTree=${binding.commitVTree}`,
    `commitW=${binding.commitW}`,
    `commitWTree=${binding.commitWTree}`,
    `orderedCommitChain=${(binding.orderedCommitChain as string[]).join(",")}`,
    `proofOriginCommit=${binding.proofOriginCommit}`,
    `proofOriginTree=${binding.proofOriginTree}`,
    `proofToolCommitChain=${(binding.proofToolCommitChain as string[]).join(",")}`,
    `proofToolCommit=${binding.proofToolCommit}`,
    `proofToolTree=${binding.proofToolTree}`,
    `securityRemediationCommit=${binding.securityRemediationCommit}`,
    `securityRemediationTree=${binding.securityRemediationTree}`,
    `providerSecurityRemediationCommit=${binding.providerSecurityRemediationCommit}`,
    `providerPackageCommit=${binding.providerPackageCommit}`,
    `providerPackageLockCommit=${binding.providerPackageLockCommit}`,
    `providerSbomCommit=${binding.providerSbomCommit}`,
    `providerAuditCommit=${binding.providerAuditCommit}`,
    `proofRunnerSha256=${binding.proofRunnerSha256}`,
    `proofRunnerGitBlob=${binding.proofRunnerGitBlob}`,
    `pinnedGitAdapterSha256=${binding.pinnedGitAdapterSha256}`,
    `pinnedGitAdapterGitBlob=${binding.pinnedGitAdapterGitBlob}`,
    `securityRemediationChangeSetSha256=${binding.securityRemediationChangeSetSha256}`,
    `previewSourceSetSha256=${binding.previewSourceSetSha256}`,
    `freshEmulatorProofSha256=${binding.proofSha256}`,
    `ownerDecisionSha256=${binding.ownerDecisionSha256}`,
    `providerSecurityRemediationSha256=${binding.providerSecurityRemediationSha256}`,
    `providerPackageSha256=${binding.providerPackageSha256}`,
    `providerLockSha256=${binding.providerLockSha256}`,
    `providerSbomSha256=${binding.providerSbomSha256}`,
    `providerAuditSha256=${binding.providerAuditSha256}`,
    `resolvedFastUriVersion=${binding.resolvedFastUriVersion}`,
    `advisory=${binding.advisory}`,
    `activationPackageSha256=${binding.activationPackageSha256}`,
    `receiptContractSha256=${binding.receiptContractSha256}`,
    `generatedAt=${binding.generatedAt}`,
    `expiresAt=${binding.expiresAt}`,
    `cloudResourceCount=${binding.cloudResourceCount}`,
    `deploymentCount=${binding.deploymentCount}`,
    `validatedReceiptCount=${binding.validatedReceiptCount}`,
    `purpose=${EMULATOR_PR3_PURPOSE}`,
    `jarSha256=${binding.jarSha256}`,
    `demoProjectId=${EMULATOR_DEMO_PROJECT_ID}`,
  ].join("; ");
  return confirmation.confirmationText === expectedConfirmation;
}

function validatePhysicalReceipt(input: Record<string, unknown>): readonly string[] {
  const errors: string[] = [];
  if (input.physicalProof !== true) {
    errors.push("physical receipt must explicitly assert physical proof");
  }
  if (!nonEmptyString(input.receiptId) || input.receiptId === "UNFILLED") {
    errors.push("physical receipt requires a nonempty receipt ID");
  }
  if (!isIsoDateTime(input.createdAt)) {
    errors.push("physical receipt requires an ISO createdAt timestamp");
  }
  for (const field of ["performedBy", "environment"] as const) {
    if (!nonEmptyString(input[field])) {
      errors.push(`physical receipt requires nonempty ${field}`);
    }
  }
  if (input.environment !== EXTERNAL_SYNTHETIC_STAGING_ENVIRONMENT) {
    errors.push("physical receipt environment must be external synthetic staging");
  }
  if (
    input.adultOperatorsOnly !== true
    || input.participantsPresent !== false
    || input.physicallySeparateDevicesConfirmed !== true
    || input.realParticipantData !== false
  ) {
    errors.push(
      "physical receipt requires adult-only operators, no participants, physically separate devices and no real participant data",
    );
  }
  if (
    !nonEmptyString(input.syntheticSessionId)
    || !/^synthetic-wp13-12b-[A-Za-z0-9_-]{20,64}$/u.test(input.syntheticSessionId)
  ) errors.push("physical proof requires one exact synthetic session ID");
  if (
    !nonEmptyString(input.deletionSyntheticSessionId)
    || !/^synthetic-wp13-12b-[A-Za-z0-9_-]{20,64}$/u.test(
      input.deletionSyntheticSessionId,
    )
    || input.deletionSyntheticSessionId === input.syntheticSessionId
  ) {
    errors.push(
      "physical proof requires a second, exact and distinct deletion synthetic session ID",
    );
  }
  if (
    !nonEmptyString(input.deploymentId)
    || !/^dpl_[A-Za-z0-9]+$/u.test(input.deploymentId)
  ) errors.push("physical proof requires one exact preview deployment ID");
  const rollbackDeploymentBinding = isRecord(input.rollbackDeploymentBinding)
    ? input.rollbackDeploymentBinding
    : undefined;
  if (
    !nonEmptyString(input.rollbackDeploymentId)
    || !/^dpl_[A-Za-z0-9]+$/u.test(input.rollbackDeploymentId)
    || input.rollbackDeploymentId === input.deploymentId
    || rollbackDeploymentBinding?.deploymentId !== input.rollbackDeploymentId
    || !isProtectedVercelPreviewUrl(rollbackDeploymentBinding.stagingUrl)
    || rollbackDeploymentBinding.stagingUrl === input.stagingUrl
    || typeof rollbackDeploymentBinding.sourceCommit !== "string"
    || !/^[a-f0-9]{40}$/u.test(rollbackDeploymentBinding.sourceCommit)
    || typeof rollbackDeploymentBinding.sourceTree !== "string"
    || !/^[a-f0-9]{40}$/u.test(rollbackDeploymentBinding.sourceTree)
    || rollbackDeploymentBinding.safeDisabled !== true
    || !nonEmptyString(rollbackDeploymentBinding.evidencePath)
    || !isRepositoryRelativePath(rollbackDeploymentBinding.evidencePath)
    || !isSha256(rollbackDeploymentBinding.evidenceSha256)
  ) {
    errors.push(
      "physical proof requires a distinct, protected, source-bound and safe-disabled rollback deployment",
    );
  }
  const providerIds = isRecord(input.providerResourceIds)
    ? input.providerResourceIds
    : undefined;
  if (
    providerIds?.vercelProjectId !== APPROVED_VERCEL_PROJECT_ID
    || providerIds.deploymentId !== input.deploymentId
    || providerIds.deploymentUrl !== input.stagingUrl
    || providerIds.rollbackDeploymentId !== input.rollbackDeploymentId
    || providerIds.rollbackDeploymentUrl !== rollbackDeploymentBinding?.stagingUrl
    || !containsEveryString(
      providerIds.resourceIds,
      [
        APPROVED_VERCEL_PROJECT_ID,
        String(input.deploymentId ?? ""),
        String(input.stagingUrl ?? ""),
        String(input.rollbackDeploymentId ?? ""),
        String(rollbackDeploymentBinding?.stagingUrl ?? ""),
      ],
    )
  ) errors.push("physical proof provider deployment binding mismatch");
  const protectedPreviewReceiptBinding =
    isRecord(input.protectedPreviewReceiptBinding)
      ? input.protectedPreviewReceiptBinding
      : undefined;
  if (
    !nonEmptyString(protectedPreviewReceiptBinding?.receiptId)
    || protectedPreviewReceiptBinding?.deploymentId !== input.deploymentId
    || protectedPreviewReceiptBinding.stagingUrl !== input.stagingUrl
    || protectedPreviewReceiptBinding.sourceCommit !== input.sourceCommit
    || protectedPreviewReceiptBinding.sourceTree !== input.sourceTree
    || !nonEmptyString(protectedPreviewReceiptBinding.confirmationEvidencePath)
    || !isRepositoryRelativePath(
      String(protectedPreviewReceiptBinding.confirmationEvidencePath ?? ""),
    )
    || !isSha256(protectedPreviewReceiptBinding.confirmationBindingSha256)
  ) {
    errors.push(
      "physical proof requires an exact protected-preview receipt, deployment, source and evidence binding",
    );
  }

  const devices = Array.isArray(input.devices) ? input.devices : [];
  if (devices.length !== 2) {
    errors.push("physical proof requires two device records");
  } else {
    const roles = new Set<string>();
    const deviceEvidenceIds = new Set<string>();
    for (const [index, deviceValue] of devices.entries()) {
      if (!isRecord(deviceValue)) {
        errors.push(`physical device record ${index} is invalid`);
        continue;
      }
      const role = deviceValue.role;
      if (role !== "CHILD" && role !== "ADULT") {
        errors.push(`physical device record ${index} must use CHILD or ADULT role`);
      } else if (roles.has(role)) {
        errors.push(`physical device role must be unique: ${role}`);
      } else {
        roles.add(role);
      }
      for (const field of ["deviceType", "operatingSystem", "browser"] as const) {
        if (!nonEmptyString(deviceValue[field])) {
          errors.push(`physical device record ${index} requires nonempty ${field}`);
        }
      }
      if (!isIsoDateTime(deviceValue.observedAt)) {
        errors.push(`physical device record ${index} requires an ISO observedAt timestamp`);
      }
      if (
        !nonEmptyString(deviceValue.deviceEvidenceId)
        || !/^ephemeral-device-evidence-[A-Za-z0-9_-]{8,96}$/u.test(
          deviceValue.deviceEvidenceId,
        )
      ) {
        errors.push(
          `physical device record ${index} requires an ephemeral deviceEvidenceId`,
        );
      } else if (deviceEvidenceIds.has(deviceValue.deviceEvidenceId)) {
        errors.push("physical proof requires two distinct ephemeral deviceEvidenceId values");
      } else {
        deviceEvidenceIds.add(deviceValue.deviceEvidenceId);
      }
      if (deviceValue.syntheticSessionId !== input.syntheticSessionId) {
        errors.push(
          `physical device record ${index} must bind the exact shared syntheticSessionId`,
        );
      }
      if (deviceValue.deploymentId !== input.deploymentId) {
        errors.push(
          `physical device record ${index} must bind the exact shared deploymentId`,
        );
      }
      if (deviceValue.stagingUrl !== input.stagingUrl) {
        errors.push(
          `physical device record ${index} must bind the exact active staging URL`,
        );
      }
      if (
        deviceValue.sourceCommit !== input.sourceCommit
        || deviceValue.sourceTree !== input.sourceTree
      ) {
        errors.push(
          `physical device record ${index} must bind the exact source commit and tree`,
        );
      }
      if (deviceValue.capabilityPresent !== true) {
        errors.push(`physical device record ${index} must record capabilityPresent=true`);
      }
      if (deviceValue.capabilityValueRecorded !== false) {
        errors.push(
          `physical device record ${index} must record capabilityValueRecorded=false`,
        );
      }
      const networkEvidence = deviceValue.networkEvidence ?? deviceValue.network;
      if (!nonEmptyString(networkEvidence)) {
        errors.push(`physical device record ${index} requires nonempty network evidence`);
      }
    }
    if (!roles.has("CHILD") || !roles.has("ADULT")) {
      errors.push("physical proof requires one CHILD and one ADULT device record");
    }
    if (deviceEvidenceIds.size !== 2) {
      errors.push("physical proof requires two distinct ephemeral deviceEvidenceId values");
    }
  }

  const artifactHashes = isRecord(input.artifactHashes)
    ? input.artifactHashes
    : undefined;
  if (
    !nonEmptyString(input.physicalEvidencePath)
    || !isRepositoryRelativePath(input.physicalEvidencePath)
    || !isSha256(input.checksum)
    || artifactHashes?.[input.physicalEvidencePath] !== input.checksum
  ) {
    errors.push("physical proof requires a hash-bound physical evidence artifact");
  }
  if (
    !nonEmptyString(rollbackDeploymentBinding?.evidencePath)
    || artifactHashes?.[rollbackDeploymentBinding.evidencePath]
      !== rollbackDeploymentBinding.evidenceSha256
  ) {
    errors.push("physical proof must hash-bind the known-valid rollback deployment evidence");
  }
  if (
    !nonEmptyString(protectedPreviewReceiptBinding?.confirmationEvidencePath)
    || artifactHashes?.[
      protectedPreviewReceiptBinding.confirmationEvidencePath
    ] !== protectedPreviewReceiptBinding.confirmationBindingSha256
  ) {
    errors.push("physical proof must hash-bind the protected-preview confirmation evidence");
  }
  if (input.sessionFixture !== "synthetic-wp13-12b-only") {
    errors.push("physical proof requires the exact synthetic-wp13-12b-only fixture");
  }
  if (!isProtectedVercelPreviewUrl(input.stagingUrl)) {
    errors.push("physical proof requires a protected HTTPS Vercel preview URL without credentials");
  }
  if (
    !Array.isArray(input.stepResults)
    || input.stepResults.length !== REQUIRED_PHYSICAL_STEP_IDS.length
    || input.stepResults.some((result, index) => (
      !isRecord(result)
      || result.stepId !== REQUIRED_PHYSICAL_STEP_IDS[index]
      || result.passed !== true
      || !isIsoDateTime(result.observedAt)
    ))
  ) {
    errors.push(
      "physical proof requires all 27 documented step IDs in exact order with passed=true",
    );
  } else {
    for (const [index, result] of input.stepResults.entries()) {
      const expectedSessionId = index < 18
        ? input.syntheticSessionId
        : input.deletionSyntheticSessionId;
      const expectedDeploymentId = index < 24
        ? input.deploymentId
        : input.rollbackDeploymentId;
      if (
        !isRecord(result)
        || result.syntheticSessionId !== expectedSessionId
        || result.deploymentId !== expectedDeploymentId
      ) {
        errors.push(
          `physical proof step ${index + 1} must bind its exact session and deployment`,
        );
      }
    }
  }
  const proofResults = isRecord(input.proofResults) ? input.proofResults : undefined;
  for (const result of REQUIRED_PHYSICAL_PROOF_RESULTS) {
    if (proofResults?.[result] !== true) {
      errors.push(`physical proof result must be true: ${result}`);
    }
  }
  if (input.containsPersonData !== false) {
    errors.push("physical proof must confirm no person data");
  }
  const confirmation = isRecord(input.humanSignatureOrExplicitConfirmation)
    ? input.humanSignatureOrExplicitConfirmation
    : undefined;
  const expectedConfirmation = [
    "BEKREFT_WP13_12B_PHYSICAL_PROOF_V1",
    `receiptId=${String(input.receiptId ?? "")}`,
    `sourceCommit=${String(input.sourceCommit ?? "")}`,
    `sourceTree=${String(input.sourceTree ?? "")}`,
    `deploymentId=${String(input.deploymentId ?? "")}`,
    `syntheticSessionId=${String(input.syntheticSessionId ?? "")}`,
    `deletionSyntheticSessionId=${String(input.deletionSyntheticSessionId ?? "")}`,
    `previewReceiptId=${String(protectedPreviewReceiptBinding?.receiptId ?? "")}`,
    `previewEvidenceSha256=${
      String(protectedPreviewReceiptBinding?.confirmationBindingSha256 ?? "")
    }`,
    `rollbackDeploymentId=${String(input.rollbackDeploymentId ?? "")}`,
    `rollbackStagingUrl=${String(rollbackDeploymentBinding?.stagingUrl ?? "")}`,
    `rollbackSourceCommit=${String(rollbackDeploymentBinding?.sourceCommit ?? "")}`,
    `rollbackSourceTree=${String(rollbackDeploymentBinding?.sourceTree ?? "")}`,
    `rollbackEvidenceSha256=${String(rollbackDeploymentBinding?.evidenceSha256 ?? "")}`,
    `evidenceSha256=${String(input.checksum ?? "")}`,
    "adultOperatorsOnly=true",
    "participantsPresent=false",
    "physicallySeparateDevicesConfirmed=true",
  ].join("; ");
  if (
    confirmation?.confirmed !== true
    || confirmation.confirmationText !== expectedConfirmation
    || !isIsoDateTime(confirmation.confirmedAt)
  ) {
    errors.push("physical proof requires the exact evidence-bound human confirmation");
  }
  return errors;
}

function isPhysicalReceiptBoundToProtectedPreview(
  physicalReceipt: Record<string, unknown> | undefined,
  previewReceipt: Record<string, unknown> | undefined,
): boolean {
  if (physicalReceipt === undefined || previewReceipt === undefined) return false;
  const physicalIds = isRecord(physicalReceipt.providerResourceIds)
    ? physicalReceipt.providerResourceIds
    : undefined;
  const previewIds = isRecord(previewReceipt.providerResourceIds)
    ? previewReceipt.providerResourceIds
    : undefined;
  const previewBinding = isRecord(physicalReceipt.protectedPreviewReceiptBinding)
    ? physicalReceipt.protectedPreviewReceiptBinding
    : undefined;
  const physicalRollbackBinding = isRecord(physicalReceipt.rollbackDeploymentBinding)
    ? physicalReceipt.rollbackDeploymentBinding
    : undefined;
  const previewRollbackBinding = isRecord(previewReceipt.rollbackDeploymentBinding)
    ? previewReceipt.rollbackDeploymentBinding
    : undefined;
  if (
    physicalRollbackBinding === undefined
    || previewRollbackBinding === undefined
  ) return false;
  const physicalArtifactHashes = isRecord(physicalReceipt.artifactHashes)
    ? physicalReceipt.artifactHashes
    : undefined;
  const previewArtifactHashes = isRecord(previewReceipt.artifactHashes)
    ? previewReceipt.artifactHashes
    : undefined;
  const previewEvidencePath = previewReceipt.confirmationEvidencePath;
  const previewEvidenceSha256 = previewReceipt.confirmationBindingSha256;
  return nonEmptyString(previewReceipt.receiptId)
    && previewBinding?.receiptId === previewReceipt.receiptId
    && physicalReceipt.sourceCommit === previewReceipt.sourceCommit
    && physicalReceipt.sourceTree === previewReceipt.sourceTree
    && previewReceipt.deploymentSourceCommit === previewReceipt.sourceCommit
    && previewReceipt.deploymentSourceTree === previewReceipt.sourceTree
    && physicalReceipt.deploymentId === previewIds?.deploymentId
    && physicalIds?.deploymentId === previewIds?.deploymentId
    && physicalIds?.vercelProjectId === previewIds?.vercelProjectId
    && physicalReceipt.stagingUrl === previewReceipt.stagingUrl
    && physicalIds?.deploymentUrl === previewReceipt.stagingUrl
    && previewIds?.deploymentUrl === previewReceipt.stagingUrl
    && previewBinding?.deploymentId === previewIds?.deploymentId
    && previewBinding.stagingUrl === previewReceipt.stagingUrl
    && previewBinding.sourceCommit === previewReceipt.sourceCommit
    && previewBinding.sourceTree === previewReceipt.sourceTree
    && nonEmptyString(previewEvidencePath)
    && isSha256(previewEvidenceSha256)
    && previewBinding.confirmationEvidencePath === previewEvidencePath
    && previewBinding.confirmationBindingSha256 === previewEvidenceSha256
    && previewArtifactHashes?.[previewEvidencePath] === previewEvidenceSha256
    && physicalArtifactHashes?.[previewEvidencePath] === previewEvidenceSha256
    && physicalReceipt.rollbackDeploymentId === previewReceipt.rollbackDeploymentId
    && physicalIds?.rollbackDeploymentId === previewReceipt.rollbackDeploymentId
    && previewIds?.rollbackDeploymentId === previewReceipt.rollbackDeploymentId
    && physicalRollbackBinding?.deploymentId === previewReceipt.rollbackDeploymentId
    && previewRollbackBinding?.deploymentId === previewReceipt.rollbackDeploymentId
    && physicalRollbackBinding.stagingUrl === previewRollbackBinding.stagingUrl
    && physicalIds?.rollbackDeploymentUrl === previewRollbackBinding.stagingUrl
    && previewIds?.rollbackDeploymentUrl === previewRollbackBinding.stagingUrl
    && physicalRollbackBinding.sourceCommit === previewRollbackBinding.sourceCommit
    && physicalRollbackBinding.sourceTree === previewRollbackBinding.sourceTree
    && physicalRollbackBinding.safeDisabled === true
    && previewRollbackBinding.safeDisabled === true
    && physicalRollbackBinding.evidencePath === previewRollbackBinding.evidencePath
    && physicalRollbackBinding.evidenceSha256
      === previewRollbackBinding.evidenceSha256
    && nonEmptyString(previewRollbackBinding.evidencePath)
    && isSha256(previewRollbackBinding.evidenceSha256)
    && previewArtifactHashes?.[previewRollbackBinding.evidencePath]
      === previewRollbackBinding.evidenceSha256
    && physicalArtifactHashes?.[previewRollbackBinding.evidencePath]
      === previewRollbackBinding.evidenceSha256;
}

export function validateReceipt(input: unknown, expected: {
  readonly sourceCommit?: string;
  readonly sourceTree?: string;
  readonly decisionRecordChecksum?: string;
  readonly providerIdRequired?: boolean;
  readonly physicalDeviceProof?: boolean;
} = {}): ReceiptValidationResult {
  if (!isRecord(input)) return { valid: false, evidence: false, errors: ["receipt is invalid"] };
  if (
    input.status === "UNFILLED_TEMPLATE_NOT_EVIDENCE"
    && input.templateMarker === "UNFILLED_TEMPLATE_NOT_EVIDENCE"
  ) return { valid: true, evidence: false, errors: [] };
  const errors: string[] = [];
  for (const field of [
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
  ]) {
    if (!(field in input)) errors.push(`receipt missing ${field}`);
  }
  if (input.status !== "COMPLETED_WITH_AUTHENTIC_EVIDENCE") errors.push("receipt status is not authentic evidence");
  if (
    !isRecord(input.humanSignatureOrExplicitConfirmation)
    || input.humanSignatureOrExplicitConfirmation.confirmed !== true
  ) errors.push("receipt requires human signature or explicit confirmation");
  if (!Array.isArray(input.commandsRun) || input.commandsRun.length === 0) errors.push("receipt requires actual commands");
  if (!isRecord(input.artifactHashes) || Object.keys(input.artifactHashes).length === 0) {
    errors.push("receipt requires artifact hashes");
  }
  const expectedDecisionRecordChecksum = expected.decisionRecordChecksum
    ?? "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754";
  if (input.decisionRecordChecksum !== expectedDecisionRecordChecksum) {
    errors.push("receipt decision checksum mismatch");
  }
  if (input.opensB8 === true || input.authorizesStudentBeta === true) {
    errors.push("receipt cannot open B8 or student beta");
  }
  if (input.syntheticOrFabricated === true) errors.push("synthetic or fabricated receipt is forbidden");
  if (input.providerResourceIds !== undefined && input.providerResourceIds !== null) {
    if (input.providerResourceIds === "NONE" && input.status === "COMPLETED_WITH_AUTHENTIC_EVIDENCE") {
      errors.push("completed receipt cannot use a fabricated NONE provider id");
    }
  }
  if (input.sourceCommit !== undefined && input.sourceCommit !== "") {
    if (input.expectedSourceCommit !== undefined && input.sourceCommit !== input.expectedSourceCommit) {
      errors.push("receipt is bound to the wrong commit");
    }
    if (input.sourceCommit === "PENDING_FINAL_COMMIT") errors.push("filled receipt cannot use pending commit");
  }
  if (input.providerResourceIds === undefined && input.receiptType !== "EMULATOR_PROOF_RECEIPT") {
    errors.push("provider receipt requires provider resource identifiers");
  }
  if (input.sourceCommit !== undefined && input.sourceCommit !== input.expectedSourceCommit && input.expectedSourceCommit !== undefined) {
    errors.push("receipt source commit mismatch");
  }
  if (input.sourceCommit !== undefined && input.sourceCommit !== "" && input.sourceCommit !== input.expectedSourceCommit && input.expectedSourceCommit === undefined && String(input.sourceCommit).length !== 40) {
    errors.push("receipt source commit must be a full SHA");
  }
  if (input.sourceCommit !== undefined && input.sourceCommit === input.expectedSourceCommit && input.expectedSourceCommit !== undefined) {
    // Explicitly accepted binding.
  } else if (input.sourceCommit !== undefined && input.sourceCommit !== "" && input.expectedSourceCommit !== undefined) {
    errors.push("receipt source commit does not match expected commit");
  }
  if (input.providerResourceIds !== undefined && input.providerResourceIds !== "NONE" && !isRecord(input.providerResourceIds)) {
    errors.push("provider resource identifiers must be a record");
  }
  if (input.receiptType !== PHYSICAL_RECEIPT_TYPE && input.physicalProof === true) {
    errors.push("non-physical receipt cannot assert physical proof");
  }
  if (input.providerResourceIds === undefined && input.status === "COMPLETED_WITH_AUTHENTIC_EVIDENCE") {
    errors.push("filled receipt requires provider IDs or explicit emulator classification");
  }
  if (input.commandsRun !== undefined && stringArray(input.commandsRun).length === 0) {
    errors.push("commandsRun must contain strings");
  }
  if (input.sourceCommit !== undefined && input.sourceCommit === "FABRICATED") errors.push("fabricated receipt");
  if (input.humanSignatureOrExplicitConfirmation === "FABRICATED") errors.push("fabricated signature");
  if (input.status === "PASSED" && input.receiptType !== undefined) errors.push("ambiguous passed status is forbidden");
  if (input.physicalProof === true && input.receiptType !== PHYSICAL_RECEIPT_TYPE) {
    errors.push("physicalProof=true requires a physical two-device receipt");
  }
  if (input.sourceCommit !== undefined && input.sourceCommit !== "" && String(input.sourceCommit).length !== 40) {
    errors.push("source commit must be full SHA");
  }
  if (input.sourceTree !== undefined && input.sourceTree !== "" && String(input.sourceTree).length !== 40) {
    errors.push("source tree must be full SHA");
  }
  if (input.artifactHashes !== undefined && isRecord(input.artifactHashes)) {
    for (const [path, digest] of Object.entries(input.artifactHashes)) {
      if (!isRepositoryRelativePath(path)) {
        errors.push("artifact hash key must be a repository-relative file path");
      }
      if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) errors.push("artifact hash must be SHA-256");
    }
  }
  if (input.providerResourceIds !== undefined && input.providerResourceIds !== "NONE" && isRecord(input.providerResourceIds)) {
    if (input.receiptType !== "EMULATOR_PROOF_RECEIPT" && Object.keys(input.providerResourceIds).length === 0) {
      errors.push("provider receipt requires a provider ID");
    }
  }
  if (input.environment === "PRODUCTION") errors.push("production receipt is outside WP13.12B");
  if (input.authorizesProduction === true) errors.push("receipt cannot authorize production");
  if (input.realParticipantData === true) errors.push("receipt cannot contain real participant data");
  if (input.receiptType === "EMULATOR_PROOF_RECEIPT" && input.providerResourceIds === undefined) {
    errors.push("emulator receipt must explicitly record zero provider resources");
  }
  if (input.receiptType === "EMULATOR_PROOF_RECEIPT" && input.providerResourceIds === "NONE") {
    // An emulator receipt may truthfully have no provider resource ID.
    const index = errors.indexOf("completed receipt cannot use a fabricated NONE provider id");
    if (index >= 0) errors.splice(index, 1);
  }
  if (input.receiptType === "EMULATOR_PROOF_RECEIPT" && input.physicalProof === true) {
    errors.push("emulator receipt cannot claim physical proof");
  }
  if (
    input.receiptType === "EMULATOR_PROOF_RECEIPT"
    && input.schemaVersion === "wp13.12b-receipt-v2"
    && !isChallengeBoundEmulatorReceipt(input)
  ) errors.push("v2 emulator receipt is not bound to the exact PR3 challenge");
  errors.push(...validateGenericProofResults(input));
  if (input.receiptType === "FIREBASE_PROJECT_AND_REGION_RECEIPT") {
    errors.push(...validateFirebaseProjectAndRegionReceipt(input));
  }
  if (input.receiptType === "IAM_AND_BILLING_RECEIPT") {
    errors.push(...validateIamAndBillingReceipt(input));
  }
  if (input.receiptType === "PROTECTED_PREVIEW_RECEIPT") {
    errors.push(...validateProtectedPreviewReceipt(input));
  }
  if (input.receiptType === PHYSICAL_RECEIPT_TYPE) {
    errors.push(...validatePhysicalReceipt(input));
  }
  if (input.receiptType !== undefined && ![
    "EMULATOR_PROOF_RECEIPT",
    "FIREBASE_PROJECT_AND_REGION_RECEIPT",
    "IAM_AND_BILLING_RECEIPT",
    "PROTECTED_PREVIEW_RECEIPT",
    PHYSICAL_RECEIPT_TYPE,
  ].includes(String(input.receiptType))) errors.push("unknown receipt type");
  if (input.receiptId === "UNFILLED") errors.push("filled receipt cannot use UNFILLED id");
  if (input.createdAt === "") errors.push("filled receipt requires createdAt");
  if (input.performedBy === "") errors.push("filled receipt requires performedBy");
  if (input.sourceCommit === "") errors.push("filled receipt requires sourceCommit");
  if (input.sourceTree === "") errors.push("filled receipt requires sourceTree");
  if (input.limitations !== undefined && !Array.isArray(input.limitations)) errors.push("limitations must be an array");
  if (input.status === "UNFILLED_TEMPLATE_NOT_EVIDENCE") {
    errors.push("unfilled marker without canonical template marker is not evidence");
  }
  if (expected.sourceCommit !== undefined && input.sourceCommit !== expected.sourceCommit) {
    errors.push("receipt is bound to the wrong expected commit");
  }
  if (expected.sourceTree !== undefined && input.sourceTree !== expected.sourceTree) {
    errors.push("receipt is bound to the wrong source tree");
  }
  if (
    expected.providerIdRequired === true
    && (!isRecord(input.providerResourceIds) || Object.keys(input.providerResourceIds).length === 0)
  ) errors.push("provider ID is required");
  if (
    expected.physicalDeviceProof === true
    && input.receiptType !== PHYSICAL_RECEIPT_TYPE
  ) errors.push("expected physical proof requires a physical two-device receipt");
  if (
    expected.physicalDeviceProof === true
    && (!Array.isArray(input.devices) || input.devices.length !== 2)
  ) errors.push("two physical devices are required");
  return { valid: errors.length === 0, evidence: errors.length === 0, errors };
}

export function derivePr3ProofFamiliesFromValidatedReceipts(
  validatedReceipts: readonly unknown[],
): readonly string[] {
  const receiptByType = new Map<string, Record<string, unknown>>();
  for (const receipt of validatedReceipts) {
    if (isRecord(receipt) && nonEmptyString(receipt.receiptType)) {
      receiptByType.set(receipt.receiptType, receipt);
    }
  }
  const families: string[] = [];
  const emulatorReceipt = receiptByType.get("EMULATOR_PROOF_RECEIPT");
  if (isChallengeBoundEmulatorReceipt(emulatorReceipt)) {
    families.push("EMULATOR");
  }
  if (receiptByType.has("IAM_AND_BILLING_RECEIPT")) {
    families.push("IAM_AND_BILLING");
  }
  if (receiptByType.has("FIREBASE_PROJECT_AND_REGION_RECEIPT")) {
    families.push("FIREBASE_DISABLED_FIRST_DEPLOYMENT");
  }
  const previewReceipt = receiptByType.get("PROTECTED_PREVIEW_RECEIPT");
  if (previewReceipt !== undefined) families.push("PROTECTED_PREVIEW");
  const physicalReceipt = receiptByType.get(PHYSICAL_RECEIPT_TYPE);
  const physicalReceiptBoundToPreview = isPhysicalReceiptBoundToProtectedPreview(
    physicalReceipt,
    previewReceipt,
  );
  if (physicalReceiptBoundToPreview) families.push("PHYSICAL_TWO_DEVICE");
  const physicalProofResults = isRecord(physicalReceipt?.proofResults)
    ? physicalReceipt.proofResults
    : undefined;
  if (
    physicalReceiptBoundToPreview
    && physicalProofResults?.stop === true
    && physicalProofResults.deletion === true
    && physicalProofResults.no_resurrection === true
    && physicalProofResults.delayed_command_after_stop === true
    && physicalProofResults.reconnect_after_stop_terminal === true
    && physicalProofResults.cached_capability_after_deletion === true
  ) families.push("STOP_DELETION_NO_RESURRECTION");
  if (
    physicalReceiptBoundToPreview
    && physicalProofResults?.kill_switch === true
  ) {
    families.push("KILL_SWITCH");
  }
  const previewProofResults = isRecord(previewReceipt?.proofResults)
    ? previewReceipt.proofResults
    : undefined;
  if (
    physicalReceiptBoundToPreview
    && previewProofResults?.rollback_target_verified === true
    && previewProofResults.rollback_to_safe_disabled_state === true
    && physicalProofResults?.rollback_to_safe_disabled_state === true
    && physicalProofResults.deleted_session_after_rollback === true
  ) families.push("ROLLBACK_TO_SAFE_DISABLED_STATE");
  return Object.freeze(families);
}

export function validateExternalActivationState(
  input: unknown,
  authenticValidatedReceiptTypes: readonly string[] = [],
  authenticValidatedPr3ProofFamilies: readonly string[] = [],
): readonly string[] {
  if (!isRecord(input)) return ["external activation state is missing or invalid"];
  const errors: string[] = [];
  if (input.schemaVersion !== "wp13.12b-ea-state-v1") {
    errors.push("external activation state schema mismatch");
  }
  if (input.overlayId !== "wp13-12b-ea-current-state") {
    errors.push("external activation overlay id mismatch");
  }
  if (![
    "IN_PROGRESS_AUTHENTIC_EVIDENCE_PENDING",
    "ACTIVE_SYNTHETIC_STAGING_WITH_AUTHENTIC_EVIDENCE",
    "DISABLED_PENDING_DESTRUCTION",
    "DESTROYED_WITH_AUTHENTIC_EVIDENCE",
  ].includes(String(input.overlayStatus))) {
    errors.push("external activation overlay status is invalid");
  }

  const baseline = isRecord(input.historicalRepositoryBaseline)
    ? input.historicalRepositoryBaseline
    : undefined;
  if (
    baseline?.authorizationStatusPath !== "release/wp13-12b/authorization-status.json"
    || baseline.repositoryContractPath !== "release/wp13-12b/staging-activation/repository-contract.json"
    || baseline.preservedWithoutMutation !== true
    || baseline.providerActivationAtRepositoryPhase !== "BLOCKED"
    || baseline.cloudResourcesAtRepositoryPhase !== 0
    || baseline.externalReceiptsAtRepositoryPhase !== 0
  ) {
    errors.push("historical repository baseline must remain an immutable zero-resource snapshot");
  }

  const authorizationEvidence = stringArray(input.authorizationEvidence);
  for (const required of [
    "release/wp13-12b/external-activation/owner-authorization.json",
    "release/wp13-12b/external-activation/cloud-field-approval.json",
  ]) {
    if (!authorizationEvidence.includes(required)) {
      errors.push(`external activation authorization evidence missing: ${required}`);
    }
  }

  const evidence = isRecord(input.evidence) ? input.evidence : undefined;
  const historicalReceiptPaths =
    stringArray(evidence?.historicalReceiptPaths);
  for (const path of historicalReceiptPaths) {
    if (
      !isRepositoryRelativePath(path)
      || !path.startsWith("release/wp13-12b/receipts/actual/")
      || !path.endsWith(".json")
    ) errors.push(`historical external activation receipt path is invalid: ${path}`);
  }
  if (
    evidence?.historicalReceiptCount !== undefined
    && evidence.historicalReceiptCount !== historicalReceiptPaths.length
  ) errors.push("historical receipt count does not match receipt paths");
  if (
    evidence?.historicalEmulatorProof !== undefined
    && ![
      "NOT_RECORDED",
      "PRESERVED_NOT_FRESH_V2_NONCE_EVIDENCE",
    ].includes(String(evidence.historicalEmulatorProof))
  ) errors.push("historical emulator proof state is invalid");
  if (
    evidence?.historicalEmulatorProof
      === "PRESERVED_NOT_FRESH_V2_NONCE_EVIDENCE"
    && historicalReceiptPaths.length === 0
  ) errors.push("preserved historical emulator proof requires a historical receipt path");
  const receiptPaths = stringArray(evidence?.validatedReceiptPaths);
  for (const path of receiptPaths) {
    if (
      !isRepositoryRelativePath(path)
      || !path.startsWith("release/wp13-12b/receipts/actual/")
      || !path.endsWith(".json")
    ) errors.push(`external activation receipt path is invalid: ${path}`);
  }
  if (evidence?.validatedReceiptCount !== receiptPaths.length) {
    errors.push("validated receipt count does not match receipt paths");
  }
  if (
    historicalReceiptPaths.some((path) => receiptPaths.includes(path))
  ) errors.push("historical receipts cannot substitute for current validated receipts");
  if (![
    "NOT_RECORDED",
    "AUTHENTIC_EVIDENCE_RECORDED",
  ].includes(String(evidence?.emulatorProof))) {
    errors.push("emulator proof state is invalid");
  }
  if (evidence?.emulatorProof === "AUTHENTIC_EVIDENCE_RECORDED" && receiptPaths.length === 0) {
    errors.push("recorded emulator proof requires a validated receipt path");
  }
  if (![
    "PENDING_AUTHENTIC_RECEIPTS",
    "AUTHENTIC_RECEIPTS_RECORDED",
  ].includes(String(evidence?.cloudProviderReadback))) {
    errors.push("cloud provider readback state is invalid");
  }
  if (![
    "NOT_PERFORMED",
    "AUTHENTIC_EVIDENCE_RECORDED",
  ].includes(String(evidence?.physicalTwoDeviceProof))) {
    errors.push("physical two-device proof state is invalid");
  }
  if (
    evidence?.physicalTwoDeviceProof === "AUTHENTIC_EVIDENCE_RECORDED"
    && !authenticValidatedReceiptTypes.includes(PHYSICAL_RECEIPT_TYPE)
  ) errors.push("recorded physical proof requires an authentic validated physical receipt");

  const proofFamilyMap = isRecord(input.pr3ProofFamilies)
    ? input.pr3ProofFamilies
    : undefined;
  const exactProofFamilyKeys = [...REQUIRED_PR3_PROOF_FAMILIES].sort();
  const actualProofFamilyKeys = proofFamilyMap === undefined
    ? []
    : Object.keys(proofFamilyMap).sort();
  if (
    actualProofFamilyKeys.length !== exactProofFamilyKeys.length
    || actualProofFamilyKeys.some(
      (family, index) => family !== exactProofFamilyKeys[index],
    )
  ) errors.push("PR3 proof-family map must contain the exact required families");
  if (
    new Set(authenticValidatedPr3ProofFamilies).size
    !== authenticValidatedPr3ProofFamilies.length
    || authenticValidatedPr3ProofFamilies.some(
      (family) => !REQUIRED_PR3_PROOF_FAMILIES.includes(
        family as (typeof REQUIRED_PR3_PROOF_FAMILIES)[number],
      ),
    )
  ) errors.push("validated PR3 proof families contain duplicates or unknown families");
  for (const family of REQUIRED_PR3_PROOF_FAMILIES) {
    const recorded = proofFamilyMap?.[family] === "AUTHENTIC_EVIDENCE_RECORDED";
    if (
      proofFamilyMap?.[family] !== "NOT_RECORDED"
      && proofFamilyMap?.[family] !== "AUTHENTIC_EVIDENCE_RECORDED"
    ) errors.push(`PR3 proof-family state is invalid: ${family}`);
    if (recorded !== authenticValidatedPr3ProofFamilies.includes(family)) {
      errors.push(`PR3 proof-family state is not receipt-derived: ${family}`);
    }
  }
  const allPr3ProofFamiliesRecorded = REQUIRED_PR3_PROOF_FAMILIES.every(
    (family) => proofFamilyMap?.[family] === "AUTHENTIC_EVIDENCE_RECORDED",
  );
  const pr3EvidenceComplete = (
    allPr3ProofFamiliesRecorded
    && authenticValidatedPr3ProofFamilies.length
      === REQUIRED_PR3_PROOF_FAMILIES.length
    && evidence?.emulatorProof === "AUTHENTIC_EVIDENCE_RECORDED"
    && evidence?.cloudProviderReadback === "AUTHENTIC_RECEIPTS_RECORDED"
    && evidence?.physicalTwoDeviceProof === "AUTHENTIC_EVIDENCE_RECORDED"
    && authenticValidatedReceiptTypes.includes(PHYSICAL_RECEIPT_TYPE)
  );
  if (input.pr3 !== "NOT_ACHIEVED" && input.pr3 !== "ACHIEVED") {
    errors.push("PR3 status is invalid");
  } else if ((input.pr3 === "ACHIEVED") !== pr3EvidenceComplete) {
    errors.push("PR3 status must be derived from the complete authentic proof-family set");
  }

  const cloud = isRecord(input.cloudState) ? input.cloudState : undefined;
  if (
    cloud?.inventoryPath
    !== "release/wp13-12b/external-activation/resource-inventory.json"
  ) errors.push("external activation resource inventory path mismatch");
  if (![
    "PENDING_AUTHENTIC_PROVIDER_READBACK",
    "AUTHENTIC_PROVIDER_SNAPSHOT",
    "DESTRUCTION_VERIFIED_ZERO_RESOURCES",
  ].includes(String(cloud?.inventoryStatus))) {
    errors.push("external activation inventory status is invalid");
  }
  if (![
    "IN_PROGRESS_NOT_YET_RECEIPT_COMPLETE",
    "ACTIVE_WITH_AUTHENTIC_EVIDENCE",
    "DISABLED",
    "DESTROYED",
  ].includes(String(cloud?.providerActivation))) {
    errors.push("external activation provider state is invalid");
  }
  if (cloud?.inventoryStatus === "PENDING_AUTHENTIC_PROVIDER_READBACK") {
    if (cloud.resourceCount !== null) {
      errors.push("pending cloud inventory must use null resource count");
    }
    if (cloud.zeroResourcesAsserted !== false) {
      errors.push("pending cloud inventory cannot assert zero resources");
    }
  } else if (!Number.isInteger(cloud?.resourceCount) || Number(cloud?.resourceCount) < 0) {
    errors.push("authenticated cloud inventory requires a nonnegative resource count");
  }
  if (
    input.overlayStatus === "ACTIVE_SYNTHETIC_STAGING_WITH_AUTHENTIC_EVIDENCE"
    && (
      evidence?.emulatorProof !== "AUTHENTIC_EVIDENCE_RECORDED"
      || evidence?.cloudProviderReadback !== "AUTHENTIC_RECEIPTS_RECORDED"
      || cloud?.inventoryStatus !== "AUTHENTIC_PROVIDER_SNAPSHOT"
      || cloud.providerActivation !== "ACTIVE_WITH_AUTHENTIC_EVIDENCE"
    )
  ) errors.push("active overlay requires authentic provider receipts and inventory");
  if (input.overlayStatus === "ACTIVE_SYNTHETIC_STAGING_WITH_AUTHENTIC_EVIDENCE") {
    if (authenticValidatedReceiptTypes.length !== receiptPaths.length) {
      errors.push("active overlay receipt paths must all resolve to authentic validated receipt types");
    }
    for (const receiptType of REQUIRED_ACTIVE_EXTERNAL_RECEIPT_TYPES) {
      if (!authenticValidatedReceiptTypes.includes(receiptType)) {
        errors.push(`active overlay requires authentic validated receipt type: ${receiptType}`);
      }
    }
  }
  if (
    input.overlayStatus === "IN_PROGRESS_AUTHENTIC_EVIDENCE_PENDING"
    && (
      evidence?.cloudProviderReadback !== "PENDING_AUTHENTIC_RECEIPTS"
      || cloud?.inventoryStatus !== "PENDING_AUTHENTIC_PROVIDER_READBACK"
      || cloud.providerActivation !== "IN_PROGRESS_NOT_YET_RECEIPT_COMPLETE"
    )
  ) errors.push("in-progress overlay must remain pending without cloud assertions");
  if (
    input.overlayStatus === "DISABLED_PENDING_DESTRUCTION"
    && cloud?.providerActivation !== "DISABLED"
  ) errors.push("disabled overlay must record disabled provider state");
  if (
    input.overlayStatus === "DESTROYED_WITH_AUTHENTIC_EVIDENCE"
    && (
      cloud?.providerActivation !== "DESTROYED"
      || cloud.inventoryStatus !== "DESTRUCTION_VERIFIED_ZERO_RESOURCES"
      || cloud.resourceCount !== 0
      || cloud.zeroResourcesAsserted !== true
    )
  ) errors.push("destroyed overlay requires authentic zero-resource destruction evidence");

  const ceilings = isRecord(input.safetyCeilings) ? input.safetyCeilings : undefined;
  const exactCeilings: Readonly<Record<string, unknown>> = {
    syntheticDataOnly: true,
    realParticipantData: false,
    stableParticipantIdentity: false,
    firebaseAuthentication: false,
    studentBeta: "NOT_AUTHORIZED",
    recruitment: "NOT_AUTHORIZED",
    production: "NOT_AUTHORIZED",
    b8: "NOT_DECISION_READY",
    wp13_12c: "BLOCKED",
  };
  for (const [field, expected] of Object.entries(exactCeilings)) {
    if (ceilings?.[field] !== expected) {
      errors.push(`external activation safety ceiling mismatch: ${field}`);
    }
  }
  return errors;
}

export function validateExternalResourceInventory(input: unknown): readonly string[] {
  if (!isRecord(input)) return ["external resource inventory is missing or invalid"];
  const errors: string[] = [];
  if (input.schemaVersion !== "wp13.12b-ea-resource-inventory-v1") {
    errors.push("external resource inventory schema mismatch");
  }
  if (input.inventoryId !== "wp13-12b-ea-current-resource-inventory") {
    errors.push("external resource inventory id mismatch");
  }
  const status = String(input.inventoryStatus);
  if (![
    "PENDING_AUTHENTIC_PROVIDER_READBACK",
    "AUTHENTIC_PROVIDER_SNAPSHOT",
    "DESTRUCTION_VERIFIED_ZERO_RESOURCES",
  ].includes(status)) {
    errors.push("external resource inventory status is invalid");
  }
  if (
    input.approvedContextReference
    !== "release/wp13-12b/external-activation/cloud-field-approval.json"
  ) errors.push("resource inventory approved context reference mismatch");
  if (
    typeof input.pendingInventorySemantics !== "string"
    || !input.pendingInventorySemantics.toLowerCase().includes("not a zero-resource claim")
  ) errors.push("resource inventory must define pending non-zero-assertion semantics");
  if (!Array.isArray(input.resources)) errors.push("resource inventory resources must be an array");
  const resources = Array.isArray(input.resources) ? input.resources : [];
  const observation = isRecord(input.observation) ? input.observation : undefined;
  const observationEvidencePaths = stringArray(observation?.evidencePaths);
  const operatorEvidence = isRecord(input.operatorEvidence)
    ? input.operatorEvidence
    : undefined;
  const exactOperatorEvidencePath =
    "artifacts/wp13-12b-external-resource-inventory.json";
  if (operatorEvidence?.path !== exactOperatorEvidencePath) {
    errors.push("resource inventory operator evidence path mismatch");
  }

  if (status === "PENDING_AUTHENTIC_PROVIDER_READBACK") {
    if (input.resourceCount !== null) errors.push("pending inventory resource count must be null");
    if (input.zeroResourcesAsserted !== false) {
      errors.push("pending inventory cannot assert zero resources");
    }
    if (resources.length !== 0) errors.push("pending inventory cannot contain unverified resources");
    if (
      observation?.observedAt !== null
      || observation.performedBy !== null
      || stringArray(observation.providerReadbackCommands).length !== 0
      || observationEvidencePaths.length !== 0
    ) errors.push("pending inventory cannot claim a provider observation");
    if (
      operatorEvidence?.artifactSha256 !== null
      || operatorEvidence.inventoryDigest !== null
      || operatorEvidence.overlayResourcesDigest !== null
      || operatorEvidence.schemaVersion !== null
      || operatorEvidence.source !== null
      || operatorEvidence.mode !== null
      || operatorEvidence.authenticatedVercelReadback !== false
      || operatorEvidence.blockerCount !== null
    ) errors.push("pending inventory cannot claim operator evidence");
  } else {
    if (!Number.isInteger(input.resourceCount) || Number(input.resourceCount) < 0) {
      errors.push("provider inventory resource count must be a nonnegative integer");
    } else if (input.resourceCount !== resources.length) {
      errors.push("provider inventory resource count does not match resources");
    } else if (input.zeroResourcesAsserted !== (input.resourceCount === 0)) {
      errors.push("provider inventory zero-resource assertion does not match resource count");
    }
    if (
      !isIsoDateTime(observation?.observedAt)
      || typeof observation.performedBy !== "string"
      || observation.performedBy.trim().length === 0
      || stringArray(observation.providerReadbackCommands).length === 0
      || observationEvidencePaths.length === 0
    ) errors.push("authenticated provider inventory requires observation evidence");
    if (
      operatorEvidence?.schemaVersion
        !== "wp13.12b-ea-operator-resource-inventory-v2"
      || operatorEvidence.source !== "LIVE_READ_ONLY_PROVIDER_QUERIES"
      || operatorEvidence.mode !== "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION"
      || !isSha256(operatorEvidence.artifactSha256)
      || !isSha256(operatorEvidence.inventoryDigest)
      || !isSha256(operatorEvidence.overlayResourcesDigest)
      || operatorEvidence.authenticatedVercelReadback !== true
      || operatorEvidence.blockerCount !== 0
      || !observationEvidencePaths.includes(exactOperatorEvidencePath)
    ) errors.push("authenticated inventory requires exact hash-bound operator v2 evidence");
    if (
      status === "DESTRUCTION_VERIFIED_ZERO_RESOURCES"
      && (input.resourceCount !== 0 || input.zeroResourcesAsserted !== true)
    ) errors.push("destruction inventory must authentically assert zero resources");
  }

  for (const path of observationEvidencePaths) {
    if (!isRepositoryRelativePath(path)) {
      errors.push(`resource inventory observation evidence path is invalid: ${path}`);
    }
  }
  if (new Set(observationEvidencePaths).size !== observationEvidencePaths.length) {
    errors.push("resource inventory observation evidence paths must be unique");
  }

  const exactResourceFields = [
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
  ] as const;
  const exactResourceFieldSet = new Set<string>(exactResourceFields);
  const requiredStringFields = [
    "resourceId",
    "provider",
    "region",
    "purpose",
    "owner",
    "retention",
    "deletionMethod",
    "costRisk",
    "receiptReference",
    "lifecycleStatus",
    "evidencePath",
  ] as const;
  const resourceIds = new Set<string>();
  let previousResourceId: string | undefined;

  for (const [index, resource] of resources.entries()) {
    if (!isRecord(resource)) {
      errors.push(`resource inventory item ${index} is invalid`);
      continue;
    }
    for (const field of requiredStringFields) {
      if (typeof resource[field] !== "string" || resource[field].trim().length === 0) {
        errors.push(`resource inventory item ${index} missing ${field}`);
      }
    }
    for (const field of Object.keys(resource)) {
      if (!exactResourceFieldSet.has(field)) {
        errors.push(`resource inventory item ${index} contains unexpected field: ${field}`);
      }
      if (
        !exactResourceFieldSet.has(field)
        && /secret|token|private.?key|credential|password|capability/iu.test(field)
      ) errors.push(`resource inventory item ${index} contains forbidden secret field: ${field}`);
    }
    if (!isIsoDateTime(resource.createdAt)) {
      errors.push(`resource inventory item ${index} has invalid createdAt timestamp`);
    }
    if (resource.containsRealData !== false) {
      errors.push(`resource inventory item ${index} must declare containsRealData=false`);
    }
    if (resource.destructionDeadline !== "2027-01-25") {
      errors.push(`resource inventory item ${index} destruction deadline mismatch`);
    }
    if (resource.syntheticOnly !== true) {
      errors.push(`resource inventory item ${index} must be synthetic-only`);
    }
    if (
      typeof resource.evidencePath === "string"
      && !isRepositoryRelativePath(resource.evidencePath)
    ) errors.push(`resource inventory item ${index} evidence path must be repository-relative`);
    if (
      status !== "PENDING_AUTHENTIC_PROVIDER_READBACK"
      && resource.evidencePath !== exactOperatorEvidencePath
    ) errors.push(`resource inventory item ${index} must bind the exact operator evidence path`);
    if (
      typeof resource.receiptReference === "string"
      && (
        !isRepositoryRelativePath(resource.receiptReference)
        || !resource.receiptReference.startsWith("release/wp13-12b/receipts/actual/")
        || !resource.receiptReference.endsWith(".json")
      )
    ) errors.push(`resource inventory item ${index} receipt reference is invalid`);
    if (typeof resource.resourceId === "string" && resource.resourceId.trim().length > 0) {
      if (resourceIds.has(resource.resourceId)) {
        errors.push(`resource inventory resourceId must be unique: ${resource.resourceId}`);
      }
      if (
        previousResourceId !== undefined
        && previousResourceId.localeCompare(resource.resourceId) >= 0
      ) errors.push("resource inventory resources must be deterministically sorted by resourceId");
      resourceIds.add(resource.resourceId);
      previousResourceId = resource.resourceId;
    }
  }

  const ceilings = isRecord(input.scopeCeilings) ? input.scopeCeilings : undefined;
  for (const [field, expected] of Object.entries({
    syntheticDataOnly: true,
    realParticipantData: false,
    firebaseAuthentication: false,
    production: false,
    wp13_12c: false,
  })) {
    if (ceilings?.[field] !== expected) {
      errors.push(`resource inventory scope ceiling mismatch: ${field}`);
    }
  }
  return errors;
}
