import { execFileSync } from "node:child_process";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const project = args.get("--project") ?? "";
const issueUrl = args.get("--issue-url") ?? "";
const fixture = args.get("--fixture");
const locale = args.get("--locale");
const authorization = args.get("--authorized");
if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(project)) throw new Error("APPROVED_PROJECT_ID_REQUIRED");
if (!/^https:\/\/[a-z0-9.-]+\/?$/u.test(issueUrl)) throw new Error("HTTPS_ISSUE_FUNCTION_URL_REQUIRED");
if (fixture !== "synthetic-wp13-12b-only") throw new Error("SYNTHETIC_FIXTURE_ALLOWLIST_MISMATCH");
if (locale !== "nb" && locale !== "nn") throw new Error("FIRST_CLASS_LOCALE_REQUIRED");
if (authorization !== "WP13_12B_OPERATOR_AUTHORIZED") {
  throw new Error("EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED");
}

const identityToken = execFileSync(
  "gcloud",
  ["auth", "print-identity-token", `--audiences=${issueUrl}`, `--project=${project}`],
  { encoding: "utf8", windowsHide: true },
).trim();
const response = await fetch(issueUrl, {
  method: "POST",
  headers: {
    authorization: `Bearer ${identityToken}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ locale }),
});
const result = await response.json();
if (!response.ok || result?.syntheticSessionId === undefined) {
  throw new Error(`SYNTHETIC_FIXTURE_SEED_DENIED_${response.status}`);
}
process.stdout.write(`${JSON.stringify({
  seeded: true,
  fixture,
  locale,
  syntheticSessionId: result.syntheticSessionId,
  expiresAt: result.expiresAt,
  capabilitiesEmitted: false,
})}\n`);
