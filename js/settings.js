/* =====================================================================
   Pretzel's Unblocked Games: RETURN — settings store
   Defaults, accent presets, search engines and the schema the Settings
   panel renders. Values persist in localStorage and apply live.
   ===================================================================== */
(() => {
  "use strict";

  const KEY = "pretzel.settings.v1";

  const ACCENTS = {
    amber: { label: "Neon amber", main: "#ffb020", bright: "#ffd37a", deep: "#c47c0d" },
    ember: { label: "Ember", main: "#ff8a3d", bright: "#ffb98a", deep: "#c25a12" },
    crimson: { label: "Crimson", main: "#f0455c", bright: "#ff8b9b", deep: "#b02334" },
    mint: { label: "Mint", main: "#4fd6b0", bright: "#9af2d8", deep: "#1f9c7c" },
    violet: { label: "Violet", main: "#a98bff", bright: "#cbb8ff", deep: "#6f52c9" }
  };

  const ENGINES = {
    duckduckgo: { label: "DuckDuckGo", endpoint: "https://duckduckgo.com/?q=" },
    google: { label: "Google", endpoint: "https://www.google.com/search?q=" },
    bing: { label: "Bing", endpoint: "https://www.bing.com/search?q=" },
    brave: { label: "Brave Search", endpoint: "https://search.brave.com/search?q=" },
    startpage: { label: "Startpage", endpoint: "https://www.startpage.com/sp/search?query=" }
  };

  const DEFAULTS = {
    /* appearance */
    accent: "amber",
    density: "comfortable",
    tileSize: 198,
    glow: "full",
    motion: true,
    showStageBar: true,
    showLeds: true,
    dockLabels: true,

    /* library */
    sort: "title",
    reverseSort: false,
    showTags: true,
    reopenLast: false,
    defaultGenre: "all",
    defaultPlatform: "all",
    proxyOnly: false,

    /* ai */
    aiMode: "debate",
    aiWeights: { stats: 42, hax: 30, speed: 28 },
    aiDetail: "full",
    aiKeepHistory: true,
    aiAutoScroll: true,

    /* browser */
    searchEngine: "duckduckgo",
    customSearch: "",
    homeUrl: "https://gabrielecirulli.github.io/2048/",
    watchdogMs: 8000,

    /* proxy overrides (fall back to data/config.json when blank) */
    proxyEndpoint: "",
    proxyHealth: "",
    proxyToken: "",

    /* stealth + offline */
    stealthHotkey: "CommandOrControl+Shift+H",
    cloakHint: true,
    offlineCache: true,

    /* diagnostics */
    logLevel: "all",
    logTimestamps: true,
    logMax: 300
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  let current = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      current = {
        ...clone(DEFAULTS),
        ...parsed,
        aiWeights: { ...clone(DEFAULTS.aiWeights), ...(parsed.aiWeights || {}) }
      };
    } catch {
      current = clone(DEFAULTS);
    }
    return current;
  }

  function get() {
    return current || load();
  }

  function save(patch) {
    current = { ...get(), ...patch };
    if (patch && patch.aiWeights) {
      current.aiWeights = { ...current.aiWeights, ...patch.aiWeights };
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      /* storage unavailable — keep the in-memory copy */
    }
    return current;
  }

  function reset() {
    current = clone(DEFAULTS);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return current;
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  function apply(settings) {
    const s = settings || get();
    const root = document.documentElement;
    const accent = ACCENTS[s.accent] || ACCENTS.amber;
    const { r, g, b } = hexToRgb(accent.main);

    root.style.setProperty("--amber", accent.main);
    root.style.setProperty("--amber-bright", accent.bright);
    root.style.setProperty("--amber-deep", accent.deep);
    root.style.setProperty("--amber-soft", `rgba(${r}, ${g}, ${b}, 0.12)`);
    root.style.setProperty("--amber-line", `rgba(${r}, ${g}, ${b}, 0.34)`);
    root.style.setProperty("--amber-glow", `rgba(${r}, ${g}, ${b}, 0.4)`);
    root.style.setProperty("--tile-min", `${Number(s.tileSize) || 198}px`);

    const body = document.body.classList;
    body.toggle("density-compact", s.density === "compact");
    body.toggle("density-roomy", s.density === "roomy");
    body.toggle("glow-soft", s.glow === "soft");
    body.toggle("glow-off", s.glow === "off");
    body.toggle("no-motion", !s.motion);
    body.toggle("hide-stage-bar", !s.showStageBar);
    body.toggle("hide-leds", !s.showLeds);
    body.toggle("dock-icons", !s.dockLabels);
    body.toggle("hide-tags", !s.showTags);
    body.toggle("log-no-time", !s.logTimestamps);
  }

  const SECTIONS = [
    {
      id: "appearance",
      title: "Appearance",
      note: "Theme, density and motion. Accent swaps the neon, everything else keeps the cocoa base.",
      items: [
        {
          key: "accent",
          type: "select",
          label: "Accent color",
          hint: "Neon amber is the locked default.",
          options: Object.entries(ACCENTS).map(([value, accent]) => ({ value, label: accent.label }))
        },
        {
          key: "density",
          type: "select",
          label: "Density",
          hint: "Compact fits more per screen; roomy adds breathing room.",
          options: [
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
            { value: "roomy", label: "Roomy" }
          ]
        },
        {
          key: "tileSize",
          type: "range",
          label: "Tile size",
          hint: "Minimum card width in the library grid.",
          min: 160,
          max: 280,
          step: 2,
          suffix: "px"
        },
        {
          key: "glow",
          type: "select",
          label: "Neon glow",
          hint: "Full glow uses shadows on hover and active states.",
          options: [
            { value: "full", label: "Full" },
            { value: "soft", label: "Soft" },
            { value: "off", label: "Off" }
          ]
        },
        { key: "motion", type: "toggle", label: "Animations", hint: "Panel transitions, hover lifts and bubble entry." },
        { key: "showStageBar", type: "toggle", label: "Stage bar", hint: "The breadcrumb strip above the panels." },
        { key: "showLeds", type: "toggle", label: "Status LEDs", hint: "Engines, proxy and catalog indicators." },
        { key: "dockLabels", type: "toggle", label: "Dock labels", hint: "Turn off for an icon-only rail." }
      ]
    },
    {
      id: "library",
      title: "Library",
      note: "How the catalog opens and sorts.",
      items: [
        {
          key: "sort",
          type: "select",
          label: "Sort order",
          hint: "Applies to the grid immediately.",
          options: [
            { value: "title", label: "Title (A–Z)" },
            { value: "genre", label: "Genre, then title" },
            { value: "platform", label: "Platform, then title" }
          ]
        },
        { key: "reverseSort", type: "toggle", label: "Reverse order", hint: "Flip whichever sort is selected." },
        { key: "showTags", type: "toggle", label: "Tile tags", hint: "The genre and platform chips under each title." },
        { key: "reopenLast", type: "toggle", label: "Reopen last game", hint: "Launch straight back into the game you played last." },
        { key: "defaultGenre", type: "select", label: "Default genre", hint: "Filter preselected on launch.", dynamic: "genres" },
        { key: "defaultPlatform", type: "select", label: "Default platform", hint: "Filter preselected on launch.", dynamic: "platforms" },
        { key: "proxyOnly", type: "toggle", label: "Proxy-only by default", hint: "Start with the needs-proxy filter engaged." }
      ]
    },
    {
      id: "ai",
      title: "AI Panel",
      note: "Debate weighting, response depth and history behaviour.",
      items: [
        {
          key: "aiMode",
          type: "select",
          label: "Default persona",
          hint: "Which mode the panel opens on.",
          options: [
            { value: "debate", label: "Anime Debate Matrix" },
            { value: "academic", label: "Academic Assistant" },
            { value: "chef", label: "Pretzel Chef" }
          ]
        },
        { key: "aiWeights.stats", type: "range", label: "Weight · stats", hint: "Strength, durability and attack potency.", min: 0, max: 100, step: 1, suffix: "%" },
        { key: "aiWeights.hax", type: "range", label: "Weight · abilities", hint: "Hax, immunities and interactions.", min: 0, max: 100, step: 1, suffix: "%" },
        { key: "aiWeights.speed", type: "range", label: "Weight · speed", hint: "Raw speed plus tier gaps.", min: 0, max: 100, step: 1, suffix: "%" },
        {
          key: "aiDetail",
          type: "select",
          label: "Answer depth",
          hint: "Concise drops the stat sheet and keeps the verdict.",
          options: [
            { value: "full", label: "Full breakdown" },
            { value: "concise", label: "Verdict only" }
          ]
        },
        { key: "aiKeepHistory", type: "toggle", label: "Remember chats", hint: "Off clears stored threads and keeps them in memory only." },
        { key: "aiAutoScroll", type: "toggle", label: "Auto-scroll", hint: "Jump to the newest message after a reply." }
      ]
    },
    {
      id: "browser",
      title: "Browser",
      note: "Search routing, landing page and frame timing.",
      items: [
        {
          key: "searchEngine",
          type: "select",
          label: "Search engine",
          hint: "Used when the address bar input is not a URL.",
          options: [
            ...Object.entries(ENGINES).map(([value, engine]) => ({ value, label: engine.label })),
            { value: "custom", label: "Custom endpoint" }
          ]
        },
        {
          key: "customSearch",
          type: "text",
          label: "Custom search URL",
          hint: "Used when “Custom endpoint” is selected. Query is appended.",
          placeholder: "https://example.com/search?q="
        },
        { key: "homeUrl", type: "text", label: "Home destination", hint: "Loaded by the Home button in the browser panel.", placeholder: "https://…" },
        { key: "watchdogMs", type: "range", label: "Block watchdog", hint: "How long to wait for a frame load before suggesting a block.", min: 3000, max: 20000, step: 500, suffix: "ms" }
      ]
    },
    {
      id: "proxy",
      title: "Proxy gateway",
      note: "Overrides data/config.json. Leave blank to use the file values.",
      items: [
        { key: "proxyEndpoint", type: "text", label: "Endpoint", hint: "Supports a {url} placeholder.", placeholder: "https://your-proxy/?url={url}" },
        { key: "proxyHealth", type: "text", label: "Health URL", hint: "Probed by Test proxy and at boot.", placeholder: "https://your-proxy/" },
        { key: "proxyToken", type: "text", label: "Token", hint: "Sent as ?token= when the worker requires one.", placeholder: "optional" }
      ]
    },
    {
      id: "stealth",
      title: "Stealth & offline",
      note: "Cloak the whole workspace, rebind the panic key, and keep the shell usable without a network.",
      items: [
        {
          key: "stealthHotkey",
          type: "text",
          label: "Panic hotkey",
          hint: "Electron global shortcut. In a browser only the Ctrl+Shift+H fallback works.",
          placeholder: "CommandOrControl+Shift+H"
        },
        { key: "cloakHint", type: "toggle", label: "Show cloak hint", hint: "The small return-key hint in the corner of the blank document." },
        { key: "offlineCache", type: "toggle", label: "Offline shell cache", hint: "Cache the local shell, catalog and AI engine for network-free launches. Game frames stay online." }
      ]
    },
    {
      id: "diagnostics",
      title: "Diagnostics",
      note: "What the log keeps and how much it keeps.",
      items: [
        {
          key: "logLevel",
          type: "select",
          label: "Log level",
          hint: "Filter the lifecycle log by severity.",
          options: [
            { value: "all", label: "Everything" },
            { value: "warn", label: "Warnings and errors" },
            { value: "error", label: "Errors only" }
          ]
        },
        { key: "logTimestamps", type: "toggle", label: "Timestamps", hint: "Show the time column." },
        { key: "logMax", type: "range", label: "Log size", hint: "Rows kept before the oldest are dropped.", min: 50, max: 500, step: 50, suffix: " rows" }
      ]
    }
  ];

  window.PretzelSettings = {
    KEY,
    DEFAULTS,
    ACCENTS,
    ENGINES,
    SECTIONS,
    load,
    get,
    save,
    reset,
    apply
  };
})();
