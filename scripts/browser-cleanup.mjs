import { spawn } from "node:child_process";
import { readdir, rm } from "node:fs/promises";

const GRACEFUL_CLOSE_TIMEOUT_MS = 2_000;
const TERMINATE_TIMEOUT_MS = 2_000;
const FORCE_TIMEOUT_MS = 5_000;
const FILE_RELEASE_DELAY_MS = 500;
const PROFILE_DELETE_TIMEOUT_MS = 30_000;
const PROFILE_RETRY_DELAY_MS = 300;
const RETRYABLE_PROFILE_ERRORS = new Set(["EBUSY", "EPERM", "ENOTEMPTY"]);

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

function isExited(child) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return child.pid !== undefined && !processExists(child.pid);
}

function waitForExitOrClose(child, timeoutMs) {
  if (isExited(child)) return Promise.resolve(true);

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let timer;
    let settled = false;

    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("close", onClose);
      resolve(exited);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("close", onClose);
      reject(error);
    };
    const onExit = () => finish(true);
    const onClose = () => finish(true);
    const check = () => {
      try {
        if (isExited(child)) {
          finish(true);
        } else if (Date.now() >= deadline) {
          finish(false);
        } else {
          timer = setTimeout(check, 50);
        }
      } catch (error) {
        fail(error);
      }
    };

    child.once("exit", onExit);
    child.once("close", onClose);
    check();
  });
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

async function requestCloseWithinTimeout(requestGracefulClose) {
  if (requestGracefulClose === undefined) return undefined;

  let closeError;
  const closeAttempt = Promise.resolve()
    .then(requestGracefulClose)
    .catch((error) => {
      closeError = error;
    });
  await Promise.race([closeAttempt, wait(GRACEFUL_CLOSE_TIMEOUT_MS)]);
  return closeError;
}

async function waitForPidToDisappear(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (processExists(pid)) {
    if (Date.now() >= deadline) return false;
    await wait(50);
  }
  return true;
}

async function forceTerminatePid(pid, label) {
  if (!processExists(pid)) return;

  if (process.platform === "win32") {
    let result;
    try {
      result = await runWithOutput(
        "taskkill",
        ["/PID", String(pid), "/T", "/F"],
        { timeoutMs: FORCE_TIMEOUT_MS },
      );
    } catch (error) {
      if (await waitForPidToDisappear(pid, FORCE_TIMEOUT_MS)) return;
      throw error;
    }

    if (await waitForPidToDisappear(pid, FORCE_TIMEOUT_MS)) return;
    if (result.timedOut || result.code !== 0) {
      throw new Error(
        `Failed to force ${label} process tree ${pid}. `
          + `taskkill exit=${String(result.code)} signal=${String(result.signal)} `
          + `stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}`,
      );
    }
  } else {
    process.kill(pid, "SIGKILL");
  }

  if (!await waitForPidToDisappear(pid, FORCE_TIMEOUT_MS)) {
    throw new Error(`${label} PID ${pid} still exists after bounded forced termination.`);
  }
}

export async function stopChildProcess(child, options = {}) {
  const label = options.label ?? "child";
  if (isExited(child)) return;

  const gracefulError = await requestCloseWithinTimeout(options.requestGracefulClose);
  if (
    options.requestGracefulClose !== undefined
    && await waitForExitOrClose(child, GRACEFUL_CLOSE_TIMEOUT_MS)
  ) {
    return;
  }

  child.kill("SIGTERM");
  if (await waitForExitOrClose(child, TERMINATE_TIMEOUT_MS)) return;

  const pid = child.pid;
  if (
    pid !== undefined
    && process.platform === "win32"
    && options.windowsProcessTree === true
  ) {
    await forceTerminatePid(pid, label);
  } else {
    child.kill("SIGKILL");
  }
  if (isExited(child) || (pid !== undefined && !processExists(pid))) return;

  const gracefulDetail = gracefulError instanceof Error
    ? ` Graceful close failed: ${gracefulError.name}: ${gracefulError.message}`
    : "";
  throw new Error(
    `${label} process ${pid ?? "unknown"} still exists after bounded forced termination.`
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

async function remainingProfileEntries(profile) {
  try {
    return (await readdir(profile, { recursive: true })).slice(0, 50);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    return [`<inspection failed: ${error instanceof Error ? error.message : String(error)}>`];
  }
}

async function profileRemovalError(profile, options, startedAt, lastError, inspectionError) {
  let profileProcesses = [];
  let terminalInspectionError = inspectionError;
  if (process.platform === "win32") {
    try {
      profileProcesses = await findWindowsProfileProcesses(profile);
    } catch (error) {
      terminalInspectionError ??= error;
    }
  }
  const rootPid = options.rootPid;
  const rootExists = rootPid === undefined ? "unknown" : processExists(rootPid);
  const entries = await remainingProfileEntries(profile);
  const code = lastError?.code ?? "UNKNOWN";
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  const elapsedMs = Date.now() - startedAt;
  const processDetails = profileProcesses.length === 0
    ? "none"
    : JSON.stringify(profileProcesses);
  const inspectionDetails = terminalInspectionError instanceof Error
    ? ` Inspection error: ${terminalInspectionError.message}`
    : "";
  return new Error(
    `Failed to remove temporary browser profile ${profile}. `
      + `Last system error: ${code}: ${message}. `
      + `Root PID: ${rootPid ?? "unknown"}; root PID exists: ${String(rootExists)}. `
      + `Profile-linked Edge processes: ${processDetails}. `
      + `Cleanup elapsed: ${elapsedMs} ms. Remaining entries: ${JSON.stringify(entries)}.`
      + inspectionDetails,
    { cause: lastError },
  );
}

export async function removeBrowserProfile(profile, options = {}) {
  const startedAt = Date.now();
  const deadline = startedAt + PROFILE_DELETE_TIMEOUT_MS;
  let lastError;
  let inspectionError;
  let attempts = 0;
  let inspectedAndTerminated = false;

  await wait(FILE_RELEASE_DELAY_MS);
  while (Date.now() < deadline) {
    try {
      await rm(profile, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (!RETRYABLE_PROFILE_ERRORS.has(error?.code)) {
        throw await profileRemovalError(profile, options, startedAt, error, inspectionError);
      }
      attempts += 1;
    }

    if (
      process.platform === "win32"
      && attempts >= 3
      && !inspectedAndTerminated
    ) {
      inspectedAndTerminated = true;
      try {
        const profileProcesses = await findWindowsProfileProcesses(profile);
        for (const processInfo of profileProcesses) {
          await forceTerminatePid(
            Number(processInfo.ProcessId),
            `Edge process using profile ${profile}`,
          );
        }
      } catch (error) {
        inspectionError = error;
      }
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs > 0) {
      await wait(Math.min(PROFILE_RETRY_DELAY_MS, remainingMs));
    }
  }

  throw await profileRemovalError(profile, options, startedAt, lastError, inspectionError);
}
