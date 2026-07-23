import assert from "node:assert/strict";
import test from "node:test";
import { wp13_11LocalReleaseState } from "../../src/content/prototype/wp13-11-release-state.js";
import {
  rollbackComponent,
  validateLocalReleaseState,
  type ReleaseComponent,
} from "../../src/core/release-hardening.js";

const AT = "2026-07-22T12:00:00.000Z";

test("app, content, knowledge, audio and operations rollback independently with append-only history", () => {
  let state = wp13_11LocalReleaseState;
  const targets: Readonly<Record<ReleaseComponent, string>> = {
    APP: "0.14.0-reconstructed.6",
    CONTENT: "wp13-8-authentic-draft-corpus-r0",
    KNOWLEDGE: "release-knowledge-audio-prototype-000",
    AUDIO: "TEXT_AND_SILENCE",
    OPERATIONS: "wp13-11-operations-kit-r0",
  };
  for (const component of ["APP", "CONTENT", "KNOWLEDGE", "AUDIO", "OPERATIONS"] as const) {
    const before = state.active;
    const result = rollbackComponent(state, component, targets[component], AT);
    assert.equal(result.accepted, true);
    if (!result.accepted) continue;
    state = result.state;
    for (const other of ["APP", "CONTENT", "KNOWLEDGE", "AUDIO", "OPERATIONS"] as const) {
      if (other === component) continue;
      const fields = { APP: "appVersion", CONTENT: "contentReleaseId", KNOWLEDGE: "knowledgeReleaseId", AUDIO: "audioReleaseId", OPERATIONS: "operationsReleaseId" } as const;
      const field = fields[other];
      assert.equal(state.active[field], before[field]);
    }
    assert.deepEqual(validateLocalReleaseState(state), []);
  }
  assert.deepEqual(state.history.map((item) => item.sequence), [1, 2, 3, 4, 5]);
});

test("withdrawn, unknown, incompatible and no-op rollback fail closed", () => {
  function rejectedReason(result: ReturnType<typeof rollbackComponent>): string {
    assert.equal(result.accepted, false);
    return result.accepted ? "unexpected" : result.reason;
  }
  assert.equal(rejectedReason(rollbackComponent(wp13_11LocalReleaseState, "CONTENT", "wp13-8-withdrawn-content-proof", AT)), "WITHDRAWN_REVISION");
  assert.equal(rejectedReason(rollbackComponent(wp13_11LocalReleaseState, "AUDIO", "wp13-9-withdrawn-audio-proof", AT)), "WITHDRAWN_REVISION");
  assert.equal(rejectedReason(rollbackComponent(wp13_11LocalReleaseState, "OPERATIONS", "wp13-11-operations-kit-withdrawn-proof", AT)), "WITHDRAWN_REVISION");
  assert.equal(rejectedReason(rollbackComponent(wp13_11LocalReleaseState, "APP", "unknown", AT)), "UNKNOWN_REVISION");
  assert.equal(rejectedReason(rollbackComponent(wp13_11LocalReleaseState, "APP", wp13_11LocalReleaseState.active.appVersion, AT)), "NO_CHANGE");
  const incompatible = {
    ...wp13_11LocalReleaseState,
    catalog: [...wp13_11LocalReleaseState.catalog, {
      component: "APP" as const,
      revisionId: "incompatible",
      schemaVersion: "old" as never,
      lifecycle: "AVAILABLE" as const,
      sha256: "c".repeat(64),
    }],
  };
  assert.equal(rejectedReason(rollbackComponent(incompatible, "APP", "incompatible", AT)), "INCOMPATIBLE_SCHEMA");
});
