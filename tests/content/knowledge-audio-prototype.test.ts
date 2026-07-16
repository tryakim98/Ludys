import assert from "node:assert/strict";
import test from "node:test";
import {
  filterKnowledge,
  resolveAudioPreview,
  resolveContextCard,
  validateKnowledgeAudioRelease,
} from "../../src/core/knowledge-audio-prototype.js";
import { knowledgeAudioPrototypeRelease } from "../../src/content/prototype/knowledge-audio-release.js";
import { wordProofContentNb } from "../../src/content/fixtures/bm/word-proof-content.js";
import { wordProofContentNn } from "../../src/content/fixtures/nn/word-proof-content.js";

test("WP13.3 release is reference-closed and within prototype size", () => {
  assert.deepEqual(validateKnowledgeAudioRelease(knowledgeAudioPrototypeRelease), []);
  assert.equal(knowledgeAudioPrototypeRelease.knowledgeUnits.length, 12);
  assert.equal(knowledgeAudioPrototypeRelease.contextCards.length, 8);
  assert.equal(knowledgeAudioPrototypeRelease.audioSpecifications.length, 12);
});

test("knowledge filters cover role, age, topic, need and time", () => {
  const result = filterKnowledge(knowledgeAudioPrototypeRelease, {
    locale: "nb-NO",
    role: "TEACHER",
    ageBand: "13-16",
    topic: "WRITING",
    need: "PLANNING",
    maxDurationMinutes: 10,
  });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.knowledgeId, "knowledge-work-message-001");
  assert.match(result[0]?.text.title ?? "", /melding/i);
});

test("BM and NN variants share stable semantic IDs", () => {
  const nb = filterKnowledge(knowledgeAudioPrototypeRelease, { locale: "nb-NO" });
  const nn = filterKnowledge(knowledgeAudioPrototypeRelease, { locale: "nn-NO" });
  assert.deepEqual(nb.map((unit) => unit.knowledgeId), nn.map((unit) => unit.knowledgeId));
  assert.notEqual(nb[0]?.text.shortExplanation, nn[0]?.text.shortExplanation);
});

test("context card resolves to the same knowledge graph", () => {
  const resolved = resolveContextCard(knowledgeAudioPrototypeRelease, {
    contextCardId: "context-word-help-001",
    locale: "nb-NO",
  });
  assert.equal(resolved?.card.knowledgeId, "knowledge-word-support-001");
  assert.equal(resolved?.card.oneActionOnly, true);
  assert.ok(resolved?.card.expiresOn.includes("STOP"));
  assert.ok(resolved?.card.expiresOn.includes("RECONNECT"));
});

test("synthetic audio is explicitly internal review only", () => {
  const preview = resolveAudioPreview(knowledgeAudioPrototypeRelease, {
    audioSpecId: "audio-word-support-001",
    locale: "nb-NO",
  });
  assert.equal(preview?.canPreview, true);
  assert.equal(preview?.asset?.source, "CONTROLLED_SYNTHETIC_CANDIDATE");
  assert.equal(preview?.asset?.scope, "INTERNAL_REVIEW_ONLY");
  assert.match(preview?.userFacingLabel ?? "", /Syntetisk lydkladd/);
  assert.doesNotMatch(preview?.userFacingLabel ?? "", /menneskelig innlest lyd$/i);
});

test("spec-only audio uses reviewed text fallback", () => {
  const preview = resolveAudioPreview(knowledgeAudioPrototypeRelease, {
    audioSpecId: "audio-model-one-part-001",
    locale: "nn-NO",
  });
  assert.equal(preview?.canPreview, false);
  assert.equal(preview?.asset, undefined);
  assert.ok((preview?.plainTextFallback.length ?? 0) > 0);
});

test("vertical proof card points into the prototype graph", () => {
  for (const bundle of [wordProofContentNb, wordProofContentNn]) {
    assert.equal(bundle.adultCard.knowledgeId, "knowledge-word-support-001");
    assert.equal(bundle.adultCard.contextCardId, "context-word-help-001");
    assert.equal(bundle.knowledge.knowledgeId, bundle.adultCard.knowledgeId);
    assert.equal(bundle.contextCard.contextCardId, bundle.adultCard.contextCardId);
    assert.equal(bundle.audio.audioSpecId, bundle.knowledge.audioSpecId);
  }
});

test("withdrawn or stale audio cannot be previewed", () => {
  const release = structuredClone(knowledgeAudioPrototypeRelease);
  const spec = release.audioSpecifications[0];
  assert.ok(spec);
  Object.assign(spec, { staleStatus: "STALE" });
  const stale = resolveAudioPreview(release, {
    audioSpecId: spec.audioSpecId,
    locale: "nb-NO",
  });
  assert.equal(stale?.canPreview, false);
  Object.assign(spec, { publicationStatus: "WITHDRAWN", withdrawalReason: "test" });
  assert.equal(
    resolveAudioPreview(release, { audioSpecId: spec.audioSpecId, locale: "nb-NO" }),
    undefined,
  );
});
