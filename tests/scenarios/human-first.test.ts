import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transition } from "../../src/core/state.js";
import { InMemoryContent } from "../../src/adapters/in-memory/in-memory-content.js";
import { InMemorySession } from "../../src/adapters/in-memory/in-memory-session.js";
import { humanFirstBundleNn } from "../../src/content/fixtures/nn/human-first-bundle.js";
import { validateAudio } from "../../src/core/content-contracts.js";
import { childActingState, humanFirstBundleNb, readyState, T0 } from "../helpers.js";

function helpWithCard() {
  let state = childActingState();
  state = transition(state, { kind: "REQUEST_HELP", at: T0 }).state;
  state = transition(state, {
    kind: "SHOW_ADULT_CARD",
    at: T0,
    card: humanFirstBundleNb.adultCard,
  }).state;
  return state;
}

test("HF-S01 WAIT produces no intervention", () => {
  const result = transition(childActingState(), {
    kind: "WAIT",
    at: T0,
    actor: "ADULT",
  });
  assert.equal(result.state.phase, "WAITING_WITHOUT_INTERVENTION");
  assert.equal(result.state.activeCard, undefined);
  assert.deepEqual(result.state.playingAudioIds, []);
  assert.ok(result.events.some((event) => event.type === "NO_INTERVENTION"));
});

test("HF-S02 REQUEST_QUIET suppresses audio without profiling", () => {
  let state = transition(childActingState(), {
    kind: "PLAY_AUDIO",
    at: T0,
    audioSpecId: humanFirstBundleNb.audio.audioSpecId,
  }).state;
  state = transition(state, { kind: "REQUEST_QUIET", at: T0 }).state;
  assert.equal(state.quietMode, true);
  assert.deepEqual(state.playingAudioIds, []);
  assert.equal("childId" in state, false);
});

test("HF-S03 adult can reject a card", () => {
  const result = transition(helpWithCard(), { kind: "ADULT_WAIT", at: T0 });
  assert.equal(result.accepted, true);
  assert.equal(result.state.activeCard, undefined);
  assert.equal(result.state.phase, "WAITING_WITHOUT_INTERVENTION");
});

test("HF-S04 context correction stays session-bound", () => {
  const result = transition(childActingState(), {
    kind: "CONTEXT_CORRECTION",
    at: T0,
    correction: "TASK_UNCLEAR",
  });
  assert.deepEqual(result.state.contextCorrections, ["TASK_UNCLEAR"]);
  assert.equal("adultProfile" in result.state, false);
  assert.equal("childProfile" in result.state, false);
});

test("HF-S05 stop dominates cards and audio", () => {
  let state = helpWithCard();
  state = transition(state, {
    kind: "PLAY_AUDIO",
    at: T0,
    audioSpecId: humanFirstBundleNb.audio.audioSpecId,
  }).state;
  const result = transition(state, { kind: "STOP", at: T0, actor: "CHILD" });
  assert.equal(result.state.phase, "STOPPED");
  assert.equal(result.state.activeCard, undefined);
  assert.deepEqual(result.state.playingAudioIds, []);
  const later = transition(result.state, { kind: "RESUME", at: T0 });
  assert.equal(later.accepted, false);
});

test("HF-S06 support provenance cannot become independent evidence", () => {
  let state = helpWithCard();
  state = transition(state, {
    kind: "SELECT_SUPPORT",
    at: T0,
    support: "MODEL",
    cardId: humanFirstBundleNb.adultCard.cardId,
  }).state;
  state = transition(state, {
    kind: "CHILD_ACTION_AFTER_SUPPORT",
    at: T0,
    attemptId: "attempt-002",
  }).state;
  assert.equal(state.evidenceStatus, "SUPPORTED_RETRY");
  assert.equal(state.supportProvenance.length, 1);
});

test("HF-S07 pause or timing never creates emotion inference", () => {
  let state = transition(childActingState(), { kind: "WAIT", at: T0, actor: "CHILD" }).state;
  state = transition(state, { kind: "PAUSE", at: T0 }).state;
  const serialized = JSON.stringify(state);
  assert.doesNotMatch(serialized, /frustrat|motiv|emotion|diagnos/i);
});

test("HF-S08 human voice is a reviewed asset, not a persona", () => {
  assert.deepEqual(validateAudio(humanFirstBundleNb.audio), []);
  const serialized = JSON.stringify(humanFirstBundleNb.audio);
  assert.doesNotMatch(serialized, /friend|venn|cares|bryr seg|kjenner deg/i);
  assert.equal(humanFirstBundleNb.audio.userInitiated, true);
});

test("HF-S09 BM and NN require exact locale resolution", () => {
  const content = new InMemoryContent([humanFirstBundleNb, humanFirstBundleNn]);
  const nn = content.resolve({
    releaseId: "release-hf-001",
    activityId: "activity-hf-foundation",
    locale: "nn-NO",
  });
  assert.equal(nn.locale, "nn-NO");
  assert.ok(nn.messages.every((message) => message.locale === "nn-NO"));
  assert.throws(() =>
    content.resolve({
      releaseId: "missing-release",
      activityId: "activity-hf-foundation",
      locale: "nb-NO",
    }),
  );
});

test("HF-S10 deleted session cannot be resurrected", () => {
  const store = new InMemorySession();
  let state = readyState();
  store.save(state);
  state = transition(state, { kind: "DELETE_SESSION", at: T0 }).state;
  store.delete(state.sessionId);
  assert.equal(store.load(state.sessionId), undefined);
  assert.throws(() => store.save({ ...state, deleted: false }));
  const reconnect = transition(state, {
    kind: "RECONNECT",
    at: T0,
    sessionId: state.sessionId,
    authorityGeneration: state.authorityGeneration,
  });
  assert.equal(reconnect.accepted, false);
});

test("HF-S11 pause and stop remain explicit accessible commands", () => {
  let state = childActingState();
  const paused = transition(state, { kind: "PAUSE", at: T0 });
  assert.equal(paused.state.phase, "PAUSED");
  const resumed = transition(paused.state, { kind: "RESUME", at: T0 });
  assert.equal(resumed.state.phase, "CHILD_ACTING");
  const stopped = transition(resumed.state, { kind: "STOP", at: T0, actor: "ADULT" });
  assert.equal(stopped.state.phase, "STOPPED");
});

test("HF-S12 repository has no runtime AI or provider dependency", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  assert.deepEqual(packageJson.dependencies ?? {}, {});
  const names = Object.keys(packageJson.devDependencies ?? {}).join(" ");
  assert.doesNotMatch(names, /openai|anthropic|ai-sdk|firebase|react/i);
});
