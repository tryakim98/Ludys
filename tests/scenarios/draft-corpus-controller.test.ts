import assert from "node:assert/strict";
import test from "node:test";
import { DraftCorpusController } from "../../src/application/draft-corpus-controller.js";
import type { ChildAppJourneyView } from "../../src/application/synthetic-app-navigation-controller.js";
import { createSyntheticAppNavigation } from "../../src/composition/create-synthetic-app-navigation.js";
import { wp13_8DraftCorpus } from "../../src/content/corpus/wp13-8-draft-corpus.js";
import type { CorpusLifecyclePolicy } from "../../src/core/draft-learning-corpus.js";

function policy(
  scope: "PATTERN_CLASS" | "ACTIVITY",
  scopeId: string,
  lifecycleStatus: "STALE" | "SUPERSEDED" | "WITHDRAWN",
  policyRevision = 2,
): CorpusLifecyclePolicy {
  return {
    policyRevision,
    restrictions: [{ scope, scopeId, lifecycleStatus }],
    containsPersonData: false,
    resurrectionAllowed: false,
  };
}

test("CHANGES_REQUIRED is blocked in normal mode and selectable in review mode", () => {
  const controller = new DraftCorpusController(wp13_8DraftCorpus, "nb-NO");
  controller.selectPatternClass("NOR-PC-CONSONANT-CLUSTER-001");
  controller.selectActivity("activity-nor-cluster-fisk-vest-002");
  assert.equal(controller.view.selectedActivityId, "activity-nor-cluster-pris-gris-001");
  assert.equal(controller.view.lastBlockReason, "CHANGES_REQUIRED_BLOCKED_IN_NORMAL_MODE");
  assert.equal(controller.view.activities.find(
    (item) => item.activityId === "activity-nor-cluster-fisk-vest-002",
  )?.visible, false);

  controller.setMode("REVIEW");
  controller.selectActivity("activity-nor-cluster-fisk-vest-002");
  assert.equal(controller.view.selectedActivityId, "activity-nor-cluster-fisk-vest-002");
  assert.equal(controller.view.canStartSelected, true);
  assert.equal(controller.view.activities.find(
    (item) => item.activityId === "activity-nor-cluster-fisk-vest-002",
  )?.visible, true);
});

test("target, modelled practice, supported retry and transfer are separate evidence events", () => {
  const controller = new DraftCorpusController(wp13_8DraftCorpus, "nb-NO");
  controller.startSelectedActivity();
  controller.recordSupport("MODEL_REQUIRES_ADULT");
  controller.completeTarget();
  controller.completeTransfer();
  assert.deepEqual(
    controller.view.attempts.map((item) => [item.kind, item.evidence, item.supportLevel]),
    [
      ["TARGET", "INDEPENDENT", "NONE"],
      ["SUPPORTED_RETRY", "MODELLED_PRACTICE", "MODEL_REQUIRES_ADULT"],
      ["SUPPORTED_RETRY", "SUPPORTED_RETRY", "MODEL_REQUIRES_ADULT"],
      ["TRANSFER", "TRANSFER_SEPARATE", "NONE"],
    ],
  );
  assert.equal(controller.view.aggregateScore, undefined);
  assert.equal(controller.view.automaticPlacement, false);
});

test("withdrawn, stale and superseded activities cannot run", () => {
  for (const lifecycleStatus of ["WITHDRAWN", "STALE", "SUPERSEDED"] as const) {
    const controller = new DraftCorpusController(wp13_8DraftCorpus, "nb-NO");
    const activityId = controller.view.selectedActivityId;
    assert.notEqual(activityId, undefined);
    controller.applyRestrictivePolicy(policy("ACTIVITY", activityId ?? "", lifecycleStatus));
    assert.equal(controller.view.runStage, "BLOCKED");
    assert.equal(controller.view.canStartSelected, false);
    controller.startSelectedActivity();
    assert.equal(controller.view.runStage, "BLOCKED");
  }
});

test("class lifecycle dominates activity lifecycle and restrictions cannot resurrect content", () => {
  const controller = new DraftCorpusController(wp13_8DraftCorpus, "nb-NO");
  const activityId = "activity-nor-single-final-ris-sil-001";
  controller.applyRestrictivePolicy(policy("PATTERN_CLASS", "NOR-PC-SINGLE-FINAL-001", "WITHDRAWN", 4));
  assert.equal(
    controller.view.activities.find((item) => item.activityId === activityId)?.lifecycleStatus,
    "WITHDRAWN",
  );
  controller.applyRestrictivePolicy({
    policyRevision: 5,
    restrictions: [],
    containsPersonData: false,
    resurrectionAllowed: false,
  });
  assert.equal(
    controller.view.activities.find((item) => item.activityId === activityId)?.lifecycleStatus,
    "WITHDRAWN",
  );
  controller.selectPatternClass("NOR-PC-DOUBLE-FINAL-001");
  assert.equal(controller.view.runStage, "NOT_STARTED");
  assert.equal(controller.view.selectedActivityId, "activity-nor-double-final-katt-hatt-001");
  assert.equal(controller.view.canStartSelected, true);
});

test("STOP interrupts requested audio specification and pending feedback", () => {
  const controller = new DraftCorpusController(wp13_8DraftCorpus, "nb-NO");
  controller.startSelectedActivity();
  controller.requestAudioSpecification();
  assert.equal(controller.view.audioState, "SPEC_REQUESTED");
  assert.equal(controller.view.pendingFeedback, true);
  controller.stop();
  assert.equal(controller.view.runStage, "STOPPED");
  assert.equal(controller.view.audioState, "STOPPED");
  assert.equal(controller.view.pendingFeedback, false);
});

test("every normal-mode eligible activity completes in both BM and NN", () => {
  for (const locale of ["nb-NO", "nn-NO"] as const) {
    for (const activity of wp13_8DraftCorpus.activities) {
      const variant = activity.variants[locale];
      if (variant.internalReviewDecision === "CHANGES_REQUIRED") continue;
      const controller = new DraftCorpusController(wp13_8DraftCorpus, locale);
      controller.selectPatternClass(activity.patternClassId);
      controller.selectActivity(activity.activityId);
      controller.startSelectedActivity();
      controller.completeTarget();
      controller.completeTransfer();
      assert.equal(controller.view.runStage, "COMPLETED", `${activity.activityId}:${locale}`);
    }
  }
});

test("every eligible activity completes through the authoritative app session in BM and NN", () => {
  for (const locale of ["nb-NO", "nn-NO"] as const) {
    for (const activity of wp13_8DraftCorpus.activities) {
      if (activity.variants[locale].internalReviewDecision === "CHANGES_REQUIRED") continue;
      const { controller } = createSyntheticAppNavigation(locale, `${locale}-${activity.activityId}`);
      controller.createSession();
      controller.selectRole("CHILD");
      controller.finishLoading();
      controller.selectPatternClass(activity.patternClassId);
      controller.selectCorpusActivity(activity.activityId);
      controller.startActivity();
      for (const tile of (controller.view as ChildAppJourneyView).tiles) controller.selectTile(tile.tileId);
      controller.submitBuild();
      controller.selectRole("ADULT");
      controller.confirmReading();
      controller.selectRole("CHILD");
      for (const tile of (controller.view as ChildAppJourneyView).tiles) controller.selectTile(tile.tileId);
      controller.submitBuild();
      controller.selectRole("ADULT");
      controller.confirmReading();
      assert.equal(controller.view.lifecycleState, "COMPLETED", `${activity.activityId}:${locale}`);
      assert.equal(controller.view.corpus.runStage, "COMPLETED", `${activity.activityId}:${locale}`);
    }
  }
});
