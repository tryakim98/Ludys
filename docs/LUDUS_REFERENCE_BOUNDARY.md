# Grense mot LUDUS

LUDUS er en separat nettplattform. LUDYS er en separat app.

## Kan brukes som referanse

- tilgjengelighetsporter
- 320 px reflow og zoomtester
- fokus- og tastaturkontroller
- arkitekturvakter
- eksplisitte loading/error/recovery-mønstre
- kvalitets- og CI-prinsipper

## Skal ikke overføres ukritisk

- LUDUS-domene, spill- og klasseromsmodell
- Firebase-regler basert på korte spillkoder
- auth-, analytics- eller deploymentkoblinger
- LUDUS-produktidentitet
- brukerdata eller produksjonskonfigurasjon

LUDUS er ikke dependency, monorepo-rot eller arkitekturautoritet for LUDYS.
