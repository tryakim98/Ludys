import type { SyntheticStagingAggregate } from "../../../../src/core/synthetic-staging.js";
import type {
  CapabilityGrant,
  StagingControlState,
  SyntheticStagingStore,
  SyntheticStagingTombstone,
} from "./authoritative-handler.js";

export class InMemorySyntheticStagingStore implements SyntheticStagingStore {
  readonly #sessions = new Map<string, SyntheticStagingAggregate>();
  readonly #grants = new Map<string, CapabilityGrant>();
  readonly #tombstones = new Map<string, SyntheticStagingTombstone>();
  #control: StagingControlState;

  public constructor(input?: {
    readonly stagingEnabled?: boolean;
    readonly controlEpoch?: number;
    readonly changedAt?: string;
  }) {
    this.#control = {
      controlEpoch: input?.controlEpoch ?? 1,
      stagingEnabled: input?.stagingEnabled ?? true,
      reasonCode: "LOCAL_SYNTHETIC_FIXTURE",
      changedAt: input?.changedAt ?? "2026-07-25T00:00:00.000Z",
    };
  }

  public async loadControl(): Promise<StagingControlState> {
    return this.#control;
  }

  public async saveControl(next: StagingControlState, expectedControlEpoch: number): Promise<boolean> {
    if (this.#control.controlEpoch !== expectedControlEpoch || next.controlEpoch <= expectedControlEpoch) {
      return false;
    }
    this.#control = next;
    return true;
  }

  public async createSession(
    aggregate: SyntheticStagingAggregate,
    grants: readonly CapabilityGrant[],
  ): Promise<boolean> {
    if (this.#sessions.has(aggregate.syntheticSessionId) || this.#tombstones.has(aggregate.syntheticSessionId)) {
      return false;
    }
    this.#sessions.set(aggregate.syntheticSessionId, aggregate);
    for (const grant of grants) this.#grants.set(grant.nonce, grant);
    return true;
  }

  public async loadSession(syntheticSessionId: string): Promise<SyntheticStagingAggregate | undefined> {
    return this.#sessions.get(syntheticSessionId);
  }

  public async loadTombstone(syntheticSessionId: string): Promise<SyntheticStagingTombstone | undefined> {
    return this.#tombstones.get(syntheticSessionId);
  }

  public async loadGrant(nonce: string): Promise<CapabilityGrant | undefined> {
    return this.#grants.get(nonce);
  }

  public async commitCommand(input: {
    readonly expectedStateVersion: number;
    readonly nextAggregate: SyntheticStagingAggregate;
    readonly grantNonce: string;
    readonly nextRemainingCommands: number;
    readonly revokeSessionGrants: boolean;
  }): Promise<boolean> {
    const current = this.#sessions.get(input.nextAggregate.syntheticSessionId);
    const grant = this.#grants.get(input.grantNonce);
    if (
      current === undefined
      || grant === undefined
      || current.lifecycle.version !== input.expectedStateVersion
      || this.#tombstones.has(input.nextAggregate.syntheticSessionId)
    ) return false;
    this.#sessions.set(input.nextAggregate.syntheticSessionId, input.nextAggregate);
    this.#grants.set(input.grantNonce, {
      ...grant,
      remainingCommands: input.nextRemainingCommands,
      revoked: input.revokeSessionGrants,
    });
    if (input.revokeSessionGrants) {
      for (const [nonce, candidate] of this.#grants) {
        if (candidate.syntheticSessionId === input.nextAggregate.syntheticSessionId) {
          this.#grants.set(nonce, { ...candidate, revoked: true });
        }
      }
    }
    return true;
  }

  public async deleteSession(
    aggregate: SyntheticStagingAggregate,
    tombstone: SyntheticStagingTombstone,
  ): Promise<boolean> {
    if (this.#tombstones.has(aggregate.syntheticSessionId)) return false;
    const current = this.#sessions.get(aggregate.syntheticSessionId);
    if (current === undefined || current.lifecycle.version + 1 !== aggregate.lifecycle.version) return false;
    this.#sessions.delete(aggregate.syntheticSessionId);
    this.#tombstones.set(aggregate.syntheticSessionId, tombstone);
    for (const [nonce, grant] of this.#grants) {
      if (grant.syntheticSessionId === aggregate.syntheticSessionId) {
        this.#grants.set(nonce, { ...grant, revoked: true });
      }
    }
    return true;
  }
}
