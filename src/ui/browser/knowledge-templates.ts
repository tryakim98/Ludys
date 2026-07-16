import type { KnowledgeLibrarySnapshot } from "../../application/knowledge-library-controller.js";
import type {
  AdultRole,
  KnowledgeDurationMinutes,
  KnowledgeNeed,
  KnowledgeTopic,
} from "../../core/knowledge-audio-prototype.js";
import type { AgeBand, Locale } from "../../core/content-contracts.js";
import { escapeHtml } from "./templates.js";

const labels = {
  "nb-NO": {
    title: "Kunnskapsbank – intern prototype",
    intro: "Tolv små kunnskapsenheter og åtte situasjonskort. Innholdet er ikke pilotgodkjent.",
    role: "Rolle",
    age: "Alder",
    topic: "Tema",
    need: "Behov",
    time: "Maks tid",
    all: "Alle",
    results: "treff",
    action: "Hva kan du gjøre?",
    good: "Eksempel",
    avoid: "Unngå",
    deepen: "Fordypning",
    judgment: "Bruk eget skjønn",
    stop: "Stopp når",
    sources: "Kilder og status",
    plain: "Kort versjon",
    audio: "Lyd",
    audioUnavailable: "Lyd er ikke publisert ennå. Bruk den reviewede teksten.",
    internalAudio: "Syntetisk lydkladd – kun intern vurdering. Den er ikke menneskelig innlest og er ikke publisert innhold.",
    review: "Reviewstatus",
    open: "Åpne",
    release: "Release",
    counts: "Prototypeomfang",
  },
  "nn-NO": {
    title: "Kunnskapsbank – intern prototype",
    intro: "Tolv små kunnskapseiningar og åtte situasjonskort. Innhaldet er ikkje pilotgodkjent.",
    role: "Rolle",
    age: "Alder",
    topic: "Tema",
    need: "Behov",
    time: "Maks tid",
    all: "Alle",
    results: "treff",
    action: "Kva kan du gjere?",
    good: "Døme",
    avoid: "Unngå",
    deepen: "Fordjuping",
    judgment: "Bruk eige skjønn",
    stop: "Stopp når",
    sources: "Kjelder og status",
    plain: "Kort versjon",
    audio: "Lyd",
    audioUnavailable: "Lyd er ikkje publisert enno. Bruk den reviewa teksten.",
    internalAudio: "Syntetisk lydkladd – berre intern vurdering. Ho er ikkje menneskeleg innlesen og er ikkje publisert innhald.",
    review: "Reviewstatus",
    open: "Opne",
    release: "Release",
    counts: "Prototypeomfang",
  },
} as const;

const roleLabels: Record<AdultRole, Record<Locale, string>> = {
  TEACHER: { "nb-NO": "Lærer", "nn-NO": "Lærar" },
  PARENT: { "nb-NO": "Foresatt", "nn-NO": "Føresett" },
  OTHER_ADULT: { "nb-NO": "Annen voksen", "nn-NO": "Annan vaksen" },
};
const topicLabels: Record<KnowledgeTopic, Record<Locale, string>> = {
  READING: { "nb-NO": "Lesing", "nn-NO": "Lesing" },
  WRITING: { "nb-NO": "Skriving", "nn-NO": "Skriving" },
  MOTIVATION: { "nb-NO": "Mestring og motivasjon", "nn-NO": "Meistring og motivasjon" },
  EMOTIONAL_SUPPORT: { "nb-NO": "Trygghet og verdighet", "nn-NO": "Tryggleik og verdigheit" },
  ACCESS: { "nb-NO": "Tilgang og hjelpemidler", "nn-NO": "Tilgang og hjelpemiddel" },
};
const needLabels: Record<KnowledgeNeed, Record<Locale, string>> = {
  HELP_REQUESTED: { "nb-NO": "Hjelp er bedt om", "nn-NO": "Hjelp er beden om" },
  TASK_UNCLEAR: { "nb-NO": "Oppgaven er uklar", "nn-NO": "Oppgåva er uklar" },
  WORK_QUIET: { "nb-NO": "Arbeidsro", "nn-NO": "Arbeidsro" },
  AFTER_SUPPORT: { "nb-NO": "Etter støtte", "nn-NO": "Etter støtte" },
  TRANSFER: { "nb-NO": "Nytt eksempel", "nn-NO": "Nytt døme" },
  PLANNING: { "nb-NO": "Planlegging", "nn-NO": "Planlegging" },
  ACCESS_TOOL: { "nb-NO": "Valg av hjelpemiddel", "nn-NO": "Val av hjelpemiddel" },
  STOP_OR_PAUSE: { "nb-NO": "Pause eller stopp", "nn-NO": "Pause eller stopp" },
};

function option(value: string, text: string, selected: boolean): string {
  return `<option value="${escapeHtml(value)}"${selected ? " selected" : ""}>${escapeHtml(text)}</option>`;
}

function selectField(input: {
  readonly id: string;
  readonly label: string;
  readonly filter: string;
  readonly options: readonly { readonly value: string; readonly text: string }[];
  readonly selected: string;
}): string {
  return `<label class="filter-field" for="${input.id}"><span>${escapeHtml(input.label)}</span><select id="${input.id}" data-filter="${input.filter}">${input.options.map((item) => option(item.value, item.text, item.value === input.selected)).join("")}</select></label>`;
}

function reviewSummary(snapshot: KnowledgeLibrarySnapshot): string {
  const selected = snapshot.selected;
  if (selected === undefined) return "";
  const r = selected.review;
  return `pedagogikk ${r.pedagogical.toLowerCase()}, bokmål ${r.languageNb.toLowerCase()}, nynorsk ${r.languageNn.toLowerCase()}, tilgjengelighet ${r.accessibility.toLowerCase()}, Human-First ${r.humanFirst.toLowerCase()}`;
}

export function renderKnowledgeLibraryMarkup(snapshot: KnowledgeLibrarySnapshot): string {
  const locale = snapshot.locale;
  const t = labels[locale];
  const filters = snapshot.filters;
  const roleOptions = [
    { value: "ALL", text: t.all },
    ...Object.keys(roleLabels).map((value) => ({ value, text: roleLabels[value as AdultRole][locale] })),
  ];
  const ageOptions = [
    { value: "ALL", text: t.all },
    ...(["6-9", "10-12", "13-16"] as const).map((value) => ({ value, text: value })),
  ];
  const topicOptions = [
    { value: "ALL", text: t.all },
    ...Object.keys(topicLabels).map((value) => ({ value, text: topicLabels[value as KnowledgeTopic][locale] })),
  ];
  const needOptions = [
    { value: "ALL", text: t.all },
    ...Object.keys(needLabels).map((value) => ({ value, text: needLabels[value as KnowledgeNeed][locale] })),
  ];
  const timeOptions = [
    { value: "ALL", text: t.all },
    ...([2, 5, 10] as const).map((value) => ({ value: String(value), text: `${value} min` })),
  ];

  const resultList = snapshot.results
    .map((unit) => `<li><button type="button" class="knowledge-result${snapshot.selected?.knowledgeId === unit.knowledgeId ? " selected" : ""}" data-action="knowledge-select" data-knowledge-id="${escapeHtml(unit.knowledgeId)}"><span>${escapeHtml(unit.text.title)}</span><small>${escapeHtml(topicLabels[unit.topic][locale])} · ${unit.durationMinutes} min · ${escapeHtml(unit.ageBands.join(", "))}</small></button></li>`)
    .join("");

  const selected = snapshot.selected;
  const detail = selected === undefined
    ? `<p>0 ${t.results}</p>`
    : `<article class="knowledge-detail" aria-labelledby="knowledge-detail-title">
      <p class="prototype-badge">${escapeHtml(selected.publicationStatus)} · ${escapeHtml(selected.knowledgeId)} · rev. ${selected.revision}</p>
      <h3 id="knowledge-detail-title">${escapeHtml(selected.text.title)}</h3>
      <p class="knowledge-lead">${escapeHtml(selected.text.shortExplanation)}</p>
      <section><h4>${t.action}</h4><p>${escapeHtml(selected.text.concreteAdultAction)}</p></section>
      <section class="example-grid"><div><h4>${t.good}</h4><p>${escapeHtml(selected.text.goodExample)}</p></div><div><h4>${t.avoid}</h4><p>${escapeHtml(selected.text.avoidExample)}</p></div></section>
      <section><h4>${t.plain}</h4><p>${escapeHtml(selected.text.plainLanguageVariant)}</p></section>
      <details><summary>${t.deepen}</summary><p>${escapeHtml(selected.text.optionalDeepening)}</p><p><strong>${t.judgment}:</strong> ${escapeHtml(selected.text.whenToUseOwnJudgment)}</p><p><strong>${t.stop}:</strong> ${escapeHtml(selected.text.stopConditions)}</p></details>
      <section class="audio-review" aria-labelledby="audio-review-title"><h4 id="audio-review-title">${t.audio}</h4>
        <p>${escapeHtml(snapshot.audio?.userFacingLabel ?? t.audioUnavailable)}</p>
        ${snapshot.audio?.canPreview === true && snapshot.audio.asset !== undefined ? `<p class="warning">${t.internalAudio}</p><audio controls preload="none" src="${escapeHtml(snapshot.audio.asset.relativeUrl)}"><a href="${escapeHtml(snapshot.audio.asset.relativeUrl)}">${escapeHtml(snapshot.audio.plainTextFallback)}</a></audio>` : `<p>${escapeHtml(snapshot.audio?.plainTextFallback ?? t.audioUnavailable)}</p>`}
      </section>
      <details><summary>${t.sources}</summary><ul>${selected.sources.map((source) => `<li>${escapeHtml(source)}</li>`).join("")}</ul><p><strong>${t.review}:</strong> ${escapeHtml(reviewSummary(snapshot))}</p></details>
    </article>`;

  return `<section class="panel knowledge-library" aria-labelledby="knowledge-title">
    <h2 id="knowledge-title" tabindex="-1">${t.title}</h2>
    <p>${t.intro}</p>
    <p class="state-line"><strong>${t.release}:</strong> ${escapeHtml(snapshot.releaseId)}</p>
    <p><strong>${t.counts}:</strong> ${snapshot.counts.knowledgeUnits} kunnskapsenheter · ${snapshot.counts.contextCards} situasjonskort · ${snapshot.counts.audioSpecifications} lydspesifikasjoner · ${snapshot.counts.internalAudioPreviews} lydfamilier med intern forhåndslyd</p>
    <div class="knowledge-filters" aria-label="Filtrer kunnskapsbanken">
      ${selectField({ id: "filter-role", label: t.role, filter: "role", options: roleOptions, selected: filters.role })}
      ${selectField({ id: "filter-age", label: t.age, filter: "ageBand", options: ageOptions, selected: filters.ageBand })}
      ${selectField({ id: "filter-topic", label: t.topic, filter: "topic", options: topicOptions, selected: filters.topic })}
      ${selectField({ id: "filter-need", label: t.need, filter: "need", options: needOptions, selected: filters.need })}
      ${selectField({ id: "filter-time", label: t.time, filter: "maxDurationMinutes", options: timeOptions, selected: String(filters.maxDurationMinutes) })}
    </div>
    <p aria-live="polite">${snapshot.results.length} ${t.results}</p>
    <div class="knowledge-layout"><ul class="knowledge-results">${resultList}</ul>${detail}</div>
  </section>`;
}

export function parseDurationFilter(value: string): KnowledgeDurationMinutes | "ALL" {
  if (value === "2" || value === "5" || value === "10") return Number(value) as KnowledgeDurationMinutes;
  return "ALL";
}

export function parseAgeFilter(value: string): AgeBand | "ALL" {
  if (value === "6-9" || value === "10-12" || value === "13-16") return value;
  return "ALL";
}
