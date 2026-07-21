import { projectVerticalAdult, projectVerticalChild } from "../../application/projections/vertical-proof.js";
import type { VerticalProofSnapshot } from "../../application/vertical-proof-controller.js";
import type { Locale } from "../../core/content-contracts.js";

export const uiText = {
  "nb-NO": {
    childTitle: "Barneside", adultTitle: "Voksenside", taskTitle: "Bygg ordet lyd for lyd",
    instruction: "Se på lydene. Velg bokstavene i samme rekkefølge.", selected: "Ordet du bygger",
    available: "Bokstaver du kan velge", check: "Sjekk ordet", undo: "Ta bort siste",
    clear: "Start ordet på nytt", help: "Be den voksne om hjelp", quiet: "Arbeidsro",
    pause: "Pause", resume: "Fortsett", stop: "Stopp aktiviteten", audio: "Hør lydene",
    audioStub: "Lydstubben er ikke spilt inn. Lydene står på skjermen.", transparency: "Hva ser den voksne?",
    phase: "Økttilstand", model: "Modell valgt av den voksne",
    ready: "Velg bokstavene i samme rekkefølge som lydene.", tile: "Bokstaven er lagt til.",
    tryAgain: "Se på lydene. Prøv én bokstav om gangen.", read: "Ordet er bygd. Les det høyt for den voksne.",
    target: "Du brukte lydene til å bygge sol. Nå prøver du et nytt ord.",
    transfer: "Du brukte samme måte på et nytt ord: mus.", quietOn: "Arbeidsro er på.",
    paused: "Aktiviteten er satt på pause.", stopped: "Aktiviteten er stoppet.",
    adultIntro: "Du ser den samme syntetiske økten. Bruk eget skjønn.", adultBuilt: "Barnet har valgt",
    noCard: "Ingen voksenhandling er nødvendig nå.", wait: "Vent", showModel: "Vis én modell",
    confirm: "Jeg hørte ordet", correction: "Korriger situasjonen", taskUnclear: "Oppgaven var uklar",
    outsideHelp: "Hjelp ble gitt utenfor appen", otherStrategy: "Jeg valgte en annen strategi",
    evidence: "Evidens i denne økten", notRecorded: "Ikke registrert ennå",
  },
  "nn-NO": {
    childTitle: "Barneside", adultTitle: "Vaksenside", taskTitle: "Bygg ordet lyd for lyd",
    instruction: "Sjå på lydane. Vel bokstavane i same rekkjefølgje.", selected: "Ordet du byggjer",
    available: "Bokstavar du kan velje", check: "Sjekk ordet", undo: "Ta bort den siste",
    clear: "Start ordet på nytt", help: "Be den vaksne om hjelp", quiet: "Arbeidsro",
    pause: "Pause", resume: "Hald fram", stop: "Stopp aktiviteten", audio: "Høyr lydane",
    audioStub: "Lydstubben er ikkje spelt inn. Lydane står på skjermen.", transparency: "Kva ser den vaksne?",
    phase: "Økttilstand", model: "Modell vald av den vaksne",
    ready: "Vel bokstavane i same rekkjefølgje som lydane.", tile: "Bokstaven er lagd til.",
    tryAgain: "Sjå på lydane. Prøv éin bokstav om gongen.", read: "Ordet er bygd. Les det høgt for den vaksne.",
    target: "Du brukte lydane til å byggje sol. No prøver du eit nytt ord.",
    transfer: "Du brukte same måte på eit nytt ord: mus.", quietOn: "Arbeidsro er på.",
    paused: "Aktiviteten er sett på pause.", stopped: "Aktiviteten er stoppa.",
    adultIntro: "Du ser den same syntetiske økta. Bruk eige skjønn.", adultBuilt: "Barnet har valt",
    noCard: "Ingen vaksenhandling er nødvendig no.", wait: "Vent", showModel: "Vis éin modell",
    confirm: "Eg høyrde ordet", correction: "Korriger situasjonen", taskUnclear: "Oppgåva var uklar",
    outsideHelp: "Hjelp vart gitt utanfor appen", otherStrategy: "Eg valde ein annan strategi",
    evidence: "Evidens i denne økta", notRecorded: "Ikkje registrert enno",
  },
} as const;

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function feedbackText(snapshot: VerticalProofSnapshot): string {
  const t = uiText[snapshot.definition.locale];
  return {
    READY: t.ready, TILE_SELECTED: t.tile, TRY_AGAIN: t.tryAgain,
    WORD_BUILT_READ_TO_ADULT: t.read, TARGET_CONFIRMED: t.target,
    TRANSFER_CONFIRMED: t.transfer, QUIET: t.quietOn, PAUSED: t.paused, STOPPED: t.stopped,
  }[snapshot.proof.feedbackCode];
}

function evidenceLabel(value: string | undefined, locale: Locale): string {
  if (value === undefined) return uiText[locale].notRecorded;
  const labels: Record<string, Record<Locale, string>> = {
    INDEPENDENT: { "nb-NO": "Selvstendig", "nn-NO": "Sjølvstendig" },
    SUPPORTED_RETRY: { "nb-NO": "Nytt forsøk etter støtte", "nn-NO": "Nytt forsøk etter støtte" },
    NEAR_TRANSFER: { "nb-NO": "Nær transfer", "nn-NO": "Nær transfer" },
  };
  return labels[value]?.[locale] ?? value;
}

export function renderChildMarkup(snapshot: VerticalProofSnapshot): string {
  const view = projectVerticalChild(snapshot);
  const t = uiText[view.locale];
  const slots = Array.from({ length: view.phonemeSequence.length }, (_, index) => {
    const value = view.selectedGraphemes[index];
    return `<span class="selected-slot${value ? "" : " empty"}" aria-label="${value ? `Bokstav ${escapeHtml(value)}` : "Tom plass"}">${escapeHtml(value ?? "_")}</span>`;
  }).join("");
  const tiles = view.availableTiles.map((tile) =>
    `<button class="tile" type="button" data-action="select-tile" data-tile-id="${escapeHtml(tile.tileId)}" aria-label="Velg bokstaven ${escapeHtml(tile.grapheme)}">${escapeHtml(tile.grapheme)}</button>`,
  ).join("");
  const model = view.modelWord
    ? `<div class="model"><strong>${t.model}:</strong> ${view.phonemeSequence.map(escapeHtml).join(" – ")} → ${escapeHtml(view.modelWord)}</div>`
    : "";
  const completion = view.stage === "COMPLETED"
    ? `<div class="completion"><h3>${t.evidence}</h3><ul class="evidence-list"><li>sol: ${evidenceLabel(view.targetEvidence, view.locale)}</li><li>mus: ${evidenceLabel(view.transferEvidence, view.locale)}</li></ul></div>`
    : "";
  return `<section class="panel" aria-labelledby="child-title">
    <h2 id="child-title" tabindex="-1">${t.childTitle}</h2>
    <p class="state-line"><strong>${t.phase}:</strong> ${escapeHtml(view.phase)}</p>
    <h3>${t.taskTitle}</h3><p>${t.instruction}</p><p>${escapeHtml(view.meaningPrompt)}</p>
    <div class="phonemes" aria-label="Lyder">${view.phonemeSequence.map((sound) => `<span class="phoneme">${escapeHtml(sound)}</span>`).join("")}</div>
    ${model}<h3>${t.selected}</h3><output class="selected-word" aria-live="polite">${slots}</output>
    <h3>${t.available}</h3><div class="tiles">${tiles || `<span>${view.stage === "COMPLETED" ? "—" : ""}</span>`}</div>
    <p class="feedback" data-feedback>${escapeHtml(feedbackText(snapshot))}</p>${completion}
    <div class="controls">
      <button type="button" data-action="submit" ${view.canBuild ? "" : "disabled"}>${t.check}</button>
      <button type="button" data-action="undo" ${view.canBuild && view.selectedGraphemes.length > 0 ? "" : "disabled"}>${t.undo}</button>
      <button type="button" data-action="clear" ${view.canBuild && view.selectedGraphemes.length > 0 ? "" : "disabled"}>${t.clear}</button>
      <button type="button" data-action="audio" ${view.canPlayAudio ? "" : "disabled"}>${t.audio}</button>
      <button type="button" data-action="help" ${view.canRequestHelp ? "" : "disabled"}>${t.help}</button>
      <button type="button" data-action="quiet" ${view.canRequestQuiet ? "" : "disabled"}>${t.quiet}</button>
    </div>
    <div class="controls secondary-controls">
      <button type="button" data-action="pause" ${view.canPause ? "" : "disabled"}>${t.pause}</button>
      <button type="button" data-action="resume" ${view.canResume ? "" : "disabled"}>${t.resume}</button>
      <button type="button" data-action="transparency">${t.transparency}</button>
      <button class="danger" type="button" data-action="stop" ${view.canStop ? "" : "disabled"}>${t.stop}</button>
    </div>
  </section>`;
}

export function renderAdultMarkup(snapshot: VerticalProofSnapshot): string {
  const view = projectVerticalAdult(snapshot);
  const t = uiText[view.locale];
  const card = view.currentCard
    ? `<article class="adult-card" aria-labelledby="card-title"><h3 id="card-title">Voksenkort</h3><p>${escapeHtml(view.currentCard.observedState)}</p><p>${escapeHtml(view.currentCard.uncertainty)}</p><p><strong>Mulig handling:</strong> ${escapeHtml(view.currentCard.sayExample)}</p><p><strong>Unngå:</strong> ${escapeHtml(view.currentCard.avoidExample)}</p><div class="adult-actions"><button type="button" data-action="adult-wait">${t.wait}</button><button type="button" data-action="adult-model">${t.showModel}</button><button type="button" data-action="open-knowledge" data-knowledge-id="${escapeHtml(view.currentCard.knowledgeId)}">${view.locale === "nb-NO" ? "Åpne kunnskapsenheten" : "Opne kunnskapseininga"}</button></div></article>`
    : `<p>${t.noCard}</p>`;
  const confirmation = view.canConfirmReading
    ? `<div class="adult-actions"><button type="button" data-action="confirm-reading">${t.confirm}</button></div>`
    : "";
  return `<section class="panel" aria-labelledby="adult-title">
    <h2 id="adult-title" tabindex="-1">${t.adultTitle}</h2><p>${t.adultIntro}</p>
    <p class="state-line"><strong>${t.phase}:</strong> ${escapeHtml(view.phase)}</p>
    <p><strong>${t.adultBuilt}:</strong> ${escapeHtml(view.builtWord || "—")}</p>${card}${confirmation}
    <h3>${t.correction}</h3><div class="corrections">
      <button type="button" data-action="correction" data-code="TASK_UNCLEAR">${t.taskUnclear}</button>
      <button type="button" data-action="correction" data-code="HELP_GIVEN_OUTSIDE_APP">${t.outsideHelp}</button>
      <button type="button" data-action="correction" data-code="ADULT_CHOSE_OTHER_STRATEGY">${t.otherStrategy}</button>
    </div>
    <h3>${t.evidence}</h3><ul class="evidence-list"><li>sol: ${evidenceLabel(view.targetEvidence, view.locale)}</li><li>mus: ${evidenceLabel(view.transferEvidence, view.locale)}</li></ul>
    <div class="controls secondary-controls"><button class="danger" type="button" data-action="stop" ${view.canStop ? "" : "disabled"}>${t.stop}</button></div>
  </section>`;
}
