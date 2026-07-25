import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const audit = await readJson("release/wp13-12b/provider-audit.json");
const sbom = await readJson("release/wp13-12b/provider-sbom.cdx.json");
const licenses = await readJson("release/wp13-12b/provider-license-inventory.json");
const lock = await readJson("provider/firebase/functions/package-lock.json");
const providerPackage = await readJson("provider/firebase/functions/package.json");
const errors = [];

if (audit.executed !== true) errors.push("provider audit was not executed");
if (audit.blocksExternalActivation !== false || audit.moderateOrHigher !== 0) {
  errors.push("provider audit has blocking findings");
}
if (sbom.bomFormat !== "CycloneDX" || sbom.specVersion !== "1.6" || sbom.components.length < 1) {
  errors.push("provider SBOM is invalid or empty");
}
if (licenses.unknownLicenseCount !== 0 || licenses.packages.length < 1) {
  errors.push("provider license inventory is invalid or incomplete");
}
if (
  lock.packages?.[""]?.dependencies?.["@google-cloud/functions-framework"] !== "5.0.5"
  || Object.keys(lock.packages?.[""]?.dependencies ?? {}).length !== 1
) errors.push("provider package lock direct pin or narrow boundary mismatch");
if (
  providerPackage.overrides?.cloudevents?.uuid !== "11.1.1"
  || lock.packages?.["node_modules/uuid"]?.version !== "11.1.1"
) {
  errors.push("provider security override mismatch");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`WP13.12B provider supply chain passed: ${sbom.components.length} locked components, 0 moderate-or-higher vulnerabilities, 0 unknown licenses.`);
