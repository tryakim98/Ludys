import { access, cp, mkdir, rm, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webSource = join(repositoryRoot, "web");
const compiledSource = join(repositoryRoot, "dist", "src");
const outputRoot = join(repositoryRoot, "deploy");
const outputWeb = join(outputRoot, "web");
const outputCompiled = join(outputRoot, "dist", "src");

async function requireDirectory(path, label) {
  const metadata = await stat(path).catch(() => null);
  if (metadata === null || !metadata.isDirectory()) {
    throw new Error(`INSTALLABLE_ALPHA_${label}_DIRECTORY_REQUIRED`);
  }
}

async function requireFile(path, label) {
  await access(path, constants.R_OK).catch(() => {
    throw new Error(`INSTALLABLE_ALPHA_${label}_REQUIRED`);
  });
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1) {
    throw new Error(`INSTALLABLE_ALPHA_${label}_INVALID`);
  }
}

await requireDirectory(webSource, "WEB_SOURCE");
await requireDirectory(compiledSource, "COMPILED_SOURCE");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(webSource, outputWeb, { recursive: true, force: false });
await cp(compiledSource, outputCompiled, { recursive: true, force: false });

await Promise.all([
  requireFile(join(outputWeb, "index.html"), "INDEX"),
  requireFile(join(outputWeb, "manifest.webmanifest"), "MANIFEST"),
  requireFile(join(outputWeb, "service-worker.js"), "SERVICE_WORKER"),
  requireFile(join(outputWeb, "icons", "ludys-192.svg"), "ICON_192"),
  requireFile(join(outputWeb, "icons", "ludys-maskable.svg"), "ICON_MASKABLE"),
  requireFile(join(outputCompiled, "ui", "browser", "app.js"), "APP_ENTRY"),
  requireFile(join(outputCompiled, "ui", "browser", "pwa-status.js"), "PWA_STATUS"),
]);

console.log(JSON.stringify({
  status: "INSTALLABLE_ALPHA_OUTPUT_READY",
  output: "deploy",
  appEntry: "/web/index.html",
  manifest: "/web/manifest.webmanifest",
  serviceWorker: "/web/service-worker.js",
  containsPersonData: false,
  providerActivation: false,
  studentBetaAuthorized: false,
}, null, 2));
