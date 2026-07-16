import type { HumanFirstContentBundle } from "../../../core/content-contracts.js";
import { projectLegacyAudio, projectLegacyContextCard, projectLegacyKnowledge } from "../../prototype/legacy-projections.js";

export const wordProofContentNn: HumanFirstContentBundle = {
  releaseId: "release-word-proof-001", locale: "nn-NO", activityId: "activity-simple-blend-23",
  metadata: {
    contentId: "activity-simple-blend-23", revision: 1, contentType: "ACTIVITY", locale: "nn-NO", ageBand: "6-9",
    activityRole: "FIRST_VERTICAL_LEARNING_PROOF", constructRole: "BUILD_BLEND_CONFIRM_NEAR_TRANSFER",
    author: "Produkteigar", editor: "Menneskeleg redaktør", pedagogicalReviewer: "Krev ekstern fagreview før B8",
    languageReviewer: "Krev nynorskreview før B8", accessibilityReviewer: "WP13.2 maskinell og manuell proof-review",
    ageDignityReviewer: "Krev co-design før B8",
    sourceProvenance: [
      "Statped: tidlege risikomarkørar om bokstavkunnskap, fonologisk medvit og korte lydrette ord",
      "Lesesenteret: eksplisitt bruk av bokstav–lyd-samband og korte regelrette ord",
      "Solheim et al. 2018, doi:10.1016/j.learninstruc.2018.05.004", "Masterplan 6.5 / WP13.0",
    ],
    aiAssistanceDisclosure: "ASSISTED_AND_HUMAN_OWNED", humanOwnershipConfirmed: true,
    publicationDecision: "APPROVED", revisionTriggers: ["Språkfagleg review", "Co-design", "Endra konstrukt eller lyd"],
    withdrawalStatus: "ACTIVE",
  },
  messages: [
    {
      messageId: "msg-word-instruction-nn", revision: 1, audience: "CHILD", senderType: "EDITORIAL_CONTENT",
      locale: "nn-NO", ageBand: "6-9", purpose: "INSTRUCTION",
      text: "Sjå på lydane. Vel bokstavane i same rekkjefølgje.", epistemicScope: "PUBLISHED_INSTRUCTION",
      supportLevel: "NONE", humanReviewed: true, reviewerRoles: ["pedagogikk", "språk", "tilgjenge"],
      allowedVariants: [], forbiddenClaims: ["EMOTION_INFERENCE", "GENERAL_ABILITY", "RELATIONAL_CLAIM"], withdrawalStatus: "ACTIVE",
    },
    {
      messageId: "msg-word-retry-nn", revision: 1, audience: "CHILD", senderType: "EDITORIAL_CONTENT",
      locale: "nn-NO", ageBand: "6-9", purpose: "FEEDBACK",
      text: "Sjå på lydane. Prøv éin bokstav om gongen.", epistemicScope: "PUBLISHED_INSTRUCTION",
      supportLevel: "PROMPT", humanReviewed: true, reviewerRoles: ["pedagogikk", "språk"],
      allowedVariants: [], forbiddenClaims: ["CAUSE_OF_ERROR", "MOTIVATION_INFERENCE", "GENERAL_ABILITY"], withdrawalStatus: "ACTIVE",
    },
    {
      messageId: "msg-word-target-nn", revision: 1, audience: "CHILD", senderType: "EDITORIAL_CONTENT",
      locale: "nn-NO", ageBand: "6-9", purpose: "FEEDBACK",
      text: "Du brukte lydane til å byggje sol. No prøver du eit nytt ord.", epistemicScope: "OBSERVED_SESSION_EVENT",
      supportLevel: "NONE", humanReviewed: true, reviewerRoles: ["pedagogikk", "språk", "verdigheit"],
      allowedVariants: [], forbiddenClaims: ["PERSONALITY", "FUTURE_PERFORMANCE", "RELATIONAL_CLAIM"], withdrawalStatus: "ACTIVE",
    },
    {
      messageId: "msg-word-transfer-nn", revision: 1, audience: "CHILD", senderType: "EDITORIAL_CONTENT",
      locale: "nn-NO", ageBand: "6-9", purpose: "FEEDBACK",
      text: "Du brukte same måte på eit nytt ord: mus.", epistemicScope: "OBSERVED_SESSION_EVENT",
      supportLevel: "NONE", humanReviewed: true, reviewerRoles: ["pedagogikk", "språk", "verdigheit"],
      allowedVariants: [], forbiddenClaims: ["GENERAL_ABILITY", "FUTURE_PERFORMANCE", "RELATIONAL_CLAIM"], withdrawalStatus: "ACTIVE",
    },
  ],
  adultCard: {
    cardId: "adult-card-word-001-nn", revision: 1, activityId: "activity-simple-blend-23",
    triggerEvent: "HELP_REQUESTED", observedState: "Barnet bad om hjelp i denne økta.",
    uncertainty: "Systemet veit ikkje kvifor hjelpa trengst.", suggestedAction: "WAIT",
    sayExample: "Vi kan vente litt, eller ta éin lyd saman.", avoidExample: "Dette er lett.",
    waitAllowed: true, knowledgeId: "knowledge-word-support-001", contextCardId: "context-word-help-001",
    humanReviewed: true,
  },
  contextCard: projectLegacyContextCard("context-word-help-001", "nn-NO"),
  knowledge: projectLegacyKnowledge("knowledge-word-support-001", "nn-NO"),
  audio: projectLegacyAudio("audio-word-support-001", "nn-NO"),
};
