import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
} from "node:fs";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  approvedGitRuntime,
  canonicalGitRuntimeTreeSnapshotForTesting,
  compareGitRuntimePaths,
  createPinnedGitExecFile,
  inspectPinnedGitRuntime,
  pinnedGitChildEnvironment,
  verifyGitRuntimeTreeForTesting,
} from "./wp13-12b-pinned-git-toolchain.mjs";
import {
  canonicalGitPathSetSha256,
  parseCanonicalNulGitPaths,
} from "./wp13-12b-canonical-git-paths.mjs";
import {
  assertSecurityRemediationChangePaths,
  assertSecurityRemediationCommitAncestry,
  canonicalSecurityRemediationGitDiffArguments,
  COMMIT_T_SHA,
  COMMIT_U_SHA,
  SECURITY_REMEDIATION_CHANGE_SET_SHA256,
} from "./wp13-12b-emulator-confirmation.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const FULL_GIT_SHA = /^[a-f0-9]{40}$/u;

async function createRuntimeFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "ludys-pinned-git-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "cmd"), { recursive: true });
  await mkdir(join(root, "mingw64", "bin"), { recursive: true });
  await writeFile(join(root, "cmd", "git.exe"), "launcher-v1\n");
  await writeFile(
    join(root, "mingw64", "bin", "git.exe"),
    "runtime-v1\n",
  );
  await writeFile(
    join(root, "mingw64", "bin", "unrelated.dll"),
    Buffer.from([0, 1, 2, 255]),
  );
  return root;
}

test("fixture independently fixes the code-unit snapshot algorithm", async (t) => {
  const root = await createRuntimeFixture(t);
  const snapshot = canonicalGitRuntimeTreeSnapshotForTesting(root);
  assert.deepEqual(snapshot, {
    algorithm:
      "ASCII_CODE_UNIT_SORTED_RELATIVE_PATH_NUL_SIZE_NUL_SHA256_LF_V1",
    fileCount: 3,
    totalBytes: 27,
    sha256:
      "b057da1fed5133d3a6ca376c3c21e6ae01fdbbcdb847a1a469386016155548b5",
  });
  assert.deepEqual(
    [
      "mingw64/bin/unrelated.dll",
      "cmd/git.exe",
      "mingw64/bin/git.exe",
    ].sort(compareGitRuntimePaths),
    [
      "cmd/git.exe",
      "mingw64/bin/git.exe",
      "mingw64/bin/unrelated.dll",
    ],
  );
});

test("whole closure rejects a tampered unrelated DLL", async (t) => {
  const root = await createRuntimeFixture(t);
  const approved =
    canonicalGitRuntimeTreeSnapshotForTesting(root);
  assert.doesNotThrow(
    () => verifyGitRuntimeTreeForTesting(root, approved),
  );
  await writeFile(
    join(root, "mingw64", "bin", "unrelated.dll"),
    "credential-stealer",
  );
  assert.throws(
    () => verifyGitRuntimeTreeForTesting(root, approved),
    /PINNED_GIT_RUNTIME_TREE_INTEGRITY_MISMATCH/u,
  );
});

test("whole closure rejects an extra direct bin entry", async (t) => {
  const root = await createRuntimeFixture(t);
  const approved =
    canonicalGitRuntimeTreeSnapshotForTesting(root);
  await writeFile(
    join(root, "mingw64", "bin", "extra-helper.exe"),
    "extra",
  );
  assert.throws(
    () => verifyGitRuntimeTreeForTesting(root, approved),
    /PINNED_GIT_RUNTIME_TREE_INTEGRITY_MISMATCH/u,
  );
});

test("whole closure rejects a direct symlink", async (t) => {
  const root = await createRuntimeFixture(t);
  const target = join(root, "symlink-target");
  const link = join(root, "mingw64", "bin", "linked-runtime");
  await mkdir(target);
  try {
    await symlink(target, link, "junction");
  } catch (error) {
    if (error?.code === "EPERM") {
      t.skip("host does not permit a junction fixture");
      return;
    }
    throw error;
  }
  assert.throws(
    () => canonicalGitRuntimeTreeSnapshotForTesting(root),
    /PINNED_GIT_RUNTIME_SPECIAL_ENTRY_FORBIDDEN/u,
  );
});

test("child environment is an exact safe allowlist", () => {
  const environment = pinnedGitChildEnvironment();
  assert.equal(Object.isFrozen(environment), true);
  assert.deepEqual(
    Object.keys(environment).sort(),
    [
      "ComSpec",
      "GIT_ATTR_NOSYSTEM",
      "GIT_CONFIG_COUNT",
      "GIT_CONFIG_GLOBAL",
      "GIT_CONFIG_NOSYSTEM",
      "GIT_CONFIG_SYSTEM",
      "GIT_FLUSH",
      "GIT_OPTIONAL_LOCKS",
      "GIT_PAGER",
      "GIT_PROTOCOL_FROM_USER",
      "GIT_TERMINAL_PROMPT",
      "LANG",
      "LC_ALL",
      "PAGER",
      "PATH",
      "PATHEXT",
      "SystemRoot",
      "TZ",
      "WINDIR",
    ].sort(),
  );
  const forbidden = [
    "NODE_OPTIONS",
    "NODE_PATH",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "NODE_EXTRA_CA_CERTS",
    "NODE_TLS_REJECT_UNAUTHORIZED",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "CURL_CA_BUNDLE",
    "GIT_SSL_CAINFO",
    "GIT_SSL_CAPATH",
    "GIT_SSL_NO_VERIFY",
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_EXEC_PATH",
    "GIT_SSH",
    "GIT_SSH_COMMAND",
    "GIT_ASKPASS",
    "GIT_CONFIG_KEY_0",
    "GIT_CONFIG_VALUE_0",
    "GIT_EXTERNAL_DIFF",
    "GIT_TRACE",
    "GIT_EDITOR",
    "GIT_SEQUENCE_EDITOR",
    "HOME",
    "USERPROFILE",
    "APPDATA",
  ];
  for (const name of forbidden) {
    assert.equal(
      Object.keys(environment).some(
        (key) => key.toLowerCase() === name.toLowerCase(),
      ),
      false,
      `${name} must not reach Git`,
    );
  }
  assert.equal(
    environment.PATH,
    String.raw`C:\Program Files\Git\mingw64\bin;C:\Windows\System32;C:\Windows`,
  );
});

test("adapter rejects command, option, config, and output injection", () => {
  const git = createPinnedGitExecFile();
  const options = { cwd: repositoryRoot, encoding: "utf8" };
  const sha = "a".repeat(40);
  assert.throws(
    () => git(approvedGitRuntime.executablePath, ["rev-parse", "HEAD"], options),
    /PINNED_GIT_LOGICAL_COMMAND_REQUIRED/u,
  );
  assert.throws(
    () => git("git", ["commit", "-m", "unsafe"], options),
    /PINNED_GIT_READ_ONLY_COMMAND_REQUIRED/u,
  );
  assert.throws(
    () => git("git", ["config", "--list"], options),
    /PINNED_GIT_READ_ONLY_COMMAND_REQUIRED/u,
  );
  assert.throws(
    () => git("git", ["diff", `--output=${join(tmpdir(), "leak")}`], options),
    /PINNED_GIT_READ_ONLY_COMMAND_REQUIRED/u,
  );
  for (const forbiddenDiff of [
    ["diff", "--name-status", "--no-renames", sha, sha, "--"],
    ["diff", "--stat", "--no-renames", sha, sha, "--"],
    ["diff", "--name-only", "-z", sha, sha, "--"],
    ["diff", "--name-only", "--no-renames", sha, sha, "--"],
    ["diff", "--no-renames", "-z", sha, sha, "--"],
    ["diff", "--name-only", "--no-renames", "-z", sha, sha, "--", "src"],
    ["diff", "--name-only", "--no-renames", "-z", sha, sha, "--stat"],
    ["diff", "--name-only", "--no-renames", "-z", "-bad", sha, "--"],
    ["diff", "--name-only", "--no-renames", "-z", "abc123", sha, "--"],
    ["diff && whoami", "--name-only", "--no-renames", "-z", sha, sha, "--"],
  ]) assert.throws(
    () => git("git", forbiddenDiff, options),
    /PINNED_GIT_READ_ONLY_COMMAND_REQUIRED/u,
  );
  assert.throws(
    () => git("git", ["show", `--output=${join(tmpdir(), "leak")}`, sha], options),
    /PINNED_GIT_READ_ONLY_COMMAND_REQUIRED/u,
  );
  assert.throws(
    () => git("git", ["ls-files", "--recurse-submodules"], options),
    /PINNED_GIT_READ_ONLY_COMMAND_REQUIRED/u,
  );
  assert.throws(
    () => git("git", [
      "-c",
      "core.fsmonitor=attacker",
      "status",
      "--porcelain=v2",
      "--untracked-files=all",
    ], options),
    /PINNED_GIT_CONFIG_INJECTION_FORBIDDEN/u,
  );
  assert.throws(
    () => git("git", ["rev-parse", "HEAD"], {
      ...options,
      env: { NODE_OPTIONS: "--require=attacker.cjs" },
    }),
    /PINNED_GIT_EXEC_OPTIONS_INVALID/u,
  );
  assert.throws(
    () => git("git", ["rev-parse", "HEAD"], {
      ...options,
      shell: true,
    }),
    /PINNED_GIT_EXEC_OPTIONS_INVALID/u,
  );
  assert.throws(
    () => git("git", ["rev-parse", "HEAD"], {
      ...options,
      timeout: 0,
    }),
    /PINNED_GIT_EXEC_OPTIONS_INVALID/u,
  );
  assert.throws(
    () => git("git", ["rev-parse", "HEAD"], {
      ...options,
      timeout: approvedGitRuntime.commandTimeoutMs + 1,
    }),
    /PINNED_GIT_EXEC_OPTIONS_INVALID/u,
  );
});

test("live inspector verifies the exact installed runtime", {
  skip:
    process.platform !== "win32"
    || !existsSync(approvedGitRuntime.executablePath),
}, () => {
  const inspection = inspectPinnedGitRuntime();
  assert.equal(inspection.version, "2.55.0.windows.2");
  assert.equal(inspection.canonicalTreeFileCount, 157);
  assert.equal(inspection.canonicalTreeTotalBytes, 96_933_069);
  assert.equal(
    inspection.canonicalTreeSha256,
    "d73b685e0f95c71c04c844bc67a70c5f32def551be1d9d1ff7d9b8a3963cae60",
  );
  assert.equal(
    inspection.executablePath,
    String.raw`C:\Program Files\Git\cmd\git.exe`,
  );
  assert.equal(inspection.versionReadTimeoutMs, 10_000);
  assert.equal(inspection.commandTimeoutMs, 30_000);
});

test("pinned adapter reads the actual canonical T to U remediation", {
  skip:
    process.platform !== "win32"
    || !existsSync(approvedGitRuntime.executablePath),
}, () => {
  const git = createPinnedGitExecFile();
  const run = (args, encoding = "utf8") => git(
    "git",
    [
      "-c",
      `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`,
      ...args,
    ],
    {
      cwd: repositoryRoot,
      encoding,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.equal(String(run(["cat-file", "-t", COMMIT_T_SHA])).trim(), "commit");
  assert.equal(String(run(["cat-file", "-t", COMMIT_U_SHA])).trim(), "commit");
  const ancestry = String(run([
    "rev-list",
    "--parents",
    "-n",
    "1",
    COMMIT_U_SHA,
  ])).trim().split(" ");
  assert.equal(assertSecurityRemediationCommitAncestry(ancestry), true);
  const paths = parseCanonicalNulGitPaths(Buffer.from(run([
    "diff",
    ...canonicalSecurityRemediationGitDiffArguments(COMMIT_T_SHA, COMMIT_U_SHA),
  ], "buffer")));
  assert.deepEqual(
    assertSecurityRemediationChangePaths(paths),
    paths,
  );
  assert.equal(
    canonicalGitPathSetSha256(paths),
    SECURITY_REMEDIATION_CHANGE_SET_SHA256,
  );
});

test("adapter ignores poisoned PATH and external-tool environment", {
  skip:
    process.platform !== "win32"
    || !existsSync(approvedGitRuntime.executablePath),
}, async (t) => {
  const poisonRoot =
    await mkdtemp(join(tmpdir(), "ludys-git-path-poison-"));
  t.after(() => rm(poisonRoot, { recursive: true, force: true }));
  const poisoned = new Map();
  const poison = {
    PATH: poisonRoot,
    NODE_OPTIONS: "--require=attacker.cjs",
    NODE_PATH: poisonRoot,
    HTTPS_PROXY: "http://attacker.invalid:8080",
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "core.fsmonitor",
    GIT_CONFIG_VALUE_0: join(poisonRoot, "fsmonitor.cmd"),
    GIT_CONFIG_KEY_1: "core.pager",
    GIT_CONFIG_VALUE_1: join(poisonRoot, "pager.cmd"),
    GIT_EXTERNAL_DIFF: join(poisonRoot, "diff.cmd"),
    GIT_PAGER: join(poisonRoot, "pager.cmd"),
  };
  for (const [name, value] of Object.entries(poison)) {
    poisoned.set(name, process.env[name]);
    process.env[name] = value;
  }
  t.after(() => {
    for (const [name, value] of poisoned) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const git = createPinnedGitExecFile();
  const head = String(git(
    "git",
    [
      "-c",
      `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`,
      "rev-parse",
      "HEAD",
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )).trim();
  assert.match(head, FULL_GIT_SHA);
});

test("all authority-consumer read forms execute through the adapter", {
  skip:
    process.platform !== "win32"
    || !existsSync(approvedGitRuntime.executablePath),
}, () => {
  const git = createPinnedGitExecFile();
  const options = {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  };
  const run = (args, overrides = {}) => git(
    "git",
    [
      "-c",
      `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`,
      ...args,
    ],
    { ...options, ...overrides },
  );
  const references = String(run(
    ["rev-parse", "HEAD", "HEAD^{tree}"],
  )).trim().split(/\r?\n/u);
  assert.equal(references.length, 2);
  const [commit, tree] = references;
  assert.match(commit, FULL_GIT_SHA);
  assert.match(tree, FULL_GIT_SHA);
  const committedBlob = String(run(
    ["rev-parse", `${commit}:package.json`],
  )).trim();
  assert.match(committedBlob, FULL_GIT_SHA);
  assert.match(
    String(run(["cat-file", "-t", commit])).trim(),
    /^commit$/u,
  );
  assert.ok(
    Buffer.from(run(
      ["cat-file", "blob", committedBlob],
      { encoding: "buffer" },
    )).byteLength > 0,
  );
  assert.ok(
    Buffer.from(run(
      ["show", `${commit}:package.json`],
      { encoding: "buffer" },
    )).byteLength > 0,
  );
  assert.equal(
    String(run(
      ["rev-parse", `${commit}^{tree}`],
    )).trim(),
    tree,
  );
  assert.match(
    String(run(
      ["rev-list", "--parents", "-n", "1", "HEAD"],
    )).trim(),
    new RegExp(`^${commit}(?: [a-f0-9]{40})*$`, "u"),
  );
  assert.equal(
    String(run(
      ["merge-base", "--is-ancestor", commit, commit],
    )),
    "",
  );
  assert.equal(
    Buffer.from(run(
      [
        "diff",
        "--name-only",
        "--no-renames",
        "-z",
         commit,
         commit,
         "--",
      ],
      { encoding: "buffer" },
    )).byteLength,
    0,
  );
  assert.equal(
    Buffer.from(run(
      ["ls-tree", "-z", "--name-only", commit, "--", "package.json"],
      { encoding: "buffer" },
    )).toString("utf8"),
    "package.json\0",
  );
  assert.ok(
    Buffer.from(run(
      [
        "ls-tree",
        "-r",
        "-z",
        "--full-tree",
        commit,
        "--",
        "src",
      ],
      { encoding: "buffer" },
    )).byteLength > 0,
  );
  assert.match(
    Buffer.from(run(
      ["ls-files", "--stage", "-z", "--", "package.json"],
      { encoding: "buffer" },
    )).toString("utf8"),
    /^100644 [a-f0-9]{40} 0\tpackage\.json\0$/u,
  );
  assert.match(
    String(run(
      ["hash-object", "--no-filters", "--", "package.json"],
    )).trim(),
    FULL_GIT_SHA,
  );
  assert.doesNotThrow(() => run(
    ["status", "--porcelain=v2", "--untracked-files=all"],
  ));
  assert.doesNotThrow(() => run(
    [
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "-z",
      "--",
      "provider/vercel/wp13-12b-preview",
    ],
    { encoding: "buffer" },
  ));
});

test("hardened adapter suppresses local external diff execution", {
  skip:
    process.platform !== "win32"
    || !existsSync(approvedGitRuntime.executablePath),
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ludys-git-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const environment = pinnedGitChildEnvironment();
  const rawGit = (args) => String(execFileSync(
    approvedGitRuntime.executablePath,
    args,
    {
      cwd: root,
      encoding: "utf8",
      env: environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )).trim();
  rawGit(["init", "--quiet"]);
  rawGit(["config", "user.email", "pinned-git-test@example.invalid"]);
  rawGit(["config", "user.name", "Pinned Git Test"]);
  await writeFile(join(root, "tracked.txt"), "first\n");
  rawGit(["add", "--", "tracked.txt"]);
  rawGit(["commit", "--quiet", "-m", "first"]);
  const first = rawGit(["rev-parse", "HEAD"]);
  await writeFile(join(root, "tracked.txt"), "second\n");
  rawGit(["add", "--", "tracked.txt"]);
  rawGit(["commit", "--quiet", "-m", "second"]);
  const second = rawGit(["rev-parse", "HEAD"]);
  const marker = join(root, "external-diff-ran.txt");
  const externalDiff = join(root, "external-diff.cmd");
  await writeFile(
    externalDiff,
    `@echo off\r\n> "${marker}" echo invoked\r\nexit /b 0\r\n`,
  );
  rawGit(["config", "diff.external", externalDiff]);
  const git = createPinnedGitExecFile();
  const changed = Buffer.from(git(
    "git",
    [
      "-c",
      `safe.directory=${root.replaceAll("\\", "/")}`,
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
       first,
       second,
       "--",
    ],
    {
      cwd: root,
      encoding: "buffer",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )).toString("utf8");
  assert.equal(changed, "tracked.txt\0");
  assert.equal(existsSync(marker), false);
});
