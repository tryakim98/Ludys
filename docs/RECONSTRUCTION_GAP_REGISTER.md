# Rekonstruksjons-gapregister

| ID | Område | Status | Kilde | Notat |
|---|---|---|---|---|
| GAP-001 | Full syntetisk ende-til-ende-appflyt | VERIFIED_PRESENT_IN_R1 | WP13.7 | WP13.7B beviser den komplette lokale syntetiske reisen fra normal startside til terminaltilstand og ny separat økt. Dette er ikke produksjonsflyt. |
| GAP-002 | Installérbar PWA og offlinevennlig shell | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.7 | WP13.7C beviser lokalt manifest, avgrenset service worker, kontrollert shell-cache, offline reload og lokal navigasjon etter første onlineinnlasting. Produksjonsdeployment, bred browser-/enhetsreview og release-hardening gjenstår. |
| GAP-003 | Barn/voksen rolleflyt gjennom hel applikasjon | VERIFIED_PRESENT_IN_R1 | WP13.7 | WP13.7B beviser rollebytte mellom avgrensede projeksjoner av én autoritativ lokal økt. Ekstern co-design og endelig produktreview gjenstår. |
| GAP-004 | Create/resume/pause/stop/delete/reconnect | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.7 | WP13.7B beviser kontrakten gjennom full lokal UI; WP13.7C bevarer den gjennom offline/online. Produksjonspersistens og transport er ikke åpnet. |
| GAP-005 | No-resurrection etter stopp og sletting ved reconnect | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.7 | State machine, repository, tombstone og browserproof beviser terminaldominans lokalt, og WP13.7C beviser at cache/reload/update ikke gjenoppliver gammel økt. Reell transport og produksjonsmiljø gjenstår. |
| GAP-006 | Loading/empty/stale/invalid/recovery states | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.7 | Loading, empty, stale og recovery er synlige i full lokal flyt; produksjonsfeilhåndtering og endelig ekstern UX-review gjenstår. |
| GAP-007 | Responsivt app-shell for mobil/nettbrett/desktop | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.7 | Full syntetisk app er maskinelt bevist ved 320 og 1280 piksler samt 2× zoom; bred enhets-/manuell review gjenstår. |
| GAP-008 | Tastatur, fokus, 320 px reflow og reduced motion i full flyt | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.7 | WP13.7B browserproof dekker hovedreisen, tastatur, fokus, 320 px, 2× zoom, AX-tre og reduced motion; manuell skjermleser-/AT-review gjenstår. |
| GAP-009 | Tilgjengelig lydstart/stopp/replay/tekstalternativ i full flyt | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | WP13.7 | Dagens prototypelyd er intern og syntetisk; full app-lydflyt er ikke åpnet. |
| GAP-010 | Draft læringscorpus og progresjonsprototype | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.8 | Fire foreløpige norske klasser, åtte review-gated aktiviteter, BM/NN, støtteproveniens, content-lifecycle og tre voksenstyrte draftkanter er autentisk integrert i dagens app-/PWA-linje. Ekstern språk-, målform-, uttale-, konstrukt- og progresjonsreview gjenstår; innholdet er ikke publisert eller betaautorisert. |
| GAP-011 | Authoring-, content- og lydproduksjonspipeline | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.9 | Providerfri authoringmodell/controller/UI, åtte BM-/NN-pakker, lokal non-receipt-review, deterministisk import/eksport, teknisk WAV-validering, stale/replacement/withdrawal og offline no-resurrection er autentisk integrert. Ekstern språk-/uttale-/construct-review, faktiske menneskelige opptak, rettigheter og publisering gjenstår. |
| GAP-012 | Reliability/security/release hardening | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.10 | Fail-closed kommandokonvolutt, invarianter, 4096-kommandoers deterministisk chaos, recovery/crash boundary, no-resurrection, uavhengig app/content/knowledge/audio-rollback, lokal Edge/PWA-proof, supply-chain-gater, SBOM/lisenser, ytelsesbudsjetter og to identiske clean-copy-builds er implementert. Fysisk plattformreview, Firefox/Safari, manuell AT-review, produksjons-SW-observability, produksjonsrollback og ekstern attestasjon gjenstår. |
| GAP-013 | Komplett betaoperasjons- og målepakke | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.11 | 27 semantiske artefakter i 54 separate BM-/NN-filer (`nb`/`nn`), adult-only syntetisk dry-run, måle-/datagrense, identifierguard, driller, lokal eksport og browserproof er implementert. Menneskelig språk-, juridisk, etisk, skoleeier- og tilgjengelighetsreview, eksterne receipts, B8 og ekte pilotdata gjenstår. |
| GAP-014 | Provider-/emulator-/staginggrenser | PARTIALLY_REDUCED_BY_TECHNICAL_PROOF | WP13.12A | Fem provideralternativer, region/capability, dataflyt, trust boundaries, datagrense, sletting, logging, IAM, kost, trussel, exit og no-go er kildebelagt og maskinelt validert. Teknisk minimum er anbefalt, men ikke valgt. Produkteierbeslutning er pending; provideraktivering og WP13.12B er blokkert; cloud resources er 0; auth, database, nettverk og ekte data finnes ikke i runtime. |
| GAP-015 | Ekstern aktivering og autentiske receipts | EXTERNAL_EVIDENCE_REQUIRED | External | Kan ikke fabrikeres i kode. |
| GAP-016 | PR-3 | BLOCKED_BY_OWNER_OR_REVIEW | Governance | Ikke oppnådd. |
| GAP-017 | B8-beslutningsklarhet | BLOCKED_BY_OWNER_OR_REVIEW | Governance | Ekstern review, ansvar, DPIA og operative krav gjenstår. |
| GAP-018 | Studentbeta | NOT_AUTHORIZED | Governance | Kan ikke åpnes av intern rekonstruksjon. |
| GAP-019 | PEX-B03 alder, identitet og verdighet | BLOCKED_BY_OWNER_OR_REVIEW | Product Excellence | Chat-/spesifikasjonssporet må levere før kodeimplementasjon. |
| GAP-020 | Senere PEX-innhold og full migrering | NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED | Product Excellence | Må migreres kontrollert, ikke masseproduseres. |

## Statusdefinisjoner

- `VERIFIED_PRESENT_IN_R1`: verifisert i kode og tester.
- `PARTIALLY_REDUCED_BY_TECHNICAL_PROOF`: kontrakt og/eller isolert proof reduserer gapet, men produkt-, produksjons- eller ekstern evidens gjenstår.
- `DOCUMENTED_HISTORICALLY_NOT_YET_RECONSTRUCTED`: dokumentert i historisk status, men ikke bevist i R1.
- `NEWER_PRODUCT_REQUIREMENT_NOT_YET_IMPLEMENTED`: gjeldende krav som må bygges.
- `EXTERNAL_EVIDENCE_REQUIRED`: kan ikke lukkes med intern kode.
- `BLOCKED_BY_OWNER_OR_REVIEW`: krever produkteier eller faglig/juridisk review.
- `NOT_AUTHORIZED`: skal ikke startes uten nytt eksplisitt vedtak.
