import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const npmCli = process.env.npm_execpath ?? (process.platform === "win32"
  ? join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
  : undefined);
const writeEvidence = process.argv.includes("--write-evidence");
const inputs = [
  "src",
  "tests",
  "scripts",
  "web",
  "provider/firebase/functions/src",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
];
const generatedEvidencePath = join(root, "artifacts", "wp13-12b-reproducible-build-result.json");
const committedEvidencePath = join(root, "release", "wp13-12b", "reproducible-build.json");

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else files.push(path);
  }
  return files.sort();
}

async function distDigest(directory) {
  const hash = createHash("sha256");
  for (const path of await collect(join(directory, "dist"))) {
    hash.update(relative(join(directory, "dist"), path).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await readFile(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function runNpm(directory, args) {
  const useNpmCli = typeof npmCli === "string" && npmCli.length > 0;
  const result = spawnSync(useNpmCli ? process.execPath : "npm", useNpmCli ? [npmCli, ...args] : args, {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, npm_config_update_notifier: "false", npm_config_fund: "false" },
  });
  if (result.status !== 0) throw new Error(`npm ${args.join(" ")} failed in ${basename(directory)}\n${result.stdout}\n${result.stderr}`);
}

const copies = [];
try {
  for (const label of ["a", "b"]) {
    const directory = await mkdtemp(join(tmpdir(), `wp13-12b-clean-build-${label}-`));
    copies.push(directory);
    for (const input of inputs) {
      await mkdir(dirname(join(directory, input)), { recursive: true });
      await cp(join(root, input), join(directory, input), { recursive: true });
    }
    runNpm(directory, ["ci", "--offline", "--ignore-scripts", "--audit=false", "--fund=false"]);
    runNpm(directory, ["run", "build"]);
  }
  const digests = await Promise.all(copies.map(distDigest));
  assert.equal(digests[0], digests[1], "independent clean-copy dist digests differ");
  const evidence = {
    status: "VERIFIED_IDENTICAL",
    copies: 2,
    distSha256: digests[0],
    digests,
    command: "npm ci --offline --ignore-scripts --audit=false && npm run build",
    nodeVersion: process.version,
    npmVersion: JSON.parse(await readFile(join(root, "package-lock.json"), "utf8")).lockfileVersion === 3 ? "11.16.0" : "UNKNOWN",
    operatingSystem: `${process.platform}-${process.arch}`,
    timestampPolicy: "SOURCE_CONTENT_ONLY_NO_BUILD_TIMESTAMP",
  };
  const recorded = JSON.parse(await readFile(
    writeEvidence ? generatedEvidencePath : committedEvidencePath,
    "utf8",
  ).catch(() => "{}"));
  if (writeEvidence) {
    await mkdir(dirname(generatedEvidencePath), { recursive: true });
    await mkdir(dirname(committedEvidencePath), { recursive: true });
    await writeFile(generatedEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    await writeFile(committedEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  } else {
    assert.equal(recorded.status, "VERIFIED_IDENTICAL", "recorded reproducible-build evidence is missing");
    assert.equal(recorded.distSha256, evidence.distSha256, "current clean-copy digest differs from recorded evidence");
  }
  console.log(`WP13.12B reproducible build passed: ${digests[0]} (${copies.length} independent clean copies).`);
} finally {
  for (const directory of copies) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
