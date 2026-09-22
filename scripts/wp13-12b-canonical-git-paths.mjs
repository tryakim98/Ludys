import { createHash } from "node:crypto";

const FULL_GIT_COMMIT_SHA = /^[a-f0-9]{40}$/u;
const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function contractError(code) {
  return new Error(`WP13_12B_CANONICAL_GIT_PATHS_${code}`);
}

function assertRepositoryRelativePosixPath(path) {
  if (
    typeof path !== "string"
    || path.length === 0
    || path.includes("\0")
    || path.includes("\\")
    || path.startsWith("/")
    || /^[A-Za-z]:\//u.test(path)
    || path.split("/").some(
      (part) => part === "" || part === "." || part === ".." || part === ".git",
    )
  ) throw contractError("REPOSITORY_RELATIVE_POSIX_PATH_REQUIRED");
  return path;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function assertFullGitCommitSha(value) {
  if (typeof value !== "string" || !FULL_GIT_COMMIT_SHA.test(value)) {
    throw contractError("FULL_LOWERCASE_COMMIT_SHA_REQUIRED");
  }
  return value;
}

export function canonicalGitDiffArguments(fromCommit, toCommit) {
  assertFullGitCommitSha(fromCommit);
  assertFullGitCommitSha(toCommit);
  if (fromCommit === toCommit) {
    throw contractError("DISTINCT_DIFF_COMMITS_REQUIRED");
  }
  return Object.freeze([
    "--name-only",
    "--no-renames",
    "-z",
    fromCommit,
    toCommit,
    "--",
  ]);
}

export function parseCanonicalNulGitPaths(output, { allowEmpty = false } = {}) {
  if (!Buffer.isBuffer(output)) {
    throw contractError("BUFFER_REQUIRED");
  }
  if (output.byteLength === 0) {
    if (allowEmpty === true) return Object.freeze([]);
    throw contractError("NON_EMPTY_PATH_SET_REQUIRED");
  }
  if (output[output.byteLength - 1] !== 0) {
    throw contractError("TERMINAL_NUL_REQUIRED");
  }

  const paths = [];
  const seen = new Set();
  let offset = 0;
  for (let index = 0; index < output.byteLength; index += 1) {
    if (output[index] !== 0) continue;
    const pathBytes = output.subarray(offset, index);
    if (pathBytes.byteLength === 0) {
      throw contractError("EMPTY_PATH_FORBIDDEN");
    }
    let path;
    try {
      path = utf8Decoder.decode(pathBytes);
    } catch {
      throw contractError("VALID_UTF8_REQUIRED");
    }
    if (!Buffer.from(path, "utf8").equals(pathBytes)) {
      throw contractError("CANONICAL_UTF8_REQUIRED");
    }
    assertRepositoryRelativePosixPath(path);
    if (seen.has(path)) throw contractError("DUPLICATE_PATH_FORBIDDEN");
    seen.add(path);
    paths.push(path);
    offset = index + 1;
  }
  return Object.freeze(paths.sort(compareUtf8));
}

export function parseCanonicalNulGitTreeEntries(output) {
  if (!Buffer.isBuffer(output) || output.byteLength === 0) {
    throw contractError("NON_EMPTY_TREE_ENTRY_BUFFER_REQUIRED");
  }
  if (output[output.byteLength - 1] !== 0) {
    throw contractError("TERMINAL_NUL_REQUIRED");
  }
  const entries = [];
  const seenPaths = new Set();
  let offset = 0;
  for (let index = 0; index < output.byteLength; index += 1) {
    if (output[index] !== 0) continue;
    const recordBytes = output.subarray(offset, index);
    if (recordBytes.byteLength === 0) {
      throw contractError("EMPTY_TREE_ENTRY_FORBIDDEN");
    }
    let record;
    try {
      record = utf8Decoder.decode(recordBytes);
    } catch {
      throw contractError("VALID_UTF8_REQUIRED");
    }
    if (!Buffer.from(record, "utf8").equals(recordBytes)) {
      throw contractError("CANONICAL_UTF8_REQUIRED");
    }
    const separator = record.indexOf("\t");
    if (separator < 0) throw contractError("TREE_ENTRY_TAB_REQUIRED");
    const header = /^(040000|100644|100755|120000|160000) (blob|tree|commit) ((?:[a-f0-9]{40}|[a-f0-9]{64}))$/u
      .exec(record.slice(0, separator));
    if (header === null) throw contractError("TREE_ENTRY_HEADER_INVALID");
    const [, mode, objectType, objectId] = header;
    if (
      (mode === "040000" && objectType !== "tree")
      || (["100644", "100755", "120000"].includes(mode)
        && objectType !== "blob")
      || (mode === "160000" && objectType !== "commit")
    ) throw contractError("TREE_ENTRY_MODE_TYPE_MISMATCH");
    const path = assertRepositoryRelativePosixPath(
      record.slice(separator + 1),
    );
    if (seenPaths.has(path)) throw contractError("DUPLICATE_PATH_FORBIDDEN");
    seenPaths.add(path);
    entries.push(Object.freeze({ mode, objectType, objectId, path }));
    offset = index + 1;
  }
  return Object.freeze(entries.sort((left, right) =>
    compareUtf8(left.path, right.path)));
}

export function canonicalGitPathSetSha256(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw contractError("NON_EMPTY_PATH_SET_REQUIRED");
  }
  const seen = new Set();
  const canonicalPaths = paths.map((path) => {
    assertRepositoryRelativePosixPath(path);
    if (seen.has(path)) throw contractError("DUPLICATE_PATH_FORBIDDEN");
    seen.add(path);
    return path;
  }).sort(compareUtf8);
  const hash = createHash("sha256");
  for (const path of canonicalPaths) {
    hash.update(Buffer.from(path, "utf8"));
    hash.update(Buffer.from([0]));
  }
  return hash.digest("hex");
}

function assertPathState(state) {
  if (
    state === null
    || typeof state !== "object"
    || typeof state.exists !== "boolean"
    || (
      state.exists === true
      && (
        !GIT_OBJECT_ID.test(String(state.blob ?? ""))
        || state.objectType !== "blob"
      )
    )
    || (
      state.exists === false
      && (state.blob !== null || state.objectType !== null)
    )
  ) throw contractError("PATH_STATE_INVALID");
}

export function deriveCanonicalGitPathChange(path, fromState, toState) {
  assertRepositoryRelativePosixPath(path);
  assertPathState(fromState);
  assertPathState(toState);
  if (!fromState.exists && toState.exists) {
    return Object.freeze({ path, changeType: "A" });
  }
  if (
    fromState.exists
    && toState.exists
    && fromState.blob !== toState.blob
  ) return Object.freeze({ path, changeType: "M" });
  throw contractError("UNSUPPORTED_OR_UNCHANGED_PATH_STATE");
}
