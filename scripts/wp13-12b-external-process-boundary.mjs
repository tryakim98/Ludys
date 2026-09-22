import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import {
  basename,
  dirname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

const approvedWindowsUserProfile = "C:\\Users\\tryak";
const approvedWindowsRoot = "C:\\Windows";
const approvedWindowsTemp =
  "C:\\Users\\tryak\\AppData\\Local\\Temp";
const approvedProductionRepositoryRoot =
  "C:\\Users\\tryak\\Downloads\\"
  + "LUDYS_CODEX_PARALLEL_WP13_7A_2026-07-16\\"
  + "ludys-wp13-7a-codex";
const approvedGoogleAccount = "tryakim@gmail.com";
const approvedGoogleProjectId = "ludys-12b-stg-20260725";
const approvedDeployServiceAccount =
  "ludys-staging-deployer@ludys-12b-stg-20260725.iam.gserviceaccount.com";
const approvedFirebaseToolsVersion = "15.22.4";
const googleCloudCliMaximumOutputBytes = 1024 * 1024;
const googleCloudCliMaximumExecutionMs = 10 * 60 * 1000;
const googleCloudConfigDirectoryPrefix =
  "ludys-wp13-12b-gcloud-config-";
const googleOAuthResponseKeys = Object.freeze([
  "accessToken",
  "approvedGoogleAccount",
  "firebaseToolsVersion",
  "tokenPrinted",
]);
const googleCloudCliExtractionNormalizations = Object.freeze([
  Object.freeze({
    path:
      "platform/gsutil/third_party/funcsigs/docs/index.rst",
    payloadBytes: 13,
    payloadSha256:
      "bcf935b7c3bf8698509cad62ef76234819c85633264a7c92a27de3dc7ab81833",
  }),
  Object.freeze({
    path:
      "platform/gsutil/third_party/requests/tests/certs/mtls/client/ca",
    payloadBytes: 16,
    payloadSha256:
      "94fdaa86166761a70ab3094bceb55ce42859a60c2cc778ece9e05e0850785e39",
  }),
  Object.freeze({
    path:
      "platform/gsutil/third_party/google-auth-library-python-httplib2/"
      + "docs/CHANGELOG.md",
    payloadBytes: 15,
    payloadSha256:
      "5b1ace6cbf670b5d35b515086985890d889090026e075bb900834cea4945afba",
  }),
  Object.freeze({
    path:
      "platform/gsutil/third_party/google-auth-library-python-httplib2/"
      + "docs/README.rst",
    payloadBytes: 13,
    payloadSha256:
      "bcf935b7c3bf8698509cad62ef76234819c85633264a7c92a27de3dc7ab81833",
  }),
  Object.freeze({
    path:
      "platform/gsutil/third_party/mock/docs/changelog.txt",
    payloadBytes: 12,
    payloadSha256:
      "daad516ba747dc22bc28cb99ef9a9c9b5f582dce20f1c451e4fa32a01a6b0d1d",
  }),
  Object.freeze({
    path:
      "platform/gsutil/third_party/requests/tests/certs/valid/ca",
    payloadBytes: 13,
    payloadSha256:
      "e781a2bf952740c5eb6b55bbd316d2a21f461cb2ed013192ea226b943fb73afa",
  }),
]);

export const approvedGoogleCloudCli = Object.freeze({
  version: "577.0.0",
  archiveName:
    "google-cloud-sdk-577.0.0-windows-x86_64-bundled-python.zip",
  archiveUrl:
    "https://storage.googleapis.com/cloud-sdk-release/"
    + "google-cloud-sdk-577.0.0-windows-x86_64-bundled-python.zip",
  officialMirrorUrl:
    "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/"
    + "google-cloud-sdk-577.0.0-windows-x86_64-bundled-python.zip",
  archiveBytes: 110_769_066,
  archiveSizeDisplay: "110.8 MB",
  archiveSha256:
    "dcf9097b2c7a0a29bd6322571f5090c6046bed96b19c0750e62f549b735b80eb",
  installRoot:
    "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
    + "gcloud-577.0.0\\google-cloud-sdk",
  commandShimPath:
    "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
    + "gcloud-577.0.0\\google-cloud-sdk\\bin\\gcloud.cmd",
  bundledPythonPath:
    "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
    + "gcloud-577.0.0\\google-cloud-sdk\\platform\\bundledpython\\python.exe",
  executablePath:
    "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
    + "gcloud-577.0.0\\google-cloud-sdk\\platform\\bundledpython\\python.exe",
  bundledPythonBytes: 106_208,
  bundledPythonSha256:
    "03168c01b7b7491423350e82c26fee71f35b43694d1319d3c668bda6903a0c38",
  gcloudPythonPath:
    "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
    + "gcloud-577.0.0\\google-cloud-sdk\\lib\\gcloud.py",
  gcloudPythonBytes: 6_579,
  gcloudPythonSha256:
    "d223bce54ff2e1441268e73b06eec4830032dd7b4b17b8fa9e2638d4f6d8d39d",
  pythonFlags: Object.freeze(["-I", "-S", "-B"]),
  canonicalTreeAlgorithm:
    "SORTED_RELATIVE_PATH_CODE_UNIT_NUL_SIZE_NUL_SHA256_LF_V1",
  canonicalTreeFileCount: 29_931,
  canonicalTreeBytes: 459_287_508,
  canonicalTreeSha256:
    "da1f9c6799bb76a3bae3e59bd138b68ef4954dbc396306357c5babf46c34423d",
  extractionNormalization: Object.freeze({
    algorithm:
      "ZIP_SYMLINK_PAYLOAD_MATERIALIZED_AS_REGULAR_FILE_V1",
    sourceSymlinkModeEntryCount: 6,
    materializedRegularFileCount: 6,
    entries: googleCloudCliExtractionNormalizations,
    runtimeReparsePointsAllowed: false,
  }),
  activationStatus: "PINNED_INSTALL_AND_EXTRACTED_TREE_AUDITED",
});

export const dangerousExternalEnvironmentNames = Object.freeze([
  "ALL_PROXY",
  "CLOUDSDK_AUTH_ACCESS_TOKEN",
  "CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE",
  "CLOUDSDK_CONFIG",
  "CLOUDSDK_CORE_ACCOUNT",
  "CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE",
  "CLOUDSDK_CORE_PROJECT",
  "CURL_CA_BUNDLE",
  "DYLD_INSERT_LIBRARIES",
  "FIREBASE_TOKEN",
  "GCLOUD_PROJECT",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CEILING_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_SYSTEM",
  "GIT_DIR",
  "GIT_EXEC_PATH",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
  "GIT_WORK_TREE",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_OAUTH_ACCESS_TOKEN",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "LD_PRELOAD",
  "NODE_EXTRA_CA_CERTS",
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_REPL_EXTERNAL_MODULE",
  "NODE_TLS_REJECT_UNAUTHORIZED",
  "NO_PROXY",
  "NPM_CONFIG_PREFIX",
  "NPM_CONFIG_USERCONFIG",
  "NPM_TOKEN",
  "PYTHONHOME",
  "PYTHONPATH",
  "PYTHONSTARTUP",
  "REQUESTS_CA_BUNDLE",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "SSH_AUTH_SOCK",
  "VERCEL_TOKEN",
  "LUDYS_FIREBASE_CLI_LIB",
  "LUDYS_FIREBASE_MODULE_ROOT",
  "LUDYS_GCLOUD_BIN",
  "LUDYS_GIT_BIN",
  "LUDYS_VERCEL_MODULE_ROOT",
]);

const dangerousEnvironmentNames =
  new Set(dangerousExternalEnvironmentNames);

function boundaryError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function exactEnvironmentEntries(environment) {
  if (
    environment === null
    || typeof environment !== "object"
    || Array.isArray(environment)
  ) throw boundaryError("EXTERNAL_PROCESS_ENVIRONMENT_REQUIRED");
  return Object.entries(environment);
}

function assertNoDangerousExternalEnvironmentCore(
  environment,
  execArgv,
) {
  const entries = exactEnvironmentEntries(environment);
  if (!Array.isArray(execArgv) || execArgv.length !== 0) {
    throw boundaryError("EXTERNAL_PROCESS_EXEC_ARGV_FORBIDDEN");
  }
  const gitConfigEntries = entries.filter(
    ([name]) => name.toUpperCase().startsWith("GIT_CONFIG_"),
  );
  const exactCodexGitConfig = new Map([
    ["GIT_CONFIG_COUNT", "1"],
    ["GIT_CONFIG_KEY_0", "safe.directory"],
    ["GIT_CONFIG_VALUE_0", approvedProductionRepositoryRoot],
  ]);
  if (
    gitConfigEntries.length !== 0
    && (
      gitConfigEntries.length !== exactCodexGitConfig.size
      || gitConfigEntries.some(
        ([name, value]) =>
          exactCodexGitConfig.get(name.toUpperCase()) !== value,
      )
      || new Set(
        gitConfigEntries.map(([name]) => name.toUpperCase()),
      ).size !== exactCodexGitConfig.size
    )
  ) {
    throw boundaryError(
      "EXTERNAL_PROCESS_GIT_CONFIG_OVERRIDE_FORBIDDEN",
    );
  }
  const approvedCodexGitConfigPresent = gitConfigEntries.length
    === exactCodexGitConfig.size;
  for (const [name, value] of entries) {
    const normalizedName = name.toUpperCase();
    if (
      approvedCodexGitConfigPresent
      && exactCodexGitConfig.has(normalizedName)
    ) continue;
    if (
      dangerousEnvironmentNames.has(normalizedName)
      && typeof value === "string"
      && value.length > 0
    ) {
      throw boundaryError(
        `EXTERNAL_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN:${normalizedName}`,
      );
    }
  }
  return true;
}

export function assertNoDangerousExternalEnvironment(
  environment = process.env,
) {
  return assertNoDangerousExternalEnvironmentCore(
    environment,
    process.execArgv,
  );
}

export function assertNoDangerousExternalEnvironmentForTesting(
  environment,
) {
  return assertNoDangerousExternalEnvironmentCore(environment, []);
}

function preservedEnvironmentValue(environment, key) {
  const entry = Object.entries(environment).find(
    ([name]) => name.toUpperCase() === key.toUpperCase(),
  );
  if (entry === undefined) return undefined;
  if (typeof entry[1] !== "string" || entry[1].length === 0) {
    return undefined;
  }
  return entry[1];
}

function sanitizedExternalProcessEnvironmentCore(
  environment,
  execArgv,
  {
    preserveKeys = [],
    pathEntries = [],
  } = {},
) {
  assertNoDangerousExternalEnvironmentCore(environment, execArgv);
  if (
    !Array.isArray(preserveKeys)
    || preserveKeys.some(
      (key) =>
        typeof key !== "string"
        || key.length === 0
        || dangerousEnvironmentNames.has(key.toUpperCase()),
    )
    || !Array.isArray(pathEntries)
    || pathEntries.some(
      (path) =>
        typeof path !== "string"
        || path.length === 0
        || resolve(path) !== path,
    )
  ) throw boundaryError("EXTERNAL_PROCESS_ENVIRONMENT_ALLOWLIST_INVALID");
  if (process.platform !== "win32") {
    throw boundaryError("EXTERNAL_PROCESS_WINDOWS_BOUNDARY_REQUIRED");
  }
  const sanitized = {
    APPDATA: `${approvedWindowsUserProfile}\\AppData\\Roaming`,
    CI: "1",
    ComSpec: `${approvedWindowsRoot}\\System32\\cmd.exe`,
    LOCALAPPDATA: `${approvedWindowsUserProfile}\\AppData\\Local`,
    NO_COLOR: "1",
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    SystemRoot: approvedWindowsRoot,
    TEMP: approvedWindowsTemp,
    TMP: approvedWindowsTemp,
    USERPROFILE: approvedWindowsUserProfile,
    VERCEL_TELEMETRY_DISABLED: "1",
    WINDIR: approvedWindowsRoot,
    Path: [...pathEntries, `${approvedWindowsRoot}\\System32`].join(";"),
  };
  for (const key of preserveKeys) {
    const value = preservedEnvironmentValue(environment, key);
    if (value !== undefined) sanitized[key] = value;
  }
  return Object.freeze(sanitized);
}

export function sanitizedExternalProcessEnvironment(
  environment = process.env,
  options = {},
) {
  return sanitizedExternalProcessEnvironmentCore(
    environment,
    process.execArgv,
    options,
  );
}

export function sanitizedNodeChildEnvironment(
  environment = process.env,
  options = {},
) {
  return sanitizedExternalProcessEnvironment(environment, {
    ...options,
    pathEntries: [
      dirname(process.execPath),
      ...(options.pathEntries ?? []),
    ],
  });
}

export function sanitizedNodeChildEnvironmentForTesting(
  environment,
  options = {},
) {
  return sanitizedExternalProcessEnvironmentCore(
    environment,
    [],
    {
      ...options,
      pathEntries: [
        dirname(process.execPath),
        ...(options.pathEntries ?? []),
      ],
    },
  );
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameCanonicalWindowsPath(left, right) {
  return resolve(left).toLowerCase() === resolve(right).toLowerCase();
}

function metadataFingerprint(metadata) {
  return [
    metadata.dev,
    metadata.ino,
    metadata.mode,
    metadata.nlink,
    metadata.size,
    metadata.mtimeNs,
    metadata.ctimeNs,
  ].map(String).join(":");
}

function readMetadata(path, code) {
  try {
    return lstatSync(path, { bigint: true });
  } catch {
    throw boundaryError(code);
  }
}

function assertCanonicalDirectory(path, code) {
  const metadata = readMetadata(path, code);
  let canonical;
  try {
    canonical = realpathSync(path);
  } catch {
    throw boundaryError(code);
  }
  if (
    !metadata.isDirectory()
    || metadata.isSymbolicLink()
    || metadata.nlink !== 1n
    || !sameCanonicalWindowsPath(canonical, path)
  ) throw boundaryError(code);
  return metadata;
}

function readStableRegularFile(path, {
  code,
  requireCanonicalPath = false,
} = {}) {
  const before = readMetadata(path, code);
  if (
    !before.isFile()
    || before.isSymbolicLink()
    || before.nlink !== 1n
  ) throw boundaryError(code);
  if (requireCanonicalPath) {
    let canonical;
    try {
      canonical = realpathSync(path);
    } catch {
      throw boundaryError(code);
    }
    if (!sameCanonicalWindowsPath(canonical, path)) {
      throw boundaryError(code);
    }
  }
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    throw boundaryError(code);
  }
  const after = readMetadata(path, code);
  if (
    !after.isFile()
    || after.isSymbolicLink()
    || after.nlink !== 1n
    || metadataFingerprint(after) !== metadataFingerprint(before)
    || after.size !== BigInt(bytes.byteLength)
  ) throw boundaryError(code);
  return bytes;
}

function exactDirectoryEntries(directory, code) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    throw boundaryError(code);
  }
  return entries.sort((left, right) =>
    compareCodeUnits(left.name, right.name));
}

export function canonicalGoogleCloudCliTreeSnapshot(root) {
  if (typeof root !== "string" || root.length === 0) {
    throw boundaryError("PINNED_GOOGLE_CLOUD_CLI_TREE_ROOT_REQUIRED");
  }
  const resolvedRoot = resolve(root);
  let canonicalRoot;
  try {
    canonicalRoot = realpathSync(resolvedRoot);
  } catch {
    throw boundaryError("PINNED_GOOGLE_CLOUD_CLI_TREE_UNREADABLE");
  }
  if (!sameCanonicalWindowsPath(canonicalRoot, resolvedRoot)) {
    throw boundaryError("PINNED_GOOGLE_CLOUD_CLI_TREE_ROOT_INVALID");
  }
  assertCanonicalDirectory(
    canonicalRoot,
    "PINNED_GOOGLE_CLOUD_CLI_TREE_ROOT_INVALID",
  );
  const files = [];
  const caseFoldedPaths = new Set();
  const visit = (directory) => {
    const directoryBefore = assertCanonicalDirectory(
      directory,
      "PINNED_GOOGLE_CLOUD_CLI_TREE_UNREADABLE",
    );
    const entries = exactDirectoryEntries(
      directory,
      "PINNED_GOOGLE_CLOUD_CLI_TREE_UNREADABLE",
    );
    const entryNames = entries.map((entry) => entry.name);
    for (const entry of entries) {
      const target = join(directory, entry.name);
      const path = relative(canonicalRoot, target).replaceAll("\\", "/");
      if (
        path.length === 0
        || path === ".."
        || path.startsWith("../")
        || path.includes("\0")
        || path.includes("\n")
        || path.includes("\r")
      ) throw boundaryError("PINNED_GOOGLE_CLOUD_CLI_PATH_INVALID");
      const foldedPath = path.toLowerCase();
      if (caseFoldedPaths.has(foldedPath)) {
        throw boundaryError(
          "PINNED_GOOGLE_CLOUD_CLI_PATH_COLLISION",
        );
      }
      caseFoldedPaths.add(foldedPath);
      const metadata = readMetadata(
        target,
        "PINNED_GOOGLE_CLOUD_CLI_TREE_UNREADABLE",
      );
      if (
        entry.isDirectory()
        && metadata.isDirectory()
        && !metadata.isSymbolicLink()
      ) {
        visit(target);
      } else if (
        entry.isFile()
        && metadata.isFile()
        && !metadata.isSymbolicLink()
      ) {
        const bytes = readStableRegularFile(target, {
          code: "PINNED_GOOGLE_CLOUD_CLI_TREE_UNREADABLE",
        });
        files.push({
          path,
          bytes: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      } else {
        throw boundaryError(
          "PINNED_GOOGLE_CLOUD_CLI_SPECIAL_ENTRY_FORBIDDEN",
        );
      }
    }
    const entriesAfter = exactDirectoryEntries(
      directory,
      "PINNED_GOOGLE_CLOUD_CLI_TREE_UNREADABLE",
    ).map((entry) => entry.name);
    const directoryAfter = assertCanonicalDirectory(
      directory,
      "PINNED_GOOGLE_CLOUD_CLI_TREE_UNREADABLE",
    );
    if (
      JSON.stringify(entriesAfter) !== JSON.stringify(entryNames)
      || metadataFingerprint(directoryAfter)
        !== metadataFingerprint(directoryBefore)
    ) {
      throw boundaryError(
        "PINNED_GOOGLE_CLOUD_CLI_TREE_CHANGED_DURING_READ",
      );
    }
  };
  visit(canonicalRoot);
  files.sort((left, right) => compareCodeUnits(left.path, right.path));
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const sha256 = createHash("sha256")
    .update(files.map((file) => (
      `${file.path}\0${file.bytes}\0${file.sha256}`
    )).join("\n"), "utf8")
    .digest("hex");
  return Object.freeze({
    fileCount: files.length,
    totalBytes,
    sha256,
  });
}

function assertPinnedGoogleCloudCliFile(path, bytes, sha256) {
  const value = readStableRegularFile(path, {
    code: "PINNED_GOOGLE_CLOUD_CLI_LAUNCH_FILE_INVALID",
    requireCanonicalPath: true,
  });
  if (
    value.byteLength !== bytes
    || createHash("sha256").update(value).digest("hex") !== sha256
  ) {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_LAUNCH_FILE_MISMATCH",
    );
  }
  return true;
}

function assertPinnedGoogleCloudCliLaunchEntries(cli) {
  assertCanonicalDirectory(
    cli.installRoot,
    "PINNED_GOOGLE_CLOUD_CLI_INSTALL_ROOT_INVALID",
  );
  for (const directory of [
    join(cli.installRoot, "lib"),
    join(cli.installRoot, "platform"),
    join(cli.installRoot, "platform", "bundledpython"),
  ]) {
    assertCanonicalDirectory(
      directory,
      "PINNED_GOOGLE_CLOUD_CLI_LAUNCH_DIRECTORY_INVALID",
    );
  }
  assertPinnedGoogleCloudCliFile(
    cli.bundledPythonPath,
    cli.bundledPythonBytes,
    cli.bundledPythonSha256,
  );
  assertPinnedGoogleCloudCliFile(
    cli.gcloudPythonPath,
    cli.gcloudPythonBytes,
    cli.gcloudPythonSha256,
  );
  return true;
}

export function inspectPinnedGoogleCloudCli() {
  if (
    approvedGoogleCloudCli.canonicalTreeFileCount === null
    || approvedGoogleCloudCli.canonicalTreeBytes === null
    || approvedGoogleCloudCli.canonicalTreeSha256 === null
  ) {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_INSTALL_AND_TREE_AUDIT_REQUIRED",
    );
  }
  const snapshot = canonicalGoogleCloudCliTreeSnapshot(
    approvedGoogleCloudCli.installRoot,
  );
  if (
    snapshot.fileCount
      !== approvedGoogleCloudCli.canonicalTreeFileCount
    || snapshot.totalBytes !== approvedGoogleCloudCli.canonicalTreeBytes
    || snapshot.sha256 !== approvedGoogleCloudCli.canonicalTreeSha256
  ) throw boundaryError("PINNED_GOOGLE_CLOUD_CLI_TREE_MISMATCH");
  assertPinnedGoogleCloudCliLaunchEntries(approvedGoogleCloudCli);
  return Object.freeze({
    ...approvedGoogleCloudCli,
    snapshot,
  });
}

function createGoogleCloudCliReattestingAdapter(inspect, invoke) {
  if (typeof inspect !== "function" || typeof invoke !== "function") {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_REATTESTATION_ADAPTER_INVALID",
    );
  }
  return (...args) => invoke(inspect(), ...args);
}

export function createGoogleCloudCliReattestingAdapterForTesting(
  inspect,
  invoke,
) {
  return createGoogleCloudCliReattestingAdapter(inspect, invoke);
}

function validateGoogleOAuthHelperResponse(value) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || !Object.isFrozen(value)
    || JSON.stringify(Object.keys(value).sort())
      !== JSON.stringify([...googleOAuthResponseKeys].sort())
    || typeof value.accessToken !== "string"
    || value.accessToken.length < 20
    || value.accessToken.length > 8192
    || /\s/u.test(value.accessToken)
    || value.approvedGoogleAccount !== approvedGoogleAccount
    || value.firebaseToolsVersion !== approvedFirebaseToolsVersion
    || value.tokenPrinted !== false
  ) {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_OAUTH_HELPER_RESPONSE_INVALID",
    );
  }
  return value.accessToken;
}

function validateGoogleCloudCliOptions(options, accessToken) {
  const allowedKeys = new Set([
    "cwd",
    "encoding",
    "maxBuffer",
    "stdio",
    "timeout",
    "windowsHide",
  ]);
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).some((key) => !allowedKeys.has(key))
    || (
      options.encoding !== undefined
      && options.encoding !== "utf8"
      && options.encoding !== "buffer"
    )
    || (
      options.windowsHide !== undefined
      && options.windowsHide !== true
    )
    || (
      options.maxBuffer !== undefined
      && (
        !Number.isSafeInteger(options.maxBuffer)
        || options.maxBuffer < 1
        || options.maxBuffer > googleCloudCliMaximumOutputBytes
      )
    )
    || (
      options.timeout !== undefined
      && (
        !Number.isSafeInteger(options.timeout)
        || options.timeout < 1
        || options.timeout > googleCloudCliMaximumExecutionMs
      )
    )
    || (
      options.stdio !== undefined
      && JSON.stringify(options.stdio)
        !== JSON.stringify(["ignore", "pipe", "pipe"])
    )
  ) throw boundaryError("PINNED_GOOGLE_CLOUD_CLI_OPTIONS_INVALID");
  const cwd = options.cwd ?? approvedProductionRepositoryRoot;
  if (
    typeof cwd !== "string"
    || cwd.length === 0
    || cwd.includes(accessToken)
    || resolve(cwd) !== cwd
    || cwd !== approvedProductionRepositoryRoot
  ) throw boundaryError("PINNED_GOOGLE_CLOUD_CLI_CWD_INVALID");
  assertCanonicalDirectory(
    cwd,
    "PINNED_GOOGLE_CLOUD_CLI_CWD_INVALID",
  );
  return cwd;
}

function commandTokenMatches(argument, expected) {
  return (
    argument === expected
    || (
      argument.length >= 3
      && expected.startsWith(argument)
    )
  );
}

function containsOrderedCommandSequence(args, sequence) {
  let sequenceIndex = 0;
  for (const argument of args) {
    if (
      commandTokenMatches(
        argument.toLowerCase(),
        sequence[sequenceIndex],
      )
    ) {
      sequenceIndex += 1;
      if (sequenceIndex === sequence.length) return true;
    }
  }
  return false;
}

function validateGoogleCloudCliArguments(args, accessToken) {
  if (
    !Array.isArray(args)
    || args.length < 1
    || args.length > 256
    || args.some(
      (argument) =>
        typeof argument !== "string"
        || argument.length === 0
        || argument.length > 8192
        || argument.includes("\0")
        || argument.includes("\r")
        || argument.includes("\n")
        || argument.includes(accessToken),
    )
    || args.reduce((total, argument) => total + argument.length, 0)
      > 64 * 1024
  ) throw boundaryError("PINNED_GOOGLE_CLOUD_CLI_ARGUMENTS_INVALID");
  const observedScopedFlags = new Map();
  const exactScopedFlags = new Map([
    ["--account", approvedGoogleAccount],
    ["--billing-project", approvedGoogleProjectId],
    ["--project", approvedGoogleProjectId],
    ["--quota-project", approvedGoogleProjectId],
    [
      "--impersonate-service-account",
      approvedDeployServiceAccount,
    ],
  ]);
  if (
    containsOrderedCommandSequence(
      args,
      ["auth", "print-access-token"],
    )
    || containsOrderedCommandSequence(
      args,
      ["auth", "application-default", "print-access-token"],
    )
  ) {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_ACCESS_TOKEN_OUTPUT_FORBIDDEN",
    );
  }
  if (
    containsOrderedCommandSequence(
      args,
      ["auth", "print-identity-token"],
    )
    || containsOrderedCommandSequence(
      args,
      ["auth", "application-default", "print-identity-token"],
    )
  ) {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_IDENTITY_TOKEN_OUTPUT_FORBIDDEN",
    );
  }
  if (
    containsOrderedCommandSequence(
      args,
      ["secrets", "versions", "access"],
    )
    || containsOrderedCommandSequence(
      args,
      ["iam", "service-accounts", "sign-blob"],
    )
    || containsOrderedCommandSequence(
      args,
      ["iam", "service-accounts", "sign-jwt"],
    )
  ) {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_CREDENTIAL_OUTPUT_FORBIDDEN",
    );
  }
  for (let index = 0; index < args.length; index += 1) {
    const originalArgument = args[index];
    const argument = originalArgument.toLowerCase();
    const nextArgument = args[index + 1]?.toLowerCase();
    const nestedArgument = args[index + 2]?.toLowerCase();
    for (const [flag, expected] of exactScopedFlags) {
      let observed;
      if (argument === flag) {
        if (args[index + 1] === undefined) {
          throw boundaryError(
            "PINNED_GOOGLE_CLOUD_CLI_SCOPE_FLAG_INVALID",
          );
        }
        observed = args[index + 1];
      } else if (argument.startsWith(`${flag}=`)) {
        observed = originalArgument.slice(flag.length + 1);
      } else if (argument.startsWith(flag)) {
        throw boundaryError(
          "PINNED_GOOGLE_CLOUD_CLI_SCOPE_FLAG_INVALID",
        );
      }
      if (observed !== undefined) {
        if (
          observed !== expected
          || (observedScopedFlags.get(flag) ?? 0) !== 0
        ) {
          throw boundaryError(
            "PINNED_GOOGLE_CLOUD_CLI_SCOPE_OVERRIDE_FORBIDDEN",
          );
        }
        observedScopedFlags.set(flag, 1);
      }
    }
    if (
      argument === "--log-http"
      || argument.startsWith("--log-http=")
      || argument.startsWith("--access-token-file")
      || argument.startsWith("--credential-file-override")
      || argument === "--flags-file"
      || argument.startsWith("--flags-file=")
      || argument === "--configuration"
      || argument.startsWith("--configuration=")
      || argument === "--verbosity=debug"
      || (
        argument === "--verbosity"
        && nextArgument === "debug"
      )
    ) {
      throw boundaryError(
        "PINNED_GOOGLE_CLOUD_CLI_CREDENTIAL_ARGUMENT_FORBIDDEN",
      );
    }
    if (
      argument === "config"
      || argument === "components"
      || argument === "init"
      || (
        argument === "auth"
        && (
          nextArgument === "login"
          || nextArgument === "revoke"
          || nextArgument === "activate-service-account"
          || nextArgument === "configure-docker"
          || (
            nextArgument === "application-default"
            && (
              nestedArgument === "login"
              || nestedArgument === "revoke"
            )
          )
        )
      )
    ) {
      throw boundaryError(
        "PINNED_GOOGLE_CLOUD_CLI_AUTH_OR_CONFIG_MUTATION_FORBIDDEN",
      );
    }
  }
  return true;
}

export function validateGoogleCloudCliArgumentsForTesting(args) {
  return validateGoogleCloudCliArguments(
    args,
    "test-only-boundary-access-token-value",
  );
}

function createOwnedGoogleCloudConfigDirectory() {
  assertCanonicalDirectory(
    approvedWindowsTemp,
    "PINNED_GOOGLE_CLOUD_CLI_TEMP_ROOT_INVALID",
  );
  let path;
  try {
    path = mkdtempSync(
      join(approvedWindowsTemp, googleCloudConfigDirectoryPrefix),
    );
  } catch {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_CONFIG_CREATE_FAILED",
    );
  }
  const metadata = assertCanonicalDirectory(
    path,
    "PINNED_GOOGLE_CLOUD_CLI_CONFIG_DIRECTORY_INVALID",
  );
  if (
    !sameCanonicalWindowsPath(dirname(path), approvedWindowsTemp)
    || !new RegExp(
      `^${googleCloudConfigDirectoryPrefix}[A-Za-z0-9]{6}$`,
      "u",
    ).test(basename(path))
  ) {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_CONFIG_DIRECTORY_INVALID",
    );
  }
  return Object.freeze({
    path,
    dev: metadata.dev,
    ino: metadata.ino,
  });
}

function removeOwnedGoogleCloudConfigDirectory(owned) {
  let metadata;
  try {
    metadata = assertCanonicalDirectory(
      owned.path,
      "PINNED_GOOGLE_CLOUD_CLI_CONFIG_CLEANUP_FAILED",
    );
  } catch {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_CONFIG_CLEANUP_FAILED",
    );
  }
  if (
    metadata.dev !== owned.dev
    || metadata.ino !== owned.ino
    || !sameCanonicalWindowsPath(dirname(owned.path), approvedWindowsTemp)
    || !new RegExp(
      `^${googleCloudConfigDirectoryPrefix}[A-Za-z0-9]{6}$`,
      "u",
    ).test(basename(owned.path))
  ) {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_CONFIG_CLEANUP_FAILED",
    );
  }
  try {
    rmSync(owned.path, {
      force: false,
      maxRetries: 3,
      recursive: true,
      retryDelay: 50,
    });
  } catch {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_CONFIG_CLEANUP_FAILED",
    );
  }
  if (existsSync(owned.path)) {
    throw boundaryError(
      "PINNED_GOOGLE_CLOUD_CLI_CONFIG_CLEANUP_FAILED",
    );
  }
}

function resultIncludesAccessToken(result, accessToken) {
  const bytes = Buffer.isBuffer(result)
    ? result
    : Buffer.from(String(result), "utf8");
  return bytes.includes(Buffer.from(accessToken, "utf8"));
}

export function createPinnedGoogleCloudCliExecFile(
  input,
) {
  if (
    input === null
    || typeof input !== "object"
    || Array.isArray(input)
    || JSON.stringify(Object.keys(input).sort())
      !== JSON.stringify(["environment", "googleOAuth"])
  ) throw boundaryError("PINNED_GOOGLE_CLOUD_CLI_INPUT_INVALID");
  const { environment, googleOAuth } = input;
  assertNoDangerousExternalEnvironment(environment);
  const accessToken = validateGoogleOAuthHelperResponse(googleOAuth);
  const baseChildEnvironment = sanitizedExternalProcessEnvironment(
    environment,
    { pathEntries: [] },
  );
  const adapter = createGoogleCloudCliReattestingAdapter(
    inspectPinnedGoogleCloudCli,
    (cli, file, args, options = {}) => {
      if (file !== "gcloud") {
        throw boundaryError("PINNED_GOOGLE_CLOUD_CLI_CALL_INVALID");
      }
      validateGoogleCloudCliArguments(args, accessToken);
      const cwd = validateGoogleCloudCliOptions(
        options,
        accessToken,
      );
      const ownedConfig = createOwnedGoogleCloudConfigDirectory();
      let result;
      let failureCode;
      try {
        result = execFileSync(
          cli.bundledPythonPath,
          [...cli.pythonFlags, cli.gcloudPythonPath, ...args],
          {
            cwd,
            encoding: options.encoding,
            env: {
              ...baseChildEnvironment,
              CLOUDSDK_AUTH_ACCESS_TOKEN: accessToken,
              CLOUDSDK_CONFIG: ownedConfig.path,
              CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK: "1",
              CLOUDSDK_CORE_ACCOUNT: approvedGoogleAccount,
              CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
              CLOUDSDK_CORE_DISABLE_USAGE_REPORTING: "true",
              CLOUDSDK_METRICS_ENVIRONMENT: "ludys-wp13-12b",
              CLOUDSDK_METRICS_ENVIRONMENT_VERSION: "1",
            },
            killSignal: "SIGKILL",
            maxBuffer:
              options.maxBuffer ?? googleCloudCliMaximumOutputBytes,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
            timeout:
              options.timeout ?? googleCloudCliMaximumExecutionMs,
            windowsHide: true,
          },
        );
        if (resultIncludesAccessToken(result, accessToken)) {
          failureCode =
            "PINNED_GOOGLE_CLOUD_CLI_ACCESS_TOKEN_OUTPUT_FORBIDDEN";
        }
      } catch {
        failureCode ??= "PINNED_GOOGLE_CLOUD_CLI_EXECUTION_FAILED";
      } finally {
        try {
          removeOwnedGoogleCloudConfigDirectory(ownedConfig);
        } catch {
          failureCode =
            "PINNED_GOOGLE_CLOUD_CLI_CONFIG_CLEANUP_FAILED";
        }
      }
      if (failureCode !== undefined) throw boundaryError(failureCode);
      return result;
    },
  );
  return Object.freeze(adapter);
}
