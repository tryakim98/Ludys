import assert from "node:assert/strict";
import test from "node:test";
import { provideKnowledgeAssistance } from "../../src/application/skynja/knowledge-assistance.js";
import { resolveKnowledgeUse, type KnowledgeLibrarySnapshot, type KnowledgeUseRequest, type LibrarySource } from "../../src/core/skynja/knowledge-policy.js";
import type { KnowledgeSelectorPort } from "../../src/ports/skynja/knowledge-assistance.js";

const now = "2026-09-23T12:00:00.000Z";
const reference = (id: string) => ({ id: `synthetic-${id}`, revision: 1 });

/** Fake approvals and meaningless text, only for contract tests; never shipped as a library. */
function library(): KnowledgeLibrarySnapshot {
  return {
    reference: reference("library"), current: true, revokedClaimIds: [],
    sources: [{ reference: reference("source"), kind: "APPROVED_LIBRARY_SOURCE", state: "CURRENT", origin: "synthetic-fixture", verifiedAt: now }],
    evidence: [
      { reference: reference("evidence"), sourceReferences: [reference("source")], strength: "LIMITED", limitations: ["Synthetic test, no real-world validity."] },
      { reference: reference("counterevidence"), sourceReferences: [reference("source")], strength: "CONFLICTING", limitations: ["Keep counterevidence visible."] },
    ],
    claims: [{ reference: reference("claim"), state: "REVIEWED", layer: "DOMAIN_KNOWLEDGE", classification: "HYPOTHESIS",
      purposes: ["synthetic-contract"], contexts: ["synthetic-lab"], reverifyAfter: "2026-09-24T00:00:00.000Z",
      evidence: [{ reference: reference("evidence"), relation: "SUPPORTS" }, { reference: reference("counterevidence"), relation: "CONTRADICTS" }],
      realizations: [
        { outputLanguage: "no", writtenStandard: "nb", text: "Syntetisk bokmålseksempel.", reviewReference: reference("nb-review") },
        { outputLanguage: "no", writtenStandard: "nn", text: "Syntetisk nynorskdøme.", reviewReference: reference("nn-review") },
      ] }],
    rules: [{ reference: reference("rule"), state: "APPROVED", approvalReference: reference("use-decision"),
      claimReferences: [reference("claim")], purposes: ["synthetic-contract"], contexts: ["synthetic-lab"] }],
  };
}

function request(): KnowledgeUseRequest {
  return { ruleReference: reference("rule"), claimReferences: [reference("claim")], purpose: "synthetic-contract", context: "synthetic-lab",
    claimLayer: "DOMAIN_KNOWLEDGE", language: { uiLocale: "nb-NO", outputLanguage: "no", writtenStandard: "nn", spokenVariety: "user-selected-variety" } };
}

function decision(snapshot = library(), use = request()) { return resolveKnowledgeUse(snapshot, use, now); }
const selector: KnowledgeSelectorPort = { select: async () => ({ claimIds: [reference("claim").id] }) };

test("limited evidence may be authorized within scope without becoming product validation; counterevidence stays visible", () => {
  const result = decision();
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  const excerpt = result.context.excerpts[0]!;
  assert.equal(excerpt.classification, "HYPOTHESIS");
  assert.equal(excerpt.trace.evidence[0]?.record.strength, "LIMITED");
  assert.equal(excerpt.trace.evidence[1]?.relation, "CONTRADICTS");
  assert.deepEqual(excerpt.trace.evidence[1]?.record.limitations, ["Keep counterevidence visible."]);
  assert.deepEqual(decision(library(), { ...request(), claimLayer: "PRODUCT_OUTCOME" }), { status: "ABSTAIN", reason: "SCOPE_MISMATCH" });
  assert.deepEqual(decision(library(), { ...request(), context: "school" }), { status: "ABSTAIN", reason: "SCOPE_MISMATCH" });
});

test("strong evidence, a reviewed text, or a fabricated flag cannot replace a scoped runtime use decision", () => {
  const source = library();
  const strong = { ...source, evidence: source.evidence.map((item) => ({ ...item, strength: "DIRECT" as const })) };
  for (const rule of [
    { ...source.rules[0]!, state: "DRAFT" as const },
    { ...source.rules[0]!, approvalReference: null },
    { ...source.rules[0]!, claimReferences: [] },
  ]) assert.deepEqual(decision({ ...strong, rules: [rule] }), { status: "ABSTAIN", reason: "RULE_NOT_AUTHORIZED" });
});

test("missing, withdrawn, ambiguous and mismatched revisions fail closed throughout the evidence chain", () => {
  const source = library();
  for (const change of [
    { sources: [] },
    { sources: [...source.sources, ...source.sources] },
    { sources: [{ ...source.sources[0]!, state: "WITHDRAWN" as const }] },
    { evidence: source.evidence.map((item) => ({ ...item, reference: { ...item.reference, revision: 2 } })) },
    { evidence: [{ ...source.evidence[0]!, sourceReferences: [] }, source.evidence[1]!] },
  ]) assert.deepEqual(decision({ ...source, ...change }), { status: "ABSTAIN", reason: "EVIDENCE_CHAIN_INCOMPLETE" });
});

test("model memory, open-web fallback, user data and situational data cannot masquerade as domain library sources", () => {
  const source = library();
  for (const kind of ["MODEL_MEMORY", "OPEN_WEB", "USER_DATA", "SITUATIONAL_CONTEXT"]) {
    const forged = { ...source.sources[0]!, kind } as LibrarySource;
    assert.deepEqual(decision({ ...source, sources: [forged] }), { status: "ABSTAIN", reason: "EVIDENCE_CHAIN_INCOMPLETE" });
  }
});

test("claim withdrawal, revocation, stale verification and malformed time prevent knowledge use", () => {
  const source = library();
  for (const change of [
    { revokedClaimIds: [reference("claim").id] },
    { claims: [{ ...source.claims[0]!, state: "WITHDRAWN" as const }] },
    { claims: [...source.claims, ...source.claims] },
  ]) assert.deepEqual(decision({ ...source, ...change }), { status: "ABSTAIN", reason: "CLAIM_UNAVAILABLE" });
  for (const reverifyAfter of [now, "not-a-date"]) {
    assert.deepEqual(decision({ ...source, claims: [{ ...source.claims[0]!, reverifyAfter }] }), { status: "ABSTAIN", reason: "REVERIFICATION_REQUIRED" });
  }
  assert.deepEqual(resolveKnowledgeUse(source, request(), "invalid"), { status: "ABSTAIN", reason: "INVALID_REQUEST" });
});

test("UI language and dialect do not choose the written variant; missing NN review never falls back to BM", () => {
  const source = library();
  const result = decision(source);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.context.language.uiLocale, "nb-NO");
  assert.equal(result.context.language.spokenVariety, "user-selected-variety");
  assert.equal(result.context.excerpts[0]?.text, "Syntetisk nynorskdøme.");
  const onlyBm = { ...source, claims: [{ ...source.claims[0]!, realizations: [source.claims[0]!.realizations[0]!] }] };
  assert.deepEqual(decision(onlyBm), { status: "ABSTAIN", reason: "LANGUAGE_REVIEW_REQUIRED" });
  const noReview = { ...source, claims: [{ ...source.claims[0]!, realizations: source.claims[0]!.realizations.map((item) => ({ ...item, reviewReference: null })) }] };
  assert.deepEqual(decision(noReview), { status: "ABSTAIN", reason: "LANGUAGE_REVIEW_REQUIRED" });
});

test("selector gets a copy; the only delivered prose comes from the controlled library", async () => {
  const source = library();
  const result = await provideKnowledgeAssistance(request(), { library: { snapshot: () => source }, now: () => now,
    selector: { select: async (context) => { Object.assign(context.excerpts[0]!, { text: "Invented assertion" }); return { claimIds: [reference("claim").id] }; } } }, new AbortController().signal);
  assert.equal(result.status, "ANSWER");
  if (result.status === "ANSWER") {
    assert.equal(result.context.excerpts[0]?.text, "Syntetisk nynorskdøme.");
    Object.assign(result.context.excerpts[0]!.trace.evidence[0]!.record, { strength: "DIRECT" });
    assert.equal(source.evidence[0]?.strength, "LIMITED");
  }
  assert.equal(source.claims[0]?.realizations[1]?.text, "Syntetisk nynorskdøme.");
});

test("invented citations, prose, duplicate selections and extra model fields are rejected", async () => {
  for (const output of [null, "Free prose", { claimIds: ["unknown"] }, { claimIds: [] }, { claimIds: [reference("claim").id], text: "Unapproved" },
    { claimIds: [reference("claim").id, reference("claim").id] }]) {
    const result = await provideKnowledgeAssistance(request(), { library: { snapshot: library }, now: () => now, selector: { select: async () => output } }, new AbortController().signal);
    assert.deepEqual(result, { status: "ABSTAIN", reason: "INVALID_SELECTION" });
  }
});

test("a knowledge gap abstains before selection; no fallback provider or web search is called", async () => {
  let calls = 0;
  const result = await provideKnowledgeAssistance(request(), { library: { snapshot: () => ({ ...library(), claims: [] }) }, now: () => now,
    selector: { select: async () => { calls += 1; return {}; } } }, new AbortController().signal);
  assert.deepEqual(result, { status: "ABSTAIN", reason: "CLAIM_UNAVAILABLE" });
  assert.equal(calls, 0);
});

test("stop before or during selection prevents a late answer even when the selector ignores cancellation", async () => {
  for (const preStopped of [true, false]) {
    const abort = new AbortController();
    let calls = 0;
    if (preStopped) abort.abort();
    const result = await provideKnowledgeAssistance(request(), { library: { snapshot: library }, now: () => now,
      selector: { select: async () => { calls += 1; abort.abort(); return { claimIds: [reference("claim").id] }; } } }, abort.signal);
    assert.deepEqual(result, { status: "STOPPED" });
    assert.equal(calls, preStopped ? 0 : 1);
  }
});

test("revocation or changed library content while selection runs prevents stale or resurrected output", async () => {
  for (const revoke of [true, false]) {
    const source = library();
    const result = await provideKnowledgeAssistance(request(), { library: { snapshot: () => source }, now: () => now,
      selector: { select: async () => {
        if (revoke) Object.assign(source, { revokedClaimIds: [reference("claim").id] });
        else Object.assign(source.claims[0]!.realizations[1]!, { text: "Changed in place without a revision bump" });
        return { claimIds: [reference("claim").id] };
      } } }, new AbortController().signal);
    assert.deepEqual(result, { status: "ABSTAIN", reason: revoke ? "CLAIM_UNAVAILABLE" : "KNOWLEDGE_CHANGED" });
  }
});

test("stop immediately releases the caller even when selection never settles", { timeout: 1000 }, async () => {
  const abort = new AbortController();
  let entered = () => {};
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const result = provideKnowledgeAssistance(request(), { library: { snapshot: library }, now: () => now,
    selector: { select: () => { entered(); return new Promise<unknown>(() => {}); } } }, abort.signal);
  await started;
  abort.abort();
  assert.deepEqual(await result, { status: "STOPPED" });
});

test("library or selector failure returns abstention without leaking errors or activating another source", async () => {
  const result = await provideKnowledgeAssistance(request(), { library: { snapshot: library }, now: () => now,
    selector: { select: async () => { throw new Error("Internal provider detail"); } } }, new AbortController().signal);
  assert.deepEqual(result, { status: "ABSTAIN", reason: "KNOWLEDGE_SERVICE_UNAVAILABLE" });
  const stopped = new AbortController();
  stopped.abort();
  assert.deepEqual(await provideKnowledgeAssistance(request(), { library: { snapshot: library }, selector, now: () => now }, stopped.signal), { status: "STOPPED" });
});
