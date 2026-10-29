# Pretzel proxy gateway

The sandboxed browser and any game flagged `needsProxy` can route a request through a small
edge function instead of loading it directly. The gateway fetches the page server-side, removes
the headers that forbid framing, and returns the document with a `<base>` tag so its assets
still load from the original site.

Nothing in this folder runs by itself — it is source you deploy once, then point the app at.

---

## Contract

| Request | Response |
| --- | --- |
| `GET /` or `GET /api/proxy` | `{ "ok": true, "service": "pretzel-proxy", "version": 1 }` |
| `GET /?url=<encoded target>` | The target document, proxied |
| `OPTIONS` | `204` with CORS headers |

Per response the gateway:

* deletes `X-Frame-Options`, `Content-Security-Policy`, `Content-Security-Policy-Report-Only`
* deletes `Set-Cookie` (no cross-user session leakage)
* deletes `Content-Encoding` / `Content-Length` (the body is re-served)
* adds `Access-Control-Allow-Origin: *` and `x-pretzel-proxy: 1`
* injects `<base href="<target>">` plus a `no-referrer` meta tag into HTML

Direct private and loopback hosts are refused, and only `http:` / `https:` targets are accepted.

---

## Option A — Vercel (free Hobby plan, no card)

```bash
cd proxy/vercel
npx vercel deploy --prod
```

The function ships as `api/proxy.js` with an edge runtime, and `vercel.json` adds a short
`/proxy` path. Environment variables are optional:

| Variable | Purpose |
| --- | --- |
| `PROXY_TOKEN` | Require `?token=` on every request |
| `ALLOWED_HOSTS` | Comma-separated host allowlist, e.g. `github.io,mathsisfun.com` |

Your URLs:

```
health    https://<project>.vercel.app/api/proxy
endpoint  https://<project>.vercel.app/api/proxy?url={url}
```

## Option B — Cloudflare Workers (free plan, no card)

```bash
npx wrangler deploy proxy/cloudflare/worker.js --name pretzel-proxy
```

Set `PROXY_TOKEN` / `ALLOWED_HOSTS` under the Worker's **Settings → Variables** if you want them.

Your URLs:

```
health    https://pretzel-proxy.<subdomain>.workers.dev/
endpoint  https://pretzel-proxy.<subdomain>.workers.dev/?url={url}
```

## Option C — local test gateway

```bash
node tools/proxy-dev.js
```

```
health    http://127.0.0.1:8788/
endpoint  http://127.0.0.1:8788/?url={url}
```

Development only — no auth, no rate limits, do not expose it publicly.

---

## Point the app at it

Edit `data/config.json`:

```json
"proxy": {
  "label": "Home gateway",
  "endpoint": "https://<your-deployment>/<path>?url={url}",
  "health": "https://<your-deployment>/<path>",
  "token": ""
}
```

* `endpoint` — `{url}` is replaced with the encoded target. If the placeholder is missing the
  encoded URL is appended instead, so `https://proxy.example/?url=` also works.
* `health` — probed by **Diagnostics → Test proxy** and once at boot; drives the Proxy node card
  (`Unconfigured` / `Checking…` / `Reachable` / `Unreachable`).
* `token` — sent as `?token=` when you set `PROXY_TOKEN`. It ships in client code, so treat it as a
  speed bump, not a secret; the real control is `ALLOWED_HOSTS`.

Reload the app, run **Test proxy**, then retry a blocked page from the browser panel.

---

## What proxying can and cannot fix

Works well: static pages and games whose assets are relative — the injected `<base>` resolves
them against the original origin.

Still broken: sites whose scripts make same-origin `fetch`/`XHR` calls, sites that hardcode their
own origin in JavaScript, sites requiring logins (cookies are stripped), and sites that actively
detect proxy hosts. Those need the site's own API to allow CORS; no document proxy can fix them.

Other limits:

* One top-level document is proxied. Subresources load directly unless their URLs are relative.
* The gateway is not a VPN and does not hide your IP from the destination site.
* An unauthenticated public gateway can be abused. Set `ALLOWED_HOSTS`, and set `PROXY_TOKEN`
  if the URL is shared.
* Only use it for content you have the right to access.

## Troubleshooting

| Card says | Meaning |
| --- | --- |
| `Unconfigured` | `proxy.endpoint` is empty in `data/config.json` |
| `Checking…` | Health request in flight |
| `Unreachable` | Health URL wrong, deployment asleep, or CORS blocked |
| `Reachable` | Health JSON answered with `ok: true` |

A `blocked_host` response means the gateway refused a private/loopback target by design.
An `upstream_failed` response means the destination refused the gateway's own request.
