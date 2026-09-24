# Gjeldende status — Skynja, 24. september 2026

## Produktretning og kilde

Produktet heter **Skynja**. [Kanon 1.0](canon/skynja-v1.0/README_FIRST.md) er gjeldende arbeidsretning. Alle 50 prinsipper er registrert i `config/skynja-canon-integration.json`; designadopsjon og implementasjon er separate statuser. Se [integrasjonsrapporten](SKYNJA_CANON_INTEGRATION.md).

Repositoryet er fortsatt `tryakim98/Ludys`, med teknisk pakkeidentitet `ludys-app-reconstructed` og versjon `0.14.0-reconstructed.9`. Øvelsesrommet og gjennomgangspakken er integrert i `integration/installable-alpha` via [PR #13](https://github.com/tryakim98/Ludys/pull/13) og [PR #14](https://github.com/tryakim98/Ludys/pull/14), siste merge `86b18a7`. Nytt arbeid på `feature/review-notes` gir praktisk registrering og gjenåpning av gjennomgangsnotater. Endelig GitHub-status står i pull requesten. Ingen pilot-/produksjonsbeslutning inngår.

## Hva som finnes nå

- Den rekonstruerte syntetiske appen, WP13.8-elevkatalogens åtte aktiviteter og WP13.9-forfatterverktøyet er bevart.
- Forfatterverktøyet har ti startpakker. De to nyere pakkene «Måne og såpe» og «Kake og bake» har BM/NN og tolv lydmanus. Revisjon 2 følger formålsstyrt støtte og verdsetter støttet gjennomføring uten å kalle den uavhengig lesing. Fagreview gjenstår.
- **Øvelsesrommet har 13 interaktive øvelser og 56 runder i sju typer**, med komplette bokmåls- og nynorskvarianter. «Måne og såpe» og «Kake og bake» har fem runder hver. Alle runder har hint, løsningsforslag, forklaring og valgfri refleksjon. Den nye **Finn tekstbeviset** krever både et svar og tilhørende tekstgrunnlag, med egne valg for rimelig slutning og manglende informasjon. Se [nyeste leveranserapport](SKYNJA_TEXT_EVIDENCE_2026-09-23.md).
- Brikker og svarvalg er koblet til tilbakemelding, pause, hopp over, stopp og en nøytral oppsummering. Kildetilbaketrekking, sperring og offline-cache følger innholdet. Utvidelsen gir ikke elevscore eller uavhengig leseevidens.
- **Innholdsgjennomgang i appen** viser begge målformer, alle runder, svar, hint og tekstgrunnlag. Eksport til Markdown, JSON og en tom vurderingsmal binder innholdet til SHA-256 per sett, øvelse og målform. 26 reviewoppføringer er tomme; faktisk fag-/språkreview er ikke registrert. Sperret innhold utelates også offline.
- **Arbeidsnotater i gjennomgangen** knytter observasjon og endringsforslag til øvelse, målform, runde og eksakt innhold. Lokal JSON-eksport og kontrollert gjenåpning virker offline. Uferdige skjemaer beholdes ved øvelsesbytte; notater og uferdig tekst utsetter appoppdatering. Sperring og sletting dominerer ventende filinnlesing. Dette registrerer ingen revieweridentitet eller godkjenning.
- **Pilotforberedelsen** har en konkret [arbeidsrekkefølge og gjennomføringsguide](SKYNJA_PILOT_PREPARATION.md), et tomt manuelt testskjema og en generert pakke for innholdsgjennomgang. En egen GitHub-jobb tester det installérbare bygget og lagrer logger, skjermbilder og pakken. Den gamle releasekjeden beholdes.
- Kanonpakken er lagret bytebevart; manifest, 50 prinsipper, 20 beholdte regler og lokal migrasjonsdekning kontrolleres maskinelt.
- Historiske globale AI-/profil-/taleforbud er avgrenset til de 85 eksisterende proofmodulene. Kompatible sikkerhets- og autorisasjonskontroller gjelder fortsatt.
- Nye rene kontrakter og porter modellerer versjonert bibliotekgrunnlag, evidens, claims, scoped bruksbeslutninger, tilbaketrekking og språkdimensjoner. Application-laget kan levere kontrollerte utdrag valgt gjennom en port og avstå ved feil, stopp eller endrede forutsetninger.
- Kontraktene er ikke koblet til en AI-provider eller den kjørbare elevflaten. Ingen godkjent fagkunnskap, reell personprofil eller bruker-/situasjonsdata er lagt inn i det nye biblioteket. Alle positive bibliotekeksempler finnes bare som tydelig syntetiske testfixtures.

## Porter som ikke er lukket av kanonintegrasjonen

Runtime-AI, identitet, kontinuitet, multimodalitet og kalibrert inferens er **tillatte produktretninger**, ikke evige forbud. Konkrete integrasjoner trenger fortsatt implementasjon, riktig datagrunnlag, relevant review og formåls-/mandatstyring.

Kanonpakken gir ingen nye receipts for klinisk bruk, ekte data, skoleeierbeslutning, B8, studentbeta eller produksjon. STOP, pause, withdrawal, sletting/no-resurrection, proveniens og tilgjengelighet videreføres.

WP13.12B-kode og historiske eksterne aktiveringsartefakter finnes i repositoryet. Faktisk cloudinventar er ikke kontrollert på nytt i denne leveransen. Gamle utsagn om «cloud resources 0» eller at WP13.12B ikke finnes, er ikke dagens inventarbevis. Se `release/wp13-12b/external-activation/` og [gapregisteret](RECONSTRUCTION_GAP_REGISTER.md).

## Teststatus for denne leveransen

| Kontroll | Faktisk resultat |
|---|---|
| Kanonintegritet og migrasjonsdekning | Bestått: ni filhasher, 50 prinsipper og 20 beholdte regler |
| `test:canon` | 5 bestått, 0 feil |
| Kompilerte tester | 351 bestått, 0 feil; åtte nye tester for notatbinding, importkonflikter, ugyldige filer, sperring, forsinkede svar, tekstvisning og gjenåpningsbar eksport |
| `check:pilot:technical` | Bestått: 13 kontrollsteg; det installérbare bygget i `deploy/` ble brukt i nettlesertestene. [Resultat](../artifacts/skynja-pilot-technical/result.json) og tilhørende logger viser lokal commit og urent arbeidsområde eksplisitt. |
| `test:pwa-contract` | 11 bestått, 0 feil |
| `test:exercises-browser` | Bestått: alle 112 målformsrealiserte runder, gjennomgangsside, faktisk Markdown-/JSON-/malnedlasting, notatfil tur-retur også offline, bevaring av uferdige skjemaer, tastatur/fokus, støtte, pause/stopp, 320 px, zoom, restriksjoner og offline-eksport |
| `test:authoring-browser` | Bestått: BM/NN, import/eksport, lydlivssyklus, tilbaketrekking etter vanlig offline-omlasting og tilgjengelighetskontroller |
| `test:pwa-browser` | Bestått: offline-skall, kontrollert oppdatering som venter på notater og uferdige skjemaer, og ingen gjenoppretting av stoppet/slettet økt |
| Bygg og installérbar pakke | Bestått lokalt |
| Lint, arkitektur, secretskann og rekonstruksjonskontroll | Bestått |
| Providerpakke, lokal runtimekompatibilitet og genererte kontrollsummer | Bestått; ingen ekstern aktivering |
| `npm run check` | Ikke bestått: stopper i `staging:validate:compiled` med `PINNED_GIT_WINDOWS_RUNTIME_REQUIRED` på Linux |

Fullkontrollens Windows-port er beholdt. Windows-kjøringen etter PR #14 bestod installasjon og verifikasjon av fastlåst Git-runtime, men stoppet i `test:pinned-git-toolchain` fordi det autentiske T-objektet for T→U-proofen mangler (`568d9f9e306075a81f6e4b243d3812507f97b230`). Ny appkontroll er separat fra denne historiske releaseporten. Senere steg i kjeden er bare erklært bestått når de er kjørt separat og står i tabellen. Øvelsesrommets vanlige offline-omlasting fungerer i Chromium 153. En målrettet probe viste at tvungen oppfriskning med `ignoreCache` omgår kontrollerende service worker i dette miljøet; testene for vanlig PWA-omlasting bruker derfor normal reload. Nettlesertesten venter nå eksplisitt på et nytt dokument før den kontrollerer tilstand etter omlasting, slik at den ikke leser status fra forrige side. Fysisk enhet og manuell skjermleser er ikke gjennomgått.

## Historikk

Den tidligere nåstatusfilen er arkivert uendret i [TECHNICAL_STATUS_BEFORE_SKYNJA_2026-09-23.md](history/TECHNICAL_STATUS_BEFORE_SKYNJA_2026-09-23.md). Den dokumenterer tidligere rapportering, ikke ny autoritet eller ferske kvitteringer.
