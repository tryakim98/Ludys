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

## D13-027 — Browserproof bruker lokalt installert Chromium på tvers av plattformer

Browserproofene resolver først `LUDYS_BROWSER_PATH`, `CHROME_PATH` eller `CHROMIUM_PATH`, deretter kjente Edge/Chrome/Chromium-stier og PATH på Windows, Linux og macOS. Resolveren bruker bare Node-standardbiblioteket, laster ikke ned nettleser og gjør ikke manglende browser til bestått test.

## D13-028 — WP13.7A lifecycle er en isolert state machine

Det nye livsløpet ligger separat fra eksisterende læringsproof. Pure transitions, typed errors, optimistic version guard og tombstone beviser create/reconnect/recovery uten å blande produktcopy eller senere providerbeslutninger inn i domenet.

## D13-029 — STOP og DELETE dominerer reconnect og recovery

Autoritativ STOP kan ikke overskrives av ikke-terminal state, selv med et kunstig høyere versjonsnummer. DELETE fjerner state fra repositoryet og etterlater minimal syntetisk tombstone. Reconnect og recovery kan aldri omgå disse terminalene.

## D13-030 — Rolleprojeksjoner er eksplisitte view models

Application-controlleren returnerer egne child/adult view models i stedet for rå intern state. Barnets view mangler session reference, versjon og voksenfelt. Den voksnes view mangler child cue, og etter sletting fjernes session reference.

## D13-031 — Lifecycle-copy og UI er draft proof

All ny UI-copy ligger sentralt i korte BM/NN-varianter og er merket `DRAFT_TECHNICAL_COPY — subject to Product Excellence review`. Proof-siden er ikke endelig visuell identitet, alderstilpasning eller ferdig WP13.7-app.

## D13-032 — Operations-kit er adult-only og har eksakt 27 × 2 språkprodukter

WP13.11 har nøyaktig 27 semantiske artefakttyper og separate BM-/NN-filer (`nb`/`nn`) for hver. Det finnes ingen fallback eller runtimeoversettelse. Begge målformer må ha samme status, autorisasjon, tillatt/forbudt bruk og withdrawalgrense, men egne redaksjonelle tekster. Alt står i menneskelig review; 0 receipts betyr at ingen språkvariant kan merkes godkjent.

## D13-033 — Før-B8-måling gjelder operasjon, ikke mennesker eller læring

Bare voksen onboarding, instruksjonsforståelse, operatørbelastning, tekniske koder, accessibility/content review og drillresultater er tillatt i adult-only syntetisk dry-run. Elevytelse, hastighet, profil, progresjon, engagement, inferens, readiness og samlet score er teknisk blokkert og `NOT_COLLECTED`. Treg onboarding er ikke vokseninkompetanse, og teknisk feil er ikke pedagogisk evidens.

## D13-034 — Lokale funn er minne-only og identifierguardet

Dry-run-funn bruker lukkede kategorier, kontrollert kode og maksimalt 160 tegn. Sannsynlig e-post, telefon, lange tallsekvenser, URL, navn og skoleidentifikator avvises før lagring. Guard er en avgrenset sikkerhetskontroll, ikke en påstand om perfekt PII-deteksjon. Eksport krever eksplisitt lokal handling og kan slettes uten gjenoppliving.

## D13-035 — OPERATIONS er en separat rollbackkomponent

Releasekontrakten versjonerer app, content, knowledge, audio og operations uavhengig. Operationsrollback er append-only og fail-closed for unknown, withdrawn, inkompatibel og no-op revisjon. Rollback eller withdrawal kan ikke reaktivere slettet dry-run-state eller skjule en målformgrense.

## D13-036 — WP13.12A anbefaler capability, men foretar ingen eierbeslutning

Det tekniske minimumet er en funksjonsutstedt, opak og kortlivet capability bundet til én syntetisk økt, én rolle, eksakt authority generation og forventet revisjon. Den oppretter ingen stabil eller kryssøkt provideridentitet. `recommended` betyr ikke `selected`, `approved` eller `activated`; alle eierfelt forblir `PENDING_OWNER_ACTION`.

## D13-037 — Regional kandidat er europe-north1 uten regionlås

`europe-north1` er anbefalt fordi dagens offisielle tabeller viser regional Firestore og Cloud Functions 2nd gen i samme region. Firestore-lokasjon er immutable etter opprettelse, derfor er `REGION_LOCK_NOT_EXECUTED = true` en hard grense. Lagring i Finland avgjør ikke DPA, supportdata, tredjelandstilgang, DPIA eller skoleeieraksept.

## D13-038 — Direkte klientskriv og providerkontoidentitet er ikke minimum

Klienten kan bare sende lukket kommando og motta minimum rolleprojeksjon. En autoritativ handler validerer capability, replay, revisjon og authority generation, kaller providerfri pure core og utfører lagring. Firebase Anonymous Auth er ikke anbefalt fordi det innfører UID-/kontolivsløp og separat Auth-behandling som ikke er nødvendig for én syntetisk økt.

## D13-039 — TTL er backstop; eksplisitt sletting og STOP dominerer

TTL regnes aldri som umiddelbar sletting. Autoritativ eksplisitt sletting fjerner state, tilbakekaller capabilities og skriver minimal tombstone. Backup/PITR er av i anbefalt baseline. STOP, DELETE, authority generation og tombstone hindrer gjenoppliving.

## D13-040 — Providerbeslutning er en egen rollbackkomponent

`PROVIDER_DECISION` versjoneres og rulles tilbake separat fra app, content, knowledge, audio og operations. Beslutningsflate og eksport har ingen aktiveringskontroller. Ingen kode i WP13.12A oppretter konto, prosjekt, database, function, billing, secret eller deployment.
