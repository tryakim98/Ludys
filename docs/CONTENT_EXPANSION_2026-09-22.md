# Innholdsutvidelse 22. september 2026

## Leveranse

To nye, komplette innholdspakker er lagt i **Innholdsverksted** på den lokale arbeidsgrenen `content/next-draft-pack`, basert på integrasjonslinjen for Installable Alpha. Verkstedet har nå ti startpakker: de åtte eksisterende og to nye forslag. De nye forslagene er ikke satt inn i den kjørbare elevkatalogen.

| Pakke | Målord → nytt ord | Avgrenset hensikt | Overføring som skal vurderes |
|---|---|---|---|
| `activity-nor-two-syllable-maane-saape-001` | måne → såpe | Bygging etter skriftmodell, med å og fire bokstaver | Metodeoverføring med større endring; begge konsonantene skifter |
| `activity-nor-two-syllable-kake-bake-002` | kake → bake | Bygging med to k-brikker og nytt første tegn | Hypotese om nær overføring; rim, ordkunnskap og skifte av ordklasse må vurderes |

Begge har separate bokmåls- og nynorskutgaver. Det gir fire nye språkvarianter, fire voksenkort, fire kunnskapstekster, fire situasjonskort og tolv lydmanus. Hvert språk har ett målordmanus, ett manus for det nye ordet og ett voksenmanus. Modellmanusene inneholder bare ordet. Det finnes ingen nye lydopptak eller påståtte uttalereviews.

Ny foreløpig klasse: `NOR-PC-TWO-SYLLABLE-SINGLE-MEDIAL-001`. Den har to representative forslag, i tråd med produksjonstaket i Masterplan 6.6 §7.3. Målet er fortsatt en tidlig bane omtrent 6–9 år; aldersmessig egnethet er et reviewspørsmål.

## Bruk i verkstedet

1. Åpne appen fra `web/index.html` via lokal webserver, eller bygg med `npm run build:installable`.
2. Åpne **Innholdsverksted** og velg «Måne og såpe – utkast» eller «Kake og bake – utkast».
3. Bytt mellom **BM** og **NN**. Les og rediger instruksjon, voksenkort, kunnskap og situasjonskort.
4. Åpne klassens faglige grunnlag under **Nytt innholdsutkast – venter på fagreview**. Her finnes uttale-/dialektgrenser, vokallengde, konsonantdobling, ordklasse, observasjonsgrenser og konkrete reviewerspørsmål.
5. Se barnets og den voksnes forhåndsvisning. Eksporter komplett JSON med **Eksporter deterministisk JSON**. JSON kan importeres igjen i denne versjonen av verkstedet.

All endring er lokal authoring. Utkast og redigeringer lagres ikke som elevdata eller økttilstand. Eksport er nødvendig for å ta vare på lokale redigeringer. De medfølgende startpakkene er lagt til i service-workerens cacheliste, men faktisk offline-omlasting er ikke bekreftet i denne leveransen; se testresultatet under.

## Pedagogisk avgrensning

Skriftmodellen er støtte. Riktig plassering av brikker kan vise kopiering etter modellen, men bekrefter verken at barnet har lest høyt eller stavet selvstendig. De nye voksen- og kunnskapstekstene gjør dette eksplisitt. Det innføres ingen lytting, uttalescore, tidsscore, nivåplassering eller effektpåstand.

Måne og såpe er substantiv i disse forslagene. Kake brukes som substantiv og bake som verb i infinitiv. Nynorskpakken bruker e-infinitiv med vilje. Tostavelsesbeskrivelsen er avgrenset til uttaler som beholder sluttvokalen; apokope og andre dialektforhold må avklares før eventuell bruk. Klassen er et norsk ortografisk utkast, og ingen engelsk CVC-regel er importert.

Støtteforslaget i revisjon 2 avklarer om barnet ønsker å prøve selv eller få hjelp. Venting, pekestøtte og opplest modell velges etter ønske og formål. Støttet gjennomføring kan gi konkrete observasjoner av hva barnet får til med hjelp, men blir ikke bevis på uavhengig lesing eller staving. Pause og stopp avslutter kortets aktualitet.

Revisjon 2 følger SKP-008/043 i [Skynja-kanon 1.0](canon/skynja-v1.0/README_FIRST.md). Voksenmanus er revidert; ordmanusene er uendret. Ingen reviewmarkør er oppgradert. Det historiske produksjonstaket og alders-/voksenfeltene over beskriver dette avgrensede forslaget, ikke universelle Skynja-regler.

## Status og proveniens

- `DRAFT`, `EXTERNAL_REVIEW_REQUIRED`, `SYNTHETIC_ONLY`, `NOT_STUDENT_BETA`.
- Proveniens: `AI_ASSISTED_CONTENT_DRAFT`; ingen menneskelig godkjenning er registrert.
- `pendingPatternReview.humanReviewed=false` og `specificationHumanReviewed=false`.
- `specificationReviewSource=null`; lokale reviewnotater og eksterne receipts er tomme.
- Alle eksisterende `nullAuthorizations` er fortsatt `false`.

De åtte historiske WP13.8-/WP13.9-pakkene er bevart som egne uendrede datakilder. Forslagene får egne aktivitets-, kunnskaps-, situasjons- og lyd-ID-er. De tilføyes bare i `createAuthoringPipeline`; elevkatalogens sammensetning er ikke endret.

Eksporten for nye forslag bruker `LUDYS-AUTHORING-DRAFT-2`, som skiller ventende menneskelig review fra det historiske `WP13.9-AUTHORING-1`-formatet. V1-pakkene beholder sitt format og sine eksisterende kontrollkrav. Import godtar begge kjente versjoner, men avviser feil kombinasjon av schema og proveniens. Å endre en reviewmarkør til `true` godkjenner ikke et forslag. Valideringen avviser også koblinger fra NN-tekst til BM-lyd og omvendt.

## Kilder kontrollert 22. september 2026

- [Måne i Bokmålsordboka og Nynorskordboka](https://ordbokene.no/bm,nn/m%C3%A5ne)
- [Såpe i Bokmålsordboka og Nynorskordboka](https://ordbokene.no/bm,nn/s%C3%A5pe)
- [Kake i Bokmålsordboka og Nynorskordboka](https://ordbokene.no/bm,nn/kake)
- [Bake i Bokmålsordboka og Nynorskordboka](https://ordbokene.no/bm,nn/bake)

Ordbøkene underbygger skrivemåte og ordbruk. De er ikke dokumentasjon på at aktivitetene eller transferklassifiseringene er pedagogisk godkjent. Den vurderingen er fortsatt åpen.

## Teknisk kontroll

- Integrasjonsgrunnlag: `04bbde331b42e2cdd6805f643150af32f530c9b4`, `integration/installable-alpha`.
- `npm run build:installable`: bestått.
- `npm run test:compiled`: **307 bestått, 0 feil**, inkludert fire nye tester for innhold, referanser, reviewstatus, eksport/import, redigering og withdrawal.
- `npm run test:pwa-contract`: **10 bestått, 0 feil**.
- Statisk kontroll, arkitekturkontroll og secretskann: bestått.
- Nettleserkontroll med Chromium 153: valg av begge nye pakker, BM/NN, barne-/voksenpreview, markering av manglende menneskelig review, JSON-eksport/import og 320 px reflow **bestått**.
- Hele `test:authoring-browser` er **ikke bestått**: offline-omlasting endte på `chrome-error://chromewebdata/` og manglende appinitialisering. Det er ikke avklart om dette skyldes den lokale headless-kjøringen eller en appfeil. Offline-delen og resterende kontroller etter den beholdes i testen og må bestå i støttet nettlesermiljø før sammenslåing.
- `npm run check`: kjørt, men stopper i eksisterende `staging:validate:compiled` med `PINNED_GIT_WINDOWS_RUNTIME_REQUIRED` på Linux. Windows-gaten er beholdt og inngår i GitHub-kontrollen; full release er ikke erklært godkjent på grunnlag av de lokale testene.

Dette er en innholdsleveranse til review. Faglig gjennomgang og menneskelig godkjenning av BM/NN, uttale og oppgavekonstrukt må foreligge før forslagene eventuelt flyttes til den kjørbare aktivitetskatalogen.

## Leveringsstatus 23. september 2026

Endringene er committet lokalt. Automatisk godkjenningskontroll avviste GitHub-push fordi den ikke fant tilstrekkelig autorisasjon for å sende kildekoden til det offentlige repoet `tryakim98/Ludys`. Ingen ny GitHub-branch eller pull request er opprettet for denne leveransen. Den klargjorte endringen kan gjennomgås lokalt; opplasting avventer eksplisitt bekreftelse.
