import { FixedClock } from "../adapters/in-memory/fixed-clock.js";
import {
  DeterministicIdGenerator,
  DeterministicReconnectTransport,
  InMemoryLifecycleObservability,
  InMemoryLifecycleRepository,
} from "../adapters/in-memory/in-memory-session-lifecycle.js";
import { SessionLifecycleController } from "../application/session-lifecycle-controller.js";
import type { Locale } from "../core/content-contracts.js";

export function createSessionLifecycleProof(locale: Locale) {
  const repository = new InMemoryLifecycleRepository();
  const clock = new FixedClock("2026-07-16T12:00:00.000Z");
  const idGenerator = new DeterministicIdGenerator();
  const observability = new InMemoryLifecycleObservability();
  const transport = new DeterministicReconnectTransport(repository, 40);
  const controller = new SessionLifecycleController(
    locale,
    repository,
    clock,
    idGenerator,
    transport,
    observability,
  );
  return { controller, repository, transport, observability };
}
