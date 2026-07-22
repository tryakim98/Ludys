import assert from "node:assert/strict";
import test from "node:test";
import { wp13_8DraftCorpus } from "../../src/content/corpus/wp13-8-draft-corpus.js";
import {
  getDraftActivityVariant,
  validateDraftLearningCorpus,
} from "../../src/core/draft-learning-corpus.js";

test("WP13.8 corpus has exactly four classes, eight activities and two per class", () => {
  assert.equal(wp13_8DraftCorpus.patternClasses.length, 4);
  assert.equal(wp13_8DraftCorpus.activities.length, 8);
  for (const patternClass of wp13_8DraftCorpus.patternClasses) {
    assert.equal(
      wp13_8DraftCorpus.activities.filter(
        (activity) => activity.patternClassId === patternClass.patternClassId,
      ).length,
      2,
    );
    assert.equal(patternClass.frameworkBoundary, "NORWEGIAN_ORTHOGRAPHIC_REVIEW_NOT_IMPORTED_CVC");
  }
});

test("all activity IDs and fixed stimulus pairs remain unchanged", () => {
  const inventory = wp13_8DraftCorpus.activities.map((activity) => {
    const variant = activity.variants["nb-NO"];
    return [activity.activityId, activity.patternClassId, variant.targetStimulus.text, variant.transferStimulus.text];
  });
  assert.deepEqual(inventory, [
    ["activity-nor-single-final-ris-sil-001", "NOR-PC-SINGLE-FINAL-001", "ris", "sil"],
    ["activity-nor-single-final-fin-bil-002", "NOR-PC-SINGLE-FINAL-001", "fin", "bil"],
    ["activity-nor-double-final-katt-hatt-001", "NOR-PC-DOUBLE-FINAL-001", "katt", "hatt"],
    ["activity-nor-double-final-kopp-hopp-002", "NOR-PC-DOUBLE-FINAL-001", "kopp", "hopp"],
    ["activity-nor-cluster-pris-gris-001", "NOR-PC-CONSONANT-CLUSTER-001", "pris", "gris"],
    ["activity-nor-cluster-fisk-vest-002", "NOR-PC-CONSONANT-CLUSTER-001", "fisk", "vest"],
    ["activity-nor-ng-sang-lang-001", "NOR-PC-NG-GRAPHEME-001", "sang", "lang"],
    ["activity-nor-ng-ring-seng-002", "NOR-PC-NG-GRAPHEME-001", "ring", "seng"],
  ]);
});

test("BM and NN are exact editorial pairs without silent locale fallback", () => {
  for (const activity of wp13_8DraftCorpus.activities) {
    assert.equal(activity.variants["nb-NO"].locale, "nb-NO");
    assert.equal(activity.variants["nn-NO"].locale, "nn-NO");
    assert.notEqual(activity.variants["nb-NO"].childSteps, activity.variants["nn-NO"].childSteps);
  }
  assert.equal(
    getDraftActivityVariant(
      wp13_8DraftCorpus,
      "activity-nor-single-final-ris-sil-001",
      "nb-NO",
    )?.locale,
    "nb-NO",
  );
  assert.equal(
    getDraftActivityVariant(
      wp13_8DraftCorpus,
      "missing-activity",
      "nn-NO",
    ),
    undefined,
  );
});

test("every corpus object is draft, synthetic, externally review-gated and not student beta", () => {
  assert.equal(wp13_8DraftCorpus.status, "DRAFT");
  assert.equal(wp13_8DraftCorpus.reviewStatus, "EXTERNAL_REVIEW_REQUIRED");
  assert.equal(wp13_8DraftCorpus.evidenceStatus, "SYNTHETIC_ONLY");
  assert.equal(wp13_8DraftCorpus.betaStatus, "NOT_STUDENT_BETA");
  for (const activity of wp13_8DraftCorpus.activities) {
    for (const variant of Object.values(activity.variants)) {
      assert.equal(variant.status, "DRAFT");
      assert.equal(variant.reviewStatus, "EXTERNAL_REVIEW_REQUIRED");
      assert.equal(variant.evidenceStatus, "SYNTHETIC_ONLY");
      assert.equal(variant.betaStatus, "NOT_STUDENT_BETA");
      assert.equal(variant.timingInterpretation, "FORBIDDEN");
      assert.equal(variant.supportProvenanceRequired, true);
      assert.deepEqual(variant.supportPlan, ["NONE", "PROMPT", "MODEL_REQUIRES_ADULT"]);
    }
  }
  assert.equal(JSON.stringify(wp13_8DraftCorpus).includes('"PUBLISHED"'), false);
  assert.equal(JSON.stringify(wp13_8DraftCorpus).includes('"APPROVED_FOR_BETA"'), false);
});

test("reference closure has no orphaned knowledge, context or audio objects", () => {
  assert.deepEqual(validateDraftLearningCorpus(wp13_8DraftCorpus), []);
  assert.equal(wp13_8DraftCorpus.knowledge.length, 16);
  assert.equal(new Set(wp13_8DraftCorpus.knowledge.map((item) => item.knowledgeId)).size, 8);
  assert.equal(wp13_8DraftCorpus.contextCards.length, 16);
  assert.equal(new Set(wp13_8DraftCorpus.contextCards.map((item) => item.contextCardId)).size, 8);
  assert.equal(wp13_8DraftCorpus.audioSpecifications.length, 48);
  assert.equal(new Set(wp13_8DraftCorpus.audioSpecifications.map((item) => item.audioSpecId)).size, 48);
});

test("all audio remains unrecorded, user-started, stoppable and silent-capable", () => {
  for (const audio of wp13_8DraftCorpus.audioSpecifications) {
    assert.equal(audio.takeRevision, 0);
    assert.equal(audio.rightsScope, "DRAFT_SPEC_NOT_RECORDED");
    assert.equal(audio.userInitiated, true);
    assert.equal(audio.stopBehavior, "STOP_IMMEDIATELY");
    assert.equal(audio.silenceAlternative, true);
    assert.equal(audio.humanReviewed, true);
    if (audio.audioRole === "MODEL") assert.equal(audio.voiceSourcePolicy, "HUMAN_REQUIRED");
  }
});

test("review decisions preserve larger-change and review-only boundaries", () => {
  const finBil = wp13_8DraftCorpus.activities.find(
    (item) => item.activityId === "activity-nor-single-final-fin-bil-002",
  )?.variants["nb-NO"];
  assert.equal(finBil?.transferClassification, "METHOD_TRANSFER_WITH_LARGER_CHANGE");
  const reviewOnly = wp13_8DraftCorpus.activities
    .flatMap((item) => Object.values(item.variants))
    .filter((item) => item.locale === "nb-NO" && item.internalReviewDecision === "CHANGES_REQUIRED");
  assert.deepEqual(reviewOnly.map((item) => item.activityId), [
    "activity-nor-cluster-fisk-vest-002",
    "activity-nor-ng-ring-seng-002",
  ]);
  assert.ok(reviewOnly.every((item) => item.transferClassification === "NON_NEAR_TRANSFER_REVIEW_ONLY"));
});

test("three progression edges remain adult-controlled draft hypotheses", () => {
  assert.equal(wp13_8DraftCorpus.progressionEdges.length, 3);
  for (const edge of wp13_8DraftCorpus.progressionEdges) {
    assert.equal(edge.decisionAuthority, "ADULT");
    assert.equal(edge.automaticPlacement, false);
    assert.equal(edge.aggregateScoreRequired, false);
    assert.equal(edge.status, "DRAFT_EXTERNAL_REVIEW_REQUIRED");
  }
});
