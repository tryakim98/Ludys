import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertActivationWindowOpen,
  assertApprovedCloudBinding,
  assertExternalActivationAuthorization,
  parseExactFlagPairs,
  validateCloudFieldApproval,
  validateVercelActivationReadback,
} from "../provider/firebase/tools/operator-gate-contract.mjs";
import {
  sanitizedNodeChildEnvironment,
} from "./wp13-12b-external-process-boundary.mjs";
import {
  acquireExternalWifMutationGate,
} from "./provider-external-wif-mutation-gate.mjs";
import {
  runExternalWifAtomicEnableCompensation,
} from "./provider-external-wif-compensation.mjs";

const nativeFetch = globalThis.fetch.bind(globalThis);
let fatalErrorReported = false;

function sanitizedFailureCode(error) {
  const safeCode =
    /^(?:ACTIVATION|AUTHORITY|BASE|CLOUD|CODE|CONFIRMED|CURRENT|DUPLICATE|EMULATOR|EXACT|EXPLICIT|GOOGLE_OAUTH|HASH_BOUND|LIVE|PINNED|PRODUCTION|REQUIRED|STAGING|UNKNOWN|VALID|WIF)_[A-Z0-9_]+$/u;
  for (const candidate of [error?.message, error?.code]) {
    if (
      typeof candidate === "string"
      && candidate.length <= 160
      && safeCode.test(candidate)
    ) return candidate;
  }
  return "EXTERNAL_WIF_CONTROL_FAILED";
}

function reportSanitizedFailure(error) {
  if (fatalErrorReported) return;
  fatalErrorReported = true;
  process.exitCode = 1;
  process.stderr.write(`${sanitizedFailureCode(error)}\n`);
}

process.once("uncaughtException", reportSanitizedFailure);
process.once("unhandledRejection", reportSanitizedFailure);

const {
  acquireBaseActivationCapability,
  acquireCleanupActivationCapability,
  acquirePreviewReadyActivationCapability,
  assertBaseActivationCapability,
  assertCleanupActivationCapability,
  assertPreviewReadyActivationCapability,
} = await import("./wp13-12b-activation-phase-gate.mjs");
const require = createRequire(import.meta.url);
const {
  acquirePinnedGoogleOAuthAccessToken,
  assertGoogleOAuthProductionEnvironment,
} = require("./wp13-12b-google-oauth-token-helper.cjs");
assertGoogleOAuthProductionEnvironment();
const repo = fileURLToPath(new URL("..", import.meta.url));
const activationDirectory = join(repo, "release", "wp13-12b", "external-activation");
const [approval, trust] = await Promise.all([
  readFile(join(activationDirectory, "cloud-field-approval.json"), "utf8").then(JSON.parse),
  readFile(join(activationDirectory, "vercel-google-trust-contract.json"), "utf8").then(JSON.parse),
]);

assert.equal(
  approval.authorizationEffects?.protectedPreviewAuthorized,
  true,
  "PROTECTED_PREVIEW_NOT_AUTHORIZED",
);
assert.equal(trust.google.projectId, approval.plannedProjectId, "TRUST_PROJECT_MISMATCH");
assert.equal(trust.google.region, approval.selectedRegion, "TRUST_REGION_MISMATCH");
assert.equal(trust.securityBoundary.longLivedCredentials, false, "LONG_LIVED_CREDENTIALS_FORBIDDEN");
assert.equal(trust.securityBoundary.serviceAccountKeys, false, "SERVICE_ACCOUNT_KEYS_FORBIDDEN");
assert.deepEqual(trust.google.projectRoles, [], "PREVIEW_PROJECT_ROLES_FORBIDDEN");
assert.deepEqual(
  trust.google.privateFunctionInvokerTargets,
  ["deleteSyntheticSession", "issueSyntheticSession"],
  "ONLY_PREVIEW_PROXY_PRIVATE_TARGETS_ALLOWED",
);
assert.deepEqual(
  trust.google.previewInvokerRevocationTargets,
  ["health"],
  "ONLY_LEGACY_HEALTH_BINDING_MAY_BE_REVOKED",
);
assert.deepEqual(
  trust.google.privateFunctionInvokerTargets.filter((target) => (
    trust.google.previewInvokerRevocationTargets.includes(target)
  )),
  [],
  "GRANT_AND_REVOCATION_TARGETS_MUST_BE_DISJOINT",
);

const rawArgs = process.argv.slice(2);
const actionIndex = rawArgs.indexOf("--action");
const action = actionIndex >= 0 ? rawArgs[actionIndex + 1] : undefined;
const allowedActions = new Set([
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
  "inspect",
  "verify-disabled",
  "verify",
]);
assert.ok(allowedActions.has(action), "EXPLICIT_ALLOWED_ACTION_REQUIRED");
const activationActions = new Set([
  "enable-provider-and-pool",
]);
const forwardTrustActions = new Set([
  "enable-trust-services",
  "ensure-preview-service-account",
  "ensure-workload-identity-pool",
  "ensure-workload-identity-provider",
  "grant-preview-identity-impersonation",
  "grant-private-function-invocation",
  ...activationActions,
]);
const activationFlags = Object.freeze([
  "--action",
  "--project",
  "--google-account",
  "--region",
  "--authorized",
]);
const cliArgs = parseExactFlagPairs(rawArgs, {
  allowed: forwardTrustActions.has(action) ? activationFlags : ["--action"],
  required: forwardTrustActions.has(action) ? activationFlags : ["--action"],
});
const approvedScope = validateCloudFieldApproval(approval);
if (forwardTrustActions.has(action)) {
  assertApprovedCloudBinding(cliArgs, approvedScope);
  assertExternalActivationAuthorization(cliArgs);
  assertActivationWindowOpen(approvedScope);
}

const mutationGate = await acquireExternalWifMutationGate({
  action,
  approvedScope,
  cliArgs,
  acquireBaseCapability: acquireBaseActivationCapability,
  acquireCleanupCapability: acquireCleanupActivationCapability,
  acquirePreviewReadyCapability:
    acquirePreviewReadyActivationCapability,
  assertBaseCapability: assertBaseActivationCapability,
  assertCleanupCapability: assertCleanupActivationCapability,
  assertPreviewReadyCapability:
    assertPreviewReadyActivationCapability,
  now: () => new Date(),
});
const forwardMutationAuthorization =
  mutationGate.forwardAuthorization;
const cleanupMutationAuthorization =
  mutationGate.cleanupAuthorization;

const googleOAuth = await acquirePinnedGoogleOAuthAccessToken();
assert.equal(
  googleOAuth.approvedGoogleAccount,
  approval.approvedGoogleAccount,
  "APPROVED_ACCOUNT_NOT_ACTIVE",
);
const accessToken = googleOAuth.accessToken;

const projectId = trust.google.projectId;
const projectNumber = trust.google.projectNumber;
const region = trust.google.region;
const poolId = trust.google.workloadIdentityPoolId;
const providerId = trust.google.workloadIdentityProviderId;
const previewEmail = trust.google.previewServiceAccountEmail;
const previewMember = `serviceAccount:${previewEmail}`;
const poolName = `projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}`;
const providerName = `${poolName}/providers/${providerId}`;
const providerAudience = `//iam.googleapis.com/${providerName}`;
const expectedPoolDisplayName = "LUDYS Vercel preview";
const expectedPoolDescription = "Preview-only Vercel OIDC identities; expires 2027-01-25.";
const expectedProviderDisplayName = "LUDYS Vercel preview";
const expectedProviderDescription = "Exact preview-only Vercel trust; expires 2027-01-25.";
const exactSubjectPrincipal = [
  "principal://iam.googleapis.com",
  `projects/${projectNumber}`,
  "locations/global",
  `workloadIdentityPools/${poolId}`,
  `subject/${trust.vercel.subject}`,
].join("/");
const federatedProjectMemberPrefixes = [
  `principal://iam.googleapis.com/${poolName}/`,
  `principalSet://iam.googleapis.com/${poolName}/`,
];
const serviceAccountResource = `projects/${projectId}/serviceAccounts/${encodeURIComponent(previewEmail)}`;

function readCurrentAuthenticatedVercelPreview() {
  let childEnvironment;
  try {
    childEnvironment = sanitizedNodeChildEnvironment(process.env, {
      preserveKeys: [
        "LUDYS_AUTHENTICATED_BROWSER_PROOF_PATH",
        "LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH",
      ],
    });
  } catch {
    assert.fail(
      "WIF_CHILD_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  let raw;
  try {
    raw = String(execFileSync(process.execPath, [
      join(repo, "scripts", "provider-external-vercel-control.mjs"),
      "--action",
      "inspect-project",
    ], {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 120_000,
      windowsHide: true,
      env: childEnvironment,
    })).trim();
  } catch {
    assert.fail("CURRENT_AUTHENTICATED_VERCEL_PROJECT_READBACK_REQUIRED");
  }
  let readback;
  try {
    readback = JSON.parse(raw);
  } catch {
    assert.fail("CURRENT_AUTHENTICATED_VERCEL_PROJECT_READBACK_REQUIRED");
  }
  return validateVercelActivationReadback(readback, trust);
}

async function call(url, {
  method = "GET",
  body,
  allowStatuses = [],
  mutationAuthorization,
} = {}) {
  mutationGate.assertProviderRequest({
    method,
    url,
    body,
    authorization: mutationAuthorization,
  });
  const response = await nativeFetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-goog-user-project": projectId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!response.ok && !allowStatuses.includes(response.status)) {
    const error = new Error(`GOOGLE_API_${response.status}_${data.error?.status ?? "UNKNOWN"}`);
    error.details = {
      httpStatus: response.status,
      status: data.error?.status,
      message: data.error?.message,
    };
    throw error;
  }
  return { status: response.status, data };
}

async function waitOperation(apiRoot, operation, label) {
  let current = operation;
  for (let attempt = 0; attempt < 40 && current.done !== true; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    current = (await call(`${apiRoot}/${operation.name}`)).data;
  }
  assert.equal(current.done, true, `${label}_TIMEOUT`);
  assert.equal(current.error, undefined, `${label}_FAILED`);
  return current;
}

function ensureUnconditionalBinding(policy, role, member) {
  policy.bindings ??= [];
  let binding = policy.bindings.find((candidate) => (
    candidate.role === role && candidate.condition === undefined
  ));
  if (binding === undefined) {
    binding = { role, members: [] };
    policy.bindings.push(binding);
  }
  if (binding.members.includes(member)) return false;
  binding.members.push(member);
  binding.members.sort();
  return true;
}

function hasUnconditionalBinding(policy, role, member) {
  return policy.bindings?.some((binding) => (
    binding.role === role
    && binding.condition === undefined
    && binding.members?.includes(member)
  )) ?? false;
}

function hasAnyBinding(policy, role, member) {
  return policy.bindings?.some((binding) => (
    binding.role === role && binding.members?.includes(member)
  )) ?? false;
}

function runInvokerBindings(policy) {
  return (policy.bindings ?? []).filter((binding) => (
    binding.role === "roles/run.invoker"
  ));
}

function runInvokerMembers(policy) {
  return runInvokerBindings(policy)
    .flatMap((binding) => binding.members ?? [])
    .sort();
}

function assertPrivateRunPolicySafeForGrant(policy, functionId) {
  assert.equal(
    hasAnyBinding(policy, "roles/run.invoker", "allUsers"),
    false,
    `PRIVATE_FUNCTION_PUBLIC_INVOKER_FORBIDDEN_${functionId}`,
  );
  assert.equal(
    runInvokerBindings(policy).some((binding) => binding.condition !== undefined),
    false,
    `CONDITIONAL_PRIVATE_FUNCTION_INVOKER_FORBIDDEN_${functionId}`,
  );
  assert.deepEqual(
    [...new Set(runInvokerMembers(policy).filter((member) => member !== previewMember))],
    [],
    `PRIVATE_FUNCTION_UNAPPROVED_INVOKER_${functionId}`,
  );
}

function assertExactPreviewRunInvoker(policy, functionId) {
  assertPrivateRunPolicySafeForGrant(policy, functionId);
  assert.deepEqual(
    runInvokerMembers(policy),
    [previewMember],
    `ONLY_EXACT_PREVIEW_INVOKER_ALLOWED_${functionId}`,
  );
}

function removeUnconditionalBindingMember(policy, role, member) {
  let changed = false;
  policy.bindings = (policy.bindings ?? []).flatMap((binding) => {
    if (
      binding.role !== role
      || binding.condition !== undefined
      || !binding.members?.includes(member)
    ) {
      return [binding];
    }
    changed = true;
    const members = binding.members.filter((candidate) => candidate !== member);
    return members.length === 0 ? [] : [{ ...binding, members }];
  });
  return changed;
}

async function getProject() {
  return (await call(
    `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`,
  )).data;
}

async function getProjectIamPolicy() {
  return (await call(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
    {
      method: "POST",
      body: { options: { requestedPolicyVersion: 3 } },
    },
  )).data;
}

function projectRolesForMember(policy, member) {
  return (policy.bindings ?? [])
    .filter((binding) => binding.members?.includes(member))
    .map((binding) => binding.role)
    .sort();
}

function directFederatedProjectBindings(policy) {
  return (policy.bindings ?? []).flatMap((binding) => (
    (binding.members ?? [])
      .filter((member) => federatedProjectMemberPrefixes.some((prefix) => (
        member.startsWith(prefix)
      )))
      .map((member) => ({
        role: binding.role,
        member,
        conditional: binding.condition !== undefined,
      }))
  )).sort((left, right) => (
    `${left.role}:${left.member}:${left.conditional}`
      .localeCompare(`${right.role}:${right.member}:${right.conditional}`)
  ));
}

function assertNoDirectPreviewProjectAuthority(policy) {
  assert.deepEqual(
    projectRolesForMember(policy, previewMember),
    [],
    "PREVIEW_SERVICE_ACCOUNT_PROJECT_ROLES_FORBIDDEN",
  );
  assert.deepEqual(
    directFederatedProjectBindings(policy),
    [],
    "FEDERATED_PREVIEW_PRINCIPAL_PROJECT_ROLES_FORBIDDEN",
  );
}

async function assertProjectContext() {
  const project = await getProject();
  assert.equal(project.name, `projects/${projectNumber}`, "PROJECT_NUMBER_MISMATCH");
  assert.equal(project.parent, `organizations/${approval.approvedOrganizationId}`, "PROJECT_PARENT_MISMATCH");
  assert.equal(project.state, "ACTIVE", "PROJECT_NOT_ACTIVE");
  return project;
}

async function getPreviewServiceAccount() {
  return call(
    `https://iam.googleapis.com/v1/${serviceAccountResource}`,
    { allowStatuses: [404] },
  );
}

async function getPool() {
  return call(
    `https://iam.googleapis.com/v1/${poolName}`,
    { allowStatuses: [404] },
  );
}

async function getProvider() {
  return call(
    `https://iam.googleapis.com/v1/${providerName}`,
    { allowStatuses: [404] },
  );
}

async function findIncludingDeleted({
  collectionUrl,
  collectionField,
  resourceName,
  pageSize,
  allowStatuses = [],
}) {
  const maximumPages = 10;
  const seenPageTokens = new Set();
  let pageToken;
  for (let page = 0; page < maximumPages; page += 1) {
    const url = new URL(`${collectionUrl}?showDeleted=true`);
    url.searchParams.set("pageSize", String(pageSize));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await call(url.toString(), { allowStatuses });
    if (response.status !== 200) return response;
    const match = (response.data[collectionField] ?? []).find(
      (resource) => resource.name === resourceName,
    );
    if (match !== undefined) return { status: 200, data: match };
    const nextPageToken = response.data.nextPageToken;
    if (nextPageToken === undefined || nextPageToken === "") {
      return { status: 404, data: {} };
    }
    assert.equal(
      typeof nextPageToken,
      "string",
      "WIF_LIST_PAGE_TOKEN_INVALID",
    );
    assert.equal(
      seenPageTokens.has(nextPageToken),
      false,
      "WIF_LIST_PAGINATION_CYCLE",
    );
    seenPageTokens.add(nextPageToken);
    pageToken = nextPageToken;
  }
  assert.fail("WIF_LIST_PAGINATION_LIMIT_EXCEEDED");
}

async function findPoolIncludingDeleted() {
  return findIncludingDeleted({
    collectionUrl: `https://iam.googleapis.com/v1/projects/${projectNumber}/locations/global/workloadIdentityPools`,
    collectionField: "workloadIdentityPools",
    resourceName: poolName,
    pageSize: 1000,
  });
}

async function findProviderIncludingDeleted() {
  return findIncludingDeleted({
    collectionUrl: `https://iam.googleapis.com/v1/${poolName}/providers`,
    collectionField: "workloadIdentityPoolProviders",
    resourceName: providerName,
    pageSize: 100,
    allowStatuses: [404],
  });
}

async function rereadAfterCreateConflict(reader, label) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const observed = await reader();
    if (observed.status === 200) return observed;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.fail(`${label}_CREATE_CONFLICT_NOT_RESOLVED`);
}

function assertPoolMatchesContract(resource) {
  assert.equal(resource.name, poolName, "WORKLOAD_IDENTITY_POOL_MISMATCH");
  assert.equal(resource.state, "ACTIVE", "WORKLOAD_IDENTITY_POOL_NOT_ACTIVE");
  assert.equal(resource.displayName, expectedPoolDisplayName, "POOL_DISPLAY_NAME_MISMATCH");
  assert.equal(resource.description, expectedPoolDescription, "POOL_DESCRIPTION_MISMATCH");
}

function assertProviderMatchesContract(resource) {
  assert.equal(resource.name, providerName, "WORKLOAD_IDENTITY_PROVIDER_MISMATCH");
  assert.equal(resource.state, "ACTIVE", "WORKLOAD_IDENTITY_PROVIDER_NOT_ACTIVE");
  assert.equal(
    resource.displayName,
    expectedProviderDisplayName,
    "PROVIDER_DISPLAY_NAME_MISMATCH",
  );
  assert.equal(
    resource.description,
    expectedProviderDescription,
    "PROVIDER_DESCRIPTION_MISMATCH",
  );
  assert.deepEqual(resource.attributeMapping, trust.provider.attributeMapping, "ATTRIBUTE_MAPPING_MISMATCH");
  assert.equal(resource.attributeCondition, trust.provider.attributeCondition, "ATTRIBUTE_CONDITION_MISMATCH");
  assert.equal(resource.oidc?.issuerUri, trust.vercel.issuer, "OIDC_ISSUER_MISMATCH");
  assert.deepEqual(
    resource.oidc?.allowedAudiences,
    [trust.vercel.audience],
    "OIDC_AUDIENCE_MISMATCH",
  );
}

async function setPoolDisabled(disabled, mutationAuthorization) {
  const observed = await getPool();
  assert.equal(observed.status, 200, "WORKLOAD_IDENTITY_POOL_REQUIRED");
  if (observed.data.disabled !== disabled) {
    const operation = (await call(
      `https://iam.googleapis.com/v1/${poolName}?updateMask=disabled`,
      {
        method: "PATCH",
        body: {
          name: poolName,
          disabled,
        },
        mutationAuthorization,
      },
    )).data;
    await waitOperation("https://iam.googleapis.com/v1", operation, "POOL_UPDATE");
  }
  const verified = await getPool();
  assert.equal(verified.data.disabled, disabled, "WORKLOAD_IDENTITY_POOL_DISABLED_STATE_MISMATCH");
  return {
    changed: observed.data.disabled !== disabled,
    resource: verified.data,
  };
}

async function setProviderDisabled(disabled, mutationAuthorization) {
  const observed = await getProvider();
  assert.equal(observed.status, 200, "WORKLOAD_IDENTITY_PROVIDER_REQUIRED");
  if (observed.data.disabled !== disabled) {
    const operation = (await call(
      `https://iam.googleapis.com/v1/${providerName}?updateMask=disabled`,
      {
        method: "PATCH",
        body: {
          name: providerName,
          disabled,
        },
        mutationAuthorization,
      },
    )).data;
    await waitOperation("https://iam.googleapis.com/v1", operation, "PROVIDER_UPDATE");
  }
  const verified = await getProvider();
  assert.equal(
    verified.data.disabled,
    disabled,
    "WORKLOAD_IDENTITY_PROVIDER_DISABLED_STATE_MISMATCH",
  );
  return {
    changed: observed.data.disabled !== disabled,
    resource: verified.data,
  };
}

async function getPreviewServiceAccountPolicy() {
  return (await call(
    `https://iam.googleapis.com/v1/${serviceAccountResource}:getIamPolicy`,
    {
      method: "POST",
      body: { options: { requestedPolicyVersion: 3 } },
    },
  )).data;
}

async function listFunctions() {
  return (await call(
    `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${region}/functions`,
  )).data.functions ?? [];
}

async function getRunTargets(functionIds) {
  const functions = await listFunctions();
  const byId = new Map(functions.map((fn) => [fn.name.split("/").at(-1), fn]));
  assert.deepEqual(
    [...byId.keys()].sort(),
    [
      "deleteSyntheticSession",
      "health",
      "issueSyntheticSession",
      "sessionCommand",
      "sessionProjection",
    ],
    "EXPECTED_FIVE_FUNCTIONS",
  );
  return functionIds.map((functionId) => {
    const fn = byId.get(functionId);
    assert.ok(fn, `PRIVATE_FUNCTION_MISSING_${functionId}`);
    assert.ok(fn.serviceConfig?.service, `RUN_SERVICE_MISSING_${functionId}`);
    assert.ok(fn.serviceConfig?.uri, `FUNCTION_URI_MISSING_${functionId}`);
    return {
      functionId,
      functionName: fn.name,
      runServiceName: fn.serviceConfig.service,
      audience: fn.serviceConfig.uri,
    };
  });
}

async function getPrivateRunTargets() {
  return getRunTargets(trust.google.privateFunctionInvokerTargets);
}

async function getPreviewInvokerRevocationTargets() {
  return getRunTargets(trust.google.previewInvokerRevocationTargets);
}

async function getRunPolicy(serviceName) {
  return (await call(
    `https://run.googleapis.com/v2/${serviceName}:getIamPolicy`,
  )).data;
}

let result;
await assertProjectContext();

if (action === "enable-trust-services") {
  const before = await Promise.all(trust.google.requiredApis.map(async (service) => (
    await call(
      `https://serviceusage.googleapis.com/v1/projects/${projectNumber}/services/${service}`,
      { allowStatuses: [404] },
    )
  )));
  const missing = trust.google.requiredApis.filter((service, index) => (
    before[index].status !== 200 || before[index].data.state !== "ENABLED"
  ));
  if (missing.length > 0) {
    const operation = (await call(
      `https://serviceusage.googleapis.com/v1/projects/${projectNumber}/services:batchEnable`,
      {
        method: "POST",
        body: { serviceIds: missing },
        mutationAuthorization: forwardMutationAuthorization,
      },
    )).data;
    await waitOperation("https://serviceusage.googleapis.com/v1", operation, "SERVICE_ENABLE");
  }
  const services = await Promise.all(trust.google.requiredApis.map(async (service) => {
    const observed = (await call(
      `https://serviceusage.googleapis.com/v1/projects/${projectNumber}/services/${service}`,
    )).data;
    assert.equal(observed.state, "ENABLED", `SERVICE_NOT_ENABLED_${service}`);
    return { service, state: observed.state };
  }));
  result = {
    action,
    externalWrites: missing.length > 0 ? 1 : 0,
    services,
  };
}

if (action === "ensure-preview-service-account") {
  let observed = await getPreviewServiceAccount();
  let externalWrites = 0;
  if (observed.status === 404) {
    observed = await call(
      `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`,
      {
        method: "POST",
        body: {
          accountId: trust.google.previewServiceAccountId,
          serviceAccount: {
            displayName: "LUDYS Vercel preview invoker",
            description: "Keyless preview-only invoker for private synthetic staging endpoints.",
          },
        },
        mutationAuthorization: forwardMutationAuthorization,
      },
    );
    externalWrites = 1;
  }
  assert.equal(observed.data.email, previewEmail, "PREVIEW_SERVICE_ACCOUNT_MISMATCH");
  const keys = (await call(
    `https://iam.googleapis.com/v1/${serviceAccountResource}/keys?keyTypes=USER_MANAGED`,
  )).data.keys ?? [];
  assert.equal(keys.length, 0, "PREVIEW_USER_MANAGED_KEYS_FORBIDDEN");
  result = {
    action,
    externalWrites,
    serviceAccount: {
      name: observed.data.name,
      email: observed.data.email,
      uniqueId: observed.data.uniqueId,
      disabled: observed.data.disabled ?? false,
      userManagedKeyCount: keys.length,
    },
    projectRolesGranted: [],
  };
}

if (action === "ensure-workload-identity-pool") {
  let observed = await findPoolIncludingDeleted();
  let externalWrites = 0;
  if (observed.status === 404) {
    const created = await call(
      `https://iam.googleapis.com/v1/projects/${projectNumber}/locations/global/workloadIdentityPools?workloadIdentityPoolId=${poolId}`,
      {
        method: "POST",
        body: {
          displayName: expectedPoolDisplayName,
          description: expectedPoolDescription,
          disabled: true,
        },
        allowStatuses: [409],
        mutationAuthorization: forwardMutationAuthorization,
      },
    );
    if (created.status === 409) {
      observed = await rereadAfterCreateConflict(
        findPoolIncludingDeleted,
        "POOL",
      );
    } else {
      await waitOperation("https://iam.googleapis.com/v1", created.data, "POOL_CREATE");
      observed = await findPoolIncludingDeleted();
      externalWrites = 1;
    }
  }
  assert.equal(observed.status, 200, "WORKLOAD_IDENTITY_POOL_MISSING");
  assertPoolMatchesContract(observed.data);
  if (externalWrites === 1) {
    assert.equal(observed.data.disabled, true, "NEW_POOL_MUST_START_DISABLED");
  }
  result = {
    action,
    externalWrites,
    pool: {
      name: observed.data.name,
      displayName: observed.data.displayName,
      state: observed.data.state,
      disabled: observed.data.disabled,
    },
  };
}

if (action === "ensure-workload-identity-provider") {
  const pool = await findPoolIncludingDeleted();
  assert.equal(pool.status, 200, "WORKLOAD_IDENTITY_POOL_REQUIRED");
  assertPoolMatchesContract(pool.data);
  let observed = await findProviderIncludingDeleted();
  let externalWrites = 0;
  if (observed.status === 404) {
    const created = await call(
      `https://iam.googleapis.com/v1/${poolName}/providers?workloadIdentityPoolProviderId=${providerId}`,
      {
        method: "POST",
        body: {
          displayName: expectedProviderDisplayName,
          description: expectedProviderDescription,
          disabled: true,
          attributeMapping: trust.provider.attributeMapping,
          attributeCondition: trust.provider.attributeCondition,
          oidc: {
            issuerUri: trust.vercel.issuer,
            allowedAudiences: [trust.vercel.audience],
          },
        },
        allowStatuses: [409],
        mutationAuthorization: forwardMutationAuthorization,
      },
    );
    if (created.status === 409) {
      observed = await rereadAfterCreateConflict(
        findProviderIncludingDeleted,
        "PROVIDER",
      );
    } else {
      await waitOperation("https://iam.googleapis.com/v1", created.data, "PROVIDER_CREATE");
      observed = await findProviderIncludingDeleted();
      externalWrites = 1;
    }
  }
  assert.equal(observed.status, 200, "WORKLOAD_IDENTITY_PROVIDER_MISSING");
  assertProviderMatchesContract(observed.data);
  if (externalWrites === 1) {
    assert.equal(observed.data.disabled, true, "NEW_PROVIDER_MUST_START_DISABLED");
  }
  result = {
    action,
    externalWrites,
    provider: {
      name: observed.data.name,
      displayName: observed.data.displayName,
      state: observed.data.state,
      disabled: observed.data.disabled,
      attributeMapping: observed.data.attributeMapping,
      attributeCondition: observed.data.attributeCondition,
      oidc: observed.data.oidc,
      stsAudience: providerAudience,
    },
    productionAccepted: false,
    developmentAccepted: false,
  };
}

if (
  action === "enable-workload-identity-provider"
  || action === "disable-workload-identity-provider"
) {
  const disabled = action.startsWith("disable");
  const vercelActivationReadback = disabled
    ? undefined
    : readCurrentAuthenticatedVercelPreview();
  if (!disabled) {
    await inspectState("disabled");
  }
  const update = await setProviderDisabled(
    disabled,
    disabled
      ? cleanupMutationAuthorization
      : forwardMutationAuthorization,
  );
  result = {
    action,
    externalWrites: update.changed ? 1 : 0,
    provider: {
      name: update.resource.name,
      state: update.resource.state,
      disabled: update.resource.disabled,
    },
    note: disabled
      ? "EXISTING_FEDERATED_TOKENS_ARE_NOT_REVOKED_BY_PROVIDER_DISABLE"
      : "APPLICATION_SESSION_ISSUANCE_REMAINS_SEPARATELY_FAIL_CLOSED",
    vercelActivationReadback,
  };
}

if (action === "enable-provider-and-pool") {
  let providerUpdate;
  let poolUpdate;
  try {
    await inspectState("disabled");
    providerUpdate = await setProviderDisabled(
      false,
      forwardMutationAuthorization,
    );
    await inspectState("provider-enabled-pool-disabled");
    poolUpdate = await setPoolDisabled(
      false,
      forwardMutationAuthorization,
    );
    const state = await inspectState("enabled");
    result = {
      action,
      externalWrites:
        Number(providerUpdate.changed) + Number(poolUpdate.changed),
      complete: true,
      expectedTrustState: "enabled",
      state,
      atomicPhaseGateValidated: true,
      compensationRequired: false,
    };
  } catch (error) {
    const compensationReport =
      await runExternalWifAtomicEnableCompensation({
        disablePool: () => setPoolDisabled(
          true,
          cleanupMutationAuthorization,
        ),
        disableProvider: () => setProviderDisabled(
          true,
          cleanupMutationAuthorization,
        ),
        readDisabledState: () => inspectState("disabled"),
      });
    if (Object.isExtensible(error)) {
      Object.defineProperty(error, "compensationReport", {
        configurable: false,
        enumerable: false,
        value: compensationReport,
        writable: false,
      });
    }
    throw error;
  }
}

if (
  action === "enable-workload-identity-pool"
  || action === "disable-workload-identity-pool"
) {
  const disabled = action.startsWith("disable");
  const vercelActivationReadback = disabled
    ? undefined
    : readCurrentAuthenticatedVercelPreview();
  if (!disabled) {
    const provider = await getProvider();
    assert.equal(provider.status, 200, "WORKLOAD_IDENTITY_PROVIDER_REQUIRED");
    assert.equal(provider.data.disabled, false, "ENABLE_PROVIDER_BEFORE_POOL");
    await inspectState("provider-enabled-pool-disabled");
  }
  const update = await setPoolDisabled(
    disabled,
    disabled
      ? cleanupMutationAuthorization
      : forwardMutationAuthorization,
  );
  result = {
    action,
    externalWrites: update.changed ? 1 : 0,
    pool: {
      name: update.resource.name,
      state: update.resource.state,
      disabled: update.resource.disabled,
    },
    note: disabled
      ? "EXISTING_FEDERATED_TOKENS_ARE_NOT_REVOKED_BY_POOL_DISABLE"
      : "APPLICATION_SESSION_ISSUANCE_REMAINS_SEPARATELY_FAIL_CLOSED",
    vercelActivationReadback,
  };
}

if (action === "grant-preview-identity-impersonation") {
  assert.equal((await getPreviewServiceAccount()).status, 200, "PREVIEW_SERVICE_ACCOUNT_REQUIRED");
  assert.equal((await getProvider()).status, 200, "WORKLOAD_IDENTITY_PROVIDER_REQUIRED");
  const projectPolicy = await getProjectIamPolicy();
  assertNoDirectPreviewProjectAuthority(projectPolicy);
  const policy = await getPreviewServiceAccountPolicy();
  const existingWorkloadBindings = (policy.bindings ?? [])
    .filter((binding) => binding.role === "roles/iam.workloadIdentityUser");
  assert.equal(
    existingWorkloadBindings.some(
      (binding) => binding.condition !== undefined,
    ),
    false,
    "CONDITIONAL_PREVIEW_IMPERSONATION_FORBIDDEN",
  );
  const existingWorkloadMembers = existingWorkloadBindings
    .flatMap((binding) => binding.members ?? [])
    .sort();
  assert.equal(
    existingWorkloadMembers.length === 0
      || (
        existingWorkloadMembers.length === 1
        && existingWorkloadMembers[0] === exactSubjectPrincipal
      ),
    true,
    "ONLY_EXACT_PREVIEW_SUBJECT_MAY_IMPERSONATE",
  );
  const changed = ensureUnconditionalBinding(
    policy,
    "roles/iam.workloadIdentityUser",
    exactSubjectPrincipal,
  );
  if (changed) {
    await call(
      `https://iam.googleapis.com/v1/${serviceAccountResource}:setIamPolicy`,
      {
        method: "POST",
        body: { policy },
        mutationAuthorization: forwardMutationAuthorization,
      },
    );
  }
  const verified = await getPreviewServiceAccountPolicy();
  assert.equal(
    hasUnconditionalBinding(
      verified,
      "roles/iam.workloadIdentityUser",
      exactSubjectPrincipal,
    ),
    true,
    "EXACT_SUBJECT_IMPERSONATION_MISSING",
  );
  const poolWidePrincipal = `${poolName.replace(/^projects\//u, "principalSet://iam.googleapis.com/projects/")}/*`;
  const verifiedWorkloadBindings = (verified.bindings ?? [])
    .filter((binding) => binding.role === "roles/iam.workloadIdentityUser");
  assert.equal(
    verifiedWorkloadBindings.some(
      (binding) => binding.condition !== undefined,
    ),
    false,
    "CONDITIONAL_PREVIEW_IMPERSONATION_FORBIDDEN",
  );
  const workloadMembers = verifiedWorkloadBindings
    .flatMap((binding) => binding.members ?? []);
  assert.equal(workloadMembers.includes(poolWidePrincipal), false, "WHOLE_POOL_BINDING_FORBIDDEN");
  assert.deepEqual(
    workloadMembers.sort(),
    [exactSubjectPrincipal],
    "ONLY_EXACT_PREVIEW_SUBJECT_MAY_IMPERSONATE",
  );
  result = {
    action,
    externalWrites: changed ? 1 : 0,
    serviceAccount: previewEmail,
    role: "roles/iam.workloadIdentityUser",
    principal: exactSubjectPrincipal,
    wholePoolBindingPresent: false,
    previewServiceAccountProjectRoles: [],
    directFederatedProjectBindings: [],
  };
}

if (action === "grant-private-function-invocation") {
  assert.equal((await getPreviewServiceAccount()).status, 200, "PREVIEW_SERVICE_ACCOUNT_REQUIRED");
  assertNoDirectPreviewProjectAuthority(await getProjectIamPolicy());
  const targets = await getPrivateRunTargets();
  let externalWrites = 0;
  const bindings = [];
  for (const target of targets) {
    const policy = await getRunPolicy(target.runServiceName);
    assertPrivateRunPolicySafeForGrant(policy, target.functionId);
    const changed = ensureUnconditionalBinding(policy, "roles/run.invoker", previewMember);
    if (changed) {
      await call(
        `https://run.googleapis.com/v2/${target.runServiceName}:setIamPolicy`,
        {
          method: "POST",
          body: { policy },
          mutationAuthorization: forwardMutationAuthorization,
        },
      );
      externalWrites += 1;
    }
    const verified = await getRunPolicy(target.runServiceName);
    assertExactPreviewRunInvoker(verified, target.functionId);
    bindings.push({
      ...target,
      role: "roles/run.invoker",
      member: previewMember,
      publicInvokerPresent: false,
    });
  }
  result = {
    action,
    externalWrites,
    bindings,
    publicPrivateFunctionInvoker: false,
  };
}

if (action === "revoke-private-function-invocation") {
  const targets = await getPreviewInvokerRevocationTargets();
  let externalWrites = 0;
  const bindings = [];
  for (const target of targets) {
    const policy = await getRunPolicy(target.runServiceName);
    assert.equal(
      hasAnyBinding(policy, "roles/run.invoker", "allUsers"),
      false,
      `PRIVATE_FUNCTION_PUBLIC_INVOKER_FORBIDDEN_${target.functionId}`,
    );
    assert.equal(
      policy.bindings?.some((binding) => (
        binding.role === "roles/run.invoker"
        && binding.condition !== undefined
        && binding.members?.includes(previewMember)
      )) ?? false,
      false,
      `CONDITIONAL_PREVIEW_INVOKER_UNEXPECTED_${target.functionId}`,
    );
    const changed = removeUnconditionalBindingMember(
      policy,
      "roles/run.invoker",
      previewMember,
    );
    if (changed) {
      await call(
        `https://run.googleapis.com/v2/${target.runServiceName}:setIamPolicy`,
        {
          method: "POST",
          body: { policy },
          mutationAuthorization: cleanupMutationAuthorization,
        },
      );
      externalWrites += 1;
    }
    const verified = await getRunPolicy(target.runServiceName);
    assert.equal(
      hasAnyBinding(verified, "roles/run.invoker", previewMember),
      false,
      `PREVIEW_INVOKER_REVOCATION_FAILED_${target.functionId}`,
    );
    assert.equal(
      hasAnyBinding(verified, "roles/run.invoker", "allUsers"),
      false,
      `PRIVATE_FUNCTION_BECAME_PUBLIC_${target.functionId}`,
    );
    bindings.push({
      ...target,
      role: "roles/run.invoker",
      member: previewMember,
      previewInvokerPresent: false,
      publicInvokerPresent: false,
    });
  }
  result = {
    action,
    externalWrites,
    bindings,
    publicPrivateFunctionInvoker: false,
  };
}

async function inspectState(verificationMode) {
  const requireComplete = verificationMode !== "inspect";
  const expectedPoolDisabled = (
    verificationMode === "disabled"
    || verificationMode === "provider-enabled-pool-disabled"
  );
  const expectedProviderDisabled = verificationMode === "disabled";
  const [
    pool,
    provider,
    serviceAccount,
    projectPolicy,
    serviceStates,
    targets,
    revocationTargets,
  ] = await Promise.all([
    findPoolIncludingDeleted(),
    findProviderIncludingDeleted(),
    getPreviewServiceAccount(),
    getProjectIamPolicy(),
    Promise.all(trust.google.requiredApis.map(async (service) => {
      const observed = await call(
        `https://serviceusage.googleapis.com/v1/projects/${projectNumber}/services/${service}`,
        { allowStatuses: [404] },
      );
      return {
        service,
        state: observed.status === 200 ? observed.data.state : "NOT_FOUND",
      };
    })),
    getPrivateRunTargets(),
    getPreviewInvokerRevocationTargets(),
  ]);
  let serviceAccountPolicy = { bindings: [] };
  let keys = [];
  if (serviceAccount.status === 200) {
    [serviceAccountPolicy, keys] = await Promise.all([
      getPreviewServiceAccountPolicy(),
      call(
        `https://iam.googleapis.com/v1/${serviceAccountResource}/keys?keyTypes=USER_MANAGED`,
      ).then((response) => response.data.keys ?? []),
    ]);
  }
  const runBindings = await Promise.all(targets.map(async (target) => {
    const policy = await getRunPolicy(target.runServiceName);
    return {
      ...target,
      invokerMembers: runInvokerMembers(policy),
      conditionalInvokerPresent: runInvokerBindings(policy).some(
        (binding) => binding.condition !== undefined,
      ),
      previewInvokerPresent: hasUnconditionalBinding(
        policy,
        "roles/run.invoker",
        previewMember,
      ),
      publicInvokerPresent: hasAnyBinding(
        policy,
        "roles/run.invoker",
        "allUsers",
      ),
    };
  }));
  const revokedRunBindings = await Promise.all(revocationTargets.map(async (target) => {
    const policy = await getRunPolicy(target.runServiceName);
    return {
      ...target,
      invokerMembers: runInvokerMembers(policy),
      conditionalInvokerPresent: runInvokerBindings(policy).some(
        (binding) => binding.condition !== undefined,
      ),
      previewInvokerPresent: hasAnyBinding(
        policy,
        "roles/run.invoker",
        previewMember,
      ),
      publicInvokerPresent: hasAnyBinding(
        policy,
        "roles/run.invoker",
        "allUsers",
      ),
    };
  }));
  const projectRoles = projectRolesForMember(projectPolicy, previewMember);
  const federatedProjectBindings = directFederatedProjectBindings(projectPolicy);
  const exactSubjectPresent = hasUnconditionalBinding(
    serviceAccountPolicy,
    "roles/iam.workloadIdentityUser",
    exactSubjectPrincipal,
  );
  const impersonationBindings = (serviceAccountPolicy.bindings ?? [])
    .filter((binding) => binding.role === "roles/iam.workloadIdentityUser");
  const impersonationMembers = impersonationBindings
    .flatMap((binding) => binding.members ?? [])
    .sort();
  const conditionalImpersonationPresent = impersonationBindings.some(
    (binding) => binding.condition !== undefined,
  );
  const observed = {
    services: serviceStates,
    pool: pool.status === 200
      ? {
          present: true,
          name: pool.data.name,
          displayName: pool.data.displayName,
          description: pool.data.description,
          state: pool.data.state,
          disabled: pool.data.disabled,
          softDeleted: pool.data.state === "DELETED",
        }
      : { present: false },
    provider: provider.status === 200
      ? {
          present: true,
          name: provider.data.name,
          displayName: provider.data.displayName,
          description: provider.data.description,
          state: provider.data.state,
          disabled: provider.data.disabled,
          softDeleted: provider.data.state === "DELETED",
          attributeMapping: provider.data.attributeMapping,
          attributeCondition: provider.data.attributeCondition,
          oidc: provider.data.oidc,
        }
      : { present: false },
    serviceAccount: serviceAccount.status === 200
      ? {
          present: true,
          name: serviceAccount.data.name,
          email: serviceAccount.data.email,
          disabled: serviceAccount.data.disabled ?? false,
          projectRoles,
          userManagedKeyCount: keys.length,
        }
      : { present: false },
    directFederatedProjectBindings: federatedProjectBindings,
    impersonation: {
      role: "roles/iam.workloadIdentityUser",
      exactSubjectPrincipal,
      exactSubjectPresent,
      members: impersonationMembers,
      conditionalBindingPresent: conditionalImpersonationPresent,
    },
    runBindings,
    revokedRunBindings,
  };
  if (requireComplete) {
    assert.deepEqual(
      serviceStates.map(({ state }) => state),
      trust.google.requiredApis.map(() => "ENABLED"),
      "TRUST_SERVICES_NOT_ENABLED",
    );
    assert.equal(observed.pool.present, true, "POOL_NOT_CONFIGURED");
    assertPoolMatchesContract(pool.data);
    assert.equal(observed.pool.state, "ACTIVE", "POOL_NOT_ACTIVE");
    assert.equal(
      observed.pool.disabled,
      expectedPoolDisabled,
      expectedPoolDisabled ? "POOL_NOT_DISABLED" : "POOL_DISABLED",
    );
    assert.equal(observed.provider.present, true, "PROVIDER_NOT_CONFIGURED");
    assertProviderMatchesContract(provider.data);
    assert.equal(observed.provider.state, "ACTIVE", "PROVIDER_NOT_ACTIVE");
    assert.equal(
      observed.provider.disabled,
      expectedProviderDisabled,
      expectedProviderDisabled ? "PROVIDER_NOT_DISABLED" : "PROVIDER_DISABLED",
    );
    assert.deepEqual(
      observed.provider.attributeMapping,
      trust.provider.attributeMapping,
      "ATTRIBUTE_MAPPING_MISMATCH",
    );
    assert.equal(
      observed.provider.attributeCondition,
      trust.provider.attributeCondition,
      "ATTRIBUTE_CONDITION_MISMATCH",
    );
    assert.equal(observed.provider.oidc?.issuerUri, trust.vercel.issuer, "OIDC_ISSUER_MISMATCH");
    assert.deepEqual(
      observed.provider.oidc?.allowedAudiences,
      [trust.vercel.audience],
      "OIDC_AUDIENCE_MISMATCH",
    );
    assert.equal(observed.serviceAccount.present, true, "PREVIEW_SERVICE_ACCOUNT_NOT_CONFIGURED");
    assert.equal(observed.serviceAccount.email, previewEmail, "PREVIEW_SERVICE_ACCOUNT_MISMATCH");
    assert.equal(observed.serviceAccount.disabled, false, "PREVIEW_SERVICE_ACCOUNT_DISABLED");
    assert.deepEqual(observed.serviceAccount.projectRoles, [], "PREVIEW_PROJECT_ROLES_FORBIDDEN");
    assert.deepEqual(
      observed.directFederatedProjectBindings,
      [],
      "FEDERATED_PREVIEW_PRINCIPAL_PROJECT_ROLES_FORBIDDEN",
    );
    assert.equal(observed.serviceAccount.userManagedKeyCount, 0, "PREVIEW_KEYS_FORBIDDEN");
    assert.equal(exactSubjectPresent, true, "EXACT_SUBJECT_IMPERSONATION_MISSING");
    assert.equal(
      conditionalImpersonationPresent,
      false,
      "CONDITIONAL_PREVIEW_IMPERSONATION_FORBIDDEN",
    );
    assert.deepEqual(
      impersonationMembers,
      [exactSubjectPrincipal],
      "ONLY_EXACT_PREVIEW_SUBJECT_MAY_IMPERSONATE",
    );
    for (const binding of runBindings) {
      assert.equal(binding.previewInvokerPresent, true, `RUN_INVOKER_MISSING_${binding.functionId}`);
      assert.equal(binding.publicInvokerPresent, false, `PRIVATE_FUNCTION_PUBLIC_${binding.functionId}`);
      assert.equal(
        binding.conditionalInvokerPresent,
        false,
        `CONDITIONAL_PRIVATE_FUNCTION_INVOKER_FORBIDDEN_${binding.functionId}`,
      );
      assert.deepEqual(
        binding.invokerMembers,
        [previewMember],
        `ONLY_EXACT_PREVIEW_INVOKER_ALLOWED_${binding.functionId}`,
      );
    }
    for (const binding of revokedRunBindings) {
      assert.equal(
        binding.previewInvokerPresent,
        false,
        `PREVIEW_INVOKER_REVOCATION_FAILED_${binding.functionId}`,
      );
      assert.equal(binding.publicInvokerPresent, false, `PRIVATE_FUNCTION_PUBLIC_${binding.functionId}`);
    }
  }
  return observed;
}

if (action === "inspect" || action === "verify-disabled" || action === "verify") {
  const verificationMode = action === "verify"
    ? "enabled"
    : action === "verify-disabled"
      ? "disabled"
      : "inspect";
  result = {
    action,
    externalWrites: 0,
    complete: action !== "inspect",
    expectedTrustState: verificationMode,
    state: await inspectState(verificationMode),
  };
}

process.stdout.write(`${JSON.stringify({
  schemaVersion: "wp13.12b-ea-external-wif-control-v1",
  activeAccount: googleOAuth.approvedGoogleAccount,
  projectId,
  projectNumber,
  region,
  ...result,
  previewOnly: true,
  productionAuthorized: false,
  stableParticipantIdentityConfigured: false,
  serviceAccountKeyCreated: false,
  accessTokenPrinted: false,
  oidcTokenPrinted: false,
}, null, 2)}\n`);
