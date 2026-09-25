# Skynja — visuell gjennomgang, 24. september 2026

Startsiden ga teknisk status og intern terminologi like stor plass som selve øvelsene. Denne oppdateringen gir Skynja en felles visuell identitet og kortere, konkrete tekster gjennom de viktigste arbeidsflatene.

## Endringer

- Startsiden prioriterer øvelsesrommet, innholdsverkstedet og grunnøvelsene. Teknisk bakgrunn og verktøy er tilgjengelige i et utfellbart felt.
- En enkel Skynja-signatur, blå aksent, mørk tekst, lyse flater og tydeligere typografi går igjen i navigasjonen, katalogen, gjennomgangen og verkstedet. Appnavn og ikoner følger produktnavnet.
- Katalogen har lettere kort og tydelig valgte filtre. Aktive oppgaver har en rolig leseflate, synlig rundeframdrift og bedre plass til brikkene. Ordoppgaver bruker to spalter på større skjermer.
- Brikker beveger seg kort mellom banken og svaret. Skjermbytter, hint og tilbakemeldinger får korte overganger på 200–260 ms. Animasjonene endrer ikke oppgavetilstand eller ventetid. Redusert bevegelse hindrer nye animasjoner og avbryter pågående animasjoner.
- Gjennomgangspakken samles i et utfellbart felt. Arbeidsnotater og filimport er fortsatt tilgjengelige direkte. Verkstedet bruker vanlige norske feltnavn og har tekniske referanser samlet i egne detaljer.
- Mobilvisning, mørk modus, tastaturfokus og systemets innstillinger for bevegelse inngår i samme presentasjonslag. Ingen skrifttjeneste eller ny avhengighet er lagt til.

## Kontroller og sporbarhet

`test:visual-browser` åpner appen i Chromium, utfører tastaturhandlinger og lagrer åtte skjermbilder i `artifacts/skynja-design-*.png`. Den kontrollerer 1440/320 px uten horisontal overflyt, synlige startkontroller på minst 44 px, bokmål/nynorsk på startsiden, faktisk animasjon ved katalog- og brikkeendring, fokus, hint, pause/stopp, primærknappens kontrast i lys/mørk visning, redusert bevegelse, 200 % visningszoom og konsollfeil. Skjermbildene er også visuelt kontrollert i arbeidsmiljøet.

Kontrollen inngår som steg 14 i `check:pilot:technical` og er lagt til i den eksisterende fullkontrollen. De øvrige appkontrollene dekker alle 112 målformsrealiserte runder, gjennomgang, faktisk filnedlasting, notater og offlineoppførsel. Faktiske resultater og begrensninger står i [nåstatus](CURRENT_STATUS.md) og [testloggen](../artifacts/skynja-pilot-technical/result.json). GitHub-jobben bevarer skjermbilder sammen med det installérbare bygget i 14 dager.

Øvelsestekstene, semantiske ID-er og innholdshashene er uendret. Nye grensesnitttekster er utkast; historiske reviewregistreringer er bevart med sin opprinnelige tekst. Oppdateringen oppretter ingen menneskelig godkjenning eller effektpåstand. Fysisk enhet, manuell skjermleser og faktisk målgruppebruk gjenstår. Den historiske Windows-releaseporten er fortsatt separat.
