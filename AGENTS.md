# Agentregler — Skynja i det eksisterende LUDYS-repositoryet

1. Produktet heter **Skynja**. `tryakim98/Ludys`, pakkeidentiteten og historiske ID-er beholdes for sporbarhet; dette er ikke LUDUS/Vikingspill.
2. Les `docs/canon/skynja-v1.0/AGENT_BOOTSTRAP.md` og følg leserekkefølgen der. Les deretter `docs/SKYNJA_CANON_INTEGRATION.md`, `docs/CURRENT_STATUS.md` og gapregisteret før nytt scope åpnes.
3. SKP-001–SKP-050 er gjeldende produkt-/designkanon. Historiske masterplaner, kode, tester og eksempler kan ikke gjeninnføre eksplisitt reviderte produktforbud. `config/skynja-canon-integration.json` sporer alle 50 prinsipper; akseptert retning er ikke det samme som implementert funksjon.
4. AI, korrigerbart langtidsminne, multimodalitet, kalibrert inferens og identitet er tillatte designretninger. Konkrete provider-/dataflyter, ekte brukerdata, klinisk bruk, pilot og deployment har egne beslutninger; kanonpakken aktiverer ingen av dem.
5. Faglige AI-påstander krever godkjent, versjonert bibliotekgrunnlag. Autoriserte bruker-/situasjonsdata og AI-inferens er egne kildetyper. Modellens treningskunnskap og automatisk web-fallback er ikke faglige runtimekilder. Forskning og bibliotekspromotering skjer separat.
6. Core kan bare importere core; provider- og UI-koblinger ligger bak porter/adaptere. Ingen skjult runtimeavhengighet til LUDUS.
7. Bevar faktisk review og proveniens. Utkast kan lages og merkes som utkast; ikke konstruer menneskelig review, godkjent bibliotekinnhold, receipts eller effektbevis. Språk- og konstruktbærende innhold krever relevant review før godkjent bruk.
8. Eksplisitt pause og `STOP` respekteres, stillhet/venting er legitime valg, og sletting/withdrawal skal dominere reconnect, restore og forsinkede svar.
9. Én semantisk kjerne med språkbevisste realiseringer: UI-språk, output-språk, målform og talemål er separate dimensjoner. Bokmål er ikke master for nynorsk; manglende variant/review gir ikke skjult fallback.
10. Historiske proofkontrakter beholdes i sitt dokumenterte scope. `config/legacy-proof-scope.json` lister eksisterende moduler; flytting eller navneendring er ikke en migrasjon og skal ikke brukes til å omgå kontrollene.
11. Agentrapport er ikke bevis uten lokal diff, filinnhold og faktiske testresultater. Syntetiske tester er ikke menneskelig, juridisk, klinisk eller reell brukervalidering.
12. Kjør `npm run canon:check`, `npm run test:canon` og `npm run check`. Bevar porter som krever annet miljø; rapporter konkret hvor kontrollen stopper. Ikke framstill historisk `0.13.1` som nåværende kodeidentitet.
