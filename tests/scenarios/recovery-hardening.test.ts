import assert from "node:assert/strict";
import test from "node:test";
import { readyState } from "../helpers.js";
import {
  RELIABILITY_SCHEMA_VERSION,
  recoverStoredSession,
  type RecoveryReferenceCatalog,
  type StoredSessionSnapshot,
} from "../../src/core/reliability-hardening.js";
import {
  createRuntimeSafetyState,
  failClosedRuntime,
  runtimeRecoveryCopy,
  type RuntimeFailureKind,
} from "../../src/core/runtime-safety.js";

const catalog: RecoveryReferenceCatalog = {
  contentReleaseId: "release-hf-001",
  activityIds: ["activity-simple-blend-23"],
  knowledgeIds: ["knowledge-decoding-001"],
  contextIds: ["context-decoding-001"],
  audioIds: ["audio-decoding-001"],
  locale: "nb-NO",
};

function snapshot(): StoredSessionSnapshot {
  return {
    schemaVersion: RELIABILITY_SCHEMA_VERSION,
    session: readyState(),
    activityId: catalog.activityIds[0]!,
    knowledgeId: catalog.knowledgeIds[0]!,
    contextId: catalog.contextIds[0]!,
    audio: { audioId: catalog.audioIds[0]!, lifecycle: "CURRENT", format: "WAV_PCM_MONO_48KHZ" },
  };
}

test("empty, malformed, invalid-shape and stale-schema storage fail closed", () => {
  assert.equal(recoverStoredSession(undefined, catalog).status, "EMPTY_SAFE_START");
  assert.equal(recoverStoredSession("{broken", catalog).status, "CORRUPTED_INVALIDATED");
  assert.equal(recoverStoredSession(JSON.stringify({ schemaVersion: RELIABILITY_SCHEMA_VERSION }), catalog).status, "CORRUPTED_INVALIDATED");
  assert.equal(recoverStoredSession(JSON.stringify({ ...snapshot(), schemaVersion: "old" }), catalog).status, "UNSUPPORTED_VERSION");
});

test("content, reference and BM/NN mismatches invalidate without fallback", () => {
  for (const candidate of [
    { ...snapshot(), activityId: "unknown" },
    { ...snapshot(), knowledgeId: "orphan" },
    { ...snapshot(), contextId: "orphan" },
    { ...snapshot(), session: { ...snapshot().session, contentReleaseId: "unknown" } },
    { ...snapshot(), session: { ...snapshot().session, locale: "nn-NO" as const } },
  ]) {
    const result = recoverStoredSession(JSON.stringify(candidate), catalog);
    assert.equal(result.status, "CONTENT_UNAVAILABLE");
    assert.equal(result.safeState, "INVALIDATED");
    assert.equal(result.snapshot?.session.phase, "INVALIDATED");
  }
});

test("missing, stale, withdrawn and invalid audio use explicit text-and-silence fallback", () => {
  for (const audio of [
    { audioId: "missing", lifecycle: "CURRENT" as const, format: "WAV_PCM_MONO_48KHZ" as const },
    { audioId: catalog.audioIds[0]!, lifecycle: "STALE" as const, format: "WAV_PCM_MONO_48KHZ" as const },
    { audioId: catalog.audioIds[0]!, lifecycle: "WITHDRAWN" as const, format: "WAV_PCM_MONO_48KHZ" as const },
    { audioId: catalog.audioIds[0]!, lifecycle: "CURRENT" as const, format: "UNKNOWN" as const },
  ]) {
    const result = recoverStoredSession(JSON.stringify({ ...snapshot(), audio }), catalog);
    assert.equal(result.status, "TEXT_ONLY");
    assert.equal(result.safeState, "TEXT_AND_SILENCE");
    assert.deepEqual(result.snapshot?.session.playingAudioIds, []);
  }
});

test("broken invariants invalidate and terminal snapshots never resurrect on refresh", () => {
  const broken = { ...snapshot(), session: { ...snapshot().session, playingAudioIds: ["a", "b"] } };
  assert.equal(recoverStoredSession(JSON.stringify(broken), catalog).status, "CORRUPTED_INVALIDATED");
  for (const session of [
    { ...snapshot().session, phase: "STOPPED" as const, authorityGeneration: 2 },
    { ...snapshot().session, phase: "INVALIDATED" as const, deleted: true, currentAttemptId: undefined, authorityGeneration: 2 },
  ]) {
    const result = recoverStoredSession(JSON.stringify({ ...snapshot(), session }), catalog);
    assert.equal(result.status, "RECOVERED");
    assert.equal(result.snapshot?.session.phase, session.phase);
    assert.equal(result.snapshot?.session.deleted, session.deleted);
  }
});

test("runtime boundary stops audio and pending actions for every critical browser failure", () => {
  const failures: readonly RuntimeFailureKind[] = ["WINDOW_ERROR", "UNHANDLED_REJECTION", "RENDER_FAILURE", "STORAGE_FAILURE", "AUDIO_FAILURE"];
  for (const failure of failures) {
    const state = { ...createRuntimeSafetyState(), activeAudioIds: ["audio"], pendingActionIds: ["pending"] };
    const failed = failClosedRuntime(state, failure);
    assert.equal(failed.mode, "TECHNICAL_RECOVERY");
    assert.deepEqual(failed.activeAudioIds, []);
    assert.deepEqual(failed.pendingActionIds, []);
    assert.equal(failed.stopAvailable, true);
    assert.equal(failed.safeStartAvailable, true);
    assert.equal(failed.externalReporting, false);
    assert.equal(failed.personInterpretation, false);
  }
  assert.deepEqual(Object.keys(runtimeRecoveryCopy).sort(), ["nb-NO", "nn-NO"]);
  assert.ok(Object.values(runtimeRecoveryCopy).every((copy) => copy.humanReviewed));
});
