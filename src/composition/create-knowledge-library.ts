import { InMemoryKnowledgeCatalog } from "../adapters/in-memory/in-memory-knowledge-catalog.js";
import { KnowledgeLibraryController } from "../application/knowledge-library-controller.js";
import { knowledgeAudioPrototypeRelease } from "../content/prototype/knowledge-audio-release.js";
import type { Locale } from "../core/content-contracts.js";

export function createKnowledgeLibraryController(
  locale: Locale,
): KnowledgeLibraryController {
  return new KnowledgeLibraryController({
    catalog: new InMemoryKnowledgeCatalog(knowledgeAudioPrototypeRelease),
    locale,
  });
}
