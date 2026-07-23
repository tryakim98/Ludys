import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const releaseDirectory = join(root, "release", "wp13-12a");
const packageDirectory = join(releaseDirectory, "decision-package");
const core = await import(pathToFileURL(join(root, "dist", "src", "core", "provider-decision.js")));
const content = await import(pathToFileURL(join(root, "dist", "src", "content", "provider-decision", "wp13-12a-decision-package.js")));
const decision = content.wp13_12aProviderDecisionPackage;
const actual = core.validateProviderDecisionPackage(decision);
const errors = [...actual.errors];

function requireCondition(condition, message) {
  if (!condition) errors.push(message);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const requiredFiles = [
  "provider-options.json", "recommended-minimum.json", "region-analysis.json", "capability-options.json",
  "dataflow-and-trust-boundaries.json", "role-model.json", "allowed-and-prohibited-data.json",
  "data-processing-requirements.json", "retention-deletion.json", "logging-observability.json",
  "iam-and-secrets.json", "cost-model.json", "threat-model-delta.json", "migration-exit.json",
  "deployment-runbook.json", "no-go.json", "authorization-status.json", "official-source-register.json",
  "validation.json", "artifact-checksums.sha256", "decision-package-provenance.json",
  "known-limitations.json", "WP13_12A_OWNER_DECISION_TEMPLATE.md",
];
const files = (await readdir(packageDirectory)).sort();
for (const file of requiredFiles) requireCondition(files.includes(file), `missing required decision-package file: ${file}`);

const providerOptions = JSON.parse(await readFile(join(packageDirectory, "provider-options.json"), "utf8"));
const region = JSON.parse(await readFile(join(packageDirectory, "region-analysis.json"), "utf8"));
const capability = JSON.parse(await readFile(join(packageDirectory, "capability-options.json"), "utf8"));
const flow = JSON.parse(await readFile(join(packageDirectory, "dataflow-and-trust-boundaries.json"), "utf8"));
const data = JSON.parse(await readFile(join(packageDirectory, "allowed-and-prohibited-data.json"), "utf8"));
const retention = JSON.parse(await readFile(join(packageDirectory, "retention-deletion.json"), "utf8"));
const logging = JSON.parse(await readFile(join(packageDirectory, "logging-observability.json"), "utf8"));
const iam = JSON.parse(await readFile(join(packageDirectory, "iam-and-secrets.json"), "utf8"));
const cost = JSON.parse(await readFile(join(packageDirectory, "cost-model.json"), "utf8"));
const threats = JSON.parse(await readFile(join(packageDirectory, "threat-model-delta.json"), "utf8"));
const legal = JSON.parse(await readFile(join(packageDirectory, "data-processing-requirements.json"), "utf8"));
const exit = JSON.parse(await readFile(join(packageDirectory, "migration-exit.json"), "utf8"));
const runbook = JSON.parse(await readFile(join(packageDirectory, "deployment-runbook.json"), "utf8"));
const noGo = JSON.parse(await readFile(join(packageDirectory, "no-go.json"), "utf8"));
const authorization = JSON.parse(await readFile(join(packageDirectory, "authorization-status.json"), "utf8"));
const sources = JSON.parse(await readFile(join(packageDirectory, "official-source-register.json"), "utf8"));
const locales = JSON.parse(await readFile(join(packageDirectory, "locale-bundles.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(packageDirectory, "component-manifest.json"), "utf8"));
const rollback = JSON.parse(await readFile(join(packageDirectory, "rollback-register.json"), "utf8"));
const recordedValidation = JSON.parse(await readFile(join(packageDirectory, "validation.json"), "utf8"));
const provenance = JSON.parse(await readFile(join(packageDirectory, "decision-package-provenance.json"), "utf8"));
const template = await readFile(join(packageDirectory, "WP13_12A_OWNER_DECISION_TEMPLATE.md"), "utf8");

requireCondition(sameJson(providerOptions.options, decision.providerOptions), "provider-options.json differs from runtime package");
requireCondition(sameJson(region.rows, decision.regionAnalysis), "region-analysis.json differs from runtime package");
requireCondition(sameJson(capability.options, decision.capabilityOptions), "capability-options.json differs from runtime package");
requireCondition(sameJson(flow.dataflow, decision.dataflow) && sameJson(flow.trustBoundaries, decision.trustBoundaries), "dataflow package differs");
requireCondition(sameJson(data.classes, decision.dataClasses), "data class register differs");
requireCondition(retention.ttlIsImmediateDeletion === false && retention.explicitDeletionDominatesTtl === true, "TTL/deletion contract is unsafe");
requireCondition(logging.requestBodyLogging === false && logging.capabilityLogging === false, "logging boundary is unsafe");
requireCondition(iam.resourcesCreated === 0 && iam.secretsCreated === 0 && iam.broadOwnerRoleAllowedForRuntime === false, "IAM package claims resources or broad runtime role");
requireCondition(cost.rows.every((row) => row.estimateIsGuarantee === false && row.billingAlertIsHardCap === false), "cost model fabricates a guarantee");
requireCondition(sameJson(threats.threats, decision.threats), "threat model differs");
requireCondition(legal.requirements.every((item) => item.status !== "RESOLVED"), "human requirement was falsely resolved");
requireCondition(exit.executed === false && runbook.executedSteps === 0, "exit or future runbook was falsely executed");
requireCondition(sameJson(noGo.entries, decision.noGo), "no-go register differs");
requireCondition(locales.fallback === false && sameJson(locales.bundles, decision.localeBundles), "locale bundles use fallback or differ");
requireCondition(authorization.ownerDecision === "PENDING_OWNER_ACTION", "owner decision is not pending");
requireCondition(authorization.providerActivation === "BLOCKED" && authorization.cloudResources === 0, "provider activation or cloud resource boundary opened");
requireCondition(authorization.firebaseProjectCreated === false && authorization.vercelProjectCreatedByWorkPackage === false, "package falsely claims external creation");
requireCondition(authorization.externalReceipts === 0 && authorization.b8 === "NOT_DECISION_READY", "receipt or B8 boundary opened");
requireCondition(authorization.studentBeta === "NOT_AUTHORIZED" && authorization.production === "NOT_AUTHORIZED", "student or production boundary opened");
requireCondition(sources.sources.length === decision.officialSources.length && sources.sources.every((source) => source.checkedAt === "2026-07-23"), "official source register is incomplete or stale");
requireCondition(manifest.providerDecisionReleaseId === decision.providerDecisionReleaseId && manifest.cloudResources === 0, "component manifest is inconsistent");
requireCondition(rollback.appendOnly === true && rollback.rollbackActivatesProvider === false, "rollback could activate provider");
requireCondition(rollback.revisions.some((revision) => revision.lifecycle === "WITHDRAWN"), "rollback register lacks withdrawn revision");
requireCondition(rollback.revisions.some((revision) => revision.compatibility === "INCOMPATIBLE"), "rollback register lacks incompatible revision");
requireCondition(provenance.baselineCommit === "166e901bcd8f799bec21c5fcafbdbc2deae5e284" && provenance.baselineTree === "805f9eec758f9e52bb308b8e3977b7a261443a51", "provenance baseline mismatch");
requireCondition(provenance.historicalCodeImported === false && provenance.externalCloudWrites === 0, "provenance crosses historical or cloud boundary");
requireCondition(template.includes("PENDING_OWNER_ACTION") && template.includes("CLOUD_RESOURCES: 0"), "owner template boundary missing");
requireCondition(!/\|\s*(APPROVE_RECOMMENDED_SYNTHETIC_DEV|APPROVE_WITH_CONDITIONS|DEFER|REJECT)\s*\|/m.test(template), "owner decision template is pre-filled");
requireCondition(!/(signed by|signert av|signature:\s*\S|produkt[e]?ier:\s*\S)/i.test(template), "owner signature or name was fabricated");
requireCondition(sameJson(recordedValidation, actual), "validation.json differs from actual validator output");

const checksumText = await readFile(join(packageDirectory, "artifact-checksums.sha256"), "utf8");
const textExtensions = new Set([".json", ".ts", ".mjs", ".md", ".html", ".css", ".js"]);
for (const line of checksumText.trim().split("\n")) {
  const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
  if (match === null) {
    errors.push(`invalid checksum line: ${line}`);
    continue;
  }
  const bytes = await readFile(join(root, match[2]));
  const canonical = textExtensions.has(extname(match[2]))
    ? Buffer.from(bytes.toString("utf8").replace(/\r\n?/g, "\n"), "utf8")
    : bytes;
  const digest = createHash("sha256").update(canonical).digest("hex");
  if (digest !== match[1]) errors.push(`checksum mismatch: ${match[2]}`);
}

const output = {
  ...actual,
  valid: errors.length === 0,
  errors,
  packageStatus: errors.length === 0 ? "READY_FOR_OWNER_DECISION" : "INVALID",
};
if (errors.length > 0) {
  console.error(JSON.stringify(output, null, 2));
  process.exit(1);
}
assert.equal(output.valid, true);
console.log(JSON.stringify(output, null, 2));
