import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const configuredRoot = process.env.LUDYS_PROOF_ROOT;
const root = configuredRoot === undefined
  ? repositoryRoot
  : resolve(repositoryRoot, configuredRoot);
const rootRelation = relative(repositoryRoot, root);
if (
  configuredRoot !== undefined
  && (
    rootRelation.startsWith("..")
    || rootRelation.includes(":")
    || rootRelation === ""
  )
) {
  throw new Error("configured proof root must be a repository subdirectory");
}
const defaultDocument = configuredRoot === undefined ? "/web/index.html" : "/index.html";
const port = Number(process.env.PORT ?? 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".wav": "audio/wav",
};
const securityHeaders = Object.freeze({
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
});

createServer(async (request, response) => {
  try {
    if (!request.method || !["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { ...securityHeaders, allow: "GET, HEAD" });
      response.end();
      return;
    }
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const requested = url.pathname === "/" ? defaultDocument : url.pathname;
    const path = resolve(root, `.${decodeURIComponent(requested)}`);
    const relation = relative(root, path);
    if (relation.startsWith("..") || relation.includes(":")) throw new Error("path leaves proof root");
    const info = await stat(path);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, {
      ...securityHeaders,
      "content-type": mime[extname(path)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : await readFile(path));
  } catch {
    response.writeHead(404, { ...securityHeaders, "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`WP13.3 proof server listening on http://127.0.0.1:${port}`);
});
