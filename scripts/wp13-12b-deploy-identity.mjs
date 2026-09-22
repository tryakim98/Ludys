const FULL_SHA256 = /^[a-f0-9]{64}$/u;
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

export const DEPLOY_WINDOW_MAX_MS = 60 * 60 * 1000;
export const DEPLOY_WINDOW_MIN_MS = 5 * 60 * 1000;
export const SYNTHETIC_DELETION_WINDOW_MAX_MS = 30 * 60 * 1000;
export const SYNTHETIC_DELETION_WINDOW_MIN_MS = 5 * 60 * 1000;
export const SYNTHETIC_DELETION_GRACE_END =
  "2027-01-26T00:00:00.000Z";

export const deployIdentityScope = Object.freeze({
  projectId: "ludys-12b-stg-20260725",
  projectNumber: "134654966474",
  organizationId: "724335528970",
  approvedGoogleAccount: "tryakim@gmail.com",
  region: "europe-north1",
  stagingExpiryDate: "2027-01-25",
  deployServiceAccount:
    "ludys-staging-deployer@ludys-12b-stg-20260725.iam.gserviceaccount.com",
  runtimeServiceAccount:
    "ludys-staging-runtime@ludys-12b-stg-20260725.iam.gserviceaccount.com",
  previewServiceAccount:
    "ludys-preview-invoker@ludys-12b-stg-20260725.iam.gserviceaccount.com",
  buildServiceAccount:
    "134654966474-compute@developer.gserviceaccount.com",
  operatorMember: "user:tryakim@gmail.com",
  activationAuthorization: "AUTHORIZE_WP13_12B_EXTERNAL_ACTIVATION",
  syntheticDataDeletionAuthorization:
    "AUTHORIZE_WP13_12B_SYNTHETIC_DATA_DELETION_EXECUTION;"
    + "project=ludys-12b-stg-20260725;expiry=2027-01-25;"
    + "scope=bounded-synthetic-session-delete",
});

export const deployParentScope = Object.freeze({
  projectParent: "organizations/724335528970",
  organizationId: "724335528970",
  projectServiceAccountPrincipalSet:
    "principalSet://cloudresourcemanager.googleapis.com/projects/"
    + "134654966474/type/ServiceAccount",
  organizationServiceAccountPrincipalSet:
    "principalSet://cloudresourcemanager.googleapis.com/organizations/"
    + "724335528970/type/ServiceAccount",
});

export const deployResourcePolicyScopes = Object.freeze({
  artifactRepository:
    "projects/ludys-12b-stg-20260725/locations/europe-north1/"
    + "repositories/gcf-artifacts",
  sourceBucket:
    "gs://gcf-v2-sources-134654966474-europe-north1",
  capabilitySecret:
    "projects/134654966474/secrets/LUDYS_CAPABILITY_HMAC_KEY",
});

export const deployDeletionRunServiceScope = Object.freeze({
  serviceId: "deletesyntheticsession",
  resource:
    "projects/ludys-12b-stg-20260725/locations/europe-north1/"
    + "services/deletesyntheticsession",
});

export const deployProjectRoles = Object.freeze([
  "roles/cloudfunctions.developer",
  "roles/firebaserules.admin",
  "roles/run.admin",
  "roles/serviceusage.serviceUsageConsumer",
]);

export const deployServiceAccountUserTargets = Object.freeze([
  deployIdentityScope.runtimeServiceAccount,
  deployIdentityScope.buildServiceAccount,
]);

export const deployFunctionNames = Object.freeze([
  "issueSyntheticSession",
  "sessionCommand",
  "sessionProjection",
  "deleteSyntheticSession",
  "health",
]);

export const deployRunServicePolicyScopes = Object.freeze(
  deployFunctionNames.map((name) => (
    `projects/${deployIdentityScope.projectId}/locations/`
    + `${deployIdentityScope.region}/services/${name.toLowerCase()}`
  )),
);

export const deployIdentityAuthorityStates = Object.freeze({
  deployReady: "DEPLOY_READY",
  deployBindingsRevoked: "DEPLOY_BINDINGS_REVOKED",
  deletionOnly: "SYNTHETIC_DELETION_ONLY",
  allAuthorityRevoked: "ALL_DEPLOY_AND_DELETION_AUTHORITY_REVOKED",
});

export const deploymentImpersonationFlag =
  `--impersonate-service-account=${deployIdentityScope.deployServiceAccount}`;

function deploymentError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function asInstant(value, code) {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) {
    throw deploymentError(code);
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    throw deploymentError(code);
  }
  return time;
}

export function assertDeployWindow(expiresAt, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) {
    throw deploymentError("DEPLOY_WINDOW_NOW_INVALID");
  }
  const expiry = asInstant(expiresAt, "DEPLOY_WINDOW_EXPIRY_INVALID");
  const duration = expiry - now.valueOf();
  if (duration < DEPLOY_WINDOW_MIN_MS || duration > DEPLOY_WINDOW_MAX_MS) {
    throw deploymentError("DEPLOY_WINDOW_DURATION_OUTSIDE_BOUNDARY");
  }
  const stagingExpiry = Date.parse(`${deployIdentityScope.stagingExpiryDate}T00:00:00.000Z`);
  if (now.valueOf() >= stagingExpiry || expiry > stagingExpiry) {
    throw deploymentError("DEPLOY_WINDOW_OUTSIDE_STAGING_TERM");
  }
  return expiresAt;
}

export function assertRecordedDeployWindow(expiresAt) {
  const expiry = asInstant(expiresAt, "DEPLOY_WINDOW_EXPIRY_INVALID");
  const stagingExpiry = Date.parse(`${deployIdentityScope.stagingExpiryDate}T00:00:00.000Z`);
  if (expiry > stagingExpiry) {
    throw deploymentError("DEPLOY_WINDOW_OUTSIDE_STAGING_TERM");
  }
  return expiresAt;
}

export function assertSyntheticDeletionWindow(expiresAt, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) {
    throw deploymentError("SYNTHETIC_DELETION_WINDOW_NOW_INVALID");
  }
  const expiry = asInstant(
    expiresAt,
    "SYNTHETIC_DELETION_WINDOW_EXPIRY_INVALID",
  );
  const duration = expiry - now.valueOf();
  if (
    duration < SYNTHETIC_DELETION_WINDOW_MIN_MS
    || duration > SYNTHETIC_DELETION_WINDOW_MAX_MS
  ) {
    throw deploymentError(
      "SYNTHETIC_DELETION_WINDOW_DURATION_OUTSIDE_BOUNDARY",
    );
  }
  if (expiry > Date.parse(SYNTHETIC_DELETION_GRACE_END)) {
    throw deploymentError(
      "SYNTHETIC_DELETION_WINDOW_OUTSIDE_ORDINARY_EXPIRY_GRACE",
    );
  }
  return expiresAt;
}

export function assertRecordedSyntheticDeletionWindow(expiresAt) {
  const expiry = asInstant(
    expiresAt,
    "SYNTHETIC_DELETION_WINDOW_EXPIRY_INVALID",
  );
  if (expiry > Date.parse(SYNTHETIC_DELETION_GRACE_END)) {
    throw deploymentError(
      "SYNTHETIC_DELETION_WINDOW_OUTSIDE_ORDINARY_EXPIRY_GRACE",
    );
  }
  return expiresAt;
}

export function deployWindowCondition(expiresAt) {
  assertRecordedDeployWindow(expiresAt);
  const compact = expiresAt.replaceAll(/[^0-9]/gu, "").slice(0, 14);
  return Object.freeze({
    title: `ludys_wp13_12b_deploy_${compact}`,
    description: "Temporary keyless WP13.12B deploy window; revoke after deployment.",
    expression: `request.time < timestamp("${expiresAt}")`,
  });
}

export function syntheticDeletionWindowCondition(expiresAt) {
  assertRecordedSyntheticDeletionWindow(expiresAt);
  const compact = expiresAt.replaceAll(/[^0-9]/gu, "").slice(0, 14);
  return Object.freeze({
    title: `ludys_wp13_12b_synthetic_delete_${compact}`,
    description:
      "Temporary keyless WP13.12B synthetic-session deletion authority; "
      + "revoke in guaranteed-finally cleanup.",
    expression: `request.time < timestamp("${expiresAt}")`,
  });
}

export function canonicalPreviewOrigin(value) {
  if (typeof value !== "string" || value.length < 20 || value.length > 253) {
    throw deploymentError("PROTECTED_PREVIEW_ORIGIN_INVALID");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw deploymentError("PROTECTED_PREVIEW_ORIGIN_INVALID");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.origin !== value
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.port !== ""
    || parsed.search !== ""
    || parsed.hash !== ""
    || parsed.pathname !== "/"
    || !parsed.hostname.startsWith("ludys-wp13-12b-staging-")
    || !parsed.hostname.endsWith(".vercel.app")
  ) {
    throw deploymentError("PROTECTED_PREVIEW_ORIGIN_INVALID");
  }
  return value;
}

export function assertImpersonatedGcloudArgs(args) {
  if (!Array.isArray(args) || args.length === 0) {
    throw deploymentError("DEPLOY_COMMAND_ARGS_REQUIRED");
  }
  const required = [
    `--project=${deployIdentityScope.projectId}`,
    `--account=${deployIdentityScope.approvedGoogleAccount}`,
    `--region=${deployIdentityScope.region}`,
    deploymentImpersonationFlag,
  ];
  for (const flag of required) {
    if (args.filter((value) => value === flag).length !== 1) {
      throw deploymentError("DEPLOY_COMMAND_SCOPE_OR_IMPERSONATION_MISMATCH");
    }
  }
  if (
    args.some((value) => (
      typeof value !== "string"
      || value.startsWith("--access-token-file")
      || value.startsWith("--credential-file-override")
    ))
  ) {
    throw deploymentError("DEPLOY_COMMAND_LONG_LIVED_CREDENTIAL_PATH_FORBIDDEN");
  }
  return true;
}

function exactCondition(actual, expected) {
  return actual?.title === expected.title
    && actual?.description === expected.description
    && actual?.expression === expected.expression;
}

function deployMember() {
  return `serviceAccount:${deployIdentityScope.deployServiceAccount}`;
}

const approvedServiceAccountEmails = Object.freeze([
  deployIdentityScope.deployServiceAccount,
  deployIdentityScope.runtimeServiceAccount,
  deployIdentityScope.previewServiceAccount,
  deployIdentityScope.buildServiceAccount,
]);
const inheritedSensitiveDirectPrincipalRoles = new Set([
  "roles/editor",
  "roles/iam.securityAdmin",
  "roles/iam.serviceAccountAdmin",
  "roles/iam.serviceAccountKeyAdmin",
  "roles/iam.serviceAccountOpenIdTokenCreator",
  "roles/iam.serviceAccountTokenCreator",
  "roles/iam.serviceAccountUser",
  "roles/iam.workloadIdentityUser",
  "roles/owner",
  "roles/resourcemanager.organizationAdmin",
  "roles/resourcemanager.projectIamAdmin",
  "roles/resourcemanager.projectMover",
]);

function isRecord(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value);
}

function validatedPolicyBindings(policy, label, errors) {
  if (!isRecord(policy)) {
    errors.push(`${label}_IAM_POLICY_READBACK_REQUIRED`);
    return [];
  }
  if (policy.bindings === undefined) return [];
  if (!Array.isArray(policy.bindings)) {
    errors.push(`${label}_IAM_POLICY_BINDINGS_INVALID`);
    return [];
  }
  const result = [];
  for (const binding of policy.bindings) {
    if (
      !isRecord(binding)
      || typeof binding.role !== "string"
      || binding.role.length === 0
      || !Array.isArray(binding.members)
      || binding.members.some(
        (member) => typeof member !== "string" || member.length === 0,
      )
    ) {
      errors.push(`${label}_IAM_POLICY_BINDING_INVALID`);
      continue;
    }
    result.push(binding);
  }
  return result;
}

function exactBindingShape(actual, expected) {
  return (
    actual.role === expected.role
    && actual.members.length === expected.members.length
    && actual.members.every(
      (member, index) => member === expected.members[index],
    )
    && (
      expected.condition === undefined
        ? actual.condition === undefined
        : exactCondition(actual.condition, expected.condition)
    )
  );
}

function validateExactFullPolicyBindings(
  policy,
  label,
  expectedBindings,
  errors,
) {
  const actualBindings = validatedPolicyBindings(policy, label, errors);
  const unmatchedExpected = new Set(expectedBindings.keys());
  for (const actual of actualBindings) {
    const match = [...unmatchedExpected].find(
      (index) => exactBindingShape(actual, expectedBindings[index]),
    );
    if (match === undefined) {
      errors.push(`${label}_EXTRA_OR_ALTERED_BINDING_FORBIDDEN`);
    } else {
      unmatchedExpected.delete(match);
    }
  }
  if (unmatchedExpected.size !== 0) {
    errors.push(`${label}_EXPECTED_BINDING_MISSING`);
  }
  return actualBindings;
}

function approvedServiceAccountEmail(member) {
  const serviceAccountPrefix = "serviceAccount:";
  const principalPrefix =
    "principal://iam.googleapis.com/projects/-/serviceAccounts/";
  const email = member.startsWith(serviceAccountPrefix)
    ? member.slice(serviceAccountPrefix.length)
    : member.startsWith(principalPrefix)
      ? member.slice(principalPrefix.length)
      : undefined;
  return approvedServiceAccountEmails.includes(email) ? email : undefined;
}

function inheritedMemberClass(member) {
  if (member === "allUsers" || member === "allAuthenticatedUsers") {
    return "PUBLIC";
  }
  if (approvedServiceAccountEmail(member) !== undefined) {
    return "DIRECT_APPROVED_SERVICE_ACCOUNT";
  }
  if (member.startsWith("principalSet://")) return "PRINCIPAL_SET";
  if (
    member.startsWith("group:")
    || member.startsWith("domain:")
    || member.startsWith("projectOwner:")
    || member.startsWith("projectEditor:")
    || member.startsWith("projectViewer:")
    || member.includes("*")
  ) return "UNRESOLVED_OR_BROAD";
  if (
    member.startsWith("user:")
    || member.startsWith("serviceAccount:")
    || member.startsWith(
      "principal://iam.googleapis.com/projects/-/serviceAccounts/",
    )
  ) return null;
  return "UNRESOLVED_OR_BROAD";
}

export function normalizedDeployParentScopeEvidence(readback) {
  const errors = [];
  if (
    readback?.parentScope?.projectId !== deployIdentityScope.projectId
    || readback?.parentScope?.projectNumber
      !== deployIdentityScope.projectNumber
    || readback?.parentScope?.projectParent
      !== deployParentScope.projectParent
    || readback?.parentScope?.organizationId
      !== deployParentScope.organizationId
    || readback?.parentScope?.directOrganizationParent !== true
    || readback?.parentScope?.folderAncestors?.length !== 0
  ) errors.push("DEPLOY_PARENT_SCOPE_READBACK_MISMATCH");
  if (readback?.organizationIamPolicyReadbackPerformed !== true) {
    errors.push("ORGANIZATION_IAM_POLICY_READBACK_REQUIRED");
  }
  const organizationBindings = validatedPolicyBindings(
    readback?.organizationIamPolicy,
    "ORGANIZATION",
    errors,
  );
  let directApprovedServiceAccountBindingCount = 0;
  let publicBindingCount = 0;
  let principalSetBindingCount = 0;
  let unresolvedOrBroadPrincipalBindingCount = 0;
  let sensitiveDirectPrincipalRoleBindingCount = 0;
  let approvedHumanOwnerSensitiveRoleBindingCount = 0;
  let unresolvedCustomRoleBindingCount = 0;
  for (const binding of organizationBindings) {
    const customRole = /^(?:organizations|projects)\/[^/]+\/roles\/[^/]+$/u
      .test(binding.role);
    if (customRole && binding.members.length > 0) {
      unresolvedCustomRoleBindingCount += 1;
    }
    for (const member of binding.members) {
      const memberClass = inheritedMemberClass(member);
      if (memberClass === "DIRECT_APPROVED_SERVICE_ACCOUNT") {
        directApprovedServiceAccountBindingCount += 1;
      } else if (memberClass === "PUBLIC") {
        publicBindingCount += 1;
      } else if (memberClass === "PRINCIPAL_SET") {
        principalSetBindingCount += 1;
      } else if (memberClass === "UNRESOLVED_OR_BROAD") {
        unresolvedOrBroadPrincipalBindingCount += 1;
      } else if (
        !customRole
        && inheritedSensitiveDirectPrincipalRoles.has(binding.role)
      ) {
        if (member === deployIdentityScope.operatorMember) {
          approvedHumanOwnerSensitiveRoleBindingCount += 1;
        } else {
          sensitiveDirectPrincipalRoleBindingCount += 1;
        }
      }
    }
  }
  if (directApprovedServiceAccountBindingCount !== 0) {
    errors.push("INHERITED_DIRECT_APPROVED_SERVICE_ACCOUNT_BINDING_FORBIDDEN");
  }
  if (publicBindingCount !== 0) {
    errors.push("INHERITED_PUBLIC_IAM_BINDING_FORBIDDEN");
  }
  if (principalSetBindingCount !== 0) {
    errors.push(
      "INHERITED_PRINCIPAL_SET_BINDING_FORBIDDEN",
    );
  }
  if (unresolvedOrBroadPrincipalBindingCount !== 0) {
    errors.push("INHERITED_UNRESOLVED_OR_BROAD_PRINCIPAL_FORBIDDEN");
  }
  if (sensitiveDirectPrincipalRoleBindingCount !== 0) {
    errors.push("INHERITED_SENSITIVE_DIRECT_PRINCIPAL_ROLE_FORBIDDEN");
  }
  if (unresolvedCustomRoleBindingCount !== 0) {
    errors.push("INHERITED_UNRESOLVED_CUSTOM_ROLE_FORBIDDEN");
  }
  return Object.freeze({
    evidence: Object.freeze({
      schemaVersion: "wp13.12b-ea-parent-scope-evidence-v1",
      evidenceScope:
        "DIRECT_PARENT_POLICY_WITH_UNRESOLVED_PRINCIPALS_ABSENT",
      globalEffectiveAuthorityAnalysisPerformed: false,
      exclusiveImpersonationAuthorityProven: false,
      projectId: deployIdentityScope.projectId,
      projectNumber: deployIdentityScope.projectNumber,
      projectParent: deployParentScope.projectParent,
      organizationId: deployParentScope.organizationId,
      directOrganizationParent: errors.includes(
        "DEPLOY_PARENT_SCOPE_READBACK_MISMATCH",
      ) === false,
      folderAncestorCount:
        readback?.parentScope?.folderAncestors?.length ?? null,
      organizationIamPolicyReadbackPerformed:
        readback?.organizationIamPolicyReadbackPerformed === true,
      organizationIamBindingCount: organizationBindings.length,
      prohibitedInheritedBindingCount:
        directApprovedServiceAccountBindingCount
        + publicBindingCount
        + principalSetBindingCount
        + unresolvedOrBroadPrincipalBindingCount
        + sensitiveDirectPrincipalRoleBindingCount
        + unresolvedCustomRoleBindingCount,
      directApprovedServiceAccountBindingsAbsent:
        directApprovedServiceAccountBindingCount === 0,
      publicBindingsAbsent: publicBindingCount === 0,
      principalSetBindingsAbsent: principalSetBindingCount === 0,
      unresolvedOrBroadPrincipalBindingsAbsent:
        unresolvedOrBroadPrincipalBindingCount === 0,
      sensitiveDirectPrincipalRoleBindingsAbsent:
        sensitiveDirectPrincipalRoleBindingCount === 0,
      approvedHumanOwnerSensitiveRoleBindingCount,
      approvedHumanOwnerAuthorityExplicitlyClassified:
        approvedHumanOwnerSensitiveRoleBindingCount > 0,
      unresolvedCustomRoleBindingsAbsent:
        unresolvedCustomRoleBindingCount === 0,
    }),
    errors: Object.freeze(errors),
  });
}

export function normalizedDeployProjectScopeEvidence(readback) {
  const errors = [];
  const projectBindings = validatedPolicyBindings(
    readback?.projectPolicy,
    "DEPLOY_PROJECT",
    errors,
  );
  let publicBindingCount = 0;
  let principalSetBindingCount = 0;
  let unresolvedOrBroadPrincipalBindingCount = 0;
  for (const binding of projectBindings) {
    for (const member of binding.members) {
      const memberClass = inheritedMemberClass(member);
      if (memberClass === "PUBLIC") {
        publicBindingCount += 1;
      } else if (memberClass === "PRINCIPAL_SET") {
        principalSetBindingCount += 1;
      } else if (memberClass === "UNRESOLVED_OR_BROAD") {
        unresolvedOrBroadPrincipalBindingCount += 1;
      }
    }
  }
  if (publicBindingCount !== 0) {
    errors.push("DEPLOY_PROJECT_PUBLIC_IAM_BINDING_FORBIDDEN");
  }
  if (principalSetBindingCount !== 0) {
    errors.push("DEPLOY_PROJECT_PRINCIPAL_SET_BINDING_FORBIDDEN");
  }
  if (unresolvedOrBroadPrincipalBindingCount !== 0) {
    errors.push(
      "DEPLOY_PROJECT_UNRESOLVED_OR_BROAD_PRINCIPAL_BINDING_FORBIDDEN",
    );
  }
  return Object.freeze({
    evidence: Object.freeze({
      schemaVersion: "wp13.12b-ea-project-scope-evidence-v1",
      projectId: deployIdentityScope.projectId,
      projectIamPolicyReadbackPerformed: isRecord(readback?.projectPolicy),
      projectIamBindingCount: projectBindings.length,
      publicBindingsAbsent: publicBindingCount === 0,
      principalSetBindingsAbsent: principalSetBindingCount === 0,
      unresolvedOrBroadPrincipalBindingsAbsent:
        unresolvedOrBroadPrincipalBindingCount === 0,
      prohibitedBroadPrincipalBindingCount:
        publicBindingCount
        + principalSetBindingCount
        + unresolvedOrBroadPrincipalBindingCount,
    }),
    errors: Object.freeze(errors),
  });
}

const resourcePolicyDescriptors = Object.freeze([
  Object.freeze({
    key: "artifactRepository",
    policyKey: "artifactRepositoryPolicy",
    allowed: Object.freeze([Object.freeze({
      role: "roles/artifactregistry.writer",
      email: deployIdentityScope.buildServiceAccount,
    })]),
  }),
  Object.freeze({
    key: "sourceBucket",
    policyKey: "sourceBucketPolicy",
    allowed: Object.freeze([Object.freeze({
      role: "roles/storage.objectViewer",
      email: deployIdentityScope.buildServiceAccount,
    })]),
  }),
  Object.freeze({
    key: "capabilitySecret",
    policyKey: "capabilitySecretPolicy",
    allowed: Object.freeze([Object.freeze({
      role: "roles/secretmanager.secretAccessor",
      email: deployIdentityScope.runtimeServiceAccount,
    })]),
  }),
]);

export function normalizedDeployResourcePolicyEvidence(readback) {
  const errors = [];
  if (readback?.resourcePolicyReadbackPerformed !== true) {
    errors.push("DEPLOY_RESOURCE_POLICY_READBACK_REQUIRED");
  }
  let prohibitedBindingCount = 0;
  for (const descriptor of resourcePolicyDescriptors) {
    if (
      readback?.resourcePolicyScopes?.[descriptor.key]
        !== deployResourcePolicyScopes[descriptor.key]
    ) {
      errors.push(
        `DEPLOY_RESOURCE_POLICY_SCOPE_MISMATCH:${descriptor.key}`,
      );
    }
    const policyBindings = validatedPolicyBindings(
      readback?.[descriptor.policyKey],
      `DEPLOY_RESOURCE_${descriptor.key.toUpperCase()}`,
      errors,
    );
    const expected = descriptor.allowed[0];
    const exactPolicy = (
      descriptor.allowed.length === 1
      && policyBindings.length === 1
      && policyBindings[0].role === expected.role
      && policyBindings[0].condition === undefined
      && policyBindings[0].members.length === 1
      && policyBindings[0].members[0]
        === `serviceAccount:${expected.email}`
    );
    if (!exactPolicy) {
      errors.push(
        `DEPLOY_RESOURCE_POLICY_NOT_EXACT_ALLOWLIST:${descriptor.key}`,
      );
    }
    const prohibitedBeforePolicy = prohibitedBindingCount;
    for (const binding of policyBindings) {
      for (const member of binding.members) {
        const inheritedClass = inheritedMemberClass(member);
        const email = approvedServiceAccountEmail(member);
        if (
          inheritedClass === "PUBLIC"
          || inheritedClass === "PRINCIPAL_SET"
          || inheritedClass === "UNRESOLVED_OR_BROAD"
        ) {
          prohibitedBindingCount += 1;
          errors.push(
            `BROAD_DEPLOY_RESOURCE_POLICY_BINDING_FORBIDDEN:${descriptor.key}`,
          );
        } else if (email !== undefined) {
          const allowed = descriptor.allowed.some(
            (entry) =>
              entry.email === email
              && entry.role === binding.role
              && member === `serviceAccount:${email}`
              && binding.condition === undefined,
          );
          if (!allowed) {
            prohibitedBindingCount += 1;
            errors.push(
              email === deployIdentityScope.deployServiceAccount
                ? `DEPLOY_MEMBER_RESOURCE_POLICY_BINDING_FORBIDDEN:${descriptor.key}`
                : `APPROVED_IDENTITY_RESOURCE_POLICY_BINDING_FORBIDDEN:${descriptor.key}`,
            );
          }
        }
      }
    }
    if (
      !exactPolicy
      && prohibitedBindingCount === prohibitedBeforePolicy
    ) {
      prohibitedBindingCount += 1;
    }
  }
  return Object.freeze({
    evidence: Object.freeze({
      schemaVersion: "wp13.12b-ea-resource-policy-evidence-v1",
      resourcePolicyReadbackPerformed:
        readback?.resourcePolicyReadbackPerformed === true,
      scopes: deployResourcePolicyScopes,
      prohibitedBindingCount,
      exactApprovedIdentityAllowlistConformant:
        prohibitedBindingCount === 0,
    }),
    errors: Object.freeze(errors),
  });
}

export function normalizedDeployDeletionRunPolicyEvidence(
  readback,
  {
    condition,
    expectDeletionBinding,
  } = {},
) {
  const errors = [];
  if (readback?.runServicePoliciesReadbackPerformed !== true) {
    errors.push("DEPLOY_RUN_SERVICE_POLICIES_READBACK_REQUIRED");
  }
  if (
    !Array.isArray(readback?.runServicePolicyScopes)
    || readback.runServicePolicyScopes.length
      !== deployRunServicePolicyScopes.length
    || readback.runServicePolicyScopes.some(
      (scope, index) => scope !== deployRunServicePolicyScopes[index],
    )
  ) {
    errors.push("DEPLOY_RUN_SERVICE_POLICY_SCOPES_MISMATCH");
  }
  const entries = Array.isArray(readback?.runServicePolicies)
    ? readback.runServicePolicies
    : [];
  if (!Array.isArray(readback?.runServicePolicies)) {
    errors.push("DEPLOY_RUN_SERVICE_POLICIES_INVALID");
  }
  const observedScopes = [];
  let directDeployBindingCount = 0;
  let prohibitedPrincipalSetBindingCount = 0;
  for (const entry of entries) {
    if (
      !isRecord(entry)
      || typeof entry.serviceName !== "string"
      || !deployRunServicePolicyScopes.includes(entry.serviceName)
    ) {
      errors.push("DEPLOY_RUN_SERVICE_POLICY_TARGET_INVALID");
      continue;
    }
    observedScopes.push(entry.serviceName);
    const label = (
      "DEPLOY_RUN_SERVICE_"
      + entry.serviceName.slice(entry.serviceName.lastIndexOf("/") + 1)
        .toUpperCase()
    );
    const bindings = validatedPolicyBindings(entry.policy, label, errors);
    for (const binding of bindings) {
      if (
        binding.members.some((member) => member.startsWith("principalSet://"))
      ) {
        prohibitedPrincipalSetBindingCount += 1;
        errors.push(`${label}_PRINCIPAL_SET_BINDING_FORBIDDEN`);
      }
    }
    const directDeployBindings = bindings.filter((binding) => (
      binding.members.some(
        (member) =>
          approvedServiceAccountEmail(member)
            === deployIdentityScope.deployServiceAccount,
      )
    ));
    directDeployBindingCount += directDeployBindings.length;
    validateExactFullPolicyBindings(
      { bindings: directDeployBindings },
      `${label}_DEPLOY_MEMBER`,
      (
        expectDeletionBinding === true
        && entry.serviceName === deployDeletionRunServiceScope.resource
      )
        ? [{
            role: "roles/run.invoker",
            members: [deployMember()],
            condition,
          }]
        : [],
      errors,
    );
  }
  const expectedScopes = [...deployRunServicePolicyScopes].sort();
  const exactTargetSet = (
    entries.length === deployRunServicePolicyScopes.length
    && new Set(observedScopes).size === deployRunServicePolicyScopes.length
    && JSON.stringify([...observedScopes].sort())
      === JSON.stringify(expectedScopes)
  );
  if (!exactTargetSet) {
    errors.push("DEPLOY_RUN_SERVICE_POLICY_EXACT_TARGET_SET_REQUIRED");
  }
  return Object.freeze({
    evidence: Object.freeze({
      schemaVersion:
        "wp13.12b-ea-deletion-run-policy-evidence-v1",
      runServicePoliciesReadbackPerformed:
        readback?.runServicePoliciesReadbackPerformed === true,
      exactRunServicePolicyTargetSet: exactTargetSet,
      deleteSyntheticSessionResource:
        deployDeletionRunServiceScope.resource,
      expectedConditionalDeletionInvokerPresent:
        expectDeletionBinding === true,
      directDeployBindingCount,
      prohibitedPrincipalSetBindingCount,
      deployAuthorityLimitedToExactDeletionInvoker:
        errors.length === 0 && expectDeletionBinding === true,
      allDeployRunInvokerAuthorityAbsent:
        errors.length === 0 && expectDeletionBinding !== true,
    }),
    errors: Object.freeze(errors),
  });
}

export function validateDeployIdentityReadback(readback, {
  windowExpiresAt,
  expectRevoked = false,
  expectedAuthorityState,
} = {}) {
  const errors = [];
  const authorityState = expectedAuthorityState ?? (
    expectRevoked
      ? deployIdentityAuthorityStates.deployBindingsRevoked
      : deployIdentityAuthorityStates.deployReady
  );
  if (
    !Object.values(deployIdentityAuthorityStates).includes(authorityState)
  ) {
    errors.push("DEPLOY_IDENTITY_AUTHORITY_STATE_INVALID");
  }
  if (
    expectedAuthorityState !== undefined
    && expectRevoked === true
    && authorityState !== deployIdentityAuthorityStates.deployBindingsRevoked
    && authorityState !== deployIdentityAuthorityStates.allAuthorityRevoked
  ) {
    errors.push("DEPLOY_IDENTITY_AUTHORITY_STATE_CONFLICT");
  }
  const parentScope = normalizedDeployParentScopeEvidence(readback);
  errors.push(...parentScope.errors);
  const projectScope = normalizedDeployProjectScopeEvidence(readback);
  errors.push(...projectScope.errors);
  const resourcePolicies = normalizedDeployResourcePolicyEvidence(readback);
  errors.push(...resourcePolicies.errors);
  let condition;
  try {
    condition = (
      authorityState === deployIdentityAuthorityStates.deletionOnly
      || authorityState === deployIdentityAuthorityStates.allAuthorityRevoked
    )
      ? syntheticDeletionWindowCondition(windowExpiresAt)
      : deployWindowCondition(windowExpiresAt);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "DEPLOY_WINDOW_INVALID");
    return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  }

  if (
    readback?.deployServiceAccount?.email
    !== deployIdentityScope.deployServiceAccount
  ) errors.push("DEPLOY_SERVICE_ACCOUNT_EMAIL_MISMATCH");
  if (readback?.deployServiceAccount?.disabled === true) {
    errors.push("DEPLOY_SERVICE_ACCOUNT_DISABLED");
  }
  if (
    !Array.isArray(readback?.deployServiceAccount?.userManagedKeys)
    || readback.deployServiceAccount.userManagedKeys.length !== 0
  ) errors.push("DEPLOY_SERVICE_ACCOUNT_USER_MANAGED_KEYS_FORBIDDEN");
  if (
    new Set([
      deployIdentityScope.deployServiceAccount,
      deployIdentityScope.runtimeServiceAccount,
      deployIdentityScope.previewServiceAccount,
      deployIdentityScope.buildServiceAccount,
    ]).size !== 4
  ) errors.push("DEPLOY_RUNTIME_PREVIEW_BUILD_IDENTITIES_MUST_BE_DISTINCT");

  const member = deployMember();
  const projectBindings = validatedPolicyBindings(
    readback?.projectPolicy,
    "DEPLOY_PROJECT",
    errors,
  );
  const directDeployProjectBindings = projectBindings.filter(
    (binding) => binding.members.some(
      (candidate) =>
        approvedServiceAccountEmail(candidate)
          === deployIdentityScope.deployServiceAccount,
    ),
  );
  validateExactFullPolicyBindings(
    { bindings: directDeployProjectBindings },
    "DEPLOY_PROJECT_MEMBER",
    authorityState === deployIdentityAuthorityStates.deployReady
      ? deployProjectRoles.map((role) => ({
          role,
          members: [member],
          condition,
        }))
      : [],
    errors,
  );

  if (readback?.deployServiceAccount !== undefined) {
    validateExactFullPolicyBindings(
      readback?.deployServiceAccountPolicy,
      "DEPLOY_SERVICE_ACCOUNT_POLICY",
      (
        authorityState === deployIdentityAuthorityStates.deployReady
        || authorityState === deployIdentityAuthorityStates.deletionOnly
      )
        ? [{
            role: "roles/iam.serviceAccountTokenCreator",
            members: [deployIdentityScope.operatorMember],
            condition,
          }]
        : [],
      errors,
    );
  }
  validateExactFullPolicyBindings(
    readback?.runtimeServiceAccountPolicy,
    "DEPLOY_RUNTIME_SERVICE_ACCOUNT_POLICY",
    authorityState === deployIdentityAuthorityStates.deployReady
      ? [{
          role: "roles/iam.serviceAccountUser",
          members: [member],
          condition,
        }]
      : [],
    errors,
  );
  validateExactFullPolicyBindings(
    readback?.buildServiceAccountPolicy,
    "DEPLOY_BUILD_SERVICE_ACCOUNT_POLICY",
    authorityState === deployIdentityAuthorityStates.deployReady
      ? [{
          role: "roles/iam.serviceAccountUser",
          members: [member],
          condition,
        }]
      : [],
    errors,
  );
  if (
    authorityState === deployIdentityAuthorityStates.deletionOnly
    || authorityState === deployIdentityAuthorityStates.allAuthorityRevoked
  ) {
    const runPolicies = normalizedDeployDeletionRunPolicyEvidence(
      readback,
      {
        condition,
        expectDeletionBinding:
          authorityState === deployIdentityAuthorityStates.deletionOnly,
      },
    );
    errors.push(...runPolicies.errors);
  }

  if (
    readback?.sourceCommit !== undefined
    && (
      typeof readback.sourceCommit !== "string"
      || !/^[a-f0-9]{40}$/u.test(readback.sourceCommit)
    )
  ) errors.push("DEPLOY_SOURCE_COMMIT_INVALID");
  if (
    readback?.artifactSha256 !== undefined
    && (
      typeof readback.artifactSha256 !== "string"
      || !FULL_SHA256.test(readback.artifactSha256)
    )
  ) errors.push("DEPLOY_ARTIFACT_SHA256_INVALID");

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}
