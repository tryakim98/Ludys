import type { ExerciseRoomView } from "../../application/skynja/exercise-room-controller.js";
import type { Locale } from "../../core/content-contracts.js";
import { EXERCISE_KINDS, NOT_STATED, assembleAnswer, type ExerciseKind } from "../../core/skynja/exercise-room.js";

const escape = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const paragraphs = (text: string): string => text.split("\n").map((line) => `<p>${escape(line)}</p>`).join("");
const labels: Record<ExerciseKind, readonly [string, string]> = {
  WORD: ["Bygg ord", "Bygg ord"], COMPOUND: ["Sammensatte ord", "Samansette ord"],
  CLOZE: ["Finn ordet", "Finn ordet"], SENTENCE: ["Bygg setninger", "Bygg setningar"],
  READING: ["Les og finn", "Les og finn"], JUDGMENT: ["Prøverommet", "Prøverommet"],
  EVIDENCE: ["Finn tekstbeviset", "Finn tekstbeviset"],
};
const kindLabel = (kind: ExerciseKind, locale: Locale): string => labels[kind][locale === "nb-NO" ? 0 : 1];
const kindNumber = (kind: ExerciseKind): string => String(EXERCISE_KINDS.indexOf(kind) + 1).padStart(2, "0");

function action(actionName: string, label: string, disabled = false, className = "", extra = ""): string {
  return `<button type="button" data-exercise-action="${actionName}" class="${className}" ${disabled ? "disabled" : ""} ${extra}>${escape(label)}</button>`;
}

export function renderExerciseRoom(view: ExerciseRoomView): string {
  const t = (nb: string, nn: string): string => view.locale === "nb-NO" ? nb : nn;
  const variant = view.variant;
  const round = view.round;
  const roundCount = view.catalog.reduce((sum, item) => sum + item.locales[view.locale].rounds.length, 0);
  const guide = variant === undefined ? "" : `<details class="exercise-guide"><summary>${t("Til samtale og støtte", "Til samtale og støtte")}</summary><h3>${t("Underveis", "Undervegs")}</h3><p>${escape(variant.observe)}</p><h3>${t("Ta det med videre", "Ta det med vidare")}</h3><p>${escape(variant.transfer)}</p><p>${t("Du kan få en person til å lese teksten. Det finnes foreløpig ingen innspilt opplesning i disse utkastene.", "Du kan få ein person til å lese teksten. Det finst førebels inga innspelt opplesing i desse utkasta.")}</p></details>`;
  let content = "";
  if (view.stage === "CATALOG") {
    const visible = view.catalog.filter((item) => view.filter === "ALL" || view.filter === item.kind);
    content = `<section class="exercise-introduction"><p class="exercise-kicker">${view.catalog.length} ${t("øvelser", "øvingar")} · ${roundCount} ${t("runder", "rundar")} · ${EXERCISE_KINDS.length} ${t("typer", "typar")}</p>
      <h1 id="exercise-title" tabindex="-1">${t("Hva vil du utforske?", "Kva vil du utforske?")}</h1>
      <p>${t("Bygg et ord, finn mening i en tekst eller prøv et valg. Velg en øvelse som passer til det du vil gjøre nå.", "Bygg eit ord, finn meining i ein tekst eller prøv eit val. Vel ei øving som passar til det du vil gjere no.")}</p>
      <p class="exercise-quiet">${t("Ingen tidtaking. Hint og løsningsforslag er tilgjengelige. Du kan hoppe over, ta pause eller stoppe.", "Inga tidtaking. Hint og løysingsforslag er tilgjengelege. Du kan hoppe over, ta pause eller stoppe.")}</p></section>
      <div class="exercise-filters" role="group" aria-label="${t("Velg øvelsestype", "Vel øvingstype")}">${action("filter", t("Alle", "Alle"), false, "", `data-filter="ALL" aria-pressed="${view.filter === "ALL"}"`)}${EXERCISE_KINDS.map((kind) => action("filter", kindLabel(kind, view.locale), false, "", `data-filter="${kind}" aria-pressed="${view.filter === kind}"`)).join("")}</div>
      <p id="exercise-results" class="exercise-quiet">${visible.length} ${t("øvelser i utvalget", "øvingar i utvalet")}</p>
      <div class="exercise-grid">${visible.map((item) => {
        const local = item.locales[view.locale];
        const blocked = view.blockedIds.includes(item.id);
        return `<article class="exercise-card" data-exercise-card="${item.id}" data-exercise-kind="${item.kind}"><p class="exercise-card-type"><span aria-hidden="true">${kindNumber(item.kind)}</span> ${escape(kindLabel(item.kind, view.locale))}</p><h2>${escape(local.title)}</h2><p>${escape(local.summary)}</p><div class="exercise-card-bottom"><span>${local.rounds.length} ${t("runder", "rundar")}</span>${action("select", blocked ? t("Utilgjengelig", "Utilgjengeleg") : t("Se øvelsen", "Sjå øvinga"), blocked, "exercise-primary", `data-exercise-id="${item.id}" aria-label="${escape(t("Se øvelsen", "Sjå øvinga") + ": " + local.title)}"`)}</div>${blocked ? `<p class="exercise-quiet">${t("Innholdet er sperret i denne versjonen.", "Innhaldet er sperra i denne versjonen.")}</p>` : ""}</article>`;
      }).join("")}</div>`;
  } else if (view.stage === "INTRO" && variant !== undefined && view.exercise !== undefined) {
    content = `<p class="exercise-kicker">${escape(kindLabel(view.exercise.kind, view.locale))} · ${variant.rounds.length} ${t("runder", "rundar")}</p><h1 id="exercise-title" tabindex="-1">${escape(variant.title)}</h1>
      <p class="exercise-lead">${escape(variant.summary)}</p><section class="exercise-purpose"><h2>${t("Dette utforsker du", "Dette utforskar du")}</h2><p>${escape(variant.purpose)}</p></section>
      <p>${t("Velg hint eller løsningsforslag når du ønsker det. Du kan prøve på nytt og hoppe over runder. Svarene finnes bare mens denne siden er åpen.", "Vel hint eller løysingsforslag når du ønskjer det. Du kan prøve på nytt og hoppe over rundar. Svara finst berre medan denne sida er open.")}</p>
      <div class="exercise-actions">${action("start", t("Start øvelsen", "Start øvinga"), false, "exercise-primary")}${action("catalog", t("Velg en annen øvelse", "Vel ei anna øving"))}</div>${guide}`;
  } else if (view.stage === "ACTIVE" && variant !== undefined && round !== undefined) {
    const feedbackLabels = { MATCHED: t("Det passer med oppgaven", "Det passar med oppgåva"), REASONABLE: t("Et begrunnet valg", "Eit grunngitt val"), NEEDS_CONTEXT: t("Mer informasjon trengs", "Meir informasjon trengst"), TRY_AGAIN: t("Se på sammenhengen", "Sjå på samanhengen") };
    const model = round.type === "ARRANGE" ? round.acceptedAnswers.join(t(" eller ", " eller ")) : round.model;
    const evidenceText = round.type !== "EVIDENCE" ? "" : `<h2 id="exercise-evidence-label">${t("Tekstgrunnlag", "Tekstgrunnlag")}</h2>
      <p id="exercise-evidence-help" class="exercise-quiet">${t("Les teksten og velg et svar nedenfor. Marker setningen som støtter svaret, eller velg at teksten ikke gir nok informasjon. Du kan endre begge valg.", "Les teksten og vel eit svar nedanfor. Marker setninga som støttar svaret, eller vel at teksten ikkje gir nok informasjon. Du kan endre begge val.")}</p>
      <div class="exercise-options" role="group" aria-labelledby="exercise-evidence-label" aria-describedby="exercise-evidence-help">${round.passages.map((passage) => action("evidence", passage.text, false, "exercise-option", `id="exercise-evidence-${passage.id}" data-evidence-id="${passage.id}" aria-pressed="${view.selectedEvidence === passage.id}"`)).join("")}
      ${action("evidence", t("Teksten gir ikke nok informasjon", "Teksten gir ikkje nok informasjon"), false, "exercise-option exercise-evidence-missing", `id="exercise-evidence-${NOT_STATED}" data-evidence-id="${NOT_STATED}" aria-pressed="${view.selectedEvidence === NOT_STATED}"`)}</div>`;
    const interactions = round.type === "ARRANGE"
      ? `<p class="exercise-quiet" id="exercise-tile-help">${t("Velg brikkene i rekkefølge. Velg en brikke i svaret for å legge den tilbake.", "Vel brikkene i rekkjefølgje. Vel ei brikke i svaret for å leggje henne tilbake.")}</p>
        <div class="exercise-answer" aria-labelledby="exercise-answer-label"><h3 id="exercise-answer-label">${t("Ditt forslag", "Ditt forslag")}</h3><div class="exercise-tiles exercise-selected">${view.selectedTiles.length ? view.selectedTiles.map((id, index) => {
          const tile = round.tiles.find((item) => item.id === id)!;
          return action("tile", tile.label, false, "exercise-tile", `id="exercise-picked-${id}" data-tile-id="${id}" aria-label="${escape(t("Legg tilbake", "Legg tilbake") + ` ${tile.label}, ` + t("plass", "plass") + ` ${index + 1}`)}"`);
        }).join("") : `<span class="exercise-quiet">${t("Brikkene du velger kommer hit.", "Brikkene du vel kjem hit.")}</span>`}</div><p class="exercise-assembled" aria-label="${t("Sammensatt forslag", "Samansett forslag")}">${escape(assembleAnswer(round, view.selectedTiles) ?? "")}</p></div>
        <div class="exercise-tiles" role="group" aria-label="${t("Tilgjengelige brikker", "Tilgjengelege brikker")}" aria-describedby="exercise-tile-help">${round.tiles.map((tile, index) => action("tile", tile.label, view.selectedTiles.includes(tile.id), "exercise-tile", `id="exercise-bank-${tile.id}" data-tile-id="${tile.id}" aria-label="${escape(t("Velg", "Vel") + ` ${tile.label}, ` + t("brikke", "brikke") + ` ${index + 1}`)}"`)).join("")}</div>${action("clear", t("Legg alle tilbake", "Legg alle tilbake"), view.selectedTiles.length === 0, "exercise-subtle")}`
      : `<div class="exercise-options" role="group" aria-label="${t("Svaralternativer, velg ett om gangen", "Svaralternativ, vel eitt om gongen")}">${round.options.map((option) => action("option", option.label, false, "exercise-option", `id="exercise-option-${option.id}" data-option-id="${option.id}" aria-pressed="${view.selectedOption === option.id}"`)).join("")}</div>`;
    content = `<div class="exercise-round-top"><p class="exercise-kicker">${escape(variant.title)} · ${t("Runde", "Runde")} ${view.roundIndex + 1} ${t("av", "av")} ${variant.rounds.length}</p><div class="exercise-actions">${action("pause", t("Pause", "Pause"))}${action("stop", t("Stopp", "Stopp"))}</div></div>
      <h1 id="exercise-title" tabindex="-1">${escape(round.prompt)}</h1><section class="exercise-stimulus" aria-label="${t("Tekst til oppgaven", "Tekst til oppgåva")}">${paragraphs(round.stimulus)}${evidenceText}</section>
      ${round.type === "EVIDENCE" ? `<h2>${t("Svaret ditt", "Svaret ditt")}</h2>` : ""}${interactions}
      ${round.type === "EVIDENCE" ? `<p class="exercise-quiet">${t("Velg både et svar og et tekstgrunnlag for å se tilbakemelding.", "Vel både eit svar og eit tekstgrunnlag for å sjå tilbakemelding.")}</p>` : ""}<div class="exercise-actions exercise-check">${action("check", t("Se tilbakemelding", "Sjå tilbakemelding"), !view.canCheck, "exercise-primary")}</div>
      <div class="exercise-support"><div class="exercise-actions">${action("hint", t("Vis hint", "Vis hint"), view.hintVisible)}${action("model", t("Vis løsningsforslag", "Vis løysingsforslag"), view.modelVisible)}</div>
      ${view.hintVisible ? `<section id="exercise-hint" tabindex="-1" class="exercise-support-note"><h2>Hint</h2><p>${escape(round.hint)}</p></section>` : ""}
      ${view.modelVisible ? `<section id="exercise-model" tabindex="-1" class="exercise-support-note"><h2>${t("Løsningsforslag", "Løysingsforslag")}</h2><p class="exercise-model-answer">${escape(model)}</p><p>${escape(round.explanation)}</p></section>` : ""}</div>
      ${view.feedback === undefined ? "" : `<section id="exercise-feedback" tabindex="-1" class="exercise-feedback" data-verdict="${view.feedback.verdict}"><h2>${escape(feedbackLabels[view.feedback.verdict])}</h2><p>${escape(view.feedback.text)}</p>${view.feedback.verdict === "TRY_AGAIN" ? `<p>${t("Du kan endre forslaget, be om støtte eller hoppe over.", "Du kan endre forslaget, be om støtte eller hoppe over.")}</p>` : view.feedback.text === round.explanation ? "" : `<p>${escape(round.explanation)}</p>`}</section>`}
      ${view.feedback !== undefined || view.modelVisible ? `<aside class="exercise-reflection"><h2>${t("Tenk eller snakk sammen, hvis du vil", "Tenk eller snakk saman, om du vil")}</h2><p>${escape(round.reflection)}</p></aside>` : ""}
      <div class="exercise-actions exercise-next">${action("next", view.roundIndex + 1 === variant.rounds.length ? t("Se oppsummering", "Sjå oppsummering") : t("Neste runde", "Neste runde"), !view.canContinue, "exercise-primary")}${action("skip", t("Hopp over denne runden", "Hopp over denne runden"))}</div>${guide}`;
  } else if (view.stage === "PAUSED") {
    content = `<section class="exercise-state"><p class="exercise-kicker">${escape(variant?.title ?? "")}</p><h1 id="exercise-title" tabindex="-1">${t("Du har pause", "Du har pause")}</h1><p>${t("Du kan bli her så lenge du vil. Ingenting går videre av seg selv. Forslaget ditt ligger klart hvis du fortsetter på denne siden.", "Du kan bli her så lenge du vil. Ingenting går vidare av seg sjølv. Forslaget ditt ligg klart dersom du held fram på denne sida.")}</p><div class="exercise-actions">${action("resume", t("Fortsett når du vil", "Hald fram når du vil"), false, "exercise-primary")}${action("stop", t("Stopp øvelsen", "Stopp øvinga"))}</div></section>`;
  } else if (view.stage === "COMPLETED" && variant !== undefined) {
    content = `<section class="exercise-state"><p class="exercise-kicker">${escape(variant.title)}</p><h1 id="exercise-title" tabindex="-1">${t("Dette gjorde du", "Dette gjorde du")}</h1><p>${t("Her er en oversikt over rundene og støtten du åpnet. Det er ikke en vurdering av leseferdighet.", "Her er ei oversikt over rundane og støtta du opna. Det er ikkje ei vurdering av leseferdigheit.")}</p>
      <ol class="exercise-records">${view.records.map((record, index) => `<li><strong>${t("Runde", "Runde")} ${index + 1}</strong><span>${record.outcome === "SKIPPED" ? t("Hoppet over", "Hoppa over") : record.outcome === "MODEL_VIEWED" ? t("Så løsningsforslag", "Såg løysingsforslag") : t("Undersøkte et svar", "Undersøkte eit svar")}${record.hintUsed ? ` · ${t("åpnet hint", "opna hint")}` : ""}${record.modelUsed && record.outcome !== "MODEL_VIEWED" ? ` · ${t("åpnet løsningsforslag", "opna løysingsforslag")}` : ""}</span></li>`).join("")}</ol>
      <h2>${t("En mulig fortsettelse", "Ei mogleg vidareføring")}</h2><p>${escape(variant.transfer)}</p><p class="exercise-quiet">${t("Svar med modell, hint eller opplesning beskriver arbeid med støtte. Det forteller ikke alene hva du ville gjort uten støtte.", "Svar med modell, hint eller opplesing skildrar arbeid med støtte. Det fortel ikkje åleine kva du ville gjort utan støtte.")}</p><div class="exercise-actions">${action("catalog", t("Velg en ny øvelse", "Vel ei ny øving"), false, "exercise-primary")}${action("repeat", t("Se øvelsen på nytt", "Sjå øvinga på nytt"))}</div></section>`;
  } else {
    content = `<section class="exercise-state"><h1 id="exercise-title" tabindex="-1">${t("Øvelsen er stoppet", "Øvinga er stoppa")}</h1><p>${t("Forslag og rundeoversikt fra forsøket er fjernet. En ny øvelse starter bare når du velger det.", "Forslag og rundeoversikt frå forsøket er fjerna. Ei ny øving startar berre når du vel det.")}</p>${action("catalog", t("Til øvelsene", "Til øvingane"), false, "exercise-primary")}</section>`;
  }
  return `<div class="exercise-room"><a class="skip-link" href="#exercise-main">${t("Hopp til innhold", "Hopp til innhald")}</a>
    <header class="site-header exercise-header"><div><p class="exercise-brand">Skynja</p><p>${t("Øvelsesrom", "Øvingsrom")}</p></div><div class="exercise-actions"><label for="exercise-locale">${t("Målform", "Målform")}<select id="exercise-locale" ${view.sessionOpen ? "disabled aria-describedby=exercise-language-help" : ""}><option value="nb-NO" ${view.locale === "nb-NO" ? "selected" : ""}>Bokmål</option><option value="nn-NO" ${view.locale === "nn-NO" ? "selected" : ""}>Nynorsk</option></select></label>${action("close", view.sessionOpen ? t("Stopp og gå tilbake", "Stopp og gå tilbake") : t("Til startsiden", "Til startsida"))}</div></header>
    <div class="exercise-draft" role="note"><strong>${t("Innholdsutkast", "Innhaldsutkast")}</strong> · ${t("Kan prøves her. Venter på faglig og språklig gjennomgang.", "Kan prøvast her. Ventar på fagleg og språkleg gjennomgang.")}</div>
    ${view.sessionOpen ? `<p id="exercise-language-help" class="exercise-language-help">${t("Målformen følger denne øvelsen. Stopp for å velge en annen målform.", "Målforma følgjer denne øvinga. Stopp for å velje ei anna målform.")}</p>` : ""}
    <main id="exercise-main" tabindex="-1" data-exercise-stage="${view.stage}" data-exercise-kind="${view.exercise?.kind ?? ""}">${content}</main><div id="exercise-status" class="sr-only" role="status" aria-live="polite"></div><div id="exercise-alert" class="sr-only" role="alert"></div></div>`;
}
