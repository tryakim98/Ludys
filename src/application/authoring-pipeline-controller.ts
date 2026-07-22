import {
  AUTHORING_SCHEMA_VERSION,
  deterministicAuthoringJson,
  sha256Hex,
  validateAudioProductionCandidate,
  validateAuthoringLifecyclePolicy,
  validateAuthoringPackage,
  validateAuthoringPackageSet,
  type AudioScriptFamily,
  type AuthoringAudioSpecification,
  type AuthoringAudioTake,
  type AuthoringLifecyclePolicy,
  type AuthoringLifecycleRestriction,
  type AuthoringLocaleCopy,
  type AuthoringPackage,
  type AuthoringPackageValidation,
  type AuthoringReviewStatus,
  type LocalAuthoringReviewNote,
} from "../core/authoring-pipeline.js";
import type { Locale } from "../core/content-contracts.js";
import type {
  DraftConstruct,
  DraftTransferClassification,
} from "../core/draft-learning-corpus.js";

export type AuthoringLocaleTextField =
  | "title"
  | "targetWord"
  | "transferWord"
  | "instruction"
  | "meaningPrompt"
  | "transferPrompt"
  | "adultUnderstand"
  | "adultDoOrSay"
  | "adultAvoid"
  | "adultDeepen"
  | "knowledgeTitle"
  | "knowledgeExplanation"
  | "contextCard";

export interface AuthoringPackageSummary {
  readonly packageId: string;
  readonly activityId: string;
  readonly patternClassId: string;
  readonly title: string;
  readonly reviewStatus: AuthoringReviewStatus;
  readonly lifecycle: AuthoringPackage["lifecycle"];
  readonly selected: boolean;
}

export interface AuthoringPipelineView {
  readonly packages: readonly AuthoringPackageSummary[];
  readonly selectedPackage: AuthoringPackage;
  readonly locale: Locale;
  readonly validation: AuthoringPackageValidation;
  readonly exportJson: string;
  readonly importError: string | undefined;
  readonly lastAction: string;
  readonly audioPreviewState: "SILENT" | "TECHNICAL_TRIAL_REQUESTED" | "STOPPED" | "BLOCKED";
  readonly activePreviewAudioId: string | undefined;
  readonly externalReceiptCount: 0;
  readonly publishingAvailable: false;
  readonly sessionMutationAvailable: false;
}

const LIFECYCLE_PRIORITY: Readonly<Record<Exclude<AuthoringPackage["lifecycle"], "CURRENT">, number>> = {
  STALE: 1,
  SUPERSEDED: 2,
  WITHDRAWN: 3,
};

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function localeCode(locale: Locale): string {
  return locale === "nb-NO" ? "nb" : "nn";
}

function audioFamilySuffix(family: AudioScriptFamily): string {
  return family === "TARGET_MODEL" ? "target-model" : family === "TRANSFER_MODEL" ? "transfer-model" : "adult-knowledge";
}

function refreshPreviews(authoringPackage: AuthoringPackage): AuthoringPackage {
  const nb = authoringPackage.locales["nb-NO"];
  const nn = authoringPackage.locales["nn-NO"];
  return {
    ...authoringPackage,
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

function lifecycleFromRestriction(
  current: AuthoringPackage["lifecycle"],
  incoming: Exclude<AuthoringPackage["lifecycle"], "CURRENT">,
): AuthoringPackage["lifecycle"] {
  if (current === "WITHDRAWN") return current;
  if (current === "CURRENT") return incoming;
  return LIFECYCLE_PRIORITY[incoming] > LIFECYCLE_PRIORITY[current] ? incoming : current;
}

export class AuthoringPipelineController {
  #packages: AuthoringPackage[];
  #selectedPackageId: string;
  #locale: Locale = "nb-NO";
  #importError: string | undefined;
  #lastAction = "AUTHORING_PIPELINE_READY";
  #audioPreviewState: AuthoringPipelineView["audioPreviewState"] = "SILENT";
  #activePreviewAudioId: string | undefined;
  #policy: AuthoringLifecyclePolicy = {
    policyRevision: 1,
    restrictions: [],
    containsPersonData: false,
    resurrectionAllowed: false,
    publishingAuthority: false,
  };
  readonly #knownSourceActivityIds: ReadonlySet<string>;
  readonly #knownPatternClassIds: ReadonlySet<string>;
  readonly #technicalTakes: ReadonlyMap<string, AuthoringAudioTake>;

  public constructor(
    packages: readonly AuthoringPackage[],
    technicalTakes: readonly AuthoringAudioTake[] = [],
  ) {
    if (packages.length === 0) throw new Error("authoring pipeline requires at least one package");
    const errors = validateAuthoringPackageSet(packages);
    if (errors.length > 0) throw new Error(errors.join("; "));
    this.#packages = packages.map(deepClone);
    this.#selectedPackageId = this.#packages[0]?.packageId ?? "";
    this.#knownSourceActivityIds = new Set(packages.map((item) => item.sourceActivityId));
    this.#knownPatternClassIds = new Set(packages.map((item) => item.patternClassId));
    this.#technicalTakes = new Map(technicalTakes.map((item) => [item.takeId, deepClone(item)]));
  }

  public get packages(): readonly AuthoringPackage[] {
    return this.#packages.map(deepClone);
  }

  public get selectedPackage(): AuthoringPackage {
    const selected = this.#packages.find((item) => item.packageId === this.#selectedPackageId);
    if (selected === undefined) throw new Error("selected authoring package is missing");
    return selected;
  }

  #replace(next: AuthoringPackage): void {
    this.#packages = this.#packages.map((item) => item.packageId === next.packageId ? refreshPreviews(next) : item);
    this.#lastAction = "LOCAL_DRAFT_UPDATED";
    this.#importError = undefined;
  }

  #bump(authoringPackage: AuthoringPackage): AuthoringPackage {
    return {
      ...authoringPackage,
      packageRevision: authoringPackage.packageRevision + 1,
      reviewStatus: "DRAFT",
    };
  }

  #markAudioStale(
    authoringPackage: AuthoringPackage,
    locale: Locale,
    families: readonly AudioScriptFamily[],
  ): AuthoringPackage {
    return {
      ...authoringPackage,
      audioSpecifications: authoringPackage.audioSpecifications.map((spec) =>
        spec.locale === locale && families.includes(spec.scriptFamily) && spec.lifecycle !== "WITHDRAWN"
          ? { ...spec, stale: true, lifecycle: "STALE" as const }
          : spec),
    };
  }

  public setLocale(locale: Locale): AuthoringPipelineView {
    this.#locale = locale;
    this.#lastAction = `LOCALE_${locale}`;
    return this.view;
  }

  public selectPackage(packageId: string): AuthoringPipelineView {
    if (!this.#packages.some((item) => item.packageId === packageId)) throw new Error("unknown authoring package");
    this.#selectedPackageId = packageId;
    this.#audioPreviewState = "SILENT";
    this.#activePreviewAudioId = undefined;
    this.#lastAction = "PACKAGE_SELECTED";
    return this.view;
  }

  public cloneCompleteDraft(newActivityId: string): AuthoringPipelineView {
    if (!/^[a-z0-9][a-z0-9-]{7,}$/i.test(newActivityId)) throw new Error("new semantic activityId is invalid");
    if (this.#packages.some((item) => item.activityId === newActivityId)) throw new Error("duplicate semantic activityId");
    const source = this.selectedPackage;
    const audioIdMap = new Map<string, string>();
    const nextAudio = source.audioSpecifications.map((spec) => {
      const nextId = `${newActivityId}-${localeCode(spec.locale)}-${audioFamilySuffix(spec.scriptFamily)}`;
      audioIdMap.set(spec.semanticAudioId, nextId);
      return {
        ...spec,
        semanticAudioId: nextId,
        fileNameStem: nextId,
        takeRevision: 0,
        durationSeconds: null,
        peakDbfs: null,
        leadingSilenceMs: null,
        trailingSilenceMs: null,
        assetSha256: null,
        rightsScope: "DRAFT_SPEC_NOT_RECORDED" as const,
        voiceConsentStatus: "NOT_RECORDED" as const,
        lifecycle: "CURRENT" as const,
        stale: false,
        activeTakeId: null,
        replacementId: null,
      };
    });
    const remapLocale = (locale: Locale): AuthoringLocaleCopy => {
      const copy = source.locales[locale];
      const knowledgeId = `knowledge-${newActivityId}`;
      return {
        ...copy,
        activityId: newActivityId,
        knowledgeUnit: { ...copy.knowledgeUnit, knowledgeId },
        contextCard: {
          ...copy.contextCard,
          contextCardId: `context-${newActivityId}`,
          knowledgeId,
          activityId: newActivityId,
        },
        audioScriptIds: copy.audioScriptIds.map((id) => audioIdMap.get(id) ?? "") as unknown as readonly [string, string, string],
      };
    };
    const next = refreshPreviews({
      ...source,
      packageId: `authoring-package-${newActivityId}`,
      packageRevision: 1,
      activityId: newActivityId,
      locales: { "nb-NO": remapLocale("nb-NO"), "nn-NO": remapLocale("nn-NO") },
      audioSpecifications: nextAudio,
      audioTakes: [],
      provenance: { ...source.provenance, clonedFromPackageId: source.packageId },
      localReviewNotes: [],
      externalReceipts: [],
      reviewStatus: "DRAFT",
      lifecycle: "CURRENT",
      stale: false,
      supersedesPackageId: null,
      supersededByPackageId: null,
      withdrawnAt: null,
    });
    const validation = validateAuthoringPackage(next);
    if (!validation.validForDraftExport) throw new Error(validation.errors.join("; "));
    this.#packages = [...this.#packages, next];
    this.#selectedPackageId = next.packageId;
    this.#lastAction = "COMPLETE_SEMANTIC_DRAFT_CLONED";
    return this.view;
  }

  public editLocaleText(locale: Locale, field: AuthoringLocaleTextField, value: string): AuthoringPipelineView {
    if (value.trim().length === 0) throw new Error(`${field} cannot be empty`);
    let current = this.selectedPackage;
    if (current.lifecycle === "WITHDRAWN") throw new Error("withdrawn package cannot be edited");
    const copy = current.locales[locale];
    let nextCopy: AuthoringLocaleCopy;
    switch (field) {
      case "title": nextCopy = { ...copy, title: value }; break;
      case "targetWord": nextCopy = { ...copy, targetWord: value }; break;
      case "transferWord": nextCopy = { ...copy, transferWord: value }; break;
      case "instruction": nextCopy = { ...copy, instruction: value }; break;
      case "meaningPrompt": nextCopy = { ...copy, meaningPrompt: value }; break;
      case "transferPrompt": nextCopy = { ...copy, transferPrompt: value }; break;
      case "adultUnderstand": nextCopy = { ...copy, adultCard: { ...copy.adultCard, understand: value } }; break;
      case "adultDoOrSay": nextCopy = { ...copy, adultCard: { ...copy.adultCard, doOrSay: value } }; break;
      case "adultAvoid": nextCopy = { ...copy, adultCard: { ...copy.adultCard, avoid: value } }; break;
      case "adultDeepen": nextCopy = { ...copy, adultCard: { ...copy.adultCard, deepen: value } }; break;
      case "knowledgeTitle": nextCopy = { ...copy, knowledgeUnit: { ...copy.knowledgeUnit, title: value } }; break;
      case "knowledgeExplanation": nextCopy = { ...copy, knowledgeUnit: { ...copy.knowledgeUnit, explanation: value } }; break;
      case "contextCard": nextCopy = { ...copy, contextCard: { ...copy.contextCard, text: value } }; break;
    }
    current = this.#bump({
      ...current,
      locales: { ...current.locales, [locale]: nextCopy },
    });
    const families: readonly AudioScriptFamily[] = field === "transferWord" || field === "transferPrompt"
      ? ["TRANSFER_MODEL"]
      : field.startsWith("adult") || field.startsWith("knowledge") || field === "contextCard"
        ? ["ADULT_KNOWLEDGE"]
        : ["TARGET_MODEL"];
    this.#replace(this.#markAudioStale(current, locale, families));
    return this.view;
  }

  public editConstructAndStimulus(
    construct: DraftConstruct,
    target: string,
    transfer: string,
    transferClassification: DraftTransferClassification,
  ): AuthoringPipelineView {
    if (!target.trim() || !transfer.trim()) throw new Error("target and transfer are required");
    let next = this.#bump({
      ...this.selectedPackage,
      construct,
      stimulus: {
        target: { role: "TARGET", text: target },
        transfer: { role: "TRANSFER", text: transfer },
        transferClassification,
      },
    });
    for (const locale of ["nb-NO", "nn-NO"] as const) next = this.#markAudioStale(next, locale, ["TARGET_MODEL", "TRANSFER_MODEL"]);
    this.#replace(next);
    return this.view;
  }

  public editAudioScript(semanticAudioId: string, script: string): AuthoringPipelineView {
    if (!script.trim()) throw new Error("audio script cannot be empty");
    const current = this.selectedPackage;
    if (!current.audioSpecifications.some((item) => item.semanticAudioId === semanticAudioId)) throw new Error("unknown audio specification");
    this.#replace(this.#bump({
      ...current,
      audioSpecifications: current.audioSpecifications.map((spec) => spec.semanticAudioId === semanticAudioId
        ? { ...spec, script, scriptRevision: spec.scriptRevision + 1, scriptSha256: sha256Hex(script), stale: true, lifecycle: "STALE" as const }
        : spec),
    }));
    return this.view;
  }

  public addLocalReviewNote(note: LocalAuthoringReviewNote): AuthoringPipelineView {
    if (note.externalReceipt || note.receiptIntegrityVerified) throw new Error("local review cannot create an external receipt");
    if (this.selectedPackage.localReviewNotes.some((item) => item.reviewId === note.reviewId)) throw new Error("duplicate local review ID");
    this.#replace(this.#bump({
      ...this.selectedPackage,
      localReviewNotes: [...this.selectedPackage.localReviewNotes, deepClone(note)],
    }));
    this.#lastAction = "LOCAL_NON_RECEIPT_REVIEW_RECORDED";
    return this.view;
  }

  public validateSelected(): AuthoringPackageValidation {
    this.#lastAction = "PACKAGE_VALIDATED";
    return validateAuthoringPackage(this.selectedPackage);
  }

  public prepareExternalReviewHandoff(): AuthoringPipelineView {
    const validation = validateAuthoringPackage(this.selectedPackage);
    if (!validation.validForExternalReviewHandoff) throw new Error(validation.errors.join("; "));
    if (this.selectedPackage.localReviewNotes.length === 0) throw new Error("local review note is required before handoff");
    this.#replace({ ...this.selectedPackage, reviewStatus: "REVIEW_PENDING" });
    this.#lastAction = "REVIEW_PENDING_NOT_APPROVED";
    return this.view;
  }

  public exportSelectedJson(): string {
    const validation = validateAuthoringPackage(this.selectedPackage);
    if (!validation.validForDraftExport) throw new Error(validation.errors.join("; "));
    this.#lastAction = "DETERMINISTIC_DRAFT_EXPORTED";
    return deterministicAuthoringJson(this.selectedPackage);
  }

  public importJson(json: string): AuthoringPipelineView {
    this.#importError = undefined;
    try {
      const parsed: unknown = JSON.parse(json);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("authoring import must be an object");
      const candidate = parsed as AuthoringPackage;
      if (candidate.schemaVersion !== AUTHORING_SCHEMA_VERSION) throw new Error("unknown authoring schema");
      if (!this.#knownSourceActivityIds.has(candidate.sourceActivityId)) throw new Error("unknown source activity");
      if (!this.#knownPatternClassIds.has(candidate.patternClassId)) throw new Error("invalid pattern class");
      const knownChecksums = new Set([...this.#technicalTakes.values()].map((item) => item.assetSha256));
      for (const take of candidate.audioTakes) {
        const errors = validateAudioProductionCandidate(take, knownChecksums);
        if (errors.length > 0) throw new Error(errors.join("; "));
      }
      const validation = validateAuthoringPackage(candidate);
      if (!validation.validForDraftExport) throw new Error(validation.errors.join("; "));
      const duplicateActivity = this.#packages.find((item) => item.activityId === candidate.activityId && item.packageId !== candidate.packageId);
      if (duplicateActivity !== undefined) throw new Error("duplicate semantic activityId");
      const existing = this.#packages.some((item) => item.packageId === candidate.packageId);
      this.#packages = existing
        ? this.#packages.map((item) => item.packageId === candidate.packageId ? deepClone(candidate) : item)
        : [...this.#packages, deepClone(candidate)];
      this.#selectedPackageId = candidate.packageId;
      this.#lastAction = "VALIDATED_DRAFT_IMPORTED";
    } catch (error) {
      this.#importError = error instanceof Error ? error.message : String(error);
      this.#lastAction = "IMPORT_BLOCKED";
    }
    return this.view;
  }

  public replaceWithTechnicalTake(semanticAudioId: string, takeId: string): AuthoringPipelineView {
    const fixture = this.#technicalTakes.get(takeId);
    if (fixture === undefined) throw new Error("unknown technical audio asset");
    const current = this.selectedPackage;
    const spec = current.audioSpecifications.find((item) => item.semanticAudioId === semanticAudioId);
    if (spec === undefined) throw new Error("unknown audio specification");
    const take: AuthoringAudioTake = { ...fixture, semanticAudioId, scriptSha256: spec.scriptSha256 };
    const errors = validateAudioProductionCandidate(take, new Set([...this.#technicalTakes.values()].map((item) => item.assetSha256)));
    if (errors.length > 0) throw new Error(errors.join("; "));
    const previousTakeId = spec.activeTakeId;
    const withoutPriorSameId = current.audioTakes.filter((item) => item.takeId !== take.takeId);
    this.#replace(this.#bump({
      ...current,
      audioTakes: [...withoutPriorSameId, take],
      audioSpecifications: current.audioSpecifications.map((item): AuthoringAudioSpecification => item.semanticAudioId === semanticAudioId
        ? {
            ...item,
            takeRevision: item.takeRevision + 1,
            durationSeconds: take.durationSeconds,
            peakDbfs: take.peakDbfs,
            leadingSilenceMs: take.leadingSilenceMs,
            trailingSilenceMs: take.trailingSilenceMs,
            assetSha256: take.assetSha256,
            rightsScope: "INTERNAL_TECHNICAL_TRIAL_ONLY",
            voiceConsentStatus: "NOT_APPLICABLE_NOT_HUMAN_SPEECH",
            lifecycle: "CURRENT",
            stale: false,
            activeTakeId: take.takeId,
            replacementId: previousTakeId,
          }
        : item),
    }));
    this.#lastAction = previousTakeId === null ? "TECHNICAL_TAKE_ATTACHED" : "TECHNICAL_TAKE_REPLACED";
    return this.view;
  }

  public requestAudioPreview(semanticAudioId: string): AuthoringPipelineView {
    const spec = this.selectedPackage.audioSpecifications.find((item) => item.semanticAudioId === semanticAudioId);
    if (spec === undefined || spec.lifecycle !== "CURRENT" || spec.stale || spec.activeTakeId === null) {
      this.#audioPreviewState = "BLOCKED";
      this.#activePreviewAudioId = undefined;
      return this.view;
    }
    this.#audioPreviewState = "TECHNICAL_TRIAL_REQUESTED";
    this.#activePreviewAudioId = semanticAudioId;
    return this.view;
  }

  public stopAudio(): AuthoringPipelineView {
    this.#audioPreviewState = "STOPPED";
    this.#activePreviewAudioId = undefined;
    this.#lastAction = "STOP_DOMINATES_AUDIO";
    return this.view;
  }

  public withdrawSelected(timestamp: string): AuthoringPipelineView {
    this.stopAudio();
    this.#replace({
      ...this.selectedPackage,
      packageRevision: this.selectedPackage.packageRevision + 1,
      lifecycle: "WITHDRAWN",
      stale: false,
      withdrawnAt: timestamp,
      reviewStatus: "DRAFT",
      audioSpecifications: this.selectedPackage.audioSpecifications.map((item) => ({
        ...item,
        lifecycle: "WITHDRAWN" as const,
        stale: false,
        activeTakeId: null,
      })),
    });
    this.#lastAction = "PACKAGE_AND_AUDIO_WITHDRAWN";
    return this.view;
  }

  public applyRestrictivePolicy(policy: AuthoringLifecyclePolicy): AuthoringPipelineView {
    const errors = validateAuthoringLifecyclePolicy(policy);
    if (errors.length > 0) throw new Error(errors.join("; "));
    const merged = new Map<string, AuthoringLifecycleRestriction>();
    for (const restriction of [...this.#policy.restrictions, ...policy.restrictions]) {
      const key = `${restriction.scope}:${restriction.scopeId}`;
      const existing = merged.get(key);
      if (existing === undefined || LIFECYCLE_PRIORITY[restriction.lifecycleStatus] > LIFECYCLE_PRIORITY[existing.lifecycleStatus]) merged.set(key, restriction);
    }
    this.#policy = {
      policyRevision: Math.max(this.#policy.policyRevision, policy.policyRevision),
      restrictions: [...merged.values()],
      containsPersonData: false,
      resurrectionAllowed: false,
      publishingAuthority: false,
    };
    for (const restriction of this.#policy.restrictions) {
      if (restriction.scope === "AUTHORING_PACKAGE") {
        this.#packages = this.#packages.map((item) => item.packageId === restriction.scopeId
          ? {
              ...item,
              lifecycle: lifecycleFromRestriction(item.lifecycle, restriction.lifecycleStatus),
              stale: restriction.lifecycleStatus === "STALE",
              audioSpecifications: restriction.lifecycleStatus === "WITHDRAWN"
                ? item.audioSpecifications.map((audio) => ({ ...audio, lifecycle: "WITHDRAWN" as const, stale: false, activeTakeId: null }))
                : item.audioSpecifications,
            }
          : item);
      } else {
        this.#packages = this.#packages.map((item) => ({
          ...item,
          audioSpecifications: item.audioSpecifications.map((audio) => audio.semanticAudioId === restriction.scopeId
            ? {
                ...audio,
                lifecycle: lifecycleFromRestriction(audio.lifecycle, restriction.lifecycleStatus),
                stale: restriction.lifecycleStatus === "STALE",
                activeTakeId: restriction.lifecycleStatus === "WITHDRAWN" ? null : audio.activeTakeId,
              }
            : audio),
        }));
      }
    }
    if (this.selectedPackage.lifecycle === "WITHDRAWN") this.stopAudio();
    this.#lastAction = "RESTRICTIVE_POLICY_APPLIED_NO_RESURRECTION";
    return this.view;
  }

  public get policy(): AuthoringLifecyclePolicy {
    return deepClone(this.#policy);
  }

  public get view(): AuthoringPipelineView {
    const selected = this.selectedPackage;
    return {
      packages: this.#packages.map((item) => ({
        packageId: item.packageId,
        activityId: item.activityId,
        patternClassId: item.patternClassId,
        title: item.locales[this.#locale].title,
        reviewStatus: item.reviewStatus,
        lifecycle: item.lifecycle,
        selected: item.packageId === this.#selectedPackageId,
      })),
      selectedPackage: deepClone(selected),
      locale: this.#locale,
      validation: validateAuthoringPackage(selected),
      exportJson: deterministicAuthoringJson(selected),
      importError: this.#importError,
      lastAction: this.#lastAction,
      audioPreviewState: this.#audioPreviewState,
      activePreviewAudioId: this.#activePreviewAudioId,
      externalReceiptCount: 0,
      publishingAvailable: false,
      sessionMutationAvailable: false,
    };
  }
}
