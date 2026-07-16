# WP13.7A — deterministisk teknisk øktchassis

## Status og avgrensning

WP13.7A implementerer et lokalt, rammeverksnøytralt kontrakt- og browserproof for et syntetisk øktlivsløp. Det er ikke en produksjonsapp, ferdig pedagogisk flyt eller autorisasjon av B8, pilot, PR-3 eller studentbeta.

```text
Data: SYNTHETIC_TECHNICAL_DRAFT
Copy: DRAFT_TECHNICAL_COPY — subject to Product Excellence review
Persistence: deterministic in-memory only
Transport: deterministic reconnect simulator only
Network: none in lifecycle adapters
Backend/provider/auth/database/deployment: not opened
Runtime AI: none
```

## Implementert

- Ren state machine med `NOT_CREATED`, `CREATING`, `READY`, `ACTIVE`, `WAITING`, `PAUSED`, `STOPPED`, `DELETED`, `STALE`, `INVALID`, `RECOVERING` og `COMPLETED`.
- Eksplisitte hendelser for create/created, activate, help/WAIT, resume, pause, stop, delete, reconnect, stale/invalid, recovery og complete.
- Typet avvisning som beholder state ved ugyldig overgang.
- Terminaldominans: STOP kan ikke bli ACTIVE igjen, og tombstone etter DELETE kan ikke lagre eller eksponere øktinnhold.
- Optimistic version guard og stale-write-avvisning i in-memory repository.
- Porter for lifecycle repository, clock, ID-generering, reconnect og lifecycle-observability.
- Deterministiske adaptere for ID, latency, disconnect/reconnect, stale snapshot, invalid payload, recovery success/failure og tombstone.
- Application-controller med eksplisitte view models for barn og voksen. Controlleren eksponerer aldri rå intern state til begge roller.
- Sentral BM/NN teknisk copy med obligatorisk draft-markør.
- Isolert proof-side på `web/session-lifecycle.html` uten framework eller ny avhengighet.
- Kryssplattform-resolver for lokalt installert Chromium-basert nettleser på Windows, Linux og macOS.

## Lagdeling

| Lag | WP13.7A-ansvar |
|---|---|
| `src/core/session-lifecycle.ts` | Pure lifecycle state, events, transitions og typed errors. |
| `src/ports/session-lifecycle.ts` | Repository-, ID-, reconnect- og observability-kontrakter. Eksisterende clock-port gjenbrukes. |
| `src/adapters/in-memory/in-memory-session-lifecycle.ts` | Deterministisk repository, tombstone, ID, transportscenarioer og signaloppsamling. |
| `src/application/session-lifecycle-controller.ts` | Orkestrering, rollevalg, eksplisitte view models og synlig error/recovery. |
| `src/composition/create-session-lifecycle-proof.ts` | Lokal sammensetning med fixed clock og in-memory-adaptere. |
| `src/content/prototype/session-lifecycle-copy.ts` | Sentral BM/NN draft-copy; ingen copy i domenet. |
| `src/ui/browser/session-lifecycle-*` | Isolert teknisk markup og eventhåndtering. |
| `scripts/browser-session-lifecycle-test.mjs` | Faktisk Chromium-bevis mot den isolerte siden. |

## Rollegrense

Barnets view model inneholder state, gyldige handlinger, syntetisk klassifisering og ett child-only cue. Den inneholder ikke session reference, observert versjon eller adult detail.

Den voksnes view model inneholder state, gyldige handlinger, syntetisk klassifisering, session reference før sletting, observert versjon og adult-only detail. Den inneholder ikke child cue. Etter sletting er session reference fjernet, og visningen viser bare tombstone-status.

## Faktisk implementasjon versus proof

Kontraktene, adaptergrensene, state machine, no-resurrection og rolleprojeksjonene er faktisk implementert og maskinelt testet. Browserflaten er et faktisk kjørbart teknisk proof, men er ikke endelig navigasjon, visuell identitet, produktcopy eller mobilarkitektur.

Hele WP13.7 er ikke fullført. PWA/offline shell, komplett app-shell, endelig lydflyt, installasjon, produksjonspersistens og release-hardening forblir utenfor WP13.7A.
