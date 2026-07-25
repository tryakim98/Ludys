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

function createHandler() {
  const projectId = process.env.GCLOUD_PROJECT ?? "";
  const key = process.env.LUDYS_CAPABILITY_HMAC_KEY ?? "";
  if (key.length < 32) throw new Error("SERVER_CONFIGURATION_INVALID");
  return new SyntheticStagingAuthoritativeHandler(
    new FirestoreRestSyntheticStagingStore(projectId),
    Buffer.from(key, "utf8"),
    releaseIds,
    {
      sessionIssuanceEnabled: process.env.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED === "true",
      region,
      projectId,
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
    } catch {
      send(response, {
        ok: false,
        status: 503,
        denialClass: "SERVER_CONFIGURATION_OR_PROVIDER_UNAVAILABLE",
        value: undefined,
      });
    }
  };
}

// Deploy issueSyntheticSession with IAM and without --allow-unauthenticated.
http("issueSyntheticSession", endpoint("POST", (handler, request) => (
  handler.issueSyntheticSession({
    operatorAuthorized: true,
    locale: request.body?.locale,
    lifetimeMs: request.body?.lifetimeMs,
  })
)));

// Deploy these ingress functions only under the separately authorized staging
// project. Bearer capabilities are the application authority; privileged
// Firestore REST calls use runtime IAM while direct client access remains
// denied by Security Rules.
http("sessionCommand", endpoint("POST", (handler, request) => (
  handler.sessionCommand(requestShape(request))
)));
http("sessionProjection", endpoint("POST", (handler, request) => (
  handler.sessionProjection(requestShape(request))
)));
http("deleteSyntheticSession", endpoint("POST", (handler, request) => (
  handler.deleteSyntheticSession(requestShape(request), { operatorAuthorized: true })
)));
http("health", endpoint("GET", (handler) => handler.health()));
