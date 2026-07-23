import type { ProviderDecisionView } from "../../application/provider-decision-controller.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function list(values: readonly string[]): string {
  return `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

function facts(entries: readonly (readonly [string, string])[]): string {
  return `<dl class="decision-facts">${entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
}

function button(action: string, label: string): string {
  return `<button type="button" data-provider-decision-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`;
}

export function renderProviderDecision(view: ProviderDecisionView): string {
  const labels = view.bundle.sectionLabels;
  const label = (key: string): string => {
    const value = labels[key];
    if (value === undefined) throw new Error(`MISSING_LABEL:${view.locale}:${key}`);
    return value;
  };
  const nb = view.locale === "nb";
  const statusText = `${view.authorization.ownerDecision} · PROVIDER_ACTIVATION ${view.authorization.providerActivation} · CLOUD_RESOURCES ${view.authorization.cloudResources}`;
  const selected = view.selectedOption;
  return `<a class="skip-link" href="#provider-decision-main">${escapeHtml(nb ? "Hopp til hovedinnholdet" : "Hopp til hovudinnhaldet")}</a>
    <header class="site-header decision-header">
      <div><p class="eyebrow">WP13.12A · ${escapeHtml(nb ? "beslutningsgrunnlag" : "avgjerdsgrunnlag")}</p><h1>${escapeHtml(view.bundle.title)}</h1></div>
      <div class="header-actions">${button("close", nb ? "Tilbake til appreisen" : "Tilbake til appreisa")}<label class="locale-control"><span>${escapeHtml(nb ? "Målform" : "Målform")}</span><select id="provider-decision-locale"><option value="nb" ${view.locale === "nb" ? "selected" : ""}>Bokmål</option><option value="nn" ${view.locale === "nn" ? "selected" : ""}>Nynorsk</option></select></label></div>
    </header>
    <div class="classification-banner decision-boundary">${escapeHtml(nb
      ? "Dette er en teknisk anbefaling for syntetisk dev. Produkteier har ikke valgt, og ingen skyressurs er opprettet."
      : "Dette er ei teknisk tilråding for syntetisk dev. Produkteigar har ikkje valt, og ingen skyressurs er oppretta.")}</div>
    <main id="provider-decision-main" class="decision-page" tabindex="-1">
      <section class="decision-integrity" aria-labelledby="provider-decision-title">
        <h2 id="provider-decision-title" tabindex="-1">${escapeHtml(nb ? "Integritet og stoppunkt" : "Integritet og stoppunkt")}</h2>
        <div class="status-cluster"><span>${escapeHtml(view.providerDecisionReleaseId)}</span><span>v${escapeHtml(view.packageVersion)}</span><span>VALIDATOR ${escapeHtml(view.validation.packageStatus)}</span><span>${escapeHtml(statusText)}</span><span>EXTERNAL_RECEIPTS ${view.authorization.externalReceipts}</span><span>B8 ${escapeHtml(view.authorization.b8)}</span><span>WP13.12B ${escapeHtml(view.authorization.wp13_12b)}</span></div>
        <p class="decision-pending">${escapeHtml(view.bundle.pendingOwnerLabel)}. ${escapeHtml(view.bundle.blockedLabel)}.</p>
      </section>

      <section data-decision-section="options" aria-labelledby="decision-options-title">
        <h2 id="decision-options-title">${escapeHtml(label("options"))}</h2>
        <p><strong>${escapeHtml(view.bundle.recommendationLabel)}:</strong> ${escapeHtml(view.recommendedOptionId)}</p>
        ${list(view.bundle.recommendationRationale)}
        <div class="decision-option-grid">${view.providerOptions.map((option) => `<article data-provider-option="${option.optionId}" data-provider-status="${option.status}">
          <p class="draft-status">${escapeHtml(option.status)}</p><h3>${escapeHtml(option.optionId)}</h3>
          ${facts([["Provider", option.provider], ["Identity", option.identityModel], ["Authority", option.authorityModel], ["Cost", option.costBand], ["Operations", option.operationalLoad], ["Lock-in", option.lockInRisk]])}
          <p>${escapeHtml(option.rationale.join(" "))}</p>
          <button type="button" data-provider-option-select="${option.optionId}">${escapeHtml(nb ? "Vis detaljer" : "Vis detaljar")}</button>
        </article>`).join("")}</div>
        <article class="decision-selected"><h3>${escapeHtml(selected.optionId)}</h3>${facts([
          ["Client access", selected.clientAccessModel], ["Retention", selected.retentionModel],
          ["Deletion", selected.deletionModel], ["No-resurrection", selected.noResurrectionModel],
          ["IAM", selected.IAMModel], ["Secrets", selected.secretsModel], ["Exit", selected.exitComplexity],
        ])}${list(selected.openQuestions)}</article>
      </section>

      <section data-decision-section="region" aria-labelledby="decision-region-title"><h2 id="decision-region-title">${escapeHtml(label("region"))}</h2>
        <p><strong>REGION_RECOMMENDATION = ${escapeHtml(view.recommendedRegion)}</strong> · REGION_LOCK_NOT_EXECUTED = ${String(view.regionLockNotExecuted)}</p>
        <div class="table-scroll"><table><thead><tr><th>Region</th><th>Database</th><th>Functions</th><th>${escapeHtml(nb ? "Samlokalisert" : "Samlokalisert")}</th><th>Status</th><th>${escapeHtml(nb ? "Restrisiko" : "Restrisiko")}</th></tr></thead><tbody>${view.regionAnalysis.map((row) => `<tr><th>${escapeHtml(row.regionId)}</th><td>${escapeHtml(row.databaseLocation)}</td><td>${escapeHtml(row.functionLocation)}</td><td>${String(row.colocated)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.legalResidualQuestion)}</td></tr>`).join("")}</tbody></table></div>
      </section>

      <section data-decision-section="capability" aria-labelledby="decision-capability-title"><h2 id="decision-capability-title">${escapeHtml(label("capability"))}</h2>
        <p><strong>${escapeHtml(view.recommendedCapability.capabilityType)}</strong> · ${escapeHtml(view.recommendedCapability.maximumLifetime)}</p>
        <div class="table-scroll"><table><thead><tr><th>Modell</th><th>Status</th><th>Persistent identity</th><th>Cross-session</th><th>Revocation</th></tr></thead><tbody>${view.capabilityOptions.map((item) => `<tr><th>${escapeHtml(item.capabilityOptionId)}</th><td>${escapeHtml(item.status)}</td><td>${String(item.persistentIdentity)}</td><td>${String(item.crossSessionIdentity)}</td><td>${escapeHtml(item.revocation)}</td></tr>`).join("")}</tbody></table></div>
        ${facts([["Role binding", view.recommendedCapability.roleBinding], ["Session binding", view.recommendedCapability.sessionBinding], ["Authority", view.recommendedCapability.authorityGenerationBinding], ["Revision", view.recommendedCapability.expectedRevisionBinding], ["Client storage", view.recommendedCapability.clientStorage], ["Replay protection", view.recommendedCapability.replayProtection]])}
      </section>

      <section data-decision-section="dataflow" aria-labelledby="decision-dataflow-title"><h2 id="decision-dataflow-title">${escapeHtml(label("dataflow"))}</h2><ol class="decision-flow">${view.dataflow.map((step) => `<li><strong>${escapeHtml(step.stepId)}</strong><span>${escapeHtml(step.authority)}</span><small>${escapeHtml(step.failureMode)}</small></li>`).join("")}</ol></section>
      <section data-decision-section="trust" aria-labelledby="decision-trust-title"><h2 id="decision-trust-title">${escapeHtml(label("trust"))}</h2><div class="decision-card-grid">${view.trustBoundaries.map((boundary) => `<article><h3>${escapeHtml(boundary.boundaryId)}</h3><p>${escapeHtml(boundary.from)} → ${escapeHtml(boundary.to)}</p><p>${escapeHtml(boundary.authenticationOrCapability)}</p><p><strong>${escapeHtml(view.bundle.riskLabel)}:</strong> ${escapeHtml(boundary.residualRisk)}</p></article>`).join("")}</div></section>

      <section data-decision-section="data" aria-labelledby="decision-data-title"><h2 id="decision-data-title">${escapeHtml(label("data"))}</h2>
        <p>${escapeHtml(nb ? "Tillatte kandidater er syntetiske og fortsatt betinget av en senere eierbeslutning. Forbudte klasser er NOT_COLLECTED og NOT_AUTHORIZED." : "Tillatne kandidatar er syntetiske og framleis avhengige av ei seinare eigaravgjerd. Forbodne klassar er NOT_COLLECTED og NOT_AUTHORIZED.")}</p>
        <div class="decision-data-columns"><div><h3>${escapeHtml(nb ? "Syntetiske kandidater" : "Syntetiske kandidatar")}</h3>${list(view.allowedDataClasses.filter((entry) => entry.status === "ALLOWED_SYNTHETIC_CANDIDATE").map((entry) => entry.dataClass))}</div><div><h3>${escapeHtml(nb ? "Forbudt" : "Forbode")}</h3>${list(view.allowedDataClasses.filter((entry) => entry.status === "NOT_COLLECTED").map((entry) => `${entry.dataClass} · NOT_COLLECTED · NOT_AUTHORIZED`))}</div></div>
      </section>

      <section data-decision-section="retention" aria-labelledby="decision-retention-title"><h2 id="decision-retention-title">${escapeHtml(label("retention"))}</h2>
        <p><strong>EXPLICIT_DELETION_DOMINATES_TTL · STOP_DOMINATES_ALL_PENDING_ACTIONS · DELETED_SESSION_CANNOT_RESURRECT</strong></p>
        ${facts([["Active session", view.retentionDeletion.activeSessionLifetime], ["Capability", view.retentionDeletion.capabilityLifetime], ["TTL immediate", String(view.retentionDeletion.ttlIsImmediateDeletion)]])}
        ${list([...view.retentionDeletion.explicitDeletion, ...view.retentionDeletion.expiryAndTtl, ...view.retentionDeletion.backupsAndPitr])}
      </section>

      <section data-decision-section="logging" aria-labelledby="decision-logging-title"><h2 id="decision-logging-title">${escapeHtml(label("logging"))}</h2><div class="decision-data-columns"><div><h3>Allowlist</h3>${list(view.loggingObservability.allowed)}</div><div><h3>${escapeHtml(nb ? "Forbudt" : "Forbode")}</h3>${list(view.loggingObservability.prohibited)}</div></div><p>Provider logs fully controlled by application = ${String(view.loggingObservability.providerLogsFullyControlledByApplication)}</p></section>
      <section data-decision-section="iam" aria-labelledby="decision-iam-title"><h2 id="decision-iam-title">${escapeHtml(label("iam"))}</h2>${facts([["Separate dev project", String(view.iamAndSecrets.separateDevProjectRequired)], ["Least privilege", String(view.iamAndSecrets.leastPrivilegeRequired)], ["Runtime owner role", String(view.iamAndSecrets.broadOwnerRoleAllowedForRuntime)], ["Service-account JSON in repository", String(view.iamAndSecrets.serviceAccountJsonInRepository)], ["Browser server secrets", String(view.iamAndSecrets.browserServerSecrets)]])}</section>
      <section data-decision-section="cost" aria-labelledby="decision-cost-title"><h2 id="decision-cost-title">${escapeHtml(label("cost"))}</h2><p>${escapeHtml(nb ? "Estimat er ikke garanti. Billing alert er ikke automatisk et hardt tak." : "Estimat er ikkje garanti. Billing alert er ikkje automatisk eit hardt tak.")}</p>${list(Object.entries(view.costModel.ownerFields).map(([key, value]) => `${key}: ${value}`))}</section>
      <section data-decision-section="threats" aria-labelledby="decision-threats-title"><h2 id="decision-threats-title">${escapeHtml(label("threats"))}</h2><div class="decision-threat-grid">${view.threats.map((threat) => `<article data-threat-id="${escapeHtml(threat.threatId)}"><h3>${escapeHtml(threat.threatId)}</h3><p>${escapeHtml(threat.severity)} · ${escapeHtml(threat.likelihood)} · BLOCKS_ACTIVATION ${String(threat.blocksActivation)}</p><p>${escapeHtml(threat.residualRisk)}</p></article>`).join("")}</div></section>
      <section data-decision-section="legal" aria-labelledby="decision-legal-title"><h2 id="decision-legal-title">${escapeHtml(label("legal"))}</h2>${list(view.dataProcessingRequirements.map((item) => `${item.topic} · ${item.classification} · ${item.status}`))}</section>
      <section data-decision-section="exit" aria-labelledby="decision-exit-title"><h2 id="decision-exit-title">${escapeHtml(label("exit"))}</h2>${list(Object.entries(view.migrationExit).flatMap(([topic, steps]) => [`${topic}:`, ...steps]))}</section>
      <section data-decision-section="no-go" aria-labelledby="decision-no-go-title"><h2 id="decision-no-go-title">${escapeHtml(label("noGo"))}</h2>${list(view.noGo.map((item) => `${item.noGoId} · ${item.status}`))}</section>
      <section data-decision-section="sources" aria-labelledby="decision-sources-title"><h2 id="decision-sources-title">${escapeHtml(label("sources"))}</h2><p>checkedAt 2026-07-23 · ${view.officialSources.length} ${escapeHtml(nb ? "primærkilder" : "primærkjelder")}</p><ol>${view.officialSources.map((source) => `<li><strong>${escapeHtml(source.title)}</strong> · ${escapeHtml(source.publisher)}<br><code>${escapeHtml(source.officialUrl)}</code></li>`).join("")}</ol></section>
      <section data-decision-section="owner" class="decision-owner" aria-labelledby="decision-owner-title"><h2 id="decision-owner-title">${escapeHtml(label("owner"))}</h2><p>PENDING_OWNER_ACTION · BLANK = ${String(view.ownerTemplateBlank)} · SIGNATURE = false</p><div class="button-row">${button("export-dossier", nb ? "Eksporter beslutningsdossier" : "Eksporter avgjerdsdossier")}${button("export-owner-template", nb ? "Eksporter blank produkteiermal" : "Eksporter blank produkteigarmal")}</div>${view.dossierPreview === "" ? "" : `<a id="provider-dossier-download" download="ludys-wp13-12a-decision-dossier.json">${escapeHtml(nb ? "Lagre dossier" : "Lagre dossier")}</a><textarea id="provider-dossier-preview" readonly>${escapeHtml(view.dossierPreview)}</textarea>`}${view.ownerTemplatePreview === "" ? "" : `<a id="provider-owner-template-download" download="WP13_12A_OWNER_DECISION_TEMPLATE.md">${escapeHtml(nb ? "Lagre blank mal" : "Lagre blank mal")}</a><textarea id="provider-owner-template-preview" readonly>${escapeHtml(view.ownerTemplatePreview)}</textarea>`}</section>
      <section class="operations-terminal"><h2>${escapeHtml(nb ? "Eksplisitt stoppunkt" : "Eksplisitt stoppunkt")}</h2><p>OWNER_DECISION = PENDING_OWNER_ACTION · PROVIDER_ACTIVATION = BLOCKED · CLOUD_RESOURCES = 0 · WP13.12B = BLOCKED · STUDENT_BETA = NOT_AUTHORIZED · PRODUCTION = NOT_AUTHORIZED</p></section>
    </main>
    <div id="provider-decision-status" class="sr-only" role="status" aria-live="polite"></div><div id="provider-decision-alert" class="sr-only" role="alert" aria-live="assertive"></div>`;
}
