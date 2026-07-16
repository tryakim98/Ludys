import type { ContextCorrectionCode, HumanFirstContentBundle, Locale } from "../core/content-contracts.js";
import {
  createInitialSession,
  transition,
  type SessionState,
} from "../core/state.js";
import {
  createWordProofState,
  transitionWordProof,
  type WordProofDefinition,
  type WordProofState,
} from "../core/word-proof.js";

export interface VerticalProofSnapshot {
  readonly session: SessionState;
  readonly proof: WordProofState;
  readonly definition: WordProofDefinition;
  readonly content: HumanFirstContentBundle;
  readonly lastTechnicalMessage: string;
}

export type VerticalProofCommand =
  | { readonly kind: "SELECT_TILE"; readonly tileId: string }
  | { readonly kind: "REMOVE_LAST_TILE" }
  | { readonly kind: "CLEAR_TILES" }
  | { readonly kind: "SUBMIT_BUILD" }
  | { readonly kind: "REQUEST_HELP" }
  | { readonly kind: "ADULT_WAIT" }
  | { readonly kind: "ADULT_MODEL" }
  | { readonly kind: "ADULT_CONFIRM_READING" }
  | { readonly kind: "REQUEST_QUIET" }
  | { readonly kind: "PLAY_AUDIO" }
  | { readonly kind: "PAUSE" }
  | { readonly kind: "RESUME" }
  | { readonly kind: "STOP"; readonly actor: "CHILD" | "ADULT" }
  | {
      readonly kind: "CONTEXT_CORRECTION";
      readonly correction: ContextCorrectionCode;
    };

function mustAccept(result: ReturnType<typeof transition>): SessionState {
  if (!result.accepted) {
    throw new Error(result.events[0]?.type === "COMMAND_REJECTED" ? result.events[0].reason : "session command rejected");
  }
  return result.state;
}

function activeAttemptId(proof: WordProofState): string {
  const task = proof.stage.startsWith("TRANSFER") ? "transfer" : "target";
  return `${task}-attempt-${proof.attemptNumber}`;
}

export class VerticalProofController {
  #snapshot: VerticalProofSnapshot;
  readonly #listeners = new Set<(snapshot: VerticalProofSnapshot) => void>();

  constructor(input: {
    readonly sessionId: string;
    readonly definition: WordProofDefinition;
    readonly content: HumanFirstContentBundle;
  }) {
    if (input.definition.locale !== input.content.locale) {
      throw new Error("definition and content locale must match");
    }
    let session = createInitialSession({
      sessionId: input.sessionId,
      locale: input.definition.locale,
      contentReleaseId: input.content.releaseId,
    });
    session = mustAccept(transition(session, { kind: "START", at: "synthetic-start" }));
    session = mustAccept(
      transition(session, { kind: "ORIENTATION_COMPLETE", at: "synthetic-start" }),
    );
    const proof = createWordProofState(input.definition, session.supportProvenance.length);
    session = mustAccept(
      transition(session, {
        kind: "BEGIN_CHILD_ACTION",
        at: "synthetic-start",
        attemptId: activeAttemptId(proof),
      }),
    );
    this.#snapshot = {
      session,
      proof,
      definition: input.definition,
      content: input.content,
      lastTechnicalMessage: "ready",
    };
  }

  get snapshot(): VerticalProofSnapshot {
    return this.#snapshot;
  }

  subscribe(listener: (snapshot: VerticalProofSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  #publish(next: VerticalProofSnapshot): VerticalProofSnapshot {
    this.#snapshot = next;
    for (const listener of this.#listeners) listener(next);
    return next;
  }

  #ensureChildAction(session: SessionState, proof: WordProofState): SessionState {
    if (session.phase === "WAITING_WITHOUT_INTERVENTION" || session.phase === "READY") {
      return mustAccept(
        transition(session, {
          kind: "BEGIN_CHILD_ACTION",
          at: "synthetic-ui",
          attemptId: activeAttemptId(proof),
        }),
      );
    }
    if (session.phase === "ADULT_SUPPORT_SELECTED") {
      return mustAccept(
        transition(session, {
          kind: "CHILD_ACTION_AFTER_SUPPORT",
          at: "synthetic-ui",
          attemptId: activeAttemptId(proof),
        }),
      );
    }
    return session;
  }

  dispatch(command: VerticalProofCommand): VerticalProofSnapshot {
    let { session, proof } = this.#snapshot;
    let technical: string = command.kind;

    switch (command.kind) {
      case "SELECT_TILE":
      case "REMOVE_LAST_TILE":
      case "CLEAR_TILES":
      case "SUBMIT_BUILD": {
        session = this.#ensureChildAction(session, proof);
        const proofCommand =
          command.kind === "SELECT_TILE"
            ? { kind: "SELECT_TILE" as const, tileId: command.tileId }
            : { kind: command.kind } as const;
        const result = transitionWordProof(proof, this.#snapshot.definition, proofCommand);
        if (!result.accepted) technical = result.reason ?? "word command rejected";
        proof = result.state;
        break;
      }

      case "REQUEST_HELP":
        session = mustAccept(transition(session, { kind: "REQUEST_HELP", at: "synthetic-ui" }));
        session = mustAccept(
          transition(session, {
            kind: "SHOW_ADULT_CARD",
            at: "synthetic-ui",
            card: this.#snapshot.content.adultCard,
          }),
        );
        break;

      case "ADULT_WAIT":
        session = mustAccept(transition(session, { kind: "ADULT_WAIT", at: "synthetic-ui" }));
        break;

      case "ADULT_MODEL": {
        const card = session.activeCard;
        if (card === undefined) throw new Error("adult model requires current card");
        session = mustAccept(
          transition(session, {
            kind: "SELECT_SUPPORT",
            at: "synthetic-ui",
            support: "MODEL",
            cardId: card.cardId,
          }),
        );
        proof = transitionWordProof(proof, this.#snapshot.definition, {
          kind: "REVEAL_MODEL",
        }).state;
        break;
      }

      case "ADULT_CONFIRM_READING": {
        const result = transitionWordProof(proof, this.#snapshot.definition, {
          kind: "ADULT_CONFIRM_READING",
          currentSupportCount: session.supportProvenance.length,
        });
        if (!result.accepted) throw new Error(result.reason);
        proof = result.state;
        if (proof.stage === "COMPLETED") {
          session = mustAccept(transition(session, { kind: "COMPLETE", at: "synthetic-ui" }));
        } else {
          session = mustAccept(
            transition(session, { kind: "WAIT", at: "synthetic-ui", actor: "ADULT" }),
          );
          session = mustAccept(
            transition(session, {
              kind: "BEGIN_CHILD_ACTION",
              at: "synthetic-ui",
              attemptId: activeAttemptId(proof),
            }),
          );
        }
        break;
      }

      case "REQUEST_QUIET":
        session = mustAccept(transition(session, { kind: "REQUEST_QUIET", at: "synthetic-ui" }));
        proof = transitionWordProof(proof, this.#snapshot.definition, { kind: "SET_QUIET" }).state;
        break;

      case "PLAY_AUDIO": {
        const task = proof.stage.startsWith("TRANSFER")
          ? this.#snapshot.definition.transfer
          : this.#snapshot.definition.target;
        const result = transition(session, {
          kind: "PLAY_AUDIO",
          at: "synthetic-ui",
          audioSpecId: task.audioSpecId,
        });
        if (!result.accepted) technical = "audio unavailable; reviewed text remains available";
        else session = result.state;
        break;
      }

      case "PAUSE":
        session = mustAccept(transition(session, { kind: "PAUSE", at: "synthetic-ui" }));
        proof = transitionWordProof(proof, this.#snapshot.definition, { kind: "SET_PAUSED" }).state;
        break;

      case "RESUME":
        session = mustAccept(transition(session, { kind: "RESUME", at: "synthetic-ui" }));
        break;

      case "STOP":
        session = mustAccept(
          transition(session, { kind: "STOP", at: "synthetic-ui", actor: command.actor }),
        );
        proof = transitionWordProof(proof, this.#snapshot.definition, { kind: "STOP" }).state;
        break;

      case "CONTEXT_CORRECTION":
        session = mustAccept(
          transition(session, {
            kind: "CONTEXT_CORRECTION",
            at: "synthetic-ui",
            correction: command.correction,
          }),
        );
        break;
    }

    return this.#publish({
      ...this.#snapshot,
      session,
      proof,
      lastTechnicalMessage: technical,
    });
  }
}

export function localeOf(snapshot: VerticalProofSnapshot): Locale {
  return snapshot.definition.locale;
}
