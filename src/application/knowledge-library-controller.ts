import type {
  AdultRole,
  KnowledgeDurationMinutes,
  KnowledgeNeed,
  KnowledgeTopic,
  LocalizedKnowledgeView,
  ResolvedAudioPreview,
} from "../core/knowledge-audio-prototype.js";
import type { AgeBand, Locale } from "../core/content-contracts.js";
import type { KnowledgeCatalogPort } from "../ports/knowledge.js";

export interface KnowledgeLibraryFilters {
  readonly role: AdultRole | "ALL";
  readonly ageBand: AgeBand | "ALL";
  readonly topic: KnowledgeTopic | "ALL";
  readonly need: KnowledgeNeed | "ALL";
  readonly maxDurationMinutes: KnowledgeDurationMinutes | "ALL";
}

export interface KnowledgeLibrarySnapshot {
  readonly locale: Locale;
  readonly releaseId: string;
  readonly filters: KnowledgeLibraryFilters;
  readonly results: readonly LocalizedKnowledgeView[];
  readonly selected: LocalizedKnowledgeView | undefined;
  readonly audio: ResolvedAudioPreview | undefined;
  readonly counts: {
    readonly knowledgeUnits: number;
    readonly contextCards: number;
    readonly audioSpecifications: number;
    readonly internalAudioPreviews: number;
  };
}

const DEFAULT_FILTERS: KnowledgeLibraryFilters = {
  role: "ALL",
  ageBand: "ALL",
  topic: "ALL",
  need: "ALL",
  maxDurationMinutes: "ALL",
};

export class KnowledgeLibraryController {
  readonly #catalog: KnowledgeCatalogPort;
  #locale: Locale;
  #filters: KnowledgeLibraryFilters = DEFAULT_FILTERS;
  #selectedKnowledgeId: string | undefined;

  constructor(input: { readonly catalog: KnowledgeCatalogPort; readonly locale: Locale }) {
    this.#catalog = input.catalog;
    this.#locale = input.locale;
  }

  setLocale(locale: Locale): void {
    this.#locale = locale;
    this.#selectedKnowledgeId = undefined;
  }

  setFilters(filters: Partial<KnowledgeLibraryFilters>): void {
    this.#filters = { ...this.#filters, ...filters };
    const resultIds = new Set(this.#results().map((unit) => unit.knowledgeId));
    if (
      this.#selectedKnowledgeId !== undefined &&
      !resultIds.has(this.#selectedKnowledgeId)
    ) {
      this.#selectedKnowledgeId = undefined;
    }
  }

  select(knowledgeId: string): void {
    const candidate = this.#results().find((unit) => unit.knowledgeId === knowledgeId);
    if (candidate === undefined) throw new Error("knowledge unit is not in current result set");
    this.#selectedKnowledgeId = knowledgeId;
  }

  clearSelection(): void {
    this.#selectedKnowledgeId = undefined;
  }

  get snapshot(): KnowledgeLibrarySnapshot {
    const release = this.#catalog.release();
    const results = this.#results();
    const selected =
      results.find((unit) => unit.knowledgeId === this.#selectedKnowledgeId) ??
      results[0];
    const audio =
      selected === undefined
        ? undefined
        : this.#catalog.resolveAudio({
            audioSpecId: selected.audioSpecId,
            locale: this.#locale,
          });
    const internalAudioPreviews = this.#catalog
      .audioSpecifications()
      .filter((spec) => spec.publicationStatus === "INTERNAL_REVIEW")
      .length;
    return {
      locale: this.#locale,
      releaseId: release.releaseId,
      filters: this.#filters,
      results,
      selected,
      audio,
      counts: {
        knowledgeUnits: release.knowledgeUnits.length,
        contextCards: release.contextCards.length,
        audioSpecifications: release.audioSpecifications.length,
        internalAudioPreviews,
      },
    };
  }

  #results(): readonly LocalizedKnowledgeView[] {
    return this.#catalog.search({
      locale: this.#locale,
      ...(this.#filters.role === "ALL" ? {} : { role: this.#filters.role }),
      ...(this.#filters.ageBand === "ALL"
        ? {}
        : { ageBand: this.#filters.ageBand }),
      ...(this.#filters.topic === "ALL" ? {} : { topic: this.#filters.topic }),
      ...(this.#filters.need === "ALL" ? {} : { need: this.#filters.need }),
      ...(this.#filters.maxDurationMinutes === "ALL"
        ? {}
        : { maxDurationMinutes: this.#filters.maxDurationMinutes }),
    });
  }
}
