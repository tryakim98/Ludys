import {
  AUDIO_PIPELINE_STATUS,
  AUTHORING_LOCALES,
  AUTHORING_PIPELINE_STATUS,
  AUTHORING_DRAFT_SCHEMA_VERSION,
  sha256Hex,
  type AuthoringAudioSpecification,
  type AuthoringLearningDimension,
  type AuthoringLocaleCopy,
  type AuthoringPackage,
  type LearningDimensionName,
  type PendingPatternReview,
} from "../../core/authoring-pipeline.js";
import type { Locale } from "../../core/content-contracts.js";
import type { DraftTransferClassification } from "../../core/draft-learning-corpus.js";

// Authoring-only proposals. Never add these directly to the learner corpus.
export const contentExpansionPatternReview: PendingPatternReview = {
  patternClassId: "NOR-PC-TWO-SYLLABLE-SINGLE-MEDIAL-001",
  humanReviewed: false,
  ageBand: "6-9",
  dictionarySources: [
    "https://ordbokene.no/bm,nn/m%C3%A5ne",
    "https://ordbokene.no/bm,nn/s%C3%A5pe",
    "https://ordbokene.no/bm,nn/kake",
    "https://ordbokene.no/bm,nn/bake",
  ],
  locales: {
    "nb-NO": {
      locale: "nb-NO",
      title: "Tostavelsesord med enkel konsonant mellom vokalene – utkast",
      norwegianGraphemePhonemeSuitability: "Norsk utkast med måne, såpe, kake og bake. Klassen er en avgrenset ortografisk arbeidshypotese, ikke importert engelsk CVC eller en godkjent fonologisk regel.",
      writtenStandard: "Bokmål. Måne, såpe og kake brukes som substantiv; bake brukes som verb i infinitiv.",
      pronunciationAndDialectLimits: "Tostavelsesanalysen forutsetter en uttale med sluttvokal. Apokope, kvaliteten på trykksvak e, vokallengde og tonegang må avklares med fagperson og den faktiske voksne. Dialektforskjeller skal ikke registreres som feil.",
      vowelLength: "Lang trykksterk vokal er en foreløpig beskrivelse av de valgte ordene i mange uttaler. Ingen tidsgrense, vokalscore eller generell regel om enkeltkonsonant innføres.",
      consonantDoubling: "Ingen av de fire stimuliene har dobbel konsonant. Aktivitetene undersøker ikke kontrasten mellom enkel og dobbel konsonant.",
      orthographicComplexity: "Fire bokstaver i hvert ord. Å må være tilgjengelig som egen brikke. Kake har to k-brikker med ulike brikke-ID-er. Skriftbildet må ikke presenteres som en fonetisk transkripsjon.",
      morphologicalComplexity: "Kake–bake skifter fra substantiv til verb. Ordene er ikke bøyningsformer av hverandre. Oppgaven undersøker ikke grammatikk eller morfologisk forståelse.",
      investigates: "Synlig bygging etter skriftmodell og et separat forsøk på et nytt ord. Muntlig lesing kan bare observeres av den voksne; systemet har ikke hørt barnet.",
      cannotProve: "Kan ikke bevise selvstendig staving, uavhengig avkoding, flyt, forståelse, generalisert læring, nivå eller effekt. Kopiering etter modell må ikke omtales som selvstendig innkoding.",
      stimulusRationale: "Måne–såpe beholder å og e, men bytter begge konsonantene: større metodeoverføring. Kake–bake endrer første bokstav og er bare en hypotese om nær overføring; rim og ordkunnskap kan hjelpe.",
      openReviewerQuestions: [
        "Passer ordvalg, betydningsstøtte og kravet om to stavelser for de tiltenkte barna og dialektene?",
        "Er skillet mellom kopiering, lesing og selvstendig innkoding tydelig nok?",
        "Bør kake–bake beholde klassifiseringen nær overføring når ordklasse og betydning endres?",
        "Hvilken støtte skal registreres når den voksne peker, deler ordet eller sier det høyt?",
      ],
    },
    "nn-NO": {
      locale: "nn-NO",
      title: "Tostavingsord med enkel konsonant mellom vokalane – utkast",
      norwegianGraphemePhonemeSuitability: "Norsk utkast med måne, såpe, kake og bake. Klassen er ein avgrensa ortografisk arbeidshypotese, ikkje importert engelsk CVC eller ein godkjend fonologisk regel.",
      writtenStandard: "Nynorsk med e-infinitiv i denne pakken. Måne, såpe og kake er substantiv; bake er verb i infinitiv. Baka er òg ei normert form, men skal ikkje bytast inn automatisk.",
      pronunciationAndDialectLimits: "Tostavingsanalysen føreset uttale med sluttvokal. Apokope, kvaliteten på trykklett e, vokallengd og tonelag må avklarast med fagperson og den faktiske vaksne. Dialektskilnader skal ikkje registrerast som feil.",
      vowelLength: "Lang trykksterk vokal er ei førebels skildring av dei valde orda i mange uttalar. Ingen tidsgrense, vokalskår eller generell regel om enkeltkonsonant blir innført.",
      consonantDoubling: "Ingen av dei fire stimuliane har dobbel konsonant. Aktivitetane undersøker ikkje skiljet mellom enkel og dobbel konsonant.",
      orthographicComplexity: "Fire bokstavar i kvart ord. Å må vere tilgjengeleg som eiga brikke. Kake har to k-brikker med ulike brikke-ID-ar. Skriftbiletet må ikkje presenterast som ein fonetisk transkripsjon.",
      morphologicalComplexity: "Kake–bake skifter frå substantiv til verb. Orda er ikkje bøyingsformer av kvarandre. Oppgåva undersøker ikkje grammatikk eller morfologisk forståing.",
      investigates: "Synleg bygging etter skriftmodell og eit eige forsøk på eit nytt ord. Munnleg lesing kan berre observerast av den vaksne; systemet har ikkje høyrt barnet.",
      cannotProve: "Kan ikkje bevise sjølvstendig staving, uavhengig avkoding, flyt, forståing, generalisert læring, nivå eller effekt. Kopiering etter modell må ikkje omtalast som sjølvstendig innkoding.",
      stimulusRationale: "Måne–såpe held på å og e, men byter begge konsonantane: større metodeoverføring. Kake–bake endrar første bokstav og er berre ein hypotese om nær overføring; rim og ordkunnskap kan hjelpe.",
      openReviewerQuestions: [
        "Passar ordval, tydingsstøtte og kravet om to stavingar for dei tiltenkte barna og dialektane?",
        "Er skiljet mellom kopiering, lesing og sjølvstendig innkoding tydeleg nok?",
        "Bør kake–bake halde på klassifiseringa nær overføring når ordklasse og tyding blir endra?",
        "Kva støtte skal registrerast når den vaksne peikar, deler ordet eller seier det høgt?",
      ],
    },
  },
};

interface LocaleDraft {
  readonly title: string;
  readonly instruction: string;
  readonly meaningPrompt: string;
  readonly transferPrompt: string;
  readonly adultCard: AuthoringLocaleCopy["adultCard"];
  readonly knowledgeTitle: string;
  readonly knowledgeExplanation: string;
  readonly contextText: string;
  readonly adultAudio: string;
}

interface ContentSeed {
  readonly activityId: string;
  readonly target: string;
  readonly transfer: string;
  readonly transferClassification: DraftTransferClassification;
  readonly locales: Readonly<Record<Locale, LocaleDraft>>;
}

const seeds: readonly ContentSeed[] = [
  {
    activityId: "activity-nor-two-syllable-maane-saape-001",
    target: "måne",
    transfer: "såpe",
    transferClassification: "METHOD_TRANSFER_WITH_LARGER_CHANGE",
    locales: {
      "nb-NO": {
        title: "Måne og såpe – utkast",
        instruction: "Se på måne. Bygg det samme ordet med bokstavbrikkene. Les ordet for den voksne når du er klar. Du kan be om hjelp, ta pause eller stoppe.",
        meaningPrompt: "En måne kan være synlig på himmelen. Her bruker vi ordet om månen ved jorda.",
        transferPrompt: "Her er et nytt ord: såpe. Bygg ordet, og prøv å lese det for den voksne. Du kan be om hjelp.",
        adultCard: {
          understand: "Barnet bygger etter en synlig skriftmodell. Det viser hva barnet gjør her, og er ikke bevis på selvstendig staving. Muntlig lesing vurderes ikke av appen.",
          doOrSay: "Spør om barnet vil prøve selv eller ha hjelp. Vent når barnet ønsker det. Tilby pekestøtte eller opplest modell etter behov, og noter hvilken støtte som ble brukt.",
          avoid: "Ikke si at barnet har lest fordi brikkene ligger riktig. Ikke bruk tid, dialekt eller et enkelt forsøk til å forklare barnets evner.",
          deepen: "Måne og såpe har ulike konsonanter. Det nye ordet prøver framgangsmåten med større endring. Opplesing av såpe er modellstøtte og kan være riktig hjelp. Hvis dere vil undersøke et forsøk uten opplesing, avklar det formålet først og registrer betingelsene.",
          waitAllowed: true,
          adultAuthority: true,
        },
        knowledgeTitle: "Når skriftmodellen hjelper",
        knowledgeExplanation: "Et ferdig ord på skjermen gir støtte til rekkefølgen. Å legge like bokstaver under modellen kan gjennomføres uten å lese ordet. Beskriv derfor den konkrete handlingen: barnet la bokstavene i rekkefølge etter modellen. Dersom barnet leser høyt, er det den voksne som hører forsøket; appen kan ikke bekrefte uttalen. Måne er måloppgaven, og såpe kommer som et eget forsøk etterpå. Begge konsonantene skifter, så dette er et forslag til metodeoverføring med større endring. Hvis den voksne sier ordet, er forsøket modellstøttet. Støttet gjennomføring kan vise hvordan barnet bruker hjelp i denne oppgaven; det gjør ikke forsøket til uavhengig lesing. Mindre støtte er ikke et mål i seg selv. Venting trenger ingen begrunnelse. Pause eller stopp avslutter støtteforslaget. Ordvalg og språkfaglig egnethet krever menneskelig review.",
        contextText: "Hvis barnet ber om hjelp: pek på neste bokstav i måne. Vent deretter på barnets valg. Avslutt kortet ved pause eller stopp.",
        adultAudio: "Avklar om barnet vil prøve selv eller ha hjelp. Du kan vente, peke eller lese ordet etter behov. Noter støtten. Riktige brikker bekrefter ikke at barnet har lest selvstendig.",
      },
      "nn-NO": {
        title: "Måne og såpe – utkast",
        instruction: "Sjå på måne. Bygg det same ordet med bokstavbrikkene. Les ordet for den vaksne når du er klar. Du kan be om hjelp, ta pause eller stoppe.",
        meaningPrompt: "Ein måne kan vere synleg på himmelen. Her bruker vi ordet om månen ved jorda.",
        transferPrompt: "Her er eit nytt ord: såpe. Bygg ordet, og prøv å lese det for den vaksne. Du kan be om hjelp.",
        adultCard: {
          understand: "Barnet byggjer etter ein synleg skriftmodell. Det viser kva barnet gjer her, og er ikkje bevis på sjølvstendig staving. Munnleg lesing blir ikkje vurdert av appen.",
          doOrSay: "Spør om barnet vil prøve sjølv eller ha hjelp. Vent når barnet ønskjer det. Tilby peikestøtte eller opplesen modell etter behov, og noter kva støtte som vart brukt.",
          avoid: "Ikkje sei at barnet har lese fordi brikkene ligg rett. Ikkje bruk tid, dialekt eller eitt forsøk til å forklare evnene til barnet.",
          deepen: "Måne og såpe har ulike konsonantar. Det nye ordet prøver framgangsmåten med større endring. Opplesing av såpe er modellstøtte og kan vere rett hjelp. Dersom de vil undersøkje eit forsøk utan opplesing, avklar det formålet først og registrer vilkåra.",
          waitAllowed: true,
          adultAuthority: true,
        },
        knowledgeTitle: "Når skriftmodellen hjelper",
        knowledgeExplanation: "Eit ferdig ord på skjermen gir støtte til rekkjefølgja. Å leggje like bokstavar under modellen kan gjennomførast utan å lese ordet. Skildre derfor den konkrete handlinga: barnet la bokstavane i rekkjefølgje etter modellen. Dersom barnet les høgt, er det den vaksne som høyrer forsøket; appen kan ikkje stadfeste uttalen. Måne er måloppgåva, og såpe kjem som eit eige forsøk etterpå. Begge konsonantane skifter, så dette er eit forslag til metodeoverføring med større endring. Dersom den vaksne seier ordet, er forsøket modellstøtta. Støtta gjennomføring kan vise korleis barnet bruker hjelp i denne oppgåva; det gjer ikkje forsøket til uavhengig lesing. Mindre støtte er ikkje eit mål i seg sjølv. Venting treng inga grunngiving. Pause eller stopp avsluttar støtteforslaget. Ordval og språkfagleg eignaheit krev menneskeleg review.",
        contextText: "Dersom barnet ber om hjelp: peik på neste bokstav i måne. Vent deretter på valet til barnet. Avslutt kortet ved pause eller stopp.",
        adultAudio: "Avklar om barnet vil prøve sjølv eller ha hjelp. Du kan vente, peike eller lese ordet etter behov. Noter støtta. Rette brikker stadfestar ikkje at barnet har lese sjølvstendig.",
      },
    },
  },
  {
    activityId: "activity-nor-two-syllable-kake-bake-002",
    target: "kake",
    transfer: "bake",
    transferClassification: "NEAR_TRANSFER",
    locales: {
      "nb-NO": {
        title: "Kake og bake – utkast",
        instruction: "Se på kake. Bygg det samme ordet med bokstavbrikkene. Du trenger begge k-brikkene. Les ordet for den voksne når du er klar. Du kan be om hjelp, ta pause eller stoppe.",
        meaningPrompt: "Her er kake noe vi kan spise. Ordet har to k-er på ulike steder.",
        transferPrompt: "Prøv et nytt ord: bake. Bygg ordet, og prøv å lese det for den voksne. Du kan be om hjelp.",
        adultCard: {
          understand: "Kake har to like bokstaver på ulike steder. Å finne begge er en konkret byggehandling. Det nye ordet bake har en annen førstebokstav, men samme skrevne slutt.",
          doOrSay: "Avklar om barnet vil prøve selv, få pekestøtte eller høre ordet. Velg hjelp etter ønsket og formålet, og noter støtten. La barnet ta pause eller stoppe.",
          avoid: "Ikke presenter et opplest bake som et forsøk uten modellstøtte, og ikke tolk et raskt svar som sikker avkoding. Ikke kall bake en bøyning av kake.",
          deepen: "Nær overføring er her en foreløpig hypotese om skriftmønsteret. Barnet kan ha nytte av rim eller kjennskap til uttrykket bake kake. Hold dette atskilt fra bevis på selvstendig lesing.",
          waitAllowed: true,
          adultAuthority: true,
        },
        knowledgeTitle: "Et nytt første tegn gir et nytt ord",
        knowledgeExplanation: "Kake og bake deler den skrevne slutten ake. Endringen er liten i skrift, men ordene har ulik betydning og brukes her som ulike ordklasser. Kake er noe vi kan spise; bake er noe vi kan gjøre. Dette er ingen grammatikkprøve, og barnet skal ikke forklare ordklassene. Forslaget undersøker bygging etter skriftmodell og et eget forsøk på et nytt ord. Rim og kjente uttrykk kan gjøre ordet lettere å gjette. Derfor er ikke riktige brikker eller et raskt svar i seg selv bevis på lesing. Pekestøtte, oppdeling og opplest modell må skilles fra et forsøk uten slik voksenhjelp. Den synlige modellen er fortsatt støtte. Støttet gjennomføring kan gi en konkret observasjon av hva barnet får til med hjelp. Et forsøk uten opplesing er relevant når formålet er å undersøke akkurat den betingelsen, ikke som et universelt sluttmål. Fagreview må avgjøre om paret egner seg som nær overføring.",
        contextText: "Hvis barnet ønsker støtte med en av k-ene: pek på den aktuelle plassen i kake. La barnet velge brikke. Avslutt kortet ved pause eller stopp.",
        adultAudio: "Avklar ønsket hjelp. Kake har to k-er. Du kan peke på den aktuelle plassen eller lese ordet som modell. Støttet gjennomføring har verdi; noter hjelpen og hva barnet gjorde.",
      },
      "nn-NO": {
        title: "Kake og bake – utkast",
        instruction: "Sjå på kake. Bygg det same ordet med bokstavbrikkene. Du treng begge k-brikkene. Les ordet for den vaksne når du er klar. Du kan be om hjelp, ta pause eller stoppe.",
        meaningPrompt: "Her er kake noko vi kan ete. Ordet har to k-ar på ulike stader.",
        transferPrompt: "Prøv eit nytt ord: bake. Bygg ordet, og prøv å lese det for den vaksne. Du kan be om hjelp.",
        adultCard: {
          understand: "Kake har to like bokstavar på ulike stader. Å finne begge er ei konkret byggjehandling. Det nye ordet bake har ein annan førstebokstav, men same skrivne slutt.",
          doOrSay: "Avklar om barnet vil prøve sjølv, få peikestøtte eller høyre ordet. Vel hjelp etter ønsket og formålet, og noter støtta. La barnet ta pause eller stoppe.",
          avoid: "Ikkje presenter eit opplese bake som eit forsøk utan modellstøtte, og ikkje tolk eit raskt svar som sikker avkoding. Ikkje kall bake ei bøying av kake.",
          deepen: "Nær overføring er her ein førebels hypotese om skriftmønsteret. Barnet kan ha nytte av rim eller kjennskap til uttrykket bake kake. Hald dette skilt frå bevis på sjølvstendig lesing. Denne pakken bruker e-infinitiv.",
          waitAllowed: true,
          adultAuthority: true,
        },
        knowledgeTitle: "Eit nytt første teikn gir eit nytt ord",
        knowledgeExplanation: "Kake og bake deler den skrivne slutten ake. Endringa er lita i skrift, men orda har ulik tyding og blir her brukte som ulike ordklassar. Kake er noko vi kan ete; bake er noko vi kan gjere. Dette er inga grammatikkprøve, og barnet skal ikkje forklare ordklassane. Forslaget undersøker bygging etter skriftmodell og eit eige forsøk på eit nytt ord. Rim og kjende uttrykk kan gjere ordet lettare å gjette. Derfor er ikkje rette brikker eller eit raskt svar i seg sjølv bevis på lesing. Peikestøtte, oppdeling og opplesen modell må skiljast frå eit forsøk utan slik vaksenhjelp. Den synlege modellen er framleis støtte. Støtta gjennomføring kan gi ei konkret observasjon av kva barnet får til med hjelp. Eit forsøk utan opplesing er relevant når formålet er å undersøkje akkurat det vilkåret, ikkje som eit universelt sluttmål. Fagreview må avgjere om paret eignar seg som nær overføring. E-infinitiven bake er vald med vilje; inga automatisk omsetjing til baka skjer.",
        contextText: "Dersom barnet ønskjer støtte med ein av k-ane: peik på den aktuelle plassen i kake. La barnet velje brikke. Avslutt kortet ved pause eller stopp.",
        adultAudio: "Avklar ønskt hjelp. Kake har to k-ar. Du kan peike på den aktuelle plassen eller lese ordet som modell. Støtta gjennomføring har verdi; noter hjelpa og kva barnet gjorde.",
      },
    },
  },
];

const dimensions: readonly LearningDimensionName[] = [
  "PHONOLOGICAL_AWARENESS", "GRAPHEME_PHONEME_MAPPING", "DECODING_ACCURACY",
  "ORTHOGRAPHIC_LEARNING", "SPELLING_ENCODING", "READING_FLUENCY", "MORPHOLOGY",
  "READING_COMPREHENSION", "WRITTEN_EXPRESSION", "ASSISTIVE_ACCESS",
];

function learningDimensions(): readonly AuthoringLearningDimension[] {
  return dimensions.map((dimension) => {
    const spelling = dimension === "SPELLING_ENCODING";
    const relevant = ["GRAPHEME_PHONEME_MAPPING", "DECODING_ACCURACY", "ORTHOGRAPHIC_LEARNING", "ASSISTIVE_ACCESS"].includes(dimension);
    return {
      dimension,
      emphasis: relevant ? "SECONDARY" : "NOT_TARGETED",
      professionalRationale: spelling
        ? "Bygging etter synlig modell er ikke selvstendig staving. Ingen innkodingsprestasjon utledes."
        : relevant
          ? "Dimensjonen kan være relevant for denne bygge- og lesesituasjonen; sammenhengen er et utkast for fagreview."
          : "Denne dimensjonen undersøkes ikke av det avgrensede forslaget.",
      observableTaskRequirement: relevant
        ? "Observer bare plassering av brikker og voksenvalgt støtte. Muntlig lesing kan høres av den voksne, ikke registreres automatisk."
        : "Ingen prestasjon eller samlet vurdering skal beregnes for denne dimensjonen.",
      notDiagnostic: true,
    };
  });
}

function audioIds(seed: ContentSeed, locale: Locale): readonly [string, string, string] {
  const stem = `audio-${seed.activityId}-${locale === "nb-NO" ? "nb" : "nn"}`;
  return [`${stem}-target`, `${stem}-transfer`, `${stem}-adult-knowledge`];
}

function localeCopy(seed: ContentSeed, locale: Locale): AuthoringLocaleCopy {
  const copy = seed.locales[locale];
  const knowledgeId = `knowledge-${seed.activityId}`;
  return {
    locale, activityId: seed.activityId, title: copy.title,
    targetWord: seed.target, transferWord: seed.transfer,
    instruction: copy.instruction, meaningPrompt: copy.meaningPrompt, transferPrompt: copy.transferPrompt,
    adultCard: copy.adultCard,
    knowledgeUnit: { knowledgeId, title: copy.knowledgeTitle, explanation: copy.knowledgeExplanation },
    contextCard: { contextCardId: `context-${seed.activityId}`, knowledgeId, activityId: seed.activityId, text: copy.contextText },
    audioScriptIds: audioIds(seed, locale),
  };
}

function audioSpecifications(seed: ContentSeed): readonly AuthoringAudioSpecification[] {
  return AUTHORING_LOCALES.flatMap((locale) => {
    // Model clips contain only the word. Instructions and knowledge never leak into model assets.
    const scripts = [`${seed.target}.`, `${seed.transfer}.`, seed.locales[locale].adultAudio];
    return audioIds(seed, locale).map((semanticAudioId, index) => {
      const script = scripts[index]!;
      return {
        semanticAudioId, locale,
        scriptFamily: index === 0 ? "TARGET_MODEL" : index === 1 ? "TRANSFER_MODEL" : "ADULT_KNOWLEDGE",
        script, scriptRevision: index === 2 ? 2 : 1, takeRevision: 0, fileNameStem: semanticAudioId,
        container: "WAV", encoding: "PCM", channels: 1, sampleRate: 48000, bitDepth: 24,
        durationSeconds: null, peakDbfs: null, leadingSilenceMs: null, trailingSilenceMs: null,
        assetSha256: null, scriptSha256: sha256Hex(script),
        rightsScope: "DRAFT_SPEC_NOT_RECORDED", voiceConsentStatus: "NOT_RECORDED",
        pronunciationReview: "NOT_REVIEWED", naturalnessReview: "NOT_REVIEWED", constructIntegrityReview: "NOT_REVIEWED",
        lifecycle: "CURRENT", stale: false, activeTakeId: null, replacementId: null,
        voiceSourcePolicy: "HUMAN_REQUIRED", userInitiated: true, autoplay: false,
        stopBehavior: "STOP_IMMEDIATELY", textAlternative: true, silenceAlternative: true, runtimeMicrophone: false,
        specificationHumanReviewed: false, specificationReviewSource: null,
      };
    });
  });
}

function packageFromSeed(seed: ContentSeed): AuthoringPackage {
  const nb = localeCopy(seed, "nb-NO");
  const nn = localeCopy(seed, "nn-NO");
  return {
    schemaVersion: AUTHORING_DRAFT_SCHEMA_VERSION,
    packageId: `authoring-package-${seed.activityId}`, packageRevision: 2,
    sourceCorpusId: "CONTENT_EXPANSION_DRAFT_2026-09-22", sourceActivityId: seed.activityId,
    activityId: seed.activityId, patternClassId: contentExpansionPatternReview.patternClassId,
    construct: "BUILD_BLEND_ENCODE",
    stimulus: { target: { role: "TARGET", text: seed.target }, transfer: { role: "TRANSFER", text: seed.transfer }, transferClassification: seed.transferClassification },
    support: { maximumSupport: "MODEL_REQUIRES_ADULT", supportProvenanceRequired: true, adultDecisionRequired: true, sessionBound: true },
    learningDimensions: learningDimensions(), locales: { "nb-NO": nb, "nn-NO": nn },
    audioSpecifications: audioSpecifications(seed), audioTakes: [],
    provenance: { source: "AI_ASSISTED_CONTENT_DRAFT", sourceRevision: 2, clonedFromPackageId: null, localMachinePathIncluded: false, personDataIncluded: false, runtimeAiUsed: false },
    pendingPatternReview: contentExpansionPatternReview,
    localReviewNotes: [], externalReceipts: [], reviewStatus: "DRAFT", lifecycle: "CURRENT", stale: false,
    supersedesPackageId: null, supersededByPackageId: null, withdrawnAt: null,
    pipelineStatus: AUTHORING_PIPELINE_STATUS, audioPipelineStatus: AUDIO_PIPELINE_STATUS,
    evidenceStatus: "SYNTHETIC_ONLY", externalReviewRequirement: "EXTERNAL_REVIEW_REQUIRED",
    betaStatus: "NOT_STUDENT_BETA", publishingStatus: "PUBLISHING_BLOCKED",
    nullAuthorizations: { publish: false, studentBeta: false, b8Decision: false, realData: false, runtimeAi: false, authentication: false, database: false, provider: false, massRecording: false },
    childPreview: {
      "nb-NO": { locale: "nb-NO", title: nb.title, instruction: nb.instruction, targetWord: nb.targetWord, transferWord: nb.transferWord, dataClassification: "SYNTHETIC_ONLY", diagnosticClaim: false },
      "nn-NO": { locale: "nn-NO", title: nn.title, instruction: nn.instruction, targetWord: nn.targetWord, transferWord: nn.transferWord, dataClassification: "SYNTHETIC_ONLY", diagnosticClaim: false },
    },
    adultPreview: {
      "nb-NO": { locale: "nb-NO", title: nb.title, adultCard: nb.adultCard, knowledgeTitle: nb.knowledgeUnit.title, contextText: nb.contextCard.text, externalReceiptCount: 0, publishingBlocked: true },
      "nn-NO": { locale: "nn-NO", title: nn.title, adultCard: nn.adultCard, knowledgeTitle: nn.knowledgeUnit.title, contextText: nn.contextCard.text, externalReceiptCount: 0, publishingBlocked: true },
    },
  };
}

export const contentExpansionDraftPackages: readonly AuthoringPackage[] = seeds.map(packageFromSeed);
