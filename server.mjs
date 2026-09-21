import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT) || 4173;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function resolvePath(urlPath) {
  const pathname = decodeURIComponent(urlPath === "/" ? "/index.html" : urlPath);
  const normalized = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, normalized);
  const relativePath = relative(root, filePath);

  if (relativePath.startsWith("..") || relativePath.includes(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    return null;
  }

  return filePath;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    const filePath = resolvePath(url.pathname);

    if (!filePath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    });
    response.end(body);
  } catch (error) {
    if (error?.code === "ENOENT") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(500);
    response.end("Internal server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Teleprompter running at http://127.0.0.1:${port}`);
});
