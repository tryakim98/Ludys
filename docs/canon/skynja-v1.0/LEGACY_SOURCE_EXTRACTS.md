# LEGACY SOURCE EXTRACTS — REFERENCE ONLY

> **REFERENCE_ONLY:** Disse utdragene dokumenterer relevante gamle regler. De skal ikke brukes til å overstyre SKP-kanonen.

## Masterplan 6.6 — eldre produktkjerne

Den daværende produktkjernen beskrev produktet som blant annet:
- menneskestyrt,
- deterministisk,
- øktbundet,
- dataminimert,
- uten runtime-generert coaching,
- uten fri tekstgenerering i elevruntime,
- uten automatisk kryssøktpersonalisering.

Samme del krevde blant annet at systemet skulle:
- kunne vente,
- kunne være stille,
- kunne pause og stoppe,
- bevare støtteproveniens,
- skille uavhengig handling fra støttet forsøk.

**Konsolidert vurdering:** De første absolutte restriksjonene er i stor grad supersedert av SKP-031, SKP-026, SKP-047–SKP-049. Kontroll, stillhet, pause/stopp og støtteproveniens beholdes.

## Masterplan 6.6 — release og versjonering

Den gamle planen krevde separat versjonering av app, innhold, kunnskap, lyd og skjema, samt et immutable manifest for pilotkandidat.

**Konsolidert vurdering:** Beholdes og bør utvides til modell-/policyversjoner der AI påvirker reproduksjon.

## Masterplan 6.6 — kilde- og forskningsregel

Kilder skulle ha stabile ID-er, kontrollert dato, claim scope, begrensninger og re-verifiseringsport.

**Konsolidert vurdering:** Beholdes og inngår nå i SKP-041 og SKP-042.

## Phase 13 / WP13.3 — ren arkitektur

Prototypearkitekturen skilte core, ports, adapters, application, composition, content og UI, og holdt kjernen fri for UI, database, auth og provider.

**Konsolidert vurdering:** Beholdes som arkitekturprinsipp. Runtime-AI kan finnes bak eksplisitte grenser uten å gjøre domenekjernen providerbundet.

## Phase 13 / WP13.4 — staged readiness

WP13.4 skilte teknisk/syntetisk readiness fra faktisk menneskelig, juridisk, etisk og organisatorisk readiness og tillot ikke kode å autorisere pilot alene.

**Konsolidert vurdering:** Beholdes som styringsprinsipp. De konkrete juli-2026-statusene er historiske, ikke evig produktkanon.
