import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  canonicalOperatorResourceIdentities,
  deterministicEvidenceDigest,
  RECEIPT_ARTIFACT_VERIFICATION_MODE,
  verifyExternalResourceInventoryIntegrity,
  verifyReceiptRepositoryIntegrity,
} from "./wp13-12b-receipt-integrity.mjs";

const operatorArtifactPath =
  "artifacts/wp13-12b-external-resource-inventory.json";
const fixtureReceiptPath =
  "release/wp13-12b/receipts/actual/test-receipt.json";
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function runGit(root, args) {
  return execFileSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function committedReceiptFixture(root, {
  commitLaterArtifact = true,
} = {}) {
  runGit(root, ["init", "--initial-branch=main"]);
  runGit(root, ["config", "user.name", "Receipt Integrity Test"]);
  runGit(root, ["config", "user.email", "receipt-integrity@local.invalid"]);
  await writeFile(join(root, "source-artifact.txt"), "source artifact\n");
  runGit(root, ["add", "source-artifact.txt"]);
  runGit(root, ["commit", "-m", "source"]);
  const sourceCommit = runGit(root, ["rev-parse", "HEAD"]);
  const sourceTree = runGit(root, ["rev-parse", "HEAD^{tree}"]);
  const laterArtifactBytes = Buffer.from("later evidence artifact\n");
  const receipt = {
    sourceCommit,
    sourceTree,
    artifactHashes: {
      "source-artifact.txt": sha256(Buffer.from("source artifact\n")),
      "later-artifact.txt": sha256(laterArtifactBytes),
    },
  };
  await mkdir(join(root, "release", "wp13-12b", "receipts", "actual"), {
    recursive: true,
  });
  await writeFile(
    join(root, ...fixtureReceiptPath.split("/")),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  if (commitLaterArtifact) {
    await writeFile(join(root, "later-artifact.txt"), laterArtifactBytes);
    runGit(root, ["add", fixtureReceiptPath, "later-artifact.txt"]);
  } else {
    runGit(root, ["add", fixtureReceiptPath]);
  }
  runGit(root, ["commit", "-m", "receipt evidence"]);
  const evidenceCommit = runGit(root, ["rev-parse", "HEAD"]);
  if (!commitLaterArtifact) {
    await writeFile(join(root, "later-artifact.txt"), laterArtifactBytes);
  }
  return {
    receipt,
    sourceCommit,
    sourceTree,
    evidenceCommit,
  };
}

function descendantReceiptOptions() {
  return {
    receiptPath: fixtureReceiptPath,
    artifactVerificationMode:
      RECEIPT_ARTIFACT_VERIFICATION_MODE.DESCENDANT_EVIDENCE_COMMIT,
  };
}

function authenticOperatorReport() {
  const withoutDigest = {
    schemaVersion: "wp13.12b-ea-operator-resource-inventory-v2",
    mode: "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION",
    externalWrites: 0,
    source: "LIVE_READ_ONLY_PROVIDER_QUERIES",
    project: {
      projectId: "ludys-12b-stg-20260725",
      projectNumber: "134654966474",
      lifecycleState: "ACTIVE",
    },
    resources: {
      budgets: [{
        name:
          "billingAccounts/01CD9D-0900DF-4FB36A/"
          + "budgets/bb8cd353-test",
      }],
      functions: [{
        name: "issueSyntheticSession",
        location: "europe-north1",
      }],
      runServices: [],
      serviceAccounts: [],
      buckets: [],
      artifactRepositories: [],
      vercel: {
        provider: "VERCEL_PROTECTED_PREVIEW",
        authenticatedReadback: true,
        team: {
          id: "team_1Gnn3VSNrP3mbseXx6a92a4J",
          slug: "trym-s-projects",
        },
        project: {
          id: "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
          name: "ludys-wp13-12b-staging",
        },
        deployments: [{
          id: "dpl_integritytest123",
          projectId: "prj_nHs1hbdyfcMMMglNUTwoYRS43naN",
          target: null,
          url: "ludys-integrity-test.vercel.app",
        }],
        projectAbsent: false,
        productionDeploymentCount: 0,
        tokenPrinted: false,
        oidcTokenPrinted: false,
      },
    },
    previewInventory: "INCLUDED_AUTHENTICATED_READBACK",
    blockers: [],
    inventoryPolicyConformant: true,
    zeroResourceClaimAllowed: false,
  };
  return {
    ...withoutDigest,
    inventoryDigest: deterministicEvidenceDigest(withoutDigest),
  };
}

function overlayResource(
  resourceId,
  provider,
  region,
  receiptReference,
) {
  return {
    resourceId,
    provider,
    region,
    purpose: "Synthetic staging integrity test resource",
    createdAt: "2026-07-27T10:00:00.000Z",
    owner: "tryakim@gmail.com",
    retention: "Until approved destruction",
    deletionMethod: "Authenticated destruction procedure",
    costRisk: "Bounded synthetic staging cost risk",
    containsRealData: false,
    destructionDeadline: "2027-01-25",
    receiptReference,
    lifecycleStatus: "ACTIVE",
    evidencePath: operatorArtifactPath,
    syntheticOnly: true,
  };
}

async function writeOperatorFixture(tempRepo, report) {
  const target = join(tempRepo, "artifacts", "wp13-12b-external-resource-inventory.json");
  await mkdir(join(tempRepo, "artifacts"), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  await writeFile(target, bytes);
  return createHash("sha256").update(bytes).digest("hex");
}

function authenticOverlay(report, artifactSha256) {
  const firebaseReceiptPath =
    "release/wp13-12b/receipts/actual/firebase-project-and-region.json";
  const previewReceiptPath =
    "release/wp13-12b/receipts/actual/protected-preview.json";
  const receiptPaths = {
    FIREBASE_PROJECT_AND_REGION_RECEIPT: firebaseReceiptPath,
    IAM_AND_BILLING_RECEIPT:
      "release/wp13-12b/receipts/actual/iam-and-billing.json",
    PROTECTED_PREVIEW_RECEIPT: previewReceiptPath,
  };
  const canonical = canonicalOperatorResourceIdentities(report);
  const resources = canonical.map((identity) => overlayResource(
    identity.resourceId,
    identity.provider,
    identity.region,
    receiptPaths[identity.receiptType],
  ));
  const receiptEntries = Object.entries(receiptPaths).map(
    ([receiptType, path]) => [
      path,
      {
        receiptType,
        providerResourceIds: {
          resourceIds: canonical
            .filter((identity) => identity.receiptType === receiptType)
            .map((identity) => identity.resourceId),
        },
      },
    ],
  );
  return {
    inventoryStatus: "AUTHENTIC_PROVIDER_SNAPSHOT",
    observation: {
      evidencePaths: [operatorArtifactPath],
    },
    resources,
    operatorEvidence: {
      path: operatorArtifactPath,
      artifactSha256,
      inventoryDigest: report.inventoryDigest,
      overlayResourcesDigest: deterministicEvidenceDigest(resources),
      schemaVersion: "wp13.12b-ea-operator-resource-inventory-v2",
      source: "LIVE_READ_ONLY_PROVIDER_QUERIES",
      mode: "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION",
      authenticatedVercelReadback: true,
      blockerCount: 0,
    },
    validatedReceipts: new Map(receiptEntries),
  };
}

test("receipt integrity binds receipt and later artifacts to one descendant evidence commit", async (t) => {
  const repo = await mkdtemp(join(tmpdir(), "ludys-receipt-integrity-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const fixture = await committedReceiptFixture(repo);
  const result = await verifyReceiptRepositoryIntegrity(
    fixture.receipt,
    repo,
    descendantReceiptOptions(),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.sourceCommitExists, true);
  assert.equal(result.sourceTreeExists, true);
  assert.equal(result.resolvedSourceTree, fixture.sourceTree);
  assert.equal(result.evidenceCommit, fixture.evidenceCommit);
  assert.equal(result.verificationCommit, fixture.evidenceCommit);
  assert.ok(result.artifactResults.length > 0);
  assert.ok(result.artifactResults.every((artifact) => artifact.verified));
  assert.ok(result.artifactResults.every(
    (artifact) => artifact.verifiedFrom
      === RECEIPT_ARTIFACT_VERIFICATION_MODE.DESCENDANT_EVIDENCE_COMMIT,
  ));
});

test("receipt integrity rejects dirty receipt bytes and an uncommitted artifact fallback", async (t) => {
  const dirtyRepo = await mkdtemp(join(tmpdir(), "ludys-receipt-integrity-"));
  const fallbackRepo =
    await mkdtemp(join(tmpdir(), "ludys-receipt-integrity-"));
  t.after(() => Promise.all([
    rm(dirtyRepo, { recursive: true, force: true }),
    rm(fallbackRepo, { recursive: true, force: true }),
  ]));

  const dirty = await committedReceiptFixture(dirtyRepo);
  await writeFile(
    join(dirtyRepo, ...fixtureReceiptPath.split("/")),
    `${JSON.stringify(dirty.receipt)}\n`,
  );
  const dirtyResult = await verifyReceiptRepositoryIntegrity(
    dirty.receipt,
    dirtyRepo,
    descendantReceiptOptions(),
  );
  assert.match(
    dirtyResult.errors.join(";"),
    /receipt bytes do not match.*committed/i,
  );

  const fallback = await committedReceiptFixture(fallbackRepo, {
    commitLaterArtifact: false,
  });
  const fallbackResult = await verifyReceiptRepositoryIntegrity(
    fallback.receipt,
    fallbackRepo,
    descendantReceiptOptions(),
  );
  assert.match(
    fallbackResult.errors.join(";"),
    /missing from the selected verification commit: later-artifact/i,
  );
  assert.equal(
    fallbackResult.artifactResults.find(
      (artifact) => artifact.path === "later-artifact.txt",
    )?.verified,
    false,
  );
});

test("receipt integrity fails closed for missing commit and mismatched existing tree", async (t) => {
  const repo = await mkdtemp(join(tmpdir(), "ludys-receipt-integrity-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const fixture = await committedReceiptFixture(repo);
  const missing = structuredClone(fixture.receipt);
  missing.sourceCommit = "0".repeat(40);
  const missingResult = await verifyReceiptRepositoryIntegrity(
    missing,
    repo,
    descendantReceiptOptions(),
  );
  assert.match(missingResult.errors.join(";"), /sourceCommit does not exist/i);

  const mismatched = structuredClone(fixture.receipt);
  mismatched.sourceTree = fixture.evidenceCommit;
  const mismatchResult = await verifyReceiptRepositoryIntegrity(
    mismatched,
    repo,
    descendantReceiptOptions(),
  );
  assert.match(mismatchResult.errors.join(";"), /does not match sourceCommit tree/i);
});

test("receipt integrity rejects alias, Git-internal and mismatched artifact bindings", async (t) => {
  const repo = await mkdtemp(join(tmpdir(), "ludys-receipt-integrity-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const fixture = await committedReceiptFixture(repo);
  const changed = structuredClone(fixture.receipt);
  changed.artifactHashes = {
    proofAlias: "0".repeat(64),
    ".git/config": "0".repeat(64),
    "source-artifact.txt": "0".repeat(64),
  };
  const result = await verifyReceiptRepositoryIntegrity(
    changed,
    repo,
    descendantReceiptOptions(),
  );
  assert.match(result.errors.join(";"), /not repository-relative|hash mismatch/i);
  assert.equal(result.artifactResults.every((artifact) => artifact.verified), false);
});

test("pending inventory remains valid without pretending an operator artifact exists", async () => {
  const pending = {
    inventoryStatus: "PENDING_AUTHENTIC_PROVIDER_READBACK",
  };
  assert.deepEqual(
    await verifyExternalResourceInventoryIntegrity(pending, repositoryRoot),
    {
      errors: [],
      operatorArtifactExists: false,
      artifactSha256: null,
      inventoryDigest: null,
      overlayResourcesDigest: null,
    },
  );
});

test("authentic inventory recomputes both digests and correlates resources to validated receipts", async (t) => {
  const tempRepo = await mkdtemp(join(tmpdir(), "ludys-inventory-integrity-"));
  t.after(() => rm(tempRepo, { recursive: true, force: true }));
  const report = authenticOperatorReport();
  const artifactSha256 = await writeOperatorFixture(tempRepo, report);
  const fixture = authenticOverlay(report, artifactSha256);
  const result = await verifyExternalResourceInventoryIntegrity(
    fixture,
    tempRepo,
    fixture.validatedReceipts,
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.operatorArtifactExists, true);
  assert.equal(result.artifactSha256, artifactSha256);
  assert.equal(result.inventoryDigest, report.inventoryDigest);
  assert.equal(
    result.overlayResourcesDigest,
    fixture.operatorEvidence.overlayResourcesDigest,
  );
});

test("authentic inventory rejects stale hashes, non-live readback, blockers and Vercel gaps", async (t) => {
  const tempRepo = await mkdtemp(join(tmpdir(), "ludys-inventory-integrity-"));
  t.after(() => rm(tempRepo, { recursive: true, force: true }));

  for (const [mutate, expected] of [
    [
      (report, fixture) => {
        fixture.operatorEvidence.artifactSha256 = "0".repeat(64);
      },
      /artifact SHA-256 mismatch/i,
    ],
    [
      (report) => {
        report.source = "LOCAL_TEST_FIXTURE";
      },
      /not from live read-only provider queries|digest/i,
    ],
    [
      (report) => {
        report.blockers = ["FORGED_BLOCKER"];
        report.inventoryPolicyConformant = false;
      },
      /zero blockers/i,
    ],
    [
      (report) => {
        report.resources.vercel.authenticatedReadback = false;
      },
      /authenticated.*Vercel readback/i,
    ],
  ]) {
    const report = authenticOperatorReport();
    const initialSha = await writeOperatorFixture(tempRepo, report);
    const fixture = authenticOverlay(report, initialSha);
    mutate(report, fixture);
    if (JSON.stringify(report) !== JSON.stringify(authenticOperatorReport())) {
      const changedSha = await writeOperatorFixture(tempRepo, report);
      fixture.operatorEvidence.artifactSha256 = changedSha;
    }
    const result = await verifyExternalResourceInventoryIntegrity(
      fixture,
      tempRepo,
      fixture.validatedReceipts,
    );
    assert.match(result.errors.join(";"), expected);
  }
});

test("authentic inventory rejects uncorrelated resource IDs and unvalidated receipt references", async (t) => {
  const tempRepo = await mkdtemp(join(tmpdir(), "ludys-inventory-integrity-"));
  t.after(() => rm(tempRepo, { recursive: true, force: true }));
  const report = authenticOperatorReport();
  const artifactSha256 = await writeOperatorFixture(tempRepo, report);

  const uncorrelated = authenticOverlay(report, artifactSha256);
  uncorrelated.resources[0].resourceId = "prj_forged";
  uncorrelated.operatorEvidence.overlayResourcesDigest =
    deterministicEvidenceDigest(uncorrelated.resources);
  assert.match(
    (
      await verifyExternalResourceInventoryIntegrity(
        uncorrelated,
        tempRepo,
        uncorrelated.validatedReceipts,
      )
    ).errors.join(";"),
    /exact deterministic operator-report transform|not bound by its validated receipt/i,
  );

  const missingReceipt = authenticOverlay(report, artifactSha256);
  missingReceipt.validatedReceipts.delete(
    missingReceipt.resources[0].receiptReference,
  );
  assert.match(
    (
      await verifyExternalResourceInventoryIntegrity(
        missingReceipt,
        tempRepo,
        missingReceipt.validatedReceipts,
      )
    ).errors.join(";"),
    /receipt reference is not validated/i,
  );
});

test("deterministic inventory rejects omitted resources and arbitrary report strings as receipt IDs", async (t) => {
  const tempRepo = await mkdtemp(join(tmpdir(), "ludys-inventory-integrity-"));
  t.after(() => rm(tempRepo, { recursive: true, force: true }));
  const report = authenticOperatorReport();
  report.resources.arbitraryMetadata = ["prj_arbitrary-string-only"];
  const withoutDigest = { ...report };
  delete withoutDigest.inventoryDigest;
  report.inventoryDigest = deterministicEvidenceDigest(withoutDigest);
  const artifactSha256 = await writeOperatorFixture(tempRepo, report);

  const omitted = authenticOverlay(report, artifactSha256);
  omitted.resources.pop();
  omitted.operatorEvidence.overlayResourcesDigest =
    deterministicEvidenceDigest(omitted.resources);
  assert.match(
    (
      await verifyExternalResourceInventoryIntegrity(
        omitted,
        tempRepo,
        omitted.validatedReceipts,
      )
    ).errors.join(";"),
    /exact deterministic operator-report transform/i,
  );

  const extraReceiptId = authenticOverlay(report, artifactSha256);
  const firstReceipt = extraReceiptId.validatedReceipts.values().next().value;
  firstReceipt.providerResourceIds.resourceIds.push("prj_arbitrary-string-only");
  assert.match(
    (
      await verifyExternalResourceInventoryIntegrity(
        extraReceiptId,
        tempRepo,
        extraReceiptId.validatedReceipts,
      )
    ).errors.join(";"),
    /unrecognized resourceId/i,
  );
});

test("destroyed inventory requires one live zero-resource readback for both providers", async (t) => {
  const tempRepo = await mkdtemp(join(tmpdir(), "ludys-inventory-integrity-"));
  t.after(() => rm(tempRepo, { recursive: true, force: true }));
  const report = authenticOperatorReport();
  report.project = null;
  report.resources.budgets = [];
  report.resources.vercel.project = null;
  report.resources.vercel.deployments = [];
  report.resources.vercel.projectAbsent = true;
  report.zeroResourceClaimAllowed = true;
  const withoutDigest = { ...report };
  delete withoutDigest.inventoryDigest;
  report.inventoryDigest = deterministicEvidenceDigest(withoutDigest);
  const artifactSha256 = await writeOperatorFixture(tempRepo, report);
  const resources = [];
  const inventory = {
    inventoryStatus: "DESTRUCTION_VERIFIED_ZERO_RESOURCES",
    resources,
    operatorEvidence: {
      path: operatorArtifactPath,
      artifactSha256,
      inventoryDigest: report.inventoryDigest,
      overlayResourcesDigest: deterministicEvidenceDigest(resources),
      schemaVersion: "wp13.12b-ea-operator-resource-inventory-v2",
      source: "LIVE_READ_ONLY_PROVIDER_QUERIES",
      mode: "READ_ONLY_IDEMPOTENT_EXTERNAL_OBSERVATION",
      authenticatedVercelReadback: true,
      blockerCount: 0,
    },
  };
  assert.deepEqual(
    (
      await verifyExternalResourceInventoryIntegrity(inventory, tempRepo)
    ).errors,
    [],
  );

  const forged = structuredClone(inventory);
  const forgedReport = authenticOperatorReport();
  const forgedSha = await writeOperatorFixture(tempRepo, forgedReport);
  forged.operatorEvidence.artifactSha256 = forgedSha;
  forged.operatorEvidence.inventoryDigest = forgedReport.inventoryDigest;
  assert.match(
    (
      await verifyExternalResourceInventoryIntegrity(forged, tempRepo)
    ).errors.join(";"),
    /does not prove both scopes absent/i,
  );
});
