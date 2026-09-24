import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { exerciseCatalog } from "../../src/content/skynja/exercise-catalog.js";
import { createExerciseReviewPacket, createExerciseReviewForm, exerciseReviewJson, exerciseReviewMarkdown } from "../../src/application/skynja/exercise-review.js";
import { renderExerciseReview } from "../../src/ui/browser/exercise-review-templates.js";

test("review snapshots cover both complete language realizations and bind exact content with interoperable SHA-256", () => {
  const packet = createExerciseReviewPacket(exerciseCatalog);
  assert.equal(packet.exerciseCount, 13);
  assert.equal(packet.semanticRoundCount, 56);
  assert.equal(packet.localizedRoundCount, 112);
  for (const entry of packet.exercises) {
    assert.deepEqual(entry.content, exerciseCatalog.find((exercise) => exercise.id === entry.exerciseId));
    assert.equal(entry.contentSha256, createHash("sha256").update(exerciseReviewJson(entry.content)).digest("hex"));
  }
  assert.equal(packet.contentSetSha256, createHash("sha256").update(exerciseReviewJson({ exercises: packet.exercises, excludedExerciseIds: [] })).digest("hex"));
  assert.equal(packet.status, "AWAITING_HUMAN_REVIEW");
  assert.deepEqual(packet.humanReviewReceipts, []);
  assert.equal(packet.pilotAuthorization, "NOT_GRANTED");
});

test("a language edit invalidates the bound review even without a revision bump and snapshots cannot mutate source", () => {
  const original = createExerciseReviewPacket(exerciseCatalog);
  const changed = structuredClone(exerciseCatalog);
  const first = changed[0]!;
  (first.locales["nn-NO"] as { summary: string }).summary += " Endra tekst.";
  const next = createExerciseReviewPacket(changed);
  assert.notEqual(next.contentSetSha256, original.contentSetSha256);
  assert.notEqual(next.exercises[0]!.contentSha256, original.exercises[0]!.contentSha256);
  assert.notEqual(next.exercises[0]!.localeSha256["nn-NO"], original.exercises[0]!.localeSha256["nn-NO"]);
  assert.equal(next.exercises[0]!.localeSha256["nb-NO"], original.exercises[0]!.localeSha256["nb-NO"]);
  (original.exercises[0]!.content.locales["nb-NO"] as { title: string }).title = "Changed exported snapshot";
  assert.notEqual(exerciseCatalog[0]!.locales["nb-NO"].title, "Changed exported snapshot");
});

test("restricted exercise and source IDs remove the text from screen, Markdown, JSON and review form", () => {
  const first = exerciseCatalog[0]!;
  const evidence = exerciseCatalog.find((exercise) => exercise.id === "skynja-find-evidence")!;
  const packet = createExerciseReviewPacket(exerciseCatalog, [first.sourceActivityId!, evidence.id]);
  assert.equal(packet.exerciseCount, 11);
  assert.ok(packet.excludedExerciseIds.includes(first.id));
  assert.ok(packet.excludedExerciseIds.includes(evidence.id));
  const all = exerciseReviewJson(packet) + exerciseReviewMarkdown(packet) + exerciseReviewJson(createExerciseReviewForm(packet)) + renderExerciseReview(packet, "nn-NO", evidence.id);
  assert.ok(!all.includes(evidence.locales["nn-NO"].rounds[0]!.stimulus));
  assert.equal(packet.exercises.some((entry) => entry.exerciseId === first.id), false);
  const none = createExerciseReviewPacket(exerciseCatalog, exerciseCatalog.map((exercise) => exercise.id));
  assert.equal(none.exerciseCount, 0);
  assert.match(renderExerciseReview(none, "nb-NO", ""), /Ingen øvelser er tilgjengelige/);
});

test("review forms start empty for every round and locale without inventing reviewers or approvals", () => {
  const packet = createExerciseReviewPacket(exerciseCatalog);
  const form = createExerciseReviewForm(packet);
  assert.equal(form.templateOnly, true);
  assert.equal(form.reviews.length, 26);
  for (const review of form.reviews) {
    const entry = packet.exercises.find((item) => item.exerciseId === review.exerciseId)!;
    assert.equal(review.contentSha256, entry.contentSha256);
    assert.deepEqual(review.roundIds, entry.content.locales[review.locale].rounds.map((round) => round.id));
    assert.equal(review.reviewerReference, "");
    assert.equal(review.evidenceReference, "");
    assert.equal(review.conclusion, "NOT_REVIEWED");
    assert.ok(Object.values(review.checks).every((value) => value === "NOT_REVIEWED"));
    assert.deepEqual(review.findings, []);
  }
});

test("exports include all evidence links, retry explanations and localized rounds; HTML in copy stays text", () => {
  const packet = createExerciseReviewPacket(exerciseCatalog);
  const markdown = exerciseReviewMarkdown(packet);
  assert.equal((markdown.match(/#### Runde /gu) ?? []).length, 112);
  assert.match(markdown, /NOT_STATED/);
  assert.match(markdown, /NEEDS_CONTEXT/);
  for (const locale of ["nb-NO", "nn-NO"] as const) {
    const html = renderExerciseReview(packet, locale, "skynja-find-evidence");
    assert.equal((html.match(/class="exercise-review-round"/gu) ?? []).length, 6);
    assert.match(html, /lang="nb"/);
    assert.match(html, /lang="nn"/);
    assert.match(html, /price-day/);
    assert.match(html, /NOT_STATED/);
  }
  const malicious = structuredClone(exerciseCatalog[0]!);
  (malicious.locales["nb-NO"] as { summary: string }).summary = '<script>alert("x")</script>';
  const hostile = createExerciseReviewPacket([malicious]);
  assert.doesNotMatch(renderExerciseReview(hostile, "nb-NO", ""), /<script>/);
  assert.doesNotMatch(exerciseReviewMarkdown(hostile), /<script>/);
});
