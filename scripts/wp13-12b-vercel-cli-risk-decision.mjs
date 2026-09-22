import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  approvedVercelCliModuleRoot,
} from "./wp13-12b-vercel-cli-toolchain.mjs";

const repo = resolve(import.meta.dirname, "..");
export const vercelCliRiskPath =
  "release/wp13-12b/external-activation/vercel-cli-tooling-risk.json";

const exactCommandScope = Object.freeze([
  "one Vercel CLI login",
  "one dependency-free preview dry-run",
  "one safe-disabled rollback preview deployment",
  "one rollback-bound active preview deployment",
  "pre-delete authenticated candidate binding and exact-ID deletion only for a new deployment returned by a failed attempt; otherwise manual inventory, followed by authenticated absence verification",
]);

const mandatoryMitigations = Object.freeze([
  "Use only the exact official CLI 58.0.0 package, release commit and recorded npm integrity.",
  "Use only the exact stable audited module root C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\vercel-cli-58.0.0\\node_modules, installed with lifecycle scripts disabled, and keep both npm install stdout/stderr logs absent.",
  "Accept only the exact reviewed repository source and exact dry-run/upload allowlist.",
  "Do not use vercel dev, proxy configuration, WebSockets, untrusted archives or untrusted route/config input.",
  "Keep WIF disabled and backend issuance false throughout both deployment transitions.",
  "Never print, persist in the repository or pass the Vercel credential through command arguments.",
  "Perform only the exact command-scope operations; preserve parseable stdout on a nonzero deploy exit, and before deletion prove through authenticated provider readback that the returned ID is one new attempt deployment and is not any pre-existing deployment. If exact identity cannot be proved, require manual inventory and make no deletion; after an allowed deletion, verify exact-ID absence and preserve every pre-existing receipt-bound deployment; re-attest the stable toolchain tree before each bounded CLI phase.",
  "Re-run npm audit immediately before login; any increased severity, changed finding set or newly reachable critical/high trigger invalidates this technical reaudit.",
]);

const preUseConditions = Object.freeze([
  "EXACT_VERSION_58_0_0",
  "EXACT_PACKAGE_INTEGRITY",
  "ISOLATED_INSTALL_OUTSIDE_REPOSITORY",
  "LIFECYCLE_SCRIPTS_DISABLED",
  "NO_REPOSITORY_LOCKFILE_CHANGE",
  "NOT_RUNTIME_BUNDLED",
  "NOT_PRODUCTION_DEPENDENCY",
  "NO_PYTHON",
  "NO_YAML",
  "NO_TOML",
  "NO_UNTRUSTED_GLOB",
  "NO_UNTRUSTED_ROUTING",
  "NO_PROXY_VARIABLES",
  "NO_WEBSOCKET",
  "NO_VERCEL_DEV",
  "NO_ARCHIVE_HANDLING",
  "NO_SERVICES_OR_MARKETPLACE_FLOW",
  "NO_DYNAMIC_BUILDER_DETECTION_BEYOND_HASH_BOUND_STATIC_SOURCE_SET",
  "NO_SOURCE_SET_DRIFT_AFTER_COMMIT_S",
  "NEW_AUDIT_IMMEDIATELY_BEFORE_LOGIN",
  "NO_REACHABLE_CRITICAL_HIGH_SINK_IN_ACTUAL_LOGIN_DEPLOY_CLEANUP_FLOW",
  "ISOLATED_TOOLCHAIN_FULL_REMOVAL_AFTER_TARGET_VALIDATION",
]);

export const vercelCliRiskDecisionRecord =
  "ACCEPT_WP13_12B_VERCEL_CLI_58_BOUNDED_TOOLING_RISK; "
  + "decisionId=wp13-12b-vercel-cli-58-risk-20260728-r1; "
  + "version=58.0.0; verifiedReleaseCommit=e38f9af; "
  + "packageIntegrity=sha512-Y9sPxy/oR5o8KcVLjxxJ1bsUvSKyigEOb26jBn9LDNgR3VW8iAVb0qm+824WZ5viqVuGMzxsj4wJedVH4ih4Mg==; "
  + "critical=1; high=23; moderate=8; low=1; runtimeBundled=false; "
  + "productionDependency=false; "
  + "scope=chrome-device-login-plus-static-hash-bound-preview-dryrun-plus-at-most-two-preview-deploys-plus-authenticated-failed-attempt-cleanup-only; "
  + "executionStatus=NOT_YET_AUTHORIZED";

function exactJson(expected, actual) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function hasStableHumanIdentityFields(contract) {
  return [
    "acceptedBy",
    "ownerIdentity",
    "reviewerIdentity",
    "userId",
    "studentId",
    "childId",
  ].some((field) => Object.hasOwn(contract ?? {}, field));
}

export function assertVercelCliRiskContract(contract) {
  if (
    contract?.schemaVersion !== "wp13.12b-ea-vercel-cli-tooling-risk-v3"
    || contract.decisionId
      !== "wp13-12b-vercel-cli-58-risk-20260728-r1"
    || contract.status
      !== "CONDITIONALLY_ACCEPTED_NOT_EXECUTED"
    || contract.executionStatus !== "NOT_YET_AUTHORIZED"
    || contract.observedAt !== "2026-07-28"
    || contract.decisionScope
      !== "FUTURE_STRICTLY_BOUNDED_TOOLING_SCOPE_ONLY"
    || contract.scope
      !== "chrome-device-login-plus-static-hash-bound-preview-dryrun-plus-at-most-two-preview-deploys-plus-authenticated-failed-attempt-cleanup-only"
    || contract.scopeNature !== "FUTURE_MAXIMUM_BOUND_ONLY"
    || contract.productOwnerDecisionRecord !== vercelCliRiskDecisionRecord
    || contract.technicalReauditDecisionId
      !== "wp13-12b-vercel-cli-58-reaudit-20260728-r1"
    || contract.technicalReauditStatus
      !== "WP13_12B_VERCEL_CLI_58_REAUDIT_COMPLETE_BOUNDED_FLOW_ONLY"
    || contract.conditionalAcceptanceRecorded !== true
    || contract.executionAuthorized !== false
    || contract.loginAuthorized !== false
    || contract.deploymentAuthorized !== false
    || contract.cleanupAuthorized !== false
    || contract.blocksCurrentExecution !== true
    || contract.blocksExternalDeployment !== true
    || contract.doesNotAuthorizeLoginDeploymentOrCleanup !== true
    || contract.remainingExternalActivationGatesUnaffected !== true
    || hasStableHumanIdentityFields(contract)
    || contract.toolchain?.package !== "vercel"
    || contract.toolchain?.version !== "58.0.0"
    || contract.toolchain?.moduleRoot !== approvedVercelCliModuleRoot
    || contract.toolchain?.publishedAt !== "2026-07-27T20:26:18.479Z"
    || contract.toolchain?.officialReleaseCommit !== "e38f9af"
    || contract.toolchain?.npmIntegrity
      !== "sha512-Y9sPxy/oR5o8KcVLjxxJ1bsUvSKyigEOb26jBn9LDNgR3VW8iAVb0qm+824WZ5viqVuGMzxsj4wJedVH4ih4Mg=="
    || contract.toolchain?.canonicalTreeSha256
      !== "4d97f7ef1a2631946dd5344d29db7ad9b931782e24bd478ea2a4241e2a0f57fc"
    || contract.toolchain?.canonicalTreeFileCount !== 6731
    || contract.toolchain?.packageJsonSha256
      !== "c9e5cc5fd2f425b91679588dde3cd402f1845585dbd7bf6f243e7e9988fe2bb9"
    || contract.toolchain?.packageLockSha256
      !== "fa85de4cf0b4d70dd29cdfb3b2a857ce04096297cdca37ea23d956e86a189c94"
    || contract.toolchain?.vercelPackageManifestSha256
      !== "f984896365b2d5bb3fd5498918ca3fe982713171c49413ec55889306a85b2601"
    || contract.toolchain?.entrySha256
      !== "56b16d6893212069398eb30e2d96943421cd8a5ba7ea3372a1dd5743ed23d363"
    || contract.toolchain?.canonicalTreeAlgorithm
      !== "ASCII_CODE_UNIT_SORTED_RELATIVE_PATH_NUL_SIZE_NUL_SHA256_LF_V2"
    || !exactJson([
      "npm-install.stderr.log",
      "npm-install.stdout.log",
    ], contract.toolchain?.forbiddenInstallLogPaths)
    || contract.toolchain?.forbiddenInstallLogsAbsent !== true
    || contract.toolchain?.installScriptsExecuted !== false
    || contract.toolchain?.globalInstall !== false
    || contract.toolchain?.repoManifestLockImpact !== "NONE"
    || contract.auditSummary?.total !== 33
    || contract.auditSummary?.critical !== 1
    || contract.auditSummary?.high !== 23
    || contract.auditSummary?.moderate !== 8
    || contract.auditSummary?.low !== 1
    || contract.auditSummary?.automaticNonBreakingFixAvailable !== false
    || contract.reachability?.runtimeBundled !== false
    || contract.reachability?.productionDependency !== false
    || contract.reachability?.authorityPathReachable !== true
    || !exactJson(
      ["minimatch", "js-yaml"],
      contract.reachability?.codeLoadedCriticalHighLeaves,
    )
    || contract.reachability?.vulnerableSinkReachable !== false
    || !exactJson({
      login: false,
      deploy: false,
      cleanup: false,
    }, contract.reachability?.criticalHighTriggerReachable)
    || contract.reachability?.untrustedRepositoryInputAllowed !== false
    || contract.reachability?.untrustedArchiveInputAllowed !== false
    || contract.reachability?.proxyAllowed !== false
    || contract.reachability?.websocketAllowed !== false
    || contract.reachability?.vercelDevAllowed !== false
    || !exactJson(
      exactCommandScope,
      contract.reachability?.exactCommandScope,
    )
    || !exactJson(mandatoryMitigations, contract.mandatoryMitigations)
    || !exactJson(preUseConditions, contract.preUseConditions)
    || !exactJson({
      decisionValidity: "INVALID",
      requiredAction: "STOP",
    }, contract.conditionFailureOutcome)
  ) throw new Error("VERCEL_CLI_TOOLING_RISK_CONTRACT_INVALID");
  return contract;
}

// The product owner accepted only a future maximum risk bound. A separate,
// exact execution authorization is still required before any CLI process.
export function assertAcceptedVercelCliRisk(contract) {
  assertVercelCliRiskContract(contract);
  throw new Error("VERCEL_CLI_EXECUTION_NOT_AUTHORIZED");
}

function assertNoCliArguments(argv) {
  if (argv.length !== 0) {
    throw new Error("VERCEL_CLI_TOOLING_RISK_OPTION_INVALID");
  }
}

async function main() {
  assertNoCliArguments(process.argv.slice(2));
  const target = resolve(repo, ...vercelCliRiskPath.split("/"));
  const contract = assertVercelCliRiskContract(
    JSON.parse(await readFile(target, "utf8")),
  );
  process.stdout.write(`${JSON.stringify({
    status: contract.status,
    decisionId: contract.decisionId,
    decisionScope: contract.decisionScope,
    scope: contract.scope,
    executionStatus: contract.executionStatus,
    conditionalAcceptanceRecorded: contract.conditionalAcceptanceRecorded,
    executionAuthorized: contract.executionAuthorized,
    loginAuthorized: contract.loginAuthorized,
    deploymentAuthorized: contract.deploymentAuthorized,
    cleanupAuthorized: contract.cleanupAuthorized,
    blocksCurrentExecution: contract.blocksCurrentExecution,
    blocksExternalDeployment: contract.blocksExternalDeployment,
    doesNotAuthorizeLoginDeploymentOrCleanup:
      contract.doesNotAuthorizeLoginDeploymentOrCleanup,
  }, null, 2)}\n`);
}

const invokedPath = process.argv[1] === undefined
  ? undefined
  : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  await main();
}
