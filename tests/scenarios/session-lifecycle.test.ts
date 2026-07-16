import test from "node:test";
import assert from "node:assert/strict";
import { FixedClock } from "../../src/adapters/in-memory/fixed-clock.js";
import {
  DeterministicIdGenerator,
  DeterministicReconnectTransport,
  InMemoryLifecycleObservability,
  InMemoryLifecycleRepository,
} from "../../src/adapters/in-memory/in-memory-session-lifecycle.js";
import {
  SessionLifecycleController,
  type LifecycleAction,
} from "../../src/application/session-lifecycle-controller.js";
import { createSessionLifecycleProof } from "../../src/composition/create-session-lifecycle-proof.js";
import {
  DRAFT_TECHNICAL_COPY_MARKER,
  sessionLifecycleTechnicalCopy,
} from "../../src/content/prototype/session-lifecycle-copy.js";
import {
  SYNTHETIC_DATA_CLASSIFICATION,
  createNotCreatedLifecycle,
  transitionLifecycle,
  type LifecycleSession,
} from "../../src/core/session-lifecycle.js";
import { renderSessionLifecycleMarkup } from "../../src/ui/browser/session-lifecycle-templates.js";

const T0 = "2026-07-16T12:00:00.000Z";

function perform(controller: SessionLifecycleController, actions: readonly LifecycleAction[]): void {
  for (const action of actions) {
    const view = controller.perform(action);
    assert.equal(view.error, undefined, `${action} should be accepted`);
  }
}

function stateAt(kind: "READY" | "ACTIVE" | "STOPPED"): LifecycleSession {
  let state = createNotCreatedLifecycle({
    sessionId: "synthetic-wp13-7a-adapter-0001",
    locale: "nb-NO",
    at: T0,
  });
  for (const event of ["CREATE", "CREATED"] as const) {
    state = transitionLifecycle(state, { kind: event, at: T0 }).state;
  }
  if (kind === "READY") return state;
  state = transitionLifecycle(state, { kind: "ACTIVATE", at: T0 }).state;
  if (kind === "ACTIVE") return state;
  return transitionLifecycle(state, { kind: "STOP", at: T0 }).state;
}

test("full synthetic create, active, WAIT, pause, resume and completion scenario", () => {
  const { controller } = createSessionLifecycleProof("nb-NO");
  perform(controller, ["CREATE", "CREATED", "ACTIVATE", "REQUEST_HELP"]);
  assert.equal(controller.view.state, "WAITING");
  perform(controller, ["PAUSE", "RESUME", "RESUME", "COMPLETE"]);
  assert.equal(controller.view.state, "COMPLETED");
});

test("reconnect after STOP keeps the stopped projection", () => {
  const { controller } = createSessionLifecycleProof("nb-NO");
  perform(controller, ["CREATE", "CREATED", "ACTIVATE", "STOP", "RECONNECT"]);
  assert.equal(controller.view.state, "STOPPED");
  assert.equal(controller.view.error, undefined);
});

test("reconnect after delete returns tombstone and no session content", () => {
  const { controller } = createSessionLifecycleProof("nb-NO");
  perform(controller, ["CREATE", "CREATED", "ACTIVATE", "STOP", "DELETE"]);
  assert.equal(controller.view.state, "DELETED");
  const reconnect = controller.perform("RECONNECT");
  assert.equal(reconnect.state, "DELETED");
  assert.equal(reconnect.error?.code, "TOMBSTONE");
  controller.selectRole("ADULT");
  const adult = controller.view;
  assert.equal(adult.role, "ADULT");
  if (adult.role === "ADULT") assert.equal(adult.sessionReference, undefined);
});

test("child and adult projections expose only role-authorized fields", () => {
  const { controller } = createSessionLifecycleProof("nb-NO");
  perform(controller, ["CREATE", "CREATED", "ACTIVATE", "REQUEST_HELP"]);
  const child = controller.selectRole("CHILD") as unknown as Record<string, unknown>;
  assert.equal("childCue" in child, true);
  assert.equal("adultDetail" in child, false);
  assert.equal("sessionReference" in child, false);
  assert.equal("observedVersion" in child, false);

  const adult = controller.selectRole("ADULT") as unknown as Record<string, unknown>;
  assert.equal("adultDetail" in adult, true);
  assert.equal("sessionReference" in adult, true);
  assert.equal("childCue" in adult, false);
});

test("invalid controller transition is visible, typed and state-preserving", () => {
  const { controller } = createSessionLifecycleProof("nb-NO");
  const before = controller.view;
  const after = controller.perform("ACTIVATE");
  assert.equal(after.state, before.state);
  assert.equal(after.error?.code, "INVALID_TRANSITION");
  assert.equal(after.error?.event, "ACTIVATE");
});

test("stale snapshots cannot overwrite newer STOP or DELETE", () => {
  const repository = new InMemoryLifecycleRepository();
  const active = stateAt("ACTIVE");
  assert.equal(repository.save(active).accepted, true);
  const stopped = stateAt("STOPPED");
  assert.equal(repository.save(stopped).accepted, true);
  assert.deepEqual(repository.save(active), { accepted: false, code: "STALE_WRITE_REJECTED" });
  assert.deepEqual(
    repository.save({ ...active, version: stopped.version + 100 }),
    { accepted: false, code: "NO_RESURRECTION" },
  );
  const deleted = transitionLifecycle(stopped, { kind: "DELETE", at: T0 }).state;
  repository.delete(deleted);
  assert.deepEqual(repository.save(stopped), { accepted: false, code: "TOMBSTONE" });
});

test("deterministic reconnect adapter simulates latency and every required outcome", () => {
  const repository = new InMemoryLifecycleRepository();
  const ready = stateAt("READY");
  repository.save(ready);
  const transport = new DeterministicReconnectTransport(repository, 75);
  const expected = [
    "CONNECTED",
    "DISCONNECTED",
    "STALE_SNAPSHOT",
    "INVALID_PAYLOAD",
    "RECOVERY_SUCCESS",
    "RECOVERY_FAILURE",
  ] as const;
  for (const scenario of expected) {
    transport.configure(scenario, ready);
    const response = transport.reconnect(ready.sessionId);
    assert.equal(response.kind, scenario);
    assert.equal(response.latencyMs, 75);
  }
  const deleted = transitionLifecycle(ready, { kind: "DELETE", at: T0 }).state;
  repository.delete(deleted);
  transport.configure("CONNECTED");
  assert.equal(transport.reconnect(ready.sessionId).kind, "TOMBSTONE");
});

test("invalid payload and recovery success or failure remain explicit", () => {
  const success = createSessionLifecycleProof("nb-NO");
  perform(success.controller, ["CREATE", "CREATED", "ACTIVATE", "DETECT_STALE", "BEGIN_RECOVERY", "RECOVERY_SUCCEEDED"]);
  assert.equal(success.controller.view.state, "ACTIVE");

  const failure = createSessionLifecycleProof("nb-NO");
  perform(failure.controller, ["CREATE", "CREATED", "ACTIVATE", "DETECT_INVALID", "BEGIN_RECOVERY"]);
  const failed = failure.controller.perform("RECOVERY_FAILED");
  assert.equal(failed.state, "INVALID");
  assert.equal(failed.error?.code, "RECOVERY_FAILED");
});

test("transport invalid payload creates visible INVALID view without network", () => {
  const repository = new InMemoryLifecycleRepository();
  const transport = new DeterministicReconnectTransport(repository);
  const observability = new InMemoryLifecycleObservability();
  const controller = new SessionLifecycleController(
    "nb-NO",
    repository,
    new FixedClock(T0),
    new DeterministicIdGenerator(),
    transport,
    observability,
  );
  perform(controller, ["CREATE", "CREATED", "ACTIVATE"]);
  transport.configure("INVALID_PAYLOAD");
  const invalid = controller.perform("RECONNECT");
  assert.equal(invalid.state, "INVALID");
  assert.equal(invalid.error?.code, "INVALID_PAYLOAD");
  assert.ok(observability.signals.some((signal) => signal.type === "RECONNECT_RESULT"));
});

test("all lifecycle demo data and BM/NN markup are explicitly synthetic drafts", () => {
  for (const locale of ["nb-NO", "nn-NO"] as const) {
    const { controller } = createSessionLifecycleProof(locale);
    const view = controller.view;
    assert.equal(view.dataClassification, SYNTHETIC_DATA_CLASSIFICATION);
    assert.equal(sessionLifecycleTechnicalCopy[locale].marker, DRAFT_TECHNICAL_COPY_MARKER);
    const markup = renderSessionLifecycleMarkup(
      view,
      sessionLifecycleTechnicalCopy[locale],
      locale,
    );
    assert.match(markup, /SYNTHETIC_TECHNICAL_DRAFT/);
    assert.match(markup, /DRAFT_TECHNICAL_COPY/);
    assert.match(markup, /syntetisk/i);
  }
});
