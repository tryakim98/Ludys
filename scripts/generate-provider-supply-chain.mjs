import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const functionsDir = fileURLToPath(new URL("../provider/firebase/functions/", import.meta.url));
const lock = JSON.parse(await readFile(new URL("../provider/firebase/functions/package-lock.json", import.meta.url), "utf8"));
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
const providerAudit = {
  schemaVersion: "wp13.12b-provider-audit-v1",
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
console.log(JSON.stringify({
  valid: blockingCount === 0 && licenseInventory.unknownLicenseCount === 0,
  providerPackages: packageEntries.length,
  vulnerabilities,
  unknownLicenses: licenseInventory.unknownLicenseCount,
}, null, 2));
if (blockingCount > 0 || licenseInventory.unknownLicenseCount > 0) process.exit(1);
