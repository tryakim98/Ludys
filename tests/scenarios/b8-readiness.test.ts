import assert from "node:assert/strict";
import test from "node:test";
import { createB8ReadinessController } from "../../src/composition/create-b8-readiness.js";

test("B8 readiness view starts with all gates and no implicit authorization", () => {
  const controller = createB8ReadinessController();
  const snapshot = controller.snapshot;
  assert.equal(snapshot.selectedGate, "ALL");
  assert.equal(snapshot.visibleRequirements.length, snapshot.dossier.requirements.length);
  assert.equal(snapshot.assessment.decision, "NOT_DECISION_READY");
  assert.equal(snapshot.assessment.pilotAuthorized, false);
});

test("gate selection changes projection without changing the dossier", () => {
  const controller = createB8ReadinessController();
  const total = controller.snapshot.dossier.requirements.length;
  controller.selectGate("HUMAN_FIRST");
  assert.ok(controller.snapshot.visibleRequirements.length > 0);
  assert.ok(controller.snapshot.visibleRequirements.length < total);
  assert.ok(
    controller.snapshot.visibleRequirements.every(
      (requirement) => requirement.gateId === "HUMAN_FIRST",
    ),
  );
  assert.equal(controller.snapshot.dossier.requirements.length, total);
});
