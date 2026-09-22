export const OPERATIONS_ARTIFACT_TYPES = Object.freeze([
  "TEACHER_GUIDE", "FIVE_MINUTE_ONBOARDING", "INSTALL_START_GUIDE", "SESSION_SCRIPT",
  "ROLE_ALLOCATION", "PRE_SESSION_CHECKLIST", "IN_SESSION_OBSERVATION", "POST_SESSION_CONVERSATION",
  "ADULT_LOAD_FORM", "ACCESSIBILITY_LOG", "ERROR_REPORT", "INCIDENT_CARD", "STOP_CARD",
  "DELETION_ROUTINE", "SUPPORT_FAQ", "KNOWN_ISSUES", "RELEASE_NOTES", "ROLLBACK_CARD",
  "CONTENT_WITHDRAWAL_CARD", "PARENT_INFORMATION_DRAFT", "STUDENT_INFORMATION_DRAFT",
  "CONSENT_TEMPLATE_DRAFT", "ASSENT_TEMPLATE_DRAFT", "DATA_INVENTORY", "MEASUREMENT_DICTIONARY",
  "AMENDMENT_LOG", "DECISION_LOG",
]);

export const PARTICIPANT_DRAFT_TYPES = new Set([
  "PARENT_INFORMATION_DRAFT", "STUDENT_INFORMATION_DRAFT", "CONSENT_TEMPLATE_DRAFT", "ASSENT_TEMPLATE_DRAFT",
]);

const PARTICIPANT_PROHIBITIONS = Object.freeze([
  "NOT_RECRUITMENT_MATERIAL", "NOT_FINAL_PARTICIPANT_INFORMATION", "NOT_VALID_CONSENT", "NOT_VALID_ASSENT",
  "NOT_PROCESSING_BASIS", "NOT_DPIA", "NOT_LEGAL_REVIEW", "NOT_ETHICS_APPROVAL",
  "NOT_SCHOOL_OWNER_DECISION", "NOT_B8_DECISION", "NO_STUDENT_CONTACT_AUTHORITY",
  "NO_PARENT_CONTACT_AUTHORITY", "NO_PILOT_START_AUTHORITY",
]);

const GENERAL_ALLOWED_USE = Object.freeze([
  "ADULT_ONLY_SYNTHETIC_DRY_RUN", "LOCAL_INTERNAL_REVIEW", "NO_REAL_PARTICIPANTS",
]);
const GENERAL_PROHIBITED_USE = Object.freeze([
  "STUDENT_USE", "RECRUITMENT", "REAL_PERSONAL_DATA", "PROVIDER_ACTIVATION", "PRODUCTION", "B8_DECISION",
]);

const copy = {
  TEACHER_GUIDE: {
    nb: ["Voksenguide for syntetisk dry-run", "Gi en ekstern voksen en selvforklarende og avgrenset operativ inngang.", [
      ["Før du starter", "Bruk bare syntetiske roller og lokale data. Ingen barn, foresatte, lærere eller skoler skal registreres."],
      ["Under dry-run", "Den voksne styrer. WAIT er en gyldig tilstand, STOP dominerer, og stillhet er tillatt."],
      ["Etterpå", "Eksporter bare den lokale reviewpakken ved behov, slett registreringene og kontroller at de ikke kommer tilbake."],
    ]],
    nn: ["Vaksenguide for syntetisk dry-run", "Gi ein ekstern vaksen ein sjølvforklarande og avgrensa operativ inngang.", [
      ["Før du startar", "Bruk berre syntetiske roller og lokale data. Ingen barn, føresette, lærarar eller skular skal registrerast."],
      ["Under dry-run", "Den vaksne styrer. WAIT er ein gyldig tilstand, STOPP dominerer, og stille er tillate."],
      ["Etterpå", "Eksporter berre den lokale reviewpakken ved behov, slett registreringane og kontroller at dei ikkje kjem tilbake."],
    ]],
  },
  FIVE_MINUTE_ONBOARDING: {
    nb: ["Fem minutters onboarding", "Forklare grensene før en voksen starter dry-run.", [
      ["Minutt 0–2", "Les statusene: voksen-only, syntetisk, 0 receipts, B8 ikke beslutningsklar og elevbeta ikke autorisert."],
      ["Minutt 2–4", "Finn WAIT, hjelp, pause, STOP, incidentkortet og sletting. STOP skal alltid være lett tilgjengelig."],
      ["Minutt 4–5", "Velg målform og bekreft at bare tekniske, operative, tilgjengelighets- og innholdsreviewfunn er tillatt."],
    ]],
    nn: ["Fem minutt onboarding", "Forklare grensene før ein vaksen startar dry-run.", [
      ["Minutt 0–2", "Les statusane: berre vaksne, syntetisk, 0 receipts, B8 ikkje avgjerdsklar og elevbeta ikkje autorisert."],
      ["Minutt 2–4", "Finn WAIT, hjelp, pause, STOPP, incidentkortet og sletting. STOPP skal alltid vere lett tilgjengeleg."],
      ["Minutt 4–5", "Vel målform og stadfest at berre tekniske, operative, tilgjenge- og innhaldsreviewfunn er tillatne."],
    ]],
  },
  INSTALL_START_GUIDE: {
    nb: ["Installer og start lokalt", "Starte den eksisterende lokale PWA-flaten uten konto eller ekstern tjeneste.", [
      ["Klargjøring", "Installer avhengigheter fra låsefilen, bygg lokalt og start repositoryets proof-server."],
      ["Kontroll", "Åpne den lokale origin-en. Kamera, mikrofon, ekstern konto, cloud og ekstern logging skal ikke brukes."],
    ]],
    nn: ["Installer og start lokalt", "Starte den eksisterande lokale PWA-flata utan konto eller ekstern teneste.", [
      ["Klargjering", "Installer avhengnader frå låsefila, bygg lokalt og start proof-serveren i repositoryet."],
      ["Kontroll", "Opne den lokale origin-en. Kamera, mikrofon, ekstern konto, sky og ekstern logging skal ikkje brukast."],
    ]],
  },
  SESSION_SCRIPT: {
    nb: ["Manus for adult-only syntetisk dry-run", "Lede den komplette 23-stegs dry-run-en uten muntlig prosjektforklaring.", [
      ["Rekkefølge", "Følg alle 23 nummererte steg i Betaoperasjon. Ikke hopp over STOP, deletion/no-resurrection, rollback eller withdrawal."],
      ["Stoppunkt", "Avslutt før enhver elevbruk, rekruttering, deltakerkontakt, ekte data, provider eller produksjon."],
    ]],
    nn: ["Manus for syntetisk dry-run berre for vaksne", "Leie den komplette dry-run-en på 23 steg utan munnleg prosjektforklaring.", [
      ["Rekkjefølgje", "Følg alle dei 23 nummererte stega i Betaoperasjon. Ikkje hopp over STOPP, sletting/ingen gjenoppliving, rollback eller withdrawal."],
      ["Stoppunkt", "Avslutt før all elevbruk, rekruttering, deltakarkontakt, ekte data, provider eller produksjon."],
    ]],
  },
  ROLE_ALLOCATION: {
    nb: ["Syntetisk rollefordeling", "Fordele tydelige voksenstyrte roller uten å opprette personidentitet.", [
      ["Roller", "Bruk Operatør, Observatør og Sikkerhetsansvarlig som midlertidige funksjoner. Én voksen kan fylle alle."],
      ["Ingen profil", "Ikke registrer navn, skole, kontaktinformasjon eller stabil rolle-ID."],
    ]],
    nn: ["Syntetisk rollefordeling", "Fordele tydelege vaksenstyrte roller utan å opprette personidentitet.", [
      ["Roller", "Bruk Operatør, Observatør og Tryggleiksansvarleg som mellombelse funksjonar. Éin vaksen kan fylle alle."],
      ["Ingen profil", "Ikkje registrer namn, skule, kontaktinformasjon eller stabil rolle-ID."],
    ]],
  },
  PRE_SESSION_CHECKLIST: {
    nb: ["Sjekkliste før dry-run", "Kontrollere at den lokale syntetiske rammen er trygg før start.", [
      ["Må være sant", "Ingen barn er til stede, ingen ekte data er lagt inn, nettverkstjenester er ikke aktivert, og STOP er synlig."],
      ["Versjoner", "Kontroller app-, content-, knowledge-, audio- og operations-revisjon før start."],
    ]],
    nn: ["Sjekkliste før dry-run", "Kontrollere at den lokale syntetiske ramma er trygg før start.", [
      ["Må vere sant", "Ingen barn er til stades, ingen ekte data er lagde inn, nettverkstenester er ikkje aktiverte, og STOPP er synleg."],
      ["Versjonar", "Kontroller app-, content-, knowledge-, audio- og operations-revisjon før start."],
    ]],
  },
  IN_SESSION_OBSERVATION: {
    nb: ["Observasjon under dry-run", "Avgrense observasjon til teknisk og operativ gjennomførbarhet.", [
      ["Tillatt", "Registrer hendelseskode, finding-klasse og en kort voksen-only beskrivelse uten identifikatorer."],
      ["Ikke tillatt", "Ikke vurder kompetanse, leseferdighet, hastighet, motivasjon, evne, diagnose eller readiness."],
    ]],
    nn: ["Observasjon under dry-run", "Avgrense observasjon til teknisk og operativ gjennomføring.", [
      ["Tillate", "Registrer hendingskode, finding-klasse og ei kort skildring berre om vaksenoperasjon utan identifikatorar."],
      ["Ikkje tillate", "Ikkje vurder kompetanse, leseferdigheit, fart, motivasjon, evne, diagnose eller readiness."],
    ]],
  },
  POST_SESSION_CONVERSATION: {
    nb: ["Samtale etter dry-run", "Strukturere en voksenreview uten lærings- eller personpåstander.", [
      ["Spørsmål", "Var instruksjonen forståelig? Var STOP tydelig? Fungerte sletting, rollback og withdrawal?"],
      ["Grense", "Svarene beskriver bare operasjonen og kan ikke tolkes som lærer- eller elevprestasjon."],
    ]],
    nn: ["Samtale etter dry-run", "Strukturere ein vaksenreview utan lærings- eller personpåstandar.", [
      ["Spørsmål", "Var instruksjonen forståeleg? Var STOPP tydeleg? Verka sletting, rollback og withdrawal?"],
      ["Grense", "Svara skildrar berre operasjonen og kan ikkje tolkast som lærar- eller elevprestasjon."],
    ]],
  },
  ADULT_LOAD_FORM: {
    nb: ["Skjema for voksen operatørbelastning", "Registrere en avgrenset voksen-only vurdering av operativ belastning.", [
      ["Svarformat", "Velg en lukket kategori og eventuell kort, identifierguardet kommentar."],
      ["Tolkning", "Resultatet er ikke en kompetansevurdering, rangering eller readinessscore."],
    ]],
    nn: ["Skjema for belastning hos vaksen operatør", "Registrere ei avgrensa vurdering berre av operativ vaksenbelastning.", [
      ["Svarformat", "Vel ein lukka kategori og eventuell kort, identifierguarda kommentar."],
      ["Tolking", "Resultatet er ikkje ei kompetansevurdering, rangering eller readinessskår."],
    ]],
  },
  ACCESSIBILITY_LOG: {
    nb: ["Tilgjengelighetslogg", "Registrere konkrete tilgjengelighetsfunn uten diagnose eller konformitetspåstand.", [
      ["Beskriv", "Oppgi flate, kontroll, forventet atferd og observerbar teknisk effekt uten personopplysninger."],
      ["Begrensning", "Automatisert proof erstatter ikke manuell AT-review og beviser ikke WCAG-konformitet."],
    ]],
    nn: ["Tilgjengelegheitslogg", "Registrere konkrete tilgjengefunn utan diagnose eller konformitetspåstand.", [
      ["Skildre", "Oppgi flate, kontroll, venta åtferd og observerbar teknisk effekt utan personopplysningar."],
      ["Avgrensing", "Automatisert proof erstattar ikkje manuell AT-review og beviser ikkje WCAG-konformitet."],
    ]],
  },
  ERROR_REPORT: {
    nb: ["Teknisk feilrapport", "Registrere minimal, ikke-personlig teknisk evidens.", [
      ["Ta med", "Feilkode, berørt komponent, lokal versjon og om STOP/containment fungerte."],
      ["Ikke ta med", "Ikke legg ved full sessionpayload, navn, skole, kontaktdata eller fritekst om barn."],
    ]],
    nn: ["Teknisk feilrapport", "Registrere minimal, ikkje-personleg teknisk evidens.", [
      ["Ta med", "Feilkode, råka komponent, lokal versjon og om STOPP/containment verka."],
      ["Ikkje ta med", "Ikkje legg ved full sessionpayload, namn, skule, kontaktdata eller fritekst om barn."],
    ]],
  },
  INCIDENT_CARD: {
    nb: ["Incidentkort", "Gi en kort fail-closed prosedyre ved syntetisk incident.", [
      ["Containment", "Blokker ny start, stopp aktiv dry-run og lyd, kanseller ventende UI-handlinger og isoler komponenten."],
      ["Videre", "Bevar bare minimal teknisk evidens, velg rollback eller withdrawal og krev eksplisitt ny start."],
    ]],
    nn: ["Incidentkort", "Gi ein kort fail-closed prosedyre ved syntetisk incident.", [
      ["Containment", "Blokker ny start, stopp aktiv dry-run og lyd, kanseller ventande UI-handlingar og isoler komponenten."],
      ["Vidare", "Bevar berre minimal teknisk evidens, vel rollback eller withdrawal og krev eksplisitt ny start."],
    ]],
  },
  STOP_CARD: {
    nb: ["STOP-kort", "Gjøre STOP-dominans eksplisitt i alle dry-run-tilstander.", [
      ["STOP gjør", "Stopper aktiv aktivitet, ventende handlinger, lyd, voksenkort og dry-run-progresjon."],
      ["Restart", "En stoppet økt kan ikke fortsette. Ny eksplisitt lokal session kreves."],
    ]],
    nn: ["STOPP-kort", "Gjere STOPP-dominans eksplisitt i alle dry-run-tilstandar.", [
      ["STOPP gjer", "Stoppar aktiv aktivitet, ventande handlingar, lyd, vaksenkort og dry-run-progresjon."],
      ["Omstart", "Ei stoppa økt kan ikkje halde fram. Ny eksplisitt lokal session er kravd."],
    ]],
  },
  DELETION_ROUTINE: {
    nb: ["Rutine for sletting og no-resurrection", "Slette dry-run-state og kontrollere at den ikke gjenopplives.", [
      ["Slett", "Stopp aktivitet og lyd, slett lokale records, invalidér sessionstate og behold bare nødvendig tombstone."],
      ["Kontroller", "Reconnect, refresh og ny eksport skal ikke inneholde slettede records. Ny session må opprettes eksplisitt."],
    ]],
    nn: ["Rutine for sletting og inga gjenoppliving", "Slette dry-run-state og kontrollere at han ikkje blir gjenoppliva.", [
      ["Slett", "Stopp aktivitet og lyd, slett lokale records, invalidér sessionstate og bevar berre nødvendig tombstone."],
      ["Kontroller", "Reconnect, refresh og ny eksport skal ikkje innehalde sletta records. Ny session må opprettast eksplisitt."],
    ]],
  },
  SUPPORT_FAQ: {
    nb: ["Support-FAQ", "Svare på avgrensede operative spørsmål uten ekstern logging.", [
      ["Hvis noe stopper", "Bruk STOP først, les feilkoden og følg incidentkortet. Ikke send sessionpayload eller persondata."],
      ["Hvis målform mangler", "Stopp og rett pakken. Det finnes ingen språkfallback."],
    ]],
    nn: ["Support-FAQ", "Svare på avgrensa operative spørsmål utan ekstern logging.", [
      ["Viss noko stoppar", "Bruk STOPP først, les feilkoden og følg incidentkortet. Ikkje send sessionpayload eller persondata."],
      ["Viss målform manglar", "Stopp og rett pakken. Det finst ingen språkfallback."],
    ]],
  },
  KNOWN_ISSUES: {
    nb: ["Kjente begrensninger", "Synliggjøre åpne gap og ikke-testede flater.", [
      ["Åpent", "Manuell skjermleser-/AT-review, fysiske enheter, Firefox, Safari/iOS og produksjonsmiljø er ikke testet."],
      ["Ikke autorisert", "Ingen ekte deltakere, provider, produksjon, B8 eller studentbeta."],
    ]],
    nn: ["Kjende avgrensingar", "Synleggjere opne gap og ikkje-testa flater.", [
      ["Ope", "Manuell skjermlesar-/AT-review, fysiske einingar, Firefox, Safari/iOS og produksjonsmiljø er ikkje testa."],
      ["Ikkje autorisert", "Ingen ekte deltakarar, provider, produksjon, B8 eller studentbeta."],
    ]],
  },
  RELEASE_NOTES: {
    nb: ["Release-notater for WP13.11", "Beskrive den nye operations-revisjonen uten å overdrive evidens.", [
      ["Implementert", "27 semantiske artefakter i separate BM- og NN-filer (nb/nn), voksen-only dry-run, validering, driller og lokal eksport."],
      ["Status", "Klar for adult-only syntetisk dry-run. Eksterne receipts er 0; B8 og elevbeta er ikke autorisert."],
    ]],
    nn: ["Release-notat for WP13.11", "Skildre den nye operations-revisjonen utan å overdrive evidens.", [
      ["Implementert", "27 semantiske artefaktar i separate BM- og NN-filer (nb/nn), dry-run berre for vaksne, validering, driller og lokal eksport."],
      ["Status", "Klar for syntetisk dry-run berre for vaksne. Eksterne receipts er 0; B8 og elevbeta er ikkje autorisert."],
    ]],
  },
  ROLLBACK_CARD: {
    nb: ["Rollbackkort", "Gjennomføre uavhengig, sporbar lokal rollback av releasekomponenter.", [
      ["Velg komponent", "App, content, knowledge, audio og operations skal kunne rollbackes uavhengig."],
      ["Fail closed", "Ikke aktiver unknown, withdrawn, inkompatibel eller samme revisjon. Ikke gjenoppliv slettet state."],
    ]],
    nn: ["Rollbackkort", "Gjennomføre uavhengig, sporbar lokal rollback av releasekomponentar.", [
      ["Vel komponent", "App, content, knowledge, audio og operations skal kunne rollbackast uavhengig."],
      ["Fail closed", "Ikkje aktiver unknown, withdrawn, inkompatibel eller same revisjon. Ikkje gjenoppliv sletta state."],
    ]],
  },
  CONTENT_WITHDRAWAL_CARD: {
    nb: ["Kort for content withdrawal", "Kontrollere at tilbaketrukket materiale ikke kan åpnes eller gjenopplives.", [
      ["Trekk tilbake", "Blokker aktiviteten, knowledge og audio og vis erstatnings- eller stoppstatus."],
      ["Kontroller cache", "Offline cache, refresh og rollback skal ikke aktivere withdrawn materiale."],
    ]],
    nn: ["Kort for content withdrawal", "Kontrollere at tilbaketrekt materiale ikkje kan opnast eller gjenopplivast.", [
      ["Trekk tilbake", "Blokker aktiviteten, knowledge og audio og vis erstatnings- eller stoppstatus."],
      ["Kontroller cache", "Offline cache, refresh og rollback skal ikkje aktivere withdrawn materiale."],
    ]],
  },
  PARENT_INFORMATION_DRAFT: {
    nb: ["Utkast til foresattinformasjon – ikke autorisert", "Gi voksne et tydelig internt reviewutkast uten kontakt- eller rekrutteringsfullmakt.", [
      ["Utkaststatus", "Dette er ikke ferdig deltakerinformasjon, juridisk vurdering, DPIA, etisk godkjenning, skoleeierbeslutning eller B8-vedtak."],
      ["Ingen kontakt", "Utkastet autoriserer ikke kontakt med foresatte eller elever og autoriserer ikke pilotstart."],
    ]],
    nn: ["Utkast til informasjon for føresette – ikkje autorisert", "Gi vaksne eit tydeleg internt reviewutkast utan kontakt- eller rekrutteringsfullmakt.", [
      ["Utkaststatus", "Dette er ikkje ferdig deltakarinformasjon, juridisk vurdering, DPIA, etisk godkjenning, skuleeigaravgjerd eller B8-vedtak."],
      ["Ingen kontakt", "Utkastet autoriserer ikkje kontakt med føresette eller elevar og autoriserer ikkje pilotstart."],
    ]],
  },
  STUDENT_INFORMATION_DRAFT: {
    nb: ["Utkast til elevinformasjon – ikke autorisert", "Gi voksne et verdig, aldersuavhengig internt reviewutkast uten elevbruk.", [
      ["Utkaststatus", "Dette er ikke godkjent elevinformasjon, samtykke, assent, behandlingsgrunnlag, DPIA eller B8-vedtak."],
      ["Ingen elevbruk", "Teksten skal ikke vises til eller brukes for å kontakte elever før separat menneskelig godkjenning og autorisasjon."],
    ]],
    nn: ["Utkast til elevinformasjon – ikkje autorisert", "Gi vaksne eit verdig, aldersuavhengig internt reviewutkast utan elevbruk.", [
      ["Utkaststatus", "Dette er ikkje godkjend elevinformasjon, samtykke, assent, behandlingsgrunnlag, DPIA eller B8-vedtak."],
      ["Ingen elevbruk", "Teksten skal ikkje visast til eller brukast for å kontakte elevar før separat menneskeleg godkjenning og autorisasjon."],
    ]],
  },
  CONSENT_TEMPLATE_DRAFT: {
    nb: ["Samtykkemal – utkast uten gyldighet", "Strukturere senere juridisk og etisk review uten å skape samtykke.", [
      ["Ikke gyldig", "Dette utkastet er ikke gyldig samtykke, behandlingsgrunnlag, juridisk review, etisk godkjenning eller skoleeierbeslutning."],
      ["Ingen handling", "Utkastet gir ingen fullmakt til rekruttering, kontakt, databehandling eller pilotstart."],
    ]],
    nn: ["Samtykkemal – utkast utan gyldigheit", "Strukturere seinare juridisk og etisk review utan å skape samtykke.", [
      ["Ikkje gyldig", "Dette utkastet er ikkje gyldig samtykke, behandlingsgrunnlag, juridisk review, etisk godkjenning eller skuleeigaravgjerd."],
      ["Inga handling", "Utkastet gir inga fullmakt til rekruttering, kontakt, databehandling eller pilotstart."],
    ]],
  },
  ASSENT_TEMPLATE_DRAFT: {
    nb: ["Assentmal – utkast uten gyldighet", "Strukturere senere menneskelig review uten å simulere barns medvirkning.", [
      ["Ikke gyldig", "Dette er ikke gyldig assent, samtykke, behandlingsgrunnlag, etisk godkjenning, DPIA eller B8-vedtak."],
      ["Ingen simulering", "Dry-run skal ikke late som et barn har lest, forstått eller akseptert noe."],
    ]],
    nn: ["Assentmal – utkast utan gyldigheit", "Strukturere seinare menneskeleg review utan å simulere medverknad frå barn.", [
      ["Ikkje gyldig", "Dette er ikkje gyldig assent, samtykke, behandlingsgrunnlag, etisk godkjenning, DPIA eller B8-vedtak."],
      ["Inga simulering", "Dry-run skal ikkje late som eit barn har lese, forstått eller akseptert noko."],
    ]],
  },
  DATA_INVENTORY: {
    nb: ["Datainventar", "Vise nøyaktig hvilke lokale syntetiske dataklasser som er tillatt og forbudt.", [
      ["Tillatt", "Kun syntetisk sessionstate, versjoner, lukkede tekniske koder, korte guardede voksenfunn, drillresultat og lokal eksport."],
      ["Forbudt", "Ingen ekte person- eller skoledata, medier, stabil identitet, kryssøktkobling, analytics, replay, heatmaps eller fingerprinting."],
    ]],
    nn: ["Datainventar", "Vise nøyaktig kva lokale syntetiske dataklassar som er tillatne og forbodne.", [
      ["Tillate", "Berre syntetisk sessionstate, versjonar, lukka tekniske kodar, korte guarda vaksenfunn, drillresultat og lokal eksport."],
      ["Forbode", "Ingen ekte person- eller skuledata, medium, stabil identitet, kopling mellom økter, analytics, replay, heatmaps eller fingerprinting."],
    ]],
  },
  MEASUREMENT_DICTIONARY: {
    nb: ["Måleordbok", "Avgrense alle målinger før B8 til voksen-only operativ gjennomførbarhet.", [
      ["Tillatt", "Voksen onboardingtid, instruksjonsforståelse, operatørbelastning, tekniske koder, reviewfunn og drillresultater."],
      ["Forbudt", "Ingen elevresultater, hastighet, nivå, profil, progresjon, inferens, engagement- eller readinessscore."],
    ]],
    nn: ["Måleordbok", "Avgrense alle målingar før B8 til operativ gjennomføring berre for vaksne.", [
      ["Tillate", "Onboardingtid for vaksen, instruksjonsforståing, operatørbelastning, tekniske kodar, reviewfunn og drillresultat."],
      ["Forbode", "Ingen elevresultat, fart, nivå, profil, progresjon, inferens, engagement- eller readinessskår."],
    ]],
  },
  AMENDMENT_LOG: {
    nb: ["Endringslogg", "Bevare append-only sporbarhet for operations-artefaktene.", [
      ["Registrer", "Oppgi revisjon, fast dato, årsak og at ingen ekstern receipt foreligger."],
      ["Ikke omskriv", "Supersession og withdrawal skal vises eksplisitt; eldre spor skal ikke skjules."],
    ]],
    nn: ["Endringslogg", "Bevare append-only sporbarheit for operations-artefaktane.", [
      ["Registrer", "Oppgi revisjon, fast dato, årsak og at ingen ekstern receipt ligg føre."],
      ["Ikkje skriv om", "Supersession og withdrawal skal visast eksplisitt; eldre spor skal ikkje skjulast."],
    ]],
  },
  DECISION_LOG: {
    nb: ["Beslutningslogg", "Skille tekniske implementeringsvalg fra eier-, juridiske og etiske beslutninger.", [
      ["Kan logges", "Lokale tekniske valg, åpne reviewbehov og eksplisitte stoppunkter."],
      ["Kan ikke tas her", "B8, rekruttering, elevbeta, behandlingsgrunnlag, skoleeieransvar og produksjonsautorisasjon."],
    ]],
    nn: ["Avgjerdslogg", "Skilje tekniske implementeringsval frå eigar-, juridiske og etiske avgjerder.", [
      ["Kan loggast", "Lokale tekniske val, opne reviewbehov og eksplisitte stoppunkt."],
      ["Kan ikkje takast her", "B8, rekruttering, elevbeta, behandlingsgrunnlag, skuleeigaransvar og produksjonsautorisasjon."],
    ]],
  },
};

const dryRunText = [
  ["Les den operative avgrensningen.", "Les den operative avgrensinga."],
  ["Velg målform.", "Vel målform."],
  ["Åpne onboarding.", "Opne onboarding."],
  ["Fullfør sjekklisten før økten.", "Fullfør sjekklista før økta."],
  ["Fordel syntetiske roller.", "Fordel syntetiske roller."],
  ["Start en syntetisk session.", "Start ein syntetisk session."],
  ["Bruk WAIT.", "Bruk WAIT."],
  ["Bruk hjelp.", "Bruk hjelp."],
  ["Bruk pause.", "Bruk pause."],
  ["Bruk STOP.", "Bruk STOPP."],
  ["Utløs en teknisk feil.", "Utløys ein teknisk feil."],
  ["Følg incidentprosedyren.", "Følg incidentprosedyren."],
  ["Slett lokal sessionstate.", "Slett lokal sessionstate."],
  ["Kontroller no-resurrection.", "Kontroller inga gjenoppliving."],
  ["Gjennomfør rollback.", "Gjennomfør rollback."],
  ["Gjennomfør content withdrawal.", "Gjennomfør content withdrawal."],
  ["Registrer et tillatt teknisk eller voksen-only funn.", "Registrer eit tillate teknisk funn eller vaksenfunn."],
  ["Registrer et tilgjengelighetsfunn.", "Registrer eit tilgjengefunn."],
  ["Registrer et innholdsreviewfunn.", "Registrer eit innhaldsreviewfunn."],
  ["Eksporter den lokale reviewpakken.", "Eksporter den lokale reviewpakken."],
  ["Slett dry-run-records.", "Slett dry-run-records."],
  ["Kontroller at slettede records ikke kommer tilbake.", "Kontroller at sletta records ikkje kjem tilbake."],
  ["Kontroller at ny eksport ikke inneholder slettede records.", "Kontroller at ny eksport ikkje inneheld sletta records."],
];

const dryRunStepIds = [
  "READ_BOUNDARY", "SELECT_LOCALE", "OPEN_ONBOARDING", "COMPLETE_PRE_SESSION_CHECKLIST",
  "ALLOCATE_SYNTHETIC_ROLES", "START_SYNTHETIC_SESSION", "USE_WAIT", "USE_HELP", "USE_PAUSE",
  "USE_STOP", "TRIGGER_TECHNICAL_ERROR", "FOLLOW_INCIDENT_PROCEDURE", "DELETE_LOCAL_STATE",
  "VERIFY_NO_RESURRECTION", "RUN_ROLLBACK", "RUN_CONTENT_WITHDRAWAL",
  "RECORD_TECHNICAL_OR_ADULT_FINDING", "RECORD_ACCESSIBILITY_FINDING",
  "RECORD_CONTENT_REVIEW_FINDING", "EXPORT_LOCAL_REVIEW_PACKAGE", "DELETE_DRY_RUN_RECORDS",
  "VERIFY_RECORDS_STAY_DELETED", "VERIFY_NEW_EXPORT_EXCLUDES_DELETED_RECORDS",
];

const allowedMetricRows = [
  ["adult_onboarding_minutes", "Elapsed adult onboarding time", "Check whether the adult-only instructions can be followed", "whole_minutes"],
  ["adult_instruction_understanding", "Adult self-report of instruction clarity", "Improve the operations guide", "CLEAR|PARTLY_CLEAR|UNCLEAR"],
  ["adult_operator_load", "Adult self-report of operational load", "Find avoidable operational burden", "LOW|MODERATE|HIGH"],
  ["accessibility_finding", "Structured non-diagnostic accessibility finding", "Identify a review item", "finding_classification"],
  ["content_review_finding", "Structured adult content-review finding", "Identify a draft content review item", "finding_classification"],
  ["technical_error_code", "Closed technical error code", "Reproduce a technical failure", "controlled_code"],
  ["incident_class", "Closed synthetic incident class", "Exercise containment", "SEV0|SEV1|SEV2"],
  ["rollback_drill_result", "Outcome of local rollback drill", "Verify independent rollback", "PASS|FAIL|NOT_RUN"],
  ["stop_drill_result", "Outcome of STOP dominance drill", "Verify STOP dominance", "PASS|FAIL|NOT_RUN"],
  ["deletion_drill_result", "Outcome of deletion/no-resurrection drill", "Verify deletion boundary", "PASS|FAIL|NOT_RUN"],
  ["withdrawal_drill_result", "Outcome of content-withdrawal drill", "Verify withdrawn material stays unavailable", "PASS|FAIL|NOT_RUN"],
];

const forbiddenMetricIds = [
  "student_accuracy", "student_speed", "student_reading_level", "student_error_profile", "engagement_score",
  "cross_session_progress", "affect_inference", "motivation_inference", "ability_inference",
  "diagnostic_inference", "readiness_score", "combined_student_score",
];

const allowedDataClasses = [
  "SYNTHETIC_SESSION_STATE", "SYNTHETIC_ROLE", "LOCAL_APP_VERSION", "LOCAL_CONTENT_VERSION",
  "LOCAL_KNOWLEDGE_VERSION", "LOCAL_AUDIO_VERSION", "LOCAL_OPERATIONS_VERSION", "TECHNICAL_ERROR_CLASS",
  "SHORT_STRUCTURED_ADULT_FINDING", "ACCESSIBILITY_FINDING", "CONTENT_REVIEW_FINDING", "DRILL_RESULT",
  "LOCAL_EXPORT_FILE",
];
const prohibitedDataClasses = [
  "REAL_STUDENT_DATA", "REAL_PARENT_DATA", "REAL_TEACHER_DATA", "REAL_SCHOOL_DATA", "SCHOOL_NAME",
  "PERSON_NAME", "EMAIL", "PHONE_NUMBER", "STUDENT_NUMBER", "DATE_OF_BIRTH", "DIAGNOSIS",
  "HEALTH_INFORMATION", "AUDIO_RECORDING", "IMAGE", "VIDEO", "MICROPHONE_DATA", "CAMERA_DATA",
  "FREE_TEXT_ABOUT_CHILDREN", "FULL_SESSION_PAYLOAD", "STABLE_IDENTITY", "CROSS_SESSION_LINKAGE",
  "ANALYTICS", "SESSION_REPLAY", "HEATMAPS", "FINGERPRINTING",
];

export const officialSourceRegister = Object.freeze([
  {
    sourceId: "OFFICIAL-DATATILSYNET-DPIA",
    title: "Veiledning om vurdering av personvernkonsekvenser (DPIA)",
    publisher: "Datatilsynet",
    url: "https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdering-av-personvernkonsekvenser/",
    checkedAt: "2026-07-22",
    claimScope: "Structure later DPIA work and risk questions",
    cannotDecide: ["Whether a DPIA is complete", "Legal basis", "Student use", "B8"],
    reverificationRequiredBefore: "ANY_EXTERNAL_REVIEW_OR_B8_DECISION",
  },
  {
    sourceId: "OFFICIAL-UDIR-SCHOOL-PRIVACY",
    title: "Personvern i barnehage og skole",
    publisher: "Utdanningsdirektoratet",
    url: "https://www.udir.no/regelverk-og-tilsyn/personvern-for-barnehage-og-skole/",
    checkedAt: "2026-07-22",
    claimScope: "Structure school-owner privacy questions and data minimisation",
    cannotDecide: ["School-owner approval", "Processing basis", "Recruitment", "Student use"],
    reverificationRequiredBefore: "ANY_SCHOOL_OWNER_OR_PRIVACY_REVIEW",
  },
  {
    sourceId: "OFFICIAL-UDIR-STUDENT-RIGHTS",
    title: "Barn og elevers personvernrettigheter",
    publisher: "Utdanningsdirektoratet",
    url: "https://www.udir.no/regelverk-og-tilsyn/personvern-for-barnehage-og-skole/elevenes-rettigheter/",
    checkedAt: "2026-07-22",
    claimScope: "Structure later transparency and information review",
    cannotDecide: ["Final participant information", "Consent", "Assent", "Contact authority"],
    reverificationRequiredBefore: "ANY_PARTICIPANT_INFORMATION_REVIEW",
  },
  {
    sourceId: "OFFICIAL-W3C-WCAG22",
    title: "Web Content Accessibility Guidelines (WCAG) 2.2",
    publisher: "World Wide Web Consortium",
    url: "https://www.w3.org/TR/WCAG22/",
    checkedAt: "2026-07-22",
    claimScope: "Structure accessibility checks and manual review planning",
    cannotDecide: ["WCAG conformance", "Manual AT acceptance", "Student readiness"],
    reverificationRequiredBefore: "ANY_CONFORMANCE_CLAIM_OR_EXTERNAL_ACCESSIBILITY_REVIEW",
  },
  {
    sourceId: "OFFICIAL-NIST-SP800-61R3",
    title: "NIST SP 800-61 Rev. 3 Incident Response Recommendations",
    publisher: "National Institute of Standards and Technology",
    url: "https://csrc.nist.gov/pubs/sp/800/61/r3/final",
    checkedAt: "2026-07-22",
    claimScope: "Structure synthetic incident preparation, containment and recovery drills",
    cannotDecide: ["Production incident readiness", "Organisational approval", "B8", "Student use"],
    reverificationRequiredBefore: "ANY_PRODUCTION_SECURITY_OR_INCIDENT_REVIEW",
  },
]);

function sections(locale, rows) {
  return rows.map(([heading, paragraph], index) => ({
    sectionId: `${locale}-section-${String(index + 1).padStart(2, "0")}`,
    heading,
    paragraphs: [paragraph],
  }));
}

function sourceReferences(type) {
  const refs = ["INTERNAL-WP13-11-SCOPE", "INTERNAL-WP13-10-BASELINE"];
  if (["DATA_INVENTORY", "PARENT_INFORMATION_DRAFT", "STUDENT_INFORMATION_DRAFT", "CONSENT_TEMPLATE_DRAFT", "ASSENT_TEMPLATE_DRAFT"].includes(type)) {
    refs.push("OFFICIAL-DATATILSYNET-DPIA", "OFFICIAL-UDIR-SCHOOL-PRIVACY", "OFFICIAL-UDIR-STUDENT-RIGHTS");
  }
  if (type === "ACCESSIBILITY_LOG") refs.push("OFFICIAL-W3C-WCAG22");
  if (["INCIDENT_CARD", "ERROR_REPORT"].includes(type)) refs.push("OFFICIAL-NIST-SP800-61R3");
  return refs;
}

function buildArtifact(type, locale) {
  const [title, purpose, contentRows] = copy[type][locale];
  const participantDraft = PARTICIPANT_DRAFT_TYPES.has(type);
  return {
    artifactId: `wp13-11.${type.toLowerCase().replaceAll("_", "-")}.${locale}.v1`,
    artifactType: type,
    version: "1.0.0-draft",
    locale,
    title,
    audience: participantDraft ? ["ADULT_INTERNAL_REVIEWER"] : ["ADULT_OPERATOR", "ADULT_REVIEWER"],
    status: participantDraft ? "DRAFT_NOT_AUTHORIZED_FOR_STUDENT_USE" : "DRAFT_FOR_ADULT_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    authorizationStatus: participantDraft ? "NOT_AUTHORIZED_FOR_STUDENT_USE" : "ADULT_ONLY_SYNTHETIC_DRY_RUN_ONLY",
    purpose,
    allowedUse: participantDraft ? ["ADULT_INTERNAL_REVIEW_ONLY", "LEGAL_ETHICS_OWNER_REVIEW_REQUIRED"] : GENERAL_ALLOWED_USE,
    prohibitedUse: participantDraft ? PARTICIPANT_PROHIBITIONS : GENERAL_PROHIBITED_USE,
    contentSections: sections(locale, contentRows),
    sourceReferences: sourceReferences(type),
    amendmentHistory: [{
      revision: 1,
      at: "2026-07-22T00:00:00.000Z",
      reason: "Initial WP13.11 adult-only review draft",
      externalReceipt: false,
    }],
    withdrawalStatus: "CURRENT",
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
  };
}

export function buildOperationsKit(appVersion = "0.14.0-reconstructed.8") {
  const artifacts = OPERATIONS_ARTIFACT_TYPES.flatMap((type) => [buildArtifact(type, "nb"), buildArtifact(type, "nn")]);
  const metrics = allowedMetricRows.map(([metricId, definition, purpose, unitOrValueType]) => ({
    metricId,
    definition,
    purpose,
    unitOrValueType,
    allowedContext: "ADULT_ONLY_SYNTHETIC_DRY_RUN",
    prohibitedInterpretation: [
      "ADULT_COMPETENCE", "TEACHER_PERFORMANCE", "STUDENT_PERFORMANCE", "STUDENT_PROFILE",
      "TREATMENT_EFFECT", "READING_DEVELOPMENT", "MOTIVATION", "ABILITY", "DIAGNOSIS", "PILOT_READINESS",
    ],
    retention: "MEMORY_UNTIL_EXPLICIT_DELETE_OR_LOCAL_EXPORT",
    containsPersonalData: false,
    crossSessionLinkage: false,
    studentData: false,
    authorization: "AUTHORIZED_FOR_ADULT_ONLY_SYNTHETIC_DRY_RUN",
  }));
  const forbiddenMetrics = forbiddenMetricIds.map((metricId) => ({
    metricId,
    status: "NOT_COLLECTED",
    technicallyBlocked: true,
    blockedAcross: ["DOMAIN", "CONTROLLER", "SCHEMA", "UI", "EXPORT", "STORAGE", "LOGS", "FIXTURES", "TEST_DATA", "DOCUMENTATION", "RELEASE"],
    reason: "Student measurement, profiling, inference and combined scoring are outside WP13.11 authorization.",
  }));
  const dataInventory = [
    ...allowedDataClasses.map((dataClass) => ({
      dataClass,
      status: "ALLOWED_SYNTHETIC_LOCAL",
      purpose: "Adult-only synthetic dry-run operations",
      source: "LOCAL_EXPLICIT_ADULT_ACTION_OR_FIXED_RELEASE_METADATA",
      storageLocation: dataClass === "LOCAL_EXPORT_FILE" ? "LOCAL_EXPLICIT_EXPORT" : "MEMORY_ONLY",
      retention: "UNTIL_EXPLICIT_DELETE_OR_PAGE_CLOSE",
      deletionMethod: "EXPLICIT_DELETE_AND_NEW_EXPORT_VERIFICATION",
      exported: dataClass !== "SYNTHETIC_SESSION_STATE" && dataClass !== "SYNTHETIC_ROLE",
      personalData: false,
      studentData: false,
      identifierRisk: dataClass.includes("FINDING") ? "LOW_GUARDED" : "NONE",
      authorized: true,
    })),
    ...prohibitedDataClasses.map((dataClass) => ({
      dataClass,
      status: "PROHIBITED",
      purpose: "NONE",
      source: "NONE",
      storageLocation: "NOWHERE",
      retention: "NOT_COLLECTED",
      deletionMethod: "REJECT_BEFORE_STORAGE",
      exported: false,
      personalData: false,
      studentData: false,
      identifierRisk: "PROHIBITED",
      authorized: false,
    })),
  ];
  return {
    schemaVersion: "wp13.11-operations-v1",
    operationsReleaseId: "wp13-11-operations-kit-r1",
    version: "1.0.0-draft",
    locales: ["nb", "nn"],
    artifacts,
    metrics,
    forbiddenMetrics,
    dataInventory,
    officialSourceIds: officialSourceRegister.map((source) => source.sourceId),
    dryRunSteps: dryRunStepIds.map((stepId, index) => ({
      stepId,
      sequence: index + 1,
      nb: dryRunText[index][0],
      nn: dryRunText[index][1],
      adultOnly: true,
      studentData: false,
    })),
    authorization: {
      operationsKit: "READY_FOR_ADULT_ONLY_DRY_RUN",
      externalReceipts: 0,
      b8: "NOT_DECISION_READY",
      studentBetaAuthorized: false,
      recruitmentAuthorized: false,
      parentContactForParticipationAuthorized: false,
      realStudentDataAuthorized: false,
      realParentDataAuthorized: false,
      realTeacherDataAuthorized: false,
      realSchoolDataAuthorized: false,
      providerActivation: false,
      productionAuthorized: false,
      runtimeAiPresent: false,
    },
    releaseComponents: {
      appVersion,
      contentReleaseId: "wp13-8-authentic-draft-corpus-r1",
      knowledgeReleaseId: "release-knowledge-audio-prototype-001",
      audioReleaseId: "wp13-9-audio-specifications-r1",
      operationsReleaseId: "wp13-11-operations-kit-r1",
      schemaVersion: "wp13.11-release-v2",
    },
    exportPolicy: {
      localOnly: true,
      explicitInitiationRequired: true,
      containsPersonalData: false,
      containsStudentData: false,
      deterministic: true,
    },
  };
}
