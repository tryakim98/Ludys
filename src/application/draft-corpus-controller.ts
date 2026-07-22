import type { Locale } from "../core/content-contracts.js";
import {
  effectiveActivityLifecycle,
  getDraftActivity,
  getDraftActivityVariant,
  validateCorpusLifecyclePolicy,
  type CorpusLifecyclePolicy,
  type CorpusLifecycleRestriction,
  type DraftActivityVariant,
  type DraftAttemptEvent,
  type DraftCorpusMode,
  type DraftLearningCorpusRelease,
  type DraftLifecycleStatus,
  type DraftSupportLevel,
} from "../core/draft-learning-corpus.js";
import type { WordProofDefinition } from "../core/word-proof.js";

export type DraftCorpusRunStage =
  | "NOT_STARTED"
  | "TARGET"
  | "TRANSFER"
  | "COMPLETED"
  | "STOPPED"
  | "BLOCKED";

export interface DraftPatternClassProjection {
  readonly patternClassId: string;
  readonly title: string;
  readonly status: "DRAFT";
  readonly reviewStatus: "EXTERNAL_REVIEW_REQUIRED";
  readonly lifecycleStatus: DraftLifecycleStatus;
  readonly selected: boolean;
  readonly safetySummary: string;
  readonly cannotProve: string;
}

export interface DraftActivityProjection {
  readonly activityId: string;
  readonly patternClassId: string;
  readonly title: string;
  readonly target: string;
  readonly transfer: string;
  readonly internalReviewDecision: DraftActivityVariant["internalReviewDecision"];
  readonly transferClassification: DraftActivityVariant["transferClassification"];
  readonly lifecycleStatus: DraftLifecycleStatus;
  readonly status: "DRAFT";
  readonly reviewStatus: "EXTERNAL_REVIEW_REQUIRED";
  readonly visible: boolean;
  readonly selectable: boolean;
  readonly selected: boolean;
}

export interface DraftCorpusView {
  readonly releaseId: string;
  readonly locale: Locale;
  readonly mode: DraftCorpusMode;
  readonly status: "DRAFT";
  readonly reviewStatus: "EXTERNAL_REVIEW_REQUIRED";
  readonly evidenceStatus: "SYNTHETIC_ONLY";
  readonly betaStatus: "NOT_STUDENT_BETA";
  readonly patternClasses: readonly DraftPatternClassProjection[];
  readonly activities: readonly DraftActivityProjection[];
  readonly selectedPatternClassId: string;
  readonly selectedActivityId: string | undefined;
  readonly canStartSelected: boolean;
  readonly runStage: DraftCorpusRunStage;
  readonly attempts: readonly DraftAttemptEvent[];
  readonly audioState: "SILENT" | "SPEC_REQUESTED" | "STOPPED";
  readonly pendingFeedback: boolean;
  readonly lastBlockReason: string | undefined;
  readonly automaticPlacement: false;
  readonly aggregateScore: undefined;
  readonly adultDecisionRequired: true;
}

const EMPTY_POLICY: CorpusLifecyclePolicy = {
  policyRevision: 1,
  restrictions: [],
  containsPersonData: false,
  resurrectionAllowed: false,
};

const RESTRICTION_PRIORITY: Readonly<Record<CorpusLifecycleRestriction["lifecycleStatus"], number>> = {
  STALE: 1,
  SUPERSEDED: 2,
  WITHDRAWN: 3,
};

function splitGraphemes(word: string): readonly string[] {
  if (word.endsWith("ng")) return [...word.slice(0, -2), "ng"];
  return [...word];
}

function task(
  variant: DraftActivityVariant,
  role: "TARGET" | "NEAR_TRANSFER",
): WordProofDefinition["target"] {
  const stimulus = role === "TARGET" ? variant.targetStimulus.text : variant.transferStimulus.text;
  const graphemes = splitGraphemes(stimulus);
  const taskRole = role === "TARGET" ? "target" : "transfer";
  return {
    taskId: `${variant.activityId}-${taskRole}`,
    role,
    word: stimulus,
    phonemeSequence: graphemes.map((grapheme) => `/${grapheme}/`),
    orderedGraphemes: graphemes,
    tiles: graphemes.map((grapheme, index) => ({
      tileId: `${variant.activityId}-${taskRole}-${String(index + 1)}-${grapheme}`,
      grapheme,
    })),
    meaningPrompt: role === "TARGET"
      ? variant.feedbackByState.targetReady
      : variant.feedbackByState.transferReady,
    audioSpecId: role === "TARGET" ? variant.audioSpecIds[0] : variant.audioSpecIds[1],
  };
}

export class DraftCorpusController {
  readonly #release: DraftLearningCorpusRelease;
  #locale: Locale;
  #mode: DraftCorpusMode = "NORMAL_SYNTHETIC";
  #selectedPatternClassId: string;
  #selectedActivityId: string | undefined;
  #policy: CorpusLifecyclePolicy = EMPTY_POLICY;
  #runStage: DraftCorpusRunStage = "NOT_STARTED";
  #attempts: DraftAttemptEvent[] = [];
  #audioState: DraftCorpusView["audioState"] = "SILENT";
  #pendingFeedback = false;
  #lastBlockReason: string | undefined;

  public constructor(release: DraftLearningCorpusRelease, locale: Locale) {
    this.#release = release;
    this.#locale = locale;
    const firstClass = release.patternClasses[0];
    if (firstClass === undefined) throw new Error("draft corpus requires at least one pattern class");
    this.#selectedPatternClassId = firstClass.patternClassId;
    this.#selectedActivityId = this.#firstSelectableActivity(firstClass.patternClassId);
  }

  public get release(): DraftLearningCorpusRelease {
    return this.#release;
  }

  public get selectedVariant(): DraftActivityVariant | undefined {
    return this.#selectedActivityId === undefined
      ? undefined
      : getDraftActivityVariant(this.#release, this.#selectedActivityId, this.#locale);
  }

  public get selectedKnowledge() {
    const variant = this.selectedVariant;
    return variant === undefined
      ? undefined
      : this.#release.knowledge.find(
          (item) => item.knowledgeId === variant.knowledgeId && item.locale === this.#locale,
        );
  }

  public get selectedContextCard() {
    const variant = this.selectedVariant;
    return variant === undefined
      ? undefined
      : this.#release.contextCards.find(
          (item) => item.contextCardId === variant.contextCardId && item.locale === this.#locale,
        );
  }

  #activitySelectable(activityId: string): boolean {
    const variant = getDraftActivityVariant(this.#release, activityId, this.#locale);
    if (variant === undefined) return false;
    if (effectiveActivityLifecycle(this.#release, this.#policy, activityId) !== "CURRENT") return false;
    return this.#mode === "REVIEW" || variant.internalReviewDecision !== "CHANGES_REQUIRED";
  }

  #firstSelectableActivity(patternClassId: string): string | undefined {
    return this.#release.activities.find(
      (activity) => activity.patternClassId === patternClassId && this.#activitySelectable(activity.activityId),
    )?.activityId;
  }

  #resetRun(): void {
    this.#runStage = "NOT_STARTED";
    this.#attempts = [];
    this.#audioState = "SILENT";
    this.#pendingFeedback = false;
  }

  #canConfigureSelection(): boolean {
    return this.#runStage === "NOT_STARTED" || this.#runStage === "BLOCKED";
  }

  public setLocale(locale: Locale): DraftCorpusView {
    this.#locale = locale;
    this.#resetRun();
    if (this.#selectedActivityId === undefined || !this.#activitySelectable(this.#selectedActivityId)) {
      this.#selectedActivityId = this.#firstSelectableActivity(this.#selectedPatternClassId);
    }
    this.#lastBlockReason = undefined;
    return this.view;
  }

  public setMode(mode: DraftCorpusMode): DraftCorpusView {
    if (!this.#canConfigureSelection()) {
      this.#lastBlockReason = "MODE_CHANGE_REQUIRES_NOT_STARTED";
      return this.view;
    }
    this.#mode = mode;
    if (this.#selectedActivityId === undefined || !this.#activitySelectable(this.#selectedActivityId)) {
      this.#selectedActivityId = this.#firstSelectableActivity(this.#selectedPatternClassId);
    }
    this.#lastBlockReason = undefined;
    return this.view;
  }

  public selectPatternClass(patternClassId: string): DraftCorpusView {
    if (!this.#canConfigureSelection()) {
      this.#lastBlockReason = "CLASS_CHANGE_REQUIRES_NOT_STARTED";
      return this.view;
    }
    if (!this.#release.patternClasses.some((item) => item.patternClassId === patternClassId)) {
      this.#lastBlockReason = "UNKNOWN_PATTERN_CLASS";
      return this.view;
    }
    this.#selectedPatternClassId = patternClassId;
    this.#selectedActivityId = this.#firstSelectableActivity(patternClassId);
    this.#resetRun();
    this.#lastBlockReason = this.#selectedActivityId === undefined ? "NO_SELECTABLE_ACTIVITY" : undefined;
    return this.view;
  }

  public selectActivity(activityId: string): DraftCorpusView {
    if (!this.#canConfigureSelection()) {
      this.#lastBlockReason = "ACTIVITY_CHANGE_REQUIRES_NOT_STARTED";
      return this.view;
    }
    const activity = getDraftActivity(this.#release, activityId);
    if (activity === undefined) {
      this.#lastBlockReason = "UNKNOWN_ACTIVITY";
      return this.view;
    }
    if (!this.#activitySelectable(activityId)) {
      const lifecycle = effectiveActivityLifecycle(this.#release, this.#policy, activityId);
      this.#lastBlockReason = lifecycle === "CURRENT"
        ? "CHANGES_REQUIRED_BLOCKED_IN_NORMAL_MODE"
        : `CONTENT_${lifecycle}`;
      return this.view;
    }
    this.#selectedPatternClassId = activity.patternClassId;
    this.#selectedActivityId = activityId;
    this.#resetRun();
    this.#lastBlockReason = undefined;
    return this.view;
  }

  public createWordProofDefinition(): WordProofDefinition {
    const variant = this.selectedVariant;
    if (variant === undefined) throw new Error("no selected draft activity");
    return {
      activityId: variant.activityId,
      revision: variant.revision,
      locale: variant.locale,
      ageBand: "6-9",
      patternClassId: variant.patternClassId,
      patternDescription: `${variant.construct}; ${variant.transferClassification}`,
      target: task(variant, "TARGET"),
      transfer: task(variant, "NEAR_TRANSFER"),
      audioSpecifications: this.#release.audioSpecifications.filter(
        (audio) => variant.audioSpecIds.includes(audio.audioSpecId),
      ),
    };
  }

  public startSelectedActivity(): DraftCorpusView {
    if (this.#selectedActivityId === undefined || !this.#activitySelectable(this.#selectedActivityId)) {
      this.#runStage = "BLOCKED";
      this.#lastBlockReason = "SELECTED_ACTIVITY_NOT_RUNNABLE";
      return this.view;
    }
    this.#runStage = "TARGET";
    this.#attempts = [{
      sequence: 1,
      kind: "TARGET",
      evidence: "INDEPENDENT",
      supportLevel: "NONE",
      sessionBound: true,
    }];
    this.#pendingFeedback = true;
    this.#lastBlockReason = undefined;
    return this.view;
  }

  public recordSupport(level: Exclude<DraftSupportLevel, "NONE">): DraftCorpusView {
    if (this.#runStage !== "TARGET") return this.view;
    if (level === "MODEL_REQUIRES_ADULT") {
      this.#attempts.push({
        sequence: this.#attempts.length + 1,
        kind: "SUPPORTED_RETRY",
        evidence: "MODELLED_PRACTICE",
        supportLevel: level,
        sessionBound: true,
      });
    }
    this.#attempts.push({
      sequence: this.#attempts.length + 1,
      kind: "SUPPORTED_RETRY",
      evidence: "SUPPORTED_RETRY",
      supportLevel: level,
      sessionBound: true,
    });
    this.#pendingFeedback = true;
    return this.view;
  }

  public completeTarget(): DraftCorpusView {
    if (this.#runStage !== "TARGET") return this.view;
    this.#runStage = "TRANSFER";
    this.#attempts.push({
      sequence: this.#attempts.length + 1,
      kind: "TRANSFER",
      evidence: "TRANSFER_SEPARATE",
      supportLevel: "NONE",
      sessionBound: true,
    });
    this.#pendingFeedback = true;
    return this.view;
  }

  public completeTransfer(): DraftCorpusView {
    if (this.#runStage === "TRANSFER") {
      this.#runStage = "COMPLETED";
      this.#pendingFeedback = false;
    }
    return this.view;
  }

  public requestAudioSpecification(): DraftCorpusView {
    if (["TARGET", "TRANSFER"].includes(this.#runStage)) this.#audioState = "SPEC_REQUESTED";
    return this.view;
  }

  public interruptForPause(): DraftCorpusView {
    this.#audioState = "STOPPED";
    this.#pendingFeedback = false;
    return this.view;
  }

  public stop(): DraftCorpusView {
    this.#runStage = "STOPPED";
    this.#audioState = "STOPPED";
    this.#pendingFeedback = false;
    return this.view;
  }

  public resetForNewSession(): DraftCorpusView {
    this.#resetRun();
    this.#lastBlockReason = undefined;
    return this.view;
  }

  public applyRestrictivePolicy(policy: CorpusLifecyclePolicy): DraftCorpusView {
    const errors = validateCorpusLifecyclePolicy(this.#release, policy);
    if (errors.length > 0) throw new Error(errors.join("; "));
    const merged = new Map<string, CorpusLifecycleRestriction>();
    for (const restriction of [...this.#policy.restrictions, ...policy.restrictions]) {
      const key = `${restriction.scope}:${restriction.scopeId}`;
      const existing = merged.get(key);
      if (
        existing === undefined
        || RESTRICTION_PRIORITY[restriction.lifecycleStatus]
          > RESTRICTION_PRIORITY[existing.lifecycleStatus]
      ) {
        merged.set(key, restriction);
      }
    }
    this.#policy = {
      policyRevision: Math.max(this.#policy.policyRevision, policy.policyRevision),
      restrictions: [...merged.values()],
      containsPersonData: false,
      resurrectionAllowed: false,
    };
    if (this.#selectedActivityId !== undefined && !this.#activitySelectable(this.#selectedActivityId)) {
      this.#runStage = "BLOCKED";
      this.#audioState = "STOPPED";
      this.#pendingFeedback = false;
      this.#lastBlockReason = `CONTENT_${effectiveActivityLifecycle(
        this.#release,
        this.#policy,
        this.#selectedActivityId,
      )}`;
    }
    return this.view;
  }

  public get policy(): CorpusLifecyclePolicy {
    return this.#policy;
  }

  public get view(): DraftCorpusView {
    const selectedActivityId = this.#selectedActivityId;
    return {
      releaseId: this.#release.releaseId,
      locale: this.#locale,
      mode: this.#mode,
      status: this.#release.status,
      reviewStatus: this.#release.reviewStatus,
      evidenceStatus: this.#release.evidenceStatus,
      betaStatus: this.#release.betaStatus,
      patternClasses: this.#release.patternClasses.map((patternClass) => {
        const localized = patternClass.locales[this.#locale];
        const classRestriction = this.#policy.restrictions.find(
          (item) => item.scope === "PATTERN_CLASS" && item.scopeId === patternClass.patternClassId,
        );
        const lifecycleStatus = classRestriction?.lifecycleStatus ?? patternClass.lifecycleStatus;
        return {
          patternClassId: patternClass.patternClassId,
          title: localized.title,
          status: patternClass.status,
          reviewStatus: patternClass.reviewStatus,
          lifecycleStatus,
          selected: patternClass.patternClassId === this.#selectedPatternClassId,
          safetySummary: localized.investigates,
          cannotProve: localized.cannotProve,
        };
      }),
      activities: this.#release.activities.map((activity) => {
        const localized = activity.variants[this.#locale];
        const lifecycleStatus = effectiveActivityLifecycle(this.#release, this.#policy, activity.activityId);
        const visible = this.#mode === "REVIEW" || localized.internalReviewDecision !== "CHANGES_REQUIRED";
        return {
          activityId: activity.activityId,
          patternClassId: activity.patternClassId,
          title: localized.title,
          target: localized.targetStimulus.text,
          transfer: localized.transferStimulus.text,
          internalReviewDecision: localized.internalReviewDecision,
          transferClassification: localized.transferClassification,
          lifecycleStatus,
          status: localized.status,
          reviewStatus: localized.reviewStatus,
          visible,
          selectable: visible && lifecycleStatus === "CURRENT",
          selected: activity.activityId === selectedActivityId,
        };
      }),
      selectedPatternClassId: this.#selectedPatternClassId,
      selectedActivityId,
      canStartSelected: selectedActivityId !== undefined && this.#activitySelectable(selectedActivityId),
      runStage: this.#runStage,
      attempts: this.#attempts,
      audioState: this.#audioState,
      pendingFeedback: this.#pendingFeedback,
      lastBlockReason: this.#lastBlockReason,
      automaticPlacement: false,
      aggregateScore: undefined,
      adultDecisionRequired: true,
    };
  }
}
