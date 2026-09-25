import assert from "node:assert/strict";
import test from "node:test";
import { createExerciseRoom } from "../../src/composition/create-exercise-room.js";
import { renderExerciseRoom } from "../../src/ui/browser/exercise-room-templates.js";
import { partitionExercisePolicy } from "../../src/core/skynja/exercise-room-policy.js";
import type { CorpusLifecyclePolicy } from "../../src/core/draft-learning-corpus.js";

test("a matching answer needs its own evidence, and changing either choice invalidates feedback", () => {
  const room = createExerciseRoom(); room.select("skynja-find-evidence"); room.start();
  const feedback = () => room.view.feedback;
  room.option("evidence-meeting-option-1"); room.check(); room.next();
  assert.equal(room.view.canCheck, false);
  assert.equal(feedback(), undefined);
  assert.equal(room.view.roundIndex, 0);
  room.evidence("unknown-source");
  assert.equal(room.view.selectedEvidence, undefined);
  room.evidence("meeting-end"); room.check();
  assert.equal(feedback()?.verdict, "TRY_AGAIN");
  assert.equal(room.view.canContinue, false);
  room.evidence("meeting-place");
  assert.equal(feedback(), undefined);
  room.check();
  assert.equal(feedback()?.verdict, "MATCHED");
  room.option("evidence-meeting-option-0");
  assert.equal(feedback(), undefined);
  room.check();
  assert.equal(feedback()?.verdict, "TRY_AGAIN");
  room.option("evidence-meeting-option-1"); room.check(); room.next();
  assert.equal(room.view.selectedOption, undefined);
  assert.equal(room.view.selectedEvidence, undefined);
  assert.equal(room.view.records[0]?.verdict, "MATCHED");
  room.evidence("condition-rain"); room.check();
  assert.equal(room.view.canCheck, false);
  assert.equal(feedback(), undefined);
});

test("missing information is an explicit evidence choice in both languages", () => {
  for (const locale of ["nb-NO", "nn-NO"] as const) {
    const room = createExerciseRoom(); room.setLocale(locale); room.select("skynja-find-evidence"); room.start();
    room.next(true); room.next(true); room.next(true);
    assert.equal(room.view.round?.id, "evidence-price");
    room.option("evidence-price-option-1"); room.evidence("price-day"); room.check();
    assert.equal(room.view.feedback?.verdict, "TRY_AGAIN");
    room.evidence("NOT_STATED"); room.check();
    assert.equal(room.view.feedback?.verdict, "NEEDS_CONTEXT");
    assert.equal(room.view.canContinue, true);
    assert.match(renderExerciseRoom(room.view), /data-evidence-id="NOT_STATED" aria-pressed="true"/);
  }
});

test("evidence pauses unchanged and cannot return after STOP or withdrawal", () => {
  const room = createExerciseRoom(); room.select("skynja-find-evidence"); room.start();
  room.evidence("meeting-place"); room.option("evidence-meeting-option-1"); room.pause();
  const paused = room.view;
  room.evidence("NOT_STATED"); room.option("evidence-meeting-option-0"); room.check(); room.next(true);
  assert.deepEqual(room.view, paused);
  room.resume(); room.check();
  assert.equal(room.view.feedback?.verdict, "MATCHED");
  room.stop();
  assert.equal(room.view.selectedEvidence, undefined);
  const stopped = room.view;
  room.evidence("meeting-place"); room.option("evidence-meeting-option-1"); room.check(); room.resume();
  assert.deepEqual(room.view, stopped);
  room.backToCatalog(); room.select("skynja-find-evidence"); room.start(); room.evidence("meeting-place");
  room.restrict(["skynja-find-evidence"]);
  assert.equal(room.view.stage, "STOPPED");
  assert.equal(room.view.selectedEvidence, undefined);
  room.backToCatalog(); room.select("skynja-find-evidence");
  assert.equal(room.view.stage, "CATALOG");
});

test("a learner can retry a choice, use support, skip and complete without an ability score", () => {
  const room = createExerciseRoom(); room.select("skynja-cloze-context"); room.start();
  room.next(); assert.equal(room.view.roundIndex, 0);
  room.option("wet-coat-option-0"); room.check();
  assert.equal(room.view.feedback?.verdict, "TRY_AGAIN");
  assert.equal(room.view.canContinue, false);
  room.hint(); room.option("wet-coat-option-1");
  assert.equal(room.view.feedback, undefined);
  room.check(); room.next();
  assert.deepEqual(room.view.records[0], { roundId: "wet-coat", outcome: "ANSWERED", hintUsed: true, modelUsed: false, verdict: "MATCHED" });
  room.model(); room.next();
  assert.equal(room.view.records[1]?.outcome, "MODEL_VIEWED");
  room.hint(); room.next(true); room.next(true);
  assert.equal(room.view.stage, "COMPLETED");
  assert.equal(room.view.records[2]?.outcome, "SKIPPED");
  assert.equal(room.view.records[2]?.hintUsed, true);
  assert.equal(room.view.records[2]?.verdict, undefined);
  assert.equal(room.view.records.length, 4);
  const rendered = renderExerciseRoom(room.view);
  assert.match(rendered, /ikke en vurdering av leseferdighet/);
  assert.doesNotMatch(rendered, /prosent|poeng|score/i);
});

test("pause freezes the task, choices and language until an explicit resume", () => {
  const room = createExerciseRoom(); room.select("skynja-maane-saape"); room.start();
  const round = room.view.round!;
  if (round.type !== "ARRANGE") throw new Error("expected arrangement");
  const tile = round.tiles[0]!.id;
  room.tile(tile); room.hint(); room.pause();
  assert.equal(room.view.sessionOpen, true);
  const paused = room.view;
  room.setLocale("nn-NO"); room.tile(tile); room.clearTiles(); room.model(); room.check(); room.next(true);
  room.select("skynja-reading-garden"); room.start(); room.backToCatalog();
  assert.deepEqual(room.view, paused);
  assert.doesNotMatch(renderExerciseRoom(room.view), /Tekst til oppgaven/);
  room.resume();
  assert.equal(room.view.stage, "ACTIVE");
  assert.deepEqual(room.view.selectedTiles, [tile]);
  assert.equal(room.view.hintVisible, true);
});

test("STOP clears the attempt and late answers, resume and next cannot resurrect it", () => {
  const room = createExerciseRoom(); room.select("skynja-cloze-context"); room.start();
  room.option("wet-coat-option-1"); room.check(); room.next(); room.hint(); room.model(); room.stop();
  assert.equal(room.view.stage, "STOPPED");
  assert.equal(room.view.records.length, 0);
  assert.equal(room.view.selectedOption, undefined);
  assert.equal(room.view.feedback, undefined);
  assert.equal(room.view.modelVisible, false);
  assert.equal(room.view.sessionOpen, false);
  const stopped = room.view;
  room.option("wet-coat-option-1"); room.check(); room.resume(); room.start(); room.next(true);
  assert.deepEqual(room.view, stopped);
  room.backToCatalog(); room.setLocale("nn-NO"); room.select("skynja-cloze-context"); room.start();
  assert.equal(room.view.locale, "nn-NO");
  assert.equal(room.view.stage, "ACTIVE");
  assert.equal(room.view.records.length, 0);
});

test("restrictions follow a proposal into this room, stop active work and cannot be undone by an empty policy", () => {
  const room = createExerciseRoom(); room.select("skynja-maane-saape"); room.start(); room.hint();
  room.restrict(["activity-nor-two-syllable-maane-saape-001"]);
  assert.equal(room.view.stage, "STOPPED");
  room.restrict([]); room.backToCatalog(); room.select("skynja-maane-saape"); room.start();
  assert.equal(room.view.stage, "CATALOG");
  assert.deepEqual(room.view.blockedIds, ["skynja-maane-saape"]);
  room.select("skynja-reading-garden"); room.start(); room.pause();
  room.restrict(["skynja-reading-garden"]); room.resume();
  assert.equal(room.view.stage, "STOPPED");
});

test("a reasonable choice and an explicit lack of information both permit reflection and progress", () => {
  const room = createExerciseRoom(); room.select("skynja-judgment-support"); room.start();
  room.option("support-story-option-2"); room.check();
  assert.equal(room.view.feedback?.verdict, "REASONABLE");
  assert.equal(room.view.canContinue, true);
  room.next(); room.next(true);
  room.option("support-silence-option-2"); room.check();
  assert.equal(room.view.feedback?.verdict, "NEEDS_CONTEXT");
  assert.equal(room.view.canContinue, true);
  assert.match(renderExerciseRoom(room.view), /Mer informasjon trengs/);
});

test("catalog filters, keyboard controls, draft status and explicit nynorsk copy are rendered", () => {
  const room = createExerciseRoom(); room.setLocale("nn-NO"); room.setFilter("READING");
  const catalog = renderExerciseRoom(room.view);
  assert.equal((catalog.match(/data-exercise-card=/g) ?? []).length, 2);
  assert.match(catalog, /Kva vil du øve på/);
  assert.match(catalog, /Prøveversjon/);
  assert.match(catalog, /Ventar på fagleg og språkleg gjennomgang/);
  assert.doesNotMatch(catalog, /data-exercise-card="skynja-maane-saape"/);
  room.select("skynja-compound-outside"); room.start();
  const round = renderExerciseRoom(room.view);
  assert.match(round, /button type="button" data-exercise-action="tile"/);
  assert.match(round, /Stopp og gå tilbake/);
  assert.match(round, /disabled aria-describedby=exercise-language-help/);
  assert.match(round, /aria-live="polite"/);
});

test("a shared policy routes new IDs without admitting unknown IDs or weakening legacy scope validation", () => {
  const room = createExerciseRoom();
  const policy: CorpusLifecyclePolicy = { policyRevision: 2, containsPersonData: false, resurrectionAllowed: false, restrictions: [
    { scope: "ACTIVITY", scopeId: "skynja-reading-garden", lifecycleStatus: "WITHDRAWN" },
    { scope: "ACTIVITY", scopeId: "activity-nor-two-syllable-maane-saape-001", lifecycleStatus: "STALE" },
    { scope: "ACTIVITY", scopeId: "unknown-activity", lifecycleStatus: "WITHDRAWN" },
    { scope: "PATTERN_CLASS", scopeId: "legacy-class", lifecycleStatus: "SUPERSEDED" },
  ] };
  const partition = partitionExercisePolicy(policy, room.view.catalog);
  assert.deepEqual(partition.blockedIds, ["skynja-reading-garden", "activity-nor-two-syllable-maane-saape-001"]);
  assert.deepEqual(partition.legacyPolicy.restrictions.map((r) => r.scopeId), ["unknown-activity", "legacy-class"]);
  assert.equal(partition.legacyPolicy.policyRevision, 2);
  for (const lifecycleStatus of ["CURRENT", "anything"]) {
    const invalid = { ...policy, restrictions: [{ scope: "ACTIVITY", scopeId: "skynja-reading-garden", lifecycleStatus }] } as CorpusLifecyclePolicy;
    assert.throws(() => partitionExercisePolicy(invalid, room.view.catalog), /Invalid restrictive/);
  }
  assert.throws(() => partitionExercisePolicy({ ...policy, resurrectionAllowed: true } as unknown as CorpusLifecyclePolicy, room.view.catalog), /Invalid restrictive/);
});
