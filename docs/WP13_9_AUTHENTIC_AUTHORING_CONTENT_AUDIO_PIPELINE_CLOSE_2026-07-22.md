# WP13.9 – autentisk authoring-, innholds- og lydproduksjonspipeline

Dato: 2026-07-22
Produkt: LUDYS
Versjon: `0.14.0-reconstructed.6`

## Sluttstatus

```text
WP13_9_AUTHENTICALLY_INTEGRATED
AUTHORING_PIPELINE_READY
AUDIO_PRODUCTION_PIPELINE_READY
SYNTHETIC_ONLY
EXTERNAL_REVIEW_REQUIRED
NOT_STUDENT_BETA
```

Dette er en lokal, providerfri og review-gated teknisk produksjonslinje. Statusen betyr ikke språk-, målform-, uttale- eller publiseringsgodkjenning.

## WP13.8-mergebaseline

- Mergecommit: `19f6ad7da12ef5c721ed4f3a7e7ec5fd3ece4b5f`
- Tree: `b9b93a6ced9ff3c58eac2ffd4c566f369ac7d3f8`
- PR: `#5`
- Post-merge: lokal `npm ci`, `npm run check` og GitHub Actions bestod.

## Recoverybegrensning

Oppgitt commit `16d8eeee2d9a5adff76c2b7c73cc4b1f2ca3043f` og tree `f78d0dea7396da207a2612ca6d0f5c669fb51e74` fantes ikke i oppdaterte lokale/remote refs eller GitHub API. Filstiene `src/core/authoring-pipeline.ts` og `src/application/authoring-pipeline-controller.ts`, samt symbolene `AuthoringPackage`, `AUTHORING_PIPELINE_READY` og `AUDIO_PRODUCTION_PIPELINE_READY`, ga ingen historiske treff. Elleve unreachable blobs og tre unreachable trees ble også kontrollert uten treff. Ingen recoverycommit ble cherry-picket eller merget.

## Authoringmodell

`src/core/authoring-pipeline.ts` definerer en komplett, versjonert `AuthoringPackage` med:

- stabile pakke-, aktivitet-, pattern class-, knowledge-, context- og audio-ID-er
- kildekorpus og kildeaktivitet
- construct, stimulusroller, target, transfer og transferklassifisering
- voksenstyrt støttegrad og øktbundet støtteproveniens
- eksplisitte BM- og NN-varianter
- voksenkortets fire lag, knowledge unit og context card
- audio specifications og tekniske takes
- lokal provenance, lokale reviewnotater og alltid null eksterne receipts
- `CURRENT / STALE / SUPERSEDED / WITHDRAWN`
- child preview og adult preview
- eksplisitte nullautorisasjoner for publisering, studentbeta, B8, ekte data, runtime-AI, auth, database, provider og masseinnspilling

En valid pakke kan bare få:

```text
validForDraftExport = true
validForExternalReviewHandoff = true
validForPublish = false
```

## Læringsdimensjoner uten elevprofil

Alle pakker representerer nøyaktig disse ti dimensjonene: `PHONOLOGICAL_AWARENESS`, `GRAPHEME_PHONEME_MAPPING`, `DECODING_ACCURACY`, `ORTHOGRAPHIC_LEARNING`, `SPELLING_ENCODING`, `READING_FLUENCY`, `MORPHOLOGY`, `READING_COMPREHENSION`, `WRITTEN_EXPRESSION` og `ASSISTIVE_ACCESS`.

Hver dimensjon har `PRIMARY`, `SECONDARY` eller `NOT_TARGETED`, et faglig innholdsrasjonale, et observerbart oppgavekrav og `notDiagnostic = true`. Modellen inneholder ingen varig elev-ID, typeetikett, score, timingtolkning eller diagnoseinferens.

## Authoringcontroller

`src/application/authoring-pipeline-controller.ts`:

- oppretter åtte komplette pakker fra WP13.8
- velger og kloner komplett draft til ny semantic `activityId`
- redigerer BM og NN separat
- redigerer construct/stimulusmetadata, voksenkort, knowledge, context og lydmanus
- validerer reference closure
- eksporterer deterministisk, versjonert JSON
- importerer bare valid, kjent og personfri JSON
- registrerer lokale non-receipt-reviewnotater
- setter `REVIEW_PENDING` som handoffstatus, aldri godkjenning
- markerer relevant lyd `STALE` ved tekst-/manusendring
- håndterer kontrollert teknisk take og replacement
- trekker pakke og all lyd tilbake
- lar `STOP` avbryte teknisk lydforespørsel

Controlleren har ingen metode for publisering, ekstern receipt, språk-/uttalegodkjenning, B8, studentbeta, ekte data eller runtime-AI.

## Innholdsverksted

Den eksisterende appen har en tilgjengelig authoringflate for ikke-programmerere. Flaten viser og redigerer pakkevalg, BM/NN, construct, target/transfer, voksenkort, knowledge/context, alle seks lydspesifikasjoner, clone, lokal review, handoff, import/eksport og child/adult preview. Publiseringsknappen er permanent deaktivert med forklaring.

Authoringcontrolleren er separat fra den autoritative sessioncontrolleren. Åpning, redigering, import, review og withdrawal kan ikke endre aktiv session uten en senere kontrollert port.

## BM/NN og reference closure

Begge målformer er obligatoriske, eksplisitte og uten fallback. Hver har tittel, mål-/transferord, instruksjon, betydnings-/transferprompt, voksenkortets fire lag, kunnskapstittel/-forklaring, situasjonskort og tre lydmanus. Validering blokkerer manglende målform, tomme felter, orphaned IDs, duplikater, activity drift, ukjent pattern class ved import, publisering, receipts uten integritet, studentbeta, ekte data, provider/auth og runtime-AI.

## Lokal review og ekstern handoff

Lokale notater inneholder review-ID, navn, rolle, scope, beslutning, kommentar, tidspunkt og signaturtekst, men alltid:

```text
externalReceipt = false
receiptIntegrityVerified = false
```

`REVIEW_PENDING` betyr bare at en valid draft er klargjort for et faktisk menneske. Det betyr ikke mottatt review, godkjent norsk, godkjent uttale eller publiserbarhet. Eksterne receipts er `0`.

## Audio Content System

Hver aktivitet har seks stabile audio specifications: targetmodell, transfermodell og voksen/knowledge for både BM og NN. Hver spesifikasjon inneholder manusfamilie, script/take-revisjon, filstamme, WAV/PCM/mono/48 kHz/16–24 bit, varighet, peak, innledende/avsluttende stillhet, asset- og script-SHA-256, rights, voice consent, tre separate reviewstatuser, lifecycle, stale, active take og replacement.

Teknisk policy håndhever peak −18 til −1 dBFS, varighet opptil 30 sekunder, innledende stillhet opptil 500 ms og avsluttende stillhet opptil 700 ms. Constructbærende lyd er `HUMAN_REQUIRED`. Runtimeappen har ingen mikrofon, autoplay, taleanalyse eller talesyntese; den har brukerstart, STOP, tekst- og stillhetsalternativ.

## Tekniske lydfixtures

To deterministiske tonefixtures, ikke mennesketale, brukes bare til header-/format-/checksum-/replacement-test:

| Fil | Format | SHA-256 |
|---|---|---|
| `wp13-9-technical-tone-a-48k-24bit-mono.wav` | WAV PCM mono 48 kHz 24-bit | `0c49533392b7bd24b2cb43dcc50ed2f1c6f411c2810a6ced4a6ca81125934dc1` |
| `wp13-9-technical-tone-b-48k-16bit-mono.wav` | WAV PCM mono 48 kHz 16-bit | `dda00ea80a57a0bb07f32c7c0f7834194f0d09b599c9d26c739f3790fb6b664e` |

Begge er eksplisitt `INTERNAL_TECHNICAL_TRIAL_ONLY`, `NOT_HUMAN_SPEECH`, `NOT_REVIEWED` og `NOT_PRODUCTION_AUDIO`.

## Stale, replacement og withdrawal

Relevant tekst- eller manusendring øker revisjon og setter berørt lyd til `STALE`. En kjent teknisk fixture kan knyttes til og erstattes kontrollert; den åpner ingen produksjonsautoritet. Withdrawal setter pakken og alle lydspesifikasjoner til `WITHDRAWN`, fjerner aktiv take og blokkerer preview.

## Human-First

Eksisterende én autoritativ sessionstate, separate child/adult-projeksjoner, WAIT, voksenautoritet, støtteproveniens, STOP-dominans, DELETE/no-resurrection og null timingtolkning er uendret. Authoring bruker bare syntetiske lokale drafts og lagrer ingen elevdata eller profil.

## PWA/offline

Service workeren har en separat personfri `ludys-authoring-policy-1`. Policyen kan bare styrke `STALE`, `SUPERSEDED` eller `WITHDRAWN` for pakke/audio og har alltid `resurrectionAllowed = false` og `publishingAuthority = false`. Offline reload bruker siste restriktive policy; en senere tom eller svakere policy kan ikke gjenopplive trukket pakke eller lyd. Policycache inneholder ingen sessionstate, bruker, profil eller ekstern origin.

## Tester og browserproof

- 117 kompilerte tester etter første integrasjon
- PWA/service-worker-kontrakt: 10/10
- eget Chromium-authoringproof dekker åtte pakker, BM/NN, statuser, dimensjoner, seks specs, blokkert publisering, clone, redigering, non-receipt-review, handoff, eksport/import, stale, replacement, STOP, withdrawal, child/adult-preview, offline no-resurrection, 320 px, 2× zoom, tastatur, reduced motion og AX-tre
- endelige flerrundersresultater registreres i commit-/PR-verifikasjonen

## Eksplisitte ikke-påstander

WP13.9 hevder ikke ekstern review, godkjent norsk/BM/NN/uttale, publiserbar lyd, masseinnspilling, validert progresjon, effekt, B8-beslutning eller studentbeta. Auth, database, provider, telemetry, nettverkspublisering, ekte data og runtime-AI er ikke åpnet.

## Åpne reviews og gjenværende gap

Ekstern språk-/målformreview, uttale/naturalness/construct-review, pedagogisk progresjonsreview, co-design, manuell skjermleser-/AT-review, rettigheter/voice consent for framtidige menneskelige opptak og faktisk signerte receipts gjenstår. GAP-011 er redusert av autentisk teknisk integrasjon, men faktisk produksjonsreview og lydopptak gjenstår. WP13.10 er ikke startet.
