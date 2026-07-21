import type { B8ReadinessSnapshot } from "../../application/b8-readiness-controller.js";
import type { B8GateId, EvidenceStatus } from "../../core/b8-readiness.js";
import { escapeHtml } from "./templates.js";

const gateLabels: Record<B8GateId, string> = {
  LEARNING_FEASIBILITY: "Læringsgjennomførbarhet",
  HUMAN_FIRST: "Menneskelig nærvær",
  CHILD_SAFETY: "Barnets trygghet",
  ACCESSIBILITY: "Tilgjengelighet",
  ADULT_WORKLOAD: "Voksenbelastning",
  CONTENT_AUDIO_KNOWLEDGE: "Innhold, lyd og kunnskap",
  PRIVACY_LEGAL_ETHICS: "Personvern, juss og etikk",
  SECURITY_OPERATIONS: "Sikkerhet og drift",
  PILOT_PROTOCOL: "Pilotprotokoll",
};

const statusLabels: Record<EvidenceStatus, string> = {
  NOT_STARTED: "Ikke startet",
  DRAFT: "Utkast",
  SYNTHETIC_PASS: "Syntetisk bestått",
  HUMAN_REVIEW_PASS: "Menneskelig review bestått",
  EXTERNAL_REVIEW_PASS: "Ekstern review bestått",
  OWNER_ACCEPTED: "Produkteier akseptert",
  BLOCKED: "Blokkert",
  NOT_APPLICABLE: "Ikke relevant",
};

function gateOptions(selected: B8GateId | "ALL"): string {
  const options: Array<readonly [string, string]> = [
    ["ALL", "Alle porter"],
    ...Object.entries(gateLabels),
  ];
  return options
    .map(
      ([value, label]) =>
        `<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`,
    )
    .join("");
}

export function renderB8ReadinessMarkup(snapshot: B8ReadinessSnapshot): string {
  const { assessment, dossier } = snapshot;
  const decisionText =
    assessment.decision === "DECISION_READY_FOR_OWNER"
      ? "Beslutningsklar for produkteier – pilot er fortsatt ikke godkjent"
      : assessment.decision === "REOPEN_REQUIRED"
        ? "Arkitektur eller port må gjenåpnes"
        : "Ikke beslutningsklar";

  const gates = assessment.gateAssessments
    .map(
      (gate) => `<li class="readiness-gate ${gate.status === "PASS" ? "gate-pass" : "gate-blocked"}">
        <strong>${escapeHtml(gateLabels[gate.gateId])}</strong>
        <span>${gate.satisfied} av ${gate.total} krav tilfredsstilt</span>
        <span class="status-pill">${gate.status === "PASS" ? "Bestått" : "Åpen"}</span>
      </li>`,
    )
    .join("");

  const requirements = snapshot.visibleRequirements
    .map(
      (requirement) => `<li class="readiness-requirement">
        <div>
          <p class="eyebrow">${escapeHtml(requirement.requirementId)} · ${escapeHtml(gateLabels[requirement.gateId])}</p>
          <h3>${escapeHtml(requirement.title)}</h3>
          <p>${escapeHtml(requirement.limitation)}</p>
        </div>
        <dl class="compact-details">
          <div><dt>Status</dt><dd>${escapeHtml(statusLabels[requirement.status])}</dd></div>
          <div><dt>Nivå</dt><dd>${escapeHtml(requirement.level)}</dd></div>
          <div><dt>Senest før</dt><dd>${escapeHtml(requirement.dueBefore)}</dd></div>
          <div><dt>Ansvar</dt><dd>${escapeHtml(requirement.ownerRole)}</dd></div>
        </dl>
      </li>`,
    )
    .join("");

  const stopRules = dossier.stopRules
    .map(
      (rule) => `<li>
        <strong>${escapeHtml(rule.stopRuleId)} · ${escapeHtml(rule.severity)}</strong>
        <span>${escapeHtml(rule.trigger)}</span>
        <span>Handling: ${escapeHtml(rule.immediateAction)}</span>
      </li>`,
    )
    .join("");

  const envelope = dossier.candidateEnvelope;

  return `<section class="readiness-page" aria-labelledby="readiness-title">
    <p class="eyebrow">WP13.4 · B8-evidens og pilotberedskap</p>
    <h2 id="readiness-title" tabindex="-1">B8 er ${assessment.ownerMayConsiderB8 ? "beslutningsklar" : "ikke beslutningsklar"}</h2>
    <p class="knowledge-lead">Denne siden kan aldri godkjenne pilot. Den viser hvilke bevis som mangler før produkteieren kan vurdere B8.</p>
    <div class="readiness-decision" role="status" aria-live="polite">
      <strong>${escapeHtml(decisionText)}</strong>
      <span>${assessment.blockersBeforeDecision.length} blokkere før beslutning</span>
      <span>Rekruttering: ikke autorisert</span>
      <span>Ekte data: ikke autorisert</span>
    </div>

    <h3>Portstatus</h3>
    <ul class="readiness-gates">${gates}</ul>

    <section aria-labelledby="candidate-envelope-title" class="readiness-envelope">
      <h3 id="candidate-envelope-title">Foreslått, ikke autorisert pilotramme</h3>
      <dl class="compact-details">
        <div><dt>Målgruppe</dt><dd>${envelope.ageBand} år</dd></div>
        <div><dt>Modus</dt><dd>Guided Dyad – lærer</dd></div>
        <div><dt>Omfang</dt><dd>${envelope.dyadCountMinimum}–${envelope.dyadCountMaximum} dyader, én økt hver</dd></div>
        <div><dt>Maks tid</dt><dd>${envelope.sessionMinutesMaximum} minutter</dd></div>
        <div><dt>Appdata</dt><dd>Kun økten; slettes ved avslutning</dd></div>
        <div><dt>Forbud</dt><dd>Ingen lydopptak, fritekst, runtime-AI eller kryssøktprofil</dd></div>
      </dl>
    </section>

    <section aria-labelledby="requirements-title">
      <div class="section-heading-row">
        <h3 id="requirements-title">Evidenskrav</h3>
        <label>
          <span>Vis port</span>
          <select data-readiness-filter>${gateOptions(snapshot.selectedGate)}</select>
        </label>
      </div>
      <ul class="readiness-requirements">${requirements}</ul>
    </section>

    <section aria-labelledby="stop-rules-title" class="stop-rules">
      <h3 id="stop-rules-title">Stoppregler</h3>
      <ul>${stopRules}</ul>
    </section>

    <p class="warning">Ingen knapp på denne siden starter pilot, rekruttering eller datainnsamling. Det krever et senere eksplisitt produkteiervedtak.</p>
  </section>`;
}

export function parseGateFilter(value: string): B8GateId | "ALL" {
  if (value === "ALL") return value;
  if (value in gateLabels) return value as B8GateId;
  return "ALL";
}
