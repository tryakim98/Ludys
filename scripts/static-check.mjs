import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const src = join(repo, "src");
const packageJson = JSON.parse(await readFile(join(repo, "package.json"), "utf8"));
const errors = [];
const forbiddenPackages = /(^|\/)(firebase|react|openai|anthropic|@ai-sdk|howler|sentry|posthog|logrocket)(\/|$)/i;

for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
  for (const name of Object.keys(packageJson[section] ?? {})) {
    if (forbiddenPackages.test(name)) errors.push(`forbidden runtime dependency: ${name}`);
  }
}

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(path)));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

const forbiddenOutsideRegistry = [
  "AUTO_PRAISE",
  "AUTO_LEVEL_UP",
  "INFER_EMOTION",
  "INFER_MOTIVATION",
  "INFER_DIAGNOSIS",
  "GENERATE_COACHING",
  "PERSONALIZE_FROM_TIMING",
  "CREATE_STREAK",
  "RANK_CHILD",
  "RANK_ADULT",
  "SIMULATE_THINKING",
];

for (const file of await collect(src)) {
  const rel = relative(repo, file).replaceAll("\\", "/");
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/from\s+["']([^"']+)["']/g)) {
    if (forbiddenPackages.test(match[1])) errors.push(`${rel}: forbidden import ${match[1]}`);
  }
  if (rel !== "src/core/actions.ts") {
    for (const term of forbiddenOutsideRegistry) {
      if (text.includes(term)) errors.push(`${rel}: forbidden baseline action used: ${term}`);
    }
  }
  for (const field of ["childId", "studentId", "userId", "adultProfile", "childProfile", "engagementScore"]) {
    if (new RegExp(`\\b${field}\\b`).test(text)) errors.push(`${rel}: forbidden stable/profile field ${field}`);
  }
  if (/Vikingspill-main|src\/engine|@engine\//.test(text)) {
    errors.push(`${rel}: cross-product source reference`);
  }
  if (/speechSynthesis|SpeechSynthesis|webkitSpeechRecognition|SpeechRecognition/.test(text)) {
    errors.push(`${rel}: dynamic speech or voice-analysis runtime is forbidden`);
  }
  if (/autoplay\s*=|\.autoplay\s*=\s*true/.test(text)) {
    errors.push(`${rel}: autoplay is forbidden`);
  }
  if (/pilotAuthorized\s*:\s*true|recruitmentAuthorized\s*:\s*true|realDataAuthorized\s*:\s*true|PILOT_APPROVED|START_PILOT|RECRUIT_CHILD/.test(text)) {
    errors.push(`${rel}: implicit B8, recruitment, real-data or pilot authorization is forbidden`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Static Human-First check passed.");
