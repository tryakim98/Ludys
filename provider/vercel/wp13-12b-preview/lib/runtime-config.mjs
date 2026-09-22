import { SafeHttpError } from "./http.mjs";

const ID_PATTERN = /^[a-z][a-z0-9-]{2,30}[a-z0-9]$/u;
const PROJECT_NUMBER_PATTERN = /^[0-9]{6,20}$/u;
const SERVICE_ACCOUNT_PATTERN =
  /^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/u;

export const approvedPreviewIdentity = Object.freeze({
  projectNumber: "134654966474",
  poolId: "ludys-vercel-preview",
  providerId: "vercel-preview",
  serviceAccount:
    "ludys-preview-invoker@ludys-12b-stg-20260725.iam.gserviceaccount.com",
});

export const approvedFunctionUrls = Object.freeze({
  issue: "https://issuesyntheticsession-qbqbamvs6q-lz.a.run.app",
  delete: "https://deletesyntheticsession-qbqbamvs6q-lz.a.run.app",
  command: "https://sessioncommand-qbqbamvs6q-lz.a.run.app",
  projection: "https://sessionprojection-qbqbamvs6q-lz.a.run.app",
});

export function deploymentRole(env) {
  const role = env?.LUDYS_DEPLOYMENT_ROLE;
  if (role !== "active" && role !== "rollback") {
    throw new SafeHttpError(503, "DEPLOYMENT_ROLE_INVALID");
  }
  return role;
}

export function providerFunctionUrl(value, expected) {
  if (typeof value !== "string" || value.length < 12 || value.length > 2048) {
    throw new SafeHttpError(503, "PROVIDER_CONFIGURATION_INVALID");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new SafeHttpError(503, "PROVIDER_CONFIGURATION_INVALID");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.search !== ""
    || parsed.hash !== ""
    || (
      !parsed.hostname.endsWith(".run.app")
      && !parsed.hostname.endsWith(".cloudfunctions.net")
    )
  ) throw new SafeHttpError(503, "PROVIDER_CONFIGURATION_INVALID");
  const canonical = parsed.pathname === "/"
    ? parsed.origin
    : `${parsed.origin}${parsed.pathname}`;
  if (
    value !== canonical
    || typeof expected !== "string"
    || canonical !== expected
  ) throw new SafeHttpError(503, "PROVIDER_CONFIGURATION_INVALID");
  return canonical;
}

export function publicRuntimeConfig(env) {
  const role = deploymentRole(env);
  return Object.freeze({
    schemaVersion: "wp13.12b-external-preview-config-v1",
    mode: "EXTERNAL_SYNTHETIC_STAGING",
    syntheticOnly: true,
    deploymentRole: role,
    issuanceEnabled: role === "active",
    studentBeta: "NOT_AUTHORIZED",
    production: "NOT_AUTHORIZED",
    wp13_12c: "BLOCKED",
    commandUrl: providerFunctionUrl(
      env?.LUDYS_COMMAND_FUNCTION_URL,
      approvedFunctionUrls.command,
    ),
    projectionUrl: providerFunctionUrl(
      env?.LUDYS_PROJECTION_FUNCTION_URL,
      approvedFunctionUrls.projection,
    ),
  });
}

export function privateIdentityConfig(env) {
  const projectNumber = env?.LUDYS_GCP_PROJECT_NUMBER;
  const poolId = env?.LUDYS_GCP_WIF_POOL_ID;
  const providerId = env?.LUDYS_GCP_WIF_PROVIDER_ID;
  const serviceAccount = env?.LUDYS_GCP_PREVIEW_SERVICE_ACCOUNT;
  if (
    !PROJECT_NUMBER_PATTERN.test(projectNumber ?? "")
    || !ID_PATTERN.test(poolId ?? "")
    || !ID_PATTERN.test(providerId ?? "")
    || !SERVICE_ACCOUNT_PATTERN.test(serviceAccount ?? "")
    || projectNumber !== approvedPreviewIdentity.projectNumber
    || poolId !== approvedPreviewIdentity.poolId
    || providerId !== approvedPreviewIdentity.providerId
    || serviceAccount !== approvedPreviewIdentity.serviceAccount
  ) throw new SafeHttpError(503, "IDENTITY_CONFIGURATION_INVALID");
  return Object.freeze({
    ...approvedPreviewIdentity,
  });
}

export function privateFunctionUrls(env) {
  return Object.freeze({
    issue: providerFunctionUrl(
      env?.LUDYS_ISSUE_FUNCTION_URL,
      approvedFunctionUrls.issue,
    ),
    delete: providerFunctionUrl(
      env?.LUDYS_DELETE_FUNCTION_URL,
      approvedFunctionUrls.delete,
    ),
  });
}
