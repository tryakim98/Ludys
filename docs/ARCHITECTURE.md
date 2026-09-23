# Arkitektur etter WP13.3

**Scope:** Arkitekturen under beskriver den eksisterende syntetiske proofen. [Skynja-kanon 1.0](canon/skynja-v1.0/README_FIRST.md) styrer videre utvikling. Nye rene kontrakter ligger i `src/core/skynja`, porter i `src/ports/skynja` og orkestrering i `src/application/skynja`; de følger samme dependencyretning. [Integrasjonsrapporten](SKYNJA_CANON_INTEGRATION.md) beskriver den første bibliotekgrensen og migrasjonsarbeidet som gjenstår.

## Dependencyretning

```text
content fixtures ───────────────┐
                               ▼
adapters → ports → application → core
    ▲                 ▲
    └──── composition ┘
             ▲
             └──── browser UI
```

Bindende regler:

- `core` importerer bare `core`
- `ports` kan importere rene typer fra `core`
- `application` kan importere `core` og `ports`, aldri `adapters`
- `adapters` implementerer porter
- `content` importerer bare rene kontrakter fra `core`
- `composition` kobler application, adapters og content
- `ui` kan importere application, core, content og composition, men eier ikke pedagogisk sannhet

## Integrert content graph

```text
release-knowledge-audio-prototype-001
  ├─ 12 knowledgeId
  │    └─ BM/NN variants
  ├─ 8 contextCardId
  │    └─ knowledgeId + activityId + expiry
  └─ 12 audioSpecId
       ├─ semanticContentId
       ├─ BM/NN script
       ├─ review / stale / withdrawal
       └─ optional internal-review asset
```

Det vertikale proofets voksenkort peker inn i denne grafen. Legacy-bundlefeltene er projeksjoner fra grafen gjennom `legacy-projections.ts`, ikke en ny manuelt vedlikeholdt kunnskapskilde.

## Knowledge Content System

`KnowledgeLibraryController` søker gjennom `KnowledgeCatalogPort`. Dagens adapter er ren in-memory. Filtrering er øyeblikksvis og stateless. Ingen filtervalg eller åpnet enhet lagres som persondata.

## Audio Content System

`AudioPrototypeSpecification` skiller:

- semantic ID og tekstrevisjon
- lydrolle og konstruktsensitivitet
- human-required / human-preferred / assistive policy
- script og plain-text fallback per målform
- optional asset med SHA-256 og kilde
- spec-only, internal-review, published og withdrawn
- current/stale
- user initiated, replay, immediate stop og silence alternative

Syntetiske candidate-assets er internal-review-only. UI viser tydelig at de ikke er menneskelige eller publiserte.

## Nettleserlaget

Kunnskapsbanken er en utskiftbar browservisning med:

- fem filtre
- liste og detaljvisning
- review- og kildeinformasjon
- tekstfallback
- native, brukerstartet audio control når intern kandidat finnes
- ingen autoplay
- 320-pikslers reflow
- tilgjengelige navn og kontroller

## Avgrensning av denne historiske proofen

Dette er ikke forbud mot å designe kapabilitetene i SKP-026/028/029/031. Den kjørbare proofen har fortsatt:

- ingen provider
- ingen auth eller datastore
- ingen elevprofil
- ingen runtime-AI eller dynamisk TTS
- ingen publisert lyd
- ingen B8/pilot

## B8-evidenslaget etter WP13.4

```text
content/prototype/b8-readiness-dossier
                    │
                    ▼
          core/b8-readiness
                    │
                    ▼
 application/b8-readiness-controller
                    │
                    ▼
       browser readiness projection
```

Evidenslaget er separat fra læringssessionen. Det:

- leser statiske evidenskrav
- lagrer ingen deltakerdata
- gjør ingen nettverkskall
- beregner ingen person- eller readiness-score
- kan ikke starte pilot
- kan ikke autorisere rekruttering eller ekte data
- returnerer bare beslutningsstatus og eksplisitte blokkere

B8-dossieret kan senere fylles med eksterne reviewreferanser, men endring av status må skje som reviewet innholds-/styringsendring. Runtimebrukere kan ikke endre portstatus.
