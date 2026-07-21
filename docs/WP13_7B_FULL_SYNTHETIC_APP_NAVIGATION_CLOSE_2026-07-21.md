# WP13.7B — full syntetisk appnavigasjon — sluttrapport

Dato: 2026-07-21
Sluttstatus: `WP13_7B_COMPLETE`

## Baseline

- Branch ved start: `main`
- Commit: `b0acef375b2fd933095bcb7e4cfccabdeacc8c4c`
- Tree: `90e27c8dbb459ba427987ec7dcc9895fb77b32e7`
- Lokal `main` samsvarte med `origin/main` etter fetch.
- Arbeidstreet var rent.
- Baselinekontrollen besto med 72/72 kompilerte tester og 5/5 browserproof.

## Faktisk scope

WP13.7B gjør appens normale `/web/index.html` til inngangen for en komplett lokal syntetisk reise. En ny application-controller orkestrerer den eksisterende WP13.7A-lifecycle-controlleren og det eksisterende ordproofet. Repository, ID-generator, reconnect-adapter og observability er fortsatt lokale in-memory-implementasjoner.

Ingen alternativ lifecycle-state machine ble opprettet. Én autoritativ session gir separate rolleavgrensede view models. Aktivitetens bokstavvalg og støtteproveniens er sessionbundne aktivitetsdata, ikke en ny livssyklussannhet eller stabil personprofil.

Repositoryversjonen følger den eksisterende rekonstruksjonslinjen og er oppdatert fra `0.14.0-reconstructed.2` til `0.14.0-reconstructed.3` i package-metadata og identitetsporten.

## Implementert appreise

Den synlige reisen dekker:

1. velkomst og tydelig syntetisk disclosure
2. eksplisitt lokal sessionopprettelse
3. eksplisitt barn-/voksenvalg
4. loading og orientering
5. konkret ordaktivitet
6. rollebytte uten kopiering av state
7. WAIT, menneskestyrt hjelp, avvisbart voksenkort og arbeidsro
8. pause/resume
9. reconnect samt stale/recovery
10. terminal STOP og reconnect uten gjenoppliving
11. fullføring og nøktern oppsummering
12. sletting med tombstone og reconnect uten gjenoppliving
13. ny separat syntetisk session med ny ID og tom aktivitetsstate

## Barn- og voksenprojeksjoner

Barnets view model viser konkret oppgave, tilgjengelige bokstaver, egne konkrete valg, nøktern teknisk feedback og tillatte kontroller. Den eksponerer ikke sessionreferanse, voksenkort, observability-versjon, governance, B8, score, profil eller inferenser.

Den voksnes view model viser observerbar lifecycle-state, lokal sessionreferanse, versjon, barnets konkrete valg, ett avvisbart kort, kunnskapsreferanse, eksplisitt behov for menneskelig vurdering og synlig provenance for voksenhandlinger. Den evaluerer ikke den voksne og oppretter ingen skjult kompetanseprofil.

## Human-First-bevaring

- `WAIT` er en eksplisitt handling og intervention er ikke automatisk.
- Arbeidsro viser at systemet kan være stille.
- Modell, vent eller avvisning kommer fra den voksne og vises med provenance.
- Voksenkortet kan avvises.
- STOP dominerer aktivitet og reconnect gjenoppliver ikke STOP/DELETE.
- Teksten hevder ikke personlighet, relasjon, følelse, motivasjon, diagnose eller framtidig prestasjon.
- Ingen manipulerende gamification, stabil identitet eller kryssøktprofil finnes.
- BM og NN er separate eksplisitte bundles; det finnes ingen stille fallback.

De gjenbrukte innholdskontraktene har eksisterende menneskelig eierskap og reviewmetadata. WP13.7B fabrikerer ingen ny fag-, språk-, co-design- eller tilgjengelighetsreceipt.

## Tilgjengelighetsproof

Det nye full-reise-browserproofet bruker tastaturaktivering gjennom hovedreisen og kontrollerer:

- skip-lenke og synlig fokus
- semantiske overskrifter og landemerker
- tilgjengelige navn og live status/alert
- fokusflytting ved pause, stop og oppsummering
- tilgjengelig stopphandling
- 320 px reflow og kontrollmål på minst 44 × 44 CSS-piksler
- 2× zoom uten horisontalt funksjonstap i proofet
- `prefers-reduced-motion`
- tilgjengelighetstreet for sentrale navn og roller

Dette er maskinelt internt proof. Full WCAG-konformitet, manuell skjermlesergodkjenning og ekstern tilgjengelighetsreview påstås ikke.

## Tester og browserproof

- Kompilerte tester: 79/79.
- Browserproof: 6/6 per komplett kontrollrunde.
- Nytt WP13.7B-browserproof kjørt minst fem ganger.
- Alle browserproof kjørt i minst to komplette runder.
- `npm run check` kjørt i to komplette grønne runder.
- Rekonstruksjonsport, Human-First static check, arkitekturgrense, secretskann og `git diff --check` består.
- Stabil Windows Edge-resolver og den delte cleanup-hjelperen brukes; ingen alternativ cleanup er kopiert.

## Eksplisitte ikke-påstander

WP13.7B åpner eller beviser ikke:

- Firebase, database, provider eller ekstern transport
- produksjonspersistens eller faktisk to-enhetssynkronisering
- autentisering, stabil brukeridentitet eller personlig kontinuitet
- analytics, crash reporting eller runtime-AI
- ekte brukerdata, studentbeta eller produksjonsdeployment
- installérbar PWA/offline-shell
- manuell fag-, språk-, co-design-, sikkerhets- eller tilgjengelighetsgodkjenning
- B8-beslutningsklarhet eller pilotautorisasjon

## Gjenværende gap

PWA/offline-shell, produksjonstransport/-persistens, auth/personlig kontinuitet, lydflyt gjennom hele appen, manuell AT-/co-design-review, reliability/security/release-hardening og alle eksterne B8-/pre-beta-receipts gjenstår. Disse er fortsatt lukket for implementasjon uten senere eksplisitt scope.

## Sluttstatus

`WP13_7B_COMPLETE`
