import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXTERNAL_ACTIVATION_AUTHORIZATION,
} from "../provider/firebase/tools/operator-gate-contract.mjs";
import {
  runExternalCloudControlGateForTesting,
} from "./provider-external-cloud-control-gate.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const approval = JSON.parse(await readFile(
  join(
    repo,
    "release",
    "wp13-12b",
    "external-activation",
    "cloud-field-approval.json",
  ),
  "utf8",
));
const cloudControlSource = await readFile(
  join(repo, "scripts", "provider-external-cloud-control.mjs"),
  "utf8",
);
const validNow = () => new Date("2026-07-27T12:00:00.000Z");
const mutationArgs = [
  "--action", "link-billing",
  "--project", approval.plannedProjectId,
  "--google-account", approval.approvedGoogleAccount,
  "--region", approval.selectedRegion,
  "--authorized", EXTERNAL_ACTIVATION_AUTHORIZATION,
];

function controlledExecution({
  rawArgs = mutationArgs,
  now = validNow,
  assertActivationCapability = () => true,
} = {}) {
  const calls = {
    capabilityAcquire: 0,
    capabilityAssert: 0,
    oauth: 0,
    fetch: 0,
    provider: 0,
  };
  const execution = runExternalCloudControlGateForTesting({
    rawArgs,
    approval,
    now,
    acquireActivationCapability: async () => {
      calls.capabilityAcquire += 1;
      return Object.freeze({});
    },
    assertActivationCapability: (capability) => {
      calls.capabilityAssert += 1;
      return assertActivationCapability(capability, calls);
    },
    providerOperation: (gate) => {
      gate.assertMutationAllowed();
      calls.oauth += 1;
      calls.fetch += 1;
      calls.provider += 1;
      return true;
    },
  });
  return { calls, execution };
}

function assertNoExternalProviderCalls(calls) {
  assert.equal(calls.oauth, 0);
  assert.equal(calls.fetch, 0);
  assert.equal(calls.provider, 0);
}

test("production control wires every declared provider mutation through the gate", () => {
  assert.match(
    cloudControlSource,
    /acquireExternalCloudControlGate\(\{/u,
  );
  assert.match(
    cloudControlSource,
    /if \(mutation\) assertMutationAllowed\(\)/u,
  );
  assert.equal(
    cloudControlSource.match(/mutation: true/gu)?.length,
    11,
  );
  assert.match(cloudControlSource, /EXTERNAL_CLOUD_CONTROL_FAILED/u);
  assert.match(cloudControlSource, /uncaughtException/u);
  assert.match(cloudControlSource, /unhandledRejection/u);
});

test("missing or wrong activation authorization fails before capability and provider access", async () => {
  for (const rawArgs of [
    mutationArgs.slice(0, -2),
    mutationArgs.with(
      mutationArgs.indexOf(EXTERNAL_ACTIVATION_AUTHORIZATION),
      "WRONG_ACTIVATION_TOKEN",
    ),
  ]) {
    const { calls, execution } = controlledExecution({ rawArgs });
    await assert.rejects(
      execution,
      /(?:REQUIRED_OPERATOR_FLAG_MISSING|EXACT_ACTIVATION_AUTHORIZATION_REQUIRED)/u,
    );
    assert.equal(calls.capabilityAcquire, 0);
    assert.equal(calls.capabilityAssert, 0);
    assertNoExternalProviderCalls(calls);
  }
});

test("expired activation window fails before capability and provider access", async () => {
  const { calls, execution } = controlledExecution({
    now: () => new Date(`${approval.stagingExpiryDate}T00:00:00.000Z`),
  });
  await assert.rejects(execution, /STAGING_ACTIVATION_WINDOW_EXPIRED/u);
  assert.equal(calls.capabilityAcquire, 0);
  assert.equal(calls.capabilityAssert, 0);
  assertNoExternalProviderCalls(calls);
});

test("repository/source binding is reasserted immediately before provider mutation", async () => {
  const { calls, execution } = controlledExecution({
    assertActivationCapability: (_capability, observedCalls) => {
      if (observedCalls.capabilityAssert === 2) {
        const error = new Error(
          "ACTIVATION_CAPABILITY_REPOSITORY_BINDING_MISMATCH",
        );
        error.code =
          "ACTIVATION_CAPABILITY_REPOSITORY_BINDING_MISMATCH";
        throw error;
      }
      return true;
    },
  });
  await assert.rejects(
    execution,
    /ACTIVATION_CAPABILITY_REPOSITORY_BINDING_MISMATCH/u,
  );
  assert.equal(calls.capabilityAcquire, 1);
  assert.equal(calls.capabilityAssert, 2);
  assertNoExternalProviderCalls(calls);
});

test("window is rechecked immediately before provider mutation", async () => {
  let current = validNow();
  const { calls, execution } = controlledExecution({
    now: () => current,
    assertActivationCapability: () => {
      if (calls.capabilityAssert === 1) {
        current = new Date(
          `${approval.stagingExpiryDate}T00:00:00.000Z`,
        );
      }
      return true;
    },
  });
  await assert.rejects(execution, /STAGING_ACTIVATION_WINDOW_EXPIRED/u);
  assert.equal(calls.capabilityAcquire, 1);
  assert.equal(calls.capabilityAssert, 1);
  assertNoExternalProviderCalls(calls);
});

test("read-only inspection accepts only the exact action and stays non-mutating", async () => {
  let providerCalls = 0;
  const result = await runExternalCloudControlGateForTesting({
    rawArgs: ["--action", "inspect-billing"],
    approval,
    now: validNow,
    acquireActivationCapability: async () => Object.freeze({}),
    assertActivationCapability: () => true,
    providerOperation: (gate) => {
      providerCalls += 1;
      assert.equal(gate.mutating, false);
      assert.throws(
        () => gate.assertMutationAllowed(),
        /EXTERNAL_CLOUD_MUTATION_ACTION_REQUIRED/u,
      );
      return true;
    },
  });
  assert.equal(result, true);
  assert.equal(providerCalls, 1);
  await assert.rejects(
    runExternalCloudControlGateForTesting({
      rawArgs: [
        "--action", "inspect-billing",
        "--authorized", EXTERNAL_ACTIVATION_AUTHORIZATION,
      ],
      approval,
      now: validNow,
      acquireActivationCapability: async () => Object.freeze({}),
      assertActivationCapability: () => true,
      providerOperation: () => true,
    }),
    /UNKNOWN_OPERATOR_FLAG/u,
  );
});
