export const B8_GATE_IDS = [
  "LEARNING_FEASIBILITY",
  "HUMAN_FIRST",
  "CHILD_SAFETY",
  "ACCESSIBILITY",
  "ADULT_WORKLOAD",
  "CONTENT_AUDIO_KNOWLEDGE",
  "PRIVACY_LEGAL_ETHICS",
  "SECURITY_OPERATIONS",
  "PILOT_PROTOCOL",
] as const;

export type B8GateId = (typeof B8_GATE_IDS)[number];

export type EvidenceStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "SYNTHETIC_PASS"
  | "HUMAN_REVIEW_PASS"
  | "EXTERNAL_REVIEW_PASS"
  | "OWNER_ACCEPTED"
  | "BLOCKED"
  | "NOT_APPLICABLE";

export type RequirementLevel = "CRITICAL" | "REQUIRED" | "ADVISORY";
export type DueBefore = "B8_DECISION" | "RECRUITMENT" | "FIRST_SESSION" | "PILOT_CLOSE";

export interface EvidenceRequirement {
  readonly requirementId: string;
  readonly gateId: B8GateId;
  readonly title: string;
  readonly level: RequirementLevel;
  readonly dueBefore: DueBefore;
  readonly status: EvidenceStatus;
  readonly acceptedStatuses: readonly EvidenceStatus[];
  readonly ownerRole: string;
  readonly evidenceRefs: readonly string[];
  readonly limitation: string;
}

export type StopSeverity = "CRITICAL" | "MAJOR" | "MINOR";

export interface StopRule {
  readonly stopRuleId: string;
  readonly severity: StopSeverity;
  readonly trigger: string;
  readonly immediateAction: "STOP_SESSION" | "PAUSE_PILOT" | "LOG_AND_REVIEW";
  readonly restartAuthority: "PRODUCT_OWNER" | "PILOT_LEAD" | "NO_RESTART_WITHOUT_NEW_B8";
  readonly evidenceRequiredForRestart: readonly string[];
}

export interface ReopenSignal {
  readonly signalId: string;
  readonly description: string;
  readonly triggered: boolean;
  readonly evidenceRefs: readonly string[];
}

export interface CandidatePilotEnvelope {
  readonly status: "PROPOSED_NOT_AUTHORIZED";
  readonly ageBand: "6-9";
  readonly mode: "GUIDED_DYAD_TEACHER";
  readonly siteCountMaximum: 1;
  readonly dyadCountMinimum: 6;
  readonly dyadCountMaximum: 8;
  readonly sessionsPerDyadMaximum: 1;
  readonly sessionMinutesMaximum: 20;
  readonly activityIds: readonly ["activity.word-build.sol-mus.v1"];
  readonly applicationDataPolicy: "SESSION_ONLY_DELETE_AT_END";
  readonly evaluationRecordPolicy: "SEPARATE_STRUCTURED_FORM_RANDOM_CODE";
  readonly audioCapture: false;
  readonly freeTextInApplication: false;
  readonly runtimeAi: false;
  readonly crossSessionProfile: false;
  readonly remoteHomeUse: false;
}

export interface MeasurementRule {
  readonly measureId: string;
  readonly domain: "LEARNING" | "HUMAN_FIRST" | "SAFETY" | "ACCESSIBILITY" | "ADULT_WORKLOAD";
  readonly question: string;
  readonly collectionMethod: "STRUCTURED_OBSERVATION" | "POST_SESSION_QUESTION" | "TECHNICAL_ASSERTION";
  readonly applicationLoggingRequired: false;
  readonly thresholdProposal: string;
  readonly blocksContinuationWhen: string;
}

export interface B8ReadinessDossier {
  readonly dossierId: string;
  readonly revision: number;
  readonly generatedOn: string;
  readonly ownerDecisionStatus: "NOT_TAKEN";
  readonly requirements: readonly EvidenceRequirement[];
  readonly stopRules: readonly StopRule[];
  readonly reopenSignals: readonly ReopenSignal[];
  readonly candidateEnvelope: CandidatePilotEnvelope;
  readonly measurementRules: readonly MeasurementRule[];
}

export type B8ReadinessDecision =
  | "NOT_DECISION_READY"
  | "DECISION_READY_FOR_OWNER"
  | "REOPEN_REQUIRED";

export interface GateAssessment {
  readonly gateId: B8GateId;
  readonly total: number;
  readonly satisfied: number;
  readonly blockers: readonly string[];
  readonly status: "PASS" | "BLOCKED";
}

export interface B8ReadinessAssessment {
  readonly decision: B8ReadinessDecision;
  readonly ownerMayConsiderB8: boolean;
  readonly recruitmentAuthorized: false;
  readonly realDataAuthorized: false;
  readonly pilotAuthorized: false;
  readonly gateAssessments: readonly GateAssessment[];
  readonly blockersBeforeDecision: readonly string[];
  readonly conditionsAfterDecision: readonly string[];
  readonly triggeredReopenSignals: readonly string[];
}

function isSatisfied(requirement: EvidenceRequirement): boolean {
  return requirement.acceptedStatuses.includes(requirement.status);
}

export function assessB8Readiness(dossier: B8ReadinessDossier): B8ReadinessAssessment {
  const ids = new Set<string>();
  for (const requirement of dossier.requirements) {
    if (ids.has(requirement.requirementId)) {
      throw new Error(`duplicate evidence requirement: ${requirement.requirementId}`);
    }
    ids.add(requirement.requirementId);
  }

  const triggeredReopenSignals = dossier.reopenSignals
    .filter((signal) => signal.triggered)
    .map((signal) => signal.signalId);

  const blockersBeforeDecision = dossier.requirements
    .filter((requirement) => requirement.dueBefore === "B8_DECISION")
    .filter((requirement) => requirement.level !== "ADVISORY")
    .filter((requirement) => !isSatisfied(requirement))
    .map((requirement) => requirement.requirementId);

  const conditionsAfterDecision = dossier.requirements
    .filter((requirement) => requirement.dueBefore !== "B8_DECISION")
    .filter((requirement) => requirement.level !== "ADVISORY")
    .filter((requirement) => !isSatisfied(requirement))
    .map((requirement) => requirement.requirementId);

  const gateAssessments = B8_GATE_IDS.map((gateId): GateAssessment => {
    const requirements = dossier.requirements.filter((requirement) => requirement.gateId === gateId);
    const blockers = requirements
      .filter((requirement) => requirement.level !== "ADVISORY")
      .filter((requirement) => !isSatisfied(requirement))
      .map((requirement) => requirement.requirementId);
    return {
      gateId,
      total: requirements.length,
      satisfied: requirements.length - blockers.length,
      blockers,
      status: blockers.length === 0 ? "PASS" : "BLOCKED",
    };
  });

  const decision: B8ReadinessDecision =
    triggeredReopenSignals.length > 0
      ? "REOPEN_REQUIRED"
      : blockersBeforeDecision.length === 0
        ? "DECISION_READY_FOR_OWNER"
        : "NOT_DECISION_READY";

  return {
    decision,
    ownerMayConsiderB8: decision === "DECISION_READY_FOR_OWNER",
    recruitmentAuthorized: false,
    realDataAuthorized: false,
    pilotAuthorized: false,
    gateAssessments,
    blockersBeforeDecision,
    conditionsAfterDecision,
    triggeredReopenSignals,
  };
}
