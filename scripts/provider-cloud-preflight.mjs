import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const decision = await readJson("release/wp13-12a/decision-package/owner-decision.json");
const contract = await readJson("release/wp13-12b/staging-activation/repository-contract.json");
const handoff = await readJson("release/wp13-12b/staging-activation/cloud-preflight.json");
const errors = [];
const warnings = [];

if (basename(repo) !== "ludys-wp13-7a-codex") {
  warnings.push("repository directory name differs from local reconstruction checkout");
}
if (decision.decision !== "APPROVE_RECOMMENDED_SYNTHETIC_DEV") errors.push("owner decision mismatch");
if (decision.selectedRegion !== "europe-north1") errors.push("region mismatch");
if (decision.selectedCapabilityModel !== "FUNCTION_ISSUED_SHORT_LIVED_SESSION_CAPABILITY") errors.push("capability mismatch");
if (contract.providerActivation !== "BLOCKED" || contract.cloudResources !== 0) errors.push("activation ceiling mismatch");
if (contract.firestoreRulesDenyByDefault !== true) errors.push("deny-by-default contract missing");
if (contract.firebaseAuthentication !== false || contract.directClientWrite !== false) errors.push("forbidden client authority enabled");
if (contract.backupAndPitrEnabled !== false) errors.push("backup/PITR must remain disabled");
if (handoff.externalWrites !== 0 || handoff.deploymentAttempted !== false) errors.push("preflight must be non-mutating");
for (const field of handoff.unresolvedOwnerFields ?? []) {
  if (!String(decision[field]).startsWith("UNRESOLVED_")) errors.push(`owner field unexpectedly differs: ${field}`);
  else warnings.push(`${field} must be resolved before provisioning`);
}

const output = {
  valid: errors.length === 0,
  errors,
  warnings,
  mode: "NON_MUTATING_CLOUD_PREFLIGHT",
  externalWrites: 0,
  loginAttempted: false,
  browserLoginOpened: false,
  resourceCreationAttempted: false,
  deploymentAttempted: false,
  providerActivation: "BLOCKED",
  cloudResources: 0,
  externalActivationReady: false,
};
console.log(JSON.stringify(output, null, 2));
if (errors.length > 0) process.exit(1);
