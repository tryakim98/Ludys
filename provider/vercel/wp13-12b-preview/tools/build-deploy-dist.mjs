import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCopyReview } from "./copy-review-preflight.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const STATIC_DEPLOY_PATHS = Object.freeze([
  "app.mjs",
  "index.html",
  "lib/reviewed-copy.mjs",
  "locales/nb.mjs",
  "locales/nn.mjs",
  "styles.css",
]);

function buildError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export async function buildDeployDist({
  sourceRoot = root,
  outputRoot = dist,
  evaluateCopyReviewImpl = evaluateCopyReview,
} = {}) {
  const expectedOutput = resolve(sourceRoot, "dist");
  if (resolve(outputRoot) !== expectedOutput) {
    throw buildError("VERCEL_DIST_TARGET_MUST_BE_EXACT");
  }
  const copyReview = await evaluateCopyReviewImpl({
    root: sourceRoot,
  });
  if (
    copyReview?.valid !== true
    || copyReview?.deploymentAllowed !== true
    || copyReview?.externalWrites !== 0
    || !/^[a-f0-9]{64}$/u.test(copyReview?.sourceSetSha256 ?? "")
  ) throw buildError("PREVIEW_COPY_REVIEW_PREFLIGHT_REQUIRED");

  await rm(outputRoot, { recursive: true, force: true });
  const files = [];
  for (const path of STATIC_DEPLOY_PATHS) {
    const source = resolve(sourceRoot, path);
    const target = resolve(outputRoot, path);
    const expectedPrefix = `${resolve(outputRoot)}\\`;
    const portablePrefix = `${resolve(outputRoot)}/`;
    if (
      target !== resolve(outputRoot)
      && !target.startsWith(expectedPrefix)
      && !target.startsWith(portablePrefix)
    ) throw buildError("VERCEL_DIST_PATH_ESCAPE");
    const bytes = await readFile(source);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    files.push(Object.freeze({
      path: relative(sourceRoot, source).replaceAll("\\", "/"),
      bytes: bytes.byteLength,
      sha256,
    }));
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const artifactSha256 = createHash("sha256")
    .update(files.map((file) => (
      `${file.path}\0${file.bytes}\0${file.sha256}`
    )).join("\n"), "utf8")
    .digest("hex");
  const manifest = Object.freeze({
    schemaVersion: "wp13.12b-vercel-static-dist-v1",
    sourceSetSha256: copyReview.sourceSetSha256,
    artifactSha256,
    files: Object.freeze(files),
  });
  await writeFile(
    join(outputRoot, ".ludys-artifact-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return manifest;
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && resolve(invokedPath) === fileURLToPath(import.meta.url)
) {
  const manifest = await buildDeployDist();
  process.stdout.write(`${JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    artifactSha256: manifest.artifactSha256,
    fileCount: manifest.files.length,
  })}\n`);
}
