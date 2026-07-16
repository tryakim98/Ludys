import test from "node:test";
import assert from "node:assert/strict";
import {
  LIFECYCLE_STATES,
  createNotCreatedLifecycle,
  transitionLifecycle,
  type LifecycleEvent,
  type LifecycleSession,
} from "../../src/core/session-lifecycle.js";

const T0 = "2026-07-16T12:00:00.000Z";

function initial(): LifecycleSession {
  return createNotCreatedLifecycle({
    sessionId: "synthetic-wp13-7a-property-0001",
    locale: "nb-NO",
    at: T0,
  });
}

function advance(state: LifecycleSession, kind: LifecycleEvent["kind"]): LifecycleSession {
  const result = transitionLifecycle(state, { kind, at: T0 });
  assert.equal(result.accepted, true, `${kind} should be accepted from ${state.state}`);
  return result.state;
}

function ready(): LifecycleSession {
  return advance(advance(initial(), "CREATE"), "CREATED");
}

function active(): LifecycleSession {
  return advance(ready(), "ACTIVATE");
}

const eventKinds: readonly LifecycleEvent["kind"][] = [
  "CREATE",
  "CREATED",
  "ACTIVATE",
  "REQUEST_HELP",
  "ENTER_WAIT",
  "RESUME",
  "PAUSE",
  "STOP",
  "DELETE",
  "RECONNECT",
  "DETECT_STALE",
  "DETECT_INVALID",
  "BEGIN_RECOVERY",
  "RECOVERY_SUCCEEDED",
  "RECOVERY_FAILED",
  "COMPLETE",
];

function representativeStates(): readonly LifecycleSession[] {
  const base = initial();
  const creating = advance(base, "CREATE");
  const readyState = advance(creating, "CREATED");
  const activeState = advance(readyState, "ACTIVATE");
  const waiting = advance(activeState, "ENTER_WAIT");
  const paused = advance(activeState, "PAUSE");
  const stopped = advance(activeState, "STOP");
  const deleted = advance(stopped, "DELETE");
  const stale = advance(activeState, "DETECT_STALE");
  const invalid = advance(activeState, "DETECT_INVALID");
  const recovering = advance(stale, "BEGIN_RECOVERY");
  const completed = advance(activeState, "COMPLETE");
  return [base, creating, readyState, activeState, waiting, paused, stopped, deleted, stale, invalid, recovering, completed];
}

test("lifecycle transition is deterministic for every state and event pair", () => {
  for (const state of representativeStates()) {
    for (const kind of eventKinds) {
      const event: LifecycleEvent = { kind, at: T0 };
      assert.deepEqual(
        transitionLifecycle(state, event),
        transitionLifecycle(state, event),
        `${state.state} + ${kind}`,
      );
    }
  }
});

test("all required lifecycle states are reachable through explicit events", () => {
  const reached = new Set(representativeStates().map((state) => state.state));
  assert.deepEqual([...reached].sort(), [...LIFECYCLE_STATES].sort());
});

test("rejected events return a typed visible error and never mutate state", () => {
  for (const state of representativeStates()) {
    for (const kind of eventKinds) {
      const result = transitionLifecycle(state, { kind, at: T0 });
      if (result.accepted) continue;
      assert.equal(result.state, state, `${state.state} + ${kind} must retain object identity`);
      assert.ok(result.error);
      assert.equal(result.error.from, state.state);
      assert.equal(result.error.event, kind);
    }
  }
});

test("STOPPED cannot become ACTIVE again", () => {
  const stopped = advance(active(), "STOP");
  for (const kind of ["ACTIVATE", "RESUME", "BEGIN_RECOVERY", "RECOVERY_SUCCEEDED"] as const) {
    const result = transitionLifecycle(stopped, { kind, at: T0 });
    assert.equal(result.accepted, false);
    assert.equal(result.state.state, "STOPPED");
    assert.equal(result.error?.code, "NO_RESURRECTION");
  }
});

test("DELETED rejects every event and can never be revived", () => {
  const deleted = advance(advance(active(), "STOP"), "DELETE");
  for (const kind of eventKinds) {
    const result = transitionLifecycle(deleted, { kind, at: T0 });
    assert.equal(result.accepted, false, kind);
    assert.equal(result.state.state, "DELETED");
    assert.ok(["NO_RESURRECTION", "TOMBSTONE"].includes(result.error?.code ?? ""));
  }
});

test("recovery cannot bypass terminal dominance", () => {
  let state = advance(active(), "DETECT_STALE");
  state = advance(state, "BEGIN_RECOVERY");
  state = advance(state, "STOP");
  const recovery = transitionLifecycle(state, { kind: "RECOVERY_SUCCEEDED", at: T0 });
  assert.equal(recovery.accepted, false);
  assert.equal(recovery.state.state, "STOPPED");
  assert.equal(recovery.error?.code, "NO_RESURRECTION");
});

test("pause and WAIT retain explicit deterministic resume semantics", () => {
  const waiting = advance(active(), "REQUEST_HELP");
  assert.equal(waiting.state, "WAITING");
  assert.equal(waiting.helpRequested, true);
  const paused = advance(waiting, "PAUSE");
  assert.equal(paused.resumeTarget, "WAITING");
  const resumedWait = advance(paused, "RESUME");
  assert.equal(resumedWait.state, "WAITING");
  const resumedActive = advance(resumedWait, "RESUME");
  assert.equal(resumedActive.state, "ACTIVE");
  assert.equal(resumedActive.helpRequested, false);
});
