import { createHash } from "node:crypto";
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ids = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export async function loadCanonSnapshot() {
  const integration = JSON.parse(await readFile(join(root, "config/skynja-canon-integration.json"), "utf8"));
  const directory = join(root, integration.canonPath);
  const files = new Map();
  for (const name of await readdir(directory)) files.set(name, await readFile(join(directory, name)));
  const legacyBytes = await readFile(join(root, integration.legacyProofScope));
  return { integration, files, legacyBytes };
}

export function validateCanonSnapshot({ integration, files, legacyBytes }) {
  const errors = [];
  const manifest = files.get("MANIFEST_SHA256.txt");
  if (!manifest || sha256(manifest) !== integration.manifestSha256) errors.push("source manifest identity mismatch");
  if (sha256(legacyBytes) !== integration.legacyProofScopeSha256) errors.push("legacy proof scope changed without a recorded migration");
  if (!manifest) return errors;
  const entries = manifest.toString("utf8").trim().split(/\r?\n/).map((line) => /^([a-f0-9]{64})  ([A-Za-z_0-9.]+)$/.exec(line));
  const names = entries.filter(Boolean).map((entry) => entry[2]);
  if (entries.some((entry) => !entry) || names.length !== 9 || new Set(names).size !== 9
    || !equal([...files.keys()].sort(), [...names, "MANIFEST_SHA256.txt"].sort())) errors.push("invalid source package inventory");
  for (const entry of entries) {
    if (!entry) continue;
    const file = files.get(entry[2]);
    if (!file || sha256(file) !== entry[1]) errors.push(`source file integrity mismatch: ${entry[2]}`);
  }
  try {
    const index = JSON.parse(files.get("PRINCIPLE_INDEX.json").toString("utf8"));
    const canon = files.get("SKYNJA_REVISED_CANON_V1_0.md").toString("utf8");
    const legacyText = files.get("RETAINED_LEGACY_RULES.md").toString("utf8");
    const register = files.get("SUPERSESSION_REGISTER.csv").toString("utf8");
    const principleIds = ids("SKP", 50);
    if (!equal(index.principles.map((item) => item.id), principleIds) || index.package.principle_count !== 50) errors.push("principle index must contain SKP-001 through SKP-050 exactly once");
    if (!equal([...canon.matchAll(/^## (SKP-\d{3}) — (.+)$/gm)].map((match) => [match[1], match[2]]), index.principles.map((item) => [item.id, item.title]))) errors.push("canon headings disagree with principle index");
    if (!equal([...register.matchAll(/^(SKP-\d{3}),/gm)].map((match) => match[1]), principleIds)) errors.push("supersession register is incomplete");
    if (!equal(index.retained_legacy_rules.map((item) => item.id), ids("LEG", 20))
      || !equal([...legacyText.matchAll(/^## (LEG-\d{3}) — /gm)].map((match) => match[1]), ids("LEG", 20))) errors.push("retained legacy rules are incomplete");
    if (integration.canonVersion !== index.package.version || integration.integrationScope !== "PRODUCT_DESIGN_AND_LOCAL_SYNTHETIC_CONTRACTS"
      || integration.runtimeActivation !== "NOT_ACTIVATED" || integration.realDataAuthorization !== "NOT_GRANTED_BY_CANON") errors.push("canon adoption must not masquerade as runtime or real-data activation");
    if (!equal(integration.principles.map((item) => item.principleId), principleIds)) errors.push("local integration map is incomplete or duplicated");
    const workstreamIds = integration.workstreams.map((item) => item.id);
    if (new Set(workstreamIds).size !== workstreamIds.length) errors.push("duplicate migration workstream");
    const membership = integration.workstreams.flatMap((item) => item.principles).sort();
    if (!equal(membership, principleIds)) errors.push("migration workstreams do not cover each principle exactly once");
    for (const item of integration.principles) {
      const stream = integration.workstreams.find((stream) => stream.id === item.workstream);
      if (!stream?.principles.includes(item.principleId) || !stream.remainingWork?.trim()) errors.push(`${item.principleId}: missing migration work`);
      if (item.designStatus !== "ACCEPTED" || !["PARTIAL_CONTRACT", "MIGRATION_REQUIRED"].includes(item.implementationStatus)) errors.push(`${item.principleId}: invalid implementation claim`);
      if (item.implementationStatus === "PARTIAL_CONTRACT" && item.implementationPaths.length === 0) errors.push(`${item.principleId}: contract implementation has no source paths`);
    }
    const legacy = JSON.parse(legacyBytes.toString("utf8"));
    if (new Set(legacy.files).size !== legacy.files.length || legacy.files.some((path) => !path.startsWith("src/") || !path.endsWith(".ts"))) errors.push("invalid legacy proof scope");
  } catch {
    errors.push("unreadable or malformed canon index/integration metadata");
  }
  return errors;
}

async function main() {
  const snapshot = await loadCanonSnapshot();
  const errors = validateCanonSnapshot(snapshot);
  const paths = new Set([
    ...JSON.parse(snapshot.legacyBytes.toString("utf8")).files,
    ...snapshot.integration.principles.flatMap((item) => item.implementationPaths),
    ...snapshot.integration.workstreams.flatMap((item) => item.legacyPaths),
  ]);
  for (const path of paths) {
    try { await access(join(root, path)); } catch { errors.push(`missing mapped repository path: ${path}`); }
  }
  const agentRules = await readFile(join(root, "AGENTS.md"), "utf8");
  if (!agentRules.includes(`${snapshot.integration.canonPath}/AGENT_BOOTSTRAP.md`)) errors.push("agent entry point does not lead to the active canon");
  const attributes = await readFile(join(root, ".gitattributes"), "utf8");
  if (!attributes.includes(`${snapshot.integration.canonPath}/** -text`)) errors.push("source package bytes are not protected from checkout newline conversion");
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
  else console.log("Skynja canon verified: 9 source hashes, 50 principles, 20 retained rules, 9 migration workstreams; no runtime activation.");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
