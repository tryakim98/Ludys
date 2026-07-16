# Rekonstruksjons-gapregister

| ID | Område | Status | Kilde | Notat |
|---|---|---|---|---|
| GAP-001 | Full syntetisk ende-til-ende-appflyt | DOCUMENTED_HISTORICALLY_NOT_YET_RECONSTRUCTED | WP13.7 | Start, rollevalg, økt, aktivitet, fullføring og tydelig avslutning. |
| GAP-002 | Installérbar PWA og offlinevennlig shell | DOCUMENTED_HISTORICALLY_NOT_YET_RECONSTRUCTED | WP13.7 | Ingen service worker eller manifest er verifisert i R1. |
| GAP-003 | Barn/voksen rolleflyt gjennom hel applikasjon | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.7 | R1 har projeksjoner, men ikke komplett appnavigasjon. |
| GAP-004 | Create/resume/pause/stop/delete/reconnect | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.7 | STOP finnes i domenet; komplett livsløp må bygges og bevises. |
| GAP-005 | No-resurrection etter stopp og sletting ved reconnect | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.7 | Eksisterende stopptest er ikke full reconnectproof. |
| GAP-006 | Loading/empty/stale/invalid/recovery states | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.7 | Skal være synlige og rolleavgrensede. |
| GAP-007 | Responsivt app-shell for mobil/nettbrett/desktop | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.7 | Browserproof dekker deler, ikke full app. |
| GAP-008 | Tastatur, fokus, 320 px reflow og reduced motion i full flyt | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.7 | Må testes gjennom hele kritiske flyten. |
| GAP-009 | Tilgjengelig lydstart/stopp/replay/tekstalternativ i full flyt | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.7 | Dagens prototypelyd er intern og syntetisk. |
| GAP-010 | Draft læringscorpus og progresjonsprototype | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.8 | Corpusutvidelse er styrt og lukket til eksplisitte innholdsleveranser. |
| GAP-011 | Authoring-, content- og lydproduksjonspipeline | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.9 | Må støtte review, withdrawal og versjonering. |
| GAP-012 | Reliability/security/release hardening | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.10 | Chaos, rollback og uavhengig app/content/audio-release gjenstår. |
| GAP-013 | Komplett betaoperasjons- og målepakke | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.11 | Ingen ekte pilot eller måledata. |
| GAP-014 | Provider-/emulator-/staginggrenser | NOT_AUTHORIZED | WP13.12 | Ingen cloud, auth, database eller ekte data i R1. |
| GAP-015 | Ekstern aktivering og autentiske receipts | EXTERNAL_EVIDENCE_REQUIRED | External | Kan ikke fabrikeres i kode. |
| GAP-016 | PR-3 | BLOCKED_BY_OWNER_OR_REVIEW | Governance | Ikke oppnådd. |
| GAP-017 | B8-beslutningsklarhet | BLOCKED_BY_OWNER_OR_REVIEW | Governance | Ekstern review, ansvar, DPIA og operative krav gjenstår. |
| GAP-018 | Studentbeta | NOT_AUTHORIZED | Governance | Kan ikke åpnes av intern rekonstruksjon. |
| GAP-019 | PEX-B03 alder, identitet og verdighet | BLOCKED_BY_OWNER_OR_REVIEW | Product Excellence | Chat-/spesifikasjonssporet må levere før kodeimplementasjon. |
| GAP-020 | Senere PEX-innhold og full migrering | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | Product Excellence | Må migreres kontrollert, ikke masseproduseres. |

## Statusdefinisjoner

- `VERIFIED_PRESENT_IN_R1`: verifisert i kode og tester.
- `DOCUMENTED_HISTORICALLY_NOT_YET_RECONSTRUCTED`: dokumentert i historisk status, men ikke bevist i R1.
- `NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED`: gjeldende krav som må bygges.
- `EXTERNAL_EVIDENCE_REQUIRED`: kan ikke lukkes med intern kode.
- `BLOCKED_BY_OWNER_OR_REVIEW`: krever produkteier eller faglig/juridisk review.
- `NOT_AUTHORIZED`: skal ikke startes uten nytt eksplisitt vedtak.
