import type { SessionState } from "../../core/state.js";

export interface ChildProjection {
  readonly phase: SessionState["phase"];
  readonly quietMode: boolean;
  readonly canRequestHelp: boolean;
  readonly canPause: boolean;
  readonly canStop: boolean;
  readonly locale: SessionState["locale"];
}

export function projectForChild(state: SessionState): ChildProjection {
  return {
    phase: state.phase,
    quietMode: state.quietMode,
    canRequestHelp: !state.deleted && !["STOPPED", "INVALIDATED", "COMPLETED"].includes(state.phase),
    canPause: !state.deleted && !["PAUSED", "STOPPED", "INVALIDATED", "COMPLETED"].includes(state.phase),
    canStop: !state.deleted && !["STOPPED", "INVALIDATED"].includes(state.phase),
    locale: state.locale,
  };
}
