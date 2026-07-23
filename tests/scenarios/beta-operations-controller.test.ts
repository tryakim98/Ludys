import assert from "node:assert/strict";
import test from "node:test";
import { BetaOperationsController } from "../../src/application/beta-operations-controller.js";
import { wp13_11OperationsKit } from "../../src/content/operations/wp13-11-operations-kit.js";
import { wp13_11LocalReleaseState } from "../../src/content/prototype/wp13-11-release-state.js";
import { rollbackComponent } from "../../src/core/release-hardening.js";
import { renderBetaOperations } from "../../src/ui/browser/beta-operations-templates.js";

test("adult-only local finding is accepted while likely PII is never stored", () => {
  const controller = new BetaOperationsController(wp13_11OperationsKit);
  controller.startNewDryRun();
  assert.equal(controller.addFinding("TECHNICAL_OPERATION", "OPS_OK", "Fokusrekkefølgen var tydelig").accepted, true);
  assert.equal(controller.view.findings.length, 1);
  assert.equal(controller.addFinding("TECHNICAL_OPERATION", "OPS_BAD", "Kontakt test@example.no").accepted, false);
  assert.equal(controller.view.findings.length, 1);
});

test("STOP dominates pending help and a new explicit dry-run is required", () => {
  const controller = new BetaOperationsController(wp13_11OperationsKit);
  controller.startNewDryRun();
  controller.requestHelp();
  assert.equal(controller.view.pendingUiAction, "HELP_REQUESTED");
  controller.stop();
  assert.equal(controller.view.dryRunStatus, "STOPPED");
  assert.equal(controller.view.pendingUiAction, false);
  assert.throws(() => controller.pause(), /EXPLICIT_ACTIVE_DRY_RUN_REQUIRED/);
  controller.startNewDryRun();
  assert.equal(controller.view.dryRunStatus, "ACTIVE");
});

test("SEV0 contains the run, removes findings and blocks continuation", () => {
  const controller = new BetaOperationsController(wp13_11OperationsKit);
  controller.startNewDryRun();
  controller.addFinding("FEASIBILITY", "OPS_NOTE", "Kort operativt funn");
  controller.runSev0Drill();
  assert.equal(controller.view.dryRunStatus, "SEV0_CONTAINED");
  assert.equal(controller.view.operationalStop, true);
  assert.equal(controller.view.findings.length, 0);
  assert.equal(controller.view.drillResults.SEV0, "PASS");
  assert.throws(() => controller.requestHelp(), /EXPLICIT_ACTIVE_DRY_RUN_REQUIRED/);
});

test("deletion and reconnect preserve no-resurrection and remove records from new export", () => {
  const controller = new BetaOperationsController(wp13_11OperationsKit);
  controller.startNewDryRun();
  controller.addFinding("ACCESSIBILITY", "A11Y_FOCUS", "Synlig fokus var tilgjengelig");
  assert.equal(JSON.parse(controller.exportLocalReviewPackage()).findings.length, 1);
  controller.deleteSessionState();
  assert.equal(controller.reconnect(), false);
  assert.equal(controller.view.noResurrectionVerified, true);
  assert.equal(JSON.parse(controller.exportLocalReviewPackage()).findings.length, 0);
});

test("identical input produces identical local review exports", () => {
  const left = new BetaOperationsController(wp13_11OperationsKit);
  const right = new BetaOperationsController(wp13_11OperationsKit);
  for (const controller of [left, right]) {
    controller.startNewDryRun();
    controller.addFinding("CONTENT_REVIEW", "CONTENT_NOTE", "Kort innholdsreview uten identifikator");
  }
  assert.equal(left.exportLocalReviewPackage(), right.exportLocalReviewPackage());
});

test("operations rollback is independent and withdrawn operations fail closed", () => {
  const rollback = rollbackComponent(wp13_11LocalReleaseState, "OPERATIONS", "wp13-11-operations-kit-r0", "2026-07-22T00:00:00.000Z");
  assert.equal(rollback.accepted, true);
  if (!rollback.accepted) return;
  assert.equal(rollback.state.active.operationsReleaseId, "wp13-11-operations-kit-r0");
  assert.equal(rollback.state.active.appVersion, wp13_11LocalReleaseState.active.appVersion);
  assert.equal(rollback.state.active.audioReleaseId, wp13_11LocalReleaseState.active.audioReleaseId);
  assert.equal(rollbackComponent(wp13_11LocalReleaseState, "OPERATIONS", "wp13-11-operations-kit-withdrawn-proof", "2026-07-22T00:00:00.000Z").accepted, false);
});

test("withdrawn artifact cannot be selected and NB/NN render independently", () => {
  const controller = new BetaOperationsController(wp13_11OperationsKit);
  controller.runWithdrawalDrill("KNOWN_ISSUES");
  assert.throws(() => controller.selectArtifact("KNOWN_ISSUES"), /WITHDRAWN_ARTIFACT_BLOCKED/);
  controller.selectArtifact("PARENT_INFORMATION_DRAFT");
  const nb = renderBetaOperations(controller.view);
  assert.match(nb, /IKKE AUTORISERT FOR ELEVBRUK/);
  controller.setLocale("nn");
  const nn = renderBetaOperations(controller.view);
  assert.match(nn, /IKKJE AUTORISERT FOR ELEVBRUK/);
  assert.doesNotMatch(nn, /IKKE AUTORISERT FOR ELEVBRUK/);
});
