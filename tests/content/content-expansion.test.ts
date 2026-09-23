import assert from "node:assert/strict";
import test from "node:test";
import { createAuthoringPipeline } from "../../src/composition/create-authoring-pipeline.js";
import { createSyntheticAppNavigation } from "../../src/composition/create-synthetic-app-navigation.js";
import { contentExpansionDraftPackages } from "../../src/content/authoring/content-expansion-2026-09-22.js";
import { wp13_9AuthoringPackages } from "../../src/content/authoring/wp13-9-authoring-packages.js";
import { wp13_8DraftCorpus } from "../../src/content/corpus/wp13-8-draft-corpus.js";
import { AUTHORING_LOCALES, deterministicAuthoringJson, validateAuthoringPackage, validateAuthoringPackageSet } from "../../src/core/authoring-pipeline.js";
import { renderAuthoringWorkspace } from "../../src/ui/browser/authoring-workspace-templates.js";

test("two new proposals extend the workshop without changing historical packages or learner corpus", () => {
  const workshop = createAuthoringPipeline();
  assert.equal(workshop.packages.length, 10);
  assert.deepEqual(workshop.packages.slice(0, 8), wp13_9AuthoringPackages);
  assert.deepEqual(validateAuthoringPackageSet(workshop.packages), []);
  assert.equal(new Set(workshop.packages.map((item) => item.patternClassId)).size, 5);
  assert.equal(contentExpansionDraftPackages.length, 2);
  const classes = new Map<string, number>();
  for (const proposal of contentExpansionDraftPackages) {
    classes.set(proposal.patternClassId, (classes.get(proposal.patternClassId) ?? 0) + 1);
    assert.equal(wp13_8DraftCorpus.activities.some((item) => item.activityId === proposal.activityId), false);
  }
  assert.ok([...classes.values()].every((count) => count <= 2));
  assert.equal(wp13_8DraftCorpus.activities.length, 8);
  assert.equal(workshop.view.sessionMutationAvailable, false);
  assert.equal(createSyntheticAppNavigation("nb-NO").controller.view.lifecycleState, "NOT_CREATED");
});

test("new BM/NN text, model-only scripts and references form four separate locale variants", () => {
  for (const proposal of contentExpansionDraftPackages) {
    assert.equal(proposal.audioSpecifications.length, 6);
    assert.equal(proposal.audioTakes.length, 0);
    assert.equal(proposal.provenance.source, "AI_ASSISTED_CONTENT_DRAFT");
    assert.equal(proposal.pendingPatternReview?.humanReviewed, false);
    assert.equal(proposal.localReviewNotes.length, 0);
    assert.equal(proposal.externalReceipts.length, 0);
    for (const locale of AUTHORING_LOCALES) {
      const copy = proposal.locales[locale];
      const audio = copy.audioScriptIds.map((id) => proposal.audioSpecifications.find((spec) => spec.semanticAudioId === id)!);
      assert.ok(audio.every((spec) => spec.locale === locale && spec.specificationHumanReviewed === false && spec.specificationReviewSource === null));
      assert.equal(audio[0]?.script, `${copy.targetWord}.`);
      assert.equal(audio[1]?.script, `${copy.transferWord}.`);
      assert.equal(copy.contextCard.knowledgeId, copy.knowledgeUnit.knowledgeId);
      assert.equal(copy.contextCard.activityId, proposal.activityId);
      assert.equal(proposal.childPreview[locale].instruction, copy.instruction);
      assert.match(copy.knowledgeUnit.explanation, /skriftmodell|modellen/);
      assert.ok(proposal.pendingPatternReview?.locales[locale].openReviewerQuestions.length);
    }
    assert.notEqual(proposal.locales["nb-NO"].instruction, proposal.locales["nn-NO"].instruction);
  }
});

test("new proposals reject fabricated review, missing rationale and mixed-locale references", () => {
  const original = contentExpansionDraftPackages[0]!;
  const forged = structuredClone(original);
  const forgedReview = { ...forged, audioSpecifications: forged.audioSpecifications.map((spec) => ({ ...spec, specificationHumanReviewed: true, specificationReviewSource: "WP13.9_SCOPE_2026-07-22" as const })) };
  assert.equal(validateAuthoringPackage(forgedReview).validForDraftExport, false);
  const missing = { ...original };
  delete missing.pendingPatternReview;
  assert.equal(validateAuthoringPackage(missing).validForDraftExport, false);
  const mismatched = { ...original, provenance: { ...original.provenance, source: "WP13.8_AUTHENTIC_DRAFT_CORPUS" as const } };
  assert.equal(validateAuthoringPackage(mismatched).validForDraftExport, false);
  const mixed = { ...original, locales: { ...original.locales, "nn-NO": { ...original.locales["nn-NO"], audioScriptIds: original.locales["nb-NO"].audioScriptIds } } };
  assert.equal(validateAuthoringPackage(mixed).validForDraftExport, false);
});

test("new workshop proposals survive export, edit, import and withdrawal without approval", () => {
  for (const proposal of contentExpansionDraftPackages) {
    const workshop = createAuthoringPipeline();
    workshop.selectPackage(proposal.packageId);
    const exported = workshop.exportSelectedJson();
    assert.equal(exported, deterministicAuthoringJson(proposal));
    assert.equal(workshop.importJson(exported).lastAction, "VALIDATED_DRAFT_IMPORTED");
    workshop.editLocaleText("nn-NO", "instruction", "Eit nytt utkast for fagreview.");
    assert.equal(workshop.selectedPackage.locales["nb-NO"].instruction, proposal.locales["nb-NO"].instruction);
    assert.ok(workshop.selectedPackage.audioSpecifications.filter((spec) => spec.locale === "nn-NO" && spec.scriptFamily === "TARGET_MODEL").every((spec) => spec.stale));
    assert.ok(workshop.selectedPackage.audioSpecifications.every((spec) => !spec.specificationHumanReviewed));
    workshop.setLocale("nn-NO");
    assert.match(renderAuthoringWorkspace(workshop.view), /Nytt innhaldsutkast – ventar på fagreview/);
    assert.match(renderAuthoringWorkspace(workshop.view), /data-copy-human-reviewed="false"/);
    assert.throws(() => workshop.prepareExternalReviewHandoff(), /local review note/);
    const withdrawn = workshop.withdrawSelected("2026-09-22T12:00:00.000Z");
    assert.equal(withdrawn.selectedPackage.lifecycle, "WITHDRAWN");
    assert.ok(withdrawn.selectedPackage.audioSpecifications.every((spec) => spec.lifecycle === "WITHDRAWN" && spec.activeTakeId === null));
    assert.equal(withdrawn.validation.validForPublish, false);
    assert.ok(Object.values(withdrawn.selectedPackage.nullAuthorizations).every((flag) => flag === false));
  }
});
