import type { SupportAction } from "./actions.js";

export type EvidenceStatus =
  | "PARTICIPATED"
  | "AFTER_MODEL"
  | "GUIDED"
  | "SUPPORTED_RETRY"
  | "INDEPENDENT"
  | "NEAR_TRANSFER"
  | "MAINTAINED";

export interface SupportProvenance {
  readonly attemptId: string;
  readonly support: SupportAction;
  readonly cardId: string;
  readonly recordedAt: string;
}

export function evidenceAfterSupport(
  provenance: readonly SupportProvenance[],
): EvidenceStatus {
  return provenance.length > 0 ? "SUPPORTED_RETRY" : "INDEPENDENT";
}
