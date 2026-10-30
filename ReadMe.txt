# README: Pretzel's Unblocked Games: RETURN

This document serves as the master foundation and architectural framework blueprint for building **Pretzel's Unblocked Games: RETURN**. All visual design choices, page layouts, color schemes, component arrangements, and exact technical implementations must be developed entirely through an interactive discovery process, with FreeBuff AI asking the user clarifying questions rather than generating pre-determined templates.

---

### 📂 Workspace & System Configuration
*   **Project Target Directory:** All codebase files must be generated and organized directly inside the local folder: `C:\Users\pknet\Desktop\Unblocked Games`
*   **Documentation Target:** This specification blueprint and all subsequent design notes must be logged in the file located at: `C:\Users\pknet\Desktop\Unblocked Games\ReadMe.txt`
*   **Target Environments:** The application architecture must seamlessly support packaging into a native Windows desktop standalone executable (`.exe`) via Electron, while remaining fully optimized for static web app deployment on GitHub Pages (`username.github.io`).

---

### 🧱 Core Functional Framework Scope
*   **The Games Shell:** A core Game Library layout for unblocked games; FreeBuff AI must ask the user target questions regarding exactly how this database engine, library sorting architecture, and viewport runtime are built.
*   **Multi-Mode AI Panel:** An integrated client-side assistant module built to route user prompts between an Anime Debate Matrix (anime fight arguments and power-scaling statistics), an Academic Assistant (text drafting and objective study help), and a **Casual Pretzel Chef** persona that uses gaming slang, casual conversation, and lighthearted pretzel puns.
*   **Private Sandbox Browser:** A client-side address bar and sandboxed iframe utility designed to isolate and render external web content error-free across both local `file://` protocols and web networks.
*   **System Diagnostics Hub:** A background logging portal that catches application lifecycle triggers, memory consumption inside Electron contexts, and active proxy tunnel availability headers.
*   **Custom Asset Pipeline:** A modular script interface structure designed to load local configurations (`.json`) containing runtime hotkeys, custom extension overrides, and offline asset caching configurations.

---

### 📋 Phase-by-Phase Execution Protocol

> **Phase 1 status: COMPLETE (2026-10-29).** All sixteen design decisions are recorded in the *PHASE 1 DESIGN INTERVIEW — LOCKED DECISIONS* section at the end of this document.
>
> **Phase 2 status: COMPLETE (2026-10-29).** The scaffold is built against those locked parameters — see *PHASE 2 BUILD LOG* below.
>
> **Phase 3 status: COMPLETE (2026-10-29).** Three local persona engines, sixteen frame-verified games and the proxy gateway are all delivered — see *PHASE 3 BUILD LOG*.
>
> **Design refresh (2026-10-29).** Shell layout and crest were rebuilt on the same locked palette — see *DESIGN REFRESH* at the end of this document. Behaviour, data and proxy contract are unchanged.
>
> **Phase 4 status: COMPLETE (2026-10-29).** The main games shell is wrapped in Electron, packaged as `PretzelGames.exe` and verified — see *PHASE 4 + 6 BUILD LOG*.
>
> **Phase 5 status: COMPLETE (2026-10-29).** The standalone Manager dashboard is built, packaged as its own `Manager.exe` and verified — see *PHASE 5 BUILD LOG*.
>
> **Phase 6 status: COMPLETE (2026-10-29).** Offline shell cache, panic cloak with a global hotkey, and mirror-route generation in the Manager are delivered and verified — see *PHASE 4 + 6 BUILD LOG*.

1.  **Phase 1: The Design Interview:** FreeBuff AI must present a structured list of questions to discover the user's explicit design, branding, theme, and layout preferences before any layout structure or style sheets are coded.
2.  **Phase 2: Core Skeleton Scaffold:** Generate the standalone structural framework files matching the explicit parameters chosen during the Phase 1 interview.
3.  **Phase 3: Subsystem Injection:** Code the engine components for the dynamic Game Library array loops, the multi-mode AI text processor, and the sandboxed network frame rules.
4.  **Phase 4: Client Packaging Setup:** Construct the baseline Electron wrapper parameters (`main.js` configuration scripts and resource arrays) required to local-compile the workspace directory structure into an executable program.
5.  **Phase 5: Manual Update / Testing Dashboard:** Architect a completely separate standalone Electron utility panel compiled as its own independent `.exe` file. This application acts as a central management dashboard to manually test local assets, inject new URLs into the database library array, verify network frame compatibility, and manage the deployment files for the entire unblocked games system altogether.
6.  **Phase 6: Extra If Needed:** If FreeBuff AI determines that the platform requires additional technical modules, security layers, routing fallbacks, or feature scopes to function properly, both the AI and the user will stop to brainstorm, refine, and append those new parameters together.

---

### 🌐 GitHub Pages (github.io) Deployment Playbook
1.  **Repository Setup:** Initialize a clean Git repository inside your local workspace folder and link it to a public or private GitHub repository matching your project name.
2.  **Commit Groundwork:** Push the structural files generated by FreeBuff AI into the root directory of your active production branch (e.g., `main`).
3.  **Activate Deployment Pipeline:** 
    *   Navigate to your online repository's **Settings** tab.
    *   Select the **Pages** menu item from the sidebar menu cluster.
    *   Set the deployment pipeline source to **Deploy from a branch**, select your active production branch (`main`), choose the root folder path (`/`), and click save.
    *   GitHub Actions will automatically compile the website onto your custom live link: `https://<username>.github.io/<repository-name>/`.

---

## 🔒 PHASE 1 DESIGN INTERVIEW — LOCKED DECISIONS

**Status:** Phase 1 complete. Interview conducted and answered 2026-10-29.
**Authority:** These decisions supersede any placeholder styling. Phase 2 must match them exactly.

---

### 1. Core Visual Aesthetic & Branding Theme (LOCKED)

*   **Color Profile — Dark neon arcade (high contrast).**
    *   Background base: near-black dark cocoa (not pure black), with layered surface panels one step lighter.
    *   Primary accent: neon amber (glow used sparingly on active state, focus rings, and the logo).
    *   Secondary accent: crimson, reserved for destructive actions (close game, clear history) and error/block states.
    *   Text: warm off-white on dark surfaces, never pure `#fff`; muted cocoa-grey for secondary labels.
    *   Contrast target: WCAG AA minimum (4.5:1) for all body text and interactive labels.
*   **Pretzel Logo Identity — Neon vector gaming crest.**
    *   Glowing outlined pretzel knot with a small controller motif worked into the knot.
    *   Delivered as inline SVG (scales crisply, themable via `currentColor`) plus a raster export for the Electron window icon / `.exe` icon.
    *   Same mark re-used at three sizes: full crest (sidebar header), compact glyph (collapsed rail / favicon), and monochrome (loading and splash states).
*   **Typography — System UI body + one display header face.**
    *   Body/UI: system stack (`-apple-system`, `Segoe UI`, `Roboto`, `sans-serif`).
    *   Headers: a single boxy display face, bundled locally (no CDN fetch) so `file://` and offline Electron rendering is identical.
    *   Font must ship as local asset with a system-stack fallback if the file fails to load.

---

### 2. Layout, Navigation, & UX Architecture (LOCKED)

*   **Navigation — Left vertical command dock.**
    *   Fixed left rail, icon + label per destination: Game Library, AI Panel, Sandbox Browser, Diagnostics.
    *   Active destination indicated by neon amber left-edge bar plus icon glow.
    *   Dock reserves its own column so the game viewport keeps full vertical space.
*   **Transitions — Fluid CSS keyframe transitions.**
    *   Short fade + slight slide with a light blur on panel entry (~150–200ms, ease-out).
    *   Must honor `prefers-reduced-motion: reduce` by falling back to instant switching.
    *   The game iframe must stay mounted across tab changes so a running game is never reloaded by navigation.
*   **Responsive — Toggleable trays.**
    *   Breakpoint: below ~900px wide, the AI panel and Diagnostics become slide-out trays overlaying the main content.
    *   Trays open from the dock; each has an explicit close control and closes on Escape.
    *   Game library grid and viewport reflow to full width when trays are closed.

---

### 3. Game Library & Viewport (LOCKED)

*   **Data model — Genre + platform + proxy flag.**
    *   Each game record carries: `id`, `title`, `genre`, `platform` (Flash / HTML5 / emulator), `url`, `cover` (optional), `needsProxy` (boolean), `tags` (optional extra labels).
    *   Filters are derived from those fields (genre filter, platform filter, proxy-required filter) plus a text search over titles.
    *   The array is stored in a separate `library.json` asset so it can be hot-swapped without touching application code.
*   **Tile style — Glassmorphism cover-art tiles.**
    *   Frosted translucent card over the cocoa background, cover-art slot with `object-fit: cover`, hover lift + amber glow, title and genre/platform metadata beneath.
    *   Fallback when no cover exists: generated letter-glyph tile using the game's initials, so no broken image icons ever appear.
*   **Viewport control bar — three controls confirmed.**
    *   **Refresh frame:** hard-reloads the active iframe via URL reset.
    *   **Native fullscreen toggle:** uses the Fullscreen API on the viewport container (not the iframe element).
    *   **Close game:** tears down the frame, returns to the library grid, restores scroll position.
    *   *Not included:* copy-link and open-in-browser-tab handoff (explicitly declined).

---

### 4. Multi-Mode AI Panel (LOCKED)

*   **Presentation — Standard asymmetric chat bubbles.**
    *   User messages right-aligned, assistant left-aligned, distinct surface treatment per role.
    *   A mode selector strip at the top switches between the three personas; the active mode is visually persistent so the user always knows which persona is answering.
    *   Per-persona accent so mode changes are legible at a glance (debate = crimson, academic = amber, chef = warm cocoa).
*   **Anime Debate Matrix — three metrics confirmed.**
    1.  **Categorical stats** — presented as a stat breakdown (strength, speed, durability, attack potency, hax) rather than pure prose.
    2.  **Conceptual immunities & abilities** — resistance/ability interaction argued narratively.
    3.  **Speed blitz / tier brackets** — speed-tier and blitz-threshold reasoning that can decide a matchup.
    *   *Not included:* canon/source citation tracking (declined) — answers should not promise chapter citations.
*   **Chat history — browser `localStorage`, clearable.**
    *   Persists across launches in both web and Electron builds.
    *   A visible clear-history control wipes all stored conversations; the wipe is immediate and irreversible by design.
    *   Storage must be namespaced per persona so switching modes does not mix threads.

---

### 5. Private Sandbox Browser (LOCKED)

*   **Address bar — smart input with search fallback.**
    *   Detect bare domains and full URLs; prepend `https://` when the scheme is missing.
    *   Anything that does not parse as a URL becomes a search query routed to a configurable search engine.
    *   Invalid or blocked input produces an inline error beneath the bar, never a silent failure.
*   **Frame-block handling — explain and offer escape routes.**
    *   On refusal (`X-Frame-Options` / CSP `frame-ancestors`), show a dedicated block panel: plain-language explanation, the requested host, and two actions — *retry through proxy* (configurable worker gateway) and *open externally* (system browser via Electron shell, new tab on web).
    *   No silent auto-proxying: the user always chooses whether to route through the proxy.
    *   Proxy endpoint lives in the asset config JSON, not hardcoded.

---

### 6. Manager.exe Management Dashboard (LOCKED)

*   **File interfacing — shared `library.json` in the workspace.**
    *   Manager and main app both read/write the same `library.json`; Manager never parses or rewrites application JavaScript.
    *   Writes are validated against the schema in section 3 before saving, with a backup copy kept before each overwrite.
*   **Test tools — three confirmed.**
    1.  **Network dropout simulation** — offline toggle to verify fallback and service-worker behavior.
    2.  **Frame crash / blocked simulation** — force iframe error and X-Frame-Options states to verify the sandbox UI.
    3.  **Layout stress presets** — snap the window to small/large/tiny sizes to verify the ~900px tray breakpoint.
    *   *Not included:* library validation + deploy packaging panel (declined) — library validation still happens as part of save, but no deploy tooling ships in the Manager.

---

### ➡️ Next Action

Phase 1 is closed. Phase 2 (Core Skeleton Scaffold) is authorized to begin and must implement the locked decisions above before any subsystem injection in Phase 3.

---

## 🏗️ PHASE 2 BUILD LOG — SCAFFOLD DELIVERED

**Delivered:** 2026-10-29 · static shell, no build step, no dependencies.

> **Superseded visually:** the layout and crest in this log were refreshed later the same day — see *DESIGN REFRESH*. Behaviour and file responsibilities are unchanged.

### File map

| Path | Role |
| --- | --- |
| `index.html` | Single-page shell: dock, four panels, inline SVG sprite (crest + icons) |
| `css/theme.css` | Design tokens: cocoa/amber/crimson palette, type scale, motion, scrollbars |
| `css/app.css` | Dock, panels, glass tiles, viewport, chat, browser, diagnostics, tray media queries |
| `js/app.js` | Routing, tray logic, library render/filter, viewport controls, chat shell, address parsing, diagnostics log |
| `data/config.json` | Runtime config: search engine, proxy endpoint, hotkeys, frame watchdog |
| `data/library.json` | Game index in the locked schema (six sample entries) |
| `assets/pretzel-crest.svg` | Neon crest source: favicon now, `.exe`/window icon in Phase 4 |
| `assets/fonts/chakra-petch-600.woff2`, `-700.woff2` | Locally bundled display face (no CDN fetch) |

### Implemented against the locked decisions

*   **Theme:** cocoa surfaces (`#0f0c0a` → `#2f2822`), neon amber (`#ffb020`) primary, crimson (`#e83b52`) for hazards, errors and the debate persona; warm off-white ink with AA-level contrast.
*   **Crest:** inline SVG symbol (themable), amber glow filter, crimson controller motif in the knot; standalone copy serves as favicon.
*   **Type:** Chakra Petch 600/700 bundled locally for headers; system stack for all UI copy; local fallback if the font fails.
*   **Dock:** fixed left column, icon + label, amber edge bar on the active destination, build tag and live panel readout at the foot.
*   **Transitions:** 180 ms fade/slide entry keyframes, disabled under `prefers-reduced-motion`; the game iframe stays mounted across tab switches so a running game is never reloaded.
*   **Trays:** below 900 px the AI and Diagnostics panels become right-side overlay trays with a scrim, an explicit close button and Escape-to-close. Layout is reconciled on every resize, so a panel is never left active-but-unreachable when the window crosses the breakpoint.
*   **Library:** genre + platform + proxy filters and title/tag search derived from the array; glassmorphism tiles with cover-art slots and an initials fallback; viewport bar with refresh, fullscreen and close.
*   **AI panel:** three-mode selector with per-persona accents, asymmetric bubbles, per-mode `localStorage` threads seeded with a greeting, clear-all control. Prompts are stored and answered only by the Phase 3 engines.
*   **Browser:** smart address parsing (scheme-less domains get `https://`, non-URLs become searches, non-http schemes rejected), sandboxed frame, block panel with proxy retry / open-external, plus a manual "site won't embed" route.
*   **Diagnostics:** session, breakpoint, game count, proxy node, stored-message count, renderer; capped lifecycle log with severity levels and clear.
*   **Config pipeline:** `data/config.json` drives search engine, proxy endpoint, `Alt+1…4` panel hotkeys and the frame watchdog window.

### Known limits and notes

*   The six catalog entries are samples with third-party URLs; each was not benchmarked for framing support. Real payload injection and URL verification are Phase 3 work — replace them via the Manager (Phase 5) or directly in `library.json`.
*   Cover slots are empty on purpose, so the initials fallback path is exercised.
*   Frame-block detection is heuristic: a watchdog fires when no load event arrives, and the *Site won't embed?* link reports a block by hand. Most `X-Frame-Options` failures still emit a load event, so true detection needs the Phase 3 frame rules.
*   The sandbox frame keeps `allow-scripts` and `allow-same-origin` so game sites can use storage; Chromium logs a warning about that pair. Revisit during Phase 3 hardening.
*   Renderer detection keys off `window.pretzelShell.isDesktop`, which the Phase 4 preload will provide; plain browsers correctly report "Browser".

### Verification performed

Served locally over http and exercised in a browser: all assets return 200, no uncaught JS errors, grid renders 6/6 with working filters, game open/refresh/fullscreen/close paths wire up, address parsing covers search, domain and rejected schemes, AI threads persist per mode, and the tray promotion / Escape / breakpoint reconciliation behaves at 760 px and 1280 px.

### Not yet built (by phase)

Phase 4: Electron `main.js`, preload and packaging for the games shell. Phase 6: offline fallback, stealth hotkeys, mirror generation. (Phase 3 — engines, catalog payload and proxy tunnel — and Phase 5 — standalone Manager dashboard — are delivered.)

---

## 🧠 PHASE 3 BUILD LOG — ENGINES & CATALOG

**Delivered:** 2026-10-29 · `js/ai.js` added, `data/library.json` replaced with real entries.

### AI engines (`js/ai.js`)

All three personas are deterministic local engines: no network calls, no API keys, no server. They work on `file://`, GitHub Pages and inside the Electron wrapper, which keeps the platform free and decentralized as specified. `window.PretzelAI.respond(mode, text)` returns plain text; `js/app.js` renders it as an assistant bubble and persists it per mode.

**Anime Debate Matrix**
* 19-fighter roster with per-fighter tier, speed tier, stat sheet, ability tags and a read line. Series covered: Dragon Ball, One Piece, Naruto, Bleach, JJK, JoJo, Overlord, Hellsing, Seven Deadly Sins, Mob Psycho, Hunter x Hunter, Fist of the North Star and Tensura.
* Matchup parsing accepts `A vs B`, `versus`, `v`, `or` and `against`, with question prefixes tolerated (`who wins, goku vs naruto`).
* Every name works: anything outside the 19 curated sheets gets a deterministic scout estimate derived from the name itself, clearly labelled as estimated in the card and in matchup headers.
* Weighted resolution: stats 42%, hax 30%, speed 28%, with speed tiers ranked S (FTL+) down to D (supersonic) and a two-tier gap flagged as a blitz window.
* Ability interactions adjust the hax score: time stop vs foresight, durability negation vs regeneration, reality warping vs nullification, domain vs domain, mind control vs precognition, immortality, adaptation and blunt resistance.
* Output: stat-by-stat edges, up to three decisive exchanges, a verdict band (clear / solid / edges / too close), and a route to victory for the loser.
* A single name returns the fighter card — curated when on file, a **SCOUT CARD** estimate when not.

**Academic Assistant**
* Four deterministic modes: essay outline, five-session study plan, note pass (key terms + retrieval questions + summary template), and a comparison framework.
* It builds structure from the user's material and explicitly refuses to invent facts or citations — the note pass requires 30+ words of pasted text and states that the writer must fill the claims.

**Pretzel Chef**
* Snack builds with real steps (60-second pretzel bites, gamer trail mix, loaded pretzel plate), a tilt-reset routine after losses, greeting/thanks handling, and a pun library. All local, all offline.

### Game catalog (`data/library.json`)

Sixteen entries replace the Phase 2 samples. Each candidate was verified on 2026-10-29 by inspecting response headers for `X-Frame-Options` and CSP `frame-ancestors`; only hosts with no blocking header shipped.

| Game | Genre | Platform | Host |
| --- | --- | --- | --- |
| 2048 | Puzzle | HTML5 | gabrielecirulli.github.io |
| React Tetris | Puzzle | HTML5 | chvin.github.io |
| Astray | Puzzle | WebGL | wwwtyro.github.io |
| Tower of Hanoi | Puzzle | HTML5 | mathsisfun.com |
| Minesweeper | Puzzle | HTML5 | mathsisfun.com |
| Untrusted | Puzzle | HTML5 | untrustedgame.com |
| Pac-Man | Arcade | HTML5 | pacman.platzh1rsch.ch |
| Clumsy Bird | Arcade | HTML5 | ellisonleao.github.io |
| Floppy Bird | Arcade | HTML5 | nebez.github.io |
| Sinuous | Arcade | HTML5 | hakim.se |
| Snake | Arcade | HTML5 | mathsisfun.com |
| ZType | Typing | HTML5 | zty.pe |
| Chess | Strategy | HTML5 | mathsisfun.com |
| Pokemon Showdown | Strategy | HTML5 | play.pokemonshowdown.com |
| HexGL | Racing | WebGL | hexgl.bkcore.com |
| BananaBread | Shooter | WebGL | kripken.github.io |

Rejected during verification because they refuse framing: `play2048.co` (CSP `frame-ancestors 'self'`), `play.js13kgames.com` (CSP allows only js13kgames.com), `cardgames.io` and `patorjk.com` (`SAMEORIGIN`), `jakesgordon.com` (`DENY`), `tic80.com` (`SAMEORIGIN`), `geoguessr.com` (CSP). `hextris.io` was unreachable from this network and was dropped rather than shipped unverified.

### Proxy gateway (`proxy/`, `tools/proxy-dev.js`)

A static app cannot bypass a framing header on its own, so the gateway is a small edge function the user deploys once and points the app at. The client stays provider-agnostic: it only needs a URL template.

**Contract**
* `GET /` → `{ ok: true, service: "pretzel-proxy", version: 1 }` (health)
* `GET /?url=<encoded target>` → the proxied document
* Deletes `X-Frame-Options`, `Content-Security-Policy`, `Content-Security-Policy-Report-Only`, `Set-Cookie`, `Content-Encoding`, `Content-Length`
* Adds `Access-Control-Allow-Origin: *`, `x-pretzel-proxy: 1`, and injects `<base href="<target>">` plus a `no-referrer` meta tag into HTML
* Refuses non-http(s) schemes, loopback and private-range hosts; optional `ALLOWED_HOSTS` allowlist and `PROXY_TOKEN` shared token

**Adapters shipped**
* `proxy/vercel/api/proxy.js` + `vercel.json` — Vercel Edge Function, free Hobby plan, no card, `npx vercel deploy --prod`.
* `proxy/cloudflare/worker.js` — single-file Cloudflare Worker, `npx wrangler deploy`.
* `tools/proxy-dev.js` — local Node gateway on `127.0.0.1:8788` mirroring the contract for testing without deploying.
* `proxy/README.md` — deploy steps, config wiring, troubleshooting and honest limitations.

**Client behaviour**
* `data/config.json` gains `proxy.endpoint` (supports a `{url}` placeholder or plain prefix append), `proxy.health`, `proxy.token` and `proxy.label`.
* Diagnostics gains a **Test proxy** button and a Proxy node card that reports Unconfigured / Checking… / Reachable / Unreachable; the health endpoint is probed once at boot and on demand.
* Any game flagged `needsProxy` opens through the gateway with a **Proxied** badge in the viewport bar and keeps showing the real target URL; if no gateway is configured, a notice appears with a **Load direct anyway** escape hatch instead of a silent blank frame.
* The browser panel keeps the locked rule that proxying is a user choice: the block panel offers **Retry through proxy**, and repeating it on an already-proxied URL is refused rather than double-wrapping.
* Block messages show the real host with a `(via proxy)` marker instead of the gateway address.

### Verification performed

* Node harness (`window` shim) exercised every engine path: matchup, reversed argument order, question-prefixed input, single-name card, unknown name, mirror match, outline, study plan, comparison, note pass, chef greetings, snacks, tilt and puns.
* Browser pass: catalog renders 16/16 with the new genre and platform filters; all three modes answered inside the panel and persisted per mode; clear-history reset the threads to greetings; 2048 opened from the grid with a live cross-origin document in the viewport and closed cleanly; no uncaught JS errors.
* Proxy pass against the local gateway: health JSON returned `ok`, a page that refuses framing (`play2048.co`) came back 200 with both framing headers stripped and a `<base>` tag, the SSRF guard refused `127.0.0.1`, retry produced a single proxy hop, a second retry was refused, `needsProxy` routing showed the badge and proxied src, the unconfigured path showed the notice and the direct override worked.

### Known limits

* Fighter stats are subjective ratings, stated in every verdict — the engine is a debate scaffold, not canon.
* The engines are rule-driven, not generative: they will not answer arbitrary free-form questions or write original prose. Academic output is structure, never facts.*   Scout estimates for unranked names are name-derived heuristics, not character knowledge — the card says so. Curated accuracy still only covers the 19 `FIGHTERS` entries in `js/ai.js`.
* Hosts can change framing headers at any time; re-verify after catalog edits.
* The proxy only rewrites the top-level document. Sites whose scripts call their own API with absolute origins, require login cookies (stripped), or detect proxy hosts will still break — that is inherent to document proxying, not a bug. See `proxy/README.md` for the full list.*   An unauthenticated public gateway can be abused; `ALLOWED_HOSTS` (and optionally `PROXY_TOKEN`) exist for that reason.

---

## 🎨 DESIGN REFRESH — SHELL & CREST

**Delivered:** 2026-10-29 · visual and layout work only. No behaviour, data, proxy contract or locked palette decision changed.

### Crest

The mark keeps the original idea — neon pretzel knot with a controller worked into it — but is redrawn as one continuous path: two upper loops, a centre fold, a closed base and two twisted ends. It carries a vertical amber gradient (`#ffd88a` → `#ffb020` → `#c47c0d`), a soft outer glow and a crimson controller medallion seated in the knot with a faint d-pad line. The drawing is optically centred in its 64-unit box rather than geometrically centred, and the inline sprite and `assets/pretzel-crest.svg` are kept identical so the favicon and the future `.exe` icon match the in-app mark.

### Shell

*   **Stage chrome:** a 54px bar above the panels with a workspace breadcrumb (`WORKSPACE / AI PANEL`) and three status LEDs — engines, proxy state, catalog count — driven by live app state rather than static text.
*   **Dock:** 236px, with a Workspace group label, 42px targets, a crest that tilts and brightens on hover, and an amber edge notch on the active destination.
*   **Library:** panel subtitle for context, filters consolidated into one toolbar, 198px minimum tile width, and a **Play** pill that appears on tile hover over the cover gradient.
*   **Viewport:** compact 32px control buttons, real URL kept visible beneath the title, proxy badge alongside the title.
*   **AI panel:** modes presented as a segmented control on a recessed track, circular icon send button, tighter transcript rhythm, per-persona accent retained.
*   **Browser:** globe glyph in the address bar and a low-opacity crest watermark behind the empty state.
*   **Diagnostics:** cards on the new surface scale and log rows with bordered level chips instead of coloured words.
*   **Type & ink:** the scale steps are now `#f6ede2` / `#d8c8b8` / `#ab9a8c` / `#8d7c6d`; measured contrast is 6.9–7.3:1 for body copy and 4.67:1 for the smallest labels, so nothing relies on sub-AA grey.
*   **Breakpoints:** 1180px (narrower dock and gutters), 900px (trays, hidden LEDs, hidden subtitles), 680px (142px dock, icon-only viewport controls, stacked diagnostics log).

### Bug found by the refresh

The Phase 2 tiles had been collapsing: a `<button>` flex column does not stretch its children by default, so the cover shrank to glyph size, and `overflow: hidden` on the tile zeroed its min-content contribution so grid rows compressed to the viewport. Fixed with explicit `align-items: stretch`, `width: 100%` on cover and body, and `grid-auto-rows: max-content`. Verified tile geometry is now 231×217 with a 143px cover.

### Verification performed

*   Geometry measured at 1280px, 760px and 640px: no horizontal overflow, dock/breadcrumb/LED state correct, tiles 231×217 at desktop and 221×211 at 640px, grid scrolls internally instead of the page.
*   Crest inspected in the DOM: path bounding box inside the viewBox, gradient and glow references resolved, sprite and asset in sync.
*   Contrast measured from computed colours against both the page and card surfaces.
*   Behaviour re-checked after the rewrite: panel switching, AI reply, library filters, browser empty state, diagnostics log, compact trays with Escape, and a clean console apart from the known sandbox-attribute warning.

---

## 🎛️ CUSTOMIZATION PASS — SETTINGS, SCROLL & OPEN ROSTER

**Delivered:** 2026-10-29 · settings subsystem, library scrolling fixes and universal fighter support.

### Settings (`js/settings.js`, dock → Settings)

A real settings store, not decoration: defaults live in `js/settings.js`, values persist in `localStorage` under `pretzel.settings.v1`, and every change applies live and re-renders the affected panel. The panel is generated from a schema (`SECTIONS`), so adding a control is a data edit plus, where needed, one CSS modifier class.

| Section | Controls |
| --- | --- |
| Appearance | accent preset (5), density (compact / comfortable / roomy), tile size 160–280px, neon glow (full / soft / off), animations, stage bar, status LEDs, dock labels |
| Library | sort order, reverse order, tile tags, reopen last game, default genre, default platform, proxy-only by default |
| AI Panel | default persona, three debate weights (stats / abilities / speed), answer depth, remember chats, auto-scroll, clear all history |
| Browser | search engine (5 + custom endpoint), custom search URL, home destination, block watchdog 3–20s |
| Proxy gateway | endpoint, health URL, token — override `data/config.json` without editing files, with a **Test proxy** button |
| Diagnostics | log level filter, timestamps, log size 50–500 rows |

Header actions: **Export** writes the whole settings object to `pretzel-settings.json`, **Import** loads one back, **Reset all** restores defaults. Proxy credentials can therefore be moved between machines without touching the repo.

### Library scrolling

Two real faults were fixed:

*   `scroll-behavior: smooth` on the grid meant a programmatic or wheel scroll could stall whenever animation frames were throttled (hidden tab, some Electron windows). The grid now scrolls instantly, and an explicit wheel handler scrolls it directly so a parent can never swallow the input.
*   The grid now takes keyboard scrolling (`Tab` to focus, then `↑ ↓ PageUp PageDown Space Home End`), and a masked fade on whichever edge still has tiles marks it as scrollable at a glance.

The game viewport also gained `min-height: 320px` with a scrollable player column, so short windows scroll to the frame instead of clipping it to a strip.

### Build tag

The stage bar carries a small build badge (`v0.1.0-alpha · b4`). It is not a hand-written string: `js/app.js` reads the `?v=` cache key off its own `<script>` tag at boot, so the badge always reports which copy of the script is actually executing. If the badge is older than the files on disk, the page is stale and needs a hard refresh (`Ctrl+F5`). The same value is written to the boot log line and to the Settings → About row, and the asset links in `index.html` are bumped together (`?v=4`) whenever the scripts change.

### Universal fighter support (`js/ai.js`)

Any character name now works. `findFighter` resolves curated sheets first (exact name, alias, substring), then falls back to `estimateFighter`, which derives a stable stat sheet, tier, speed tier and ability tags from the name's hash. Estimates are labelled **SCOUT CARD** / "Scout estimate in play" so they can never be mistaken for canon. Parsing also accepts `or` and `against` as separators, strips leading "who wins," / "who would win," phrasing, and only refuses fragments under two characters.

### Verification performed

*   Node harness: `Baki vs Ohma`, `Some Random Guy vs Gojo`, `Naruto or Sasuke`, `Gojo against Makima`, `Levi Ackerman vs Eren Yeager`, `who wins, Guts vs Griffith`, `L vs Light Yagami` all produced matchups; `x vs y` produced the too-short message; a lone name produced a SCOUT CARD.
*   Browser: the grid scrolled by wheel (300px), `End`/`Home` jumped to the ends, and the fade attribute tracked `below` → `both`; the settings panel rendered 36 rows in 7 groups; accent, density, glow, dock labels, tile size and reverse sort all applied and persisted; the tags toggle hid the chips; "reopen last game" restored the last played title after reload; console clean apart from the known sandbox warning.

---

## 🖥️ PHASE 4 + 6 BUILD LOG — DESKTOP SHELL, OFFLINE CACHE, CLOAK & MIRRORS

**Delivered:** 2026-10-29 · `PretzelGames.exe` for the shell; three runtime modules behind it.

### File map

| Path | Role |
| --- | --- |
| `package.json` | Root Electron manifest: `start`, `check`, `smoke`, `package:win` |
| `electron/main.js` | Window lifecycle, secondary-display placement, global stealth hotkey, IPC, smoke harness |
| `electron/preload.js` | `window.pretzelShell` bridge — desktop flag, version info, external open, hotkey rebind |
| `electron/server.js` | Loopback static server so `data/*.json` loads over HTTP, not `file://` |
| `sw.js` | Offline shell cache, network-first, shell files only |
| `tools/package-electron.js` | Stages runtime files and builds `release/Pretzel Games-win32-x64/` |
| `data/mirrors.json` | Route manifest written by the Manager (primary, active, fallbacks, fingerprints) |
| `manager/lib/mirrors.js` | Manifest validation, SHA-256 fingerprinting, per-origin checks, auto-route |

### Scope delivered

*   **Phase 4 wrapper:** the shell opens as a native window through a loopback-only static server. Context isolation is on, `nodeIntegration` is off, popups and off-origin navigation are denied (http links open in the system browser), and permissions are refused by default.
*   **Portable build:** `npm run package:win` copies only runtime files into a staged folder, writes a minimal manifest, then packages an asar and a `PretzelGames.exe`. `release/`, `.stage/` and `.smoke/` are excluded from git.
*   **Offline fallback:** `sw.js` caches `index.html`, CSS, scripts, fonts, `data/config.json`, `data/library.json` and the crest. Reads are network-first with a cache fallback; third-party and frame requests are ignored. Settings exposes an offline-cache toggle and Diagnostics reports registration, scope and cache keys.
*   **Panic cloak:** `Ctrl/Cmd+Shift+H` (configurable in Settings) toggles a blank overlay and a neutral window title, then restores both. It is registered as a global shortcut and mirrored by an in-page keydown handler, so it still works when another app owns the accelerator.
*   **Mirror routes:** the Manager's Mirrors page validates origins (plain http(s), no credentials/query/hash, no duplicates, max twelve), saves `data/mirrors.json` behind a timestamped backup, and compares each host's live `index.html` and `library.json` against the workspace with SHA-256. **Auto-route** promotes the first host that matches both files.
*   **Secondary-display placement:** the shell, Manager, app test window and frame harness all prefer the widest non-primary display.

### Verification performed

*   `npm run check` passes for all seven shell JavaScript files.
*   `npm run smoke` exits 0 from the Electron shell: desktop bridge detected, 16 tiles, renderer reports **Electron shell**, service worker registered and active with the `pretzel-shell-v1` cache, cloak shows/hides and restores the title, the global hotkey is registered, and the window opens on the secondary display (`onSecondary: true`).
*   `manager` smoke exits 0 with six routes, a mirror-manifest save/backup/auto-route roundtrip and a rendered Mirrors page; screenshots in `manager/.smoke/`.
*   Packaged executables were launched with `--smoke` and passed the same suites from inside their asar bundles.

### Known limits

*   Neither executable is code-signed; Windows may warn on first launch.
*   The offline cache covers the shell only. A game frame needs the network, by design.
*   Mirror checks are read-only: they verify and record a route, they do not upload the site to any host.

---

## 🎛️ PHASE 5 BUILD LOG — MANAGER DASHBOARD

**Delivered:** 2026-10-29 · standalone Electron utility, packaged as `Manager.exe`.

### File map

| Path | Role |
| --- | --- |
| `manager/package.json` | Electron app manifest, `start`, `check`, `smoke`, `package:win` scripts |
| `manager/main.js` | Window lifecycle, IPC handlers, workspace writes, test window, frame window, static server, smoke harness |
| `manager/preload.js` | Minimal context-isolated bridge; no Node access in the renderer |
| `manager/lib/catalog.js` | Schema v1 validation and catalog summary |
| `manager/lib/workspace.js` | Workspace discovery, settings, backup stack, atomic library writes |
| `manager/lib/assets.js` | Delivery inventory and local-reference resolution |
| `manager/lib/frame-check.js` | HTTP fetch and XFO / CSP `frame-ancestors` verdicts |
| `manager/lib/server.js` | Loopback static server for the app test window |
| `manager/renderer/` | Six-page control deck, CSS and the copied crest/display fonts |
| `manager/lab/frame.html` | Normal / blocked / crash frame harness |
| `manager/dist/Pretzel Manager-win32-x64/` | Portable packaged build; `Manager.exe` is the entry point |

### Scope delivered against the locked Phase 5 decision

*   **Shared catalog file:** the Manager reads and writes `data/library.json`; it never parses or rewrites application JavaScript. The editor covers every schema field, with id/title/genre/platform/URL/cover/tags/`needsProxy`, search and platform filtering.
*   **Validated saves with backups:** the entire array is validated against schema v1 before disk access. The previous file is copied to `.manager/backups/library-<timestamp>.json`, then the new file is written to a temp file and renamed into place. Invalid saves are rejected before the backup and before the write. Retention is capped at 40 copies.
*   **Local asset testing:** required shell/engine/data/asset files are checked for presence, size, JSON parseability and local references from `index.html` and `v1.1/index.html`; optional proxy/docs files are reported separately.
*   **Frame compatibility:** the check follows redirects, reports HTTP status and reads `X-Frame-Options` and CSP `frame-ancestors`. The visual harness opens the same URL in a real iframe and can switch to simulated blocked or crash states.
*   **Three locked test tools:** external-network dropout for the test session only (local files keep loading), forced frame failure states, and 1440 / 860 / 390 layout presets applied to a live app test window.
*   **Deployment file management:** the Files page inventories the static payload and reveals the workspace, data, backup and Manager folders. Deploy packaging is deliberately excluded.
*   **Portable workspace discovery:** the app checks the saved path, current directory, executable directory and parents, and offers a folder picker in the top bar. The choice is stored in the Electron user-data folder, not in the repo.
*   **Secondary-display placement:** when a non-primary display is connected, the dashboard, app test window and frame harness open on the widest secondary display. The primary display is left untouched; single-display machines fall back to it.

### Verification performed

*   `npm run check` passes for all eight Manager JavaScript files.
*   `npm run smoke` and the packaged `Manager.exe --smoke` both exit 0. The suite covers the preload bridge, five routes, 16 rendered entries, a deliberately broken catalog (duplicate id and invalid URL both caught), the asset scan, a save → backup → invalid-reject roundtrip in a temporary workspace, a catalog draft that increments the list and discards back, a live frame check of `https://example.com/`, the blocked-frame harness, the app test window loading 16 tiles from the loopback server, 860 px and 390 px resizes, and an external fetch that fails while dropout is on and recovers when it is off.
*   Screenshots from the real Electron renderer are written to `manager/.smoke/` for visual review at 1460 px and 1040 px.
*   The smoke report records both displays and confirms the dashboard, harness and app test window are on the secondary display (`onSecondary: true`).
*   Packaging produced `manager/dist/Pretzel Manager-win32-x64/Manager.exe` on Electron 45.1.0. The asar app boots and passes the same smoke suite.

### Known limits

*   Header checks are advisory. Script-level refusals, authentication walls and unusual header shapes can still fail in the visual harness.
*   The app test window runs on an ephemeral loopback port; it is local to the machine and closes with the window.
*   The Manager is unsigned, local-only and carries its own Electron runtime (the portable folder is large). It is not an installer and not part of the static site.
*   There is no deploy packaging panel, by the locked decision. Publishing the site remains a separate manual step.
*   Phase 4 and Phase 6 are delivered in their own build log above; the Phase 5 executable only runs the dashboard.

---

## 🚀 1.2 BETA RELEASE — DECK PROMOTED (2026-10-30)

The v1.1 deck is no longer a local preview. It was promoted to the project root and published as
**1.2 BETA** (`v1.2.0-beta`, build `b13`).

### What moved

*   `v1.1/index.html` → `index.html`, `v1.1/css/shell.css` → `css/shell.css`, `v1.1/js/app.js` →
    `js/app.js`, `v1.1/js/settings.js` → `js/settings.js`. `js/ai.js` was already identical in both
    shells, so it stayed put.
*   Asset and data paths were rewritten from `../assets` / `../data` to `assets` / `data`, and the
    `?v=` cache key moved from `t12` to `b13` on the stylesheet and both scripts.
*   `css/theme.css` and `css/app.css` are retired; the deck's single `css/shell.css` carries the
    tokens, layout and responsive rules.
*   The `v1.1/` staging folder and its `.gitignore` entry were removed. The original files remain in
    the git history.

### Features now shipping

*   Command deck, filter rail, editorial library column, inspector and status strip.
*   Inspector workflow with play chip / double-click / `Shift+Enter`, focus mode and hash routing.
*   Pins, Continue shelf, launch counts, grid/list views and the `Ctrl/Cmd+K` palette.
*   Public Suggestions panel and the password-gated admin inbox with replies, stats, filters, export
    and the oversized color-coded public update.
*   Tabbed settings (43 rows, nine tabs) and in-app patch notes split into changes and bug fixes.

### Repairs made during the promotion

*   `@font-face` URLs pointed two levels up from the sub-folder; they now resolve from `css/`.
*   `sw.js` precached the retired stylesheets, so an offline load would have been unstyled. Its shell
    list matches the 1.2 files and the cache name is now `pretzel-shell-v2`.
*   Diagnostics regained the renderer and offline-cache rows lost in the swap.
*   The panic cloak and its `Ctrl/Cmd+Shift+H` handler were restored inside the new markup.
*   The desktop smoke now counts `.card` instead of `.tile`, reads `#build-chip`, and polls for the
    service worker rather than sampling once.
*   The Manager's required-asset list, app window selector and the redundant "Open v1.1 deck" route
    were updated for the single shell.

### Verification performed

*   `npm run check` passes for the shell, settings, engine, service worker and Electron files.
*   Electron smoke from source and from the packaged `PretzelGames.exe`: title reads 1.2 BETA,
    16 cards, renderer "Electron shell", cache `pretzel-shell-v2` active, cloak show/hide/title
    restore, global hotkey registered, window on the secondary display. Both exit 0.
*   Manager `npm run smoke` exits 0: asset scan 17/17 with no broken references, app window shows the
    1.2 BETA title with 16 cards, 860/390 presets, dropout blocking and recovery.

### Known limits

*   The admin password is a client-side test gate and suggestions are per-browser. A real inbox needs
    a server endpoint and authenticated reads.
*   The shortcuts are unsigned; SmartScreen may warn on first launch.
*   Proxy routing stays unconfigured until an adapter is deployed and its endpoint is set.
