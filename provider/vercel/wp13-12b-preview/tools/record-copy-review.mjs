import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyReviewExpectedSourceSetSha256,
  copyReviewRequiredStatus,
  copyReviewSchemaVersion,
  copyReviewSourceSetSha256,
  evaluateCopyReview,
  requiredHumanApprovalStatement,
} from "./copy-review-preflight.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const contractPath = resolve(root, "copy-review-contract.json");
const approvedReviewer = "tryakim@gmail.com";
const sourcePaths = Object.freeze([
  "index.html",
  "locales/nb.mjs",
  "locales/nn.mjs",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactUtcTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function buildApprovedCopyReviewContract({
  pendingContract,
  sourceBytes,
  approvalStatement,
  reviewerIdentity,
  reviewedAt,
}) {
  if (
    pendingContract?.schemaVersion !== copyReviewSchemaVersion
    || pendingContract.status !== "REVIEW_REQUIRED_BEFORE_EXTERNAL_DEPLOYMENT"
    || pendingContract.fallbackAllowed !== false
    || pendingContract.audio !== "NOT_PRESENT"
    || pendingContract.requiredHumanApprovalStatement
      !== requiredHumanApprovalStatement
  ) throw new Error("COPY_REVIEW_PENDING_CONTRACT_INVALID");
  if (approvalStatement !== requiredHumanApprovalStatement) {
    throw new Error("EXACT_COPY_REVIEW_APPROVAL_REQUIRED");
  }
  if (reviewerIdentity !== approvedReviewer) {
    throw new Error("COPY_REVIEW_PRODUCT_OWNER_IDENTITY_MISMATCH");
  }
  if (!exactUtcTimestamp(reviewedAt)) {
    throw new Error("COPY_REVIEW_TIMESTAMP_INVALID");
  }
  if (
    !(sourceBytes instanceof Map)
    || sourceBytes.size !== sourcePaths.length
    || sourcePaths.some((path) => !Buffer.isBuffer(sourceBytes.get(path)))
  ) throw new Error("COPY_REVIEW_EXACT_SOURCE_SET_REQUIRED");
  const sourceChecksums = new Map(
    sourcePaths.map((path) => [path, sha256(sourceBytes.get(path))]),
  );
  if (
    copyReviewSourceSetSha256(sourceChecksums)
      !== copyReviewExpectedSourceSetSha256
  ) throw new Error("COPY_REVIEW_EXPECTED_SOURCE_SET_CHANGED");
  const approved = structuredClone(pendingContract);
  approved.status = copyReviewRequiredStatus;
  approved.approvalMetadata = {
    confirmationChannel: "CODEX_EXPLICIT_HUMAN_CONFIRMATION",
    humanApprovalStatement: approvalStatement,
    reviewerIdentity,
    reviewerRole: "PRODUCT_OWNER",
    reviewedAt,
    sourceSetSha256: copyReviewSourceSetSha256(sourceChecksums),
  };
  for (const entry of [...approved.sharedSources, ...approved.bundles]) {
    if (!sourcePaths.includes(entry.source)) {
      throw new Error("COPY_REVIEW_SOURCE_ENTRY_INVALID");
    }
    entry.reviewStatus = copyReviewRequiredStatus;
    entry.sourceSha256 = sourceChecksums.get(entry.source);
  }
  return approved;
}

function parseExactArgs(argv) {
  if (argv.length !== 4) throw new Error("COPY_REVIEW_EXACT_FLAGS_REQUIRED");
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (
      !["--approval", "--reviewer"].includes(flag)
      || values.has(flag)
      || typeof argv[index + 1] !== "string"
    ) throw new Error("COPY_REVIEW_EXACT_FLAGS_REQUIRED");
    values.set(flag, argv[index + 1]);
  }
  return values;
}

async function main() {
  const args = parseExactArgs(process.argv.slice(2));
  const pendingContract = JSON.parse(await readFile(contractPath, "utf8"));
  const sourceBytes = new Map(await Promise.all(sourcePaths.map(
    async (path) => [path, await readFile(resolve(root, ...path.split("/")))],
  )));
  const approved = buildApprovedCopyReviewContract({
    pendingContract,
    sourceBytes,
    approvalStatement: args.get("--approval"),
    reviewerIdentity: args.get("--reviewer"),
    reviewedAt: new Date().toISOString(),
  });
  const validation = await evaluateCopyReview({
    root,
    contract: approved,
  });
  if (!validation.valid) {
    throw new Error(`COPY_REVIEW_APPROVAL_VALIDATION_FAILED:${validation.errors.join(",")}`);
  }
  await writeFile(
    contractPath,
    `${JSON.stringify(approved, null, 2)}\n`,
    { encoding: "utf8", flag: "w" },
  );
  process.stdout.write(`${JSON.stringify({
    status: "COPY_REVIEW_HUMAN_APPROVAL_RECORDED",
    reviewerIdentity: approvedReviewer,
    reviewedAt: approved.approvalMetadata.reviewedAt,
    sourceSetSha256: approved.approvalMetadata.sourceSetSha256,
    reviewedSourceCount: sourcePaths.length,
  }, null, 2)}\n`);
}

if (
  process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) await main();
