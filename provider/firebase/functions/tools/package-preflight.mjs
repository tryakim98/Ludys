import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(
  new URL("../package-lock.json", import.meta.url),
  "utf8",
));
const errors = [];
const fastUriEntries = Object.entries(lock.packages ?? {})
  .filter(([path]) => path === "node_modules/fast-uri");
const fastUri = fastUriEntries[0]?.[1];

if (manifest.type !== "module") errors.push("functions package must use ESM");
if (manifest.engines?.node !== "24") errors.push("functions package must pin Node 24");
if (manifest.dependencies?.["@google-cloud/functions-framework"] !== "5.0.5") errors.push("Functions Framework pin mismatch");
if (Object.keys(manifest.dependencies ?? {}).length !== 1) errors.push("provider runtime must keep a single narrow dependency");
if (manifest.overrides?.cloudevents?.uuid !== "11.1.1") errors.push("cloudevents uuid security override mismatch");
if (
  fastUriEntries.length !== 1
  || fastUri?.version !== "3.1.5"
  || fastUri?.resolved
    !== "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.5.tgz"
  || fastUri?.integrity
    !== "sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw=="
) errors.push("fast-uri security remediation lock mismatch");
if (basename(root) !== "functions") {
  errors.push("preflight must execute inside isolated functions package");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Isolated Firebase Functions package preflight passed.");
