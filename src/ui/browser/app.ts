import { createSyntheticAppNavigation } from "../../composition/create-synthetic-app-navigation.js";
import { createAuthoringPipeline } from "../../composition/create-authoring-pipeline.js";
import { createBetaOperations } from "../../composition/create-beta-operations.js";
import { createProviderDecision } from "../../composition/create-provider-decision.js";
import { createExerciseRoom } from "../../composition/create-exercise-room.js";
import type { ExerciseKind } from "../../core/skynja/exercise-room.js";
import { partitionExercisePolicy } from "../../core/skynja/exercise-room-policy.js";
import type { AuthoringLocaleTextField } from "../../application/authoring-pipeline-controller.js";
import type { FindingClassification, OperationsArtifactType, OperationsLocale } from "../../core/beta-operations.js";
import type { DecisionLocale, ProviderOptionId } from "../../core/provider-decision.js";
import type { LifecycleRole } from "../../application/session-lifecycle-controller.js";
import type { AuthoringLifecyclePolicy, LocalAuthoringReviewNote } from "../../core/authoring-pipeline.js";
import type { Locale } from "../../core/content-contracts.js";
import type { CorpusLifecyclePolicy, DraftCorpusMode } from "../../core/draft-learning-corpus.js";
import { renderSyntheticAppNavigation } from "./synthetic-app-navigation-templates.js";
import { renderAuthoringWorkspace } from "./authoring-workspace-templates.js";
import { renderBetaOperations } from "./beta-operations-templates.js";
import { renderProviderDecision } from "./provider-decision-templates.js";
import { renderExerciseRoom } from "./exercise-room-templates.js";
import { renderExerciseReview } from "./exercise-review-templates.js";
import { createExerciseReviewForm, exerciseReviewJson, exerciseReviewMarkdown } from "../../application/skynja/exercise-review.js";
import { ExerciseReviewNotesController, NOTE_FILE_LIMIT, type ReviewNoteDraft } from "../../application/skynja/exercise-review-notes.js";
import { createLocalPwaCoordinator, type LocalPwaCoordinator } from "./pwa-status.js";
import { installRuntimeSafetyBoundary } from "./runtime-safety.js";
import { rollbackComponent, type LocalReleaseState, type ReleaseComponent } from "../../core/release-hardening.js";
import { wp13_12aLocalReleaseState } from "../../content/prototype/wp13-12a-release-state.js";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (rootElement === null) throw new Error("WP13.7B app shell is missing #app");
const root: HTMLDivElement = rootElement;

const pageInstance = crypto.randomUUID();
const { controller } = createSyntheticAppNavigation("nb-NO", pageInstance);
const authoringController = createAuthoringPipeline();
const operationsController = createBetaOperations();
const providerDecisionController = createProviderDecision();
const exerciseController = createExerciseRoom();
let exerciseOpen = false;
let exerciseReviewOpen = false;
let exerciseReviewSelectedId = "";
let exerciseReviewUrls: string[] = [];
let exerciseReviewNotes: ExerciseReviewNotesController | undefined;
const exerciseReviewDrafts = new Map<string, ReviewNoteDraft>();
let exercisePoliciesReady = false;
let authoringOpen = false;
let operationsOpen = false;
let providerDecisionOpen = false;
let pwaCoordinator: LocalPwaCoordinator | undefined;
let localReleaseState: LocalReleaseState = wp13_12aLocalReleaseState;
let exportObjectUrl: string | undefined;
let providerDossierObjectUrl: string | undefined;
let providerOwnerTemplateObjectUrl: string | undefined;

function render(focus = false): void {
  captureReviewNoteDraft();
  exerciseController.restrict(authoringController.view.packages.filter((item) => item.lifecycle !== "CURRENT").map((item) => item.activityId));
  exerciseReviewNotes?.restrict(exerciseController.view.blockedIds);
  for (const id of exerciseController.view.blockedIds) exerciseReviewDrafts.delete(id);
  // Review is reachable only outside an exercise session. Restriction updates also rebuild exports.
  if (!exerciseOpen || exerciseController.view.stage !== "CATALOG") { exerciseReviewNotes?.cancelPendingImports(); exerciseReviewOpen = false; }
  exerciseReviewUrls.forEach((url) => URL.revokeObjectURL(url));
  exerciseReviewUrls = [];
  if (exerciseReviewOpen && exerciseReviewNotes === undefined) exerciseReviewNotes = new ExerciseReviewNotesController(exerciseController.view.catalog, exerciseController.view.blockedIds);
  const reviewPacket = exerciseReviewOpen ? exerciseReviewNotes?.packet : undefined;
  const focusedElement = document.activeElement as HTMLElement | null;
  const restoreExerciseFocus = exerciseOpen && !focus && focusedElement !== null && root.contains(focusedElement)
    ? focusedElement.id : "";
  if (exportObjectUrl !== undefined) URL.revokeObjectURL(exportObjectUrl);
  if (providerDossierObjectUrl !== undefined) URL.revokeObjectURL(providerDossierObjectUrl);
  if (providerOwnerTemplateObjectUrl !== undefined) URL.revokeObjectURL(providerOwnerTemplateObjectUrl);
  exportObjectUrl = undefined;
  providerDossierObjectUrl = undefined;
  providerOwnerTemplateObjectUrl = undefined;
  root.innerHTML = reviewPacket !== undefined ? renderExerciseReview(reviewPacket, exerciseController.view.locale, exerciseReviewSelectedId, exerciseReviewNotes?.notes, exerciseReviewDrafts)
    : exerciseOpen ? renderExerciseRoom(exerciseController.view) : providerDecisionOpen
    ? renderProviderDecision(providerDecisionController.view)
    : operationsOpen
    ? renderBetaOperations(operationsController.view)
    : authoringOpen
      ? renderAuthoringWorkspace(authoringController.view)
      : renderSyntheticAppNavigation(controller.view);
  const locale = exerciseOpen ? exerciseController.view.locale : providerDecisionOpen
    ? providerDecisionController.view.locale
    : operationsOpen ? operationsController.view.locale : authoringOpen ? authoringController.view.locale : controller.view.locale;
  document.documentElement.lang = locale === "nb-NO" || locale === "nb" ? "nb" : "nn";
  document.documentElement.dataset.wp13_7bReady = "true";
  document.documentElement.dataset.wp13_7cReady = "true";
  const exerciseEntry = root.querySelector<HTMLButtonElement>("[data-exercise-action=open]");
  if (exerciseEntry !== null) exerciseEntry.disabled = !exercisePoliciesReady;
  pwaCoordinator?.refresh();
  if (reviewPacket !== undefined) {
    const exports = [
      ["#exercise-review-markdown", exerciseReviewMarkdown(reviewPacket), "text/markdown;charset=utf-8"],
      ["#exercise-review-json", exerciseReviewJson(reviewPacket), "application/json"],
      ["#exercise-review-form", exerciseReviewJson(createExerciseReviewForm(reviewPacket)), "application/json"],
      ["#review-notes-download", exerciseReviewNotes!.exportJson(), "application/json"],
    ];
    for (const [selector, text, type] of exports) {
      const link = root.querySelector<HTMLAnchorElement>(selector!);
      if (link !== null) {
        link.href = URL.createObjectURL(new Blob([text!], { type: type! }));
        exerciseReviewUrls.push(link.href);
      }
    }
  }
  const download = root.querySelector<HTMLAnchorElement>("#operations-export-download");
  if (download !== null && operationsController.view.exportPreview !== "") {
    exportObjectUrl = URL.createObjectURL(new Blob([operationsController.view.exportPreview], { type: "application/json" }));
    download.href = exportObjectUrl;
  }
  const dossierDownload = root.querySelector<HTMLAnchorElement>("#provider-dossier-download");
  if (dossierDownload !== null && providerDecisionController.view.dossierPreview !== "") {
    providerDossierObjectUrl = URL.createObjectURL(new Blob([providerDecisionController.view.dossierPreview], { type: "application/json" }));
    dossierDownload.href = providerDossierObjectUrl;
  }
  const ownerTemplateDownload = root.querySelector<HTMLAnchorElement>("#provider-owner-template-download");
  if (ownerTemplateDownload !== null && providerDecisionController.view.ownerTemplatePreview !== "") {
    providerOwnerTemplateObjectUrl = URL.createObjectURL(new Blob([providerDecisionController.view.ownerTemplatePreview], { type: "text/markdown" }));
    ownerTemplateDownload.href = providerOwnerTemplateObjectUrl;
  }
  if (focus) {
    queueMicrotask(() => {
      root.querySelector<HTMLElement>(exerciseOpen ? "#exercise-title" : providerDecisionOpen
        ? "#provider-decision-title"
        : operationsOpen ? "#operations-integrity-title" : authoringOpen ? "#authoring-title" : "#screen-title")?.focus();
    });
  } else if (restoreExerciseFocus) {
    root.querySelector<HTMLElement>(`#${CSS.escape(restoreExerciseFocus)}`)?.focus({ preventScroll: true });
  }
}

function announce(message: string, urgent = false): void {
  const target = root.querySelector<HTMLElement>(exerciseOpen ? urgent ? "#exercise-alert" : "#exercise-status" : providerDecisionOpen
    ? urgent ? "#provider-decision-alert" : "#provider-decision-status"
    : operationsOpen
    ? urgent ? "#operations-alert" : "#operations-status"
    : authoringOpen
    ? urgent ? "#authoring-alert" : "#authoring-status"
    : urgent ? "#app-alert" : "#app-status");
  if (target === null) return;
  target.textContent = "";
  queueMicrotask(() => { target.textContent = message; });
}

function controlValue(selector: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)?.value ?? "";
}

function captureReviewNoteDraft(): void {
  const form = root.querySelector<HTMLFormElement>("#review-note-form");
  if (!form?.dataset.reviewExerciseId) return;
  exerciseReviewDrafts.set(form.dataset.reviewExerciseId, {
    locale: controlValue("#review-note-locale") as Locale, roundId: controlValue("#review-note-round"),
    category: controlValue("#review-note-category") as ReviewNoteDraft["category"],
    severity: controlValue("#review-note-severity") as ReviewNoteDraft["severity"],
    observation: controlValue("#review-note-observation"), suggestion: controlValue("#review-note-suggestion"),
  });
}

function clearReviewNoteText(): void {
  for (const selector of ["#review-note-observation", "#review-note-suggestion"]) {
    const field = root.querySelector<HTMLTextAreaElement>(selector);
    if (field !== null) field.value = "";
  }
}

function hasReviewWork(): boolean {
  return (exerciseReviewNotes?.count ?? 0) > 0 || [...exerciseReviewDrafts.values()].some((draft) => draft.observation.length > 0 || draft.suggestion.length > 0)
    || controlValue("#review-note-observation").length > 0 || controlValue("#review-note-suggestion").length > 0;
}

function reviewMessage(nb: string, nn: string): void {
  const target = root.querySelector<HTMLElement>("#review-notes-message");
  if (target === null) return;
  target.textContent = exerciseController.view.locale === "nb-NO" ? nb : nn;
  target.focus();
}

root.addEventListener("submit", (event) => {
  if (!(event.target instanceof HTMLFormElement) || event.target.id !== "review-note-form") return;
  event.preventDefault();
  captureReviewNoteDraft();
  const id = event.target.dataset.reviewExerciseId ?? "";
  const draft = exerciseReviewDrafts.get(id);
  if (draft === undefined || !exerciseReviewNotes?.add(crypto.randomUUID(), id, draft)) {
    reviewMessage("Notatet kunne ikke legges til. Kontroller tekst og runde. Maksimum er 200 notater og 1 MiB samlet.", "Notatet kunne ikkje leggjast til. Kontroller tekst og runde. Maksimum er 200 notat og 1 MiB samla.");
    return;
  }
  clearReviewNoteText(); render();
  reviewMessage("Notatet er lagt til på denne siden. Last ned filen for å beholde det.", "Notatet er lagt til på denne sida. Last ned fila for å halde på det.");
});

root.addEventListener("input", (event) => {
  if ((event.target as Element).closest("#review-note-form") !== null) { captureReviewNoteDraft(); pwaCoordinator?.refresh(); }
});

window.addEventListener("beforeunload", (event) => {
  if (hasReviewWork()) { event.preventDefault(); event.returnValue = ""; }
});

function applyAllCorpusPolicy(policy: CorpusLifecyclePolicy): void {
  const partition = partitionExercisePolicy(policy, exerciseController.view.catalog);
  controller.applyRestrictiveCorpusPolicy(partition.legacyPolicy);
  exerciseController.restrict(partition.blockedIds);
}

root.addEventListener("click", async (event) => {
  const element = event.target as Element;
  const noteButton = element.closest<HTMLButtonElement>("button[data-review-note-action]");
  if (noteButton !== null) {
    if (noteButton.dataset.reviewNoteAction === "clear") { exerciseReviewNotes?.clear(); exerciseReviewDrafts.clear(); clearReviewNoteText(); }
    else if (noteButton.dataset.reviewNoteAction === "remove") exerciseReviewNotes?.remove(noteButton.dataset.reviewNoteId ?? "");
    render();
    reviewMessage("Notatene på siden er oppdatert. Tidligere nedlastede filer finnes fortsatt på enheten din.", "Notata på sida er oppdaterte. Tidlegare nedlasta filer finst framleis på eininga di.");
    return;
  }
  const exerciseButton = element.closest<HTMLButtonElement>("button[data-exercise-action]");
  if (exerciseButton !== null && !exerciseButton.disabled) {
    const action = exerciseButton.dataset.exerciseAction;
    let focusTarget = "#exercise-title";
    let focusAnnouncement = "";
    switch (action) {
      case "open":
        if (!exercisePoliciesReady) return;
        if (["ACTIVE", "WAITING"].includes(controller.view.lifecycleState)) controller.pause();
        authoringController.stopAudio();
        exerciseController.backToCatalog();
        exerciseReviewOpen = false;
        exerciseController.setLocale(controller.view.locale);
        authoringOpen = false; operationsOpen = false; providerDecisionOpen = false; exerciseOpen = true;
        break;
      case "close":
        exerciseController.stop(); exerciseController.backToCatalog(); exerciseOpen = false;
        render(true); return;
      case "review-open":
        if (exerciseController.view.stage !== "CATALOG") return;
        exerciseReviewOpen = true;
        break;
      case "review-close": exerciseReviewNotes?.cancelPendingImports(); exerciseReviewOpen = false; break;
      case "filter":
        exerciseController.setFilter(exerciseButton.dataset.filter as ExerciseKind | "ALL");
        focusTarget = `[data-exercise-action=filter][data-filter="${exerciseButton.dataset.filter}"]`;
        focusAnnouncement = exerciseController.view.locale === "nb-NO" ? "Utvalget er oppdatert." : "Utvalet er oppdatert.";
        break;
      case "select": exerciseController.select(exerciseButton.dataset.exerciseId ?? ""); break;
      case "catalog": exerciseController.backToCatalog(); break;
      case "repeat": exerciseController.select(exerciseController.view.exercise?.id ?? ""); break;
      case "start": exerciseController.start(); break;
      case "tile": {
        const id = exerciseButton.dataset.tileId ?? "";
        exerciseController.tile(id);
        focusTarget = `#exercise-${exerciseController.view.selectedTiles.includes(id) ? "picked" : "bank"}-${id}`;
        const count = exerciseController.view.selectedTiles.length;
        focusAnnouncement = exerciseController.view.locale === "nb-NO" ? `${count} brikker i forslaget.` : `${count} brikker i forslaget.`;
        break;
      }
      case "clear": exerciseController.clearTiles(); focusTarget = ".exercise-tiles button:not(:disabled)"; break;
      case "option":
        exerciseController.option(exerciseButton.dataset.optionId ?? "");
        focusTarget = `#exercise-option-${exerciseButton.dataset.optionId}`; break;
      case "evidence":
        exerciseController.evidence(exerciseButton.dataset.evidenceId ?? "");
        focusTarget = `#exercise-evidence-${exerciseButton.dataset.evidenceId}`; break;
      case "check": exerciseController.check(); focusTarget = "#exercise-feedback"; break;
      case "hint": exerciseController.hint(); focusTarget = "#exercise-hint"; break;
      case "model": exerciseController.model(); focusTarget = "#exercise-model"; break;
      case "next": exerciseController.next(); break;
      case "skip": exerciseController.next(true); break;
      case "pause": exerciseController.pause(); break;
      case "resume": exerciseController.resume(); break;
      case "stop": exerciseController.stop(); break;
      default: return;
    }
    render();
    root.querySelector<HTMLElement>(focusTarget)?.focus({ preventScroll: action === "tile" || action === "option" || action === "evidence" || action === "filter" });
    if (focusAnnouncement) announce(focusAnnouncement);
    return;
  }
  const providerDecisionButton = element.closest<HTMLButtonElement>("button[data-provider-decision-action]");
  if (providerDecisionButton !== null && !providerDecisionButton.disabled) {
    const action = providerDecisionButton.dataset.providerDecisionAction;
    try {
      switch (action) {
        case "open":
          providerDecisionController.setLocale(controller.view.locale === "nb-NO" ? "nb" : "nn");
          authoringOpen = false;
          operationsOpen = false;
          providerDecisionOpen = true;
          break;
        case "close": providerDecisionOpen = false; break;
        case "export-dossier": providerDecisionController.exportDecisionDossier(); break;
        case "export-owner-template": providerDecisionController.exportBlankOwnerTemplate(); break;
        default: return;
      }
      render(true);
      if (providerDecisionOpen) announce(providerDecisionController.view.bundle.pendingOwnerLabel);
    } catch (error) {
      render();
      announce(error instanceof Error ? error.message : String(error), true);
    }
    return;
  }
  const providerOptionButton = element.closest<HTMLButtonElement>("button[data-provider-option-select]");
  if (providerOptionButton !== null && !providerOptionButton.disabled) {
    providerDecisionController.selectOption(providerOptionButton.dataset.providerOptionSelect as ProviderOptionId);
    render(true);
    return;
  }
  const operationsButton = element.closest<HTMLButtonElement>("button[data-operations-action]");
  if (operationsButton !== null && !operationsButton.disabled) {
    const action = operationsButton.dataset.operationsAction;
    try {
      switch (action) {
        case "open":
          operationsController.setLocale(controller.view.locale === "nb-NO" ? "nb" : "nn");
          authoringOpen = false;
          providerDecisionOpen = false;
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
          providerDecisionOpen = false;
          operationsOpen = false;
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

root.addEventListener("change", async (event) => {
  const noteFile = (event.target as Element).closest<HTMLInputElement>("#review-notes-file");
  if (noteFile !== null && exerciseReviewNotes !== undefined) {
    const file = noteFile.files?.[0];
    if (file === undefined) return;
    const generation = exerciseReviewNotes.importGeneration;
    if (file.size > NOTE_FILE_LIMIT) { reviewMessage("Filen er for stor. Maksimum er 1 MiB.", "Fila er for stor. Maksimum er 1 MiB."); return; }
    let result: ReturnType<ExerciseReviewNotesController["importJson"]>;
    try { result = exerciseReviewNotes.importJson(await file.text(), generation); }
    catch { result = "INVALID_FILE"; }
    if (result === "CANCELLED" || !exerciseReviewOpen) return;
    render();
    if (result === "IMPORTED") reviewMessage("Notatene er lagt til. Identiske notater er ikke duplisert.", "Notata er lagde til. Identiske notat er ikkje dupliserte.");
    else if (result === "VERSION_MISMATCH") reviewMessage("Filen gjelder en annen innholdsversjon eller sperret innhold. Notatene dine er beholdt.", "Fila gjeld ein annan innhaldsversjon eller sperra innhald. Notata dine er haldne på.");
    else if (result === "CONFLICT") reviewMessage("Et notat i filen har samme ID, men annet innhold. Ingen notater er erstattet.", "Eit notat i fila har same ID, men anna innhald. Ingen notat er erstatta.");
    else reviewMessage("Ugyldig notatfil. Notatene dine er beholdt.", "Ugyldig notatfil. Notata dine er haldne på.");
    return;
  }
  const reviewSelect = (event.target as Element).closest<HTMLSelectElement>("#exercise-review-select");
  if (reviewSelect !== null) {
    exerciseReviewSelectedId = reviewSelect.value;
    render();
    root.querySelector<HTMLElement>("#exercise-review-heading")?.focus();
    return;
  }
  const exerciseLocale = (event.target as Element).closest<HTMLSelectElement>("#exercise-locale");
  if (exerciseLocale !== null) {
    exerciseController.setLocale(exerciseLocale.value as Locale);
    render(); root.querySelector<HTMLElement>("#exercise-locale")?.focus(); return;
  }
  const providerDecisionLocale = (event.target as Element).closest<HTMLSelectElement>("#provider-decision-locale");
  if (providerDecisionLocale !== null) {
    providerDecisionController.setLocale(providerDecisionLocale.value as DecisionLocale);
    render(true);
    return;
  }
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
  getLifecycleState: () => exerciseController.view.sessionOpen ? "ACTIVE" : controller.view.lifecycleState,
  getLocale: () => exerciseOpen ? exerciseController.view.locale : controller.view.locale,
  getLocalWorkPending: hasReviewWork,
});
pwaCoordinator.refresh();

const runtimeSafetyBoundary = installRuntimeSafetyBoundary({
  getLocale: () => exerciseOpen ? exerciseController.view.locale : controller.view.locale,
  onStop: () => {
    exerciseController.stop();
    authoringController.stopAudio();
    operationsController.stop();
    controller.stop();
    render(true);
  },
  onSafeStart: () => {
    exerciseController.stop(); exerciseOpen = false;
    authoringController.stopAudio();
    if (!["STOPPED", "DELETED", "COMPLETED"].includes(controller.view.lifecycleState)) controller.stop();
    controller.startNewSession();
    authoringOpen = false;
    operationsOpen = false;
    providerDecisionOpen = false;
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
    const policy = await response.json() as CorpusLifecyclePolicy;
    applyAllCorpusPolicy(policy);
    document.documentElement.dataset.corpusPolicy = "READY";
  } catch {
    exerciseController.restrict(exerciseController.view.catalog.map((item) => item.id));
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
const exerciseReady = Promise.all([corpusPolicyReady, authoringPolicyReady]).then(() => {
  exercisePoliciesReady = true;
  render();
});

Object.assign(window, {
  __SKYNJA_EXERCISES__: {
    ready: exerciseReady,
    getView: () => exerciseController.view,
  },
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
      applyAllCorpusPolicy(persisted);
      render(true);
      return controller.view.corpus;
    },
  },
  __WP13_9__: {
    ready: Promise.all([corpusPolicyReady, authoringPolicyReady]),
    getAuthoringView: () => authoringController.view,
    openWorkspace: () => { exerciseController.stop(); exerciseOpen = false; authoringOpen = true; render(true); return authoringController.view; },
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
    openOperations: () => { exerciseController.stop(); exerciseOpen = false; authoringOpen = false; operationsOpen = true; render(true); return operationsController.view; },
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
  __WP13_12A__: {
    ready: Promise.resolve(true),
    getDecisionView: () => providerDecisionController.view,
    openDecision: () => {
      exerciseController.stop(); exerciseOpen = false;
      authoringOpen = false;
      operationsOpen = false;
      providerDecisionOpen = true;
      render(true);
      return providerDecisionController.view;
    },
    closeDecision: () => { providerDecisionOpen = false; render(true); },
    setLocale: (locale: DecisionLocale) => { providerDecisionController.setLocale(locale); render(true); return providerDecisionController.view; },
    selectOption: (optionId: ProviderOptionId) => { providerDecisionController.selectOption(optionId); render(true); return providerDecisionController.view; },
    exportDossier: () => { const result = providerDecisionController.exportDecisionDossier(); render(); return result; },
    exportOwnerTemplate: () => { const result = providerDecisionController.exportBlankOwnerTemplate(); render(); return result; },
  },
});
