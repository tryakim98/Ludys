import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectPackagePolicy, inspectSourcePolicy } from "./source-policy.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const src = join(repo, "src");
const packageJson = JSON.parse(await readFile(join(repo, "package.json"), "utf8"));
const errors = inspectPackagePolicy(packageJson);
const legacyScope = JSON.parse(await readFile(join(repo, "config/legacy-proof-scope.json"), "utf8"));
const legacyProofFiles = new Set(legacyScope.files);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(path)));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

for (const file of await collect(src)) {
  const rel = relative(repo, file).replaceAll("\\", "/");
  const text = await readFile(file, "utf8");
  errors.push(...inspectSourcePolicy(rel, text, legacyProofFiles));
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Static check passed: scoped historical proof and retained Skynja protections.");
