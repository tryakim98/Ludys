const localeSpecifications = Object.freeze({
  "nb-NO": Object.freeze({ htmlLang: "nb" }),
  "nn-NO": Object.freeze({ htmlLang: "nn" }),
});

const requiredCopyKeys = Object.freeze([
  "activate",
  "adult",
  "adultRole",
  "audioStatus",
  "boundaryCopy",
  "boundaryTitle",
  "capability",
  "capabilityHidden",
  "capabilityMemoryStatus",
  "capabilityRevealed",
  "child",
  "childRole",
  "clearIssued",
  "cleared",
  "commandApplied",
  "confirmDelete",
  "connect",
  "connectCopy",
  "connected",
  "connectTitle",
  "controlsTitle",
  "deleted",
  "deleteAction",
  "deleteSession",
  "deleteTitle",
  "deviceEyebrow",
  "disconnect",
  "disconnected",
  "expires",
  "help",
  "helpPending",
  "htmlLang",
  "invalidInput",
  "issue",
  "issued",
  "loading",
  "locale",
  "localeLabel",
  "nbLocale",
  "nnLocale",
  "no",
  "none",
  "operatorCopy",
  "operatorEyebrow",
  "operatorTitle",
  "pageTitle",
  "pause",
  "projectionTitle",
  "ready",
  "reconnect",
  "refresh",
  "refreshed",
  "resume",
  "revealAdult",
  "revealChild",
  "role",
  "sessionId",
  "skipLink",
  "stale",
  "staleRejected",
  "stateVersion",
  "stop",
  "terminalCopy",
  "terminalStatus",
  "terminalTitle",
  "transferCopy",
  "transferTitle",
  "unavailable",
  "useAdult",
  "useChild",
  "wait",
  "waitState",
  "yes",
]);

const requiredReviewedDenialClasses = Object.freeze([
  "REQUEST_DENIED",
  "RESPONSE_INVALID",
  "RUNTIME_CONFIG_INVALID",
  "LOCALE_BUNDLE_INVALID",
  "CAPABILITY_MISSING",
  "CAPABILITY_BINDING_INVALID",
  "CAPABILITY_INVALID",
  "CAPABILITY_EXPIRED",
  "SESSION_ID_INVALID",
  "SESSION_BINDING_MISMATCH",
  "SESSION_NOT_FOUND",
  "SESSION_ISSUANCE_DISABLED",
  "PREVIEW_INGRESS_NOT_READY",
  "KILL_SWITCH_ACTIVE",
  "CONTROL_EPOCH_STALE",
  "TOMBSTONE",
  "ROLE_NOT_AUTHORIZED",
  "STALE_STATE_VERSION",
  "STALE_AUTHORITY_GENERATION",
  "COMMAND_BUDGET_EXCEEDED",
  "COMMAND_CONFLICT",
  "DELETE_CONFLICT",
]);

function exactArray(actual, expected) {
  return (
    Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
  );
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateLocaleModule(locale, module) {
  const specification = localeSpecifications[locale];
  if (
    specification === undefined
    || !isRecord(module)
    || !exactArray(Object.keys(module).sort(), ["copy"])
    || !isRecord(module.copy)
    || !Object.isFrozen(module.copy)
  ) throw new Error("LOCALE_BUNDLE_INVALID");

  const copy = module.copy;
  const copyKeys = Object.keys(copy).sort();
  const expectedKeys = [...requiredCopyKeys, "reviewedDenialClasses"].sort();
  if (
    !exactArray(copyKeys, expectedKeys)
    || Object.getOwnPropertySymbols(copy).length !== 0
    || copy.locale !== locale
    || copy.htmlLang !== specification.htmlLang
    || !requiredCopyKeys.every((key) => (
      typeof copy[key] === "string"
      && copy[key].length > 0
      && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(copy[key])
    ))
    || !Object.isFrozen(copy.reviewedDenialClasses)
    || !exactArray(
      copy.reviewedDenialClasses,
      requiredReviewedDenialClasses,
    )
  ) throw new Error("LOCALE_BUNDLE_INVALID");
  return copy;
}

export function createLocaleRequestCoordinator({
  loaders,
  onPending,
  onCommit,
  onFailure,
}) {
  if (
    !isRecord(loaders)
    || typeof onPending !== "function"
    || typeof onCommit !== "function"
    || typeof onFailure !== "function"
  ) throw new Error("LOCALE_COORDINATOR_CONFIGURATION_INVALID");
  let currentGeneration = 0;

  async function request(locale) {
    const generation = currentGeneration + 1;
    currentGeneration = generation;
    onPending(Object.freeze({ generation, locale }));
    try {
      const loader = loaders[locale];
      if (typeof loader !== "function") throw new Error("LOCALE_INVALID");
      const module = await loader(generation);
      if (generation !== currentGeneration) {
        return Object.freeze({ generation, locale, status: "STALE" });
      }
      const copy = validateLocaleModule(locale, module);
      if (generation !== currentGeneration) {
        return Object.freeze({ generation, locale, status: "STALE" });
      }
      onCommit(Object.freeze({ copy, generation, locale }));
      return Object.freeze({ generation, locale, status: "COMMITTED" });
    } catch {
      if (generation !== currentGeneration) {
        return Object.freeze({ generation, locale, status: "STALE" });
      }
      onFailure(Object.freeze({
        denialClass: "LOCALE_BUNDLE_INVALID",
        generation,
        locale,
      }));
      return Object.freeze({
        denialClass: "LOCALE_BUNDLE_INVALID",
        generation,
        locale,
        status: "FAILED",
      });
    }
  }

  return Object.freeze({
    get currentGeneration() {
      return currentGeneration;
    },
    request,
  });
}

export function reviewedDenialClass(value, reviewedDenialClasses) {
  return (
    typeof value === "string"
    && Array.isArray(reviewedDenialClasses)
    && reviewedDenialClasses.includes(value)
  ) ? value : "REQUEST_DENIED";
}
