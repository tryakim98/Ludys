import type { Locale } from "./content-contracts.js";
import type {
  DraftConstruct,
  DraftLifecycleStatus,
  DraftPatternClassLocaleReview,
  DraftSupportLevel,
  DraftTransferClassification,
} from "./draft-learning-corpus.js";

export const AUTHORING_SCHEMA_VERSION = "WP13.9-AUTHORING-1" as const;
export const AUTHORING_DRAFT_SCHEMA_VERSION = "LUDYS-AUTHORING-DRAFT-2" as const;
export const AUTHORING_PIPELINE_STATUS = "AUTHORING_PIPELINE_READY" as const;
export const AUDIO_PIPELINE_STATUS = "AUDIO_PRODUCTION_PIPELINE_READY" as const;
export const AUTHORING_LOCALES = ["nb-NO", "nn-NO"] as const;

export type LearningDimensionName =
  | "PHONOLOGICAL_AWARENESS"
  | "GRAPHEME_PHONEME_MAPPING"
  | "DECODING_ACCURACY"
  | "ORTHOGRAPHIC_LEARNING"
  | "SPELLING_ENCODING"
  | "READING_FLUENCY"
  | "MORPHOLOGY"
  | "READING_COMPREHENSION"
  | "WRITTEN_EXPRESSION"
  | "ASSISTIVE_ACCESS";

export type LearningDimensionEmphasis = "PRIMARY" | "SECONDARY" | "NOT_TARGETED";
export type AuthoringReviewStatus = "DRAFT" | "REVIEW_PENDING";
export type AuthoringLifecycleStatus = DraftLifecycleStatus;
export type AudioScriptFamily = "TARGET_MODEL" | "TRANSFER_MODEL" | "ADULT_KNOWLEDGE";

export interface AuthoringLearningDimension {
  readonly dimension: LearningDimensionName;
  readonly emphasis: LearningDimensionEmphasis;
  readonly professionalRationale: string;
  readonly observableTaskRequirement: string;
  readonly notDiagnostic: true;
}

export interface AuthoringStimulusMetadata {
  readonly target: { readonly role: "TARGET"; readonly text: string };
  readonly transfer: { readonly role: "TRANSFER"; readonly text: string };
  readonly transferClassification: DraftTransferClassification;
}

export interface AuthoringSupportContract {
  readonly maximumSupport: Exclude<DraftSupportLevel, "NONE">;
  readonly supportProvenanceRequired: true;
  readonly adultDecisionRequired: true;
  readonly sessionBound: true;
}

export interface AuthoringAdultCardCopy {
  readonly understand: string;
  readonly doOrSay: string;
  readonly avoid: string;
  readonly deepen: string;
  readonly waitAllowed: true;
  readonly adultAuthority: true;
}

export interface AuthoringKnowledgeCopy {
  readonly knowledgeId: string;
  readonly title: string;
  readonly explanation: string;
}

export interface AuthoringContextCopy {
  readonly contextCardId: string;
  readonly knowledgeId: string;
  readonly activityId: string;
  readonly text: string;
}

export interface AuthoringLocaleCopy {
  readonly locale: Locale;
  readonly activityId: string;
  readonly title: string;
  readonly targetWord: string;
  readonly transferWord: string;
  readonly instruction: string;
  readonly meaningPrompt: string;
  readonly transferPrompt: string;
  readonly adultCard: AuthoringAdultCardCopy;
  readonly knowledgeUnit: AuthoringKnowledgeCopy;
  readonly contextCard: AuthoringContextCopy;
  readonly audioScriptIds: readonly [string, string, string];
}

export interface AuthoringAudioSpecification {
  readonly semanticAudioId: string;
  readonly locale: Locale;
  readonly scriptFamily: AudioScriptFamily;
  readonly script: string;
  readonly scriptRevision: number;
  readonly takeRevision: number;
  readonly fileNameStem: string;
  readonly container: "WAV";
  readonly encoding: "PCM";
  readonly channels: 1;
  readonly sampleRate: 48000;
  readonly bitDepth: 16 | 24;
  readonly durationSeconds: number | null;
  readonly peakDbfs: number | null;
  readonly leadingSilenceMs: number | null;
  readonly trailingSilenceMs: number | null;
  readonly assetSha256: string | null;
  readonly scriptSha256: string;
  readonly rightsScope: "DRAFT_SPEC_NOT_RECORDED" | "INTERNAL_TECHNICAL_TRIAL_ONLY";
  readonly voiceConsentStatus: "NOT_RECORDED" | "NOT_APPLICABLE_NOT_HUMAN_SPEECH";
  readonly pronunciationReview: "NOT_REVIEWED";
  readonly naturalnessReview: "NOT_REVIEWED";
  readonly constructIntegrityReview: "NOT_REVIEWED";
  readonly lifecycle: AuthoringLifecycleStatus;
  readonly stale: boolean;
  readonly activeTakeId: string | null;
  readonly replacementId: string | null;
  readonly voiceSourcePolicy: "HUMAN_REQUIRED";
  readonly userInitiated: true;
  readonly autoplay: false;
  readonly stopBehavior: "STOP_IMMEDIATELY";
  readonly textAlternative: true;
  readonly silenceAlternative: true;
  readonly runtimeMicrophone: false;
  readonly specificationHumanReviewed: boolean;
  readonly specificationReviewSource: "WP13.9_SCOPE_2026-07-22" | null;
}

export interface AuthoringAudioTake {
  readonly takeId: string;
  readonly semanticAudioId: string;
  readonly fileName: string;
  readonly container: "WAV";
  readonly encoding: "PCM";
  readonly channels: 1;
  readonly sampleRate: 48000;
  readonly bitDepth: 16 | 24;
  readonly durationSeconds: number;
  readonly peakDbfs: number;
  readonly leadingSilenceMs: number;
  readonly trailingSilenceMs: number;
  readonly assetSha256: string;
  readonly scriptSha256: string;
  readonly rightsScope: "INTERNAL_TECHNICAL_TRIAL_ONLY";
  readonly voiceConsentStatus: "NOT_APPLICABLE_NOT_HUMAN_SPEECH";
  readonly pronunciationReview: "NOT_REVIEWED";
  readonly naturalnessReview: "NOT_REVIEWED";
  readonly constructIntegrityReview: "NOT_REVIEWED";
  readonly classification: readonly [
    "INTERNAL_TECHNICAL_TRIAL_ONLY",
    "NOT_HUMAN_SPEECH",
    "NOT_REVIEWED",
    "NOT_PRODUCTION_AUDIO",
  ];
}

export interface LocalAuthoringReviewNote {
  readonly reviewId: string;
  readonly name: string;
  readonly role: string;
  readonly scope: string;
  readonly decision: "COMMENT" | "CHANGES_REQUESTED" | "READY_FOR_EXTERNAL_HANDOFF";
  readonly comment: string;
  readonly timestamp: string;
  readonly signatureText: string;
  readonly externalReceipt: false;
  readonly receiptIntegrityVerified: false;
}

export interface AuthoringProvenance {
  readonly source: "WP13.8_AUTHENTIC_DRAFT_CORPUS" | "AI_ASSISTED_CONTENT_DRAFT";
  readonly sourceRevision: number;
  readonly clonedFromPackageId: string | null;
  readonly localMachinePathIncluded: false;
  readonly personDataIncluded: false;
  readonly runtimeAiUsed: false;
}

/** Editorial proposals only. This metadata cannot authorize learner runtime. */
export interface PendingPatternReview {
  readonly patternClassId: string;
  readonly humanReviewed: false;
  readonly ageBand: "6-9";
  readonly locales: Readonly<Record<Locale, Omit<DraftPatternClassLocaleReview, "humanReviewed" | "reviewSource">>>;
  readonly dictionarySources: readonly string[];
}

export interface AuthoringNullAuthorizations {
  readonly publish: false;
  readonly studentBeta: false;
  readonly b8Decision: false;
  readonly realData: false;
  readonly runtimeAi: false;
  readonly authentication: false;
  readonly database: false;
  readonly provider: false;
  readonly massRecording: false;
}

export interface AuthoringChildPreview {
  readonly locale: Locale;
  readonly title: string;
  readonly instruction: string;
  readonly targetWord: string;
  readonly transferWord: string;
  readonly dataClassification: "SYNTHETIC_ONLY";
  readonly diagnosticClaim: false;
}

export interface AuthoringAdultPreview {
  readonly locale: Locale;
  readonly title: string;
  readonly adultCard: AuthoringAdultCardCopy;
  readonly knowledgeTitle: string;
  readonly contextText: string;
  readonly externalReceiptCount: 0;
  readonly publishingBlocked: true;
}

export interface AuthoringPackage {
  readonly schemaVersion: typeof AUTHORING_SCHEMA_VERSION | typeof AUTHORING_DRAFT_SCHEMA_VERSION;
  readonly packageId: string;
  readonly packageRevision: number;
  readonly sourceCorpusId: string;
  readonly sourceActivityId: string;
  readonly activityId: string;
  readonly patternClassId: string;
  readonly construct: DraftConstruct;
  readonly stimulus: AuthoringStimulusMetadata;
  readonly support: AuthoringSupportContract;
  readonly learningDimensions: readonly AuthoringLearningDimension[];
  readonly locales: Readonly<Record<Locale, AuthoringLocaleCopy>>;
  readonly audioSpecifications: readonly AuthoringAudioSpecification[];
  readonly audioTakes: readonly AuthoringAudioTake[];
  readonly provenance: AuthoringProvenance;
  readonly pendingPatternReview?: PendingPatternReview;
  readonly localReviewNotes: readonly LocalAuthoringReviewNote[];
  readonly externalReceipts: readonly [];
  readonly reviewStatus: AuthoringReviewStatus;
  readonly lifecycle: AuthoringLifecycleStatus;
  readonly stale: boolean;
  readonly supersedesPackageId: string | null;
  readonly supersededByPackageId: string | null;
  readonly withdrawnAt: string | null;
  readonly pipelineStatus: typeof AUTHORING_PIPELINE_STATUS;
  readonly audioPipelineStatus: typeof AUDIO_PIPELINE_STATUS;
  readonly evidenceStatus: "SYNTHETIC_ONLY";
  readonly externalReviewRequirement: "EXTERNAL_REVIEW_REQUIRED";
  readonly betaStatus: "NOT_STUDENT_BETA";
  readonly publishingStatus: "PUBLISHING_BLOCKED";
  readonly nullAuthorizations: AuthoringNullAuthorizations;
  readonly childPreview: Readonly<Record<Locale, AuthoringChildPreview>>;
  readonly adultPreview: Readonly<Record<Locale, AuthoringAdultPreview>>;
}

export interface AuthoringPackageValidation {
  readonly errors: readonly string[];
  readonly validForDraftExport: boolean;
  readonly validForExternalReviewHandoff: boolean;
  readonly validForPublish: false;
}

export interface AuthoringLifecycleRestriction {
  readonly scope: "AUTHORING_PACKAGE" | "AUDIO_SPEC";
  readonly scopeId: string;
  readonly lifecycleStatus: Exclude<AuthoringLifecycleStatus, "CURRENT">;
}

export interface AuthoringLifecyclePolicy {
  readonly policyRevision: number;
  readonly restrictions: readonly AuthoringLifecycleRestriction[];
  readonly containsPersonData: false;
  readonly resurrectionAllowed: false;
  readonly publishingAuthority: false;
}

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

const PACKAGE_KEYS = [
  "schemaVersion", "packageId", "packageRevision", "sourceCorpusId", "sourceActivityId",
  "activityId", "patternClassId", "construct", "stimulus", "support", "learningDimensions",
  "locales", "audioSpecifications", "audioTakes", "provenance", "localReviewNotes",
  "externalReceipts", "reviewStatus", "lifecycle", "stale", "supersedesPackageId",
  "supersededByPackageId", "withdrawnAt", "pipelineStatus", "audioPipelineStatus",
  "evidenceStatus", "externalReviewRequirement", "betaStatus", "publishingStatus",
  "nullAuthorizations", "childPreview", "adultPreview", "pendingPatternReview",
] as const;

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256Hex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const dataView = new DataView(padded.buffer);
  dataView.setUint32(paddedLength - 4, bitLength >>> 0, false);
  dataView.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = dataView.getUint32(offset + (index * 4), false);
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] ?? 0;
      const previous2 = words[index - 2] ?? 0;
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      words[index] = ((words[index - 16] ?? 0) + sigma0 + (words[index - 7] ?? 0) + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash as [number, number, number, number, number, number, number, number];
    for (let index = 0; index < 64; index += 1) {
      const bigSigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + bigSigma1 + choice + (constants[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const bigSigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (bigSigma0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temporary1) >>> 0; d = c; c = b; b = a; a = (temporary1 + temporary2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, h];
    for (let index = 0; index < hash.length; index += 1) hash[index] = ((hash[index] ?? 0) + (next[index] ?? 0)) >>> 0;
  }
  return hash.map((part) => part.toString(16).padStart(8, "0")).join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function deterministicAuthoringJson(authoringPackage: AuthoringPackage): string {
  return `${JSON.stringify(stableValue(authoringPackage), null, 2)}\n`;
}

function requiredText(errors: string[], value: string, path: string): void {
  if (value.trim().length === 0) errors.push(`${path} is required`);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

export function validateAudioProductionCandidate(
  take: AuthoringAudioTake,
  knownAssetSha256?: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  if (take.container !== "WAV" || take.encoding !== "PCM") errors.push(`${take.takeId}: audio must be WAV PCM`);
  if (take.channels !== 1) errors.push(`${take.takeId}: audio must be mono`);
  if (take.sampleRate !== 48000) errors.push(`${take.takeId}: production candidate must be 48 kHz`);
  if (![16, 24].includes(take.bitDepth)) errors.push(`${take.takeId}: bit depth must be 16 or 24`);
  if (take.durationSeconds <= 0 || take.durationSeconds > 30) errors.push(`${take.takeId}: duration must be 0-30 seconds`);
  if (take.peakDbfs < -18 || take.peakDbfs > -1) errors.push(`${take.takeId}: peak must be between -18 and -1 dBFS`);
  if (take.leadingSilenceMs < 0 || take.leadingSilenceMs > 500) errors.push(`${take.takeId}: leading silence exceeds 500 ms`);
  if (take.trailingSilenceMs < 0 || take.trailingSilenceMs > 700) errors.push(`${take.takeId}: trailing silence exceeds 700 ms`);
  if (!/^[a-f0-9]{64}$/.test(take.assetSha256)) errors.push(`${take.takeId}: invalid asset SHA-256`);
  if (!/^[a-f0-9]{64}$/.test(take.scriptSha256)) errors.push(`${take.takeId}: invalid script SHA-256`);
  if (knownAssetSha256 !== undefined && !knownAssetSha256.has(take.assetSha256)) {
    errors.push(`${take.takeId}: unknown audio asset checksum`);
  }
  if (take.rightsScope !== "INTERNAL_TECHNICAL_TRIAL_ONLY") errors.push(`${take.takeId}: technical fixture rights are invalid`);
  if (take.voiceConsentStatus !== "NOT_APPLICABLE_NOT_HUMAN_SPEECH") errors.push(`${take.takeId}: technical fixture cannot claim voice consent`);
  if (take.pronunciationReview !== "NOT_REVIEWED" || take.naturalnessReview !== "NOT_REVIEWED" || take.constructIntegrityReview !== "NOT_REVIEWED") {
    errors.push(`${take.takeId}: technical fixture cannot claim human review`);
  }
  const required = "INTERNAL_TECHNICAL_TRIAL_ONLY|NOT_HUMAN_SPEECH|NOT_REVIEWED|NOT_PRODUCTION_AUDIO";
  if (take.classification.join("|") !== required) errors.push(`${take.takeId}: technical fixture classification is incomplete`);
  return errors;
}

export function validateAuthoringLifecyclePolicy(policy: AuthoringLifecyclePolicy): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(policy.policyRevision) || policy.policyRevision < 1) errors.push("policyRevision must be positive");
  if (policy.containsPersonData !== false) errors.push("authoring policy must remain person-free");
  if (policy.resurrectionAllowed !== false) errors.push("authoring policy cannot allow resurrection");
  if (policy.publishingAuthority !== false) errors.push("authoring policy cannot grant publishing authority");
  for (const restriction of policy.restrictions) {
    if (!restriction.scopeId.trim()) errors.push("authoring restriction scopeId is required");
    if (!(["STALE", "SUPERSEDED", "WITHDRAWN"] as const).includes(restriction.lifecycleStatus)) {
      errors.push(`${restriction.scopeId}: policy can only add restrictions`);
    }
  }
  return errors;
}

export function validateAuthoringPackage(authoringPackage: AuthoringPackage): AuthoringPackageValidation {
  const errors: string[] = [];
  const extras = exactKeys(authoringPackage as unknown as Record<string, unknown>, PACKAGE_KEYS);
  if (extras.length > 0) errors.push(`unknown package fields: ${extras.join(", ")}`);
  const unreviewedProposal = authoringPackage.provenance.source === "AI_ASSISTED_CONTENT_DRAFT";
  const expectedSchema = unreviewedProposal ? AUTHORING_DRAFT_SCHEMA_VERSION : AUTHORING_SCHEMA_VERSION;
  if (authoringPackage.schemaVersion !== expectedSchema) errors.push("unknown authoring schema or provenance/schema mismatch");
  if (!unreviewedProposal && authoringPackage.provenance.source !== "WP13.8_AUTHENTIC_DRAFT_CORPUS") {
    errors.push("unknown content provenance");
  }
  if (unreviewedProposal) {
    const review = authoringPackage.pendingPatternReview;
    if (review === undefined || review.humanReviewed !== false || review.patternClassId !== authoringPackage.patternClassId || review.ageBand !== "6-9") {
      errors.push("new content requires an explicit unreviewed pattern proposal");
    } else {
      for (const locale of AUTHORING_LOCALES) {
        const variant = review.locales[locale];
        if (variant === undefined || variant.locale !== locale) {
          errors.push(`${locale}: explicit pending pattern review is required`);
          continue;
        }
        for (const field of ["title", "norwegianGraphemePhonemeSuitability", "writtenStandard", "pronunciationAndDialectLimits", "vowelLength", "consonantDoubling", "orthographicComplexity", "morphologicalComplexity", "investigates", "cannotProve", "stimulusRationale"] as const) {
          requiredText(errors, variant[field], `${locale}.pendingPatternReview.${field}`);
        }
        if (variant.openReviewerQuestions.length === 0) errors.push(`${locale}: open review questions are required`);
      }
      if (review.dictionarySources.length === 0) errors.push("dictionary source references are required");
    }
  } else if (authoringPackage.pendingPatternReview !== undefined) {
    errors.push("pending pattern review cannot be relabelled as historical reviewed content");
  }
  for (const [path, value] of [
    ["packageId", authoringPackage.packageId], ["sourceCorpusId", authoringPackage.sourceCorpusId],
    ["sourceActivityId", authoringPackage.sourceActivityId], ["activityId", authoringPackage.activityId],
    ["patternClassId", authoringPackage.patternClassId],
  ] as const) requiredText(errors, value, path);
  if (!Number.isInteger(authoringPackage.packageRevision) || authoringPackage.packageRevision < 1) errors.push("packageRevision must be positive");
  if (authoringPackage.stimulus.target.role !== "TARGET" || authoringPackage.stimulus.transfer.role !== "TRANSFER") errors.push("stimulus roles are invalid");
  requiredText(errors, authoringPackage.stimulus.target.text, "stimulus.target.text");
  requiredText(errors, authoringPackage.stimulus.transfer.text, "stimulus.transfer.text");
  if (!authoringPackage.support.supportProvenanceRequired || !authoringPackage.support.adultDecisionRequired || !authoringPackage.support.sessionBound) {
    errors.push("support must remain session-bound, adult-controlled and provenance-bearing");
  }

  const dimensionNames = new Set(authoringPackage.learningDimensions.map((item) => item.dimension));
  if (dimensionNames.size !== DIMENSIONS.length || DIMENSIONS.some((item) => !dimensionNames.has(item))) errors.push("all ten learning dimensions are required exactly once");
  for (const item of authoringPackage.learningDimensions) {
    requiredText(errors, item.professionalRationale, `${item.dimension}.professionalRationale`);
    requiredText(errors, item.observableTaskRequirement, `${item.dimension}.observableTaskRequirement`);
    if (item.notDiagnostic !== true) errors.push(`${item.dimension}: notDiagnostic must be true`);
  }

  const audioIds = new Set(authoringPackage.audioSpecifications.map((item) => item.semanticAudioId));
  if (audioIds.size !== authoringPackage.audioSpecifications.length) errors.push("duplicate semantic audio IDs");
  if (authoringPackage.audioSpecifications.length < 6) errors.push("each package requires at least six audio specifications");
  const takeIds = new Set(authoringPackage.audioTakes.map((item) => item.takeId));
  if (takeIds.size !== authoringPackage.audioTakes.length) errors.push("duplicate audio take IDs");

  for (const locale of AUTHORING_LOCALES) {
    const copy = authoringPackage.locales[locale];
    if (copy === undefined || copy.locale !== locale) {
      errors.push(`${locale}: explicit locale copy is required`);
      continue;
    }
    if (copy.activityId !== authoringPackage.activityId) errors.push(`${locale}: activity-reference drift`);
    for (const [field, value] of [
      ["title", copy.title], ["targetWord", copy.targetWord], ["transferWord", copy.transferWord],
      ["instruction", copy.instruction], ["meaningPrompt", copy.meaningPrompt], ["transferPrompt", copy.transferPrompt],
      ["adultCard.understand", copy.adultCard.understand], ["adultCard.doOrSay", copy.adultCard.doOrSay],
      ["adultCard.avoid", copy.adultCard.avoid], ["adultCard.deepen", copy.adultCard.deepen],
      ["knowledgeUnit.title", copy.knowledgeUnit.title], ["knowledgeUnit.explanation", copy.knowledgeUnit.explanation],
      ["contextCard.text", copy.contextCard.text],
    ] as const) requiredText(errors, value, `${locale}.${field}`);
    if (copy.contextCard.knowledgeId !== copy.knowledgeUnit.knowledgeId) errors.push(`${locale}: orphaned knowledge ID`);
    if (copy.contextCard.activityId !== authoringPackage.activityId) errors.push(`${locale}: orphaned context activity ID`);
    if (new Set(copy.audioScriptIds).size !== copy.audioScriptIds.length || copy.audioScriptIds.some((id) => !audioIds.has(id) || !authoringPackage.audioSpecifications.some((spec) => spec.semanticAudioId === id && spec.locale === locale))) {
      errors.push(`${locale}: orphaned or mixed-locale audio ID`);
    }
    if (copy.audioScriptIds.length !== 3) errors.push(`${locale}: three explicit audio scripts are required`);
    const localeAudio = authoringPackage.audioSpecifications.filter((item) => item.locale === locale);
    if (localeAudio.length < 3) errors.push(`${locale}: at least three audio specifications are required`);
    const childPreview = authoringPackage.childPreview[locale];
    const adultPreview = authoringPackage.adultPreview[locale];
    if (childPreview.locale !== locale || childPreview.dataClassification !== "SYNTHETIC_ONLY" || childPreview.diagnosticClaim !== false) errors.push(`${locale}: child preview boundary is invalid`);
    if (adultPreview.locale !== locale || adultPreview.externalReceiptCount !== 0 || !adultPreview.publishingBlocked) errors.push(`${locale}: adult preview boundary is invalid`);
  }

  for (const spec of authoringPackage.audioSpecifications) {
    requiredText(errors, spec.script, `${spec.semanticAudioId}.script`);
    if (spec.scriptSha256 !== sha256Hex(spec.script)) errors.push(`${spec.semanticAudioId}: script checksum mismatch`);
    if (spec.container !== "WAV" || spec.encoding !== "PCM" || spec.channels !== 1 || spec.sampleRate !== 48000 || ![16, 24].includes(spec.bitDepth)) {
      errors.push(`${spec.semanticAudioId}: audio production format is invalid`);
    }
    if (spec.voiceSourcePolicy !== "HUMAN_REQUIRED" || spec.runtimeMicrophone || spec.autoplay || !spec.userInitiated || spec.stopBehavior !== "STOP_IMMEDIATELY" || !spec.textAlternative || !spec.silenceAlternative) {
      errors.push(`${spec.semanticAudioId}: runtime audio boundary is invalid`);
    }
    if (spec.pronunciationReview !== "NOT_REVIEWED" || spec.naturalnessReview !== "NOT_REVIEWED" || spec.constructIntegrityReview !== "NOT_REVIEWED") {
      errors.push(`${spec.semanticAudioId}: external audio review cannot be claimed`);
    }
    if (unreviewedProposal) {
      if (spec.specificationHumanReviewed !== false || spec.specificationReviewSource !== null) {
        errors.push(`${spec.semanticAudioId}: new draft cannot claim human specification review`);
      }
    } else if (!spec.specificationHumanReviewed || spec.specificationReviewSource !== "WP13.9_SCOPE_2026-07-22") {
      errors.push(`${spec.semanticAudioId}: audio specification contract review is missing`);
    }
    if (spec.stale !== (spec.lifecycle === "STALE")) errors.push(`${spec.semanticAudioId}: stale lifecycle mismatch`);
    if (spec.lifecycle === "WITHDRAWN" && spec.activeTakeId !== null) errors.push(`${spec.semanticAudioId}: withdrawn audio cannot retain active take`);
    if (spec.activeTakeId !== null && !takeIds.has(spec.activeTakeId)) errors.push(`${spec.semanticAudioId}: active take is unknown`);
  }
  for (const take of authoringPackage.audioTakes) {
    if (!audioIds.has(take.semanticAudioId)) errors.push(`${take.takeId}: orphaned audio take`);
    errors.push(...validateAudioProductionCandidate(take));
  }

  for (const note of authoringPackage.localReviewNotes) {
    for (const [field, value] of [["reviewId", note.reviewId], ["name", note.name], ["role", note.role], ["scope", note.scope], ["comment", note.comment], ["timestamp", note.timestamp], ["signatureText", note.signatureText]] as const) {
      requiredText(errors, value, `localReview.${field}`);
    }
    if (note.externalReceipt || note.receiptIntegrityVerified) errors.push(`${note.reviewId}: local note cannot become an external receipt`);
  }
  if (authoringPackage.externalReceipts.length !== 0) errors.push("external receipts require signed integrity-verified artifacts");
  if (!(authoringPackage.reviewStatus === "DRAFT" || authoringPackage.reviewStatus === "REVIEW_PENDING")) errors.push("unsupported review or approval status");
  if (!(["CURRENT", "STALE", "SUPERSEDED", "WITHDRAWN"] as const).includes(authoringPackage.lifecycle)) errors.push("invalid package lifecycle");
  if (authoringPackage.pipelineStatus !== AUTHORING_PIPELINE_STATUS || authoringPackage.audioPipelineStatus !== AUDIO_PIPELINE_STATUS) errors.push("pipeline readiness markers are incomplete");
  if (authoringPackage.evidenceStatus !== "SYNTHETIC_ONLY" || authoringPackage.externalReviewRequirement !== "EXTERNAL_REVIEW_REQUIRED" || authoringPackage.betaStatus !== "NOT_STUDENT_BETA") errors.push("draft boundary markers are incomplete");
  if (authoringPackage.publishingStatus !== "PUBLISHING_BLOCKED") errors.push("publishing must remain blocked");
  if (Object.values(authoringPackage.nullAuthorizations).some((value) => value !== false)) errors.push("all production authorizations must remain false");
  if (authoringPackage.reviewStatus === "REVIEW_PENDING" && authoringPackage.localReviewNotes.length === 0) errors.push("review handoff requires a local trace note");
  if (authoringPackage.lifecycle === "WITHDRAWN" && authoringPackage.audioSpecifications.some((item) => item.lifecycle !== "WITHDRAWN" || item.activeTakeId !== null)) errors.push("package withdrawal must withdraw all audio");
  const serialized = JSON.stringify(authoringPackage);
  const identityKeys = ["child", "student", "user"].map((prefix) => `${prefix}Id`);
  const forbiddenPersonKey = new RegExp(`"(?:${[...identityKeys, "profile", "diagnosis"].join("|")})"\\s*:`, "i");
  if (forbiddenPersonKey.test(serialized)) errors.push("person profile or diagnostic field is forbidden");
  if (/(?:[A-Z]:\\Users\\|\/Users\/|\/home\/[^/]+\/|\.env\b|Bearer\s+|api[_-]?key)/i.test(serialized)) errors.push("local path, environment file or secret material is forbidden");

  return {
    errors,
    validForDraftExport: errors.length === 0,
    validForExternalReviewHandoff: errors.length === 0,
    validForPublish: false,
  };
}

export function validateAuthoringPackageSet(packages: readonly AuthoringPackage[]): string[] {
  const errors = packages.flatMap((item) => validateAuthoringPackage(item).errors.map((error) => `${item.packageId}: ${error}`));
  for (const [label, values] of [
    ["package", packages.map((item) => item.packageId)],
    ["activity", packages.map((item) => item.activityId)],
    ["audio", packages.flatMap((item) => item.audioSpecifications.map((audio) => audio.semanticAudioId))],
  ] as const) {
    if (new Set(values).size !== values.length) errors.push(`duplicate ${label} semantic IDs`);
  }
  return errors;
}
