import type { Locale } from "./content-contracts.js";

export type RuntimeFailureKind =
  | "WINDOW_ERROR"
  | "UNHANDLED_REJECTION"
  | "RENDER_FAILURE"
  | "STORAGE_FAILURE"
  | "AUDIO_FAILURE";

export interface RuntimeSafetyState {
  readonly mode: "NORMAL" | "TECHNICAL_RECOVERY";
  readonly failure: RuntimeFailureKind | undefined;
  readonly activeAudioIds: readonly string[];
  readonly pendingActionIds: readonly string[];
  readonly stopAvailable: true;
  readonly safeStartAvailable: true;
  readonly externalReporting: false;
  readonly personInterpretation: false;
}

export function createRuntimeSafetyState(): RuntimeSafetyState {
  return {
    mode: "NORMAL",
    failure: undefined,
    activeAudioIds: [],
    pendingActionIds: [],
    stopAvailable: true,
    safeStartAvailable: true,
    externalReporting: false,
    personInterpretation: false,
  };
}

export function failClosedRuntime(
  state: RuntimeSafetyState,
  failure: RuntimeFailureKind,
): RuntimeSafetyState {
  return {
    ...state,
    mode: "TECHNICAL_RECOVERY",
    failure,
    activeAudioIds: [],
    pendingActionIds: [],
    stopAvailable: true,
    safeStartAvailable: true,
    externalReporting: false,
    personInterpretation: false,
  };
}

interface RuntimeRecoveryCopy {
  readonly heading: string;
  readonly explanation: string;
  readonly stop: string;
  readonly safeStart: string;
  readonly humanReviewed: true;
  readonly reviewSource: "WP13_10_SCOPE_2026_07_22";
}

export const runtimeRecoveryCopy: Readonly<Record<Locale, RuntimeRecoveryCopy>> = {
  "nb-NO": {
    heading: "Teknisk pause",
    explanation: "Noe teknisk stoppet visningen. Dette sier ikke noe om barnet. Lyd er stoppet, og du kan stoppe økten eller starte trygt på nytt.",
    stop: "Stopp økten",
    safeStart: "Start en ny lokal økt",
    humanReviewed: true,
    reviewSource: "WP13_10_SCOPE_2026_07_22",
  },
  "nn-NO": {
    heading: "Teknisk pause",
    explanation: "Noko teknisk stoppa visinga. Dette seier ikkje noko om barnet. Lyd er stoppa, og du kan stoppe økta eller starte trygt på nytt.",
    stop: "Stopp økta",
    safeStart: "Start ei ny lokal økt",
    humanReviewed: true,
    reviewSource: "WP13_10_SCOPE_2026_07_22",
  },
};
