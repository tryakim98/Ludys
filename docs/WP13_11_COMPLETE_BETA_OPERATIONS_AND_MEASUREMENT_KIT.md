# WP13.11 – Complete Beta Operations and Measurement Kit

- Dato: 2026-07-22
- Klassifisering: `ADULT_ONLY_SYNTHETIC_DRY_RUN`
- Operations-kit: `READY_FOR_ADULT_ONLY_DRY_RUN`
- Eksterne receipts: `0`
- B8: `NOT_DECISION_READY`
- Studentbeta: `NOT_AUTHORIZED`
- Rekruttering: `NOT_AUTHORIZED`
- Produksjon: `NOT_AUTHORIZED`

## 1. Dom og faktisk baseline

WP13.11 er implementert direkte på autentisk WP13.10-commit `c5e47fd1e25f67a38376d58321a6a409f2fed44d` med full tree-SHA `ca6d2825b5482930085d490205510fd8b9c09fab`. Lokal og hentet remote WP13.10-head samsvarte, `origin/main` inneholdt ikke WP13.10, arbeidstreet var rent, én worktree var registrert, og ingen Git-lås eller samtidig filendring ble funnet. PR-metadata var ikke tilgjengelig via anonymt GitHub-API eller tilkoblet GitHub-app; remote branch og merge-ancestry viste derfor at WP13.11 skulle være stacked over `feature/wp13-10-reliability-security-release-hardening`.

Pre-change `npm run check:release` ble først blokkert i clean-copy-leddet fordi sandboxen ikke kunne lese brukerens npm-cache. Den ufullførte kjøringen ble ikke rapportert som bestått. Hele wrapperen ble så kjørt med nødvendig cachetilgang og bestod: 130/130 kompilerte tester, 10/10 browser-cleanup, 10/10 PWA-kontrakt, 13/13 WP13.10 hardening, hele browsermatrisen, sikkerhet, ytelse, to clean-copy-builds med digest `afddb44dd597180f9f8dea50d05546ba85dad43642cb3ef01492ca05861b2213`, metadata og audit med 0 sårbarheter.

Baselineavvik: `0`.

## 2. Historiske referanser

Ingen historisk WP13.11-commit, tree, kode eller resultat ble funnet eller importert. Arbeidsordrens krav og dagens autentiske repository var autoritative. Historisk `0.13.1` er fortsatt gapinformasjon og ikke nåværende kodeidentitet eller completion evidence.

## 3. Implementert domenemodell

`src/core/beta-operations.ts` definerer en ren, providerfri kontrakt for artefakter, målformer, måleordbok, forbudte mål, datainventar, 23 dry-run-steg, autorisasjon, identifierguard, deterministisk JSON og integritetsvalidering. Core importerer bare core.

`src/application/beta-operations-controller.ts` implementerer en lokal voksen-only controller for WAIT, hjelp, pause, STOP, SEV0, deletion/no-resurrection, rollbackresultat, withdrawal, korte guardede funn og deterministisk eksport. State ligger bare i minnet. Det opprettes ingen stabil child-, student-, user- eller voksenprofil.

## 4. De 27 semantiske artefaktene

1. `TEACHER_GUIDE`
2. `FIVE_MINUTE_ONBOARDING`
3. `INSTALL_START_GUIDE`
4. `SESSION_SCRIPT`
5. `ROLE_ALLOCATION`
6. `PRE_SESSION_CHECKLIST`
7. `IN_SESSION_OBSERVATION`
8. `POST_SESSION_CONVERSATION`
9. `ADULT_LOAD_FORM`
10. `ACCESSIBILITY_LOG`
11. `ERROR_REPORT`
12. `INCIDENT_CARD`
13. `STOP_CARD`
14. `DELETION_ROUTINE`
15. `SUPPORT_FAQ`
16. `KNOWN_ISSUES`
17. `RELEASE_NOTES`
18. `ROLLBACK_CARD`
19. `CONTENT_WITHDRAWAL_CARD`
20. `PARENT_INFORMATION_DRAFT`
21. `STUDENT_INFORMATION_DRAFT`
22. `CONSENT_TEMPLATE_DRAFT`
23. `ASSENT_TEMPLATE_DRAFT`
24. `DATA_INVENTORY`
25. `MEASUREMENT_DICTIONARY`
26. `AMENDMENT_LOG`
27. `DECISION_LOG`

Hver type har nøyaktig én `nb`- og én `nn`-fil under `release/wp13-11/artifacts/`. Alle obligatoriske metadatafelt er til stede. Det finnes ingen runtimeoversettelse eller språkfallback. Manglende, duplisert eller semantisk ulik målform feiler validatoren.

Alle artefakter er review-gated. Ingen målform er merket menneskelig godkjent. De fire deltakerrettede utkastene er alltid `DRAFT_NOT_AUTHORIZED_FOR_STUDENT_USE` og lister eksplisitt at de ikke er rekrutteringsmateriell, endelig informasjon, gyldig consent/assent, behandlingsgrunnlag, DPIA, juridisk eller etisk godkjenning, skoleeier- eller B8-vedtak eller kontakt-/pilotautorisasjon.

## 5. Operasjonsflate og adult-only dry-run

`Betaoperasjon` er integrert i eksisterende app og designsystem. Flaten viser operationsrevisjon, 27/27, BM/NN (`nb`/`nn`), receipts 0, B8, studentbeta og produksjonsgrensen, artifact-målgruppe/review/tillatt/forbudt bruk, 23-stegs dry-run, lokale funn, fem driller, lokal eksport, sletting og alle teknisk blokkerte mål.

Dry-run-en dekker eksplisitt operativ avgrensning, målform, onboarding, før-sjekk, syntetiske roller, syntetisk session, WAIT, hjelp, pause, STOP, teknisk feil, incident, deletion, no-resurrection, rollback, withdrawal, tre tillatte finding-typer, eksport, recordsletting og ny eksport uten slettede records. Den kan ikke simulere barn, samtykke, assent, receipt, B8 eller studentbeta.

## 6. Måleordbok og forbudte mål

Tillatte mål er nøyaktig:

- `adult_onboarding_minutes`
- `adult_instruction_understanding`
- `adult_operator_load`
- `accessibility_finding`
- `content_review_finding`
- `technical_error_code`
- `incident_class`
- `rollback_drill_result`
- `stop_drill_result`
- `deletion_drill_result`
- `withdrawal_drill_result`

De kan bare brukes i `ADULT_ONLY_SYNTHETIC_DRY_RUN`, inneholder ikke person- eller studentdata og kan ikke kobles mellom økter eller tolkes som kompetanse, prestasjon, effekt, utvikling, motivasjon, evne, diagnose eller pilotreadiness.

De 12 forbudte målene i arbeidsordren står alle som `NOT_COLLECTED` og `technicallyBlocked: true` på tvers av domain, controller, schema, UI, eksport, storage, logger, fixtures, testdata, dokumentasjon og release. Validatoren avviser også skjulte student-, engagement-, score- og readiness-lignende mål i den tillatte ordboken.

## 7. Datainventar, lokal registrering og identifierguard

Datainventaret skiller eksplisitt 13 tillatte syntetiske/lokale klasser fra 25 forbudte klasser. Tillatt state ligger i minne; bare eksplisitt eksport oppretter en lokal fil. Ekte elev-, foresatt-, lærer- og skoledata, navn, skole, kontaktdata, identifikatorer, helse/diagnose, medier, fritekst om barn, full sessionpayload, stabil identitet, kryssøktkobling, analytics, replay, heatmaps og fingerprinting er `PROHIBITED`, `NOWHERE`, `NOT_COLLECTED` og avvises før lagring.

Kort fritekst er begrenset til 160 tegn. Identifierguard blokkerer sannsynlig e-post, telefon, lange tallsekvenser og URL. Mulig personnavn eller skoleidentifikator varsles og avvises. Avvist tekst returneres ikke som normalisert lagringsverdi, lagres ikke og sendes ikke. Kontrollen påstår ikke perfekt PII-deteksjon.

## 8. SEV0, STOP, deletion, rollback og withdrawal

- SEV0 blokkerer videre syntetisk operasjon, stopper dry-run og pending UI, holder audio stoppet, fjerner findings og beholder bare en minimal teknisk status.
- STOP er terminal for den aktuelle dry-run-en, fjerner pending hjelp og krever ny eksplisitt dry-run.
- Deletion sletter findings og sessionstate, beholder bare no-resurrection-markør og gjør reconnect ikke-gjenopplivende.
- Releasekomponenten `OPERATIONS` er lagt til ved siden av APP, CONTENT, KNOWLEDGE og AUDIO. Rollback er uavhengig, append-only og avviser unknown, withdrawn, inkompatibel og no-op revisjon.
- Withdrawal gjør den berørte operationsartefakten utilgjengelig og kan ikke skjules av målformfallback.

## 9. Lokal eksport

Eksporten opprettes bare etter eksplisitt voksenhandling som lokal JSON/Blob. Identisk input gir identiske bytes. Pakken inneholder versjoner, valgt artifact, tillatte findings, drillresultat, autorisasjonsgrenser og integritetsmetadata. Den inneholder ikke navn, kontaktdata, skole, diagnose, medier, full sessionpayload, elevresultat, stabil ID, B8-autorisasjon, receipt eller signatur. Ny eksport etter sletting inneholder ikke slettede records.

## 10. Offisielt kilderegister

Kilderegisteret bruker bare re-verifiserte primærkilder fra Datatilsynet, Utdanningsdirektoratet, W3C og NIST. De strukturerer senere DPIA-, skolepersonvern-, transparens-, tilgjengelighets- og incidentreview. Hver kilde har `cannotDecide` og ny verifikasjonsfrist. Registeret kan ikke bevise juridisk godkjenning, behandlingsgrunnlag, fullført DPIA, skoleeieransvar, WCAG-konformitet, elevbruk eller B8.

## 11. Browser-, tilgjengelighets- og PWA-bevis

Repositoryets faktiske lokale Edge/Chromium-origin beviser operasjonsflate, 27 valg, separate BM/NN-renderinger (`nb`/`nn`), manglende målform som feil, deltakerutkaststatus, identifierguard, alle driller, eksport og sletting. Samme proof dekker 320 px, 200 % zoom, tastatur, synlig og logisk fokus, emulert touch, reduced motion, forced colors, AX-tre, tilgjengelig STOP, stoppet audio og null eksterne kall.

Evidensnivå er `ACTUAL_BROWSER_ORIGIN_PROOF` + `HEADLESS_BROWSER_PROOF`; 320 px/touch er `DEVICE_EMULATION`. Automatisert tilgjengelighetsproof er ikke manuell review eller WCAG-konformitet. Firefox, Safari/iOS, fysiske enheter og manuell skjermleser-/AT-review er `NOT_TESTED` eller `MANUAL_REVIEW_REQUIRED` som angitt i `release/wp13-11/platform-matrix.json`.

Service-worker-shellet inkluderer de nye operationsmodulene i samme versjonerte, same-origin-only cache. Det lagrer ikke findings, sessionstate, persondata eller eksport og introduserer ingen bakgrunnssynkronisering.

## 12. Security, supply chain og ytelse

WP13.10-gatene er bevart: CSP, sikre headere, secret scan, no-tracker, no-analytics, no-eval, ingen dynamisk kode, ingen browsersecrets, same-origin, SBOM, lisenser, audit, checksums, provenance, reproduserbar build og ytelsesbudsjett. Runtime dependencies er fortsatt 0.

Målte WP13.11-verdier i siste komplette kontrollrunde:

| Måling | Resultat | Uendret budsjett |
|---|---:|---:|
| Compiled runtime JavaScript | 568319 B | 600000 B |
| Browser entry JavaScript | 25045 B | 30000 B |
| CSS | 17892 B | 30000 B |
| HTML | 1312 B | 3000 B |
| Statisk illustrasjon | 841 B | 50000 B |
| Teknisk audio | 60088 B | 100000 B |
| Lokal rollbackrespons | < 0.01 ms | 50 ms |

## 13. Releaseartefakter og provenance

`release/wp13-11/` inneholder operations-kit, validation, measurement dictionary, data inventory, official source register, authorization status, 54 språkfiler, component manifest, rollbackregister, provenance, limitations, platformmatrise, SBOM, lisensinventar, ytelsesbudsjett, reproduserbarhetsbevis og SHA-256-sjekksummer.

WP13.11 er bundet til WP13.10-baseline, den nye branchen og fast operationsrevisjon. `latest` brukes ikke som identitet. Endelig commit/tree bindes av Git og draft-PR etter at alle tracked filer er ferdige; et tracked dokument kan ikke sannferdig self-hashe sin egen endelige tree.

## 14. Teststatus og åpne menneskelige gap

Målrettet WP13.11-test: 18/18 bestått. Samlet kompilert suite: 148/148 bestått. WP13.10-hardening: 13/13 bestått. Browser-cleanup: 11/11 bestått. PWA-kontrakt: 10/10 bestått. Operationsbrowser og hele eksisterende browsermatrise: bestått. Integritetsvalidator: `valid: true`, 27 semantiske og 54 språkartefakter. Sikkerhetsporten validerte 71 releaseartefakter. SBOM viser 0 runtime dependencies, lisensinventaret viser 0 uavklarte lisenser, og `npm audit --omit=dev` rapporterte 0 sårbarheter.

`npm run check:release` fullførte med exit 0 tre ganger fra samme uendrede kildetilstand. Hver runde kjørte to uavhengige clean-copy-builds; alle seks ga identisk og innskrevet dist-digest `5960971a6b29e67539b029a0386618ce314f15507a4379b61d07472ed8795730`. En tidligere ikke-tellende runde avdekket en transient Windows Edge-profillås. Oppryddingen ble herdet til å gjenta PID-avgrenset profilsveip etter en transient CIM-feil, dekket med ny regresjonstest og deretter passert i alle tre tellende release-runder. Ingen image-wide prosessavslutning brukes.

Evidensklassifisering: domenekode og artefakter er `IMPLEMENTED`; automatiserte invariants og validator er `AUTOMATED_PROOF` og `CONTRACT_TEST`; lokale Edge/Chromium-kjøringer er `ACTUAL_BROWSER_PROOF` og `HEADLESS_BROWSER_PROOF`; 320 px og touch er `EMULATED_PROOF`. BM/NN-tekstene og deltakerutkastene er `DRAFT_FOR_REVIEW`; manuell tilgjengelighets-, juridisk, etisk og redaksjonell kontroll er `MANUAL_REVIEW_REQUIRED`; ekstern godkjenning er `EXTERNAL_RECEIPT_REQUIRED`; fysiske enheter og øvrige plattformer er `NOT_TESTED`; elevbruk, rekruttering, provider, B8 og produksjon er `NOT_AUTHORIZED`.

Git commit/tree, remote-samsvar, CI og draft-PR bindes og rapporteres i Git-leveransen etter at alle tracked filer er ferdige.

Åpent og ikke autorisert: menneskelig BM-/NN-review, juridisk/etisk review, skoleeierbeslutning, DPIA, manuell tilgjengelighetsreview, fysiske enheter, ekstern attestasjon, studentbeta, rekruttering, ekte data, provider, produksjon og B8.

## 15. Eksplisitt stoppunkt

WP13.11 stopper ved:

```text
OPERATIONS_KIT = READY_FOR_ADULT_ONLY_DRY_RUN
EXTERNAL_RECEIPTS = 0
B8 = NOT_DECISION_READY
STUDENT_BETA = NOT_AUTHORIZED
PRODUCTION = NOT_AUTHORIZED
```

WP13.12A er ikke startet.
