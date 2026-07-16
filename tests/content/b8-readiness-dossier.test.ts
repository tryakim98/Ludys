import assert from "node:assert/strict";
import test from "node:test";
import { B8_GATE_IDS, assessB8Readiness } from "../../src/core/b8-readiness.js";
import {
  b8ReadinessDossier,
  b8SourceRegister,
} from "../../src/content/prototype/b8-readiness-dossier.js";

test("every B8 gate has evidence requirements", () => {
  for (const gateId of B8_GATE_IDS) {
    assert.ok(
      b8ReadinessDossier.requirements.some((requirement) => requirement.gateId === gateId),
      `missing requirements for ${gateId}`,
    );
  }
});

test("candidate pilot envelope is small, session-bound and explicitly unauthorized", () => {
  const envelope = b8ReadinessDossier.candidateEnvelope;
  assert.equal(envelope.status, "PROPOSED_NOT_AUTHORIZED");
  assert.equal(envelope.siteCountMaximum, 1);
  assert.ok(envelope.dyadCountMaximum <= 8);
  assert.equal(envelope.sessionsPerDyadMaximum, 1);
  assert.ok(envelope.sessionMinutesMaximum <= 20);
  assert.equal(envelope.applicationDataPolicy, "SESSION_ONLY_DELETE_AT_END");
  assert.equal(envelope.audioCapture, false);
  assert.equal(envelope.freeTextInApplication, false);
  assert.equal(envelope.runtimeAi, false);
  assert.equal(envelope.crossSessionProfile, false);
  assert.equal(envelope.remoteHomeUse, false);
});

test("critical stop rules cover control, privacy and false relational belief", () => {
  const critical = b8ReadinessDossier.stopRules.filter((rule) => rule.severity === "CRITICAL");
  assert.ok(critical.length >= 3);
  const text = critical.map((rule) => rule.trigger).join(" ").toLowerCase();
  assert.match(text, /stopp/);
  assert.match(text, /person|data/);
  assert.match(text, /kjenner|følelser|diagnostiserer/);
});

test("measurement plan requires no application logging", () => {
  assert.ok(b8ReadinessDossier.measurementRules.length >= 7);
  assert.ok(
    b8ReadinessDossier.measurementRules.every(
      (measure) => measure.applicationLoggingRequired === false,
    ),
  );
});

test("current assessment exposes post-decision conditions separately", () => {
  const assessment = assessB8Readiness(b8ReadinessDossier);
  assert.ok(assessment.conditionsAfterDecision.includes("B8-CAK-03"));
  assert.ok(assessment.conditionsAfterDecision.includes("B8-SEC-02"));
  assert.ok(assessment.conditionsAfterDecision.includes("B8-ETH-02"));
});

test("official source register covers school ownership, DPIA, ethics and AI watch", () => {
  const ids = new Set<string>(b8SourceRegister.map((source) => source.sourceId));
  for (const required of [
    "SRC-UDIR-SCHOOL-OWNER",
    "SRC-DT-DPIA",
    "SRC-DT-SCHOOL-AUDIT",
    "SRC-NESH-CONSENT",
    "SRC-EU-AI-ACT",
  ]) {
    assert.ok(ids.has(required), `missing source ${required}`);
  }
});
