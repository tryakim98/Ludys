import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import {
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

const GIT_RUNTIME_ROOT = String.raw`C:\Program Files\Git`;
const GIT_EXECUTABLE_PATH = join(GIT_RUNTIME_ROOT, "cmd", "git.exe");
const GIT_BIN_DIRECTORY = join(GIT_RUNTIME_ROOT, "mingw64", "bin");
const GIT_RUNTIME_TREE_ALGORITHM =
  "ASCII_CODE_UNIT_SORTED_RELATIVE_PATH_NUL_SIZE_NUL_SHA256_LF_V1";
const GIT_RUNTIME_TREE_SHA256 =
  "d73b685e0f95c71c04c844bc67a70c5f32def551be1d9d1ff7d9b8a3963cae60";
const GIT_RUNTIME_TREE_FILE_COUNT = 157;
const GIT_RUNTIME_TREE_TOTAL_BYTES = 96_933_069;
const GIT_VERSION = "2.55.0.windows.2";
const GIT_VERSION_OUTPUT = `git version ${GIT_VERSION}`;
const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const ASCII_PATH = /^[\x20-\x7e]+$/u;
const MAX_ARGUMENT_COUNT = 512;
const MAX_ARGUMENT_LENGTH = 32_000;
const MAX_BUFFER_LIMIT = 64 * 1024 * 1024;
const GIT_VERSION_TIMEOUT_MS = 10_000;
const GIT_COMMAND_TIMEOUT_MS = 30_000;
const ALLOWED_OPTION_KEYS = new Set([
  "cwd",
  "encoding",
  "maxBuffer",
  "stdio",
  "timeout",
  "windowsHide",
]);

export const approvedGitRuntime = Object.freeze({
  version: GIT_VERSION,
  executablePath: GIT_EXECUTABLE_PATH,
  runtimeRoot: GIT_RUNTIME_ROOT,
  binDirectory: GIT_BIN_DIRECTORY,
  canonicalTreeAlgorithm: GIT_RUNTIME_TREE_ALGORITHM,
  canonicalTreeFileCount: GIT_RUNTIME_TREE_FILE_COUNT,
  canonicalTreeTotalBytes: GIT_RUNTIME_TREE_TOTAL_BYTES,
  canonicalTreeSha256: GIT_RUNTIME_TREE_SHA256,
  versionReadTimeoutMs: GIT_VERSION_TIMEOUT_MS,
  commandTimeoutMs: GIT_COMMAND_TIMEOUT_MS,
});

function gitToolchainError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function sameCanonicalPath(left, right) {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function normalizedForwardPath(path) {
  return path.replaceAll("\\", "/");
}

export function compareGitRuntimePaths(left, right) {
  if (
    typeof left !== "string"
    || typeof right !== "string"
    || !ASCII_PATH.test(left)
    || !ASCII_PATH.test(right)
  ) throw gitToolchainError("PINNED_GIT_NON_ASCII_PATH_FORBIDDEN");
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertCanonicalDirectory(path) {
  let metadata;
  let canonical;
  try {
    metadata = lstatSync(path);
    canonical = realpathSync.native(path);
  } catch {
    throw gitToolchainError("PINNED_GIT_RUNTIME_TREE_UNREADABLE");
  }
  if (
    !metadata.isDirectory()
    || metadata.isSymbolicLink()
    || !sameCanonicalPath(canonical, path)
  ) throw gitToolchainError("PINNED_GIT_RUNTIME_SPECIAL_ENTRY_FORBIDDEN");
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    size: metadata.size,
    mtimeMs: metadata.mtimeMs,
  });
}

function sameStableMetadata(left, right) {
  return (
    left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
  );
}

function readStableRegularFile(path) {
  let before;
  let canonical;
  let descriptor;
  try {
    before = lstatSync(path);
    canonical = realpathSync.native(path);
  } catch {
    throw gitToolchainError("PINNED_GIT_RUNTIME_TREE_UNREADABLE");
  }
  if (
    !before.isFile()
    || before.isSymbolicLink()
    || !sameCanonicalPath(canonical, path)
  ) throw gitToolchainError("PINNED_GIT_RUNTIME_SPECIAL_ENTRY_FORBIDDEN");
  try {
    descriptor = openSync(path, "r");
    const openedBefore = fstatSync(descriptor);
    if (
      !openedBefore.isFile()
      || !sameStableMetadata(before, openedBefore)
    ) throw gitToolchainError("PINNED_GIT_RUNTIME_CHANGED_DURING_READ");
    const bytes = readFileSync(descriptor);
    const openedAfter = fstatSync(descriptor);
    const after = lstatSync(path);
    if (
      !after.isFile()
      || after.isSymbolicLink()
      || !sameStableMetadata(openedBefore, openedAfter)
      || !sameStableMetadata(openedAfter, after)
      || bytes.byteLength !== openedAfter.size
      || !sameCanonicalPath(realpathSync.native(path), path)
    ) throw gitToolchainError("PINNED_GIT_RUNTIME_CHANGED_DURING_READ");
    return bytes;
  } catch (error) {
    if (error?.code?.startsWith?.("PINNED_GIT_")) throw error;
    throw gitToolchainError("PINNED_GIT_RUNTIME_TREE_UNREADABLE");
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The integrity decision has already been made from the read.
      }
    }
  }
}

function directBinEntryNames(binDirectory) {
  let entries;
  try {
    entries = readdirSync(binDirectory, { withFileTypes: true });
  } catch {
    throw gitToolchainError("PINNED_GIT_RUNTIME_TREE_UNREADABLE");
  }
  const names = [];
  for (const entry of entries) {
    if (
      !entry.isFile()
      || entry.isDirectory()
      || entry.isSymbolicLink()
      || !ASCII_PATH.test(entry.name)
      || entry.name.includes("/")
      || entry.name.includes("\\")
    ) throw gitToolchainError("PINNED_GIT_RUNTIME_SPECIAL_ENTRY_FORBIDDEN");
    names.push(entry.name);
  }
  return names.sort(compareGitRuntimePaths);
}

function exactArray(left, right) {
  return (
    left.length === right.length
    && left.every((value, index) => value === right[index])
  );
}

function canonicalGitRuntimeTreeSnapshot(runtimeRoot) {
  const root = resolve(runtimeRoot);
  if (
    typeof runtimeRoot !== "string"
    || runtimeRoot.length === 0
    || root !== runtimeRoot
  ) throw gitToolchainError("PINNED_GIT_RUNTIME_ROOT_REQUIRED");
  const cmdDirectory = join(root, "cmd");
  const executablePath = join(cmdDirectory, "git.exe");
  const mingwDirectory = join(root, "mingw64");
  const binDirectory = join(mingwDirectory, "bin");
  const directories = [
    root,
    cmdDirectory,
    mingwDirectory,
    binDirectory,
  ];
  const directoryMetadata =
    directories.map((path) => assertCanonicalDirectory(path));
  const initialBinNames = directBinEntryNames(binDirectory);
  const paths = [
    "cmd/git.exe",
    ...initialBinNames.map((name) => `mingw64/bin/${name}`),
  ];
  if (new Set(paths).size !== paths.length) {
    throw gitToolchainError("PINNED_GIT_RUNTIME_PATH_COLLISION");
  }
  const files = paths.map((path) => {
    compareGitRuntimePaths(path, path);
    const target = join(root, ...path.split("/"));
    const fromRoot = relative(root, target);
    if (
      fromRoot === ""
      || fromRoot === ".."
      || fromRoot.startsWith(`..${sep}`)
      || isAbsolute(fromRoot)
    ) throw gitToolchainError("PINNED_GIT_RUNTIME_PATH_CONTAINMENT_REQUIRED");
    const bytes = readStableRegularFile(target);
    return Object.freeze({
      path,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }).sort((left, right) => (
    compareGitRuntimePaths(left.path, right.path)
  ));
  const finalBinNames = directBinEntryNames(binDirectory);
  if (!exactArray(initialBinNames, finalBinNames)) {
    throw gitToolchainError("PINNED_GIT_RUNTIME_CHANGED_DURING_READ");
  }
  directories.forEach((path, index) => {
    const after = assertCanonicalDirectory(path);
    if (!sameStableMetadata(directoryMetadata[index], after)) {
      throw gitToolchainError("PINNED_GIT_RUNTIME_CHANGED_DURING_READ");
    }
  });
  const totalBytes = files.reduce((total, file) => total + file.bytes, 0);
  if (!Number.isSafeInteger(totalBytes)) {
    throw gitToolchainError("PINNED_GIT_RUNTIME_SIZE_INVALID");
  }
  const sha256 = createHash("sha256")
    .update(files.map((file) => (
      `${file.path}\0${file.bytes}\0${file.sha256}`
    )).join("\n"), "utf8")
    .digest("hex");
  return Object.freeze({
    algorithm: GIT_RUNTIME_TREE_ALGORITHM,
    fileCount: files.length,
    totalBytes,
    sha256,
  });
}

export function canonicalGitRuntimeTreeSnapshotForTesting(runtimeRoot) {
  return canonicalGitRuntimeTreeSnapshot(resolve(runtimeRoot));
}

export function verifyGitRuntimeTreeForTesting(runtimeRoot, expected) {
  const snapshot =
    canonicalGitRuntimeTreeSnapshotForTesting(runtimeRoot);
  if (
    expected?.algorithm !== GIT_RUNTIME_TREE_ALGORITHM
    || !Number.isSafeInteger(expected?.fileCount)
    || !Number.isSafeInteger(expected?.totalBytes)
    || typeof expected?.sha256 !== "string"
    || snapshot.fileCount !== expected.fileCount
    || snapshot.totalBytes !== expected.totalBytes
    || snapshot.sha256 !== expected.sha256
  ) throw gitToolchainError("PINNED_GIT_RUNTIME_TREE_INTEGRITY_MISMATCH");
  return snapshot;
}

export function pinnedGitChildEnvironment() {
  const windowsRoot = String.raw`C:\Windows`;
  return Object.freeze({
    SystemRoot: windowsRoot,
    WINDIR: windowsRoot,
    ComSpec: join(windowsRoot, "System32", "cmd.exe"),
    PATH: [
      GIT_BIN_DIRECTORY,
      join(windowsRoot, "System32"),
      windowsRoot,
    ].join(";"),
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    LANG: "C",
    LC_ALL: "C",
    TZ: "UTC",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: "NUL",
    GIT_CONFIG_GLOBAL: "NUL",
    GIT_CONFIG_COUNT: "0",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_PAGER: "",
    PAGER: "",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_FLUSH: "1",
    GIT_PROTOCOL_FROM_USER: "0",
  });
}

function runVersionReadback() {
  let output;
  try {
    output = String(execFileSync(
      GIT_EXECUTABLE_PATH,
      ["--version"],
      {
        encoding: "utf8",
        env: pinnedGitChildEnvironment(),
        timeout: GIT_VERSION_TIMEOUT_MS,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    )).trim();
  } catch {
    throw gitToolchainError("PINNED_GIT_VERSION_READ_FAILED");
  }
  if (output !== GIT_VERSION_OUTPUT) {
    throw gitToolchainError("PINNED_GIT_VERSION_MISMATCH");
  }
  return output;
}

export function inspectPinnedGitRuntime() {
  if (process.platform !== "win32") {
    throw gitToolchainError("PINNED_GIT_WINDOWS_RUNTIME_REQUIRED");
  }
  if (
    resolve(GIT_RUNTIME_ROOT) !== GIT_RUNTIME_ROOT
    || resolve(GIT_EXECUTABLE_PATH) !== GIT_EXECUTABLE_PATH
    || resolve(GIT_BIN_DIRECTORY) !== GIT_BIN_DIRECTORY
  ) throw gitToolchainError("PINNED_GIT_CANONICAL_PATH_REQUIRED");
  const snapshot = canonicalGitRuntimeTreeSnapshot(GIT_RUNTIME_ROOT);
  if (
    snapshot.algorithm !== GIT_RUNTIME_TREE_ALGORITHM
    || snapshot.fileCount !== GIT_RUNTIME_TREE_FILE_COUNT
    || snapshot.totalBytes !== GIT_RUNTIME_TREE_TOTAL_BYTES
    || snapshot.sha256 !== GIT_RUNTIME_TREE_SHA256
  ) throw gitToolchainError("PINNED_GIT_RUNTIME_TREE_INTEGRITY_MISMATCH");
  runVersionReadback();
  return Object.freeze({
    ...approvedGitRuntime,
    versionOutput: GIT_VERSION_OUTPUT,
  });
}

function repositoryRelativePath(path) {
  return (
    typeof path === "string"
    && path.length > 0
    && path.length <= MAX_ARGUMENT_LENGTH
    && !path.includes("\0")
    && !path.includes("\r")
    && !path.includes("\n")
    && !path.includes("\\")
    && !path.startsWith("/")
    && !isAbsolute(path)
    && !path.split("/").some(
      (part) => part === "" || part === "." || part === ".." || part === ".git",
    )
  );
}

function exactStrings(actual, expected) {
  return (
    actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
  );
}

function validLsFilesArguments(args) {
  if (exactStrings(args, ["-v", "-z"])) return true;
  let pathOffset;
  if (
    args[0] === "-v"
    && args[1] === "-z"
    && args[2] === "--"
  ) pathOffset = 3;
  else if (
    args[0] === "--stage"
    && args[1] === "--"
  ) pathOffset = 2;
  else if (
    args[0] === "--stage"
    && args[1] === "-z"
    && args[2] === "--"
  ) pathOffset = 3;
  else if (
    args[0] === "--others"
    && args[1] === "--ignored"
    && args[2] === "--exclude-standard"
    && args[3] === "-z"
    && args[4] === "--"
  ) pathOffset = 5;
  else return false;
  const paths = args.slice(pathOffset);
  return (
    paths.length > 0
    && new Set(paths).size === paths.length
    && paths.every(repositoryRelativePath)
  );
}

function objectPathSpec(value) {
  if (typeof value !== "string") return false;
  const separator = value.indexOf(":");
  return (
    (separator === 40 || separator === 64)
    && GIT_OBJECT_ID.test(value.slice(0, separator))
    && repositoryRelativePath(value.slice(separator + 1))
  );
}

function validReadOnlyCommand(command, args) {
  switch (command) {
    case "rev-parse":
      return (
        exactStrings(args, ["HEAD"])
        || exactStrings(args, ["HEAD^{tree}"])
        || exactStrings(args, ["HEAD", "HEAD^{tree}"])
        || (
          args.length === 1
          && /^(?:[a-f0-9]{40}|[a-f0-9]{64})\^\{tree\}$/u
            .test(args[0])
        )
        || (
          args.length > 0
          && args.every(objectPathSpec)
        )
      );
    case "status":
      return (
        exactStrings(
          args,
          ["--porcelain=v2", "--untracked-files=all"],
        )
        || exactStrings(
          args,
          ["--porcelain=v2", "-z", "--untracked-files=all"],
        )
      );
    case "ls-files":
      return validLsFilesArguments(args);
    case "ls-tree":
      return (
        args.length === 5
        && args[0] === "-z"
        && args[1] === "--name-only"
        && GIT_OBJECT_ID.test(args[2])
        && args[3] === "--"
        && repositoryRelativePath(args[4])
      )
      || (
        args.length === 6
        && args[0] === "-r"
        && args[1] === "-z"
        && args[2] === "--full-tree"
        && GIT_OBJECT_ID.test(args[3])
        && args[4] === "--"
        && repositoryRelativePath(args[5])
      );
    case "show": {
      if (args.length !== 1) return false;
      return objectPathSpec(args[0]);
    }
    case "cat-file":
      return (
        args.length === 2
        && args[0] === "-t"
        && GIT_OBJECT_ID.test(args[1])
      )
      || (
        args.length === 2
        && args[0] === "blob"
        && GIT_OBJECT_ID.test(args[1])
      );
    case "rev-list":
      return (
        args.length === 4
        && args[0] === "--parents"
        && args[1] === "-n"
        && args[2] === "1"
        && (args[3] === "HEAD" || GIT_OBJECT_ID.test(args[3]))
      );
    case "merge-base":
      return (
        args.length === 3
        && args[0] === "--is-ancestor"
        && GIT_OBJECT_ID.test(args[1])
        && GIT_OBJECT_ID.test(args[2])
      );
    case "diff":
      return (
        args.length === 6
        && args[0] === "--name-only"
        && args[1] === "--no-renames"
        && args[2] === "-z"
        && GIT_OBJECT_ID.test(args[3])
        && GIT_OBJECT_ID.test(args[4])
        && args[5] === "--"
      )
      || (
        args.length === 5
        && args[0] === "--name-only"
        && args[1] === "--no-renames"
        && args[2] === "-z"
        && GIT_OBJECT_ID.test(args[3])
        && GIT_OBJECT_ID.test(args[4])
      );
    case "hash-object":
      return (
        args.length >= 3
        && args[0] === "--no-filters"
        && args[1] === "--"
        && new Set(args.slice(2)).size === args.length - 2
        && args.slice(2).every(repositoryRelativePath)
      );
    default:
      return false;
  }
}

function canonicalRepositoryRoot(cwd) {
  if (
    typeof cwd !== "string"
    || cwd.length === 0
    || !isAbsolute(cwd)
  ) throw gitToolchainError("PINNED_GIT_CANONICAL_CWD_REQUIRED");
  const resolvedCwd = resolve(cwd);
  if (cwd !== resolvedCwd && cwd !== `${resolvedCwd}${sep}`) {
    throw gitToolchainError("PINNED_GIT_CANONICAL_CWD_REQUIRED");
  }
  let metadata;
  let canonical;
  let dotGitMetadata;
  let canonicalDotGit;
  const dotGit = join(resolvedCwd, ".git");
  try {
    metadata = lstatSync(resolvedCwd);
    canonical = realpathSync.native(resolvedCwd);
    dotGitMetadata = lstatSync(dotGit);
    canonicalDotGit = realpathSync.native(dotGit);
  } catch {
    throw gitToolchainError("PINNED_GIT_CANONICAL_REPOSITORY_REQUIRED");
  }
  if (
    !metadata.isDirectory()
    || metadata.isSymbolicLink()
    || !dotGitMetadata.isDirectory()
    || dotGitMetadata.isSymbolicLink()
    || !sameCanonicalPath(canonical, resolvedCwd)
    || !sameCanonicalPath(canonicalDotGit, dotGit)
  ) throw gitToolchainError("PINNED_GIT_CANONICAL_REPOSITORY_REQUIRED");
  return canonical;
}

function normalizeInvocation(args, cwd) {
  if (
    !Array.isArray(args)
    || args.length === 0
    || args.length > MAX_ARGUMENT_COUNT
    || args.some((value) => (
      typeof value !== "string"
      || value.length === 0
      || value.length > MAX_ARGUMENT_LENGTH
      || value.includes("\0")
      || value.includes("\r")
      || value.includes("\n")
    ))
  ) throw gitToolchainError("PINNED_GIT_ARGUMENTS_INVALID");
  let offset = 0;
  if (args[0] === "-c") {
    if (
      args.length < 3
      || !args[1].startsWith("safe.directory=")
    ) throw gitToolchainError("PINNED_GIT_CONFIG_INJECTION_FORBIDDEN");
    const configured = args[1].slice("safe.directory=".length);
    const expected = normalizedForwardPath(cwd).replace(/\/+$/u, "");
    const normalizedConfigured =
      normalizedForwardPath(configured).replace(/\/+$/u, "");
    if (
      !isAbsolute(configured)
      || configured.split(/[\\/]/u).includes("..")
      || !sameCanonicalPath(normalizedConfigured, expected)
    ) {
      throw gitToolchainError("PINNED_GIT_SAFE_DIRECTORY_MISMATCH");
    }
    offset = 2;
  }
  const command = args[offset];
  const commandArgs = args.slice(offset + 1);
  if (
    command?.startsWith("-")
    || commandArgs.includes("-c")
    || !validReadOnlyCommand(command, commandArgs)
  ) throw gitToolchainError("PINNED_GIT_READ_ONLY_COMMAND_REQUIRED");
  return Object.freeze({ command, commandArgs: Object.freeze(commandArgs) });
}

function normalizedExecOptions(options) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).some((key) => !ALLOWED_OPTION_KEYS.has(key))
  ) throw gitToolchainError("PINNED_GIT_EXEC_OPTIONS_INVALID");
  const cwd = canonicalRepositoryRoot(options.cwd);
  if (
    options.windowsHide !== undefined
    && options.windowsHide !== true
  ) throw gitToolchainError("PINNED_GIT_EXEC_OPTIONS_INVALID");
  const encoding = options.encoding;
  if (
    encoding !== undefined
    && encoding !== null
    && encoding !== "buffer"
    && encoding !== "utf8"
  ) throw gitToolchainError("PINNED_GIT_EXEC_OPTIONS_INVALID");
  const stdio = options.stdio ?? ["ignore", "pipe", "pipe"];
  if (
    !Array.isArray(stdio)
    || stdio.length !== 3
    || stdio[0] !== "ignore"
    || stdio[1] !== "pipe"
    || (stdio[2] !== "pipe" && stdio[2] !== "ignore")
  ) throw gitToolchainError("PINNED_GIT_EXEC_OPTIONS_INVALID");
  const maxBuffer = options.maxBuffer ?? MAX_BUFFER_LIMIT;
  if (
    !Number.isSafeInteger(maxBuffer)
    || maxBuffer < 1
    || maxBuffer > MAX_BUFFER_LIMIT
  ) throw gitToolchainError("PINNED_GIT_EXEC_OPTIONS_INVALID");
  const timeout = options.timeout ?? GIT_COMMAND_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(timeout)
    || timeout < 1
    || timeout > GIT_COMMAND_TIMEOUT_MS
  ) throw gitToolchainError("PINNED_GIT_EXEC_OPTIONS_INVALID");
  return Object.freeze({
    cwd,
    encoding,
    maxBuffer,
    stdio: Object.freeze([...stdio]),
    timeout,
  });
}

function hardenedArguments(cwd, command, commandArgs) {
  const root = normalizedForwardPath(cwd);
  const commandHardening = command === "status"
    ? ["--ignore-submodules=all"]
    : command === "diff"
      ? ["--no-ext-diff", "--no-textconv", "--ignore-submodules=all"]
      : [];
  return [
    "--no-pager",
    "--no-replace-objects",
    "--no-optional-locks",
    `--git-dir=${normalizedForwardPath(join(cwd, ".git"))}`,
    `--work-tree=${root}`,
    "-c",
    `safe.directory=${root}`,
    "-c",
    "core.bare=false",
    "-c",
    `core.worktree=${root}`,
    "-c",
    "core.hooksPath=NUL",
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.untrackedCache=false",
    "-c",
    "core.attributesFile=NUL",
    "-c",
    "core.excludesFile=NUL",
    "-c",
    "core.pager=",
    "-c",
    "pager.status=false",
    "-c",
    "pager.show=false",
    "-c",
    "color.ui=false",
    "-c",
    "diff.external=",
    "-c",
    "interactive.diffFilter=",
    "-c",
    "submodule.recurse=false",
    "-c",
    "maintenance.auto=false",
    "-c",
    "gc.auto=0",
    "-c",
    "credential.helper=",
    "-c",
    "protocol.allow=never",
    command,
    ...commandHardening,
    ...commandArgs,
  ];
}

export function createPinnedGitExecFile() {
  const adapter = (file, args, options = {}) => {
    if (file !== "git") {
      throw gitToolchainError("PINNED_GIT_LOGICAL_COMMAND_REQUIRED");
    }
    const normalizedOptions = normalizedExecOptions(options);
    const invocation = normalizeInvocation(args, normalizedOptions.cwd);
    inspectPinnedGitRuntime();
    return execFileSync(
      GIT_EXECUTABLE_PATH,
      hardenedArguments(
        normalizedOptions.cwd,
        invocation.command,
        invocation.commandArgs,
      ),
      {
        cwd: normalizedOptions.cwd,
        encoding: normalizedOptions.encoding,
        env: pinnedGitChildEnvironment(),
        maxBuffer: normalizedOptions.maxBuffer,
        timeout: normalizedOptions.timeout,
        windowsHide: true,
        stdio: normalizedOptions.stdio,
      },
    );
  };
  return Object.freeze(adapter);
}
