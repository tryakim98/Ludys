import type {
  LifecycleErrorCode,
  LifecycleSession,
} from "../core/session-lifecycle.js";

export interface LifecycleTombstone {
  readonly sessionId: string;
  readonly dataClassification: "SYNTHETIC_TECHNICAL_DRAFT";
  readonly deletedAt: string;
  readonly terminalVersion: number;
}

export type LifecycleLoadResult =
  | { readonly kind: "EMPTY" }
  | { readonly kind: "FOUND"; readonly state: LifecycleSession }
  | { readonly kind: "TOMBSTONE"; readonly tombstone: LifecycleTombstone };

export type LifecycleSaveResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly code: "STALE_WRITE_REJECTED" | "NO_RESURRECTION" | "TOMBSTONE" };

export interface LifecycleSessionRepositoryPort {
  load(sessionId: string): LifecycleLoadResult;
  save(state: LifecycleSession): LifecycleSaveResult;
  delete(state: LifecycleSession): LifecycleTombstone;
}

export interface IdGenerationPort {
  nextId(): string;
}

export type ReconnectScenario =
  | "CONNECTED"
  | "DISCONNECTED"
  | "STALE_SNAPSHOT"
  | "INVALID_PAYLOAD"
  | "RECOVERY_SUCCESS"
  | "RECOVERY_FAILURE";

export type ReconnectResponse =
  | { readonly kind: "CONNECTED"; readonly latencyMs: number; readonly state: LifecycleSession }
  | { readonly kind: "STALE_SNAPSHOT"; readonly latencyMs: number; readonly state: LifecycleSession }
  | { readonly kind: "TOMBSTONE"; readonly latencyMs: number; readonly tombstone: LifecycleTombstone }
  | { readonly kind: "EMPTY"; readonly latencyMs: number }
  | { readonly kind: "DISCONNECTED"; readonly latencyMs: number }
  | { readonly kind: "INVALID_PAYLOAD"; readonly latencyMs: number }
  | { readonly kind: "RECOVERY_SUCCESS"; readonly latencyMs: number; readonly state: LifecycleSession }
  | { readonly kind: "RECOVERY_FAILURE"; readonly latencyMs: number };

export interface ReconnectTransportPort {
  reconnect(sessionId: string): ReconnectResponse;
}

export type LifecycleSignal =
  | {
      readonly type: "LIFECYCLE_TRANSITION";
      readonly sessionId: string;
      readonly state: LifecycleSession["state"];
      readonly version: number;
    }
  | {
      readonly type: "LIFECYCLE_ERROR";
      readonly sessionId: string;
      readonly code: LifecycleErrorCode;
    }
  | {
      readonly type: "RECONNECT_RESULT";
      readonly sessionId: string;
      readonly result: ReconnectResponse["kind"];
      readonly latencyMs: number;
    };

export interface LifecycleObservabilityPort {
  record(signal: LifecycleSignal): void;
}
