import {
  filterKnowledge,
  resolveAudioPreview,
  type KnowledgeAudioPrototypeRelease,
} from "../../core/knowledge-audio-prototype.js";
import type {
  KnowledgeCatalogPort,
  KnowledgeCatalogQuery,
} from "../../ports/knowledge.js";
import type { Locale } from "../../core/content-contracts.js";

export class InMemoryKnowledgeCatalog implements KnowledgeCatalogPort {
  readonly #release: KnowledgeAudioPrototypeRelease;

  constructor(release: KnowledgeAudioPrototypeRelease) {
    this.#release = release;
  }

  release(): KnowledgeAudioPrototypeRelease {
    return this.#release;
  }

  search(query: KnowledgeCatalogQuery) {
    return filterKnowledge(this.#release, query);
  }

  resolveKnowledge(input: { readonly knowledgeId: string; readonly locale: Locale }) {
    return filterKnowledge(this.#release, { locale: input.locale }).find(
      (unit) => unit.knowledgeId === input.knowledgeId,
    );
  }

  resolveAudio(input: { readonly audioSpecId: string; readonly locale: Locale }) {
    return resolveAudioPreview(this.#release, input);
  }

  audioSpecifications() {
    return this.#release.audioSpecifications;
  }
}
