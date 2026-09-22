import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
  assertActivationWindowOpen,
  assertApprovedCloudBinding,
  assertExternalActivationAuthorization,
} from "../provider/firebase/tools/operator-gate-contract.mjs";

const SOURCE_SHA = /^[a-f0-9]{40}$/u;
const READ_ONLY_ACTIONS = new Set([
  "inspect",
  "verify",
  "verify-disabled",
]);
const BASE_MUTATION_ACTIONS = new Set([
  "enable-trust-services",
  "ensure-preview-service-account",
  "ensure-workload-identity-pool",
  "ensure-workload-identity-provider",
  "grant-preview-identity-impersonation",
  "grant-private-function-invocation",
]);
const PREVIEW_READY_MUTATION_ACTIONS = new Set([
  "enable-provider-and-pool",
]);
const CLEANUP_MUTATION_ACTIONS = new Set([
  "disable-workload-identity-provider",
  "disable-workload-identity-pool",
  "revoke-private-function-invocation",
]);
const ALLOWED_PROVIDER_HOSTS = new Set([
  "cloudfunctions.googleapis.com",
  "cloudresourcemanager.googleapis.com",
  "iam.googleapis.com",
  "run.googleapis.com",
  "serviceusage.googleapis.com",
]);
const authorizationBindings = new WeakMap();
const trustContract = JSON.parse(readFileSync(
  new URL(
    "../release/wp13-12b/external-activation/"
      + "vercel-google-trust-contract.json",
    import.meta.url,
  ),
  "utf8",
));
const trustGoogle = trustContract.google;
const trustProvider = trustContract.provider;
const poolName =
  `projects/${trustGoogle.projectNumber}/locations/global/`
  + `workloadIdentityPools/${trustGoogle.workloadIdentityPoolId}`;
const providerName =
  `${poolName}/providers/${trustGoogle.workloadIdentityProviderId}`;
const previewEmail = trustGoogle.previewServiceAccountEmail;
const previewMember = `serviceAccount:${previewEmail}`;
const serviceAccountResource =
  `projects/${trustGoogle.projectId}/serviceAccounts/`
  + encodeURIComponent(previewEmail);
const exactSubjectPrincipal = [
  "principal://iam.googleapis.com",
  `projects/${trustGoogle.projectNumber}`,
  "locations/global",
  `workloadIdentityPools/${trustGoogle.workloadIdentityPoolId}`,
  `subject/${trustContract.vercel.subject}`,
].join("/");
const expectedPoolDisplayName = "LUDYS Vercel preview";
const expectedPoolDescription =
  "Preview-only Vercel OIDC identities; expires 2027-01-25.";
const expectedProviderDisplayName = "LUDYS Vercel preview";
const expectedProviderDescription =
  "Exact preview-only Vercel trust; expires 2027-01-25.";
const runPolicyPath = (functionId) =>
  `/v2/projects/${trustGoogle.projectId}/locations/${trustGoogle.region}/`
  + `services/${functionId.toLowerCase()}:setIamPolicy`;
const privateRunPolicyPaths = new Set(
  trustGoogle.privateFunctionInvokerTargets.map(runPolicyPath),
);
const revocationRunPolicyPaths = new Set(
  trustGoogle.previewInvokerRevocationTargets.map(runPolicyPath),
);

function gateError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function exactOptions(options) {
  const allowedKeys = new Set([
    "action",
    "approvedScope",
    "cliArgs",
    "acquireBaseCapability",
    "acquireCleanupCapability",
    "acquirePreviewReadyCapability",
    "assertBaseCapability",
    "assertCleanupCapability",
    "assertPreviewReadyCapability",
    "now",
  ]);
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).some((key) => !allowedKeys.has(key))
  ) throw gateError("EXACT_WIF_MUTATION_GATE_OPTIONS_REQUIRED");
  return options;
}

function actionKind(action) {
  if (READ_ONLY_ACTIONS.has(action)) return "READ_ONLY";
  if (BASE_MUTATION_ACTIONS.has(action)) return "BASE";
  if (PREVIEW_READY_MUTATION_ACTIONS.has(action)) {
    return "PREVIEW_READY";
  }
  if (CLEANUP_MUTATION_ACTIONS.has(action)) return "CLEANUP";
  throw gateError("EXPLICIT_ALLOWED_WIF_MUTATION_ACTION_REQUIRED");
}

function assertSource(source, phase) {
  if (
    source === null
    || typeof source !== "object"
    || source.productionBound !== true
    || source.phase !== phase
    || typeof source.repositoryRoot !== "string"
    || source.repositoryRoot.length === 0
    || !SOURCE_SHA.test(source.headCommit ?? "")
    || !SOURCE_SHA.test(source.headTree ?? "")
  ) throw gateError("EXACT_SOURCE_BOUND_WIF_CAPABILITY_REQUIRED");
  return source;
}

async function acquireBoundAuthorization({
  action,
  kind,
  acquireCapability,
  assertCapability,
}) {
  if (
    typeof acquireCapability !== "function"
    || typeof assertCapability !== "function"
  ) throw gateError("WIF_MUTATION_CAPABILITY_ACQUISITION_REQUIRED");
  const capability = await acquireCapability();
  const phase = kind === "BASE"
    ? "BASE"
    : kind === "PREVIEW_READY"
      ? "PREVIEW_READY"
      : "FAIL_SAFE_CLEANUP";
  const source = assertSource(assertCapability(capability), phase);
  const authorization = Object.freeze({});
  authorizationBindings.set(authorization, Object.freeze({
    action,
    assertCapability,
    capability,
    kind,
    source,
  }));
  return authorization;
}

function parseProviderRequest(method, url) {
  if (typeof method !== "string" || typeof url !== "string") {
    throw gateError("EXACT_WIF_PROVIDER_REQUEST_REQUIRED");
  }
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod !== method) {
    throw gateError("EXACT_WIF_PROVIDER_METHOD_REQUIRED");
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw gateError("EXACT_WIF_PROVIDER_URL_REQUIRED");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.hash !== ""
    || parsed.port !== ""
    || !ALLOWED_PROVIDER_HOSTS.has(parsed.hostname)
  ) throw gateError("EXACT_WIF_PROVIDER_URL_REQUIRED");
  if (normalizedMethod === "GET") {
    return Object.freeze({
      method: normalizedMethod,
      parsed,
      readOnly: true,
    });
  }
  if (
    normalizedMethod === "POST"
    && parsed.search === ""
    && parsed.pathname.endsWith(":getIamPolicy")
  ) {
    return Object.freeze({
      method: normalizedMethod,
      parsed,
      readOnly: true,
    });
  }
  if (
    normalizedMethod !== "POST"
    && normalizedMethod !== "PATCH"
  ) throw gateError("WIF_PROVIDER_METHOD_FORBIDDEN");
  return Object.freeze({
    method: normalizedMethod,
    parsed,
    readOnly: false,
  });
}

function isRecord(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  );
}

function hasExactKeys(value, expected) {
  return (
    isRecord(value)
    && isDeepStrictEqual(
      Object.keys(value).sort(),
      [...expected].sort(),
    )
  );
}

function hasOnlyKeys(value, allowed) {
  return (
    isRecord(value)
    && Object.keys(value).every((key) => allowed.includes(key))
  );
}

function assertExactRequestUrl(request, {
  host,
  method,
  pathname,
  search = "",
}) {
  if (
    request.method !== method
    || request.parsed.hostname !== host
    || request.parsed.pathname !== pathname
    || request.parsed.search !== search
  ) throw gateError("WIF_ACTION_PROVIDER_REQUEST_MISMATCH");
}

function assertExactDisabledPatch(request, body, resourceName, disabled) {
  assertExactRequestUrl(request, {
    host: "iam.googleapis.com",
    method: "PATCH",
    pathname: `/v1/${resourceName}`,
    search: "?updateMask=disabled",
  });
  if (
    !hasExactKeys(body, ["disabled", "name"])
    || body.name !== resourceName
    || body.disabled !== disabled
  ) throw gateError("WIF_DISABLED_PATCH_BODY_MISMATCH");
}

function assertPolicyEnvelope(body) {
  if (
    !hasExactKeys(body, ["policy"])
    || !hasOnlyKeys(
      body.policy,
      ["bindings", "etag", "version"],
    )
    || !Array.isArray(body.policy.bindings)
    || (
      body.policy.etag !== undefined
      && typeof body.policy.etag !== "string"
    )
    || (
      body.policy.version !== undefined
      && !Number.isSafeInteger(body.policy.version)
    )
  ) throw gateError("WIF_IAM_POLICY_BODY_MISMATCH");
  return body.policy;
}

function exactUnconditionalBinding(binding, role, member) {
  return (
    hasExactKeys(binding, ["members", "role"])
    && binding.role === role
    && isDeepStrictEqual(binding.members, [member])
  );
}

function assertExactServiceAccountImpersonationGrant(request, body) {
  assertExactRequestUrl(request, {
    host: "iam.googleapis.com",
    method: "POST",
    pathname: `/v1/${serviceAccountResource}:setIamPolicy`,
  });
  const policy = assertPolicyEnvelope(body);
  if (
    policy.bindings.length !== 1
    || !exactUnconditionalBinding(
      policy.bindings[0],
      "roles/iam.workloadIdentityUser",
      exactSubjectPrincipal,
    )
  ) throw gateError("ONLY_EXACT_PREVIEW_SUBJECT_MAY_IMPERSONATE");
}

function assertExactRunPolicyRequest(request, body, {
  revoke,
}) {
  const allowedPaths = revoke
    ? revocationRunPolicyPaths
    : privateRunPolicyPaths;
  if (
    request.method !== "POST"
    || request.parsed.hostname !== "run.googleapis.com"
    || request.parsed.search !== ""
    || !allowedPaths.has(request.parsed.pathname)
  ) throw gateError("WIF_ACTION_PROVIDER_REQUEST_MISMATCH");
  const policy = assertPolicyEnvelope(body);
  if (revoke) {
    if (policy.bindings.length !== 0) {
      throw gateError("WIF_REVOKE_POLICY_MUST_ONLY_REMOVE_BINDING");
    }
    return;
  }
  if (
    policy.bindings.length !== 1
    || !exactUnconditionalBinding(
      policy.bindings[0],
      "roles/run.invoker",
      previewMember,
    )
  ) throw gateError("ONLY_EXACT_PREVIEW_INVOKER_ALLOWED");
}

function assertExactServiceEnableRequest(request, body) {
  assertExactRequestUrl(request, {
    host: "serviceusage.googleapis.com",
    method: "POST",
    pathname:
      `/v1/projects/${trustGoogle.projectNumber}/services:batchEnable`,
  });
  const services = body?.serviceIds;
  if (
    !hasExactKeys(body, ["serviceIds"])
    || !Array.isArray(services)
    || services.length === 0
    || new Set(services).size !== services.length
    || services.some(
      (service) => !trustGoogle.requiredApis.includes(service),
    )
  ) throw gateError("WIF_SERVICE_ENABLE_BODY_MISMATCH");
}

function assertExactServiceAccountCreateRequest(request, body) {
  assertExactRequestUrl(request, {
    host: "iam.googleapis.com",
    method: "POST",
    pathname: `/v1/projects/${trustGoogle.projectId}/serviceAccounts`,
  });
  if (
    !hasExactKeys(body, ["accountId", "serviceAccount"])
    || body.accountId !== trustGoogle.previewServiceAccountId
    || !isDeepStrictEqual(body.serviceAccount, {
      displayName: "LUDYS Vercel preview invoker",
      description:
        "Keyless preview-only invoker for private synthetic staging endpoints.",
    })
  ) throw gateError("WIF_SERVICE_ACCOUNT_CREATE_BODY_MISMATCH");
}

function assertExactPoolCreateRequest(request, body) {
  assertExactRequestUrl(request, {
    host: "iam.googleapis.com",
    method: "POST",
    pathname:
      `/v1/projects/${trustGoogle.projectNumber}/locations/global/`
      + "workloadIdentityPools",
    search:
      `?workloadIdentityPoolId=${trustGoogle.workloadIdentityPoolId}`,
  });
  if (!isDeepStrictEqual(body, {
    displayName: expectedPoolDisplayName,
    description: expectedPoolDescription,
    disabled: true,
  })) throw gateError("WIF_POOL_CREATE_BODY_MISMATCH");
}

function assertExactProviderCreateRequest(request, body) {
  assertExactRequestUrl(request, {
    host: "iam.googleapis.com",
    method: "POST",
    pathname: `/v1/${poolName}/providers`,
    search:
      "?workloadIdentityPoolProviderId="
      + trustGoogle.workloadIdentityProviderId,
  });
  if (!isDeepStrictEqual(body, {
    displayName: expectedProviderDisplayName,
    description: expectedProviderDescription,
    disabled: true,
    attributeMapping: trustProvider.attributeMapping,
    attributeCondition: trustProvider.attributeCondition,
    oidc: {
      issuerUri: trustContract.vercel.issuer,
      allowedAudiences: [trustContract.vercel.audience],
    },
  })) throw gateError("WIF_PROVIDER_CREATE_BODY_MISMATCH");
}

function assertExactMutationRequest(action, request, body) {
  if (action === "enable-trust-services") {
    assertExactServiceEnableRequest(request, body);
    return;
  }
  if (action === "ensure-preview-service-account") {
    assertExactServiceAccountCreateRequest(request, body);
    return;
  }
  if (action === "ensure-workload-identity-pool") {
    assertExactPoolCreateRequest(request, body);
    return;
  }
  if (action === "ensure-workload-identity-provider") {
    assertExactProviderCreateRequest(request, body);
    return;
  }
  if (action === "grant-preview-identity-impersonation") {
    assertExactServiceAccountImpersonationGrant(request, body);
    return;
  }
  if (action === "grant-private-function-invocation") {
    assertExactRunPolicyRequest(request, body, { revoke: false });
    return;
  }
  if (action === "revoke-private-function-invocation") {
    assertExactRunPolicyRequest(request, body, { revoke: true });
    return;
  }
  if (action === "disable-workload-identity-provider") {
    assertExactDisabledPatch(request, body, providerName, true);
    return;
  }
  if (action === "disable-workload-identity-pool") {
    assertExactDisabledPatch(request, body, poolName, true);
    return;
  }
  if (action === "enable-provider-and-pool") {
    if (body?.name === providerName) {
      assertExactDisabledPatch(
        request,
        body,
        providerName,
        body.disabled === true,
      );
      return;
    }
    if (body?.name === poolName) {
      assertExactDisabledPatch(
        request,
        body,
        poolName,
        body.disabled === true,
      );
      return;
    }
  }
  throw gateError("WIF_ACTION_PROVIDER_REQUEST_MISMATCH");
}

function expectedAuthorizationKind(action, body) {
  const kind = actionKind(action);
  if (kind !== "PREVIEW_READY") return kind;
  if (
    body === null
    || typeof body !== "object"
    || Array.isArray(body)
    || typeof body.disabled !== "boolean"
  ) throw gateError("EXACT_WIF_ENABLE_OR_COMPENSATION_BODY_REQUIRED");
  return body.disabled ? "CLEANUP" : "PREVIEW_READY";
}

function assertExactAuthorizationSource(authorization, action, kind) {
  const binding = authorizationBindings.get(authorization);
  if (
    binding?.action !== action
    || binding?.kind !== kind
  ) throw gateError("EXACT_WIF_MUTATION_AUTHORIZATION_REQUIRED");
  const current = assertSource(
    binding.assertCapability(binding.capability),
    kind === "CLEANUP" ? "FAIL_SAFE_CLEANUP" : kind,
  );
  if (
    current !== binding.source
    || current.repositoryRoot !== binding.source.repositoryRoot
    || current.headCommit !== binding.source.headCommit
    || current.headTree !== binding.source.headTree
  ) throw gateError("EXACT_SOURCE_BOUND_WIF_CAPABILITY_REQUIRED");
  return binding;
}

export async function acquireExternalWifMutationGate(rawOptions) {
  const options = exactOptions(rawOptions);
  const {
    action,
    approvedScope,
    cliArgs,
    acquireBaseCapability,
    acquireCleanupCapability,
    acquirePreviewReadyCapability,
    assertBaseCapability,
    assertCleanupCapability,
    assertPreviewReadyCapability,
    now = () => new Date(),
  } = options;
  if (typeof now !== "function") {
    throw gateError("VALID_WIF_ACTIVATION_GATE_TIME_REQUIRED");
  }
  const kind = actionKind(action);
  if (kind === "READ_ONLY") {
    return Object.freeze({
      action,
      cleanupAuthorization: undefined,
      forwardAuthorization: undefined,
      assertProviderRequest({ method, url, authorization }) {
        const request = parseProviderRequest(method, url);
        if (!request.readOnly) {
          throw gateError("READ_ONLY_WIF_ACTION_CANNOT_MUTATE");
        }
        if (authorization !== undefined) {
          throw gateError("READ_ONLY_WIF_AUTHORIZATION_FORBIDDEN");
        }
        return true;
      },
    });
  }

  let forwardAuthorization;
  let cleanupAuthorization;
  if (kind === "BASE") {
    assertApprovedCloudBinding(cliArgs, approvedScope);
    assertExternalActivationAuthorization(cliArgs);
    assertActivationWindowOpen(approvedScope, { now });
    forwardAuthorization = await acquireBoundAuthorization({
      action,
      kind,
      acquireCapability: acquireBaseCapability,
      assertCapability: assertBaseCapability,
    });
  } else if (kind === "PREVIEW_READY") {
    assertApprovedCloudBinding(cliArgs, approvedScope);
    assertExternalActivationAuthorization(cliArgs);
    assertActivationWindowOpen(approvedScope, { now });
    forwardAuthorization = await acquireBoundAuthorization({
      action,
      kind,
      acquireCapability: acquirePreviewReadyCapability,
      assertCapability: assertPreviewReadyCapability,
    });
    cleanupAuthorization = await acquireBoundAuthorization({
      action,
      kind: "CLEANUP",
      acquireCapability: acquireCleanupCapability,
      assertCapability: assertCleanupCapability,
    });
  } else {
    cleanupAuthorization = await acquireBoundAuthorization({
      action,
      kind,
      acquireCapability: acquireCleanupCapability,
      assertCapability: assertCleanupCapability,
    });
  }

  return Object.freeze({
    action,
    cleanupAuthorization,
    forwardAuthorization,
    assertProviderRequest({ method, url, body, authorization }) {
      const request = parseProviderRequest(method, url);
      if (request.readOnly) {
        if (authorization !== undefined) {
          throw gateError("READ_ONLY_WIF_AUTHORIZATION_FORBIDDEN");
        }
        return true;
      }
      assertExactMutationRequest(action, request, body);
      const expectedKind = expectedAuthorizationKind(action, body);
      assertExactAuthorizationSource(
        authorization,
        action,
        expectedKind,
      );
      if (expectedKind !== "CLEANUP") {
        assertApprovedCloudBinding(cliArgs, approvedScope);
        assertExternalActivationAuthorization(cliArgs);
        assertActivationWindowOpen(approvedScope, { now });
      }
      return true;
    },
  });
}

export const externalWifMutationGateConstants = Object.freeze({
  baseMutationActions: Object.freeze([...BASE_MUTATION_ACTIONS].sort()),
  cleanupMutationActions:
    Object.freeze([...CLEANUP_MUTATION_ACTIONS].sort()),
  previewReadyMutationActions:
    Object.freeze([...PREVIEW_READY_MUTATION_ACTIONS].sort()),
  readOnlyActions: Object.freeze([...READ_ONLY_ACTIONS].sort()),
});
