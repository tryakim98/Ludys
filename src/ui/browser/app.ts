import { KnowledgeLibraryController } from "../../application/knowledge-library-controller.js";
import { VerticalProofController } from "../../application/vertical-proof-controller.js";
import { wordProofContentNb } from "../../content/fixtures/bm/word-proof-content.js";
import { wordProofNb } from "../../content/fixtures/bm/word-proof.js";
import { wordProofContentNn } from "../../content/fixtures/nn/word-proof-content.js";
import { wordProofNn } from "../../content/fixtures/nn/word-proof.js";
import type {
  AdultRole,
  KnowledgeNeed,
  KnowledgeTopic,
} from "../../core/knowledge-audio-prototype.js";
import type { Locale } from "../../core/content-contracts.js";
import { createKnowledgeLibraryController } from "../../composition/create-knowledge-library.js";
import { createB8ReadinessController } from "../../composition/create-b8-readiness.js";
import {
  parseAgeFilter,
  parseDurationFilter,
  renderKnowledgeLibraryMarkup,
} from "./knowledge-templates.js";
import { feedbackText, renderAdultMarkup, renderChildMarkup, uiText } from "./templates.js";
import { parseGateFilter, renderB8ReadinessMarkup } from "./readiness-templates.js";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`WP13.4 browser shell is missing ${selector}`);
  return element;
}

const app = requireElement<HTMLDivElement>("#app");
const childButton = requireElement<HTMLButtonElement>("#show-child");
const adultButton = requireElement<HTMLButtonElement>("#show-adult");
const knowledgeButton = requireElement<HTMLButtonElement>("#show-knowledge");
const readinessButton = requireElement<HTMLButtonElement>("#show-readiness");
const localeSelect = requireElement<HTMLSelectElement>("#locale-select");
const politeStatus = requireElement<HTMLDivElement>("#polite-status");
const urgentStatus = requireElement<HTMLDivElement>("#urgent-status");
const dialog = requireElement<HTMLDialogElement>("#transparency-dialog");
const dialogClose = requireElement<HTMLButtonElement>("#close-transparency");

let currentView: "CHILD" | "ADULT" | "KNOWLEDGE" | "READINESS" = "CHILD";
let returnFocus: HTMLElement | undefined;
let controller = createController("nb-NO");
const knowledgeController = createKnowledgeLibraryController("nb-NO");
const readinessController = createB8ReadinessController();

function createController(locale: Locale): VerticalProofController {
  return new VerticalProofController({
    sessionId: `synthetic-wp13-4-${locale}`,
    definition: locale === "nb-NO" ? wordProofNb : wordProofNn,
    content: locale === "nb-NO" ? wordProofContentNb : wordProofContentNn,
  });
}

function stopRenderedAudio(): void {
  for (const audio of app.querySelectorAll<HTMLAudioElement>("audio")) {
    audio.pause();
    audio.currentTime = 0;
  }
}

function render(): void {
  stopRenderedAudio();
  const locale = controller.snapshot.definition.locale;
  document.documentElement.lang = locale === "nb-NO" ? "nb" : "nn";
  childButton.setAttribute("aria-pressed", String(currentView === "CHILD"));
  adultButton.setAttribute("aria-pressed", String(currentView === "ADULT"));
  knowledgeButton.setAttribute("aria-pressed", String(currentView === "KNOWLEDGE"));
  readinessButton.setAttribute("aria-pressed", String(currentView === "READINESS"));
  if (currentView === "CHILD") app.innerHTML = renderChildMarkup(controller.snapshot);
  else if (currentView === "ADULT") app.innerHTML = renderAdultMarkup(controller.snapshot);
  else if (currentView === "KNOWLEDGE") app.innerHTML = renderKnowledgeLibraryMarkup(knowledgeController.snapshot);
  else app.innerHTML = renderB8ReadinessMarkup(readinessController.snapshot);
}

function announce(message: string, urgent = false): void {
  const target = urgent ? urgentStatus : politeStatus;
  target.textContent = "";
  queueMicrotask(() => { target.textContent = message; });
}

function showView(view: "CHILD" | "ADULT" | "KNOWLEDGE" | "READINESS"): void {
  currentView = view;
  render();
  const selector = view === "CHILD" ? "#child-title" : view === "ADULT" ? "#adult-title" : view === "KNOWLEDGE" ? "#knowledge-title" : "#readiness-title";
  document.querySelector<HTMLElement>(selector)?.focus();
}

app.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  try {
    switch (action) {
      case "select-tile": controller.dispatch({ kind: "SELECT_TILE", tileId: button.dataset.tileId ?? "" }); break;
      case "undo": controller.dispatch({ kind: "REMOVE_LAST_TILE" }); break;
      case "clear": controller.dispatch({ kind: "CLEAR_TILES" }); break;
      case "submit": controller.dispatch({ kind: "SUBMIT_BUILD" }); break;
      case "help": controller.dispatch({ kind: "REQUEST_HELP" }); announce("Den voksne har fått ett kort."); break;
      case "quiet": controller.dispatch({ kind: "REQUEST_QUIET" }); break;
      case "audio": controller.dispatch({ kind: "PLAY_AUDIO" }); announce(uiText[controller.snapshot.definition.locale].audioStub); break;
      case "pause": controller.dispatch({ kind: "PAUSE" }); break;
      case "resume": controller.dispatch({ kind: "RESUME" }); break;
      case "stop": controller.dispatch({ kind: "STOP", actor: currentView === "ADULT" ? "ADULT" : "CHILD" }); announce(uiText[controller.snapshot.definition.locale].stopped, true); break;
      case "adult-wait": controller.dispatch({ kind: "ADULT_WAIT" }); break;
      case "adult-model": controller.dispatch({ kind: "ADULT_MODEL" }); currentView = "CHILD"; break;
      case "confirm-reading": controller.dispatch({ kind: "ADULT_CONFIRM_READING" }); currentView = "CHILD"; break;
      case "correction":
        controller.dispatch({
          kind: "CONTEXT_CORRECTION",
          correction: button.dataset.code as "TASK_UNCLEAR" | "HELP_GIVEN_OUTSIDE_APP" | "ADULT_CHOSE_OTHER_STRATEGY",
        });
        announce("Korrigeringen gjelder bare denne økten.");
        break;
      case "open-knowledge":
        showView("KNOWLEDGE");
        knowledgeController.select(button.dataset.knowledgeId ?? "");
        render();
        document.querySelector<HTMLElement>("#knowledge-detail-title")?.focus();
        return;
      case "knowledge-select":
        knowledgeController.select(button.dataset.knowledgeId ?? "");
        render();
        document.querySelector<HTMLElement>("#knowledge-detail-title")?.focus();
        return;
      case "transparency":
        returnFocus = button;
        dialog.showModal();
        dialogClose.focus();
        return;
    }
    render();
    announce(feedbackText(controller.snapshot));
  } catch (error) {
    announce(error instanceof Error ? error.message : "Teknisk feil", true);
  }
});

app.addEventListener("change", (event) => {
  const readinessSelect = (event.target as Element).closest<HTMLSelectElement>("select[data-readiness-filter]");
  if (readinessSelect !== null) {
    readinessController.selectGate(parseGateFilter(readinessSelect.value));
    render();
    announce(`${readinessController.snapshot.visibleRequirements.length} evidenskrav vises.`);
    return;
  }
  const select = (event.target as Element).closest<HTMLSelectElement>("select[data-filter]");
  if (select === null) return;
  const filter = select.dataset.filter;
  switch (filter) {
    case "role": knowledgeController.setFilters({ role: select.value as AdultRole | "ALL" }); break;
    case "ageBand": knowledgeController.setFilters({ ageBand: parseAgeFilter(select.value) }); break;
    case "topic": knowledgeController.setFilters({ topic: select.value as KnowledgeTopic | "ALL" }); break;
    case "need": knowledgeController.setFilters({ need: select.value as KnowledgeNeed | "ALL" }); break;
    case "maxDurationMinutes": knowledgeController.setFilters({ maxDurationMinutes: parseDurationFilter(select.value) }); break;
  }
  render();
  announce(`${knowledgeController.snapshot.results.length} treff.`);
});

childButton.addEventListener("click", () => showView("CHILD"));
adultButton.addEventListener("click", () => showView("ADULT"));
knowledgeButton.addEventListener("click", () => showView("KNOWLEDGE"));
readinessButton.addEventListener("click", () => showView("READINESS"));

localeSelect.addEventListener("change", () => {
  const locale = localeSelect.value as Locale;
  controller = createController(locale);
  knowledgeController.setLocale(locale);
  currentView = "CHILD";
  render();
  announce(locale === "nb-NO" ? "Bokmål er valgt." : "Nynorsk er valt.");
});

dialogClose.addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => returnFocus?.focus());
dialog.addEventListener("cancel", () => { queueMicrotask(() => returnFocus?.focus()); });

render();

Object.assign(window, {
  __WP13_4__: {
    getSnapshot: () => controller.snapshot,
    getKnowledgeSnapshot: () => knowledgeController.snapshot,
    setView: (view: "CHILD" | "ADULT" | "KNOWLEDGE" | "READINESS") => { currentView = view; render(); },
    getReadinessSnapshot: () => readinessController.snapshot,
  },
});
