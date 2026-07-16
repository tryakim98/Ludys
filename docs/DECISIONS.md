# Beslutninger i fase 13

## D13-001 — Headless TypeScript først

Første grunnproof bruker TypeScript uten UI-framework. Det reduserer irreversibilitet og lar state, porter og negative tester bevises før visuell implementasjon.

## D13-002 — Ingen runtimeavhengigheter i WP13.1

WP13.1 startet uten runtime dependencies. WP13.2 legger fortsatt ikke til framework, provider eller AI; nettleserlaget bruker plattform-API-er.

## D13-003 — Ingen provider

Alle porter har lokale in-memory/null-adaptere. Firebase, Vercel, auth, database og nettverk er utsatt til en eksplisitt senere beslutning.

## D13-004 — Ingen stabil personidentitet

Sessionen har en øktbundet syntetisk ID, men ingen `childId`, `studentId`, `userId`, navn eller e-post.

## D13-005 — Human-First-grunnmur før mønsterklasse

WP13.1 beviste Human-First-kontraktene før en konkret aktivitet ble valgt.

## D13-006 — Første mønsterklasse: NOR-SIMPLE-BLEND-23

Det første engineering-proofet bruker korte, regelrette ord med to eller tre fonemer, enkle grafem–fonem-forbindelser og uten konsonantklynger, komplekse grafemer, stumme bokstaver eller dobbel konsonant.

Dette er valgt fordi målet er å isolere forbindelsen lyd → bokstav → fonologisk syntese i en liten, klart definert oppgave. Valget er et syntetisk proof, ikke en ferdig intervensjonssekvens eller B8-godkjent stimulusbank.

## D13-007 — Målord sol, transferord mus

`sol` brukes som måloppgave og `mus` som nær transfer. Begge har tre enkle grafemer, men transferordet er nytt. Proofet kan dermed skille gjennomføring av måloppgaven fra bruk av samme framgangsmåte på et nytt ord.

Ordene og fonemtranskripsjonene krever ekstern norsk språkfaglig og pedagogisk review før B8, blant annet med hensyn til dialekt, fonemrealisering, bokstavrekkefølge og alder.

## D13-008 — Den voksne bekrefter høytlesing

Systemet bruker ikke mikrofon, stemmeanalyse eller automatisk uttalevurdering. Etter korrekt ordbygging bekrefter en faktisk voksen at barnet har lest ordet. Systemet registrerer bare den eksplisitte økthendelsen og gjeldende støtteproveniens.

## D13-009 — Samme session, ulike projeksjoner

Barnesiden og voksensiden bruker samme autoritative in-memory snapshot, men viser bare rollepassende informasjon. Dette er kontraktbevis for Guided Dyad, ikke full transport eller flerbrukersynkronisering.

## D13-010 — Ingen faktisk stimuluslyd ennå

WP13.2 reserverer semantic audio IDs og policy, men inneholder ingen innspilt modelllyd. Konstruktbærende lyd er `HUMAN_REQUIRED`; opptak venter til manus, uttale og produksjonsflyt er reviewet.

## D13-011 — Browser-proof uten framework

Minimal barneside og voksenside bygges med ren TypeScript/HTML/CSS. Et senere frameworkvalg kan derfor vurderes separat uten å endre domenekontrakten.

## D13-012 — Tilgjengelighetstest er nødvendig, men ikke tilstrekkelig

Chromium-testen dekker tilgjengelighetstre, tastaturfokus, dialogfokus, 320-pikslers reflow, treffområder, reduced motion og rollelabels. Manuell skjermlesertest, co-design og brukertest er fortsatt B8-avhengig.

## D13-013 — Én felles content graph for aktivitet, knowledge, context card og audio

WP13.3 etablerer `release-knowledge-audio-prototype-001`. Voksenkortet i det vertikale proofet peker til de samme stabile `knowledgeId`, `contextCardId` og `audioSpecId` som kunnskapsbanken. BM/NN er lokaliserte varianter under samme semantiske identitet, ikke separate parallelle banker.

## D13-014 — Tolv kunnskapsenheter, åtte situasjonskort og tolv lydspesifikasjoner

Omfanget er stort nok til å prøve filtrering, review, referanselukking og ulike alders-/temaflater, men lite nok til å være reversibelt. Innholdet dekker lesing, skriving, mestring/motivasjon, trygghet/verdighet og tilgang.

## D13-015 — All kunnskap står i intern review

Kunnskapsenhetene og situasjonskortene er menneskelig eid og Human-First-vurdert, men pedagogisk, bokmåls-, nynorsk- og aldersreview er fortsatt markert `PENDING`. De er ikke B8- eller pilotgodkjent.

## D13-016 — Syntetisk lyd bare som tydelig intern kandidat

Fire statiske WAV-filer er generert for å teste Audio Content System. De er merket `CONTROLLED_SYNTHETIC_CANDIDATE` og `INTERNAL_REVIEW_ONLY`. De kan aldri resolveres som menneskelig opptak eller publisert runtime-lyd. De øvrige ti lydfamiliene er spec-only.

## D13-017 — Ingen dynamisk TTS

Prototypen bruker ikke `speechSynthesis`, TTS-provider eller dynamisk generering. Statisk kandidatasset, script-revisjon, SHA-256, kilde, scope og reviewstatus er eksplisitt. Stillhet og reviewet tekst er alltid fallback.

## D13-018 — Kunnskapsbanken er filterbar, ikke personalisert

Filtrering etter rolle, alder, tema, behov og tid endrer bare den aktuelle visningen. Valgene lagres ikke, oppretter ingen voksen- eller elevprofil og brukes ikke som anbefalingsdata.

## D13-019 — Kunnskapsbanken er ikke chatbot

Kunnskapsenheter er versjonert, kilde- og reviewmerket redaksjonelt innhold. Det finnes ingen fritekstprompt, samtaleagent, fri coaching eller runtime-generering.

## D13-020 — Evidensmotoren kan ikke godkjenne pilot

WP13.4 kan bare klassifisere dossieret som `NOT_DECISION_READY`, `DECISION_READY_FOR_OWNER` eller `REOPEN_REQUIRED`. `recruitmentAuthorized`, `realDataAuthorized` og `pilotAuthorized` er alltid `false`. Produksjonskode som forsøker å sette dem til true stoppes av static gate.

## D13-021 — Ingen readiness-score

B8-portene bruker eksplisitte krav og blokkere, ikke prosent- eller poengscore. Ett ulukket kritisk krav blokkerer den relevante milepælen. Dette hindrer at juridisk, sikkerhetsmessig eller etisk risiko gjemmes i et gjennomsnitt.

## D13-022 — Foreslått pilot er liten og staged

Kandidatrammen er én arena, 6–8 dyader i 6–9-årsgrenen, én økt per dyade og maksimalt 20 minutter. Rammen er ikke autorisert og skal først følge ekstern review og adult-only dry-run.

## D13-023 — Måling ligger utenfor appen

Proofet krever ingen apptelemetri. Pilotmålinger er foreslått som separate strukturerte observasjoner og korte etterspørsmål med tilfeldig kode. Appsessionen forblir øktbundet og slettes ved avslutning.

## D13-024 — Kritiske stoppsignaler har nulltoleranse

Tap av pause/stopp, gjenoppliving av slettet økt, skjult persondata, tydelig ubehag eller falsk relasjonell forståelse av systemet stopper eller pauser gjennomføringen. Maskinell flyt eller pilotframdrift kan ikke overstyre dette.

## D13-025 — Samtykke og assent er konservativ baseline

Før rekruttering skal planen bruke aktivt, frivillig, informert og uttrykkelig foresattesamtykke, alderstilpasset informasjon og barnets aktive assent, med enkel rett til å avstå og stoppe. Endelig juridisk og etisk klassifisering må gjøres av ansvarlige aktører.

## D13-026 — Provider og pilotmiljø forblir uvalgt

WP13.4 beskriver sikkerhets- og miljøkrav, men oppretter ikke provider, auth, database, deployment eller dataflyt. Disse krever egne senere beslutninger og separat grense fra Ludus.
