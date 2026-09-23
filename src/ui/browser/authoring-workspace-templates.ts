import type { AuthoringPipelineView, AuthoringLocaleTextField } from "../../application/authoring-pipeline-controller.js";

export const AUTHORING_UI_COPY_REVIEW = Object.freeze({
  humanReviewed: false,
  reviewSource: "CONTENT_EXPANSION_DRAFT_2026-09-22",
  externalLanguageApproval: false,
});

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function field(label: string, name: AuthoringLocaleTextField, value: string, multiline = false): string {
  const id = `authoring-${name}`;
  return `<label class="authoring-field" for="${id}"><span>${escapeHtml(label)}</span>${multiline
    ? `<textarea id="${id}" data-authoring-field="${name}" rows="3">${escapeHtml(value)}</textarea>`
    : `<input id="${id}" data-authoring-field="${name}" value="${escapeHtml(value)}" />`}</label>`;
}

function pendingReview(view: AuthoringPipelineView): string {
  const review = view.selectedPackage.pendingPatternReview?.locales[view.locale];
  if (review === undefined) return "";
  const nn = view.locale === "nn-NO";
  const facts = [
    [nn ? "Målform" : "Målform", review.writtenStandard],
    [nn ? "Bokstavar og lydar" : "Bokstaver og lyder", review.norwegianGraphemePhonemeSuitability],
    ["Uttale og dialekt", review.pronunciationAndDialectLimits],
    [nn ? "Vokallengd" : "Vokallengde", review.vowelLength],
    ["Dobbel konsonant", review.consonantDoubling],
    ["Skrift", review.orthographicComplexity],
    [nn ? "Ordformer og tyding" : "Ordformer og betydning", review.morphologicalComplexity],
    [nn ? "Kva oppgåva undersøker" : "Hva oppgaven undersøker", review.investigates],
    [nn ? "Kva oppgåva ikkje kan vise" : "Hva oppgaven ikke kan vise", review.cannotProve],
    [nn ? "Grunngiving for ordvala" : "Begrunnelse for ordvalgene", review.stimulusRationale],
  ];
  return `<section data-content-proposal data-copy-human-reviewed="false" aria-labelledby="proposal-heading">
    <h2 id="proposal-heading">${nn ? "Nytt innhaldsutkast – ventar på fagreview" : "Nytt innholdsutkast – venter på fagreview"}</h2>
    <p>${nn ? "AI-assistert utkast. Tekst, ordval og lydmanus er ikkje menneskeleg godkjende. Pakken kan redigerast og eksporterast her i verkstaden." : "AI-assistert utkast. Tekst, ordvalg og lydmanus er ikke menneskelig godkjent. Pakken kan redigeres og eksporteres her i verkstedet."}</p>
    <details><summary>${escapeHtml(review.title)}</summary><dl>${facts.map(([label, value]) => `<dt><strong>${escapeHtml(label!)}</strong></dt><dd>${escapeHtml(value!)}</dd>`).join("")}</dl>
    <h3>${nn ? "Spørsmål til fagpersonen" : "Spørsmål til fagpersonen"}</h3><ul>${review.openReviewerQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul></details>
  </section>`;
}

export function renderAuthoringWorkspace(view: AuthoringPipelineView): string {
  const authoringPackage = view.selectedPackage;
  const copy = authoringPackage.locales[view.locale];
  const child = authoringPackage.childPreview[view.locale];
  const adult = authoringPackage.adultPreview[view.locale];
  const validation = view.validation;
  return `<a class="skip-link" href="#authoring-main">Hopp til innholdsverkstedet</a>
    <header class="site-header app-header authoring-header"><div><p class="eyebrow">WP13.9 · lokalt syntetisk verksted</p><h1>Authoring-, innholds- og lydpipeline</h1></div><button type="button" data-authoring-action="close">Tilbake til appreisen</button></header>
    <main id="authoring-main" class="authoring-workspace" tabindex="-1" data-copy-human-reviewed="${String(AUTHORING_UI_COPY_REVIEW.humanReviewed)}" data-copy-review-source="${AUTHORING_UI_COPY_REVIEW.reviewSource}">
      <section class="authoring-boundary" aria-labelledby="authoring-title"><h2 id="authoring-title" tabindex="-1">Innholdsverksted</h2><div class="status-cluster" role="status"><span>DRAFT</span><span>EXTERNAL_REVIEW_REQUIRED</span><span>0 EXTERNAL RECEIPTS</span><span>PUBLISHING BLOCKED</span><span>NOT STUDENT BETA</span></div><p><strong>AUTHORING_PIPELINE_READY · AUDIO_PRODUCTION_PIPELINE_READY · SYNTHETIC_ONLY</strong></p><p>Læringsdimensjonene beskriver aktivitetens oppgavekrav. De er ikke dysleksityper, og appen diagnostiserer eller profilerer ikke barnet.</p></section>
      <section class="authoring-selector" aria-labelledby="package-heading"><h2 id="package-heading">Velg pakke</h2><label for="authoring-package-select">${view.packages.length} pakker og lokale utkast</label><select id="authoring-package-select">${view.packages.map((item) => `<option value="${escapeHtml(item.packageId)}" ${item.selected ? "selected" : ""}>${escapeHtml(item.title)} · ${escapeHtml(item.activityId)} · ${escapeHtml(item.lifecycle)}</option>`).join("")}</select><dl class="authoring-facts"><div><dt>Aktivitet</dt><dd>${escapeHtml(authoringPackage.activityId)}</dd></div><div><dt>Mønsterklasse</dt><dd>${escapeHtml(authoringPackage.patternClassId)}</dd></div><div><dt>Construct</dt><dd>${escapeHtml(authoringPackage.construct)}</dd></div><div><dt>Review</dt><dd>${escapeHtml(authoringPackage.reviewStatus)}</dd></div><div><dt>Lifecycle</dt><dd>${escapeHtml(authoringPackage.lifecycle)}</dd></div></dl><div class="button-row" aria-label="Velg målform"><button type="button" data-authoring-locale="nb-NO" aria-pressed="${String(view.locale === "nb-NO")}">BM</button><button type="button" data-authoring-locale="nn-NO" aria-pressed="${String(view.locale === "nn-NO")}">NN</button></div></section>
      ${pendingReview(view)}
      <section aria-labelledby="locale-fields-heading"><h2 id="locale-fields-heading">${view.locale === "nb-NO" ? "Bokmål" : "Nynorsk"} – eksplisitt redaksjonell variant</h2><div class="authoring-form-grid">${field("Tittel", "title", copy.title)}${field("Målord", "targetWord", copy.targetWord)}${field("Transferord", "transferWord", copy.transferWord)}${field("Instruksjon", "instruction", copy.instruction, true)}${field("Betydningsprompt", "meaningPrompt", copy.meaningPrompt, true)}${field("Transferprompt", "transferPrompt", copy.transferPrompt, true)}${field("Voksen – forstå", "adultUnderstand", copy.adultCard.understand, true)}${field("Voksen – gjør eller si", "adultDoOrSay", copy.adultCard.doOrSay, true)}${field("Voksen – unngå", "adultAvoid", copy.adultCard.avoid, true)}${field("Voksen – fordyp deg", "adultDeepen", copy.adultCard.deepen, true)}${field("Kunnskapstittel", "knowledgeTitle", copy.knowledgeUnit.title)}${field("Kunnskapsforklaring", "knowledgeExplanation", copy.knowledgeUnit.explanation, true)}${field("Situasjonskort", "contextCard", copy.contextCard.text, true)}</div></section>
      <section aria-labelledby="dimensions-heading"><h2 id="dimensions-heading">Læringsdimensjoner – ikke barnetyper</h2><ul class="dimension-grid">${authoringPackage.learningDimensions.map((item) => `<li><strong>${escapeHtml(item.dimension)}</strong><span>${escapeHtml(item.emphasis)}</span><p>${escapeHtml(item.professionalRationale)}</p><p>${escapeHtml(item.observableTaskRequirement)}</p><small>notDiagnostic = true</small></li>`).join("")}</ul></section>
      <section aria-labelledby="audio-heading"><h2 id="audio-heading">Audio Content System</h2><p>WAV · PCM · mono · 48 kHz · 16/24 bit · brukerstart · ingen autoplay · ingen runtime-mikrofon · STOPP avbryter.</p><div class="audio-spec-grid">${authoringPackage.audioSpecifications.map((spec) => `<article data-authoring-audio-spec="${escapeHtml(spec.semanticAudioId)}"><h3>${escapeHtml(spec.scriptFamily)} · ${escapeHtml(spec.locale)}</h3><p>${escapeHtml(spec.semanticAudioId)}</p><p><strong>${escapeHtml(spec.lifecycle)}</strong> · stale=${String(spec.stale)} · take=${escapeHtml(spec.activeTakeId ?? "NONE")}</p><label for="script-${escapeHtml(spec.semanticAudioId)}">Lydmanus</label><textarea id="script-${escapeHtml(spec.semanticAudioId)}" data-audio-script-id="${escapeHtml(spec.semanticAudioId)}" rows="3">${escapeHtml(spec.script)}</textarea><div class="button-row"><button type="button" data-authoring-action="attach-take-a" data-audio-id="${escapeHtml(spec.semanticAudioId)}">Teknisk take A</button><button type="button" data-authoring-action="attach-take-b" data-audio-id="${escapeHtml(spec.semanticAudioId)}">Erstatt med take B</button><button type="button" data-authoring-action="preview-audio" data-audio-id="${escapeHtml(spec.semanticAudioId)}">Start teknisk prøve</button></div><p>HUMAN_REQUIRED · NOT_REVIEWED · NOT_PRODUCTION_AUDIO</p></article>`).join("")}</div><button type="button" data-authoring-action="stop-audio" class="danger-action">STOPP lyd</button><p data-authoring-audio-state role="status">${escapeHtml(view.audioPreviewState)}</p></section>
      <section aria-labelledby="clone-heading"><h2 id="clone-heading">Ny semantic draft fra mal</h2><label for="authoring-clone-id">Ny stabil activityId</label><input id="authoring-clone-id" value="activity-nor-local-draft-009" /><button type="button" data-authoring-action="clone">Opprett komplett draft</button></section>
      <section aria-labelledby="review-heading"><h2 id="review-heading">Lokal review og ekstern handoff</h2><div class="authoring-form-grid"><label for="local-review-id">Review-ID</label><input id="local-review-id" value="local-review-ui-001" /><label for="local-review-name">Navn</label><input id="local-review-name" value="Intern fagperson" /><label for="local-review-role">Rolle</label><input id="local-review-role" value="CONTENT_EDITOR" /><label for="local-review-comment">Kommentar</label><textarea id="local-review-comment">Lokalt draftnotat – ikke ekstern receipt.</textarea></div><div class="button-row"><button type="button" data-authoring-action="add-review">Registrer lokalt non-receipt-notat</button><button type="button" data-authoring-action="handoff">Klargjør REVIEW_PENDING</button></div><p>Lokale signaturer har alltid externalReceipt=false og receiptIntegrityVerified=false.</p></section>
      <section aria-labelledby="integrity-heading"><h2 id="integrity-heading">Validering, eksport og import</h2><div class="button-row"><button type="button" data-authoring-action="validate">Valider komplett pakke</button><button type="button" data-authoring-action="export">Eksporter deterministisk JSON</button><button type="button" data-authoring-action="import">Importer og valider JSON</button></div><p data-authoring-validation role="status">draftExport=${String(validation.validForDraftExport)} · externalHandoff=${String(validation.validForExternalReviewHandoff)} · publish=false</p>${validation.errors.length === 0 ? "" : `<ul role="alert">${validation.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`}<label for="authoring-json">Komplett versjonert JSON</label><textarea id="authoring-json" rows="12">${escapeHtml(view.exportJson)}</textarea>${view.importError === undefined ? "" : `<p role="alert">IMPORT BLOCKED: ${escapeHtml(view.importError)}</p>`}</section>
      <section class="preview-grid" aria-labelledby="preview-heading"><h2 id="preview-heading">Forhåndsvisninger</h2><article data-child-preview><h3>Child preview</h3><p><strong>${escapeHtml(child.title)}</strong></p><p>${escapeHtml(child.instruction)}</p><p>${escapeHtml(child.targetWord)} → ${escapeHtml(child.transferWord)}</p><p>SYNTHETIC_ONLY · diagnosticClaim=false</p></article><article data-adult-preview><h3>Adult preview</h3><p><strong>${escapeHtml(adult.title)}</strong></p><p>${escapeHtml(adult.adultCard.understand)}</p><p>${escapeHtml(adult.adultCard.doOrSay)}</p><p>${escapeHtml(adult.knowledgeTitle)} · ${escapeHtml(adult.contextText)}</p><p>0 EXTERNAL RECEIPTS · PUBLISHING BLOCKED</p></article></section>
      <section class="authoring-terminal"><h2>Lifecycle</h2><div class="button-row"><button type="button" data-authoring-action="withdraw" class="danger-action">Trekk tilbake pakke og lyd</button><button type="button" disabled aria-describedby="publish-explanation">Publiser</button></div><p id="publish-explanation">Publisering er permanent teknisk blokkert i WP13.9.</p></section>
      <p id="authoring-status" role="status" aria-live="polite">${escapeHtml(view.lastAction)}</p><p id="authoring-alert" role="alert" aria-live="assertive"></p>
    </main>`;
}
