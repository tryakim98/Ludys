# SKYNJA — REVIDERT ARBEIDSKANON

**Versjon:** 1.0  
**Dato:** 23. september 2026  
**Status:** `CONSOLIDATED_WORKING_CANON — OWNER-REQUESTED REVISION PACK`  
**Formål:** Konsolidere de reviderte produktprinsippene utviklet i prosjektarbeidet, samtidig som eldre regler som fortsatt er verdifulle beholdes eksplisitt.  
**Viktig:** Denne pakken er ikke i seg selv juridisk godkjenning, pilotautorisasjon, klinisk validering eller dokumentasjon av reell effekt.

## Autoritetsregel for denne pakken

Når en eldre LUDYS-regel kolliderer med en eksplisitt revisjon i `SKP-001–SKP-050`, gjelder den reviderte regelen som **arbeidsretning** for videre produktdesign og spesifikasjon. Eldre regler som er listet i `RETAINED_LEGACY_RULES.md` består innenfor sitt kompatible scope.

Denne pakken skal ikke brukes til å:
- late som menneskelig review er gjennomført,
- erklære pilot eller ekte-data-bruk autorisert,
- gjøre juridiske eller kliniske claims som kildene ikke støtter,
- gjenopplive gamle absolute forbud som eksplisitt er revidert her.

## Masterheuristikk

> **Ikke behandle risiko eller kompleksitet som grunner til å unngå et område. Spør om området kan hjelpe personen med dysleksi, og hvis svaret kan være ja: bygg evidens, safeguards, produktdesign og styring som gjør det forsvarlig å gjøre det godt.**

## Produktets nordstjerne

> **Skynja lærer hva som hjelper deg – og hjelper deg og menneskene rundt deg å lære det samme.**


---

## SKP-001 — Kalibrert tolkning: observasjon → mønster → hypotese → test

**Hva den erstatter eller reviderer**  
Gamle regler forsøkte i stor grad å hindre inferens, profilering og diagnostisk språk fra aktivitetshendelser.

**Ny kanon**  
Skynja skal kunne tolke det som skjer, men alltid skille mellom observasjon, mønster, funksjonell hypotese og klinisk etablert kunnskap. En hypotese skal være testbar, korrigerbar og uttrykkes med kalibrert sikkerhet. Feiltype, responstid eller enkeltatferd er aldri i seg selv årsaksforklaring eller diagnose.

**Bindende designkonsekvenser**
- Skill OBSERVATION, PATTERN, HYPOTHESIS og ESTABLISHED_FACT.
- Bevar alternative forklaringer.
- La ny evidens styrke, svekke eller forkaste hypoteser.
- Høyere konsekvens krever sterkere evidens og riktigere menneskelig mandat.

**Kort arkitekturregel**
> Observer konkret. Inferer kalibrert. Test hypoteser. Diagnose krever diagnostisk evidens.


---

## SKP-002 — Transparent, korrigerbar personlig modell

**Hva den erstatter eller reviderer**  
Langsgående profil og kryssøktpersonalisering var tidligere sperret.

**Ny kanon**  
Skynja skal kunne bygge en levende forståelse av personen over tid når dette gir brukerens støtte reell verdi. Modellen skal skille brukerutsagn, observerte mønstre, AI-hypoteser, støttepersonobservasjoner og profesjonelt etablerte fakta. Brukeren skal kunne se, forstå og korrigere det som påvirker støtten.

**Bindende designkonsekvenser**
- Profilen er en modell, ikke en fasit.
- Kilden til hvert minne eller claim skal bevares.
- Ubekreftede hypoteser skal ikke bli identitetsetiketter.
- Brukeren skal kunne korrigere og kontekstualisere.

**Kort arkitekturregel**
> Skynja skal lære personen å kjenne uten å late som modellen er personen.


---

## SKP-003 — Støttepersonen som medobservatør og medutforsker

**Hva den erstatter eller reviderer**  
Støttepersonrollen var tidligere snevert definert som øktleder eller mottaker av korte kort.

**Ny kanon**  
Støttepersoner kan bidra med konkrete observasjoner, erfaringer og kontekst. Slike data skal behandles som kildebestemte observasjoner, ikke automatisk sannhet om brukeren. Skynja skal støtte felles utforsking av hva som hjelper.

**Bindende designkonsekvenser**
- Konkret hendelse veier mer enn egenskapsdom.
- Skill observasjon fra tolkning.
- Bevar hvem som sa hva.
- Uenighet mellom bruker, støtteperson og system kan være informativ.

**Kort arkitekturregel**
> Støttepersonen kan bidra til modellen, men skal ikke definere personen.


---

## SKP-004 — Relasjonen som eksplisitt produktmål

**Hva den erstatter eller reviderer**  
Relasjonell motivasjon var tidligere viktig, men hovedsakelig som vern mot manipulerende gamification.

**Ny kanon**  
Skynja skal kunne forbedre kvaliteten på samspill rundt dysleksi: mindre overtakelse, skam, prematur korrigering og konflikt; mer presis hjelp, autonomi, felles språk og reparasjon. Relasjonseffekt kan være et produktmål og forskningsspørsmål, men skal ikke hevdes uten evidens.

**Bindende designkonsekvenser**
- Støtt autonomi og respekt.
- Reduser korrigerings- og overhjelpingsmønstre.
- Gjør støtteintensjon og brukerønske synlig.
- Mål relasjonell verdi når dette er relevant.

**Kort arkitekturregel**
> God støtte skal ikke bare løse oppgaven; den skal kunne gjøre samarbeidet bedre.


---

## SKP-005 — Reell støttepersonkompetanse

**Hva den erstatter eller reviderer**  
Voksenflaten var primært designet for én kort, situasjonell handling.

**Ny kanon**  
Skynja skal bygge kompetanse hos mennesker rundt brukeren, ikke bare fortelle dem hva de skal gjøre akkurat nå. Kompetansen omfatter dysleksi, lesing og skriving, tilgang versus trening, timing av hjelp, psykologi, kommunikasjon, autonomi, selvadvokering og relasjonelle virkninger.

**Bindende designkonsekvenser**
- Lær hvorfor, ikke bare hva.
- Bygg transfer utenfor appen.
- Gi praksis, refleksjon og fordypning.
- Kompetanseinnhold må ha samme evidenskrav som øvrig faglig innhold.

**Kort arkitekturregel**
> Målet er bedre støtte også når Skynja ikke er åpen.


---

## SKP-006 — Eget kunnskapsområde for støttepersoner og brukere

**Hva den erstatter eller reviderer**  
Fordypning var tidligere hovedsakelig et skjult lag bak korte situasjonskort.

**Ny kanon**  
Skynja skal ha et frivillig, seriøst kunnskapsunivers som kobler praktiske situasjoner til forklaringer, evidens, eksempler og videre fordypning. Kunnskap skal være tilgjengelig på flere dybdenivåer og kobles tilbake til faktisk praksis.

**Bindende designkonsekvenser**
- Kort svar → forklaring → fordypning → evidens.
- Kunnskap skal kunne nås uten å vente på en hendelse.
- Kunnskapsinnhold skal være versjonert og reviewet.
- Bruker og støtteperson kan ha ulike visninger av samme kunnskapskjerne.

**Kort arkitekturregel**
> Situasjonsstøtte og kunnskapsbygging er to sider av samme system.


---

## SKP-007 — Prøverommet skal lære dømmekraft

**Hva den erstatter eller reviderer**  
Tidlige aktiviteter kunne bli for mekaniske og fokusere på ett riktig neste steg.

**Ny kanon**  
Prøverommet skal kunne trene vurdering, ikke bare riktig svar. Det kan inneholde tydelig bedre valg, flere forsvarlige valg, dårlige valg og situasjoner med utilstrekkelig informasjon. Debrief skal gjøre begrunnelsen viktigere enn poengsummen.

**Bindende designkonsekvenser**
- Tren beslutninger under usikkerhet.
- Tillat 'ikke nok informasjon' som legitimt svar.
- Bruk konsekvenser til å synliggjøre mekanismer.
- Skill spillutfall fra læringsevidens.

**Kort arkitekturregel**
> Prøverommet skal utvikle dømmekraft, ikke bare svarmønstre.


---

## SKP-008 — Riktig støtte fremfor minst mulig støtte

**Hva den erstatter eller reviderer**  
Tidligere stillaslogikk favoriserte ofte minste tilstrekkelige støtte og fading.

**Ny kanon**  
Støtte skal velges ut fra mål, hinder, situasjon, energi, brukerønske og kontroll. Mer støtte er ikke automatisk dårligere. Varige hjelpemidler kan være riktig mål. Fading brukes når fading tjener aktiviteten, ikke som ideologi.

**Bindende designkonsekvenser**
- Mål → hinder → støttehensikt → tiltak → effekt.
- ACCESS skal ikke fjernes for å skape kunstig selvstendighet.
- Brukerens ønsker og energikostnad teller.
- Støtte skal kunne økes eller reduseres dynamisk.

**Kort arkitekturregel**
> Gi den støtten som faktisk gjør arbeidet bedre.


---

## SKP-009 — Delt beslutningstaking og profesjonelt skjønn

**Hva den erstatter eller reviderer**  
Gamle kontrakter la mye myndighet i lærerport eller systemforbud.

**Ny kanon**  
Gode beslutninger skal kombinere brukerens subjektive ekspertise, relevant profesjonelt skjønn, situasjonskunnskap og Skynjas evidensbaserte beslutningsstøtte. Ingen av disse er universelt overordnet i alle saker.

**Bindende designkonsekvenser**
- Brukeren kjenner egen opplevelse.
- Profesjonelle kjenner faglige og institusjonelle rammer.
- Skynja kan bidra med historikk, mønstre og kunnskapsgrunnlag.
- Konsekvens og mandat avgjør hvem som må involveres.

**Kort arkitekturregel**
> Brukerens erfaring + faglig skjønn + sporbar systemstøtte.


---

## SKP-010 — Intelligent inferens med konkurrerende forklaringer

**Hva den erstatter eller reviderer**  
Inferens fra brukerhendelser var tidligere i stor grad forbudt.

**Ny kanon**  
Skynja skal kunne inferere situasjonelle mønstre og funksjonelle hypoteser når dette kan forbedre støtten. Den skal vurdere konkurrerende forklaringer, uttrykke usikkerhet, søke bekreftelse og bruke nye situasjoner til å teste modellen.

**Bindende designkonsekvenser**
- Én observasjon gir sjelden en varig konklusjon.
- Konkurrerende forklaringer skal bevares når de er reelle.
- Styrker og fungerende strategier skal modelleres like seriøst som barrierer.
- Systemet skal kunne si 'jeg vet ikke'.

**Kort arkitekturregel**
> Inferer for å lære, ikke for å stemple.


---

## SKP-011 — Psykologisk kompetent støtte uten falsk klinisk autoritet

**Hva den erstatter eller reviderer**  
Tidligere retning ønsket å holde terapi og psykologiske mekanismer langt utenfor produktet.

**Ny kanon**  
Skynja kan bruke evidensinformerte psykologiske og terapeutiske prinsipper når de hjelper med skam, mestringstro, unngåelse, identitet, attribusjon, stress, emosjonsregulering, selvadvokering og relasjonell reparasjon. Produktet skal samtidig skille støtte og psykoedukasjon fra klinisk behandling, diagnose og helsehjelp.

**Bindende designkonsekvenser**
- Bruk bare autorisert kunnskap fra biblioteket.
- Ikke diagnostiser indre tilstander fra svak evidens.
- Høyere psykososial konsekvens gir strengere sikkerhetskrav.
- Ikke gjør emosjonell varme avhengig av å late som Skynja er terapeut.

**Kort arkitekturregel**
> Bruk psykologi når det hjelper; ikke lat som støtte er behandling.


---

## SKP-012 — Ambisiøs produktdybde uten unødvendig brukerkompleksitet

**Hva den erstatter eller reviderer**  
Mange tidlige regler var optimalisert mot minste mulige første produkt og svært smale funksjoner.

**Ny kanon**  
Skynja skal kunne ha stor systemdybde når det gir brukerens liv reell verdi. Stor visjon skal realiseres gjennom modulær arkitektur og små validerbare leveranser, ikke ved å gjøre produktambisjonen permanent liten.

**Bindende designkonsekvenser**
- Skill systemkompleksitet fra brukeropplevd kompleksitet.
- Bygg modulært og evaluerbart.
- Unngå feature-sprawl uten verdi.
- Ikke gjør minimalisme til mål i seg selv.

**Kort arkitekturregel**
> Stor dybde internt, riktig enkelhet i øyeblikket.


---

## SKP-013 — Kontekstuell forståelse av støttepersonen

**Hva den erstatter eller reviderer**  
Roller som lærer, foresatt og spesialpedagog var tidligere relativt faste produktsegmenter.

**Ny kanon**  
Skynja skal forstå støttepersonens rolle, kompetanse, mandat, relasjon til brukeren, aktuell situasjon og formål separat. Samme person kan ha ulike roller i ulike situasjoner.

**Bindende designkonsekvenser**
- Rolle ≠ kompetanse ≠ mandat ≠ relasjon.
- Tilgang skal følge konkret formål.
- Støtte skal tilpasses bruker × støtteperson × situasjon.
- Unngå stereotyper basert på tittel.

**Kort arkitekturregel**
> Forstå hvem personen er i denne situasjonen, ikke bare hvilken rollelabel de har.


---

## SKP-014 — To koordinerte flater når to mennesker samarbeider

**Hva den erstatter eller reviderer**  
Én-enhet/Sammen-modus var tidligere kanonisk hovedretning i deler av styringen.

**Ny kanon**  
Ved samtidig bruker–støtteperson-samarbeid bør standarden være to koordinerte flater/enheter når det er praktisk, med tydelig rolleforskjell. Sammen-modus på én enhet er en viktig fallback. Flatene skal ikke speile hverandre; de skal støtte ulike jobber.

**Bindende designkonsekvenser**
- Brukerflaten eier brukerens oppgave og kontroll.
- Støtteflaten gir beslutningsstøtte, observasjon og læring.
- Én-enhet-modus skal bevare rollegrenser i tid.
- Ikke krev fysisk overtakelse av brukerens skjerm som standard.

**Kort arkitekturregel**
> To mennesker bør få to roller – og gjerne to flater.


---

## SKP-015 — Dynamisk samspillsmodell

**Hva den erstatter eller reviderer**  
Tidligere dyaderegler favoriserte en fast sekvens med handling, forklaring og tilbakeføring av kontroll.

**Ny kanon**  
Samspill skal tilpasses oppgaven. Standardrammen er: Forstå → støtte → forklar → fordel → vurder på nytt. Rekkefølge og dybde kan variere etter behov.

**Bindende designkonsekvenser**
- Forstå mål og hinder før støtte når mulig.
- Forklaring kan komme før, under eller etter handling.
- Fordel arbeid eksplisitt mellom bruker, system og støtteperson.
- Vurder effekten og juster.

**Kort arkitekturregel**
> Forstå → støtte → forklar → fordel → vurder på nytt.


---

## SKP-016 — Støtte etter formål, ikke bare trening versus kompensasjon

**Hva den erstatter eller reviderer**  
Trening og ACCESS var tidligere svært hardt separerte hovedbaner.

**Ny kanon**  
Skynja skal fortsatt skille læringsmål fra tilgang når konstruktet krever det, men støtteformålet kan være ferdighetstrening, strategilæring, innholdstilgang, uttrykk, avlastning, samarbeid, gjennomføring, hypotesetesting, vurdering, psykologisk støtte eller selvadvokering.

**Bindende designkonsekvenser**
- Formål er eksplisitt kontekst.
- Samme verktøy kan ha ulik legitimitet i ulike formål.
- Ikke arv læringsevidens fra tilgangsstøtte uten grunnlag.
- Ikke gjør alle virkelige oppgaver til trening.

**Kort arkitekturregel**
> Mål → hinder → støttehensikt → tiltak → effekt → ny vurdering.


---

## SKP-017 — Dobbel læringsarkitektur for støttepersoner

**Hva den erstatter eller reviderer**  
Støttepersonopplæring var tidligere hovedsakelig situasjonskort.

**Ny kanon**  
Kompetanse skal bygges både akkurat når behovet oppstår og gjennom frivillig strukturert læring. En god løkke er Opplev → forstå → fordyp → øv → anvend → reflekter → overfør.

**Bindende designkonsekvenser**
- JIT-støtte og kurs/fordypning skal dele kunnskapskjerne.
- Praksis skal kobles til forklaring.
- Refleksjon skal kobles til fremtidig handling.
- Kompetanseutvikling må kunne fortsette uten aktiv brukerøkt.

**Kort arkitekturregel**
> Lær i situasjonen – og bygg varig kompetanse utenfor den.


---

## SKP-018 — Metakognitiv støttekompetanse og selvadvokering

**Hva den erstatter eller reviderer**  
Eldre produktlogikk var mer opptatt av korrekt støtteutførelse enn av at brukeren selv skulle bli strategisk ekspert.

**Ny kanon**  
Skynja skal hjelpe brukeren å oppdage barrierer, skille mål fra hinder, kjenne strategier, sammenligne dem, velge, kommunisere behov og lære av utfallet. Det samme kan trenes hos støttepersoner.

**Bindende designkonsekvenser**
- Oppdag → skill → velg → kommuniser → vurder.
- Strategibruk er egen kompetanse.
- Selvadvokering kan trenes i scenarioer og ekte situasjoner.
- Brukeren skal kunne formulere hva som hjelper og hvorfor.

**Kort arkitekturregel**
> Skynja skal hjelpe personen bli ekspert på egen støtte.


---

## SKP-019 — Ingen kunstig kompetansegrense for støttepersoner

**Hva den erstatter eller reviderer**  
Tidligere design kunne begrense dybde ut fra formell rolle.

**Ny kanon**  
Tilgang til faglig dybde skal ikke begrenses mekanisk av tittel. Skynja skal skille rolle, kompetanse, mandat og formell kvalifikasjon. En forelder kan være svært kunnskapsrik; en lærer kan være ny; en spesialist kan trenge andre data.

**Bindende designkonsekvenser**
- Dybde kan tilpasses faktisk kompetanse og formål.
- Mandat begrenser handling, ikke nødvendigvis læring.
- Profesjonelle områder kan kreve særskilt tilgang når data er sensitive.
- Ikke lås brukergrensesnitt til yrkestittel alene.

**Kort arkitekturregel**
> Tittel bestemmer ikke automatisk hvor mye du får lov til å forstå.


---

## SKP-020 — Bruker- og situasjonsførst, ikke familie-først

**Hva den erstatter eller reviderer**  
Tidligere arbeid hadde sterke foreldre-/lærergrener og familieorienterte modeller.

**Ny kanon**  
Brukeren er det stabile sentrum gjennom skole, studier, arbeid og hjem. Støttepersoner er relasjoner rundt brukeren, ikke produktets primære eiere. Flere støttepersoner kan eksistere over tid.

**Bindende designkonsekvenser**
- Brukeren er sentrum.
- Situasjonen gir målet.
- Rollen gir kontekst.
- Relasjonen påvirker samspillet.

**Kort arkitekturregel**
> Brukeren er sentrum. Situasjonen gir målet. Rollen gir kontekst.


---

## SKP-021 — Felles kjerne og kontekstuelle kapabiliteter

**Hva den erstatter eller reviderer**  
Segmenter og 80/20-tenkning kunne gi separate produktvarianter for ulike roller og aldersgrupper.

**Ny kanon**  
Skynja bør ha én felles domenemodell og aktivere kapabiliteter etter samtykke, alder, kontekst, formål, sensitivitet og behov. Rolle- og aldersspesifikke flater kan eksistere uten å fragmentere produktet.

**Bindende designkonsekvenser**
- Én sannhetskjerne.
- Kapabiliteter aktiveres kontekstuelt.
- Tilgang følger mandat.
- Ikke dupliser domene og logikk unødvendig.

**Kort arkitekturregel**
> Én kjerne. Ulike kapabiliteter når konteksten krever det.


---

## SKP-022 — Formålsdrevet observasjon fremfor generelt overvåkingsforbud

**Hva den erstatter eller reviderer**  
Observasjon og profilering var tidligere sterkt sperret for å hindre overvåking.

**Ny kanon**  
Skynja kan observere rikt når det er nødvendig for brukerens mål, men må skille systemobservasjon, brukerrefleksjon og menneskelig innsyn. Det systemet observerer trenger ikke vises til andre.

**Bindende designkonsekvenser**
- Observer rikt når formålet krever det.
- Tolk kalibrert.
- Del selektivt.
- Handle bare når observasjonen har legitim verdi.

**Kort arkitekturregel**
> Observer rikt. Tolk kalibrert. Del selektivt.


---

## SKP-023 — Produktets nordstjerne

**Hva den erstatter eller reviderer**  
Tidlige planer kunne snevre produktet til spesifikke skole- og Guided-Dyad-scenarier.

**Ny kanon**  
Skynja skal hjelpe mennesker med dysleksi til å lære, arbeide, delta og mestre på bedre premisser – og hjelpe dem og menneskene rundt dem til å forstå hva som faktisk hjelper.

**Bindende designkonsekvenser**
- Direkte verdi for personen kommer først.
- Kontinuitet på tvers av livskontekster er ønsket.
- Produktet skal bygge både funksjon og selvforståelse.
- Støttepersoner skal bli bedre støttespillere.

**Kort arkitekturregel**
> Skynja lærer hva som hjelper deg – og hjelper deg og menneskene rundt deg å lære det samme.


---

## SKP-024 — Fra veilederavhengighet til avansert beslutningsstøtte

**Hva den erstatter eller reviderer**  
Tidligere fadinglogikk kunne gjøre 'mindre behov for appen' til implisitt sluttmål.

**Ny kanon**  
Målet er ikke at Skynja skal bli overflødig. Menneskelig kompetanse kan øke samtidig som systemet gir stadig mer avansert verdi gjennom historikk, mønstergjenkjenning, evidens og koordinering.

**Bindende designkonsekvenser**
- Ikke optimaliser mot lavest mulig bruk.
- Systemets rolle kan utvikles fra instruktør til sparringspartner.
- Maskinen kan tilføre verdi mennesker ikke lett kan holde i hodet.
- Brukeren bestemmer når systemet skal være mer eller mindre aktivt.

**Kort arkitekturregel**
> Bedre brukerkompetanse skal gjøre Skynja mer avansert, ikke nødvendigvis mindre relevant.


---

## SKP-025 — Meningsfull progresjon for støttepersoner

**Hva den erstatter eller reviderer**  
Gamification ble tidligere i stor grad forbudt av frykt for manipulasjon.

**Ny kanon**  
Støttepersoner kan få progresjon, øving og eventuelt spillmekanismer når disse representerer reell læring, anvendelse, refleksjon, dømmekraft og transfer – ikke bare aktivitet eller brukstid.

**Bindende designkonsekvenser**
- Belønn læring og anvendelse.
- Unngå sosial rangering og tapsfrykt.
- Progression skal tåle pauser.
- Narrativ og scenario kan brukes når de gjør læringen bedre.

**Kort arkitekturregel**
> Progresjon skal representere kompetanse, ikke appbruk.


---

## SKP-026 — Vedvarende kontinuitet og intelligent minne

**Hva den erstatter eller reviderer**  
Historikk og kryssøktminne var tidligere eksplisitt sperret.

**Ny kanon**  
Skynja skal kunne bevare det som skaper læring og bedre støtte over tid. Minne skal ha proveniens, sikkerhet, korrigerbarhet, delingsnivåer og regler for å svekke eller glemme utdaterte opplysninger.

**Bindende designkonsekvenser**
- Bevar verdifulle mønstre, ikke all råhistorikk.
- Versjonér og kildebevar minner.
- La brukeren korrigere og kontekstualisere.
- Utdaterte eller svake hypoteser skal revurderes eller glemmes.

**Kort arkitekturregel**
> Husk det som skaper læring. Glem det som bare skaper historikk.


---

## SKP-027 — Kontrollert samarbeid og selektiv deling

**Hva den erstatter eller reviderer**  
Gamle regler favoriserte svært lite deling mellom hjem, skole og roller.

**Ny kanon**  
Skynja skal kunne koordinere støtte, men bare dele riktig informasjon med riktig person for et eksplisitt formål. Se-tilgang, bidra-tilgang, varighet og mandat skal skilles.

**Bindende designkonsekvenser**
- Del innsikt, ikke automatisk hele historikken.
- Bevar kilden til observasjoner.
- Tilgang kan være midlertidig og oppgavespesifikk.
- Uenighet skal ikke overskrives lydløst.

**Kort arkitekturregel**
> Koordiner støtte, ikke overvåk personen.


---

## SKP-028 — Multimodal støtte som kjernekapabilitet

**Hva den erstatter eller reviderer**  
Mikrofon, kamera, fri tekst og dynamisk lyd var tidligere generelt sperret eller sterkt begrenset.

**Ny kanon**  
Skynja skal kunne bruke tale, diktering, opplesing, kamera/OCR, visuelle representasjoner og multimodal AI når dette fjerner en reell barriere. Rådata og avledet læring skal ha separate livsløp.

**Bindende designkonsekvenser**
- Velg modalitet etter hinder og mål.
- Ikke behold rå lyd/bilde automatisk.
- Dynamisk output krever kontroll etter konsekvens.
- Multimodalitet skal være tilgjengelighet, ikke overvåking.

**Kort arkitekturregel**
> Bruk modaliteten som fjerner barrieren. Bevar signalet som skaper verdi, ikke nødvendigvis rådata.


---

## SKP-029 — Fleksibelt identitetslag uten kontotvang

**Hva den erstatter eller reviderer**  
Tidligere baseliner unngikk stabil elev-ID helt.

**Ny kanon**  
Skynja kan ha vedvarende identitet når kontinuitet krever det, men identitet skal være separat fra relasjon, tilgang og formål. Produktet bør støtte flere identitetsmekanismer uten å tvinge alle inn i én institusjonell konto.

**Bindende designkonsekvenser**
- USER_ID, SUPPORT_PERSON_ID og RELATIONSHIP er separate konsepter.
- Tilgang må eksplisitt autoriseres.
- Institusjonstilhørighet skal ikke eie hele brukeridentiteten.
- Identitetsmekanisme kan variere etter kontekst.

**Kort arkitekturregel**
> Identitet muliggjør kontinuitet; den skal ikke automatisk gi noen tilgang.


---

## SKP-030 — Kartlegging, screening, vurdering og diagnose som tydelig kontinuum

**Hva den erstatter eller reviderer**  
Screening, diagnostikk og varige inferenser var tidligere nesten helt utenfor produktet.

**Ny kanon**  
Skynja kan støtte observasjon, funksjonell kartlegging, hypoteser, eksplisitt screening og profesjonell vurdering når formål, evidens og mandat er riktig. Diagnose krever diagnostisk evidens og riktig faglig prosess.

**Bindende designkonsekvenser**
- Skille hverdagsobservasjon fra formell screening.
- Høyere konsekvens krever sterkere standardisering og profesjonell kontroll.
- Ikke skjul screening inne i ordinært gameplay.
- Bruk funksjonell kartlegging når det faktisk hjelper.

**Kort arkitekturregel**
> Mål funksjon når det hjelper. Screen eksplisitt. Diagnose krever diagnostisk evidens.


---

## SKP-031 — AI-native runtime med deterministiske grenser

**Hva den erstatter eller reviderer**  
Runtime-AI og generativ elevrettet funksjon var tidligere ikke godkjent.

**Ny kanon**  
Skynja skal kunne bruke generativ AI direkte i runtime for språk, resonnering, dialog, transformasjon og personalisering. Deterministiske regler beholdes der grensene må være bindende, og AI-autonomi skaleres etter konsekvens, usikkerhet og reversibilitet.

**Bindende designkonsekvenser**
- Deterministiske grenser rundt sikkerhet, autorisasjon og kritisk state.
- Generativ fleksibilitet for språk og resonnering.
- Langtidsprofil + lokal kontekst kan brukes når autorisert.
- AI må kunne begrunne, korrigeres og avstå.

**Kort arkitekturregel**
> Deterministiske grenser. Generativ fleksibilitet. Kalibrert autonomi.


---

## SKP-032 — Multidimensjonal adaptiv progresjon

**Hva den erstatter eller reviderer**  
Gamle modeller var redde for automatisk nivåplassering og global progresjon.

**Ny kanon**  
Skynja skal kunne tilpasse progresjon flerdimensjonalt etter mål, støttebetingelser, ferdighet, kontekst og brukerens ambisjon. Avkodingsvansker skal aldri bli en generell intellektuell nivåplassering.

**Bindende designkonsekvenser**
- Tilpass barrieren uten automatisk å senke målet.
- Brukeren kan velge ambisjon.
- Lokale tilpasninger kan automatiseres innen rammer.
- Standardisert vurdering kan låse relevante dimensjoner.

**Kort arkitekturregel**
> Tilpass progresjonen uten å redusere personen til et nivå.


---

## SKP-033 — Tid som signal – ikke som dom

**Hva den erstatter eller reviderer**  
Responstid og mikroatferd var tidligere ofte forbudt som pedagogiske signaler.

**Ny kanon**  
Tid kan være relevant for automatisering, flyt, arbeidskostnad, støtteffekt og funksjon når konstruktet tilsier det. Å måle tid er ikke det samme som å legge tidspress. Tid skal tolkes sammen med korrekthet, støtte, kontekst og brukeropplevelse.

**Bindende designkonsekvenser**
- Mål uten å presse.
- Ikke bruk tid som generell evne- eller motivasjonsscore.
- Pause betyr ikke lav motivasjon.
- Normdata kan brukes når formell vurdering faktisk krever det.

**Kort arkitekturregel**
> Mål uten å presse. Tolk uten å rangere.


---

## SKP-034 — Meningsfull motivasjon og gamification

**Hva den erstatter eller reviderer**  
Gamification, streaks og poeng var tidligere i stor grad sperret.

**Ny kanon**  
Skynja kan bruke spillmekanismer, progresjon, narrativ, belønning og mål når de støtter mening, mestring, utforsking eller kompetanse. Det skal ikke optimaliseres for brukstid, tapsfrykt, sosial rangering eller press.

**Bindende designkonsekvenser**
- Game score ≠ learning model.
- Streaks må være fleksible og tilgivende.
- Belønn mestring og utforsking, ikke bare aktivitet.
- Opt-out og tilpasning skal være mulig.

**Kort arkitekturregel**
> Belønn mening, mestring og utforsking – ikke bare aktivitet.


---

## SKP-035 — Narrativ kan være selve læringsmekanismen

**Hva den erstatter eller reviderer**  
Narrativ skulle tidligere kunne fjernes uten å påvirke ferdighetsmotor eller progresjon.

**Ny kanon**  
Narrativ kan være dekorativt, kontekstualiserende eller selve mekanismen. Når perspektiver, sosiale konsekvenser, dilemmaer eller simulert praksis er læringsmålet, trenger fortellingen ikke kunne fjernes uten semantisk endring.

**Bindende designkonsekvenser**
- Dekorativt narrativ skal ikke skjule svak mekanikk.
- Funksjonelt narrativ må kunne begrunnes.
- Scenarioer kan være adaptive og asymmetriske.
- Konsekvenser skal modellere mekanismer, ikke bare poeng.

**Kort arkitekturregel**
> Dekorasjon kan fjernes. Kontekst skal begrunnes. Simulering kan være selve læringen.


---

## SKP-036 — Konsekvens- og mandatstyrte menneskeporter

**Hva den erstatter eller reviderer**  
Tidligere B6 la lærerport på et stort antall pedagogiske handlinger.

**Ny kanon**  
Menneskelig kontroll skal plasseres etter formål, konsekvens, usikkerhet, reversibilitet og legitimt mandat. Lærer eller annen fagperson styrer relevante rammer; lavkonsekvente mikrovalg kan delegeres til bruker eller system.

**Bindende designkonsekvenser**
- Ingen universell lærerport.
- Riktig menneske er ikke alltid lærer.
- Brukerbekreftelse kan være riktig port.
- Lavrisiko reversible handlinger kan automatiseres.

**Kort arkitekturregel**
> Rammer styres. Mikrovalg delegeres. Unntak eskaleres.


---

## SKP-037 — Utviklings-, kompetanse- og kontekstsensitiv personalisering

**Hva den erstatter eller reviderer**  
Produktet var tidligere organisert i faste aldersbånd som 6–9, 10–12 og 13–16.

**Ny kanon**  
Alder skal brukes der den betyr noe for evidens, utvikling, sikkerhet, juridiske rammer og defaults, men ikke være hele brukeropplevelsen. Ferdighet, selvadvokering, digital kompetanse, situasjon, formål og preferanse skal modelleres separat. Voksne er en førsteklasses brukergruppe.

**Bindende designkonsekvenser**
- Alder ≠ ferdighetsnivå.
- Ferdighet ≠ modenhet.
- Ikke erstatt én stereotype med tre aldersstereotyper.
- Presentasjon skal kunne tilpasses mer presist enn aldersbånd.

**Kort arkitekturregel**
> Alder setter noen rammer. Personen er ikke en aldersmodus.


---

## SKP-038 — Personlig, mekanismeorientert og metakognitiv feedback

**Hva den erstatter eller reviderer**  
Feedback skulle tidligere være kort, oppgaveorientert og uttrykkelig ikke-personlig.

**Ny kanon**  
Feedback kan være personlig når den beskriver brukerens handlinger, strategier, utvikling og historikk på et evidensnivå systemet faktisk tåler. Den skal unngå identitetsdommer, falsk ros og spekulativ psykologi.

**Bindende designkonsekvenser**
- Resultat-, prosess-, strategi-, metakognitiv og utviklingsfeedback er forskjellige nivåer.
- 'Riktig' kan noen ganger være nok.
- Presis ros slår tom ros.
- Feedback kan tilpasses timing, modalitet, dybde og støttehensikt.

**Kort arkitekturregel**
> Beskriv det som skjedde. Forklar det vi har grunnlag for. Knytt det til personen uten å låse identitet.


---

## SKP-039 — Koordinert støtte fremfor én handling / én voksen som dogme

**Hva den erstatter eller reviderer**  
Guided Dyad brukte ONE-CARD-ONE-ACTION, ONE-ACTION-ONE-RESPONSE og ONE-ACTIVE-ADULT som sterke baselinekrav.

**Ny kanon**  
Ett UI-element bør normalt ha én tydelig primær intensjon, men støtte kan bestå av koordinerte sekvenser, parallelle modaliteter og flere relevante aktører med ulike roller. Aktiviteter kan fortsatt kreve én aktiv veileder når standardisering eller sikkerhet tilsier det.

**Bindende designkonsekvenser**
- Én tydelig intensjon kan bestå av flere støttekomponenter.
- Flere personer kan bidra med ulike jobber.
- Unngå flere samtidige stemmer uten orkestrering.
- Registrer kombinasjoner uten å late som én komponent alene skapte effekten.

**Kort arkitekturregel**
> Én tydelig intensjon. Så mange komponenter og aktører som faktisk trengs – men aldri flere enn det.


---

## SKP-040 — Adaptiv informasjonsdybde fremfor universell minimalisme

**Hva den erstatter eller reviderer**  
Gamle voksenkort og UX-regler favoriserte svært korte første lag og 'minst mulig informasjon'.

**Ny kanon**  
Skynja skal vise riktig mengde informasjon for personen, rollen, oppgaven og den kognitive situasjonen. Informasjon kan komprimeres for øyeblikket uten at faglig dybde fjernes. Kritisk usikkerhet og konsekvenser må ikke skjules bak progressiv avdekking.

**Bindende designkonsekvenser**
- Skill momentary cognitive load fra ønsket intellektuell dybde.
- Kort svar → forklaring → detaljer → evidens/proveniens.
- Dashboards er legitime når de støtter en faktisk beslutningsjobb.
- Tilgjengelighet handler om struktur, modalitet og navigerbar dybde – ikke lavt ordtall.

**Kort arkitekturregel**
> Komprimer for øyeblikket. Bevar dybden. La brukeren åpne den.


---

## SKP-041 — Lukket kunnskapsgrunnlag med åpen resonnering

**Hva den erstatter eller reviderer**  
Tidligere runtime-AI var sperret; senere AI-native retning skaper behov for en eksplisitt epistemisk grense.

**Ny kanon**  
Skynjas faglige runtime-AI skal bare bygge faglige påstander på vårt eget godkjente, versjonerte kunnskapsbibliotek. Modellen kan bruke generell språk- og resonneringsevne til å kombinere, forklare og anvende biblioteket, men latent modellkunnskap er ikke autorisert faglig kilde. Personalisering kan i tillegg bruke tillatte bruker- og situasjonsdata.

**Bindende designkonsekvenser**
- Ingen faglig påstand uten bibliotekgrunnlag.
- Modellkunnskap er aldri kilde.
- Skill fagkunnskap, brukerdata, situasjonsdata og AI-inferens.
- Manglende dekning gir abstention eller kunnskapshull, ikke web-fallback i runtime.

**Kort arkitekturregel**
> Lukket kunnskap. Åpen resonnering. Sporbare påstander. Ingen skjult modellautoritet.


---

## SKP-042 — Evidens som levende styringssystem

**Hva den erstatter eller reviderer**  
Gamle pakker brukte sterke AUTHORIZED / NOT_AUTHORIZED-skiller.

**Ny kanon**  
Kunnskapsbiblioteket skal representere evidens gradert, versjonert og scope-bevisst. Evidensstyrke skal skilles fra runtime-autoritet og produktvalidering. Manglende direkte evidens skal begrense claimstyrke og evalueringskrav, ikke automatisk blokkere lavrisiko innovasjon.

**Bindende designkonsekvenser**
- SOURCE → EVIDENCE → CLAIM → PRODUCT_RULE → RUNTIME_USE.
- Bevar støttende, begrensende og motstridende evidens.
- Sterkere evidens betyr ikke bredere scope.
- Produktclaim og domenekunnskap er forskjellige evidenslag.

**Kort arkitekturregel**
> Gradér evidensen. Avgrens claimet. Spor motfunnene. Skaler handling etter sikkerhet og konsekvens.


---

## SKP-043 — Støttet mestring er også mestring – men av en annen type

**Hva den erstatter eller reviderer**  
Tidligere modeller krevde ny ustøttet respons etter modellering og behandlet full modell som ikke-evidens for selvstendig status.

**Ny kanon**  
Skynja skal bevare presis støtteproveniens, men ikke gjøre ustøttet ytelse til moralsk eller pedagogisk toppnivå. Støttet ytelse kan gi evidens om funksjon, respons på undervisning, strategibruk og selvadvokering. Om støtte skal fades avgjøres av formålet.

**Bindende designkonsekvenser**
- SUPPORTED ≠ INDEPENDENT, men SUPPORTED kan være svært informativt.
- Skill funksjon, læring og måling.
- Selvinitiert verktøybruk kan være høy selvstendighet.
- Varige ACCESS-verktøy trenger ikke fades.

**Kort arkitekturregel**
> Spor støtten presist. Verdsett funksjonen ærlig.


---

## SKP-044 — Relevante comparatorer fremfor L0-tvang

**Hva den erstatter eller reviderer**  
L0 var obligatorisk baseline, og en aktivitet som ikke kunne kjøres i L0 var tidligere problematisk.

**Ny kanon**  
Skynja skal bruke sterke, relevante, versjonerte sammenligningsbetingelser når vi hevder merverdi. En fast ikke-adaptiv variant er riktig for noen aktiviteter, men ikke et universelt produktkrav. Comparatoren skal velges etter claimet som testes.

**Bindende designkonsekvenser**
- Skill evalueringsbaseline, standardisert modus, fallback og produktvariant.
- Bruk ablasjoner når det er mer informativt.
- Sammenlign mot en sterk og rettferdig alternativløsning.
- AI-kompleksitet må vise faktisk merverdi.

**Kort arkitekturregel**
> Ingen L0-tvang. Alltid relevant comparator når vi hevder merverdi.


---

## SKP-045 — Tydelig handlingshierarki fremfor én-handlingsgrensesnitt

**Hva den erstatter eller reviderer**  
COGA-regler og voksenkort la sterk vekt på én primær handling per aktivitetstrinn.

**Ny kanon**  
Hvert grensesnitt skal gjøre hovedformål og relevante neste steg forståelige, men kan vise flere legitime valg når agentivitet, utforsking eller profesjonelt arbeid krever det. Antall og synlighet av handlinger skal følge beslutningsformen og systemets sikkerhet.

**Bindende designkonsekvenser**
- Ett tydelig fokus betyr ikke én knapp.
- Flere likeverdige valg kan være riktig når beslutningen faktisk er å velge.
- AI-anbefaling skal kunne avvises.
- Fritekst/dialog skal supplere, ikke erstatte synlige affordances.

**Kort arkitekturregel**
> Ett tydelig fokus. Ikke nødvendigvis én knapp.


---

## SKP-046 — Gradert støtte, trygging og menneskelig eskalering

**Hva den erstatter eller reviderer**  
STOPP-BELASTNING og sikkerhetslogikk gikk raskt til stopp, trygg avslutning eller menneskeport.

**Ny kanon**  
Brukerens eksplisitte pause og stopp skal alltid respekteres, men vanlig frustrasjon, skam og fastlåsing skal ikke automatisk bli sikkerhetshendelse. Skynja skal kunne redusere krav, endre støtte, hjelpe med selvforståelse og legge til rette for menneskelig hjelp. Ved høy risiko reduseres generativ frihet og autoriserte sikkerhetsprotokoller overtar.

**Bindende designkonsekvenser**
- Stopp betyr stopp.
- Vanlig motstand ≠ akutt fare.
- Høyere risiko gir mer deterministisk sikkerhetsmodus.
- Relevant støtteaktør kan være lærer, foresatt, fagperson eller brukerens valgte person.

**Kort arkitekturregel**
> Støtt når det er vanskelig. Reduser når det blir for mye. Stopp når brukeren sier stopp. Eskaler når konsekvensen krever det.


---

## SKP-047 — Meningsfull aktivitetsatferd som kalibrert evidens

**Hva den erstatter eller reviderer**  
Gamle regler avviste inferens om readiness, ability, motivation, emotion og support need fra task events.

**Ny kanon**  
Aktivitetshendelser, gameplay og arbeidsatferd kan gi individuell evidens når konstruktkoblingen er eksplisitt og faglig begrunnet. Rå mikroatferd skal ikke automatisk bli pedagogisk profil, og brede egenskapsinferenser fra svake signaler forblir forbudt.

**Bindende designkonsekvenser**
- Rå hendelse → semantisk observasjon → avgrenset evidens → eventuell hypotese.
- Spillscore ≠ læringsscore.
- Handling + refleksjon kan være sterkere evidens enn handling alene.
- Formell screening må fortsatt være eksplisitt.

**Kort arkitekturregel**
> Logg ikke for å profilere. Observer for å forstå. Inferer bare det aktiviteten faktisk kan bære.


---

## SKP-048 — AI-støttet forfatterskap med bevart brukerintensjon

**Hva den erstatter eller reviderer**  
Elevrettet generativ AI og generativ fagtekst var tidligere ikke autorisert fordi AI kunne overta faginnhold og forfatterskap.

**Ny kanon**  
Generativ AI kan være kraftig tilgangs-, uttrykks-, lærings- og produktivitetsstøtte. Skynja skal skille brukerens idé-, fag-, struktur-, språk- og revisjonseierskap fra AI-ens bidrag og vurdere støtte opp mot aktivitetens formål og eventuelle vurderingsrammer.

**Bindende designkonsekvenser**
- Beskytt konstruktet, ikke tastaturet.
- Representer TRANSCRIPTION, LANGUAGE_FORM, STRUCTURE, IDEATION, DOMAIN_CONTENT, EVIDENCE og REVISION separat ved behov.
- Vurderingsmodus følger eksplisitte regler fra ansvarlig institusjon/person.
- AI-proveniens er brukerdata og deles ikke automatisk.

**Kort arkitekturregel**
> Bevar brukerens intensjon. Spor AI-ens bidrag. Beskytt konstruktet – ikke tastaturet.


---

## SKP-049 — Formålsdrevet datatilstrekkelighet

**Hva den erstatter eller reviderer**  
Dataminimering ble ofte operationalisert som svært lite persistens og øktbundet data.

**Ny kanon**  
Skynja skal ikke samle data bare fordi de er tilgjengelige, men skal heller ikke gjøres hukommelsesløs når legitim bruker verdi krever kontinuitet. Hver dataklasse skal begrunnes med formål, verdi, sensitivitet, granularitet, tilgang, levetid og sletteregel. Rådata skal kondenseres eller slettes når semantisk informasjon er tilstrekkelig.

**Bindende designkonsekvenser**
- Minimer eksponering, ikke intelligens.
- Skill USER_CONTENT fra SUPPORT_INSIGHT.
- Personalisering ≠ generell modelltrening.
- Avledede hypoteser kan være mer sensitive enn rådata og må styres deretter.

**Kort arkitekturregel**
> Bevar verdi, ikke datastøy.


---

## SKP-050 — Felles semantisk kjerne med språkbevisste realiseringer

**Hva den erstatter eller reviderer**  
Bokmål og nynorsk var tidligere separate redaksjonelle, forfatter-, review-, lyd- og releaseprodukter.

**Ny kanon**  
Skynja skal ha én felles semantisk, pedagogisk og produktmessig kjerne, mens bokmål, nynorsk, talemål, uttale og andre språkvarianter modelleres eksplisitt. Bokmål skal ikke være autoritativ master for nynorsk, men språkvariantene trenger heller ikke være separate produkter.

**Bindende designkonsekvenser**
- Én semantisk autoritet, flere språkrealiteter.
- Språkvariant valideres proporsjonalt med funksjonen.
- Målform, UI-språk, output-språk og talemål er separate dimensjoner.
- Tale → mening → målform er bedre modell enn tale → 'riktig tale' → tekst.

**Kort arkitekturregel**
> Én mening. Flere språkrealiteter. Uavhengig kvalitet der språket faktisk betyr noe.
