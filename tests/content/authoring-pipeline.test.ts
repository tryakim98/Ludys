import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORING_LOCALES,
  deterministicAuthoringJson,
  sha256Hex,
  validateAuthoringPackage,
  validateAuthoringPackageSet,
} from "../../src/core/authoring-pipeline.js";
import { wp13_9AuthoringPackages } from "../../src/content/authoring/wp13-9-authoring-packages.js";

test("all eight WP13.8 activities become complete authoring packages", () => {
  assert.equal(wp13_9AuthoringPackages.length, 8);
  assert.deepEqual(validateAuthoringPackageSet(wp13_9AuthoringPackages), []);
  assert.equal(new Set(wp13_9AuthoringPackages.map((item) => item.sourceActivityId)).size, 8);
});

test("BM and NN are mandatory explicit copies without fallback", () => {
  for (const authoringPackage of wp13_9AuthoringPackages) {
    assert.deepEqual(Object.keys(authoringPackage.locales).sort(), [...AUTHORING_LOCALES].sort());
    for (const locale of AUTHORING_LOCALES) {
      const copy = authoringPackage.locales[locale];
      assert.equal(copy.locale, locale);
      assert.ok(copy.title && copy.instruction && copy.meaningPrompt && copy.transferPrompt);
      assert.ok(copy.adultCard.understand && copy.adultCard.doOrSay && copy.adultCard.avoid && copy.adultCard.deepen);
      assert.ok(copy.knowledgeUnit.title && copy.knowledgeUnit.explanation && copy.contextCard.text);
    }
    assert.notStrictEqual(authoringPackage.locales["nb-NO"], authoringPackage.locales["nn-NO"]);
  }
});

test("reference chains are complete and each package has six audio specifications", () => {
  for (const authoringPackage of wp13_9AuthoringPackages) {
    assert.equal(authoringPackage.audioSpecifications.length, 6);
    for (const locale of AUTHORING_LOCALES) {
      const copy = authoringPackage.locales[locale];
      assert.equal(copy.audioScriptIds.length, 3);
      assert.equal(copy.contextCard.knowledgeId, copy.knowledgeUnit.knowledgeId);
      assert.equal(copy.contextCard.activityId, authoringPackage.activityId);
      assert.ok(copy.audioScriptIds.every((id) => authoringPackage.audioSpecifications.some((audio) => audio.semanticAudioId === id && audio.locale === locale)));
    }
  }
});

test("learning dimensions describe tasks and never child types", () => {
  for (const authoringPackage of wp13_9AuthoringPackages) {
    assert.equal(authoringPackage.learningDimensions.length, 10);
    assert.ok(authoringPackage.learningDimensions.every((item) => item.notDiagnostic));
    assert.doesNotMatch(JSON.stringify(authoringPackage.learningDimensions), /dysleksitype|childId|studentId|profile|diagnos(?:e|is)/i);
  }
});

test("publication, external receipts, real data and runtime AI remain permanently closed", () => {
  for (const authoringPackage of wp13_9AuthoringPackages) {
    const validation = validateAuthoringPackage(authoringPackage);
    assert.equal(validation.validForDraftExport, true);
    assert.equal(validation.validForExternalReviewHandoff, true);
    assert.equal(validation.validForPublish, false);
    assert.equal(authoringPackage.externalReceipts.length, 0);
    assert.ok(Object.values(authoringPackage.nullAuthorizations).every((value) => value === false));
    assert.equal(authoringPackage.publishingStatus, "PUBLISHING_BLOCKED");
  }
});

test("authoring JSON is deterministic, versioned and path-free", () => {
  const exported = deterministicAuthoringJson(wp13_9AuthoringPackages[0]!);
  assert.equal(exported, deterministicAuthoringJson(wp13_9AuthoringPackages[0]!));
  assert.match(exported, /"schemaVersion": "WP13.9-AUTHORING-1"/);
  assert.doesNotMatch(exported, /[A-Z]:\\Users\\|\/Users\/|\.env|Bearer|api[_-]?key/i);
});

test("pure SHA-256 implementation matches a fixed official vector", () => {
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
