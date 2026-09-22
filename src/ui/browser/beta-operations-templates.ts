import type { BetaOperationsView } from "../../application/beta-operations-controller.js";

const uiCopy = {
  humanReviewed: true,
  reviewSource: "WP13_11_SCOPE_2026-07-22",
  nb: {
    skip: "Hopp til hovedinnholdet", eyebrow: "WP13.11 · adult-only syntetisk dry-run", title: "Betaoperasjon",
    back: "Tilbake til appreisen", language: "Målform",
    boundary: "Kun for voksne i en lokal syntetisk dry-run. Ingen barn, ekte persondata, rekruttering, provider eller produksjon.",
    integrity: "Integritet", artifacts: "Artefakter", selectedArtifact: "Valgt artefakt", audience: "Målgruppe",
    review: "Reviewstatus", allowed: "Tillatt bruk", prohibited: "Forbudt bruk", dryRun: "Adult-only dry-run – 23 steg",
    start: "Start ny eksplisitt dry-run", wait: "WAIT", help: "Be om voksenhjelp", pause: "Pause", resume: "Fortsett", stop: "STOP",
    findings: "Lokale voksen-only funn", classification: "Klassifisering", code: "Kontrollert kode",
    note: "Kort beskrivelse uten navn, skole, kontaktdata, URL eller lange nummer", record: "Registrer lokalt funn",
    deleteRecords: "Slett lokale dry-run-records", drills: "Operative driller", sev0: "Kjør SEV0-containment",
    stopDrill: "Kjør STOP-drill", deletion: "Kjør deletion/no-resurrection", reconnect: "Kontroller no-resurrection",
    rollback: "Kjør operations-rollback", withdrawal: "Kjør content-withdrawal", export: "Lokal deterministisk eksport",
    createExport: "Opprett lokal reviewpakke", forbiddenMetrics: "Forbudte mål – teknisk blokkert",
    limitations: "Åpne menneskelige gap", participantDraft: "UTKAST – IKKE AUTORISERT FOR ELEVBRUK", completed: "fullført", pending: "åpent",
    externalTransport: "Ekstern transport", pendingUi: "ventende grensesnitthandling",
    identifierGuard: "Identifierguard er en avgrenset teknisk kontroll, ikke en garanti for perfekt PII-deteksjon. Avvist tekst lagres ikke og sendes ikke.",
    noResurrection: "Ingen gjenoppliving", deletedRecords: "Slettede records", saveExport: "Lagre lokal JSON-fil",
    openGaps: "BM- og NN-review, juridisk og etisk review, skoleeierbeslutning, manuell AT-review og ekstern evidens står åpne. Flaten stopper før elevbruk.",
  },
  nn: {
    skip: "Hopp til hovudinnhaldet", eyebrow: "WP13.11 · syntetisk dry-run berre for vaksne", title: "Betaoperasjon",
    back: "Tilbake til appreisa", language: "Målform",
    boundary: "Berre for vaksne i ein lokal syntetisk dry-run. Ingen barn, ekte persondata, rekruttering, provider eller produksjon.",
    integrity: "Integritet", artifacts: "Artefaktar", selectedArtifact: "Vald artefakt", audience: "Målgruppe",
    review: "Reviewstatus", allowed: "Tillaten bruk", prohibited: "Forboden bruk", dryRun: "Dry-run berre for vaksne – 23 steg",
    start: "Start ny eksplisitt dry-run", wait: "WAIT", help: "Be om vaksenhjelp", pause: "Pause", resume: "Hald fram", stop: "STOPP",
    findings: "Lokale funn berre om vaksenoperasjon", classification: "Klassifisering", code: "Kontrollert kode",
    note: "Kort skildring utan namn, skule, kontaktdata, URL eller lange nummer", record: "Registrer lokalt funn",
    deleteRecords: "Slett lokale dry-run-records", drills: "Operative drillar", sev0: "Køyr SEV0-containment",
    stopDrill: "Køyr STOPP-drill", deletion: "Køyr sletting/inga gjenoppliving", reconnect: "Kontroller inga gjenoppliving",
    rollback: "Køyr operations-rollback", withdrawal: "Køyr content-withdrawal", export: "Lokal deterministisk eksport",
    createExport: "Opprett lokal reviewpakke", forbiddenMetrics: "Forbodne mål – teknisk blokkerte",
    limitations: "Opne menneskelege gap", participantDraft: "UTKAST – IKKJE AUTORISERT FOR ELEVBRUK", completed: "fullført", pending: "ope",
    externalTransport: "Ekstern transport", pendingUi: "ventande grensesnitthandling",
    identifierGuard: "Identifierguard er ein avgrensa teknisk kontroll, ikkje ein garanti for perfekt PII-deteksjon. Avvist tekst blir ikkje lagra eller send.",
    noResurrection: "Inga gjenoppliving", deletedRecords: "Sletta records", saveExport: "Lagre lokal JSON-fil",
    openGaps: "BM- og NN-review, juridisk og etisk review, skuleeigaravgjerd, manuell AT-review og ekstern evidens står opne. Flata stoppar før elevbruk.",
  },
} as const;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function list(values: readonly string[]): string {
  return `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

function action(name: string, label: string, className = ""): string {
  return `<button type="button" data-operations-action="${escapeHtml(name)}" class="${escapeHtml(className)}">${escapeHtml(label)}</button>`;
}

export function renderBetaOperations(view: BetaOperationsView): string {
  const copy = uiCopy[view.locale];
  const artifact = view.selectedArtifact;
  const participantDraft = artifact.authorizationStatus === "NOT_AUTHORIZED_FOR_STUDENT_USE";
  const completed = new Set(view.completedSteps);
  const guardMessages = view.lastGuardResult === undefined
    ? ""
    : [...view.lastGuardResult.errors, ...view.lastGuardResult.warnings].map((value) => `<li>${escapeHtml(value)}</li>`).join("");
  return `<a class="skip-link" href="#operations-main">${escapeHtml(copy.skip)}</a>
    <header class="site-header operations-header">
      <div><p class="eyebrow">${escapeHtml(copy.eyebrow)}</p><h1>${escapeHtml(copy.title)}</h1></div>
      <div class="header-actions">${action("close", copy.back)}<label class="locale-control"><span>${escapeHtml(copy.language)}</span><select id="operations-locale"><option value="nb" ${view.locale === "nb" ? "selected" : ""}>Bokmål</option><option value="nn" ${view.locale === "nn" ? "selected" : ""}>Nynorsk</option></select></label></div>
    </header>
    <div class="classification-banner operations-boundary">${escapeHtml(copy.boundary)}</div>
    <main id="operations-main" class="operations-page" tabindex="-1">
      <section class="operations-integrity" aria-labelledby="operations-integrity-title">
        <h2 id="operations-integrity-title" tabindex="-1">${escapeHtml(copy.integrity)}</h2>
        <div class="status-cluster" aria-label="Operations status">
          <span>${escapeHtml(view.operationsReleaseId)}</span><span>27/27</span><span>BM 27/27</span><span>NN 27/27</span>
          <span>Receipts ${view.authorization.externalReceipts}</span><span>B8 ${escapeHtml(view.authorization.b8)}</span>
          <span>STUDENT_BETA NOT_AUTHORIZED</span><span>PRODUCTION NOT_AUTHORIZED</span>
        </div>
        <dl class="operations-facts">
          <div><dt>Kit</dt><dd>${escapeHtml(view.kitVersion)}</dd></div><div><dt>Validator</dt><dd>${escapeHtml(view.validation.readiness)}</dd></div>
          <div><dt>Dry-run</dt><dd>${escapeHtml(view.dryRunStatus)}</dd></div><div><dt>Audio</dt><dd>${escapeHtml(view.audioState)}</dd></div>
          <div><dt>${escapeHtml(copy.externalTransport)}</dt><dd>NONE</dd></div>
        </dl>
      </section>

      <section aria-labelledby="operations-artifacts-title">
        <h2 id="operations-artifacts-title">${escapeHtml(copy.artifacts)}</h2>
        <label class="operations-field"><span>${escapeHtml(copy.selectedArtifact)}</span><select id="operations-artifact-select">${view.artifactRows.map((row) => `<option value="${row.artifactType}" ${row.artifactType === artifact.artifactType ? "selected" : ""} ${row.available ? "" : "disabled"}>${escapeHtml(row.title)}${row.available ? "" : " · WITHDRAWN"}</option>`).join("")}</select></label>
        <article class="operations-artifact" data-artifact-type="${artifact.artifactType}" data-artifact-locale="${artifact.locale}">
          <p class="draft-status">${escapeHtml(artifact.status)} · ${escapeHtml(artifact.authorizationStatus)}</p>
          ${participantDraft ? `<p class="operations-terminal" role="alert">${escapeHtml(copy.participantDraft)}</p>` : ""}
          <h3>${escapeHtml(artifact.title)}</h3><p>${escapeHtml(artifact.purpose)}</p>
          <dl class="operations-facts"><div><dt>${escapeHtml(copy.audience)}</dt><dd>${escapeHtml(artifact.audience.join(" · "))}</dd></div><div><dt>${escapeHtml(copy.review)}</dt><dd>${escapeHtml(artifact.reviewStatus)}</dd></div></dl>
          <div class="operations-use-grid"><div><h4>${escapeHtml(copy.allowed)}</h4>${list(artifact.allowedUse)}</div><div><h4>${escapeHtml(copy.prohibited)}</h4>${list(artifact.prohibitedUse)}</div></div>
          ${artifact.contentSections.map((section) => `<section><h4>${escapeHtml(section.heading)}</h4>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("")}
        </article>
      </section>

      <section aria-labelledby="operations-dry-run-title">
        <h2 id="operations-dry-run-title">${escapeHtml(copy.dryRun)}</h2>
        <ol class="dry-run-steps">${view.dryRunSteps.map((step) => `<li data-dry-run-step="${step.stepId}" data-complete="${String(completed.has(step.stepId))}"><span>${escapeHtml(step[view.locale])}</span><strong>${escapeHtml(completed.has(step.stepId) ? copy.completed : copy.pending)}</strong></li>`).join("")}</ol>
        <div class="button-row operations-controls">${action("start", copy.start, "primary-action")}${action("wait", copy.wait)}${action("help", copy.help)}${action("pause", copy.pause)}${action("resume", copy.resume)}${action("stop", copy.stop, "danger-action")}</div>
        <p role="status">${escapeHtml(view.lastAction)} · ${escapeHtml(copy.pendingUi)}: ${escapeHtml(String(view.pendingUiAction))}</p>
      </section>

      <section aria-labelledby="operations-findings-title">
        <h2 id="operations-findings-title">${escapeHtml(copy.findings)}</h2>
        <p>${escapeHtml(copy.identifierGuard)}</p>
        <div class="operations-form-grid">
          <label class="operations-field"><span>${escapeHtml(copy.classification)}</span><select id="operations-finding-classification"><option>FEASIBILITY</option><option>TECHNICAL_OPERATION</option><option>ACCESSIBILITY</option><option>CONTENT_REVIEW</option><option>POTENTIAL_HARM</option><option>LEARNING_CLAIM_NOT_MEASURED</option></select></label>
          <label class="operations-field"><span>${escapeHtml(copy.code)}</span><input id="operations-finding-code" maxlength="32" value="OPS_NOTE" pattern="[A-Z][A-Z0-9_-]{1,31}" /></label>
          <label class="operations-field operations-note"><span>${escapeHtml(copy.note)}</span><textarea id="operations-finding-note" maxlength="160"></textarea></label>
        </div>
        <div class="button-row">${action("record-finding", copy.record)}${action("delete-records", copy.deleteRecords, "danger")}</div>
        ${guardMessages === "" ? "" : `<ul class="operations-guard" role="alert">${guardMessages}</ul>`}
        <ul data-operations-findings>${view.findings.map((finding) => `<li>${finding.sequence} · ${escapeHtml(finding.classification)} · ${escapeHtml(finding.code)} · ${escapeHtml(finding.note)}</li>`).join("")}</ul>
      </section>

      <section aria-labelledby="operations-drills-title">
        <h2 id="operations-drills-title">${escapeHtml(copy.drills)}</h2>
        <div class="button-row operations-drills">${action("sev0", copy.sev0, "danger-action")}${action("stop-drill", copy.stopDrill, "danger-action")}${action("delete", copy.deletion, "danger")}${action("reconnect", copy.reconnect)}${action("rollback", copy.rollback)}${action("withdrawal", copy.withdrawal)}</div>
        <dl class="operations-facts">${Object.entries(view.drillResults).map(([name, result]) => `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(result)}</dd></div>`).join("")}<div><dt>${escapeHtml(copy.noResurrection)}</dt><dd>${String(view.noResurrectionVerified)}</dd></div><div><dt>${escapeHtml(copy.deletedRecords)}</dt><dd>${view.deletedRecordCount}</dd></div></dl>
      </section>

      <section aria-labelledby="operations-export-title"><h2 id="operations-export-title">${escapeHtml(copy.export)}</h2>${action("export", copy.createExport)}${view.exportPreview === "" ? "" : `<a id="operations-export-download" href="#" download="ludys-wp13-11-local-review.json">${escapeHtml(copy.saveExport)}</a>`}<textarea id="operations-export-preview" readonly aria-label="Lokal reviewpakke">${escapeHtml(view.exportPreview)}</textarea></section>
      <section aria-labelledby="operations-forbidden-title"><h2 id="operations-forbidden-title">${escapeHtml(copy.forbiddenMetrics)}</h2><ul class="forbidden-metrics">${view.forbiddenMetrics.map((metric) => `<li><strong>${escapeHtml(metric.metricId)}</strong> · ${escapeHtml(metric.status)} · TECHNICALLY_BLOCKED</li>`).join("")}</ul></section>
      <section class="operations-terminal" aria-labelledby="operations-limitations-title"><h2 id="operations-limitations-title">${escapeHtml(copy.limitations)}</h2><p>${escapeHtml(copy.openGaps)}</p></section>
    </main>
    <div id="operations-status" class="sr-only" role="status" aria-live="polite"></div><div id="operations-alert" class="sr-only" role="alert" aria-live="assertive"></div>`;
}
