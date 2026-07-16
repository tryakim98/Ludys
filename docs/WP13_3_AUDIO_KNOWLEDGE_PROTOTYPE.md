# WP13.3 — Small Audio and Knowledge Prototype

## Omfang

- 12 semantiske kunnskapsenheter
- 8 situasjonskort
- 12 lydspesifikasjoner
- BM/NN under samme stabile IDs
- 3 aldersinnganger
- 5 temaer
- 8 behovskategorier
- 2, 5 og 10 minutters fordypning

## Reviewstatus

Alt innhold er `INTERNAL_REVIEW`. Human-First og maskinell tilgjengelighetsstruktur er kontrollert. Ekstern pedagogisk, bokmåls-, nynorsk-, alders-/verdighets- og co-design-review gjenstår før B8.

## Audio

To lydfamilier har BM/NN-assets som statiske syntetiske kladder. Formålet er bare å bevise metadata, resolver, SHA, tydelig avsender, kontroll, replay, stopp og tekstfallback. Resten er spec-only.

Ingen asset er `PUBLISHED`. Ingen asset er `HUMAN_RECORDING`.

## Integrasjon

Voksenkortet i `activity-simple-blend-23` bruker:

- `knowledge-word-support-001`
- `context-word-help-001`
- `audio-word-support-001`

Disse resolveres fra samme release som kunnskapsbanken.

## Blockers før B8

- faktisk menneskelig opptak og rettighetsavklaring
- ekstern språk- og pedagogikkreview
- alders- og stigma-review
- co-design med voksne og elever
- større representativ stimulus- og kunnskapsprøve
- manuell skjermlesertest
- review av dialekt og uttalevariasjon
- eksplisitte terskler for forståelse, voksenbelastning og skade
