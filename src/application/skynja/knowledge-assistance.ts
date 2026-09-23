import { resolveKnowledgeUse, type GroundedKnowledgeContext, type KnowledgeUseRequest } from "../../core/skynja/knowledge-policy.js";
import type { ControlledKnowledgeLibraryPort, KnowledgeSelectorPort } from "../../ports/skynja/knowledge-assistance.js";

export type KnowledgeAssistanceResult =
  | { readonly status: "ANSWER"; readonly delivery: "APPROVED_EXCERPTS"; readonly context: GroundedKnowledgeContext }
  | { readonly status: "ABSTAIN"; readonly reason: string }
  | { readonly status: "STOPPED" };

function selectedIds(value: unknown): readonly string[] | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const object = value as Record<string, unknown>;
  if (Object.keys(object).length !== 1 || !Array.isArray(object.claimIds) || object.claimIds.length === 0
    || object.claimIds.some((id: unknown) => typeof id !== "string" || id.trim().length === 0)) return undefined;
  const ids = object.claimIds as string[];
  return new Set(ids).size === ids.length ? ids : undefined;
}

type Selection = { readonly status: "SELECTED"; readonly value: unknown } | { readonly status: "STOPPED" };

async function selectUntilStopped(selector: KnowledgeSelectorPort, context: GroundedKnowledgeContext, signal: AbortSignal): Promise<Selection> {
  let onAbort = () => {};
  const stopped = new Promise<Selection>((resolve) => {
    onAbort = () => resolve({ status: "STOPPED" });
    signal.addEventListener("abort", onAbort, { once: true });
  });
  // Race the caller's stop even if a future provider ignores its AbortSignal.
  const selected = Promise.resolve().then(async (): Promise<Selection> => signal.aborted
    ? { status: "STOPPED" }
    : { status: "SELECTED", value: await selector.select(context, signal) });
  try { return await Promise.race([selected, stopped]); }
  finally { signal.removeEventListener("abort", onAbort); }
}

/** No provider is installed or connected by this module. Caller owns stop/pause signal. */
export async function provideKnowledgeAssistance(
  request: KnowledgeUseRequest,
  dependencies: { readonly library: ControlledKnowledgeLibraryPort; readonly selector: KnowledgeSelectorPort; readonly now: () => string },
  signal: AbortSignal,
): Promise<KnowledgeAssistanceResult> {
  if (signal.aborted) return { status: "STOPPED" };
  const stableRequest = structuredClone(request);
  try {
    const initial = structuredClone(resolveKnowledgeUse(dependencies.library.snapshot(), stableRequest, dependencies.now()));
    if (initial.status === "ABSTAIN") return initial;
    // Never let a selector mutate the authoritative context or write its own prose into the answer.
    const proposed = await selectUntilStopped(dependencies.selector, structuredClone(initial.context), signal);
    if (signal.aborted || proposed.status === "STOPPED") return { status: "STOPPED" };
    const ids = selectedIds(proposed.value);
    if (!ids || ids.some((id) => !initial.context.excerpts.some((item) => item.claimReference.id === id))) {
      return { status: "ABSTAIN", reason: "INVALID_SELECTION" };
    }
    const current = resolveKnowledgeUse(dependencies.library.snapshot(), stableRequest, dependencies.now());
    if (current.status === "ABSTAIN") return current;
    if (JSON.stringify(current.context) !== JSON.stringify(initial.context)) return { status: "ABSTAIN", reason: "KNOWLEDGE_CHANGED" };
    return structuredClone({ status: "ANSWER", delivery: "APPROVED_EXCERPTS", context: { ...current.context,
      excerpts: ids.map((id) => current.context.excerpts.find((item) => item.claimReference.id === id)!) } });
  } catch {
    return signal.aborted ? { status: "STOPPED" } : { status: "ABSTAIN", reason: "KNOWLEDGE_SERVICE_UNAVAILABLE" };
  }
}
