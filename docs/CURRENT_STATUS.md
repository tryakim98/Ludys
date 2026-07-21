# Gjeldende teknisk status — R1 + WP13.7C

```text
Product: LUDYS
Repository: ludys-app-reconstructed
Version: 0.14.0-reconstructed.4
Baseline: WP13.4 functional proof + WP13.7A lifecycle chassis + WP13.7B app journey + WP13.7C local PWA shell
Data: synthetic and session-bound
Runtime AI: none
Provider/backend/auth: none
B8: NOT DECISION READY
Pilot: NOT AUTHORIZED
Student beta: NOT AUTHORIZED
Lifecycle persistence/transport: deterministic in-memory proof only
WP13.7 production scope: NOT COMPLETE; local PWA/offline proof only
```

## R1-dom

R1 bevarer og beviser WP13.4-funksjonsgrunnlaget under ny, sporbar Git-identitet. Senere dokumenterte funksjoner er ikke automatisk rekonstruert.

WP13.7A la til en isolert lifecycle-flyt. WP13.7B kobler den samme autoritative, lokale lifecycle-kontrakten til appens normale startside og beviser en sammenhengende syntetisk reise med eksplisitt opprettelse, rollevalg, orientering, aktivitet, separate barn-/voksenprojeksjoner, WAIT, hjelp, arbeidsro, pause/resume, recovery, stop, completion, oppsummering, sletting, no-resurrection og en ny separat økt.

WP13.7C legger til et lokalt installérbart manifest, et smalt og versjonert service-worker-shell, tilgjengelig offline-/oppdateringsstatus og browserproof for oppstart og navigasjon uten nett etter første onlineinnlasting. Cache Storage inneholder bare et avgrenset statisk shell og er aldri autoritativ sessionstate. Oppdatering overtar ikke automatisk en aktiv økt.

Beviset er lokalt, syntetisk og maskinelt. Provider, auth, produksjonspersistens, ekte data, produksjonsdeployment, bakgrunnssynkronisering, pushvarsler, manuell hjelpemiddeltest og ekstern fag-/språk-/co-design-review er ikke åpnet eller påstått fullført.
