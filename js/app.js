/* =====================================================================
   Pretzel's Unblocked Games: RETURN — 1.2 BETA shell
   Scope: command deck navigation, hash routing, shelf/inspector library,
   command palette, pinned + recent tracking, game player, AI transcript,
   sandbox browser, diagnostics and settings rendering.
   The persona engines live in js/ai.js and are shared with v0.1.
   ===================================================================== */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const VERSION = "v1.3.1-beta";
  const BUILD = (() => {
    const tag = document.querySelector('script[src*="js/app.js"]');
    const match = tag && String(tag.getAttribute("src") || "").match(/[?&]v=([A-Za-z0-9._-]+)/);
    return match ? match[1] : "dev";
  })();

  const AI_PREFIX = "pretzel.ai.v11.";
  const PIN_KEY = "pretzel.v11.pins";
  const RECENT_KEY = "pretzel.v11.recents";
  const ROUTE_KEY = "pretzel.v11.lastRoute";
  const SEEN_KEY = "pretzel.v11.seen11";
  const SUGGEST_KEY = "pretzel.v11.suggestions";
  const ADMIN_SESSION_KEY = "pretzel.v11.admin";
  /* The bundled development gateway in tools/proxy-dev.js expects ?url=, not
     a path suffix, so the preset has to carry the placeholder. */
  const LOCAL_GATEWAY = {
    endpoint: "http://127.0.0.1:8788/?url={url}",
    health: "http://127.0.0.1:8788/"
  };
  const SUGGEST_LIMIT = 200;
  const REPLY_LIMIT = 600;
  /* A local gate for the test build. The hash cannot protect a real inbox;
     see the admin panel note and README before publishing this. */
  const ADMIN_PASSWORD = "pretzel-admin";
  const LEVEL_RANK = { info: 1, event: 1, warn: 2, error: 3 };

  const ROUTES = {
    library: "Library",
    ai: "AI Panel",
    browser: "Browser",
    logs: "Diagnostics",
    settings: "Settings",
    suggest: "Suggestions"
  };

  const SUGGEST_CATEGORIES = [
    { id: "idea", label: "Idea" },
    { id: "bug", label: "Bug report" },
    { id: "game", label: "Game request" },
    { id: "other", label: "Other" }
  ];

  const SUGGEST_STATUSES = [
    { id: "new", label: "New", publicLabel: "Received" },
    { id: "planned", label: "Planned", publicLabel: "Planned" },
    { id: "done", label: "Done", publicLabel: "Done" },
    { id: "declined", label: "Not planned", publicLabel: "Not planned" }
  ];

  /* Bright enough to read on the cocoa surface. The admin update picks one
     at random and stores it on the suggestion so the public card is stable. */
  const UPDATE_ACCENTS = [
    "#7ef0c0",
    "#7cc7ff",
    "#c9a7ff",
    "#ff9f7a",
    "#ffd166",
    "#b8f27a",
    "#ff8fb1",
    "#8ce3ff",
    "#ffb3d9",
    "#f6a94a"
  ];

  function isUpdateAccent(value) {
    return typeof value === "string" && UPDATE_ACCENTS.includes(value);
  }

  function randomAccent(previous) {
    const pool = UPDATE_ACCENTS.filter((color) => color !== previous);
    return pool[Math.floor(Math.random() * pool.length)] || UPDATE_ACCENTS[0];
  }

  const PERSONAS = {
    debate: {
      label: "Anime Debate Matrix",
      noteTitle: "Every character works",
      noteCopy: `${window.PretzelAI ? window.PretzelAI.fighterCount : 64} curated sheets, an interaction matrix, round-by-round reads, battle royales and tier lists. Any other name gets a scouted estimate, marked as such.`,
      greeting: `Matrix loaded — ${window.PretzelAI ? window.PretzelAI.fighterCount : 64} curated sheets with a full interaction matrix. “A vs B” gives rounds, win conditions and a score. One name gives the card. “A vs B vs C” ranks the royale. “tier list”, “top 10”, “random”, or “Naruto roster” also work.`,
      placeholder: "Goku vs Saitama"
    },
    normal: {
      label: "Normal",
      noteTitle: "No gimmick",
      noteCopy: "Plain conversation: questions, arithmetic, planning, a joke when you want one. It says so when it does not know something.",
      greeting:
        "Hey. Normal mode — no persona, no bit.\n\nAsk a question, give me maths (“what is 18 * 7 + 4”), think something through out loud, or ask for a joke.",
      placeholder: "What's on your mind?"
    },
    spicy: {
      label: "Spicy · 18+",
      noteTitle: "Adults only",
      noteCopy: "Flirty banter, compliments with teeth and adult humour. Suggestive at most — never explicit — and you can walk out any time.",
      greeting:
        "So you found the door.\n\nFlirty banter, date ideas that end in trouble, and jokes your parents wouldn't approve of. Suggestive at most, never explicit, and the flirting stops the moment you say so.",
      placeholder: "Flirt with me…"
    },
    roast: {
      label: "Roast Pit",
      noteTitle: "Enter at your own risk",
      noteCopy: "Playful roasting, comebacks and backhanded hype. It goes after what you do, never who you are.",
      greeting:
        "The Pit is open.\n\nSay “roast me” if you're brave, “roast my friend Tyler” if you're a coward, or “give me a comeback” if you're losing an argument in real time.",
      placeholder: "roast me"
    },
    conspiracy: {
      label: "Conspiracy Corner",
      noteTitle: "Nothing here is true",
      noteCopy: "Absurd theories with total confidence and zero evidence, on any topic you name. Ask “is this true” and it breaks character.",
      greeting:
        "Welcome to Conspiracy Corner. Nothing here is true — that's the entire bit.\n\nGive me a topic: “the moon”, “why my Wi-Fi drops”, “who moved my keys”. Ask for “more” to escalate.",
      placeholder: "Why does my Wi-Fi drop?"
    }
  };

  const state = {
    config: {
      search: { label: "DuckDuckGo", endpoint: "https://duckduckgo.com/?q=" },
      proxy: { label: "Unconfigured", endpoint: "", health: "", token: "" },
      hotkeys: {},
      features: { frameWatchdogMs: 8000 }
    },
    fileConfig: null,
    proxyState: "off",
    games: [],
    pins: [],
    recents: [],
    filters: { q: "", genre: "all", platform: "all", proxyOnly: false },
    sort: "title",
    reverse: false,
    view: "grid",
    shown: 24,
    catalogSig: "",
    selected: null,
    heroId: null,
    settingsTab: "interface",
    settingsTabs: [],
    route: "library",
    game: null,
    gameProxied: false,
    playStart: 0,
    playTicker: 0,
    playAccum: 0,
    focus: false,
    paletteIndex: 0,
    paletteItems: [],
    paletteReturn: null,
    browserUrl: "",
    blockedUrl: "",
    watchdog: 0,
    mode: "debate",
    suggestions: [],
    suggestCategory: "idea",
    suggestTab: "send",
    adminUnlocked: false,
    adminFilter: "all",
    adminCategory: "all",
    adminSort: "newest",
    adminQuery: "",
    aiKeepHistory: true,
    aiAutoScroll: true,
    syncingHash: null,
    hintTimer: 0,
    cloaked: false,
    savedTitle: "",
    offlineCache: "checking",
    session: Math.random().toString(16).slice(2, 6).toUpperCase()
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const svgIcon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + name);
    svg.append(use);
    return svg;
  };

  const els = {};
  const compact = window.matchMedia("(max-width: 1180px)");
  let maxLogRows = 300;
  let logLevelFilter = "all";

  /* ------------------------------------------------------------------ */
  /* storage + utilities                                                */
  /* ------------------------------------------------------------------ */

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      /* storage unavailable */
      return false;
    }
  }

  const stamp = () =>
    new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  function hostOf(url) {
    try {
      return new URL(url).host;
    } catch {
      return String(url || "");
    }
  }

  function glyphFor(title) {
    const words = String(title || "?").trim().split(/[\s-]+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : String(title || "?").slice(0, 2)).toUpperCase();
  }

  /* Every card used to share one placeholder glow. Hashing the id gives each
     of them a stable hue, so a 56-card catalog reads as distinct tiles. */
  function hueFor(id) {
    const key = String(id || "?");
    let hash = 7;
    for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 100003;
    return hash % 360;
  }

  function isNewGame(game) {
    return (game.tags || []).includes("new");
  }

  const PAGE_SIZE = 24;

  function relativeTime(ts) {
    if (!ts) return "never";
    const diff = Date.now() - Number(ts);
    if (!Number.isFinite(diff)) return "never";
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(Number(ts)).toLocaleDateString();
  }

  function clock(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function copyText(text, message) {
    const done = () => toast(message || "Copied to clipboard");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, message));
      return;
    }
    fallbackCopy(text, message);
  }

  function fallbackCopy(text, message) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    try {
      document.execCommand("copy");
      toast(message || "Copied to clipboard");
    } catch {
      toast("Could not copy — select the text manually", "warn");
    }
    area.remove();
  }

  /* ------------------------------------------------------------------ */
  /* toasts                                                             */
  /* ------------------------------------------------------------------ */

  function toast(message, kind) {
    const settings = PretzelSettings.get();
    if (!settings.toasts) return;
    const node = el("div", "toast", message);
    node.dataset.kind = kind || "info";
    els.toasts.append(node);
    while (els.toasts.children.length > 3) els.toasts.firstElementChild.remove();
    window.setTimeout(() => {
      node.style.opacity = "0";
      node.style.transition = "opacity 160ms ease";
      window.setTimeout(() => node.remove(), 180);
    }, 2400);
  }

  /* ------------------------------------------------------------------ */
  /* diagnostics log                                                    */
  /* ------------------------------------------------------------------ */

  function logVisible(level) {
    if (logLevelFilter === "all") return true;
    const minimum = logLevelFilter === "error" ? 3 : 2;
    return (LEVEL_RANK[level] || 1) >= minimum;
  }

  function applyLogFilter() {
    Array.from(els.log.children).forEach((row) => {
      row.classList.toggle("is-hidden", !logVisible(row.dataset.level));
    });
  }

  function trimLog() {
    while (els.log.children.length > maxLogRows) els.log.firstElementChild.remove();
  }

  function log(level, message) {
    if (!els.log) return;
    if (!logVisible(level)) return;

    const row = el("div", "log-row");
    row.dataset.level = level;
    const time = el("span", "log-time", stamp());
    const tag = el("span", "log-level", level);
    const msg = el("span", "log-msg", message);
    row.append(time, tag, msg);

    const pinned = els.log.scrollTop + els.log.clientHeight >= els.log.scrollHeight - 24;
    els.log.append(row);
    trimLog();
    if (pinned) els.log.scrollTop = els.log.scrollHeight;
  }

  async function loadJSON(path, fallback) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      log("warn", `${path} unavailable (${err.message})`);
      return fallback;
    }
  }

  /* ------------------------------------------------------------------ */
  /* routing                                                            */
  /* ------------------------------------------------------------------ */

  function parseHash() {
    const raw = String(location.hash || "").replace(/^#\/?/, "");
    if (!raw) return { route: null, id: null };
    const parts = raw.split("/");
    const route = ROUTES[parts[0]] ? parts[0] : null;
    const id = parts[1] ? decodeURIComponent(parts[1]) : null;
    return { route, id };
  }

  function startRoute() {
    const settings = PretzelSettings.get();
    if (settings.startRoute === "last") {
      const last = readStore(ROUTE_KEY, "library");
      return ROUTES[last] ? last : "library";
    }
    return ROUTES[settings.startRoute] ? settings.startRoute : "library";
  }

  function setRoute(route, gameId, opts = {}) {
    const hash = `#/${route}${gameId ? "/" + encodeURIComponent(gameId) : ""}`;
    if (location.hash !== hash) {
      state.syncingHash = hash;
      if (opts.replace && location.replace) location.replace(hash);
      else location.hash = hash;
    }
    applyNavigation(route, gameId || null, opts);
  }

  function applyNavigation(route, gameId, opts = {}) {
    const nextRoute = ROUTES[route] ? route : "library";
    state.route = nextRoute;
    writeStore(ROUTE_KEY, nextRoute);
    closeMenu({ silent: true });

    $$(".panel").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === nextRoute));
    document.body.dataset.route = nextRoute;
    $$(".nav-btn").forEach((btn) => {
      const on = btn.dataset.route === nextRoute;
      btn.classList.toggle("is-active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });

    els.crumb.textContent = ROUTES[nextRoute];
    els.sbRoute.textContent = ROUTES[nextRoute].toUpperCase();

    if (nextRoute === "settings" && els.settingsBody.childElementCount === 0) renderSettings();
    if (nextRoute === "ai") {
      scrollChat();
      window.setTimeout(() => els.chatInput.focus({ preventScroll: true }), 30);
    }

    if (nextRoute === "library") {
      if (gameId) {
        const game = state.games.find((entry) => entry.id === gameId);
        if (game) {
          /* The hash is applied after a launch has already opened the frame;
             only adopt state here when the URL is what is driving it. */
          if (!state.game || state.game.id !== game.id) {
            selectGame(game.id, { silent: true, scroll: false });
            openGame(game.id, { fromRoute: true });
          }
        } else if (!opts.silent) {
          toast("That game is not in the catalog", "warn");
        }
      } else if (state.game) {
        closeGame({ fromRoute: true, silent: true });
      }
    } else if (state.game) {
      closeGame({ fromRoute: true, silent: true });
    }

    /* The inspector is a drawer outside the library; never leave it over another panel. */
    if (nextRoute !== "library") closeInspector();
    syncScrim();

    if (!opts.silent) log("event", `Route → ${nextRoute}${gameId ? "/" + gameId : ""}`);
    updateSubbarHint();
  }

  function requestClose() {
    if (!state.game) return;
    if (PretzelSettings.get().confirmExit && !window.confirm(`Close ${state.game.title}?`)) return;
    closeGame();
  }

  function navTo(route, gameId) {
    setRoute(route, gameId || null);
  }

  /* ------------------------------------------------------------------ */
  /* command deck                                                       */
  /* ------------------------------------------------------------------ */

  function syncScrim() {
    const navOpen = $(".deck-nav").classList.contains("is-open");
    const inspectorOverlay = compact.matches && els.inspector.classList.contains("is-open");
    els.scrim.hidden = !(navOpen || inspectorOverlay);
  }

  function toggleMenu() {
    const nav = $(".deck-nav");
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    els.menuOpen.setAttribute("aria-expanded", String(open));
    syncScrim();
    if (open) log("event", "Navigation sheet opened");
  }

  function closeMenu(opts = {}) {
    const nav = $(".deck-nav");
    if (!nav || !nav.classList.contains("is-open")) return;
    nav.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    els.menuOpen.setAttribute("aria-expanded", "false");
    syncScrim();
    if (!opts.silent) log("event", "Navigation sheet closed");
  }

  /* ------------------------------------------------------------------ */
  /* pins, recents and catalog helpers                                  */
  /* ------------------------------------------------------------------ */

  const gameById = (id) => state.games.find((game) => game.id === id) || null;

  function loadCollections() {
    const pins = readStore(PIN_KEY, []);
    state.pins = Array.isArray(pins) ? pins.filter((id) => typeof id === "string") : [];
    const recents = readStore(RECENT_KEY, []);
    state.recents = Array.isArray(recents)
      ? recents.filter((entry) => entry && typeof entry.id === "string" && gameById(entry.id))
      : [];
  }

  const recentFor = (id) => state.recents.find((entry) => entry.id === id) || null;
  const playCount = (id) => {
    const entry = recentFor(id);
    return entry ? Number(entry.plays) || 0 : 0;
  };

  function totalLaunches() {
    return state.recents.reduce((sum, entry) => sum + (Number(entry.plays) || 0), 0);
  }

  function togglePin(id, opts = {}) {
    const game = gameById(id);
    if (!game) return;
    const index = state.pins.indexOf(id);
    if (index >= 0) {
      state.pins.splice(index, 1);
      if (!opts.silent) toast(`Unpinned ${game.title}`);
    } else {
      state.pins.unshift(id);
      if (!opts.silent) toast(`Pinned ${game.title}`);
    }
    writeStore(PIN_KEY, state.pins);
    renderShelves();
    renderCatalog();
    renderInspector();
    renderHero();
    if (state.game && state.game.id === id) renderPlayerSide(state.game);
    updateStats();
    log("event", `${index >= 0 ? "Unpinned" : "Pinned"} ${game.title}`);
  }

  function recordOpen(id) {
    const existing = recentFor(id);
    if (existing) {
      existing.plays = (Number(existing.plays) || 0) + 1;
      existing.at = Date.now();
      state.recents = [existing, ...state.recents.filter((entry) => entry.id !== id)];
    } else {
      state.recents.unshift({ id, plays: 1, at: Date.now(), seconds: 0 });
    }
    state.recents = state.recents.slice(0, 14);
    writeStore(RECENT_KEY, state.recents);
    renderShelves();
    updateStats();
  }

  function recordSessionTime(id, seconds) {
    const entry = recentFor(id);
    if (!entry || !seconds) return;
    entry.seconds = Math.round((Number(entry.seconds) || 0) + seconds);
    entry.at = Date.now();
    writeStore(RECENT_KEY, state.recents);
  }

  function filteredGames() {
    const { q, genre, platform, proxyOnly } = state.filters;
    return state.games.filter((game) => {
      const haystack = [game.title, game.genre, game.platform, ...(game.tags || [])].join(" ").toLowerCase();
      return (
        (!q || haystack.includes(q)) &&
        (genre === "all" || game.genre === genre) &&
        (platform === "all" || game.platform === platform) &&
        (!proxyOnly || game.needsProxy)
      );
    });
  }

  function sortedGames(list) {
    const order = [...list];
    order.sort((a, b) => {
      if (state.sort === "genre") return (a.genre || "").localeCompare(b.genre || "") || a.title.localeCompare(b.title);
      if (state.sort === "platform") return (a.platform || "").localeCompare(b.platform || "") || a.title.localeCompare(b.title);
      if (state.sort === "plays") return playCount(b.id) - playCount(a.id) || a.title.localeCompare(b.title);
      if (state.sort === "recent") {
        const at = (game) => (recentFor(game.id) ? Number(recentFor(game.id).at) || 0 : 0);
        return at(b) - at(a) || a.title.localeCompare(b.title);
      }
      return a.title.localeCompare(b.title);
    });
    if (state.reverse) order.reverse();
    return order;
  }

  /* ------------------------------------------------------------------ */
  /* hero                                                               */
  /* ------------------------------------------------------------------ */

  function dayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  function pickHero(exclude) {
    const pool = state.games.filter((game) => !game.needsProxy && game.id !== exclude);
    if (!pool.length) return state.games[0] || null;
    let seed = 0;
    const key = dayKey() + "|" + (exclude || "");
    for (let i = 0; i < key.length; i += 1) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    return pool[seed % pool.length];
  }

  function heroGame() {
    return gameById(state.heroId) || pickHero(null);
  }

  function renderHero() {
    const game = heroGame();
    if (!game) {
      els.heroTitle.textContent = "No games indexed";
      els.heroSub.textContent = "data/library.json did not load. Serve this folder over http so JSON assets can be fetched.";
      els.heroGlyph.textContent = "??";
      els.heroTags.replaceChildren();
      els.heroPlay.disabled = true;
      els.heroPin.disabled = true;
      return;
    }
    if (state.heroId !== game.id) state.heroId = game.id;

    els.heroTitle.textContent = game.title;
    els.heroGlyph.textContent = glyphFor(game.title);
    const launches = playCount(game.id);
    els.heroSub.textContent = `${game.genre || "Web game"} · ${game.platform || "HTML5"} · ${hostOf(game.url)}${launches ? ` · ${launches} launch${launches === 1 ? "" : "es"}` : ""}`;

    els.heroTags.replaceChildren();
    (game.tags || []).slice(0, 3).forEach((tag) => els.heroTags.append(el("span", "tag", tag)));
    els.heroTags.append(el("span", "tag is-accent", game.needsProxy ? "Needs proxy" : "Loads in frame"));

    const pinned = state.pins.includes(game.id);
    els.heroPin.replaceChildren(svgIcon("i-star"), el("span", "", pinned ? "Unpin" : "Pin"));
    els.heroPlay.disabled = false;
    els.heroPin.disabled = false;
  }

  /* ------------------------------------------------------------------ */
  /* shelves                                                            */
  /* ------------------------------------------------------------------ */

  function miniCard(game, meta, flag) {
    const card = el("button", "mini");
    card.type = "button";
    card.dataset.game = game.id;
    card.title = `Open ${game.title}`;
    card.style.setProperty("--cover-hue", String(hueFor(game.id)));

    const cover = el("div", "mini-cover");
    cover.append(el("span", "mini-glyph", glyphFor(game.title)));
    cover.append(el("small", "", game.genre || "Game"));
    if (flag) cover.append(el("span", "mini-flag", flag));

    const body = el("div", "mini-body");
    body.append(el("span", "mini-title", game.title), el("span", "mini-meta", meta));

    card.append(cover, body);
    card.addEventListener("click", () => openGame(game.id));
    return card;
  }

  function renderShelves() {
    const settings = PretzelSettings.get();
    const show = Boolean(settings.showShelves);

    const freshGames = state.games.filter(isNewGame);
    els.shelfNew.hidden = !show || freshGames.length === 0;
    els.newRow.replaceChildren();
    freshGames.slice(0, 12).forEach((game) => {
      els.newRow.append(miniCard(game, `${game.genre || "Game"} · ${game.platform || "HTML5"}`, "New"));
    });
    els.newMeta.textContent = freshGames.length ? `${freshGames.length} added in 1.3` : "";

    const recentGames = state.recents.map((entry) => gameById(entry.id)).filter(Boolean);
    els.shelfContinue.hidden = !show || recentGames.length === 0;
    els.continueRow.replaceChildren();
    recentGames.slice(0, 8).forEach((game) => {
      const entry = recentFor(game.id);
      const plays = Number(entry.plays) || 1;
      els.continueRow.append(miniCard(game, `${plays} play${plays === 1 ? "" : "s"} · ${relativeTime(entry.at)}`));
    });
    if (recentGames.length) {
      els.continueMeta.textContent = `${recentGames.length} title${recentGames.length === 1 ? "" : "s"} · last ${relativeTime(recentFor(recentGames[0].id).at)}`;
    }

    const pinnedGames = state.pins.map((id) => gameById(id)).filter(Boolean);
    els.shelfPinned.hidden = !show || pinnedGames.length === 0;
    els.pinnedRow.replaceChildren();
    pinnedGames.forEach((game) => {
      els.pinnedRow.append(miniCard(game, `${game.genre || "Game"} · ${playCount(game.id)} plays`));
    });
    els.pinnedMeta.textContent = pinnedGames.length ? `${pinnedGames.length} saved` : "";
  }

  /* ------------------------------------------------------------------ */
  /* catalog                                                            */
  /* ------------------------------------------------------------------ */

  function makeCard(game) {
    const card = el("div", "card");
    card.dataset.game = game.id;
    card.dataset.genre = game.genre || "";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Inspect ${game.title}`);
    card.classList.toggle("is-selected", state.selected === game.id);
    card.classList.toggle("is-pinned", state.pins.includes(game.id));

    card.style.setProperty("--cover-hue", String(hueFor(game.id)));

    const cover = el("div", "card-cover");
    cover.append(el("span", "card-glyph", glyphFor(game.title)));
    if (isNewGame(game)) cover.append(el("span", "card-flag", "New"));
    if (state.pins.includes(game.id)) {
      const pin = el("span", "card-pin");
      pin.title = "Pinned";
      pin.append(svgIcon("i-star"));
      cover.append(pin);
    }

    const body = el("div", "card-body");
    body.append(el("span", "card-title", game.title));

    const meta = el("div", "card-meta");
    meta.append(el("span", "", game.genre || "Game"));
    meta.append(el("span", "sep", "·"));
    meta.append(el("span", "", game.platform || "HTML5"));
    if (game.needsProxy) {
      meta.append(el("span", "sep", "·"));
      meta.append(el("span", "tag is-proxy", "Proxy"));
    }
    body.append(meta);

    const plays = playCount(game.id);
    body.append(el("span", "card-stat", plays ? `${plays} launch${plays === 1 ? "" : "es"}` : "Not played yet"));

    const play = el("button", "card-play");
    play.type = "button";
    play.setAttribute("aria-label", `Play ${game.title}`);
    play.append(svgIcon("i-play"), el("span", "", "Play"));
    play.addEventListener("click", (event) => {
      event.stopPropagation();
      openGame(game.id);
    });

    card.append(cover, body, play);

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (event.shiftKey) openGame(game.id);
        else selectGame(game.id);
      }
      if (event.key === "p") {
        event.preventDefault();
        togglePin(game.id);
      }
    });

    return card;
  }

  function renderCatalog() {
    const matches = sortedGames(filteredGames());

    /* Any filter, query or sort change starts the list over at page one. */
    const signature = JSON.stringify([state.filters, state.sort, state.reverse]);
    if (signature !== state.catalogSig) {
      state.catalogSig = signature;
      state.shown = PAGE_SIZE;
    }
    const selectedIndex = matches.findIndex((game) => game.id === state.selected);
    if (selectedIndex >= state.shown) state.shown = selectedIndex + 1;
    const visible = matches.slice(0, state.shown);

    const wasInGrid = els.grid.contains(document.activeElement);
    els.grid.replaceChildren();

    if (!state.games.length) {
      const empty = el("div", "empty-state");
      empty.append(el("strong", "", "No games indexed"), el("p", "", "data/library.json did not load. Serve the folder over http (not file://)."));
      els.grid.append(empty);
    } else if (!matches.length) {
      const empty = el("div", "empty-state");
      empty.append(el("strong", "", "No matches"), el("p", "", "Loosen a filter or clear the search field."));
      els.grid.append(empty);
    } else {
      visible.forEach((game) => els.grid.append(makeCard(game)));
      if (visible.length < matches.length) {
        const more = el("div", "catalog-more");
        const button = el("button", "", `Show ${Math.min(PAGE_SIZE, matches.length - visible.length)} more`);
        button.type = "button";
        button.id = "catalog-more";
        more.append(button, el("span", "", `Showing ${visible.length} of ${matches.length}`));
        els.grid.append(more);
      }
    }

    els.count.textContent = `${matches.length} / ${state.games.length}`;
    els.sbCatalog.textContent = String(state.games.length);
    els.ledGamesCount.textContent = String(state.games.length);
    els.ledGames.dataset.state = state.games.length ? "ok" : "warn";
    els.diagGames.textContent = String(state.games.length);

    if (wasInGrid && state.selected) {
      const focusTarget = els.grid.querySelector(`[data-game="${state.selected}"]`);
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
    updateRailCounts();
  }

  function countFor(group, value) {
    return state.games.filter((game) => (group === "genre" ? game.genre : game.platform) === value).length;
  }

  function buildRailGroup(group, values) {
    const host = group === "genre" ? els.railGenre : els.railPlatform;
    host.replaceChildren();
    const all = el("button", "rail-item" + (state.filters[group] === "all" ? " is-on" : ""));
    all.type = "button";
    all.dataset.group = group;
    all.dataset.value = "all";
    all.append(el("span", "", "All"), el("small", "", String(state.games.length)));
    host.append(all);

    values.forEach((value) => {
      const item = el("button", "rail-item" + (state.filters[group] === value ? " is-on" : ""));
      item.type = "button";
      item.dataset.group = group;
      item.dataset.value = value;
      item.append(el("span", "", value), el("small", "", String(countFor(group, value))));
      host.append(item);
    });
  }

  function renderChips() {
    if (!els.chips) return;
    const genres = [...new Set(state.games.map((game) => game.genre).filter(Boolean))].sort();
    els.chips.replaceChildren();

    const makeChip = (value, label, count) => {
      const chip = el("button", "chip-filter" + (state.filters.genre === value ? " is-on" : ""));
      chip.type = "button";
      chip.dataset.genre = value;
      chip.setAttribute("aria-pressed", String(state.filters.genre === value));
      chip.append(el("span", "", label), el("small", "", String(count)));
      return chip;
    };

    els.chips.append(makeChip("all", "All games", state.games.length));
    genres.forEach((genre) => els.chips.append(makeChip(genre, genre, countFor("genre", genre))));
  }

  function updateChips() {
    if (!els.chips) return;
    $$(".chip-filter", els.chips).forEach((chip) => {
      const on = state.filters.genre === chip.dataset.genre;
      chip.classList.toggle("is-on", on);
      chip.setAttribute("aria-pressed", String(on));
      const count = chip.querySelector("small");
      if (count) {
        count.textContent = String(
          chip.dataset.genre === "all" ? state.games.length : countFor("genre", chip.dataset.genre)
        );
      }
    });
  }

  function renderRail() {
    const genres = [...new Set(state.games.map((game) => game.genre).filter(Boolean))].sort();
    const platforms = [...new Set(state.games.map((game) => game.platform).filter(Boolean))].sort();
    buildRailGroup("genre", genres);
    buildRailGroup("platform", platforms);
    renderChips();
    els.filterProxy.setAttribute("aria-pressed", String(state.filters.proxyOnly));
  }

  function updateRailCounts() {
    $$(".rail-item", els.rail).forEach((item) => {
      const count = item.querySelector("small");
      if (!count) return;
      const group = item.dataset.group;
      const value = item.dataset.value;
      count.textContent = String(value === "all" ? state.games.length : countFor(group, value));
      item.classList.toggle("is-on", state.filters[group] === value);
    });
    updateChips();
    els.filterProxy.setAttribute("aria-pressed", String(state.filters.proxyOnly));
  }

  function setFilter(group, value) {
    state.filters[group] = value;
    renderCatalog();
    log("event", `Filter ${group} → ${value}`);
  }

  function resetFilters() {
    state.filters = { q: "", genre: "all", platform: "all", proxyOnly: false };
    els.search.value = "";
    renderRail();
    renderCatalog();
    toast("Filters cleared");
  }

  function setView(view, opts = {}) {
    state.view = view === "list" ? "list" : "grid";
    document.body.dataset.view = state.view;
    els.viewGrid.classList.toggle("is-on", state.view === "grid");
    els.viewList.classList.toggle("is-on", state.view === "list");
    els.viewGrid.setAttribute("aria-pressed", String(state.view === "grid"));
    els.viewList.setAttribute("aria-pressed", String(state.view === "list"));
    PretzelSettings.save({ view: state.view });
    if (!opts.silent) log("event", `View → ${state.view}`);
  }

  function syncSortControl() {
    els.sort.value = state.sort;
  }

  /* ------------------------------------------------------------------ */
  /* selection + inspector                                              */
  /* ------------------------------------------------------------------ */

  function selectGame(id, opts = {}) {
    const game = gameById(id);
    if (!game) return;
    state.selected = id;

    $$(".card", els.grid).forEach((card) => card.classList.toggle("is-selected", card.dataset.game === id));
    renderHero();
    renderInspector();

    const settings = PretzelSettings.get();
    if (settings.inspector) openInspector();
    if (!opts.silent) log("event", `Selected ${game.title}`);
  }

  function openInspector() {
    els.panelLibrary.classList.remove("inspector-off");
    els.inspector.classList.add("is-open");
    syncScrim();
  }

  function closeInspector() {
    els.inspector.classList.remove("is-open");
    els.panelLibrary.classList.add("inspector-off");
    syncScrim();
  }

  function inspectorFact(label, value) {
    const row = el("div");
    row.append(el("dt", "", label), el("dd", "", value));
    return row;
  }

  function renderInspector() {
    const game = gameById(state.selected);
    els.inspectorBody.replaceChildren();

    if (!game) {
      const empty = el("div", "ins-empty");
      empty.append(svgIcon("crest"));
      empty.append(el("strong", "", "Nothing selected"));
      empty.append(el("span", "", "Pick a card to inspect it. Double-click or press Shift+Enter to launch, or use the play chip."));

      const keys = el("dl", "keylist");
      [
        ["Enter", "Inspect"],
        ["Shift ↵", "Play"],
        ["P", "Pin"],
        ["Ctrl K", "Palette"]
      ].forEach(([key, copy]) => {
        const row = el("div");
        row.append(el("dt", "", key), el("dd", "", copy));
        keys.append(row);
      });
      empty.append(keys);
      els.inspectorBody.append(empty);
      return;
    }

    const entry = recentFor(game.id);
    const pinned = state.pins.includes(game.id);

    const cover = el("div", "ins-cover");
    cover.append(el("span", "ins-glyph", glyphFor(game.title)), el("span", "ins-host", hostOf(game.url)));

    const title = el("h2", "ins-title", game.title);
    const sub = el("p", "ins-sub", `${game.genre || "Web game"} · ${game.platform || "HTML5"}`);

    const tags = el("div", "ins-tags");
    (game.tags || []).forEach((tag) => tags.append(el("span", "tag", tag)));
    if (game.needsProxy) tags.append(el("span", "tag is-proxy", "Needs proxy"));

    const facts = el("dl", "ins-facts");
    facts.append(
      inspectorFact("Status", game.needsProxy ? "Gateway required" : "Loads in frame"),
      inspectorFact("Host", hostOf(game.url)),
      inspectorFact("Launches", String(playCount(game.id))),
      inspectorFact("Last played", relativeTime(entry && entry.at)),
      inspectorFact("Time in frame", entry && entry.seconds ? clock(entry.seconds) : "—")
    );

    const actions = el("div", "ins-actions");
    const play = el("button", "btn primary");
    play.type = "button";
    play.append(svgIcon("i-play"), el("span", "", "Play now"));
    play.addEventListener("click", () => openGame(game.id));

    const row = el("div", "ins-row");
    const pin = el("button", "btn ghost");
    pin.type = "button";
    pin.append(svgIcon("i-star"), el("span", "", pinned ? "Unpin" : "Pin"));
    pin.addEventListener("click", () => togglePin(game.id));

    const copy = el("button", "btn ghost");
    copy.type = "button";
    copy.append(svgIcon("i-copy"), el("span", "", "Copy link"));
    copy.addEventListener("click", () => copyText(game.url, `Copied ${game.title} link`));
    row.append(pin, copy);
    actions.append(play, row);

    const similar = el("div", "ins-similar");
    similar.append(el("p", "kicker", "More in this genre"));
    const siblings = state.games
      .filter((other) => other.id !== game.id && other.genre === game.genre)
      .slice(0, 3);
    siblings.forEach((other) => {
      const button = el("button", "ins-sim");
      button.type = "button";
      button.append(el("span", "", other.title), el("small", "", other.platform || ""));
      button.addEventListener("click", () => selectGame(other.id, { scroll: false }));
      similar.append(button);
    });
    if (!siblings.length) similar.append(el("p", "ins-sub", "Nothing else in this genre yet."));

    els.inspectorBody.append(cover, title, sub, tags, facts, actions, similar);
  }

  /* ------------------------------------------------------------------ */
  /* player                                                             */
  /* ------------------------------------------------------------------ */

  const proxyEndpoint = () => (state.config.proxy.endpoint || "").trim();
  const proxyConfigured = () => Boolean(proxyEndpoint());

  function isProxiedUrl(url) {
    const endpoint = proxyEndpoint();
    if (!endpoint || !url) return false;
    const base = endpoint.split("{url}")[0];
    return Boolean(base) && url.startsWith(base);
  }

  function displayHost(url) {
    if (isProxiedUrl(url)) {
      try {
        const inner = new URL(url).searchParams.get("url");
        if (inner) return `${hostOf(inner)} (via proxy)`;
      } catch {
        /* fall through */
      }
    }
    return hostOf(url);
  }

  function buildProxyUrl(target) {
    const endpoint = proxyEndpoint();
    if (!endpoint) return "";
    const encoded = encodeURIComponent(target);
    let url = endpoint.includes("{url}") ? endpoint.split("{url}").join(encoded) : endpoint + encoded;
    const token = (state.config.proxy.token || "").trim();
    if (token) url += (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
    return url;
  }

  function playableUrl(game) {
    if (!game.needsProxy) return { src: game.url, proxied: false };
    const proxied = buildProxyUrl(game.url);
    return proxied ? { src: proxied, proxied: true } : { src: "", proxied: false };
  }

  /* Time in frame only counts while the page is visible. A background tab or a
     minimised window pauses the clock instead of banking hours nobody played.
     Visibility is the right signal here: it is the one that cannot leave the
     clock stuck at zero in a window the player is actually watching. */
  function playElapsed() {
    return state.playAccum + (state.playStart ? Date.now() - state.playStart : 0);
  }

  function paintPlayTime() {
    if (els.playerTime) els.playerTime.textContent = clock(playElapsed() / 1000);
  }

  function startTicker() {
    window.clearInterval(state.playTicker);
    state.playAccum = 0;
    state.playStart = document.hidden ? 0 : Date.now();
    paintPlayTime();
    state.playTicker = window.setInterval(paintPlayTime, 1000);
  }

  function stopTicker() {
    window.clearInterval(state.playTicker);
    state.playTicker = 0;
    const seconds = playElapsed() / 1000;
    state.playAccum = 0;
    state.playStart = 0;
    return seconds;
  }

  function syncPlayClock() {
    if (!state.game) return;
    const paused = document.hidden;
    if (paused) {
      if (state.playStart) {
        state.playAccum += Date.now() - state.playStart;
        state.playStart = 0;
      }
    } else if (!state.playStart) {
      state.playStart = Date.now();
    }
    paintPlayTime();
  }

  function renderPlayerSide(game) {
    els.playerSideTitle.textContent = game.title;
    const tags = els.playerSideTags;
    tags.replaceChildren();
    (game.tags || []).forEach((tag) => tags.append(el("span", "tag", tag)));
    if (game.needsProxy) tags.append(el("span", "tag is-proxy", "Needs proxy"));

    const facts = els.playerFacts;
    facts.replaceChildren(
      inspectorFact("Genre", game.genre || "—"),
      inspectorFact("Platform", game.platform || "—"),
      inspectorFact("Host", hostOf(game.url)),
      inspectorFact("Launches", String(playCount(game.id))),
      inspectorFact("Pinned", state.pins.includes(game.id) ? "Yes" : "No")
    );

    els.playerPin.querySelector("span").textContent = state.pins.includes(game.id) ? "Unpin game" : "Pin game";

    const next = state.games
      .filter((other) => other.id !== game.id && other.genre === game.genre && !other.needsProxy)
      .slice(0, 4);
    els.playerNext.replaceChildren();
    next.forEach((other) => {
      const button = el("button", "next-item");
      button.type = "button";
      button.append(el("span", "", other.title), el("small", "", other.platform || ""));
      button.addEventListener("click", () => openGame(other.id));
      els.playerNext.append(button);
    });
    if (!next.length) els.playerNext.append(el("p", "ins-sub", "Nothing queued in this genre."));
  }

  function openGame(id, opts = {}) {
    const game = gameById(id);
    if (!game) return;
    if (!/^https?:\/\//i.test(game.url || "")) {
      log("error", `Refused to open ${game.title}: only http(s) URLs are allowed`);
      toast("Only http(s) games can be opened", "error");
      return;
    }

    const previous = state.game;
    if (previous && previous.id !== game.id) closeGame({ fromRoute: true, silent: true });

    state.game = game;
    state.gameProxied = false;
    state.selected = game.id;
    closeInspector();
    els.panelLibrary.classList.add("is-playing");
    els.player.hidden = false;
    els.frameTitle.textContent = game.title;
    els.frameUrl.textContent = game.url;
    els.playerSideTitle.textContent = game.title;

    const target = playableUrl(game);
    if (target.src) {
      recordOpen(game.id);
      startTicker();
    }
    renderHero();
    renderPlayerSide(game);

    if (!target.src) {
      els.gameFrame.src = "about:blank";
      els.frameBadge.classList.add("is-hidden");
      els.frameNoticeCopy.textContent = `“${game.title}” is flagged needsProxy, but no gateway is configured. Start tools/proxy-dev.js and use the local gateway in Settings → Proxy, deploy proxy/ for a permanent one, or load it directly.`;
      els.frameNotice.classList.remove("is-hidden");
      log("warn", `Needs proxy but none configured — ${game.title}`);
    } else {
      els.frameNotice.classList.add("is-hidden");
      els.frameBadge.classList.toggle("is-hidden", !target.proxied);
      state.gameProxied = target.proxied;
      els.gameFrame.src = target.src;
      log("event", `Opened ${game.title} — ${game.platform}${target.proxied ? " · via proxy" : ""}`);
    }

    renderCatalog();
    if (!opts.fromRoute) setRoute("library", game.id, { silent: true });
    else {
      els.crumb.textContent = "Library";
      els.sbRoute.textContent = "LIBRARY";
    }
    updateStats();
  }

  function loadDirect() {
    if (!state.game) return;
    const game = state.game;
    els.frameNotice.classList.add("is-hidden");
    els.frameBadge.classList.add("is-hidden");
    state.gameProxied = false;
    els.gameFrame.src = game.url;

    /* A proxy-flagged title is not a launch until it actually has a source.
       Loading it directly is the moment to count it and start the clock. */
    if (!state.playTicker) {
      recordOpen(game.id);
      startTicker();
      renderPlayerSide(game);
      renderHero();
      renderCatalog();
    }
    log("warn", `Loaded direct despite needsProxy — ${game.title}`);
  }

  function closeGame(opts = {}) {
    if (!state.game) return;
    const game = state.game;
    const seconds = stopTicker();
    recordSessionTime(game.id, seconds);

    state.game = null;
    state.gameProxied = false;
    els.gameFrame.src = "about:blank";
    els.player.hidden = true;
    els.panelLibrary.classList.remove("is-playing");
    els.frameNotice.classList.add("is-hidden");
    els.frameBadge.classList.add("is-hidden");
    els.playerNext.replaceChildren();

    if (state.focus) toggleFocus(false);
    renderShelves();
    renderCatalog();
    renderInspector();
    syncScrim();
    updateStats();
    if (!opts.silent) log("event", `Closed ${game.title} after ${clock(seconds)}`);

    /* replace: closing an explicitly closed game should not come back on Back */
    if (!opts.fromRoute) setRoute("library", null, { silent: true, replace: true });
    else {
      els.crumb.textContent = "Library";
      els.sbRoute.textContent = "LIBRARY";
    }
  }

  function refreshGame() {
    if (!state.game) return;
    const target = playableUrl(state.game);
    if (!target.src) return;
    const game = state.game;
    els.gameFrame.src = "about:blank";
    window.setTimeout(() => {
      if (state.game === game) els.gameFrame.src = target.src;
    }, 60);
    log("event", `Hard refresh → ${game.title}${target.proxied ? " · via proxy" : ""}`);
  }

  function toggleFocus(force) {
    if (!state.game) {
      toast("Open a game first", "warn");
      return;
    }
    state.focus = typeof force === "boolean" ? force : !state.focus;
    document.body.classList.toggle("focus-mode", state.focus);
    toast(state.focus ? "Focus mode — Esc to exit" : "Focus mode off");
    log("event", state.focus ? "Focus mode on" : "Focus mode off");
  }

  function openExternal(url) {
    if (!url) return;
    if (window.pretzelShell && typeof window.pretzelShell.openExternal === "function") {
      window.pretzelShell.openExternal(url);
      log("event", `System browser → ${hostOf(url)}`);
      return;
    }
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) toast("The popup was blocked — copy the link instead", "warn");
    else log("event", `New tab → ${hostOf(url)}`);
  }

  /* ------------------------------------------------------------------ */
  /* suggestions                                                        */
  /* ------------------------------------------------------------------ */

  const categoryMeta = (id) => SUGGEST_CATEGORIES.find((entry) => entry.id === id) || SUGGEST_CATEGORIES[3];
  const statusMeta = (id) => SUGGEST_STATUSES.find((entry) => entry.id === id) || SUGGEST_STATUSES[0];

  function newSuggestionId() {
    const stamp = Date.now().toString(36).slice(-5).toUpperCase();
    const salt = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `S-${stamp}${salt}`;
  }

  function normalizeSuggestion(raw) {
    if (!raw || typeof raw !== "object") return null;
    const message = String(raw.message || "").trim().slice(0, 600);
    if (!message) return null;
    const at = Number(raw.at);
    const responseAt = Number(raw.responseAt);
    const updateAt = Number(raw.updateAt);
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 20) : newSuggestionId(),
      category: SUGGEST_CATEGORIES.some((entry) => entry.id === raw.category) ? raw.category : "other",
      message,
      name: String(raw.name || "").trim().slice(0, 60),
      at: Number.isFinite(at) && at > 0 ? at : Date.now(),
      status: SUGGEST_STATUSES.some((entry) => entry.id === raw.status) ? raw.status : "new",
      response: String(raw.response || "").trim().slice(0, REPLY_LIMIT),
      responseAt: Number.isFinite(responseAt) && responseAt > 0 ? responseAt : 0,
      updateAt: Number.isFinite(updateAt) && updateAt > 0 ? updateAt : 0,
      accent: isUpdateAccent(raw.accent) ? raw.accent : UPDATE_ACCENTS[0],
      build: String(raw.build || "").slice(0, 48),
      session: String(raw.session || "").slice(0, 12)
    };
  }

  function loadSuggestions() {
    const raw = readStore(SUGGEST_KEY, []);
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw
      .map(normalizeSuggestion)
      .filter((entry) => {
        if (!entry || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      })
      .slice(0, SUGGEST_LIMIT);
  }

  function adminSessionActive() {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
    } catch {
      return false;
    }
  }

  function suggestionTime(ts) {
    const date = new Date(Number(ts));
    if (Number.isNaN(date.getTime())) return "unknown time";
    return date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function setSuggestError(text) {
    els.suggestError.textContent = text || "";
  }

  function setAdminError(text) {
    els.adminError.textContent = text || "";
  }

  function updateSuggestChars() {
    els.suggestChars.textContent = String(els.suggestMessage.value.length);
  }

  function setSuggestCategory(id) {
    if (!SUGGEST_CATEGORIES.some((entry) => entry.id === id)) return;
    state.suggestCategory = id;
    $$(".chip", els.suggestCats).forEach((chip) => {
      const on = chip.dataset.cat === id;
      chip.classList.toggle("is-on", on);
      chip.setAttribute("aria-pressed", String(on));
    });
  }

  function updateSuggestMeta() {
    const total = state.suggestions.length;
    const updates = state.suggestions.filter((entry) => entry.updateAt).length;
    els.suggestCount.textContent = total
      ? `${total} sent · ${updates} update${updates === 1 ? "" : "s"}`
      : "0 sent from this device";
    els.suggestMineNote.textContent = total ? `${total} saved locally · newest activity first` : "Newest activity first";
  }

  function buildSuggestionUpdate(entry) {
    const banner = el("div", "suggest-update");
    banner.style.setProperty("--update", entry.accent || UPDATE_ACCENTS[0]);

    const kicker = el("p", "suggest-update-kicker");
    kicker.append(el("span", "", "Admin update"), el("span", "", `· ${relativeTime(entry.updateAt)}`));

    let headline;
    if (entry.status !== "new") headline = statusMeta(entry.status).publicLabel;
    else if (entry.response) headline = "Admin replied";
    else headline = "Received";

    banner.append(kicker, el("strong", "suggest-update-status", headline.toUpperCase()));
    if (entry.response) banner.append(el("p", "suggest-update-response", entry.response));
    return banner;
  }

  function buildPublicSuggestion(entry) {
    const item = el("article", "suggest-item");
    const hasUpdate = Boolean(entry.updateAt);
    if (hasUpdate) {
      item.classList.add("has-update");
      item.style.setProperty("--update", entry.accent || UPDATE_ACCENTS[0]);
    }

    const head = el("div", "suggest-item-head");
    head.append(el("span", "tag is-accent", categoryMeta(entry.category).label));
    const status = el("span", "suggest-status", statusMeta(entry.status).publicLabel);
    status.dataset.status = entry.status;
    head.append(status, el("span", "suggest-when", relativeTime(entry.at)));

    const foot = el("div", "suggest-item-foot");
    foot.append(el("span", "suggest-ref", entry.id));
    if (entry.name) foot.append(el("span", "", `from ${entry.name}`));

    item.append(head, el("p", "suggest-message", entry.message));
    if (hasUpdate) item.append(buildSuggestionUpdate(entry));
    item.append(foot);
    return item;
  }

  function renderPublicSuggestions() {
    updateSuggestMeta();
    els.suggestMineList.replaceChildren();

    if (!state.suggestions.length) {
      const empty = el("div", "suggest-empty");
      empty.append(
        el("strong", "", "Nothing sent from this device yet."),
        el("p", "", "Use the form above. Other people's submissions stay in the admin inbox.")
      );
      els.suggestMineList.append(empty);
      return;
    }

    /* An update is the thing the suggester needs to see, so older suggestions
       with fresh activity jump ahead of newer untouched ones. */
    const ordered = [...state.suggestions].sort((a, b) => (b.updateAt || b.at) - (a.updateAt || a.at));
    ordered.slice(0, 6).forEach((entry) => els.suggestMineList.append(buildPublicSuggestion(entry)));
    if (state.suggestions.length > 6) {
      els.suggestMineList.append(el("p", "suggest-muted", "Only the six most recently active submissions are listed here."));
    }
  }

  function submitSuggestion(event) {
    event.preventDefault();
    const message = els.suggestMessage.value.trim();
    if (message.length < 3) {
      setSuggestError("Add a few more words — at least 3 characters.");
      els.suggestMessage.focus();
      return;
    }

    const includeBuild = els.suggestIncludeBuild.checked;
    const entry = {
      id: newSuggestionId(),
      category: state.suggestCategory,
      message: message.slice(0, 600),
      name: els.suggestName.value.trim().slice(0, 60),
      at: Date.now(),
      status: "new",
      response: "",
      responseAt: 0,
      updateAt: 0,
      accent: UPDATE_ACCENTS[0],
      build: includeBuild ? `${VERSION} · ${BUILD}` : "",
      session: includeBuild ? state.session : ""
    };
    const next = [entry, ...state.suggestions].slice(0, SUGGEST_LIMIT);

    if (!writeStore(SUGGEST_KEY, next)) {
      setSuggestError("This browser refused local storage, so the suggestion was not saved.");
      log("error", `Suggestion save failed — ${entry.id}`);
      return;
    }

    state.suggestions = next;
    els.suggestMessage.value = "";
    els.suggestName.value = "";
    updateSuggestChars();
    setSuggestError("");
    els.suggestSent.hidden = false;
    els.suggestSentRef.textContent = entry.id;
    renderPublicSuggestions();
    if (state.adminUnlocked) renderAdminList();

    toast(`Suggestion sent · ${entry.id}`);
    log("event", `Suggestion saved · ${entry.category} · ${entry.id}`);
  }

  function selectSuggestTab(tab, opts = {}) {
    if (tab !== "send" && tab !== "admin") return;
    state.suggestTab = tab;
    const send = tab === "send";

    els.suggestTabSend.classList.toggle("is-on", send);
    els.suggestTabSend.setAttribute("aria-selected", String(send));
    els.suggestTabSend.tabIndex = send ? 0 : -1;
    els.suggestTabAdmin.classList.toggle("is-on", !send);
    els.suggestTabAdmin.setAttribute("aria-selected", String(!send));
    els.suggestTabAdmin.tabIndex = send ? -1 : 0;
    els.suggestSend.hidden = !send;
    els.suggestAdmin.hidden = send;

    if (!send) {
      setAdminError("");
      renderSuggestAdmin();
    }
    if (!opts.silent) log("event", `Suggestions tab → ${tab}`);
    if (!send && !opts.noFocus) {
      window.setTimeout(() => {
        if (state.adminUnlocked) els.adminSearch.focus();
        else els.adminPassword.focus();
      }, 30);
    }
  }

  function renderSuggestAdmin() {
    const unlocked = Boolean(state.adminUnlocked);
    els.adminGate.hidden = unlocked;
    els.adminInbox.hidden = !unlocked;
    if (!unlocked) {
      els.adminCount.textContent = "";
      els.adminSummary.textContent = "";
      els.adminList.replaceChildren();
      els.adminStats.replaceChildren();
      return;
    }
    renderAdminList();
  }

  function renderAdminStats() {
    if (!els.adminStats) return;
    const total = state.suggestions.length;
    const counts = { new: 0, planned: 0, done: 0, declined: 0 };
    state.suggestions.forEach((entry) => {
      counts[entry.status] = (counts[entry.status] || 0) + 1;
    });
    const replied = state.suggestions.filter((entry) => entry.response).length;
    const cells = [
      ["Total", total],
      ["New", counts.new],
      ["Replied", replied],
      ["No reply", total - replied]
    ];
    els.adminStats.replaceChildren();
    cells.forEach(([label, value]) => {
      const cell = el("div", "admin-stat");
      cell.append(el("span", "", label), el("strong", "", String(value)));
      els.adminStats.append(cell);
    });
  }

  function saveSuggestionReply(entry, input) {
    const text = String(input.value || "").trim().slice(0, REPLY_LIMIT);
    if (!text) {
      toast("Write a reply before sending it", "warn");
      input.focus();
      return;
    }

    const before = {
      response: entry.response,
      responseAt: entry.responseAt,
      updateAt: entry.updateAt,
      accent: entry.accent
    };
    entry.response = text;
    entry.responseAt = Date.now();
    entry.updateAt = entry.responseAt;
    entry.accent = randomAccent(entry.accent);

    if (!writeStore(SUGGEST_KEY, state.suggestions)) {
      Object.assign(entry, before);
      toast("Could not save that reply", "error");
      return;
    }

    renderPublicSuggestions();
    renderAdminList();
    toast("Reply published · public update posted");
    log("event", `Admin replied to ${entry.id}`);
  }

  function clearSuggestionReply(entry) {
    if (!entry.response) return;
    if (!window.confirm(`Remove the public reply to ${entry.id}?`)) return;

    const before = {
      response: entry.response,
      responseAt: entry.responseAt,
      updateAt: entry.updateAt,
      accent: entry.accent
    };
    entry.response = "";
    entry.responseAt = 0;
    entry.updateAt = entry.status === "new" ? 0 : Date.now();
    entry.accent = randomAccent(entry.accent);

    if (!writeStore(SUGGEST_KEY, state.suggestions)) {
      Object.assign(entry, before);
      toast("Could not remove that reply", "error");
      return;
    }

    renderPublicSuggestions();
    renderAdminList();
    toast("Reply removed");
    log("event", `Admin cleared reply for ${entry.id}`);
  }

  function renderAdminList() {
    if (!state.adminUnlocked) return;
    const q = state.adminQuery.trim().toLowerCase();
    const filtered = state.suggestions.filter((entry) => {
      if (state.adminFilter !== "all" && entry.status !== state.adminFilter) return false;
      if (state.adminCategory !== "all" && entry.category !== state.adminCategory) return false;
      if (!q) return true;
      return [entry.message, entry.name, entry.id, entry.response, entry.build, entry.category]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
      if (state.adminSort === "oldest") return a.at - b.at;
      if (state.adminSort === "updated") return (b.updateAt || b.at) - (a.updateAt || a.at);
      return b.at - a.at;
    });

    const counts = { new: 0, planned: 0, done: 0, declined: 0 };
    state.suggestions.forEach((entry) => {
      counts[entry.status] = (counts[entry.status] || 0) + 1;
    });
    const total = state.suggestions.length;
    els.adminCount.textContent = `${sorted.length}/${total}`;
    els.adminSummary.textContent =
      `${total} total · ${counts.new} new · ${counts.planned} planned · ${counts.done} done · ${counts.declined} not planned`;
    els.adminFilter.value = state.adminFilter;
    els.adminCategory.value = state.adminCategory;
    els.adminSort.value = state.adminSort;
    renderAdminStats();
    els.adminList.replaceChildren();

    if (!sorted.length) {
      const empty = el("div", "suggest-empty");
      empty.append(
        el("strong", "", total ? "No suggestions match this view." : "The inbox is empty."),
        el("p", "", total ? "Clear the search or choose another category or status." : "Public submissions will show up here.")
      );
      els.adminList.append(empty);
      return;
    }

    sorted.forEach((entry) => {
      const item = el("article", "admin-item");
      item.style.setProperty("--update", entry.accent || UPDATE_ACCENTS[0]);
      const head = el("div", "admin-item-head");
      head.append(el("span", "tag is-accent", categoryMeta(entry.category).label));
      head.append(el("span", "suggest-ref", entry.id));

      const status = el("select", "select admin-status");
      status.dataset.status = entry.status;
      status.setAttribute("aria-label", `Status for ${entry.id}`);
      SUGGEST_STATUSES.forEach((meta) => {
        const option = el("option", "", meta.label);
        option.value = meta.id;
        status.append(option);
      });
      status.value = entry.status;
      status.addEventListener("change", () => {
        const before = { status: entry.status, updateAt: entry.updateAt, accent: entry.accent };
        const nextStatus = status.value;
        entry.status = nextStatus;
        entry.updateAt = Date.now();
        entry.accent = randomAccent(entry.accent);
        if (!writeStore(SUGGEST_KEY, state.suggestions)) {
          Object.assign(entry, before);
          status.value = before.status;
          status.dataset.status = before.status;
          toast("Could not save that status", "error");
          return;
        }
        status.dataset.status = nextStatus;
        renderPublicSuggestions();
        renderAdminList();
        toast(`Marked ${statusMeta(nextStatus).label} · public update posted`);
        log("event", `Suggestion ${entry.id} → ${nextStatus}`);
      });

      const remove = el("button", "ghost-btn is-danger", "Delete");
      remove.type = "button";
      remove.addEventListener("click", () => {
        if (!window.confirm(`Delete suggestion ${entry.id}? This cannot be undone.`)) return;
        const next = state.suggestions.filter((other) => other.id !== entry.id);
        if (!writeStore(SUGGEST_KEY, next)) {
          toast("Could not delete that suggestion", "error");
          return;
        }
        state.suggestions = next;
        renderPublicSuggestions();
        renderAdminList();
        toast("Suggestion deleted");
        log("event", `Suggestion deleted · ${entry.id}`);
      });

      head.append(status, remove);

      const meta = el("div", "admin-meta");
      [
        entry.name ? `From ${entry.name}` : "Anonymous",
        suggestionTime(entry.at),
        entry.responseAt ? `Replied ${suggestionTime(entry.responseAt)}` : "",
        entry.build ? `Build ${entry.build}` : "",
        entry.session ? `Session ${entry.session}` : ""
      ]
        .filter(Boolean)
        .forEach((text) => meta.append(el("span", "", text)));

      const copy = el("button", "linkish admin-copy", "Copy text");
      copy.type = "button";
      copy.addEventListener("click", () => copyText(entry.message, "Suggestion copied"));
      meta.append(copy);

      const currentReply = el("div", "admin-current-reply");
      const currentHead = el("div", "admin-current-reply-head");
      currentHead.append(el("span", "admin-reply-label", "Current public reply"));
      const copyReply = el("button", "linkish admin-copy", "Copy reply");
      copyReply.type = "button";
      copyReply.addEventListener("click", () => copyText(entry.response, "Reply copied"));
      currentHead.append(copyReply);
      currentReply.append(currentHead, el("p", "admin-current-reply-text", entry.response));

      const reply = el("div", "admin-reply");
      const field = el("label", "field");
      field.append(el("span", "field-label", entry.response ? "Update public reply" : "Public reply"));
      const input = el("textarea", "admin-reply-input");
      input.rows = 2;
      input.maxLength = REPLY_LIMIT;
      input.placeholder = "Write anything the suggester will see…";
      input.setAttribute("aria-label", `Public reply to ${entry.id}`);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          saveSuggestionReply(entry, input);
        }
      });
      field.append(input);

      const actions = el("div", "admin-reply-actions");
      const send = el("button", "btn primary", entry.response ? "Update reply" : "Send reply");
      send.type = "button";
      send.addEventListener("click", () => saveSuggestionReply(entry, input));
      actions.append(send);

      if (entry.response) {
        const clear = el("button", "ghost-btn is-danger", "Clear reply");
        clear.type = "button";
        clear.addEventListener("click", () => clearSuggestionReply(entry));
        actions.append(clear);
      }
      actions.append(el("span", "suggest-muted", "Posts a huge, color-coded update."));

      reply.append(field, actions);

      item.append(head, el("p", "admin-message", entry.message), meta);
      if (entry.response) item.append(currentReply);
      item.append(reply);
      els.adminList.append(item);
    });
  }

  function unlockAdmin(event) {
    if (event) event.preventDefault();
    const value = els.adminPassword.value.trim();
    if (!value) {
      setAdminError("Enter the admin password.");
      els.adminPassword.focus();
      return;
    }
    if (value !== ADMIN_PASSWORD) {
      setAdminError("That password is not right.");
      log("warn", "Admin unlock rejected");
      els.adminPassword.select();
      return;
    }

    state.adminUnlocked = true;
    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    } catch {
      /* session storage unavailable; the unlock still holds for this view */
    }
    els.adminPassword.value = "";
    setAdminError("");
    renderSuggestAdmin();
    toast("Admin inbox unlocked");
    log("event", "Admin inbox unlocked");
    window.setTimeout(() => els.adminSearch.focus(), 30);
  }

  function lockAdmin() {
    state.adminUnlocked = false;
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      /* ignore */
    }
    setAdminError("");
    renderSuggestAdmin();
    toast("Admin inbox locked");
    log("event", "Admin inbox locked");
    window.setTimeout(() => els.adminPassword.focus(), 30);
  }

  function clearSuggestions() {
    const total = state.suggestions.length;
    if (!total) {
      toast("The inbox is already empty");
      return;
    }
    if (!window.confirm(`Delete all ${total} suggestions from this browser? This cannot be undone.`)) return;
    if (!writeStore(SUGGEST_KEY, [])) {
      toast("Could not clear the inbox", "error");
      return;
    }
    state.suggestions = [];
    renderPublicSuggestions();
    renderAdminList();
    toast("Suggestions cleared");
    log("event", `Admin cleared ${total} suggestions`);
  }

  function exportSuggestions() {
    const payload = {
      format: "pretzel-suggestions",
      bundle: 2,
      exportedAt: new Date().toISOString(),
      build: `${VERSION} · ${BUILD}`,
      suggestions: state.suggestions
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "pretzel-suggestions.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    toast("Suggestions exported");
    log("event", `Admin exported ${state.suggestions.length} suggestions`);
  }

  /* The inbox lives in one browser. A bundle is how an admin moves it: export
     here, import on the other device, and both sides keep their own copy. */
  function importSuggestionsFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => {
      toast("Could not read that file", "error");
      log("error", "Suggestion import failed — the file could not be read");
    };
    reader.onload = () => {
      let parsed = null;
      try {
        parsed = JSON.parse(String(reader.result || ""));
      } catch {
        toast("That file is not valid JSON", "error");
        log("error", "Suggestion import failed — invalid JSON");
        return;
      }

      const incoming = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed && parsed.suggestions)
          ? parsed.suggestions
          : null;
      if (!incoming) {
        toast("No suggestions found in that file", "error");
        log("error", "Suggestion import failed — no suggestions array");
        return;
      }

      const seen = new Set(state.suggestions.map((entry) => entry.id));
      const added = [];
      let skipped = 0;
      incoming.forEach((raw) => {
        const entry = normalizeSuggestion(raw);
        if (!entry || seen.has(entry.id) || added.length >= SUGGEST_LIMIT) {
          skipped += 1;
          return;
        }
        seen.add(entry.id);
        added.push(entry);
      });

      if (!added.length) {
        toast(`Nothing new in that bundle · ${skipped} already here`, "warn");
        log("event", `Suggestion import found ${skipped} duplicates and nothing new`);
        return;
      }

      const next = [...added, ...state.suggestions].slice(0, SUGGEST_LIMIT);
      if (!writeStore(SUGGEST_KEY, next)) {
        toast("This browser refused storage, so the import was not saved", "error");
        log("error", "Suggestion import could not be saved");
        return;
      }

      state.suggestions = next;
      renderPublicSuggestions();
      renderAdminList();
      toast(`Imported ${added.length} suggestion${added.length === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped` : ""}`);
      log("event", `Imported ${added.length} suggestions · ${skipped} skipped`);
    };
    reader.readAsText(file);
  }

  function renderSuggestions() {
    renderPublicSuggestions();
    renderSuggestAdmin();
  }

  /* ------------------------------------------------------------------ */
  /* AI panel                                                           */
  /* ------------------------------------------------------------------ */

  const aiKey = (mode) => AI_PREFIX + mode;
  const threadCache = {};
  const AGE_KEY = "pretzel.v13.agegate";
  let pendingMode = null;

  /* Adult mode is behind a one-time confirmation, stored per browser. It is a
     tone gate, not authentication — the copy says as much. */
  function adultCleared() {
    return readStore(AGE_KEY, false) === true;
  }

  function openAgeGate() {
    if (!els.agegate) return;
    if (typeof els.agegate.showModal === "function") els.agegate.showModal();
    else els.agegate.open = true;
    log("event", "Age gate opened for Spicy mode");
  }

  function closeAgeGate() {
    if (!els.agegate) return;
    if (typeof els.agegate.close === "function") els.agegate.close();
    else els.agegate.open = false;
  }

  function loadThread(mode) {
    if (!state.aiKeepHistory) return threadCache[mode] || null;
    try {
      const raw = localStorage.getItem(aiKey(mode));
      if (!raw) return threadCache[mode] || null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return threadCache[mode] || null;
    }
  }

  function saveThread(mode, thread) {
    threadCache[mode] = thread;
    if (!state.aiKeepHistory) return;
    try {
      localStorage.setItem(aiKey(mode), JSON.stringify(thread));
    } catch (err) {
      log("warn", `History write failed: ${err.message}`);
    }
  }

  function scrollChat() {
    if (!state.aiAutoScroll) return;
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  function addBubble(role, text) {
    const bubble = el("div", `bubble bubble-${role}`, text);
    els.chat.append(bubble);
    return bubble;
  }

  function renderThread(mode) {
    els.chat.replaceChildren();
    let thread = loadThread(mode);
    if (!thread || !thread.length) {
      thread = [{ role: "ai", text: PERSONAS[mode].greeting }];
      saveThread(mode, thread);
    }
    thread.forEach((message) => addBubble(message.role, message.text));
    scrollChat();
    updateStats();
  }

  function setMode(mode, opts = {}) {
    if (!PERSONAS[mode]) return;
    if (mode === "spicy" && !adultCleared() && !opts.force) {
      pendingMode = mode;
      openAgeGate();
      return;
    }
    state.mode = mode;
    els.panelAi.dataset.mode = mode;
    $$(".mode").forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    els.chatInput.placeholder = PERSONAS[mode].placeholder;
    els.aiModeLabel.textContent = PERSONAS[mode].label;
    els.aiNoteTitle.textContent = PERSONAS[mode].noteTitle;
    els.aiNoteCopy.textContent = PERSONAS[mode].noteCopy;
    renderThread(mode);
    if (!opts.silent) log("event", `AI mode → ${PERSONAS[mode].label}`);
  }

  function sendChat() {
    const text = els.chatInput.value.trim();
    if (!text) return;

    const thread = loadThread(state.mode) || [];
    thread.push({ role: "user", text });
    addBubble("user", text);

    els.chatInput.value = "";
    autoGrow();

    const reply = window.PretzelAI
      ? window.PretzelAI.respond(state.mode, text)
      : "Engine offline — js/ai.js failed to load.";
    thread.push({ role: "ai", text: reply });
    addBubble("ai", reply);

    saveThread(state.mode, thread);
    scrollChat();
    log("event", `AI reply · ${PERSONAS[state.mode].label} · ${reply.length} chars`);
    updateStats();
  }

  function clearHistory() {
    Object.keys(PERSONAS).forEach((mode) => {
      try {
        localStorage.removeItem(aiKey(mode));
      } catch {
        /* storage unavailable */
      }
      delete threadCache[mode];
    });
    renderThread(state.mode);
    log("event", "AI history cleared for all three modes");
    toast("Chat history cleared");
  }

  const storedMessages = () =>
    Object.keys(PERSONAS).reduce((sum, mode) => {
      const thread = loadThread(mode);
      return sum + (thread ? thread.length : 0);
    }, 0);

  function autoGrow() {
    const field = els.chatInput;
    field.style.height = "auto";
    field.style.height = Math.min(field.scrollHeight, 120) + "px";
  }

  /* ------------------------------------------------------------------ */
  /* sandbox browser                                                    */
  /* ------------------------------------------------------------------ */

  function setHint(text, isError) {
    els.addrHint.classList.toggle("is-error", Boolean(isError));
    els.addrHintText.textContent = text;
    window.clearTimeout(state.hintTimer);
    if (isError) {
      state.hintTimer = window.setTimeout(() => {
        els.addrHint.classList.remove("is-error");
        setHint("Bare domains get https:// · anything else becomes a search.");
      }, 6000);
    }
  }

  function parseAddress(raw) {
    const input = String(raw || "").trim();
    if (!input) return { error: "Enter an address or search term." };
    if (/^(javascript|data|blob|vbscript):/i.test(input)) {
      return { error: "Only http(s) destinations are allowed in the sandbox." };
    }

    if (/^https?:\/\//i.test(input)) {
      try {
        return { url: new URL(input).href, kind: "url" };
      } catch {
        return { error: "That URL could not be parsed." };
      }
    }

    const hostish =
      /^([a-z0-9-]+\.)+[a-z]{2,}(:\d{2,5})?([/?#].*)?$/i.test(input) ||
      /^localhost(:\d{2,5})?([/?#].*)?$/i.test(input) ||
      /^\d{1,3}(\.\d{1,3}){3}(:\d{2,5})?([/?#].*)?$/.test(input);

    if (hostish) {
      try {
        return { url: new URL("https://" + input).href, kind: "url" };
      } catch {
        return { error: "That address could not be parsed." };
      }
    }

    const base = state.config.search.endpoint || "https://duckduckgo.com/?q=";
    return { url: base + encodeURIComponent(input), kind: "search" };
  }

  function armWatchdog(url) {
    window.clearTimeout(state.watchdog);
    const ms = Number(state.config.features.frameWatchdogMs) || 8000;
    state.watchdog = window.setTimeout(() => {
      if (state.browserUrl !== url) return;
      log("warn", `Frame never reported load → ${hostOf(url)}`);
      showBlock(url, "The frame never reported a load. The host may be blocking embedding or is unreachable.");
    }, ms);
  }

  function loadBrowserUrl(url, kind) {
    state.browserUrl = url;
    els.browserEmpty.classList.add("is-hidden");
    els.blockPanel.classList.add("is-hidden");
    els.blockNote.textContent = "";
    els.browserFrame.classList.remove("is-hidden");
    els.browserFrame.src = url;

    if (kind === "search") {
      setHint(`Searching ${hostOf(url)} for your terms…`);
      log("event", `Search → ${hostOf(url)}`);
    } else {
      setHint(`Loading ${hostOf(url)}…`);
      log("event", `Frame → ${url}`);
    }
    armWatchdog(url);
  }

  function openAddress(raw) {
    const result = parseAddress(raw);
    if (result.error) {
      setHint(result.error, true);
      log("warn", `Address rejected — ${result.error}`);
      return;
    }
    loadBrowserUrl(result.url, result.kind);
  }

  function showBlock(url, note) {
    state.blockedUrl = url;
    els.blockHost.textContent = displayHost(url) || "unknown host";
    els.blockNote.textContent = note || "";
    els.blockPanel.classList.remove("is-hidden");
  }

  function retryViaProxy() {
    const target = state.blockedUrl || state.browserUrl;
    if (!target) return;
    if (isProxiedUrl(target)) {
      els.blockNote.textContent = "This destination is already routed through the proxy.";
      log("warn", "Proxy retry skipped — destination already proxied");
      return;
    }
    const proxied = buildProxyUrl(target);
    if (!proxied) {
      els.blockNote.textContent =
        "No proxy gateway configured. Deploy the worker in proxy/, add its URL to proxy.endpoint in data/config.json, then retry.";
      log("warn", "Proxy retry blocked — no endpoint configured");
      return;
    }
    loadBrowserUrl(proxied, "url");
    log("event", `Proxy retry → ${hostOf(target)}`);
  }

  function unloadBrowser() {
    els.browserFrame.src = "about:blank";
    els.browserFrame.classList.add("is-hidden");
    els.blockPanel.classList.add("is-hidden");
    els.browserEmpty.classList.remove("is-hidden");
    state.browserUrl = "";
    state.blockedUrl = "";
    window.clearTimeout(state.watchdog);
    setHint("Bare domains get https:// · anything else becomes a search.");
    log("event", "Browser frame unloaded");
  }

  /* ------------------------------------------------------------------ */
  /* stats                                                              */
  /* ------------------------------------------------------------------ */

  function updateStats() {
    const launches = totalLaunches();
    els.statPins.textContent = String(state.pins.length);
    els.statPlays.textContent = String(launches);
    els.statCatalog.textContent = String(state.games.length);

    els.diagSession.textContent = state.session;
    els.diagStorage.textContent = String(storedMessages());
    els.diagPins.textContent = `${state.pins.length} / ${state.recents.length}`;
    els.diagRenderer.textContent = isDesktop() ? "Electron shell" : "Browser";
    els.diagOffline.textContent = state.offlineCache;
    els.sbSession.textContent = state.session;
    els.sbCatalog.textContent = String(state.games.length);

    if (!proxyConfigured()) {
      els.ledProxy.dataset.state = "off";
      els.ledProxy.title = "No proxy gateway configured";
      els.diagProxy.textContent = "Unconfigured";
      els.sbProxy.textContent = "OFF";
    } else if (state.proxyState === "checking") {
      els.ledProxy.dataset.state = "busy";
      els.ledProxy.title = "Checking proxy health…";
      els.diagProxy.textContent = "Checking…";
      els.sbProxy.textContent = "CHECK";
    } else if (state.proxyState === "ok") {
      els.ledProxy.dataset.state = "ok";
      els.ledProxy.title = `Proxy reachable — ${state.config.proxy.label || "configured"}`;
      els.diagProxy.textContent = state.config.proxy.label || "Reachable";
      els.sbProxy.textContent = "OK";
    } else if (state.proxyState === "down") {
      els.ledProxy.dataset.state = "warn";
      els.ledProxy.title = "Proxy configured but unreachable";
      els.diagProxy.textContent = "Unreachable";
      els.sbProxy.textContent = "DOWN";
    } else {
      els.ledProxy.dataset.state = "busy";
      els.ledProxy.title = "Proxy configured, not yet probed";
      els.diagProxy.textContent = state.config.proxy.label || "Configured";
      els.sbProxy.textContent = "SET";
    }

    els.ledAi.dataset.state = window.PretzelAI ? "ok" : "warn";
    els.ledAi.title = window.PretzelAI
      ? `${window.PretzelAI.fighterCount} curated fighters · 3 personas (test build)`
      : "AI engine missing";
  }

  async function probeProxy(opts = {}) {
    if (!proxyConfigured()) {
      state.proxyState = "off";
      updateStats();
      if (!opts.silent) toast("No proxy configured in this build", "warn");
      if (!opts.silent) log("warn", "No proxy configured — deploy proxy/ and set proxy.endpoint in data/config.json");
      return false;
    }

    const health = (state.config.proxy.health || "").trim();
    if (!health) {
      state.proxyState = "unknown";
      updateStats();
      if (!opts.silent) log("warn", "Proxy has no health URL — set proxy.health in data/config.json");
      return false;
    }

    state.proxyState = "checking";
    updateStats();
    try {
      const res = await fetch(health, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(`HTTP ${res.status}`);
      state.proxyState = "ok";
      log("event", `Proxy reachable · ${data.service || "pretzel-proxy"} v${data.version || "?"}`);
      updateStats();
      return true;
    } catch (err) {
      state.proxyState = "down";
      log("warn", `Proxy unreachable — ${err.message}`);
      updateStats();
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* settings                                                           */
  /* ------------------------------------------------------------------ */

  function settingsValue(key) {
    const s = PretzelSettings.get();
    if (key.indexOf("aiWeights.") === 0) return s.aiWeights[key.split(".")[1]];
    return s[key];
  }

  function settingsWrite(key, value) {
    if (key.indexOf("aiWeights.") === 0) PretzelSettings.save({ aiWeights: { [key.split(".")[1]]: value } });
    else PretzelSettings.save({ [key]: value });
  }

  function applySettingsRuntime() {
    const s = PretzelSettings.get();
    const fileProxy = (state.fileConfig && state.fileConfig.proxy) || {};

    if (window.PretzelAI && window.PretzelAI.setOptions) {
      window.PretzelAI.setOptions({
        weights: { stats: s.aiWeights.stats, hax: s.aiWeights.hax, speed: s.aiWeights.speed },
        detail: s.aiDetail
      });
    }

    const engine = PretzelSettings.ENGINES[s.searchEngine];
    state.config.search =
      s.searchEngine === "custom" && String(s.customSearch || "").trim()
        ? { label: "Custom", endpoint: String(s.customSearch).trim() }
        : {
            label: engine ? engine.label : "DuckDuckGo",
            endpoint: engine ? engine.endpoint : PretzelSettings.ENGINES.duckduckgo.endpoint
          };

    state.config.features.frameWatchdogMs = Number(s.watchdogMs) || 8000;

    const endpoint = String(s.proxyEndpoint || "").trim();
    state.config.proxy = endpoint
      ? {
          label: "Custom gateway",
          endpoint,
          health: String(s.proxyHealth || "").trim(),
          token: String(s.proxyToken || "").trim()
        }
      : {
          label: fileProxy.label || "Unconfigured",
          endpoint: fileProxy.endpoint || "",
          health: fileProxy.health || "",
          token: fileProxy.token || ""
        };

    state.aiKeepHistory = Boolean(s.aiKeepHistory);
    state.aiAutoScroll = Boolean(s.aiAutoScroll);
    state.sort = s.sort;
    state.reverse = Boolean(s.reverseSort);
    maxLogRows = Number(s.logMax) || 300;
    logLevelFilter = s.logLevel;
    applyLogFilter();
    syncSortControl();
    updateStats();
  }

  function onSettingChanged(key, value) {
    if (key === "view") {
      setView(value, { silent: true });
      return;
    }
    if (key === "sort" || key === "reverseSort") {
      state.sort = PretzelSettings.get().sort;
      state.reverse = Boolean(PretzelSettings.get().reverseSort);
      syncSortControl();
      renderCatalog();
      return;
    }
    if (key === "showShelves") {
      renderShelves();
      return;
    }
    if (key === "inspector") {
      if (value) openInspector();
      else closeInspector();
      return;
    }
    if (key === "showStatus") {
      return;
    }
    if (key === "defaultGenre") {
      state.filters.genre = value;
      renderRail();
      renderCatalog();
      return;
    }
    if (key === "defaultPlatform") {
      state.filters.platform = value;
      renderRail();
      renderCatalog();
      return;
    }
    if (key === "proxyOnly") {
      state.filters.proxyOnly = Boolean(value);
      renderRail();
      renderCatalog();
      return;
    }
    if (key === "aiMode") {
      setMode(value, { silent: true });
      return;
    }
    if (key === "aiKeepHistory" && !value) {
      Object.keys(PERSONAS).forEach((mode) => {
        try {
          localStorage.removeItem(aiKey(mode));
        } catch {
          /* storage unavailable */
        }
      });
      return;
    }
    if (key === "logLevel") {
      applyLogFilter();
      return;
    }
    if (key === "logMax") {
      trimLog();
      return;
    }
    if (key === "proxyEndpoint" || key === "proxyHealth") {
      state.proxyState = proxyConfigured() ? "unknown" : "off";
      updateStats();
      if (key === "proxyEndpoint" && String(value || "").trim()) probeProxy({ silent: true });
    }
  }

  function commitSetting(key, value) {
    settingsWrite(key, value);
    PretzelSettings.apply();
    applySettingsRuntime();
    onSettingChanged(key, value);
  }

  function buildSettingRow(item, genres, platforms) {
    const row = el("div", "set-row");
    row.dataset.key = item.key;

    const copy = el("div", "set-copy");
    copy.append(el("span", "set-label", item.label), el("span", "set-hint", item.hint || ""));

    const control = el("div", "set-control");
    const value = settingsValue(item.key);

    if (item.type === "select") {
      const select = el("select", "set-input");
      select.setAttribute("aria-label", item.label);
      let options = item.options || [];
      if (item.dynamic === "genres") {
        options = [{ value: "all", label: "All genres" }, ...genres.map((entry) => ({ value: entry, label: entry }))];
      } else if (item.dynamic === "platforms") {
        options = [{ value: "all", label: "All platforms" }, ...platforms.map((entry) => ({ value: entry, label: entry }))];
      }
      options.forEach((option) => {
        const node = el("option", "", option.label);
        node.value = option.value;
        select.append(node);
      });
      select.value = String(value);
      select.addEventListener("change", () => commitSetting(item.key, select.value));
      control.append(select);
    } else if (item.type === "toggle") {
      const button = el("button", "set-switch");
      button.type = "button";
      button.setAttribute("role", "switch");
      button.setAttribute("aria-checked", String(Boolean(value)));
      button.setAttribute("aria-label", item.label);
      button.addEventListener("click", () => {
        const next = button.getAttribute("aria-checked") !== "true";
        button.setAttribute("aria-checked", String(next));
        commitSetting(item.key, next);
      });
      control.append(button);
    } else if (item.type === "range") {
      const wrap = el("div", "set-range");
      const range = el("input");
      range.type = "range";
      range.min = String(item.min);
      range.max = String(item.max);
      range.step = String(item.step || 1);
      range.value = String(value);
      range.setAttribute("aria-label", item.label);
      const out = el("span", "set-value", `${value}${item.suffix || ""}`);
      range.addEventListener("input", () => {
        out.textContent = `${range.value}${item.suffix || ""}`;
        commitSetting(item.key, Number(range.value));
      });
      wrap.append(range, out);
      control.append(wrap);
    } else {
      const input = el("input", "set-text");
      input.type = "text";
      input.value = String(value || "");
      input.placeholder = item.placeholder || "";
      input.setAttribute("aria-label", item.label);
      input.addEventListener("change", () => commitSetting(item.key, input.value.trim()));
      control.append(input);
    }

    row.append(copy, control);
    return row;
  }

  function buildAboutGroup() {
    const group = el("section", "set-group");
    group.append(el("h2", "", "About this build"), el("p", "set-note", "1.3 BETA — a local preview build. 1.2 BETA is still the published Test Phase release."));

    [
      ["Build", `${VERSION} · build ${BUILD}`],
      ["Channel", "1.3 BETA · local preview"],
      ["Published", "1.2 BETA · GitHub Pages"],
      ["Renderer", isDesktop() ? "Electron shell" : "Browser"],
      ["Engines", `${window.PretzelAI ? window.PretzelAI.fighterCount : 19} fighters · 3 personas`],
      ["Catalog", `${state.games.length} games`],
      ["Credits", "Pretzel · Krillekz · Raevik · LuxLoop · Kyrtop"]
    ].forEach(([key, value]) => {
      const row = el("div", "set-row");
      const copy = el("div", "set-copy");
      copy.append(el("span", "set-label", key));
      const control = el("div", "set-control");
      control.append(el("span", "set-value", value));
      row.append(copy, control);
      group.append(row);
    });

    return group;
  }

  /* The settings file is a trust boundary: it is user-supplied, and the shell
     reloads straight after a successful import. So every key is checked
     against the schema and coerced to its default's type, unknown keys are
     dropped, and a file with nothing recognisable is refused instead of
     being written. Old exports (a bare settings object) still import. */
  function readSettingsBundle(raw) {
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "That file is not valid JSON." };
    }

    const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    if (!source) return { ok: false, error: "That file does not contain settings." };

    const incoming =
      source.settings && typeof source.settings === "object" && !Array.isArray(source.settings)
        ? source.settings
        : source;
    const defaults = PretzelSettings.DEFAULTS;
    const patch = {};

    Object.keys(defaults).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(incoming, key)) return;
      const fallback = defaults[key];
      const value = incoming[key];
      if (typeof fallback === "number") {
        const next = Number(value);
        if (Number.isFinite(next)) patch[key] = next;
      } else if (typeof fallback === "boolean") {
        patch[key] = value === true || value === "true" || value === 1;
      } else if (typeof fallback === "string") {
        patch[key] = String(value).slice(0, 400);
      }
    });

    if (incoming.aiWeights && typeof incoming.aiWeights === "object") {
      const weights = { ...defaults.aiWeights };
      Object.keys(weights).forEach((key) => {
        const next = Number(incoming.aiWeights[key]);
        if (Number.isFinite(next)) weights[key] = Math.min(100, Math.max(0, next));
      });
      patch.aiWeights = weights;
    }

    const keys = Object.keys(patch);
    if (!keys.length) return { ok: false, error: "No known settings in that file." };
    return { ok: true, patch, keys };
  }

  function useLocalGateway() {
    PretzelSettings.save({
      proxyEndpoint: LOCAL_GATEWAY.endpoint,
      proxyHealth: LOCAL_GATEWAY.health,
      proxyToken: ""
    });
    applySettingsRuntime();
    renderSettings();
    probeProxy();
    toast("Local gateway set — start it with: node tools/proxy-dev.js");
    log("event", `Proxy preset → ${LOCAL_GATEWAY.endpoint}`);
  }

  /* Newest first. Kept in the app so the Patch notes tab works offline, like
     the persona engines. */
  const PATCHES = [
    {
      version: "v1.3.1-beta",
      date: "30 Oct 2026",
      tag: "Published · BETA",
      current: true,
      summary: "“The AI Rehaul” — the debate matrix rebuilt with 66 sheets and real interaction rules, plus four new personas in place of the two that were retired.",
      points: [
        "Anime Debate Matrix: 19 curated sheets became 66 across 30 series, and every matchup now runs through a 20-rule interaction matrix instead of a flat stat comparison.",
        "The matchup report grew up: headline call, stat edge, ability interactions, round-by-round read, win conditions for both sides, difficulty rating and an auditable score breakdown.",
        "New debate commands — “A vs B vs C” ranks a battle royale, plus “tier list”, “top 10”, “random” and a series roster such as “Naruto roster”.",
        "Normal — plain conversation with no persona: questions, a real arithmetic evaluator, planning help, jokes, and an honest “I don't know” instead of invented facts.",
        "Spicy · 18+ — flirty banter and adult humour behind a one-time age gate, with a hard stop on explicit content and an instant dial-down if you ask.",
        "Roast Pit — playful roasting, a comeback generator and backhanded hype. It targets what you do, never who you are, and backs off if it lands badly.",
        "Conspiracy Corner — absurd theories with total confidence and zero evidence, on any topic, with an “is this true” escape hatch that breaks character.",
        "Academic Assistant and Pretzel Chef are retired. The persona list and the Settings default now offer the five current engines only."
      ],
      fixes: [
        "A saved default persona that no longer exists would have left the panel on a dead engine; the shell now falls back to the debate matrix, and an unconfirmed Spicy default falls back to Normal instead of opening the age gate at launch.",
        "Settings → Reset all re-arms the 18+ gate, so a shared machine cannot stay unlocked simply because it was confirmed once.",
        "The age gate is a tone check stored per browser, and the dialog says so — it is not authentication and does not pretend to be."
      ]
    },
    {
      version: "v1.3.0-beta",
      date: "30 Oct 2026",
      tag: "Previous · BETA",
      current: false,
      summary: "40 new games, a New shelf, one-tap genre chips and a catalog that pages. Published to GitHub Pages as 1.3 BETA.",
      points: [
        "The catalog grew from 16 titles to 56 across 12 genres. Every URL was checked for HTTP status and for `X-Frame-Options` / `frame-ancestors` before it went in, so no entry is a guess.",
        "A New shelf above Continue lists what arrived in this build, and those cards carry a small New flag on the cover.",
        "Quick genre chips sit above the catalog — one tap filters, the filter rail and the chips stay in sync, and the counts on both follow the catalog.",
        "The catalog renders 24 cards at a time with a Show more button and a Showing X of Y line. Filtering, searching or changing the sort starts the list over at page one.",
        "Cover art takes its glow from a hash of the game id, so 56 cards read as distinct tiles instead of one repeated placeholder.",
        "Time in frame pauses whenever the window is hidden or loses focus, so a background tab or a minimised window stops inflating launch totals.",
        "Suggestion bundles — the admin inbox imports another device's exported JSON, merges by id and skips anything already here, with a count for what it skipped.",
        "Every export now carries a format marker and bundle version, so a file that is not a suggestion bundle is rejected instead of half-imported.",
        "Tab is trapped inside the command palette; focus no longer walks into the page behind the dialog.",
        "Settings backups you can trust — Export writes a versioned bundle, and Import now validates every key against the schema before writing, instead of storing whatever JSON the file happened to contain.",
        "One-click local gateway — Settings → Proxy has a Use local dev gateway preset that points at tools/proxy-dev.js with the ?url= contract it actually expects."
      ],
      fixes: [
        "The ribbon and the intro sheet still described this build as local and unpublished after it went live on GitHub Pages; both now describe the published 1.3 build, and the build tag reads b15.",
        "Shelf kickers ran 02, 03, 04 across three shelves and went out of order once a fourth was added. The New shelf takes 02 and the rest shift, so the numbering reads in sequence again.",
        "Loading a needs-proxy title directly no longer re-records the launch or restarts the clock when the clock happened to be paused.",
        "The clock is derived from accumulated visible time instead of a single start stamp, so a window that is hidden and restored no longer counts the hidden gap.",
        "The proxy preset ships the ?url= placeholder the bundled dev gateway needs; the old advice of pasting a bare origin would have produced URLs the gateway rejects.",
        "Importing settings used to save the parsed file verbatim and reload, so a stray key, a string where a number belonged or a non-object file went straight into storage. It is now filtered to known keys and coerced to their default types.",
        "The import file picker is cleared after a choice, so re-selecting the same file still fires and a failed import can be retried.",
        "The settings export is a named, versioned bundle and no longer called pretzel-v11-settings.json."
      ]
    },
    {
      version: "v1.2.0-beta",
      date: "30 Oct 2026",
      tag: "Published · Test Phase",
      current: false,
      summary: "1.2 BETA goes public. The deck replaces the old dock shell, with suggestions, the admin inbox, tabbed settings and build visibility.",
      points: [
        "The command deck, inspector workflow, shelves, palette, focus mode and hash routing are now the default shell instead of the old left dock.",
        "Suggestions — a public form for ideas, bug reports, game requests and other, with an optional name and build stamp.",
        "Admin inbox — password-gated, with search, status and category filters, stats, sorting, free-text replies, JSON export and cleanup.",
        "Oversized, randomly colored admin updates on the public card, for status changes and replies alike.",
        "Tabbed settings — 43 rows across nine tabs, one section at a time, with About and Patch notes as their own tabs.",
        "Pinned and Continue shelves, launch counts, grid/list views and the Ctrl/Cmd+K command palette.",
        "Build tag in the deck chip and the status strip, now reading 1.2 BETA.",
        "Desktop shell — the same app runs as PretzelGames.exe, with the offline cache and panic cloak carried into the new layout."
      ],
      fixes: [
        "The stylesheet's font URLs pointed at the parent folder; they now resolve from css/, so the display face loads instead of falling back to system fonts.",
        "The service worker still listed the old v0.1 stylesheets, so an offline load of the deck would have come back unstyled. Its shell list now matches the new files.",
        "Diagnostics lost the renderer and cache rows in the swap; both are back, so the Electron shell and offline state stay visible.",
        "The panic cloak only existed in the old shell and would have disappeared with it; the hotkey and overlay are restored.",
        "Deck copy still said local-only and not on GitHub, and the page title still said v1.1; both now read as the published 1.2 BETA build."
      ]
    },
    {
      version: "v1.1.2-test",
      date: "29 Oct 2026",
      tag: "Previous · local",
      current: false,
      summary: "Admin replies, inbox stats and filters, and huge randomly colored public updates. Still local.",
      points: [
        "Admin replies — free text up to 600 characters, editable, copyable and clearable.",
        "Public update banner — the status or reply in huge display type with a stored random accent color.",
        "Inbox stats, status and category filters, and newest/oldest/recently-updated sorting.",
        "Updated suggestions jump to the top of the public list so a reply is not buried."
      ],
      fixes: [
        "Every status change now stamps the update time and a fresh accent, so the public card cannot change silently.",
        "Replies are trimmed and capped; a failed localStorage write rolls the suggestion back instead of showing an unsaved reply.",
        "Clearing a reply removes the public banner while the status is still New, instead of leaving an empty update.",
        "The admin count and empty state follow the filtered set, and the stats strip recalculates after every action."
      ]
    },
    {
      version: "v1.1.1-test",
      date: "29 Oct 2026",
      tag: "Previous · local",
      current: false,
      summary: "Suggestions with a password-gated admin inbox, plus a bug-fix pass from the v1.1 scan. Still local.",
      points: [
        "Suggestions panel — public form with Idea, Bug report, Game request and Other, an optional name and build info.",
        "Admin inbox — password-gated, with search, status filters, status updates, copy, export and delete.",
        "Submissions are stored per browser; the public side lists only what this device sent, while the inbox reads them all.",
        "Patch notes now split each release into changes and bug fixes."
      ],
      fixes: [
        "The six-panel deck no longer overflows horizontally: the brand tag and palette label collapse below 1520px, and the primary nav becomes labelled icons at 1280px.",
        "A proxy-flagged title no longer counts as a launch or starts the play clock while it is blocked. Loading it directly now records that launch.",
        "The sixth panel is included in the 1–6 panel hotkeys and the subbar hint, instead of falling back to the diagnostics text.",
        "The admin header's New/Planned/Done counts now rebuild after every status change and delete, so they cannot go stale.",
        "The Suggestions tab keeps its last view when you leave and return, but the inbox stays hidden and unrendered while locked.",
        "The build tag now also sits in the status strip, so it stays visible when the deck chip collapses under 1120px. It now shows the tag directly instead of an accidental bt prefix.",
        "The icon-only Roll a game button now has an accessible name at narrow widths.",
        "The command palette input now has an accessible name instead of relying on its placeholder."
      ]
    },
    {
      version: "v1.1.0-test",
      date: "29 Oct 2026",
      tag: "Previous · local",
      summary: "The second shell: a command deck, an inspector workflow, shelves and a tabbed settings panel. Not published.",
      points: [
        "New layout — command deck, filter rail, editorial library column, persistent inspector and a player takeover with its own sidebar.",
        "Inspector workflow — one click inspects; the play chip, double-click or Shift+Enter launches.",
        "Pins and a Continue shelf, with launch counts, relative times and time in frame.",
        "Command palette, grid/list view, focus mode and hash routing for every panel and open game.",
        "Settings now open one section at a time, with About and Patch notes as tabs.",
        "This build lives in v1.1/ and is gitignored; the public Test Phase site still serves v0.1.0-alpha."
      ],
      fixes: [
        "The settings rail now switches one panel at a time instead of scrolling a single long page.",
        "Opening a game no longer records the launch twice or reopens the inspector over the player.",
        "Closing a game replaces its history entry, so Back does not reopen it.",
        "The mobile navigation sheet now layers above the scrim, so its links are clickable.",
        "The command deck fits at 1024px after the build chip and status LEDs collapse.",
        "Resize handling no longer stalls when animation frames are throttled; the settings rail orientation and overlay scrim update again.",
        "The intro sheet can be dismissed by its buttons, backdrop and Esc in this Chromium build.",
        "Command-palette backdrop clicks no longer pass through to the page underneath."
      ]
    },
    {
      version: "v0.1.0-alpha",
      date: "29 Oct 2026",
      tag: "Published · Test Phase",
      summary: "The public Test Phase build: 16 verified games, three offline personas, proxy adapters and 36 settings controls.",
      points: [
        "Shell with a game library, AI panel, sandbox browser and lifecycle diagnostics.",
        "Any anime character resolves — curated sheets plus scout estimates that are labelled in play.",
        "Proxy gateways for Vercel and Cloudflare, a local test gateway, and honest block cards.",
        "Build tag (b4) that reads the cache key of the script actually running."
      ],
      fixes: [
        "Library scrolling no longer stalls on the grid.",
        "The game viewport no longer clips in a short window.",
        "Settings no longer opens blank from a stale cached script.",
        "Fighter speed tiers now rank in the right order.",
        "Proxy retry no longer double-wraps an already-proxied URL."
      ]
    },
    {
      version: "Phases 2–3b",
      date: "29 Oct 2026",
      tag: "Build history",
      summary: "How the workspace went from an empty folder to the published Test Phase shell.",
      points: [
        "Phase 2 — static shell, catalog renderer, tray navigation and diagnostics.",
        "Phase 3 — three persona engines, weighted matchups and 16 frame-verified games.",
        "Phase 3b — proxy tunnel, block handling and health checks."
      ],
      fixes: [
        "Tiles no longer collapse to glyph size when the grid initialises.",
        "The local test proxy no longer binds to port 0 when PORT=0.",
        "Renderer status no longer reports Electron in a plain browser."
      ]
    }
  ];

  function buildPatchNotesGroup() {
    const group = el("section", "set-group patch-notes");
    group.append(
      el("h2", "", "Patch notes"),
      el("p", "set-note", "What changed and when. Test builds stay local until they are promoted.")
    );

    const list = el("ol", "patch-list");
    PATCHES.forEach((patch, index) => {
      const item = el("li", "patch" + (patch.current ? " is-current" : ""));
      if (index === 0) item.classList.add("is-latest");

      const head = el("div", "patch-head");
      head.append(el("strong", "patch-version", patch.version));
      head.append(el("span", "tag" + (patch.current ? " is-accent" : ""), patch.current ? `${patch.tag} · build ${BUILD}` : patch.tag));
      const time = el("time", "patch-date", patch.date);
      time.dateTime = "2026-10-29";
      head.append(time);

      const points = el("ul", "patch-points");
      patch.points.forEach((point) => points.append(el("li", "", point)));

      item.append(head, el("p", "patch-summary", patch.summary), points);

      if (Array.isArray(patch.fixes) && patch.fixes.length) {
        const fixes = el("div", "patch-fixes");
        fixes.append(el("p", "patch-subhead", "Bug fixes"));
        const fixList = el("ul", "patch-points");
        patch.fixes.forEach((fix) => fixList.append(el("li", "", fix)));
        fixes.append(fixList);
        item.append(fixes);
      }

      list.append(item);
    });

    group.append(list);

    const actions = el("div", "set-actions");
    actions.append(el("span", "set-hint", "Earlier build history also lives in Changelog.txt at the project root."));
    group.append(actions);

    return group;
  }

  function settingsErrorCard(error) {
    const group = el("section", "set-group");
    group.append(el("h2", "", "Settings could not render"));
    group.append(el("p", "set-note", String((error && error.message) || error || "Unknown error")));
    const actions = el("div", "set-actions");
    const reset = el("button", "btn ghost", "Reset settings & reload");
    reset.type = "button";
    reset.addEventListener("click", () => {
      PretzelSettings.reset();
      location.reload();
    });
    actions.append(reset);
    group.append(actions);
    return group;
  }

  function selectSettingsTab(id, opts = {}) {
    const tabs = state.settingsTabs || [];
    const tab = tabs.find((entry) => entry.id === id);
    if (!tab) return;

    state.settingsTab = id;
    writeStore("pretzel.v11.settingsTab", id);
    els.settingsBody.scrollTop = 0;

    tabs.forEach((entry) => {
      const on = entry.id === id;
      entry.node.hidden = !on;
      const button = document.getElementById(`settings-tab-${entry.id}`);
      if (!button) return;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-selected", String(on));
      button.tabIndex = on ? 0 : -1;
      if (on) button.scrollIntoView({ block: "nearest", inline: "nearest" });
    });

    if (!opts.silent) log("event", `Settings tab → ${tab.title}`);
  }

  function openSettingsTab(id) {
    navTo("settings");
    selectSettingsTab(id);
  }

  function renderSettings() {
    const genres = [...new Set(state.games.map((game) => game.genre).filter(Boolean))].sort();
    const platforms = [...new Set(state.games.map((game) => game.platform).filter(Boolean))].sort();
    els.settingsBody.replaceChildren();
    els.settingsNav.replaceChildren();

    if (!window.PretzelSettings || !Array.isArray(PretzelSettings.SECTIONS)) {
      els.settingsBody.append(
        settingsErrorCard(new Error("js/settings.js did not load, or the page is holding an old cached copy. Hard-refresh with Ctrl+F5."))
      );
      log("error", "Settings store missing — js/settings.js failed to load");
      return;
    }

    const tabs = [];

    try {
      PretzelSettings.SECTIONS.forEach((section) => {
        const group = el("section", "set-group");
        group.id = `set-${section.id}`;
        group.append(el("h2", "", section.title), el("p", "set-note", section.note));
        section.items.forEach((item) => group.append(buildSettingRow(item, genres, platforms)));

        if (section.id === "proxy") {
          const actions = el("div", "set-actions");
          const test = el("button", "btn ghost", "Test proxy");
          test.type = "button";
          test.addEventListener("click", () => probeProxy());
          const preset = el("button", "btn ghost", "Use local dev gateway");
          preset.type = "button";
          preset.id = "proxy-preset";
          preset.addEventListener("click", useLocalGateway);
          actions.append(test, preset, el("span", "set-hint", "Start it with  node tools/proxy-dev.js  on port 8788."));
          group.append(actions);
        }

        if (section.id === "ai") {
          const actions = el("div", "set-actions");
          const clear = el("button", "btn ghost", "Clear all chat history");
          clear.type = "button";
          clear.addEventListener("click", () => {
            clearHistory();
            renderThread(state.mode);
          });
          actions.append(clear);
          group.append(actions);
        }

        tabs.push({ id: section.id, title: section.title, node: group });
      });

      tabs.push({ id: "about", title: "About", node: buildAboutGroup() });
      tabs.push({ id: "patches", title: "Patch notes", node: buildPatchNotesGroup() });
    } catch (error) {
      console.error(error);
      els.settingsBody.replaceChildren(settingsErrorCard(error));
      log("error", `Settings failed to render — ${error.message}`);
      return;
    }

    state.settingsTabs = tabs;
    const saved = readStore("pretzel.v11.settingsTab", "interface");
    const active = tabs.some((tab) => tab.id === saved) ? saved : tabs[0].id;

    tabs.forEach((tab) => {
      const panelId = `set-${tab.id}`;
      tab.node.id = panelId;
      tab.node.hidden = tab.id !== active;
      tab.node.setAttribute("role", "tabpanel");
      tab.node.setAttribute("aria-labelledby", `settings-tab-${tab.id}`);

      const button = el("button", "");
      button.type = "button";
      button.id = `settings-tab-${tab.id}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(tab.id === active));
      button.setAttribute("aria-controls", panelId);
      button.tabIndex = tab.id === active ? 0 : -1;
      button.classList.toggle("is-on", tab.id === active);
      button.append(el("span", "", tab.title));
      if (tab.id === "patches") button.append(el("span", "tab-flag", "new"));
      button.addEventListener("click", () => selectSettingsTab(tab.id));

      els.settingsNav.append(button);
      els.settingsBody.append(tab.node);
    });

    state.settingsTab = active;
    writeStore("pretzel.v11.settingsTab", active);

    if (!els.settingsBody.querySelector(".set-row")) {
      els.settingsBody.replaceChildren(settingsErrorCard(new Error("The settings schema returned no controls.")));
    }
  }

  /* ------------------------------------------------------------------ */
  /* command palette                                                    */
  /* ------------------------------------------------------------------ */

  const COMMANDS = [
    { id: "go-library", label: "Go to Library", detail: "Panel", glyph: "LI", run: () => navTo("library") },
    { id: "go-ai", label: "Go to AI Panel", detail: "Panel", glyph: "AI", run: () => navTo("ai") },
    { id: "go-browser", label: "Go to Browser", detail: "Panel", glyph: "BR", run: () => navTo("browser") },
    { id: "go-logs", label: "Go to Diagnostics", detail: "Panel", glyph: "DG", run: () => navTo("logs") },
    { id: "go-settings", label: "Go to Settings", detail: "Panel", glyph: "ST", run: () => navTo("settings") },
    { id: "go-suggest", label: "Go to Suggestions", detail: "Panel", glyph: "SG", run: () => navTo("suggest") },
    {
      id: "admin-inbox",
      label: "Open admin inbox",
      detail: "Suggestions",
      glyph: "AD",
      run: () => {
        navTo("suggest");
        selectSuggestTab("admin");
      }
    },
    { id: "random", label: "Roll a random game", detail: "Action", glyph: "🎲", run: () => rollGame() },
    {
      id: "view",
      label: "Toggle grid / list",
      detail: "View",
      glyph: "▤",
      run: () => setView(state.view === "grid" ? "list" : "grid")
    },
    {
      id: "focus",
      label: "Toggle focus mode",
      detail: "Player",
      glyph: "⛶",
      run: () => toggleFocus()
    },
    { id: "copy-log", label: "Copy diagnostics log", detail: "Diagnostics", glyph: "CP", run: () => copyLog() },
    { id: "reset-filters", label: "Reset library filters", detail: "Library", glyph: "RF", run: () => resetFilters() },
    { id: "clear-chat", label: "Clear AI chat history", detail: "AI Panel", glyph: "CH", run: () => clearHistory() },
    { id: "patches", label: "Open patch notes", detail: "Settings", glyph: "PN", run: () => openSettingsTab("patches") },
    {
      id: "whatsnew",
      label: "Open What's new in 1.2",
      detail: "About",
      glyph: "?",
      run: () => openWhatsNew()
    }
  ];

  function paletteMatches(query) {
    const q = query.trim().toLowerCase();
    const games = sortedGames(state.games)
      .filter((game) => {
        if (!q) return true;
        return [game.title, game.genre, game.platform, ...(game.tags || [])].join(" ").toLowerCase().includes(q);
      })
      .slice(0, q ? 8 : 6);
    const commands = COMMANDS.filter((command) => {
      if (!q) return true;
      return (command.label + " " + command.detail).toLowerCase().includes(q);
    });

    const items = [];
    commands.forEach((command) => items.push({ type: "command", command, label: command.label, detail: command.detail, glyph: command.glyph }));
    games.forEach((game) =>
      items.push({
        type: "game",
        game,
        label: game.title,
        detail: `${game.genre || "Game"} · ${game.platform || "HTML5"}`,
        glyph: glyphFor(game.title)
      })
    );
    return items;
  }

  function renderPalette(query) {
    const items = paletteMatches(query);
    state.paletteItems = items;
    state.paletteIndex = 0;
    els.paletteList.replaceChildren();

    if (!items.length) {
      els.paletteList.append(el("div", "palette-empty", "No matches. Try a title, genre or action."));
      els.paletteHint.textContent = "0 results";
      return;
    }

    let section = null;
    items.forEach((item, index) => {
      const heading = item.type === "command" ? "Actions" : "Games";
      if (heading !== section) {
        section = heading;
        els.paletteList.append(el("div", "palette-section", heading));
      }
      const button = el("button", "palette-item" + (index === 0 ? " is-active" : ""));
      button.type = "button";
      button.dataset.index = String(index);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(index === 0));

      const glyph = el("span", "palette-item-glyph", item.glyph);
      const copy = el("span", "palette-item-copy");
      copy.append(el("span", "", item.label), el("small", "", item.detail));
      const kind = el("span", "palette-item-kind", item.type === "command" ? "run" : "open");

      button.append(glyph, copy, kind);
      button.addEventListener("click", () => runPaletteItem(item));
      els.paletteList.append(button);
    });

    els.paletteHint.textContent = `${items.length} result${items.length === 1 ? "" : "s"}`;
  }

  function movePalette(delta) {
    const buttons = $$(".palette-item", els.paletteList);
    if (!buttons.length) return;
    state.paletteIndex = (state.paletteIndex + delta + buttons.length) % buttons.length;
    buttons.forEach((button, index) => {
      const on = index === state.paletteIndex;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-selected", String(on));
      if (on) button.scrollIntoView({ block: "nearest" });
    });
  }

  function runPaletteItem(item) {
    closePalette();
    if (!item) return;
    if (item.type === "game") {
      selectGame(item.game.id);
      openGame(item.game.id);
      return;
    }
    item.command.run();
  }

  function openPalette() {
    state.paletteReturn = document.activeElement;
    els.paletteLayer.hidden = false;
    els.paletteInput.value = "";
    renderPalette("");
    window.setTimeout(() => els.paletteInput.focus(), 20);
    log("event", "Command palette opened");
  }

  function closePalette() {
    if (els.paletteLayer.hidden) return;
    els.paletteLayer.hidden = true;
    if (state.paletteReturn && document.contains(state.paletteReturn)) state.paletteReturn.focus({ preventScroll: true });
    log("event", "Command palette closed");
  }

  const paletteOpen = () => !els.paletteLayer.hidden;

  /* ------------------------------------------------------------------ */
  /* misc actions                                                       */
  /* ------------------------------------------------------------------ */

  function rollGame() {
    const playable = state.games.filter((game) => !game.needsProxy);
    const pool = (playable.length ? playable : state.games).filter((game) => game.id !== state.heroId);
    if (!pool.length) return;
    const next = pool[Math.floor(Math.random() * pool.length)];
    state.heroId = next.id;
    state.selected = next.id;
    renderHero();
    renderCatalog();
    renderInspector();
    els.libMain.scrollTo({ top: 0, behavior: "smooth" });
    log("event", `Rolled hero → ${next.title}`);
    toast(`Tonight's pick: ${next.title}`);
  }

  function copyLog() {      const rows = $$(".log-row", els.log).map((row) => row.textContent.replace(/\s+/g, " ").trim());
    const header = `Pretzel's Unblocked Games: RETURN ${VERSION} · build ${BUILD} · session ${state.session}`;
    copyText([header, ...rows].join("\n"), "Diagnostics copied");
  }

  function openWhatsNew() {
    if (!els.whatsnew.open) els.whatsnew.showModal();
  }

  /* This Chromium build does not dispatch <dialog> close events or honour the
     native Escape/form dismiss, so the sheet is closed explicitly. */
  function closeWhatsNew() {
    writeStore(SEEN_KEY, true);
    if (els.whatsnew.open) els.whatsnew.close();
  }

  function updateSubbarHint() {
    if (state.route === "library") {
      els.subbarHint.textContent = state.game ? "Esc exits focus · F toggles the chrome" : "Click a card to inspect · double-click to play";
      return;
    }
    if (state.route === "ai") {
      els.subbarHint.textContent = "Enter sends · Shift+Enter adds a line";
      return;
    }
    if (state.route === "browser") {
      els.subbarHint.textContent = "Bare domains get https:// · other text becomes a search";
      return;
    }
    if (state.route === "settings") {
      els.subbarHint.textContent = "Changes save immediately · Export to move them";
      return;
    }
    if (state.route === "suggest") {
      els.subbarHint.textContent = "Public form · admin inbox is password-gated";
      return;
    }
    els.subbarHint.textContent = "Every line is timestamped and copyable";
  }

  function updateBreakpoint() {
    const w = window.innerWidth;
    const label = w <= 620 ? "Narrow" : w <= 820 ? "Compact" : w <= 1180 ? "Standard" : "Wide";
    els.diagBreakpoint.textContent = `${label} · ${w}px`;
    if (els.settingsNav) {
      els.settingsNav.setAttribute("aria-orientation", w <= 820 ? "horizontal" : "vertical");
    }
  }

  /* ------------------------------------------------------------------ */
  /* element cache                                                      */
  /* ------------------------------------------------------------------ */

  function cacheEls() {
    els.ribbon = $(".ribbon");
    els.crumb = $("#crumb");
    els.buildChip = $("#build-chip");
    els.menuOpen = $("#menu-open");
    els.scrim = $("#scrim");
    els.ledAi = $("#led-ai");
    els.ledProxy = $("#led-proxy");
    els.ledGames = $("#led-games");
    els.ledGamesCount = $("#led-games-count");
    els.subbarHint = $("#subbar-hint");

    els.panelLibrary = $("#panel-library");
    els.panelAi = $("#panel-ai");
    els.libMain = $("#lib-main");
    els.rail = $("#rail");
    els.railGenre = $("#rail-genre");
    els.railPlatform = $("#rail-platform");
    els.filterProxy = $("#filter-proxy");
    els.search = $("#lib-search");
    els.sort = $("#sort-select");
    els.viewGrid = $("#view-grid");
    els.viewList = $("#view-list");
    els.grid = $("#lib-grid");
    els.count = $("#lib-count");

    els.heroTitle = $("#hero-title");
    els.heroSub = $("#hero-sub");
    els.heroGlyph = $("#hero-glyph");
    els.heroTags = $("#hero-tags");
    els.heroPlay = $("#hero-play");
    els.heroPin = $("#hero-pin");
    els.heroDetails = $("#hero-details");

    els.chips = $("#genre-chips");
    els.shelfNew = $("#shelf-new");
    els.newRow = $("#new-row");
    els.newMeta = $("#new-meta");

    els.shelfContinue = $("#shelf-continue");
    els.continueRow = $("#continue-row");
    els.continueMeta = $("#continue-meta");
    els.shelfPinned = $("#shelf-pinned");
    els.pinnedRow = $("#pinned-row");
    els.pinnedMeta = $("#pinned-meta");

    els.inspector = $("#inspector");
    els.inspectorBody = $("#inspector-body");

    els.player = $("#player");
    els.playerSideTitle = $("#player-side-title");
    els.playerSideTags = $("#player-side-tags");
    els.playerFacts = $("#player-facts");
    els.playerPin = $("#player-pin");
    els.playerNext = $("#player-next");
    els.playerTime = $("#player-time");
    els.frameTitle = $("#frame-title");
    els.frameUrl = $("#frame-url");
    els.gameFrame = $("#game-frame");
    els.frameBadge = $("#frame-badge");
    els.frameNotice = $("#frame-notice");
    els.frameNoticeCopy = $("#frame-notice-copy");

    els.chat = $("#chat-log");
    els.chatInput = $("#chat-input");
    els.chatForm = $("#chat-form");
    els.aiModeLabel = $("#ai-mode-label");
    els.agegate = $("#agegate");
    els.aiNoteTitle = $("#ai-note-title");
    els.aiNoteCopy = $("#ai-note-copy");

    els.browserFrame = $("#browser-frame");
    els.browserEmpty = $("#browser-empty");
    els.blockPanel = $("#block-panel");
    els.blockHost = $("#block-host");
    els.blockNote = $("#block-note");
    els.addrHint = $("#addr-hint");
    els.addrHintText = $("#addr-hint-text");
    els.addrInput = $("#addr-input");

    els.log = $("#diag-log");
    els.diagSession = $("#diag-session");
    els.diagBreakpoint = $("#diag-breakpoint");
    els.diagGames = $("#diag-games");
    els.diagProxy = $("#diag-proxy");
    els.diagStorage = $("#diag-storage");
    els.diagPins = $("#diag-pins");
    els.diagRenderer = $("#diag-renderer");
    els.diagOffline = $("#diag-offline");
    els.cloak = $("#cloak");

    els.settingsBody = $("#settings-body");
    els.settingsNav = $("#settings-nav");
    els.settingsFile = $("#settings-file");

    els.suggestCount = $("#suggest-count");
    els.suggestTabs = $(".suggest-tabs");
    els.suggestTabSend = $("#suggest-tab-send");
    els.suggestTabAdmin = $("#suggest-tab-admin");
    els.suggestSend = $("#suggest-send");
    els.suggestAdmin = $("#suggest-admin");
    els.suggestForm = $("#suggest-form");
    els.suggestCats = $("#suggest-cats");
    els.suggestMessage = $("#suggest-message");
    els.suggestChars = $("#suggest-chars");
    els.suggestName = $("#suggest-name");
    els.suggestIncludeBuild = $("#suggest-include-build");
    els.suggestError = $("#suggest-error");
    els.suggestSent = $("#suggest-sent");
    els.suggestSentRef = $("#suggest-sent-ref");
    els.suggestAgain = $("#suggest-again");
    els.suggestMineNote = $("#suggest-mine-note");
    els.suggestMineList = $("#suggest-mine-list");
    els.adminGate = $("#admin-gate");
    els.adminInbox = $("#admin-inbox");
    els.adminForm = $("#admin-form");
    els.adminPassword = $("#admin-password");
    els.adminError = $("#admin-error");
    els.adminCount = $("#admin-count");
    els.adminSummary = $("#admin-summary");
    els.adminStats = $("#admin-stats");
    els.adminSearch = $("#admin-search");
    els.adminFilter = $("#admin-filter");
    els.adminCategory = $("#admin-category");
    els.adminSort = $("#admin-sort");
    els.adminList = $("#admin-list");
    els.adminExport = $("#admin-export");
    els.adminImport = $("#admin-import");
    els.adminImportBtn = $("#admin-import-btn");
    els.adminClear = $("#admin-clear");
    els.adminLock = $("#admin-lock");

    els.paletteLayer = $("#palette-layer");
    els.paletteInput = $("#palette-input");
    els.paletteList = $("#palette-list");
    els.paletteHint = $("#palette-hint");

    els.toasts = $("#toasts");
    els.whatsnew = $("#whatsnew");

    els.statPins = $("#stat-pins");
    els.statPlays = $("#stat-plays");
    els.statCatalog = $("#stat-catalog");

    els.sbSession = $("#sb-session");
    els.sbBuild = $("#sb-build");
    els.sbRoute = $("#sb-route");
    els.sbCatalog = $("#sb-catalog");
    els.sbProxy = $("#sb-proxy");
    els.sbClock = $("#sb-clock");
  }

  /* ------------------------------------------------------------------ */
  /* wiring                                                             */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* desktop shell, panic cloak and offline cache                       */
  /* ------------------------------------------------------------------ */

  function isDesktop() {
    return Boolean(window.pretzelShell && window.pretzelShell.isDesktop === true);
  }

  function toggleCloak(force) {
    const next = typeof force === "boolean" ? force : !state.cloaked;
    if (next === state.cloaked) return state.cloaked;
    state.cloaked = next;

    if (next) {
      state.savedTitle = document.title;
      document.title = "Untitled document";
      if (els.cloak) els.cloak.hidden = false;
      document.body.classList.add("is-cloaked");
      log("warn", "Panic cloak engaged — Ctrl/Cmd+Shift+H restores the shell");
    } else {
      document.title = state.savedTitle || document.title;
      if (els.cloak) els.cloak.hidden = true;
      document.body.classList.remove("is-cloaked");
      log("event", "Panic cloak released");
    }
    return state.cloaked;
  }

  /* A new worker claims the page mid-session, so the markup and the engine can
     briefly disagree (new persona list, old personas). Reload once, after the
     new controller takes over, so a returning visitor cannot run a mixed build. */
  function watchWorkerUpdates() {
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      log("info", "New offline cache active — reloading for a clean build");
      window.location.reload();
    });
  }

  async function registerOfflineCache() {
    if (!("serviceWorker" in navigator)) {
      state.offlineCache = "unsupported";
      log("warn", "Offline cache unavailable — this browser has no service worker support");
      return;
    }
    watchWorkerUpdates();
    try {
      const registration = await navigator.serviceWorker.register("sw.js");
      state.offlineCache = registration.active ? "ready" : "installing";
      if (els.diagOffline) els.diagOffline.textContent = state.offlineCache;
      log("event", `Offline cache ${state.offlineCache} — scope ${registration.scope}`);
      navigator.serviceWorker.ready
        .then(() => {
          state.offlineCache = "ready";
          if (els.diagOffline) els.diagOffline.textContent = state.offlineCache;
          log("info", "Offline cache ready — the shell opens without a connection");
        })
        .catch(() => {});
    } catch (error) {
      state.offlineCache = "failed";
      if (els.diagOffline) els.diagOffline.textContent = state.offlineCache;
      log("warn", `Offline cache failed to register — ${error.message}`);
    }
  }

  function wireEvents() {
    /* Scoped to the deck: <body> also carries data-route for styling, and a
       body-level handler would re-run the route on every click. */
    $$(".deck [data-route]").forEach((btn) => btn.addEventListener("click", () => navTo(btn.dataset.route)));
    els.menuOpen.addEventListener("click", toggleMenu);
    els.scrim.addEventListener("click", () => {
      closeMenu({ silent: true });
      closeInspector();
    });
    $("#palette-open").addEventListener("click", openPalette);
    $("#whatsnew-open").addEventListener("click", openWhatsNew);
    $("#whatsnew-close").addEventListener("click", closeWhatsNew);
    $("#whatsnew-dismiss").addEventListener("click", closeWhatsNew);
    $("#whatsnew-patches").addEventListener("click", () => {
      closeWhatsNew();
      openSettingsTab("patches");
    });
    els.whatsnew.addEventListener("click", (event) => {
      if (event.target === els.whatsnew) closeWhatsNew();
    });
    els.whatsnew.addEventListener("close", () => writeStore(SEEN_KEY, true));

    /* subbar */
    $("#random-game").addEventListener("click", rollGame);

    /* library filters */
    els.rail.addEventListener("click", (event) => {
      const item = event.target.closest(".rail-item");
      if (!item) return;
      setFilter(item.dataset.group, item.dataset.value);
    });
    els.filterProxy.addEventListener("click", () => {
      state.filters.proxyOnly = !state.filters.proxyOnly;
      updateRailCounts();
      renderCatalog();
      log("event", `Proxy filter ${state.filters.proxyOnly ? "on" : "off"}`);
    });
    $("#rail-clear").addEventListener("click", resetFilters);

    els.search.addEventListener("input", () => {
      state.filters.q = els.search.value.trim().toLowerCase();
      renderCatalog();
    });

    els.sort.addEventListener("change", () => {
      state.sort = els.sort.value;
      PretzelSettings.save({ sort: state.sort });
      renderCatalog();
      log("event", `Sort → ${state.sort}`);
    });

    els.viewGrid.addEventListener("click", () => setView("grid"));
    els.viewList.addEventListener("click", () => setView("list"));

    els.grid.addEventListener("click", (event) => {
      if (event.target.closest("#catalog-more")) {
        const previous = $$(".card", els.grid).length;
        state.shown += PAGE_SIZE;
        renderCatalog();
        const cards = $$(".card", els.grid);
        const next = cards[Math.min(previous, cards.length - 1)];
        if (next) {
          next.focus({ preventScroll: true });
          next.scrollIntoView({ block: "nearest" });
        }
        return;
      }
      if (event.target.closest(".card-play")) return;
      const card = event.target.closest(".card");
      if (card) selectGame(card.dataset.game);
    });

    els.chips.addEventListener("click", (event) => {
      const chip = event.target.closest(".chip-filter");
      if (chip) setFilter("genre", chip.dataset.genre);
    });

    els.grid.addEventListener("dblclick", (event) => {
      const card = event.target.closest(".card");
      if (card && !event.target.closest(".card-play")) openGame(card.dataset.game);
    });

    els.grid.addEventListener("keydown", (event) => {
      const card = event.target.closest(".card");
      if (!card) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "ArrowUp") {
        const cards = $$(".card", els.grid);
        const index = cards.indexOf(card);
        const columns = getComputedStyle(els.grid).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
        const steps = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
        const next = Math.min(cards.length - 1, Math.max(0, index + steps[event.key]));
        if (next !== index) {
          event.preventDefault();
          cards[next].focus({ preventScroll: true });
          cards[next].scrollIntoView({ block: "nearest" });
        }
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openGame(card.dataset.game);
      }
    });

    /* shelves */
    els.continueRow.addEventListener("click", (event) => {
      const card = event.target.closest("[data-game]");
      if (card) openGame(card.dataset.game);
    });
    els.pinnedRow.addEventListener("click", (event) => {
      const card = event.target.closest("[data-game]");
      if (card) openGame(card.dataset.game);
    });

    /* hero */
    els.heroPlay.addEventListener("click", () => {
      const game = heroGame();
      if (game) openGame(game.id);
    });
    els.heroDetails.addEventListener("click", () => {
      const game = heroGame();
      if (!game) return;
      selectGame(game.id);
      els.libMain.scrollTo({ top: 0, behavior: "smooth" });
    });
    els.heroPin.addEventListener("click", () => {
      const game = heroGame();
      if (game) togglePin(game.id);
    });

    /* inspector + player */
    $("#inspector-close").addEventListener("click", closeInspector);

    $("#frame-close").addEventListener("click", requestClose);
    $("#frame-exit").addEventListener("click", requestClose);
    $("#frame-refresh").addEventListener("click", refreshGame);
    $("#frame-focus").addEventListener("click", () => toggleFocus());
    $("#frame-direct").addEventListener("click", loadDirect);
    $("#player-pin").addEventListener("click", () => state.game && togglePin(state.game.id));
    $("#player-copy").addEventListener("click", () => state.game && copyText(state.game.url, "Game link copied"));
    $("#player-external").addEventListener("click", () => state.game && openExternal(state.game.url));

    /* AI */
    $$(".mode").forEach((btn) => btn.addEventListener("click", () => setMode(btn.dataset.mode)));

    if (els.agegate) {
      $("#agegate-confirm").addEventListener("click", () => {
        writeStore(AGE_KEY, true);
        closeAgeGate();
        const mode = pendingMode || "spicy";
        pendingMode = null;
        setMode(mode, { force: true });
        toast("Adult mode unlocked for this browser");
      });
      $("#agegate-cancel").addEventListener("click", () => {
        pendingMode = null;
        closeAgeGate();
        toast("Stayed on the safe side");
      });
      $("#agegate-close").addEventListener("click", () => {
        pendingMode = null;
        closeAgeGate();
      });
      els.agegate.addEventListener("cancel", (event) => {
        event.preventDefault();
        pendingMode = null;
        closeAgeGate();
      });
    }
    els.chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      sendChat();
    });
    els.chatInput.addEventListener("input", autoGrow);
    els.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChat();
      }
    });
    $("#ai-clear").addEventListener("click", clearHistory);

    /* browser */
    $("#addr-form").addEventListener("submit", (event) => {
      event.preventDefault();
      openAddress(els.addrInput.value);
    });
    $("#block-proxy").addEventListener("click", retryViaProxy);
    $("#block-external").addEventListener("click", () => openExternal(state.blockedUrl || state.browserUrl));
    $("#block-manual").addEventListener("click", () => {
      if (!state.browserUrl) {
        setHint("Load a destination first, then report a block.", true);
        return;
      }
      showBlock(state.browserUrl, "Marked by hand — the host refused to render inside the frame.");
      log("warn", `Block reported manually → ${hostOf(state.browserUrl)}`);
    });
    $("#browser-clear").addEventListener("click", unloadBrowser);
    $("#browser-home").addEventListener("click", () => {
      const home = String(PretzelSettings.get().homeUrl || "").trim();
      if (!home) {
        setHint("No home destination set — add one in Settings → Browser.", true);
        return;
      }
      els.addrInput.value = home;
      openAddress(home);
    });
    $$(".quick").forEach((button) =>
      button.addEventListener("click", () => {
        els.addrInput.value = button.dataset.url;
        openAddress(button.dataset.url);
      })
    );
    els.browserFrame.addEventListener("load", () => {
      window.clearTimeout(state.watchdog);
      const src = els.browserFrame.getAttribute("src") || "";
      if (!src || src === "about:blank") return;
      log("event", `Frame load event ← ${hostOf(src)}`);
    });

    /* logs + settings */
    $("#diag-proxy-test").addEventListener("click", () => probeProxy());
    $("#diag-copy").addEventListener("click", copyLog);
    $("#diag-clear").addEventListener("click", () => {
      els.log.replaceChildren();
      log("info", "Diagnostic log cleared");
      toast("Log cleared");
    });

    els.settingsNav.addEventListener("keydown", (event) => {
      const tabs = state.settingsTabs || [];
      if (!tabs.length) return;
      const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();

      let index = tabs.findIndex((tab) => tab.id === state.settingsTab);
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = tabs.length - 1;
      else {
        const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        index = (index + step + tabs.length) % tabs.length;
      }

      selectSettingsTab(tabs[index].id);
      const button = document.getElementById(`settings-tab-${tabs[index].id}`);
      if (button) button.focus();
    });

    $("#settings-export").addEventListener("click", () => {
      const payload = {
        format: "pretzel-settings",
        version: 2,
        exportedAt: new Date().toISOString(),
        build: `${VERSION} · ${BUILD}`,
        settings: PretzelSettings.get()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "pretzel-settings.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1500);
      log("event", "Settings exported");
      toast("Settings exported");
    });
    $("#settings-import").addEventListener("click", () => els.settingsFile.click());
    els.settingsFile.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      els.settingsFile.value = "";
      if (!file) return;

      let raw = "";
      try {
        raw = await file.text();
      } catch (error) {
        log("error", `Settings import failed — ${error.message}`);
        toast("That file could not be read", "error");
        return;
      }

      const result = readSettingsBundle(raw);
      if (!result.ok) {
        log("error", `Settings import failed — ${result.error}`);
        toast(result.error, "error");
        return;
      }

      PretzelSettings.save(result.patch);
      log("event", `Settings imported · ${result.keys.length} keys`);
      toast(`Imported ${result.keys.length} settings — reloading`);
      location.reload();
    });
    $("#settings-reset").addEventListener("click", () => {
      if (!window.confirm("Reset every setting to its default and reload?")) return;
      PretzelSettings.reset();
      /* Defaults include the safe start, so the adult gate is re-armed too. */
      writeStore(AGE_KEY, false);
      log("warn", "Settings restored to defaults");
      toast("Defaults restored — reloading");
      location.reload();
    });

    /* suggestions */
    els.suggestForm.addEventListener("submit", submitSuggestion);
    els.suggestCats.addEventListener("click", (event) => {
      const chip = event.target.closest(".chip");
      if (chip) setSuggestCategory(chip.dataset.cat);
    });
    els.suggestMessage.addEventListener("input", () => {
      updateSuggestChars();
      if (els.suggestError.textContent) setSuggestError("");
    });
    els.suggestAgain.addEventListener("click", () => {
      els.suggestSent.hidden = true;
      els.suggestMessage.focus();
    });
    els.suggestTabSend.addEventListener("click", () => selectSuggestTab("send"));
    els.suggestTabAdmin.addEventListener("click", () => selectSuggestTab("admin"));
    [els.suggestTabSend, els.suggestTabAdmin].forEach((tab) => {
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next =
          event.key === "Home" ? "send" : event.key === "End" ? "admin" : state.suggestTab === "send" ? "admin" : "send";
        selectSuggestTab(next);
        document.getElementById(`suggest-tab-${next}`).focus();
      });
    });
    els.adminForm.addEventListener("submit", unlockAdmin);
    els.adminPassword.addEventListener("input", () => {
      if (els.adminError.textContent) setAdminError("");
    });
    els.adminSearch.addEventListener("input", () => {
      state.adminQuery = els.adminSearch.value;
      renderAdminList();
    });
    els.adminFilter.addEventListener("change", () => {
      state.adminFilter = els.adminFilter.value;
      renderAdminList();
    });
    els.adminCategory.addEventListener("change", () => {
      state.adminCategory = els.adminCategory.value;
      renderAdminList();
    });
    els.adminSort.addEventListener("change", () => {
      state.adminSort = els.adminSort.value;
      renderAdminList();
    });
    els.adminExport.addEventListener("click", exportSuggestions);
    els.adminImportBtn.addEventListener("click", () => els.adminImport.click());
    els.adminImport.addEventListener("change", () => {
      const chosen = els.adminImport.files && els.adminImport.files[0];
      importSuggestionsFile(chosen);
      els.adminImport.value = "";
    });
    els.adminClear.addEventListener("click", clearSuggestions);
    els.adminLock.addEventListener("click", lockAdmin);

    /* palette */
    els.paletteInput.addEventListener("input", () => renderPalette(els.paletteInput.value));
    els.paletteInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        movePalette(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        movePalette(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        runPaletteItem(state.paletteItems[state.paletteIndex]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePalette();
      }
    });
    els.paletteLayer.addEventListener("click", (event) => {
      if (event.target === els.paletteLayer) closePalette();
    });
    /* keep Tab inside the dialog — arrow keys move the list, Esc closes it */
    els.paletteLayer.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || !paletteOpen()) return;
      const focusables = [els.paletteInput, ...$$(".palette-item", els.paletteList)].filter(
        (node) => node && !node.disabled && node.offsetParent !== null
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = els.paletteLayer.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    });

    if (window.pretzelShell && typeof window.pretzelShell.onStealthToggle === "function") {
      window.pretzelShell.onStealthToggle(() => toggleCloak());
    }

    /* play clock pauses while the page is hidden */
    document.addEventListener("visibilitychange", syncPlayClock);

    /* keyboard */
    document.addEventListener("keydown", (event) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.matches("input, textarea, select") || event.target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        toggleCloak();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        paletteOpen() ? closePalette() : openPalette();
        return;
      }

      if (event.key === "Escape") {
        if (els.whatsnew.open) {
          event.preventDefault();
          closeWhatsNew();
          return;
        }
        if (paletteOpen()) {
          closePalette();
          return;
        }
        if ($(".deck-nav").classList.contains("is-open")) {
          closeMenu();
          return;
        }
        if (state.focus) {
          toggleFocus(false);
          return;
        }
        if (els.inspector.classList.contains("is-open") && compact.matches) {
          closeInspector();
          return;
        }
        if (state.selected) {
          state.selected = null;
          renderCatalog();
          renderInspector();
        }
        return;
      }

      if (typing || paletteOpen() || event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key === "/") {
        event.preventDefault();
        if (state.route !== "library") navTo("library");
        els.search.focus();
        els.search.select();
        return;
      }
      if (event.key === "g" || event.key === "G") {
        setView("grid");
        return;
      }
      if (event.key === "l" || event.key === "L") {
        setView("list");
        return;
      }
      if (event.key === "f" || event.key === "F") {
        if (state.game) toggleFocus();
        return;
      }
      if (/^[1-6]$/.test(event.key)) {
        const route = Object.keys(ROUTES)[Number(event.key) - 1];
        if (route) navTo(route);
      }
    });

    /* viewport: timeout, not rAF — a throttled animation frame can stall here */
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        updateBreakpoint();
        if (window.innerWidth > 820) closeMenu({ silent: true });
        syncScrim();
      }, 80);
    });

    window.addEventListener("error", (event) => log("error", event.message || "Uncaught error"));
    window.addEventListener("unhandledrejection", (event) =>
      log("error", `Promise rejection: ${event.reason && event.reason.message ? event.reason.message : event.reason}`)
    );

    window.addEventListener("hashchange", () => {
      /* Ignore the event for a hash this code just set; the state is applied already. */
      if (state.syncingHash && location.hash === state.syncingHash) {
        state.syncingHash = null;
        return;
      }
      const { route, id } = parseHash();
      if (!route) return;
      applyNavigation(route, id, { silent: true });
    });
  }

  /* ------------------------------------------------------------------ */
  /* boot                                                               */
  /* ------------------------------------------------------------------ */

  async function init() {
    cacheEls();
    PretzelSettings.load();
    PretzelSettings.apply();
    state.view = PretzelSettings.get().view === "list" ? "list" : "grid";
    state.sort = PretzelSettings.get().sort;
    state.reverse = Boolean(PretzelSettings.get().reverseSort);

    wireEvents();
    updateBreakpoint();
    setView(state.view, { silent: true });
    syncSortControl();

    els.buildChip.textContent = `${VERSION} · ${BUILD}`;
    els.buildChip.title = `Running the js/app.js build tagged ${BUILD}. A number older than your latest change means a hard refresh is needed.`;

    log("info", `Shell booted — ${VERSION} · build ${BUILD} · session ${state.session}`);
    registerOfflineCache();

    const config = await loadJSON("data/config.json", null);
    if (config) {
      state.fileConfig = config;
      state.config = {
        search: { ...state.config.search, ...(config.search || {}) },
        proxy: { ...state.config.proxy, ...(config.proxy || {}) },
        hotkeys: config.hotkeys || {},
        features: { ...state.config.features, ...(config.features || {}) }
      };
      log("event", `Config loaded · search: ${state.config.search.label} · proxy: ${state.config.proxy.label}`);
    } else {
      log("warn", "Config defaults in use");
    }

    const library = await loadJSON("data/library.json", null);
    if (library && Array.isArray(library.games)) {
      state.games = library.games.filter((game) => game && game.id && game.title && game.url);
      log("event", `Library index loaded · ${state.games.length} games`);
    } else {
      log("error", "Library index missing — the catalog will stay empty");
    }

    loadCollections();
    state.suggestions = loadSuggestions();
    state.adminUnlocked = adminSessionActive();
    applySettingsRuntime();

    const saved = PretzelSettings.get();
    const genres = new Set(state.games.map((game) => game.genre).filter(Boolean));
    const platforms = new Set(state.games.map((game) => game.platform).filter(Boolean));
    state.filters = {
      q: "",
      genre: genres.has(saved.defaultGenre) ? saved.defaultGenre : "all",
      platform: platforms.has(saved.defaultPlatform) ? saved.defaultPlatform : "all",
      proxyOnly: Boolean(saved.proxyOnly)
    };
    state.heroId = pickHero(null) ? pickHero(null).id : null;
    if (!saved.inspector) els.panelLibrary.classList.add("inspector-off");

    renderRail();
    renderHero();
    renderShelves();
    renderCatalog();
    renderInspector();
    renderSettings();
    renderSuggestions();
    updateStats();

    const startMode = saved.aiMode === "spicy" && !adultCleared() ? "normal" : saved.aiMode;
    if (PERSONAS[startMode]) setMode(startMode, { silent: true });
    else renderThread(state.mode);

    const parsed = parseHash();
    const route = parsed.route || startRoute();
    if (parsed.route) applyNavigation(route, parsed.id, { silent: true });
    else {
      state.syncingHash = `#/${route}`;
      location.replace(`#/${route}`);
      applyNavigation(route, null, { silent: true });
    }

    els.sbSession.textContent = state.session;
    els.sbBuild.textContent = BUILD;
    els.sbBuild.title = `${VERSION} · build ${BUILD}`;
    window.setInterval(() => {
      els.sbClock.textContent = new Date().toLocaleTimeString([], { hour12: false });
    }, 1000);
    els.sbClock.textContent = new Date().toLocaleTimeString([], { hour12: false });

    const roster = window.PretzelAI ? window.PretzelAI.fighterCount : 0;
    log("info", `AI engines online · ${roster} fighters · ${state.games.length} games indexed`);
    log("info", "Ctrl+K palette · / search · G/L view · F focus · 1–6 panels");

    if (saved.reopenLast && state.recents.length) {
      const lastId = state.recents[0].id;
      if (gameById(lastId)) openGame(lastId);
    }

    if (proxyConfigured()) probeProxy({ silent: true });
    else {
      state.proxyState = "off";
      updateStats();
    }

    if (!readStore(SEEN_KEY, false)) {
      window.setTimeout(() => {
        if (!els.whatsnew.open) els.whatsnew.showModal();
      }, 700);
    }

    log("info", `1.3 BETA ready · ${VERSION} · ${state.games.length} games · ${state.pins.length} pins`);
    window.__pretzelReady = true;
  }

  init();
})();
