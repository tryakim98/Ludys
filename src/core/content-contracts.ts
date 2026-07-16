import type { SenderType } from "./actors.js";
import type { HumanFirstAction } from "./actions.js";

export type Locale = "nb-NO" | "nn-NO";
export type AgeBand = "6-9" | "10-12" | "13-16";

export type EpistemicScope =
  | "OBSERVED_SESSION_EVENT"
  | "PUBLISHED_INSTRUCTION"
  | "PUBLISHED_OPTION"
  | "PUBLISHED_EXAMPLE"
  | "TECHNICAL_STATUS"
  | "UNCERTAINTY";

export type ForbiddenClaim =
  | "EMOTION_INFERENCE"
  | "MOTIVATION_INFERENCE"
  | "DIAGNOSIS"
  | "PERSONALITY"
  | "GENERAL_ABILITY"
  | "FUTURE_PERFORMANCE"
  | "CAUSE_OF_ERROR"
  | "RELATIONAL_CLAIM";

export interface MessageContract {
  readonly messageId: string;
  readonly revision: number;
  readonly audience: "CHILD" | "ADULT";
  readonly senderType: SenderType;
  readonly locale: Locale;
  readonly ageBand: AgeBand;
  readonly purpose: "INSTRUCTION" | "OPTION" | "FEEDBACK" | "STATUS";
  readonly text: string;
  readonly epistemicScope: EpistemicScope;
  readonly supportLevel: "NONE" | "PROMPT" | "MODEL";
  readonly humanReviewed: true;
  readonly reviewerRoles: readonly string[];
  readonly allowedVariants: readonly string[];
  readonly forbiddenClaims: readonly ForbiddenClaim[];
  readonly withdrawalStatus: "ACTIVE" | "WITHDRAWN";
}

export interface AdultCardTemplate {
  readonly cardId: string;
  readonly revision: number;
  readonly activityId: string;
  readonly triggerEvent: "HELP_REQUESTED" | "ADULT_REVIEW";
  readonly observedState: string;
  readonly uncertainty: string;
  readonly suggestedAction: HumanFirstAction;
  readonly sayExample: string;
  readonly avoidExample: string;
  readonly waitAllowed: boolean;
  readonly knowledgeId: string;
  readonly contextCardId: string;
  readonly humanReviewed: true;
}

export type ContextCorrectionCode =
  | "SUGGESTION_DID_NOT_FIT"
  | "CHILD_TIRED"
  | "TASK_UNCLEAR"
  | "HELP_GIVEN_OUTSIDE_APP"
  | "TECHNICAL_ISSUE"
  | "ADULT_CHOSE_OTHER_STRATEGY"
  | "ACTIVITY_SHOULD_STOP"
  | "OTHER_WITHOUT_FREE_TEXT_BASELINE";

export type AudioRole =
  | "STIMULUS"
  | "MODEL"
  | "INSTRUCTION"
  | "FEEDBACK"
  | "TRANSITION"
  | "ADULT_KNOWLEDGE"
  | "SYSTEM_ACCESSIBILITY";

export interface AudioSpecification {
  readonly audioSpecId: string;
  readonly semanticContentId: string;
  readonly textRevision: number;
  readonly locale: Locale;
  readonly ageBand: AgeBand;
  readonly audioRole: AudioRole;
  readonly constructSensitivity: "HIGH" | "LOW";
  readonly voiceSourcePolicy:
    | "HUMAN_REQUIRED"
    | "HUMAN_PREFERRED"
    | "ASSISTIVE_SYSTEM_VOICE_ALLOWED"
    | "NO_AUDIO";
  readonly speakerIdentityInternal: string;
  readonly rightsScope: string;
  readonly scriptRevision: number;
  readonly takeRevision: number;
  readonly prosodicIntent: string;
  readonly allowedVariationSet: readonly string[];
  readonly userInitiated: true;
  readonly replayAllowed: boolean;
  readonly stopBehavior: "STOP_IMMEDIATELY";
  readonly silenceAlternative: true;
  readonly fallbackPolicy: "SILENCE" | "REVIEWED_TEXT";
  readonly humanReviewed: true;
  readonly staleStatus: "CURRENT" | "STALE";
  readonly withdrawalStatus: "ACTIVE" | "WITHDRAWN";
}

export interface KnowledgeUnit {
  readonly knowledgeId: string;
  readonly revision: number;
  readonly title: string;
  readonly audienceRole: "ADULT";
  readonly ageBand: AgeBand;
  readonly locale: Locale;
  readonly topic: string;
  readonly shortExplanation: string;
  readonly concreteAdultAction: string;
  readonly goodExample: string;
  readonly avoidExample: string;
  readonly optionalDeepening: string;
  readonly whenItFits: string;
  readonly whenToUseOwnJudgment: string;
  readonly waitIsLegitimate: boolean;
  readonly stopConditions: string;
  readonly plainLanguageVariant: string;
  readonly audioSpecId: string;
  readonly sources: readonly string[];
  readonly author: string;
  readonly reviewerRoles: readonly string[];
  readonly reviewDate: string;
  readonly withdrawalStatus: "ACTIVE" | "WITHDRAWN";
}

export interface ContextCard {
  readonly contextCardId: string;
  readonly revision: number;
  readonly knowledgeId: string;
  readonly activityId: string;
  readonly triggerEvent: "HELP_REQUESTED" | "ADULT_REVIEW";
  readonly oneActionOnly: true;
  readonly sayExample: string;
  readonly avoidExample: string;
  readonly waitAllowed: boolean;
  readonly humanReviewed: true;
}

export interface ContentMetadata {
  readonly contentId: string;
  readonly revision: number;
  readonly contentType: "ACTIVITY" | "MESSAGE" | "KNOWLEDGE" | "CONTEXT_CARD";
  readonly locale: Locale;
  readonly ageBand: AgeBand;
  readonly activityRole: string;
  readonly constructRole: string;
  readonly author: string;
  readonly editor: string;
  readonly pedagogicalReviewer: string;
  readonly languageReviewer: string;
  readonly accessibilityReviewer: string;
  readonly ageDignityReviewer: string;
  readonly sourceProvenance: readonly string[];
  readonly aiAssistanceDisclosure: "NONE" | "ASSISTED_AND_HUMAN_OWNED";
  readonly humanOwnershipConfirmed: true;
  readonly publicationDecision: "APPROVED" | "DRAFT" | "WITHDRAWN";
  readonly revisionTriggers: readonly string[];
  readonly withdrawalStatus: "ACTIVE" | "WITHDRAWN";
}

export interface HumanFirstContentBundle {
  readonly releaseId: string;
  readonly locale: Locale;
  readonly activityId: string;
  readonly metadata: ContentMetadata;
  readonly messages: readonly MessageContract[];
  readonly adultCard: AdultCardTemplate;
  readonly contextCard: ContextCard;
  readonly knowledge: KnowledgeUnit;
  readonly audio: AudioSpecification;
}

const FORBIDDEN_PHRASES = [
  "fantastisk jobbet",
  "du er helt utrolig",
  "jeg er stolt av deg",
  "jeg forstår akkurat hvordan du føler",
  "eleven er frustrert",
  "eleven har mistet motivasjonen",
  "jeg vet hva som passer best",
  "jeg har forstått eleven",
  "jeg savnet deg",
  "jeg kjenner deg",
] as const;

function unknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

export function validateMessage(message: MessageContract): string[] {
  const errors: string[] = [];
  const normalized = message.text.toLocaleLowerCase("nb-NO");
  for (const phrase of FORBIDDEN_PHRASES) {
    if (normalized.includes(phrase)) {
      errors.push(`forbidden phrase: ${phrase}`);
    }
  }
  if (message.reviewerRoles.length === 0) {
    errors.push("reviewerRoles must not be empty");
  }
  if (message.text.trim().length === 0) {
    errors.push("text must not be empty");
  }
  return errors;
}

export function validateAudio(audio: AudioSpecification): string[] {
  const errors: string[] = [];
  const strictKeys = [
    "audioSpecId",
    "semanticContentId",
    "textRevision",
    "locale",
    "ageBand",
    "audioRole",
    "constructSensitivity",
    "voiceSourcePolicy",
    "speakerIdentityInternal",
    "rightsScope",
    "scriptRevision",
    "takeRevision",
    "prosodicIntent",
    "allowedVariationSet",
    "userInitiated",
    "replayAllowed",
    "stopBehavior",
    "silenceAlternative",
    "fallbackPolicy",
    "humanReviewed",
    "staleStatus",
    "withdrawalStatus",
  ] as const;
  const extras = unknownKeys(audio as unknown as Record<string, unknown>, strictKeys);
  if (extras.length > 0) {
    errors.push(`unknown audio fields: ${extras.join(", ")}`);
  }
  if (
    (audio.audioRole === "STIMULUS" || audio.audioRole === "MODEL") &&
    audio.voiceSourcePolicy !== "HUMAN_REQUIRED"
  ) {
    errors.push("construct-sensitive stimulus/model audio requires human voice");
  }
  if (!audio.userInitiated) {
    errors.push("audio must be user initiated");
  }
  if (!audio.silenceAlternative) {
    errors.push("audio must have a silence alternative");
  }
  return errors;
}

export function validateBundle(bundle: HumanFirstContentBundle): string[] {
  const errors = bundle.messages.flatMap(validateMessage);
  errors.push(...validateAudio(bundle.audio));
  const localeValues = [
    bundle.locale,
    bundle.metadata.locale,
    bundle.knowledge.locale,
    bundle.audio.locale,
    ...bundle.messages.map((message) => message.locale),
  ];
  if (localeValues.some((locale) => locale !== bundle.locale)) {
    errors.push("bundle mixes locales");
  }
  if (bundle.adultCard.knowledgeId !== bundle.knowledge.knowledgeId) {
    errors.push("adult card knowledgeId is not reference-closed");
  }
  if (bundle.adultCard.contextCardId !== bundle.contextCard.contextCardId) {
    errors.push("adult card contextCardId is not reference-closed");
  }
  if (bundle.contextCard.knowledgeId !== bundle.knowledge.knowledgeId) {
    errors.push("context card knowledgeId is not reference-closed");
  }
  if (bundle.knowledge.audioSpecId !== bundle.audio.audioSpecId) {
    errors.push("knowledge audioSpecId is not reference-closed");
  }
  if (bundle.metadata.publicationDecision !== "APPROVED") {
    errors.push("runtime bundle must be approved");
  }
  return errors;
}
