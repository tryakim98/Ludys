/** SKP-031/041/042/050. Pure contracts; these types do not grant real-use approval. */
export const SKYNJA_KNOWLEDGE_POLICY = "SKYNJA-KNOWLEDGE-1" as const;

export interface VersionReference {
  readonly id: string;
  readonly revision: number;
}

/** UI language, generated/written language and speech are independent dimensions. */
export interface LanguageContext {
  readonly uiLocale: string;
  readonly outputLanguage: string;
  readonly writtenStandard: string | null;
  readonly spokenVariety: string | null;
}

export interface LibrarySource {
  readonly reference: VersionReference;
  readonly kind: "APPROVED_LIBRARY_SOURCE";
  readonly state: "CURRENT" | "WITHDRAWN";
  readonly origin: string;
  readonly verifiedAt: string;
}

export interface LibraryEvidence {
  readonly reference: VersionReference;
  readonly sourceReferences: readonly VersionReference[];
  readonly strength: "DIRECT" | "INDIRECT" | "LIMITED" | "CONFLICTING";
  readonly limitations: readonly string[];
}

export interface LibraryClaim {
  readonly reference: VersionReference;
  readonly state: "DRAFT" | "REVIEWED" | "WITHDRAWN";
  readonly layer: "DOMAIN_KNOWLEDGE" | "PRODUCT_OUTCOME";
  readonly classification: "OBSERVATION" | "PATTERN" | "HYPOTHESIS" | "ESTABLISHED_FACT";
  readonly purposes: readonly string[];
  readonly contexts: readonly string[];
  readonly reverifyAfter: string;
  readonly evidence: readonly {
    readonly reference: VersionReference;
    readonly relation: "SUPPORTS" | "LIMITS" | "CONTRADICTS";
  }[];
  readonly realizations: readonly {
    readonly outputLanguage: string;
    readonly writtenStandard: string | null;
    readonly text: string;
    readonly reviewReference: VersionReference | null;
  }[];
}

/** Evidence strength and permission to use a claim are deliberately separate. */
export interface KnowledgeUseRule {
  readonly reference: VersionReference;
  readonly state: "DRAFT" | "APPROVED" | "WITHDRAWN";
  readonly approvalReference: VersionReference | null;
  readonly claimReferences: readonly VersionReference[];
  readonly purposes: readonly string[];
  readonly contexts: readonly string[];
}

/** Supplied by a trusted library adapter, never by model output or an end-user prompt. */
export interface KnowledgeLibrarySnapshot {
  readonly reference: VersionReference;
  readonly current: boolean;
  readonly sources: readonly LibrarySource[];
  readonly evidence: readonly LibraryEvidence[];
  readonly claims: readonly LibraryClaim[];
  readonly rules: readonly KnowledgeUseRule[];
  readonly revokedClaimIds: readonly string[];
}

export interface KnowledgeUseRequest {
  readonly ruleReference: VersionReference;
  readonly claimReferences: readonly VersionReference[];
  readonly purpose: string;
  readonly context: string;
  readonly claimLayer: LibraryClaim["layer"];
  readonly language: LanguageContext;
}

export interface GroundedExcerpt {
  readonly claimReference: VersionReference;
  readonly layer: LibraryClaim["layer"];
  readonly classification: LibraryClaim["classification"];
  readonly text: string;
  readonly languageReviewReference: VersionReference;
  readonly trace: {
    readonly ruleReference: VersionReference;
    readonly approvalReference: VersionReference;
    readonly evidence: readonly {
      readonly record: LibraryEvidence;
      readonly relation: "SUPPORTS" | "LIMITS" | "CONTRADICTS";
      readonly sources: readonly LibrarySource[];
    }[];
  };
}

export interface GroundedKnowledgeContext {
  readonly policyVersion: typeof SKYNJA_KNOWLEDGE_POLICY;
  readonly libraryReference: VersionReference;
  readonly purpose: string;
  readonly context: string;
  readonly language: LanguageContext;
  readonly excerpts: readonly GroundedExcerpt[];
}

export type KnowledgeAbstentionReason =
  | "INVALID_REQUEST" | "LIBRARY_UNAVAILABLE" | "RULE_NOT_AUTHORIZED"
  | "CLAIM_UNAVAILABLE" | "SCOPE_MISMATCH" | "LANGUAGE_REVIEW_REQUIRED"
  | "EVIDENCE_CHAIN_INCOMPLETE" | "REVERIFICATION_REQUIRED";

export type KnowledgeUseDecision =
  | { readonly status: "RESOLVED"; readonly context: GroundedKnowledgeContext }
  | { readonly status: "ABSTAIN"; readonly reason: KnowledgeAbstentionReason };

function validReference(reference: VersionReference | null): reference is VersionReference {
  return reference !== null && reference.id.trim().length > 0 && Number.isInteger(reference.revision) && reference.revision > 0;
}

function sameReference(left: VersionReference, right: VersionReference): boolean {
  return left.id === right.id && left.revision === right.revision;
}

function resolve<T extends { readonly reference: VersionReference }>(items: readonly T[], reference: VersionReference): T | undefined {
  // An ambiguous ID is never resolved by whichever record happens to come first.
  const matches = items.filter((item) => item.reference.id === reference.id);
  return validReference(reference) && matches.length === 1 && sameReference(matches[0]!.reference, reference) ? matches[0] : undefined;
}

export function resolveKnowledgeUse(library: KnowledgeLibrarySnapshot, request: KnowledgeUseRequest, now: string): KnowledgeUseDecision {
  const abstain = (reason: KnowledgeAbstentionReason): KnowledgeUseDecision => ({ status: "ABSTAIN", reason });
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs) || !request.purpose.trim() || !request.context.trim() || !request.language.uiLocale.trim() || !request.language.outputLanguage.trim()
    || request.claimReferences.length === 0 || request.claimReferences.some((ref) => !validReference(ref))
    || new Set(request.claimReferences.map((ref) => ref.id)).size !== request.claimReferences.length) return abstain("INVALID_REQUEST");
  if (!library.current || !validReference(library.reference)) return abstain("LIBRARY_UNAVAILABLE");
  const rule = resolve(library.rules, request.ruleReference);
  if (!rule || rule.state !== "APPROVED" || !validReference(rule.approvalReference)) return abstain("RULE_NOT_AUTHORIZED");
  if (!rule.purposes.includes(request.purpose) || !rule.contexts.includes(request.context)) return abstain("SCOPE_MISMATCH");
  const excerpts: GroundedExcerpt[] = [];
  for (const ref of request.claimReferences) {
    const claim = resolve(library.claims, ref);
    if (!claim || claim.state !== "REVIEWED" || library.revokedClaimIds.includes(ref.id)) return abstain("CLAIM_UNAVAILABLE");
    if (!rule.claimReferences.some((allowed) => sameReference(allowed, ref))) return abstain("RULE_NOT_AUTHORIZED");
    if (claim.layer !== request.claimLayer || !claim.purposes.includes(request.purpose) || !claim.contexts.includes(request.context)) return abstain("SCOPE_MISMATCH");
    const reverifyMs = Date.parse(claim.reverifyAfter);
    if (!Number.isFinite(reverifyMs) || reverifyMs <= nowMs) return abstain("REVERIFICATION_REQUIRED");
    const variants = claim.realizations.filter((item) => item.outputLanguage === request.language.outputLanguage && item.writtenStandard === request.language.writtenStandard);
    const variant = variants.length === 1 ? variants[0] : undefined;
    if (!variant || !variant.text.trim() || !validReference(variant.reviewReference)) return abstain("LANGUAGE_REVIEW_REQUIRED");
    const evidence: GroundedExcerpt["trace"]["evidence"][number][] = [];
    if (!claim.evidence.some((link) => link.relation === "SUPPORTS")) return abstain("EVIDENCE_CHAIN_INCOMPLETE");
    for (const link of claim.evidence) {
      const record = resolve(library.evidence, link.reference);
      if (!record || record.sourceReferences.length === 0) return abstain("EVIDENCE_CHAIN_INCOMPLETE");
      const sources: LibrarySource[] = [];
      for (const sourceRef of record.sourceReferences) {
        const source = resolve(library.sources, sourceRef);
        const verifiedMs = source ? Date.parse(source.verifiedAt) : NaN;
        if (!source || source.kind !== "APPROVED_LIBRARY_SOURCE" || source.state !== "CURRENT" || !source.origin.trim()
          || !Number.isFinite(verifiedMs) || verifiedMs > nowMs) return abstain("EVIDENCE_CHAIN_INCOMPLETE");
        sources.push(source);
      }
      evidence.push({ record, relation: link.relation, sources });
    }
    excerpts.push({ claimReference: claim.reference, layer: claim.layer, classification: claim.classification, text: variant.text,
      languageReviewReference: variant.reviewReference, trace: { ruleReference: rule.reference, approvalReference: rule.approvalReference, evidence } });
  }
  return { status: "RESOLVED", context: { policyVersion: SKYNJA_KNOWLEDGE_POLICY, libraryReference: library.reference,
    purpose: request.purpose, context: request.context, language: request.language, excerpts } };
}
