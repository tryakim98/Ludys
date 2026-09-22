import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  readFile,
  realpath,
  stat,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

export const approvedVercelCli = Object.freeze({
  version: "58.0.0",
  npmIntegrity:
    "sha512-Y9sPxy/oR5o8KcVLjxxJ1bsUvSKyigEOb26jBn9LDNgR3VW8iAVb0qm+824WZ5viqVuGMzxsj4wJedVH4ih4Mg==",
  tarball:
    "https://registry.npmjs.org/vercel/-/vercel-58.0.0.tgz",
  canonicalTreeSha256:
    "4d97f7ef1a2631946dd5344d29db7ad9b931782e24bd478ea2a4241e2a0f57fc",
  canonicalTreeFileCount: 6731,
  packageJsonSha256:
    "c9e5cc5fd2f425b91679588dde3cd402f1845585dbd7bf6f243e7e9988fe2bb9",
  packageLockSha256:
    "fa85de4cf0b4d70dd29cdfb3b2a857ce04096297cdca37ea23d956e86a189c94",
  canonicalTreeAlgorithm:
    "ASCII_CODE_UNIT_SORTED_RELATIVE_PATH_NUL_SIZE_NUL_SHA256_LF_V2",
  forbiddenInstallLogPaths: Object.freeze([
    "npm-install.stderr.log",
    "npm-install.stdout.log",
  ]),
});
export const approvedVercelNodeVersion = "24.x";
export const approvedVercelCliModuleRoot =
  "C:\\Users\\tryak\\AppData\\Local\\LUDYS\\toolchains\\"
  + "vercel-cli-58.0.0\\node_modules";
export const approvedVercelCliIntegritySha256 =
  createHash("sha256")
    .update(approvedVercelCli.npmIntegrity, "utf8")
    .digest("hex");

const forbiddenInstallLogs =
  new Set(approvedVercelCli.forbiddenInstallLogPaths);

function toolchainError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
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

export function compareVercelToolchainPaths(left, right) {
  if (
    typeof left !== "string"
    || typeof right !== "string"
    || !/^[\x20-\x7e]+$/u.test(left)
    || !/^[\x20-\x7e]+$/u.test(right)
  ) throw toolchainError("PINNED_VERCEL_CLI_NON_ASCII_PATH_FORBIDDEN");
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalVercelToolchainTreeSnapshot(toolchainRoot) {
  const files = [];
  const visit = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      throw toolchainError("PINNED_VERCEL_CLI_TREE_UNREADABLE");
    }
    for (const entry of entries) {
      const target = join(directory, entry.name);
      const path = relative(toolchainRoot, target).replaceAll("\\", "/");
      if (forbiddenInstallLogs.has(path)) {
        throw toolchainError(
          "PINNED_VERCEL_CLI_INSTALL_LOG_FORBIDDEN",
        );
      }
      compareVercelToolchainPaths(path, path);
      let metadata;
      try {
        metadata = lstatSync(target);
      } catch {
        throw toolchainError("PINNED_VERCEL_CLI_TREE_UNREADABLE");
      }
      if (metadata.isDirectory() && !metadata.isSymbolicLink()) {
        visit(target);
        continue;
      }
      if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw toolchainError("PINNED_VERCEL_CLI_SPECIAL_ENTRY_FORBIDDEN");
      }
      const bytes = readFileSync(target);
      files.push(Object.freeze({
        path,
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }));
    }
  };
  visit(toolchainRoot);
  files.sort((left, right) => (
    compareVercelToolchainPaths(left.path, right.path)
  ));
  const sha256 = createHash("sha256")
    .update(files.map((file) => (
      `${file.path}\0${file.bytes}\0${file.sha256}`
    )).join("\n"), "utf8")
    .digest("hex");
  return Object.freeze({ fileCount: files.length, sha256 });
}

export function verifyPinnedVercelCliSnapshot(cli) {
  if (
    cli?.version !== approvedVercelCli.version
    || cli?.npmIntegrity !== approvedVercelCli.npmIntegrity
    || cli?.canonicalTreeAlgorithm
      !== approvedVercelCli.canonicalTreeAlgorithm
    || typeof cli?.toolchainRoot !== "string"
  ) throw toolchainError("PINNED_VERCEL_CLI_REQUIRED");
  const snapshot =
    canonicalVercelToolchainTreeSnapshot(cli.toolchainRoot);
  if (
    snapshot.fileCount !== approvedVercelCli.canonicalTreeFileCount
    || snapshot.sha256 !== approvedVercelCli.canonicalTreeSha256
  ) throw toolchainError("PINNED_VERCEL_CLI_TREE_INTEGRITY_MISMATCH");
  return snapshot;
}

export function verifyVercelToolchainTreeForTesting(
  toolchainRoot,
  expected,
) {
  const snapshot =
    canonicalVercelToolchainTreeSnapshot(resolve(toolchainRoot));
  if (
    !Number.isSafeInteger(expected?.fileCount)
    || typeof expected?.sha256 !== "string"
    || snapshot.fileCount !== expected.fileCount
    || snapshot.sha256 !== expected.sha256
  ) throw toolchainError("PINNED_VERCEL_CLI_TREE_INTEGRITY_MISMATCH");
  return snapshot;
}

export async function inspectPinnedVercelCli(moduleRoot) {
  if (
    typeof moduleRoot !== "string"
    || moduleRoot.length === 0
    || resolve(moduleRoot) !== moduleRoot
  ) throw toolchainError("VERCEL_MODULE_ROOT_REQUIRED");
  let canonicalModuleRoot;
  let packagePath;
  let entryPath;
  let lockPath;
  let rootPackagePath;
  try {
    canonicalModuleRoot = await realpath(moduleRoot);
    packagePath = await realpath(join(
      canonicalModuleRoot,
      "vercel",
      "package.json",
    ));
    lockPath = await realpath(join(
      dirname(canonicalModuleRoot),
      "package-lock.json",
    ));
    rootPackagePath = await realpath(join(
      dirname(canonicalModuleRoot),
      "package.json",
    ));
  } catch {
    throw toolchainError("PINNED_VERCEL_CLI_REQUIRED");
  }
  const packageRoot = dirname(packagePath);
  const toolchainRoot = dirname(canonicalModuleRoot);
  if (
    dirname(packageRoot) !== canonicalModuleRoot
    || !pathInside(canonicalModuleRoot, packagePath)
    || dirname(lockPath) !== toolchainRoot
    || dirname(rootPackagePath) !== toolchainRoot
  ) throw toolchainError("PINNED_VERCEL_CLI_PATH_CONTAINMENT_REQUIRED");
  let manifest;
  let lock;
  let packageBytes;
  let rootPackageBytes;
  let lockBytes;
  try {
    packageBytes = await readFile(packagePath);
    rootPackageBytes = await readFile(rootPackagePath);
    lockBytes = await readFile(lockPath);
    manifest = JSON.parse(packageBytes);
    lock = JSON.parse(lockBytes);
  } catch {
    throw toolchainError("PINNED_VERCEL_CLI_MANIFEST_INVALID");
  }
  const locked = lock?.packages?.["node_modules/vercel"];
  if (
    manifest?.name !== "vercel"
    || manifest?.version !== approvedVercelCli.version
    || locked?.version !== approvedVercelCli.version
    || locked?.integrity !== approvedVercelCli.npmIntegrity
    || locked?.resolved !== approvedVercelCli.tarball
    || createHash("sha256").update(rootPackageBytes).digest("hex")
      !== approvedVercelCli.packageJsonSha256
    || createHash("sha256").update(lockBytes).digest("hex")
      !== approvedVercelCli.packageLockSha256
  ) throw toolchainError("PINNED_VERCEL_CLI_INTEGRITY_MISMATCH");
  const bin = typeof manifest.bin === "string"
    ? manifest.bin
    : manifest.bin?.vercel;
  if (
    typeof bin !== "string"
    || bin.length === 0
    || resolve(packageRoot, bin) === packageRoot
  ) throw toolchainError("PINNED_VERCEL_CLI_ENTRY_MISSING");
  try {
    entryPath = await realpath(resolve(packageRoot, bin));
    const entryStat = await stat(entryPath);
    if (
      !entryStat.isFile()
      || !pathInside(packageRoot, entryPath)
    ) throw new Error("invalid entry");
  } catch {
    throw toolchainError("PINNED_VERCEL_CLI_ENTRY_MISSING");
  }
  const tree = canonicalVercelToolchainTreeSnapshot(toolchainRoot);
  if (
    tree.fileCount !== approvedVercelCli.canonicalTreeFileCount
    || tree.sha256 !== approvedVercelCli.canonicalTreeSha256
  ) throw toolchainError("PINNED_VERCEL_CLI_TREE_INTEGRITY_MISMATCH");
  return Object.freeze({
    version: approvedVercelCli.version,
    npmIntegrity: approvedVercelCli.npmIntegrity,
    npmIntegritySha256: approvedVercelCliIntegritySha256,
    packageManifestSha256: createHash("sha256")
      .update(packageBytes)
      .digest("hex"),
    entrySha256: createHash("sha256")
      .update(await readFile(entryPath))
      .digest("hex"),
    toolchainRoot,
    canonicalTreeAlgorithm: approvedVercelCli.canonicalTreeAlgorithm,
    canonicalTreeFileCount: tree.fileCount,
    canonicalTreeSha256: tree.sha256,
    forbiddenInstallLogsAbsent: true,
    moduleRoot: canonicalModuleRoot,
    packagePath,
    entryPath,
    lockPath,
  });
}
