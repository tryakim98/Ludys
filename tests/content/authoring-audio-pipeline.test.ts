import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateAudioProductionCandidate } from "../../src/core/authoring-pipeline.js";
import { wp13_9TechnicalAudioFixtures } from "../../src/content/authoring/wp13-9-technical-audio-fixtures.js";

const repo = fileURLToPath(new URL("../../..", import.meta.url));

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

test("technical fixture registry is capped and explicitly non-production", () => {
  assert.ok(wp13_9TechnicalAudioFixtures.length > 0 && wp13_9TechnicalAudioFixtures.length <= 4);
  for (const fixture of wp13_9TechnicalAudioFixtures) {
    assert.deepEqual(validateAudioProductionCandidate(fixture), []);
    assert.deepEqual(fixture.classification, ["INTERNAL_TECHNICAL_TRIAL_ONLY", "NOT_HUMAN_SPEECH", "NOT_REVIEWED", "NOT_PRODUCTION_AUDIO"]);
  }
});

test("tracked WAV fixtures have deterministic PCM mono headers and checksums", async () => {
  for (const fixture of wp13_9TechnicalAudioFixtures) {
    const bytes = await readFile(`${repo}/web/audio/technical/${fixture.fileName}`);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
    assert.equal(bytes.toString("ascii", 12, 16), "fmt ");
    assert.equal(bytes.readUInt16LE(20), 1);
    assert.equal(bytes.readUInt16LE(22), 1);
    assert.equal(bytes.readUInt32LE(24), 48000);
    assert.equal(bytes.readUInt16LE(34), fixture.bitDepth);
    assert.equal(bytes.toString("ascii", 36, 40), "data");
    assert.equal(sha256(bytes), fixture.assetSha256);
  }
});
