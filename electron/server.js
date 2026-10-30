"use strict";

const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

function createStaticServer(getRoot) {
  const server = http.createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    const root = path.resolve(getRoot());
    let target = path.resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    let stat = null;
    try {
      stat = await fs.stat(target);
    } catch {
      stat = null;
    }

    if (stat?.isDirectory()) {
      if (!pathname.endsWith("/")) {
        response.writeHead(302, { location: `${pathname}/` });
        response.end();
        return;
      }
      target = path.join(target, "index.html");
      try {
        stat = await fs.stat(target);
      } catch {
        stat = null;
      }
    }

    if (!stat?.isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
      "content-length": stat.size,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    try {
      const body = await fs.readFile(target);
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(`Could not read file: ${error.message}`);
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        port: address.port,
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

module.exports = { createStaticServer, MIME };
