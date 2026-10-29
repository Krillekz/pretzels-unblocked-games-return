#!/usr/bin/env node
/* =====================================================================
   Pretzel proxy — local development gateway
   Mirrors the deployed worker contract so the client can be tested
   without deploying anything:

     node tools/proxy-dev.js
     GET http://127.0.0.1:8788/                     -> JSON health
     GET http://127.0.0.1:8788/?url=<encoded https> -> proxied document

   Development only: no auth, no rate limits, no production hardening.
   ===================================================================== */

const http = require("http");

const PORT = Number(process.env.PORT) || 8788;
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "Content-Type"
};

const json = (res, payload, status = 200) => {
  res.writeHead(status, { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
};

function isBlockedHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "::1" || host === "0.0.0.0") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

function injectBase(html, targetUrl) {
  const safeBase = targetUrl.replace(/"/g, "&quot;");
  const tag = `<base href="${safeBase}"><meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, (match) => `${match}${tag}`);
  }
  return tag + html;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== "GET") {
    json(res, { ok: false, error: "method_not_allowed" }, 405);
    return;
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const target = url.searchParams.get("url");
  const token = process.env.PROXY_TOKEN;

  if (token && url.searchParams.get("token") !== token) {
    json(res, { ok: false, error: "unauthorized" }, 401);
    return;
  }

  if (!target) {
    json(res, { ok: true, service: "pretzel-proxy", version: 1, mode: "local-dev", usage: "/?url=<encoded>" });
    return;
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    json(res, { ok: false, error: "invalid_url" }, 400);
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    json(res, { ok: false, error: "unsupported_scheme" }, 400);
    return;
  }
  if (isBlockedHost(parsed.hostname)) {
    json(res, { ok: false, error: "blocked_host" }, 403);
    return;
  }

  let upstream;
  try {
    upstream = await fetch(parsed.href, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 PretzelProxy/1.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "accept-encoding": "identity"
      },
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    json(res, { ok: false, error: "upstream_failed", detail: String(error && error.message) }, 502);
    return;
  }

  const headers = {};
  upstream.headers.forEach((value, key) => {
    if (
      ["x-frame-options", "content-security-policy", "content-security-policy-report-only", "set-cookie"].includes(key) ||
      ["content-encoding", "content-length", "transfer-encoding", "connection"].includes(key)
    ) {
      return;
    }
    headers[key] = value;
  });
  Object.assign(headers, CORS, { "x-pretzel-proxy": "1" });

  const contentType = (upstream.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("text/html")) {
    const html = injectBase(await upstream.text(), parsed.href);
    res.writeHead(upstream.status, { ...headers, "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(html);
    return;
  }

  if (contentType.includes("text/css") || contentType.includes("javascript")) {
    res.writeHead(upstream.status, headers);
    res.end(await upstream.text());
    return;
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, { ...headers, "content-length": body.length });
  res.end(body);
});

server.listen(PORT, "127.0.0.1", () => {
  const bound = server.address().port;
  console.log(`Pretzel dev proxy listening on http://127.0.0.1:${bound}`);
  console.log(`Health: http://127.0.0.1:${bound}/`);
  console.log(`Usage:  http://127.0.0.1:${bound}/?url=<encoded target>`);
});
