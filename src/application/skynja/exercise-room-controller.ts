import type { Locale } from "../../core/content-contracts.js";
import { evaluateArrangement, evaluateEvidence, NOT_STATED, validateExerciseCatalog, type ExerciseDefinition, type ExerciseFeedback, type ExerciseKind, type ExerciseRound, type ExerciseVariant } from "../../core/skynja/exercise-room.js";

export type ExerciseStage = "CATALOG" | "INTRO" | "ACTIVE" | "PAUSED" | "COMPLETED" | "STOPPED";
export interface RoundRecord {
  readonly roundId: string;
  readonly outcome: "ANSWERED" | "MODEL_VIEWED" | "SKIPPED";
  readonly hintUsed: boolean;
  readonly modelUsed: boolean;
  readonly verdict: ExerciseFeedback["verdict"] | undefined;
}
export interface ExerciseRoomView {
  readonly catalog: readonly ExerciseDefinition[];
  readonly locale: Locale;
  readonly filter: ExerciseKind | "ALL";
  readonly stage: ExerciseStage;
  readonly exercise: ExerciseDefinition | undefined;
  readonly variant: ExerciseVariant | undefined;
  readonly round: ExerciseRound | undefined;
  readonly roundIndex: number;
  readonly selectedTiles: readonly string[];
  readonly selectedOption: string | undefined;
  readonly selectedEvidence: string | undefined;
  readonly feedback: ExerciseFeedback | undefined;
  readonly hintVisible: boolean;
  readonly modelVisible: boolean;
  readonly records: readonly RoundRecord[];
  readonly canCheck: boolean;
  readonly canContinue: boolean;
  readonly sessionOpen: boolean;
  readonly blockedIds: readonly string[];
}

export class ExerciseRoomController {
  private locale: Locale = "nb-NO";
  private filter: ExerciseKind | "ALL" = "ALL";
  private stage: ExerciseStage = "CATALOG";
  private selected: ExerciseDefinition | undefined;
  private roundIndex = 0;
  private selectedTiles: string[] = [];
  private selectedOption: string | undefined;
  private selectedEvidence: string | undefined;
  private feedback: ExerciseFeedback | undefined;
  private hintVisible = false;
  private modelVisible = false;
  private records: RoundRecord[] = [];
  private readonly blockedIds = new Set<string>();

  constructor(private readonly catalog: readonly ExerciseDefinition[]) {
    const errors = validateExerciseCatalog(catalog);
    if (errors.length) throw new Error(errors.join("\n"));
  }

  get view(): ExerciseRoomView {
    const variant = this.selected?.locales[this.locale];
    const round = variant?.rounds[this.roundIndex];
    return { catalog: this.catalog, locale: this.locale, filter: this.filter, stage: this.stage,
      exercise: this.selected, variant, round, roundIndex: this.roundIndex,
      selectedTiles: [...this.selectedTiles], selectedOption: this.selectedOption, selectedEvidence: this.selectedEvidence, feedback: this.feedback,
      hintVisible: this.hintVisible, modelVisible: this.modelVisible, records: this.records.map((record) => ({ ...record })),
      canCheck: this.stage === "ACTIVE" && (round?.type === "ARRANGE" ? this.selectedTiles.length === round.tiles.length : this.selectedOption !== undefined && (round?.type !== "EVIDENCE" || this.selectedEvidence !== undefined)),
      canContinue: this.stage === "ACTIVE" && (this.modelVisible || (this.feedback !== undefined && this.feedback.verdict !== "TRY_AGAIN")),
      sessionOpen: this.stage === "ACTIVE" || this.stage === "PAUSED", blockedIds: [...this.blockedIds] };
  }

  setLocale(locale: Locale): void {
    if (this.view.sessionOpen || !["nb-NO", "nn-NO"].includes(locale)) return;
    this.locale = locale;
  }
  setFilter(filter: ExerciseKind | "ALL"): void {
    if (this.stage === "CATALOG") this.filter = filter;
  }
  select(id: string): void {
    if (this.view.sessionOpen || this.blockedIds.has(id)) return;
    const selected = this.catalog.find((exercise) => exercise.id === id);
    if (selected === undefined) return;
    this.clearAttempt(); this.selected = selected; this.stage = "INTRO";
  }
  start(): void {
    if (this.stage !== "INTRO" || this.selected === undefined || this.blockedIds.has(this.selected.id)) return;
    this.clearAttempt(); this.stage = "ACTIVE";
  }
  backToCatalog(): void {
    if (this.view.sessionOpen) return;
    this.clearAttempt(); this.selected = undefined; this.stage = "CATALOG";
  }
  tile(id: string): void {
    const round = this.view.round;
    if (this.stage !== "ACTIVE" || round?.type !== "ARRANGE" || !round.tiles.some((t) => t.id === id)) return;
    this.selectedTiles = this.selectedTiles.includes(id) ? this.selectedTiles.filter((item) => item !== id) : [...this.selectedTiles, id];
    this.feedback = undefined;
  }
  clearTiles(): void {
    if (this.stage !== "ACTIVE") return;
    this.selectedTiles = []; this.feedback = undefined;
  }
  option(id: string): void {
    const round = this.view.round;
    if (this.stage !== "ACTIVE" || round === undefined || round.type === "ARRANGE" || !round.options.some((o) => o.id === id)) return;
    this.selectedOption = id; this.feedback = undefined;
  }
  evidence(id: string): void {
    const round = this.view.round;
    if (this.stage !== "ACTIVE" || round?.type !== "EVIDENCE"
      || (id !== NOT_STATED && !round.passages.some((passage) => passage.id === id))) return;
    this.selectedEvidence = id; this.feedback = undefined;
  }
  check(): void {
    const view = this.view;
    if (!view.canCheck || view.round === undefined) return;
    if (view.round.type === "ARRANGE") this.feedback = evaluateArrangement(view.round, this.selectedTiles);
    else if (view.round.type === "EVIDENCE") this.feedback = evaluateEvidence(view.round, this.selectedOption!, this.selectedEvidence!);
    else {
      const option = view.round.options.find((o) => o.id === this.selectedOption);
      if (option !== undefined) this.feedback = { verdict: option.verdict, text: option.feedback };
    }
  }
  hint(): void { if (this.stage === "ACTIVE") this.hintVisible = true; }
  model(): void { if (this.stage === "ACTIVE") this.modelVisible = true; }
  pause(): void { if (this.stage === "ACTIVE") this.stage = "PAUSED"; }
  resume(): void { if (this.stage === "PAUSED") this.stage = "ACTIVE"; }
  stop(): void { this.clearAttempt(); this.stage = "STOPPED"; }
  restrict(exerciseOrSourceIds: readonly string[]): void {
    for (const exercise of this.catalog) {
      if (exerciseOrSourceIds.includes(exercise.id) || (exercise.sourceActivityId !== undefined && exerciseOrSourceIds.includes(exercise.sourceActivityId))) this.blockedIds.add(exercise.id);
    }
    if (this.selected !== undefined && this.blockedIds.has(this.selected.id) && this.stage !== "STOPPED") this.stop();
  }
  next(skip = false): void {
    const view = this.view;
    if (this.stage !== "ACTIVE" || view.round === undefined || (!skip && !view.canContinue)) return;
    this.records.push({ roundId: view.round.id, outcome: skip ? "SKIPPED" : this.feedback !== undefined && this.feedback.verdict !== "TRY_AGAIN" ? "ANSWERED" : "MODEL_VIEWED",
      hintUsed: this.hintVisible, modelUsed: this.modelVisible, verdict: skip ? undefined : this.feedback?.verdict });
    this.clearRound(); this.roundIndex += 1;
    if (this.roundIndex === view.variant?.rounds.length) this.stage = "COMPLETED";
  }
  private clearRound(): void {
    this.selectedTiles = []; this.selectedOption = undefined; this.selectedEvidence = undefined; this.feedback = undefined;
    this.hintVisible = false; this.modelVisible = false;
  }
  private clearAttempt(): void { this.clearRound(); this.roundIndex = 0; this.records = []; }
}
