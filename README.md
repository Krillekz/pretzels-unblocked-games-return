# Pretzel's Unblocked Games: RETURN

> ## ⚠️ TEST PHASE
> **This is an unfinished, early preview build — not a finished product.**
> Games, proxy routing, the AI personas and the desktop packaging are all still in progress,
> so expect rough edges, missing pieces and the odd broken frame. Nothing here is final.
> Judge it as a test build, and report what breaks instead of scoring it as a release.
>
> **Next release update:** today, Friday 30 October 2026, **3:00–5:00 pm (local time)**.
> The v1.1.2 test deck is in its final checks — sneak peeks are below.

**Live test build:** https://krillekz.github.io/pretzels-unblocked-games-return/

A local-first arcade shell: a frame-verified game library, three offline AI personas, a sandboxed
browser and a settings panel — all static files, no accounts, no telemetry, no server.

## Release status

- **Live now:** `v0.1.0-alpha` — the public Test Phase build linked above, running build tag **b5**.
- **Newest in this repository:** `v0.1.0-alpha` + the desktop shell, the Manager dashboard and the offline/cloak/mirror work (Phases 4–6). Code is ahead of the hosted build.
- **Next release:** `v1.1.2-test` — the RETURN deck, in final verification.
- **Release window:** **today, Friday 30 October 2026, 3:00–5:00 pm (local time).**
- **Where:** this repository and the live build above. The window is a target; a blocker found in the final pass moves it rather than shipping it broken.

### What landed in the latest push

- **Desktop shell** — the full games UI as a native window (`PretzelGames.exe`), local-only, context-isolated, with off-origin navigation refused.
- **Manager dashboard** — a separate Electron utility (`Manager.exe`) for the catalog, frame checks, the test lab, delivery files and mirror routes.
- **Offline shell cache** — a service worker that keeps the shell usable with no connection and never touches game frames.
- **Panic cloak** — `Ctrl/Cmd+Shift+H` blanks the window and swaps the title; press again to restore.
- **Mirror routes** — a route manifest with SHA-256 comparison against this workspace and one-click auto-routing.

Full notes, including the bug fixes in this pass, are in [`Changelog.txt`](Changelog.txt).

## Sneak peeks

A first look at what the v1.1.2 update brings. These are test-deck features, not promises for the finished product.

- **A new command deck** — six primary panels across the top, a persistent filter rail, an editorial library column and an inspector. One click selects a card; the play chip, double-click or `Shift+Enter` launches it.
- **Suggestions, for real** — a public form for ideas, bug reports and game requests, with an optional name and build stamp.
- **An admin inbox** — password-gated, with search, status and category filters, stats, sorting, replies, JSON export and cleanup tools.
- **Admin updates you cannot miss** — when a suggestion is marked Planned, Done or Not planned, or an admin replies, the public card shows the update in oversized type with a random bright accent. Clearing a reply removes the reply banner; a status change keeps its own.
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
| Desktop shell | Electron wrapper (`PretzelGames.exe`) with a secure preload bridge, offline shell cache and panic cloak |
| Mirror routes | `data/mirrors.json` primary + fallback origins, checked against the workspace by SHA-256 in the Manager |

## Desktop shell (Phase 4)

The full games shell runs as a native window, not just in a browser.

```sh
npm install
npm start              # source run
npm run package:win    # portable release/Pretzel Games-win32-x64/PretzelGames.exe
npm run smoke          # Electron smoke suite
```

The packaged app carries its own Electron runtime, loads the shell through a loopback-only static server and keeps context isolation on. External links open in the system browser; off-origin navigation is refused. With a second monitor connected, the window opens on the secondary display.

## Offline, cloak and mirror routes (Phase 6)

- **Offline shell cache** — `sw.js` caches the shell, fonts, catalog and config network-first. Game frames and third-party requests are never intercepted. Toggle it in Settings; Diagnostics shows the live cache state.
- **Panic cloak** — `Ctrl/Cmd+Shift+H` covers the window with a blank document and swaps the title; the same shortcut restores it. It works from the global shortcut or the in-page handler, and the panic button sits in the stage bar.
- **Mirror routes** — `data/mirrors.json` records a primary origin and up to twelve fallbacks plus the active route. The Manager's **Mirrors** page compares each host's live `index.html` and `library.json` with this workspace by SHA-256, then **Auto-route** promotes the first match.

## Desktop manager (Phase 5)

The separate management dashboard is built in [`manager/`](manager/README.md). It is not served by GitHub Pages and does not run inside the games shell.

```sh
cd manager
npm install
npm start              # source run
npm run package:win    # portable Manager.exe
```

The packaged app is at `manager/dist/Pretzel Manager-win32-x64/Manager.exe`. The whole folder is the portable distribution; it is unsigned and carries its own Electron runtime. Build output (`release/`, `manager/dist/`, `node_modules/`) is git-ignored, so the executables are built locally rather than stored in this repository. It finds the workspace automatically or through the top-bar folder picker. With a second monitor connected, the dashboard, app test window and frame harness open on the secondary display, leaving the primary clear.

| Manager page | What it does |
| --- | --- |
| Overview | Catalog/workspace readiness, backups and quick actions |
| Catalog | Add or edit game URLs, search/filter, validate and save `data/library.json` |
| Frame check | Reads `X-Frame-Options` and CSP `frame-ancestors`, then opens a visual frame harness |
| Test lab | Network-dropout simulation, blocked/crash frame fixtures, 1440/860/390 layout presets |
| Mirrors | Primary + fallback origins, SHA-256 route comparison, auto-route and manifest backups |
| Files | Delivery asset scan, broken-reference check, paths and rollback copies |

Every save is validated against schema v1, backed up to `.manager/backups/` and replaced atomically. The Manager never rewrites application JavaScript. There is no deploy packaging panel, by the locked Phase 5 decision.

## What is still in progress

- **v1.1.2 promotion** — the deck is built and in final checks; it moves to this repository and the live site inside the release window. Until then, the live build remains `v0.1.0-alpha`.
- **Code signing** — both executables are portable and unsigned; Windows SmartScreen may warn on first launch.
- **Proxy deployment** — nothing routes through a proxy until you deploy an adapter and paste its URL into `data/config.json`. Blocked sites simply show the block panel until then.
- **Mirror publishing** — the manifest tracks and validates routes; it does not upload the site to those hosts.
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
sw.js                 offline shell cache (network-first, shell only)
electron/             Phase 4 Electron wrapper + preload bridge + static server
tools/package-electron.js  builds release/Pretzel Games-win32-x64/
proxy/                Vercel and Cloudflare gateway adapters
tools/proxy-dev.js    local gateway for testing
manager/              Phase 5 Electron management dashboard + packaged exe
data/mirrors.json     Phase 6 route manifest (created by the Manager)
ReadMe.txt            full blueprint, locked design decisions and build log
```

## Credits

Pretzel (vision) · Krillekz (systems) · Raevik (workspace and deployment) · LuxLoop (UI and sandboxing) · Kyrtop (diagnostics). See `Credits.txt`.

No accounts, no analytics, no network calls from the engines. Game content belongs to its respective hosts and is embedded, not redistributed.
