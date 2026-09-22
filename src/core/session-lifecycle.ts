import type { Locale } from "./content-contracts.js";

export const LIFECYCLE_STATES = [
  "NOT_CREATED",
  "CREATING",
  "READY",
  "ACTIVE",
  "WAITING",
  "PAUSED",
  "STOPPED",
  "DELETED",
  "STALE",
  "INVALID",
  "RECOVERING",
  "COMPLETED",
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const SYNTHETIC_DATA_CLASSIFICATION = "SYNTHETIC_TECHNICAL_DRAFT" as const;

export interface LifecycleSession {
  readonly sessionId: string;
  readonly locale: Locale;
  readonly dataClassification: typeof SYNTHETIC_DATA_CLASSIFICATION;
  readonly state: LifecycleState;
  readonly version: number;
  readonly authorityGeneration: number;
  readonly createdAt: string | undefined;
  readonly updatedAt: string;
  readonly resumeTarget: "ACTIVE" | "WAITING" | undefined;
  readonly recoveryTarget: "READY" | "ACTIVE" | "WAITING" | "PAUSED" | undefined;
  readonly helpRequested: boolean;
  readonly childProjectionToken: "SYNTHETIC_CHILD_ONLY";
  readonly adultProjectionToken: "SYNTHETIC_ADULT_ONLY";
}

export type LifecycleEvent =
  | { readonly kind: "CREATE"; readonly at: string }
  | { readonly kind: "CREATED"; readonly at: string }
  | { readonly kind: "ACTIVATE"; readonly at: string }
  | { readonly kind: "REQUEST_HELP"; readonly at: string }
  | { readonly kind: "ENTER_WAIT"; readonly at: string }
  | { readonly kind: "RESUME"; readonly at: string }
  | { readonly kind: "PAUSE"; readonly at: string }
  | { readonly kind: "STOP"; readonly at: string }
  | { readonly kind: "DELETE"; readonly at: string }
  | { readonly kind: "RECONNECT"; readonly at: string }
  | { readonly kind: "DETECT_STALE"; readonly at: string }
  | { readonly kind: "DETECT_INVALID"; readonly at: string }
  | { readonly kind: "BEGIN_RECOVERY"; readonly at: string }
  | { readonly kind: "RECOVERY_SUCCEEDED"; readonly at: string }
  | { readonly kind: "RECOVERY_FAILED"; readonly at: string }
  | { readonly kind: "COMPLETE"; readonly at: string };

export type LifecycleErrorCode =
  | "INVALID_TRANSITION"
  | "DUPLICATE_COMMAND"
  | "STALE_AUTHORITY"
  | "DELAYED_COMMAND"
  | "NO_RESURRECTION"
  | "TOMBSTONE"
  | "NOT_FOUND"
  | "STALE_WRITE_REJECTED"
  | "DISCONNECTED"
  | "INVALID_PAYLOAD"
  | "RECOVERY_FAILED";

export interface LifecycleTransitionError {
  readonly code: LifecycleErrorCode;
  readonly from: LifecycleState;
  readonly event: LifecycleEvent["kind"];
}

export interface LifecycleTransitionResult {
  readonly state: LifecycleSession;
  readonly accepted: boolean;
  readonly error: LifecycleTransitionError | undefined;
}

export function createNotCreatedLifecycle(input: {
  readonly sessionId: string;
  readonly locale: Locale;
  readonly at: string;
}): LifecycleSession {
  return {
    sessionId: input.sessionId,
    locale: input.locale,
    dataClassification: SYNTHETIC_DATA_CLASSIFICATION,
    state: "NOT_CREATED",
    version: 0,
    authorityGeneration: 1,
    createdAt: undefined,
    updatedAt: input.at,
    resumeTarget: undefined,
    recoveryTarget: undefined,
    helpRequested: false,
    childProjectionToken: "SYNTHETIC_CHILD_ONLY",
    adultProjectionToken: "SYNTHETIC_ADULT_ONLY",
  };
}

function reject(
  state: LifecycleSession,
  event: LifecycleEvent,
  code: LifecycleErrorCode = "INVALID_TRANSITION",
): LifecycleTransitionResult {
  return {
    state,
    accepted: false,
    error: { code, from: state.state, event: event.kind },
  };
}

function accept(
  state: LifecycleSession,
  event: LifecycleEvent,
  patch: Partial<LifecycleSession>,
): LifecycleTransitionResult {
  return {
    state: {
      ...state,
      ...patch,
      version: state.version + 1,
      updatedAt: event.at,
    },
    accepted: true,
    error: undefined,
  };
}

function canDetectProblem(state: LifecycleState): state is "READY" | "ACTIVE" | "WAITING" | "PAUSED" {
  return ["READY", "ACTIVE", "WAITING", "PAUSED"].includes(state);
}

export function transitionLifecycle(
  state: LifecycleSession,
  event: LifecycleEvent,
): LifecycleTransitionResult {
  if (state.state === "DELETED") {
    return reject(state, event, event.kind === "RECONNECT" ? "TOMBSTONE" : "NO_RESURRECTION");
  }

  if (state.state === "STOPPED" && !["RECONNECT", "DELETE"].includes(event.kind)) {
    return reject(state, event, "NO_RESURRECTION");
  }

  switch (event.kind) {
    case "CREATE":
      return state.state === "NOT_CREATED"
        ? accept(state, event, { state: "CREATING" })
        : reject(state, event);

    case "CREATED":
      return state.state === "CREATING"
        ? accept(state, event, { state: "READY", createdAt: event.at })
        : reject(state, event);

    case "ACTIVATE":
      return state.state === "READY"
        ? accept(state, event, { state: "ACTIVE" })
        : reject(state, event);

    case "REQUEST_HELP":
      return state.state === "ACTIVE"
        ? accept(state, event, { state: "WAITING", helpRequested: true })
        : reject(state, event);

    case "ENTER_WAIT":
      return state.state === "ACTIVE"
        ? accept(state, event, { state: "WAITING", helpRequested: false })
        : reject(state, event);

    case "RESUME":
      if (state.state === "WAITING") {
        return accept(state, event, { state: "ACTIVE", helpRequested: false });
      }
      if (state.state === "PAUSED" && state.resumeTarget !== undefined) {
        return accept(state, event, {
          state: state.resumeTarget,
          resumeTarget: undefined,
        });
      }
      return reject(state, event);

    case "PAUSE":
      return state.state === "ACTIVE" || state.state === "WAITING"
        ? accept(state, event, {
            state: "PAUSED",
            resumeTarget: state.state,
          })
        : reject(state, event);

    case "STOP":
      return ["NOT_CREATED", "COMPLETED"].includes(state.state)
        ? reject(state, event)
        : accept(state, event, {
            state: "STOPPED",
            authorityGeneration: state.authorityGeneration + 1,
            resumeTarget: undefined,
            recoveryTarget: undefined,
            helpRequested: false,
          });

    case "DELETE":
      return state.state === "NOT_CREATED"
        ? reject(state, event)
        : accept(state, event, {
            state: "DELETED",
            authorityGeneration: state.authorityGeneration + 1,
            resumeTarget: undefined,
            recoveryTarget: undefined,
            helpRequested: false,
          });

    case "RECONNECT":
      return state.state === "NOT_CREATED" || state.state === "CREATING"
        ? reject(state, event)
        : accept(state, event, {});

    case "DETECT_STALE":
      return canDetectProblem(state.state)
        ? accept(state, event, { state: "STALE", recoveryTarget: state.state })
        : reject(state, event);

    case "DETECT_INVALID":
      return canDetectProblem(state.state)
        ? accept(state, event, { state: "INVALID", recoveryTarget: state.state })
        : reject(state, event);

    case "BEGIN_RECOVERY":
      return (state.state === "STALE" || state.state === "INVALID")
        && state.recoveryTarget !== undefined
        ? accept(state, event, { state: "RECOVERING" })
        : reject(state, event);

    case "RECOVERY_SUCCEEDED":
      return state.state === "RECOVERING" && state.recoveryTarget !== undefined
        ? accept(state, event, {
            state: state.recoveryTarget,
            recoveryTarget: undefined,
          })
        : reject(state, event);

    case "RECOVERY_FAILED":
      return state.state === "RECOVERING"
        ? accept(state, event, { state: "INVALID" })
        : reject(state, event);

    case "COMPLETE":
      return state.state === "ACTIVE" || state.state === "WAITING"
        ? accept(state, event, {
            state: "COMPLETED",
            resumeTarget: undefined,
            recoveryTarget: undefined,
            helpRequested: false,
          })
        : reject(state, event);
  }
}
