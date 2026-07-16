import {
  assessB8Readiness,
  type B8GateId,
  type B8ReadinessAssessment,
  type B8ReadinessDossier,
  type EvidenceRequirement,
} from "../core/b8-readiness.js";

export interface B8ReadinessSnapshot {
  readonly assessment: B8ReadinessAssessment;
  readonly dossier: B8ReadinessDossier;
  readonly selectedGate: B8GateId | "ALL";
  readonly visibleRequirements: readonly EvidenceRequirement[];
}

export class B8ReadinessController {
  #selectedGate: B8GateId | "ALL" = "ALL";

  public constructor(private readonly dossier: B8ReadinessDossier) {}

  public selectGate(gateId: B8GateId | "ALL"): void {
    this.#selectedGate = gateId;
  }

  public get snapshot(): B8ReadinessSnapshot {
    const visibleRequirements =
      this.#selectedGate === "ALL"
        ? this.dossier.requirements
        : this.dossier.requirements.filter(
            (requirement) => requirement.gateId === this.#selectedGate,
          );
    return {
      assessment: assessB8Readiness(this.dossier),
      dossier: this.dossier,
      selectedGate: this.#selectedGate,
      visibleRequirements,
    };
  }
}
