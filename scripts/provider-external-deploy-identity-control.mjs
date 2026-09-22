import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  assertDeployWindow,
  assertRecordedDeployWindow,
  assertRecordedSyntheticDeletionWindow,
  assertSyntheticDeletionWindow,
  deployDeletionRunServiceScope,
  deployFunctionNames,
  deployIdentityAuthorityStates,
  deployIdentityScope,
  deployProjectRoles,
  deployResourcePolicyScopes,
  deployRunServicePolicyScopes,
  deployServiceAccountUserTargets,
  deployWindowCondition,
  normalizedDeployDeletionRunPolicyEvidence,
  normalizedDeployParentScopeEvidence,
  normalizedDeployProjectScopeEvidence,
  normalizedDeployResourcePolicyEvidence,
  SYNTHETIC_DELETION_GRACE_END,
  syntheticDeletionWindowCondition,
  validateDeployIdentityReadback,
} from "./wp13-12b-deploy-identity.mjs";
import {
  acquireBaseActivationCapability,
  acquireCleanupActivationCapability,
  assertBaseActivationCapability,
  assertCleanupActivationCapability,
} from "./wp13-12b-activation-phase-gate.mjs";
import {
  assertNoDangerousExternalEnvironment,
  createPinnedGoogleCloudCliExecFile,
} from "./wp13-12b-external-process-boundary.mjs";

const require = createRequire(import.meta.url);
const {
  acquirePinnedGoogleOAuthAccessToken,
} = require("./wp13-12b-google-oauth-token-helper.cjs");

const ACTIONS = new Set([
  "plan",
  "provision",
  "verify",
  "revoke",
  "downscope-for-synthetic-deletion",
  "revoke-deletion-identity",
]);
const MUTATION_ACTIONS = new Set([
  "provision",
  "revoke",
  "downscope-for-synthetic-deletion",
  "revoke-deletion-identity",
]);
const REVOCATION_ONLY_ACTIONS = new Set([
  "revoke",
  "revoke-deletion-identity",
]);
const revocationOnlyCapabilities = new WeakMap();
const FLAGS = new Set([
  "--action",
  "--project",
  "--google-account",
  "--region",
  "--window-expires-at",
  "--authorized",
]);
const deployAccountId = "ludys-staging-deployer";
const deployMember = `serviceAccount:${deployIdentityScope.deployServiceAccount}`;
export const externalControlTestScope = Object.freeze({
  projectId: "ludys-wp13-12b-test.invalid",
  projectNumber: "100000000001",
  organizationId: "000000000000",
  approvedGoogleAccount: "ludys-test-only@invalid.invalid",
  region: "test-only-invalid-region",
  deployServiceAccount:
    "ludys-staging-deployer@ludys-wp13-12b-test.invalid.iam.gserviceaccount.com",
});

const testScopeReplacements = Object.freeze([
  Object.freeze([
    deployIdentityScope.deployServiceAccount,
    externalControlTestScope.deployServiceAccount,
  ]),
  Object.freeze([
    deployIdentityScope.approvedGoogleAccount,
    externalControlTestScope.approvedGoogleAccount,
  ]),
  Object.freeze([
    deployIdentityScope.organizationId,
    externalControlTestScope.organizationId,
  ]),
  Object.freeze([
    deployIdentityScope.projectNumber,
    externalControlTestScope.projectNumber,
  ]),
  Object.freeze([
    deployIdentityScope.projectId,
    externalControlTestScope.projectId,
  ]),
  Object.freeze([
    deployIdentityScope.region,
    externalControlTestScope.region,
  ]),
]);

function controlError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseExactFlagPairs(argv) {
  if (argv.length % 2 !== 0) throw controlError("EXACT_FLAG_VALUE_PAIRS_REQUIRED");
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
    ) throw controlError("UNKNOWN_DUPLICATE_OR_EMPTY_DEPLOY_IDENTITY_FLAG");
    parsed.set(flag, value);
  }
  for (const flag of [
    "--action",
    "--project",
    "--google-account",
    "--region",
    "--window-expires-at",
  ]) {
    if (!parsed.has(flag)) throw controlError("DEPLOY_IDENTITY_REQUIRED_FLAG_MISSING");
  }
  return parsed;
}

function assertScope(args, expectedScope = deployIdentityScope) {
  if (
    args.get("--project") !== expectedScope.projectId
    || args.get("--google-account") !== expectedScope.approvedGoogleAccount
    || args.get("--region") !== expectedScope.region
  ) throw controlError("DEPLOY_IDENTITY_APPROVED_SCOPE_MISMATCH");
}

export function externalControlTestValueForTesting(value) {
  if (typeof value !== "string") {
    throw controlError("EXTERNAL_CONTROL_TEST_VALUE_MUST_BE_STRING");
  }
  return testScopeReplacements.reduce(
    (result, [productionValue, testValue]) =>
      result.replaceAll(productionValue, testValue),
    value,
  );
}

export function externalControlTestArgvForTesting(argv) {
  if (!Array.isArray(argv) || argv.some((value) => typeof value !== "string")) {
    throw controlError("EXTERNAL_CONTROL_TEST_ARGV_INVALID");
  }
  return argv.map(externalControlTestValueForTesting);
}

function authorizationForRequestScope(authorization, requestScope) {
  if (requestScope === deployIdentityScope) return authorization;
  if (requestScope === externalControlTestScope) {
    return externalControlTestValueForTesting(authorization);
  }
  throw controlError("DEPLOY_IDENTITY_REQUEST_SCOPE_NOT_RECOGNIZED");
}

function testScopedExecFile(execFileImpl) {
  return (file, args, options) => execFileImpl(
    file,
    externalControlTestArgvForTesting(args),
    options,
  );
}

function mintRevocationOnlyCapability(
  action,
  args,
  cleanupActivationCapability,
) {
  if (!REVOCATION_ONLY_ACTIONS.has(action)) {
    throw controlError("REVOCATION_ONLY_ACTION_REQUIRED");
  }
  const source = assertCleanupActivationCapability(
    cleanupActivationCapability,
  );
  if (
    source?.productionBound !== true
    || !/^[a-f0-9]{40}$/u.test(source.headCommit ?? "")
    || !/^[a-f0-9]{40}$/u.test(source.headTree ?? "")
  ) {
    throw controlError(
      "PRODUCTION_BOUND_REVOCATION_SOURCE_CAPABILITY_REQUIRED",
    );
  }
  const capability = Object.freeze({});
  revocationOnlyCapabilities.set(capability, Object.freeze({
    action,
    projectId: args.get("--project"),
    approvedGoogleAccount: args.get("--google-account"),
    region: args.get("--region"),
    deployServiceAccount: deployIdentityScope.deployServiceAccount,
    windowExpiresAt: args.get("--window-expires-at"),
    sourceCommit: source.headCommit,
    sourceTree: source.headTree,
    cleanupActivationCapability,
  }));
  return capability;
}

function assertRevocationOnlyCapability(capability, action, args) {
  const binding = revocationOnlyCapabilities.get(capability);
  if (
    binding?.action !== action
    || binding?.projectId !== deployIdentityScope.projectId
    || binding?.projectId !== args.get("--project")
    || binding?.approvedGoogleAccount
      !== deployIdentityScope.approvedGoogleAccount
    || binding?.approvedGoogleAccount !== args.get("--google-account")
    || binding?.region !== deployIdentityScope.region
    || binding?.region !== args.get("--region")
    || binding?.deployServiceAccount
      !== deployIdentityScope.deployServiceAccount
    || binding?.windowExpiresAt !== args.get("--window-expires-at")
    || !/^[a-f0-9]{40}$/u.test(binding?.sourceCommit ?? "")
    || !/^[a-f0-9]{40}$/u.test(binding?.sourceTree ?? "")
  ) {
    throw controlError(
      "EXACT_SOURCE_BOUND_REVOCATION_ONLY_CAPABILITY_REQUIRED",
    );
  }
  assertCleanupActivationCapability(
    binding.cleanupActivationCapability,
  );
  return binding;
}

function conditionFlag(condition) {
  if (condition === undefined || condition === null) return "None";
  return [
    `expression=${condition.expression}`,
    `title=${condition.title}`,
    `description=${condition.description}`,
  ].join(",");
}

function commonGcloudFlags() {
  return [
    `--project=${deployIdentityScope.projectId}`,
    `--account=${deployIdentityScope.approvedGoogleAccount}`,
    "--quiet",
  ];
}

function bindingArgs({
  target,
  add,
  member,
  role,
  condition,
}) {
  const targetArgs = target === "project"
    ? ["projects", add ? "add-iam-policy-binding" : "remove-iam-policy-binding",
      deployIdentityScope.projectId]
    : ["iam", "service-accounts",
      add ? "add-iam-policy-binding" : "remove-iam-policy-binding", target];
  return [
    ...targetArgs,
    `--member=${member}`,
    `--role=${role}`,
    `--condition=${conditionFlag(condition)}`,
    ...commonGcloudFlags(),
  ];
}

function runBindingArgs({
  serviceId,
  add,
  member,
  role,
  condition,
}) {
  return [
    "run",
    "services",
    add ? "add-iam-policy-binding" : "remove-iam-policy-binding",
    serviceId,
    `--region=${deployIdentityScope.region}`,
    `--member=${member}`,
    `--role=${role}`,
    `--condition=${conditionFlag(condition)}`,
    ...commonGcloudFlags(),
  ];
}

export function deployIdentityMutationCommands(windowExpiresAt, add) {
  const condition = deployWindowCondition(windowExpiresAt);
  return Object.freeze([
    ...deployProjectRoles.map((role) => Object.freeze(bindingArgs({
      target: "project",
      add,
      member: deployMember,
      role,
      condition,
    }))),
    Object.freeze(bindingArgs({
      target: deployIdentityScope.deployServiceAccount,
      add,
      member: deployIdentityScope.operatorMember,
      role: "roles/iam.serviceAccountTokenCreator",
      condition,
    })),
    ...deployServiceAccountUserTargets.map((target) => Object.freeze(bindingArgs({
      target,
      add,
      member: deployMember,
      role: "roles/iam.serviceAccountUser",
      condition,
    }))),
  ]);
}

function commandForObservedBinding({
  target,
  member,
  role,
  condition,
}) {
  if (target.kind === "run") {
    return Object.freeze(runBindingArgs({
      serviceId: target.serviceId,
      add: false,
      member,
      role,
      condition,
    }));
  }
  return Object.freeze(bindingArgs({
    target: target.value,
    add: false,
    member,
    role,
    condition,
  }));
}

function membersForApprovedEmail(binding, email) {
  const exactServiceAccount = `serviceAccount:${email}`;
  const directPrincipal =
    "principal://iam.googleapis.com/projects/-/serviceAccounts/"
    + email;
  return (Array.isArray(binding.members) ? binding.members : []).filter(
    (member) =>
      member === exactServiceAccount
      || member === directPrincipal,
  );
}

function observedAuthorityRevocationCommands(
  snapshot,
  {
    preserveDeletionOnlyBindings,
    deletionCondition,
  },
) {
  const commands = [];
  const targets = [
    {
      target: { kind: "policy", value: "project" },
      policy: snapshot.projectPolicy,
      memberEmail: deployIdentityScope.deployServiceAccount,
    },
    {
      target: {
        kind: "policy",
        value: deployIdentityScope.runtimeServiceAccount,
      },
      policy: snapshot.runtimeServiceAccountPolicy,
      memberEmail: deployIdentityScope.deployServiceAccount,
    },
    {
      target: {
        kind: "policy",
        value: deployIdentityScope.buildServiceAccount,
      },
      policy: snapshot.buildServiceAccountPolicy,
      memberEmail: deployIdentityScope.deployServiceAccount,
    },
  ];
  for (const descriptor of targets) {
    for (
      const binding of (
        Array.isArray(descriptor.policy?.bindings)
          ? descriptor.policy.bindings
          : []
      )
    ) {
      for (
        const member of membersForApprovedEmail(
          binding,
          descriptor.memberEmail,
        )
      ) {
        commands.push(commandForObservedBinding({
          target: descriptor.target,
          member,
          role: binding.role,
          condition: binding.condition,
        }));
      }
    }
  }
  for (
    const binding of (
      Array.isArray(snapshot.deployServiceAccountPolicy?.bindings)
        ? snapshot.deployServiceAccountPolicy.bindings
        : []
    )
  ) {
    if (!binding.members?.includes(deployIdentityScope.operatorMember)) {
      continue;
    }
    const retained = (
      preserveDeletionOnlyBindings
      && binding.role === "roles/iam.serviceAccountTokenCreator"
      && binding.members.length === 1
      && binding.condition?.title === deletionCondition.title
      && binding.condition?.description === deletionCondition.description
      && binding.condition?.expression === deletionCondition.expression
    );
    if (!retained) {
      commands.push(commandForObservedBinding({
        target: {
          kind: "policy",
          value: deployIdentityScope.deployServiceAccount,
        },
        member: deployIdentityScope.operatorMember,
        role: binding.role,
        condition: binding.condition,
      }));
    }
  }
  for (
    const entry of (
      Array.isArray(snapshot.runServicePolicies)
        ? snapshot.runServicePolicies
        : []
    )
  ) {
    const serviceId =
      entry.serviceName?.slice(entry.serviceName.lastIndexOf("/") + 1);
    for (
      const binding of (
        Array.isArray(entry.policy?.bindings)
          ? entry.policy.bindings
          : []
      )
    ) {
      for (
        const member of membersForApprovedEmail(
          binding,
          deployIdentityScope.deployServiceAccount,
        )
      ) {
        const retained = (
          preserveDeletionOnlyBindings
          && entry.serviceName === deployDeletionRunServiceScope.resource
          && binding.role === "roles/run.invoker"
          && binding.members.length === 1
          && binding.condition?.title === deletionCondition.title
          && binding.condition?.description === deletionCondition.description
          && binding.condition?.expression === deletionCondition.expression
        );
        if (!retained) {
          commands.push(commandForObservedBinding({
            target: { kind: "run", serviceId },
            member,
            role: binding.role,
            condition: binding.condition,
          }));
        }
      }
    }
  }
  return commands;
}

export function syntheticDeletionIdentityAddCommands(windowExpiresAt) {
  const condition = syntheticDeletionWindowCondition(windowExpiresAt);
  return Object.freeze([
    Object.freeze(bindingArgs({
      target: deployIdentityScope.deployServiceAccount,
      add: true,
      member: deployIdentityScope.operatorMember,
      role: "roles/iam.serviceAccountTokenCreator",
      condition,
    })),
    Object.freeze(runBindingArgs({
      serviceId: deployDeletionRunServiceScope.serviceId,
      add: true,
      member: deployMember,
      role: "roles/run.invoker",
      condition,
    })),
  ]);
}

function execute(execFileImpl, args, code) {
  try {
    return String(execFileImpl("gcloud", args, {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    })).trim();
  } catch {
    throw controlError(code);
  }
}

function executeJson(execFileImpl, args, code) {
  const text = execute(execFileImpl, args, code);
  try {
    return text === "" ? {} : JSON.parse(text);
  } catch {
    throw controlError(`${code}_INVALID_JSON`);
  }
}

async function inspectScope(execFileImpl, googleOAuthAuthority) {
  if (
    googleOAuthAuthority?.approvedGoogleAccount
      !== deployIdentityScope.approvedGoogleAccount
    || googleOAuthAuthority?.tokenPrinted !== false
  ) {
    throw controlError(
      "DEPLOY_IDENTITY_PINNED_OAUTH_ACCOUNT_PROOF_REQUIRED",
    );
  }
  const project = executeJson(execFileImpl, [
    "projects",
    "describe",
    deployIdentityScope.projectId,
    "--format=json",
    `--account=${deployIdentityScope.approvedGoogleAccount}`,
  ], "DEPLOY_IDENTITY_PROJECT_READ_FAILED");
  const parentMatches = project.parent === `organizations/${deployIdentityScope.organizationId}`
    || (
      project.parent?.type === "organization"
      && String(project.parent.id) === deployIdentityScope.organizationId
    );
  if (
    project.projectId !== deployIdentityScope.projectId
    || String(project.projectNumber) !== deployIdentityScope.projectNumber
    || !parentMatches
    || (project.lifecycleState ?? project.state) !== "ACTIVE"
  ) throw controlError("DEPLOY_IDENTITY_PROJECT_SCOPE_READBACK_MISMATCH");
  return Object.freeze({
    projectId: deployIdentityScope.projectId,
    projectNumber: deployIdentityScope.projectNumber,
    projectParent: `organizations/${deployIdentityScope.organizationId}`,
    organizationId: deployIdentityScope.organizationId,
    directOrganizationParent: true,
    folderAncestors: Object.freeze([]),
    lifecycleState: "ACTIVE",
  });
}

function serviceAccounts(execFileImpl) {
  const result = executeJson(execFileImpl, [
    "iam",
    "service-accounts",
    "list",
    "--format=json",
    ...commonGcloudFlags(),
  ], "DEPLOY_IDENTITY_SERVICE_ACCOUNT_LIST_FAILED");
  if (!Array.isArray(result)) {
    throw controlError("DEPLOY_IDENTITY_SERVICE_ACCOUNT_LIST_INVALID");
  }
  return result;
}

function serviceAccountPolicy(execFileImpl, email, code) {
  return executeJson(execFileImpl, [
    "iam",
    "service-accounts",
    "get-iam-policy",
    email,
    "--format=json",
    ...commonGcloudFlags(),
  ], code);
}

function runServicePolicies(execFileImpl) {
  return deployFunctionNames.map((functionName, index) => ({
    serviceName: deployRunServicePolicyScopes[index],
    policy: executeJson(execFileImpl, [
      "run",
      "services",
      "get-iam-policy",
      functionName.toLowerCase(),
      `--region=${deployIdentityScope.region}`,
      "--format=json",
      ...commonGcloudFlags(),
    ], `DEPLOY_IDENTITY_RUN_POLICY_READ_FAILED_${functionName}`),
  }));
}

async function readback(
  execFileImpl,
  googleOAuthAuthority,
  { includeRunServicePolicies = false } = {},
) {
  const parentScope = await inspectScope(
    execFileImpl,
    googleOAuthAuthority,
  );
  const organizationIamPolicy = executeJson(execFileImpl, [
    "organizations",
    "get-iam-policy",
    deployIdentityScope.organizationId,
    "--format=json",
    `--account=${deployIdentityScope.approvedGoogleAccount}`,
  ], "DEPLOY_IDENTITY_ORGANIZATION_POLICY_READ_FAILED");
  const projectPolicy = executeJson(execFileImpl, [
    "projects",
    "get-iam-policy",
    deployIdentityScope.projectId,
    "--format=json",
    ...commonGcloudFlags(),
  ], "DEPLOY_IDENTITY_PROJECT_POLICY_READ_FAILED");
  const artifactRepositoryPolicy = executeJson(execFileImpl, [
    "artifacts",
    "repositories",
    "get-iam-policy",
    "gcf-artifacts",
    `--location=${deployIdentityScope.region}`,
    "--format=json",
    ...commonGcloudFlags(),
  ], "DEPLOY_IDENTITY_ARTIFACT_POLICY_READ_FAILED");
  const sourceBucketPolicy = executeJson(execFileImpl, [
    "storage",
    "buckets",
    "get-iam-policy",
    deployResourcePolicyScopes.sourceBucket,
    "--format=json",
    ...commonGcloudFlags(),
  ], "DEPLOY_IDENTITY_SOURCE_BUCKET_POLICY_READ_FAILED");
  const capabilitySecretPolicy = executeJson(execFileImpl, [
    "secrets",
    "get-iam-policy",
    "LUDYS_CAPABILITY_HMAC_KEY",
    "--format=json",
    ...commonGcloudFlags(),
  ], "DEPLOY_IDENTITY_CAPABILITY_SECRET_POLICY_READ_FAILED");
  const base = {
    parentScope,
    organizationIamPolicyReadbackPerformed: true,
    organizationIamPolicy,
    projectPolicy,
    resourcePolicyReadbackPerformed: true,
    resourcePolicyScopes: deployResourcePolicyScopes,
    artifactRepositoryPolicy,
    sourceBucketPolicy,
    capabilitySecretPolicy,
    ...(includeRunServicePolicies
      ? {
          runServicePoliciesReadbackPerformed: true,
          runServicePolicyScopes: deployRunServicePolicyScopes,
          runServicePolicies: runServicePolicies(execFileImpl),
        }
      : {}),
  };
  const accounts = serviceAccounts(execFileImpl);
  const deployAccount = accounts.find((entry) => (
    entry?.email === deployIdentityScope.deployServiceAccount
  ));
  if (deployAccount === undefined) {
    return {
      ...base,
      deployServiceAccount: undefined,
      runtimeServiceAccountPolicy: serviceAccountPolicy(
        execFileImpl,
        deployIdentityScope.runtimeServiceAccount,
        "DEPLOY_IDENTITY_RUNTIME_POLICY_READ_FAILED",
      ),
      buildServiceAccountPolicy: serviceAccountPolicy(
        execFileImpl,
        deployIdentityScope.buildServiceAccount,
        "DEPLOY_IDENTITY_BUILD_POLICY_READ_FAILED",
      ),
    };
  }
  const keys = executeJson(execFileImpl, [
    "iam",
    "service-accounts",
    "keys",
    "list",
    `--iam-account=${deployIdentityScope.deployServiceAccount}`,
    "--managed-by=user",
    "--format=json",
    ...commonGcloudFlags(),
  ], "DEPLOY_IDENTITY_KEY_READ_FAILED");
  if (!Array.isArray(keys)) throw controlError("DEPLOY_IDENTITY_KEY_READBACK_INVALID");
  return {
    ...base,
    deployServiceAccount: {
      email: deployAccount.email,
      disabled: deployAccount.disabled === true,
      userManagedKeys: keys,
    },
    deployServiceAccountPolicy: serviceAccountPolicy(
      execFileImpl,
      deployIdentityScope.deployServiceAccount,
      "DEPLOY_IDENTITY_POLICY_READ_FAILED",
    ),
    runtimeServiceAccountPolicy: serviceAccountPolicy(
      execFileImpl,
      deployIdentityScope.runtimeServiceAccount,
      "DEPLOY_IDENTITY_RUNTIME_POLICY_READ_FAILED",
    ),
    buildServiceAccountPolicy: serviceAccountPolicy(
      execFileImpl,
      deployIdentityScope.buildServiceAccount,
      "DEPLOY_IDENTITY_BUILD_POLICY_READ_FAILED",
    ),
  };
}

function bindingMatches(binding, role, member, condition) {
  return binding?.role === role
    && Array.isArray(binding.members)
    && binding.members.includes(member)
    && binding.condition?.title === condition.title
    && binding.condition?.description === condition.description
    && binding.condition?.expression === condition.expression;
}

function hasBinding(policy, role, member, condition) {
  return Array.isArray(policy?.bindings)
    && policy.bindings.some((binding) => bindingMatches(
      binding,
      role,
      member,
      condition,
    ));
}

function commandBindingPresent(snapshot, args, condition) {
  const role = args.find((value) => value.startsWith("--role="))?.slice(7);
  const member = args.find((value) => value.startsWith("--member="))?.slice(9);
  if (role === undefined || member === undefined) return false;
  if (args[0] === "projects") {
    return hasBinding(snapshot.projectPolicy, role, member, condition);
  }
  if (args[0] === "run" && args[1] === "services") {
    const serviceId = args[3];
    const entry = snapshot.runServicePolicies?.find(
      (candidate) =>
        candidate.serviceName
          === (
            `projects/${deployIdentityScope.projectId}/locations/`
            + `${deployIdentityScope.region}/services/${serviceId}`
          ),
    );
    return hasBinding(entry?.policy, role, member, condition);
  }
  const target = args[3];
  const policy = target === deployIdentityScope.deployServiceAccount
    ? snapshot.deployServiceAccountPolicy
    : target === deployIdentityScope.runtimeServiceAccount
      ? snapshot.runtimeServiceAccountPolicy
      : snapshot.buildServiceAccountPolicy;
  return hasBinding(policy, role, member, condition);
}

function policyBindings(policy, code) {
  if (
    policy === null
    || typeof policy !== "object"
    || Array.isArray(policy)
    || (
      policy.bindings !== undefined
      && !Array.isArray(policy.bindings)
    )
  ) throw controlError(code);
  const bindings = policy.bindings ?? [];
  for (const binding of bindings) {
    if (
      binding === null
      || typeof binding !== "object"
      || Array.isArray(binding)
      || typeof binding.role !== "string"
      || binding.role.length === 0
      || !Array.isArray(binding.members)
      || binding.members.length === 0
      || binding.members.some(
        (member) => typeof member !== "string" || member.length === 0,
      )
      || (
        binding.condition !== undefined
        && (
          binding.condition === null
          || typeof binding.condition !== "object"
          || typeof binding.condition.title !== "string"
          || typeof binding.condition.description !== "string"
          || typeof binding.condition.expression !== "string"
        )
      )
    ) throw controlError(code);
  }
  return bindings;
}

function assertDeletionTransitionPreflight(snapshot, windowExpiresAt) {
  const foundationalErrors = [
    ...normalizedDeployParentScopeEvidence(snapshot).errors,
    ...normalizedDeployProjectScopeEvidence(snapshot).errors,
    ...normalizedDeployResourcePolicyEvidence(snapshot).errors,
  ];
  const deletionCondition =
    syntheticDeletionWindowCondition(windowExpiresAt);
  const runEvidence = normalizedDeployDeletionRunPolicyEvidence(snapshot, {
    condition: deletionCondition,
    expectDeletionBinding: false,
  });
  const expectedRunTransitionErrors = runEvidence.errors.filter(
    (error) =>
      error.endsWith("_DEPLOY_MEMBER_EXTRA_OR_ALTERED_BINDING_FORBIDDEN"),
  );
  foundationalErrors.push(
    ...runEvidence.errors.filter(
      (error) => !expectedRunTransitionErrors.includes(error),
    ),
  );
  if (
    snapshot?.deployServiceAccount?.email
      !== deployIdentityScope.deployServiceAccount
    || snapshot.deployServiceAccount.disabled === true
  ) foundationalErrors.push("DEPLOY_SERVICE_ACCOUNT_READBACK_MISMATCH");
  if (
    !Array.isArray(snapshot?.deployServiceAccount?.userManagedKeys)
    || snapshot.deployServiceAccount.userManagedKeys.length !== 0
  ) foundationalErrors.push("DEPLOY_SERVICE_ACCOUNT_USER_MANAGED_KEYS_FORBIDDEN");

  const deployPolicy = policyBindings(
    snapshot.deployServiceAccountPolicy,
    "DEPLOY_SERVICE_ACCOUNT_POLICY_TRANSITION_INVALID",
  );
  if (deployPolicy.some((binding) => (
    binding.role !== "roles/iam.serviceAccountTokenCreator"
    || binding.members.length !== 1
    || binding.members[0] !== deployIdentityScope.operatorMember
    || binding.condition === undefined
  ))) {
    foundationalErrors.push(
      "DEPLOY_SERVICE_ACCOUNT_POLICY_TRANSITION_NOT_EXACT_OWNER_TOKEN_CREATOR",
    );
  }
  for (const [policy, label] of [
    [
      snapshot.runtimeServiceAccountPolicy,
      "DEPLOY_RUNTIME_SERVICE_ACCOUNT_POLICY_TRANSITION_INVALID",
    ],
    [
      snapshot.buildServiceAccountPolicy,
      "DEPLOY_BUILD_SERVICE_ACCOUNT_POLICY_TRANSITION_INVALID",
    ],
  ]) {
    const bindings = policyBindings(policy, label);
    if (bindings.some((binding) => (
      binding.role !== "roles/iam.serviceAccountUser"
      || binding.members.length !== 1
      || membersForApprovedEmail(
        binding,
        deployIdentityScope.deployServiceAccount,
      ).length !== 1
      || binding.condition === undefined
    ))) foundationalErrors.push(label);
  }
  for (
    const entry of (
      Array.isArray(snapshot.runServicePolicies)
        ? snapshot.runServicePolicies
        : []
    )
  ) {
    for (
      const binding of policyBindings(
        entry.policy,
        "DEPLOY_RUN_SERVICE_POLICY_TRANSITION_INVALID",
      )
    ) {
      const deployMembers = membersForApprovedEmail(
        binding,
        deployIdentityScope.deployServiceAccount,
      );
      if (
        deployMembers.length > 0
        && (
          binding.role !== "roles/run.invoker"
          || binding.members.length !== 1
          || deployMembers.length !== 1
          || binding.condition === undefined
        )
      ) {
        foundationalErrors.push(
          "DEPLOY_RUN_SERVICE_POLICY_TRANSITION_DEPLOY_BINDING_INVALID",
        );
      }
    }
  }
  if (foundationalErrors.length !== 0) {
    throw controlError(
      `DEPLOY_IDENTITY_DELETION_TRANSITION_UNSAFE_${
        foundationalErrors.join("_")
      }`,
    );
  }
  return deletionCondition;
}

function safeSummary(snapshot, windowExpiresAt, authorityState) {
  const parentScope =
    normalizedDeployParentScopeEvidence(snapshot);
  const projectScope =
    normalizedDeployProjectScopeEvidence(snapshot);
  const resourcePolicies =
    normalizedDeployResourcePolicyEvidence(snapshot);
  const deletionLifecycle = (
    authorityState === deployIdentityAuthorityStates.deletionOnly
    || authorityState === deployIdentityAuthorityStates.allAuthorityRevoked
  );
  const deletionRunPolicies = deletionLifecycle
    ? normalizedDeployDeletionRunPolicyEvidence(snapshot, {
        condition: syntheticDeletionWindowCondition(windowExpiresAt),
        expectDeletionBinding:
          authorityState === deployIdentityAuthorityStates.deletionOnly,
      })
    : undefined;
  return {
    schemaVersion: "wp13.12b-ea-deploy-identity-readback-v3",
    projectId: deployIdentityScope.projectId,
    deployServiceAccount: deployIdentityScope.deployServiceAccount,
    runtimeServiceAccount: deployIdentityScope.runtimeServiceAccount,
    previewServiceAccount: deployIdentityScope.previewServiceAccount,
    buildServiceAccount: deployIdentityScope.buildServiceAccount,
    windowExpiresAt,
    userManagedKeyCount:
      snapshot.deployServiceAccount?.userManagedKeys?.length ?? null,
    identitiesDistinct: new Set([
      deployIdentityScope.deployServiceAccount,
      deployIdentityScope.runtimeServiceAccount,
      deployIdentityScope.previewServiceAccount,
      deployIdentityScope.buildServiceAccount,
    ]).size === 4,
    authorityState,
    broadDeployBindingsRevoked:
      authorityState !== deployIdentityAuthorityStates.deployReady,
    impersonationAndDeployBindingsRevoked:
      authorityState === deployIdentityAuthorityStates.deployBindingsRevoked
      || authorityState
        === deployIdentityAuthorityStates.allAuthorityRevoked,
    deletionOnlyAuthorityActive:
      authorityState === deployIdentityAuthorityStates.deletionOnly,
    allDeployAndDeletionAuthorityRevoked:
      authorityState === deployIdentityAuthorityStates.allAuthorityRevoked,
    deleteSyntheticSessionResource:
      deployDeletionRunServiceScope.resource,
    syntheticDeletionOrdinaryGraceEndsAt:
      SYNTHETIC_DELETION_GRACE_END,
    parentScopeEvidence: parentScope.evidence,
    projectScopeEvidence: projectScope.evidence,
    resourcePolicyEvidence: resourcePolicies.evidence,
    ...(deletionRunPolicies === undefined
      ? {}
      : {
          deletionRunPolicyEvidence: deletionRunPolicies.evidence,
        }),
    tokenPrinted: false,
    credentialFileCreated: false,
  };
}

async function runDeployIdentityControlCore(argv, options) {
  const args = parseExactFlagPairs(argv);
  assertScope(args, options.requestScope);
  const action = args.get("--action");
  if (!ACTIONS.has(action)) throw controlError("DEPLOY_IDENTITY_ACTION_NOT_ALLOWED");
  const mutatesAuthority = MUTATION_ACTIONS.has(action);
  const authorization = args.get("--authorized");
  const activationAuthorization = authorizationForRequestScope(
    deployIdentityScope.activationAuthorization,
    options.requestScope,
  );
  const syntheticDataDeletionAuthorization = authorizationForRequestScope(
    deployIdentityScope.syntheticDataDeletionAuthorization,
    options.requestScope,
  );
  if (
    action === "provision"
    && authorization !== activationAuthorization
  ) throw controlError("EXACT_EXTERNAL_ACTIVATION_AUTHORIZATION_REQUIRED");
  if (
    action === "downscope-for-synthetic-deletion"
    && authorization !== syntheticDataDeletionAuthorization
  ) {
    throw controlError(
      "EXACT_SYNTHETIC_DATA_DELETION_AUTHORIZATION_REQUIRED",
    );
  }
  if (
    action === "revoke"
    && authorization !== undefined
    && authorization !== activationAuthorization
  ) throw controlError("UNEXPECTED_REVOKE_AUTHORIZATION_FORBIDDEN");
  if (
    action === "revoke-deletion-identity"
    && authorization !== undefined
    && authorization !== syntheticDataDeletionAuthorization
  ) {
    throw controlError(
      "UNEXPECTED_SYNTHETIC_DELETION_REVOKE_AUTHORIZATION_FORBIDDEN",
    );
  }
  if (
    (action === "plan" || action === "verify")
    && args.has("--authorized")
  ) throw controlError("AUTHORIZATION_FLAG_FOR_READ_ONLY_ACTION_FORBIDDEN");
  if (
    mutatesAuthority
    && typeof options.assertMutationAuthority !== "function"
  ) {
    throw controlError(
      "DEPLOY_IDENTITY_MUTATION_CAPABILITY_REQUIRED",
    );
  }
  const execFileImpl = options.execFileImpl;
  const googleOAuthAuthority = options.googleOAuthAuthority;
  const now = options.now;
  const windowExpiresAt = args.get("--window-expires-at");
  if (action === "revoke") {
    assertRecordedDeployWindow(windowExpiresAt);
  } else if (action === "revoke-deletion-identity") {
    assertRecordedSyntheticDeletionWindow(windowExpiresAt);
  } else if (action === "downscope-for-synthetic-deletion") {
    assertSyntheticDeletionWindow(windowExpiresAt, now());
  } else {
    assertDeployWindow(windowExpiresAt, now());
  }
  const assertMutationWriteAuthorized = async () => {
    if (!mutatesAuthority) {
      throw controlError("READ_ONLY_IDENTITY_ACTION_CANNOT_MUTATE");
    }
    await options.assertMutationAuthority();
    if (action === "provision") {
      assertDeployWindow(windowExpiresAt, now());
    } else if (action === "downscope-for-synthetic-deletion") {
      assertSyntheticDeletionWindow(windowExpiresAt, now());
    } else if (action === "revoke") {
      assertRecordedDeployWindow(windowExpiresAt);
    } else {
      assertRecordedSyntheticDeletionWindow(windowExpiresAt);
    }
  };
  if (mutatesAuthority) {
    await assertMutationWriteAuthorized();
  }
  const mutationCommands = (
    action === "plan"
    || action === "provision"
    || action === "verify"
    || action === "revoke"
  )
    ? deployIdentityMutationCommands(
        windowExpiresAt,
        action !== "revoke",
      )
    : [];
  if (action === "plan") {
    return Object.freeze({
      schemaVersion: "wp13.12b-ea-deploy-identity-plan-v1",
      action,
      externalWrites: 0,
      deployServiceAccount: deployIdentityScope.deployServiceAccount,
      windowExpiresAt,
      createServiceAccountArgs: Object.freeze([
        "iam",
        "service-accounts",
        "create",
        deployAccountId,
        "--display-name=LUDYS WP13.12B deployer",
        "--description=Temporary keyless synthetic staging deployment identity.",
        ...commonGcloudFlags(),
      ]),
      conditionedBindingArgs: mutationCommands,
      userManagedKeysAllowed: 0,
      postDeploymentRevocationRequired: true,
    });
  }

  const deletionLifecycle = (
    action === "downscope-for-synthetic-deletion"
    || action === "revoke-deletion-identity"
  );
  const readbackOptions = {
    includeRunServicePolicies: deletionLifecycle,
  };
  let snapshot = await readback(
    execFileImpl,
    googleOAuthAuthority,
    readbackOptions,
  );
  let externalWrites = 0;
  if (action === "provision") {
    const preflight = validateDeployIdentityReadback(snapshot, {
      windowExpiresAt,
      expectRevoked: false,
    });
    const unsafe = preflight.errors.filter((error) => (
      (
        error.includes("FORBIDDEN")
        && !(
          snapshot.deployServiceAccount === undefined
          && error.includes("USER_MANAGED_KEYS")
        )
      )
      || error.includes("DISABLED")
      || error.includes("IDENTITIES_MUST_BE_DISTINCT")
      || /^(?:ORGANIZATION|INHERITED|DEPLOY_PARENT|DEPLOY_RESOURCE|BROAD|APPROVED_IDENTITY)/u
        .test(error)
    ));
    if (unsafe.length > 0) {
      throw controlError(`DEPLOY_IDENTITY_UNSAFE_PREFLIGHT_${unsafe.join("_")}`);
    }
  }
  if (action === "provision" && snapshot.deployServiceAccount === undefined) {
    await assertMutationWriteAuthorized();
    execute(execFileImpl, [
      "iam",
      "service-accounts",
      "create",
      deployAccountId,
      "--display-name=LUDYS WP13.12B deployer",
      "--description=Temporary keyless synthetic staging deployment identity.",
      ...commonGcloudFlags(),
    ], "DEPLOY_IDENTITY_CREATE_FAILED");
    externalWrites += 1;
    snapshot = await readback(
      execFileImpl,
      googleOAuthAuthority,
      readbackOptions,
    );
  }
  if (snapshot.deployServiceAccount === undefined) {
    throw controlError("DEPLOY_IDENTITY_SERVICE_ACCOUNT_MISSING");
  }

  if (deletionLifecycle) {
    const deletionCondition =
      syntheticDeletionWindowCondition(windowExpiresAt);
    if (action === "downscope-for-synthetic-deletion") {
      assertDeletionTransitionPreflight(snapshot, windowExpiresAt);
    }
    const revocations = observedAuthorityRevocationCommands(snapshot, {
      preserveDeletionOnlyBindings:
        action === "downscope-for-synthetic-deletion",
      deletionCondition,
    });
    for (const command of revocations) {
      await assertMutationWriteAuthorized();
      execute(
        execFileImpl,
        command,
        "DEPLOY_IDENTITY_DELETION_TRANSITION_REVOCATION_FAILED",
      );
      externalWrites += 1;
    }
    if (action === "downscope-for-synthetic-deletion") {
      for (
        const command of syntheticDeletionIdentityAddCommands(
          windowExpiresAt,
        )
      ) {
        if (!commandBindingPresent(snapshot, command, deletionCondition)) {
          await assertMutationWriteAuthorized();
          execute(
            execFileImpl,
            command,
            "DEPLOY_IDENTITY_DELETION_ONLY_BINDING_ADD_FAILED",
          );
          externalWrites += 1;
        }
      }
    }
  } else {
    const condition = deployWindowCondition(windowExpiresAt);
    for (const command of mutationCommands) {
      const present = commandBindingPresent(snapshot, command, condition);
      if (
        (action === "provision" && !present)
        || (action === "revoke" && present)
      ) {
        await assertMutationWriteAuthorized();
        execute(execFileImpl, command, "DEPLOY_IDENTITY_BINDING_MUTATION_FAILED");
        externalWrites += 1;
      }
    }
  }

  const verified = await readback(
    execFileImpl,
    googleOAuthAuthority,
    readbackOptions,
  );
  const authorityState = action === "revoke"
    ? deployIdentityAuthorityStates.deployBindingsRevoked
    : action === "downscope-for-synthetic-deletion"
      ? deployIdentityAuthorityStates.deletionOnly
      : action === "revoke-deletion-identity"
        ? deployIdentityAuthorityStates.allAuthorityRevoked
        : deployIdentityAuthorityStates.deployReady;
  const validation = validateDeployIdentityReadback(verified, {
    windowExpiresAt,
    expectedAuthorityState: authorityState,
  });
  if (!validation.valid) {
    throw controlError(`DEPLOY_IDENTITY_READBACK_FAILED_${validation.errors.join("_")}`);
  }
  return Object.freeze({
    ...safeSummary(verified, windowExpiresAt, authorityState),
    action,
    externalWrites,
    validationErrors: validation.errors,
  });
}

export async function runDeployIdentityControl(argv, options = {}) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).some((key) => key !== "activationCapability")
  ) {
    throw controlError(
      "PRODUCTION_DEPLOY_IDENTITY_DEPENDENCY_INJECTION_FORBIDDEN",
    );
  }
  const parsed = parseExactFlagPairs(argv);
  assertScope(parsed);
  const action = parsed.get("--action");
  let assertMutationAuthority;
  if (action === "provision") {
    assertBaseActivationCapability(options.activationCapability);
    assertMutationAuthority = () =>
      assertBaseActivationCapability(options.activationCapability);
  } else if (action === "downscope-for-synthetic-deletion") {
    const capability = options.activationCapability
      ?? await acquireCleanupActivationCapability();
    assertCleanupActivationCapability(capability);
    assertMutationAuthority = () =>
      assertCleanupActivationCapability(capability);
  } else if (REVOCATION_ONLY_ACTIONS.has(action)) {
    const cleanupCapability = options.activationCapability
      ?? await acquireCleanupActivationCapability();
    const revocationCapability = mintRevocationOnlyCapability(
      action,
      parsed,
      cleanupCapability,
    );
    assertMutationAuthority = () =>
      assertRevocationOnlyCapability(
        revocationCapability,
        action,
        parsed,
      );
  }
  if (action === "plan") {
    return runDeployIdentityControlCore(argv, {
      assertMutationAuthority: undefined,
      execFileImpl: undefined,
      googleOAuthAuthority: undefined,
      now: () => new Date(),
      requestScope: deployIdentityScope,
    });
  }
  assertNoDangerousExternalEnvironment(process.env);
  const googleOAuth = await acquirePinnedGoogleOAuthAccessToken();
  return runDeployIdentityControlCore(argv, {
    assertMutationAuthority,
    execFileImpl: createPinnedGoogleCloudCliExecFile({
      environment: process.env,
      googleOAuth,
    }),
    googleOAuthAuthority: googleOAuth,
    now: () => new Date(),
    requestScope: deployIdentityScope,
  });
}

export async function runDeployIdentityControlForTesting(
  argv,
  options = {},
) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || typeof options.execFileImpl !== "function"
    || options.execFileImpl === execFileSync
    || typeof options.now !== "function"
    || Object.keys(options).some(
      (key) =>
        !["assertMutationAuthority", "execFileImpl", "now"].includes(key),
    )
  ) {
    throw controlError(
      "EXACT_DEPLOY_IDENTITY_TEST_ADAPTER_REQUIRED",
    );
  }
  const parsed = parseExactFlagPairs(argv);
  assertScope(parsed, externalControlTestScope);
  const action = parsed.get("--action");
  const assertMutationAuthority = options.assertMutationAuthority ?? (
    MUTATION_ACTIONS.has(action)
      ? () => {
          throw controlError(
            action === "provision"
              ? "VALIDATED_ACTIVATION_CAPABILITY_REQUIRED"
              : "TEST_MUTATION_AUTHORITY_REQUIRED",
          );
        }
      : undefined
  );
  return runDeployIdentityControlCore(argv, {
    assertMutationAuthority,
    execFileImpl: testScopedExecFile(options.execFileImpl),
    googleOAuthAuthority: Object.freeze({
      approvedGoogleAccount:
        deployIdentityScope.approvedGoogleAccount,
      tokenPrinted: false,
    }),
    now: options.now,
    requestScope: externalControlTestScope,
  });
}

function safeError(error) {
  const code = typeof error?.code === "string"
    ? error.code
    : typeof error?.message === "string" ? error.message : "";
  return /^[A-Z0-9_:.-]{3,500}$/u.test(code)
    ? code
    : "DEPLOY_IDENTITY_CONTROL_FAILED_CLOSED";
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && fileURLToPath(import.meta.url) === invokedPath
) {
  try {
    const actionIndex = process.argv.indexOf("--action");
    const action = actionIndex >= 0
      ? process.argv[actionIndex + 1]
      : undefined;
    const activationCapability = action === "provision"
      ? await acquireBaseActivationCapability()
      : undefined;
    const result = await runDeployIdentityControl(
      process.argv.slice(2),
      { activationCapability },
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${safeError(error)}\n`);
    process.exitCode = 1;
  }
}
