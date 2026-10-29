/* =====================================================================
   Pretzel proxy — Cloudflare Workers adapter
   Deploy: npx wrangler deploy   (or paste into the Workers dashboard)
   Contract (shared with the Vercel adapter and tools/proxy-dev.js):
     GET  /?url=<encoded https>  -> proxied document
     GET  /                      -> JSON health
   Optional vars: PROXY_TOKEN, ALLOWED_HOSTS
   ===================================================================== */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "Content-Type"
};

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });

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

function hostAllowed(hostname, allowList) {
  if (!allowList) return true;
  return allowList
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => hostname.toLowerCase() === entry || hostname.toLowerCase().endsWith("." + entry));
}

function injectBase(html, targetUrl) {
  const safeBase = targetUrl.replace(/"/g, "&quot;");
  const tag = `<base href="${safeBase}"><meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, (match) => `${match}${tag}`);
  }
  return tag + html;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "GET") {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    const token = env && env.PROXY_TOKEN;

    if (token && url.searchParams.get("token") !== token) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    if (!target) {
      return json({ ok: true, service: "pretzel-proxy", version: 1, usage: "/?url=<encoded>" });
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return json({ ok: false, error: "invalid_url" }, 400);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return json({ ok: false, error: "unsupported_scheme" }, 400);
    }
    if (isBlockedHost(parsed.hostname)) {
      return json({ ok: false, error: "blocked_host" }, 403);
    }
    if (!hostAllowed(parsed.hostname, env && env.ALLOWED_HOSTS)) {
      return json({ ok: false, error: "host_not_allowed" }, 403);
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
      return json({ ok: false, error: "upstream_failed", detail: String(error && error.message) }, 502);
    }

    const headers = new Headers(upstream.headers);
    ["x-frame-options", "content-security-policy", "content-security-policy-report-only", "set-cookie"].forEach(
      (name) => headers.delete(name)
    );
    headers.delete("content-encoding");
    headers.delete("content-length");
    Object.entries(CORS).forEach(([key, value]) => headers.set(key, value));
    headers.set("x-pretzel-proxy", "1");

    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();

    if (contentType.includes("text/html")) {
      const html = injectBase(await upstream.text(), parsed.href);
      headers.set("content-type", "text/html; charset=utf-8");
      headers.set("cache-control", "no-store");
      return new Response(html, { status: upstream.status, headers });
    }

    if (contentType.includes("text/css") || contentType.includes("javascript")) {
      return new Response(await upstream.text(), { status: upstream.status, headers });
    }

    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
  }
};
