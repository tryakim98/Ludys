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

export function validateReceipt(input: unknown, expected: {
  readonly sourceCommit?: string;
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
  if (
    input.decisionRecordChecksum !== "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754"
  ) errors.push("receipt decision checksum mismatch");
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
  if (input.receiptType === "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT") {
    if (!Array.isArray(input.devices) || input.devices.length !== 2) {
      errors.push("physical proof requires two device records");
    }
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
  if (input.receiptType === "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT" && input.physicalProof !== true) {
    errors.push("physical receipt must explicitly assert physical proof");
  }
  if (input.receiptType !== "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT" && input.physicalProof === true) {
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
  if (input.physicalProof === true && (!Array.isArray(input.devices) || input.devices.length !== 2)) {
    errors.push("physical proof requires device information");
  }
  if (input.sourceCommit !== undefined && input.sourceCommit !== "" && String(input.sourceCommit).length !== 40) {
    errors.push("source commit must be full SHA");
  }
  if (input.sourceTree !== undefined && input.sourceTree !== "" && String(input.sourceTree).length !== 40) {
    errors.push("source tree must be full SHA");
  }
  if (input.artifactHashes !== undefined && isRecord(input.artifactHashes)) {
    for (const digest of Object.values(input.artifactHashes)) {
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
  if (input.receiptType === "PROTECTED_PREVIEW_RECEIPT" && input.stagingUrl === undefined) {
    errors.push("preview receipt requires a staging URL");
  }
  if (input.receiptType === "FIREBASE_PROJECT_AND_REGION_RECEIPT" && input.selectedRegion !== "europe-north1") {
    errors.push("project receipt region mismatch");
  }
  if (input.receiptType === "IAM_AND_BILLING_RECEIPT" && input.billingAlertConfigured !== true) {
    errors.push("IAM and billing receipt requires billing alert evidence");
  }
  if (input.receiptType === "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT" && input.checksum === undefined) {
    errors.push("physical proof requires checksum");
  }
  if (input.receiptType === "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT" && input.stagingUrl === undefined) {
    errors.push("physical proof requires staging URL");
  }
  if (input.receiptType === "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT" && input.sessionFixture === undefined) {
    errors.push("physical proof requires synthetic session fixture");
  }
  if (input.receiptType === "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT" && !Array.isArray(input.stepResults)) {
    errors.push("physical proof requires step results");
  }
  if (input.receiptType === "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT" && input.containsPersonData !== false) {
    errors.push("physical proof must confirm no person data");
  }
  if (input.receiptType === "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT" && input.humanSignatureOrExplicitConfirmation === undefined) {
    errors.push("physical proof requires human confirmation");
  }
  if (input.receiptType !== undefined && ![
    "EMULATOR_PROOF_RECEIPT",
    "FIREBASE_PROJECT_AND_REGION_RECEIPT",
    "IAM_AND_BILLING_RECEIPT",
    "PROTECTED_PREVIEW_RECEIPT",
    "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
  ].includes(String(input.receiptType))) errors.push("unknown receipt type");
  if (input.receiptId === "UNFILLED") errors.push("filled receipt cannot use UNFILLED id");
  if (input.createdAt === "") errors.push("filled receipt requires createdAt");
  if (input.performedBy === "") errors.push("filled receipt requires performedBy");
  if (input.sourceCommit === "") errors.push("filled receipt requires sourceCommit");
  if (input.sourceTree === "") errors.push("filled receipt requires sourceTree");
  if (input.proofResults !== undefined && !isRecord(input.proofResults)) errors.push("proofResults must be a record");
  if (input.limitations !== undefined && !Array.isArray(input.limitations)) errors.push("limitations must be an array");
  if (input.status === "UNFILLED_TEMPLATE_NOT_EVIDENCE") {
    errors.push("unfilled marker without canonical template marker is not evidence");
  }
  if (expected.sourceCommit !== undefined && input.sourceCommit !== expected.sourceCommit) {
    errors.push("receipt is bound to the wrong expected commit");
  }
  if (
    expected.providerIdRequired === true
    && (!isRecord(input.providerResourceIds) || Object.keys(input.providerResourceIds).length === 0)
  ) errors.push("provider ID is required");
  if (
    expected.physicalDeviceProof === true
    && (!Array.isArray(input.devices) || input.devices.length !== 2)
  ) errors.push("two physical devices are required");
  return { valid: errors.length === 0, evidence: errors.length === 0, errors };
}
