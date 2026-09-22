import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const releaseDirectory = join(root, "release", "wp13-11");
const core = await import(pathToFileURL(join(root, "dist", "src", "core", "beta-operations.js")));
const controllerModule = await import(pathToFileURL(join(root, "dist", "src", "application", "beta-operations-controller.js")));
const kit = JSON.parse(await readFile(join(releaseDirectory, "operations-kit.json"), "utf8"));
const result = core.validateOperationsKit(kit);
const errors = [...result.errors];

function requireCondition(condition, message) {
  if (!condition) errors.push(message);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

for (const locale of ["nb", "nn"]) {
  const directory = join(releaseDirectory, "artifacts", locale);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const expected = core.OPERATIONS_ARTIFACT_TYPES
    .map((type) => `${type.toLowerCase().replaceAll("_", "-")}.json`)
    .sort();
  requireCondition(sameJson(files, expected), `${locale} artifact file inventory is not exact`);
  for (const file of files) {
    const artifact = JSON.parse(await readFile(join(directory, file), "utf8"));
    const embedded = kit.artifacts.find((item) => item.artifactId === artifact.artifactId);
    requireCondition(embedded !== undefined && sameJson(artifact, embedded), `${locale}/${file} differs from operations-kit.json`);
  }
}

const measurement = JSON.parse(await readFile(join(releaseDirectory, "measurement-dictionary.json"), "utf8"));
const inventory = JSON.parse(await readFile(join(releaseDirectory, "data-inventory.json"), "utf8"));
const sources = JSON.parse(await readFile(join(releaseDirectory, "official-source-register.json"), "utf8"));
const authorization = JSON.parse(await readFile(join(releaseDirectory, "authorization-status.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(releaseDirectory, "component-manifest.json"), "utf8"));
const rollback = JSON.parse(await readFile(join(releaseDirectory, "rollback-register.json"), "utf8"));
const recordedValidation = JSON.parse(await readFile(join(releaseDirectory, "validation.json"), "utf8"));
requireCondition(sameJson(measurement.metrics, kit.metrics), "measurement dictionary differs from kit");
requireCondition(sameJson(measurement.forbiddenMetrics, kit.forbiddenMetrics), "forbidden metric dictionary differs from kit");
requireCondition(sameJson(inventory.entries, kit.dataInventory), "data inventory differs from kit");
requireCondition(sources.sources.length >= 5, "official source register is incomplete");
for (const source of sources.sources) {
  for (const field of ["sourceId", "title", "publisher", "url", "checkedAt", "claimScope", "cannotDecide", "reverificationRequiredBefore"]) {
    requireCondition(source[field] !== undefined && source[field] !== "", `${source.sourceId ?? "source"} is missing ${field}`);
  }
  requireCondition(/^https:\/\//.test(source.url), `${source.sourceId} is not an HTTPS official source`);
  requireCondition(kit.officialSourceIds.includes(source.sourceId), `${source.sourceId} does not resolve from kit`);
}
requireCondition(authorization.externalReceipts === 0, "receipt count is not zero");
requireCondition(authorization.b8 === "NOT_DECISION_READY", "B8 status was opened");
for (const field of [
  "studentBetaAuthorized", "recruitmentAuthorized", "parentContactForParticipationAuthorized",
  "realStudentDataAuthorized", "realParentDataAuthorized", "realTeacherDataAuthorized", "realSchoolDataAuthorized",
  "providerActivation", "productionAuthorized", "runtimeAiPresent", "participantDraftsAuthorized",
  "legalApprovalPresent", "ethicsApprovalPresent", "schoolOwnerDecisionPresent",
]) requireCondition(authorization[field] === false, `${field} must remain false`);
requireCondition(manifest.operationsReleaseId === kit.operationsReleaseId, "component manifest operations revision mismatch");
requireCondition(manifest.appVersion === kit.releaseComponents.appVersion, "component manifest app version mismatch");
requireCondition(rollback.appendOnly === true && rollback.productionRollbackTested === false, "rollback register boundary is invalid");
requireCondition(rollback.revisions.some((revision) => revision.lifecycle === "WITHDRAWN"), "rollback register lacks withdrawn proof revision");
requireCondition(rollback.revisions.some((revision) => revision.compatibility === "INCOMPATIBLE"), "rollback register lacks incompatible proof revision");
requireCondition(sameJson(recordedValidation, result), "validation.json differs from actual validator result");

const exportController = new controllerModule.BetaOperationsController(kit);
exportController.startNewDryRun();
exportController.addFinding("TECHNICAL_OPERATION", "OPS_SAFE", "Knappen beholdt synlig fokus");
const beforeDelete = JSON.parse(exportController.exportLocalReviewPackage());
exportController.deleteDryRunRecords();
const afterDeleteText = exportController.exportLocalReviewPackage();
const afterDelete = JSON.parse(afterDeleteText);
requireCondition(beforeDelete.findings.length === 1, "local export omitted allowed adult-only finding");
requireCondition(afterDelete.findings.length === 0, "deleted record remained in a new export");
requireCondition(afterDelete.dataBoundary.personalData === false && afterDelete.dataBoundary.studentData === false, "export data boundary is unsafe");
requireCondition(afterDelete.authorization.externalReceipts === 0 && afterDelete.authorization.studentBetaAuthorized === false, "export contains a false authorization claim");
requireCondition(afterDeleteText === exportController.exportLocalReviewPackage(), "identical input does not produce deterministic export");

const checksumText = await readFile(join(releaseDirectory, "artifact-checksums.sha256"), "utf8");
const textExtensions = new Set([".json", ".ts", ".mjs", ".html", ".css", ".js"]);
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
  const actual = createHash("sha256").update(canonical).digest("hex");
  if (actual !== match[1]) errors.push(`checksum mismatch: ${match[2]}`);
}

const output = {
  ...result,
  valid: errors.length === 0,
  errors,
  readiness: errors.length === 0 ? "READY_FOR_ADULT_ONLY_DRY_RUN" : "INVALID",
};
if (errors.length > 0) {
  console.error(JSON.stringify(output, null, 2));
  process.exit(1);
}
assert.equal(output.valid, true);
console.log(JSON.stringify(output, null, 2));
