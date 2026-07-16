# LUDYS — rekonstruert R1-baseline

**Versjon:** `0.14.0-reconstructed.1`  
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
- lite Audio Content System og Knowledge Content System
- tilgjengelig browserproof og 320 px reflow
- B8-evidensmotor som ikke kan autorisere pilot
- 55 kompilerte tester og tre Chromium-bevis
- maskinell rekonstruksjonsvakt

## Det som ikke er rekonstruert ennå

Den fulle syntetiske ende-til-ende-applikasjonen, PWA/offline-shell, komplett sesjonslivsløp, reconnect/recovery, provider-/emulatorarbeid, senere Product Excellence-innhold og ekstern evidens står i `docs/RECONSTRUCTION_GAP_REGISTER.md`.

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
