import assert from "node:assert/strict";
import test from "node:test";
import { exerciseCatalog } from "../../src/content/skynja/exercise-catalog.js";
import { EXERCISE_KINDS, NOT_STATED, assembleAnswer, evaluateArrangement, evaluateEvidence, validateExerciseCatalog, type ArrangeRound, type EvidenceRound, type ExerciseDefinition } from "../../src/core/skynja/exercise-room.js";

export function solution(round: ArrangeRound): string[] {
  const search = (tiles: ArrangeRound["tiles"], chosen: string[]): string[] | undefined => {
    if (!tiles.length) return round.acceptedAnswers.includes(assembleAnswer(round, chosen) ?? "") ? chosen : undefined;
    for (const tile of tiles) {
      const ids = [...chosen, tile.id];
      const prefix = assembleAnswer(round, ids) ?? "";
      if (!round.acceptedAnswers.some((answer) => answer.startsWith(prefix))) continue;
      const result = search(tiles.filter((t) => t.id !== tile.id), ids);
      if (result) return result;
    }
    return undefined;
  };
  const found = search(round.tiles, []);
  assert.ok(found, `${round.id} must be solvable using whole tiles`);
  return found;
}

test("the draft catalog contains 13 exercises, seven kinds and 56 complete rounds in each language", () => {
  assert.deepEqual(validateExerciseCatalog(exerciseCatalog), []);
  assert.equal(exerciseCatalog.length, 13);
  for (const kind of EXERCISE_KINDS) assert.equal(exerciseCatalog.filter((item) => item.kind === kind).length, kind === "EVIDENCE" ? 1 : 2);
  for (const locale of ["nb-NO", "nn-NO"] as const) {
    assert.equal(exerciseCatalog.reduce((n, e) => n + e.locales[locale].rounds.length, 0), 56);
    for (const exercise of exerciseCatalog) {
      assert.equal(exercise.humanReviewed, false);
      assert.equal(exercise.provenance, "AI_ASSISTED_CONTENT_DRAFT");
      for (const round of exercise.locales[locale].rounds) {
        assert.ok(round.hint.length > 15);
        assert.ok(round.explanation.length > 30);
        assert.ok(round.reflection.length > 20);
        if (round.type === "ARRANGE") assert.equal(evaluateArrangement(round, solution(round)).verdict, "MATCHED");
        else for (const option of round.options) assert.ok(option.feedback.length > 20);
      }
    }
  }
});

test("both earlier content proposals have five rounds and explicit source identities", () => {
  const words = exerciseCatalog.filter((e) => e.kind === "WORD");
  assert.deepEqual(words.map((e) => e.sourceActivityId), ["activity-nor-two-syllable-maane-saape-001", "activity-nor-two-syllable-kake-bake-002"]);
  assert.deepEqual(words.map((e) => e.locales["nb-NO"].rounds.length), [5, 5]);
});

test("text evidence preserves meaning across languages and rejects every unsupported answer/evidence pair", () => {
  const exercise = exerciseCatalog.find((item) => item.id === "skynja-find-evidence")!;
  const semantics = (locale: "nb-NO" | "nn-NO") => exercise.locales[locale].rounds.map((round) => {
    assert.equal(round.type, "EVIDENCE");
    const evidence = round as EvidenceRound;
    return { id: round.id, passages: evidence.passages.map((p) => p.id), options: evidence.options.map((o) => [o.id, o.verdict, o.evidenceIds]) };
  });
  assert.deepEqual(semantics("nb-NO"), semantics("nn-NO"));
  for (const locale of ["nb-NO", "nn-NO"] as const) {
    const verdicts = new Set<string>();
    for (const round of exercise.locales[locale].rounds as readonly EvidenceRound[]) {
      for (const option of round.options) {
        for (const source of [...round.passages.map((p) => p.id), NOT_STATED, "unknown-source"]) {
          const result = evaluateEvidence(round, option.id, source);
          assert.equal(result.verdict, option.evidenceIds.includes(source) ? option.verdict : "TRY_AGAIN");
          if (result.verdict !== "TRY_AGAIN") verdicts.add(result.verdict);
        }
      }
    }
    assert.deepEqual([...verdicts].sort(), ["MATCHED", "NEEDS_CONTEXT", "REASONABLE"]);
  }
});

test("unknown, missing or misleading evidence links fail draft validation", () => {
  const exercise = exerciseCatalog.find((item) => item.id === "skynja-find-evidence")!;
  const round = exercise.locales["nb-NO"].rounds[0] as EvidenceRound;
  for (const evidenceIds of [["unknown-source"], [], [NOT_STATED], ["meeting-place", "meeting-place"]]) {
    const invalidRound = { ...round, options: round.options.map((o) => o.verdict === "MATCHED" ? { ...o, evidenceIds } : o) };
    const invalid = { ...exercise, locales: { ...exercise.locales, "nb-NO": { ...exercise.locales["nb-NO"], rounds: [invalidRound, ...exercise.locales["nb-NO"].rounds.slice(1)] } } };
    assert.match(validateExerciseCatalog([invalid]).join(" "), /invalid answer\/evidence link/);
  }
});

test("nynorsk has its own word, sentence and reading realizations with common semantic round ids", () => {
  const compound = exerciseCatalog.find((e) => e.id === "skynja-compound-outside")!;
  const nb = compound.locales["nb-NO"].rounds.find((r) => r.id === "skolesekk") as ArrangeRound;
  const nn = compound.locales["nn-NO"].rounds.find((r) => r.id === "skolesekk") as ArrangeRound;
  assert.deepEqual(nb.acceptedAnswers, ["skolesekk"]);
  assert.deepEqual(nn.acceptedAnswers, ["skulesekk"]);
  const sentences = exerciseCatalog.find((e) => e.id === "skynja-sentences-everyday")!;
  assert.match(sentences.locales["nn-NO"].rounds[0]!.explanation, /Ida les boka/);
  for (const e of exerciseCatalog) assert.deepEqual(e.locales["nb-NO"].rounds.map((r) => r.id), e.locales["nn-NO"].rounds.map((r) => r.id));
});

test("judgment has multiple defensible choices and reading distinguishes unknown from false", () => {
  for (const e of exerciseCatalog.filter((item) => item.kind === "JUDGMENT")) {
    for (const round of e.locales["nb-NO"].rounds) {
      assert.equal(round.type, "CHOOSE");
      if (round.type === "CHOOSE") assert.ok(round.options.filter((o) => o.verdict !== "TRY_AGAIN").length >= 2);
    }
  }
  for (const e of exerciseCatalog.filter((item) => item.kind === "READING")) {
    assert.ok(e.locales["nb-NO"].rounds.some((r) => r.type === "CHOOSE" && r.options.some((o) => o.verdict === "NEEDS_CONTEXT")));
  }
});

test("equivalent k tiles are interchangeable but the same tile cannot be reused", () => {
  const round = exerciseCatalog.find((e) => e.id === "skynja-kake-bake")!.locales["nb-NO"].rounds[0] as ArrangeRound;
  const correct = solution(round);
  const swapped = [correct[2]!, correct[1]!, correct[0]!, correct[3]!];
  assert.equal(evaluateArrangement(round, swapped).verdict, "MATCHED");
  assert.equal(evaluateArrangement(round, [correct[0]!, correct[1]!, correct[0]!, correct[3]!]).verdict, "TRY_AGAIN");
  assert.equal(evaluateArrangement(round, [...correct].reverse()).verdict, "TRY_AGAIN");
  assert.equal(assembleAnswer(round, ["unknown"]), undefined);
});

test("missing locale, fake review, duplicate options and impossible compound answers fail validation", () => {
  const missing = structuredClone(exerciseCatalog[0]) as unknown as { locales: Record<string, unknown> };
  delete missing.locales["nn-NO"];
  assert.match(validateExerciseCatalog([missing as unknown as ExerciseDefinition]).join(" "), /both language variants/);
  const approved = { ...exerciseCatalog[0]!, humanReviewed: true } as unknown as ExerciseDefinition;
  assert.match(validateExerciseCatalog([approved]).join(" "), /draft provenance/);
  const compound = exerciseCatalog.find((e) => e.id === "skynja-compound-home")!;
  const round = compound.locales["nb-NO"].rounds[0] as ArrangeRound;
  const impossible = { ...compound, locales: { ...compound.locales, "nb-NO": { ...compound.locales["nb-NO"], rounds: [{ ...round, acceptedAnswers: ["mabokst"] }, ...compound.locales["nb-NO"].rounds.slice(1)] } } };
  assert.match(validateExerciseCatalog([impossible]).join(" "), /answer inventory mismatch/);
  const cloze = exerciseCatalog.find((e) => e.kind === "CLOZE")!;
  const choice = cloze.locales["nb-NO"].rounds[0]!;
  assert.equal(choice.type, "CHOOSE");
  if (choice.type !== "CHOOSE") return;
  const duplicate = { ...cloze, locales: { ...cloze.locales, "nb-NO": { ...cloze.locales["nb-NO"], rounds: [{ ...choice, options: [choice.options[0]!, choice.options[0]!] }, ...cloze.locales["nb-NO"].rounds.slice(1)] } } };
  assert.match(validateExerciseCatalog([duplicate]).join(" "), /invalid options/);
});
