import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXTERNAL_ACTIVATION_AUTHORIZATION,
  assertActivationWindowOpen,
  assertApprovedCloudBinding,
  assertExternalActivationAuthorization,
  parseExactFlagPairs,
  validateVercelActivationReadback,
} from "../provider/firebase/tools/operator-gate-contract.mjs";
import {
  acquireExternalWifMutationGate,
} from "./provider-external-wif-mutation-gate.mjs";
import {
  runExternalWifAtomicEnableCompensation,
} from "./provider-external-wif-compensation.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const {
  assertGoogleOAuthProductionEnvironment,
} = require("./wp13-12b-google-oauth-token-helper.cjs");
const [
  contract,
  source,
  vercelSource,
  cloudControlSource,
  accountPreflightSource,
  oauthHelperSource,
  compensationSource,
] = await Promise.all([
  readFile(
    join(
      repo,
      "release",
      "wp13-12b",
      "external-activation",
      "vercel-google-trust-contract.json",
    ),
    "utf8",
  ).then(JSON.parse),
  readFile(join(repo, "scripts", "provider-external-wif-control.mjs"), "utf8"),
  readFile(join(repo, "scripts", "provider-external-vercel-control.mjs"), "utf8"),
  readFile(
    join(repo, "scripts", "provider-external-cloud-control.mjs"),
    "utf8",
  ),
  readFile(
    join(repo, "scripts", "provider-external-account-preflight.mjs"),
    "utf8",
  ),
  readFile(
    join(repo, "scripts", "wp13-12b-google-oauth-token-helper.cjs"),
    "utf8",
  ),
  readFile(
    join(repo, "scripts", "provider-external-wif-compensation.mjs"),
    "utf8",
  ),
]);

test("Vercel trust is pinned to the one authorized preview subject", () => {
  assert.equal(contract.vercel.issuerMode, "team");
  assert.equal(contract.vercel.environment, "preview");
  assert.equal(
    contract.vercel.subject,
    "owner:trym-s-projects:project:ludys-wp13-12b-staging:environment:preview",
  );
  assert.match(contract.provider.attributeCondition, /attribute\.owner_id == 'team_/u);
  assert.match(contract.provider.attributeCondition, /attribute\.project_id == 'prj_/u);
  assert.match(contract.provider.attributeCondition, /attribute\.environment == 'preview'/u);
  assert.doesNotMatch(contract.provider.attributeCondition, /production/u);
  assert.doesNotMatch(contract.provider.attributeCondition, /development/u);
  assert.equal(
    contract.oidcLimitation.subjectGranularity,
    "PROJECT_AND_ENVIRONMENT_NOT_DEPLOYMENT",
  );
  assert.equal(
    contract.oidcLimitation.deploymentIdIncludedInSubject,
    false,
  );
  assert.equal(
    contract.oidcLimitation
      .allPreviewDeploymentsInProjectShareSubject,
    true,
  );
});

test("preview service account is keyless, project-role-free, and private-target-only", () => {
  assert.equal(contract.securityBoundary.longLivedCredentials, false);
  assert.equal(contract.securityBoundary.serviceAccountKeys, false);
  assert.equal(contract.securityBoundary.exactSubjectBindingOnly, true);
  assert.equal(contract.securityBoundary.poolAndProviderCreatedDisabled, true);
  assert.equal(contract.securityBoundary.enableOnlyAfterExactIamReadback, true);
  assert.equal(contract.securityBoundary.wholePoolImpersonationBinding, false);
  assert.equal(
    contract.securityBoundary.oidcSubjectGranularity,
    "PROJECT_AND_ENVIRONMENT_NOT_DEPLOYMENT",
  );
  assert.equal(
    contract.securityBoundary.deploymentSpecificOidcSubject,
    false,
  );
  assert.equal(
    contract.securityBoundary
      .newPreviewDeploymentsWhileTrustEnabled,
    false,
  );
  assert.equal(
    contract.securityBoundary.gitLinkWhileTrustEnabled,
    false,
  );
  assert.equal(
    contract.securityBoundary
      .freshExactDeploymentInventoryRequiredBeforeEveryTrustEnable,
    true,
  );
  assert.equal(
    contract.securityBoundary
      .authenticatedBrowserProofRequiredBeforeEveryTrustEnable,
    true,
  );
  assert.deepEqual(contract.google.projectRoles, []);
  assert.equal(contract.google.userManagedKeys, 0);
  assert.deepEqual(
    contract.google.privateFunctionInvokerTargets,
    ["deleteSyntheticSession", "issueSyntheticSession"],
  );
  assert.deepEqual(
    contract.google.previewInvokerRevocationTargets,
    ["health"],
  );
});

test("control script makes every write an explicit idempotent action", () => {
  for (const action of [
    "enable-trust-services",
    "ensure-preview-service-account",
    "ensure-workload-identity-pool",
    "ensure-workload-identity-provider",
    "grant-preview-identity-impersonation",
    "grant-private-function-invocation",
    "revoke-private-function-invocation",
    "enable-provider-and-pool",
    "disable-workload-identity-provider",
    "disable-workload-identity-pool",
  ]) {
    assert.match(source, new RegExp(`action === "${action}"`, "u"));
  }
  assert.match(source, /EXPLICIT_ALLOWED_ACTION_REQUIRED/u);
  assert.match(source, /ONLY_EXACT_PREVIEW_SUBJECT_MAY_IMPERSONATE/u);
  assert.match(source, /PRIVATE_FUNCTION_PUBLIC_INVOKER_FORBIDDEN/u);
  assert.match(source, /ONLY_EXACT_PREVIEW_INVOKER_ALLOWED/u);
  assert.match(source, /CONDITIONAL_PRIVATE_FUNCTION_INVOKER_FORBIDDEN/u);
  assert.match(source, /CONDITIONAL_PREVIEW_INVOKER_UNEXPECTED/u);
  assert.match(source, /PREVIEW_INVOKER_REVOCATION_FAILED/u);
  assert.match(source, /FEDERATED_PREVIEW_PRINCIPAL_PROJECT_ROLES_FORBIDDEN/u);
  assert.match(source, /directFederatedProjectBindings/u);
  assert.match(source, /principalSet:\/\/iam\.googleapis\.com/u);
  assert.match(
    source,
    /hasAnyBinding\(policy, "roles\/run\.invoker", "allUsers"\)/u,
  );
  assert.match(source, /showDeleted=true/u);
  assert.match(source, /CREATE_CONFLICT_NOT_RESOLVED/u);
  assert.match(source, /USER_MANAGED/u);
  assert.match(source, /timeout: 120_000/u);
  assert.match(source, /const maximumPages = 10/u);
  assert.match(source, /WIF_LIST_PAGINATION_LIMIT_EXCEEDED/u);
  assert.match(source, /WIF_LIST_PAGINATION_CYCLE/u);
  assert.match(source, /existingWorkloadMembers\.length === 0/u);
  assert.match(source, /workloadMembers\.sort\(\)/u);
  assert.match(source, /CONDITIONAL_PREVIEW_IMPERSONATION_FORBIDDEN/u);
  assert.match(source, /EXTERNAL_WIF_CONTROL_FAILED/u);
  assert.match(source, /uncaughtException/u);
  assert.match(source, /unhandledRejection/u);
  assert.doesNotMatch(source, /private_key/u);
  assert.doesNotMatch(source, /client_secret/u);
});

function sourceCapabilityMetadata(phase) {
  return Object.freeze({
    productionBound: true,
    phase,
    repositoryRoot: "C:\\bound-ludys-repository",
    headCommit: "a".repeat(40),
    headTree: "b".repeat(40),
  });
}

const poolName =
  `projects/${contract.google.projectNumber}/locations/global/`
  + `workloadIdentityPools/${contract.google.workloadIdentityPoolId}`;
const providerName =
  `${poolName}/providers/${contract.google.workloadIdentityProviderId}`;
const previewMember =
  `serviceAccount:${contract.google.previewServiceAccountEmail}`;

function forwardGateArgs(action) {
  const approvedScope = {
    projectId: contract.google.projectId,
    approvedGoogleAccount: "tryakim@gmail.com",
    region: contract.google.region,
    stagingExpiryDate: "2027-01-25",
  };
  const cliArgs = parseExactFlagPairs([
    "--action", action,
    "--project", approvedScope.projectId,
    "--google-account", approvedScope.approvedGoogleAccount,
    "--region", approvedScope.region,
    "--authorized", EXTERNAL_ACTIVATION_AUTHORIZATION,
  ], {
    allowed: [
      "--action",
      "--project",
      "--google-account",
      "--region",
      "--authorized",
    ],
  });
  return { approvedScope, cliArgs };
}

test("direct WIF setup requires its exact base capability at every provider write", async () => {
  const action = "ensure-preview-service-account";
  const { approvedScope, cliArgs } = forwardGateArgs(action);
  const validCapability = Object.freeze({});
  const sourceMetadata = sourceCapabilityMetadata("BASE");
  const assertBaseCapability = (capability) => {
    if (capability !== validCapability) {
      throw new Error("VALIDATED_ACTIVATION_CAPABILITY_REQUIRED");
    }
    return sourceMetadata;
  };
  const common = {
    action,
    approvedScope,
    cliArgs,
    assertBaseCapability,
    now: () => new Date("2027-01-24T23:00:00.000Z"),
  };
  await assert.rejects(
    acquireExternalWifMutationGate(common),
    /WIF_MUTATION_CAPABILITY_ACQUISITION_REQUIRED/u,
  );
  await assert.rejects(
    acquireExternalWifMutationGate({
      ...common,
      acquireBaseCapability: async () => Object.freeze({}),
    }),
    /VALIDATED_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  const gate = await acquireExternalWifMutationGate({
    ...common,
    acquireBaseCapability: async () => validCapability,
  });
  const request = {
    method: "POST",
    url:
      "https://iam.googleapis.com/v1/projects/"
      + `${contract.google.projectId}/serviceAccounts`,
    body: {
      accountId: contract.google.previewServiceAccountId,
      serviceAccount: {
        displayName: "LUDYS Vercel preview invoker",
        description:
          "Keyless preview-only invoker for private synthetic staging endpoints.",
      },
    },
  };
  assert.throws(
    () => gate.assertProviderRequest(request),
    /EXACT_WIF_MUTATION_AUTHORIZATION_REQUIRED/u,
  );
  assert.throws(
    () => gate.assertProviderRequest({
      ...request,
      authorization: Object.freeze({}),
    }),
    /EXACT_WIF_MUTATION_AUTHORIZATION_REQUIRED/u,
  );
  assert.equal(gate.assertProviderRequest({
    ...request,
    authorization: gate.forwardAuthorization,
  }), true);
  assert.match(
    source,
    /mutationGate\.assertProviderRequest\(\{[\s\S]*?\}\);\s*const response = await nativeFetch/u,
  );
});

test("direct WIF cleanup requires its exact cleanup capability", async () => {
  const action = "disable-workload-identity-provider";
  const sourceMetadata =
    sourceCapabilityMetadata("FAIL_SAFE_CLEANUP");
  const validCapability = Object.freeze({});
  const assertCleanupCapability = (capability) => {
    if (capability !== validCapability) {
      throw new Error(
        "VALIDATED_CLEANUP_ACTIVATION_CAPABILITY_REQUIRED",
      );
    }
    return sourceMetadata;
  };
  const common = {
    action,
    approvedScope: {},
    cliArgs: new Map([["--action", action]]),
    assertCleanupCapability,
  };
  await assert.rejects(
    acquireExternalWifMutationGate(common),
    /WIF_MUTATION_CAPABILITY_ACQUISITION_REQUIRED/u,
  );
  await assert.rejects(
    acquireExternalWifMutationGate({
      ...common,
      acquireCleanupCapability: async () => Object.freeze({}),
    }),
    /VALIDATED_CLEANUP_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  const gate = await acquireExternalWifMutationGate({
    ...common,
    acquireCleanupCapability: async () => validCapability,
  });
  const request = {
    method: "PATCH",
    url: `https://iam.googleapis.com/v1/${providerName}`
      + "?updateMask=disabled",
    body: {
      name: providerName,
      disabled: true,
    },
  };
  for (const authorization of [undefined, Object.freeze({})]) {
    assert.throws(
      () => gate.assertProviderRequest({
        ...request,
        authorization,
      }),
      /EXACT_WIF_MUTATION_AUTHORIZATION_REQUIRED/u,
    );
  }
  assert.equal(gate.assertProviderRequest({
    ...request,
    authorization: gate.cleanupAuthorization,
  }), true);
});

test("WIF cleanup authority rejects wrong endpoint, forward enable, body drift, port and policy addition", async () => {
  const validCapability = Object.freeze({});
  const sourceMetadata =
    sourceCapabilityMetadata("FAIL_SAFE_CLEANUP");
  const assertCleanupCapability = (capability) => {
    assert.equal(capability, validCapability);
    return sourceMetadata;
  };
  const disableAction = "disable-workload-identity-provider";
  const disableGate = await acquireExternalWifMutationGate({
    action: disableAction,
    approvedScope: {},
    cliArgs: new Map([["--action", disableAction]]),
    acquireCleanupCapability: async () => validCapability,
    assertCleanupCapability,
  });
  const validDisable = {
    method: "PATCH",
    url: `https://iam.googleapis.com/v1/${providerName}`
      + "?updateMask=disabled",
    body: { name: providerName, disabled: true },
    authorization: disableGate.cleanupAuthorization,
  };
  assert.equal(disableGate.assertProviderRequest(validDisable), true);
  assert.throws(
    () => disableGate.assertProviderRequest({
      ...validDisable,
      url: `https://iam.googleapis.com/v1/${poolName}`
        + "?updateMask=disabled",
    }),
    /WIF_ACTION_PROVIDER_REQUEST_MISMATCH/u,
  );
  assert.throws(
    () => disableGate.assertProviderRequest({
      ...validDisable,
      body: { ...validDisable.body, disabled: false },
    }),
    /WIF_DISABLED_PATCH_BODY_MISMATCH/u,
  );
  assert.throws(
    () => disableGate.assertProviderRequest({
      ...validDisable,
      body: { ...validDisable.body, unexpected: true },
    }),
    /WIF_DISABLED_PATCH_BODY_MISMATCH/u,
  );
  assert.throws(
    () => disableGate.assertProviderRequest({
      ...validDisable,
      url: `https://iam.googleapis.com:444/v1/${providerName}`
        + "?updateMask=disabled",
    }),
    /EXACT_WIF_PROVIDER_URL_REQUIRED/u,
  );

  const revokeAction = "revoke-private-function-invocation";
  const revokeGate = await acquireExternalWifMutationGate({
    action: revokeAction,
    approvedScope: {},
    cliArgs: new Map([["--action", revokeAction]]),
    acquireCleanupCapability: async () => validCapability,
    assertCleanupCapability,
  });
  const revokeRequest = {
    method: "POST",
    url:
      "https://run.googleapis.com/v2/projects/"
      + `${contract.google.projectId}/locations/${contract.google.region}/`
      + "services/health:setIamPolicy",
    body: { policy: { bindings: [] } },
    authorization: revokeGate.cleanupAuthorization,
  };
  assert.equal(revokeGate.assertProviderRequest(revokeRequest), true);
  assert.throws(
    () => revokeGate.assertProviderRequest({
      ...revokeRequest,
      body: {
        policy: {
          bindings: [{
            role: "roles/run.invoker",
            members: [previewMember],
          }],
        },
      },
    }),
    /WIF_REVOKE_POLICY_MUST_ONLY_REMOVE_BINDING/u,
  );
});

test("WIF forward window and exact source are rechecked after readback and before write", async () => {
  const action = "grant-private-function-invocation";
  const { approvedScope, cliArgs } = forwardGateArgs(action);
  const validCapability = Object.freeze({});
  const sourceMetadata = sourceCapabilityMetadata("BASE");
  let currentSource = sourceMetadata;
  let instant = new Date("2027-01-24T23:59:59.999Z");
  const gate = await acquireExternalWifMutationGate({
    action,
    approvedScope,
    cliArgs,
    acquireBaseCapability: async () => validCapability,
    assertBaseCapability(capability) {
      assert.equal(capability, validCapability);
      return currentSource;
    },
    now: () => instant,
  });
  assert.equal(gate.assertProviderRequest({
    method: "GET",
    url: "https://run.googleapis.com/v2/projects/test/service",
    authorization: undefined,
  }), true);
  instant = new Date("2027-01-25T00:00:00.000Z");
  assert.throws(
    () => gate.assertProviderRequest({
      method: "POST",
      url:
        "https://run.googleapis.com/v2/projects/"
        + `${contract.google.projectId}/locations/${contract.google.region}/`
        + "services/issuesyntheticsession:setIamPolicy",
      body: {
        policy: {
          bindings: [{
            role: "roles/run.invoker",
            members: [previewMember],
          }],
        },
      },
      authorization: gate.forwardAuthorization,
    }),
    /STAGING_ACTIVATION_WINDOW_EXPIRED/u,
  );
  instant = new Date("2027-01-24T23:59:59.999Z");
  currentSource = Object.freeze({ ...sourceMetadata });
  assert.throws(
    () => gate.assertProviderRequest({
      method: "POST",
      url:
        "https://run.googleapis.com/v2/projects/"
        + `${contract.google.projectId}/locations/${contract.google.region}/`
        + "services/issuesyntheticsession:setIamPolicy",
      body: {
        policy: {
          bindings: [{
            role: "roles/run.invoker",
            members: [previewMember],
          }],
        },
      },
      authorization: gate.forwardAuthorization,
    }),
    /EXACT_SOURCE_BOUND_WIF_CAPABILITY_REQUIRED/u,
  );
});

test("Google auth production scripts reject env injection and isolate Firebase modules", () => {
  assert.equal(assertGoogleOAuthProductionEnvironment({}, []), true);
  for (const name of [
    "LUDYS_FIREBASE_CLI_LIB",
    "node_options",
    "NODE_PATH",
    "NODE_USE_ENV_PROXY",
    "NODE_TLS_REJECT_UNAUTHORIZED",
    "NODE_EXTRA_CA_CERTS",
    "https_proxy",
    "NO_PROXY",
    "SSL_CERT_FILE",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "CLOUDSDK_AUTH_ACCESS_TOKEN",
    "FIREBASE_TOKEN",
  ]) {
    assert.throws(
      () => assertGoogleOAuthProductionEnvironment(
        { [name]: "attacker-controlled" },
        [],
      ),
      /GOOGLE_OAUTH_PRODUCTION_ENVIRONMENT_FORBIDDEN/u,
    );
  }
  assert.throws(
    () => assertGoogleOAuthProductionEnvironment(
      {},
      ["--require=attacker-preload.cjs"],
    ),
    /GOOGLE_OAUTH_PRODUCTION_ENVIRONMENT_FORBIDDEN/u,
  );

  for (const productionSource of [
    source,
    cloudControlSource,
    accountPreflightSource,
  ]) {
    assert.match(
      productionSource,
      /assertGoogleOAuthProductionEnvironment\(\)/u,
    );
    assert.match(
      productionSource,
      /acquirePinnedGoogleOAuthAccessToken\(\)/u,
    );
    assert.doesNotMatch(productionSource, /LUDYS_FIREBASE_CLI_LIB/u);
    assert.doesNotMatch(productionSource, /getGlobalDefaultAccount/u);
    assert.doesNotMatch(productionSource, /getAccessToken/u);
    assert.doesNotMatch(productionSource, /require\(join\(cliLib/u);
  }
  assert.match(
    oauthHelperSource,
    /verifyPinnedFirebaseToolsTree\(\)/u,
  );
  assert.match(
    oauthHelperSource,
    /const child = fork\(__filename, \[\], \{/u,
  );
  assert.match(
    oauthHelperSource,
    /env: cleanGoogleOAuthChildEnvironment\(process\.env\)/u,
  );
  assert.match(oauthHelperSource, /execArgv: \[\]/u);
  assert.match(
    oauthHelperSource,
    /stdio: \["ignore", "ignore", "ignore", "ipc"\]/u,
  );
});

test("Google auth CLIs fail before helper or provider access on module-root injection", () => {
  const forbiddenKeys = new Set([
    "ALL_PROXY",
    "CLOUDSDK_AUTH_ACCESS_TOKEN",
    "CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE",
    "FIREBASE_TOKEN",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "LUDYS_FIREBASE_CLI_LIB",
    "NODE_EXTRA_CA_CERTS",
    "NODE_OPTIONS",
    "NODE_PATH",
    "NODE_TLS_REJECT_UNAUTHORIZED",
    "NODE_USE_ENV_PROXY",
    "NO_PROXY",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
  ]);
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !forbiddenKeys.has(key.toUpperCase()),
    ),
  );
  environment.LUDYS_FIREBASE_CLI_LIB =
    "C:\\attacker-controlled\\firebase-tools\\lib";
  for (const [path, args] of [
    ["scripts/provider-external-account-preflight.mjs", []],
    [
      "scripts/provider-external-cloud-control.mjs",
      ["--action", "inspect-billing"],
    ],
    [
      "scripts/provider-external-wif-control.mjs",
      ["--action", "verify-disabled"],
    ],
  ]) {
    const result = spawnSync(
      process.execPath,
      [join(repo, ...path.split("/")), ...args],
      {
        cwd: repo,
        encoding: "utf8",
        env: environment,
        timeout: 15_000,
        windowsHide: true,
      },
    );
    assert.notEqual(result.status, 0, path);
    assert.equal(result.stdout, "", path);
    assert.match(
      result.stderr,
      /GOOGLE_OAUTH_PRODUCTION_ENVIRONMENT_FORBIDDEN/u,
      path,
    );
    assert.doesNotMatch(result.stderr, /attacker-controlled/u, path);
    assert.doesNotMatch(
      result.stderr,
      /PINNED_FIREBASE_TOOLS_TREE_INTEGRITY_MISMATCH/u,
      path,
    );
  }
});

test("disabled verification is read-only and checks the complete fail-closed trust state", () => {
  assert.match(source, /action === "verify-disabled"/u);
  assert.match(source, /expectedTrustState: verificationMode/u);
  assert.match(source, /verificationMode === "disabled"/u);
  assert.match(source, /POOL_NOT_DISABLED/u);
  assert.match(source, /PROVIDER_NOT_DISABLED/u);
  assert.match(source, /ONLY_EXACT_PREVIEW_SUBJECT_MAY_IMPERSONATE/u);
  assert.match(source, /CONDITIONAL_PREVIEW_IMPERSONATION_FORBIDDEN/u);
  assert.match(source, /FEDERATED_PREVIEW_PRINCIPAL_PROJECT_ROLES_FORBIDDEN/u);
  assert.match(source, /ONLY_EXACT_PREVIEW_INVOKER_ALLOWED/u);
  assert.match(source, /await inspectState\("disabled"\)/u);
  assert.match(source, /await inspectState\("provider-enabled-pool-disabled"\)/u);
  assert.match(source, /externalWrites: 0/u);
});

test("atomic WIF enable requires phase proof, exact scope, expiry and live Vercel readback", () => {
  assert.match(source, /forwardTrustActions\.has\(action\)/u);
  assert.match(source, /assertApprovedCloudBinding\(cliArgs, approvedScope\)/u);
  assert.match(source, /assertExternalActivationAuthorization\(cliArgs\)/u);
  assert.match(source, /assertActivationWindowOpen\(approvedScope\)/u);
  assert.match(source, /readCurrentAuthenticatedVercelPreview/u);
  assert.match(source, /provider-external-vercel-control\.mjs/u);
  assert.match(source, /CURRENT_AUTHENTICATED_VERCEL_PROJECT_READBACK_REQUIRED/u);
  assert.match(source, /acquirePreviewReadyActivationCapability/u);
  assert.match(
    compensationSource,
    /WIF_ATOMIC_ENABLE_COMPENSATION_INCOMPLETE/u,
  );
  assert.match(
    source,
    /runExternalWifAtomicEnableCompensation/u,
  );

  const scope = {
    projectId: contract.google.projectId,
    approvedGoogleAccount: "tryakim@gmail.com",
    region: contract.google.region,
    stagingExpiryDate: "2027-01-25",
  };
  const args = parseExactFlagPairs([
    "--action", "enable-provider-and-pool",
    "--project", scope.projectId,
    "--google-account", scope.approvedGoogleAccount,
    "--region", scope.region,
    "--authorized", EXTERNAL_ACTIVATION_AUTHORIZATION,
  ], {
    allowed: [
      "--action",
      "--project",
      "--google-account",
      "--region",
      "--authorized",
    ],
  });
  assert.equal(assertApprovedCloudBinding(args, scope), true);
  assert.equal(assertExternalActivationAuthorization(args), true);
  assert.equal(
    assertActivationWindowOpen(scope, {
      now: () => new Date("2027-01-24T23:59:59.999Z"),
    }).toISOString(),
    "2027-01-24T23:59:59.999Z",
  );
  args.set("--authorized", "WRONG_ACTIVATION_TOKEN");
  assert.throws(
    () => assertExternalActivationAuthorization(args),
    /EXACT_ACTIVATION_AUTHORIZATION_REQUIRED/u,
  );
  assert.throws(
    () => assertActivationWindowOpen(scope, {
      now: () => new Date("2027-01-25T00:00:00.000Z"),
    }),
    /STAGING_ACTIVATION_WINDOW_EXPIRED/u,
  );

  const wrongToken = spawnSync(process.execPath, [
    join(repo, "scripts", "provider-external-wif-control.mjs"),
    "--action", "enable-provider-and-pool",
    "--project", scope.projectId,
    "--google-account", scope.approvedGoogleAccount,
    "--region", scope.region,
    "--authorized", "WRONG_ACTIVATION_TOKEN",
  ], {
    cwd: repo,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.notEqual(wrongToken.status, 0);
  assert.equal(wrongToken.stdout, "");
  assert.match(
    wrongToken.stderr,
    /EXACT_ACTIVATION_AUTHORIZATION_REQUIRED/u,
  );
  assert.doesNotMatch(wrongToken.stderr, /VERCEL_AUTH_TOKEN_REQUIRED/u);

  const directBypass = spawnSync(process.execPath, [
    join(repo, "scripts", "provider-external-wif-control.mjs"),
    "--action", "enable-workload-identity-provider",
    "--project", scope.projectId,
    "--google-account", scope.approvedGoogleAccount,
    "--region", scope.region,
    "--authorized", EXTERNAL_ACTIVATION_AUTHORIZATION,
  ], {
    cwd: repo,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.notEqual(directBypass.status, 0);
  assert.equal(directBypass.stdout, "");
  assert.match(directBypass.stderr, /EXPLICIT_ALLOWED_ACTION_REQUIRED/u);
});

test("atomic WIF rollback attempts provider disable after pool disable fails", async () => {
  const attempts = [];
  await assert.rejects(
    runExternalWifAtomicEnableCompensation({
      disablePool() {
        attempts.push("pool-disable");
        throw new Error("simulated pool rollback failure");
      },
      disableProvider() {
        attempts.push("provider-disable");
        return { disabled: true };
      },
      readDisabledState() {
        attempts.push("combined-readback");
        assert.deepEqual(
          attempts,
          [
            "pool-disable",
            "provider-disable",
            "combined-readback",
          ],
        );
        throw new Error("pool remains enabled");
      },
    }),
    (error) => {
      assert.equal(
        error.code,
        "WIF_ATOMIC_ENABLE_COMPENSATION_INCOMPLETE"
          + "_POOL_FAILED"
          + "_PROVIDER_SUCCEEDED"
          + "_READBACK_FAILED",
      );
      assert.deepEqual(error.compensationReport, {
        poolDisableAttempted: true,
        poolDisable: "FAILED",
        providerDisableAttempted: true,
        providerDisable: "SUCCEEDED",
        combinedReadbackAttempted: true,
        combinedReadback: "FAILED",
        complete: false,
      });
      return true;
    },
  );
  assert.deepEqual(attempts, [
    "pool-disable",
    "provider-disable",
    "combined-readback",
  ]);
});

test("WIF enable accepts only a current protected team-OIDC Vercel readback", () => {
  const observedAt = new Date().toISOString();
  const exactDeploymentEnvironmentKeys = [
    "LUDYS_COMMAND_FUNCTION_URL",
    "LUDYS_DELETE_FUNCTION_URL",
    "LUDYS_DEPLOYMENT_ROLE",
    "LUDYS_GCP_PREVIEW_SERVICE_ACCOUNT",
    "LUDYS_GCP_PROJECT_NUMBER",
    "LUDYS_GCP_WIF_POOL_ID",
    "LUDYS_GCP_WIF_PROVIDER_ID",
    "LUDYS_ISSUE_FUNCTION_URL",
    "LUDYS_PROJECTION_FUNCTION_URL",
  ];
  const readback = {
    schemaVersion: "wp13.12b-ea-external-vercel-control-v2",
    action: "inspect-project",
    externalWrites: 0,
    team: {
      id: contract.vercel.teamId,
      slug: contract.vercel.teamSlug,
    },
    project: {
      id: contract.vercel.projectId,
      name: contract.vercel.projectName,
      accountId: contract.vercel.teamId,
      framework: null,
      rootDirectory: null,
      buildCommand: null,
      outputDirectory: null,
      installCommand: null,
      devCommand: null,
      autoExposeSystemEnvs: true,
      nodeVersion: "24.x",
      live: false,
      webAnalytics: null,
      speedInsights: null,
      oidcTokenConfig: { enabled: true, issuerMode: "team" },
      ssoProtection: {
        deploymentType: "prod_deployment_urls_and_all_previews",
      },
      passwordProtectionConfigured: false,
      trustedIpsConfigured: false,
      protectionBypassConfigured: false,
      protectionExceptions: [],
      domains: [],
      link: null,
    },
    repository: {
      commit: "a".repeat(40),
      tree: "b".repeat(40),
      deploymentSourceCommit: "a".repeat(40),
      deploymentSourceTree: "b".repeat(40),
      currentEvidenceHeadCommit: "4".repeat(40),
      currentEvidenceHeadTree: "5".repeat(40),
      evidenceCommitRelationship:
        "DIRECT_RECEIPT_EVIDENCE_CHILD",
      receiptEvidenceBinding: {
        receiptPath:
          "release/wp13-12b/receipts/actual/"
          + "protected-preview-receipt-test.json",
        receiptSha256: "6".repeat(64),
        artifactPaths: [
          "release/wp13-12b/receipts/actual/"
            + "authenticated-browser-proof-test.json",
          "release/wp13-12b/receipts/actual/"
            + "rollback-safety-proof-test.json",
        ],
        artifactHashes: {
          ["release/wp13-12b/receipts/actual/"
            + "authenticated-browser-proof-test.json"]:
              "4".repeat(64),
          ["release/wp13-12b/receipts/actual/"
            + "rollback-safety-proof-test.json"]:
              "3".repeat(64),
        },
        exactDiffVerified: true,
        receiptSelfHashOmittedByConstruction: true,
      },
      workingTreeClean: true,
      previewRoot: "provider/vercel/wp13-12b-preview",
      previewSourceSha256: "c".repeat(64),
      uploadManifestSha256: "d".repeat(64),
    },
    previewDeployment: {
      id: "dpl_89qyp1cskzkLrVicDaZoDbjyHuDJ",
      projectId: contract.vercel.projectId,
      ownerId: contract.vercel.teamId,
      name: contract.vercel.projectName,
      readyState: "READY",
      target: "preview",
      source: "cli",
      url:
        "https://ludys-wp13-12b-staging-a1b2c3-"
        + "trym-s-projects.vercel.app",
      sourceCommit: "a".repeat(40),
      sourceTree: "b".repeat(40),
      sourceRoot: "provider/vercel/wp13-12b-preview",
      previewSourceSha256: "c".repeat(64),
      uploadManifestSha256: "d".repeat(64),
      dryRunManifestSha256: "e".repeat(64),
      staticArtifactSha256: "f".repeat(64),
      vercelCliVersion: "58.0.0",
      vercelCliIntegritySha256:
        "735b95624518df208bd60db6439b5b13"
        + "eb596c386653ad392193d18f3537dd4b",
      deploymentRole: "active",
      deploymentRoleClaimSource:
        "AUTHENTICATED_DEPLOYMENT_METADATA_NOT_ENV_VALUE",
      oidcEnvironment: "preview",
      protectionVerified: true,
      sourceFilesVerified: true,
      deploymentUserEnvironmentKeys:
        [...exactDeploymentEnvironmentKeys],
      deploymentEnvironmentValuesExposedByProvider: false,
      deploymentRoleValueRequiresAuthenticatedBrowserProof: true,
    },
    receiptBoundRollbackDeployment: {
      id: "dpl_19qyp1cskzkLrVicDaZoDbjyHuDK",
      projectId: contract.vercel.projectId,
      ownerId: contract.vercel.teamId,
      name: contract.vercel.projectName,
      readyState: "READY",
      target: "preview",
      source: "cli",
      url:
        "https://ludys-wp13-12b-staging-r1b2c3-"
        + "trym-s-projects.vercel.app",
      sourceCommit: "a".repeat(40),
      sourceTree: "b".repeat(40),
      evidenceSha256: "3".repeat(64),
      safeDisabled: true,
      deploymentRoleClaimSource:
        "AUTHENTICATED_DEPLOYMENT_METADATA_NOT_ENV_VALUE",
      activeDeploymentId:
        "dpl_89qyp1cskzkLrVicDaZoDbjyHuDJ",
      receiptValidated: true,
      deploymentUserEnvironmentKeys:
        [...exactDeploymentEnvironmentKeys],
      deploymentEnvironmentValuesExposedByProvider: false,
      deploymentRoleValueRequiresAuthenticatedBrowserProof: true,
    },
    environmentInventory: {
      previewProjectEnvironmentKeys: [],
      activeDeploymentUserEnvironmentKeys:
        [...exactDeploymentEnvironmentKeys],
      pendingRollbackDeploymentUserEnvironmentKeys: null,
      receiptBoundRollbackDeploymentUserEnvironmentKeys:
        [...exactDeploymentEnvironmentKeys],
      deploymentEnvironmentValuesExposedByProvider: false,
      deploymentRoleValuesExposedByProvider: false,
      deploymentRoleRuntimeVerification:
        "AUTHENTICATED_BROWSER_PROOF_REQUIRED",
      autoExposeSystemEnvs: true,
      exactAllowlistVerified: true,
    },
    deploymentInventory: {
      authenticated: true,
      productionDeploymentCount: 0,
      customDomainCount: 0,
      currentCommitPreviewCount: 1,
      receiptBoundRollbackDeploymentCount: 1,
      unrelatedReadyDeploymentCount: 0,
      unrelatedLiveDeploymentCount: 0,
      unrelatedNonterminalDeploymentCount: 0,
      readyDeploymentCount: 2,
      liveDeploymentCount: 2,
    },
    authenticatedBrowserProof: {
      schemaVersion:
        "wp13.12b-vercel-authenticated-browser-proof-v1",
      status: "VERIFIED",
      observedAt,
      teamId: contract.vercel.teamId,
      teamSlug: contract.vercel.teamSlug,
      projectId: contract.vercel.projectId,
      projectName: contract.vercel.projectName,
      sourceCommit: "a".repeat(40),
      sourceTree: "b".repeat(40),
      previewSourceSha256: "c".repeat(64),
      uploadManifestSha256: "d".repeat(64),
      maximumAgeMilliseconds: 1_800_000,
      inventory: {
        activeDeploymentCount: 1,
        receiptBoundRollbackDeploymentCount: 1,
        unrelatedLiveDeploymentCount: 0,
        totalLiveDeploymentCount: 2,
      },
      active: {
        deploymentId:
          "dpl_89qyp1cskzkLrVicDaZoDbjyHuDJ",
        deploymentUrl:
          "https://ludys-wp13-12b-staging-a1b2c3-"
          + "trym-s-projects.vercel.app",
        standardProtectionSessionAuthenticated: true,
        runtimeConfigStatus: 200,
        runtimeConfigSchemaVersion:
          "wp13.12b-external-preview-config-v1",
        deploymentRole: "active",
        issuanceEnabled: true,
      },
      rollback: {
        deploymentId:
          "dpl_19qyp1cskzkLrVicDaZoDbjyHuDK",
        deploymentUrl:
          "https://ludys-wp13-12b-staging-r1b2c3-"
          + "trym-s-projects.vercel.app",
        standardProtectionSessionAuthenticated: true,
        runtimeConfigStatus: 200,
        runtimeConfigSchemaVersion:
          "wp13.12b-external-preview-config-v1",
        deploymentRole: "rollback",
        issuanceEnabled: false,
        issueStatus: 503,
        issueDenialClass: "ROLLBACK_SAFE_DISABLED",
      },
      safeguards: {
        authenticationMode:
          "VERCEL_STANDARD_PROTECTION_SESSION",
        protectionBypassUsed: false,
        protectionBypassCreated: false,
        shareableLinkCreated: false,
        oidcTokenRecorded: false,
        vercelTokenRecorded: false,
        participantsPresent: false,
        adultOperatorOnly: true,
      },
      artifactPath:
        "release/wp13-12b/receipts/actual/"
        + "authenticated-browser-proof-test.json",
      artifactSha256: "4".repeat(64),
      receiptBound: true,
    },
    wifLiveGuard: {
      schemaVersion: "wp13.12b-vercel-wif-live-guard-v1",
      providerReadbackObservedAt: observedAt,
      maximumProviderReadbackAgeMilliseconds: 120_000,
      providerReadbackAuthenticated: true,
      freshExactInventoryReadback: true,
      activeDeploymentCount: 1,
      receiptBoundRollbackDeploymentCount: 1,
      unrelatedLiveDeploymentCount: 0,
      totalLiveDeploymentCount: 2,
      authenticatedBrowserProofVerified: true,
      oidcSubjectGranularity: "PROJECT_AND_ENVIRONMENT",
      deploymentSpecificOidcSubject: false,
      allProjectPreviewDeploymentsShareOidcSubject: true,
      newDeploymentsWhileWifLiveForbidden: true,
      gitLinkWhileWifLiveForbidden: true,
    },
    previewOnly: true,
    productionDeploymentCreated: false,
    customDomainCreated: false,
    claimsDerivedFromAuthenticatedProviderReadback: true,
    oidcTokenValuePrinted: false,
    tokenPrinted: false,
  };
  assert.deepEqual(
    validateVercelActivationReadback(readback, contract),
    {
      teamId: contract.vercel.teamId,
      teamSlug: contract.vercel.teamSlug,
      projectId: contract.vercel.projectId,
      projectName: contract.vercel.projectName,
      protection: "prod_deployment_urls_and_all_previews",
      oidcIssuerMode: "team",
      deploymentId: "dpl_89qyp1cskzkLrVicDaZoDbjyHuDJ",
      deploymentUrl:
        "https://ludys-wp13-12b-staging-a1b2c3-"
        + "trym-s-projects.vercel.app",
      sourceCommit: "a".repeat(40),
      sourceTree: "b".repeat(40),
      rollbackDeploymentId:
        "dpl_19qyp1cskzkLrVicDaZoDbjyHuDK",
      rollbackDeploymentUrl:
        "https://ludys-wp13-12b-staging-r1b2c3-"
        + "trym-s-projects.vercel.app",
      rollbackEvidenceSha256: "3".repeat(64),
      authenticatedBrowserProofObservedAt: observedAt,
      providerReadbackObservedAt: observedAt,
      oidcSubjectGranularity: "PROJECT_AND_ENVIRONMENT",
    },
  );
  const missingBrowserProof = structuredClone(readback);
  missingBrowserProof.authenticatedBrowserProof = null;
  const activeEnvironmentDrift = structuredClone(readback);
  activeEnvironmentDrift.environmentInventory
    .activeDeploymentUserEnvironmentKeys.pop();
  const wrongActiveRuntimeRole = structuredClone(readback);
  wrongActiveRuntimeRole.authenticatedBrowserProof
    .active.deploymentRole = "rollback";
  const rollbackIssueNotDenied = structuredClone(readback);
  rollbackIssueNotDenied.authenticatedBrowserProof
    .rollback.issueStatus = 200;
  const browserBypassUsed = structuredClone(readback);
  browserBypassUsed.authenticatedBrowserProof
    .safeguards.protectionBypassUsed = true;
  const extraLiveDeployment = structuredClone(readback);
  extraLiveDeployment.wifLiveGuard.totalLiveDeploymentCount = 3;
  const staleProviderReadback = structuredClone(readback);
  staleProviderReadback.wifLiveGuard.providerReadbackObservedAt =
    "2026-01-01T00:00:00.000Z";
  for (const invalid of [
    {
      ...readback,
      project: {
        ...readback.project,
        oidcTokenConfig: { enabled: false, issuerMode: "team" },
      },
    },
    {
      ...readback,
      project: {
        ...readback.project,
        ssoProtection: null,
      },
    },
    {
      ...readback,
      productionDeploymentCreated: true,
      deploymentInventory: {
        ...readback.deploymentInventory,
        productionDeploymentCount: 1,
      },
    },
    missingBrowserProof,
    activeEnvironmentDrift,
    wrongActiveRuntimeRole,
    rollbackIssueNotDenied,
    browserBypassUsed,
    extraLiveDeployment,
    staleProviderReadback,
  ]) {
    assert.throws(
      () => validateVercelActivationReadback(invalid, contract),
      /CURRENT_AUTHENTICATED_PROTECTED_VERCEL_PREVIEW_READBACK_REQUIRED/u,
    );
  }
});

test("Vercel control explicitly enables only the team OIDC issuer mode", () => {
  assert.match(vercelSource, /"ensure-team-oidc"/u);
  assert.match(vercelSource, /oidcTokenConfig/u);
  assert.match(vercelSource, /VERCEL_TEAM_ISSUER_MODE_REQUIRED/u);
  assert.doesNotMatch(vercelSource, /oidcTokenConfig:\s*\{[^}]*issuerMode:\s*"global"/su);
});
