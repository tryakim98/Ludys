import assert from "node:assert/strict";
import test from "node:test";
import { VerticalProofController } from "../../src/application/vertical-proof-controller.js";
import { projectVerticalAdult, projectVerticalChild } from "../../src/application/projections/vertical-proof.js";
import { wordProofContentNb } from "../../src/content/fixtures/bm/word-proof-content.js";
import { wordProofNb } from "../../src/content/fixtures/bm/word-proof.js";

function controller() {
  return new VerticalProofController({
    sessionId: "synthetic-session-wp13-2",
    definition: wordProofNb,
    content: wordProofContentNb,
  });
}

test("child and adult projections share one authoritative snapshot", () => {
  const runtime = controller();
  runtime.dispatch({ kind: "SELECT_TILE", tileId: "sol-s" });
  const child = projectVerticalChild(runtime.snapshot);
  const adult = projectVerticalAdult(runtime.snapshot);
  assert.equal(child.selectedGraphemes.join(""), "s");
  assert.equal(adult.builtWord, "s");
  assert.equal(child.phase, adult.phase);
});

test("adult WAIT dismisses card without creating support provenance", () => {
  const runtime = controller();
  runtime.dispatch({ kind: "REQUEST_HELP" });
  assert.ok(projectVerticalAdult(runtime.snapshot).currentCard);
  runtime.dispatch({ kind: "ADULT_WAIT" });
  assert.equal(projectVerticalAdult(runtime.snapshot).currentCard, undefined);
  assert.equal(runtime.snapshot.session.supportProvenance.length, 0);
  assert.equal(runtime.snapshot.session.phase, "WAITING_WITHOUT_INTERVENTION");
});

test("adult model is recorded and target cannot become independent", () => {
  const runtime = controller();
  runtime.dispatch({ kind: "REQUEST_HELP" });
  runtime.dispatch({ kind: "ADULT_MODEL" });
  for (const tileId of ["sol-s", "sol-o", "sol-l"]) {
    runtime.dispatch({ kind: "SELECT_TILE", tileId });
  }
  runtime.dispatch({ kind: "SUBMIT_BUILD" });
  runtime.dispatch({ kind: "ADULT_CONFIRM_READING" });
  assert.equal(runtime.snapshot.proof.targetEvidence, "SUPPORTED_RETRY");
  assert.equal(runtime.snapshot.session.supportProvenance.length, 1);
});

test("independent target followed by independent new word becomes near transfer", () => {
  const runtime = controller();
  for (const tileId of ["sol-s", "sol-o", "sol-l"]) runtime.dispatch({ kind: "SELECT_TILE", tileId });
  runtime.dispatch({ kind: "SUBMIT_BUILD" });
  runtime.dispatch({ kind: "ADULT_CONFIRM_READING" });
  for (const tileId of ["mus-m", "mus-u", "mus-s"]) runtime.dispatch({ kind: "SELECT_TILE", tileId });
  runtime.dispatch({ kind: "SUBMIT_BUILD" });
  runtime.dispatch({ kind: "ADULT_CONFIRM_READING" });
  assert.equal(runtime.snapshot.proof.targetEvidence, "INDEPENDENT");
  assert.equal(runtime.snapshot.proof.transferEvidence, "NEAR_TRANSFER");
  assert.equal(runtime.snapshot.session.phase, "COMPLETED");
});

test("quiet mode blocks audio while reviewed text remains", () => {
  const runtime = controller();
  runtime.dispatch({ kind: "REQUEST_QUIET" });
  runtime.dispatch({ kind: "PLAY_AUDIO" });
  assert.equal(runtime.snapshot.session.quietMode, true);
  assert.deepEqual(runtime.snapshot.session.playingAudioIds, []);
  assert.match(runtime.snapshot.lastTechnicalMessage, /audio unavailable/i);
});

test("stop dominates both session and learning proof", () => {
  const runtime = controller();
  runtime.dispatch({ kind: "REQUEST_HELP" });
  runtime.dispatch({ kind: "STOP", actor: "CHILD" });
  assert.equal(runtime.snapshot.session.phase, "STOPPED");
  assert.equal(runtime.snapshot.session.activeCard, undefined);
  assert.equal(runtime.snapshot.proof.stage, "STOPPED");
});
