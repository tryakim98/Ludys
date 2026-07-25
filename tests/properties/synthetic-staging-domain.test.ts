import assert from "node:assert/strict";
import test from "node:test";
import {
  applySyntheticStagingCommand,
  createSyntheticStagingAggregate,
  deleteSyntheticStagingAggregate,
  projectSyntheticStaging,
  SYNTHETIC_STAGING_RELEASE_ID,
  SYNTHETIC_STAGING_SCHEMA_VERSION,
  type SyntheticStagingAggregate,
  type SyntheticStagingRole,
} from "../../src/core/synthetic-staging.js";

const releaseIds = {
  appVersion: "0.14.0-reconstructed.9",
  contentReleaseId: "wp13-8-authentic-draft-corpus-r1",
  knowledgeReleaseId: "release-knowledge-audio-prototype-001",
  audioReleaseId: "wp13-9-audio-specifications-r1",
  operationsReleaseId: "wp13-11-operations-kit-r1",
  providerDecisionReleaseId: "wp13-12a-provider-decision-r1",
  stagingProviderReleaseId: SYNTHETIC_STAGING_RELEASE_ID,
  schemaVersion: SYNTHETIC_STAGING_SCHEMA_VERSION,
} as const;

function fixture(): SyntheticStagingAggregate {
  return createSyntheticStagingAggregate({
    syntheticSessionId: "synthetic-wp13-12b-test-fixture",
    locale: "nb-NO",
    issuedAt: "2026-07-25T10:00:00.000Z",
    expiresAt: "2026-07-25T10:15:00.000Z",
    controlEpoch: 4,
    releaseIds,
  });
}

function command(
  aggregate: SyntheticStagingAggregate,
  role: SyntheticStagingRole,
  kind: "ACTIVATE" | "REQUEST_HELP" | "ENTER_WAIT" | "RESUME" | "PAUSE" | "STOP" | "RECONNECT",
  commandId: string,
  patch: Partial<{
    expectedVersion: number;
    authorityGeneration: number;
    issuedAt: string;
  }> = {},
) {
  return applySyntheticStagingCommand(aggregate, {
    commandId,
    expectedVersion: patch.expectedVersion ?? aggregate.lifecycle.version,
    authorityGeneration: patch.authorityGeneration ?? aggregate.lifecycle.authorityGeneration,
    issuedAt: patch.issuedAt ?? "2026-07-25T10:00:01.000Z",
    role,
    command: { kind },
  }, "2026-07-25T10:00:01.000Z");
}

test("synthetic multi-client uses one authoritative session with separate role projections", () => {
  const active = command(fixture(), "ADULT", "ACTIVATE", "activate");
  assert.equal(active.outcome, "APPLIED");
  const child = projectSyntheticStaging(active.aggregate, "CHILD");
  const adult = projectSyntheticStaging(active.aggregate, "ADULT");
  assert.equal(child.role, "CHILD");
  assert.equal(adult.role, "ADULT");
  assert.equal(adult.syntheticSessionId, active.aggregate.syntheticSessionId);
  assert.equal("syntheticSessionId" in child, false);
  assert.equal("adultCard" in child, false);
});

test("WAIT is first-class and produces no adult card", () => {
  const active = command(fixture(), "ADULT", "ACTIVATE", "activate").aggregate;
  const waiting = command(active, "CHILD", "ENTER_WAIT", "wait");
  assert.equal(waiting.outcome, "APPLIED");
  assert.equal(projectSyntheticStaging(waiting.aggregate, "CHILD").wait, true);
  assert.equal(projectSyntheticStaging(waiting.aggregate, "ADULT").adultCard, undefined);
});

test("help creates an adult-only card without leaking it to child projection", () => {
  const active = command(fixture(), "ADULT", "ACTIVATE", "activate").aggregate;
  const help = command(active, "CHILD", "REQUEST_HELP", "help");
  assert.equal(projectSyntheticStaging(help.aggregate, "CHILD").helpPending, true);
  assert.equal(projectSyntheticStaging(help.aggregate, "ADULT").adultCard, "SYNTHETIC_HELP_REQUESTED");
  assert.equal("adultCard" in projectSyntheticStaging(help.aggregate, "CHILD"), false);
});

test("stale version, stale authority, duplicate and delayed commands never mutate stateversion", () => {
  const active = command(fixture(), "ADULT", "ACTIVATE", "activate").aggregate;
  const staleVersion = command(active, "CHILD", "ENTER_WAIT", "stale-version", {
    expectedVersion: active.lifecycle.version - 1,
  });
  const staleAuthority = command(active, "CHILD", "ENTER_WAIT", "stale-authority", {
    authorityGeneration: active.lifecycle.authorityGeneration + 1,
  });
  const delayed = command(active, "CHILD", "ENTER_WAIT", "delayed", {
    issuedAt: "2026-07-25T09:00:00.000Z",
  });
  const accepted = command(active, "CHILD", "ENTER_WAIT", "duplicate");
  const duplicate = command(accepted.aggregate, "ADULT", "RESUME", "duplicate");
  for (const rejected of [staleVersion, staleAuthority, delayed, duplicate]) {
    assert.notEqual(rejected.outcome, "APPLIED");
  }
  assert.equal(staleVersion.aggregate.lifecycle.version, active.lifecycle.version);
  assert.equal(staleAuthority.aggregate.lifecycle.version, active.lifecycle.version);
  assert.equal(delayed.aggregate.lifecycle.version, active.lifecycle.version);
  assert.equal(duplicate.aggregate.lifecycle.version, accepted.aggregate.lifecycle.version);
});

test("STOP dominates delayed commands, clears help/audio and prevents resurrection", () => {
  const active = command(fixture(), "ADULT", "ACTIVATE", "activate").aggregate;
  const help = command(active, "CHILD", "REQUEST_HELP", "help").aggregate;
  const stopped = command(help, "CHILD", "STOP", "stop");
  assert.equal(stopped.outcome, "APPLIED");
  assert.equal(stopped.aggregate.lifecycle.state, "STOPPED");
  assert.equal(stopped.aggregate.lifecycle.helpRequested, false);
  assert.equal(projectSyntheticStaging(stopped.aggregate, "CHILD").audioStatus, "SILENT");
  const delayed = command(stopped.aggregate, "ADULT", "RESUME", "after-stop");
  assert.equal(delayed.outcome, "DOMAIN_REJECTED");
  assert.equal(delayed.aggregate.lifecycle.state, "STOPPED");
});

test("explicit deletion creates terminal state and reconnect cannot resurrect", () => {
  const active = command(fixture(), "ADULT", "ACTIVATE", "activate").aggregate;
  const deleted = deleteSyntheticStagingAggregate(active, "2026-07-25T10:00:02.000Z");
  assert.equal(deleted.lifecycle.state, "DELETED");
  assert.ok(deleted.lifecycle.authorityGeneration > active.lifecycle.authorityGeneration);
  const reconnect = command(deleted, "CHILD", "RECONNECT", "reconnect");
  assert.equal(reconnect.outcome, "DOMAIN_REJECTED");
  assert.equal(reconnect.aggregate.lifecycle.state, "DELETED");
});

test("synthetic aggregate contains no stable person identity or forbidden participant data", () => {
  const serialized = JSON.stringify(fixture());
  for (const prohibited of [
    "name",
    "email",
    "phone",
    "school",
    "studentNumber",
    "birthDate",
    "diagnosis",
    "healthData",
    "stableUID",
    "tenant",
    "realLearningResponse",
    "freeTextAboutParticipant",
    "microphoneData",
    "cameraData",
    "analyticsIdentifier",
  ]) assert.equal(serialized.includes(prohibited), false, prohibited);
});
