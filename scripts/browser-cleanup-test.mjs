import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cleanupBrowserProof,
  registerOwnedChildProcess,
  removeBrowserProfile,
  stopChildProcess,
  waitForOwnedProcessEndpoint,
} from "./browser-cleanup.mjs";

function fakeChild(pid) {
  return {
    pid,
    exitCode: null,
    signalCode: null,
  };
}

function fakeRuntime(options = {}) {
  let clock = 0;
  const alivePids = new Set(options.alivePids ?? []);
  const aliveGroups = new Set(options.aliveGroups ?? []);
  const signals = [];
  const events = [];
  const runtime = {
    platform: options.platform ?? "linux",
    now: () => clock,
    wait: async (ms) => { clock += ms; },
    processExists: (pid) => alivePids.has(pid),
    processGroupExists: (processGroupId) => aliveGroups.has(processGroupId),
    signalChild: (child, signal) => {
      signals.push({ kind: "child", target: child.pid, signal });
      options.onChildSignal?.({ child, signal, alivePids, aliveGroups, events });
    },
    signalPid: (pid, signal) => {
      signals.push({ kind: "pid", target: pid, signal });
      options.onPidSignal?.({ pid, signal, alivePids, aliveGroups, events });
    },
    signalProcessGroup: (processGroupId, signal) => {
      signals.push({ kind: "group", target: processGroupId, signal });
      options.onGroupSignal?.({ processGroupId, signal, alivePids, aliveGroups, events });
    },
    removeProfile: options.removeProfile ?? (async () => {}),
    readProfileEntries: options.readProfileEntries ?? (async () => []),
    findProfileProcesses: options.findProfileProcesses ?? (async () => []),
  };
  if (options.forceTerminatePid !== undefined) {
    runtime.forceTerminatePid = (pid, label) => options.forceTerminatePid({
      pid,
      label,
      alivePids,
      aliveGroups,
      events,
    });
  }
  return { runtime, alivePids, aliveGroups, signals, events, now: () => clock };
}

test("a disappeared PID is already stopped", async () => {
  const child = fakeChild(101);
  const control = fakeRuntime();
  await stopChildProcess(child, { runtime: control.runtime });
  assert.deepEqual(control.signals, []);
});

test("owned endpoint readiness tolerates bounded startup delay", async () => {
  const child = fakeChild(151);
  let attempts = 0;
  const control = fakeRuntime();
  const response = await waitForOwnedProcessEndpoint("http://127.0.0.1:9999/ready", {
    child,
    label: "test browser",
    pollIntervalMs: 50,
    runtime: {
      ...control.runtime,
      fetch: async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("not listening yet");
        return { ok: true };
      },
    },
    timeoutMs: 1_000,
  });
  assert.equal(response.ok, true);
  assert.equal(attempts, 3);
  assert.equal(control.now(), 100);
});

test("owned endpoint readiness reports early process exit", async () => {
  const child = fakeChild(152);
  child.exitCode = 1;
  const control = fakeRuntime();
  await assert.rejects(
    () => waitForOwnedProcessEndpoint("http://127.0.0.1:9999/ready", {
      child,
      label: "test browser",
      runtime: { ...control.runtime, fetch: async () => ({ ok: false }) },
    }),
    /test browser exited.*platform=linux.*pid=152.*exitCode=1/,
  );
});

test("an owned POSIX process group receives SIGTERM before SIGKILL", async () => {
  const child = registerOwnedChildProcess(fakeChild(201), { platform: "linux" });
  const control = fakeRuntime({
    alivePids: [201],
    aliveGroups: [201],
    onGroupSignal: ({ processGroupId, signal, alivePids, aliveGroups }) => {
      if (signal === "SIGKILL") {
        aliveGroups.delete(processGroupId);
        alivePids.delete(processGroupId);
      }
    },
  });
  await stopChildProcess(child, { runtime: control.runtime });
  assert.deepEqual(
    control.signals.map(({ kind, target, signal }) => [kind, target, signal]),
    [["group", 201, "SIGTERM"], ["group", 201, "SIGKILL"]],
  );
});

test("only the registered POSIX process group is terminated", async () => {
  const child = registerOwnedChildProcess(fakeChild(301), { platform: "linux" });
  const control = fakeRuntime({
    alivePids: [301, 999],
    aliveGroups: [301, 999],
    onGroupSignal: ({ processGroupId, signal, alivePids, aliveGroups }) => {
      if (signal === "SIGTERM") {
        aliveGroups.delete(processGroupId);
        alivePids.delete(processGroupId);
      }
    },
  });
  await stopChildProcess(child, { runtime: control.runtime });
  assert.deepEqual(control.signals, [{ kind: "group", target: 301, signal: "SIGTERM" }]);
  assert.equal(control.alivePids.has(999), true);
  assert.equal(control.aliveGroups.has(999), true);
});

test("proof server shutdown completes before profile removal", async () => {
  const browser = registerOwnedChildProcess(fakeChild(401), { platform: "linux" });
  const server = registerOwnedChildProcess(fakeChild(402), { platform: "linux" });
  const control = fakeRuntime({
    alivePids: [401, 402],
    aliveGroups: [401, 402],
    onGroupSignal: ({ processGroupId, signal, alivePids, aliveGroups, events }) => {
      events.push(`${processGroupId}:${signal}`);
      aliveGroups.delete(processGroupId);
      alivePids.delete(processGroupId);
    },
    removeProfile: async () => { control.events.push("profile:remove"); },
  });
  await cleanupBrowserProof({
    browser,
    browserLabel: "test browser",
    client: { close: () => control.events.push("client:close") },
    profile: "/tmp/owned-profile",
    requestBrowserClose: async () => {
      control.events.push("browser:close");
      control.aliveGroups.delete(401);
      control.alivePids.delete(401);
    },
    runtime: control.runtime,
    server,
    serverLabel: "test proof server",
  });
  assert.ok(control.events.indexOf("402:SIGTERM") >= 0);
  assert.ok(control.events.indexOf("402:SIGTERM") < control.events.indexOf("profile:remove"));
});

test("Windows keeps PID-scoped tree termination and never uses an image-wide kill", async () => {
  const child = registerOwnedChildProcess(fakeChild(501), { platform: "win32" });
  const control = fakeRuntime({
    platform: "win32",
    alivePids: [501],
    onChildSignal: () => {},
    forceTerminatePid: async ({ pid, alivePids, events }) => {
      events.push(`taskkill:${pid}`);
      alivePids.delete(pid);
    },
  });
  await stopChildProcess(child, {
    runtime: control.runtime,
    windowsProcessTree: true,
  });
  assert.deepEqual(control.signals, [{ kind: "child", target: 501, signal: "SIGTERM" }]);
  assert.deepEqual(control.events, ["taskkill:501"]);
  const source = await readFile(new URL("./browser-cleanup.mjs", import.meta.url), "utf8");
  assert.match(source, /\["\/PID", String\(pid\), "\/T", "\/F"\]/);
  assert.match(source, /\{ verifiedExisting: true \}/);
  assert.doesNotMatch(source, /\/IM\s+|msedge\.exe.*\/F/i);
});

test("profile removal retries bounded file-release races with backoff", async () => {
  let attempts = 0;
  const control = fakeRuntime({
    removeProfile: async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("profile busy"), { code: "EBUSY" });
    },
  });
  await removeBrowserProfile("/tmp/owned-profile", { runtime: control.runtime });
  assert.equal(attempts, 3);
  assert.ok(control.now() >= 1_400);
});

test("Windows profile cleanup retries a transient child-process inspection", async () => {
  let removalAttempts = 0;
  let inspectionAttempts = 0;
  let locked = true;
  const control = fakeRuntime({
    platform: "win32",
    removeProfile: async () => {
      removalAttempts += 1;
      if (locked) throw Object.assign(new Error("profile busy"), { code: "EBUSY" });
    },
    findProfileProcesses: async () => {
      inspectionAttempts += 1;
      if (inspectionAttempts === 1) throw new Error("transient CIM failure");
      return [{ ProcessId: 888 }];
    },
    forceTerminatePid: async ({ pid, events }) => {
      events.push(`taskkill:${pid}`);
      locked = false;
    },
  });
  await removeBrowserProfile("C:\\Temp\\owned-profile", { runtime: control.runtime });
  assert.equal(inspectionAttempts, 2);
  assert.deepEqual(control.events, ["taskkill:888"]);
  assert.equal(removalAttempts, 7);
});

test("terminal profile cleanup failures remain fatal and diagnostic", async () => {
  const control = fakeRuntime({
    removeProfile: async () => {
      throw Object.assign(new Error("profile locked"), { code: "ENOTEMPTY" });
    },
    readProfileEntries: async () => ["Cache/locked-file"],
  });
  await assert.rejects(
    () => removeBrowserProfile("/tmp/owned-profile", {
      browserStatus: "stopped",
      processGroupId: 601,
      proofServerStatus: "stopped",
      rootPid: 601,
      runtime: control.runtime,
    }),
    (error) => {
      assert.match(error.message, /Platform: linux/);
      assert.match(error.message, /\/tmp\/owned-profile/);
      assert.match(error.message, /Root PID: 601/);
      assert.match(error.message, /Process group ID: 601/);
      assert.match(error.message, /proof server status: stopped/);
      assert.match(error.message, /ENOTEMPTY: profile locked/);
      assert.match(error.message, /Cleanup elapsed: 60000 ms/);
      assert.match(error.message, /Cache\/locked-file/);
      return true;
    },
  );
});

test("unrelated user PIDs and groups are never signalled", async () => {
  const child = registerOwnedChildProcess(fakeChild(701), { platform: "linux" });
  const control = fakeRuntime({
    alivePids: [701, 702],
    aliveGroups: [701, 702],
    onGroupSignal: ({ processGroupId, alivePids, aliveGroups }) => {
      aliveGroups.delete(processGroupId);
      alivePids.delete(processGroupId);
    },
  });
  await stopChildProcess(child, { runtime: control.runtime });
  assert.equal(control.signals.some(({ target }) => target === 702), false);
  assert.equal(control.alivePids.has(702), true);
  assert.equal(control.aliveGroups.has(702), true);
});
