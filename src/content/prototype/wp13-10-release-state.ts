import {
  RELEASE_SCHEMA_VERSION,
  type LocalReleaseState,
} from "../../core/release-hardening.js";

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

export const wp13_10LocalReleaseState: LocalReleaseState = {
  active: {
    appVersion: "0.14.0-reconstructed.7",
    contentReleaseId: "wp13-8-authentic-draft-corpus-r1",
    knowledgeReleaseId: "release-knowledge-audio-prototype-001",
    audioReleaseId: "wp13-9-audio-specifications-r1",
    operationsReleaseId: "wp13-10-operations-not-present",
    schemaVersion: RELEASE_SCHEMA_VERSION,
  },
  catalog: [
    { component: "APP", revisionId: "0.14.0-reconstructed.6", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_A },
    { component: "APP", revisionId: "0.14.0-reconstructed.7", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_B },
    { component: "CONTENT", revisionId: "wp13-8-authentic-draft-corpus-r0", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_A },
    { component: "CONTENT", revisionId: "wp13-8-authentic-draft-corpus-r1", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_B },
    { component: "CONTENT", revisionId: "wp13-8-withdrawn-content-proof", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "WITHDRAWN", sha256: SHA_A },
    { component: "KNOWLEDGE", revisionId: "release-knowledge-audio-prototype-000", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_A },
    { component: "KNOWLEDGE", revisionId: "release-knowledge-audio-prototype-001", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_B },
    { component: "AUDIO", revisionId: "TEXT_AND_SILENCE", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_A },
    { component: "AUDIO", revisionId: "wp13-9-audio-specifications-r1", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_B },
    { component: "AUDIO", revisionId: "wp13-9-withdrawn-audio-proof", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "WITHDRAWN", sha256: SHA_A },
    { component: "OPERATIONS", revisionId: "wp13-10-operations-not-present", schemaVersion: RELEASE_SCHEMA_VERSION, lifecycle: "AVAILABLE", sha256: SHA_A },
  ],
  history: [],
  productionDeploymentAuthorized: false,
  externalReceipts: 0,
};
