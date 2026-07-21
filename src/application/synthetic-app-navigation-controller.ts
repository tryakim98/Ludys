import { SessionLifecycleController, type LifecycleRole } from "./session-lifecycle-controller.js";
import type { ClockPort } from "../ports/clock.js";
import type {
  IdGenerationPort,
  LifecycleObservabilityPort,
  LifecycleSessionRepositoryPort,
  ReconnectTransportPort,
} from "../ports/session-lifecycle.js";
import type { HumanFirstContentBundle, Locale } from "../core/content-contracts.js";
import type { LifecycleState } from "../core/session-lifecycle.js";
import {
  createWordProofState,
  currentTask,
  transitionWordProof,
  type GraphemeTile,
  type WordProofDefinition,
  type WordProofFeedbackCode,
  type WordProofStage,
  type WordProofState,
} from "../core/word-proof.js";

export type AppJourneyScreen =
  | "WELCOME"
  | "ROLE_SELECTION"
  | "LOADING"
  | "ORIENTATION"
  | "ACTIVITY"
  | "WAITING"
  | "PAUSED"
  | "RECOVERY"
  | "SUMMARY"
  | "DELETED";

export interface SyntheticAppContentSet {
  readonly definition: WordProofDefinition;
  readonly content: HumanFirstContentBundle;
}

export interface HumanSupportRecord {
  readonly source: "ADULT";
  readonly action: "MODEL";
  readonly cardId: string;
}

interface AppJourneyViewBase {
  readonly locale: Locale;
  readonly screen: AppJourneyScreen;
  readonly lifecycleState: LifecycleState;
  readonly dataClassification: "SYNTHETIC_TECHNICAL_DRAFT";
  readonly selectedRole: LifecycleRole | undefined;
  readonly canStartNewSession: boolean;
  readonly lastErrorCode: string | undefined;
  readonly terminalReconnectProved: boolean;
  readonly activityStage: WordProofStage;
}

export interface AppJourneyUnselectedView extends AppJourneyViewBase {
  readonly selectedRole: undefined;
}

export interface ChildAppJourneyView extends AppJourneyViewBase {
  readonly selectedRole: "CHILD";
  readonly childStatus: string;
  readonly taskPrompt: string | undefined;
  readonly tiles: readonly GraphemeTile[];
  readonly selectedGraphemes: readonly string[];
  readonly modelWord: string | undefined;
  readonly feedbackCode: WordProofFeedbackCode;
  readonly quietMode: boolean;
}

export interface AdultAppJourneyView extends AppJourneyViewBase {
  readonly selectedRole: "ADULT";
  readonly sessionReference: string | undefined;
  readonly observedVersion: number;
  readonly observedChildChoices: readonly string[];
  readonly adultCard: HumanFirstContentBundle["adultCard"] | undefined;
  readonly knowledgeReference: string;
  readonly humanDecisionRequired: boolean;
  readonly supportProvenance: readonly HumanSupportRecord[];
}

export type SyntheticAppJourneyView =
  | AppJourneyUnselectedView
  | ChildAppJourneyView
  | AdultAppJourneyView;

function screenFor(
  state: LifecycleState,
  selectedRole: LifecycleRole | undefined,
): AppJourneyScreen {
  if (state === "NOT_CREATED") return "WELCOME";
  if (selectedRole === undefined) return "ROLE_SELECTION";
  switch (state) {
    case "CREATING": return "LOADING";
    case "READY": return "ORIENTATION";
    case "ACTIVE": return "ACTIVITY";
    case "WAITING": return "WAITING";
    case "PAUSED": return "PAUSED";
    case "STALE":
    case "INVALID":
    case "RECOVERING": return "RECOVERY";
    case "STOPPED":
    case "COMPLETED": return "SUMMARY";
    case "DELETED": return "DELETED";
  }
}

export class SyntheticAppNavigationController {
  readonly #repository: LifecycleSessionRepositoryPort;
  readonly #clock: ClockPort;
  readonly #idGenerator: IdGenerationPort;
  readonly #transport: ReconnectTransportPort;
  readonly #observability: LifecycleObservabilityPort;
  readonly #contentByLocale: Readonly<Record<Locale, SyntheticAppContentSet>>;
  #lifecycle: SessionLifecycleController;
  #definition: WordProofDefinition;
  #content: HumanFirstContentBundle;
  #proof: WordProofState;
  #selectedRole: LifecycleRole | undefined;
  #quietMode = false;
  #cardDismissed = false;
  #terminalReconnectProved = false;
  #supportProvenance: HumanSupportRecord[] = [];

  public constructor(input: {
    readonly locale: Locale;
    readonly repository: LifecycleSessionRepositoryPort;
    readonly clock: ClockPort;
    readonly idGenerator: IdGenerationPort;
    readonly transport: ReconnectTransportPort;
    readonly observability: LifecycleObservabilityPort;
    readonly contentByLocale: Readonly<Record<Locale, SyntheticAppContentSet>>;
  }) {
    this.#repository = input.repository;
    this.#clock = input.clock;
    this.#idGenerator = input.idGenerator;
    this.#transport = input.transport;
    this.#observability = input.observability;
    this.#contentByLocale = input.contentByLocale;
    const contentSet = this.#contentByLocale[input.locale];
    this.#definition = contentSet.definition;
    this.#content = contentSet.content;
    this.#proof = createWordProofState(this.#definition, 0);
    this.#lifecycle = this.#createLifecycle(input.locale);
  }

  #createLifecycle(locale: Locale): SessionLifecycleController {
    return new SessionLifecycleController(
      locale,
      this.#repository,
      this.#clock,
      this.#idGenerator,
      this.#transport,
      this.#observability,
    );
  }

  public get sessionId(): string {
    return this.#lifecycle.sessionId;
  }

  public get view(): SyntheticAppJourneyView {
    const lifecycleView = this.#lifecycle.view;
    const common: AppJourneyViewBase = {
      locale: lifecycleView.locale,
      screen: screenFor(lifecycleView.state, this.#selectedRole),
      lifecycleState: lifecycleView.state,
      dataClassification: lifecycleView.dataClassification,
      selectedRole: this.#selectedRole,
      canStartNewSession: ["STOPPED", "DELETED", "COMPLETED"].includes(lifecycleView.state),
      lastErrorCode: lifecycleView.error?.code,
      terminalReconnectProved: this.#terminalReconnectProved,
      activityStage: this.#proof.stage,
    };
    if (this.#selectedRole === undefined) return { ...common, selectedRole: undefined };

    const task = currentTask(this.#proof, this.#definition);
    if (this.#selectedRole === "CHILD") {
      return {
        ...common,
        selectedRole: "CHILD",
        childStatus: lifecycleView.state,
        taskPrompt: task?.meaningPrompt,
        tiles: task?.tiles ?? [],
        selectedGraphemes: this.#proof.selectedGraphemes,
        modelWord: this.#proof.modelVisible ? task?.word : undefined,
        feedbackCode: this.#proof.feedbackCode,
        quietMode: this.#quietMode,
      };
    }

    const adultLifecycle = lifecycleView.role === "ADULT"
      ? lifecycleView
      : this.#lifecycle.selectRole("ADULT");
    if (adultLifecycle.role !== "ADULT") throw new Error("adult projection unavailable");
    return {
      ...common,
      selectedRole: "ADULT",
      sessionReference: adultLifecycle.sessionReference,
      observedVersion: adultLifecycle.observedVersion,
      observedChildChoices: this.#proof.selectedGraphemes,
      adultCard: adultLifecycle.state === "WAITING"
        && adultLifecycle.adultDetail === "SYNTHETIC_HELP_REQUESTED"
        && !this.#cardDismissed
        ? this.#content.adultCard
        : undefined,
      knowledgeReference: this.#content.adultCard.knowledgeId,
      humanDecisionRequired: adultLifecycle.state === "WAITING",
      supportProvenance: this.#supportProvenance,
    };
  }

  public setLocale(locale: Locale): SyntheticAppJourneyView {
    if (this.#lifecycle.view.state !== "NOT_CREATED" || this.#selectedRole !== undefined) {
      throw new Error("language can only change before a synthetic session is created");
    }
    const contentSet = this.#contentByLocale[locale];
    this.#definition = contentSet.definition;
    this.#content = contentSet.content;
    this.#proof = createWordProofState(this.#definition, 0);
    this.#lifecycle = this.#createLifecycle(locale);
    return this.view;
  }

  public createSession(): SyntheticAppJourneyView {
    this.#lifecycle.perform("CREATE");
    return this.view;
  }

  public selectRole(role: LifecycleRole): SyntheticAppJourneyView {
    this.#selectedRole = role;
    this.#lifecycle.selectRole(role);
    return this.view;
  }

  public finishLoading(): SyntheticAppJourneyView {
    this.#lifecycle.perform("CREATED");
    return this.view;
  }

  public startActivity(): SyntheticAppJourneyView {
    this.#lifecycle.perform("ACTIVATE");
    return this.view;
  }

  #transitionProof(command: Parameters<typeof transitionWordProof>[2]): void {
    if (this.#lifecycle.view.state !== "ACTIVE") return;
    const result = transitionWordProof(this.#proof, this.#definition, command);
    this.#proof = result.state;
  }

  public selectTile(tileId: string): SyntheticAppJourneyView {
    this.#transitionProof({ kind: "SELECT_TILE", tileId });
    return this.view;
  }

  public removeLastTile(): SyntheticAppJourneyView {
    this.#transitionProof({ kind: "REMOVE_LAST_TILE" });
    return this.view;
  }

  public submitBuild(): SyntheticAppJourneyView {
    this.#transitionProof({ kind: "SUBMIT_BUILD" });
    return this.view;
  }

  public enterWait(): SyntheticAppJourneyView {
    this.#lifecycle.perform("ENTER_WAIT");
    return this.view;
  }

  public requestHelp(): SyntheticAppJourneyView {
    this.#cardDismissed = false;
    this.#lifecycle.perform("REQUEST_HELP");
    return this.view;
  }

  #dismissAdultCard(): void {
    this.#cardDismissed = true;
  }

  public adultWait(): SyntheticAppJourneyView {
    if (this.#selectedRole === "ADULT" && this.#lifecycle.view.state === "WAITING") {
      this.#dismissAdultCard();
    }
    return this.view;
  }

  public adultModel(): SyntheticAppJourneyView {
    if (this.#selectedRole === "ADULT" && this.#lifecycle.view.state === "WAITING") {
      this.#supportProvenance.push({
        source: "ADULT",
        action: "MODEL",
        cardId: this.#content.adultCard.cardId,
      });
      this.#dismissAdultCard();
      const result = transitionWordProof(this.#proof, this.#definition, { kind: "REVEAL_MODEL" });
      this.#proof = result.state;
    }
    return this.view;
  }

  public adultDismiss(): SyntheticAppJourneyView {
    if (this.#selectedRole === "ADULT" && this.#lifecycle.view.state === "WAITING") {
      this.#dismissAdultCard();
    }
    return this.view;
  }

  public confirmReading(): SyntheticAppJourneyView {
    if (this.#selectedRole !== "ADULT" || this.#lifecycle.view.state !== "ACTIVE") return this.view;
    const result = transitionWordProof(this.#proof, this.#definition, {
      kind: "ADULT_CONFIRM_READING",
      currentSupportCount: this.#supportProvenance.length,
    });
    this.#proof = result.state;
    if (result.accepted && this.#proof.stage === "COMPLETED") this.#lifecycle.perform("COMPLETE");
    return this.view;
  }

  public requestQuiet(): SyntheticAppJourneyView {
    if (this.#lifecycle.view.state === "ACTIVE") {
      this.#quietMode = true;
      this.#proof = transitionWordProof(this.#proof, this.#definition, { kind: "SET_QUIET" }).state;
    }
    return this.view;
  }

  public pause(): SyntheticAppJourneyView {
    this.#lifecycle.perform("PAUSE");
    this.#proof = transitionWordProof(this.#proof, this.#definition, { kind: "SET_PAUSED" }).state;
    return this.view;
  }

  public resume(): SyntheticAppJourneyView {
    this.#lifecycle.perform("RESUME");
    return this.view;
  }

  public stop(): SyntheticAppJourneyView {
    const before = this.#lifecycle.view.state;
    this.#lifecycle.perform("STOP");
    if (before !== this.#lifecycle.view.state) {
      this.#proof = transitionWordProof(this.#proof, this.#definition, { kind: "STOP" }).state;
    }
    return this.view;
  }

  public reconnect(): SyntheticAppJourneyView {
    const before = this.#lifecycle.view.state;
    this.#lifecycle.perform("RECONNECT");
    const after = this.#lifecycle.view.state;
    if ((before === "STOPPED" && after === "STOPPED") || (before === "DELETED" && after === "DELETED")) {
      this.#terminalReconnectProved = true;
    }
    return this.view;
  }

  public detectStale(): SyntheticAppJourneyView {
    this.#lifecycle.perform("DETECT_STALE");
    return this.view;
  }

  public beginRecovery(): SyntheticAppJourneyView {
    this.#lifecycle.perform("BEGIN_RECOVERY");
    return this.view;
  }

  public finishRecovery(): SyntheticAppJourneyView {
    this.#lifecycle.perform("RECOVERY_SUCCEEDED");
    return this.view;
  }

  public deleteSession(): SyntheticAppJourneyView {
    this.#lifecycle.perform("DELETE");
    return this.view;
  }

  public startNewSession(): SyntheticAppJourneyView {
    if (!["STOPPED", "DELETED", "COMPLETED"].includes(this.#lifecycle.view.state)) return this.view;
    const locale = this.#lifecycle.view.locale;
    this.#lifecycle = this.#createLifecycle(locale);
    this.#proof = createWordProofState(this.#definition, 0);
    this.#selectedRole = undefined;
    this.#quietMode = false;
    this.#cardDismissed = false;
    this.#terminalReconnectProved = false;
    this.#supportProvenance = [];
    return this.view;
  }
}
