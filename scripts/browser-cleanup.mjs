import { spawn } from "node:child_process";
import { readdir, rm } from "node:fs/promises";

const GRACEFUL_CLOSE_TIMEOUT_MS = 2_000;
const TERMINATE_TIMEOUT_MS = 2_000;
const FORCE_TIMEOUT_MS = 5_000;
const FILE_RELEASE_DELAY_MS = 500;
const PROFILE_DELETE_TIMEOUT_MS = 30_000;
const PROFILE_RETRY_DELAY_MS = 300;
const PROFILE_RETRY_MAX_DELAY_MS = 1_500;
const ENDPOINT_START_TIMEOUT_MS = 30_000;
const RETRYABLE_PROFILE_ERRORS = new Set(["EBUSY", "EPERM", "ENOTEMPTY"]);
const ownedChildren = new WeakMap();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

export function processGroupExists(processGroupId) {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

function defaultRuntime(overrides = {}) {
  return {
    platform: process.platform,
    now: () => Date.now(),
    wait,
    processExists,
    processGroupExists,
    fetch: (url, init) => fetch(url, init),
    signalChild: (child, signal) => child.kill(signal),
    signalPid: (pid, signal) => process.kill(pid, signal),
    signalProcessGroup: (processGroupId, signal) => process.kill(-processGroupId, signal),
    removeProfile: (profile) => rm(profile, { recursive: true, force: true }),
    readProfileEntries: (profile) => readdir(profile, { recursive: true }),
    ...overrides,
  };
}

export function registerOwnedChildProcess(child, options = {}) {
  const platform = options.platform ?? process.platform;
  if (!Number.isInteger(child?.pid) || child.pid <= 0) {
    throw new Error("Cannot register a child process without a positive PID.");
  }
  ownedChildren.set(child, {
    rootPid: child.pid,
    platform,
    processGroupId: platform === "win32" ? undefined : child.pid,
  });
  return child;
}

export function spawnOwnedProcess(executable, args, options = {}) {
  const child = spawn(executable, args, {
    ...options,
    detached: process.platform !== "win32",
  });
  return registerOwnedChildProcess(child);
}

export function ownedProcessMetadata(child) {
  const metadata = ownedChildren.get(child);
  return metadata === undefined ? undefined : { ...metadata };
}

export async function waitForOwnedProcessEndpoint(url, options = {}) {
  const child = options.child;
  const label = options.label ?? "owned process";
  const timeoutMs = options.timeoutMs ?? ENDPOINT_START_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const runtime = defaultRuntime(options.runtime);
  const startedAt = runtime.now();
  let lastError;

  while (runtime.now() - startedAt < timeoutMs) {
    if (child?.exitCode !== null || child?.signalCode !== null) {
      throw new Error(
        `${label} exited before ${url} became ready. platform=${runtime.platform}; `
          + `pid=${child?.pid ?? "unknown"}; exitCode=${String(child?.exitCode)}; `
          + `signalCode=${String(child?.signalCode)}`,
      );
    }
    try {
      const response = await runtime.fetch(url);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await runtime.wait(pollIntervalMs);
  }

  const lastErrorDetail = lastError instanceof Error
    ? `${lastError.name}: ${lastError.message}`
    : String(lastError ?? "none");
  throw new Error(
    `Timed out after ${timeoutMs} ms waiting for ${label} endpoint ${url}. `
      + `platform=${runtime.platform}; pid=${child?.pid ?? "unknown"}; `
      + `exitCode=${String(child?.exitCode)}; signalCode=${String(child?.signalCode)}; `
      + `lastError=${lastErrorDetail}`,
  );
}

function isRootExited(child, runtime) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return child.pid !== undefined && !runtime.processExists(child.pid);
}

function isShutdownComplete(child, metadata, runtime) {
  if (!isRootExited(child, runtime)) return false;
  if (
    runtime.platform !== "win32"
    && metadata?.processGroupId !== undefined
  ) {
    return !runtime.processGroupExists(metadata.processGroupId);
  }
  return true;
}

async function waitForShutdown(child, metadata, timeoutMs, runtime) {
  const deadline = runtime.now() + timeoutMs;
  while (!isShutdownComplete(child, metadata, runtime)) {
    const remainingMs = deadline - runtime.now();
    if (remainingMs <= 0) return false;
    await runtime.wait(Math.min(50, remainingMs));
  }
  return true;
}

function runWithOutput(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env: options.environment ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timer;
    let settled = false;
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stdout: stdout.trim(), stderr: stderr.trim() });
    };
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code, signal) => finish({ code, signal, timedOut: false }));
    timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ code: child.exitCode, signal: child.signalCode, timedOut: true });
    }, options.timeoutMs ?? FORCE_TIMEOUT_MS);
  });
}

async function requestCloseWithinTimeout(requestGracefulClose, runtime) {
  if (requestGracefulClose === undefined) return undefined;

  let closeError;
  const closeAttempt = Promise.resolve()
    .then(requestGracefulClose)
    .catch((error) => {
      closeError = error;
    });
  await Promise.race([closeAttempt, runtime.wait(GRACEFUL_CLOSE_TIMEOUT_MS)]);
  return closeError;
}

async function waitForPidToDisappear(pid, timeoutMs, runtime) {
  const deadline = runtime.now() + timeoutMs;
  while (runtime.processExists(pid)) {
    const remainingMs = deadline - runtime.now();
    if (remainingMs <= 0) return false;
    await runtime.wait(Math.min(50, remainingMs));
  }
  return true;
}

async function forceTerminatePid(pid, label, runtime) {
  if (!runtime.processExists(pid)) return;

  if (runtime.platform === "win32") {
    let result;
    try {
      result = await runWithOutput(
        "taskkill",
        ["/PID", String(pid), "/T", "/F"],
        { timeoutMs: FORCE_TIMEOUT_MS },
      );
    } catch (error) {
      if (await waitForPidToDisappear(pid, FORCE_TIMEOUT_MS, runtime)) return;
      throw error;
    }

    if (await waitForPidToDisappear(pid, FORCE_TIMEOUT_MS, runtime)) return;
    throw new Error(
      `Failed to force ${label} process tree ${pid}. `
        + `taskkill exit=${String(result.code)} signal=${String(result.signal)} `
        + `stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}`,
    );
  }

  try {
    runtime.signalPid(pid, "SIGKILL");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
  if (!await waitForPidToDisappear(pid, FORCE_TIMEOUT_MS, runtime)) {
    throw new Error(`${label} PID ${pid} still exists after bounded forced termination.`);
  }
}

async function signalOwnedProcess(child, metadata, signal, runtime) {
  if (
    runtime.platform !== "win32"
    && metadata?.processGroupId !== undefined
  ) {
    if (!runtime.processGroupExists(metadata.processGroupId)) return;
    try {
      runtime.signalProcessGroup(metadata.processGroupId, signal);
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
    return;
  }

  if (child.pid !== undefined && !runtime.processExists(child.pid)) return;
  runtime.signalChild(child, signal);
}

function processStateDetail(child, metadata, runtime) {
  const rootPid = child.pid;
  const rootExists = rootPid === undefined ? "unknown" : runtime.processExists(rootPid);
  const processGroupId = metadata?.processGroupId;
  const processGroupAlive = processGroupId === undefined
    ? "not-owned"
    : runtime.processGroupExists(processGroupId);
  return `platform=${runtime.platform}; rootPid=${rootPid ?? "unknown"}; `
    + `rootExists=${String(rootExists)}; processGroupId=${processGroupId ?? "none"}; `
    + `processGroupExists=${String(processGroupAlive)}; exitCode=${String(child.exitCode)}; `
    + `signalCode=${String(child.signalCode)}`;
}

export async function stopChildProcess(child, options = {}) {
  const label = options.label ?? "child";
  const runtime = defaultRuntime(options.runtime);
  const metadata = ownedChildren.get(child);
  if (isShutdownComplete(child, metadata, runtime)) return;

  const gracefulError = await requestCloseWithinTimeout(options.requestGracefulClose, runtime);
  if (
    options.requestGracefulClose !== undefined
    && await waitForShutdown(child, metadata, GRACEFUL_CLOSE_TIMEOUT_MS, runtime)
  ) {
    return;
  }

  await signalOwnedProcess(child, metadata, "SIGTERM", runtime);
  if (await waitForShutdown(child, metadata, TERMINATE_TIMEOUT_MS, runtime)) return;

  const pid = child.pid;
  if (
    pid !== undefined
    && runtime.platform === "win32"
    && options.windowsProcessTree === true
  ) {
    const terminate = runtime.forceTerminatePid
      ?? ((targetPid, targetLabel) => forceTerminatePid(targetPid, targetLabel, runtime));
    await terminate(pid, label);
  } else {
    await signalOwnedProcess(child, metadata, "SIGKILL", runtime);
  }
  if (await waitForShutdown(child, metadata, FORCE_TIMEOUT_MS, runtime)) return;

  const gracefulDetail = gracefulError instanceof Error
    ? ` Graceful close failed: ${gracefulError.name}: ${gracefulError.message}`
    : "";
  throw new Error(
    `${label} did not stop after bounded forced termination. `
      + processStateDetail(child, metadata, runtime)
      + gracefulDetail,
  );
}

async function findWindowsProfileProcesses(profile) {
  const script = [
    "$profile = $env:LUDYS_BROWSER_PROFILE_INSPECT_PATH",
    "$matches = @(Get-CimInstance Win32_Process -Filter \"Name = 'msedge.exe'\" | Where-Object {",
    "  $_.CommandLine -and $_.CommandLine.IndexOf($profile, [StringComparison]::OrdinalIgnoreCase) -ge 0",
    "} | Select-Object ProcessId, ParentProcessId, CommandLine)",
    "ConvertTo-Json -InputObject $matches -Compress",
  ].join("\n");
  const result = await runWithOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      environment: {
        ...process.env,
        LUDYS_BROWSER_PROFILE_INSPECT_PATH: profile,
      },
      timeoutMs: FORCE_TIMEOUT_MS,
    },
  );
  if (result.timedOut || result.code !== 0) {
    throw new Error(
      `Profile process inspection failed: exit=${String(result.code)} `
        + `stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}`,
    );
  }
  if (result.stdout === "") return [];
  const parsed = JSON.parse(result.stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function remainingProfileEntries(profile, runtime) {
  try {
    return (await runtime.readProfileEntries(profile)).slice(0, 50);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    return [`<inspection failed: ${error instanceof Error ? error.message : String(error)}>`];
  }
}

async function profileRemovalError(
  profile,
  options,
  startedAt,
  lastError,
  inspectionError,
  runtime,
) {
  let profileProcesses = [];
  let terminalInspectionError = inspectionError;
  if (runtime.platform === "win32") {
    try {
      profileProcesses = await findWindowsProfileProcesses(profile);
    } catch (error) {
      terminalInspectionError ??= error;
    }
  }
  const rootPid = options.rootPid;
  const rootExists = rootPid === undefined ? "unknown" : runtime.processExists(rootPid);
  const processGroupId = options.processGroupId;
  const processGroupAlive = processGroupId === undefined || runtime.platform === "win32"
    ? "not-applicable"
    : runtime.processGroupExists(processGroupId);
  const entries = await remainingProfileEntries(profile, runtime);
  const code = lastError?.code ?? "UNKNOWN";
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  const elapsedMs = runtime.now() - startedAt;
  const processDetails = profileProcesses.length === 0
    ? "none"
    : JSON.stringify(profileProcesses);
  const inspectionDetails = terminalInspectionError instanceof Error
    ? ` Inspection error: ${terminalInspectionError.message}`
    : "";
  return new Error(
    `Failed to remove temporary browser profile ${profile}. `
      + `Platform: ${runtime.platform}. Last system error: ${code}: ${message}. `
      + `Root PID: ${rootPid ?? "unknown"}; root PID exists: ${String(rootExists)}. `
      + `Process group ID: ${processGroupId ?? "none"}; process group exists: ${String(processGroupAlive)}. `
      + `Browser status: ${options.browserStatus ?? "unknown"}; `
      + `proof server status: ${options.proofServerStatus ?? "unknown"}. `
      + `Profile-linked Edge processes: ${processDetails}. `
      + `Cleanup elapsed: ${elapsedMs} ms. Remaining entries: ${JSON.stringify(entries)}.`
      + inspectionDetails,
    { cause: lastError },
  );
}

export async function removeBrowserProfile(profile, options = {}) {
  const runtime = defaultRuntime(options.runtime);
  const startedAt = runtime.now();
  const deadline = startedAt + PROFILE_DELETE_TIMEOUT_MS;
  let lastError;
  let inspectionError;
  let attempts = 0;
  let inspectedAndTerminated = false;

  await runtime.wait(FILE_RELEASE_DELAY_MS);
  while (runtime.now() < deadline) {
    try {
      await runtime.removeProfile(profile);
      return;
    } catch (error) {
      lastError = error;
      if (!RETRYABLE_PROFILE_ERRORS.has(error?.code)) {
        throw await profileRemovalError(
          profile,
          options,
          startedAt,
          error,
          inspectionError,
          runtime,
        );
      }
      attempts += 1;
    }

    if (
      runtime.platform === "win32"
      && attempts >= 3
      && !inspectedAndTerminated
    ) {
      inspectedAndTerminated = true;
      try {
        const profileProcesses = await findWindowsProfileProcesses(profile);
        for (const processInfo of profileProcesses) {
          const terminate = runtime.forceTerminatePid
            ?? ((targetPid, targetLabel) => forceTerminatePid(targetPid, targetLabel, runtime));
          await terminate(
            Number(processInfo.ProcessId),
            `Edge process using profile ${profile}`,
          );
        }
      } catch (error) {
        inspectionError = error;
      }
    }

    const remainingMs = deadline - runtime.now();
    if (remainingMs > 0) {
      const retryDelay = Math.min(
        PROFILE_RETRY_DELAY_MS * (2 ** Math.min(attempts - 1, 3)),
        PROFILE_RETRY_MAX_DELAY_MS,
      );
      await runtime.wait(Math.min(retryDelay, remainingMs));
    }
  }

  throw await profileRemovalError(
    profile,
    options,
    startedAt,
    lastError,
    inspectionError,
    runtime,
  );
}

export async function cleanupBrowserProof(options) {
  const {
    browser,
    browserLabel,
    client,
    profile,
    requestBrowserClose,
    server,
    serverLabel,
    runtime,
  } = options;
  const metadata = ownedChildren.get(browser);
  let browserStatus = "running";
  let proofServerStatus = server === undefined ? "not-used" : "running";
  let cleanupError;

  try {
    await stopChildProcess(browser, {
      label: browserLabel,
      windowsProcessTree: true,
      requestGracefulClose: requestBrowserClose,
      runtime,
    });
    browserStatus = "stopped";
  } catch (error) {
    browserStatus = "shutdown-failed";
    cleanupError = error;
  } finally {
    client?.close();
  }

  if (server !== undefined) {
    try {
      await stopChildProcess(server, { label: serverLabel, runtime });
      proofServerStatus = "stopped";
    } catch (error) {
      proofServerStatus = "shutdown-failed";
      cleanupError ??= error;
    }
  }

  if (cleanupError === undefined) {
    try {
      await removeBrowserProfile(profile, {
        rootPid: browser.pid,
        processGroupId: metadata?.processGroupId,
        browserStatus,
        proofServerStatus,
        runtime,
      });
    } catch (error) {
      cleanupError = error;
    }
  }

  if (cleanupError !== undefined) throw cleanupError;
}
