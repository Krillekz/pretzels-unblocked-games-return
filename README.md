# Pretzel's Unblocked Games: RETURN

> ## ⚠️ 1.2 BETA — TEST PHASE
> **This is an unfinished test build, not a finished product.**
> The new shell, the suggestion inbox, the proxy routing and the desktop packaging are all
> still in progress, so expect rough edges, missing pieces and the odd broken frame.
> Judge it as a beta and report what breaks instead of scoring it as a release.

**Live build:** https://krillekz.github.io/pretzels-unblocked-games-return/

A local-first arcade shell: a frame-verified game library, three offline AI personas, a sandboxed
browser, a public suggestion box and a password-gated admin inbox — all static files, no accounts,
no telemetry, no server.

## Release status

- **Now live:** `v1.2.0-beta` — **1.2 BETA**, this repository and the Pages build linked above, running build tag **b13**.
- **Previous:** `v0.1.0-alpha` — the first Test Phase shell with the left dock. Replaced in 1.2.
- **Next:** a fix pass on whatever the beta reports. Patch notes inside the app track each build.

## What's new in 1.2 BETA

The deck replaces the old dock layout entirely.

- **A command deck, not a sidebar** — navigation, the palette trigger and status LEDs across the top; a persistent filter rail, a scrolling editorial library column and an inspector below it. The player takes over the library area with its own cinema bar.
- **Inspector workflow** — one click selects a card and fills the inspector; the play chip, a double-click or `Shift+Enter` launches it.
- **Suggestions** — a public form for ideas, bug reports, game requests and other, with an optional name and build stamp. Your own submissions list below it; other people's stay in the admin inbox.
- **Admin inbox** — password-gated, with search, status and category filters, stats, sorting, free-text replies, JSON export and cleanup.
- **Admin updates you cannot miss** — a status change or a reply posts the update on the public card in oversized display type with a random bright accent.
- **Tabbed settings** — 43 rows across nine tabs, one section open at a time, with About and Patch notes as their own tabs.
- **Shelf workflow** — pins (`P`), a Continue shelf, launch counts, grid/list views (`G` / `L`) and a `Ctrl/Cmd+K` command palette.
- **Hash routing and focus mode** — every panel and open game has a URL (`#/library/2048`); `F` collapses the chrome, `Esc` restores it.
- **Build visibility** — the deck chip and the status strip both show `v1.2.0-beta · b13`, and Patch notes separate changes from bug fixes.
- **Any anime character** — the Debate Matrix resolves curated fighters and gives scouted estimates, labelled as such, for everyone else.

## Feature status

| Area | Status |
| --- | --- |
| Game library | 16 entries, genre/platform/proxy filters, search, sorting, shelves, grid/list, keyboard scrolling |
| Game viewport | Sandboxed iframe with refresh, fullscreen, focus mode and close; `needsProxy` routing |
| AI panel | Three deterministic local engines: Anime Debate Matrix (curated roster + scout estimates for any name), Academic Assistant, Pretzel Chef |
| Sandbox browser | Smart address parsing (URL vs search), configurable engine and home page, block dialog with proxy retry, quick links |
| Suggestions | Public form with categories and optional name/build, per-browser storage, oversized color-coded admin updates |
| Admin inbox | Session password gate, four stat cards, search, status/category filters, sorting, replies, copy, export, delete |
| Settings | 43 rows across nine tabs, saved to `localStorage`, with export / import / reset |
| Diagnostics | Session, breakpoint, catalog, proxy, storage, pins, renderer, offline cache and a filterable, copyable lifecycle log |
| Proxy gateway | Deployable adapters in `proxy/` (Vercel + Cloudflare) and a local dev gateway in `tools/proxy-dev.js` |
| Desktop shell | Electron wrapper (`PretzelGames.exe`) with a secure preload bridge, offline cache and panic cloak |
| Manager | Separate Electron dashboard (`Manager.exe`) for the catalog, frame checks, test lab, files and mirror routes |

## Run it locally

The app fetches `data/*.json`, so serve the folder over HTTP rather than opening `file://`:

```bash
python -m http.server 8765
# then open http://127.0.0.1:8765/
```

Optional local proxy gateway for testing blocked sites:

```bash
node tools/proxy-dev.js   # 127.0.0.1:8788
```

## Desktop shell

The app also runs as a native window instead of a browser tab.

```sh
npm install
npm start              # source run
npm run package:win    # portable release/Pretzel Games-win32-x64/PretzelGames.exe
npm run smoke          # Electron smoke suite
```

The packaged app carries its own Electron runtime, loads the shell through a loopback-only static
server, keeps context isolation on, refuses permissions by default and sends off-origin navigation
to the system browser. With a second monitor connected it opens on the secondary display.

- **Offline cache** — `sw.js` keeps the shell, fonts, catalog and config network-first. Game frames
  and third-party requests are never intercepted. Diagnostics shows the live cache state.
- **Panic cloak** — `Ctrl/Cmd+Shift+H` covers the window with a blank document and swaps the title;
  the same shortcut restores both. It works through the global shortcut or the in-page handler.

## Manager dashboard

A separate Electron utility in [`manager/`](manager/README.md). It is not served by Pages and does
not run inside the games shell.

```sh
cd manager
npm install
npm start              # source run
npm run package:win    # portable manager/dist/Pretzel Manager-win32-x64/Manager.exe
```

| Page | What it does |
| --- | --- |
| Overview | Catalog/workspace readiness, backups and quick actions |
| Catalog | Add or edit game URLs, search/filter, validate and save `data/library.json` |
| Frame check | Reads `X-Frame-Options` and CSP `frame-ancestors`, then opens a visual frame harness |
| Test lab | Network-dropout simulation, blocked/crash frame fixtures, 1440/860/390 layout presets |
| Mirrors | Primary + fallback origins, SHA-256 route comparison, auto-route and manifest backups |
| Files | Delivery asset scan, broken-reference check, paths and rollback copies |

Every save is validated against schema v1, backed up to `.manager/backups/` and replaced atomically.
The Manager never rewrites application JavaScript. Build output (`release/`, `manager/dist/`,
`node_modules/`) is git-ignored, so the executables are built locally rather than stored here.

## Suggestions and the admin gate

Open **Suggestions** with `6`. Submissions are stored in this browser under
`pretzel.v11.suggestions`; the public list shows only what this device sent.

The admin side is a second tab behind a password — the test password is **`pretzel-admin`**, visible
in `js/app.js`. It unlocks for the browser session and the Lock button closes it again.

This is deliberately a **local test gate**. A client-side password can be bypassed by anyone with
devtools, and per-browser storage means devices do not share an inbox. A real multi-user version
needs a server endpoint for public submissions plus an authenticated admin read path; the UI is
structured so the storage calls can be replaced without touching the layout.

## Known limits

- **The admin password is a test gate, not authentication.** Do not treat the inbox as private.
- **Suggestions are per-browser.** Different devices see different submissions.
- **Proxy routing is unconfigured by default.** Set `proxy.endpoint` in `data/config.json` (or in
  Settings) after deploying an adapter; until then a `needsProxy` title shows its block card.
- **Both executables are unsigned** — Windows SmartScreen may warn on first launch.
- **Mirror routes only verify.** The manifest compares live hosts with this workspace by SHA-256; it
  does not upload the site to them.
- **Frames are cross-origin**, so the shell cannot read score or pause state.
- **Playtime is wall-clock** while the tab is open; a suspended laptop will over-count.
- **Game framing can change** — hosts may add `X-Frame-Options` at any time; entries are point-in-time checks.

## Layout

```
index.html            shell markup (command deck, rail, inspector, player, panels)
css/shell.css         the 1.2 design system and responsive rules
js/app.js             routing, catalog, shelves, player, browser, suggestions, settings, patches
js/ai.js              three local persona engines
js/settings.js        settings store + schema
data/library.json     game catalog
data/config.json      runtime config (search, proxy, hotkeys, features)
sw.js                 offline shell cache (network-first, shell only)
assets/               crest and display fonts
electron/             desktop wrapper, preload bridge and loopback static server
tools/package-electron.js  builds release/Pretzel Games-win32-x64/
proxy/                Vercel and Cloudflare gateway adapters
tools/proxy-dev.js    local gateway for testing
manager/              Electron management dashboard
data/mirrors.json     route manifest (created by the Manager)
ReadMe.txt            full blueprint, locked design decisions and build log
Changelog.txt          version history with a separate bug-fix list per release
```

## Credits

Pretzel (vision) · Krillekz (systems) · Raevik (workspace and deployment) · LuxLoop (UI and sandboxing) · Kyrtop (diagnostics). See `Credits.txt`.

No accounts, no analytics, no network calls from the engines. Game content belongs to its respective hosts and is embedded, not redistributed.
