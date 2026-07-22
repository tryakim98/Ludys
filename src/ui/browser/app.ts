import { createSyntheticAppNavigation } from "../../composition/create-synthetic-app-navigation.js";
import type { LifecycleRole } from "../../application/session-lifecycle-controller.js";
import type { Locale } from "../../core/content-contracts.js";
import type { CorpusLifecyclePolicy, DraftCorpusMode } from "../../core/draft-learning-corpus.js";
import { renderSyntheticAppNavigation } from "./synthetic-app-navigation-templates.js";
import { createLocalPwaCoordinator, type LocalPwaCoordinator } from "./pwa-status.js";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (rootElement === null) throw new Error("WP13.7B app shell is missing #app");
const root: HTMLDivElement = rootElement;

const pageInstance = crypto.randomUUID();
const { controller } = createSyntheticAppNavigation("nb-NO", pageInstance);
let pwaCoordinator: LocalPwaCoordinator | undefined;

function render(focus = false): void {
  root.innerHTML = renderSyntheticAppNavigation(controller.view);
  document.documentElement.lang = controller.view.locale === "nb-NO" ? "nb" : "nn";
  document.documentElement.dataset.wp13_7bReady = "true";
  document.documentElement.dataset.wp13_7cReady = "true";
  pwaCoordinator?.refresh();
  if (focus) {
    queueMicrotask(() => {
      root.querySelector<HTMLElement>("#screen-title")?.focus();
    });
  }
}

function announce(message: string, urgent = false): void {
  const target = root.querySelector<HTMLElement>(urgent ? "#app-alert" : "#app-status");
  if (target === null) return;
  target.textContent = "";
  queueMicrotask(() => { target.textContent = message; });
}

root.addEventListener("click", (event) => {
  const element = event.target as Element;
  const modeButton = element.closest<HTMLButtonElement>("button[data-corpus-mode]");
  if (modeButton !== null) {
    controller.setCorpusMode(modeButton.dataset.corpusMode as DraftCorpusMode);
    render(true);
    return;
  }
  const classButton = element.closest<HTMLButtonElement>("button[data-pattern-class-id]");
  if (classButton !== null) {
    controller.selectPatternClass(classButton.dataset.patternClassId ?? "");
    render(true);
    return;
  }
  const activityButton = element.closest<HTMLButtonElement>("button[data-corpus-activity-id]");
  if (activityButton !== null && !activityButton.disabled) {
    controller.selectCorpusActivity(activityButton.dataset.corpusActivityId ?? "");
    render(true);
    return;
  }
  const roleButton = element.closest<HTMLButtonElement>("button[data-app-role]");
  if (roleButton !== null) {
    controller.selectRole(roleButton.dataset.appRole as LifecycleRole);
    render(true);
    announce(controller.view.locale === "nb-NO"
      ? "Rollevisningen er byttet uten å kopiere økten."
      : "Rollevisinga er bytt utan å kopiere økta.");
    return;
  }

  const button = element.closest<HTMLButtonElement>("button[data-app-action]");
  if (button === null || button.disabled) return;
  const action = button.dataset.appAction;
  let focus = false;
  let urgent = false;
  switch (action) {
    case "create": controller.createSession(); focus = true; break;
    case "role-child": controller.selectRole("CHILD"); focus = true; break;
    case "role-adult": controller.selectRole("ADULT"); focus = true; break;
    case "finish-loading": controller.finishLoading(); focus = true; break;
    case "start": controller.startActivity(); focus = true; break;
    case "select-tile": controller.selectTile(button.dataset.tileId ?? ""); break;
    case "undo": controller.removeLastTile(); break;
    case "submit": controller.submitBuild(); break;
    case "wait": controller.enterWait(); focus = true; break;
    case "help": controller.requestHelp(); focus = true; break;
    case "quiet": controller.requestQuiet(); break;
    case "audio-spec": controller.requestCorpusAudioSpecification(); break;
    case "adult-wait": controller.adultWait(); break;
    case "adult-prompt": controller.adultPrompt(); break;
    case "adult-model": controller.adultModel(); break;
    case "adult-dismiss": controller.adultDismiss(); break;
    case "confirm-reading": controller.confirmReading(); focus = true; break;
    case "pause": controller.pause(); focus = true; break;
    case "resume": controller.resume(); focus = true; break;
    case "stop": controller.stop(); focus = true; urgent = true; break;
    case "reconnect": controller.reconnect(); focus = controller.view.terminalReconnectProved; break;
    case "detect-stale": controller.detectStale(); focus = true; break;
    case "begin-recovery": controller.beginRecovery(); focus = true; break;
    case "finish-recovery": controller.finishRecovery(); focus = true; break;
    case "delete": controller.deleteSession(); focus = true; urgent = true; break;
    case "new-session": controller.startNewSession(); focus = true; break;
    default: return;
  }
  render(focus);
  announce(`Tilstand: ${controller.view.lifecycleState}`, urgent);
});

root.addEventListener("change", (event) => {
  const select = (event.target as Element).closest<HTMLSelectElement>("#app-locale");
  if (select === null) return;
  controller.setLocale(select.value as Locale);
  render(true);
});

render();
pwaCoordinator = createLocalPwaCoordinator({
  getLifecycleState: () => controller.view.lifecycleState,
  getLocale: () => controller.view.locale,
});
pwaCoordinator.refresh();

async function loadCorpusPolicy(): Promise<void> {
  try {
    await pwaCoordinator?.ready;
    const response = await fetch("/web/corpus-lifecycle-policy.json", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`corpus policy HTTP ${response.status}`);
    controller.applyRestrictiveCorpusPolicy(await response.json() as CorpusLifecyclePolicy);
    document.documentElement.dataset.corpusPolicy = "READY";
  } catch {
    controller.applyRestrictiveCorpusPolicy({
      policyRevision: 1,
      restrictions: controller.view.corpus.patternClasses.map((patternClass) => ({
        scope: "PATTERN_CLASS" as const,
        scopeId: patternClass.patternClassId,
        lifecycleStatus: "STALE" as const,
      })),
      containsPersonData: false,
      resurrectionAllowed: false,
    });
    document.documentElement.dataset.corpusPolicy = "FAILED_CLOSED";
  }
  document.documentElement.dataset.wp13_8Ready = "true";
  render();
}

async function persistRestrictiveCorpusPolicy(policy: CorpusLifecyclePolicy): Promise<CorpusLifecyclePolicy> {
  const registration = await navigator.serviceWorker.ready;
  const worker = navigator.serviceWorker.controller ?? registration.active;
  if (worker === null) throw new Error("active service worker unavailable for corpus policy");
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<{ ok: boolean; policy?: CorpusLifecyclePolicy; error?: string }>) => {
      channel.port1.close();
      if (event.data.ok && event.data.policy !== undefined) resolve(event.data.policy);
      else reject(new Error(event.data.error ?? "corpus policy persistence failed"));
    };
    worker.postMessage({ type: "LUDYS_APPLY_RESTRICTIVE_CORPUS_POLICY", policy }, [channel.port2]);
  });
}

const corpusPolicyReady = loadCorpusPolicy();

Object.assign(window, {
  __WP13_7B__: {
    getViewModel: () => controller.view,
    getSessionId: () => controller.sessionId,
  },
  __WP13_7C__: {
    ready: pwaCoordinator.ready,
    getPwaStatus: () => pwaCoordinator?.snapshot(),
  },
  __WP13_8__: {
    ready: corpusPolicyReady,
    getCorpusView: () => controller.view.corpus,
    applyRestrictivePolicy: async (policy: CorpusLifecyclePolicy) => {
      const persisted = await persistRestrictiveCorpusPolicy(policy);
      controller.applyRestrictiveCorpusPolicy(persisted);
      render(true);
      return controller.view.corpus;
    },
  },
});
