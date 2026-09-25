import { sha256Hex } from "../../core/authoring-pipeline.js";
import { canonicalJson } from "../../core/beta-operations.js";
import { validateExerciseCatalog, type ExerciseDefinition, type ExerciseRound } from "../../core/skynja/exercise-room.js";

export const REVIEW_LOCALES = ["nb-NO", "nn-NO"] as const;

/** An editorial snapshot, never an approval or a learner-session export. */
export function createExerciseReviewPacket(catalog: readonly ExerciseDefinition[], blockedIds: readonly string[] = []) {
  const errors = validateExerciseCatalog(catalog);
  if (errors.length) throw new Error(errors.join("; "));
  const blocked = new Set(blockedIds);
  const exercises = catalog.filter((exercise) => !blocked.has(exercise.id)
    && (exercise.sourceActivityId === undefined || !blocked.has(exercise.sourceActivityId))).map((exercise) => {
    const content = structuredClone(exercise);
    return {
      exerciseId: content.id,
      revision: content.revision,
      contentSha256: sha256Hex(canonicalJson(content)),
      localeSha256: Object.fromEntries(REVIEW_LOCALES.map((locale) => [locale, sha256Hex(canonicalJson(content.locales[locale]))])),
      content,
    };
  });
  const scope = {
    exercises,
    excludedExerciseIds: catalog.filter((exercise) => !exercises.some((entry) => entry.exerciseId === exercise.id)).map((exercise) => exercise.id).sort(),
  };
  return {
    schemaVersion: "skynja-exercise-review.v1" as const,
    status: "AWAITING_HUMAN_REVIEW" as const,
    contentSetSha256: sha256Hex(canonicalJson(scope)),
    exerciseCount: exercises.length,
    semanticRoundCount: exercises.reduce((sum, entry) => sum + entry.content.locales["nb-NO"].rounds.length, 0),
    localizedRoundCount: exercises.reduce((sum, entry) => sum + REVIEW_LOCALES.reduce((total, locale) => total + entry.content.locales[locale].rounds.length, 0), 0),
    humanReviewReceipts: [],
    pilotAuthorization: "NOT_GRANTED" as const,
    ...scope,
  };
}

export type ExerciseReviewPacket = ReturnType<typeof createExerciseReviewPacket>;

export function createExerciseReviewForm(packet: ExerciseReviewPacket) {
  return {
    schemaVersion: "skynja-exercise-review-form.v1",
    templateOnly: true,
    contentSetSha256: packet.contentSetSha256,
    instructions: "Fylles ut av faktisk fag-/språkansvarlig. Oppgi konkrete runde-ID-er og funn. En utfylt mal er ikke en verifisert kvittering eller pilotautorisasjon. Ikke legg inn elevopplysninger. Leveres gjennom avtalt reviewkanal, ikke i det offentlige repositoryet.",
    reviews: packet.exercises.flatMap((entry) => REVIEW_LOCALES.map((locale) => ({
      exerciseId: entry.exerciseId, revision: entry.revision, locale,
      contentSha256: entry.contentSha256, localeSha256: entry.localeSha256[locale],
      roundIds: entry.content.locales[locale].rounds.map((round) => round.id),
      reviewerReference: "", competenceAndMandate: "", reviewedAt: "", evidenceReference: "",
      checks: { language: "NOT_REVIEWED", taskAndAnswers: "NOT_REVIEWED", supportAndConstruct: "NOT_REVIEWED", dignityAndBurden: "NOT_REVIEWED" },
      findings: [], conclusion: "NOT_REVIEWED",
    }))),
  };
}

// Escape authored prose as Markdown text; an editorial export must not execute embedded HTML.
const md = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/[\\`*_{}\[\]()#+.!|~-]/gu, "\\$&");
const field = (label: string, value: string): string => `**${label}:** ${md(value)}\n\n`;

function roundMarkdown(round: ExerciseRound, index: number): string {
  let output = `#### Runde ${index + 1} — ${md(round.id)}\n\n`;
  output += field("Oppgave", round.prompt) + field("Tekst", round.stimulus);
  if (round.type === "ARRANGE") {
    output += field("Brikker i vist rekkefølge", round.tiles.map((tile) => tile.label).join(" · "));
    output += field("Godtatte svar", round.acceptedAnswers.join(" / "));
    output += field("Tilbakemelding ved nytt forsøk", round.retryFeedback);
  } else {
    if (round.type === "EVIDENCE") {
      output += "**Tekstgrunnlag:**\n\n" + round.passages.map((passage) => `- ${md(passage.id)}: ${md(passage.text)}\n`).join("") + "\n";
      output += field("NOT_STATED", "Teksten gir ikke nok informasjon / Teksten gir ikkje nok informasjon");
      output += field("Tilbakemelding ved feil tekstgrunnlag", round.evidenceRetry);
    }
    for (const option of round.options) {
      output += `- **${md(option.label)}** (${option.verdict}, ${md(option.id)}): ${md(option.feedback)}\n`;
      if ("evidenceIds" in option) output += `  Tekstgrunnlag: ${(option.evidenceIds as readonly string[]).map(md).join(", ") || "Ingen — nytt forsøk kreves"}.\n`;
    }
    output += "\n" + field("Løsningsforslag", round.model);
  }
  return output + field("Hint", round.hint) + field("Forklaring", round.explanation) + field("Valgfri refleksjon", round.reflection);
}

export function exerciseReviewMarkdown(packet: ExerciseReviewPacket): string {
  let output = `# Skynja — innhold til gjennomgang\n\nInnholdsutkast. Ingen menneskelig gjennomgang eller pilotautorisasjon er registrert i denne pakken.\n\n`;
  output += `${packet.exerciseCount} øvelser, ${packet.semanticRoundCount} semantiske runder, ${packet.localizedRoundCount} målformsrealiseringer.\n\n`;
  output += `Innholdssett SHA-256: \`${packet.contentSetSha256}\`\n\n`;
  output += "Vurder bokmål og nynorsk selvstendig. Kontroller oppgave, alle mulige svar, begrunnelser, støtte, verdighet og belastning. Henvis til øvelse, målform og runde-ID ved funn. Utfylling av reviewmalen må skje uten elevopplysninger; avtalt ansvarlig må kontrollere faktisk reviewer, mandat og dokumentasjon før en beslutning.\n\n";
  output += "MATCHED = samsvar med oppgaven; REASONABLE = begrunnet valg; NEEDS_CONTEXT = mer informasjon trengs; TRY_AGAIN = nytt forsøk. Ingen av dem er en ferdighetsscore.\n\n";
  output += "Det finnes ikke innspilt opplesning for disse utkastene. Støttet gjennomføring dokumenterer arbeid med støtte, ikke uavhengig lesing.\n\n";
  if (packet.excludedExerciseIds.length) output += field("Sperret innhold er utelatt", packet.excludedExerciseIds.join(", "));
  for (const entry of packet.exercises) {
    output += `## ${md(entry.content.locales["nb-NO"].title)} / ${md(entry.content.locales["nn-NO"].title)}\n\n`;
    output += field("Øvelse og revisjon", `${entry.exerciseId}, ${entry.revision}`);
    output += `Innhold SHA-256: \`${entry.contentSha256}\`\n\n`;
    for (const locale of REVIEW_LOCALES) {
      const variant = entry.content.locales[locale];
      output += `### ${locale === "nb-NO" ? "Bokmål" : "Nynorsk"}\n\nMålform SHA-256: \`${entry.localeSha256[locale]}\`\n\n`;
      for (const [label, value] of [["Tittel", variant.title], ["Introduksjon", variant.summary], ["Formål", variant.purpose], ["Underveis", variant.observe], ["Videreføring", variant.transfer]] as const) output += field(label, value);
      output += variant.rounds.map(roundMarkdown).join("");
    }
  }
  return `${output.trimEnd()}\n`;
}

export { canonicalJson as exerciseReviewJson };
