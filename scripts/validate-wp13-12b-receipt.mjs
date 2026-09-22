import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateReceipt } from "../dist/src/core/staging-validation.js";
import {
  isRepositoryRelativePath,
  RECEIPT_ARTIFACT_VERIFICATION_MODE,
  verifyReceiptRepositoryIntegrity,
} from "./wp13-12b-receipt-integrity.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const receiptIndex = process.argv.indexOf("--receipt");
const receiptPath = receiptIndex >= 0 ? process.argv[receiptIndex + 1] : undefined;
if (!receiptPath) throw new Error("RECEIPT_PATH_REQUIRED");

if (!isRepositoryRelativePath(receiptPath)) throw new Error("RECEIPT_PATH_MUST_BE_REPOSITORY_RELATIVE");
const resolvedReceiptPath = resolve(repo, receiptPath);
const receiptRelative = relative(repo, resolvedReceiptPath);
if (receiptRelative.startsWith("..") || isAbsolute(receiptRelative)) {
  throw new Error("RECEIPT_PATH_OUTSIDE_REPOSITORY");
}
const receipt = JSON.parse(await readFile(resolvedReceiptPath, "utf8"));
const decisionRecordChecksum = createHash("sha256").update(await readFile(
  resolve(repo, "release/wp13-12b/external-activation/owner-authorization.json"),
)).digest("hex");
const repositoryIntegrity = await verifyReceiptRepositoryIntegrity(
  receipt,
  repo,
  {
    receiptPath,
    artifactVerificationMode:
      RECEIPT_ARTIFACT_VERIFICATION_MODE.DESCENDANT_EVIDENCE_COMMIT,
  },
);
const receiptResult = validateReceipt(receipt, {
  sourceTree: repositoryIntegrity.resolvedSourceTree,
  decisionRecordChecksum,
});
const errors = [...new Set([...receiptResult.errors, ...repositoryIntegrity.errors])];
const result = {
  valid: receiptResult.valid && repositoryIntegrity.errors.length === 0,
  evidence: receiptResult.evidence && repositoryIntegrity.errors.length === 0,
  errors,
};
const output = {
  ...result,
  receiptType: receipt.receiptType,
  boundSourceCommit: receipt.sourceCommit,
  boundSourceTree: receipt.sourceTree,
  sourceCommitExists: repositoryIntegrity.sourceCommitExists,
  sourceTreeExists: repositoryIntegrity.sourceTreeExists,
  receiptVerification: {
    path: repositoryIntegrity.receiptPath,
    artifactVerificationMode:
      repositoryIntegrity.artifactVerificationMode,
    evidenceCommit: repositoryIntegrity.evidenceCommit,
    verificationCommit: repositoryIntegrity.verificationCommit,
  },
  artifactHashVerification: {
    verified: repositoryIntegrity.artifactResults.every((item) => item.verified),
    files: repositoryIntegrity.artifactResults,
  },
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!result.valid || !result.evidence) process.exit(1);
