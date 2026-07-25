import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateReceipt } from "../dist/src/core/staging-validation.js";

const repo = fileURLToPath(new URL("..", import.meta.url));
const receiptIndex = process.argv.indexOf("--receipt");
const receiptPath = receiptIndex >= 0 ? process.argv[receiptIndex + 1] : undefined;
if (!receiptPath) throw new Error("RECEIPT_PATH_REQUIRED");

const expectedCommit = execFileSync(
  "git",
  ["-c", `safe.directory=${repo.replaceAll("\\", "/")}`, "rev-parse", "HEAD"],
  { cwd: repo, encoding: "utf8", windowsHide: true },
).trim();
const receipt = JSON.parse(await readFile(resolve(repo, receiptPath), "utf8"));
const result = validateReceipt(receipt, { sourceCommit: expectedCommit });
const output = {
  ...result,
  receiptType: receipt.receiptType,
  expectedCommit,
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!result.valid || !result.evidence) process.exit(1);
