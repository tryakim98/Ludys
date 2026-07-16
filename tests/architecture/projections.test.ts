import test from "node:test";
import assert from "node:assert/strict";
import { projectForAdult } from "../../src/application/projections/adult-projection.js";
import { projectForChild } from "../../src/application/projections/child-projection.js";
import { transition } from "../../src/core/state.js";
import { childActingState, humanFirstBundleNb, T0 } from "../helpers.js";

test("child projection never exposes adult card", () => {
  let state = transition(childActingState(), { kind: "REQUEST_HELP", at: T0 }).state;
  state = transition(state, {
    kind: "SHOW_ADULT_CARD",
    at: T0,
    card: humanFirstBundleNb.adultCard,
  }).state;
  const child = projectForChild(state) as unknown as Record<string, unknown>;
  const adult = projectForAdult(state);
  assert.equal("currentCard" in child, false);
  assert.equal(adult.currentCard?.cardId, humanFirstBundleNb.adultCard.cardId);
  assert.equal(adult.waitAllowed, true);
});
