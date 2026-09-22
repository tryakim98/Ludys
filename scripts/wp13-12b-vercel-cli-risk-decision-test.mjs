import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertAcceptedVercelCliRisk,
  assertVercelCliRiskContract,
  vercelCliRiskDecisionRecord,
} from "./wp13-12b-vercel-cli-risk-decision.mjs";

const contractUrl = new URL(
  "../release/wp13-12b/external-activation/vercel-cli-tooling-risk.json",
  import.meta.url,
);
const contract = JSON.parse(await readFile(contractUrl, "utf8"));
const scriptPath = fileURLToPath(new URL(
  "./wp13-12b-vercel-cli-risk-decision.mjs",
  import.meta.url,
));

test("Vercel CLI 58 risk decision is conditional and blocks current execution", () => {
  const accepted = assertVercelCliRiskContract(contract);
  assert.throws(
    () => assertAcceptedVercelCliRisk(contract),
    /VERCEL_CLI_EXECUTION_NOT_AUTHORIZED/u,
  );
  assert.equal(
    accepted.status,
    "CONDITIONALLY_ACCEPTED_NOT_EXECUTED",
  );
  assert.equal(accepted.executionStatus, "NOT_YET_AUTHORIZED");
  assert.equal(
    accepted.decisionScope,
    "FUTURE_STRICTLY_BOUNDED_TOOLING_SCOPE_ONLY",
  );
  assert.equal(accepted.productOwnerDecisionRecord, vercelCliRiskDecisionRecord);
  assert.equal(accepted.preUseConditions.length, 22);
  assert.deepEqual(accepted.conditionFailureOutcome, {
    decisionValidity: "INVALID",
    requiredAction: "STOP",
  });
  assert.equal(accepted.executionAuthorized, false);
  assert.equal(accepted.loginAuthorized, false);
  assert.equal(accepted.deploymentAuthorized, false);
  assert.equal(accepted.cleanupAuthorized, false);
  assert.equal(accepted.blocksCurrentExecution, true);
  assert.equal(accepted.blocksExternalDeployment, true);
  assert.equal(accepted.doesNotAuthorizeLoginDeploymentOrCleanup, true);
  assert.equal(accepted.remainingExternalActivationGatesUnaffected, true);
  for (const forbidden of [
    "acceptedBy",
    "ownerIdentity",
    "reviewerIdentity",
    "userId",
    "studentId",
    "childId",
  ]) {
    assert.equal(Object.hasOwn(accepted, forbidden), false);
  }
});

test("conditional risk decision fails closed on changed facts or conditions", () => {
  for (const mutation of [
    (value) => { value.schemaVersion = "wp13.12b-ea-vercel-cli-tooling-risk-v2"; },
    (value) => { value.decisionId += "-changed"; },
    (value) => { value.status = "PENDING"; },
    (value) => { value.executionStatus = "AUTHORIZED"; },
    (value) => { value.decisionScope = "EXTERNAL_ACTIVATION"; },
    (value) => { value.scope += "-changed"; },
    (value) => { value.scopeNature = "GENERAL_ACCEPTANCE"; },
    (value) => { value.productOwnerDecisionRecord += " "; },
    (value) => { value.technicalReauditDecisionId += "-changed"; },
    (value) => { value.technicalReauditStatus = "PENDING"; },
    (value) => { value.conditionalAcceptanceRecorded = false; },
    (value) => { value.executionAuthorized = true; },
    (value) => { value.loginAuthorized = true; },
    (value) => { value.deploymentAuthorized = true; },
    (value) => { value.cleanupAuthorized = true; },
    (value) => { value.blocksCurrentExecution = false; },
    (value) => { value.blocksExternalDeployment = false; },
    (value) => { value.doesNotAuthorizeLoginDeploymentOrCleanup = false; },
    (value) => { value.remainingExternalActivationGatesUnaffected = false; },
    (value) => { value.toolchain.version = "58.0.1"; },
    (value) => { value.toolchain.publishedAt = "2026-07-27T20:26:18.480Z"; },
    (value) => { value.toolchain.officialReleaseCommit = "changed"; },
    (value) => { value.toolchain.npmIntegrity += "changed"; },
    (value) => { value.toolchain.canonicalTreeSha256 = "0".repeat(64); },
    (value) => { value.toolchain.canonicalTreeFileCount += 1; },
    (value) => { value.toolchain.packageJsonSha256 = "0".repeat(64); },
    (value) => { value.toolchain.packageLockSha256 = "0".repeat(64); },
    (value) => {
      value.toolchain.vercelPackageManifestSha256 = "0".repeat(64);
    },
    (value) => { value.toolchain.entrySha256 = "0".repeat(64); },
    (value) => { value.toolchain.forbiddenInstallLogsAbsent = false; },
    (value) => { value.toolchain.globalInstall = true; },
    (value) => { value.toolchain.repoManifestLockImpact = "CHANGED"; },
    (value) => { value.auditSummary.critical = 0; },
    (value) => { value.auditSummary.high = 22; },
    (value) => { value.reachability.runtimeBundled = true; },
    (value) => { value.reachability.productionDependency = true; },
    (value) => { value.reachability.authorityPathReachable = false; },
    (value) => { value.reachability.codeLoadedCriticalHighLeaves.reverse(); },
    (value) => { value.reachability.vulnerableSinkReachable = true; },
    (value) => {
      value.reachability.criticalHighTriggerReachable.login = true;
    },
    (value) => {
      value.reachability.criticalHighTriggerReachable.deploy = true;
    },
    (value) => {
      value.reachability.criticalHighTriggerReachable.cleanup = true;
    },
    (value) => { value.reachability.exactCommandScope.pop(); },
    (value) => { value.mandatoryMitigations.pop(); },
    (value) => { value.preUseConditions.pop(); },
    (value) => { value.conditionFailureOutcome.requiredAction = "CONTINUE"; },
    (value) => { value.acceptedBy = "stable-owner-id"; },
  ]) {
    const changed = structuredClone(contract);
    mutation(changed);
    assert.throws(
      () => assertVercelCliRiskContract(changed),
      /VERCEL_CLI_TOOLING_RISK_CONTRACT_INVALID/u,
    );
    assert.throws(
      () => assertAcceptedVercelCliRisk(changed),
      /VERCEL_CLI_TOOLING_RISK_CONTRACT_INVALID/u,
    );
  }
});

test("risk inspector rejects every command-line argument", () => {
  for (const args of [
    ["--record"],
    ["--confirmation", "anything"],
    ["--accepted-by", "anything"],
    ["--help"],
    ["--version"],
    ["--unknown"],
    ["positional"],
  ]) {
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0, args.join(" "));
    assert.match(
      result.stderr,
      /VERCEL_CLI_TOOLING_RISK_OPTION_INVALID/u,
      args.join(" "),
    );
  }
});

test("risk inspector is read-only and reports conditional non-execution", () => {
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const reported = JSON.parse(result.stdout);
  assert.deepEqual(reported, {
    status: "CONDITIONALLY_ACCEPTED_NOT_EXECUTED",
    decisionId: "wp13-12b-vercel-cli-58-risk-20260728-r1",
    decisionScope: "FUTURE_STRICTLY_BOUNDED_TOOLING_SCOPE_ONLY",
    scope:
      "chrome-device-login-plus-static-hash-bound-preview-dryrun-plus-at-most-two-preview-deploys-plus-authenticated-failed-attempt-cleanup-only",
    executionStatus: "NOT_YET_AUTHORIZED",
    conditionalAcceptanceRecorded: true,
    executionAuthorized: false,
    loginAuthorized: false,
    deploymentAuthorized: false,
    cleanupAuthorized: false,
    blocksCurrentExecution: true,
    blocksExternalDeployment: true,
    doesNotAuthorizeLoginDeploymentOrCleanup: true,
  });
});
