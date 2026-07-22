export const RELEASE_SCHEMA_VERSION = "wp13.10-release-v1" as const;

export type ReleaseComponent = "APP" | "CONTENT" | "KNOWLEDGE" | "AUDIO";

export interface ComponentRevision {
  readonly component: ReleaseComponent;
  readonly revisionId: string;
  readonly schemaVersion: typeof RELEASE_SCHEMA_VERSION;
  readonly lifecycle: "AVAILABLE" | "WITHDRAWN";
  readonly sha256: string;
}

export interface ComponentVersions {
  readonly appVersion: string;
  readonly contentReleaseId: string;
  readonly knowledgeReleaseId: string;
  readonly audioReleaseId: string;
  readonly schemaVersion: typeof RELEASE_SCHEMA_VERSION;
}

export interface RollbackRecord {
  readonly sequence: number;
  readonly component: ReleaseComponent;
  readonly fromRevisionId: string;
  readonly toRevisionId: string;
  readonly at: string;
  readonly reason: "LOCAL_SYNTHETIC_ROLLBACK" | "CONTROLLED_RESTORE";
}

export interface LocalReleaseState {
  readonly active: ComponentVersions;
  readonly catalog: readonly ComponentRevision[];
  readonly history: readonly RollbackRecord[];
  readonly productionDeploymentAuthorized: false;
  readonly externalReceipts: 0;
}

export type RollbackOutcome =
  | { readonly accepted: true; readonly state: LocalReleaseState; readonly record: RollbackRecord }
  | { readonly accepted: false; readonly state: LocalReleaseState; readonly reason: "UNKNOWN_REVISION" | "WITHDRAWN_REVISION" | "INCOMPATIBLE_SCHEMA" | "NO_CHANGE" };

function activeRevision(state: LocalReleaseState, component: ReleaseComponent): string {
  return {
    APP: state.active.appVersion,
    CONTENT: state.active.contentReleaseId,
    KNOWLEDGE: state.active.knowledgeReleaseId,
    AUDIO: state.active.audioReleaseId,
  }[component];
}

function withRevision(active: ComponentVersions, component: ReleaseComponent, revisionId: string): ComponentVersions {
  switch (component) {
    case "APP": return { ...active, appVersion: revisionId };
    case "CONTENT": return { ...active, contentReleaseId: revisionId };
    case "KNOWLEDGE": return { ...active, knowledgeReleaseId: revisionId };
    case "AUDIO": return { ...active, audioReleaseId: revisionId };
  }
}

export function rollbackComponent(
  state: LocalReleaseState,
  component: ReleaseComponent,
  targetRevisionId: string,
  at: string,
  reason: RollbackRecord["reason"] = "LOCAL_SYNTHETIC_ROLLBACK",
): RollbackOutcome {
  const current = activeRevision(state, component);
  if (current === targetRevisionId) return { accepted: false, state, reason: "NO_CHANGE" };
  const target = state.catalog.find((revision) => revision.component === component && revision.revisionId === targetRevisionId);
  if (target === undefined) return { accepted: false, state, reason: "UNKNOWN_REVISION" };
  if (target.lifecycle === "WITHDRAWN") return { accepted: false, state, reason: "WITHDRAWN_REVISION" };
  if (target.schemaVersion !== state.active.schemaVersion) return { accepted: false, state, reason: "INCOMPATIBLE_SCHEMA" };
  const record: RollbackRecord = {
    sequence: state.history.length + 1,
    component,
    fromRevisionId: current,
    toRevisionId: targetRevisionId,
    at,
    reason,
  };
  return {
    accepted: true,
    state: {
      ...state,
      active: withRevision(state.active, component, targetRevisionId),
      history: [...state.history, record],
    },
    record,
  };
}

export function validateLocalReleaseState(state: LocalReleaseState): string[] {
  const errors: string[] = [];
  if (state.active.schemaVersion !== RELEASE_SCHEMA_VERSION) errors.push("unsupported release schema");
  if (state.productionDeploymentAuthorized !== false) errors.push("production deployment must remain unauthorized");
  if (state.externalReceipts !== 0) errors.push("external receipts must remain zero");
  const active = [
    ["APP", state.active.appVersion],
    ["CONTENT", state.active.contentReleaseId],
    ["KNOWLEDGE", state.active.knowledgeReleaseId],
    ["AUDIO", state.active.audioReleaseId],
  ] as const;
  for (const [component, revisionId] of active) {
    const revision = state.catalog.find((item) => item.component === component && item.revisionId === revisionId);
    if (revision === undefined) errors.push(`${component} active revision is missing`);
    else if (revision.lifecycle !== "AVAILABLE") errors.push(`${component} active revision is withdrawn`);
  }
  for (let index = 0; index < state.history.length; index += 1) {
    if (state.history[index]?.sequence !== index + 1) errors.push("rollback history must be append-only and contiguous");
  }
  return errors;
}
