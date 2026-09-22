import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FirestoreRestSyntheticStagingStore,
  firestoreRestTimeouts,
} from "../provider/firebase/functions/firestore-store.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const functionsDir = join(repo, "provider", "firebase", "functions");
const firestorePort = 8090;
const functionsPort = 5010;
const allowedPreviewOrigin = "https://ludys-wp13-12b-test.vercel.app";
let observedCommit;

async function assertProviderDependencySecurityContract() {
  const providerRequire = createRequire(join(functionsDir, "package.json"));
  const fastUri = providerRequire("fast-uri");
  const fastUriManifest = JSON.parse(await readFile(
    join(functionsDir, "node_modules", "fast-uri", "package.json"),
    "utf8",
  ));
  assert.equal(fastUriManifest.name, "fast-uri");
  assert.equal(fastUriManifest.version, "3.1.5");
  assert.equal(fastUriManifest.license, "BSD-3-Clause");

  const malformedAuthorityInputs = [
    String.raw`http:\\evil.invalid/path`,
    String.raw`http:/\evil.invalid/path`,
    String.raw`http:\/evil.invalid/path`,
    String.raw`\\evil.invalid/path`,
  ];
  for (const input of malformedAuthorityInputs) {
    assert.equal(
      fastUri.parse(input).error,
      "URI authority must not contain a literal backslash.",
    );
    assert.throws(
      () => fastUri.resolve("https://allowed.invalid/", input),
      /URI authority must not contain a literal backslash\./u,
    );
    assert.equal(
      new URL(input, "https://allowed.invalid/").hostname,
      "evil.invalid",
      "Node URL demonstrates the host-confusion class without network use",
    );
  }
  assert.equal(
    fastUri.resolve(
      "https://allowed.invalid/",
      "http://allowed.invalid/path",
    ),
    "http://allowed.invalid/path",
  );
  assert.equal(
    fastUri.resolve("https://allowed.invalid/", "/absolute/path"),
    "https://allowed.invalid/absolute/path",
  );
  assert.equal(
    fastUri.resolve("https://allowed.invalid/", "relative/path"),
    "https://allowed.invalid/relative/path",
  );

  const { CloudEvent, HTTP } = providerRequire("cloudevents");
  const cloudEvent = new CloudEvent({
    specversion: "1.0",
    id: "synthetic-security-regression",
    source: "/ludys/wp13-12b/security-regression",
    type: "no.ludys.synthetic.security.regression",
    time: "2026-08-05T00:00:00.000Z",
    datacontenttype: "application/json",
    data: { synthetic: true },
  });
  const cloudEventMessage = HTTP.binary(cloudEvent);
  const cloudEventRoundTrip = HTTP.toEvent({
    headers: cloudEventMessage.headers,
    body: cloudEventMessage.body,
  });
  assert.deepEqual({
    specversion: cloudEventRoundTrip.specversion,
    id: cloudEventRoundTrip.id,
    source: cloudEventRoundTrip.source,
    type: cloudEventRoundTrip.type,
    time: cloudEventRoundTrip.time,
    datacontenttype: cloudEventRoundTrip.datacontenttype,
    data: cloudEventRoundTrip.data,
  }, {
    specversion: "1.0",
    id: "synthetic-security-regression",
    source: "/ludys/wp13-12b/security-regression",
    type: "no.ludys.synthetic.security.regression",
    time: "2026-08-05T00:00:00.000Z",
    datacontenttype: "application/json",
    data: { synthetic: true },
  });
  for (const source of malformedAuthorityInputs) {
    assert.throws(() => new CloudEvent({
      specversion: "1.0",
      id: "synthetic-invalid-source",
      source,
      type: "no.ludys.synthetic.security.regression",
    }), /uri-reference/u);
  }

  const Ajv = providerRequire("ajv");
  const validateSyntheticPayload = new Ajv({ strict: true }).compile({
    type: "object",
    additionalProperties: false,
    required: ["synthetic"],
    properties: { synthetic: { const: true } },
  });
  assert.equal(validateSyntheticPayload({ synthetic: true }), true);
  assert.equal(validateSyntheticPayload({ synthetic: false }), false);
}

function responseHarness() {
  const result = {
    status: 200,
    headers: new Map(),
    body: undefined,
  };
  const response = {
    set(name, value) {
      result.headers.set(name.toLowerCase(), value);
      return response;
    },
    status(status) {
      result.status = status;
      return response;
    },
    json(body) {
      result.body = body;
      return response;
    },
    send(body) {
      result.body = body;
      return response;
    },
    sendStatus(status) {
      result.status = status;
      return response;
    },
  };
  return { response, result };
}

async function invoke(endpoint, name, {
  method,
  headers = {},
  body = {},
} = {}) {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const { response, result } = responseHarness();
  await endpoint({
    method,
    get: (header) => normalizedHeaders.get(header.toLowerCase()),
    body,
    originalUrl: `/${name}`,
    query: {},
  }, response);
  return result;
}

function endpointManifestBlock(manifest, name) {
  const marker = `  ${name}:`;
  const start = manifest.indexOf(marker);
  assert.notEqual(start, -1, `missing manifest endpoint ${name}`);
  const remaining = manifest.slice(start + marker.length);
  const next = remaining.search(/\n  [A-Za-z][A-Za-z0-9]*:/u);
  return next === -1 ? remaining : remaining.slice(0, next);
}

async function assertProviderIngressContract() {
  const manifest = await readFile(
    join(functionsDir, "functions.yaml"),
    "utf8",
  );
  const publicNames = ["sessionCommand", "sessionProjection"];
  const privateNames = ["issueSyntheticSession", "deleteSyntheticSession", "health"];
  for (const name of [...publicNames, ...privateNames]) {
    const block = endpointManifestBlock(manifest, name);
    assert.match(block, /\n    minInstances: 0(?:\r)?$/mu);
    assert.match(block, /\n    maxInstances: 1(?:\r)?$/mu);
    assert.match(block, /\n    concurrency: 1(?:\r)?$/mu);
    assert.match(
      block,
      /\n      LUDYS_STAGING_RUNTIME_PHASE: "EXTERNAL_SYNTHETIC_STAGING"(?:\r)?$/mu,
    );
    assert.match(block, new RegExp(`\\n        - ${
      publicNames.includes(name) ? "public" : "private"
    }(?:\\r)?$`, "mu"));
  }
  assert.match(
    endpointManifestBlock(manifest, "issueSyntheticSession"),
    /\n      LUDYS_STAGING_SESSION_ISSUANCE_ENABLED: "false"(?:\r)?$/mu,
  );
  assert.equal((manifest.match(/\n        - public(?:\r)?$/gmu) ?? []).length, 2);

  const savedEnvironment = Object.fromEntries([
    "GCLOUD_PROJECT",
    "LUDYS_CAPABILITY_HMAC_KEY",
    "LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN",
    "LUDYS_STAGING_RUNTIME_PHASE",
  ].map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    GCLOUD_PROJECT: "ludys-synthetic-dev",
    LUDYS_CAPABILITY_HMAC_KEY: "0123456789abcdef0123456789abcdef",
    LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN: allowedPreviewOrigin,
    LUDYS_STAGING_RUNTIME_PHASE: "LOCAL_EMULATOR_PROOF",
  });

  try {
    const endpoints = await import("../provider/firebase/functions/index.mjs");
    const preflightHeaders = {
      origin: allowedPreviewOrigin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "Authorization, Content-Type",
    };
    for (const name of publicNames) {
      const endpoint = endpoints[name];
      const preflight = await invoke(endpoint, name, {
        method: "OPTIONS",
        headers: preflightHeaders,
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), allowedPreviewOrigin);
      assert.equal(preflight.headers.get("access-control-allow-methods"), "POST");
      assert.equal(
        preflight.headers.get("access-control-allow-headers"),
        "Authorization, Content-Type",
      );
      assert.equal(preflight.headers.get("access-control-max-age"), "600");
      assert.equal(preflight.headers.get("access-control-allow-credentials"), undefined);
      assert.equal([...preflight.headers.values()].includes("*"), false);

      const bearer = "Bearer opaque.capability";
      const allowedPost = await invoke(endpoint, name, {
        method: "POST",
        headers: { origin: allowedPreviewOrigin, authorization: bearer },
        body: { syntheticSessionId: "synthetic-cors-runtime-test" },
      });
      assert.equal(allowedPost.status, 401);
      assert.equal(allowedPost.headers.get("access-control-allow-origin"), allowedPreviewOrigin);
      assert.equal(JSON.stringify(allowedPost.body).includes(bearer), false);

      const untrustedPost = await invoke(endpoint, name, {
        method: "POST",
        headers: { origin: "https://untrusted-preview.example", authorization: bearer },
        body: { syntheticSessionId: "synthetic-cors-runtime-test" },
      });
      assert.equal(untrustedPost.status, 403);
      assert.equal(untrustedPost.body.denialClass, "ORIGIN_NOT_ALLOWED");
      assert.equal(untrustedPost.headers.get("access-control-allow-origin"), undefined);
      assert.equal(JSON.stringify(untrustedPost.body).includes(bearer), false);

      const nonBrowserPost = await invoke(endpoint, name, {
        method: "POST",
        headers: { authorization: bearer },
        body: { syntheticSessionId: "synthetic-cors-runtime-test" },
      });
      assert.equal(nonBrowserPost.status, 401);
      assert.equal(nonBrowserPost.headers.get("access-control-allow-origin"), undefined);

      const extraHeaderPreflight = await invoke(endpoint, name, {
        method: "OPTIONS",
        headers: {
          ...preflightHeaders,
          "access-control-request-headers": "Authorization, Content-Type, X-Not-Allowed",
        },
      });
      assert.equal(extraHeaderPreflight.status, 403);
      assert.equal(extraHeaderPreflight.body.denialClass, "CORS_PREFLIGHT_DENIED");
      assert.equal(extraHeaderPreflight.headers.get("access-control-allow-origin"), undefined);
    }

    delete process.env.LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN;
    const missingConfiguration = await invoke(endpoints.sessionCommand, "sessionCommand", {
      method: "OPTIONS",
      headers: preflightHeaders,
    });
    assert.equal(missingConfiguration.status, 503);
    assert.equal(
      missingConfiguration.body.denialClass,
      "SERVER_CONFIGURATION_OR_PROVIDER_UNAVAILABLE",
    );
    assert.equal(missingConfiguration.headers.get("access-control-allow-origin"), undefined);
    const invalidProviderOrigins = [
      {
        label: "legacy local proof .invalid origin",
        value: "https://local-emulator-proof.invalid",
      },
      {
        label: "arbitrary HTTPS domain",
        value: "https://not-an-approved-vercel-origin.example",
      },
      { label: "empty origin", value: "" },
      { label: "wildcard Vercel origin", value: "https://*.vercel.app" },
      { label: "localhost origin", value: "https://localhost" },
      { label: "loopback origin", value: "http://127.0.0.1:5010" },
      {
        label: "Vercel origin with path",
        value: `${allowedPreviewOrigin}/proof`,
      },
      {
        label: "Vercel origin with query",
        value: `${allowedPreviewOrigin}?proof=true`,
      },
      {
        label: "Vercel origin with fragment",
        value: `${allowedPreviewOrigin}#proof`,
      },
    ];
    for (const { label, value } of invalidProviderOrigins) {
      process.env.LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN = value;
      for (const method of ["OPTIONS", "POST"]) {
        const invalidProviderOrigin = await invoke(
          endpoints.sessionCommand,
          "sessionCommand",
          {
            method,
            headers: method === "OPTIONS"
              ? preflightHeaders
              : { origin: allowedPreviewOrigin },
            body: { syntheticSessionId: "synthetic-cors-runtime-test" },
          },
        );
        assert.equal(invalidProviderOrigin.status, 503, `${label}: ${method}`);
        assert.equal(
          invalidProviderOrigin.body.denialClass,
          "SERVER_CONFIGURATION_OR_PROVIDER_UNAVAILABLE",
          `${label}: ${method}`,
        );
        assert.equal(
          invalidProviderOrigin.headers.get("access-control-allow-origin"),
          undefined,
          `${label}: ${method}`,
        );
      }
    }
    process.env.LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN = allowedPreviewOrigin;

    for (const name of privateNames) {
      const privateOptions = await invoke(endpoints[name], name, {
        method: "OPTIONS",
        headers: preflightHeaders,
      });
      assert.equal(privateOptions.status, 405);
      assert.equal(privateOptions.headers.get("access-control-allow-origin"), undefined);
    }
  } finally {
    for (const [key, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withEnvironment(patch, operation) {
  const saved = Object.fromEntries(
    Object.keys(patch).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await operation();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function firestoreControlResponse() {
  return new Response(JSON.stringify({
    fields: {
      controlEpoch: { integerValue: "7" },
      stagingEnabled: { booleanValue: false },
      reasonCode: { stringValue: "DISABLED_BY_DEFAULT" },
      changedAt: { stringValue: "2026-07-25T00:00:00.000Z" },
    },
    updateTime: "2026-07-25T00:00:00.000Z",
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function assertFirestoreTransportSecurityContract() {
  assert.deepEqual(firestoreRestTimeouts, {
    metadataTokenMs: 5_000,
    requestMs: 10_000,
  });

  await withEnvironment({
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8090",
    LUDYS_LOCAL_EMULATOR_PROOF: undefined,
    LUDYS_STAGING_RUNTIME_PHASE: "EXTERNAL_SYNTHETIC_STAGING",
  }, () => {
    assert.throws(
      () => new FirestoreRestSyntheticStagingStore(
        "ludys-synthetic-dev",
      ),
      /FIRESTORE_EMULATOR_MODE_FORBIDDEN/u,
    );
  });

  await withEnvironment({
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8090",
    LUDYS_LOCAL_EMULATOR_PROOF: "true",
    LUDYS_STAGING_RUNTIME_PHASE: "EXTERNAL_SYNTHETIC_STAGING",
  }, () => {
    assert.throws(
      () => new FirestoreRestSyntheticStagingStore(
        "ludys-synthetic-dev",
      ),
      /FIRESTORE_EMULATOR_MODE_INVALID/u,
    );
  });

  for (const emulatorHost of [
    "localhost:8090",
    "0.0.0.0:8090",
    "127.0.0.2:8090",
    "127.0.0.1",
    "127.0.0.1:0",
    "127.0.0.1:65536",
    "http://127.0.0.1:8090",
    "127.0.0.1:8090/path",
  ]) {
    await withEnvironment({
      FIRESTORE_EMULATOR_HOST: emulatorHost,
      LUDYS_LOCAL_EMULATOR_PROOF: "true",
      LUDYS_STAGING_RUNTIME_PHASE: "LOCAL_EMULATOR_PROOF",
    }, () => {
      assert.throws(
        () => new FirestoreRestSyntheticStagingStore(
          "ludys-synthetic-dev",
        ),
        /FIRESTORE_EMULATOR_HOST_INVALID/u,
        emulatorHost,
      );
    });
  }

  await withEnvironment({
    FIRESTORE_EMULATOR_HOST: undefined,
    LUDYS_LOCAL_EMULATOR_PROOF: "true",
    LUDYS_STAGING_RUNTIME_PHASE: "LOCAL_EMULATOR_PROOF",
  }, () => {
    assert.throws(
      () => new FirestoreRestSyntheticStagingStore(
        "ludys-synthetic-dev",
      ),
      /FIRESTORE_EMULATOR_HOST_REQUIRED/u,
    );
  });

  await withEnvironment({
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8090",
    LUDYS_LOCAL_EMULATOR_PROOF: "true",
    LUDYS_STAGING_RUNTIME_PHASE: "LOCAL_EMULATOR_PROOF",
  }, () => {
    assert.throws(
      () => new FirestoreRestSyntheticStagingStore(
        "ludys-synthetic-dev",
        { emulatorHost: "127.0.0.1:8091" },
      ),
      /FIRESTORE_EMULATOR_HOST_MISMATCH/u,
    );
  });

  await withEnvironment({
    FIRESTORE_EMULATOR_HOST: undefined,
    LUDYS_LOCAL_EMULATOR_PROOF: undefined,
    LUDYS_STAGING_RUNTIME_PHASE: "EXTERNAL_SYNTHETIC_STAGING",
  }, () => {
    assert.throws(
      () => new FirestoreRestSyntheticStagingStore(
        "ludys-synthetic-dev",
        { metadataOrigin: "http://127.0.0.1:8090" },
      ),
      /RUNTIME_METADATA_ORIGIN_INVALID/u,
    );
  });

  const originalFetch = globalThis.fetch;
  const productionCalls = [];
  try {
    globalThis.fetch = async (url, init = {}) => {
      productionCalls.push({ url: String(url), init });
      assert.equal(init.signal instanceof AbortSignal, true);
      if (productionCalls.length === 1) {
        assert.equal(
          String(url),
          "http://metadata.google.internal/computeMetadata/v1/"
            + "instance/service-accounts/default/token",
        );
        assert.equal(init.headers["Metadata-Flavor"], "Google");
        assert.equal(init.headers.authorization, undefined);
        return new Response(JSON.stringify({
          access_token: "metadata-test-token-never-sent-to-emulator",
          expires_in: 3_600,
        }), { status: 200 });
      }
      assert.equal(
        String(url).startsWith(
          "https://firestore.googleapis.com/v1/projects/"
            + "ludys-synthetic-dev/",
        ),
        true,
      );
      assert.equal(
        init.headers.authorization,
        "Bearer metadata-test-token-never-sent-to-emulator",
      );
      return firestoreControlResponse();
    };
    await withEnvironment({
      FIRESTORE_EMULATOR_HOST: undefined,
      LUDYS_LOCAL_EMULATOR_PROOF: undefined,
      LUDYS_STAGING_RUNTIME_PHASE: "EXTERNAL_SYNTHETIC_STAGING",
    }, async () => {
      const store = new FirestoreRestSyntheticStagingStore(
        "ludys-synthetic-dev",
      );
      assert.equal((await store.loadControl()).controlEpoch, 7);
    });
    assert.equal(productionCalls.length, 2);

    const emulatorCalls = [];
    globalThis.fetch = async (url, init = {}) => {
      emulatorCalls.push({ url: String(url), init });
      assert.equal(init.signal instanceof AbortSignal, true);
      assert.equal(
        String(url).startsWith(
          "http://127.0.0.1:8090/v1/projects/ludys-synthetic-dev/",
        ),
        true,
      );
      assert.equal(init.headers.authorization, "Bearer owner");
      assert.equal(
        JSON.stringify(init).includes(
          "metadata-test-token-never-sent-to-emulator",
        ),
        false,
      );
      return firestoreControlResponse();
    };
    await withEnvironment({
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8090",
      LUDYS_LOCAL_EMULATOR_PROOF: "true",
      LUDYS_STAGING_RUNTIME_PHASE: "LOCAL_EMULATOR_PROOF",
    }, async () => {
      const store = new FirestoreRestSyntheticStagingStore(
        "ludys-synthetic-dev",
      );
      assert.equal((await store.loadControl()).controlEpoch, 7);
    });
    assert.equal(emulatorCalls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await assertProviderDependencySecurityContract();
await assertFirestoreTransportSecurityContract();
await assertProviderIngressContract();

const firestore = createServer((request, response) => {
  if (
    request.method === "GET"
    && request.url?.includes("/documents/syntheticStagingControl/current")
  ) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      name: "projects/ludys-synthetic-dev/databases/(default)/documents/syntheticStagingControl/current",
      fields: {
        controlEpoch: { integerValue: "7" },
        stagingEnabled: { booleanValue: false },
        reasonCode: { stringValue: "DISABLED_BY_DEFAULT" },
        changedAt: { stringValue: "2026-07-25T00:00:00.000Z" },
      },
      updateTime: "2026-07-25T00:00:00.000Z",
    }));
    return;
  }
  if (
    request.method === "GET"
    && request.url?.includes(
      "/documents/syntheticSessions/synthetic-wp13-12b-runtime-contract",
    )
  ) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      name: "projects/ludys-synthetic-dev/databases/(default)/documents/syntheticSessions/synthetic-wp13-12b-runtime-contract",
      fields: observedCommit.body.writes[0].update.fields,
      updateTime: "2026-07-25T00:00:01.000Z",
    }));
    return;
  }
  if (
    request.method === "POST"
    && request.url?.endsWith("/databases/(default)/documents:runQuery")
  ) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify([
      {
        document: {
          name: "projects/ludys-synthetic-dev/databases/(default)/documents/syntheticCapabilityGrants/synthetic-runtime-contract-nonce",
          fields: {},
          updateTime: "2026-07-25T00:00:01.000Z",
        },
      },
      {
        document: {
          name: "projects/ludys-synthetic-dev/databases/(default)/documents/syntheticCapabilityGrants/synthetic-runtime-contract-second-nonce",
          fields: {},
          updateTime: "2026-07-25T00:00:02.000Z",
        },
      },
    ]));
    return;
  }
  if (
    request.method === "POST"
    && request.url?.endsWith("/databases/(default)/documents:commit")
  ) {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      observedCommit = {
        authorization: request.headers.authorization,
        body: JSON.parse(body),
      };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        writeResults: [],
        commitTime: "2026-07-25T00:00:01.000Z",
      }));
    });
    return;
  }
  response.writeHead(404);
  response.end();
});

await new Promise((resolve, reject) => {
  firestore.once("error", reject);
  firestore.listen(firestorePort, "127.0.0.1", resolve);
});

const child = spawn(process.execPath, [
  "node_modules/@google-cloud/functions-framework/build/src/main.js",
  "--target=health",
  `--port=${functionsPort}`,
  "--source=.",
], {
  cwd: functionsDir,
  env: {
    ...process.env,
    GCLOUD_PROJECT: "ludys-synthetic-dev",
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${firestorePort}`,
    LUDYS_CAPABILITY_HMAC_KEY: "0123456789abcdef0123456789abcdef",
    LUDYS_LOCAL_EMULATOR_PROOF: "true",
    LUDYS_STAGING_SESSION_ISSUANCE_ENABLED: "false",
    LUDYS_STAGING_RUNTIME_PHASE: "LOCAL_EMULATOR_PROOF",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });

try {
  const store = await withEnvironment({
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${firestorePort}`,
    LUDYS_LOCAL_EMULATOR_PROOF: "true",
    LUDYS_STAGING_RUNTIME_PHASE: "LOCAL_EMULATOR_PROOF",
  }, () => new FirestoreRestSyntheticStagingStore(
    "ludys-synthetic-dev",
    { emulatorHost: `127.0.0.1:${firestorePort}` },
  ));
  assert.equal(await store.createSession({
    syntheticSessionId: "synthetic-wp13-12b-runtime-contract",
    dataClassification: "SYNTHETIC_ONLY_NO_PARTICIPANT_DATA",
    lifecycle: {
      sessionId: "synthetic-wp13-12b-runtime-contract",
      locale: "nb-NO",
      dataClassification: "SYNTHETIC_TECHNICAL_DRAFT",
      state: "READY",
      version: 2,
      authorityGeneration: 1,
      createdAt: "2026-07-25T00:00:00.000Z",
      updatedAt: "2026-07-25T00:00:00.000Z",
      resumeTarget: undefined,
      recoveryTarget: undefined,
      helpRequested: false,
      childProjectionToken: "child-projection",
      adultProjectionToken: "adult-projection",
    },
    controlEpoch: 7,
    releaseIds: {
      stagingProviderReleaseId: "wp13-12b-synthetic-staging-provider-r1",
      schemaVersion: "wp13.12b-synthetic-staging-v1",
    },
    expiresAt: "2026-07-25T00:15:00.000Z",
    processedCommandIds: [],
    coarseTechnicalStatus: "READY",
  }, [{
    nonce: "synthetic-runtime-contract-nonce",
    syntheticSessionId: "synthetic-wp13-12b-runtime-contract",
    role: "CHILD",
    expiresAt: "2026-07-25T00:15:00.000Z",
    remainingCommands: 64,
    revoked: false,
  }]), true);
  assert.equal(observedCommit.authorization, "Bearer owner");
  assert.equal(
    observedCommit.body.writes[0].update.name,
    "projects/ludys-synthetic-dev/databases/(default)/documents/syntheticSessions/synthetic-wp13-12b-runtime-contract",
  );
  assert.equal(observedCommit.body.writes[0].update.name.startsWith("http"), false);
  assert.equal(await store.deleteSession({
    syntheticSessionId: "synthetic-wp13-12b-runtime-contract",
    lifecycle: { version: 3 },
  }, {
    syntheticSessionId: "synthetic-wp13-12b-runtime-contract",
    deletedAt: "2026-07-25T00:00:02.000Z",
    terminalState: "DELETED",
  }), true);
  assert.deepEqual(
    observedCommit.body.writes.map((write) => ({
      operation: Object.hasOwn(write, "delete") ? "delete" : "update",
      name: write.delete ?? write.update.name,
      precondition: write.currentDocument,
    })),
    [
      {
        operation: "delete",
        name: "projects/ludys-synthetic-dev/databases/(default)/documents/syntheticSessions/synthetic-wp13-12b-runtime-contract",
        precondition: { updateTime: "2026-07-25T00:00:01.000Z" },
      },
      {
        operation: "update",
        name: "projects/ludys-synthetic-dev/databases/(default)/documents/syntheticSessionTombstones/synthetic-wp13-12b-runtime-contract",
        precondition: { exists: false },
      },
      {
        operation: "delete",
        name: "projects/ludys-synthetic-dev/databases/(default)/documents/syntheticCapabilityGrants/synthetic-runtime-contract-nonce",
        precondition: { updateTime: "2026-07-25T00:00:01.000Z" },
      },
      {
        operation: "delete",
        name: "projects/ludys-synthetic-dev/databases/(default)/documents/syntheticCapabilityGrants/synthetic-runtime-contract-second-nonce",
        precondition: { updateTime: "2026-07-25T00:00:02.000Z" },
      },
    ],
  );
  assert.equal(
    observedCommit.body.writes[1].update.fields.dataClassification.stringValue,
    "MINIMUM_NO_RESURRECTION_TOMBSTONE",
  );

  let response;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${functionsPort}/`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  if (response === undefined) throw new Error(`Functions Framework did not start\n${stderr}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    serviceHealth: "READY_DISABLED_BY_DEFAULT",
    region: "europe-north1",
    runtimePhase: "LOCAL_EMULATOR_PROOF",
    providerActivation: "LOCAL_EMULATOR_ONLY",
    dataScope: "SYNTHETIC_ONLY_NO_PARTICIPANT_DATA",
    studentBeta: "NOT_AUTHORIZED",
    production: "NOT_AUTHORIZED",
    wp13_12c: "BLOCKED",
    controlEpoch: 7,
    stagingEnabled: false,
    ingressReady: true,
  });
  const artifact = {
    schemaVersion: "wp13.12b-functions-framework-proof-v1",
    status: "LOCAL_RUNTIME_COMPATIBILITY_PASSED",
    functionsFramework: "5.0.5",
    securityOverride: "cloudevents>uuid@11.1.1",
    fastUri: "3.1.5",
    advisoryRegression: "GHSA-7p8r-x3mc-p8w7",
    malformedAuthorityInputsRejected: true,
    cloudEventsAjvRoundTrip: true,
    endpoint: "health",
    firestore: "LOCAL_STUB_NO_PROVIDER_RESOURCE",
    externalCalls: 0,
    cloudResources: 0,
    deployment: false,
  };
  const output = join(repo, "artifacts", "wp13-12b-functions-framework-proof.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log("WP13.12B Functions Framework runtime compatibility passed with uuid security override and zero external calls.");
} finally {
  child.kill();
  firestore.close();
}
