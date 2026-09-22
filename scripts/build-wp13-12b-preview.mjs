import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const config = JSON.parse(await readFile(resolve(repo, "web/staging-runtime-config.json"), "utf8"));
if (
  config.mode !== "LOCAL_SYNTHETIC_FIXTURE"
  || config.providerEnabled !== false
  || config.cloudResources !== 0
  || config.externalProviderCalls !== false
) throw new Error("staging preview runtime config failed closed");
const targets = [
  "web/staging-preview.html",
  "web/staging-runtime-config.json",
  "web/styles.css",
  "dist/src/ui/browser/staging-preview.js",
  "dist/src/application/synthetic-staging-preview-controller.js",
  "dist/src/core/synthetic-staging.js",
];
const files = [];
const combined = createHash("sha256");
for (const path of targets) {
  const bytes = await readFile(resolve(repo, path));
  const digest = createHash("sha256").update(bytes).digest("hex");
  files.push({ path, sha256: digest, bytes: bytes.byteLength });
  combined.update(path).update("\0").update(bytes);
}
const artifact = {
  schemaVersion: "wp13.12b-preview-build-v1",
  status: "LOCAL_PREVIEW_BUILD_COMPLETE_NOT_DEPLOYED",
  syntheticOnly: true,
  providerEnabled: false,
  cloudResources: 0,
  secrets: 0,
  providerCredentials: 0,
  externalProviderCalls: 0,
  vercelProjectCreated: false,
  vercelDeployment: false,
  protectionRequirement: "External preview must use separately authorized Vercel Deployment Protection.",
  digest: combined.digest("hex"),
  files,
};
const output = resolve(repo, "artifacts/wp13-12b-preview-build.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`WP13.12B local preview build passed: ${artifact.digest}; no deployment executed.`);
