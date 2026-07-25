import type {
  AdultAppJourneyView,
  ChildAppJourneyView,
  SyntheticAppJourneyView,
} from "../../application/synthetic-app-navigation-controller.js";
import type { Locale } from "../../core/content-contracts.js";
import type { WordProofFeedbackCode } from "../../core/word-proof.js";

interface AppCopy {
  readonly skip: string;
  readonly eyebrow: string;
  readonly product: string;
  readonly language: string;
  readonly welcomeTitle: string;
  readonly disclosure: string;
  readonly privacy: string;
  readonly create: string;
  readonly chooseRole: string;
  readonly childRole: string;
  readonly adultRole: string;
  readonly loadingTitle: string;
  readonly loadingBody: string;
  readonly finishLoading: string;
  readonly orientationTitle: string;
  readonly orientationBody: string;
  readonly begin: string;
  readonly childTitle: string;
  readonly adultTitle: string;
  readonly switchChild: string;
  readonly switchAdult: string;
  readonly selected: string;
  readonly chooseLetters: string;
  readonly submit: string;
  readonly undo: string;
  readonly wait: string;
  readonly help: string;
  readonly quiet: string;
  readonly pause: string;
  readonly resume: string;
  readonly stop: string;
  readonly reconnect: string;
  readonly simulateLoss: string;
  readonly beginRecovery: string;
  readonly finishRecovery: string;
  readonly confirmReading: string;
  readonly state: string;
  readonly sameSession: string;
  readonly choices: string;
  readonly humanDecision: string;
  readonly systemLimits: string;
  readonly summaryTitle: string;
  readonly completed: string;
  readonly stopped: string;
  readonly deleteSession: string;
  readonly newSession: string;
  readonly deletedTitle: string;
  readonly deletedBody: string;
  readonly terminalProof: string;
  readonly provenance: string;
  readonly dismiss: string;
  readonly showModel: string;
  readonly knowledge: string;
  readonly noChoice: string;
  readonly quietStatus: string;
  readonly selectLetter: string;
  readonly modelLabel: string;
  readonly builtStatus: string;
  readonly transparencyTitle: string;
  readonly sessionReference: string;
  readonly deletedReference: string;
  readonly version: string;
  readonly adultCardTitle: string;
  readonly sayLabel: string;
  readonly avoidLabel: string;
  readonly boundaryTitle: string;
  readonly waitingStatus: string;
  readonly pausedStatus: string;
  readonly recoveryTitle: string;
  readonly recoveryStatus: string;
  readonly noProvenance: string;
  readonly corpusTitle: string;
  readonly corpusBoundary: string;
  readonly normalMode: string;
  readonly reviewMode: string;
  readonly classHeading: string;
  readonly activityHeading: string;
  readonly targetLabel: string;
  readonly transferLabel: string;
  readonly reviewDecision: string;
  readonly lifecycle: string;
  readonly reviewOnly: string;
  readonly blocked: string;
  readonly understandLabel: string;
  readonly deepenLabel: string;
  readonly expiresLabel: string;
  readonly showPrompt: string;
  readonly context: string;
  readonly evidence: string;
  readonly audioSpec: string;
  readonly noAutomaticPlacement: string;
  readonly cannotProveLabel: string;
}

export const appCopy: Readonly<Record<Locale, AppCopy>> = {
  "nb-NO": {
    skip: "Hopp til hovedinnholdet",
    eyebrow: "WP13.8 · lokalt review-gated corpusutkast",
    product: "LUDYS – sammenhengende appreise",
    language: "Målform",
    welcomeTitle: "Velkommen til en lokal demonstrasjon",
    disclosure: "Alt i denne reisen er syntetisk proof-innhold. Dette er ikke en ekte brukerøkt.",
    privacy: "Ingen innlogging, stabil brukeridentitet, nettverkstjeneste eller produksjonslagring brukes.",
    create: "Opprett ny syntetisk økt",
    chooseRole: "Velg hvilken visning du vil starte med",
    childRole: "Start med barnets visning",
    adultRole: "Start med den voksnes visning",
    loadingTitle: "Klargjør lokal økt",
    loadingBody: "Økten opprettes bare i minnet. Ingen data sendes ut av appen.",
    finishLoading: "Fullfør lokal klargjøring",
    orientationTitle: "Før aktiviteten",
    orientationBody: "Bygg to korte proof-ord. Du kan vente, be et menneske om hjelp, velge arbeidsro, pause eller stoppe.",
    begin: "Start aktiviteten",
    childTitle: "Barnets aktivitet",
    adultTitle: "Den voksnes oversikt",
    switchChild: "Vis barnets side",
    switchAdult: "Vis den voksnes side",
    selected: "Valgte bokstaver",
    chooseLetters: "Velg bokstavene i riktig rekkefølge.",
    submit: "Prøv ordet",
    undo: "Angre siste bokstav",
    wait: "Vent litt",
    help: "Be et menneske om hjelp",
    quiet: "Velg arbeidsro",
    pause: "Pause",
    resume: "Fortsett",
    stop: "Stopp økten",
    reconnect: "Kontroller reconnect",
    simulateLoss: "Simuler avbrudd",
    beginRecovery: "Start lokal gjenoppretting",
    finishRecovery: "Fullfør gjenoppretting",
    confirmReading: "Bekreft konkret lesing",
    state: "Observerbar økttilstand",
    sameSession: "Denne referansen gjelder den samme lokale økten som barnets side.",
    choices: "Barnets konkrete valg i denne økten",
    humanDecision: "Et menneske må vurdere hva som passer. Systemet avgjør ikke hvorfor hjelp ble bedt om.",
    systemLimits: "Systemet tolker ikke følelser, motivasjon, diagnose eller framtidig prestasjon.",
    summaryTitle: "Nøktern oppsummering",
    completed: "De to syntetiske proof-ordene ble fullført i denne lokale økten.",
    stopped: "Økten ble stoppet. Ventende aktivitet kan ikke fortsette.",
    deleteSession: "Slett den lokale økten",
    newSession: "Opprett en ny, separat økt",
    deletedTitle: "Økten er slettet",
    deletedBody: "En lokal tombstone hindrer at denne økten gjenopplives.",
    terminalProof: "Reconnect ble kontrollert: den terminale økten ble ikke gjenopplivet.",
    provenance: "Synlig menneskelig støtte i denne økten",
    dismiss: "Avvis forslaget",
    showModel: "Vis én modell",
    knowledge: "Relevant kunnskapsreferanse",
    noChoice: "Ingen bokstaver valgt ennå.",
    quietStatus: "Arbeidsro er valgt. Systemet kan være stille.",
    selectLetter: "Velg bokstaven",
    modelLabel: "Menneskestyrt modell",
    builtStatus: "Ordet er bygd. Be den voksne bekrefte den konkrete lesingen.",
    transparencyTitle: "Transparens",
    sessionReference: "Øktreferanse",
    deletedReference: "slettet",
    version: "Versjon",
    adultCardTitle: "Ett avvisbart voksenkort",
    sayLabel: "Kan si",
    avoidLabel: "Unngå",
    boundaryTitle: "Avgrensning",
    waitingStatus: "Systemet venter. Et menneske kan velge neste handling.",
    pausedStatus: "Aktiviteten er satt på pause.",
    recoveryTitle: "Lokal gjenoppretting",
    recoveryStatus: "Den autoritative lokale økten beholdes mens gjenoppretting kontrolleres.",
    noProvenance: "Ingen menneskelig støtte er valgt i denne økten.",
    corpusTitle: "Urevidert norsk draftcorpus",
    corpusBoundary: "Alt innhold er DRAFT, EXTERNAL_REVIEW_REQUIRED, SYNTHETIC_ONLY og NOT_STUDENT_BETA.",
    normalMode: "Vanlig syntetisk modus",
    reviewMode: "Reviewmodus",
    classHeading: "Fire foreløpige mønsterklasser",
    activityHeading: "Aktiviteter i valgt klasse",
    targetLabel: "Måloppgave",
    transferLabel: "Separat transfer",
    reviewDecision: "Intern PEX-A01-status",
    lifecycle: "Content-lifecycle",
    reviewOnly: "Bare reviewmodus",
    blocked: "Aktiviteten kan ikke startes i denne modusen eller lifecycle-statusen.",
    understandLabel: "Forstå",
    deepenLabel: "Fordyp deg",
    expiresLabel: "Utløper",
    showPrompt: "Gi ett konkret hint",
    context: "Kontekstreferanse",
    evidence: "Separate forsøk og støttebevis",
    audioSpec: "Vis lydspesifikasjon",
    noAutomaticPlacement: "En voksen velger. Systemet bruker ingen samlet score og gjør ingen automatisk nivåplassering.",
    cannotProveLabel: "Kan ikke bevise",
  },
  "nn-NO": {
    skip: "Hopp til hovudinnhaldet",
    eyebrow: "WP13.8 · lokalt review-gated korpusutkast",
    product: "LUDYS – samanhengande appreise",
    language: "Målform",
    welcomeTitle: "Velkomen til ein lokal demonstrasjon",
    disclosure: "Alt i denne reisa er syntetisk proof-innhald. Dette er ikkje ei ekte brukarøkt.",
    privacy: "Ingen innlogging, stabil brukaridentitet, nettverksteneste eller produksjonslagring blir brukt.",
    create: "Opprett ny syntetisk økt",
    chooseRole: "Vel kva visning du vil starte med",
    childRole: "Start med barnet si visning",
    adultRole: "Start med den vaksne si visning",
    loadingTitle: "Gjer klar lokal økt",
    loadingBody: "Økta blir berre oppretta i minnet. Ingen data blir sende ut av appen.",
    finishLoading: "Fullfør lokal klargjering",
    orientationTitle: "Før aktiviteten",
    orientationBody: "Bygg to korte proof-ord. Du kan vente, be eit menneske om hjelp, velje arbeidsro, ta pause eller stoppe.",
    begin: "Start aktiviteten",
    childTitle: "Barnet sin aktivitet",
    adultTitle: "Den vaksne si oversikt",
    switchChild: "Vis barnet si side",
    switchAdult: "Vis den vaksne si side",
    selected: "Valde bokstavar",
    chooseLetters: "Vel bokstavane i rett rekkjefølgje.",
    submit: "Prøv ordet",
    undo: "Angre siste bokstav",
    wait: "Vent litt",
    help: "Be eit menneske om hjelp",
    quiet: "Vel arbeidsro",
    pause: "Pause",
    resume: "Hald fram",
    stop: "Stopp økta",
    reconnect: "Kontroller reconnect",
    simulateLoss: "Simuler avbrot",
    beginRecovery: "Start lokal gjenoppretting",
    finishRecovery: "Fullfør gjenoppretting",
    confirmReading: "Stadfest konkret lesing",
    state: "Observerbar økttilstand",
    sameSession: "Denne referansen gjeld den same lokale økta som barnet si side.",
    choices: "Barnet sine konkrete val i denne økta",
    humanDecision: "Eit menneske må vurdere kva som passar. Systemet avgjer ikkje kvifor hjelp vart etterspurd.",
    systemLimits: "Systemet tolkar ikkje kjensler, motivasjon, diagnose eller framtidig prestasjon.",
    summaryTitle: "Nøktern oppsummering",
    completed: "Dei to syntetiske proof-orda vart fullførte i denne lokale økta.",
    stopped: "Økta vart stoppa. Ventande aktivitet kan ikkje halde fram.",
    deleteSession: "Slett den lokale økta",
    newSession: "Opprett ei ny, separat økt",
    deletedTitle: "Økta er sletta",
    deletedBody: "Ein lokal tombstone hindrar at denne økta blir gjenoppliva.",
    terminalProof: "Reconnect vart kontrollert: den terminale økta vart ikkje gjenoppliva.",
    provenance: "Synleg menneskeleg støtte i denne økta",
    dismiss: "Avvis framlegget",
    showModel: "Vis éin modell",
    knowledge: "Relevant kunnskapsreferanse",
    noChoice: "Ingen bokstavar valde enno.",
    quietStatus: "Arbeidsro er valt. Systemet kan vere stille.",
    selectLetter: "Vel bokstaven",
    modelLabel: "Menneskestyrt modell",
    builtStatus: "Ordet er bygd. Be den vaksne stadfeste den konkrete lesinga.",
    transparencyTitle: "Transparens",
    sessionReference: "Øktreferanse",
    deletedReference: "sletta",
    version: "Versjon",
    adultCardTitle: "Eitt avvisbart vaksenkort",
    sayLabel: "Kan seie",
    avoidLabel: "Unngå",
    boundaryTitle: "Avgrensing",
    waitingStatus: "Systemet ventar. Eit menneske kan velje neste handling.",
    pausedStatus: "Aktiviteten er sett på pause.",
    recoveryTitle: "Lokal gjenoppretting",
    recoveryStatus: "Den autoritative lokale økta blir halden ved lag medan gjenopprettinga blir kontrollert.",
    noProvenance: "Ingen menneskeleg støtte er vald i denne økta.",
    corpusTitle: "Urevidert norsk utkastkorpus",
    corpusBoundary: "Alt innhald er DRAFT, EXTERNAL_REVIEW_REQUIRED, SYNTHETIC_ONLY og NOT_STUDENT_BETA.",
    normalMode: "Vanleg syntetisk modus",
    reviewMode: "Reviewmodus",
    classHeading: "Fire førebelse mønsterklassar",
    activityHeading: "Aktivitetar i vald klasse",
    targetLabel: "Måloppgåve",
    transferLabel: "Separat transfer",
    reviewDecision: "Intern PEX-A01-status",
    lifecycle: "Content-lifecycle",
    reviewOnly: "Berre reviewmodus",
    blocked: "Aktiviteten kan ikkje startast i denne modusen eller lifecycle-statusen.",
    understandLabel: "Forstå",
    deepenLabel: "Fordjup deg",
    expiresLabel: "Går ut",
    showPrompt: "Gi eitt konkret hint",
    context: "Kontekstreferanse",
    evidence: "Separate forsøk og støttebevis",
    audioSpec: "Vis lydspesifikasjon",
    noAutomaticPlacement: "Ein vaksen vel. Systemet bruker ingen samla skår og gjer inga automatisk nivåplassering.",
    cannotProveLabel: "Kan ikkje bevise",
  },
};

const feedbackText: Readonly<Record<Locale, Readonly<Record<WordProofFeedbackCode, string>>>> = {
  "nb-NO": {
    READY: "Klar.",
    TILE_SELECTED: "Bokstaven er valgt.",
    TRY_AGAIN: "Se på lydene og prøv én bokstav om gangen.",
    WORD_BUILT_READ_TO_ADULT: "Ordet er bygd. Les det for den voksne.",
    TARGET_CONFIRMED: "Det første ordet er bekreftet. Nå kommer et nytt ord.",
    TRANSFER_CONFIRMED: "Det andre ordet er bekreftet.",
    QUIET: "Arbeidsro er valgt.",
    PAUSED: "Aktiviteten er satt på pause.",
    STOPPED: "Aktiviteten er stoppet.",
  },
  "nn-NO": {
    READY: "Klar.",
    TILE_SELECTED: "Bokstaven er vald.",
    TRY_AGAIN: "Sjå på lydane og prøv éin bokstav om gongen.",
    WORD_BUILT_READ_TO_ADULT: "Ordet er bygd. Les det for den vaksne.",
    TARGET_CONFIRMED: "Det første ordet er stadfesta. No kjem eit nytt ord.",
    TRANSFER_CONFIRMED: "Det andre ordet er stadfesta.",
    QUIET: "Arbeidsro er valt.",
    PAUSED: "Aktiviteten er sett på pause.",
    STOPPED: "Aktiviteten er stoppa.",
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function action(action: string, label: string, className = "", disabled = false): string {
  return `<button type="button" data-app-action="${action}" class="${className}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
}

function renderCorpusOverview(view: SyntheticAppJourneyView, copy: AppCopy): string {
  const selectedClass = view.corpus.patternClasses.find((item) => item.selected);
  const activities = view.corpus.activities.filter(
    (item) => item.patternClassId === view.corpus.selectedPatternClassId && item.visible,
  );
  return `<section class="corpus-overview" aria-labelledby="corpus-title" data-corpus-mode="${view.corpus.mode}">
    <h3 id="corpus-title">${escapeHtml(copy.corpusTitle)}</h3>
    <p class="corpus-boundary">${escapeHtml(copy.corpusBoundary)}</p>
    <div class="corpus-badges" aria-label="Draftstatus"><span>${view.corpus.status}</span><span>${view.corpus.reviewStatus}</span><span>${view.corpus.evidenceStatus}</span><span>${view.corpus.betaStatus}</span></div>
    <div class="button-row corpus-mode-switch" aria-label="${escapeHtml(copy.reviewMode)}">
      <button type="button" data-corpus-mode="NORMAL_SYNTHETIC" aria-pressed="${String(view.corpus.mode === "NORMAL_SYNTHETIC")}">${escapeHtml(copy.normalMode)}</button>
      <button type="button" data-corpus-mode="REVIEW" aria-pressed="${String(view.corpus.mode === "REVIEW")}">${escapeHtml(copy.reviewMode)}</button>
    </div>
    <h4>${escapeHtml(copy.classHeading)}</h4>
    <div class="corpus-class-grid">${view.corpus.patternClasses.map((item) => `<button type="button" data-pattern-class-id="${escapeHtml(item.patternClassId)}" aria-pressed="${String(item.selected)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.patternClassId)}</span><span>${escapeHtml(item.lifecycleStatus)}</span></button>`).join("")}</div>
    ${selectedClass === undefined ? "" : `<aside class="corpus-safety"><p>${escapeHtml(selectedClass.safetySummary)}</p><p><strong>${escapeHtml(copy.cannotProveLabel)}:</strong> ${escapeHtml(selectedClass.cannotProve)}</p></aside>`}
    <h4>${escapeHtml(copy.activityHeading)}</h4>
    <div class="corpus-activity-grid">${activities.map((item) => `<article data-corpus-activity-card="${escapeHtml(item.activityId)}" data-review-decision="${item.internalReviewDecision}">
      <h5>${escapeHtml(item.title)}</h5>
      <p><strong>${escapeHtml(copy.targetLabel)}:</strong> ${escapeHtml(item.target)} · <strong>${escapeHtml(copy.transferLabel)}:</strong> ${escapeHtml(item.transfer)}</p>
      <p><strong>${escapeHtml(copy.reviewDecision)}:</strong> ${escapeHtml(item.internalReviewDecision)}</p>
      <p><strong>${escapeHtml(copy.lifecycle)}:</strong> ${escapeHtml(item.lifecycleStatus)}</p>
      ${item.internalReviewDecision === "CHANGES_REQUIRED" ? `<p class="review-only">${escapeHtml(copy.reviewOnly)}</p>` : ""}
      <button type="button" data-corpus-activity-id="${escapeHtml(item.activityId)}" aria-pressed="${String(item.selected)}" ${item.selectable ? "" : "disabled"}>${escapeHtml(item.selected ? item.title : `${copy.activityHeading}: ${item.title}`)}</button>
    </article>`).join("")}</div>
    ${view.corpus.lastBlockReason === undefined ? "" : `<p class="corpus-block" role="alert">${escapeHtml(copy.blocked)} ${escapeHtml(view.corpus.lastBlockReason)}</p>`}
    <p class="no-placement">${escapeHtml(copy.noAutomaticPlacement)}</p>
  </section>`;
}

function roleNavigation(view: SyntheticAppJourneyView, copy: AppCopy): string {
  if (view.selectedRole === undefined) return "";
  return `<nav class="app-role-nav" aria-label="${escapeHtml(copy.chooseRole)}">
    <button type="button" data-app-role="CHILD" aria-pressed="${String(view.selectedRole === "CHILD")}">${escapeHtml(copy.switchChild)}</button>
    <button type="button" data-app-role="ADULT" aria-pressed="${String(view.selectedRole === "ADULT")}">${escapeHtml(copy.switchAdult)}</button>
  </nav>`;
}

function sessionActions(copy: AppCopy, includeResume = false): string {
  return `<div class="button-row app-session-actions">
    ${includeResume ? action("resume", copy.resume) : ""}
    ${action("pause", copy.pause)}
    ${action("stop", copy.stop, "danger-action")}
  </div>`;
}

function renderChildActivity(view: ChildAppJourneyView, copy: AppCopy): string {
  const readConfirmation = view.activityStage.endsWith("READ_CONFIRMATION");
  const choices = view.selectedGraphemes.length === 0
    ? `<span>${escapeHtml(copy.noChoice)}</span>`
    : view.selectedGraphemes.map((value) => `<span class="selected-tile">${escapeHtml(value)}</span>`).join("");
  return `<section class="journey-card child-view" aria-labelledby="screen-title">
    <p class="eyebrow">${escapeHtml(copy.childTitle)}</p>
    <h2 id="screen-title" tabindex="-1">${escapeHtml(view.activityTitle)}</h2>
    <p class="draft-status">DRAFT · EXTERNAL_REVIEW_REQUIRED · SYNTHETIC_ONLY · NOT_STUDENT_BETA</p>
    <p>${escapeHtml(view.taskPrompt ?? copy.summaryTitle)}</p>
    <p>${escapeHtml(copy.chooseLetters)}</p>
    ${view.modelWord === undefined ? "" : `<p class="model-panel">${escapeHtml(copy.modelLabel)}: <strong>${escapeHtml(view.modelWord)}</strong></p>`}
    <div class="selected-word" aria-label="${escapeHtml(copy.selected)}">${choices}</div>
    ${readConfirmation
      ? `<p role="status">${escapeHtml(copy.builtStatus)}</p>`
      : `<div class="tile-grid">${view.tiles.map((tile) => `<button type="button" data-app-action="select-tile" data-tile-id="${escapeHtml(tile.tileId)}" aria-label="${escapeHtml(copy.selectLetter)} ${escapeHtml(tile.grapheme)}">${escapeHtml(tile.grapheme)}</button>`).join("")}</div>
         <div class="button-row">${action("undo", copy.undo)}${action("submit", copy.submit)}</div>`}
    <p class="status-line" role="status">${escapeHtml(feedbackText[view.locale][view.feedbackCode])}</p>
    <p class="draft-feedback" data-draft-feedback>${escapeHtml(view.draftFeedback)}</p>
    ${view.quietMode ? `<p class="quiet-panel">${escapeHtml(copy.quietStatus)}</p>` : ""}
    <div class="button-row">${action("wait", copy.wait)}${action("help", copy.help)}${action("quiet", copy.quiet)}${action("audio-spec", copy.audioSpec)}</div>
    <p data-audio-state>${escapeHtml(view.audioState)}</p>
    ${sessionActions(copy)}
    <div class="button-row">${action("reconnect", copy.reconnect)}${action("detect-stale", copy.simulateLoss)}</div>
    <aside class="transparency-panel"><h3>${escapeHtml(copy.transparencyTitle)}</h3><p>${escapeHtml(copy.systemLimits)}</p></aside>
  </section>`;
}

function renderAdultActivity(view: AdultAppJourneyView, copy: AppCopy): string {
  const choices = view.observedChildChoices.length === 0 ? copy.noChoice : view.observedChildChoices.join(" · ");
  const card = view.adultCard;
  return `<section class="journey-card adult-view" aria-labelledby="screen-title">
    <p class="eyebrow">${escapeHtml(copy.adultTitle)}</p>
    <h2 id="screen-title" tabindex="-1">${escapeHtml(copy.state)}: ${escapeHtml(view.lifecycleState)}</h2>
    <p>${escapeHtml(copy.sameSession)}</p>
    <dl class="observable-state">
      <div><dt>${escapeHtml(copy.sessionReference)}</dt><dd data-session-reference>${escapeHtml(view.sessionReference ?? copy.deletedReference)}</dd></div>
      <div><dt>${escapeHtml(copy.version)}</dt><dd>${view.observedVersion}</dd></div>
      <div><dt>${escapeHtml(copy.choices)}</dt><dd>${escapeHtml(choices)}</dd></div>
    </dl>
    ${view.humanDecisionRequired ? `<p class="human-decision" role="status">${escapeHtml(copy.humanDecision)}</p>` : ""}
    ${card === undefined ? "" : `<article class="adult-card" aria-labelledby="adult-card-title">
      <h3 id="adult-card-title">${escapeHtml(copy.adultCardTitle)}</h3>
      <p><strong>${escapeHtml(copy.understandLabel)}:</strong> ${escapeHtml(card.understand)}</p>
      <p><strong>${escapeHtml(copy.sayLabel)}:</strong> ${escapeHtml(card.doOrSay)}</p>
      <p><strong>${escapeHtml(copy.avoidLabel)}:</strong> ${escapeHtml(card.avoid)}</p>
      <p><strong>${escapeHtml(copy.deepenLabel)}:</strong> ${escapeHtml(card.deepen)}</p>
      <p><strong>${escapeHtml(copy.expiresLabel)}:</strong> ${escapeHtml(card.expiresWhen)}</p>
      <div class="button-row">${action("adult-wait", copy.wait)}${action("adult-prompt", copy.showPrompt)}${action("adult-model", copy.showModel)}${action("adult-dismiss", copy.dismiss)}</div>
    </article>`}
    ${view.activityStage.endsWith("READ_CONFIRMATION") && view.lifecycleState === "ACTIVE" ? action("confirm-reading", copy.confirmReading) : ""}
    <p><strong>${escapeHtml(copy.knowledge)}:</strong> ${escapeHtml(view.knowledgeReference)} · ${escapeHtml(view.knowledgeSummary)}</p>
    <p><strong>${escapeHtml(copy.context)}:</strong> ${escapeHtml(view.contextReference)}</p>
    <section><h3>${escapeHtml(copy.provenance)}</h3>${view.supportProvenance.length === 0 ? `<p>${escapeHtml(copy.noProvenance)}</p>` : `<ul>${view.supportProvenance.map((item) => `<li>${escapeHtml(item.source)}: ${escapeHtml(item.action)} · ${escapeHtml(item.cardId)}</li>`).join("")}</ul>`}</section>
    <section><h3>${escapeHtml(copy.evidence)}</h3><ul data-attempt-evidence>${view.attemptEvidence.map((item) => `<li>${item.sequence}: ${item.kind} · ${item.evidence} · ${item.supportLevel}</li>`).join("")}</ul></section>
    ${view.lifecycleState === "WAITING" ? sessionActions(copy, true) : sessionActions(copy)}
    <div class="button-row">${action("reconnect", copy.reconnect)}${action("detect-stale", copy.simulateLoss)}</div>
    <aside class="transparency-panel"><h3>${escapeHtml(copy.boundaryTitle)}</h3><p>${escapeHtml(copy.systemLimits)}</p></aside>
  </section>`;
}

function renderCurrentScreen(view: SyntheticAppJourneyView, copy: AppCopy): string {
  switch (view.screen) {
    case "WELCOME":
      return `<section class="journey-card welcome-view" aria-labelledby="screen-title"><h2 id="screen-title" tabindex="-1">${escapeHtml(copy.welcomeTitle)}</h2><p class="synthetic-disclosure">${escapeHtml(copy.disclosure)}</p><p>${escapeHtml(copy.privacy)}</p>${action("create", copy.create, "primary-action")}</section>`;
    case "ROLE_SELECTION":
      return `<section class="journey-card" aria-labelledby="screen-title"><h2 id="screen-title" tabindex="-1">${escapeHtml(copy.chooseRole)}</h2><div class="role-choice">${action("role-child", copy.childRole)}${action("role-adult", copy.adultRole)}</div></section>`;
    case "LOADING":
      return `<section class="journey-card" aria-labelledby="screen-title" aria-busy="true"><h2 id="screen-title" tabindex="-1">${escapeHtml(copy.loadingTitle)}</h2><p role="status">${escapeHtml(copy.loadingBody)}</p>${action("finish-loading", copy.finishLoading, "primary-action")}</section>`;
    case "ORIENTATION":
      return `<section class="journey-card" aria-labelledby="screen-title"><h2 id="screen-title" tabindex="-1">${escapeHtml(copy.orientationTitle)}</h2><p>${escapeHtml(copy.orientationBody)}</p><p>${escapeHtml(copy.systemLimits)}</p>${renderCorpusOverview(view, copy)}${action("start", copy.begin, "primary-action", !view.corpus.canStartSelected)}</section>`;
    case "ACTIVITY":
      return view.selectedRole === "CHILD" ? renderChildActivity(view, copy) : view.selectedRole === "ADULT" ? renderAdultActivity(view, copy) : "";
    case "WAITING":
      return view.selectedRole === "ADULT"
        ? renderAdultActivity(view, copy)
        : `<section class="journey-card child-view" aria-labelledby="screen-title"><h2 id="screen-title" tabindex="-1">${escapeHtml(copy.wait)}</h2><p role="status">${escapeHtml(copy.waitingStatus)}</p><div class="button-row">${action("resume", copy.resume)}${action("stop", copy.stop, "danger-action")}</div><p>${escapeHtml(copy.systemLimits)}</p></section>`;
    case "PAUSED":
      return `<section class="journey-card" aria-labelledby="screen-title"><h2 id="screen-title" tabindex="-1">${escapeHtml(copy.pause)}</h2><p role="status">${escapeHtml(copy.pausedStatus)}</p><div class="button-row">${action("resume", copy.resume)}${action("stop", copy.stop, "danger-action")}</div></section>`;
    case "RECOVERY": {
      const actionMarkup = view.lifecycleState === "RECOVERING"
        ? action("finish-recovery", copy.finishRecovery, "primary-action")
        : action("begin-recovery", copy.beginRecovery, "primary-action");
      return `<section class="journey-card" aria-labelledby="screen-title"><h2 id="screen-title" tabindex="-1">${escapeHtml(copy.recoveryTitle)}: ${escapeHtml(view.lifecycleState)}</h2><p role="status">${escapeHtml(copy.recoveryStatus)}</p><div class="button-row">${actionMarkup}${action("stop", copy.stop, "danger-action")}</div></section>`;
    }
    case "SUMMARY": {
      const text = view.lifecycleState === "COMPLETED" ? copy.completed : copy.stopped;
      return `<section class="journey-card summary-view" aria-labelledby="screen-title"><h2 id="screen-title" tabindex="-1">${escapeHtml(copy.summaryTitle)}</h2><p role="status">${escapeHtml(text)}</p>${view.terminalReconnectProved ? `<p class="terminal-proof">${escapeHtml(copy.terminalProof)}</p>` : ""}<div class="button-row">${action("reconnect", copy.reconnect)}${action("delete", copy.deleteSession)}${action("new-session", copy.newSession)}</div></section>`;
    }
    case "DELETED":
      return `<section class="journey-card summary-view" aria-labelledby="screen-title"><h2 id="screen-title" tabindex="-1">${escapeHtml(copy.deletedTitle)}</h2><p role="status">${escapeHtml(copy.deletedBody)}</p>${view.terminalReconnectProved ? `<p class="terminal-proof">${escapeHtml(copy.terminalProof)}</p>` : ""}<div class="button-row">${action("reconnect", copy.reconnect)}${action("new-session", copy.newSession)}</div></section>`;
  }
}

export function renderSyntheticAppNavigation(view: SyntheticAppJourneyView): string {
  const copy = appCopy[view.locale];
  return `<a class="skip-link" href="#main-content">${escapeHtml(copy.skip)}</a>
    <header class="site-header app-header">
      <div><p class="eyebrow">${escapeHtml(copy.eyebrow)}</p><h1>${escapeHtml(copy.product)}</h1></div>
      <div class="header-actions"><button type="button" data-authoring-action="open">Åpne innholdsverksted</button><button type="button" data-operations-action="open">Betaoperasjon</button><button type="button" data-provider-decision-action="open">${view.locale === "nb-NO" ? "Providerbeslutning" : "Provideravgjerd"}</button><label class="locale-control"><span>${escapeHtml(copy.language)}</span><select id="app-locale" ${view.lifecycleState === "NOT_CREATED" && view.selectedRole === undefined ? "" : "disabled"}><option value="nb-NO" ${view.locale === "nb-NO" ? "selected" : ""}>Bokmål</option><option value="nn-NO" ${view.locale === "nn-NO" ? "selected" : ""}>Nynorsk</option></select></label></div>
    </header>
    <div class="classification-banner" data-synthetic-marker="${view.dataClassification}">${escapeHtml(copy.disclosure)}</div>
    ${roleNavigation(view, copy)}
    <main id="main-content" tabindex="-1">${renderCurrentScreen(view, copy)}</main>
    <div id="app-status" class="sr-only" role="status" aria-live="polite"></div>
    <div id="app-alert" class="sr-only" role="alert" aria-live="assertive">${view.lastErrorCode === undefined ? "" : escapeHtml(view.lastErrorCode)}</div>`;
}
