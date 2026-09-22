import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireExternalCloudControlGate,
} from "./provider-external-cloud-control-gate.mjs";

const nativeFetch = globalThis.fetch.bind(globalThis);
let fatalErrorReported = false;

function sanitizedFailureCode(error) {
  const safeCode =
    /^(?:ACTIVATION|AUTHORITY|BASE|CLOUD|CODE|CONFIRMED|DUPLICATE|EMULATOR|EXACT|EXPLICIT|GOOGLE_OAUTH|HASH_BOUND|PINNED|PRODUCTION|REQUIRED|STAGING|UNKNOWN|VALID)_[A-Z0-9_]+$/u;
  for (const candidate of [error?.message, error?.code]) {
    if (
      typeof candidate === "string"
      && candidate.length <= 160
      && safeCode.test(candidate)
    ) return candidate;
  }
  return "EXTERNAL_CLOUD_CONTROL_FAILED";
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
  assertBaseActivationCapability,
} = await import("./wp13-12b-activation-phase-gate.mjs");
const require = createRequire(import.meta.url);
const {
  acquirePinnedGoogleOAuthAccessToken,
  assertGoogleOAuthProductionEnvironment,
} = require("./wp13-12b-google-oauth-token-helper.cjs");
const repo = fileURLToPath(new URL("..", import.meta.url));
const approval = JSON.parse(await readFile(
  join(repo, "release", "wp13-12b", "external-activation", "cloud-field-approval.json"),
  "utf8",
));
const rawArgs = process.argv.slice(2);
assertGoogleOAuthProductionEnvironment();
const {
  action,
  approvedScope,
  assertMutationAllowed,
} = await acquireExternalCloudControlGate({
  rawArgs,
  approval,
  acquireActivationCapability: acquireBaseActivationCapability,
  assertActivationCapability: assertBaseActivationCapability,
});
const projectId = approvedScope.projectId;

const googleOAuth = await acquirePinnedGoogleOAuthAccessToken();
assert.equal(
  googleOAuth.approvedGoogleAccount,
  approval.approvedGoogleAccount,
  "APPROVED_ACCOUNT_NOT_ACTIVE",
);
const accessToken = googleOAuth.accessToken;

async function call(url, {
  method = "GET",
  body,
  allowStatuses = [],
  mutation = false,
} = {}) {
  if (mutation) assertMutationAllowed();
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

const billingAccountName = `billingAccounts/${approval.approvedBillingAccount}`;
const runtimeAccountId = "ludys-staging-runtime";
const runtimeEmail = `${runtimeAccountId}@${projectId}.iam.gserviceaccount.com`;
const secretId = "LUDYS_CAPABILITY_HMAC_KEY";
const project = (await call(
  `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`,
)).data;
assert.equal(project.parent, `organizations/${approval.approvedOrganizationId}`, "PROJECT_PARENT_MISMATCH");
assert.equal(project.displayName, approval.projectDisplayName, "PROJECT_DISPLAY_NAME_MISMATCH");
assert.equal(project.state, "ACTIVE", "PROJECT_NOT_ACTIVE");
const secretName = `${project.name}/secrets/${secretId}`;
const projectNumber = project.name.split("/")[1];
assert.match(projectNumber, /^\d+$/u, "PROJECT_NUMBER_REQUIRED");
const buildEmail = `${projectNumber}-compute@developer.gserviceaccount.com`;
const buildMember = `serviceAccount:${buildEmail}`;
const functionSourceBucket = `gcf-v2-sources-${projectNumber}-${approval.selectedRegion}`;
const functionArtifactRepository = [
  `projects/${projectId}`,
  "locations",
  approval.selectedRegion,
  "repositories/gcf-artifacts",
].join("/");

async function getBillingInfo() {
  return (await call(
    `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
  )).data;
}

async function listBudgets() {
  return (await call(
    `https://billingbudgets.googleapis.com/v1/${billingAccountName}/budgets?pageSize=1000`,
  )).data.budgets ?? [];
}

function safeBillingInfo(info) {
  return {
    name: info.name,
    projectId: info.projectId,
    billingAccountName: info.billingAccountName,
    billingEnabled: info.billingEnabled,
  };
}

let result;
if (action === "create-runtime-service-account") {
  const accountPath = `projects/${projectId}/serviceAccounts/${encodeURIComponent(runtimeEmail)}`;
  const existing = await call(
    `https://iam.googleapis.com/v1/${accountPath}`,
    { allowStatuses: [404] },
  );
  let serviceAccount = existing.data;
  let externalWrites = 0;
  if (existing.status === 404) {
    serviceAccount = (await call(
      `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`,
      {
        method: "POST",
        mutation: true,
        body: {
          accountId: runtimeAccountId,
          serviceAccount: {
            displayName: "LUDYS WP13-12B staging runtime",
            description: "Synthetic staging Functions runtime only; no keys.",
          },
        },
      },
    )).data;
    externalWrites = 1;
  }
  assert.equal(serviceAccount.email, runtimeEmail, "RUNTIME_SERVICE_ACCOUNT_MISMATCH");
  result = {
    action,
    externalWrites,
    serviceAccount: {
      name: serviceAccount.name,
      email: serviceAccount.email,
      uniqueId: serviceAccount.uniqueId,
      disabled: serviceAccount.disabled ?? false,
    },
    jsonKeysCreated: 0,
  };
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

async function getFunctionArtifactRepositoryIamPolicy() {
  return (await call(
    `https://artifactregistry.googleapis.com/v1/${functionArtifactRepository}:getIamPolicy`,
  )).data;
}

async function getFunctionSourceBucketIamPolicy() {
  return (await call(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(functionSourceBucket)}/iam`,
  )).data;
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
  return true;
}

function hasBinding(policy, role, member) {
  return policy.bindings?.some((binding) => (
    binding.role === role
    && binding.condition === undefined
    && binding.members?.includes(member)
  )) ?? false;
}

async function assertObservedBuildScope() {
  const functions = (await call(
    `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${approval.selectedRegion}/functions`,
  )).data.functions ?? [];
  assert.equal(functions.length, 5, "EXPECTED_FIVE_STAGING_FUNCTIONS");
  for (const fn of functions) {
    assert.equal(
      fn.buildConfig?.source?.storageSource?.bucket,
      functionSourceBucket,
      "FUNCTION_SOURCE_BUCKET_MISMATCH",
    );
    assert.equal(
      fn.buildConfig?.dockerRepository,
      functionArtifactRepository,
      "FUNCTION_ARTIFACT_REPOSITORY_MISMATCH",
    );
  }
  const builds = (await call(
    `https://cloudbuild.googleapis.com/v1/projects/${projectId}/locations/${approval.selectedRegion}/builds?pageSize=20`,
  )).data.builds ?? [];
  const observedBuilds = builds.filter((build) => build.serviceAccount !== undefined);
  assert.ok(observedBuilds.length >= 5, "EXPECTED_FAILED_FUNCTION_BUILDS");
  for (const build of observedBuilds) {
    assert.equal(
      build.serviceAccount,
      `projects/${projectId}/serviceAccounts/${buildEmail}`,
      "BUILD_SERVICE_ACCOUNT_MISMATCH",
    );
  }
  return {
    functionCount: functions.length,
    observedBuildCount: observedBuilds.length,
  };
}

if (action === "grant-runtime-project-roles") {
  const requiredRoles = [
    "roles/datastore.user",
    "roles/logging.logWriter",
  ];
  const member = `serviceAccount:${runtimeEmail}`;
  const policy = await getProjectIamPolicy();
  let changed = false;
  policy.bindings ??= [];
  for (const role of requiredRoles) {
    let binding = policy.bindings.find((candidate) => (
      candidate.role === role && candidate.condition === undefined
    ));
    if (binding === undefined) {
      binding = { role, members: [] };
      policy.bindings.push(binding);
    }
    if (!binding.members.includes(member)) {
      binding.members.push(member);
      changed = true;
    }
  }
  if (changed) {
    await call(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`,
      {
        method: "POST",
        mutation: true,
        body: { policy },
      },
    );
  }
  const verified = await getProjectIamPolicy();
  const bindings = requiredRoles.map((role) => ({
    role,
    memberPresent: verified.bindings?.some((binding) => (
      binding.role === role && binding.members?.includes(member)
    )) ?? false,
  }));
  for (const binding of bindings) assert.equal(binding.memberPresent, true, `RUNTIME_ROLE_MISSING_${binding.role}`);
  const ownerBinding = verified.bindings?.find((binding) => binding.role === "roles/owner");
  assert.equal(
    ownerBinding?.members?.includes(member) ?? false,
    false,
    "RUNTIME_OWNER_ROLE_FORBIDDEN",
  );
  result = {
    action,
    externalWrites: changed ? 1 : 0,
    runtimeServiceAccount: runtimeEmail,
    bindings,
    ownerRolePresent: false,
  };
}

async function getSecret() {
  return call(
    `https://secretmanager.googleapis.com/v1/${secretName}`,
    { allowStatuses: [404] },
  );
}

if (action === "create-capability-secret") {
  const existing = await getSecret();
  let secret = existing.data;
  let secretCreated = false;
  if (existing.status === 404) {
    secret = (await call(
      `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets?secretId=${secretId}`,
      {
        method: "POST",
        mutation: true,
        body: {
          replication: {
            userManaged: {
              replicas: [{ location: approval.selectedRegion }],
            },
          },
          labels: {
            data_classification: "synthetic-capability-only",
            wp: "13-12b",
          },
        },
      },
    )).data;
    secretCreated = true;
  }
  const versionsBefore = (await call(
    `https://secretmanager.googleapis.com/v1/${secretName}/versions?filter=state%3AENABLED`,
  )).data.versions ?? [];
  let version = versionsBefore[0];
  let versionCreated = false;
  if (version === undefined) {
    const key = randomBytes(48).toString("base64url");
    try {
      version = (await call(
        `https://secretmanager.googleapis.com/v1/${secretName}:addVersion`,
        {
          method: "POST",
          mutation: true,
          body: {
            payload: {
              data: Buffer.from(key, "utf8").toString("base64"),
            },
          },
        },
      )).data;
      versionCreated = true;
    } finally {
      // The generated key exists only in this process and is never printed.
    }
  }
  assert.equal(secret.name, secretName, "SECRET_NAME_MISMATCH");
  assert.equal(
    secret.replication?.userManaged?.replicas?.[0]?.location,
    approval.selectedRegion,
    "SECRET_REGION_MISMATCH",
  );
  result = {
    action,
    externalWrites: Number(secretCreated) + Number(versionCreated),
    secret: {
      name: secret.name,
      replication: secret.replication,
      labels: secret.labels,
    },
    enabledVersion: {
      name: version.name,
      state: version.state,
    },
    secretValuePrinted: false,
    secretValueWrittenToDisk: false,
  };
}

async function getSecretIamPolicy() {
  return (await call(
    `https://secretmanager.googleapis.com/v1/${secretName}:getIamPolicy`,
  )).data;
}

if (action === "grant-secret-access") {
  const member = `serviceAccount:${runtimeEmail}`;
  const role = "roles/secretmanager.secretAccessor";
  const policy = await getSecretIamPolicy();
  policy.bindings ??= [];
  let binding = policy.bindings.find((candidate) => candidate.role === role);
  let changed = false;
  if (binding === undefined) {
    binding = { role, members: [] };
    policy.bindings.push(binding);
  }
  if (!binding.members.includes(member)) {
    binding.members.push(member);
    changed = true;
  }
  if (changed) {
    await call(
      `https://secretmanager.googleapis.com/v1/${secretName}:setIamPolicy`,
      {
        method: "POST",
        mutation: true,
        body: { policy },
      },
    );
  }
  const verified = await getSecretIamPolicy();
  const memberPresent = verified.bindings?.some((candidate) => (
    candidate.role === role && candidate.members?.includes(member)
  )) ?? false;
  assert.equal(memberPresent, true, "SECRET_ACCESS_BINDING_MISSING");
  result = {
    action,
    externalWrites: changed ? 1 : 0,
    secret: secretName,
    role,
    runtimeServiceAccount: runtimeEmail,
    memberPresent,
  };
}

if (action === "inspect-security") {
  const serviceAccount = (await call(
    `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts/${encodeURIComponent(runtimeEmail)}`,
  )).data;
  const projectPolicy = await getProjectIamPolicy();
  const secret = (await getSecret()).data;
  const secretPolicy = await getSecretIamPolicy();
  const versions = (await call(
    `https://secretmanager.googleapis.com/v1/${secretName}/versions?filter=state%3AENABLED`,
  )).data.versions ?? [];
  const member = `serviceAccount:${runtimeEmail}`;
  result = {
    action,
    externalWrites: 0,
    runtimeServiceAccount: {
      name: serviceAccount.name,
      email: serviceAccount.email,
      disabled: serviceAccount.disabled ?? false,
      roles: [
        "roles/datastore.user",
        "roles/logging.logWriter",
      ].filter((role) => projectPolicy.bindings?.some((binding) => (
        binding.role === role && binding.members?.includes(member)
      ))),
      ownerRolePresent: projectPolicy.bindings?.some((binding) => (
        binding.role === "roles/owner" && binding.members?.includes(member)
      )) ?? false,
    },
    secret: {
      name: secret.name,
      replication: secret.replication,
      enabledVersionCount: versions.length,
      runtimeAccessor: secretPolicy.bindings?.some((binding) => (
        binding.role === "roles/secretmanager.secretAccessor"
        && binding.members?.includes(member)
      )) ?? false,
    },
    serviceAccountJsonKeysCreated: 0,
    secretValuePrinted: false,
  };
}

if (action === "inspect-build-security") {
  const observedScope = await assertObservedBuildScope();
  const projectPolicy = await getProjectIamPolicy();
  const repositoryPolicy = await getFunctionArtifactRepositoryIamPolicy();
  const bucketPolicy = await getFunctionSourceBucketIamPolicy();
  result = {
    action,
    externalWrites: 0,
    buildServiceAccount: buildEmail,
    observedScope,
    bindings: {
      projectLoggingWriter: hasBinding(
        projectPolicy,
        "roles/logging.logWriter",
        buildMember,
      ),
      artifactRepositoryWriter: hasBinding(
        repositoryPolicy,
        "roles/artifactregistry.writer",
        buildMember,
      ),
      sourceBucketObjectViewer: hasBinding(
        bucketPolicy,
        "roles/storage.objectViewer",
        buildMember,
      ),
    },
    scopes: {
      logging: project.name,
      artifactRepository: functionArtifactRepository,
      sourceBucket: functionSourceBucket,
    },
    elevatedProjectRolesPresent: [
      "roles/owner",
      "roles/editor",
    ].filter((role) => projectPolicy.bindings?.some((binding) => (
      binding.role === role && binding.members?.includes(buildMember)
    ))),
    runtimeServiceAccountUnchanged: runtimeEmail,
  };
}

if (action === "grant-build-service-account-roles") {
  const observedScope = await assertObservedBuildScope();
  let externalWrites = 0;

  const projectPolicy = await getProjectIamPolicy();
  if (ensureUnconditionalBinding(
    projectPolicy,
    "roles/logging.logWriter",
    buildMember,
  )) {
    await call(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`,
      {
        method: "POST",
        mutation: true,
        body: { policy: projectPolicy },
      },
    );
    externalWrites += 1;
  }

  const repositoryPolicy = await getFunctionArtifactRepositoryIamPolicy();
  if (ensureUnconditionalBinding(
    repositoryPolicy,
    "roles/artifactregistry.writer",
    buildMember,
  )) {
    await call(
      `https://artifactregistry.googleapis.com/v1/${functionArtifactRepository}:setIamPolicy`,
      {
        method: "POST",
        mutation: true,
        body: { policy: repositoryPolicy },
      },
    );
    externalWrites += 1;
  }

  const bucketPolicy = await getFunctionSourceBucketIamPolicy();
  if (ensureUnconditionalBinding(
    bucketPolicy,
    "roles/storage.objectViewer",
    buildMember,
  )) {
    await call(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(functionSourceBucket)}/iam`,
      {
        method: "PUT",
        mutation: true,
        body: bucketPolicy,
      },
    );
    externalWrites += 1;
  }

  const verifiedProjectPolicy = await getProjectIamPolicy();
  const verifiedRepositoryPolicy = await getFunctionArtifactRepositoryIamPolicy();
  const verifiedBucketPolicy = await getFunctionSourceBucketIamPolicy();
  const bindings = {
    projectLoggingWriter: hasBinding(
      verifiedProjectPolicy,
      "roles/logging.logWriter",
      buildMember,
    ),
    artifactRepositoryWriter: hasBinding(
      verifiedRepositoryPolicy,
      "roles/artifactregistry.writer",
      buildMember,
    ),
    sourceBucketObjectViewer: hasBinding(
      verifiedBucketPolicy,
      "roles/storage.objectViewer",
      buildMember,
    ),
  };
  for (const [name, present] of Object.entries(bindings)) {
    assert.equal(present, true, `BUILD_BINDING_MISSING_${name}`);
  }
  const elevatedProjectRolesPresent = [
    "roles/owner",
    "roles/editor",
  ].filter((role) => verifiedProjectPolicy.bindings?.some((binding) => (
    binding.role === role && binding.members?.includes(buildMember)
  )));
  assert.deepEqual(
    elevatedProjectRolesPresent,
    [],
    "BUILD_SERVICE_ACCOUNT_ELEVATED_ROLE_FORBIDDEN",
  );
  result = {
    action,
    externalWrites,
    buildServiceAccount: buildEmail,
    observedScope,
    bindings,
    scopes: {
      logging: project.name,
      artifactRepository: functionArtifactRepository,
      sourceBucket: functionSourceBucket,
    },
    elevatedProjectRolesPresent,
    runtimeServiceAccountUnchanged: runtimeEmail,
  };
}

if (action === "inspect-functions") {
  const functions = (await call(
    `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${approval.selectedRegion}/functions`,
  )).data.functions ?? [];
  result = {
    action,
    externalWrites: 0,
    functions: functions.map((fn) => ({
      name: fn.name,
      state: fn.state,
      stateMessages: fn.stateMessages,
      environment: fn.environment,
      url: fn.url,
      buildConfig: {
        runtime: fn.buildConfig?.runtime,
        entryPoint: fn.buildConfig?.entryPoint,
        dockerRepository: fn.buildConfig?.dockerRepository,
        source: {
          storageSource: fn.buildConfig?.source?.storageSource,
        },
        environmentVariableKeys: Object.keys(fn.buildConfig?.environmentVariables ?? {}),
      },
      serviceConfig: {
        service: fn.serviceConfig?.service,
        uri: fn.serviceConfig?.uri,
        serviceAccountEmail: fn.serviceConfig?.serviceAccountEmail,
        minInstanceCount: fn.serviceConfig?.minInstanceCount,
        maxInstanceCount: fn.serviceConfig?.maxInstanceCount,
        timeoutSeconds: fn.serviceConfig?.timeoutSeconds,
        environmentVariableKeys: Object.keys(fn.serviceConfig?.environmentVariables ?? {}),
        secretEnvironmentVariables: (fn.serviceConfig?.secretEnvironmentVariables ?? []).map((secret) => ({
          key: secret.key,
          projectId: secret.projectId,
          secret: secret.secret,
          version: secret.version,
        })),
      },
    })),
    secretValuesPrinted: false,
  };
}

if (action === "inspect-function-operations") {
  const operations = (await call(
    `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${approval.selectedRegion}/operations`,
  )).data.operations ?? [];
  const builds = (await call(
    `https://cloudbuild.googleapis.com/v1/projects/${projectId}/locations/${approval.selectedRegion}/builds?pageSize=20`,
  )).data.builds ?? [];
  result = {
    action,
    externalWrites: 0,
    operations: operations.map((operation) => ({
      name: operation.name,
      done: operation.done ?? false,
      error: operation.error,
      target: operation.metadata?.target,
      verb: operation.metadata?.verb,
      createTime: operation.metadata?.createTime,
      endTime: operation.metadata?.endTime,
    })),
    builds: builds.map((build) => ({
      id: build.id,
      createTime: build.createTime,
      finishTime: build.finishTime,
      status: build.status,
      statusDetail: build.statusDetail,
      failureInfo: build.failureInfo,
      serviceAccount: build.serviceAccount,
      source: {
        storageSource: build.source?.storageSource,
      },
      resolvedStorageSource: build.sourceProvenance?.resolvedStorageSource,
      logUrl: build.logUrl,
      images: build.images,
    })),
    buildLogsRead: false,
    secretValuesPrinted: false,
  };
}

if (action === "inspect-runtime-security") {
  const functions = (await call(
    `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${approval.selectedRegion}/functions`,
  )).data.functions ?? [];
  assert.equal(functions.length, 5, "EXPECTED_FIVE_STAGING_FUNCTIONS");
  const expectedPublicServices = new Set([
    "sessioncommand",
    "sessionprojection",
  ]);
  const runServices = await Promise.all(functions.map(async (fn) => {
    const serviceName = fn.serviceConfig?.service;
    assert.ok(serviceName, "FUNCTION_RUN_SERVICE_REQUIRED");
    const service = (await call(`https://run.googleapis.com/v2/${serviceName}`)).data;
    const policy = (await call(
      `https://run.googleapis.com/v2/${serviceName}:getIamPolicy`,
    )).data;
    const shortName = serviceName.split("/").at(-1);
    const publicInvoker = policy.bindings?.some((binding) => (
      binding.role === "roles/run.invoker"
      && binding.members?.includes("allUsers")
    )) ?? false;
    assert.equal(
      publicInvoker,
      expectedPublicServices.has(shortName),
      `RUN_INVOKER_POLICY_MISMATCH_${shortName}`,
    );
    const container = service.template?.containers?.[0] ?? {};
    return {
      name: service.name,
      uri: service.uri,
      latestReadyRevision: service.latestReadyRevision,
      observedGeneration: service.observedGeneration,
      ingress: service.ingress,
      serviceAccount: service.template?.serviceAccount,
      scaling: service.template?.scaling,
      timeout: service.template?.timeout,
      publicInvoker,
      invokerMembers: (policy.bindings ?? [])
        .filter((binding) => binding.role === "roles/run.invoker")
        .flatMap((binding) => binding.members ?? [])
        .sort(),
      environment: (container.env ?? []).map((entry) => ({
        name: entry.name,
        allowedValue: entry.name === "LUDYS_STAGING_SESSION_ISSUANCE_ENABLED"
          ? entry.value
          : undefined,
        secretReference: entry.valueSource?.secretKeyRef === undefined
          ? undefined
          : {
              secret: entry.valueSource.secretKeyRef.secret,
              version: entry.valueSource.secretKeyRef.version,
            },
      })),
    };
  }));
  const issueService = runServices.find((service) => (
    service.name.endsWith("/issuesyntheticsession")
  ));
  assert.ok(issueService, "ISSUE_SERVICE_REQUIRED");
  const issuanceFlag = issueService.environment.find((entry) => (
    entry.name === "LUDYS_STAGING_SESSION_ISSUANCE_ENABLED"
  ))?.allowedValue;
  assert.notEqual(issuanceFlag, "true", "SESSION_ISSUANCE_MUST_START_DISABLED");

  const projectPolicy = await getProjectIamPolicy();
  const runtimeMember = `serviceAccount:${runtimeEmail}`;
  const runtimeRoles = (projectPolicy.bindings ?? [])
    .filter((binding) => binding.members?.includes(runtimeMember))
    .map((binding) => binding.role)
    .sort();
  assert.deepEqual(
    runtimeRoles,
    ["roles/datastore.user", "roles/logging.logWriter"],
    "RUNTIME_SERVICE_ACCOUNT_ROLE_SET_MISMATCH",
  );
  const runtimeKeys = (await call(
    `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts/${encodeURIComponent(runtimeEmail)}/keys?keyTypes=USER_MANAGED`,
  )).data.keys ?? [];
  assert.equal(runtimeKeys.length, 0, "RUNTIME_USER_MANAGED_KEYS_FORBIDDEN");

  const secret = (await getSecret()).data;
  const secretVersions = (await call(
    `https://secretmanager.googleapis.com/v1/${secretName}/versions?filter=state%3AENABLED`,
  )).data.versions ?? [];
  const database = (await call(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`,
  )).data;
  const control = await call(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/syntheticStagingControl/current`,
    { allowStatuses: [404] },
  );

  async function listDocuments(collectionId) {
    const documents = [];
    let pageToken;
    do {
      const params = new URLSearchParams({ pageSize: "100" });
      if (pageToken !== undefined) params.set("pageToken", pageToken);
      const page = (await call(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}?${params}`,
      )).data;
      documents.push(...(page.documents ?? []));
      pageToken = page.nextPageToken;
      assert.ok(documents.length <= 1000, "SYNTHETIC_DOCUMENT_INVENTORY_LIMIT_EXCEEDED");
    } while (pageToken !== undefined);
    return documents;
  }

  const collections = Object.fromEntries(await Promise.all([
    "syntheticSessions",
    "syntheticCapabilityGrants",
    "syntheticSessionTombstones",
  ].map(async (collectionId) => {
    const documents = await listDocuments(collectionId);
    return [collectionId, {
      count: documents.length,
      documentNames: documents.map((document) => document.name),
    }];
  })));
  const repository = (await call(
    `https://artifactregistry.googleapis.com/v1/${functionArtifactRepository}`,
  )).data;
  const sourceBucket = (await call(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(functionSourceBucket)}`,
  )).data;
  const enabledServices = (await call(
    `https://serviceusage.googleapis.com/v1/projects/${projectNumber}/services?filter=state%3AENABLED&pageSize=200`,
  )).data.services ?? [];

  result = {
    action,
    externalWrites: 0,
    deploymentStartsDisabled: true,
    sessionIssuanceFlag: issuanceFlag ?? "UNSET",
    runServices,
    runtimeServiceAccount: {
      email: runtimeEmail,
      roles: runtimeRoles,
      userManagedKeyCount: runtimeKeys.length,
    },
    secret: {
      name: secret.name,
      replication: secret.replication,
      enabledVersionNames: secretVersions.map((version) => version.name),
      valuesRead: false,
    },
    firestore: {
      name: database.name,
      uid: database.uid,
      locationId: database.locationId,
      type: database.type,
      databaseEdition: database.databaseEdition,
      pointInTimeRecoveryEnablement: database.pointInTimeRecoveryEnablement,
      deleteProtectionState: database.deleteProtectionState,
      controlDocument: control.status === 404
        ? { present: false, stagingEnabled: false, controlEpoch: 1 }
        : {
            present: true,
            name: control.data.name,
            fields: control.data.fields,
          },
      collections,
    },
    artifactRepository: {
      name: repository.name,
      format: repository.format,
      mode: repository.mode,
      cleanupPolicies: repository.cleanupPolicies,
      cleanupPolicyDryRun: repository.cleanupPolicyDryRun,
      purpose: "CLOUD_FUNCTIONS_BUILD_ARTIFACTS_ONLY",
    },
    sourceBucket: {
      name: sourceBucket.name,
      location: sourceBucket.location,
      storageClass: sourceBucket.storageClass,
      uniformBucketLevelAccess: sourceBucket.iamConfiguration?.uniformBucketLevelAccess,
      purpose: "CLOUD_FUNCTIONS_SOURCE_BUILD_ARTIFACT_ONLY_NOT_APP_STORAGE",
    },
    enabledServices: enabledServices.map((service) => service.config?.name).sort(),
    forbiddenFirebaseProductsActivatedByThisInspection: [],
    appCloudStorageEnabled: false,
    secretValuesPrinted: false,
  };
}

if (action === "inspect-forbidden-products") {
  const firebaseProject = (await call(
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}`,
  )).data;
  const analyticsDetails = await call(
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/analyticsDetails`,
    { allowStatuses: [404] },
  );
  const identityConfig = await call(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
    { allowStatuses: [403, 404] },
  );
  const accounts = await call(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:query`,
    {
      method: "POST",
      body: { returnUserInfo: true },
      allowStatuses: [400, 403, 404],
    },
  );
  const remoteConfig = await call(
    `https://firebaseremoteconfig.googleapis.com/v1/projects/${projectId}/remoteConfig`,
    { allowStatuses: [403, 404] },
  );
  const hostingSites = await call(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites?pageSize=100`,
    { allowStatuses: [403, 404] },
  );
  const appKinds = await Promise.all([
    "androidApps",
    "iosApps",
    "webApps",
  ].map(async (kind) => {
    const response = await call(
      `https://firebase.googleapis.com/v1beta1/projects/${projectId}/${kind}?pageSize=100`,
      { allowStatuses: [403, 404] },
    );
    return [kind, {
      status: response.status,
      count: (response.data[kind] ?? []).length,
    }];
  }));
  const buckets = (await call(
    `https://storage.googleapis.com/storage/v1/b?project=${projectId}&maxResults=100`,
  )).data.items ?? [];
  result = {
    action,
    externalWrites: 0,
    firebaseProject: {
      projectId: firebaseProject.projectId,
      projectNumber: firebaseProject.projectNumber,
      displayName: firebaseProject.displayName,
      state: firebaseProject.state,
      resources: firebaseProject.resources,
    },
    firebaseApps: Object.fromEntries(appKinds),
    firebaseAuthentication: {
      configStatus: identityConfig.status,
      anonymousEnabled: identityConfig.data.signIn?.anonymous?.enabled ?? false,
      emailEnabled: identityConfig.data.signIn?.email?.enabled ?? false,
      phoneRegionPolicyConfigured: identityConfig.data.smsRegionConfig !== undefined,
      mfaState: identityConfig.data.mfa?.state ?? "DISABLED_OR_UNSET",
      userQueryStatus: accounts.status,
      configurationFound: accounts.status !== 400,
      userCount: (accounts.data.records ?? []).length,
    },
    firebaseAnalytics: {
      linked: analyticsDetails.status === 200,
      status: analyticsDetails.status,
      analyticsProperty: analyticsDetails.status === 200
        ? analyticsDetails.data.analyticsProperty
        : undefined,
    },
    remoteConfig: {
      status: remoteConfig.status,
      parameterKeys: Object.keys(remoteConfig.data.parameters ?? {}),
      conditionCount: (remoteConfig.data.conditions ?? []).length,
      versionNumber: remoteConfig.data.version?.versionNumber,
    },
    crashlytics: {
      firebaseAppCount: Object.values(Object.fromEntries(appKinds))
        .reduce((total, entry) => total + entry.count, 0),
      apiEnabled: false,
      configured: false,
    },
    performanceMonitoring: {
      firebaseAppCount: Object.values(Object.fromEntries(appKinds))
        .reduce((total, entry) => total + entry.count, 0),
      apiEnabled: false,
      configured: false,
    },
    hosting: {
      status: hostingSites.status,
      sites: (hostingSites.data.sites ?? []).map((site) => ({
        name: site.name,
        defaultUrl: site.defaultUrl,
        type: site.type,
      })),
      deploymentsCreatedByLudysActivation: 0,
    },
    storageBuckets: buckets.map((bucket) => ({
      name: bucket.name,
      location: bucket.location,
      purpose: bucket.name.startsWith("gcf-v2-")
        ? "CLOUD_FUNCTIONS_BUILD_SUPPORT_ONLY"
        : "REQUIRES_CLASSIFICATION",
    })),
    appCloudStorageBucket: firebaseProject.resources?.storageBucket ?? null,
    runtimeAiConfigured: false,
    stableParticipantIdentityConfigured: false,
    secretValuesPrinted: false,
  };
}

if (action === "probe-disabled-runtime") {
  const functions = (await call(
    `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${approval.selectedRegion}/functions`,
  )).data.functions ?? [];
  const urls = Object.fromEntries(functions.map((fn) => [
    fn.name.split("/").at(-1),
    fn.serviceConfig?.uri,
  ]));
  for (const [name, url] of Object.entries(urls)) {
    assert.ok(url, `FUNCTION_URI_REQUIRED_${name}`);
  }
  async function probe(name, method, body) {
    const response = await nativeFetch(urls[name], {
      method,
      headers: body === undefined ? undefined : {
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const responseText = await response.text();
    let responseJson = {};
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = {};
    }
    return {
      name,
      method,
      status: response.status,
      contentType: response.headers.get("content-type"),
      cacheControl: response.headers.get("cache-control"),
      denialClass: responseJson.denialClass,
      applicationOk: responseJson.ok,
      bodyRecorded: false,
    };
  }
  const probes = [
    await probe("sessionCommand", "POST", {
      syntheticSessionId: "synthetic-wp13-12b-disabled-probe",
    }),
    await probe("sessionProjection", "POST", {
      syntheticSessionId: "synthetic-wp13-12b-disabled-probe",
    }),
    await probe("issueSyntheticSession", "POST", {
      locale: "nb-NO",
      lifetimeMs: 60000,
    }),
    await probe("deleteSyntheticSession", "POST", {
      syntheticSessionId: "synthetic-wp13-12b-disabled-probe",
    }),
    await probe("health", "GET"),
  ];
  for (const probeResult of probes.filter((candidate) => (
    candidate.name === "sessionCommand" || candidate.name === "sessionProjection"
  ))) {
    assert.equal(probeResult.status, 401, `PUBLIC_BEARER_ENDPOINT_MUST_DENY_${probeResult.name}`);
    assert.equal(probeResult.denialClass, "BEARER_ONLY", `PUBLIC_BEARER_DENIAL_MISMATCH_${probeResult.name}`);
  }
  for (const probeResult of probes.filter((candidate) => (
    candidate.name !== "sessionCommand" && candidate.name !== "sessionProjection"
  ))) {
    assert.ok(
      probeResult.status === 401 || probeResult.status === 403 || probeResult.status === 404,
      `PRIVATE_ENDPOINT_MUST_DENY_${probeResult.name}`,
    );
  }
  result = {
    action,
    externalWrites: 0,
    syntheticProbeOnly: true,
    deploymentStartsDisabled: true,
    probes,
    requestBodiesRecorded: false,
    responseBodiesRecorded: false,
    capabilityValuesUsed: 0,
  };
}

if (action === "enable-required-services") {
  const requiredServices = [
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudbilling.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com",
    "firestore.googleapis.com",
    "iam.googleapis.com",
    "logging.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
  ];
  const operation = (await call(
    `https://serviceusage.googleapis.com/v1/${project.name}/services:batchEnable`,
    {
      method: "POST",
      mutation: true,
      body: { serviceIds: requiredServices },
    },
  )).data;
  let completed = operation;
  for (let attempt = 0; attempt < 30 && completed.done !== true; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    completed = (await call(
      `https://serviceusage.googleapis.com/v1/${operation.name}`,
    )).data;
  }
  assert.equal(completed.done, true, "SERVICE_ENABLE_OPERATION_TIMEOUT");
  assert.equal(completed.error, undefined, "SERVICE_ENABLE_OPERATION_FAILED");
  const states = await Promise.all(requiredServices.map(async (service) => {
    const details = (await call(
      `https://serviceusage.googleapis.com/v1/${project.name}/services/${service}`,
    )).data;
    return {
      service,
      state: details.state,
    };
  }));
  for (const state of states) assert.equal(state.state, "ENABLED", `SERVICE_NOT_ENABLED_${state.service}`);
  result = {
    action,
    externalWrites: 1,
    services: states,
    forbiddenFirebaseProductsEnabledByThisAction: [],
  };
}

if (action === "inspect-billing") {
  const billingInfo = await getBillingInfo();
  const budgets = await listBudgets();
  result = {
    action,
    externalWrites: 0,
    project: {
      name: project.name,
      projectId: project.projectId,
      displayName: project.displayName,
      parent: project.parent,
      state: project.state,
    },
    billingInfo: safeBillingInfo(billingInfo),
    matchingBudgets: budgets
      .filter((budget) => budget.displayName === "LUDYS WP13-12B 500 NOK")
      .map((budget) => ({
        name: budget.name,
        displayName: budget.displayName,
        amount: budget.amount?.specifiedAmount,
        thresholdRules: budget.thresholdRules,
        projects: budget.budgetFilter?.projects,
      })),
  };
}

if (action === "link-billing") {
  const before = await getBillingInfo();
  let after = before;
  let externalWrites = 0;
  if (before.billingAccountName !== billingAccountName || before.billingEnabled !== true) {
    after = (await call(
      `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
      {
        method: "PUT",
        mutation: true,
        body: { billingAccountName },
      },
    )).data;
    externalWrites = 1;
  }
  assert.equal(after.billingAccountName, billingAccountName, "BILLING_ACCOUNT_LINK_MISMATCH");
  assert.equal(after.billingEnabled, true, "BILLING_NOT_ENABLED");
  result = {
    action,
    externalWrites,
    before: safeBillingInfo(before),
    after: safeBillingInfo(after),
  };
}

if (action === "create-budget") {
  const billingInfo = await getBillingInfo();
  assert.equal(billingInfo.billingAccountName, billingAccountName, "BILLING_ACCOUNT_LINK_MISMATCH");
  assert.equal(billingInfo.billingEnabled, true, "BILLING_NOT_ENABLED");
  const existing = (await listBudgets()).find(
    (budget) => budget.displayName === "LUDYS WP13-12B 500 NOK",
  );
  let budget = existing;
  let externalWrites = 0;
  if (budget === undefined) {
    budget = (await call(
      `https://billingbudgets.googleapis.com/v1/${billingAccountName}/budgets`,
      {
        method: "POST",
        mutation: true,
        body: {
          displayName: "LUDYS WP13-12B 500 NOK",
          budgetFilter: {
            projects: [project.name],
            calendarPeriod: "MONTH",
          },
          amount: {
            specifiedAmount: {
              currencyCode: approval.maximumMonthlyCost.currency,
              units: String(approval.maximumMonthlyCost.amount),
            },
          },
          thresholdRules: [
            {
              thresholdPercent: approval.monthlyAlertThreshold.amount
                / approval.maximumMonthlyCost.amount,
              spendBasis: "CURRENT_SPEND",
            },
            {
              thresholdPercent: 1,
              spendBasis: "CURRENT_SPEND",
            },
          ],
          notificationsRule: {
            disableDefaultIamRecipients: false,
          },
        },
      },
    )).data;
    externalWrites = 1;
  }
  assert.equal(budget.amount?.specifiedAmount?.currencyCode, "NOK", "BUDGET_CURRENCY_MISMATCH");
  assert.equal(budget.amount?.specifiedAmount?.units, "500", "BUDGET_AMOUNT_MISMATCH");
  assert.deepEqual(
    budget.budgetFilter?.projects,
    [project.name],
    "BUDGET_PROJECT_SCOPE_MISMATCH",
  );
  const thresholds = (budget.thresholdRules ?? []).map((rule) => rule.thresholdPercent).sort();
  assert.deepEqual(thresholds, [0.8, 1], "BUDGET_THRESHOLDS_MISMATCH");
  result = {
    action,
    externalWrites,
    budget: {
      name: budget.name,
      displayName: budget.displayName,
      amount: budget.amount.specifiedAmount,
      projects: budget.budgetFilter.projects,
      calendarPeriod: budget.budgetFilter.calendarPeriod,
      thresholdRules: budget.thresholdRules,
      defaultIamRecipientsEnabled: budget.notificationsRule?.disableDefaultIamRecipients !== true,
    },
    hardSpendCapClaimed: false,
  };
}

process.stdout.write(`${JSON.stringify({
  schemaVersion: "wp13.12b-ea-external-cloud-control-v1",
  activeAccount: googleOAuth.approvedGoogleAccount,
  projectId,
  ...result,
  accessTokenPrinted: false,
}, null, 2)}\n`);
