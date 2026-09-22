import { SafeHttpError } from "./http.mjs";
import { privateFunctionIdToken } from "./google-identity.mjs";

async function responseJson(response) {
  let text;
  try {
    text = await response.text();
  } catch {
    throw new SafeHttpError(502, "PRIVATE_FUNCTION_RESPONSE_INVALID");
  }
  if (text.length > 1024 * 1024) {
    throw new SafeHttpError(502, "PRIVATE_FUNCTION_RESPONSE_INVALID");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new SafeHttpError(502, "PRIVATE_FUNCTION_RESPONSE_INVALID");
  }
}

export async function invokePrivateFunction({
  request,
  env,
  url,
  body,
  fetchImpl = fetch,
}) {
  const idToken = await privateFunctionIdToken(request, env, url, fetchImpl);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: Object.freeze({
        Accept: "application/json",
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new SafeHttpError(502, "PRIVATE_FUNCTION_UNAVAILABLE");
  }
  const value = await responseJson(response);
  if (!response.ok) {
    const denialClass = typeof value?.denialClass === "string"
      && /^[A-Z0-9_]{3,80}$/u.test(value.denialClass)
      ? value.denialClass
      : "PRIVATE_FUNCTION_DENIED";
    throw new SafeHttpError(response.status, denialClass);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SafeHttpError(502, "PRIVATE_FUNCTION_RESPONSE_INVALID");
  }
  return value;
}
