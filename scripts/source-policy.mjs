// Current build restrictions are not universal Skynja product prohibitions.
const unapprovedRuntimePackages = /(^|\/)(firebase|react|openai|anthropic|@ai-sdk|howler|sentry|posthog|logrocket)(\/|$)/i;
const legacyActions = ["AUTO_PRAISE", "AUTO_LEVEL_UP", "INFER_EMOTION", "INFER_MOTIVATION", "INFER_DIAGNOSIS", "GENERATE_COACHING", "PERSONALIZE_FROM_TIMING", "CREATE_STREAK", "SIMULATE_THINKING"];
const explicitProhibitionRegisters = new Set(["src/core/provider-decision.ts", "src/content/provider-decision/wp13-12a-decision-package.ts"]);

export function inspectPackagePolicy(pkg) {
  const errors = [];
  for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    for (const name of Object.keys(pkg[section] ?? {})) {
      if (unapprovedRuntimePackages.test(name)) errors.push(`runtime dependency requires a reviewed integration for this build: ${name}`);
    }
  }
  return errors;
}

export function inspectSourcePolicy(rel, text, legacyProofFiles) {
  const errors = [];
  const legacyProof = legacyProofFiles.has(rel);
  for (const match of text.matchAll(/from\s+["']([^"']+)["']/g)) {
    if (unapprovedRuntimePackages.test(match[1])) errors.push(`${rel}: unapproved runtime import for this build: ${match[1]}`);
  }
  if (legacyProof && rel !== "src/core/actions.ts") {
    for (const term of legacyActions) {
      if (text.includes(term)) errors.push(`${rel}: action outside this historical proof's scope: ${term}`);
    }
  }
  if (legacyProof && !explicitProhibitionRegisters.has(rel)) {
    for (const field of ["childId", "studentId", "userId", "adultProfile", "childProfile"]) {
      if (new RegExp(`\\b${field}\\b`).test(text)) errors.push(`${rel}: stable/profile field outside this historical proof's scope: ${field}`);
    }
  }
  if (legacyProof && /speechSynthesis|SpeechSynthesis|webkitSpeechRecognition|SpeechRecognition/.test(text)) {
    errors.push(`${rel}: dynamic speech is outside this historical proof's scope`);
  }
  // Compatible retained protections apply to every module, including new Skynja code.
  if (rel !== "src/core/actions.ts" && /RANK_CHILD|RANK_ADULT/.test(text)) errors.push(`${rel}: social ranking is forbidden`);
  if (!explicitProhibitionRegisters.has(rel) && /\bengagementScore\b/.test(text)) errors.push(`${rel}: hidden engagement totals are forbidden`);
  if (/Vikingspill-main|src\/engine|@engine\//.test(text)) errors.push(`${rel}: cross-product source reference`);
  if (/autoplay\s*=|\.autoplay\s*=\s*true/.test(text)) errors.push(`${rel}: autoplay is forbidden`);
  if (/pilotAuthorized\s*:\s*true|recruitmentAuthorized\s*:\s*true|realDataAuthorized\s*:\s*true|PILOT_APPROVED|START_PILOT|RECRUIT_CHILD/.test(text)) {
    errors.push(`${rel}: implicit B8, recruitment, real-data or pilot authorization is forbidden`);
  }
  return errors;
}
