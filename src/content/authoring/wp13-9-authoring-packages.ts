import {
  AUDIO_PIPELINE_STATUS,
  AUTHORING_LOCALES,
  AUTHORING_PIPELINE_STATUS,
  AUTHORING_SCHEMA_VERSION,
  sha256Hex,
  type AuthoringAudioSpecification,
  type AuthoringLearningDimension,
  type AuthoringLocaleCopy,
  type AuthoringPackage,
  type LearningDimensionName,
} from "../../core/authoring-pipeline.js";
import type { Locale } from "../../core/content-contracts.js";
import type {
  DraftActivity,
  DraftActivityVariant,
  DraftConstruct,
  DraftLearningCorpusRelease,
} from "../../core/draft-learning-corpus.js";
import { wp13_8DraftCorpus } from "../corpus/wp13-8-draft-corpus.js";

const DIMENSIONS: readonly LearningDimensionName[] = [
  "PHONOLOGICAL_AWARENESS",
  "GRAPHEME_PHONEME_MAPPING",
  "DECODING_ACCURACY",
  "ORTHOGRAPHIC_LEARNING",
  "SPELLING_ENCODING",
  "READING_FLUENCY",
  "MORPHOLOGY",
  "READING_COMPREHENSION",
  "WRITTEN_EXPRESSION",
  "ASSISTIVE_ACCESS",
];

function learningDimensions(construct: DraftConstruct): readonly AuthoringLearningDimension[] {
  const primary = construct === "BUILD_BLEND_ENCODE"
    ? new Set<LearningDimensionName>(["GRAPHEME_PHONEME_MAPPING", "SPELLING_ENCODING"])
    : new Set<LearningDimensionName>(["DECODING_ACCURACY", "ORTHOGRAPHIC_LEARNING"]);
  const secondary = new Set<LearningDimensionName>([
    "PHONOLOGICAL_AWARENESS",
    "GRAPHEME_PHONEME_MAPPING",
    "DECODING_ACCURACY",
    "ORTHOGRAPHIC_LEARNING",
    "SPELLING_ENCODING",
    "ASSISTIVE_ACCESS",
  ]);
  return DIMENSIONS.map((dimension) => ({
    dimension,
    emphasis: primary.has(dimension) ? "PRIMARY" : secondary.has(dimension) ? "SECONDARY" : "NOT_TARGETED",
    professionalRationale: primary.has(dimension)
      ? `Aktiviteten stiller et direkte, observerbart oppgavekrav knyttet til ${dimension}; dette er et innholdsrasjonale, ikke en egenskap ved barnet.`
      : secondary.has(dimension)
        ? `${dimension} kan være relevant for oppgaveutførelsen, men beskriver bare det konkrete oppgavekravet.`
        : `${dimension} er ikke målrettet i denne avgrensede draftaktiviteten.`,
    observableTaskRequirement: primary.has(dimension)
      ? "Voksen kan observere den konkrete byggingen eller lesingen i denne økten."
      : secondary.has(dimension)
        ? "Bare konkret støtte og respons i oppgaven kan noteres lokalt i økten."
        : "Ingen observasjon eller slutning kreves for denne dimensjonen.",
    notDiagnostic: true,
  }));
}

function localeCopy(
  release: DraftLearningCorpusRelease,
  activity: DraftActivity,
  locale: Locale,
): AuthoringLocaleCopy {
  const variant = activity.variants[locale];
  const knowledge = release.knowledge.find((item) => item.knowledgeId === variant.knowledgeId && item.locale === locale);
  const context = release.contextCards.find((item) => item.contextCardId === variant.contextCardId && item.locale === locale);
  if (knowledge === undefined || context === undefined) throw new Error(`${activity.activityId}:${locale}: source references are incomplete`);
  return {
    locale,
    activityId: activity.activityId,
    title: variant.title,
    targetWord: variant.targetStimulus.text,
    transferWord: variant.transferStimulus.text,
    instruction: variant.childSteps.join(" "),
    meaningPrompt: variant.feedbackByState.targetReady,
    transferPrompt: variant.feedbackByState.transferReady,
    adultCard: {
      understand: variant.adultCard.understand,
      doOrSay: variant.adultCard.doOrSay,
      avoid: variant.adultCard.avoid,
      deepen: variant.adultCard.deepen,
      waitAllowed: true,
      adultAuthority: true,
    },
    knowledgeUnit: {
      knowledgeId: variant.knowledgeId,
      title: knowledge.title,
      explanation: knowledge.explanation,
    },
    contextCard: {
      contextCardId: variant.contextCardId,
      knowledgeId: variant.knowledgeId,
      activityId: activity.activityId,
      text: context.action,
    },
    audioScriptIds: variant.audioSpecIds,
  };
}

function scriptsFor(variant: DraftActivityVariant): readonly string[] {
  return [
    `${variant.feedbackByState.targetReady} ${variant.targetStimulus.text}.`,
    `${variant.feedbackByState.transferReady} ${variant.transferStimulus.text}.`,
    `${variant.adultCard.understand} ${variant.adultCard.doOrSay}`,
  ];
}

function audioSpecifications(
  release: DraftLearningCorpusRelease,
  activity: DraftActivity,
): readonly AuthoringAudioSpecification[] {
  return AUTHORING_LOCALES.flatMap((locale) => {
    const variant = activity.variants[locale];
    const scripts = scriptsFor(variant);
    return variant.audioSpecIds.map((semanticAudioId, index): AuthoringAudioSpecification => {
      const source = release.audioSpecifications.find((item) => item.audioSpecId === semanticAudioId);
      if (source === undefined || source.locale !== locale) throw new Error(`${semanticAudioId}: source audio specification is missing`);
      const script = scripts[index] ?? "";
      return {
        semanticAudioId,
        locale,
        scriptFamily: index === 0 ? "TARGET_MODEL" : index === 1 ? "TRANSFER_MODEL" : "ADULT_KNOWLEDGE",
        script,
        scriptRevision: source.scriptRevision,
        takeRevision: 0,
        fileNameStem: semanticAudioId.replace(/[^a-z0-9-]/gi, "-").toLocaleLowerCase("en-US"),
        container: "WAV",
        encoding: "PCM",
        channels: 1,
        sampleRate: 48000,
        bitDepth: 24,
        durationSeconds: null,
        peakDbfs: null,
        leadingSilenceMs: null,
        trailingSilenceMs: null,
        assetSha256: null,
        scriptSha256: sha256Hex(script),
        rightsScope: "DRAFT_SPEC_NOT_RECORDED",
        voiceConsentStatus: "NOT_RECORDED",
        pronunciationReview: "NOT_REVIEWED",
        naturalnessReview: "NOT_REVIEWED",
        constructIntegrityReview: "NOT_REVIEWED",
        lifecycle: activity.lifecycleStatus,
        stale: activity.lifecycleStatus === "STALE",
        activeTakeId: null,
        replacementId: null,
        voiceSourcePolicy: "HUMAN_REQUIRED",
        userInitiated: true,
        autoplay: false,
        stopBehavior: "STOP_IMMEDIATELY",
        textAlternative: true,
        silenceAlternative: true,
        runtimeMicrophone: false,
        specificationHumanReviewed: true,
        specificationReviewSource: "WP13.9_SCOPE_2026-07-22",
      };
    });
  });
}

function packageFromActivity(release: DraftLearningCorpusRelease, activity: DraftActivity): AuthoringPackage {
  const nb = localeCopy(release, activity, "nb-NO");
  const nn = localeCopy(release, activity, "nn-NO");
  return {
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    packageId: `authoring-package-${activity.activityId}`,
    packageRevision: 1,
    sourceCorpusId: release.releaseId,
    sourceActivityId: activity.activityId,
    activityId: activity.activityId,
    patternClassId: activity.patternClassId,
    construct: activity.variants["nb-NO"].construct,
    stimulus: {
      target: { role: "TARGET", text: nb.targetWord },
      transfer: { role: "TRANSFER", text: nb.transferWord },
      transferClassification: activity.variants["nb-NO"].transferClassification,
    },
    support: {
      maximumSupport: "MODEL_REQUIRES_ADULT",
      supportProvenanceRequired: true,
      adultDecisionRequired: true,
      sessionBound: true,
    },
    learningDimensions: learningDimensions(activity.variants["nb-NO"].construct),
    locales: { "nb-NO": nb, "nn-NO": nn },
    audioSpecifications: audioSpecifications(release, activity),
    audioTakes: [],
    provenance: {
      source: "WP13.8_AUTHENTIC_DRAFT_CORPUS",
      sourceRevision: activity.revision,
      clonedFromPackageId: null,
      localMachinePathIncluded: false,
      personDataIncluded: false,
      runtimeAiUsed: false,
    },
    localReviewNotes: [],
    externalReceipts: [],
    reviewStatus: "DRAFT",
    lifecycle: activity.lifecycleStatus,
    stale: activity.lifecycleStatus === "STALE",
    supersedesPackageId: null,
    supersededByPackageId: null,
    withdrawnAt: null,
    pipelineStatus: AUTHORING_PIPELINE_STATUS,
    audioPipelineStatus: AUDIO_PIPELINE_STATUS,
    evidenceStatus: "SYNTHETIC_ONLY",
    externalReviewRequirement: "EXTERNAL_REVIEW_REQUIRED",
    betaStatus: "NOT_STUDENT_BETA",
    publishingStatus: "PUBLISHING_BLOCKED",
    nullAuthorizations: {
      publish: false,
      studentBeta: false,
      b8Decision: false,
      realData: false,
      runtimeAi: false,
      authentication: false,
      database: false,
      provider: false,
      massRecording: false,
    },
    childPreview: {
      "nb-NO": { locale: "nb-NO", title: nb.title, instruction: nb.instruction, targetWord: nb.targetWord, transferWord: nb.transferWord, dataClassification: "SYNTHETIC_ONLY", diagnosticClaim: false },
      "nn-NO": { locale: "nn-NO", title: nn.title, instruction: nn.instruction, targetWord: nn.targetWord, transferWord: nn.transferWord, dataClassification: "SYNTHETIC_ONLY", diagnosticClaim: false },
    },
    adultPreview: {
      "nb-NO": { locale: "nb-NO", title: nb.title, adultCard: nb.adultCard, knowledgeTitle: nb.knowledgeUnit.title, contextText: nb.contextCard.text, externalReceiptCount: 0, publishingBlocked: true },
      "nn-NO": { locale: "nn-NO", title: nn.title, adultCard: nn.adultCard, knowledgeTitle: nn.knowledgeUnit.title, contextText: nn.contextCard.text, externalReceiptCount: 0, publishingBlocked: true },
    },
  };
}

export function createWp13_9AuthoringPackages(
  release: DraftLearningCorpusRelease = wp13_8DraftCorpus,
): readonly AuthoringPackage[] {
  return release.activities.map((activity) => packageFromActivity(release, activity));
}

export const wp13_9AuthoringPackages = createWp13_9AuthoringPackages();
