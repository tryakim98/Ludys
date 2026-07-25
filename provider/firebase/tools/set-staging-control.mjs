import { execFileSync } from "node:child_process";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const project = args.get("--project") ?? "";
const enabledText = args.get("--enabled");
const epoch = Number(args.get("--control-epoch"));
const reason = args.get("--reason") ?? "";
if (args.get("--authorized") !== "WP13_12B_OPERATOR_AUTHORIZED") {
  throw new Error("EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED");
}
if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(project)) throw new Error("APPROVED_PROJECT_ID_REQUIRED");
if (enabledText !== "true" && enabledText !== "false") throw new Error("EXPLICIT_ENABLED_STATE_REQUIRED");
if (!Number.isSafeInteger(epoch) || epoch < 1) throw new Error("MONOTONIC_CONTROL_EPOCH_REQUIRED");
if (!/^[A-Z0-9_]{3,80}$/u.test(reason)) throw new Error("COARSE_REASON_CODE_REQUIRED");

const accessToken = execFileSync(
  "gcloud",
  ["auth", "print-access-token", `--project=${project}`],
  { encoding: "utf8", windowsHide: true },
).trim();
const currentUrl = [
  `https://firestore.googleapis.com/v1/projects/${project}`,
  "/databases/(default)/documents/syntheticStagingControl/current",
].join("");
const currentResponse = await fetch(currentUrl, {
  headers: { authorization: `Bearer ${accessToken}` },
});
if (!currentResponse.ok && currentResponse.status !== 404) {
  throw new Error(`STAGING_CONTROL_READ_DENIED_${currentResponse.status}`);
}
const currentDocument = currentResponse.status === 404 ? undefined : await currentResponse.json();
const currentEpoch = Number(currentDocument?.fields?.controlEpoch?.integerValue ?? 1);
if (!Number.isSafeInteger(currentEpoch) || epoch <= currentEpoch) {
  throw new Error("CONTROL_EPOCH_MUST_STRICTLY_INCREASE");
}
const documentUrl = [
  `https://firestore.googleapis.com/v1/projects/${project}`,
  "databases/(default)/documents/syntheticStagingControl/current",
  "?updateMask.fieldPaths=controlEpoch",
  "&updateMask.fieldPaths=stagingEnabled",
  "&updateMask.fieldPaths=reasonCode",
  "&updateMask.fieldPaths=changedAt",
  currentDocument
    ? `&currentDocument.updateTime=${encodeURIComponent(currentDocument.updateTime)}`
    : "&currentDocument.exists=false",
].join("");
const changedAt = new Date().toISOString();
const response = await fetch(documentUrl, {
  method: "PATCH",
  headers: {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    fields: {
      controlEpoch: { integerValue: String(epoch) },
      stagingEnabled: { booleanValue: enabledText === "true" },
      reasonCode: { stringValue: reason },
      changedAt: { timestampValue: changedAt },
    },
  }),
});
if (!response.ok) throw new Error(`STAGING_CONTROL_UPDATE_DENIED_${response.status}`);
process.stdout.write(`${JSON.stringify({
  updated: true,
  project,
  controlEpoch: epoch,
  previousControlEpoch: currentEpoch,
  stagingEnabled: enabledText === "true",
  reasonCode: reason,
  changedAt,
})}\n`);
