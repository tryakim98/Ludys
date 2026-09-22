import { createNotCreatedLifecycle, transitionLifecycle, } from "./session-lifecycle.js";
import { preflightCommand, } from "./reliability-hardening.js";
export const SYNTHETIC_STAGING_SCHEMA_VERSION = "wp13.12b-synthetic-staging-v1";
export const SYNTHETIC_STAGING_RELEASE_ID = "wp13-12b-synthetic-staging-provider-r1";
export const SYNTHETIC_STAGING_DATA_CLASSIFICATION = "SYNTHETIC_ONLY_NO_PARTICIPANT_DATA";
const CHILD_COMMANDS = new Set([
    "REQUEST_HELP",
    "ENTER_WAIT",
    "PAUSE",
    "STOP",
    "RECONNECT",
]);
const ADULT_COMMANDS = new Set([
    "ACTIVATE",
    "RESUME",
    "PAUSE",
    "STOP",
    "RECONNECT",
    "COMPLETE",
]);
function statusFor(lifecycle) {
    if (["STOPPED", "DELETED", "COMPLETED"].includes(lifecycle.state))
        return "TERMINAL";
    return lifecycle.state === "READY" ? "READY" : "ACTIVE";
}
function lifecycleEvent(kind, at) {
    return { kind, at };
}
export function createSyntheticStagingAggregate(input) {
    const initial = createNotCreatedLifecycle({
        sessionId: input.syntheticSessionId,
        locale: input.locale,
        at: input.issuedAt,
    });
    const creating = transitionLifecycle(initial, { kind: "CREATE", at: input.issuedAt });
    if (!creating.accepted)
        throw new Error("synthetic staging CREATE invariant failed");
    const ready = transitionLifecycle(creating.state, { kind: "CREATED", at: input.issuedAt });
    if (!ready.accepted)
        throw new Error("synthetic staging CREATED invariant failed");
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
export function applySyntheticStagingCommand(aggregate, envelope, now) {
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
    const transitioned = transitionLifecycle(aggregate.lifecycle, lifecycleEvent(envelope.command.kind, now));
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
function terminalStatus(aggregate) {
    if (aggregate.lifecycle.state === "STOPPED")
        return "STOPPED";
    if (aggregate.lifecycle.state === "COMPLETED")
        return "COMPLETED";
    return "ACTIVE";
}
export function projectSyntheticStaging(aggregate, role) {
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
export function deleteSyntheticStagingAggregate(aggregate, at) {
    const deleted = transitionLifecycle(aggregate.lifecycle, { kind: "DELETE", at });
    if (!deleted.accepted)
        throw new Error(deleted.error?.code ?? "DELETE_REJECTED");
    return {
        ...aggregate,
        lifecycle: deleted.state,
        processedCommandIds: [],
        coarseTechnicalStatus: "TERMINAL",
    };
}
