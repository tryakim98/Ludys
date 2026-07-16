import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const src = join(repo, "src");
const errors = [];

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

function layer(path) {
  const normalized = relative(src, path).replaceAll("\\", "/");
  return normalized.split("/")[0];
}

const allowed = {
  core: new Set(["core"]),
  ports: new Set(["core", "ports"]),
  application: new Set(["core", "ports", "application"]),
  adapters: new Set(["core", "ports", "application", "adapters"]),
  content: new Set(["core", "content"]),
  composition: new Set(["core", "ports", "application", "adapters", "content", "composition"]),
  ui: new Set(["core", "application", "content", "composition", "ui"]),
};

for (const file of await collect(src)) {
  const text = await readFile(file, "utf8");
  const from = layer(file);
  for (const match of text.matchAll(/from\s+["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) {
      errors.push(`${relative(repo, file)}: external import ${specifier}`);
      continue;
    }
    const target = resolve(dirname(file), specifier.replace(/\.js$/, ".ts"));
    const to = layer(target);
    if (!allowed[from]?.has(to)) {
      errors.push(`${relative(repo, file)}: ${from} may not import ${to} (${specifier})`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Architecture boundary check passed.");
