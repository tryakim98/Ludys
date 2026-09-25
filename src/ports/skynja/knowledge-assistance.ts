import type { GroundedKnowledgeContext, KnowledgeLibrarySnapshot } from "../../core/skynja/knowledge-policy.js";

export interface ControlledKnowledgeLibraryPort {
  /** Current, trusted snapshot. Implementations must enforce review and revocation. */
  snapshot(): KnowledgeLibrarySnapshot;
}

/** First integration: select approved excerpts. Free generation is a separate capability. */
export interface KnowledgeSelectorPort {
  select(context: GroundedKnowledgeContext, signal: AbortSignal): Promise<unknown>;
}
