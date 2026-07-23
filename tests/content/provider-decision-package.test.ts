import assert from "node:assert/strict";
import test from "node:test";
import { wp13_12aProviderDecisionPackage as decision } from "../../src/content/provider-decision/wp13-12a-decision-package.js";
import {
  REQUIRED_CAPABILITY_OPTIONS,
  REQUIRED_NO_GO,
  REQUIRED_PROHIBITED_DATA,
  REQUIRED_PROVIDER_OPTIONS,
  REQUIRED_THREATS,
  REQUIRED_TRUST_BOUNDARIES,
  validateProviderDecisionPackage,
} from "../../src/core/provider-decision.js";

test("WP13.12A evaluates exactly the five mandatory provider options", () => {
  assert.deepEqual(decision.providerOptions.map((item) => item.optionId).sort(), [...REQUIRED_PROVIDER_OPTIONS].sort());
  assert.equal(decision.providerOptions.filter((item) => item.status === "RECOMMENDED").length, 1);
  assert.equal(decision.recommendedOptionId, "FIREBASE_CAPABILITY");
});

test("recommendation is source-grounded but remains an unselected technical recommendation", () => {
  const recommended = decision.providerOptions.find((item) => item.optionId === decision.recommendedOptionId);
  assert.ok(recommended);
  assert.ok(recommended.sourceIds.length >= 8);
  assert.equal(decision.authorization.ownerDecision, "PENDING_OWNER_ACTION");
  assert.equal(decision.authorization.providerActivation, "BLOCKED");
  assert.equal(decision.authorization.cloudResources, 0);
});

test("region analysis re-verifies a co-located europe-north1 candidate without locking it", () => {
  const row = decision.regionAnalysis.find((item) => item.regionId === "europe-north1");
  assert.ok(row);
  assert.equal(row.colocated, true);
  assert.equal(row.immutableAfterProvisioning, true);
  assert.equal(decision.regionLockNotExecuted, true);
});

test("all capability models are explicit and the recommendation creates no account identity", () => {
  assert.deepEqual(decision.capabilityOptions.map((item) => item.capabilityOptionId).sort(), [...REQUIRED_CAPABILITY_OPTIONS].sort());
  assert.equal(decision.recommendedCapabilityOptionId, "FUNCTION_ISSUED_SHORT_LIVED_SESSION_CAPABILITY");
  const selected = decision.capabilityOptions.find((item) => item.capabilityOptionId === decision.recommendedCapabilityOptionId);
  assert.equal(selected?.persistentIdentity, false);
  assert.equal(selected?.crossSessionIdentity, false);
});

test("dataflow and trust boundaries are complete and provider-free pure core remains explicit", () => {
  assert.equal(decision.dataflow.length, 8);
  assert.deepEqual(decision.trustBoundaries.map((item) => item.boundaryId).sort(), [...REQUIRED_TRUST_BOUNDARIES].sort());
  assert.ok(decision.dataflow.some((item) => item.stepId === "PURE_CORE" && /provider-free/.test(item.authority)));
});

test("all prohibited data classes are NOT_COLLECTED and NOT_AUTHORIZED", () => {
  const prohibited = decision.dataClasses.filter((item) => item.status === "NOT_COLLECTED");
  assert.deepEqual(prohibited.map((item) => item.dataClass).sort(), [...REQUIRED_PROHIBITED_DATA].sort());
  assert.ok(prohibited.every((item) => item.authorization === "NOT_AUTHORIZED" && item.storage === "NOWHERE"));
});

test("threat and no-go registers are exhaustive", () => {
  assert.deepEqual(decision.threats.map((item) => item.threatId).sort(), [...REQUIRED_THREATS].sort());
  assert.deepEqual(decision.noGo.map((item) => item.noGoId).sort(), [...REQUIRED_NO_GO].sort());
  assert.ok(decision.threats.some((item) => item.blocksActivation));
});

test("BM and NN are separate complete review-required bundles without fallback", () => {
  assert.deepEqual(decision.localeBundles.map((item) => item.locale), ["nb", "nn"]);
  assert.ok(decision.localeBundles.every((item) => item.humanReviewStatus === "REVIEW_REQUIRED"));
  assert.notEqual(decision.localeBundles[0]?.title, decision.localeBundles[1]?.title);
  assert.equal(validateProviderDecisionPackage(decision).valid, true);
});

test("all official sources are current primary URLs with explicit decision limits", () => {
  assert.equal(decision.officialSources.length, 28);
  assert.ok(decision.officialSources.every((item) => item.checkedAt === "2026-07-23"));
  assert.ok(decision.officialSources.every((item) => item.officialUrl.startsWith("https://")));
  assert.ok(decision.officialSources.every((item) => item.cannotDecide.length >= 3));
});

test("STOP, explicit deletion and no-resurrection dominate TTL and backup", () => {
  assert.equal(decision.retentionDeletion.stopDominatesAllPendingActions, true);
  assert.equal(decision.retentionDeletion.explicitDeletionDominatesTtl, true);
  assert.equal(decision.retentionDeletion.deletedSessionCannotResurrect, true);
  assert.equal(decision.retentionDeletion.ttlIsImmediateDeletion, false);
  assert.match(decision.retentionDeletion.backupsAndPitr.join(" "), /disabled/);
});
