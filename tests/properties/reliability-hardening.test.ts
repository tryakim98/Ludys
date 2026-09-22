import assert from "node:assert/strict";
import test from "node:test";
import { humanFirstBundleNb } from "../../src/content/fixtures/bm/human-first-bundle.js";
import {
  applyReliableCommand,
  createReliableSessionAggregate,
  validateSessionState,
  type CommandEnvelope,
  type ReliableSessionAggregate,
} from "../../src/core/reliability-hardening.js";
import { createInitialSession, type SessionCommand } from "../../src/core/state.js";

const NOW = "2026-07-22T12:00:00.000Z";

function initialAggregate(): ReliableSessionAggregate {
  return createReliableSessionAggregate(createInitialSession({
    sessionId: "synthetic-wp13-10-reliability",
    locale: "nb-NO",
    contentReleaseId: humanFirstBundleNb.releaseId,
  }));
}

function envelope(
  aggregate: ReliableSessionAggregate,
  commandId: string,
  command: SessionCommand,
  patch: Partial<CommandEnvelope<SessionCommand>> = {},
): CommandEnvelope<SessionCommand> {
  return {
    commandId,
    expectedVersion: aggregate.state.version,
    authorityGeneration: aggregate.state.authorityGeneration,
    issuedAt: NOW,
    command,
    ...patch,
  };
}

test("command envelope rejects duplicate, stale version, stale authority and delay without state mutation", () => {
  const base = initialAggregate();
  const applied = applyReliableCommand(base, envelope(base, "cmd-start", { kind: "START", at: NOW }), NOW);
  assert.equal(applied.outcome, "APPLIED");
  assert.equal(applied.aggregate.state.version, 1);

  for (const candidate of [
    envelope(applied.aggregate, "cmd-start", { kind: "ORIENTATION_COMPLETE", at: NOW }),
    envelope(applied.aggregate, "cmd-stale-version", { kind: "ORIENTATION_COMPLETE", at: NOW }, { expectedVersion: 0 }),
    envelope(applied.aggregate, "cmd-stale-authority", { kind: "ORIENTATION_COMPLETE", at: NOW }, { authorityGeneration: 0 }),
    envelope(applied.aggregate, "cmd-delayed", { kind: "ORIENTATION_COMPLETE", at: NOW }, { issuedAt: "2026-07-22T11:00:00.000Z" }),
  ]) {
    const result = applyReliableCommand(applied.aggregate, candidate, NOW);
    assert.equal(result.aggregate.state, applied.aggregate.state);
    assert.equal(result.aggregate.state.version, 1);
    assert.deepEqual(result.aggregate.state.playingAudioIds, []);
    assert.equal(result.aggregate.state.activeCard, undefined);
  }
});

test("central state invariants reject corrupt terminal, pause, quiet, audio and support combinations", () => {
  const state = initialAggregate().state;
  const corrupt = {
    ...state,
    phase: "STOPPED" as const,
    previousActivePhase: "READY" as const,
    playingAudioIds: ["audio-a", "audio-b"],
    quietMode: true,
    activeCard: humanFirstBundleNb.adultCard,
    supportProvenance: [{ attemptId: "attempt", support: "MODEL" as const, cardId: "card", recordedAt: NOW }],
    evidenceStatus: "INDEPENDENT" as const,
  };
  const errors = validateSessionState(corrupt);
  assert.ok(errors.length >= 6, errors.join("; "));
  const aggregate = { state: corrupt, processedCommandIds: new Set<string>() };
  const result = applyReliableCommand(aggregate, envelope(aggregate, "cmd-invalid", { kind: "RECONNECT", at: NOW, sessionId: state.sessionId, authorityGeneration: 1 }), NOW);
  assert.equal(result.outcome, "DOMAIN_REJECTED");
  assert.equal(result.aggregate, aggregate);
});

test("valid Human-First sequence preserves WAIT, adult authority, quiet audio and STOP dominance", () => {
  let aggregate = initialAggregate();
  const commands: SessionCommand[] = [
    { kind: "START", at: NOW },
    { kind: "ORIENTATION_COMPLETE", at: NOW },
    { kind: "BEGIN_CHILD_ACTION", at: NOW, attemptId: "attempt-001" },
    { kind: "PLAY_AUDIO", at: NOW, audioSpecId: humanFirstBundleNb.audio.audioSpecId },
    { kind: "WAIT", at: NOW, actor: "CHILD" },
    { kind: "REQUEST_HELP", at: NOW },
    { kind: "SHOW_ADULT_CARD", at: NOW, card: humanFirstBundleNb.adultCard },
    { kind: "SELECT_SUPPORT", at: NOW, support: "MODEL", cardId: humanFirstBundleNb.adultCard.cardId },
    { kind: "CHILD_ACTION_AFTER_SUPPORT", at: NOW, attemptId: "attempt-002" },
    { kind: "CONTEXT_CORRECTION", at: NOW, correction: "TECHNICAL_ISSUE" },
    { kind: "REQUEST_QUIET", at: NOW },
    { kind: "STOP", at: NOW, actor: "ADULT" },
  ];
  for (const [index, command] of commands.entries()) {
    const result = applyReliableCommand(aggregate, envelope(aggregate, `valid-${index}`, command), NOW);
    assert.equal(result.outcome, "APPLIED", `${command.kind}: ${result.reason ?? ""}`);
    aggregate = result.aggregate;
    assert.deepEqual(validateSessionState(aggregate.state), []);
  }
  assert.equal(aggregate.state.phase, "STOPPED");
  assert.deepEqual(aggregate.state.playingAudioIds, []);
  assert.equal(aggregate.state.activeCard, undefined);
  assert.notEqual(aggregate.state.evidenceStatus, "INDEPENDENT");

  const before = aggregate.state;
  for (const command of [
    { kind: "RECONNECT", at: NOW, sessionId: before.sessionId, authorityGeneration: before.authorityGeneration },
    { kind: "BEGIN_CHILD_ACTION", at: NOW, attemptId: "late-attempt" },
    { kind: "PLAY_AUDIO", at: NOW, audioSpecId: humanFirstBundleNb.audio.audioSpecId },
  ] as const) {
    const result = applyReliableCommand(aggregate, envelope(aggregate, `after-stop-${command.kind}`, command), NOW);
    assert.equal(result.outcome, "DOMAIN_REJECTED");
    assert.equal(result.aggregate.state, before);
  }
});

function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return value >>> 0;
  };
}

function chaosCommand(index: number): SessionCommand {
  const commands: readonly SessionCommand[] = [
    { kind: "START", at: NOW },
    { kind: "ORIENTATION_COMPLETE", at: NOW },
    { kind: "BEGIN_CHILD_ACTION", at: NOW, attemptId: `attempt-${index}` },
    { kind: "WAIT", at: NOW, actor: index % 2 === 0 ? "CHILD" : "ADULT" },
    { kind: "REQUEST_HELP", at: NOW },
    { kind: "SHOW_ADULT_CARD", at: NOW, card: humanFirstBundleNb.adultCard },
    { kind: "ADULT_WAIT", at: NOW },
    { kind: "SELECT_SUPPORT", at: NOW, support: index % 2 === 0 ? "GIVE_HINT" : "MODEL", cardId: humanFirstBundleNb.adultCard.cardId },
    { kind: "CHILD_ACTION_AFTER_SUPPORT", at: NOW, attemptId: `supported-${index}` },
    { kind: "REQUEST_QUIET", at: NOW },
    { kind: "PLAY_AUDIO", at: NOW, audioSpecId: humanFirstBundleNb.audio.audioSpecId },
    { kind: "REPLAY_AUDIO", at: NOW, audioSpecId: humanFirstBundleNb.audio.audioSpecId },
    { kind: "PAUSE", at: NOW },
    { kind: "RESUME", at: NOW },
    { kind: "ADULT_OVERRIDE", at: NOW },
    { kind: "CONTEXT_CORRECTION", at: NOW, correction: "TECHNICAL_ISSUE" },
    { kind: "COMPLETE", at: NOW },
    { kind: "STOP", at: NOW, actor: "ADULT" },
    { kind: "DELETE_SESSION", at: NOW },
    { kind: "RECONNECT", at: NOW, sessionId: "synthetic-wp13-10-reliability", authorityGeneration: 1 },
    { kind: "INVALIDATE", at: NOW },
  ];
  return commands[index % commands.length]!;
}

test("seeded deterministic chaos validates invariants after 4096 command attempts", () => {
  const seeds = [0x13102026, 0x5a17c0de, 0x00c0ffee, 0x10203040];
  let attempts = 0;
  for (const seed of seeds) {
    const random = seeded(seed);
    let aggregate = initialAggregate();
    const issued = new Map<number, CommandEnvelope<SessionCommand>>();
    for (let index = 0; index < 1024; index += 1) {
      const command = chaosCommand(random());
      const mode = random() % 10;
      let candidate = envelope(aggregate, `seed-${seed}-command-${index}`, command);
      if (mode === 0 && issued.size > 0) candidate = issued.get(random() % issued.size) ?? candidate;
      if (mode === 1) candidate = { ...candidate, expectedVersion: Math.max(0, aggregate.state.version - 1) };
      if (mode === 2) candidate = { ...candidate, authorityGeneration: Math.max(0, aggregate.state.authorityGeneration - 1) };
      if (mode === 3) candidate = { ...candidate, issuedAt: "2026-07-22T10:00:00.000Z" };
      issued.set(index, candidate);
      const before = aggregate.state;
      const result = applyReliableCommand(aggregate, candidate, NOW);
      attempts += 1;
      if (result.outcome === "APPLIED") assert.equal(result.aggregate.state.version, before.version + 1);
      else assert.equal(result.aggregate.state, before);
      assert.deepEqual(validateSessionState(result.aggregate.state), []);
      aggregate = result.aggregate;
    }
  }
  assert.equal(attempts, 4096);
});
