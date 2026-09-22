import { SafeHttpError, headerValue } from "./http.mjs";
import { privateIdentityConfig } from "./runtime-config.mjs";

const VERCEL_OIDC_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._~+/-]{20,8192}$/u;

async function safeJsonResponse(response, denialClass) {
  let text;
  try {
    text = await response.text();
  } catch {
    throw new SafeHttpError(502, denialClass);
  }
  if (text.length > 1024 * 1024) throw new SafeHttpError(502, denialClass);
  try {
    return JSON.parse(text);
  } catch {
    throw new SafeHttpError(502, denialClass);
  }
}

async function exchangeVercelToken(vercelOidcToken, config, fetchImpl) {
  const audience = (
    `//iam.googleapis.com/projects/${config.projectNumber}`
    + `/locations/global/workloadIdentityPools/${config.poolId}`
    + `/providers/${config.providerId}`
  );
  const body = new URLSearchParams({
    audience,
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    scope: "https://www.googleapis.com/auth/cloud-platform",
    subject_token: vercelOidcToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
  });
  let response;
  try {
    response = await fetchImpl("https://sts.googleapis.com/v1/token", {
      method: "POST",
      headers: Object.freeze({
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body: body.toString(),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new SafeHttpError(502, "GOOGLE_STS_UNAVAILABLE");
  }
  const payload = await safeJsonResponse(response, "GOOGLE_STS_RESPONSE_INVALID");
  if (
    !response.ok
    || payload.token_type !== "Bearer"
    || typeof payload.access_token !== "string"
    || !ACCESS_TOKEN_PATTERN.test(payload.access_token)
  ) throw new SafeHttpError(502, "GOOGLE_STS_DENIED");
  return payload.access_token;
}

async function generateGoogleIdToken(stsAccessToken, serviceAccount, audience, fetchImpl) {
  const serviceAccountPath = encodeURIComponent(serviceAccount);
  const endpoint = (
    "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"
    + `${serviceAccountPath}:generateIdToken`
  );
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: Object.freeze({
        Accept: "application/json",
        Authorization: `Bearer ${stsAccessToken}`,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        audience,
        includeEmail: false,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new SafeHttpError(502, "GOOGLE_IAM_CREDENTIALS_UNAVAILABLE");
  }
  const payload = await safeJsonResponse(response, "GOOGLE_IAM_CREDENTIALS_RESPONSE_INVALID");
  if (
    !response.ok
    || typeof payload.token !== "string"
    || payload.token.length < 100
    || payload.token.length > 16384
    || !VERCEL_OIDC_PATTERN.test(payload.token)
  ) throw new SafeHttpError(502, "GOOGLE_ID_TOKEN_DENIED");
  return payload.token;
}

export async function privateFunctionIdToken(request, env, audience, fetchImpl = fetch) {
  const vercelOidcToken = headerValue(request, "x-vercel-oidc-token");
  if (
    typeof vercelOidcToken !== "string"
    || vercelOidcToken.length < 100
    || vercelOidcToken.length > 16384
    || !VERCEL_OIDC_PATTERN.test(vercelOidcToken)
  ) throw new SafeHttpError(401, "VERCEL_OIDC_REQUIRED");
  const config = privateIdentityConfig(env);
  const stsAccessToken = await exchangeVercelToken(vercelOidcToken, config, fetchImpl);
  return generateGoogleIdToken(
    stsAccessToken,
    config.serviceAccount,
    audience,
    fetchImpl,
  );
}
