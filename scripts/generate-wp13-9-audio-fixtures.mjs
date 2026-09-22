import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const outputDirectory = join(repo, "web", "audio", "technical");
const sampleRate = 48000;
const durationSeconds = 0.25;
const leadingSilenceMs = 50;
const trailingSilenceMs = 50;
const sampleCount = Math.round(sampleRate * durationSeconds);
const leadingSamples = Math.round(sampleRate * leadingSilenceMs / 1000);
const trailingSamples = Math.round(sampleRate * trailingSilenceMs / 1000);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function wavFixture({ fileName, frequency, bitDepth, script }) {
  const bytesPerSample = bitDepth / 8;
  const dataSize = sampleCount * bytesPerSample;
  const output = Buffer.alloc(44 + dataSize);
  output.write("RIFF", 0, "ascii");
  output.writeUInt32LE(36 + dataSize, 4);
  output.write("WAVE", 8, "ascii");
  output.write("fmt ", 12, "ascii");
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * bytesPerSample, 28);
  output.writeUInt16LE(bytesPerSample, 32);
  output.writeUInt16LE(bitDepth, 34);
  output.write("data", 36, "ascii");
  output.writeUInt32LE(dataSize, 40);
  const max = (2 ** (bitDepth - 1)) - 1;
  const amplitude = Math.round(max * (10 ** (-6 / 20)));
  let observedPeak = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const active = index >= leadingSamples && index < sampleCount - trailingSamples;
    const value = active ? Math.round(amplitude * Math.sin(2 * Math.PI * frequency * (index / sampleRate))) : 0;
    observedPeak = Math.max(observedPeak, Math.abs(value));
    const offset = 44 + (index * bytesPerSample);
    if (bitDepth === 16) output.writeInt16LE(value, offset);
    else {
      const encoded = value < 0 ? value + 0x1000000 : value;
      output[offset] = encoded & 0xff;
      output[offset + 1] = (encoded >> 8) & 0xff;
      output[offset + 2] = (encoded >> 16) & 0xff;
    }
  }
  return {
    fileName,
    output,
    metadata: {
      sampleRate,
      bitDepth,
      durationSeconds,
      peakDbfs: Number((20 * Math.log10(observedPeak / max)).toFixed(4)),
      leadingSilenceMs,
      trailingSilenceMs,
      assetSha256: sha256(output),
      scriptSha256: sha256(script),
      script,
    },
  };
}

const fixtures = [
  wavFixture({ fileName: "wp13-9-technical-tone-a-48k-24bit-mono.wav", frequency: 440, bitDepth: 24, script: "TECHNICAL_TONE_440HZ" }),
  wavFixture({ fileName: "wp13-9-technical-tone-b-48k-16bit-mono.wav", frequency: 660, bitDepth: 16, script: "TECHNICAL_TONE_660HZ" }),
];

await mkdir(outputDirectory, { recursive: true });
for (const fixture of fixtures) await writeFile(join(outputDirectory, fixture.fileName), fixture.output);
console.log(JSON.stringify(fixtures.map(({ fileName, metadata }) => ({ fileName, ...metadata })), null, 2));
