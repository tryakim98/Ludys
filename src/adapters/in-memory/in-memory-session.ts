import type { SessionState } from "../../core/state.js";
import type { SessionPort } from "../../ports/session.js";

export class InMemorySession implements SessionPort {
  private readonly states = new Map<string, SessionState>();
  private readonly tombstones = new Set<string>();

  public load(sessionId: string): SessionState | undefined {
    if (this.tombstones.has(sessionId)) {
      return undefined;
    }
    return this.states.get(sessionId);
  }

  public save(state: SessionState): void {
    if (this.tombstones.has(state.sessionId)) {
      throw new Error("Deleted session cannot be saved or resurrected");
    }
    this.states.set(state.sessionId, state);
  }

  public delete(sessionId: string): void {
    this.states.delete(sessionId);
    this.tombstones.add(sessionId);
  }
}
