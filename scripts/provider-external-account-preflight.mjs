import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const nativeFetch = globalThis.fetch.bind(globalThis);
const require = createRequire(import.meta.url);
const {
  acquirePinnedGoogleOAuthAccessToken,
  assertGoogleOAuthProductionEnvironment,
} = require("./wp13-12b-google-oauth-token-helper.cjs");
assertGoogleOAuthProductionEnvironment();
const repo = fileURLToPath(new URL("..", import.meta.url));
const approval = JSON.parse(await readFile(
  join(repo, "release", "wp13-12b", "external-activation", "cloud-field-approval.json"),
  "utf8",
));
const approvedAccount = approval.approvedGoogleAccount;
const organizationId = approval.approvedOrganizationId;
const billingAccountId = approval.approvedBillingAccount;
const plannedProjectId = approval.plannedProjectId;

assert.match(approvedAccount ?? "", /^[^@\s]+@[^@\s]+\.[^@\s]+$/u, "APPROVED_ACCOUNT_REQUIRED");
assert.match(organizationId ?? "", /^\d{6,20}$/u, "APPROVED_ORGANIZATION_ID_REQUIRED");
assert.match(billingAccountId ?? "", /^[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{6}$/u, "APPROVED_BILLING_ACCOUNT_REQUIRED");
assert.match(plannedProjectId ?? "", /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u, "PLANNED_PROJECT_ID_REQUIRED");

const googleOAuth = await acquirePinnedGoogleOAuthAccessToken();
assert.equal(
  googleOAuth.approvedGoogleAccount,
  approvedAccount,
  "APPROVED_ACCOUNT_NOT_ACTIVE",
);
const accessToken = googleOAuth.accessToken;

async function call(url, method = "GET", body) {
  const response = await nativeFetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  return {
    status: response.status,
    data,
  };
}

const organization = await call(
  `https://cloudresourcemanager.googleapis.com/v3/organizations/${organizationId}`,
);
const organizationPermissions = await call(
  `https://cloudresourcemanager.googleapis.com/v3/organizations/${organizationId}:testIamPermissions`,
  "POST",
  { permissions: ["resourcemanager.projects.create"] },
);
const billingAccount = await call(
  `https://cloudbilling.googleapis.com/v1/billingAccounts/${billingAccountId}`,
);
const billingPermissions = await call(
  `https://cloudbilling.googleapis.com/v1/billingAccounts/${billingAccountId}:testIamPermissions`,
  "POST",
  {
    permissions: [
      "billing.accounts.get",
      "billing.resourceAssociations.create",
      "billing.budgets.create",
    ],
  },
);
const project = await call(
  `https://cloudresourcemanager.googleapis.com/v3/projects/${plannedProjectId}`,
);

const result = {
  schemaVersion: "wp13.12b-ea-external-account-preflight-v1",
  mode: "READ_ONLY_NO_EXTERNAL_WRITES",
  activeAccount: googleOAuth.approvedGoogleAccount,
  organization: {
    httpStatus: organization.status,
    name: organization.data.name,
    state: organization.data.state,
    displayName: organization.data.displayName,
  },
  organizationPermissions: {
    httpStatus: organizationPermissions.status,
    permissions: organizationPermissions.data.permissions ?? [],
  },
  billingAccount: {
    httpStatus: billingAccount.status,
    name: billingAccount.data.name,
    open: billingAccount.data.open,
    displayName: billingAccount.data.displayName,
    currencyCode: billingAccount.data.currencyCode,
  },
  billingPermissions: {
    httpStatus: billingPermissions.status,
    permissions: billingPermissions.data.permissions ?? [],
  },
  plannedProjectLookup: {
    httpStatus: project.status,
    state: project.data.state ?? null,
    notFound: project.status === 404,
  },
  accessTokenPrinted: false,
  externalWrites: 0,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (
  result.organization.httpStatus !== 200
  || !result.organizationPermissions.permissions.includes("resourcemanager.projects.create")
  || result.billingAccount.httpStatus !== 200
  || result.billingAccount.open !== true
  || !result.billingPermissions.permissions.includes("billing.resourceAssociations.create")
  || result.plannedProjectLookup.notFound !== true
) {
  process.exitCode = 1;
}
