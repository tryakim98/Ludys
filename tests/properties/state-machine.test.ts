import test from "node:test";
import assert from "node:assert/strict";
import { transition, type SessionCommand } from "../../src/core/state.js";
import { childActingState, T0 } from "../helpers.js";

test("same state and command produce identical transition", () => {
  const state = childActingState();
  const command: SessionCommand = { kind: "WAIT", at: T0, actor: "ADULT" };
  assert.deepEqual(transition(state, command), transition(state, command));
});

test("one command creates at most one pedagogical intervention", () => {
  const state = childActingState();
  const commands: SessionCommand[] = [
    { kind: "WAIT", at: T0, actor: "ADULT" },
    { kind: "REQUEST_HELP", at: T0 },
    { kind: "REQUEST_QUIET", at: T0 },
    { kind: "PAUSE", at: T0 },
    { kind: "STOP", at: T0, actor: "ADULT" },
  ];
  for (const command of commands) {
    const result = transition(state, command);
    const interventions = result.events.filter((event) =>
      ["ADULT_CARD_PRESENTED", "SUPPORT_RECORDED", "AUDIO_REQUESTED"].includes(event.type),
    );
    assert.ok(interventions.length <= 1);
  }
});

test("state contains no stable person identity", () => {
  const keys = Object.keys(childActingState()).map((key) => key.toLocaleLowerCase("en"));
  for (const forbidden of ["childid", "studentid", "userid", "email", "fullname", "profile"]) {
    assert.equal(keys.includes(forbidden), false);
  }
});
