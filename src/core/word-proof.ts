import type { EvidenceStatus } from "./evidence.js";
import { validateAudio, type AudioSpecification, type Locale } from "./content-contracts.js";

export const NORWEGIAN_PATTERN_CLASS_ID = "NOR-SIMPLE-BLEND-23" as const;

export interface GraphemeTile {
  readonly tileId: string;
  readonly grapheme: string;
}

export interface WordProofTask {
  readonly taskId: string;
  readonly role: "TARGET" | "NEAR_TRANSFER";
  readonly word: string;
  readonly phonemeSequence: readonly string[];
  readonly orderedGraphemes: readonly string[];
  readonly tiles: readonly GraphemeTile[];
  readonly meaningPrompt: string;
  readonly audioSpecId: string;
}

export interface WordProofDefinition {
  readonly activityId: string;
  readonly revision: number;
  readonly locale: Locale;
  readonly ageBand: "6-9";
  readonly patternClassId: typeof NORWEGIAN_PATTERN_CLASS_ID;
  readonly patternDescription: string;
  readonly target: WordProofTask;
  readonly transfer: WordProofTask;
  readonly audioSpecifications: readonly AudioSpecification[];
}

export type WordProofStage =
  | "TARGET_BUILD"
  | "TARGET_READ_CONFIRMATION"
  | "TRANSFER_BUILD"
  | "TRANSFER_READ_CONFIRMATION"
  | "COMPLETED"
  | "STOPPED";

export type WordProofFeedbackCode =
  | "READY"
  | "TILE_SELECTED"
  | "TRY_AGAIN"
  | "WORD_BUILT_READ_TO_ADULT"
  | "TARGET_CONFIRMED"
  | "TRANSFER_CONFIRMED"
  | "QUIET"
  | "PAUSED"
  | "STOPPED";

export interface WordProofState {
  readonly activityId: string;
  readonly stage: WordProofStage;
  readonly selectedTileIds: readonly string[];
  readonly selectedGraphemes: readonly string[];
  readonly modelVisible: boolean;
  readonly feedbackCode: WordProofFeedbackCode;
  readonly targetEvidence: EvidenceStatus | undefined;
  readonly transferEvidence: EvidenceStatus | undefined;
  readonly supportCountAtTaskStart: number;
  readonly attemptNumber: number;
}

export type WordProofCommand =
  | { readonly kind: "SELECT_TILE"; readonly tileId: string }
  | { readonly kind: "REMOVE_LAST_TILE" }
  | { readonly kind: "CLEAR_TILES" }
  | { readonly kind: "SUBMIT_BUILD" }
  | { readonly kind: "REVEAL_MODEL" }
  | {
      readonly kind: "ADULT_CONFIRM_READING";
      readonly currentSupportCount: number;
    }
  | { readonly kind: "SET_QUIET" }
  | { readonly kind: "SET_PAUSED" }
  | { readonly kind: "STOP" };

export interface WordProofTransitionResult {
  readonly state: WordProofState;
  readonly accepted: boolean;
  readonly reason?: string;
}

export function createWordProofState(
  definition: WordProofDefinition,
  supportCount: number,
): WordProofState {
  return {
    activityId: definition.activityId,
    stage: "TARGET_BUILD",
    selectedTileIds: [],
    selectedGraphemes: [],
    modelVisible: false,
    feedbackCode: "READY",
    targetEvidence: undefined,
    transferEvidence: undefined,
    supportCountAtTaskStart: supportCount,
    attemptNumber: 1,
  };
}

export function currentTask(
  state: WordProofState,
  definition: WordProofDefinition,
): WordProofTask | undefined {
  switch (state.stage) {
    case "TARGET_BUILD":
    case "TARGET_READ_CONFIRMATION":
      return definition.target;
    case "TRANSFER_BUILD":
    case "TRANSFER_READ_CONFIRMATION":
      return definition.transfer;
    case "COMPLETED":
    case "STOPPED":
      return undefined;
  }
}

function accepted(state: WordProofState): WordProofTransitionResult {
  return { state, accepted: true };
}

function rejected(
  state: WordProofState,
  reason: string,
): WordProofTransitionResult {
  return { state, accepted: false, reason };
}

function isBuildStage(stage: WordProofStage): boolean {
  return stage === "TARGET_BUILD" || stage === "TRANSFER_BUILD";
}

function isReadConfirmationStage(stage: WordProofStage): boolean {
  return (
    stage === "TARGET_READ_CONFIRMATION" ||
    stage === "TRANSFER_READ_CONFIRMATION"
  );
}

export function transitionWordProof(
  state: WordProofState,
  definition: WordProofDefinition,
  command: WordProofCommand,
): WordProofTransitionResult {
  if (state.stage === "STOPPED" && command.kind !== "STOP") {
    return rejected(state, "stopped activity rejects commands");
  }
  if (state.stage === "COMPLETED" && command.kind !== "STOP") {
    return rejected(state, "completed activity rejects commands");
  }

  const task = currentTask(state, definition);

  switch (command.kind) {
    case "SELECT_TILE": {
      if (!isBuildStage(state.stage) || task === undefined) {
        return rejected(state, "tile selection requires build stage");
      }
      if (state.selectedTileIds.includes(command.tileId)) {
        return rejected(state, "tile already selected");
      }
      const tile = task.tiles.find((candidate) => candidate.tileId === command.tileId);
      if (tile === undefined) {
        return rejected(state, "unknown tile");
      }
      if (state.selectedTileIds.length >= task.orderedGraphemes.length) {
        return rejected(state, "word already has required length");
      }
      return accepted({
        ...state,
        selectedTileIds: [...state.selectedTileIds, tile.tileId],
        selectedGraphemes: [...state.selectedGraphemes, tile.grapheme],
        feedbackCode: "TILE_SELECTED",
      });
    }

    case "REMOVE_LAST_TILE":
      if (!isBuildStage(state.stage) || state.selectedTileIds.length === 0) {
        return rejected(state, "no selected tile to remove");
      }
      return accepted({
        ...state,
        selectedTileIds: state.selectedTileIds.slice(0, -1),
        selectedGraphemes: state.selectedGraphemes.slice(0, -1),
        feedbackCode: "READY",
      });

    case "CLEAR_TILES":
      if (!isBuildStage(state.stage)) {
        return rejected(state, "clear requires build stage");
      }
      return accepted({
        ...state,
        selectedTileIds: [],
        selectedGraphemes: [],
        feedbackCode: "READY",
      });

    case "SUBMIT_BUILD": {
      if (!isBuildStage(state.stage) || task === undefined) {
        return rejected(state, "submit requires build stage");
      }
      if (state.selectedGraphemes.length !== task.orderedGraphemes.length) {
        return rejected(state, "word is incomplete");
      }
      const built = state.selectedGraphemes.join("");
      if (built !== task.word) {
        return accepted({
          ...state,
          selectedTileIds: [],
          selectedGraphemes: [],
          modelVisible: false,
          feedbackCode: "TRY_AGAIN",
          attemptNumber: state.attemptNumber + 1,
        });
      }
      return accepted({
        ...state,
        stage:
          state.stage === "TARGET_BUILD"
            ? "TARGET_READ_CONFIRMATION"
            : "TRANSFER_READ_CONFIRMATION",
        feedbackCode: "WORD_BUILT_READ_TO_ADULT",
      });
    }

    case "REVEAL_MODEL":
      if (!isBuildStage(state.stage) || task === undefined) {
        return rejected(state, "model requires build stage");
      }
      return accepted({
        ...state,
        modelVisible: true,
      });

    case "ADULT_CONFIRM_READING": {
      if (!isReadConfirmationStage(state.stage)) {
        return rejected(state, "confirmation requires read-confirmation stage");
      }
      const supported =
        command.currentSupportCount > state.supportCountAtTaskStart;
      if (state.stage === "TARGET_READ_CONFIRMATION") {
        return accepted({
          ...state,
          stage: "TRANSFER_BUILD",
          selectedTileIds: [],
          selectedGraphemes: [],
          modelVisible: false,
          feedbackCode: "TARGET_CONFIRMED",
          targetEvidence: supported ? "SUPPORTED_RETRY" : "INDEPENDENT",
          supportCountAtTaskStart: command.currentSupportCount,
          attemptNumber: 1,
        });
      }
      return accepted({
        ...state,
        stage: "COMPLETED",
        feedbackCode: "TRANSFER_CONFIRMED",
        transferEvidence: supported ? "SUPPORTED_RETRY" : "NEAR_TRANSFER",
      });
    }

    case "SET_QUIET":
      return accepted({ ...state, feedbackCode: "QUIET" });

    case "SET_PAUSED":
      return accepted({ ...state, feedbackCode: "PAUSED" });

    case "STOP":
      return accepted({
        ...state,
        stage: "STOPPED",
        selectedTileIds: [],
        selectedGraphemes: [],
        modelVisible: false,
        feedbackCode: "STOPPED",
      });
  }
}


export function validateWordProofDefinition(
  definition: WordProofDefinition,
): string[] {
  const errors: string[] = [];
  if (definition.target.word === definition.transfer.word) {
    errors.push("target and transfer word must differ");
  }
  for (const task of [definition.target, definition.transfer]) {
    if (task.orderedGraphemes.length < 2 || task.orderedGraphemes.length > 3) {
      errors.push(`${task.taskId}: proof requires two or three graphemes`);
    }
    if (task.phonemeSequence.length !== task.orderedGraphemes.length) {
      errors.push(`${task.taskId}: phoneme and grapheme counts differ`);
    }
    if (task.orderedGraphemes.join("") !== task.word) {
      errors.push(`${task.taskId}: ordered graphemes do not build the word`);
    }
    if (task.orderedGraphemes.some((grapheme) => [...grapheme].length !== 1)) {
      errors.push(`${task.taskId}: first proof excludes complex graphemes`);
    }
    const tileGraphemes = task.tiles.map((tile) => tile.grapheme).sort().join("");
    const expected = [...task.orderedGraphemes].sort().join("");
    if (tileGraphemes !== expected || new Set(task.tiles.map((tile) => tile.tileId)).size !== task.tiles.length) {
      errors.push(`${task.taskId}: tiles are not a unique permutation of graphemes`);
    }
    const audio = definition.audioSpecifications.find(
      (candidate) => candidate.audioSpecId === task.audioSpecId,
    );
    if (audio === undefined) {
      errors.push(`${task.taskId}: audioSpecId is not reference-closed`);
    } else {
      errors.push(...validateAudio(audio).map((error) => `${task.taskId}: ${error}`));
      if (audio.locale !== definition.locale) errors.push(`${task.taskId}: audio locale mismatch`);
      if (audio.audioRole !== "MODEL" || audio.constructSensitivity !== "HIGH") {
        errors.push(`${task.taskId}: word model audio must be construct-sensitive MODEL`);
      }
    }
  }
  if (new Set(definition.audioSpecifications.map((audio) => audio.audioSpecId)).size !== definition.audioSpecifications.length) {
    errors.push("audioSpecIds must be unique");
  }
  return errors;
}
