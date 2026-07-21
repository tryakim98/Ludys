import type { ClockPort } from "../ports/clock.js";
import type {
  IdGenerationPort,
  LifecycleObservabilityPort,
  LifecycleSessionRepositoryPort,
  ReconnectScenario,
  ReconnectTransportPort,
} from "../ports/session-lifecycle.js";
import {
  createNotCreatedLifecycle,
  transitionLifecycle,
  type LifecycleErrorCode,
  type LifecycleEvent,
  type LifecycleSession,
  type LifecycleState,
  type LifecycleTransitionError,
} from "../core/session-lifecycle.js";
import type { Locale } from "../core/content-contracts.js";

export type LifecycleRole = "CHILD" | "ADULT";

export type LifecycleAction = LifecycleEvent["kind"];
export type LifecycleReconnectScenario = ReconnectScenario;

interface LifecycleViewModelBase {
  readonly role: LifecycleRole;
  readonly locale: Locale;
  readonly state: LifecycleState;
  readonly dataClassification: "SYNTHETIC_TECHNICAL_DRAFT";
  readonly availableActions: readonly LifecycleAction[];
  readonly lastEvent: LifecycleAction | "INITIAL";
  readonly error: LifecycleTransitionError | undefined;
  readonly empty: boolean;
  readonly loading: boolean;
  readonly tombstone: boolean;
}

export interface ChildLifecycleViewModel extends LifecycleViewModelBase {
  readonly role: "CHILD";
  readonly childCue: "SYNTHETIC_CHILD_ONLY" | "SYNTHETIC_HELP_WAIT";
}

export interface AdultLifecycleViewModel extends LifecycleViewModelBase {
  readonly role: "ADULT";
  readonly sessionReference: string | undefined;
  readonly observedVersion: number;
  readonly adultDetail: "SYNTHETIC_ADULT_ONLY" | "SYNTHETIC_HELP_REQUESTED";
}

export type LifecycleViewModel = ChildLifecycleViewModel | AdultLifecycleViewModel;

const ACTIONS_BY_STATE: Record<LifecycleState, readonly LifecycleAction[]> = {
  NOT_CREATED: ["CREATE"],
  CREATING: ["CREATED"],
  READY: ["ACTIVATE", "DELETE"],
  ACTIVE: [
    "REQUEST_HELP",
    "ENTER_WAIT",
    "PAUSE",
    "STOP",
    "DETECT_STALE",
    "DETECT_INVALID",
    "COMPLETE",
  ],
  WAITING: ["RESUME", "PAUSE", "STOP", "COMPLETE"],
  PAUSED: ["RESUME", "STOP", "DELETE"],
  STOPPED: ["RECONNECT", "DELETE"],
  DELETED: ["RECONNECT"],
  STALE: ["BEGIN_RECOVERY", "STOP", "DELETE"],
  INVALID: ["BEGIN_RECOVERY", "STOP", "DELETE"],
  RECOVERING: ["RECOVERY_SUCCEEDED", "RECOVERY_FAILED", "STOP", "DELETE"],
  COMPLETED: ["RECONNECT", "DELETE"],
};

export class SessionLifecycleController {
  #current: LifecycleSession;
  #role: LifecycleRole = "CHILD";
  #lastEvent: LifecycleAction | "INITIAL" = "INITIAL";
  #lastError: LifecycleTransitionError | undefined;

  public constructor(
    locale: Locale,
    private readonly repository: LifecycleSessionRepositoryPort,
    private readonly clock: ClockPort,
    idGenerator: IdGenerationPort,
    private readonly reconnectTransport: ReconnectTransportPort,
    private readonly observability: LifecycleObservabilityPort,
  ) {
    this.#current = createNotCreatedLifecycle({
      sessionId: idGenerator.nextId(),
      locale,
      at: clock.now(),
    });
  }

  public get view(): LifecycleViewModel {
    const common = {
      locale: this.#current.locale,
      state: this.#current.state,
      dataClassification: this.#current.dataClassification,
      availableActions: ACTIONS_BY_STATE[this.#current.state],
      lastEvent: this.#lastEvent,
      error: this.#lastError,
      empty: this.#current.state === "NOT_CREATED",
      loading: this.#current.state === "CREATING",
      tombstone: this.#current.state === "DELETED",
    } as const;

    if (this.#role === "CHILD") {
      return {
        ...common,
        role: "CHILD",
        childCue: this.#current.helpRequested
          ? "SYNTHETIC_HELP_WAIT"
          : this.#current.childProjectionToken,
      };
    }

    return {
      ...common,
      role: "ADULT",
      sessionReference: this.#current.state === "DELETED"
        ? undefined
        : this.#current.sessionId,
      observedVersion: this.#current.version,
      adultDetail: this.#current.helpRequested
        ? "SYNTHETIC_HELP_REQUESTED"
        : this.#current.adultProjectionToken,
    };
  }

  public get sessionId(): string {
    return this.#current.sessionId;
  }

  public selectRole(role: LifecycleRole): LifecycleViewModel {
    this.#role = role;
    return this.view;
  }

  public configureReconnect(
    scenario: ReconnectScenario,
    staleSnapshot?: LifecycleSession,
  ): void {
    const configurable = this.reconnectTransport as ReconnectTransportPort & {
      configure?: (next: ReconnectScenario, stale?: LifecycleSession) => void;
    };
    configurable.configure?.(scenario, staleSnapshot);
  }

  #recordError(code: LifecycleErrorCode, event: LifecycleAction): void {
    this.#lastError = { code, from: this.#current.state, event };
    this.observability.record({
      type: "LIFECYCLE_ERROR",
      sessionId: this.#current.sessionId,
      code,
    });
  }

  #adoptAuthoritativeState(): void {
    const loaded = this.repository.load(this.#current.sessionId);
    if (loaded.kind === "FOUND") this.#current = loaded.state;
    if (loaded.kind === "TOMBSTONE" && this.#current.state !== "DELETED") {
      const deleted = transitionLifecycle(this.#current, {
        kind: "DELETE",
        at: loaded.tombstone.deletedAt,
      });
      if (deleted.accepted) this.#current = deleted.state;
    }
  }

  #handleReconnect(): LifecycleViewModel {
    const response = this.reconnectTransport.reconnect(this.#current.sessionId);
    this.observability.record({
      type: "RECONNECT_RESULT",
      sessionId: this.#current.sessionId,
      result: response.kind,
      latencyMs: response.latencyMs,
    });

    switch (response.kind) {
      case "TOMBSTONE":
        this.#recordError("TOMBSTONE", "RECONNECT");
        this.#adoptAuthoritativeState();
        break;
      case "EMPTY":
        this.#recordError("NOT_FOUND", "RECONNECT");
        break;
      case "DISCONNECTED":
        this.#recordError("DISCONNECTED", "RECONNECT");
        break;
      case "INVALID_PAYLOAD": {
        const invalid = transitionLifecycle(this.#current, {
          kind: "DETECT_INVALID",
          at: this.clock.now(),
        });
        if (invalid.accepted) this.#current = invalid.state;
        this.#recordError("INVALID_PAYLOAD", "RECONNECT");
        break;
      }
      case "STALE_SNAPSHOT":
        this.#recordError("STALE_WRITE_REJECTED", "RECONNECT");
        this.#adoptAuthoritativeState();
        break;
      case "RECOVERY_FAILURE": {
        const failed = transitionLifecycle(this.#current, {
          kind: "RECOVERY_FAILED",
          at: this.clock.now(),
        });
        if (failed.accepted) this.#current = failed.state;
        this.#recordError("RECOVERY_FAILED", "RECONNECT");
        break;
      }
      case "RECOVERY_SUCCESS": {
        const event: LifecycleEvent = this.#current.state === "RECOVERING"
          ? { kind: "RECOVERY_SUCCEEDED", at: this.clock.now() }
          : { kind: "RECONNECT", at: this.clock.now() };
        const recovered = transitionLifecycle(response.state, event);
        if (recovered.accepted) this.#current = recovered.state;
        else this.#recordError(recovered.error?.code ?? "INVALID_TRANSITION", "RECONNECT");
        break;
      }
      case "CONNECTED": {
        if (
          (this.#current.state === "STOPPED" && response.state.state !== "STOPPED")
          || this.#current.state === "DELETED"
        ) {
          this.#recordError("NO_RESURRECTION", "RECONNECT");
          this.#adoptAuthoritativeState();
          break;
        }
        const reconnected = transitionLifecycle(response.state, {
          kind: "RECONNECT",
          at: this.clock.now(),
        });
        if (!reconnected.accepted) {
          this.#recordError(reconnected.error?.code ?? "INVALID_TRANSITION", "RECONNECT");
          break;
        }
        const saved = this.repository.save(reconnected.state);
        if (!saved.accepted) {
          this.#recordError(saved.code, "RECONNECT");
          this.#adoptAuthoritativeState();
        } else {
          this.#current = reconnected.state;
        }
        break;
      }
    }
    return this.view;
  }

  public perform(kind: LifecycleAction): LifecycleViewModel {
    this.#lastEvent = kind;
    this.#lastError = undefined;
    if (kind === "RECONNECT") return this.#handleReconnect();

    const result = transitionLifecycle(this.#current, { kind, at: this.clock.now() });
    if (!result.accepted) {
      this.#recordError(result.error?.code ?? "INVALID_TRANSITION", kind);
      return this.view;
    }

    if (kind === "DELETE") {
      this.#current = result.state;
      this.repository.delete(result.state);
    } else {
      const saved = this.repository.save(result.state);
      if (!saved.accepted) {
        this.#recordError(saved.code, kind);
        this.#adoptAuthoritativeState();
        return this.view;
      }
      this.#current = result.state;
    }

    this.observability.record({
      type: "LIFECYCLE_TRANSITION",
      sessionId: this.#current.sessionId,
      state: this.#current.state,
      version: this.#current.version,
    });
    if (kind === "RECOVERY_FAILED") {
      this.#recordError("RECOVERY_FAILED", kind);
    }
    return this.view;
  }
}
