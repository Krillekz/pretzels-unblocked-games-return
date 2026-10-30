# Pretzel's Unblocked Games: RETURN

> ## ⚠️ TEST PHASE
> **This is an unfinished, early preview build — not a finished product.**
> Games, proxy routing, the AI personas and the desktop packaging are all still in progress,
> so expect rough edges, missing pieces and the odd broken frame. Nothing here is final.
> Judge it as a test build, and report what breaks instead of scoring it as a release.
>
> **Next release update:** tomorrow, Friday 30 October 2026, **3:00–5:00 pm (local time)**.
> The v1.1.2 test deck is in its final checks — sneak peeks are below.

**Live test build:** https://krillekz.github.io/pretzels-unblocked-games-return/

A local-first arcade shell: a frame-verified game library, three offline AI personas, a sandboxed
browser and a settings panel — all static files, no accounts, no telemetry, no server.

## Release status

- **Live now:** `v0.1.0-alpha` — the public Test Phase build linked above.
- **Next release:** `v1.1.2-test` — the RETURN deck, in final verification.
- **Release window:** **tomorrow, Friday 30 October 2026, 3:00–5:00 pm (local time).**
- **Where:** this repository and the live build above. The window is a target; a blocker found in the final pass moves it rather than shipping it broken.

## Sneak peeks

A first look at what the v1.1.2 update brings. These are test-deck features, not promises for the finished product.

- **A new command deck** — six primary panels across the top, a persistent filter rail, an editorial library column and an inspector. One click selects a card; the play chip, double-click or `Shift+Enter` launches it.
- **Suggestions, for real** — a public form for ideas, bug reports and game requests, with an optional name and build stamp.
- **An admin inbox** — password-gated, with search, status and category filters, stats, sorting, replies, JSON export and cleanup tools.
- **Admin updates you cannot miss** — when a suggestion is marked Planned, Done or Not planned, or an admin replies, the public card shows the update in oversized type with a random bright accent. Clearing a reply removes the banner again.
- **Settings, rebuilt** — 43 rows across nine tabs, including a new Interface group, so one section opens at a time instead of one long page.
- **Better patch notes** — every release entry separates changes from bug fixes, with the current build tag shown in the status strip.
- **Pins, recents and a command palette** — pinned shelf, Continue shelf, launch counts, `Ctrl/Cmd+K` actions and grid/list views.
- **Any anime character** — the Debate Matrix resolves curated fighters and gives scouted estimates for everyone else, labelled in play.

## What works in the live build today

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

- **v1.1.2 promotion** — the deck is built and in final checks; it moves to this repository and the live site inside the release window. Until then, the live build remains `v0.1.0-alpha`.
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
