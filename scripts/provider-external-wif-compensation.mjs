function compensationError(code, report) {
  const error = new Error(code);
  error.code = code;
  error.compensationReport = report;
  return error;
}

function resultStatus(result) {
  return result.status === "fulfilled" ? "SUCCEEDED" : "FAILED";
}

export async function runExternalWifAtomicEnableCompensation(options) {
  if (
    options === null
    || typeof options !== "object"
    || Array.isArray(options)
    || Object.keys(options).sort().join(",")
      !== "disablePool,disableProvider,readDisabledState"
    || typeof options.disablePool !== "function"
    || typeof options.disableProvider !== "function"
    || typeof options.readDisabledState !== "function"
  ) {
    throw compensationError(
      "EXACT_WIF_ATOMIC_COMPENSATION_ADAPTER_REQUIRED",
      undefined,
    );
  }

  const [poolResult, providerResult] = await Promise.allSettled([
    Promise.resolve().then(options.disablePool),
    Promise.resolve().then(options.disableProvider),
  ]);
  let readbackResult;
  try {
    readbackResult = {
      status: "fulfilled",
      value: await options.readDisabledState(),
    };
  } catch (reason) {
    readbackResult = { status: "rejected", reason };
  }

  const poolDisable = resultStatus(poolResult);
  const providerDisable = resultStatus(providerResult);
  const combinedReadback = resultStatus(readbackResult);
  const report = Object.freeze({
    poolDisableAttempted: true,
    poolDisable,
    providerDisableAttempted: true,
    providerDisable,
    combinedReadbackAttempted: true,
    combinedReadback,
    complete:
      poolDisable === "SUCCEEDED"
      && providerDisable === "SUCCEEDED"
      && combinedReadback === "SUCCEEDED",
  });
  if (!report.complete) {
    throw compensationError(
      "WIF_ATOMIC_ENABLE_COMPENSATION_INCOMPLETE"
        + `_POOL_${poolDisable}`
        + `_PROVIDER_${providerDisable}`
        + `_READBACK_${combinedReadback}`,
      report,
    );
  }
  return Object.freeze({
    ...report,
    state: readbackResult.value,
  });
}
