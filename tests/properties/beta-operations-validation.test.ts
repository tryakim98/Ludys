import assert from "node:assert/strict";
import test from "node:test";
import { wp13_11OperationsKit } from "../../src/content/operations/wp13-11-operations-kit.js";
import {
  guardAdultOnlyFindingText,
  validateOperationsKit,
  type OperationsKit,
} from "../../src/core/beta-operations.js";

function mutate(mutator: (draft: Record<string, unknown>) => void): OperationsKit {
  const draft = structuredClone(wp13_11OperationsKit) as unknown as Record<string, unknown>;
  mutator(draft);
  return draft as unknown as OperationsKit;
}

function errors(kit: OperationsKit): string {
  return validateOperationsKit(kit).errors.join("\n");
}

test("duplicate artifact type and missing artifact fail closed", () => {
  const duplicate = mutate((draft) => {
    const artifacts = draft.artifacts as Array<Record<string, unknown>>;
    artifacts[0] = { ...artifacts[0], artifactId: "duplicate-id", artifactType: "FIVE_MINUTE_ONBOARDING" };
  });
  assert.match(errors(duplicate), /TEACHER_GUIDE|FIVE_MINUTE_ONBOARDING/);
  const missing = mutate((draft) => { (draft.artifacts as unknown[]).pop(); });
  assert.match(errors(missing), /54|two locale variants|missing NN/);
});

test("missing NB, missing NN and locale parity mismatch fail closed", () => {
  const missingNb = mutate((draft) => {
    draft.artifacts = (draft.artifacts as Array<Record<string, unknown>>).filter((artifact) => !(artifact.artifactType === "TEACHER_GUIDE" && artifact.locale === "nb"));
  });
  assert.match(errors(missingNb), /missing NB/);
  const missingNn = mutate((draft) => {
    draft.artifacts = (draft.artifacts as Array<Record<string, unknown>>).filter((artifact) => !(artifact.artifactType === "TEACHER_GUIDE" && artifact.locale === "nn"));
  });
  assert.match(errors(missingNn), /missing NN/);
  const mismatch = mutate((draft) => {
    const artifact = (draft.artifacts as Array<Record<string, unknown>>).find((item) => item.artifactType === "TEACHER_GUIDE" && item.locale === "nn");
    if (artifact !== undefined) artifact.authorizationStatus = "NOT_AUTHORIZED_FOR_STUDENT_USE";
  });
  assert.match(errors(mismatch), /authorization differs/);
});

test("student-approved draft and fabricated receipt fail closed", () => {
  const studentApproved = mutate((draft) => {
    const artifact = (draft.artifacts as Array<Record<string, unknown>>).find((item) => item.artifactType === "STUDENT_INFORMATION_DRAFT");
    if (artifact !== undefined) artifact.status = "DRAFT_FOR_ADULT_REVIEW";
  });
  assert.match(errors(studentApproved), /invalid participant status/);
  const receipt = mutate((draft) => {
    const artifact = (draft.artifacts as Array<Record<string, unknown>>)[0];
    const history = artifact?.amendmentHistory as Array<Record<string, unknown>>;
    const first = history[0];
    if (first !== undefined) first.externalReceipt = true;
  });
  assert.match(errors(receipt), /fabricates a receipt/);
});

test("student beta, recruitment, provider and production authorization fail closed", () => {
  for (const field of ["studentBetaAuthorized", "recruitmentAuthorized", "providerActivation", "productionAuthorized"] as const) {
    const invalid = mutate((draft) => { (draft.authorization as Record<string, unknown>)[field] = true; });
    assert.ok(errors(invalid).length > 0, field);
  }
});

test("student, engagement-like and readiness-like metrics cannot enter the allowed dictionary", () => {
  for (const metricId of ["student_accuracy", "engagement_index", "pilot_readiness_score"]) {
    const invalid = mutate((draft) => {
      const metrics = draft.metrics as Array<Record<string, unknown>>;
      metrics[0] = { ...metrics[0], metricId };
    });
    assert.match(errors(invalid), /measurement dictionary|hidden student or score metric/);
  }
});

test("identifierguard rejects likely identifiers before storage", () => {
  assert.deepEqual(guardAdultOnlyFindingText("Kort og teknisk observasjon").errors, []);
  assert.equal(guardAdultOnlyFindingText("kontakt test@example.no").accepted, false);
  assert.ok(guardAdultOnlyFindingText("ring 998 88 776").errors.includes("POSSIBLE_PHONE"));
  assert.ok(guardAdultOnlyFindingText("kode 123456789").errors.includes("LONG_DIGIT_SEQUENCE"));
  assert.ok(guardAdultOnlyFindingText("se https://example.invalid").errors.includes("POSSIBLE_URL"));
  assert.ok(guardAdultOnlyFindingText("Eksempel skole").warnings.includes("POSSIBLE_SCHOOL_IDENTIFIER"));
  assert.equal(guardAdultOnlyFindingText("Ola Nordmann observerte").accepted, false);
});
