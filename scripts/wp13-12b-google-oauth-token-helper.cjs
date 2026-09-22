"use strict";

const { createHash } = require("node:crypto");
const { fork } = require("node:child_process");
const {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} = require("node:fs");
const { dirname, join, relative } = require("node:path");

const APPROVED_GOOGLE_ACCOUNT = "tryakim@gmail.com";
const PINNED_FIREBASE_TOOLS_ROOT =
  "C:\\Users\\tryak\\AppData\\Roaming\\npm\\node_modules\\firebase-tools";
const PINNED_FIREBASE_TOOLS_VERSION = "15.22.4";
const PINNED_FIREBASE_TOOLS_TREE = Object.freeze({
  algorithm:
    "SORTED_RELATIVE_PATH_CODE_UNIT_NUL_SIZE_NUL_SHA256_LF_V1",
  fileCount: 19_417,
  totalBytes: 189_433_946,
  sha256:
    "fdbf5c3e8c960490a3bec6097989127616f33d396115a6b5f911372722fbe7fa",
});
const PINNED_FIREBASE_TOOLS_TREE_KEYS = Object.freeze([
  "algorithm",
  "fileCount",
  "sha256",
  "totalBytes",
]);
const FIREBASE_TOOLS_TREE_ALGORITHM =
  "SORTED_RELATIVE_PATH_CODE_UNIT_NUL_SIZE_NUL_SHA256_LF_V1";
const GOOGLE_OAUTH_CHILD_TIMEOUT_MS = 30_000;
const FORBIDDEN_GOOGLE_OAUTH_ENVIRONMENT_KEYS = new Set([
  "ALL_PROXY",
  "CLOUDSDK_AUTH_ACCESS_TOKEN",
  "CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE",
  "CLOUDSDK_CONFIG",
  "CLOUDSDK_CORE_ACCOUNT",
  "CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE",
  "CLOUDSDK_CORE_PROJECT",
  "CURL_CA_BUNDLE",
  "FIREBASE_TOKEN",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_OAUTH_ACCESS_TOKEN",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "LD_PRELOAD",
  "LUDYS_FIREBASE_CLI_LIB",
  "NODE_EXTRA_CA_CERTS",
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_TLS_REJECT_UNAUTHORIZED",
  "NODE_USE_ENV_PROXY",
  "NO_PROXY",
  "PYTHONHOME",
  "PYTHONPATH",
  "PYTHONSTARTUP",
  "REQUESTS_CA_BUNDLE",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
]);
const GOOGLE_OAUTH_CHILD_ENVIRONMENT_ALLOWLIST = new Set([
  "APPDATA",
  "HOMEDRIVE",
  "HOMEPATH",
  "LOCALAPPDATA",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "WINDIR",
]);

function exactRegularCanonicalFile(path) {
  const observed = lstatSync(path);
  return (
    observed.isFile()
    && !observed.isSymbolicLink()
    && observed.nlink === 1
    && realpathSync(path).toLowerCase() === path.toLowerCase()
  );
}

function assertFirebaseToolsTreeEntryMetadata(metadata) {
  if (
    metadata === null
    || typeof metadata !== "object"
    || typeof metadata.isSymbolicLink !== "function"
    || typeof metadata.isDirectory !== "function"
    || typeof metadata.isFile !== "function"
  ) {
    throw new Error("PINNED_FIREBASE_TOOLS_ENTRY_METADATA_REQUIRED");
  }
  if (
    metadata.isSymbolicLink()
    || (!metadata.isDirectory() && !metadata.isFile())
  ) {
    throw new Error("PINNED_FIREBASE_TOOLS_SPECIAL_ENTRY_FORBIDDEN");
  }
  if (
    metadata.isFile()
    && (
      !Number.isSafeInteger(metadata.nlink)
      || metadata.nlink !== 1
    )
  ) {
    throw new Error("PINNED_FIREBASE_TOOLS_HARDLINK_FORBIDDEN");
  }
  return true;
}

function snapshotFirebaseToolsTree(root) {
  if (typeof root !== "string" || root.length === 0) {
    throw new Error("FIREBASE_TOOLS_TREE_ROOT_REQUIRED");
  }
  const canonicalRoot = realpathSync(root);
  const rootStat = lstatSync(root);
  if (
    !rootStat.isDirectory()
    || rootStat.isSymbolicLink()
    || canonicalRoot.toLowerCase() !== root.toLowerCase()
  ) {
    throw new Error("PINNED_FIREBASE_TOOLS_ROOT_REQUIRED");
  }
  const files = [];
  const visit = (directory) => {
    for (
      const entry of readdirSync(
        directory,
        { withFileTypes: true },
      )
    ) {
      const target = join(directory, entry.name);
      const metadata = lstatSync(target);
      assertFirebaseToolsTreeEntryMetadata(metadata);
      if (metadata.isDirectory()) {
        visit(target);
        continue;
      }
      const bytes = readFileSync(target);
      files.push({
        path: relative(root, target)
          .replaceAll("\\", "/"),
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  };
  visit(root);
  files.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const totalBytes = files.reduce(
    (total, file) => total + file.bytes,
    0,
  );
  const sha256 = createHash("sha256")
    .update(
      files.map(
        (file) =>
          `${file.path}\0${file.bytes}\0${file.sha256}`,
      ).join("\n"),
      "utf8",
    )
    .digest("hex");
  return Object.freeze({
    algorithm: FIREBASE_TOOLS_TREE_ALGORITHM,
    fileCount: files.length,
    totalBytes,
    sha256,
  });
}

function verifyFirebaseToolsTree(root, expected) {
  if (
    expected === null
    || typeof expected !== "object"
    || Array.isArray(expected)
    || JSON.stringify(Object.keys(expected).sort())
      !== JSON.stringify(PINNED_FIREBASE_TOOLS_TREE_KEYS)
    || expected.algorithm !== FIREBASE_TOOLS_TREE_ALGORITHM
    || !Number.isSafeInteger(expected.fileCount)
    || expected.fileCount < 1
    || !Number.isSafeInteger(expected.totalBytes)
    || expected.totalBytes < 1
    || !/^[a-f0-9]{64}$/u.test(expected.sha256 ?? "")
  ) {
    throw new Error("PINNED_FIREBASE_TOOLS_TREE_EXPECTATION_INVALID");
  }
  const actual = snapshotFirebaseToolsTree(root);
  if (
    actual.fileCount !== expected.fileCount
    || actual.totalBytes !== expected.totalBytes
    || actual.sha256 !== expected.sha256
  ) {
    throw new Error("PINNED_FIREBASE_TOOLS_TREE_INTEGRITY_MISMATCH");
  }
  return actual;
}

function verifyPinnedFirebaseToolsTree() {
  return verifyFirebaseToolsTree(
    PINNED_FIREBASE_TOOLS_ROOT,
    PINNED_FIREBASE_TOOLS_TREE,
  );
}

function assertGoogleOAuthProductionEnvironment(
  environment = process.env,
  execArgv = process.execArgv,
) {
  if (
    environment === null
    || typeof environment !== "object"
    || Array.isArray(environment)
    || !Array.isArray(execArgv)
    || execArgv.length !== 0
  ) {
    throw new Error("GOOGLE_OAUTH_PRODUCTION_ENVIRONMENT_FORBIDDEN");
  }
  for (const [key, value] of Object.entries(environment)) {
    if (
      FORBIDDEN_GOOGLE_OAUTH_ENVIRONMENT_KEYS.has(
        String(key).toUpperCase(),
      )
      && typeof value === "string"
      && value.length > 0
    ) {
      throw new Error("GOOGLE_OAUTH_PRODUCTION_ENVIRONMENT_FORBIDDEN");
    }
  }
  return true;
}

function cleanGoogleOAuthChildEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([key, value]) =>
        GOOGLE_OAUTH_CHILD_ENVIRONMENT_ALLOWLIST.has(
          String(key).toUpperCase(),
        )
        && typeof value === "string"
        && value.length > 0,
    ),
  );
}

function validateGoogleOAuthChildResponse(value) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort())
      !== JSON.stringify([
        "accessToken",
        "approvedGoogleAccount",
        "firebaseToolsVersion",
        "tokenPrinted",
      ])
    || typeof value.accessToken !== "string"
    || value.accessToken.length < 20
    || value.accessToken.length > 8192
    || /\s/u.test(value.accessToken)
    || value.approvedGoogleAccount !== APPROVED_GOOGLE_ACCOUNT
    || value.firebaseToolsVersion !== PINNED_FIREBASE_TOOLS_VERSION
    || value.tokenPrinted !== false
  ) {
    throw new Error("PINNED_GOOGLE_OAUTH_CHILD_RESPONSE_INVALID");
  }
  return Object.freeze({
    accessToken: value.accessToken,
    approvedGoogleAccount: value.approvedGoogleAccount,
    firebaseToolsVersion: value.firebaseToolsVersion,
    tokenPrinted: false,
  });
}

async function acquirePinnedGoogleOAuthAccessToken() {
  assertGoogleOAuthProductionEnvironment();
  if (!exactRegularCanonicalFile(__filename)) {
    throw new Error("CANONICAL_GOOGLE_OAUTH_HELPER_REQUIRED");
  }
  const repositoryRoot = realpathSync(join(dirname(__filename), ".."));
  const repositoryRootStat = lstatSync(repositoryRoot);
  if (
    !repositoryRootStat.isDirectory()
    || repositoryRootStat.isSymbolicLink()
  ) {
    throw new Error("CANONICAL_GOOGLE_OAUTH_REPOSITORY_ROOT_REQUIRED");
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let messageObserved = false;
    const child = fork(__filename, [], {
      cwd: repositoryRoot,
      env: cleanGoogleOAuthChildEnvironment(process.env),
      execArgv: [],
      serialization: "json",
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
    });
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (child.connected) child.disconnect();
      if (error) {
        child.kill();
        reject(error);
      } else {
        resolve(value);
      }
    };
    const timeout = setTimeout(
      () => finish(new Error("PINNED_GOOGLE_OAUTH_CHILD_TIMEOUT")),
      GOOGLE_OAUTH_CHILD_TIMEOUT_MS,
    );
    timeout.unref();
    child.once("error", () => {
      finish(new Error("PINNED_GOOGLE_OAUTH_CHILD_FAILED"));
    });
    child.on("message", (value) => {
      if (messageObserved) {
        finish(new Error("PINNED_GOOGLE_OAUTH_CHILD_RESPONSE_INVALID"));
        return;
      }
      messageObserved = true;
      try {
        finish(undefined, validateGoogleOAuthChildResponse(value));
      } catch {
        finish(new Error("PINNED_GOOGLE_OAUTH_CHILD_RESPONSE_INVALID"));
      }
    });
    child.once("exit", (code, signal) => {
      if (
        !settled
        && (
          code !== 0
          || signal !== null
          || !messageObserved
        )
      ) {
        finish(new Error("PINNED_GOOGLE_OAUTH_CHILD_FAILED"));
      }
    });
  });
}

async function main() {
  assertGoogleOAuthProductionEnvironment();
  if (!exactRegularCanonicalFile(__filename)) {
    throw new Error("CANONICAL_GOOGLE_OAUTH_HELPER_REQUIRED");
  }
  if (typeof process.send !== "function" || !process.connected) {
    process.exitCode = 1;
    return;
  }
  const packagePath = join(
    PINNED_FIREBASE_TOOLS_ROOT,
    "package.json",
  );
  const authPath = join(
    PINNED_FIREBASE_TOOLS_ROOT,
    "lib",
    "auth.js",
  );
  const apiPath = join(
    PINNED_FIREBASE_TOOLS_ROOT,
    "lib",
    "apiv2.js",
  );
  verifyPinnedFirebaseToolsTree();
  if (
    !exactRegularCanonicalFile(packagePath)
    || !exactRegularCanonicalFile(authPath)
    || !exactRegularCanonicalFile(apiPath)
  ) {
    throw new Error("PINNED_FIREBASE_TOOLS_FILES_REQUIRED");
  }
  const packageMetadata = JSON.parse(
    readFileSync(packagePath, "utf8"),
  );
  if (
    packageMetadata?.name !== "firebase-tools"
    || packageMetadata?.version !== PINNED_FIREBASE_TOOLS_VERSION
  ) {
    throw new Error("PINNED_FIREBASE_TOOLS_VERSION_REQUIRED");
  }
  const auth = require(authPath);
  const api = require(apiPath);
  const account = auth.getGlobalDefaultAccount();
  if (account?.user?.email !== APPROVED_GOOGLE_ACCOUNT) {
    throw new Error("APPROVED_GOOGLE_ACCOUNT_NOT_ACTIVE");
  }
  auth.setActiveAccount({}, account);
  let accessToken = await api.getAccessToken();
  if (
    typeof accessToken !== "string"
    || accessToken.length < 20
    || accessToken.length > 8192
    || /\s/u.test(accessToken)
  ) {
    throw new Error("PROVIDER_ACCESS_TOKEN_UNAVAILABLE");
  }
  process.send(
    {
      accessToken,
      approvedGoogleAccount: APPROVED_GOOGLE_ACCOUNT,
      firebaseToolsVersion: PINNED_FIREBASE_TOOLS_VERSION,
      tokenPrinted: false,
    },
    undefined,
    undefined,
    () => {
      accessToken = undefined;
      process.disconnect();
    },
  );
}

if (require.main === module) {
  main().catch(() => {
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  });
}

module.exports = Object.freeze({
  FIREBASE_TOOLS_TREE_ALGORITHM,
  PINNED_FIREBASE_TOOLS_TREE,
  acquirePinnedGoogleOAuthAccessToken,
  assertFirebaseToolsTreeEntryMetadata,
  assertGoogleOAuthProductionEnvironment,
  snapshotFirebaseToolsTree,
  verifyFirebaseToolsTree,
});
