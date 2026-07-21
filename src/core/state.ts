import type { SupportAction } from "./actions.js";
import type {
  AdultCardTemplate,
  ContextCorrectionCode,
  Locale,
} from "./content-contracts.js";
import {
  evidenceAfterSupport,
  type EvidenceStatus,
  type SupportProvenance,
} from "./evidence.js";

export const SESSION_PHASES = [
  "NOT_STARTED",
  "ORIENTING",
  "READY",
  "CHILD_ACTING",
  "WAITING_WITHOUT_INTERVENTION",
  "HELP_REQUESTED",
  "ADULT_CONSIDERING",
  "ADULT_SUPPORT_SELECTED",
  "CHILD_REACTING_AFTER_SUPPORT",
  "PAUSED",
  "STOPPED",
  "COMPLETED",
  "INVALIDATED",
] as const;

export type SessionPhase = (typeof SESSION_PHASES)[number];

type ActivePhase = Exclude<
  SessionPhase,
  "NOT_STARTED" | "PAUSED" | "STOPPED" | "COMPLETED" | "INVALIDATED"
>;

export interface SessionState {
  readonly sessionId: string;
  readonly locale: Locale;
  readonly contentReleaseId: string;
  readonly phase: SessionPhase;
  readonly previousActivePhase: ActivePhase | undefined;
  readonly version: number;
  readonly authorityGeneration: number;
  readonly currentAttemptId: string | undefined;
  readonly activeCard: AdultCardTemplate | undefined;
  readonly playingAudioIds: readonly string[];
  readonly quietMode: boolean;
  readonly supportProvenance: readonly SupportProvenance[];
  readonly evidenceStatus: EvidenceStatus;
  readonly contextCorrections: readonly ContextCorrectionCode[];
  readonly deleted: boolean;
}

export type SessionCommand =
  | { readonly kind: "START"; readonly at: string }
  | { readonly kind: "ORIENTATION_COMPLETE"; readonly at: string }
  | {
      readonly kind: "BEGIN_CHILD_ACTION";
      readonly at: string;
      readonly attemptId: string;
    }
  | { readonly kind: "WAIT"; readonly at: string; readonly actor: "CHILD" | "ADULT" }
  | { readonly kind: "REQUEST_HELP"; readonly at: string }
  | {
      readonly kind: "SHOW_ADULT_CARD";
      readonly at: string;
      readonly card: AdultCardTemplate;
    }
  | { readonly kind: "ADULT_WAIT"; readonly at: string }
  | {
      readonly kind: "SELECT_SUPPORT";
      readonly at: string;
      readonly support: SupportAction;
      readonly cardId: string;
    }
  | {
      readonly kind: "CHILD_ACTION_AFTER_SUPPORT";
      readonly at: string;
      readonly attemptId: string;
    }
  | { readonly kind: "REQUEST_QUIET"; readonly at: string }
  | {
      readonly kind: "PLAY_AUDIO" | "REPLAY_AUDIO";
      readonly at: string;
      readonly audioSpecId: string;
    }
  | { readonly kind: "PAUSE"; readonly at: string }
  | { readonly kind: "RESUME"; readonly at: string }
  | { readonly kind: "STOP"; readonly at: string; readonly actor: "CHILD" | "ADULT" }
  | { readonly kind: "ADULT_OVERRIDE"; readonly at: string }
  | {
      readonly kind: "CONTEXT_CORRECTION";
      readonly at: string;
      readonly correction: ContextCorrectionCode;
    }
  | { readonly kind: "COMPLETE"; readonly at: string }
  | { readonly kind: "INVALIDATE"; readonly at: string }
  | { readonly kind: "DELETE_SESSION"; readonly at: string }
  | {
      readonly kind: "RECONNECT";
      readonly at: string;
      readonly sessionId: string;
      readonly authorityGeneration: number;
    };

export type DomainEvent =
  | { readonly type: "STATE_CHANGED"; readonly to: SessionPhase }
  | { readonly type: "NO_INTERVENTION" }
  | { readonly type: "QUIET_MODE_ENABLED" }
  | { readonly type: "ADULT_CARD_PRESENTED"; readonly cardId: string }
  | { readonly type: "ADULT_CARD_DISMISSED"; readonly cardId: string }
  | { readonly type: "SUPPORT_RECORDED"; readonly support: SupportAction }
  | { readonly type: "AUDIO_REQUESTED"; readonly audioSpecId: string }
  | { readonly type: "AUDIO_STOPPED"; readonly audioSpecId: string }
  | { readonly type: "CONTEXT_CORRECTION_RECORDED"; readonly code: ContextCorrectionCode }
  | { readonly type: "SESSION_STOPPED" }
  | { readonly type: "SESSION_DELETED" }
  | { readonly type: "RECONNECTED" }
  | { readonly type: "COMMAND_REJECTED"; readonly reason: string };

export interface TransitionResult {
  readonly state: SessionState;
  readonly events: readonly DomainEvent[];
  readonly accepted: boolean;
}

export function createInitialSession(input: {
  readonly sessionId: string;
  readonly locale: Locale;
  readonly contentReleaseId: string;
}): SessionState {
  return {
    sessionId: input.sessionId,
    locale: input.locale,
    contentReleaseId: input.contentReleaseId,
    phase: "NOT_STARTED",
    previousActivePhase: undefined,
    version: 0,
    authorityGeneration: 1,
    currentAttemptId: undefined,
    activeCard: undefined,
    playingAudioIds: [],
    quietMode: false,
    supportProvenance: [],
    evidenceStatus: "PARTICIPATED",
    contextCorrections: [],
    deleted: false,
  };
}

function reject(state: SessionState, reason: string): TransitionResult {
  return {
    state,
    events: [{ type: "COMMAND_REJECTED", reason }],
    accepted: false,
  };
}

function update(
  state: SessionState,
  patch: Partial<SessionState>,
  events: readonly DomainEvent[],
): TransitionResult {
  return {
    state: { ...state, ...patch, version: state.version + 1 },
    events,
    accepted: true,
  };
}

function isTerminal(state: SessionState): boolean {
  return state.deleted || state.phase === "STOPPED" || state.phase === "INVALIDATED";
}

function isActivePhase(phase: SessionPhase): phase is ActivePhase {
  return ![
    "NOT_STARTED",
    "PAUSED",
    "STOPPED",
    "COMPLETED",
    "INVALIDATED",
  ].includes(phase);
}

export function transition(
  state: SessionState,
  command: SessionCommand,
): TransitionResult {
  if (state.deleted && command.kind !== "DELETE_SESSION") {
    return reject(state, "deleted session cannot be revived");
  }

  if (
    isTerminal(state) &&
    command.kind !== "DELETE_SESSION" &&
    command.kind !== "RECONNECT"
  ) {
    return reject(state, "terminal session rejects active commands");
  }

  switch (command.kind) {
    case "START":
      return state.phase === "NOT_STARTED"
        ? update(state, { phase: "ORIENTING" }, [
            { type: "STATE_CHANGED", to: "ORIENTING" },
          ])
        : reject(state, "start requires NOT_STARTED");

    case "ORIENTATION_COMPLETE":
      return state.phase === "ORIENTING"
        ? update(state, { phase: "READY" }, [
            { type: "STATE_CHANGED", to: "READY" },
          ])
        : reject(state, "orientation completion requires ORIENTING");

    case "BEGIN_CHILD_ACTION":
      return state.phase === "READY" || state.phase === "WAITING_WITHOUT_INTERVENTION"
        ? update(
            state,
            {
              phase: "CHILD_ACTING",
              currentAttemptId: command.attemptId,
              activeCard: undefined,
            },
            [{ type: "STATE_CHANGED", to: "CHILD_ACTING" }],
          )
        : reject(state, "child action requires READY or WAITING");

    case "WAIT":
      return isActivePhase(state.phase)
        ? update(
            state,
            { phase: "WAITING_WITHOUT_INTERVENTION", activeCard: undefined },
            [
              { type: "STATE_CHANGED", to: "WAITING_WITHOUT_INTERVENTION" },
              { type: "NO_INTERVENTION" },
            ],
          )
        : reject(state, "wait requires active session");

    case "REQUEST_HELP":
      return state.phase === "CHILD_ACTING" || state.phase === "WAITING_WITHOUT_INTERVENTION"
        ? update(state, { phase: "HELP_REQUESTED" }, [
            { type: "STATE_CHANGED", to: "HELP_REQUESTED" },
          ])
        : reject(state, "help requires child activity or waiting");

    case "SHOW_ADULT_CARD":
      if (state.phase !== "HELP_REQUESTED" && state.phase !== "ADULT_CONSIDERING") {
        return reject(state, "adult card requires help request or adult review");
      }
      if (state.activeCard !== undefined) {
        return reject(state, "only one adult card may be active");
      }
      return update(
        state,
        { phase: "ADULT_CONSIDERING", activeCard: command.card },
        [
          { type: "STATE_CHANGED", to: "ADULT_CONSIDERING" },
          { type: "ADULT_CARD_PRESENTED", cardId: command.card.cardId },
        ],
      );

    case "ADULT_WAIT":
      return state.phase === "ADULT_CONSIDERING"
        ? update(
            state,
            { phase: "WAITING_WITHOUT_INTERVENTION", activeCard: undefined },
            [
              ...(state.activeCard
                ? [{ type: "ADULT_CARD_DISMISSED", cardId: state.activeCard.cardId } as const]
                : []),
              { type: "STATE_CHANGED", to: "WAITING_WITHOUT_INTERVENTION" },
              { type: "NO_INTERVENTION" },
            ],
          )
        : reject(state, "adult wait requires ADULT_CONSIDERING");

    case "SELECT_SUPPORT": {
      if (state.phase !== "ADULT_CONSIDERING" || state.activeCard === undefined) {
        return reject(state, "support selection requires active adult card");
      }
      if (state.activeCard.cardId !== command.cardId) {
        return reject(state, "stale adult card");
      }
      const attemptId = state.currentAttemptId;
      if (attemptId === undefined) {
        return reject(state, "support requires current attempt");
      }
      const provenance: SupportProvenance = {
        attemptId,
        support: command.support,
        cardId: command.cardId,
        recordedAt: command.at,
      };
      return update(
        state,
        {
          phase: "ADULT_SUPPORT_SELECTED",
          activeCard: undefined,
          supportProvenance: [...state.supportProvenance, provenance],
          evidenceStatus: command.support === "MODEL" ? "AFTER_MODEL" : "GUIDED",
        },
        [
          { type: "STATE_CHANGED", to: "ADULT_SUPPORT_SELECTED" },
          { type: "SUPPORT_RECORDED", support: command.support },
        ],
      );
    }

    case "CHILD_ACTION_AFTER_SUPPORT":
      return state.phase === "ADULT_SUPPORT_SELECTED"
        ? update(
            state,
            {
              phase: "CHILD_REACTING_AFTER_SUPPORT",
              currentAttemptId: command.attemptId,
              evidenceStatus: evidenceAfterSupport(state.supportProvenance),
            },
            [{ type: "STATE_CHANGED", to: "CHILD_REACTING_AFTER_SUPPORT" }],
          )
        : reject(state, "supported child action requires selected support");

    case "REQUEST_QUIET": {
      const stoppedAudio = state.playingAudioIds.map(
        (audioSpecId): DomainEvent => ({ type: "AUDIO_STOPPED", audioSpecId }),
      );
      return isActivePhase(state.phase)
        ? update(
            state,
            { quietMode: true, playingAudioIds: [] },
            [{ type: "QUIET_MODE_ENABLED" }, ...stoppedAudio],
          )
        : reject(state, "quiet mode requires active session");
    }

    case "PLAY_AUDIO":
    case "REPLAY_AUDIO":
      if (!isActivePhase(state.phase) || state.quietMode) {
        return reject(state, "audio unavailable in current state");
      }
      return update(
        state,
        { playingAudioIds: [command.audioSpecId] },
        [{ type: "AUDIO_REQUESTED", audioSpecId: command.audioSpecId }],
      );

    case "PAUSE": {
      if (!isActivePhase(state.phase)) {
        return reject(state, "pause requires active session");
      }
      const stoppedAudio = state.playingAudioIds.map(
        (audioSpecId): DomainEvent => ({ type: "AUDIO_STOPPED", audioSpecId }),
      );
      return update(
        state,
        {
          phase: "PAUSED",
          previousActivePhase: state.phase,
          playingAudioIds: [],
          activeCard: undefined,
        },
        [{ type: "STATE_CHANGED", to: "PAUSED" }, ...stoppedAudio],
      );
    }

    case "RESUME":
      return state.phase === "PAUSED" && state.previousActivePhase !== undefined
        ? update(
            state,
            { phase: state.previousActivePhase, previousActivePhase: undefined },
            [{ type: "STATE_CHANGED", to: state.previousActivePhase }],
          )
        : reject(state, "resume requires paused state");

    case "STOP": {
      const stoppedAudio = state.playingAudioIds.map(
        (audioSpecId): DomainEvent => ({ type: "AUDIO_STOPPED", audioSpecId }),
      );
      return update(
        state,
        {
          phase: "STOPPED",
          previousActivePhase: undefined,
          activeCard: undefined,
          playingAudioIds: [],
          authorityGeneration: state.authorityGeneration + 1,
        },
        [
          ...stoppedAudio,
          { type: "SESSION_STOPPED" },
          { type: "STATE_CHANGED", to: "STOPPED" },
        ],
      );
    }

    case "ADULT_OVERRIDE":
      return isActivePhase(state.phase)
        ? update(state, { activeCard: undefined }, [
            ...(state.activeCard
              ? [{ type: "ADULT_CARD_DISMISSED", cardId: state.activeCard.cardId } as const]
              : []),
          ])
        : reject(state, "adult override requires active session");

    case "CONTEXT_CORRECTION":
      return isActivePhase(state.phase) || state.phase === "PAUSED"
        ? update(
            state,
            {
              contextCorrections: [
                ...state.contextCorrections,
                command.correction,
              ],
            },
            [
              {
                type: "CONTEXT_CORRECTION_RECORDED",
                code: command.correction,
              },
            ],
          )
        : reject(state, "context correction requires active or paused session");

    case "COMPLETE":
      return state.phase === "CHILD_ACTING" ||
        state.phase === "CHILD_REACTING_AFTER_SUPPORT" ||
        state.phase === "WAITING_WITHOUT_INTERVENTION"
        ? update(
            state,
            { phase: "COMPLETED", activeCard: undefined, playingAudioIds: [] },
            [{ type: "STATE_CHANGED", to: "COMPLETED" }],
          )
        : reject(state, "complete requires valid completion state");

    case "INVALIDATE":
      return update(
        state,
        {
          phase: "INVALIDATED",
          activeCard: undefined,
          playingAudioIds: [],
          authorityGeneration: state.authorityGeneration + 1,
        },
        [{ type: "STATE_CHANGED", to: "INVALIDATED" }],
      );

    case "DELETE_SESSION":
      if (state.deleted) {
        return reject(state, "session already deleted");
      }
      return update(
        state,
        {
          phase: "INVALIDATED",
          deleted: true,
          activeCard: undefined,
          playingAudioIds: [],
          currentAttemptId: undefined,
          contextCorrections: [],
          authorityGeneration: state.authorityGeneration + 1,
        },
        [{ type: "SESSION_DELETED" }, { type: "STATE_CHANGED", to: "INVALIDATED" }],
      );

    case "RECONNECT":
      if (state.deleted || state.phase === "STOPPED" || state.phase === "INVALIDATED") {
        return reject(state, "reconnect cannot revive stopped or deleted session");
      }
      if (
        command.sessionId !== state.sessionId ||
        command.authorityGeneration !== state.authorityGeneration
      ) {
        return reject(state, "stale or foreign reconnect capability");
      }
      return update(
        state,
        { activeCard: undefined, playingAudioIds: [] },
        [
          ...(state.activeCard
            ? [{ type: "ADULT_CARD_DISMISSED", cardId: state.activeCard.cardId } as const]
            : []),
          ...state.playingAudioIds.map(
            (audioSpecId): DomainEvent => ({ type: "AUDIO_STOPPED", audioSpecId }),
          ),
          { type: "RECONNECTED" },
        ],
      );
  }
}
