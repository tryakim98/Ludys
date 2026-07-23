import assert from "node:assert/strict";
import test from "node:test";
import { wp13_11OperationsKit } from "../../src/content/operations/wp13-11-operations-kit.js";
import {
  ALLOWED_METRIC_IDS,
  FORBIDDEN_METRIC_IDS,
  OPERATIONS_ARTIFACT_TYPES,
  PARTICIPANT_DRAFT_TYPES,
  validateOperationsKit,
} from "../../src/core/beta-operations.js";

test("WP13.11 has exactly 27 semantic artifacts and 54 first-class language artifacts", () => {
  const result = validateOperationsKit(wp13_11OperationsKit);
  assert.deepEqual(result.errors, []);
  assert.equal(result.semanticArtifactCount, 27);
  assert.equal(result.languageArtifactCount, 54);
  assert.deepEqual(
    [...new Set(wp13_11OperationsKit.artifacts.map((artifact) => artifact.artifactType))].sort(),
    [...OPERATIONS_ARTIFACT_TYPES].sort(),
  );
  for (const type of OPERATIONS_ARTIFACT_TYPES) {
    const variants = wp13_11OperationsKit.artifacts.filter((artifact) => artifact.artifactType === type);
    assert.deepEqual(variants.map((artifact) => artifact.locale).sort(), ["nb", "nn"]);
    assert.notEqual(variants[0]?.artifactId, variants[1]?.artifactId);
  }
});

test("every artifact exposes the complete review and withdrawal contract", () => {
  for (const artifact of wp13_11OperationsKit.artifacts) {
    assert.ok(artifact.artifactId.length > 10);
    assert.ok(artifact.title.length > 3);
    assert.ok(artifact.purpose.length > 10);
    assert.ok(artifact.audience.length > 0);
    assert.equal(artifact.reviewStatus, "REVIEW_REQUIRED");
    assert.ok(artifact.contentSections.length >= 2);
    assert.ok(artifact.sourceReferences.length >= 2);
    assert.equal(artifact.amendmentHistory[0]?.externalReceipt, false);
    assert.equal(artifact.withdrawalStatus, "CURRENT");
  }
});

test("participant-directed drafts are permanently explicit and unauthorized", () => {
  for (const type of PARTICIPANT_DRAFT_TYPES) {
    for (const artifact of wp13_11OperationsKit.artifacts.filter((item) => item.artifactType === type)) {
      assert.equal(artifact.status, "DRAFT_NOT_AUTHORIZED_FOR_STUDENT_USE");
      assert.equal(artifact.authorizationStatus, "NOT_AUTHORIZED_FOR_STUDENT_USE");
      assert.ok(artifact.prohibitedUse.includes("NOT_VALID_CONSENT"));
      assert.ok(artifact.prohibitedUse.includes("NOT_VALID_ASSENT"));
      assert.ok(artifact.prohibitedUse.includes("NOT_DPIA"));
      assert.ok(artifact.prohibitedUse.includes("NO_STUDENT_CONTACT_AUTHORITY"));
      assert.ok(artifact.prohibitedUse.includes("NO_PILOT_START_AUTHORITY"));
    }
  }
});

test("measurement and data boundaries are exhaustive and non-personal", () => {
  assert.deepEqual(wp13_11OperationsKit.metrics.map((metric) => metric.metricId).sort(), [...ALLOWED_METRIC_IDS].sort());
  assert.deepEqual(wp13_11OperationsKit.forbiddenMetrics.map((metric) => metric.metricId).sort(), [...FORBIDDEN_METRIC_IDS].sort());
  assert.ok(wp13_11OperationsKit.forbiddenMetrics.every((metric) => metric.status === "NOT_COLLECTED" && metric.technicallyBlocked));
  assert.ok(wp13_11OperationsKit.dataInventory.every((entry) => !entry.personalData && !entry.studentData));
  assert.ok(wp13_11OperationsKit.dataInventory.filter((entry) => entry.status === "PROHIBITED")
    .every((entry) => !entry.authorized && entry.storageLocation === "NOWHERE" && !entry.exported));
});

test("authorization remains at the adult-only maximum", () => {
  const status = wp13_11OperationsKit.authorization;
  assert.equal(status.operationsKit, "READY_FOR_ADULT_ONLY_DRY_RUN");
  assert.equal(status.externalReceipts, 0);
  assert.equal(status.b8, "NOT_DECISION_READY");
  assert.equal(status.studentBetaAuthorized, false);
  assert.equal(status.recruitmentAuthorized, false);
  assert.equal(status.providerActivation, false);
  assert.equal(status.productionAuthorized, false);
  assert.equal(status.runtimeAiPresent, false);
});
