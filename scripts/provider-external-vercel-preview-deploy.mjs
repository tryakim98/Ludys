import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  lstat,
  readdir,
  readFile,
} from "node:fs/promises";
import {
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import {
  approvedFunctionUrls,
  approvedPreviewIdentity,
} from "../provider/vercel/wp13-12b-preview/lib/runtime-config.mjs";
import {
  evaluateCopyReview,
} from "../provider/vercel/wp13-12b-preview/tools/copy-review-preflight.mjs";
import {
  buildDeployDist,
} from "../provider/vercel/wp13-12b-preview/tools/build-deploy-dist.mjs";
import {
  approvedVercelUserEnvironmentKeys,
  approvedVercelUploadPaths,
  authenticatedBrowserProofMaximumAgeMilliseconds,
  authenticatedBrowserProofPathEnvironmentKey,
  authenticatedBrowserProofSchemaVersion,
  assertVercelActivationWindowOpen,
  previewRoot,
  previewRootRepositoryPath,
  previewSourceSha256,
  previewUploadManifest,
  committedPreviewSourceBinding,
  repositoryReadback,
  runVercelControl,
  vercelScope,
} from "./provider-external-vercel-control.mjs";
import {
  approvedVercelCli,
  approvedVercelCliModuleRoot,
  approvedVercelCliIntegritySha256,
  approvedVercelNodeVersion,
  inspectPinnedVercelCli,
  verifyPinnedVercelCliSnapshot,
} from "./wp13-12b-vercel-cli-toolchain.mjs";
import {
  assertAcceptedVercelCliRisk,
  vercelCliRiskPath,
} from "./wp13-12b-vercel-cli-risk-decision.mjs";
import {
  acquireBaseActivationCapability,
  assertBaseActivationCapability,
} from "./wp13-12b-activation-phase-gate.mjs";
import {
  assertNoDangerousExternalEnvironment,
  sanitizedNodeChildEnvironment,
} from "./wp13-12b-external-process-boundary.mjs";
import {
  createPinnedGitExecFile,
} from "./wp13-12b-pinned-git-toolchain.mjs";

const nativeFetch = globalThis.fetch.bind(globalThis);

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const ACTION = "deploy-preview";
const FLAGS = new Set([
  "--action",
  "--team-id",
  "--team-slug",
  "--project-id",
  "--project-name",
  "--target",
  "--deployment-role",
  "--source-commit",
  "--source-tree",
  "--rollback-deployment-id",
  "--rollback-deployment-url",
  "--rollback-source-commit",
  "--rollback-source-tree",
  "--rollback-evidence-sha256",
  "--authorized",
]);
const BASE_FLAGS = Object.freeze([
  "--action",
  "--team-id",
  "--team-slug",
  "--project-id",
  "--project-name",
  "--target",
  "--deployment-role",
  "--source-commit",
  "--source-tree",
  "--authorized",
]);
const ACTIVE_BINDING_FLAGS = Object.freeze([
  "--rollback-deployment-id",
  "--rollback-deployment-url",
  "--rollback-source-commit",
  "--rollback-source-tree",
  "--rollback-evidence-sha256",
]);
const SHA1 = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,80}$/u;
const ROLLBACK_SAFETY_SOURCE_PATHS = Object.freeze([
  "api/delete.mjs",
  "api/issue.mjs",
  "lib/runtime-config.mjs",
]);
const scriptedPreviewCliTestAdapters = new WeakSet();
const scriptedPreviewControlTestAdapters = new WeakSet();
const scriptedPreviewWifTestAdapters = new WeakSet();
const scriptedPreviewProbeTestAdapters = new WeakSet();
export { inspectPinnedVercelCli };

function deployError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function assertScriptedTestData(value) {
  if (typeof value === "function") {
    throw deployError("IN_MEMORY_PREVIEW_TEST_DATA_REQUIRED");
  }
  if (Array.isArray(value)) {
    for (const item of value) assertScriptedTestData(item);
    return;
  }
  if (value !== null && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw deployError("IN_MEMORY_PREVIEW_TEST_DATA_REQUIRED");
    }
    for (const item of Object.values(value)) {
      assertScriptedTestData(item);
    }
  }
}

function previewCliCallKind(args) {
  if (args.length === 1 && args[0] === "--version") {
    return "version";
  }
  if (args[0] === "link") return "link";
  if (args[0] === "deploy" && args.includes("--dry")) {
    return "dry-run";
  }
  if (args[0] === "deploy") return "deploy";
  if (args[0] === "remove") return "remove";
  throw deployError("SCRIPTED_PREVIEW_CLI_CALL_FORBIDDEN");
}

export function createScriptedVercelPreviewCliForTesting(steps) {
  assertScriptedTestData(steps);
  if (
    !Array.isArray(steps)
    || steps.length === 0
    || steps.some((step) => (
      step === null
      || typeof step !== "object"
      || Array.isArray(step)
      || !["version", "link", "dry-run", "deploy", "remove"]
        .includes(step.kind)
      || typeof step.output !== "string"
      || Object.keys(step).sort().join(",") !== "kind,output"
    ))
  ) throw deployError("IN_MEMORY_PREVIEW_TEST_DATA_REQUIRED");
  const queue = structuredClone(steps);
  const calls = [];
  const runCliImpl = (args) => {
    const expected = queue.shift();
    const kind = previewCliCallKind(args);
    if (expected?.kind !== kind) {
      throw deployError("SCRIPTED_PREVIEW_CLI_SEQUENCE_MISMATCH");
    }
    calls.push(Object.freeze({
      kind,
      args: Object.freeze([...args]),
    }));
    return expected.output;
  };
  scriptedPreviewCliTestAdapters.add(runCliImpl);
  return Object.freeze({ runCliImpl, calls });
}

export function createScriptedVercelPreviewControlForTesting(steps) {
  assertScriptedTestData(steps);
  if (
    !Array.isArray(steps)
    || steps.length === 0
    || steps.some((step) => (
      step === null
      || typeof step !== "object"
      || Array.isArray(step)
      || typeof step.action !== "string"
      || step.result === null
      || typeof step.result !== "object"
      || Array.isArray(step.result)
      || Object.keys(step).sort().join(",") !== "action,result"
    ))
  ) throw deployError("IN_MEMORY_PREVIEW_TEST_DATA_REQUIRED");
  const queue = structuredClone(steps);
  const calls = [];
  const runControlImpl = async (argv) => {
    const expected = queue.shift();
    const actionIndex = argv.indexOf("--action");
    const action = actionIndex < 0 ? undefined : argv[actionIndex + 1];
    if (expected?.action !== action) {
      throw deployError("SCRIPTED_PREVIEW_CONTROL_SEQUENCE_MISMATCH");
    }
    calls.push(Object.freeze({
      action,
      argv: Object.freeze([...argv]),
    }));
    return structuredClone(expected.result);
  };
  scriptedPreviewControlTestAdapters.add(runControlImpl);
  return Object.freeze({ runControlImpl, calls });
}

export function createScriptedVercelWifReadbackForTesting(
  readbacks,
) {
  assertScriptedTestData(readbacks);
  if (!Array.isArray(readbacks) || readbacks.length === 0) {
    throw deployError("IN_MEMORY_PREVIEW_TEST_DATA_REQUIRED");
  }
  const queue = structuredClone(readbacks);
  const calls = [];
  const verifyWifDisabledImpl = async () => {
    const result = queue.shift();
    if (result === undefined) {
      throw deployError("SCRIPTED_PREVIEW_WIF_SEQUENCE_MISMATCH");
    }
    calls.push(Object.freeze({ sequence: calls.length + 1 }));
    return structuredClone(result);
  };
  scriptedPreviewWifTestAdapters.add(verifyWifDisabledImpl);
  return Object.freeze({ verifyWifDisabledImpl, calls });
}

export function createScriptedVercelProtectedProbeForTesting(result) {
  assertScriptedTestData(result);
  if (
    result === null
    || typeof result !== "object"
    || Array.isArray(result)
  ) throw deployError("IN_MEMORY_PREVIEW_TEST_DATA_REQUIRED");
  const calls = [];
  const protectedProbeImpl = async ({ deploymentRole }) => {
    calls.push(Object.freeze({ deploymentRole }));
    return structuredClone(result);
  };
  scriptedPreviewProbeTestAdapters.add(protectedProbeImpl);
  return Object.freeze({ protectedProbeImpl, calls });
}

async function defaultVerifyVercelCliRiskDecision() {
  let contract;
  try {
    contract = JSON.parse(await readFile(
      join(repoRoot, ...vercelCliRiskPath.split("/")),
      "utf8",
    ));
  } catch {
    throw deployError("VERCEL_CLI_TOOLING_RISK_DECISION_REQUIRED");
  }
  try {
    return assertAcceptedVercelCliRisk(contract);
  } catch (error) {
    if (error?.message === "VERCEL_CLI_EXECUTION_NOT_AUTHORIZED") {
      throw deployError("VERCEL_CLI_EXECUTION_NOT_AUTHORIZED");
    }
    throw deployError("VERCEL_CLI_TOOLING_RISK_DECISION_REQUIRED");
  }
}

function parseExactFlagPairs(argv) {
  if (argv.length % 2 !== 0) {
    throw deployError("EXACT_PREVIEW_DEPLOY_FLAG_VALUE_PAIRS_REQUIRED");
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
    ) throw deployError("UNKNOWN_DUPLICATE_OR_EMPTY_PREVIEW_DEPLOY_FLAG");
    parsed.set(flag, value);
  }
  for (const flag of BASE_FLAGS) {
    if (!parsed.has(flag)) {
      throw deployError("PREVIEW_DEPLOY_REQUIRED_FLAG_MISSING");
    }
  }
  const role = parsed.get("--deployment-role");
  if (role === "active") {
    for (const flag of ACTIVE_BINDING_FLAGS) {
      if (!parsed.has(flag)) {
        throw deployError("ACTIVE_ROLLBACK_BINDING_REQUIRED");
      }
    }
  } else if (role === "rollback") {
    if (ACTIVE_BINDING_FLAGS.some((flag) => parsed.has(flag))) {
      throw deployError("ROLLBACK_MUST_BE_DEPLOYED_BEFORE_ACTIVE");
    }
  } else {
    throw deployError("EXACT_DEPLOYMENT_ROLE_REQUIRED");
  }
  return parsed;
}

function assertExactScope(args) {
  if (
    args.get("--action") !== ACTION
    || args.get("--team-id") !== vercelScope.teamId
    || args.get("--team-slug") !== vercelScope.teamSlug
    || args.get("--project-id") !== vercelScope.projectId
    || args.get("--project-name") !== vercelScope.projectName
    || args.get("--target") !== "preview"
    || !["active", "rollback"].includes(
      args.get("--deployment-role"),
    )
  ) throw deployError("PREVIEW_DEPLOY_SCOPE_OR_TARGET_MISMATCH");
  if (
    args.get("--authorized")
    !== vercelScope.activationAuthorization
  ) throw deployError("EXACT_EXTERNAL_ACTIVATION_AUTHORIZATION_REQUIRED");
  if (
    !SHA1.test(args.get("--source-commit"))
    || !SHA1.test(args.get("--source-tree"))
  ) throw deployError("PREVIEW_DEPLOY_COMMIT_OR_TREE_INVALID");
}

function activeRollbackBinding(args) {
  if (args.get("--deployment-role") !== "active") return null;
  const value = {
    id: args.get("--rollback-deployment-id"),
    url: args.get("--rollback-deployment-url"),
    sourceCommit: args.get("--rollback-source-commit"),
    sourceTree: args.get("--rollback-source-tree"),
    evidenceSha256: args.get("--rollback-evidence-sha256"),
  };
  if (
    !DEPLOYMENT_ID.test(value.id ?? "")
    || !SHA1.test(value.sourceCommit ?? "")
    || !SHA1.test(value.sourceTree ?? "")
    || !SHA256.test(value.evidenceSha256 ?? "")
    || canonicalCliDeploymentOrigin(value.url) !== value.url
  ) throw deployError("ACTIVE_ROLLBACK_BINDING_INVALID");
  return Object.freeze(value);
}

function pathInside(parent, child) {
  const value = relative(parent, child);
  return (
    value !== ""
    && !isAbsolute(value)
    && value !== ".."
    && !value.startsWith(`..${sep}`)
  );
}

function productionGitBytes(execFileImpl, args, code) {
  try {
    const output = execFileImpl(
      "git",
      [
        "-c",
        `safe.directory=${repoRoot.replaceAll("\\", "/")}`,
        ...args,
      ],
      {
        cwd: repoRoot,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return Buffer.isBuffer(output) ? output : Buffer.from(output);
  } catch {
    throw deployError(code);
  }
}

function assertNoPreviewIndexMasking(execFileImpl) {
  const tagged = productionGitBytes(
    execFileImpl,
    ["ls-files", "-v", "-z", "--", previewRootRepositoryPath],
    "PREVIEW_GIT_INDEX_FLAGS_READ_FAILED",
  ).toString("utf8").split("\0").filter(Boolean);
  if (
    tagged.some((entry) => (
      entry.length < 3
      || entry[1] !== " "
      || entry[0] !== "H"
    ))
  ) throw deployError("PREVIEW_GIT_INDEX_MASKING_FORBIDDEN");
}

function assertNoIgnoredPreviewResidue(execFileImpl) {
  const ignored = productionGitBytes(
    execFileImpl,
    [
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "-z",
      "--",
      previewRootRepositoryPath,
    ],
    "PREVIEW_IGNORED_RESIDUE_READ_FAILED",
  );
  if (ignored.length !== 0) {
    throw deployError("PREVIEW_IGNORED_RESIDUE_FORBIDDEN");
  }
}

async function assertNoPreviewSpecialEntries(directory = previewRoot) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    throw deployError("PREVIEW_WORKSPACE_TREE_UNREADABLE");
  }
  for (const entry of entries) {
    const target = join(directory, entry.name);
    let metadata;
    try {
      metadata = await lstat(target);
    } catch {
      throw deployError("PREVIEW_WORKSPACE_TREE_UNREADABLE");
    }
    if (metadata.isSymbolicLink()) {
      throw deployError("PREVIEW_SOURCE_SPECIAL_FILE_FORBIDDEN");
    }
    if (metadata.isDirectory()) {
      await assertNoPreviewSpecialEntries(target);
    } else if (!metadata.isFile()) {
      throw deployError("PREVIEW_SOURCE_SPECIAL_FILE_FORBIDDEN");
    }
  }
}

async function assertProductionPreviewWorkspaceBinding(
  repositoryState,
  committedBinding,
  execFileImpl,
  { rejectIgnoredResidue = false } = {},
) {
  const terminal = repositoryReadback(execFileImpl);
  if (
    terminal.commit !== repositoryState.commit
    || terminal.tree !== repositoryState.tree
    || terminal.workingTreeClean !== true
  ) throw deployError("PREVIEW_DEPLOY_REPOSITORY_RACE_DETECTED");
  assertNoPreviewIndexMasking(execFileImpl);
  if (rejectIgnoredResidue) {
    assertNoIgnoredPreviewResidue(execFileImpl);
  }
  await assertNoPreviewSpecialEntries();
  const liveManifest = await previewUploadManifest();
  const liveSourceSha256 = await previewSourceSha256();
  if (
    liveSourceSha256 !== committedBinding.sourceSha256
    || JSON.stringify(liveManifest)
      !== JSON.stringify(committedBinding.uploadManifest)
  ) throw deployError("PREVIEW_WORKSPACE_NOT_COMMITTED_BLOB_EXACT");
  return Object.freeze({
    repository: terminal,
    sourceSha256: liveSourceSha256,
    uploadManifestSha256: liveManifest.sha256,
  });
}

export function boundedCapturedCliStdout(error) {
  const stdout = Buffer.isBuffer(error?.stdout)
    ? error.stdout.toString("utf8")
    : typeof error?.stdout === "string"
      ? error.stdout
      : "";
  if (stdout.length === 0 || stdout.length > 4 * 1024 * 1024) {
    return null;
  }
  return stdout.trim();
}

function defaultRunCli(args, {
  cli,
  environment,
} = {}) {
  if (
    cli?.version !== approvedVercelCli.version
    || cli?.npmIntegrity !== approvedVercelCli.npmIntegrity
    || typeof cli?.entryPath !== "string"
  ) throw deployError("PINNED_VERCEL_CLI_REQUIRED");
  verifyPinnedVercelCliSnapshot(cli);
  try {
    return String(execFileSync(
      process.execPath,
      [cli.entryPath, ...args],
      {
      cwd: previewRoot,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: environment,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
    },
    )).trim();
  } catch (error) {
    const failure = deployError("VERCEL_PREVIEW_CLI_FAILED");
    const stdout = boundedCapturedCliStdout(error);
    if (stdout !== null) {
      Object.defineProperty(failure, "capturedStdout", {
        value: stdout,
        enumerable: false,
      });
    }
    throw failure;
  }
}

async function defaultLinkedProjectReadback() {
  try {
    return JSON.parse(await readFile(
      join(previewRoot, ".vercel", "project.json"),
      "utf8",
    ));
  } catch {
    throw deployError("VERCEL_LINK_READBACK_REQUIRED");
  }
}

function runtimeEnvironmentArgs(role) {
  if (role !== "active" && role !== "rollback") {
    throw deployError("EXACT_DEPLOYMENT_ROLE_REQUIRED");
  }
  const values = Object.freeze({
    LUDYS_DEPLOYMENT_ROLE: role,
    LUDYS_GCP_PROJECT_NUMBER:
      approvedPreviewIdentity.projectNumber,
    LUDYS_GCP_WIF_POOL_ID:
      approvedPreviewIdentity.poolId,
    LUDYS_GCP_WIF_PROVIDER_ID:
      approvedPreviewIdentity.providerId,
    LUDYS_GCP_PREVIEW_SERVICE_ACCOUNT:
      approvedPreviewIdentity.serviceAccount,
    LUDYS_ISSUE_FUNCTION_URL:
      approvedFunctionUrls.issue,
    LUDYS_DELETE_FUNCTION_URL:
      approvedFunctionUrls.delete,
    LUDYS_COMMAND_FUNCTION_URL:
      approvedFunctionUrls.command,
    LUDYS_PROJECTION_FUNCTION_URL:
      approvedFunctionUrls.projection,
  });
  return Object.freeze(Object.entries(values).flatMap(([key, value]) => [
    "--env",
    `${key}=${value}`,
  ]));
}

export function exactPreviewDeploymentArgs({
  commit,
  tree,
  sourceSha256,
  uploadManifestSha256,
  dryRunManifestSha256,
  staticArtifactSha256,
  role,
  rollbackBinding = null,
}) {
  if (
    !SHA1.test(commit)
    || !SHA1.test(tree)
    || !SHA256.test(sourceSha256)
    || !SHA256.test(uploadManifestSha256)
    || !SHA256.test(dryRunManifestSha256)
    || !SHA256.test(staticArtifactSha256)
    || !["active", "rollback"].includes(role)
    || (
      role === "rollback"
      && rollbackBinding !== null
    )
    || (
      role === "active"
      && (
        !DEPLOYMENT_ID.test(rollbackBinding?.id ?? "")
        || canonicalCliDeploymentOrigin(
          rollbackBinding?.url,
        ) !== rollbackBinding.url
        || !SHA1.test(rollbackBinding?.sourceCommit ?? "")
        || !SHA1.test(rollbackBinding?.sourceTree ?? "")
        || !SHA256.test(rollbackBinding?.evidenceSha256 ?? "")
      )
    )
  ) throw deployError("PREVIEW_DEPLOY_METADATA_INVALID");
  const roleMetadata = role === "rollback"
    ? [
        "--meta",
        "ludysSafeDisabled=true",
      ]
    : [
        "--meta",
        "ludysSafeDisabled=false",
        "--meta",
        `ludysRollbackDeploymentId=${rollbackBinding.id}`,
        "--meta",
        `ludysRollbackEvidenceSha256=${rollbackBinding.evidenceSha256}`,
      ];
  return Object.freeze([
    "deploy",
    "--yes",
    "--json",
    "--scope",
    vercelScope.teamSlug,
    "--target=preview",
    "--meta",
    `ludysSourceCommit=${commit}`,
    "--meta",
    `ludysSourceTree=${tree}`,
    "--meta",
    `ludysPreviewRoot=${previewRootRepositoryPath}`,
    "--meta",
    `ludysPreviewSourceSha256=${sourceSha256}`,
    "--meta",
    `ludysDeploymentRole=${role}`,
    "--meta",
    `ludysPreviewUploadManifestSha256=${uploadManifestSha256}`,
    "--meta",
    `ludysDryRunManifestSha256=${dryRunManifestSha256}`,
    "--meta",
    `ludysStaticArtifactSha256=${staticArtifactSha256}`,
    "--meta",
    `ludysVercelCliVersion=${approvedVercelCli.version}`,
    "--meta",
    `ludysVercelCliIntegritySha256=${approvedVercelCliIntegritySha256}`,
    ...roleMetadata,
    ...runtimeEnvironmentArgs(role),
  ]);
}

function dryRunFiles(value) {
  const files = value?.files;
  if (!Array.isArray(files)) {
    throw deployError("VERCEL_DRY_RUN_MANIFEST_INVALID");
  }
  const observedPaths = new Set();
  return files.map((file) => {
    if (
      file === null
      || typeof file !== "object"
      || Array.isArray(file)
      || Object.keys(file).sort().join(",") !== "mode,path,sha,size"
    ) throw deployError("VERCEL_DRY_RUN_MANIFEST_INVALID");
    const path = file.path;
    const sha1 = file?.sha;
    const bytes = file.size;
    const mode = file?.mode;
    if (
      typeof path !== "string"
      || path.length === 0
      || path.includes("\\")
      || path.startsWith("/")
      || path.split("/").some((part) => (
        part === "" || part === "." || part === ".."
      ))
      || observedPaths.has(path)
      || !/^[a-f0-9]{40}$/u.test(sha1 ?? "")
      || !Number.isInteger(bytes)
      || bytes < 0
      || !(
        Number.isInteger(mode)
        || /^(?:0o)?[0-7]{3,6}$/u.test(mode ?? "")
      )
    ) throw deployError("VERCEL_DRY_RUN_MANIFEST_INVALID");
    observedPaths.add(path);
    return Object.freeze({
      path,
      sha1,
      bytes,
      mode: String(mode),
    });
  }).sort((left, right) => left.path.localeCompare(right.path));
}

export function validateDryRunManifest(raw, uploadManifest) {
  if (
    raw === null
    || typeof raw !== "object"
    || Array.isArray(raw)
    || !Object.hasOwn(raw, "framework")
    || raw.framework !== null
    || uploadManifest?.schemaVersion
      !== "wp13.12b-vercel-upload-manifest-v1"
    || uploadManifest.files.length
      !== approvedVercelUploadPaths.length
  ) throw deployError("VERCEL_DRY_RUN_FRAMEWORK_OR_SOURCE_INVALID");
  const files = dryRunFiles(raw);
  if (
    files.length !== uploadManifest.files.length
    || files.some((file, index) => {
      const expected = uploadManifest.files[index];
      return (
        file.path !== expected.path
        || file.sha1 !== expected.sha1
        || file.bytes !== expected.bytes
      );
    })
  ) throw deployError("VERCEL_DRY_RUN_UPLOAD_ALLOWLIST_MISMATCH");
  const sha256 = createHash("sha256")
    .update(files.map((file) => (
      `${file.path}\0${file.bytes}\0${file.mode}\0${file.sha1}`
    )).join("\n")
      + `\nUPLOAD_SHA256\0${uploadManifest.sha256}`, "utf8")
    .digest("hex");
  return Object.freeze({
    schemaVersion: "wp13.12b-vercel-dry-run-manifest-v1",
    framework: raw.framework,
    fileCount: files.length,
    files: Object.freeze(files),
    sha256,
  });
}

export async function verifyRollbackSafetySource({
  uploadManifest,
  readFileImpl = readFile,
} = {}) {
  if (
    uploadManifest?.schemaVersion
      !== "wp13.12b-vercel-upload-manifest-v1"
    || !SHA256.test(uploadManifest?.sha256 ?? "")
  ) throw deployError("ROLLBACK_SAFETY_SOURCE_BINDING_INVALID");
  const entries = [];
  const source = new Map();
  for (const path of ROLLBACK_SAFETY_SOURCE_PATHS) {
    let bytes;
    try {
      bytes = await readFileImpl(join(previewRoot, path));
    } catch {
      throw deployError("ROLLBACK_SAFETY_SOURCE_BINDING_INVALID");
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const expected = uploadManifest.files.find((file) => file.path === path);
    if (
      expected?.bytes !== bytes.length
      || expected?.sha256 !== sha256
    ) throw deployError("ROLLBACK_SAFETY_SOURCE_NOT_UPLOAD_BOUND");
    entries.push(Object.freeze({
      path,
      bytes: bytes.length,
      sha256,
    }));
    source.set(path, bytes.toString("utf8"));
  }
  const issue = source.get("api/issue.mjs");
  const deleteRoute = source.get("api/delete.mjs");
  const runtime = source.get("lib/runtime-config.mjs");
  const sameOriginIndex =
    issue.indexOf("requireSameOriginPost(request, env);");
  const safeDisabledIndex =
    issue.indexOf('deploymentRole(env) !== "active"');
  if (
    sameOriginIndex < 0
    || safeDisabledIndex <= sameOriginIndex
    || !issue.includes(
      'throw new SafeHttpError(503, "ROLLBACK_SAFE_DISABLED");',
    )
    || deleteRoute.includes("deploymentRole(")
    || !deleteRoute.includes("privateFunctionUrls(env).delete")
    || !runtime.includes(
      'role !== "active" && role !== "rollback"',
    )
    || !runtime.includes('issuanceEnabled: role === "active"')
  ) throw deployError("ROLLBACK_SAFETY_SOURCE_CONTRACT_MISSING");
  const sha256 = createHash("sha256")
    .update(entries.map((entry) => (
      `${entry.path}\0${entry.bytes}\0${entry.sha256}`
    )).join("\n"), "utf8")
    .digest("hex");
  return Object.freeze({
    schemaVersion:
      "wp13.12b-vercel-rollback-safety-source-binding-v1",
    sha256,
    uploadManifestSha256: uploadManifest.sha256,
    uploadManifestBound: true,
    issuanceDeniedBeforeIdentityExchange: true,
    deleteRouteAvailable: true,
    files: Object.freeze(entries),
  });
}

function exactDryRunArgs() {
  return Object.freeze([
    "deploy",
    "--dry",
    "--format=json",
    "--yes",
    "--scope",
    vercelScope.teamSlug,
    "--target=preview",
  ]);
}

function parseCliJson(output, code) {
  try {
    return JSON.parse(output);
  } catch {
    throw deployError(code);
  }
}

function defaultVerifyWifDisabled({
  environment,
} = {}) {
  let output;
  try {
    output = String(execFileSync(process.execPath, [
      resolve(
        previewRoot,
        "..",
        "..",
        "..",
        "scripts",
        "provider-external-wif-control.mjs",
      ),
      "--action",
      "verify-disabled",
    ], {
      cwd: resolve(previewRoot, "..", "..", ".."),
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: environment,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    })).trim();
  } catch {
    throw deployError("WIF_DISABLED_READBACK_REQUIRED_BEFORE_DEPLOY");
  }
  const readback = parseCliJson(
    output,
    "WIF_DISABLED_READBACK_REQUIRED_BEFORE_DEPLOY",
  );
  if (
    readback?.schemaVersion
      !== "wp13.12b-ea-external-wif-control-v1"
    || readback?.action !== "verify-disabled"
    || readback?.externalWrites !== 0
    || readback?.complete !== true
    || readback?.expectedTrustState !== "disabled"
    || readback?.state?.pool?.disabled !== true
    || readback?.state?.provider?.disabled !== true
  ) throw deployError("WIF_DISABLED_READBACK_REQUIRED_BEFORE_DEPLOY");
  return readback;
}

async function defaultProtectedProbe({
  deploymentOrigin,
  deploymentRole,
  fetchImpl,
}) {
  let challenge;
  try {
    challenge = await fetchImpl(deploymentOrigin, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    throw deployError("VERCEL_PROTECTION_CHALLENGE_PROBE_FAILED");
  }
  if (![401, 403].includes(challenge.status)) {
    throw deployError("VERCEL_PROTECTION_CHALLENGE_PROBE_FAILED");
  }
  return Object.freeze({
    protectionChallengeStatus: challenge.status,
    deploymentRole,
    authenticatedProbePerformed: false,
    authenticatedBrowserProofRequired: true,
    protectionBypassCreated: false,
    shareableLinkCreated: false,
    tokenPrinted: false,
  });
}

function canonicalCliDeploymentOrigin(value) {
  if (typeof value !== "string") {
    throw deployError("VERCEL_CLI_DEPLOYMENT_URL_INVALID");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw deployError("VERCEL_CLI_DEPLOYMENT_URL_INVALID");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.origin !== value
    || !parsed.hostname.startsWith(`${vercelScope.projectName}-`)
    || !parsed.hostname.endsWith(
      `-${vercelScope.teamSlug}.vercel.app`,
    )
  ) throw deployError("VERCEL_CLI_DEPLOYMENT_URL_INVALID");
  return parsed.origin;
}

export function returnedDeploymentIdentity(output) {
  try {
    const value = parseCliJson(
      output,
      "VERCEL_FAILED_ATTEMPT_MANUAL_INVENTORY_REQUIRED",
    );
    if (
      value === null
      || typeof value !== "object"
      || Array.isArray(value)
      || !DEPLOYMENT_ID.test(value.id ?? "")
      || canonicalCliDeploymentOrigin(value.url) !== value.url
    ) {
      throw deployError(
        "VERCEL_FAILED_ATTEMPT_MANUAL_INVENTORY_REQUIRED",
      );
    }
    return Object.freeze({ id: value.id, url: value.url });
  } catch {
    throw deployError("VERCEL_FAILED_ATTEMPT_MANUAL_INVENTORY_REQUIRED");
  }
}

export function parseCreatedDeployment(output) {
  const value = parseCliJson(
    output,
    "VERCEL_PREVIEW_DEPLOYMENT_OUTPUT_INVALID",
  );
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || !DEPLOYMENT_ID.test(value.id ?? "")
    || canonicalCliDeploymentOrigin(value.url) !== value.url
    || value.target !== null
    || typeof value.readyState !== "string"
  ) throw deployError("VERCEL_PREVIEW_DEPLOYMENT_OUTPUT_INVALID");
  return Object.freeze({
    id: value.id,
    url: value.url,
  });
}

export function buildFailedPreviewCleanupPlan({
  returnedIdentity,
  candidateReadback,
  before,
  afterFailure,
  deploymentRole,
  rollbackBinding,
}) {
  const beforeObservedAt = Date.parse(
    before?.wifLiveGuard?.providerReadbackObservedAt ?? "",
  );
  const preExistingIds = new Set([
    before?.previewDeployment?.id,
    before?.pendingRollbackDeployment?.id,
    before?.receiptBoundRollbackDeployment?.id,
  ].filter(Boolean));
  const commonAfterBoundary = (
    before?.claimsDerivedFromAuthenticatedProviderReadback === true
    && before?.productionDeploymentCreated === false
    && before?.customDomainCreated === false
    && afterFailure?.claimsDerivedFromAuthenticatedProviderReadback === true
    && afterFailure?.productionDeploymentCreated === false
    && afterFailure?.customDomainCreated === false
    && afterFailure?.deploymentInventory?.unrelatedLiveDeploymentCount === 0
    && afterFailure?.deploymentInventory
      ?.unrelatedNonterminalDeploymentCount === 0
  );
  const exactRoleDiff = deploymentRole === "active"
    ? (
        before?.rollbackPreparationOnly === true
        && before?.previewDeployment === null
        && before?.pendingRollbackDeployment?.id === rollbackBinding?.id
        && before?.pendingRollbackDeployment?.url === rollbackBinding?.url
        && before?.deploymentInventory?.liveDeploymentCount === 1
        && afterFailure?.sequentialPairPrepared === true
        && afterFailure?.previewDeployment?.id === returnedIdentity?.id
        && afterFailure?.previewDeployment?.url === returnedIdentity?.url
        && afterFailure?.pendingRollbackDeployment?.id
          === rollbackBinding?.id
        && afterFailure?.pendingRollbackDeployment?.url
          === rollbackBinding?.url
        && afterFailure?.deploymentInventory?.liveDeploymentCount === 2
        && candidateReadback?.rollbackDeploymentId
          === rollbackBinding?.id
        && candidateReadback?.rollbackEvidenceSha256
          === rollbackBinding?.evidenceSha256
      )
    : deploymentRole === "rollback"
      ? (
          before?.rollbackPreparationOnly !== true
          && before?.previewDeployment === null
          && before?.pendingRollbackDeployment === null
          && before?.deploymentInventory?.liveDeploymentCount === 0
          && afterFailure?.rollbackPreparationOnly === true
          && afterFailure?.previewDeployment === null
          && afterFailure?.pendingRollbackDeployment?.id
            === returnedIdentity?.id
          && afterFailure?.pendingRollbackDeployment?.url
            === returnedIdentity?.url
          && afterFailure?.deploymentInventory?.liveDeploymentCount === 1
          && candidateReadback?.rollbackDeploymentId === null
          && candidateReadback?.rollbackEvidenceSha256 === null
        )
      : false;
  let returnedUrlValid = false;
  try {
    returnedUrlValid = canonicalCliDeploymentOrigin(
      returnedIdentity?.url,
    ) === returnedIdentity?.url;
  } catch {
    returnedUrlValid = false;
  }
  if (
    !DEPLOYMENT_ID.test(returnedIdentity?.id ?? "")
    || !returnedUrlValid
    || preExistingIds.has(returnedIdentity.id)
    || returnedIdentity.id === rollbackBinding?.id
    || !Number.isFinite(beforeObservedAt)
    || candidateReadback?.schemaVersion
      !== "wp13.12b-ea-vercel-cleanup-candidate-readback-v1"
    || candidateReadback?.action !== "inspect-deployment-candidate"
    || candidateReadback?.deploymentId !== returnedIdentity.id
    || candidateReadback?.deploymentUrl !== returnedIdentity.url
    || candidateReadback?.deploymentRole !== deploymentRole
    || candidateReadback?.projectId !== vercelScope.projectId
    || candidateReadback?.teamId !== vercelScope.teamId
    || candidateReadback?.sourceCommit !== before?.repository?.commit
    || candidateReadback?.sourceTree !== before?.repository?.tree
    || candidateReadback?.authenticatedProviderReadback !== true
    || candidateReadback?.externalWrites !== 0
    || candidateReadback?.tokenPrinted !== false
    || !Number.isSafeInteger(candidateReadback?.createdAt)
    || candidateReadback.createdAt <= beforeObservedAt
    || !commonAfterBoundary
    || !exactRoleDiff
  ) {
    throw deployError(
      "VERCEL_FAILED_ATTEMPT_MANUAL_INVENTORY_REQUIRED",
    );
  }
  return Object.freeze({
    deploymentId: returnedIdentity.id,
    removeArgs: Object.freeze([
      "remove",
      returnedIdentity.id,
      "--yes",
      "--scope",
      vercelScope.teamSlug,
    ]),
    authenticatedAttemptIdentityVerified: true,
    preExistingDeploymentProtected: true,
  });
}

export function validateFailedDeploymentCleanupReadback({
  createdDeploymentId,
  absenceReadback,
  before,
  verified,
  deploymentRole,
  rollbackBinding,
}) {
  const exactAbsence = (
    DEPLOYMENT_ID.test(createdDeploymentId ?? "")
    && absenceReadback?.schemaVersion
      === "wp13.12b-ea-vercel-deployment-absence-readback-v1"
    && absenceReadback?.action === "verify-deployment-absent"
    && absenceReadback?.deploymentId === createdDeploymentId
    && absenceReadback?.absent === true
    && absenceReadback?.projectId === vercelScope.projectId
    && absenceReadback?.teamId === vercelScope.teamId
    && absenceReadback?.authenticatedProviderReadback === true
    && absenceReadback?.externalWrites === 0
    && absenceReadback?.tokenPrinted === false
  );
  const rollbackPreserved = deploymentRole === "active"
    ? (
        before?.rollbackPreparationOnly === true
        && before?.previewDeployment === null
        && before?.pendingRollbackDeployment?.id === rollbackBinding?.id
        && before?.pendingRollbackDeployment?.url === rollbackBinding?.url
        && before?.deploymentInventory?.liveDeploymentCount === 1
        && verified?.rollbackPreparationOnly === true
        && verified?.previewDeployment === null
        && verified?.pendingRollbackDeployment?.id
          === rollbackBinding?.id
        && verified?.pendingRollbackDeployment?.url
          === rollbackBinding?.url
        && verified?.deploymentInventory?.liveDeploymentCount === 1
      )
    : deploymentRole === "rollback"
      ? (
          before?.rollbackPreparationOnly !== true
          && before?.previewDeployment === null
          && before?.pendingRollbackDeployment === null
          && before?.deploymentInventory?.liveDeploymentCount === 0
          && verified?.rollbackPreparationOnly !== true
          && verified?.previewDeployment === null
          && verified?.pendingRollbackDeployment === null
          && verified?.deploymentInventory?.liveDeploymentCount === 0
        )
      : false;
  if (
    !exactAbsence
    || !rollbackPreserved
    || verified?.claimsDerivedFromAuthenticatedProviderReadback !== true
    || verified?.deploymentInventory?.unrelatedLiveDeploymentCount !== 0
    || verified?.deploymentInventory?.unrelatedNonterminalDeploymentCount
      !== 0
    || verified?.productionDeploymentCreated !== false
    || verified?.customDomainCreated !== false
  ) throw deployError("VERCEL_FAILED_DEPLOYMENT_CLEANUP_INCOMPLETE");
  return Object.freeze({
    deletedDeploymentId: createdDeploymentId,
    verifiedAbsent: true,
    preExistingDeploymentPreserved: true,
  });
}

async function compensateCreatedPreviewDeployment({
  createdDeployment,
  before,
  deploymentRole,
  rollbackBinding,
  runCliImpl,
  runControlImpl,
  cliOptions,
  sharedControlOptions,
  reassertMutationAuthorization,
}) {
  const afterFailure = await runControlImpl(
    ["--action", "inspect-project"],
    sharedControlOptions,
  );
  const candidateReadback = await runControlImpl([
    "--action",
    "inspect-deployment-candidate",
    "--deployment-id",
    createdDeployment.id,
  ], sharedControlOptions);
  const cleanupPlan = buildFailedPreviewCleanupPlan({
    returnedIdentity: createdDeployment,
    candidateReadback,
    before,
    afterFailure,
    deploymentRole,
    rollbackBinding,
  });
  reassertMutationAuthorization();
  runCliImpl(cleanupPlan.removeArgs, cliOptions);
  const absenceReadback = await runControlImpl([
    "--action",
    "verify-deployment-absent",
    "--deployment-id",
    createdDeployment.id,
  ], sharedControlOptions);
  const verified = await runControlImpl(
    ["--action", "inspect-project"],
    sharedControlOptions,
  );
  return validateFailedDeploymentCleanupReadback({
    createdDeploymentId: createdDeployment.id,
    absenceReadback,
    before,
    verified,
    deploymentRole,
    rollbackBinding,
  });
}

async function runVercelPreviewDeployCore(argv, {
  environment = process.env,
  execFileImpl = createPinnedGitExecFile(),
  fetchImpl,
  repository,
  sourceSha256,
  uploadManifest,
  evaluateCopyReviewImpl = evaluateCopyReview,
  buildDistImpl = buildDeployDist,
  verifyRollbackSafetySourceImpl = verifyRollbackSafetySource,
  verifyVercelCliRiskDecisionImpl =
    defaultVerifyVercelCliRiskDecision,
  inspectCliImpl = inspectPinnedVercelCli,
  runCliImpl = defaultRunCli,
  readLinkedProjectImpl = defaultLinkedProjectReadback,
  runControlImpl = runVercelControl,
  verifyWifDisabledImpl = defaultVerifyWifDisabled,
  protectedProbeImpl = defaultProtectedProbe,
  waitImpl = (milliseconds) => new Promise((accept) => {
    setTimeout(accept, milliseconds);
  }),
  now = () => new Date(),
  pollAttempts = 20,
  controlOptions = {},
  activationCapability,
  repositoryReadbackImpl = repositoryReadback,
  committedPreviewSourceBindingImpl =
    committedPreviewSourceBinding,
  assertPreviewWorkspaceBindingImpl =
    assertProductionPreviewWorkspaceBinding,
  verifyPinnedVercelCliSnapshotImpl =
    verifyPinnedVercelCliSnapshot,
  assertBaseActivationCapabilityImpl =
    assertBaseActivationCapability,
  assertActivationWindowOpenImpl =
    assertVercelActivationWindowOpen,
} = {}) {
  const args = parseExactFlagPairs(argv);
  assertExactScope(args);
  const deploymentRole = args.get("--deployment-role");
  const rollbackBinding = activeRollbackBinding(args);
  const repositoryState = repository
    ?? repositoryReadbackImpl(execFileImpl);
  if (
    repositoryState.commit !== args.get("--source-commit")
    || repositoryState.tree !== args.get("--source-tree")
    || repositoryState.workingTreeClean !== true
  ) throw deployError("PREVIEW_DEPLOY_REPOSITORY_BINDING_MISMATCH");
  assertBaseActivationCapabilityImpl(activationCapability);
  const committedBinding = (
    sourceSha256 !== undefined
    || uploadManifest !== undefined
  )
    ? Object.freeze({
        sourceSha256,
        uploadManifest,
      })
    : committedPreviewSourceBindingImpl(
        execFileImpl,
        repositoryState.commit,
      );
  if (
    !SHA256.test(committedBinding?.sourceSha256 ?? "")
    || committedBinding?.uploadManifest?.schemaVersion
      !== "wp13.12b-vercel-upload-manifest-v1"
    || !SHA256.test(
      committedBinding?.uploadManifest?.sha256 ?? "",
    )
    || !Array.isArray(committedBinding?.uploadManifest?.files)
    || committedBinding.uploadManifest.files.length
      !== approvedVercelUploadPaths.length
  ) throw deployError("PREVIEW_COMMITTED_SOURCE_BINDING_INVALID");
  await assertPreviewWorkspaceBindingImpl(
    repositoryState,
    committedBinding,
    execFileImpl,
    { rejectIgnoredResidue: true },
  );
  const toolingRiskDecision =
    await verifyVercelCliRiskDecisionImpl();
  if (
    toolingRiskDecision?.decisionId
      !== "wp13-12b-vercel-cli-58-risk-20260728-r1"
    || toolingRiskDecision?.status
      !== "CONDITIONALLY_ACCEPTED_NOT_EXECUTED"
    || toolingRiskDecision?.executionStatus
      !== "AUTHORIZED_FOR_CURRENT_EXACT_EXECUTION"
    || toolingRiskDecision?.conditionalAcceptanceRecorded !== true
    || toolingRiskDecision?.executionAuthorized !== true
    || toolingRiskDecision?.loginAuthorized !== true
    || toolingRiskDecision?.deploymentAuthorized !== true
    || toolingRiskDecision?.cleanupAuthorized !== true
    || toolingRiskDecision?.blocksCurrentExecution !== false
    || toolingRiskDecision?.toolchain?.version
      !== approvedVercelCli.version
    || toolingRiskDecision?.blocksExternalDeployment !== false
  ) throw deployError("VERCEL_CLI_TOOLING_RISK_DECISION_REQUIRED");
  const previewDigest = committedBinding.sourceSha256;
  const expectedUploadManifest = committedBinding.uploadManifest;
  const rollbackSafetySource =
    await verifyRollbackSafetySourceImpl({
      uploadManifest: expectedUploadManifest,
    });
  if (
    rollbackSafetySource?.schemaVersion
      !== "wp13.12b-vercel-rollback-safety-source-binding-v1"
    || !SHA256.test(rollbackSafetySource?.sha256 ?? "")
    || rollbackSafetySource?.uploadManifestSha256
      !== expectedUploadManifest.sha256
    || rollbackSafetySource?.uploadManifestBound !== true
    || rollbackSafetySource
      ?.issuanceDeniedBeforeIdentityExchange !== true
    || rollbackSafetySource?.deleteRouteAvailable !== true
  ) throw deployError("ROLLBACK_SAFETY_SOURCE_BINDING_INVALID");
  const copyReview = await evaluateCopyReviewImpl({
    root: previewRoot,
  });
  if (
    copyReview?.valid !== true
    || copyReview?.deploymentAllowed !== true
    || copyReview?.externalWrites !== 0
  ) throw deployError("PREVIEW_COPY_REVIEW_PREFLIGHT_REQUIRED");
  const staticArtifact = await buildDistImpl({
    sourceRoot: previewRoot,
    outputRoot: join(previewRoot, "dist"),
    evaluateCopyReviewImpl,
  });
  if (
    staticArtifact?.schemaVersion
      !== "wp13.12b-vercel-static-dist-v1"
    || !SHA256.test(staticArtifact?.artifactSha256 ?? "")
    || staticArtifact?.sourceSetSha256
      !== copyReview.sourceSetSha256
  ) throw deployError("VERCEL_STATIC_DIST_BUILD_INVALID");
  await assertPreviewWorkspaceBindingImpl(
    repositoryState,
    committedBinding,
    execFileImpl,
  );
  const cli = await inspectCliImpl(
    approvedVercelCliModuleRoot,
  );
  if (
    cli?.version !== approvedVercelCli.version
    || cli?.npmIntegrity !== approvedVercelCli.npmIntegrity
    || cli?.npmIntegritySha256
      !== approvedVercelCliIntegritySha256
    || !SHA256.test(cli?.packageManifestSha256 ?? "")
    || !SHA256.test(cli?.entrySha256 ?? "")
  ) throw deployError("PINNED_VERCEL_CLI_INTEGRITY_MISMATCH");
  const cliOptions = { cli, cwd: previewRoot, environment };
  const versionReadback = runCliImpl(["--version"], cliOptions);
  if (
    versionReadback !== approvedVercelCli.version
    && versionReadback
      !== `Vercel CLI ${approvedVercelCli.version}`
  ) throw deployError("PINNED_VERCEL_CLI_VERSION_READBACK_MISMATCH");

  const sharedControlOptions = {
    environment,
    execFileImpl,
    repository: repositoryState,
    sourceSha256: previewDigest,
    uploadManifest: expectedUploadManifest,
    rollbackReceipt: null,
    ...controlOptions,
  };
  const reassertMutationAuthorization = () => {
    assertBaseActivationCapabilityImpl(activationCapability);
    assertActivationWindowOpenImpl({ now });
  };
  const before = await runControlImpl(
    ["--action", "inspect-project"],
    sharedControlOptions,
  );
  if (
    before.productionDeploymentCreated !== false
    || before.customDomainCreated !== false
    || before.claimsDerivedFromAuthenticatedProviderReadback !== true
    || before.project?.framework !== null
    || before.project?.rootDirectory !== null
    || before.project?.buildCommand !== null
    || before.project?.outputDirectory !== null
    || before.project?.installCommand !== null
    || before.project?.devCommand !== null
    || before.project?.autoExposeSystemEnvs !== true
    || before.project?.nodeVersion !== approvedVercelNodeVersion
    || before.project?.live !== false
    || before.project?.link !== null
    || before.project?.webAnalytics !== null
    || before.project?.speedInsights !== null
    || before.project?.passwordProtectionConfigured !== false
    || before.project?.trustedIpsConfigured !== false
    || before.project?.protectionBypassConfigured !== false
    || before.environmentInventory?.exactAllowlistVerified !== true
    || before.environmentInventory
      ?.previewProjectEnvironmentKeys?.length !== 0
    || before.deploymentInventory
      ?.unrelatedLiveDeploymentCount !== 0
    || before.deploymentInventory
      ?.unrelatedNonterminalDeploymentCount !== 0
  ) throw deployError("PREVIEW_DEPLOY_PROVIDER_PREFLIGHT_BLOCKED");
  if (
    deploymentRole === "rollback"
    && (
      before.deploymentInventory?.liveDeploymentCount !== 0
      || before.rollbackPreparationOnly === true
      || before.previewDeployment !== null
      || before.pendingRollbackDeployment !== null
    )
  ) throw deployError("ROLLBACK_MUST_BE_DEPLOYED_FIRST");
  if (
    deploymentRole === "active"
    && (
      before.rollbackPreparationOnly !== true
      || before.previewDeployment !== null
      || before.deploymentInventory?.liveDeploymentCount !== 1
      || before.pendingRollbackDeployment?.id
        !== rollbackBinding.id
      || before.pendingRollbackDeployment?.url
        !== rollbackBinding.url
      || before.pendingRollbackDeployment?.sourceCommit
        !== rollbackBinding.sourceCommit
      || before.pendingRollbackDeployment?.sourceTree
        !== rollbackBinding.sourceTree
      || before.pendingRollbackDeployment?.safeDisabled !== true
    )
  ) throw deployError("EXACT_ROLLBACK_PREPARATION_READBACK_REQUIRED");
  reassertMutationAuthorization();
  const protection = await runControlImpl([
    "--action", "ensure-standard-protection",
    "--authorized", vercelScope.activationAuthorization,
  ], sharedControlOptions);
  reassertMutationAuthorization();
  const oidc = await runControlImpl([
    "--action", "ensure-team-oidc",
    "--authorized", vercelScope.activationAuthorization,
  ], sharedControlOptions);
  if (
    protection.project?.ssoProtection?.deploymentType
      !== vercelScope.protectionMode
    || oidc.project?.ssoProtection?.deploymentType
      !== vercelScope.protectionMode
    || oidc.project?.oidcTokenConfig?.enabled !== true
    || oidc.project?.oidcTokenConfig?.issuerMode !== "team"
    || oidc.deploymentInventory?.liveDeploymentCount
      !== (deploymentRole === "rollback" ? 0 : 1)
  ) throw deployError("VERCEL_PROVIDER_HARDENING_READBACK_FAILED");

  const wifBeforeLink = await verifyWifDisabledImpl({
    environment,
  });
  reassertMutationAuthorization();
  await assertPreviewWorkspaceBindingImpl(
    repositoryState,
    committedBinding,
    execFileImpl,
  );
  reassertMutationAuthorization();
  runCliImpl([
    "link",
    "--yes",
    "--project",
    vercelScope.projectId,
    "--scope",
    vercelScope.teamSlug,
  ], {
    cli,
    cwd: previewRoot,
    environment,
  });
  const linked = await readLinkedProjectImpl();
  if (
    linked?.orgId !== vercelScope.teamId
    || linked?.projectId !== vercelScope.projectId
    || (
      linked?.projectName !== undefined
      && linked.projectName !== vercelScope.projectName
    )
  ) throw deployError("VERCEL_LINK_SCOPE_MISMATCH");

  const wifBeforeDryRun = await verifyWifDisabledImpl({
    environment,
  });
  await assertPreviewWorkspaceBindingImpl(
    repositoryState,
    committedBinding,
    execFileImpl,
  );
  reassertMutationAuthorization();
  const dryRun = validateDryRunManifest(
    parseCliJson(
      runCliImpl(exactDryRunArgs(), cliOptions),
      "VERCEL_DRY_RUN_MANIFEST_INVALID",
    ),
    expectedUploadManifest,
  );
  const wifBeforeDeploy = await verifyWifDisabledImpl({
    environment,
  });
  reassertMutationAuthorization();
  await assertPreviewWorkspaceBindingImpl(
    repositoryState,
    committedBinding,
    execFileImpl,
  );
  reassertMutationAuthorization();
  let deploymentOutput;
  let deploymentFailure;
  try {
    deploymentOutput = runCliImpl(exactPreviewDeploymentArgs({
      commit: repositoryState.commit,
      tree: repositoryState.tree,
      sourceSha256: previewDigest,
      uploadManifestSha256: expectedUploadManifest.sha256,
      dryRunManifestSha256: dryRun.sha256,
      staticArtifactSha256: staticArtifact.artifactSha256,
      role: deploymentRole,
      rollbackBinding,
    }), {
      cli,
      cwd: previewRoot,
      environment,
    });
  } catch (error) {
    deploymentFailure = error;
    deploymentOutput = error?.capturedStdout;
  }
  let createdDeployment;
  try {
    createdDeployment = returnedDeploymentIdentity(deploymentOutput);
  } catch {
    try {
      await runControlImpl(
        ["--action", "inspect-project"],
        sharedControlOptions,
      );
    } catch {}
    throw deployError(
      "VERCEL_FAILED_ATTEMPT_MANUAL_INVENTORY_REQUIRED",
    );
  }
  try {
    if (deploymentFailure !== undefined) throw deploymentFailure;
    createdDeployment = parseCreatedDeployment(deploymentOutput);
    const deploymentOrigin = createdDeployment.url;
    await assertPreviewWorkspaceBindingImpl(
      repositoryState,
      committedBinding,
      execFileImpl,
    );
    verifyPinnedVercelCliSnapshotImpl(cli);
  if (
    !Number.isInteger(pollAttempts)
    || pollAttempts < 1
    || pollAttempts > 30
  ) throw deployError("VERCEL_DEPLOY_POLL_BOUND_INVALID");
  let after;
  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    after = await runControlImpl(
      ["--action", "inspect-project"],
      sharedControlOptions,
    );
    const observedDeployment = deploymentRole === "active"
      ? after.previewDeployment
      : after.pendingRollbackDeployment;
    const exactRoleState = deploymentRole === "active"
      ? (
          after.sequentialPairPrepared === true
          && after.deploymentInventory?.liveDeploymentCount === 2
          && after.pendingRollbackDeployment?.id
            === rollbackBinding.id
          && observedDeployment?.rollbackDeploymentId
            === rollbackBinding.id
          && observedDeployment?.rollbackEvidenceSha256
            === rollbackBinding.evidenceSha256
        )
      : (
          after.rollbackPreparationOnly === true
          && after.deploymentInventory?.liveDeploymentCount === 1
        );
    if (
      exactRoleState
      && after.productionDeploymentCreated === false
      && after.customDomainCreated === false
      && observedDeployment?.url === deploymentOrigin
      && observedDeployment?.sourceCommit
        === repositoryState.commit
      && observedDeployment?.sourceTree
        === repositoryState.tree
      && observedDeployment?.target === "preview"
      && observedDeployment?.deploymentRole === deploymentRole
      && observedDeployment?.safeDisabled
        === (deploymentRole === "rollback")
      && observedDeployment?.protectionVerified === true
      && observedDeployment?.sourceFilesVerified === true
      && observedDeployment
        ?.deploymentEnvironmentValuesExposedByProvider === false
      && observedDeployment
        ?.deploymentRoleValueRequiresAuthenticatedBrowserProof
        === true
      && Array.isArray(
        observedDeployment?.deploymentUserEnvironmentKeys,
      )
      && observedDeployment.deploymentUserEnvironmentKeys.length
        === approvedVercelUserEnvironmentKeys.length
      && observedDeployment.deploymentUserEnvironmentKeys.every((
        key,
        index,
      ) => key === approvedVercelUserEnvironmentKeys[index])
      && observedDeployment?.uploadManifestSha256
        === expectedUploadManifest.sha256
      && observedDeployment?.dryRunManifestSha256
        === dryRun.sha256
      && observedDeployment?.staticArtifactSha256
        === staticArtifact.artifactSha256
      && after.deploymentInventory
        ?.unrelatedLiveDeploymentCount === 0
      && after.deploymentInventory
        ?.unrelatedNonterminalDeploymentCount === 0
    ) break;
    after = undefined;
    if (attempt + 1 < pollAttempts) await waitImpl(1_000);
  }
  if (after === undefined) {
    throw deployError("VERCEL_PREVIEW_POST_DEPLOY_READBACK_FAILED");
  }
  const probes = await protectedProbeImpl({
    deploymentOrigin,
    deploymentRole,
    environment,
    fetchImpl,
    runCliImpl,
    cli,
  });
  if (
    probes?.deploymentRole !== deploymentRole
    || probes?.authenticatedProbePerformed !== false
    || probes?.authenticatedBrowserProofRequired !== true
    || probes?.protectionBypassCreated !== false
    || probes?.shareableLinkCreated !== false
    || probes?.tokenPrinted !== false
  ) throw deployError("VERCEL_PROTECTED_ROUTE_PROBE_FAILED");
  const observedDeployment = deploymentRole === "active"
    ? after.previewDeployment
    : after.pendingRollbackDeployment;
  const rollbackEvidence = deploymentRole === "rollback"
    ? Object.freeze({
        schemaVersion:
          "wp13.12b-vercel-safe-disabled-rollback-evidence-v1",
        deploymentId: observedDeployment.id,
        deploymentUrl: observedDeployment.url,
        sourceCommit: repositoryState.commit,
        sourceTree: repositoryState.tree,
        sourceSha256: previewDigest,
        uploadManifestSha256: expectedUploadManifest.sha256,
        dryRunManifestSha256: dryRun.sha256,
        staticArtifactSha256: staticArtifact.artifactSha256,
        rollbackSafetySourceSha256:
          rollbackSafetySource.sha256,
        rollbackIssuanceDeniedByBoundSource: true,
        rollbackDeleteAvailableByBoundSource: true,
        wifDisabledImmediatelyBeforeDeploy: true,
      })
    : null;
  const resultingRollbackBinding = deploymentRole === "rollback"
    ? Object.freeze({
        id: observedDeployment.id,
        url: observedDeployment.url,
        sourceCommit: repositoryState.commit,
        sourceTree: repositoryState.tree,
        evidenceSha256: createHash("sha256")
          .update(JSON.stringify(rollbackEvidence), "utf8")
          .digest("hex"),
        safeDisabled: true,
      })
    : rollbackBinding;

    return Object.freeze({
    schemaVersion:
      "wp13.12b-ea-exact-vercel-preview-deployment-v1",
    action: ACTION,
    externalWrites:
      1 + protection.externalWrites + oidc.externalWrites,
    teamId: vercelScope.teamId,
    teamSlug: vercelScope.teamSlug,
    projectId: vercelScope.projectId,
    projectName: vercelScope.projectName,
    target: "preview",
    deploymentRole,
    toolingRiskDecision: {
      decisionId: toolingRiskDecision.decisionId,
      version: toolingRiskDecision.toolchain.version,
      conditionalRiskAccepted: true,
      executionAuthorized: true,
      blocksExternalDeployment: false,
    },
    sourceCommit: repositoryState.commit,
    sourceTree: repositoryState.tree,
    sourceRoot: previewRootRepositoryPath,
    previewSourceSha256: previewDigest,
    uploadManifestSha256: expectedUploadManifest.sha256,
    dryRunManifest: dryRun,
    staticArtifact,
    rollbackSafetySource,
    copyReviewSourceSetSha256: copyReview.sourceSetSha256,
    vercelCli: {
      version: cli.version,
      npmIntegrity: cli.npmIntegrity,
      npmIntegritySha256: cli.npmIntegritySha256,
      packageManifestSha256: cli.packageManifestSha256,
      entrySha256: cli.entrySha256,
      pathContained: true,
    },
    wifTransition: {
      requiredState: "disabled",
      verifiedBeforeLink: wifBeforeLink?.complete === true,
      verifiedBeforeDryRun: wifBeforeDryRun?.complete === true,
      verifiedImmediatelyBeforeDeploy:
        wifBeforeDeploy?.complete === true,
      existingFederatedTokensMayRemainShortLived: true,
      backendControlAndIssuanceMustRemainDisabled: true,
    },
    deployment: observedDeployment,
    rollbackEvidence,
    rollbackBinding: resultingRollbackBinding,
    deploymentPolling: {
      bounded: true,
      maximumAttempts: pollAttempts,
      intervalMilliseconds: 1_000,
    },
    protectedRouteProbes: probes,
    authenticatedBrowserProofContract: {
      schemaVersion: authenticatedBrowserProofSchemaVersion,
      pathEnvironmentKey:
        authenticatedBrowserProofPathEnvironmentKey,
      maximumAgeMilliseconds:
        authenticatedBrowserProofMaximumAgeMilliseconds,
      receiptArtifactHashBindingRequired: true,
      requiredBeforeEveryWifTrustEnable: true,
      authenticationMode:
        "VERCEL_STANDARD_PROTECTION_SESSION",
      activeRuntimeConfig: {
        status: 200,
        deploymentRole: "active",
        issuanceEnabled: true,
      },
      rollbackRuntimeConfig: {
        status: 200,
        deploymentRole: "rollback",
        issuanceEnabled: false,
      },
      rollbackIssueProbe: {
        path: "/api/issue",
        status: 503,
        denialClass: "ROLLBACK_SAFE_DISABLED",
      },
      protectionBypassPermitted: false,
      shareableLinkPermitted: false,
      oidcSubjectGranularity:
        "PROJECT_AND_ENVIRONMENT_NOT_DEPLOYMENT",
      newDeploymentsWhileWifLivePermitted: false,
      gitLinkWhileWifLivePermitted: false,
    },
    rollbackPreparationOnly:
      after.rollbackPreparationOnly === true,
    sequentialPairPrepared:
      after.sequentialPairPrepared === true,
    receiptRequiredBeforeWifEnable: true,
    previewOnly: false,
    productionDeploymentCreated: false,
    customDomainCreated: false,
    claimsDerivedFromAuthenticatedProviderReadback: true,
    tokenPrinted: false,
    oidcTokenPrinted: false,
    });
  } catch (error) {
    try {
      await compensateCreatedPreviewDeployment({
        createdDeployment,
        before,
        deploymentRole,
        rollbackBinding,
        runCliImpl,
        runControlImpl,
        cliOptions,
        sharedControlOptions,
        reassertMutationAuthorization,
      });
    } catch (cleanupError) {
      if (
        cleanupError?.code
          === "VERCEL_FAILED_ATTEMPT_MANUAL_INVENTORY_REQUIRED"
      ) throw cleanupError;
      throw deployError("VERCEL_FAILED_DEPLOYMENT_CLEANUP_INCOMPLETE");
    }
    throw error;
  }
}

export function runVercelPreviewDeploy(argv, options = {}) {
  const args = parseExactFlagPairs(argv);
  assertExactScope(args);
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).some((key) => key !== "activationCapability")
  ) throw deployError("PRODUCTION_PREVIEW_DEPENDENCY_INJECTION_FORBIDDEN");
  assertBaseActivationCapability(options.activationCapability);
  try {
    assertNoDangerousExternalEnvironment(process.env);
  } catch {
    throw deployError(
      "PREVIEW_DEPLOY_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  const environment = sanitizedNodeChildEnvironment(process.env, {
    preserveKeys: [
      "LUDYS_AUTHENTICATED_BROWSER_PROOF_PATH",
      "LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH",
    ],
  });
  return runVercelPreviewDeployCore(argv, {
    activationCapability: options.activationCapability,
    environment,
    execFileImpl: createPinnedGitExecFile(),
    fetchImpl: nativeFetch,
    runControlImpl: (controlArgv) => runVercelControl(
      controlArgv,
      { activationCapability: options.activationCapability },
    ),
  });
}

export function runVercelPreviewDeployForTesting(argv, options = {}) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || options.activationCapability === undefined
    || typeof options.assertBaseActivationCapabilityImpl
      !== "function"
    || typeof options.assertActivationWindowOpenImpl
      !== "function"
    || !scriptedPreviewCliTestAdapters.has(options.runCliImpl)
    || !scriptedPreviewControlTestAdapters.has(
      options.runControlImpl,
    )
    || !scriptedPreviewWifTestAdapters.has(
      options.verifyWifDisabledImpl,
    )
    || !scriptedPreviewProbeTestAdapters.has(
      options.protectedProbeImpl,
    )
    || options.fetchImpl !== undefined
  ) throw deployError("IN_MEMORY_PREVIEW_TEST_ADAPTERS_REQUIRED");
  return runVercelPreviewDeployCore(argv, {
    ...options,
    fetchImpl: async () => {
      throw deployError("IN_MEMORY_PREVIEW_NETWORK_FORBIDDEN");
    },
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
    : "VERCEL_PREVIEW_DEPLOY_FAILED_CLOSED";
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && resolve(invokedPath) === fileURLToPath(import.meta.url)
) {
  try {
    const activationCapability =
      await acquireBaseActivationCapability();
    const result = await runVercelPreviewDeploy(
      process.argv.slice(2),
      { activationCapability },
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${safeError(error)}\n`);
    process.exitCode = 1;
  }
}
