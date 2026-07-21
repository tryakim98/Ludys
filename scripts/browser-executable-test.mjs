import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBrowserExecutable } from "./browser-executable.mjs";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "ludys-browser-resolver-"));
const configuredBrowser = join(temporaryDirectory, "configured-browser.exe");
const fallbackBrowser = join(temporaryDirectory, "fallback-browser.exe");

try {
  await writeFile(configuredBrowser, "synthetic executable fixture");
  await writeFile(fallbackBrowser, "synthetic executable fixture");
  await chmod(configuredBrowser, 0o755);
  await chmod(fallbackBrowser, 0o755);

  const explicit = resolveBrowserExecutable({
    platform: process.platform,
    environment: {
      LUDYS_BROWSER_PATH: configuredBrowser,
      PATH: temporaryDirectory,
    },
  });
  assert.equal(explicit, configuredBrowser, "explicit browser path must have first priority");

  const missingExplicit = join(temporaryDirectory, "missing-browser.exe");
  const fallback = resolveBrowserExecutable({
    platform: process.platform,
    environment: {
      LUDYS_BROWSER_PATH: missingExplicit,
      CHROME_PATH: fallbackBrowser,
      PATH: "",
    },
  });
  assert.notEqual(fallback, missingExplicit, "a missing explicit path must never be accepted");
  assert.equal(fallback, fallbackBrowser);

  const programFiles = "C:\\Program Files";
  const programFilesX86 = "C:\\Program Files (x86)";
  const localAppData = "C:\\Users\\Synthetic\\AppData\\Local";
  const x86Edge = join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe");
  const programFilesChrome = join(programFiles, "Google", "Chrome", "Application", "chrome.exe");
  const preferredWindowsBrowser = resolveBrowserExecutable({
    platform: "win32",
    environment: {
      ProgramFiles: programFiles,
      "ProgramFiles(x86)": programFilesX86,
      LOCALAPPDATA: localAppData,
      PATH: "",
    },
    executableCheck: (candidate) =>
      candidate === x86Edge || candidate === programFilesChrome,
  });
  assert.equal(
    preferredWindowsBrowser,
    x86Edge,
    "all known Edge locations must be checked before known Chrome locations",
  );

  assert.throws(
    () => resolveBrowserExecutable({
      platform: "test-os",
      environment: { PATH: "" },
      executableCheck: () => false,
    }),
    (error) => {
      assert.match(error.message, /test-os/);
      assert.match(error.message, /LUDYS_BROWSER_PATH, CHROME_PATH, CHROMIUM_PATH/);
      assert.match(error.message, /local Chromium-based browser is required/i);
      return true;
    },
  );

  const resolverSource = await readFile(
    fileURLToPath(new URL("./browser-executable.mjs", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(resolverSource, /\bfetch\s*\(|node:https|node:http|child_process/);
  assert.deepEqual(
    [...resolverSource.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]),
    ["node:fs", "node:os", "node:path"],
    "resolver must use only the Node.js standard library",
  );

  console.log("Cross-platform browser executable resolver proof passed.");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
