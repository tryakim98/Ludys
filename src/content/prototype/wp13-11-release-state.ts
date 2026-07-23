import { RELEASE_SCHEMA_VERSION, type LocalReleaseState } from "../../core/release-hardening.js";
import { wp13_10LocalReleaseState } from "./wp13-10-release-state.js";

const SHA_C = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const SHA_D = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const SHA_E = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export const wp13_11LocalReleaseState: LocalReleaseState = {
  ...wp13_10LocalReleaseState,
  active: {
    ...wp13_10LocalReleaseState.active,
    appVersion: "0.14.0-reconstructed.8",
    operationsReleaseId: "wp13-11-operations-kit-r1",
  },
  catalog: [
    ...wp13_10LocalReleaseState.catalog,
    { component: "APP", revisionId: "0.14.0-reconstructed.8", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_E },
    { component: "OPERATIONS", revisionId: "wp13-11-operations-kit-r0", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_C },
    { component: "OPERATIONS", revisionId: "wp13-11-operations-kit-r1", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_D },
    { component: "OPERATIONS", revisionId: "wp13-11-operations-kit-withdrawn-proof", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "WITHDRAWN", sha256: SHA_C },
  ],
};
