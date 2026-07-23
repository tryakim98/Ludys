import { createSyntheticAppNavigation } from "../../composition/create-synthetic-app-navigation.js";
import { createAuthoringPipeline } from "../../composition/create-authoring-pipeline.js";
import { createBetaOperations } from "../../composition/create-beta-operations.js";
import type { AuthoringLocaleTextField } from "../../application/authoring-pipeline-controller.js";
import type { FindingClassification, OperationsArtifactType, OperationsLocale } from "../../core/beta-operations.js";
import type { LifecycleRole } from "../../application/session-lifecycle-controller.js";
import type { AuthoringLifecyclePolicy, LocalAuthoringReviewNote } from "../../core/authoring-pipeline.js";
import type { Locale } from "../../core/content-contracts.js";
import type { CorpusLifecyclePolicy, DraftCorpusMode } from "../../core/draft-learning-corpus.js";
import { renderSyntheticAppNavigation } from "./synthetic-app-navigation-templates.js";
import { renderAuthoringWorkspace } from "./authoring-workspace-templates.js";
import { renderBetaOperations } from "./beta-operations-templates.js";
import { createLocalPwaCoordinator, type LocalPwaCoordinator } from "./pwa-status.js";
import { installRuntimeSafetyBoundary } from "./runtime-safety.js";
import { rollbackComponent, type LocalReleaseState, type ReleaseComponent } from "../../core/release-hardening.js";
import { wp13_11LocalReleaseState } from "../../content/prototype/wp13-11-release-state.js";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (rootElement === null) throw new Error("WP13.7B app shell is missing #app");
const root: HTMLDivElement = rootElement;

const pageInstance = crypto.randomUUID();
const { controller } = createSyntheticAppNavigation("nb-NO", pageInstance);
const authoringController = createAuthoringPipeline();
const operationsController = createBetaOperations();
let authoringOpen = false;
let operationsOpen = false;
let pwaCoordinator: LocalPwaCoordinator | undefined;
let localReleaseState: LocalReleaseState = wp13_11LocalReleaseState;
let exportObjectUrl: string | undefined;

function render(focus = false): void {
  if (exportObjectUrl !== undefined) URL.revokeObjectURL(exportObjectUrl);
  exportObjectUrl = undefined;
  root.innerHTML = operationsOpen
    ? renderBetaOperations(operationsController.view)
    : authoringOpen
      ? renderAuthoringWorkspace(authoringController.view)
      : renderSyntheticAppNavigation(controller.view);
  const locale = operationsOpen ? operationsController.view.locale : authoringOpen ? authoringController.view.locale : controller.view.locale;
  document.documentElement.lang = locale === "nb-NO" || locale === "nb" ? "nb" : "nn";
  document.documentElement.dataset.wp13_7bReady = "true";
  document.documentElement.dataset.wp13_7cReady = "true";
  pwaCoordinator?.refresh();
  const download = root.querySelector<HTMLAnchorElement>("#operations-export-download");
  if (download !== null && operationsController.view.exportPreview !== "") {
    exportObjectUrl = URL.createObjectURL(new Blob([operationsController.view.exportPreview], { type: "application/json" }));
    download.href = exportObjectUrl;
  }
  if (focus) {
    queueMicrotask(() => {
      root.querySelector<HTMLElement>(operationsOpen ? "#operations-integrity-title" : authoringOpen ? "#authoring-title" : "#screen-title")?.focus();
    });
  }
}

function announce(message: string, urgent = false): void {
  const target = root.querySelector<HTMLElement>(operationsOpen
    ? urgent ? "#operations-alert" : "#operations-status"
    : authoringOpen
    ? urgent ? "#authoring-alert" : "#authoring-status"
    : urgent ? "#app-alert" : "#app-status");
  if (target === null) return;
  target.textContent = "";
  queueMicrotask(() => { target.textContent = message; });
}

function controlValue(selector: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? "";
}

root.addEventListener("click", async (event) => {
  const element = event.target as Element;
  const operationsButton = element.closest<HTMLButtonElement>("button[data-operations-action]");
  if (operationsButton !== null && !operationsButton.disabled) {
    const action = operationsButton.dataset.operationsAction;
    try {
      switch (action) {
        case "open":
          operationsController.setLocale(controller.view.locale === "nb-NO" ? "nb" : "nn");
          authoringOpen = false;
          operationsOpen = true;
          break;
        case "close": operationsOpen = false; break;
        case "start": operationsController.startNewDryRun(); break;
        case "wait": operationsController.wait(); break;
        case "help": operationsController.requestHelp(); break;
        case "pause": operationsController.pause(); break;
        case "resume": operationsController.resume(); break;
        case "stop": operationsController.stop(); break;
        case "stop-drill": operationsController.stop(); break;
        case "sev0": operationsController.runSev0Drill(); break;
        case "record-finding":
          operationsController.addFinding(
            controlValue("#operations-finding-classification") as FindingClassification,
            controlValue("#operations-finding-code"),
            controlValue("#operations-finding-note"),
          );
          break;
        case "delete-records": operationsController.deleteDryRunRecords(); break;
        case "delete": operationsController.deleteSessionState(); break;
        case "reconnect": operationsController.reconnect(); break;
        case "rollback": {
          const result = rollbackComponent(localReleaseState, "OPERATIONS", "wp13-11-operations-kit-r0", new Date().toISOString());
          if (result.accepted) localReleaseState = result.state;
          operationsController.recordRollbackDrill(result.accepted, localReleaseState.active.operationsReleaseId);
          break;
        }
        case "withdrawal": operationsController.runWithdrawalDrill(); break;
        case "export": operationsController.exportLocalReviewPackage(); break;
        default: return;
      }
      render(true);
      if (operationsOpen) announce(operationsController.view.lastAction);
    } catch (error) {
      render();
      announce(error instanceof Error ? error.message : String(error), true);
    }
    return;
  }
  const authoringLocale = element.closest<HTMLButtonElement>("button[data-authoring-locale]");
  if (authoringLocale !== null) {
    authoringController.setLocale(authoringLocale.dataset.authoringLocale as Locale);
    render(true);
    return;
  }
  const authoringButton = element.closest<HTMLButtonElement>("button[data-authoring-action]");
  if (authoringButton !== null && !authoringButton.disabled) {
    const action = authoringButton.dataset.authoringAction;
    try {
      switch (action) {
        case "open":
          authoringController.setLocale(controller.view.locale);
          authoringOpen = true;
          break;
        case "close": authoringOpen = false; break;
        case "clone": authoringController.cloneCompleteDraft(controlValue("#authoring-clone-id")); break;
        case "add-review": {
          const note: LocalAuthoringReviewNote = {
            reviewId: controlValue("#local-review-id"),
            name: controlValue("#local-review-name"),
            role: controlValue("#local-review-role"),
            scope: "COMPLETE_LOCAL_DRAFT",
            decision: "READY_FOR_EXTERNAL_HANDOFF",
            comment: controlValue("#local-review-comment"),
            timestamp: new Date().toISOString(),
            signatureText: `${controlValue("#local-review-name")} · intern kommentar · ikke ekstern receipt`,
            externalReceipt: false,
            receiptIntegrityVerified: false,
          };
          authoringController.addLocalReviewNote(note);
          break;
        }
        case "handoff": authoringController.prepareExternalReviewHandoff(); break;
        case "validate": authoringController.validateSelected(); break;
        case "export": authoringController.exportSelectedJson(); break;
        case "import": authoringController.importJson(controlValue("#authoring-json")); break;
        case "attach-take-a": authoringController.replaceWithTechnicalTake(authoringButton.dataset.audioId ?? "", "wp13-9-technical-take-a"); break;
        case "attach-take-b": authoringController.replaceWithTechnicalTake(authoringButton.dataset.audioId ?? "", "wp13-9-technical-take-b"); break;
        case "preview-audio": authoringController.requestAudioPreview(authoringButton.dataset.audioId ?? ""); break;
        case "stop-audio": authoringController.stopAudio(); break;
        case "withdraw": {
          const selected = authoringController.view.selectedPackage;
          const persisted = await persistRestrictiveAuthoringPolicy({
            policyRevision: authoringController.policy.policyRevision + 1,
            restrictions: [
              { scope: "AUTHORING_PACKAGE", scopeId: selected.packageId, lifecycleStatus: "WITHDRAWN" },
              ...selected.audioSpecifications.map((audio) => ({ scope: "AUDIO_SPEC" as const, scopeId: audio.semanticAudioId, lifecycleStatus: "WITHDRAWN" as const })),
            ],
            containsPersonData: false,
            resurrectionAllowed: false,
            publishingAuthority: false,
          });
          authoringController.applyRestrictivePolicy(persisted);
          authoringController.withdrawSelected(new Date().toISOString());
          break;
        }
        default: return;
      }
      render(true);
      if (authoringOpen) announce(authoringController.view.lastAction);
    } catch (error) {
      render();
      announce(error instanceof Error ? error.message : String(error), true);
    }
    return;
  }
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
  const operationsLocale = (event.target as Element).closest<HTMLSelectElement>("#operations-locale");
  if (operationsLocale !== null) {
    operationsController.setLocale(operationsLocale.value as OperationsLocale);
    render(true);
    return;
  }
  const operationsArtifact = (event.target as Element).closest<HTMLSelectElement>("#operations-artifact-select");
  if (operationsArtifact !== null) {
    operationsController.selectArtifact(operationsArtifact.value as OperationsArtifactType);
    render(true);
    return;
  }
  const packageSelect = (event.target as Element).closest<HTMLSelectElement>("#authoring-package-select");
  if (packageSelect !== null) {
    authoringController.selectPackage(packageSelect.value);
    render(true);
    return;
  }
  const authoringField = (event.target as Element).closest<HTMLInputElement | HTMLTextAreaElement>("[data-authoring-field]");
  if (authoringField !== null) {
    try {
      authoringController.editLocaleText(
        authoringController.view.locale,
        authoringField.dataset.authoringField as AuthoringLocaleTextField,
        authoringField.value,
      );
      render();
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error), true);
    }
    return;
  }
  const audioScript = (event.target as Element).closest<HTMLTextAreaElement>("[data-audio-script-id]");
  if (audioScript !== null) {
    try {
      authoringController.editAudioScript(audioScript.dataset.audioScriptId ?? "", audioScript.value);
      render();
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error), true);
    }
    return;
  }
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

const runtimeSafetyBoundary = installRuntimeSafetyBoundary({
  getLocale: () => controller.view.locale,
  onStop: () => {
    authoringController.stopAudio();
    operationsController.stop();
    controller.stop();
    render(true);
  },
  onSafeStart: () => {
    authoringController.stopAudio();
    if (!["STOPPED", "DELETED", "COMPLETED"].includes(controller.view.lifecycleState)) controller.stop();
    controller.startNewSession();
    authoringOpen = false;
    operationsOpen = false;
    render(true);
  },
});

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

async function loadAuthoringPolicy(): Promise<void> {
  try {
    await pwaCoordinator?.ready;
    const response = await fetch("/web/authoring-lifecycle-policy.json", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`authoring policy HTTP ${response.status}`);
    authoringController.applyRestrictivePolicy(await response.json() as AuthoringLifecyclePolicy);
    document.documentElement.dataset.authoringPolicy = "READY";
  } catch {
    authoringController.applyRestrictivePolicy({
      policyRevision: 1,
      restrictions: authoringController.view.packages.map((item) => ({
        scope: "AUTHORING_PACKAGE" as const,
        scopeId: item.packageId,
        lifecycleStatus: "STALE" as const,
      })),
      containsPersonData: false,
      resurrectionAllowed: false,
      publishingAuthority: false,
    });
    document.documentElement.dataset.authoringPolicy = "FAILED_CLOSED";
  }
  document.documentElement.dataset.wp13_9Ready = "true";
  render();
}

async function persistRestrictiveAuthoringPolicy(
  policy: AuthoringLifecyclePolicy,
): Promise<AuthoringLifecyclePolicy> {
  const registration = await navigator.serviceWorker.ready;
  const worker = navigator.serviceWorker.controller ?? registration.active;
  if (worker === null) throw new Error("active service worker unavailable for authoring policy");
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<{ ok: boolean; policy?: AuthoringLifecyclePolicy; error?: string }>) => {
      channel.port1.close();
      if (event.data.ok && event.data.policy !== undefined) resolve(event.data.policy);
      else reject(new Error(event.data.error ?? "authoring policy persistence failed"));
    };
    worker.postMessage({ type: "LUDYS_APPLY_RESTRICTIVE_AUTHORING_POLICY", policy }, [channel.port2]);
  });
}

const authoringPolicyReady = loadAuthoringPolicy();

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
  __WP13_9__: {
    ready: Promise.all([corpusPolicyReady, authoringPolicyReady]),
    getAuthoringView: () => authoringController.view,
    openWorkspace: () => { authoringOpen = true; render(true); return authoringController.view; },
    closeWorkspace: () => { authoringOpen = false; render(true); },
    exportSelected: () => authoringController.exportSelectedJson(),
    importPackage: (json: string) => { const view = authoringController.importJson(json); render(); return view; },
    applyRestrictivePolicy: async (policy: AuthoringLifecyclePolicy) => {
      const persisted = await persistRestrictiveAuthoringPolicy(policy);
      const view = authoringController.applyRestrictivePolicy(persisted);
      render(true);
      return view;
    },
  },
  __WP13_10__: {
    getRuntimeSafety: () => runtimeSafetyBoundary.snapshot(),
    triggerRuntimeFailure: (failure: Parameters<typeof runtimeSafetyBoundary.trigger>[0]) => runtimeSafetyBoundary.trigger(failure),
    getReleaseState: () => localReleaseState,
    rollbackComponent: (component: ReleaseComponent, revisionId: string) => {
      const result = rollbackComponent(localReleaseState, component, revisionId, new Date().toISOString());
      if (result.accepted) localReleaseState = result.state;
      return result;
    },
  },
  __WP13_11__: {
    ready: Promise.resolve(true),
    getOperationsView: () => operationsController.view,
    openOperations: () => { authoringOpen = false; operationsOpen = true; render(true); return operationsController.view; },
    closeOperations: () => { operationsOpen = false; render(true); },
    setLocale: (locale: OperationsLocale) => { operationsController.setLocale(locale); render(true); return operationsController.view; },
    selectArtifact: (artifactType: OperationsArtifactType) => { operationsController.selectArtifact(artifactType); render(true); return operationsController.view; },
    startDryRun: () => { operationsController.startNewDryRun(); render(true); return operationsController.view; },
    addFinding: (classification: FindingClassification, code: string, note: string) => { const result = operationsController.addFinding(classification, code, note); render(); return result; },
    runSev0: () => { operationsController.runSev0Drill(); render(true); return operationsController.view; },
    stop: () => { operationsController.stop(); render(true); return operationsController.view; },
    deleteState: () => { operationsController.deleteSessionState(); render(true); return operationsController.view; },
    reconnect: () => { const result = operationsController.reconnect(); render(); return result; },
    exportLocalReview: () => { const result = operationsController.exportLocalReviewPackage(); render(); return result; },
    deleteRecords: () => { operationsController.deleteDryRunRecords(); render(); return operationsController.view; },
    runWithdrawal: (artifactType?: OperationsArtifactType) => { operationsController.runWithdrawalDrill(artifactType); render(true); return operationsController.view; },
  },
});
