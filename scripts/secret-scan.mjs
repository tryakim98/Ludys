import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const skip = new Set([".git", "node_modules", "dist"]);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
];
const errors = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (skip.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const text = await readFile(path, "utf8").catch(() => "");
      if (patterns.some((pattern) => pattern.test(text))) {
        errors.push(relative(repo, path));
      }
    }
  }
}

await walk(repo);
if (errors.length > 0) {
  console.error(`Potential secrets: ${errors.join(", ")}`);
  process.exit(1);
}
console.log("Secret scan passed.");
