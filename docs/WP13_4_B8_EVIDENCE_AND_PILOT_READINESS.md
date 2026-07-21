# WP13.4 — B8-evidens og pilotberedskap

**Status:** `IMPLEMENTERT SOM EVIDENSMOTOR, STAGED PILOTFORSLAG OG TILGJENGELIG STATUSFLATE`  
**B8:** `IKKE TATT`  
**Gjeldende maskinelle dom:** `NOT_DECISION_READY`  
**Rekruttering:** `IKKE AUTORISERT`  
**Ekte data:** `IKKE AUTORISERT`  
**Pilot:** `IKKE AUTORISERT`

## 1. Formål

WP13.4 gjør pilotberedskap konkret uten å omgjøre programvare til beslutningstaker. Implementasjonen:

- definerer ni evidensporter
- definerer 29 evidenskrav
- skiller krav før B8 fra vilkår etter en eventuell B8-beslutning
- definerer fem stoppregler
- definerer fire reopen-signaler
- definerer sju måleregler uten apptelemetri
- foreslår en liten, staged pilotramme
- viser status i en tilgjengelig nettleserflate
- kan maksimalt returnere `DECISION_READY_FOR_OWNER`
- kan aldri autorisere rekruttering, ekte data eller pilot

## 2. Nåværende dom

Maskinell vurdering av dossieret gir:

- beslutning: `NOT_DECISION_READY`
- blokkere før produkteier kan vurdere B8: 15
- vilkår etter en eventuell B8 og før rekruttering/første økt: 5
- reopen-signaler: 0 utløst
- pilotautorisering: alltid false

Dette er forventet. WP13.1–WP13.3 har bevist arkitektur, Human-First, tilgjengelig browservisning, aktivitet, kunnskaps- og lydkontrakter syntetisk. Følgende krever mennesker, organisasjoner, juridisk ansvar eller ekstern faglighet:

- norsk språkfaglig review
- Human-First/co-design-review
- manuell hjelpemiddelreview
- voksenbelastningsreview
- redaksjonell review av BM/NN, kunnskap og lyd
- skoleeier og behandlingsansvar
- behandlingsgrunnlag og DPIA-vurdering
- etisk klassifisering av utprøvingen
- sikkerhets-/miljøplan
- endelig frosne måle- og stoppregler

## 3. De ni portene

1. `LEARNING_FEASIBILITY`
2. `HUMAN_FIRST`
3. `CHILD_SAFETY`
4. `ACCESSIBILITY`
5. `ADULT_WORKLOAD`
6. `CONTENT_AUDIO_KNOWLEDGE`
7. `PRIVACY_LEGAL_ETHICS`
8. `SECURITY_OPERATIONS`
9. `PILOT_PROTOCOL`

Portene har ingen poengsum. Ett ulukket kritisk krav blokkerer riktig milepæl.

## 4. Blokkere før B8-beslutning

- `B8-LRN-01` — norsk språkfaglig review av mønsterklasse og stimuli
- `B8-LRN-02` — frosset feasibility-måleplan uten effektpåstand
- `B8-HP-02` — godkjent co-design-protokoll
- `B8-HP-03` — uavhengig språk-/verdighetsreview
- `B8-A11Y-02` — manuell skjermleser- og tastaturreview
- `B8-A11Y-03` — plan for representativ tilgjengelighetstest
- `B8-ADULT-02` — adult-only dry-run-protokoll og terskel
- `B8-CAK-02` — ekstern innholds-, målforms-, alder- og kildereview
- `B8-PRIV-01` — identifisert skoleeier/behandlingsansvarlig og roller
- `B8-PRIV-02` — godkjent datainventar, formål, grunnlag og sletting
- `B8-PRIV-03` — DPIA-screening og eventuell DPIA
- `B8-ETH-01` — klassifisering som produktutprøving, forskning eller kvalitetsarbeid
- `B8-AI-01` — juridisk kontroll av eventuell AI-assistanse og produktpåstander
- `B8-SEC-01` — trusselmodell og sikkerhetskrav
- `B8-PROT-02` — frosne måle-, stopp- og beslutningsregler

## 5. Vilkår etter mulig B8 og før utførelse

- `B8-SAFE-03` — navngitt beredskapslinje
- `B8-CAK-03` — menneskelig pilotlyd med rettigheter og review
- `B8-ETH-02` — alderstilpasset informasjon, foresattesamtykke og barns assent
- `B8-SEC-02` — separat provider-, credential-, data-, preview- og rollbackgrense
- `B8-OPS-01` — incident-, support-, withdrawal- og rollbackrunbook

Et eventuelt B8-vedtak må spesifisere om disse er absolutte før rekruttering eller før første økt. Dagens dossier tillater ikke at de omgås.

## 6. Foreslått pilotramme — ikke autorisert

```text
målgruppe: 6–9 år
modus: Guided Dyad – lærer
sted: maksimalt én pilotarena
omfang: 6–8 dyader
økter: maksimalt én økt per dyade
varighet: maksimalt 20 minutter
aktivitet: activity.word-build.sol-mus.v1
appdata: bare aktiv økt, slettes ved avslutning
måledata: separat strukturert skjema med tilfeldig kode
lydopptak: nei
fritekst i appen: nei
runtime-AI: nei
kryssøktprofil: nei
hjemme-/fjernbruk: nei
```

Rammen er en feasibility-pilot, ikke effektstudie. Den kan ikke underbygge generelle læringspåstander.

## 7. Staged rekkefølge etter eventuell B8

### Trinn A — ekstern fag- og tilgjengelighetsreview

Ingen barn. Gjennomgå:

- mønsterklasse og fonem-/grafemrepresentasjon
- BM/NN
- språk, verdighet og robotaktighet
- skjermleser og tastatur
- kunnskapsenheter og situasjonskort
- lydmanus og rettigheter

### Trinn B — adult-only dry-run

Ingen elevdata. Kontroller:

- om ett kort kan forstås raskt
- om `WAIT`, avvisning og overstyring er naturlig
- om arbeidsbelastningen er forsvarlig
- om kortet styrker relasjonen framfor å fortrenge den
- om stopp- og beredskapslinjen er forståelig

### Trinn C — liten dyadepilot

Bare dersom A og B består og alle vilkår før rekruttering er lukket.

- ett fysisk kontrollert sted
- én voksen per barn
- én kort aktivitet
- ingen hjemmebruk
- ingen remote synkronisering
- ingen vedvarende profil
- ingen apptelemetri
- direkte stoppmyndighet hos barn og voksen

## 8. Måleplan

Måling er strukturert og separat fra applikasjonen.

### Læring/gjennomførbarhet

- forstår barnet kjernehandlingen?
- gjennomfører barnet målbygging med tillatt støtte?
- gjennomfører barnet ett near-transfer-forsøk?
- bevares støtteproveniens?

Foreslått terskel: minst `N-1` av 6–8 dyader gjennomfører målbygging og transferforsøk. Dette er feasibility, ikke effekt.

### Human-Presence-First

- vet barnet at den faktiske voksne gir støtten?
- kan barnet be om arbeidsro, hjelp, pause og stopp?
- oppleves språket ekte og aldersverdig?
- kan voksen vente, avvise og overstyre?
- opptrer systemet som verktøy, ikke kunstig relasjon?

Ett kritisk falskt relasjonssignal pauser videre gjennomføring.

### Tilgjengelighet

- kan kritisk flyt gjennomføres med tastatur?
- kan kritisk flyt gjennomføres med godkjent skjermleseroppsett?
- er fokus, reflow, tekst og kontrollstørrelser tilstrekkelige?
- kan lyd stoppes, repeteres og erstattes av tekst/stillhet?

Én utilgjengelig kritisk handling blokkerer videre gjennomføring.

### Voksenbelastning

Foreslått terskel: minst `N-1` voksne kan forstå, avvise eller handle på kortet innen et foreslått 20-sekunders vindu. Vinduet må fryses etter adult-only dry-run.

## 9. Stoppregler

### Kritisk

Stopp/pause straks dersom:

- barnet ber om stopp eller viser tydelig ubehag
- pause/stopp ikke virker
- slettet økt gjenopplives
- skjult persondata oppstår
- barnet tror systemet kjenner, føler, lytter til eller diagnostiserer det

### Major

Pause piloten dersom samme robotaktige, stigmatiserende, overstyrende eller utilgjengelige problem opptrer i to økter.

### Minor

Logg og review en enkelt friksjon som ikke gir skade eller tap av kontroll.

## 10. Personvern, etikk og ansvar

Før B8 må en konkret skoleeier/pilotpartner kunne dokumentere ansvar, databehandling og risikovurdering. Appens nullprofil løser ikke alene evalueringens personvern: strukturerte observasjoner, samtykke, kontaktlister og eventuelle koblingsnøkler er også behandlinger som må eies og avgrenses.

Konservativ baseline:

- aktivt, frivillig, informert og uttrykkelig foresattesamtykke
- alderstilpasset informasjon til barnet
- barnets aktive assent
- barnet kan avstå eller stoppe uten konsekvens
- ingen appbasert direkte identifikator
- eventuell kontakt-/koblingsnøkkel holdes av autorisert pilotpartner, adskilt fra observasjonsdata
- appsession slettes ved avslutning
- oppbevaring av evalueringsdata fastsettes i godkjent plan, ikke i produktkode
- ingen lyd-, video- eller skjermopptak som baseline

Utprøvingens juridiske/etiske kategori må bestemmes før rekruttering. Planlagt publisering, systematisk kunnskapsproduksjon, metode og type data påvirker hvilket løp som gjelder.

## 11. Regulatorisk kildegrunnlag kontrollert 14. juli 2026

- Utdanningsdirektoratet: *Barnehage- og skoleeiers personvernansvar*
- Utdanningsdirektoratet: *Behandle personopplysninger*
- Datatilsynet: *Vurdering av personvernkonsekvenser*
- Datatilsynet: *Funn fra tilsyn med personvernet i skolen* (2025)
- Utdanningsdirektoratet: *Ta hensyn til personvernet ved bruk av KI* (2026)
- NESH: *Uttalelse om passivt samtykke i Ungdata* (2021)
- Europakommisjonen: offisiell AI Act-tidslinje og veiledning

Kildene brukes til å definere review- og beslutningsporter, ikke til å avsi en endelig juridisk konklusjon. Gjeldende regelverk skal kontrolleres på nytt ved B8.

## 12. Sikkerhet og pilotmiljø

Før rekruttering må et separat pilotmiljø ha:

- eget prosjekt og formål
- egne credentials
- ingen Ludus-data eller identitet
- preview uten productiondata
- minimerte logger uten pedagogisk payload
- dokumentert sletting
- kill switch
- rollback
- navngitt incidentansvar
- supportkanal under økten
- ingen runtime-AI

Provider er fortsatt ikke valgt. WP13.4 oppretter ingen ressurs.

## 13. Hva evidensmotoren kan og ikke kan gjøre

Den kan:

- validere unike krav
- gruppere krav per port
- skille blokkere før beslutning fra senere vilkår
- gi `NOT_DECISION_READY`
- gi `DECISION_READY_FOR_OWNER`
- gi `REOPEN_REQUIRED`

Den kan aldri:

- godkjenne pilot
- godkjenne rekruttering
- godkjenne ekte data
- erstatte skoleeier, personvernansvarlig, etisk vurdering eller produkteier
- gjøre en score om til automatisk beslutning

## 14. Teknisk bevis

WP13.4 legger til:

- `src/core/b8-readiness.ts`
- `src/content/prototype/b8-readiness-dossier.ts`
- `src/application/b8-readiness-controller.ts`
- `src/composition/create-b8-readiness.ts`
- `src/ui/browser/readiness-templates.ts`
- unit-, property-, content- og scenariotester
- Chromium-test av statusflate, no-authorization, reflow og tilgjengelighetstre
- ny static gate mot implisitt pilot-, rekrutterings- eller ekte-dataautorisasjon

## 15. Sluttdom

> **WP13.4 har gjort B8-kravene eksplisitte, maskinlesbare og synlige, men dossieret er riktig klassifisert som `NOT_DECISION_READY`. Det gjenstår 15 blokkere før produkteieren kan vurdere B8 og fem vilkår før rekruttering eller første økt. Ingen pilot, deltaker eller ekte data er åpnet.**
