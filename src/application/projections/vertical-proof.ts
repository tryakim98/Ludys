import type { EvidenceStatus } from "../../core/evidence.js";
import { currentTask } from "../../core/word-proof.js";
import type { VerticalProofSnapshot } from "../vertical-proof-controller.js";

export interface VerticalChildProjection {
  readonly locale: "nb-NO" | "nn-NO";
  readonly stage: VerticalProofSnapshot["proof"]["stage"];
  readonly phase: VerticalProofSnapshot["session"]["phase"];
  readonly phonemeSequence: readonly string[];
  readonly availableTiles: readonly { readonly tileId: string; readonly grapheme: string }[];
  readonly selectedGraphemes: readonly string[];
  readonly meaningPrompt: string;
  readonly modelWord: string | undefined;
  readonly feedbackCode: VerticalProofSnapshot["proof"]["feedbackCode"];
  readonly canBuild: boolean;
  readonly canRequestHelp: boolean;
  readonly canRequestQuiet: boolean;
  readonly canPause: boolean;
  readonly canResume: boolean;
  readonly canStop: boolean;
  readonly canPlayAudio: boolean;
  readonly quietMode: boolean;
  readonly targetEvidence: EvidenceStatus | undefined;
  readonly transferEvidence: EvidenceStatus | undefined;
}

export interface VerticalAdultProjection {
  readonly locale: "nb-NO" | "nn-NO";
  readonly stage: VerticalProofSnapshot["proof"]["stage"];
  readonly phase: VerticalProofSnapshot["session"]["phase"];
  readonly builtWord: string;
  readonly currentCard: VerticalProofSnapshot["session"]["activeCard"];
  readonly waitAllowed: boolean;
  readonly canModel: boolean;
  readonly canConfirmReading: boolean;
  readonly canStop: boolean;
  readonly targetEvidence: EvidenceStatus | undefined;
  readonly transferEvidence: EvidenceStatus | undefined;
  readonly contextCorrections: VerticalProofSnapshot["session"]["contextCorrections"];
}

export function projectVerticalChild(
  snapshot: VerticalProofSnapshot,
): VerticalChildProjection {
  const task = currentTask(snapshot.proof, snapshot.definition);
  return {
    locale: snapshot.definition.locale,
    stage: snapshot.proof.stage,
    phase: snapshot.session.phase,
    phonemeSequence: task?.phonemeSequence ?? [],
    availableTiles:
      task?.tiles.filter((tile) => !snapshot.proof.selectedTileIds.includes(tile.tileId)) ?? [],
    selectedGraphemes: snapshot.proof.selectedGraphemes,
    meaningPrompt: task?.meaningPrompt ?? "",
    modelWord: snapshot.proof.modelVisible ? task?.word : undefined,
    feedbackCode: snapshot.proof.feedbackCode,
    canBuild:
      snapshot.proof.stage === "TARGET_BUILD" ||
      snapshot.proof.stage === "TRANSFER_BUILD",
    canRequestHelp:
      !snapshot.session.deleted &&
      ["CHILD_ACTING", "WAITING_WITHOUT_INTERVENTION"].includes(snapshot.session.phase),
    canRequestQuiet:
      !snapshot.session.quietMode &&
      !["STOPPED", "COMPLETED", "INVALIDATED"].includes(snapshot.session.phase),
    canPause:
      !["PAUSED", "STOPPED", "COMPLETED", "INVALIDATED"].includes(snapshot.session.phase),
    canResume: snapshot.session.phase === "PAUSED",
    canStop: !["STOPPED", "INVALIDATED"].includes(snapshot.session.phase),
    canPlayAudio:
      !snapshot.session.quietMode &&
      !["PAUSED", "STOPPED", "COMPLETED", "INVALIDATED"].includes(snapshot.session.phase),
    quietMode: snapshot.session.quietMode,
    targetEvidence: snapshot.proof.targetEvidence,
    transferEvidence: snapshot.proof.transferEvidence,
  };
}

export function projectVerticalAdult(
  snapshot: VerticalProofSnapshot,
): VerticalAdultProjection {
  return {
    locale: snapshot.definition.locale,
    stage: snapshot.proof.stage,
    phase: snapshot.session.phase,
    builtWord: snapshot.proof.selectedGraphemes.join(""),
    currentCard: snapshot.session.activeCard,
    waitAllowed: snapshot.session.activeCard?.waitAllowed ?? false,
    canModel: snapshot.session.activeCard !== undefined,
    canConfirmReading:
      snapshot.proof.stage === "TARGET_READ_CONFIRMATION" ||
      snapshot.proof.stage === "TRANSFER_READ_CONFIRMATION",
    canStop: !["STOPPED", "INVALIDATED"].includes(snapshot.session.phase),
    targetEvidence: snapshot.proof.targetEvidence,
    transferEvidence: snapshot.proof.transferEvidence,
    contextCorrections: snapshot.session.contextCorrections,
  };
}
