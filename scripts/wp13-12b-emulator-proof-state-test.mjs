import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  canonicalGitDiffArguments,
  canonicalGitPathSetSha256,
  deriveCanonicalGitPathChange,
  parseCanonicalNulGitPaths,
  parseCanonicalNulGitTreeEntries,
} from "./wp13-12b-canonical-git-paths.mjs";
import {
  assertLoopbackEmulatorTransportUrl,
  assertSecurityRemediationChangePaths,
  assertSecurityRemediationCommitAncestry,
  assertEmulatorProofEnvironmentBinding,
  assertEnabledEmulatorProofState,
  assertFinalEmulatorProofState,
  assertInitialEmulatorProofState,
  buildSyntheticEmulatorOriginContract,
  canonicalSecurityRemediationGitDiffArguments,
  COMMIT_T_SHA,
  COMMIT_U_SHA,
  createLoopbackEmulatorFetch,
  EMULATOR_DEMO_PROJECT_ID,
  executePinnedGitPreflightBeforeEffects,
  executeEmulatorProofLifecycle,
  SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS,
} from "./wp13-12b-emulator-confirmation.mjs";

const proofRunId = "a".repeat(32);
const enabledReasonCode =
  `EXPLICIT_LOCAL_SYNTHETIC_PROOF_${proofRunId.slice(0, 16).toUpperCase()}`;
const commitT = "568d9f9e306075a81f6e4b243d3812507f97b230";
const commitU = "190fff88808bbafe605cdde4cfe9fe943f4543a4";

test("9.0 canonical Git diff arguments are exact and commit-bound", () => {
  assert.deepEqual(canonicalGitDiffArguments(commitT, commitU), [
    "--name-only",
    "--no-renames",
    "-z",
    commitT,
    commitU,
    "--",
  ]);
  for (const invalid of [
    () => canonicalGitDiffArguments(commitT.slice(0, 12), commitU),
    () => canonicalGitDiffArguments(commitT.toUpperCase(), commitU),
    () => canonicalGitDiffArguments(`-${commitT.slice(1)}`, commitU),
    () => canonicalGitDiffArguments(commitT, commitT),
    () => canonicalGitDiffArguments({ toString: () => commitT }, commitU),
  ]) assert.throws(invalid, /WP13_12B_CANONICAL_GIT_PATHS_/u);
});

test("9.0 T to U commit order, parent and canonical path set are fixed", () => {
  assert.deepEqual(
    canonicalSecurityRemediationGitDiffArguments(COMMIT_T_SHA, COMMIT_U_SHA),
    canonicalGitDiffArguments(COMMIT_T_SHA, COMMIT_U_SHA),
  );
  assert.equal(
    assertSecurityRemediationCommitAncestry([COMMIT_U_SHA, COMMIT_T_SHA]),
    true,
  );
  assert.deepEqual(
    assertSecurityRemediationChangePaths(
      [...SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS],
    ),
    SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS,
  );
  for (const invalid of [
    () => canonicalSecurityRemediationGitDiffArguments(COMMIT_U_SHA, COMMIT_T_SHA),
    () => assertSecurityRemediationCommitAncestry([COMMIT_U_SHA, "0".repeat(40)]),
    () => assertSecurityRemediationChangePaths([]),
    () => assertSecurityRemediationChangePaths(
      SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS.slice(1),
    ),
    () => assertSecurityRemediationChangePaths([
      ...SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS,
      "unexpected/extra.txt",
    ]),
    () => assertSecurityRemediationChangePaths(
      [...SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS].reverse(),
    ),
  ]) assert.throws(invalid, /SECURITY_REMEDIATION_/u);
});

test("9.0 Git validation failure prevents every proof-start effect", async () => {
  const calls = {
    sourcePrecondition: 0,
    proofToolBinding: 0,
    beginEffects: 0,
    jarStart: 0,
    emulatorStart: 0,
    secretWrite: 0,
    temporaryWrite: 0,
    proofWrite: 0,
    nonceWrite: 0,
    portOpen: 0,
    transport: 0,
  };
  await assert.rejects(
    () => executePinnedGitPreflightBeforeEffects({
      sourcePrecondition: async () => {
        calls.sourcePrecondition += 1;
        return {
          sourceCommit: "a".repeat(40),
          sourceTree: "b".repeat(40),
        };
      },
      proofToolBinding: () => {
        calls.proofToolBinding += 1;
        throw new Error("SIMULATED_PINNED_GIT_VALIDATION_FAILURE");
      },
      beginEffects: () => {
        calls.beginEffects += 1;
        for (const effect of [
          "jarStart",
          "emulatorStart",
          "secretWrite",
          "temporaryWrite",
          "proofWrite",
          "nonceWrite",
          "portOpen",
          "transport",
        ]) calls[effect] += 1;
      },
    }),
    /SIMULATED_PINNED_GIT_VALIDATION_FAILURE/u,
  );
  assert.deepEqual(calls, {
    sourcePrecondition: 1,
    proofToolBinding: 1,
    beginEffects: 0,
    jarStart: 0,
    emulatorStart: 0,
    secretWrite: 0,
    temporaryWrite: 0,
    proofWrite: 0,
    nonceWrite: 0,
    portOpen: 0,
    transport: 0,
  });
});

test("9.1 canonical NUL paths preserve Git names and normalize only set order", () => {
  const parsed = parseCanonicalNulGitPaths(Buffer.from(
    "z-last\0dir/path with space.txt\0tab\tname.txt\0a-first\0",
    "utf8",
  ));
  assert.deepEqual(parsed, [
    "a-first",
    "dir/path with space.txt",
    "tab\tname.txt",
    "z-last",
  ]);
  assert.equal(Object.isFrozen(parsed), true);
  assert.deepEqual(
    parseCanonicalNulGitPaths(Buffer.alloc(0), { allowEmpty: true }),
    [],
  );
  assert.equal(
    canonicalGitPathSetSha256([...parsed].reverse()),
    canonicalGitPathSetSha256([...parsed]),
  );
});

test("9.2 canonical NUL paths reject malformed and unsafe records", () => {
  for (const invalid of [
    Buffer.alloc(0),
    Buffer.from("missing-terminal-nul", "utf8"),
    Buffer.from("first\0\0", "utf8"),
    Buffer.from("duplicate\0duplicate\0", "utf8"),
    Buffer.from("/absolute\0", "utf8"),
    Buffer.from("C:/absolute\0", "utf8"),
    Buffer.from("../traversal\0", "utf8"),
    Buffer.from("safe/../../traversal\0", "utf8"),
    Buffer.from("back\\slash\0", "utf8"),
    Buffer.from(".git/config\0", "utf8"),
    Buffer.from([0xff, 0]),
  ]) assert.throws(
    () => parseCanonicalNulGitPaths(invalid),
    /WP13_12B_CANONICAL_GIT_PATHS_/u,
  );
});

test("9.3 canonical tree records derive only added or changed regular blobs", () => {
  const oldBlob = "1".repeat(40);
  const newBlob = "2".repeat(40);
  const entries = parseCanonicalNulGitTreeEntries(Buffer.from(
    `100644 blob ${newBlob}\tdir/path with space.txt\0`,
    "utf8",
  ));
  assert.deepEqual(entries, [{
    mode: "100644",
    objectType: "blob",
    objectId: newBlob,
    path: "dir/path with space.txt",
  }]);
  const absent = Object.freeze({ exists: false, blob: null, objectType: null });
  const oldState = Object.freeze({
    exists: true,
    blob: oldBlob,
    objectType: "blob",
  });
  const newState = Object.freeze({
    exists: true,
    blob: newBlob,
    objectType: "blob",
  });
  assert.deepEqual(
    deriveCanonicalGitPathChange("added.txt", absent, newState),
    { path: "added.txt", changeType: "A" },
  );
  assert.deepEqual(
    deriveCanonicalGitPathChange("modified.txt", oldState, newState),
    { path: "modified.txt", changeType: "M" },
  );
  for (const states of [
    [newState, absent],
    [absent, absent],
    [newState, newState],
  ]) assert.throws(
    () => deriveCanonicalGitPathChange("rejected.txt", ...states),
    /WP13_12B_CANONICAL_GIT_PATHS_/u,
  );
  assert.throws(
    () => parseCanonicalNulGitTreeEntries(Buffer.from(
      `100755 tree ${newBlob}\tbad.txt\0`,
      "utf8",
    )),
    /WP13_12B_CANONICAL_GIT_PATHS_/u,
  );
});

function environmentBinding(overrides = {}) {
  return {
    projectId: EMULATOR_DEMO_PROJECT_ID,
    googleCloudProject: EMULATOR_DEMO_PROJECT_ID,
    localEmulatorMode: true,
    offlineMode: true,
    runtimePhase: "LOCAL_EMULATOR_PROOF",
    firestoreEmulatorHost: "127.0.0.1:8088",
    functionsEmulatorHost: "127.0.0.1:5008",
    cloudEndpointUsed: false,
    cloudWrites: 0,
    providerLoginCount: 0,
    deploymentCount: 0,
    iamChangeCount: 0,
    cloudResourcesCreated: 0,
    credentialEnvironment: {},
    applicationDefaultCredentialsPresent: false,
    ...overrides,
  };
}

function health(overrides = {}) {
  return {
    serviceHealth: "READY_DISABLED_BY_DEFAULT",
    region: "europe-north1",
    runtimePhase: "LOCAL_EMULATOR_PROOF",
    providerActivation: "LOCAL_EMULATOR_ONLY",
    dataScope: "SYNTHETIC_ONLY_NO_PARTICIPANT_DATA",
    studentBeta: "NOT_AUTHORIZED",
    production: "NOT_AUTHORIZED",
    wp13_12c: "BLOCKED",
    controlEpoch: 1,
    stagingEnabled: false,
    ingressReady: true,
    ...overrides,
  };
}

function initialState(overrides = {}) {
  return {
    health: health(),
    control: {
      exists: false,
      controlEpoch: 1,
      stagingEnabled: false,
      reasonCode: "DISABLED_BY_DEFAULT",
    },
    inventory: {
      syntheticSessions: 0,
      syntheticCapabilityGrants: 0,
      syntheticSessionTombstones: 0,
      syntheticStagingControl: 0,
      authorityGenerations: [],
    },
    ...overrides,
  };
}

function enabledState(overrides = {}) {
  return {
    health: health({
      serviceHealth: "READY",
      controlEpoch: 2,
      stagingEnabled: true,
    }),
    control: {
      exists: true,
      controlEpoch: 2,
      stagingEnabled: true,
      reasonCode: enabledReasonCode,
    },
    ...overrides,
  };
}

function finalState(overrides = {}) {
  return {
    disabled: {
      health: health({ controlEpoch: 3 }),
      control: {
        exists: true,
        controlEpoch: 3,
        stagingEnabled: false,
        reasonCode: "LOCAL_PROOF_FINAL_CLEANUP",
      },
      inventory: {
        syntheticSessions: 0,
        syntheticCapabilityGrants: 0,
        syntheticSessionTombstones: 5,
        syntheticStagingControl: 1,
      },
    },
    tombstonesPreservedBeforeClear: true,
    postClear: {
      health: health(),
      control: {
        exists: false,
        controlEpoch: 1,
        stagingEnabled: false,
        reasonCode: "DISABLED_BY_DEFAULT",
      },
      inventory: {
        syntheticSessions: 0,
        syntheticCapabilityGrants: 0,
        syntheticSessionTombstones: 0,
        syntheticStagingControl: 0,
      },
    },
    cloudWrites: 0,
    ...overrides,
  };
}

test("10.0 synthetic preview origin is deterministic, canonical and never a network target", () => {
  const contract = buildSyntheticEmulatorOriginContract(proofRunId);
  const repeated = buildSyntheticEmulatorOriginContract(proofRunId);

  assert.deepEqual(contract, {
    schemaVersion: "wp13.12b-synthetic-emulator-origin-v1",
    declaredPreviewOrigin:
      "https://ludys-wp13-12b-proof-aaaaaaaaaaaaaaaa.vercel.app",
    classification: "SYNTHETIC_EMULATOR_ORIGIN",
    deploymentStatus: "NOT_DEPLOYED",
    publicStatus: "NOT_PUBLIC",
    receiptStatus: "NOT_A_REAL_PREVIEW_RECEIPT",
    networkTargetStatus: "NOT_A_NETWORK_TARGET",
  });
  assert.deepEqual(repeated, contract);
  assert.equal(Object.isFrozen(contract), true);

  const parsed = new URL(contract.declaredPreviewOrigin);
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.origin, contract.declaredPreviewOrigin);
  assert.equal(parsed.hostname.endsWith(".vercel.app"), true);
  assert.equal(parsed.pathname, "/");
  assert.equal(parsed.search, "");
  assert.equal(parsed.hash, "");
  assert.equal(
    contract.declaredPreviewOrigin.includes("127.0.0.1"),
    false,
  );
});

test("10.0 synthetic preview origin rejects malformed IDs and origin injection attempts", () => {
  for (const invalidProofRunId of [
    "",
    "a".repeat(31),
    "a".repeat(33),
    "A".repeat(32),
    "g".repeat(32),
    "local-emulator-proof.invalid",
    "arbitrary.example",
    "localhost",
    "*".repeat(32),
    `${"a".repeat(32)}/path`,
    `${"a".repeat(32)}?query=true`,
    `${"a".repeat(32)}#fragment`,
    null,
    undefined,
    12,
  ]) {
    assert.throws(
      () => buildSyntheticEmulatorOriginContract(invalidProofRunId),
      /SYNTHETIC_EMULATOR_ORIGIN_PROOF_RUN_ID_INVALID/u,
      String(invalidProofRunId),
    );
  }
});

test("10.0 emulator transport accepts only exact loopback HTTP ports", () => {
  for (const [input, expected] of [
    [
      "http://127.0.0.1:8088/v1/projects/demo-ludys-wp13-12b"
        + "/databases/(default)/documents?mask.fieldPaths=stateVersion",
      "http://127.0.0.1:8088/v1/projects/demo-ludys-wp13-12b"
        + "/databases/(default)/documents?mask.fieldPaths=stateVersion",
    ],
    [
      "http://127.0.0.1:5008/demo-ludys-wp13-12b/"
        + "europe-north1/sessionCommand",
      "http://127.0.0.1:5008/demo-ludys-wp13-12b/"
        + "europe-north1/sessionCommand",
    ],
  ]) {
    assert.equal(assertLoopbackEmulatorTransportUrl(input), expected);
  }

  for (const input of [
    "https://127.0.0.1:8088/v1/projects/demo-ludys-wp13-12b",
    "http://127.0.0.1:8088/path#fragment",
    "http://user:password@127.0.0.1:8088/path",
    "http://127.0.0.1/path",
    "http://127.0.0.1:80/path",
    "http://127.0.0.1:5009/path",
    "http://127.0.0.2:8088/path",
    "http://localhost:8088/path",
    "http://[::1]:8088/path",
    "http://attacker.example:8088/path",
    "https://local-emulator-proof.invalid/path",
    "https://ludys-wp13-12b-proof-aaaaaaaaaaaaaaaa.vercel.app/path",
    "*",
    "",
  ]) {
    assert.throws(
      () => assertLoopbackEmulatorTransportUrl(input),
      /LOOPBACK_EMULATOR_TRANSPORT_URL_INVALID/u,
      input,
    );
  }
});

test("10.0 guarded emulator fetch validates before effects and forbids redirects", async () => {
  const fetchCalls = [];
  const observedRequests = [];
  const expectedResponse = Object.freeze({ ok: true, status: 200 });
  const guardedFetch = createLoopbackEmulatorFetch({
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return expectedResponse;
    },
    onRequest: (request) => {
      assert.equal(Object.isFrozen(request), true);
      observedRequests.push(request);
    },
  });

  const response = await guardedFetch(
    "http://127.0.0.1:5008/demo-ludys-wp13-12b/"
      + "europe-north1/sessionCommand?proof=true",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      redirect: "follow",
    },
  );
  assert.equal(response, expectedResponse);
  assert.deepEqual(observedRequests, [{
    method: "POST",
    url: "http://127.0.0.1:5008/demo-ludys-wp13-12b/"
      + "europe-north1/sessionCommand?proof=true",
    origin: "http://127.0.0.1:5008",
    pathname:
      "/demo-ludys-wp13-12b/europe-north1/sessionCommand",
  }]);
  assert.equal(fetchCalls.length, 1);
  assert.equal(
    fetchCalls[0][0],
    "http://127.0.0.1:5008/demo-ludys-wp13-12b/"
      + "europe-north1/sessionCommand?proof=true",
  );
  assert.equal(fetchCalls[0][1].redirect, "error");
  assert.equal(fetchCalls[0][1].method, "POST");

  for (const input of [
    "https://127.0.0.1:5008/path",
    "http://user:password@127.0.0.1:5008/path",
    "http://localhost:5008/path",
    "http://127.0.0.2:5008/path",
    "http://attacker.example:5008/path",
    "https://local-emulator-proof.invalid/path",
    "https://ludys-wp13-12b-proof-aaaaaaaaaaaaaaaa.vercel.app/path",
  ]) {
    await assert.rejects(
      () => guardedFetch(input),
      /LOOPBACK_EMULATOR_TRANSPORT_URL_INVALID/u,
      input,
    );
  }
  assert.equal(fetchCalls.length, 1);
  assert.equal(observedRequests.length, 1);

  await guardedFetch(
    "http://127.0.0.1:8088/v1/projects/demo-ludys-wp13-12b",
  );
  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[1][1].redirect, "error");
  assert.equal(observedRequests[1].method, "GET");
  assert.equal(observedRequests[1].origin, "http://127.0.0.1:8088");
});

test("10.0 runner has one guarded fetch boundary and no direct network primitives", () => {
  const runnerSource = readFileSync(
    new URL("./run-wp13-12b-emulator-proof.mjs", import.meta.url),
    "utf8",
  );
  assert.equal((runnerSource.match(/\bfetch\s*\(/gu) ?? []).length, 0);
  assert.doesNotMatch(
    runnerSource,
    /from\s+["']node:(?:http|https|dns|net|tls)["']/u,
  );
  assert.doesNotMatch(
    runnerSource,
    /\b(?:WebSocket|XMLHttpRequest|EventSource)\b/u,
  );
  assert.match(
    runnerSource,
    /const localProofFetch = createLoopbackEmulatorFetch/u,
  );
  assert.doesNotMatch(runnerSource, /local-emulator-proof\.invalid/u);
  assert.doesNotMatch(
    runnerSource,
    /localProofFetch\s*\(\s*originContract\.declaredPreviewOrigin/u,
  );
  assert.doesNotMatch(runnerSource, /--name-status/u);
  assert.match(runnerSource, /canonicalGitDiffArguments/u);
  assert.match(runnerSource, /parseCanonicalNulGitPaths/u);
  const outerStart = runnerSource.indexOf(
    "async function runOuter()",
  );
  const outerSource = runnerSource.slice(
    outerStart,
    runnerSource.indexOf("if (hasFlag(\"--inside-emulators\"))", outerStart),
  );
  assert.match(outerSource, /executePinnedGitPreflightBeforeEffects\(\{/u);
  assert.match(outerSource, /proofToolBinding: assertProofToolCommitBinding/u);
  assert.match(outerSource, /beginEffects: runOuterAfterGitPreflight/u);
  assert.doesNotMatch(
    outerSource,
    /localProofFetch|mkdtemp|ephemeralSecretPath|runCaptured|writeExclusiveFsynced/u,
  );
});

test("10.0 inherited Node network guard blocks every external primitive before transport", async () => {
  const guardDirectory = await mkdtemp(join(
    tmpdir(),
    "ludys-wp13-12b-network-guard-test-",
  ));
  const confirmationModuleUrl = new URL(
    "./wp13-12b-emulator-confirmation.mjs",
    import.meta.url,
  ).href;
  const childSource = `
    import assert from "node:assert/strict";
    import { readdir } from "node:fs/promises";
    import http from "node:http";
    import https from "node:https";
    import dns from "node:dns";
    import net from "node:net";
    import tls from "node:tls";
    import {
      EMULATOR_NETWORK_GUARD_GLOBAL_KEY,
      emulatorNetworkGuardState,
    } from ${JSON.stringify(confirmationModuleUrl)};

    const guardDirectory = process.env.LUDYS_EMULATOR_NETWORK_GUARD_DIRECTORY;
    const guardState = emulatorNetworkGuardState();
    assert.equal(
      globalThis[Symbol.for(EMULATOR_NETWORK_GUARD_GLOBAL_KEY)],
      guardState,
    );
    assert.equal(guardState?.active, true);
    assert.equal(guardState?.role, "NODE_CHILD");
    assert.equal(guardState?.directory, guardDirectory);

    const localServer = net.createServer();
    await new Promise((resolveListen, rejectListen) => {
      localServer.once("error", rejectListen);
      localServer.listen(0, "127.0.0.1", resolveListen);
    });
    const localAddress = localServer.address();
    assert.notEqual(localAddress, null);
    assert.equal(typeof localAddress, "object");
    await new Promise((resolveClose, rejectClose) => {
      localServer.close((error) => {
        if (error) rejectClose(error);
        else resolveClose();
      });
    });

    let localFetchError;
    try {
      await fetch(\`http://127.0.0.1:\${localAddress.port}/\`, {
        signal: AbortSignal.timeout(2_000),
      });
    } catch (error) {
      localFetchError = error;
    }
    assert.notEqual(localFetchError, undefined);
    assert.equal(localFetchError?.cause?.code, "ECONNREFUSED");
    assert.doesNotMatch(
      String(localFetchError?.message ?? localFetchError),
      /EMULATOR_EXTERNAL_NETWORK_TARGET_FORBIDDEN/u,
    );
    const ledgerAbsentAfterLocal = !(await readdir(guardDirectory)).some(
      (name) => name.endsWith("-external-attempts.jsonl"),
    );
    assert.equal(ledgerAbsentAfterLocal, true);

    const forbidden = /EMULATOR_EXTERNAL_NETWORK_TARGET_FORBIDDEN/u;
    assert.throws(() => fetch("http://192.0.2.1/"), forbidden);
    assert.throws(() => http.request("http://192.0.2.1/"), forbidden);
    assert.throws(() => https.get("https://proof-target.invalid/"), forbidden);
    assert.throws(
      () => dns.lookup("proof-target.invalid", () => {}),
      forbidden,
    );
    assert.throws(
      () => net.connect({ host: "192.0.2.1", port: 443 }),
      forbidden,
    );
    assert.throws(
      () => tls.connect({ host: "proof-target.invalid", port: 443 }),
      forbidden,
    );
    assert.equal(typeof globalThis.WebSocket, "function");
    assert.throws(
      () => new WebSocket("wss://proof-target.invalid/"),
      forbidden,
    );

    process.stdout.write(JSON.stringify({
      pid: process.pid,
      guardState,
      ledgerAbsentAfterLocal,
      localFetchCauseCode: localFetchError.cause.code,
    }));
  `;

  try {
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", childSource],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_OPTIONS: `--import=${confirmationModuleUrl}`,
          LUDYS_EMULATOR_NETWORK_GUARD_DIRECTORY: guardDirectory,
        },
        timeout: 20_000,
        windowsHide: true,
      },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stderr, "");

    const summary = JSON.parse(child.stdout);
    assert.deepEqual(summary, {
      pid: summary.pid,
      guardState: {
        active: true,
        directory: resolve(guardDirectory),
        role: "NODE_CHILD",
      },
      ledgerAbsentAfterLocal: true,
      localFetchCauseCode: "ECONNREFUSED",
    });
    assert.equal(Number.isSafeInteger(summary.pid), true);
    assert.ok(summary.pid > 0);

    const entries = (await readdir(guardDirectory)).sort();
    assert.deepEqual(entries, [
      `${summary.pid}-external-attempts.jsonl`,
      `${summary.pid}-initialized.json`,
    ]);
    const initialized = JSON.parse(await readFile(
      join(guardDirectory, `${summary.pid}-initialized.json`),
      "utf8",
    ));
    assert.deepEqual(initialized, {
      schemaVersion: "wp13.12b-node-network-guard-init-v1",
      pid: summary.pid,
      role: "NODE_CHILD",
      node: process.version,
    });

    const attemptLines = (await readFile(
      join(guardDirectory, `${summary.pid}-external-attempts.jsonl`),
      "utf8",
    )).trim().split("\n");
    const common = {
      schemaVersion: "wp13.12b-node-network-guard-attempt-v1",
      pid: summary.pid,
      role: "NODE_CHILD",
    };
    assert.deepEqual(attemptLines.map(JSON.parse), [
      { ...common, kind: "fetch", host: "192.0.2.1" },
      { ...common, kind: "request", host: "192.0.2.1" },
      { ...common, kind: "get", host: "proof-target.invalid" },
      { ...common, kind: "lookup", host: "proof-target.invalid" },
      { ...common, kind: "connect", host: "192.0.2.1" },
      { ...common, kind: "connect", host: "proof-target.invalid" },
      { ...common, kind: "WebSocket", host: "proof-target.invalid" },
    ]);
  } finally {
    await rm(guardDirectory, { recursive: true, force: true });
  }
});

test("10.1 accepts the exact disabled-by-default initial state", () => {
  const acceptedEnvironment =
    assertEmulatorProofEnvironmentBinding(environmentBinding());
  const acceptedState = assertInitialEmulatorProofState(initialState());

  assert.equal(acceptedEnvironment.projectId, EMULATOR_DEMO_PROJECT_ID);
  assert.equal(acceptedEnvironment.cloudWrites, 0);
  assert.equal(acceptedState.health.serviceHealth, "READY_DISABLED_BY_DEFAULT");
  assert.equal(acceptedState.health.stagingEnabled, false);
  assert.equal(acceptedState.health.controlEpoch, 1);
  assert.equal(Object.isFrozen(acceptedState), true);
});

test("10.2 unexpected READY stops proof, runs cleanup and ends disabled", async () => {
  const events = [];
  let proofSequenceCalls = 0;
  let lifecycleResult;

  await assert.rejects(
    async () => {
      lifecycleResult = await executeEmulatorProofLifecycle({
        operation: async () => {
          events.push("initial-precondition");
          assertInitialEmulatorProofState(initialState({
            health: health({
              serviceHealth: "READY",
              stagingEnabled: true,
            }),
          }));
          proofSequenceCalls += 1;
        },
        cleanup: async ({ operationError }) => {
          events.push("cleanup");
          assert.match(
            operationError.message,
            /STAGING_UNEXPECTEDLY_ENABLED_AT_PROOF_START/u,
          );
          return assertFinalEmulatorProofState(finalState());
        },
        stopProcesses: async () => {
          events.push("stop-processes");
        },
      });
    },
    /STAGING_UNEXPECTEDLY_ENABLED_AT_PROOF_START/u,
  );

  assert.deepEqual(events, [
    "initial-precondition",
    "cleanup",
    "stop-processes",
  ]);
  assert.equal(proofSequenceCalls, 0);
  assert.equal(lifecycleResult, undefined);
});

test("10.3 an unknown health status fails closed before proof", () => {
  let proofSequenceCalls = 0;
  assert.throws(() => {
    assertInitialEmulatorProofState(initialState({
      health: health({ serviceHealth: "UNKNOWN_PROVIDER_STATE" }),
    }));
    proofSequenceCalls += 1;
  }, /INITIAL_STAGING_STATUS_INVALID/u);
  assert.equal(proofSequenceCalls, 0);
});

test("10.4 an active kill switch cannot be treated as default disabled", () => {
  let proofOpenCalls = 0;
  assert.throws(() => {
    assertInitialEmulatorProofState(initialState({
      control: {
        exists: true,
        controlEpoch: 1,
        stagingEnabled: false,
        reasonCode: "LOCAL_PROOF_KILL_SWITCH",
      },
    }));
    proofOpenCalls += 1;
  }, /KILL_SWITCH_ACTIVE_AT_PROOF_START/u);
  assert.equal(proofOpenCalls, 0);
});

test("10.5 a stale initial control epoch fails closed", () => {
  let proofOpenCalls = 0;
  assert.throws(() => {
    assertInitialEmulatorProofState(initialState({
      health: health({ controlEpoch: 2 }),
      control: {
        exists: true,
        controlEpoch: 2,
        stagingEnabled: false,
        reasonCode: "STALE_DISABLED_CONTROL",
      },
    }));
    proofOpenCalls += 1;
  }, /STALE_CONTROL_EPOCH_AT_PROOF_START/u);
  assert.equal(proofOpenCalls, 0);
});

test("10.6 missing emulator binding stops before write, login or ADC access", () => {
  const effects = {
    storeWrites: 0,
    cloudFallbacks: 0,
    providerLogins: 0,
    adcAccesses: 0,
  };
  const startAfterGuard = (binding) => {
    assertEmulatorProofEnvironmentBinding(binding);
    effects.storeWrites += 1;
    effects.cloudFallbacks += 1;
    effects.providerLogins += 1;
    effects.adcAccesses += 1;
  };

  assert.throws(
    () => startAfterGuard(environmentBinding({
      firestoreEmulatorHost: undefined,
    })),
    /EXACT_LOOPBACK_EMULATOR_HOST_REQUIRED/u,
  );
  assert.throws(
    () => startAfterGuard(environmentBinding({
      applicationDefaultCredentialsPresent: true,
    })),
    /EMULATOR_PROOF_APPLICATION_DEFAULT_CREDENTIALS_FORBIDDEN/u,
  );
  assert.throws(
    () => startAfterGuard(environmentBinding({
      credentialEnvironment: {
        GOOGLE_APPLICATION_CREDENTIALS: "C:\\forbidden\\credentials.json",
      },
    })),
    /EMULATOR_PROOF_AMBIENT_CREDENTIAL_OR_NETWORK_OVERRIDE/u,
  );
  assert.deepEqual(effects, {
    storeWrites: 0,
    cloudFallbacks: 0,
    providerLogins: 0,
    adcAccesses: 0,
  });
});

test("10.7 a cloud project ID is rejected in emulator proof mode", () => {
  let proofOpenCalls = 0;
  assert.throws(() => {
    assertEmulatorProofEnvironmentBinding(environmentBinding({
      projectId: "ludys-production",
      googleCloudProject: "ludys-production",
    }));
    proofOpenCalls += 1;
  }, /CLOUD_PROJECT_ID_FORBIDDEN_FOR_EMULATOR_PROOF/u);
  assert.equal(proofOpenCalls, 0);
});

test("10.8 validates the exact disabled to explicit-enable to READY transition", () => {
  const transitions = [];
  const initial = assertInitialEmulatorProofState(initialState());
  transitions.push(initial.health.serviceHealth);
  transitions.push("EXPLICIT_PROOF_ENABLE");
  const enabled = assertEnabledEmulatorProofState(enabledState(), {
    expectedControlEpoch: 2,
    expectedReasonCode: enabledReasonCode,
    proofRunId,
  });
  transitions.push(enabled.health.serviceHealth);

  assert.deepEqual(transitions, [
    "READY_DISABLED_BY_DEFAULT",
    "EXPLICIT_PROOF_ENABLE",
    "READY",
  ]);
  assert.equal(enabled.control.controlEpoch, 2);
  assert.equal(enabled.control.reasonCode, enabledReasonCode);
});

test("10.9 PASS cleanup completes before lifecycle success is returned", async () => {
  const events = [];
  const result = await executeEmulatorProofLifecycle({
    operation: async () => {
      events.push("READY");
      return assertEnabledEmulatorProofState(enabledState(), {
        expectedControlEpoch: 2,
        expectedReasonCode: enabledReasonCode,
        proofRunId,
      });
    },
    cleanup: async ({ operationError }) => {
      assert.equal(operationError, undefined);
      events.push("cleanup");
      const final = assertFinalEmulatorProofState(finalState());
      events.push(final.postClear.health.serviceHealth);
      return final;
    },
    stopProcesses: async () => {
      events.push("stop-processes");
    },
  });

  assert.deepEqual(events, [
    "READY",
    "cleanup",
    "READY_DISABLED_BY_DEFAULT",
    "stop-processes",
  ]);
  assert.equal(
    result.cleanupResult.postClear.health.serviceHealth,
    "READY_DISABLED_BY_DEFAULT",
  );
  assert.equal(Object.isFrozen(result), true);
});

test("10.9 rejects torn cleanup epochs and a non-authoritative reason", () => {
  for (const mutate of [
    (state) => { state.disabled.health.controlEpoch = 4; },
    (state) => { state.disabled.control.reasonCode = "LOCAL_PROOF_OTHER"; },
    (state) => { state.postClear.health.controlEpoch = 2; },
  ]) {
    const state = finalState();
    mutate(state);
    assert.throws(
      () => assertFinalEmulatorProofState(state),
      /EMULATOR_PROOF_CLEANUP_CONTRACT_INVALID/u,
    );
  }
});

test("10.10 assertion failure after enable still cleans authority and stops processes", async () => {
  const primaryError = new Error("FORCED_PROOF_ASSERTION_FAILURE");
  const events = [];
  let capabilitiesInvalidated = false;
  let lifecycleResult;

  await assert.rejects(
    async () => {
      lifecycleResult = await executeEmulatorProofLifecycle({
        operation: async () => {
          assertEnabledEmulatorProofState(enabledState(), {
            expectedControlEpoch: 2,
            expectedReasonCode: enabledReasonCode,
            proofRunId,
          });
          events.push("opened");
          throw primaryError;
        },
        cleanup: async ({ operationError }) => {
          assert.equal(operationError, primaryError);
          events.push("cleanup");
          const final = assertFinalEmulatorProofState(finalState());
          assert.equal(final.disabled.inventory.syntheticSessions, 0);
          assert.equal(final.disabled.inventory.syntheticCapabilityGrants, 0);
          assert.equal(final.cloudWrites, 0);
          capabilitiesInvalidated = true;
          return final;
        },
        stopProcesses: async () => {
          events.push("stop-processes");
        },
      });
    },
    (error) => error === primaryError,
  );

  assert.deepEqual(events, ["opened", "cleanup", "stop-processes"]);
  assert.equal(capabilitiesInvalidated, true);
  assert.equal(lifecycleResult, undefined);
});

test("10.11 cleanup timeout and residual process prevent a false result", async () => {
  const cleanupTimeout = new Error("EMULATOR_PROOF_CLEANUP_TIMEOUT");
  const residualProcess = new Error("EMULATOR_RESIDUAL_PROCESS_DETECTED");
  const events = [];
  let lifecycleResult;
  let proofPublished = false;
  let receiptMarkedValid = false;

  await assert.rejects(
    async () => {
      lifecycleResult = await executeEmulatorProofLifecycle({
        operation: async () => {
          events.push("operation-pass");
          return "PASS";
        },
        cleanup: async () => {
          events.push("cleanup-timeout");
          throw cleanupTimeout;
        },
        stopProcesses: async () => {
          events.push("residual-detected");
          throw residualProcess;
        },
      });
      proofPublished = true;
      receiptMarkedValid = true;
    },
    (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.match(
        error.message,
        /EMULATOR_PROOF_CLEANUP_OR_PROCESS_STOP_FAILED/u,
      );
      assert.deepEqual(error.errors, [cleanupTimeout, residualProcess]);
      return true;
    },
  );

  assert.deepEqual(events, [
    "operation-pass",
    "cleanup-timeout",
    "residual-detected",
  ]);
  assert.equal(lifecycleResult, undefined);
  assert.equal(proofPublished, false);
  assert.equal(receiptMarkedValid, false);
});
