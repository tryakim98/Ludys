import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import test, { after } from "node:test";
import {
  deployIdentityMutationCommands,
  externalControlTestArgvForTesting,
  externalControlTestScope,
  runDeployIdentityControl,
  runDeployIdentityControlForTesting as runDeployIdentityControlForTestingRaw,
  syntheticDeletionIdentityAddCommands,
} from "./provider-external-deploy-identity-control.mjs";
import {
  deploymentMemoryBytes,
  deploymentCommands,
  memoryQuantityBytes,
  runExternalDeploy,
  runExternalDeployForTesting as runExternalDeployForTestingRaw,
  simulateImpersonatedDeployAccessTokenForTesting,
  validateProviderPackageSnapshotForTesting,
} from "./provider-external-function-deploy.mjs";
import {
  assertDeployWindow,
  assertSyntheticDeletionWindow,
  canonicalPreviewOrigin,
  deployDeletionRunServiceScope,
  deployIdentityAuthorityStates,
  deployIdentityScope,
  deployProjectRoles,
  deployResourcePolicyScopes,
  deployRunServicePolicyScopes,
  deploymentImpersonationFlag,
  deployWindowCondition,
  normalizedDeployParentScopeEvidence,
  SYNTHETIC_DELETION_GRACE_END,
  syntheticDeletionWindowCondition,
  validateDeployIdentityReadback,
} from "./wp13-12b-deploy-identity.mjs";
import {
  assertExactProviderRuntimeImportClosure,
  expectedFunctionsGcloudIgnore,
  providerIgnoredAuthoringFilePaths,
  providerPackageArtifactPath,
  providerPackageFilePaths,
  providerPackageFileScope,
  providerPackageSchemaVersion,
  providerSourceDigest,
} from "./wp13-12b-provider-package-contract.mjs";

const now = new Date("2026-07-27T12:00:00.000Z");
const windowExpiresAt = "2026-07-27T12:30:00.000Z";
const syntheticDeletionNow =
  new Date("2027-01-25T00:10:00.000Z");
const syntheticDeletionWindowExpiresAt =
  "2027-01-25T00:30:00.000Z";
const previewOrigin =
  "https://ludys-wp13-12b-staging-a1b2c3-trym-s-projects.vercel.app";

function runDeployIdentityControlForTesting(argv, options) {
  return runDeployIdentityControlForTestingRaw(
    externalControlTestArgvForTesting(argv),
    options,
  );
}

function runExternalDeployForTesting(argv, options) {
  return runExternalDeployForTestingRaw(
    externalControlTestArgvForTesting(argv),
    options,
  );
}

function productionEquivalentTestArgs(args) {
  const testArgs = externalControlTestArgvForTesting([
    deployIdentityScope.deployServiceAccount,
    deployIdentityScope.approvedGoogleAccount,
    deployIdentityScope.organizationId,
    deployIdentityScope.projectNumber,
    deployIdentityScope.projectId,
    deployIdentityScope.region,
  ]);
  const productionArgs = [
    deployIdentityScope.deployServiceAccount,
    deployIdentityScope.approvedGoogleAccount,
    deployIdentityScope.organizationId,
    deployIdentityScope.projectNumber,
    deployIdentityScope.projectId,
    deployIdentityScope.region,
  ];
  return args.map((value) => testArgs.reduce(
    (result, testValue, index) =>
      result.replaceAll(testValue, productionArgs[index]),
    value,
  ));
}
const dummySourceBindingFlags = [
  "--source-commit", "a".repeat(40),
  "--source-tree", "b".repeat(40),
  "--source-sha256", "c".repeat(64),
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(repositoryRoot, args) {
  return String(execFileSync("git", [
    "-c",
    `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`,
    ...args,
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  })).trim();
}

async function writeFixtureFile(repositoryRoot, path, content) {
  const target = join(repositoryRoot, ...path.split("/"));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

function fixtureRuntimeSources() {
  return new Map([
    [
      "provider/firebase/functions/index.mjs",
      [
        "import { handler } from \"./lib/provider/firebase/functions/src/authoritative-handler.js\";",
        "import { store } from \"./firestore-store.mjs\";",
        "export { handler, store };",
        "",
      ].join("\n"),
    ],
    [
      "provider/firebase/functions/firestore-store.mjs",
      "export const store = Object.freeze({ kind: \"firestore\" });\n",
    ],
    [
      "provider/firebase/functions/lib/provider/firebase/functions/src/authoritative-handler.js",
      [
        "import { staging } from \"../../../../src/core/synthetic-staging.js\";",
        "export const handler = staging;",
        "",
      ].join("\n"),
    ],
    [
      "provider/firebase/functions/lib/src/core/synthetic-staging.js",
      [
        "import { lifecycle } from \"./session-lifecycle.js\";",
        "import { reliability } from \"./reliability-hardening.js\";",
        "export const staging = Object.freeze({ lifecycle, reliability });",
        "",
      ].join("\n"),
    ],
    [
      "provider/firebase/functions/lib/src/core/reliability-hardening.js",
      [
        "import { lifecycle } from \"./session-lifecycle.js\";",
        "import { state } from \"./state.js\";",
        "export const reliability = Object.freeze({ lifecycle, state });",
        "",
      ].join("\n"),
    ],
    [
      "provider/firebase/functions/lib/src/core/session-lifecycle.js",
      "export const lifecycle = \"WAIT_FIRST_CLASS\";\n",
    ],
    [
      "provider/firebase/functions/lib/src/core/state.js",
      [
        "import { evidence } from \"./evidence.js\";",
        "export const state = Object.freeze({ evidence });",
        "",
      ].join("\n"),
    ],
    [
      "provider/firebase/functions/lib/src/core/evidence.js",
      "export const evidence = \"SYNTHETIC_ONLY\";\n",
    ],
  ]);
}

async function createProviderSourceFixture() {
  const repositoryRoot = await mkdtemp(
    join(tmpdir(), "ludys-provider-source-binding-"),
  );
  const runtimeSources = fixtureRuntimeSources();
  const contents = new Map([
    ...runtimeSources,
    [
      "provider/firebase/firestore.indexes.json",
      "{\"indexes\":[],\"fieldOverrides\":[]}\n",
    ],
    [
      "provider/firebase/firestore.rules",
      [
        "rules_version = '2';",
        "service cloud.firestore {",
        "  match /databases/{database}/documents {",
        "    match /{document=**} {",
        "      allow read, write: if false;",
        "    }",
        "  }",
        "}",
        "",
      ].join("\n"),
    ],
    [
      "provider/firebase/functions/.gcloudignore",
      expectedFunctionsGcloudIgnore,
    ],
    [
      "provider/firebase/functions/functions.yaml",
      "specVersion: v1alpha1\n",
    ],
    [
      "provider/firebase/functions/package.json",
      "{\"name\":\"fixture\",\"private\":true,\"type\":\"module\"}\n",
    ],
    [
      "provider/firebase/functions/package-lock.json",
      "{\"lockfileVersion\":3,\"packages\":{}}\n",
    ],
    ...providerIgnoredAuthoringFilePaths.map((path) => [
      path,
      path.endsWith(".ts")
        ? "export const authoringOnly = true;\n"
        : "export {};\n",
    ]),
  ]);
  for (const [path, content] of contents) {
    await writeFixtureFile(repositoryRoot, path, content);
  }
  const files = [];
  for (const path of providerPackageFilePaths) {
    const bytes = Buffer.from(contents.get(path), "utf8");
    files.push({ path, sha256: sha256(bytes), bytes: bytes.byteLength });
  }
  const manifest = {
    schemaVersion: providerPackageSchemaVersion,
    status: "LOCAL_DEPLOYABLE_PACKAGE_GENERATED_NOT_DEPLOYED",
    sourceCommit: "PENDING_FINAL_COMMIT_NOT_A_RECEIPT",
    stagingProviderReleaseId: "wp13-12b-synthetic-staging-provider-r1",
    functionsRuntime: "nodejs24",
    region: "europe-north1",
    providerActivation: "BLOCKED",
    cloudResources: 0,
    sourceRoot: "provider/firebase/functions",
    fileScope: providerPackageFileScope,
    fileCount: files.length,
    functionsSourceSha256: providerSourceDigest(files),
    files,
  };
  await writeFixtureFile(
    repositoryRoot,
    providerPackageArtifactPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  git(repositoryRoot, ["init"]);
  git(repositoryRoot, ["config", "user.name", "LUDYS test"]);
  git(repositoryRoot, ["config", "user.email", "ludys-test@example.invalid"]);
  git(repositoryRoot, ["add", "."]);
  git(repositoryRoot, ["commit", "-m", "provider source fixture"]);
  const snapshot = await validateProviderPackageSnapshotForTesting({
    repositoryRoot,
  });
  return Object.freeze({
    repositoryRoot,
    snapshot,
    sourceBindingFlags: Object.freeze([
      "--source-commit", snapshot.commit,
      "--source-tree", snapshot.tree,
      "--source-sha256", snapshot.functionsSourceSha256,
    ]),
  });
}

async function removeFixture(fixture) {
  const absolute = resolve(fixture.repositoryRoot);
  const temporaryRoot = resolve(tmpdir());
  assert.ok(
    absolute.startsWith(`${temporaryRoot}${process.platform === "win32" ? "\\" : "/"}`),
  );
  await rm(absolute, { recursive: true, force: true });
}

const providerSourceFixture = await createProviderSourceFixture();
after(() => removeFixture(providerSourceFixture));

function deployTestOptions(fake, overrides = {}) {
  return {
    acquireImpersonatedAccessTokenImpl: async () =>
      Object.freeze({
        accessToken:
          "ya29.synthetic-short-lived-token-never-returned",
        expireTime: "2026-07-27T12:15:00.000Z",
        serviceAccount:
          deployIdentityScope.deployServiceAccount,
        scope:
          "https://www.googleapis.com/auth/cloud-platform",
        tokenPrinted: false,
        tokenPersisted: false,
      }),
    assertMutationAuthority: () => undefined,
    environment: {},
    fetchImpl: async () => {
      throw new Error("TEST_FETCH_MUST_NOT_RUN");
    },
    now: () => now,
    providerExecFileImpl: fake.execFileImpl,
    repositoryRoot: providerSourceFixture.repositoryRoot,
    ...overrides,
  };
}

function binding(role, member, condition) {
  return {
    role,
    members: [member],
    condition: { ...condition },
  };
}

function scopeSecurityReadback() {
  return {
    parentScope: {
      projectId: deployIdentityScope.projectId,
      projectNumber: deployIdentityScope.projectNumber,
      projectParent: `organizations/${deployIdentityScope.organizationId}`,
      organizationId: deployIdentityScope.organizationId,
      directOrganizationParent: true,
      folderAncestors: [],
      lifecycleState: "ACTIVE",
    },
    organizationIamPolicyReadbackPerformed: true,
    organizationIamPolicy: { version: 3, etag: "synthetic", bindings: [] },
    resourcePolicyReadbackPerformed: true,
    resourcePolicyScopes: deployResourcePolicyScopes,
    artifactRepositoryPolicy: {
      bindings: [{
        role: "roles/artifactregistry.writer",
        members: [
          `serviceAccount:${deployIdentityScope.buildServiceAccount}`,
        ],
      }],
    },
    sourceBucketPolicy: {
      bindings: [{
        role: "roles/storage.objectViewer",
        members: [
          `serviceAccount:${deployIdentityScope.buildServiceAccount}`,
        ],
      }],
    },
    capabilitySecretPolicy: {
      bindings: [{
        role: "roles/secretmanager.secretAccessor",
        members: [
          `serviceAccount:${deployIdentityScope.runtimeServiceAccount}`,
        ],
      }],
    },
  };
}

function readyReadback() {
  const condition = deployWindowCondition(windowExpiresAt);
  const deployMember = `serviceAccount:${deployIdentityScope.deployServiceAccount}`;
  return {
    ...scopeSecurityReadback(),
    deployServiceAccount: {
      email: deployIdentityScope.deployServiceAccount,
      disabled: false,
      userManagedKeys: [],
    },
    projectPolicy: {
      bindings: deployProjectRoles.map((role) => binding(
        role,
        deployMember,
        condition,
      )),
    },
    deployServiceAccountPolicy: {
      bindings: [binding(
        "roles/iam.serviceAccountTokenCreator",
        deployIdentityScope.operatorMember,
        condition,
      )],
    },
    runtimeServiceAccountPolicy: {
      bindings: [binding(
        "roles/iam.serviceAccountUser",
        deployMember,
        condition,
      )],
    },
    buildServiceAccountPolicy: {
      bindings: [binding(
        "roles/iam.serviceAccountUser",
        deployMember,
        condition,
      )],
    },
  };
}

function revokedReadback() {
  return {
    ...scopeSecurityReadback(),
    deployServiceAccount: {
      email: deployIdentityScope.deployServiceAccount,
      disabled: false,
      userManagedKeys: [],
    },
    projectPolicy: { bindings: [] },
    deployServiceAccountPolicy: { bindings: [] },
    runtimeServiceAccountPolicy: { bindings: [] },
    buildServiceAccountPolicy: { bindings: [] },
  };
}

function runServicePoliciesReadback({
  deletionBindingPresent = false,
} = {}) {
  const condition =
    syntheticDeletionWindowCondition(syntheticDeletionWindowExpiresAt);
  return {
    runServicePoliciesReadbackPerformed: true,
    runServicePolicyScopes: [...deployRunServicePolicyScopes],
    runServicePolicies: deployRunServicePolicyScopes.map((serviceName) => ({
      serviceName,
      policy: {
        bindings: (
          deletionBindingPresent
          && serviceName === deployDeletionRunServiceScope.resource
        )
          ? [binding(
              "roles/run.invoker",
              `serviceAccount:${deployIdentityScope.deployServiceAccount}`,
              condition,
            )]
          : [],
      },
    })),
  };
}

function deletionOnlyReadback() {
  const condition =
    syntheticDeletionWindowCondition(syntheticDeletionWindowExpiresAt);
  return {
    ...revokedReadback(),
    ...runServicePoliciesReadback({ deletionBindingPresent: true }),
    deployServiceAccountPolicy: {
      bindings: [binding(
        "roles/iam.serviceAccountTokenCreator",
        deployIdentityScope.operatorMember,
        condition,
      )],
    },
  };
}

function deletionIdentityRevokedReadback() {
  return {
    ...revokedReadback(),
    ...runServicePoliciesReadback(),
  };
}

function json(value) {
  return JSON.stringify(value);
}

function functionDescriptionFromDeployArgs(name, deployArgs) {
  const envFlag = deployArgs.find((value) => (
    value.startsWith("--set-env-vars=")
    || value.startsWith("--update-env-vars=")
  ));
  assert.ok(envFlag);
  const environmentVariables = Object.fromEntries(
    envFlag.slice(envFlag.indexOf("=") + 1)
      .split(",")
      .map((entry) => {
        const separator = entry.indexOf("=");
        return [entry.slice(0, separator), entry.slice(separator + 1)];
      }),
  );
  return {
    name:
      `projects/${deployIdentityScope.projectId}/locations/`
      + `${deployIdentityScope.region}/functions/${name}`,
    state: "ACTIVE",
    environment: "GEN_2",
    buildConfig: {
      runtime: "nodejs24",
      entryPoint: name,
    },
    serviceConfig: {
      service:
        `projects/${deployIdentityScope.projectId}/locations/`
        + `${deployIdentityScope.region}/services/${name.toLowerCase()}`,
      serviceAccountEmail: deployIdentityScope.runtimeServiceAccount,
      minInstanceCount: 0,
      maxInstanceCount: 1,
      maxInstanceRequestConcurrency: 1,
      availableMemory: "256Mi",
      timeoutSeconds: 60,
      ingressSettings: "ALLOW_ALL",
      allTrafficOnLatestRevision: true,
      environmentVariables,
      secretEnvironmentVariables: [{
        key: "LUDYS_CAPABILITY_HMAC_KEY",
        projectId: deployIdentityScope.projectNumber,
        secret: "LUDYS_CAPABILITY_HMAC_KEY",
        version: "1",
      }],
    },
  };
}

function scopePolicyResponse(args, snapshot) {
  if (args[0] === "organizations" && args[1] === "get-iam-policy") {
    return json(snapshot.organizationIamPolicy);
  }
  if (
    args[0] === "artifacts"
    && args[1] === "repositories"
    && args[2] === "get-iam-policy"
  ) return json(snapshot.artifactRepositoryPolicy);
  if (
    args[0] === "storage"
    && args[1] === "buckets"
    && args[2] === "get-iam-policy"
  ) return json(snapshot.sourceBucketPolicy);
  if (args[0] === "secrets" && args[1] === "get-iam-policy") {
    return json(snapshot.capabilitySecretPolicy);
  }
  return undefined;
}

function fakeGcloud(snapshot = readyReadback(), {
  alterFunctionDescription,
} = {}) {
  const calls = [];
  const deployArgsByFunction = new Map();
  const execFileImpl = (file, args) => {
    args = productionEquivalentTestArgs(args);
    assert.equal(file, "gcloud");
    calls.push([...args]);
    if (args[0] === "auth" && args[1] === "list") {
      return deployIdentityScope.approvedGoogleAccount;
    }
    if (args[0] === "auth" && args[1] === "print-access-token") {
      assert.ok(args.includes(deploymentImpersonationFlag));
      return "ya29.synthetic-short-lived-token-never-returned";
    }
    if (args[0] === "projects" && args[1] === "describe") {
      return json({
        projectId: deployIdentityScope.projectId,
        projectNumber: deployIdentityScope.projectNumber,
        parent: {
          type: "organization",
          id: deployIdentityScope.organizationId,
        },
        lifecycleState: "ACTIVE",
      });
    }
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "list"
    ) {
      return json([{
        email: deployIdentityScope.deployServiceAccount,
        disabled: false,
      }]);
    }
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "keys"
    ) return "[]";
    if (args[0] === "projects" && args[1] === "get-iam-policy") {
      return json(snapshot.projectPolicy);
    }
    const scopePolicy = scopePolicyResponse(args, snapshot);
    if (scopePolicy !== undefined) return scopePolicy;
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "get-iam-policy"
    ) {
      const target = args[3];
      if (target === deployIdentityScope.deployServiceAccount) {
        return json(snapshot.deployServiceAccountPolicy);
      }
      if (target === deployIdentityScope.runtimeServiceAccount) {
        return json(snapshot.runtimeServiceAccountPolicy);
      }
      if (target === deployIdentityScope.buildServiceAccount) {
        return json(snapshot.buildServiceAccountPolicy);
      }
    }
    if (args[0] === "functions" && args[1] === "deploy") {
      deployArgsByFunction.set(args[2], [...args]);
      return json({ operation: `deploy-${args[2]}` });
    }
    if (args[0] === "functions" && args[1] === "describe") {
      const name = args[2];
      assert.ok(args.includes("--gen2"));
      assert.ok(args.includes("--format=json"));
      assert.ok(args.includes(deploymentImpersonationFlag));
      const deployArgs = deployArgsByFunction.get(name);
      assert.ok(deployArgs, `describe before deploy: ${name}`);
      const description = functionDescriptionFromDeployArgs(name, deployArgs);
      return json(typeof alterFunctionDescription === "function"
        ? alterFunctionDescription(structuredClone(description), name)
        : description);
    }
    throw new Error(`UNEXPECTED_GCLOUD_CALL:${args.join(" ")}`);
  };
  return { calls, execFileImpl };
}

function identityTransitionGcloud(initial, final, expectedMutations) {
  const calls = [];
  let mutations = 0;
  const execFileImpl = (file, args) => {
    args = productionEquivalentTestArgs(args);
    assert.equal(file, "gcloud");
    calls.push([...args]);
    if (
      args.includes("add-iam-policy-binding")
      || args.includes("remove-iam-policy-binding")
    ) {
      mutations += 1;
      return "{}";
    }
    const snapshot = mutations >= expectedMutations ? final : initial;
    if (args[0] === "auth" && args[1] === "list") {
      return deployIdentityScope.approvedGoogleAccount;
    }
    if (args[0] === "projects" && args[1] === "describe") {
      return json({
        projectId: deployIdentityScope.projectId,
        projectNumber: deployIdentityScope.projectNumber,
        parent: {
          type: "organization",
          id: deployIdentityScope.organizationId,
        },
        lifecycleState: "ACTIVE",
      });
    }
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "list"
    ) return json([{ email: deployIdentityScope.deployServiceAccount }]);
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "keys"
    ) return "[]";
    if (args[0] === "projects" && args[1] === "get-iam-policy") {
      return json(snapshot.projectPolicy);
    }
    const scopePolicy = scopePolicyResponse(args, snapshot);
    if (scopePolicy !== undefined) return scopePolicy;
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "get-iam-policy"
    ) {
      const target = args[3];
      if (target === deployIdentityScope.deployServiceAccount) {
        return json(snapshot.deployServiceAccountPolicy);
      }
      if (target === deployIdentityScope.runtimeServiceAccount) {
        return json(snapshot.runtimeServiceAccountPolicy);
      }
      if (target === deployIdentityScope.buildServiceAccount) {
        return json(snapshot.buildServiceAccountPolicy);
      }
    }
    if (
      args[0] === "run"
      && args[1] === "services"
      && args[2] === "get-iam-policy"
    ) {
      const resource =
        `projects/${deployIdentityScope.projectId}/locations/`
        + `${deployIdentityScope.region}/services/${args[3]}`;
      const entry = snapshot.runServicePolicies.find(
        (candidate) => candidate.serviceName === resource,
      );
      assert.ok(entry, resource);
      return json(entry.policy);
    }
    throw new Error(`UNEXPECTED_GCLOUD_CALL:${args.join(" ")}`);
  };
  return {
    calls,
    execFileImpl,
    get mutations() {
      return mutations;
    },
  };
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return structuredClone(body);
    },
  };
}

test("deploy windows are short lived and cannot cross staging expiry", () => {
  assert.equal(assertDeployWindow(windowExpiresAt, now), windowExpiresAt);
  assert.throws(
    () => assertDeployWindow("2026-07-27T13:00:00.001Z", now),
    /DEPLOY_WINDOW_DURATION_OUTSIDE_BOUNDARY/u,
  );
  assert.throws(
    () => assertDeployWindow(
      "2027-01-25T00:30:00.000Z",
      new Date("2027-01-24T23:45:00.000Z"),
    ),
    /DEPLOY_WINDOW_OUTSIDE_STAGING_TERM/u,
  );
  assert.throws(
    () => assertDeployWindow(
      "2027-01-25T00:05:00.000Z",
      new Date("2027-01-25T00:00:00.000Z"),
    ),
    /DEPLOY_WINDOW_OUTSIDE_STAGING_TERM/u,
  );
});

test("synthetic deletion windows are 5-30 minutes and cannot outlive the 24-hour grace", () => {
  assert.equal(
    assertSyntheticDeletionWindow(
      syntheticDeletionWindowExpiresAt,
      syntheticDeletionNow,
    ),
    syntheticDeletionWindowExpiresAt,
  );
  assert.equal(
    assertSyntheticDeletionWindow(
      "2027-01-25T00:00:00.000Z",
      new Date("2027-01-24T23:45:00.000Z"),
    ),
    "2027-01-25T00:00:00.000Z",
  );
  assert.equal(SYNTHETIC_DELETION_GRACE_END, "2027-01-26T00:00:00.000Z");
  assert.throws(
    () => assertSyntheticDeletionWindow(
      "2027-01-25T00:40:00.001Z",
      syntheticDeletionNow,
    ),
    /SYNTHETIC_DELETION_WINDOW_DURATION_OUTSIDE_BOUNDARY/u,
  );
  assert.throws(
    () => assertSyntheticDeletionWindow(
      "2027-01-26T00:00:00.001Z",
      new Date("2027-01-25T23:30:00.001Z"),
    ),
    /SYNTHETIC_DELETION_WINDOW_OUTSIDE_ORDINARY_EXPIRY_GRACE/u,
  );
});

test("deploy identity readback requires exact conditioned roles and zero keys", () => {
  assert.deepEqual(validateDeployIdentityReadback(readyReadback(), {
    windowExpiresAt,
  }), { valid: true, errors: [] });
  assert.deepEqual(validateDeployIdentityReadback(revokedReadback(), {
    windowExpiresAt,
    expectRevoked: true,
  }), { valid: true, errors: [] });

  const keyed = readyReadback();
  keyed.deployServiceAccount.userManagedKeys = [{ name: "forbidden-key" }];
  assert.match(
    validateDeployIdentityReadback(keyed, { windowExpiresAt }).errors.join(";"),
    /USER_MANAGED_KEYS_FORBIDDEN/u,
  );

  const elevated = readyReadback();
  elevated.projectPolicy.bindings.push({
    role: "roles/owner",
    members: [`serviceAccount:${deployIdentityScope.deployServiceAccount}`],
  });
  assert.match(
    validateDeployIdentityReadback(elevated, { windowExpiresAt }).errors.join(";"),
    /DEPLOY_PROJECT_MEMBER_EXTRA_OR_ALTERED_BINDING_FORBIDDEN/u,
  );

  const stale = readyReadback();
  stale.projectPolicy.bindings[0].condition.expression =
    'request.time < timestamp("2026-07-27T12:31:00.000Z")';
  assert.match(
    validateDeployIdentityReadback(stale, { windowExpiresAt }).errors.join(";"),
    /EXPECTED_BINDING_MISSING|EXTRA_OR_ALTERED/u,
  );
});

test("deletion-only and guaranteed-finally revoked readbacks are exact", () => {
  assert.deepEqual(
    validateDeployIdentityReadback(deletionOnlyReadback(), {
      windowExpiresAt: syntheticDeletionWindowExpiresAt,
      expectedAuthorityState:
        deployIdentityAuthorityStates.deletionOnly,
    }),
    { valid: true, errors: [] },
  );
  assert.deepEqual(
    validateDeployIdentityReadback(deletionIdentityRevokedReadback(), {
      windowExpiresAt: syntheticDeletionWindowExpiresAt,
      expectedAuthorityState:
        deployIdentityAuthorityStates.allAuthorityRevoked,
    }),
    { valid: true, errors: [] },
  );

  const wrongService = deletionOnlyReadback();
  const target = wrongService.runServicePolicies.find(
    (entry) => entry.serviceName === deployDeletionRunServiceScope.resource,
  );
  const other = wrongService.runServicePolicies.find(
    (entry) => entry.serviceName.endsWith("/services/health"),
  );
  other.policy.bindings = target.policy.bindings;
  target.policy.bindings = [];
  assert.match(
    validateDeployIdentityReadback(wrongService, {
      windowExpiresAt: syntheticDeletionWindowExpiresAt,
      expectedAuthorityState:
        deployIdentityAuthorityStates.deletionOnly,
    }).errors.join(";"),
    /DEPLOY_MEMBER_EXPECTED_BINDING_MISSING|DEPLOY_MEMBER_EXTRA_OR_ALTERED/u,
  );

  const stale = deletionOnlyReadback();
  stale.runServicePolicies.find(
    (entry) => entry.serviceName === deployDeletionRunServiceScope.resource,
  ).policy.bindings[0].condition.expression =
    'request.time < timestamp("2027-01-25T00:31:00.000Z")';
  assert.match(
    validateDeployIdentityReadback(stale, {
      windowExpiresAt: syntheticDeletionWindowExpiresAt,
      expectedAuthorityState:
        deployIdentityAuthorityStates.deletionOnly,
    }).errors.join(";"),
    /EXPECTED_BINDING_MISSING|EXTRA_OR_ALTERED/u,
  );
});

test("project IAM rejects broad or unresolved principals in every authority phase", () => {
  const phases = [
    {
      snapshot: readyReadback(),
      options: { windowExpiresAt },
    },
    {
      snapshot: deletionOnlyReadback(),
      options: {
        windowExpiresAt: syntheticDeletionWindowExpiresAt,
        expectedAuthorityState:
          deployIdentityAuthorityStates.deletionOnly,
      },
    },
    {
      snapshot: deletionIdentityRevokedReadback(),
      options: {
        windowExpiresAt: syntheticDeletionWindowExpiresAt,
        expectedAuthorityState:
          deployIdentityAuthorityStates.allAuthorityRevoked,
      },
    },
  ];
  for (const member of [
    "allAuthenticatedUsers",
    "allUsers",
    "group:deployers@example.invalid",
    "domain:example.invalid",
    "principalSet://cloudresourcemanager.googleapis.com/projects/"
      + `${deployIdentityScope.projectNumber}/type/ServiceAccount`,
  ]) {
    for (const phase of phases) {
      const snapshot = structuredClone(phase.snapshot);
      snapshot.projectPolicy.bindings.push({
        role: "roles/run.admin",
        members: [member],
      });
      assert.match(
        validateDeployIdentityReadback(snapshot, phase.options)
          .errors.join(";"),
        /DEPLOY_PROJECT_(?:PUBLIC|PRINCIPAL_SET|UNRESOLVED_OR_BROAD)/u,
        `${member}:${phase.options.expectedAuthorityState ?? "DEPLOY_READY"}`,
      );
    }
  }
});

test("direct parent policy rejects unresolved or inherited approved identity paths", () => {
  const directUserOnly = readyReadback();
  directUserOnly.organizationIamPolicy.bindings.push({
    role: "roles/resourcemanager.organizationViewer",
    members: ["user:unrelated@example.invalid"],
  });
  assert.deepEqual(
    normalizedDeployParentScopeEvidence(directUserOnly).errors,
    [],
  );
  const approvedHumanOwner = readyReadback();
  approvedHumanOwner.organizationIamPolicy.bindings.push({
    role: "roles/resourcemanager.organizationAdmin",
    members: [deployIdentityScope.operatorMember],
  });
  const approvedHumanOwnerEvidence =
    normalizedDeployParentScopeEvidence(approvedHumanOwner);
  assert.deepEqual(approvedHumanOwnerEvidence.errors, []);
  assert.equal(
    approvedHumanOwnerEvidence.evidence
      .approvedHumanOwnerAuthorityExplicitlyClassified,
    true,
  );
  assert.equal(
    approvedHumanOwnerEvidence.evidence
      .exclusiveImpersonationAuthorityProven,
    false,
  );

  const forbiddenMembers = [
    `serviceAccount:${deployIdentityScope.deployServiceAccount}`,
    "principal://iam.googleapis.com/projects/-/serviceAccounts/"
      + deployIdentityScope.previewServiceAccount,
    "allUsers",
    "allAuthenticatedUsers",
    "group:transitive@example.invalid",
    "domain:example.invalid",
    "principalSet://cloudresourcemanager.googleapis.com/projects/"
      + `${deployIdentityScope.projectNumber}/type/ServiceAccount`,
  ];
  for (const forbiddenMember of forbiddenMembers) {
    const snapshot = readyReadback();
    snapshot.organizationIamPolicy.bindings.push({
      role: "roles/viewer",
      members: [forbiddenMember],
    });
    assert.notEqual(
      normalizedDeployParentScopeEvidence(snapshot).errors.length,
      0,
      forbiddenMember,
    );
  }
  const evidence =
    normalizedDeployParentScopeEvidence(readyReadback()).evidence;
  assert.equal(
    evidence.evidenceScope,
    "DIRECT_PARENT_POLICY_WITH_UNRESOLVED_PRINCIPALS_ABSENT",
  );
  assert.equal(evidence.globalEffectiveAuthorityAnalysisPerformed, false);
  assert.equal(evidence.exclusiveImpersonationAuthorityProven, false);
  assert.equal(evidence.unresolvedOrBroadPrincipalBindingsAbsent, true);

  for (const role of [
    "roles/iam.serviceAccountTokenCreator",
    "roles/iam.serviceAccountUser",
    "roles/iam.workloadIdentityUser",
    "roles/owner",
    `organizations/${deployIdentityScope.organizationId}/roles/custom`,
  ]) {
    const sensitive = readyReadback();
    sensitive.organizationIamPolicy.bindings.push({
      role,
      members: ["user:unrelated@example.invalid"],
    });
    assert.notEqual(
      normalizedDeployParentScopeEvidence(sensitive).errors.length,
      0,
      role,
    );
  }
});

test("resource policies are the complete exact allowlist", () => {
  for (const policyKey of [
    "artifactRepositoryPolicy",
    "sourceBucketPolicy",
    "capabilitySecretPolicy",
  ]) {
    const attacker = readyReadback();
    attacker[policyKey].bindings.push({
      role: "roles/viewer",
      members: ["user:attacker@example.invalid"],
    });
    assert.match(
      validateDeployIdentityReadback(attacker, {
        windowExpiresAt,
      }).errors.join(";"),
      /DEPLOY_RESOURCE_POLICY_NOT_EXACT_ALLOWLIST/u,
    );

    const extraMember = readyReadback();
    extraMember[policyKey].bindings[0].members.push(
      "user:attacker@example.invalid",
    );
    assert.match(
      validateDeployIdentityReadback(extraMember, {
        windowExpiresAt,
      }).errors.join(";"),
      /DEPLOY_RESOURCE_POLICY_NOT_EXACT_ALLOWLIST/u,
    );

    const deployAuthority = readyReadback();
    deployAuthority[policyKey].bindings.push({
      role: "roles/storage.admin",
      members: [
        `serviceAccount:${deployIdentityScope.deployServiceAccount}`,
      ],
    });
    assert.match(
      validateDeployIdentityReadback(deployAuthority, {
        windowExpiresAt,
      }).errors.join(";"),
      /DEPLOY_MEMBER_RESOURCE_POLICY_BINDING_FORBIDDEN/u,
    );
  }
});

test("project and service-account policies reject every extra deploy binding", () => {
  const projectExtra = readyReadback();
  projectExtra.projectPolicy.bindings.push({
    role: "roles/storage.admin",
    members: [
      `serviceAccount:${deployIdentityScope.deployServiceAccount}`,
    ],
  });
  assert.match(
    validateDeployIdentityReadback(projectExtra, {
      windowExpiresAt,
    }).errors.join(";"),
    /DEPLOY_PROJECT_MEMBER_EXTRA_OR_ALTERED_BINDING_FORBIDDEN/u,
  );

  for (const policyKey of [
    "deployServiceAccountPolicy",
    "runtimeServiceAccountPolicy",
    "buildServiceAccountPolicy",
  ]) {
    const snapshot = readyReadback();
    snapshot[policyKey].bindings.push({
      role: "roles/viewer",
      members: ["user:attacker@example.invalid"],
    });
    assert.match(
      validateDeployIdentityReadback(snapshot, {
        windowExpiresAt,
      }).errors.join(";"),
      /EXTRA_OR_ALTERED_BINDING_FORBIDDEN/u,
    );
  }
});

test("identity mutation plans use exact time conditions and reversible commands", () => {
  const provision = deployIdentityMutationCommands(windowExpiresAt, true);
  const revoke = deployIdentityMutationCommands(windowExpiresAt, false);
  assert.equal(provision.length, deployProjectRoles.length + 3);
  assert.equal(revoke.length, provision.length);
  for (const [index, command] of provision.entries()) {
    assert.match(command.join(" "), /add-iam-policy-binding/u);
    assert.match(command.join(" "), /request\.time < timestamp/u);
    assert.match(revoke[index].join(" "), /remove-iam-policy-binding/u);
  }
});

test("synthetic deletion identity adds only owner TokenCreator and exact delete Run invoker", () => {
  const commands =
    syntheticDeletionIdentityAddCommands(
      syntheticDeletionWindowExpiresAt,
    );
  assert.equal(commands.length, 2);
  const joined = commands.map((command) => command.join(" "));
  assert.match(
    joined[0],
    /roles\/iam\.serviceAccountTokenCreator/u,
  );
  assert.match(joined[0], /user:tryakim@gmail\.com/u);
  assert.match(joined[1], /roles\/run\.invoker/u);
  assert.match(joined[1], /deletesyntheticsession/u);
  assert.equal(
    joined.some((command) => (
      command.includes("roles/run.admin")
      || command.includes("roles/cloudfunctions.developer")
      || command.includes("roles/iam.serviceAccountUser")
    )),
    false,
  );
  const condition =
    syntheticDeletionWindowCondition(syntheticDeletionWindowExpiresAt);
  for (const command of joined) {
    assert.match(command, new RegExp(condition.title, "u"));
    assert.match(command, /request\.time < timestamp/u);
  }
});

test("read-only identity plan performs no gcloud call", async () => {
  let calls = 0;
  const result = await runDeployIdentityControlForTesting([
    "--action", "plan",
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--window-expires-at", windowExpiresAt,
  ], {
    now: () => now,
    execFileImpl: () => {
      calls += 1;
      throw new Error("MUST_NOT_RUN");
    },
  });
  assert.equal(calls, 0);
  assert.equal(result.externalWrites, 0);
  assert.equal(result.userManagedKeysAllowed, 0);
});

test("direct provision is blocked before creating identity or bindings", async () => {
  const ready = readyReadback();
  const expectedMutations =
    deployIdentityMutationCommands(windowExpiresAt, true).length;
  let created = false;
  let mutations = 0;
  const execFileImpl = (_file, args) => {
    args = productionEquivalentTestArgs(args);
    if (args[0] === "auth" && args[1] === "list") {
      return deployIdentityScope.approvedGoogleAccount;
    }
    if (args[0] === "projects" && args[1] === "describe") {
      return json({
        projectId: deployIdentityScope.projectId,
        projectNumber: deployIdentityScope.projectNumber,
        parent: {
          type: "organization",
          id: deployIdentityScope.organizationId,
        },
        lifecycleState: "ACTIVE",
      });
    }
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "list"
    ) {
      return created
        ? json([{ email: deployIdentityScope.deployServiceAccount }])
        : "[]";
    }
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "create"
    ) {
      created = true;
      return json({ email: deployIdentityScope.deployServiceAccount });
    }
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "keys"
    ) return "[]";
    if (args.includes("add-iam-policy-binding")) {
      mutations += 1;
      return "{}";
    }
    const policiesReady = mutations === expectedMutations;
    const scopePolicy = scopePolicyResponse(args, ready);
    if (scopePolicy !== undefined) return scopePolicy;
    if (args[0] === "projects" && args[1] === "get-iam-policy") {
      return json(policiesReady ? ready.projectPolicy : { bindings: [] });
    }
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "get-iam-policy"
    ) {
      const target = args[3];
      if (!policiesReady) return json({ bindings: [] });
      if (target === deployIdentityScope.deployServiceAccount) {
        return json(ready.deployServiceAccountPolicy);
      }
      if (target === deployIdentityScope.runtimeServiceAccount) {
        return json(ready.runtimeServiceAccountPolicy);
      }
      if (target === deployIdentityScope.buildServiceAccount) {
        return json(ready.buildServiceAccountPolicy);
      }
    }
    throw new Error(`UNEXPECTED_GCLOUD_CALL:${args.join(" ")}`);
  };
  await assert.rejects(
    () => runDeployIdentityControlForTesting([
      "--action", "provision",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--window-expires-at", windowExpiresAt,
      "--authorized", deployIdentityScope.activationAuthorization,
    ], {
      now: () => now,
      execFileImpl,
    }),
    /VALIDATED_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  assert.equal(created, false);
  assert.equal(mutations, 0);
});

test("revoke removes every impersonation and deploy binding with zero keys remaining", async () => {
  const ready = readyReadback();
  const revoked = revokedReadback();
  const expectedMutations =
    deployIdentityMutationCommands(windowExpiresAt, false).length;
  let mutations = 0;
  const execFileImpl = (_file, args) => {
    args = productionEquivalentTestArgs(args);
    if (args[0] === "auth" && args[1] === "list") {
      return deployIdentityScope.approvedGoogleAccount;
    }
    if (args[0] === "projects" && args[1] === "describe") {
      return json({
        projectId: deployIdentityScope.projectId,
        projectNumber: deployIdentityScope.projectNumber,
        parent: {
          type: "organization",
          id: deployIdentityScope.organizationId,
        },
        lifecycleState: "ACTIVE",
      });
    }
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "list"
    ) return json([{ email: deployIdentityScope.deployServiceAccount }]);
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "keys"
    ) return "[]";
    if (args.includes("remove-iam-policy-binding")) {
      mutations += 1;
      return "{}";
    }
    const snapshot = mutations === expectedMutations ? revoked : ready;
    const scopePolicy = scopePolicyResponse(args, snapshot);
    if (scopePolicy !== undefined) return scopePolicy;
    if (args[0] === "projects" && args[1] === "get-iam-policy") {
      return json(snapshot.projectPolicy);
    }
    if (
      args[0] === "iam"
      && args[1] === "service-accounts"
      && args[2] === "get-iam-policy"
    ) {
      const target = args[3];
      if (target === deployIdentityScope.deployServiceAccount) {
        return json(snapshot.deployServiceAccountPolicy);
      }
      if (target === deployIdentityScope.runtimeServiceAccount) {
        return json(snapshot.runtimeServiceAccountPolicy);
      }
      if (target === deployIdentityScope.buildServiceAccount) {
        return json(snapshot.buildServiceAccountPolicy);
      }
    }
    throw new Error(`UNEXPECTED_GCLOUD_CALL:${args.join(" ")}`);
  };
  const result = await runDeployIdentityControlForTesting([
    "--action", "revoke",
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--window-expires-at", windowExpiresAt,
  ], {
    assertMutationAuthority: () => undefined,
    now: () => new Date("2027-01-25T00:00:00.000Z"),
    execFileImpl,
  });
  assert.equal(mutations, expectedMutations);
  assert.equal(result.externalWrites, expectedMutations);
  assert.equal(result.impersonationAndDeployBindingsRevoked, true);
  assert.equal(result.userManagedKeyCount, 0);
  assert.equal(
    result.parentScopeEvidence.evidenceScope,
    "DIRECT_PARENT_POLICY_WITH_UNRESOLVED_PRINCIPALS_ABSENT",
  );
  assert.equal(
    result.resourcePolicyEvidence.exactApprovedIdentityAllowlistConformant,
    true,
  );
});

test("downscope removes broad deploy authority and adds only deletion authority", async () => {
  const initial = {
    ...readyReadback(),
    ...runServicePoliciesReadback(),
  };
  const final = deletionOnlyReadback();
  const fake = identityTransitionGcloud(initial, final, 9);
  const result = await runDeployIdentityControlForTesting([
    "--action", "downscope-for-synthetic-deletion",
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--window-expires-at", syntheticDeletionWindowExpiresAt,
    "--authorized",
    deployIdentityScope.syntheticDataDeletionAuthorization,
  ], {
    assertMutationAuthority: () => undefined,
    now: () => syntheticDeletionNow,
    execFileImpl: fake.execFileImpl,
  });
  assert.equal(fake.mutations, 9);
  assert.equal(result.externalWrites, 9);
  assert.equal(
    result.authorityState,
    deployIdentityAuthorityStates.deletionOnly,
  );
  assert.equal(result.broadDeployBindingsRevoked, true);
  assert.equal(result.deletionOnlyAuthorityActive, true);
  assert.equal(result.allDeployAndDeletionAuthorityRevoked, false);
  assert.equal(
    result.deleteSyntheticSessionResource,
    deployDeletionRunServiceScope.resource,
  );
  assert.equal(
    result.deletionRunPolicyEvidence
      .deployAuthorityLimitedToExactDeletionInvoker,
    true,
  );
});

test("downscope requires exact deletion authorization and rejects broad project IAM before mutation", async () => {
  let calls = 0;
  await assert.rejects(
    runDeployIdentityControlForTesting([
      "--action", "downscope-for-synthetic-deletion",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--window-expires-at", syntheticDeletionWindowExpiresAt,
      "--authorized", deployIdentityScope.activationAuthorization,
    ], {
      now: () => syntheticDeletionNow,
      execFileImpl: () => {
        calls += 1;
        throw new Error("MUST_NOT_RUN");
      },
    }),
    /EXACT_SYNTHETIC_DATA_DELETION_AUTHORIZATION_REQUIRED/u,
  );
  assert.equal(calls, 0);

  const broad = {
    ...readyReadback(),
    ...runServicePoliciesReadback(),
  };
  broad.projectPolicy.bindings.push({
    role: "roles/run.admin",
    members: ["group:unresolved@example.invalid"],
  });
  const fake = identityTransitionGcloud(broad, broad, 1);
  await assert.rejects(
    runDeployIdentityControlForTesting([
      "--action", "downscope-for-synthetic-deletion",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--window-expires-at", syntheticDeletionWindowExpiresAt,
      "--authorized",
      deployIdentityScope.syntheticDataDeletionAuthorization,
    ], {
      assertMutationAuthority: () => undefined,
      now: () => syntheticDeletionNow,
      execFileImpl: fake.execFileImpl,
    }),
    /DEPLOY_IDENTITY_DELETION_TRANSITION_UNSAFE_.*DEPLOY_PROJECT_UNRESOLVED_OR_BROAD/u,
  );
  assert.equal(fake.mutations, 0);
});

test("guaranteed-finally deletion identity revoke needs no authorization and verifies all authority absent", async () => {
  const initial = deletionOnlyReadback();
  const final = deletionIdentityRevokedReadback();
  const fake = identityTransitionGcloud(initial, final, 2);
  const result = await runDeployIdentityControlForTesting([
    "--action", "revoke-deletion-identity",
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--window-expires-at", syntheticDeletionWindowExpiresAt,
  ], {
    assertMutationAuthority: () => undefined,
    now: () => new Date("2027-02-01T00:00:00.000Z"),
    execFileImpl: fake.execFileImpl,
  });
  assert.equal(fake.mutations, 2);
  assert.equal(result.externalWrites, 2);
  assert.equal(
    result.authorityState,
    deployIdentityAuthorityStates.allAuthorityRevoked,
  );
  assert.equal(result.deletionOnlyAuthorityActive, false);
  assert.equal(result.allDeployAndDeletionAuthorityRevoked, true);
  assert.equal(
    result.deletionRunPolicyEvidence.allDeployRunInvokerAuthorityAbsent,
    true,
  );
});

test("unreadable organization policy fails before an identity mutation", async () => {
  const fake = fakeGcloud();
  const execFileImpl = (file, args, options) => {
    args = productionEquivalentTestArgs(args);
    if (args[0] === "organizations" && args[1] === "get-iam-policy") {
      throw new Error("UNREADABLE");
    }
    return fake.execFileImpl(file, args, options);
  };
  await assert.rejects(
    () => runDeployIdentityControlForTesting([
      "--action", "verify",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--window-expires-at", windowExpiresAt,
    ], {
      now: () => now,
      execFileImpl,
    }),
    /DEPLOY_IDENTITY_ORGANIZATION_POLICY_READ_FAILED/u,
  );
  assert.equal(
    fake.calls.some((args) => args.includes("add-iam-policy-binding")),
    false,
  );
});

test("disabled function deployment pins impersonation and fails closed without preview", () => {
  const commands = deploymentCommands("deploy-disabled");
  assert.equal(commands.length, 5);
  for (const command of commands) {
    assert.ok(command.includes(deploymentImpersonationFlag));
    assert.ok(command.includes(`--project=${deployIdentityScope.projectId}`));
    assert.ok(command.includes(`--account=${deployIdentityScope.approvedGoogleAccount}`));
    assert.ok(command.includes(`--region=${deployIdentityScope.region}`));
    assert.ok(command.includes("--max-instances=1"));
    assert.ok(command.includes("--concurrency=1"));
    assert.ok(command.includes("--memory=256Mi"));
    assert.ok(command.includes("--timeout=60s"));
    const env = command.find((value) => value.startsWith("--set-env-vars="));
    assert.match(env, /LUDYS_STAGING_RUNTIME_PHASE=EXTERNAL_SYNTHETIC_STAGING/u);
    assert.doesNotMatch(env, /LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN/u);
    if (command[2] === "issueSyntheticSession") {
      assert.match(env, /LUDYS_STAGING_SESSION_ISSUANCE_ENABLED=false/u);
    }
  }
});

test("Functions memory readback normalizes official quantity units to exact bytes", () => {
  assert.equal(memoryQuantityBytes("256Mi"), deploymentMemoryBytes);
  assert.equal(memoryQuantityBytes("268435456"), deploymentMemoryBytes);
  assert.notEqual(memoryQuantityBytes("256M"), deploymentMemoryBytes);
  assert.equal(memoryQuantityBytes("256MiB"), null);
  assert.equal(memoryQuantityBytes("not-a-quantity"), null);
});

test("preview configuration merges exact phase and origin without enabling issuance", () => {
  assert.equal(canonicalPreviewOrigin(previewOrigin), previewOrigin);
  assert.throws(
    () => canonicalPreviewOrigin("https://attacker.vercel.app"),
    /PROTECTED_PREVIEW_ORIGIN_INVALID/u,
  );
  const commands = deploymentCommands("configure-preview-origin", previewOrigin);
  assert.equal(commands.length, 5);
  for (const command of commands) {
    const env = command.find((value) => value.startsWith("--update-env-vars="));
    assert.match(env, /LUDYS_STAGING_RUNTIME_PHASE=EXTERNAL_SYNTHETIC_STAGING/u);
    assert.match(env, new RegExp(
      `LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN=${previewOrigin.replaceAll(".", "\\.")}`,
      "u",
    ));
    assert.equal(command.some((value) => value.startsWith("--set-env-vars=")), false);
    if (command[2] === "issueSyntheticSession") {
      assert.match(env, /LUDYS_STAGING_SESSION_ISSUANCE_ENABLED=false/u);
    }
  }
});

test("issuance activation preserves exact phase and preview origin", () => {
  const [command] = deploymentCommands(
    "activate-session-issuance",
    previewOrigin,
  );
  assert.equal(command[2], "issueSyntheticSession");
  const env = command.find((value) => value.startsWith("--update-env-vars="));
  assert.match(env, /LUDYS_STAGING_RUNTIME_PHASE=EXTERNAL_SYNTHETIC_STAGING/u);
  assert.match(env, /LUDYS_STAGING_ALLOWED_PREVIEW_ORIGIN=https:/u);
  assert.match(env, /LUDYS_STAGING_SESSION_ISSUANCE_ENABLED=true/u);
  assert.ok(command.includes(deploymentImpersonationFlag));
});

test("external deploy rejects ambient credential overrides before execution", async () => {
  const fake = fakeGcloud();
  await assert.rejects(
    runExternalDeployForTesting([
      "--action", "deploy-disabled",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account", deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      ...providerSourceFixture.sourceBindingFlags,
      "--authorized", deployIdentityScope.activationAuthorization,
    ], deployTestOptions(fake, {
      environment: { GOOGLE_APPLICATION_CREDENTIALS: "forbidden.json" },
    })),
    /DEPLOY_CREDENTIAL_OVERRIDE_FORBIDDEN/u,
  );
  assert.equal(fake.calls.length, 0);
});

test("external deploy rejects preload, PATH-adjacent module, proxy and TLS overrides before execution", async () => {
  for (const environment of [
    { NODE_OPTIONS: "--require=C:\\attacker\\preload.cjs" },
    { NODE_PATH: "C:\\attacker\\modules" },
    { HTTPS_PROXY: "http://attacker.invalid:8080" },
    { NODE_TLS_REJECT_UNAUTHORIZED: "0" },
  ]) {
    const fake = fakeGcloud();
    await assert.rejects(
      runExternalDeployForTesting([
        "--action", "deploy-disabled",
        "--project", deployIdentityScope.projectId,
        "--google-account", deployIdentityScope.approvedGoogleAccount,
        "--region", deployIdentityScope.region,
        "--impersonate-service-account",
        deployIdentityScope.deployServiceAccount,
        "--window-expires-at", windowExpiresAt,
        ...providerSourceFixture.sourceBindingFlags,
        "--authorized", deployIdentityScope.activationAuthorization,
      ], deployTestOptions(fake, { environment })),
      /DEPLOY_CREDENTIAL_OR_PROCESS_OVERRIDE_FORBIDDEN/u,
    );
    assert.equal(fake.calls.length, 0);
  }
});

test("in-memory IAMCredentials exchange is exactly invalid-scoped and cannot call a provider", () => {
  const exchange = simulateImpersonatedDeployAccessTokenForTesting({
    now: () => now,
    expireTime: "2026-07-27T12:15:00.000Z",
  });
  const observed = exchange.request;
  const result = exchange.authority;
  assert.equal(
    observed.url,
    "https://iamcredentials.googleapis.com/v1/projects/-/"
      + `serviceAccounts/${externalControlTestScope.deployServiceAccount}`
      + ":generateAccessToken",
  );
  assert.equal(observed.options.method, "POST");
  assert.equal(
    observed.options.headers.authorization,
    "Bearer test-only-base-oauth-token-never-used-on-network",
  );
  assert.equal(
    observed.options.headers["x-goog-user-project"],
    externalControlTestScope.projectId,
  );
  assert.deepEqual(JSON.parse(observed.options.body), {
    delegates: [],
    scope: [
      "https://www.googleapis.com/auth/cloud-platform",
    ],
    lifetime: "900s",
  });
  assert.equal(
    result.accessToken,
    "test-only-impersonated-token-never-used-on-network",
  );
  assert.equal(
    result.serviceAccount,
    externalControlTestScope.deployServiceAccount,
  );
  assert.equal(
    JSON.stringify({
      serviceAccount: result.serviceAccount,
      scope: result.scope,
      tokenPrinted: result.tokenPrinted,
      tokenPersisted: result.tokenPersisted,
    }).includes("test-only-base-oauth-token-never-used-on-network"),
    false,
  );
  let providerWrapperInvocations = 0;
  assert.throws(
    () => simulateImpersonatedDeployAccessTokenForTesting({
      now: () => now,
      expireTime: "2026-07-27T12:15:00.000Z",
      fetchImpl: () => {
        providerWrapperInvocations += 1;
      },
    }),
    /EXACT_IN_MEMORY_TOKEN_TEST_INPUT_REQUIRED/u,
  );
  assert.equal(providerWrapperInvocations, 0);
  for (const expireTime of [
    "2026-07-27T12:04:59.999Z",
    "2026-07-27T12:16:00.001Z",
    "not-a-time",
  ]) {
    assert.throws(
      () => simulateImpersonatedDeployAccessTokenForTesting({
        now: () => now,
        expireTime,
      }),
      /DEPLOY_IMPERSONATED_ACCESS_TOKEN_INVALID/u,
    );
  }
});

test("wrong activation token blocks identity provisioning before external calls", async () => {
  let calls = 0;
  await assert.rejects(
    runDeployIdentityControlForTesting([
      "--action", "provision",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--window-expires-at", windowExpiresAt,
      "--authorized", "AUTHORIZE_WRONG_SCOPE",
    ], {
      now: () => now,
      execFileImpl: () => {
        calls += 1;
        throw new Error("MUST_NOT_RUN");
      },
    }),
    /EXACT_EXTERNAL_ACTIVATION_AUTHORIZATION_REQUIRED/u,
  );
  assert.equal(calls, 0);
});

test("wrong activation token blocks issuance activation before external calls", async () => {
  let calls = 0;
  await assert.rejects(
    runExternalDeploy([
      "--action", "activate-session-issuance",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account", deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      "--preview-origin", previewOrigin,
      ...dummySourceBindingFlags,
      "--authorized", "AUTHORIZE_WRONG_SCOPE",
    ]),
    /EXACT_EXTERNAL_ACTIVATION_AUTHORIZATION_REQUIRED/u,
  );
  assert.equal(calls, 0);
});

test("disabled deployment verifies identity then uses five impersonated commands", async () => {
  const fake = fakeGcloud();
  const result = await runExternalDeployForTesting([
    "--action", "deploy-disabled",
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--impersonate-service-account", deployIdentityScope.deployServiceAccount,
    "--window-expires-at", windowExpiresAt,
    ...providerSourceFixture.sourceBindingFlags,
    "--authorized", deployIdentityScope.activationAuthorization,
  ], deployTestOptions(fake));
  assert.equal(result.commandCount, 5);
  assert.equal(result.sessionIssuanceEnabled, false);
  assert.equal(result.runtimePhase, "EXTERNAL_SYNTHETIC_STAGING");
  assert.equal(result.protectedPreviewOrigin, null);
  const deployCalls = fake.calls.filter((args) => (
    args[0] === "functions" && args[1] === "deploy"
  ));
  const describeCalls = fake.calls.filter((args) => (
    args[0] === "functions" && args[1] === "describe"
  ));
  assert.equal(deployCalls.length, 5);
  assert.equal(describeCalls.length, 5);
  const sourceDirectories = new Set(deployCalls.map((args) => (
    args.find((value) => value.startsWith("--source="))?.slice(
      "--source=".length,
    )
  )));
  assert.equal(sourceDirectories.size, 1);
  const [deploymentSource] = sourceDirectories;
  assert.equal(isAbsolute(deploymentSource), true);
  assert.notEqual(
    resolve(deploymentSource),
    resolve(
      providerSourceFixture.repositoryRoot,
      "provider/firebase/functions",
    ),
  );
  assert.equal(existsSync(deploymentSource), false);
  for (const args of deployCalls) assert.ok(args.includes(deploymentImpersonationFlag));
  for (const readback of result.commandResults) {
    assert.equal(readback.state, "ACTIVE");
    assert.equal(readback.runtimeServiceAccount, deployIdentityScope.runtimeServiceAccount);
    assert.equal(readback.maxInstanceCount, 1);
    assert.equal(readback.maxInstanceRequestConcurrency, 1);
    assert.equal(readback.timeoutSeconds, 60);
    assert.equal(readback.secretValuesPrinted, false);
  }
});

test("function deploy fails closed when live readback differs from disabled config", async () => {
  const fake = fakeGcloud(readyReadback(), {
    alterFunctionDescription(description, name) {
      if (name === "issueSyntheticSession") {
        description.serviceConfig.environmentVariables
          .LUDYS_STAGING_SESSION_ISSUANCE_ENABLED = "true";
      }
      return description;
    },
  });
  await assert.rejects(
    runExternalDeployForTesting([
      "--action", "deploy-disabled",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account", deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      ...providerSourceFixture.sourceBindingFlags,
      "--authorized", deployIdentityScope.activationAuthorization,
    ], deployTestOptions(fake)),
    /FUNCTION_READBACK_ENVIRONMENT_VARIABLES_MISMATCH/u,
  );
  assert.equal(fake.calls.filter((args) => (
    args[0] === "functions" && args[1] === "describe"
  )).length, 1);
});

test("function deploy rejects a mismatched Cloud Run backing service", async () => {
  const fake = fakeGcloud(readyReadback(), {
    alterFunctionDescription(description, name) {
      if (name === "issueSyntheticSession") {
        description.serviceConfig.service =
          `projects/${deployIdentityScope.projectId}/locations/`
          + `${deployIdentityScope.region}/services/not-the-function`;
      }
      return description;
    },
  });
  await assert.rejects(
    runExternalDeployForTesting([
      "--action", "deploy-disabled",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account", deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      ...providerSourceFixture.sourceBindingFlags,
      "--authorized", deployIdentityScope.activationAuthorization,
    ], deployTestOptions(fake)),
    /FUNCTION_READBACK_RUN_SERVICE_MISMATCH/u,
  );
});

test("direct Firestore Rules deployment is blocked before provider calls", async () => {
  const fake = fakeGcloud();
  const fetchCalls = [];
  let releaseReads = 0;
  const rulesetName =
    `projects/${deployIdentityScope.projectId}/rulesets/ruleset-deny-all`;
  const releaseName =
    `projects/${deployIdentityScope.projectId}/releases/cloud.firestore/(default)`;
  const fetchImpl = async (url, options = {}) => {
    fetchCalls.push({ url, options });
    if (url.endsWith(`/v1/${releaseName}`)) {
      if (options.method === "PATCH") {
        assert.deepEqual(JSON.parse(options.body), {
          release: {
            name: releaseName,
            rulesetName,
          },
          updateMask: "rulesetName",
        });
        return response(200, {
          name: releaseName,
          rulesetName,
        });
      }
      releaseReads += 1;
      return response(200, {
        name: releaseName,
        rulesetName: releaseReads === 1
          ? `projects/${deployIdentityScope.projectId}/rulesets/previous`
          : rulesetName,
      });
    }
    if (url.endsWith(`/projects/${deployIdentityScope.projectId}/rulesets`)) {
      assert.equal(options.method, "POST");
      const body = JSON.parse(options.body);
      assert.equal(
        body.attachmentPoint,
        `firestore.googleapis.com/projects/${deployIdentityScope.projectNumber}`
          + "/databases/(default)",
      );
      assert.equal(body.source?.attachmentPoint, undefined);
      assert.equal(body.source?.files?.[0]?.name, "firestore.rules");
      return response(200, { name: rulesetName });
    }
    return response(404, {});
  };
  await assert.rejects(
    () => runExternalDeploy([
      "--action", "deploy-firestore-rules",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account",
      deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      ...dummySourceBindingFlags,
      "--authorized", deployIdentityScope.activationAuthorization,
    ]),
    /VALIDATED_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  assert.equal(fetchCalls.length, 0);
  assert.equal(fake.calls.length, 0);
});

test("missing v2 capability blocks Rules create path before readback", async () => {
  const fake = fakeGcloud();
  const fetchCalls = [];
  let releaseReads = 0;
  const rulesetName =
    `projects/${deployIdentityScope.projectId}/rulesets/ruleset-first`;
  const releaseName =
    `projects/${deployIdentityScope.projectId}/releases/cloud.firestore/(default)`;
  const fetchImpl = async (url, options = {}) => {
    fetchCalls.push({ url, options });
    if (url.endsWith(`/v1/${releaseName}`)) {
      releaseReads += 1;
      return releaseReads === 1
        ? response(404, {})
        : response(200, { name: releaseName, rulesetName });
    }
    if (url.endsWith(`/projects/${deployIdentityScope.projectId}/rulesets`)) {
      assert.equal(options.method, "POST");
      const body = JSON.parse(options.body);
      assert.equal(
        body.attachmentPoint,
        `firestore.googleapis.com/projects/${deployIdentityScope.projectNumber}`
          + "/databases/(default)",
      );
      assert.equal(body.source?.attachmentPoint, undefined);
      assert.equal(body.source?.files?.[0]?.name, "firestore.rules");
      return response(200, { name: rulesetName });
    }
    if (url.endsWith(`/projects/${deployIdentityScope.projectId}/releases`)) {
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), {
        name: releaseName,
        rulesetName,
      });
      return response(200, { name: releaseName, rulesetName });
    }
    return response(500, {});
  };
  await assert.rejects(
    () => runExternalDeploy([
      "--action", "deploy-firestore-rules",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account",
      deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      ...dummySourceBindingFlags,
      "--authorized", deployIdentityScope.activationAuthorization,
    ]),
    /VALIDATED_ACTIVATION_CAPABILITY_REQUIRED/u,
  );
  assert.equal(fetchCalls.length, 0);
  assert.equal(fake.calls.length, 0);
});

test("provider source snapshot accepts only the exact hash-bound 12-file closure", async () => {
  assert.equal(providerSourceFixture.snapshot.workingTreeClean, true);
  assert.equal(providerSourceFixture.snapshot.fileCount, 12);
  assert.match(
    providerSourceFixture.snapshot.functionsSourceSha256,
    /^[a-f0-9]{64}$/u,
  );
});

test("provider runtime closure rejects out-of-manifest imports and map references", () => {
  const outsideManifest = Object.fromEntries(fixtureRuntimeSources());
  outsideManifest[
    "provider/firebase/functions/lib/src/core/evidence.js"
  ] += "import \"./missing-runtime.js\";\n";
  assert.throws(
    () => assertExactProviderRuntimeImportClosure(outsideManifest),
    /PROVIDER_PACKAGE_RELATIVE_IMPORT_OUTSIDE_MANIFEST/u,
  );

  const danglingMap = Object.fromEntries(fixtureRuntimeSources());
  danglingMap[
    "provider/firebase/functions/lib/src/core/evidence.js"
  ] += "//# sourceMappingURL=evidence.js.map\n";
  assert.throws(
    () => assertExactProviderRuntimeImportClosure(danglingMap),
    /PROVIDER_PACKAGE_RUNTIME_LOADING_FORM_FORBIDDEN/u,
  );
});

test("provider source rejects a tampered compiled library byte", async (t) => {
  const fixture = await createProviderSourceFixture();
  t.after(() => removeFixture(fixture));
  const target = join(
    fixture.repositoryRoot,
    "provider/firebase/functions/lib/src/core/evidence.js",
  );
  await writeFile(target, "export const evidence = \"TAMPERED\";\n");
  await assert.rejects(
    validateProviderPackageSnapshotForTesting({
      repositoryRoot: fixture.repositoryRoot,
    }),
    /DEPLOY_SOURCE_WORKTREE_MUST_BE_CLEAN|PROVIDER_PACKAGE_FILE_HASH_OR_SIZE_MISMATCH/u,
  );
});

test("provider source rejects an ignored extra deployable file", async (t) => {
  const fixture = await createProviderSourceFixture();
  t.after(() => removeFixture(fixture));
  await appendFile(
    join(fixture.repositoryRoot, ".git", "info", "exclude"),
    "\nprovider/firebase/functions/extra-runtime.js\n",
  );
  await writeFixtureFile(
    fixture.repositoryRoot,
    "provider/firebase/functions/extra-runtime.js",
    "export const unauthorized = true;\n",
  );
  await assert.rejects(
    validateProviderPackageSnapshotForTesting({
      repositoryRoot: fixture.repositoryRoot,
    }),
    /FUNCTION_SOURCE_EXACT_FILE_SET_MISMATCH/u,
  );
});

test("provider source rejects a missing manifest file even when Git status is masked", async (t) => {
  const fixture = await createProviderSourceFixture();
  t.after(() => removeFixture(fixture));
  const path =
    "provider/firebase/functions/lib/src/core/evidence.js";
  git(fixture.repositoryRoot, [
    "update-index",
    "--assume-unchanged",
    "--",
    path,
  ]);
  await unlink(join(fixture.repositoryRoot, ...path.split("/")));
  await assert.rejects(
    validateProviderPackageSnapshotForTesting({
      repositoryRoot: fixture.repositoryRoot,
    }),
    /FUNCTION_SOURCE_EXACT_FILE_SET_MISMATCH/u,
  );
});

for (const field of ["sha256", "bytes"]) {
  test(`provider source rejects a manifest ${field} change`, async (t) => {
    const fixture = await createProviderSourceFixture();
    t.after(() => removeFixture(fixture));
    const artifactPath = join(
      fixture.repositoryRoot,
      ...providerPackageArtifactPath.split("/"),
    );
    const manifest = JSON.parse(await readFile(artifactPath, "utf8"));
    if (field === "sha256") {
      manifest.files[0].sha256 = "f".repeat(64);
    } else {
      manifest.files[0].bytes += 1;
    }
    manifest.functionsSourceSha256 = providerSourceDigest(manifest.files);
    git(fixture.repositoryRoot, [
      "update-index",
      "--assume-unchanged",
      "--",
      providerPackageArtifactPath,
    ]);
    await writeFile(
      artifactPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await assert.rejects(
      validateProviderPackageSnapshotForTesting({
        repositoryRoot: fixture.repositoryRoot,
      }),
      /PROVIDER_PACKAGE_FILE_HASH_OR_SIZE_MISMATCH/u,
    );
  });
}

test("provider source rejects a symlink or reparse directory", async (t) => {
  const fixture = await createProviderSourceFixture();
  t.after(() => removeFixture(fixture));
  const target = join(fixture.repositoryRoot, ".git", "reparse-target");
  const link = join(
    fixture.repositoryRoot,
    "provider",
    "firebase",
    "functions",
    "linked-runtime",
  );
  await mkdir(target, { recursive: true });
  await appendFile(
    join(fixture.repositoryRoot, ".git", "info", "exclude"),
    "\nprovider/firebase/functions/linked-runtime/\n",
  );
  await symlink(target, link, "junction");
  await assert.rejects(
    validateProviderPackageSnapshotForTesting({
      repositoryRoot: fixture.repositoryRoot,
    }),
    /FUNCTION_SOURCE_SPECIAL_FILE_FORBIDDEN|FUNCTION_SOURCE_REPARSE_PATH_FORBIDDEN/u,
  );
});

for (const flag of ["--skip-worktree", "--assume-unchanged"]) {
  test(`provider source rejects ${flag} on a deploy byte`, async (t) => {
    const fixture = await createProviderSourceFixture();
    t.after(() => removeFixture(fixture));
    git(fixture.repositoryRoot, [
      "update-index",
      flag,
      "--",
      "provider/firebase/functions/index.mjs",
    ]);
    await assert.rejects(
      validateProviderPackageSnapshotForTesting({
        repositoryRoot: fixture.repositoryRoot,
      }),
      /DEPLOY_SOURCE_UNTRACKED_SKIP_WORKTREE_OR_ASSUME_UNCHANGED_FORBIDDEN/u,
    );
  });
}

test("production deploy rejects fake repository and source digest overrides", async () => {
  await assert.rejects(
    runExternalDeploy([
      "--action", "deploy-disabled",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account",
      deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      ...dummySourceBindingFlags,
      "--authorized", deployIdentityScope.activationAuthorization,
    ], {
      repository: {
        workingTreeClean: true,
        commit: "a".repeat(40),
        tree: "b".repeat(40),
      },
      computedSourceSha256: "c".repeat(64),
    }),
    /PRODUCTION_DEPLOY_DEPENDENCY_INJECTION_FORBIDDEN/u,
  );
});

test("test entrypoints reject production scope before wrapped native providers run", async () => {
  let execFileCalls = 0;
  let fetchCalls = 0;
  let authorityCalls = 0;
  let impersonationCalls = 0;
  const wrappedExecFileSync = (...args) => {
    execFileCalls += 1;
    return execFileSync(...args);
  };
  const wrappedGlobalFetch = (...args) => {
    fetchCalls += 1;
    return globalThis.fetch(...args);
  };
  await assert.rejects(
    runDeployIdentityControlForTestingRaw([
      "--action", "verify",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--window-expires-at", windowExpiresAt,
    ], {
      execFileImpl: wrappedExecFileSync,
      now: () => now,
    }),
    /DEPLOY_IDENTITY_APPROVED_SCOPE_MISMATCH/u,
  );
  await assert.rejects(
    runExternalDeployForTestingRaw([
      "--action", "deploy-disabled",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account",
      deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      ...providerSourceFixture.sourceBindingFlags,
      "--authorized", deployIdentityScope.activationAuthorization,
    ], {
      acquireImpersonatedAccessTokenImpl: async () => {
        impersonationCalls += 1;
        throw new Error("MUST_NOT_RUN");
      },
      assertMutationAuthority: () => {
        authorityCalls += 1;
        throw new Error("MUST_NOT_RUN");
      },
      environment: {},
      fetchImpl: wrappedGlobalFetch,
      now: () => now,
      providerExecFileImpl: wrappedExecFileSync,
      repositoryRoot: providerSourceFixture.repositoryRoot,
    }),
    /DEPLOY_APPROVED_SCOPE_OR_IDENTITY_MISMATCH/u,
  );
  assert.equal(execFileCalls, 0);
  assert.equal(fetchCalls, 0);
  assert.equal(authorityCalls, 0);
  assert.equal(impersonationCalls, 0);
});

test("production entrypoints reject frozen invalid test scope before provider access", async () => {
  const testIdentityArgs = Object.freeze(externalControlTestArgvForTesting([
    "--action", "verify",
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--window-expires-at", windowExpiresAt,
  ]));
  await assert.rejects(
    runDeployIdentityControl(testIdentityArgs),
    /DEPLOY_IDENTITY_APPROVED_SCOPE_MISMATCH/u,
  );

  const testDeployArgs = Object.freeze(externalControlTestArgvForTesting([
    "--action", "deploy-disabled",
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--impersonate-service-account",
    deployIdentityScope.deployServiceAccount,
    "--window-expires-at", windowExpiresAt,
    ...providerSourceFixture.sourceBindingFlags,
    "--authorized", deployIdentityScope.activationAuthorization,
  ]));
  await assert.rejects(
    runExternalDeploy(testDeployArgs),
    /DEPLOY_APPROVED_SCOPE_OR_IDENTITY_MISMATCH/u,
  );
});

test("source race during identity preflight blocks the first provider mutation", async (t) => {
  const fixture = await createProviderSourceFixture();
  t.after(() => removeFixture(fixture));
  const fake = fakeGcloud();
  let changed = false;
  const providerExecFileImpl = (file, args, options) => {
    const result = fake.execFileImpl(file, args, options);
    if (
      !changed
      && args[0] === "projects"
      && args[1] === "describe"
    ) {
      changed = true;
      writeFileSync(
        join(
          fixture.repositoryRoot,
          "provider/firebase/functions/lib/src/core/evidence.js",
        ),
        "export const evidence = \"RACED\";\n",
      );
    }
    return result;
  };
  await assert.rejects(
    runExternalDeployForTesting([
      "--action", "deploy-disabled",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account",
      deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      ...fixture.sourceBindingFlags,
      "--authorized", deployIdentityScope.activationAuthorization,
    ], {
      ...deployTestOptions(fake),
      providerExecFileImpl,
      repositoryRoot: fixture.repositoryRoot,
    }),
    /DEPLOY_SOURCE_WORKTREE_MUST_BE_CLEAN|PROVIDER_PACKAGE_FILE_HASH_OR_SIZE_MISMATCH/u,
  );
  assert.equal(
    fake.calls.some((args) => (
      args[0] === "functions" && args[1] === "deploy"
    )),
    false,
  );
});

test("worktree race during provider deploy cannot change uploaded snapshot bytes", async (t) => {
  const fixture = await createProviderSourceFixture();
  t.after(() => removeFixture(fixture));
  const fake = fakeGcloud();
  let changed = false;
  let observedDeploymentSource;
  const liveEvidencePath = join(
    fixture.repositoryRoot,
    "provider/firebase/functions/lib/src/core/evidence.js",
  );
  const expectedEvidence = readFileSync(liveEvidencePath);
  const providerExecFileImpl = (file, args, options) => {
    if (!changed && args[0] === "functions" && args[1] === "deploy") {
      const sourceFlag =
        args.find((value) => value.startsWith("--source="));
      assert.ok(sourceFlag);
      observedDeploymentSource =
        sourceFlag.slice("--source=".length);
      assert.equal(isAbsolute(observedDeploymentSource), true);
      assert.notEqual(
        resolve(observedDeploymentSource),
        resolve(
          fixture.repositoryRoot,
          "provider/firebase/functions",
        ),
      );
      assert.deepEqual(
        readFileSync(join(
          observedDeploymentSource,
          "lib/src/core/evidence.js",
        )),
        expectedEvidence,
      );
      changed = true;
      writeFileSync(
        liveEvidencePath,
        "export const evidence = \"POST_READBACK_RACE\";\n",
      );
    }
    return fake.execFileImpl(file, args, options);
  };
  await assert.rejects(
    runExternalDeployForTesting([
      "--action", "deploy-disabled",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account",
      deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      ...fixture.sourceBindingFlags,
      "--authorized", deployIdentityScope.activationAuthorization,
    ], {
      ...deployTestOptions(fake),
      providerExecFileImpl,
      repositoryRoot: fixture.repositoryRoot,
    }),
    /DEPLOY_SOURCE_WORKTREE_MUST_BE_CLEAN|PROVIDER_PACKAGE_FILE_HASH_OR_SIZE_MISMATCH/u,
  );
  assert.equal(
    fake.calls.filter((args) => (
      args[0] === "functions" && args[1] === "deploy"
    )).length,
    1,
  );
  assert.equal(existsSync(observedDeploymentSource), false);
});

test("Firestore race uses captured HEAD rules and blocks the next mutation", async (t) => {
  const fixture = await createProviderSourceFixture();
  t.after(() => removeFixture(fixture));
  const fake = fakeGcloud();
  const liveRulesPath = join(
    fixture.repositoryRoot,
    "provider/firebase/firestore.rules",
  );
  const expectedRules = readFileSync(liveRulesPath, "utf8");
  const rulesetName =
    `projects/${deployIdentityScope.projectId}/rulesets/captured-rules`;
  const releaseName =
    `projects/${deployIdentityScope.projectId}/releases/cloud.firestore/(default)`;
  const fetchCalls = [];
  const fetchImpl = async (rawUrl, options = {}) => {
    const url = productionEquivalentTestArgs([String(rawUrl)])[0];
    fetchCalls.push({ url, options });
    if (
      url.endsWith(`/v1/${releaseName}`)
      && options.method === undefined
    ) {
      return response(200, {
        name: releaseName,
        rulesetName:
          `projects/${deployIdentityScope.projectId}/rulesets/previous`,
      });
    }
    if (
      url.endsWith(
        `/v1/projects/${deployIdentityScope.projectId}/rulesets`,
      )
      && options.method === "POST"
    ) {
      const body = JSON.parse(options.body);
      assert.equal(body.source.files[0].content, expectedRules);
      writeFileSync(
        liveRulesPath,
        expectedRules.replace(
          "allow read, write: if false;",
          "allow read, write: if true;",
        ),
      );
      return response(200, { name: rulesetName });
    }
    throw new Error(`UNEXPECTED_FIRESTORE_CALL:${url}`);
  };
  await assert.rejects(
    runExternalDeployForTesting([
      "--action", "deploy-firestore-rules",
      "--project", deployIdentityScope.projectId,
      "--google-account", deployIdentityScope.approvedGoogleAccount,
      "--region", deployIdentityScope.region,
      "--impersonate-service-account",
      deployIdentityScope.deployServiceAccount,
      "--window-expires-at", windowExpiresAt,
      ...fixture.sourceBindingFlags,
      "--authorized", deployIdentityScope.activationAuthorization,
    ], {
      ...deployTestOptions(fake),
      fetchImpl,
      repositoryRoot: fixture.repositoryRoot,
    }),
    /DEPLOY_SOURCE_WORKTREE_MUST_BE_CLEAN|FIRESTORE_DENY_ALL_RULE_SOURCE_REQUIRED/u,
  );
  assert.equal(fetchCalls.length, 2);
  assert.equal(
    fake.calls.some((args) => (
      args[0] === "auth"
      && args[1] === "print-access-token"
    )),
    false,
  );
  assert.equal(
    fetchCalls.some(({ options }) => options.method === "PATCH"),
    false,
  );
});
