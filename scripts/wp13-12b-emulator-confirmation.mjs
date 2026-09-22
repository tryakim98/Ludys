import { createHash, timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  lstatSync,
  writeFileSync,
} from "node:fs";
import { lstat, mkdir, open, readFile, rm } from "node:fs/promises";
import {
  createRequire,
  syncBuiltinESMExports,
} from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createPinnedGitExecFile,
} from "./wp13-12b-pinned-git-toolchain.mjs";
import {
  canonicalGitDiffArguments,
  canonicalGitPathSetSha256,
} from "./wp13-12b-canonical-git-paths.mjs";
import {
  externalActivationChecksumManifestPath,
} from "./wp13-12b-external-activation-checksums.mjs";

export const EMULATOR_PR3_PURPOSE =
  "WP13_12B_PR3_LOCAL_EMULATOR_PROOF_ONLY";
export const EMULATOR_DEMO_PROJECT_ID = "demo-ludys-wp13-12b";
export const EMULATOR_PROOF_PATH =
  "artifacts/wp13-12b-actual-emulator-proof.json";
export const EMULATOR_CHALLENGE_SCHEMA =
  "wp13.12b-emulator-proof-challenge-v2";
export const EMULATOR_BINDING_SCHEMA =
  "wp13.12b-emulator-proof-binding-v2";
export const COMMIT_S_SHA =
  "b7b0af2b679a98b0e61ef17e606a5183a1de6323";
export const COMMIT_S_TREE =
  "a86137594062e696a00a547c55827b8d95719d6d";
export const COMMIT_S_PARENT =
  "fdb78846aae350c9418b8d50a1e46ec437f4ae2e";
export const COMMIT_T_SHA =
  "568d9f9e306075a81f6e4b243d3812507f97b230";
export const COMMIT_T_TREE =
  "64911ea615a1814acb1d03a2bb244152dc1fdee2";
export const COMMIT_U_SHA =
  "190fff88808bbafe605cdde4cfe9fe943f4543a4";
export const COMMIT_U_TREE =
  "6a9634f4e096b736f4699a209f2152e4e083127d";
export const COMMIT_V_SHA =
  "2e38ce83c9b4cfd70f515a31610ddf23374631bd";
export const COMMIT_V_TREE =
  "eb183ef860ee9cc16ef1167e56ea2c8a2de96cc2";
export const PINNED_GIT_ADAPTER_SHA256 =
  "0242641775cbf43b3c3d09276c6462d7b97de24cc2f13a32bf52c7bc8ed0dfbf";
export const PINNED_GIT_ADAPTER_GIT_BLOB =
  "a0c37fba2ab6625180bfa3691642acb38e86af29";
export const SECURITY_REMEDIATION_CHANGE_SET_SHA256 =
  "983d11050f1f299096797aea9a9179882411b355ffffc14ec5c98323e4f3b402";
export const SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS = Object.freeze([
  "artifacts/wp13-12b-functions-framework-proof.json",
  "artifacts/wp13-12b-provider-package.json",
  "provider/firebase/functions/package-lock.json",
  "provider/firebase/functions/tools/package-preflight.mjs",
  "release/wp13-12b/activation-handoff/operator-tasks.json",
  "release/wp13-12b/activation-handoff/receipt-contracts.json",
  "release/wp13-12b/artifact-checksums.sha256",
  "release/wp13-12b/external-activation/artifact-checksums.sha256",
  "release/wp13-12b/known-limitations.json",
  "release/wp13-12b/provider-audit.json",
  "release/wp13-12b/provider-license-inventory.json",
  "release/wp13-12b/provider-sbom.cdx.json",
  "release/wp13-12b/provider-security-remediation.json",
  "scripts/generate-provider-supply-chain.mjs",
  "scripts/generate-wp13-12b-staging.mjs",
  "scripts/provider-functions-runtime-test.mjs",
  "scripts/provider-supply-chain-check.mjs",
  "scripts/wp13-12b-external-activation-checksums.mjs",
  "scripts/wp13-12b-provider-package-contract.mjs",
].sort());
export const PROOF_ORIGIN_EXPECTED_CHANGE_PATHS = Object.freeze([
  "artifacts/wp13-12b-reproducible-build-result.json",
  "release/wp13-12b/activation-handoff/receipt-contracts.json",
  "release/wp13-12b/artifact-checksums.sha256",
  "release/wp13-12b/external-activation/artifact-checksums.sha256",
  "release/wp13-12b/receipts/templates/emulator_proof_receipt.json",
  "release/wp13-12b/reproducible-build.json",
  "scripts/classify-emulator-wp13-12b.mjs",
  "scripts/generate-wp13-12b-staging.mjs",
  "scripts/provider-functions-runtime-test.mjs",
  "scripts/run-wp13-12b-emulator-proof.mjs",
  "scripts/wp13-12b-activation-phase-gate-test.mjs",
  "scripts/wp13-12b-activation-phase-gate.mjs",
  "scripts/wp13-12b-emulator-confirmation-test.mjs",
  "scripts/wp13-12b-emulator-confirmation.mjs",
  "scripts/wp13-12b-emulator-proof-state-test.mjs",
  "src/core/staging-validation.ts",
  "tests/properties/staging-validation.test.ts",
].sort());
export const PINNED_GIT_COMPATIBILITY_EXPECTED_CHANGE_PATHS = Object.freeze([
  "artifacts/wp13-12b-baseline-verification.json",
  "artifacts/wp13-12b-reproducible-build-result.json",
  "release/wp13-12b/activation-handoff/receipt-contracts.json",
  "release/wp13-12b/artifact-checksums.sha256",
  "release/wp13-12b/external-activation/artifact-checksums.sha256",
  "release/wp13-12b/receipts/templates/emulator_proof_receipt.json",
  "release/wp13-12b/reproducible-build.json",
  "scripts/classify-emulator-wp13-12b.mjs",
  "scripts/generate-wp13-12b-staging.mjs",
  "scripts/run-wp13-12b-emulator-proof.mjs",
  "scripts/wp13-12b-activation-phase-gate-test.mjs",
  "scripts/wp13-12b-activation-phase-gate.mjs",
  "scripts/wp13-12b-canonical-git-paths.mjs",
  "scripts/wp13-12b-emulator-confirmation-test.mjs",
  "scripts/wp13-12b-emulator-confirmation.mjs",
  "scripts/wp13-12b-emulator-proof-state-test.mjs",
  "scripts/wp13-12b-external-activation-checksums.mjs",
  "scripts/wp13-12b-pinned-git-toolchain-test.mjs",
  "src/core/staging-validation.ts",
  "tests/properties/staging-validation.test.ts",
].sort());
export const PREVIEW_SOURCE_SET_SHA256 =
  "bf3ecfc58ae713bf91dd53f27b6ad5b9750a65b76bf5b73261526cae7db21d80";
export const EMULATOR_CHALLENGE_TTL_MS = 30 * 60 * 1000;
export const EMULATOR_NETWORK_GUARD_GLOBAL_KEY =
  "ludys.wp13.12b.emulatorNetworkGuard.v1";
export const REQUIRED_EMULATOR_PROOF_RESULTS = Object.freeze([
  "firestore_emulator",
  "functions_emulator",
  "emulator_environment_binding",
  "initial_staging_disabled",
  "explicit_proof_enable_transition",
  "enabled_staging_ready",
  "deny_by_default_rules",
  "no_direct_client_write",
  "capability_issuance",
  "child_capability",
  "adult_capability",
  "expiry",
  "wrong_role",
  "wrong_session",
  "stale_version",
  "stale_authority_generation",
  "duplicate_command",
  "wait",
  "help",
  "pause",
  "stop",
  "delayed_command_after_stop",
  "deletion",
  "tombstone",
  "reconnect_after_deletion",
  "kill_switch",
  "cached_capability_after_kill_switch",
  "child_adult_projection_isolation",
  "no_resurrection",
  "rollback_to_safe_disabled_state",
  "forbidden_data_classes_absent",
  "cleanup_after_proof",
  "final_staging_disabled",
  "emulator_processes_stopped",
  "cloud_guard",
  "capability_and_payload_absent_from_logs",
]);

const repo = fileURLToPath(new URL("..", import.meta.url));
const productionRepositoryRoot = resolve(repo);
const pinnedGitExecFile = createPinnedGitExecFile();
const FULL_GIT_SHA = /^[a-f0-9]{40}$/u;
const SHA_256 = /^[a-f0-9]{64}$/u;
const NONCE = /^[a-f0-9]{32}$/u;
const PROOF_RUN_ID = /^[a-f0-9]{32}$/u;
const LOOPBACK_HOST = /^127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const ALLOWED_EMULATOR_TRANSPORT_PORTS = Object.freeze(new Set([
  "5008",
  "8088",
]));
const FIRESTORE_EMULATOR_BASE_URL = "http://127.0.0.1:8088";
const FUNCTIONS_EMULATOR_BASE_URL = "http://127.0.0.1:5008";
const PRODUCTION_CREDENTIAL_ENVIRONMENT_NAMES = Object.freeze([
  "FIREBASE_TOKEN",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "CLOUDSDK_AUTH_ACCESS_TOKEN",
  "CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE",
  "GOOGLE_OAUTH_ACCESS_TOKEN",
  "GOOGLE_GHA_CREDS_PATH",
  "VERCEL_TOKEN",
]);
const NETWORK_OVERRIDE_ENVIRONMENT_NAMES = Object.freeze([
  "ALL_PROXY",
  "HTTPS_PROXY",
  "HTTP_PROXY",
]);

const networkGuardSymbol = Symbol.for(EMULATOR_NETWORK_GUARD_GLOBAL_KEY);

function normalizedNetworkHost(value) {
  if (typeof value !== "string") return "";
  const host = value.trim().toLowerCase();
  if (host.startsWith("[") && host.includes("]")) {
    return host.slice(1, host.indexOf("]"));
  }
  if (/^127\.0\.0\.1:[0-9]+$/u.test(host)) {
    return host.slice(0, host.lastIndexOf(":"));
  }
  return host;
}

function isPermittedLoopbackNetworkHost(value) {
  return [
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "0:0:0:0:0:0:0:1",
    "localhost",
  ].includes(
    normalizedNetworkHost(value),
  );
}

function requestTargetHost(input) {
  if (input instanceof URL) return input.hostname;
  if (typeof Request === "function" && input instanceof Request) {
    return new URL(input.url).hostname;
  }
  if (typeof input === "string") {
    try {
      return new URL(input).hostname;
    } catch {
      return undefined;
    }
  }
  if (input !== null && typeof input === "object") {
    if (typeof input.socketPath === "string") return undefined;
    if (typeof input.hostname === "string") return input.hostname;
    if (typeof input.host === "string") return input.host;
    if (typeof input.href === "string") {
      try {
        return new URL(input.href).hostname;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function socketTargetHost(args) {
  const first = args[0];
  if (Array.isArray(first)) return socketTargetHost(first);
  if (first !== null && typeof first === "object") {
    if (typeof first.path === "string") return undefined;
    return first.host ?? first.hostname ?? "localhost";
  }
  if (typeof first === "number") {
    return typeof args[1] === "string" ? args[1] : "localhost";
  }
  if (typeof first === "string") return undefined;
  return "localhost";
}

function networkGuardProcessRole() {
  const command = process.argv.join(" ").toLowerCase();
  if (command.includes("run-wp13-12b-emulator-proof.mjs")) {
    return "INNER_PROOF_RUNNER";
  }
  if (command.includes("firebase.js")) return "FIREBASE_CLI";
  if (
    process.env.FUNCTIONS_EMULATOR === "true"
    || typeof process.env.FUNCTION_TARGET === "string"
    || command.includes("functions-framework")
    || command.includes("functionsemulatorruntime")
  ) return "FUNCTIONS_WORKER";
  return "NODE_CHILD";
}

function installEmulatorNetworkGuard() {
  const directoryValue =
    process.env.LUDYS_EMULATOR_NETWORK_GUARD_DIRECTORY;
  if (directoryValue === undefined) return;
  if (
    !isAbsolute(directoryValue)
    || !lstatSync(directoryValue).isDirectory()
  ) throw new Error("EMULATOR_NETWORK_GUARD_DIRECTORY_INVALID");
  const directory = resolve(directoryValue);
  if (globalThis[networkGuardSymbol]?.active === true) return;
  const state = Object.freeze({
    active: true,
    directory,
    role: networkGuardProcessRole(),
  });
  Object.defineProperty(globalThis, networkGuardSymbol, {
    value: state,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  const initializedPath = join(
    directory,
    `${process.pid}-initialized.json`,
  );
  try {
    writeFileSync(initializedPath, `${JSON.stringify({
      schemaVersion: "wp13.12b-node-network-guard-init-v1",
      pid: process.pid,
      role: state.role,
      node: process.version,
    })}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const deny = (kind, host) => {
    const normalizedHost = normalizedNetworkHost(String(host ?? ""));
    if (isPermittedLoopbackNetworkHost(normalizedHost)) return;
    appendFileSync(
      join(directory, `${process.pid}-external-attempts.jsonl`),
      `${JSON.stringify({
        schemaVersion: "wp13.12b-node-network-guard-attempt-v1",
        pid: process.pid,
        role: state.role,
        kind,
        host: normalizedHost || "UNRESOLVED_EXTERNAL_TARGET",
      })}\n`,
      { encoding: "utf8", flag: "a", mode: 0o600 },
    );
    throw new Error(`EMULATOR_EXTERNAL_NETWORK_TARGET_FORBIDDEN:${kind}`);
  };
  const nodeRequire = createRequire(import.meta.url);
  const http = nodeRequire("node:http");
  const https = nodeRequire("node:https");
  const net = nodeRequire("node:net");
  const tls = nodeRequire("node:tls");
  const dns = nodeRequire("node:dns");
  const wrap = (target, name, hostFromArgs) => {
    const original = target[name];
    if (typeof original !== "function") return;
    target[name] = function guardedNetworkPrimitive(...args) {
      const host = hostFromArgs(args);
      if (host !== undefined) deny(name, host);
      return Reflect.apply(original, this, args);
    };
  };
  for (const module of [http, https]) {
    wrap(module, "request", (args) => requestTargetHost(args[0]));
    wrap(module, "get", (args) => requestTargetHost(args[0]));
  }
  wrap(net, "connect", socketTargetHost);
  wrap(net, "createConnection", socketTargetHost);
  wrap(net.Socket.prototype, "connect", socketTargetHost);
  wrap(tls, "connect", socketTargetHost);
  const dnsNames = [
    "lookup",
    "lookupService",
    "resolve",
    "resolve4",
    "resolve6",
    "resolveAny",
    "resolveCaa",
    "resolveCname",
    "resolveMx",
    "resolveNaptr",
    "resolveNs",
    "resolvePtr",
    "resolveSoa",
    "resolveSrv",
    "resolveTxt",
    "reverse",
  ];
  for (const name of dnsNames) {
    wrap(dns, name, (args) => args[0]);
    if (dns.promises !== undefined) {
      wrap(dns.promises, name, (args) => args[0]);
    }
  }
  if (typeof globalThis.fetch === "function") {
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init) => {
      deny("fetch", requestTargetHost(input));
      return originalFetch(input, init);
    };
  }
  if (typeof globalThis.WebSocket === "function") {
    const OriginalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = class GuardedWebSocket extends OriginalWebSocket {
      constructor(url, ...args) {
        deny("WebSocket", requestTargetHost(url));
        super(url, ...args);
      }
    };
  }
  syncBuiltinESMExports();
}

installEmulatorNetworkGuard();

export function emulatorNetworkGuardState() {
  return globalThis[networkGuardSymbol] ?? null;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitBlobObjectId(bytes) {
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.byteLength}\0`, "utf8"))
    .update(bytes)
    .digest("hex");
}

function exactUtcTimestamp(value) {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function exactStringArray(actual, expected) {
  return (
    Array.isArray(actual)
    && actual.length === expected.length
    && actual.every(
      (value, index) => value === expected[index],
    )
  );
}

export function canonicalSecurityRemediationGitDiffArguments(
  fromCommit,
  toCommit,
) {
  if (fromCommit !== COMMIT_T_SHA || toCommit !== COMMIT_U_SHA) {
    throw new Error("SECURITY_REMEDIATION_COMMIT_ORDER_INVALID");
  }
  return canonicalGitDiffArguments(fromCommit, toCommit);
}

export function assertSecurityRemediationCommitAncestry(commitUAncestry) {
  if (!exactStringArray(commitUAncestry, [COMMIT_U_SHA, COMMIT_T_SHA])) {
    throw new Error("SECURITY_REMEDIATION_COMMIT_PARENT_INVALID");
  }
  return true;
}

export function assertSecurityRemediationChangePaths(paths) {
  if (
    !exactStringArray(paths, SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS)
    || canonicalGitPathSetSha256(paths)
      !== SECURITY_REMEDIATION_CHANGE_SET_SHA256
  ) throw new Error("SECURITY_REMEDIATION_CHANGE_PATH_SET_INVALID");
  return Object.freeze([...paths]);
}

export async function executePinnedGitPreflightBeforeEffects({
  sourcePrecondition,
  proofToolBinding,
  beginEffects,
}) {
  if (
    typeof sourcePrecondition !== "function"
    || typeof proofToolBinding !== "function"
    || typeof beginEffects !== "function"
  ) throw new Error("PINNED_GIT_PREFLIGHT_FUNCTIONS_REQUIRED");
  const initialSource = await sourcePrecondition();
  const binding = proofToolBinding(
    initialSource?.sourceCommit,
    initialSource?.sourceTree,
  );
  return beginEffects(initialSource, binding);
}

function exactCommitIdentity(actual, expected) {
  if (!isRecord(actual) || !isRecord(expected)) return false;
  for (const field of [
    "commitS",
    "commitSTree",
    "commitT",
    "commitTTree",
    "commitU",
    "commitUTree",
    "commitV",
    "commitVTree",
    "commitW",
    "commitWTree",
    "sourceCommit",
    "sourceTree",
    "proofOriginCommit",
    "proofOriginTree",
    "proofToolCommit",
    "proofToolTree",
    "securityRemediationCommit",
    "securityRemediationTree",
    "providerSecurityRemediationCommit",
    "providerPackageCommit",
    "providerPackageLockCommit",
    "providerSbomCommit",
    "providerAuditCommit",
    "pinnedGitAdapterSha256",
    "pinnedGitAdapterGitBlob",
    "securityRemediationChangeSetSha256",
  ]) {
    if (actual[field] !== expected[field]) return false;
  }
  return exactStringArray(
    actual.orderedCommitChain,
    expected.orderedCommitChain,
  ) && exactStringArray(
    actual.proofToolCommitChain,
    expected.proofToolCommitChain,
  ) && exactGitDiffCommandContract(
    actual.gitDiffCommandContract,
    expected.gitDiffCommandContract,
  );
}

function exactGitDiffCommandContract(actual, expected) {
  return (
    isRecord(actual)
    && isRecord(expected)
    && actual.schemaVersion === expected.schemaVersion
    && actual.command === expected.command
    && actual.output === expected.output
    && actual.renameDetection === expected.renameDetection
    && exactStringArray(actual.arguments, expected.arguments)
  );
}

function validPinnedGitDiffCommandContract(value) {
  return exactGitDiffCommandContract(value, {
    schemaVersion: "wp13.12b-pinned-git-diff-contract-v1",
    command: "git diff",
    arguments: canonicalGitDiffArguments(COMMIT_T_SHA, COMMIT_U_SHA),
    output: "UTF8_NUL_TERMINATED_REPOSITORY_RELATIVE_POSIX_PATHS",
    renameDetection: "DISABLED",
  });
}

function exactLoopbackHost(value) {
  const match = typeof value === "string"
    ? LOOPBACK_HOST.exec(value)
    : null;
  const port = match === null ? 0 : Number(match[1]);
  return match !== null && port >= 1 && port <= 65_535;
}

export function buildSyntheticEmulatorOriginContract(proofRunId) {
  if (!PROOF_RUN_ID.test(String(proofRunId ?? ""))) {
    throw new Error("SYNTHETIC_EMULATOR_ORIGIN_PROOF_RUN_ID_INVALID");
  }
  const declaredPreviewOrigin =
    `https://ludys-wp13-12b-proof-${proofRunId.slice(0, 16)}.vercel.app`;
  const parsed = new URL(declaredPreviewOrigin);
  if (
    parsed.protocol !== "https:"
    || parsed.hostname
      !== `ludys-wp13-12b-proof-${proofRunId.slice(0, 16)}.vercel.app`
    || parsed.port !== ""
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.pathname !== "/"
    || parsed.search !== ""
    || parsed.hash !== ""
    || parsed.origin !== declaredPreviewOrigin
  ) throw new Error("SYNTHETIC_EMULATOR_ORIGIN_CONTRACT_INVALID");
  return Object.freeze({
    schemaVersion: "wp13.12b-synthetic-emulator-origin-v1",
    declaredPreviewOrigin,
    classification: "SYNTHETIC_EMULATOR_ORIGIN",
    deploymentStatus: "NOT_DEPLOYED",
    publicStatus: "NOT_PUBLIC",
    receiptStatus: "NOT_A_REAL_PREVIEW_RECEIPT",
    networkTargetStatus: "NOT_A_NETWORK_TARGET",
  });
}

function exactOriginContract(actual, expected) {
  return (
    isRecord(actual)
    && Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(
      ([name, value]) => actual[name] === value,
    )
  );
}

export function assertLoopbackEmulatorTransportUrl(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("LOOPBACK_EMULATOR_TRANSPORT_URL_INVALID");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("LOOPBACK_EMULATOR_TRANSPORT_URL_INVALID");
  }
  if (
    parsed.protocol !== "http:"
    || parsed.hostname !== "127.0.0.1"
    || !ALLOWED_EMULATOR_TRANSPORT_PORTS.has(parsed.port)
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.hash !== ""
    || parsed.href !== value
  ) throw new Error("LOOPBACK_EMULATOR_TRANSPORT_URL_INVALID");
  return parsed.href;
}

export function createLoopbackEmulatorFetch({
  fetchImpl,
  onRequest = () => {},
}) {
  if (typeof fetchImpl !== "function" || typeof onRequest !== "function") {
    throw new Error("LOOPBACK_EMULATOR_FETCH_CONFIGURATION_INVALID");
  }
  return async (input, init = {}) => {
    const url = assertLoopbackEmulatorTransportUrl(input);
    const parsed = new URL(url);
    const method = String(init.method ?? "GET").toUpperCase();
    onRequest(Object.freeze({
      method,
      url,
      origin: parsed.origin,
      pathname: parsed.pathname,
    }));
    return fetchImpl(url, {
      ...init,
      redirect: "error",
    });
  };
}

export function assertEmulatorProofEnvironmentBinding(input) {
  if (!isRecord(input)) {
    throw new Error("EMULATOR_PROOF_ENVIRONMENT_BINDING_INVALID");
  }
  if (
    input.projectId !== EMULATOR_DEMO_PROJECT_ID
    || input.googleCloudProject !== EMULATOR_DEMO_PROJECT_ID
    || !String(input.projectId).startsWith("demo-")
  ) throw new Error("CLOUD_PROJECT_ID_FORBIDDEN_FOR_EMULATOR_PROOF");
  if (
    input.localEmulatorMode !== true
    || input.offlineMode !== true
    || input.runtimePhase !== "LOCAL_EMULATOR_PROOF"
  ) throw new Error("LOCAL_EMULATOR_MODE_BINDING_REQUIRED");
  if (
    !exactLoopbackHost(input.firestoreEmulatorHost)
    || !exactLoopbackHost(input.functionsEmulatorHost)
  ) throw new Error("EXACT_LOOPBACK_EMULATOR_HOST_REQUIRED");
  if (
    input.cloudEndpointUsed !== false
    || input.cloudWrites !== 0
    || input.providerLoginCount !== 0
    || input.deploymentCount !== 0
    || input.iamChangeCount !== 0
    || input.cloudResourcesCreated !== 0
  ) throw new Error("EMULATOR_PROOF_CLOUD_GUARD_VIOLATED");
  const environment = isRecord(input.credentialEnvironment)
    ? input.credentialEnvironment
    : {};
  const normalized = new Map(Object.entries(environment).map(
    ([name, value]) => [name.toUpperCase(), value],
  ));
  for (const name of [
    ...PRODUCTION_CREDENTIAL_ENVIRONMENT_NAMES,
    ...NETWORK_OVERRIDE_ENVIRONMENT_NAMES,
  ]) {
    const value = normalized.get(name);
    if (typeof value === "string" && value.length > 0) {
      throw new Error(`EMULATOR_PROOF_AMBIENT_CREDENTIAL_OR_NETWORK_OVERRIDE:${name}`);
    }
  }
  if (input.applicationDefaultCredentialsPresent === true) {
    throw new Error("EMULATOR_PROOF_APPLICATION_DEFAULT_CREDENTIALS_FORBIDDEN");
  }
  return Object.freeze({
    projectId: input.projectId,
    firestoreEmulatorHost: input.firestoreEmulatorHost,
    functionsEmulatorHost: input.functionsEmulatorHost,
    cloudWrites: 0,
    providerLoginCount: 0,
    deploymentCount: 0,
    iamChangeCount: 0,
    cloudResourcesCreated: 0,
  });
}

function assertLocalHealthEnvelope(health) {
  if (
    !isRecord(health)
    || health.region !== "europe-north1"
    || health.runtimePhase !== "LOCAL_EMULATOR_PROOF"
    || health.providerActivation !== "LOCAL_EMULATOR_ONLY"
    || health.dataScope !== "SYNTHETIC_ONLY_NO_PARTICIPANT_DATA"
    || health.studentBeta !== "NOT_AUTHORIZED"
    || health.production !== "NOT_AUTHORIZED"
    || health.wp13_12c !== "BLOCKED"
    || health.ingressReady !== true
  ) throw new Error("EMULATOR_PROOF_HEALTH_ENVELOPE_INVALID");
}

function assertZeroInitialInventory(inventory) {
  if (
    !isRecord(inventory)
    || inventory.syntheticSessions !== 0
    || inventory.syntheticCapabilityGrants !== 0
  ) throw new Error("ACTIVE_SYNTHETIC_AUTHORITY_AT_PROOF_START");
  if (inventory.syntheticSessionTombstones !== 0) {
    throw new Error("TOMBSTONE_CONFLICT_AT_PROOF_START");
  }
  if (
    !Array.isArray(inventory.authorityGenerations)
    || inventory.authorityGenerations.length !== 0
  ) throw new Error("AUTHORITY_GENERATION_DRIFT_AT_PROOF_START");
}

export function assertInitialEmulatorProofState(snapshot) {
  if (!isRecord(snapshot) || !isRecord(snapshot.health)) {
    throw new Error("INITIAL_EMULATOR_PROOF_STATE_INVALID");
  }
  const { health } = snapshot;
  assertLocalHealthEnvelope(health);
  if (health.serviceHealth === "READY" || health.stagingEnabled === true) {
    throw new Error("STAGING_UNEXPECTEDLY_ENABLED_AT_PROOF_START");
  }
  if (health.serviceHealth !== "READY_DISABLED_BY_DEFAULT") {
    throw new Error("INITIAL_STAGING_STATUS_INVALID");
  }
  if (health.stagingEnabled !== false) {
    throw new Error("INITIAL_STAGING_DISABLED_FLAG_INVALID");
  }
  if (health.controlEpoch !== 1) {
    throw new Error("STALE_CONTROL_EPOCH_AT_PROOF_START");
  }
  const control = snapshot.control;
  if (!isRecord(control)) {
    throw new Error("INITIAL_CONTROL_STATE_INVALID");
  }
  if (
    control.exists === true
    && typeof control.reasonCode === "string"
    && control.reasonCode.includes("KILL_SWITCH")
  ) throw new Error("KILL_SWITCH_ACTIVE_AT_PROOF_START");
  if (
    control.exists !== false
    || control.controlEpoch !== 1
    || control.stagingEnabled !== false
    || control.reasonCode !== "DISABLED_BY_DEFAULT"
  ) throw new Error("INITIAL_CONTROL_DOCUMENT_OR_DEFAULT_INVALID");
  assertZeroInitialInventory(snapshot.inventory);
  return Object.freeze(structuredClone(snapshot));
}

export function assertEnabledEmulatorProofState(
  snapshot,
  { expectedControlEpoch, expectedReasonCode, proofRunId },
) {
  if (!PROOF_RUN_ID.test(String(proofRunId ?? ""))) {
    throw new Error("EMULATOR_PROOF_RUN_ID_INVALID");
  }
  if (
    !isRecord(snapshot)
    || !isRecord(snapshot.health)
    || !isRecord(snapshot.control)
  ) throw new Error("ENABLED_EMULATOR_PROOF_STATE_INVALID");
  assertLocalHealthEnvelope(snapshot.health);
  if (
    snapshot.health.serviceHealth !== "READY"
    || snapshot.health.stagingEnabled !== true
    || snapshot.health.controlEpoch !== expectedControlEpoch
    || snapshot.control.exists !== true
    || snapshot.control.stagingEnabled !== true
    || snapshot.control.controlEpoch !== expectedControlEpoch
    || snapshot.control.reasonCode !== expectedReasonCode
    || !String(expectedReasonCode).endsWith(
      proofRunId.slice(0, 16).toUpperCase(),
    )
  ) throw new Error("EXPLICIT_EMULATOR_PROOF_ENABLE_TRANSITION_INVALID");
  return Object.freeze(structuredClone(snapshot));
}

export function assertFinalEmulatorProofState(snapshot) {
  if (
    !isRecord(snapshot)
    || !isRecord(snapshot.disabled)
    || !isRecord(snapshot.postClear)
  ) throw new Error("FINAL_EMULATOR_PROOF_STATE_INVALID");
  for (const phase of [snapshot.disabled, snapshot.postClear]) {
    assertLocalHealthEnvelope(phase.health);
    if (
      phase.health.serviceHealth !== "READY_DISABLED_BY_DEFAULT"
      || phase.health.stagingEnabled !== false
      || phase.inventory.syntheticSessions !== 0
      || phase.inventory.syntheticCapabilityGrants !== 0
    ) throw new Error("FINAL_STAGING_NOT_DISABLED_AND_AUTHORITY_FREE");
  }
  if (
    snapshot.disabled.control.exists !== true
    || snapshot.disabled.control.stagingEnabled !== false
    || !Number.isSafeInteger(snapshot.disabled.control.controlEpoch)
    || snapshot.disabled.control.controlEpoch <= 1
    || snapshot.disabled.health.controlEpoch
      !== snapshot.disabled.control.controlEpoch
    || snapshot.disabled.control.reasonCode
      !== "LOCAL_PROOF_FINAL_CLEANUP"
    || snapshot.tombstonesPreservedBeforeClear !== true
    || snapshot.postClear.control.exists !== false
    || snapshot.postClear.control.controlEpoch !== 1
    || snapshot.postClear.health.controlEpoch !== 1
    || snapshot.postClear.control.reasonCode !== "DISABLED_BY_DEFAULT"
    || snapshot.postClear.inventory.syntheticSessionTombstones !== 0
    || snapshot.postClear.inventory.syntheticStagingControl !== 0
    || snapshot.cloudWrites !== 0
  ) throw new Error("EMULATOR_PROOF_CLEANUP_CONTRACT_INVALID");
  return Object.freeze(structuredClone(snapshot));
}

export async function executeEmulatorProofLifecycle({
  operation,
  cleanup,
  stopProcesses,
}) {
  if (
    typeof operation !== "function"
    || typeof cleanup !== "function"
    || typeof stopProcesses !== "function"
  ) throw new Error("EMULATOR_PROOF_LIFECYCLE_CALLBACK_INVALID");
  let operationResult;
  let operationError;
  try {
    operationResult = await operation();
  } catch (error) {
    operationError = error;
  }
  let cleanupResult;
  let cleanupError;
  try {
    cleanupResult = await cleanup({ operationError });
  } catch (error) {
    cleanupError = error;
  }
  let stopError;
  try {
    await stopProcesses();
  } catch (error) {
    stopError = error;
  }
  if (cleanupError !== undefined || stopError !== undefined) {
    throw new AggregateError(
      [operationError, cleanupError, stopError].filter(Boolean),
      "EMULATOR_PROOF_CLEANUP_OR_PROCESS_STOP_FAILED",
    );
  }
  if (operationError !== undefined) throw operationError;
  return Object.freeze({ operationResult, cleanupResult });
}

function isRepositoryRelativePath(path) {
  return typeof path === "string"
    && path.length > 0
    && !isAbsolute(path)
    && !path.startsWith("/")
    && !path.startsWith("\\")
    && !path.includes("\\")
    && !path.includes("\0")
    && !path.split("/").includes("..")
    && !path.split("/").includes(".git");
}

function repositoryPath(root, path) {
  if (!isRepositoryRelativePath(path)) {
    throw new Error("EMULATOR_PROOF_PATH_MUST_BE_REPOSITORY_RELATIVE");
  }
  const target = resolve(root, path);
  const fromRoot = relative(root, target);
  if (fromRoot === "" || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error("EMULATOR_PROOF_PATH_OUTSIDE_REPOSITORY");
  }
  return target;
}

function gitExecFileForRoot(root) {
  return resolve(root) === productionRepositoryRoot
    ? pinnedGitExecFile
    : execFileSync;
}

function git(root, args) {
  return gitExecFileForRoot(root)(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
}

function gitBytes(root, args) {
  return Buffer.from(gitExecFileForRoot(root)(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
    {
      cwd: root,
      encoding: "buffer",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    },
  ));
}

async function pathMetadataOrNull(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function removeOwnedEvidenceFile(path, identity) {
  const metadata = await lstat(path);
  if (
    !metadata.isFile()
    || metadata.isSymbolicLink()
    || metadata.dev !== identity.dev
    || metadata.ino !== identity.ino
  ) throw new Error("EMULATOR_EVIDENCE_FILE_IDENTITY_CHANGED");
  await rm(path);
  if (await pathMetadataOrNull(path) !== null) {
    throw new Error("EMULATOR_EVIDENCE_FILE_ROLLBACK_FAILED");
  }
}

function assertNoMaskedGitIndexEntries(root) {
  const entries = gitBytes(root, ["ls-files", "-v", "-z"])
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  if (entries.some((entry) => entry.length < 3 || entry.slice(0, 2) !== "H ")) {
    throw new Error("EMULATOR_EVIDENCE_GIT_INDEX_MASKING_FORBIDDEN");
  }
}

function assertPathAbsentFromSourceAndIndex(root, sourceCommit, path) {
  if (git(root, ["ls-files", "--stage", "--", path]) !== "") {
    throw new Error(`EMULATOR_EVIDENCE_PATH_ALREADY_TRACKED:${path}`);
  }
  const sourceEntries = gitBytes(
    root,
    ["ls-tree", "-z", "--name-only", sourceCommit, "--", path],
  ).toString("utf8").split("\0").filter(Boolean);
  if (sourceEntries.length !== 0) {
    throw new Error(`EMULATOR_EVIDENCE_PATH_ALREADY_IN_SOURCE:${path}`);
  }
}

export async function assertEmulatorProofSourcePrecondition(
  repositoryRoot = repo,
) {
  const root = resolve(repositoryRoot);
  const sourceCommit = git(root, ["rev-parse", "HEAD"]);
  const sourceTree = git(root, ["rev-parse", "HEAD^{tree}"]);
  if (!FULL_GIT_SHA.test(sourceCommit) || !FULL_GIT_SHA.test(sourceTree)) {
    throw new Error("EMULATOR_PROOF_SOURCE_COMMIT_OR_TREE_INVALID");
  }
  assertPathAbsentFromSourceAndIndex(root, sourceCommit, EMULATOR_PROOF_PATH);
  if (
    await pathMetadataOrNull(repositoryPath(root, EMULATOR_PROOF_PATH))
      !== null
  ) {
    throw new Error("CANONICAL_EMULATOR_PROOF_MUST_BE_ABSENT_BEFORE_RUN");
  }
  assertNoMaskedGitIndexEntries(root);
  if (
    gitBytes(
      root,
      ["status", "--porcelain=v2", "-z", "--untracked-files=all"],
    ).byteLength !== 0
  ) {
    throw new Error("EMULATOR_PROOF_SOURCE_REPOSITORY_MUST_BE_CLEAN");
  }
  return Object.freeze({ repositoryRoot: root, sourceCommit, sourceTree });
}

export async function assertEmulatorConfirmationRecordPrecondition({
  repositoryRoot = repo,
  sourceCommit,
  sourceTree,
  proofBytes,
  receiptPath,
}) {
  const root = resolve(repositoryRoot);
  if (
    !FULL_GIT_SHA.test(String(sourceCommit ?? ""))
    || !FULL_GIT_SHA.test(String(sourceTree ?? ""))
    || !Buffer.isBuffer(proofBytes)
    || proofBytes.byteLength === 0
  ) throw new Error("EMULATOR_CONFIRMATION_SOURCE_BINDING_INVALID");
  repositoryPath(root, receiptPath);
  if (
    git(root, ["rev-parse", "HEAD"]) !== sourceCommit
    || git(root, ["rev-parse", "HEAD^{tree}"]) !== sourceTree
  ) throw new Error("EMULATOR_PROOF_IS_NOT_BOUND_TO_CURRENT_HEAD");
  assertPathAbsentFromSourceAndIndex(root, sourceCommit, EMULATOR_PROOF_PATH);
  assertPathAbsentFromSourceAndIndex(root, sourceCommit, receiptPath);
  const proofTarget = repositoryPath(root, EMULATOR_PROOF_PATH);
  const proofMetadata = await pathMetadataOrNull(proofTarget);
  if (
    proofMetadata === null
    || !proofMetadata.isFile()
    || proofMetadata.isSymbolicLink()
    || !(await readFile(proofTarget)).equals(proofBytes)
  ) throw new Error("CANONICAL_EMULATOR_PROOF_BYTES_CHANGED");
  if (await pathMetadataOrNull(repositoryPath(root, receiptPath)) !== null) {
    throw new Error("EMULATOR_CONFIRMATION_RECEIPT_ALREADY_EXISTS");
  }
  assertNoMaskedGitIndexEntries(root);
  const statusEntries = gitBytes(
    root,
    ["status", "--porcelain=v2", "-z", "--untracked-files=all"],
  ).toString("utf8").split("\0").filter(Boolean);
  if (
    statusEntries.length !== 1
    || statusEntries[0] !== `? ${EMULATOR_PROOF_PATH}`
  ) {
    throw new Error(
      "EMULATOR_CONFIRMATION_REQUIRES_EXACT_PROOF_ONLY_WORKTREE",
    );
  }
  return Object.freeze({ repositoryRoot: root, sourceCommit, sourceTree });
}

export async function assertEmulatorBindingSourceBytes({
  repositoryRoot = repo,
  binding,
  firestoreRulesSha256,
}) {
  const root = resolve(repositoryRoot);
  if (!isRecord(binding)) {
    throw new Error("EMULATOR_CONFIRMATION_BINDING_INVALID");
  }
  const sources = [
    {
      name: "ownerAuthorizationBytes",
      path:
        "release/wp13-12b/external-activation/owner-authorization.json",
      commit: binding.commitS,
      expectedSha256: binding.ownerDecisionSha256,
    },
    {
      name: "providerSecurityRemediationBytes",
      path: "release/wp13-12b/provider-security-remediation.json",
      commit: binding.providerSecurityRemediationCommit,
      expectedSha256: binding.providerSecurityRemediationSha256,
    },
    {
      name: "providerPackageBytes",
      path: "artifacts/wp13-12b-provider-package.json",
      commit: binding.providerPackageCommit,
      expectedSha256: binding.providerPackageSha256,
    },
    {
      name: "providerPackageLockBytes",
      path: "provider/firebase/functions/package-lock.json",
      commit: binding.providerPackageLockCommit,
      expectedSha256: binding.providerLockSha256,
    },
    {
      name: "providerSbomBytes",
      path: "release/wp13-12b/provider-sbom.cdx.json",
      commit: binding.providerSbomCommit,
      expectedSha256: binding.providerSbomSha256,
    },
    {
      name: "providerAuditBytes",
      path: "release/wp13-12b/provider-audit.json",
      commit: binding.providerAuditCommit,
      expectedSha256: binding.providerAuditSha256,
    },
    {
      name: "activationPackageBytes",
      path: externalActivationChecksumManifestPath,
      commit: binding.proofToolCommit,
      expectedSha256: binding.activationPackageSha256,
    },
    {
      name: "receiptContractBytes",
      path: "release/wp13-12b/activation-handoff/receipt-contracts.json",
      commit: binding.proofToolCommit,
      expectedSha256: binding.receiptContractSha256,
    },
    {
      name: "proofRunnerBytes",
      path: "scripts/run-wp13-12b-emulator-proof.mjs",
      commit: binding.proofToolCommit,
      expectedSha256: binding.proofRunnerSha256,
    },
    {
      name: "firestoreRulesBytes",
      path: "provider/firebase/firestore.rules",
      commit: binding.proofToolCommit,
      expectedSha256: firestoreRulesSha256,
    },
  ];
  const sourceBytes = {};
  for (const source of sources) {
    if (
      !FULL_GIT_SHA.test(String(source.commit ?? ""))
      || !SHA_256.test(String(source.expectedSha256 ?? ""))
    ) throw new Error("EMULATOR_CONFIRMATION_SOURCE_HASH_INVALID");
    const workingBytes = await readFile(repositoryPath(root, source.path));
    const committedBytes = gitBytes(
      root,
      ["show", `${source.commit}:${source.path}`],
    );
    if (
      !workingBytes.equals(committedBytes)
      || sha256(committedBytes) !== source.expectedSha256
    ) throw new Error(
      `EMULATOR_CONFIRMATION_SOURCE_BYTES_MISMATCH:${source.path}`,
    );
    sourceBytes[source.name] = Buffer.from(committedBytes);
  }
  return Object.freeze(sourceBytes);
}

async function assertEmulatorEvidencePairPostcondition({
  repositoryRoot,
  sourceCommit,
  sourceTree,
  proofBytes,
  receiptPath,
  receiptBytes,
}) {
  const root = resolve(repositoryRoot);
  if (
    git(root, ["rev-parse", "HEAD"]) !== sourceCommit
    || git(root, ["rev-parse", "HEAD^{tree}"]) !== sourceTree
  ) throw new Error("EMULATOR_PROOF_IS_NOT_BOUND_TO_CURRENT_HEAD");
  assertPathAbsentFromSourceAndIndex(root, sourceCommit, EMULATOR_PROOF_PATH);
  assertPathAbsentFromSourceAndIndex(root, sourceCommit, receiptPath);
  for (const [path, expectedBytes] of [
    [EMULATOR_PROOF_PATH, proofBytes],
    [receiptPath, receiptBytes],
  ]) {
    const target = repositoryPath(root, path);
    const metadata = await pathMetadataOrNull(target);
    if (
      metadata === null
      || !metadata.isFile()
      || metadata.isSymbolicLink()
      || !(await readFile(target)).equals(expectedBytes)
    ) throw new Error("EMULATOR_EVIDENCE_PAIR_BYTES_CHANGED");
  }
  assertNoMaskedGitIndexEntries(root);
  const statusEntries = gitBytes(
    root,
    ["status", "--porcelain=v2", "-z", "--untracked-files=all"],
  ).toString("utf8").split("\0").filter(Boolean).sort();
  const expectedEntries = [
    `? ${EMULATOR_PROOF_PATH}`,
    `? ${receiptPath}`,
  ].sort();
  if (
    statusEntries.length !== expectedEntries.length
    || statusEntries.some(
      (entry, index) => entry !== expectedEntries[index],
    )
  ) throw new Error("EMULATOR_CONFIRMATION_EVIDENCE_PAIR_NOT_EXACT");
}

function exactConfirmation(binding) {
  return [
    "BEKREFT_WP13_12B_V2_NONCE",
    `nonce=${binding.nonce}`,
    `commitS=${binding.commitS}`,
    `commitSTree=${binding.commitSTree}`,
    `commitT=${binding.commitT}`,
    `commitTTree=${binding.commitTTree}`,
    `commitU=${binding.commitU}`,
    `commitUTree=${binding.commitUTree}`,
    `commitV=${binding.commitV}`,
    `commitVTree=${binding.commitVTree}`,
    `commitW=${binding.commitW}`,
    `commitWTree=${binding.commitWTree}`,
    `orderedCommitChain=${binding.orderedCommitChain.join(",")}`,
    `proofOriginCommit=${binding.proofOriginCommit}`,
    `proofOriginTree=${binding.proofOriginTree}`,
    `proofToolCommitChain=${binding.proofToolCommitChain.join(",")}`,
    `proofToolCommit=${binding.proofToolCommit}`,
    `proofToolTree=${binding.proofToolTree}`,
    `securityRemediationCommit=${binding.securityRemediationCommit}`,
    `securityRemediationTree=${binding.securityRemediationTree}`,
    `providerSecurityRemediationCommit=${binding.providerSecurityRemediationCommit}`,
    `providerPackageCommit=${binding.providerPackageCommit}`,
    `providerPackageLockCommit=${binding.providerPackageLockCommit}`,
    `providerSbomCommit=${binding.providerSbomCommit}`,
    `providerAuditCommit=${binding.providerAuditCommit}`,
    `proofRunnerSha256=${binding.proofRunnerSha256}`,
    `proofRunnerGitBlob=${binding.proofRunnerGitBlob}`,
    `pinnedGitAdapterSha256=${binding.pinnedGitAdapterSha256}`,
    `pinnedGitAdapterGitBlob=${binding.pinnedGitAdapterGitBlob}`,
    `securityRemediationChangeSetSha256=${binding.securityRemediationChangeSetSha256}`,
    `previewSourceSetSha256=${binding.previewSourceSetSha256}`,
    `freshEmulatorProofSha256=${binding.proofSha256}`,
    `ownerDecisionSha256=${binding.ownerDecisionSha256}`,
    `providerSecurityRemediationSha256=${binding.providerSecurityRemediationSha256}`,
    `providerPackageSha256=${binding.providerPackageSha256}`,
    `providerLockSha256=${binding.providerLockSha256}`,
    `providerSbomSha256=${binding.providerSbomSha256}`,
    `providerAuditSha256=${binding.providerAuditSha256}`,
    `resolvedFastUriVersion=${binding.resolvedFastUriVersion}`,
    `advisory=${binding.advisory}`,
    `activationPackageSha256=${binding.activationPackageSha256}`,
    `receiptContractSha256=${binding.receiptContractSha256}`,
    `generatedAt=${binding.generatedAt}`,
    `expiresAt=${binding.expiresAt}`,
    `cloudResourceCount=${binding.cloudResourceCount}`,
    `deploymentCount=${binding.deploymentCount}`,
    `validatedReceiptCount=${binding.validatedReceiptCount}`,
    `purpose=${binding.purpose}`,
    `jarSha256=${binding.jarSha256}`,
    `demoProjectId=${binding.demoProjectId}`,
  ].join("; ");
}

function assertArtifactHashBinding(
  binding,
  { path, commit, errorCode },
) {
  if (
    !isRecord(binding)
    || binding.path !== path
    || binding.commit !== commit
    || !SHA_256.test(String(binding.sha256 ?? ""))
  ) throw new Error(errorCode);
}

export function validateEmulatorProofArtifact(proof, proofBytes) {
  if (!isRecord(proof)) throw new Error("EMULATOR_PROOF_INVALID");
  if (!Buffer.isBuffer(proofBytes) || proofBytes.byteLength === 0) {
    throw new Error("EMULATOR_PROOF_BYTES_INVALID");
  }
  if (proof.schemaVersion !== "wp13.12b-actual-emulator-proof-v2") {
    throw new Error("EMULATOR_PROOF_SCHEMA_NOT_V2");
  }
  if (
    ![
      "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_AWAITING_HUMAN_CONFIRMATION",
      "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_NONCE_BLOCKED_BY_CURRENT_EXTERNAL_COUNTS",
    ].includes(proof.status)
    || proof.workingTreeDirty !== false
    || proof.cloudResourcesCreated !== 0
    || proof.cloudWrites !== 0
    || proof.providerLoginCount !== 0
    || proof.deploymentCountDuringProof !== 0
    || proof.iamChangeCount !== 0
    || proof.syntheticDataDeleted !== true
    || proof.realParticipantData !== false
  ) throw new Error("EMULATOR_PROOF_NOT_CLEAN_COMPLETE_AND_SYNTHETIC");
  if (!FULL_GIT_SHA.test(String(proof.sourceCommit ?? ""))) {
    throw new Error("EMULATOR_PROOF_SOURCE_COMMIT_INVALID");
  }
  if (!FULL_GIT_SHA.test(String(proof.sourceTree ?? ""))) {
    throw new Error("EMULATOR_PROOF_SOURCE_TREE_INVALID");
  }
  if (
    proof.commitS !== COMMIT_S_SHA
    || proof.commitSTree !== COMMIT_S_TREE
    || proof.commitT !== COMMIT_T_SHA
    || proof.commitTTree !== COMMIT_T_TREE
    || proof.commitU !== COMMIT_U_SHA
    || proof.commitUTree !== COMMIT_U_TREE
    || proof.commitV !== COMMIT_V_SHA
    || proof.commitVTree !== COMMIT_V_TREE
    || proof.commitW !== proof.sourceCommit
    || proof.commitWTree !== proof.sourceTree
    || proof.proofOriginCommit !== COMMIT_V_SHA
    || proof.proofOriginTree !== COMMIT_V_TREE
    || proof.securityRemediationCommit !== COMMIT_U_SHA
    || proof.securityRemediationTree !== COMMIT_U_TREE
    || proof.providerSecurityRemediationCommit !== COMMIT_U_SHA
    || proof.providerPackageCommit !== COMMIT_U_SHA
    || proof.providerPackageLockCommit !== COMMIT_U_SHA
    || proof.providerSbomCommit !== COMMIT_U_SHA
    || proof.providerAuditCommit !== COMMIT_U_SHA
    || proof.proofToolCommit !== proof.sourceCommit
    || proof.proofToolTree !== proof.sourceTree
    || new Set([
      proof.commitS,
      proof.commitT,
      proof.commitU,
      proof.commitV,
      proof.commitW,
    ]).size !== 5
    || !exactStringArray(
      proof.orderedCommitChain,
      [
        COMMIT_S_SHA,
        COMMIT_T_SHA,
        COMMIT_U_SHA,
        COMMIT_V_SHA,
        proof.sourceCommit,
      ],
    )
    || !exactStringArray(
      proof.proofToolCommitChain,
      [COMMIT_T_SHA, COMMIT_U_SHA, COMMIT_V_SHA, proof.sourceCommit],
    )
    || !SHA_256.test(String(proof.proofRunnerSha256 ?? ""))
    || !FULL_GIT_SHA.test(String(proof.proofRunnerGitBlob ?? ""))
    || proof.pinnedGitAdapterSha256 !== PINNED_GIT_ADAPTER_SHA256
    || proof.pinnedGitAdapterGitBlob !== PINNED_GIT_ADAPTER_GIT_BLOB
    || proof.securityRemediationChangeSetSha256
      !== SECURITY_REMEDIATION_CHANGE_SET_SHA256
    || !validPinnedGitDiffCommandContract(proof.gitDiffCommandContract)
    || proof.previewSourceSetSha256 !== PREVIEW_SOURCE_SET_SHA256
    || !PROOF_RUN_ID.test(String(proof.proofRunId ?? ""))
    || !exactUtcTimestamp(proof.startedAt)
    || !exactUtcTimestamp(proof.completedAt)
    || Date.parse(proof.startedAt) > Date.parse(proof.completedAt)
  ) throw new Error("EMULATOR_PROOF_DUAL_COMMIT_OR_RUN_BINDING_INVALID");
  const expectedOriginContract = buildSyntheticEmulatorOriginContract(
    proof.proofRunId,
  );
  if (
    !exactOriginContract(proof.originContract, expectedOriginContract)
    || proof.transportContract?.schemaVersion
      !== "wp13.12b-loopback-emulator-transport-v1"
    || proof.transportContract?.firestoreEmulatorBaseUrl
      !== FIRESTORE_EMULATOR_BASE_URL
    || proof.transportContract?.functionsEmulatorBaseUrl
      !== FUNCTIONS_EMULATOR_BASE_URL
    || !exactStringArray(
      proof.transportContract?.requestOrigins,
      [FIRESTORE_EMULATOR_BASE_URL, FUNCTIONS_EMULATOR_BASE_URL],
    )
    || proof.transportContract?.declaredOriginContactAttempts !== 0
    || proof.transportContract?.externalNetworkCalls !== 0
    || !Number.isSafeInteger(
      proof.transportContract?.nodeNetworkGuardInitializedProcessCount,
    )
    || proof.transportContract.nodeNetworkGuardInitializedProcessCount < 3
    || !Array.isArray(
      proof.transportContract?.nodeNetworkGuardObservedRoles,
    )
    || new Set(proof.transportContract.nodeNetworkGuardObservedRoles).size
      !== proof.transportContract.nodeNetworkGuardObservedRoles.length
    || proof.transportContract.nodeNetworkGuardObservedRoles.some(
      (role) => ![
        "FIREBASE_CLI",
        "FUNCTIONS_WORKER",
        "INNER_PROOF_RUNNER",
        "NODE_CHILD",
      ].includes(role),
    )
    || ![
      "FIREBASE_CLI",
      "FUNCTIONS_WORKER",
      "INNER_PROOF_RUNNER",
    ].every(
      (role) => proof.transportContract.nodeNetworkGuardObservedRoles
        .includes(role),
    )
    || !exactStringArray(
      proof.transportContract.nodeNetworkGuardObservedRoles,
      [...proof.transportContract.nodeNetworkGuardObservedRoles].sort(),
    )
    || proof.transportContract?.networkObservationScope
      !== "REPOSITORY_FETCH_GUARD_INHERITED_NODE_NETWORK_GUARD_AND_EXACT_EMULATOR_CONFIGURATION"
    || proof.externalNetworkCalls !== 0
    || JSON.stringify(proof).split(
      expectedOriginContract.declaredPreviewOrigin,
    ).length !== 2
  ) throw new Error("EMULATOR_PROOF_ORIGIN_OR_TRANSPORT_CONTRACT_INVALID");
  if (
    !exactStringArray(
      proof.securityRemediationChangePaths,
      SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS,
    )
    || canonicalGitPathSetSha256(proof.securityRemediationChangePaths)
      !== SECURITY_REMEDIATION_CHANGE_SET_SHA256
    || !Array.isArray(proof.securityRemediationChangeRecords)
    || proof.securityRemediationChangeRecords.length
      !== SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS.length
    || proof.securityRemediationChangeRecords.some((record, index) =>
      !isRecord(record)
      || record.path !== SECURITY_REMEDIATION_EXPECTED_CHANGE_PATHS[index]
      || record.changeType !== (
        record.path === "release/wp13-12b/provider-security-remediation.json"
          ? "A"
          : "M"
      ))
    || !exactStringArray(
      proof.proofOriginChangePaths,
      PROOF_ORIGIN_EXPECTED_CHANGE_PATHS,
    )
    || !exactStringArray(
      proof.proofToolChangePaths,
      PINNED_GIT_COMPATIBILITY_EXPECTED_CHANGE_PATHS,
    )
  ) throw new Error("EMULATOR_PROOF_TOOL_CHANGE_PATHS_INVALID");
  if (
    proof.environment?.demoProjectId !== EMULATOR_DEMO_PROJECT_ID
    || typeof proof.environment?.operatingSystem !== "string"
    || typeof proof.environment?.node !== "string"
    || typeof proof.environment?.java !== "string"
    || typeof proof.environment?.firebaseCli !== "string"
    || typeof proof.environment?.firestoreEmulator !== "string"
    || proof.environment?.runtimePhase !== "LOCAL_EMULATOR_PROOF"
    || proof.environment?.localEmulatorMode !== true
    || proof.environment?.offlineMode !== true
    || !exactLoopbackHost(proof.environment?.firestoreEmulatorHost)
    || !exactLoopbackHost(proof.environment?.functionsEmulatorHost)
    || typeof proof.artifact?.filename !== "string"
    || !proof.artifact.filename.endsWith(".jar")
    || !Number.isInteger(proof.artifact?.bytes)
    || proof.artifact.bytes <= 0
    || proof.artifact?.downloadMethod
      !== "firebase setup:emulators:firestore"
    || !SHA_256.test(String(proof.artifact?.sha256 ?? ""))
  ) throw new Error("EMULATOR_PROOF_PROJECT_OR_JAR_BINDING_INVALID");
  if (
    !SHA_256.test(String(proof.repositoryHashes?.packageLock ?? ""))
    || !SHA_256.test(
      String(proof.repositoryHashes?.providerPackageLock ?? ""),
    )
    || !SHA_256.test(String(proof.repositoryHashes?.firebaseConfig ?? ""))
    || !SHA_256.test(
      String(proof.repositoryHashes?.functionsManifest ?? ""),
    )
    || !SHA_256.test(String(proof.repositoryHashes?.firestoreRules ?? ""))
    || !SHA_256.test(
      String(
        proof.repositoryHashes?.externalActivationAuthorityManifest ?? "",
      ),
    )
  ) throw new Error("EMULATOR_PROOF_REPOSITORY_HASH_BINDING_INVALID");
  assertArtifactHashBinding(proof.hashBindings?.ownerDecision, {
    path: "release/wp13-12b/external-activation/owner-authorization.json",
    commit: COMMIT_S_SHA,
    errorCode: "EMULATOR_PROOF_OWNER_DECISION_HASH_BINDING_INVALID",
  });
  assertArtifactHashBinding(proof.hashBindings?.providerSecurityRemediation, {
    path: "release/wp13-12b/provider-security-remediation.json",
    commit: COMMIT_U_SHA,
    errorCode: "EMULATOR_PROOF_SECURITY_REMEDIATION_HASH_BINDING_INVALID",
  });
  assertArtifactHashBinding(proof.hashBindings?.providerPackage, {
    path: "artifacts/wp13-12b-provider-package.json",
    commit: COMMIT_U_SHA,
    errorCode: "EMULATOR_PROOF_PROVIDER_PACKAGE_HASH_BINDING_INVALID",
  });
  assertArtifactHashBinding(proof.hashBindings?.providerPackageLock, {
    path: "provider/firebase/functions/package-lock.json",
    commit: COMMIT_U_SHA,
    errorCode: "EMULATOR_PROOF_PROVIDER_LOCK_HASH_BINDING_INVALID",
  });
  assertArtifactHashBinding(proof.hashBindings?.providerSbom, {
    path: "release/wp13-12b/provider-sbom.cdx.json",
    commit: COMMIT_U_SHA,
    errorCode: "EMULATOR_PROOF_PROVIDER_SBOM_HASH_BINDING_INVALID",
  });
  assertArtifactHashBinding(proof.hashBindings?.providerAudit, {
    path: "release/wp13-12b/provider-audit.json",
    commit: COMMIT_U_SHA,
    errorCode: "EMULATOR_PROOF_PROVIDER_AUDIT_HASH_BINDING_INVALID",
  });
  assertArtifactHashBinding(proof.hashBindings?.activationPackage, {
    path: externalActivationChecksumManifestPath,
    commit: proof.proofToolCommit,
    errorCode: "EMULATOR_PROOF_ACTIVATION_PACKAGE_HASH_BINDING_INVALID",
  });
  assertArtifactHashBinding(proof.hashBindings?.receiptContract, {
    path: "release/wp13-12b/activation-handoff/receipt-contracts.json",
    commit: proof.proofToolCommit,
    errorCode: "EMULATOR_PROOF_RECEIPT_CONTRACT_HASH_BINDING_INVALID",
  });
  assertArtifactHashBinding(proof.hashBindings?.proofRunner, {
    path: "scripts/run-wp13-12b-emulator-proof.mjs",
    commit: proof.proofToolCommit,
    errorCode: "EMULATOR_PROOF_RUNNER_HASH_BINDING_INVALID",
  });
  if (
    proof.hashBindings.activationPackage.sha256
      !== proof.repositoryHashes.externalActivationAuthorityManifest
  ) throw new Error("EMULATOR_PROOF_ACTIVATION_MANIFEST_HASH_MISMATCH");
  if (
    proof.hashBindings.proofRunner.sha256 !== proof.proofRunnerSha256
    || proof.hashBindings.proofRunner.gitBlob !== proof.proofRunnerGitBlob
  ) throw new Error("EMULATOR_PROOF_RUNNER_HASH_BINDING_INVALID");
  if (
    proof.providerSecurityRemediationSha256
      !== proof.hashBindings.providerSecurityRemediation.sha256
    || proof.providerLockSha256
      !== proof.hashBindings.providerPackageLock.sha256
    || proof.providerSbomSha256 !== proof.hashBindings.providerSbom.sha256
    || proof.providerAuditSha256 !== proof.hashBindings.providerAudit.sha256
    || proof.resolvedFastUriVersion !== "3.1.5"
    || proof.advisory !== "GHSA-7p8r-x3mc-p8w7"
  ) throw new Error("EMULATOR_PROOF_PROVIDER_SECURITY_BINDING_INVALID");
  if (
    proof.controlStates?.initial?.serviceHealth
      !== "READY_DISABLED_BY_DEFAULT"
    || proof.controlStates.initial.stagingEnabled !== false
    || proof.controlStates.initial.controlEpoch !== 1
    || proof.controlStates.initial.controlDocumentExists !== false
    || proof.controlStates?.enabled?.serviceHealth !== "READY"
    || proof.controlStates.enabled.stagingEnabled !== true
    || proof.controlStates.enabled.controlEpoch !== 2
    || proof.controlStates.enabled.reasonCode
      !== `LOCAL_PROOF_${proof.proofRunId.slice(0, 16).toUpperCase()}`
    || proof.controlStates?.final?.serviceHealth
      !== "READY_DISABLED_BY_DEFAULT"
    || proof.controlStates.final.stagingEnabled !== false
    || proof.controlStates.final.controlEpoch !== 1
    || proof.controlStates.final.controlDocumentExists !== false
    || proof.cleanupResult?.status !== "PASS"
    || proof.cleanupResult?.sessionsRemaining !== 0
    || proof.cleanupResult?.capabilityGrantsRemaining !== 0
    || proof.cleanupResult?.emulatorProcessesRemaining !== 0
    || proof.cleanupResult?.temporaryFilesRemaining !== 0
    || proof.cleanupResult?.tombstonesVerifiedBeforeClear !== true
    || proof.cleanupResult?.cloudWrites !== 0
    || proof.cleanupResult?.externalNetworkCalls !== 0
    || proof.roleDenialResult?.status !== "PASS"
    || proof.roleDenialResult?.denialClass !== "ROLE_COMMAND_DENIED"
    || proof.roleDenialResult?.authoritativeStateUnchanged !== true
    || proof.roleDenialResult?.stateVersionUnchanged !== true
    || proof.roleDenialResult?.audioStarted !== false
  ) throw new Error("EMULATOR_PROOF_STATE_OR_CLEANUP_BINDING_INVALID");
  if (
    proof.receiptDraft?.status
      !== "DRAFT_PENDING_OWNER_NONCE_CONFIRMATION"
    || proof.receiptDraft?.validationStatus
      !== "NOT_YET_VALIDATED_RECEIPT"
    || proof.receiptDraft?.activationStatus
      !== "NOT_EXTERNAL_ACTIVATION_RECEIPT"
    || proof.receiptDraft?.humanConfirmationPresent !== false
  ) throw new Error("EMULATOR_PROOF_RECEIPT_DRAFT_STATUS_INVALID");
  const currentState = proof.currentExternalState;
  if (
    !isRecord(currentState)
    || ![
      "PENDING_AUTHENTIC_PROVIDER_READBACK",
      "AUTHENTIC_PROVIDER_SNAPSHOT",
      "DESTRUCTION_VERIFIED_ZERO_RESOURCES",
    ].includes(currentState.resourceInventoryStatus)
    || (
      currentState.cloudResourceCount !== null
      && !nonNegativeInteger(
        currentState.cloudResourceCount,
      )
    )
    || (
      currentState.deploymentCount !== null
      && !nonNegativeInteger(currentState.deploymentCount)
    )
    || !nonNegativeInteger(currentState.validatedReceiptCount)
  ) throw new Error("EMULATOR_PROOF_CURRENT_EXTERNAL_STATE_INVALID");
  const expectedBlockers = [];
  if (currentState.cloudResourceCount === null) {
    expectedBlockers.push("CURRENT_CLOUD_RESOURCE_COUNT_UNAVAILABLE");
  }
  if (currentState.deploymentCount === null) {
    expectedBlockers.push("CURRENT_DEPLOYMENT_COUNT_UNAVAILABLE");
  } else if (currentState.deploymentCount !== 0) {
    expectedBlockers.push("CURRENT_DEPLOYMENT_COUNT_NOT_ZERO");
  }
  if (currentState.validatedReceiptCount !== 0) {
    expectedBlockers.push("VALIDATED_RECEIPT_COUNT_NOT_ZERO");
  }
  if (!exactStringArray(currentState.blockers, expectedBlockers)) {
    throw new Error("EMULATOR_PROOF_CURRENT_EXTERNAL_BLOCKERS_INVALID");
  }
  const challenge = proof.confirmationChallenge;
  if (
    proof.status
      === "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_AWAITING_HUMAN_CONFIRMATION"
  ) {
    if (
      expectedBlockers.length !== 0
      || !isRecord(challenge)
      || challenge.schemaVersion !== EMULATOR_CHALLENGE_SCHEMA
      || challenge.status !== "GENERATED_PENDING_OWNER_CONFIRMATION"
      || challenge.recordStatus !== "DRAFT_PENDING_OWNER_CONFIRMATION"
      || challenge.evidenceStatus !== "NOT_EVIDENCE"
      || challenge.vercelLoginAuthorizationStatus
        !== "NOT_AUTHORIZATION_FOR_VERCEL_LOGIN"
      || challenge.deploymentAuthorizationStatus
        !== "NOT_AUTHORIZATION_FOR_DEPLOYMENT"
      || challenge.externalDeletionAuthorizationStatus
        !== "NOT_AUTHORIZATION_FOR_EXTERNAL_DELETION"
      || challenge.realDataAuthorizationStatus
        !== "NOT_AUTHORIZATION_FOR_REAL_DATA"
      || challenge.studentBetaAuthorizationStatus
        !== "NOT_AUTHORIZATION_FOR_STUDENT_BETA"
      || challenge.productionAuthorizationStatus
        !== "NOT_AUTHORIZATION_FOR_PRODUCTION"
      || challenge.generation !== 1
      || challenge.purpose !== EMULATOR_PR3_PURPOSE
      || !NONCE.test(String(challenge.nonce ?? ""))
      || !exactUtcTimestamp(challenge.generatedAt)
      || !exactUtcTimestamp(challenge.expiresAt)
      || Date.parse(challenge.generatedAt) < Date.parse(proof.completedAt)
      || Date.parse(challenge.expiresAt) <= Date.parse(challenge.generatedAt)
      || Date.parse(challenge.expiresAt) - Date.parse(challenge.generatedAt)
        > EMULATOR_CHALLENGE_TTL_MS
      || !exactCommitIdentity(challenge, proof)
      || challenge.proofRunnerSha256 !== proof.proofRunnerSha256
      || challenge.proofRunnerGitBlob !== proof.proofRunnerGitBlob
      || challenge.previewSourceSetSha256
        !== proof.previewSourceSetSha256
      || challenge.ownerDecisionSha256
        !== proof.hashBindings.ownerDecision.sha256
      || challenge.providerPackageSha256
        !== proof.hashBindings.providerPackage.sha256
      || challenge.providerLockSha256
        !== proof.hashBindings.providerPackageLock.sha256
      || challenge.providerSbomSha256
        !== proof.hashBindings.providerSbom.sha256
      || challenge.providerAuditSha256
        !== proof.hashBindings.providerAudit.sha256
      || challenge.providerSecurityRemediationSha256
        !== proof.hashBindings.providerSecurityRemediation.sha256
      || challenge.resolvedFastUriVersion !== "3.1.5"
      || challenge.advisory !== "GHSA-7p8r-x3mc-p8w7"
      || challenge.activationPackageSha256
        !== proof.hashBindings.activationPackage.sha256
      || challenge.receiptContractSha256
        !== proof.hashBindings.receiptContract.sha256
      || challenge.cloudResourceCount !== currentState.cloudResourceCount
      || challenge.deploymentCount !== 0
      || challenge.validatedReceiptCount !== 0
      || !exactStringArray(
        proof.receiptDraft.nonceGenerationBlockedBy,
        [],
      )
    ) throw new Error("EMULATOR_PROOF_GENERATED_CHALLENGE_INVALID");
  } else if (
    expectedBlockers.length === 0
    || !isRecord(challenge)
    || challenge.schemaVersion !== EMULATOR_CHALLENGE_SCHEMA
    || challenge.status
      !== "NOT_GENERATED_CURRENT_EXTERNAL_COUNTS_UNAVAILABLE"
    || challenge.generation !== null
    || challenge.purpose !== EMULATOR_PR3_PURPOSE
    || challenge.nonce !== null
    || challenge.generatedAt !== null
    || challenge.expiresAt !== null
    || !exactCommitIdentity(challenge, proof)
    || challenge.proofRunnerSha256 !== proof.proofRunnerSha256
    || challenge.proofRunnerGitBlob !== proof.proofRunnerGitBlob
    || challenge.previewSourceSetSha256 !== proof.previewSourceSetSha256
    || challenge.ownerDecisionSha256
      !== proof.hashBindings.ownerDecision.sha256
    || challenge.providerPackageSha256
      !== proof.hashBindings.providerPackage.sha256
    || challenge.providerLockSha256
      !== proof.hashBindings.providerPackageLock.sha256
    || challenge.providerSbomSha256 !== proof.hashBindings.providerSbom.sha256
    || challenge.providerAuditSha256
      !== proof.hashBindings.providerAudit.sha256
    || challenge.providerSecurityRemediationSha256
      !== proof.hashBindings.providerSecurityRemediation.sha256
    || challenge.resolvedFastUriVersion !== "3.1.5"
    || challenge.advisory !== "GHSA-7p8r-x3mc-p8w7"
    || challenge.activationPackageSha256
      !== proof.hashBindings.activationPackage.sha256
    || challenge.receiptContractSha256
      !== proof.hashBindings.receiptContract.sha256
    || !exactStringArray(challenge.blockers, expectedBlockers)
    || !exactStringArray(
      proof.receiptDraft.nonceGenerationBlockedBy,
      expectedBlockers,
    )
  ) throw new Error("EMULATOR_PROOF_BLOCKED_CHALLENGE_INVALID");
  const proofResultNames = isRecord(proof.proofResults)
    ? Object.keys(proof.proofResults)
    : [];
  if (
    proofResultNames.length !== REQUIRED_EMULATOR_PROOF_RESULTS.length
    || REQUIRED_EMULATOR_PROOF_RESULTS.some(
      (name) => proof.proofResults[name] !== true,
    )
  ) throw new Error("EMULATOR_PROOF_RESULTS_INCOMPLETE");
  if (
    !Array.isArray(proof.commandsRun)
    || proof.commandsRun.length < 4
    || !proof.commandsRun.every(
      (command) =>
        typeof command === "string"
        && command.length > 0
        && !/[<>]/u.test(command),
    )
    || !proof.commandsRun.some(
      (command) =>
        command.includes(`--project ${EMULATOR_DEMO_PROJECT_ID}`),
    )
    || !proof.commandsRun.some(
      (command) =>
        command.includes(`--artifact ${proof.artifact.filename}`)
        && command.includes(`--sha256 ${proof.artifact.sha256}`),
    )
  ) throw new Error("EMULATOR_PROOF_COMMAND_BINDING_INVALID");
  return Object.freeze({
    artifactSha256: sha256(proofBytes),
    proofSha256: sha256(proofBytes),
    sourceCommit: proof.sourceCommit,
    sourceTree: proof.sourceTree,
    commitS: proof.commitS,
    commitSTree: proof.commitSTree,
    commitT: proof.commitT,
    commitTTree: proof.commitTTree,
    commitU: proof.commitU,
    commitUTree: proof.commitUTree,
    commitV: proof.commitV,
    commitVTree: proof.commitVTree,
    commitW: proof.commitW,
    commitWTree: proof.commitWTree,
    orderedCommitChain: [...proof.orderedCommitChain],
    proofOriginCommit: proof.proofOriginCommit,
    proofOriginTree: proof.proofOriginTree,
    proofToolCommitChain: [...proof.proofToolCommitChain],
    proofToolCommit: proof.proofToolCommit,
    proofToolTree: proof.proofToolTree,
    securityRemediationCommit: proof.securityRemediationCommit,
    securityRemediationTree: proof.securityRemediationTree,
    providerSecurityRemediationCommit:
      proof.providerSecurityRemediationCommit,
    providerPackageCommit: proof.providerPackageCommit,
    providerPackageLockCommit: proof.providerPackageLockCommit,
    providerSbomCommit: proof.providerSbomCommit,
    providerAuditCommit: proof.providerAuditCommit,
    proofRunnerSha256: proof.proofRunnerSha256,
    proofRunnerGitBlob: proof.proofRunnerGitBlob,
    pinnedGitAdapterSha256: proof.pinnedGitAdapterSha256,
    pinnedGitAdapterGitBlob: proof.pinnedGitAdapterGitBlob,
    gitDiffCommandContract: structuredClone(proof.gitDiffCommandContract),
    securityRemediationChangeSetSha256:
      proof.securityRemediationChangeSetSha256,
    previewSourceSetSha256: proof.previewSourceSetSha256,
    ownerDecisionSha256: proof.hashBindings.ownerDecision.sha256,
    providerSecurityRemediationSha256:
      proof.hashBindings.providerSecurityRemediation.sha256,
    providerPackageSha256: proof.hashBindings.providerPackage.sha256,
    providerLockSha256: proof.hashBindings.providerPackageLock.sha256,
    providerSbomSha256: proof.hashBindings.providerSbom.sha256,
    providerAuditSha256: proof.hashBindings.providerAudit.sha256,
    resolvedFastUriVersion: proof.resolvedFastUriVersion,
    advisory: proof.advisory,
    activationPackageSha256: proof.hashBindings.activationPackage.sha256,
    receiptContractSha256: proof.hashBindings.receiptContract.sha256,
  });
}

export function buildEmulatorProofBinding(proof, proofBytes) {
  const validated = validateEmulatorProofArtifact(proof, proofBytes);
  const challenge = proof.confirmationChallenge;
  if (
    proof.status
      !== "ACTUAL_FIREBASE_EMULATOR_PROOF_PASSED_AWAITING_HUMAN_CONFIRMATION"
    || !isRecord(challenge)
    || challenge.schemaVersion !== EMULATOR_CHALLENGE_SCHEMA
    || challenge.status !== "GENERATED_PENDING_OWNER_CONFIRMATION"
    || challenge.recordStatus !== "DRAFT_PENDING_OWNER_CONFIRMATION"
    || challenge.evidenceStatus !== "NOT_EVIDENCE"
    || challenge.vercelLoginAuthorizationStatus
      !== "NOT_AUTHORIZATION_FOR_VERCEL_LOGIN"
    || challenge.deploymentAuthorizationStatus
      !== "NOT_AUTHORIZATION_FOR_DEPLOYMENT"
    || challenge.externalDeletionAuthorizationStatus
      !== "NOT_AUTHORIZATION_FOR_EXTERNAL_DELETION"
    || challenge.realDataAuthorizationStatus
      !== "NOT_AUTHORIZATION_FOR_REAL_DATA"
    || challenge.studentBetaAuthorizationStatus
      !== "NOT_AUTHORIZATION_FOR_STUDENT_BETA"
    || challenge.productionAuthorizationStatus
      !== "NOT_AUTHORIZATION_FOR_PRODUCTION"
    || challenge.generation !== 1
    || challenge.purpose !== EMULATOR_PR3_PURPOSE
    || !NONCE.test(String(challenge.nonce ?? ""))
    || !exactUtcTimestamp(challenge.generatedAt)
    || !exactUtcTimestamp(challenge.expiresAt)
    || Date.parse(challenge.generatedAt) < Date.parse(proof.completedAt)
    || Date.parse(challenge.expiresAt) <= Date.parse(challenge.generatedAt)
    || Date.parse(challenge.expiresAt) - Date.parse(challenge.generatedAt)
      > EMULATOR_CHALLENGE_TTL_MS
    || !exactCommitIdentity(challenge, validated)
    || challenge.proofRunnerSha256 !== validated.proofRunnerSha256
    || challenge.proofRunnerGitBlob !== validated.proofRunnerGitBlob
    || challenge.previewSourceSetSha256
      !== validated.previewSourceSetSha256
    || challenge.ownerDecisionSha256 !== validated.ownerDecisionSha256
    || challenge.providerPackageSha256
      !== validated.providerPackageSha256
    || challenge.providerLockSha256 !== validated.providerLockSha256
    || challenge.providerSbomSha256 !== validated.providerSbomSha256
    || challenge.providerAuditSha256 !== validated.providerAuditSha256
    || challenge.providerSecurityRemediationSha256
      !== validated.providerSecurityRemediationSha256
    || challenge.resolvedFastUriVersion !== validated.resolvedFastUriVersion
    || challenge.advisory !== validated.advisory
    || challenge.activationPackageSha256
      !== validated.activationPackageSha256
    || challenge.receiptContractSha256
      !== validated.receiptContractSha256
    || !nonNegativeInteger(challenge.cloudResourceCount)
    || !nonNegativeInteger(challenge.deploymentCount)
    || !nonNegativeInteger(challenge.validatedReceiptCount)
    || challenge.cloudResourceCount
      !== proof.currentExternalState.cloudResourceCount
    || challenge.deploymentCount
      !== proof.currentExternalState.deploymentCount
    || challenge.validatedReceiptCount
      !== proof.currentExternalState.validatedReceiptCount
  ) throw new Error("EMULATOR_PROOF_CHALLENGE_INVALID_OR_BLOCKED");
  const binding = {
    schemaVersion: EMULATOR_BINDING_SCHEMA,
    artifactPath: EMULATOR_PROOF_PATH,
    artifactSha256: validated.artifactSha256,
    nonce: challenge.nonce,
    purpose: EMULATOR_PR3_PURPOSE,
    jarSha256: proof.artifact.sha256,
    demoProjectId: EMULATOR_DEMO_PROJECT_ID,
    sourceCommit: validated.sourceCommit,
    sourceTree: validated.sourceTree,
    proofSha256: validated.proofSha256,
    commitS: validated.commitS,
    commitSTree: validated.commitSTree,
    commitT: validated.commitT,
    commitTTree: validated.commitTTree,
    commitU: validated.commitU,
    commitUTree: validated.commitUTree,
    commitV: validated.commitV,
    commitVTree: validated.commitVTree,
    commitW: validated.commitW,
    commitWTree: validated.commitWTree,
    orderedCommitChain: [...validated.orderedCommitChain],
    proofOriginCommit: validated.proofOriginCommit,
    proofOriginTree: validated.proofOriginTree,
    proofToolCommitChain: [...validated.proofToolCommitChain],
    proofToolCommit: validated.proofToolCommit,
    proofToolTree: validated.proofToolTree,
    securityRemediationCommit: validated.securityRemediationCommit,
    securityRemediationTree: validated.securityRemediationTree,
    providerSecurityRemediationCommit:
      validated.providerSecurityRemediationCommit,
    providerPackageCommit: validated.providerPackageCommit,
    providerPackageLockCommit: validated.providerPackageLockCommit,
    providerSbomCommit: validated.providerSbomCommit,
    providerAuditCommit: validated.providerAuditCommit,
    proofRunnerSha256: validated.proofRunnerSha256,
    proofRunnerGitBlob: validated.proofRunnerGitBlob,
    pinnedGitAdapterSha256: validated.pinnedGitAdapterSha256,
    pinnedGitAdapterGitBlob: validated.pinnedGitAdapterGitBlob,
    gitDiffCommandContract: structuredClone(
      validated.gitDiffCommandContract,
    ),
    securityRemediationChangeSetSha256:
      validated.securityRemediationChangeSetSha256,
    previewSourceSetSha256: validated.previewSourceSetSha256,
    ownerDecisionSha256: validated.ownerDecisionSha256,
    providerSecurityRemediationSha256:
      validated.providerSecurityRemediationSha256,
    providerPackageSha256: validated.providerPackageSha256,
    providerLockSha256: validated.providerLockSha256,
    providerSbomSha256: validated.providerSbomSha256,
    providerAuditSha256: validated.providerAuditSha256,
    resolvedFastUriVersion: validated.resolvedFastUriVersion,
    advisory: validated.advisory,
    activationPackageSha256: validated.activationPackageSha256,
    receiptContractSha256: validated.receiptContractSha256,
    generatedAt: challenge.generatedAt,
    expiresAt: challenge.expiresAt,
    cloudResourceCount: challenge.cloudResourceCount,
    deploymentCount: challenge.deploymentCount,
    validatedReceiptCount: challenge.validatedReceiptCount,
  };
  return binding;
}

export function buildEmulatorConfirmationText(proof, proofBytes) {
  return exactConfirmation(buildEmulatorProofBinding(proof, proofBytes));
}

function exactTextMatches(expected, actual) {
  if (typeof actual !== "string") return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(actual, "utf8");
  return expectedBytes.length === actualBytes.length
    && timingSafeEqual(expectedBytes, actualBytes);
}

export function buildChallengeBoundEmulatorReceipt({
  proof,
  proofBytes,
  confirmationText,
  ownerAuthorizationBytes,
  providerSecurityRemediationBytes,
  providerPackageBytes,
  activationPackageBytes,
  providerPackageLockBytes,
  providerSbomBytes,
  providerAuditBytes,
  receiptContractBytes,
  proofRunnerBytes,
  firestoreRulesBytes,
  confirmedAt,
}) {
  const binding = buildEmulatorProofBinding(proof, proofBytes);
  const expectedConfirmation = exactConfirmation(binding);
  if (!exactTextMatches(expectedConfirmation, confirmationText)) {
    throw new Error("EMULATOR_CONFIRMATION_TEXT_MISMATCH");
  }
  if (
    !exactUtcTimestamp(confirmedAt)
    || Date.parse(confirmedAt) < Date.parse(binding.generatedAt)
    || Date.parse(confirmedAt) > Date.parse(binding.expiresAt)
  ) throw new Error("EMULATOR_CONFIRMATION_TIME_INVALID");
  for (const [bytes, expected, code] of [
    [
      ownerAuthorizationBytes,
      binding.ownerDecisionSha256,
      "EMULATOR_OWNER_DECISION_BYTES_MISMATCH",
    ],
    [
      providerSecurityRemediationBytes,
      binding.providerSecurityRemediationSha256,
      "EMULATOR_PROVIDER_SECURITY_REMEDIATION_BYTES_MISMATCH",
    ],
    [
      providerPackageBytes,
      binding.providerPackageSha256,
      "EMULATOR_PROVIDER_PACKAGE_BYTES_MISMATCH",
    ],
    [
      providerPackageLockBytes,
      binding.providerLockSha256,
      "EMULATOR_PROVIDER_LOCK_BYTES_MISMATCH",
    ],
    [
      providerSbomBytes,
      binding.providerSbomSha256,
      "EMULATOR_PROVIDER_SBOM_BYTES_MISMATCH",
    ],
    [
      providerAuditBytes,
      binding.providerAuditSha256,
      "EMULATOR_PROVIDER_AUDIT_BYTES_MISMATCH",
    ],
    [
      activationPackageBytes,
      binding.activationPackageSha256,
      "EMULATOR_ACTIVATION_PACKAGE_BYTES_MISMATCH",
    ],
    [
      receiptContractBytes,
      binding.receiptContractSha256,
      "EMULATOR_RECEIPT_CONTRACT_BYTES_MISMATCH",
    ],
    [
      proofRunnerBytes,
      binding.proofRunnerSha256,
      "EMULATOR_PROOF_RUNNER_BYTES_MISMATCH",
    ],
  ]) {
    if (!Buffer.isBuffer(bytes) || sha256(bytes) !== expected) {
      throw new Error(code);
    }
  }
  if (gitBlobObjectId(proofRunnerBytes) !== binding.proofRunnerGitBlob) {
    throw new Error("EMULATOR_PROOF_RUNNER_GIT_BLOB_MISMATCH");
  }
  if (
    !Buffer.isBuffer(firestoreRulesBytes)
    || sha256(firestoreRulesBytes) !== proof.repositoryHashes.firestoreRules
  ) throw new Error("EMULATOR_FIRESTORE_RULES_BYTES_MISMATCH");
  const receipt = {
    schemaVersion: "wp13.12b-receipt-v2",
    templateMarker: "FILLED_AUTHENTIC_EVIDENCE",
    receiptId:
      `wp13-12b-emulator-proof-${binding.sourceCommit.slice(0, 12)}-`
      + `${binding.nonce.slice(0, 12)}-v2`,
    receiptType: "EMULATOR_PROOF_RECEIPT",
    status: "COMPLETED_WITH_AUTHENTIC_EVIDENCE",
    createdAt: confirmedAt,
    performedBy: "CODEX_LOCAL_OPERATOR_UNDER_PRODUCT_OWNER_AUTHORIZATION",
    environment: "LOCAL_FIREBASE_EMULATORS_SYNTHETIC_ONLY",
    sourceCommit: binding.sourceCommit,
    sourceTree: binding.sourceTree,
    expectedSourceCommit: binding.sourceCommit,
    evidenceAnchorCommit: binding.commitS,
    evidenceAnchorTree: binding.commitSTree,
    commitT: binding.commitT,
    commitTTree: binding.commitTTree,
    commitU: binding.commitU,
    commitUTree: binding.commitUTree,
    commitV: binding.commitV,
    commitVTree: binding.commitVTree,
    commitW: binding.commitW,
    commitWTree: binding.commitWTree,
    orderedCommitChain: [...binding.orderedCommitChain],
    proofOriginCommit: binding.proofOriginCommit,
    proofOriginTree: binding.proofOriginTree,
    proofToolCommitChain: [...binding.proofToolCommitChain],
    proofToolCommit: binding.proofToolCommit,
    proofToolTree: binding.proofToolTree,
    securityRemediationCommit: binding.securityRemediationCommit,
    securityRemediationTree: binding.securityRemediationTree,
    providerSecurityRemediationCommit:
      binding.providerSecurityRemediationCommit,
    providerPackageCommit: binding.providerPackageCommit,
    providerPackageLockCommit: binding.providerPackageLockCommit,
    providerSbomCommit: binding.providerSbomCommit,
    providerAuditCommit: binding.providerAuditCommit,
    decisionRecordChecksum: sha256(ownerAuthorizationBytes),
    commandsRun: [...proof.commandsRun],
    providerResourceIds: "NONE",
    proofResults: structuredClone(proof.proofResults),
    artifactHashes: {
      [EMULATOR_PROOF_PATH]: binding.artifactSha256,
      "release/wp13-12b/external-activation/owner-authorization.json":
        sha256(ownerAuthorizationBytes),
      "release/wp13-12b/provider-security-remediation.json":
        sha256(providerSecurityRemediationBytes),
      "artifacts/wp13-12b-provider-package.json":
        sha256(providerPackageBytes),
      "provider/firebase/functions/package-lock.json":
        sha256(providerPackageLockBytes),
      "release/wp13-12b/provider-sbom.cdx.json":
        sha256(providerSbomBytes),
      "release/wp13-12b/provider-audit.json": sha256(providerAuditBytes),
      [externalActivationChecksumManifestPath]:
        sha256(activationPackageBytes),
      "release/wp13-12b/activation-handoff/receipt-contracts.json":
        sha256(receiptContractBytes),
      "scripts/run-wp13-12b-emulator-proof.mjs":
        sha256(proofRunnerBytes),
      "provider/firebase/firestore.rules": sha256(firestoreRulesBytes),
    },
    machineEnvironment: structuredClone(proof.environment),
    repositoryHashes: structuredClone(proof.repositoryHashes),
    firebaseCliVersion: proof.environment.firebaseCli,
    emulatorArtifact: {
      filename: proof.artifact.filename,
      version: proof.environment.firestoreEmulator,
      bytes: proof.artifact.bytes,
      sha256: proof.artifact.sha256,
      downloadMethod: proof.artifact.downloadMethod,
    },
    emulatorProofBinding: {
      ...binding,
    },
    nonceRecord: {
      schemaVersion: EMULATOR_CHALLENGE_SCHEMA,
      generation: 1,
      nonce: binding.nonce,
      purpose: binding.purpose,
      generatedAt: binding.generatedAt,
      expiresAt: binding.expiresAt,
      status: "CONFIRMED_CONSUMED",
      consumedAt: confirmedAt,
      commitS: binding.commitS,
      commitSTree: binding.commitSTree,
      commitT: binding.commitT,
      commitTTree: binding.commitTTree,
      commitU: binding.commitU,
      commitUTree: binding.commitUTree,
      commitV: binding.commitV,
      commitVTree: binding.commitVTree,
      commitW: binding.commitW,
      commitWTree: binding.commitWTree,
      orderedCommitChain: [...binding.orderedCommitChain],
      proofOriginCommit: binding.proofOriginCommit,
      proofOriginTree: binding.proofOriginTree,
      proofToolCommitChain: [...binding.proofToolCommitChain],
      proofToolCommit: binding.proofToolCommit,
      proofToolTree: binding.proofToolTree,
      securityRemediationCommit: binding.securityRemediationCommit,
      securityRemediationTree: binding.securityRemediationTree,
      providerSecurityRemediationCommit:
        binding.providerSecurityRemediationCommit,
      providerPackageCommit: binding.providerPackageCommit,
      providerPackageLockCommit: binding.providerPackageLockCommit,
      providerSbomCommit: binding.providerSbomCommit,
      providerAuditCommit: binding.providerAuditCommit,
      proofRunnerSha256: binding.proofRunnerSha256,
      proofRunnerGitBlob: binding.proofRunnerGitBlob,
      pinnedGitAdapterSha256: binding.pinnedGitAdapterSha256,
      pinnedGitAdapterGitBlob: binding.pinnedGitAdapterGitBlob,
      gitDiffCommandContract: structuredClone(
        binding.gitDiffCommandContract,
      ),
      securityRemediationChangeSetSha256:
        binding.securityRemediationChangeSetSha256,
      previewSourceSetSha256: binding.previewSourceSetSha256,
      freshEmulatorProofSha256: binding.proofSha256,
      ownerDecisionSha256: binding.ownerDecisionSha256,
      providerSecurityRemediationSha256:
        binding.providerSecurityRemediationSha256,
      providerPackageSha256: binding.providerPackageSha256,
      providerLockSha256: binding.providerLockSha256,
      providerSbomSha256: binding.providerSbomSha256,
      providerAuditSha256: binding.providerAuditSha256,
      resolvedFastUriVersion: binding.resolvedFastUriVersion,
      advisory: binding.advisory,
      activationPackageSha256: binding.activationPackageSha256,
      receiptContractSha256: binding.receiptContractSha256,
      cloudResourceCount: binding.cloudResourceCount,
      deploymentCount: binding.deploymentCount,
      validatedReceiptCount: binding.validatedReceiptCount,
    },
    limitations: [...proof.limitations],
    humanSignatureOrExplicitConfirmation: {
      confirmed: true,
      confirmationText,
      confirmedAt,
      signaturePresent: false,
    },
    opensB8: false,
    authorizesStudentBeta: false,
    authorizesProduction: false,
    realParticipantData: false,
    syntheticOrFabricated: false,
    physicalProof: false,
    devices: [],
  };
  if (
    JSON.stringify(receipt).includes(
      proof.originContract.declaredPreviewOrigin,
    )
  ) throw new Error("SYNTHETIC_PREVIEW_ORIGIN_LEAKED_TO_RECEIPT");
  return receipt;
}

function option(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline !== undefined) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const proofPath = option("--proof") ?? EMULATOR_PROOF_PATH;
  if (proofPath !== EMULATOR_PROOF_PATH) {
    throw new Error("EMULATOR_PROOF_PATH_MUST_BE_CANONICAL");
  }
  const proofTarget = repositoryPath(repo, proofPath);
  const proofBytes = await readFile(proofTarget);
  const proof = JSON.parse(proofBytes.toString("utf8"));
  const binding = buildEmulatorProofBinding(proof, proofBytes);
  const resolvedTree = git(repo, ["rev-parse", `${binding.sourceCommit}^{tree}`]);
  if (resolvedTree !== binding.sourceTree) {
    throw new Error("EMULATOR_PROOF_COMMIT_TREE_MISMATCH");
  }
  if (
    git(repo, ["rev-parse", `${binding.commitS}^{tree}`])
      !== binding.commitSTree
    || git(repo, ["rev-parse", `${binding.commitT}^{tree}`])
      !== binding.commitTTree
    || git(repo, ["rev-parse", `${binding.commitU}^{tree}`])
      !== binding.commitUTree
    || git(repo, ["rev-parse", `${binding.commitV}^{tree}`])
      !== binding.commitVTree
    || git(
      repo,
      [
        "rev-list",
        "--parents",
        "-n",
        "1",
        binding.commitT,
      ],
    ).split(" ").join("\0")
      !== [binding.commitT, binding.commitS].join("\0")
    || git(
      repo,
      [
        "rev-list",
        "--parents",
        "-n",
        "1",
        binding.commitU,
      ],
    ).split(" ").join("\0")
      !== [binding.commitU, binding.commitT].join("\0")
    || git(
      repo,
      [
        "rev-list",
        "--parents",
        "-n",
        "1",
        binding.commitV,
      ],
    ).split(" ").join("\0")
      !== [binding.commitV, binding.commitU].join("\0")
    || git(
      repo,
      [
        "rev-list",
        "--parents",
        "-n",
        "1",
        binding.commitW,
      ],
    ).split(" ").join("\0")
      !== [binding.commitW, binding.commitV].join("\0")
    || !exactStringArray(
      binding.orderedCommitChain,
      [
        binding.commitS,
        binding.commitT,
        binding.commitU,
        binding.commitV,
        binding.commitW,
      ],
    )
    || !exactStringArray(
      binding.proofToolCommitChain,
      [
        binding.commitT,
        binding.commitU,
        binding.commitV,
        binding.proofToolCommit,
      ],
    )
  ) throw new Error("EMULATOR_PROOF_S_TO_T_TO_U_TO_V_TO_W_COMMIT_CHAIN_INVALID");
  if (git(repo, ["rev-parse", "HEAD"]) !== binding.sourceCommit) {
    throw new Error("EMULATOR_PROOF_IS_NOT_BOUND_TO_CURRENT_HEAD");
  }
  if (Date.now() > Date.parse(binding.expiresAt)) {
    throw new Error("EMULATOR_PROOF_CHALLENGE_EXPIRED");
  }
  const receiptPath =
    "release/wp13-12b/receipts/actual/"
    + `emulator-proof-receipt-${binding.sourceCommit.slice(0, 12)}-v2.json`;
  await assertEmulatorConfirmationRecordPrecondition({
    repositoryRoot: repo,
    sourceCommit: binding.sourceCommit,
    sourceTree: binding.sourceTree,
    proofBytes,
    receiptPath,
  });
  const attestedSourceBytes = await assertEmulatorBindingSourceBytes({
    repositoryRoot: repo,
    binding,
    firestoreRulesSha256: proof.repositoryHashes.firestoreRules,
  });
  const confirmationText = exactConfirmation(binding);
  if (!process.argv.includes("--record")) {
    process.stdout.write(`${JSON.stringify({
      status: "AWAITING_EXACT_PRODUCT_OWNER_CONFIRMATION",
      proofPath,
      proofSha256: binding.proofSha256,
      sourceCommit: binding.sourceCommit,
      sourceTree: binding.sourceTree,
      commitS: binding.commitS,
      commitSTree: binding.commitSTree,
      commitT: binding.commitT,
      commitTTree: binding.commitTTree,
      commitU: binding.commitU,
      commitUTree: binding.commitUTree,
      commitV: binding.commitV,
      commitVTree: binding.commitVTree,
      commitW: binding.commitW,
      commitWTree: binding.commitWTree,
      orderedCommitChain: [...binding.orderedCommitChain],
      proofOriginCommit: binding.proofOriginCommit,
      proofOriginTree: binding.proofOriginTree,
      proofToolCommitChain: [...binding.proofToolCommitChain],
      proofToolCommit: binding.proofToolCommit,
      proofToolTree: binding.proofToolTree,
      securityRemediationCommit: binding.securityRemediationCommit,
      securityRemediationTree: binding.securityRemediationTree,
      providerSecurityRemediationCommit:
        binding.providerSecurityRemediationCommit,
      providerPackageCommit: binding.providerPackageCommit,
      providerPackageLockCommit: binding.providerPackageLockCommit,
      providerSbomCommit: binding.providerSbomCommit,
      providerAuditCommit: binding.providerAuditCommit,
      proofRunnerSha256: binding.proofRunnerSha256,
      proofRunnerGitBlob: binding.proofRunnerGitBlob,
      pinnedGitAdapterSha256: binding.pinnedGitAdapterSha256,
      pinnedGitAdapterGitBlob: binding.pinnedGitAdapterGitBlob,
      securityRemediationChangeSetSha256:
        binding.securityRemediationChangeSetSha256,
      previewSourceSetSha256: binding.previewSourceSetSha256,
      providerSecurityRemediationSha256:
        binding.providerSecurityRemediationSha256,
      providerPackageSha256: binding.providerPackageSha256,
      providerLockSha256: binding.providerLockSha256,
      providerSbomSha256: binding.providerSbomSha256,
      providerAuditSha256: binding.providerAuditSha256,
      resolvedFastUriVersion: binding.resolvedFastUriVersion,
      advisory: binding.advisory,
      generatedAt: binding.generatedAt,
      expiresAt: binding.expiresAt,
      cloudResourceCount: binding.cloudResourceCount,
      deploymentCount: binding.deploymentCount,
      validatedReceiptCount: binding.validatedReceiptCount,
      jarSha256: binding.jarSha256,
      demoProjectId: binding.demoProjectId,
      nonce: binding.nonce,
      purpose: binding.purpose,
      confirmationText,
    }, null, 2)}\n`);
    return;
  }

  const suppliedConfirmation = option("--confirmation");
  if (suppliedConfirmation === undefined) {
    throw new Error("EXACT_EMULATOR_CONFIRMATION_REQUIRED");
  }
  const {
    ownerAuthorizationBytes,
    providerSecurityRemediationBytes,
    providerPackageBytes,
    providerPackageLockBytes,
    providerSbomBytes,
    providerAuditBytes,
    activationPackageBytes,
    receiptContractBytes,
    proofRunnerBytes,
    firestoreRulesBytes,
  } = attestedSourceBytes;
  const confirmedAt = new Date().toISOString();
  const receipt = buildChallengeBoundEmulatorReceipt({
    proof,
    proofBytes,
    confirmationText: suppliedConfirmation,
    ownerAuthorizationBytes,
    providerSecurityRemediationBytes,
    providerPackageBytes,
    providerPackageLockBytes,
    providerSbomBytes,
    providerAuditBytes,
    activationPackageBytes,
    receiptContractBytes,
    proofRunnerBytes,
    firestoreRulesBytes,
    confirmedAt,
  });
  const receiptTarget = repositoryPath(repo, receiptPath);
  await assertEmulatorConfirmationRecordPrecondition({
    repositoryRoot: repo,
    sourceCommit: binding.sourceCommit,
    sourceTree: binding.sourceTree,
    proofBytes,
    receiptPath,
  });
  await mkdir(dirname(receiptTarget), { recursive: true });
  const receiptBytes = Buffer.from(
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
  let receiptHandle;
  let receiptIdentity;
  try {
    receiptHandle = await open(receiptTarget, "wx", 0o600);
    receiptIdentity = await receiptHandle.stat();
    await receiptHandle.writeFile(receiptBytes);
    await receiptHandle.sync();
    await receiptHandle.close();
    receiptHandle = undefined;
    await assertEmulatorEvidencePairPostcondition({
      repositoryRoot: repo,
      sourceCommit: binding.sourceCommit,
      sourceTree: binding.sourceTree,
      proofBytes,
      receiptPath,
      receiptBytes,
    });
  } catch (error) {
    const cleanupErrors = [];
    if (receiptHandle !== undefined) {
      try {
        await receiptHandle.close();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (receiptIdentity !== undefined) {
      try {
        await removeOwnedEvidenceFile(receiptTarget, receiptIdentity);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        "EMULATOR_RECEIPT_WRITE_AND_ROLLBACK_FAILED",
      );
    }
    throw error;
  }
  process.stdout.write(`${JSON.stringify({
    status: "CHALLENGE_BOUND_EMULATOR_RECEIPT_RECORDED",
    receiptPath,
    receiptId: receipt.receiptId,
    sourceCommit: binding.sourceCommit,
    proofSha256: binding.proofSha256,
  }, null, 2)}\n`);
}

const invokedPath = process.argv[1] === undefined
  ? undefined
  : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) await main();
