# Pretzel's Unblocked Games: RETURN

> ## ⚠️ TEST PHASE
> **This is an unfinished, early preview build — not a finished product.**
> Games, proxy routing, the AI personas and the desktop packaging are all still in progress,
> so expect rough edges, missing pieces and the odd broken frame. Nothing here is final.
> Judge it as a test build, and report what breaks instead of scoring it as a release.

**Live test build:** https://krillekz.github.io/pretzels-unblocked-games-return/

A local-first arcade shell: a frame-verified game library, three offline AI personas, a sandboxed
browser and a settings panel — all static files, no accounts, no telemetry, no server.

## What works today

| Area | Status |
| --- | --- |
| Game library | 16 entries, genre/platform/proxy filters, search, sorting, keyboard scrolling |
| Game viewport | Sandboxed iframe with refresh, fullscreen, close; `needsProxy` routing |
| AI panel | Three deterministic local engines: Anime Debate Matrix (curated roster + scouted estimates for any name), Academic Assistant, Pretzel Chef |
| Sandbox browser | Smart address parsing (URL vs search), configurable search engine and home page, block dialog with proxy retry |
| Settings | 36 controls across 7 sections, saved to `localStorage`, plus export / import / reset |
| Diagnostics | Session, breakpoint, catalog, proxy state, renderer and a filterable lifecycle log |
| Proxy gateway | Deployable edge-function adapters in `proxy/` (Vercel + Cloudflare) and a local dev gateway in `tools/proxy-dev.js` |

## What is still in progress

- **Electron packaging** (Phase 4) — no `main.js`, preload bridge or `.exe` yet; the renderer still reports `Browser`.
- **Manager.exe** (Phase 5) — the separate dashboard app is not built.
- **Proxy deployment** — nothing routes through a proxy until you deploy an adapter and paste its URL into `data/config.json`. Blocked sites simply show the block panel until then.
- **Offline fallback, stealth hotkeys, mirror generation** (Phase 6) — not started.
- **Catalog verification** — hosts can change their framing headers at any time; entries are point-in-time checks, not guarantees.

## Run it locally

The app fetches `data/*.json`, so open it over HTTP rather than `file://`:

```bash
python -m http.server 8765
# then open http://127.0.0.1:8765/
```

Optional local proxy gateway for testing blocked sites:

```bash
node tools/proxy-dev.js   # 127.0.0.1:8788
```

## Layout

```
index.html            shell markup
css/theme.css         design tokens (locked palette, fonts)
css/app.css           layout, panels, responsive trays
js/app.js             shell wiring, library, browser, settings renderer
js/ai.js              three local persona engines
js/settings.js        settings store + schema
data/library.json     game catalog
data/config.json      runtime config (search, proxy, hotkeys)
proxy/                Vercel and Cloudflare gateway adapters
tools/proxy-dev.js    local gateway for testing
ReadMe.txt            full blueprint, locked design decisions and build log
```

## Credits

Pretzel (vision) · Krillekz (systems) · Raevik (workspace and deployment) · LuxLoop (UI and sandboxing) · Kyrtop (diagnostics). See `Credits.txt`.

No accounts, no analytics, no network calls from the engines. Game content belongs to its respective hosts and is embedded, not redistributed.
