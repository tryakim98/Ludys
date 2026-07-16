# Agentregler — rekonstruert LUDYS

1. Dette repositoryet er LUDYS, ikke LUDUS.
2. Ikke importer fra eller skriv til LUDUS/Vikingspill-main.
3. Ikke framstill historisk `0.13.1` eller dens commit/tree som nåværende kodeidentitet.
4. Ikke legg til runtime-AI, provider, auth, database eller nettverk uten eksplisitt senere port.
5. Ikke opprett stabil child-, student- eller user-ID.
6. Core kan bare importere andre core-moduler.
7. All brukerrettet tekst og lydspesifikasjon skal være menneskelig reviewet i kontrakten.
8. `STOP` skal dominere, `WAIT` skal være first-class, og slettet økt skal aldri kunne gjenopplives.
9. BM og NN skal være first-class og aldri blandes i samme bundle.
10. Agentrapport er ikke bevis uten lokal diff og faktisk testresultat.
11. Alle endringer skal bestå `npm run check`.
12. Les `docs/RECONSTRUCTION_GAP_REGISTER.md` før nytt scope åpnes.
