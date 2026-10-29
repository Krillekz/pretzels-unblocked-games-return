/* =====================================================================
   Pretzel's Unblocked Games: RETURN — shell interactions
   Scope: navigation, trays, library grid & viewport controls, AI panel
   transcript, sandbox address parsing, diagnostics log. The persona engines
   live in js/ai.js; the proxy tunnel is still unimplemented.
   ===================================================================== */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const VERSION = "v0.1.0-alpha";
  /* Read from the script tag's cache key, so the tag always tells the truth about
     which copy of app.js is actually running — a stale page shows a stale number. */
  const BUILD = (() => {
    const tag = document.querySelector('script[src*="js/app.js"]');
    const match = tag && String(tag.getAttribute("src") || "").match(/[?&]v=([A-Za-z0-9._-]+)/);
    return match ? match[1] : "dev";
  })();
  const AI_PREFIX = "pretzel.ai.v1.";
  const LEVEL_RANK = { info: 1, event: 1, warn: 2, error: 3 };
  let maxLogRows = 300;
  let logLevelFilter = "all";

  const ROSTER_COUNT = window.PretzelAI ? window.PretzelAI.fighterCount : 19;
  const LAST_GAME_KEY = "pretzel.lastGame";

  const PANEL_LABELS = {
    library: "LIBRARY",
    ai: "AI PANEL",
    browser: "BROWSER",
    diagnostics: "DIAGNOSTICS",
    settings: "SETTINGS"
  };

  const PERSONAS = {
    debate: {
      label: "Anime Debate Matrix",
      greeting: `Matrix loaded — ${ROSTER_COUNT} curated sheets, and any other character gets a scout estimate on the spot. Name two with “vs” for a full breakdown, or one for its stat card.`,
      placeholder: "Goku vs Saitama"
    },
    academic: {
      label: "Academic Assistant",
      greeting:
        "Assistant ready. Ask for an outline or a study plan, or paste a passage for a note pass. I build structure from your material — I never invent facts.",
      placeholder: "Outline an essay on…"
    },
    chef: {
      label: "Pretzel Chef",
      greeting:
        "Yo. Pretzel Chef in the kitchen. Ask for a quick snack, a reset after a rough queue, or a pun — I'll keep it casual.",
      placeholder: "Ask the chef anything…"
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
    aiKeepHistory: true,
    aiAutoScroll: true,
    games: [],
    filters: { q: "", genre: "all", platform: "all", proxyOnly: false },
    activePanel: "library",
    trayName: null,
    mode: "debate",
    game: null,
    gameProxied: false,
    browserUrl: "",
    blockedUrl: "",
    watchdog: 0,
    session: Math.random().toString(16).slice(2, 6).toUpperCase()
  };

  const els = {};
  const compact = window.matchMedia("(max-width: 900px)");

  /* ------------------------------------------------------------------ */
  /* utilities                                                          */
  /* ------------------------------------------------------------------ */

  const stamp = () =>
    new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  function hostOf(url) {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

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
    const row = document.createElement("div");
    row.className = "log-row";
    row.dataset.level = level;

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = stamp();

    const tag = document.createElement("span");
    tag.className = "log-level";
    tag.textContent = level;

    const msg = document.createElement("span");
    msg.className = "log-msg";
    msg.textContent = message;

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
  /* panels & trays                                                     */
  /* ------------------------------------------------------------------ */

  function syncDock() {
    const focus = state.trayName || state.activePanel;
    $$(".dock-btn").forEach((btn) => {
      const on = btn.dataset.nav === focus;
      btn.classList.toggle("is-active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  /* Breadcrumb, dock readout and status LEDs share one source of truth. */
  function syncChrome() {
    const focus = state.trayName || state.activePanel;
    const label = PANEL_LABELS[focus] || focus.toUpperCase();
    els.stageCrumb.textContent = label;
    els.dockStatus.textContent = label;
  }

  function setActivePanel(name, opts = {}) {
    state.activePanel = name;
    $$(".panel").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === name));
    document.body.dataset.panel = name;
    syncChrome();
    syncDock();
    /* Self-heal: never leave an empty Settings panel on screen. */
    if (name === "settings" && els.settingsBody && els.settingsBody.childElementCount === 0) {
      renderSettings();
    }
    if (!opts.silent) log("event", `Panel → ${name}`);
  }

  function openTray(name, opts = {}) {
    state.trayName = name;
    $$(".panel").forEach((panel) => panel.classList.toggle("is-tray-open", panel.dataset.panel === name));
    els.scrim.hidden = false;
    syncChrome();
    syncDock();
    if (!opts.silent) log("event", `Tray open → ${name}`);
    if (name === "ai") scrollChat();
  }

  function closeTray(opts = {}) {
    if (!state.trayName) return;
    const previous = state.trayName;
    state.trayName = null;
    $$(".panel").forEach((panel) => panel.classList.remove("is-tray-open"));
    els.scrim.hidden = true;
    syncChrome();
    syncDock();
    if (!opts.silent) log("event", `Tray closed → ${previous}`);
  }

  function setPanel(name) {
    const isTrayPanel = name === "ai" || name === "diagnostics";
    if (compact.matches && isTrayPanel) {
      if (state.activePanel === name) setActivePanel("library", { silent: true });
      openTray(name);
      return;
    }
    closeTray({ silent: true });
    setActivePanel(name);
  }

  function updateBreakpoint() {
    const w = window.innerWidth;
    const label = w <= 640 ? "Narrow" : w <= 900 ? "Compact" : w <= 1100 ? "Standard" : "Wide";
    els.diagBreakpoint.textContent = `${label} · ${w}px`;
    updateGridScrollState();
  }

  /*
   * Keeps panel state valid for the current width. Runs on every breakpoint
   * change and resize, so a panel is never left active but unreachable when
   * the window crosses 900px.
   */
  function reconcileLayout() {
    if (compact.matches) {
      if (state.activePanel === "ai" || state.activePanel === "diagnostics") {
        const name = state.activePanel;
        setActivePanel("library", { silent: true });
        openTray(name, { silent: true });
      }
      return;
    }
    if (state.trayName) {
      const name = state.trayName;
      closeTray({ silent: true });
      setActivePanel(name);
    }
  }

  function handleBreakpointChange() {
    updateBreakpoint();
    reconcileLayout();
  }

  /* ------------------------------------------------------------------ */
  /* proxy gateway                                                      */
  /* ------------------------------------------------------------------ */

  const proxyEndpoint = () => (state.config.proxy.endpoint || "").trim();
  const proxyConfigured = () => Boolean(proxyEndpoint());

  function isProxiedUrl(url) {
    const endpoint = proxyEndpoint();
    if (!endpoint || !url) return false;
    const base = endpoint.split("{url}")[0];
    return Boolean(base) && url.startsWith(base);
  }

  /* Human-readable host, unwrapping a proxied target when possible. */
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

  async function probeProxy(opts = {}) {
    if (!proxyConfigured()) {
      state.proxyState = "off";
      updateStats();
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
  /* game library                                                       */
  /* ------------------------------------------------------------------ */

  function glyphFor(title) {
    const span = document.createElement("span");
    span.className = "tile-glyph";
    const words = String(title).trim().split(/[\s-]+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : String(title).slice(0, 2);
    span.textContent = letters.toUpperCase();
    return span;
  }

  function makeTile(game) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.dataset.game = game.id;
    tile.title = `Play ${game.title}`;

    const cover = document.createElement("div");
    cover.className = "tile-cover";
    if (game.cover) {
      const img = document.createElement("img");
      img.src = game.cover;
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", () => {
        img.remove();
        cover.append(glyphFor(game.title));
      });
      cover.append(img);
    } else {
      cover.append(glyphFor(game.title));
    }

    const body = document.createElement("div");
    body.className = "tile-body";

    const title = document.createElement("span");
    title.className = "tile-title";
    title.textContent = game.title;

    const meta = document.createElement("div");
    meta.className = "tile-meta";
    [game.genre, game.platform].filter(Boolean).forEach((value) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = value;
      meta.append(tag);
    });
    if (game.needsProxy) {
      const proxy = document.createElement("span");
      proxy.className = "tag is-proxy";
      proxy.textContent = "Proxy";
      meta.append(proxy);
    }

    body.append(title, meta);

    const play = document.createElement("span");
    play.className = "tile-play";
    play.textContent = "Play";
    cover.append(play);

    tile.append(cover, body);
    return tile;
  }

  function emptyState(headline, copy) {
    const box = document.createElement("div");
    box.className = "empty-state";
    const strong = document.createElement("strong");
    strong.textContent = headline;
    const p = document.createElement("p");
    p.textContent = copy;
    box.append(strong, p);
    return box;
  }

  function renderGrid() {
    const { q, genre, platform, proxyOnly } = state.filters;
    const matches = state.games.filter((game) => {
      const haystack = [game.title, ...(game.tags || [])].join(" ").toLowerCase();
      return (
        (!q || haystack.includes(q)) &&
        (genre === "all" || game.genre === genre) &&
        (platform === "all" || game.platform === platform) &&
        (!proxyOnly || game.needsProxy)
      );
    });

    const settings = PretzelSettings.get();
    const sortMode = settings.sort;
    const ordered = [...matches].sort((a, b) => {
      if (sortMode === "genre") {
        return (a.genre || "").localeCompare(b.genre || "") || a.title.localeCompare(b.title);
      }
      if (sortMode === "platform") {
        return (a.platform || "").localeCompare(b.platform || "") || a.title.localeCompare(b.title);
      }
      return a.title.localeCompare(b.title);
    });
    if (settings.reverseSort) ordered.reverse();

    els.grid.replaceChildren();

    if (!state.games.length) {
      els.grid.append(
        emptyState(
          "No games indexed",
          "data/library.json did not load. Serve this folder over http (not file://) so the JSON assets can be fetched."
        )
      );
    } else if (!ordered.length) {
      els.grid.append(emptyState("No matches", "Loosen the filters or clear the search field."));
    } else {
      ordered.forEach((game) => els.grid.append(makeTile(game)));
    }

    els.count.textContent = `${ordered.length} / ${state.games.length} games`;
    if (!state.game) els.grid.scrollTop = 0;
    updateGridScrollState();
  }

  function renderFilterGroup(group, values) {
    const host = document.querySelector(`[data-filter-group="${group}"]`);
    if (!host) return;
    host.replaceChildren();

    const build = (label, value) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (state.filters[group] === value ? " is-on" : "");
      chip.dataset.group = group;
      chip.dataset.value = value;
      chip.textContent = label;
      return chip;
    };

    host.append(build("All", "all"));
    values.forEach((value) => host.append(build(value, value)));
  }

  function renderFilters() {
    const genres = [...new Set(state.games.map((game) => game.genre).filter(Boolean))].sort();
    const platforms = [...new Set(state.games.map((game) => game.platform).filter(Boolean))].sort();
    renderFilterGroup("genre", genres);
    renderFilterGroup("platform", platforms);
    els.filterProxy.classList.toggle("is-on", state.filters.proxyOnly);
    els.filterProxy.setAttribute("aria-pressed", String(state.filters.proxyOnly));
  }

  function playableUrl(game) {
    if (!game.needsProxy) return { src: game.url, proxied: false };
    const proxied = buildProxyUrl(game.url);
    return proxied ? { src: proxied, proxied: true } : { src: "", proxied: false };
  }

  function openGame(id) {
    const game = state.games.find((entry) => entry.id === id);
    if (!game) return;
    if (!/^https?:\/\//i.test(game.url || "")) {
      log("error", `Refused to open ${game.title}: only http(s) URLs are allowed`);
      return;
    }

    state.game = game;
    state.gameProxied = false;
    try {
      localStorage.setItem(LAST_GAME_KEY, game.id);
    } catch {
      /* storage unavailable */
    }
    els.frameTitle.textContent = game.title;
    els.frameUrl.textContent = game.url;
    els.player.classList.remove("is-hidden");
    els.grid.classList.add("is-hidden");

    const target = playableUrl(game);
    if (!target.src) {
      els.gameFrame.src = "about:blank";
      els.frameBadge.classList.add("is-hidden");
      els.frameNoticeCopy.textContent = `“${game.title}” is flagged needsProxy, but no gateway is configured. Deploy proxy/ and add its URL to data/config.json, or load it directly.`;
      els.frameNotice.classList.remove("is-hidden");
      log("warn", `Needs proxy but none configured — ${game.title}`);
      return;
    }

    els.frameNotice.classList.add("is-hidden");
    els.frameBadge.classList.toggle("is-hidden", !target.proxied);
    state.gameProxied = target.proxied;
    els.gameFrame.src = target.src;
    log("event", `Opened ${game.title} — ${game.platform}${target.proxied ? " · via proxy" : ""}`);
  }

  function loadDirect() {
    if (!state.game) return;
    els.frameNotice.classList.add("is-hidden");
    els.frameBadge.classList.add("is-hidden");
    state.gameProxied = false;
    els.gameFrame.src = state.game.url;
    log("warn", `Loaded direct despite needsProxy — ${state.game.title}`);
  }

  function closeGame() {
    if (!state.game) return;
    const title = state.game.title;
    state.game = null;
    state.gameProxied = false;
    els.gameFrame.src = "about:blank";
    els.player.classList.add("is-hidden");
    els.grid.classList.remove("is-hidden");
    els.frameNotice.classList.add("is-hidden");
    els.frameBadge.classList.add("is-hidden");
    updateGridScrollState();
    log("event", `Closed ${title}`);
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

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (!state.game) return;
    els.frameWrap.requestFullscreen().catch((err) => log("error", `Fullscreen refused: ${err.message}`));
  }

  /* ------------------------------------------------------------------ */
  /* AI panel                                                           */
  /* ------------------------------------------------------------------ */

  const aiKey = (mode) => AI_PREFIX + mode;

  const threadCache = {};

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

  function clearStoredHistory() {
    Object.keys(PERSONAS).forEach((mode) => {
      try {
        localStorage.removeItem(aiKey(mode));
      } catch {
        /* storage unavailable */
      }
    });
    log("warn", "Chat persistence off — stored threads cleared");
    updateStats();
  }

  function scrollChat() {
    if (!state.aiAutoScroll) return;
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble bubble-${role}`;
    bubble.textContent = text;
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

  function setMode(mode) {
    if (!PERSONAS[mode]) return;
    state.mode = mode;
    els.aiPanel.dataset.mode = mode;
    $$(".mode").forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    els.chatInput.placeholder = PERSONAS[mode].placeholder;
    renderThread(mode);
    log("event", `AI mode → ${PERSONAS[mode].label}`);
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
  }

  function autoGrow() {
    const field = els.chatInput;
    field.style.height = "auto";
    field.style.height = Math.min(field.scrollHeight, 120) + "px";
  }

  function countStoredMessages() {
    let total = 0;
    Object.keys(PERSONAS).forEach((mode) => {
      const thread = loadThread(mode);
      if (thread) total += thread.length;
    });
    return total;
  }

  /* ------------------------------------------------------------------ */
  /* sandbox browser                                                    */
  /* ------------------------------------------------------------------ */

  function setHint(text, isError) {
    els.addrHint.classList.toggle("is-error", Boolean(isError));
    els.addrHintText.textContent = text;
  }

  function parseAddress(raw) {
    const input = raw.trim();
    if (!input) return { error: "Enter an address or search term." };
    if (/^(javascript|data|blob|vbscript):/i.test(input)) {
      return { error: "Only http(s) destinations are allowed in the sandbox." };
    }

    if (/^https?:\/\//i.test(input)) {
      try {
        const url = new URL(input);
        return { url: url.href, kind: "url" };
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
        "No proxy gateway configured. Deploy the worker in proxy/, then add its URL to proxy.endpoint in data/config.json and retry.";
      log("warn", "Proxy retry blocked — no endpoint configured");
      return;
    }
    loadBrowserUrl(proxied, "url");
    log("event", `Proxy retry → ${hostOf(target)}`);
  }

  function openExternally() {
    const target = state.blockedUrl || state.browserUrl;
    if (!target) return;
    if (window.pretzelShell && typeof window.pretzelShell.openExternal === "function") {
      window.pretzelShell.openExternal(target);
      log("event", `System browser → ${hostOf(target)}`);
      return;
    }
    const win = window.open(target, "_blank", "noopener,noreferrer");
    if (!win) {
      els.blockNote.textContent = "The popup was blocked by the browser. Copy the address and open it manually.";
      log("warn", "External open blocked by popup policy");
    } else {
      log("event", `New tab → ${hostOf(target)}`);
    }
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
  /* diagnostics                                                        */
  /* ------------------------------------------------------------------ */

  function updateStats() {
    els.diagSession.textContent = state.session;
    els.diagGames.textContent = String(state.games.length);

    els.ledGamesCount.textContent = String(state.games.length);
    els.ledGames.dataset.state = state.games.length ? "ok" : "warn";

    if (!proxyConfigured()) {
      els.ledProxy.dataset.state = "off";
      els.ledProxy.title = "No proxy gateway configured";
    } else if (state.proxyState === "ok") {
      els.ledProxy.dataset.state = "ok";
      els.ledProxy.title = `Proxy reachable — ${state.config.proxy.label || "configured"}`;
    } else if (state.proxyState === "checking") {
      els.ledProxy.dataset.state = "busy";
      els.ledProxy.title = "Checking proxy health…";
    } else if (state.proxyState === "down") {
      els.ledProxy.dataset.state = "warn";
      els.ledProxy.title = "Proxy configured but unreachable";
    } else {
      els.ledProxy.dataset.state = "busy";
      els.ledProxy.title = "Proxy configured, not yet probed";
    }
    if (!proxyConfigured()) {
      els.diagProxy.textContent = "Unconfigured";
    } else if (state.proxyState === "checking") {
      els.diagProxy.textContent = "Checking…";
    } else if (state.proxyState === "ok") {
      els.diagProxy.textContent = state.config.proxy.label || "Reachable";
    } else if (state.proxyState === "down") {
      els.diagProxy.textContent = "Unreachable";
    } else {
      els.diagProxy.textContent = state.config.proxy.label || "Configured";
    }
    els.diagStorage.textContent = String(countStoredMessages());
    els.diagRenderer.textContent =
      window.pretzelShell && window.pretzelShell.isDesktop ? "Electron shell" : "Browser";
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
    if (key.indexOf("aiWeights.") === 0) {
      PretzelSettings.save({ aiWeights: { [key.split(".")[1]]: value } });
    } else {
      PretzelSettings.save({ [key]: value });
    }
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
    maxLogRows = Number(s.logMax) || 300;
    logLevelFilter = s.logLevel;
    applyLogFilter();
    updateStats();
  }

  function onSettingChanged(key, value) {
    if (key === "sort" || key === "reverseSort") {
      renderGrid();
      return;
    }
    if (key === "reopenLast" && value && state.game) {
      try {
        localStorage.setItem(LAST_GAME_KEY, state.game.id);
      } catch {
        /* storage unavailable */
      }
      return;
    }
    if (key === "defaultGenre") {
      state.filters.genre = value;
      renderFilters();
      renderGrid();
      return;
    }
    if (key === "defaultPlatform") {
      state.filters.platform = value;
      renderFilters();
      renderGrid();
      return;
    }
    if (key === "proxyOnly") {
      state.filters.proxyOnly = Boolean(value);
      renderFilters();
      renderGrid();
      return;
    }
    if (key === "aiMode") {
      setMode(value);
      return;
    }
    if (key === "aiKeepHistory") {
      if (!value) clearStoredHistory();
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
    const row = document.createElement("div");
    row.className = "set-row";
    row.dataset.key = item.key;

    const copy = document.createElement("div");
    copy.className = "set-copy";
    const label = document.createElement("span");
    label.className = "set-label";
    label.textContent = item.label;
    const hint = document.createElement("span");
    hint.className = "set-hint";
    hint.textContent = item.hint || "";
    copy.append(label, hint);

    const control = document.createElement("div");
    control.className = "set-control";
    const value = settingsValue(item.key);

    if (item.type === "select") {
      const select = document.createElement("select");
      select.className = "set-input";
      select.setAttribute("aria-label", item.label);
      let options = item.options || [];
      if (item.dynamic === "genres") {
        options = [{ value: "all", label: "All genres" }, ...genres.map((entry) => ({ value: entry, label: entry }))];
      } else if (item.dynamic === "platforms") {
        options = [
          { value: "all", label: "All platforms" },
          ...platforms.map((entry) => ({ value: entry, label: entry }))
        ];
      }
      options.forEach((option) => {
        const node = document.createElement("option");
        node.value = option.value;
        node.textContent = option.label;
        select.append(node);
      });
      select.value = String(value);
      select.addEventListener("change", () => commitSetting(item.key, select.value));
      control.append(select);
    } else if (item.type === "toggle") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "set-switch";
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
      const wrap = document.createElement("div");
      wrap.className = "set-range";
      const range = document.createElement("input");
      range.type = "range";
      range.min = String(item.min);
      range.max = String(item.max);
      range.step = String(item.step || 1);
      range.value = String(value);
      range.setAttribute("aria-label", item.label);
      const out = document.createElement("span");
      out.className = "set-value";
      out.textContent = `${value}${item.suffix || ""}`;
      range.addEventListener("input", () => {
        out.textContent = `${range.value}${item.suffix || ""}`;
        commitSetting(item.key, Number(range.value));
      });
      wrap.append(range, out);
      control.append(wrap);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "set-text";
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
    const group = document.createElement("section");
    group.className = "set-group";
    const title = document.createElement("h2");
    title.textContent = "About";
    const note = document.createElement("p");
    note.className = "set-note";
    note.textContent = "Pretzel's Unblocked Games: RETURN — free, local, no accounts.";
    group.append(title, note);

    const rows = [
      ["Build", `${VERSION} · b${BUILD}`],
      ["Engines", `${window.PretzelAI ? window.PretzelAI.fighterCount : 19} fighters · 3 personas`],
      ["Catalog", `${state.games.length} games`],
      ["Credits", "Pretzel · Krillekz · Raevik · LuxLoop · Kyrtop"]
    ];

    rows.forEach(([key, value]) => {
      const row = document.createElement("div");
      row.className = "set-row";
      const copy = document.createElement("div");
      copy.className = "set-copy";
      const label = document.createElement("span");
      label.className = "set-label";
      label.textContent = key;
      copy.append(label);
      const control = document.createElement("div");
      control.className = "set-control";
      const output = document.createElement("span");
      output.className = "set-value";
      output.textContent = value;
      control.append(output);
      row.append(copy, control);
      group.append(row);
    });

    return group;
  }

  function settingsErrorCard(error) {
    const group = document.createElement("section");
    group.className = "set-group";
    const title = document.createElement("h2");
    title.textContent = "Settings could not render";
    const note = document.createElement("p");
    note.className = "set-note";
    note.textContent = String((error && error.message) || error || "Unknown error");
    const actions = document.createElement("div");
    actions.className = "set-actions";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn ghost";
    reset.textContent = "Reset settings & reload";
    reset.addEventListener("click", () => {
      PretzelSettings.reset();
      location.reload();
    });
    actions.append(reset);
    group.append(title, note, actions);
    return group;
  }

  function renderSettings() {
    if (!els.settingsBody) return;
    const genres = [...new Set(state.games.map((game) => game.genre).filter(Boolean))].sort();
    const platforms = [...new Set(state.games.map((game) => game.platform).filter(Boolean))].sort();
    els.settingsBody.replaceChildren();

    if (!window.PretzelSettings || !Array.isArray(PretzelSettings.SECTIONS)) {
      els.settingsBody.append(
        settingsErrorCard(
          new Error("js/settings.js did not load, or the page is holding an old cached copy. Hard-refresh with Ctrl+F5.")
        )
      );
      log("error", "Settings store missing — js/settings.js failed to load");
      return;
    }

    try {
      PretzelSettings.SECTIONS.forEach((section) => {
      const group = document.createElement("section");
      group.className = "set-group";

      const title = document.createElement("h2");
      title.textContent = section.title;
      const note = document.createElement("p");
      note.className = "set-note";
      note.textContent = section.note;
      group.append(title, note);

      section.items.forEach((item) => group.append(buildSettingRow(item, genres, platforms)));

      if (section.id === "proxy") {
        const actions = document.createElement("div");
        actions.className = "set-actions";
        const test = document.createElement("button");
        test.type = "button";
        test.className = "btn ghost";
        test.textContent = "Test proxy";
        test.addEventListener("click", () => probeProxy());
        actions.append(test);
        group.append(actions);
      }

      if (section.id === "ai") {
        const actions = document.createElement("div");
        actions.className = "set-actions";
        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "btn ghost";
        clear.textContent = "Clear all chat history";
        clear.addEventListener("click", () => {
          clearHistory();
          renderThread(state.mode);
        });
        actions.append(clear);
        group.append(actions);
      }

        els.settingsBody.append(group);
      });

      els.settingsBody.append(buildAboutGroup());
    } catch (error) {
      console.error(error);
      els.settingsBody.replaceChildren(settingsErrorCard(error));
      log("error", `Settings failed to render — ${error.message}`);
      return;
    }

    const rows = els.settingsBody.querySelectorAll(".set-row").length;
    if (!rows) {
      els.settingsBody.replaceChildren(
        settingsErrorCard(new Error("The settings schema returned no controls."))
      );
      return;
    }
    els.settingsRendered = rows;
  }

  /* ------------------------------------------------------------------ */
  /* wiring                                                             */
  /* ------------------------------------------------------------------ */

  function exportSettings() {
    const blob = new Blob([JSON.stringify(PretzelSettings.get(), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "pretzel-settings.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    log("event", "Settings exported to pretzel-settings.json");
  }

  function updateGridScrollState() {
    const grid = els.grid;
    if (!grid) return;
    const below = grid.scrollTop + grid.clientHeight < grid.scrollHeight - 2;
    const above = grid.scrollTop > 2;
    grid.dataset.overflow = below && above ? "both" : below ? "below" : above ? "above" : "none";
  }

  function cacheEls() {
    els.dockStatus = $("#dock-status");
    els.scrim = $("#tray-scrim");
    els.stageCrumb = $("#stage-crumb");
    els.buildTag = $("#build-tag");
    els.ledProxy = $("#led-proxy");
    els.ledGames = $("#led-games");
    els.ledGamesCount = $("#led-games-count");

    els.aiPanel = $("#panel-ai");
    els.chat = $("#chat-log");
    els.chatInput = $("#chat-input");
    els.chatForm = $("#chat-form");

    els.grid = $("#lib-grid");
    els.count = $("#lib-count");
    els.search = $("#lib-search");
    els.filterProxy = $("#filter-proxy");
    els.player = $("#lib-player");
    els.frameTitle = $("#frame-title");
    els.frameUrl = $("#frame-url");
    els.gameFrame = $("#game-frame");
    els.frameWrap = $("#frame-wrap");
    els.frameBadge = $("#frame-badge");
    els.frameNotice = $("#frame-notice");
    els.frameNoticeCopy = $("#frame-notice-copy");

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
    els.diagRenderer = $("#diag-renderer");

    els.settingsBody = $("#settings-body");
    els.settingsFile = $("#settings-file");
  }

  function wireEvents() {
    $$("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => setPanel(btn.dataset.nav));
    });

    els.scrim.addEventListener("click", () => closeTray());
    $$("[data-tray-close]").forEach((btn) => btn.addEventListener("click", () => closeTray()));

    /* library */
    els.search.addEventListener("input", (event) => {
      state.filters.q = event.target.value.trim().toLowerCase();
      renderGrid();
    });

    $("#lib-filters").addEventListener("click", (event) => {
      const chip = event.target.closest(".chip");
      if (!chip || !chip.dataset.group) return;
      state.filters[chip.dataset.group] = chip.dataset.value;
      renderFilters();
      renderGrid();
    });

    els.filterProxy.addEventListener("click", () => {
      state.filters.proxyOnly = !state.filters.proxyOnly;
      renderFilters();
      renderGrid();
    });

    els.grid.addEventListener("click", (event) => {
      const tile = event.target.closest("[data-game]");
      if (tile) openGame(tile.dataset.game);
    });

    /* Scroll the grid ourselves so a wheel that a parent swallows still works. */
    els.grid.addEventListener(
      "wheel",
      (event) => {
        const grid = els.grid;
        if (grid.scrollHeight <= grid.clientHeight + 1) return;
        const step = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        const atTop = grid.scrollTop <= 0;
        const atBottom = grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 1;
        if ((step < 0 && atTop) || (step > 0 && atBottom)) return;
        grid.scrollTop += step;
        updateGridScrollState();
        event.preventDefault();
      },
      { passive: false }
    );

    els.grid.addEventListener("scroll", updateGridScrollState, { passive: true });

    els.grid.addEventListener("keydown", (event) => {
      const grid = els.grid;
      const page = Math.max(120, grid.clientHeight - 90);
      const moves = {
        ArrowDown: 84,
        ArrowUp: -84,
        PageDown: page,
        PageUp: -page,
        " ": event.shiftKey ? -page : page,
        Home: -grid.scrollHeight,
        End: grid.scrollHeight
      };
      if (!(event.key in moves)) return;
      event.preventDefault();
      grid.scrollTop += moves[event.key];
      updateGridScrollState();
    });

    $("#frame-close").addEventListener("click", closeGame);
    $("#frame-refresh").addEventListener("click", refreshGame);
    $("#frame-fullscreen").addEventListener("click", toggleFullscreen);
    $("#frame-direct").addEventListener("click", loadDirect);
    document.addEventListener("fullscreenchange", () => {
      log("event", document.fullscreenElement ? "Viewport fullscreen on" : "Viewport fullscreen off");
    });

    /* AI */
    $$(".mode").forEach((btn) => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
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
    $("#block-external").addEventListener("click", openExternally);
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

    els.browserFrame.addEventListener("load", () => {
      window.clearTimeout(state.watchdog);
      const src = els.browserFrame.getAttribute("src") || "";
      if (!src || src === "about:blank") return;
      log("event", `Frame load event ← ${hostOf(src)}`);
    });

    /* settings */
    $("#settings-export").addEventListener("click", exportSettings);
    $("#settings-import").addEventListener("click", () => els.settingsFile.click());
    els.settingsFile.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        PretzelSettings.save(parsed);
        location.reload();
      } catch (err) {
        log("error", `Settings import failed — ${err.message}`);
      }
    });
    $("#settings-reset").addEventListener("click", () => {
      if (!window.confirm("Reset every setting to its default?")) return;
      PretzelSettings.reset();
      location.reload();
    });

    /* diagnostics */
    $("#diag-proxy-test").addEventListener("click", () => probeProxy());
    $("#diag-clear").addEventListener("click", () => {
      els.log.replaceChildren();
      log("info", "Diagnostic log cleared");
    });

    /* keyboard: Alt+1..5 panels, Escape closes trays */
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.trayName) {
        closeTray();
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const entry = Object.entries(state.config.hotkeys || {}).find(([, key]) => key === event.key);
      if (!entry) return;
      event.preventDefault();
      setPanel(entry[0]);
    });

    /* viewport */
    compact.addEventListener("change", handleBreakpointChange);
    let resizeFrame = 0;
    window.addEventListener("resize", () => {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        updateBreakpoint();
        reconcileLayout();
      });
    });

    window.addEventListener("error", (event) => log("error", event.message || "Uncaught error"));
    window.addEventListener("unhandledrejection", (event) =>
      log("error", `Promise rejection: ${event.reason && event.reason.message ? event.reason.message : event.reason}`)
    );
  }

  /* ------------------------------------------------------------------ */
  /* boot                                                               */
  /* ------------------------------------------------------------------ */

  async function init() {
    cacheEls();
    PretzelSettings.load();
    PretzelSettings.apply();
    wireEvents();
    updateBreakpoint();
    setActivePanel("library", { silent: true });

    if (els.buildTag) {
      els.buildTag.textContent = `${VERSION} · b${BUILD}`;
      els.buildTag.title = `Running the js/app.js build tagged b${BUILD}. If this is older than your latest changes, hard-refresh with Ctrl+F5.`;
    }
    log("info", `Shell booted — ${VERSION} · build b${BUILD} · session ${state.session}`);
    if (location.protocol === "file:") {
      log("warn", "file:// protocol — JSON assets need an http server or the packaged Electron shell (Phase 4)");
    }

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
      log("error", "Library index missing — the grid will stay empty");
    }

    applySettingsRuntime();

    const saved = PretzelSettings.get();
    const availableGenres = new Set(state.games.map((game) => game.genre).filter(Boolean));
    const availablePlatforms = new Set(state.games.map((game) => game.platform).filter(Boolean));
    state.filters = {
      q: "",
      genre: availableGenres.has(saved.defaultGenre) ? saved.defaultGenre : "all",
      platform: availablePlatforms.has(saved.defaultPlatform) ? saved.defaultPlatform : "all",
      proxyOnly: Boolean(saved.proxyOnly)
    };

    renderFilters();
    renderGrid();
    renderSettings();
    log("event", `Settings ready · ${els.settingsRendered || 0} controls`);
    if (PERSONAS[saved.aiMode]) setMode(saved.aiMode);
    else renderThread(state.mode);
    updateStats();

    if (saved.reopenLast) {
      let lastId = null;
      try {
        lastId = localStorage.getItem(LAST_GAME_KEY);
      } catch {
        /* storage unavailable */
      }
      if (lastId && state.games.some((game) => game.id === lastId)) openGame(lastId);
    }

    const roster = window.PretzelAI ? window.PretzelAI.fighterCount : 0;
    log("info", `Local AI engines online · ${roster} fighters · ${state.games.length} games indexed`);
    log("info", "Alt+1…5 switches panels · Escape closes trays");

    if (proxyConfigured()) {
      probeProxy({ silent: true });
    } else {
      state.proxyState = "off";
      updateStats();
    }
  }

  init();
})();
