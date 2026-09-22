import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const externalActivationChecksumManifestPath =
  "release/wp13-12b/external-activation/artifact-checksums.sha256";

export const externalActivationChecksumTargets = Object.freeze([
  ".gitattributes",
  ".gitignore",
  "artifacts/wp13-12b-actual-emulator-proof-aea01ab.json",
  "artifacts/wp13-12b-provider-package.json",
  "package.json",
  "provider/firebase/.firebaserc.example",
  "provider/firebase/firebase.json",
  "provider/firebase/firestore.indexes.json",
  "provider/firebase/firestore.rules",
  "provider/firebase/functions/.gcloudignore",
  "provider/firebase/functions/firestore-store.mjs",
  "provider/firebase/functions/functions.yaml",
  "provider/firebase/functions/index.mjs",
  "provider/firebase/functions/lib/provider/firebase/functions/src/authoritative-handler.js",
  "provider/firebase/functions/lib/src/core/evidence.js",
  "provider/firebase/functions/lib/src/core/reliability-hardening.js",
  "provider/firebase/functions/lib/src/core/session-lifecycle.js",
  "provider/firebase/functions/lib/src/core/state.js",
  "provider/firebase/functions/lib/src/core/synthetic-staging.js",
  "provider/firebase/functions/package-lock.json",
  "provider/firebase/functions/package.json",
  "provider/firebase/functions/src/authoritative-handler.ts",
  "provider/firebase/functions/src/in-memory-store.ts",
  "provider/firebase/functions/tools/package-preflight.mjs",
  "provider/firebase/staging.env.example",
  "provider/firebase/tools/seed-synthetic-fixtures.mjs",
  "provider/firebase/tools/set-staging-control.mjs",
  "provider/vercel/wp13-12b-preview/.vercelignore",
  "provider/vercel/wp13-12b-preview/README.md",
  "provider/vercel/wp13-12b-preview/api/delete.mjs",
  "provider/vercel/wp13-12b-preview/api/issue.mjs",
  "provider/vercel/wp13-12b-preview/api/runtime-config.mjs",
  "provider/vercel/wp13-12b-preview/app.mjs",
  "provider/vercel/wp13-12b-preview/copy-review-contract.json",
  "provider/vercel/wp13-12b-preview/index.html",
  "provider/vercel/wp13-12b-preview/lib/google-identity.mjs",
  "provider/vercel/wp13-12b-preview/lib/http.mjs",
  "provider/vercel/wp13-12b-preview/lib/private-function-proxy.mjs",
  "provider/vercel/wp13-12b-preview/lib/reviewed-copy.mjs",
  "provider/vercel/wp13-12b-preview/lib/runtime-config.mjs",
  "provider/vercel/wp13-12b-preview/locales/nb.mjs",
  "provider/vercel/wp13-12b-preview/locales/nn.mjs",
  "provider/vercel/wp13-12b-preview/styles.css",
  "provider/vercel/wp13-12b-preview/tests/api-security.test.mjs",
  "provider/vercel/wp13-12b-preview/tests/locale-fail-closed-browser.test.mjs",
  "provider/vercel/wp13-12b-preview/tests/source-contract.test.mjs",
  "provider/vercel/wp13-12b-preview/tools/build-deploy-dist.mjs",
  "provider/vercel/wp13-12b-preview/tools/copy-review-preflight.mjs",
  "provider/vercel/wp13-12b-preview/tools/record-copy-review.mjs",
  "provider/vercel/wp13-12b-preview/vercel.json",
  "provider/firebase/tools/operator-gate-contract.mjs",
  "release/wp13-12b/activation-handoff/destruction-plan.json",
  "release/wp13-12b/activation-handoff/emulator-import-contract.json",
  "release/wp13-12b/activation-handoff/iam-and-secrets-plan.json",
  "release/wp13-12b/activation-handoff/operator-tasks.json",
  "release/wp13-12b/activation-handoff/physical-two-device-proof-template.json",
  "release/wp13-12b/activation-handoff/receipt-contracts.json",
  "release/wp13-12b/activation-handoff/rollback-plan.json",
  "release/wp13-12b/external-activation/cloud-field-approval.json",
  "release/wp13-12b/external-activation/deploy-identity-contract.json",
  "release/wp13-12b/external-activation/expiry-destruction-execution-contract.json",
  "release/wp13-12b/external-activation/external-activation-provenance.json",
  "release/wp13-12b/external-activation/external-activation-state.json",
  "release/wp13-12b/external-activation/external-activation-state.schema.json",
  "release/wp13-12b/external-activation/owner-authorization.json",
  "release/wp13-12b/external-activation/resource-inventory-contract.json",
  "release/wp13-12b/external-activation/resource-inventory.json",
  "release/wp13-12b/external-activation/resource-inventory.schema.json",
  "release/wp13-12b/external-activation/vercel-google-trust-contract.json",
  "release/wp13-12b/external-activation/vercel-cli-tooling-risk.json",
  "release/wp13-12b/receipts/actual/emulator-proof-receipt-2026-07-26.json",
  "release/wp13-12b/provider-security-remediation.json",
  "scripts/browser-wp13-12b-staging-test.mjs",
  "scripts/build-wp13-12b-preview.mjs",
  "scripts/build-wp13-12b-provider-package.mjs",
  "scripts/generate-wp13-12b-staging.mjs",
  "scripts/classify-emulator-wp13-12b.mjs",
  "scripts/emulator-import-wp13-12b.mjs",
  "scripts/provider-external-account-preflight.mjs",
  "scripts/provider-external-activation-orchestrator-test.mjs",
  "scripts/provider-external-activation-orchestrator.mjs",
  "scripts/provider-external-cloud-control-gate.mjs",
  "scripts/provider-external-cloud-control-test.mjs",
  "scripts/provider-external-cloud-control.mjs",
  "scripts/provider-external-deploy-identity-control.mjs",
  "scripts/provider-external-deploy-identity-test.mjs",
  "scripts/provider-external-function-deploy.mjs",
  "scripts/provider-external-vercel-control.mjs",
  "scripts/provider-external-vercel-control-test.mjs",
  "scripts/provider-external-vercel-preview-deploy.mjs",
  "scripts/provider-external-wif-compensation.mjs",
  "scripts/provider-external-wif-control-test.mjs",
  "scripts/provider-external-wif-control.mjs",
  "scripts/provider-external-wif-mutation-gate.mjs",
  "scripts/provider-functions-runtime-test.mjs",
  "scripts/provider-staging-operator-gates-test.mjs",
  "scripts/run-wp13-12b-emulator-proof.mjs",
  "scripts/serve-proof.mjs",
  "scripts/validate-wp13-12b-external-activation.mjs",
  "scripts/validate-wp13-12b-receipt.mjs",
  "scripts/validate-wp13-12b-staging.mjs",
  "scripts/wp13-12b-activation-phase-gate-test.mjs",
  "scripts/wp13-12b-activation-phase-gate.mjs",
  "scripts/wp13-12b-canonical-git-paths.mjs",
  "scripts/wp13-12b-external-activation-checksums.mjs",
  "scripts/wp13-12b-external-resource-operator-test.mjs",
  "scripts/wp13-12b-external-resource-operator.mjs",
  "scripts/wp13-12b-google-oauth-token-helper.cjs",
  "scripts/wp13-12b-emulator-proof-state-test.mjs",
  "scripts/wp13-12b-emulator-confirmation-test.mjs",
  "scripts/wp13-12b-emulator-confirmation.mjs",
  "scripts/wp13-12b-deploy-identity.mjs",
  "scripts/wp13-12b-external-process-boundary-test.mjs",
  "scripts/wp13-12b-external-process-boundary.mjs",
  "scripts/wp13-12b-pinned-git-toolchain-test.mjs",
  "scripts/wp13-12b-pinned-git-toolchain.mjs",
  "scripts/wp13-12b-receipt-integrity-test.mjs",
  "scripts/wp13-12b-provider-package-contract.mjs",
  "scripts/wp13-12b-receipt-integrity.mjs",
  "scripts/wp13-12b-vercel-cli-toolchain.mjs",
  "scripts/wp13-12b-vercel-cli-risk-decision-test.mjs",
  "scripts/wp13-12b-vercel-cli-risk-decision.mjs",
].sort());

const coverageRoots = Object.freeze([
  "provider/firebase/functions",
  "provider/firebase/tools",
  "provider/vercel/wp13-12b-preview",
  "release/wp13-12b/external-activation",
]);
const excludedCoveragePaths = new Set([
  externalActivationChecksumManifestPath,
]);
const excludedCoverageDirectories = new Set([".vercel", "node_modules"]);

function repositoryPath(root, path) {
  return join(root, ...path.split("/"));
}

async function collectFiles(root, directory) {
  const files = [];
  const entries = await readdir(repositoryPath(root, directory), {
    withFileTypes: true,
  });
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!excludedCoverageDirectories.has(entry.name)) {
        files.push(...await collectFiles(root, path));
      }
    } else if (entry.isFile() && !excludedCoveragePaths.has(path)) {
      files.push(path);
    } else if (!entry.isFile()) {
      throw new Error(
        `external activation checksum coverage forbids special path: ${path}`,
      );
    }
  }
  return files;
}

async function collectCriticalScriptFiles(root) {
  const entries = await readdir(repositoryPath(root, "scripts"), {
    withFileTypes: true,
  });
  const criticalName =
    /^(?:.*wp13-12b.*|provider-external-.*|provider-functions-runtime-test|provider-staging-operator-gates-test|serve-proof)\.(?:cjs|mjs)$/u;
  const files = [];
  for (const entry of entries) {
    if (entry.isFile() && criticalName.test(entry.name)) {
      files.push(`scripts/${entry.name}`);
    } else if (
      !entry.isFile()
      && !entry.isDirectory()
      && criticalName.test(entry.name)
    ) {
      throw new Error(
        `external activation checksum coverage forbids special script path: scripts/${entry.name}`,
      );
    }
  }
  return files.sort();
}

export async function findUncoveredExternalActivationFiles(root) {
  const covered = new Set(externalActivationChecksumTargets);
  const candidates = (
    await Promise.all([
      ...coverageRoots.map((directory) => collectFiles(root, directory)),
      collectCriticalScriptFiles(root),
    ])
  ).flat();
  return [...new Set(candidates)]
    .filter((path) => !covered.has(path))
    .sort();
}

export async function buildExternalActivationChecksumManifest(root) {
  if (
    new Set(externalActivationChecksumTargets).size
      !== externalActivationChecksumTargets.length
  ) {
    throw new Error("external activation checksum targets contain duplicates");
  }
  const uncovered = await findUncoveredExternalActivationFiles(root);
  if (uncovered.length > 0) {
    throw new Error(
      `external activation checksum coverage is missing: ${uncovered.join(", ")}`,
    );
  }

  const lines = [];
  for (const path of externalActivationChecksumTargets) {
    const content = await readFile(repositoryPath(root, path));
    const checksum = createHash("sha256").update(content).digest("hex");
    lines.push(`${checksum}  ${path}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function ensureExternalActivationChecksumManifest(
  root,
  { checkOnly = false } = {},
) {
  const expected = await buildExternalActivationChecksumManifest(root);
  const manifest = repositoryPath(root, externalActivationChecksumManifestPath);
  if (checkOnly) {
    const actual = await readFile(manifest, "utf8").catch(() => "");
    if (actual !== expected) {
      throw new Error(
        `${externalActivationChecksumManifestPath} is stale; run npm run external-activation:checksums`,
      );
    }
  } else {
    await mkdir(dirname(manifest), { recursive: true });
    await writeFile(manifest, expected, "utf8");
  }
  return externalActivationChecksumTargets.length;
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && resolve(invokedPath) === fileURLToPath(import.meta.url)
) {
  const checkOnly = process.argv.includes("--check");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const count = await ensureExternalActivationChecksumManifest(root, { checkOnly });
  process.stdout.write(
    checkOnly
      ? `WP13.12B external activation checksum coverage is deterministic and current (${count} files).\n`
      : `WP13.12B external activation checksum manifest generated deterministically (${count} files).\n`,
  );
}
