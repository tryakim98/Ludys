import assert from "node:assert/strict";
import test from "node:test";
import { handleDelete } from "../api/delete.mjs";
import { handleIssue } from "../api/issue.mjs";
import { handleRuntimeConfig } from "../api/runtime-config.mjs";

const deploymentHost = "ludys-wp13-12b-staging-a1b2c3.vercel.app";
const deploymentOrigin = `https://${deploymentHost}`;
const issueUrl = "https://issuesyntheticsession-qbqbamvs6q-lz.a.run.app";
const deleteUrl = "https://deletesyntheticsession-qbqbamvs6q-lz.a.run.app";
const commandUrl = "https://sessioncommand-qbqbamvs6q-lz.a.run.app";
const projectionUrl = "https://sessionprojection-qbqbamvs6q-lz.a.run.app";
const syntheticSessionId = "synthetic-wp13-12b-abcdefghijklmnopqrstuv";
const vercelOidc = `${"a".repeat(48)}.${"b".repeat(48)}.${"c".repeat(48)}`;
const googleIdToken = `${"d".repeat(48)}.${"e".repeat(48)}.${"f".repeat(48)}`;

const previewEnv = Object.freeze({
  VERCEL_ENV: "preview",
  VERCEL_URL: deploymentHost,
  LUDYS_DEPLOYMENT_ROLE: "active",
  LUDYS_GCP_PROJECT_NUMBER: "134654966474",
  LUDYS_GCP_WIF_POOL_ID: "ludys-vercel-preview",
  LUDYS_GCP_WIF_PROVIDER_ID: "vercel-preview",
  LUDYS_GCP_PREVIEW_SERVICE_ACCOUNT:
    "ludys-preview-invoker@ludys-12b-stg-20260725.iam.gserviceaccount.com",
  LUDYS_ISSUE_FUNCTION_URL: issueUrl,
  LUDYS_DELETE_FUNCTION_URL: deleteUrl,
  LUDYS_COMMAND_FUNCTION_URL: commandUrl,
  LUDYS_PROJECTION_FUNCTION_URL: projectionUrl,
});

function request({
  method = "POST",
  url = "/api/issue",
  origin = deploymentOrigin,
  body = {},
  oidc = vercelOidc,
} = {}) {
  return {
    method,
    url,
    body,
    headers: {
      host: deploymentHost,
      origin,
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      ...(oidc === undefined ? {} : { "x-vercel-oidc-token": oidc }),
    },
  };
}

function response() {
  return {
    statusCode: undefined,
    headers: new Map(),
    body: undefined,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), value);
    },
    end(value) {
      this.body = value;
    },
  };
}

function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function successfulIdentityFetch(finalValue, expectedPrivateUrl) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return jsonResponse(200, {
        access_token: `ya29.${"g".repeat(48)}`,
        token_type: "Bearer",
        expires_in: 300,
      });
    }
    if (calls.length === 2) return jsonResponse(200, { token: googleIdToken });
    assert.equal(url, expectedPrivateUrl);
    return jsonResponse(200, finalValue);
  };
  return { calls, fetchImpl };
}

test("issue is exact-origin, preview-only, and uses STS then generateIdToken", async () => {
  const issued = {
    syntheticSessionId,
    childCapability: `${"h".repeat(96)}.${"i".repeat(43)}`,
    adultCapability: `${"j".repeat(96)}.${"k".repeat(43)}`,
    expiresAt: "2026-07-27T12:10:00.000Z",
    childProjection: { role: "CHILD" },
    adultProjection: { role: "ADULT" },
  };
  const { calls, fetchImpl } = successfulIdentityFetch(issued, issueUrl);
  const output = response();
  await handleIssue(
    request({
      body: {
        locale: "nb-NO",
        lifetimeMs: 600_000,
      },
    }),
    output,
    { env: previewEnv, fetchImpl },
  );

  assert.equal(output.statusCode, 201);
  assert.deepEqual(JSON.parse(output.body), issued);
  assert.equal(output.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(output.headers.has("set-cookie"), false);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://sts.googleapis.com/v1/token");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["Content-Type"], "application/x-www-form-urlencoded");
  const stsBody = new URLSearchParams(calls[0].options.body);
  assert.equal(stsBody.get("subject_token"), vercelOidc);
  assert.equal(
    stsBody.get("audience"),
    "//iam.googleapis.com/projects/134654966474/locations/global/"
      + "workloadIdentityPools/ludys-vercel-preview/providers/vercel-preview",
  );
  assert.equal(stsBody.get("subject_token_type"), "urn:ietf:params:oauth:token-type:jwt");
  assert.equal(stsBody.get("requested_token_type"), "urn:ietf:params:oauth:token-type:access_token");
  assert.equal(calls[0].url.includes(vercelOidc), false);

  assert.match(
    calls[1].url,
    /^https:\/\/iamcredentials\.googleapis\.com\/v1\/projects\/-\/serviceAccounts\/.+:generateIdToken$/u,
  );
  assert.equal(calls[1].options.headers.Authorization, `Bearer ya29.${"g".repeat(48)}`);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    audience: issueUrl,
    includeEmail: false,
  });
  assert.equal(calls[2].options.headers.Authorization, `Bearer ${googleIdToken}`);
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    locale: "nb-NO",
    lifetimeMs: 600_000,
  });
});

test("cross-origin issue fails before any identity exchange", async () => {
  let fetchCount = 0;
  const output = response();
  await handleIssue(
    request({
      origin: "https://untrusted.example",
      body: { locale: "nb-NO", lifetimeMs: 600_000 },
    }),
    output,
    {
      env: previewEnv,
      fetchImpl: async () => {
        fetchCount += 1;
        throw new Error("must not run");
      },
    },
  );
  assert.equal(output.statusCode, 403);
  assert.deepEqual(JSON.parse(output.body), {
    ok: false,
    denialClass: "SAME_ORIGIN_REQUIRED",
  });
  assert.equal(fetchCount, 0);
});

test("rollback deployment denies issuance before identity exchange but retains delete configuration", async () => {
  let fetchCount = 0;
  const output = response();
  await handleIssue(
    request({
      body: { locale: "nb-NO", lifetimeMs: 600_000 },
    }),
    output,
    {
      env: {
        ...previewEnv,
        LUDYS_DEPLOYMENT_ROLE: "rollback",
      },
      fetchImpl: async () => {
        fetchCount += 1;
        throw new Error("must not run");
      },
    },
  );
  assert.equal(output.statusCode, 503);
  assert.deepEqual(JSON.parse(output.body), {
    ok: false,
    denialClass: "ROLLBACK_SAFE_DISABLED",
  });
  assert.equal(fetchCount, 0);
});

test("production and missing Vercel OIDC fail closed", async () => {
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    throw new Error("must not run");
  };
  const productionOutput = response();
  await handleIssue(
    request({ body: { locale: "nn-NO", lifetimeMs: 600_000 } }),
    productionOutput,
    { env: { ...previewEnv, VERCEL_ENV: "production" }, fetchImpl },
  );
  assert.equal(productionOutput.statusCode, 503);
  assert.equal(JSON.parse(productionOutput.body).denialClass, "PREVIEW_RUNTIME_REQUIRED");

  const missingOidcOutput = response();
  await handleIssue(
    request({
      oidc: null,
      body: { locale: "nn-NO", lifetimeMs: 600_000 },
    }),
    missingOidcOutput,
    { env: previewEnv, fetchImpl },
  );
  assert.equal(missingOidcOutput.statusCode, 401);
  assert.equal(JSON.parse(missingOidcOutput.body).denialClass, "VERCEL_OIDC_REQUIRED");
  assert.equal(fetchCount, 0);
});

test("delete accepts only the synthetic session id and invokes the private audience", async () => {
  const deleted = { terminalStatus: "DELETED", audioStatus: "SILENT" };
  const { calls, fetchImpl } = successfulIdentityFetch(deleted, deleteUrl);
  const output = response();
  await handleDelete(
    request({
      url: "/api/delete",
      body: { syntheticSessionId },
    }),
    output,
    { env: previewEnv, fetchImpl },
  );
  assert.equal(output.statusCode, 200);
  assert.deepEqual(JSON.parse(output.body), deleted);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    audience: deleteUrl,
    includeEmail: false,
  });
  assert.deepEqual(JSON.parse(calls[2].options.body), { syntheticSessionId });

  let rejectedFetches = 0;
  const rejected = response();
  await handleDelete(
    request({
      url: "/api/delete",
      body: {
        syntheticSessionId,
        capability: `${"x".repeat(96)}.${"y".repeat(43)}`,
      },
    }),
    rejected,
    {
      env: previewEnv,
      fetchImpl: async () => {
        rejectedFetches += 1;
        throw new Error("must not run");
      },
    },
  );
  assert.equal(rejected.statusCode, 400);
  assert.equal(JSON.parse(rejected.body).denialClass, "REQUEST_SCHEMA_INVALID");
  assert.equal(rejectedFetches, 0);
});

test("runtime config exposes only public synthetic endpoint configuration", async () => {
  const output = response();
  await handleRuntimeConfig(
    {
      method: "GET",
      url: "/api/runtime-config",
      headers: {
        host: deploymentHost,
        "sec-fetch-site": "same-origin",
      },
    },
    output,
    { env: previewEnv },
  );
  assert.equal(output.statusCode, 200);
  assert.deepEqual(JSON.parse(output.body), {
    schemaVersion: "wp13.12b-external-preview-config-v1",
    mode: "EXTERNAL_SYNTHETIC_STAGING",
    syntheticOnly: true,
    deploymentRole: "active",
    issuanceEnabled: true,
    studentBeta: "NOT_AUTHORIZED",
    production: "NOT_AUTHORIZED",
    wp13_12c: "BLOCKED",
    commandUrl,
    projectionUrl,
  });
  assert.equal(output.body.includes("SERVICE_ACCOUNT"), false);
  assert.equal(output.body.includes("WIF"), false);
});

test("runtime and private proxy reject any unpinned provider or identity target", async () => {
  const runtimeOutput = response();
  await handleRuntimeConfig(
    {
      method: "GET",
      url: "/api/runtime-config",
      headers: {
        host: deploymentHost,
        "sec-fetch-site": "same-origin",
      },
    },
    runtimeOutput,
    {
      env: {
        ...previewEnv,
        LUDYS_COMMAND_FUNCTION_URL: "https://attacker.run.app",
      },
    },
  );
  assert.equal(runtimeOutput.statusCode, 503);
  assert.equal(
    JSON.parse(runtimeOutput.body).denialClass,
    "PROVIDER_CONFIGURATION_INVALID",
  );

  for (const override of [
    { LUDYS_ISSUE_FUNCTION_URL: "https://attacker.run.app" },
    {
      LUDYS_GCP_PREVIEW_SERVICE_ACCOUNT:
        "attacker-preview@ludys-12b-stg-20260725.iam.gserviceaccount.com",
    },
  ]) {
    let fetchCount = 0;
    const output = response();
    await handleIssue(
      request({
        body: {
          locale: "nb-NO",
          lifetimeMs: 600_000,
        },
      }),
      output,
      {
        env: { ...previewEnv, ...override },
        fetchImpl: async () => {
          fetchCount += 1;
          throw new Error("must not run");
        },
      },
    );
    assert.equal(output.statusCode, 503);
    assert.equal(fetchCount, 0);
  }
});
