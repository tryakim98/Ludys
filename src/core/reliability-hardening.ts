import {
  LIFECYCLE_STATES,
  transitionLifecycle,
  type LifecycleEvent,
  type LifecycleSession,
} from "./session-lifecycle.js";
import {
  SESSION_PHASES,
  transition,
  type SessionCommand,
  type SessionState,
  type TransitionResult,
} from "./state.js";
import type { Locale } from "./content-contracts.js";

export const RELIABILITY_SCHEMA_VERSION = "wp13.10-session-snapshot-v1" as const;
export const DEFAULT_MAX_COMMAND_AGE_MS = 30_000;
export const DEFAULT_MAX_CLOCK_SKEW_MS = 5_000;

export type CommandOutcome =
  | "APPLIED"
  | "DUPLICATE_COMMAND"
  | "STALE_VERSION"
  | "STALE_AUTHORITY"
  | "DELAYED_COMMAND"
  | "DOMAIN_REJECTED";

export interface CommandEnvelope<TCommand> {
  readonly commandId: string;
  readonly expectedVersion: number;
  readonly authorityGeneration: number;
  readonly issuedAt: string;
  readonly command: TCommand;
}

export interface CommandPreflight {
  readonly outcome: Exclude<CommandOutcome, "APPLIED"> | undefined;
  readonly reason: string | undefined;
}

function validTimestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function preflightCommand(
  input: {
    readonly version: number;
    readonly authorityGeneration: number;
    readonly processedCommandIds: ReadonlySet<string>;
  },
  envelope: CommandEnvelope<unknown>,
  now: string,
  maxCommandAgeMs = DEFAULT_MAX_COMMAND_AGE_MS,
): CommandPreflight {
  if (envelope.commandId.trim().length === 0) {
    return { outcome: "DOMAIN_REJECTED", reason: "commandId is required" };
  }
  if (input.processedCommandIds.has(envelope.commandId)) {
    return { outcome: "DUPLICATE_COMMAND", reason: "commandId was already processed" };
  }
  if (envelope.expectedVersion !== input.version) {
    return { outcome: "STALE_VERSION", reason: "expectedVersion does not match authoritative state" };
  }
  if (envelope.authorityGeneration !== input.authorityGeneration) {
    return { outcome: "STALE_AUTHORITY", reason: "authority generation is stale" };
  }
  const issuedAt = validTimestamp(envelope.issuedAt);
  const observedAt = validTimestamp(now);
  if (issuedAt === undefined || observedAt === undefined) {
    return { outcome: "DOMAIN_REJECTED", reason: "issuedAt and now must be ISO timestamps" };
  }
  if (issuedAt < observedAt - maxCommandAgeMs || issuedAt > observedAt + DEFAULT_MAX_CLOCK_SKEW_MS) {
    return { outcome: "DELAYED_COMMAND", reason: "command is outside the accepted time window" };
  }
  return { outcome: undefined, reason: undefined };
}

const ACTIVE_SESSION_PHASES = new Set([
  "ORIENTING",
  "READY",
  "CHILD_ACTING",
  "WAITING_WITHOUT_INTERVENTION",
  "HELP_REQUESTED",
  "ADULT_CONSIDERING",
  "ADULT_SUPPORT_SELECTED",
  "CHILD_REACTING_AFTER_SUPPORT",
]);

export function validateSessionState(state: SessionState): string[] {
  const errors: string[] = [];
  if (!SESSION_PHASES.includes(state.phase)) errors.push("unknown session phase");
  if (!Number.isInteger(state.version) || state.version < 0) errors.push("state version must be a non-negative integer");
  if (!Number.isInteger(state.authorityGeneration) || state.authorityGeneration < 1) errors.push("authority generation must be a positive integer");
  if (!(["nb-NO", "nn-NO"] as const).includes(state.locale)) errors.push("locale must be explicit BM or NN");
  if (state.playingAudioIds.length > 1) errors.push("at most one audio item may be active");
  if (state.quietMode && state.playingAudioIds.length > 0) errors.push("quiet mode cannot retain active audio");
  if (["STOPPED", "COMPLETED", "INVALIDATED"].includes(state.phase) || state.deleted) {
    if (state.activeCard !== undefined) errors.push("terminal state cannot retain an adult card");
    if (state.playingAudioIds.length > 0) errors.push("terminal state cannot retain audio");
  }
  if (state.phase === "PAUSED") {
    if (state.previousActivePhase === undefined || !ACTIVE_SESSION_PHASES.has(state.previousActivePhase)) {
      errors.push("paused state requires a valid previous active phase");
    }
  } else if (state.previousActivePhase !== undefined) {
    errors.push("non-paused state cannot retain pause metadata");
  }
  if (state.deleted) {
    if (state.phase !== "INVALIDATED") errors.push("deleted session must be invalidated");
    if (state.currentAttemptId !== undefined) errors.push("deleted session cannot retain an attempt");
  }
  if (state.supportProvenance.length > 0 && state.evidenceStatus === "INDEPENDENT") {
    errors.push("supported evidence cannot be upgraded to independent");
  }
  return errors;
}

export function validateLifecycleSession(state: LifecycleSession): string[] {
  const errors: string[] = [];
  if (!LIFECYCLE_STATES.includes(state.state)) errors.push("unknown lifecycle state");
  if (!Number.isInteger(state.version) || state.version < 0) errors.push("lifecycle version must be a non-negative integer");
  if (!Number.isInteger(state.authorityGeneration) || state.authorityGeneration < 1) errors.push("lifecycle authority generation must be positive");
  if (!(["nb-NO", "nn-NO"] as const).includes(state.locale)) errors.push("lifecycle locale must be explicit BM or NN");
  if (state.state === "PAUSED" && state.resumeTarget === undefined) errors.push("paused lifecycle requires resumeTarget");
  if (state.state !== "PAUSED" && state.resumeTarget !== undefined) errors.push("non-paused lifecycle cannot retain resumeTarget");
  if (["STOPPED", "DELETED", "COMPLETED"].includes(state.state)) {
    if (state.helpRequested) errors.push("terminal lifecycle cannot retain help request");
    if (state.resumeTarget !== undefined || state.recoveryTarget !== undefined) errors.push("terminal lifecycle cannot retain recovery metadata");
  }
  if ((state.state === "STALE" || state.state === "INVALID" || state.state === "RECOVERING") && state.recoveryTarget === undefined) {
    errors.push("recovery lifecycle requires recoveryTarget");
  }
  return errors;
}

export interface ReliableSessionAggregate {
  readonly state: SessionState;
  readonly processedCommandIds: ReadonlySet<string>;
}

export interface ReliableCommandResult {
  readonly aggregate: ReliableSessionAggregate;
  readonly outcome: CommandOutcome;
  readonly reason: string | undefined;
  readonly transition: TransitionResult | undefined;
}

export function createReliableSessionAggregate(state: SessionState): ReliableSessionAggregate {
  const errors = validateSessionState(state);
  if (errors.length > 0) throw new Error(`Invalid initial session: ${errors.join("; ")}`);
  return { state, processedCommandIds: new Set() };
}

export function applyReliableCommand(
  aggregate: ReliableSessionAggregate,
  envelope: CommandEnvelope<SessionCommand>,
  now: string,
): ReliableCommandResult {
  const invariantErrors = validateSessionState(aggregate.state);
  if (invariantErrors.length > 0) {
    return {
      aggregate,
      outcome: "DOMAIN_REJECTED",
      reason: `authoritative state failed invariants: ${invariantErrors.join("; ")}`,
      transition: undefined,
    };
  }
  const preflight = preflightCommand({
    version: aggregate.state.version,
    authorityGeneration: aggregate.state.authorityGeneration,
    processedCommandIds: aggregate.processedCommandIds,
  }, envelope, now);
  if (preflight.outcome !== undefined) {
    return { aggregate, outcome: preflight.outcome, reason: preflight.reason, transition: undefined };
  }
  const processedCommandIds = new Set(aggregate.processedCommandIds);
  processedCommandIds.add(envelope.commandId);
  const result = transition(aggregate.state, envelope.command);
  if (!result.accepted) {
    return {
      aggregate: { state: aggregate.state, processedCommandIds },
      outcome: "DOMAIN_REJECTED",
      reason: result.events.find((event) => event.type === "COMMAND_REJECTED")?.reason ?? "domain rejected command",
      transition: result,
    };
  }
  const afterErrors = validateSessionState(result.state);
  if (afterErrors.length > 0) {
    return {
      aggregate: { state: aggregate.state, processedCommandIds },
      outcome: "DOMAIN_REJECTED",
      reason: `transition violated invariants: ${afterErrors.join("; ")}`,
      transition: undefined,
    };
  }
  return {
    aggregate: { state: result.state, processedCommandIds },
    outcome: "APPLIED",
    reason: undefined,
    transition: result,
  };
}

export interface LifecycleCommandEnvelope extends CommandEnvelope<LifecycleEvent> {}

export function applyReliableLifecycleCommand(
  state: LifecycleSession,
  processedCommandIds: ReadonlySet<string>,
  envelope: LifecycleCommandEnvelope,
  now: string,
): {
  readonly state: LifecycleSession;
  readonly processedCommandIds: ReadonlySet<string>;
  readonly outcome: CommandOutcome;
  readonly reason: string | undefined;
} {
  const invariantErrors = validateLifecycleSession(state);
  if (invariantErrors.length > 0) {
    return { state, processedCommandIds, outcome: "DOMAIN_REJECTED", reason: invariantErrors.join("; ") };
  }
  const preflight = preflightCommand({
    version: state.version,
    authorityGeneration: state.authorityGeneration,
    processedCommandIds,
  }, envelope, now);
  if (preflight.outcome !== undefined) {
    return { state, processedCommandIds, outcome: preflight.outcome, reason: preflight.reason };
  }
  const nextProcessed = new Set(processedCommandIds);
  nextProcessed.add(envelope.commandId);
  const result = transitionLifecycle(state, envelope.command);
  if (!result.accepted) {
    return {
      state,
      processedCommandIds: nextProcessed,
      outcome: "DOMAIN_REJECTED",
      reason: result.error?.code ?? "lifecycle rejected command",
    };
  }
  const afterErrors = validateLifecycleSession(result.state);
  if (afterErrors.length > 0) {
    return {
      state,
      processedCommandIds: nextProcessed,
      outcome: "DOMAIN_REJECTED",
      reason: afterErrors.join("; "),
    };
  }
  return {
    state: result.state,
    processedCommandIds: nextProcessed,
    outcome: "APPLIED",
    reason: undefined,
  };
}

export type RecoveryStatus =
  | "RECOVERED"
  | "EMPTY_SAFE_START"
  | "CORRUPTED_INVALIDATED"
  | "UNSUPPORTED_VERSION"
  | "CONTENT_UNAVAILABLE"
  | "TEXT_ONLY";

export interface RecoveryReferenceCatalog {
  readonly contentReleaseId: string;
  readonly activityIds: readonly string[];
  readonly knowledgeIds: readonly string[];
  readonly contextIds: readonly string[];
  readonly audioIds: readonly string[];
  readonly locale: Locale;
}

export interface StoredSessionSnapshot {
  readonly schemaVersion: typeof RELIABILITY_SCHEMA_VERSION;
  readonly session: SessionState;
  readonly activityId: string;
  readonly knowledgeId: string;
  readonly contextId: string;
  readonly audio: {
    readonly audioId: string;
    readonly lifecycle: "CURRENT" | "STALE" | "WITHDRAWN";
    readonly format: "WAV_PCM_MONO_48KHZ" | "UNKNOWN";
  };
}

export interface RecoveryResult {
  readonly status: RecoveryStatus;
  readonly snapshot: StoredSessionSnapshot | undefined;
  readonly safeState: "NEW_SESSION" | "INVALIDATED" | "TEXT_AND_SILENCE" | "RECOVERED";
  readonly reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalidateSnapshot(snapshot: StoredSessionSnapshot): StoredSessionSnapshot {
  return {
    ...snapshot,
    session: {
      ...snapshot.session,
      phase: "INVALIDATED",
      authorityGeneration: snapshot.session.authorityGeneration + 1,
      activeCard: undefined,
      playingAudioIds: [],
      previousActivePhase: undefined,
    },
  };
}

export function recoverStoredSession(
  serialized: string | undefined,
  catalog: RecoveryReferenceCatalog,
): RecoveryResult {
  if (serialized === undefined || serialized.trim().length === 0) {
    return { status: "EMPTY_SAFE_START", snapshot: undefined, safeState: "NEW_SESSION", reason: "storage was empty" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return { status: "CORRUPTED_INVALIDATED", snapshot: undefined, safeState: "INVALIDATED", reason: "storage was not valid JSON" };
  }
  if (!isRecord(parsed) || !isRecord(parsed.session) || !isRecord(parsed.audio)) {
    return { status: "CORRUPTED_INVALIDATED", snapshot: undefined, safeState: "INVALIDATED", reason: "snapshot shape was invalid" };
  }
  if (parsed.schemaVersion !== RELIABILITY_SCHEMA_VERSION) {
    return { status: "UNSUPPORTED_VERSION", snapshot: undefined, safeState: "INVALIDATED", reason: "schemaVersion is unsupported" };
  }
  const snapshot = parsed as unknown as StoredSessionSnapshot;
  const stateErrors = validateSessionState(snapshot.session);
  if (stateErrors.length > 0) {
    return {
      status: "CORRUPTED_INVALIDATED",
      snapshot: invalidateSnapshot(snapshot),
      safeState: "INVALIDATED",
      reason: stateErrors.join("; "),
    };
  }
  if (
    snapshot.session.contentReleaseId !== catalog.contentReleaseId
    || snapshot.session.locale !== catalog.locale
    || !catalog.activityIds.includes(snapshot.activityId)
    || !catalog.knowledgeIds.includes(snapshot.knowledgeId)
    || !catalog.contextIds.includes(snapshot.contextId)
  ) {
    return {
      status: "CONTENT_UNAVAILABLE",
      snapshot: invalidateSnapshot(snapshot),
      safeState: "INVALIDATED",
      reason: "content or locale reference is unavailable",
    };
  }
  if (
    !catalog.audioIds.includes(snapshot.audio.audioId)
    || snapshot.audio.lifecycle !== "CURRENT"
    || snapshot.audio.format !== "WAV_PCM_MONO_48KHZ"
  ) {
    return {
      status: "TEXT_ONLY",
      snapshot: {
        ...snapshot,
        session: { ...snapshot.session, playingAudioIds: [] },
      },
      safeState: "TEXT_AND_SILENCE",
      reason: "audio is missing, stale, withdrawn, or invalid",
    };
  }
  return { status: "RECOVERED", snapshot, safeState: "RECOVERED", reason: "snapshot is reference-closed and valid" };
}
