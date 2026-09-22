import { createHash, timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateVercelActivationReadback,
} from "../provider/firebase/tools/operator-gate-contract.mjs";
import {
  buildEmulatorConfirmationText,
  buildEmulatorProofBinding,
  EMULATOR_PROOF_PATH,
  PINNED_GIT_COMPATIBILITY_EXPECTED_CHANGE_PATHS,
  PROOF_ORIGIN_EXPECTED_CHANGE_PATHS,
  REQUIRED_EMULATOR_PROOF_RESULTS,
} from "./wp13-12b-emulator-confirmation.mjs";
import {
  canonicalGitDiffArguments,
  parseCanonicalNulGitPaths,
} from "./wp13-12b-canonical-git-paths.mjs";
import {
  RECEIPT_ARTIFACT_VERIFICATION_MODE,
  verifyReceiptRepositoryIntegrity,
} from "./wp13-12b-receipt-integrity.mjs";
import {
  providerPackageFilePaths,
} from "./wp13-12b-provider-package-contract.mjs";
import {
  assertNoDangerousExternalEnvironment,
  sanitizedNodeChildEnvironment,
} from "./wp13-12b-external-process-boundary.mjs";
import {
  createPinnedGitExecFile,
} from "./wp13-12b-pinned-git-toolchain.mjs";

const productionRepositoryRoot = resolve(
  fileURLToPath(new URL("..", import.meta.url)),
);
const activationDirectory = join(
  productionRepositoryRoot,
  "release",
  "wp13-12b",
  "external-activation",
);
const trust = JSON.parse(await readFile(
  join(activationDirectory, "vercel-google-trust-contract.json"),
  "utf8",
));

const FULL_GIT_SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const RECEIPT_PATH =
  /^release\/wp13-12b\/receipts\/actual\/[^/]+\.json$/u;
const previewReadyCapabilityMaximumAgeMilliseconds = 2 * 60 * 1000;
const liveCapabilityMaximumAgeMilliseconds = 2 * 60 * 1000;
const externalActivationChecksumManifestPath =
  "release/wp13-12b/external-activation/artifact-checksums.sha256";
const authorityCriticalManifestPaths = Object.freeze([
  "artifacts/wp13-12b-provider-package.json",
  "package.json",
  ...providerPackageFilePaths,
  "provider/firebase/firestore.indexes.json",
  "provider/firebase/firestore.rules",
  "provider/firebase/tools/operator-gate-contract.mjs",
  "provider/firebase/tools/seed-synthetic-fixtures.mjs",
  "provider/firebase/tools/set-staging-control.mjs",
  "provider/vercel/wp13-12b-preview/.vercelignore",
  "provider/vercel/wp13-12b-preview/tools/build-deploy-dist.mjs",
  "provider/vercel/wp13-12b-preview/tools/copy-review-preflight.mjs",
  "release/wp13-12b/external-activation/cloud-field-approval.json",
  "release/wp13-12b/external-activation/expiry-destruction-execution-contract.json",
  "release/wp13-12b/external-activation/owner-authorization.json",
  "release/wp13-12b/external-activation/vercel-cli-tooling-risk.json",
  "release/wp13-12b/external-activation/vercel-google-trust-contract.json",
  "scripts/build-wp13-12b-provider-package.mjs",
  "scripts/provider-external-activation-orchestrator.mjs",
  "scripts/provider-external-deploy-identity-control.mjs",
  "scripts/provider-external-function-deploy.mjs",
  "scripts/provider-external-vercel-control.mjs",
  "scripts/provider-external-vercel-preview-deploy.mjs",
  "scripts/provider-external-wif-control.mjs",
  "scripts/wp13-12b-activation-phase-gate.mjs",
  "scripts/wp13-12b-deploy-identity.mjs",
  "scripts/wp13-12b-external-activation-checksums.mjs",
  "scripts/wp13-12b-external-resource-operator.mjs",
  "scripts/wp13-12b-google-oauth-token-helper.cjs",
  "scripts/wp13-12b-provider-package-contract.mjs",
  "scripts/wp13-12b-vercel-cli-toolchain.mjs",
]);

const baseCapabilities = new WeakSet();
const previewReadyCapabilities = new WeakSet();
const liveCapabilities = new WeakSet();
const cleanupCapabilities = new WeakSet();
const capabilityMetadata = new WeakMap();
const cleanupEvidenceWorkingPaths = new Set([
  "artifacts/wp13-12b-external-resource-inventory.json",
  "release/wp13-12b/receipts/actual/deactivation-execution-receipt.json",
  "release/wp13-12b/receipts/actual/preview-destruction-confirmation.json",
  "release/wp13-12b/receipts/actual/preview-destruction-evidence.json",
  "release/wp13-12b/receipts/actual/synthetic-data-deletion-confirmation.json",
  "release/wp13-12b/receipts/actual/synthetic-data-deletion-evidence.json",
  "release/wp13-12b/receipts/actual/synthetic-data-deletion-execution-receipt.json",
  "release/wp13-12b/receipts/actual/synthetic-data-deletion-intent.json",
]);
const cleanupEvidenceTempSuffix =
  /^\.tmp-([1-9][0-9]*)-([a-f0-9]{32})$/u;
const maximumInterruptedCleanupEvidenceTemps = 32;

function gateError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactText(expected, actual) {
  if (typeof actual !== "string") return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(actual, "utf8");
  return expectedBytes.length === actualBytes.length
    && timingSafeEqual(expectedBytes, actualBytes);
}

function exactUtcTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function isActivationCapabilityFresh(
  acquiredAt,
  instant,
  maximumAgeMilliseconds,
) {
  const acquiredAtMilliseconds = Date.parse(acquiredAt);
  return (
    instant instanceof Date
    && !Number.isNaN(instant.valueOf())
    && Number.isSafeInteger(maximumAgeMilliseconds)
    && maximumAgeMilliseconds > 0
    && Number.isFinite(acquiredAtMilliseconds)
    && acquiredAtMilliseconds <= instant.valueOf() + 60_000
    && instant.valueOf() - acquiredAtMilliseconds
      <= maximumAgeMilliseconds
  );
}

function repositoryPath(root, path) {
  if (
    typeof path !== "string"
    || path.length === 0
    || isAbsolute(path)
    || path.includes("\\")
    || path.includes("\0")
    || path.split("/").some((part) => part === ".." || part === ".git")
  ) throw gateError("ACTIVATION_EVIDENCE_PATH_INVALID");
  const target = resolve(root, path);
  const fromRoot = relative(root, target);
  if (
    fromRoot === ""
    || fromRoot === ".."
    || fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    || isAbsolute(fromRoot)
  ) throw gateError("ACTIVATION_EVIDENCE_PATH_INVALID");
  return target;
}

function sameFilesystemPath(left, right) {
  const normalize = (value) => (
    process.platform === "win32" ? value.toLowerCase() : value
  );
  return normalize(left) === normalize(right);
}

function assertCanonicalCleanupParentChain(root, path) {
  const resolvedRoot = resolve(root);
  let canonicalRoot;
  let rootMetadata;
  try {
    canonicalRoot = realpathSync(resolvedRoot);
    rootMetadata = lstatSync(resolvedRoot);
  } catch {
    throw gateError("CLEANUP_EVIDENCE_CANONICAL_PARENT_REQUIRED");
  }
  if (
    !rootMetadata.isDirectory()
    || rootMetadata.isSymbolicLink()
  ) throw gateError("CLEANUP_EVIDENCE_CANONICAL_PARENT_REQUIRED");

  const target = repositoryPath(resolvedRoot, path);
  const parent = dirname(target);
  const relativeParent = relative(resolvedRoot, parent);
  const parts = relativeParent === ""
    ? []
    : relativeParent.split(sep);
  let current = resolvedRoot;
  let expected = canonicalRoot;
  let parentMetadata = rootMetadata;
  for (const part of parts) {
    current = join(current, part);
    expected = join(expected, part);
    let metadata;
    let canonical;
    try {
      metadata = lstatSync(current);
      canonical = realpathSync(current);
    } catch {
      throw gateError("CLEANUP_EVIDENCE_CANONICAL_PARENT_REQUIRED");
    }
    if (
      !metadata.isDirectory()
      || metadata.isSymbolicLink()
      || !sameFilesystemPath(canonical, expected)
    ) throw gateError("CLEANUP_EVIDENCE_CANONICAL_PARENT_REQUIRED");
    parentMetadata = metadata;
  }
  return Object.freeze({
    canonicalRoot,
    parent,
    parentMetadata,
    target,
  });
}

function cleanupEvidencePathClassification(path) {
  if (cleanupEvidenceWorkingPaths.has(path)) {
    return Object.freeze({
      finalPath: path,
      kind: "FINAL",
    });
  }
  for (const finalPath of cleanupEvidenceWorkingPaths) {
    if (!path.startsWith(`${finalPath}.tmp-`)) continue;
    const suffix = path.slice(finalPath.length);
    if (cleanupEvidenceTempSuffix.test(suffix)) {
      return Object.freeze({
        finalPath,
        kind: "INTERRUPTED_TEMP",
      });
    }
    throw gateError("CLEANUP_EVIDENCE_TEMP_NAME_INVALID");
  }
  throw gateError("CLEANUP_CAPABILITY_WORKTREE_DRIFT_FORBIDDEN");
}

function readCanonicalCleanupEvidenceMetadata(root, path, classification) {
  const parent = assertCanonicalCleanupParentChain(root, path);
  let metadata;
  let canonical;
  try {
    metadata = lstatSync(parent.target);
    canonical = realpathSync(parent.target);
  } catch {
    throw gateError("CLEANUP_EVIDENCE_REGULAR_FILE_REQUIRED");
  }
  const expectedCanonical = join(
    parent.canonicalRoot,
    ...path.split("/"),
  );
  if (
    !metadata.isFile()
    || metadata.isSymbolicLink()
    || !sameFilesystemPath(canonical, expectedCanonical)
  ) throw gateError("CLEANUP_EVIDENCE_REGULAR_FILE_REQUIRED");
  if (
    classification.kind === "INTERRUPTED_TEMP"
    && (
      ![1, 2].includes(metadata.nlink)
      || (
        process.platform !== "win32"
        && (
          (metadata.mode & 0o777) !== 0o600
          || metadata.uid !== parent.parentMetadata.uid
        )
      )
    )
  ) throw gateError("CLEANUP_EVIDENCE_TEMP_OWNERSHIP_INVALID");
  return Object.freeze({
    ...classification,
    canonical,
    dev: metadata.dev,
    ino: metadata.ino,
    nlink: metadata.nlink,
    path,
  });
}

function validateCleanupEvidenceWorktreeEntries(root, statusEntries) {
  if (
    !Array.isArray(statusEntries)
    || statusEntries.length > (
      cleanupEvidenceWorkingPaths.size
      + maximumInterruptedCleanupEvidenceTemps
    )
    || new Set(statusEntries).size !== statusEntries.length
  ) throw gateError("CLEANUP_CAPABILITY_WORKTREE_DRIFT_FORBIDDEN");

  const observations = [];
  for (const entry of statusEntries) {
    if (typeof entry !== "string" || !entry.startsWith("?? ")) {
      throw gateError("CLEANUP_CAPABILITY_WORKTREE_DRIFT_FORBIDDEN");
    }
    const path = entry.slice(3);
    const classification = cleanupEvidencePathClassification(path);
    observations.push(
      readCanonicalCleanupEvidenceMetadata(root, path, classification),
    );
  }
  const temps = observations.filter(
    (entry) => entry.kind === "INTERRUPTED_TEMP",
  );
  if (temps.length > maximumInterruptedCleanupEvidenceTemps) {
    throw gateError(
      "INTERRUPTED_CLEANUP_EVIDENCE_RECOVERY_SCOPE_EXCEEDED",
    );
  }
  for (const temp of temps) {
    if (temp.nlink !== 2) continue;
    const matchingFinals = observations.filter((entry) => (
      entry.kind === "FINAL"
      && entry.path === temp.finalPath
      && entry.nlink === 2
      && entry.dev === temp.dev
      && entry.ino === temp.ino
    ));
    if (matchingFinals.length !== 1) {
      throw gateError("CLEANUP_EVIDENCE_TEMP_HARDLINK_INVALID");
    }
  }
  for (const final of observations.filter((entry) => entry.kind === "FINAL")) {
    if (![1, 2].includes(final.nlink)) {
      throw gateError("CLEANUP_EVIDENCE_FINAL_LINK_COUNT_INVALID");
    }
    if (
      final.nlink === 2
      && temps.filter((temp) => (
        temp.finalPath === final.path
        && temp.nlink === 2
        && temp.dev === final.dev
        && temp.ino === final.ino
      )).length !== 1
    ) throw gateError("CLEANUP_EVIDENCE_TEMP_HARDLINK_INVALID");
  }
  return observations.map((entry) => entry.path).sort();
}

export function validateCleanupEvidenceWorktreeEntriesForTesting({
  repositoryRoot,
  statusEntries,
}) {
  return validateCleanupEvidenceWorktreeEntries(
    resolve(repositoryRoot),
    statusEntries,
  );
}

function runGitText(root, execFileImpl, args, code) {
  try {
    return String(execFileImpl(
      "git",
      ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
      {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    )).trim();
  } catch {
    throw gateError(code);
  }
}

function runGitBytes(root, execFileImpl, args, code) {
  try {
    return Buffer.from(execFileImpl(
      "git",
      ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
      {
        cwd: root,
        encoding: "buffer",
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    ));
  } catch {
    throw gateError(code);
  }
}

function committedBytes(root, execFileImpl, commit, path) {
  return runGitBytes(
    root,
    execFileImpl,
    ["show", `${commit}:${path}`],
    "ACTIVATION_EVIDENCE_NOT_COMMITTED",
  );
}

function authorityManifestEntries(bytes, repositoryRoot) {
  const text = bytes.toString("utf8");
  if (!text.endsWith("\n")) {
    throw gateError("AUTHORITY_CHECKSUM_MANIFEST_INVALID");
  }
  const entries = text.slice(0, -1).split("\n").map((line) => {
    const match = /^([a-f0-9]{64})  ([^\r\n]+)$/u.exec(line);
    if (match === null) {
      throw gateError("AUTHORITY_CHECKSUM_MANIFEST_INVALID");
    }
    repositoryPath(repositoryRoot, match[2]);
    return Object.freeze({ sha256: match[1], path: match[2] });
  });
  const paths = entries.map((entry) => entry.path);
  if (
    entries.length === 0
    || new Set(paths).size !== paths.length
    || !exactStringSet(paths, [...paths].sort())
    || authorityCriticalManifestPaths.some((path) => !paths.includes(path))
  ) throw gateError("AUTHORITY_CHECKSUM_MANIFEST_COVERAGE_INCOMPLETE");
  return entries;
}

function verifyAuthorityCriticalWorkingBytes(
  metadata,
  {
    repositoryRoot = productionRepositoryRoot,
    execFileImpl = createPinnedGitExecFile(),
  } = {},
) {
  const root = resolve(repositoryRoot);
  const headCommit = metadata.headCommit;
  const manifestCommitted = committedBytes(
    root,
    execFileImpl,
    headCommit,
    externalActivationChecksumManifestPath,
  );
  let manifestWorking;
  try {
    const manifestStat = lstatSync(
      repositoryPath(root, externalActivationChecksumManifestPath),
    );
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
      throw new Error("special manifest");
    }
    manifestWorking = readFileSync(
      repositoryPath(root, externalActivationChecksumManifestPath),
    );
  } catch {
    throw gateError("AUTHORITY_CHECKSUM_MANIFEST_WORKTREE_MISMATCH");
  }
  if (!manifestWorking.equals(manifestCommitted)) {
    throw gateError("AUTHORITY_CHECKSUM_MANIFEST_WORKTREE_MISMATCH");
  }
  const entries = authorityManifestEntries(manifestCommitted, root);
  const protectedPaths = [
    externalActivationChecksumManifestPath,
    ...entries.map((entry) => entry.path),
  ];
  const tagged = runGitBytes(
    root,
    execFileImpl,
    ["ls-files", "-v", "-z", "--", ...protectedPaths],
    "AUTHORITY_GIT_INDEX_FLAGS_READ_FAILED",
  ).toString("utf8").split("\0").filter(Boolean);
  const taggedPaths = new Set();
  for (const entry of tagged) {
    if (
      entry.length < 3
      || entry[0] !== "H"
      || entry[1] !== " "
      || taggedPaths.has(entry.slice(2))
    ) throw gateError("AUTHORITY_GIT_INDEX_MASKING_FORBIDDEN");
    taggedPaths.add(entry.slice(2));
  }
  if (
    protectedPaths.some((path) => !taggedPaths.has(path))
    || taggedPaths.size !== protectedPaths.length
  ) throw gateError("AUTHORITY_CRITICAL_PATH_NOT_TRACKED");
  for (const entry of entries) {
    const committed = committedBytes(
      root,
      execFileImpl,
      headCommit,
      entry.path,
    );
    if (sha256(committed) !== entry.sha256) {
      throw gateError("AUTHORITY_COMMITTED_CHECKSUM_MISMATCH");
    }
    let working;
    try {
      const target = repositoryPath(root, entry.path);
      const metadata = lstatSync(target);
      if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw new Error("special authority file");
      }
      working = readFileSync(target);
    } catch {
      throw gateError("AUTHORITY_CRITICAL_WORKING_BYTES_MISMATCH");
    }
    if (!working.equals(committed)) {
      throw gateError("AUTHORITY_CRITICAL_WORKING_BYTES_MISMATCH");
    }
  }
}

function assertOnlyCleanupEvidenceWorktreeChanges(root, execFileImpl) {
  const statusEntries = runGitBytes(
    root,
    execFileImpl,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    "CLEANUP_CAPABILITY_REPOSITORY_BINDING_MISMATCH",
  ).toString("utf8").split("\0").filter(Boolean);
  return validateCleanupEvidenceWorktreeEntries(root, statusEntries);
}

function exactStringSet(actual, expected) {
  return (
    actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
  );
}

function exactStringArray(actual, expected) {
  return (
    Array.isArray(actual)
    && Array.isArray(expected)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
  );
}

function exactBindingValue(actual, expected) {
  if (Array.isArray(expected)) return exactStringArray(actual, expected);
  if (
    expected !== null
    && typeof expected === "object"
    && !Array.isArray(expected)
  ) {
    if (
      actual === null
      || typeof actual !== "object"
      || Array.isArray(actual)
    ) return false;
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();
    return exactStringArray(actualKeys, expectedKeys)
      && expectedKeys.every(
        (key) => exactBindingValue(actual[key], expected[key]),
      );
  }
  return actual === expected;
}

function normalizedEvidencePaths(root, paths) {
  if (
    !Array.isArray(paths)
    || new Set(paths).size !== paths.length
  ) throw gateError("ACTIVATION_EVIDENCE_PATH_SET_INVALID");
  for (const path of paths) repositoryPath(root, path);
  return [...paths].sort();
}

function exactCommitParents(root, execFileImpl, commit, code) {
  const fields = runGitText(
    root,
    execFileImpl,
    ["rev-list", "--parents", "-n", "1", commit],
    code,
  ).split(" ").filter(Boolean);
  if (
    fields[0] !== commit
    || fields.some((field) => !FULL_GIT_SHA.test(field))
  ) throw gateError(code);
  return fields.slice(1);
}

function assertExactCommitDelta(
  root,
  execFileImpl,
  fromCommit,
  toCommit,
  expectedPaths,
) {
  let changedPaths;
  try {
    changedPaths = parseCanonicalNulGitPaths(runGitBytes(
      root,
      execFileImpl,
      ["diff", ...canonicalGitDiffArguments(fromCommit, toCommit)],
      "ACTIVATION_EVIDENCE_DIFF_READ_FAILED",
    ));
  } catch {
    throw gateError("ACTIVATION_EVIDENCE_DIFF_READ_FAILED");
  }
  if (!exactStringSet(changedPaths, expectedPaths)) {
    throw gateError("CODE_DRIFT_AFTER_EMULATOR_PROOF_FORBIDDEN");
  }
}

function validateDirectEmulatorEvidenceCommitChain({
  root,
  execFileImpl,
  commitS,
  commitT,
  commitU,
  commitV,
  commitW,
  orderedCommitChain,
  proofToolCommit,
  proofToolCommitChain,
  headCommit,
  proofOriginChangePaths,
  proofToolChangePaths,
  emulatorEvidencePaths,
  additionalEvidencePaths: additionalPaths,
}) {
  if (
    !FULL_GIT_SHA.test(String(commitS ?? ""))
    || !FULL_GIT_SHA.test(String(commitT ?? ""))
    || !FULL_GIT_SHA.test(String(commitU ?? ""))
    || !FULL_GIT_SHA.test(String(commitV ?? ""))
    || !FULL_GIT_SHA.test(String(commitW ?? ""))
    || !FULL_GIT_SHA.test(String(proofToolCommit ?? ""))
    || !FULL_GIT_SHA.test(String(headCommit ?? ""))
    || proofToolCommit !== commitW
    || new Set([
      commitS,
      commitT,
      commitU,
      commitV,
      commitW,
      headCommit,
    ]).size !== 6
    || !exactStringArray(
      orderedCommitChain,
      [commitS, commitT, commitU, commitV, commitW],
    )
    || !exactStringArray(
      proofToolCommitChain,
      [commitT, commitU, commitV, commitW],
    )
  ) throw gateError("EMULATOR_EVIDENCE_COMMIT_CHAIN_INVALID");
  const originPaths = normalizedEvidencePaths(root, proofOriginChangePaths);
  const toolPaths = normalizedEvidencePaths(root, proofToolChangePaths);
  const basePaths = normalizedEvidencePaths(root, emulatorEvidencePaths);
  const extraPaths = normalizedEvidencePaths(root, additionalPaths);
  if (
    originPaths.length === 0
    || toolPaths.length === 0
    || basePaths.length !== 2
    || originPaths.some((path) => toolPaths.includes(path))
    || originPaths.some(
      (path) => basePaths.includes(path) || extraPaths.includes(path),
    )
    || toolPaths.some(
      (path) => basePaths.includes(path) || extraPaths.includes(path),
    )
    || basePaths.some((path) => extraPaths.includes(path))
  ) throw gateError("ACTIVATION_EVIDENCE_PATH_SET_INVALID");

  let emulatorEvidenceCommit = headCommit;
  if (extraPaths.length > 0) {
    const headParents = exactCommitParents(
      root,
      execFileImpl,
      headCommit,
      "ADDITIONAL_EVIDENCE_COMMIT_PARENT_READ_FAILED",
    );
    if (headParents.length !== 1) {
      throw gateError(
        "ADDITIONAL_EVIDENCE_COMMIT_NOT_DIRECT_CHILD_OF_EMULATOR_EVIDENCE",
      );
    }
    [emulatorEvidenceCommit] = headParents;
  }
  const emulatorEvidenceParents = exactCommitParents(
    root,
    execFileImpl,
    emulatorEvidenceCommit,
    "EMULATOR_EVIDENCE_COMMIT_PARENT_READ_FAILED",
  );
  if (
    emulatorEvidenceParents.length !== 1
    || emulatorEvidenceParents[0] !== proofToolCommit
  ) {
    throw gateError(
      "EMULATOR_EVIDENCE_COMMIT_NOT_DIRECT_CHILD_OF_PROOF_TOOL",
    );
  }
  const proofToolParents = exactCommitParents(
    root,
    execFileImpl,
    commitW,
    "PROOF_TOOL_COMMIT_PARENT_READ_FAILED",
  );
  if (
    proofToolParents.length !== 1
    || proofToolParents[0] !== commitV
  ) {
    throw gateError(
      "COMMIT_W_NOT_DIRECT_CHILD_OF_COMMIT_V",
    );
  }
  const commitVParents = exactCommitParents(
    root,
    execFileImpl,
    commitV,
    "COMMIT_V_PARENT_READ_FAILED",
  );
  if (
    commitVParents.length !== 1
    || commitVParents[0] !== commitU
  ) {
    throw gateError(
      "COMMIT_V_NOT_DIRECT_CHILD_OF_COMMIT_U",
    );
  }
  const commitUParents = exactCommitParents(
    root,
    execFileImpl,
    commitU,
    "COMMIT_U_PARENT_READ_FAILED",
  );
  if (
    commitUParents.length !== 1
    || commitUParents[0] !== commitT
  ) {
    throw gateError("COMMIT_U_NOT_DIRECT_CHILD_OF_COMMIT_T");
  }
  const commitTParents = exactCommitParents(
    root,
    execFileImpl,
    commitT,
    "COMMIT_T_PARENT_READ_FAILED",
  );
  if (
    commitTParents.length !== 1
    || commitTParents[0] !== commitS
  ) {
    throw gateError("COMMIT_T_NOT_DIRECT_CHILD_OF_COMMIT_S");
  }
  assertExactCommitDelta(
    root,
    execFileImpl,
    commitU,
    commitV,
    originPaths,
  );
  assertExactCommitDelta(
    root,
    execFileImpl,
    commitV,
    commitW,
    toolPaths,
  );
  assertExactCommitDelta(
    root,
    execFileImpl,
    proofToolCommit,
    emulatorEvidenceCommit,
    basePaths,
  );
  if (extraPaths.length > 0) {
    assertExactCommitDelta(
      root,
      execFileImpl,
      emulatorEvidenceCommit,
      headCommit,
      extraPaths,
    );
  }
  return Object.freeze({
    commitT,
    commitU,
    commitV,
    commitW,
    orderedCommitChain: Object.freeze([...orderedCommitChain]),
    proofToolCommit,
    proofToolCommitChain: Object.freeze([...proofToolCommitChain]),
    emulatorEvidenceCommit,
    additionalEvidenceCommit:
      extraPaths.length > 0 ? headCommit : null,
  });
}

export function validateDirectEmulatorEvidenceCommitChainForTesting({
  repositoryRoot,
  commitS,
  commitT,
  commitU,
  commitV,
  commitW,
  orderedCommitChain,
  proofToolCommit,
  proofToolCommitChain,
  headCommit,
  proofOriginChangePaths,
  proofToolChangePaths,
  emulatorEvidencePaths,
  additionalEvidencePaths = [],
}) {
  return validateDirectEmulatorEvidenceCommitChain({
    root: resolve(repositoryRoot),
    execFileImpl: execFileSync,
    commitS,
    commitT,
    commitU,
    commitV,
    commitW,
    orderedCommitChain,
    proofToolCommit,
    proofToolCommitChain,
    headCommit,
    proofOriginChangePaths,
    proofToolChangePaths,
    emulatorEvidencePaths,
    additionalEvidencePaths,
  });
}

function validateEmulatorReceipt(receipt, binding, expectedConfirmation) {
  const proofResultNames = Object.keys(receipt?.proofResults ?? {}).sort();
  const requiredProofResultNames =
    [...REQUIRED_EMULATOR_PROOF_RESULTS].sort();
  const receiptBinding = receipt?.emulatorProofBinding;
  const bindingKeys = Object.keys(binding).sort();
  const receiptBindingKeys = (
    receiptBinding !== null
    && typeof receiptBinding === "object"
    && !Array.isArray(receiptBinding)
  ) ? Object.keys(receiptBinding).sort() : [];
  const confirmation =
    receipt?.humanSignatureOrExplicitConfirmation;
  const nonceRecord = receipt?.nonceRecord;
  const confirmedAt = confirmation?.confirmedAt;
  const expectedReceiptId =
    `wp13-12b-emulator-proof-${binding.sourceCommit.slice(0, 12)}-`
    + `${binding.nonce.slice(0, 12)}-v2`;
  if (
    receipt?.schemaVersion !== "wp13.12b-receipt-v2"
    || receipt?.templateMarker !== "FILLED_AUTHENTIC_EVIDENCE"
    || receipt?.receiptId !== expectedReceiptId
    || receipt?.receiptType !== "EMULATOR_PROOF_RECEIPT"
    || receipt?.status !== "COMPLETED_WITH_AUTHENTIC_EVIDENCE"
    || receipt?.sourceCommit !== binding.sourceCommit
    || receipt?.sourceTree !== binding.sourceTree
    || receipt?.expectedSourceCommit !== binding.sourceCommit
    || receipt?.evidenceAnchorCommit !== binding.commitS
    || receipt?.evidenceAnchorTree !== binding.commitSTree
    || receipt?.commitT !== binding.commitT
    || receipt?.commitTTree !== binding.commitTTree
    || receipt?.commitU !== binding.commitU
    || receipt?.commitUTree !== binding.commitUTree
    || receipt?.commitV !== binding.commitV
    || receipt?.commitVTree !== binding.commitVTree
    || receipt?.commitW !== binding.commitW
    || receipt?.commitWTree !== binding.commitWTree
    || !exactStringArray(
      receipt?.orderedCommitChain,
      binding.orderedCommitChain,
    )
    || receipt?.proofOriginCommit !== binding.proofOriginCommit
    || receipt?.proofOriginTree !== binding.proofOriginTree
    || receipt?.securityRemediationCommit
      !== binding.securityRemediationCommit
    || receipt?.securityRemediationTree !== binding.securityRemediationTree
    || receipt?.providerSecurityRemediationCommit
      !== binding.providerSecurityRemediationCommit
    || receipt?.providerPackageCommit !== binding.providerPackageCommit
    || receipt?.providerPackageLockCommit
      !== binding.providerPackageLockCommit
    || receipt?.providerSbomCommit !== binding.providerSbomCommit
    || receipt?.providerAuditCommit !== binding.providerAuditCommit
    || receipt?.proofToolCommit !== binding.proofToolCommit
    || receipt?.proofToolTree !== binding.proofToolTree
    || !exactStringArray(
      receipt?.proofToolCommitChain,
      binding.proofToolCommitChain,
    )
    || binding.sourceCommit !== binding.commitW
    || binding.sourceTree !== binding.commitWTree
    || binding.proofOriginCommit !== binding.commitV
    || binding.proofOriginTree !== binding.commitVTree
    || binding.securityRemediationCommit !== binding.commitU
    || binding.securityRemediationTree !== binding.commitUTree
    || binding.providerSecurityRemediationCommit !== binding.commitU
    || binding.providerPackageCommit !== binding.commitU
    || binding.providerPackageLockCommit !== binding.commitU
    || binding.providerSbomCommit !== binding.commitU
    || binding.providerAuditCommit !== binding.commitU
    || binding.proofToolCommit !== binding.commitW
    || binding.proofToolTree !== binding.commitWTree
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
      [binding.commitT, binding.commitU, binding.commitV, binding.commitW],
    )
    || !SHA256.test(String(binding.providerLockSha256 ?? ""))
    || !SHA256.test(String(binding.providerSbomSha256 ?? ""))
    || !SHA256.test(String(binding.providerAuditSha256 ?? ""))
    || !SHA256.test(
      String(binding.providerSecurityRemediationSha256 ?? ""),
    )
    || binding.resolvedFastUriVersion !== "3.1.5"
    || binding.advisory !== "GHSA-7p8r-x3mc-p8w7"
    || !FULL_GIT_SHA.test(String(binding.proofRunnerGitBlob ?? ""))
    || !exactStringSet(receiptBindingKeys, bindingKeys)
    || bindingKeys.some(
      (key) => !exactBindingValue(receiptBinding[key], binding[key]),
    )
    || receipt?.artifactHashes?.[EMULATOR_PROOF_PATH]
      !== binding.artifactSha256
    || receipt?.artifactHashes?.[
      "release/wp13-12b/external-activation/owner-authorization.json"
    ] !== binding.ownerDecisionSha256
    || receipt?.artifactHashes?.["artifacts/wp13-12b-provider-package.json"]
      !== binding.providerPackageSha256
    || receipt?.artifactHashes?.[
      "provider/firebase/functions/package-lock.json"
    ] !== binding.providerLockSha256
    || receipt?.artifactHashes?.[
      "release/wp13-12b/provider-sbom.cdx.json"
    ] !== binding.providerSbomSha256
    || receipt?.artifactHashes?.[
      "release/wp13-12b/provider-audit.json"
    ] !== binding.providerAuditSha256
    || receipt?.artifactHashes?.[
      "release/wp13-12b/provider-security-remediation.json"
    ] !== binding.providerSecurityRemediationSha256
    || receipt?.artifactHashes?.[externalActivationChecksumManifestPath]
      !== binding.activationPackageSha256
    || receipt?.artifactHashes?.[
      "release/wp13-12b/activation-handoff/receipt-contracts.json"
    ] !== binding.receiptContractSha256
    || receipt?.artifactHashes?.["scripts/run-wp13-12b-emulator-proof.mjs"]
      !== binding.proofRunnerSha256
    || receipt?.decisionRecordChecksum !== binding.ownerDecisionSha256
    || confirmation?.confirmed !== true
    || !exactText(
      expectedConfirmation,
      confirmation?.confirmationText,
    )
    || !exactUtcTimestamp(binding.generatedAt)
    || !exactUtcTimestamp(binding.expiresAt)
    || !exactUtcTimestamp(confirmedAt)
    || receipt?.createdAt !== confirmedAt
    || Date.parse(binding.generatedAt) > Date.parse(confirmedAt)
    || Date.parse(confirmedAt) > Date.parse(binding.expiresAt)
    || nonceRecord?.schemaVersion
      !== "wp13.12b-emulator-proof-challenge-v2"
    || nonceRecord?.generation !== 1
    || nonceRecord?.nonce !== binding.nonce
    || nonceRecord?.purpose !== binding.purpose
    || nonceRecord?.generatedAt !== binding.generatedAt
    || nonceRecord?.expiresAt !== binding.expiresAt
    || nonceRecord?.status !== "CONFIRMED_CONSUMED"
    || nonceRecord?.consumedAt !== confirmedAt
    || nonceRecord?.cloudResourceCount !== binding.cloudResourceCount
    || nonceRecord?.deploymentCount !== binding.deploymentCount
    || nonceRecord?.validatedReceiptCount !== binding.validatedReceiptCount
    || nonceRecord?.commitS !== binding.commitS
    || nonceRecord?.commitSTree !== binding.commitSTree
    || nonceRecord?.commitT !== binding.commitT
    || nonceRecord?.commitTTree !== binding.commitTTree
    || nonceRecord?.commitU !== binding.commitU
    || nonceRecord?.commitUTree !== binding.commitUTree
    || nonceRecord?.commitV !== binding.commitV
    || nonceRecord?.commitVTree !== binding.commitVTree
    || nonceRecord?.commitW !== binding.commitW
    || nonceRecord?.commitWTree !== binding.commitWTree
    || !exactStringArray(
      nonceRecord?.orderedCommitChain,
      binding.orderedCommitChain,
    )
    || nonceRecord?.proofOriginCommit !== binding.proofOriginCommit
    || nonceRecord?.proofOriginTree !== binding.proofOriginTree
    || nonceRecord?.securityRemediationCommit
      !== binding.securityRemediationCommit
    || nonceRecord?.securityRemediationTree
      !== binding.securityRemediationTree
    || nonceRecord?.providerSecurityRemediationCommit
      !== binding.providerSecurityRemediationCommit
    || nonceRecord?.providerPackageCommit
      !== binding.providerPackageCommit
    || nonceRecord?.providerPackageLockCommit
      !== binding.providerPackageLockCommit
    || nonceRecord?.providerSbomCommit !== binding.providerSbomCommit
    || nonceRecord?.providerAuditCommit !== binding.providerAuditCommit
    || !exactStringArray(
      nonceRecord?.proofToolCommitChain,
      binding.proofToolCommitChain,
    )
    || nonceRecord?.proofToolCommit !== binding.proofToolCommit
    || nonceRecord?.proofToolTree !== binding.proofToolTree
    || nonceRecord?.proofRunnerSha256 !== binding.proofRunnerSha256
    || !FULL_GIT_SHA.test(String(nonceRecord?.proofRunnerGitBlob ?? ""))
    || nonceRecord?.proofRunnerGitBlob !== binding.proofRunnerGitBlob
    || nonceRecord?.pinnedGitAdapterSha256
      !== binding.pinnedGitAdapterSha256
    || nonceRecord?.pinnedGitAdapterGitBlob
      !== binding.pinnedGitAdapterGitBlob
    || nonceRecord?.securityRemediationChangeSetSha256
      !== binding.securityRemediationChangeSetSha256
    || !exactBindingValue(
      nonceRecord?.gitDiffCommandContract,
      binding.gitDiffCommandContract,
    )
    || nonceRecord?.previewSourceSetSha256
      !== binding.previewSourceSetSha256
    || nonceRecord?.freshEmulatorProofSha256 !== binding.proofSha256
    || nonceRecord?.ownerDecisionSha256 !== binding.ownerDecisionSha256
    || nonceRecord?.providerPackageSha256
      !== binding.providerPackageSha256
    || nonceRecord?.providerLockSha256 !== binding.providerLockSha256
    || nonceRecord?.providerSbomSha256 !== binding.providerSbomSha256
    || nonceRecord?.providerAuditSha256 !== binding.providerAuditSha256
    || nonceRecord?.providerSecurityRemediationSha256
      !== binding.providerSecurityRemediationSha256
    || nonceRecord?.resolvedFastUriVersion
      !== binding.resolvedFastUriVersion
    || nonceRecord?.advisory !== binding.advisory
    || nonceRecord?.activationPackageSha256
      !== binding.activationPackageSha256
    || nonceRecord?.receiptContractSha256
      !== binding.receiptContractSha256
    || !nonNegativeInteger(binding.cloudResourceCount)
    || !nonNegativeInteger(binding.deploymentCount)
    || !nonNegativeInteger(binding.validatedReceiptCount)
    || receipt?.realParticipantData !== false
    || receipt?.syntheticOrFabricated !== false
    || receipt?.authorizesStudentBeta !== false
    || receipt?.authorizesProduction !== false
    || !exactStringSet(proofResultNames, requiredProofResultNames)
    || requiredProofResultNames.some(
      (name) => receipt.proofResults[name] !== true,
    )
  ) throw gateError("CONFIRMED_CHALLENGE_BOUND_EMULATOR_V2_RECEIPT_REQUIRED");
}

export function validateEmulatorReceiptForTesting(
  receipt,
  binding,
  expectedConfirmation,
) {
  validateEmulatorReceipt(receipt, binding, expectedConfirmation);
  return true;
}

function additionalEvidencePaths(binding) {
  if (binding === null) return Object.freeze([]);
  const receiptPath = binding?.receiptPath;
  const receiptSha256 = binding?.receiptSha256;
  const artifactPaths = binding?.artifactPaths;
  const artifactHashes = binding?.artifactHashes;
  if (
    !RECEIPT_PATH.test(receiptPath ?? "")
    || !SHA256.test(receiptSha256 ?? "")
    || !Array.isArray(artifactPaths)
    || artifactPaths.length === 0
    || new Set(artifactPaths).size !== artifactPaths.length
    || artifactHashes === null
    || typeof artifactHashes !== "object"
    || Array.isArray(artifactHashes)
    || Object.keys(artifactHashes).length !== artifactPaths.length
    || artifactPaths.some((path) => (
      !RECEIPT_PATH.test(path)
      || path === receiptPath
      || !SHA256.test(artifactHashes[path] ?? "")
    ))
  ) throw gateError("HASH_BOUND_ADDITIONAL_EVIDENCE_REQUIRED");
  return Object.freeze([
    Object.freeze({ path: receiptPath, sha256: receiptSha256 }),
    ...artifactPaths.map((path) => Object.freeze({
      path,
      sha256: artifactHashes[path],
    })),
  ].sort((left, right) => left.path.localeCompare(right.path)));
}

async function validateBaseEvidence({
  repositoryRoot,
  execFileImpl,
  additionalEvidenceBinding,
}) {
  const root = resolve(repositoryRoot);
  let proofBytes;
  try {
    proofBytes = await readFile(repositoryPath(root, EMULATOR_PROOF_PATH));
  } catch {
    throw gateError("CONFIRMED_CHALLENGE_BOUND_EMULATOR_V2_PROOF_REQUIRED");
  }
  let proof;
  try {
    proof = JSON.parse(proofBytes.toString("utf8"));
  } catch {
    throw gateError("EMULATOR_V2_PROOF_INVALID");
  }
  let binding;
  let expectedConfirmation;
  try {
    binding = buildEmulatorProofBinding(proof, proofBytes);
    expectedConfirmation =
      buildEmulatorConfirmationText(proof, proofBytes);
  } catch {
    throw gateError("EMULATOR_V2_PROOF_INVALID");
  }
  const receiptPath =
    "release/wp13-12b/receipts/actual/"
    + `emulator-proof-receipt-${binding.sourceCommit.slice(0, 12)}-v2.json`;
  let receiptBytes;
  try {
    receiptBytes = await readFile(repositoryPath(root, receiptPath));
  } catch {
    throw gateError(
      "CONFIRMED_CHALLENGE_BOUND_EMULATOR_V2_RECEIPT_REQUIRED",
    );
  }
  let receipt;
  try {
    receipt = JSON.parse(receiptBytes.toString("utf8"));
  } catch {
    throw gateError(
      "CONFIRMED_CHALLENGE_BOUND_EMULATOR_V2_RECEIPT_REQUIRED",
    );
  }
  validateEmulatorReceipt(receipt, binding, expectedConfirmation);
  const integrity = await verifyReceiptRepositoryIntegrity(
    receipt,
    root,
    {
      receiptPath,
      artifactVerificationMode:
        RECEIPT_ARTIFACT_VERIFICATION_MODE.DESCENDANT_EVIDENCE_COMMIT,
    },
  );
  if (
    integrity?.errors?.length !== 0
    || integrity?.sourceCommitExists !== true
    || integrity?.sourceTreeExists !== true
    || integrity?.resolvedSourceTree !== binding.sourceTree
    || !integrity.artifactResults?.every((entry) => entry.verified === true)
  ) throw gateError("EMULATOR_V2_RECEIPT_REPOSITORY_INTEGRITY_FAILED");

  const headCommit = runGitText(
    root,
    execFileImpl,
    ["rev-parse", "HEAD"],
    "ACTIVATION_HEAD_READ_FAILED",
  );
  const headTree = runGitText(
    root,
    execFileImpl,
    ["rev-parse", "HEAD^{tree}"],
    "ACTIVATION_HEAD_READ_FAILED",
  );
  const commitVTree = runGitText(
    root,
    execFileImpl,
    ["rev-parse", `${binding.commitV}^{tree}`],
    "EMULATOR_PROOF_COMMIT_TREE_MISMATCH",
  );
  const commitWTree = runGitText(
    root,
    execFileImpl,
    ["rev-parse", `${binding.commitW}^{tree}`],
    "EMULATOR_PROOF_COMMIT_W_TREE_MISMATCH",
  );
  const commitUTree = runGitText(
    root,
    execFileImpl,
    ["rev-parse", `${binding.commitU}^{tree}`],
    "EMULATOR_PROOF_COMMIT_U_TREE_MISMATCH",
  );
  const commitTTree = runGitText(
    root,
    execFileImpl,
    ["rev-parse", `${binding.commitT}^{tree}`],
    "EMULATOR_PROOF_COMMIT_T_TREE_MISMATCH",
  );
  const commitSTree = runGitText(
    root,
    execFileImpl,
    ["rev-parse", `${binding.commitS}^{tree}`],
    "EMULATOR_PROOF_COMMIT_S_TREE_MISMATCH",
  );
  const status = runGitText(
    root,
    execFileImpl,
    ["status", "--porcelain=v2", "--untracked-files=all"],
    "ACTIVATION_WORKTREE_STATUS_FAILED",
  );
  if (
    !FULL_GIT_SHA.test(headCommit)
    || !FULL_GIT_SHA.test(headTree)
    || binding.sourceCommit !== binding.commitW
    || binding.sourceTree !== binding.commitWTree
    || binding.proofToolCommit !== binding.commitW
    || binding.proofToolTree !== binding.commitWTree
    || commitWTree !== binding.commitWTree
    || commitVTree !== binding.commitVTree
    || commitUTree !== binding.commitUTree
    || commitTTree !== binding.commitTTree
    || commitSTree !== binding.commitSTree
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
      [binding.commitT, binding.commitU, binding.commitV, binding.commitW],
    )
    || status !== ""
  ) throw gateError("ACTIVATION_REPOSITORY_NOT_CLEAN_OR_BOUND");
  runGitText(
    root,
    execFileImpl,
    ["merge-base", "--is-ancestor", binding.commitS, headCommit],
    "EMULATOR_PROOF_SOURCE_NOT_ANCESTOR_OF_ACTIVATION_HEAD",
  );

  const additional = additionalEvidencePaths(additionalEvidenceBinding);
  const emulatorEvidence = [
    Object.freeze({
      path: EMULATOR_PROOF_PATH,
      sha256: binding.artifactSha256,
    }),
    Object.freeze({ path: receiptPath, sha256: sha256(receiptBytes) }),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const expectedEvidence = [
    ...emulatorEvidence,
    ...additional,
  ].sort((left, right) => left.path.localeCompare(right.path));
  const evidenceChain = validateDirectEmulatorEvidenceCommitChain({
    root,
    execFileImpl,
    commitS: binding.commitS,
    commitT: binding.commitT,
    commitU: binding.commitU,
    commitV: binding.commitV,
    commitW: binding.commitW,
    orderedCommitChain: binding.orderedCommitChain,
    proofToolCommit: binding.proofToolCommit,
    proofToolCommitChain: binding.proofToolCommitChain,
    headCommit,
    proofOriginChangePaths: PROOF_ORIGIN_EXPECTED_CHANGE_PATHS,
    proofToolChangePaths: PINNED_GIT_COMPATIBILITY_EXPECTED_CHANGE_PATHS,
    emulatorEvidencePaths:
      emulatorEvidence.map((entry) => entry.path),
    additionalEvidencePaths: additional.map((entry) => entry.path),
  });
  let changedPaths;
  try {
    changedPaths = parseCanonicalNulGitPaths(runGitBytes(
      root,
      execFileImpl,
      [
        "diff",
        ...canonicalGitDiffArguments(binding.commitW, headCommit),
      ],
      "ACTIVATION_EVIDENCE_DIFF_READ_FAILED",
    ));
  } catch {
    throw gateError("ACTIVATION_EVIDENCE_DIFF_READ_FAILED");
  }
  if (
    !exactStringSet(
      changedPaths,
      expectedEvidence.map((entry) => entry.path).sort(),
    )
  ) throw gateError("CODE_DRIFT_AFTER_EMULATOR_PROOF_FORBIDDEN");
  for (const evidence of expectedEvidence) {
    const committed = committedBytes(
      root,
      execFileImpl,
      headCommit,
      evidence.path,
    );
    if (sha256(committed) !== evidence.sha256) {
      throw gateError("HASH_BOUND_ACTIVATION_EVIDENCE_MISMATCH");
    }
  }
  const emulatorEvidenceTree = runGitText(
    root,
    execFileImpl,
    ["rev-parse", `${evidenceChain.emulatorEvidenceCommit}^{tree}`],
    "EMULATOR_EVIDENCE_COMMIT_TREE_READ_FAILED",
  );

  const metadata = Object.freeze({
    schemaVersion: "wp13.12b-activation-proof-gate-v1",
    repositoryRoot: root,
    proofSourceCommit: binding.commitS,
    proofSourceTree: binding.commitSTree,
    commitT: binding.commitT,
    commitTTree: binding.commitTTree,
    commitU: binding.commitU,
    commitUTree: binding.commitUTree,
    commitV: binding.commitV,
    commitVTree: binding.commitVTree,
    commitW: binding.commitW,
    commitWTree: binding.commitWTree,
    orderedCommitChain: Object.freeze([
      ...binding.orderedCommitChain,
    ]),
    proofToolCommit: binding.proofToolCommit,
    proofToolTree: binding.proofToolTree,
    proofToolCommitChain: Object.freeze([
      ...binding.proofToolCommitChain,
    ]),
    securityRemediationCommit: binding.securityRemediationCommit,
    securityRemediationTree: binding.securityRemediationTree,
    providerSecurityRemediationCommit:
      binding.providerSecurityRemediationCommit,
    providerPackageCommit: binding.providerPackageCommit,
    providerPackageLockCommit: binding.providerPackageLockCommit,
    providerSbomCommit: binding.providerSbomCommit,
    providerAuditCommit: binding.providerAuditCommit,
    providerSecurityRemediationSha256:
      binding.providerSecurityRemediationSha256,
    providerPackageSha256: binding.providerPackageSha256,
    providerLockSha256: binding.providerLockSha256,
    providerSbomSha256: binding.providerSbomSha256,
    providerAuditSha256: binding.providerAuditSha256,
    resolvedFastUriVersion: binding.resolvedFastUriVersion,
    advisory: binding.advisory,
    proofOriginChangePaths: Object.freeze([
      ...proof.proofOriginChangePaths,
    ].sort()),
    proofToolChangePaths: Object.freeze([...proof.proofToolChangePaths].sort()),
    emulatorEvidenceCommit: evidenceChain.emulatorEvidenceCommit,
    emulatorEvidenceTree,
    additionalEvidenceCommit: evidenceChain.additionalEvidenceCommit,
    headCommit,
    headTree,
    proofSha256: binding.proofSha256,
    receiptPath,
    receiptSha256: sha256(receiptBytes),
    evidencePaths: Object.freeze(
      expectedEvidence.map((entry) => entry.path),
    ),
    genuineChallengeBoundV2Receipt: true,
    codeDriftAfterProof: false,
  });
  verifyAuthorityCriticalWorkingBytes(metadata, {
    repositoryRoot: root,
    execFileImpl,
  });
  return metadata;
}

export async function validateActivationEvidenceSnapshotForTesting({
  repositoryRoot,
  execFileImpl = execFileSync,
  additionalEvidenceBinding = null,
}) {
  const metadata = await validateBaseEvidence({
    repositoryRoot,
    execFileImpl,
    additionalEvidenceBinding,
  });
  return Object.freeze({
    ...metadata,
    productionBound: false,
    testOnlyEvidenceSnapshot: true,
  });
}

function defaultRunJsonScript(scriptPath, args, environment) {
  let childEnvironment;
  try {
    childEnvironment = sanitizedNodeChildEnvironment(environment, {
      preserveKeys: [
        "LUDYS_AUTHENTICATED_BROWSER_PROOF_PATH",
        "LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH",
      ],
    });
  } catch {
    throw gateError(
      "LIVE_ACTIVATION_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  let output;
  try {
    output = String(execFileSync(process.execPath, [
      scriptPath,
      ...args,
    ], {
      cwd: productionRepositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnvironment,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    })).trim();
  } catch {
    throw gateError("LIVE_ACTIVATION_READBACK_FAILED");
  }
  try {
    return JSON.parse(output);
  } catch {
    throw gateError("LIVE_ACTIVATION_READBACK_INVALID");
  }
}

function defaultVercelReadback(environment) {
  return defaultRunJsonScript(
    join(
      productionRepositoryRoot,
      "scripts",
      "provider-external-vercel-control.mjs",
    ),
    ["--action", "inspect-project"],
    environment,
  );
}

function defaultWifReadback(mode, environment) {
  return defaultRunJsonScript(
    join(
      productionRepositoryRoot,
      "scripts",
      "provider-external-wif-control.mjs",
    ),
    ["--action", mode === "live" ? "verify" : "verify-disabled"],
    environment,
  );
}

function validateWifReadback(readback, mode) {
  const expectedAction = mode === "live" ? "verify" : "verify-disabled";
  const expectedTrustState = mode === "live" ? "enabled" : "disabled";
  const expectedDisabled = mode !== "live";
  if (
    readback?.schemaVersion !== "wp13.12b-ea-external-wif-control-v1"
    || readback?.action !== expectedAction
    || readback?.externalWrites !== 0
    || readback?.complete !== true
    || readback?.expectedTrustState !== expectedTrustState
    || readback?.state?.pool?.disabled !== expectedDisabled
    || readback?.state?.provider?.disabled !== expectedDisabled
    || readback?.previewOnly !== true
    || readback?.productionAuthorized !== false
    || readback?.stableParticipantIdentityConfigured !== false
    || readback?.serviceAccountKeyCreated !== false
    || readback?.accessTokenPrinted !== false
    || readback?.oidcTokenPrinted !== false
  ) throw gateError(
    mode === "live"
      ? "CURRENT_WIF_ENABLED_READBACK_REQUIRED"
      : "CURRENT_WIF_DISABLED_READBACK_REQUIRED",
  );
}

function receiptEvidenceBinding(readback) {
  const binding = readback?.repository?.receiptEvidenceBinding;
  return binding === null || binding === undefined
    ? null
    : {
        receiptPath: binding.receiptPath,
        receiptSha256: binding.receiptSha256,
        artifactPaths: binding.artifactPaths,
        artifactHashes: binding.artifactHashes,
      };
}

async function acquireProtectedPreviewCapability(mode) {
  const repositoryRoot = resolve(productionRepositoryRoot);
  const environment = process.env;
  try {
    assertNoDangerousExternalEnvironment(environment);
  } catch {
    throw gateError(
      "LIVE_ACTIVATION_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  const now = () => new Date();
  const instant = now();
  if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) {
    throw gateError("VALID_ACTIVATION_GATE_TIME_REQUIRED");
  }
  const vercelReadback = await defaultVercelReadback(environment);
  let vercelBinding;
  try {
    vercelBinding = validateVercelActivationReadback(
      vercelReadback,
      trust,
      { now: () => instant },
    );
  } catch {
    throw gateError(
      "CURRENT_AUTHENTICATED_PROTECTED_VERCEL_PREVIEW_READBACK_REQUIRED",
    );
  }
  const wifReadback = await defaultWifReadback(mode, environment);
  validateWifReadback(wifReadback, mode);
  const gitExecFileImpl = createPinnedGitExecFile();
  const base = await validateBaseEvidence({
    repositoryRoot,
    execFileImpl: gitExecFileImpl,
    additionalEvidenceBinding: receiptEvidenceBinding(vercelReadback),
  });
  if (
    vercelBinding?.sourceCommit
      !== vercelReadback.repository?.deploymentSourceCommit
    || vercelBinding?.sourceTree
      !== vercelReadback.repository?.deploymentSourceTree
    || vercelBinding?.sourceCommit !== base.emulatorEvidenceCommit
    || vercelBinding?.sourceTree !== base.emulatorEvidenceTree
    || vercelReadback.repository?.currentEvidenceHeadCommit
      !== base.headCommit
    || vercelReadback.repository?.currentEvidenceHeadTree
      !== base.headTree
  ) throw gateError("VERCEL_AND_EMULATOR_EVIDENCE_HEAD_MISMATCH");

  const capability = Object.freeze({});
  const metadata = Object.freeze({
    ...base,
    phase: mode === "live" ? "LIVE" : "PREVIEW_READY",
    acquiredAt: instant.toISOString(),
    previewOrigin: vercelBinding.deploymentUrl,
    activeDeploymentId: vercelBinding.deploymentId,
    rollbackDeploymentId: vercelBinding.rollbackDeploymentId,
    wifEnabled: mode === "live",
    protectedPreviewReadbackValid: true,
    productionBound: true,
  });
  capabilityMetadata.set(capability, metadata);
  baseCapabilities.add(capability);
  if (mode === "live") liveCapabilities.add(capability);
  else previewReadyCapabilities.add(capability);
  return capability;
}

export async function acquireBaseActivationCapability(...args) {
  if (args.length !== 0) {
    throw gateError("PRODUCTION_ACTIVATION_GATE_ARGUMENTS_FORBIDDEN");
  }
  try {
    assertNoDangerousExternalEnvironment(process.env);
  } catch {
    throw gateError(
      "BASE_ACTIVATION_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  const gitExecFileImpl = createPinnedGitExecFile();
  const metadata = await validateBaseEvidence({
    repositoryRoot: productionRepositoryRoot,
    execFileImpl: gitExecFileImpl,
    additionalEvidenceBinding: null,
  });
  const capability = Object.freeze({});
  capabilityMetadata.set(capability, Object.freeze({
    ...metadata,
    phase: "BASE",
    productionBound: true,
  }));
  baseCapabilities.add(capability);
  return capability;
}

export async function acquireCleanupActivationCapability(...args) {
  if (args.length !== 0) {
    throw gateError("PRODUCTION_CLEANUP_GATE_ARGUMENTS_FORBIDDEN");
  }
  try {
    assertNoDangerousExternalEnvironment(process.env);
  } catch {
    throw gateError(
      "CLEANUP_ACTIVATION_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  const gitExecFileImpl = createPinnedGitExecFile();
  const headCommit = runGitText(
    productionRepositoryRoot,
    gitExecFileImpl,
    ["rev-parse", "HEAD"],
    "CLEANUP_ACTIVATION_HEAD_READ_FAILED",
  );
  const headTree = runGitText(
    productionRepositoryRoot,
    gitExecFileImpl,
    ["rev-parse", "HEAD^{tree}"],
    "CLEANUP_ACTIVATION_HEAD_READ_FAILED",
  );
  const evidenceWorkingPaths =
    assertOnlyCleanupEvidenceWorktreeChanges(
      productionRepositoryRoot,
      gitExecFileImpl,
    );
  if (
    !FULL_GIT_SHA.test(headCommit)
    || !FULL_GIT_SHA.test(headTree)
  ) throw gateError("CLEANUP_ACTIVATION_REPOSITORY_NOT_CLEAN");
  const metadata = Object.freeze({
    schemaVersion: "wp13.12b-cleanup-activation-gate-v1",
    repositoryRoot: productionRepositoryRoot,
    headCommit,
    headTree,
    phase: "FAIL_SAFE_CLEANUP",
    productionBound: true,
    acquiredFromCleanRepository: true,
    permittedUntrackedEvidencePaths: Object.freeze(evidenceWorkingPaths),
  });
  verifyAuthorityCriticalWorkingBytes(metadata, {
    execFileImpl: gitExecFileImpl,
  });
  const capability = Object.freeze({});
  capabilityMetadata.set(capability, metadata);
  cleanupCapabilities.add(capability);
  return capability;
}

export function acquirePreviewReadyActivationCapability(...args) {
  if (args.length !== 0) {
    throw gateError("PRODUCTION_ACTIVATION_GATE_ARGUMENTS_FORBIDDEN");
  }
  return acquireProtectedPreviewCapability("preview-ready");
}

export function acquireLiveActivationCapability(...args) {
  if (args.length !== 0) {
    throw gateError("PRODUCTION_ACTIVATION_GATE_ARGUMENTS_FORBIDDEN");
  }
  return acquireProtectedPreviewCapability("live");
}

function assertProductionRepositoryBinding(metadata) {
  if (metadata.repositoryRoot !== productionRepositoryRoot) {
    throw gateError("ACTIVATION_CAPABILITY_REPOSITORY_BINDING_MISMATCH");
  }
  const gitExecFileImpl = createPinnedGitExecFile();
  const currentCommit = runGitText(
    productionRepositoryRoot,
    gitExecFileImpl,
    ["rev-parse", "HEAD"],
    "ACTIVATION_CAPABILITY_REPOSITORY_BINDING_MISMATCH",
  );
  const currentTree = runGitText(
    productionRepositoryRoot,
    gitExecFileImpl,
    ["rev-parse", "HEAD^{tree}"],
    "ACTIVATION_CAPABILITY_REPOSITORY_BINDING_MISMATCH",
  );
  const status = runGitText(
    productionRepositoryRoot,
    gitExecFileImpl,
    ["status", "--porcelain=v2", "--untracked-files=all"],
    "ACTIVATION_CAPABILITY_REPOSITORY_BINDING_MISMATCH",
  );
  if (
    currentCommit !== metadata.headCommit
    || currentTree !== metadata.headTree
    || status !== ""
  ) throw gateError("ACTIVATION_CAPABILITY_REPOSITORY_BINDING_MISMATCH");
  verifyAuthorityCriticalWorkingBytes(metadata, {
    execFileImpl: gitExecFileImpl,
  });
}

function assertProductionCleanupRepositoryBinding(metadata) {
  if (metadata.repositoryRoot !== productionRepositoryRoot) {
    throw gateError("CLEANUP_CAPABILITY_REPOSITORY_BINDING_MISMATCH");
  }
  const gitExecFileImpl = createPinnedGitExecFile();
  const currentCommit = runGitText(
    productionRepositoryRoot,
    gitExecFileImpl,
    ["rev-parse", "HEAD"],
    "CLEANUP_CAPABILITY_REPOSITORY_BINDING_MISMATCH",
  );
  const currentTree = runGitText(
    productionRepositoryRoot,
    gitExecFileImpl,
    ["rev-parse", "HEAD^{tree}"],
    "CLEANUP_CAPABILITY_REPOSITORY_BINDING_MISMATCH",
  );
  if (
    currentCommit !== metadata.headCommit
    || currentTree !== metadata.headTree
  ) throw gateError("CLEANUP_CAPABILITY_REPOSITORY_BINDING_MISMATCH");
  assertOnlyCleanupEvidenceWorktreeChanges(
    productionRepositoryRoot,
    gitExecFileImpl,
  );
  verifyAuthorityCriticalWorkingBytes(metadata, {
    execFileImpl: gitExecFileImpl,
  });
}

function assertProductionAssertionOptions(options, allowedKeys) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).some((key) => !allowedKeys.has(key))
  ) throw gateError("PRODUCTION_ACTIVATION_ASSERTION_ARGUMENTS_FORBIDDEN");
}

export function assertBaseActivationCapability(
  capability,
  options = {},
) {
  assertProductionAssertionOptions(options, new Set());
  if (!baseCapabilities.has(capability)) {
    throw gateError("VALIDATED_ACTIVATION_CAPABILITY_REQUIRED");
  }
  const metadata = capabilityMetadata.get(capability);
  if (metadata?.productionBound !== true) {
    throw gateError("PRODUCTION_BOUND_ACTIVATION_CAPABILITY_REQUIRED");
  }
  assertProductionRepositoryBinding(metadata);
  return metadata;
}

export function assertCleanupActivationCapability(
  capability,
  options = {},
) {
  assertProductionAssertionOptions(options, new Set());
  if (!cleanupCapabilities.has(capability)) {
    throw gateError("VALIDATED_CLEANUP_ACTIVATION_CAPABILITY_REQUIRED");
  }
  const metadata = capabilityMetadata.get(capability);
  if (
    metadata?.productionBound !== true
    || metadata?.acquiredFromCleanRepository !== true
    || metadata?.phase !== "FAIL_SAFE_CLEANUP"
  ) throw gateError("PRODUCTION_BOUND_CLEANUP_CAPABILITY_REQUIRED");
  assertProductionCleanupRepositoryBinding(metadata);
  return metadata;
}

export function assertPreviewReadyActivationCapability(
  capability,
  options = {},
) {
  assertProductionAssertionOptions(options, new Set(["previewOrigin"]));
  const { previewOrigin } = options;
  if (!previewReadyCapabilities.has(capability)) {
    throw gateError("VALIDATED_PREVIEW_READY_CAPABILITY_REQUIRED");
  }
  const metadata = capabilityMetadata.get(capability);
  if (metadata?.productionBound !== true) {
    throw gateError("PRODUCTION_BOUND_ACTIVATION_CAPABILITY_REQUIRED");
  }
  assertProductionRepositoryBinding(metadata);
  const instant = new Date();
  if (!isActivationCapabilityFresh(
    metadata.acquiredAt,
    instant,
    previewReadyCapabilityMaximumAgeMilliseconds,
  )) throw gateError("FRESH_PREVIEW_READY_ACTIVATION_CAPABILITY_REQUIRED");
  if (
    previewOrigin !== undefined
    && metadata.previewOrigin !== previewOrigin
  ) throw gateError("PROTECTED_PREVIEW_ORIGIN_CAPABILITY_MISMATCH");
  return metadata;
}

export function assertProtectedPreviewActivationCapability(
  capability,
  options = {},
) {
  if (previewReadyCapabilities.has(capability)) {
    return assertPreviewReadyActivationCapability(capability, options);
  }
  if (liveCapabilities.has(capability)) {
    return assertLiveActivationCapability(capability, options);
  }
  throw gateError("VALIDATED_PROTECTED_PREVIEW_CAPABILITY_REQUIRED");
}

export function assertLiveActivationCapability(
  capability,
  options = {},
) {
  assertProductionAssertionOptions(options, new Set(["previewOrigin"]));
  const { previewOrigin } = options;
  if (!liveCapabilities.has(capability)) {
    throw gateError("VALIDATED_LIVE_ACTIVATION_CAPABILITY_REQUIRED");
  }
  const metadata = capabilityMetadata.get(capability);
  if (metadata?.productionBound !== true) {
    throw gateError("PRODUCTION_BOUND_ACTIVATION_CAPABILITY_REQUIRED");
  }
  assertProductionRepositoryBinding(metadata);
  const instant = new Date();
  if (
    !isActivationCapabilityFresh(
      metadata.acquiredAt,
      instant,
      liveCapabilityMaximumAgeMilliseconds,
    )
    || metadata.wifEnabled !== true
  ) throw gateError("FRESH_LIVE_ACTIVATION_CAPABILITY_REQUIRED");
  if (
    previewOrigin !== undefined
    && metadata.previewOrigin !== previewOrigin
  ) throw gateError("PROTECTED_PREVIEW_ORIGIN_CAPABILITY_MISMATCH");
  return metadata;
}

export const activationPhaseGateConstants = Object.freeze({
  productionRepositoryRoot,
  previewReadyCapabilityMaximumAgeMilliseconds,
  liveCapabilityMaximumAgeMilliseconds,
  cleanupEvidenceWorkingPaths: Object.freeze(
    [...cleanupEvidenceWorkingPaths].sort(),
  ),
});
