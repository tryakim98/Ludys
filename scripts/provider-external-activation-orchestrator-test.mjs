import assert from "node:assert/strict";
import test from "node:test";
import {
  runExternalActivationOrchestrator,
  runExternalActivationOrchestratorForTesting,
} from "./provider-external-activation-orchestrator.mjs";
import { deployIdentityScope } from "./wp13-12b-deploy-identity.mjs";

const sourceCommit = "a".repeat(40);
const sourceTree = "b".repeat(40);
const sourceSha256 = "c".repeat(64);
const previewOrigin =
  "https://ludys-wp13-12b-staging-active-trym-s-projects.vercel.app";
const issueUrl =
  "https://issuesyntheticsession-qbqbamvs6q-lz.a.run.app";

const argv = Object.freeze([
  "--action", "activate",
  "--project", deployIdentityScope.projectId,
  "--google-account", deployIdentityScope.approvedGoogleAccount,
  "--region", deployIdentityScope.region,
  "--impersonate-service-account",
  deployIdentityScope.deployServiceAccount,
  "--window-expires-at", "2026-07-27T12:45:00.000Z",
  "--source-commit", sourceCommit,
  "--source-tree", sourceTree,
  "--source-sha256", sourceSha256,
  "--preview-origin", previewOrigin,
  "--control-epoch", "8",
  "--issue-url", issueUrl,
  "--authorized", deployIdentityScope.activationAuthorization,
]);

function value(args, flag) {
  return args[args.indexOf(flag) + 1];
}

function adapters(events, {
  failOnSeedLocale,
  failLiveAcquisition = false,
  failIdentityAction,
} = {}) {
  let liveAcquisitions = 0;
  return {
    environment: Object.freeze({ TEST_ONLY: "true" }),
    acquirePreviewCapabilityImpl: async () => {
      events.push("gate:preview");
      return Object.freeze({ test: "preview" });
    },
    acquireLiveCapabilityImpl: async () => {
      liveAcquisitions += 1;
      events.push(`gate:live:${liveAcquisitions}`);
      if (failLiveAcquisition) throw new Error("LIVE_GATE_FAILED");
      return Object.freeze({ test: `live-${liveAcquisitions}` });
    },
    runWifImpl: async (args) => {
      const action = value(args, "--action");
      events.push(`wif:${action}`);
      return {
        externalWrites: action === "verify-disabled" ? 0 : 1,
        complete: true,
      };
    },
    runDeployImpl: async (args) => {
      const action = value(args, "--action");
      events.push(`deploy:${action}`);
      return { externalWrites: 1 };
    },
    runControlImpl: async (args) => {
      const enabled = value(args, "--enabled");
      const epoch = value(args, "--control-epoch");
      events.push(`control:${enabled}:${epoch}`);
      return { updated: true };
    },
    runSeedImpl: async (args) => {
      const locale = value(args, "--locale");
      events.push(`seed:${locale}`);
      if (locale === failOnSeedLocale) throw new Error("SEED_FAILED");
      return { seeded: true };
    },
    runIdentityImpl: async (args) => {
      const action = value(args, "--action");
      events.push(`identity:${action}`);
      if (action === failIdentityAction) {
        throw new Error("IDENTITY_STEP_FAILED");
      }
      return {
        externalWrites: 1,
        userManagedKeyCount: 0,
        identitiesDistinct: true,
        impersonationAndDeployBindingsRevoked: action === "revoke",
      };
    },
  };
}

test("single orchestrator performs the exact fail-closed activation order", async () => {
  const events = [];
  const result = await runExternalActivationOrchestratorForTesting(
    argv,
    adapters(events),
  );
  assert.deepEqual(events, [
    "gate:preview",
    "identity:provision",
    "identity:verify",
    "deploy:configure-preview-origin",
    "wif:enable-provider-and-pool",
    "gate:live:1",
    "deploy:activate-session-issuance",
    "gate:live:2",
    "control:true:8",
    "gate:live:3",
    "seed:nb",
    "gate:live:4",
    "seed:nn",
    "identity:revoke",
  ]);
  assert.equal(result.deployIdentityRevoked, true);
  assert.equal(result.realParticipantData, false);
  assert.equal(result.productionAuthorized, false);
});

test("mid-sequence failure compensates and revokes identity in finally", async () => {
  const events = [];
  await assert.rejects(
    () => runExternalActivationOrchestratorForTesting(
      argv,
      adapters(events, { failOnSeedLocale: "nn" }),
    ),
    (error) => {
      assert.equal(error.code, "ACTIVATION_FAILED_AND_COMPENSATED");
      assert.equal(error.details.deployIdentityRevoked, true);
      assert.equal(
        error.details.compensation.every((entry) => entry.completed),
        true,
      );
      return true;
    },
  );
  assert.deepEqual(events.slice(-6), [
    "control:false:9",
    "deploy:deploy-disabled",
    "wif:disable-workload-identity-provider",
    "wif:disable-workload-identity-pool",
    "wif:verify-disabled",
    "identity:revoke",
  ]);
});

test("stale or missing live proof fails before issuance and compensates", async () => {
  const events = [];
  await assert.rejects(
    () => runExternalActivationOrchestratorForTesting(
      argv,
      adapters(events, { failLiveAcquisition: true }),
    ),
    /ACTIVATION_FAILED_AND_COMPENSATED/u,
  );
  assert.equal(events.includes("deploy:activate-session-issuance"), false);
  assert.equal(events.includes("control:false:9"), true);
  assert.equal(events.at(-1), "identity:revoke");
});

for (const failedAction of ["provision", "verify"]) {
  test(`failure at deploy identity ${failedAction} compensates before authority increase`, async () => {
    const events = [];
    await assert.rejects(
      () => runExternalActivationOrchestratorForTesting(
        argv,
        adapters(events, { failIdentityAction: failedAction }),
      ),
      /ACTIVATION_FAILED_AND_COMPENSATED/u,
    );
    assert.equal(events.includes("deploy:configure-preview-origin"), false);
    assert.equal(events.includes("control:false:9"), true);
    assert.equal(events.at(-1), "identity:revoke");
  });
}

test("production orchestrator rejects partial adapter injection", () => {
  assert.throws(
    () => runExternalActivationOrchestrator(argv, {
      runWifImpl: async () => ({}),
    }),
    /PRODUCTION_ACTIVATION_ORCHESTRATOR_INJECTION_FORBIDDEN/u,
  );
});

test("activation epoch reserves one safe integer for compensation", async () => {
  const events = [];
  const maximumEpoch = [...argv];
  maximumEpoch[maximumEpoch.indexOf("--control-epoch") + 1] = String(
    Number.MAX_SAFE_INTEGER,
  );
  await assert.rejects(
    () => runExternalActivationOrchestratorForTesting(
      maximumEpoch,
      adapters(events),
    ),
    /ACTIVATION_CONTROL_EPOCH_INVALID/u,
  );
  assert.deepEqual(events, []);
});
