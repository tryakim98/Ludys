import type { Locale } from "../../core/content-contracts.js";
import type { LifecycleState } from "../../core/session-lifecycle.js";

export type PwaWorkerState = "UNSUPPORTED" | "REGISTERING" | "READY" | "FAILED";
export type PwaUpdateState = "NONE" | "READY" | "ACTIVATING";

export interface LocalPwaStatusSnapshot {
  readonly locale: Locale;
  readonly network: "ONLINE" | "OFFLINE";
  readonly worker: PwaWorkerState;
  readonly update: PwaUpdateState;
  readonly canApplyUpdate: boolean;
}

interface PwaStatusCopy {
  readonly heading: string;
  readonly online: string;
  readonly offline: string;
  readonly localOnly: string;
  readonly registering: string;
  readonly ready: string;
  readonly unsupported: string;
  readonly failed: string;
  readonly updateReady: string;
  readonly updateDeferred: string;
  readonly updateAction: string;
  readonly activating: string;
  readonly humanReviewed: true;
  readonly reviewSource: "WP13.7C_SCOPE_2026-07-21";
}

export const pwaStatusCopy: Readonly<Record<Locale, PwaStatusCopy>> = {
  "nb-NO": {
    heading: "Lokal appstatus",
    online: "Tilkoblet. Denne demonstrasjonen bruker fortsatt bare lokal øktstate.",
    offline: "Uten nett. Det lokale appskallet er tilgjengelig; ingen synkronisering skjer.",
    localOnly: "Appskallet kan brukes lokalt etter første innlasting. Økten finnes bare i dette nettleserminnet.",
    registering: "Det lokale offline-appskallet klargjøres.",
    ready: "Det lokale offline-appskallet er klart.",
    unsupported: "Denne nettleseren støtter ikke det lokale offline-appskallet.",
    failed: "Det lokale offline-appskallet kunne ikke klargjøres.",
    updateReady: "En ny lokal appversjon er klar. Du kan aktivere den nå.",
    updateDeferred: "En ny lokal appversjon er klar. Stopp, fullfør eller slett økten før aktivering.",
    updateAction: "Aktiver ny appversjon",
    activating: "Ny lokal appversjon aktiveres. Siden lastes på nytt uten å gjenopprette gammel økt.",
    humanReviewed: true,
    reviewSource: "WP13.7C_SCOPE_2026-07-21",
  },
  "nn-NO": {
    heading: "Lokal appstatus",
    online: "Tilkopla. Denne demonstrasjonen bruker framleis berre lokal øktstate.",
    offline: "Utan nett. Det lokale appskalet er tilgjengeleg; inga synkronisering skjer.",
    localOnly: "Appskalet kan brukast lokalt etter første innlasting. Økta finst berre i dette nettlesarminnet.",
    registering: "Det lokale offline-appskalet blir gjort klart.",
    ready: "Det lokale offline-appskalet er klart.",
    unsupported: "Denne nettlesaren støttar ikkje det lokale offline-appskalet.",
    failed: "Det lokale offline-appskalet kunne ikkje gjerast klart.",
    updateReady: "Ein ny lokal appversjon er klar. Du kan aktivere han no.",
    updateDeferred: "Ein ny lokal appversjon er klar. Stopp, fullfør eller slett økta før aktivering.",
    updateAction: "Aktiver ny appversjon",
    activating: "Ny lokal appversjon blir aktivert. Sida blir lasta på nytt utan å gjenopprette gammal økt.",
    humanReviewed: true,
    reviewSource: "WP13.7C_SCOPE_2026-07-21",
  },
};

const SAFE_UPDATE_STATES: ReadonlySet<LifecycleState> = new Set([
  "NOT_CREATED",
  "STOPPED",
  "DELETED",
  "COMPLETED",
]);

export function isSafePwaUpdateState(state: LifecycleState): boolean {
  return SAFE_UPDATE_STATES.has(state);
}

interface LocalPwaCoordinatorOptions {
  readonly getLifecycleState: () => LifecycleState;
  readonly getLocale: () => Locale;
  readonly getLocalWorkPending?: () => boolean;
}

export interface LocalPwaCoordinator {
  readonly ready: Promise<void>;
  readonly refresh: () => void;
  readonly snapshot: () => LocalPwaStatusSnapshot;
}

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`WP13.7C PWA shell is missing ${selector}`);
  return element;
}

export function createLocalPwaCoordinator(
  options: LocalPwaCoordinatorOptions,
): LocalPwaCoordinator {
  const host = requiredElement<HTMLElement>("#pwa-status");
  const heading = requiredElement<HTMLElement>("#pwa-status-title");
  const networkStatus = requiredElement<HTMLElement>("#pwa-network-status");
  const localStatus = requiredElement<HTMLElement>("#pwa-local-status");
  const workerStatus = requiredElement<HTMLElement>("#pwa-worker-status");
  const updateStatus = requiredElement<HTMLElement>("#pwa-update-status");
  const updateButton = requiredElement<HTMLButtonElement>("#pwa-apply-update");
  let workerState: PwaWorkerState = "REGISTERING";
  let updateState: PwaUpdateState = "NONE";
  let waitingWorker: ServiceWorker | undefined;
  let activationRequested = false;
  let activatedWorkerWaitingForReload = false;
  let networkState: LocalPwaStatusSnapshot["network"] = navigator.onLine
    ? "ONLINE"
    : "OFFLINE";

  function snapshot(): LocalPwaStatusSnapshot {
    return {
      locale: options.getLocale(),
      network: networkState,
      worker: workerState,
      update: updateState,
      canApplyUpdate: updateState === "READY"
        && isSafePwaUpdateState(options.getLifecycleState()) && !options.getLocalWorkPending?.(),
    };
  }

  function render(): void {
    const state = snapshot();
    const copy = pwaStatusCopy[state.locale];
    heading.textContent = copy.heading;
    networkStatus.textContent = state.network === "ONLINE" ? copy.online : copy.offline;
    localStatus.textContent = copy.localOnly;
    workerStatus.textContent = {
      UNSUPPORTED: copy.unsupported,
      REGISTERING: copy.registering,
      READY: copy.ready,
      FAILED: copy.failed,
    }[state.worker];
    updateStatus.textContent = state.update === "ACTIVATING"
      ? copy.activating
      : state.update === "READY"
        ? state.canApplyUpdate ? copy.updateReady : copy.updateDeferred
        : "";
    updateButton.textContent = copy.updateAction;
    updateButton.hidden = state.update === "NONE";
    updateButton.disabled = !state.canApplyUpdate || state.update === "ACTIVATING";
    // New draft copy is separate from the historically reviewed session copy above.
    if (state.update !== "NONE" && options.getLocalWorkPending?.()) {
      updateStatus.textContent = state.locale === "nb-NO"
        ? "En appoppdatering venter. Last ned arbeidsnotatene og tøm notater og skjema før oppdatering."
        : "Ei appoppdatering ventar. Last ned arbeidsnotata og tøm notat og skjema før oppdatering.";
    }
    host.dataset.network = state.network;
    host.dataset.worker = state.worker;
    host.dataset.update = state.update;
    host.dataset.canApplyUpdate = String(state.canApplyUpdate);
    if (activatedWorkerWaitingForReload && !options.getLocalWorkPending?.() && isSafePwaUpdateState(options.getLifecycleState())) window.location.reload();
  }

  function exposeWaitingWorker(registration: ServiceWorkerRegistration): void {
    const waiting = registration.waiting;
    if (waiting === null) return;
    waitingWorker = waiting;
    updateState = "READY";
    render();
  }

  function observeInstallingWorker(
    registration: ServiceWorkerRegistration,
    installing: ServiceWorker,
  ): void {
    installing.addEventListener("statechange", () => {
      if (installing.state !== "installed" || navigator.serviceWorker.controller === null) return;
      queueMicrotask(() => exposeWaitingWorker(registration));
    });
  }

  const ready = (async (): Promise<void> => {
    if (!("serviceWorker" in navigator)) {
      workerState = "UNSUPPORTED";
      render();
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("/web/service-worker.js", {
        scope: "/web/",
        updateViaCache: "none",
      });
      workerState = "READY";
      exposeWaitingWorker(registration);
      if (registration.installing !== null) {
        observeInstallingWorker(registration, registration.installing);
      }
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (installing !== null) observeInstallingWorker(registration, installing);
      });
      await navigator.serviceWorker.ready;
      render();
    } catch {
      workerState = "FAILED";
      render();
    }
  })();

  window.addEventListener("online", () => {
    networkState = "ONLINE";
    render();
  });
  window.addEventListener("offline", () => {
    networkState = "OFFLINE";
    render();
  });
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (activationRequested) { activatedWorkerWaitingForReload = true; render(); }
  });
  updateButton.addEventListener("click", () => {
    if (waitingWorker === undefined || !snapshot().canApplyUpdate) return;
    activationRequested = true;
    updateState = "ACTIVATING";
    render();
    waitingWorker.postMessage({ type: "LUDYS_ACTIVATE_UPDATE" });
  });
  render();

  return { ready, refresh: render, snapshot };
}
