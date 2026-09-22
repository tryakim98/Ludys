import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import {
  createPinnedGitExecFile,
} from "./wp13-12b-pinned-git-toolchain.mjs";

const FULL_GIT_SHA = /^[a-f0-9]{40}$/u;
const SHA_256 = /^[a-f0-9]{64}$/u;
const OPERATOR_EVIDENCE_PATH =
  "artifacts/wp13-12b-external-resource-inventory.json";
const APPROVED_PROJECT_ID = "ludys-12b-stg-20260725";
const APPROVED_PROJECT_NUMBER = "134654966474";
const APPROVED_REGION = "europe-north1";
const APPROVED_VERCEL_TEAM_ID = "team_1Gnn3VSNrP3mbseXx6a92a4J";
const APPROVED_VERCEL_TEAM_SLUG = "trym-s-projects";
const APPROVED_VERCEL_PROJECT_ID = "prj_nHs1hbdyfcMMMglNUTwoYRS43naN";
export const RECEIPT_ARTIFACT_VERIFICATION_MODE = Object.freeze({
  SOURCE_COMMIT: "SOURCE_COMMIT",
  DESCENDANT_EVIDENCE_COMMIT: "DESCENDANT_EVIDENCE_COMMIT",
});
const productionRepositoryRoot =
  resolve(fileURLToPath(new URL("..", import.meta.url)));
const pinnedGitExecFile = createPinnedGitExecFile();

function gitExecFileForRepository(repo) {
  return resolve(repo) === productionRepositoryRoot
    ? pinnedGitExecFile
    : execFileSync;
}

function git(repo, args) {
  return gitExecFileForRepository(repo)(
    "git",
    ["-c", `safe.directory=${repo.replaceAll("\\", "/")}`, ...args],
    {
      cwd: repo,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
}

function gitBytes(repo, args) {
  return gitExecFileForRepository(repo)(
    "git",
    ["-c", `safe.directory=${repo.replaceAll("\\", "/")}`, ...args],
    {
      cwd: repo,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
}

export function isRepositoryRelativePath(path) {
  return typeof path === "string"
    && path.length > 0
    && !isAbsolute(path)
    && !path.startsWith("/")
    && !path.startsWith("\\")
    && !path.includes("\\")
    && !path.split("/").includes("..")
    && !path.split("/").includes(".git");
}

function repositoryFile(repo, path) {
  if (!isRepositoryRelativePath(path)) {
    throw new Error("path is not repository-relative");
  }
  const target = resolve(repo, path);
  const fromRepo = relative(repo, target);
  if (fromRepo === "" || fromRepo.startsWith("..") || isAbsolute(fromRepo)) {
    throw new Error("path resolves outside repository");
  }
  return target;
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(stableValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function deterministicEvidenceDigest(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function collectStrings(value, strings = new Set()) {
  if (typeof value === "string" && value.length > 0) {
    strings.add(value);
    return strings;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, strings);
    return strings;
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) collectStrings(entry, strings);
  }
  return strings;
}

const FIREBASE_RECEIPT = "FIREBASE_PROJECT_AND_REGION_RECEIPT";
const IAM_RECEIPT = "IAM_AND_BILLING_RECEIPT";
const PREVIEW_RECEIPT = "PROTECTED_PREVIEW_RECEIPT";

export function canonicalOperatorResourceIdentities(report) {
  if (report?.project === null) return [];
  const projectId = report?.project?.projectId;
  const projectNumber = report?.project?.projectNumber;
  if (projectId !== APPROVED_PROJECT_ID || projectNumber !== APPROVED_PROJECT_NUMBER) {
    throw new Error("operator project scope is unavailable for canonical inventory");
  }
  const identities = new Map();
  const add = (resourceId, provider, region, receiptType) => {
    if (typeof resourceId !== "string" || resourceId.length === 0) return;
    const identity = { resourceId, provider, region, receiptType };
    const existing = identities.get(resourceId);
    if (
      existing !== undefined
      && JSON.stringify(existing) !== JSON.stringify(identity)
    ) {
      throw new Error(`operator resource identity conflict: ${resourceId}`);
    }
    identities.set(resourceId, identity);
  };
  const addIamBindings = (target, bindings, region = "global") => {
    for (const binding of bindings ?? []) {
      for (const member of binding?.members ?? []) {
        add(
          `${target}/iamBindings/${encodeURIComponent(binding.role)}`
          + `/${encodeURIComponent(member)}`,
          "GOOGLE_CLOUD_IAM",
          region,
          IAM_RECEIPT,
        );
      }
    }
  };
  const resources = report?.resources ?? {};
  add(`projects/${projectId}`, "GOOGLE_CLOUD", "global", FIREBASE_RECEIPT);
  for (const budget of resources.budgets ?? []) {
    add(budget?.name, "GOOGLE_CLOUD_BILLING", "global", IAM_RECEIPT);
  }
  for (const service of resources.enabledServices ?? []) {
    add(
      `projects/${projectNumber}/services/${service}`,
      "GOOGLE_CLOUD_SERVICE_USAGE",
      "global",
      IAM_RECEIPT,
    );
  }
  if (resources.firestore?.name) {
    add(
      resources.firestore.name,
      "FIREBASE",
      resources.firestore.location || APPROVED_REGION,
      FIREBASE_RECEIPT,
    );
  }
  for (
    const collection of resources.firestoreDataInventory?.collections ?? []
  ) {
    for (const documentName of collection?.documentNames ?? []) {
      add(documentName, "FIREBASE", APPROVED_REGION, FIREBASE_RECEIPT);
    }
  }
  if (resources.firestoreDataInventory?.control?.name) {
    add(
      resources.firestoreDataInventory.control.name,
      "FIREBASE",
      APPROVED_REGION,
      FIREBASE_RECEIPT,
    );
  }
  for (const fn of resources.functions ?? []) {
    add(
      `projects/${projectId}/locations/${fn.location || APPROVED_REGION}/functions/${fn.name}`,
      "GOOGLE_CLOUD",
      fn.location || APPROVED_REGION,
      FIREBASE_RECEIPT,
    );
  }
  for (const service of resources.runServices ?? []) {
    add(
      `projects/${projectId}/locations/${service.location || APPROVED_REGION}`
      + `/services/${service.name}`,
      "GOOGLE_CLOUD",
      service.location || APPROVED_REGION,
      FIREBASE_RECEIPT,
    );
  }
  for (const secret of resources.secrets ?? []) {
    add(
      `projects/${projectNumber}/secrets/${secret.name}`,
      "GOOGLE_CLOUD",
      APPROVED_REGION,
      IAM_RECEIPT,
    );
  }
  for (const version of resources.secretVersions ?? []) {
    add(
      `projects/${projectNumber}/secrets/LUDYS_CAPABILITY_HMAC_KEY/versions/${version.name}`,
      "GOOGLE_CLOUD",
      APPROVED_REGION,
      IAM_RECEIPT,
    );
  }
  for (const serviceAccount of resources.serviceAccounts ?? []) {
    add(
      `projects/${projectId}/serviceAccounts/${serviceAccount.email}`,
      "GOOGLE_CLOUD_IAM",
      "global",
      IAM_RECEIPT,
    );
  }
  for (const key of resources.runtimeKeys ?? []) {
    add(key?.name, "GOOGLE_CLOUD_IAM", "global", IAM_RECEIPT);
  }
  for (const key of resources.deployServiceAccountKeys ?? []) {
    add(key?.name, "GOOGLE_CLOUD_IAM", "global", IAM_RECEIPT);
  }
  for (const key of resources.buildServiceAccountKeys ?? []) {
    add(key?.name, "GOOGLE_CLOUD_IAM", "global", IAM_RECEIPT);
  }
  for (const binding of resources.iamBindings ?? []) {
    for (const member of binding?.members ?? []) {
      add(
        `projects/${projectId}/iamBindings/${encodeURIComponent(binding.role)}`
        + `/${encodeURIComponent(member)}`,
        "GOOGLE_CLOUD_IAM",
        "global",
        IAM_RECEIPT,
      );
    }
  }
  addIamBindings(
    `projects/${projectNumber}/secrets/LUDYS_CAPABILITY_HMAC_KEY`,
    resources.capabilitySecretIamBindings,
    APPROVED_REGION,
  );
  const serviceAccountPolicies = resources.serviceAccountIamBindings ?? {};
  addIamBindings(
    `projects/${projectId}/serviceAccounts/`
      + `ludys-staging-deployer@${projectId}.iam.gserviceaccount.com`,
    serviceAccountPolicies.deploy,
  );
  addIamBindings(
    `projects/${projectId}/serviceAccounts/`
      + `ludys-staging-runtime@${projectId}.iam.gserviceaccount.com`,
    serviceAccountPolicies.runtime,
  );
  addIamBindings(
    `projects/${projectId}/serviceAccounts/`
      + `${projectNumber}-compute@developer.gserviceaccount.com`,
    serviceAccountPolicies.build,
  );
  const buildResourcePolicies =
    resources.buildIdentityResourceIamBindings ?? {};
  addIamBindings(
    `projects/${projectId}/locations/${APPROVED_REGION}`
      + "/repositories/gcf-artifacts",
    buildResourcePolicies.functionArtifactRepository,
    APPROVED_REGION,
  );
  addIamBindings(
    `gs://gcf-v2-sources-${projectNumber}-${APPROVED_REGION}`,
    buildResourcePolicies.functionSourceBucket,
    APPROVED_REGION,
  );
  const wif = resources.workloadIdentityFederation ?? {};
  for (const pool of wif.pools ?? []) {
    add(pool?.name, "GOOGLE_CLOUD_IAM", "global", IAM_RECEIPT);
  }
  for (const provider of wif.providers ?? []) {
    add(provider?.name, "GOOGLE_CLOUD_IAM", "global", IAM_RECEIPT);
  }
  if (wif.previewServiceAccount?.name) {
    add(
      wif.previewServiceAccount.name,
      "GOOGLE_CLOUD_IAM",
      "global",
      IAM_RECEIPT,
    );
  }
  for (const key of wif.previewServiceAccountKeys ?? []) {
    add(key?.name, "GOOGLE_CLOUD_IAM", "global", IAM_RECEIPT);
  }
  for (const binding of wif.previewServiceAccountIamBindings ?? []) {
    for (const member of binding?.members ?? []) {
      add(
        `${wif.previewServiceAccount?.name}/iamBindings/`
        + `${encodeURIComponent(binding.role)}/${encodeURIComponent(member)}`,
        "GOOGLE_CLOUD_IAM",
        "global",
        IAM_RECEIPT,
      );
    }
  }
  for (const policy of wif.runIamBindings ?? []) {
    for (const member of policy?.invokerMembers ?? []) {
      add(
        `${policy.serviceName}/iamBindings/`
        + `${encodeURIComponent("roles/run.invoker")}/${encodeURIComponent(member)}`,
        "GOOGLE_CLOUD_IAM",
        APPROVED_REGION,
        IAM_RECEIPT,
      );
    }
  }
  for (const bucket of resources.buckets ?? []) {
    add(
      `gs://${bucket.name}`,
      "GOOGLE_CLOUD",
      String(bucket.location ?? "global").toLowerCase(),
      IAM_RECEIPT,
    );
  }
  for (const repository of resources.artifactRepositories ?? []) {
    add(
      `projects/${projectId}/locations/${repository.location || APPROVED_REGION}`
      + `/repositories/${repository.name}`,
      "GOOGLE_CLOUD",
      repository.location || APPROVED_REGION,
      IAM_RECEIPT,
    );
  }
  for (const site of resources.hostingSites ?? []) {
    add(site?.name, "FIREBASE", "global", FIREBASE_RECEIPT);
  }
  const vercel = resources.vercel;
  if (vercel?.project?.id) {
    add(
      `vercel://teams/${APPROVED_VERCEL_TEAM_ID}/projects/${vercel.project.id}`,
      "VERCEL",
      "global",
      PREVIEW_RECEIPT,
    );
  }
  for (const deployment of vercel?.deployments ?? []) {
    add(
      `vercel://deployments/${deployment.id}`,
      "VERCEL",
      "global",
      PREVIEW_RECEIPT,
    );
  }
  return [...identities.values()].sort(
    (left, right) => left.resourceId.localeCompare(right.resourceId),
  );
}

function canonicalReceiptContextIds(report) {
  const ids = new Set([
    APPROVED_PROJECT_ID,
    APPROVED_PROJECT_NUMBER,
    `projects/${APPROVED_PROJECT_ID}`,
    APPROVED_VERCEL_TEAM_ID,
    APPROVED_VERCEL_TEAM_SLUG,
    APPROVED_VERCEL_PROJECT_ID,
  ]);
  const resources = report?.resources ?? {};
  for (const serviceAccount of resources.serviceAccounts ?? []) {
    if (serviceAccount?.email) ids.add(serviceAccount.email);
  }
  if (resources.workloadIdentityFederation?.previewServiceAccount?.email) {
    ids.add(resources.workloadIdentityFederation.previewServiceAccount.email);
  }
  for (const deployment of resources.vercel?.deployments ?? []) {
    if (deployment?.id) ids.add(deployment.id);
    if (deployment?.url) {
      ids.add(deployment.url);
      const httpsUrl = String(deployment.url).startsWith("https://")
        ? String(deployment.url)
        : `https://${deployment.url}`;
      ids.add(httpsUrl);
      ids.add(httpsUrl.endsWith("/") ? httpsUrl : `${httpsUrl}/`);
    }
  }
  for (const budget of resources.budgets ?? []) {
    if (budget?.name) ids.add(budget.name);
  }
  return ids;
}

function validatedReceiptMap(validatedReceipts) {
  if (validatedReceipts instanceof Map) return validatedReceipts;
  const map = new Map();
  for (const entry of Array.isArray(validatedReceipts) ? validatedReceipts : []) {
    if (entry?.path && entry?.receipt) map.set(entry.path, entry.receipt);
  }
  return map;
}

export async function verifyExternalResourceInventoryIntegrity(
  inventory,
  repo,
  validatedReceipts = [],
) {
  const errors = [];
  if (inventory?.inventoryStatus === "PENDING_AUTHENTIC_PROVIDER_READBACK") {
    return {
      errors,
      operatorArtifactExists: false,
      artifactSha256: null,
      inventoryDigest: null,
      overlayResourcesDigest: null,
    };
  }
  if (
    inventory?.inventoryStatus !== "AUTHENTIC_PROVIDER_SNAPSHOT"
    && inventory?.inventoryStatus !== "DESTRUCTION_VERIFIED_ZERO_RESOURCES"
  ) {
    return {
      errors: ["inventory integrity requires a recognized inventory status"],
      operatorArtifactExists: false,
      artifactSha256: null,
      inventoryDigest: null,
      overlayResourcesDigest: null,
    };
  }

  const binding = inventory?.operatorEvidence;
  if (
    binding === null
    || typeof binding !== "object"
    || Array.isArray(binding)
    || binding.path !== OPERATOR_EVIDENCE_PATH
  ) {
    return {
      errors: ["inventory operator evidence binding is missing or invalid"],
      operatorArtifactExists: false,
      artifactSha256: null,
      inventoryDigest: null,
      overlayResourcesDigest: null,
    };
  }

  let bytes;
  let report;
  try {
    bytes = await readFile(repositoryFile(repo, binding.path));
    report = JSON.parse(bytes.toString("utf8"));
  } catch {
    errors.push("inventory operator evidence artifact is missing, unreadable or invalid JSON");
    return {
      errors,
      operatorArtifactExists: false,
      artifactSha256: null,
      inventoryDigest: null,
      overlayResourcesDigest: null,
    };
  }

  const artifactSha256 = createHash("sha256").update(bytes).digest("hex");
  if (!SHA_256.test(String(binding.artifactSha256 ?? ""))) {
    errors.push("inventory operator artifact binding is not SHA-256");
  } else if (binding.artifactSha256 !== artifactSha256) {
    errors.push("inventory operator artifact SHA-256 mismatch");
  }

  if (
    report?.schemaVersion !== "wp13.12b-ea-operator-resource-inventory-v2"
    || binding.schemaVersion !== report.schemaVersion
  ) errors.push("inventory operator artifact schema mismatch");
  if (
    report?.mode !== "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION"
    || binding.mode !== report.mode
  ) errors.push("inventory operator artifact mode mismatch");
  if (
    report?.source !== "LIVE_READ_ONLY_PROVIDER_QUERIES"
    || binding.source !== report.source
  ) errors.push("inventory operator artifact is not from live read-only provider queries");
  if (report?.externalWrites !== 0) {
    errors.push("inventory operator artifact must record zero provider writes");
  }
  if (
    !Array.isArray(report?.blockers)
    || report.blockers.length !== 0
    || binding.blockerCount !== 0
    || report.inventoryPolicyConformant !== true
  ) errors.push("inventory operator artifact must be policy-conformant with zero blockers");

  const reportWithoutDigest = { ...report };
  delete reportWithoutDigest.inventoryDigest;
  const inventoryDigest = deterministicEvidenceDigest(reportWithoutDigest);
  if (
    !SHA_256.test(String(report?.inventoryDigest ?? ""))
    || report.inventoryDigest !== inventoryDigest
    || binding.inventoryDigest !== inventoryDigest
  ) errors.push("inventory operator digest does not recompute or match its binding");

  const vercel = report?.resources?.vercel;
  if (
    vercel?.authenticatedReadback !== true
    || binding.authenticatedVercelReadback !== true
    || vercel?.team?.id !== APPROVED_VERCEL_TEAM_ID
    || vercel?.team?.slug !== APPROVED_VERCEL_TEAM_SLUG
    || vercel?.tokenPrinted !== false
    || vercel?.oidcTokenPrinted !== false
  ) errors.push("inventory requires authenticated, non-disclosing exact Vercel readback");

  if (inventory.inventoryStatus === "AUTHENTIC_PROVIDER_SNAPSHOT") {
    if (
      report?.project?.projectId !== APPROVED_PROJECT_ID
      || report.project.projectNumber !== APPROVED_PROJECT_NUMBER
      || vercel?.project?.id !== APPROVED_VERCEL_PROJECT_ID
      || vercel?.projectAbsent !== false
    ) errors.push("authentic inventory operator artifact provider scope mismatch");
  } else if (
    report?.project !== null
    || (report?.resources?.budgets ?? []).length !== 0
    || vercel?.project !== null
    || vercel?.projectAbsent !== true
    || (vercel?.deployments ?? []).length !== 0
    || report?.zeroResourceClaimAllowed !== true
  ) {
    errors.push("destruction inventory operator artifact does not prove both scopes absent");
  }

  const resources = Array.isArray(inventory.resources) ? inventory.resources : [];
  const overlayResourcesDigest = deterministicEvidenceDigest(resources);
  if (
    !SHA_256.test(String(binding.overlayResourcesDigest ?? ""))
    || binding.overlayResourcesDigest !== overlayResourcesDigest
  ) errors.push("inventory overlay resources digest mismatch");

  const receipts = validatedReceiptMap(validatedReceipts);
  let canonicalIdentities = [];
  try {
    canonicalIdentities = canonicalOperatorResourceIdentities(report);
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "canonical operator resource identity transform failed",
    );
  }
  const actualIdentities = resources
    .map((resource) => ({
      resourceId: resource?.resourceId,
      provider: resource?.provider,
      region: resource?.region,
    }))
    .sort((left, right) => String(left.resourceId).localeCompare(String(right.resourceId)));
  const expectedIdentities = canonicalIdentities.map(
    ({ resourceId, provider, region }) => ({ resourceId, provider, region }),
  );
  if (JSON.stringify(actualIdentities) !== JSON.stringify(expectedIdentities)) {
    errors.push(
      "inventory resources are not the exact deterministic operator-report transform",
    );
  }
  const canonicalById = new Map(
    canonicalIdentities.map((identity) => [identity.resourceId, identity]),
  );
  for (const [index, resource] of resources.entries()) {
    const canonical = canonicalById.get(resource?.resourceId);
    const receipt = receipts.get(resource?.receiptReference);
    if (receipt === undefined) {
      errors.push(`inventory resource ${index} receipt reference is not validated`);
      continue;
    }
    if (canonical !== undefined && receipt.receiptType !== canonical.receiptType) {
      errors.push(`inventory resource ${index} is bound to the wrong receipt type`);
    }
    const receiptResourceIds = receipt?.providerResourceIds?.resourceIds;
    if (
      !Array.isArray(receiptResourceIds)
      || !receiptResourceIds.includes(resource.resourceId)
    ) {
      errors.push(`inventory resource ${index} ID is not bound by its validated receipt`);
    }
  }
  const contextIds = canonicalReceiptContextIds(report);
  const relevantReceiptTypes = new Set([
    FIREBASE_RECEIPT,
    IAM_RECEIPT,
    PREVIEW_RECEIPT,
  ]);
  for (const [receiptPath, receipt] of receipts) {
    if (!relevantReceiptTypes.has(receipt?.receiptType)) continue;
    const receiptResourceIds = receipt?.providerResourceIds?.resourceIds;
    if (!Array.isArray(receiptResourceIds)) {
      errors.push(`validated receipt resourceIds are missing: ${receiptPath}`);
      continue;
    }
    const allowed = new Set(contextIds);
    for (const identity of canonicalIdentities) {
      if (identity.receiptType === receipt.receiptType) {
        allowed.add(identity.resourceId);
      }
    }
    for (const resourceId of receiptResourceIds) {
      if (typeof resourceId !== "string" || !allowed.has(resourceId)) {
        errors.push(`validated receipt contains an unrecognized resourceId: ${receiptPath}`);
      }
    }
  }

  return {
    errors,
    operatorArtifactExists: true,
    artifactSha256,
    inventoryDigest,
    overlayResourcesDigest,
  };
}

export async function verifyReceiptRepositoryIntegrity(
  receipt,
  repo,
  {
    receiptPath,
    artifactVerificationMode,
  } = {},
) {
  const errors = [];
  let resolvedSourceTree;
  let sourceCommitExists = false;
  let sourceTreeExists = false;
  let evidenceCommit = null;
  let verificationCommit = null;

  if (!FULL_GIT_SHA.test(String(receipt?.sourceCommit ?? ""))) {
    errors.push("receipt source commit is not a full lowercase Git SHA");
  } else {
    try {
      const type = git(repo, ["cat-file", "-t", receipt.sourceCommit]);
      if (type !== "commit") {
        errors.push("receipt sourceCommit does not identify a commit object");
      } else {
        sourceCommitExists = true;
        resolvedSourceTree = git(repo, ["rev-parse", `${receipt.sourceCommit}^{tree}`]);
      }
    } catch {
      errors.push("receipt sourceCommit does not exist in the repository");
    }
  }

  if (!FULL_GIT_SHA.test(String(receipt?.sourceTree ?? ""))) {
    errors.push("receipt source tree is not a full lowercase Git SHA");
  } else {
    try {
      const type = git(repo, ["cat-file", "-t", receipt.sourceTree]);
      if (type !== "tree") {
        errors.push("receipt sourceTree does not identify a tree object");
      } else {
        sourceTreeExists = true;
      }
    } catch {
      errors.push("receipt sourceTree does not exist in the repository");
    }
  }
  if (resolvedSourceTree !== undefined && receipt?.sourceTree !== resolvedSourceTree) {
    errors.push("receipt sourceTree does not match sourceCommit tree");
  }

  if (!isRepositoryRelativePath(receiptPath)) {
    errors.push("receipt path is not repository-relative");
  }
  if (
    artifactVerificationMode
      !== RECEIPT_ARTIFACT_VERIFICATION_MODE.SOURCE_COMMIT
    && artifactVerificationMode
      !== RECEIPT_ARTIFACT_VERIFICATION_MODE.DESCENDANT_EVIDENCE_COMMIT
  ) {
    errors.push("receipt artifact verification mode is missing or invalid");
  } else if (sourceCommitExists && isRepositoryRelativePath(receiptPath)) {
    if (
      artifactVerificationMode
        === RECEIPT_ARTIFACT_VERIFICATION_MODE.SOURCE_COMMIT
    ) {
      verificationCommit = receipt.sourceCommit;
    } else {
      try {
        evidenceCommit = git(repo, [
          "log",
          "-n",
          "1",
          "--format=%H",
          "HEAD",
          "--",
          receiptPath,
        ]);
        if (!FULL_GIT_SHA.test(evidenceCommit)) {
          throw new Error("receipt evidence commit is unavailable");
        }
        if (evidenceCommit === receipt.sourceCommit) {
          errors.push(
            "receipt descendant evidence mode requires a commit after sourceCommit",
          );
        } else {
          try {
            git(repo, [
              "merge-base",
              "--is-ancestor",
              receipt.sourceCommit,
              evidenceCommit,
            ]);
            verificationCommit = evidenceCommit;
          } catch {
            errors.push(
              "receipt evidence commit does not descend from sourceCommit",
            );
          }
        }
      } catch {
        errors.push("receipt evidence commit is unavailable");
        evidenceCommit = null;
      }
    }
  }

  if (verificationCommit !== null && isRepositoryRelativePath(receiptPath)) {
    try {
      const committedReceiptBytes = gitBytes(
        repo,
        ["show", `${verificationCommit}:${receiptPath}`],
      );
      const workingReceiptBytes = await readFile(
        repositoryFile(repo, receiptPath),
      );
      if (!committedReceiptBytes.equals(workingReceiptBytes)) {
        errors.push(
          "receipt bytes do not match the selected committed repository artifact",
        );
      }
      let committedReceipt;
      try {
        committedReceipt = JSON.parse(committedReceiptBytes.toString("utf8"));
      } catch {
        errors.push("committed receipt artifact is not valid JSON");
      }
      if (
        committedReceipt !== undefined
        && !isDeepStrictEqual(committedReceipt, receipt)
      ) {
        errors.push("receipt value does not match the selected committed receipt");
      }
    } catch {
      errors.push("receipt is not committed at the selected verification commit");
    }
  }

  const artifactResults = [];
  if (
    receipt?.artifactHashes !== null
    && typeof receipt?.artifactHashes === "object"
  ) {
    for (const [path, expectedSha256] of Object.entries(receipt.artifactHashes)) {
      const result = {
        path,
        expectedSha256,
        actualSha256: null,
        verified: false,
        verifiedFrom: null,
        verificationCommit,
      };
      artifactResults.push(result);
      if (!isRepositoryRelativePath(path)) {
        errors.push(`receipt artifact path is not repository-relative: ${path}`);
        continue;
      }
      if (!SHA_256.test(String(expectedSha256))) {
        errors.push(`receipt artifact digest is not SHA-256: ${path}`);
        continue;
      }
      try {
        if (verificationCommit === null) {
          errors.push(`receipt artifact verification commit is unavailable: ${path}`);
          continue;
        }
        const bytes = gitBytes(
          repo,
          ["show", `${verificationCommit}:${path}`],
        );
        result.verifiedFrom = artifactVerificationMode;
        result.actualSha256 = createHash("sha256").update(bytes).digest("hex");
        result.verified = result.actualSha256 === expectedSha256;
        if (!result.verified) errors.push(`receipt artifact hash mismatch: ${path}`);
      } catch {
        errors.push(
          `receipt artifact is missing from the selected verification commit: ${path}`,
        );
      }
    }
  }

  return {
    errors,
    sourceCommitExists,
    sourceTreeExists,
    resolvedSourceTree,
    receiptPath,
    artifactVerificationMode,
    evidenceCommit,
    verificationCommit,
    artifactResults,
  };
}
