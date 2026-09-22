import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EXTERNAL_ACTIVATION_AUTHORIZATION,
  assertActivationWindowOpen,
  assertApprovedCloudBinding,
  assertControlAuthorization,
  assertExternalActivationAuthorization,
  deactivationAuthorization,
  loadApprovedCloudScope,
  parseExactFlagPairs,
  safeOperatorErrorCode,
  validateCloudFieldApproval,
} from "../provider/firebase/tools/operator-gate-contract.mjs";
import {
  createStagingControlInMemoryTestAdapter,
  simulateStagingControlAccessTokenForTesting,
  runStagingControlForTesting as runStagingControl,
} from "../provider/firebase/tools/set-staging-control.mjs";
import {
  acquireSyntheticSeedIdentityTokenForTesting,
  runSyntheticFixtureSeed,
} from "../provider/firebase/tools/seed-synthetic-fixtures.mjs";
import {
  deployIdentityScope,
} from "./wp13-12b-deploy-identity.mjs";
import {
  assertProviderRuntimeSecuritySourceContracts,
  providerRuntimeSecuritySourcePaths,
} from "./wp13-12b-provider-package-contract.mjs";

const scope = Object.freeze({
  projectId: "ludys-12b-stg-20260725",
  approvedGoogleAccount: "tryakim@gmail.com",
  organizationId: "724335528970",
  billingAccount: "01CD9D-0900DF-4FB36A",
  region: "europe-north1",
  stagingExpiryDate: "2027-01-25",
});
const approval = {
  schemaVersion: "wp13.12b-ea-cloud-field-approval-v1",
  approvalStatus: "EXPLICITLY_APPROVED_FOR_EXTERNAL_SYNTHETIC_STAGING",
  plannedProjectId: scope.projectId,
  approvedGoogleAccount: scope.approvedGoogleAccount,
  approvedOrganizationId: scope.organizationId,
  approvedBillingAccount: scope.billingAccount,
  selectedRegion: scope.region,
  stagingExpiryDate: scope.stagingExpiryDate,
  authorizationEffects: {
    syntheticFixturesOnly: true,
    realParticipantDataAuthorized: false,
    studentBetaAuthorized: false,
    productionAuthorized: false,
  },
  humanSignatureOrExplicitConfirmation: {
    confirmed: true,
  },
};
const issueUrl =
  "https://issuesyntheticsession-qbqbamvs6q-lz.a.run.app";
const identityToken = "test-identity-token-must-never-be-printed";
const childCapability = `${"a".repeat(96)}.${"b".repeat(43)}`;
const adultCapability = `${"c".repeat(96)}.${"d".repeat(43)}`;
const beforeExpiry = () => new Date("2027-01-24T23:59:59.999Z");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function stagingProviderCalls(adapter) {
  return adapter.calls.filter(({ kind }) =>
    ["GCLOUD_READ", "FIRESTORE_CURRENT_READ", "FIRESTORE_COMMIT"].includes(
      kind,
    ));
}

function syntheticGoogleIdToken({
  audience = issueUrl,
  email = deployIdentityScope.deployServiceAccount,
  issuedAt = "2026-07-27T12:00:00.000Z",
  expiresAt = "2026-07-27T13:00:00.000Z",
} = {}) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return [
    encode({ alg: "RS256", kid: "test-google-key-id", typ: "JWT" }),
    encode({
      iss: "https://accounts.google.com",
      aud: audience,
      email,
      email_verified: true,
      iat: Math.floor(Date.parse(issuedAt) / 1000),
      exp: Math.floor(Date.parse(expiresAt) / 1000),
    }),
    "test-signature-not-used-outside-isolated-unit-test",
  ].join(".");
}

function controlArgs({
  enabled = "true",
  epoch = "8",
  reason = "EXPLICIT_SYNTHETIC_PROOF_WINDOW",
  authorized = EXTERNAL_ACTIVATION_AUTHORIZATION,
  project = scope.projectId,
  account = scope.approvedGoogleAccount,
  region = scope.region,
} = {}) {
  return [
    "--project", project,
    "--google-account", account,
    "--region", region,
    "--enabled", enabled,
    "--control-epoch", epoch,
    "--reason", reason,
    "--authorized", authorized,
  ];
}

function seedArgs({
  locale = "nb",
  authorized = EXTERNAL_ACTIVATION_AUTHORIZATION,
  project = scope.projectId,
  account = scope.approvedGoogleAccount,
  region = scope.region,
  url = issueUrl,
} = {}) {
  return [
    "--project", project,
    "--google-account", account,
    "--region", region,
    "--issue-url", url,
    "--fixture", "synthetic-wp13-12b-only",
    "--locale", locale,
    "--authorized", authorized,
  ];
}

test("generator and validator preserve the hardened provider runtime sources", async () => {
  const sources = Object.fromEntries(await Promise.all(
    providerRuntimeSecuritySourcePaths.map(async (path) => [
      path,
      await readFile(new URL(`../${path}`, import.meta.url), "utf8"),
    ]),
  ));
  const evidence = assertProviderRuntimeSecuritySourceContracts(sources);
  assert.equal(Object.isFrozen(evidence), true);
  assert.deepEqual(evidence, {
    sourceCount: 2,
    strictEmulatorBoundary: true,
    boundedFirestoreTransport: true,
    emulatorTokenIsolation: true,
    atomicGrantDeletionProof: true,
  });

  assert.throws(
    () => assertProviderRuntimeSecuritySourceContracts({
      ...sources,
      "provider/firebase/functions/firestore-store.mjs": sources[
        "provider/firebase/functions/firestore-store.mjs"
      ].replace(
        'throw new Error("FIRESTORE_EMULATOR_MODE_FORBIDDEN")',
        'throw new Error("REMOVED_SECURITY_GATE")',
      ),
    }),
    /PROVIDER_RUNTIME_SECURITY_SOURCE_CONTRACT_MISMATCH/u,
  );
  assert.throws(
    () => assertProviderRuntimeSecuritySourceContracts({
      ...sources,
      "scripts/provider-functions-runtime-test.mjs": sources[
        "scripts/provider-functions-runtime-test.mjs"
      ].replace(
        "await assertFirestoreTransportSecurityContract();",
        "await removedFirestoreTransportSecurityContract();",
      ),
    }),
    /PROVIDER_RUNTIME_SECURITY_SOURCE_CONTRACT_MISMATCH/u,
  );

  for (const scriptPath of [
    "scripts/generate-wp13-12b-staging.mjs",
    "scripts/validate-wp13-12b-staging.mjs",
  ]) {
    const script = await readFile(
      new URL(`../${scriptPath}`, import.meta.url),
      "utf8",
    );
    assert.match(script, /assertProviderRuntimeSecuritySourceContracts/u);
    assert.match(script, /providerRuntimeSecuritySourcePaths/u);
  }
  const generator = await readFile(
    new URL("./generate-wp13-12b-staging.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(
    generator.indexOf("assertProviderRuntimeSecuritySourceContracts(")
      < generator.indexOf("for (const [path, value] of files)"),
  );
});

test("cloud-field approval is the sole project/account/region binding", async () => {
  assert.deepEqual(validateCloudFieldApproval(approval), scope);
  assert.deepEqual(await loadApprovedCloudScope(), scope);
  assert.deepEqual(
    await loadApprovedCloudScope({
      readFileImpl: async () => JSON.stringify(approval),
    }),
    scope,
  );
  assert.throws(
    () => validateCloudFieldApproval({
      ...approval,
      authorizationEffects: {
        ...approval.authorizationEffects,
        realParticipantDataAuthorized: true,
      },
    }),
    /VALID_CONFIRMED_CLOUD_FIELD_APPROVAL_REQUIRED/u,
  );
  const parsed = parseExactFlagPairs(controlArgs(), {
    allowed: [
      "--project",
      "--google-account",
      "--region",
      "--enabled",
      "--control-epoch",
      "--reason",
      "--authorized",
    ],
  });
  assert.equal(assertApprovedCloudBinding(parsed, scope), true);
  assert.equal(assertControlAuthorization(parsed, scope, true), true);
});

test("operator argument parsing rejects duplicate, missing and unknown flags", () => {
  assert.throws(
    () => parseExactFlagPairs([
      "--project", scope.projectId,
      "--project", scope.projectId,
    ], {
      allowed: ["--project"],
    }),
    /DUPLICATE_OPERATOR_FLAG/u,
  );
  assert.throws(
    () => parseExactFlagPairs(["--unexpected", "value"], {
      allowed: ["--project"],
    }),
    /UNKNOWN_OPERATOR_FLAG/u,
  );
  assert.throws(
    () => parseExactFlagPairs(["--project"], {
      allowed: ["--project"],
    }),
    /EXPLICIT_FLAG_VALUE_PAIRS_REQUIRED/u,
  );
});

test("activation and deactivation authorizations cannot be interchanged", async () => {
  const adapter = createStagingControlInMemoryTestAdapter();
  await assert.rejects(
    () => runStagingControl(controlArgs({
      authorized: deactivationAuthorization(scope),
    }), adapter),
    /EXACT_ACTIVATION_AUTHORIZATION_REQUIRED/u,
  );
  await assert.rejects(
    () => runStagingControl(controlArgs({
      enabled: "false",
      reason: "OWNER_STOP",
      authorized: EXTERNAL_ACTIVATION_AUTHORIZATION,
    }), adapter),
    /EXACT_DEACTIVATION_AUTHORIZATION_REQUIRED/u,
  );
  assert.equal(stagingProviderCalls(adapter).length, 0);
});

test("activation token and injected expiry clock fail closed at the exact boundary", () => {
  const parsed = parseExactFlagPairs(controlArgs(), {
    allowed: [
      "--project",
      "--google-account",
      "--region",
      "--enabled",
      "--control-epoch",
      "--reason",
      "--authorized",
    ],
  });
  assert.equal(assertExternalActivationAuthorization(parsed), true);
  assert.equal(
    assertActivationWindowOpen(scope, { now: beforeExpiry }).toISOString(),
    "2027-01-24T23:59:59.999Z",
  );
  assert.throws(
    () => assertActivationWindowOpen(scope, {
      now: () => new Date("2027-01-25T00:00:00.000Z"),
    }),
    /STAGING_ACTIVATION_WINDOW_EXPIRED/u,
  );
  assert.throws(
    () => assertActivationWindowOpen(scope, {
      now: () => new Date("2027-02-01T00:00:00.000Z"),
    }),
    /STAGING_ACTIVATION_WINDOW_EXPIRED/u,
  );
  assert.throws(
    () => assertExternalActivationAuthorization(new Map([
      ["--authorized", "WRONG_ACTIVATION_TOKEN"],
    ])),
    /EXACT_ACTIVATION_AUTHORIZATION_REQUIRED/u,
  );
});

test("control activation and fixture seed reject expiry before external access", async () => {
  let externalCalls = 0;
  const controlAdapter = createStagingControlInMemoryTestAdapter(JSON.stringify({
    nowIso: "2027-01-25T00:00:00.000Z",
  }));
  const seedDependencies = {
    loadScopeImpl: async () => scope,
    now: () => new Date("2027-01-25T00:00:00.000Z"),
    execFileImpl: () => {
      externalCalls += 1;
      throw new Error("must not be reached");
    },
    fetchImpl: async () => {
      externalCalls += 1;
      throw new Error("must not be reached");
    },
  };
  await assert.rejects(
    () => runStagingControl(controlArgs(), controlAdapter),
    /STAGING_ACTIVATION_WINDOW_EXPIRED/u,
  );
  await assert.rejects(
    () => runSyntheticFixtureSeed(seedArgs(), seedDependencies),
    /VALIDATED_LIVE_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  assert.equal(stagingProviderCalls(controlAdapter).length, 0);
  assert.equal(externalCalls, 0);
});

test("synthetic seed ID token uses direct exact IAMCredentials exchange and validates claims", async () => {
  const baseAccessToken =
    "ya29.base-token-never-printed-or-recorded";
  const token = syntheticGoogleIdToken();
  let observed;
  const result =
    await acquireSyntheticSeedIdentityTokenForTesting({
      audience: issueUrl,
      baseAccessToken,
      now: () => new Date("2026-07-27T12:00:00.000Z"),
      fetchImpl: async (url, options) => {
        observed = { url, options };
        return response(200, { token });
      },
    });
  assert.equal(
    observed.url,
    "https://iamcredentials.googleapis.com/v1/projects/-/"
      + `serviceAccounts/${deployIdentityScope.deployServiceAccount}`
      + ":generateIdToken",
  );
  assert.equal(
    observed.options.headers.authorization,
    `Bearer ${baseAccessToken}`,
  );
  assert.deepEqual(JSON.parse(observed.options.body), {
    audience: issueUrl,
    delegates: [],
    includeEmail: true,
  });
  assert.ok(observed.options.signal instanceof AbortSignal);
  assert.equal(result.audience, issueUrl);
  assert.equal(
    result.serviceAccount,
    deployIdentityScope.deployServiceAccount,
  );
  assert.equal(result.tokenPrinted, false);
  assert.equal(result.tokenPersisted, false);
  await assert.rejects(
    acquireSyntheticSeedIdentityTokenForTesting({
      audience: issueUrl,
      baseAccessToken,
      now: () => new Date("2026-07-27T12:00:00.000Z"),
      fetchImpl: async () => response(200, {
        token: syntheticGoogleIdToken({
          audience: "https://attacker.invalid",
        }),
      }),
    }),
    /IAM_IDENTITY_TOKEN_CLAIMS_INVALID/u,
  );
});

test("staging control writes use the exact short-lived deploy identity, not human OAuth directly", async () => {
  const simulation =
    simulateStagingControlAccessTokenForTesting({
      expireTime: "2026-07-27T12:15:00.000Z",
      now: () => new Date("2026-07-27T12:00:00.000Z"),
    });
  assert.match(simulation.request.url, /\.invalid/u);
  assert.doesNotMatch(
    simulation.request.url,
    new RegExp(deployIdentityScope.projectId, "u"),
  );
  assert.match(
    simulation.request.options.headers.authorization,
    /^Bearer test-only-/u,
  );
  assert.deepEqual(JSON.parse(simulation.request.options.body), {
    delegates: [],
    scope: [
      "https://www.googleapis.com/auth/cloud-platform",
    ],
    lifetime: "900s",
  });
  assert.match(simulation.authority.serviceAccount, /\.invalid/u);
  assert.match(simulation.authority.accessToken, /^test-only-/u);
  assert.equal(simulation.authority.tokenPrinted, false);
  assert.equal(simulation.authority.tokenPersisted, false);
});

test("staging control test execution accepts only module-created in-memory adapters", async () => {
  await assert.rejects(
    () => runStagingControl(controlArgs(), {
      execFileImpl: (...args) => spawnSync(...args),
      fetchImpl: (...args) => globalThis.fetch(...args),
      loadScopeImpl: async () => scope,
    }),
    /EXACT_STAGING_CONTROL_TEST_ADAPTER_REQUIRED/u,
  );
  let getterCalls = 0;
  const maliciousScript = {
    get currentBody() {
      getterCalls += 1;
      return {};
    },
  };
  assert.throws(
    () => createStagingControlInMemoryTestAdapter(maliciousScript),
    /CANONICAL_IN_MEMORY_STAGING_TEST_JSON_REQUIRED/u,
  );
  assert.equal(getterCalls, 0);
  assert.throws(
    () => createStagingControlInMemoryTestAdapter(
      `{"currentBody":${"[".repeat(34)}null${"]".repeat(34)}}`,
    ),
    /PLAIN_IN_MEMORY_STAGING_TEST_DATA_REQUIRED/u,
  );
});

test("binding mismatch fails before gcloud or fetch", async () => {
  let externalCalls = 0;
  const adapter = createStagingControlInMemoryTestAdapter();
  const seedDependencies = {
    loadScopeImpl: async () => scope,
    execFileImpl: () => {
      externalCalls += 1;
      return "";
    },
    fetchImpl: async () => {
      externalCalls += 1;
      return response(500, {});
    },
  };
  await assert.rejects(
    () => runStagingControl(
      controlArgs({ account: "other@example.com" }),
      adapter,
    ),
    /CLOUD_FIELD_APPROVAL_BINDING_MISMATCH/u,
  );
  await assert.rejects(
    () => runSyntheticFixtureSeed(
      seedArgs({ region: "us-central1" }),
      seedDependencies,
    ),
    /CLOUD_FIELD_APPROVAL_BINDING_MISMATCH/u,
  );
  assert.equal(stagingProviderCalls(adapter).length, 0);
  assert.equal(externalCalls, 0);
});

test("direct activation is blocked before compare-and-set", async () => {
  const adapter = createStagingControlInMemoryTestAdapter();
  await assert.rejects(
    () => runStagingControl(controlArgs(), adapter),
    /VALIDATED_LIVE_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  assert.equal(stagingProviderCalls(adapter).length, 0);
});

test("deactivation requires its expiry-bound token and remains fail-safe", async () => {
  const adapter = createStagingControlInMemoryTestAdapter(JSON.stringify({
    commitBody: {
      writeResults: [{
        updateTime: "2027-01-25T00:00:00.100Z",
      }],
    },
    currentBody: {
      updateTime: "2027-01-24T23:59:59.000Z",
      fields: {
        controlEpoch: { integerValue: "9" },
        stagingEnabled: { booleanValue: true },
      },
    },
    currentStatus: 200,
    nowIso: "2027-01-25T00:00:00.000Z",
  }));
  const result = await runStagingControl(controlArgs({
    enabled: "false",
    epoch: "10",
    reason: "EXPIRY_DESTRUCTION",
    authorized: deactivationAuthorization(scope),
  }), adapter);
  assert.equal(result.stagingEnabled, false);
  assert.equal(result.controlEpoch, 10);
  const commit = adapter.calls.find(({ kind }) =>
    kind === "FIRESTORE_COMMIT").body;
  assert.equal(
    commit.writes[0].update.fields.stagingEnabled.booleanValue,
    false,
  );
});

test("missing live capability precedes control reads", async () => {
  const firstAdapter = createStagingControlInMemoryTestAdapter(JSON.stringify({
    currentBody: {
      updateTime: "2026-07-27T00:00:00.000Z",
      fields: {
        controlEpoch: { integerValue: "7" },
        stagingEnabled: { booleanValue: false },
      },
    },
    currentStatus: 200,
  }));
  await assert.rejects(
    () => runStagingControl(controlArgs({ epoch: "7" }), firstAdapter),
    /VALIDATED_LIVE_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  assert.equal(stagingProviderCalls(firstAdapter).length, 0);
  const secondAdapter = createStagingControlInMemoryTestAdapter(JSON.stringify({
    currentBody: {
      updateTime: "2026-07-27T00:00:00.000Z",
      fields: {
        controlEpoch: { integerValue: "not-an-epoch" },
        stagingEnabled: { booleanValue: false },
      },
    },
    currentStatus: 200,
  }));
  await assert.rejects(
    () => runStagingControl(controlArgs(), secondAdapter),
    /VALIDATED_LIVE_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  assert.equal(stagingProviderCalls(secondAdapter).length, 0);
});

test("live gate prevents invoking gcloud and errors remain sanitized", async () => {
  const leaked = "secret-child-process-output";
  const adapter = createStagingControlInMemoryTestAdapter();
  await assert.rejects(
    () => runStagingControl(controlArgs(), adapter),
    (error) => {
      assert.equal(
        error.message,
        "VALIDATED_LIVE_ACTIVATION_CAPABILITY_REQUIRED",
      );
      assert.doesNotMatch(error.message, new RegExp(leaked, "u"));
      return true;
    },
  );
  assert.equal(stagingProviderCalls(adapter).length, 0);
  assert.equal(
    safeOperatorErrorCode(new Error(leaked)),
    "OPERATOR_FAILED_CLOSED",
  );
});

for (const [shortLocale, providerLocale] of [
  ["nb", "nb-NO"],
  ["nn", "nn-NO"],
]) {
  test(`direct synthetic ${shortLocale} seed is blocked before provider calls`, async () => {
    const gcloudCalls = [];
    let request;
    await assert.rejects(() => runSyntheticFixtureSeed(seedArgs({
      locale: shortLocale,
    }), {
      loadScopeImpl: async () => scope,
      now: () => new Date("2026-07-27T12:00:00.000Z"),
      execFileImpl: (_file, args) => {
        gcloudCalls.push(args);
        return args[0] === "functions" ? issueUrl : identityToken;
      },
      fetchImpl: async (url, options) => {
        request = { url, options };
        return response(500, {});
      },
    }), /VALIDATED_LIVE_ACTIVATION_CAPABILITY_REQUIRED/u);
    assert.equal(request, undefined);
    assert.equal(gcloudCalls.length, 0);
  });
}

test("seed rejects unverified endpoint and wrong authorization before issuance", async () => {
  let fetchCalls = 0;
  let gcloudCalls = 0;
  const deps = {
    loadScopeImpl: async () => scope,
    now: () => new Date("2026-07-27T12:00:00.000Z"),
    execFileImpl: (_file, args) => {
      gcloudCalls += 1;
      return args[0] === "functions"
        ? "https://different-function.a.run.app"
        : identityToken;
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return response(500, {});
    },
  };
  await assert.rejects(
    () => runSyntheticFixtureSeed(seedArgs({
      authorized: deactivationAuthorization(scope),
    }), deps),
    /EXACT_ACTIVATION_AUTHORIZATION_REQUIRED/u,
  );
  assert.equal(gcloudCalls, 0);
  await assert.rejects(
    () => runSyntheticFixtureSeed(seedArgs(), deps),
    /VALIDATED_LIVE_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  assert.equal(gcloudCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("CLI errors and tool sources have no raw diagnostic leakage path", async () => {
  for (const file of [
    "provider/firebase/tools/set-staging-control.mjs",
    "provider/firebase/tools/seed-synthetic-fixtures.mjs",
  ]) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /console\.(?:error|log)/u);
    assert.doesNotMatch(source, /WP13_12B_OPERATOR_AUTHORIZED/u);
    assert.match(source, /safeOperatorErrorCode/u);
  }
  const secretLookingValue = "must-not-be-reflected-as-an-error";
  const cli = spawnSync(process.execPath, [
    "provider/firebase/tools/set-staging-control.mjs",
    "--unknown",
    secretLookingValue,
  ], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.notEqual(cli.status, 0);
  assert.equal(cli.stdout, "");
  assert.match(cli.stderr, /^UNKNOWN_OPERATOR_FLAG\r?\n$/u);
  assert.doesNotMatch(cli.stderr, new RegExp(secretLookingValue, "u"));
});

test("generated activation, rollback and destruction references use exact gates", async () => {
  const operatorTasks = JSON.parse(await readFile(
    new URL(
      "../release/wp13-12b/activation-handoff/operator-tasks.json",
      import.meta.url,
    ),
    "utf8",
  ));
  const rollbackPlan = JSON.parse(await readFile(
    new URL(
      "../release/wp13-12b/activation-handoff/rollback-plan.json",
      import.meta.url,
    ),
    "utf8",
  ));
  const destructionPlan = JSON.parse(await readFile(
    new URL(
      "../release/wp13-12b/activation-handoff/destruction-plan.json",
      import.meta.url,
    ),
    "utf8",
  ));
  const generator = await readFile(
    new URL("./generate-wp13-12b-staging.mjs", import.meta.url),
    "utf8",
  );
  const activationTask = operatorTasks.tasks.find(
    (entry) => entry.taskId === "OP-11",
  );
  const projectCreationTask = operatorTasks.tasks.find(
    (entry) => entry.taskId === "OP-05",
  );
  const billingTask = operatorTasks.tasks.find(
    (entry) => entry.taskId === "OP-06",
  );
  const firestoreCreationTask = operatorTasks.tasks.find(
    (entry) => entry.taskId === "OP-07",
  );
  const iamAndSecretTask = operatorTasks.tasks.find(
    (entry) => entry.taskId === "OP-08",
  );
  const disabledDeploymentTask = operatorTasks.tasks.find(
    (entry) => entry.taskId === "OP-09",
  );
  const rollbackTask = operatorTasks.tasks.find(
    (entry) => entry.taskId === "OP-14",
  );
  const destructionTask = operatorTasks.tasks.find(
    (entry) => entry.taskId === "OP-16",
  );
  assert.equal(activationTask.authorizationRequired, EXTERNAL_ACTIVATION_AUTHORIZATION);
  assert.equal(activationTask.commands.length, 1);
  for (const command of activationTask.commands) {
    assert.match(command, new RegExp(`--project ${scope.projectId}`, "u"));
    assert.match(
      command,
      new RegExp(`--google-account ${scope.approvedGoogleAccount}`, "u"),
    );
    assert.match(command, new RegExp(`--region ${scope.region}`, "u"));
    assert.match(command, new RegExp(EXTERNAL_ACTIVATION_AUTHORIZATION, "u"));
    assert.doesNotMatch(command, /WP13_12B_OPERATOR_AUTHORIZED/u);
  }
  assert.match(activationTask.commands[0], /provider:external:activate/u);
  assert.match(activationTask.commands[0], /--action activate/u);
  assert.match(
    activationTask.commands[0],
    /--preview-origin <EXACT_PROTECTED_PREVIEW_ORIGIN>/u,
  );
  assert.match(
    activationTask.commands[0],
    /--impersonate-service-account ludys-staging-deployer@/u,
  );
  assert.match(
    activationTask.commands[0],
    /--window-expires-at <UTC-ISO-WITHIN-60-MINUTES>/u,
  );
  assert.deepEqual(
    disabledDeploymentTask.commands.slice(1, 4).map((command) => (
      command.match(/--action ([a-z-]+)/u)?.[1]
    )),
    ["plan", "provision", "verify"],
  );
  const disabledFunctionDeployment = disabledDeploymentTask.commands.find(
    (command) => command.includes("--action deploy-disabled"),
  );
  const firestoreRulesDeployment = disabledDeploymentTask.commands.find(
    (command) => command.includes("--action deploy-firestore-rules"),
  );
  assert.match(
    disabledFunctionDeployment,
    /--action deploy-disabled/u,
  );
  assert.match(
    disabledFunctionDeployment,
    new RegExp(EXTERNAL_ACTIVATION_AUTHORIZATION, "u"),
  );
  assert.match(
    firestoreRulesDeployment,
    new RegExp(EXTERNAL_ACTIVATION_AUTHORIZATION, "u"),
  );
  assert.equal(
    disabledDeploymentTask.commands.some((command) => (
      command.startsWith("gcloud functions deploy")
      || command.startsWith("firebase deploy")
    )),
    false,
  );
  assert.match(disabledDeploymentTask.commands.at(-1), /--action revoke/u);
  for (const entry of operatorTasks.tasks) {
    for (const command of entry.commands) {
      assert.doesNotMatch(command, /^\s*gcloud(?:\.cmd)?\s/u);
    }
  }
  assert.deepEqual(projectCreationTask.commands, [
    "LOGICAL_OPERATOR_GATE_ONLY_NO_DIRECT_COMMAND: create the exact approved "
      + "isolated project only after a bounded project-creation wrapper is "
      + "implemented and reviewed",
  ]);
  assert.deepEqual(firestoreCreationTask.commands, [
    "LOGICAL_OPERATOR_GATE_ONLY_NO_DIRECT_COMMAND: create the default regional "
      + "Firestore database only after a bounded database-creation wrapper is "
      + "implemented and reviewed",
  ]);
  assert.deepEqual(
    billingTask.commands.map((command) => (
      command.match(/--action ([a-z-]+)/u)?.[1]
    )),
    ["link-billing", "create-budget", "inspect-billing"],
  );
  assert.deepEqual(
    iamAndSecretTask.commands.map((command) => (
      command.match(/--action ([a-z-]+)/u)?.[1]
    )),
    [
      "create-runtime-service-account",
      "grant-runtime-project-roles",
      "create-capability-secret",
      "grant-secret-access",
      "inspect-security",
    ],
  );
  for (const command of [...billingTask.commands, ...iamAndSecretTask.commands]) {
    assert.match(
      command,
      /^node scripts\/provider-external-cloud-control\.mjs --action /u,
    );
  }
  for (const command of [
    ...billingTask.commands.slice(0, 2),
    ...iamAndSecretTask.commands.slice(0, 4),
  ]) {
    assert.match(command, new RegExp(`--project ${scope.projectId}`, "u"));
    assert.match(
      command,
      new RegExp(`--google-account ${scope.approvedGoogleAccount}`, "u"),
    );
    assert.match(command, new RegExp(`--region ${scope.region}`, "u"));
    assert.match(command, new RegExp(EXTERNAL_ACTIVATION_AUTHORIZATION, "u"));
  }
  assert.equal(
    billingTask.commands[2],
    "node scripts/provider-external-cloud-control.mjs --action inspect-billing",
  );
  assert.equal(
    iamAndSecretTask.commands[4],
    "node scripts/provider-external-cloud-control.mjs --action inspect-security",
  );
  const exactDeactivation = deactivationAuthorization(scope);
  for (const command of [
    rollbackTask.commands[0],
    destructionTask.commands[0],
    rollbackPlan.deactivationCommand,
    destructionPlan.deactivationCommand,
    destructionPlan.expiryDeactivationPlanCommand,
  ]) {
    assert.match(command, new RegExp(exactDeactivation, "u"));
  }
  assert.equal(
    destructionTask.commands[1],
    "After recording the control-disable result, continue "
      + "release/wp13-12b/activation-handoff/destruction-plan.json "
      + "from ordered command 2",
  );
  assert.match(rollbackTask.commands[0], /--reason ROLLBACK/u);
  assert.match(
    destructionPlan.deactivationCommand,
    /--reason EXPIRY_DESTRUCTION/u,
  );
  assert.equal(
    destructionPlan.expiryExecutionStatus,
    "AUTHORIZED_AT_EXPIRY_NOT_SCHEDULED",
  );
  assert.equal(
    destructionPlan.schemaVersion,
    "wp13.12b-staging-destruction-v3",
  );
  assert.equal(destructionPlan.schedulerReceipt, null);
  assert.doesNotMatch(generator, /WP13_12B_OPERATOR_AUTHORIZED/u);
  assert.match(generator, /const activationOrchestratorCommand/u);
  assert.match(generator, /const deactivationControlCommand/u);
  assert.match(generator, /const functionDeployCommand/u);
  assert.match(generator, /const deployIdentityControlCommand/u);
});

test("destruction generator emits the exact bounded v3 deletion lifecycle", async () => {
  const generator = await readFile(
    new URL("./generate-wp13-12b-staging.mjs", import.meta.url),
    "utf8",
  );
  const validator = await readFile(
    new URL("./validate-wp13-12b-staging.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    generator,
    /const destructionDeactivationExecutionCommand = \[/u,
  );
  assert.match(generator, /const syntheticDataDeletionExecutionCommand = \[/u);
  assert.match(generator, /const syntheticDataDeletionEvidencePlanCommand = \[/u);
  assert.match(generator, /const syntheticDataDeletionConfirmationCommand = \[/u);
  assert.match(generator, /const previewDestructionConfirmationCommand = \[/u);
  assert.match(
    generator,
    /expiryDeactivationPlanCommand: destructionDeactivationExecutionCommand/u,
  );
  const destructionPlanSource = generator.slice(
    generator.indexOf("const destructionPlan ="),
    generator.indexOf("const emulatorImportContract ="),
  );
  const orderedSourceMarkers = [
    "deactivationControlCommand,",
    "deployIdentityControlCommand(\"plan\")",
    "deployIdentityControlCommand(\"provision\")",
    "deployIdentityControlCommand(\"verify\")",
    "functionDeployCommand(\"configure-preview-origin\"",
    "functionDeployCommand(\"deploy-disabled\")",
    "syntheticDataDeletionExecutionCommand,",
    "syntheticDataDeletionEvidencePlanCommand,",
    "syntheticDataDeletionConfirmationCommand,",
    "wifDisabledStateCommand(\"disable-workload-identity-provider\")",
    "wifDisabledStateCommand(\"disable-workload-identity-pool\")",
    "wifDisabledStateCommand(\"verify-disabled\")",
    "destructionDeactivationExecutionCommand,",
    "--action vercel-destruction-plan ",
    "previewDestructionConfirmationCommand,",
    "<POST_VERCEL_INVENTORY_PATH>",
    "provider:external:destruction-plan",
    "<FINAL_ZERO_RESOURCE_INVENTORY_PATH>",
  ];
  const orderedSourceIndexes = orderedSourceMarkers.map(
    (marker) => destructionPlanSource.indexOf(marker),
  );
  assert.equal(
    orderedSourceIndexes.every((
      index,
      markerIndex,
    ) => (
      index >= 0
      && (
        markerIndex === 0
        || index > orderedSourceIndexes[markerIndex - 1]
      )
    )),
    true,
  );
  assert.doesNotMatch(
    destructionPlanSource,
    /deployIdentityControlCommand\("revoke"\)/u,
  );
  assert.doesNotMatch(
    destructionPlanSource,
    /Explicitly delete all synthetic payloads/u,
  );
  assert.match(
    destructionPlanSource,
    /schemaVersion: "wp13\.12b-staging-destruction-v3"/u,
  );
  assert.match(
    destructionPlanSource,
    /ordinaryGraceEndsAt: "2027-01-26T00:00:00\.000Z"/u,
  );
  assert.match(
    validator,
    /expectedDeactivationEvidenceSequence/u,
  );
  assert.match(
    validator,
    /destruction plan deactivation execution must require the exact /u,
  );
  assert.match(
    validator,
    /`--synthetic-data-deletion-evidence \$\{syntheticDataDeletionEvidencePath\}`/u,
  );
  assert.match(
    validator,
    /expectedDestructionCommandMarkers/u,
  );
  assert.match(
    validator,
    /exact v3 18-command control, safe backend,/u,
  );
});
