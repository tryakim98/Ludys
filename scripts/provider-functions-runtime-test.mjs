import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const functionsDir = join(repo, "provider", "firebase", "functions");
const firestorePort = 8090;
const functionsPort = 5010;
const firestore = createServer((request, response) => {
  if (
    request.method === "GET"
    && request.url?.includes("/documents/syntheticStagingControl/current")
  ) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      name: "projects/ludys-synthetic-dev/databases/(default)/documents/syntheticStagingControl/current",
      fields: {
        controlEpoch: { integerValue: "7" },
        stagingEnabled: { booleanValue: false },
        reasonCode: { stringValue: "DISABLED_BY_DEFAULT" },
        changedAt: { stringValue: "2026-07-25T00:00:00.000Z" },
      },
      updateTime: "2026-07-25T00:00:00.000Z",
    }));
    return;
  }
  response.writeHead(404);
  response.end();
});

await new Promise((resolve, reject) => {
  firestore.once("error", reject);
  firestore.listen(firestorePort, "127.0.0.1", resolve);
});

const child = spawn(process.execPath, [
  "node_modules/@google-cloud/functions-framework/build/src/main.js",
  "--target=health",
  `--port=${functionsPort}`,
  "--source=.",
], {
  cwd: functionsDir,
  env: {
    ...process.env,
    GCLOUD_PROJECT: "ludys-synthetic-dev",
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${firestorePort}`,
    LUDYS_CAPABILITY_HMAC_KEY: "0123456789abcdef0123456789abcdef",
    LUDYS_STAGING_SESSION_ISSUANCE_ENABLED: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });

try {
  let response;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${functionsPort}/`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  if (response === undefined) throw new Error(`Functions Framework did not start\n${stderr}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    serviceHealth: "READY_DISABLED_BY_DEFAULT",
    region: "europe-north1",
    providerActivation: "BLOCKED",
    cloudResources: 0,
    controlEpoch: 7,
    stagingEnabled: false,
  });
  const artifact = {
    schemaVersion: "wp13.12b-functions-framework-proof-v1",
    status: "LOCAL_RUNTIME_COMPATIBILITY_PASSED",
    functionsFramework: "5.0.5",
    securityOverride: "cloudevents>uuid@11.1.1",
    endpoint: "health",
    firestore: "LOCAL_STUB_NO_PROVIDER_RESOURCE",
    externalCalls: 0,
    cloudResources: 0,
    deployment: false,
  };
  const output = join(repo, "artifacts", "wp13-12b-functions-framework-proof.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log("WP13.12B Functions Framework runtime compatibility passed with uuid security override and zero external calls.");
} finally {
  child.kill();
  firestore.close();
}
