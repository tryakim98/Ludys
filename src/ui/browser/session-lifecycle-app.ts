import type {
  LifecycleAction,
  LifecycleReconnectScenario,
  LifecycleRole,
} from "../../application/session-lifecycle-controller.js";
import { createSessionLifecycleProof } from "../../composition/create-session-lifecycle-proof.js";
import { sessionLifecycleTechnicalCopy } from "../../content/prototype/session-lifecycle-copy.js";
import type { Locale } from "../../core/content-contracts.js";
import { renderSessionLifecycleMarkup } from "./session-lifecycle-templates.js";

let locale: Locale = "nb-NO";
let proof = createSessionLifecycleProof(locale);

function render(): void {
  const copy = sessionLifecycleTechnicalCopy[locale];
  document.documentElement.lang = locale === "nn-NO" ? "nn" : "nb";
  document.title = copy.pageTitle;
  document.body.innerHTML = renderSessionLifecycleMarkup(proof.controller.view, copy, locale);
  document.documentElement.dataset.lifecycleReady = "true";
}

function focusAfterAction(): void {
  const target = document.querySelector<HTMLElement>("#lifecycle-error")
    ?? document.querySelector<HTMLElement>("#lifecycle-state");
  target?.focus();
}

document.addEventListener("click", (event) => {
  const target = event.target as Element;
  const roleButton = target.closest<HTMLButtonElement>("button[data-lifecycle-role]");
  if (roleButton !== null) {
    proof.controller.selectRole(roleButton.dataset.lifecycleRole as LifecycleRole);
    render();
    document.querySelector<HTMLElement>("#lifecycle-title")?.focus();
    return;
  }
  const actionButton = target.closest<HTMLButtonElement>("button[data-lifecycle-action]");
  if (actionButton === null) return;
  proof.controller.perform(actionButton.dataset.lifecycleAction as LifecycleAction);
  render();
  focusAfterAction();
});

document.addEventListener("change", (event) => {
  const select = (event.target as Element).closest<HTMLSelectElement>("#lifecycle-locale");
  if (select === null) return;
  locale = select.value as Locale;
  proof = createSessionLifecycleProof(locale);
  render();
  document.querySelector<HTMLElement>("#lifecycle-title")?.focus();
});

render();

Object.assign(window, {
  __WP13_7A__: {
    getViewModel: () => proof.controller.view,
    perform: (action: LifecycleAction) => { proof.controller.perform(action); render(); },
    setRole: (role: LifecycleRole) => { proof.controller.selectRole(role); render(); },
    setReconnectScenario: (scenario: LifecycleReconnectScenario) => {
      proof.controller.configureReconnect(scenario);
    },
  },
});
