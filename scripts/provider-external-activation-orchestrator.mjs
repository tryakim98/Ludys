import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deactivationAuthorization,
  EXTERNAL_ACTIVATION_AUTHORIZATION,
  safeOperatorErrorCode,
} from "../provider/firebase/tools/operator-gate-contract.mjs";
import {
  runStagingControl,
} from "../provider/firebase/tools/set-staging-control.mjs";
import {
  runSyntheticFixtureSeed,
} from "../provider/firebase/tools/seed-synthetic-fixtures.mjs";
import {
  runDeployIdentityControl,
} from "./provider-external-deploy-identity-control.mjs";
import {
  runExternalDeploy,
} from "./provider-external-function-deploy.mjs";
import {
  acquireLiveActivationCapability,
  acquirePreviewReadyActivationCapability,
} from "./wp13-12b-activation-phase-gate.mjs";
import {
  deployIdentityScope,
} from "./wp13-12b-deploy-identity.mjs";
import {
  assertNoDangerousExternalEnvironment,
  sanitizedNodeChildEnvironment,
} from "./wp13-12b-external-process-boundary.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const ACTION = "activate";
const FLAGS = Object.freeze([
  "--action",
  "--project",
  "--google-account",
  "--region",
  "--impersonate-service-account",
  "--window-expires-at",
  "--source-commit",
  "--source-tree",
  "--source-sha256",
  "--preview-origin",
  "--control-epoch",
  "--issue-url",
  "--authorized",
]);

function activationError(code, details) {
  const error = new Error(code);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function parseExactFlagPairs(argv) {
  if (!Array.isArray(argv) || argv.length !== FLAGS.length * 2) {
    throw activationError("EXACT_ACTIVATION_ORCHESTRATOR_FLAGS_REQUIRED");
  }
  const allowed = new Set(FLAGS);
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !allowed.has(flag)
      || typeof value !== "string"
      || value.length === 0
      || parsed.has(flag)
    ) throw activationError("EXACT_ACTIVATION_ORCHESTRATOR_FLAGS_REQUIRED");
    parsed.set(flag, value);
  }
  if (FLAGS.some((flag) => !parsed.has(flag))) {
    throw activationError("EXACT_ACTIVATION_ORCHESTRATOR_FLAGS_REQUIRED");
  }
  return parsed;
}

function assertScope(args) {
  if (
    args.get("--action") !== ACTION
    || args.get("--project") !== deployIdentityScope.projectId
    || args.get("--google-account")
      !== deployIdentityScope.approvedGoogleAccount
    || args.get("--region") !== deployIdentityScope.region
    || args.get("--impersonate-service-account")
      !== deployIdentityScope.deployServiceAccount
    || args.get("--authorized") !== EXTERNAL_ACTIVATION_AUTHORIZATION
    || !/^[a-f0-9]{40}$/u.test(args.get("--source-commit"))
    || !/^[a-f0-9]{40}$/u.test(args.get("--source-tree"))
    || !/^[a-f0-9]{64}$/u.test(args.get("--source-sha256"))
  ) throw activationError("ACTIVATION_ORCHESTRATOR_SCOPE_MISMATCH");
  const epochText = args.get("--control-epoch");
  if (
    !/^[1-9][0-9]*$/u.test(epochText)
    || !Number.isSafeInteger(Number(epochText))
    || Number(epochText) > Number.MAX_SAFE_INTEGER - 1
  ) throw activationError("ACTIVATION_CONTROL_EPOCH_INVALID");
}

function defaultRunWif(argv, {
  environment = process.env,
} = {}) {
  let childEnvironment;
  try {
    childEnvironment = sanitizedNodeChildEnvironment(environment, {
      preserveKeys: [
        "LUDYS_AUTHENTICATED_BROWSER_PROOF_PATH",
        "LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH",
      ],
    });
  } catch {
    throw activationError(
      "ACTIVATION_CHILD_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  let output;
  try {
    output = String(execFileSync(process.execPath, [
      resolve(repo, "scripts", "provider-external-wif-control.mjs"),
      ...argv,
    ], {
      cwd: repo,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnvironment,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    })).trim();
  } catch {
    throw activationError("WIF_TRANSITION_FAILED");
  }
  try {
    return JSON.parse(output);
  } catch {
    throw activationError("WIF_TRANSITION_READBACK_INVALID");
  }
}

function wifForwardArgs(action) {
  return [
    "--action", action,
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--authorized", EXTERNAL_ACTIVATION_AUTHORIZATION,
  ];
}

function deployArgs(args, action, {
  previewOrigin = false,
} = {}) {
  return [
    "--action", action,
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--impersonate-service-account",
    deployIdentityScope.deployServiceAccount,
    "--window-expires-at", args.get("--window-expires-at"),
    "--source-commit", args.get("--source-commit"),
    "--source-tree", args.get("--source-tree"),
    "--source-sha256", args.get("--source-sha256"),
    ...(previewOrigin
      ? ["--preview-origin", args.get("--preview-origin")]
      : []),
    "--authorized", EXTERNAL_ACTIVATION_AUTHORIZATION,
  ];
}

function controlArgs(args, enabled, epoch) {
  const scope = {
    projectId: deployIdentityScope.projectId,
    stagingExpiryDate: deployIdentityScope.stagingExpiryDate,
  };
  return [
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--enabled", enabled ? "true" : "false",
    "--control-epoch", String(epoch),
    "--reason", enabled
      ? "EXPLICIT_SYNTHETIC_PROOF_WINDOW"
      : "SECURITY_KILL_SWITCH",
    "--authorized", enabled
      ? EXTERNAL_ACTIVATION_AUTHORIZATION
      : deactivationAuthorization(scope),
  ];
}

function seedArgs(args, locale) {
  return [
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--issue-url", args.get("--issue-url"),
    "--fixture", "synthetic-wp13-12b-only",
    "--locale", locale,
    "--authorized", EXTERNAL_ACTIVATION_AUTHORIZATION,
  ];
}

function identityArgs(args, action) {
  return [
    "--action", action,
    "--project", deployIdentityScope.projectId,
    "--google-account", deployIdentityScope.approvedGoogleAccount,
    "--region", deployIdentityScope.region,
    "--window-expires-at", args.get("--window-expires-at"),
    ...(action === "provision" || action === "revoke"
      ? ["--authorized", EXTERNAL_ACTIVATION_AUTHORIZATION]
      : []),
  ];
}

function safeFailureCode(error) {
  return safeOperatorErrorCode(error);
}

async function runExternalActivationOrchestratorCore(argv, {
  environment = process.env,
  acquirePreviewCapabilityImpl =
    acquirePreviewReadyActivationCapability,
  acquireLiveCapabilityImpl = acquireLiveActivationCapability,
  runWifImpl = defaultRunWif,
  runDeployImpl = runExternalDeploy,
  runControlImpl = runStagingControl,
  runSeedImpl = runSyntheticFixtureSeed,
  runIdentityImpl = runDeployIdentityControl,
} = {}) {
  const args = parseExactFlagPairs(argv);
  assertScope(args);
  const requestedEpoch = Number(args.get("--control-epoch"));
  const steps = [];
  const compensation = [];
  let primaryError;
  let identityRevoked = false;
  let success = false;
  let previewCapability;

  const record = (name, result) => {
    steps.push(Object.freeze({
      name,
      completed: true,
      externalWrites: Number(result?.externalWrites ?? 0),
    }));
    return result;
  };
  const attemptCompensation = async (name, execute) => {
    try {
      const result = await execute();
      compensation.push(Object.freeze({
        name,
        completed: true,
        externalWrites: Number(result?.externalWrites ?? 0),
      }));
      return result;
    } catch (error) {
      compensation.push(Object.freeze({
        name,
        completed: false,
        errorCode: safeFailureCode(error),
      }));
      return undefined;
    }
  };

  try {
    previewCapability = await acquirePreviewCapabilityImpl();
    steps.push(Object.freeze({
      name: "PREVIEW_READY_PROOF_GATE",
      completed: true,
      externalWrites: 0,
    }));
    record(
      "PROVISION_DEPLOY_IDENTITY",
      await runIdentityImpl(
        identityArgs(args, "provision"),
        { activationCapability: previewCapability },
      ),
    );
    const identityVerification =
      await runIdentityImpl(identityArgs(args, "verify"));
    if (
      identityVerification?.userManagedKeyCount !== 0
      || identityVerification?.identitiesDistinct !== true
    ) throw activationError("DEPLOY_IDENTITY_VERIFICATION_REQUIRED");
    record("VERIFY_DEPLOY_IDENTITY", identityVerification);
    record(
      "CONFIGURE_EXACT_PREVIEW_ORIGIN",
      await runDeployImpl(
        deployArgs(args, "configure-preview-origin", {
          previewOrigin: true,
        }),
        { activationCapability: previewCapability },
      ),
    );
    record(
      "ENABLE_WIF_PROVIDER_AND_POOL_ATOMIC",
      await runWifImpl(
        wifForwardArgs("enable-provider-and-pool"),
        { environment },
      ),
    );

    let liveCapability = await acquireLiveCapabilityImpl();
    record(
      "ACTIVATE_SESSION_ISSUANCE",
      await runDeployImpl(
        deployArgs(args, "activate-session-issuance", {
          previewOrigin: true,
        }),
        { activationCapability: liveCapability },
      ),
    );
    liveCapability = await acquireLiveCapabilityImpl();
    record(
      "ENABLE_STAGING_CONTROL",
      await runControlImpl(
        controlArgs(args, true, requestedEpoch),
        { activationCapability: liveCapability },
      ),
    );
    for (const locale of ["nb", "nn"]) {
      liveCapability = await acquireLiveCapabilityImpl();
      record(
        `SEED_${locale.toUpperCase()}_SYNTHETIC_FIXTURE`,
        await runSeedImpl(
          seedArgs(args, locale),
          { activationCapability: liveCapability },
        ),
      );
    }
    const revokeResult =
      await runIdentityImpl(identityArgs(args, "revoke"));
    if (
      revokeResult?.impersonationAndDeployBindingsRevoked !== true
    ) throw activationError("DEPLOY_IDENTITY_REVOKE_VERIFICATION_REQUIRED");
    record("REVOKE_DEPLOY_IDENTITY", revokeResult);
    identityRevoked = true;
    success = true;
  } catch (error) {
    primaryError = error;
  }

  if (!success) {
    await attemptCompensation(
      "DISABLE_STAGING_CONTROL_ADVANCED_EPOCH",
      () => runControlImpl(
        controlArgs(args, false, requestedEpoch + 1),
      ),
    );
    await attemptCompensation(
      "DEPLOY_SAFE_DISABLED_BACKEND",
      () => runDeployImpl(
        deployArgs(args, "deploy-disabled"),
        previewCapability === undefined
          ? {}
          : { activationCapability: previewCapability },
      ),
    );
    await attemptCompensation(
      "DISABLE_WIF_PROVIDER",
      () => runWifImpl(
        ["--action", "disable-workload-identity-provider"],
        { environment },
      ),
    );
    await attemptCompensation(
      "DISABLE_WIF_POOL",
      () => runWifImpl(
        ["--action", "disable-workload-identity-pool"],
        { environment },
      ),
    );
    await attemptCompensation(
      "VERIFY_WIF_DISABLED",
      () => runWifImpl(
        ["--action", "verify-disabled"],
        { environment },
      ),
    );
  }

  if (!identityRevoked) {
    const revoked = await attemptCompensation(
      "REVOKE_DEPLOY_IDENTITY_FINALLY",
      () => runIdentityImpl(identityArgs(args, "revoke")),
    );
    identityRevoked = revoked?.impersonationAndDeployBindingsRevoked === true;
  }

  if (!success || !identityRevoked) {
    const failedCompensation = compensation.filter(
      (entry) => entry.completed !== true,
    );
    throw activationError(
      failedCompensation.length === 0 && identityRevoked
        ? "ACTIVATION_FAILED_AND_COMPENSATED"
        : "ACTIVATION_FAILED_COMPENSATION_INCOMPLETE",
      Object.freeze({
        primaryErrorCode: safeFailureCode(primaryError),
        steps: Object.freeze(steps),
        compensation: Object.freeze(compensation),
        deployIdentityRevoked: identityRevoked,
      }),
    );
  }

  return Object.freeze({
    schemaVersion: "wp13.12b-ea-activation-orchestrator-v1",
    action: ACTION,
    status: "EXTERNAL_SYNTHETIC_STAGING_ACTIVATED",
    projectId: deployIdentityScope.projectId,
    region: deployIdentityScope.region,
    sourceCommit: args.get("--source-commit"),
    sourceTree: args.get("--source-tree"),
    protectedPreviewOrigin: args.get("--preview-origin"),
    controlEpoch: requestedEpoch,
    steps: Object.freeze(steps),
    compensation: Object.freeze(compensation),
    deployIdentityRevoked: true,
    realParticipantData: false,
    stableParticipantIdentity: false,
    productionAuthorized: false,
    capabilityOrCredentialPrinted: false,
  });
}

export function runExternalActivationOrchestrator(argv, options = {}) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).length !== 0
  ) {
    throw activationError(
      "PRODUCTION_ACTIVATION_ORCHESTRATOR_INJECTION_FORBIDDEN",
    );
  }
  try {
    assertNoDangerousExternalEnvironment(process.env);
  } catch {
    throw activationError(
      "ACTIVATION_PROCESS_ENVIRONMENT_OVERRIDE_FORBIDDEN",
    );
  }
  const environment = sanitizedNodeChildEnvironment(process.env, {
    preserveKeys: [
      "LUDYS_AUTHENTICATED_BROWSER_PROOF_PATH",
      "LUDYS_PROTECTED_PREVIEW_RECEIPT_PATH",
    ],
  });
  return runExternalActivationOrchestratorCore(argv, { environment });
}

export function runExternalActivationOrchestratorForTesting(
  argv,
  options = {},
) {
  const requiredTestAdapters = [
    "environment",
    "acquirePreviewCapabilityImpl",
    "acquireLiveCapabilityImpl",
    "runWifImpl",
    "runDeployImpl",
    "runControlImpl",
    "runSeedImpl",
    "runIdentityImpl",
  ];
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || requiredTestAdapters.some((name) => !(name in options))
  ) throw activationError("COMPLETE_TEST_ONLY_ORCHESTRATOR_ADAPTERS_REQUIRED");
  return runExternalActivationOrchestratorCore(argv, options);
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && resolve(invokedPath) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await runExternalActivationOrchestrator(
      process.argv.slice(2),
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${safeFailureCode(error)}\n`);
    process.exitCode = 1;
  }
}
