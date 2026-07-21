import type { LifecycleViewModel } from "../../application/session-lifecycle-controller.js";
import type { Locale } from "../../core/content-contracts.js";
import type { SessionLifecycleTechnicalCopy } from "../../content/prototype/session-lifecycle-copy.js";

function escape(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderSessionLifecycleMarkup(
  view: LifecycleViewModel,
  copy: SessionLifecycleTechnicalCopy,
  locale: Locale,
): string {
  const error = view.error === undefined
    ? ""
    : `<div id="lifecycle-error" class="lifecycle-error" role="alert" tabindex="-1">${escape(copy.errors[view.error.code])}</div>`;
  const rolePanel = view.role === "CHILD"
    ? `<section class="lifecycle-role-panel" aria-labelledby="child-panel-title"><h2 id="child-panel-title">${escape(copy.childPanel)}</h2><p data-child-cue>${escape(view.childCue === "SYNTHETIC_HELP_WAIT" ? copy.childHelpWait : copy.childDefault)}</p></section>`
    : `<section class="lifecycle-role-panel" aria-labelledby="adult-panel-title"><h2 id="adult-panel-title">${escape(copy.adultPanel)}</h2><p data-adult-detail>${escape(view.adultDetail === "SYNTHETIC_HELP_REQUESTED" ? copy.adultHelpRequested : copy.adultDefault)}</p>${view.sessionReference === undefined ? `<p data-tombstone>${escape(copy.tombstone)}</p>` : `<dl><div><dt>${escape(copy.sessionReference)}</dt><dd data-session-reference>${escape(view.sessionReference)}</dd></div><div><dt>${escape(copy.observedVersion)}</dt><dd data-observed-version>${view.observedVersion}</dd></div></dl>`}</section>`;
  const actions = view.availableActions
    .map((action) => `<button type="button" data-lifecycle-action="${action}">${escape(copy.actions[action])}</button>`)
    .join("");

  return `<a class="skip-link" href="#lifecycle-proof">${escape(copy.skipLink)}</a>
    <header class="site-header lifecycle-header"><div><p class="eyebrow">WP13.7A · ${escape(copy.marker)}</p><h1 id="lifecycle-title" tabindex="-1">${escape(copy.heading)}</h1><p>${escape(copy.introduction)}</p></div>
      <label class="locale-control"><span>${escape(copy.localeLabel)}</span><select id="lifecycle-locale"><option value="nb-NO"${locale === "nb-NO" ? " selected" : ""}>${escape(copy.localeNb)}</option><option value="nn-NO"${locale === "nn-NO" ? " selected" : ""}>${escape(copy.localeNn)}</option></select></label></header>
    <main id="lifecycle-proof" class="lifecycle-proof" tabindex="-1" data-state="${view.state}" data-role="${view.role}">
      <p class="warning lifecycle-marker">${escape(copy.marker)}</p>
      <p class="lifecycle-synthetic" data-synthetic-marker="${view.dataClassification}">${escape(copy.syntheticBadge)}</p>
      <div class="role-nav" role="group" aria-label="${escape(copy.roleGroup)}"><button type="button" data-lifecycle-role="CHILD" aria-pressed="${view.role === "CHILD"}">${escape(copy.childRole)}</button><button type="button" data-lifecycle-role="ADULT" aria-pressed="${view.role === "ADULT"}">${escape(copy.adultRole)}</button></div>
      <p id="lifecycle-state" class="lifecycle-state" role="status" aria-live="polite" aria-label="${escape(copy.stateLabel)}: ${view.state}" tabindex="-1"><strong>${escape(copy.stateLabel)}:</strong> <span>${escape(copy.states[view.state])}</span></p>
      ${error}
      ${rolePanel}
      <div class="lifecycle-actions" role="group" aria-label="${escape(copy.actionGroup)}">${actions}</div>
    </main>`;
}
