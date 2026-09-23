import type { EvidenceRound, ExerciseDefinition, ExerciseKind, ExerciseRound, Localized, Verdict } from "../../core/skynja/exercise-room.js";

// Each realization is supplied explicitly. Neither locale is a fallback or a master.
export function bi<T>(nb: T, nn: T): Localized<T> { return { "nb-NO": nb, "nn-NO": nn }; }

function realize<T>(render: (locale: "nb-NO" | "nn-NO") => T): Localized<T> {
  return bi(render("nb-NO"), render("nn-NO"));
}

interface RoundDraft {
  readonly id: string;
  readonly prompt: Localized<string>;
  readonly stimulus: Localized<string>;
  readonly hint: Localized<string>;
  readonly explanation: Localized<string>;
  readonly reflection: Localized<string>;
}

export function arrange(draft: RoundDraft & {
  readonly pieces: Localized<readonly string[]>;
  readonly answers: Localized<readonly string[]>;
  readonly joiner: "" | " ";
}): Localized<ExerciseRound> {
  return realize((locale) => ({
    type: "ARRANGE", id: draft.id, prompt: draft.prompt[locale], stimulus: draft.stimulus[locale],
    hint: draft.hint[locale], explanation: draft.explanation[locale], reflection: draft.reflection[locale],
    tiles: draft.pieces[locale].map((label, i) => ({ id: `${draft.id}-tile-${i}`, label })),
    joiner: draft.joiner, acceptedAnswers: draft.answers[locale],
    retryFeedback: locale === "nb-NO"
      ? "Denne rekkefølgen passer ikke til oppgaven ennå. Du kan flytte en brikke, se et hint eller åpne løsningsforslaget."
      : "Denne rekkjefølgja passar ikkje til oppgåva enno. Du kan flytte ei brikke, sjå eit hint eller opne løysingsforslaget.",
  }));
}

export function choose(draft: RoundDraft & {
  readonly options: readonly { readonly label: Localized<string>; readonly verdict: Verdict; readonly feedback: Localized<string> }[];
  readonly model: Localized<string>;
}): Localized<ExerciseRound> {
  return realize((locale) => ({
    type: "CHOOSE", id: draft.id, prompt: draft.prompt[locale], stimulus: draft.stimulus[locale],
    hint: draft.hint[locale], explanation: draft.explanation[locale], reflection: draft.reflection[locale],
    options: draft.options.map((option, i) => ({ id: `${draft.id}-option-${i}`, label: option.label[locale], verdict: option.verdict, feedback: option.feedback[locale] })),
    model: draft.model[locale],
  }));
}

export function exercise(draft: {
  readonly id: string; readonly kind: ExerciseKind; readonly sourceActivityId?: string;
  readonly title: Localized<string>; readonly summary: Localized<string>; readonly purpose: Localized<string>;
  readonly observe: Localized<string>; readonly transfer: Localized<string>;
  readonly rounds: readonly Localized<ExerciseRound>[];
}): ExerciseDefinition {
  return {
    id: draft.id, kind: draft.kind, revision: 1,
    ...(draft.sourceActivityId === undefined ? {} : { sourceActivityId: draft.sourceActivityId }),
    provenance: "AI_ASSISTED_CONTENT_DRAFT", reviewStatus: "DRAFT_REVIEW_REQUIRED", humanReviewed: false,
    locales: realize((locale) => ({ title: draft.title[locale], summary: draft.summary[locale],
      purpose: draft.purpose[locale], observe: draft.observe[locale], transfer: draft.transfer[locale],
      rounds: draft.rounds.map((round) => round[locale]) })),
  };
}

export function evidence(draft: RoundDraft & {
  readonly passages: readonly { readonly id: string; readonly text: Localized<string> }[];
  readonly options: readonly { readonly label: Localized<string>; readonly verdict: Verdict; readonly feedback: Localized<string>; readonly evidenceIds: readonly string[] }[];
  readonly model: Localized<string>;
  readonly evidenceRetry: Localized<string>;
}): Localized<EvidenceRound> {
  return realize((locale) => ({
    type: "EVIDENCE", id: draft.id, prompt: draft.prompt[locale], stimulus: draft.stimulus[locale],
    hint: draft.hint[locale], explanation: draft.explanation[locale], reflection: draft.reflection[locale],
    passages: draft.passages.map((passage) => ({ id: passage.id, text: passage.text[locale] })),
    options: draft.options.map((option, i) => ({ id: `${draft.id}-option-${i}`, label: option.label[locale], verdict: option.verdict, feedback: option.feedback[locale], evidenceIds: option.evidenceIds })),
    model: draft.model[locale], evidenceRetry: draft.evidenceRetry[locale],
  }));
}
