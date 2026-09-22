import type { Locale } from "../core/content-contracts.js";
import {
  applySyntheticStagingCommand,
  createSyntheticStagingAggregate,
  deleteSyntheticStagingAggregate,
  projectSyntheticStaging,
  SYNTHETIC_STAGING_RELEASE_ID,
  SYNTHETIC_STAGING_SCHEMA_VERSION,
  type AdultSyntheticStagingProjection,
  type ChildSyntheticStagingProjection,
  type SyntheticStagingAggregate,
  type SyntheticStagingCommandKind,
  type SyntheticStagingProjection,
  type SyntheticStagingRole,
} from "../core/synthetic-staging.js";

export interface SyntheticStagingPreviewView {
  readonly classification: "SYNTHETIC_ONLY";
  readonly productMode: "SINGLE_DEVICE_CANONICAL";
  readonly multiDevice: "OPTIONAL_TECHNICAL_STAGING_PROOF";
  readonly providerStatus: "DISABLED";
  readonly cloudResources: 0;
  readonly capabilityStorage: "MEMORY_ONLY_SIMULATION";
  readonly locale: Locale;
  readonly controlEpoch: number;
  readonly stagingEnabled: boolean;
  readonly child: ChildSyntheticStagingProjection;
  readonly adult: AdultSyntheticStagingProjection;
  readonly tombstone: boolean;
  readonly lastOutcome: string;
  readonly noResurrection: boolean;
}

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

export class SyntheticStagingPreviewController {
  #aggregate: SyntheticStagingAggregate;
  #locale: Locale;
  #controlEpoch = 1;
  #stagingEnabled = true;
  #tombstone = false;
  #lastOutcome = "LOCAL_FIXTURE_READY";
  #noResurrection = true;
  #sequence = 0;

  public constructor(locale: Locale = "nb-NO") {
    this.#locale = locale;
    this.#aggregate = this.#newAggregate(locale);
    this.#apply("ADULT", "ACTIVATE");
    this.#lastOutcome = "LOCAL_FIXTURE_READY";
  }

  #newAggregate(locale: Locale): SyntheticStagingAggregate {
    return createSyntheticStagingAggregate({
      syntheticSessionId: "synthetic-wp13-12b-preview-fixture",
      locale,
      issuedAt: "2026-07-25T00:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
      controlEpoch: this.#controlEpoch,
      releaseIds,
    });
  }

  #apply(role: SyntheticStagingRole, kind: SyntheticStagingCommandKind): void {
    if (!this.#stagingEnabled || this.#tombstone) {
      this.#lastOutcome = this.#tombstone ? "TOMBSTONE_NO_RESURRECTION" : "KILL_SWITCH_ACTIVE";
      return;
    }
    this.#sequence += 1;
    const now = "2026-07-25T00:00:10.000Z";
    const result = applySyntheticStagingCommand(this.#aggregate, {
      commandId: `synthetic-preview-command-${this.#sequence}`,
      expectedVersion: this.#aggregate.lifecycle.version,
      authorityGeneration: this.#aggregate.lifecycle.authorityGeneration,
      issuedAt: now,
      role,
      command: { kind },
    }, now);
    this.#aggregate = result.aggregate;
    this.#lastOutcome = result.denialClass ?? result.outcome;
  }

  public get view(): SyntheticStagingPreviewView {
    const child = this.#tombstone
      ? {
          role: "CHILD",
          terminalStatus: "STOPPED",
          stateVersion: this.#aggregate.lifecycle.version,
          locale: this.#locale,
          wait: false,
          helpPending: false,
          audioStatus: "SILENT",
          canRequestHelp: false,
          canPause: false,
          canStop: false,
        } as const
      : projectSyntheticStaging(this.#aggregate, "CHILD");
    const adult = this.#tombstone
      ? {
          role: "ADULT",
          syntheticSessionId: "DELETED_SYNTHETIC_FIXTURE",
          terminalStatus: "STOPPED",
          stateVersion: this.#aggregate.lifecycle.version,
          locale: this.#locale,
          wait: false,
          adultCard: undefined,
          audioStatus: "SILENT",
          canResume: false,
          canPause: false,
          canStop: false,
        } as const
      : projectSyntheticStaging(this.#aggregate, "ADULT");
    return {
      classification: "SYNTHETIC_ONLY",
      productMode: "SINGLE_DEVICE_CANONICAL",
      multiDevice: "OPTIONAL_TECHNICAL_STAGING_PROOF",
      providerStatus: "DISABLED",
      cloudResources: 0,
      capabilityStorage: "MEMORY_ONLY_SIMULATION",
      locale: this.#locale,
      controlEpoch: this.#controlEpoch,
      stagingEnabled: this.#stagingEnabled,
      child,
      adult,
      tombstone: this.#tombstone,
      lastOutcome: this.#lastOutcome,
      noResurrection: this.#noResurrection,
    };
  }

  public setLocale(locale: Locale): SyntheticStagingPreviewView {
    this.#locale = locale;
    this.#controlEpoch += 1;
    this.#tombstone = false;
    this.#stagingEnabled = true;
    this.#aggregate = this.#newAggregate(locale);
    this.#apply("ADULT", "ACTIVATE");
    this.#lastOutcome = "NEW_LOCALE_FIXTURE_CREATED";
    return this.view;
  }

  public command(role: SyntheticStagingRole, kind: SyntheticStagingCommandKind): SyntheticStagingPreviewView {
    this.#apply(role, kind);
    return this.view;
  }

  public staleCommand(): SyntheticStagingPreviewView {
    if (this.#tombstone) {
      this.#lastOutcome = "TOMBSTONE_NO_RESURRECTION";
      return this.view;
    }
    const now = "2026-07-25T00:00:10.000Z";
    const result = applySyntheticStagingCommand(this.#aggregate, {
      commandId: "synthetic-preview-stale-command",
      expectedVersion: Math.max(0, this.#aggregate.lifecycle.version - 1),
      authorityGeneration: this.#aggregate.lifecycle.authorityGeneration,
      issuedAt: now,
      role: "CHILD",
      command: { kind: "ENTER_WAIT" },
    }, now);
    this.#lastOutcome = result.denialClass ?? result.outcome;
    return this.view;
  }

  public delete(): SyntheticStagingPreviewView {
    if (this.#tombstone) {
      this.#lastOutcome = "TOMBSTONE";
      return this.view;
    }
    this.#aggregate = deleteSyntheticStagingAggregate(
      this.#aggregate,
      "2026-07-25T00:00:20.000Z",
    );
    this.#tombstone = true;
    this.#lastOutcome = "DELETED_EXPLICITLY";
    this.#noResurrection = true;
    return this.view;
  }

  public reconnect(): SyntheticStagingPreviewView {
    if (this.#tombstone) {
      this.#lastOutcome = "TOMBSTONE_NO_RESURRECTION";
      this.#noResurrection = true;
      return this.view;
    }
    this.#apply("CHILD", "RECONNECT");
    return this.view;
  }

  public killSwitch(): SyntheticStagingPreviewView {
    if (!this.#tombstone && !["STOPPED", "COMPLETED"].includes(this.#aggregate.lifecycle.state)) {
      this.#apply("ADULT", "STOP");
    }
    this.#controlEpoch += 1;
    this.#stagingEnabled = false;
    this.#lastOutcome = "KILL_SWITCH_ACTIVE_AUTHORITY_INVALIDATED";
    this.#noResurrection = true;
    return this.view;
  }
}
