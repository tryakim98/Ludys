import assert from "node:assert/strict";
import test from "node:test";
import {
  SyntheticStagingAuthoritativeHandler,
  type HandlerRequest,
  type IssueSyntheticSessionResult,
  type SessionCommandBody,
} from "../../provider/firebase/functions/src/authoritative-handler.js";
import { InMemorySyntheticStagingStore } from "../../provider/firebase/functions/src/in-memory-store.js";
import {
  SYNTHETIC_STAGING_RELEASE_ID,
  SYNTHETIC_STAGING_SCHEMA_VERSION,
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

function harness(input?: { readonly enabled?: boolean }) {
  let observedAt = "2026-07-25T10:00:00.000Z";
  const store = new InMemorySyntheticStagingStore({
    stagingEnabled: input?.enabled ?? true,
    controlEpoch: 7,
    changedAt: observedAt,
  });
  const handler = new SyntheticStagingAuthoritativeHandler(
    store,
    new TextEncoder().encode("0123456789abcdef0123456789abcdef"),
    releaseIds,
    {
      sessionIssuanceEnabled: input?.enabled ?? true,
      region: "europe-north1",
      projectId: "ludys-synthetic-dev",
      now: () => observedAt,
    },
  );
  return {
    store,
    handler,
    setNow: (next: string) => { observedAt = next; },
  };
}

async function issue(
  handler: SyntheticStagingAuthoritativeHandler,
): Promise<IssueSyntheticSessionResult> {
  const result = await handler.issueSyntheticSession({
    operatorAuthorized: true,
    locale: "nb-NO",
  });
  assert.equal(result.ok, true);
  assert.ok(result.value);
  return result.value;
}

function request(
  capability: string,
  body: SessionCommandBody,
  patch: Partial<HandlerRequest<SessionCommandBody>> = {},
): HandlerRequest<SessionCommandBody> {
  return {
    authorization: `Bearer ${capability}`,
    body,
    url: "/sessionCommand",
    query: {},
    ...patch,
  };
}

function commandBody(
  session: IssueSyntheticSessionResult,
  kind: SessionCommandBody["command"]["kind"],
  commandId: string,
  input: Partial<SessionCommandBody> = {},
): SessionCommandBody {
  return {
    syntheticSessionId: session.syntheticSessionId,
    commandId,
    expectedStateVersion: session.adultProjection.stateVersion,
    authorityGeneration: 1,
    issuedAt: "2026-07-25T10:00:00.000Z",
    command: { kind },
    ...input,
  };
}

test("session issuance is IAM/operator protected and disabled by default", async () => {
  const disabled = harness({ enabled: false });
  assert.equal((await disabled.handler.issueSyntheticSession({
    operatorAuthorized: true,
    locale: "nb-NO",
  })).denialClass, "SESSION_ISSUANCE_DISABLED");
  const enabled = harness();
  assert.equal((await enabled.handler.issueSyntheticSession({
    operatorAuthorized: false,
    locale: "nb-NO",
  })).denialClass, "OPERATOR_AUTHORIZATION_REQUIRED");
});

test("issued CHILD and ADULT capabilities are short-lived, separate, opaque and session-bound", async () => {
  const { handler } = harness();
  const session = await issue(handler);
  assert.notEqual(session.childCapability, session.adultCapability);
  assert.equal(session.childCapability.includes(session.syntheticSessionId), false);
  assert.equal(session.childCapability.split(".").length, 2);
  assert.equal(session.adultCapability.split(".").length, 2);
  assert.equal("capability" in session.childProjection, false);
  assert.equal("capability" in session.adultProjection, false);
});

test("capability is accepted only in Authorization Bearer and rejected in URL or body", async () => {
  const { handler } = harness();
  const session = await issue(handler);
  const body = commandBody(session, "ACTIVATE", "activate");
  assert.equal((await handler.sessionCommand(request(session.adultCapability, body))).ok, true);
  const bodyLeak = { ...body, capability: session.adultCapability } as SessionCommandBody;
  assert.equal((await handler.sessionCommand(request(session.adultCapability, bodyLeak))).denialClass, "BEARER_ONLY");
  assert.equal((await handler.sessionCommand(request(session.adultCapability, body, {
    url: `/sessionCommand?capability=${session.adultCapability}`,
  }))).denialClass, "BEARER_ONLY");
  assert.equal((await handler.sessionCommand(request(session.adultCapability, body, {
    authorization: session.adultCapability,
  }))).denialClass, "BEARER_ONLY");
});

test("wrong role, wrong session, stale version and stale authority fail without mutation", async () => {
  const { handler } = harness();
  const session = await issue(handler);
  assert.equal((await handler.sessionCommand(request(
    session.childCapability,
    commandBody(session, "ACTIVATE", "wrong-role"),
  ))).denialClass, "ROLE_COMMAND_DENIED");
  assert.equal((await handler.sessionCommand(request(
    session.adultCapability,
    commandBody(session, "ACTIVATE", "wrong-session", {
      syntheticSessionId: "synthetic-wp13-12b-other-session",
    }),
  ))).denialClass, "SESSION_BINDING_MISMATCH");
  assert.equal((await handler.sessionCommand(request(
    session.adultCapability,
    commandBody(session, "ACTIVATE", "stale-version", { expectedStateVersion: 1 }),
  ))).denialClass, "STALE_VERSION");
  assert.equal((await handler.sessionCommand(request(
    session.adultCapability,
    commandBody(session, "ACTIVATE", "stale-authority", { authorityGeneration: 2 }),
  ))).denialClass, "STALE_AUTHORITY");
  const projection = await handler.sessionProjection({
    authorization: `Bearer ${session.adultCapability}`,
    body: { syntheticSessionId: session.syntheticSessionId },
    url: "/sessionProjection",
    query: {},
  });
  assert.equal(projection.value?.stateVersion, session.adultProjection.stateVersion);
});

test("duplicate command and delayed command are rejected", async () => {
  const { handler } = harness();
  const session = await issue(handler);
  const activate = commandBody(session, "ACTIVATE", "duplicate");
  const first = await handler.sessionCommand(request(session.adultCapability, activate));
  assert.equal(first.ok, true);
  assert.equal((await handler.sessionCommand(request(session.adultCapability, {
    ...activate,
    expectedStateVersion: first.value?.stateVersion ?? 0,
  }))).denialClass, "DUPLICATE_COMMAND");
  assert.equal((await handler.sessionCommand(request(session.childCapability, {
    ...commandBody(session, "ENTER_WAIT", "delayed"),
    expectedStateVersion: first.value?.stateVersion ?? 0,
    issuedAt: "2026-07-25T09:00:00.000Z",
  }))).denialClass, "DELAYED_COMMAND");
});

test("STOP revokes both role capabilities and dominates delayed commands", async () => {
  const { handler, store } = harness();
  const session = await issue(handler);
  const active = await handler.sessionCommand(request(
    session.adultCapability,
    commandBody(session, "ACTIVATE", "activate"),
  ));
  assert.ok(active.value);
  const stopped = await handler.sessionCommand(request(session.childCapability, {
    ...commandBody(session, "STOP", "stop"),
    expectedStateVersion: active.value.stateVersion,
  }));
  assert.equal(stopped.value?.terminalStatus, "STOPPED");
  const delayed = await handler.sessionCommand(request(session.adultCapability, {
    ...commandBody(session, "RESUME", "after-stop"),
    expectedStateVersion: stopped.value?.stateVersion ?? 0,
  }));
  assert.ok(["AUTHORITY_GENERATION_STALE", "CAPABILITY_REVOKED"].includes(delayed.denialClass ?? ""));
  const operatorDeleted = await handler.deleteSyntheticSession({
    authorization: undefined,
    body: { syntheticSessionId: session.syntheticSessionId },
    url: "/deleteSyntheticSession",
    query: {},
  }, { operatorAuthorized: true });
  assert.equal(operatorDeleted.value?.terminalStatus, "DELETED");
  assert.equal(await store.loadSession(session.syntheticSessionId), undefined);
  assert.equal((await store.loadTombstone(session.syntheticSessionId))?.noResurrection, true);
});

test("explicit deletion writes tombstone, removes active payload and prevents reconnect resurrection", async () => {
  const { handler, store } = harness();
  const session = await issue(handler);
  const deleted = await handler.deleteSyntheticSession({
    authorization: `Bearer ${session.adultCapability}`,
    body: { syntheticSessionId: session.syntheticSessionId },
    url: "/deleteSyntheticSession",
    query: {},
  });
  assert.equal(deleted.value?.terminalStatus, "DELETED");
  assert.equal(await store.loadSession(session.syntheticSessionId), undefined);
  assert.equal((await store.loadTombstone(session.syntheticSessionId))?.noResurrection, true);
  const reconnect = await handler.sessionProjection({
    authorization: `Bearer ${session.adultCapability}`,
    body: { syntheticSessionId: session.syntheticSessionId },
    url: "/sessionProjection",
    query: {},
  });
  assert.equal(reconnect.denialClass, "TOMBSTONE");
});

test("kill switch blocks active session, delayed command, reconnect, cached capability and new session", async () => {
  const { handler } = harness();
  const session = await issue(handler);
  const killed = await handler.setKillSwitch({
    operatorAuthorized: true,
    stagingEnabled: false,
    reasonCode: "SAFETY_STOP",
  });
  assert.equal(killed.value?.stagingEnabled, false);
  const body = commandBody(session, "ACTIVATE", "after-kill");
  assert.equal((await handler.sessionCommand(request(session.adultCapability, body))).denialClass, "KILL_SWITCH_ACTIVE");
  assert.equal((await handler.sessionProjection({
    authorization: `Bearer ${session.childCapability}`,
    body: { syntheticSessionId: session.syntheticSessionId },
    url: "/sessionProjection",
    query: {},
  })).denialClass, "KILL_SWITCH_ACTIVE");
  assert.equal((await handler.issueSyntheticSession({
    operatorAuthorized: true,
    locale: "nb-NO",
  })).denialClass, "KILL_SWITCH_ACTIVE");
  await handler.setKillSwitch({
    operatorAuthorized: true,
    stagingEnabled: true,
    reasonCode: "EXPLICIT_OPERATOR_REOPEN",
  });
  assert.equal((await handler.sessionCommand(request(session.adultCapability, body))).denialClass, "CONTROL_EPOCH_STALE");
});

test("expired capability is rejected", async () => {
  const { handler, setNow } = harness();
  const session = await issue(handler);
  setNow("2026-07-25T10:16:00.000Z");
  assert.equal((await handler.sessionProjection({
    authorization: `Bearer ${session.childCapability}`,
    body: { syntheticSessionId: session.syntheticSessionId },
    url: "/sessionProjection",
    query: {},
  })).denialClass, "CAPABILITY_EXPIRED");
});

test("command budget is enforced without changing state after exhaustion", async () => {
  const { handler } = harness();
  const session = await issue(handler);
  let version = session.adultProjection.stateVersion;
  let kind: "ACTIVATE" | "PAUSE" | "RESUME" = "ACTIVATE";
  for (let index = 0; index < 64; index += 1) {
    const result = await handler.sessionCommand(request(session.adultCapability, {
      ...commandBody(session, kind, `budget-${index}`),
      expectedStateVersion: version,
    }));
    assert.equal(result.ok, true, `command ${index}`);
    version = result.value?.stateVersion ?? version;
    kind = kind === "ACTIVATE" || kind === "RESUME" ? "PAUSE" : "RESUME";
  }
  const exhausted = await handler.sessionCommand(request(session.adultCapability, {
    ...commandBody(session, kind, "budget-exhausted"),
    expectedStateVersion: version,
  }));
  assert.equal(exhausted.denialClass, "COMMAND_BUDGET_EXCEEDED");
});

test("health is coarse and contains no capability, payload or stable identity", async () => {
  const { handler } = harness({ enabled: false });
  const health = await handler.health();
  assert.deepEqual(health.value, {
    serviceHealth: "READY_DISABLED_BY_DEFAULT",
    region: "europe-north1",
    providerActivation: "BLOCKED",
    cloudResources: 0,
    controlEpoch: 7,
    stagingEnabled: false,
  });
  const serialized = JSON.stringify(health);
  assert.equal(serialized.includes("capability"), false);
  assert.equal(serialized.includes("requestBody"), false);
  assert.equal(serialized.includes("stableUID"), false);
});
