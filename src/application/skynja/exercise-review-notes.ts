import type { Locale } from "../../core/content-contracts.js";
import type { ExerciseDefinition } from "../../core/skynja/exercise-room.js";
import { createExerciseReviewPacket, exerciseReviewJson, type ExerciseReviewPacket } from "./exercise-review.js";

export const NOTE_CATEGORIES = ["LANGUAGE", "TASK", "SUPPORT", "ACCESSIBILITY", "DIGNITY"] as const;
export const NOTE_SEVERITIES = ["COMMENT", "NEEDS_CHANGE", "BLOCKER"] as const;
export const NOTE_FILE_LIMIT = 1024 * 1024;

export interface ReviewNoteDraft {
  readonly locale: Locale;
  readonly roundId: string;
  readonly category: typeof NOTE_CATEGORIES[number];
  readonly severity: typeof NOTE_SEVERITIES[number];
  readonly observation: string;
  readonly suggestion: string;
}

export interface ExerciseReviewNote extends ReviewNoteDraft {
  readonly id: string;
  readonly exerciseId: string;
  readonly revision: number;
  readonly contentSha256: string;
  readonly localeSha256: string;
}

export type NoteImportResult = "IMPORTED" | "CANCELLED" | "INVALID_FILE" | "VERSION_MISMATCH" | "CONFLICT";
const NOTE_KEYS = ["id", "exerciseId", "revision", "contentSha256", "localeSha256", "locale", "roundId", "category", "severity", "observation", "suggestion"].sort();
const FILE_KEYS = ["schemaVersion", "classification", "contentSetSha256", "notes"].sort();
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys);

/** Local editorial work. These notes cannot change content, review status or pilot authority. */
export class ExerciseReviewNotesController {
  readonly #catalog: readonly ExerciseDefinition[];
  readonly #blocked = new Set<string>();
  #packet: ExerciseReviewPacket;
  #notes: ExerciseReviewNote[] = [];
  #importGeneration = 0;

  constructor(catalog: readonly ExerciseDefinition[], blockedIds: readonly string[] = []) {
    this.#catalog = structuredClone(catalog);
    blockedIds.forEach((id) => this.#blocked.add(id));
    this.#packet = createExerciseReviewPacket(this.#catalog, [...this.#blocked]);
  }

  get packet(): ExerciseReviewPacket { return structuredClone(this.#packet); }
  get notes(): readonly ExerciseReviewNote[] { return structuredClone(this.#notes); }
  get count(): number { return this.#notes.length; }
  get importGeneration(): number { return this.#importGeneration; }
  cancelPendingImports(): void { this.#importGeneration += 1; }

  restrict(ids: readonly string[]): void {
    if (ids.every((id) => this.#blocked.has(id))) return;
    ids.forEach((id) => this.#blocked.add(id));
    this.#packet = createExerciseReviewPacket(this.#catalog, [...this.#blocked]);
    this.#notes = this.#notes.filter((note) => this.#packet.exercises.some((entry) => entry.exerciseId === note.exerciseId));
    this.cancelPendingImports();
  }

  #validNote(value: unknown): value is ExerciseReviewNote {
    if (!record(value) || !exactKeys(value, NOTE_KEYS)) return false;
    const entry = this.#packet.exercises.find((item) => item.exerciseId === value.exerciseId);
    if (entry === undefined || (value.locale !== "nb-NO" && value.locale !== "nn-NO")) return false;
    const locale = value.locale as Locale;
    return typeof value.id === "string" && /^[a-zA-Z0-9-]{1,80}$/u.test(value.id)
      && value.revision === entry.revision && value.contentSha256 === entry.contentSha256
      && value.localeSha256 === entry.localeSha256[locale]
      && typeof value.roundId === "string" && (value.roundId === "" || entry.content.locales[locale].rounds.some((round) => round.id === value.roundId))
      && NOTE_CATEGORIES.includes(value.category as typeof NOTE_CATEGORIES[number])
      && NOTE_SEVERITIES.includes(value.severity as typeof NOTE_SEVERITIES[number])
      && typeof value.observation === "string" && value.observation.trim().length > 0 && value.observation.length <= 2000
      && typeof value.suggestion === "string" && value.suggestion.length <= 2000;
  }

  add(id: string, exerciseId: string, draft: ReviewNoteDraft): boolean {
    const entry = this.#packet.exercises.find((item) => item.exerciseId === exerciseId);
    if (entry === undefined || this.#notes.length >= 200 || this.#notes.some((note) => note.id === id)) return false;
    const note = { ...draft, id, exerciseId, revision: entry.revision, contentSha256: entry.contentSha256, localeSha256: entry.localeSha256[draft.locale] };
    if (!this.#validNote(note) || !this.#fitsFile([...this.#notes, note])) return false;
    this.#notes.push(structuredClone(note));
    this.cancelPendingImports();
    return true;
  }

  remove(id: string): void {
    this.#notes = this.#notes.filter((note) => note.id !== id);
    this.cancelPendingImports();
  }

  clear(): void { this.#notes = []; this.cancelPendingImports(); }

  exportJson(): string {
    return this.#serialize(this.#notes);
  }

  #serialize(notes: readonly ExerciseReviewNote[]): string {
    return exerciseReviewJson({ schemaVersion: "skynja-review-notes.v1", classification: "EDITORIAL_NOTES_NOT_APPROVAL", contentSetSha256: this.#packet.contentSetSha256, notes });
  }

  #fitsFile(notes: readonly ExerciseReviewNote[]): boolean {
    return new TextEncoder().encode(this.#serialize(notes)).length <= NOTE_FILE_LIMIT;
  }

  importJson(json: string, generation: number): NoteImportResult {
    if (generation !== this.#importGeneration) return "CANCELLED";
    if (new TextEncoder().encode(json).length > NOTE_FILE_LIMIT) return "INVALID_FILE";
    let file: unknown;
    try { file = JSON.parse(json); } catch { return "INVALID_FILE"; }
    if (!record(file) || !exactKeys(file, FILE_KEYS) || file.schemaVersion !== "skynja-review-notes.v1"
      || file.classification !== "EDITORIAL_NOTES_NOT_APPROVAL" || !Array.isArray(file.notes) || file.notes.length > 200) return "INVALID_FILE";
    if (file.contentSetSha256 !== this.#packet.contentSetSha256) return "VERSION_MISMATCH";
    const incoming: ExerciseReviewNote[] = [];
    const seen = new Set<string>();
    for (const value of file.notes) {
      if (!this.#validNote(value) || seen.has(value.id)) return "INVALID_FILE";
      seen.add(value.id);
      const existing = this.#notes.find((note) => note.id === value.id);
      if (existing !== undefined && exerciseReviewJson(existing) !== exerciseReviewJson(value)) return "CONFLICT";
      if (existing === undefined) incoming.push(structuredClone(value));
    }
    if (this.#notes.length + incoming.length > 200 || !this.#fitsFile([...this.#notes, ...incoming])) return "INVALID_FILE";
    this.#notes.push(...incoming);
    this.cancelPendingImports();
    return "IMPORTED";
  }
}
