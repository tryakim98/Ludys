# WP13.12B — syntetisk stagingrepository og aktiveringshandoff

## Gjeldende ekstern aktiveringsstatus

Dom- og nullressurspåstandene i resten av dette dokumentet beskriver den
historiske repositoryfasen. Gjeldende ekstern status føres separat i
`release/wp13-12b/external-activation/` slik at den historiske baselinen ikke
skrives om.

Per 2026-07-27 er faktisk Firebase Emulator Suite-proof gjennomført, arkivert
og eksplisitt bekreftet av produkteier. Det isolerte Google/Firebase-prosjektet
`ludys-12b-stg-20260725` har billingkontroll, regional Firestore, deny-all
regler, fem Functions 2nd gen-tjenester, nøkkelfrie servicekontoer og et
serversecret. Backend er deployet deaktivert; ingen syntetiske økter er seedet.
Vercel-prosjektet finnes uten deployment eller domene. Den eksakte
Vercel-preview-identiteten er konfigurert med nøkkelfri Workload Identity
Federation, men både pool og provider er deaktivert.

Provideraktivering, beskyttet previewdeployment, cloudreceipts og fysisk
to-enhetsproof er derfor fortsatt ufullført. Ekte data, stabil deltakeridentitet,
Firebase Auth, studentbeta, rekruttering, produksjon, B8 og WP13.12C er fortsatt
forbudt eller blokkert.

Det historiske emulatorbeviset og den generelle eierbekreftelsen bevares som
historisk evidens, men kvalifiserer ikke alene til PR-3. Et nytt bevis må
kjøres fra en ren implementasjonscommit. V2-receipten krever en engangskode og
en eksakt menneskelig bekreftelse bundet til commit, tree, hele proofartefaktens
SHA-256, emulator-JAR-ens SHA-256, demo project ID og fast proof-formål.

`PR3` er eksplisitt `NOT_ACHIEVED`. Den maskinelle PR-3-porten krever alle
åtte kvitteringsavledede bevisfamilier, inkludert fysisk STOP, sletting,
no-resurrection, kill switch og rollback. Previewtekst er separat
menneskegodkjent og bundet til source-set SHA-256; enhver tekstendring lukker
deploymentporten igjen.

Utløpsdestruksjon er autorisert, men ingen schedulerreceipt finnes. Statusen er
`AUTHORIZED_AT_EXPIRY_NOT_SCHEDULED`; execution contract og destruction plan
er etterprøvbare, men repositoryet påstår ikke at en ekstern scheduler er
opprettet.

## Dom

Denne arbeidspakken gjør LUDYS-repositoryet teknisk klart for en senere, separat autorisert syntetisk Firebase-/Vercel-staging. Den oppretter ingen konto, billingkobling, database, service account, secret, deployment eller annen ekstern skyressurs.

Maksimal status er:

- `WP13_12B_REPOSITORY_IMPLEMENTATION = COMPLETE` etter grønn lokal kontroll og Git-leveranse
- `WP13_12B_EXTERNAL_ACTIVATION = AUTHORIZED_BY_EXPLICIT_PRODUCT_OWNER_CONFIRMATION`
- `CLOUD_PROVISIONING = BLOCKED_PENDING_EXPLICIT_PROJECT_ID_ACCOUNT_AND_BILLING_ACCOUNT_APPROVAL`
- `PROVIDER_ACTIVATION = BLOCKED`
- `CLOUD_RESOURCES = 0`
- `EXTERNAL_RECEIPTS = 0`
- `PHYSICAL_TWO_DEVICE_PROOF = FALSE`
- `B8 = NOT_DECISION_READY`
- `STUDENT_BETA = NOT_AUTHORIZED`
- `PRODUCTION = NOT_AUTHORIZED`
- `WP13_12C = BLOCKED`

## Autoritativ baseline og beslutning

Repositoryarbeidet er stablet på owner-decision-commiten `e5846735a3744a07febd93d5f75e776700c1013d`, tree `85a618cf567131be9f36fecfc038ab5f45c6732d`. Den tekniske WP13.12A-kilden er `929674d8a159ebd9ac6026c066f5dd044ebcea62`.

Owner-decision-recorden velger `APPROVE_RECOMMENDED_SYNTHETIC_DEV`, `FIREBASE_CAPABILITY`, regionkandidaten `europe-north1` og `FUNCTION_ISSUED_SHORT_LIVED_SESSION_CAPABILITY`. Beslutningspostens SHA-256 er `a5085b3dd4351bb1e6f35718b46f882667bd2e2995bc0e501065e0de6eac8754`; kildens pakkesjekksum er `f3830a640fd901f193279ed99338d923848acaef662e79e8a831e870a7813de7`.

Kostnadstak, billingvarsel, kill-switch-eier, billingreviewer, stagingutløp og automatisk slettingspolicy er fortsatt uløst. Dette er stoppvilkår for provisioning, ikke felt som repositoryet kan finne på.

## Arkitektur

Pure core er fortsatt providerfri. `src/core/synthetic-staging.ts` bruker den eksisterende lifecycle-maskinen for WAIT, hjelp, pause, STOP, deletion og no-resurrection. Firebase-spesifikk kode ligger i `provider/firebase/`.

Function-adapteren tilbyr logiske handlere for:

- `issueSyntheticSession`
- `sessionCommand`
- `sessionProjection`
- `deleteSyntheticSession`
- `health`

Capabilityen er HMAC-signert, kortlivet (maksimum 15 minutter), session-, rolle-, authority-generation-, release- og control-epoch-bundet. Den har nonce og command budget, aksepteres bare som `Authorization: Bearer`, og avvises i URL, query og body. Ingen Firebase Authentication, stabil UID eller cross-session identity finnes.

## Firestore og authority

Autoritativ state kan bare endres gjennom serverhandleren. Firestore Rules er deny-by-default for all direkte klientlesing og -skriving. Privilegerte serverklienter med IAM omgår Rules; derfor er en separat minst-privilegert IAM-plan obligatorisk.

Aktiv payload, kortlivet capabilitymetadata, control state og minimum tombstones er separate. Explicit deletion sletter aktiv payload transaksjonelt og skriver tombstone. TTL er ikke konfigurert fordi owner-decision-recordens slettingspolicy er uløst; hvis den senere autoriseres er den bare backstop og ikke umiddelbar sletting. Backup og PITR forblir deaktivert.

## STOP, kill switch og no-resurrection

STOP øker authority generation, stopper audio og gjør alle eksisterende rollecapabilities ugyldige. Deletion kan skje med en fortsatt gyldig ADULT-capability før STOP, eller via den separat IAM-beskyttede operatørfunksjonen etter STOP/kill switch. Den øker authority generation igjen, sletter aktiv payload og bevarer minimum tombstone.

Kill switch har `controlEpoch`, `stagingEnabled`, `reasonCode` og `changedAt`. Hver eksplisitt operatorendring øker epoch. Gammel capability kan derfor ikke gjenbrukes etter stopp, reopen, reconnect eller rollback. Rollback får aldri redusere epoch eller velge withdrawn/inkompatibel providerrevision.

## Syntetisk flerklient og preview

CHILD og ADULT er minsteprojeksjoner av samme autoritative syntetiske session og får separate capabilities. Voksenkort eksponeres aldri til CHILD. Dette er:

- `MULTI_DEVICE = OPTIONAL_TECHNICAL_STAGING_PROOF`
- `SINGLE_DEVICE = CANONICAL_PRODUCT_MODE`

`web/staging-preview.html` er en lokal, tydelig merket fixtureflate. Den leser eksplisitt `staging-runtime-config.json`, feiler lukket, gjør ingen providerkall, lagrer ingen capability i persistent browserstorage og viser alltid provider deaktivert og cloud resources 0. Den er ikke deployet.

## Logging og data

Applikasjonslogging er en grov allowlist. Capability, capabilityhash, body, state, stimulus, response, supporthistorikk, rolleprojeksjon, navn, e-post, skole, stabil UID, tenant, fritekst og analytics-ID er forbudt. Policyen hevder ikke kontroll over alle provider service logs; dette restområdet står eksplisitt i handoffet.

Bare eksplisitt syntetiske fixture-ID-er er tillatt. Navn, kontaktdata, skole, studentnummer, fødselsdato, diagnose, helsedata, læringsrespons, fritekst, media, mikrofon, kamera, engagement score, profil, analytics, replay, heatmap og fingerprint er forbudt.

## Emulator, browser og fysisk proof

Kontrakttest, headless browserproof, eventuell faktisk emulatorproof og fysisk to-enhetsproof er separate evidensnivåer. Repositoryet fabrikerer aldri et høyere nivå.

En faktisk Firebase Emulator Suite-kjøring krever en faktisk tilgjengelig/verifisert artifact. Hvis dette ikke kan gjennomføres, rapporteres en verifisert blokkering og offline importkontrakten krever eksakt JAR-filnavn og SHA-256.

Fysisk to-enhetsproof er en uutfylt kontrakt. Det er ikke utført i denne arbeidspakken.

## Ekstern aktivering

`release/wp13-12b/activation-handoff/operator-tasks.json` er den nummererte OP-01–OP-16-pakken. Kommandoene der er handoffinstruksjoner og kjøres ikke i repositoryfasen.

Fem receiptkontrakter finnes. Alle maler er merket `UNFILLED_TEMPLATE_NOT_EVIDENCE`. Ingen faktisk receipt produseres eller telles nå.

## Historisk materiale

Eventuelle historiske WP13.12B-dokumenter klassifiseres som `HISTORICAL_REQUIREMENTS_AND_IMPLEMENTATION_REFERENCE`, aldri nåværende baseline eller completion evidence. Ingen historisk commit, kode, testtall, receipt, credential, providerressurs eller kostnadsfelt er importert.

## Eksplisitt stoppunkt

Stopp etter dokumentert lokal repositoryimplementasjon, emulatorstatus, previewbuild, operatorhandoff, commit, push og draft-PR. Ikke provision, deploy, åpne B8, kontakte/rekruttere deltakere, bruke ekte data, autorisere produksjon eller starte WP13.12C.
