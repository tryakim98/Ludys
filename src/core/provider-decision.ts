export const PROVIDER_DECISION_SCHEMA_VERSION = "wp13.12a-provider-decision-v1" as const;
export const PROVIDER_DECISION_RELEASE_ID = "wp13-12a-provider-decision-r1" as const;

export const REQUIRED_PROVIDER_OPTIONS = [
  "LOCAL_ONLY",
  "FIREBASE_CAPABILITY",
  "FIREBASE_ANONYMOUS",
  "SELF_HOSTED",
  "LUDUS_REUSE",
] as const;
export type ProviderOptionId = typeof REQUIRED_PROVIDER_OPTIONS[number];

export const REQUIRED_CAPABILITY_OPTIONS = [
  "NO_AUTH_LOCAL_ONLY",
  "FUNCTION_ISSUED_SHORT_LIVED_SESSION_CAPABILITY",
  "FIREBASE_ANONYMOUS_AUTH",
  "STABLE_ACCOUNT_AUTH",
  "EXTERNAL_IDENTITY_PROVIDER",
] as const;
export type CapabilityOptionId = typeof REQUIRED_CAPABILITY_OPTIONS[number];
export type DecisionLocale = "nb" | "nn";
export type OptionStatus =
  | "RECOMMENDED"
  | "ACCEPTABLE_FALLBACK"
  | "NOT_RECOMMENDED"
  | "NO_GO"
  | "REQUIRES_FURTHER_EVIDENCE";

export const REQUIRED_TRUST_BOUNDARIES = [
  "TB-CLIENT-PREVIEW",
  "TB-CLIENT-AUTHORITY",
  "TB-AUTHORITY-STORE",
  "TB-AUTHORITY-PURE-CORE",
  "TB-OPS-LOGGING",
  "TB-CI-DEPLOY",
  "TB-SUPPORT",
] as const;

export const REQUIRED_THREATS = [
  "stolenCapability",
  "replayedCapability",
  "capabilityLeakInLogs",
  "directStoreMutation",
  "crossRoleProjection",
  "staleAuthorityGeneration",
  "delayedCommandAfterStop",
  "resurrectionFromCache",
  "resurrectionFromBackup",
  "overbroadServiceAccount",
  "browserSecretExposure",
  "previewExposure",
  "providerLogPayload",
  "billingAbuse",
  "denialOfService",
  "dependencyCompromise",
  "regionMismatch",
  "misconfiguredRules",
  "misconfiguredCORS",
  "unprotectedDeployment",
  "crossProjectCredentialReuse",
] as const;

export const REQUIRED_NO_GO = [
  "NO_PRODUCTION_DOMAIN",
  "NO_REAL_DATA",
  "NO_STUDENT_BETA",
  "NO_RECRUITMENT",
  "NO_PARENT_CONTACT_FOR_PARTICIPATION",
  "NO_FIREBASE_AUTH_IN_RECOMMENDED_BASELINE_WITHOUT_NEW_DECISION",
  "NO_STABLE_UID",
  "NO_ANALYTICS",
  "NO_CRASHLYTICS_WITH_PARTICIPANT_PAYLOAD",
  "NO_PERFORMANCE_MONITORING_WITH_PARTICIPANT_PAYLOAD",
  "NO_REMOTE_CONFIG_FOR_PEDAGOGICAL_DECISIONS",
  "NO_CLOUD_STORAGE",
  "NO_DIRECT_CLIENT_WRITE_TO_AUTHORITATIVE_STATE",
  "NO_CLIENT_SELECTED_AUTHORITY",
  "NO_BACKUP_WITHOUT_EXPLICIT_DECISION",
  "NO_RUNTIME_AI",
  "NO_LUDUS_PROVIDER_REUSE",
  "NO_SHARED_SECRETS",
  "NO_CLOUD_CREATION_IN_WP13_12A",
] as const;

export const REQUIRED_PROHIBITED_DATA = [
  "name", "email", "phone", "school", "studentNumber", "birthDate", "diagnosis",
  "healthData", "stableUID", "tenant", "freeTextAboutParticipant", "audio", "video",
  "image", "microphoneData", "cameraData", "realLearningResponse", "crossSessionProfile",
  "engagementScore", "analyticsIdentifier", "sessionReplay", "heatmap", "fingerprint",
] as const;

export interface OfficialDecisionSource {
  readonly sourceId: string;
  readonly title: string;
  readonly publisher: string;
  readonly officialUrl: string;
  readonly checkedAt: string;
  readonly factsSupported: readonly string[];
  readonly limitations: readonly string[];
  readonly cannotDecide: readonly string[];
  readonly reverificationRequiredBefore: string;
}

export interface ProviderOption {
  readonly optionId: ProviderOptionId;
  readonly provider: string;
  readonly services: readonly string[];
  readonly regionOptions: readonly string[];
  readonly identityModel: string;
  readonly authorityModel: string;
  readonly clientAccessModel: string;
  readonly dataClasses: readonly string[];
  readonly retentionModel: string;
  readonly deletionModel: string;
  readonly noResurrectionModel: string;
  readonly loggingModel: string;
  readonly IAMModel: string;
  readonly secretsModel: string;
  readonly costBand: string;
  readonly operationalLoad: string;
  readonly lockInRisk: string;
  readonly exitComplexity: string;
  readonly supportsSyntheticMultiDevice: boolean;
  readonly preservesProviderFreeCore: boolean;
  readonly requiresStableIdentity: boolean;
  readonly allowsDirectClientWrite: boolean;
  readonly status: OptionStatus;
  readonly rationale: readonly string[];
  readonly openQuestions: readonly string[];
  readonly sourceIds: readonly string[];
}

export interface CapabilityOption {
  readonly capabilityOptionId: CapabilityOptionId;
  readonly status: OptionStatus;
  readonly persistentIdentity: boolean;
  readonly crossSessionIdentity: boolean;
  readonly supportsPhysicalMultiDevice: boolean;
  readonly revocation: string;
  readonly storage: string;
  readonly risks: readonly string[];
}

export interface ProviderDecisionAuthorization {
  readonly packageStatus: "READY_FOR_OWNER_DECISION";
  readonly ownerDecision: "PENDING_OWNER_ACTION";
  readonly providerActivation: "BLOCKED";
  readonly cloudResources: 0;
  readonly externalReceipts: 0;
  readonly b8: "NOT_DECISION_READY";
  readonly wp13_12b: "BLOCKED";
  readonly studentBeta: "NOT_AUTHORIZED";
  readonly recruitment: "NOT_AUTHORIZED";
  readonly parentContactForParticipation: "NOT_AUTHORIZED";
  readonly realParticipantData: "NOT_AUTHORIZED";
  readonly production: "NOT_AUTHORIZED";
  readonly runtimeAi: "NOT_PRESENT";
}

export interface ProviderDecisionPackage {
  readonly schemaVersion: typeof PROVIDER_DECISION_SCHEMA_VERSION;
  readonly providerDecisionReleaseId: typeof PROVIDER_DECISION_RELEASE_ID;
  readonly packageVersion: string;
  readonly checkedAt: string;
  readonly locales: readonly DecisionLocale[];
  readonly localeBundles: readonly {
    readonly locale: DecisionLocale;
    readonly humanReviewStatus: "REVIEW_REQUIRED";
    readonly title: string;
    readonly recommendationLabel: string;
    readonly recommendationRationale: readonly string[];
    readonly riskLabel: string;
    readonly pendingOwnerLabel: string;
    readonly blockedLabel: string;
    readonly sectionLabels: Readonly<Record<string, string>>;
  }[];
  readonly providerOptions: readonly ProviderOption[];
  readonly recommendedOptionId: ProviderOptionId;
  readonly recommendedRegion: string;
  readonly regionLockNotExecuted: true;
  readonly regionAnalysis: readonly {
    readonly regionId: string;
    readonly databaseLocation: string;
    readonly functionLocation: string;
    readonly colocated: boolean;
    readonly locationType: string;
    readonly availability: string;
    readonly latencyAssessment: string;
    readonly costAssessment: string;
    readonly migration: string;
    readonly immutableAfterProvisioning: boolean;
    readonly serviceSupport: readonly string[];
    readonly legalResidualQuestion: string;
    readonly sourceIds: readonly string[];
    readonly status: OptionStatus;
  }[];
  readonly capabilityOptions: readonly CapabilityOption[];
  readonly recommendedCapabilityOptionId: CapabilityOptionId;
  readonly recommendedCapability: {
    readonly capabilityType: "OPAQUE_RANDOM_SHORT_LIVED_SESSION_CAPABILITY";
    readonly maximumLifetime: string;
    readonly roleBinding: string;
    readonly sessionBinding: string;
    readonly authorityGenerationBinding: string;
    readonly expectedRevisionBinding: string;
    readonly clientStorage: string;
    readonly serverStorage: string;
    readonly revocationTriggers: readonly string[];
    readonly loggingProhibition: readonly string[];
    readonly rotation: string;
    readonly rateLimiting: string;
    readonly replayProtection: string;
  };
  readonly dataflow: readonly {
    readonly stepId: string;
    readonly dataIn: readonly string[];
    readonly dataOut: readonly string[];
    readonly authority: string;
    readonly validation: readonly string[];
    readonly trustBoundary: string;
    readonly allowedFields: readonly string[];
    readonly prohibitedFields: readonly string[];
    readonly failureMode: string;
    readonly deletionBehavior: string;
    readonly loggingBehavior: string;
  }[];
  readonly trustBoundaries: readonly {
    readonly boundaryId: string;
    readonly from: string;
    readonly to: string;
    readonly allowedData: readonly string[];
    readonly prohibitedData: readonly string[];
    readonly authenticationOrCapability: string;
    readonly authorization: string;
    readonly validation: readonly string[];
    readonly encryption: string;
    readonly logging: string;
    readonly failureBehavior: string;
    readonly threats: readonly string[];
    readonly controls: readonly string[];
    readonly residualRisk: string;
  }[];
  readonly dataClasses: readonly {
    readonly dataClass: string;
    readonly status: "ALLOWED_SYNTHETIC_CANDIDATE" | "NOT_COLLECTED";
    readonly authorization: "SYNTHETIC_ONLY_IF_OWNER_APPROVES_WP13_12B" | "NOT_AUTHORIZED";
    readonly purpose: string;
    readonly personalData: false;
    readonly studentData: false;
    readonly identifierRisk: string;
    readonly source: string;
    readonly storage: string;
    readonly retention: string;
    readonly deletion: string;
    readonly export: string;
    readonly logging: string;
  }[];
  readonly retentionDeletion: {
    readonly explicitDeletionDominatesTtl: true;
    readonly stopDominatesAllPendingActions: true;
    readonly deletedSessionCannotResurrect: true;
    readonly ttlIsImmediateDeletion: false;
    readonly activeSessionLifetime: string;
    readonly capabilityLifetime: string;
    readonly explicitDeletion: readonly string[];
    readonly expiryAndTtl: readonly string[];
    readonly tombstone: readonly string[];
    readonly delayedAndDuplicateCommands: readonly string[];
    readonly staleAuthorityAndRevision: readonly string[];
    readonly reconnectAndCache: readonly string[];
    readonly backupsAndPitr: readonly string[];
    readonly projectClosure: readonly string[];
  };
  readonly loggingObservability: {
    readonly allowed: readonly string[];
    readonly prohibited: readonly string[];
    readonly requestBodyLogging: false;
    readonly capabilityLogging: false;
    readonly providerLogsFullyControlledByApplication: false;
    readonly retention: readonly string[];
    readonly redaction: readonly string[];
    readonly tests: readonly string[];
  };
  readonly iamAndSecrets: {
    readonly separateDevProjectRequired: true;
    readonly separateRuntimeIdentityRequired: true;
    readonly leastPrivilegeRequired: true;
    readonly broadOwnerRoleAllowedForRuntime: false;
    readonly serviceAccountJsonInRepository: false;
    readonly browserServerSecrets: false;
    readonly crossProjectCredentialReuse: false;
    readonly productionCredentials: false;
    readonly rotation: readonly string[];
    readonly revocation: readonly string[];
    readonly killSwitch: readonly string[];
    readonly breakGlass: readonly string[];
  };
  readonly costModel: {
    readonly currency: "NOK";
    readonly rows: readonly {
      readonly optionId: ProviderOptionId;
      readonly providerPriceFacts: readonly string[];
      readonly estimate: string;
      readonly estimateIsGuarantee: false;
      readonly billingAlertIsHardCap: false;
      readonly hardCapAvailability: string;
      readonly internalSafetyBoundary: string;
      readonly sourceIds: readonly string[];
    }[];
    readonly ownerFields: {
      readonly monthlyAlertThresholdNOK: "PENDING_OWNER_ACTION";
      readonly maximumAcceptedMonthlyCostNOK: "PENDING_OWNER_ACTION";
      readonly killSwitchOwner: "PENDING_OWNER_ACTION";
      readonly billingReviewer: "PENDING_OWNER_ACTION";
      readonly stagingExpiryDate: "PENDING_OWNER_ACTION";
      readonly automaticDeletionPolicy: "PENDING_OWNER_ACTION";
    };
  };
  readonly threats: readonly {
    readonly threatId: string;
    readonly description: string;
    readonly severity: string;
    readonly likelihood: string;
    readonly affectedBoundary: readonly string[];
    readonly preventiveControls: readonly string[];
    readonly detectiveControls: readonly string[];
    readonly response: readonly string[];
    readonly residualRisk: string;
    readonly blocksActivation: boolean;
  }[];
  readonly dataProcessingRequirements: readonly {
    readonly requirementId: string;
    readonly topic: string;
    readonly classification:
      | "TECHNICAL_INPUT_READY"
      | "LEGAL_REVIEW_REQUIRED"
      | "SCHOOL_OWNER_DECISION_REQUIRED"
      | "DPIA_DECISION_REQUIRED"
      | "ETHICAL_REVIEW_REQUIRED"
      | "NOT_APPLICABLE_TO_SYNTHETIC_SCOPE";
    readonly status: "OPEN" | "TECHNICAL_INPUT_READY";
    readonly question: string;
  }[];
  readonly migrationExit: {
    readonly localOnlyFallback: readonly string[];
    readonly previewRollback: readonly string[];
    readonly ingressDisablement: readonly string[];
    readonly capabilityRevocation: readonly string[];
    readonly deletionVerification: readonly string[];
    readonly projectClosure: readonly string[];
    readonly providerMigration: readonly string[];
  };
  readonly deploymentRunbook: readonly {
    readonly sequence: number;
    readonly action: string;
    readonly status: "NOT_EXECUTED";
    readonly requiredGate: string;
  }[];
  readonly noGo: readonly {
    readonly noGoId: string;
    readonly status: "ENFORCED";
    readonly rationale: string;
  }[];
  readonly ownerDecisionTemplate: {
    readonly allowedDecisions: readonly ["APPROVE_RECOMMENDED_SYNTHETIC_DEV", "APPROVE_WITH_CONDITIONS", "DEFER", "REJECT"];
    readonly requiredFields: readonly string[];
    readonly blank: true;
    readonly signaturePresent: false;
    readonly explicitOwnerConfirmationPresent: false;
  };
  readonly officialSources: readonly OfficialDecisionSource[];
  readonly authorization: ProviderDecisionAuthorization;
  readonly releaseComponents: {
    readonly appVersion: string;
    readonly contentReleaseId: string;
    readonly knowledgeReleaseId: string;
    readonly audioReleaseId: string;
    readonly operationsReleaseId: string;
    readonly providerDecisionReleaseId: string;
    readonly schemaVersion: string;
  };
}

export interface ProviderDecisionValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly packageStatus: "READY_FOR_OWNER_DECISION" | "INVALID";
  readonly ownerDecision: "PENDING_OWNER_ACTION";
  readonly providerActivation: "BLOCKED";
  readonly cloudResources: 0;
  readonly externalReceipts: 0;
  readonly studentBetaAuthorized: false;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function exactSet(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && [...actual].sort().join("\u0000") === [...expected].sort().join("\u0000");
}

export function validateProviderDecisionPackage(pkg: ProviderDecisionPackage): ProviderDecisionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (pkg.schemaVersion !== PROVIDER_DECISION_SCHEMA_VERSION) errors.push("unsupported provider decision schema");
  if (pkg.providerDecisionReleaseId !== PROVIDER_DECISION_RELEASE_ID || /latest/i.test(pkg.providerDecisionReleaseId)) {
    errors.push("provider decision release must use an immutable revision");
  }
  if (!exactSet(pkg.locales, ["nb", "nn"])) errors.push("BM and NN must both be first-class without fallback");
  if (!exactSet(pkg.localeBundles.map((bundle) => bundle.locale), ["nb", "nn"])) errors.push("locale bundles are incomplete");
  for (const bundle of pkg.localeBundles) {
    if (bundle.humanReviewStatus !== "REVIEW_REQUIRED" || bundle.title.trim() === "" || Object.keys(bundle.sectionLabels).length < 14) {
      errors.push(`${bundle.locale} is incomplete or falsely reviewed`);
    }
  }
  if (!exactSet(pkg.providerOptions.map((option) => option.optionId), REQUIRED_PROVIDER_OPTIONS)) errors.push("required provider options are incomplete");
  if (duplicates(pkg.providerOptions.map((option) => option.optionId)).length > 0) errors.push("duplicate provider optionId");
  const recommended = pkg.providerOptions.filter((option) => option.status === "RECOMMENDED");
  if (recommended.length !== 1) errors.push("exactly one provider option must be recommended");
  if (recommended[0]?.optionId !== pkg.recommendedOptionId) errors.push("recommended option binding is inconsistent");
  if ((recommended[0]?.sourceIds.length ?? 0) === 0) errors.push("recommended option lacks source grounding");
  for (const option of pkg.providerOptions) {
    if (option.sourceIds.some((sourceId) => !pkg.officialSources.some((source) => source.sourceId === sourceId))) errors.push(`${option.optionId} has unresolved source`);
    if (option.status === "RECOMMENDED" && (option.requiresStableIdentity || option.allowsDirectClientWrite || !option.preservesProviderFreeCore)) {
      errors.push("recommended option violates identity, authority or provider-free core boundary");
    }
  }
  if (pkg.regionAnalysis.length < 2 || !pkg.regionAnalysis.some((row) => row.regionId === pkg.recommendedRegion && row.status === "RECOMMENDED")) {
    errors.push("region analysis or recommendation is missing");
  }
  if (!pkg.regionLockNotExecuted) errors.push("region lock was executed");
  for (const row of pkg.regionAnalysis) {
    if (row.sourceIds.length === 0 || row.sourceIds.some((sourceId) => !pkg.officialSources.some((source) => source.sourceId === sourceId))) {
      errors.push(`${row.regionId} lacks current source grounding`);
    }
  }
  if (!exactSet(pkg.capabilityOptions.map((option) => option.capabilityOptionId), REQUIRED_CAPABILITY_OPTIONS)) errors.push("capability options are incomplete");
  if (pkg.recommendedCapabilityOptionId !== "FUNCTION_ISSUED_SHORT_LIVED_SESSION_CAPABILITY") errors.push("recommended capability is missing");
  const capability = pkg.recommendedCapability;
  for (const field of ["maximumLifetime", "roleBinding", "sessionBinding", "authorityGenerationBinding", "expectedRevisionBinding", "clientStorage", "serverStorage", "rotation", "rateLimiting", "replayProtection"] as const) {
    if (capability[field].trim() === "") errors.push(`recommended capability is missing ${field}`);
  }
  if (capability.revocationTriggers.length < 4 || capability.loggingProhibition.length < 2) errors.push("capability revocation or logging boundary is incomplete");
  const requiredFlow = ["PROTECTED_PREVIEW", "CLIENT", "TRANSPORT_PORT", "AUTHORITATIVE_HANDLER", "PURE_CORE", "AUTHORITATIVE_STORE", "ROLE_PROJECTION", "TECHNICAL_OBSERVABILITY"];
  if (!exactSet(pkg.dataflow.map((step) => step.stepId), requiredFlow)) errors.push("authoritative dataflow is incomplete");
  for (const step of pkg.dataflow) {
    if (step.validation.length === 0 || step.failureMode.trim() === "" || step.loggingBehavior.trim() === "") errors.push(`${step.stepId} dataflow contract is incomplete`);
    if (/CLIENT_SELECTED|CLIENT_AUTHORITY/i.test(step.authority)) errors.push(`${step.stepId} allows client-selected authority`);
  }
  if (!exactSet(pkg.trustBoundaries.map((boundary) => boundary.boundaryId), REQUIRED_TRUST_BOUNDARIES)) errors.push("trust boundaries are incomplete");
  const prohibited = pkg.dataClasses.filter((entry) => entry.status === "NOT_COLLECTED");
  if (!exactSet(prohibited.map((entry) => entry.dataClass), REQUIRED_PROHIBITED_DATA)) errors.push("prohibited data class register is incomplete");
  for (const entry of prohibited) {
    if (entry.authorization !== "NOT_AUTHORIZED" || entry.storage !== "NOWHERE" || entry.personalData || entry.studentData) errors.push(`${entry.dataClass} is not fail-closed`);
  }
  const retention = pkg.retentionDeletion;
  if (!retention.explicitDeletionDominatesTtl || !retention.stopDominatesAllPendingActions || !retention.deletedSessionCannotResurrect) {
    errors.push("STOP, explicit deletion or no-resurrection invariant is missing");
  }
  if (retention.ttlIsImmediateDeletion) errors.push("TTL is incorrectly represented as immediate deletion");
  if (retention.explicitDeletion.length === 0 || retention.tombstone.length === 0) errors.push("explicit deletion or tombstone is missing");
  if (pkg.loggingObservability.requestBodyLogging || pkg.loggingObservability.capabilityLogging) errors.push("request body or capability logging is enabled");
  if (pkg.loggingObservability.allowed.length === 0 || pkg.loggingObservability.prohibited.length < 10) errors.push("logging allowlist is incomplete");
  if (pkg.iamAndSecrets.broadOwnerRoleAllowedForRuntime || pkg.iamAndSecrets.serviceAccountJsonInRepository || pkg.iamAndSecrets.browserServerSecrets || pkg.iamAndSecrets.crossProjectCredentialReuse) {
    errors.push("IAM or secrets boundary is unsafe");
  }
  if (pkg.costModel.rows.length !== REQUIRED_PROVIDER_OPTIONS.length) errors.push("cost model is incomplete");
  for (const row of pkg.costModel.rows) {
    if (row.estimateIsGuarantee) errors.push(`${row.optionId} cost estimate is falsely guaranteed`);
    if (row.billingAlertIsHardCap) errors.push(`${row.optionId} billing alert is falsely a hard cap`);
  }
  const requiredCostOwnerFields = [
    "monthlyAlertThresholdNOK",
    "maximumAcceptedMonthlyCostNOK",
    "killSwitchOwner",
    "billingReviewer",
    "stagingExpiryDate",
    "automaticDeletionPolicy"
  ];
  if (
    !exactSet(Object.keys(pkg.costModel.ownerFields), requiredCostOwnerFields) ||
    Object.values(pkg.costModel.ownerFields).some((value) => value !== "PENDING_OWNER_ACTION")
  ) {
    errors.push("owner cost fields were fabricated");
  }
  if (!exactSet(pkg.threats.map((threat) => threat.threatId), REQUIRED_THREATS)) errors.push("threat model delta is incomplete");
  if (pkg.threats.some((threat) => threat.residualRisk.trim() === "" || threat.affectedBoundary.length === 0)) errors.push("threat residual risk is hidden");
  if (pkg.dataProcessingRequirements.length < 15 || !pkg.dataProcessingRequirements.some((item) => item.classification === "DPIA_DECISION_REQUIRED")) {
    errors.push("DPA, school-owner or DPIA register is incomplete");
  }
  if (Object.values(pkg.migrationExit).some((steps) => steps.length === 0)) errors.push("migration and exit plan is incomplete");
  if (pkg.deploymentRunbook.length !== 26 || pkg.deploymentRunbook.some((step, index) => step.sequence !== index + 1 || step.status !== "NOT_EXECUTED")) {
    errors.push("future deployment runbook is incomplete or falsely executed");
  }
  if (!exactSet(pkg.noGo.map((item) => item.noGoId), REQUIRED_NO_GO)) errors.push("no-go register is incomplete");
  if (!pkg.ownerDecisionTemplate.blank || pkg.ownerDecisionTemplate.signaturePresent || pkg.ownerDecisionTemplate.explicitOwnerConfirmationPresent) {
    errors.push("owner decision or signature was fabricated");
  }
  const requiredOwnerFields = [
    "decisionId", "decision", "decisionDate", "productOwnerNameOrReference", "selectedOption",
    "selectedRegion", "selectedCapabilityModel", "monthlyAlertThreshold", "maximumMonthlyCost",
    "killSwitchOwner", "stagingExpiryDate", "conditions", "acknowledgedOpenRisks",
    "signatureOrExplicitOwnerConfirmation", "sourcePackageVersion", "sourcePackageChecksum",
  ];
  if (!exactSet(pkg.ownerDecisionTemplate.requiredFields, requiredOwnerFields)) errors.push("owner decision template fields are incomplete");
  if (pkg.officialSources.length < 15) errors.push("official source register is incomplete");
  for (const source of pkg.officialSources) {
    if (!/^https:\/\//.test(source.officialUrl) || source.factsSupported.length === 0 || source.cannotDecide.length === 0) errors.push(`${source.sourceId} is incomplete`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt) || source.reverificationRequiredBefore.trim() === "") errors.push(`${source.sourceId} is undated`);
  }
  const authorization = pkg.authorization;
  if (authorization.ownerDecision !== "PENDING_OWNER_ACTION") errors.push("owner decision must remain pending");
  if (authorization.providerActivation !== "BLOCKED" || authorization.cloudResources !== 0) errors.push("provider activation or cloud resources boundary opened");
  if (authorization.externalReceipts !== 0 || authorization.b8 !== "NOT_DECISION_READY" || authorization.wp13_12b !== "BLOCKED") errors.push("receipt, B8 or WP13.12B boundary opened");
  if (authorization.studentBeta !== "NOT_AUTHORIZED" || authorization.production !== "NOT_AUTHORIZED" || authorization.realParticipantData !== "NOT_AUTHORIZED") errors.push("student, production or real-data authorization opened");
  if (pkg.releaseComponents.providerDecisionReleaseId !== pkg.providerDecisionReleaseId || /latest/i.test(pkg.releaseComponents.providerDecisionReleaseId)) {
    errors.push("provider decision component is mutable or unbound");
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    packageStatus: errors.length === 0 ? "READY_FOR_OWNER_DECISION" : "INVALID",
    ownerDecision: "PENDING_OWNER_ACTION",
    providerActivation: "BLOCKED",
    cloudResources: 0,
    externalReceipts: 0,
    studentBetaAuthorized: false,
  };
}

export function canonicalDecisionJson(value: unknown): string {
  function normalize(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(normalize);
    if (input !== null && typeof input === "object") {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested)]));
    }
    return input;
  }
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}
