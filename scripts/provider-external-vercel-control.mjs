import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  readFile,
  readdir,
} from "node:fs/promises";
import { createRequire } from "node:module";
import {
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { validateReceipt } from "../dist/src/core/staging-validation.js";
import {
  assertActivationWindowOpen,
  validateCloudFieldApproval,
} from "../provider/firebase/tools/operator-gate-contract.mjs";
import {
  isRepositoryRelativePath,
  RECEIPT_ARTIFACT_VERIFICATION_MODE,
  verifyReceiptRepositoryIntegrity,
} from "./wp13-12b-receipt-integrity.mjs";
import {
  approvedVercelCli,
  approvedVercelCliModuleRoot,
  approvedVercelCliIntegritySha256,
  approvedVercelNodeVersion,
  inspectPinnedVercelCli,
  verifyPinnedVercelCliSnapshot,
} from "./wp13-12b-vercel-cli-toolchain.mjs";
import {
  createPinnedGitExecFile,
} from "./wp13-12b-pinned-git-toolchain.mjs";
import {
  acquireBaseActivationCapability,
  assertBaseActivationCapability,
} from "./wp13-12b-activation-phase-gate.mjs";
import {
  assertNoDangerousExternalEnvironment,
  sanitizedNodeChildEnvironment,
} from "./wp13-12b-external-process-boundary.mjs";

const nativeFetch = globalThis.fetch.bind(globalThis);

export {
  approvedVercelCli,
  approvedVercelCliIntegritySha256,
  approvedVercelNodeVersion,
};

const require = createRequire(import.meta.url);
const repo = fileURLToPath(new URL("..", import.meta.url));
export const previewRoot = join(
  repo,
  "provider",
  "vercel",
  "wp13-12b-preview",
);
export const previewRootRepositoryPath =
  "provider/vercel/wp13-12b-preview";
const activationDirectory = join(
  repo,
  "release",
  "wp13-12b",
  "external-activation",
);
const actualReceiptsDirectory = join(
  repo,
  "release",
  "wp13-12b",
  "receipts",
  "actual",
);
const [approval, trust] = await Promise.all([
  readFile(
    join(activationDirectory, "cloud-field-approval.json"),
    "utf8",
  ).then(JSON.parse),
  readFile(
    join(activationDirectory, "vercel-google-trust-contract.json"),
    "utf8",
  ).then(JSON.parse),
]);
assert.equal(
  approval.authorizationEffects?.protectedPreviewAuthorized,
  true,
  "PROTECTED_PREVIEW_NOT_AUTHORIZED",
);
assert.equal(
  approval.authorizationEffects?.productionAuthorized,
  false,
  "PRODUCTION_MUST_REMAIN_UNAUTHORIZED",
);
const approvedCloudScope = validateCloudFieldApproval(approval);

const ACTIVATION_AUTHORIZATION =
  "AUTHORIZE_WP13_12B_EXTERNAL_ACTIVATION";
const ACTIONS = new Set([
  "inspect-project",
  "inspect-deployment-candidate",
  "verify-deployment-absent",
  "ensure-standard-protection",
  "ensure-team-oidc",
]);
const READ_ONLY_ACTIONS = new Set([
  "inspect-project",
  "inspect-deployment-candidate",
  "verify-deployment-absent",
]);
const DEPLOYMENT_ID_ACTIONS = new Set([
  "inspect-deployment-candidate",
  "verify-deployment-absent",
]);
const FLAGS = new Set([
  "--action",
  "--authorized",
  "--deployment-id",
]);
const SHA1 = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,80}$/u;
const HTTPS_SHA256 = /^[a-f0-9]{64}$/u;
const ACTUAL_RECEIPT_JSON =
  /^release\/wp13-12b\/receipts\/actual\/[^/]+\.json$/u;
export const authenticatedBrowserProofSchemaVersion =
  "wp13.12b-vercel-authenticated-browser-proof-v1";
export const authenticatedBrowserProofPathEnvironmentKey =
  "LUDYS_AUTHENTICATED_BROWSER_PROOF_PATH";
export const authenticatedBrowserProofMaximumAgeMilliseconds =
  30 * 60 * 1000;
export const vercelProviderReadbackMaximumAgeMilliseconds =
  2 * 60 * 1000;
const LIVE_DEPLOYMENT_STATES = new Set([
  "BUILDING",
  "INITIALIZING",
  "QUEUED",
  "READY",
]);
const NONTERMINAL_DEPLOYMENT_STATES = new Set([
  "BUILDING",
  "INITIALIZING",
  "QUEUED",
]);
export const approvedVercelUserEnvironmentKeys = Object.freeze([
  "LUDYS_COMMAND_FUNCTION_URL",
  "LUDYS_DELETE_FUNCTION_URL",
  "LUDYS_DEPLOYMENT_ROLE",
  "LUDYS_GCP_PREVIEW_SERVICE_ACCOUNT",
  "LUDYS_GCP_PROJECT_NUMBER",
  "LUDYS_GCP_WIF_POOL_ID",
  "LUDYS_GCP_WIF_PROVIDER_ID",
  "LUDYS_ISSUE_FUNCTION_URL",
  "LUDYS_PROJECTION_FUNCTION_URL",
]);
export const approvedVercelUploadPaths = Object.freeze([
  ".vercelignore",
  "api/delete.mjs",
  "api/issue.mjs",
  "api/runtime-config.mjs",
  "app.mjs",
  "copy-review-contract.json",
  "index.html",
  "lib/google-identity.mjs",
  "lib/http.mjs",
  "lib/private-function-proxy.mjs",
  "lib/reviewed-copy.mjs",
  "lib/runtime-config.mjs",
  "locales/nb.mjs",
  "locales/nn.mjs",
  "styles.css",
  "tools/build-deploy-dist.mjs",
  "tools/copy-review-preflight.mjs",
  "vercel.json",
]);
const excludedPreviewDirectories = new Set([
  ".vercel",
  "dist",
  "node_modules",
]);
const inMemoryVercelApiTestAdapters = new WeakSet();
const IN_MEMORY_TEST_TOKEN =
  "ludys-in-memory-vercel-test-token";

export const vercelScope = Object.freeze({
  teamId: trust.vercel.teamId,
  teamSlug: trust.vercel.teamSlug,
  projectId: trust.vercel.projectId,
  projectName: trust.vercel.projectName,
  previewEnvironment: trust.vercel.environment,
  previewSubject: trust.vercel.subject,
  protectionMode: "prod_deployment_urls_and_all_previews",
  activationAuthorization: ACTIVATION_AUTHORIZATION,
});
export function assertVercelActivationWindowOpen(options = {}) {
  return assertActivationWindowOpen(approvedCloudScope, options);
}

function vercelError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function assertInMemoryTestData(value) {
  if (typeof value === "function") {
    throw vercelError("IN_MEMORY_VERCEL_TEST_DATA_REQUIRED");
  }
  if (Array.isArray(value)) {
    for (const item of value) assertInMemoryTestData(item);
    return;
  }
  if (value !== null && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw vercelError("IN_MEMORY_VERCEL_TEST_DATA_REQUIRED");
    }
    for (const item of Object.values(value)) {
      assertInMemoryTestData(item);
    }
  }
}

function inMemoryJsonResponse(body, status = 200) {
  return Object.freeze({
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return structuredClone(body);
    },
  });
}

export function createInMemoryVercelApiForTesting({
  project,
  domains = [],
  productionDeployments = [],
  deployments = [],
  environmentVariables = [],
  deploymentDetails = {},
  deploymentFiles = {},
} = {}) {
  const configuration = {
    project,
    domains,
    productionDeployments,
    deployments,
    environmentVariables,
    deploymentDetails,
    deploymentFiles,
  };
  assertInMemoryTestData(configuration);
  let projectState = structuredClone(project);
  if (
    projectState?.id !== vercelScope.projectId
    || projectState?.name !== vercelScope.projectName
    || projectState?.accountId !== vercelScope.teamId
  ) throw vercelError("IN_MEMORY_VERCEL_TEST_SCOPE_MISMATCH");
  const state = structuredClone({
    domains,
    productionDeployments,
    deployments,
    environmentVariables,
    deploymentDetails,
    deploymentFiles,
  });
  const calls = [];
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(String(input));
    const method = options.method ?? "GET";
    if (
      url.origin !== "https://api.vercel.com"
      || url.searchParams.get("teamId") !== vercelScope.teamId
      || options.headers?.Authorization
        !== `Bearer ${IN_MEMORY_TEST_TOKEN}`
    ) throw vercelError("IN_MEMORY_VERCEL_TEST_SCOPE_MISMATCH");
    let body;
    if (options.body !== undefined) {
      try {
        body = JSON.parse(options.body);
      } catch {
        throw vercelError("IN_MEMORY_VERCEL_TEST_DATA_REQUIRED");
      }
      assertInMemoryTestData(body);
    }
    calls.push(Object.freeze({
      path: url.pathname,
      query: Object.freeze(Object.fromEntries(url.searchParams)),
      method,
      body: body === undefined ? undefined : structuredClone(body),
    }));
    if (url.pathname === `/v9/projects/${vercelScope.projectId}`) {
      if (method === "PATCH") {
        const keys = Object.keys(body ?? {});
        if (
          keys.length !== 1
          || !["ssoProtection", "oidcTokenConfig"].includes(keys[0])
        ) throw vercelError("IN_MEMORY_VERCEL_TEST_SCOPE_MISMATCH");
        projectState = {
          ...projectState,
          ...structuredClone(body),
        };
      } else if (method !== "GET") {
        throw vercelError("IN_MEMORY_VERCEL_TEST_SCOPE_MISMATCH");
      }
      return inMemoryJsonResponse(projectState);
    }
    if (
      method === "GET"
      && url.pathname
        === `/v9/projects/${vercelScope.projectId}/domains`
    ) return inMemoryJsonResponse({ domains: state.domains });
    if (
      method === "GET"
      && url.pathname
        === `/v10/projects/${vercelScope.projectId}/env`
    ) return inMemoryJsonResponse({
      envs: state.environmentVariables,
    });
    if (method === "GET" && url.pathname === "/v7/deployments") {
      return inMemoryJsonResponse({
        deployments: url.searchParams.get("target") === "production"
          ? state.productionDeployments
          : state.deployments,
      });
    }
    const detailsMatch =
      /^\/v13\/deployments\/(dpl_[A-Za-z0-9]{8,80})$/u.exec(
        url.pathname,
      );
    if (method === "GET" && detailsMatch !== null) {
      const details = state.deploymentDetails[detailsMatch[1]];
      return details === undefined
        ? inMemoryJsonResponse(
            { error: { code: "NOT_FOUND" } },
            404,
          )
        : inMemoryJsonResponse(details);
    }
    const filesMatch =
      /^\/v6\/deployments\/(dpl_[A-Za-z0-9]{8,80})\/files$/u.exec(
        url.pathname,
      );
    if (method === "GET" && filesMatch !== null) {
      const files = state.deploymentFiles[filesMatch[1]];
      return files === undefined
        ? inMemoryJsonResponse(
            { error: { code: "NOT_FOUND" } },
            404,
          )
        : inMemoryJsonResponse(files);
    }
    return inMemoryJsonResponse(
      { error: { code: "NOT_FOUND" } },
      404,
    );
  };
  inMemoryVercelApiTestAdapters.add(fetchImpl);
  return Object.freeze({ fetchImpl, calls });
}

function isActualReceiptJsonPath(path) {
  return (
    isRepositoryRelativePath(path)
    && ACTUAL_RECEIPT_JSON.test(path)
  );
}

async function validatedRollbackReceipt(environment, receiptOverride) {
  if (receiptOverride === null) return null;
  const configuredPath =
    environment?.LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH;
  if (
    configuredPath !== undefined
    && configuredPath !== ""
    && !isActualReceiptJsonPath(configuredPath)
  ) throw vercelError("VERCEL_ROLLBACK_RECEIPT_PATH_INVALID");
  let receipt = receiptOverride;
  if (
    configuredPath === undefined
    || configuredPath === ""
  ) {
    if (receipt === undefined) return null;
    throw vercelError("VERCEL_ROLLBACK_RECEIPT_PATH_REQUIRED");
  }
  const resolvedPath = resolve(repo, configuredPath);
  const relativeToActual = relative(
    actualReceiptsDirectory,
    resolvedPath,
  );
  if (
    relativeToActual === ""
    || relativeToActual.startsWith(`..${sep}`)
    || relativeToActual === ".."
    || isAbsolute(relativeToActual)
  ) throw vercelError("VERCEL_ROLLBACK_RECEIPT_PATH_INVALID");
  let receiptBytes;
  let configuredReceipt;
  try {
    receiptBytes = await readFile(resolvedPath);
    configuredReceipt = JSON.parse(receiptBytes.toString("utf8"));
  } catch {
    throw vercelError("VERCEL_ROLLBACK_RECEIPT_INVALID");
  }
  if (receipt === undefined) {
    receipt = configuredReceipt;
  } else if (!isDeepStrictEqual(receipt, configuredReceipt)) {
    throw vercelError("VERCEL_ROLLBACK_RECEIPT_OVERRIDE_MISMATCH");
  }
  if (
    receipt === null
    || typeof receipt !== "object"
    || Array.isArray(receipt)
    || receipt.receiptType !== "PROTECTED_PREVIEW_RECEIPT"
  ) throw vercelError("VERCEL_ROLLBACK_RECEIPT_INVALID");
  let repositoryIntegrity;
  try {
    repositoryIntegrity = await verifyReceiptRepositoryIntegrity(
      receipt,
      repo,
      {
        receiptPath: configuredPath,
        artifactVerificationMode:
          RECEIPT_ARTIFACT_VERIFICATION_MODE.DESCENDANT_EVIDENCE_COMMIT,
      },
    );
  } catch {
    throw vercelError("VERCEL_ROLLBACK_RECEIPT_INVALID");
  }
  const decisionRecordChecksum = createHash("sha256")
    .update(await readFile(
      join(activationDirectory, "owner-authorization.json"),
    ))
    .digest("hex");
  const validation = validateReceipt(receipt, {
    sourceTree: repositoryIntegrity.resolvedSourceTree,
    decisionRecordChecksum,
  });
  if (
    validation.valid !== true
    || validation.evidence !== true
    || repositoryIntegrity.errors.length !== 0
  ) throw vercelError("VERCEL_ROLLBACK_RECEIPT_INVALID");
  const activeId = receipt.providerResourceIds?.deploymentId;
  const activeUrl = receipt.providerResourceIds?.deploymentUrl;
  const rollback = receipt.rollbackDeploymentBinding;
  const artifactHashes = receipt.artifactHashes;
  if (
    !DEPLOYMENT_ID.test(activeId ?? "")
    || !DEPLOYMENT_ID.test(rollback?.deploymentId ?? "")
    || activeId === rollback.deploymentId
    || rollback?.safeDisabled !== true
    || !SHA1.test(receipt.sourceCommit ?? "")
    || !SHA1.test(receipt.sourceTree ?? "")
    || receipt.deploymentSourceCommit !== receipt.sourceCommit
    || receipt.deploymentSourceTree !== receipt.sourceTree
    || !SHA1.test(rollback?.sourceCommit ?? "")
    || !SHA1.test(rollback?.sourceTree ?? "")
    || rollback.sourceCommit !== receipt.sourceCommit
    || rollback.sourceTree !== receipt.sourceTree
    || !SHA256.test(rollback?.evidenceSha256 ?? "")
    || artifactHashes === null
    || typeof artifactHashes !== "object"
    || Array.isArray(artifactHashes)
    || Object.keys(artifactHashes).length === 0
    || Object.keys(artifactHashes).some((path) => (
      !isActualReceiptJsonPath(path)
      || path === configuredPath
    ))
    || receipt.providerResourceIds?.rollbackDeploymentId
      !== rollback.deploymentId
    || receipt.rollbackDeploymentId !== rollback.deploymentId
  ) throw vercelError("VERCEL_ROLLBACK_RECEIPT_INVALID");
  const configuredReceiptSha256 = createHash("sha256")
    .update(receiptBytes)
    .digest("hex");
  return Object.freeze({
    activeDeploymentId: activeId,
    activeDeploymentUrl: activeUrl,
    sourceCommit: receipt.sourceCommit,
    sourceTree: receipt.sourceTree,
    rollbackDeploymentId: rollback.deploymentId,
    rollbackDeploymentUrl: rollback.stagingUrl,
    rollbackSourceCommit: rollback.sourceCommit,
    rollbackSourceTree: rollback.sourceTree,
    rollbackEvidenceSha256: rollback.evidenceSha256,
    safeDisabled: true,
    configuredPath,
    configuredReceiptSha256,
    integrityVerified: true,
    artifactHashes: Object.freeze({
      ...artifactHashes,
    }),
  });
}

function parseExactFlagPairs(argv) {
  if (argv.length % 2 !== 0) {
    throw vercelError("EXACT_VERCEL_FLAG_VALUE_PAIRS_REQUIRED");
  }
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !FLAGS.has(flag)
      || typeof value !== "string"
      || value.length === 0
      || parsed.has(flag)
    ) throw vercelError("UNKNOWN_DUPLICATE_OR_EMPTY_VERCEL_FLAG");
    parsed.set(flag, value);
  }
  if (!parsed.has("--action")) {
    throw vercelError("EXPLICIT_ALLOWED_ACTION_REQUIRED");
  }
  const action = parsed.get("--action");
  if (!ACTIONS.has(action)) {
    throw vercelError("EXPLICIT_ALLOWED_ACTION_REQUIRED");
  }
  if (
    !READ_ONLY_ACTIONS.has(action)
    && parsed.get("--authorized") !== ACTIVATION_AUTHORIZATION
  ) throw vercelError("EXACT_EXTERNAL_ACTIVATION_AUTHORIZATION_REQUIRED");
  if (READ_ONLY_ACTIONS.has(action) && parsed.has("--authorized")) {
    throw vercelError("AUTHORIZATION_FLAG_FOR_READ_ONLY_ACTION_FORBIDDEN");
  }
  if (
    DEPLOYMENT_ID_ACTIONS.has(action)
      ? (
          !DEPLOYMENT_ID.test(parsed.get("--deployment-id") ?? "")
          || parsed.size !== 2
        )
      : parsed.has("--deployment-id")
  ) throw vercelError("EXACT_DEPLOYMENT_ABSENCE_SCOPE_REQUIRED");
  return parsed;
}

async function pinnedCliSnapshot() {
  try {
    return await inspectPinnedVercelCli(
      approvedVercelCliModuleRoot,
    );
  } catch {
    throw vercelError("PINNED_VERCEL_CLI_REQUIRED");
  }
}

function tokenFromCliConfig(cli) {
  verifyPinnedVercelCliSnapshot(cli);
  const { moduleRoot } = cli;
  let cliConfig;
  let cliAuth;
  try {
    cliConfig = require(join(
      moduleRoot,
      "@vercel",
      "cli-config",
      "dist",
      "index.js",
    ));
    cliAuth = require(join(
      moduleRoot,
      "@vercel",
      "cli-auth",
      "credentials-store.js",
    ));
  } catch {
    throw vercelError("VERCEL_CLI_AUTH_MODULES_REQUIRED");
  }
  const credentials = cliAuth.readCliAuthConfig(
    cliConfig.getGlobalPathConfig(),
  );
  if (
    typeof credentials?.token !== "string"
    || credentials.token.length < 20
  ) throw vercelError("VERCEL_AUTH_TOKEN_REQUIRED");
  return credentials.token;
}

function createApiCaller(token, fetchImpl) {
  return async (path, {
    method = "GET",
    body,
  } = {}) => {
    const url = new URL(path, "https://api.vercel.com");
    url.searchParams.set("teamId", vercelScope.teamId);
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw vercelError("VERCEL_API_UNAVAILABLE");
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw vercelError("VERCEL_API_INVALID_JSON");
    }
    if (!response.ok) {
      const providerCode = typeof data?.error?.code === "string"
        && /^[A-Z0-9_]{2,80}$/u.test(data.error.code)
        ? data.error.code
        : "UNKNOWN";
      throw vercelError(`VERCEL_API_${response.status}_${providerCode}`);
    }
    return data;
  };
}

async function collectPreviewFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!excludedPreviewDirectories.has(entry.name)) {
        files.push(...await collectPreviewFiles(path));
      }
    } else if (entry.isFile()) {
      files.push(path);
    } else {
      throw vercelError("PREVIEW_SOURCE_SPECIAL_FILE_FORBIDDEN");
    }
  }
  return files;
}

export async function previewSourceSha256(root = previewRoot) {
  const manifest = [];
  for (const name of approvedVercelUploadPaths) {
    const path = join(root, name);
    const digest = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
    manifest.push(`${name}\0${digest}`);
  }
  return createHash("sha256")
    .update(manifest.join("\n"), "utf8")
    .digest("hex");
}

export async function previewUploadManifest(root = previewRoot) {
  const files = [];
  for (const path of approvedVercelUploadPaths) {
    let bytes;
    try {
      bytes = await readFile(join(root, path));
    } catch {
      throw vercelError("VERCEL_APPROVED_UPLOAD_SOURCE_MISSING");
    }
    files.push(Object.freeze({
      path,
      bytes: bytes.byteLength,
      sha1: createHash("sha1").update(bytes).digest("hex"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }));
  }
  const sha256 = createHash("sha256")
    .update(files.map((file) => (
      `${file.path}\0${file.bytes}\0${file.sha256}`
    )).join("\n"), "utf8")
    .digest("hex");
  return Object.freeze({
    schemaVersion: "wp13.12b-vercel-upload-manifest-v1",
    files: Object.freeze(files),
    sha256,
  });
}

function runGitText(execFileImpl, args, code) {
  try {
    return String(execFileImpl("git", args, {
      cwd: repo,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    }));
  } catch {
    throw vercelError(code);
  }
}

function runGitBytes(execFileImpl, args, code) {
  try {
    const result = execFileImpl("git", args, {
      cwd: repo,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return Buffer.isBuffer(result)
      ? result
      : Buffer.from(String(result), "utf8");
  } catch {
    throw vercelError(code);
  }
}

function runGit(execFileImpl, args, code) {
  return runGitText(execFileImpl, args, code).trim();
}

function committedFileSha256(
  execFileImpl,
  commit,
  path,
) {
  return createHash("sha256")
    .update(runGitBytes(
      execFileImpl,
      ["show", `${commit}:${path}`],
      "REPOSITORY_RECEIPT_EVIDENCE_READ_FAILED",
    ))
    .digest("hex");
}

function committedPreviewFiles(execFileImpl, sourceCommit) {
  const prefix = `${previewRootRepositoryPath}/`;
  const output = runGitBytes(
    execFileImpl,
    [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      sourceCommit,
      "--",
      previewRootRepositoryPath,
    ],
    "VERCEL_COMMITTED_PREVIEW_TREE_READ_FAILED",
  ).toString("utf8");
  const files = new Map();
  for (const entry of output.split("\0").filter(Boolean)) {
    const match =
      /^([0-7]{6}) (blob|tree|commit) ([a-f0-9]{40})\t(.+)$/u
        .exec(entry);
    if (match === null || !match[4].startsWith(prefix)) {
      throw vercelError("VERCEL_COMMITTED_PREVIEW_TREE_INVALID");
    }
    const [, mode, type, objectId, repositoryPath] = match;
    const path = repositoryPath.slice(prefix.length);
    if (
      path.length === 0
      || path.split("/").some((segment) => (
        excludedPreviewDirectories.has(segment)
      ))
    ) continue;
    if (
      type !== "blob"
      || (mode !== "100644" && mode !== "100755")
      || files.has(path)
    ) {
      throw vercelError("VERCEL_COMMITTED_PREVIEW_TREE_INVALID");
    }
    files.set(path, runGitBytes(
      execFileImpl,
      ["cat-file", "blob", objectId],
      "VERCEL_COMMITTED_PREVIEW_BLOB_READ_FAILED",
    ));
  }
  if (files.size === 0) {
    throw vercelError("VERCEL_COMMITTED_PREVIEW_SOURCE_EMPTY");
  }
  return files;
}

export function committedPreviewSourceBinding(
  execFileImpl,
  sourceCommit,
) {
  if (!SHA1.test(sourceCommit ?? "")) {
    throw vercelError("VERCEL_COMMITTED_PREVIEW_SOURCE_INVALID");
  }
  const blobs = committedPreviewFiles(execFileImpl, sourceCommit);
  const sourceEntries = approvedVercelUploadPaths.map((path) => {
    const bytes = blobs.get(path);
    if (bytes === undefined) {
      throw vercelError("VERCEL_COMMITTED_UPLOAD_SOURCE_MISSING");
    }
    return (
      `${path}\0${createHash("sha256").update(bytes).digest("hex")}`
    );
  });
  const sourceSha256 = createHash("sha256")
    .update(sourceEntries.join("\n"), "utf8")
    .digest("hex");
  const files = approvedVercelUploadPaths.map((path) => {
    const bytes = blobs.get(path);
    if (bytes === undefined) {
      throw vercelError("VERCEL_COMMITTED_UPLOAD_SOURCE_MISSING");
    }
    return Object.freeze({
      path,
      bytes: bytes.byteLength,
      sha1: createHash("sha1").update(bytes).digest("hex"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  });
  const manifestSha256 = createHash("sha256")
    .update(files.map((file) => (
      `${file.path}\0${file.bytes}\0${file.sha256}`
    )).join("\n"), "utf8")
    .digest("hex");
  return Object.freeze({
    sourceSha256,
    uploadManifest: Object.freeze({
      schemaVersion: "wp13.12b-vercel-upload-manifest-v1",
      files: Object.freeze(files),
      sha256: manifestSha256,
    }),
  });
}

export function repositoryReadback(
  execFileImpl = createPinnedGitExecFile(),
  receipt = null,
) {
  const commit = runGit(
    execFileImpl,
    ["rev-parse", "HEAD"],
    "REPOSITORY_COMMIT_READ_FAILED",
  );
  const tree = runGit(
    execFileImpl,
    ["rev-parse", "HEAD^{tree}"],
    "REPOSITORY_TREE_READ_FAILED",
  );
  const status = runGit(
    execFileImpl,
    ["status", "--porcelain=v2", "--untracked-files=all"],
    "REPOSITORY_STATUS_READ_FAILED",
  );
  if (!SHA1.test(commit) || !SHA1.test(tree)) {
    throw vercelError("REPOSITORY_COMMIT_OR_TREE_INVALID");
  }
  if (status !== "") throw vercelError("REPOSITORY_WORKTREE_MUST_BE_CLEAN");
  if (receipt === null) {
    return Object.freeze({
      commit,
      tree,
      currentEvidenceHeadCommit: commit,
      currentEvidenceHeadTree: tree,
      deploymentSourceCommit: commit,
      deploymentSourceTree: tree,
      evidenceCommitRelationship: "DEPLOYMENT_SOURCE_HEAD",
      receiptEvidenceBinding: null,
      workingTreeClean: true,
    });
  }
  const sourceCommit = receipt?.sourceCommit;
  const sourceTree = receipt?.sourceTree;
  const receiptPath = receipt?.configuredPath;
  const receiptSha256 = receipt?.configuredReceiptSha256;
  const artifactHashes = receipt?.artifactHashes;
  if (
    receipt?.integrityVerified !== true
    || !SHA1.test(sourceCommit ?? "")
    || !SHA1.test(sourceTree ?? "")
    || receipt.rollbackSourceCommit !== sourceCommit
    || receipt.rollbackSourceTree !== sourceTree
    || !isActualReceiptJsonPath(receiptPath)
    || !SHA256.test(receiptSha256 ?? "")
    || artifactHashes === null
    || typeof artifactHashes !== "object"
    || Array.isArray(artifactHashes)
    || Object.keys(artifactHashes).length === 0
    || Object.entries(artifactHashes).some(([path, sha256]) => (
      !isActualReceiptJsonPath(path)
      || path === receiptPath
      || !SHA256.test(sha256)
    ))
  ) {
    throw vercelError("VERCEL_RECEIPT_EVIDENCE_BINDING_INVALID");
  }
  const resolvedSourceTree = runGit(
    execFileImpl,
    ["rev-parse", `${sourceCommit}^{tree}`],
    "VERCEL_RECEIPT_SOURCE_BINDING_MISMATCH",
  );
  if (resolvedSourceTree !== sourceTree) {
    throw vercelError("VERCEL_RECEIPT_SOURCE_BINDING_MISMATCH");
  }
  const evidencePaths = [
    receiptPath,
    ...Object.keys(artifactHashes),
  ].sort();
  if (commit === sourceCommit) {
    throw vercelError(
      "VERCEL_RECEIPT_EVIDENCE_DIRECT_CHILD_REQUIRED",
    );
  }
  const ancestry = runGit(
    execFileImpl,
    ["rev-list", "--parents", "-n", "1", "HEAD"],
    "VERCEL_RECEIPT_EVIDENCE_ANCESTRY_READ_FAILED",
  ).split(/\s+/u);
  if (
    ancestry.length !== 2
    || ancestry[0] !== commit
    || ancestry[1] !== sourceCommit
  ) {
    throw vercelError(
      "VERCEL_RECEIPT_EVIDENCE_DIRECT_CHILD_REQUIRED",
    );
  }
  const changedPathsRaw = runGitText(
    execFileImpl,
    [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      sourceCommit,
      commit,
    ],
    "VERCEL_RECEIPT_EVIDENCE_DIFF_READ_FAILED",
  );
  const changedPaths = changedPathsRaw === ""
    ? []
    : changedPathsRaw
      .split("\0")
      .filter((path) => path !== "")
      .sort();
  if (
    new Set(changedPaths).size !== changedPaths.length
    || changedPaths.length !== evidencePaths.length
    || changedPaths.some((
      path,
      index,
    ) => path !== evidencePaths[index])
  ) {
    throw vercelError(
      "VERCEL_RECEIPT_EVIDENCE_EXACT_DIFF_REQUIRED",
    );
  }
  const committedReceiptSha256 = committedFileSha256(
    execFileImpl,
    commit,
    receiptPath,
  );
  if (committedReceiptSha256 !== receiptSha256) {
    throw vercelError(
      "VERCEL_RECEIPT_EVIDENCE_RECEIPT_HASH_MISMATCH",
    );
  }
  for (const [path, expectedSha256] of Object.entries(
    artifactHashes,
  )) {
    if (
      committedFileSha256(execFileImpl, commit, path)
        !== expectedSha256
    ) {
      throw vercelError(
        "VERCEL_RECEIPT_EVIDENCE_ARTIFACT_HASH_MISMATCH",
      );
    }
  }
  return Object.freeze({
    commit: sourceCommit,
    tree: sourceTree,
    currentEvidenceHeadCommit: commit,
    currentEvidenceHeadTree: tree,
    deploymentSourceCommit: sourceCommit,
    deploymentSourceTree: sourceTree,
    evidenceCommitRelationship: "DIRECT_RECEIPT_EVIDENCE_CHILD",
    receiptEvidenceBinding: Object.freeze({
      receiptPath,
      receiptSha256,
      artifactPaths: Object.freeze(
        Object.keys(artifactHashes).sort(),
      ),
      artifactHashes: Object.freeze({ ...artifactHashes }),
      exactDiffVerified: true,
      // The receipt cannot contain its own byte hash. Its exact committed
      // bytes are instead bound above to the configured path and clean
      // evidence HEAD; every referenced artifact remains SHA-256-bound.
      receiptSelfHashOmittedByConstruction: true,
    }),
    workingTreeClean: true,
  });
}

export function terminalReceiptRepositoryReadback(
  execFileImpl,
  receipt,
  initialRepositoryState,
) {
  const terminalRepositoryState = repositoryReadback(
    execFileImpl,
    receipt,
  );
  if (
    !isDeepStrictEqual(
      terminalRepositoryState,
      initialRepositoryState,
    )
  ) throw vercelError("VERCEL_RECEIPT_REPOSITORY_RACE_DETECTED");
  return terminalRepositoryState;
}

function safeProject(project, domains) {
  if (
    project?.id !== vercelScope.projectId
    || project?.name !== vercelScope.projectName
    || project?.accountId !== vercelScope.teamId
    || project.framework !== null
    || project.rootDirectory !== null
    || project.buildCommand !== null
    || project.outputDirectory !== null
    || project.installCommand !== null
    || project.devCommand !== null
    || project.autoExposeSystemEnvs !== true
    || project.nodeVersion !== approvedVercelNodeVersion
    || project.live !== false
    || project.link !== null
    || project.webAnalytics !== null
    || project.speedInsights !== null
    || project.passwordProtection !== null
    || project.trustedIps !== null
    || project.protectionBypass === undefined
    || project.protectionBypass === null
    || typeof project.protectionBypass !== "object"
    || Array.isArray(project.protectionBypass)
    || Object.keys(project.protectionBypass).length !== 0
    || !Array.isArray(project.deploymentProtectionExceptions)
    || project.deploymentProtectionExceptions.length !== 0
    || project.oidcTokenConfig === undefined
    || project.oidcTokenConfig === null
    || typeof project.oidcTokenConfig.enabled !== "boolean"
    || typeof project.oidcTokenConfig.issuerMode !== "string"
    || project.ssoProtection === undefined
    || project.ssoProtection === null
    || typeof project.ssoProtection.deploymentType !== "string"
  ) throw vercelError("VERCEL_PROJECT_SCOPE_MISMATCH");
  return Object.freeze({
    id: project.id,
    name: project.name,
    accountId: project.accountId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    framework: project.framework,
    rootDirectory: project.rootDirectory,
    buildCommand: project.buildCommand,
    outputDirectory: project.outputDirectory,
    installCommand: project.installCommand,
    devCommand: project.devCommand,
    autoExposeSystemEnvs: project.autoExposeSystemEnvs,
    nodeVersion: project.nodeVersion,
    live: project.live,
    oidcTokenConfig: {
      enabled: project.oidcTokenConfig.enabled,
      issuerMode: project.oidcTokenConfig.issuerMode,
    },
    ssoProtection: project.ssoProtection,
    passwordProtectionConfigured: false,
    trustedIpsConfigured: false,
    protectionBypassConfigured: false,
    protectionExceptions: project.deploymentProtectionExceptions,
    webAnalytics: project.webAnalytics,
    speedInsights: project.speedInsights,
    domains: Object.freeze(domains.map((domain) => ({
      name: domain.name,
      verified: domain.verified ?? false,
      gitBranch: domain.gitBranch ?? null,
      customEnvironmentId: domain.customEnvironmentId ?? null,
    }))),
    link: null,
  });
}

function canonicalPreviewUrl(value) {
  if (typeof value !== "string") {
    throw vercelError("VERCEL_PREVIEW_URL_INVALID");
  }
  let parsed;
  try {
    parsed = new URL(`https://${value}`);
  } catch {
    throw vercelError("VERCEL_PREVIEW_URL_INVALID");
  }
  if (
    parsed.hostname !== value
    || !parsed.hostname.startsWith(
      `${vercelScope.projectName}-`,
    )
    || !parsed.hostname.endsWith(
      `-${vercelScope.teamSlug}.vercel.app`,
    )
  ) throw vercelError("VERCEL_PREVIEW_URL_INVALID");
  return parsed.origin;
}

function exactDeploymentUserEnvironmentKeys(deployment) {
  if (
    !Array.isArray(deployment?.env)
    || deployment.env.some((key) => (
      typeof key !== "string"
      || key.length === 0
    ))
  ) throw vercelError("VERCEL_DEPLOYMENT_ENV_READBACK_REQUIRED");
  const observed = [...deployment.env].sort();
  if (
    observed.length !== approvedVercelUserEnvironmentKeys.length
    || new Set(observed).size !== observed.length
    || observed.some((
      key,
      index,
    ) => key !== approvedVercelUserEnvironmentKeys[index])
  ) throw vercelError("VERCEL_DEPLOYMENT_ENV_ALLOWLIST_MISMATCH");
  return Object.freeze(observed);
}

function safePreviewDeployment(
  deployment,
  repository,
  sourceSha256,
  protectionVerified,
  uploadManifest,
  sourceFilesVerified,
  role,
) {
  const meta = deployment?.meta;
  const deploymentUserEnvironmentKeys =
    exactDeploymentUserEnvironmentKeys(deployment);
  if (
    !DEPLOYMENT_ID.test(deployment?.id ?? "")
    || deployment?.projectId !== vercelScope.projectId
    || deployment?.ownerId !== vercelScope.teamId
    || deployment?.name !== vercelScope.projectName
    || deployment?.readyState !== "READY"
    || deployment?.target !== null
    || deployment?.source !== "cli"
    || deployment?.oidcTokenClaims?.environment !== "preview"
    || deployment?.oidcTokenClaims?.owner_id !== vercelScope.teamId
    || deployment?.oidcTokenClaims?.project_id !== vercelScope.projectId
    || deployment?.oidcTokenClaims?.sub !== vercelScope.previewSubject
    || meta?.ludysSourceCommit !== repository.commit
    || meta?.ludysSourceTree !== repository.tree
    || meta?.ludysPreviewRoot !== previewRootRepositoryPath
    || meta?.ludysPreviewSourceSha256 !== sourceSha256
    || meta?.ludysDeploymentRole !== role
    || (
      role === "rollback"
      && meta?.ludysSafeDisabled !== "true"
    )
    || (
      role === "active"
      && (
        meta?.ludysSafeDisabled !== "false"
        || !DEPLOYMENT_ID.test(
          meta?.ludysRollbackDeploymentId ?? "",
        )
        || !SHA256.test(
          meta?.ludysRollbackEvidenceSha256 ?? "",
        )
      )
    )
    || meta?.ludysPreviewUploadManifestSha256
      !== uploadManifest.sha256
    || !SHA256.test(meta?.ludysDryRunManifestSha256 ?? "")
    || !SHA256.test(meta?.ludysStaticArtifactSha256 ?? "")
    || meta?.ludysVercelCliVersion
      !== approvedVercelCli.version
    || meta?.ludysVercelCliIntegritySha256
      !== approvedVercelCliIntegritySha256
    || !SHA256.test(sourceSha256)
    || protectionVerified !== true
    || sourceFilesVerified !== true
  ) throw vercelError("VERCEL_EXACT_PREVIEW_DEPLOYMENT_READBACK_REQUIRED");
  return Object.freeze({
    id: deployment.id,
    projectId: deployment.projectId,
    ownerId: deployment.ownerId,
    name: deployment.name,
    readyState: deployment.readyState,
    target: "preview",
    source: deployment.source,
    url: canonicalPreviewUrl(deployment.url),
    createdAt: deployment.createdAt,
    sourceCommit: meta.ludysSourceCommit,
    sourceTree: meta.ludysSourceTree,
    sourceRoot: meta.ludysPreviewRoot,
    previewSourceSha256: meta.ludysPreviewSourceSha256,
    uploadManifestSha256:
      meta.ludysPreviewUploadManifestSha256,
    dryRunManifestSha256: meta.ludysDryRunManifestSha256,
    staticArtifactSha256: meta.ludysStaticArtifactSha256,
    vercelCliVersion: meta.ludysVercelCliVersion,
    vercelCliIntegritySha256:
      meta.ludysVercelCliIntegritySha256,
    deploymentRole: role,
    deploymentRoleClaimSource:
      "AUTHENTICATED_DEPLOYMENT_METADATA_NOT_ENV_VALUE",
    safeDisabled: role === "rollback",
    rollbackDeploymentId:
      role === "active"
        ? meta.ludysRollbackDeploymentId
        : null,
    rollbackEvidenceSha256:
      role === "active"
        ? meta.ludysRollbackEvidenceSha256
        : null,
    oidcEnvironment: deployment.oidcTokenClaims.environment,
    protectionVerified,
    sourceFilesVerified,
    deploymentUserEnvironmentKeys,
    deploymentEnvironmentValuesExposedByProvider: false,
    deploymentRoleValueRequiresAuthenticatedBrowserProof: true,
  });
}

function exactProjectProtection(project) {
  return (
    project?.ssoProtection?.deploymentType
      === vercelScope.protectionMode
    && (
      project.passwordProtection === null
    )
    && (
      project.trustedIps === null
    )
    && (
      project.protectionBypass !== null
      && project.protectionBypass !== undefined
      && typeof project.protectionBypass === "object"
      && !Array.isArray(project.protectionBypass)
      && Object.keys(project.protectionBypass).length === 0
    )
    && Array.isArray(
      project.deploymentProtectionExceptions,
    )
    && project.deploymentProtectionExceptions.length === 0
  );
}

function deploymentIdOf(deployment) {
  return deployment?.id ?? deployment?.uid;
}

function deploymentStateOf(deployment) {
  return deployment?.readyState ?? deployment?.state;
}

function exactActiveSummary(
  deployment,
  repository,
  sourceSha256,
  uploadManifest,
) {
  const meta = deployment?.meta;
  return (
    deployment?.projectId === vercelScope.projectId
    && deploymentStateOf(deployment) === "READY"
    && deployment?.target === null
    && meta?.ludysDeploymentRole === "active"
    && meta?.ludysSafeDisabled === "false"
    && DEPLOYMENT_ID.test(
      meta?.ludysRollbackDeploymentId ?? "",
    )
    && SHA256.test(
      meta?.ludysRollbackEvidenceSha256 ?? "",
    )
    && meta?.ludysSourceCommit === repository.commit
    && meta?.ludysSourceTree === repository.tree
    && meta?.ludysPreviewRoot === previewRootRepositoryPath
    && meta?.ludysPreviewSourceSha256 === sourceSha256
    && meta?.ludysPreviewUploadManifestSha256
      === uploadManifest.sha256
    && SHA256.test(meta?.ludysDryRunManifestSha256 ?? "")
    && SHA256.test(meta?.ludysStaticArtifactSha256 ?? "")
    && meta?.ludysVercelCliVersion === approvedVercelCli.version
    && meta?.ludysVercelCliIntegritySha256
      === approvedVercelCliIntegritySha256
  );
}

function exactRollbackSummary(
  deployment,
  repository,
  sourceSha256,
  uploadManifest,
) {
  const meta = deployment?.meta;
  return (
    deployment?.projectId === vercelScope.projectId
    && deploymentStateOf(deployment) === "READY"
    && deployment?.target === null
    && meta?.ludysDeploymentRole === "rollback"
    && meta?.ludysSafeDisabled === "true"
    && meta?.ludysSourceCommit === repository.commit
    && meta?.ludysSourceTree === repository.tree
    && meta?.ludysPreviewRoot === previewRootRepositoryPath
    && meta?.ludysPreviewSourceSha256 === sourceSha256
    && meta?.ludysPreviewUploadManifestSha256
      === uploadManifest.sha256
    && SHA256.test(meta?.ludysDryRunManifestSha256 ?? "")
    && SHA256.test(meta?.ludysStaticArtifactSha256 ?? "")
    && meta?.ludysVercelCliVersion === approvedVercelCli.version
    && meta?.ludysVercelCliIntegritySha256
      === approvedVercelCliIntegritySha256
  );
}

function flattenDeploymentFileResponse(response) {
  const roots = Array.isArray(response)
    ? response
    : Array.isArray(response?.files)
      ? response.files
      : null;
  if (roots === null) {
    throw vercelError("VERCEL_DEPLOYMENT_FILE_READBACK_INVALID");
  }
  const flattened = [];
  const walk = (entries, prefix = "") => {
    for (const entry of entries) {
      if (
        entry === null
        || typeof entry !== "object"
        || Array.isArray(entry)
      ) throw vercelError("VERCEL_DEPLOYMENT_FILE_READBACK_INVALID");
      const rawName = entry.file ?? entry.path ?? entry.name;
      if (
        typeof rawName !== "string"
        || rawName.length === 0
        || rawName.includes("\\")
      ) throw vercelError("VERCEL_DEPLOYMENT_FILE_READBACK_INVALID");
      const path = (
        rawName.includes("/")
          ? rawName
          : `${prefix}${rawName}`
      ).replace(/^\/+/u, "");
      const children = entry.children ?? entry.files;
      if (Array.isArray(children)) {
        walk(children, `${path}/`);
        continue;
      }
      const digest =
        entry.sha256 ?? entry.sha ?? entry.digest;
      if (
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(digest ?? "")
        || flattened.some((file) => file.path === path)
      ) throw vercelError("VERCEL_DEPLOYMENT_FILE_READBACK_INVALID");
      flattened.push({ path, digest });
    }
  };
  walk(roots);
  return flattened.sort((left, right) => (
    left.path.localeCompare(right.path)
  ));
}

async function verifyDeploymentSourceFiles(
  call,
  deploymentId,
  uploadManifest,
) {
  const observed = flattenDeploymentFileResponse(await call(
    `/v6/deployments/${deploymentId}/files`,
  ));
  if (
    observed.length !== uploadManifest.files.length
    || observed.some((file, index) => {
      const expected = uploadManifest.files[index];
      return (
        file.path !== expected.path
        || (
          file.digest !== expected.sha1
          && file.digest !== expected.sha256
        )
      );
    })
  ) throw vercelError("VERCEL_DEPLOYMENT_SOURCE_FILES_MISMATCH");
  return true;
}

function canonicalReceiptDeploymentUrl(value) {
  if (typeof value !== "string") {
    throw vercelError("VERCEL_ROLLBACK_RECEIPT_INVALID");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw vercelError("VERCEL_ROLLBACK_RECEIPT_INVALID");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.origin !== value
    || !parsed.hostname.startsWith(`${vercelScope.projectName}-`)
    || !parsed.hostname.endsWith(
      `-${vercelScope.teamSlug}.vercel.app`,
    )
  ) throw vercelError("VERCEL_ROLLBACK_RECEIPT_INVALID");
  return parsed.origin;
}

function hasExactKeys(value, expectedKeys) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
  ) return false;
  const observed = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    observed.length === expected.length
    && observed.every((key, index) => key === expected[index])
  );
}

function exactIsoInstant(value) {
  if (typeof value !== "string") return null;
  const instant = new Date(value);
  return (
    !Number.isNaN(instant.valueOf())
    && instant.toISOString() === value
  ) ? instant : null;
}

export function validateAuthenticatedBrowserProof(proof, {
  repository,
  sourceSha256,
  uploadManifestSha256,
  inventory,
  now = () => new Date(),
} = {}) {
  const instant = now();
  const observedAt = exactIsoInstant(proof?.observedAt);
  const active = inventory?.previewDeployment;
  const rollback = inventory?.receiptBoundRollbackDeployment;
  const invalid = (
    !(instant instanceof Date)
    || Number.isNaN(instant.valueOf())
    || !hasExactKeys(proof, [
      "schemaVersion",
      "status",
      "observedAt",
      "teamId",
      "teamSlug",
      "projectId",
      "projectName",
      "sourceCommit",
      "sourceTree",
      "previewSourceSha256",
      "uploadManifestSha256",
      "inventory",
      "active",
      "rollback",
      "safeguards",
    ])
    || !hasExactKeys(proof?.inventory, [
      "activeDeploymentCount",
      "receiptBoundRollbackDeploymentCount",
      "unrelatedLiveDeploymentCount",
      "totalLiveDeploymentCount",
    ])
    || !hasExactKeys(proof?.active, [
      "deploymentId",
      "deploymentUrl",
      "standardProtectionSessionAuthenticated",
      "runtimeConfigStatus",
      "runtimeConfigSchemaVersion",
      "deploymentRole",
      "issuanceEnabled",
    ])
    || !hasExactKeys(proof?.rollback, [
      "deploymentId",
      "deploymentUrl",
      "standardProtectionSessionAuthenticated",
      "runtimeConfigStatus",
      "runtimeConfigSchemaVersion",
      "deploymentRole",
      "issuanceEnabled",
      "issueStatus",
      "issueDenialClass",
    ])
    || !hasExactKeys(proof?.safeguards, [
      "authenticationMode",
      "protectionBypassUsed",
      "protectionBypassCreated",
      "shareableLinkCreated",
      "oidcTokenRecorded",
      "vercelTokenRecorded",
      "participantsPresent",
      "adultOperatorOnly",
    ])
    || proof?.schemaVersion
      !== authenticatedBrowserProofSchemaVersion
    || proof?.status !== "VERIFIED"
    || observedAt === null
    || observedAt.valueOf() > instant.valueOf() + 60_000
    || instant.valueOf() - observedAt.valueOf()
      > authenticatedBrowserProofMaximumAgeMilliseconds
    || proof?.teamId !== vercelScope.teamId
    || proof?.teamSlug !== vercelScope.teamSlug
    || proof?.projectId !== vercelScope.projectId
    || proof?.projectName !== vercelScope.projectName
    || proof?.sourceCommit !== repository?.commit
    || proof?.sourceTree !== repository?.tree
    || proof?.previewSourceSha256 !== sourceSha256
    || proof?.uploadManifestSha256 !== uploadManifestSha256
    || proof?.inventory?.activeDeploymentCount !== 1
    || proof?.inventory
      ?.receiptBoundRollbackDeploymentCount !== 1
    || proof?.inventory?.unrelatedLiveDeploymentCount !== 0
    || proof?.inventory?.totalLiveDeploymentCount !== 2
    || inventory?.currentCommitPreviewCount !== 1
    || inventory?.receiptBoundRollbackDeploymentCount !== 1
    || inventory?.unrelatedLiveDeploymentCount !== 0
    || inventory?.liveDeploymentCount !== 2
    || active === null
    || rollback === null
    || proof?.active?.deploymentId !== active?.id
    || proof?.active?.deploymentUrl !== active?.url
    || proof?.active
      ?.standardProtectionSessionAuthenticated !== true
    || proof?.active?.runtimeConfigStatus !== 200
    || proof?.active?.runtimeConfigSchemaVersion
      !== "wp13.12b-external-preview-config-v1"
    || proof?.active?.deploymentRole !== "active"
    || proof?.active?.issuanceEnabled !== true
    || proof?.rollback?.deploymentId !== rollback?.id
    || proof?.rollback?.deploymentUrl !== rollback?.url
    || proof?.rollback
      ?.standardProtectionSessionAuthenticated !== true
    || proof?.rollback?.runtimeConfigStatus !== 200
    || proof?.rollback?.runtimeConfigSchemaVersion
      !== "wp13.12b-external-preview-config-v1"
    || proof?.rollback?.deploymentRole !== "rollback"
    || proof?.rollback?.issuanceEnabled !== false
    || proof?.rollback?.issueStatus !== 503
    || proof?.rollback?.issueDenialClass
      !== "ROLLBACK_SAFE_DISABLED"
    || proof?.safeguards?.authenticationMode
      !== "VERCEL_STANDARD_PROTECTION_SESSION"
    || proof?.safeguards?.protectionBypassUsed !== false
    || proof?.safeguards?.protectionBypassCreated !== false
    || proof?.safeguards?.shareableLinkCreated !== false
    || proof?.safeguards?.oidcTokenRecorded !== false
    || proof?.safeguards?.vercelTokenRecorded !== false
    || proof?.safeguards?.participantsPresent !== false
    || proof?.safeguards?.adultOperatorOnly !== true
  );
  if (invalid) {
    throw vercelError("VERCEL_AUTHENTICATED_BROWSER_PROOF_INVALID");
  }
  return Object.freeze({
    schemaVersion: proof.schemaVersion,
    status: proof.status,
    observedAt: proof.observedAt,
    teamId: proof.teamId,
    teamSlug: proof.teamSlug,
    projectId: proof.projectId,
    projectName: proof.projectName,
    sourceCommit: proof.sourceCommit,
    sourceTree: proof.sourceTree,
    previewSourceSha256: proof.previewSourceSha256,
    uploadManifestSha256: proof.uploadManifestSha256,
    maximumAgeMilliseconds:
      authenticatedBrowserProofMaximumAgeMilliseconds,
    inventory: Object.freeze({ ...proof.inventory }),
    active: Object.freeze({ ...proof.active }),
    rollback: Object.freeze({ ...proof.rollback }),
    safeguards: Object.freeze({ ...proof.safeguards }),
  });
}

async function loadAuthenticatedBrowserProof({
  environment,
  receipt,
  repository,
  sourceSha256,
  uploadManifestSha256,
  inventory,
  instant,
}) {
  const configuredPath =
    environment?.[authenticatedBrowserProofPathEnvironmentKey];
  if (configuredPath === undefined || configuredPath === "") {
    return null;
  }
  if (receipt === null) {
    throw vercelError(
      "VERCEL_AUTHENTICATED_BROWSER_PROOF_RECEIPT_REQUIRED",
    );
  }
  if (
    !isRepositoryRelativePath(configuredPath)
    || isAbsolute(configuredPath)
  ) {
    throw vercelError(
      "VERCEL_AUTHENTICATED_BROWSER_PROOF_PATH_INVALID",
    );
  }
  const resolvedPath = resolve(repo, configuredPath);
  const relativeToActual = relative(
    actualReceiptsDirectory,
    resolvedPath,
  );
  if (
    relativeToActual === ""
    || relativeToActual === ".."
    || relativeToActual.startsWith(`..${sep}`)
    || isAbsolute(relativeToActual)
    || !relativeToActual.endsWith(".json")
  ) {
    throw vercelError(
      "VERCEL_AUTHENTICATED_BROWSER_PROOF_PATH_INVALID",
    );
  }
  let bytes;
  let proof;
  try {
    bytes = await readFile(resolvedPath);
    proof = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw vercelError(
      "VERCEL_AUTHENTICATED_BROWSER_PROOF_INVALID",
    );
  }
  const artifactSha256 = createHash("sha256")
    .update(bytes)
    .digest("hex");
  if (
    receipt.artifactHashes?.[configuredPath] !== artifactSha256
  ) {
    throw vercelError(
      "VERCEL_AUTHENTICATED_BROWSER_PROOF_RECEIPT_BINDING_REQUIRED",
    );
  }
  const validated = validateAuthenticatedBrowserProof(proof, {
    repository,
    sourceSha256,
    uploadManifestSha256,
    inventory,
    now: () => instant,
  });
  return Object.freeze({
    ...validated,
    artifactPath: configuredPath,
    artifactSha256,
    receiptBound: true,
  });
}

async function receiptBoundRollbackReadback({
  call,
  deployments,
  receipt,
  activeDeployment,
}) {
  if (receipt === null) return null;
  const matching = deployments.filter((deployment) => (
    deploymentIdOf(deployment) === receipt.rollbackDeploymentId
  ));
  if (matching.length !== 1) {
    throw vercelError("VERCEL_RECEIPT_BOUND_ROLLBACK_REQUIRED");
  }
  const details = await call(
    `/v13/deployments/${receipt.rollbackDeploymentId}`,
  );
  const meta = details?.meta;
  const observedUrl = canonicalPreviewUrl(details?.url);
  const deploymentUserEnvironmentKeys =
    exactDeploymentUserEnvironmentKeys(details);
  if (
    activeDeployment === null
    || activeDeployment.id !== receipt.activeDeploymentId
    || activeDeployment.url
      !== canonicalReceiptDeploymentUrl(receipt.activeDeploymentUrl)
    || details?.projectId !== vercelScope.projectId
    || details?.ownerId !== vercelScope.teamId
    || details?.name !== vercelScope.projectName
    || details?.readyState !== "READY"
    || details?.target !== null
    || details?.source !== "cli"
    || observedUrl
      !== canonicalReceiptDeploymentUrl(
        receipt.rollbackDeploymentUrl,
      )
    || meta?.ludysDeploymentRole !== "rollback"
    || meta?.ludysSafeDisabled !== "true"
    || meta?.ludysSourceCommit !== receipt.rollbackSourceCommit
    || meta?.ludysSourceTree !== receipt.rollbackSourceTree
    || activeDeployment.rollbackDeploymentId
      !== receipt.rollbackDeploymentId
    || activeDeployment.rollbackEvidenceSha256
      !== receipt.rollbackEvidenceSha256
  ) throw vercelError("VERCEL_RECEIPT_BOUND_ROLLBACK_REQUIRED");
  return Object.freeze({
    id: details.id,
    url: observedUrl,
    projectId: details.projectId,
    ownerId: details.ownerId,
    name: details.name,
    readyState: details.readyState,
    target: "preview",
    source: details.source,
    sourceCommit: receipt.rollbackSourceCommit,
    sourceTree: receipt.rollbackSourceTree,
    evidenceSha256: receipt.rollbackEvidenceSha256,
    safeDisabled: true,
    deploymentRoleClaimSource:
      "AUTHENTICATED_DEPLOYMENT_METADATA_NOT_ENV_VALUE",
    activeDeploymentId: receipt.activeDeploymentId,
    receiptValidated: true,
    deploymentUserEnvironmentKeys,
    deploymentEnvironmentValuesExposedByProvider: false,
    deploymentRoleValueRequiresAuthenticatedBrowserProof: true,
  });
}

async function authenticatedInventory({
  call,
  project,
  repository,
  sourceSha256,
  uploadManifest,
  rollbackReceipt,
}) {
  const [
    domainResponse,
    productionResponse,
    environmentResponse,
  ] =
    await Promise.all([
      call(
        `/v9/projects/${vercelScope.projectId}/domains?limit=1`,
      ),
      call(
        "/v7/deployments"
        + `?projectId=${vercelScope.projectId}`
        + "&target=production&limit=1",
      ),
      call(
        `/v10/projects/${vercelScope.projectId}/env`
        + "?target=preview&decrypt=false&limit=100",
      ),
    ]);
  const domains = domainResponse?.domains;
  const productionDeployments = productionResponse?.deployments;
  const environmentVariables =
    environmentResponse?.envs ?? environmentResponse?.env;
  if (
    !Array.isArray(domains)
    || !Array.isArray(productionDeployments)
    || !Array.isArray(environmentVariables)
    || environmentResponse?.pagination?.next !== undefined
      && environmentResponse.pagination.next !== null
  ) throw vercelError("VERCEL_INVENTORY_READBACK_INCOMPLETE");
  const previewEnvironmentKeys = environmentVariables
    .filter((entry) => (
      Array.isArray(entry?.target)
      && entry.target.includes("preview")
    ))
    .map((entry) => entry?.key)
    .sort();
  if (
    previewEnvironmentKeys.length !== 0
    || environmentVariables.some((entry) => (
      typeof entry?.key !== "string"
      || !Array.isArray(entry?.target)
    ))
  ) throw vercelError("VERCEL_PREVIEW_PROJECT_ENV_MUST_BE_EMPTY");
  const deployments = [];
  const seenPagination = new Set();
  let until;
  for (let page = 0; page < 20; page += 1) {
    const response = await call(
      "/v7/deployments"
      + `?projectId=${vercelScope.projectId}`
      + "&limit=100"
      + (until === undefined ? "" : `&until=${until}`),
    );
    if (!Array.isArray(response?.deployments)) {
      throw vercelError("VERCEL_INVENTORY_READBACK_INCOMPLETE");
    }
    deployments.push(...response.deployments);
    const next = response?.pagination?.next;
    if (next === undefined || next === null) break;
    const cursor = String(next);
    if (
      !/^[0-9]{10,20}$/u.test(cursor)
      || seenPagination.has(cursor)
    ) throw vercelError("VERCEL_DEPLOYMENT_PAGINATION_INVALID");
    seenPagination.add(cursor);
    until = cursor;
    if (page === 19) {
      throw vercelError("VERCEL_DEPLOYMENT_INVENTORY_PAGE_LIMIT");
    }
  }
  const liveDeployments = deployments.filter((deployment) => (
    deployment?.projectId === vercelScope.projectId
    && LIVE_DEPLOYMENT_STATES.has(deploymentStateOf(deployment))
  ));
  const matching = liveDeployments.filter((deployment) => (
    exactActiveSummary(
      deployment,
      repository,
      sourceSha256,
      uploadManifest,
    )
  )).sort((left, right) => (
    Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0)
  ));
  const matchingRollback = liveDeployments.filter((deployment) => (
    exactRollbackSummary(
      deployment,
      repository,
      sourceSha256,
      uploadManifest,
    )
  )).sort((left, right) => (
    Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0)
  ));
  let previewDeployment = null;
  if (matching.length === 1) {
    const activeId = deploymentIdOf(matching[0]);
    const sourceFilesVerified =
      await verifyDeploymentSourceFiles(
        call,
        activeId,
        uploadManifest,
      );
    const details = await call(
      `/v13/deployments/${activeId}`,
    );
    previewDeployment = safePreviewDeployment(
      details,
      repository,
      sourceSha256,
      exactProjectProtection(project),
      uploadManifest,
      sourceFilesVerified,
      "active",
    );
  }
  let rollbackDeployment = null;
  if (matchingRollback.length === 1) {
    const rollbackId = deploymentIdOf(matchingRollback[0]);
    const rollbackSourceFilesVerified =
      await verifyDeploymentSourceFiles(
        call,
        rollbackId,
        uploadManifest,
      );
    const rollbackDetails = await call(
      `/v13/deployments/${rollbackId}`,
    );
    rollbackDeployment = safePreviewDeployment(
      rollbackDetails,
      repository,
      sourceSha256,
      exactProjectProtection(project),
      uploadManifest,
      rollbackSourceFilesVerified,
      "rollback",
    );
  }
  const receiptBoundRollbackDeployment =
    await receiptBoundRollbackReadback({
      call,
      deployments: liveDeployments,
      receipt: rollbackReceipt,
      activeDeployment: previewDeployment,
    });
  if (
    receiptBoundRollbackDeployment !== null
    && rollbackDeployment?.id
      !== receiptBoundRollbackDeployment.id
  ) throw vercelError("VERCEL_RECEIPT_BOUND_ROLLBACK_REQUIRED");
  const pendingRollbackDeployment =
    rollbackReceipt === null ? rollbackDeployment : null;
  const recognizedIds = new Set([
    ...(previewDeployment === null
      ? []
      : [previewDeployment.id]),
    ...(receiptBoundRollbackDeployment === null
      ? []
      : [receiptBoundRollbackDeployment.id]),
    ...(pendingRollbackDeployment === null
      ? []
      : [pendingRollbackDeployment.id]),
  ]);
  const unrelatedLiveDeployments = liveDeployments.filter(
    (deployment) => !recognizedIds.has(deploymentIdOf(deployment)),
  );
  return Object.freeze({
    domains,
    productionDeployments,
    previewEnvironmentKeys:
      Object.freeze(previewEnvironmentKeys),
    previewDeployment,
    pendingRollbackDeployment,
    receiptBoundRollbackDeployment,
    currentCommitPreviewCount: matching.length,
    rollbackPreparationDeploymentCount:
      pendingRollbackDeployment === null ? 0 : 1,
    receiptBoundRollbackDeploymentCount:
      receiptBoundRollbackDeployment === null ? 0 : 1,
    unrelatedReadyDeploymentCount:
      unrelatedLiveDeployments.filter((deployment) => (
        deploymentStateOf(deployment) === "READY"
      )).length,
    unrelatedLiveDeploymentCount:
      unrelatedLiveDeployments.length,
    unrelatedNonterminalDeploymentCount:
      unrelatedLiveDeployments.filter((deployment) => (
        NONTERMINAL_DEPLOYMENT_STATES.has(
          deploymentStateOf(deployment),
        )
      )).length,
    readyDeploymentCount:
      liveDeployments.filter((deployment) => (
        deploymentStateOf(deployment) === "READY"
      )).length,
    liveDeploymentCount: liveDeployments.length,
  });
}

async function runVercelControlCore(argv, {
  fetchImpl,
  environment = process.env,
  token,
  execFileImpl = createPinnedGitExecFile(),
  repository,
  sourceSha256,
  uploadManifest,
  rollbackReceipt,
  now = () => new Date(),
  activationCapability,
  assertBaseActivationCapabilityImpl =
    assertBaseActivationCapability,
  assertActivationWindowOpenImpl =
    assertVercelActivationWindowOpen,
} = {}) {
  const args = parseExactFlagPairs(argv);
  const action = args.get("--action");
  if (!READ_ONLY_ACTIONS.has(action)) {
    assertBaseActivationCapabilityImpl(activationCapability);
    assertActivationWindowOpenImpl({ now });
  }
  const configuredReceiptPath =
    environment?.LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH;
  const receiptModeRequested = (
    typeof configuredReceiptPath === "string"
    && configuredReceiptPath.length > 0
  ) || (
    rollbackReceipt !== undefined
    && rollbackReceipt !== null
  );
  if (
    receiptModeRequested
    && (
      repository !== undefined
      || sourceSha256 !== undefined
      || uploadManifest !== undefined
      || rollbackReceipt !== undefined
    )
  ) {
    throw vercelError(
      "VERCEL_RECEIPT_MODE_OVERRIDES_FORBIDDEN",
    );
  }
  const bearerToken = token ?? tokenFromCliConfig(
    await pinnedCliSnapshot(),
  );
  const call = createApiCaller(bearerToken, fetchImpl);
  const validatedReceipt = await validatedRollbackReceipt(
    environment,
    rollbackReceipt,
  );
  if (validatedReceipt !== null && repository !== undefined) {
    throw vercelError(
      "VERCEL_RECEIPT_REQUIRES_AUTHENTIC_REPOSITORY_READBACK",
    );
  }
  const repositoryState = repository
    ?? repositoryReadback(execFileImpl, validatedReceipt);
  const committedSourceBinding = validatedReceipt === null
    ? null
    : committedPreviewSourceBinding(
        execFileImpl,
        repositoryState.deploymentSourceCommit,
      );
  const previewDigest = committedSourceBinding?.sourceSha256
    ?? sourceSha256
    ?? await previewSourceSha256();
  const expectedUploadManifest =
    committedSourceBinding?.uploadManifest
    ?? uploadManifest
    ?? await previewUploadManifest();
  if (
    !SHA1.test(repositoryState?.commit ?? "")
    || !SHA1.test(repositoryState?.tree ?? "")
    || repositoryState?.workingTreeClean !== true
    || !SHA256.test(previewDigest)
    || expectedUploadManifest?.schemaVersion
      !== "wp13.12b-vercel-upload-manifest-v1"
    || !SHA256.test(expectedUploadManifest?.sha256 ?? "")
    || !Array.isArray(expectedUploadManifest?.files)
    || expectedUploadManifest.files.length
      !== approvedVercelUploadPaths.length
  ) throw vercelError("VERCEL_REPOSITORY_BINDING_INVALID");

  let project = await call(`/v9/projects/${vercelScope.projectId}`);
  if (
    project?.id !== vercelScope.projectId
    || project?.name !== vercelScope.projectName
    || project?.accountId !== vercelScope.teamId
  ) throw vercelError("VERCEL_PROJECT_SCOPE_MISMATCH");
  if (action === "inspect-deployment-candidate") {
    const deploymentId = args.get("--deployment-id");
    const deployment = await call(`/v13/deployments/${deploymentId}`);
    const meta = deployment?.meta;
    if (
      deployment?.id !== deploymentId
      || deployment?.projectId !== vercelScope.projectId
      || deployment?.ownerId !== vercelScope.teamId
      || deployment?.name !== vercelScope.projectName
      || deployment?.target !== null
      || deployment?.source !== "cli"
      || !Number.isSafeInteger(deployment?.createdAt)
      || deployment.createdAt <= 0
      || typeof deployment?.readyState !== "string"
      || !/^[A-Z_]{2,40}$/u.test(deployment.readyState)
      || meta?.ludysSourceCommit !== repositoryState.commit
      || meta?.ludysSourceTree !== repositoryState.tree
      || meta?.ludysPreviewRoot !== previewRootRepositoryPath
      || meta?.ludysPreviewSourceSha256 !== previewDigest
      || meta?.ludysPreviewUploadManifestSha256
        !== expectedUploadManifest.sha256
      || !SHA256.test(meta?.ludysDryRunManifestSha256 ?? "")
      || !SHA256.test(meta?.ludysStaticArtifactSha256 ?? "")
      || meta?.ludysVercelCliVersion !== approvedVercelCli.version
      || meta?.ludysVercelCliIntegritySha256
        !== approvedVercelCliIntegritySha256
      || !["active", "rollback"].includes(meta?.ludysDeploymentRole)
      || meta?.ludysSafeDisabled
        !== (meta.ludysDeploymentRole === "rollback" ? "true" : "false")
      || (
        meta?.ludysDeploymentRole === "active"
        && (
          !DEPLOYMENT_ID.test(meta?.ludysRollbackDeploymentId ?? "")
          || !SHA256.test(meta?.ludysRollbackEvidenceSha256 ?? "")
        )
      )
    ) throw vercelError("VERCEL_CLEANUP_CANDIDATE_BINDING_INVALID");
    return Object.freeze({
      schemaVersion:
        "wp13.12b-ea-vercel-cleanup-candidate-readback-v1",
      action,
      deploymentId,
      deploymentUrl: canonicalPreviewUrl(deployment.url),
      deploymentRole: meta.ludysDeploymentRole,
      createdAt: deployment.createdAt,
      projectId: deployment.projectId,
      teamId: deployment.ownerId,
      sourceCommit: meta.ludysSourceCommit,
      sourceTree: meta.ludysSourceTree,
      rollbackDeploymentId:
        meta.ludysDeploymentRole === "active"
          ? meta.ludysRollbackDeploymentId
          : null,
      rollbackEvidenceSha256:
        meta.ludysDeploymentRole === "active"
          ? meta.ludysRollbackEvidenceSha256
          : null,
      authenticatedProviderReadback: true,
      externalWrites: 0,
      tokenPrinted: false,
    });
  }
  if (action === "verify-deployment-absent") {
    const deploymentId = args.get("--deployment-id");
    let absent = false;
    try {
      await call(`/v13/deployments/${deploymentId}`);
    } catch (error) {
      absent = /^VERCEL_API_404_[A-Z0-9_]{2,80}$/u.test(
        error?.code ?? "",
      );
      if (!absent) throw error;
    }
    if (!absent) {
      throw vercelError("VERCEL_FAILED_DEPLOYMENT_STILL_PRESENT");
    }
    return Object.freeze({
      schemaVersion:
        "wp13.12b-ea-vercel-deployment-absence-readback-v1",
      action,
      deploymentId,
      absent: true,
      projectId: vercelScope.projectId,
      teamId: vercelScope.teamId,
      authenticatedProviderReadback: true,
      externalWrites: 0,
      tokenPrinted: false,
    });
  }
  let externalWrites = 0;
  if (action === "ensure-standard-protection") {
    if (
      project.ssoProtection?.deploymentType
      !== vercelScope.protectionMode
    ) {
      assertBaseActivationCapabilityImpl(activationCapability);
      assertActivationWindowOpenImpl({ now });
      project = await call(`/v9/projects/${vercelScope.projectId}`, {
        method: "PATCH",
        body: {
          ssoProtection: {
            deploymentType: vercelScope.protectionMode,
          },
        },
      });
      externalWrites = 1;
    }
    if (
      project.ssoProtection?.deploymentType
      !== vercelScope.protectionMode
    ) throw vercelError("VERCEL_STANDARD_PROTECTION_REQUIRED");
  }

  if (action === "ensure-team-oidc") {
    const expected = {
      enabled: true,
      issuerMode: trust.vercel.issuerMode,
    };
    if (
      project.oidcTokenConfig?.enabled !== expected.enabled
      || project.oidcTokenConfig?.issuerMode
        !== expected.issuerMode
    ) {
      assertBaseActivationCapabilityImpl(activationCapability);
      assertActivationWindowOpenImpl({ now });
      project = await call(`/v9/projects/${vercelScope.projectId}`, {
        method: "PATCH",
        body: { oidcTokenConfig: expected },
      });
      externalWrites = 1;
    }
    if (project.oidcTokenConfig?.enabled !== true) {
      throw vercelError("VERCEL_OIDC_MUST_BE_ENABLED");
    }
    if (project.oidcTokenConfig?.issuerMode !== "team") {
      throw vercelError("VERCEL_TEAM_ISSUER_MODE_REQUIRED");
    }
  }

  const inventory = await authenticatedInventory({
    call,
    project,
    repository: repositoryState,
    sourceSha256: previewDigest,
    uploadManifest: expectedUploadManifest,
    rollbackReceipt: validatedReceipt,
  });
  const safe = safeProject(project, inventory.domains);
  const productionDeploymentCreated =
    inventory.productionDeployments.length > 0;
  const customDomainCreated = inventory.domains.length > 0;
  const commonPreviewBoundary = (
    productionDeploymentCreated === false
    && customDomainCreated === false
    && inventory.unrelatedReadyDeploymentCount === 0
    && inventory.unrelatedLiveDeploymentCount === 0
    && inventory.unrelatedNonterminalDeploymentCount === 0
    && safe.link === null
    && safe.autoExposeSystemEnvs === true
    && inventory.previewEnvironmentKeys.length === 0
  );
  const rollbackPreparationOnly = (
    commonPreviewBoundary
    && inventory.previewDeployment === null
    && inventory.pendingRollbackDeployment !== null
    && inventory.rollbackPreparationDeploymentCount === 1
    && inventory.receiptBoundRollbackDeploymentCount === 0
    && inventory.liveDeploymentCount === 1
  );
  const sequentialPairPrepared = (
    commonPreviewBoundary
    && inventory.previewDeployment !== null
    && inventory.pendingRollbackDeployment !== null
    && inventory.previewDeployment.rollbackDeploymentId
      === inventory.pendingRollbackDeployment.id
    && inventory.rollbackPreparationDeploymentCount === 1
    && inventory.receiptBoundRollbackDeploymentCount === 0
    && inventory.liveDeploymentCount === 2
  );
  const previewOnly = (
    commonPreviewBoundary
    && inventory.previewDeployment !== null
    && inventory.previewDeployment.target === "preview"
    && inventory.currentCommitPreviewCount === 1
    && inventory.pendingRollbackDeployment === null
    && inventory.receiptBoundRollbackDeploymentCount === 1
    && inventory.liveDeploymentCount === 2
  );
  const readbackInstant = now();
  if (
    !(readbackInstant instanceof Date)
    || Number.isNaN(readbackInstant.valueOf())
  ) throw vercelError("VALID_VERCEL_READBACK_TIME_REQUIRED");
  const authenticatedBrowserProof =
    await loadAuthenticatedBrowserProof({
      environment,
      receipt: validatedReceipt,
      repository: repositoryState,
      sourceSha256: previewDigest,
      uploadManifestSha256: expectedUploadManifest.sha256,
      inventory,
      instant: readbackInstant,
    });
  const freshExactInventoryReadback = (
    previewOnly
    && inventory.currentCommitPreviewCount === 1
    && inventory.receiptBoundRollbackDeploymentCount === 1
    && inventory.unrelatedLiveDeploymentCount === 0
    && inventory.liveDeploymentCount === 2
  );
  if (validatedReceipt !== null) {
    terminalReceiptRepositoryReadback(
      execFileImpl,
      validatedReceipt,
      repositoryState,
    );
    const terminalCommittedSourceBinding =
      committedPreviewSourceBinding(
        execFileImpl,
        repositoryState.deploymentSourceCommit,
      );
    if (
      !isDeepStrictEqual(
        terminalCommittedSourceBinding,
        committedSourceBinding,
      )
    ) {
      throw vercelError(
        "VERCEL_COMMITTED_PREVIEW_SOURCE_RACE_DETECTED",
      );
    }
  }
  return Object.freeze({
    schemaVersion: "wp13.12b-ea-external-vercel-control-v2",
    action,
    externalWrites,
    team: {
      id: vercelScope.teamId,
      slug: vercelScope.teamSlug,
    },
    project: safe,
    repository: {
      commit: repositoryState.commit,
      tree: repositoryState.tree,
      deploymentSourceCommit:
        repositoryState.deploymentSourceCommit
          ?? repositoryState.commit,
      deploymentSourceTree:
        repositoryState.deploymentSourceTree
          ?? repositoryState.tree,
      currentEvidenceHeadCommit:
        repositoryState.currentEvidenceHeadCommit
          ?? repositoryState.commit,
      currentEvidenceHeadTree:
        repositoryState.currentEvidenceHeadTree
          ?? repositoryState.tree,
      evidenceCommitRelationship:
        repositoryState.evidenceCommitRelationship
          ?? "DEPLOYMENT_SOURCE_HEAD",
      receiptEvidenceBinding:
        repositoryState.receiptEvidenceBinding ?? null,
      workingTreeClean: true,
      previewRoot: previewRootRepositoryPath,
      previewSourceSha256: previewDigest,
      uploadManifestSha256: expectedUploadManifest.sha256,
    },
    previewDeployment: inventory.previewDeployment,
    pendingRollbackDeployment:
      inventory.pendingRollbackDeployment,
    receiptBoundRollbackDeployment:
      inventory.receiptBoundRollbackDeployment,
    environmentInventory: {
      previewProjectEnvironmentKeys:
        inventory.previewEnvironmentKeys,
      activeDeploymentUserEnvironmentKeys:
        inventory.previewDeployment
          ?.deploymentUserEnvironmentKeys ?? null,
      pendingRollbackDeploymentUserEnvironmentKeys:
        inventory.pendingRollbackDeployment
          ?.deploymentUserEnvironmentKeys ?? null,
      receiptBoundRollbackDeploymentUserEnvironmentKeys:
        inventory.receiptBoundRollbackDeployment
          ?.deploymentUserEnvironmentKeys ?? null,
      deploymentEnvironmentValuesExposedByProvider: false,
      deploymentRoleValuesExposedByProvider: false,
      deploymentRoleRuntimeVerification:
        "AUTHENTICATED_BROWSER_PROOF_REQUIRED",
      autoExposeSystemEnvs: safe.autoExposeSystemEnvs,
      exactAllowlistVerified:
        inventory.previewEnvironmentKeys.length === 0,
    },
    deploymentInventory: {
      authenticated: true,
      productionDeploymentCount:
        inventory.productionDeployments.length,
      customDomainCount: inventory.domains.length,
      currentCommitPreviewCount:
        inventory.currentCommitPreviewCount,
      rollbackPreparationDeploymentCount:
        inventory.rollbackPreparationDeploymentCount,
      receiptBoundRollbackDeploymentCount:
        inventory.receiptBoundRollbackDeploymentCount,
      unrelatedReadyDeploymentCount:
        inventory.unrelatedReadyDeploymentCount,
      unrelatedLiveDeploymentCount:
        inventory.unrelatedLiveDeploymentCount,
      unrelatedNonterminalDeploymentCount:
        inventory.unrelatedNonterminalDeploymentCount,
      readyDeploymentCount:
        inventory.readyDeploymentCount,
      liveDeploymentCount:
        inventory.liveDeploymentCount,
    },
    authenticatedBrowserProof,
    wifLiveGuard: {
      schemaVersion: "wp13.12b-vercel-wif-live-guard-v1",
      providerReadbackObservedAt: readbackInstant.toISOString(),
      maximumProviderReadbackAgeMilliseconds:
        vercelProviderReadbackMaximumAgeMilliseconds,
      providerReadbackAuthenticated: true,
      freshExactInventoryReadback,
      activeDeploymentCount:
        inventory.currentCommitPreviewCount,
      receiptBoundRollbackDeploymentCount:
        inventory.receiptBoundRollbackDeploymentCount,
      unrelatedLiveDeploymentCount:
        inventory.unrelatedLiveDeploymentCount,
      totalLiveDeploymentCount:
        inventory.liveDeploymentCount,
      authenticatedBrowserProofVerified:
        authenticatedBrowserProof !== null,
      oidcSubjectGranularity: "PROJECT_AND_ENVIRONMENT",
      deploymentSpecificOidcSubject: false,
      allProjectPreviewDeploymentsShareOidcSubject: true,
      newDeploymentsWhileWifLiveForbidden: true,
      gitLinkWhileWifLiveForbidden: true,
    },
    rollbackPreparationOnly,
    sequentialPairPrepared,
    previewOnly,
    productionDeploymentCreated,
    customDomainCreated,
    claimsDerivedFromAuthenticatedProviderReadback: true,
    oidcTokenValuePrinted: false,
    tokenPrinted: false,
  });
}

export async function runVercelControl(argv, options = {}) {
  const args = parseExactFlagPairs(argv);
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).some(
      (key) => key !== "activationCapability",
    )
  ) throw vercelError("PRODUCTION_VERCEL_DEPENDENCY_INJECTION_FORBIDDEN");
  const action = args.get("--action");
  if (
    !READ_ONLY_ACTIONS.has(action)
    && options.activationCapability === undefined
  ) throw vercelError("VALIDATED_ACTIVATION_CAPABILITY_REQUIRED");
  try {
    assertNoDangerousExternalEnvironment(process.env);
  } catch {
    throw vercelError(
      "VERCEL_CONTROL_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  const environment = sanitizedNodeChildEnvironment(process.env, {
    preserveKeys: [
      "LUDYS_AUTHENTICATED_BROWSER_PROOF_PATH",
      "LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH",
    ],
  });
  return runVercelControlCore(argv, {
    activationCapability: options.activationCapability,
    environment,
    execFileImpl: createPinnedGitExecFile(),
    fetchImpl: nativeFetch,
  });
}

export function runVercelControlForTesting(argv, options = {}) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || !inMemoryVercelApiTestAdapters.has(options.fetchImpl)
    || options.token !== undefined
  ) throw vercelError("IN_MEMORY_VERCEL_TEST_ADAPTER_REQUIRED");
  return runVercelControlCore(argv, {
    ...options,
    token: IN_MEMORY_TEST_TOKEN,
  });
}

function safeError(error) {
  const code = typeof error?.code === "string"
    ? error.code
    : typeof error?.message === "string"
      ? error.message
      : "";
  return /^[A-Z][A-Z0-9_]{2,160}$/u.test(code)
    ? code
    : "VERCEL_CONTROL_FAILED_CLOSED";
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && resolve(invokedPath) === fileURLToPath(import.meta.url)
) {
  try {
    const argv = process.argv.slice(2);
    const args = parseExactFlagPairs(argv);
    const activationCapability = READ_ONLY_ACTIONS.has(
      args.get("--action"),
    )
      ? undefined
      : await acquireBaseActivationCapability();
    const result = await runVercelControl(
      argv,
      activationCapability === undefined
        ? {}
        : { activationCapability },
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${safeError(error)}\n`);
    process.exitCode = 1;
  }
}
