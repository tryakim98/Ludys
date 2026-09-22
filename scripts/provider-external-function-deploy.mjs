import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import {
  externalControlTestArgvForTesting,
  externalControlTestScope,
  externalControlTestValueForTesting,
  runDeployIdentityControl,
  runDeployIdentityControlForTesting,
} from "./provider-external-deploy-identity-control.mjs";
import {
  assertDeployWindow,
  assertImpersonatedGcloudArgs,
  canonicalPreviewOrigin,
  deployFunctionNames,
  deployIdentityScope,
  deploymentImpersonationFlag,
} from "./wp13-12b-deploy-identity.mjs";
import {
  acquireBaseActivationCapability,
  acquireLiveActivationCapability,
  acquirePreviewReadyActivationCapability,
  assertBaseActivationCapability,
  assertLiveActivationCapability,
  assertProtectedPreviewActivationCapability,
} from "./wp13-12b-activation-phase-gate.mjs";
import {
  assertExactProviderRuntimeImportClosure,
  expectedFunctionsGcloudIgnore,
  providerFunctionsSourceRoot,
  providerIgnoredAuthoringFilePaths,
  providerOptionalIgnoredDirectoryPaths,
  providerPackageArtifactPath,
  providerPackageFilePaths,
  providerPackageRuntimeModulePaths,
  validateProviderPackageManifest,
} from "./wp13-12b-provider-package-contract.mjs";
import {
  assertNoDangerousExternalEnvironment,
  assertNoDangerousExternalEnvironmentForTesting,
  createPinnedGoogleCloudCliExecFile,
} from "./wp13-12b-external-process-boundary.mjs";
import {
  createPinnedGitExecFile,
} from "./wp13-12b-pinned-git-toolchain.mjs";

const require = createRequire(import.meta.url);
const {
  acquirePinnedGoogleOAuthAccessToken,
} = require("./wp13-12b-google-oauth-token-helper.cjs");

const repo = fileURLToPath(new URL("..", import.meta.url));
const nativeFetch = globalThis.fetch.bind(globalThis);
const ACTIONS = new Set([
  "deploy-firestore-rules",
  "deploy-disabled",
  "configure-preview-origin",
  "activate-session-issuance",
]);
const FLAGS = new Set([
  "--action",
  "--project",
  "--google-account",
  "--region",
  "--impersonate-service-account",
  "--window-expires-at",
  "--preview-origin",
  "--source-commit",
  "--source-tree",
  "--source-sha256",
  "--authorized",
]);
const publicFunctionNames = new Set(["sessionCommand", "sessionProjection"]);
const firestoreAuthorityFilePaths = Object.freeze([
  "provider/firebase/firestore.indexes.json",
  "provider/firebase/firestore.rules",
]);
const boundSourceBytes = new WeakMap();
const ownedDeploymentSnapshotDirectories = new Set();
const deploymentSnapshotPrefix = "ludys-wp13-12b-functions-source-";
export const deploymentMemoryBytes = 256 * 1024 * 1024;

function deployError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseExactFlagPairs(argv) {
  if (argv.length % 2 !== 0) throw deployError("EXACT_DEPLOY_FLAG_VALUE_PAIRS_REQUIRED");
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      typeof flag !== "string"
      || !FLAGS.has(flag)
      || typeof value !== "string"
      || value.length === 0
      || parsed.has(flag)
    ) throw deployError("UNKNOWN_DUPLICATE_OR_EMPTY_DEPLOY_FLAG");
    parsed.set(flag, value);
  }
  for (const flag of [
    "--action",
    "--project",
    "--google-account",
    "--region",
    "--impersonate-service-account",
    "--window-expires-at",
    "--source-commit",
    "--source-tree",
    "--source-sha256",
    "--authorized",
  ]) {
    if (!parsed.has(flag)) throw deployError("DEPLOY_REQUIRED_FLAG_MISSING");
  }
  return parsed;
}

function assertScope(args, expectedScope = deployIdentityScope) {
  if (
    args.get("--project") !== expectedScope.projectId
    || args.get("--google-account") !== expectedScope.approvedGoogleAccount
    || args.get("--region") !== expectedScope.region
    || args.get("--impersonate-service-account")
      !== expectedScope.deployServiceAccount
  ) throw deployError("DEPLOY_APPROVED_SCOPE_OR_IDENTITY_MISMATCH");
  if (args.get("--authorized") !== deployIdentityScope.activationAuthorization) {
    throw deployError("EXACT_EXTERNAL_ACTIVATION_AUTHORIZATION_REQUIRED");
  }
}

function assertNoCredentialOverride(
  environment,
  { testing = false } = {},
) {
  for (const name of [
    "CLOUDSDK_AUTH_ACCESS_TOKEN",
    "CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "FIREBASE_TOKEN",
  ]) {
    if (typeof environment?.[name] === "string" && environment[name].length > 0) {
      throw deployError("DEPLOY_CREDENTIAL_OVERRIDE_FORBIDDEN");
    }
  }
  try {
    if (testing) {
      assertNoDangerousExternalEnvironmentForTesting(environment);
    } else {
      assertNoDangerousExternalEnvironment(environment);
    }
  } catch {
    throw deployError("DEPLOY_CREDENTIAL_OR_PROCESS_OVERRIDE_FORBIDDEN");
  }
}

function normalizeAbsolutePath(path) {
  const normalized = resolve(path).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function exactRepositoryPath(repositoryRoot, path) {
  if (
    typeof path !== "string"
    || path.length === 0
    || isAbsolute(path)
    || path.includes("\\")
    || path.includes("\0")
    || path.split("/").some((part) => part === ".." || part === ".git")
  ) throw deployError("PROVIDER_PACKAGE_PATH_INVALID");
  const target = resolve(repositoryRoot, path);
  const fromRoot = relative(repositoryRoot, target);
  if (
    fromRoot === ""
    || fromRoot === ".."
    || fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    || isAbsolute(fromRoot)
  ) throw deployError("PROVIDER_PACKAGE_PATH_INVALID");
  return target;
}

function runGitText(repositoryRoot, execFileImpl, args, code) {
  try {
    return String(execFileImpl("git", [
      "-c",
      `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`,
      ...args,
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    })).trim();
  } catch {
    throw deployError(code);
  }
}

function runGitBytes(repositoryRoot, execFileImpl, args, code) {
  try {
    return Buffer.from(execFileImpl("git", [
      "-c",
      `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`,
      ...args,
    ], {
      cwd: repositoryRoot,
      encoding: "buffer",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    }));
  } catch {
    throw deployError(code);
  }
}

function repositoryReadback(repositoryRoot, execFileImpl) {
  const references = runGitText(
    repositoryRoot,
    execFileImpl,
    ["rev-parse", "HEAD", "HEAD^{tree}"],
    "DEPLOY_SOURCE_COMMIT_OR_TREE_READ_FAILED",
  ).split(/\r?\n/u);
  const [commit, tree] = references;
  const status = runGitText(
    repositoryRoot,
    execFileImpl,
    ["status", "--porcelain=v2", "--untracked-files=all"],
    "DEPLOY_SOURCE_STATUS_READ_FAILED",
  );
  if (
    references.length !== 2
    || !/^[a-f0-9]{40,64}$/u.test(commit)
    || !/^[a-f0-9]{40,64}$/u.test(tree)
  ) {
    throw deployError("DEPLOY_SOURCE_COMMIT_OR_TREE_INVALID");
  }
  if (status !== "") throw deployError("DEPLOY_SOURCE_WORKTREE_MUST_BE_CLEAN");
  return Object.freeze({
    commit,
    tree,
    workingTreeClean: true,
  });
}

export function deployRepositoryReadback(...args) {
  if (args.length !== 0) {
    throw deployError("PRODUCTION_DEPLOY_REPOSITORY_OVERRIDE_FORBIDDEN");
  }
  return repositoryReadback(repo, createPinnedGitExecFile());
}

function expectedProviderDirectories() {
  const directories = new Set([providerFunctionsSourceRoot]);
  for (const path of [
    ...providerPackageFilePaths,
    ...providerIgnoredAuthoringFilePaths,
  ]) {
    let directory = dirname(path).replaceAll("\\", "/");
    while (
      directory === providerFunctionsSourceRoot
      || directory.startsWith(`${providerFunctionsSourceRoot}/`)
    ) {
      directories.add(directory);
      if (directory === providerFunctionsSourceRoot) break;
      directory = dirname(directory).replaceAll("\\", "/");
    }
  }
  return directories;
}

const allowedProviderDirectories = expectedProviderDirectories();
const optionalIgnoredDirectories =
  new Set(providerOptionalIgnoredDirectoryPaths);

async function assertRealDirectory(path) {
  let stats;
  try {
    stats = await lstat(path);
  } catch {
    throw deployError("FUNCTION_SOURCE_DIRECTORY_UNREADABLE");
  }
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw deployError("FUNCTION_SOURCE_SPECIAL_FILE_FORBIDDEN");
  }
  let canonical;
  try {
    canonical = await realpath(path);
  } catch {
    throw deployError("FUNCTION_SOURCE_DIRECTORY_UNREADABLE");
  }
  if (normalizeAbsolutePath(canonical) !== normalizeAbsolutePath(path)) {
    throw deployError("FUNCTION_SOURCE_REPARSE_PATH_FORBIDDEN");
  }
}

async function collectFunctionSourceFiles(
  repositoryRoot,
  directory,
  observedDirectories,
) {
  const files = [];
  await assertRealDirectory(directory);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    const repositoryRelativePath =
      relative(repositoryRoot, path).replaceAll("\\", "/");
    let stats;
    try {
      stats = await lstat(path);
    } catch {
      throw deployError("FUNCTION_SOURCE_FILE_UNREADABLE");
    }
    if (stats.isSymbolicLink()) {
      throw deployError("FUNCTION_SOURCE_SPECIAL_FILE_FORBIDDEN");
    }
    if (entry.isDirectory()) {
      if (!stats.isDirectory()) {
        throw deployError("FUNCTION_SOURCE_SPECIAL_FILE_FORBIDDEN");
      }
      if (optionalIgnoredDirectories.has(repositoryRelativePath)) {
        await assertRealDirectory(path);
        continue;
      }
      if (!allowedProviderDirectories.has(repositoryRelativePath)) {
        throw deployError("FUNCTION_SOURCE_EXTRA_PATH_FORBIDDEN");
      }
      observedDirectories.add(repositoryRelativePath);
      files.push(...await collectFunctionSourceFiles(
        repositoryRoot,
        path,
        observedDirectories,
      ));
    } else if (entry.isFile() && stats.isFile()) {
      files.push(repositoryRelativePath);
    } else {
      throw deployError("FUNCTION_SOURCE_SPECIAL_FILE_FORBIDDEN");
    }
  }
  return files;
}

function parseNullDelimited(value) {
  return value.toString("utf8").split("\0").filter(Boolean);
}

function assertExactGitIndexBinding(
  repositoryRoot,
  execFileImpl,
  commit,
  paths,
) {
  const tagged = parseNullDelimited(runGitBytes(
    repositoryRoot,
    execFileImpl,
    ["ls-files", "-v", "-z", "--", ...paths],
    "DEPLOY_SOURCE_INDEX_FLAGS_READ_FAILED",
  ));
  const taggedByPath = new Map();
  for (const entry of tagged) {
    const match = /^(.) (.+)$/su.exec(entry);
    if (match === null || taggedByPath.has(match[2])) {
      throw deployError("DEPLOY_SOURCE_INDEX_FLAGS_INVALID");
    }
    taggedByPath.set(match[2], match[1]);
  }
  if (
    taggedByPath.size !== paths.length
    || paths.some((path) => taggedByPath.get(path) !== "H")
  ) throw deployError(
    "DEPLOY_SOURCE_UNTRACKED_SKIP_WORKTREE_OR_ASSUME_UNCHANGED_FORBIDDEN",
  );

  const staged = parseNullDelimited(runGitBytes(
    repositoryRoot,
    execFileImpl,
    ["ls-files", "--stage", "-z", "--", ...paths],
    "DEPLOY_SOURCE_INDEX_READ_FAILED",
  ));
  const stagedByPath = new Map();
  for (const entry of staged) {
    const match = /^(100644|100755) ([a-f0-9]{40,64}) 0\t(.+)$/su.exec(entry);
    if (match === null || stagedByPath.has(match[3])) {
      throw deployError("DEPLOY_SOURCE_INDEX_ENTRY_INVALID");
    }
    stagedByPath.set(match[3], Object.freeze({
      mode: match[1],
      objectId: match[2],
    }));
  }
  if (
    stagedByPath.size !== paths.length
    || paths.some((path) => !stagedByPath.has(path))
  ) throw deployError("DEPLOY_SOURCE_EXACT_TRACKED_FILE_SET_REQUIRED");
  const committedObjectIds = runGitText(
    repositoryRoot,
    execFileImpl,
    ["rev-parse", ...paths.map((path) => `${commit}:${path}`)],
    "DEPLOY_SOURCE_COMMITTED_BLOB_READ_FAILED",
  ).split(/\r?\n/u);
  const workingObjectIds = runGitText(
    repositoryRoot,
    execFileImpl,
    ["hash-object", "--no-filters", "--", ...paths],
    "DEPLOY_SOURCE_WORKING_BLOB_HASH_FAILED",
  ).split(/\r?\n/u);
  if (
    committedObjectIds.length !== paths.length
    || workingObjectIds.length !== paths.length
    || paths.some((path, index) => (
      !/^[a-f0-9]{40,64}$/u.test(committedObjectIds[index] ?? "")
      || committedObjectIds[index] !== workingObjectIds[index]
      || committedObjectIds[index] !== stagedByPath.get(path)?.objectId
    ))
  ) throw deployError("DEPLOY_SOURCE_COMMITTED_BLOB_MISMATCH");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readValidatedProviderPackage(repositoryRoot) {
  const sourceRoot = exactRepositoryPath(
    repositoryRoot,
    providerFunctionsSourceRoot,
  );
  const observedDirectories = new Set([providerFunctionsSourceRoot]);
  const observedFiles = (await collectFunctionSourceFiles(
    repositoryRoot,
    sourceRoot,
    observedDirectories,
  )).sort();
  const expectedVisibleFiles = [
    ...providerPackageFilePaths,
    ...providerIgnoredAuthoringFilePaths,
  ].sort();
  if (
    JSON.stringify(observedFiles) !== JSON.stringify(expectedVisibleFiles)
  ) throw deployError("FUNCTION_SOURCE_EXACT_FILE_SET_MISMATCH");
  if (
    [...observedDirectories].some(
      (path) => !allowedProviderDirectories.has(path),
    )
  ) throw deployError("FUNCTION_SOURCE_EXTRA_PATH_FORBIDDEN");

  const artifactPath = exactRepositoryPath(
    repositoryRoot,
    providerPackageArtifactPath,
  );
  let artifactBytes;
  let manifest;
  try {
    const artifactStats = await lstat(artifactPath);
    if (!artifactStats.isFile() || artifactStats.isSymbolicLink()) {
      throw deployError("PROVIDER_PACKAGE_MANIFEST_SPECIAL_FILE_FORBIDDEN");
    }
    if (
      normalizeAbsolutePath(await realpath(artifactPath))
        !== normalizeAbsolutePath(artifactPath)
    ) throw deployError(
      "PROVIDER_PACKAGE_MANIFEST_REPARSE_PATH_FORBIDDEN",
    );
    artifactBytes = await readFile(artifactPath);
    manifest = validateProviderPackageManifest(
      JSON.parse(artifactBytes.toString("utf8")),
    );
  } catch (error) {
    if (typeof error?.code === "string") throw error;
    throw deployError("PROVIDER_PACKAGE_MANIFEST_UNREADABLE_OR_INVALID");
  }

  const moduleTextByPath = {};
  const fileBytesByPath = new Map();
  for (const file of manifest.files) {
    const target = exactRepositoryPath(repositoryRoot, file.path);
    let stats;
    let bytes;
    try {
      stats = await lstat(target);
      bytes = await readFile(target);
    } catch {
      throw deployError("FUNCTION_SOURCE_FILE_UNREADABLE");
    }
    if (
      !stats.isFile()
      || stats.isSymbolicLink()
      || bytes.byteLength !== file.bytes
      || sha256(bytes) !== file.sha256
    ) throw deployError("PROVIDER_PACKAGE_FILE_HASH_OR_SIZE_MISMATCH");
    let canonical;
    try {
      canonical = await realpath(target);
    } catch {
      throw deployError("FUNCTION_SOURCE_FILE_UNREADABLE");
    }
    if (normalizeAbsolutePath(canonical) !== normalizeAbsolutePath(target)) {
      throw deployError("FUNCTION_SOURCE_REPARSE_PATH_FORBIDDEN");
    }
    fileBytesByPath.set(file.path, bytes);
    if (providerPackageRuntimeModulePaths.includes(file.path)) {
      moduleTextByPath[file.path] = bytes.toString("utf8");
    }
  }
  if (
    fileBytesByPath.get(
      "provider/firebase/functions/.gcloudignore",
    )?.toString("utf8") !== expectedFunctionsGcloudIgnore
  ) throw deployError("FUNCTIONS_GCLOUDIGNORE_EXACT_POLICY_MISMATCH");
  assertExactProviderRuntimeImportClosure(moduleTextByPath);
  return Object.freeze({
    artifactBytes,
    fileBytesByPath,
    manifest,
  });
}

async function readValidatedFirestoreAuthorityFiles(repositoryRoot) {
  const fileBytesByPath = new Map();
  for (const path of firestoreAuthorityFilePaths) {
    const target = exactRepositoryPath(repositoryRoot, path);
    let stats;
    let canonical;
    let bytes;
    try {
      stats = await lstat(target);
      canonical = await realpath(target);
      bytes = await readFile(target);
    } catch {
      throw deployError("FIRESTORE_AUTHORITY_SOURCE_FILE_UNREADABLE");
    }
    if (
      !stats.isFile()
      || stats.isSymbolicLink()
      || normalizeAbsolutePath(canonical) !== normalizeAbsolutePath(target)
    ) throw deployError(
      "FIRESTORE_AUTHORITY_SOURCE_SPECIAL_OR_REPARSE_FILE_FORBIDDEN",
    );
    fileBytesByPath.set(path, bytes);
  }
  let indexes;
  try {
    indexes = JSON.parse(
      fileBytesByPath.get(
        "provider/firebase/firestore.indexes.json",
      ).toString("utf8"),
    );
  } catch {
    throw deployError("FIRESTORE_INDEX_AUTHORITY_SOURCE_INVALID");
  }
  if (
    !Array.isArray(indexes.indexes)
    || indexes.indexes.length !== 0
    || !Array.isArray(indexes.fieldOverrides)
    || indexes.fieldOverrides.length !== 0
  ) throw deployError(
    "FIRESTORE_INDEX_DEPLOYMENT_OUTSIDE_EMPTY_INDEX_CONTRACT",
  );
  const rulesBytes =
    fileBytesByPath.get("provider/firebase/firestore.rules");
  if (
    rulesBytes.byteLength === 0
    || !rulesBytes.toString("utf8").includes("allow read, write: if false;")
  ) throw deployError("FIRESTORE_DENY_ALL_RULE_SOURCE_REQUIRED");
  return Object.freeze({
    fileBytesByPath,
    firestoreIndexesSha256: sha256(
      fileBytesByPath.get("provider/firebase/firestore.indexes.json"),
    ),
    firestoreRulesSha256: sha256(rulesBytes),
  });
}

async function captureBoundProviderSource(repositoryRoot, execFileImpl) {
  const before = repositoryReadback(repositoryRoot, execFileImpl);
  const providerPackage = await readValidatedProviderPackage(repositoryRoot);
  const firestoreAuthority =
    await readValidatedFirestoreAuthorityFiles(repositoryRoot);
  const gitBoundPaths = [
    providerPackageArtifactPath,
    ...providerPackageFilePaths,
    ...firestoreAuthorityFilePaths,
  ];
  assertExactGitIndexBinding(
    repositoryRoot,
    execFileImpl,
    before.commit,
    gitBoundPaths,
  );
  const after = repositoryReadback(repositoryRoot, execFileImpl);
  if (before.commit !== after.commit || before.tree !== after.tree) {
    throw deployError("DEPLOY_SOURCE_CHANGED_DURING_VALIDATION");
  }
  const terminalPackage =
    await readValidatedProviderPackage(repositoryRoot);
  const terminalFirestoreAuthority =
    await readValidatedFirestoreAuthorityFiles(repositoryRoot);
  if (
    sha256(providerPackage.artifactBytes)
      !== sha256(terminalPackage.artifactBytes)
    || providerPackage.manifest.functionsSourceSha256
      !== terminalPackage.manifest.functionsSourceSha256
    || firestoreAuthority.firestoreIndexesSha256
      !== terminalFirestoreAuthority.firestoreIndexesSha256
    || firestoreAuthority.firestoreRulesSha256
      !== terminalFirestoreAuthority.firestoreRulesSha256
  ) throw deployError("DEPLOY_SOURCE_CHANGED_DURING_VALIDATION");
  for (const path of providerPackageFilePaths) {
    if (
      !providerPackage.fileBytesByPath.get(path)
        .equals(terminalPackage.fileBytesByPath.get(path))
    ) throw deployError("DEPLOY_SOURCE_CHANGED_DURING_VALIDATION");
  }
  const providerAuthoritySourceSha256 = createHash("sha256")
    .update(providerPackage.manifest.functionsSourceSha256, "utf8")
    .update("\0", "utf8")
    .update(firestoreAuthority.firestoreIndexesSha256, "utf8")
    .update("\0", "utf8")
    .update(firestoreAuthority.firestoreRulesSha256, "utf8")
    .digest("hex");
  const snapshot = Object.freeze({
    commit: after.commit,
    tree: after.tree,
    workingTreeClean: true,
    providerPackageArtifactSha256: sha256(providerPackage.artifactBytes),
    functionsSourceSha256:
      providerPackage.manifest.functionsSourceSha256,
    firestoreIndexesSha256:
      firestoreAuthority.firestoreIndexesSha256,
    firestoreRulesSha256: firestoreAuthority.firestoreRulesSha256,
    providerAuthoritySourceSha256,
    fileCount: providerPackage.manifest.fileCount,
  });
  boundSourceBytes.set(snapshot, Object.freeze({
    functionFiles: Object.freeze(providerPackage.manifest.files.map(
      ({ path }) => Object.freeze({
        path,
        bytes: Buffer.from(providerPackage.fileBytesByPath.get(path)),
      }),
    )),
    firestoreIndexesBytes: Buffer.from(
      firestoreAuthority.fileBytesByPath.get(
        "provider/firebase/firestore.indexes.json",
      ),
    ),
    firestoreRulesBytes: Buffer.from(
      firestoreAuthority.fileBytesByPath.get(
        "provider/firebase/firestore.rules",
      ),
    ),
  }));
  return snapshot;
}

function sameSourceSnapshot(left, right) {
  return (
    left?.workingTreeClean === true
    && right?.workingTreeClean === true
    && left.commit === right.commit
    && left.tree === right.tree
    && left.providerPackageArtifactSha256
      === right.providerPackageArtifactSha256
    && left.functionsSourceSha256 === right.functionsSourceSha256
    && left.firestoreIndexesSha256 === right.firestoreIndexesSha256
    && left.firestoreRulesSha256 === right.firestoreRulesSha256
    && left.providerAuthoritySourceSha256
      === right.providerAuthoritySourceSha256
    && left.fileCount === right.fileCount
  );
}

async function assertSourceSnapshotUnchanged(
  expected,
  repositoryRoot,
  execFileImpl,
) {
  const observed =
    await captureBoundProviderSource(repositoryRoot, execFileImpl);
  if (!sameSourceSnapshot(expected, observed)) {
    throw deployError("DEPLOY_SOURCE_TERMINAL_RECHECK_MISMATCH");
  }
  return observed;
}

function snapshotRelativePath(repositoryPath) {
  const prefix = `${providerFunctionsSourceRoot}/`;
  if (!repositoryPath.startsWith(prefix)) {
    throw deployError("DEPLOYMENT_SNAPSHOT_SOURCE_PATH_OUTSIDE_FUNCTIONS");
  }
  const path = repositoryPath.slice(prefix.length);
  if (
    path.length === 0
    || isAbsolute(path)
    || path.includes("\\")
    || path.includes("\0")
    || path.split("/").some((part) => part === "..")
  ) throw deployError("DEPLOYMENT_SNAPSHOT_SOURCE_PATH_INVALID");
  return path;
}

function exactSnapshotPath(snapshotRoot, path) {
  const target = resolve(snapshotRoot, ...path.split("/"));
  const fromRoot = relative(snapshotRoot, target);
  if (
    fromRoot === ""
    || fromRoot === ".."
    || fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    || isAbsolute(fromRoot)
  ) throw deployError("DEPLOYMENT_SNAPSHOT_PATH_ESCAPED");
  return target;
}

function assertOwnedDeploymentSnapshotPath(snapshotRoot) {
  const root = resolve(snapshotRoot);
  const expectedParent = resolve(tmpdir());
  if (
    !ownedDeploymentSnapshotDirectories.has(root)
    || normalizeAbsolutePath(dirname(root))
      !== normalizeAbsolutePath(expectedParent)
    || !basename(root).startsWith(deploymentSnapshotPrefix)
    || basename(root).length <= deploymentSnapshotPrefix.length
  ) throw deployError("DEPLOYMENT_SNAPSHOT_TARGET_NOT_OWNED");
  return root;
}

async function collectDeploymentSnapshotFiles(snapshotRoot, directory) {
  await assertRealDirectory(directory);
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    const stats = await lstat(target);
    if (stats.isSymbolicLink()) {
      throw deployError("DEPLOYMENT_SNAPSHOT_SPECIAL_FILE_FORBIDDEN");
    }
    if (entry.isDirectory() && stats.isDirectory()) {
      paths.push(...await collectDeploymentSnapshotFiles(
        snapshotRoot,
        target,
      ));
    } else if (entry.isFile() && stats.isFile()) {
      if (
        normalizeAbsolutePath(await realpath(target))
          !== normalizeAbsolutePath(target)
      ) throw deployError("DEPLOYMENT_SNAPSHOT_REPARSE_FILE_FORBIDDEN");
      paths.push(relative(snapshotRoot, target).replaceAll("\\", "/"));
    } else {
      throw deployError("DEPLOYMENT_SNAPSHOT_SPECIAL_FILE_FORBIDDEN");
    }
  }
  return paths;
}

async function validateMaterializedDeploymentSnapshot(
  sourceSnapshot,
  snapshotRoot,
) {
  const bytes = boundSourceBytes.get(sourceSnapshot);
  if (bytes === undefined) {
    throw deployError("BOUND_SOURCE_BYTES_REQUIRED");
  }
  const root = assertOwnedDeploymentSnapshotPath(snapshotRoot);
  const expected = bytes.functionFiles.map(({ path, bytes: content }) => ({
    path: snapshotRelativePath(path),
    bytes: content,
  })).sort((left, right) => left.path.localeCompare(right.path));
  const observedPaths =
    (await collectDeploymentSnapshotFiles(root, root)).sort();
  if (
    JSON.stringify(observedPaths)
      !== JSON.stringify(expected.map(({ path }) => path))
  ) throw deployError("DEPLOYMENT_SNAPSHOT_EXACT_FILE_SET_MISMATCH");
  for (const file of expected) {
    const target = exactSnapshotPath(root, file.path);
    const content = await readFile(target);
    if (!content.equals(file.bytes)) {
      throw deployError("DEPLOYMENT_SNAPSHOT_BYTE_MISMATCH");
    }
  }
  return Object.freeze({
    exactFileSet: true,
    fileCount: expected.length,
    functionsSourceSha256: sourceSnapshot.functionsSourceSha256,
  });
}

async function createMaterializedDeploymentSnapshot(sourceSnapshot) {
  const bytes = boundSourceBytes.get(sourceSnapshot);
  if (bytes === undefined) throw deployError("BOUND_SOURCE_BYTES_REQUIRED");
  const root = resolve(await mkdtemp(
    join(resolve(tmpdir()), deploymentSnapshotPrefix),
  ));
  if (
    normalizeAbsolutePath(dirname(root))
      !== normalizeAbsolutePath(resolve(tmpdir()))
    || !basename(root).startsWith(deploymentSnapshotPrefix)
  ) throw deployError("DEPLOYMENT_SNAPSHOT_TARGET_INVALID");
  ownedDeploymentSnapshotDirectories.add(root);
  try {
    await assertRealDirectory(root);
    for (const file of bytes.functionFiles) {
      const relativePath = snapshotRelativePath(file.path);
      const target = exactSnapshotPath(root, relativePath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.bytes, { flag: "wx" });
    }
    await validateMaterializedDeploymentSnapshot(sourceSnapshot, root);
    return root;
  } catch (error) {
    await removeMaterializedDeploymentSnapshot(root);
    throw error;
  }
}

async function removeMaterializedDeploymentSnapshot(snapshotRoot) {
  const root = assertOwnedDeploymentSnapshotPath(snapshotRoot);
  try {
    const stats = await lstat(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw deployError("DEPLOYMENT_SNAPSHOT_CLEANUP_TARGET_INVALID");
    }
    if (
      normalizeAbsolutePath(await realpath(root))
        !== normalizeAbsolutePath(root)
    ) throw deployError("DEPLOYMENT_SNAPSHOT_CLEANUP_REPARSE_FORBIDDEN");
    await collectDeploymentSnapshotFiles(root, root);
    await rm(root, { recursive: true, force: false });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  } finally {
    ownedDeploymentSnapshotDirectories.delete(root);
  }
}

export async function validateProviderPackageSnapshotForTesting({
  repositoryRoot,
} = {}) {
  if (
    typeof repositoryRoot !== "string"
    || repositoryRoot.length === 0
    || normalizeAbsolutePath(repositoryRoot) === normalizeAbsolutePath(repo)
  ) throw deployError("TEST_PROVIDER_REPOSITORY_MUST_BE_NON_PRODUCTION");
  return captureBoundProviderSource(
    resolve(repositoryRoot),
    execFileSync,
  );
}

export async function functionsSourceSha256(...args) {
  if (args.length !== 0) {
    throw deployError("PRODUCTION_DEPLOY_SOURCE_OVERRIDE_FORBIDDEN");
  }
  return (
    await captureBoundProviderSource(repo, createPinnedGitExecFile())
  ).functionsSourceSha256;
}

function functionDeploymentArgs(name, {
  environmentMode,
  previewOrigin,
  sourceDirectory,
}) {
  if (!deployFunctionNames.includes(name)) {
    throw deployError("DEPLOY_FUNCTION_NOT_ALLOWLISTED");
  }
  const env = [
    "LUDYS_STAGING_RUNTIME_PHASE=EXTERNAL_SYNTHETIC_STAGING",
    ...(previewOrigin === undefined
      ? []
      : [`LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN=${previewOrigin}`]),
    ...(name === "issueSyntheticSession"
      ? [
          `LUDYS_STAGING_SESSION_ISSUANCE_ENABLED=${
            environmentMode === "active" ? "true" : "false"
          }`,
        ]
      : []),
  ];
  const envFlag = environmentMode === "disabled"
    ? `--set-env-vars=${env.join(",")}`
    : `--update-env-vars=${env.join(",")}`;
  const args = [
    "functions",
    "deploy",
    name,
    "--gen2",
    "--runtime=nodejs24",
    `--region=${deployIdentityScope.region}`,
    `--source=${sourceDirectory}`,
    `--entry-point=${name}`,
    "--trigger-http",
    publicFunctionNames.has(name)
      ? "--allow-unauthenticated"
      : "--no-allow-unauthenticated",
    `--service-account=${deployIdentityScope.runtimeServiceAccount}`,
    "--max-instances=1",
    "--concurrency=1",
    "--memory=256Mi",
    "--timeout=60s",
    "--ingress-settings=all",
    envFlag,
    "--set-secrets=LUDYS_CAPABILITY_HMAC_KEY=LUDYS_CAPABILITY_HMAC_KEY:1",
    `--project=${deployIdentityScope.projectId}`,
    `--account=${deployIdentityScope.approvedGoogleAccount}`,
    deploymentImpersonationFlag,
    "--quiet",
  ];
  assertImpersonatedGcloudArgs(args);
  return Object.freeze(args);
}

function deploymentCommandsForSource(
  action,
  previewOrigin,
  sourceDirectory,
) {
  if (action === "deploy-disabled") {
    return Object.freeze(deployFunctionNames.map((name) => (
      functionDeploymentArgs(name, {
        environmentMode: "disabled",
        sourceDirectory,
      })
    )));
  }
  if (action === "configure-preview-origin") {
    const origin = canonicalPreviewOrigin(previewOrigin);
    return Object.freeze(deployFunctionNames.map((name) => (
      functionDeploymentArgs(name, {
        environmentMode: "configured",
        previewOrigin: origin,
        sourceDirectory,
      })
    )));
  }
  if (action === "activate-session-issuance") {
    const origin = canonicalPreviewOrigin(previewOrigin);
    return Object.freeze([
      functionDeploymentArgs("issueSyntheticSession", {
        environmentMode: "active",
        previewOrigin: origin,
        sourceDirectory,
      }),
    ]);
  }
  if (action === "deploy-firestore-rules") return Object.freeze([]);
  throw deployError("DEPLOY_ACTION_NOT_ALLOWED");
}

export function deploymentCommands(action, previewOrigin) {
  return deploymentCommandsForSource(
    action,
    previewOrigin,
    providerFunctionsSourceRoot,
  );
}

function execute(execFileImpl, args, code) {
  try {
    return String(execFileImpl("gcloud", args, {
      cwd: repo,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    })).trim();
  } catch {
    throw deployError(code);
  }
}

function executeJson(execFileImpl, args, code) {
  const output = execute(execFileImpl, args, code);
  try {
    return JSON.parse(output);
  } catch {
    throw deployError(`${code}_INVALID_JSON`);
  }
}

function assertObserved(condition, code) {
  if (!condition) throw deployError(code);
}

export function memoryQuantityBytes(value) {
  if (typeof value !== "string") return null;
  const match = /^([0-9]+)(k|M|G|Ki|Mi|Gi)?$/u.exec(value);
  if (match === null) return null;
  const units = Object.freeze({
    "": 1n,
    k: 1_000n,
    M: 1_000_000n,
    G: 1_000_000_000n,
    Ki: 1_024n,
    Mi: 1_048_576n,
    Gi: 1_073_741_824n,
  });
  const bytes = BigInt(match[1]) * units[match[2] ?? ""];
  return bytes <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(bytes)
    : null;
}

function exactObject(actual, expected) {
  if (
    actual === null
    || typeof actual !== "object"
    || Array.isArray(actual)
  ) return false;
  const actualEntries = Object.entries(actual).sort(([left], [right]) => (
    left.localeCompare(right)
  ));
  const expectedEntries = Object.entries(expected).sort(([left], [right]) => (
    left.localeCompare(right)
  ));
  return JSON.stringify(actualEntries) === JSON.stringify(expectedEntries);
}

function expectedFunctionEnvironment(name, action, previewOrigin) {
  return {
    LUDYS_STAGING_RUNTIME_PHASE: "EXTERNAL_SYNTHETIC_STAGING",
    ...(previewOrigin === undefined
      ? {}
      : { LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN: previewOrigin }),
    ...(name === "issueSyntheticSession"
      ? {
          LUDYS_STAGING_SESSION_ISSUANCE_ENABLED:
            action === "activate-session-issuance" ? "true" : "false",
        }
      : {}),
  };
}

function functionDescribeArgs(name) {
  const args = [
    "functions",
    "describe",
    name,
    "--gen2",
    `--region=${deployIdentityScope.region}`,
    `--project=${deployIdentityScope.projectId}`,
    `--account=${deployIdentityScope.approvedGoogleAccount}`,
    deploymentImpersonationFlag,
    "--format=json",
  ];
  assertImpersonatedGcloudArgs(args);
  return Object.freeze(args);
}

function verifiedFunctionReadback(name, observed, action, previewOrigin) {
  const expectedName = [
    `projects/${deployIdentityScope.projectId}`,
    `locations/${deployIdentityScope.region}`,
    `functions/${name}`,
  ].join("/");
  const expectedService = [
    `projects/${deployIdentityScope.projectId}`,
    `locations/${deployIdentityScope.region}`,
    `services/${name.toLowerCase()}`,
  ].join("/");
  const expectedEnvironment = expectedFunctionEnvironment(
    name,
    action,
    previewOrigin,
  );
  const build = observed?.buildConfig;
  const service = observed?.serviceConfig;
  assertObserved(
    observed?.name === expectedName,
    "FUNCTION_READBACK_RESOURCE_NAME_MISMATCH",
  );
  assertObserved(
    observed?.state === "ACTIVE",
    "FUNCTION_READBACK_STATE_NOT_ACTIVE",
  );
  assertObserved(
    observed?.environment === "GEN_2",
    "FUNCTION_READBACK_ENVIRONMENT_NOT_GEN2",
  );
  assertObserved(
    build?.runtime === "nodejs24",
    "FUNCTION_READBACK_RUNTIME_MISMATCH",
  );
  assertObserved(
    build?.entryPoint === name,
    "FUNCTION_READBACK_ENTRY_POINT_MISMATCH",
  );
  assertObserved(
    service?.service === expectedService,
    "FUNCTION_READBACK_RUN_SERVICE_MISMATCH",
  );
  assertObserved(
    service?.serviceAccountEmail === deployIdentityScope.runtimeServiceAccount,
    "FUNCTION_READBACK_RUNTIME_IDENTITY_MISMATCH",
  );
  assertObserved(
    (service?.minInstanceCount ?? 0) === 0
      && service?.maxInstanceCount === 1,
    "FUNCTION_READBACK_INSTANCE_LIMIT_MISMATCH",
  );
  assertObserved(
    service?.maxInstanceRequestConcurrency === 1,
    "FUNCTION_READBACK_CONCURRENCY_MISMATCH",
  );
  assertObserved(
    memoryQuantityBytes(service?.availableMemory)
      === deploymentMemoryBytes,
    "FUNCTION_READBACK_MEMORY_MISMATCH",
  );
  assertObserved(
    service?.timeoutSeconds === 60,
    "FUNCTION_READBACK_TIMEOUT_MISMATCH",
  );
  assertObserved(
    service?.ingressSettings === "ALLOW_ALL",
    "FUNCTION_READBACK_INGRESS_MISMATCH",
  );
  assertObserved(
    service?.allTrafficOnLatestRevision === true,
    "FUNCTION_READBACK_LATEST_REVISION_TRAFFIC_MISMATCH",
  );
  assertObserved(
    exactObject(service?.environmentVariables, expectedEnvironment),
    "FUNCTION_READBACK_ENVIRONMENT_VARIABLES_MISMATCH",
  );
  const secrets = service?.secretEnvironmentVariables;
  assertObserved(
    Array.isArray(secrets)
      && secrets.length === 1
      && secrets[0]?.key === "LUDYS_CAPABILITY_HMAC_KEY"
      && secrets[0]?.secret === "LUDYS_CAPABILITY_HMAC_KEY"
      && secrets[0]?.version === "1"
      && [
        deployIdentityScope.projectId,
        deployIdentityScope.projectNumber,
      ].includes(String(secrets[0]?.projectId)),
    "FUNCTION_READBACK_SECRET_REFERENCE_MISMATCH",
  );
  const issuance = name === "issueSyntheticSession"
    ? service.environmentVariables.LUDYS_STAGING_SESSION_ISSUANCE_ENABLED
      === "true"
    : null;
  return Object.freeze({
    functionName: name,
    functionResourceName: observed.name,
    runServiceName: service.service,
    state: observed.state,
    environment: observed.environment,
    runtime: build.runtime,
    entryPoint: build.entryPoint,
    runtimeServiceAccount: service.serviceAccountEmail,
    minInstanceCount: service.minInstanceCount ?? 0,
    maxInstanceCount: service.maxInstanceCount,
    maxInstanceRequestConcurrency: service.maxInstanceRequestConcurrency,
    availableMemory: service.availableMemory,
    availableMemoryBytes: memoryQuantityBytes(
      service.availableMemory,
    ),
    timeoutSeconds: service.timeoutSeconds,
    ingressSettings: service.ingressSettings,
    allTrafficOnLatestRevision: service.allTrafficOnLatestRevision,
    runtimePhase:
      service.environmentVariables.LUDYS_STAGING_RUNTIME_PHASE,
    previewOrigin:
      service.environmentVariables.LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN ?? null,
    sessionIssuanceEnabled: issuance,
    secretEnvironmentKeys: Object.freeze(
      secrets.map((secret) => secret.key).sort(),
    ),
    secretValuesPrinted: false,
  });
}

function describeAndVerifyFunction(
  execFileImpl,
  name,
  action,
  previewOrigin,
) {
  const observed = executeJson(
    execFileImpl,
    functionDescribeArgs(name),
    "IMPERSONATED_FUNCTION_READBACK_FAILED",
  );
  return verifiedFunctionReadback(name, observed, action, previewOrigin);
}

async function safeProviderJson(response, code) {
  if (!response?.ok) throw deployError(code);
  try {
    return await response.json();
  } catch {
    throw deployError(`${code}_INVALID_JSON`);
  }
}

function boundedProviderFetch(fetchImpl, url, options = {}) {
  return fetchImpl(url, {
    ...options,
    signal: AbortSignal.timeout(20_000),
  });
}

const cloudPlatformOAuthScope =
  "https://www.googleapis.com/auth/cloud-platform";
const testBaseOAuthAccessToken =
  "test-only-base-oauth-token-never-used-on-network";
const testImpersonatedAccessToken =
  "test-only-impersonated-token-never-used-on-network";

function impersonatedDeployTokenRequest({
  baseAccessToken,
  requestScope,
}) {
  if (
    requestScope !== deployIdentityScope
    && requestScope !== externalControlTestScope
  ) throw deployError("DEPLOY_IMPERSONATED_TOKEN_SCOPE_INVALID");
  if (
    typeof baseAccessToken !== "string"
    || baseAccessToken.length < 20
    || baseAccessToken.length > 8192
    || /\s/u.test(baseAccessToken)
  ) throw deployError("DEPLOY_BASE_OAUTH_AUTHORITY_INVALID");
  const serviceAccountName =
    `projects/-/serviceAccounts/${requestScope.deployServiceAccount}`;
  return Object.freeze({
    url:
      "https://iamcredentials.googleapis.com/v1/"
      + `${serviceAccountName}:generateAccessToken`,
    options: Object.freeze({
      method: "POST",
      headers: Object.freeze({
        authorization: `Bearer ${baseAccessToken}`,
        "content-type": "application/json",
        "x-goog-user-project": requestScope.projectId,
      }),
      body: JSON.stringify({
        delegates: [],
        scope: [cloudPlatformOAuthScope],
        lifetime: "900s",
      }),
    }),
  });
}

function validatedImpersonatedDeployToken(
  value,
  instant,
  requestScope,
) {
  const expiresAt = Date.parse(value?.expireTime);
  const lifetimeMilliseconds = expiresAt - instant.valueOf();
  if (
    typeof value?.accessToken !== "string"
    || value.accessToken.length < 20
    || value.accessToken.length > 8192
    || /\s/u.test(value.accessToken)
    || !Number.isFinite(expiresAt)
    || new Date(expiresAt).toISOString() !== value.expireTime
    || lifetimeMilliseconds < 5 * 60 * 1000
    || lifetimeMilliseconds > 16 * 60 * 1000
  ) throw deployError("DEPLOY_IMPERSONATED_ACCESS_TOKEN_INVALID");
  return Object.freeze({
    accessToken: value.accessToken,
    expireTime: value.expireTime,
    serviceAccount: requestScope.deployServiceAccount,
    scope: cloudPlatformOAuthScope,
    tokenPrinted: false,
    tokenPersisted: false,
  });
}

async function acquireImpersonatedDeployAccessToken({
  fetchImpl,
  baseAccessToken,
  now,
}) {
  if (
    typeof fetchImpl !== "function"
    || typeof now !== "function"
  ) throw deployError("DEPLOY_BASE_OAUTH_AUTHORITY_INVALID");
  const instant = now();
  if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) {
    throw deployError("DEPLOY_IMPERSONATED_TOKEN_TIME_INVALID");
  }
  const request = impersonatedDeployTokenRequest({
    baseAccessToken,
    requestScope: deployIdentityScope,
  });
  const response = await boundedProviderFetch(
    fetchImpl,
    request.url,
    request.options,
  );
  const value = await safeProviderJson(
    response,
    "DEPLOY_IMPERSONATED_ACCESS_TOKEN_FAILED",
  );
  return validatedImpersonatedDeployToken(
    value,
    instant,
    deployIdentityScope,
  );
}

export function simulateImpersonatedDeployAccessTokenForTesting(
  options = {},
) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || JSON.stringify(Object.keys(options).sort())
      !== JSON.stringify(["expireTime", "now"])
    || typeof options.now !== "function"
    || typeof options.expireTime !== "string"
  ) {
    throw deployError("EXACT_IN_MEMORY_TOKEN_TEST_INPUT_REQUIRED");
  }
  const instant = options.now();
  if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) {
    throw deployError("DEPLOY_IMPERSONATED_TOKEN_TIME_INVALID");
  }
  return Object.freeze({
    request: impersonatedDeployTokenRequest({
      baseAccessToken: testBaseOAuthAccessToken,
      requestScope: externalControlTestScope,
    }),
    authority: validatedImpersonatedDeployToken({
      accessToken: testImpersonatedAccessToken,
      expireTime: options.expireTime,
    }, instant, externalControlTestScope),
  });
}

function assertExactActionActivationCapability(
  action,
  capability,
  previewOrigin,
) {
  if (
    action === "deploy-disabled"
    || action === "deploy-firestore-rules"
  ) {
    return assertBaseActivationCapability(capability);
  }
  if (action === "configure-preview-origin") {
    return assertProtectedPreviewActivationCapability(
      capability,
      { previewOrigin },
    );
  }
  if (action === "activate-session-issuance") {
    return assertLiveActivationCapability(
      capability,
      { previewOrigin },
    );
  }
  throw deployError("DEPLOY_ACTION_NOT_ALLOWED");
}

async function deployFirestoreRules({
  acquireImpersonatedAccessTokenImpl,
  fetchImpl,
  firestoreIndexesBytes,
  firestoreRulesBytes,
  terminalMutationRecheck,
}) {
  if (typeof fetchImpl !== "function") throw deployError("DEPLOY_FETCH_REQUIRED");
  let indexes;
  try {
    indexes = JSON.parse(firestoreIndexesBytes.toString("utf8"));
  } catch {
    throw deployError("FIRESTORE_INDEX_AUTHORITY_SOURCE_INVALID");
  }
  if (
    !Array.isArray(indexes.indexes)
    || indexes.indexes.length !== 0
    || !Array.isArray(indexes.fieldOverrides)
    || indexes.fieldOverrides.length !== 0
  ) throw deployError("FIRESTORE_INDEX_DEPLOYMENT_OUTSIDE_EMPTY_INDEX_CONTRACT");
  const source = firestoreRulesBytes.toString("utf8");
  const sourceSha256 = createHash("sha256").update(source).digest("hex");
  if (typeof acquireImpersonatedAccessTokenImpl !== "function") {
    throw deployError(
      "DEPLOY_IMPERSONATED_ACCESS_TOKEN_PROVIDER_REQUIRED",
    );
  }
  const tokenAuthority =
    await acquireImpersonatedAccessTokenImpl();
  const token = tokenAuthority?.accessToken;
  if (
    typeof token !== "string"
    || token.length < 20
    || token.length > 8192
    || /\s/u.test(token)
    || tokenAuthority?.serviceAccount
      !== deployIdentityScope.deployServiceAccount
    || tokenAuthority?.scope !== cloudPlatformOAuthScope
    || tokenAuthority?.tokenPrinted !== false
    || tokenAuthority?.tokenPersisted !== false
  ) {
    throw deployError("DEPLOY_IMPERSONATED_ACCESS_TOKEN_INVALID");
  }
  const headers = Object.freeze({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-goog-user-project": deployIdentityScope.projectId,
  });
  const releaseName = [
    `projects/${deployIdentityScope.projectId}`,
    "releases/cloud.firestore/(default)",
  ].join("/");
  const currentReleaseResponse = await boundedProviderFetch(
    fetchImpl,
    `https://firebaserules.googleapis.com/v1/${releaseName}`,
    { headers },
  );
  const releaseExists = currentReleaseResponse?.status !== 404;
  const currentRelease = releaseExists
    ? await safeProviderJson(
        currentReleaseResponse,
        "FIRESTORE_RULES_CURRENT_RELEASE_READ_FAILED",
      )
    : null;
  if (
    releaseExists
    && (
      currentRelease?.name !== releaseName
      || typeof currentRelease?.rulesetName !== "string"
      || !currentRelease.rulesetName.startsWith(
        `projects/${deployIdentityScope.projectId}/rulesets/`,
      )
    )
  ) throw deployError("FIRESTORE_RULES_CURRENT_RELEASE_READBACK_INVALID");
  const previousRulesetName = currentRelease?.rulesetName ?? null;
  await terminalMutationRecheck();
  const ruleset = await safeProviderJson(await boundedProviderFetch(
    fetchImpl,
    `https://firebaserules.googleapis.com/v1/projects/${deployIdentityScope.projectId}/rulesets`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: {
          files: [{
            name: "firestore.rules",
            content: source,
          }],
        },
        attachmentPoint:
          `firestore.googleapis.com/projects/${deployIdentityScope.projectNumber}`
          + "/databases/(default)",
      }),
    },
  ), "FIRESTORE_RULESET_CREATE_FAILED");
  if (
    typeof ruleset.name !== "string"
    || !ruleset.name.startsWith(
      `projects/${deployIdentityScope.projectId}/rulesets/`,
    )
  ) throw deployError("FIRESTORE_RULESET_CREATE_READBACK_INVALID");
  await terminalMutationRecheck();
  const releaseMutation = releaseExists
    ? {
        url: `https://firebaserules.googleapis.com/v1/${releaseName}`,
        options: {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            release: {
              name: releaseName,
              rulesetName: ruleset.name,
            },
            updateMask: "rulesetName",
          }),
        },
      }
    : {
        url:
          `https://firebaserules.googleapis.com/v1/projects/`
          + `${deployIdentityScope.projectId}/releases`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: releaseName,
            rulesetName: ruleset.name,
          }),
        },
      };
  const release = await safeProviderJson(await boundedProviderFetch(
    fetchImpl,
    releaseMutation.url,
    releaseMutation.options,
  ), "FIRESTORE_RULES_RELEASE_FAILED");
  if (release.name !== releaseName || release.rulesetName !== ruleset.name) {
    throw deployError("FIRESTORE_RULES_RELEASE_READBACK_INVALID");
  }
  const verified = await safeProviderJson(await boundedProviderFetch(
    fetchImpl,
    `https://firebaserules.googleapis.com/v1/${releaseName}`,
    { headers },
  ), "FIRESTORE_RULES_RELEASE_VERIFY_FAILED");
  if (verified.rulesetName !== ruleset.name) {
    throw deployError("FIRESTORE_RULES_RELEASE_VERIFY_MISMATCH");
  }
  await terminalMutationRecheck();
  return Object.freeze({
    rulesetName: ruleset.name,
    releaseName,
    previousRulesetName,
    releaseMutation: releaseExists
      ? "PATCH_EXISTING_RELEASE"
      : "CREATE_MISSING_RELEASE",
    sourceSha256,
    indexCount: 0,
    fieldOverrideCount: 0,
    tokenPrinted: false,
    tokenPersisted: false,
  });
}

async function runExternalDeployBound(argv, {
  acquireImpersonatedAccessTokenImpl,
  activationCapability,
  assertTestMutationAuthority,
  repositoryRoot,
  providerExecFileImpl,
  fetchImpl,
  sourceGitExecFileImpl,
  now,
  environment,
  enforceActivationCapability,
  requestScope,
}) {
  const args = parseExactFlagPairs(argv);
  assertScope(args, requestScope);
  const action = args.get("--action");
  if (!ACTIONS.has(action)) throw deployError("DEPLOY_ACTION_NOT_ALLOWED");
  const previewOrigin = args.get("--preview-origin");
  if (enforceActivationCapability) {
    assertExactActionActivationCapability(
      action,
      activationCapability,
      previewOrigin,
    );
  } else if (typeof assertTestMutationAuthority !== "function") {
    throw deployError("TEST_DEPLOY_MUTATION_AUTHORITY_REQUIRED");
  }
  assertNoCredentialOverride(
    environment,
    { testing: !enforceActivationCapability },
  );
  const repositoryState = await captureBoundProviderSource(
    repositoryRoot,
    sourceGitExecFileImpl,
  );
  const sourceDigest = repositoryState.functionsSourceSha256;
  const capturedBytes = boundSourceBytes.get(repositoryState);
  if (capturedBytes === undefined) {
    throw deployError("BOUND_SOURCE_BYTES_REQUIRED");
  }
  if (
    repositoryState?.workingTreeClean !== true
    || repositoryState?.commit !== args.get("--source-commit")
    || repositoryState?.tree !== args.get("--source-tree")
    || !/^[a-f0-9]{64}$/u.test(sourceDigest)
    || sourceDigest !== args.get("--source-sha256")
  ) throw deployError("DEPLOY_SOURCE_BINDING_MISMATCH");
  const instant = now();
  assertDeployWindow(args.get("--window-expires-at"), instant);
  if (action === "deploy-disabled" || action === "deploy-firestore-rules") {
    if (previewOrigin !== undefined) {
      throw deployError("PREVIEW_ORIGIN_FOR_DISABLED_OR_RULES_DEPLOY_FORBIDDEN");
    }
  } else if (previewOrigin === undefined) {
    throw deployError("EXACT_PROTECTED_PREVIEW_ORIGIN_REQUIRED");
  }
  const identityArgs = [
    "--action", "verify",
    "--project", args.get("--project"),
    "--google-account", args.get("--google-account"),
    "--region", args.get("--region"),
    "--window-expires-at", args.get("--window-expires-at"),
  ];
  const identity = enforceActivationCapability
    ? await runDeployIdentityControl(identityArgs)
    : await runDeployIdentityControlForTesting(identityArgs, {
        execFileImpl: providerExecFileImpl,
        now: () => instant,
      });
  if (identity.userManagedKeyCount !== 0 || identity.identitiesDistinct !== true) {
    throw deployError("DEPLOY_IDENTITY_READBACK_NOT_KEYLESS_OR_DISTINCT");
  }
  const terminalSourceRecheck = () => assertSourceSnapshotUnchanged(
    repositoryState,
    repositoryRoot,
    sourceGitExecFileImpl,
  );
  const terminalMutationRecheck = async () => {
    await terminalSourceRecheck();
    if (enforceActivationCapability) {
      assertExactActionActivationCapability(
        action,
        activationCapability,
        previewOrigin,
      );
    } else {
      await assertTestMutationAuthority();
    }
    assertDeployWindow(args.get("--window-expires-at"), now());
  };

  if (action === "deploy-firestore-rules") {
    const firestore = await deployFirestoreRules({
      acquireImpersonatedAccessTokenImpl,
      fetchImpl,
      firestoreIndexesBytes: capturedBytes.firestoreIndexesBytes,
      firestoreRulesBytes: capturedBytes.firestoreRulesBytes,
      terminalMutationRecheck,
    });
    return Object.freeze({
      schemaVersion: "wp13.12b-ea-impersonated-deployment-v1",
      action,
      externalWrites: 2,
      projectId: deployIdentityScope.projectId,
      deployServiceAccount: deployIdentityScope.deployServiceAccount,
      sourceCommit: repositoryState.commit,
      sourceTree: repositoryState.tree,
      functionsSourceSha256: sourceDigest,
      firestoreIndexesSha256:
        repositoryState.firestoreIndexesSha256,
      firestoreRulesSha256: repositoryState.firestoreRulesSha256,
      providerAuthoritySourceSha256:
        repositoryState.providerAuthoritySourceSha256,
      runtimePhase: "EXTERNAL_SYNTHETIC_STAGING",
      sessionIssuanceEnabled: false,
      protectedPreviewOrigin: null,
      firestore,
      commandCount: 1,
      credentialOrTokenOutput: false,
    });
  }

  const deploymentSource =
    await createMaterializedDeploymentSnapshot(repositoryState);
  try {
    const commands = deploymentCommandsForSource(
      action,
      previewOrigin,
      deploymentSource,
    );
    const commandResults = [];
    for (const command of commands) {
      await validateMaterializedDeploymentSnapshot(
        repositoryState,
        deploymentSource,
      );
      await terminalMutationRecheck();
      execute(
        providerExecFileImpl,
        command,
        "IMPERSONATED_FUNCTION_DEPLOY_FAILED",
      );
      commandResults.push(describeAndVerifyFunction(
        providerExecFileImpl,
        command[2],
        action,
        previewOrigin,
      ));
    }
    await terminalSourceRecheck();
    await validateMaterializedDeploymentSnapshot(
      repositoryState,
      deploymentSource,
    );
    const observedIssuance = commandResults.find(
      (entry) => entry.functionName === "issueSyntheticSession",
    )?.sessionIssuanceEnabled;
    assertObserved(
      typeof observedIssuance === "boolean",
      "FUNCTION_ISSUANCE_READBACK_MISSING",
    );
    const observedRuntimePhases = new Set(
      commandResults.map((entry) => entry.runtimePhase),
    );
    const observedPreviewOrigins = new Set(
      commandResults.map((entry) => entry.previewOrigin),
    );
    assertObserved(
      observedRuntimePhases.size === 1
        && observedRuntimePhases.has("EXTERNAL_SYNTHETIC_STAGING"),
      "FUNCTION_RUNTIME_PHASE_READBACK_MISMATCH",
    );
    assertObserved(
      observedPreviewOrigins.size === 1,
      "FUNCTION_PREVIEW_ORIGIN_READBACK_MISMATCH",
    );
    return Object.freeze({
      schemaVersion: "wp13.12b-ea-impersonated-deployment-v1",
      action,
      externalWrites: commands.length,
      projectId: deployIdentityScope.projectId,
      deployServiceAccount: deployIdentityScope.deployServiceAccount,
      sourceCommit: repositoryState.commit,
      sourceTree: repositoryState.tree,
      functionsSourceSha256: sourceDigest,
      firestoreIndexesSha256:
        repositoryState.firestoreIndexesSha256,
      firestoreRulesSha256: repositoryState.firestoreRulesSha256,
      providerAuthoritySourceSha256:
        repositoryState.providerAuthoritySourceSha256,
      deploymentSource:
        "HEAD_BOUND_EPHEMERAL_EXACT_12_FILE_SNAPSHOT",
      runtimePhase: [...observedRuntimePhases][0],
      sessionIssuanceEnabled: observedIssuance,
      protectedPreviewOrigin: [...observedPreviewOrigins][0],
      commandCount: commands.length,
      commandResults: Object.freeze(commandResults),
      credentialOrTokenOutput: false,
    });
  } finally {
    await removeMaterializedDeploymentSnapshot(deploymentSource);
  }
}

function assertProductionDeployOptions(options) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).some((key) => key !== "activationCapability")
  ) throw deployError("PRODUCTION_DEPLOY_DEPENDENCY_INJECTION_FORBIDDEN");
}

export async function runExternalDeploy(argv, options = {}) {
  assertProductionDeployOptions(options);
  const parsed = parseExactFlagPairs(argv);
  assertScope(parsed);
  const action = parsed.get("--action");
  const previewOrigin = parsed.get("--preview-origin");
  if (action === "deploy-disabled" || action === "deploy-firestore-rules") {
    assertBaseActivationCapability(options.activationCapability);
  } else if (action === "configure-preview-origin") {
    assertProtectedPreviewActivationCapability(
      options.activationCapability,
      { previewOrigin },
    );
  } else if (action === "activate-session-issuance") {
    assertLiveActivationCapability(
      options.activationCapability,
      { previewOrigin },
    );
  }
  assertNoCredentialOverride(process.env);
  const googleOAuth = await acquirePinnedGoogleOAuthAccessToken();
  return runExternalDeployBound(argv, {
    acquireImpersonatedAccessTokenImpl: () =>
      acquireImpersonatedDeployAccessToken({
        fetchImpl: nativeFetch,
        baseAccessToken: googleOAuth.accessToken,
        now: () => new Date(),
      }),
    activationCapability: options.activationCapability,
    repositoryRoot: repo,
    providerExecFileImpl:
      createPinnedGoogleCloudCliExecFile({
        environment: process.env,
        googleOAuth,
      }),
    fetchImpl: nativeFetch,
    sourceGitExecFileImpl: createPinnedGitExecFile(),
    now: () => new Date(),
    environment: process.env,
    enforceActivationCapability: true,
    requestScope: deployIdentityScope,
  });
}

export async function runExternalDeployForTesting(argv, options = {}) {
  const expectedKeys = [
    "acquireImpersonatedAccessTokenImpl",
    "assertMutationAuthority",
    "environment",
    "fetchImpl",
    "now",
    "providerExecFileImpl",
    "repositoryRoot",
  ].sort();
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || JSON.stringify(Object.keys(options).sort())
      !== JSON.stringify(expectedKeys)
    || typeof options.repositoryRoot !== "string"
    || options.repositoryRoot.length === 0
    || normalizeAbsolutePath(options.repositoryRoot)
      === normalizeAbsolutePath(repo)
    || typeof options.providerExecFileImpl !== "function"
    || options.providerExecFileImpl === execFileSync
    || typeof options.fetchImpl !== "function"
    || options.fetchImpl === globalThis.fetch
    || typeof options.now !== "function"
    || typeof options.acquireImpersonatedAccessTokenImpl
      !== "function"
    || typeof options.assertMutationAuthority !== "function"
    || options.environment === null
    || typeof options.environment !== "object"
    || Array.isArray(options.environment)
  ) throw deployError("EXACT_NON_PRODUCTION_DEPLOY_TEST_ADAPTER_REQUIRED");
  const parsed = parseExactFlagPairs(argv);
  assertScope(parsed, externalControlTestScope);
  if (
    parsed.get("--action") !== "deploy-disabled"
    && parsed.get("--action") !== "deploy-firestore-rules"
  ) {
    throw deployError("TEST_DEPLOY_ADAPTER_FAIL_SAFE_ACTION_ONLY");
  }
  return runExternalDeployBound(argv, {
    acquireImpersonatedAccessTokenImpl:
      options.acquireImpersonatedAccessTokenImpl,
    activationCapability: undefined,
    assertTestMutationAuthority: options.assertMutationAuthority,
    repositoryRoot: resolve(options.repositoryRoot),
    providerExecFileImpl: (file, args, execOptions) =>
      options.providerExecFileImpl(
        file,
        externalControlTestArgvForTesting(args),
        execOptions,
      ),
    fetchImpl: (url, fetchOptions = {}) => options.fetchImpl(
      externalControlTestValueForTesting(String(url)),
      {
        ...fetchOptions,
        ...(fetchOptions.headers === undefined
          ? {}
          : {
              headers: Object.fromEntries(
                Object.entries(fetchOptions.headers).map(
                  ([name, value]) => [
                    name,
                    externalControlTestValueForTesting(String(value)),
                  ],
                ),
              ),
            }),
        ...(typeof fetchOptions.body !== "string"
          ? {}
          : {
              body:
                externalControlTestValueForTesting(fetchOptions.body),
            }),
      },
    ),
    sourceGitExecFileImpl: execFileSync,
    now: options.now,
    environment: options.environment,
    enforceActivationCapability: false,
    requestScope: externalControlTestScope,
  });
}

function safeError(error) {
  const code = typeof error?.code === "string"
    ? error.code
    : typeof error?.message === "string" ? error.message : "";
  return /^[A-Z0-9_:.-]{3,500}$/u.test(code)
    ? code
    : "EXTERNAL_DEPLOY_FAILED_CLOSED";
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && resolve(invokedPath) === fileURLToPath(import.meta.url)
) {
  try {
    const actionIndex = process.argv.indexOf("--action");
    const action = actionIndex >= 0
      ? process.argv[actionIndex + 1]
      : undefined;
    const activationCapability = (
      action === "deploy-disabled"
      || action === "deploy-firestore-rules"
    )
      ? await acquireBaseActivationCapability()
      : action === "configure-preview-origin"
        ? await acquirePreviewReadyActivationCapability()
        : action === "activate-session-issuance"
          ? await acquireLiveActivationCapability()
          : undefined;
    const result = await runExternalDeploy(
      process.argv.slice(2),
      { activationCapability },
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${safeError(error)}\n`);
    process.exitCode = 1;
  }
}
