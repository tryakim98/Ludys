import {
  createLocaleRequestCoordinator,
  reviewedDenialClass,
} from "./lib/reviewed-copy.mjs";

const localeLoaders = Object.freeze({
  "nb-NO": (generation) =>
    import(`./locales/nb.mjs?request=${generation}`),
  "nn-NO": (generation) =>
    import(`./locales/nn.mjs?request=${generation}`),
});

const approvedPublicFunctionUrls = Object.freeze({
  command: "https://sessioncommand-qbqbamvs6q-lz.a.run.app",
  projection: "https://sessionprojection-qbqbamvs6q-lz.a.run.app",
});

const elements = Object.freeze({
  main: document.querySelector("#main-content"),
  pageTitle: document.querySelector("#page-title"),
  skipLink: document.querySelector("#skip-link"),
  locale: document.querySelector("#locale"),
  localeLabel: document.querySelector("#locale-label"),
  localeNb: document.querySelector("#locale-nb"),
  localeNn: document.querySelector("#locale-nn"),
  status: document.querySelector("#status"),
  issuedPanel: document.querySelector("#issued-session"),
  issuedSessionId: document.querySelector("#issued-session-id"),
  childCapability: document.querySelector("#child-capability"),
  adultCapability: document.querySelector("#adult-capability"),
  childRevealButton: document.querySelector('[data-reveal-capability="CHILD"]'),
  adultRevealButton: document.querySelector('[data-reveal-capability="ADULT"]'),
  childUseButton: document.querySelector('[data-use-issued-role="CHILD"]'),
  adultUseButton: document.querySelector('[data-use-issued-role="ADULT"]'),
  issuedExpiresAt: document.querySelector("#issued-expires-at"),
  deleteSessionId: document.querySelector("#delete-session-id"),
  connectSessionId: document.querySelector("#connect-session-id"),
  connectRole: document.querySelector("#connect-role"),
  connectCapability: document.querySelector("#connect-capability"),
  issueButton: document.querySelector("#issue-session"),
  deleteButton: document.querySelector("#delete-session"),
  connectButton: document.querySelector("#connect-session"),
  disconnectButton: document.querySelector("#disconnect-session"),
  clearIssuedButton: document.querySelector("#clear-issued"),
  refreshButton: document.querySelector("#refresh-projection"),
  staleButton: document.querySelector("#send-stale"),
  projectionRole: document.querySelector("#projection-role"),
  projectionTerminal: document.querySelector("#projection-terminal"),
  projectionVersion: document.querySelector("#projection-version"),
  projectionWait: document.querySelector("#projection-wait"),
  projectionHelp: document.querySelector("#projection-help"),
  projectionAudio: document.querySelector("#projection-audio"),
  controlsSection: document.querySelector("#controls-title")?.closest("section"),
});

const state = {
  copy: undefined,
  config: undefined,
  issued: undefined,
  connection: undefined,
  projection: undefined,
  runtimeFailure: undefined,
  committedLocale: undefined,
  localeFailure: undefined,
  localePhase: "BOOTSTRAP",
  busy: false,
};

class SafeRequestFailure extends Error {
  constructor(status, denialClass) {
    super("SAFE_REQUEST_FAILURE");
    this.status = status;
    this.denialClass = denialClass;
  }
}

function safeDenialClass(value) {
  return reviewedDenialClass(value, state.copy?.reviewedDenialClasses);
}

function isApprovedProviderUrl(value, expected) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:"
      && parsed.username === ""
      && parsed.password === ""
      && parsed.search === ""
      && parsed.hash === ""
      && parsed.pathname === "/"
      && parsed.origin === expected
      && value === expected
    );
  } catch {
    return false;
  }
}

function validSessionId(value) {
  return (
    typeof value === "string"
    && /^synthetic-wp13-12b-[A-Za-z0-9_-]{20,64}$/u.test(value)
  );
}

function validCapability(value) {
  return (
    typeof value === "string"
    && value.length >= 64
    && value.length <= 2048
    && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value)
  );
}

function decodeCapabilityBinding(capability, sessionId, role) {
  if (!validCapability(capability)) return undefined;
  try {
    const encoded = capability.split(".")[0];
    const padded = encoded.replaceAll("-", "+").replaceAll("_", "/")
      .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    if (
      claims.capabilityVersion !== "wp13.12b-capability-v1"
      || claims.sessionBinding !== sessionId
      || claims.roleBinding !== role
      || claims.releaseBinding !== "wp13-12b-synthetic-staging-provider-r1"
      || !Number.isInteger(claims.authorityGenerationBinding)
      || claims.authorityGenerationBinding < 1
      || typeof claims.expiresAt !== "string"
      || !Number.isFinite(Date.parse(claims.expiresAt))
      || Date.parse(claims.expiresAt) <= Date.now()
    ) return undefined;
    return Object.freeze({
      authorityGeneration: claims.authorityGenerationBinding,
      expiresAt: claims.expiresAt,
    });
  } catch {
    return undefined;
  }
}

function validProjection(candidate, role) {
  if (
    candidate === null
    || typeof candidate !== "object"
    || candidate.role !== role
    || !["ACTIVE", "STOPPED", "COMPLETED"].includes(candidate.terminalStatus)
    || !Number.isInteger(candidate.stateVersion)
    || candidate.stateVersion < 0
    || !["nb-NO", "nn-NO"].includes(candidate.locale)
    || typeof candidate.wait !== "boolean"
    || candidate.audioStatus !== "SILENT"
  ) return false;
  if (role === "CHILD") {
    return (
      typeof candidate.helpPending === "boolean"
      && typeof candidate.canRequestHelp === "boolean"
      && typeof candidate.canPause === "boolean"
      && typeof candidate.canStop === "boolean"
    );
  }
  return (
    validSessionId(candidate.syntheticSessionId)
    && (candidate.adultCard === undefined || candidate.adultCard === "SYNTHETIC_HELP_REQUESTED")
    && typeof candidate.canResume === "boolean"
    && typeof candidate.canPause === "boolean"
    && typeof candidate.canStop === "boolean"
  );
}

function setStatus(message, code) {
  const safeCode = code === undefined ? "" : ` · ${safeDenialClass(code)}`;
  elements.status.textContent = `${message}${safeCode}`;
}

function setOperationalFailure(message, denialClass) {
  if (state.localePhase === "READY") {
    setStatus(message, denialClass);
  } else if (state.localePhase === "FAILED") {
    setLocaleFailure();
  }
}

function checked(value) {
  return value ? state.copy.yes : state.copy.no;
}

function requiredNode(selector) {
  const node = document.querySelector(selector);
  if (node === null) throw new Error("LOCALE_DOM_BINDING_INVALID");
  return node;
}

function buildCopyPlan(text) {
  if (elements.connectRole?.options?.length !== 2) {
    throw new Error("LOCALE_DOM_BINDING_INVALID");
  }
  const plan = Object.freeze([
    [requiredNode("#skip-link"), text.skipLink],
    [requiredNode("#locale-label"), text.localeLabel],
    [requiredNode("#locale-nb"), text.nbLocale],
    [requiredNode("#locale-nn"), text.nnLocale],
    [requiredNode("#page-title"), text.pageTitle],
    [requiredNode("#boundary-title"), text.boundaryTitle],
    [requiredNode("#boundary-copy"), text.boundaryCopy],
    [requiredNode("#capability-memory-status"), text.capabilityMemoryStatus],
    [requiredNode("#operator-eyebrow"), text.operatorEyebrow],
    [requiredNode("#operator-title"), text.operatorTitle],
    [requiredNode("#operator-copy"), text.operatorCopy],
    [elements.issueButton, text.issue],
    [requiredNode("#transfer-title"), text.transferTitle],
    [requiredNode("#transfer-copy"), text.transferCopy],
    [requiredNode("#issued-session-label"), text.sessionId],
    [requiredNode("#child-transfer-title"), text.childRole],
    [requiredNode("#adult-transfer-title"), text.adultRole],
    [requiredNode("#child-capability-label"), text.capability],
    [requiredNode("#adult-capability-label"), text.capability],
    [elements.childRevealButton, text.revealChild],
    [elements.adultRevealButton, text.revealAdult],
    [elements.childUseButton, text.useChild],
    [elements.adultUseButton, text.useAdult],
    [requiredNode("#expires-label"), text.expires],
    [elements.clearIssuedButton, text.clearIssued],
    [requiredNode("#delete-title"), text.deleteTitle],
    [requiredNode("#delete-session-label"), text.deleteSession],
    [elements.deleteButton, text.deleteAction],
    [requiredNode("#device-eyebrow"), text.deviceEyebrow],
    [requiredNode("#connect-title"), text.connectTitle],
    [requiredNode("#connect-copy"), text.connectCopy],
    [requiredNode("#connect-session-label"), text.sessionId],
    [requiredNode("#connect-role-label"), text.role],
    [requiredNode("#connect-capability-label"), text.capability],
    [elements.connectRole.options[0], text.child],
    [elements.connectRole.options[1], text.adult],
    [elements.connectButton, text.connect],
    [elements.disconnectButton, text.disconnect],
    [requiredNode("#projection-title"), text.projectionTitle],
    [requiredNode("#projection-role-label"), text.role],
    [requiredNode("#projection-terminal-label"), text.terminalStatus],
    [requiredNode("#projection-version-label"), text.stateVersion],
    [requiredNode("#projection-wait-label"), text.waitState],
    [requiredNode("#projection-help-label"), text.helpPending],
    [requiredNode("#projection-audio-label"), text.audioStatus],
    [requiredNode("#controls-title"), text.controlsTitle],
    [requiredNode('[data-command="ACTIVATE"]'), text.activate],
    [requiredNode('[data-command="ENTER_WAIT"]'), text.wait],
    [requiredNode('[data-command="REQUEST_HELP"]'), text.help],
    [requiredNode('[data-command="PAUSE"]'), text.pause],
    [requiredNode('[data-command="RESUME"]'), text.resume],
    [requiredNode('[data-command="RECONNECT"]'), text.reconnect],
    [requiredNode('[data-command="STOP"]'), text.stop],
    [elements.refreshButton, text.refresh],
    [elements.staleButton, text.stale],
    [requiredNode("#terminal-title"), text.terminalTitle],
    [requiredNode("#terminal-copy"), text.terminalCopy],
  ]);
  if (plan.some(([node]) => node === null || node === undefined)) {
    throw new Error("LOCALE_DOM_BINDING_INVALID");
  }
  return plan;
}

const localeSurfaces = Object.freeze([
  ...document.querySelectorAll("#main-content > :not(#status)"),
]);

function connectionCapabilityUsable(connection = state.connection) {
  return (
    connection !== undefined
    && validCapability(connection.capability)
    && typeof connection.expiresAt === "string"
    && Number.isFinite(Date.parse(connection.expiresAt))
    && Date.parse(connection.expiresAt) > Date.now()
  );
}

function activeStopPresent() {
  return (
    state.connection !== undefined
    && state.projection?.terminalStatus === "ACTIVE"
    && state.projection.canStop === true
  );
}

function maskCapabilityFields() {
  elements.childCapability.type = "password";
  elements.adultCapability.type = "password";
  elements.childRevealButton.setAttribute("aria-pressed", "false");
  elements.adultRevealButton.setAttribute("aria-pressed", "false");
}

function setLocaleSurfacesVisible(visible) {
  elements.pageTitle.hidden = !visible;
  elements.skipLink.hidden = !visible;
  for (const surface of localeSurfaces) surface.hidden = !visible;
  if (visible) {
    elements.controlsSection.setAttribute("aria-labelledby", "controls-title");
    elements.controlsSection.removeAttribute("aria-label");
  }
  for (const button of document.querySelectorAll("[data-command]")) {
    button.hidden = false;
  }
  requiredNode("#controls-title").hidden = false;
  elements.refreshButton.hidden = false;
  elements.staleButton.hidden = false;
  if (!visible && activeStopPresent()) {
    elements.controlsSection.hidden = false;
    elements.controlsSection.removeAttribute("aria-labelledby");
    elements.controlsSection.setAttribute("aria-label", "SAFETY");
    requiredNode("#controls-title").hidden = true;
    for (const button of document.querySelectorAll("[data-command]")) {
      const isStop = button.dataset.command === "STOP";
      button.hidden = !isStop;
      if (isStop) button.textContent = "STOP";
    }
    elements.refreshButton.hidden = true;
    elements.staleButton.hidden = true;
  }
}

function setLocaleSelectorTechnical(technical) {
  elements.localeLabel.hidden = technical;
  if (technical) {
    elements.locale.setAttribute("aria-label", "LOCALE");
    elements.localeNb.textContent = "nb-NO";
    elements.localeNn.textContent = "nn-NO";
  } else {
    elements.locale.removeAttribute("aria-label");
  }
}

function setLocalePending({ locale } = {}) {
  state.localePhase = "PENDING";
  state.localeFailure = undefined;
  document.documentElement.lang = "und";
  document.title = "LUDYS · WP13.12B";
  elements.status.textContent = "";
  elements.status.setAttribute("aria-busy", "true");
  elements.main.setAttribute("aria-busy", "true");
  elements.locale.removeAttribute("aria-invalid");
  elements.locale.removeAttribute("aria-describedby");
  if (localeLoaders[locale] !== undefined) elements.locale.value = locale;
  maskCapabilityFields();
  setLocaleSelectorTechnical(true);
  setLocaleSurfacesVisible(false);
  updateControls();
}

function setLocaleFailure() {
  state.localePhase = "FAILED";
  state.localeFailure = "LOCALE_BUNDLE_INVALID";
  document.documentElement.lang = "und";
  document.title = "LUDYS · WP13.12B · LOCALE_BUNDLE_INVALID";
  elements.locale.selectedIndex = -1;
  elements.locale.setAttribute("aria-invalid", "true");
  elements.locale.setAttribute("aria-describedby", "status");
  elements.status.removeAttribute("aria-busy");
  elements.main.removeAttribute("aria-busy");
  elements.status.textContent = "LOCALE_BUNDLE_INVALID";
  clearIssued();
  elements.connectSessionId.value = "";
  elements.connectCapability.value = "";
  elements.deleteSessionId.value = "";
  maskCapabilityFields();
  setLocaleSelectorTechnical(true);
  setLocaleSurfacesVisible(false);
  updateControls();
}

function commitLocale({ copy, locale }) {
  const plan = buildCopyPlan(copy);
  const previousText = plan.map(([node]) => node.textContent);
  try {
    for (const [node, value] of plan) node.textContent = value;
    state.copy = copy;
    state.committedLocale = locale;
    state.localeFailure = undefined;
    state.localePhase = "READY";
    elements.locale.value = locale;
    elements.locale.removeAttribute("aria-invalid");
    elements.locale.removeAttribute("aria-describedby");
    elements.status.removeAttribute("aria-busy");
    elements.main.removeAttribute("aria-busy");
    document.documentElement.lang = copy.htmlLang;
    document.title = `LUDYS · WP13.12B · ${copy.pageTitle}`;
    setLocaleSelectorTechnical(false);
    setLocaleSurfacesVisible(true);
    renderProjection(copy);
  } catch (error) {
    for (const [index, [node]] of plan.entries()) {
      node.textContent = previousText[index];
    }
    throw error;
  }
}

const localeCoordinator = createLocaleRequestCoordinator({
  loaders: localeLoaders,
  onPending: setLocalePending,
  onCommit: commitLocale,
  onFailure: setLocaleFailure,
});

async function selectLocale(locale) {
  return localeCoordinator.request(locale);
}

async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new SafeRequestFailure(503, "NETWORK_UNAVAILABLE");
  }
  let value;
  try {
    value = await response.json();
  } catch {
    throw new SafeRequestFailure(response.status, "RESPONSE_INVALID");
  }
  if (!response.ok) {
    throw new SafeRequestFailure(response.status, safeDenialClass(value?.denialClass));
  }
  return value;
}

async function sameOriginPost(path, body) {
  return requestJson(path, {
    method: "POST",
    headers: Object.freeze({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
}

async function providerPost(url, body, capability) {
  if (![
    approvedPublicFunctionUrls.command,
    approvedPublicFunctionUrls.projection,
  ].some((expected) => isApprovedProviderUrl(url, expected))) {
    throw new SafeRequestFailure(503, "RUNTIME_CONFIG_INVALID");
  }
  return requestJson(url, {
    method: "POST",
    credentials: "omit",
    headers: Object.freeze({
      Authorization: `Bearer ${capability}`,
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
}

function renderProjection(text = state.copy) {
  const projection = state.projection;
  if (text === undefined) {
    updateControls();
    return;
  }
  elements.projectionRole.textContent = projection?.role === "CHILD"
    ? text.child
    : projection?.role === "ADULT" ? text.adult : text.none;
  elements.projectionTerminal.textContent = projection?.terminalStatus ?? text.none;
  elements.projectionVersion.textContent = projection === undefined
    ? text.none
    : String(projection.stateVersion);
  elements.projectionWait.textContent = projection === undefined
    ? text.none
    : checked(projection.wait);
  const help = projection?.role === "CHILD"
    ? projection.helpPending
    : projection?.adultCard === "SYNTHETIC_HELP_REQUESTED";
  elements.projectionHelp.textContent = projection === undefined ? text.none : checked(help);
  elements.projectionAudio.textContent = projection?.audioStatus ?? "SILENT";
  updateControls();
}

function localeReady() {
  return (
    state.localePhase === "READY"
    && state.copy !== undefined
    && state.committedLocale === state.copy.locale
    && state.localeFailure === undefined
  );
}

function operationalReady() {
  return (
    localeReady()
    && state.config !== undefined
    && state.runtimeFailure === undefined
  );
}

function updateControls() {
  const connection = state.connection;
  const projection = state.projection;
  const terminal = projection === undefined || projection.terminalStatus !== "ACTIVE";
  const operationsAreReady = operationalReady();
  const providerConnectionReady = connectionCapabilityUsable(connection);
  const providerSessionLocaleReady = (
    providerConnectionReady
    && connection.locale === state.committedLocale
  );
  elements.locale.disabled = state.busy;
  for (const button of document.querySelectorAll("[data-command]")) {
    const command = button.dataset.command;
    const roleAllowed = (
      button.dataset.role === "BOTH"
      || button.dataset.role === connection?.role
    );
    let domainAllowed = !terminal;
    if (command === "ACTIVATE") {
      domainAllowed = (
        projection?.role === "ADULT"
        && !projection.canPause
        && !projection.canResume
        && !projection.wait
        && !terminal
      );
    }
    if (command === "ENTER_WAIT") {
      domainAllowed = projection?.role === "CHILD" && projection.canPause && !projection.wait;
    }
    if (command === "REQUEST_HELP") {
      domainAllowed = projection?.role === "CHILD" && projection.canRequestHelp;
    }
    if (command === "PAUSE") domainAllowed = projection?.canPause === true;
    if (command === "RESUME") {
      domainAllowed = projection?.role === "ADULT" && projection.canResume;
    }
    if (command === "STOP") domainAllowed = projection?.canStop === true;
    const safetyStop = (
      command === "STOP"
      && activeStopPresent()
      && providerConnectionReady
    );
    button.disabled = (
      state.busy
      || connection === undefined
      || !providerConnectionReady
      || (!providerSessionLocaleReady && !safetyStop)
      || !roleAllowed
      || !domainAllowed
      || (!operationsAreReady && !safetyStop)
    );
  }
  const connected = connection !== undefined;
  elements.issueButton.disabled = state.busy || !operationsAreReady;
  elements.deleteButton.disabled = state.busy || !operationsAreReady;
  elements.connectButton.disabled = state.busy || !operationsAreReady;
  elements.disconnectButton.disabled = state.busy || !operationsAreReady || !connected;
  elements.refreshButton.disabled = (
    state.busy
    || !operationsAreReady
    || !providerSessionLocaleReady
  );
  elements.staleButton.disabled = (
    state.busy
    || !operationsAreReady
    || !providerSessionLocaleReady
    || terminal
  );
  const issuedReady = operationsAreReady && state.issued !== undefined;
  elements.childRevealButton.disabled = state.busy || !issuedReady;
  elements.adultRevealButton.disabled = state.busy || !issuedReady;
  elements.childUseButton.disabled = state.busy || !issuedReady;
  elements.adultUseButton.disabled = state.busy || !issuedReady;
  elements.clearIssuedButton.disabled = state.busy || !issuedReady;
}

function setBusy(value) {
  state.busy = value;
  updateControls();
}

function clearIssued() {
  if (state.issued !== undefined) {
    state.issued.childCapability = "";
    state.issued.adultCapability = "";
  }
  state.issued = undefined;
  elements.issuedSessionId.value = "";
  elements.childCapability.value = "";
  elements.adultCapability.value = "";
  elements.childCapability.type = "password";
  elements.adultCapability.type = "password";
  elements.childRevealButton.setAttribute("aria-pressed", "false");
  elements.adultRevealButton.setAttribute("aria-pressed", "false");
  elements.issuedExpiresAt.textContent = "—";
  elements.issuedPanel.hidden = true;
}

function clearConnection(options = {}) {
  if (state.connection !== undefined) state.connection.capability = "";
  state.connection = undefined;
  elements.connectSessionId.value = "";
  elements.connectCapability.value = "";
  if (options.preserveProjection !== true) state.projection = undefined;
  renderProjection();
}

function clearAllSensitiveState(options = {}) {
  clearIssued();
  clearConnection(options);
  elements.deleteSessionId.value = "";
}

async function issueSession() {
  if (!operationalReady()) return;
  const startingLocaleGeneration = localeCoordinator.currentGeneration;
  setBusy(true);
  try {
    const result = await sameOriginPost("/api/issue", {
      locale: state.committedLocale,
      lifetimeMs: 10 * 60 * 1000,
    });
    if (
      !validSessionId(result?.syntheticSessionId)
      || !validCapability(result?.childCapability)
      || !validCapability(result?.adultCapability)
      || typeof result?.expiresAt !== "string"
      || !Number.isFinite(Date.parse(result.expiresAt))
      || decodeCapabilityBinding(result.childCapability, result.syntheticSessionId, "CHILD") === undefined
      || decodeCapabilityBinding(result.adultCapability, result.syntheticSessionId, "ADULT") === undefined
    ) throw new SafeRequestFailure(502, "ISSUE_RESPONSE_INVALID");
    if (
      localeCoordinator.currentGeneration !== startingLocaleGeneration
      || !operationalReady()
    ) return;
    clearIssued();
    state.issued = {
      syntheticSessionId: result.syntheticSessionId,
      childCapability: result.childCapability,
      adultCapability: result.adultCapability,
      expiresAt: result.expiresAt,
    };
    elements.issuedSessionId.value = result.syntheticSessionId;
    elements.childCapability.value = result.childCapability;
    elements.adultCapability.value = result.adultCapability;
    elements.issuedExpiresAt.textContent = result.expiresAt;
    elements.deleteSessionId.value = result.syntheticSessionId;
    elements.issuedPanel.hidden = false;
    setStatus(state.copy.issued);
  } catch (error) {
    const denial = error instanceof SafeRequestFailure ? error.denialClass : "REQUEST_DENIED";
    setOperationalFailure(state.copy?.unavailable, denial);
  } finally {
    setBusy(false);
  }
}

async function connectWith(sessionId, role, capability) {
  if (!operationalReady()) return;
  const startingLocaleGeneration = localeCoordinator.currentGeneration;
  const binding = decodeCapabilityBinding(capability, sessionId, role);
  elements.connectCapability.value = "";
  elements.connectSessionId.value = "";
  if (binding === undefined) {
    setStatus(state.copy.invalidInput, "CAPABILITY_BINDING_INVALID");
    return;
  }
  setBusy(true);
  try {
    const projection = await providerPost(
      state.config.projectionUrl,
      { syntheticSessionId: sessionId },
      capability,
    );
    if (!validProjection(projection, role)) {
      throw new SafeRequestFailure(502, "PROJECTION_INVALID");
    }
    if (
      localeCoordinator.currentGeneration !== startingLocaleGeneration
      || !operationalReady()
    ) return;
    if (state.committedLocale !== projection.locale) {
      const localeResult = await selectLocale(projection.locale);
      if (
        localeResult.status !== "COMMITTED"
        || state.committedLocale !== projection.locale
      ) return;
    }
    clearConnection();
    state.connection = {
      syntheticSessionId: sessionId,
      role,
      capability,
      authorityGeneration: binding.authorityGeneration,
      expiresAt: binding.expiresAt,
      locale: projection.locale,
    };
    state.projection = projection;
    elements.deleteSessionId.value = sessionId;
    renderProjection();
    setStatus(state.copy.connected);
  } catch (error) {
    const denial = error instanceof SafeRequestFailure ? error.denialClass : "REQUEST_DENIED";
    setOperationalFailure(state.copy?.unavailable, denial);
  } finally {
    setBusy(false);
  }
}

async function connectFromFields() {
  if (!operationalReady()) return;
  const sessionId = elements.connectSessionId.value.trim();
  const role = elements.connectRole.value;
  const capability = elements.connectCapability.value.trim();
  await connectWith(sessionId, role, capability);
}

async function refreshProjection(statusMessage) {
  if (!operationalReady()) return;
  const startingLocaleGeneration = localeCoordinator.currentGeneration;
  const resolvedStatusMessage = statusMessage ?? state.copy.refreshed;
  const connection = state.connection;
  if (connection === undefined) return;
  if (!connectionCapabilityUsable(connection)) {
    throw new SafeRequestFailure(401, "CAPABILITY_EXPIRED");
  }
  if (connection.locale !== state.committedLocale) {
    throw new SafeRequestFailure(502, "PROJECTION_INVALID");
  }
  const projection = await providerPost(
    state.config.projectionUrl,
    { syntheticSessionId: connection.syntheticSessionId },
    connection.capability,
  );
  if (!validProjection(projection, connection.role)) {
    throw new SafeRequestFailure(502, "PROJECTION_INVALID");
  }
  if (
    localeCoordinator.currentGeneration !== startingLocaleGeneration
    || !operationalReady()
    || projection.locale !== connection.locale
    || projection.locale !== state.committedLocale
  ) throw new SafeRequestFailure(502, "PROJECTION_INVALID");
  state.projection = projection;
  renderProjection();
  setStatus(resolvedStatusMessage);
}

function commandId() {
  return `preview-${crypto.randomUUID()}`;
}

async function sendCommand(kind, stale = false) {
  const connection = state.connection;
  const projection = state.projection;
  if (connection === undefined || projection === undefined) return;
  if (!connectionCapabilityUsable(connection)) {
    if (state.localePhase === "READY") {
      setStatus(state.copy.unavailable, "CAPABILITY_EXPIRED");
    } else {
      setLocaleFailure();
    }
    return;
  }
  const safetyStop = (
    kind === "STOP"
    && activeStopPresent()
  );
  if (
    (
      !operationalReady()
      || connection.locale !== state.committedLocale
    )
    && !safetyStop
  ) return;
  const startingLocaleGeneration = localeCoordinator.currentGeneration;
  setBusy(true);
  try {
    const result = await providerPost(
      state.config.commandUrl,
      {
        syntheticSessionId: connection.syntheticSessionId,
        commandId: commandId(),
        expectedStateVersion: stale
          ? Math.max(0, projection.stateVersion - 1)
          : projection.stateVersion,
        authorityGeneration: connection.authorityGeneration,
        issuedAt: new Date().toISOString(),
        command: { kind },
      },
      connection.capability,
    );
    if (stale) throw new SafeRequestFailure(502, "STALE_COMMAND_ACCEPTED");
    if (!validProjection(result, connection.role)) {
      throw new SafeRequestFailure(502, "PROJECTION_INVALID");
    }
    if (
      localeCoordinator.currentGeneration !== startingLocaleGeneration
      || result.locale !== connection.locale
      || (
        !safetyStop
        && (
          !operationalReady()
          || result.locale !== state.committedLocale
        )
      )
    ) throw new SafeRequestFailure(502, "PROJECTION_INVALID");
    state.projection = result;
    if (kind === "STOP") clearConnection({ preserveProjection: true });
    renderProjection();
    if (state.localePhase === "READY") {
      setStatus(state.copy.commandApplied);
    } else {
      setLocaleFailure();
    }
  } catch (error) {
    const denial = error instanceof SafeRequestFailure ? error.denialClass : "REQUEST_DENIED";
    if (state.localePhase !== "READY") {
      setOperationalFailure(state.copy?.unavailable, denial);
    } else if (stale && denial === "STALE_VERSION") {
      setStatus(state.copy.staleRejected, denial);
    } else {
      setStatus(state.copy.unavailable, denial);
    }
  } finally {
    setBusy(false);
  }
}

async function deleteSession() {
  if (!operationalReady()) return;
  const startingLocaleGeneration = localeCoordinator.currentGeneration;
  const sessionId = (
    elements.deleteSessionId.value.trim()
    || state.issued?.syntheticSessionId
    || state.connection?.syntheticSessionId
    || ""
  );
  if (!validSessionId(sessionId)) {
    setStatus(state.copy.invalidInput, "SESSION_ID_INVALID");
    return;
  }
  if (!window.confirm(state.copy.confirmDelete)) return;
  setBusy(true);
  try {
    const result = await sameOriginPost("/api/delete", { syntheticSessionId: sessionId });
    if (result?.terminalStatus !== "DELETED" || result?.audioStatus !== "SILENT") {
      throw new SafeRequestFailure(502, "DELETE_RESPONSE_INVALID");
    }
    if (
      localeCoordinator.currentGeneration !== startingLocaleGeneration
      || !operationalReady()
    ) return;
    clearAllSensitiveState({ preserveProjection: true });
    if (state.projection !== undefined) {
      state.projection = {
        ...state.projection,
        terminalStatus: "STOPPED",
        wait: false,
        helpPending: false,
        adultCard: undefined,
        canRequestHelp: false,
        canResume: false,
        canPause: false,
        canStop: false,
      };
    }
    renderProjection();
    setStatus(state.copy.deleted);
  } catch (error) {
    const denial = error instanceof SafeRequestFailure ? error.denialClass : "REQUEST_DENIED";
    setOperationalFailure(state.copy?.unavailable, denial);
  } finally {
    setBusy(false);
  }
}

async function loadRuntimeConfig() {
  const candidate = await requestJson("/api/runtime-config", { method: "GET" });
  if (
    candidate?.schemaVersion !== "wp13.12b-external-preview-config-v1"
    || candidate.mode !== "EXTERNAL_SYNTHETIC_STAGING"
    || candidate.syntheticOnly !== true
    || candidate.studentBeta !== "NOT_AUTHORIZED"
    || candidate.production !== "NOT_AUTHORIZED"
    || candidate.wp13_12c !== "BLOCKED"
    || !isApprovedProviderUrl(
      candidate.commandUrl,
      approvedPublicFunctionUrls.command,
    )
    || !isApprovedProviderUrl(
      candidate.projectionUrl,
      approvedPublicFunctionUrls.projection,
    )
  ) throw new SafeRequestFailure(503, "RUNTIME_CONFIG_INVALID");
  state.config = Object.freeze({
    commandUrl: candidate.commandUrl,
    projectionUrl: candidate.projectionUrl,
  });
  state.runtimeFailure = undefined;
}

async function activateLocale(locale) {
  const result = await selectLocale(locale);
  if (result.status !== "COMMITTED") return result;
  if (state.config === undefined && state.runtimeFailure === undefined) {
    setStatus(state.copy.loading);
    try {
      await loadRuntimeConfig();
    } catch (error) {
      state.runtimeFailure = error instanceof SafeRequestFailure
        ? error.denialClass
        : "PREVIEW_FAILED_CLOSED";
    }
  }
  if (
    result.generation !== localeCoordinator.currentGeneration
    || !localeReady()
  ) return result;
  if (state.runtimeFailure !== undefined) {
    setStatus(state.copy.unavailable, state.runtimeFailure);
  } else {
    setStatus(state.copy.ready);
  }
  updateControls();
  return result;
}

setLocalePending({ locale: "nb-NO" });

elements.locale.addEventListener("change", async () => {
  await activateLocale(elements.locale.value);
});

elements.issueButton.addEventListener("click", issueSession);
elements.connectButton.addEventListener("click", connectFromFields);
elements.disconnectButton.addEventListener("click", () => {
  if (!operationalReady()) return;
  clearConnection();
  setStatus(state.copy.disconnected);
});
elements.clearIssuedButton.addEventListener("click", () => {
  if (!operationalReady()) return;
  clearIssued();
  setStatus(state.copy.cleared);
});
elements.refreshButton.addEventListener("click", async () => {
  setBusy(true);
  try {
    await refreshProjection();
  } catch (error) {
    const denial = error instanceof SafeRequestFailure ? error.denialClass : "REQUEST_DENIED";
    setOperationalFailure(state.copy?.unavailable, denial);
  } finally {
    setBusy(false);
  }
});
elements.staleButton.addEventListener("click", () => sendCommand("RECONNECT", true));
elements.deleteButton.addEventListener("click", deleteSession);

document.addEventListener("click", async (event) => {
  const target = event.target instanceof Element ? event.target : undefined;
  const command = target?.closest("[data-command]");
  if (command !== null && command !== undefined && !command.disabled) {
    await sendCommand(command.dataset.command);
    return;
  }
  const revealButton = target?.closest("[data-reveal-capability]");
  if (revealButton !== null && revealButton !== undefined) {
    if (!operationalReady()) return;
    const role = revealButton.dataset.revealCapability;
    const input = role === "CHILD"
      ? elements.childCapability
      : elements.adultCapability;
    const capability = input.value;
    if (!validCapability(capability)) {
      setStatus(state.copy.invalidInput, "CAPABILITY_MISSING");
      return;
    }
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    revealButton.setAttribute("aria-pressed", String(reveal));
    setStatus(reveal ? state.copy.capabilityRevealed : state.copy.capabilityHidden);
    return;
  }
  const useButton = target?.closest("[data-use-issued-role]");
  if (
    useButton !== null
    && useButton !== undefined
    && state.issued !== undefined
    && operationalReady()
  ) {
    const role = useButton.dataset.useIssuedRole;
    const capability = role === "CHILD"
      ? state.issued.childCapability
      : state.issued.adultCapability;
    await connectWith(state.issued.syntheticSessionId, role, capability);
  }
});

window.addEventListener("pagehide", () => clearAllSensitiveState());

await activateLocale("nb-NO");
