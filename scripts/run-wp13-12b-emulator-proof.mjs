import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  readdir,
  rm,
} from "node:fs/promises";
import { arch, homedir, platform, release, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import {
  assertEmulatorProofEnvironmentBinding,
  assertSecurityRemediationChangePaths,
  assertSecurityRemediationCommitAncestry,
  assertEnabledEmulatorProofState,
  assertEmulatorConfirmationRecordPrecondition,
  assertEmulatorProofSourcePrecondition,
  assertFinalEmulatorProofState,
  assertInitialEmulatorProofState,
  assertLoopbackEmulatorTransportUrl,
  buildSyntheticEmulatorOriginContract,
  canonicalSecurityRemediationGitDiffArguments,
  COMMIT_S_SHA,
  COMMIT_S_TREE,
   COMMIT_T_SHA,
   COMMIT_T_TREE,
   COMMIT_V_SHA,
   COMMIT_V_TREE,
  createLoopbackEmulatorFetch,
  EMULATOR_CHALLENGE_SCHEMA,
  EMULATOR_CHALLENGE_TTL_MS,
  EMULATOR_NETWORK_GUARD_GLOBAL_KEY,
  EMULATOR_PROOF_PATH,
  EMULATOR_PR3_PURPOSE,
  executePinnedGitPreflightBeforeEffects,
  executeEmulatorProofLifecycle,
  emulatorNetworkGuardState,
   PREVIEW_SOURCE_SET_SHA256,
   PINNED_GIT_ADAPTER_GIT_BLOB as pinnedGitAdapterGitBlob,
   PINNED_GIT_ADAPTER_SHA256 as pinnedGitAdapterSha256,
   PINNED_GIT_COMPATIBILITY_EXPECTED_CHANGE_PATHS as pinnedGitCompatibilityAllowedChangePaths,
   PROOF_ORIGIN_EXPECTED_CHANGE_PATHS as proofOriginAllowedChangePaths,
   REQUIRED_EMULATOR_PROOF_RESULTS,
   SECURITY_REMEDIATION_CHANGE_SET_SHA256,
   SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS as securityRemediationExpectedChangePaths,
  validateEmulatorProofArtifact,
 } from "./wp13-12b-emulator-confirmation.mjs";
 import {
   canonicalGitDiffArguments,
   canonicalGitPathSetSha256,
   deriveCanonicalGitPathChange,
   parseCanonicalNulGitPaths,
   parseCanonicalNulGitTreeEntries,
 } from "./wp13-12b-canonical-git-paths.mjs";
import {
  externalActivationChecksumManifestPath,
  externalActivationChecksumTargets,
} from "./wp13-12b-external-activation-checksums.mjs";
import {
  createPinnedGitExecFile,
} from "./wp13-12b-pinned-git-toolchain.mjs";
import {
  copyReviewExpectedSourceSetSha256,
  evaluateCopyReview,
} from "../provider/vercel/wp13-12b-preview/tools/copy-review-preflight.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const scriptPath = fileURLToPath(import.meta.url);
const networkGuardImportUrl = new URL(
  "./wp13-12b-emulator-confirmation.mjs",
  import.meta.url,
).href;
const providerRequire = createRequire(
  join(repo, "tools", "wp13-12b-emulator-proof", "package.json"),
);
const {
  assertFails,
  initializeTestEnvironment,
} = providerRequire("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
} = providerRequire("firebase/firestore");
const projectId = "demo-ludys-wp13-12b";
const firestorePort = 8088;
const functionsPort = 5008;
const expectedFirebaseCliVersion = "15.22.4";
const expectedEmulatorVersion = "1.21.0";
const requiredChecks = REQUIRED_EMULATOR_PROOF_RESULTS;
const pinnedGitExecFile = createPinnedGitExecFile();
const firestoreEmulatorHost = `127.0.0.1:${firestorePort}`;
const functionsEmulatorHost = `127.0.0.1:${functionsPort}`;
const firestoreEmulatorBaseUrl = `http://${firestoreEmulatorHost}`;
const functionsEmulatorBaseUrl = `http://${functionsEmulatorHost}`;
const commitTRunnerSha256 =
  "5791eb1209deef9a28accf4fdfc1f3d2b5dc24f86e6fbf6c65cb545604e84ceb";
const commitTRunnerGitBlob = "4d26dd612856e1f7fd50ede972e82dc30fcf318f";
const COMMIT_U_SHA = "190fff88808bbafe605cdde4cfe9fe943f4543a4";
const COMMIT_U_TREE = "6a9634f4e096b736f4699a209f2152e4e083127d";
const commitVRunnerSha256 =
  "430d6cacb379389370f1124aa6613d1f40744c664f8aaee24da292e79133196e";
const commitVRunnerGitBlob = "558625b1eea00b8a6f14769018fcf139767838eb";
const commitUProviderPackageSha256 =
  "8ce5655fd797a97c9d537f040e360fef6e3e05ba302769e2861aa1896e5dee0b";
const commitUProviderPackageLockSha256 =
  "2bb3e7021ca055853ef34c80ca872a1eccb5f2e4d406c15d5e7b87ffb3c69249";
const commitUProviderSbomSha256 =
  "c6259220286a88e6b5b53605d6d9ca0a8f9091d3cca391908d5908923e9c93c4";
const commitUProviderAuditSha256 =
  "e7b6f802df5a33df78e6951870e0da492f0ce9fdbc9a3b20ee74a2dd659e70d4";
const commitUSecurityRemediationSha256 =
  "fe4884c82d5c13b4209ae2d543a4c171dfed31d8fea4621cb606d08291bccded";
const resolvedFastUriVersion = "3.1.5";
const fastUriSecurityAdvisory = "GHSA-7p8r-x3mc-p8w7";
const proofTimeoutMs = 4 * 60 * 1000;
const functionsEnvironmentDirectory = join(
  repo,
  "provider",
  "firebase",
  "functions",
);
const ephemeralSecretPath = join(
  functionsEnvironmentDirectory,
  ".secret.local",
);
const forbiddenFunctionsEnvironmentPaths = Object.freeze([
  join(functionsEnvironmentDirectory, ".env"),
  join(functionsEnvironmentDirectory, `.env.${projectId}`),
  join(functionsEnvironmentDirectory, ".env.local"),
  ephemeralSecretPath,
  join(functionsEnvironmentDirectory, ".runtimeconfig.json"),
]);
const securityRemediationTreeRoots = Object.freeze([
  ...new Set(
    securityRemediationExpectedChangePaths.map((path) => path.split("/")[0]),
  ),
].sort());
const localTransportRequests = [];
const localProofFetch = createLoopbackEmulatorFetch({
  fetchImpl: globalThis.fetch.bind(globalThis),
  onRequest: (request) => localTransportRequests.push(request),
});

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function progress(stage) {
  process.stderr.write(`[wp13.12b-emulator-proof] ${stage}\n`);
}

async function withTimeout(promise, label, timeoutMs = 20_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function sha256File(path) {
  return sha256(await readFile(path));
}

function commandResult(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repo,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `COMMAND_FAILED: ${command} ${args.join(" ")}\n${result.stderr || result.stdout}`,
    );
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

function gitBytes(args) {
  return Buffer.from(pinnedGitExecFile("git", args, {
    cwd: repo,
    encoding: "buffer",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }));
}

function gitText(args) {
  return gitBytes(args).toString("utf8").trim();
}

function exactStringArray(left, right) {
  return (
    left.length === right.length
    && left.every((value, index) => value === right[index])
  );
}

function assertCommitObject(gitPrefix, commit) {
  if (gitText([...gitPrefix, "cat-file", "-t", commit]) !== "commit") {
    throw new Error("PROOF_CHAIN_COMMIT_OBJECT_REQUIRED");
  }
}

function readCommitTreeEntries(gitPrefix, commit) {
  const entries = new Map();
  for (const root of securityRemediationTreeRoots) {
    for (const entry of parseCanonicalNulGitTreeEntries(gitBytes([
      ...gitPrefix,
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      commit,
      "--",
      root,
    ]))) {
      if (entries.has(entry.path)) {
        throw new Error("COMMIT_U_SECURITY_REMEDIATION_TREE_DUPLICATE_PATH");
      }
      entries.set(entry.path, entry);
    }
  }
  return entries;
}

function expectedCommitPathState(entries, path) {
  const entry = entries.get(path);
  if (entry === undefined) {
    return Object.freeze({ exists: false, blob: null, objectType: null });
  }
  if (entry.mode !== "100644" || entry.objectType !== "blob") {
    throw new Error("COMMIT_U_SECURITY_REMEDIATION_PATH_STATE_INVALID");
  }
  return Object.freeze({
    exists: true,
    blob: entry.objectId,
    objectType: entry.objectType,
  });
}

function readCanonicalCommitDiff(gitPrefix, fromCommit, toCommit) {
  const args = canonicalGitDiffArguments(fromCommit, toCommit);
  const paths = parseCanonicalNulGitPaths(gitBytes([
    ...gitPrefix,
    "diff",
    ...args,
  ]));
  return Object.freeze({ args, paths });
}

function assertProofToolCommitBinding(sourceCommit, sourceTree) {
  const gitPrefix = [
    "-c",
    `safe.directory=${repo.replaceAll("\\", "/")}`,
  ];
  const commitTAncestry = gitText([
    ...gitPrefix,
    "rev-list",
    "--parents",
    "-n",
    "1",
    COMMIT_T_SHA,
  ]).split(" ");
  const commitUAncestry = gitText([
    ...gitPrefix,
    "rev-list",
    "--parents",
    "-n",
    "1",
    COMMIT_U_SHA,
  ]).split(" ");
  const commitVAncestry = gitText([
    ...gitPrefix,
    "rev-list",
    "--parents",
    "-n",
    "1",
    COMMIT_V_SHA,
  ]).split(" ");
  const proofToolAncestry = gitText([
    ...gitPrefix,
    "rev-list",
    "--parents",
    "-n",
    "1",
    sourceCommit,
  ]).split(" ");
  for (const commit of [
    COMMIT_S_SHA,
    COMMIT_T_SHA,
    COMMIT_U_SHA,
    COMMIT_V_SHA,
    sourceCommit,
  ]) assertCommitObject(gitPrefix, commit);
  assertSecurityRemediationCommitAncestry(commitUAncestry);
  if (
    sourceCommit === COMMIT_S_SHA
    || sourceCommit === COMMIT_T_SHA
    || sourceCommit === COMMIT_U_SHA
    || sourceCommit === COMMIT_V_SHA
    || !exactStringArray(commitTAncestry, [COMMIT_T_SHA, COMMIT_S_SHA])
    || !exactStringArray(commitVAncestry, [COMMIT_V_SHA, COMMIT_U_SHA])
    || !exactStringArray(proofToolAncestry, [sourceCommit, COMMIT_V_SHA])
    || gitText([...gitPrefix, "rev-parse", `${COMMIT_S_SHA}^{tree}`])
      !== COMMIT_S_TREE
    || gitText([...gitPrefix, "rev-parse", `${COMMIT_T_SHA}^{tree}`])
      !== COMMIT_T_TREE
    || gitText([...gitPrefix, "rev-parse", `${COMMIT_U_SHA}^{tree}`])
      !== COMMIT_U_TREE
    || gitText([...gitPrefix, "rev-parse", `${COMMIT_V_SHA}^{tree}`])
      !== COMMIT_V_TREE
    || gitText([...gitPrefix, "rev-parse", `${sourceCommit}^{tree}`])
      !== sourceTree
    || sha256(gitBytes([
      ...gitPrefix,
      "show",
      `${COMMIT_T_SHA}:scripts/run-wp13-12b-emulator-proof.mjs`,
    ])) !== commitTRunnerSha256
    || gitText([
      ...gitPrefix,
      "rev-parse",
      `${COMMIT_T_SHA}:scripts/run-wp13-12b-emulator-proof.mjs`,
    ]) !== commitTRunnerGitBlob
    || sha256(gitBytes([
      ...gitPrefix,
      "show",
      `${COMMIT_U_SHA}:scripts/run-wp13-12b-emulator-proof.mjs`,
    ])) !== commitTRunnerSha256
    || gitText([
      ...gitPrefix,
      "rev-parse",
      `${COMMIT_U_SHA}:scripts/run-wp13-12b-emulator-proof.mjs`,
    ]) !== commitTRunnerGitBlob
    || sha256(gitBytes([
      ...gitPrefix,
      "show",
      `${COMMIT_V_SHA}:scripts/run-wp13-12b-emulator-proof.mjs`,
    ])) !== commitVRunnerSha256
    || gitText([
      ...gitPrefix,
      "rev-parse",
      `${COMMIT_V_SHA}:scripts/run-wp13-12b-emulator-proof.mjs`,
    ]) !== commitVRunnerGitBlob
    || sha256(gitBytes([
      ...gitPrefix,
      "show",
      `${sourceCommit}:scripts/wp13-12b-pinned-git-toolchain.mjs`,
    ])) !== pinnedGitAdapterSha256
    || gitText([
      ...gitPrefix,
      "rev-parse",
      `${sourceCommit}:scripts/wp13-12b-pinned-git-toolchain.mjs`,
    ]) !== pinnedGitAdapterGitBlob
  ) throw new Error(
    "PROOF_TOOL_COMMIT_MUST_FOLLOW_IMMUTABLE_S_TO_T_TO_U_TO_V_TO_W_CHAIN",
  );
  const securityRemediationDiff = readCanonicalCommitDiff(
    gitPrefix,
    COMMIT_T_SHA,
    COMMIT_U_SHA,
  );
  if (!exactStringArray(
    securityRemediationDiff.args,
    canonicalSecurityRemediationGitDiffArguments(COMMIT_T_SHA, COMMIT_U_SHA),
  )) throw new Error("COMMIT_U_SECURITY_REMEDIATION_GIT_COMMAND_INVALID");
  const securityRemediationChangePaths = securityRemediationDiff.paths;
  assertSecurityRemediationChangePaths(securityRemediationChangePaths);
  const commitTTreeEntries = readCommitTreeEntries(gitPrefix, COMMIT_T_SHA);
  const commitUTreeEntries = readCommitTreeEntries(gitPrefix, COMMIT_U_SHA);
  const securityRemediationChangeRecords =
    securityRemediationExpectedChangePaths.map((path) =>
      deriveCanonicalGitPathChange(
        path,
        expectedCommitPathState(commitTTreeEntries, path),
        expectedCommitPathState(commitUTreeEntries, path),
      ));
  const expectedSecurityRemediationChangeRecords =
    securityRemediationExpectedChangePaths.map((path) => Object.freeze({
      path,
      changeType:
        path === "release/wp13-12b/provider-security-remediation.json"
          ? "A"
          : "M",
    }));
  if (!securityRemediationChangeRecords.every(
    (record, index) =>
      record.path === expectedSecurityRemediationChangeRecords[index].path
      && record.changeType
        === expectedSecurityRemediationChangeRecords[index].changeType,
  )) throw new Error("COMMIT_U_SECURITY_REMEDIATION_CHANGE_TYPES_INVALID");
  const securityRemediationChangeSetSha256 = canonicalGitPathSetSha256(
    securityRemediationChangePaths,
  );
  if (
    securityRemediationChangeSetSha256
      !== SECURITY_REMEDIATION_CHANGE_SET_SHA256
  ) throw new Error("COMMIT_U_SECURITY_REMEDIATION_CHANGE_SET_HASH_INVALID");

  const proofOriginChangePaths = readCanonicalCommitDiff(
    gitPrefix,
    COMMIT_U_SHA,
    COMMIT_V_SHA,
  ).paths;
  if (!exactStringArray(proofOriginChangePaths, proofOriginAllowedChangePaths)) {
    throw new Error("PROOF_ORIGIN_COMMIT_SCOPE_INVALID");
  }
  const proofToolChangePaths = readCanonicalCommitDiff(
    gitPrefix,
    COMMIT_V_SHA,
    sourceCommit,
  ).paths;
  if (!exactStringArray(
    proofToolChangePaths,
    pinnedGitCompatibilityAllowedChangePaths,
  )) {
    throw new Error("PINNED_GIT_COMPATIBILITY_COMMIT_SCOPE_INVALID");
  }
  return Object.freeze({
    securityRemediationChangePaths: Object.freeze(
      securityRemediationChangePaths,
    ),
    securityRemediationChangeRecords: Object.freeze(
      securityRemediationChangeRecords,
    ),
    securityRemediationChangeSetSha256,
    gitDiffCommandContract: Object.freeze({
      schemaVersion: "wp13.12b-pinned-git-diff-contract-v1",
      command: "git diff",
      arguments: securityRemediationDiff.args,
      output: "UTF8_NUL_TERMINATED_REPOSITORY_RELATIVE_POSIX_PATHS",
      renameDetection: "DISABLED",
    }),
    proofOriginChangePaths: Object.freeze(proofOriginChangePaths),
    proofToolChangePaths: Object.freeze(proofToolChangePaths),
  });
}

async function assertCommittedAuthoritySnapshot(sourceCommit) {
  if (
    externalActivationChecksumTargets.includes(EMULATOR_PROOF_PATH)
    || externalActivationChecksumTargets.some(
      (path) =>
        /^release\/wp13-12b\/receipts\/actual\/emulator-proof-receipt-.*-v2\.json$/u
          .test(path),
    )
  ) throw new Error("DYNAMIC_EMULATOR_EVIDENCE_MUST_NOT_BE_AUTHORITY_CHECKSUMMED");
  const gitPrefix = [
    "-c",
    `safe.directory=${repo.replaceAll("\\", "/")}`,
  ];
  const protectedPaths = [
    externalActivationChecksumManifestPath,
    ...externalActivationChecksumTargets,
  ];
  const taggedEntries = gitBytes(
    [...gitPrefix, "ls-files", "-v", "-z", "--", ...protectedPaths],
  ).toString("utf8").split("\0").filter(Boolean);
  if (
    taggedEntries.length !== protectedPaths.length
    || taggedEntries.some(
      (entry) =>
        entry.length < 3
        || entry.slice(0, 2) !== "H "
        || !protectedPaths.includes(entry.slice(2)),
    )
    || new Set(taggedEntries.map((entry) => entry.slice(2))).size
      !== protectedPaths.length
  ) throw new Error("EMULATOR_PROOF_AUTHORITY_INDEX_BINDING_INVALID");

  const manifestTarget = join(
    repo,
    ...externalActivationChecksumManifestPath.split("/"),
  );
  const manifestMetadata = await lstat(manifestTarget);
  if (!manifestMetadata.isFile() || manifestMetadata.isSymbolicLink()) {
    throw new Error("EMULATOR_PROOF_AUTHORITY_MANIFEST_NOT_REGULAR");
  }
  const manifestBytes = await readFile(manifestTarget);
  const committedManifestBytes = gitBytes(
    [
      ...gitPrefix,
      "show",
      `${sourceCommit}:${externalActivationChecksumManifestPath}`,
    ],
  );
  if (!manifestBytes.equals(committedManifestBytes)) {
    throw new Error("EMULATOR_PROOF_AUTHORITY_MANIFEST_NOT_COMMITTED_SOURCE");
  }
  const manifestText = manifestBytes.toString("utf8");
  if (!manifestText.endsWith("\n")) {
    throw new Error("EMULATOR_PROOF_AUTHORITY_MANIFEST_INVALID");
  }
  const entries = manifestText.slice(0, -1).split("\n").map((line) => {
    const match = /^([a-f0-9]{64})  ([^\r\n]+)$/u.exec(line);
    if (match === null) {
      throw new Error("EMULATOR_PROOF_AUTHORITY_MANIFEST_INVALID");
    }
    return { sha256: match[1], path: match[2] };
  });
  if (
    JSON.stringify(entries.map((entry) => entry.path))
      !== JSON.stringify(externalActivationChecksumTargets)
  ) throw new Error("EMULATOR_PROOF_AUTHORITY_MANIFEST_SCOPE_MISMATCH");

  for (const entry of entries) {
    const target = join(repo, ...entry.path.split("/"));
    const metadata = await lstat(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`EMULATOR_PROOF_AUTHORITY_PATH_NOT_REGULAR:${entry.path}`);
    }
    const workingBytes = await readFile(target);
    const committedBytes = gitBytes(
      [...gitPrefix, "show", `${sourceCommit}:${entry.path}`],
    );
    if (
      !workingBytes.equals(committedBytes)
      || sha256(committedBytes) !== entry.sha256
    ) throw new Error(
      `EMULATOR_PROOF_AUTHORITY_BYTES_NOT_COMMITTED_SOURCE:${entry.path}`,
    );
  }
  return Object.freeze({
    manifestSha256: sha256(manifestBytes),
    authorityFileCount: entries.length,
  });
}

function terminateProcessTree(child) {
  if (!Number.isSafeInteger(child?.pid) || child.pid <= 0) return;
  if (process.platform === "win32") {
    spawnSync(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T", "/F"],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 10_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function runCaptured(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: repo,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    ...options,
  });
  let stdout = "";
  let stderr = "";
  let interruptedSignal;
  child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  const interrupt = (signal) => {
    interruptedSignal = signal;
    terminateProcessTree(child);
  };
  const sigint = () => interrupt("SIGINT");
  const sigterm = () => interrupt("SIGTERM");
  process.once("SIGINT", sigint);
  process.once("SIGTERM", sigterm);
  let timer;
  try {
    const result = await new Promise((resolvePromise, reject) => {
      let settled = false;
      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback(value);
      };
      child.once("error", (error) => settle(reject, error));
      child.once("close", (code, signal) => settle(resolvePromise, {
        code,
        signal,
      }));
      timer = setTimeout(() => {
        terminateProcessTree(child);
        settle(reject, new Error("ACTUAL_EMULATOR_PROOF_PROCESS_TIMEOUT"));
      }, options.timeoutMs ?? proofTimeoutMs);
    });
    if (interruptedSignal !== undefined) {
      throw new Error(`ACTUAL_EMULATOR_PROOF_INTERRUPTED:${interruptedSignal}`);
    }
    return { ...result, stdout, stderr };
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGINT", sigint);
    process.removeListener("SIGTERM", sigterm);
    if (child.exitCode === null && child.signalCode === null) {
      terminateProcessTree(child);
    }
  }
}

function quoteCommandArgument(value) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function firestoreDocumentUrl(collection, documentId = undefined) {
  const base = [
    `${firestoreEmulatorBaseUrl}/v1/projects/${projectId}`,
    "/databases/(default)/documents",
    `/${collection}`,
  ].join("");
  return documentId === undefined ? base : `${base}/${documentId}`;
}

function functionUrl(name) {
  return [
    functionsEmulatorBaseUrl,
    `/${projectId}/europe-north1/${name}`,
  ].join("");
}

async function jsonResponse(url, init = {}) {
  const response = await localProofFetch(url, {
    signal: AbortSignal.timeout(60_000),
    ...init,
  });
  let body;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return { status: response.status, ok: response.ok, body };
}

function emulatorAdminJsonResponse(url, init = {}) {
  return jsonResponse(url, {
    ...init,
    headers: {
      authorization: "Bearer owner",
      ...(init.headers ?? {}),
    },
  });
}

async function callFunction(name, body, capability = undefined) {
  const isPublicCorsFunction = [
    "sessionCommand",
    "sessionProjection",
  ].includes(name);
  const declaredPreviewOrigin = isPublicCorsFunction
    ? buildSyntheticEmulatorOriginContract(
      process.env.LUDYS_EMULATOR_PROOF_RUN_ID,
    ).declaredPreviewOrigin
    : undefined;
  if (
    isPublicCorsFunction
    && process.env.LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN
      !== declaredPreviewOrigin
  ) throw new Error("SYNTHETIC_EMULATOR_ORIGIN_ENVIRONMENT_MISMATCH");
  return jsonResponse(functionUrl(name), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(declaredPreviewOrigin === undefined
        ? {}
        : { origin: declaredPreviewOrigin }),
      ...(capability === undefined ? {} : { authorization: `Bearer ${capability}` }),
    },
    body: JSON.stringify(body),
  });
}

function expectDenial(result, denialClass) {
  assert.equal(result.ok, false);
  assert.equal(result.body?.denialClass, denialClass);
}

async function waitForHealth() {
  let lastObservation = "NO_RESPONSE";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const result = await jsonResponse(functionUrl("health"));
      if (result.ok) return result.body;
      lastObservation = `${result.status}:${JSON.stringify(result.body)}`;
    } catch {
      // The Functions Emulator can still be starting its first worker.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`FUNCTIONS_EMULATOR_HEALTH_TIMEOUT:${lastObservation}`);
}

function firestorePlainField(field) {
  if (field === undefined) return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("timestampValue" in field) return field.timestampValue;
  return undefined;
}

async function readControl() {
  const current = await emulatorAdminJsonResponse(
    firestoreDocumentUrl("syntheticStagingControl", "current"),
  );
  assert.ok(current.status === 200 || current.status === 404);
  if (current.status === 404) {
    return Object.freeze({
      exists: false,
      controlEpoch: 1,
      stagingEnabled: false,
      reasonCode: "DISABLED_BY_DEFAULT",
      changedAt: "2026-07-25T00:00:00.000Z",
      updateTime: undefined,
    });
  }
  const control = {
    exists: true,
    controlEpoch: firestorePlainField(
      current.body?.fields?.controlEpoch,
    ),
    stagingEnabled: firestorePlainField(
      current.body?.fields?.stagingEnabled,
    ),
    reasonCode: firestorePlainField(current.body?.fields?.reasonCode),
    changedAt: firestorePlainField(current.body?.fields?.changedAt),
    updateTime: current.body?.updateTime,
  };
  if (
    !Number.isSafeInteger(control.controlEpoch)
    || control.controlEpoch < 1
    || typeof control.stagingEnabled !== "boolean"
    || typeof control.reasonCode !== "string"
    || typeof control.changedAt !== "string"
    || typeof control.updateTime !== "string"
  ) throw new Error("CURRENT_STAGING_CONTROL_DOCUMENT_INVALID");
  return Object.freeze(control);
}

async function setControl(controlEpoch, stagingEnabled, reasonCode) {
  const before = await readControl();
  assert.equal(controlEpoch, before.controlEpoch + 1);
  const updated = await emulatorAdminJsonResponse([
    `${firestoreEmulatorBaseUrl}/v1/projects/${projectId}`,
    "/databases/(default)/documents:commit",
  ].join(""), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      writes: [{
        update: {
          name: [
            `projects/${projectId}/databases/(default)/documents`,
            "/syntheticStagingControl/current",
          ].join(""),
          fields: {
            controlEpoch: { integerValue: String(controlEpoch) },
            stagingEnabled: { booleanValue: stagingEnabled },
            reasonCode: { stringValue: reasonCode },
            changedAt: { timestampValue: new Date().toISOString() },
          },
        },
        currentDocument: before.exists
          ? { updateTime: before.updateTime }
          : { exists: false },
      }],
    }),
  });
  assert.equal(
    updated.ok,
    true,
      JSON.stringify({ status: updated.status, body: updated.body }),
  );
  const after = await readControl();
  assert.deepEqual(
    {
      controlEpoch: after.controlEpoch,
      stagingEnabled: after.stagingEnabled,
      reasonCode: after.reasonCode,
    },
    { controlEpoch, stagingEnabled, reasonCode },
  );
  return Object.freeze({ before, after });
}

async function issueSession(lifetimeMs = undefined) {
  const result = await callFunction("issueSyntheticSession", {
    locale: "nb-NO",
    ...(lifetimeMs === undefined ? {} : { lifetimeMs }),
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(typeof result.body?.syntheticSessionId, "string");
  assert.equal(typeof result.body?.childCapability, "string");
  assert.equal(typeof result.body?.adultCapability, "string");
  return result.body;
}

function commandBody(session, kind, commandId, expectedStateVersion, overrides = {}) {
  return {
    syntheticSessionId: session.syntheticSessionId,
    commandId,
    expectedStateVersion,
    authorityGeneration: 1,
    issuedAt: new Date().toISOString(),
    command: { kind },
    ...overrides,
  };
}

async function command(session, capability, kind, commandId, version, overrides = {}) {
  return callFunction(
    "sessionCommand",
    commandBody(session, kind, commandId, version, overrides),
    capability,
  );
}

async function projection(session, capability) {
  return callFunction(
    "sessionProjection",
    { syntheticSessionId: session.syntheticSessionId },
    capability,
  );
}

async function deleteSession(session) {
  const result = await callFunction("deleteSyntheticSession", {
    syntheticSessionId: session.syntheticSessionId,
  });
  assert.equal(result.ok, true);
  assert.equal(result.body?.terminalStatus, "DELETED");
}

async function listCollection(collection) {
  const result = await emulatorAdminJsonResponse(firestoreDocumentUrl(collection));
  if (result.status === 404) return [];
  assert.equal(result.ok, true);
  return result.body?.documents ?? [];
}

async function readHealth() {
  const result = await jsonResponse(functionUrl("health"));
  assert.equal(result.ok, true, JSON.stringify(result.body));
  return result.body;
}

async function inventorySnapshot() {
  const entries = await Promise.all([
    "syntheticStagingControl",
    "syntheticSessions",
    "syntheticCapabilityGrants",
    "syntheticSessionTombstones",
  ].map(async (collection) => [
    collection,
    await listCollection(collection),
  ]));
  const collections = Object.fromEntries(entries);
  return Object.freeze({
    syntheticStagingControl: collections.syntheticStagingControl.length,
    syntheticSessions: collections.syntheticSessions.length,
    syntheticCapabilityGrants:
      collections.syntheticCapabilityGrants.length,
    syntheticSessionTombstones:
      collections.syntheticSessionTombstones.length,
    authorityGenerations: collections.syntheticSessions.map(
      (document) => Number(
        document.fields?.authorityGeneration?.integerValue ?? NaN,
      ),
    ),
    documents: Object.freeze(collections),
  });
}

async function stateSnapshot({ waitForFunctions = false } = {}) {
  const [health, control, inventory] = await Promise.all([
    waitForFunctions ? waitForHealth() : readHealth(),
    readControl(),
    inventorySnapshot(),
  ]);
  return Object.freeze({ health, control, inventory });
}

function inspectApplicationFields(value, path = "") {
  if (value === null || typeof value !== "object") return;
  const forbiddenKeys = new Set([
    "participant",
    "participantName",
    "email",
    "phone",
    "telephone",
    "school",
    "diagnosis",
    "healthData",
    "studentResponse",
    "childName",
    "adultName",
    "stableUid",
    "uid",
    "userId",
    "studentId",
    "childId",
    "freeText",
    "audioBlob",
    "image",
    "video",
  ]);
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (forbiddenKeys.has(key)) throw new Error(`FORBIDDEN_DATA_FIELD:${nextPath}`);
    inspectApplicationFields(nested, nextPath);
  }
}

function assertDeclaredOriginAbsent(value, declaredPreviewOrigin, label) {
  if (JSON.stringify(value).includes(declaredPreviewOrigin)) {
    throw new Error(`SYNTHETIC_PREVIEW_ORIGIN_LEAKED:${label}`);
  }
}

function decodedCapabilityPayload(capability) {
  const [payload, signature, extra] = String(capability).split(".");
  if (!payload || !signature || extra !== undefined) {
    throw new Error("SYNTHETIC_CAPABILITY_FORMAT_INVALID");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

async function clearEmulatorData() {
  const response = await localProofFetch([
    `${firestoreEmulatorBaseUrl}/emulator/v1/projects/${projectId}`,
    "/databases/(default)/documents",
  ].join(""), {
    method: "DELETE",
    headers: { authorization: "Bearer owner" },
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.ok, true);
}

function documentId(document) {
  const name = String(document?.name ?? "");
  const id = name.split("/").at(-1);
  if (
    typeof id !== "string"
    || !/^synthetic-wp13-12b-[A-Za-z0-9_-]{22}$/u.test(id)
  ) throw new Error("SYNTHETIC_SESSION_DOCUMENT_ID_INVALID");
  return id;
}

async function cleanupEmulatorProofState() {
  const errors = [];
  const attempt = async (label, action) => {
    try {
      return await action();
    } catch (error) {
      errors.push(new Error(`${label}:${error?.message ?? String(error)}`, {
        cause: error,
      }));
      return undefined;
    }
  };

  await attempt("DISABLE_STAGING", async () => {
    const current = await readControl();
    await setControl(
      current.controlEpoch + 1,
      false,
      "LOCAL_PROOF_FINAL_CLEANUP",
    );
  });

  const sessions = await attempt(
    "ENUMERATE_SYNTHETIC_SESSIONS",
    () => listCollection("syntheticSessions"),
  ) ?? [];
  for (const session of sessions) {
    await attempt("DELETE_SYNTHETIC_SESSION", () => deleteSession({
      syntheticSessionId: documentId(session),
    }));
  }

  let disabled;
  let tombstonesPreservedBeforeClear = false;
  await attempt("VERIFY_DISABLED_STATE", async () => {
    disabled = await stateSnapshot();
    for (const documents of Object.values(
      disabled.inventory.documents,
    )) {
      for (const document of documents) {
        inspectApplicationFields(document.fields ?? {});
      }
    }
    assert.equal(disabled.inventory.syntheticSessions, 0);
    assert.equal(disabled.inventory.syntheticCapabilityGrants, 0);
    tombstonesPreservedBeforeClear =
      disabled.inventory.documents.syntheticSessionTombstones.every(
        (document) =>
          document.fields?.noResurrection?.booleanValue === true,
      );
    assert.equal(tombstonesPreservedBeforeClear, true);
    assert.equal(
      disabled.health.serviceHealth,
      "READY_DISABLED_BY_DEFAULT",
    );
    assert.equal(disabled.health.stagingEnabled, false);
  });

  await attempt("CLEAR_DEMO_EMULATOR_DATA", clearEmulatorData);
  let postClear;
  await attempt("VERIFY_POST_CLEAR_STATE", async () => {
    postClear = await stateSnapshot();
    for (const count of [
      postClear.inventory.syntheticStagingControl,
      postClear.inventory.syntheticSessions,
      postClear.inventory.syntheticCapabilityGrants,
      postClear.inventory.syntheticSessionTombstones,
    ]) assert.equal(count, 0);
  });

  let final;
  if (disabled !== undefined && postClear !== undefined) {
    final = {
      disabled,
      postClear,
      tombstonesPreservedBeforeClear,
      cloudWrites: 0,
    };
    await attempt(
      "FINAL_STATE_CONTRACT",
      () => assertFinalEmulatorProofState(final),
    );
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, "EMULATOR_PROOF_STATE_CLEANUP_FAILED");
  }
  return Object.freeze(final);
}

async function runInsideEmulators() {
  const proofRunId = process.env.LUDYS_EMULATOR_PROOF_RUN_ID ?? "";
  const originContract = buildSyntheticEmulatorOriginContract(proofRunId);
  const networkGuardState = emulatorNetworkGuardState();
  if (
    networkGuardState?.active !== true
    || networkGuardState.role !== "INNER_PROOF_RUNNER"
    || globalThis[Symbol.for(EMULATOR_NETWORK_GUARD_GLOBAL_KEY)]
      !== networkGuardState
  ) throw new Error("INNER_NODE_NETWORK_GUARD_NOT_ACTIVE");
  if (
    process.env.LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN
      !== originContract.declaredPreviewOrigin
  ) throw new Error("SYNTHETIC_EMULATOR_ORIGIN_ENVIRONMENT_MISMATCH");
  assert.equal(
    assertLoopbackEmulatorTransportUrl(`${firestoreEmulatorBaseUrl}/`),
    `${firestoreEmulatorBaseUrl}/`,
  );
  assert.equal(
    assertLoopbackEmulatorTransportUrl(`${functionsEmulatorBaseUrl}/`),
    `${functionsEmulatorBaseUrl}/`,
  );
  assertEmulatorProofEnvironmentBinding({
    projectId: process.env.GCLOUD_PROJECT,
    googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
    firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
    functionsEmulatorHost:
      process.env.LUDYS_FUNCTIONS_EMULATOR_HOST,
    localEmulatorMode:
      process.env.LUDYS_LOCAL_EMULATOR_PROOF === "true",
    offlineMode: process.env.LUDYS_EMULATOR_OFFLINE_MODE === "true",
    runtimePhase: process.env.LUDYS_STAGING_RUNTIME_PHASE,
    cloudEndpointUsed: false,
    cloudWrites: 0,
    providerLoginCount: 0,
    deploymentCount: 0,
    iamChangeCount: 0,
    cloudResourcesCreated: 0,
    credentialEnvironment: process.env,
    applicationDefaultCredentialsPresent: false,
  });
  assert.match(proofRunId, /^[a-f0-9]{32}$/u);
  const openReason =
    `LOCAL_PROOF_${proofRunId.slice(0, 16).toUpperCase()}`;
  if (hasFlag("--control-contract-only")) {
    await executeEmulatorProofLifecycle({
      operation: async () => {
        const initial = await stateSnapshot({ waitForFunctions: true });
        assertInitialEmulatorProofState(initial);
        await setControl(2, true, openReason);
        const enabled = await stateSnapshot();
        assertEnabledEmulatorProofState(enabled, {
          expectedControlEpoch: 2,
          expectedReasonCode: openReason,
          proofRunId,
        });
      },
      cleanup: cleanupEmulatorProofState,
      stopProcesses: async () => {},
    });
    progress("control-contract-complete");
    return;
  }
  const resultPath = process.env.LUDYS_EMULATOR_PROOF_INNER_RESULT;
  if (!resultPath) throw new Error("INNER_RESULT_PATH_REQUIRED");
  const checks = new Set();
  const mark = (name) => {
    assert.ok(requiredChecks.includes(name), `unknown proof check: ${name}`);
    checks.add(name);
  };

  const lifecycle = await executeEmulatorProofLifecycle({
    operation: async () => {
      const initialState = await stateSnapshot({
        waitForFunctions: true,
      });
      assertInitialEmulatorProofState(initialState);
      mark("functions_emulator");
      mark("firestore_emulator");
      mark("emulator_environment_binding");
      mark("initial_staging_disabled");
      progress("emulators-ready-disabled-by-default");

      const rules = await readFile(
        join(repo, "provider/firebase/firestore.rules"),
        "utf8",
      );
      const testEnvironment = await withTimeout(
        initializeTestEnvironment({
          projectId,
          firestore: {
            host: "127.0.0.1",
            port: firestorePort,
            rules,
          },
        }),
        "RULE_TEST_ENVIRONMENT_INITIALIZATION",
      );
      try {
        const client =
          testEnvironment.unauthenticatedContext().firestore();
        await withTimeout(assertFails(setDoc(
          doc(client, "directClientWrites", "synthetic-denied-probe"),
          { dataClassification: "SYNTHETIC_DENIED_PROBE" },
        )), "DENY_BY_DEFAULT_WRITE");
        await withTimeout(assertFails(getDoc(doc(
          client,
          "syntheticSessions",
          "synthetic-denied-probe",
        ))), "DENY_BY_DEFAULT_READ");
        mark("deny_by_default_rules");
        mark("no_direct_client_write");
      } finally {
        await withTimeout(
          testEnvironment.cleanup(),
          "RULE_TEST_ENVIRONMENT_CLEANUP",
        );
      }
      progress("security-rules-proved");

      const opening = await setControl(2, true, openReason);
      assert.deepEqual(opening.before, initialState.control);
      const enabledState = await stateSnapshot();
      assertEnabledEmulatorProofState(enabledState, {
        expectedControlEpoch: 2,
        expectedReasonCode: openReason,
        proofRunId,
      });
      mark("explicit_proof_enable_transition");
      mark("enabled_staging_ready");
  const primary = await issueSession();
  assertDeclaredOriginAbsent(
    primary,
    originContract.declaredPreviewOrigin,
    "ISSUED_SESSION_OR_CAPABILITY",
  );
  assertDeclaredOriginAbsent(
    [
      decodedCapabilityPayload(primary.childCapability),
      decodedCapabilityPayload(primary.adultCapability),
    ],
    originContract.declaredPreviewOrigin,
    "DECODED_CAPABILITY_PAYLOAD",
  );
  assert.notEqual(primary.childCapability, primary.adultCapability);
  assert.equal(primary.childCapability.split(".").length, 2);
  assert.equal(primary.adultCapability.split(".").length, 2);
  mark("capability_issuance");
  mark("child_capability");
  mark("adult_capability");
  progress("capabilities-issued");

  let version = primary.adultProjection.stateVersion;
  const wrongRoleBeforeProjection = await projection(
    primary,
    primary.adultCapability,
  );
  assert.equal(wrongRoleBeforeProjection.ok, true);
  const wrongRoleBeforeDocument = await emulatorAdminJsonResponse(
    firestoreDocumentUrl("syntheticSessions", primary.syntheticSessionId),
  );
  assert.equal(wrongRoleBeforeDocument.ok, true);
  const wrongRoleBeforeAuthority = await stateSnapshot();
  assert.equal(wrongRoleBeforeProjection.body.audioStatus, "SILENT");
  const wrongRoleDenial = await command(
    primary,
    primary.childCapability,
    "ACTIVATE",
    "wrong-role",
    version,
  );
  expectDenial(wrongRoleDenial, "ROLE_COMMAND_DENIED");
  const wrongRoleAfterProjection = await projection(
    primary,
    primary.adultCapability,
  );
  assert.equal(wrongRoleAfterProjection.ok, true);
  const wrongRoleAfterDocument = await emulatorAdminJsonResponse(
    firestoreDocumentUrl("syntheticSessions", primary.syntheticSessionId),
  );
  assert.equal(wrongRoleAfterDocument.ok, true);
  const wrongRoleAfterAuthority = await stateSnapshot();
  assert.equal(wrongRoleAfterProjection.body.audioStatus, "SILENT");
  const projectionUnchanged = isDeepStrictEqual(
    wrongRoleAfterProjection.body,
    wrongRoleBeforeProjection.body,
  );
  const sessionDocumentUnchanged = isDeepStrictEqual(
    wrongRoleAfterDocument.body,
    wrongRoleBeforeDocument.body,
  );
  const authorityInventoryUnchanged = isDeepStrictEqual(
    wrongRoleAfterAuthority.inventory,
    wrongRoleBeforeAuthority.inventory,
  );
  const authorityControlUnchanged = isDeepStrictEqual(
    wrongRoleAfterAuthority.control,
    wrongRoleBeforeAuthority.control,
  );
  const stateVersionUnchanged =
    wrongRoleAfterProjection.body.stateVersion === version;
  const audioStarted =
    wrongRoleBeforeProjection.body.audioStatus !== "SILENT"
    || wrongRoleAfterProjection.body.audioStatus !== "SILENT";
  assert.equal(projectionUnchanged, true);
  assert.equal(sessionDocumentUnchanged, true);
  assert.equal(authorityInventoryUnchanged, true);
  assert.equal(authorityControlUnchanged, true);
  assert.equal(stateVersionUnchanged, true);
  assert.equal(audioStarted, false);
  assert.deepEqual(
    wrongRoleAfterProjection.body,
    wrongRoleBeforeProjection.body,
  );
  assert.deepEqual(wrongRoleAfterDocument.body, wrongRoleBeforeDocument.body);
  assert.equal(wrongRoleAfterProjection.body.stateVersion, version);
  assertDeclaredOriginAbsent(
    [wrongRoleDenial.body, wrongRoleAfterProjection.body],
    originContract.declaredPreviewOrigin,
    "ROLE_DENIAL_OR_PROJECTION",
  );
  mark("wrong_role");

  expectDenial(await callFunction("sessionCommand", {
    ...commandBody(primary, "ACTIVATE", "wrong-session", version),
    syntheticSessionId: "synthetic-wp13-12b-wrong-session",
  }, primary.adultCapability), "SESSION_BINDING_MISMATCH");
  mark("wrong_session");

  expectDenial(
    await command(primary, primary.adultCapability, "ACTIVATE", "stale-version", version - 1),
    "STALE_VERSION",
  );
  mark("stale_version");

  expectDenial(
    await command(primary, primary.adultCapability, "ACTIVATE", "stale-authority", version, {
      authorityGeneration: 2,
    }),
    "STALE_AUTHORITY",
  );
  mark("stale_authority_generation");

  const active = await command(
    primary,
    primary.adultCapability,
    "ACTIVATE",
    "activate-primary",
    version,
  );
  assert.equal(active.ok, true);
  version = active.body.stateVersion;
  expectDenial(
    await command(
      primary,
      primary.adultCapability,
      "ACTIVATE",
      "activate-primary",
      version,
    ),
    "DUPLICATE_COMMAND",
  );
  mark("duplicate_command");

  const wait = await command(
    primary,
    primary.childCapability,
    "ENTER_WAIT",
    "enter-wait",
    version,
  );
  assert.equal(wait.ok, true);
  assert.equal(wait.body.wait, true);
  version = wait.body.stateVersion;
  mark("wait");

  const resumedFromWait = await command(
    primary,
    primary.adultCapability,
    "RESUME",
    "resume-from-wait",
    version,
  );
  assert.equal(resumedFromWait.ok, true);
  version = resumedFromWait.body.stateVersion;

  const help = await command(
    primary,
    primary.childCapability,
    "REQUEST_HELP",
    "request-help",
    version,
  );
  assert.equal(help.ok, true);
  assert.equal(help.body.helpPending, true);
  version = help.body.stateVersion;
  mark("help");

  const childProjection = await projection(primary, primary.childCapability);
  const adultProjection = await projection(primary, primary.adultCapability);
  assert.equal(childProjection.ok, true);
  assert.equal(adultProjection.ok, true);
  assert.equal(childProjection.body.role, "CHILD");
  assert.equal(adultProjection.body.role, "ADULT");
  assert.equal("syntheticSessionId" in childProjection.body, false);
  assert.equal(adultProjection.body.syntheticSessionId, primary.syntheticSessionId);
  assert.equal("adultCard" in childProjection.body, false);
  assert.equal(adultProjection.body.adultCard, "SYNTHETIC_HELP_REQUESTED");
  mark("child_adult_projection_isolation");
  progress("authority-and-role-checks-proved");

  const paused = await command(
    primary,
    primary.adultCapability,
    "PAUSE",
    "pause-primary",
    version,
  );
  assert.equal(paused.ok, true);
  version = paused.body.stateVersion;
  mark("pause");
  const resumed = await command(
    primary,
    primary.adultCapability,
    "RESUME",
    "resume-primary",
    version,
  );
  assert.equal(resumed.ok, true);
  version = resumed.body.stateVersion;

  const stopped = await command(
    primary,
    primary.childCapability,
    "STOP",
    "stop-primary",
    version,
  );
  assert.equal(stopped.ok, true);
  assert.equal(stopped.body.terminalStatus, "STOPPED");
  version = stopped.body.stateVersion;
  mark("stop");
  const afterStop = await command(
    primary,
    primary.adultCapability,
    "RESUME",
    "delayed-after-stop",
    version,
    { issuedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  );
  assert.ok(
    ["AUTHORITY_GENERATION_STALE", "CAPABILITY_REVOKED"].includes(
      afterStop.body?.denialClass,
    ),
  );
  mark("delayed_command_after_stop");

  await deleteSession(primary);
  mark("deletion");
  const primaryTombstone = await emulatorAdminJsonResponse(
    firestoreDocumentUrl("syntheticSessionTombstones", primary.syntheticSessionId),
  );
  assert.equal(primaryTombstone.ok, true);
  assert.equal(
    primaryTombstone.body?.fields?.noResurrection?.booleanValue,
    true,
  );
  mark("tombstone");
  expectDenial(
    await projection(primary, primary.adultCapability),
    "TOMBSTONE",
  );
  mark("reconnect_after_deletion");
  progress("stop-deletion-tombstone-proved");

  const deletedActive = await issueSession();
  await deleteSession(deletedActive);
  assert.equal(
    (await emulatorAdminJsonResponse(
      firestoreDocumentUrl("syntheticSessions", deletedActive.syntheticSessionId),
    )).status,
    404,
  );
  expectDenial(
    await projection(deletedActive, deletedActive.childCapability),
    "TOMBSTONE",
  );
  mark("no_resurrection");

  const expiring = await issueSession(100);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  expectDenial(
    await projection(expiring, expiring.childCapability),
    "CAPABILITY_EXPIRED",
  );
  mark("expiry");
  progress("expiry-and-no-resurrection-proved");

  const killSwitchSession = await issueSession();
  await setControl(3, false, "LOCAL_PROOF_KILL_SWITCH");
  expectDenial(
    await command(
      killSwitchSession,
      killSwitchSession.adultCapability,
      "ACTIVATE",
      "after-kill-switch",
      killSwitchSession.adultProjection.stateVersion,
    ),
    "KILL_SWITCH_ACTIVE",
  );
  expectDenial(
    await projection(killSwitchSession, killSwitchSession.childCapability),
    "KILL_SWITCH_ACTIVE",
  );
  expectDenial(
    await callFunction("issueSyntheticSession", { locale: "nb-NO" }),
    "KILL_SWITCH_ACTIVE",
  );
  mark("kill_switch");

  await setControl(4, true, "LOCAL_PROOF_EXPLICIT_REOPEN");
  expectDenial(
    await projection(killSwitchSession, killSwitchSession.adultCapability),
    "CONTROL_EPOCH_STALE",
  );
  mark("cached_capability_after_kill_switch");
  const rollbackSession = await issueSession();
  await setControl(5, false, "LOCAL_PROOF_ROLLBACK_SAFE_DISABLED");
  expectDenial(
    await projection(rollbackSession, rollbackSession.childCapability),
    "KILL_SWITCH_ACTIVE",
  );
  const disabledHealth = await jsonResponse(functionUrl("health"));
  assert.equal(disabledHealth.ok, true);
  assert.equal(
    disabledHealth.body.serviceHealth,
    "READY_DISABLED_BY_DEFAULT",
  );
  assert.equal(disabledHealth.body.stagingEnabled, false);
  assert.equal(disabledHealth.body.controlEpoch, 5);
  mark("rollback_to_safe_disabled_state");
  progress("kill-switch-and-rollback-proved");

  for (const session of [expiring, killSwitchSession, rollbackSession]) {
    await deleteSession(session);
  }

  const collections = [
    "syntheticStagingControl",
    "syntheticSessions",
    "syntheticCapabilityGrants",
    "syntheticSessionTombstones",
  ];
  const documentCounts = {};
  for (const collection of collections) {
    const documents = await listCollection(collection);
    documentCounts[collection] = documents.length;
    for (const document of documents) {
      inspectApplicationFields(document.fields ?? {});
      assertDeclaredOriginAbsent(
        document,
        originContract.declaredPreviewOrigin,
        `PERSISTED_${collection}`,
      );
    }
  }
  assert.equal(documentCounts.syntheticSessions, 0);
  assert.ok(documentCounts.syntheticSessionTombstones >= 5);
  mark("forbidden_data_classes_absent");
  progress("data-allowlist-proved");

  const coverageResponse = await localProofFetch([
    `${firestoreEmulatorBaseUrl}/emulator/v1/projects/${projectId}`,
    ":ruleCoverage",
  ].join(""), { signal: AbortSignal.timeout(20_000) });
  assert.equal(coverageResponse.ok, true);
  const coverageText = await coverageResponse.text();
  assert.match(coverageText, /false/u);
      return Object.freeze({
        initialState,
        enabledState,
        documentCounts,
        coverageText,
        roleDenialResult: Object.freeze({
          status: "PASS",
          denialClass: wrongRoleDenial.body.denialClass,
          authoritativeStateUnchanged:
            projectionUnchanged
            && sessionDocumentUnchanged
            && authorityInventoryUnchanged
            && authorityControlUnchanged,
          stateVersionUnchanged,
          audioStarted,
        }),
      });
    },
    cleanup: cleanupEmulatorProofState,
    stopProcesses: async () => {},
  });
  mark("cleanup_after_proof");
  mark("final_staging_disabled");
  progress("synthetic-data-cleared-and-disabled");

  const innerResult = {
    schemaVersion: "wp13.12b-actual-emulator-proof-inner-v1",
    status: "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED",
    completedAt: new Date().toISOString(),
    proofRunId,
    demoProjectId: projectId,
    cloudResourcesCreated: 0,
    providerLoginAttempted: false,
    realParticipantData: false,
    syntheticDataDeleted: true,
    transportEvidence: {
      requestOrigins: [...new Set(
        localTransportRequests.map((request) => request.origin),
      )],
      declaredOriginContactAttempts: 0,
      externalNetworkCalls: 0,
      nodeNetworkGuardActive: true,
      nodeNetworkGuardRole: networkGuardState.role,
    },
    initialControlState: lifecycle.operationResult.initialState,
    enabledControlState: lifecycle.operationResult.enabledState,
    finalControlState: lifecycle.cleanupResult,
    cleanupResult: {
      status: "PASS",
      sessionsRemaining: 0,
      capabilityGrantsRemaining: 0,
      cloudWrites: 0,
      externalNetworkCalls: 0,
    },
    roleDenialResult: lifecycle.operationResult.roleDenialResult,
    firestoreDocumentCountsBeforeCleanup:
      lifecycle.operationResult.documentCounts,
    ruleCoverageSha256: sha256(Buffer.from(
      lifecycle.operationResult.coverageText,
      "utf8",
    )),
    checks: Object.fromEntries(requiredChecks
      .filter((name) => ![
        "capability_and_payload_absent_from_logs",
        "emulator_processes_stopped",
        "cloud_guard",
      ].includes(name))
      .map((name) => [name, checks.has(name)])),
  };
  for (const [name, passed] of Object.entries(innerResult.checks)) {
    assert.equal(passed, true, `proof check missing: ${name}`);
  }
  await mkdir(dirname(resultPath), { recursive: true });
  const innerResultBytes = Buffer.from(
    `${JSON.stringify(innerResult, null, 2)}\n`,
    "utf8",
  );
  const innerResultHandle = await open(resultPath, "wx", 0o600);
  try {
    await innerResultHandle.writeFile(innerResultBytes);
    await innerResultHandle.sync();
  } finally {
    await innerResultHandle.close();
  }
  progress("inner-proof-complete");
  process.stdout.write(
    `${JSON.stringify({
      status: innerResult.status,
      checksPassed: Object.values(innerResult.checks).filter(Boolean).length,
      cloudResourcesCreated: 0,
      syntheticDataDeleted: true,
    })}\n`,
  );
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readNodeNetworkGuardEvidence(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const initialized = [];
  const externalAttempts = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error("NODE_NETWORK_GUARD_EVIDENCE_ENTRY_INVALID");
    }
    const path = join(directory, entry.name);
    if (/^[1-9][0-9]*-initialized\.json$/u.test(entry.name)) {
      const record = JSON.parse(await readFile(path, "utf8"));
      if (
        record.schemaVersion
          !== "wp13.12b-node-network-guard-init-v1"
        || !Number.isSafeInteger(record.pid)
        || record.pid < 1
        || ![
          "FIREBASE_CLI",
          "FUNCTIONS_WORKER",
          "INNER_PROOF_RUNNER",
          "NODE_CHILD",
        ].includes(record.role)
        || typeof record.node !== "string"
      ) throw new Error("NODE_NETWORK_GUARD_INIT_EVIDENCE_INVALID");
      initialized.push(record);
      continue;
    }
    if (/^[1-9][0-9]*-external-attempts\.jsonl$/u.test(entry.name)) {
      const records = (await readFile(path, "utf8"))
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      if (records.some((record) => (
        record.schemaVersion
          !== "wp13.12b-node-network-guard-attempt-v1"
        || !Number.isSafeInteger(record.pid)
        || record.pid < 1
        || typeof record.kind !== "string"
        || typeof record.host !== "string"
      ))) throw new Error("NODE_NETWORK_GUARD_ATTEMPT_EVIDENCE_INVALID");
      externalAttempts.push(...records);
      continue;
    }
    throw new Error("NODE_NETWORK_GUARD_EVIDENCE_FILE_UNEXPECTED");
  }
  const roles = [...new Set(initialized.map((record) => record.role))].sort();
  for (const requiredRole of [
    "FIREBASE_CLI",
    "FUNCTIONS_WORKER",
    "INNER_PROOF_RUNNER",
  ]) {
    if (!roles.includes(requiredRole)) {
      throw new Error(`NODE_NETWORK_GUARD_ROLE_NOT_OBSERVED:${requiredRole}`);
    }
  }
  if (externalAttempts.length !== 0) {
    throw new Error(
      `EXTERNAL_NETWORK_CALLS_OBSERVED_AND_BLOCKED:${externalAttempts.length}`,
    );
  }
  return Object.freeze({
    initializedProcessCount: initialized.length,
    observedRoles: Object.freeze(roles),
    externalNetworkCalls: externalAttempts.length,
  });
}

async function assertFunctionsEnvironmentPathsAbsent() {
  for (const path of forbiddenFunctionsEnvironmentPaths) {
    if (await pathExists(path)) {
      throw new Error(
        `FUNCTIONS_ENVIRONMENT_PATH_MUST_BE_ABSENT:${basename(path)}`,
      );
    }
  }
}

async function removeOwnedFileByIdentity(path, identity) {
  const metadata = await lstat(path);
  if (
    !metadata.isFile()
    || metadata.isSymbolicLink()
    || metadata.dev !== identity.dev
    || metadata.ino !== identity.ino
  ) throw new Error("OWNED_PROOF_FILE_IDENTITY_CHANGED");
  await rm(path);
  if (await pathExists(path)) {
    throw new Error("OWNED_PROOF_FILE_CLEANUP_FAILED");
  }
}

async function writeExclusiveFsynced(path, bytes) {
  let handle;
  let identity;
  try {
    handle = await open(path, "wx", 0o600);
    identity = await handle.stat();
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    const metadata = await lstat(path);
    if (
      !metadata.isFile()
      || metadata.isSymbolicLink()
      || metadata.dev !== identity.dev
      || metadata.ino !== identity.ino
      || resolve(await realpath(path)) !== resolve(path)
      || !(await readFile(path)).equals(bytes)
    ) throw new Error("EPHEMERAL_PROOF_FILE_INTEGRITY_FAILED");
    return identity;
  } catch (error) {
    const cleanupErrors = [];
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (identity !== undefined) {
      try {
        await removeOwnedFileByIdentity(path, identity);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        "EXCLUSIVE_PROOF_FILE_WRITE_AND_CLEANUP_FAILED",
      );
    }
    throw error;
  }
}

async function removeOwnedEphemeralFile(path, expectedBytes) {
  if (!await pathExists(path)) {
    throw new Error("EPHEMERAL_PROOF_FILE_DISAPPEARED");
  }
  const metadata = await lstat(path);
  if (
    !metadata.isFile()
    || metadata.isSymbolicLink()
    || resolve(await realpath(path)) !== resolve(path)
    || !(await readFile(path)).equals(expectedBytes)
  ) throw new Error("EPHEMERAL_PROOF_FILE_CHANGED");
  await rm(path);
  if (await pathExists(path)) {
    throw new Error("EPHEMERAL_PROOF_FILE_CLEANUP_FAILED");
  }
}

async function adcPresent() {
  const candidates = [
    process.env.APPDATA === undefined
      ? undefined
      : join(
        process.env.APPDATA,
        "gcloud",
        "application_default_credentials.json",
      ),
    join(
      homedir(),
      ".config",
      "gcloud",
      "application_default_credentials.json",
    ),
  ].filter(Boolean);
  for (const path of new Set(candidates)) {
    if (await pathExists(path)) return true;
  }
  return false;
}

function isolatedChildEnvironment({
  temporaryDirectory,
  javaHome,
  proofRunId,
  declaredPreviewOrigin,
  networkGuardDirectory,
  innerResultPath,
}) {
  if (
    buildSyntheticEmulatorOriginContract(proofRunId)
      .declaredPreviewOrigin !== declaredPreviewOrigin
  ) throw new Error("SYNTHETIC_EMULATOR_ORIGIN_ENVIRONMENT_MISMATCH");
  if (
    resolve(networkGuardDirectory)
      !== resolve(temporaryDirectory, "network-guard")
  ) throw new Error("EMULATOR_NETWORK_GUARD_DIRECTORY_MISMATCH");
  const tempUserProfile = join(temporaryDirectory, "user-profile");
  const tempAppData = join(temporaryDirectory, "app-data");
  const tempLocalAppData = join(temporaryDirectory, "local-app-data");
  const tempCloudSdk = join(temporaryDirectory, "gcloud-config");
  const pathDelimiter = process.platform === "win32" ? ";" : ":";
  const environment = {
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    ComSpec: process.env.ComSpec,
    PATHEXT: process.env.PATHEXT,
    PROCESSOR_ARCHITECTURE: process.env.PROCESSOR_ARCHITECTURE,
    PATH: [
      join(javaHome, "bin"),
      dirname(process.execPath),
      process.env.SystemRoot === undefined
        ? undefined
        : join(process.env.SystemRoot, "System32"),
    ].filter(Boolean).join(pathDelimiter),
    TEMP: temporaryDirectory,
    TMP: temporaryDirectory,
    USERPROFILE: tempUserProfile,
    APPDATA: tempAppData,
    LOCALAPPDATA: tempLocalAppData,
    XDG_CONFIG_HOME: join(temporaryDirectory, "xdg-config"),
    CLOUDSDK_CONFIG: tempCloudSdk,
    CI: "1",
    NO_UPDATE_NOTIFIER: "1",
    FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1",
    NODE_OPTIONS: `--import=${networkGuardImportUrl}`,
    METADATA_SERVER_DETECTION: "none",
    JAVA_HOME: javaHome,
    FIREBASE_EMULATORS_PATH: dirname(
      resolve(process.env.LUDYS_FIRESTORE_EMULATOR_JAR ?? ""),
    ),
    GCLOUD_PROJECT: projectId,
    GOOGLE_CLOUD_PROJECT: projectId,
    LUDYS_LOCAL_EMULATOR_PROOF: "true",
    LUDYS_EMULATOR_OFFLINE_MODE: "true",
    LUDYS_FUNCTIONS_EMULATOR_HOST: functionsEmulatorHost,
    LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN: declaredPreviewOrigin,
    LUDYS_STAGING_SESSION_ISSUANCE_ENABLED: "true",
    LUDYS_STAGING_RUNTIME_PHASE: "LOCAL_EMULATOR_PROOF",
    LUDYS_EMULATOR_PROOF_RUN_ID: proofRunId,
    LUDYS_EMULATOR_NETWORK_GUARD_DIRECTORY: networkGuardDirectory,
    LUDYS_EMULATOR_PROOF_INNER_RESULT: innerResultPath,
  };
  return Object.freeze(Object.fromEntries(
    Object.entries(environment).filter(([, value]) => (
      typeof value === "string"
    )),
  ));
}

async function seedIsolatedFirebaseConfig(
  temporaryDirectory,
  environment,
) {
  const bytes = Buffer.from(`${JSON.stringify({
    motd: { fetched: Date.now() },
  })}\n`, "utf8");
  const paths = [
    join(
      environment.USERPROFILE,
      ".config",
      "configstore",
      "firebase-tools.json",
    ),
    join(
      environment.APPDATA,
      "configstore",
      "firebase-tools.json",
    ),
  ];
  for (const path of paths) {
    await mkdir(dirname(path), { recursive: true });
    await writeExclusiveFsynced(path, bytes);
  }
  await mkdir(environment.LOCALAPPDATA, { recursive: true });
  await mkdir(environment.CLOUDSDK_CONFIG, { recursive: true });
  await mkdir(join(temporaryDirectory, "xdg-config"), {
    recursive: true,
  });
}

async function endpointResponds(url) {
  try {
    await localProofFetch(url, { signal: AbortSignal.timeout(500) });
    return true;
  } catch {
    return false;
  }
}

async function assertEmulatorEndpointsUnavailable(label, retries = 1) {
  const urls = [
    `http://${firestoreEmulatorHost}/`,
    `http://${functionsEmulatorHost}/`,
  ];
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const responding = await Promise.all(urls.map(endpointResponds));
    if (responding.every((value) => value === false)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`EMULATOR_ENDPOINT_REMAINS_AVAILABLE:${label}`);
}

function residualEmulatorProcessCount() {
  if (process.platform !== "win32") return 0;
  const command = [
    "$items = Get-CimInstance Win32_Process | Where-Object {",
    "($_.Name -ieq 'java.exe' -and $_.CommandLine -like",
    "'*cloud-firestore-emulator-v*.jar*') -or",
    "($_.Name -ieq 'node.exe' -and $_.CommandLine -like",
    "'*firebase.js*emulators:*') -or",
    "($_.Name -ieq 'node.exe' -and $_.CommandLine -like",
    "'*@google-cloud*functions-framework*') -or",
    "($_.Name -ieq 'node.exe' -and $_.CommandLine -like",
    "'*provider*firebase*functions*index.mjs*')",
    "}; [Console]::Out.Write(@($items).Count)",
  ].join(" ");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 20_000,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.status !== 0 || !/^\d+$/u.test(result.stdout.trim())) {
    throw new Error("EMULATOR_RESIDUAL_PROCESS_SCAN_FAILED");
  }
  return Number(result.stdout.trim());
}

function nodeAndJavaProcessIds() {
  if (process.platform !== "win32") return new Set();
  const command = [
    "$items = Get-CimInstance Win32_Process | Where-Object {",
    "$_.Name -ieq 'node.exe' -or $_.Name -ieq 'java.exe'",
    "}; [Console]::Out.Write((@($items.ProcessId) -join ','))",
  ].join(" ");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 20_000,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const output = result.stdout.trim();
  if (
    result.status !== 0
    || (
      output.length > 0
      && !/^[1-9][0-9]*(?:,[1-9][0-9]*)*$/u.test(output)
    )
  ) throw new Error("NODE_JAVA_PROCESS_SNAPSHOT_FAILED");
  return new Set(
    output.length === 0 ? [] : output.split(",").map(Number),
  );
}

function spawnedNodeOrJavaProcessCount(baselineProcessIds) {
  const current = nodeAndJavaProcessIds();
  return [...current].filter(
    (processId) => !baselineProcessIds.has(processId),
  ).length;
}

async function currentExternalState() {
  const inventory = JSON.parse(await readFile(
    join(
      repo,
      "release",
      "wp13-12b",
      "external-activation",
      "resource-inventory.json",
    ),
    "utf8",
  ));
  const state = JSON.parse(await readFile(
    join(
      repo,
      "release",
      "wp13-12b",
      "external-activation",
      "external-activation-state.json",
    ),
    "utf8",
  ));
  const blockers = [];
  const authenticInventory = [
    "AUTHENTIC_PROVIDER_SNAPSHOT",
    "DESTRUCTION_VERIFIED_ZERO_RESOURCES",
  ].includes(inventory.inventoryStatus);
  const cloudResourceCount = (
    authenticInventory
    && Number.isSafeInteger(inventory.resourceCount)
    && inventory.resourceCount >= 0
    && inventory.operatorEvidence?.blockerCount === 0
  ) ? inventory.resourceCount : null;
  if (cloudResourceCount === null) {
    blockers.push("CURRENT_CLOUD_RESOURCE_COUNT_UNAVAILABLE");
  }

  let deploymentCount = null;
  const operatorPath = inventory.operatorEvidence?.path;
  if (
    authenticInventory
    && inventory.operatorEvidence?.authenticatedVercelReadback === true
    && typeof operatorPath === "string"
  ) {
    try {
      const operator = JSON.parse(await readFile(
        join(repo, ...operatorPath.split("/")),
        "utf8",
      ));
      const deployments =
        operator.resources?.vercel?.deployments
        ?? operator.inventory?.resources?.vercel?.deployments;
      if (Array.isArray(deployments)) deploymentCount = deployments.length;
    } catch {
      deploymentCount = null;
    }
  }
  if (deploymentCount === null) {
    blockers.push("CURRENT_DEPLOYMENT_COUNT_UNAVAILABLE");
  } else if (deploymentCount !== 0) {
    blockers.push("CURRENT_DEPLOYMENT_COUNT_NOT_ZERO");
  }

  const validatedReceiptCount =
    state.evidence?.validatedReceiptCount;
  if (
    !Number.isSafeInteger(validatedReceiptCount)
    || validatedReceiptCount !== 0
  ) blockers.push("VALIDATED_RECEIPT_COUNT_NOT_ZERO");
  return Object.freeze({
    resourceInventoryStatus: inventory.inventoryStatus,
    cloudResourceCount,
    deploymentCount,
    validatedReceiptCount:
      Number.isSafeInteger(validatedReceiptCount)
        ? validatedReceiptCount
        : null,
    blockers: Object.freeze(blockers),
  });
}

async function runOuterAfterGitPreflight(initialSource, binding) {
  const {
    securityRemediationChangePaths,
    securityRemediationChangeRecords,
    securityRemediationChangeSetSha256,
    gitDiffCommandContract,
    proofOriginChangePaths,
    proofToolChangePaths,
  } = binding;
  const proofRunId = randomBytes(16).toString("hex");
  const originContract = buildSyntheticEmulatorOriginContract(proofRunId);
  assert.equal(
    assertLoopbackEmulatorTransportUrl(`${firestoreEmulatorBaseUrl}/`),
    `${firestoreEmulatorBaseUrl}/`,
  );
  assert.equal(
    assertLoopbackEmulatorTransportUrl(`${functionsEmulatorBaseUrl}/`),
    `${functionsEmulatorBaseUrl}/`,
  );
  await assertFunctionsEnvironmentPathsAbsent();
  await assertEmulatorEndpointsUnavailable("BEFORE_RUN");
  if (residualEmulatorProcessCount() !== 0) {
    throw new Error("EMULATOR_PROCESS_PRESENT_BEFORE_RUN");
  }
  const baselineNodeJavaProcessIds = nodeAndJavaProcessIds();
  assertEmulatorProofEnvironmentBinding({
    projectId,
    googleCloudProject: projectId,
    firestoreEmulatorHost,
    functionsEmulatorHost,
    localEmulatorMode: true,
    offlineMode: true,
    runtimePhase: "LOCAL_EMULATOR_PROOF",
    cloudEndpointUsed: false,
    cloudWrites: 0,
    providerLoginCount: 0,
    deploymentCount: 0,
    iamChangeCount: 0,
    cloudResourcesCreated: 0,
    credentialEnvironment: process.env,
    applicationDefaultCredentialsPresent: await adcPresent(),
  });
  const initialAuthority = await assertCommittedAuthoritySnapshot(
    initialSource.sourceCommit,
  );
  const copyReview = await evaluateCopyReview();
  if (
    copyReview.valid !== true
    || copyReview.sourceSetSha256 !== PREVIEW_SOURCE_SET_SHA256
    || copyReview.sourceSetSha256
      !== copyReviewExpectedSourceSetSha256
  ) throw new Error("WP13_12B_PROOF_FIX_BLOCKED_BY_PREVIEW_SOURCE_DRIFT");

  const jar = resolve(process.env.LUDYS_FIRESTORE_EMULATOR_JAR ?? "");
  const expectedJarSha256 = process.env.LUDYS_FIRESTORE_EMULATOR_SHA256 ?? "";
  const firebaseCliJs = resolve(process.env.LUDYS_FIREBASE_CLI_JS ?? "");
  const javaHome = resolve(process.env.LUDYS_JAVA_HOME ?? "");
  if (
    !jar
    || basename(jar)
      !== `cloud-firestore-emulator-v${expectedEmulatorVersion}.jar`
  ) {
    throw new Error("EXACT_VERIFIED_FIRESTORE_EMULATOR_JAR_REQUIRED");
  }
  if (!/^[a-f0-9]{64}$/u.test(expectedJarSha256)) {
    throw new Error("PUBLISHED_FIRESTORE_EMULATOR_SHA256_REQUIRED");
  }
  if (await sha256File(jar) !== expectedJarSha256) {
    throw new Error("FIRESTORE_EMULATOR_SHA256_MISMATCH");
  }
  if (basename(firebaseCliJs) !== "firebase.js") {
    throw new Error("PINNED_FIREBASE_CLI_JS_REQUIRED");
  }
  const java = join(
    javaHome,
    "bin",
    process.platform === "win32" ? "java.exe" : "java",
  );
  for (const path of [firebaseCliJs, java]) await access(path);

  const javaVersion = commandResult(java, ["-version"]);
  assert.match(javaVersion, /21\.0\.12/u);
  const emulatorVersion = commandResult(java, ["-jar", jar, "--version"]);
  assert.match(
    emulatorVersion,
    new RegExp(expectedEmulatorVersion.replaceAll(".", "\\."), "u"),
  );

  const logPaths = [
    join(repo, "firebase-debug.log"),
    join(repo, "firestore-debug.log"),
    join(repo, "ui-debug.log"),
  ];
  for (const logPath of logPaths) {
    if (await pathExists(logPath)) {
      throw new Error(`EMULATOR_LOG_PATH_MUST_BE_CLEAR:${basename(logPath)}`);
    }
  }

  const startedAt = new Date().toISOString();
  const temporaryDirectory = await mkdtemp(join(
    tmpdir(),
    "ludys-wp13-12b-emulator-proof-",
  ));
  const innerResultPath = join(temporaryDirectory, "inner-result.json");
  const networkGuardDirectory = join(
    temporaryDirectory,
    "network-guard",
  );
  await mkdir(networkGuardDirectory);
  const hmacKey = randomBytes(48).toString("base64url");
  const secretBytes = Buffer.from(
    `LUDYS_CAPABILITY_HMAC_KEY=${hmacKey}\n`,
    "utf8",
  );
  const childCommand = [
    quoteCommandArgument(process.execPath),
    quoteCommandArgument(scriptPath),
    "--inside-emulators",
    "--authorized-local-emulator-proof",
  ].join(" ");
  const cleanupErrors = [];
  const cleanupAttempt = async (label, action) => {
    try {
      await action();
    } catch (error) {
      cleanupErrors.push(new Error(
        `${label}:${error?.message ?? String(error)}`,
        { cause: error },
      ));
    }
  };
  let execution;
  let inner;
  let primaryError;
  let secretCreated = false;
  let env;
  let firebaseCliVersion;
  let networkGuardEvidence;
  try {
    env = isolatedChildEnvironment({
      temporaryDirectory,
      javaHome,
      proofRunId,
      declaredPreviewOrigin: originContract.declaredPreviewOrigin,
      networkGuardDirectory,
      innerResultPath,
    });
    await seedIsolatedFirebaseConfig(temporaryDirectory, env);
    firebaseCliVersion = commandResult(
      process.execPath,
      [firebaseCliJs, "--version"],
      { env },
    );
    assert.equal(firebaseCliVersion, expectedFirebaseCliVersion);
    await writeExclusiveFsynced(ephemeralSecretPath, secretBytes);
    secretCreated = true;
    execution = await runCaptured(process.execPath, [
      firebaseCliJs,
      "emulators:exec",
      "--only",
      "firestore,functions",
      "--project",
      projectId,
      "--config",
      "provider/firebase/firebase.json",
      childCommand,
    ], { env, timeoutMs: proofTimeoutMs });
    networkGuardEvidence = await readNodeNetworkGuardEvidence(
      networkGuardDirectory,
    );
    const transcript = `${execution.stdout}\n${execution.stderr}`;
    const capabilityPattern =
      /eyJjYXBhYmlsaXR5VmVyc2lvbiI[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/u;
    assert.equal(transcript.includes(hmacKey), false);
    assert.equal(
      transcript.includes(originContract.declaredPreviewOrigin),
      false,
    );
    assert.equal(capabilityPattern.test(transcript), false);
    assert.doesNotMatch(
      transcript,
      /requestBody|childCapability|adultCapability/iu,
    );
    assert.doesNotMatch(
      transcript,
      /Trying to access secret|Unable to access secret|Application Default Credentials detected|non-emulated services will access production|secretmanager\.googleapis\.com|firestore\.googleapis\.com|cloudfunctions\.googleapis\.com|iam\.googleapis\.com|api\.vercel\.com|accounts\.google\.com/iu,
    );
    if (execution.code !== 0) {
      const sanitizedTail = transcript
        .replaceAll(hmacKey, "[REDACTED]")
        .replaceAll(
          originContract.declaredPreviewOrigin,
          "[SYNTHETIC_ORIGIN_REDACTED]",
        )
        .split(/\r?\n/u)
        .slice(-120)
        .join("\n");
      throw new Error(`ACTUAL_EMULATOR_PROOF_FAILED\n${sanitizedTail}`);
    }
    assert.match(transcript, /Loaded functions definitions from source/u);
    assert.match(
      transcript,
      /Firestore Emulator was started in standard edition/u,
    );
    inner = JSON.parse(await readFile(innerResultPath, "utf8"));
    if (
      inner.transportEvidence?.declaredOriginContactAttempts !== 0
      || inner.transportEvidence?.externalNetworkCalls !== 0
      || inner.transportEvidence?.nodeNetworkGuardActive !== true
      || inner.transportEvidence?.nodeNetworkGuardRole
        !== "INNER_PROOF_RUNNER"
      || !Array.isArray(inner.transportEvidence?.requestOrigins)
      || !inner.transportEvidence.requestOrigins.includes(
        firestoreEmulatorBaseUrl,
      )
      || !inner.transportEvidence.requestOrigins.includes(
        functionsEmulatorBaseUrl,
      )
      || inner.transportEvidence.requestOrigins.some(
        (origin) => ![
          firestoreEmulatorBaseUrl,
          functionsEmulatorBaseUrl,
        ].includes(origin),
      )
    ) throw new Error("INNER_EMULATOR_TRANSPORT_EVIDENCE_INVALID");
    assertDeclaredOriginAbsent(
      inner,
      originContract.declaredPreviewOrigin,
      "INNER_PROOF_RESULT",
    );
  } catch (error) {
    primaryError = error;
  } finally {
    if (secretCreated) {
      await cleanupAttempt(
        "EPHEMERAL_SECRET_CLEANUP",
        () => removeOwnedEphemeralFile(
          ephemeralSecretPath,
          secretBytes,
        ),
      );
      secretCreated = false;
    }
    for (const logPath of logPaths) {
      if (await pathExists(logPath)) {
        await cleanupAttempt("EMULATOR_LOG_CLEANUP", async () => {
          const logCleanupErrors = [];
          try {
            const log = await readFile(logPath, "utf8");
            assert.equal(log.includes(hmacKey), false);
            assert.equal(
              log.includes(originContract.declaredPreviewOrigin),
              false,
            );
            assert.doesNotMatch(
              log,
              /eyJjYXBhYmlsaXR5VmVyc2lvbiI[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/u,
            );
          } catch (error) {
            logCleanupErrors.push(error);
          }
          try {
            await rm(logPath);
          } catch (error) {
            logCleanupErrors.push(error);
          }
          if (logCleanupErrors.length > 0) {
            throw new AggregateError(
              logCleanupErrors,
              `EMULATOR_LOG_INSPECTION_OR_CLEANUP_FAILED:${basename(logPath)}`,
            );
          }
        });
      }
    }
    await cleanupAttempt(
      "TEMPORARY_DIRECTORY_CLEANUP",
      () => rm(temporaryDirectory, { recursive: true, force: true }),
    );
    await cleanupAttempt(
      "EMULATOR_ENDPOINT_POSTCONDITION",
      () => assertEmulatorEndpointsUnavailable("AFTER_RUN", 50),
    );
    await cleanupAttempt("EMULATOR_PROCESS_POSTCONDITION", async () => {
      assert.equal(residualEmulatorProcessCount(), 0);
      assert.equal(
        spawnedNodeOrJavaProcessCount(baselineNodeJavaProcessIds),
        0,
      );
    });
    await cleanupAttempt(
      "FUNCTIONS_ENVIRONMENT_POSTCONDITION",
      assertFunctionsEnvironmentPathsAbsent,
    );
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...cleanupErrors].filter(Boolean),
      "ACTUAL_EMULATOR_PROOF_OUTER_CLEANUP_FAILED",
    );
  }
  if (primaryError !== undefined) throw primaryError;
  if (networkGuardEvidence === undefined) {
    throw new Error("NODE_NETWORK_GUARD_EVIDENCE_MISSING");
  }

  inner.checks.capability_and_payload_absent_from_logs = true;
  inner.checks.emulator_processes_stopped = true;
  inner.checks.cloud_guard = true;
  for (const name of requiredChecks) {
    assert.equal(inner.checks[name], true, `proof check missing: ${name}`);
  }

  const finalSource = await assertEmulatorProofSourcePrecondition(repo);
  if (
    finalSource.sourceCommit !== initialSource.sourceCommit
    || finalSource.sourceTree !== initialSource.sourceTree
  ) throw new Error("EMULATOR_PROOF_SOURCE_CHANGED_DURING_RUN");
  const finalAuthority = await assertCommittedAuthoritySnapshot(
    finalSource.sourceCommit,
  );
  if (
    finalAuthority.manifestSha256 !== initialAuthority.manifestSha256
    || finalAuthority.authorityFileCount
      !== initialAuthority.authorityFileCount
  ) throw new Error("EMULATOR_PROOF_AUTHORITY_CHANGED_DURING_RUN");

  const { sourceCommit, sourceTree } = finalSource;
  const runnerBytes = await readFile(scriptPath);
  const runnerSha256 = sha256(runnerBytes);
  const runnerGitBlob = gitText([
    "-c",
    `safe.directory=${repo.replaceAll("\\", "/")}`,
    "rev-parse",
    `${sourceCommit}:scripts/run-wp13-12b-emulator-proof.mjs`,
  ]);
  assert.match(runnerGitBlob, /^[a-f0-9]{40}$/u);
  const ownerDecisionPath =
    "release/wp13-12b/external-activation/owner-authorization.json";
  const securityRemediationPath =
    "release/wp13-12b/provider-security-remediation.json";
  const providerPackagePath = "artifacts/wp13-12b-provider-package.json";
  const providerPackageLockPath =
    "provider/firebase/functions/package-lock.json";
  const providerSbomPath = "release/wp13-12b/provider-sbom.cdx.json";
  const providerAuditPath = "release/wp13-12b/provider-audit.json";
  const receiptContractPath =
    "release/wp13-12b/activation-handoff/receipt-contracts.json";
  const proofRunnerPath = scriptPath
    .slice(repo.length)
    .replaceAll("\\", "/")
    .replace(/^\//u, "");
  const repositoryBytes = async (path) => readFile(
    join(repo, ...path.split("/")),
  );
  const committedBytes = (commit, path) => gitBytes([
    "-c",
    `safe.directory=${repo.replaceAll("\\", "/")}`,
    "show",
    `${commit}:${path}`,
  ]);
  const ownerDecisionBytes = await repositoryBytes(ownerDecisionPath);
  const securityRemediationBytes = await repositoryBytes(
    securityRemediationPath,
  );
  const providerPackageBytes = await repositoryBytes(providerPackagePath);
  const providerPackageLockBytes = await repositoryBytes(
    providerPackageLockPath,
  );
  const providerSbomBytes = await repositoryBytes(providerSbomPath);
  const providerAuditBytes = await repositoryBytes(providerAuditPath);
  const receiptContractBytes = await repositoryBytes(receiptContractPath);
  const activationPackageBytes = await repositoryBytes(
    externalActivationChecksumManifestPath,
  );
  if (
    !ownerDecisionBytes.equals(
      committedBytes(COMMIT_S_SHA, ownerDecisionPath),
    )
    || !ownerDecisionBytes.equals(
      committedBytes(sourceCommit, ownerDecisionPath),
    )
  ) throw new Error("COMMIT_S_OWNER_DECISION_BINDING_BYTES_CHANGED");
  if (
    !securityRemediationBytes.equals(
      committedBytes(COMMIT_U_SHA, securityRemediationPath),
    )
    || !securityRemediationBytes.equals(
      committedBytes(sourceCommit, securityRemediationPath),
    )
    || sha256(securityRemediationBytes)
      !== commitUSecurityRemediationSha256
    || !providerPackageBytes.equals(
      committedBytes(COMMIT_U_SHA, providerPackagePath),
    )
    || !providerPackageBytes.equals(
      committedBytes(sourceCommit, providerPackagePath),
    )
    || sha256(providerPackageBytes) !== commitUProviderPackageSha256
    || !providerPackageLockBytes.equals(
      committedBytes(COMMIT_U_SHA, providerPackageLockPath),
    )
    || !providerPackageLockBytes.equals(
      committedBytes(sourceCommit, providerPackageLockPath),
    )
    || sha256(providerPackageLockBytes)
      !== commitUProviderPackageLockSha256
    || !providerSbomBytes.equals(
      committedBytes(COMMIT_U_SHA, providerSbomPath),
    )
    || !providerSbomBytes.equals(
      committedBytes(sourceCommit, providerSbomPath),
    )
    || sha256(providerSbomBytes) !== commitUProviderSbomSha256
    || !providerAuditBytes.equals(
      committedBytes(COMMIT_U_SHA, providerAuditPath),
    )
    || !providerAuditBytes.equals(
      committedBytes(sourceCommit, providerAuditPath),
    )
    || sha256(providerAuditBytes) !== commitUProviderAuditSha256
  ) throw new Error("COMMIT_U_PROVIDER_SECURITY_BINDING_BYTES_CHANGED");
  const providerSecurityRemediation = JSON.parse(
    securityRemediationBytes.toString("utf8"),
  );
  const providerPackage = JSON.parse(providerPackageBytes.toString("utf8"));
  const providerSbom = JSON.parse(providerSbomBytes.toString("utf8"));
  const providerAudit = JSON.parse(providerAuditBytes.toString("utf8"));
  const fastUriComponents = providerSbom.components?.filter(
    (component) => component?.name === "fast-uri",
  ) ?? [];
  if (
    providerSecurityRemediation.advisory?.ghsa
      !== fastUriSecurityAdvisory
    || providerSecurityRemediation.advisory?.minimumFixedVersion
      !== resolvedFastUriVersion
    || providerSecurityRemediation.patchedPackage?.name !== "fast-uri"
    || providerSecurityRemediation.patchedPackage?.version
      !== resolvedFastUriVersion
    || providerSecurityRemediation.currentProviderPackage?.fastUriVersion
      !== resolvedFastUriVersion
    || providerSecurityRemediation.currentProviderPackage?.providerLockSha256
      !== commitUProviderPackageLockSha256
    || providerSecurityRemediation.currentProviderPackage?.providerPackageSha256
      !== commitUProviderPackageSha256
    || providerSecurityRemediation.currentProviderPackage?.commitBinding
      !== "INTRODUCING_COMMIT_OF_THIS_RECORD"
    || providerSecurityRemediation.currentProviderPackage?.expectedParentCommit
      !== COMMIT_T_SHA
    || providerSecurityRemediation.anchors?.securityRemediationCommit
      !== "INTRODUCING_COMMIT_OF_THIS_RECORD"
    || providerSecurityRemediation.anchors?.activeProviderPackageCommit
      !== "INTRODUCING_COMMIT_OF_THIS_RECORD"
    || providerPackage.sourceCommit
      !== "PENDING_FINAL_COMMIT_NOT_A_RECEIPT"
    || providerPackage.providerActivation !== "BLOCKED"
    || providerPackage.files?.filter(
      (entry) => entry?.path === providerPackageLockPath,
    ).length !== 1
    || providerPackage.files?.find(
      (entry) => entry?.path === providerPackageLockPath,
    )?.sha256 !== commitUProviderPackageLockSha256
    || fastUriComponents.length !== 1
    || fastUriComponents[0].version !== resolvedFastUriVersion
    || fastUriComponents[0].purl
      !== `pkg:npm/fast-uri@${resolvedFastUriVersion}`
    || providerAudit.auditExitCode !== 0
    || providerAudit.vulnerabilities?.high !== 0
    || providerAudit.vulnerabilities?.critical !== 0
    || providerAudit.vulnerabilities?.total !== 0
    || providerAudit.blocksExternalActivation !== false
    || providerAudit.evidenceBindings?.providerLockSha256
      !== commitUProviderPackageLockSha256
    || providerAudit.evidenceBindings?.providerPackageSha256
      !== commitUProviderPackageSha256
    || providerAudit.evidenceBindings?.securityRemediationSha256
      !== commitUSecurityRemediationSha256
    || providerAudit.evidenceBindings?.fastUriVersion
      !== resolvedFastUriVersion
  ) throw new Error("COMMIT_U_PROVIDER_SECURITY_CONTRACT_INVALID");
  if (!runnerBytes.equals(committedBytes(sourceCommit, proofRunnerPath))) {
    throw new Error("PROOF_RUNNER_NOT_COMMITTED_AT_PROOF_TOOL_HEAD");
  }
  if (
    !receiptContractBytes.equals(
      committedBytes(sourceCommit, receiptContractPath),
    )
    || !activationPackageBytes.equals(committedBytes(
      sourceCommit,
      externalActivationChecksumManifestPath,
    ))
  ) throw new Error("COMMIT_V_AUTHORITY_BINDING_BYTES_CHANGED");
  const externalState = await currentExternalState();
  const nonceReady = externalState.blockers.length === 0;
  const generatedAt = nonceReady ? new Date().toISOString() : null;
  const expiresAt = nonceReady
    ? new Date(
      Date.parse(generatedAt) + EMULATOR_CHALLENGE_TTL_MS,
    ).toISOString()
    : null;
  const hashBindings = {
    ownerDecision: {
      path: ownerDecisionPath,
      sha256: sha256(ownerDecisionBytes),
      commit: COMMIT_S_SHA,
    },
    providerSecurityRemediation: {
      path: securityRemediationPath,
      sha256: sha256(securityRemediationBytes),
      commit: COMMIT_U_SHA,
    },
    providerPackage: {
      path: providerPackagePath,
      sha256: sha256(providerPackageBytes),
      commit: COMMIT_U_SHA,
    },
    providerPackageLock: {
      path: providerPackageLockPath,
      sha256: sha256(providerPackageLockBytes),
      commit: COMMIT_U_SHA,
    },
    providerSbom: {
      path: providerSbomPath,
      sha256: sha256(providerSbomBytes),
      commit: COMMIT_U_SHA,
    },
    providerAudit: {
      path: providerAuditPath,
      sha256: sha256(providerAuditBytes),
      commit: COMMIT_U_SHA,
    },
    activationPackage: {
      path: externalActivationChecksumManifestPath,
      sha256: sha256(activationPackageBytes),
      commit: sourceCommit,
    },
    receiptContract: {
      path: receiptContractPath,
      sha256: sha256(receiptContractBytes),
      commit: sourceCommit,
    },
    proofRunner: {
      path: proofRunnerPath,
      sha256: runnerSha256,
      gitBlob: runnerGitBlob,
      commit: sourceCommit,
    },
  };
  const commitBinding = Object.freeze({
    commitS: COMMIT_S_SHA,
    commitSTree: COMMIT_S_TREE,
    commitT: COMMIT_T_SHA,
    commitTTree: COMMIT_T_TREE,
    commitU: COMMIT_U_SHA,
    commitUTree: COMMIT_U_TREE,
    commitV: COMMIT_V_SHA,
    commitVTree: COMMIT_V_TREE,
    commitW: sourceCommit,
    commitWTree: sourceTree,
    orderedCommitChain: Object.freeze([
      COMMIT_S_SHA,
      COMMIT_T_SHA,
      COMMIT_U_SHA,
      COMMIT_V_SHA,
      sourceCommit,
    ]),
    sourceCommit,
    sourceTree,
    proofOriginCommit: COMMIT_V_SHA,
    proofOriginTree: COMMIT_V_TREE,
    proofToolCommitChain: Object.freeze([
      COMMIT_T_SHA,
      COMMIT_U_SHA,
      COMMIT_V_SHA,
      sourceCommit,
    ]),
    proofToolCommit: sourceCommit,
    proofToolTree: sourceTree,
    securityRemediationCommit: COMMIT_U_SHA,
    securityRemediationTree: COMMIT_U_TREE,
    providerSecurityRemediationCommit: COMMIT_U_SHA,
    providerPackageCommit: COMMIT_U_SHA,
    providerPackageLockCommit: COMMIT_U_SHA,
    providerSbomCommit: COMMIT_U_SHA,
    providerAuditCommit: COMMIT_U_SHA,
    proofRunnerSha256: runnerSha256,
    proofRunnerGitBlob: runnerGitBlob,
    pinnedGitAdapterSha256,
    pinnedGitAdapterGitBlob,
    gitDiffCommandContract,
    securityRemediationChangeSetSha256,
  });
  const challenge = nonceReady ? {
    schemaVersion: EMULATOR_CHALLENGE_SCHEMA,
    status: "GENERATED_PENDING_OWNER_CONFIRMATION",
    recordStatus: "DRAFT_PENDING_OWNER_CONFIRMATION",
    evidenceStatus: "NOT_EVIDENCE",
    vercelLoginAuthorizationStatus: "NOT_AUTHORIZATION_FOR_VERCEL_LOGIN",
    deploymentAuthorizationStatus: "NOT_AUTHORIZATION_FOR_DEPLOYMENT",
    externalDeletionAuthorizationStatus:
      "NOT_AUTHORIZATION_FOR_EXTERNAL_DELETION",
    realDataAuthorizationStatus: "NOT_AUTHORIZATION_FOR_REAL_DATA",
    studentBetaAuthorizationStatus:
      "NOT_AUTHORIZATION_FOR_STUDENT_BETA",
    productionAuthorizationStatus: "NOT_AUTHORIZATION_FOR_PRODUCTION",
    generation: 1,
    purpose: EMULATOR_PR3_PURPOSE,
    nonce: randomBytes(16).toString("hex"),
    generatedAt,
    expiresAt,
    ...commitBinding,
    previewSourceSetSha256: PREVIEW_SOURCE_SET_SHA256,
    ownerDecisionSha256: hashBindings.ownerDecision.sha256,
    providerPackageSha256: hashBindings.providerPackage.sha256,
    providerLockSha256: hashBindings.providerPackageLock.sha256,
    providerSbomSha256: hashBindings.providerSbom.sha256,
    providerAuditSha256: hashBindings.providerAudit.sha256,
    providerSecurityRemediationSha256:
      hashBindings.providerSecurityRemediation.sha256,
    resolvedFastUriVersion,
    advisory: fastUriSecurityAdvisory,
    activationPackageSha256: hashBindings.activationPackage.sha256,
    receiptContractSha256: hashBindings.receiptContract.sha256,
    cloudResourceCount: externalState.cloudResourceCount,
    deploymentCount: externalState.deploymentCount,
    validatedReceiptCount: externalState.validatedReceiptCount,
  } : {
    schemaVersion: EMULATOR_CHALLENGE_SCHEMA,
    status: "NOT_GENERATED_CURRENT_EXTERNAL_COUNTS_UNAVAILABLE",
    generation: null,
    purpose: EMULATOR_PR3_PURPOSE,
    nonce: null,
    generatedAt: null,
    expiresAt: null,
    ...commitBinding,
    previewSourceSetSha256: PREVIEW_SOURCE_SET_SHA256,
    ownerDecisionSha256: hashBindings.ownerDecision.sha256,
    providerPackageSha256: hashBindings.providerPackage.sha256,
    providerLockSha256: hashBindings.providerPackageLock.sha256,
    providerSbomSha256: hashBindings.providerSbom.sha256,
    providerAuditSha256: hashBindings.providerAudit.sha256,
    providerSecurityRemediationSha256:
      hashBindings.providerSecurityRemediation.sha256,
    resolvedFastUriVersion,
    advisory: fastUriSecurityAdvisory,
    activationPackageSha256: hashBindings.activationPackage.sha256,
    receiptContractSha256: hashBindings.receiptContract.sha256,
    blockers: [...externalState.blockers],
  };

  const result = {
    schemaVersion: "wp13.12b-actual-emulator-proof-v2",
    status: nonceReady
      ? "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_AWAITING_HUMAN_CONFIRMATION"
      : "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_NONCE_BLOCKED_BY_CURRENT_EXTERNAL_COUNTS",
    proofRunId,
    startedAt,
    completedAt: inner.completedAt,
    sourceCommit,
    sourceTree,
    ...commitBinding,
    securityRemediationChangePaths,
    securityRemediationChangeRecords,
    proofOriginChangePaths,
    proofToolChangePaths,
    previewSourceSetSha256: PREVIEW_SOURCE_SET_SHA256,
    ownerDecisionSha256: hashBindings.ownerDecision.sha256,
    providerPackageSha256: hashBindings.providerPackage.sha256,
    providerLockSha256: hashBindings.providerPackageLock.sha256,
    providerSbomSha256: hashBindings.providerSbom.sha256,
    providerAuditSha256: hashBindings.providerAudit.sha256,
    providerSecurityRemediationSha256:
      hashBindings.providerSecurityRemediation.sha256,
    resolvedFastUriVersion,
    advisory: fastUriSecurityAdvisory,
    activationPackageSha256: hashBindings.activationPackage.sha256,
    receiptContractSha256: hashBindings.receiptContract.sha256,
    originContract,
    transportContract: {
      schemaVersion: "wp13.12b-loopback-emulator-transport-v1",
      firestoreEmulatorBaseUrl,
      functionsEmulatorBaseUrl,
      requestOrigins: [
        firestoreEmulatorBaseUrl,
        functionsEmulatorBaseUrl,
      ],
      declaredOriginContactAttempts: 0,
      externalNetworkCalls: networkGuardEvidence.externalNetworkCalls,
      nodeNetworkGuardInitializedProcessCount:
        networkGuardEvidence.initializedProcessCount,
      nodeNetworkGuardObservedRoles: [
        ...networkGuardEvidence.observedRoles,
      ],
      networkObservationScope:
        "REPOSITORY_FETCH_GUARD_INHERITED_NODE_NETWORK_GUARD_AND_EXACT_EMULATOR_CONFIGURATION",
    },
    workingTreeDirty: false,
    environment: {
      operatingSystem: `${platform()} ${release()} ${arch()}`,
      node: process.version,
      java: javaVersion.split(/\r?\n/u)[0],
      firebaseCli: firebaseCliVersion,
      firestoreEmulator: expectedEmulatorVersion,
      demoProjectId: projectId,
      runtimePhase: "LOCAL_EMULATOR_PROOF",
      localEmulatorMode: true,
      offlineMode: true,
      firestoreEmulatorHost,
      functionsEmulatorHost,
    },
    artifact: {
      filename: basename(jar),
      archiveForm: "SELF_EXTRACTING_JAR",
      bytes: (await readFile(jar)).byteLength,
      sha256: expectedJarSha256,
      downloadMethod: "firebase setup:emulators:firestore",
      officialManifest:
        "firebase-tools@15.22.4 downloadableEmulatorInfo.json",
    },
    confirmationChallenge: challenge,
    hashBindings,
    repositoryHashes: {
      packageLock: await sha256File(join(repo, "package-lock.json")),
      providerPackageLock: await sha256File(join(
        repo,
        "provider/firebase/functions/package-lock.json",
      )),
      firebaseConfig: await sha256File(join(
        repo,
        "provider/firebase/firebase.json",
      )),
      functionsManifest: await sha256File(join(
        repo,
        "provider/firebase/functions/functions.yaml",
      )),
      firestoreRules: await sha256File(join(
        repo,
        "provider/firebase/firestore.rules",
      )),
      externalActivationAuthorityManifest:
        finalAuthority.manifestSha256,
    },
    commandsRun: [
      "firebase setup:emulators:firestore",
      `npm run provider:emulator:import -- --artifact ${basename(jar)} --sha256 ${expectedJarSha256}`,
      "npm run provider:emulator:proof -- --authorized-local-emulator-proof",
      "firebase emulators:exec --only firestore,functions --project demo-ludys-wp13-12b",
    ],
    proofResults: inner.checks,
    controlStates: {
      initial: {
        serviceHealth:
          inner.initialControlState.health.serviceHealth,
        stagingEnabled:
          inner.initialControlState.health.stagingEnabled,
        controlEpoch:
          inner.initialControlState.health.controlEpoch,
        controlDocumentExists:
          inner.initialControlState.control.exists,
      },
      enabled: {
        serviceHealth:
          inner.enabledControlState.health.serviceHealth,
        stagingEnabled:
          inner.enabledControlState.health.stagingEnabled,
        controlEpoch:
          inner.enabledControlState.health.controlEpoch,
        reasonCode:
          inner.enabledControlState.control.reasonCode,
      },
      final: {
        serviceHealth:
          inner.finalControlState.postClear.health.serviceHealth,
        stagingEnabled:
          inner.finalControlState.postClear.health.stagingEnabled,
        controlEpoch:
          inner.finalControlState.postClear.health.controlEpoch,
        controlDocumentExists:
          inner.finalControlState.postClear.control.exists,
      },
    },
    cleanupResult: {
      status: "PASS",
      sessionsRemaining: 0,
      capabilityGrantsRemaining: 0,
      emulatorProcessesRemaining: 0,
      temporaryFilesRemaining: 0,
      tombstonesVerifiedBeforeClear:
        inner.finalControlState.tombstonesPreservedBeforeClear,
      cloudWrites: 0,
      externalNetworkCalls: networkGuardEvidence.externalNetworkCalls,
    },
    roleDenialResult: inner.roleDenialResult,
    currentExternalState: externalState,
    receiptDraft: {
      status: "DRAFT_PENDING_OWNER_NONCE_CONFIRMATION",
      validationStatus: "NOT_YET_VALIDATED_RECEIPT",
      activationStatus: "NOT_EXTERNAL_ACTIVATION_RECEIPT",
      humanConfirmationPresent: false,
      nonceGenerationBlockedBy: [...externalState.blockers],
    },
    ruleCoverageSha256: inner.ruleCoverageSha256,
    firestoreDocumentCountsBeforeCleanup:
      inner.firestoreDocumentCountsBeforeCleanup,
    syntheticDataDeleted: inner.syntheticDataDeleted,
    cloudResourcesCreated: 0,
    cloudWrites: 0,
    externalNetworkCalls: networkGuardEvidence.externalNetworkCalls,
    providerLoginCount: 0,
    deploymentCountDuringProof: 0,
    iamChangeCount: 0,
    billingChanged: false,
    realParticipantData: false,
    humanConfirmation: {
      confirmed: false,
      status: nonceReady
        ? "AWAITING_EXPLICIT_HUMAN_CONFIRMATION"
        : "NONCE_NOT_GENERATED",
    },
    limitations: [
      "Local emulator proof is not physical two-device proof.",
      "Local emulator proof does not prove cloud IAM, billing, deployment protection or production readiness.",
      "External-network evidence is bounded to fail-closed repository-controlled request targets, exact loopback emulator configuration and post-run process/log checks; it is not an operating-system packet capture.",
      "The Functions Emulator reports its SDK compatibility warning because this narrow provider package uses Functions Framework entry points without firebase-functions or firebase-admin; the named ESM handlers were nevertheless invoked by the emulator.",
      ...(nonceReady ? [] : [
        "A v2 nonce was not generated because authoritative current external resource and deployment counts are unavailable without a separately authorized authenticated provider readback.",
      ]),
      "B8, student beta, recruitment, real data, production and WP13.12C remain blocked.",
    ],
  };
  const output = join(repo, ...EMULATOR_PROOF_PATH.split("/"));
  const outputBytes = Buffer.from(
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  validateEmulatorProofArtifact(result, outputBytes);
  const receiptPath =
    "release/wp13-12b/receipts/actual/"
    + `emulator-proof-receipt-${sourceCommit.slice(0, 12)}-v2.json`;
  let outputIdentity;
  try {
    outputIdentity = await writeExclusiveFsynced(output, outputBytes);
    await assertEmulatorConfirmationRecordPrecondition({
      repositoryRoot: repo,
      sourceCommit,
      sourceTree,
      proofBytes: outputBytes,
      receiptPath,
    });
    const postWriteAuthority = await assertCommittedAuthoritySnapshot(
      sourceCommit,
    );
    if (
      postWriteAuthority.manifestSha256
        !== initialAuthority.manifestSha256
      || postWriteAuthority.authorityFileCount
        !== initialAuthority.authorityFileCount
    ) throw new Error("EMULATOR_PROOF_AUTHORITY_CHANGED_DURING_WRITE");
    await assertEmulatorConfirmationRecordPrecondition({
      repositoryRoot: repo,
      sourceCommit,
      sourceTree,
      proofBytes: outputBytes,
      receiptPath,
    });
  } catch (error) {
    if (outputIdentity !== undefined) {
      try {
        await removeOwnedFileByIdentity(output, outputIdentity);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "EMULATOR_PROOF_POSTWRITE_ROLLBACK_FAILED",
        );
      }
    }
    throw error;
  }
  process.stdout.write(`${JSON.stringify({
    status: result.status,
    checksPassed: requiredChecks.length,
    output: EMULATOR_PROOF_PATH,
    cloudResourcesCreated: 0,
    cloudWrites: 0,
    syntheticDataDeleted: true,
    workingTreeDirty: false,
    nonceStatus: challenge.status,
    nonceBlockers: challenge.blockers ?? [],
  })}\n`);
}

async function runOuter() {
  if (!hasFlag("--authorized-local-emulator-proof")) {
    throw new Error("EXPLICIT_LOCAL_EMULATOR_PROOF_AUTHORIZATION_FLAG_REQUIRED");
  }
  return executePinnedGitPreflightBeforeEffects({
    sourcePrecondition: () => assertEmulatorProofSourcePrecondition(repo),
    proofToolBinding: assertProofToolCommitBinding,
    beginEffects: runOuterAfterGitPreflight,
  });
}

if (hasFlag("--inside-emulators")) {
  await runInsideEmulators();
} else {
  await runOuter();
}
