# Skynja — produktkanon og eksisterende LUDYS-proof

**Gjeldende produktretning:** [Skynja-kanon 1.0](docs/canon/skynja-v1.0/README_FIRST.md), integrert 23. september 2026. Se [integrasjonsrapport og migrasjonskart](docs/SKYNJA_CANON_INTEGRATION.md) og [nåstatus](docs/CURRENT_STATUS.md). Alle 50 prinsipper er akseptert som arbeidsretning; dette betyr ikke at alle kapabilitetene er bygget.

Den første kodeintegrasjonen omfatter versjonert kunnskapsgrunnlag, avgrenset bruksautoritet, tilbakekalling, avståelse ved manglende dekning og separate språkdimensjoner. AI-provider, personlig minne og ekte data er ikke koblet til. Repositorynavn, pakkeversjon og historiske ID-er beholdes for kompatibilitet.

Beskrivelsen under dokumenterer den eksisterende syntetiske proofen. Dens lokale fravær av AI/profil eller voksenstyrte aktiviteter er ikke generelle forbud i den nye kanonen.

**Nytt øvelsesrom:** [13 interaktive øvelser, 56 runder og sju typer på bokmål og nynorsk](docs/SKYNJA_TEXT_EVIDENCE_2026-09-23.md). **Finn tekstbeviset** kobler et valgt svar til teksten som støtter det, med et eget valg når informasjonen mangler. Åpnes med **Åpne øvelsesrom** på startsiden. Innholdet har hint, løsningsforslag og begrunnede tilbakemeldinger, og er merket som utkast for faglig og språklig gjennomgang.

**Visuell oppdatering:** [Felles Skynja-uttrykk, tydeligere arbeidsflater og rolige animasjoner](docs/SKYNJA_VISUAL_REVIEW_2026-09-24.md). Startsiden, øvelsesrommet, innholdsgjennomgangen og verkstedet deler typografi, farger og navigasjon. Ordbrikker beveger seg mellom brikkebanken og svaret; innstillingen for redusert bevegelse respekteres. Mobilbredde, mørk modus og faktisk nettleseroppførsel kontrolleres med `npm run test:visual-browser`.

**Pilotforberedelse:** [Gjennomgangspakke og neste konkrete trinn](docs/SKYNJA_PILOT_PREPARATION.md). Hele øvelsesinnholdet kan sammenlignes og lastes ned fra **Øvelsesrom → Gå gjennom innhold**. Registrer funn per målform og runde, og ta med arbeidsnotatene som en fil som kan åpnes igjen. Appoppdateringer venter mens du har notater eller uferdig tekst. `npm run check:pilot:technical` kontrollerer det bygde appskallet, alle 112 målformsrealiserte runder, eksport og offlineflyt. Full releasekontroll og faktisk menneskelig review er egne porter.

Tidligere innholdsarbeid: [to nye BM/NN-utkast i Innholdsverksted, 22. september 2026](docs/CONTENT_EXPANSION_2026-09-22.md) – måne → såpe og kake → bake, med voksenkort, kunnskap, situasjonskort og lydmanus for fagreview.

**Versjon:** `0.14.0-reconstructed.9`

**Status:** intern, lokal og syntetisk rekonstruksjonsbaseline  
**Pilot/B8:** ikke autorisert

Dette er den første verifiserbare versjonen i en ny rekonstruksjonslinje for den selvstendige LUDYS-appen. Den er bygget fra den bevarte WP13.4-kildebasen, men har ny Git-historikk og ny identitet.

Den er **ikke** den tapte historiske versjonen `0.13.1`, og den påstår ikke å gjenskape den byte for byte.

## Det som faktisk finnes i R1

- ren TypeScript-kjerne med `core / ports / application / adapters / composition / ui`
- én autoritativ syntetisk økt med separate barne- og voksenprojeksjoner
- Human-Presence-First: `WAIT`, hjelp, arbeidsro, pause, stopp og voksenoverstyring
- støtteproveniens og skille mellom støttet og uavhengig respons
- BM- og NN-bundles med stabile semantiske ID-er
- review-gated WP13.8-corpus med fire norske draftklasser, åtte aktiviteter og eksplisitte BM-/NN-varianter
- støtteproveniens, voksenkort, knowledge/context og 48 ikke-innspilte lydspesifikasjoner
- restriktiv content-lifecycle for `CURRENT / STALE / SUPERSEDED / WITHDRAWN` uten session- eller persondata i PWA-cache
- providerfri WP13.9-authoringpipeline med åtte historiske BM-/NN-pakker og to nyere utkast, deterministisk import/eksport, lokal non-receipt-review og publiseringsblokk i denne proofen
- teknisk audio production pipeline med seks specs per aktivitet, stale/replacement/withdrawal og to deterministiske, ikke-menneskelige WAV-fixtures
- fail-closed kommandokonvolutt, sentrale sessioninvarianter, seedet kaostest og eksplisitt recovery uten gjenoppliving
- lokal crash boundary som stopper lyd, kansellerer pending handlinger og bevarer STOP ved tekniske feil
- uavhengig og sporbar lokal rollback for app, innhold, kunnskap og lyd
- releasegate med CSP/headere, supply-chain-kontroll, SBOM, lisensinventar, checksums, ytelsesbudsjetter og reproducerbart clean-copy-build
- komplett WP13.11 operations-kit med nøyaktig 27 semantiske artefakter og 54 separate BM-/NN-filer (`nb`/`nn`)
- integrert `Betaoperasjon` for adult-only syntetisk dry-run, identifierguard, SEV0, STOP, deletion/no-resurrection, rollback, withdrawal og lokal deterministisk eksport
- maskinlesbar måleordbok og datainventar som teknisk blokkerer elevmål, profilering, inferens og score
- komplett WP13.12A-beslutningspakke med fem provideralternativer, region- og capabilityanalyse, dataflyt, trust boundaries, trusselmodell, kost/exit/no-go, blank mal og checksum-bundet produkteierbeslutning
- integrert providerbeslutningsflate i BM-/NN-varianter; `APPROVE_RECOMMENDED_SYNTHETIC_DEV` er historisk registrert, mens faktisk aktivering må dokumenteres med egne porter og receipts i WP13.12B-sporet
- lite Audio Content System og Knowledge Content System
- tilgjengelig browserproof og 320 px reflow
- B8-evidensmotor som ikke kan autorisere pilot
- kompilerte kontrakt-/scenariotester, service-worker-kontrakt og historiske Chromium/Edge-bevis; faktisk resultat for denne leveransen står i nåstatus
- maskinell rekonstruksjonsvakt

## Det som ikke er rekonstruert ennå

WP13.12B har kode og historiske eksterne artefakter i repositoryet; det er ikke grunnlag for å lese eldre «cloud resources 0»-status som fersk inventarstatus. Gjenværende ekstern review, cloudreceipts, staging-/releaseporter, produksjonslyd og betaautorisasjon er beskrevet i `docs/RECONSTRUCTION_GAP_REGISTER.md`. Den nye Skynja-migrasjonen spores separat i integrasjonskartet.

## Kjøring

```bash
npm ci
npm run check:release
```

Lokal visning:

```bash
npm run build
npm run serve:proof
```

## Autoritet

Les først:

1. `docs/canon/skynja-v1.0/AGENT_BOOTSTRAP.md` og leserekkefølgen der
2. `docs/SKYNJA_CANON_INTEGRATION.md`
3. `AGENTS.md`
4. `docs/CURRENT_STATUS.md` og `docs/RECONSTRUCTION_GAP_REGISTER.md`
5. `RECONSTRUCTION.md` og `docs/ROLE_AND_AGENT_BOUNDARIES.md`
