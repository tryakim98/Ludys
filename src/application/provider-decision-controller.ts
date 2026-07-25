import {
  canonicalDecisionJson,
  validateProviderDecisionPackage,
  type DecisionLocale,
  type ProviderDecisionPackage,
  type ProviderOptionId,
  type ProviderDecisionValidation,
} from "../core/provider-decision.js";

export interface ProviderDecisionView {
  readonly locale: DecisionLocale;
  readonly bundle: ProviderDecisionPackage["localeBundles"][number];
  readonly packageVersion: string;
  readonly providerDecisionReleaseId: string;
  readonly validation: ProviderDecisionValidation;
  readonly authorization: ProviderDecisionPackage["authorization"];
  readonly providerOptions: ProviderDecisionPackage["providerOptions"];
  readonly selectedOption: ProviderDecisionPackage["providerOptions"][number];
  readonly recommendedOptionId: ProviderOptionId;
  readonly recommendedRegion: string;
  readonly regionLockNotExecuted: true;
  readonly regionAnalysis: ProviderDecisionPackage["regionAnalysis"];
  readonly capabilityOptions: ProviderDecisionPackage["capabilityOptions"];
  readonly recommendedCapability: ProviderDecisionPackage["recommendedCapability"];
  readonly dataflow: ProviderDecisionPackage["dataflow"];
  readonly trustBoundaries: ProviderDecisionPackage["trustBoundaries"];
  readonly allowedDataClasses: ProviderDecisionPackage["dataClasses"];
  readonly retentionDeletion: ProviderDecisionPackage["retentionDeletion"];
  readonly loggingObservability: ProviderDecisionPackage["loggingObservability"];
  readonly iamAndSecrets: ProviderDecisionPackage["iamAndSecrets"];
  readonly costModel: ProviderDecisionPackage["costModel"];
  readonly threats: ProviderDecisionPackage["threats"];
  readonly dataProcessingRequirements: ProviderDecisionPackage["dataProcessingRequirements"];
  readonly migrationExit: ProviderDecisionPackage["migrationExit"];
  readonly noGo: ProviderDecisionPackage["noGo"];
  readonly officialSources: ProviderDecisionPackage["officialSources"];
  readonly ownerDecisionRecord: ProviderDecisionPackage["ownerDecisionRecord"];
  readonly ownerTemplateBlank: true;
  readonly dossierPreview: string;
  readonly ownerTemplatePreview: string;
}

export class ProviderDecisionController {
  readonly #validation: ProviderDecisionValidation;
  #locale: DecisionLocale = "nb";
  #selectedOptionId: ProviderOptionId = "FIREBASE_CAPABILITY";
  #dossierPreview = "";
  #ownerTemplatePreview = "";

  public constructor(public readonly decision: ProviderDecisionPackage) {
    this.#validation = validateProviderDecisionPackage(decision);
    if (!this.#validation.valid) throw new Error(`invalid provider decision package: ${this.#validation.errors.join("; ")}`);
  }

  public setLocale(locale: DecisionLocale): ProviderDecisionView {
    if (!this.decision.locales.includes(locale)) throw new Error(`MISSING_LOCALE:${locale}`);
    this.#locale = locale;
    return this.view;
  }

  public selectOption(optionId: ProviderOptionId): ProviderDecisionView {
    if (!this.decision.providerOptions.some((option) => option.optionId === optionId)) throw new Error(`UNKNOWN_OPTION:${optionId}`);
    this.#selectedOptionId = optionId;
    return this.view;
  }

  public exportDecisionDossier(): string {
    const dossier = {
      schemaVersion: this.decision.schemaVersion,
      providerDecisionReleaseId: this.decision.providerDecisionReleaseId,
      packageVersion: this.decision.packageVersion,
      packageStatus: this.decision.authorization.packageStatus,
      ownerDecision: this.decision.authorization.ownerDecision,
      providerActivation: this.decision.authorization.providerActivation,
      cloudResources: this.decision.authorization.cloudResources,
      recommendationAcceptedByOwner: true,
      recommendedOptionId: this.decision.recommendedOptionId,
      recommendedRegion: this.decision.recommendedRegion,
      recommendedCapabilityOptionId: this.decision.recommendedCapabilityOptionId,
      providerOptions: this.decision.providerOptions,
      regionAnalysis: this.decision.regionAnalysis,
      capabilityOptions: this.decision.capabilityOptions,
      dataflow: this.decision.dataflow,
      trustBoundaries: this.decision.trustBoundaries,
      dataClasses: this.decision.dataClasses,
      retentionDeletion: this.decision.retentionDeletion,
      loggingObservability: this.decision.loggingObservability,
      iamAndSecrets: this.decision.iamAndSecrets,
      costModel: this.decision.costModel,
      threats: this.decision.threats,
      dataProcessingRequirements: this.decision.dataProcessingRequirements,
      migrationExit: this.decision.migrationExit,
      noGo: this.decision.noGo,
      ownerDecisionRecord: this.decision.ownerDecisionRecord,
      officialSources: this.decision.officialSources,
      authorization: this.decision.authorization,
    };
    this.#dossierPreview = canonicalDecisionJson(dossier);
    return this.#dossierPreview;
  }

  public exportBlankOwnerTemplate(): string {
    const lines = [
      "# WP13.12A – blank produkteierbeslutning",
      "",
      "> STATUS: PENDING_OWNER_ACTION",
      "> PROVIDER_ACTIVATION: BLOCKED",
      "> CLOUD_RESOURCES: 0",
      "",
      "| Required field | Owner entry |",
      "|---|---|",
      ...this.decision.ownerDecisionTemplate.requiredFields.map((field) => `| ${field} | |`),
      "",
      "No owner name, signature, confirmation, option, region, cost limit or date has been fabricated.",
      "",
    ];
    this.#ownerTemplatePreview = lines.join("\n");
    return this.#ownerTemplatePreview;
  }

  public get view(): ProviderDecisionView {
    const bundle = this.decision.localeBundles.find((item) => item.locale === this.#locale);
    const selectedOption = this.decision.providerOptions.find((option) => option.optionId === this.#selectedOptionId);
    if (bundle === undefined) throw new Error(`MISSING_LOCALE:${this.#locale}`);
    if (selectedOption === undefined) throw new Error(`UNKNOWN_OPTION:${this.#selectedOptionId}`);
    return {
      locale: this.#locale,
      bundle,
      packageVersion: this.decision.packageVersion,
      providerDecisionReleaseId: this.decision.providerDecisionReleaseId,
      validation: this.#validation,
      authorization: this.decision.authorization,
      providerOptions: this.decision.providerOptions,
      selectedOption,
      recommendedOptionId: this.decision.recommendedOptionId,
      recommendedRegion: this.decision.recommendedRegion,
      regionLockNotExecuted: this.decision.regionLockNotExecuted,
      regionAnalysis: this.decision.regionAnalysis,
      capabilityOptions: this.decision.capabilityOptions,
      recommendedCapability: this.decision.recommendedCapability,
      dataflow: this.decision.dataflow,
      trustBoundaries: this.decision.trustBoundaries,
      allowedDataClasses: this.decision.dataClasses,
      retentionDeletion: this.decision.retentionDeletion,
      loggingObservability: this.decision.loggingObservability,
      iamAndSecrets: this.decision.iamAndSecrets,
      costModel: this.decision.costModel,
      threats: this.decision.threats,
      dataProcessingRequirements: this.decision.dataProcessingRequirements,
      migrationExit: this.decision.migrationExit,
      noGo: this.decision.noGo,
      officialSources: this.decision.officialSources,
      ownerDecisionRecord: this.decision.ownerDecisionRecord,
      ownerTemplateBlank: this.decision.ownerDecisionTemplate.blank,
      dossierPreview: this.#dossierPreview,
      ownerTemplatePreview: this.#ownerTemplatePreview,
    };
  }
}
