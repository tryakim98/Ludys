import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { loadCanonSnapshot, validateCanonSnapshot } from "./canon-check.mjs";
import { inspectSourcePolicy, inspectPackagePolicy } from "./source-policy.mjs";

test("canon source alteration or a rewritten manifest is caught before rules can silently change", async () => {
  const snapshot = await loadCanonSnapshot();
  assert.deepEqual(validateCanonSnapshot(snapshot), []);
  snapshot.files.set("AGENT_BOOTSTRAP.md", Buffer.from("changed policy"));
  assert.ok(validateCanonSnapshot(snapshot).some((error) => error.includes("source file integrity")));
  const replacementHash = createHash("sha256").update(snapshot.files.get("AGENT_BOOTSTRAP.md")).digest("hex");
  const rewritten = snapshot.files.get("MANIFEST_SHA256.txt").toString("utf8").replace(/^[a-f0-9]{64}/, replacementHash);
  snapshot.files.set("MANIFEST_SHA256.txt", Buffer.from(rewritten));
  assert.ok(validateCanonSnapshot(snapshot).includes("source manifest identity mismatch"));
});

test("dropping a principle or pretending adoption grants real-use activation is rejected", async () => {
  const snapshot = await loadCanonSnapshot();
  snapshot.integration.principles.pop();
  snapshot.integration.runtimeActivation = "ACTIVATED";
  const errors = validateCanonSnapshot(snapshot);
  assert.ok(errors.includes("local integration map is incomplete or duplicated"));
  assert.ok(errors.some((error) => error.includes("must not masquerade")));
});

test("dropping historical modules does not silently remove their proof constraints", async () => {
  const snapshot = await loadCanonSnapshot();
  const legacy = JSON.parse(snapshot.legacyBytes.toString("utf8"));
  legacy.files.pop();
  snapshot.legacyBytes = Buffer.from(JSON.stringify(legacy));
  assert.ok(validateCanonSnapshot(snapshot).includes("legacy proof scope changed without a recorded migration"));
});

test("historical action/profile/multimodal restrictions stay scoped and do not resurrect as global product rules", () => {
  const legacy = new Set(["src/core/word-proof.ts"]);
  const syntheticFutureContract = 'interface Continuity { userId: string } const supported = "GENERATE_COACHING"; // speechSynthesis';
  assert.equal(inspectSourcePolicy("src/core/word-proof.ts", syntheticFutureContract, legacy).length, 3);
  assert.deepEqual(inspectSourcePolicy("src/core/skynja/example.ts", syntheticFutureContract, legacy), []);
});

test("new modules still cannot grant pilot access, rank users or add unreviewed providers", () => {
  const legacy = new Set();
  for (const code of ["const pilotAuthorized = { pilotAuthorized: true };", "const kind = 'RANK_CHILD';", "element.autoplay = true;"]) {
    assert.ok(inspectSourcePolicy("src/core/skynja/example.ts", code, legacy).length > 0);
  }
  assert.ok(inspectPackagePolicy({ dependencies: { openai: "1.0.0" } }).length > 0);
  assert.ok(inspectSourcePolicy("src/core/skynja/example.ts", 'import x from "openai";', legacy).length > 0);
});
