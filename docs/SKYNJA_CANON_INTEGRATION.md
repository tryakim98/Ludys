# Integrasjon av Skynja-kanon 1.0 — 23. september 2026

## Hva som er integrert

Alle **50 SKP-prinsipper** er tatt inn som arbeidsretning for produktdesign. De **20 beholdte reglene** gjelder innen sitt reviderte scope. Originalpakkens ti filer ligger bytebevart i [`canon/skynja-v1.0`](canon/skynja-v1.0/README_FIRST.md); de skal ikke redigeres som lokale arbeidsnotater.

Kildepakken har SHA-256 `0a24786a1b29190b6cbe88c33eb2dd874801f55fff578818ea3a5a5515af3e54`. Manifestets SHA-256 er `55184c7ac18d3e0c52127989812cb898640b287d41fc9dc9b56bb14c31055bf7`. `.gitattributes` bevarer linjeskift ved Windows-checkout. `npm run canon:check` kontrollerer filhashene, indeksene, supersession-registeret og lokal migrasjonsdekning.

[`config/skynja-canon-integration.json`](../config/skynja-canon-integration.json) knytter hvert prinsipp til et arbeidsområde, berørte filer, implementasjonsstatus og gjenstående arbeid. Ingen av de 50 prinsippene er merket fullt implementert. Den første integrasjonen ga SKP-031, SKP-041, SKP-042 og SKP-050 delvise kontrakter. Det påfølgende [øvelsesrommet](SKYNJA_EXERCISE_ROOM_2026-09-23.md) legger til delimplementasjoner for SKP-007, 008, 016 og 043 og utvider språkimplementasjonen for SKP-050. Øvrige krever videre migrasjon.

## Autoritet og historikk

1. Skynja-kanon 1.0 styrer ny produkt-/designretning foran motstridende eldre produktregler.
2. Kompatible krav til evidens, sikkerhet, tilgjengelighet, versjonering, STOP, sletting, reversibilitet og proveniens består.
3. Konkrete providerbeslutninger, review, behandling av reelle persondata, klinisk bruk, skoleeierbeslutninger og pilot-/releaseporter er selvstendige. Kanonadopsjon er ingen slik kvittering.
4. Historiske proofkontrakter og ekte testresultater bevares. En avgrenset øktmodell kan fortsatt bevises uten å bli hele produktets arkitektur.

`AGENTS.md`, README, rekonstruksjonskontrakten, nåstatus, rollegrensene og arkitektur-/beslutningsdokumentene peker nå til riktig autoritet. Den tidligere nåstatusen er bevart i [`history/TECHNICAL_STATUS_BEFORE_SKYNJA_2026-09-23.md`](history/TECHNICAL_STATUS_BEFORE_SKYNJA_2026-09-23.md).

Den gamle lintregelen behandlet AI, stabil identitet, profil og dynamisk tale som globale forbud. Disse kontrollene gjelder nå de **85 eksisterende proofmodulene** i [`config/legacy-proof-scope.json`](../config/legacy-proof-scope.json). Nye kontrakter er ikke underlagt utdaterte produktforbud. Skjult sosial rangering, automatisk pilot-/ekte-data-autorisasjon og uavklarte runtimeavhengigheter er fortsatt blokkert. Listen er hashbundet; flytting av filer er ikke en migrasjon.

## Første tekniske integrasjon: kontrollert kunnskapsbruk

- [`src/core/skynja/knowledge-policy.ts`](../src/core/skynja/knowledge-policy.ts) modellerer SOURCE → EVIDENCE → CLAIM → PRODUCT_RULE → RUNTIME_USE. Referansene er versjonerte. Evidensstyrke, claimscope, påstandstype, produktutfall og tillatelse til bruk er atskilte.
- [`src/ports/skynja/knowledge-assistance.ts`](../src/ports/skynja/knowledge-assistance.ts) skiller et kontrollert bibliotek fra en utskiftbar velger.
- [`src/application/skynja/knowledge-assistance.ts`](../src/application/skynja/knowledge-assistance.ts) kontrollerer kontekst før valg og igjen før levering. Stopp, utløp, tilbakekalling eller endret bibliotek hindrer forsinkede svar.

Velgeren kan bare returnere ID-er for tillatte utdrag. Svaret henter selve teksten fra biblioteket. Frie modellpåstander, ukjente referanser og ekstra svarfelt avvises. Dette er en **deterministisk integrasjonskontrakt for valg av kontrollerte utdrag**, ikke en ferdig generativ samtaletjeneste eller semantisk faktasjekker.

Begrensende og motstridende evidens følger med svaret. Svak evidens kan brukes innen en eksplisitt avgrenset bruksbeslutning, men blir ikke sterk evidens eller validert produkteffekt. Kunnskapshull gir avståelse; det finnes ingen web-fallback. Bibliotekadapteren er en tillitsgrense: den må senere kunne bevise review, signerte/etterprøvbare beslutninger, tilgang og tilbakekalling. Referanser alene beviser ikke menneskelig review.

UI-språk, output-språk, skriftmål og talemål er separate felter. Nynorsk kan velges i et bokmålsgrensesnitt uten å gjøre bokmål til master. Manglende nynorskvariant eller review gir avståelse, ikke bokmålsfallback. Talemål blir ikke brukt som feilmarkør.

Modulene er ikke koblet til appens learner-runtime, en AI-provider eller et eksternt nettverk. Det er ikke lagt inn noe faktisk godkjent fagbibliotek. Positive testdata og reviewreferanser er uttrykkelig syntetiske og finnes bare i testene. Autoriserte brukerdata, situasjonsdata og personlig inferens skal senere få egne kontrakter og kan ikke snikes inn som domenekilder.

## Innholdsarbeidet videre

De to nye verkstedutkastene, «Måne og såpe» og «Kake og bake», videreføres som utkast. Støttepersonen skal kunne avklare ønsket hjelp; støttet gjennomføring får verdi som konkret funksjon uten å bli bevis på uavhengig lesing eller staving. Det er fortsatt den voksne som hører eventuell muntlig lesing i denne avgrensede proofen.

De åtte historiske pakkene og elevkatalogen endres ikke av kanonintegrasjonen. Formatfeltene for voksenstyring, alder, øktbinding og separate språkvarianter beskriver dagens kompatibilitetsformat. De er ikke nye universelle Skynja-krav. Neste forfatterskjema må modellere støtteformål og mandat eksplisitt og bevare import av eldre pakker. Alle ti pakker mangler fortsatt nødvendig ekstern godkjenning.

## Migrasjonsområder

| Område | Kanon | Neste konkrete arbeid |
|---|---|---|
| Kalibrert evidens | 001, 010, 022, 030, 033, 042, 047 | Observasjon, mønster, hypotese og fakta med alternative forklaringer og gyldig konstruktkobling |
| Kontinuitet og personmodell | 002, 020, 026, 029, 049 | Korrigerbart minne, separate identitets-/tilgangsbegreper, levetid og sletting |
| Samarbeid og kompetanse | 003–007, 009, 013–015, 017–019, 024, 027, 039 | Samspillsmodell, flernivåkunnskap, prøverom og selektiv deling |
| Felles arkitektur og AI | 012, 021, 023, 031, 041 | Kontrollert bibliotekpromotering; senere valgt provider og egen policy/evaluering for fri generering |
| Støtteformål og kontroll | 008, 016, 036, 043, 044, 046 | Formålsstyrt støtte, relevante comparatorer, mandat og gradert eskalering |
| Tilpasset opplevelse | 025, 032, 034, 035, 037, 038, 040, 045 | Progresjon, narrativ, voksenbruk, tilpasset feedback og informasjonsdybde |
| Psykologisk støtte | 011 | Reviewet grunnlag og tydelig klinisk grense |
| Multimodalitet og forfatterskap | 028, 048 | Tale/OCR/tekst med rådataregler og atskilt bruker-/AI-bidrag |
| Språk | 050 | Felles semantisk authoringmodell med språkbevisst review og eksportmigrasjon |

Prioriter først bibliotekets promotering/tilbakekalling og det felles forfatterskjemaet, deretter en sammenhengende brukerreise. Personlig minne og providerkobling skal bygges mot konkrete formål og beslutninger, ikke generelle boolske «godkjent»-felter.

## Verifikasjon og leveringsgrense

Denne seksjonen dokumenterer den første kanonintegrasjonen. Nyere resultater fra øvelsesrommet står i [nåstatus](CURRENT_STATUS.md) og [øvelsesrapporten](SKYNJA_EXERCISE_ROOM_2026-09-23.md).

Faktisk kjørt ved første integrasjon: kanonintegritet, fem kanontester, 320 kompilerte tester, ti PWA-kontrakttester, installérbart bygg, lint, arkitektur, secretskann, rekonstruksjon og provider-/checksumkontroller består. De 13 nye kunnskapstestene dekker blant annet kildegrense, scope, språk, motfunn, tilbakekalling, mutasjon og umiddelbar stopp selv når velgeren aldri svarer.

`npm run check` stopper i den eksisterende `staging:validate:compiled`-porten med `PINNED_GIT_WINDOWS_RUNTIME_REQUIRED` på Linux. Porten er beholdt; dette er ikke en bestått releasekontroll. Se [nåstatus](CURRENT_STATUS.md) for den samlede kontrolloversikten. WP13.12B-kontrollsummene er regenerert for endringene i `package.json` og `.gitattributes`; ingen eierbeslutning, review eller receipt er oppgradert.

Ved første kanonintegrasjon var offline-feilen i `test:authoring-browser` fortsatt et åpent funn fra innholdsleveransen. Cacheversjonen er oppdatert slik at de reviderte innholdstekstene kan hentes ved appoppdatering; dette lukker ikke offline-funnet. Koden og rapporten leveres lokalt; GitHub-opplasting fra forrige leveranse står fortsatt uten fullført godkjenning. Ingen merge, deployment, ekte-data-bruk eller pilotåpning inngår.
