import type { Locale } from "../../core/content-contracts.js";

const escape = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export const skynjaBrand = (): string => `<span class="skynja-brand"><span class="skynja-mark" aria-hidden="true">s</span><span>Skynja</span></span>`;

/** New interface copy is a draft, separate from historically reviewed proof copy. */
export function renderSkynjaHome(locale: Locale, disclosure: string, privacy: string, classification: string): string {
  const t = (nb: string, nn: string): string => locale === "nb-NO" ? nb : nn;
  return `<div class="skynja-home" data-view-key="home-${locale}" data-copy-human-reviewed="false">
    <a class="skip-link" href="#main-content">${t("Hopp til hovedinnholdet", "Hopp til hovudinnhaldet")}</a>
    <header class="site-header skynja-header">${skynjaBrand()}<label class="locale-control"><span>Målform</span><select id="app-locale"><option value="nb-NO" ${locale === "nb-NO" ? "selected" : ""}>Bokmål</option><option value="nn-NO" ${locale === "nn-NO" ? "selected" : ""}>Nynorsk</option></select></label></header>
    <main id="main-content" tabindex="-1">
      <div class="home-heading"><p class="skynja-eyebrow">${t("Lesing og språk", "Lesing og språk")}</p><h1 id="screen-title" tabindex="-1">${t("Hva vil du jobbe med?", "Kva vil du jobbe med?")}</h1></div>
      <div class="home-workspaces">
        <section class="home-exercises" aria-labelledby="home-exercise-title">
          <p class="home-index" aria-hidden="true">01 /</p><h2 id="home-exercise-title">${t("Øvelser", "Øvingar")}</h2>
          <p>${t("Bygg ord og setninger. Les en tekst. Finn en sammenheng.", "Bygg ord og setningar. Les ein tekst. Finn ein samanheng.")}</p>
          <button type="button" class="skynja-button-primary" data-exercise-action="open">${t("Åpne øvelsesrom", "Opne øvingsrom")}<span aria-hidden="true">↗</span></button>
          <div class="home-exercise-bottom"><span>${t("Hint når du trenger det", "Hint når du treng det")}</span><span>${t("Ingen tidtaking", "Inga tidtaking")}</span></div>
        </section>
        <section class="home-workshop" aria-labelledby="home-workshop-title"><p class="home-index" aria-hidden="true">02 /</p><h2 id="home-workshop-title">${t("Innholdsverksted", "Innhaldsverkstad")}</h2><p>${t("Se tekster, arbeid med innhold og gjør klart til faglig gjennomgang.", "Sjå tekstar, arbeid med innhald og gjer klart til fagleg gjennomgang.")}</p><button type="button" data-authoring-action="open">${t("Åpne verkstedet", "Opne verkstaden")}<span aria-hidden="true">↗</span></button></section>
      </div>
      <section class="home-foundation" aria-labelledby="home-foundation-title"><div><h2 id="home-foundation-title">${t("Prøv grunnøvelsene sammen", "Prøv grunnøvingane saman")}</h2><p>${t("Et eget prøverom med ordbrikker og en visning for støttepersonen.", "Eit eige prøverom med ordbrikker og ei vising for støttepersonen.")}</p></div><button type="button" data-app-action="create">${t("Åpne prøverommet", "Opne prøverommet")}</button></section>
      <p class="home-draft-note">${t("Prøveversjon. Øvelsene venter på faglig og språklig gjennomgang.", "Prøveversjon. Øvingane ventar på fagleg og språkleg gjennomgang.")}</p>
      <details class="home-details"><summary>${t("Om prøveversjonen og tekniske verktøy", "Om prøveversjonen og tekniske verktøy")}</summary><p data-synthetic-marker="${escape(classification)}">${escape(disclosure)}</p><p>${escape(privacy)}</p><div class="button-row"><button type="button" data-operations-action="open">Betaoperasjon</button><button type="button" data-provider-decision-action="open">${t("Providerbeslutning", "Provideravgjerd")}</button></div></details>
    </main><div id="app-status" class="sr-only" role="status" aria-live="polite"></div><div id="app-alert" class="sr-only" role="alert" aria-live="assertive"></div>
  </div>`;
}
