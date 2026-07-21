import type {
  AudioPrototypeSpecification,
  KnowledgeAudioPrototypeRelease,
  KnowledgeContextCard,
  KnowledgePrototypeUnit,
  LocalizedKnowledgeText,
  ReviewSummary,
} from "../../core/knowledge-audio-prototype.js";

const internalPrototypeReview: ReviewSummary = {
    pedagogical: "PENDING", languageNb: "PENDING", languageNn: "PENDING",
    accessibility: "APPROVED", ageDignity: "PENDING", humanFirst: "APPROVED",
    reviewedOn: "2026-07-14", notes: ["Intern prototype; ekstern fag- og språkreview kreves før B8"],
  };

function localized(locale: "nb-NO" | "nn-NO", values: readonly [string, string, string, string, string, string, string, string, string, string]): LocalizedKnowledgeText {
  return {
    locale,
    title: values[0], shortExplanation: values[1], concreteAdultAction: values[2],
    goodExample: values[3], avoidExample: values[4], optionalDeepening: values[5],
    whenItFits: values[6], whenToUseOwnJudgment: values[7], stopConditions: values[8],
    plainLanguageVariant: values[9],
  };
}

const sharedSources = [
  "Masterplan 6.5 / HP1-2026-07-14",
  "WP13.2 vertical proof and product constraints",
  "External research and language review required before B8",
] as const;

export const prototypeKnowledgeUnits: readonly KnowledgePrototypeUnit[] = [
  {
    knowledgeId: "knowledge-word-support-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["6-9"],
    topic: "READING", needs: ["HELP_REQUESTED", "AFTER_SUPPORT"], durationMinutes: 2,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-word-support-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Vent før du hjelper", "En kort pause kan gi barnet rom til å prøve før den voksne gjør noe.", "Vent først. Hvis barnet ber om hjelp, gi ett valg eller modeller én del.", "Vil du vente litt, eller ta første lyd sammen?", "Dette er lett. Jeg viser hele ordet.", "Legg merke til om barnet fortsetter selv etter pausen.", "Når barnet fortsatt arbeider, eller nettopp har bedt om hjelp.", "Bruk eget skjønn hvis oppgaven, uttalen eller situasjonen er uklar.", "Stopp hvis barnet ber om det, eller hvis aktiviteten ikke lenger er forsvarlig.", "Vent litt. Gi ett valg."]),
      "nn-NO": localized("nn-NO", ["Vent før du hjelper", "Ein kort pause kan gi barnet rom til å prøve før den vaksne gjer noko.", "Vent først. Dersom barnet ber om hjelp, gi eitt val eller modeller éin del.", "Vil du vente litt, eller ta den første lyden saman?", "Dette er lett. Eg viser heile ordet.", "Legg merke til om barnet held fram sjølv etter pausen.", "Når barnet framleis arbeider, eller nettopp har bede om hjelp.", "Bruk eige skjønn dersom oppgåva, uttalen eller situasjonen er uklar.", "Stopp dersom barnet ber om det, eller aktiviteten ikkje lenger er forsvarleg.", "Vent litt. Gje eitt val."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-model-one-part-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["6-9"],
    topic: "READING", needs: ["HELP_REQUESTED", "AFTER_SUPPORT"], durationMinutes: 2,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-model-one-part-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Modeller bare én del", "Én tydelig modell kan støtte barnet uten å gi bort hele svaret.", "Vis én lyd eller én sammentrekking. Be barnet gjøre neste handling.", "Ta første lyd. Hva kommer etterpå?", "Se her. Hele ordet er sol.", "Skill mellom modellert, veiledet og selvstendig respons.", "Når venting ikke er nok og barnet ber om mer støtte.", "Velg en annen støtte hvis én modell ikke passer situasjonen.", "Stopp hvis støtten skaper uro eller barnet vil avslutte.", "Vis én del. La barnet gjøre resten."]),
      "nn-NO": localized("nn-NO", ["Modeller berre éin del", "Éin tydeleg modell kan støtte barnet utan å gi bort heile svaret.", "Vis éin lyd eller éi samantrekking. Be barnet gjere den neste handlinga.", "Ta den første lyden. Kva kjem etterpå?", "Sjå her. Heile ordet er sol.", "Skil mellom modellert, rettleidd og sjølvstendig respons.", "Når venting ikkje er nok og barnet ber om meir støtte.", "Vel ei anna støtte dersom éin modell ikkje passar situasjonen.", "Stopp dersom støtta skaper uro eller barnet vil avslutte.", "Vis éin del. Lat barnet gjere resten."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-concrete-mastery-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["6-9"],
    topic: "MOTIVATION", needs: ["AFTER_SUPPORT", "TRANSFER"], durationMinutes: 2,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-concrete-mastery-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Beskriv det barnet faktisk gjorde", "Konkret feedback viser hvilket steg som fungerte uten å gi identitetsros.", "Pek på handlingen, strategien eller transferen du observerte.", "Du brukte lydene til å bygge ordet.", "Du er en superleser!", "Se om feedbacken skiller mellom deltakelse, støtte og selvstendig handling.", "Etter en tydelig aktivitetshendelse som kan beskrives nøytralt.", "Bruk egne ord hvis standardspråket virker kunstig.", "Stopp feedbacken hvis barnet ønsker ro eller avslutning.", "Si hva barnet gjorde. Ikke hvem barnet er."]),
      "nn-NO": localized("nn-NO", ["Skildre det barnet faktisk gjorde", "Konkret tilbakemelding viser kva steg som fungerte utan identitetsros.", "Peik på handlinga, strategien eller transferen du observerte.", "Du brukte lydane til å byggje ordet.", "Du er ein superlesar!", "Sjå om tilbakemeldinga skil mellom deltaking, støtte og sjølvstendig handling.", "Etter ei tydeleg aktivitetshending som kan skildrast nøytralt.", "Bruk eigne ord dersom standardspråket verkar kunstig.", "Stopp tilbakemeldinga dersom barnet ønskjer ro eller avslutning.", "Sei kva barnet gjorde. Ikkje kven barnet er."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-protect-work-quiet-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["6-9"],
    topic: "EMOTIONAL_SUPPORT", needs: ["WORK_QUIET", "STOP_OR_PAUSE"], durationMinutes: 2,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-protect-work-quiet-001",
    variants: {
      "nb-NO": localized("nb-NO", ["La arbeidsro være et reelt valg", "Stillhet kan være støtte. Appen trenger ikke fylle hvert mellomrom.", "Skru av ikke-nødvendig lyd og vent uten å tolke pausen.", "Vi kan være stille mens du prøver.", "Du har vært stille lenge, så nå trenger du hjelp.", "Vurder om færre ord og mindre lyd gir bedre arbeidsrom.", "Når barnet velger arbeidsro eller vil prøve uten nye signaler.", "Bryt stillheten hvis sikkerhet eller situasjonen krever det.", "Stopp når barnet ber om stopp eller aktiviteten blir utrygg.", "Arbeidsro betyr at appen venter."]),
      "nn-NO": localized("nn-NO", ["Lat arbeidsro vere eit reelt val", "Stille kan vere støtte. Appen treng ikkje fylle kvart mellomrom.", "Skru av lyd som ikkje er nødvendig, og vent utan å tolke pausen.", "Vi kan vere stille medan du prøver.", "Du har vore stille lenge, så no treng du hjelp.", "Vurder om færre ord og mindre lyd gir betre arbeidsrom.", "Når barnet vel arbeidsro eller vil prøve utan nye signal.", "Bryt stilla dersom tryggleik eller situasjonen krev det.", "Stopp når barnet ber om stopp eller aktiviteten blir utrygg.", "Arbeidsro tyder at appen ventar."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-pattern-not-person-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["10-12"],
    topic: "READING", needs: ["TASK_UNCLEAR", "AFTER_SUPPORT"], durationMinutes: 5,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-pattern-not-person-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Forklar mønsteret, ikke personen", "Et avgrenset språkmønster kan forklares uten å beskrive elevens evner eller identitet.", "Vis hva som skjer i ordet, og la eleven prøve på et nytt eksempel.", "Her endrer bokstavene lyden. La oss se på akkurat denne delen.", "Du er dårlig på slike ord.", "Sammenlign to ord som viser samme mønster uten å gjøre økten til en test av personen.", "Når et konkret lesemønster skaper vansker i en aktuell oppgave.", "Bruk eget skjønn dersom dialekt eller kontekst gjør eksempelet mindre treffende.", "Stopp hvis forklaringen blir for omfattende eller oppleves stigmatiserende.", "Snakk om ordet. Ikke om personen."]),
      "nn-NO": localized("nn-NO", ["Forklar mønsteret, ikkje personen", "Eit avgrensa språkmønster kan forklarast utan å skildre eleven sine evner eller identitet.", "Vis kva som skjer i ordet, og lat eleven prøve eit nytt døme.", "Her endrar bokstavane lyden. Lat oss sjå på akkurat denne delen.", "Du er dårleg på slike ord.", "Samanlikn to ord som viser same mønster utan å gjere økta til ein test av personen.", "Når eit konkret lesemønster skaper vanskar i ei aktuell oppgåve.", "Bruk eige skjønn dersom dialekt eller kontekst gjer dømet mindre treffande.", "Stopp dersom forklaringa blir for omfattande eller opplevast stigmatiserande.", "Snakk om ordet. Ikkje om personen."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-plan-short-writing-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["10-12"],
    topic: "WRITING", needs: ["PLANNING", "TASK_UNCLEAR"], durationMinutes: 5,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-plan-short-writing-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Planlegg én kort tekstbit", "En liten plan kan redusere belastningen uten å skrive teksten for eleven.", "Avklar mottaker, formål og første setning. La eleven formulere resten.", "Hvem skal lese dette, og hva må de vite først?", "Jeg skriver hele meldingen for deg.", "Bruk tre stikkord som kan slettes når teksten er skrevet.", "Når en kort melding eller fagtekst oppleves uoversiktlig.", "Tilpass støtten til oppgaven og elevens egen måte å uttrykke seg på.", "Stopp eller ta pause dersom oppgaven blir for omfattende.", "Finn mottaker, formål og første steg."]),
      "nn-NO": localized("nn-NO", ["Planlegg éin kort tekstbit", "Ein liten plan kan redusere belastninga utan å skrive teksten for eleven.", "Avklar mottakar, formål og første setning. Lat eleven formulere resten.", "Kven skal lese dette, og kva må dei vite først?", "Eg skriv heile meldinga for deg.", "Bruk tre stikkord som kan slettast når teksten er skriven.", "Når ei kort melding eller fagtekst verkar uoversiktleg.", "Tilpass støtta til oppgåva og eleven sin eigen måte å uttrykkje seg på.", "Stopp eller ta pause dersom oppgåva blir for omfattande.", "Finn mottakar, formål og første steg."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-repair-after-error-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["10-12"],
    topic: "MOTIVATION", needs: ["AFTER_SUPPORT", "TRANSFER"], durationMinutes: 5,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-repair-after-error-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Gjør feilretting til en ny handling", "En feil skal ikke bli en dom. Den kan brukes til å velge ett nytt, tydelig steg.", "Vis hvor eleven kan starte på nytt, og la den nye responsen stå som egen hendelse.", "Se på denne delen. Hva vil du prøve nå?", "Du gjør alltid den samme feilen.", "Bevar forskjellen mellom første forsøk, støtte og nytt forsøk.", "Når en respons ikke passer oppgaven og et nytt forsøk er forsvarlig.", "Vent eller avslutt hvis eleven ikke ønsker et nytt forsøk.", "Stopp ved ønske om stopp eller når flere forsøk ikke er hensiktsmessige.", "Finn ett nytt steg. Ikke døm feilen."]),
      "nn-NO": localized("nn-NO", ["Gjer feilretting til ei ny handling", "Ein feil skal ikkje bli ein dom. Han kan brukast til å velje eitt nytt, tydeleg steg.", "Vis kvar eleven kan starte på nytt, og lat den nye responsen stå som eiga hending.", "Sjå på denne delen. Kva vil du prøve no?", "Du gjer alltid den same feilen.", "Ta vare på skiljet mellom første forsøk, støtte og nytt forsøk.", "Når ein respons ikkje passar oppgåva og eit nytt forsøk er forsvarleg.", "Vent eller avslutt dersom eleven ikkje ønskjer eit nytt forsøk.", "Stopp ved ønske om stopp eller når fleire forsøk ikkje er tenlege.", "Finn eitt nytt steg. Ikkje døm feilen."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-age-respect-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["10-12"],
    topic: "EMOTIONAL_SUPPORT", needs: ["HELP_REQUESTED", "STOP_OR_PAUSE"], durationMinutes: 2,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-age-respect-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Bruk språk som passer alderen", "Støtte kan være enkel uten å bli barnslig eller overentusiastisk.", "Bruk korte, nøytrale formuleringer og la eleven velge tempo.", "Vil du ta én del sammen eller prøve selv?", "Nå skal vi være flinke små lesere!", "Test om formuleringen kunne vært sagt naturlig i et vanlig klasserom.", "Når støtte gis til elever som kan være følsomme for stigma.", "Bruk elevens foretrukne ord når det er mulig og forsvarlig.", "Stopp dersom språket oppleves nedlatende eller stigmatiserende.", "Kort og respektfullt. Ikke barnslig."]),
      "nn-NO": localized("nn-NO", ["Bruk språk som passar alderen", "Støtte kan vere enkel utan å bli barnsleg eller overentusiastisk.", "Bruk korte, nøytrale formuleringar og lat eleven velje tempo.", "Vil du ta éin del saman eller prøve sjølv?", "No skal vi vere flinke små lesarar!", "Test om formuleringa kunne vore sagt naturleg i eit vanleg klasserom.", "Når støtte blir gitt til elevar som kan vere sårbare for stigma.", "Bruk eleven sine føretrekte ord når det er mogleg og forsvarleg.", "Stopp dersom språket opplevast nedlatande eller stigmatiserande.", "Kort og respektfullt. Ikkje barnsleg."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-workplace-reading-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["13-16"],
    topic: "READING", needs: ["TASK_UNCLEAR", "PLANNING"], durationMinutes: 5,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-workplace-reading-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Finn handlingen i en arbeidsinstruks", "En yrkesrettet tekst blir lettere å bruke når oppgaven, rekkefølgen og sikkerhetsordene skilles ut.", "Finn verbet, rekkefølgen og det som ikke kan hoppes over.", "Hva skal gjøres først, og hvilket ord handler om sikkerhet?", "Bare les hele teksten en gang til.", "Sammenlign instruksjonen med det faktiske arbeidssteget uten å gjøre teksten mindre autentisk.", "Når eleven leser en kort arbeidslivs- eller sikkerhetsinstruks.", "Bruk fagpersonens vurdering dersom instruksjonen krever særskilt sikkerhetskompetanse.", "Stopp hvis sikkerheten ikke kan ivaretas eller teksten er uavklart.", "Finn handling, rekkefølge og sikkerhetsord."]),
      "nn-NO": localized("nn-NO", ["Finn handlinga i ein arbeidsinstruks", "Ein yrkesretta tekst blir lettare å bruke når oppgåva, rekkjefølgja og tryggleiksorda blir skilde ut.", "Finn verbet, rekkjefølgja og det som ikkje kan hoppast over.", "Kva skal gjerast først, og kva ord handlar om tryggleik?", "Berre les heile teksten ein gong til.", "Samanlikn instruksjonen med det faktiske arbeidssteget utan å gjere teksten mindre autentisk.", "Når eleven les ein kort arbeidslivs- eller tryggleiksinstruks.", "Bruk fagpersonen si vurdering dersom instruksjonen krev særskild tryggleikskompetanse.", "Stopp dersom tryggleiken ikkje kan takast vare på eller teksten er uavklart.", "Finn handling, rekkjefølgje og tryggleiksord."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-work-message-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["13-16"],
    topic: "WRITING", needs: ["PLANNING", "TASK_UNCLEAR"], durationMinutes: 10,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-work-message-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Bygg en kort melding til skole eller arbeid", "En tydelig melding kan planlegges med mottaker, formål, nødvendig informasjon og avslutning.", "La eleven velge innholdet. Bruk planen som støtte, ikke som ferdig svar.", "Hvem skriver du til, og hva trenger personen å vite?", "Her er meldingen du skal sende.", "Se om teksten kan forkortes uten å miste nødvendig informasjon.", "Når eleven skal skrive en autentisk kort melding.", "Bruk eget skjønn om tone, personvern og hva som bør deles.", "Stopp dersom meldingen inneholder sensitiv informasjon som ikke bør behandles her.", "Mottaker, formål, nødvendig informasjon, avslutning."]),
      "nn-NO": localized("nn-NO", ["Bygg ei kort melding til skule eller arbeid", "Ei tydeleg melding kan planleggjast med mottakar, formål, nødvendig informasjon og avslutning.", "Lat eleven velje innhaldet. Bruk planen som støtte, ikkje som ferdig svar.", "Kven skriv du til, og kva treng personen å vite?", "Her er meldinga du skal sende.", "Sjå om teksten kan kortast ned utan å miste nødvendig informasjon.", "Når eleven skal skrive ei autentisk kort melding.", "Bruk eige skjønn om tone, personvern og kva som bør delast.", "Stopp dersom meldinga inneheld sensitiv informasjon som ikkje bør behandlast her.", "Mottakar, formål, nødvendig informasjon, avslutning."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-access-tool-choice-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["13-16"],
    topic: "ACCESS", needs: ["ACCESS_TOOL", "TASK_UNCLEAR"], durationMinutes: 5,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-access-tool-choice-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Velg et hjelpemiddel ut fra oppgaven", "Et tilgjengelighetsverktøy skal gjøre oppgaven mulig uten å skjule læringsmålet.", "Avklar hva eleven skal lære, og velg deretter opplesing, diktering eller annen tillatt støtte.", "Skal du øve på avkoding, eller finne innholdet i teksten?", "Bruk alltid opplesing på alt.", "Skill mellom tilgangsstøtte og støtte som endrer det som skal måles.", "Når flere hjelpemidler er mulige og formålet må avklares.", "Bruk lærerens og elevens vurdering når konstruktet er uklart.", "Stopp dersom verktøyet deler data eller endrer oppgaven på en uavklart måte.", "Finn målet først. Velg verktøy etterpå."]),
      "nn-NO": localized("nn-NO", ["Vel eit hjelpemiddel ut frå oppgåva", "Eit tilgjengeverktøy skal gjere oppgåva mogleg utan å skjule læringsmålet.", "Avklar kva eleven skal lære, og vel deretter opplesing, diktering eller anna tillaten støtte.", "Skal du øve på avkoding, eller finne innhaldet i teksten?", "Bruk alltid opplesing på alt.", "Skil mellom tilgangsstøtte og støtte som endrar det som skal målast.", "Når fleire hjelpemiddel er moglege og formålet må avklarast.", "Bruk læraren og eleven si vurdering når konstruktet er uklart.", "Stopp dersom verktøyet deler data eller endrar oppgåva på ein uavklart måte.", "Finn målet først. Vel verktøy etterpå."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
  {
    knowledgeId: "knowledge-dignity-stigma-001", revision: 1,
    audienceRoles: ["TEACHER", "PARENT", "OTHER_ADULT"], ageBands: ["13-16"],
    topic: "EMOTIONAL_SUPPORT", needs: ["STOP_OR_PAUSE", "HELP_REQUESTED"], durationMinutes: 5,
    waitIsLegitimate: true, activityIds: ["activity-simple-blend-23"], audioSpecId: "audio-dignity-stigma-001",
    variants: {
      "nb-NO": localized("nb-NO", ["Beskytt verdighet når støtte blir synlig", "Eldre elever kan oppleve støtte som stigmatiserende selv når den er faglig relevant.", "Avtal diskret hvordan støtte tilbys, og la eleven stoppe eller velge en annen form.", "Vil du at vi tar dette nå, eller finner en annen måte?", "Alle ser at du trenger ekstra hjelp.", "Vurder plassering, språk, lyd og hvem som kan se voksenkortet.", "Når støtten kan bli synlig for andre eller oppleves barnslig.", "La elevens vurdering veie tungt innen trygge og faglige rammer.", "Stopp når støtten øker ubehag, stigma eller uønsket eksponering.", "Tilby støtte diskret. La eleven velge."]),
      "nn-NO": localized("nn-NO", ["Ta vare på verdigheit når støtte blir synleg", "Eldre elevar kan oppleve støtte som stigmatiserande sjølv når ho er fagleg relevant.", "Avtal diskret korleis støtte blir tilbydd, og lat eleven stoppe eller velje ei anna form.", "Vil du at vi tek dette no, eller finn ein annan måte?", "Alle ser at du treng ekstra hjelp.", "Vurder plassering, språk, lyd og kven som kan sjå vaksenkortet.", "Når støtta kan bli synleg for andre eller opplevast barnsleg.", "Lat eleven si vurdering vege tungt innan trygge og faglege rammer.", "Stopp når støtta aukar ubehag, stigma eller uønskt eksponering.", "Tilby støtte diskret. Lat eleven velje."]),
    },
    sources: sharedSources, author: "Menneskelig redaktør – prototype",
    reviewerRoles: ["pedagogikk", "bokmål", "nynorsk", "tilgjengelighet", "alder og verdighet"],
    review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
    revisionTriggers: ["Ekstern fagreview", "Språkreview", "Co-design", "Endret aktivitet eller lyd"],
  },
] as const;

function audioSpec(unit: KnowledgePrototypeUnit): AudioPrototypeSpecification {
  const id = unit.audioSpecId;
  const nbAsset = audioAssets[id]?.["nb-NO"];
  const nnAsset = audioAssets[id]?.["nn-NO"];
  return {
    audioSpecId: id, revision: 1, semanticContentId: unit.knowledgeId, textRevision: unit.revision,
    ageBands: unit.ageBands, audioRole: "ADULT_KNOWLEDGE", constructSensitivity: "LOW",
    voiceSourcePolicy: "HUMAN_PREFERRED", rightsScope: "INTERNAL_PROTOTYPE_ONLY",
    prosodicIntent: "rolig, konkret og lite påtrengende", allowedVariationSet: [],
    userInitiated: true, replayAllowed: true, stopBehavior: "STOP_IMMEDIATELY",
    silenceAlternative: true, fallbackPolicy: "REVIEWED_TEXT",
    variants: {
      "nb-NO": {
        locale: "nb-NO", scriptText: unit.variants["nb-NO"].plainLanguageVariant,
        plainTextFallback: unit.variants["nb-NO"].plainLanguageVariant,
        ...(nbAsset === undefined ? {} : { asset: nbAsset }),
      },
      "nn-NO": {
        locale: "nn-NO", scriptText: unit.variants["nn-NO"].plainLanguageVariant,
        plainTextFallback: unit.variants["nn-NO"].plainLanguageVariant,
        ...(nnAsset === undefined ? {} : { asset: nnAsset }),
      },
    },
    review: internalPrototypeReview, staleStatus: "CURRENT",
    publicationStatus: nbAsset === undefined && nnAsset === undefined ? "SPEC_ONLY" : "INTERNAL_REVIEW",
  };
}

const audioAssets: Readonly<Record<string, Partial<Record<"nb-NO" | "nn-NO", {
  readonly assetId: string;
  readonly relativeUrl: string;
  readonly mimeType: "audio/wav";
  readonly sha256: string;
  readonly source: "CONTROLLED_SYNTHETIC_CANDIDATE";
  readonly scope: "INTERNAL_REVIEW_ONLY";
  readonly speakerLabel: string;
  readonly generatedOrRecordedOn: string;
}>>>> = {
  "audio-word-support-001": {
    "nb-NO": { assetId: "audio-asset-wait-nb-candidate", relativeUrl: "/audio/knowledge-wait-nb-candidate.wav", mimeType: "audio/wav", sha256: "faa949d44a4c82c882e749a4e6042d8a6a486f432576d9c05a1a7c0d787dbbd5", source: "CONTROLLED_SYNTHETIC_CANDIDATE", scope: "INTERNAL_REVIEW_ONLY", speakerLabel: "eSpeak Norwegian – clearly labelled synthetic candidate", generatedOrRecordedOn: "2026-07-14" },
    "nn-NO": { assetId: "audio-asset-wait-nn-candidate", relativeUrl: "/audio/knowledge-wait-nn-candidate.wav", mimeType: "audio/wav", sha256: "2697d77c869d9fe65b5f3ba86ca68721c917480394633643dee046d034fe022f", source: "CONTROLLED_SYNTHETIC_CANDIDATE", scope: "INTERNAL_REVIEW_ONLY", speakerLabel: "eSpeak Norwegian – clearly labelled synthetic candidate", generatedOrRecordedOn: "2026-07-14" },
  },
  "audio-protect-work-quiet-001": {
    "nb-NO": { assetId: "audio-asset-quiet-nb-candidate", relativeUrl: "/audio/knowledge-quiet-nb-candidate.wav", mimeType: "audio/wav", sha256: "cdc8e5f9bcd04928d38cf6a93bd395052318c22fcf5a067f8a2a6bcf07b9df60", source: "CONTROLLED_SYNTHETIC_CANDIDATE", scope: "INTERNAL_REVIEW_ONLY", speakerLabel: "eSpeak Norwegian – clearly labelled synthetic candidate", generatedOrRecordedOn: "2026-07-14" },
    "nn-NO": { assetId: "audio-asset-quiet-nn-candidate", relativeUrl: "/audio/knowledge-quiet-nn-candidate.wav", mimeType: "audio/wav", sha256: "978fec66f72be3f5646a9fce810212568103b86bef790174e5f4baafba247df5", source: "CONTROLLED_SYNTHETIC_CANDIDATE", scope: "INTERNAL_REVIEW_ONLY", speakerLabel: "eSpeak Norwegian – clearly labelled synthetic candidate", generatedOrRecordedOn: "2026-07-14" },
  },
};

export const prototypeAudioSpecifications: readonly AudioPrototypeSpecification[] =
  prototypeKnowledgeUnits.map(audioSpec);

function card(input: KnowledgeContextCard): KnowledgeContextCard { return input; }

export const prototypeContextCards: readonly KnowledgeContextCard[] = [
  card({
    contextCardId: "context-word-help-001", revision: 1, knowledgeId: "knowledge-word-support-001",
    activityIds: ["activity-simple-blend-23"], triggerEvent: "HELP_REQUESTED", oneActionOnly: true,
    waitAllowed: true, expiresOn: ["NEW_CHILD_ACTION", "NEW_SESSION_VERSION", "PAUSE", "STOP", "HANDOFF", "RECONNECT"],
    variants: {
      "nb-NO": { locale: "nb-NO", observedState: "Barnet ba om hjelp i denne økten.", uncertainty: "Systemet vet ikke hvorfor hjelpen trengs.", sayExample: "Vil du vente litt, eller ta første lyd sammen?", avoidExample: "Dette er lett. Jeg viser hele ordet." },
      "nn-NO": { locale: "nn-NO", observedState: "Barnet bad om hjelp i denne økta.", uncertainty: "Systemet veit ikkje kvifor hjelpa trengst.", sayExample: "Vil du vente litt, eller ta den første lyden saman?", avoidExample: "Dette er lett. Eg viser heile ordet." },
    }, review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
  }),
  card({
    contextCardId: "context-model-one-part-001", revision: 1, knowledgeId: "knowledge-model-one-part-001",
    activityIds: ["activity-simple-blend-23"], triggerEvent: "ADULT_REVIEW", oneActionOnly: true,
    waitAllowed: true, expiresOn: ["NEW_CHILD_ACTION", "NEW_SESSION_VERSION", "PAUSE", "STOP", "HANDOFF", "RECONNECT"],
    variants: {
      "nb-NO": { locale: "nb-NO", observedState: "Barnet har bedt om mer støtte.", uncertainty: "Systemet vet ikke hvilken del som er vanskeligst.", sayExample: "Ta første lyd. Hva kommer etterpå?", avoidExample: "Se her. Hele ordet er sol." },
      "nn-NO": { locale: "nn-NO", observedState: "Barnet har bede om meir støtte.", uncertainty: "Systemet veit ikkje kva del som er vanskelegast.", sayExample: "Ta den første lyden. Kva kjem etterpå?", avoidExample: "Sjå her. Heile ordet er sol." },
    }, review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
  }),
  card({
    contextCardId: "context-work-quiet-001", revision: 1, knowledgeId: "knowledge-protect-work-quiet-001",
    activityIds: ["activity-simple-blend-23"], triggerEvent: "QUIET_REQUESTED", oneActionOnly: true,
    waitAllowed: true, expiresOn: ["NEW_CHILD_ACTION", "NEW_SESSION_VERSION", "PAUSE", "STOP", "HANDOFF", "RECONNECT"],
    variants: {
      "nb-NO": { locale: "nb-NO", observedState: "Barnet valgte arbeidsro.", uncertainty: "Systemet tolker ikke valget som en følelse eller prestasjon.", sayExample: "Vi kan være stille mens du prøver.", avoidExample: "Du har vært stille lenge, så nå trenger du hjelp." },
      "nn-NO": { locale: "nn-NO", observedState: "Barnet valde arbeidsro.", uncertainty: "Systemet tolkar ikkje valet som ei kjensle eller ein prestasjon.", sayExample: "Vi kan vere stille medan du prøver.", avoidExample: "Du har vore stille lenge, så no treng du hjelp." },
    }, review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
  }),
  card({
    contextCardId: "context-concrete-feedback-001", revision: 1, knowledgeId: "knowledge-concrete-mastery-001",
    activityIds: ["activity-simple-blend-23"], triggerEvent: "AFTER_SUPPORT", oneActionOnly: true,
    waitAllowed: true, expiresOn: ["NEW_CHILD_ACTION", "NEW_SESSION_VERSION", "PAUSE", "STOP", "HANDOFF", "RECONNECT"],
    variants: {
      "nb-NO": { locale: "nb-NO", observedState: "En ny barnehandling er registrert etter støtte.", uncertainty: "Systemet vurderer ikke generell ferdighet.", sayExample: "Du tok neste steg selv.", avoidExample: "Du er en superleser!" },
      "nn-NO": { locale: "nn-NO", observedState: "Ei ny barnehandling er registrert etter støtte.", uncertainty: "Systemet vurderer ikkje generell dugleik.", sayExample: "Du tok det neste steget sjølv.", avoidExample: "Du er ein superlesar!" },
    }, review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
  }),
  card({
    contextCardId: "context-task-unclear-001", revision: 1, knowledgeId: "knowledge-pattern-not-person-001",
    activityIds: ["activity-generic-reading"], triggerEvent: "TASK_UNCLEAR", oneActionOnly: true,
    waitAllowed: true, expiresOn: ["NEW_CHILD_ACTION", "NEW_SESSION_VERSION", "PAUSE", "STOP", "HANDOFF", "RECONNECT"],
    variants: {
      "nb-NO": { locale: "nb-NO", observedState: "Den voksne markerte at oppgaven var uklar.", uncertainty: "Systemet vet ikke om teksten, instruksjonen eller situasjonen skapte uklarheten.", sayExample: "La oss se på akkurat denne delen.", avoidExample: "Du er dårlig på slike ord." },
      "nn-NO": { locale: "nn-NO", observedState: "Den vaksne markerte at oppgåva var uklar.", uncertainty: "Systemet veit ikkje om teksten, instruksjonen eller situasjonen skapte uklarheita.", sayExample: "Lat oss sjå på akkurat denne delen.", avoidExample: "Du er dårleg på slike ord." },
    }, review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
  }),
  card({
    contextCardId: "context-writing-plan-001", revision: 1, knowledgeId: "knowledge-plan-short-writing-001",
    activityIds: ["activity-generic-writing"], triggerEvent: "ADULT_REVIEW", oneActionOnly: true,
    waitAllowed: true, expiresOn: ["NEW_CHILD_ACTION", "NEW_SESSION_VERSION", "PAUSE", "STOP", "HANDOFF", "RECONNECT"],
    variants: {
      "nb-NO": { locale: "nb-NO", observedState: "Eleven skal starte på en kort tekst.", uncertainty: "Systemet vet ikke hvilken formulering eleven ønsker.", sayExample: "Hvem skal lese dette, og hva må de vite først?", avoidExample: "Jeg skriver hele meldingen for deg." },
      "nn-NO": { locale: "nn-NO", observedState: "Eleven skal starte på ein kort tekst.", uncertainty: "Systemet veit ikkje kva formulering eleven ønskjer.", sayExample: "Kven skal lese dette, og kva må dei vite først?", avoidExample: "Eg skriv heile meldinga for deg." },
    }, review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
  }),
  card({
    contextCardId: "context-access-choice-001", revision: 1, knowledgeId: "knowledge-access-tool-choice-001",
    activityIds: ["activity-generic-access"], triggerEvent: "ACCESS_CHOICE", oneActionOnly: true,
    waitAllowed: true, expiresOn: ["NEW_CHILD_ACTION", "NEW_SESSION_VERSION", "PAUSE", "STOP", "HANDOFF", "RECONNECT"],
    variants: {
      "nb-NO": { locale: "nb-NO", observedState: "Et tilgjengelighetsvalg skal tas.", uncertainty: "Systemet vet ikke hvilket læringsmål læreren prioriterer.", sayExample: "Skal du øve på avkoding, eller finne innholdet?", avoidExample: "Bruk alltid opplesing på alt." },
      "nn-NO": { locale: "nn-NO", observedState: "Eit tilgjengeval skal takast.", uncertainty: "Systemet veit ikkje kva læringsmål læraren prioriterer.", sayExample: "Skal du øve på avkoding, eller finne innhaldet?", avoidExample: "Bruk alltid opplesing på alt." },
    }, review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
  }),
  card({
    contextCardId: "context-dignity-stop-001", revision: 1, knowledgeId: "knowledge-dignity-stigma-001",
    activityIds: ["activity-generic-secondary"], triggerEvent: "STOP_CONSIDERED", oneActionOnly: true,
    waitAllowed: true, expiresOn: ["NEW_CHILD_ACTION", "NEW_SESSION_VERSION", "PAUSE", "STOP", "HANDOFF", "RECONNECT"],
    variants: {
      "nb-NO": { locale: "nb-NO", observedState: "Stopp eller en annen støtteform vurderes.", uncertainty: "Systemet vet ikke hvordan eleven opplever situasjonen.", sayExample: "Vil du stoppe, eller finne en annen måte?", avoidExample: "Alle ser at du trenger ekstra hjelp." },
      "nn-NO": { locale: "nn-NO", observedState: "Stopp eller ei anna støtteform blir vurdert.", uncertainty: "Systemet veit ikkje korleis eleven opplever situasjonen.", sayExample: "Vil du stoppe, eller finne ein annan måte?", avoidExample: "Alle ser at du treng ekstra hjelp." },
    }, review: internalPrototypeReview, publicationStatus: "INTERNAL_REVIEW",
  }),
] as const;

export const knowledgeAudioPrototypeRelease: KnowledgeAudioPrototypeRelease = {
  releaseId: "release-knowledge-audio-prototype-001", revision: 1, status: "INTERNAL_PROTOTYPE",
  locales: ["nb-NO", "nn-NO"], knowledgeUnits: prototypeKnowledgeUnits,
  contextCards: prototypeContextCards, audioSpecifications: prototypeAudioSpecifications,
  createdOn: "2026-07-14", humanOwner: "Produkteier",
};
