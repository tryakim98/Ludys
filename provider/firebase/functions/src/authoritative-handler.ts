import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Locale } from "../../../../src/core/content-contracts.js";
import {
  applySyntheticStagingCommand,
  createSyntheticStagingAggregate,
  deleteSyntheticStagingAggregate,
  projectSyntheticStaging,
  SYNTHETIC_STAGING_RELEASE_ID,
  type SyntheticStagingAggregate,
  type SyntheticStagingCommandEnvelope,
  type SyntheticStagingProjection,
  type SyntheticStagingReleaseIds,
  type SyntheticStagingRole,
} from "../../../../src/core/synthetic-staging.js";

export const CAPABILITY_VERSION = "wp13.12b-capability-v1" as const;
export const CAPABILITY_MAX_LIFETIME_MS = 15 * 60 * 1000;
export const DEFAULT_COMMAND_BUDGET = 64;
export const EXTERNAL_STAGING_EXPIRY_AT =
  "2027-01-25T00:00:00.000Z" as const;
export type SyntheticStagingRuntimePhase =
  | "LOCAL_EMULATOR_PROOF"
  | "EXTERNAL_SYNTHETIC_STAGING";

export interface StagingControlState {
  readonly controlEpoch: number;
  readonly stagingEnabled: boolean;
  readonly reasonCode: string;
  readonly changedAt: string;
}

export interface CapabilityClaims {
  readonly capabilityVersion: typeof CAPABILITY_VERSION;
  readonly sessionBinding: string;
  readonly roleBinding: SyntheticStagingRole;
  readonly authorityGenerationBinding: number;
  readonly releaseBinding: typeof SYNTHETIC_STAGING_RELEASE_ID;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly controlEpoch: number;
  readonly commandBudget: number;
  readonly nonce: string;
}

export interface CapabilityGrant {
  readonly nonce: string;
  readonly syntheticSessionId: string;
  readonly role: SyntheticStagingRole;
  readonly expiresAt: string;
  readonly remainingCommands: number;
  readonly revoked: boolean;
}

export interface SyntheticStagingTombstone {
  readonly syntheticSessionId: string;
  readonly terminalStateVersion: number;
  readonly terminalAuthorityGeneration: number;
  readonly controlEpoch: number;
  readonly deletedAt: string;
  readonly noResurrection: true;
}

export interface SyntheticStagingStore {
  loadControl(): Promise<StagingControlState>;
  saveControl(next: StagingControlState, expectedControlEpoch: number): Promise<boolean>;
  createSession(
    aggregate: SyntheticStagingAggregate,
    grants: readonly CapabilityGrant[],
  ): Promise<boolean>;
  loadSession(syntheticSessionId: string): Promise<SyntheticStagingAggregate | undefined>;
  loadTombstone(syntheticSessionId: string): Promise<SyntheticStagingTombstone | undefined>;
  loadGrant(nonce: string): Promise<CapabilityGrant | undefined>;
  commitCommand(input: {
    readonly expectedStateVersion: number;
    readonly nextAggregate: SyntheticStagingAggregate;
    readonly grantNonce: string;
    readonly nextRemainingCommands: number;
    readonly revokeSessionGrants: boolean;
  }): Promise<boolean>;
  deleteSession(
    aggregate: SyntheticStagingAggregate,
    tombstone: SyntheticStagingTombstone,
  ): Promise<boolean>;
}

export interface HandlerRequest<TBody> {
  readonly authorization: string | undefined;
  readonly body: TBody;
  readonly url: string;
  readonly query: Readonly<Record<string, string | readonly string[] | undefined>>;
}

export interface HandlerResult<T> {
  readonly ok: boolean;
  readonly status: number;
  readonly denialClass: string | undefined;
  readonly value: T | undefined;
}

export interface IssueSyntheticSessionResult {
  readonly syntheticSessionId: string;
  readonly childCapability: string;
  readonly adultCapability: string;
  readonly expiresAt: string;
  readonly childProjection: SyntheticStagingProjection;
  readonly adultProjection: SyntheticStagingProjection;
}

export interface SessionCommandBody {
  readonly syntheticSessionId: string;
  readonly commandId: string;
  readonly expectedStateVersion: number;
  readonly authorityGeneration: number;
  readonly issuedAt: string;
  readonly command: SyntheticStagingCommandEnvelope["command"];
}

const PROHIBITED_CAPABILITY_KEYS = new Set([
  "authorization",
  "capability",
  "capabilityToken",
  "token",
]);

function accepted<T>(value: T, status = 200): HandlerResult<T> {
  return { ok: true, status, denialClass: undefined, value };
}

function denied<T>(status: number, denialClass: string): HandlerResult<T> {
  return { ok: false, status, denialClass, value: undefined };
}

function containsProhibitedCapabilityField(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsProhibitedCapabilityField);
  return Object.entries(value).some(([key, nested]) => (
    PROHIBITED_CAPABILITY_KEYS.has(key) || containsProhibitedCapabilityField(nested)
  ));
}

function safeJson(value: unknown): string {
  return JSON.stringify(value);
}

function encode(value: unknown): string {
  return Buffer.from(safeJson(value), "utf8").toString("base64url");
}

function parseIso(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function validProjectId(value: string): boolean {
  return /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value);
}

export class SyntheticStagingAuthoritativeHandler {
  public constructor(
    private readonly store: SyntheticStagingStore,
    private readonly hmacKey: Uint8Array,
    private readonly releaseIds: SyntheticStagingReleaseIds,
    private readonly options: {
      readonly sessionIssuanceEnabled: boolean;
      readonly region: "europe-north1";
      readonly projectId: string;
      readonly runtimePhase: SyntheticStagingRuntimePhase;
      readonly previewIngressReady: boolean;
      readonly now?: () => string;
    },
  ) {
    if (hmacKey.byteLength < 32) throw new Error("CAPABILITY_HMAC_KEY_TOO_SHORT");
    if (!validProjectId(options.projectId)) throw new Error("INVALID_SYNTHETIC_PROJECT_ID_FORMAT");
  }

  #now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }

  #externalStagingTermExpired(now: string): boolean {
    if (this.options.runtimePhase !== "EXTERNAL_SYNTHETIC_STAGING") {
      return false;
    }
    const instant = parseIso(now);
    return instant === undefined
      || instant >= Date.parse(EXTERNAL_STAGING_EXPIRY_AT);
  }

  #sign(encodedClaims: string): string {
    return createHmac("sha256", this.hmacKey).update(encodedClaims).digest("base64url");
  }

  #issueCapability(claims: CapabilityClaims): string {
    const encodedClaims = encode(claims);
    return `${encodedClaims}.${this.#sign(encodedClaims)}`;
  }

  #verifyCapability(token: string): CapabilityClaims | undefined {
    const segments = token.split(".");
    if (segments.length !== 2) return undefined;
    const [encodedClaims, suppliedSignature] = segments;
    if (encodedClaims === undefined || suppliedSignature === undefined) return undefined;
    const expected = Buffer.from(this.#sign(encodedClaims), "utf8");
    const supplied = Buffer.from(suppliedSignature, "utf8");
    if (expected.byteLength !== supplied.byteLength || !timingSafeEqual(expected, supplied)) return undefined;
    try {
      const parsed = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as Partial<CapabilityClaims>;
      if (
        parsed.capabilityVersion !== CAPABILITY_VERSION
        || (parsed.roleBinding !== "CHILD" && parsed.roleBinding !== "ADULT")
        || parsed.releaseBinding !== SYNTHETIC_STAGING_RELEASE_ID
        || typeof parsed.sessionBinding !== "string"
        || typeof parsed.authorityGenerationBinding !== "number"
        || typeof parsed.issuedAt !== "string"
        || typeof parsed.expiresAt !== "string"
        || typeof parsed.controlEpoch !== "number"
        || typeof parsed.commandBudget !== "number"
        || typeof parsed.nonce !== "string"
      ) return undefined;
      return parsed as CapabilityClaims;
    } catch {
      return undefined;
    }
  }

  #bearer<TBody>(request: HandlerRequest<TBody>): string | undefined {
    if (
      containsProhibitedCapabilityField(request.body)
      || Object.keys(request.query).some((key) => PROHIBITED_CAPABILITY_KEYS.has(key))
      || /(?:capability|token|authorization)=/iu.test(request.url)
    ) return undefined;
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u.exec(request.authorization ?? "");
    return match?.[1];
  }

  async #authorize<TBody>(
    request: HandlerRequest<TBody>,
    expectedSessionId: string,
  ): Promise<{
    readonly claims: CapabilityClaims;
    readonly grant: CapabilityGrant;
    readonly aggregate: SyntheticStagingAggregate;
  } | HandlerResult<never>> {
    const now = this.#now();
    if (this.#externalStagingTermExpired(now)) {
      return denied(503, "STAGING_TERM_EXPIRED");
    }
    const token = this.#bearer(request);
    if (token === undefined) return denied(401, "BEARER_ONLY");
    const claims = this.#verifyCapability(token);
    if (claims === undefined) return denied(401, "CAPABILITY_INVALID");
    if (
      parseIso(claims.expiresAt) === undefined
      || parseIso(claims.issuedAt) === undefined
      || Date.parse(claims.expiresAt) <= Date.parse(now)
    ) return denied(401, "CAPABILITY_EXPIRED");
    if (claims.sessionBinding !== expectedSessionId) return denied(403, "SESSION_BINDING_MISMATCH");
    const control = await this.store.loadControl();
    if (!control.stagingEnabled) return denied(503, "KILL_SWITCH_ACTIVE");
    if (claims.controlEpoch !== control.controlEpoch) return denied(401, "CONTROL_EPOCH_STALE");
    const tombstone = await this.store.loadTombstone(expectedSessionId);
    if (tombstone !== undefined) return denied(410, "TOMBSTONE");
    const aggregate = await this.store.loadSession(expectedSessionId);
    if (aggregate === undefined) return denied(404, "SESSION_NOT_FOUND");
    if (aggregate.releaseIds.stagingProviderReleaseId !== claims.releaseBinding) {
      return denied(409, "RELEASE_BINDING_MISMATCH");
    }
    if (aggregate.lifecycle.authorityGeneration !== claims.authorityGenerationBinding) {
      return denied(409, "AUTHORITY_GENERATION_STALE");
    }
    const grant = await this.store.loadGrant(claims.nonce);
    if (
      grant === undefined
      || grant.revoked
      || grant.syntheticSessionId !== expectedSessionId
      || grant.role !== claims.roleBinding
      || grant.expiresAt !== claims.expiresAt
    ) return denied(401, "CAPABILITY_REVOKED");
    return { claims, grant, aggregate };
  }

  public async issueSyntheticSession(input: {
    readonly operatorAuthorized: boolean;
    readonly locale: Locale;
    readonly lifetimeMs?: number;
  }): Promise<HandlerResult<IssueSyntheticSessionResult>> {
    const issuedAt = this.#now();
    if (this.#externalStagingTermExpired(issuedAt)) {
      return denied(503, "STAGING_TERM_EXPIRED");
    }
    if (!this.options.sessionIssuanceEnabled) return denied(503, "SESSION_ISSUANCE_DISABLED");
    if (
      this.options.runtimePhase === "EXTERNAL_SYNTHETIC_STAGING"
      && !this.options.previewIngressReady
    ) return denied(503, "PREVIEW_INGRESS_NOT_READY");
    if (!input.operatorAuthorized) return denied(403, "OPERATOR_AUTHORIZATION_REQUIRED");
    const control = await this.store.loadControl();
    if (!control.stagingEnabled) return denied(503, "KILL_SWITCH_ACTIVE");
    const lifetimeMs = input.lifetimeMs ?? CAPABILITY_MAX_LIFETIME_MS;
    if (!Number.isInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > CAPABILITY_MAX_LIFETIME_MS) {
      return denied(400, "CAPABILITY_LIFETIME_INVALID");
    }
    const expiresAt = new Date(Date.parse(issuedAt) + lifetimeMs).toISOString();
    const syntheticSessionId = `synthetic-wp13-12b-${randomBytes(16).toString("base64url")}`;
    const aggregate = createSyntheticStagingAggregate({
      syntheticSessionId,
      locale: input.locale,
      issuedAt,
      expiresAt,
      controlEpoch: control.controlEpoch,
      releaseIds: this.releaseIds,
    });
    const createRoleGrant = (role: SyntheticStagingRole): {
      readonly grant: CapabilityGrant;
      readonly token: string;
    } => {
      const nonce = randomBytes(18).toString("base64url");
      const claims: CapabilityClaims = {
        capabilityVersion: CAPABILITY_VERSION,
        sessionBinding: syntheticSessionId,
        roleBinding: role,
        authorityGenerationBinding: aggregate.lifecycle.authorityGeneration,
        releaseBinding: SYNTHETIC_STAGING_RELEASE_ID,
        issuedAt,
        expiresAt,
        controlEpoch: control.controlEpoch,
        commandBudget: DEFAULT_COMMAND_BUDGET,
        nonce,
      };
      return {
        grant: {
          nonce,
          syntheticSessionId,
          role,
          expiresAt,
          remainingCommands: DEFAULT_COMMAND_BUDGET,
          revoked: false,
        },
        token: this.#issueCapability(claims),
      };
    };
    const child = createRoleGrant("CHILD");
    const adult = createRoleGrant("ADULT");
    if (!await this.store.createSession(aggregate, [child.grant, adult.grant])) {
      return denied(409, "SESSION_CREATE_CONFLICT");
    }
    return accepted({
      syntheticSessionId,
      childCapability: child.token,
      adultCapability: adult.token,
      expiresAt,
      childProjection: projectSyntheticStaging(aggregate, "CHILD"),
      adultProjection: projectSyntheticStaging(aggregate, "ADULT"),
    }, 201);
  }

  public async sessionCommand(
    request: HandlerRequest<SessionCommandBody>,
  ): Promise<HandlerResult<SyntheticStagingProjection>> {
    const authorized = await this.#authorize(request, request.body.syntheticSessionId);
    if ("ok" in authorized) return authorized;
    if (authorized.grant.remainingCommands < 1) return denied(429, "COMMAND_BUDGET_EXCEEDED");
    const result = applySyntheticStagingCommand(authorized.aggregate, {
      commandId: request.body.commandId,
      expectedVersion: request.body.expectedStateVersion,
      authorityGeneration: request.body.authorityGeneration,
      issuedAt: request.body.issuedAt,
      role: authorized.claims.roleBinding,
      command: request.body.command,
    }, this.#now());
    if (result.outcome !== "APPLIED") {
      const status = result.outcome === "DUPLICATE_COMMAND" ? 409
        : result.outcome === "STALE_VERSION" || result.outcome === "STALE_AUTHORITY" ? 409
          : result.outcome === "DELAYED_COMMAND" ? 408
            : 422;
      return denied(status, result.denialClass ?? result.outcome);
    }
    const terminal = result.aggregate.lifecycle.state === "STOPPED";
    const projection = projectSyntheticStaging(result.aggregate, authorized.claims.roleBinding);
    const committed = await this.store.commitCommand({
      expectedStateVersion: authorized.aggregate.lifecycle.version,
      nextAggregate: result.aggregate,
      grantNonce: authorized.grant.nonce,
      nextRemainingCommands: authorized.grant.remainingCommands - 1,
      revokeSessionGrants: terminal,
    });
    return committed ? accepted(projection) : denied(409, "ATOMIC_STATE_CONFLICT");
  }

  public async sessionProjection(
    request: HandlerRequest<{ readonly syntheticSessionId: string }>,
  ): Promise<HandlerResult<SyntheticStagingProjection>> {
    const authorized = await this.#authorize(request, request.body.syntheticSessionId);
    if ("ok" in authorized) return authorized;
    return accepted(projectSyntheticStaging(authorized.aggregate, authorized.claims.roleBinding));
  }

  public async deleteSyntheticSession(
    request: HandlerRequest<{ readonly syntheticSessionId: string }>,
    options: { readonly operatorAuthorized?: boolean } = {},
  ): Promise<HandlerResult<{ readonly terminalStatus: "DELETED"; readonly audioStatus: "SILENT" }>> {
    let aggregate: SyntheticStagingAggregate;
    let controlEpoch: number;
    if (options.operatorAuthorized === true) {
      if (
        containsProhibitedCapabilityField(request.body)
        || Object.keys(request.query).some((key) => PROHIBITED_CAPABILITY_KEYS.has(key))
        || /(?:capability|token|authorization)=/iu.test(request.url)
      ) return denied(400, "CAPABILITY_LOCATION_FORBIDDEN");
      const existingTombstone = await this.store.loadTombstone(request.body.syntheticSessionId);
      if (existingTombstone !== undefined) {
        return accepted({ terminalStatus: "DELETED", audioStatus: "SILENT" });
      }
      const current = await this.store.loadSession(request.body.syntheticSessionId);
      if (current === undefined) return denied(404, "SESSION_NOT_FOUND");
      aggregate = current;
      controlEpoch = (await this.store.loadControl()).controlEpoch;
    } else {
      const authorized = await this.#authorize(request, request.body.syntheticSessionId);
      if ("ok" in authorized) return authorized;
      aggregate = authorized.aggregate;
      controlEpoch = authorized.aggregate.controlEpoch;
    }
    const deleted = deleteSyntheticStagingAggregate(aggregate, this.#now());
    const tombstone: SyntheticStagingTombstone = {
      syntheticSessionId: deleted.syntheticSessionId,
      terminalStateVersion: deleted.lifecycle.version,
      terminalAuthorityGeneration: deleted.lifecycle.authorityGeneration,
      controlEpoch,
      deletedAt: deleted.lifecycle.updatedAt,
      noResurrection: true,
    };
    return await this.store.deleteSession(deleted, tombstone)
      ? accepted({ terminalStatus: "DELETED", audioStatus: "SILENT" })
      : denied(409, "DELETE_CONFLICT");
  }

  public async setKillSwitch(input: {
    readonly operatorAuthorized: boolean;
    readonly stagingEnabled: boolean;
    readonly reasonCode: string;
  }): Promise<HandlerResult<StagingControlState>> {
    if (!input.operatorAuthorized) return denied(403, "OPERATOR_AUTHORIZATION_REQUIRED");
    if (!/^[A-Z0-9_]{3,64}$/.test(input.reasonCode)) return denied(400, "REASON_CODE_INVALID");
    const changedAt = this.#now();
    if (
      input.stagingEnabled
      && this.#externalStagingTermExpired(changedAt)
    ) return denied(503, "STAGING_TERM_EXPIRED");
    const current = await this.store.loadControl();
    const next: StagingControlState = {
      controlEpoch: current.controlEpoch + 1,
      stagingEnabled: input.stagingEnabled,
      reasonCode: input.reasonCode,
      changedAt,
    };
    return await this.store.saveControl(next, current.controlEpoch)
      ? accepted(next)
      : denied(409, "CONTROL_UPDATE_CONFLICT");
  }

  public async health(): Promise<HandlerResult<{
    readonly serviceHealth: "READY_DISABLED_BY_DEFAULT" | "READY";
    readonly region: "europe-north1";
    readonly runtimePhase: SyntheticStagingRuntimePhase;
    readonly providerActivation:
      | "LOCAL_EMULATOR_ONLY"
      | "EXTERNAL_SYNTHETIC_STAGING_DISABLED"
      | "EXTERNAL_SYNTHETIC_STAGING_ACTIVE";
    readonly dataScope: "SYNTHETIC_ONLY_NO_PARTICIPANT_DATA";
    readonly studentBeta: "NOT_AUTHORIZED";
    readonly production: "NOT_AUTHORIZED";
    readonly wp13_12c: "BLOCKED";
    readonly controlEpoch: number;
    readonly stagingEnabled: boolean;
    readonly ingressReady: boolean;
  }>> {
    const control = await this.store.loadControl();
    const stagingTermExpired =
      this.#externalStagingTermExpired(this.#now());
    const ingressReady = (
      this.options.runtimePhase === "LOCAL_EMULATOR_PROOF"
      || this.options.previewIngressReady
    );
    const externallyActive = (
      this.options.runtimePhase === "EXTERNAL_SYNTHETIC_STAGING"
      && !stagingTermExpired
      && this.options.sessionIssuanceEnabled
      && control.stagingEnabled
      && ingressReady
    );
    return accepted({
      serviceHealth: (
        !stagingTermExpired
        && this.options.sessionIssuanceEnabled
        && control.stagingEnabled
        && ingressReady
      ) ? "READY" : "READY_DISABLED_BY_DEFAULT",
      region: this.options.region,
      runtimePhase: this.options.runtimePhase,
      providerActivation: this.options.runtimePhase === "EXTERNAL_SYNTHETIC_STAGING"
        ? externallyActive
          ? "EXTERNAL_SYNTHETIC_STAGING_ACTIVE"
          : "EXTERNAL_SYNTHETIC_STAGING_DISABLED"
        : "LOCAL_EMULATOR_ONLY",
      dataScope: "SYNTHETIC_ONLY_NO_PARTICIPANT_DATA",
      studentBeta: "NOT_AUTHORIZED",
      production: "NOT_AUTHORIZED",
      wp13_12c: "BLOCKED",
      controlEpoch: control.controlEpoch,
      stagingEnabled: control.stagingEnabled,
      ingressReady,
    });
  }
}
