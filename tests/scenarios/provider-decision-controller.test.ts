import assert from "node:assert/strict";
import test from "node:test";
import { createProviderDecision } from "../../src/composition/create-provider-decision.js";

test("decision controller starts with the recorded decision and five visible options", () => {
  const controller = createProviderDecision();
  assert.equal(controller.view.authorization.ownerDecision, "APPROVE_RECOMMENDED_SYNTHETIC_DEV");
  assert.equal(controller.view.authorization.providerActivation, "BLOCKED");
  assert.equal(controller.view.authorization.cloudResources, 0);
  assert.equal(controller.view.providerOptions.length, 5);
});

test("BM and NN switch explicitly and reject missing locale without fallback", () => {
  const controller = createProviderDecision();
  assert.equal(controller.setLocale("nn").bundle.locale, "nn");
  assert.match(controller.view.bundle.title, /Provideravgjerd/);
  assert.throws(() => controller.setLocale("missing" as never), /MISSING_LOCALE/);
});

test("selected option comparison does not alter recommendation or authorization", () => {
  const controller = createProviderDecision();
  controller.selectOption("SELF_HOSTED");
  assert.equal(controller.view.selectedOption.optionId, "SELF_HOSTED");
  assert.equal(controller.view.recommendedOptionId, "FIREBASE_CAPABILITY");
  assert.equal(controller.view.authorization.ownerDecision, "APPROVE_RECOMMENDED_SYNTHETIC_DEV");
  assert.throws(() => controller.selectOption("UNKNOWN" as never), /UNKNOWN_OPTION/);
});

test("dossier export is deterministic and retains the authorization ceiling", () => {
  const controller = createProviderDecision();
  const first = controller.exportDecisionDossier();
  const second = controller.exportDecisionDossier();
  assert.equal(first, second);
  const dossier = JSON.parse(first);
  assert.equal(dossier.recommendationAcceptedByOwner, true);
  assert.equal(dossier.ownerDecision, "APPROVE_RECOMMENDED_SYNTHETIC_DEV");
  assert.equal(dossier.ownerDecisionRecord.effects.opensWp13_12b, false);
  assert.equal(dossier.providerActivation, "BLOCKED");
  assert.equal(dossier.cloudResources, 0);
});

test("owner template export remains blank and contains no fabricated decision or signature", () => {
  const controller = createProviderDecision();
  const template = controller.exportBlankOwnerTemplate();
  assert.match(template, /PENDING_OWNER_ACTION/);
  assert.match(template, /\| decision \| \|/);
  assert.doesNotMatch(template, /\|\s*APPROVE_RECOMMENDED_SYNTHETIC_DEV\s*\|/);
  assert.match(template, /No owner name, signature/);
});
