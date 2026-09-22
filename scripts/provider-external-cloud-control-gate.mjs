import assert from "node:assert/strict";
import {
  assertActivationWindowOpen,
  assertApprovedCloudBinding,
  assertExternalActivationAuthorization,
  parseExactFlagPairs,
  validateCloudFieldApproval,
} from "../provider/firebase/tools/operator-gate-contract.mjs";

export const externalCloudControlActions = Object.freeze([
  "enable-required-services",
  "create-runtime-service-account",
  "grant-runtime-project-roles",
  "create-capability-secret",
  "grant-secret-access",
  "inspect-security",
  "inspect-build-security",
  "grant-build-service-account-roles",
  "inspect-functions",
  "inspect-function-operations",
  "inspect-runtime-security",
  "inspect-forbidden-products",
  "probe-disabled-runtime",
  "inspect-billing",
  "link-billing",
  "create-budget",
]);

export const externalCloudControlMutationActions = Object.freeze([
  "enable-required-services",
  "create-runtime-service-account",
  "grant-runtime-project-roles",
  "create-capability-secret",
  "grant-secret-access",
  "grant-build-service-account-roles",
  "link-billing",
  "create-budget",
]);

const activationFlags = Object.freeze([
  "--action",
  "--project",
  "--google-account",
  "--region",
  "--authorized",
]);

export async function acquireExternalCloudControlGate({
  rawArgs,
  approval,
  acquireActivationCapability,
  assertActivationCapability,
  now = () => new Date(),
}) {
  const actionIndex = rawArgs.indexOf("--action");
  const action = actionIndex >= 0 ? rawArgs[actionIndex + 1] : undefined;
  assert.ok(
    externalCloudControlActions.includes(action),
    "EXPLICIT_ALLOWED_ACTION_REQUIRED",
  );
  const mutating = externalCloudControlMutationActions.includes(action);
  const cliArgs = parseExactFlagPairs(rawArgs, {
    allowed: mutating ? activationFlags : ["--action"],
    required: mutating ? activationFlags : ["--action"],
  });
  const approvedScope = validateCloudFieldApproval(approval);
  if (mutating) {
    assertApprovedCloudBinding(cliArgs, approvedScope);
    assertExternalActivationAuthorization(cliArgs);
    assertActivationWindowOpen(approvedScope, { now });
  }
  const capability = await acquireActivationCapability();
  assertActivationCapability(capability);

  function assertMutationAllowed() {
    assert.equal(mutating, true, "EXTERNAL_CLOUD_MUTATION_ACTION_REQUIRED");
    assertExternalActivationAuthorization(cliArgs);
    assertActivationWindowOpen(approvedScope, { now });
    assertActivationCapability(capability);
    return true;
  }

  return Object.freeze({
    action,
    approvedScope,
    mutating,
    assertMutationAllowed,
  });
}

export async function runExternalCloudControlGateForTesting({
  providerOperation,
  ...options
}) {
  const gate = await acquireExternalCloudControlGate(options);
  return providerOperation(gate);
}
