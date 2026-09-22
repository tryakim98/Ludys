# WP13.10 – Reliability, Security and Release Hardening

- Dato: 2026-07-22
- Klassifisering: `SYNTHETIC_ONLY`
- Produksjonsdeployment: `NOT_AUTHORIZED`
- B8: `NOT_DECISION_READY`
- Studentbeta: `NOT_AUTHORIZED`
- Eksterne receipts: `0`

## Dom og baseline

WP13.10 er implementert autentisk på WP13.9-commit `758f9c8f585ba5003c40e9af805863cee86f9407` med tree `a6b21e7953efc2489eee64d2d1d7d10dd50ba233`. Lokal og remote WP13.9-head samsvarte, PR #6 var åpen draft, mergeable og grønn, arbeidstreet var rent, og pre-change `npm run check` bestod 117/117 kompilerte tester, 10/10 PWA-kontrakttester og hele den eksisterende browsermatrisen.

Det historiske dokumentet og commit `d2e5d54fe6ba167a9b4350dae41dfc97355d34c1` var ikke tilgjengelig i lokal eller remote repositoryhistorikk. Ingen historisk kode, dokumentasjon, resultattall eller tree ble importert. Konsepter som command envelope, fail-closed recovery, uavhengig komponentrollback og release provenance ble brukt fra dagens autoritative scope og implementert direkte mot WP13.9-koden.

## Evidensnivå

| Område | Evidens | Avgrensning |
|---|---|---|
| Reliability, recovery og rollback | `IMPLEMENTED` + `AUTOMATED_PROOF` | Lokal syntetisk state og releasekatalog |
| Edge desktop og browserorigin | `ACTUAL_BROWSER_PROOF` / `HEADLESS_BROWSER_PROOF` | Faktisk lokal Edge, men headless og uten manuell AT-review |
| 320 px, touch og Android-liknende viewport | `EMULATED_PROOF` | CDP-emulering, ikke fysisk telefon |
| Service worker og offline | `ACTUAL_BROWSER_ORIGIN_PROOF` + `CONTRACT_TEST` | Lokal proofserver; ikke produksjonsorigin |
| Firefox, Safari/iOS, fysisk Android | `NOT_TESTED` | Miljøene var ikke tilgjengelige |
| Språk, construct, uttale, naturalness, rettigheter og tilgjengelighet | `MANUAL_REVIEW_REQUIRED` | Kan ikke lukkes av automatisering |
| Provider, ekte data, runtime-AI, produksjon og studentbeta | `NOT_AUTHORIZED` | Ikke åpnet i WP13.10 |

## Reliability og state machine

`src/core/reliability-hardening.ts` definerer en eksplisitt kommandokonvolutt med `commandId`, `expectedVersion`, `authorityGeneration`, `issuedAt` og command. Utfallet er ett av `APPLIED`, `DUPLICATE_COMMAND`, `STALE_VERSION`, `STALE_AUTHORITY`, `DELAYED_COMMAND` eller `DOMAIN_REJECTED`. Et avvist command returnerer uendret autoritativ state og kan derfor ikke øke versjon, starte lyd, åpne voksenkort, opprette forsøk eller gjenopplive en terminal session.

Sentrale validatorer håndhever lifecycle/phase, monotone versjoner, authority generation, lyd- og voksenkortgrenser, pausemetadata, terminaldominans, slettingsinvalidering, attempt-opprydding, støtteproveniens, BM/NN-separasjon og restriktiv contentstatus. Application-controlleren kjører envelope-preflight og invariantvalidering rundt den eksisterende rene lifecycle-kjernen.

Propertytesten bruker seedene `0x13102026`, `0x5a17c0de`, `0x00c0ffee` og `0x10203040`, til sammen 4096 representative kommandoer. Etter hver overgang kontrolleres invariantene og at et avvist command ikke endrer state. Sekvensene omfatter start/orientering, barnets handling, hjelp, `WAIT`, voksenkort/-handling, arbeidsro, lyd, pause/resume, context correction, completion, STOP, deletion, reconnect/refresh, duplikat, stale versjon/generasjon og delayed command.

## No-resurrection, recovery og runtime safety

Session-, repository-, corpus-, authoring-, audio-, PWA- og service-worker-testene beviser samlet at STOP, deletion og withdrawal dominerer reconnect, delayed command, refresh, offline cache og update. Gamle attempt-ID-er, tidligere authority generation, aktiviteter, voksenhandlinger og lyd kan ikke gjeninnføres som aktive.

Recovery har eksplisitte utfall: `RECOVERED`, `EMPTY_SAFE_START`, `CORRUPTED_INVALIDATED`, `UNSUPPORTED_VERSION`, `CONTENT_UNAVAILABLE` og `TEXT_ONLY`. Tom eller korrupt storage, ugyldig shape/invariant/schema, ukjent release/aktivitet, brutt knowledge/context/audio-referanse, manglende eller feil målform og withdrawn innhold invalidates eller stopper fail-closed. Manglende, stale, withdrawn eller feilformatert lyd gir bare tekst og stillhet; det blokkerer aldri UI eller STOP.

Browser-boundaryen stopper HTML-audio, kansellerer pending UI-handlinger og viser menneskereviewet teknisk recoverytekst ved `window.error`, `unhandledrejection`, render-, storage- og audiofeil. STOP og sikker ny start er tilgjengelige. Feil beskrives ikke som barnets ansvar, evne, følelse eller motivasjon, og ekstern feilrapportering er slått av.

## PWA, browser og tilgjengelighet

Manifest, registrering, same-origin-policy, versjonert shell-precache, cacheopprydding, eksplisitt cache-clear, offline fallback og kontrollert update er dekket av 10 deterministiske kontrakttester. Faktisk lokal Edge-origin beviser registrert worker, offline-/cacheflyt, sikker oppdateringsgrense og no-resurrection. Service workeren lagrer ikke session, bruker, profil, authoringdraft eller API-data.

Den ekstra releasebrowsertesten beviser 320 px reflow, 200 % zoom, touch, tastatur, synlig/logisk fokus, reduced motion, forced colors, AX-tre, kritiske kontrollstørrelser, fokusstabilitet, STOP i feiltilstand, audio-/tekstfallback, separat BM/NN-rendering, authoring/preview, rollback og sikre origin-headere. Den produserer `artifacts/wp13-10-release-hardening.png` som lokalt browserbevis. Full matrise ligger i `release/wp13-10/platform-matrix.json`.

## Security og supply chain

Releasegaten kontrollerer pinned lockfile, null runtime dependencies, secrets, trackers/analytics, browsersecrets, `eval`, `new Function`, dynamisk import og uautoriserte runtime-URL-er. Corpus-, authoring- og audiomanifester inngår i checksums. Service worker er same-origin-only. Proofserveren tillater bare GET/HEAD, avviser usikre stier og setter CSP, `Permissions-Policy` med mikrofon/kamera/geolokasjon blokkert, `Referrer-Policy`, `X-Content-Type-Options` og frameblokkering.

CycloneDX 1.5-SBOM og lisensinventar genereres deterministisk fra lockfilen. Runtime dependency count er 0. Dev-avhengighetene er `@types/node`/MIT, `typescript`/Apache-2.0 og transitiv `undici-types`/MIT; ingen lisens er uavklart. Artefaktsjekksummer bruker SHA-256 over LF-kanonisert UTF-8 for `.json`/`.ts` og rå bytes for binær WAV, slik at Git-autocrlf ikke endrer verifikasjonen mellom Windows og Linux. `npm audit --omit=dev` er obligatorisk siste ledd i `npm run check:release`; faktisk dato, exit code og sårbarhetstall føres i sluttrapport og CI.

## Reproducerbar build, provenance og ytelse

To uavhengige tempkopier kjører `npm ci --offline --ignore-scripts --audit=false --fund=false` og `npm run build` fra samme kilde og lockfil. Begge ga dist-SHA-256 `afddb44dd597180f9f8dea50d05546ba85dad43642cb3ef01492ca05861b2213`, identisk med Ubuntu-CI etter at TypeScript-kilder ble låst til LF checkout og compileroutput til LF. Digesten hasher relative paths og bytes; byggmetadata inneholder ingen runtime timestamp. Lokal verifikasjon brukte Node `v24.18.0`, npm `11.16.0` og `win32-x64`. Dette er lokal reproducerbarhet, ikke signert produksjonsattestasjon.

Målte verdier mot eksplisitte budsjetter:

| Måling | Resultat | Budsjett | Evidens |
|---|---:|---:|---|
| Compiled runtime JavaScript | 413722 B | 600000 B | `AUTOMATED_PROOF` |
| Browser entry JavaScript | 18657 B | 30000 B | `AUTOMATED_PROOF` |
| CSS | 15139 B | 30000 B | `AUTOMATED_PROOF` |
| HTML | 1312 B | 3000 B | `AUTOMATED_PROOF` |
| Statisk illustrasjon | 841 B | 50000 B | `AUTOMATED_PROOF` |
| Teknisk audio | 60088 B | 100000 B | `AUTOMATED_PROOF` |
| Sentral browserinteraksjon | 3.000 ms | 150 ms | `HEADLESS_BROWSER_PROOF` |
| Lokal rollbackrespons | 0.0041 ms | 50 ms | `AUTOMATED_PROOF` |

Timing er lokal headless desktopmåling og ikke fysisk mobilbenchmark. Browsertesten kontrollerer også initial render under 2000 ms og cumulative layout shift under 0,05 uten at aktivt fokus flyttes.

## Separat versjonering og rollback

Manifestet binder `appVersion`, `contentReleaseId`, `knowledgeReleaseId`, `audioReleaseId` og `schemaVersion`. App, innhold, kunnskap og lyd kan rulles tilbake uavhengig. Andre komponenter forblir uendret, audio kan gå til tekst/stillhet, og rollbackhistorikken er append-only. Ukjente, withdrawn og schema-inkompatible revisjoner avvises uten stateendring. En kontrollert ny rollback kan reaktivere en kjent gyldig revisjon; dette er lokal syntetisk releaseproof, ikke produksjonsrollback.

## Releaseartefakter og samlet kontroll

`release/wp13-10/` inneholder:

- `artifact-checksums.sha256`
- `component-manifest.json`
- `sbom.cdx.json`
- `license-inventory.json`
- `release-provenance.json`
- `performance-budgets.json`
- `platform-matrix.json`
- `reproducible-build.json`
- `known-limitations.json`

`npm run check:release` kjører WP13.9-regresjonen, nye reliability/recovery/rollbacktester, sikkerhetsgate, ytelsesbudsjett, releasebrowser, to clean-copy-builds, metadataverifikasjon og production dependency audit. CI kjører den samme wrapperen. `artifacts/wp13-10-release-evidence.json` og `artifacts/wp13-10-reproducible-build-result.json` er maskinlesbare bevis; screenshotet er lokalt og ignorert som øvrige PNG-bevis.

## Åpne gap og stoppunkt

- P0 i automatisk testbart scope: `0`.
- P1 i automatisk testbart scope: `0`.

Følgende er fortsatt åpne og skal ikke fremstilles som gjennomført: norsk språk-/lesefaglig review, separat BM-/NN-review, construct-, uttale- og naturalnessreview, rettighets- og samtykke-/stemmestatus, manuell tilgjengelighetsreview, fysisk device-review, Firefox, Safari/iOS, produksjons-service-worker/observability, produksjonsrollback og ekstern attestasjon.

WP13.10 åpner ikke provider, auth, database, nettverkstjeneste, runtime-AI, stabil studentidentitet, ekte data, produksjonsdeployment, B8 eller studentbeta. WP13.11 er ikke startet.
