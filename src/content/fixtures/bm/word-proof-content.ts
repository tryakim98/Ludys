import type { HumanFirstContentBundle } from "../../../core/content-contracts.js";
import { projectLegacyAudio, projectLegacyContextCard, projectLegacyKnowledge } from "../../prototype/legacy-projections.js";

export const wordProofContentNb: HumanFirstContentBundle = {
  releaseId: "release-word-proof-001",
  locale: "nb-NO",
  activityId: "activity-simple-blend-23",
  metadata: {
    contentId: "activity-simple-blend-23", revision: 1, contentType: "ACTIVITY", locale: "nb-NO", ageBand: "6-9",
    activityRole: "FIRST_VERTICAL_LEARNING_PROOF", constructRole: "BUILD_BLEND_CONFIRM_NEAR_TRANSFER",
    author: "Produkteier", editor: "Menneskelig redaktør", pedagogicalReviewer: "Krever ekstern fagreview før B8",
    languageReviewer: "Krever bokmålsreview før B8", accessibilityReviewer: "WP13.2 maskinell og manuell proof-review",
    ageDignityReviewer: "Krever co-design før B8",
    sourceProvenance: [
      "Statped: tidlige risikomarkører om bokstavkunnskap, fonologisk bevissthet og korte lydrette ord",
      "Lesesenteret: eksplisitt bruk av bokstav–lyd-forbindelser og korte regelrette ord",
      "Solheim et al. 2018, doi:10.1016/j.learninstruc.2018.05.004",
      "Masterplan 6.5 / WP13.0",
    ],
    aiAssistanceDisclosure: "ASSISTED_AND_HUMAN_OWNED", humanOwnershipConfirmed: true,
    publicationDecision: "APPROVED", revisionTriggers: ["Språkfaglig review", "Co-design", "Endret konstrukt eller lyd"],
    withdrawalStatus: "ACTIVE",
  },
  messages: [
    {
      messageId: "msg-word-instruction-nb", revision: 1, audience: "CHILD", senderType: "EDITORIAL_CONTENT",
      locale: "nb-NO", ageBand: "6-9", purpose: "INSTRUCTION",
      text: "Se på lydene. Velg bokstavene i samme rekkefølge.", epistemicScope: "PUBLISHED_INSTRUCTION",
      supportLevel: "NONE", humanReviewed: true, reviewerRoles: ["pedagogikk", "språk", "tilgjengelighet"],
      allowedVariants: [], forbiddenClaims: ["EMOTION_INFERENCE", "GENERAL_ABILITY", "RELATIONAL_CLAIM"], withdrawalStatus: "ACTIVE",
    },
    {
      messageId: "msg-word-retry-nb", revision: 1, audience: "CHILD", senderType: "EDITORIAL_CONTENT",
      locale: "nb-NO", ageBand: "6-9", purpose: "FEEDBACK",
      text: "Se på lydene. Prøv én bokstav om gangen.", epistemicScope: "PUBLISHED_INSTRUCTION",
      supportLevel: "PROMPT", humanReviewed: true, reviewerRoles: ["pedagogikk", "språk"],
      allowedVariants: [], forbiddenClaims: ["CAUSE_OF_ERROR", "MOTIVATION_INFERENCE", "GENERAL_ABILITY"], withdrawalStatus: "ACTIVE",
    },
    {
      messageId: "msg-word-target-nb", revision: 1, audience: "CHILD", senderType: "EDITORIAL_CONTENT",
      locale: "nb-NO", ageBand: "6-9", purpose: "FEEDBACK",
      text: "Du brukte lydene til å bygge sol. Nå prøver du et nytt ord.", epistemicScope: "OBSERVED_SESSION_EVENT",
      supportLevel: "NONE", humanReviewed: true, reviewerRoles: ["pedagogikk", "språk", "verdighet"],
      allowedVariants: [], forbiddenClaims: ["PERSONALITY", "FUTURE_PERFORMANCE", "RELATIONAL_CLAIM"], withdrawalStatus: "ACTIVE",
    },
    {
      messageId: "msg-word-transfer-nb", revision: 1, audience: "CHILD", senderType: "EDITORIAL_CONTENT",
      locale: "nb-NO", ageBand: "6-9", purpose: "FEEDBACK",
      text: "Du brukte samme måte på et nytt ord: mus.", epistemicScope: "OBSERVED_SESSION_EVENT",
      supportLevel: "NONE", humanReviewed: true, reviewerRoles: ["pedagogikk", "språk", "verdighet"],
      allowedVariants: [], forbiddenClaims: ["GENERAL_ABILITY", "FUTURE_PERFORMANCE", "RELATIONAL_CLAIM"], withdrawalStatus: "ACTIVE",
    },
  ],
  adultCard: {
    cardId: "adult-card-word-001-nb", revision: 1, activityId: "activity-simple-blend-23",
    triggerEvent: "HELP_REQUESTED", observedState: "Barnet ba om hjelp i denne økten.",
    uncertainty: "Systemet vet ikke hvorfor hjelpen trengs.", suggestedAction: "WAIT",
    sayExample: "Vi kan vente litt, eller ta én lyd sammen.", avoidExample: "Dette er lett.",
    waitAllowed: true, knowledgeId: "knowledge-word-support-001", contextCardId: "context-word-help-001",
    humanReviewed: true,
  },
  contextCard: projectLegacyContextCard("context-word-help-001", "nb-NO"),
  knowledge: projectLegacyKnowledge("knowledge-word-support-001", "nb-NO"),
  audio: projectLegacyAudio("audio-word-support-001", "nb-NO"),
};
