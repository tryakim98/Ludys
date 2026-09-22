import assert from "node:assert/strict";
import test from "node:test";
import { wp13_12aLocalReleaseState } from "../../src/content/prototype/wp13-12a-release-state.js";
import {
  rollbackComponent,
  validateLocalReleaseState,
  type ReleaseComponent,
} from "../../src/core/release-hardening.js";

const AT = "2026-07-22T12:00:00.000Z";

test("app, content, knowledge, audio, operations and provider decision rollback independently", () => {
  let state = wp13_12aLocalReleaseState;
  const targets: Readonly<Record<ReleaseComponent, string>> = {
    APP: "0.14.0-reconstructed.6",
    CONTENT: "wp13-8-authentic-draft-corpus-r0",
    KNOWLEDGE: "release-knowledge-audio-prototype-000",
    AUDIO: "TEXT_AND_SILENCE",
    OPERATIONS: "wp13-11-operations-kit-r0",
    PROVIDER_DECISION: "wp13-12a-provider-decision-r0",
  };
  for (const component of ["APP", "CONTENT", "KNOWLEDGE", "AUDIO", "OPERATIONS", "PROVIDER_DECISION"] as const) {
    const before = state.active;
    const result = rollbackComponent(state, component, targets[component], AT);
    assert.equal(result.accepted, true);
    if (!result.accepted) continue;
    state = result.state;
    for (const other of ["APP", "CONTENT", "KNOWLEDGE", "AUDIO", "OPERATIONS", "PROVIDER_DECISION"] as const) {
      if (other === component) continue;
      const fields = { APP: "appVersion", CONTENT: "contentReleaseId", KNOWLEDGE: "knowledgeReleaseId", AUDIO: "audioReleaseId", OPERATIONS: "operationsReleaseId", PROVIDER_DECISION: "providerDecisionReleaseId" } as const;
      const field = fields[other];
      assert.equal(state.active[field], before[field]);
    }
    assert.deepEqual(validateLocalReleaseState(state), []);
  }
  assert.deepEqual(state.history.map((item) => item.sequence), [1, 2, 3, 4, 5, 6]);
});

test("withdrawn, unknown, incompatible and no-op rollback fail closed", () => {
  function rejectedReason(result: ReturnType<typeof rollbackComponent>): string {
    assert.equal(result.accepted, false);
    return result.accepted ? "unexpected" : result.reason;
  }
  assert.equal(rejectedReason(rollbackComponent(wp13_12aLocalReleaseState, "CONTENT", "wp13-8-withdrawn-content-proof", AT)), "WITHDRAWN_REVISION");
  assert.equal(rejectedReason(rollbackComponent(wp13_12aLocalReleaseState, "AUDIO", "wp13-9-withdrawn-audio-proof", AT)), "WITHDRAWN_REVISION");
  assert.equal(rejectedReason(rollbackComponent(wp13_12aLocalReleaseState, "OPERATIONS", "wp13-11-operations-kit-withdrawn-proof", AT)), "WITHDRAWN_REVISION");
  assert.equal(rejectedReason(rollbackComponent(wp13_12aLocalReleaseState, "PROVIDER_DECISION", "wp13-12a-provider-decision-withdrawn-proof", AT)), "WITHDRAWN_REVISION");
  assert.equal(rejectedReason(rollbackComponent(wp13_12aLocalReleaseState, "APP", "unknown", AT)), "UNKNOWN_REVISION");
  assert.equal(rejectedReason(rollbackComponent(wp13_12aLocalReleaseState, "APP", wp13_12aLocalReleaseState.active.appVersion, AT)), "NO_CHANGE");
  const incompatible = {
    ...wp13_12aLocalReleaseState,
    catalog: [...wp13_12aLocalReleaseState.catalog, {
      component: "APP" as const,
      revisionId: "incompatible",
      schemaVersion: "old" as never,
      lifecycle: "AVAILABLE" as const,
      sha256: "c".repeat(64),
    }],
  };
  assert.equal(rejectedReason(rollbackComponent(incompatible, "APP", "incompatible", AT)), "INCOMPATIBLE_SCHEMA");
});
