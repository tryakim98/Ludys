import assert from "node:assert/strict";
import test from "node:test";
import { ExerciseReviewNotesController, NOTE_FILE_LIMIT, type ReviewNoteDraft } from "../../src/application/skynja/exercise-review-notes.js";
import { exerciseCatalog } from "../../src/content/skynja/exercise-catalog.js";
import { renderExerciseReview } from "../../src/ui/browser/exercise-review-templates.js";

const draft: ReviewNoteDraft = { locale: "nn-NO", roundId: "evidence-price", category: "TASK", severity: "NEEDS_CHANGE", observation: "Syntetisk reviewfunn: undersøk om spørsmålet er tydeleg.", suggestion: "Gå gjennom alternative tolkingar." };
const create = () => new ExerciseReviewNotesController(exerciseCatalog);
const add = (notes: ExerciseReviewNotesController, id = "synthetic-note-a") => notes.add(id, "skynja-find-evidence", draft);

test("editorial notes bind an explicit exercise, locale, round and content without changing content approval", () => {
  const notes = create();
  assert.equal(add(notes), true);
  const file = JSON.parse(notes.exportJson());
  assert.equal(file.classification, "EDITORIAL_NOTES_NOT_APPROVAL");
  assert.equal(file.notes.length, 1);
  const entry = notes.packet.exercises.find((item) => item.exerciseId === "skynja-find-evidence")!;
  assert.equal(file.notes[0].contentSha256, entry.contentSha256);
  assert.equal(file.notes[0].localeSha256, entry.localeSha256["nn-NO"]);
  assert.equal(file.notes[0].roundId, "evidence-price");
  assert.equal(entry.content.humanReviewed, false);
  assert.equal(notes.packet.pilotAuthorization, "NOT_GRANTED");
  assert.equal(notes.add("invalid-round", entry.exerciseId, { ...draft, roundId: "absent-round" }), false);
  assert.equal(notes.add("blank", entry.exerciseId, { ...draft, observation: "  " }), false);
  assert.equal(notes.add("intro", entry.exerciseId, { ...draft, roundId: "" }), true);
});

test("import merges identical notes once, rejects conflicts atomically and keeps existing work", () => {
  const first = create(); add(first);
  const next = create(); add(next, "synthetic-note-b");
  const json = first.exportJson();
  assert.equal(next.importJson(json, next.importGeneration), "IMPORTED");
  assert.equal(next.count, 2);
  assert.equal(next.importJson(json, next.importGeneration), "IMPORTED");
  assert.equal(next.count, 2);
  const conflict = JSON.parse(json);
  conflict.notes[0].observation = "Conflicting text";
  const before = next.exportJson();
  assert.equal(next.importJson(JSON.stringify(conflict), next.importGeneration), "CONFLICT");
  assert.equal(next.exportJson(), before);
  const invalid = JSON.parse(json);
  invalid.notes.push({ ...invalid.notes[0], id: "new-valid-note" }, { ...invalid.notes[0], id: "bad-note", roundId: "unknown" });
  assert.equal(next.importJson(JSON.stringify(invalid), next.importGeneration), "INVALID_FILE");
  assert.equal(next.exportJson(), before);
});

test("changed text without a revision bump makes imported notes stale; relabeling the bundle does not bypass note binding", () => {
  const original = create(); add(original);
  const changed = structuredClone(exerciseCatalog);
  (changed.find((item) => item.id === "skynja-find-evidence")!.locales["nn-NO"] as { summary: string }).summary += " Endra.";
  const revised = new ExerciseReviewNotesController(changed);
  const file = JSON.parse(original.exportJson());
  assert.equal(revised.importJson(JSON.stringify(file), revised.importGeneration), "VERSION_MISMATCH");
  file.contentSetSha256 = revised.packet.contentSetSha256;
  assert.equal(revised.importJson(JSON.stringify(file), revised.importGeneration), "INVALID_FILE");
  assert.equal(revised.count, 0);
});

test("withdrawal removes notes, blocks restoration and cannot be relaxed", () => {
  const notes = create(); add(notes);
  const json = notes.exportJson();
  notes.restrict(["skynja-find-evidence"]);
  assert.equal(notes.count, 0);
  assert.equal(add(notes), false);
  assert.equal(notes.importJson(json, notes.importGeneration), "VERSION_MISMATCH");
  notes.restrict([]);
  assert.equal(add(notes), false);
  const forged = JSON.parse(json); forged.contentSetSha256 = notes.packet.contentSetSha256;
  assert.equal(notes.importJson(JSON.stringify(forged), notes.importGeneration), "INVALID_FILE");
});

test("deletion, cancellation and withdrawal dominate delayed file reads", () => {
  for (const interrupt of [(notes: ExerciseReviewNotesController) => notes.clear(), (notes: ExerciseReviewNotesController) => notes.remove("synthetic-note-a"), (notes: ExerciseReviewNotesController) => notes.restrict(["skynja-find-evidence"]), (notes: ExerciseReviewNotesController) => notes.cancelPendingImports()]) {
    const notes = create(); add(notes);
    const json = notes.exportJson(); const token = notes.importGeneration;
    interrupt(notes);
    const before = notes.exportJson();
    assert.equal(notes.importJson(json, token), "CANCELLED");
    assert.equal(notes.exportJson(), before);
  }
});

test("malformed, oversized and approval-shaped files are rejected without consuming valid notes", () => {
  const notes = create(); add(notes); const before = notes.exportJson();
  const invalid = ["not JSON", "null", "[]", " ".repeat(NOTE_FILE_LIMIT + 1)];
  const file = JSON.parse(before);
  invalid.push(JSON.stringify({ ...file, humanReviewed: true }));
  invalid.push(JSON.stringify({ ...file, classification: "APPROVED" }));
  invalid.push(JSON.stringify({ ...file, notes: [file.notes[0], file.notes[0]] }));
  for (const json of invalid) {
    assert.equal(notes.importJson(json, notes.importGeneration), "INVALID_FILE");
    assert.equal(notes.exportJson(), before);
  }
});

test("untrusted imported note text remains inert in both review interfaces and returned notes cannot mutate internal state", () => {
  const notes = create();
  notes.add("escaped", "skynja-find-evidence", { ...draft, observation: '<img src=x onerror="alert(1)">', suggestion: "<script>bad()</script>" });
  for (const locale of ["nb-NO", "nn-NO"] as const) {
    const html = renderExerciseReview(notes.packet, locale, "skynja-find-evidence", notes.notes);
    assert.doesNotMatch(html, /<img|<script>/u);
    assert.match(html, /&lt;img/);
  }
  (notes.notes[0] as unknown as { observation: string }).observation = "modified";
  assert.notEqual(notes.notes[0]!.observation, "modified");
});

test("accepted notes always fit a reopenable export, including escaped text and merged files", () => {
  const notes = create();
  const large = { ...draft, observation: "x" + "\u0000".repeat(1999), suggestion: "\u0000".repeat(2000) };
  let accepted = 0;
  while (notes.add(`large-${accepted}`, "skynja-find-evidence", large)) accepted += 1;
  assert.ok(accepted > 0 && accepted < 200);
  assert.ok(new TextEncoder().encode(notes.exportJson()).length <= NOTE_FILE_LIMIT);
  const reopened = create();
  assert.equal(reopened.importJson(notes.exportJson(), reopened.importGeneration), "IMPORTED");
  assert.equal(reopened.count, accepted);
  const extra = create();
  assert.equal(extra.add("extra", "skynja-find-evidence", large), true);
  const before = reopened.exportJson();
  assert.equal(reopened.importJson(extra.exportJson(), reopened.importGeneration), "INVALID_FILE");
  assert.equal(reopened.exportJson(), before);
});
