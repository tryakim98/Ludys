import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  validateOwnerDecisionForWp13_12b,
  validateReceipt,
  validateStagingRepositoryContract,
} from "../../src/core/staging-validation.js";

const ownerDecision = JSON.parse(readFileSync(
  "release/wp13-12a/decision-package/owner-decision.json",
  "utf8",
)) as Record<string, unknown>;
const authorization = JSON.parse(readFileSync(
  "release/wp13-12a/decision-package/authorization-status.json",
  "utf8",
)) as Record<string, unknown>;
const contract = JSON.parse(readFileSync(
  "release/wp13-12b/staging-activation/repository-contract.json",
  "utf8",
)) as Record<string, unknown>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function ownerErrors(
  decision: unknown = ownerDecision,
  auth: unknown = authorization,
  sourceChecksum = "f3830a640fd901f193279ed99338d923848acaef662e79e8a831e870a7813de7",
  decisionChecksum = "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754",
) {
  return validateOwnerDecisionForWp13_12b({
    ownerDecision: decision,
    authorization: auth,
    actualSourcePackageChecksum: sourceChecksum,
    actualDecisionRecordChecksum: decisionChecksum,
    checksumManifestDecisionRecordChecksum: "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754",
  });
}

test("valid owner decision authorizes repository work without provider activation", () => {
  assert.deepEqual(ownerErrors(), []);
});

test("missing owner-decision record fails closed", () => {
  assert.match(ownerErrors(null).join(";"), /missing|invalid/);
});

test("wrong owner-decision checksum and source package checksum fail closed", () => {
  assert.match(ownerErrors(ownerDecision, authorization, "0".repeat(64)).join(";"), /source package checksum/);
  assert.match(ownerErrors(ownerDecision, authorization, undefined, "0".repeat(64)).join(";"), /decision record checksum/);
});

for (const decision of ["DEFER", "REJECT", "UNKNOWN"]) {
  test(`${decision} cannot authorize WP13.12B repository implementation`, () => {
    const changed = clone(ownerDecision);
    changed.decision = decision;
    assert.match(ownerErrors(changed).join(";"), /APPROVE_RECOMMENDED_SYNTHETIC_DEV/);
  });
}

test("incomplete decision, fabricated signature and wrong release binding fail closed", () => {
  const incomplete = clone(ownerDecision);
  delete incomplete.maximumMonthlyCost;
  assert.match(ownerErrors(incomplete).join(";"), /maximumMonthlyCost/);
  const signature = clone(ownerDecision);
  (signature.signatureOrExplicitOwnerConfirmation as Record<string, unknown>).signaturePresent = true;
  assert.match(ownerErrors(signature).join(";"), /fabricated signature/);
  const release = clone(ownerDecision);
  release.sourcePackageVersion = "13.12B";
  assert.match(ownerErrors(release).join(";"), /source package version/);
});

test("missing or contradictory owner conditions and automatic activation fail closed", () => {
  const conditions = clone(ownerDecision);
  conditions.conditions = [];
  assert.match(ownerErrors(conditions).join(";"), /owner condition missing/);
  const activated = clone(ownerDecision);
  (activated.effects as Record<string, unknown>).activatesProvider = true;
  assert.match(ownerErrors(activated).join(";"), /authorization ceiling/);
});

test("provider activation, cloud resources, B8, student beta and production fail closed", () => {
  for (const [field, value] of [
    ["providerActivation", "ACTIVE"],
    ["cloudResources", 1],
    ["b8", "APPROVED"],
    ["studentBeta", "AUTHORIZED"],
    ["production", "AUTHORIZED"],
  ] as const) {
    const changed = clone(authorization);
    changed[field] = value;
    assert.ok(ownerErrors(ownerDecision, changed).length > 0, field);
  }
});

test("valid staging repository contract preserves every scope ceiling", () => {
  assert.deepEqual(validateStagingRepositoryContract(contract), []);
});

for (const [field, value] of [
  ["providerActivation", "ACTIVE"],
  ["cloudResources", 1],
  ["firebaseAuthentication", true],
  ["stableUid", true],
  ["directClientWrite", true],
  ["providerIsolation", false],
  ["pureCoreProviderFree", false],
  ["firestoreRulesDenyByDefault", false],
  ["serverAuthoritativeHandler", false],
  ["capabilityBearerOnly", false],
  ["explicitDeletion", false],
  ["tombstone", false],
  ["ttlBackstopOnly", false],
  ["backupAndPitrEnabled", true],
  ["killSwitch", false],
  ["noResurrection", false],
  ["roleProjectionIsolation", false],
  ["syntheticDataOnly", false],
  ["runtimeAi", true],
  ["externalReceipts", 1],
  ["physicalTwoDeviceProof", true],
  ["b8", "APPROVED"],
  ["studentBeta", "AUTHORIZED"],
  ["production", "AUTHORIZED"],
  ["wp13_12c", "OPEN"],
] as const) {
  test(`staging validator rejects ${field}=${String(value)}`, () => {
    const changed = clone(contract);
    changed[field] = value;
    assert.ok(validateStagingRepositoryContract(changed).length > 0);
  });
}

test("staging validator rejects missing no-go rules", () => {
  const changed = clone(contract);
  changed.noGo = [];
  assert.match(validateStagingRepositoryContract(changed).join(";"), /no-go missing/);
});

test("unfilled receipt template is valid structure but never evidence", () => {
  const template = JSON.parse(readFileSync(
    "release/wp13-12b/receipts/templates/emulator_proof_receipt.json",
    "utf8",
  ));
  assert.deepEqual(validateReceipt(template), { valid: true, evidence: false, errors: [] });
});

test("filled receipt without signature, commands, hashes or provider ID is rejected", () => {
  const receipt = {
    receiptId: "receipt-1",
    receiptType: "FIREBASE_PROJECT_AND_REGION_RECEIPT",
    status: "COMPLETED_WITH_AUTHENTIC_EVIDENCE",
    createdAt: "2026-07-25T10:00:00.000Z",
    performedBy: "operator",
    environment: "SYNTHETIC_DEV",
    sourceCommit: "a".repeat(40),
    sourceTree: "b".repeat(40),
    decisionRecordChecksum: "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754",
    commandsRun: [],
    providerResourceIds: {},
    proofResults: {},
    artifactHashes: {},
    limitations: [],
    humanSignatureOrExplicitConfirmation: { confirmed: false },
    selectedRegion: "europe-north1",
  };
  const result = validateReceipt(receipt);
  assert.equal(result.valid, false);
  assert.equal(result.evidence, false);
  assert.match(result.errors.join(";"), /signature|commands|hashes|provider ID/i);
});

test("receipt bound to wrong commit or claiming physical proof without devices is rejected", () => {
  const receipt = {
    receiptId: "physical-1",
    receiptType: "PHYSICAL_TWO_DEVICE_AND_SAFETY_RECEIPT",
    status: "COMPLETED_WITH_AUTHENTIC_EVIDENCE",
    createdAt: "2026-07-25T10:00:00.000Z",
    performedBy: "operator",
    environment: "SYNTHETIC_DEV",
    sourceCommit: "a".repeat(40),
    expectedSourceCommit: "b".repeat(40),
    sourceTree: "c".repeat(40),
    decisionRecordChecksum: "a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754",
    commandsRun: ["physical proof steps"],
    providerResourceIds: { preview: "preview-id" },
    proofResults: { stop: true },
    artifactHashes: { proof: "d".repeat(64) },
    limitations: [],
    humanSignatureOrExplicitConfirmation: { confirmed: true },
    physicalProof: true,
    devices: [],
    checksum: "e".repeat(64),
    stagingUrl: "https://synthetic.invalid",
    sessionFixture: "synthetic-only",
    stepResults: [],
    containsPersonData: false,
  };
  const result = validateReceipt(receipt, {
    sourceCommit: "b".repeat(40),
    providerIdRequired: true,
    physicalDeviceProof: true,
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(";"), /wrong|device|two physical/i);
});

test("receipt cannot open B8, authorize beta/production or claim fabricated status", () => {
  const template = JSON.parse(readFileSync(
    "release/wp13-12b/receipts/templates/protected_preview_receipt.json",
    "utf8",
  ));
  template.status = "COMPLETED_WITH_AUTHENTIC_EVIDENCE";
  template.templateMarker = "FILLED";
  template.opensB8 = true;
  template.authorizesStudentBeta = true;
  template.authorizesProduction = true;
  template.syntheticOrFabricated = true;
  const result = validateReceipt(template);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(";"), /B8|fabricated|production/i);
});
