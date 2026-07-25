import { spawnSync } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));

function available(command) {
  const result = spawnSync(process.platform === "win32" ? "where.exe" : "which", [command], {
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0;
}

let verifiedJar = false;
const configuredJar = process.env.LUDYS_FIRESTORE_EMULATOR_JAR;
if (configuredJar) {
  try {
    await access(configuredJar);
    verifiedJar = /^[a-f0-9]{64}$/u.test(process.env.LUDYS_FIRESTORE_EMULATOR_SHA256 ?? "");
  } catch {
    verifiedJar = false;
  }
}

const javaAvailable = available("java");
const firebaseCliAvailable = available("firebase");
const actualProofPossible = javaAvailable && firebaseCliAvailable && verifiedJar;
const artifact = {
  schemaVersion: "wp13.12b-emulator-proof-status-v1",
  status: actualProofPossible
    ? "READY_FOR_EXPLICIT_ACTUAL_EMULATOR_COMMAND"
    : "FIREBASE_EMULATOR_PROOF_BLOCKED_BY_VERIFIED_ARTIFACT_UNAVAILABILITY",
  actualFirebaseEmulatorProof: false,
  emulatorContractProof: true,
  javaAvailable,
  firebaseCliAvailable,
  verifiedFirestoreEmulatorJarAvailable: verifiedJar,
  exactJarFilenameRequired: true,
  publishedSha256Required: true,
  officialSetupCommandDocumented: "firebase setup:emulators:firestore",
  officialJarSha256Located: false,
  offlineImportContract: "release/wp13-12b/activation-handoff/emulator-import-contract.json",
  reason: actualProofPossible
    ? "Verified prerequisites are available, but actual proof has not run."
    : "No local Java/CLI/verified JAR combination exists; official setup material reviewed did not expose a bindable JAR SHA-256.",
  cloudResourcesCreated: 0,
  providerLoginAttempted: false,
  billingChanged: false,
};
const output = join(repo, "artifacts", "wp13-12b-emulator-proof-status.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify(artifact, null, 2));
