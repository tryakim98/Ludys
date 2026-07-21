import type { LifecycleSession } from "../../core/session-lifecycle.js";
import type {
  IdGenerationPort,
  LifecycleLoadResult,
  LifecycleObservabilityPort,
  LifecycleSaveResult,
  LifecycleSessionRepositoryPort,
  LifecycleSignal,
  LifecycleTombstone,
  ReconnectResponse,
  ReconnectScenario,
  ReconnectTransportPort,
} from "../../ports/session-lifecycle.js";

export class InMemoryLifecycleRepository implements LifecycleSessionRepositoryPort {
  readonly #states = new Map<string, LifecycleSession>();
  readonly #tombstones = new Map<string, LifecycleTombstone>();

  public load(sessionId: string): LifecycleLoadResult {
    const tombstone = this.#tombstones.get(sessionId);
    if (tombstone !== undefined) return { kind: "TOMBSTONE", tombstone };
    const state = this.#states.get(sessionId);
    return state === undefined ? { kind: "EMPTY" } : { kind: "FOUND", state };
  }

  public save(state: LifecycleSession): LifecycleSaveResult {
    if (this.#tombstones.has(state.sessionId)) {
      return { accepted: false, code: "TOMBSTONE" };
    }
    const current = this.#states.get(state.sessionId);
    if (current !== undefined) {
      if (state.version < current.version) {
        return { accepted: false, code: "STALE_WRITE_REJECTED" };
      }
      if (
        current.state === "STOPPED"
        && state.state !== "STOPPED"
        && state.state !== "DELETED"
      ) {
        return { accepted: false, code: "NO_RESURRECTION" };
      }
    }
    if (state.state === "DELETED") {
      return { accepted: false, code: "TOMBSTONE" };
    }
    this.#states.set(state.sessionId, state);
    return { accepted: true };
  }

  public delete(state: LifecycleSession): LifecycleTombstone {
    const existing = this.#tombstones.get(state.sessionId);
    if (existing !== undefined) return existing;
    this.#states.delete(state.sessionId);
    const tombstone: LifecycleTombstone = {
      sessionId: state.sessionId,
      dataClassification: state.dataClassification,
      deletedAt: state.updatedAt,
      terminalVersion: state.version,
    };
    this.#tombstones.set(state.sessionId, tombstone);
    return tombstone;
  }
}

export class DeterministicIdGenerator implements IdGenerationPort {
  #sequence = 0;

  public constructor(private readonly prefix = "synthetic-wp13-7a-session") {}

  public nextId(): string {
    this.#sequence += 1;
    return `${this.prefix}-${String(this.#sequence).padStart(4, "0")}`;
  }
}

export class InMemoryLifecycleObservability implements LifecycleObservabilityPort {
  public readonly signals: LifecycleSignal[] = [];

  public record(signal: LifecycleSignal): void {
    this.signals.push(signal);
  }
}

export class DeterministicReconnectTransport implements ReconnectTransportPort {
  #scenario: ReconnectScenario = "CONNECTED";
  #staleSnapshot: LifecycleSession | undefined;

  public constructor(
    private readonly repository: LifecycleSessionRepositoryPort,
    public readonly latencyMs = 40,
  ) {}

  public configure(
    scenario: ReconnectScenario,
    staleSnapshot?: LifecycleSession,
  ): void {
    this.#scenario = scenario;
    this.#staleSnapshot = staleSnapshot;
  }

  public reconnect(sessionId: string): ReconnectResponse {
    if (this.#scenario === "DISCONNECTED") {
      return { kind: "DISCONNECTED", latencyMs: this.latencyMs };
    }
    if (this.#scenario === "INVALID_PAYLOAD") {
      return { kind: "INVALID_PAYLOAD", latencyMs: this.latencyMs };
    }
    if (this.#scenario === "RECOVERY_FAILURE") {
      return { kind: "RECOVERY_FAILURE", latencyMs: this.latencyMs };
    }

    const loaded = this.repository.load(sessionId);
    if (loaded.kind === "TOMBSTONE") {
      return { kind: "TOMBSTONE", latencyMs: this.latencyMs, tombstone: loaded.tombstone };
    }
    if (loaded.kind === "EMPTY") {
      return { kind: "EMPTY", latencyMs: this.latencyMs };
    }
    if (this.#scenario === "STALE_SNAPSHOT") {
      return {
        kind: "STALE_SNAPSHOT",
        latencyMs: this.latencyMs,
        state: this.#staleSnapshot ?? loaded.state,
      };
    }
    if (this.#scenario === "RECOVERY_SUCCESS") {
      return { kind: "RECOVERY_SUCCESS", latencyMs: this.latencyMs, state: loaded.state };
    }
    return { kind: "CONNECTED", latencyMs: this.latencyMs, state: loaded.state };
  }
}
