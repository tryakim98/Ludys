import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const functionsDir = fileURLToPath(new URL("../provider/firebase/functions/", import.meta.url));
const providerLockUrl = new URL(
  "../provider/firebase/functions/package-lock.json",
  import.meta.url,
);
const providerPackageArtifactUrl = new URL(
  "../artifacts/wp13-12b-provider-package.json",
  import.meta.url,
);
const providerLockBytes = await readFile(providerLockUrl);
const providerPackageArtifactBytes = await readFile(providerPackageArtifactUrl);
const lock = JSON.parse(providerLockBytes.toString("utf8"));
const providerPackageArtifact = JSON.parse(
  providerPackageArtifactBytes.toString("utf8"),
);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const providerLockSha256 = sha256(providerLockBytes);
const providerPackageSha256 = sha256(providerPackageArtifactBytes);
const expectedFastUri = Object.freeze({
  version: "3.1.5",
  resolved: "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.5.tgz",
  integrity:
    "sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==",
  shasum: "610f37419a030270430cecd68d74e3d4d96725d0",
  license: "BSD-3-Clause",
});
const fastUriLockEntries = Object.entries(lock.packages ?? {})
  .filter(([path]) => path === "node_modules/fast-uri");
const fastUriLock = fastUriLockEntries[0]?.[1];
const providerPackageLockEntry = providerPackageArtifact.files?.find(
  (file) => file.path === "provider/firebase/functions/package-lock.json",
);
if (
  fastUriLockEntries.length !== 1
  || fastUriLock?.version !== expectedFastUri.version
  || fastUriLock?.resolved !== expectedFastUri.resolved
  || fastUriLock?.integrity !== expectedFastUri.integrity
  || fastUriLock?.license !== expectedFastUri.license
  || providerPackageLockEntry?.sha256 !== providerLockSha256
) {
  throw new Error(
    "provider package must be rebuilt from the exact remediated fast-uri lock before supply-chain generation",
  );
}
const packageEntries = Object.entries(lock.packages ?? {})
  .filter(([path, value]) => path !== "" && value?.version)
  .map(([path, value]) => ({
    path,
    name: path.split("node_modules/").at(-1),
    version: value.version,
    integrity: value.integrity,
    development: value.dev === true,
    optional: value.optional === true,
  }))
  .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`));

const npmCli = process.env.npm_execpath;
if (npmCli === undefined) throw new Error("npm_execpath is required for provider audit");
const auditRun = spawnSync(process.execPath, [npmCli, "audit", "--omit=dev", "--json"], {
  cwd: functionsDir,
  encoding: "utf8",
  windowsHide: true,
});
let audit;
try {
  audit = JSON.parse(auditRun.stdout);
} catch {
  throw new Error(`provider audit did not return JSON\n${auditRun.stdout}\n${auditRun.stderr}`);
}
const vulnerabilities = audit.metadata?.vulnerabilities ?? {};
const blockingCount = (vulnerabilities.moderate ?? 0)
  + (vulnerabilities.high ?? 0)
  + (vulnerabilities.critical ?? 0);
const securityRemediation = {
  schemaVersion: "wp13.12b-provider-security-remediation-v1",
  status: "CURRENT_SECURITY_REMEDIATED_PROVIDER_PACKAGE",
  decision: "AUTHORIZE_WP13_12B_PROVIDER_SECURITY_REMEDIATION_AND_REANCHOR",
  discoveryDate: "2026-08-05",
  advisory: {
    ghsa: "GHSA-7p8r-x3mc-p8w7",
    cve: "CVE-2026-18446",
    severity: "HIGH",
    cvss: 7.5,
    cwe: "CWE-436",
    title: "fast-uri vulnerable to host confusion via backslash authority introducer",
    affectedVersions: ">=3.0.0 <3.1.5",
    minimumFixedVersion: "3.1.5",
    workaround: "NONE_UPGRADE_REQUIRED",
  },
  patchedPackage: {
    name: "fast-uri",
    version: expectedFastUri.version,
    resolved: expectedFastUri.resolved,
    integrity: expectedFastUri.integrity,
    shasum: expectedFastUri.shasum,
    publishedAt: "2026-07-31T09:16:56.212Z",
    license: expectedFastUri.license,
    upstreamTag: "v3.1.5",
    upstreamTagCommit: "5e179cbb4636d5f773ed21126e5bd3068e87e94e",
    upstreamSecurityPatchCommit:
      "f3c6c905f47831007490f466c5945012e905cc52",
  },
  strategy: {
    id: "LOCKFILE_ONLY_PATCH_RESOLUTION",
    providerPackageJsonChanged: false,
    rootLockChanged: false,
    rootRuntimeDependenciesChanged: false,
    functionsFramework: "5.0.5",
    cloudEvents: "10.0.0",
    ajv: "8.20.0",
    ajvFastUriRange: "^3.0.1",
  },
  historicalProviderPackage: {
    status: "SUPERSEDED_SECURITY_VULNERABILITY",
    evidenceAnchorCommit: "b7b0af2b679a98b0e61ef17e606a5183a1de6323",
    proofToolCommit: "568d9f9e306075a81f6e4b243d3812507f97b230",
    vulnerableVersion: "3.1.4",
    providerLockSha256:
      "5f37255d76e52abcdd0667bcb359da79e9e82d19e4bd3c101de923db4566c0b7",
    providerPackageSha256:
      "adb21b26de22926a6daa28f0daf24ad40b73492740330d3613271ff5434f0ba9",
    functionsSourceSha256:
      "35969654987638ddf31192ea3d78bc76a2af203765fe4c06b7cf11cd44fc9912",
    reason: "GHSA-7p8r-x3mc-p8w7 / CVE-2026-18446",
    deploymentProhibition:
      "PROHIBITED_FOR_ANY_STAGING_OR_EXTERNAL_DEPLOYMENT",
  },
  currentProviderPackage: {
    status: "CURRENT_SECURITY_REMEDIATED_PROVIDER_PACKAGE",
    commitBinding: "INTRODUCING_COMMIT_OF_THIS_RECORD",
    expectedParentCommit: "568d9f9e306075a81f6e4b243d3812507f97b230",
    providerLockSha256,
    providerPackageSha256,
    functionsSourceSha256: providerPackageArtifact.functionsSourceSha256,
    fastUriVersion: expectedFastUri.version,
    deploymentEligibility:
      "HASH_BOUND_LOCAL_PACKAGE_ONLY_EXTERNAL_ACTIVATION_STILL_BLOCKED",
  },
  anchors: {
    historicalEvidenceAnchorCommit:
      "b7b0af2b679a98b0e61ef17e606a5183a1de6323",
    historicalProofToolCommit:
      "568d9f9e306075a81f6e4b243d3812507f97b230",
    securityRemediationCommit: "INTRODUCING_COMMIT_OF_THIS_RECORD",
    activeProviderPackageCommit: "INTRODUCING_COMMIT_OF_THIS_RECORD",
    previewSourceSetSha256:
      "bf3ecfc58ae713bf91dd53f27b6ad5b9750a65b76bf5b73261526cae7db21d80",
  },
  authorizationCeiling: {
    providerActivation: "BLOCKED",
    cloudWrites: 0,
    login: false,
    deployment: false,
    iamMutation: false,
    externalDeletion: false,
    realData: false,
    studentBeta: "NOT_AUTHORIZED",
    production: "NOT_AUTHORIZED",
    wp13_12c: "BLOCKED",
  },
};
const securityRemediationBytes = Buffer.from(
  `${JSON.stringify(securityRemediation, null, 2)}\n`,
  "utf8",
);
const providerAudit = {
  schemaVersion: "wp13.12b-provider-audit-v2",
  command: "npm audit --omit=dev --json",
  executed: true,
  auditExitCode: auditRun.status,
  packageCount: audit.metadata?.dependencies?.prod ?? packageEntries.filter((item) => !item.development).length,
  vulnerabilities,
  findings: Object.entries(audit.vulnerabilities ?? {}).map(([packageName, finding]) => ({
    package: packageName,
    version: finding.range,
    scope: finding.isDirect ? "DIRECT_RUNTIME" : "TRANSITIVE_RUNTIME",
    severity: finding.severity,
    runtimeReachability: "PROVIDER_FUNCTIONS_RUNTIME",
    stagingReachability: true,
    mitigation: finding.fixAvailable === false ? "NO_AUTOMATIC_FIX" : finding.fixAvailable,
    blocksExternalActivation: ["moderate", "high", "critical"].includes(finding.severity),
  })),
  moderateOrHigher: blockingCount,
  blocksExternalActivation: blockingCount > 0,
  rootRuntimeDependencies: 0,
  evidenceBindings: {
    providerLockSha256,
    providerPackageSha256,
    securityRemediationSha256: sha256(securityRemediationBytes),
    fastUriVersion: expectedFastUri.version,
    fastUriIntegrity: expectedFastUri.integrity,
  },
  securityOverrides: {
    "cloudevents>uuid": {
      pinnedVersion: "11.1.1",
      advisory: "GHSA-w5hq-g745-h8pq",
      compatibilitySurface: "cloudevents uses the retained uuid v4 API",
      verification: "local Functions Framework health endpoint proof",
    },
  },
  supersededAuditAttempts: [
    {
      dependencySet: "firebase-admin@14.2.0 + firebase-functions@7.3.0",
      vulnerabilities: { moderate: 7, high: 5, critical: 0 },
      disposition: "REJECTED_NOT_USED",
      reason: "current SDK chain carried unresolved runtime advisories",
    },
    {
      dependencySet: "firebase-admin@10.3.0 + firebase-functions@4.9.0",
      vulnerabilities: { moderate: 4, high: 6, critical: 1 },
      disposition: "REJECTED_NOT_USED",
      reason: "older suggested remediation introduced critical and high advisories",
    },
    {
      dependencySet: "@google-cloud/functions-framework@5.0.5 without override",
      vulnerabilities: { moderate: 3, high: 0, critical: 0 },
      disposition: "REJECTED_SUPERSEDED_BY_SCOPED_OVERRIDE",
      reason: "cloudevents resolved vulnerable uuid@8.3.2",
    },
  ],
};

const components = packageEntries.map((item) => ({
  type: "library",
  name: item.name,
  version: item.version,
  purl: `pkg:npm/${item.name.replace("/", "%2F")}@${item.version}`,
  hashes: item.integrity
    ? [{ alg: "SHA-512", content: item.integrity.replace(/^sha512-/u, "") }]
    : [],
  properties: [
    { name: "ludys:scope", value: item.development ? "development" : "runtime" },
    { name: "ludys:optional", value: String(item.optional) },
  ],
}));
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: "urn:uuid:13b12026-0725-4000-8000-000000000001",
  version: 1,
  metadata: {
    timestamp: "2026-07-25T00:00:00.000Z",
    component: {
      type: "application",
      name: "@ludys/synthetic-staging-firebase-functions",
      version: "13.12.0-repository.1",
    },
  },
  components,
};

const licenses = [];
for (const item of packageEntries) {
  const packageJsonUrl = new URL(`../provider/firebase/functions/${item.path}/package.json`, import.meta.url);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(packageJsonUrl, "utf8"));
  } catch {
    manifest = {};
  }
  const raw = manifest.license ?? manifest.licenses ?? "UNKNOWN";
  licenses.push({
    package: item.name,
    version: item.version,
    scope: item.development ? "development" : "runtime",
    license: typeof raw === "string" ? raw : JSON.stringify(raw),
    runtimeReachability: item.development ? "NONE" : "PROVIDER_FUNCTIONS_RUNTIME",
  });
}
const licenseInventory = {
  schemaVersion: "wp13.12b-provider-license-inventory-v1",
  generatedFrom: "provider/firebase/functions/package-lock.json and installed package manifests",
  packageCount: licenses.length,
  unknownLicenseCount: licenses.filter((item) => item.license === "UNKNOWN").length,
  packages: licenses,
};

async function output(path, value) {
  const target = new URL(`../${path}`, import.meta.url);
  await mkdir(dirname(fileURLToPath(target)), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
await output("release/wp13-12b/provider-audit.json", providerAudit);
await output("release/wp13-12b/provider-sbom.cdx.json", sbom);
await output("release/wp13-12b/provider-license-inventory.json", licenseInventory);
await output(
  "release/wp13-12b/provider-security-remediation.json",
  securityRemediation,
);
console.log(JSON.stringify({
  valid: blockingCount === 0 && licenseInventory.unknownLicenseCount === 0,
  providerPackages: packageEntries.length,
  vulnerabilities,
  unknownLicenses: licenseInventory.unknownLicenseCount,
}, null, 2));
if (blockingCount > 0 || licenseInventory.unknownLicenseCount > 0) process.exit(1);
