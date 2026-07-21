import type { AdultCardTemplate, ContextCorrectionCode } from "../../core/content-contracts.js";
import type { SessionState } from "../../core/state.js";

export interface AdultProjection {
  readonly phase: SessionState["phase"];
  readonly currentCard?: AdultCardTemplate;
  readonly waitAllowed: boolean;
  readonly canOverride: boolean;
  readonly canStop: boolean;
  readonly contextCorrections: readonly ContextCorrectionCode[];
}

export function projectForAdult(state: SessionState): AdultProjection {
  return {
    phase: state.phase,
    ...(state.activeCard === undefined ? {} : { currentCard: state.activeCard }),
    waitAllowed: true,
    canOverride: !state.deleted && !["STOPPED", "INVALIDATED", "COMPLETED"].includes(state.phase),
    canStop: !state.deleted && !["STOPPED", "INVALIDATED"].includes(state.phase),
    contextCorrections: state.contextCorrections,
  };
}
