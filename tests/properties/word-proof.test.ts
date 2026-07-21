import assert from "node:assert/strict";
import test from "node:test";
import { wordProofNb } from "../../src/content/fixtures/bm/word-proof.js";
import {
  createWordProofState,
  transitionWordProof,
} from "../../src/core/word-proof.js";

function selectWord(tileIds: readonly string[]) {
  let state = createWordProofState(wordProofNb, 0);
  for (const tileId of tileIds) {
    state = transitionWordProof(state, wordProofNb, { kind: "SELECT_TILE", tileId }).state;
  }
  return state;
}

test("wrong build resets tiles without inferring cause or emotion", () => {
  let state = selectWord(["sol-l", "sol-o", "sol-s"]);
  state = transitionWordProof(state, wordProofNb, { kind: "SUBMIT_BUILD" }).state;
  assert.equal(state.feedbackCode, "TRY_AGAIN");
  assert.deepEqual(state.selectedGraphemes, []);
  assert.doesNotMatch(JSON.stringify(state), /frustr|motiv|diagnos|lazy|lat/i);
});

test("correct target requires adult confirmation before transfer", () => {
  let state = selectWord(["sol-s", "sol-o", "sol-l"]);
  state = transitionWordProof(state, wordProofNb, { kind: "SUBMIT_BUILD" }).state;
  assert.equal(state.stage, "TARGET_READ_CONFIRMATION");
  assert.equal(state.targetEvidence, undefined);
});

test("independent target and transfer preserve evidence distinction", () => {
  let state = selectWord(["sol-s", "sol-o", "sol-l"]);
  state = transitionWordProof(state, wordProofNb, { kind: "SUBMIT_BUILD" }).state;
  state = transitionWordProof(state, wordProofNb, {
    kind: "ADULT_CONFIRM_READING",
    currentSupportCount: 0,
  }).state;
  assert.equal(state.targetEvidence, "INDEPENDENT");
  for (const tileId of ["mus-m", "mus-u", "mus-s"]) {
    state = transitionWordProof(state, wordProofNb, { kind: "SELECT_TILE", tileId }).state;
  }
  state = transitionWordProof(state, wordProofNb, { kind: "SUBMIT_BUILD" }).state;
  state = transitionWordProof(state, wordProofNb, {
    kind: "ADULT_CONFIRM_READING",
    currentSupportCount: 0,
  }).state;
  assert.equal(state.transferEvidence, "NEAR_TRANSFER");
  assert.equal(state.stage, "COMPLETED");
});

test("support in current task prevents independent evidence", () => {
  let state = selectWord(["sol-s", "sol-o", "sol-l"]);
  state = transitionWordProof(state, wordProofNb, { kind: "SUBMIT_BUILD" }).state;
  state = transitionWordProof(state, wordProofNb, {
    kind: "ADULT_CONFIRM_READING",
    currentSupportCount: 1,
  }).state;
  assert.equal(state.targetEvidence, "SUPPORTED_RETRY");
});

test("stop clears selected material and is terminal", () => {
  let state = selectWord(["sol-s"]);
  state = transitionWordProof(state, wordProofNb, { kind: "STOP" }).state;
  assert.equal(state.stage, "STOPPED");
  assert.deepEqual(state.selectedGraphemes, []);
  const later = transitionWordProof(state, wordProofNb, {
    kind: "SELECT_TILE",
    tileId: "sol-o",
  });
  assert.equal(later.accepted, false);
});
