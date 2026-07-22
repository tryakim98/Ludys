import type { Locale } from "../../core/content-contracts.js";
import type {
  LifecycleErrorCode,
  LifecycleEvent,
  LifecycleState,
} from "../../core/session-lifecycle.js";

type LifecycleAction = LifecycleEvent["kind"];

export const DRAFT_TECHNICAL_COPY_MARKER =
  "DRAFT_TECHNICAL_COPY — subject to Product Excellence review" as const;

export interface SessionLifecycleTechnicalCopy {
  readonly marker: typeof DRAFT_TECHNICAL_COPY_MARKER;
  readonly pageTitle: string;
  readonly heading: string;
  readonly introduction: string;
  readonly skipLink: string;
  readonly localeLabel: string;
  readonly localeNb: string;
  readonly localeNn: string;
  readonly roleGroup: string;
  readonly childRole: string;
  readonly adultRole: string;
  readonly stateLabel: string;
  readonly syntheticBadge: string;
  readonly actionGroup: string;
  readonly childPanel: string;
  readonly adultPanel: string;
  readonly childDefault: string;
  readonly childHelpWait: string;
  readonly adultDefault: string;
  readonly adultHelpRequested: string;
  readonly sessionReference: string;
  readonly observedVersion: string;
  readonly tombstone: string;
  readonly states: Readonly<Record<LifecycleState, string>>;
  readonly actions: Readonly<Record<LifecycleAction, string>>;
  readonly errors: Readonly<Record<LifecycleErrorCode, string>>;
}

const stateNamesNb: Record<LifecycleState, string> = {
  NOT_CREATED: "Tom — økt er ikke opprettet",
  CREATING: "Laster — økt opprettes",
  READY: "Klar",
  ACTIVE: "Aktiv",
  WAITING: "Venter",
  PAUSED: "Pauset",
  STOPPED: "Stoppet",
  DELETED: "Slettet",
  STALE: "Foreldet snapshot",
  INVALID: "Ugyldig payload",
  RECOVERING: "Gjenoppretter",
  COMPLETED: "Fullført",
};

const actionsNb: Record<LifecycleAction, string> = {
  CREATE: "Opprett syntetisk økt",
  CREATED: "Fullfør simulert lasting",
  ACTIVATE: "Aktiver økt",
  REQUEST_HELP: "Be om hjelp og vent",
  ENTER_WAIT: "Gå til vent",
  RESUME: "Fortsett",
  PAUSE: "Pause",
  STOP: "Stopp",
  DELETE: "Slett syntetisk økt",
  RECONNECT: "Forsøk reconnect",
  DETECT_STALE: "Simuler foreldet snapshot",
  DETECT_INVALID: "Simuler ugyldig payload",
  BEGIN_RECOVERY: "Start gjenoppretting",
  RECOVERY_SUCCEEDED: "Simuler vellykket gjenoppretting",
  RECOVERY_FAILED: "Simuler mislykket gjenoppretting",
  COMPLETE: "Fullfør økt",
};

const errorsNb: Record<LifecycleErrorCode, string> = {
  INVALID_TRANSITION: "Ugyldig overgang. Tilstanden er ikke endret.",
  DUPLICATE_COMMAND: "Duplikatkommandoen ble avvist uten å endre økten.",
  STALE_AUTHORITY: "En kommando fra en eldre autoritetsgenerasjon ble avvist.",
  DELAYED_COMMAND: "En forsinket kommando ble avvist uten å endre økten.",
  NO_RESURRECTION: "Stoppet eller slettet økt kan ikke gjenopplives.",
  TOMBSTONE: "Økten er slettet. Bare tombstone finnes.",
  NOT_FOUND: "Ingen syntetisk økt ble funnet.",
  STALE_WRITE_REJECTED: "Foreldet snapshot ble avvist.",
  DISCONNECTED: "Simulert frakobling. Ingen nettverkstrafikk ble brukt.",
  INVALID_PAYLOAD: "Simulert ugyldig payload ble avvist.",
  RECOVERY_FAILED: "Simulert gjenoppretting feilet.",
};

const stateNamesNn: Record<LifecycleState, string> = {
  NOT_CREATED: "Tom — økta er ikkje oppretta",
  CREATING: "Lastar — økta blir oppretta",
  READY: "Klar",
  ACTIVE: "Aktiv",
  WAITING: "Ventar",
  PAUSED: "Sett på pause",
  STOPPED: "Stoppa",
  DELETED: "Sletta",
  STALE: "Forelda snapshot",
  INVALID: "Ugyldig payload",
  RECOVERING: "Gjenopprettar",
  COMPLETED: "Fullført",
};

const actionsNn: Record<LifecycleAction, string> = {
  CREATE: "Opprett syntetisk økt",
  CREATED: "Fullfør simulert lasting",
  ACTIVATE: "Aktiver økt",
  REQUEST_HELP: "Be om hjelp og vent",
  ENTER_WAIT: "Gå til vent",
  RESUME: "Hald fram",
  PAUSE: "Pause",
  STOP: "Stopp",
  DELETE: "Slett syntetisk økt",
  RECONNECT: "Prøv reconnect",
  DETECT_STALE: "Simuler forelda snapshot",
  DETECT_INVALID: "Simuler ugyldig payload",
  BEGIN_RECOVERY: "Start gjenoppretting",
  RECOVERY_SUCCEEDED: "Simuler vellukka gjenoppretting",
  RECOVERY_FAILED: "Simuler mislukka gjenoppretting",
  COMPLETE: "Fullfør økt",
};

const errorsNn: Record<LifecycleErrorCode, string> = {
  INVALID_TRANSITION: "Ugyldig overgang. Tilstanden er ikkje endra.",
  DUPLICATE_COMMAND: "Duplikatkommandoen vart avvist utan å endre økta.",
  STALE_AUTHORITY: "Ein kommando frå ein eldre autoritetsgenerasjon vart avvist.",
  DELAYED_COMMAND: "Ein forseinka kommando vart avvist utan å endre økta.",
  NO_RESURRECTION: "Stoppa eller sletta økt kan ikkje bli vekt til live.",
  TOMBSTONE: "Økta er sletta. Berre tombstone finst.",
  NOT_FOUND: "Inga syntetisk økt vart funnen.",
  STALE_WRITE_REJECTED: "Forelda snapshot vart avvist.",
  DISCONNECTED: "Simulert fråkopling. Ingen nettverkstrafikk vart brukt.",
  INVALID_PAYLOAD: "Simulert ugyldig payload vart avvist.",
  RECOVERY_FAILED: "Simulert gjenoppretting feila.",
};

export const sessionLifecycleTechnicalCopy: Readonly<Record<Locale, SessionLifecycleTechnicalCopy>> = {
  "nb-NO": {
    marker: DRAFT_TECHNICAL_COPY_MARKER,
    pageTitle: "LUDYS WP13.7A — teknisk øktproof",
    heading: "Deterministisk øktlivsløp",
    introduction: "Isolert teknisk proof med syntetiske data. Dette er ikke endelig produkttekst eller visuell design.",
    skipLink: "Hopp til øktproof",
    localeLabel: "Målform",
    localeNb: "Bokmål",
    localeNn: "Nynorsk",
    roleGroup: "Rolleprojeksjon",
    childRole: "Barnets tekniske visning",
    adultRole: "Den voksnes tekniske visning",
    stateLabel: "Tilstand",
    syntheticBadge: "Syntetisk teknisk demo — kan slettes deterministisk",
    actionGroup: "Gyldige tekniske hendelser",
    childPanel: "Barnets rolleavgrensede felt",
    adultPanel: "Den voksnes rolleavgrensede felt",
    childDefault: "Kort syntetisk tilstandsvisning uten voksenfelt.",
    childHelpWait: "Hjelp er bedt om. Visningen venter på et menneske.",
    adultDefault: "Teknisk øktstatus uten barnets private proof-token.",
    adultHelpRequested: "Hjelp er eksplisitt bedt om i denne syntetiske økten.",
    sessionReference: "Syntetisk øktreferanse",
    observedVersion: "Observert versjon",
    tombstone: "Slettet økt viser ingen øktinnhold.",
    states: stateNamesNb,
    actions: actionsNb,
    errors: errorsNb,
  },
  "nn-NO": {
    marker: DRAFT_TECHNICAL_COPY_MARKER,
    pageTitle: "LUDYS WP13.7A — teknisk øktproof",
    heading: "Deterministisk øktlivsløp",
    introduction: "Isolert teknisk proof med syntetiske data. Dette er ikkje endeleg produkttekst eller visuell utforming.",
    skipLink: "Hopp til øktproof",
    localeLabel: "Målform",
    localeNb: "Bokmål",
    localeNn: "Nynorsk",
    roleGroup: "Rolleprojeksjon",
    childRole: "Barnet si tekniske visning",
    adultRole: "Den vaksne si tekniske visning",
    stateLabel: "Tilstand",
    syntheticBadge: "Syntetisk teknisk demo — kan slettast deterministisk",
    actionGroup: "Gyldige tekniske hendingar",
    childPanel: "Barnet sine rolleavgrensa felt",
    adultPanel: "Den vaksne sine rolleavgrensa felt",
    childDefault: "Kort syntetisk tilstandsvisning utan vaksenfelt.",
    childHelpWait: "Det er bede om hjelp. Visninga ventar på eit menneske.",
    adultDefault: "Teknisk øktstatus utan barnet sitt private proof-token.",
    adultHelpRequested: "Det er eksplisitt bede om hjelp i denne syntetiske økta.",
    sessionReference: "Syntetisk øktreferanse",
    observedVersion: "Observert versjon",
    tombstone: "Sletta økt viser ikkje øktinnhald.",
    states: stateNamesNn,
    actions: actionsNn,
    errors: errorsNn,
  },
};
