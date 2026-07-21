# WP13.7A — state transitions og invariants

## Hendelseskontrakt

Alle godkjente overganger går gjennom `transitionLifecycle(state, event)`. Avviste overganger returnerer samme state-objekt og en typed error; de kaster ikke bort autoritativ state.

| Fra | Hendelse | Til / resultat |
|---|---|---|
| `NOT_CREATED` | `CREATE` | `CREATING` |
| `CREATING` | `CREATED` | `READY` |
| `READY` | `ACTIVATE` | `ACTIVE` |
| `ACTIVE` | `REQUEST_HELP` | `WAITING`, eksplisitt help flag |
| `ACTIVE` | `ENTER_WAIT` | `WAITING`, uten implisitt intervensjon |
| `WAITING` | `RESUME` | `ACTIVE` |
| `ACTIVE` / `WAITING` | `PAUSE` | `PAUSED`, med eksplisitt resume target |
| `PAUSED` | `RESUME` | tidligere `ACTIVE` eller `WAITING` |
| `ACTIVE` / `WAITING` | `COMPLETE` | `COMPLETED` |
| `READY` / `ACTIVE` / `WAITING` / `PAUSED` | `DETECT_STALE` | `STALE`, med recovery target |
| `READY` / `ACTIVE` / `WAITING` / `PAUSED` | `DETECT_INVALID` | `INVALID`, med recovery target |
| `STALE` / `INVALID` | `BEGIN_RECOVERY` | `RECOVERING` |
| `RECOVERING` | `RECOVERY_SUCCEEDED` | lagret recovery target |
| `RECOVERING` | `RECOVERY_FAILED` | `INVALID` |
| ikke-terminal, opprettet state | `STOP` | `STOPPED`, authority generation økes |
| opprettet state unntatt `DELETED` | `DELETE` | `DELETED`, payload fjernes fra repository og tombstone opprettes |
| `READY` / `ACTIVE` / `WAITING` / `PAUSED` / `STALE` / `INVALID` / `RECOVERING` / `COMPLETED` | `RECONNECT` | samme state med ny teknisk versjon |
| `STOPPED` | `RECONNECT` | fortsatt `STOPPED` |
| `STOPPED` | `DELETE` | `DELETED` / tombstone |
| `DELETED` | alle hendelser | avvist; reconnect gir `TOMBSTONE` |

`STOP` er også tillatt fra `CREATING`, `STALE`, `INVALID` og `RECOVERING`, slik at en teknisk mellomtilstand aldri kan blokkere eksplisitt stopp. `STOP` er ikke en snarvei ut av `NOT_CREATED` eller `COMPLETED`.

## Typed errors

- `INVALID_TRANSITION`
- `NO_RESURRECTION`
- `TOMBSTONE`
- `NOT_FOUND`
- `STALE_WRITE_REJECTED`
- `DISCONNECTED`
- `INVALID_PAYLOAD`
- `RECOVERY_FAILED`

## Beviste invariants

1. `STOPPED` kan ikke bli `ACTIVE` igjen.
2. `DELETED` avviser alle hendelser og kan aldri gjenopplives.
3. Reconnect etter stopp beholder stoppet view model.
4. Reconnect etter sletting returnerer tombstone og aldri øktinnhold.
5. Bare eksplisitte gyldige hendelser kan endre state.
6. Ugyldig overgang returnerer typed error og samme state-identitet.
7. Eldre versjon kan ikke overskrive nyere state; ikke-terminal state kan heller ikke overskrive autoritativ STOP selv med høyere versjonsnummer.
8. Tombstone avviser alle senere save-forsøk.
9. Recovery etter STOP/DELETE avvises med no-resurrection.
10. Barnets og den voksnes view models har separate felter.
11. All lifecycle demo-state bærer `SYNTHETIC_TECHNICAL_DRAFT`.
12. Sletting er deterministisk og etterlater bare minimal tombstone.

## Adapterscenarioer

Reconnect-adapteren har fast, observerbar latency og scenarioene `CONNECTED`, `DISCONNECTED`, `STALE_SNAPSHOT`, `INVALID_PAYLOAD`, `RECOVERY_SUCCESS` og `RECOVERY_FAILURE`. Repository-load etter sletting dominerer et vanlig connected-scenario og returnerer `TOMBSTONE`.

Ingen av scenarioene gjør nettverkskall.
