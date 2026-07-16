import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const errors = [];
const pkg = JSON.parse(await readFile(join(repo, "package.json"), "utf8"));
const requiredVersion = "0.14.0-reconstructed.1";

if (pkg.name !== "ludys-app-reconstructed") errors.push(`unexpected package name: ${pkg.name}`);
if (pkg.version !== requiredVersion) errors.push(`version must be ${requiredVersion}, got ${pkg.version}`);
if (pkg.version === "0.13.1") errors.push("historical 0.13.1 may not be used as reconstructed package identity");

for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
  for (const name of Object.keys(pkg[section] ?? {})) {
    if (/^(?:@[^/]+\/)?ludus(?:-|$)/i.test(name)) errors.push(`LUDUS runtime dependency forbidden: ${name}`);
  }
}

const forbiddenNames = [/^\.env(?:\.|$)/i, /service[-_]?account/i, /credential/i, /private[-_]?key/i];
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
];
const skip = new Set([".git", "node_modules", "dist"]);

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = join(dir, entry.name);
    const rel = relative(repo, path).replaceAll("\\", "/");
    if (forbiddenNames.some((pattern) => pattern.test(entry.name))) errors.push(`forbidden file name: ${rel}`);
    if (entry.isDirectory()) await walk(path);
    else {
      const text = await readFile(path, "utf8").catch(() => "");
      if (secretPatterns.some((pattern) => pattern.test(text))) errors.push(`potential credential content: ${rel}`);
      if (/from\s+["'][^"']*(?:Vikingspill-main|\/Ludus\/|@ludus\/)/i.test(text)) {
        errors.push(`cross-product runtime import: ${rel}`);
      }
    }
  }
}

await walk(repo);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Reconstruction identity and boundary check passed.");
