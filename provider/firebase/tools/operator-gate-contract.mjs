import { readFile } from "node:fs/promises";

export const EXTERNAL_ACTIVATION_AUTHORIZATION =
  "AUTHORIZE_WP13_12B_EXTERNAL_ACTIVATION";

const CLOUD_FIELD_APPROVAL_URL = new URL(
  "../../../release/wp13-12b/external-activation/cloud-field-approval.json",
  import.meta.url,
);

function gateError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function validDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value ?? "")) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf())
    && parsed.toISOString().slice(0, 10) === value;
}

export function validateCloudFieldApproval(approval) {
  if (
    approval === null
    || typeof approval !== "object"
    || Array.isArray(approval)
    || approval.schemaVersion !== "wp13.12b-ea-cloud-field-approval-v1"
    || approval.approvalStatus
      !== "EXPLICITLY_APPROVED_FOR_EXTERNAL_SYNTHETIC_STAGING"
    || approval.humanSignatureOrExplicitConfirmation?.confirmed !== true
    || approval.authorizationEffects?.syntheticFixturesOnly !== true
    || approval.authorizationEffects?.realParticipantDataAuthorized !== false
    || approval.authorizationEffects?.studentBetaAuthorized !== false
    || approval.authorizationEffects?.productionAuthorized !== false
    || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(
      approval.plannedProjectId ?? "",
    )
    || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(
      approval.approvedGoogleAccount ?? "",
    )
    || !/^[0-9]{6,20}$/u.test(approval.approvedOrganizationId ?? "")
    || !/^[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}$/u.test(
      approval.approvedBillingAccount ?? "",
    )
    || approval.selectedRegion !== "europe-north1"
    || !validDateOnly(approval.stagingExpiryDate)
  ) {
    throw gateError("VALID_CONFIRMED_CLOUD_FIELD_APPROVAL_REQUIRED");
  }
  return Object.freeze({
    projectId: approval.plannedProjectId,
    approvedGoogleAccount: approval.approvedGoogleAccount,
    organizationId: approval.approvedOrganizationId,
    billingAccount: approval.approvedBillingAccount,
    region: approval.selectedRegion,
    stagingExpiryDate: approval.stagingExpiryDate,
  });
}

export async function loadApprovedCloudScope({
  readFileImpl = readFile,
} = {}) {
  let approval;
  try {
    approval = JSON.parse(
      await readFileImpl(CLOUD_FIELD_APPROVAL_URL, "utf8"),
    );
  } catch {
    throw gateError("CLOUD_FIELD_APPROVAL_READ_FAILED");
  }
  return validateCloudFieldApproval(approval);
}

function normalizedFlagName(value) {
  return typeof value === "string" && /^--[a-z][a-z0-9-]*$/u.test(value);
}

export function parseExactFlagPairs(argv, {
  allowed,
  required = allowed,
}) {
  if (!Array.isArray(argv) || argv.length % 2 !== 0) {
    throw gateError("EXPLICIT_FLAG_VALUE_PAIRS_REQUIRED");
  }
  const allowedFlags = new Set(allowed);
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (
      !normalizedFlagName(key)
      || typeof value !== "string"
      || value.length === 0
      || value.startsWith("--")
    ) {
      throw gateError("EXPLICIT_FLAG_VALUE_PAIRS_REQUIRED");
    }
    if (!allowedFlags.has(key)) throw gateError("UNKNOWN_OPERATOR_FLAG");
    if (parsed.has(key)) throw gateError("DUPLICATE_OPERATOR_FLAG");
    parsed.set(key, value);
  }
  for (const key of required) {
    if (!parsed.has(key)) throw gateError("REQUIRED_OPERATOR_FLAG_MISSING");
  }
  if (parsed.size !== required.length) {
    throw gateError("EXACT_OPERATOR_FLAG_SET_REQUIRED");
  }
  return parsed;
}

export function assertApprovedCloudBinding(args, scope) {
  if (
    args.get("--project") !== scope.projectId
    || args.get("--google-account") !== scope.approvedGoogleAccount
    || args.get("--region") !== scope.region
  ) {
    throw gateError("CLOUD_FIELD_APPROVAL_BINDING_MISMATCH");
  }
  return true;
}

export function assertExternalActivationAuthorization(args) {
  if (args.get("--authorized") !== EXTERNAL_ACTIVATION_AUTHORIZATION) {
    throw gateError("EXACT_ACTIVATION_AUTHORIZATION_REQUIRED");
  }
  return true;
}

export function assertActivationWindowOpen(scope, {
  now = () => new Date(),
} = {}) {
  const instant = now();
  if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) {
    throw gateError("VALID_OPERATOR_TIME_REQUIRED");
  }
  const expiryStart = new Date(
    `${scope.stagingExpiryDate}T00:00:00.000Z`,
  );
  if (
    Number.isNaN(expiryStart.valueOf())
    || instant.valueOf() >= expiryStart.valueOf()
  ) {
    throw gateError("STAGING_ACTIVATION_WINDOW_EXPIRED");
  }
  return instant;
}

const exactVercelDeploymentEnvironmentKeys = Object.freeze([
  "LUDYS_COMMAND_FUNCTION_URL",
  "LUDYS_DELETE_FUNCTION_URL",
  "LUDYS_DEPLOYMENT_ROLE",
  "LUDYS_GCP_PREVIEW_SERVICE_ACCOUNT",
  "LUDYS_GCP_PROJECT_NUMBER",
  "LUDYS_GCP_WIF_POOL_ID",
  "LUDYS_GCP_WIF_PROVIDER_ID",
  "LUDYS_ISSUE_FUNCTION_URL",
  "LUDYS_PROJECTION_FUNCTION_URL",
]);

const authenticatedBrowserProofMaximumAgeMilliseconds =
  30 * 60 * 1000;
const vercelProviderReadbackMaximumAgeMilliseconds =
  2 * 60 * 1000;

function isExactVercelDeploymentEnvironmentKeySet(value) {
  return (
    Array.isArray(value)
    && value.length
      === exactVercelDeploymentEnvironmentKeys.length
    && new Set(value).size
      === exactVercelDeploymentEnvironmentKeys.length
    && value.every((
      key,
      index,
    ) => key === exactVercelDeploymentEnvironmentKeys[index])
  );
}

const FULL_GIT_SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const ACTUAL_RECEIPT_JSON =
  /^release\/wp13-12b\/receipts\/actual\/[^/\\]+\.json$/u;

function hasExactReceiptEvidenceBinding(readback) {
  const repository = readback?.repository;
  const binding = repository?.receiptEvidenceBinding;
  const artifactPaths = binding?.artifactPaths;
  const artifactHashes = binding?.artifactHashes;
  if (
    !FULL_GIT_SHA.test(repository?.commit ?? "")
    || !FULL_GIT_SHA.test(repository?.tree ?? "")
    || repository?.deploymentSourceCommit !== repository.commit
    || repository?.deploymentSourceTree !== repository.tree
    || !FULL_GIT_SHA.test(
      repository?.currentEvidenceHeadCommit ?? "",
    )
    || !FULL_GIT_SHA.test(
      repository?.currentEvidenceHeadTree ?? "",
    )
    || repository.currentEvidenceHeadCommit === repository.commit
    || repository.currentEvidenceHeadTree === repository.tree
    || repository?.evidenceCommitRelationship
      !== "DIRECT_RECEIPT_EVIDENCE_CHILD"
    || binding === null
    || typeof binding !== "object"
    || Array.isArray(binding)
    || !ACTUAL_RECEIPT_JSON.test(binding?.receiptPath ?? "")
    || !SHA256.test(binding?.receiptSha256 ?? "")
    || binding?.exactDiffVerified !== true
    || binding?.receiptSelfHashOmittedByConstruction !== true
    || !Array.isArray(artifactPaths)
    || artifactPaths.length === 0
    || new Set(artifactPaths).size !== artifactPaths.length
    || artifactHashes === null
    || typeof artifactHashes !== "object"
    || Array.isArray(artifactHashes)
  ) return false;
  const hashPaths = Object.keys(artifactHashes).sort();
  if (
    artifactPaths.length !== hashPaths.length
    || artifactPaths.some((path, index) => (
      path !== hashPaths[index]
      || !ACTUAL_RECEIPT_JSON.test(path)
      || path === binding.receiptPath
      || !SHA256.test(artifactHashes[path] ?? "")
    ))
    || artifactHashes[
      readback?.authenticatedBrowserProof?.artifactPath
    ] !== readback?.authenticatedBrowserProof?.artifactSha256
    || !Object.values(artifactHashes).includes(
      readback?.receiptBoundRollbackDeployment?.evidenceSha256,
    )
    || readback?.authenticatedBrowserProof?.teamId
      !== readback?.team?.id
    || readback?.authenticatedBrowserProof?.teamSlug
      !== readback?.team?.slug
    || readback?.authenticatedBrowserProof?.projectId
      !== readback?.project?.id
    || readback?.authenticatedBrowserProof?.projectName
      !== readback?.project?.name
    || readback?.authenticatedBrowserProof?.sourceCommit
      !== repository.commit
    || readback?.authenticatedBrowserProof?.sourceTree
      !== repository.tree
    || readback?.authenticatedBrowserProof?.previewSourceSha256
      !== repository.previewSourceSha256
    || readback?.authenticatedBrowserProof?.uploadManifestSha256
      !== repository.uploadManifestSha256
    || readback?.receiptBoundRollbackDeployment?.sourceCommit
      !== repository.commit
    || readback?.receiptBoundRollbackDeployment?.sourceTree
      !== repository.tree
  ) return false;
  return true;
}

function exactIsoInstant(value) {
  if (typeof value !== "string") return null;
  const instant = new Date(value);
  return (
    !Number.isNaN(instant.valueOf())
    && instant.toISOString() === value
  ) ? instant : null;
}

export function validateVercelActivationReadback(
  readback,
  trust,
  {
    now = () => new Date(),
  } = {},
) {
  let instant;
  try {
    instant = now();
  } catch {
    instant = null;
  }
  const providerReadbackObservedAt = exactIsoInstant(
    readback?.wifLiveGuard?.providerReadbackObservedAt,
  );
  const browserProofObservedAt = exactIsoInstant(
    readback?.authenticatedBrowserProof?.observedAt,
  );
  if (
    readback === null
    || typeof readback !== "object"
    || Array.isArray(readback)
    || readback.schemaVersion
      !== "wp13.12b-ea-external-vercel-control-v2"
    || readback.action !== "inspect-project"
    || readback.externalWrites !== 0
    || readback.team?.id !== trust.vercel.teamId
    || readback.team?.slug !== trust.vercel.teamSlug
    || readback.project?.id !== trust.vercel.projectId
    || readback.project?.name !== trust.vercel.projectName
    || readback.project?.accountId !== trust.vercel.teamId
    || readback.project?.framework !== null
    || readback.project?.rootDirectory !== null
    || readback.project?.buildCommand !== null
    || readback.project?.outputDirectory !== null
    || readback.project?.installCommand !== null
    || readback.project?.devCommand !== null
    || readback.project?.autoExposeSystemEnvs !== true
    || readback.project?.nodeVersion !== "24.x"
    || readback.project?.live !== false
    || readback.project?.webAnalytics !== null
    || readback.project?.speedInsights !== null
    || readback.project?.oidcTokenConfig?.enabled !== true
    || readback.project?.oidcTokenConfig?.issuerMode !== "team"
    || readback.project?.ssoProtection?.deploymentType
      !== "prod_deployment_urls_and_all_previews"
    || readback.project?.passwordProtectionConfigured !== false
    || readback.project?.trustedIpsConfigured !== false
    || readback.project?.protectionBypassConfigured !== false
    || !Array.isArray(readback.project?.protectionExceptions)
    || readback.project.protectionExceptions.length !== 0
    || !Array.isArray(readback.project?.domains)
    || readback.project.domains.length !== 0
    || readback.project?.link !== null
    || readback.repository?.workingTreeClean !== true
    || !hasExactReceiptEvidenceBinding(readback)
    || readback.repository?.previewRoot
      !== "provider/vercel/wp13-12b-preview"
    || !/^[a-f0-9]{64}$/u.test(
      readback.repository?.previewSourceSha256 ?? "",
    )
    || !/^[a-f0-9]{64}$/u.test(
      readback.repository?.uploadManifestSha256 ?? "",
    )
    || !/^dpl_[A-Za-z0-9]{8,80}$/u.test(
      readback.previewDeployment?.id ?? "",
    )
    || !/^https:\/\/[a-z0-9-]+\.vercel\.app$/u.test(
      readback.previewDeployment?.url ?? "",
    )
    || readback.previewDeployment?.projectId
      !== trust.vercel.projectId
    || readback.previewDeployment?.ownerId
      !== trust.vercel.teamId
    || readback.previewDeployment?.name
      !== trust.vercel.projectName
    || readback.previewDeployment?.readyState !== "READY"
    || readback.previewDeployment?.target !== "preview"
    || readback.previewDeployment?.source !== "cli"
    || readback.previewDeployment?.sourceCommit
      !== readback.repository.commit
    || readback.previewDeployment?.sourceTree
      !== readback.repository.tree
    || readback.previewDeployment?.sourceRoot
      !== readback.repository.previewRoot
    || readback.previewDeployment?.previewSourceSha256
      !== readback.repository.previewSourceSha256
    || readback.previewDeployment?.uploadManifestSha256
      !== readback.repository.uploadManifestSha256
    || !/^[a-f0-9]{64}$/u.test(
      readback.previewDeployment?.dryRunManifestSha256 ?? "",
    )
    || !/^[a-f0-9]{64}$/u.test(
      readback.previewDeployment?.staticArtifactSha256 ?? "",
    )
    || readback.previewDeployment?.vercelCliVersion !== "58.0.0"
    || readback.previewDeployment
      ?.vercelCliIntegritySha256
      !== "735b95624518df208bd60db6439b5b13eb596c386653ad392193d18f3537dd4b"
    || readback.previewDeployment?.deploymentRole !== "active"
    || readback.previewDeployment?.deploymentRoleClaimSource
      !== "AUTHENTICATED_DEPLOYMENT_METADATA_NOT_ENV_VALUE"
    || readback.previewDeployment?.oidcEnvironment !== "preview"
    || readback.previewDeployment?.protectionVerified !== true
    || readback.previewDeployment?.sourceFilesVerified !== true
    || !isExactVercelDeploymentEnvironmentKeySet(
      readback.previewDeployment
        ?.deploymentUserEnvironmentKeys,
    )
    || readback.previewDeployment
      ?.deploymentEnvironmentValuesExposedByProvider !== false
    || readback.previewDeployment
      ?.deploymentRoleValueRequiresAuthenticatedBrowserProof
      !== true
    || readback.environmentInventory
      ?.autoExposeSystemEnvs !== true
    || readback.environmentInventory
      ?.exactAllowlistVerified !== true
    || !Array.isArray(
      readback.environmentInventory
        ?.previewProjectEnvironmentKeys,
    )
    || readback.environmentInventory
      .previewProjectEnvironmentKeys.length !== 0
    || !isExactVercelDeploymentEnvironmentKeySet(
      readback.environmentInventory
        ?.activeDeploymentUserEnvironmentKeys,
    )
    || readback.environmentInventory
      ?.pendingRollbackDeploymentUserEnvironmentKeys !== null
    || !isExactVercelDeploymentEnvironmentKeySet(
      readback.environmentInventory
        ?.receiptBoundRollbackDeploymentUserEnvironmentKeys,
    )
    || readback.environmentInventory
      ?.deploymentEnvironmentValuesExposedByProvider !== false
    || readback.environmentInventory
      ?.deploymentRoleValuesExposedByProvider !== false
    || readback.environmentInventory
      ?.deploymentRoleRuntimeVerification
      !== "AUTHENTICATED_BROWSER_PROOF_REQUIRED"
    || readback.deploymentInventory?.authenticated !== true
    || readback.deploymentInventory?.productionDeploymentCount !== 0
    || readback.deploymentInventory?.customDomainCount !== 0
    || readback.deploymentInventory?.currentCommitPreviewCount !== 1
    || readback.deploymentInventory
      ?.receiptBoundRollbackDeploymentCount !== 1
    || readback.deploymentInventory
      ?.unrelatedReadyDeploymentCount !== 0
    || readback.deploymentInventory
      ?.unrelatedLiveDeploymentCount !== 0
    || readback.deploymentInventory
      ?.unrelatedNonterminalDeploymentCount !== 0
    || readback.deploymentInventory?.readyDeploymentCount !== 2
    || readback.deploymentInventory?.liveDeploymentCount !== 2
    || readback.receiptBoundRollbackDeployment?.projectId
      !== trust.vercel.projectId
    || readback.receiptBoundRollbackDeployment?.ownerId
      !== trust.vercel.teamId
    || readback.receiptBoundRollbackDeployment?.name
      !== trust.vercel.projectName
    || readback.receiptBoundRollbackDeployment?.readyState !== "READY"
    || readback.receiptBoundRollbackDeployment?.target !== "preview"
    || readback.receiptBoundRollbackDeployment?.source !== "cli"
    || readback.receiptBoundRollbackDeployment?.safeDisabled !== true
    || readback.receiptBoundRollbackDeployment
      ?.deploymentRoleClaimSource
      !== "AUTHENTICATED_DEPLOYMENT_METADATA_NOT_ENV_VALUE"
    || readback.receiptBoundRollbackDeployment
      ?.receiptValidated !== true
    || readback.receiptBoundRollbackDeployment
      ?.activeDeploymentId !== readback.previewDeployment?.id
    || readback.receiptBoundRollbackDeployment?.id
      === readback.previewDeployment?.id
    || !/^dpl_[A-Za-z0-9]{8,80}$/u.test(
      readback.receiptBoundRollbackDeployment?.id ?? "",
    )
    || !/^https:\/\/[a-z0-9-]+\.vercel\.app$/u.test(
      readback.receiptBoundRollbackDeployment?.url ?? "",
    )
    || !/^[a-f0-9]{40}$/u.test(
      readback.receiptBoundRollbackDeployment
        ?.sourceCommit ?? "",
    )
    || !/^[a-f0-9]{40}$/u.test(
      readback.receiptBoundRollbackDeployment
        ?.sourceTree ?? "",
    )
    || !/^[a-f0-9]{64}$/u.test(
      readback.receiptBoundRollbackDeployment
        ?.evidenceSha256 ?? "",
    )
    || !isExactVercelDeploymentEnvironmentKeySet(
      readback.receiptBoundRollbackDeployment
        ?.deploymentUserEnvironmentKeys,
    )
    || readback.receiptBoundRollbackDeployment
      ?.deploymentEnvironmentValuesExposedByProvider !== false
    || readback.receiptBoundRollbackDeployment
      ?.deploymentRoleValueRequiresAuthenticatedBrowserProof
      !== true
    || readback.authenticatedBrowserProof?.schemaVersion
      !== "wp13.12b-vercel-authenticated-browser-proof-v1"
    || readback.authenticatedBrowserProof?.status !== "VERIFIED"
    || readback.authenticatedBrowserProof?.receiptBound !== true
    || typeof readback.authenticatedBrowserProof?.artifactPath
      !== "string"
    || !readback.authenticatedBrowserProof.artifactPath.startsWith(
      "release/wp13-12b/receipts/actual/",
    )
    || readback.authenticatedBrowserProof.artifactPath.includes("..")
    || !readback.authenticatedBrowserProof.artifactPath
      .endsWith(".json")
    || !/^[a-f0-9]{64}$/u.test(
      readback.authenticatedBrowserProof?.artifactSha256 ?? "",
    )
    || readback.authenticatedBrowserProof
      ?.maximumAgeMilliseconds
      !== authenticatedBrowserProofMaximumAgeMilliseconds
    || browserProofObservedAt === null
    || !(instant instanceof Date)
    || Number.isNaN(instant.valueOf())
    || browserProofObservedAt.valueOf()
      > instant.valueOf() + 60_000
    || instant.valueOf() - browserProofObservedAt.valueOf()
      > authenticatedBrowserProofMaximumAgeMilliseconds
    || readback.authenticatedBrowserProof
      ?.inventory?.activeDeploymentCount !== 1
    || readback.authenticatedBrowserProof
      ?.inventory?.receiptBoundRollbackDeploymentCount !== 1
    || readback.authenticatedBrowserProof
      ?.inventory?.unrelatedLiveDeploymentCount !== 0
    || readback.authenticatedBrowserProof
      ?.inventory?.totalLiveDeploymentCount !== 2
    || readback.authenticatedBrowserProof
      ?.active?.deploymentId !== readback.previewDeployment?.id
    || readback.authenticatedBrowserProof
      ?.active?.deploymentUrl !== readback.previewDeployment?.url
    || readback.authenticatedBrowserProof
      ?.active?.standardProtectionSessionAuthenticated !== true
    || readback.authenticatedBrowserProof
      ?.active?.runtimeConfigStatus !== 200
    || readback.authenticatedBrowserProof
      ?.active?.runtimeConfigSchemaVersion
      !== "wp13.12b-external-preview-config-v1"
    || readback.authenticatedBrowserProof
      ?.active?.deploymentRole !== "active"
    || readback.authenticatedBrowserProof
      ?.active?.issuanceEnabled !== true
    || readback.authenticatedBrowserProof
      ?.rollback?.deploymentId
      !== readback.receiptBoundRollbackDeployment?.id
    || readback.authenticatedBrowserProof
      ?.rollback?.deploymentUrl
      !== readback.receiptBoundRollbackDeployment?.url
    || readback.authenticatedBrowserProof
      ?.rollback?.standardProtectionSessionAuthenticated !== true
    || readback.authenticatedBrowserProof
      ?.rollback?.runtimeConfigStatus !== 200
    || readback.authenticatedBrowserProof
      ?.rollback?.runtimeConfigSchemaVersion
      !== "wp13.12b-external-preview-config-v1"
    || readback.authenticatedBrowserProof
      ?.rollback?.deploymentRole !== "rollback"
    || readback.authenticatedBrowserProof
      ?.rollback?.issuanceEnabled !== false
    || readback.authenticatedBrowserProof
      ?.rollback?.issueStatus !== 503
    || readback.authenticatedBrowserProof
      ?.rollback?.issueDenialClass
      !== "ROLLBACK_SAFE_DISABLED"
    || readback.authenticatedBrowserProof
      ?.safeguards?.authenticationMode
      !== "VERCEL_STANDARD_PROTECTION_SESSION"
    || readback.authenticatedBrowserProof
      ?.safeguards?.protectionBypassUsed !== false
    || readback.authenticatedBrowserProof
      ?.safeguards?.protectionBypassCreated !== false
    || readback.authenticatedBrowserProof
      ?.safeguards?.shareableLinkCreated !== false
    || readback.authenticatedBrowserProof
      ?.safeguards?.oidcTokenRecorded !== false
    || readback.authenticatedBrowserProof
      ?.safeguards?.vercelTokenRecorded !== false
    || readback.authenticatedBrowserProof
      ?.safeguards?.participantsPresent !== false
    || readback.authenticatedBrowserProof
      ?.safeguards?.adultOperatorOnly !== true
    || readback.wifLiveGuard?.schemaVersion
      !== "wp13.12b-vercel-wif-live-guard-v1"
    || providerReadbackObservedAt === null
    || providerReadbackObservedAt.valueOf()
      > instant.valueOf() + 60_000
    || instant.valueOf() - providerReadbackObservedAt.valueOf()
      > vercelProviderReadbackMaximumAgeMilliseconds
    || readback.wifLiveGuard
      ?.maximumProviderReadbackAgeMilliseconds
      !== vercelProviderReadbackMaximumAgeMilliseconds
    || readback.wifLiveGuard
      ?.providerReadbackAuthenticated !== true
    || readback.wifLiveGuard
      ?.freshExactInventoryReadback !== true
    || readback.wifLiveGuard?.activeDeploymentCount !== 1
    || readback.wifLiveGuard
      ?.receiptBoundRollbackDeploymentCount !== 1
    || readback.wifLiveGuard?.unrelatedLiveDeploymentCount !== 0
    || readback.wifLiveGuard?.totalLiveDeploymentCount !== 2
    || readback.wifLiveGuard
      ?.authenticatedBrowserProofVerified !== true
    || readback.wifLiveGuard?.oidcSubjectGranularity
      !== "PROJECT_AND_ENVIRONMENT"
    || readback.wifLiveGuard?.deploymentSpecificOidcSubject !== false
    || readback.wifLiveGuard
      ?.allProjectPreviewDeploymentsShareOidcSubject !== true
    || readback.wifLiveGuard
      ?.newDeploymentsWhileWifLiveForbidden !== true
    || readback.wifLiveGuard?.gitLinkWhileWifLiveForbidden !== true
    || trust.securityBoundary?.oidcSubjectGranularity
      !== "PROJECT_AND_ENVIRONMENT_NOT_DEPLOYMENT"
    || trust.securityBoundary?.deploymentSpecificOidcSubject !== false
    || trust.securityBoundary
      ?.newPreviewDeploymentsWhileTrustEnabled !== false
    || trust.securityBoundary?.gitLinkWhileTrustEnabled !== false
    || trust.securityBoundary
      ?.freshExactDeploymentInventoryRequiredBeforeEveryTrustEnable
      !== true
    || trust.securityBoundary
      ?.authenticatedBrowserProofRequiredBeforeEveryTrustEnable
      !== true
    || readback.previewOnly !== true
    || readback.productionDeploymentCreated !== false
    || readback.customDomainCreated !== false
    || readback.claimsDerivedFromAuthenticatedProviderReadback !== true
    || readback.oidcTokenValuePrinted !== false
    || readback.tokenPrinted !== false
  ) {
    throw gateError(
      "CURRENT_AUTHENTICATED_PROTECTED_VERCEL_PREVIEW_READBACK_REQUIRED",
    );
  }
  return Object.freeze({
    teamId: readback.team.id,
    teamSlug: readback.team.slug,
    projectId: readback.project.id,
    projectName: readback.project.name,
    protection: readback.project.ssoProtection.deploymentType,
    oidcIssuerMode: readback.project.oidcTokenConfig.issuerMode,
    deploymentId: readback.previewDeployment.id,
    deploymentUrl: readback.previewDeployment.url,
    sourceCommit: readback.previewDeployment.sourceCommit,
    sourceTree: readback.previewDeployment.sourceTree,
    rollbackDeploymentId:
      readback.receiptBoundRollbackDeployment.id,
    rollbackDeploymentUrl:
      readback.receiptBoundRollbackDeployment.url,
    rollbackEvidenceSha256:
      readback.receiptBoundRollbackDeployment.evidenceSha256,
    authenticatedBrowserProofObservedAt:
      readback.authenticatedBrowserProof.observedAt,
    providerReadbackObservedAt:
      readback.wifLiveGuard.providerReadbackObservedAt,
    oidcSubjectGranularity:
      readback.wifLiveGuard.oidcSubjectGranularity,
  });
}

export function deactivationAuthorization(scope) {
  return (
    "AUTHORIZE_WP13_12B_DEACTIVATION_EXECUTION;"
    + `${scope.projectId};expiry=${scope.stagingExpiryDate}`
  );
}

export function assertControlAuthorization(args, scope, enabled) {
  const expected = enabled
    ? EXTERNAL_ACTIVATION_AUTHORIZATION
    : deactivationAuthorization(scope);
  if (args.get("--authorized") !== expected) {
    throw gateError(
      enabled
        ? "EXACT_ACTIVATION_AUTHORIZATION_REQUIRED"
        : "EXACT_DEACTIVATION_AUTHORIZATION_REQUIRED",
    );
  }
  return true;
}

export function safeOperatorErrorCode(error) {
  const code = typeof error?.code === "string"
    ? error.code
    : typeof error?.message === "string"
      ? error.message
      : "";
  return /^[A-Z][A-Z0-9_]{2,120}$/u.test(code)
    ? code
    : "OPERATOR_FAILED_CLOSED";
}
