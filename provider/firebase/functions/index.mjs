import { http } from "@google-cloud/functions-framework";
import {
  SyntheticStagingAuthoritativeHandler,
} from "./lib/provider/firebase/functions/src/authoritative-handler.js";
import { FirestoreRestSyntheticStagingStore } from "./firestore-store.mjs";

const region = "europe-north1";
const releaseIds = {
  appVersion: "0.14.0-reconstructed.9",
  contentReleaseId: "wp13-8-authentic-draft-corpus-r1",
  knowledgeReleaseId: "release-knowledge-audio-prototype-001",
  audioReleaseId: "wp13-9-audio-specifications-r1",
  operationsReleaseId: "wp13-11-operations-kit-r1",
  providerDecisionReleaseId: "wp13-12a-provider-decision-r1",
  stagingProviderReleaseId: "wp13-12b-synthetic-staging-provider-r1",
  schemaVersion: "wp13.12b-synthetic-staging-v1",
};

function configuredRuntimePhase() {
  if (process.env.LUDYS_LOCAL_EMULATOR_PROOF === "true") return "LOCAL_EMULATOR_PROOF";
  const value = process.env.LUDYS_STAGING_RUNTIME_PHASE;
  if (value !== "LOCAL_EMULATOR_PROOF" && value !== "EXTERNAL_SYNTHETIC_STAGING") {
    throw new Error("SERVER_CONFIGURATION_INVALID");
  }
  return value;
}

function configuredPreviewOrigin() {
  const value = process.env.LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN;
  if (typeof value !== "string" || value.length < 1 || value.length > 2048 || value.includes("*")) {
    throw new Error("SERVER_CONFIGURATION_INVALID");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("SERVER_CONFIGURATION_INVALID");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.origin !== value
    || !parsed.hostname.endsWith(".vercel.app")
    || parsed.hostname === "vercel.app"
    || parsed.username !== ""
    || parsed.password !== ""
  ) {
    throw new Error("SERVER_CONFIGURATION_INVALID");
  }
  return value;
}

function previewIngressReady() {
  try {
    configuredPreviewOrigin();
    return true;
  } catch {
    return false;
  }
}

function createHandler() {
  const projectId = process.env.GCLOUD_PROJECT ?? "";
  const key = process.env.LUDYS_CAPABILITY_HMAC_KEY ?? "";
  if (key.length < 32) throw new Error("SERVER_CONFIGURATION_INVALID");
  return new SyntheticStagingAuthoritativeHandler(
    new FirestoreRestSyntheticStagingStore(projectId),
    Buffer.from(key, "utf8"),
    releaseIds,
    {
      sessionIssuanceEnabled: (
        process.env.LUDYS_LOCAL_EMULATOR_PROOF === "true"
        || process.env.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED === "true"
      ),
      region,
      projectId,
      runtimePhase: configuredRuntimePhase(),
      previewIngressReady: previewIngressReady(),
    },
  );
}

function requestShape(request) {
  return {
    authorization: request.get("authorization"),
    body: request.body ?? {},
    url: request.originalUrl,
    query: request.query,
  };
}

function send(response, result) {
  response
    .set("cache-control", "no-store")
    .set("content-security-policy", "default-src 'none'; frame-ancestors 'none'")
    .status(result.status)
    .json(result.ok ? result.value : { ok: false, denialClass: result.denialClass });
}

function endpoint(method, execute) {
  return async (request, response) => {
    if (request.method !== method) return response.sendStatus(405);
    try {
      send(response, await execute(createHandler(), request));
    } catch (error) {
      const localDiagnostic = (
        process.env.LUDYS_LOCAL_EMULATOR_PROOF === "true"
        && error instanceof Error
        && /^[A-Z0-9_]+(?:_[0-9]{3})?$/u.test(error.message)
      ) ? `_${error.message}` : "";
      send(response, {
        ok: false,
        status: 503,
        denialClass: `SERVER_CONFIGURATION_OR_PROVIDER_UNAVAILABLE${localDiagnostic}`,
        value: undefined,
      });
    }
  };
}

const allowedCorsRequestHeaders = new Set(["authorization", "content-type"]);

function preflightHeadersAllowed(request) {
  if (request.get("access-control-request-method") !== "POST") return false;
  const value = request.get("access-control-request-headers");
  if (typeof value !== "string" || value.length < 1 || value.length > 256) return false;
  const requested = value.split(",").map((header) => header.trim().toLowerCase());
  return (
    requested.every((header) => header.length > 0 && allowedCorsRequestHeaders.has(header))
    && new Set(requested).size === requested.length
  );
}

function setAllowedCorsHeaders(response, origin, preflight = false) {
  response
    .set("vary", "Origin")
    .set("access-control-allow-origin", origin);
  if (preflight) {
    response
      .set("access-control-allow-methods", "POST")
      .set("access-control-allow-headers", "Authorization, Content-Type")
      .set("access-control-max-age", "600");
  }
}

function publicCorsEndpoint(execute) {
  const postEndpoint = endpoint("POST", execute);
  return async (request, response) => {
    let allowedOrigin;
    try {
      allowedOrigin = configuredPreviewOrigin();
    } catch {
      return send(response, {
        ok: false,
        status: 503,
        denialClass: "SERVER_CONFIGURATION_OR_PROVIDER_UNAVAILABLE",
        value: undefined,
      });
    }

    const requestOrigin = request.get("origin");
    response.set("vary", "Origin");
    if (requestOrigin !== undefined && requestOrigin !== allowedOrigin) {
      return send(response, {
        ok: false,
        status: 403,
        denialClass: "ORIGIN_NOT_ALLOWED",
        value: undefined,
      });
    }

    if (request.method === "OPTIONS") {
      if (requestOrigin !== allowedOrigin || !preflightHeadersAllowed(request)) {
        return send(response, {
          ok: false,
          status: 403,
          denialClass: "CORS_PREFLIGHT_DENIED",
          value: undefined,
        });
      }
      setAllowedCorsHeaders(response, allowedOrigin, true);
      return response.status(204).send();
    }

    if (requestOrigin === allowedOrigin) setAllowedCorsHeaders(response, allowedOrigin);
    return postEndpoint(request, response);
  };
}

// Deploy issueSyntheticSession with IAM and without --allow-unauthenticated.
export const issueSyntheticSession = endpoint("POST", (handler, request) => (
  handler.issueSyntheticSession({
    operatorAuthorized: true,
    locale: request.body?.locale,
    lifetimeMs: request.body?.lifetimeMs,
  })
));
http("issueSyntheticSession", issueSyntheticSession);

// Deploy these ingress functions only under the separately authorized staging
// project. Bearer capabilities are the application authority; privileged
// Firestore REST calls use runtime IAM while direct client access remains
// denied by Security Rules.
export const sessionCommand = publicCorsEndpoint((handler, request) => (
  handler.sessionCommand(requestShape(request))
));
http("sessionCommand", sessionCommand);
export const sessionProjection = publicCorsEndpoint((handler, request) => (
  handler.sessionProjection(requestShape(request))
));
http("sessionProjection", sessionProjection);
export const deleteSyntheticSession = endpoint("POST", (handler, request) => (
  handler.deleteSyntheticSession(requestShape(request), { operatorAuthorized: true })
));
http("deleteSyntheticSession", deleteSyntheticSession);
export const health = endpoint("GET", (handler) => handler.health());
http("health", health);
