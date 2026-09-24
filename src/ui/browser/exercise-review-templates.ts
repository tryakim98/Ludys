import type { ExerciseReviewPacket } from "../../application/skynja/exercise-review.js";
import type { Locale } from "../../core/content-contracts.js";
import type { ExerciseRound } from "../../core/skynja/exercise-room.js";
import type { ExerciseReviewNote, ReviewNoteDraft } from "../../application/skynja/exercise-review-notes.js";
import { emptyReviewDraft, renderReviewNoteEditor } from "./exercise-review-notes-templates.js";

const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const field = (label: string, value: string): string => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`;

function roundView(round: ExerciseRound, locale: Locale): string {
  const t = (nb: string, nn: string): string => locale === "nb-NO" ? nb : nn;
  let content = field(t("Oppgave", "Oppgåve"), round.prompt) + field("Tekst", round.stimulus);
  if (round.type === "ARRANGE") {
    content += field(t("Brikker i vist rekkefølge", "Brikker i vist rekkjefølgje"), round.tiles.map((tile) => tile.label).join(" · "));
    content += field(t("Godtatte svar", "Godtekne svar"), round.acceptedAnswers.join(" / "));
    content += field(t("Ved nytt forsøk", "Ved nytt forsøk"), round.retryFeedback);
  } else {
    if (round.type === "EVIDENCE") {
      for (const passage of round.passages) content += field(passage.id, passage.text);
      content += field("NOT_STATED", t("Teksten gir ikke nok informasjon", "Teksten gir ikkje nok informasjon"));
      content += field(t("Ved feil tekstgrunnlag", "Ved feil tekstgrunnlag"), round.evidenceRetry);
    }
    const verdicts = { MATCHED: t("Passer med oppgaven", "Passar med oppgåva"), REASONABLE: t("Begrunnet valg", "Grunngitt val"), NEEDS_CONTEXT: "Mer informasjon trengs", TRY_AGAIN: t("Nytt forsøk", "Nytt forsøk") };
    if (locale === "nn-NO") verdicts.NEEDS_CONTEXT = "Meir informasjon trengst";
    for (const option of round.options) {
      content += field(`${option.label} — ${verdicts[option.verdict]}`, option.feedback);
      if ("evidenceIds" in option) content += field("Tekstgrunnlag", (option.evidenceIds as readonly string[]).join(", ") || t("Ingen — nytt forsøk", "Ingen — nytt forsøk"));
    }
    content += field(t("Løsningsforslag", "Løysingsforslag"), round.model);
  }
  return `<dl class="exercise-review-fields">${content}${field("Hint", round.hint)}${field("Forklaring", round.explanation)}${field(t("Valgfri refleksjon", "Valfri refleksjon"), round.reflection)}</dl>`;
}

export function renderExerciseReview(packet: ExerciseReviewPacket, locale: Locale, selectedId: string, notes: readonly ExerciseReviewNote[] = [], drafts: ReadonlyMap<string, ReviewNoteDraft> = new Map()): string {
  const t = (nb: string, nn: string): string => locale === "nb-NO" ? nb : nn;
  const selected = packet.exercises.find((entry) => entry.exerciseId === selectedId) ?? packet.exercises[0];
  return `<div class="exercise-room exercise-review"><a class="skip-link" href="#exercise-main">${t("Hopp til innhold", "Hopp til innhald")}</a>
    <header class="site-header exercise-header"><div><p class="exercise-brand">Skynja</p><p>${t("Innholdsgjennomgang", "Innhaldsgjennomgang")}</p></div><button type="button" data-exercise-action="review-close">${t("Til øvelsene", "Til øvingane")}</button></header>
    <main id="exercise-main" tabindex="-1"><h1 id="exercise-title" tabindex="-1">${t("Gå gjennom øvelsene", "Gå gjennom øvingane")}</h1>
    <p>${t("Sammenlign bokmål og nynorsk, og se alle svar, hint og begrunnelser. Målformene trenger selvstendig gjennomgang.", "Samanlikn bokmål og nynorsk, og sjå alle svar, hint og grunngivingar. Målformene treng sjølvstendig gjennomgang.")}</p>
    <p class="exercise-draft">${t("Venter på menneskelig faglig og språklig gjennomgang. Eksporten er et arbeidsgrunnlag og gir ingen pilotgodkjenning.", "Ventar på menneskeleg fagleg og språkleg gjennomgang. Eksporten er eit arbeidsgrunnlag og gir inga pilotgodkjenning.")}</p>
    <section class="exercise-review-export" aria-labelledby="exercise-review-export-title"><h2 id="exercise-review-export-title">${t("Ta med gjennomgangspakken", "Ta med gjennomgangspakken")}</h2>
      <p>${packet.exerciseCount} ${t("øvelser", "øvingar")} · ${packet.semanticRoundCount} ${t("runder", "rundar")} · ${packet.localizedRoundCount} ${t("målformsvarianter", "målformsvariantar")}</p>
      <div class="exercise-actions"><a id="exercise-review-markdown" download="skynja-innholdsgjennomgang.md">${t("Last ned lesepakke", "Last ned lesepakke")}</a><a id="exercise-review-json" download="skynja-innhold.json">${t("Last ned innhold (JSON)", "Last ned innhald (JSON)")}</a><a id="exercise-review-form" download="skynja-vurderingsmal.json">${t("Last ned tom vurderingsmal", "Last ned tom vurderingsmal")}</a></div>
      <p class="exercise-quiet">${t("Inneholder øvelsestekster og versjonsreferanser. Vurderingsmalen fylles ut uten elevopplysninger og leveres gjennom avtalt kanal. Det finnes foreløpig ingen innspilt opplesning for disse utkastene.", "Inneheld øvingstekstar og versjonsreferansar. Vurderingsmalen blir fylt ut utan elevopplysningar og levert gjennom avtalt kanal. Det finst førebels inga innspelt opplesing for desse utkasta.")}</p>
      <h3>${t("Dine arbeidsnotater", "Arbeidsnotata dine")}</h3><p>${t("Notater er forslag og observasjoner. De endrer ikke innholdet eller godkjenningsstatusen. Lagre filen i avtalt kanal.", "Notat er forslag og observasjonar. Dei endrar ikkje innhaldet eller godkjenningsstatusen. Lagre fila i avtalt kanal.")}</p>
      <div class="exercise-actions"><a id="review-notes-download" download="skynja-arbeidsnotater.json">${t("Last ned arbeidsnotater", "Last ned arbeidsnotat")} (${notes.length})</a><button type="button" data-review-note-action="clear">${t("Tøm notater og skjema", "Tøm notat og skjema")}</button></div>
      <label for="review-notes-file">${t("Legg til notater fra fil", "Legg til notat frå fil")}<input id="review-notes-file" type="file" accept=".json,application/json" aria-describedby="review-notes-import-help"></label><p id="review-notes-import-help" class="exercise-quiet">${t("Velg en tidligere nedlastet notatfil, inntil 1 MiB. Ugyldige filer avvises uten å erstatte notatene dine. Legg til uferdige notater, last ned filen og tøm notater og skjema før appoppdatering.", "Vel ei tidlegare nedlasta notatfil, inntil 1 MiB. Ugyldige filer blir avviste utan å erstatte notata dine. Legg til uferdige notat, last ned fila og tøm notat og skjema før appoppdatering.")}</p>
      <p id="review-notes-message" role="status" tabindex="-1"></p>
    </section>
    ${packet.excludedExerciseIds.length ? `<p role="status">${packet.excludedExerciseIds.length} ${t("sperrede øvelser er utelatt fra visning og eksport.", "sperra øvingar er utelatne frå vising og eksport.")}</p>` : ""}
    ${selected === undefined ? `<p>${t("Ingen øvelser er tilgjengelige for gjennomgang.", "Ingen øvingar er tilgjengelege for gjennomgang.")}</p>` : `
      <label for="exercise-review-select">${t("Velg øvelse", "Vel øving")}<select id="exercise-review-select">${packet.exercises.map((entry) => `<option value="${escape(entry.exerciseId)}" ${entry === selected ? "selected" : ""}>${escape(entry.content.locales[locale].title)}</option>`).join("")}</select></label>
      <section data-review-exercise="${escape(selected.exerciseId)}"><h2 id="exercise-review-heading" tabindex="-1">${escape(selected.content.locales[locale].title)}</h2>
      ${renderReviewNoteEditor(selected, notes, locale, drafts.get(selected.exerciseId) ?? emptyReviewDraft(locale))}
      <details class="exercise-review-version"><summary>${t("Versjon og referanser", "Versjon og referansar")}</summary><p>${escape(selected.exerciseId)} · ${t("revisjon", "revisjon")} ${selected.revision}</p><p>SHA-256: <code>${selected.contentSha256}</code></p><p>${t("Denne referansen endres når innholdet endres, også hvis revisjonstallet er uendret.", "Denne referansen endrar seg når innhaldet endrar seg, òg om revisjonstalet er uendra.")}</p></details>
      <div class="exercise-review-columns">${(["nb-NO", "nn-NO"] as const).map((language) => {
        const variant = selected.content.locales[language];
        return `<section lang="${language === "nb-NO" ? "nb" : "nn"}"><h3>${language === "nb-NO" ? "Bokmål" : "Nynorsk"}</h3><dl class="exercise-review-fields">${field("Tittel", variant.title)}${field("Introduksjon", variant.summary)}${field("Formål", variant.purpose)}${field(language === "nb-NO" ? "Underveis" : "Undervegs", variant.observe)}${field(language === "nb-NO" ? "Videreføring" : "Vidareføring", variant.transfer)}</dl></section>`;
      }).join("")}</div>
      ${selected.content.locales["nb-NO"].rounds.map((round, index) => `<details class="exercise-review-round" ${index === 0 ? "open" : ""}><summary>${t("Runde", "Runde")} ${index + 1} · ${escape(round.id)}</summary><div class="exercise-review-columns">${(["nb-NO", "nn-NO"] as const).map((language) => `<section lang="${language === "nb-NO" ? "nb" : "nn"}"><h3>${language === "nb-NO" ? "Bokmål" : "Nynorsk"}</h3>${roundView(selected.content.locales[language].rounds[index]!, language)}</section>`).join("")}</div></details>`).join("")}</section>`}
    </main><div id="exercise-status" class="sr-only" role="status" aria-live="polite"></div><div id="exercise-alert" class="sr-only" role="alert"></div></div>`;
}
