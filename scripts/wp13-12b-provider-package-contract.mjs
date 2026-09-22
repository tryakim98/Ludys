import { createHash } from "node:crypto";
import { posix } from "node:path";

export const providerPackageArtifactPath =
  "artifacts/wp13-12b-provider-package.json";
export const providerFunctionsSourceRoot =
  "provider/firebase/functions";
export const providerPackageSchemaVersion =
  "wp13.12b-provider-package-v2";
export const providerPackageFileScope =
  "EXACT_FIREBASE_FUNCTIONS_DEPLOY_AND_CONTROL_BYTES";
export const expectedFunctionsGcloudIgnore = [
  ".gcloudignore",
  "node_modules/",
  "src/",
  "tools/",
  "functions.yaml",
  "",
].join("\n");

export const providerPackageFilePaths = Object.freeze([
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
]);

export const providerPackageRuntimeModulePaths = Object.freeze([
  "provider/firebase/functions/firestore-store.mjs",
  "provider/firebase/functions/index.mjs",
  "provider/firebase/functions/lib/provider/firebase/functions/src/authoritative-handler.js",
  "provider/firebase/functions/lib/src/core/evidence.js",
  "provider/firebase/functions/lib/src/core/reliability-hardening.js",
  "provider/firebase/functions/lib/src/core/session-lifecycle.js",
  "provider/firebase/functions/lib/src/core/state.js",
  "provider/firebase/functions/lib/src/core/synthetic-staging.js",
]);

export const providerIgnoredAuthoringFilePaths = Object.freeze([
  "provider/firebase/functions/src/authoritative-handler.ts",
  "provider/firebase/functions/src/in-memory-store.ts",
  "provider/firebase/functions/tools/package-preflight.mjs",
]);

export const providerOptionalIgnoredDirectoryPaths = Object.freeze([
  "provider/firebase/functions/node_modules",
]);

export const providerRuntimeSecuritySourcePaths = Object.freeze([
  "provider/firebase/functions/firestore-store.mjs",
  "scripts/provider-functions-runtime-test.mjs",
]);

const providerRuntimeSecuritySourceContracts = Object.freeze({
  "provider/firebase/functions/firestore-store.mjs": Object.freeze({
    requiredMarkers: Object.freeze([
      'const LOCAL_EMULATOR_RUNTIME_PHASE = "LOCAL_EMULATOR_PROOF";',
      'const METADATA_ORIGIN = "http://metadata.google.internal";',
      "const EXACT_LOOPBACK_EMULATOR_HOST =",
      "metadataTokenMs: 5_000",
      "requestMs: 10_000",
      'process.env.LUDYS_LOCAL_EMULATOR_PROOF === "true"',
      "process.env.LUDYS_STAGING_RUNTIME_PHASE",
      'throw new Error("FIRESTORE_EMULATOR_MODE_INVALID")',
      'throw new Error("FIRESTORE_EMULATOR_MODE_FORBIDDEN")',
      'throw new Error("FIRESTORE_EMULATOR_HOST_REQUIRED")',
      'throw new Error("FIRESTORE_EMULATOR_HOST_MISMATCH")',
      'throw new Error("FIRESTORE_EMULATOR_HOST_INVALID")',
      'throw new Error("RUNTIME_METADATA_ORIGIN_INVALID")',
      'throw new Error("RUNTIME_IAM_TOKEN_UNAVAILABLE")',
      'throw new Error("FIRESTORE_REST_ORIGIN_INVALID")',
      'throw new Error("FIRESTORE_REST_UNAVAILABLE")',
      "signal: AbortSignal.timeout(",
      "firestoreRestTimeouts.metadataTokenMs",
      "firestoreRestTimeouts.requestMs",
      "delete: grant.name",
      "currentDocument: { updateTime: grant.updateTime }",
    ]),
    forbiddenMarkers: Object.freeze([
      "const emulator = options.emulatorHost"
        + " ?? process.env.FIRESTORE_EMULATOR_HOST",
      'this.documentRoot.startsWith("http://127.0.0.1")',
      'this.documentRoot.startsWith("http://localhost")',
      "{ ...grant.data, revoked: true }",
    ]),
    orderedMarkerGroups: Object.freeze([
      Object.freeze([
        "metadataTokenMs: 5_000",
        "requestMs: 10_000",
      ]),
      Object.freeze([
        "requestOrigin = new URL(url).origin",
        "if (requestOrigin !== this.firestoreOrigin)",
        "const token = await this.#token()",
        "response = await fetch(url",
      ]),
      Object.freeze([
        '"content-type": "application/json"',
        "...(init.headers ?? {})",
        "...(token ? { authorization: `Bearer ${token}` } : {})",
      ]),
      Object.freeze([
        "delete: this.#name(sessionPath)",
        "documentWrite(",
        "...grants.map((grant) => ({",
        "delete: grant.name",
      ]),
    ]),
  }),
  "scripts/provider-functions-runtime-test.mjs": Object.freeze({
    requiredMarkers: Object.freeze([
      'import { createRequire } from "node:module";',
      "async function assertProviderDependencySecurityContract()",
      'providerRequire("fast-uri")',
      'assert.equal(fastUriManifest.version, "3.1.5")',
      "URI authority must not contain a literal backslash.",
      'providerRequire("cloudevents")',
      "HTTP.toEvent({",
      'providerRequire("ajv")',
      'advisoryRegression: "GHSA-7p8r-x3mc-p8w7"',
      "firestoreRestTimeouts,",
      "async function assertProviderIngressContract()",
      "async function assertFirestoreTransportSecurityContract()",
      "assert.deepEqual(firestoreRestTimeouts",
      "FIRESTORE_EMULATOR_MODE_FORBIDDEN",
      "FIRESTORE_EMULATOR_MODE_INVALID",
      "FIRESTORE_EMULATOR_HOST_REQUIRED",
      "FIRESTORE_EMULATOR_HOST_MISMATCH",
      "FIRESTORE_EMULATOR_HOST_INVALID",
      "RUNTIME_METADATA_ORIGIN_INVALID",
      '"localhost:8090"',
      '"0.0.0.0:8090"',
      '"127.0.0.2:8090"',
      "init.signal instanceof AbortSignal",
      "metadata-test-token-never-sent-to-emulator",
      'init.headers.authorization, "Bearer owner"',
      'LUDYS_LOCAL_EMULATOR_PROOF: "true"',
      'LUDYS_STAGING_RUNTIME_PHASE: "LOCAL_EMULATOR_PROOF"',
      "await store.deleteSession({",
      "synthetic-runtime-contract-second-nonce",
      '"MINIMUM_NO_RESURRECTION_TOMBSTONE"',
      'runtimePhase: "LOCAL_EMULATOR_PROOF"',
      'providerActivation: "LOCAL_EMULATOR_ONLY"',
    ]),
    forbiddenMarkers: Object.freeze([]),
    orderedMarkerGroups: Object.freeze([
      Object.freeze([
        "await assertProviderDependencySecurityContract();",
        "await assertFirestoreTransportSecurityContract();",
        "await assertProviderIngressContract();",
      ]),
      Object.freeze([
        "await assertFirestoreTransportSecurityContract();",
        "await assertProviderIngressContract();",
        "const firestore = createServer(",
      ]),
      Object.freeze([
        "metadata-test-token-never-sent-to-emulator",
        "const emulatorCalls = []",
        'init.headers.authorization, "Bearer owner"',
      ]),
      Object.freeze([
        "assert.equal(await store.deleteSession({",
        "observedCommit.body.writes.map((write)",
        "synthetic-runtime-contract-second-nonce",
        '"MINIMUM_NO_RESURRECTION_TOMBSTONE"',
      ]),
    ]),
  }),
});

const SHA256 = /^[a-f0-9]{64}$/u;
const exactManifestKeys = Object.freeze([
  "cloudResources",
  "fileCount",
  "fileScope",
  "files",
  "functionsRuntime",
  "functionsSourceSha256",
  "providerActivation",
  "region",
  "schemaVersion",
  "sourceCommit",
  "sourceRoot",
  "stagingProviderReleaseId",
  "status",
].sort());
const exactFileKeys = Object.freeze(["bytes", "path", "sha256"].sort());

function contractError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function markersAppearInOrder(source, markers) {
  let offset = 0;
  for (const marker of markers) {
    const index = source.indexOf(marker, offset);
    if (index < 0) return false;
    offset = index + marker.length;
  }
  return true;
}

export function assertProviderRuntimeSecuritySourceContracts(sourceByPath) {
  if (
    sourceByPath === null
    || typeof sourceByPath !== "object"
    || Array.isArray(sourceByPath)
    || JSON.stringify(Object.keys(sourceByPath).sort())
      !== JSON.stringify([...providerRuntimeSecuritySourcePaths].sort())
  ) throw contractError("PROVIDER_RUNTIME_SECURITY_SOURCE_SET_MISMATCH");

  for (const path of providerRuntimeSecuritySourcePaths) {
    const source = sourceByPath[path];
    const contract = providerRuntimeSecuritySourceContracts[path];
    if (typeof source !== "string") {
      throw contractError("PROVIDER_RUNTIME_SECURITY_SOURCE_UNREADABLE");
    }
    if (
      contract.requiredMarkers.some((marker) => !source.includes(marker))
      || contract.forbiddenMarkers.some((marker) => source.includes(marker))
      || contract.orderedMarkerGroups.some(
        (markers) => !markersAppearInOrder(source, markers),
      )
    ) throw contractError("PROVIDER_RUNTIME_SECURITY_SOURCE_CONTRACT_MISMATCH");
  }
  return Object.freeze({
    sourceCount: providerRuntimeSecuritySourcePaths.length,
    strictEmulatorBoundary: true,
    boundedFirestoreTransport: true,
    emulatorTokenIsolation: true,
    atomicGrantDeletionProof: true,
  });
}

function exactKeys(value, expected) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected)
  );
}

function normalizeManifestFiles(files) {
  return files.map((file) => Object.freeze({
    path: file.path,
    sha256: file.sha256,
    bytes: file.bytes,
  }));
}

export function providerSourceDigest(files) {
  const canonical = normalizeManifestFiles(files)
    .map(({ path, sha256, bytes }) => `${path}\0${sha256}\0${bytes}`)
    .join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function validateProviderPackageManifest(manifest) {
  if (
    !exactKeys(manifest, exactManifestKeys)
    || manifest.schemaVersion !== providerPackageSchemaVersion
    || manifest.status
      !== "LOCAL_DEPLOYABLE_PACKAGE_GENERATED_NOT_DEPLOYED"
    || manifest.sourceCommit !== "PENDING_FINAL_COMMIT_NOT_A_RECEIPT"
    || manifest.stagingProviderReleaseId
      !== "wp13-12b-synthetic-staging-provider-r1"
    || manifest.functionsRuntime !== "nodejs24"
    || manifest.region !== "europe-north1"
    || manifest.providerActivation !== "BLOCKED"
    || manifest.cloudResources !== 0
    || manifest.sourceRoot !== providerFunctionsSourceRoot
    || manifest.fileScope !== providerPackageFileScope
    || manifest.fileCount !== providerPackageFilePaths.length
    || !Array.isArray(manifest.files)
    || manifest.files.length !== providerPackageFilePaths.length
    || !SHA256.test(manifest.functionsSourceSha256 ?? "")
  ) throw contractError("PROVIDER_PACKAGE_MANIFEST_SCHEMA_OR_SCOPE_INVALID");

  const observedPaths = [];
  for (const file of manifest.files) {
    if (
      !exactKeys(file, exactFileKeys)
      || typeof file.path !== "string"
      || !SHA256.test(file.sha256 ?? "")
      || !Number.isSafeInteger(file.bytes)
      || file.bytes < 0
    ) throw contractError("PROVIDER_PACKAGE_FILE_ENTRY_INVALID");
    observedPaths.push(file.path);
  }
  if (
    JSON.stringify(observedPaths)
      !== JSON.stringify(providerPackageFilePaths)
    || new Set(observedPaths).size !== observedPaths.length
  ) throw contractError("PROVIDER_PACKAGE_EXACT_FILE_SET_MISMATCH");
  if (
    providerSourceDigest(manifest.files)
      !== manifest.functionsSourceSha256
  ) throw contractError("PROVIDER_PACKAGE_SOURCE_DIGEST_MISMATCH");
  return Object.freeze({
    ...manifest,
    files: Object.freeze(normalizeManifestFiles(manifest.files)),
  });
}

function staticImportSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\b(?:import|export)\s+[^;]*?\s+from\s*["']([^"']+)["']/gsu,
    /\bimport\s*["']([^"']+)["']/gsu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return Object.freeze([...new Set(specifiers)].sort());
}

function resolveRelativeModule(fromPath, specifier) {
  if (
    specifier.includes("\\")
    || specifier.includes("\0")
    || !/\.(?:mjs|js)$/u.test(specifier)
  ) throw contractError("PROVIDER_PACKAGE_RELATIVE_IMPORT_INVALID");
  const target = posix.normalize(
    posix.join(posix.dirname(fromPath), specifier),
  );
  if (
    target === ".."
    || target.startsWith("../")
    || posix.isAbsolute(target)
  ) throw contractError("PROVIDER_PACKAGE_RELATIVE_IMPORT_ESCAPES_SCOPE");
  return target;
}

export function assertExactProviderRuntimeImportClosure(moduleTextByPath) {
  if (
    moduleTextByPath === null
    || typeof moduleTextByPath !== "object"
    || Array.isArray(moduleTextByPath)
    || JSON.stringify(Object.keys(moduleTextByPath).sort())
      !== JSON.stringify([...providerPackageRuntimeModulePaths].sort())
  ) throw contractError("PROVIDER_PACKAGE_RUNTIME_MODULE_SET_MISMATCH");

  const graph = new Map();
  for (const path of providerPackageRuntimeModulePaths) {
    const source = moduleTextByPath[path];
    if (typeof source !== "string") {
      throw contractError("PROVIDER_PACKAGE_RUNTIME_MODULE_UNREADABLE");
    }
    if (
      /\b(?:import\s*\(|require\s*\(|createRequire\b)/u.test(source)
      || /sourceMappingURL=/u.test(source)
    ) throw contractError("PROVIDER_PACKAGE_RUNTIME_LOADING_FORM_FORBIDDEN");
    const specifiers = staticImportSpecifiers(source);
    if (
      specifiers.some((specifier) => (
        !specifier.startsWith(".")
        && specifier !== "node:crypto"
        && specifier !== "@google-cloud/functions-framework"
      ))
    ) throw contractError("PROVIDER_PACKAGE_RUNTIME_IMPORT_NOT_ALLOWLISTED");
    const targets = specifiers.filter(
      (specifier) => specifier.startsWith("."),
    ).map((specifier) => (
      resolveRelativeModule(path, specifier)
    ));
    if (targets.some((target) => !providerPackageRuntimeModulePaths.includes(target))) {
      throw contractError("PROVIDER_PACKAGE_RELATIVE_IMPORT_OUTSIDE_MANIFEST");
    }
    graph.set(path, Object.freeze(targets));
  }

  const entrypoint = "provider/firebase/functions/index.mjs";
  const reachable = new Set();
  const pending = [entrypoint];
  while (pending.length > 0) {
    const path = pending.pop();
    if (reachable.has(path)) continue;
    reachable.add(path);
    for (const dependency of graph.get(path) ?? []) pending.push(dependency);
  }
  if (
    providerPackageRuntimeModulePaths.some((path) => !reachable.has(path))
  ) throw contractError("PROVIDER_PACKAGE_UNREACHABLE_RUNTIME_MODULE");
  return Object.freeze({
    entrypoint,
    runtimeModuleCount: providerPackageRuntimeModulePaths.length,
    relativeImportClosureComplete: true,
    unreachableRuntimeModules: Object.freeze([]),
  });
}
