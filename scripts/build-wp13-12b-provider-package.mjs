import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertExactProviderRuntimeImportClosure,
  providerFunctionsSourceRoot,
  providerPackageArtifactPath,
  providerPackageFilePaths,
  providerPackageFileScope,
  providerPackageRuntimeModulePaths,
  providerPackageSchemaVersion,
  providerSourceDigest,
} from "./wp13-12b-provider-package-contract.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
if (
  argv.length > 1
  || (argv.length === 1 && argv[0] !== "--check")
) throw new Error("usage: build-wp13-12b-provider-package.mjs [--check]");
const checkOnly = argv[0] === "--check";
const lib = resolve(repo, "provider/firebase/functions/lib");
const providerRoot = resolve(repo, providerFunctionsSourceRoot);

function normalizedPath(path) {
  const normalized = resolve(path).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

if (
  relative(providerRoot, lib).replaceAll("\\", "/") !== "lib"
  || normalizedPath(lib) === normalizedPath(providerRoot)
) {
  throw new Error("provider lib target escaped provider package");
}

async function assertRealDirectory(path, label) {
  const stats = await lstat(path);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory`);
  }
  if (normalizedPath(await realpath(path)) !== normalizedPath(path)) {
    throw new Error(`${label} must not be a reparse path`);
  }
}

try {
  await assertRealDirectory(lib, "provider lib target");
} catch (error) {
  if (error?.code !== "ENOENT" || checkOnly) throw error;
}
if (!checkOnly) {
  await rm(lib, { recursive: true, force: true });
  await mkdir(lib, { recursive: true });
}

const compiledClosure = [
  [
    "dist/provider/firebase/functions/src/authoritative-handler.js",
    "provider/firebase/functions/lib/provider/firebase/functions/src/authoritative-handler.js",
  ],
  [
    "dist/src/core/evidence.js",
    "provider/firebase/functions/lib/src/core/evidence.js",
  ],
  [
    "dist/src/core/reliability-hardening.js",
    "provider/firebase/functions/lib/src/core/reliability-hardening.js",
  ],
  [
    "dist/src/core/session-lifecycle.js",
    "provider/firebase/functions/lib/src/core/session-lifecycle.js",
  ],
  [
    "dist/src/core/state.js",
    "provider/firebase/functions/lib/src/core/state.js",
  ],
  [
    "dist/src/core/synthetic-staging.js",
    "provider/firebase/functions/lib/src/core/synthetic-staging.js",
  ],
];

function deployableCompiledBytes(bytes, sourcePath) {
  const source = bytes.toString("utf8");
  const marker =
    /\r?\n\/\/# sourceMappingURL=[A-Za-z0-9._-]+\.js\.map\r?\n?$/u;
  if (!marker.test(source)) {
    throw new Error(
      `compiled provider source-map marker missing: ${sourcePath}`,
    );
  }
  return Buffer.from(`${source.replace(marker, "")}\n`, "utf8");
}

for (const [sourcePath, destinationPath] of compiledClosure) {
  const source = resolve(repo, sourcePath);
  const destination = resolve(repo, destinationPath);
  const sourceStats = await lstat(source);
  if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
    throw new Error(`provider compiled source is not a regular file: ${sourcePath}`);
  }
  if (
    !normalizedPath(destination).startsWith(`${normalizedPath(lib)}/`)
  ) throw new Error("provider compiled destination escaped validated lib");
  const sourceBytes = deployableCompiledBytes(
    await readFile(source),
    sourcePath,
  );
  if (checkOnly) {
    const destinationStats = await lstat(destination);
    if (
      !destinationStats.isFile()
      || destinationStats.isSymbolicLink()
      || normalizedPath(await realpath(destination))
        !== normalizedPath(destination)
      || !(await readFile(destination)).equals(sourceBytes)
    ) throw new Error(
      `provider compiled output drifted from dist: ${destinationPath}`,
    );
  } else {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, sourceBytes);
  }
}

async function collectLibFiles(directory) {
  await assertRealDirectory(directory, "provider lib directory");
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = resolve(directory, entry.name);
    const stats = await lstat(target);
    if (stats.isSymbolicLink()) {
      throw new Error("provider lib must not contain symlink/reparse entries");
    }
    if (entry.isDirectory() && stats.isDirectory()) {
      paths.push(...await collectLibFiles(target));
    } else if (entry.isFile() && stats.isFile()) {
      if (
        normalizedPath(await realpath(target)) !== normalizedPath(target)
      ) throw new Error("provider lib must not contain reparse files");
      paths.push(relative(repo, target).replaceAll("\\", "/"));
    } else {
      throw new Error("provider lib must contain regular files only");
    }
  }
  return paths;
}

const expectedLibFiles =
  compiledClosure.map(([, destinationPath]) => destinationPath).sort();
const observedLibFiles = (await collectLibFiles(lib)).sort();
if (
  JSON.stringify(observedLibFiles) !== JSON.stringify(expectedLibFiles)
) throw new Error("provider lib exact minimal file set mismatch");

const files = [];
const moduleTextByPath = {};
for (const path of providerPackageFilePaths) {
  const bytes = await readFile(resolve(repo, path));
  files.push({ path, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength });
  if (providerPackageRuntimeModulePaths.includes(path)) {
    moduleTextByPath[path] = bytes.toString("utf8");
  }
}
assertExactProviderRuntimeImportClosure(moduleTextByPath);

const manifest = {
  schemaVersion: providerPackageSchemaVersion,
  status: "LOCAL_DEPLOYABLE_PACKAGE_GENERATED_NOT_DEPLOYED",
  sourceCommit: "PENDING_FINAL_COMMIT_NOT_A_RECEIPT",
  stagingProviderReleaseId: "wp13-12b-synthetic-staging-provider-r1",
  functionsRuntime: "nodejs24",
  region: "europe-north1",
  providerActivation: "BLOCKED",
  cloudResources: 0,
  sourceRoot: providerFunctionsSourceRoot,
  fileScope: providerPackageFileScope,
  fileCount: files.length,
  functionsSourceSha256: providerSourceDigest(files),
  files,
};
const output = resolve(repo, providerPackageArtifactPath);
const manifestBytes = Buffer.from(
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
if (checkOnly) {
  if (!(await readFile(output)).equals(manifestBytes)) {
    throw new Error("provider package artifact drifted from exact source bytes");
  }
  console.log(
    `WP13.12B provider package verified read-only (${files.length} bound files); no filesystem or provider mutation executed.`,
  );
} else {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, manifestBytes);
  console.log(`WP13.12B provider package generated locally (${files.length} bound files); no deployment executed.`);
}
