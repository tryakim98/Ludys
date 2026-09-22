import {
  requireSameOriginGet,
  SafeHttpError,
  sendFailure,
  sendJson,
} from "../lib/http.mjs";
import { publicRuntimeConfig } from "../lib/runtime-config.mjs";

export async function handleRuntimeConfig(request, response, options = {}) {
  const env = options.env ?? process.env;
  try {
    requireSameOriginGet(request, env);
    sendJson(response, 200, publicRuntimeConfig(env));
  } catch (error) {
    if (error instanceof SafeHttpError && error.status === 405) error.expectedMethod = "GET";
    sendFailure(response, error);
  }
}

export default function runtimeConfig(request, response) {
  return handleRuntimeConfig(request, response);
}
