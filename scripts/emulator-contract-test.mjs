import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "wp13-12b-emulator-contract-"));
const notJar = join(directory, "firebase-emulator.txt");
const fakeJar = join(directory, "cloud-firestore-emulator-v-test.jar");
await writeFile(notJar, "not a jar", "utf8");
await writeFile(fakeJar, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]));

function run(path, sha256) {
  return spawnSync(process.execPath, [
    "scripts/emulator-import-wp13-12b.mjs",
    "--artifact",
    path,
    "--sha256",
    sha256,
  ], { encoding: "utf8" });
}

assert.notEqual(run(notJar, "0".repeat(64)).status, 0);
assert.match(run(notJar, "0".repeat(64)).stderr, /MUST_BE_JAR/);
assert.notEqual(run(fakeJar, "0".repeat(64)).status, 0);
assert.match(run(fakeJar, "0".repeat(64)).stderr, /CHECKSUM_MISMATCH/);
assert.notEqual(run(fakeJar, "not-a-checksum").status, 0);
assert.match(run(fakeJar, "not-a-checksum").stderr, /PUBLISHED_SHA256_REQUIRED/);
console.log("WP13.12B emulator import contract passed: non-JAR, invalid checksum and checksum mismatch fail closed.");
