import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const lib = resolve(repo, "provider/firebase/functions/lib");
const providerRoot = resolve(repo, "provider/firebase/functions");
if (!lib.startsWith(`${providerRoot}\\`) && !lib.startsWith(`${providerRoot}/`)) {
  throw new Error("provider lib target escaped provider package");
}
await rm(lib, { recursive: true, force: true });
await mkdir(lib, { recursive: true });
await cp(resolve(repo, "dist/src/core"), resolve(lib, "src/core"), { recursive: true });
await cp(
  resolve(repo, "dist/provider/firebase/functions/src"),
  resolve(lib, "provider/firebase/functions/src"),
  { recursive: true },
);

const targets = [
  "provider/firebase/functions/index.mjs",
  "provider/firebase/functions/firestore-store.mjs",
  "provider/firebase/functions/package.json",
  "provider/firebase/functions/package-lock.json",
  "provider/firebase/functions/lib/provider/firebase/functions/src/authoritative-handler.js",
  "provider/firebase/functions/lib/src/core/synthetic-staging.js",
];
const files = [];
for (const path of targets) {
  const bytes = await readFile(resolve(repo, path));
  files.push({ path, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength });
}
const manifest = {
  schemaVersion: "wp13.12b-provider-package-v1",
  status: "LOCAL_DEPLOYABLE_PACKAGE_GENERATED_NOT_DEPLOYED",
  sourceCommit: "PENDING_FINAL_COMMIT_NOT_A_RECEIPT",
  stagingProviderReleaseId: "wp13-12b-synthetic-staging-provider-r1",
  functionsRuntime: "nodejs24",
  region: "europe-north1",
  providerActivation: "BLOCKED",
  cloudResources: 0,
  files,
};
const output = resolve(repo, "artifacts/wp13-12b-provider-package.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`WP13.12B provider package generated locally (${files.length} bound files); no deployment executed.`);
