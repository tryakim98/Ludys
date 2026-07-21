import { createSyntheticAppNavigation } from "../../composition/create-synthetic-app-navigation.js";
import type { LifecycleRole } from "../../application/session-lifecycle-controller.js";
import type { Locale } from "../../core/content-contracts.js";
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
    case "adult-wait": controller.adultWait(); break;
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

Object.assign(window, {
  __WP13_7B__: {
    getViewModel: () => controller.view,
    getSessionId: () => controller.sessionId,
  },
  __WP13_7C__: {
    ready: pwaCoordinator.ready,
    getPwaStatus: () => pwaCoordinator?.snapshot(),
  },
});
