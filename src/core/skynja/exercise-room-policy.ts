import type { CorpusLifecyclePolicy } from "../draft-learning-corpus.js";
import type { ExerciseDefinition } from "./exercise-room.js";

// One persisted restrictive policy can address both catalogs. The historical
// controller still validates its own scopes; only explicitly known exercise IDs
// are routed to the new room. Unknown IDs are never silently discarded.
export function partitionExercisePolicy(policy: CorpusLifecyclePolicy, catalog: readonly ExerciseDefinition[]): {
  readonly legacyPolicy: CorpusLifecyclePolicy;
  readonly blockedIds: readonly string[];
} {
  if (!Number.isInteger(policy.policyRevision) || policy.policyRevision < 1
    || policy.containsPersonData !== false || policy.resurrectionAllowed !== false
    || !Array.isArray(policy.restrictions)
    || policy.restrictions.some((item) => item === null || typeof item !== "object"
      || !["ACTIVITY", "PATTERN_CLASS"].includes(item.scope)
      || typeof item.scopeId !== "string" || !item.scopeId.trim()
      || !["STALE", "SUPERSEDED", "WITHDRAWN"].includes(item.lifecycleStatus))) {
    throw new Error("Invalid restrictive content policy");
  }
  const known = new Set(catalog.flatMap((exercise) => exercise.sourceActivityId === undefined ? [exercise.id] : [exercise.id, exercise.sourceActivityId]));
  return {
    legacyPolicy: { ...policy, restrictions: policy.restrictions.filter((item) => item.scope !== "ACTIVITY" || !known.has(item.scopeId)) },
    blockedIds: policy.restrictions.filter((item) => item.scope === "ACTIVITY" && known.has(item.scopeId)).map((item) => item.scopeId),
  };
}
