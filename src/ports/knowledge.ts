import type {
  AdultRole,
  AudioPrototypeSpecification,
  KnowledgeAudioPrototypeRelease,
  KnowledgeDurationMinutes,
  KnowledgeNeed,
  KnowledgeTopic,
  LocalizedKnowledgeView,
  ResolvedAudioPreview,
} from "../core/knowledge-audio-prototype.js";
import type { AgeBand, Locale } from "../core/content-contracts.js";

export interface KnowledgeCatalogQuery {
  readonly locale: Locale;
  readonly role?: AdultRole;
  readonly ageBand?: AgeBand;
  readonly topic?: KnowledgeTopic;
  readonly need?: KnowledgeNeed;
  readonly maxDurationMinutes?: KnowledgeDurationMinutes;
}

export interface KnowledgeCatalogPort {
  release(): KnowledgeAudioPrototypeRelease;
  search(query: KnowledgeCatalogQuery): readonly LocalizedKnowledgeView[];
  resolveKnowledge(input: {
    readonly knowledgeId: string;
    readonly locale: Locale;
  }): LocalizedKnowledgeView | undefined;
  resolveAudio(input: {
    readonly audioSpecId: string;
    readonly locale: Locale;
  }): ResolvedAudioPreview | undefined;
  audioSpecifications(): readonly AudioPrototypeSpecification[];
}
