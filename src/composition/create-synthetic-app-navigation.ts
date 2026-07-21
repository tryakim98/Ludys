import { FixedClock } from "../adapters/in-memory/fixed-clock.js";
import {
  DeterministicIdGenerator,
  DeterministicReconnectTransport,
  InMemoryLifecycleObservability,
  InMemoryLifecycleRepository,
} from "../adapters/in-memory/in-memory-session-lifecycle.js";
import { SyntheticAppNavigationController } from "../application/synthetic-app-navigation-controller.js";
import { wordProofContentNb } from "../content/fixtures/bm/word-proof-content.js";
import { wordProofNb } from "../content/fixtures/bm/word-proof.js";
import { wordProofContentNn } from "../content/fixtures/nn/word-proof-content.js";
import { wordProofNn } from "../content/fixtures/nn/word-proof.js";
import type { Locale } from "../core/content-contracts.js";

export function createSyntheticAppNavigation(
  locale: Locale,
  ephemeralNamespace = "local-proof",
) {
  const repository = new InMemoryLifecycleRepository();
  const clock = new FixedClock("2026-07-21T12:00:00.000Z");
  const idGenerator = new DeterministicIdGenerator(
    `synthetic-wp13-7b-session-${ephemeralNamespace}`,
  );
  const observability = new InMemoryLifecycleObservability();
  const transport = new DeterministicReconnectTransport(repository, 40);
  const controller = new SyntheticAppNavigationController({
    locale,
    repository,
    clock,
    idGenerator,
    transport,
    observability,
    contentByLocale: {
      "nb-NO": { definition: wordProofNb, content: wordProofContentNb },
      "nn-NO": { definition: wordProofNn, content: wordProofContentNn },
    },
  });
  return { controller, repository, transport, observability };
}
