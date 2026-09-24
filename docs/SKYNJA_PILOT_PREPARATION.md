# Skynja — neste trinn mot pilot

Oppdatert 24. september 2026. Arbeidsgrunnlag etter Skynja-kanon 1.0. **Pilot er ikke åpnet.**

## Klar leveranse for gjennomgang

Øvelsesrommet inneholder 13 utkast, 56 semantiske runder og 112 eksplisitte bokmåls-/nynorskrealiseringer. Åpne **Øvelsesrom → Gjennomgå innhold** nederst i katalogen. Her vises introduksjon, formål, støtte, alle svaralternativer, hint, tilbakemeldinger, løsningsforslag, refleksjon og tekstgrunnlag. Begge målformer vises sammen. Gjennomgangen fungerer også offline etter at appen er lastet inn.

Tre filer kan lastes ned fra appen eller hentes fra den genererte pakken:

| Fil | Bruk |
|---|---|
| [content-review.md](../release/skynja-pilot-review/content-review.md) | Lesbar gjennomgang av hele innholdet |
| [content-snapshot.json](../release/skynja-pilot-review/content-snapshot.json) | Eksakte tekster, revisjoner og SHA-256 for sett, øvelse og målform |
| [review-form-template.json](../release/skynja-pilot-review/review-form-template.json) | 26 tomme vurderingsoppføringer, én per øvelse og målform |

Hashreferansene endres også når noen endrer tekst uten å øke revisjonstallet. Ingen reviewer, beslutning eller ekstern kvittering er forhåndsutfylt. En hash beviser innholdsbinding, ikke hvem som har vurdert materialet. Malen har ingen automatisk godkjennings-/publiseringsfunksjon. Faktisk reviewer, relevant kompetanse, mandat og underlag må kontrolleres av ansvarlig for gjennomgangen. Utfylte skjemaer leveres gjennom avtalt reviewkanal; det offentlige repositoryet skal bare inneholde tomme maler og ikke elevopplysninger.

Appens eksport utelater sperrede øvelser og bygges på nytt når restriksjoner endres. Den genererte Git-pakken følger de innsjekkede innholdspolicyene. Allerede nedlastede filer kan ikke trekkes tilbake fra mottakerens enhet; mottaker må kontrollere gjeldende versjon og restriksjoner før videre bruk.

## Arbeidsrekkefølge

| Prioritet | Ansvarlig rolle som må utpekes | Konkret leveranse | Nåstatus |
|---|---|---|---|
| 1 | Fagansvarlig og målformskompetente reviewere | Gjennomgå alle inkluderte runder i begge målformer; bind funn og konklusjon til pakken | Materiale og tomme skjemaer klare; menneskelig review gjenstår |
| 2 | Utviklingsansvarlig / eier av kildearkivet | Gjenfinne autentiske historiske Git-objekter T/U eller avklare en dokumentert migrasjon av den avgrensede proofen | Full releasekontroll er blokkert; ingen proof er omskrevet |
| 3 | Tilgjengelighetsansvarlig og representativ støtteperson | Praktisk gjennomgang på planlagt fysisk enhet med faktisk hjelpemiddel; logg kontroll, forståelse og belastning | Automatiske nettlesertester finnes; manuell gjennomgang gjenstår |
| 4 | Pilotansvarlig og relevante beslutningstakere | Avgrense målgruppe, arena, øvelser, støtte/lyd, evalueringsdata, ansvar, stoppregler og kriterier før pilotbeslutning | Må besluttes for den konkrete piloten |

Innholdsreview må undersøke tvetydige svar, alternative forsvarlige løsninger, målformskvalitet, riktige tekstbevis, konstruktet som faktisk øves, nyttig støtte og verdig tilbakemelding. Støttet gjennomføring skal beskrives med støtten som ble brukt. Det er ikke bevis på uavhengig lesing eller en læringseffekt. Det finnes foreløpig ikke innspilt opplesning for disse 13 utkastene. Behovet for opplesning og eventuell menneskelig opptaks-/rettighetsgjennomgang må avklares for valgt pilotgruppe.

Historisk [B8-dossier](WP13_4_B8_EVIDENCE_AND_PILOT_READINESS.md) og WP13.11-driftspakke inneholder tidligere porter og arbeidsmateriale. Den historiske rammen med én aktivitet beskriver ikke automatisk disse 13 øvelsene. Beslutningen må få eksplisitt nytt scope; eldre globale produktforbud er revidert av Skynja-kanon 1.0. Denne leveransen endrer ingen B8-beslutning, databehandlingsbeslutning eller ekstern aktivering.

## Praktisk gjennomgang før deltakerpilot

Dette er et forslag til en forberedende gjennomgang med fiktive eksempler. Det er ikke en invitasjon til å samle elevdata. Bruk den installérbare appen fra samme commit som testbeviset. Velg faktisk planlagt enhet og nettleser; noter versjoner og støtteverktøy i [tomt testskjema](SKYNJA_MANUAL_TRIAL_TEMPLATE.md).

1. Åpne øvelsesrommet. Finn ønsket målform og en øvelse uten veiledning om hvor knappene ligger. Noter uklarheter og behov for hjelp.
2. Prøv én oppgave i hver av de sju typene. Bruk feil svar, nytt forsøk, hint og løsningsforslag. Bekreft at teksten er forståelig og at hjelp ikke framstilles som selvstendig ferdighet.
3. I **Finn tekstbeviset**, prøv riktig svar med feil tekstgrunnlag. Det skal gi nytt forsøk. Prøv en begrunnet slutning og runden der teksten mangler informasjon. Gå gjennom alle seks runder på begge målformer.
4. Ta pause midt i et forslag. Vent, fortsett og kontroller at forslaget er bevart. Stopp deretter: forslaget og rundeoversikten skal fjernes. Tilbake, omlasting og gjenåpning skal ikke gjenopprette forsøket.
5. Etter første innlasting: koble fra nettet, last normalt på nytt og gjennomfør en ny øvelse. Test installasjon/oppstart fra hjemskjerm på den faktiske enheten, ikke bare en emulert mobilbredde.
6. Bruk kun tastatur og deretter planlagt skjermleser/hjelpemiddel. Kontroller leserekkefølge, fokus etter svar/hint/pause, navn på kontroller, forstørring, tekstskalering og touch. Automatisk tilgjengelighetstre er ikke manuell skjermlesergjennomgang.
7. Åpne innholdsgjennomgangen. Finn samme runde i begge målformer og last ned pakken. Registrer om støttepersonen forstår forskjellen på utkast, teknisk test og faktisk innholdsgjennomgang.

Registrer også ikke-gjennomføring, forvirring, belastning og mulige uønskede virkninger. Ingen tidsgrense eller poengberegning trengs i øvelsen. Avbryt den aktuelle gjennomgangen ved tap av kontroll, gjenoppståtte svar etter stopp, vist sperret innhold eller ubehag. Logg et konkret funn og la ansvarlig avklare retting og ny kontroll før videre utprøving. Terskler og restartmyndighet for en faktisk deltakerpilot må vedtas i pilotprotokollen.

## Repeterbar teknisk kontroll

```sh
npm ci
npm ci --prefix provider/firebase/functions
npm run check:pilot:technical
```

Krever en lokal Chromium-basert nettleser; sett `LUDYS_BROWSER_PATH` ved behov. Ingen runtimeavhengighet er lagt til. Kontrollen bygger `deploy/` og serverer nettlesertestene fra dette faktiske bygget. Den kjører kanon, statiske kontroller, kompilerte tester, oppdatert gjennomgangspakke, PWA-kontrakter og faktisk navigasjon, øvelser, eksport, forfatterverktøy og offlineoppførsel. Alle 112 målformsrealiserte runder gjennomføres med tastatur i øvelsestesten. Logger og resultat med commit, miljø og eventuell urent arbeidsområde ligger i `artifacts/skynja-pilot-technical/`.

GitHub-jobben `skynja-app-browser-and-offline` kjører på pull requests og ved oppdatering av integrasjonsgrenen. Den lagrer bygget, gjennomgangspakken, skjermbilder og testlogger som en nedlastbar Actions-artifact i 14 dager. Dette er en teknisk arbeidsleveranse; jobben publiserer ikke appen og autoriserer ikke pilot.

Etter innholdsendring: kjør `npm run build`, `npm run pilot:review:generate`, og gjennomgå diffen. `pilot:review:check` feiler dersom innsjekket pakke ikke svarer til nåværende innhold eller policy. Pakken genereres ikke automatisk over en gammel pakke under kontrollen.

Full `npm run check` og `npm run check:release` er beholdt. Linux stopper fortsatt ved `PINNED_GIT_WINDOWS_RUNTIME_REQUIRED`. Forrige Windows-kjøring bestod den fastlåste Git-runtimekontrollen, men fant ikke det autentiske T-objektet `568d9f9e306075a81f6e4b243d3812507f97b230` for T→U-proofen; U er `190fff88808bbafe605cdde4cfe9fe943f4543a4`. Den nye appkontrollen erstatter ikke denne releaseporten.
