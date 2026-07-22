# WP13.8 — autentisk integrasjon av draft learning corpus og progresjonsprototype

## WP13.7C-baseline

WP13.8 ble åpnet først etter at draft-PR #4 var kontrollert, markert klar og squash-merget til `main`.

- WP13.7C merge-SHA: `0ed2f88cc0e43bdb955f641ae2f4c26aeea4341b`
- WP13.7C tree: `908747a99ab6662568d97232fd02bb7a87b1c742`
- Lokal `main` og `origin/main` var identiske.
- Ren `npm ci`, full `npm run check` og GitHub Actions-run `29878750323` besto på mergecommiten.
- WP13.8-branch: `feature/wp13-8-authentic-draft-corpus`
- Rekonstruksjonsversjon: `0.14.0-reconstructed.5`

## Recoverybegrensning og autentisk port

Det ble søkt etter `src/core/draft-learning-corpus.ts`, `src/content/corpus/wp13-8-draft-corpus.ts`, `src/application/draft-corpus-controller.ts`, `DraftCorpusController`, `NOR-PC-SINGLE-FINAL-001` og commit `f8a35e36a3416ff03aa4a9216a5b2745a895778d`.

Søket dekket gjeldende repository, alle lokale/remote refs, reachable historikk, lokale unreachable blobs/tree og GitHub commit-API. Den oppgitte committen og WP13.8-markørene fantes ikke. Unreachable objekter tilhørte en eldre pre-WP13.8-baseline og inneholdt ingen WP13.8-markør. Ingen gammel commit, packagekonfigurasjon, browserhelper eller repositoryhistorikk ble cherry-picket eller merget.

WP13.8 er derfor implementert direkte mot den verifiserte WP13.7C-main-linjen. Dagens lifecycle-, app-, PWA-, browsercleanup- og testarkitektur er bevart.

## Schema og statusgrenser

`src/core/draft-learning-corpus.ts` definerer typed kontrakter for:

- aktivitet, klasse, localevariant, stimulus og transferklassifisering
- voksenkort med `understand`, `doOrSay`, `avoid`, `deepen`, synlig WAIT og eksplisitt utløp
- knowledge-, context- og audio-referanser
- støtteplan og separate target-/supported-retry-/transferhendelser
- `CURRENT`, `STALE`, `SUPERSEDED` og `WITHDRAWN`
- personfri, kun restriktiv content-policy
- tre voksenstyrte progresjonskanter

Alle corpusvarianter har disse bindende markørene:

- `status = DRAFT`
- `reviewStatus = EXTERNAL_REVIEW_REQUIRED`
- `evidenceStatus = SYNTHETIC_ONLY`
- `betaStatus = NOT_STUDENT_BETA`
- `timingInterpretation = FORBIDDEN`

Ingen aktivitet har `PUBLISHED` eller `APPROVED_FOR_BETA`. Schemaet har ingen elevprofil, samlet score, timingtolkning, automatisk nivåplassering, taleanalyse, mikrofon, kamera, runtime-AI, auth, database eller transport.

## Fire foreløpige norske mønsterklasser

1. `NOR-PC-SINGLE-FINAL-001` — enkel sluttkonsonant
2. `NOR-PC-DOUBLE-FINAL-001` — dobbel sluttkonsonant
3. `NOR-PC-CONSONANT-CLUSTER-001` — konsonantforbindelse
4. `NOR-PC-NG-GRAPHEME-001` — `ng`-sekvens

Hver klasse har selvstendige BM- og NN-tekster om norsk grafem–fonem-egnethet, målform, uttale-/dialektbegrensning, vokallengde, konsonantdobling, ortografisk og morfologisk kompleksitet, hva aktiviteten undersøker, hva den ikke kan bevise, stimulusrasjonale og åpne reviewerspørsmål.

Alle klassene har `frameworkBoundary = NORWEGIAN_ORTHOGRAPHIC_REVIEW_NOT_IMPORTED_CVC`. Systemet vurderer aldri uttale eller dialekt automatisk.

## Åtte aktiviteter og PEX-A01-status

| Klasse | Aktivitet | Stimulus | Konstrukt | Intern beslutning | Grense |
|---|---|---|---|---|---|
| Enkel slutt | `activity-nor-single-final-ris-sil-001` | ris → sil | `BUILD_BLEND_ENCODE` | `KEEP_WITH_CHANGES` | avgrenset nær transfer |
| Enkel slutt | `activity-nor-single-final-fin-bil-002` | fin → bil | `BUILD_BLEND_ENCODE` | `KEEP_AS_DRAFT_WITH_LIMITS` | framgangsmåte med større transferendring, ikke identisk grafemmønster |
| Dobbel slutt | `activity-nor-double-final-katt-hatt-001` | katt → hatt | `DECODE_REPAIR_TRANSFER` | `KEEP_WITH_CHANGES` | draft nær transfer |
| Dobbel slutt | `activity-nor-double-final-kopp-hopp-002` | kopp → hopp | `DECODE_REPAIR_TRANSFER` | `KEEP_WITH_CHANGES` | draft nær transfer |
| Konsonantforbindelse | `activity-nor-cluster-pris-gris-001` | pris → gris | `BUILD_BLEND_ENCODE` | `KEEP_WITH_CHANGES` | draft nær transfer |
| Konsonantforbindelse | `activity-nor-cluster-fisk-vest-002` | fisk → vest | `BUILD_BLEND_ENCODE` | `CHANGES_REQUIRED` | ulike finale klynger; review-only |
| Ng-sekvens | `activity-nor-ng-sang-lang-001` | sang → lang | `DECODE_REPAIR_TRANSFER` | `KEEP_AS_DRAFT_WITH_LIMITS` | avgrenset drafttransfer |
| Ng-sekvens | `activity-nor-ng-ring-seng-002` | ring → seng | `DECODE_REPAIR_TRANSFER` | `CHANGES_REQUIRED` | start og vokal endres; review-only |

Semantiske ID-er og stimuluspar er bevart. Senere stimulus- eller konstruktendring må bruke revisjon, supersession eller ny semantisk ID etter menneskelig vurdering.

## BM og NN

Alle åtte aktiviteter har to eksplisitte redaksjonelle varianter: totalt 16 localevarianter. Målformene bruker samme stabile semantiske ID-er, men egne tekster for barnesteg, tilbakemelding, voksenkort, knowledge, context og klassebeskrivelse. Runtimeoversettelse og stille fallback finnes ikke.

Kontrakttestene krever eksakt `nb-NO` eller `nn-NO`, full referanselukking og selvstendige variantobjekter. Browserproofet bytter fra BM til NN før sessionstart og kontrollerer NN-tekst uten BM-fallback.

## Feedback, voksenkort og Human-First

Feedback beskriver bare konkret handling i gjeldende lokale session. Target, støttet forsøk og transfer har egne teksttilstander og hendelser. Det gjøres ingen påstand om identitet, motivasjon, følelse, diagnose, generell læring eller framtidig ytelse.

Voksenkortene er korte, avvisbare og firelagede. WAIT er legitimt og synlig. En voksen velger eventuelt ett hint eller en modell; systemet velger aldri modellstøtte og gjør ingen automatisk plassering. STOP og voksenautoritet dominerer.

## Støtteproveniens og evidens

Hver aktivitet støtter `NONE`, `PROMPT` og `MODEL_REQUIRES_ADULT`.

- første targetforsøk registreres som `TARGET / INDEPENDENT`
- voksenmodell registreres som `MODELLED_PRACTICE`
- nytt forsøk etter hint eller modell registreres separat som `SUPPORTED_RETRY`
- transfer registreres som `TRANSFER / TRANSFER_SEPARATE`

Modellert praksis kan ikke omskrives til uavhengig evidens. Hendelsene er kun sessionbundne, uten samlet score eller timingfelt.

## Knowledge, context og audio

Leveransen inneholder:

- 8 stabile knowledge-ID-er med BM-/NN-varianter, totalt 16 objekter
- 8 stabile context-ID-er med BM-/NN-varianter, totalt 16 objekter
- 3 audio specs per aktivitet per locale, totalt 48 spesifikasjoner

Audio er bare spesifikasjon. Alle har `takeRevision = 0`, `rightsScope = DRAFT_SPEC_NOT_RECORDED`, brukerstart, STOP-immediate og stillhetsalternativ. Target- og transfermodell er konstruktbærende og har `voiceSourcePolicy = HUMAN_REQUIRED`. Ingen opptak, autoplay, talesyntese eller taleanalyse er lagt til.

## Lifecycle, withdrawal og no-resurrection

Bare effektiv `CURRENT` kan kjøres. Klasse-status dominerer aktivitet-status. `STALE`, `SUPERSEDED` og `WITHDRAWN` blokkerer start og videre aktivitet.

Den personfrie content-policyen kan bare skjerpe status. En senere tom eller svakere policy kan ikke gjenopprette `CURRENT`. Vanlig brukerflyt har ingen lifecycle-mutasjonskontroll.

Service workeren holder content-policyen i en separat `ludys-content-policy-1`-cache. Dette er ikke sessiondatabase eller profil: policyen inneholder bare revision, klasse-/aktivitets-ID og restriktiv status. Shellcache inneholder fortsatt ingen sessionstate. Nettverksoppdatering kan skjerpe policy uten ny apprelease, og cached policy gir fail-closed offline reload. Browserproofet trekker en aktivitet tilbake, går offline, reloader og beviser at aktiviteten fortsatt er `WITHDRAWN`, blokkert og ikke gjenopplivet.

STOP avbryter forespurt lydspesifikasjon og fjerner ventende feedback. DELETE og eksisterende session-no-resurrection er uendret.

## Progresjonsprototype

Tre draftkanter er representert:

1. enkel sluttkonsonant → dobbel sluttkonsonant
2. enkel sluttkonsonant → konsonantforbindelse
3. konsonantforbindelse → `ng`-sekvens

Alle har `decisionAuthority = ADULT`, `automaticPlacement = false`, `aggregateScoreRequired = false` og `status = DRAFT_EXTERNAL_REVIEW_REQUIRED`. De er ikke validert rekkefølge og brukes ikke til automatisk plassering.

## Integrasjon i app og PWA

`DraftCorpusController` er en content-controller inne i eksisterende `SyntheticAppNavigationController`. Den er ikke en alternativ entrypoint, sessionrepository eller state machine. Eksisterende autoritative session, rolleprojeksjoner, WAIT, pause, recovery, STOP, DELETE, PWA-shell, BM/NN og browsercleanup er bevart.

Orienteringen viser corpusoversikt, alle fire klasser, draftstatus, modus og valgbare aktiviteter. Barnesiden viser valgt aktivitet, target/transfer og sessionbundet feedback. Voksensiden viser aktuelt voksenkort, knowledge/context og separate støtte-/forsøkshendelser. `CHANGES_REQUIRED` skjules og blokkeres i vanlig syntetisk modus, men vises som review-only i reviewmodus.

## Tester og browserproof

- Ren `npm ci`: bestått, `0` sårbarheter rapportert.
- Kompilerte tester: `97/97` bestått.
- Browsercleanup-enhetstester: `10/10` bestått.
- PWA-/service-worker-kontrakttester: `9/9` bestått.
- Eget WP13.8 corpus-browserproof: `10/10` sammenhengende stressrunder bestått.
- Samlet browserproof: `8/8` i tre komplette fullregresjonsrunder bestått.
- `npm run check`: `3/3` komplette runder bestått.
- `git diff --check`: bestått.
- Restprofiler, hengende proofservere og profilbundne browserprosesser: `0`.

Corpusproofet dekker corpusoversikt, fire klasser, draftstatus, tillatt aktivitet, target, voksenkort, støtteproveniens, transfer, målformbytte, reviewmodus, synlig `CHANGES_REQUIRED`, blokkering i normal modus, withdrawal, offline reload uten resurrection, 320 px reflow, 2× zoom, tastatur, AX-tre og reduced motion.

## Eksplisitte ikke-påstander og åpne reviewbehov

WP13.8 hevder ikke:

- ekstern språkfaglig, BM-, NN-, uttale- eller dialektgodkjenning
- validert konstrukt eller progresjon
- effekt, generell læring eller elevnivå
- publisert innhold, studentbeta eller pilotautorisasjon
- ferdige lydopptak eller masseinnspilling
- produksjonsdeployment, auth, database, transport eller ekte data

Åpent: ekstern norsk språkfaglig review, separat BM-/NN-review, uttale-/dialektreview, konstrukt- og stimulusreview, alders-/verdighet/co-design, tilgjengelighetsreview med mennesker, progresjonsvalidering, audio casting/rights/recording og formell publiseringsbeslutning.

## Gjenværende gap

GAP-010 er redusert av autentisk teknisk integrasjon, men kan ikke lukkes som publisert eller validert innhold uten eksterne reviews. GAP-009 full lydflyt, WP13.9 authoring/content/audio-pipeline, WP13.10 reliability/security/release-hardening, betaoperasjon, providergrenser og alle eksterne receipts gjenstår.

## Sluttstatus

`WP13_8_AUTHENTICALLY_INTEGRATED`
