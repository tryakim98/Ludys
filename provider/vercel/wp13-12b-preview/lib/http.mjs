const MAX_REQUEST_BYTES = 8 * 1024;

export class SafeHttpError extends Error {
  constructor(status, denialClass) {
    super("SAFE_HTTP_ERROR");
    this.status = status;
    this.denialClass = denialClass;
  }
}

export function headerValue(request, name) {
  const headers = request?.headers ?? {};
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct) || typeof direct !== "string") return undefined;
  return direct;
}

function validVercelHostname(value) {
  return (
    typeof value === "string"
    && value.length <= 253
    && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.vercel\.app$/u.test(value)
  );
}

export function requirePreviewContext(request, env) {
  if (env?.VERCEL_ENV !== "preview" || !validVercelHostname(env.VERCEL_URL)) {
    throw new SafeHttpError(503, "PREVIEW_RUNTIME_REQUIRED");
  }
  const expectedOrigin = `https://${env.VERCEL_URL}`;
  const host = headerValue(request, "host");
  if (host !== undefined && host !== env.VERCEL_URL) {
    throw new SafeHttpError(403, "SAME_ORIGIN_REQUIRED");
  }
  const fetchSite = headerValue(request, "sec-fetch-site");
  if (fetchSite !== undefined && fetchSite !== "same-origin") {
    throw new SafeHttpError(403, "SAME_ORIGIN_REQUIRED");
  }
  let parsed;
  try {
    parsed = new URL(request.url ?? "/", expectedOrigin);
  } catch {
    throw new SafeHttpError(400, "REQUEST_URL_INVALID");
  }
  if (parsed.search !== "" || parsed.hash !== "") {
    throw new SafeHttpError(400, "QUERY_FORBIDDEN");
  }
  return Object.freeze({ expectedOrigin });
}

export function requireSameOriginPost(request, env) {
  const context = requirePreviewContext(request, env);
  if (request.method !== "POST") throw new SafeHttpError(405, "METHOD_NOT_ALLOWED");
  if (headerValue(request, "origin") !== context.expectedOrigin) {
    throw new SafeHttpError(403, "SAME_ORIGIN_REQUIRED");
  }
  const contentType = headerValue(request, "content-type");
  if (contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    throw new SafeHttpError(415, "JSON_CONTENT_TYPE_REQUIRED");
  }
  return context;
}

export function requireSameOriginGet(request, env) {
  const context = requirePreviewContext(request, env);
  if (request.method !== "GET") throw new SafeHttpError(405, "METHOD_NOT_ALLOWED");
  return context;
}

export async function readJsonBody(request) {
  let source = request.body;
  if (source === undefined) {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.byteLength;
      if (bytes > MAX_REQUEST_BYTES) throw new SafeHttpError(413, "BODY_TOO_LARGE");
      chunks.push(buffer);
    }
    source = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(source)) source = source.toString("utf8");
  if (typeof source === "string") {
    if (Buffer.byteLength(source, "utf8") > MAX_REQUEST_BYTES) {
      throw new SafeHttpError(413, "BODY_TOO_LARGE");
    }
    try {
      source = JSON.parse(source);
    } catch {
      throw new SafeHttpError(400, "JSON_BODY_INVALID");
    }
  } else {
    let encoded;
    try {
      encoded = JSON.stringify(source);
    } catch {
      throw new SafeHttpError(400, "JSON_BODY_INVALID");
    }
    if (encoded === undefined || Buffer.byteLength(encoded, "utf8") > MAX_REQUEST_BYTES) {
      throw new SafeHttpError(413, "BODY_TOO_LARGE");
    }
  }
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    throw new SafeHttpError(400, "JSON_OBJECT_REQUIRED");
  }
  return source;
}

export function requireExactKeys(value, expectedKeys) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) throw new SafeHttpError(400, "REQUEST_SCHEMA_INVALID");
}

function securityHeaders(response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

export function sendJson(response, status, value, allowMethod) {
  securityHeaders(response);
  if (allowMethod !== undefined) response.setHeader("Allow", allowMethod);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

export function sendFailure(response, error) {
  const status = error instanceof SafeHttpError ? error.status : 503;
  const denialClass = error instanceof SafeHttpError
    ? error.denialClass
    : "PREVIEW_PROVIDER_UNAVAILABLE";
  sendJson(
    response,
    status,
    { ok: false, denialClass },
    status === 405 ? (error?.expectedMethod ?? undefined) : undefined,
  );
}
