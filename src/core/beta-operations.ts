export const OPERATIONS_SCHEMA_VERSION = "wp13.11-operations-v1" as const;
export const OPERATIONS_RELEASE_ID = "wp13-11-operations-kit-r1" as const;

export const OPERATIONS_ARTIFACT_TYPES = [
  "TEACHER_GUIDE",
  "FIVE_MINUTE_ONBOARDING",
  "INSTALL_START_GUIDE",
  "SESSION_SCRIPT",
  "ROLE_ALLOCATION",
  "PRE_SESSION_CHECKLIST",
  "IN_SESSION_OBSERVATION",
  "POST_SESSION_CONVERSATION",
  "ADULT_LOAD_FORM",
  "ACCESSIBILITY_LOG",
  "ERROR_REPORT",
  "INCIDENT_CARD",
  "STOP_CARD",
  "DELETION_ROUTINE",
  "SUPPORT_FAQ",
  "KNOWN_ISSUES",
  "RELEASE_NOTES",
  "ROLLBACK_CARD",
  "CONTENT_WITHDRAWAL_CARD",
  "PARENT_INFORMATION_DRAFT",
  "STUDENT_INFORMATION_DRAFT",
  "CONSENT_TEMPLATE_DRAFT",
  "ASSENT_TEMPLATE_DRAFT",
  "DATA_INVENTORY",
  "MEASUREMENT_DICTIONARY",
  "AMENDMENT_LOG",
  "DECISION_LOG",
] as const;

export type OperationsArtifactType = typeof OPERATIONS_ARTIFACT_TYPES[number];
export type OperationsLocale = "nb" | "nn";
export type OperationsArtifactStatus =
  | "DRAFT_INTERNAL"
  | "DRAFT_FOR_ADULT_REVIEW"
  | "DRAFT_NOT_AUTHORIZED_FOR_STUDENT_USE"
  | "REVIEW_REQUIRED"
  | "WITHDRAWN"
  | "SUPERSEDED";
export type OperationsReviewStatus = "REVIEW_REQUIRED" | "DRAFT_FOR_REVIEW";
export type OperationsAuthorizationStatus =
  | "ADULT_ONLY_SYNTHETIC_DRY_RUN_ONLY"
  | "NOT_AUTHORIZED_FOR_STUDENT_USE";

export const PARTICIPANT_DRAFT_TYPES = [
  "PARENT_INFORMATION_DRAFT",
  "STUDENT_INFORMATION_DRAFT",
  "CONSENT_TEMPLATE_DRAFT",
  "ASSENT_TEMPLATE_DRAFT",
] as const satisfies readonly OperationsArtifactType[];

export const FINDING_CLASSIFICATIONS = [
  "FEASIBILITY",
  "TECHNICAL_OPERATION",
  "ACCESSIBILITY",
  "CONTENT_REVIEW",
  "POTENTIAL_HARM",
  "LEARNING_CLAIM_NOT_MEASURED",
] as const;
export type FindingClassification = typeof FINDING_CLASSIFICATIONS[number];

export const ALLOWED_METRIC_IDS = [
  "adult_onboarding_minutes",
  "adult_instruction_understanding",
  "adult_operator_load",
  "accessibility_finding",
  "content_review_finding",
  "technical_error_code",
  "incident_class",
  "rollback_drill_result",
  "stop_drill_result",
  "deletion_drill_result",
  "withdrawal_drill_result",
] as const;
export type AllowedMetricId = typeof ALLOWED_METRIC_IDS[number];

export const FORBIDDEN_METRIC_IDS = [
  "student_accuracy",
  "student_speed",
  "student_reading_level",
  "student_error_profile",
  "engagement_score",
  "cross_session_progress",
  "affect_inference",
  "motivation_inference",
  "ability_inference",
  "diagnostic_inference",
  "readiness_score",
  "combined_student_score",
] as const;
export type ForbiddenMetricId = typeof FORBIDDEN_METRIC_IDS[number];

export const DRY_RUN_STEP_IDS = [
  "READ_BOUNDARY",
  "SELECT_LOCALE",
  "OPEN_ONBOARDING",
  "COMPLETE_PRE_SESSION_CHECKLIST",
  "ALLOCATE_SYNTHETIC_ROLES",
  "START_SYNTHETIC_SESSION",
  "USE_WAIT",
  "USE_HELP",
  "USE_PAUSE",
  "USE_STOP",
  "TRIGGER_TECHNICAL_ERROR",
  "FOLLOW_INCIDENT_PROCEDURE",
  "DELETE_LOCAL_STATE",
  "VERIFY_NO_RESURRECTION",
  "RUN_ROLLBACK",
  "RUN_CONTENT_WITHDRAWAL",
  "RECORD_TECHNICAL_OR_ADULT_FINDING",
  "RECORD_ACCESSIBILITY_FINDING",
  "RECORD_CONTENT_REVIEW_FINDING",
  "EXPORT_LOCAL_REVIEW_PACKAGE",
  "DELETE_DRY_RUN_RECORDS",
  "VERIFY_RECORDS_STAY_DELETED",
  "VERIFY_NEW_EXPORT_EXCLUDES_DELETED_RECORDS",
] as const;
export type DryRunStepId = typeof DRY_RUN_STEP_IDS[number];

export interface OperationsContentSection {
  readonly sectionId: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface OperationsAmendment {
  readonly revision: number;
  readonly at: string;
  readonly reason: string;
  readonly externalReceipt: false;
}

export interface OperationsArtifact {
  readonly artifactId: string;
  readonly artifactType: OperationsArtifactType;
  readonly version: string;
  readonly locale: OperationsLocale;
  readonly title: string;
  readonly audience: readonly string[];
  readonly status: OperationsArtifactStatus;
  readonly reviewStatus: OperationsReviewStatus;
  readonly authorizationStatus: OperationsAuthorizationStatus;
  readonly purpose: string;
  readonly allowedUse: readonly string[];
  readonly prohibitedUse: readonly string[];
  readonly contentSections: readonly OperationsContentSection[];
  readonly sourceReferences: readonly string[];
  readonly amendmentHistory: readonly OperationsAmendment[];
  readonly withdrawalStatus: "CURRENT" | "WITHDRAWN" | "SUPERSEDED";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MetricDefinition {
  readonly metricId: AllowedMetricId;
  readonly definition: string;
  readonly purpose: string;
  readonly unitOrValueType: string;
  readonly allowedContext: "ADULT_ONLY_SYNTHETIC_DRY_RUN";
  readonly prohibitedInterpretation: readonly string[];
  readonly retention: "MEMORY_UNTIL_EXPLICIT_DELETE_OR_LOCAL_EXPORT";
  readonly containsPersonalData: false;
  readonly crossSessionLinkage: false;
  readonly studentData: false;
  readonly authorization: "AUTHORIZED_FOR_ADULT_ONLY_SYNTHETIC_DRY_RUN";
}

export interface ForbiddenMetricDefinition {
  readonly metricId: ForbiddenMetricId;
  readonly status: "NOT_COLLECTED";
  readonly technicallyBlocked: true;
  readonly blockedAcross: readonly string[];
  readonly reason: string;
}

export interface DataInventoryEntry {
  readonly dataClass: string;
  readonly status: "ALLOWED_SYNTHETIC_LOCAL" | "PROHIBITED";
  readonly purpose: string;
  readonly source: string;
  readonly storageLocation: "MEMORY_ONLY" | "LOCAL_EXPLICIT_EXPORT" | "NOWHERE";
  readonly retention: string;
  readonly deletionMethod: string;
  readonly exported: boolean;
  readonly personalData: false;
  readonly studentData: false;
  readonly identifierRisk: "NONE" | "LOW_GUARDED" | "PROHIBITED";
  readonly authorized: boolean;
}

export interface OperationsAuthorization {
  readonly operationsKit: "READY_FOR_ADULT_ONLY_DRY_RUN";
  readonly externalReceipts: 0;
  readonly b8: "NOT_DECISION_READY";
  readonly studentBetaAuthorized: false;
  readonly recruitmentAuthorized: false;
  readonly parentContactForParticipationAuthorized: false;
  readonly realStudentDataAuthorized: false;
  readonly realParentDataAuthorized: false;
  readonly realTeacherDataAuthorized: false;
  readonly realSchoolDataAuthorized: false;
  readonly providerActivation: false;
  readonly productionAuthorized: false;
  readonly runtimeAiPresent: false;
}

export interface DryRunStep {
  readonly stepId: DryRunStepId;
  readonly sequence: number;
  readonly nb: string;
  readonly nn: string;
  readonly adultOnly: true;
  readonly studentData: false;
}

export interface OperationsReleaseComponents {
  readonly appVersion: string;
  readonly contentReleaseId: string;
  readonly knowledgeReleaseId: string;
  readonly audioReleaseId: string;
  readonly operationsReleaseId: string;
  readonly schemaVersion: string;
}

export interface OperationsKit {
  readonly schemaVersion: typeof OPERATIONS_SCHEMA_VERSION;
  readonly operationsReleaseId: typeof OPERATIONS_RELEASE_ID;
  readonly version: string;
  readonly locales: readonly OperationsLocale[];
  readonly artifacts: readonly OperationsArtifact[];
  readonly metrics: readonly MetricDefinition[];
  readonly forbiddenMetrics: readonly ForbiddenMetricDefinition[];
  readonly dataInventory: readonly DataInventoryEntry[];
  readonly officialSourceIds: readonly string[];
  readonly dryRunSteps: readonly DryRunStep[];
  readonly authorization: OperationsAuthorization;
  readonly releaseComponents: OperationsReleaseComponents;
  readonly exportPolicy: {
    readonly localOnly: true;
    readonly explicitInitiationRequired: true;
    readonly containsPersonalData: false;
    readonly containsStudentData: false;
    readonly deterministic: true;
  };
}

export interface OperationsValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly readiness: "READY_FOR_ADULT_ONLY_DRY_RUN" | "INVALID";
  readonly studentBetaAuthorized: false;
  readonly externalReceipts: 0;
  readonly semanticArtifactCount: number;
  readonly languageArtifactCount: number;
}

const REQUIRED_ARTIFACT_FIELDS = [
  "artifactId", "artifactType", "version", "locale", "title", "audience", "status",
  "reviewStatus", "authorizationStatus", "purpose", "allowedUse", "prohibitedUse",
  "contentSections", "sourceReferences", "amendmentHistory", "withdrawalStatus",
  "createdAt", "updatedAt",
] as const;

const PARTICIPANT_PROHIBITIONS = [
  "NOT_RECRUITMENT_MATERIAL",
  "NOT_FINAL_PARTICIPANT_INFORMATION",
  "NOT_VALID_CONSENT",
  "NOT_VALID_ASSENT",
  "NOT_PROCESSING_BASIS",
  "NOT_DPIA",
  "NOT_LEGAL_REVIEW",
  "NOT_ETHICS_APPROVAL",
  "NOT_SCHOOL_OWNER_DECISION",
  "NOT_B8_DECISION",
  "NO_STUDENT_CONTACT_AUTHORITY",
  "NO_PARENT_CONTACT_AUTHORITY",
  "NO_PILOT_START_AUTHORITY",
] as const;

function equalSets(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validateOperationsKit(kit: OperationsKit): OperationsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (kit.schemaVersion !== OPERATIONS_SCHEMA_VERSION) errors.push("unsupported operations schema");
  if (kit.operationsReleaseId !== OPERATIONS_RELEASE_ID || /latest/i.test(kit.operationsReleaseId)) {
    errors.push("operations release must use the fixed revision id");
  }
  if (!equalSets(kit.locales, ["nb", "nn"])) errors.push("NB and NN must both be first-class locales");
  if (kit.artifacts.length !== OPERATIONS_ARTIFACT_TYPES.length * 2) errors.push("exactly 54 language artifacts are required");
  const duplicateArtifactIds = duplicateValues(kit.artifacts.map((artifact) => artifact.artifactId));
  if (duplicateArtifactIds.length > 0) errors.push(`duplicate artifact ids: ${duplicateArtifactIds.join(", ")}`);

  for (const type of OPERATIONS_ARTIFACT_TYPES) {
    const variants = kit.artifacts.filter((artifact) => artifact.artifactType === type);
    if (variants.length !== 2) errors.push(`${type} must have exactly two locale variants`);
    const nb = variants.find((artifact) => artifact.locale === "nb");
    const nn = variants.find((artifact) => artifact.locale === "nn");
    if (nb === undefined) errors.push(`${type} is missing NB`);
    if (nn === undefined) errors.push(`${type} is missing NN`);
    if (nb !== undefined && nn !== undefined) {
      if (nb.status !== nn.status) errors.push(`${type} status differs between NB and NN`);
      if (nb.reviewStatus !== nn.reviewStatus) errors.push(`${type} review status differs between NB and NN`);
      if (nb.authorizationStatus !== nn.authorizationStatus) errors.push(`${type} authorization differs between NB and NN`);
      if (nb.withdrawalStatus !== nn.withdrawalStatus) errors.push(`${type} withdrawal differs between NB and NN`);
      if (!equalSets(nb.allowedUse, nn.allowedUse)) errors.push(`${type} allowed use differs between NB and NN`);
      if (!equalSets(nb.prohibitedUse, nn.prohibitedUse)) errors.push(`${type} prohibited use differs between NB and NN`);
    }
  }

  for (const artifact of kit.artifacts) {
    const record = artifact as unknown as Record<string, unknown>;
    for (const field of REQUIRED_ARTIFACT_FIELDS) {
      const value = record[field];
      if (value === undefined || value === null || value === "") errors.push(`${artifact.artifactId} is missing ${field}`);
    }
    if (artifact.title.trim().length === 0 || artifact.purpose.trim().length === 0) errors.push(`${artifact.artifactId} has empty copy`);
    if (artifact.contentSections.length === 0 || artifact.contentSections.some((section) => section.paragraphs.length === 0)) {
      errors.push(`${artifact.artifactId} must contain reviewable content sections`);
    }
    if (artifact.sourceReferences.some((sourceId) => !kit.officialSourceIds.includes(sourceId) && !sourceId.startsWith("INTERNAL-"))) {
      errors.push(`${artifact.artifactId} has an unresolved source reference`);
    }
    if (artifact.reviewStatus === ("APPROVED" as OperationsReviewStatus)) errors.push(`${artifact.artifactId} fabricates approval without receipt`);
    if (artifact.amendmentHistory.some((amendment) => amendment.externalReceipt !== false)) errors.push(`${artifact.artifactId} fabricates a receipt`);
    if ((PARTICIPANT_DRAFT_TYPES as readonly OperationsArtifactType[]).includes(artifact.artifactType)) {
      if (artifact.status !== "DRAFT_NOT_AUTHORIZED_FOR_STUDENT_USE") errors.push(`${artifact.artifactType} has an invalid participant status`);
      if (artifact.authorizationStatus !== "NOT_AUTHORIZED_FOR_STUDENT_USE") errors.push(`${artifact.artifactType} has an invalid authorization`);
      for (const prohibition of PARTICIPANT_PROHIBITIONS) {
        if (!artifact.prohibitedUse.includes(prohibition)) errors.push(`${artifact.artifactType} is missing ${prohibition}`);
      }
    }
  }

  const allowedMetricIds = kit.metrics.map((metric) => metric.metricId);
  if (!equalSets(allowedMetricIds, ALLOWED_METRIC_IDS)) errors.push("measurement dictionary has missing or extra allowed metrics");
  if (duplicateValues(allowedMetricIds).length > 0) errors.push("measurement dictionary has duplicate metrics");
  for (const metric of kit.metrics) {
    if (metric.containsPersonalData || metric.crossSessionLinkage || metric.studentData) errors.push(`${metric.metricId} crosses the data boundary`);
    if (/score|student|child|accuracy|speed|reading_level|profile|progress|inference/i.test(metric.metricId)) errors.push(`${metric.metricId} is a hidden student or score metric`);
  }

  const forbiddenMetricIds = kit.forbiddenMetrics.map((metric) => metric.metricId);
  if (!equalSets(forbiddenMetricIds, FORBIDDEN_METRIC_IDS)) errors.push("forbidden metric register is incomplete");
  for (const metric of kit.forbiddenMetrics) {
    if (metric.status !== "NOT_COLLECTED" || !metric.technicallyBlocked) errors.push(`${metric.metricId} is not technically blocked`);
  }

  if (kit.dataInventory.length === 0) errors.push("data inventory is empty");
  if (duplicateValues(kit.dataInventory.map((entry) => entry.dataClass)).length > 0) errors.push("data inventory has duplicate classes");
  for (const entry of kit.dataInventory) {
    if (entry.personalData || entry.studentData) errors.push(`${entry.dataClass} permits personal or student data`);
    if (entry.status === "PROHIBITED" && (entry.authorized || entry.storageLocation !== "NOWHERE" || entry.exported)) {
      errors.push(`${entry.dataClass} prohibited data is not fail-closed`);
    }
  }

  if (kit.dryRunSteps.length !== DRY_RUN_STEP_IDS.length) errors.push("adult-only dry-run must contain exactly 23 steps");
  for (let index = 0; index < DRY_RUN_STEP_IDS.length; index += 1) {
    const step = kit.dryRunSteps[index];
    if (step?.stepId !== DRY_RUN_STEP_IDS[index] || step?.sequence !== index + 1) errors.push("dry-run steps are incomplete or out of order");
    if (step !== undefined && (!step.adultOnly || step.studentData)) errors.push(`${step.stepId} is not adult-only`);
  }

  const authorization = kit.authorization;
  if (authorization.externalReceipts !== 0) errors.push("external receipts must remain zero");
  if (authorization.b8 !== "NOT_DECISION_READY") errors.push("B8 must remain not decision-ready");
  if (authorization.studentBetaAuthorized || authorization.recruitmentAuthorized || authorization.parentContactForParticipationAuthorized) {
    errors.push("student beta, recruitment and participant contact must remain unauthorized");
  }
  if (authorization.realStudentDataAuthorized || authorization.realParentDataAuthorized || authorization.realTeacherDataAuthorized || authorization.realSchoolDataAuthorized) {
    errors.push("real personal or school data must remain unauthorized");
  }
  if (authorization.providerActivation || authorization.productionAuthorized || authorization.runtimeAiPresent) {
    errors.push("provider, production and runtime AI boundaries must remain closed");
  }
  if (kit.releaseComponents.operationsReleaseId !== kit.operationsReleaseId || /latest/i.test(kit.releaseComponents.operationsReleaseId)) {
    errors.push("operations component revision is missing or mutable");
  }
  if (!kit.exportPolicy.localOnly || !kit.exportPolicy.explicitInitiationRequired || kit.exportPolicy.containsPersonalData || kit.exportPolicy.containsStudentData || !kit.exportPolicy.deterministic) {
    errors.push("local export policy is unsafe");
  }

  const semanticArtifactCount = new Set(kit.artifacts.map((artifact) => artifact.artifactType)).size;
  if (semanticArtifactCount !== 27) errors.push("semantic artifact count is not 27");
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    readiness: errors.length === 0 ? "READY_FOR_ADULT_ONLY_DRY_RUN" : "INVALID",
    studentBetaAuthorized: false,
    externalReceipts: 0,
    semanticArtifactCount,
    languageArtifactCount: kit.artifacts.length,
  };
}

export interface IdentifierGuardResult {
  readonly accepted: boolean;
  readonly normalized: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export const IDENTIFIER_GUARD_MAX_LENGTH = 160;

export function guardAdultOnlyFindingText(input: string): IdentifierGuardResult {
  const normalized = input.trim().replace(/\s+/g, " ");
  const errors: string[] = [];
  const warnings: string[] = [];
  if (normalized.length > IDENTIFIER_GUARD_MAX_LENGTH) errors.push("TEXT_TOO_LONG");
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(normalized)) errors.push("POSSIBLE_EMAIL");
  if (/\b(?:https?:\/\/|www\.)\S+/i.test(normalized)) errors.push("POSSIBLE_URL");
  if (/\b\d{6,}\b/.test(normalized)) errors.push("LONG_DIGIT_SEQUENCE");
  const digits = normalized.replace(/\D/g, "");
  if (digits.length >= 8 && /(?:\+?\d[\s().-]*){8,}/.test(normalized)) errors.push("POSSIBLE_PHONE");
  if (/\b(?:skole|skulen|school|klasse|class)\b/i.test(normalized)) warnings.push("POSSIBLE_SCHOOL_IDENTIFIER");
  if (/\b[A-ZÆØÅ][a-zæøå]{2,}\s+[A-ZÆØÅ][a-zæøå]{2,}\b/.test(normalized)) warnings.push("POSSIBLE_PERSON_NAME");
  return {
    accepted: errors.length === 0 && warnings.length === 0,
    normalized: errors.length === 0 && warnings.length === 0 ? normalized : "",
    errors,
    warnings,
  };
}

export function canonicalJson(value: unknown): string {
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
