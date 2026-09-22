import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  assertActivationWindowOpen,
  assertApprovedCloudBinding,
  assertExternalActivationAuthorization,
  loadApprovedCloudScope,
  parseExactFlagPairs,
  safeOperatorErrorCode,
} from "./operator-gate-contract.mjs";
import {
  acquireLiveActivationCapability,
  assertLiveActivationCapability,
} from "../../../scripts/wp13-12b-activation-phase-gate.mjs";
import {
  assertNoDangerousExternalEnvironment,
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

const SEED_FLAGS = Object.freeze([
  "--project",
  "--google-account",
  "--region",
  "--issue-url",
  "--fixture",
  "--locale",
  "--authorized",
]);

function seedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function canonicalFunctionUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw seedError("HTTPS_ISSUE_FUNCTION_URL_REQUIRED");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.port !== ""
    || (parsed.pathname !== "" && parsed.pathname !== "/")
    || parsed.search !== ""
    || parsed.hash !== ""
    || !/^[a-z0-9.-]+$/u.test(parsed.hostname)
    || (
      !parsed.hostname.endsWith(".a.run.app")
      && !parsed.hostname.endsWith(".cloudfunctions.net")
    )
  ) {
    throw seedError("HTTPS_ISSUE_FUNCTION_URL_REQUIRED");
  }
  return `https://${parsed.hostname}`;
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
    throw seedError(failureCode);
  }
  if (
    value.length === 0
    || value.length > 16 * 1024
    || (failureCode.includes("TOKEN") && /\s/u.test(value))
  ) {
    throw seedError(failureCode);
  }
  return value;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    throw seedError("SYNTHETIC_FIXTURE_SEED_RESPONSE_INVALID");
  }
}

function validCapability(value) {
  return typeof value === "string"
    && /^[A-Za-z0-9_-]{32,4096}\.[A-Za-z0-9_-]{32,128}$/u.test(value);
}

function decodeJwtPart(value) {
  if (
    typeof value !== "string"
    || !/^[A-Za-z0-9_-]{2,4096}$/u.test(value)
  ) throw seedError("IAM_IDENTITY_TOKEN_CLAIMS_INVALID");
  let bytes;
  try {
    bytes = Buffer.from(value, "base64url");
  } catch {
    throw seedError("IAM_IDENTITY_TOKEN_CLAIMS_INVALID");
  }
  if (
    bytes.toString("base64url").replace(/=+$/u, "") !== value
  ) throw seedError("IAM_IDENTITY_TOKEN_CLAIMS_INVALID");
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw seedError("IAM_IDENTITY_TOKEN_CLAIMS_INVALID");
  }
}

async function acquireSyntheticSeedIdentityToken({
  audience,
  baseAccessToken,
  fetchImpl,
  now,
}) {
  if (
    canonicalFunctionUrl(audience) !== audience
    || typeof baseAccessToken !== "string"
    || baseAccessToken.length < 20
    || baseAccessToken.length > 8192
    || /\s/u.test(baseAccessToken)
    || typeof fetchImpl !== "function"
    || typeof now !== "function"
  ) throw seedError("IAM_IDENTITY_TOKEN_AUTHORITY_INVALID");
  const instant = now();
  if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) {
    throw seedError("IAM_IDENTITY_TOKEN_TIME_INVALID");
  }
  const serviceAccount =
    deployIdentityScope.deployServiceAccount;
  let response;
  try {
    response = await fetchImpl(
      "https://iamcredentials.googleapis.com/v1/projects/-/"
        + `serviceAccounts/${serviceAccount}:generateIdToken`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${baseAccessToken}`,
          "content-type": "application/json",
          "x-goog-user-project": deployIdentityScope.projectId,
        },
        body: JSON.stringify({
          audience,
          delegates: [],
          includeEmail: true,
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    throw seedError("IAM_IDENTITY_TOKEN_ACQUISITION_FAILED");
  }
  if (!response?.ok) {
    throw seedError("IAM_IDENTITY_TOKEN_ACQUISITION_FAILED");
  }
  const value = await safeJson(response);
  const token = value?.token;
  if (
    typeof token !== "string"
    || token.length < 20
    || token.length > 16 * 1024
    || /\s/u.test(token)
  ) throw seedError("IAM_IDENTITY_TOKEN_INVALID");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw seedError("IAM_IDENTITY_TOKEN_INVALID");
  }
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  const issuedAt = Number(claims?.iat) * 1000;
  const expiresAt = Number(claims?.exp) * 1000;
  if (
    header?.alg !== "RS256"
    || typeof header?.kid !== "string"
    || header.kid.length < 8
    || (
      header.typ !== undefined
      && header.typ !== "JWT"
    )
    || (
      claims?.iss !== "https://accounts.google.com"
      && claims?.iss !== "accounts.google.com"
    )
    || claims?.aud !== audience
    || claims?.email !== serviceAccount
    || claims?.email_verified !== true
    || !Number.isSafeInteger(issuedAt)
    || !Number.isSafeInteger(expiresAt)
    || issuedAt > instant.valueOf() + 60_000
    || issuedAt < instant.valueOf() - 5 * 60 * 1000
    || expiresAt - instant.valueOf() < 5 * 60 * 1000
    || expiresAt - instant.valueOf() > 65 * 60 * 1000
  ) throw seedError("IAM_IDENTITY_TOKEN_CLAIMS_INVALID");
  return Object.freeze({
    token,
    audience,
    serviceAccount,
    expiresAt: new Date(expiresAt).toISOString(),
    tokenPrinted: false,
    tokenPersisted: false,
  });
}

export function acquireSyntheticSeedIdentityTokenForTesting(
  options,
) {
  return acquireSyntheticSeedIdentityToken(options);
}

export async function runSyntheticFixtureSeed(argv, options = {}) {
  const args = parseExactFlagPairs(argv, {
    allowed: SEED_FLAGS,
    required: SEED_FLAGS,
  });
  const scope = await loadApprovedCloudScope();
  assertApprovedCloudBinding(args, scope);
  assertExternalActivationAuthorization(args);
  const instant = assertActivationWindowOpen(scope, {
    now: () => new Date(),
  });
  assertLiveActivationCapability(options.activationCapability);
  if (
    Object.keys(options).some((key) => key !== "activationCapability")
  ) throw seedError("PRODUCTION_SEED_DEPENDENCY_INJECTION_FORBIDDEN");
  try {
    assertNoDangerousExternalEnvironment(process.env);
  } catch {
    throw seedError("SEED_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN");
  }

  const fixture = args.get("--fixture");
  const locale = args.get("--locale");
  if (fixture !== "synthetic-wp13-12b-only") {
    throw seedError("SYNTHETIC_FIXTURE_ALLOWLIST_MISMATCH");
  }
  if (locale !== "nb" && locale !== "nn") {
    throw seedError("FIRST_CLASS_LOCALE_REQUIRED");
  }
  const providerLocale = locale === "nb" ? "nb-NO" : "nn-NO";
  const issueUrl = canonicalFunctionUrl(args.get("--issue-url"));
  if (typeof nativeFetch !== "function") {
    throw seedError("FETCH_IMPLEMENTATION_REQUIRED");
  }
  const googleOAuth = await acquirePinnedGoogleOAuthAccessToken();
  const gcloudExecFile = createPinnedGoogleCloudCliExecFile({
    environment: process.env,
    googleOAuth,
  });

  const commonGcloudArgs = [
    `--project=${scope.projectId}`,
    `--account=${scope.approvedGoogleAccount}`,
  ];
  const observedIssueUrl = canonicalFunctionUrl(
    runGcloudText(gcloudExecFile, [
      "functions",
      "describe",
      "issueSyntheticSession",
      "--gen2",
      `--region=${scope.region}`,
      ...commonGcloudArgs,
      "--format=value(serviceConfig.uri)",
    ], "ISSUE_FUNCTION_BINDING_VERIFICATION_FAILED"),
  );
  if (observedIssueUrl !== issueUrl) {
    throw seedError("ISSUE_FUNCTION_APPROVAL_BINDING_MISMATCH");
  }
  const identityTokenAuthority =
    await acquireSyntheticSeedIdentityToken({
      audience: issueUrl,
      baseAccessToken: googleOAuth.accessToken,
      fetchImpl: nativeFetch,
      now: () => instant,
    });
  const identityToken = identityTokenAuthority.token;

  let response;
  try {
    response = await nativeFetch(issueUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${identityToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ locale: providerLocale }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw seedError("SYNTHETIC_FIXTURE_SEED_REQUEST_FAILED");
  }
  if (!response?.ok) throw seedError("SYNTHETIC_FIXTURE_SEED_DENIED");
  const result = await safeJson(response);
  if (
    !/^synthetic-wp13-12b-[A-Za-z0-9_-]{20,64}$/u.test(
      result?.syntheticSessionId ?? "",
    )
    || typeof result?.expiresAt !== "string"
    || Number.isNaN(Date.parse(result.expiresAt))
    || !validCapability(result?.childCapability)
    || !validCapability(result?.adultCapability)
  ) {
    throw seedError("SYNTHETIC_FIXTURE_SEED_RESPONSE_INVALID");
  }
  return {
    seeded: true,
    project: scope.projectId,
    approvedGoogleAccount: scope.approvedGoogleAccount,
    region: scope.region,
    fixture,
    locale,
    providerLocale,
    syntheticSessionId: result.syntheticSessionId,
    expiresAt: result.expiresAt,
    identityTokenPrinted: false,
    capabilitiesPrinted: false,
    capabilitiesPersisted: false,
  };
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
    const activationCapability =
      await acquireLiveActivationCapability();
    process.stdout.write(
      `${JSON.stringify(await runSyntheticFixtureSeed(
        process.argv.slice(2),
        { activationCapability },
      ))}\n`,
    );
  } catch (error) {
    process.stderr.write(`${safeOperatorErrorCode(error)}\n`);
    process.exitCode = 1;
  }
}
