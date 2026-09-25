# RETAINED LEGACY RULES

Dette dokumentet inneholder eldre LUDYS-prinsipper som fortsatt er verdifulle etter revisjonsarbeidet.

**Tolkning:**
- `BEHOLDT`: regelen gjelder fortsatt innen sitt scope.
- `BEHOLDT, MEN REVIDERT`: kjernen beholdes, men absolutte eller gamle formuleringer må leses gjennom ny SKP-kanon.
- Ingen regel her kan brukes til å gjenopplive en eksplisitt supersedert regel i `SKYNJA_REVISED_CANON_V1_0.md`.


## LEG-001 — Standalone-first og tydelige systemgrenser

**Status:** Beholdt. Separat produkt/repository og eksplisitte systemgrenser reduserer utilsiktet kobling og gjør Skynja mulig å utvikle uavhengig.

Separate build/release-grenser; ingen skjult runtimeavhengighet til LUDUS; eksplisitte adaptere ved eventuell deling.

## LEG-002 — Ren domenekjerne og ports/adapters

**Status:** Beholdt som arkitekturprinsipp, men 'fri for AI-SDK' er ikke lenger et absolutt produktkrav i alle lag.

Domeneinvarianter og autoritetsregler skal være testbare uten UI/provider. Providerintegrasjon legges bak eksplisitte grenser.

## LEG-003 — Prove-then-share

**Status:** Beholdt.

Ikke del kode/pakker mellom produkter før reell semantisk overlapp er bevist av minst to faktiske konsumenter.

## LEG-004 — Versjonering og immutable manifests

**Status:** Beholdt og styrket.

Bind app-, innholds-, kunnskaps-, språk-/audio-, modell-/policy- og skjema-versjoner til release/evidens når reproduksjon er viktig.

## LEG-005 — Kildeproveniens og re-verifisering

**Status:** Beholdt og integrert i det nye kunnskapsbiblioteket.

Kilder og claims har stabile ID-er, scope, kontrollert dato, status, begrensninger og re-verifiseringstriggere.

## LEG-006 — Syntetisk test er ikke menneskelig eller reell validering

**Status:** Beholdt.

Tester, mocks og syntetiske scenarioer kan bevise kontrakter og feilmodi, men kan ikke late som de lukker fag-, bruker-, juridiske eller real-use-porter.

## LEG-007 — Tilgjengelighet som releasekriterium

**Status:** Beholdt.

Semantikk, tastatur, fokus, zoom/reflow, tekstskalering, touch, skjermleser, kontrast, reduced motion og multimodal tilgang bygges inn fra starten.

## LEG-008 — Stop, pause og brukerens kontroll

**Status:** Beholdt, men utvidet av SKP-046.

Eksplisitt stopp dominerer ventende handlinger. Pause/stopp skal ikke gi tap, skam eller motivasjonsinferens.

## LEG-009 — Støtteproveniens og konstruktintegritet

**Status:** Beholdt, men revidert av SKP-043 og SKP-048.

Systemet skal kunne vite hvilken støtte som var tilgjengelig og hva som faktisk ble produsert. Støtte må ikke kontaminere en måling som eksplisitt skal måle uten den støtten.

## LEG-010 — No-resurrection og kontrollert sletting

**Status:** Beholdt.

Slettede/utløpte objekter skal ikke gjenoppstå gjennom restore, reconnect, migrasjon eller support. Nye derivater krever nytt legitimt grunnlag.

## LEG-011 — Least privilege og rollebasert tilgang

**Status:** Beholdt, men generalisert av SKP-013, SKP-027 og SKP-036.

Relasjon gir ikke automatisk tilgang. Se, bidra, styre og dele er separate rettigheter knyttet til konkret formål og mandat.

## LEG-012 — Ikke én skjult totalscore

**Status:** Beholdt.

Unngå globale dysleksi-, readiness-, motivation-, engagement-, risk- og kompetansescore som skjuler multidimensjonal evidens.

## LEG-013 — Adverse effects, burden og nonresponse må måles

**Status:** Beholdt.

Pilot/evaluering må inkludere belastning, ikke-respons, feil, uønskede virkninger og hvem løsningen ikke hjelper – ikke bare positive utfall.

## LEG-014 — Rollback, reversibilitet og synlige konsekvenser

**Status:** Beholdt.

Konsekvensrike endringer skal være forklarlige og reversible der det er mulig. Feil skal bevare brukerens arbeid.

## LEG-015 — Secrets, provider- og sikkerhetsgrenser

**Status:** Beholdt.

Ingen credentials i repo, eksplisitt providerautoritet, datalokalitet/sekundærbruk må vurderes, og kritiske integrasjoner skal ha fail-safe.

## LEG-016 — BM/NN-kvalitet og dialektverdighetsvern

**Status:** Beholdt, men arkitekturen er revidert av SKP-050.

Nynorsk kan ikke være ukontrollert bokmålsoversettelse. Dialekt er ikke feil eller modenhetssignal. Språkspesifikke stimuli må valideres for sitt konstrukt.

## LEG-017 — Arbeidsro og stillhet er legitime systemtilstander

**Status:** Beholdt.

Skynja skal ikke produsere råd, varsler eller feedback bare fordi systemet kan. Ingen handling kan være riktig handling.

## LEG-018 — Klar avsender og ingen falsk menneskeidentitet

**Status:** Beholdt i ny form.

Skynja kan være varm, dialogisk og psykologisk kompetent, men skal ikke utgi seg for å være en faktisk lærer, terapeut, venn eller menneskelig støtteperson.

## LEG-019 — Separasjon mellom forskning, produktclaim og releaseclaim

**Status:** Beholdt og styrket av SKP-042.

At en mekanisme har forskning betyr ikke at Skynjas implementasjon er validert; implementasjon og produktutfall krever egne evidenslag.

## LEG-020 — Staged release og menneskelige beslutningsporter

**Status:** Beholdt som styringsmønster, men ikke som gammelt universelt lærer-gate-prinsipp.

Teknisk readiness, innholdsreview, ekstern evidens, juridisk/sikkerhetsmessig beslutning og real-use-autorisasjon skal ikke blandes.
