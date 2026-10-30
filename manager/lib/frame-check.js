"use strict";

const { isHttpUrl } = require("./catalog");

function parseFrameAncestors(csp) {
  if (!csp) return [];
  const directives = [];
  for (const policy of String(csp).split(",")) {
    for (const part of policy.split(";")) {
      const trimmed = part.trim();
      if (/^frame-ancestors\b/i.test(trimmed)) {
        directives.push(trimmed.replace(/^frame-ancestors\s*/i, "").trim());
      }
    }
  }
  return directives;
}

function analyzeFramePolicy(headers) {
  const xfo = (headers["x-frame-options"] || "").trim();
  const csp = headers["content-security-policy"] || "";
  const ancestors = parseFrameAncestors(csp);
  const sources = ancestors.flatMap((directive) => directive.split(/\s+/).filter(Boolean));
  const normalized = sources.map((source) => source.toLowerCase());

  if (/\bdeny\b/i.test(xfo)) {
    return { verdict: "blocked", label: "Blocked by X-Frame-Options: DENY", detail: "No site may embed this page in a frame." };
  }
  if (/\bsameorigin\b/i.test(xfo)) {
    return {
      verdict: "blocked",
      label: "Blocked by X-Frame-Options: SAMEORIGIN",
      detail: "Only the site's own origin may embed it; the games shell is a different origin.",
    };
  }
  if (/\ballow-from\b/i.test(xfo)) {
    return {
      verdict: "restricted",
      label: "Restricted by X-Frame-Options: ALLOW-FROM",
      detail: "Only a named ancestor origin is allowed. That directive is obsolete in current Chromium.",
    };
  }
  const allowsLocalhost = normalized.some((token) => token.includes("127.0.0.1") || token.includes("localhost"));
  const allowsAny = normalized.includes("*");

  if (normalized.includes("'none'")) {
    return { verdict: "blocked", label: "Blocked by frame-ancestors 'none'", detail: "The CSP explicitly forbids all framing." };
  }
  if (normalized.includes("'self'") && !allowsLocalhost) {
    return {
      verdict: "blocked",
      label: "Blocked by frame-ancestors 'self'",
      detail: "The page only permits framing by its own origin.",
    };
  }
  if (ancestors.length > 0) {
    if (allowsAny || allowsLocalhost) {
      return {
        verdict: "likely",
        label: "CSP allows a local ancestor",
        detail: `frame-ancestors ${sources.join(" ")} permits the local shell.`,
      };
    }
    return {
      verdict: "restricted",
      label: "CSP limits eligible ancestors",
      detail: `frame-ancestors ${sources.join(" ")} does not name the local shell.`,
    };
  }
  if (xfo || csp) {
    return {
      verdict: "likely",
      label: "No framing refusal found",
      detail: "A header is present, but it does not restrict who may frame the page.",
    };
  }
  return {
    verdict: "likely",
    label: "No framing refusal found",
    detail: "No X-Frame-Options or CSP frame-ancestors header was returned. Framing should work, subject to the page's own scripts.",
  };
}

async function checkFrame(url) {
  if (!isHttpUrl(url)) {
    return { ok: false, error: "Enter a full http(s) URL." };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  let response;
  try {
    const electron = require("electron");
    const doFetch = electron?.net?.fetch ? electron.net.fetch.bind(electron.net) : fetch;
    response = await doFetch(url, {
      method: "GET",
      redirect: "follow",
      credentials: "omit",
      signal: controller.signal,
      headers: {
        "user-agent": "PretzelManager/0.1 (+local workspace utility)",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    const aborted = error.name === "AbortError" || /aborted/i.test(error.message || "");
    return {
      ok: false,
      error: aborted ? "The host did not answer within 9 seconds." : error.message || "The request failed.",
      url,
      elapsedMs: Date.now() - started,
    };
  }
  clearTimeout(timeout);

  const headers = {};
  for (const [key, value] of response.headers.entries()) {
    if (key !== "set-cookie") headers[key] = value;
  }

  try {
    await response.body?.cancel();
  } catch {
    /* body is not needed for a header verdict */
  }

  const frame = analyzeFramePolicy(headers);
  const finalUrl = response.url || url;
  const elapsedMs = Date.now() - started;
  const status = response.status;
  const reachable = status > 0;

  return {
    ok: reachable,
    url,
    finalUrl,
    status,
    statusText: response.statusText || "",
    contentType: headers["content-type"] || "",
    elapsedMs,
    frame,
    headers: {
      "x-frame-options": headers["x-frame-options"] || "",
      "content-security-policy": headers["content-security-policy"] || "",
      "content-type": headers["content-type"] || "",
      server: headers.server || "",
      "permissions-policy": headers["permissions-policy"] || "",
      "cross-origin-opener-policy": headers["cross-origin-opener-policy"] || "",
    },
    redirectChanged: finalUrl !== url,
    insecureRedirect: url.startsWith("https:") && finalUrl.startsWith("http:"),
    note:
      status >= 400
        ? `The host answered HTTP ${status}; the page may show an error even if framing is allowed.`
        : frame.verdict === "likely"
          ? "Header-only check. Open the visual test to confirm the page actually paints inside a frame."
          : "Header check only; the visual test shows the same refusal in a real frame.",
  };
}

module.exports = { checkFrame, analyzeFramePolicy, parseFrameAncestors };
