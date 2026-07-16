# WP13.7A — grenser og åpne beslutninger

## Bindende grenser som fortsatt er lukket

- Ingen Firebase, provider, database, autentisering, analytics, cloud eller deployment.
- Ingen ekte brukerdata, elevprofil, stabil personidentitet eller langsgående historikk.
- Ingen runtime-AI, TTS, stemmeanalyse eller generert coaching.
- Ingen runtime-nettverk i lifecycle repository eller reconnect-adapter.
- Ingen ferdig pedagogisk corpus, progresjonsmodell eller motivasjonsmekanikk.
- Ingen B8-, pilot-, PR-3-, rekrutterings- eller studentbetaautorisasjon.
- Ingen avhengighet til eller endring av LUDUS/Vikingspill.

## Kun teknisk proof

- Browserflaten er isolert og demonstrerer lifecycle-kontraktene; den er ikke komplett appnavigasjon.
- In-memory persistence og reconnect-simulator er kontraktproof, ikke produksjonspersistens eller transport.
- Latency er deterministisk metadata, ikke måling av virkelig nettverk.
- Observability samler bare lokale tekniske signaler; den er ikke telemetry eller analytics.
- Tombstone-formatet er et lokalt proof og er ikke en besluttet juridisk retentionmodell.
- Kryssplattform-browserresolveren bruker lokalt installert Edge/Chrome/Chromium; den laster ikke ned nettleser.

## Avventer Product Excellence og research

- Endelig språk for barnets og den voksnes state- og recoverymeldinger.
- Alder, identitet, verdighet og hvordan tekniske feil forklares uten å plassere ansvar hos barnet.
- Endelig rolleflyt, informasjonsarkitektur og visuell identitet.
- Pedagogisk progresjon, stimulusbank, motivasjon og belønning.
- Hvilke tilstander som skal være synlige som produktcopy versus intern diagnostikk.
- Manuell tilgjengelighetsreview, skjermlesertest og co-design.
- Valg av mobil-/webframework, installérbart shell og offlineproduktstrategi.

All ny UI-copy er derfor merket `DRAFT_TECHNICAL_COPY — subject to Product Excellence review` og finnes sentralt i BM/NN-varianter.

## Senere tekniske beslutninger som ikke er åpnet

- Provider, auth, datamodell, kryptering og produksjonsretention.
- Reell reconnect-protokoll, konfliktløsing og multi-device authority.
- Release/deployment, crash reporting og operativ monitorering.
- Sikkerhets-, chaos-, rollback- og reliability-hardening.

WP13.7A fullfører ikke hele WP13.7. Det reduserer teknisk risiko i GAP-001, GAP-003, GAP-004, GAP-005, GAP-006 og GAP-008 uten å lukke dem som produkt- eller produksjonsgap.
