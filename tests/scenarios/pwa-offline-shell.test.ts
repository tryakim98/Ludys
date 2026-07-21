import assert from "node:assert/strict";
import test from "node:test";
import { createSyntheticAppNavigation } from "../../src/composition/create-synthetic-app-navigation.js";
import {
  isSafePwaUpdateState,
  pwaStatusCopy,
} from "../../src/ui/browser/pwa-status.js";

test("BM and NN PWA status bundles are complete, reviewed and never claim sync", () => {
  assert.deepEqual(Object.keys(pwaStatusCopy).sort(), ["nb-NO", "nn-NO"]);
  for (const copy of Object.values(pwaStatusCopy)) {
    assert.equal(copy.humanReviewed, true);
    assert.equal(copy.reviewSource, "WP13.7C_SCOPE_2026-07-21");
    assert.match(copy.offline, /lokal|lokale/);
    assert.doesNotMatch(JSON.stringify(copy), /synkroniser(?:t|er|ing pågår)/i);
  }
});

test("updates are available only before start or in terminal session states", () => {
  for (const state of ["NOT_CREATED", "STOPPED", "DELETED", "COMPLETED"] as const) {
    assert.equal(isSafePwaUpdateState(state), true);
  }
  for (const state of ["CREATING", "READY", "ACTIVE", "WAITING", "PAUSED", "STALE", "INVALID", "RECOVERING"] as const) {
    assert.equal(isSafePwaUpdateState(state), false);
  }
});

test("offline shell policy cannot resurrect terminal state or reuse a new session id", () => {
  const { controller } = createSyntheticAppNavigation("nb-NO", "offline-policy-proof");
  controller.createSession();
  controller.selectRole("CHILD");
  controller.finishLoading();
  controller.startActivity();
  const stoppedSessionId = controller.sessionId;
  controller.stop();
  controller.reconnect();
  assert.equal(controller.view.lifecycleState, "STOPPED");
  assert.equal(isSafePwaUpdateState(controller.view.lifecycleState), true);
  controller.deleteSession();
  controller.reconnect();
  assert.equal(controller.view.lifecycleState, "DELETED");
  controller.startNewSession();
  assert.equal(controller.view.lifecycleState, "NOT_CREATED");
  assert.notEqual(controller.sessionId, stoppedSessionId);
});
