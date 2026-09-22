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
];
export const SYNTHETIC_DATA_CLASSIFICATION = "SYNTHETIC_TECHNICAL_DRAFT";
export function createNotCreatedLifecycle(input) {
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
function reject(state, event, code = "INVALID_TRANSITION") {
    return {
        state,
        accepted: false,
        error: { code, from: state.state, event: event.kind },
    };
}
function accept(state, event, patch) {
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
function canDetectProblem(state) {
    return ["READY", "ACTIVE", "WAITING", "PAUSED"].includes(state);
}
export function transitionLifecycle(state, event) {
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
