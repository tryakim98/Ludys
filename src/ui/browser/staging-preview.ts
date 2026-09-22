import type { Locale } from "../../core/content-contracts.js";
import type {
  SyntheticStagingCommandKind,
  SyntheticStagingRole,
} from "../../core/synthetic-staging.js";
import { SyntheticStagingPreviewController } from "../../application/synthetic-staging-preview-controller.js";

interface StagingRuntimeConfig {
  readonly schemaVersion: "wp13.12b-preview-config-v1";
  readonly mode: "LOCAL_SYNTHETIC_FIXTURE";
  readonly providerEnabled: false;
  readonly cloudResources: 0;
  readonly externalProviderCalls: false;
}

const copy = {
  "nb-NO": {
    title: "Syntetisk stagingforhåndsvisning",
    boundary: "Kun syntetisk teknisk bevis. Ingen elevdata, provider eller skyressurser.",
    child: "Barnets minsteprojeksjon",
    adult: "Voksenprojeksjon",
    wait: "Vent",
    help: "Be om hjelp",
    pause: "Pause",
    resume: "Fortsett",
    stop: "STOPP",
    deletion: "Slett økt",
    reconnect: "Koble til på nytt",
    stale: "Test gammel kommando",
    kill: "Aktiver kill switch",
    provider: "Provider deaktivert",
    resources: "Skyressurser: 0",
    outcome: "Siste resultat",
    terminal: "Terminalstatus",
    stateVersion: "Tilstandsversjon",
    waitState: "Ventetilstand",
    helpState: "Hjelp venter",
    adultCard: "Voksenkort",
    noCard: "Ingen",
    noResurrection: "Ingen gjenoppliving",
  },
  "nn-NO": {
    title: "Syntetisk stagingførehandsvising",
    boundary: "Berre syntetisk teknisk bevis. Ingen elevdata, provider eller skyressursar.",
    child: "Barnet si minsteprojeksjon",
    adult: "Vaksenprojeksjon",
    wait: "Vent",
    help: "Be om hjelp",
    pause: "Pause",
    resume: "Hald fram",
    stop: "STOPP",
    deletion: "Slett økt",
    reconnect: "Kople til på nytt",
    stale: "Test gammal kommando",
    kill: "Aktiver kill switch",
    provider: "Provider deaktivert",
    resources: "Skyressursar: 0",
    outcome: "Siste resultat",
    terminal: "Terminalstatus",
    stateVersion: "Tilstandsversjon",
    waitState: "Ventetilstand",
    helpState: "Hjelp ventar",
    adultCard: "Vaksenkort",
    noCard: "Ingen",
    noResurrection: "Inga gjenoppliving",
  },
} as const;

const rootElement = document.querySelector<HTMLElement>("#staging-preview");
if (rootElement === null) throw new Error("staging preview root missing");
const root: HTMLElement = rootElement;
const controller = new SyntheticStagingPreviewController();
let config: StagingRuntimeConfig | undefined;
let configError: string | undefined;

function checked(value: boolean): string {
  return value ? "JA" : "NEI";
}

function render(): void {
  if (config === undefined) {
    root.innerHTML = `<section class="staging-preview staging-failed" role="alert">
      <h1>STAGING PREVIEW FAILED CLOSED</h1>
      <p>${configError ?? "RUNTIME_CONFIG_MISSING"}</p>
      <p>Provider disabled · Cloud resources: 0</p>
    </section>`;
    return;
  }
  const view = controller.view;
  const text = copy[view.locale];
  document.documentElement.lang = view.locale === "nb-NO" ? "nb" : "nn";
  document.documentElement.dataset.wp13_12bReady = "true";
  root.innerHTML = `
    <main class="staging-preview" id="staging-main">
      <header class="staging-header">
        <div>
          <p class="eyebrow">WP13.12B · SYNTHETIC ONLY</p>
          <h1 tabindex="-1" id="staging-title">${text.title}</h1>
        </div>
        <label>${view.locale === "nb-NO" ? "Målform" : "Målform"}
          <select id="staging-locale">
            <option value="nb-NO"${view.locale === "nb-NO" ? " selected" : ""}>Bokmål</option>
            <option value="nn-NO"${view.locale === "nn-NO" ? " selected" : ""}>Nynorsk</option>
          </select>
        </label>
      </header>
      <section class="staging-boundary" aria-labelledby="staging-boundary-title">
        <h2 id="staging-boundary-title">SYNTHETIC ONLY</h2>
        <p>${text.boundary}</p>
        <ul>
          <li>${text.provider}</li>
          <li>${text.resources}</li>
          <li>MULTI_DEVICE = OPTIONAL_TECHNICAL_STAGING_PROOF</li>
          <li>SINGLE_DEVICE = CANONICAL_PRODUCT_MODE</li>
          <li>Capability = MEMORY ONLY SIMULATION</li>
        </ul>
      </section>
      <p id="staging-status" class="staging-status" role="status" aria-live="polite">
        ${text.outcome}: <strong>${view.lastOutcome}</strong>
      </p>
      <div class="staging-projections">
        <section aria-labelledby="child-projection-title">
          <h2 id="child-projection-title">${text.child}</h2>
          <dl>
            <div><dt>${text.terminal}</dt><dd>${view.child.terminalStatus}</dd></div>
            <div><dt>${text.stateVersion}</dt><dd>${view.child.stateVersion}</dd></div>
            <div><dt>${text.waitState}</dt><dd>${checked(view.child.wait)}</dd></div>
            <div><dt>${text.helpState}</dt><dd>${checked(view.child.helpPending)}</dd></div>
            <div><dt>Audio</dt><dd>${view.child.audioStatus}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="adult-projection-title">
          <h2 id="adult-projection-title">${text.adult}</h2>
          <dl>
            <div><dt>${text.terminal}</dt><dd>${view.adult.terminalStatus}</dd></div>
            <div><dt>${text.stateVersion}</dt><dd>${view.adult.stateVersion}</dd></div>
            <div><dt>${text.waitState}</dt><dd>${checked(view.adult.wait)}</dd></div>
            <div><dt>${text.adultCard}</dt><dd>${view.adult.adultCard ?? text.noCard}</dd></div>
            <div><dt>Audio</dt><dd>${view.adult.audioStatus}</dd></div>
          </dl>
        </section>
      </div>
      <section class="staging-controls" aria-labelledby="staging-controls-title">
        <h2 id="staging-controls-title">Kontrollert lokal fixture</h2>
        <div class="button-row">
          <button data-staging-role="CHILD" data-staging-command="ENTER_WAIT">${text.wait}</button>
          <button data-staging-role="CHILD" data-staging-command="REQUEST_HELP">${text.help}</button>
          <button data-staging-role="CHILD" data-staging-command="PAUSE">${text.pause}</button>
          <button data-staging-role="ADULT" data-staging-command="RESUME">${text.resume}</button>
          <button class="danger-action" data-staging-role="CHILD" data-staging-command="STOP">${text.stop}</button>
          <button data-staging-action="reconnect">${text.reconnect}</button>
          <button data-staging-action="stale">${text.stale}</button>
          <button class="danger-action" data-staging-action="delete">${text.deletion}</button>
          <button class="danger-action" data-staging-action="kill">${text.kill}</button>
        </div>
      </section>
      <section class="staging-terminal" aria-labelledby="staging-terminal-title">
        <h2 id="staging-terminal-title">${text.noResurrection}</h2>
        <p>Tombstone: ${checked(view.tombstone)} · controlEpoch: ${view.controlEpoch} · stagingEnabled: ${checked(view.stagingEnabled)}</p>
        <p>NO_RESURRECTION: ${checked(view.noResurrection)}</p>
      </section>
    </main>`;
}

root.addEventListener("click", (event) => {
  const command = (event.target as Element).closest<HTMLButtonElement>("[data-staging-command]");
  if (command !== null) {
    controller.command(
      command.dataset.stagingRole as SyntheticStagingRole,
      command.dataset.stagingCommand as SyntheticStagingCommandKind,
    );
    render();
    root.querySelector<HTMLElement>("#staging-title")?.focus();
    return;
  }
  const action = (event.target as Element).closest<HTMLButtonElement>("[data-staging-action]");
  if (action === null) return;
  if (action.dataset.stagingAction === "delete") controller.delete();
  if (action.dataset.stagingAction === "reconnect") controller.reconnect();
  if (action.dataset.stagingAction === "stale") controller.staleCommand();
  if (action.dataset.stagingAction === "kill") controller.killSwitch();
  render();
  root.querySelector<HTMLElement>("#staging-title")?.focus();
});

root.addEventListener("change", (event) => {
  const locale = (event.target as Element).closest<HTMLSelectElement>("#staging-locale");
  if (locale === null) return;
  controller.setLocale(locale.value as Locale);
  render();
  root.querySelector<HTMLElement>("#staging-title")?.focus();
});

async function loadConfig(): Promise<void> {
  try {
    const response = await fetch("/web/staging-runtime-config.json", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const candidate = await response.json() as Partial<StagingRuntimeConfig>;
    if (
      candidate.schemaVersion !== "wp13.12b-preview-config-v1"
      || candidate.mode !== "LOCAL_SYNTHETIC_FIXTURE"
      || candidate.providerEnabled !== false
      || candidate.cloudResources !== 0
      || candidate.externalProviderCalls !== false
    ) throw new Error("RUNTIME_CONFIG_INVALID");
    config = candidate as StagingRuntimeConfig;
  } catch (error) {
    configError = error instanceof Error ? error.message : "RUNTIME_CONFIG_MISSING";
  }
  render();
}

const ready = loadConfig();
Object.assign(window, {
  __WP13_12B__: {
    ready,
    getView: () => controller.view,
    command: (role: SyntheticStagingRole, kind: SyntheticStagingCommandKind) => {
      const view = controller.command(role, kind);
      render();
      return view;
    },
    delete: () => { const view = controller.delete(); render(); return view; },
    reconnect: () => { const view = controller.reconnect(); render(); return view; },
    staleCommand: () => { const view = controller.staleCommand(); render(); return view; },
    killSwitch: () => { const view = controller.killSwitch(); render(); return view; },
  },
});
