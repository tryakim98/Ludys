import { createHash } from "node:crypto";
import { copyFile, mkdir, open, readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const artifact = args.get("--artifact");
const expectedSha256 = args.get("--sha256");
if (!artifact || !expectedSha256) throw new Error("EXACT_ARTIFACT_AND_SHA256_REQUIRED");
if (extname(artifact).toLowerCase() !== ".jar") throw new Error("EMULATOR_ARTIFACT_MUST_BE_JAR");
if (!/^[a-f0-9]{64}$/u.test(expectedSha256)) throw new Error("PUBLISHED_SHA256_REQUIRED");
const resolved = resolve(artifact);
const bytes = await readFile(resolved);
const localFileHeader = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
const endOfCentralDirectory = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const manifestEntry = bytes.lastIndexOf(Buffer.from("META-INF/MANIFEST.MF", "ascii"));
const conventionalJar = localFileHeader === 0;
const selfExtractingJar = (
  localFileHeader > 0
  && manifestEntry > localFileHeader
  && endOfCentralDirectory > manifestEntry
);
if (!conventionalJar && !selfExtractingJar) throw new Error("EMULATOR_ARTIFACT_NOT_A_JAR");
const actual = createHash("sha256").update(bytes).digest("hex");
if (actual !== expectedSha256) throw new Error("EMULATOR_ARTIFACT_CHECKSUM_MISMATCH");
const cache = resolve(repo, "provider/firebase/.emulator-cache");
if (!cache.startsWith(resolve(repo, "provider/firebase"))) throw new Error("EMULATOR_CACHE_PATH_INVALID");
await mkdir(cache, { recursive: true });
const target = resolve(cache, basename(resolved));
await copyFile(resolved, target);
const handle = await open(target, "r");
await handle.close();
console.log(JSON.stringify({
  imported: true,
  filename: basename(target),
  archiveForm: selfExtractingJar ? "SELF_EXTRACTING_JAR" : "CONVENTIONAL_JAR",
  sha256: actual,
  cloudResources: 0,
}));
