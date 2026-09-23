# Rekonstruksjonskontrakt

**Autoritet fra 23. september 2026:** [Skynja-kanon 1.0](docs/canon/skynja-v1.0/README_FIRST.md) styrer videre produktdesign. Denne kontrakten dokumenterer rekonstruksjonslinjen og dens avgrensede proof; historiske forbud er ikke generelle Skynja-regler. Se [integrasjonskartet](docs/SKYNJA_CANON_INTEGRATION.md).

## Beslutning

Den historisk dokumenterte LUDYS-kodebasen `0.13.1` finnes ikke som verifiserbare bytes. Videre arbeid skjer derfor i en ny og ærlig rekonstruksjonslinje.

## Regler

- Historisk `0.13.1` er mål-/gapinformasjon, ikke kildekodebevis.
- Nåværende repositoryidentitet er alltid faktisk lokal Git-identitet.
- LUDUS og LUDYS er separate produkter.
- LUDUS-kode kan bare brukes som kontrollert referanse; LUDUS er ikke runtimeavhengighet eller base-repo.
- Rekonstruksjon skjer i små arbeidspakker med full testkjede.
- Ingen B8-, pilot-, studentbeta- eller ekstern evidensstatus kan oppnås gjennom intern kode alene.
- Den historiske proofen bruker ikke runtime-AI eller stabil personprofil. SKP-001/002/026/029/031/047 åpner kalibrert inferens, kontinuitet og AI som produktretning; dette aktiverer ikke provider eller ekte data. Skjult profilering og kliniske konklusjoner uten evidens/mandat er fortsatt uakseptabelt.
- BM og NN er språkbevisste realiseringer av én semantisk kjerne (SKP-050). Eksisterende separat review og eksport bevares under kontrollert migrasjon; de er ikke separate produkter.

## Versjonslinje

- Verifiserbar kildebaseline: `0.4.0`, commit `88b0f4be6ff14c7f6fa52d0c74426a372c097abe`.
- Historisk tapt linje: `0.13.1`, kun dokumentert i statusmateriale.
- Ny linje: `0.14.0-reconstructed.1` og videre.
