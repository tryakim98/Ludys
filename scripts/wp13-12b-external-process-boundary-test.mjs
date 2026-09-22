import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  approvedGoogleCloudCli,
  assertNoDangerousExternalEnvironment,
  assertNoDangerousExternalEnvironmentForTesting,
  canonicalGoogleCloudCliTreeSnapshot,
  createGoogleCloudCliReattestingAdapterForTesting,
  createPinnedGoogleCloudCliExecFile,
  sanitizedNodeChildEnvironmentForTesting,
  validateGoogleCloudCliArgumentsForTesting,
} from "./wp13-12b-external-process-boundary.mjs";

const validGoogleOAuth = Object.freeze({
  accessToken: "test-only-access-token-0123456789",
  approvedGoogleAccount: "tryakim@gmail.com",
  firebaseToolsVersion: "15.22.4",
  tokenPrinted: false,
});
const liveGoogleCloudCliTestEnabled =
  process.env.LUDYS_RUN_PINNED_GCLOUD_INTEGRATION === "1";
const googleCloudConfigDirectoryPrefix =
  "ludys-wp13-12b-gcloud-config-";
const approvedWindowsTemp =
  "C:\\Users\\tryak\\AppData\\Local\\Temp";

function observedGoogleCloudConfigDirectories() {
  return readdirSync(approvedWindowsTemp, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory()
        && entry.name.startsWith(googleCloudConfigDirectoryPrefix),
    )
    .map((entry) => entry.name)
    .sort();
}

test("external process boundary rejects preload, proxy, TLS and credential overrides", () => {
  for (const [name, value] of [
    ["NODE_OPTIONS", "--require=C:\\attacker\\preload.cjs"],
    ["node_path", "C:\\attacker\\modules"],
    ["HTTPS_PROXY", "http://attacker.invalid:8080"],
    ["NODE_TLS_REJECT_UNAUTHORIZED", "0"],
    ["SSL_CERT_FILE", "C:\\attacker\\ca.pem"],
    ["GOOGLE_APPLICATION_CREDENTIALS", "C:\\attacker\\key.json"],
    ["CLOUDSDK_CONFIG", "C:\\attacker\\gcloud"],
    ["VERCEL_TOKEN", "attacker-token"],
    ["GIT_EXEC_PATH", "C:\\attacker\\git-core"],
    ["LUDYS_GCLOUD_BIN", "C:\\attacker\\gcloud.exe"],
    ["LUDYS_FIREBASE_CLI_LIB", "C:\\attacker\\firebase"],
    ["LUDYS_VERCEL_MODULE_ROOT", "C:\\attacker\\vercel"],
  ]) {
    assert.throws(
      () => assertNoDangerousExternalEnvironmentForTesting({
        [name]: value,
      }),
      /EXTERNAL_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN/u,
      name,
    );
  }
});

test("only the exact Codex safe.directory Git config triad is accepted and dropped", () => {
  const repositoryRoot =
    "C:\\Users\\tryak\\Downloads\\"
    + "LUDYS_CODEX_PARALLEL_WP13_7A_2026-07-16\\"
    + "ludys-wp13-7a-codex";
  const exactTriad = {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "safe.directory",
    GIT_CONFIG_VALUE_0: repositoryRoot,
    GIT_PAGER: "more.com",
  };
  assert.equal(
    assertNoDangerousExternalEnvironmentForTesting(exactTriad),
    true,
  );
  const child = sanitizedNodeChildEnvironmentForTesting(exactTriad);
  assert.equal(child.GIT_CONFIG_COUNT, undefined);
  assert.equal(child.GIT_CONFIG_KEY_0, undefined);
  assert.equal(child.GIT_CONFIG_VALUE_0, undefined);
  assert.equal(child.GIT_PAGER, undefined);
  for (const environment of [
    { GIT_CONFIG_COUNT: "1" },
    { ...exactTriad, GIT_CONFIG_COUNT: "2" },
    { ...exactTriad, GIT_CONFIG_KEY_0: "include.path" },
    { ...exactTriad, GIT_CONFIG_VALUE_0: "C:\\attacker" },
    {
      ...exactTriad,
      GIT_CONFIG_KEY_1: "alias.pwn",
      GIT_CONFIG_VALUE_1: "!calc.exe",
    },
  ]) {
    assert.throws(
      () => assertNoDangerousExternalEnvironmentForTesting(
        environment,
      ),
      /EXTERNAL_PROCESS_GIT_CONFIG_OVERRIDE_FORBIDDEN/u,
    );
  }
});

test("sanitized Node child environment ignores ambient PATH and preserves only named application inputs", () => {
  const environment = sanitizedNodeChildEnvironmentForTesting({
    Path: "C:\\attacker",
    LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH: "C:\\approved\\receipt.json",
    UNRELATED_SECRET: "must-not-pass",
  }, {
    preserveKeys: ["LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH"],
  });
  assert.notEqual(environment.Path, "C:\\attacker");
  assert.equal(
    environment.LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH,
    "C:\\approved\\receipt.json",
  );
  assert.equal(environment.UNRELATED_SECRET, undefined);
  assert.equal(environment.NODE_OPTIONS, undefined);
  assert.equal(environment.NODE_PATH, undefined);
  assert.equal(environment.CI, "1");
});

test("Google Cloud CLI contract binds the official archive and audited extracted tree", () => {
  assert.equal(approvedGoogleCloudCli.version, "577.0.0");
  assert.equal(
    approvedGoogleCloudCli.archiveUrl,
    "https://storage.googleapis.com/cloud-sdk-release/"
      + "google-cloud-sdk-577.0.0-windows-x86_64-bundled-python.zip",
  );
  assert.equal(approvedGoogleCloudCli.archiveBytes, 110_769_066);
  assert.equal(
    approvedGoogleCloudCli.archiveSha256,
    "dcf9097b2c7a0a29bd6322571f5090c6046bed96b19c0750e62f549b735b80eb",
  );
  assert.equal(
    approvedGoogleCloudCli.canonicalTreeAlgorithm,
    "SORTED_RELATIVE_PATH_CODE_UNIT_NUL_SIZE_NUL_SHA256_LF_V1",
  );
  assert.equal(approvedGoogleCloudCli.canonicalTreeFileCount, 29_931);
  assert.equal(approvedGoogleCloudCli.canonicalTreeBytes, 459_287_508);
  assert.equal(
    approvedGoogleCloudCli.canonicalTreeSha256,
    "da1f9c6799bb76a3bae3e59bd138b68ef4954dbc396306357c5babf46c34423d",
  );
  assert.deepEqual(
    approvedGoogleCloudCli.pythonFlags,
    ["-I", "-S", "-B"],
  );
  assert.equal(
    approvedGoogleCloudCli.extractionNormalization
      .sourceSymlinkModeEntryCount,
    6,
  );
  assert.equal(
    approvedGoogleCloudCli.extractionNormalization
      .materializedRegularFileCount,
    6,
  );
  assert.equal(
    approvedGoogleCloudCli.extractionNormalization.entries.length,
    6,
  );
  assert.throws(
    () => assertNoDangerousExternalEnvironmentForTesting({
        NODE_OPTIONS: "--require=C:\\attacker\\preload.cjs",
        Path: "C:\\attacker\\fake-gcloud",
    }),
    /EXTERNAL_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN/u,
  );
  if (process.execArgv.length === 0) {
    assert.throws(
      () => createPinnedGoogleCloudCliExecFile({
        environment: {},
        googleOAuth: Object.freeze({
          ...validGoogleOAuth,
          tokenPrinted: true,
        }),
      }),
      /PINNED_GOOGLE_CLOUD_CLI_OAUTH_HELPER_RESPONSE_INVALID/u,
    );
  } else {
    assert.throws(
      () => assertNoDangerousExternalEnvironment({}),
      /EXTERNAL_PROCESS_EXEC_ARGV_FORBIDDEN/u,
    );
  }
});

test("Google Cloud CLI tree snapshots bind every regular file byte", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ludys-gcloud-tree-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "bin"), { recursive: true });
  await writeFile(join(root, "bin", "gcloud.cmd"), "@echo off\r\n");
  await writeFile(join(root, "VERSION"), "577.0.0\n");
  const before = canonicalGoogleCloudCliTreeSnapshot(root);
  await writeFile(join(root, "VERSION"), "577.0.1\n");
  const after = canonicalGoogleCloudCliTreeSnapshot(root);
  assert.equal(before.fileCount, 2);
  assert.equal(after.fileCount, 2);
  assert.notEqual(after.sha256, before.sha256);
});

test("Google Cloud CLI adapter fully re-attests its tree before every invocation", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ludys-gcloud-reattest-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "bin"), { recursive: true });
  await writeFile(join(root, "bin", "gcloud.cmd"), "@echo off\r\n");
  await writeFile(join(root, "VERSION"), "577.0.0\n");
  const approved = canonicalGoogleCloudCliTreeSnapshot(root);
  let inspections = 0;
  let executions = 0;
  const adapter = createGoogleCloudCliReattestingAdapterForTesting(
    () => {
      inspections += 1;
      const observed = canonicalGoogleCloudCliTreeSnapshot(root);
      if (
        observed.fileCount !== approved.fileCount
        || observed.totalBytes !== approved.totalBytes
        || observed.sha256 !== approved.sha256
      ) {
        throw new Error("PINNED_GOOGLE_CLOUD_CLI_TREE_MISMATCH");
      }
      return observed;
    },
    (observed, value) => {
      executions += 1;
      assert.equal(observed.sha256, approved.sha256);
      return value;
    },
  );
  assert.equal(adapter("first"), "first");
  assert.equal(inspections, 1);
  assert.equal(executions, 1);
  await writeFile(join(root, "VERSION"), "577.0.1\n");
  assert.throws(
    () => adapter("second"),
    /PINNED_GOOGLE_CLOUD_CLI_TREE_MISMATCH/u,
  );
  assert.equal(inspections, 2);
  assert.equal(executions, 1);
});

test("gcloud scope flags accept only exact account, project and deploy identity in split or equals form", () => {
  assert.equal(validateGoogleCloudCliArgumentsForTesting([
    "projects",
    "describe",
    "ludys-12b-stg-20260725",
    "--project=ludys-12b-stg-20260725",
    "--account",
    "tryakim@gmail.com",
    "--billing-project=ludys-12b-stg-20260725",
    "--quota-project",
    "ludys-12b-stg-20260725",
    "--impersonate-service-account="
      + "ludys-staging-deployer@ludys-12b-stg-20260725"
      + ".iam.gserviceaccount.com",
  ]), true);
  for (const args of [
    ["projects", "list", "--project=attacker"],
    ["projects", "list", "--project", "attacker"],
    ["projects", "list", "--projectx=ludys-12b-stg-20260725"],
    ["projects", "list", "--account=TRYAKIM@gmail.com"],
    ["projects", "list", "--billing-project=attacker"],
    ["projects", "list", "--billing-project", "attacker"],
    ["projects", "list", "--quota-project=attacker"],
    ["projects", "list", "--quota-project", "attacker"],
    [
      "projects",
      "list",
      "--project=ludys-12b-stg-20260725",
      "--project",
      "ludys-12b-stg-20260725",
    ],
    [
      "projects",
      "list",
      "--impersonate-service-account=attacker@example.invalid",
    ],
  ]) {
    assert.throws(
      () => validateGoogleCloudCliArgumentsForTesting(args),
      /PINNED_GOOGLE_CLOUD_CLI_SCOPE_(?:FLAG_INVALID|OVERRIDE_FORBIDDEN)/u,
    );
  }
});

test("gcloud boundary blocks indirect flags, arbitrary configurations and credential output commands", () => {
  for (const args of [
    ["projects", "describe", "ludys-12b-stg-20260725", "--flags-file", "payload.yaml"],
    ["projects", "describe", "ludys-12b-stg-20260725", "--flags-file=payload.yaml"],
    ["projects", "describe", "ludys-12b-stg-20260725", "--configuration", "attacker"],
    ["projects", "describe", "ludys-12b-stg-20260725", "--configuration=attacker"],
  ]) {
    assert.throws(
      () => validateGoogleCloudCliArgumentsForTesting(args),
      /PINNED_GOOGLE_CLOUD_CLI_CREDENTIAL_ARGUMENT_FORBIDDEN/u,
    );
  }

  for (const args of [
    ["auth", "print-identity-token"],
    ["auth", "--quiet", "print-identity-token"],
    ["auth", "application-default", "print-access-token"],
    ["auth", "application-default", "print-identity-token"],
  ]) {
    assert.throws(
      () => validateGoogleCloudCliArgumentsForTesting(args),
      /PINNED_GOOGLE_CLOUD_CLI_(?:ACCESS|IDENTITY)_TOKEN_OUTPUT_FORBIDDEN/u,
    );
  }

  for (const args of [
    ["secrets", "versions", "access", "latest", "--secret", "blocked"],
    ["sec", "ver", "acc", "latest", "--secret", "blocked"],
    ["iam", "service-accounts", "sign-blob", "input", "output"],
    ["iam", "service-accounts", "sign-jwt", "input", "output"],
  ]) {
    assert.throws(
      () => validateGoogleCloudCliArgumentsForTesting(args),
      /PINNED_GOOGLE_CLOUD_CLI_CREDENTIAL_OUTPUT_FORBIDDEN/u,
    );
  }
});

test("live pinned Google Cloud CLI uses Python isolation and always cleans its owned config", {
  skip: !liveGoogleCloudCliTestEnabled,
  timeout: 10 * 60 * 1000,
}, () => {
  const before = observedGoogleCloudConfigDirectories();
  const execFile = createPinnedGoogleCloudCliExecFile({
    environment: process.env,
    googleOAuth: validGoogleOAuth,
  });
  const assertConfigClean = () => assert.deepEqual(
    observedGoogleCloudConfigDirectories(),
    before,
  );

  const output = String(execFile("gcloud", [
    "version",
    "--format=json",
  ], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  }));
  assert.equal(JSON.parse(output)["Google Cloud SDK"], "577.0.0");
  assert.equal(output.includes(validGoogleOAuth.accessToken), false);
  assertConfigClean();

  assert.throws(
    () => execFile("gcloud", [
      "version",
      validGoogleOAuth.accessToken,
    ]),
    /PINNED_GOOGLE_CLOUD_CLI_ARGUMENTS_INVALID/u,
  );
  assert.throws(
    () => execFile("gcloud", ["auth", "print-access-token"]),
    /PINNED_GOOGLE_CLOUD_CLI_ACCESS_TOKEN_OUTPUT_FORBIDDEN/u,
  );
  assert.throws(
    () => execFile("gcloud", [
      "--project",
      "attacker-project",
      "auth",
      "login",
    ]),
    /PINNED_GOOGLE_CLOUD_CLI_AUTH_OR_CONFIG_MUTATION_FORBIDDEN/u,
  );
  assertConfigClean();

  assert.throws(
    () => execFile("gcloud", ["not-a-real-command"], {
      encoding: "utf8",
    }),
    /PINNED_GOOGLE_CLOUD_CLI_EXECUTION_FAILED/u,
  );
  assertConfigClean();
  assert.throws(
    () => execFile("gcloud", ["version"], {
      encoding: "utf8",
      timeout: 1,
    }),
    /PINNED_GOOGLE_CLOUD_CLI_EXECUTION_FAILED/u,
  );
  assertConfigClean();
});
