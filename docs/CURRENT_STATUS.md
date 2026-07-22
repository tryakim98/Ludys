# Gjeldende teknisk status – R1 + WP13.10

```text
Product: LUDYS
Repository: ludys-app-reconstructed
Version: 0.14.0-reconstructed.7
Baseline: WP13.4 functional proof + WP13.7A lifecycle chassis + WP13.7B app journey + WP13.7C local PWA shell + WP13.8 authentic draft corpus + WP13.9 authoring/audio pipeline + WP13.10 reliability/security/release hardening
Data: synthetic and session-bound
Runtime AI: none
Provider/backend/auth: none
B8: NOT DECISION READY
Pilot: NOT AUTHORIZED
Student beta: NOT AUTHORIZED
Lifecycle persistence/transport: deterministic in-memory proof only
WP13.7 production scope: NOT COMPLETE; local PWA/offline proof only
```

## R1-dom

R1 bevarer og beviser WP13.4-funksjonsgrunnlaget under ny, sporbar Git-identitet. Senere dokumenterte funksjoner er ikke automatisk rekonstruert.

WP13.7A la til en isolert lifecycle-flyt. WP13.7B kobler den samme autoritative, lokale lifecycle-kontrakten til appens normale startside og beviser en sammenhengende syntetisk reise med eksplisitt opprettelse, rollevalg, orientering, aktivitet, separate barn-/voksenprojeksjoner, WAIT, hjelp, arbeidsro, pause/resume, recovery, stop, completion, oppsummering, sletting, no-resurrection og en ny separat økt.

WP13.7C legger til et lokalt installérbart manifest, et smalt og versjonert service-worker-shell, tilgjengelig offline-/oppdateringsstatus og browserproof for oppstart og navigasjon uten nett etter første onlineinnlasting. Cache Storage inneholder bare et avgrenset statisk shell og er aldri autoritativ sessionstate. Oppdatering overtar ikke automatisk en aktiv økt.

WP13.8 integrerer fire foreløpige norske mønsterklasser og nøyaktig åtte semantiske aktiviteter i den samme appreisen. Hver aktivitet har separate BM-/NN-varianter, støtteproveniens, voksenkort, knowledge/context og tre lydspesifikasjoner per målform. Alt er `DRAFT`, `EXTERNAL_REVIEW_REQUIRED`, `SYNTHETIC_ONLY` og `NOT_STUDENT_BETA`. To `CHANGES_REQUIRED`-aktiviteter er blokkert i vanlig syntetisk modus og bare synlige i reviewmodus. Progresjonskantene er voksenstyrte utkast uten samlet score eller automatisk plassering.

Content-lifecycle kan skjerpes separat fra apprelease. En personfri, restriktiv policy kan bare legge til `STALE`, `SUPERSEDED` eller `WITHDRAWN`; den kan aldri gjenopprette `CURRENT`. Den ligger separat fra shellcache og inneholder ingen sessionstate eller profil. Klassebegrensning dominerer aktivitet, og offline reload bevarer blokkeringen uten å gjenopplive økten eller innholdet.

WP13.9 legger til en providerfri authoring-, innholds- og lydproduksjonslinje for alle åtte WP13.8-aktivitetene. BM/NN er separate og obligatoriske, pakken er deterministisk importerbar/eksporterbar, lokale reviews er aldri receipts, og `REVIEW_PENDING` er bare handoff. Seks lydspesifikasjoner per aktivitet støtter stale, teknisk replacement og withdrawal. To deterministiske tonefixtures er eksplisitt ikke mennesketale og ikke produksjonslyd. Publisering, masseinnspilling, ekstern godkjenning og studentbeta er permanent blokkert.

En separat personfri authoring-/audio-policy i service workeren bevarer withdrawal offline uten å lagre drafts, sessionstate eller persondata. Authoringflaten kan ikke mutere den autoritative appøkten.

WP13.10 legger en fail-closed reliabilitygrense rundt den samme autoritative lifecycle-kjernen. Kommandokonvolutten avviser duplikater, stale stateversjon, stale voksengenerasjon og forsinkede kommandoer uten stateendring. Sentrale invarianter kontrolleres ved hver aksepterte overgang, og deterministisk seedet kaostest dekker 4096 representative kommandoer. STOP, sletting, withdrawal og ugyldig recovery kan ikke gjenopplive session, forsøk, innhold, authoringimport, lyd eller offlinecache.

Recovery skiller tom, korrupt, inkompatibel og utilgjengelig state fra trygg tekst-/stillhetsfallback. En lokal browser-boundary stopper lyd og pending handlinger ved `window.error`, `unhandledrejection`, render-, storage- og audiofeil, og viser bare menneskereviewet teknisk recoverytekst med tilgjengelig STOP og sikker ny start. Ingen feil sendes eksternt eller tolkes pedagogisk.

Releaseproofet versjonerer app, innhold, kunnskap, lyd og schema separat. Lokal rollback er uavhengig, avviser withdrawn/ukjent/inkompatibel revisjon og fører append-only historikk. `npm run check:release` samler regresjon, chaos/recovery/rollback, headless Edge, PWA, sikkerhet, ytelse, release metadata, SBOM/lisenser, checksums, to clean-copy-builds og production dependency audit. Dette er syntetisk lokal releaseproof, ikke deployment eller produksjonsattestasjon.

Beviset er lokalt, syntetisk og maskinelt. Edge er kjørt headless på faktisk lokal browserorigin; 320 px, touch og Android-liknende miljø er emulering, ikke fysisk enhetstest. Firefox, Safari/iOS, fysisk Android, produksjons-service-worker, produksjonsrollback og manuell hjelpemiddeltest er ikke testet. Provider, auth, produksjonspersistens, ekte data, produksjonsdeployment, bakgrunnssynkronisering, pushvarsler, faktisk lydopptak, validert progresjon og ekstern fag-/språk-/co-design-review er ikke åpnet eller påstått fullført.
