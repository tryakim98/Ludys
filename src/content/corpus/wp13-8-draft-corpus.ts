import type { AudioSpecification, Locale } from "../../core/content-contracts.js";
import type {
  DraftActivity,
  DraftActivityVariant,
  DraftConstruct,
  DraftContextCardVariant,
  DraftKnowledgeVariant,
  DraftLearningCorpusRelease,
  DraftPatternClass,
  DraftTransferClassification,
  InternalReviewDecision,
} from "../../core/draft-learning-corpus.js";

const REVIEW_SOURCE = "WP13.8_SCOPE_2026-07-22" as const;
const LOCALES = ["nb-NO", "nn-NO"] as const;

interface ActivityLocaleCopy {
  readonly title: string;
  readonly childSteps: readonly string[];
  readonly feedback: DraftActivityVariant["feedbackByState"];
  readonly adult: {
    readonly understand: string;
    readonly doOrSay: string;
    readonly avoid: string;
    readonly deepen: string;
    readonly expiresWhen: string;
  };
  readonly knowledgeTitle: string;
  readonly knowledgeExplanation: string;
  readonly knowledgeAction: string;
  readonly knowledgeAvoid: string;
  readonly knowledgeDeepen: string;
  readonly stopConditions: string;
  readonly contextAction: string;
  readonly reviewQuestions: readonly string[];
}

interface ActivitySeed {
  readonly activityId: string;
  readonly patternClassId: string;
  readonly internalReviewDecision: InternalReviewDecision;
  readonly construct: DraftConstruct;
  readonly target: string;
  readonly transfer: string;
  readonly transferClassification: DraftTransferClassification;
  readonly locales: Readonly<Record<Locale, ActivityLocaleCopy>>;
}

function copy(
  title: string,
  target: string,
  transfer: string,
  knowledgeFocus: string,
  reviewQuestions: readonly string[],
  locale: Locale,
): ActivityLocaleCopy {
  const nn = locale === "nn-NO";
  return {
    title,
    childSteps: nn
      ? [
          `Sjå på ordet ${target}.`,
          "Vel grafema i den viste rekkjefølgja.",
          "Les ordet for den vaksne når du er klar.",
          `Prøv så det nye ordet ${transfer}.`,
        ]
      : [
          `Se på ordet ${target}.`,
          "Velg grafemene i den viste rekkefølgen.",
          "Les ordet for den voksne når du er klar.",
          `Prøv så det nye ordet ${transfer}.`,
        ],
    feedback: nn
      ? {
          targetReady: `Bygg ${target} med grafema som er viste.`,
          targetCompleted: `Du bygde og las ${target} i denne økta.`,
          supportedAttempt: "Dette forsøket kom etter synleg støtte frå ein vaksen.",
          transferReady: `No kan du prøve ${transfer} som ei eiga transferoppgåve.`,
          transferCompleted: `Du bygde og las transferordet ${transfer} i denne økta.`,
          stopped: "Aktiviteten er stoppa. Ingen ventande tilbakemelding blir vist.",
        }
      : {
          targetReady: `Bygg ${target} med grafemene som vises.`,
          targetCompleted: `Du bygde og leste ${target} i denne økten.`,
          supportedAttempt: "Dette forsøket kom etter synlig støtte fra en voksen.",
          transferReady: `Nå kan du prøve ${transfer} som en egen transferoppgave.`,
          transferCompleted: `Du bygde og leste transferordet ${transfer} i denne økten.`,
          stopped: "Aktiviteten er stoppet. Ingen ventende tilbakemelding vises.",
        },
    adult: nn
      ? {
          understand: `Aktiviteten undersøker berre den konkrete handlinga frå ${target} til ${transfer}.`,
          doOrSay: "Vent først. Peik på eitt grafem eller modeller ordet berre dersom du vel det.",
          avoid: "Ikkje forklar tempo, uttale eller feil som eigenskapar ved barnet.",
          deepen: knowledgeFocus,
          expiresWhen: "Kortet går ut når måloppgåva, transferoppgåva, pause eller STOPP er registrert.",
        }
      : {
          understand: `Aktiviteten undersøker bare den konkrete handlingen fra ${target} til ${transfer}.`,
          doOrSay: "Vent først. Pek på ett grafem eller modeller ordet bare dersom du velger det.",
          avoid: "Ikke forklar tempo, uttale eller feil som egenskaper ved barnet.",
          deepen: knowledgeFocus,
          expiresWhen: "Kortet utløper når måloppgaven, transferoppgaven, pause eller STOPP registreres.",
        },
    knowledgeTitle: nn ? `Utkast: støtte for ${target} og ${transfer}` : `Utkast: støtte for ${target} og ${transfer}`,
    knowledgeExplanation: nn
      ? `Dette er eit urevidert kunnskapsutkast om ${knowledgeFocus.toLocaleLowerCase("nn-NO")}`
      : `Dette er et urevidert kunnskapsutkast om ${knowledgeFocus.toLocaleLowerCase("nb-NO")}`,
    knowledgeAction: nn
      ? "Bruk WAIT først, og vel deretter høgst éi konkret støttehandling."
      : "Bruk WAIT først, og velg deretter høyst én konkret støttehandling.",
    knowledgeAvoid: nn
      ? "Ikkje bruk tempo eller eitt forsøk som forklaring eller plassering."
      : "Ikke bruk tempo eller ett forsøk som forklaring eller plassering.",
    knowledgeDeepen: knowledgeFocus,
    stopConditions: nn
      ? "Stopp ved barnet sitt STOPP, den vaksne sitt STOPP eller når kortet ikkje passar."
      : "Stopp ved barnets STOPP, den voksnes STOPP eller når kortet ikke passer.",
    contextAction: nn
      ? "Vent, eller peik på eitt grafem dersom den vaksne vel støtte."
      : "Vent, eller pek på ett grafem dersom den voksne velger støtte.",
    reviewQuestions,
  };
}

const activitySeeds: readonly ActivitySeed[] = [
  {
    activityId: "activity-nor-single-final-ris-sil-001",
    patternClassId: "NOR-PC-SINGLE-FINAL-001",
    internalReviewDecision: "KEEP_WITH_CHANGES",
    construct: "BUILD_BLEND_ENCODE",
    target: "ris",
    transfer: "sil",
    transferClassification: "NEAR_TRANSFER",
    locales: {
      "nb-NO": copy("Ris til sil", "ris", "sil", "enkel sluttkonsonant og avgrenset nær transfer.", ["Er vokalkvalitet og ordvalg egnet på tvers av relevante bokmålsnære uttaler?"], "nb-NO"),
      "nn-NO": copy("Ris til sil", "ris", "sil", "enkel sluttkonsonant og avgrensa nær transfer.", ["Er vokalkvalitet og ordval eigna på tvers av relevante nynorsknære uttalar?"], "nn-NO"),
    },
  },
  {
    activityId: "activity-nor-single-final-fin-bil-002",
    patternClassId: "NOR-PC-SINGLE-FINAL-001",
    internalReviewDecision: "KEEP_AS_DRAFT_WITH_LIMITS",
    construct: "BUILD_BLEND_ENCODE",
    target: "fin",
    transfer: "bil",
    transferClassification: "METHOD_TRANSFER_WITH_LARGER_CHANGE",
    locales: {
      "nb-NO": copy("Fin til bil", "fin", "bil", "bruk av framgangsmåte med større transferendring, ikke et identisk grafemmønster.", ["Hvordan skal større endring i start og slutt avgrenses språkfaglig?"], "nb-NO"),
      "nn-NO": copy("Fin til bil", "fin", "bil", "bruk av framgangsmåte med større transferendring, ikkje eit identisk grafemmønster.", ["Korleis skal større endring i start og slutt avgrensast språkfagleg?"], "nn-NO"),
    },
  },
  {
    activityId: "activity-nor-double-final-katt-hatt-001",
    patternClassId: "NOR-PC-DOUBLE-FINAL-001",
    internalReviewDecision: "KEEP_WITH_CHANGES",
    construct: "DECODE_REPAIR_TRANSFER",
    target: "katt",
    transfer: "hatt",
    transferClassification: "NEAR_TRANSFER",
    locales: {
      "nb-NO": copy("Katt til hatt", "katt", "hatt", "dobbel sluttkonsonant som norsk ortografisk markør, med åpent spørsmål om vokallengde.", ["Hvordan skal modelllyd håndtere variasjon i vokallengde uten uttalevurdering?"], "nb-NO"),
      "nn-NO": copy("Katt til hatt", "katt", "hatt", "dobbel sluttkonsonant som norsk ortografisk markør, med ope spørsmål om vokallengd.", ["Korleis skal modelllyd handtere variasjon i vokallengd utan uttalevurdering?"], "nn-NO"),
    },
  },
  {
    activityId: "activity-nor-double-final-kopp-hopp-002",
    patternClassId: "NOR-PC-DOUBLE-FINAL-001",
    internalReviewDecision: "KEEP_WITH_CHANGES",
    construct: "DECODE_REPAIR_TRANSFER",
    target: "kopp",
    transfer: "hopp",
    transferClassification: "NEAR_TRANSFER",
    locales: {
      "nb-NO": copy("Kopp til hopp", "kopp", "hopp", "dobbel sluttkonsonant og konkret ordbygging uten uttalescore.", ["Er betydningsstøtten tydelig uten å endre konstruktet?"], "nb-NO"),
      "nn-NO": copy("Kopp til hopp", "kopp", "hopp", "dobbel sluttkonsonant og konkret ordbygging utan uttaleskår.", ["Er tydingsstøtta tydeleg utan å endre konstruktet?"], "nn-NO"),
    },
  },
  {
    activityId: "activity-nor-cluster-pris-gris-001",
    patternClassId: "NOR-PC-CONSONANT-CLUSTER-001",
    internalReviewDecision: "KEEP_WITH_CHANGES",
    construct: "BUILD_BLEND_ENCODE",
    target: "pris",
    transfer: "gris",
    transferClassification: "NEAR_TRANSFER",
    locales: {
      "nb-NO": copy("Pris til gris", "pris", "gris", "initial konsonantforbindelse og norsk ortografisk kompleksitet.", ["Hvilke dialektvarianter må modelllyden eksplisitt avgrense?"], "nb-NO"),
      "nn-NO": copy("Pris til gris", "pris", "gris", "initial konsonantsamband og norsk ortografisk kompleksitet.", ["Kva dialektvariantar må modelllyden eksplisitt avgrense?"], "nn-NO"),
    },
  },
  {
    activityId: "activity-nor-cluster-fisk-vest-002",
    patternClassId: "NOR-PC-CONSONANT-CLUSTER-001",
    internalReviewDecision: "CHANGES_REQUIRED",
    construct: "BUILD_BLEND_ENCODE",
    target: "fisk",
    transfer: "vest",
    transferClassification: "NON_NEAR_TRANSFER_REVIEW_ONLY",
    locales: {
      "nb-NO": copy("Fisk til vest", "fisk", "vest", "ulike finale klynger; paret er ikke ren nær transfer og er bare synlig i reviewmodus.", ["Bør paret supersederes med ny stimulus og eventuelt ny semantisk ID?"], "nb-NO"),
      "nn-NO": copy("Fisk til vest", "fisk", "vest", "ulike finale klynger; paret er ikkje rein nær transfer og er berre synleg i reviewmodus.", ["Bør paret supersederast med ny stimulus og eventuelt ny semantisk ID?"], "nn-NO"),
    },
  },
  {
    activityId: "activity-nor-ng-sang-lang-001",
    patternClassId: "NOR-PC-NG-GRAPHEME-001",
    internalReviewDecision: "KEEP_AS_DRAFT_WITH_LIMITS",
    construct: "DECODE_REPAIR_TRANSFER",
    target: "sang",
    transfer: "lang",
    transferClassification: "NEAR_TRANSFER",
    locales: {
      "nb-NO": copy("Sang til lang", "sang", "lang", "ng-sekvensen som norsk grafem–fonem-utkast med tydelig dialektbegrensning.", ["Hvordan skal ng-sekvensen beskrives uten å overforenkle fonologisk analyse?"], "nb-NO"),
      "nn-NO": copy("Sang til lang", "sang", "lang", "ng-sekvensen som norsk grafem–fonem-utkast med tydeleg dialektavgrensing.", ["Korleis skal ng-sekvensen skildrast utan å forenkle fonologisk analyse for mykje?"], "nn-NO"),
    },
  },
  {
    activityId: "activity-nor-ng-ring-seng-002",
    patternClassId: "NOR-PC-NG-GRAPHEME-001",
    internalReviewDecision: "CHANGES_REQUIRED",
    construct: "DECODE_REPAIR_TRANSFER",
    target: "ring",
    transfer: "seng",
    transferClassification: "NON_NEAR_TRANSFER_REVIEW_ONLY",
    locales: {
      "nb-NO": copy("Ring til seng", "ring", "seng", "samtidig endring av start og vokal; paret er bare tilgjengelig i reviewmodus.", ["Krever endringen ny semantisk ID fremfor revisjon?"], "nb-NO"),
      "nn-NO": copy("Ring til seng", "ring", "seng", "samtidig endring av start og vokal; paret er berre tilgjengeleg i reviewmodus.", ["Krev endringa ny semantisk ID framfor revisjon?"], "nn-NO"),
    },
  },
] as const;

function semanticSuffix(activityId: string): string {
  return activityId.replace(/^activity-nor-/, "").replace(/-00[12]$/, "");
}

function localeSuffix(locale: Locale): "nb" | "nn" {
  return locale === "nb-NO" ? "nb" : "nn";
}

function knowledgeId(seed: ActivitySeed): string {
  return `knowledge-wp13-8-${semanticSuffix(seed.activityId)}`;
}

function contextCardId(seed: ActivitySeed): string {
  return `context-wp13-8-${semanticSuffix(seed.activityId)}`;
}

function audioIds(seed: ActivitySeed, locale: Locale): readonly [string, string, string] {
  const suffix = `${semanticSuffix(seed.activityId)}-${localeSuffix(locale)}`;
  return [
    `audio-wp13-8-target-${suffix}`,
    `audio-wp13-8-transfer-${suffix}`,
    `audio-wp13-8-knowledge-${suffix}`,
  ];
}

function variant(seed: ActivitySeed, locale: Locale): DraftActivityVariant {
  const editorial = seed.locales[locale];
  return {
    activityId: seed.activityId,
    patternClassId: seed.patternClassId,
    revision: 1,
    locale,
    status: "DRAFT",
    reviewStatus: "EXTERNAL_REVIEW_REQUIRED",
    evidenceStatus: "SYNTHETIC_ONLY",
    betaStatus: "NOT_STUDENT_BETA",
    internalReviewDecision: seed.internalReviewDecision,
    construct: seed.construct,
    title: editorial.title,
    targetStimulus: { text: seed.target, role: "TARGET" },
    transferStimulus: { text: seed.transfer, role: "TRANSFER" },
    transferClassification: seed.transferClassification,
    childSteps: editorial.childSteps,
    feedbackByState: editorial.feedback,
    adultCard: {
      cardId: `adult-card-wp13-8-${semanticSuffix(seed.activityId)}-${localeSuffix(locale)}`,
      ...editorial.adult,
      waitAllowed: true,
      adultAuthority: true,
      dismissible: true,
      humanReviewed: true,
      reviewSource: REVIEW_SOURCE,
    },
    contextCardId: contextCardId(seed),
    knowledgeId: knowledgeId(seed),
    audioSpecIds: audioIds(seed, locale),
    supportPlan: ["NONE", "PROMPT", "MODEL_REQUIRES_ADULT"],
    supportProvenanceRequired: true,
    timingInterpretation: "FORBIDDEN",
    pauseAllowed: true,
    stopAllowed: true,
    adultOverrideAllowed: true,
    claimsAllowed: locale === "nb-NO"
      ? ["Konkret handling i denne økten", "Synlig støtteproveniens", "Separat target og transfer"]
      : ["Konkret handling i denne økta", "Synleg støtteproveniens", "Separat måloppgåve og transfer"],
    claimsForbidden: [
      "GENERAL_LEARNING",
      "IDENTITY_PRAISE",
      "MOTIVATION_OR_EMOTION_INFERENCE",
      "DIAGNOSIS",
      "FUTURE_PERFORMANCE",
      "AUTOMATIC_PLACEMENT",
      "TIMING_INTERPRETATION",
    ],
    openReviewQuestions: editorial.reviewQuestions,
    humanReviewed: true,
    reviewSource: REVIEW_SOURCE,
  };
}

const activities: readonly DraftActivity[] = activitySeeds.map((seed) => ({
  activityId: seed.activityId,
  patternClassId: seed.patternClassId,
  revision: 1,
  lifecycleStatus: "CURRENT",
  variants: {
    "nb-NO": variant(seed, "nb-NO"),
    "nn-NO": variant(seed, "nn-NO"),
  },
}));

function patternLocale(
  locale: Locale,
  input: Omit<DraftPatternClass["locales"][Locale], "locale" | "humanReviewed" | "reviewSource">,
): DraftPatternClass["locales"][Locale] {
  return { locale, ...input, humanReviewed: true, reviewSource: REVIEW_SOURCE };
}

const patternClasses: readonly DraftPatternClass[] = [
  {
    patternClassId: "NOR-PC-SINGLE-FINAL-001",
    revision: 1,
    lifecycleStatus: "CURRENT",
    status: "DRAFT",
    reviewStatus: "EXTERNAL_REVIEW_REQUIRED",
    frameworkBoundary: "NORWEGIAN_ORTHOGRAPHIC_REVIEW_NOT_IMPORTED_CVC",
    locales: {
      "nb-NO": patternLocale("nb-NO", {
        title: "Enkel sluttkonsonant",
        norwegianGraphemePhonemeSuitability: "Foreløpig norsk vurdering av korte ord med enkel sluttkonsonant; ikke importert engelsk CVC.",
        writtenStandard: "Bokmål, med egen redaksjonell variant.",
        pronunciationAndDialectLimits: "Ingen automatisk uttale- eller dialektvurdering; regionale vokaler krever ekstern review.",
        vowelLength: "Vokallengde skal beskrives, ikke skåres.",
        consonantDoubling: "Klassen undersøker ikke dobbel konsonant.",
        orthographicComplexity: "Avgrenset, men ordparene er ikke nødvendigvis identiske grafemmønstre.",
        morphologicalComplexity: "Ingen morfologisk generalisering kan trekkes.",
        investigates: "Konkret bygging, lesing og separat transfer med enkel sluttkonsonant.",
        cannotProve: "Kan ikke bevise generell lesing, uttale, progresjon eller nivå.",
        stimulusRationale: "Ris–sil bevarer en nærere endring; fin–bil prøver framgangsmåten med større transferendring.",
        openReviewerQuestions: ["Er begge par språkfaglig forsvarlige som avgrensede draftoppgaver?"],
      }),
      "nn-NO": patternLocale("nn-NO", {
        title: "Enkel sluttkonsonant",
        norwegianGraphemePhonemeSuitability: "Førebels norsk vurdering av korte ord med enkel sluttkonsonant; ikkje importert engelsk CVC.",
        writtenStandard: "Nynorsk, med eiga redaksjonell utgåve.",
        pronunciationAndDialectLimits: "Inga automatisk uttale- eller dialektvurdering; regionale vokalar krev ekstern review.",
        vowelLength: "Vokallengd skal skildrast, ikkje skårast.",
        consonantDoubling: "Klassen undersøker ikkje dobbel konsonant.",
        orthographicComplexity: "Avgrensa, men ordpara er ikkje nødvendigvis identiske grafemmønster.",
        morphologicalComplexity: "Ingen morfologisk generalisering kan trekkjast.",
        investigates: "Konkret bygging, lesing og separat transfer med enkel sluttkonsonant.",
        cannotProve: "Kan ikkje bevise generell lesing, uttale, progresjon eller nivå.",
        stimulusRationale: "Ris–sil held på ei nærare endring; fin–bil prøver framgangsmåten med større transferendring.",
        openReviewerQuestions: ["Er begge para språkfagleg forsvarlege som avgrensa utkastoppgåver?"],
      }),
    },
  },
  {
    patternClassId: "NOR-PC-DOUBLE-FINAL-001",
    revision: 1,
    lifecycleStatus: "CURRENT",
    status: "DRAFT",
    reviewStatus: "EXTERNAL_REVIEW_REQUIRED",
    frameworkBoundary: "NORWEGIAN_ORTHOGRAPHIC_REVIEW_NOT_IMPORTED_CVC",
    locales: {
      "nb-NO": patternLocale("nb-NO", {
        title: "Dobbel sluttkonsonant",
        norwegianGraphemePhonemeSuitability: "Norsk ortografisk utkast om dobbel sluttkonsonant, ikke en engelsk CVC-klasse.",
        writtenStandard: "Bokmål, med egen redaksjonell variant.",
        pronunciationAndDialectLimits: "Uttalevariasjon skal møtes av menneskelig review, aldri automatisk vurdering.",
        vowelLength: "Sammenhengen mellom kort vokal og dobbel konsonant er et reviewtema, ikke en automatisk regelpåstand.",
        consonantDoubling: "Doblingen er konstruktbærende i den ortografiske oppgaven.",
        orthographicComplexity: "Fire skrevne tegn og gjentatt konsonant krever tydelig grafemrepresentasjon.",
        morphologicalComplexity: "Oppgavene tester ikke bøyning eller morfologisk kunnskap.",
        investigates: "Reparasjon og transfer i konkret ortografisk ordbygging.",
        cannotProve: "Kan ikke bevise fonologisk mestring, rettskrivingsnivå eller progresjon.",
        stimulusRationale: "Katt–hatt og kopp–hopp bevarer dobbel sluttkonsonant med endret start.",
        openReviewerQuestions: ["Er grafem- og lydmodelleringen alders- og dialektegnet?"],
      }),
      "nn-NO": patternLocale("nn-NO", {
        title: "Dobbel sluttkonsonant",
        norwegianGraphemePhonemeSuitability: "Norsk ortografisk utkast om dobbel sluttkonsonant, ikkje ein engelsk CVC-klasse.",
        writtenStandard: "Nynorsk, med eiga redaksjonell utgåve.",
        pronunciationAndDialectLimits: "Uttalevariasjon skal møtast av menneskeleg review, aldri automatisk vurdering.",
        vowelLength: "Samanhengen mellom kort vokal og dobbel konsonant er eit reviewtema, ikkje ein automatisk regelpåstand.",
        consonantDoubling: "Doblinga er konstruktberande i den ortografiske oppgåva.",
        orthographicComplexity: "Fire skrivne teikn og gjenteken konsonant krev tydeleg grafemrepresentasjon.",
        morphologicalComplexity: "Oppgåvene testar ikkje bøying eller morfologisk kunnskap.",
        investigates: "Reparasjon og transfer i konkret ortografisk ordbygging.",
        cannotProve: "Kan ikkje bevise fonologisk meistring, rettskrivingsnivå eller progresjon.",
        stimulusRationale: "Katt–hatt og kopp–hopp held på dobbel sluttkonsonant med endra start.",
        openReviewerQuestions: ["Er grafem- og lydmodelleringa eigna for alder og dialekt?"],
      }),
    },
  },
  {
    patternClassId: "NOR-PC-CONSONANT-CLUSTER-001",
    revision: 1,
    lifecycleStatus: "CURRENT",
    status: "DRAFT",
    reviewStatus: "EXTERNAL_REVIEW_REQUIRED",
    frameworkBoundary: "NORWEGIAN_ORTHOGRAPHIC_REVIEW_NOT_IMPORTED_CVC",
    locales: {
      "nb-NO": patternLocale("nb-NO", {
        title: "Konsonantforbindelse",
        norwegianGraphemePhonemeSuitability: "Norsk draftklasse for konsonantforbindelser, uten engelsk CVC-ramme.",
        writtenStandard: "Bokmål, med egen redaksjonell variant.",
        pronunciationAndDialectLimits: "Klyngereduksjon og dialektvariasjon skal ikke vurderes automatisk.",
        vowelLength: "Vokallengde er ikke scoregrunnlag.",
        consonantDoubling: "Dobbel konsonant er ikke mål i denne klassen.",
        orthographicComplexity: "Flere konsonanter øker ortografisk kompleksitet.",
        morphologicalComplexity: "Stimulusparene gir ingen morfologisk evidens.",
        investigates: "Konkret bygging og transfer med konsonantforbindelser.",
        cannotProve: "Kan ikke bevise uttalekvalitet, dialektnærhet eller generell transfer.",
        stimulusRationale: "Pris–gris er nærere; fisk–vest har ulike finale klynger og er review-only.",
        openReviewerQuestions: ["Skal fisk–vest supersederes før ekstern review?"],
      }),
      "nn-NO": patternLocale("nn-NO", {
        title: "Konsonantsamband",
        norwegianGraphemePhonemeSuitability: "Norsk utkastklasse for konsonantsamband, utan engelsk CVC-ramme.",
        writtenStandard: "Nynorsk, med eiga redaksjonell utgåve.",
        pronunciationAndDialectLimits: "Reduksjon av samband og dialektvariasjon skal ikkje vurderast automatisk.",
        vowelLength: "Vokallengd er ikkje skåringsgrunnlag.",
        consonantDoubling: "Dobbel konsonant er ikkje mål i denne klassen.",
        orthographicComplexity: "Fleire konsonantar aukar den ortografiske kompleksiteten.",
        morphologicalComplexity: "Stimuluspara gir ingen morfologisk evidens.",
        investigates: "Konkret bygging og transfer med konsonantsamband.",
        cannotProve: "Kan ikkje bevise uttalekvalitet, dialektnærleik eller generell transfer.",
        stimulusRationale: "Pris–gris er nærare; fisk–vest har ulike finale klynger og er review-only.",
        openReviewerQuestions: ["Skal fisk–vest supersederast før ekstern review?"],
      }),
    },
  },
  {
    patternClassId: "NOR-PC-NG-GRAPHEME-001",
    revision: 1,
    lifecycleStatus: "CURRENT",
    status: "DRAFT",
    reviewStatus: "EXTERNAL_REVIEW_REQUIRED",
    frameworkBoundary: "NORWEGIAN_ORTHOGRAPHIC_REVIEW_NOT_IMPORTED_CVC",
    locales: {
      "nb-NO": patternLocale("nb-NO", {
        title: "Ng-sekvens",
        norwegianGraphemePhonemeSuitability: "Norsk draftklasse for skrevet ng-sekvens og mulig grafem–fonem-relasjon.",
        writtenStandard: "Bokmål, med egen redaksjonell variant.",
        pronunciationAndDialectLimits: "Fonologisk realisering varierer og krever menneskelig språkfaglig review.",
        vowelLength: "Vokallengde registreres ikke og tolkes ikke.",
        consonantDoubling: "Dobling er ikke mål; ng behandles som en ortografisk sekvens i utkastet.",
        orthographicComplexity: "Sekvensen kan representeres samlet i byggingen, men dette er et åpent konstruktvalg.",
        morphologicalComplexity: "Aktivitetene kan ikke bevise morfologisk kunnskap.",
        investigates: "Konkret reparasjon og transfer med ng-sekvens.",
        cannotProve: "Kan ikke bevise uttale, fonemanalyse, valid progresjon eller nivå.",
        stimulusRationale: "Sang–lang er avgrenset; ring–seng endrer start og vokal samtidig og er review-only.",
        openReviewerQuestions: ["Skal ng være én byggestein eller to i endelig konstrukt?"],
      }),
      "nn-NO": patternLocale("nn-NO", {
        title: "Ng-sekvens",
        norwegianGraphemePhonemeSuitability: "Norsk utkastklasse for skriven ng-sekvens og mogleg grafem–fonem-relasjon.",
        writtenStandard: "Nynorsk, med eiga redaksjonell utgåve.",
        pronunciationAndDialectLimits: "Fonologisk realisering varierer og krev menneskeleg språkfagleg review.",
        vowelLength: "Vokallengd blir ikkje registrert eller tolka.",
        consonantDoubling: "Dobling er ikkje mål; ng blir handsama som ein ortografisk sekvens i utkastet.",
        orthographicComplexity: "Sekvensen kan representerast samla i bygginga, men dette er eit ope konstruktval.",
        morphologicalComplexity: "Aktivitetane kan ikkje bevise morfologisk kunnskap.",
        investigates: "Konkret reparasjon og transfer med ng-sekvens.",
        cannotProve: "Kan ikkje bevise uttale, fonemanalyse, valid progresjon eller nivå.",
        stimulusRationale: "Sang–lang er avgrensa; ring–seng endrar start og vokal samtidig og er review-only.",
        openReviewerQuestions: ["Skal ng vere éi byggjebrikke eller to i endeleg konstrukt?"],
      }),
    },
  },
] as const;

const knowledge: readonly DraftKnowledgeVariant[] = activitySeeds.flatMap((seed) =>
  LOCALES.map((locale): DraftKnowledgeVariant => {
    const editorial = seed.locales[locale];
    return {
      knowledgeId: knowledgeId(seed),
      revision: 1,
      locale,
      title: editorial.knowledgeTitle,
      explanation: editorial.knowledgeExplanation,
      adultAction: editorial.knowledgeAction,
      avoid: editorial.knowledgeAvoid,
      deepen: editorial.knowledgeDeepen,
      waitAllowed: true,
      stopConditions: editorial.stopConditions,
      audioSpecId: audioIds(seed, locale)[2],
      status: "DRAFT",
      reviewStatus: "EXTERNAL_REVIEW_REQUIRED",
      humanReviewed: true,
      reviewSource: REVIEW_SOURCE,
    };
  }),
);

const contextCards: readonly DraftContextCardVariant[] = activitySeeds.flatMap((seed) =>
  LOCALES.map((locale): DraftContextCardVariant => ({
    contextCardId: contextCardId(seed),
    revision: 1,
    locale,
    activityId: seed.activityId,
    knowledgeId: knowledgeId(seed),
    oneActionOnly: true,
    action: seed.locales[locale].contextAction,
    waitAllowed: true,
    expiresWhen: seed.locales[locale].adult.expiresWhen,
    status: "DRAFT",
    reviewStatus: "EXTERNAL_REVIEW_REQUIRED",
    humanReviewed: true,
    reviewSource: REVIEW_SOURCE,
  })),
);

function audioSpecification(
  seed: ActivitySeed,
  locale: Locale,
  role: "TARGET" | "TRANSFER" | "KNOWLEDGE",
): AudioSpecification {
  const index = role === "TARGET" ? 0 : role === "TRANSFER" ? 1 : 2;
  const content = role === "TARGET"
    ? seed.target
    : role === "TRANSFER"
      ? seed.transfer
      : seed.locales[locale].knowledgeExplanation;
  return {
    audioSpecId: audioIds(seed, locale)[index],
    semanticContentId: `${seed.activityId}:${role.toLocaleLowerCase("en-US")}`,
    textRevision: 1,
    locale,
    ageBand: "6-9",
    audioRole: role === "KNOWLEDGE" ? "ADULT_KNOWLEDGE" : "MODEL",
    constructSensitivity: role === "KNOWLEDGE" ? "LOW" : "HIGH",
    voiceSourcePolicy: role === "KNOWLEDGE" ? "HUMAN_PREFERRED" : "HUMAN_REQUIRED",
    speakerIdentityInternal: "UNASSIGNED_HUMAN_SPEAKER",
    rightsScope: "DRAFT_SPEC_NOT_RECORDED",
    scriptRevision: 1,
    takeRevision: 0,
    prosodicIntent: role === "KNOWLEDGE"
      ? `Nøktern voksenrettet opplesning av: ${content}`
      : `Tydelig menneskelig ordmodell av: ${content}`,
    allowedVariationSet: [],
    userInitiated: true,
    replayAllowed: true,
    stopBehavior: "STOP_IMMEDIATELY",
    silenceAlternative: true,
    fallbackPolicy: "REVIEWED_TEXT",
    humanReviewed: true,
    staleStatus: "CURRENT",
    withdrawalStatus: "ACTIVE",
  };
}

const audioSpecifications: readonly AudioSpecification[] = activitySeeds.flatMap((seed) =>
  LOCALES.flatMap((locale) => [
    audioSpecification(seed, locale, "TARGET"),
    audioSpecification(seed, locale, "TRANSFER"),
    audioSpecification(seed, locale, "KNOWLEDGE"),
  ]),
);

export const wp13_8DraftCorpus: DraftLearningCorpusRelease = {
  releaseId: "wp13-8-authentic-draft-corpus-r1",
  revision: 1,
  status: "DRAFT",
  reviewStatus: "EXTERNAL_REVIEW_REQUIRED",
  evidenceStatus: "SYNTHETIC_ONLY",
  betaStatus: "NOT_STUDENT_BETA",
  patternClasses,
  activities,
  knowledge,
  contextCards,
  audioSpecifications,
  progressionEdges: [
    {
      edgeId: "progression-single-to-double-draft",
      fromPatternClassId: "NOR-PC-SINGLE-FINAL-001",
      toPatternClassId: "NOR-PC-DOUBLE-FINAL-001",
      decisionAuthority: "ADULT",
      automaticPlacement: false,
      aggregateScoreRequired: false,
      status: "DRAFT_EXTERNAL_REVIEW_REQUIRED",
      claimBoundary: "Ikke validert rekkefølge; bare et voksenstyrt reviewutkast.",
    },
    {
      edgeId: "progression-single-to-cluster-draft",
      fromPatternClassId: "NOR-PC-SINGLE-FINAL-001",
      toPatternClassId: "NOR-PC-CONSONANT-CLUSTER-001",
      decisionAuthority: "ADULT",
      automaticPlacement: false,
      aggregateScoreRequired: false,
      status: "DRAFT_EXTERNAL_REVIEW_REQUIRED",
      claimBoundary: "Ikke validert rekkefølge; bare et voksenstyrt reviewutkast.",
    },
    {
      edgeId: "progression-cluster-to-ng-draft",
      fromPatternClassId: "NOR-PC-CONSONANT-CLUSTER-001",
      toPatternClassId: "NOR-PC-NG-GRAPHEME-001",
      decisionAuthority: "ADULT",
      automaticPlacement: false,
      aggregateScoreRequired: false,
      status: "DRAFT_EXTERNAL_REVIEW_REQUIRED",
      claimBoundary: "Ikke validert rekkefølge; bare et voksenstyrt reviewutkast.",
    },
  ],
};
