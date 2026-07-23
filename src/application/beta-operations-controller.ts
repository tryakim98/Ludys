import {
  FINDING_CLASSIFICATIONS,
  canonicalJson,
  guardAdultOnlyFindingText,
  validateOperationsKit,
  type DryRunStepId,
  type FindingClassification,
  type IdentifierGuardResult,
  type OperationsArtifact,
  type OperationsArtifactType,
  type OperationsKit,
  type OperationsLocale,
  type OperationsValidationResult,
} from "../core/beta-operations.js";

export type DryRunStatus =
  | "NOT_STARTED"
  | "ACTIVE"
  | "WAITING"
  | "PAUSED"
  | "STOPPED"
  | "DELETED"
  | "SEV0_CONTAINED";

export type DrillName = "SEV0" | "STOP" | "DELETION" | "ROLLBACK" | "WITHDRAWAL";
export type DrillResult = "NOT_RUN" | "PASS" | "FAIL";

export interface AdultOnlyFinding {
  readonly sequence: number;
  readonly classification: FindingClassification;
  readonly code: string;
  readonly note: string;
}

export interface BetaOperationsView {
  readonly kitVersion: string;
  readonly operationsReleaseId: string;
  readonly validation: OperationsValidationResult;
  readonly locale: OperationsLocale;
  readonly selectedArtifact: OperationsArtifact;
  readonly artifactRows: readonly {
    readonly artifactType: OperationsArtifactType;
    readonly title: string;
    readonly available: boolean;
  }[];
  readonly dryRunStatus: DryRunStatus;
  readonly operationalStop: boolean;
  readonly completedSteps: readonly DryRunStepId[];
  readonly findings: readonly AdultOnlyFinding[];
  readonly lastGuardResult: IdentifierGuardResult | undefined;
  readonly lastAction: string;
  readonly drillResults: Readonly<Record<DrillName, DrillResult>>;
  readonly deletedRecordCount: number;
  readonly noResurrectionVerified: boolean;
  readonly exportPreview: string;
  readonly authorization: OperationsKit["authorization"];
  readonly forbiddenMetrics: OperationsKit["forbiddenMetrics"];
  readonly dryRunSteps: OperationsKit["dryRunSteps"];
  readonly releaseComponents: OperationsKit["releaseComponents"];
  readonly audioState: "STOPPED";
  readonly pendingUiAction: false | "HELP_REQUESTED";
}

function initialDrills(): Record<DrillName, DrillResult> {
  return { SEV0: "NOT_RUN", STOP: "NOT_RUN", DELETION: "NOT_RUN", ROLLBACK: "NOT_RUN", WITHDRAWAL: "NOT_RUN" };
}

export class BetaOperationsController {
  readonly #validation: OperationsValidationResult;
  #locale: OperationsLocale = "nb";
  #selectedArtifactType: OperationsArtifactType = "TEACHER_GUIDE";
  #dryRunStatus: DryRunStatus = "NOT_STARTED";
  #operationalStop = false;
  #completedSteps = new Set<DryRunStepId>();
  #findings: AdultOnlyFinding[] = [];
  #nextFindingSequence = 1;
  #lastGuardResult: IdentifierGuardResult | undefined;
  #lastAction = "OPERATIONS_KIT_READY";
  #drills = initialDrills();
  #deletedRecordCount = 0;
  #noResurrectionVerified = false;
  #exportPreview = "";
  #withdrawnArtifacts = new Set<OperationsArtifactType>();
  #pendingUiAction: false | "HELP_REQUESTED" = false;

  public constructor(private readonly kit: OperationsKit) {
    this.#validation = validateOperationsKit(kit);
    if (!this.#validation.valid) throw new Error(`invalid operations kit: ${this.#validation.errors.join("; ")}`);
  }

  public setLocale(locale: OperationsLocale): void {
    if (!this.kit.locales.includes(locale)) throw new Error(`MISSING_LOCALE_${locale.toUpperCase()}`);
    const variant = this.kit.artifacts.find((artifact) => artifact.artifactType === this.#selectedArtifactType && artifact.locale === locale);
    if (variant === undefined) throw new Error(`MISSING_${locale.toUpperCase()}_${this.#selectedArtifactType}`);
    this.#locale = locale;
    this.#lastAction = `LOCALE_${locale.toUpperCase()}`;
    this.completeStep("SELECT_LOCALE");
  }

  public selectArtifact(artifactType: OperationsArtifactType): void {
    if (this.#withdrawnArtifacts.has(artifactType)) throw new Error("WITHDRAWN_ARTIFACT_BLOCKED");
    const variant = this.kit.artifacts.find((artifact) => artifact.artifactType === artifactType && artifact.locale === this.#locale);
    if (variant === undefined) throw new Error(`MISSING_${this.#locale.toUpperCase()}_${artifactType}`);
    this.#selectedArtifactType = artifactType;
    this.#lastAction = `ARTIFACT_${artifactType}`;
    if (artifactType === "FIVE_MINUTE_ONBOARDING") this.completeStep("OPEN_ONBOARDING");
    if (artifactType === "PRE_SESSION_CHECKLIST") this.completeStep("COMPLETE_PRE_SESSION_CHECKLIST");
    if (artifactType === "ROLE_ALLOCATION") this.completeStep("ALLOCATE_SYNTHETIC_ROLES");
  }

  public completeStep(stepId: DryRunStepId): void {
    if (!this.kit.dryRunSteps.some((step) => step.stepId === stepId)) throw new Error("UNKNOWN_DRY_RUN_STEP");
    this.#completedSteps.add(stepId);
  }

  public startNewDryRun(): void {
    this.#dryRunStatus = "ACTIVE";
    this.#operationalStop = false;
    this.#pendingUiAction = false;
    this.#noResurrectionVerified = false;
    this.#exportPreview = "";
    this.#lastAction = "NEW_EXPLICIT_ADULT_ONLY_DRY_RUN";
    this.completeStep("READ_BOUNDARY");
    this.completeStep("START_SYNTHETIC_SESSION");
  }

  public wait(): void {
    this.requireLiveDryRun();
    this.#dryRunStatus = "WAITING";
    this.#pendingUiAction = false;
    this.#lastAction = "WAIT_FIRST_CLASS";
    this.completeStep("USE_WAIT");
  }

  public requestHelp(): void {
    this.requireLiveDryRun();
    this.#pendingUiAction = "HELP_REQUESTED";
    this.#lastAction = "ADULT_HELP_REQUESTED";
    this.completeStep("USE_HELP");
  }

  public pause(): void {
    this.requireLiveDryRun();
    this.#dryRunStatus = "PAUSED";
    this.#lastAction = "DRY_RUN_PAUSED";
    this.completeStep("USE_PAUSE");
  }

  public resume(): void {
    if (!(["WAITING", "PAUSED"] as DryRunStatus[]).includes(this.#dryRunStatus)) throw new Error("RESUME_REQUIRES_WAIT_OR_PAUSE");
    this.#dryRunStatus = "ACTIVE";
    this.#lastAction = "DRY_RUN_RESUMED";
  }

  public stop(): void {
    if (this.#dryRunStatus === "DELETED") return;
    this.#dryRunStatus = "STOPPED";
    this.#pendingUiAction = false;
    this.#lastAction = "STOP_DOMINANT";
    this.#drills.STOP = "PASS";
    this.completeStep("USE_STOP");
  }

  public runSev0Drill(): void {
    this.#dryRunStatus = "SEV0_CONTAINED";
    this.#operationalStop = true;
    this.#pendingUiAction = false;
    this.#findings = [];
    this.#drills.SEV0 = "PASS";
    this.#lastAction = "SEV0_CONTAINED_MINIMAL_TECHNICAL_EVIDENCE_ONLY";
    this.completeStep("TRIGGER_TECHNICAL_ERROR");
    this.completeStep("FOLLOW_INCIDENT_PROCEDURE");
  }

  public addFinding(classification: FindingClassification, code: string, note: string): IdentifierGuardResult {
    this.requireLiveDryRun();
    if (!(FINDING_CLASSIFICATIONS as readonly string[]).includes(classification)) throw new Error("INVALID_FINDING_CLASSIFICATION");
    if (!/^[A-Z][A-Z0-9_-]{1,31}$/.test(code)) throw new Error("INVALID_CONTROLLED_FINDING_CODE");
    const guard = guardAdultOnlyFindingText(note);
    this.#lastGuardResult = guard;
    if (!guard.accepted) {
      this.#lastAction = "FINDING_REJECTED_BEFORE_STORAGE";
      return guard;
    }
    this.#findings.push({ sequence: this.#nextFindingSequence, classification, code, note: guard.normalized });
    this.#nextFindingSequence += 1;
    this.#lastAction = "LOCAL_ADULT_ONLY_FINDING_RECORDED";
    if (classification === "ACCESSIBILITY") this.completeStep("RECORD_ACCESSIBILITY_FINDING");
    else if (classification === "CONTENT_REVIEW") this.completeStep("RECORD_CONTENT_REVIEW_FINDING");
    else this.completeStep("RECORD_TECHNICAL_OR_ADULT_FINDING");
    return guard;
  }

  public deleteDryRunRecords(): void {
    this.#deletedRecordCount += this.#findings.length;
    this.#findings = [];
    this.#exportPreview = "";
    this.#lastAction = "LOCAL_DRY_RUN_RECORDS_DELETED";
    this.completeStep("DELETE_DRY_RUN_RECORDS");
  }

  public deleteSessionState(): void {
    this.#deletedRecordCount += this.#findings.length;
    this.#findings = [];
    this.#dryRunStatus = "DELETED";
    this.#pendingUiAction = false;
    this.#exportPreview = "";
    this.#lastAction = "SESSION_DELETED_TOMBSTONE_RETAINED";
    this.#drills.DELETION = "PASS";
    this.completeStep("DELETE_LOCAL_STATE");
  }

  public reconnect(): boolean {
    if ((["DELETED", "STOPPED", "SEV0_CONTAINED"] as DryRunStatus[]).includes(this.#dryRunStatus)) {
      this.#noResurrectionVerified = true;
      this.#lastAction = "NO_RESURRECTION_VERIFIED";
      this.completeStep("VERIFY_NO_RESURRECTION");
      this.completeStep("VERIFY_RECORDS_STAY_DELETED");
      return false;
    }
    this.#lastAction = "SAME_LOCAL_DRY_RUN_RETAINED";
    return true;
  }

  public recordRollbackDrill(accepted: boolean, activeOperationsRevision: string): void {
    const passed = accepted && activeOperationsRevision !== this.kit.operationsReleaseId;
    this.#drills.ROLLBACK = passed ? "PASS" : "FAIL";
    this.#lastAction = passed ? "OPERATIONS_ROLLBACK_VERIFIED" : "OPERATIONS_ROLLBACK_FAILED";
    this.completeStep("RUN_ROLLBACK");
  }

  public runWithdrawalDrill(artifactType: OperationsArtifactType = "KNOWN_ISSUES"): void {
    this.#withdrawnArtifacts.add(artifactType);
    if (this.#selectedArtifactType === artifactType) this.#selectedArtifactType = "TEACHER_GUIDE";
    this.#drills.WITHDRAWAL = "PASS";
    this.#lastAction = "WITHDRAWN_OPERATIONS_ARTIFACT_BLOCKED";
    this.completeStep("RUN_CONTENT_WITHDRAWAL");
  }

  public exportLocalReviewPackage(): string {
    const payload = {
      schemaVersion: "wp13.11-local-review-export-v1",
      operationsReleaseId: this.kit.operationsReleaseId,
      releaseComponents: this.kit.releaseComponents,
      selectedArtifacts: [this.selectedArtifact.artifactId],
      findings: this.#findings,
      drillResults: this.#drills,
      authorization: this.kit.authorization,
      integrity: {
        semanticArtifactCount: this.#validation.semanticArtifactCount,
        languageArtifactCount: this.#validation.languageArtifactCount,
        externalReceipts: 0,
      },
      dataBoundary: {
        personalData: false,
        studentData: false,
        stableIdentity: false,
        crossSessionLinkage: false,
        externalTransport: false,
      },
    };
    this.#exportPreview = canonicalJson(payload);
    this.#lastAction = "LOCAL_DETERMINISTIC_EXPORT_CREATED";
    this.completeStep("EXPORT_LOCAL_REVIEW_PACKAGE");
    if (this.#deletedRecordCount > 0 && this.#findings.length === 0) this.completeStep("VERIFY_NEW_EXPORT_EXCLUDES_DELETED_RECORDS");
    return this.#exportPreview;
  }

  private requireLiveDryRun(): void {
    if (!(["ACTIVE", "WAITING", "PAUSED"] as DryRunStatus[]).includes(this.#dryRunStatus)) throw new Error("EXPLICIT_ACTIVE_DRY_RUN_REQUIRED");
    if (this.#operationalStop) throw new Error("OPERATIONAL_STOP_ACTIVE");
  }

  private get selectedArtifact(): OperationsArtifact {
    const artifact = this.kit.artifacts.find((item) => item.artifactType === this.#selectedArtifactType && item.locale === this.#locale);
    if (artifact === undefined) throw new Error("SELECTED_ARTIFACT_LOCALE_MISSING");
    return artifact;
  }

  public get view(): BetaOperationsView {
    return {
      kitVersion: this.kit.version,
      operationsReleaseId: this.kit.operationsReleaseId,
      validation: this.#validation,
      locale: this.#locale,
      selectedArtifact: this.selectedArtifact,
      artifactRows: this.kit.artifacts
        .filter((artifact) => artifact.locale === this.#locale)
        .map((artifact) => ({
          artifactType: artifact.artifactType,
          title: artifact.title,
          available: !this.#withdrawnArtifacts.has(artifact.artifactType),
        })),
      dryRunStatus: this.#dryRunStatus,
      operationalStop: this.#operationalStop,
      completedSteps: [...this.#completedSteps],
      findings: [...this.#findings],
      lastGuardResult: this.#lastGuardResult,
      lastAction: this.#lastAction,
      drillResults: { ...this.#drills },
      deletedRecordCount: this.#deletedRecordCount,
      noResurrectionVerified: this.#noResurrectionVerified,
      exportPreview: this.#exportPreview,
      authorization: this.kit.authorization,
      forbiddenMetrics: this.kit.forbiddenMetrics,
      dryRunSteps: this.kit.dryRunSteps,
      releaseComponents: this.kit.releaseComponents,
      audioState: "STOPPED",
      pendingUiAction: this.#pendingUiAction,
    };
  }
}
