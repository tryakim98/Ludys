import {
  createRuntimeSafetyState,
  failClosedRuntime,
  runtimeRecoveryCopy,
  type RuntimeFailureKind,
  type RuntimeSafetyState,
} from "../../core/runtime-safety.js";
import type { Locale } from "../../core/content-contracts.js";

interface RuntimeSafetyBoundaryOptions {
  readonly getLocale: () => Locale;
  readonly onStop: () => void;
  readonly onSafeStart: () => void;
}

export interface RuntimeSafetyBoundary {
  readonly snapshot: () => RuntimeSafetyState;
  readonly trigger: (failure: RuntimeFailureKind) => RuntimeSafetyState;
}

function stopBrowserAudio(): void {
  for (const audio of document.querySelectorAll<HTMLAudioElement>("audio")) {
    audio.pause();
    audio.currentTime = 0;
  }
}

export function installRuntimeSafetyBoundary(
  options: RuntimeSafetyBoundaryOptions,
): RuntimeSafetyBoundary {
  let state = createRuntimeSafetyState();
  const host = document.createElement("section");
  host.id = "runtime-recovery";
  host.className = "runtime-recovery";
  host.hidden = true;
  host.setAttribute("role", "alert");
  host.setAttribute("aria-labelledby", "runtime-recovery-title");
  document.body.append(host);

  function render(): void {
    const copy = runtimeRecoveryCopy[options.getLocale()];
    host.innerHTML = `<h2 id="runtime-recovery-title" tabindex="-1">${copy.heading}</h2><p>${copy.explanation}</p><div class="button-row"><button type="button" data-runtime-action="stop">${copy.stop}</button><button type="button" data-runtime-action="safe-start">${copy.safeStart}</button></div>`;
    host.hidden = state.mode !== "TECHNICAL_RECOVERY";
    host.dataset.failure = state.failure ?? "NONE";
    document.documentElement.dataset.runtimeSafety = state.mode;
    if (!host.hidden) queueMicrotask(() => host.querySelector<HTMLElement>("#runtime-recovery-title")?.focus());
  }

  function trigger(failure: RuntimeFailureKind): RuntimeSafetyState {
    stopBrowserAudio();
    state = failClosedRuntime(state, failure);
    render();
    return state;
  }

  host.addEventListener("click", (event) => {
    const action = (event.target as Element).closest<HTMLButtonElement>("button[data-runtime-action]")?.dataset.runtimeAction;
    if (action === "stop") options.onStop();
    if (action === "safe-start") options.onSafeStart();
  });
  window.addEventListener("error", () => { trigger("WINDOW_ERROR"); });
  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    trigger("UNHANDLED_REJECTION");
  });
  render();
  return { snapshot: () => state, trigger };
}
