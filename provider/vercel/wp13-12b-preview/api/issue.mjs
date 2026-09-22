import {
  readJsonBody,
  requireExactKeys,
  requireSameOriginPost,
  SafeHttpError,
  sendFailure,
  sendJson,
} from "../lib/http.mjs";
import { invokePrivateFunction } from "../lib/private-function-proxy.mjs";
import {
  deploymentRole,
  privateFunctionUrls,
} from "../lib/runtime-config.mjs";

const MAXIMUM_LIFETIME_MS = 15 * 60 * 1000;

export async function handleIssue(request, response, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    requireSameOriginPost(request, env);
    if (deploymentRole(env) !== "active") {
      throw new SafeHttpError(503, "ROLLBACK_SAFE_DISABLED");
    }
    const body = await readJsonBody(request);
    requireExactKeys(body, ["locale", "lifetimeMs"]);
    if (
      !["nb-NO", "nn-NO"].includes(body.locale)
      || !Number.isInteger(body.lifetimeMs)
      || body.lifetimeMs < 60_000
      || body.lifetimeMs > MAXIMUM_LIFETIME_MS
    ) throw new SafeHttpError(400, "ISSUE_REQUEST_INVALID");
    const value = await invokePrivateFunction({
      request,
      env,
      url: privateFunctionUrls(env).issue,
      body: {
        locale: body.locale,
        lifetimeMs: body.lifetimeMs,
      },
      fetchImpl,
    });
    sendJson(response, 201, value);
  } catch (error) {
    if (error instanceof SafeHttpError && error.status === 405) error.expectedMethod = "POST";
    sendFailure(response, error);
  }
}

export default function issue(request, response) {
  return handleIssue(request, response);
}
