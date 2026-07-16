import type { SessionState } from "../core/state.js";

export interface SessionPort {
  load(sessionId: string): SessionState | undefined;
  save(state: SessionState): void;
  delete(sessionId: string): void;
}
