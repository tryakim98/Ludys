import type { Locale } from "../content-contracts.js";

export const EXERCISE_KINDS = ["WORD", "COMPOUND", "CLOZE", "SENTENCE", "READING", "JUDGMENT", "EVIDENCE"] as const;
export type ExerciseKind = typeof EXERCISE_KINDS[number];
export type Localized<T> = Readonly<Record<Locale, T>>;
export type Verdict = "MATCHED" | "REASONABLE" | "NEEDS_CONTEXT" | "TRY_AGAIN";

interface RoundBase {
  readonly id: string;
  readonly prompt: string;
  readonly stimulus: string;
  readonly hint: string;
  readonly explanation: string;
  readonly reflection: string;
}

export interface ArrangeRound extends RoundBase {
  readonly type: "ARRANGE";
  readonly tiles: readonly { readonly id: string; readonly label: string }[];
  readonly joiner: "" | " ";
  readonly acceptedAnswers: readonly string[];
  readonly retryFeedback: string;
}

export interface ChoiceRound extends RoundBase {
  readonly type: "CHOOSE";
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
    readonly verdict: Verdict;
    readonly feedback: string;
  }[];
  readonly model: string;
}

export const NOT_STATED = "NOT_STATED" as const;
export interface EvidenceRound extends Omit<ChoiceRound, "type" | "options"> {
  readonly type: "EVIDENCE";
  readonly passages: readonly { readonly id: string; readonly text: string }[];
  readonly options: readonly (ChoiceRound["options"][number] & { readonly evidenceIds: readonly string[] })[];
  readonly evidenceRetry: string;
}

export type ExerciseRound = ArrangeRound | ChoiceRound | EvidenceRound;
export interface ExerciseVariant {
  readonly title: string;
  readonly summary: string;
  readonly purpose: string;
  readonly observe: string;
  readonly transfer: string;
  readonly rounds: readonly ExerciseRound[];
}

export interface ExerciseDefinition {
  readonly id: string;
  readonly revision: number;
  readonly kind: ExerciseKind;
  readonly sourceActivityId?: string;
  readonly provenance: "AI_ASSISTED_CONTENT_DRAFT";
  readonly reviewStatus: "DRAFT_REVIEW_REQUIRED";
  readonly humanReviewed: false;
  readonly locales: Localized<ExerciseVariant>;
}

export interface ExerciseFeedback {
  readonly verdict: Verdict;
  readonly text: string;
}

export function assembleAnswer(round: ArrangeRound, tileIds: readonly string[]): string | undefined {
  if (new Set(tileIds).size !== tileIds.length) return undefined;
  const labels = tileIds.map((id) => round.tiles.find((tile) => tile.id === id)?.label);
  if (labels.some((label) => label === undefined)) return undefined;
  return labels.join(round.joiner);
}

function normalized(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function canBuildAnswer(answer: string, labels: readonly string[], joiner: "" | " "): boolean {
  if (labels.length === 0) return answer === "";
  return labels.some((label, index) => {
    const prefix = labels.length === 1 ? label : label + joiner;
    return answer.startsWith(prefix) && canBuildAnswer(answer.slice(prefix.length), labels.filter((_, i) => i !== index), joiner);
  });
}

export function evaluateArrangement(round: ArrangeRound, tileIds: readonly string[]): ExerciseFeedback {
  const answer = assembleAnswer(round, tileIds);
  const matched = answer !== undefined && tileIds.length === round.tiles.length
    && round.acceptedAnswers.some((accepted) => normalized(accepted) === normalized(answer));
  return { verdict: matched ? "MATCHED" : "TRY_AGAIN", text: matched ? round.explanation : round.retryFeedback };
}

export function evaluateEvidence(round: EvidenceRound, optionId: string, evidenceId: string): ExerciseFeedback {
  const option = round.options.find((item) => item.id === optionId);
  if (option === undefined) return { verdict: "TRY_AGAIN", text: round.evidenceRetry };
  if (option.verdict === "TRY_AGAIN") return { verdict: "TRY_AGAIN", text: option.feedback };
  if (!option.evidenceIds.includes(evidenceId)) return { verdict: "TRY_AGAIN", text: round.evidenceRetry };
  return { verdict: option.verdict, text: option.feedback };
}

// These checks validate a runnable draft, not its linguistic or pedagogical approval.
export function validateExerciseCatalog(catalog: readonly ExerciseDefinition[]): readonly string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const exercise of catalog) {
    if (seen.has(exercise.id) || exercise.id.trim() === "") errors.push(`duplicate or empty exercise: ${exercise.id}`);
    seen.add(exercise.id);
    if (!EXERCISE_KINDS.includes(exercise.kind) || !Number.isInteger(exercise.revision) || exercise.revision < 1) errors.push(`${exercise.id}: invalid metadata`);
    if (exercise.humanReviewed !== false || exercise.reviewStatus !== "DRAFT_REVIEW_REQUIRED"
      || exercise.provenance !== "AI_ASSISTED_CONTENT_DRAFT") errors.push(`${exercise.id}: draft provenance required`);
    const variants = [exercise.locales["nb-NO"], exercise.locales["nn-NO"]];
    if (variants.some((variant) => variant === undefined)) {
      errors.push(`${exercise.id}: both language variants required`);
      continue;
    }
    if (JSON.stringify(variants[0]?.rounds.map((r) => [r.id, r.type])) !== JSON.stringify(variants[1]?.rounds.map((r) => [r.id, r.type]))) errors.push(`${exercise.id}: semantic round mismatch`);
    for (const locale of ["nb-NO", "nn-NO"] as const) {
      const variant = exercise.locales[locale];
      const prefix = `${exercise.id}/${locale}`;
      if ([variant.title, variant.summary, variant.purpose, variant.observe, variant.transfer].some((text) => text.trim() === "")) errors.push(`${prefix}: incomplete introduction`);
      if (variant.rounds.length === 0 || new Set(variant.rounds.map((r) => r.id)).size !== variant.rounds.length) errors.push(`${prefix}: empty or duplicate rounds`);
      for (const round of variant.rounds) {
        if ([round.id, round.prompt, round.stimulus, round.hint, round.explanation, round.reflection].some((text) => text.trim() === "")) errors.push(`${prefix}/${round.id}: incomplete round`);
        if (round.type === "ARRANGE") {
          if (!round.tiles.length || new Set(round.tiles.map((t) => t.id)).size !== round.tiles.length || round.tiles.some((t) => !t.id || !t.label.trim())) errors.push(`${prefix}/${round.id}: invalid tiles`);
          if (!round.acceptedAnswers.length || !round.retryFeedback.trim()) errors.push(`${prefix}/${round.id}: missing answer or feedback`);
          for (const answer of round.acceptedAnswers) {
            if (!answer.trim() || !canBuildAnswer(answer, round.tiles.map((t) => t.label), round.joiner)) errors.push(`${prefix}/${round.id}: answer inventory mismatch`);
          }
        } else {
          if (round.options.length < 2 || new Set(round.options.map((o) => o.id)).size !== round.options.length
            || round.options.some((o) => !o.id || !o.label.trim() || !o.feedback.trim())) errors.push(`${prefix}/${round.id}: invalid options`);
          if (!round.options.some((o) => o.verdict !== "TRY_AGAIN") || !round.model.trim()) errors.push(`${prefix}/${round.id}: missing defensible answer`);
          if (round.type === "EVIDENCE") {
            const ids = new Set(round.passages.map((passage) => passage.id));
            if (ids.size !== round.passages.length || ids.has(NOT_STATED) || round.passages.length < 2
              || round.passages.some((passage) => !passage.id.trim() || !passage.text.trim()) || !round.evidenceRetry.trim()) errors.push(`${prefix}/${round.id}: invalid evidence passages`);
            for (const option of round.options) {
              if (option.evidenceIds.some((id) => id !== NOT_STATED && !ids.has(id))
                || new Set(option.evidenceIds).size !== option.evidenceIds.length
                || (option.verdict !== "TRY_AGAIN" && option.evidenceIds.length === 0)
                || (option.verdict === "TRY_AGAIN" && option.evidenceIds.length !== 0)
                || (option.evidenceIds.includes(NOT_STATED) && option.verdict !== "NEEDS_CONTEXT")) errors.push(`${prefix}/${round.id}: invalid answer/evidence link`);
            }
          }
        }
      }
    }
  }
  return errors;
}
