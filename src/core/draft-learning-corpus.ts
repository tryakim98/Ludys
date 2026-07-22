import type { AudioSpecification, Locale } from "./content-contracts.js";

export type DraftLifecycleStatus = "CURRENT" | "STALE" | "SUPERSEDED" | "WITHDRAWN";
export type DraftCorpusMode = "NORMAL_SYNTHETIC" | "REVIEW";
export type InternalReviewDecision =
  | "KEEP_WITH_CHANGES"
  | "KEEP_AS_DRAFT_WITH_LIMITS"
  | "CHANGES_REQUIRED";
export type DraftConstruct = "BUILD_BLEND_ENCODE" | "DECODE_REPAIR_TRANSFER";
export type DraftTransferClassification =
  | "NEAR_TRANSFER"
  | "METHOD_TRANSFER_WITH_LARGER_CHANGE"
  | "NON_NEAR_TRANSFER_REVIEW_ONLY";
export type DraftSupportLevel = "NONE" | "PROMPT" | "MODEL_REQUIRES_ADULT";
export type DraftAttemptKind = "TARGET" | "SUPPORTED_RETRY" | "TRANSFER";
export type DraftAttemptEvidence =
  | "INDEPENDENT"
  | "MODELLED_PRACTICE"
  | "SUPPORTED_RETRY"
  | "TRANSFER_SEPARATE";

export interface DraftStimulus {
  readonly text: string;
  readonly role: "TARGET" | "TRANSFER";
}

export interface DraftAdultCard {
  readonly cardId: string;
  readonly understand: string;
  readonly doOrSay: string;
  readonly avoid: string;
  readonly deepen: string;
  readonly waitAllowed: true;
  readonly expiresWhen: string;
  readonly adultAuthority: true;
  readonly dismissible: true;
  readonly humanReviewed: true;
  readonly reviewSource: "WP13.8_SCOPE_2026-07-22";
}

export interface DraftFeedbackByState {
  readonly targetReady: string;
  readonly targetCompleted: string;
  readonly supportedAttempt: string;
  readonly transferReady: string;
  readonly transferCompleted: string;
  readonly stopped: string;
}

export interface DraftActivityVariant {
  readonly activityId: string;
  readonly patternClassId: string;
  readonly revision: number;
  readonly locale: Locale;
  readonly status: "DRAFT";
  readonly reviewStatus: "EXTERNAL_REVIEW_REQUIRED";
  readonly evidenceStatus: "SYNTHETIC_ONLY";
  readonly betaStatus: "NOT_STUDENT_BETA";
  readonly internalReviewDecision: InternalReviewDecision;
  readonly construct: DraftConstruct;
  readonly title: string;
  readonly targetStimulus: DraftStimulus;
  readonly transferStimulus: DraftStimulus;
  readonly transferClassification: DraftTransferClassification;
  readonly childSteps: readonly string[];
  readonly feedbackByState: DraftFeedbackByState;
  readonly adultCard: DraftAdultCard;
  readonly contextCardId: string;
  readonly knowledgeId: string;
  readonly audioSpecIds: readonly [string, string, string];
  readonly supportPlan: readonly DraftSupportLevel[];
  readonly supportProvenanceRequired: true;
  readonly timingInterpretation: "FORBIDDEN";
  readonly pauseAllowed: true;
  readonly stopAllowed: true;
  readonly adultOverrideAllowed: true;
  readonly claimsAllowed: readonly string[];
  readonly claimsForbidden: readonly string[];
  readonly openReviewQuestions: readonly string[];
  readonly humanReviewed: true;
  readonly reviewSource: "WP13.8_SCOPE_2026-07-22";
}

export interface DraftPatternClassLocaleReview {
  readonly locale: Locale;
  readonly title: string;
  readonly norwegianGraphemePhonemeSuitability: string;
  readonly writtenStandard: string;
  readonly pronunciationAndDialectLimits: string;
  readonly vowelLength: string;
  readonly consonantDoubling: string;
  readonly orthographicComplexity: string;
  readonly morphologicalComplexity: string;
  readonly investigates: string;
  readonly cannotProve: string;
  readonly stimulusRationale: string;
  readonly openReviewerQuestions: readonly string[];
  readonly humanReviewed: true;
  readonly reviewSource: "WP13.8_SCOPE_2026-07-22";
}

export interface DraftPatternClass {
  readonly patternClassId: string;
  readonly revision: number;
  readonly lifecycleStatus: DraftLifecycleStatus;
  readonly status: "DRAFT";
  readonly reviewStatus: "EXTERNAL_REVIEW_REQUIRED";
  readonly frameworkBoundary: "NORWEGIAN_ORTHOGRAPHIC_REVIEW_NOT_IMPORTED_CVC";
  readonly locales: Readonly<Record<Locale, DraftPatternClassLocaleReview>>;
}

export interface DraftActivity {
  readonly activityId: string;
  readonly patternClassId: string;
  readonly revision: number;
  readonly lifecycleStatus: DraftLifecycleStatus;
  readonly variants: Readonly<Record<Locale, DraftActivityVariant>>;
}

export interface DraftKnowledgeVariant {
  readonly knowledgeId: string;
  readonly revision: number;
  readonly locale: Locale;
  readonly title: string;
  readonly explanation: string;
  readonly adultAction: string;
  readonly avoid: string;
  readonly deepen: string;
  readonly waitAllowed: true;
  readonly stopConditions: string;
  readonly audioSpecId: string;
  readonly status: "DRAFT";
  readonly reviewStatus: "EXTERNAL_REVIEW_REQUIRED";
  readonly humanReviewed: true;
  readonly reviewSource: "WP13.8_SCOPE_2026-07-22";
}

export interface DraftContextCardVariant {
  readonly contextCardId: string;
  readonly revision: number;
  readonly locale: Locale;
  readonly activityId: string;
  readonly knowledgeId: string;
  readonly oneActionOnly: true;
  readonly action: string;
  readonly waitAllowed: true;
  readonly expiresWhen: string;
  readonly status: "DRAFT";
  readonly reviewStatus: "EXTERNAL_REVIEW_REQUIRED";
  readonly humanReviewed: true;
  readonly reviewSource: "WP13.8_SCOPE_2026-07-22";
}

export interface DraftProgressionEdge {
  readonly edgeId: string;
  readonly fromPatternClassId: string;
  readonly toPatternClassId: string;
  readonly decisionAuthority: "ADULT";
  readonly automaticPlacement: false;
  readonly aggregateScoreRequired: false;
  readonly status: "DRAFT_EXTERNAL_REVIEW_REQUIRED";
  readonly claimBoundary: string;
}

export interface DraftLearningCorpusRelease {
  readonly releaseId: string;
  readonly revision: number;
  readonly status: "DRAFT";
  readonly reviewStatus: "EXTERNAL_REVIEW_REQUIRED";
  readonly evidenceStatus: "SYNTHETIC_ONLY";
  readonly betaStatus: "NOT_STUDENT_BETA";
  readonly patternClasses: readonly DraftPatternClass[];
  readonly activities: readonly DraftActivity[];
  readonly knowledge: readonly DraftKnowledgeVariant[];
  readonly contextCards: readonly DraftContextCardVariant[];
  readonly audioSpecifications: readonly AudioSpecification[];
  readonly progressionEdges: readonly DraftProgressionEdge[];
}

export interface DraftAttemptEvent {
  readonly sequence: number;
  readonly kind: DraftAttemptKind;
  readonly evidence: DraftAttemptEvidence;
  readonly supportLevel: DraftSupportLevel;
  readonly sessionBound: true;
}

export interface CorpusLifecycleRestriction {
  readonly scope: "PATTERN_CLASS" | "ACTIVITY";
  readonly scopeId: string;
  readonly lifecycleStatus: Exclude<DraftLifecycleStatus, "CURRENT">;
}

export interface CorpusLifecyclePolicy {
  readonly policyRevision: number;
  readonly restrictions: readonly CorpusLifecycleRestriction[];
  readonly containsPersonData: false;
  readonly resurrectionAllowed: false;
}

const LIFECYCLE_PRIORITY: Readonly<Record<DraftLifecycleStatus, number>> = {
  CURRENT: 0,
  STALE: 1,
  SUPERSEDED: 2,
  WITHDRAWN: 3,
};

function strongestLifecycle(statuses: readonly DraftLifecycleStatus[]): DraftLifecycleStatus {
  return statuses.reduce((strongest, candidate) =>
    LIFECYCLE_PRIORITY[candidate] > LIFECYCLE_PRIORITY[strongest] ? candidate : strongest,
  "CURRENT");
}

export function getDraftActivity(
  release: DraftLearningCorpusRelease,
  activityId: string,
): DraftActivity | undefined {
  return release.activities.find((activity) => activity.activityId === activityId);
}

export function getDraftActivityVariant(
  release: DraftLearningCorpusRelease,
  activityId: string,
  locale: Locale,
): DraftActivityVariant | undefined {
  return getDraftActivity(release, activityId)?.variants[locale];
}

export function effectiveActivityLifecycle(
  release: DraftLearningCorpusRelease,
  policy: CorpusLifecyclePolicy,
  activityId: string,
): DraftLifecycleStatus {
  const activity = getDraftActivity(release, activityId);
  if (activity === undefined) return "WITHDRAWN";
  const patternClass = release.patternClasses.find(
    (candidate) => candidate.patternClassId === activity.patternClassId,
  );
  if (patternClass === undefined) return "WITHDRAWN";
  const classStatuses: DraftLifecycleStatus[] = [patternClass.lifecycleStatus];
  const activityStatuses: DraftLifecycleStatus[] = [activity.lifecycleStatus];
  for (const restriction of policy.restrictions) {
    if (restriction.scope === "PATTERN_CLASS" && restriction.scopeId === patternClass.patternClassId) {
      classStatuses.push(restriction.lifecycleStatus);
    }
    if (restriction.scope === "ACTIVITY" && restriction.scopeId === activity.activityId) {
      activityStatuses.push(restriction.lifecycleStatus);
    }
  }
  const classStatus = strongestLifecycle(classStatuses);
  return classStatus === "CURRENT" ? strongestLifecycle(activityStatuses) : classStatus;
}

export function validateCorpusLifecyclePolicy(
  release: DraftLearningCorpusRelease,
  policy: CorpusLifecyclePolicy,
): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(policy.policyRevision) || policy.policyRevision < 1) {
    errors.push("policyRevision must be a positive integer");
  }
  if (policy.containsPersonData !== false) errors.push("content policy must contain no person data");
  if (policy.resurrectionAllowed !== false) errors.push("content policy cannot authorize resurrection");
  const classIds = new Set(release.patternClasses.map((item) => item.patternClassId));
  const activityIds = new Set(release.activities.map((item) => item.activityId));
  for (const restriction of policy.restrictions) {
    if (restriction.lifecycleStatus === ("CURRENT" as DraftLifecycleStatus)) {
      errors.push(`${restriction.scopeId}: restrictive policy cannot restore CURRENT`);
    }
    const known = restriction.scope === "PATTERN_CLASS"
      ? classIds.has(restriction.scopeId)
      : activityIds.has(restriction.scopeId);
    if (!known) errors.push(`${restriction.scopeId}: unknown lifecycle scope`);
  }
  return errors;
}

export function validateDraftLearningCorpus(release: DraftLearningCorpusRelease): string[] {
  const errors: string[] = [];
  if (release.status !== "DRAFT") errors.push("release must remain DRAFT");
  if (release.reviewStatus !== "EXTERNAL_REVIEW_REQUIRED") errors.push("external review must remain open");
  if (release.evidenceStatus !== "SYNTHETIC_ONLY") errors.push("evidence must remain synthetic");
  if (release.betaStatus !== "NOT_STUDENT_BETA") errors.push("student beta must remain closed");
  if (release.patternClasses.length !== 4) errors.push("corpus must contain exactly four pattern classes");
  if (release.activities.length !== 8) errors.push("corpus must contain exactly eight activities");
  if (release.audioSpecifications.length !== 48) errors.push("corpus must contain exactly 48 audio specifications");
  if (release.progressionEdges.length !== 3) errors.push("corpus must contain exactly three progression edges");

  const classIds = new Set(release.patternClasses.map((item) => item.patternClassId));
  const activityIds = new Set(release.activities.map((item) => item.activityId));
  if (classIds.size !== release.patternClasses.length) errors.push("pattern class IDs must be unique");
  if (activityIds.size !== release.activities.length) errors.push("activity IDs must be unique");
  for (const patternClass of release.patternClasses) {
    if (patternClass.frameworkBoundary !== "NORWEGIAN_ORTHOGRAPHIC_REVIEW_NOT_IMPORTED_CVC") {
      errors.push(`${patternClass.patternClassId}: imported CVC framing is forbidden`);
    }
    const count = release.activities.filter(
      (activity) => activity.patternClassId === patternClass.patternClassId,
    ).length;
    if (count !== 2) errors.push(`${patternClass.patternClassId}: must contain exactly two activities`);
    for (const locale of ["nb-NO", "nn-NO"] as const) {
      if (patternClass.locales[locale]?.locale !== locale) {
        errors.push(`${patternClass.patternClassId}: missing exact ${locale} class variant`);
      }
    }
  }

  const knowledgeKeys = new Set(release.knowledge.map((item) => `${item.knowledgeId}:${item.locale}`));
  const contextKeys = new Set(release.contextCards.map((item) => `${item.contextCardId}:${item.locale}`));
  const audioIds = new Set(release.audioSpecifications.map((item) => item.audioSpecId));
  if (knowledgeKeys.size !== 16 || new Set(release.knowledge.map((item) => item.knowledgeId)).size !== 8) {
    errors.push("knowledge inventory must be eight BM/NN semantic pairs");
  }
  if (contextKeys.size !== 16 || new Set(release.contextCards.map((item) => item.contextCardId)).size !== 8) {
    errors.push("context inventory must be eight BM/NN semantic pairs");
  }
  if (audioIds.size !== 48) errors.push("audio specification IDs must be unique");

  for (const activity of release.activities) {
    if (!classIds.has(activity.patternClassId)) errors.push(`${activity.activityId}: unknown pattern class`);
    for (const locale of ["nb-NO", "nn-NO"] as const) {
      const variant = activity.variants[locale];
      if (variant === undefined || variant.locale !== locale) {
        errors.push(`${activity.activityId}: missing exact ${locale} activity variant`);
        continue;
      }
      if (variant.activityId !== activity.activityId || variant.patternClassId !== activity.patternClassId) {
        errors.push(`${activity.activityId}:${locale}: variant identity mismatch`);
      }
      if (
        variant.status !== "DRAFT"
        || variant.reviewStatus !== "EXTERNAL_REVIEW_REQUIRED"
        || variant.evidenceStatus !== "SYNTHETIC_ONLY"
        || variant.betaStatus !== "NOT_STUDENT_BETA"
      ) {
        errors.push(`${activity.activityId}:${locale}: draft markers are incomplete`);
      }
      if (variant.timingInterpretation !== "FORBIDDEN") {
        errors.push(`${activity.activityId}:${locale}: timing interpretation must be forbidden`);
      }
      if (variant.supportPlan.join("|") !== "NONE|PROMPT|MODEL_REQUIRES_ADULT") {
        errors.push(`${activity.activityId}:${locale}: support plan is incomplete`);
      }
      if (!knowledgeKeys.has(`${variant.knowledgeId}:${locale}`)) {
        errors.push(`${activity.activityId}:${locale}: orphaned knowledge reference`);
      }
      if (!contextKeys.has(`${variant.contextCardId}:${locale}`)) {
        errors.push(`${activity.activityId}:${locale}: orphaned context reference`);
      }
      for (const audioSpecId of variant.audioSpecIds) {
        const audio = release.audioSpecifications.find((item) => item.audioSpecId === audioSpecId);
        if (audio === undefined || audio.locale !== locale) {
          errors.push(`${activity.activityId}:${locale}: orphaned or mixed-locale audio reference`);
        }
      }
      if (variant.audioSpecIds.length !== 3) errors.push(`${activity.activityId}:${locale}: requires three audio specs`);
      if (!variant.adultCard.waitAllowed || !variant.adultCard.dismissible || !variant.adultCard.adultAuthority) {
        errors.push(`${activity.activityId}:${locale}: adult card must preserve WAIT and adult authority`);
      }
    }
  }

  const referencedKnowledge = new Set(
    release.activities.flatMap((item) => Object.values(item.variants).map((variant) => `${variant.knowledgeId}:${variant.locale}`)),
  );
  const referencedContext = new Set(
    release.activities.flatMap((item) => Object.values(item.variants).map((variant) => `${variant.contextCardId}:${variant.locale}`)),
  );
  const referencedAudio = new Set(
    release.activities.flatMap((item) => Object.values(item.variants).flatMap((variant) => variant.audioSpecIds)),
  );
  if ([...knowledgeKeys].some((key) => !referencedKnowledge.has(key))) errors.push("orphaned knowledge variant");
  if ([...contextKeys].some((key) => !referencedContext.has(key))) errors.push("orphaned context variant");
  if ([...audioIds].some((key) => !referencedAudio.has(key))) errors.push("orphaned audio specification");

  for (const edge of release.progressionEdges) {
    if (!classIds.has(edge.fromPatternClassId) || !classIds.has(edge.toPatternClassId)) {
      errors.push(`${edge.edgeId}: progression edge is not reference-closed`);
    }
    if (edge.decisionAuthority !== "ADULT" || edge.automaticPlacement || edge.aggregateScoreRequired) {
      errors.push(`${edge.edgeId}: progression must remain adult-controlled and score-free`);
    }
    if (edge.status !== "DRAFT_EXTERNAL_REVIEW_REQUIRED") {
      errors.push(`${edge.edgeId}: progression cannot be treated as validated`);
    }
  }
  return errors;
}
