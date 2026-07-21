import type {
  AudioSpecification,
  ContextCard,
  KnowledgeUnit,
  Locale,
} from "../../core/content-contracts.js";
import { knowledgeAudioPrototypeRelease } from "./knowledge-audio-release.js";

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

export function projectLegacyKnowledge(
  knowledgeId: string,
  locale: Locale,
): KnowledgeUnit {
  const unit = required(
    knowledgeAudioPrototypeRelease.knowledgeUnits.find(
      (candidate) => candidate.knowledgeId === knowledgeId,
    ),
    `unknown knowledge unit: ${knowledgeId}`,
  );
  const text = unit.variants[locale];
  return {
    knowledgeId: unit.knowledgeId,
    revision: unit.revision,
    title: text.title,
    audienceRole: "ADULT",
    ageBand: required(unit.ageBands[0], `${knowledgeId}: age band missing`),
    locale,
    topic: unit.topic,
    shortExplanation: text.shortExplanation,
    concreteAdultAction: text.concreteAdultAction,
    goodExample: text.goodExample,
    avoidExample: text.avoidExample,
    optionalDeepening: text.optionalDeepening,
    whenItFits: text.whenItFits,
    whenToUseOwnJudgment: text.whenToUseOwnJudgment,
    waitIsLegitimate: unit.waitIsLegitimate,
    stopConditions: text.stopConditions,
    plainLanguageVariant: text.plainLanguageVariant,
    audioSpecId: unit.audioSpecId,
    sources: unit.sources,
    author: unit.author,
    reviewerRoles: unit.reviewerRoles,
    reviewDate: unit.review.reviewedOn,
    withdrawalStatus:
      unit.publicationStatus === "WITHDRAWN" ? "WITHDRAWN" : "ACTIVE",
  };
}

export function projectLegacyContextCard(
  contextCardId: string,
  locale: Locale,
): ContextCard {
  const card = required(
    knowledgeAudioPrototypeRelease.contextCards.find(
      (candidate) => candidate.contextCardId === contextCardId,
    ),
    `unknown context card: ${contextCardId}`,
  );
  const text = card.variants[locale];
  return {
    contextCardId: card.contextCardId,
    revision: card.revision,
    knowledgeId: card.knowledgeId,
    activityId: required(card.activityIds[0], `${contextCardId}: activity missing`),
    triggerEvent:
      card.triggerEvent === "HELP_REQUESTED" ? "HELP_REQUESTED" : "ADULT_REVIEW",
    oneActionOnly: true,
    sayExample: text.sayExample,
    avoidExample: text.avoidExample,
    waitAllowed: card.waitAllowed,
    humanReviewed: true,
  };
}

export function projectLegacyAudio(
  audioSpecId: string,
  locale: Locale,
): AudioSpecification {
  const spec = required(
    knowledgeAudioPrototypeRelease.audioSpecifications.find(
      (candidate) => candidate.audioSpecId === audioSpecId,
    ),
    `unknown audio specification: ${audioSpecId}`,
  );
  const variant = spec.variants[locale];
  return {
    audioSpecId: spec.audioSpecId,
    semanticContentId: spec.semanticContentId,
    textRevision: spec.textRevision,
    locale,
    ageBand: required(spec.ageBands[0], `${audioSpecId}: age band missing`),
    audioRole: spec.audioRole,
    constructSensitivity: spec.constructSensitivity,
    voiceSourcePolicy: spec.voiceSourcePolicy,
    speakerIdentityInternal:
      variant.asset?.speakerLabel ?? "UNASSIGNED_HUMAN_SPEAKER",
    rightsScope: spec.rightsScope,
    scriptRevision: spec.revision,
    takeRevision: variant.asset === undefined ? 0 : 1,
    prosodicIntent: spec.prosodicIntent,
    allowedVariationSet: spec.allowedVariationSet,
    userInitiated: true,
    replayAllowed: spec.replayAllowed,
    stopBehavior: "STOP_IMMEDIATELY",
    silenceAlternative: true,
    fallbackPolicy: spec.fallbackPolicy,
    humanReviewed: true,
    staleStatus: spec.staleStatus,
    withdrawalStatus:
      spec.publicationStatus === "WITHDRAWN" ? "WITHDRAWN" : "ACTIVE",
  };
}
