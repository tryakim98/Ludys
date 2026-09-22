import type { Locale } from "./content-contracts.js";
import {
  createNotCreatedLifecycle,
  transitionLifecycle,
  type LifecycleEvent,
  type LifecycleSession,
} from "./session-lifecycle.js";
import {
  preflightCommand,
  type CommandEnvelope,
  type CommandOutcome,
} from "./reliability-hardening.js";

export const SYNTHETIC_STAGING_SCHEMA_VERSION = "wp13.12b-synthetic-staging-v1" as const;
export const SYNTHETIC_STAGING_RELEASE_ID = "wp13-12b-synthetic-staging-provider-r1" as const;
export const SYNTHETIC_STAGING_DATA_CLASSIFICATION = "SYNTHETIC_ONLY_NO_PARTICIPANT_DATA" as const;

export type SyntheticStagingRole = "CHILD" | "ADULT";
export type SyntheticStagingCommandKind =
  | "ACTIVATE"
  | "REQUEST_HELP"
  | "ENTER_WAIT"
  | "RESUME"
  | "PAUSE"
  | "STOP"
  | "RECONNECT"
  | "COMPLETE";

export interface SyntheticStagingReleaseIds {
  readonly appVersion: string;
  readonly contentReleaseId: string;
  readonly knowledgeReleaseId: string;
  readonly audioReleaseId: string;
  readonly operationsReleaseId: string;
  readonly providerDecisionReleaseId: string;
  readonly stagingProviderReleaseId: typeof SYNTHETIC_STAGING_RELEASE_ID;
  readonly schemaVersion: typeof SYNTHETIC_STAGING_SCHEMA_VERSION;
}

export interface SyntheticStagingAggregate {
  readonly syntheticSessionId: string;
  readonly dataClassification: typeof SYNTHETIC_STAGING_DATA_CLASSIFICATION;
  readonly lifecycle: LifecycleSession;
  readonly controlEpoch: number;
  readonly releaseIds: SyntheticStagingReleaseIds;
  readonly expiresAt: string;
  readonly processedCommandIds: readonly string[];
  readonly coarseTechnicalStatus: "READY" | "ACTIVE" | "TERMINAL";
}

export interface SyntheticStagingCommand {
  readonly kind: SyntheticStagingCommandKind;
}

export interface SyntheticStagingCommandEnvelope extends CommandEnvelope<SyntheticStagingCommand> {
  readonly role: SyntheticStagingRole;
}

export interface SyntheticStagingCommandResult {
  readonly aggregate: SyntheticStagingAggregate;
  readonly outcome: CommandOutcome;
  readonly denialClass: string | undefined;
}

const CHILD_COMMANDS = new Set<SyntheticStagingCommandKind>([
  "REQUEST_HELP",
  "ENTER_WAIT",
  "PAUSE",
  "STOP",
  "RECONNECT",
]);

const ADULT_COMMANDS = new Set<SyntheticStagingCommandKind>([
  "ACTIVATE",
  "RESUME",
  "PAUSE",
  "STOP",
  "RECONNECT",
  "COMPLETE",
]);

function statusFor(lifecycle: LifecycleSession): SyntheticStagingAggregate["coarseTechnicalStatus"] {
  if (["STOPPED", "DELETED", "COMPLETED"].includes(lifecycle.state)) return "TERMINAL";
  return lifecycle.state === "READY" ? "READY" : "ACTIVE";
}

function lifecycleEvent(kind: SyntheticStagingCommandKind, at: string): LifecycleEvent {
  return { kind, at } as LifecycleEvent;
}

export function createSyntheticStagingAggregate(input: {
  readonly syntheticSessionId: string;
  readonly locale: Locale;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly controlEpoch: number;
  readonly releaseIds: SyntheticStagingReleaseIds;
}): SyntheticStagingAggregate {
  const initial = createNotCreatedLifecycle({
    sessionId: input.syntheticSessionId,
    locale: input.locale,
    at: input.issuedAt,
  });
  const creating = transitionLifecycle(initial, { kind: "CREATE", at: input.issuedAt });
  if (!creating.accepted) throw new Error("synthetic staging CREATE invariant failed");
  const ready = transitionLifecycle(creating.state, { kind: "CREATED", at: input.issuedAt });
  if (!ready.accepted) throw new Error("synthetic staging CREATED invariant failed");
  return {
    syntheticSessionId: input.syntheticSessionId,
    dataClassification: SYNTHETIC_STAGING_DATA_CLASSIFICATION,
    lifecycle: ready.state,
    controlEpoch: input.controlEpoch,
    releaseIds: input.releaseIds,
    expiresAt: input.expiresAt,
    processedCommandIds: [],
    coarseTechnicalStatus: "READY",
  };
}

export function applySyntheticStagingCommand(
  aggregate: SyntheticStagingAggregate,
  envelope: SyntheticStagingCommandEnvelope,
  now: string,
): SyntheticStagingCommandResult {
  if (Date.parse(aggregate.expiresAt) <= Date.parse(now)) {
    return { aggregate, outcome: "DOMAIN_REJECTED", denialClass: "SESSION_EXPIRED" };
  }
  const allowed = envelope.role === "CHILD" ? CHILD_COMMANDS : ADULT_COMMANDS;
  if (!allowed.has(envelope.command.kind)) {
    return { aggregate, outcome: "DOMAIN_REJECTED", denialClass: "ROLE_COMMAND_DENIED" };
  }
  const preflight = preflightCommand({
    version: aggregate.lifecycle.version,
    authorityGeneration: aggregate.lifecycle.authorityGeneration,
    processedCommandIds: new Set(aggregate.processedCommandIds),
  }, envelope, now);
  if (preflight.outcome !== undefined) {
    return { aggregate, outcome: preflight.outcome, denialClass: preflight.outcome };
  }
  const transitioned = transitionLifecycle(
    aggregate.lifecycle,
    lifecycleEvent(envelope.command.kind, now),
  );
  if (!transitioned.accepted) {
    return {
      aggregate,
      outcome: "DOMAIN_REJECTED",
      denialClass: transitioned.error?.code ?? "DOMAIN_REJECTED",
    };
  }
  return {
    aggregate: {
      ...aggregate,
      lifecycle: transitioned.state,
      processedCommandIds: [...aggregate.processedCommandIds, envelope.commandId],
      coarseTechnicalStatus: statusFor(transitioned.state),
    },
    outcome: "APPLIED",
    denialClass: undefined,
  };
}

export type ChildSyntheticStagingProjection = {
  readonly role: "CHILD";
  readonly terminalStatus: "ACTIVE" | "STOPPED" | "COMPLETED";
  readonly stateVersion: number;
  readonly locale: Locale;
  readonly wait: boolean;
  readonly helpPending: boolean;
  readonly audioStatus: "SILENT";
  readonly canRequestHelp: boolean;
  readonly canPause: boolean;
  readonly canStop: boolean;
};

export type AdultSyntheticStagingProjection = {
  readonly role: "ADULT";
  readonly syntheticSessionId: string;
  readonly terminalStatus: "ACTIVE" | "STOPPED" | "COMPLETED";
  readonly stateVersion: number;
  readonly locale: Locale;
  readonly wait: boolean;
  readonly adultCard: "SYNTHETIC_HELP_REQUESTED" | undefined;
  readonly audioStatus: "SILENT";
  readonly canResume: boolean;
  readonly canPause: boolean;
  readonly canStop: boolean;
};

export type SyntheticStagingProjection =
  | ChildSyntheticStagingProjection
  | AdultSyntheticStagingProjection;

function terminalStatus(
  aggregate: SyntheticStagingAggregate,
): "ACTIVE" | "STOPPED" | "COMPLETED" {
  if (aggregate.lifecycle.state === "STOPPED") return "STOPPED";
  if (aggregate.lifecycle.state === "COMPLETED") return "COMPLETED";
  return "ACTIVE";
}

export function projectSyntheticStaging(
  aggregate: SyntheticStagingAggregate,
  role: "CHILD",
): ChildSyntheticStagingProjection;
export function projectSyntheticStaging(
  aggregate: SyntheticStagingAggregate,
  role: "ADULT",
): AdultSyntheticStagingProjection;
export function projectSyntheticStaging(
  aggregate: SyntheticStagingAggregate,
  role: SyntheticStagingRole,
): SyntheticStagingProjection;
export function projectSyntheticStaging(
  aggregate: SyntheticStagingAggregate,
  role: SyntheticStagingRole,
): SyntheticStagingProjection {
  const terminal = ["STOPPED", "COMPLETED"].includes(aggregate.lifecycle.state);
  if (role === "CHILD") {
    return {
      role,
      terminalStatus: terminalStatus(aggregate),
      stateVersion: aggregate.lifecycle.version,
      locale: aggregate.lifecycle.locale,
      wait: aggregate.lifecycle.state === "WAITING",
      helpPending: aggregate.lifecycle.helpRequested,
      audioStatus: "SILENT",
      canRequestHelp: !terminal && aggregate.lifecycle.state === "ACTIVE",
      canPause: !terminal && ["ACTIVE", "WAITING"].includes(aggregate.lifecycle.state),
      canStop: !terminal,
    };
  }
  return {
    role,
    syntheticSessionId: aggregate.syntheticSessionId,
    terminalStatus: terminalStatus(aggregate),
    stateVersion: aggregate.lifecycle.version,
    locale: aggregate.lifecycle.locale,
    wait: aggregate.lifecycle.state === "WAITING",
    adultCard: aggregate.lifecycle.helpRequested ? "SYNTHETIC_HELP_REQUESTED" : undefined,
    audioStatus: "SILENT",
    canResume: !terminal && ["WAITING", "PAUSED"].includes(aggregate.lifecycle.state),
    canPause: !terminal && ["ACTIVE", "WAITING"].includes(aggregate.lifecycle.state),
    canStop: !terminal,
  };
}

export function deleteSyntheticStagingAggregate(
  aggregate: SyntheticStagingAggregate,
  at: string,
): SyntheticStagingAggregate {
  const deleted = transitionLifecycle(aggregate.lifecycle, { kind: "DELETE", at });
  if (!deleted.accepted) throw new Error(deleted.error?.code ?? "DELETE_REJECTED");
  return {
    ...aggregate,
    lifecycle: deleted.state,
    processedCommandIds: [],
    coarseTechnicalStatus: "TERMINAL",
  };
}
