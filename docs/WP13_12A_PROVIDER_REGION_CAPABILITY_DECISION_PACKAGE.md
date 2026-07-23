# WP13.12A — Provider, Region, Capability and Synthetic Dev Decision Package

## Resultat

WP13.12A leverer et kildebelagt, maskinlesbart og lokalt verifisert beslutningsgrunnlag for produkteier. Pakken er `READY_FOR_OWNER_DECISION`, men ingen eierbeslutning er gjort:

```text
OWNER_DECISION = PENDING_OWNER_ACTION
PROVIDER_ACTIVATION = BLOCKED
CLOUD_RESOURCES = 0
EXTERNAL_RECEIPTS = 0
B8 = NOT_DECISION_READY
WP13.12B = BLOCKED
STUDENT_BETA = NOT_AUTHORIZED
RECRUITMENT = NOT_AUTHORIZED
REAL_PARTICIPANT_DATA = NOT_AUTHORIZED
PRODUCTION = NOT_AUTHORIZED
RUNTIME_AI = NOT_PRESENT
```

Ingen providerkonto, prosjekt, database, function, auth, billing, secret eller deployment er opprettet eller aktivert.

## Autentisk baseline og branch

Arbeidet startet fra eksakt WP13.11:

- commit `166e901bcd8f799bec21c5fcafbdbc2deae5e284`
- tree `805f9eec758f9e52bb308b8e3977b7a261443a51`
- parentbranch `feature/wp13-11-complete-beta-operations-measurement-kit`
- kandidatbranch `feature/wp13-12a-provider-region-capability-decision-package`

PR #8 for WP13.11 var fortsatt åpen draft ved precheck, derfor skal WP13.12A-PR-en være stacked over WP13.11-branchen. Ingen historisk WP13.12A-implementasjon eller test ble funnet eller importert.

## Precheck

Før første kildeendring var arbeidstreet rent, én worktree var registrert, ingen Git-lås eller konkurrerende repositoryprosess ble funnet, og lokal/remote WP13.11-head samsvarte. Urørt `npm run check:release` bestod med:

- 148/148 kompilerte tester
- WP13.10: 13/13
- WP13.11: 18/18
- browser cleanup: 11/11
- PWA-kontrakt: 10/10
- `npm audit --omit=dev`: 0 sårbarheter
- reproduserbar dist-digest: `5960971a6b29e67539b029a0386618ce314f15507a4379b61d07472ed8795730`

## Alternativmatrise

| Alternativ | Status | Identitet | Fysisk multi-device | Operasjon | Lock-in | Hovedgrunn |
|---|---|---|---|---|---|---|
| `LOCAL_ONLY` | Acceptable fallback | Ingen stabil identitet | Nei | Lav | Lav | Minste personvernflate, men beviser ikke fysisk transport |
| `FIREBASE_CAPABILITY` | Teknisk anbefalt | Kortlivet økt-capability, ingen konto | Ja | Medium | Medium | Regional samlokalisering, autoritativ handler, providerfri core |
| `FIREBASE_ANONYMOUS` | Ikke anbefalt | Providerkonto/UID | Ja | Medium | Medium–høy | Unødvendig kontolivsløp og US-only Auth-behandling |
| `SELF_HOSTED` | Krever mer evidens | Kan være capability | Ja | Høy | Lav–medium | Større kontroll, men uavklart provider, patching, IAM, DPA og kost |
| `LUDUS_REUSE` | No-go | Uavklart cross-product-identitet | Nei | Uakseptabel | Uakseptabel | Cross-product provider-, credential- og kodegjenbruk er forbudt |

Anbefalingen er en teknisk kandidat, ikke et valg. Produkteiermalen er blank, og validatoren avviser automatisk godkjenning, signatur eller utfylte eierfelt.

## Anbefalt teknisk minimum

Den minste anbefalte eksterne dev-arkitekturen, dersom produkteier senere godkjenner den, er:

1. Vercel-beskyttet preview for den statiske appflaten.
2. Regional Cloud Firestore Standard i `europe-north1`.
3. Cloud Functions 2nd gen i samme region.
4. Funksjonsutstedt opak capability med hard maksimumslevetid 15 minutter.
5. Capability bundet til én syntetisk økt, én rolle, eksakt authority generation og forventet state-revisjon.
6. Capability kun i klientminne; aldri URL, localStorage, IndexedDB eller logg.
7. Ingen direkte klientskriv til autoritativ store.
8. Handleren validerer replay, nonce, revisjon og autoritet, kaller providerfri pure core og returnerer minimum rolleprojeksjon.

`LOCAL_ONLY` forblir en legitim fallback dersom eier ikke trenger fysisk multi-device-staging nå.

## Regionanalyse

| Region | Firestore | Functions | Samlokalisert | Status | Viktig rest |
|---|---|---|---|---|---|
| `europe-north1` | Finland, regional | 2nd gen | Ja | Anbefalt | 99,99 % regional SLA-retning; juridisk/kontraktsmessig rest er åpen |
| `europe-north2` | Stockholm, regional | Ikke samme region i kontrollert tabell | Nei | Ikke anbefalt | Kryssregion latency/egress |
| `eur3` | Europe multi-region | Nærmeste dokumenterte handlerregion | Nei | Fallback | Høyere availability/kost og bredere lokasjonsbeskrivelse |

Firestore-lokasjon kan ikke flyttes etter opprettelse. Derfor er regionlås eksplisitt ikke utført, og kilde-/pris-/servicekontroll må gjentas før ethvert senere vedtak eller provisioning.

## Dataflyt og autoritet

De åtte eksplisitte stegene er:

1. protected preview
2. browser client
3. transport port
4. authoritative handler
5. provider-free pure core
6. authoritative store
7. minimum role projection
8. coarse technical observability

Sju trust boundaries dekker preview, klient/handler, handler/store, handler/pure-core, logging, deployidentitet og providersupport. Alle steg failer lukket med typed denial. STOP forblir dominant.

## Dataklasser

Tillatte kandidater er kun syntetiske og betinget av senere eierbeslutning: sessionreferanse, syntetisk rolle, stateversjon, authority generation, lukket kommandotype, syntetisk state, minimum rolleprojeksjon, expiry, tombstone, release-ID og grov teknisk eventkode.

Navn, e-post, telefon, skole, studentnummer, fødselsdato, diagnose, helse, stabil UID, tenant, fritekst om deltaker, lyd, video, bilde, mikrofon, kamera, ekte læringsrespons, kryssøktprofil, engagement, analytics-ID, replay, heatmap og fingerprint er `NOT_COLLECTED` og `NOT_AUTHORIZED`.

## Retensjon, sletting og no-resurrection

- eksplisitt autoritativ sletting er synkron kontroll
- state slettes og minimal tombstone skrives atomisk
- alle capabilities tilbakekalles
- STOP og DELETE dominerer pending handlinger
- TTL er bare forsinket backstop og aldri umiddelbar sletting
- backup og PITR er av i anbefalt baseline
- enhver senere backup/PITR-aktivering krever eierbeslutning og separat resurrection-proof

## Logging, observability, IAM og secrets

Bare release-ID, grov feilkode, tjenestehelse, denial-/rollbackklasse, functionversjon, region og ikke-identifiserende latency bucket kan vurderes. Request-/response-body, capability eller capability-hash, sessionstate, stimulus, respons, supporthistorikk, pedagogisk payload, navn, e-post, skole, stabil UID, tenant, fritekst og analytics-ID er forbudt.

Runtime- og deployidentitet skal være separate og least-privilege. Broad owner-rolle for runtime er forbudt. Service-account JSON i repository, klienten eller browser er forbudt. Kortlivede workload credentials foretrekkes.

## Kost og kill switch

Kostradene er retningsgivende, ikke garantier. Billing alerts er ikke harde tak. Produkteier må eksplisitt fylle:

- månedlig alertgrense i NOK
- maksimalt akseptert månedlig kost
- kill-switch-eier
- billing reviewer
- utløpsdato for staging
- automatisk slettingspolicy

Alle står `PENDING_OWNER_ACTION`.

## Trusler og no-go

Trusselmodellen har 21 obligatoriske trusler, blant annet capability theft/replay, direct write bypass, stale revision/authority, resurrection, logglekkasje, overprivilegert IAM, secret leakage, misconfigurasjon, kostoverskridelse, denial-of-wallet, provider outage, region drift, supply chain, support/subprocessor access og feilaktig eier-/B8-autorisasjon.

No-go-registeret har 19 obligatoriske stoppsignaler. Det stanser blant annet manglende eierbeslutning, uavklart DPA/DPIA/skoleeier, stabil elevidentitet, direkte klientskriv, payloadlogging, browser secrets, manglende kostgrense/kill-switch, manglende exit, resurrection-proof-feil, manglende BM/NN-review og enhver implicit studentbeta/produksjon.

## Juridiske og operative restspørsmål

Pakken dokumenterer, men avgjør ikke:

- behandlingsgrunnlag og om personopplysninger faktisk oppstår
- DPA og subprocessorliste
- tredjelandstilgang og transfer assessment
- DPIA-beslutning
- skoleeieransvar og anskaffelse
- etikk, barnets rettigheter og deltakerinformasjon
- incident response, provider support og logginnsyn
- kostaksept og navngitt kill-switch-ansvar

Ingen kilde eller teknisk test kan erstatte de ansvarlige menneskelige beslutningene.

## Offisielle kilder kontrollert 2026-07-23

Kilderegisteret har 28 primærkilder med faktum, begrensning og reverifiseringstrigger. Sentrale eksempler:

- Firestore locations: https://firebase.google.com/docs/firestore/locations
- Cloud Functions locations: https://firebase.google.com/docs/functions/locations
- Firebase Anonymous Auth: https://firebase.google.com/docs/auth/web/anonymous-auth
- Firebase privacy: https://firebase.google.com/support/privacy
- Firestore TTL: https://firebase.google.com/docs/firestore/ttl
- Firestore pricing/quotas/PITR/backups: offisielle Firebase-dokumenter
- Google IAM service accounts, budgets, logging retention, DPA og subprocessors
- Vercel deployment protection, environments, rollback, logs, privacy, pricing, spend management og DPA
- Datatilsynet om skole-DPA, DPIA og overføring
- Utdanningsdirektoratet om skoleeiers personvernansvar

Fullt register ligger i `release/wp13-12a/decision-package/official-source-register.json`.

## Artefakter og UI

`release/wp13-12a/decision-package/` inneholder provider-/region-/capabilitymatriser, dataflyt/trust, role model, datagrense, DPA/DPIA-register, retention, logging, IAM, kost, trussel, migration/exit, deployment-runbook, no-go, autorisasjon, kilder, validatorresultat, checksums, proveniens, limitations, locale-bundles, rollbackregister, componentmanifest og blank eiermal.

Den integrerte UI-flaten viser alle deler i separate BM-/NN-bundles. Den kan lokalt eksportere et deterministisk dossier og en blank eiermal. Den kan ikke aktivere provider eller utføre eksterne handlinger.

## Verifikasjonsstatus før finalrundene

- 203/203 kompilerte tester bestått
- WP13.12A målrettet: 55/55
- WP13.10 rollback/reliability: 13/13
- WP13.11: 18/18
- browser cleanup: 11/11
- PWA-kontrakt: 10/10
- alle elleve lokale Chromium/Edge-bevis bestått
- beslutningsbrowser: 320 px, 200 %, touch, tastatur, fokusrekkefølge, forced colors, reduced motion, AX tree og 0 eksterne kall
- secret scan: bestått
- security/release: 28 checksum-bundne WP13.12A-artefakter bestått
- CycloneDX SBOM: 0 runtime dependencies
- lisensinventar: 0 unresolved
- reproduserbar dist-SHA-256: `78d9dfb53bb244570a9533f04778f1526816a0d2c35c153edbe8253979b212d5`

Finalkandidaten skal i tillegg bestå tre komplette `npm run check:release`-runder på samme frosne kilde. Eksakt resultat bindes av commit, draft-PR og CI; dokumentet fabricerer ikke disse før de finnes.

## Produkteierens neste handling

Produkteier må bruke den blanke malen og enten avvise, utsette eller eksplisitt velge provider, region og capability sammen med kostgrenser, navngitte ansvar, juridiske/operative avklaringer og godkjente rest-risikoer. Før det er gjort, skal status forbli:

```text
READY_FOR_OWNER_DECISION
PENDING_OWNER_ACTION
PROVIDER_ACTIVATION = BLOCKED
CLOUD_RESOURCES = 0
```
