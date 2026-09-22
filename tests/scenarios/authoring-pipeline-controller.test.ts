import assert from "node:assert/strict";
import test from "node:test";
import { AuthoringPipelineController } from "../../src/application/authoring-pipeline-controller.js";
import { wp13_9AuthoringPackages } from "../../src/content/authoring/wp13-9-authoring-packages.js";
import { wp13_9TechnicalAudioFixtures } from "../../src/content/authoring/wp13-9-technical-audio-fixtures.js";

function controller(): AuthoringPipelineController {
  return new AuthoringPipelineController(wp13_9AuthoringPackages, wp13_9TechnicalAudioFixtures);
}

const note = {
  reviewId: "local-review-001",
  name: "Intern fagperson",
  role: "CONTENT_EDITOR",
  scope: "BM_NN_AND_AUDIO_SCRIPT",
  decision: "READY_FOR_EXTERNAL_HANDOFF" as const,
  comment: "Lokalt utkast kontrollert; ingen ekstern godkjenning hevdes.",
  timestamp: "2026-07-22T12:00:00.000Z",
  signatureText: "Intern kommentar – ikke ekstern receipt",
  externalReceipt: false as const,
  receiptIntegrityVerified: false as const,
};

test("controller starts with eight selectable source packages and no session mutation", () => {
  const current = controller().view;
  assert.equal(current.packages.length, 8);
  assert.equal(current.externalReceiptCount, 0);
  assert.equal(current.publishingAvailable, false);
  assert.equal(current.sessionMutationAvailable, false);
});

test("complete draft can be cloned to a new semantic activity ID", () => {
  const current = controller();
  current.cloneCompleteDraft("activity-nor-authored-local-009");
  assert.equal(current.view.packages.length, 9);
  assert.equal(current.view.selectedPackage.activityId, "activity-nor-authored-local-009");
  assert.equal(current.view.selectedPackage.provenance.clonedFromPackageId, wp13_9AuthoringPackages[0]!.packageId);
  assert.equal(current.view.validation.validForDraftExport, true);
});

test("BM and NN edits remain separate and mark only relevant audio stale", () => {
  const current = controller();
  const nnBefore = current.view.selectedPackage.locales["nn-NO"].title;
  current.editLocaleText("nb-NO", "title", "Redigert BM-tittel");
  assert.equal(current.view.selectedPackage.locales["nb-NO"].title, "Redigert BM-tittel");
  assert.equal(current.view.selectedPackage.locales["nn-NO"].title, nnBefore);
  assert.equal(current.view.selectedPackage.audioSpecifications.find((item) => item.locale === "nb-NO" && item.scriptFamily === "TARGET_MODEL")?.lifecycle, "STALE");
  current.editLocaleText("nn-NO", "adultDeepen", "Redigert NN-fordjuping");
  assert.equal(current.view.selectedPackage.audioSpecifications.find((item) => item.locale === "nn-NO" && item.scriptFamily === "ADULT_KNOWLEDGE")?.stale, true);
});

test("audio script revision creates stale audio with a new script checksum", () => {
  const current = controller();
  const spec = current.view.selectedPackage.audioSpecifications[0]!;
  current.editAudioScript(spec.semanticAudioId, "Revidert menneskeeid lydmanus for ekstern vurdering.");
  const edited = current.view.selectedPackage.audioSpecifications[0]!;
  assert.equal(edited.scriptRevision, spec.scriptRevision + 1);
  assert.equal(edited.lifecycle, "STALE");
  assert.equal(edited.stale, true);
  assert.notEqual(edited.scriptSha256, spec.scriptSha256);
});

test("clone, edit, deterministic export and validated import round-trip", () => {
  const current = controller();
  current.cloneCompleteDraft("activity-nor-roundtrip-local-010");
  current.editLocaleText("nb-NO", "instruction", "BM-instruksjon for lokalt utkast.");
  current.editLocaleText("nn-NO", "instruction", "NN-instruksjon for lokalt utkast.");
  const first = current.exportSelectedJson();
  assert.equal(first, current.exportSelectedJson());
  current.importJson(first);
  assert.equal(current.view.importError, undefined);
  assert.equal(current.view.selectedPackage.activityId, "activity-nor-roundtrip-local-010");
});

test("invalid imports cannot bypass schema, publishing, receipt or provider boundaries", () => {
  for (const mutate of [
    (value: any) => { value.schemaVersion = "UNKNOWN"; },
    (value: any) => { value.publishingStatus = "PUBLISHED"; },
    (value: any) => { value.externalReceipts = [{ forged: true }]; },
    (value: any) => { value.providerConfig = { token: "forbidden" }; },
    (value: any) => { delete value.locales["nn-NO"]; },
    (value: any) => { value.audioSpecifications[0].scriptSha256 = "0".repeat(64); },
  ]) {
    const current = controller();
    const value = JSON.parse(current.exportSelectedJson());
    mutate(value);
    current.importJson(JSON.stringify(value));
    assert.equal(current.view.lastAction, "IMPORT_BLOCKED");
    assert.ok(current.view.importError);
  }
});

test("local signature is traceable but never an external receipt", () => {
  const current = controller();
  current.addLocalReviewNote(note);
  const recorded = current.view.selectedPackage.localReviewNotes[0]!;
  assert.equal(recorded.externalReceipt, false);
  assert.equal(recorded.receiptIntegrityVerified, false);
  assert.equal(current.view.externalReceiptCount, 0);
});

test("REVIEW_PENDING means handoff readiness and never approval", () => {
  const current = controller();
  current.addLocalReviewNote(note);
  current.prepareExternalReviewHandoff();
  assert.equal(current.view.selectedPackage.reviewStatus, "REVIEW_PENDING");
  assert.equal(current.view.selectedPackage.externalReceipts.length, 0);
  assert.equal(current.view.publishingAvailable, false);
});

test("technical take attachment and replacement stay non-production and unreviewed", () => {
  const current = controller();
  const audioId = current.view.selectedPackage.audioSpecifications[0]!.semanticAudioId;
  current.replaceWithTechnicalTake(audioId, "wp13-9-technical-take-a");
  assert.equal(current.view.selectedPackage.audioSpecifications[0]!.activeTakeId, "wp13-9-technical-take-a");
  current.replaceWithTechnicalTake(audioId, "wp13-9-technical-take-b");
  const replaced = current.view.selectedPackage.audioSpecifications[0]!;
  assert.equal(replaced.activeTakeId, "wp13-9-technical-take-b");
  assert.equal(replaced.replacementId, "wp13-9-technical-take-a");
  assert.equal(replaced.rightsScope, "INTERNAL_TECHNICAL_TRIAL_ONLY");
  assert.equal(replaced.pronunciationReview, "NOT_REVIEWED");
});

test("STOP interrupts audio and withdrawal removes every active take", () => {
  const current = controller();
  const audioId = current.view.selectedPackage.audioSpecifications[0]!.semanticAudioId;
  current.replaceWithTechnicalTake(audioId, "wp13-9-technical-take-a");
  current.requestAudioPreview(audioId);
  assert.equal(current.view.audioPreviewState, "TECHNICAL_TRIAL_REQUESTED");
  current.stopAudio();
  assert.equal(current.view.audioPreviewState, "STOPPED");
  current.withdrawSelected("2026-07-22T12:30:00.000Z");
  assert.equal(current.view.selectedPackage.lifecycle, "WITHDRAWN");
  assert.ok(current.view.selectedPackage.audioSpecifications.every((item) => item.lifecycle === "WITHDRAWN" && item.activeTakeId === null));
  assert.equal(current.view.publishingAvailable, false);
});

test("restrictive policy survives weaker updates and cannot resurrect package or audio", () => {
  const current = controller();
  const packageId = current.view.selectedPackage.packageId;
  const audioId = current.view.selectedPackage.audioSpecifications[0]!.semanticAudioId;
  current.applyRestrictivePolicy({ policyRevision: 2, restrictions: [
    { scope: "AUTHORING_PACKAGE", scopeId: packageId, lifecycleStatus: "WITHDRAWN" },
    { scope: "AUDIO_SPEC", scopeId: audioId, lifecycleStatus: "WITHDRAWN" },
  ], containsPersonData: false, resurrectionAllowed: false, publishingAuthority: false });
  current.applyRestrictivePolicy({ policyRevision: 3, restrictions: [], containsPersonData: false, resurrectionAllowed: false, publishingAuthority: false });
  assert.equal(current.view.selectedPackage.lifecycle, "WITHDRAWN");
  assert.equal(current.view.selectedPackage.audioSpecifications[0]!.lifecycle, "WITHDRAWN");
});
