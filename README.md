# LUDYS — rekonstruert R1-baseline

**Versjon:** `0.14.0-reconstructed.6`

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
- providerfri WP13.9-authoringpipeline med åtte komplette BM-/NN-pakker, deterministisk import/eksport, lokal non-receipt-review og permanent publiseringsblokk
- teknisk audio production pipeline med seks specs per aktivitet, stale/replacement/withdrawal og to deterministiske, ikke-menneskelige WAV-fixtures
- lite Audio Content System og Knowledge Content System
- tilgjengelig browserproof og 320 px reflow
- B8-evidensmotor som ikke kan autorisere pilot
- 117+ kompilerte tester, service-worker-kontrakt og ni Chromium-bevis
- maskinell rekonstruksjonsvakt

## Det som ikke er rekonstruert ennå

Ekstern språk-/målform-/uttale-/co-design-review, validert progresjon, faktisk menneskelig lydproduksjon, produksjonsdeployment, provider-/emulatorarbeid, betaautorisasjon og ekstern evidens står fortsatt i `docs/RECONSTRUCTION_GAP_REGISTER.md`.

## Kjøring

```bash
npm ci
npm run check
```

Lokal visning:

```bash
npm run build
npm run serve:proof
```

## Autoritet

Les først:

1. `RECONSTRUCTION.md`
2. `docs/CURRENT_STATUS.md`
3. `docs/RECONSTRUCTION_GAP_REGISTER.md`
4. `docs/ROLE_AND_AGENT_BOUNDARIES.md`
5. `AGENTS.md`
