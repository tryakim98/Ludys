import type { AgeBand, AudioRole, Locale } from "./content-contracts.js";

export type AdultRole = "TEACHER" | "PARENT" | "OTHER_ADULT";
export type KnowledgeTopic =
  | "READING"
  | "WRITING"
  | "MOTIVATION"
  | "EMOTIONAL_SUPPORT"
  | "ACCESS";
export type KnowledgeNeed =
  | "HELP_REQUESTED"
  | "TASK_UNCLEAR"
  | "WORK_QUIET"
  | "AFTER_SUPPORT"
  | "TRANSFER"
  | "PLANNING"
  | "ACCESS_TOOL"
  | "STOP_OR_PAUSE";
export type KnowledgeDurationMinutes = 2 | 5 | 10;
export type PrototypePublicationStatus =
  | "DRAFT"
  | "INTERNAL_REVIEW"
  | "APPROVED_FOR_PROTOTYPE"
  | "WITHDRAWN";
export type ReviewDecision = "PENDING" | "APPROVED" | "REJECTED";
export type AudioAssetSource =
  | "HUMAN_RECORDING"
  | "CONTROLLED_SYNTHETIC_CANDIDATE"
  | "ASSISTIVE_SYSTEM_VOICE";
export type AudioPrototypeStatus =
  | "SPEC_ONLY"
  | "INTERNAL_REVIEW"
  | "PUBLISHED"
  | "WITHDRAWN";

export interface ReviewSummary {
  readonly pedagogical: ReviewDecision;
  readonly languageNb: ReviewDecision;
  readonly languageNn: ReviewDecision;
  readonly accessibility: ReviewDecision;
  readonly ageDignity: ReviewDecision;
  readonly humanFirst: ReviewDecision;
  readonly reviewedOn: string;
  readonly notes: readonly string[];
}

export interface LocalizedKnowledgeText {
  readonly locale: Locale;
  readonly title: string;
  readonly shortExplanation: string;
  readonly concreteAdultAction: string;
  readonly goodExample: string;
  readonly avoidExample: string;
  readonly optionalDeepening: string;
  readonly whenItFits: string;
  readonly whenToUseOwnJudgment: string;
  readonly stopConditions: string;
  readonly plainLanguageVariant: string;
}

export interface KnowledgePrototypeUnit {
  readonly knowledgeId: string;
  readonly revision: number;
  readonly audienceRoles: readonly AdultRole[];
  readonly ageBands: readonly AgeBand[];
  readonly topic: KnowledgeTopic;
  readonly needs: readonly KnowledgeNeed[];
  readonly durationMinutes: KnowledgeDurationMinutes;
  readonly waitIsLegitimate: boolean;
  readonly activityIds: readonly string[];
  readonly audioSpecId: string;
  readonly variants: Readonly<Record<Locale, LocalizedKnowledgeText>>;
  readonly sources: readonly string[];
  readonly author: string;
  readonly reviewerRoles: readonly string[];
  readonly review: ReviewSummary;
  readonly publicationStatus: PrototypePublicationStatus;
  readonly revisionTriggers: readonly string[];
  readonly withdrawalReason?: string;
}

export interface LocalizedContextCardText {
  readonly locale: Locale;
  readonly observedState: string;
  readonly uncertainty: string;
  readonly sayExample: string;
  readonly avoidExample: string;
}

export interface KnowledgeContextCard {
  readonly contextCardId: string;
  readonly revision: number;
  readonly knowledgeId: string;
  readonly activityIds: readonly string[];
  readonly triggerEvent:
    | "HELP_REQUESTED"
    | "ADULT_REVIEW"
    | "QUIET_REQUESTED"
    | "TASK_UNCLEAR"
    | "AFTER_SUPPORT"
    | "TRANSFER_READY"
    | "ACCESS_CHOICE"
    | "STOP_CONSIDERED";
  readonly oneActionOnly: true;
  readonly waitAllowed: boolean;
  readonly expiresOn: readonly (
    | "NEW_CHILD_ACTION"
    | "NEW_SESSION_VERSION"
    | "PAUSE"
    | "STOP"
    | "HANDOFF"
    | "RECONNECT"
  )[];
  readonly variants: Readonly<Record<Locale, LocalizedContextCardText>>;
  readonly review: ReviewSummary;
  readonly publicationStatus: PrototypePublicationStatus;
}

export interface AudioAssetDescriptor {
  readonly assetId: string;
  readonly relativeUrl: string;
  readonly mimeType: "audio/wav";
  readonly sha256: string;
  readonly source: AudioAssetSource;
  readonly scope: "INTERNAL_REVIEW_ONLY" | "PUBLISHED_RUNTIME";
  readonly speakerLabel: string;
  readonly generatedOrRecordedOn: string;
}

export interface LocalizedAudioPrototype {
  readonly locale: Locale;
  readonly scriptText: string;
  readonly plainTextFallback: string;
  readonly asset?: AudioAssetDescriptor;
}

export interface AudioPrototypeSpecification {
  readonly audioSpecId: string;
  readonly revision: number;
  readonly semanticContentId: string;
  readonly textRevision: number;
  readonly ageBands: readonly AgeBand[];
  readonly audioRole: AudioRole;
  readonly constructSensitivity: "HIGH" | "LOW";
  readonly voiceSourcePolicy:
    | "HUMAN_REQUIRED"
    | "HUMAN_PREFERRED"
    | "ASSISTIVE_SYSTEM_VOICE_ALLOWED"
    | "NO_AUDIO";
  readonly rightsScope: string;
  readonly prosodicIntent: string;
  readonly allowedVariationSet: readonly string[];
  readonly userInitiated: true;
  readonly replayAllowed: boolean;
  readonly stopBehavior: "STOP_IMMEDIATELY";
  readonly silenceAlternative: true;
  readonly fallbackPolicy: "SILENCE" | "REVIEWED_TEXT";
  readonly variants: Readonly<Record<Locale, LocalizedAudioPrototype>>;
  readonly review: ReviewSummary;
  readonly staleStatus: "CURRENT" | "STALE";
  readonly publicationStatus: AudioPrototypeStatus;
  readonly withdrawalReason?: string;
}

export interface KnowledgeAudioPrototypeRelease {
  readonly releaseId: string;
  readonly revision: number;
  readonly status: "INTERNAL_PROTOTYPE" | "WITHDRAWN";
  readonly locales: readonly Locale[];
  readonly knowledgeUnits: readonly KnowledgePrototypeUnit[];
  readonly contextCards: readonly KnowledgeContextCard[];
  readonly audioSpecifications: readonly AudioPrototypeSpecification[];
  readonly createdOn: string;
  readonly humanOwner: string;
}

export interface KnowledgeFilter {
  readonly locale: Locale;
  readonly role?: AdultRole;
  readonly ageBand?: AgeBand;
  readonly topic?: KnowledgeTopic;
  readonly need?: KnowledgeNeed;
  readonly maxDurationMinutes?: KnowledgeDurationMinutes;
}

export interface LocalizedKnowledgeView {
  readonly knowledgeId: string;
  readonly revision: number;
  readonly roles: readonly AdultRole[];
  readonly ageBands: readonly AgeBand[];
  readonly topic: KnowledgeTopic;
  readonly needs: readonly KnowledgeNeed[];
  readonly durationMinutes: KnowledgeDurationMinutes;
  readonly waitIsLegitimate: boolean;
  readonly audioSpecId: string;
  readonly text: LocalizedKnowledgeText;
  readonly sources: readonly string[];
  readonly review: ReviewSummary;
  readonly publicationStatus: PrototypePublicationStatus;
}

export interface ResolvedAudioPreview {
  readonly audioSpecId: string;
  readonly locale: Locale;
  readonly scriptText: string;
  readonly plainTextFallback: string;
  readonly publicationStatus: AudioPrototypeStatus;
  readonly staleStatus: "CURRENT" | "STALE";
  readonly asset: AudioAssetDescriptor | undefined;
  readonly canPreview: boolean;
  readonly userFacingLabel: string;
}

function uniqueIds(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function hasAllReviews(review: ReviewSummary): boolean {
  return [
    review.pedagogical,
    review.languageNb,
    review.languageNn,
    review.accessibility,
    review.ageDignity,
    review.humanFirst,
  ].every((decision) => decision === "APPROVED");
}

export function filterKnowledge(
  release: KnowledgeAudioPrototypeRelease,
  filter: KnowledgeFilter,
): LocalizedKnowledgeView[] {
  if (!release.locales.includes(filter.locale)) return [];
  return release.knowledgeUnits
    .filter((unit) => unit.publicationStatus !== "WITHDRAWN")
    .filter((unit) => filter.role === undefined || unit.audienceRoles.includes(filter.role))
    .filter((unit) => filter.ageBand === undefined || unit.ageBands.includes(filter.ageBand))
    .filter((unit) => filter.topic === undefined || unit.topic === filter.topic)
    .filter((unit) => filter.need === undefined || unit.needs.includes(filter.need))
    .filter(
      (unit) =>
        filter.maxDurationMinutes === undefined ||
        unit.durationMinutes <= filter.maxDurationMinutes,
    )
    .map((unit) => ({
      knowledgeId: unit.knowledgeId,
      revision: unit.revision,
      roles: unit.audienceRoles,
      ageBands: unit.ageBands,
      topic: unit.topic,
      needs: unit.needs,
      durationMinutes: unit.durationMinutes,
      waitIsLegitimate: unit.waitIsLegitimate,
      audioSpecId: unit.audioSpecId,
      text: unit.variants[filter.locale],
      sources: unit.sources,
      review: unit.review,
      publicationStatus: unit.publicationStatus,
    }));
}

export function resolveContextCard(
  release: KnowledgeAudioPrototypeRelease,
  input: {
    readonly contextCardId: string;
    readonly locale: Locale;
  },
): { readonly card: KnowledgeContextCard; readonly text: LocalizedContextCardText } | undefined {
  const card = release.contextCards.find(
    (candidate) =>
      candidate.contextCardId === input.contextCardId &&
      candidate.publicationStatus !== "WITHDRAWN",
  );
  if (card === undefined) return undefined;
  return { card, text: card.variants[input.locale] };
}

export function resolveAudioPreview(
  release: KnowledgeAudioPrototypeRelease,
  input: { readonly audioSpecId: string; readonly locale: Locale },
): ResolvedAudioPreview | undefined {
  const spec = release.audioSpecifications.find(
    (candidate) => candidate.audioSpecId === input.audioSpecId,
  );
  if (spec === undefined || spec.publicationStatus === "WITHDRAWN") return undefined;
  const variant = spec.variants[input.locale];
  const asset = variant.asset;
  const canPreview =
    spec.staleStatus === "CURRENT" &&
    asset !== undefined &&
    (spec.publicationStatus === "INTERNAL_REVIEW" ||
      spec.publicationStatus === "PUBLISHED");
  const userFacingLabel =
    asset?.source === "CONTROLLED_SYNTHETIC_CANDIDATE"
      ? "Syntetisk lydkladd – kun intern vurdering"
      : asset?.source === "HUMAN_RECORDING"
        ? "Menneskelig innlest lyd"
        : "Lyd er ikke publisert ennå";
  return {
    audioSpecId: spec.audioSpecId,
    locale: input.locale,
    scriptText: variant.scriptText,
    plainTextFallback: variant.plainTextFallback,
    publicationStatus: spec.publicationStatus,
    staleStatus: spec.staleStatus,
    asset,
    canPreview,
    userFacingLabel,
  };
}

export function validateKnowledgeAudioRelease(
  release: KnowledgeAudioPrototypeRelease,
): string[] {
  const errors: string[] = [];
  if (release.knowledgeUnits.length < 10 || release.knowledgeUnits.length > 20) {
    errors.push("prototype must contain 10–20 knowledge units");
  }
  if (release.contextCards.length < 5 || release.contextCards.length > 10) {
    errors.push("prototype must contain 5–10 context cards");
  }
  if (
    release.audioSpecifications.length < 10 ||
    release.audioSpecifications.length > 20
  ) {
    errors.push("prototype must contain 10–20 audio specifications");
  }
  if (!uniqueIds(release.knowledgeUnits.map((unit) => unit.knowledgeId))) {
    errors.push("knowledgeId values must be unique");
  }
  if (!uniqueIds(release.contextCards.map((card) => card.contextCardId))) {
    errors.push("contextCardId values must be unique");
  }
  if (!uniqueIds(release.audioSpecifications.map((spec) => spec.audioSpecId))) {
    errors.push("audioSpecId values must be unique");
  }

  const knowledgeIds = new Set(release.knowledgeUnits.map((unit) => unit.knowledgeId));
  const audioIds = new Set(release.audioSpecifications.map((spec) => spec.audioSpecId));

  for (const unit of release.knowledgeUnits) {
    if (!audioIds.has(unit.audioSpecId)) {
      errors.push(`${unit.knowledgeId}: audioSpecId is not reference-closed`);
    }
    if (unit.audienceRoles.length === 0) {
      errors.push(`${unit.knowledgeId}: audienceRoles must not be empty`);
    }
    if (unit.ageBands.length === 0) {
      errors.push(`${unit.knowledgeId}: ageBands must not be empty`);
    }
    if (unit.sources.length === 0) {
      errors.push(`${unit.knowledgeId}: sources must not be empty`);
    }
    for (const locale of release.locales) {
      const variant = unit.variants[locale];
      if (variant.locale !== locale) {
        errors.push(`${unit.knowledgeId}: locale variant mismatch for ${locale}`);
      }
      for (const field of [
        variant.title,
        variant.shortExplanation,
        variant.concreteAdultAction,
        variant.goodExample,
        variant.avoidExample,
        variant.plainLanguageVariant,
      ]) {
        if (field.trim().length === 0) {
          errors.push(`${unit.knowledgeId}: required localized text is empty`);
          break;
        }
      }
    }
    if (
      unit.publicationStatus === "APPROVED_FOR_PROTOTYPE" &&
      !hasAllReviews(unit.review)
    ) {
      errors.push(`${unit.knowledgeId}: approved unit lacks complete review`);
    }
    if (
      unit.publicationStatus === "WITHDRAWN" &&
      (unit.withdrawalReason === undefined || unit.withdrawalReason.trim().length === 0)
    ) {
      errors.push(`${unit.knowledgeId}: withdrawn unit needs reason`);
    }
  }

  for (const card of release.contextCards) {
    if (!knowledgeIds.has(card.knowledgeId)) {
      errors.push(`${card.contextCardId}: knowledgeId is not reference-closed`);
    }
    if (!card.expiresOn.includes("STOP") || !card.expiresOn.includes("RECONNECT")) {
      errors.push(`${card.contextCardId}: must expire on STOP and RECONNECT`);
    }
    if (
      card.publicationStatus === "APPROVED_FOR_PROTOTYPE" &&
      !hasAllReviews(card.review)
    ) {
      errors.push(`${card.contextCardId}: approved card lacks complete review`);
    }
  }

  for (const spec of release.audioSpecifications) {
    if (spec.userInitiated !== true) {
      errors.push(`${spec.audioSpecId}: audio must be user initiated`);
    }
    if (spec.silenceAlternative !== true) {
      errors.push(`${spec.audioSpecId}: audio needs silence alternative`);
    }
    for (const locale of release.locales) {
      const variant = spec.variants[locale];
      if (variant.locale !== locale) {
        errors.push(`${spec.audioSpecId}: locale variant mismatch for ${locale}`);
      }
      const asset = variant.asset;
      if (
        asset?.source === "CONTROLLED_SYNTHETIC_CANDIDATE" &&
        asset.scope !== "INTERNAL_REVIEW_ONLY"
      ) {
        errors.push(`${spec.audioSpecId}: synthetic candidate must be internal review only`);
      }
      if (
        spec.publicationStatus === "PUBLISHED" &&
        spec.voiceSourcePolicy === "HUMAN_REQUIRED" &&
        asset?.source !== "HUMAN_RECORDING"
      ) {
        errors.push(`${spec.audioSpecId}: published human-required audio needs human asset`);
      }
    }
    if (spec.publicationStatus === "PUBLISHED" && !hasAllReviews(spec.review)) {
      errors.push(`${spec.audioSpecId}: published audio lacks complete review`);
    }
    if (
      spec.publicationStatus === "WITHDRAWN" &&
      (spec.withdrawalReason === undefined || spec.withdrawalReason.trim().length === 0)
    ) {
      errors.push(`${spec.audioSpecId}: withdrawn audio needs reason`);
    }
  }

  return errors;
}
