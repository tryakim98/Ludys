import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAudio,
  validateBundle,
  validateMessage,
  type AudioSpecification,
  type MessageContract,
} from "../../src/core/content-contracts.js";
import { humanFirstBundleNb } from "../../src/content/fixtures/bm/human-first-bundle.js";
import { humanFirstBundleNn } from "../../src/content/fixtures/nn/human-first-bundle.js";

test("BM and NN bundles are reference-closed and valid", () => {
  assert.deepEqual(validateBundle(humanFirstBundleNb), []);
  assert.deepEqual(validateBundle(humanFirstBundleNn), []);
});

test("generic praise and relational claims are rejected", () => {
  const bad: MessageContract = {
    ...humanFirstBundleNb.messages[0]!,
    text: "Fantastisk jobbet! Jeg er stolt av deg.",
  };
  assert.ok(validateMessage(bad).length >= 2);
});

test("audio contract rejects direct file-path extensions", () => {
  const withPath = {
    ...humanFirstBundleNb.audio,
    filePath: "/assets/audio.mp3",
  } as unknown as AudioSpecification;
  assert.ok(validateAudio(withPath).some((error) => error.includes("unknown audio fields")));
});

test("stimulus audio must require a human voice", () => {
  const invalid: AudioSpecification = {
    ...humanFirstBundleNb.audio,
    audioRole: "STIMULUS",
    constructSensitivity: "HIGH",
    voiceSourcePolicy: "ASSISTIVE_SYSTEM_VOICE_ALLOWED",
  };
  assert.ok(validateAudio(invalid).some((error) => error.includes("requires human voice")));
});

import { validateWordProofDefinition } from "../../src/core/word-proof.js";
import { wordProofNb } from "../../src/content/fixtures/bm/word-proof.js";
import { wordProofNn } from "../../src/content/fixtures/nn/word-proof.js";
import { wordProofContentNb } from "../../src/content/fixtures/bm/word-proof-content.js";
import { wordProofContentNn } from "../../src/content/fixtures/nn/word-proof-content.js";

test("WP13.2 word proof definitions and content bundles are reference-closed", () => {
  assert.deepEqual(validateWordProofDefinition(wordProofNb), []);
  assert.deepEqual(validateWordProofDefinition(wordProofNn), []);
  assert.deepEqual(validateBundle(wordProofContentNb), []);
  assert.deepEqual(validateBundle(wordProofContentNn), []);
  assert.equal(wordProofContentNb.activityId, wordProofNb.activityId);
  assert.equal(wordProofContentNn.activityId, wordProofNn.activityId);
});
