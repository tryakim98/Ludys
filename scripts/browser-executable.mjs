import { accessSync, constants, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const EXPLICIT_PATH_VARIABLES = [
  "LUDYS_BROWSER_PATH",
  "CHROME_PATH",
  "CHROMIUM_PATH",
];

function readEnvironment(environment, name, platform) {
  if (environment[name]) return environment[name];
  if (platform !== "win32") return undefined;
  const key = Object.keys(environment).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  return key ? environment[key] : undefined;
}

function isExecutableFile(candidate) {
  try {
    if (!statSync(candidate).isFile()) return false;
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function platformCandidates(platform, environment) {
  if (platform === "win32") {
    const roots = [
      readEnvironment(environment, "ProgramFiles", platform),
      readEnvironment(environment, "ProgramFiles(x86)", platform),
      readEnvironment(environment, "LOCALAPPDATA", platform),
    ].filter(Boolean);
    return roots.flatMap((root) => [
      join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
      join(root, "Google", "Chrome", "Application", "chrome.exe"),
    ]);
  }

  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      join(homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
      join(homedir(), "Applications", "Microsoft Edge.app", "Contents", "MacOS", "Microsoft Edge"),
    ];
  }

  if (platform === "linux") {
    return [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
    ];
  }

  return [];
}

function pathCandidates(platform, environment) {
  const pathValue = readEnvironment(environment, "PATH", platform) ?? "";
  const delimiter = platform === "win32" ? ";" : ":";
  const executableNames = platform === "win32"
    ? ["msedge.exe", "chrome.exe", "chromium.exe", "chromium-browser.exe"]
    : [
        "chromium",
        "chromium-browser",
        "google-chrome",
        "google-chrome-stable",
        "microsoft-edge",
        "microsoft-edge-stable",
      ];

  return pathValue
    .split(delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/g, ""))
    .filter(Boolean)
    .flatMap((directory) => executableNames.map((name) => join(directory, name)));
}

export function resolveBrowserExecutable(options = {}) {
  const platform = options.platform ?? process.platform;
  const environment = options.environment ?? process.env;
  const executableCheck = options.executableCheck ?? isExecutableFile;
  const explicitCandidates = EXPLICIT_PATH_VARIABLES
    .map((name) => readEnvironment(environment, name, platform))
    .filter(Boolean);
  const candidates = [
    ...explicitCandidates,
    ...platformCandidates(platform, environment),
    ...pathCandidates(platform, environment),
  ];

  for (const candidate of candidates) {
    if (executableCheck(candidate)) return candidate;
  }

  throw new Error(
    `No local Chromium-based browser executable was found for ${platform}. `
      + `Configure one with ${EXPLICIT_PATH_VARIABLES.join(", ")}. `
      + "A local Chromium-based browser is required; LUDYS does not download one.",
  );
}
