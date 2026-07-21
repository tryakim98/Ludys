import assert from "node:assert/strict";
import test from "node:test";
import {
  assessB8Readiness,
  type B8ReadinessDossier,
  type EvidenceRequirement,
} from "../../src/core/b8-readiness.js";
import { b8ReadinessDossier } from "../../src/content/prototype/b8-readiness-dossier.js";

function withRequirements(
  dossier: B8ReadinessDossier,
  requirements: readonly EvidenceRequirement[],
): B8ReadinessDossier {
  return { ...dossier, requirements };
}

test("current WP13.4 dossier is not decision-ready and authorizes nothing", () => {
  const assessment = assessB8Readiness(b8ReadinessDossier);
  assert.equal(assessment.decision, "NOT_DECISION_READY");
  assert.equal(assessment.ownerMayConsiderB8, false);
  assert.equal(assessment.recruitmentAuthorized, false);
  assert.equal(assessment.realDataAuthorized, false);
  assert.equal(assessment.pilotAuthorized, false);
  assert.ok(assessment.blockersBeforeDecision.includes("B8-PRIV-01"));
  assert.ok(assessment.blockersBeforeDecision.includes("B8-A11Y-02"));
  assert.ok(assessment.blockersBeforeDecision.includes("B8-LRN-01"));
});

test("all decision requirements can only make dossier decision-ready for owner", () => {
  const satisfied = b8ReadinessDossier.requirements.map((requirement) => ({
    ...requirement,
    status: requirement.acceptedStatuses[0] ?? requirement.status,
  })) as EvidenceRequirement[];
  const assessment = assessB8Readiness(withRequirements(b8ReadinessDossier, satisfied));
  assert.equal(assessment.decision, "DECISION_READY_FOR_OWNER");
  assert.equal(assessment.ownerMayConsiderB8, true);
  assert.equal(assessment.recruitmentAuthorized, false);
  assert.equal(assessment.realDataAuthorized, false);
  assert.equal(assessment.pilotAuthorized, false);
});

test("triggered reopen signal dominates otherwise satisfied evidence", () => {
  const satisfied = b8ReadinessDossier.requirements.map((requirement) => ({
    ...requirement,
    status: requirement.acceptedStatuses[0] ?? requirement.status,
  })) as EvidenceRequirement[];
  const dossier: B8ReadinessDossier = {
    ...withRequirements(b8ReadinessDossier, satisfied),
    reopenSignals: b8ReadinessDossier.reopenSignals.map((signal, index) => ({
      ...signal,
      triggered: index === 0,
    })),
  };
  const assessment = assessB8Readiness(dossier);
  assert.equal(assessment.decision, "REOPEN_REQUIRED");
  assert.equal(assessment.ownerMayConsiderB8, false);
  assert.deepEqual(assessment.triggeredReopenSignals, ["B8-REOPEN-01"]);
});

test("duplicate requirement ids are rejected", () => {
  const first = b8ReadinessDossier.requirements[0];
  assert.ok(first);
  const dossier = withRequirements(b8ReadinessDossier, [first, first]);
  assert.throws(() => assessB8Readiness(dossier), /duplicate evidence requirement/);
});
