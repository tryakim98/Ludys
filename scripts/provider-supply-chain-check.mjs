import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const bytes = async (path) => readFile(
  new URL(`../${path}`, import.meta.url),
);
const json = async (path) => JSON.parse((await bytes(path)).toString("utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const expectedFastUri = Object.freeze({
  version: "3.1.5",
  resolved: "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.5.tgz",
  integrity:
    "sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==",
  license: "BSD-3-Clause",
});

const auditBytes = await bytes("release/wp13-12b/provider-audit.json");
const sbomBytes = await bytes("release/wp13-12b/provider-sbom.cdx.json");
const licenseBytes = await bytes(
  "release/wp13-12b/provider-license-inventory.json",
);
const remediationBytes = await bytes(
  "release/wp13-12b/provider-security-remediation.json",
);
const lockBytes = await bytes("provider/firebase/functions/package-lock.json");
const providerArtifactBytes = await bytes(
  "artifacts/wp13-12b-provider-package.json",
);
const audit = JSON.parse(auditBytes.toString("utf8"));
const sbom = JSON.parse(sbomBytes.toString("utf8"));
const licenses = JSON.parse(licenseBytes.toString("utf8"));
const remediation = JSON.parse(remediationBytes.toString("utf8"));
const lock = JSON.parse(lockBytes.toString("utf8"));
const providerArtifact = JSON.parse(providerArtifactBytes.toString("utf8"));
const providerPackage = await json("provider/firebase/functions/package.json");
const rootPackage = await json("package.json");
const errors = [];

const providerLockSha256 = sha256(lockBytes);
const providerPackageSha256 = sha256(providerArtifactBytes);
const fastUriEntries = Object.entries(lock.packages ?? {})
  .filter(([path]) => path === "node_modules/fast-uri");
const fastUri = fastUriEntries[0]?.[1];
const artifactLock = providerArtifact.files?.find(
  (file) => file.path === "provider/firebase/functions/package-lock.json",
);
const sbomFastUri = (sbom.components ?? []).filter(
  (component) => component.name === "fast-uri",
);
const licenseFastUri = (licenses.packages ?? []).filter(
  (entry) => entry.package === "fast-uri",
);

if (
  audit.schemaVersion !== "wp13.12b-provider-audit-v2"
  || audit.executed !== true
  || audit.auditExitCode !== 0
  || audit.blocksExternalActivation !== false
  || audit.moderateOrHigher !== 0
  || audit.vulnerabilities?.high !== 0
  || audit.vulnerabilities?.critical !== 0
  || (audit.findings ?? []).length !== 0
) errors.push("provider audit is stale or has blocking findings");
if (
  audit.evidenceBindings?.providerLockSha256 !== providerLockSha256
  || audit.evidenceBindings?.providerPackageSha256 !== providerPackageSha256
  || audit.evidenceBindings?.securityRemediationSha256
    !== sha256(remediationBytes)
  || audit.evidenceBindings?.fastUriVersion !== expectedFastUri.version
  || audit.evidenceBindings?.fastUriIntegrity !== expectedFastUri.integrity
) errors.push("provider audit evidence bindings are stale or incomplete");
if (
  sbom.bomFormat !== "CycloneDX"
  || sbom.specVersion !== "1.6"
  || sbom.components.length < 1
  || sbomFastUri.length !== 1
  || sbomFastUri[0].version !== expectedFastUri.version
  || sbomFastUri[0].purl !== "pkg:npm/fast-uri@3.1.5"
  || sbomFastUri[0].hashes?.length !== 1
  || sbomFastUri[0].hashes[0]?.alg !== "SHA-512"
  || sbomFastUri[0].hashes[0]?.content
    !== expectedFastUri.integrity.replace(/^sha512-/u, "")
) errors.push("provider SBOM is stale, invalid, or missing patched fast-uri");
if (
  licenses.unknownLicenseCount !== 0
  || licenses.packages.length < 1
  || licenseFastUri.length !== 1
  || licenseFastUri[0].version !== expectedFastUri.version
  || licenseFastUri[0].license !== expectedFastUri.license
) errors.push("provider license inventory is stale or incomplete");
if (
  lock.packages?.[""]?.dependencies?.["@google-cloud/functions-framework"]
    !== "5.0.5"
  || Object.keys(lock.packages?.[""]?.dependencies ?? {}).length !== 1
  || lock.packages?.["node_modules/@google-cloud/functions-framework"]
    ?.version !== "5.0.5"
  || lock.packages?.["node_modules/cloudevents"]?.version !== "10.0.0"
  || lock.packages?.["node_modules/ajv"]?.version !== "8.20.0"
  || lock.packages?.["node_modules/ajv"]?.dependencies?.["fast-uri"]
    !== "^3.0.1"
) errors.push("provider dependency parents or narrow boundary changed");
if (
  fastUriEntries.length !== 1
  || fastUri?.version !== expectedFastUri.version
  || fastUri?.resolved !== expectedFastUri.resolved
  || fastUri?.integrity !== expectedFastUri.integrity
  || fastUri?.license !== expectedFastUri.license
  || lockBytes.toString("utf8").includes('"version": "3.1.4"')
) errors.push("provider lock does not contain the exact patched fast-uri");
if (
  providerPackage.overrides?.cloudevents?.uuid !== "11.1.1"
  || lock.packages?.["node_modules/uuid"]?.version !== "11.1.1"
) errors.push("provider security override mismatch");
if (
  artifactLock?.sha256 !== providerLockSha256
  || providerArtifact.functionsSourceSha256
    !== remediation.currentProviderPackage?.functionsSourceSha256
) errors.push("provider package artifact is not built from the remediated lock");
if (
  remediation.schemaVersion
    !== "wp13.12b-provider-security-remediation-v1"
  || remediation.status !== "CURRENT_SECURITY_REMEDIATED_PROVIDER_PACKAGE"
  || remediation.decision
    !== "AUTHORIZE_WP13_12B_PROVIDER_SECURITY_REMEDIATION_AND_REANCHOR"
  || remediation.advisory?.ghsa !== "GHSA-7p8r-x3mc-p8w7"
  || remediation.advisory?.cve !== "CVE-2026-18446"
  || remediation.advisory?.minimumFixedVersion !== expectedFastUri.version
  || remediation.patchedPackage?.version !== expectedFastUri.version
  || remediation.patchedPackage?.integrity !== expectedFastUri.integrity
  || remediation.strategy?.id !== "LOCKFILE_ONLY_PATCH_RESOLUTION"
  || remediation.strategy?.providerPackageJsonChanged !== false
  || remediation.historicalProviderPackage?.status
    !== "SUPERSEDED_SECURITY_VULNERABILITY"
  || remediation.historicalProviderPackage?.vulnerableVersion !== "3.1.4"
  || remediation.historicalProviderPackage?.providerPackageSha256
    !== "adb21b26de22926a6daa28f0daf24ad40b73492740330d3613271ff5434f0ba9"
  || remediation.historicalProviderPackage?.deploymentProhibition
    !== "PROHIBITED_FOR_ANY_STAGING_OR_EXTERNAL_DEPLOYMENT"
  || remediation.currentProviderPackage?.status
    !== "CURRENT_SECURITY_REMEDIATED_PROVIDER_PACKAGE"
  || remediation.currentProviderPackage?.commitBinding
    !== "INTRODUCING_COMMIT_OF_THIS_RECORD"
  || remediation.currentProviderPackage?.expectedParentCommit
    !== "568d9f9e306075a81f6e4b243d3812507f97b230"
  || remediation.currentProviderPackage?.providerLockSha256
    !== providerLockSha256
  || remediation.currentProviderPackage?.providerPackageSha256
    !== providerPackageSha256
  || remediation.currentProviderPackage?.fastUriVersion
    !== expectedFastUri.version
  || remediation.anchors?.historicalEvidenceAnchorCommit
    !== "b7b0af2b679a98b0e61ef17e606a5183a1de6323"
  || remediation.anchors?.historicalProofToolCommit
    !== "568d9f9e306075a81f6e4b243d3812507f97b230"
  || remediation.anchors?.securityRemediationCommit
    !== "INTRODUCING_COMMIT_OF_THIS_RECORD"
  || remediation.anchors?.activeProviderPackageCommit
    !== "INTRODUCING_COMMIT_OF_THIS_RECORD"
  || remediation.anchors?.previewSourceSetSha256
    !== "bf3ecfc58ae713bf91dd53f27b6ad5b9750a65b76bf5b73261526cae7db21d80"
  || remediation.authorizationCeiling?.cloudWrites !== 0
  || remediation.authorizationCeiling?.login !== false
  || remediation.authorizationCeiling?.deployment !== false
  || remediation.authorizationCeiling?.iamMutation !== false
  || remediation.authorizationCeiling?.externalDeletion !== false
) errors.push("provider security remediation provenance or anchor is invalid");
if (
  Object.keys(rootPackage.dependencies ?? {}).length !== 0
  || Object.keys(rootPackage.optionalDependencies ?? {}).length !== 0
  || Object.keys(rootPackage.peerDependencies ?? {}).length !== 0
) errors.push("provider dependency crossed into the root/browser runtime");

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `WP13.12B provider supply chain passed: ${sbom.components.length} locked components, fast-uri@3.1.5, exact package/audit/SBOM/license/remediation bindings, 0 moderate-or-higher vulnerabilities, 0 unknown licenses.`,
);
