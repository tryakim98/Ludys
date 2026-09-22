import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  assertActivationWindowOpen,
  assertApprovedCloudBinding,
  assertControlAuthorization,
  loadApprovedCloudScope,
  parseExactFlagPairs,
  safeOperatorErrorCode,
} from "./operator-gate-contract.mjs";
import {
  acquireCleanupActivationCapability,
  acquireLiveActivationCapability,
  assertCleanupActivationCapability,
  assertLiveActivationCapability,
} from "../../../scripts/wp13-12b-activation-phase-gate.mjs";
import {
  externalControlTestArgvForTesting,
  externalControlTestScope,
} from "../../../scripts/provider-external-deploy-identity-control.mjs";
import {
  createPinnedGoogleCloudCliExecFile,
} from "../../../scripts/wp13-12b-external-process-boundary.mjs";
import {
  deployIdentityScope,
} from "../../../scripts/wp13-12b-deploy-identity.mjs";

const require = createRequire(import.meta.url);
const {
  acquirePinnedGoogleOAuthAccessToken,
} = require(
  "../../../scripts/wp13-12b-google-oauth-token-helper.cjs",
);

const nativeFetch = globalThis.fetch.bind(globalThis);
const stagingControlInMemoryTestAdapters = new WeakMap();
const stagingControlTestScope = Object.freeze({
  ...externalControlTestScope,
  stagingExpiryDate: "2027-01-25",
});

const CONTROL_FLAGS = Object.freeze([
  "--project",
  "--google-account",
  "--region",
  "--enabled",
  "--control-epoch",
  "--reason",
  "--authorized",
]);
const DEACTIVATION_REASONS = new Set([
  "COST_KILL_SWITCH",
  "EXPIRY_DESTRUCTION",
  "OWNER_STOP",
  "PROOF_WINDOW_CLOSED",
  "ROLLBACK",
  "SECURITY_KILL_SWITCH",
]);

function controlError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function runGcloudText(execFileImpl, args, failureCode) {
  let value;
  try {
    value = String(execFileImpl("gcloud", args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    })).trim();
  } catch {
    throw controlError(failureCode);
  }
  if (value.length === 0 || value.length > 16 * 1024) {
    throw controlError(failureCode);
  }
  return value;
}

async function safeJson(response, failureCode) {
  try {
    return await response.json();
  } catch {
    throw controlError(failureCode);
  }
}

function parseCurrentControl(document) {
  if (document === undefined) {
    return { currentEpoch: 1, currentDocument: undefined };
  }
  const integerValue = document?.fields?.controlEpoch?.integerValue;
  if (
    typeof document.updateTime !== "string"
    || document.updateTime.length === 0
    || !/^[1-9][0-9]*$/u.test(integerValue ?? "")
    || typeof document?.fields?.stagingEnabled?.booleanValue !== "boolean"
  ) {
    throw controlError("CURRENT_STAGING_CONTROL_DOCUMENT_INVALID");
  }
  const currentEpoch = Number(integerValue);
  if (!Number.isSafeInteger(currentEpoch)) {
    throw controlError("CURRENT_STAGING_CONTROL_DOCUMENT_INVALID");
  }
  return { currentEpoch, currentDocument: document };
}

const cloudPlatformOAuthScope =
  "https://www.googleapis.com/auth/cloud-platform";
const testBaseAccessToken =
  "test-only-base-oauth-token-never-used-on-network";
const testDeployAccessToken =
  "test-only-deploy-access-token-never-used-on-network";

function assertPlainInMemoryTestData(value) {
  const pending = [{ depth: 0, value }];
  let visited = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    visited += 1;
    if (visited > 2048 || current.depth > 32) {
      throw controlError("PLAIN_IN_MEMORY_STAGING_TEST_DATA_REQUIRED");
    }
    if (
      current.value === null
      || ["boolean", "number", "string"].includes(typeof current.value)
    ) continue;
    if (typeof current.value !== "object") {
      throw controlError("PLAIN_IN_MEMORY_STAGING_TEST_DATA_REQUIRED");
    }
    const values = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value);
    for (const item of values) {
      pending.push({ depth: current.depth + 1, value: item });
    }
  }
}

function inMemoryStagingResponse(status, body) {
  return Object.freeze({
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return structuredClone(body);
    },
  });
}

export function createStagingControlInMemoryTestAdapter(
  canonicalScriptJson = "{}",
) {
  if (
    typeof canonicalScriptJson !== "string"
    || canonicalScriptJson.length === 0
    || canonicalScriptJson.length > 64 * 1024
  ) throw controlError("CANONICAL_IN_MEMORY_STAGING_TEST_JSON_REQUIRED");
  let script;
  try {
    script = JSON.parse(canonicalScriptJson);
  } catch {
    throw controlError("CANONICAL_IN_MEMORY_STAGING_TEST_JSON_REQUIRED");
  }
  if (
    script === null
    || typeof script !== "object"
    || Array.isArray(script)
  ) throw controlError("CANONICAL_IN_MEMORY_STAGING_TEST_JSON_REQUIRED");
  assertPlainInMemoryTestData(script);
  if (
    JSON.stringify(script) !== canonicalScriptJson
    || Object.keys(script).some(
      (key) => ![
        "commitBody",
        "commitStatus",
        "currentBody",
        "currentStatus",
        "nowIso",
        "region",
      ].includes(key),
    )
  ) throw controlError("CANONICAL_IN_MEMORY_STAGING_TEST_JSON_REQUIRED");
  const normalized = {
    commitBody: script.commitBody ?? {
      writeResults: [{
        updateTime: "2026-07-27T12:00:00.100Z",
      }],
    },
    commitStatus: script.commitStatus ?? 200,
    currentBody: script.currentBody ?? {},
    currentStatus: script.currentStatus ?? 404,
    nowIso: script.nowIso ?? "2026-07-27T12:00:00.000Z",
    region: script.region ?? stagingControlTestScope.region,
  };
  const normalizedNow = Date.parse(normalized.nowIso);
  if (
    ![normalized.commitStatus, normalized.currentStatus].every(
      (status) => Number.isInteger(status) && status >= 100 && status <= 599,
    )
    || typeof normalized.nowIso !== "string"
    || !Number.isFinite(normalizedNow)
    || new Date(normalizedNow).toISOString() !== normalized.nowIso
    || typeof normalized.region !== "string"
    || normalized.region.length === 0
  ) throw controlError("VALID_IN_MEMORY_STAGING_TEST_SCRIPT_REQUIRED");
  assertPlainInMemoryTestData(normalized);
  const calls = [];
  const adapter = Object.freeze({
    get calls() {
      return Object.freeze(structuredClone(calls));
    },
  });
  stagingControlInMemoryTestAdapters.set(adapter, Object.freeze({
    calls,
    script: Object.freeze(structuredClone(normalized)),
  }));
  return adapter;
}

function stagingControlTokenRequest({
  baseAccessToken,
  requestScope,
}) {
  if (
    requestScope !== deployIdentityScope
    && requestScope !== stagingControlTestScope
  ) throw controlError("STAGING_CONTROL_TOKEN_SCOPE_INVALID");
  if (
    typeof baseAccessToken !== "string"
    || baseAccessToken.length < 20
    || baseAccessToken.length > 8192
    || /\s/u.test(baseAccessToken)
  ) throw controlError("STAGING_CONTROL_BASE_OAUTH_AUTHORITY_INVALID");
  return Object.freeze({
    url:
      "https://iamcredentials.googleapis.com/v1/projects/-/"
      + `serviceAccounts/${requestScope.deployServiceAccount}`
      + ":generateAccessToken",
    options: Object.freeze({
      method: "POST",
      headers: Object.freeze({
        authorization: `Bearer ${baseAccessToken}`,
        "content-type": "application/json",
        "x-goog-user-project": requestScope.projectId,
      }),
      body: JSON.stringify({
        delegates: [],
        scope: [cloudPlatformOAuthScope],
        lifetime: "900s",
      }),
    }),
  });
}

function validatedStagingControlToken(value, instant, requestScope) {
  const expiresAt = Date.parse(value?.expireTime);
  const lifetimeMilliseconds = expiresAt - instant.valueOf();
  if (
    typeof value?.accessToken !== "string"
    || value.accessToken.length < 20
    || value.accessToken.length > 8192
    || /\s/u.test(value.accessToken)
    || !Number.isFinite(expiresAt)
    || new Date(expiresAt).toISOString() !== value.expireTime
    || lifetimeMilliseconds < 5 * 60 * 1000
    || lifetimeMilliseconds > 16 * 60 * 1000
  ) throw controlError(
    "STAGING_CONTROL_IMPERSONATED_TOKEN_INVALID",
  );
  return Object.freeze({
    accessToken: value.accessToken,
    expireTime: value.expireTime,
    serviceAccount: requestScope.deployServiceAccount,
    scope: cloudPlatformOAuthScope,
    tokenPrinted: false,
    tokenPersisted: false,
  });
}

async function acquireStagingControlAccessToken({
  assertMutationAuthority,
  baseAccessToken,
  fetchImpl,
  now,
}) {
  if (
    typeof assertMutationAuthority !== "function"
    || typeof fetchImpl !== "function"
    || typeof now !== "function"
  ) throw controlError("STAGING_CONTROL_BASE_OAUTH_AUTHORITY_INVALID");
  const instant = now();
  if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) {
    throw controlError("STAGING_CONTROL_TOKEN_TIME_INVALID");
  }
  const request = stagingControlTokenRequest({
    baseAccessToken,
    requestScope: deployIdentityScope,
  });
  await assertMutationAuthority();
  let response;
  try {
    response = await fetchImpl(request.url, {
      ...request.options,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw controlError(
      "STAGING_CONTROL_IMPERSONATED_TOKEN_FAILED",
    );
  }
  if (!response?.ok) {
    throw controlError(
      "STAGING_CONTROL_IMPERSONATED_TOKEN_FAILED",
    );
  }
  const value = await safeJson(
    response,
    "STAGING_CONTROL_IMPERSONATED_TOKEN_INVALID",
  );
  return validatedStagingControlToken(
    value,
    instant,
    deployIdentityScope,
  );
}

export function simulateStagingControlAccessTokenForTesting(
  options = {},
) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || JSON.stringify(Object.keys(options).sort())
      !== JSON.stringify(["expireTime", "now"])
    || typeof options.now !== "function"
    || typeof options.expireTime !== "string"
  ) throw controlError(
    "EXACT_IN_MEMORY_STAGING_TOKEN_TEST_INPUT_REQUIRED",
  );
  const instant = options.now();
  if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) {
    throw controlError("STAGING_CONTROL_TOKEN_TIME_INVALID");
  }
  return Object.freeze({
    request: stagingControlTokenRequest({
      baseAccessToken: testBaseAccessToken,
      requestScope: stagingControlTestScope,
    }),
    authority: validatedStagingControlToken({
      accessToken: testDeployAccessToken,
      expireTime: options.expireTime,
    }, instant, stagingControlTestScope),
  });
}

async function runStagingControlCore(argv, options) {
  const args = parseExactFlagPairs(argv, {
    allowed: CONTROL_FLAGS,
    required: CONTROL_FLAGS,
  });
  const enabledText = args.get("--enabled");
  if (enabledText !== "true" && enabledText !== "false") {
    throw controlError("EXPLICIT_ENABLED_STATE_REQUIRED");
  }
  const enabled = enabledText === "true";
  const execFileImpl = options.execFileImpl;
  const fetchImpl = options.fetchImpl;
  const acquireImpersonatedAccessTokenImpl =
    options.acquireImpersonatedAccessTokenImpl;
  const loadScopeImpl = options.loadScopeImpl;
  const now = options.now;
  const requestScope = options.requestScope;
  const assertMutationAuthority = options.assertMutationAuthority;
  const scope = await loadScopeImpl();
  assertApprovedCloudBinding(args, scope);

  assertControlAuthorization(args, scope, enabled);
  const instant = enabled
    ? assertActivationWindowOpen(scope, { now })
    : now();
  if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) {
    throw controlError("VALID_OPERATOR_TIME_REQUIRED");
  }
  if (typeof assertMutationAuthority !== "function") {
    throw controlError("STAGING_CONTROL_MUTATION_CAPABILITY_REQUIRED");
  }
  const epochText = args.get("--control-epoch");
  if (!/^[1-9][0-9]*$/u.test(epochText)) {
    throw controlError("MONOTONIC_CONTROL_EPOCH_REQUIRED");
  }
  const epoch = Number(epochText);
  if (!Number.isSafeInteger(epoch)) {
    throw controlError("MONOTONIC_CONTROL_EPOCH_REQUIRED");
  }
  const reason = args.get("--reason");
  if (
    enabled
      ? reason !== "EXPLICIT_SYNTHETIC_PROOF_WINDOW"
      : !DEACTIVATION_REASONS.has(reason)
  ) {
    throw controlError("CONTROL_REASON_STATE_MISMATCH");
  }
  if (typeof fetchImpl !== "function") {
    throw controlError("FETCH_IMPLEMENTATION_REQUIRED");
  }
  await assertMutationAuthority();

  const commonGcloudArgs = [
    `--project=${scope.projectId}`,
    `--account=${scope.approvedGoogleAccount}`,
  ];
  const observedRegion = runGcloudText(execFileImpl, [
    "firestore",
    "databases",
    "describe",
    "--database=(default)",
    ...commonGcloudArgs,
    "--format=value(locationId)",
  ], "FIRESTORE_REGION_VERIFICATION_FAILED");
  if (observedRegion !== scope.region) {
    throw controlError("FIRESTORE_REGION_APPROVAL_MISMATCH");
  }
  if (typeof acquireImpersonatedAccessTokenImpl !== "function") {
    throw controlError(
      "STAGING_CONTROL_IMPERSONATED_TOKEN_PROVIDER_REQUIRED",
    );
  }
  await assertMutationAuthority();
  const tokenAuthority =
    await acquireImpersonatedAccessTokenImpl({ instant, scope });
  const accessToken = tokenAuthority?.accessToken;
  if (
    typeof accessToken !== "string"
    || accessToken.length < 20
    || accessToken.length > 8192
    || /\s/u.test(accessToken)
    || tokenAuthority?.serviceAccount
      !== requestScope.deployServiceAccount
    || tokenAuthority?.scope !== cloudPlatformOAuthScope
    || tokenAuthority?.tokenPrinted !== false
    || tokenAuthority?.tokenPersisted !== false
  ) {
    throw controlError(
      "STAGING_CONTROL_IMPERSONATED_TOKEN_INVALID",
    );
  }

  const currentUrl = [
    `https://firestore.googleapis.com/v1/projects/${scope.projectId}`,
    "/databases/(default)/documents/syntheticStagingControl/current",
  ].join("");
  let currentResponse;
  try {
    currentResponse = await fetchImpl(currentUrl, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw controlError("STAGING_CONTROL_READ_FAILED");
  }
  if (!currentResponse?.ok && currentResponse?.status !== 404) {
    throw controlError("STAGING_CONTROL_READ_DENIED");
  }
  const currentDocument = currentResponse.status === 404
    ? undefined
    : await safeJson(
      currentResponse,
      "CURRENT_STAGING_CONTROL_DOCUMENT_INVALID",
    );
  const current = parseCurrentControl(currentDocument);
  if (epoch <= current.currentEpoch) {
    throw controlError("CONTROL_EPOCH_MUST_STRICTLY_INCREASE");
  }

  const changedAt = instant.toISOString();
  const commitUrl = [
    `https://firestore.googleapis.com/v1/projects/${scope.projectId}`,
    "/databases/(default)/documents:commit",
  ].join("");
  let response;
  await assertMutationAuthority();
  try {
    response = await fetchImpl(commitUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        writes: [{
          update: {
            name: [
              `projects/${scope.projectId}/databases/(default)/documents`,
              "/syntheticStagingControl/current",
            ].join(""),
            fields: {
              controlEpoch: { integerValue: String(epoch) },
              stagingEnabled: { booleanValue: enabled },
              reasonCode: { stringValue: reason },
              changedAt: { timestampValue: changedAt },
            },
          },
          currentDocument: current.currentDocument
            ? { updateTime: current.currentDocument.updateTime }
            : { exists: false },
        }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw controlError("STAGING_CONTROL_UPDATE_FAILED");
  }
  if (!response?.ok) throw controlError("STAGING_CONTROL_UPDATE_DENIED");
  const commitResult = await safeJson(
    response,
    "STAGING_CONTROL_UPDATE_CONFIRMATION_INVALID",
  );
  if (
    !Array.isArray(commitResult?.writeResults)
    || commitResult.writeResults.length !== 1
    || typeof commitResult.writeResults[0]?.updateTime !== "string"
    || commitResult.writeResults[0].updateTime.length === 0
  ) {
    throw controlError("STAGING_CONTROL_UPDATE_CONFIRMATION_INVALID");
  }
  return {
    updated: true,
    project: scope.projectId,
    approvedGoogleAccount: scope.approvedGoogleAccount,
    region: scope.region,
    controlEpoch: epoch,
    previousControlEpoch: current.currentEpoch,
    stagingEnabled: enabled,
    reasonCode: reason,
    changedAt,
    accessTokenPrinted: false,
    capabilityMaterialPrinted: false,
  };
}

export async function runStagingControl(argv, options = {}) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).some((key) => key !== "activationCapability")
  ) throw controlError("PRODUCTION_CONTROL_DEPENDENCY_INJECTION_FORBIDDEN");
  const args = parseExactFlagPairs(argv, {
    allowed: CONTROL_FLAGS,
    required: CONTROL_FLAGS,
  });
  const enabled = args.get("--enabled") === "true";
  const activationCapability = options.activationCapability ?? (
    enabled
      ? await acquireLiveActivationCapability()
      : await acquireCleanupActivationCapability()
  );
  const approvedScope = await loadApprovedCloudScope();
  const assertMutationAuthority = () => {
    assertControlAuthorization(args, approvedScope, enabled);
    if (enabled) {
      assertLiveActivationCapability(activationCapability);
      assertActivationWindowOpen(approvedScope);
    } else {
      assertCleanupActivationCapability(activationCapability);
    }
    return true;
  };
  assertMutationAuthority();
  const googleOAuth = await acquirePinnedGoogleOAuthAccessToken();
  return runStagingControlCore(argv, {
    acquireImpersonatedAccessTokenImpl: ({ instant }) =>
      acquireStagingControlAccessToken({
        assertMutationAuthority,
        baseAccessToken: googleOAuth.accessToken,
        fetchImpl: nativeFetch,
        now: () => instant,
      }),
    assertMutationAuthority,
    execFileImpl: createPinnedGoogleCloudCliExecFile({
      environment: process.env,
      googleOAuth,
    }),
    fetchImpl: nativeFetch,
    loadScopeImpl: async () => approvedScope,
    now: () => new Date(),
    requestScope: deployIdentityScope,
  });
}

export async function runStagingControlForTesting(
  argv,
  adapter,
) {
  const binding = stagingControlInMemoryTestAdapters.get(adapter);
  if (
    binding === undefined
    || adapter === null
    || typeof adapter !== "object"
    || Array.isArray(adapter)
  ) throw controlError("EXACT_STAGING_CONTROL_TEST_ADAPTER_REQUIRED");
  const testArgv = externalControlTestArgvForTesting(argv);
  const parsed = parseExactFlagPairs(testArgv, {
    allowed: CONTROL_FLAGS,
    required: CONTROL_FLAGS,
  });
  const enabled = parsed.get("--enabled") === "true";
  const assertMutationAuthority = () => {
    binding.calls.push(Object.freeze({ kind: "AUTHORITY_ASSERTION" }));
    if (enabled) {
      throw controlError("VALIDATED_LIVE_ACTIVATION_CAPABILITY_REQUIRED");
    }
    return true;
  };
  const expectedGcloudArgs = [
    "firestore",
    "databases",
    "describe",
    "--database=(default)",
    `--project=${stagingControlTestScope.projectId}`,
    `--account=${stagingControlTestScope.approvedGoogleAccount}`,
    "--format=value(locationId)",
  ];
  const currentPath =
    `/v1/projects/${stagingControlTestScope.projectId}`
    + "/databases/(default)/documents/syntheticStagingControl/current";
  const commitPath =
    `/v1/projects/${stagingControlTestScope.projectId}`
    + "/databases/(default)/documents:commit";
  return runStagingControlCore(testArgv, {
    acquireImpersonatedAccessTokenImpl: async ({ instant }) =>
      simulateStagingControlAccessTokenForTesting({
        expireTime: new Date(
          instant.valueOf() + 15 * 60 * 1000,
        ).toISOString(),
        now: () => instant,
      }).authority,
    assertMutationAuthority,
    execFileImpl: (file, args, execOptions) => {
      if (
        file !== "gcloud"
        || JSON.stringify(args) !== JSON.stringify(expectedGcloudArgs)
        || execOptions?.encoding !== "utf8"
        || execOptions?.maxBuffer !== 1024 * 1024
        || execOptions?.windowsHide !== true
      ) throw controlError("EXACT_IN_MEMORY_STAGING_GCLOUD_CALL_REQUIRED");
      binding.calls.push(Object.freeze({
        args: Object.freeze([...args]),
        kind: "GCLOUD_READ",
      }));
      return binding.script.region;
    },
    fetchImpl: (url, fetchOptions) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(String(url));
      } catch {
        throw controlError("EXACT_INVALID_STAGING_CONTROL_TEST_SCOPE_REQUIRED");
      }
      if (
        parsedUrl.origin !== "https://firestore.googleapis.com"
        || parsedUrl.username !== ""
        || parsedUrl.password !== ""
        || parsedUrl.port !== ""
        || parsedUrl.search !== ""
        || parsedUrl.hash !== ""
        || String(url).includes(deployIdentityScope.projectId)
      ) throw controlError(
        "EXACT_INVALID_STAGING_CONTROL_TEST_SCOPE_REQUIRED",
      );
      const method = fetchOptions?.method ?? "GET";
      const expectedAuthorization = `Bearer ${testDeployAccessToken}`;
      if (
        fetchOptions?.headers?.authorization !== expectedAuthorization
        || !(fetchOptions?.signal instanceof AbortSignal)
      ) throw controlError("EXACT_IN_MEMORY_STAGING_REQUEST_REQUIRED");
      if (method === "GET" && parsedUrl.pathname === currentPath) {
        if (fetchOptions?.body !== undefined) {
          throw controlError("EXACT_IN_MEMORY_STAGING_REQUEST_REQUIRED");
        }
        binding.calls.push(Object.freeze({
          kind: "FIRESTORE_CURRENT_READ",
          method,
          path: parsedUrl.pathname,
        }));
        return inMemoryStagingResponse(
          binding.script.currentStatus,
          binding.script.currentBody,
        );
      }
      if (method === "POST" && parsedUrl.pathname === commitPath) {
        if (
          fetchOptions?.headers?.["content-type"] !== "application/json"
          || typeof fetchOptions.body !== "string"
        ) throw controlError("EXACT_IN_MEMORY_STAGING_REQUEST_REQUIRED");
        let body;
        try {
          body = JSON.parse(fetchOptions.body);
        } catch {
          throw controlError("EXACT_IN_MEMORY_STAGING_REQUEST_REQUIRED");
        }
        assertPlainInMemoryTestData(body);
        binding.calls.push(Object.freeze({
          body: structuredClone(body),
          kind: "FIRESTORE_COMMIT",
          method,
          path: parsedUrl.pathname,
        }));
        return inMemoryStagingResponse(
          binding.script.commitStatus,
          binding.script.commitBody,
        );
      }
      throw controlError("EXACT_IN_MEMORY_STAGING_REQUEST_REQUIRED");
    },
    loadScopeImpl: async () => {
      binding.calls.push(Object.freeze({ kind: "SCOPE_READ" }));
      return stagingControlTestScope;
    },
    now: () => new Date(binding.script.nowIso),
    requestScope: stagingControlTestScope,
  });
}

function isMainModule() {
  if (process.argv[1] === undefined) return false;
  const invoked = resolve(process.argv[1]);
  const current = resolve(fileURLToPath(import.meta.url));
  return process.platform === "win32"
    ? invoked.toLowerCase() === current.toLowerCase()
    : invoked === current;
}

if (isMainModule()) {
  try {
    process.stdout.write(
      `${JSON.stringify(await runStagingControl(
        process.argv.slice(2),
      ))}\n`,
    );
  } catch (error) {
    process.stderr.write(`${safeOperatorErrorCode(error)}\n`);
    process.exitCode = 1;
  }
}
