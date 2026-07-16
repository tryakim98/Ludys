import assert from "node:assert/strict";
import test from "node:test";
import { createKnowledgeLibraryController } from "../../src/composition/create-knowledge-library.js";

test("knowledge library defaults to twelve bilingual prototype units", () => {
  const controller = createKnowledgeLibraryController("nb-NO");
  assert.equal(controller.snapshot.results.length, 12);
  assert.equal(controller.snapshot.counts.contextCards, 8);
  assert.equal(controller.snapshot.counts.audioSpecifications, 12);
  assert.equal(controller.snapshot.counts.internalAudioPreviews, 2);
});

test("knowledge library filtering does not create a profile", () => {
  const controller = createKnowledgeLibraryController("nb-NO");
  controller.setFilters({ ageBand: "6-9", maxDurationMinutes: 2 });
  assert.equal(controller.snapshot.results.length, 4);
  assert.doesNotMatch(JSON.stringify(controller.snapshot), /childId|studentId|profile|engagementScore/i);
});

test("locale switch preserves semantic inventory and resets selection", () => {
  const controller = createKnowledgeLibraryController("nb-NO");
  controller.select("knowledge-work-message-001");
  assert.equal(controller.snapshot.selected?.knowledgeId, "knowledge-work-message-001");
  controller.setLocale("nn-NO");
  assert.equal(controller.snapshot.results.length, 12);
  assert.equal(controller.snapshot.selected?.knowledgeId, "knowledge-word-support-001");
  assert.equal(controller.snapshot.selected?.text.locale, "nn-NO");
});
