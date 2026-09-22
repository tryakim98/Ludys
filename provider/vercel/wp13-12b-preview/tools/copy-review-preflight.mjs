import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const copyReviewSchemaVersion =
  "wp13.12b-external-preview-copy-review-v2";
export const copyReviewRequiredStatus =
  "HUMAN_APPROVED_FOR_EXTERNAL_DEPLOYMENT";
export const copyReviewPendingStatus =
  "REVIEW_REQUIRED_BEFORE_EXTERNAL_DEPLOYMENT";
export const copyReviewExpectedSourceSetSha256 =
  "bf3ecfc58ae713bf91dd53f27b6ad5b9750a65b76bf5b73261526cae7db21d80";
export const requiredHumanApprovalStatement =
  "GODKJENN_WP13_12B_PREVIEW_TEKST_R2; FELLES=godkjent; BM=godkjent; "
  + "NN=godkjent; sourceSetSha256="
  + copyReviewExpectedSourceSetSha256;

const defaultRoot = fileURLToPath(new URL("..", import.meta.url));
const expectedSources = Object.freeze([
  Object.freeze({
    group: "sharedSources",
    source: "index.html",
    locale: undefined,
  }),
  Object.freeze({
    group: "bundles",
    source: "locales/nb.mjs",
    locale: "nb",
  }),
  Object.freeze({
    group: "bundles",
    source: "locales/nn.mjs",
    locale: "nn",
  }),
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function copyReviewSourceSetSha256(sourceChecksums) {
  const canonical = expectedSources.map(({ source }) => (
    `${source}\0${sourceChecksums.get(source) ?? ""}`
  )).join("\n");
  return sha256(Buffer.from(canonical, "utf8"));
}

function safeHumanIdentity(value) {
  return (
    typeof value === "string"
    && value.length >= 3
    && value.length <= 160
    && !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function exactUtcTimestamp(value) {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

export async function evaluateCopyReview({
  root = defaultRoot,
  contract,
  readSource = (source) => readFile(resolve(root, ...source.split("/"))),
} = {}) {
  const errors = [];
  let candidate = contract;
  if (candidate === undefined) {
    try {
      candidate = JSON.parse(await readFile(
        resolve(root, "copy-review-contract.json"),
        "utf8",
      ));
    } catch {
      errors.push("COPY_REVIEW_CONTRACT_UNREADABLE");
      candidate = {};
    }
  }

  if (candidate?.schemaVersion !== copyReviewSchemaVersion) {
    errors.push("COPY_REVIEW_SCHEMA_VERSION_INVALID");
  }
  if (candidate?.status !== copyReviewRequiredStatus) {
    errors.push("COPY_REVIEW_STATUS_NOT_HUMAN_APPROVED");
  }
  if (candidate?.fallbackAllowed !== false) {
    errors.push("COPY_REVIEW_FALLBACK_MUST_BE_FALSE");
  }
  if (candidate?.audio !== "NOT_PRESENT") {
    errors.push("COPY_REVIEW_AUDIO_BOUNDARY_INVALID");
  }
  if (candidate?.requiredHumanApprovalStatement !== requiredHumanApprovalStatement) {
    errors.push("COPY_REVIEW_REQUIRED_STATEMENT_INVALID");
  }

  const actualChecksums = new Map();
  for (const expected of expectedSources) {
    try {
      actualChecksums.set(expected.source, sha256(await readSource(expected.source)));
    } catch {
      errors.push(`COPY_REVIEW_SOURCE_UNREADABLE:${expected.source}`);
    }
  }

  for (const expected of expectedSources) {
    const entries = Array.isArray(candidate?.[expected.group])
      ? candidate[expected.group]
      : [];
    const matches = entries.filter((entry) => entry?.source === expected.source);
    if (matches.length !== 1) {
      errors.push(`COPY_REVIEW_SOURCE_ENTRY_INVALID:${expected.source}`);
      continue;
    }
    const [entry] = matches;
    if (expected.locale !== undefined && entry.locale !== expected.locale) {
      errors.push(`COPY_REVIEW_LOCALE_INVALID:${expected.source}`);
    }
    if (entry.reviewStatus !== copyReviewRequiredStatus) {
      errors.push(`COPY_REVIEW_SOURCE_NOT_HUMAN_APPROVED:${expected.source}`);
    }
    if (entry.sourceSha256 !== actualChecksums.get(expected.source)) {
      errors.push(`COPY_REVIEW_SOURCE_CHECKSUM_MISMATCH:${expected.source}`);
    }
  }

  const expectedSharedCount = expectedSources.filter(
    ({ group }) => group === "sharedSources",
  ).length;
  const expectedBundleCount = expectedSources.filter(
    ({ group }) => group === "bundles",
  ).length;
  if (
    !Array.isArray(candidate?.sharedSources)
    || candidate.sharedSources.length !== expectedSharedCount
  ) errors.push("COPY_REVIEW_SHARED_SOURCE_SET_INVALID");
  if (
    !Array.isArray(candidate?.bundles)
    || candidate.bundles.length !== expectedBundleCount
  ) errors.push("COPY_REVIEW_BUNDLE_SOURCE_SET_INVALID");

  const sourceSetSha256 = copyReviewSourceSetSha256(actualChecksums);
  if (sourceSetSha256 !== copyReviewExpectedSourceSetSha256) {
    errors.push("COPY_REVIEW_EXPECTED_SOURCE_SET_CHANGED");
  }
  const approval = candidate?.approvalMetadata;
  if (approval?.confirmationChannel !== "CODEX_EXPLICIT_HUMAN_CONFIRMATION") {
    errors.push("COPY_REVIEW_CONFIRMATION_CHANNEL_INVALID");
  }
  if (approval?.humanApprovalStatement !== requiredHumanApprovalStatement) {
    errors.push("COPY_REVIEW_HUMAN_APPROVAL_STATEMENT_MISSING");
  }
  if (!safeHumanIdentity(approval?.reviewerIdentity)) {
    errors.push("COPY_REVIEW_REVIEWER_IDENTITY_MISSING");
  }
  if (approval?.reviewerRole !== "PRODUCT_OWNER") {
    errors.push("COPY_REVIEW_REVIEWER_ROLE_INVALID");
  }
  if (!exactUtcTimestamp(approval?.reviewedAt)) {
    errors.push("COPY_REVIEW_REVIEWED_AT_INVALID");
  }
  if (approval?.sourceSetSha256 !== sourceSetSha256) {
    errors.push("COPY_REVIEW_SOURCE_SET_CHECKSUM_MISMATCH");
  }

  return Object.freeze({
    schemaVersion: "wp13.12b-external-preview-copy-review-preflight-v1",
    valid: errors.length === 0,
    deploymentAllowed: errors.length === 0,
    mode: "NON_MUTATING_EXACT_SOURCE_REVIEW_PREFLIGHT",
    reviewStatus: candidate?.status ?? "MISSING",
    sourceSetSha256,
    reviewedSourceCount: expectedSources.length,
    externalWrites: 0,
    errors: Object.freeze(errors),
  });
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && resolve(invokedPath) === fileURLToPath(import.meta.url)
) {
  const result = await evaluateCopyReview();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
}
