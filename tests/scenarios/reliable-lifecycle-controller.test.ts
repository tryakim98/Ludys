import assert from "node:assert/strict";
import test from "node:test";
import { createSessionLifecycleProof } from "../../src/composition/create-session-lifecycle-proof.js";
import type { LifecycleCommandEnvelope } from "../../src/core/reliability-hardening.js";

const NOW = "2026-07-16T12:00:00.000Z";

test("authoritative lifecycle controller enforces envelope idempotency, version, authority and time", () => {
  const { controller } = createSessionLifecycleProof("nb-NO");
  const create: LifecycleCommandEnvelope = {
    commandId: "lifecycle-create",
    expectedVersion: 0,
    authorityGeneration: 1,
    issuedAt: NOW,
    command: { kind: "CREATE", at: NOW },
  };
  assert.equal(controller.performEnvelope(create).outcome, "APPLIED");
  const afterCreate = controller.selectRole("ADULT");
  assert.equal(afterCreate.role, "ADULT");
  if (afterCreate.role !== "ADULT") throw new Error("adult projection required");
  assert.equal(afterCreate.observedVersion, 1);

  assert.equal(controller.performEnvelope(create).outcome, "DUPLICATE_COMMAND");
  assert.equal(controller.performEnvelope({ ...create, commandId: "stale-version", command: { kind: "CREATED", at: NOW } }).outcome, "STALE_VERSION");
  assert.equal(controller.performEnvelope({ ...create, commandId: "stale-authority", expectedVersion: 1, authorityGeneration: 0, command: { kind: "CREATED", at: NOW } }).outcome, "STALE_AUTHORITY");
  assert.equal(controller.performEnvelope({ ...create, commandId: "delayed", expectedVersion: 1, issuedAt: "2026-07-16T10:00:00.000Z", command: { kind: "CREATED", at: NOW } }).outcome, "DELAYED_COMMAND");
  const afterRejected = controller.selectRole("ADULT");
  assert.equal(afterRejected.role, "ADULT");
  if (afterRejected.role !== "ADULT") throw new Error("adult projection required");
  assert.equal(afterRejected.observedVersion, 1);
});

test("stale authority cannot cross STOP and delayed commands cannot resurrect", () => {
  const { controller } = createSessionLifecycleProof("nb-NO");
  for (const action of ["CREATE", "CREATED", "ACTIVATE", "STOP"] as const) controller.perform(action);
  const stopped = controller.selectRole("ADULT");
  assert.equal(stopped.role, "ADULT");
  if (stopped.role !== "ADULT") throw new Error("adult projection required");
  assert.equal(stopped.state, "STOPPED");
  const result = controller.performEnvelope({
    commandId: "late-resume",
    expectedVersion: stopped.observedVersion,
    authorityGeneration: 1,
    issuedAt: NOW,
    command: { kind: "RESUME", at: NOW },
  });
  assert.equal(result.outcome, "STALE_AUTHORITY");
  assert.equal(result.view.state, "STOPPED");
});
