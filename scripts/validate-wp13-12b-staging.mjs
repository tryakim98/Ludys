import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateOwnerDecisionForWp13_12b,
  validateReceipt,
  validateStagingRepositoryContract,
} from "../dist/src/core/staging-validation.js";

const repo = fileURLToPath(new URL("..", import.meta.url));
const release = join(repo, "release", "wp13-12b");
const errors = [];
const warnings = [];

async function json(path) {
  return JSON.parse(await readFile(join(repo, path), "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else files.push(path);
  }
  return files;
}

const ownerDecisionPath = "release/wp13-12a/decision-package/owner-decision.json";
const ownerDecisionBytes = await readFile(join(repo, ownerDecisionPath));
const ownerDecision = JSON.parse(ownerDecisionBytes);
const authorization = await json("release/wp13-12a/decision-package/authorization-status.json");
const sourceChecksumBytes = execFileSync("git", [
  "-c",
  `safe.directory=${repo.replaceAll("\\", "/")}`,
  "show",
  "929674d8a159ebd9ac6026c066f5dd044ebcea62:release/wp13-12a/decision-package/artifact-checksums.sha256",
], { cwd: repo });
const checksumManifest = await readFile(
  join(repo, "release/wp13-12a/decision-package/artifact-checksums.sha256"),
  "utf8",
);
const manifestDecisionChecksum = checksumManifest
  .split(/\r?\n/u)
  .find((line) => line.endsWith(`  ${ownerDecisionPath}`))
  ?.split(/\s+/u)[0] ?? "";

errors.push(...validateOwnerDecisionForWp13_12b({
  ownerDecision,
  authorization,
  actualSourcePackageChecksum: sha256(sourceChecksumBytes),
  actualDecisionRecordChecksum: sha256(ownerDecisionBytes),
  checksumManifestDecisionRecordChecksum: manifestDecisionChecksum,
}));

const contract = await json("release/wp13-12b/staging-activation/repository-contract.json");
errors.push(...validateStagingRepositoryContract(contract));

const requiredFiles = [
  "docs/WP13_12B_SYNTHETIC_STAGING_REPOSITORY_AND_ACTIVATION_HANDOFF.md",
  "release/wp13-12b/validation.json",
  "release/wp13-12b/authorization-status.json",
  "release/wp13-12b/provider-audit.json",
  "release/wp13-12b/provider-sbom.cdx.json",
  "release/wp13-12b/provider-license-inventory.json",
  "release/wp13-12b/reproducible-build.json",
  "release/wp13-12b/known-limitations.json",
  "release/wp13-12b/artifact-checksums.sha256",
  "release/wp13-12b/staging-provenance.json",
  "release/wp13-12b/activation-handoff/operator-tasks.json",
  "release/wp13-12b/activation-handoff/receipt-contracts.json",
  "release/wp13-12b/activation-handoff/emulator-import-contract.json",
  "release/wp13-12b/staging-activation/cloud-preflight.json",
  "release/wp13-12b/activation-handoff/physical-two-device-proof-template.json",
  "release/wp13-12b/activation-handoff/rollback-plan.json",
  "release/wp13-12b/activation-handoff/destruction-plan.json",
  "release/wp13-12b/activation-handoff/iam-and-secrets-plan.json",
  "provider/firebase/firebase.json",
  "provider/firebase/.firebaserc.example",
  "provider/firebase/firestore.rules",
  "provider/firebase/firestore.indexes.json",
  "provider/firebase/staging.env.example",
  "provider/firebase/functions/index.mjs",
  "provider/firebase/functions/package.json",
  "provider/firebase/functions/package-lock.json",
  "provider/firebase/functions/src/authoritative-handler.ts",
  "provider/firebase/tools/seed-synthetic-fixtures.mjs",
  "provider/firebase/tools/set-staging-control.mjs",
  "scripts/validate-wp13-12b-receipt.mjs",
  "scripts/run-wp13-12b-emulator-proof.mjs",
  "artifacts/wp13-12b-reproducible-build-result.json",
  "web/staging-preview.html",
  "web/staging-runtime-config.json",
];
const allFiles = new Set((await collect(repo)).map((path) => relative(repo, path).replaceAll("\\", "/")));
for (const required of requiredFiles) {
  if (!allFiles.has(required)) errors.push(`missing required file: ${required}`);
}

const rootPackage = await json("package.json");
if (rootPackage.dependencies !== undefined && Object.keys(rootPackage.dependencies).length > 0) {
  errors.push("root runtimeDependencies must remain zero");
}
const providerPackage = await json("provider/firebase/functions/package.json");
if (
  providerPackage.dependencies?.["@google-cloud/functions-framework"] !== "5.0.5"
  || Object.keys(providerPackage.dependencies ?? {}).length !== 1
) errors.push("provider dependency pin or narrow runtime boundary mismatch");

const rules = await readFile(join(repo, "provider/firebase/firestore.rules"), "utf8");
if (!/allow read, write: if false;/u.test(rules)) errors.push("Firestore Rules must deny all direct access");
if (/allow\s+(?:read|write).*if\s+true/iu.test(rules)) errors.push("Firestore Rules contain an allow-all rule");

for (const file of await collect(join(repo, "src/core"))) {
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/gu)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) errors.push(`pure core external import: ${relative(repo, file)}`);
    if (/provider|firebase|@google-cloud/iu.test(specifier)) {
      errors.push(`pure core contains provider import: ${relative(repo, file)}`);
    }
  }
}

const browserSurface = [
  await readFile(join(repo, "src/ui/browser/staging-preview.ts"), "utf8"),
  await readFile(join(repo, "web/staging-preview.html"), "utf8"),
  await readFile(join(repo, "web/staging-runtime-config.json"), "utf8"),
].join("\n");
for (const forbidden of [
  "LUDYS_CAPABILITY_HMAC_KEY",
  "firebase-admin",
  "firebase-functions",
  "localStorage",
  "indexedDB",
]) {
  if (browserSurface.includes(forbidden)) errors.push(`browser surface contains forbidden value: ${forbidden}`);
}

const providerSources = (await collect(join(repo, "provider/firebase")))
  .filter((path) => {
    const providerRelative = relative(join(repo, "provider/firebase"), path).replaceAll("\\", "/");
    return !providerRelative.startsWith("functions/node_modules/")
      && !providerRelative.startsWith("functions/lib/")
      && !providerRelative.startsWith(".emulator-cache/");
  });
const providerText = (await Promise.all(providerSources
  .filter((path) => /\.(?:ts|mjs|json|rules|example)$/u.test(path))
  .map((path) => readFile(path, "utf8")))).join("\n");
for (const forbiddenFeature of [
  "firebase/auth",
  "getAuth(",
  "analytics",
  "crashlytics",
  "performance monitoring",
  "remote config",
  "cloud storage",
]) {
  if (providerText.toLowerCase().includes(forbiddenFeature.toLowerCase())) {
    errors.push(`forbidden provider feature found: ${forbiddenFeature}`);
  }
}
const providerRuntimeText = (await Promise.all([
  join(repo, "provider/firebase/functions/index.mjs"),
  join(repo, "provider/firebase/functions/firestore-store.mjs"),
  ...await collect(join(repo, "provider/firebase/functions/src")),
].map((path) => readFile(path, "utf8")))).join("\n");
if (/console\.(?:log|info|warn|error)\s*\(/u.test(providerRuntimeText)) {
  errors.push("provider runtime source contains application log call");
}

const receiptTemplateDirectory = join(release, "receipts", "templates");
const receiptTemplateFiles = (await readdir(receiptTemplateDirectory))
  .filter((name) => name.endsWith(".json"));
if (receiptTemplateFiles.length !== 5) errors.push("exactly five receipt templates are required");
for (const name of receiptTemplateFiles) {
  const result = validateReceipt(JSON.parse(await readFile(join(receiptTemplateDirectory, name), "utf8")));
  if (!result.valid || result.evidence) errors.push(`receipt template treated as evidence: ${name}`);
}

const physical = await json("release/wp13-12b/activation-handoff/physical-two-device-proof-template.json");
if (physical.performed !== false || physical.status !== "UNFILLED_TEMPLATE_NOT_EVIDENCE") {
  errors.push("physical proof template must remain unperformed");
}
const localeBundles = await json("release/wp13-12b/staging-activation/locale-bundles.json");
if (
  localeBundles.fallbackAllowed !== false
  || localeBundles.bundles?.map((item) => item.locale).join(",") !== "nb,nn"
) errors.push("BM and NN must be first-class without fallback");

const auth12b = await json("release/wp13-12b/authorization-status.json");
for (const [field, expected] of Object.entries({
  providerActivation: "BLOCKED",
  cloudResources: 0,
  externalReceipts: 0,
  physicalTwoDeviceProof: false,
  b8: "NOT_DECISION_READY",
  studentBeta: "NOT_AUTHORIZED",
  production: "NOT_AUTHORIZED",
  wp13_12c: "BLOCKED",
})) {
  if (auth12b[field] !== expected) errors.push(`authorization ceiling mismatch: ${field}`);
}

const checksumLines = (await readFile(join(release, "artifact-checksums.sha256"), "utf8"))
  .trim().split(/\r?\n/u);
for (const line of checksumLines) {
  const match = /^([a-f0-9]{64})  (.+)$/u.exec(line);
  if (match === null) {
    errors.push(`invalid checksum line: ${line}`);
    continue;
  }
  const path = match[2];
  if (!allFiles.has(path)) {
    errors.push(`checksummed file missing: ${path}`);
    continue;
  }
  const actual = sha256(await readFile(join(repo, path)));
  if (actual !== match[1]) errors.push(`checksum mismatch: ${path}`);
}

for (const field of [
  "monthlyAlertThreshold",
  "maximumMonthlyCost",
  "killSwitchOwner",
  "billingReviewer",
  "stagingExpiryDate",
  "automaticDeletionPolicy",
]) {
  if (String(ownerDecision[field]).startsWith("UNRESOLVED_")) {
    warnings.push(`${field} unresolved; external activation remains blocked`);
  }
}

const result = {
  valid: errors.length === 0,
  errors,
  warnings,
  repositoryImplementation: errors.length === 0 ? "READY" : "BLOCKED",
  ownerDecision: ownerDecision.decision,
  providerActivation: "BLOCKED",
  cloudResources: 0,
  emulatorProof: "NOT_COMPLETED_OR_EXPLICITLY_CLASSIFIED",
  physicalTwoDeviceProof: false,
  externalReceipts: 0,
  wp13_12c: "BLOCKED",
};
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exit(1);
