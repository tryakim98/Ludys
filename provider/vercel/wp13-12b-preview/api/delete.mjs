import {
  readJsonBody,
  requireExactKeys,
  requireSameOriginPost,
  SafeHttpError,
  sendFailure,
  sendJson,
} from "../lib/http.mjs";
import { invokePrivateFunction } from "../lib/private-function-proxy.mjs";
import { privateFunctionUrls } from "../lib/runtime-config.mjs";

export async function handleDelete(request, response, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    requireSameOriginPost(request, env);
    const body = await readJsonBody(request);
    requireExactKeys(body, ["syntheticSessionId"]);
    if (
      typeof body.syntheticSessionId !== "string"
      || !/^synthetic-wp13-12b-[A-Za-z0-9_-]{20,64}$/u.test(body.syntheticSessionId)
    ) throw new SafeHttpError(400, "SESSION_ID_INVALID");
    const value = await invokePrivateFunction({
      request,
      env,
      url: privateFunctionUrls(env).delete,
      body: { syntheticSessionId: body.syntheticSessionId },
      fetchImpl,
    });
    sendJson(response, 200, value);
  } catch (error) {
    if (error instanceof SafeHttpError && error.status === 405) error.expectedMethod = "POST";
    sendFailure(response, error);
  }
}

export default function deleteSession(request, response) {
  return handleDelete(request, response);
}
