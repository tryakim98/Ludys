import { RELEASE_SCHEMA_VERSION, type LocalReleaseState } from "../../core/release-hardening.js";
import { wp13_11LocalReleaseState } from "./wp13-11-release-state.js";

const SHA_C = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const SHA_D = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const SHA_E = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export const wp13_12aLocalReleaseState: LocalReleaseState = {
  ...wp13_11LocalReleaseState,
  active: {
    ...wp13_11LocalReleaseState.active,
    appVersion: "0.14.0-reconstructed.9",
    providerDecisionReleaseId: "wp13-12a-provider-decision-r1",
  },
  catalog: [
    ...wp13_11LocalReleaseState.catalog,
    { component: "APP", revisionId: "0.14.0-reconstructed.9", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_E },
    { component: "PROVIDER_DECISION", revisionId: "wp13-12a-provider-decision-r0", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_C },
    { component: "PROVIDER_DECISION", revisionId: "wp13-12a-provider-decision-r1", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_D },
    { component: "PROVIDER_DECISION", revisionId: "wp13-12a-provider-decision-withdrawn-proof", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "WITHDRAWN", sha256: SHA_C },
  ],
};
