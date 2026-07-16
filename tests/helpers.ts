import { createInitialSession, transition, type SessionState } from "../src/core/state.js";
import { humanFirstBundleNb } from "../src/content/fixtures/bm/human-first-bundle.js";

export const T0 = "2026-07-14T12:00:00.000Z";

export function readyState(): SessionState {
  let state = createInitialSession({
    sessionId: "synthetic-session-001",
    locale: "nb-NO",
    contentReleaseId: humanFirstBundleNb.releaseId,
  });
  state = transition(state, { kind: "START", at: T0 }).state;
  state = transition(state, { kind: "ORIENTATION_COMPLETE", at: T0 }).state;
  return state;
}

export function childActingState(): SessionState {
  return transition(readyState(), {
    kind: "BEGIN_CHILD_ACTION",
    at: T0,
    attemptId: "attempt-001",
  }).state;
}

export { humanFirstBundleNb };
