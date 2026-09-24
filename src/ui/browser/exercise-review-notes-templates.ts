import { NOTE_CATEGORIES, NOTE_SEVERITIES, type ExerciseReviewNote, type ReviewNoteDraft } from "../../application/skynja/exercise-review-notes.js";
import type { ExerciseReviewPacket } from "../../application/skynja/exercise-review.js";
import type { Locale } from "../../core/content-contracts.js";

const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
export const emptyReviewDraft = (locale: Locale): ReviewNoteDraft => ({ locale, roundId: "", category: "LANGUAGE", severity: "COMMENT", observation: "", suggestion: "" });

export function renderReviewNoteEditor(entry: ExerciseReviewPacket["exercises"][number], notes: readonly ExerciseReviewNote[], uiLocale: Locale, draft: ReviewNoteDraft): string {
  const t = (nb: string, nn: string): string => uiLocale === "nb-NO" ? nb : nn;
  const categories = { LANGUAGE: t("Språk og målform", "Språk og målform"), TASK: t("Oppgave og svar", "Oppgåve og svar"), SUPPORT: "Hint og støtte", ACCESSIBILITY: t("Tilgjengelighet", "Tilgjenge"), DIGNITY: t("Verdighet og belastning", "Verdigheit og belastning") };
  const severities = { COMMENT: "Kommentar", NEEDS_CHANGE: t("Bør endres", "Bør endrast"), BLOCKER: t("Må avklares før bruk", "Må avklarast før bruk") };
  const current = notes.filter((note) => note.exerciseId === entry.exerciseId);
  return `<section class="exercise-review-export" aria-labelledby="review-note-title"><h3 id="review-note-title">${t("Noter et funn", "Noter eit funn")}</h3>
    <p>${t("Skriv om innholdet, uten elevopplysninger. Trykk «Legg til notat» for å ta med teksten i nedlastingen. Notatene beholdes mens siden er åpen. Last dem ned før du lukker eller laster siden på nytt.", "Skriv om innhaldet, utan elevopplysningar. Trykk «Legg til notat» for å ta med teksten i nedlastinga. Notata blir haldne medan sida er open. Last dei ned før du lukkar eller lastar sida på nytt.")}</p>
    <form id="review-note-form" data-review-exercise-id="${escape(entry.exerciseId)}">
      <div class="exercise-review-columns">
      <label for="review-note-locale">Målform<select id="review-note-locale"><option value="nb-NO" ${draft.locale === "nb-NO" ? "selected" : ""}>Bokmål</option><option value="nn-NO" ${draft.locale === "nn-NO" ? "selected" : ""}>Nynorsk</option></select></label>
      <label for="review-note-round">${t("Gjelder", "Gjeld")}<select id="review-note-round"><option value="">${t("Introduksjon / hele øvelsen", "Introduksjon / heile øvinga")}</option>${entry.content.locales[draft.locale].rounds.map((round, i) => `<option value="${escape(round.id)}" ${draft.roundId === round.id ? "selected" : ""}>Runde ${i + 1} · ${escape(round.id)}</option>`).join("")}</select></label>
      <label for="review-note-category">${t("Område", "Område")}<select id="review-note-category">${NOTE_CATEGORIES.map((category) => `<option value="${category}" ${draft.category === category ? "selected" : ""}>${categories[category]}</option>`).join("")}</select></label>
      <label for="review-note-severity">${t("Oppfølging", "Oppfølging")}<select id="review-note-severity">${NOTE_SEVERITIES.map((severity) => `<option value="${severity}" ${draft.severity === severity ? "selected" : ""}>${severities[severity]}</option>`).join("")}</select></label></div>
      <label for="review-note-observation">${t("Hva fant du?", "Kva fann du?")}<textarea id="review-note-observation" rows="3" maxlength="2000" required>${escape(draft.observation)}</textarea></label>
      <label for="review-note-suggestion">${t("Forslag til endring (valgfritt)", "Forslag til endring (valfritt)")}<textarea id="review-note-suggestion" rows="3" maxlength="2000">${escape(draft.suggestion)}</textarea></label>
      <button type="submit" class="exercise-primary">${t("Legg til notat", "Legg til notat")}</button>
    </form>
    <h3 id="review-note-list-title" tabindex="-1">${current.length} ${t("notater til denne øvelsen", "notat til denne øvinga")}</h3>
    <ul class="exercise-review-note-list">${current.map((note) => `<li data-review-note-id="${escape(note.id)}"><p><strong>${note.locale === "nb-NO" ? "Bokmål" : "Nynorsk"} · ${escape(note.roundId || t("Hele øvelsen", "Heile øvinga"))}</strong><br>${categories[note.category]} · ${severities[note.severity]}</p><p lang="${note.locale === "nb-NO" ? "nb" : "nn"}">${escape(note.observation)}</p>${note.suggestion ? `<p lang="${note.locale === "nb-NO" ? "nb" : "nn"}"><strong>${t("Forslag", "Framlegg")}:</strong> ${escape(note.suggestion)}</p>` : ""}<button type="button" data-review-note-action="remove" data-review-note-id="${escape(note.id)}">${t("Fjern dette notatet", "Fjern dette notatet")}</button></li>`).join("")}</ul>
    </section>`;
}
