# WP13.7C — lokal PWA og offline-shell — sluttrapport

Dokumentnavnet følger den bestilte arbeidspakkedatoen 2026-07-21. Sluttverifikasjonen ble utført 2026-07-22.

## Baseline

- Branch ved start: `main`
- Commit: `a69f24766eebc52d286ec6b7b779cd481c095fac`
- Tree: `104fe176dda439a728f1569769bd9a6396456c89`
- Baseline var squash-merget hotfix for Linux-browsercleanup.
- Lokal `main` samsvarte med `origin/main`, arbeidstreet var rent, offentlig `npm ci` besto, lokal `npm run check` besto og main Actions-kjøring `29874875217` var grønn.
- WP13.7C-branch: `feature/wp13-7c-local-pwa-offline-shell`
- Rekonstruksjonsversjon: `0.14.0-reconstructed.4`

## Manifest

`web/manifest.webmanifest` beskriver den lokale syntetiske LUDYS-demonstrasjonen med stabil app-ID og smalt `/web/`-scope. Manifestet har navn, kortnavn, nøktern beskrivelse, språk, start-URL, standalone-visning, bakgrunns-/temafarge og lokale prosjektikoner i 192 × 192 og maskable 512 × 512 variant.

Chromiums `Page.getAppManifest` og `Page.getInstallabilityErrors` rapporterte ingen manifest- eller installability-feil i browserproofet. Dette er et lokalt teknisk installability-bevis, ikke et produksjons- eller appbutikkbevis.

## Service worker og cachingstrategi

`web/service-worker.js` bruker cache `ludys-shell-0.14.0-reconstructed.4` og en eksplisitt, deterministisk liste over HTML, CSS, manifest, ikoner og den faktiske ES-modulavhengighetskjeden for appen.

- Install henter hver kritiske shellressurs og feiler hele worker-installeringen ved manglende eller ikke-OK ressurs.
- Activate sletter bare cacher med `ludys-shell-`-prefiks som ikke er gjeldende versjon. Urelaterte cacher beholdes.
- Navigasjoner innen `/web/` forsøker nettverk og faller tilbake til cached `/web/index.html`.
- Bare kjente lokale statiske shellressurser bruker cache-first. Ukjente lokale GET-kall går videre uten cachemutasjon.
- `POST`, `PUT`, `PATCH`, `DELETE` og eksterne origins blir aldri interceptet eller cachet.
- Cachelisten er begrenset og inneholder ingen API-ruter, auth, bruker-, elev-, profil- eller sessionpayloads.

## Oppdateringsstrategi

Worker-koden bruker ikke automatisk `skipWaiting`. En ventende versjon vises i den tilgjengelige statusflaten. Aktiveringsknappen er bare tilgjengelig før sessionstart eller i `STOPPED`, `DELETED` og `COMPLETED`. Først etter eksplisitt brukerhandling sendes `LUDYS_ACTIVATE_UPDATE` til den ventende workeren; da aktiveres den og siden lastes på nytt.

`web/service-worker-update-proof.js` er en test-only worker som browserproofet bruker til å skape en reell waiting-worker. Den er ikke del av app-shell-cachen.

## Offline- og oppdateringsstatus

BM og NN har separate typed statusbundles. Statusflaten:

- viser online/offline med tekst, `role="status"` og `aria-live`, ikke bare farge
- forklarer at appskallet er lokalt og at sessionen bare finnes i nettleserminnet
- påstår ikke synkronisering
- blokkerer eller skjuler ikke STOP
- viser ventende oppdatering og om den må utsettes til en trygg sessiontilstand
- har tastaturbetjent oppdateringsknapp og synlig fokus fra eksisterende fokuskontrakt

Status- og terminal fallback-tekst har `humanReviewed: true` og reviewkilden `WP13.7C_SCOPE_2026-07-21` i kontrakten. BM og NN blandes ikke i samme bundle.

## Sessionstate-grenser

Eksisterende lifecycle-controller og in-memory repository er fortsatt eneste autoritative sessionstate. PWA-laget oppretter ingen alternativ state machine, repository, transport eller persistens.

- Cache Storage inneholder bare statiske filer og kan ikke gjenopprette en session.
- Offline reload starter i `NOT_CREATED`; cached HTML eller JavaScript viser ikke en tidligere aktiv session.
- Hver sideinstans får et nytt, tilfeldig og kun sessionbundet namespace. Det er ikke en stabil person-, barn-, elev- eller brukeridentitet.
- STOP og DELETE forblir terminale ved reconnect og ved offline/online-overgang.
- Ny session får ny ID og tom aktivitetsstate.
- Kontrollert service-worker-oppdatering laster appen på nytt uten å gjenopplive gammel session.

Ingen påstand om produksjonspersistens eller tombstone på tvers av nettleserlagring gjøres; beviset viser i stedet at ingen gammel in-memory-session ligger i app-shell-cachen.

## Sikkerhet og personvern

- Service-worker-scope er `/web/`.
- Bare same-origin, eksplisitt listede statiske filer caches.
- Ingen tokens, credentials, persondata, telemetry, analytics eller crash reporting er lagt til.
- Ingen auth, database, provider, ekstern transport, Firebase eller runtime-AI er lagt til.
- Ingen bakgrunnssynkronisering, pushvarsler eller automatisk datasending ved nettretur finnes.
- Secret scan, rekonstruksjonsport, Human-First static check og arkitekturgrense besto.

## Tilgjengelighetsproof

WP13.7C-browserproofet kontrollerer statusroller og tilgjengelige navn, tastaturbetjent kontrollert oppdatering, synlig/tilgjengelig STOP, 320 px reflow, 2× zoom og `prefers-reduced-motion`. Offline-statusen bruker eksplisitt tekst og lokal forklaring. Eksisterende fullreiseproof bevarer skip-lenke, fokus, hovedlandemerke, live status/alert og kontrollmål på minst 44 × 44 CSS-piksler.

Dette er et maskinelt internt proof. Full WCAG-konformitet, manuell skjermleser-/AT-godkjenning, ekstern språk-/co-design-review eller produksjonsgodkjenning påstås ikke.

## Tester og browserproof

- Kompilerte tester: `82/82` bestått.
- Cleanup-enhetstester: `10/10` bestått.
- PWA-/service-worker-kontrakttester: `8/8` bestått.
- Nytt WP13.7C offline-browserproof: `10/10` sammenhengende stressrunder bestått.
- Samlet browserproof: `7/7` i minst tre komplette runder bestått.
- `npm run check`: tre komplette grønne runder etter implementasjon.
- `git diff --check`: bestått.
- Restprofiler: `0`.
- Hengende proof-servere og profilbundne browserprosesser: `0`.

Offline-browserproofet dekker online install/control/cache, faktisk nettverksfrakobling, reload fra cache, lokal hovedreise, tilgjengelig offline-status, terminal STOP/DELETE, nettverksretur, ny separat session og brukerinitiert worker-oppdatering uten gjenoppliving.

## Eksplisitte ikke-påstander og gjenværende gap

WP13.7C åpner eller beviser ikke autentisering, stabil brukeridentitet, produksjonspersistens, database, ekstern transport, skysynkronisering, Firebase, analytics, crash reporting, runtime-AI, ekte persondata, produksjonsdeployment, bakgrunnssynkronisering eller pushvarsler.

Fortsatt åpne gap er produksjonstransport/-persistens, auth/personlig kontinuitet, full app-lydflyt, manuell AT-/co-design-/språkreview, bred browser-/enhetsmatrise, reliability/security/release-hardening, rollback/produksjonsobservability og alle eksterne B8-/pre-beta-receipts. GAP-002 er derfor redusert av teknisk proof, ikke lukket som produksjonskapabilitet.

## Sluttstatus

`WP13_7C_COMPLETE`
