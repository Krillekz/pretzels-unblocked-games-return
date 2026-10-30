# Pretzel's Unblocked Games: RETURN

> ## ⚠️ 1.3.1 BETA — TEST PHASE
> **This is an unfinished test build, not a finished product.**
> The catalog, the suggestion inbox, the proxy routing and the desktop packaging are all
> still in progress, so expect rough edges, missing pieces and the odd game that refuses to frame.
> Judge it as a beta and report what breaks instead of scoring it as a release.

**Live build:** https://krillekz.github.io/pretzels-unblocked-games-return/

A local-first arcade shell: a frame-verified game library, three offline AI personas, a sandboxed
browser, a public suggestion box and a password-gated admin inbox — all static files, no accounts,
no telemetry, no server.

## Release status

- **Now live:** `v1.3.1-beta` — **1.3.1 BETA**, "The AI Rehaul", this repository and the Pages build linked above, running build tag **b17** with **56 games** and **five AI engines**.
- **Previous:** `v1.3.0-beta` (`b15`) — 56 games and the paged catalog; `v1.2.0-beta` (`b13`) — the deck layout, suggestions and the admin inbox.
- **Next:** a fix pass on whatever the beta reports. Patch notes inside the app track each build.

### 1.3.1 BETA — The AI Rehaul

- **The Anime Debate Matrix was rebuilt, not retuned** — 19 curated sheets became **66 across 22 series**, and every matchup runs through a **20-rule interaction matrix** instead of comparing flat numbers.
- **Matchups now argue their case** — headline with a difficulty rating, stat-by-stat edge list, named ability interactions, a round-by-round read, win conditions for both sides, and a score line showing the weights used.
- **New commands** — `A vs B vs C` ranks a battle royale, plus `tier list`, `top 10`, `random` and `<series> roster`.
- **Normal** — plain conversation, no persona: questions, real arithmetic, planning help, jokes, and an honest "no knowledge base" answer instead of invented facts.
- **Spicy · 18+** — flirty banter and adult humour behind a one-time confirmation. Suggestive at most, never explicit, and it stops when asked.
- **Roast Pit** and **Conspiracy Corner** — playful roasting with a comeback generator, and confident nonsense with an `is this true` escape hatch.
- **Academic Assistant and Pretzel Chef are retired**, replaced by the four engines above.

### 1.3 BETA — 56 games

- **40 new games** — the catalog goes from 16 titles to 56 across 12 genres. Every URL was checked for HTTP status and for `X-Frame-Options` / CSP `frame-ancestors` before it was added; nothing in the catalog is an unverified guess.
- **A catalog that pages** — cards render 24 at a time with a Show more button and a Showing X of Y line, so a 56-title grid paints quickly and the scroll stays short.
- **Quick genre chips** — a one-tap genre strip above the cards, with counts, kept in sync with the filter rail.
- **A New shelf** — the titles added in this build get their own row plus a New flag on the cover.
- **Per-title cover art** — each cover takes its glow from a hash of the game id, so the tiles read as distinct artwork rather than one repeated placeholder.
- **Time in frame is honest** — the clock pauses while the page is hidden, so a background tab or minimised window stops banking hours nobody played.
- **Suggestion bundles** — the admin inbox imports another device's exported JSON, merges by id and reports what it skipped, so an inbox can finally move between browsers without a server.
- **Palette focus trap** — `Tab` stays inside the command palette instead of walking into the page behind it.
- **Exports carry a format marker** — a file that is not a suggestion bundle is rejected instead of half-imported.
- **Settings imports are validated** — the file is filtered to known keys and coerced to their default types before storage, so a hand-edited file cannot wedge the shell.
- **One-click local gateway** — Settings → Proxy presets the endpoint and health URL to the bundled `tools/proxy-dev.js`, with the `?url=` shape it expects.

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
| Game library | 56 entries across 12 genres, paged 24 at a time, genre chips, genre/platform/proxy filters, search, sorting, shelves, grid/list, keyboard scrolling |
| Game viewport | Sandboxed iframe with refresh, fullscreen, focus mode and close; `needsProxy` routing |
| AI panel | Five deterministic local engines: Anime Debate Matrix (66 sheets, interaction matrix, royales, tiers), Normal, Spicy (18+ gated), Roast Pit, Conspiracy Corner — any unknown fighter name still gets a scouted estimate |
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
- **The 18+ gate is a tone check, not age verification.** It stores one confirmation in this browser and says so in the dialog; Settings → Reset all re-arms it.
- **The AI engines have no knowledge base.** They are local rule-based text generators: the debate matrix uses curated sheets you can read in `js/ai.js`, and the other personas are deterministic templates. Nothing is fetched, nothing is learned, and factual questions get referred to the Browser panel rather than guessed.
- **Suggestions are per-browser.** Different devices see different submissions.
- **Proxy routing is unconfigured by default.** Set `proxy.endpoint` in `data/config.json` (or in
  Settings) after deploying an adapter; until then a `needsProxy` title shows its block card.
- **Both executables are unsigned** — Windows SmartScreen may warn on first launch.
- **Mirror routes only verify.** The manifest compares live hosts with this workspace by SHA-256; it
  does not upload the site to them.
- **Frames are cross-origin**, so the shell cannot read score or pause state.
- **Playtime counts visible time only.** The clock pauses while the page is hidden, but a mirrored or always-on-top window still counts while you look elsewhere.
- **Game framing can change** — hosts may add `X-Frame-Options` at any time. Catalog entries are point-in-time header checks: the host answered `200` and its headers allow framing, which is not the same as the page painting inside a frame forever.
- **Catalog verification is header-level.** Every URL was checked with the project's own `checkFrame`, but a site can still refuse to render through script behaviour or a login wall; the block card and the frame watchdog exist for that case.

## Layout

```
index.html            shell markup (command deck, rail, inspector, player, panels)
css/shell.css         the 1.3 design system and responsive rules
js/app.js             routing, catalog, shelves, player, browser, suggestions, settings, patches
js/ai.js              five local persona engines (debate matrix, normal, spicy, roast, conspiracy)
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
