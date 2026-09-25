import test from "node:test";
import assert from "node:assert/strict";
import { createSyntheticAppNavigation } from "../../src/composition/create-synthetic-app-navigation.js";
import type { AdultAppJourneyView, ChildAppJourneyView } from "../../src/application/synthetic-app-navigation-controller.js";
import { renderSyntheticAppNavigation } from "../../src/ui/browser/synthetic-app-navigation-templates.js";

function beginActive(role: "CHILD" | "ADULT" = "CHILD") {
  const proof = createSyntheticAppNavigation("nb-NO");
  proof.controller.createSession();
  proof.controller.selectRole(role);
  proof.controller.finishLoading();
  proof.controller.startActivity();
  assert.equal(proof.controller.view.lifecycleState, "ACTIVE");
  return proof;
}

function buildCurrentWord(controller: ReturnType<typeof createSyntheticAppNavigation>["controller"]): void {
  const view = controller.view as ChildAppJourneyView;
  const orderedIds = view.tiles.map((tile) => tile.tileId);
  for (const tileId of orderedIds) controller.selectTile(tileId);
  controller.submitBuild();
}

test("normal journey exposes welcome, explicit creation, role loading and orientation", () => {
  const { controller } = createSyntheticAppNavigation("nb-NO");
  assert.equal(controller.view.screen, "WELCOME");
  assert.equal(controller.view.selectedRole, undefined);
  controller.createSession();
  assert.equal(controller.view.screen, "ROLE_SELECTION");
  controller.selectRole("CHILD");
  assert.equal(controller.view.screen, "LOADING");
  controller.finishLoading();
  assert.equal(controller.view.screen, "ORIENTATION");
  controller.startActivity();
  assert.equal(controller.view.screen, "ACTIVITY");
});

test("child and adult are restricted projections of one authoritative session", () => {
  const { controller } = beginActive();
  const sessionId = controller.sessionId;
  const firstTileId = (controller.view as ChildAppJourneyView).tiles[0]?.tileId;
  assert.notEqual(firstTileId, undefined);
  controller.selectTile(firstTileId ?? "");
  const child = controller.view as unknown as Record<string, unknown>;
  assert.equal(child.selectedRole, "CHILD");
  assert.equal("sessionReference" in child, false);
  assert.equal("adultCard" in child, false);
  assert.deepEqual(child.selectedGraphemes, ["r"]);

  controller.selectRole("ADULT");
  const adult = controller.view as AdultAppJourneyView;
  assert.equal(adult.sessionReference, sessionId);
  assert.deepEqual(adult.observedChildChoices, ["r"]);
  assert.equal("taskPrompt" in (adult as unknown as Record<string, unknown>), false);

  controller.selectRole("CHILD");
  assert.deepEqual((controller.view as ChildAppJourneyView).selectedGraphemes, ["r"]);
});

test("WAIT, help, dismissible adult card, visible provenance, quiet, pause and resume work", () => {
  const { controller } = beginActive();
  controller.requestQuiet();
  assert.equal((controller.view as ChildAppJourneyView).quietMode, true);
  controller.requestHelp();
  assert.equal(controller.view.lifecycleState, "WAITING");
  controller.selectRole("ADULT");
  assert.notEqual((controller.view as AdultAppJourneyView).adultCard, undefined);
  controller.adultDismiss();
  assert.equal((controller.view as AdultAppJourneyView).adultCard, undefined);
  assert.deepEqual((controller.view as AdultAppJourneyView).supportProvenance, []);
  controller.resume();
  controller.pause();
  assert.equal(controller.view.lifecycleState, "PAUSED");
  controller.resume();
  assert.equal(controller.view.lifecycleState, "ACTIVE");
});

test("full word journey completes with a neutral summary", () => {
  const { controller } = beginActive();
  buildCurrentWord(controller);
  assert.equal(controller.view.activityStage, "TARGET_READ_CONFIRMATION");
  controller.selectRole("ADULT");
  controller.confirmReading();
  controller.selectRole("CHILD");
  buildCurrentWord(controller);
  assert.equal(controller.view.activityStage, "TRANSFER_READ_CONFIRMATION");
  controller.selectRole("ADULT");
  controller.confirmReading();
  assert.equal(controller.view.lifecycleState, "COMPLETED");
  assert.equal(controller.view.screen, "SUMMARY");
  assert.match(renderSyntheticAppNavigation(controller.view), /Nøktern oppsummering/);
});

test("STOP and delete dominate reconnect while a new session has no leaked state", () => {
  const { controller, repository } = beginActive();
  controller.selectTile((controller.view as ChildAppJourneyView).tiles[0]?.tileId ?? "");
  const firstId = controller.sessionId;
  controller.stop();
  controller.reconnect();
  assert.equal(controller.view.lifecycleState, "STOPPED");
  assert.equal(controller.view.terminalReconnectProved, true);
  controller.deleteSession();
  controller.reconnect();
  assert.equal(controller.view.lifecycleState, "DELETED");
  assert.equal(controller.view.lastErrorCode, "TOMBSTONE");
  assert.equal(repository.load(firstId).kind, "TOMBSTONE");

  controller.startNewSession();
  const secondId = controller.sessionId;
  assert.notEqual(secondId, firstId);
  assert.equal(controller.view.screen, "WELCOME");
  controller.createSession();
  controller.selectRole("CHILD");
  controller.finishLoading();
  controller.startActivity();
  assert.deepEqual((controller.view as ChildAppJourneyView).selectedGraphemes, []);
});

test("stale recovery returns to the same active local session", () => {
  const { controller } = beginActive();
  const sessionId = controller.sessionId;
  controller.detectStale();
  assert.equal(controller.view.lifecycleState, "STALE");
  controller.beginRecovery();
  assert.equal(controller.view.lifecycleState, "RECOVERING");
  controller.finishRecovery();
  assert.equal(controller.view.lifecycleState, "ACTIVE");
  assert.equal(controller.sessionId, sessionId);
});

test("BM and NN are explicit complete bundles without fallback", () => {
  const { controller } = createSyntheticAppNavigation("nb-NO");
  controller.setLocale("nn-NO");
  assert.equal(controller.view.locale, "nn-NO");
  assert.match(renderSyntheticAppNavigation(controller.view), /Kva vil du jobbe med/);
  controller.createSession();
  assert.throws(() => controller.setLocale("nb-NO"), /only change before/);
  controller.selectRole("CHILD");
  controller.finishLoading();
  controller.startActivity();
  controller.enterWait();
  assert.match(renderSyntheticAppNavigation(controller.view), /Systemet ventar/);
  assert.doesNotMatch(renderSyntheticAppNavigation(controller.view), /Systemet venter/);
  controller.resume();
  controller.pause();
  assert.match(renderSyntheticAppNavigation(controller.view), /sett på pause/);
  controller.resume();
  controller.requestHelp();
  controller.selectRole("ADULT");
  assert.match(renderSyntheticAppNavigation(controller.view), /Eitt avvisbart vaksenkort/);
});
