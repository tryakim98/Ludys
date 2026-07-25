import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const statusPath = fileURLToPath(
  new URL("../artifacts/wp13-12b-emulator-proof-status.json", import.meta.url),
);
const status = JSON.parse(await readFile(statusPath, "utf8"));
if (status.status !== "READY_FOR_EXPLICIT_ACTUAL_EMULATOR_COMMAND") {
  process.stderr.write("FIREBASE_EMULATOR_PROOF_BLOCKED_BY_VERIFIED_ARTIFACT_UNAVAILABILITY\n");
  process.exit(1);
}
if (!process.argv.includes("--authorized-local-emulator-proof")) {
  process.stderr.write("EXPLICIT_LOCAL_EMULATOR_PROOF_AUTHORIZATION_FLAG_REQUIRED\n");
  process.exit(1);
}
process.stderr.write(
  "VERIFIED_ARTIFACT_PRESENT_BUT_ACTUAL_FIREBASE_EMULATOR_INTEGRATION_RUNNER_NOT_YET_PROVEN\n",
);
process.exit(1);
