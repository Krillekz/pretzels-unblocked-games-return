"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  data: null,
  working: null,
  original: null,
  selectedKey: null,
  isNew: false,
  draft: null,
  dirty: false,
  frameHistory: [],
  logs: [],
  saveBusy: false,
};

const PLATFORMS = ["HTML5", "WebGL", "Flash", "Emulator"];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isHttp(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDay(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function emptyCatalog() {
  return { version: 1, updated: "", games: [] };
}

function summaryOf(catalog) {
  const games = Array.isArray(catalog?.games) ? catalog.games : [];
  return {
    count: games.length,
    genres: [...new Set(games.map((game) => game.genre).filter(Boolean))],
    proxy: games.filter((game) => game.needsProxy).length,
  };
}

function toast(title, message = "", level = "ok") {
  const host = $("#toasts");
  if (!host) return;
  const node = document.createElement("div");
  node.className = "toast";
  node.dataset.level = level;
  node.innerHTML = `<span class="toast-dot" aria-hidden="true"></span><span class="toast-copy"><b>${esc(title)}</b>${message ? `<small>${esc(message)}</small>` : ""}</span>`;
  host.append(node);
  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateY(5px)";
    node.style.transition = "opacity 160ms, transform 160ms";
    setTimeout(() => node.remove(), 180);
  }, 3600);
}

function log(level, message) {
  state.logs.push({ at: new Date().toISOString(), level, message });
  if (state.logs.length > 90) state.logs.shift();
  renderConsole();
}

function setStatus(text, dotState = "ok") {
  const railDot = $("#rail-dot");
  const footDot = $("#foot-dot");
  if (railDot) railDot.dataset.state = dotState;
  if (footDot) footDot.dataset.state = dotState;
  if ($("#rail-status")) $("#rail-status").textContent = text;
  if ($("#foot-status")) $("#foot-status").textContent = text;
}

function setPage(route) {
  $$(".rail-btn").forEach((button) => {
    const active = button.dataset.route === route;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $$(".page").forEach((page) => {
    const active = page.dataset.page === route;
    page.hidden = !active;
    page.classList.toggle("is-active", active);
  });
  if (route === "library") renderLibrary();
  if (route === "frame") renderFrameCatalog();
  if (route === "files") renderFiles();
  if (route === "mirrors") renderMirrors();
  if (route === "test") renderTestState();
  const deck = $(".deck");
  if (deck) deck.scrollTop = 0;
}

function setDirty(next) {
  state.dirty = next;
  const banner = $("#unsaved-banner");
  if (banner) banner.hidden = !next;
  const chip = $("#library-dirty");
  if (chip) chip.hidden = !next;
  const save = $("#catalog-save");
  if (save) save.disabled = state.saveBusy || !state.data?.workspace;
  updateStatus();
}

function updateStatus() {
  if (!state.data?.workspace) {
    setStatus("No workspace selected", "warn");
    return;
  }
  if (state.dirty) {
    setStatus("Unsaved catalog changes", "warn");
    return;
  }
  if (state.data.validation && state.data.validation.ok === false) {
    setStatus("Catalog needs attention", "error");
    return;
  }
  setStatus("Catalog ready", "ok");
}

function adoptState(data, { resetWorking = false } = {}) {
  state.data = data;
  const saved = data?.catalog && typeof data.catalog === "object" ? data.catalog : emptyCatalog();
  if (resetWorking || !state.working) {
    state.working = clone(saved);
    state.original = clone(saved);
    state.selectedKey = null;
    state.isNew = false;
    state.draft = null;
    setDirty(false);
  }
  state.working = state.working && typeof state.working === "object" ? state.working : emptyCatalog();
  if (!Array.isArray(state.working.games)) state.working.games = [];
  if (!state.original) state.original = clone(state.working);

  if ($("#workspace-name")) {
    $("#workspace-name").textContent = data?.workspace?.name || "Choose workspace";
  }
  if ($("#version-label")) $("#version-label").textContent = data?.manager?.version || "0.1.0";
  if ($("#build-chip")) $("#build-chip").textContent = data?.manager?.build || "m1";
  if ($("#phase-chip")) $("#phase-chip").textContent = data?.manager?.phase || "Phase 5";
  if ($("#foot-path")) $("#foot-path").textContent = data?.workspace?.path || "No workspace";

  if (state.selectedKey && !state.isNew && !state.working.games.some((game) => game.id === state.selectedKey)) {
    state.selectedKey = null;
  }

  renderStats();
  renderReadiness();
  renderFacts();
  renderBackups();
  renderLibrary();
  renderEditor();
  renderFrameCatalog();
  renderFrameHistory();
  renderTestState();
  renderFiles();
  renderMirrors();
  updateStatus();
}

function renderStats() {
  const summary = summaryOf(state.working);
  const assets = state.data?.assets;
  const backups = state.data?.backupCount || 0;
  if ($("#stat-games")) $("#stat-games").textContent = String(summary.count);
  if ($("#stat-games-sub")) {
    $("#stat-games-sub").textContent = summary.count
      ? `${plural(summary.genres.length, "genre")} · ${summary.proxy} proxied`
      : "No entries in the working copy";
  }
  if ($("#stat-backups")) $("#stat-backups").textContent = String(backups);
  if ($("#stat-backups-sub")) {
    $("#stat-backups-sub").textContent = backups ? `Latest ${formatDate(state.data.backups[0]?.modified)}` : "No backup on disk yet";
  }
  if ($("#stat-assets")) {
    $("#stat-assets").textContent = assets ? `${assets.totals.requiredPresent}/${assets.totals.required}` : "—";
  }
  if ($("#stat-assets-sub")) {
    $("#stat-assets-sub").textContent = assets
      ? assets.missingRequired.length
        ? `${assets.missingRequired.length} required missing`
        : "Required files present"
      : "Run an asset scan";
  }
  if ($("#stat-saved")) $("#stat-saved").textContent = formatDay(state.data?.libraryStat?.modified);
  if ($("#stat-saved-sub")) {
    $("#stat-saved-sub").textContent = state.data?.libraryStat?.modified
      ? `${formatTime(state.data.libraryStat.modified)} · ${formatBytes(state.data.libraryStat.bytes)}`
      : "Not written yet";
  }
}

function renderReadiness() {
  const list = $("#readiness-list");
  if (!list) return;
  const data = state.data || {};
  const hasWorkspace = Boolean(data.workspace);
  const valid = data.validation?.ok === true;
  const errorCount = data.validation?.errors?.length || 0;
  const backupCount = data.backupCount || 0;
  const assets = data.assets;
  const rows = [
    {
      state: hasWorkspace ? "ok" : "error",
      mark: hasWorkspace ? "✓" : "×",
      title: "Workspace resolved",
      detail: hasWorkspace ? data.workspace.path : "Choose the folder that contains index.html and data/library.json.",
      value: hasWorkspace ? "READY" : "MISSING",
    },
    {
      state: valid && !state.dirty ? "ok" : valid ? "warn" : "error",
      mark: valid ? (state.dirty ? "!" : "✓") : "×",
      title: "Catalog schema",
      detail: !valid
        ? `${plural(errorCount, "validation error")} in the saved catalog.`
        : state.dirty
          ? "The working copy differs from the saved file."
          : "Saved catalog passes schema v1.",
      value: valid ? (state.dirty ? "UNSAVED" : "VALID") : "INVALID",
    },
    {
      state: backupCount > 0 ? "ok" : "warn",
      mark: backupCount > 0 ? "✓" : "!",
      title: "Restorable backup",
      detail: backupCount > 0 ? `Newest copy: ${data.backups[0]?.name || "on disk"}.` : "The first overwrite will create one; back up now to seed the stack.",
      value: backupCount > 0 ? `${backupCount} COPIES` : "NONE",
    },
    {
      state: assets?.ok ? "ok" : assets ? "error" : "warn",
      mark: assets?.ok ? "✓" : assets ? "×" : "!",
      title: "Delivery assets",
      detail: !assets
        ? "Asset inventory has not run yet."
        : assets.ok
          ? `${assets.totals.present} present, no broken local references.`
          : `${assets.missingRequired.length} required missing · ${assets.brokenReferences.length} broken references.`,
      value: assets?.ok ? "CLEAN" : assets ? "BLOCKED" : "PENDING",
    },
    {
      state: "ok",
      mark: "✓",
      title: "Write guard",
      detail: "Every save is validated, backed up, then replaced atomically. JavaScript is never rewritten.",
      value: "ARMED",
    },
  ];

  list.innerHTML = rows
    .map(
      (row) => `
      <div class="ready-row" data-state="${row.state}">
        <span class="ready-mark" aria-hidden="true">${row.mark}</span>
        <span class="ready-copy"><b>${esc(row.title)}</b><small>${esc(row.detail)}</small></span>
        <span class="ready-value">${esc(row.value)}</span>
      </div>`,
    )
    .join("");

  const tag = $("#readiness-tag");
  if (tag) {
    const blocked = rows.some((row) => row.state === "error");
    const warn = rows.some((row) => row.state === "warn");
    tag.dataset.state = blocked ? "error" : warn ? "warn" : "ok";
    tag.textContent = blocked ? "BLOCKED" : warn ? "CHECK" : "READY";
  }
  if ($("#readiness-note")) {
    $("#readiness-note").textContent = !hasWorkspace
      ? "Pick the workspace folder from the top bar to load the catalog and the asset inventory."
      : state.dirty
        ? "The working copy has unsaved edits. Save the catalog to validate the complete array against schema v1."
        : "A saved catalog, a restorable backup and a clean asset scan are the three gates before a release pass.";
  }
}

function renderFacts() {
  const data = state.data || {};
  if ($("#fact-root")) $("#fact-root").textContent = data.workspace?.path || "—";
  if ($("#fact-library")) $("#fact-library").textContent = data.workspace?.libraryFile || "—";
  if ($("#fact-proxy")) {
    const proxy = data.config?.proxy;
    $("#fact-proxy").textContent = proxy?.endpoint ? `${proxy.label || "Proxy"} · configured` : "Unconfigured";
  }
  if ($("#fact-search")) $("#fact-search").textContent = data.config?.search?.label || "DuckDuckGo";
}

function renderBackups() {
  const data = state.data || {};
  const backups = data.backups || [];
  const markup = backups.length
    ? backups
        .slice(0, 7)
        .map((backup) => `<div class="backup-row"><span><b>${esc(backup.name)}</b><small>${esc(formatDate(backup.modified))}</small></span><span class="backup-size">${formatBytes(backup.bytes)}</span></div>`)
        .join("")
    : `<p class="empty-inline">${data.workspace ? "No backups yet. The first catalog save creates one." : "Choose a workspace to load its rollback stack."}</p>`;

  if ($("#overview-backups")) $("#overview-backups").innerHTML = markup;
  if ($("#backup-list")) {
    $("#backup-list").innerHTML = backups.length
      ? backups
          .map((backup) => `<div class="backup-row"><span><b>${esc(backup.name)}</b><small>${esc(formatDate(backup.modified))}</small></span><span class="backup-size">${formatBytes(backup.bytes)}</span></div>`)
          .join("")
      : `<p class="empty-inline">No backups on disk.</p>`;
  }
}

function filteredGames() {
  const q = ($("#library-search")?.value || "").trim().toLowerCase();
  const platform = $("#library-platform")?.value || "all";
  return (state.working?.games || []).filter((game) => {
    const haystack = [game.title, game.id, game.genre, ...(game.tags || [])].join(" ").toLowerCase();
    return (!q || haystack.includes(q)) && (platform === "all" || game.platform === platform);
  });
}

function renderLibrary() {
  const list = $("#game-list");
  if (!list) return;
  const games = filteredGames();
  if ($("#library-count")) {
    const total = state.working?.games?.length || 0;
    $("#library-count").textContent = `${games.length} of ${total} ${total === 1 ? "entry" : "entries"}`;
  }

  if (!state.data?.workspace) {
    list.innerHTML = `<p class="empty-inline">Choose a workspace to load the catalog.</p>`;
    return;
  }
  if (games.length === 0) {
    list.innerHTML = `<p class="empty-inline">${state.working?.games?.length ? "No entries match this filter." : "No entries yet. Use New game to add the first URL."}</p>`;
    return;
  }

  list.innerHTML = games
    .map(
      (game) => `
      <button class="game-row ${state.selectedKey === game.id && !state.isNew ? "is-selected" : ""}" data-game-row data-id="${esc(game.id)}" type="button" role="option" aria-selected="${state.selectedKey === game.id && !state.isNew}">
        <span class="game-main"><b>${esc(game.title || "Untitled entry")}</b><small>${esc(game.id || "no-id")} · ${esc(game.genre || "no genre")}</small></span>
        <span class="game-platform">${esc(game.platform || "—")}</span>
        <span class="game-proxy" data-on="${game.needsProxy ? "true" : "false"}">${game.needsProxy ? "ROUTE" : "DIRECT"}</span>
      </button>`,
    )
    .join("");
}

function selectedEntry() {
  if (!state.selectedKey) return null;
  return state.working?.games?.find((game) => game.id === state.selectedKey) || null;
}

function renderEditor() {
  const empty = $("#editor-empty");
  const form = $("#game-form");
  if (!empty || !form) return;

  const entry = state.isNew ? state.draft : selectedEntry();
  if (!entry) {
    empty.hidden = false;
    form.hidden = true;
    state.selectedKey = null;
    state.isNew = false;
    state.draft = null;
    return;
  }

  empty.hidden = true;
  form.hidden = false;
  if ($("#editor-mode")) $("#editor-mode").textContent = state.isNew ? "New entry" : "Editing entry";
  if ($("#editor-title")) $("#editor-title").textContent = entry.title || "New game";
  if ($("#game-id")) $("#game-id").value = entry.id || "";
  if ($("#game-title")) $("#game-title").value = entry.title || "";
  if ($("#game-genre")) $("#game-genre").value = entry.genre || "";
  if ($("#game-platform")) $("#game-platform").value = PLATFORMS.includes(entry.platform) ? entry.platform : "HTML5";
  if ($("#game-url")) $("#game-url").value = entry.url || "";
  if ($("#game-cover")) $("#game-cover").value = entry.cover || "";
  if ($("#game-tags")) $("#game-tags").value = (entry.tags || []).join(", ");
  if ($("#game-proxy")) $("#game-proxy").checked = entry.needsProxy === true;
  if ($("#game-delete")) $("#game-delete").setAttribute("aria-label", state.isNew ? "Cancel new entry" : "Delete entry");
  hideFormErrors();
}

function showFormErrors(errors) {
  const host = $("#form-errors");
  if (!host) return;
  host.hidden = errors.length === 0;
  host.innerHTML = errors.map((error) => `<p>${esc(error)}</p>`).join("");
}

function hideFormErrors() {
  const host = $("#form-errors");
  if (host) {
    host.hidden = true;
    host.innerHTML = "";
  }
}

function readForm() {
  return {
    id: ($("#game-id")?.value || "").trim().toLowerCase(),
    title: ($("#game-title")?.value || "").trim(),
    genre: ($("#game-genre")?.value || "").trim(),
    platform: $("#game-platform")?.value || "HTML5",
    url: ($("#game-url")?.value || "").trim(),
    cover: ($("#game-cover")?.value || "").trim(),
    needsProxy: $("#game-proxy")?.checked === true,
    tags: ($("#game-tags")?.value || "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  };
}

function validateForm(entry, originalKey) {
  const errors = [];
  if (!entry.id) errors.push("Id is required.");
  else if (!ID_RE.test(entry.id)) errors.push("Id must use lowercase letters, numbers and hyphens, and start with a letter or number.");
  if (!entry.title) errors.push("Title is required.");
  if (!entry.genre) errors.push("Genre is required.");
  if (!PLATFORMS.includes(entry.platform)) errors.push("Choose a supported platform.");
  if (!isHttp(entry.url)) errors.push("Game URL must be a full http(s) address.");
  if (entry.cover && !isHttp(entry.cover) && !(entry.cover.startsWith("assets/") && !entry.cover.includes(".."))) {
    errors.push("Cover must be blank, an http(s) URL, or a path beginning with assets/.");
  }
  if (entry.tags.length > 8) errors.push("Use at most 8 tags.");
  if (entry.tags.some((tag) => tag.length > 24)) errors.push("Each tag must be 24 characters or fewer.");
  if (entry.title.length > 80) errors.push("Title must be 80 characters or fewer.");
  if (entry.genre.length > 32) errors.push("Genre must be 32 characters or fewer.");
  const duplicate = (state.working?.games || []).find((game) => game.id === entry.id && game.id !== originalKey);
  if (duplicate) errors.push(`Id "${entry.id}" is already used by "${duplicate.title}".`);
  return errors;
}

function applyForm(event) {
  event.preventDefault();
  const entry = readForm();
  const errors = validateForm(entry, state.selectedKey);
  if (errors.length) {
    showFormErrors(errors);
    return;
  }
  hideFormErrors();

  const index = state.isNew
    ? -1
    : (state.working.games || []).findIndex((game) => game.id === state.selectedKey);
  if (index >= 0) state.working.games[index] = entry;
  else state.working.games.push(entry);
  state.selectedKey = entry.id;
  state.isNew = false;
  state.draft = null;
  state.original = state.original || { version: 1, games: [] };
  setDirty(JSON.stringify(state.working.games) !== JSON.stringify(state.original.games));
  renderLibrary();
  renderEditor();
  log("ok", `${index >= 0 ? "Updated" : "Added"} ${entry.title} in the working copy.`);
}

function removeSelected() {
  if (state.isNew) {
    state.selectedKey = null;
    state.isNew = false;
    state.draft = null;
    renderLibrary();
    renderEditor();
    return;
  }
  const entry = selectedEntry();
  if (!entry) return;
  const confirmed = window.confirm(`Delete “${entry.title}” from the working copy?\n\nNothing is written until Save catalog.`);
  if (!confirmed) return;
  state.working.games = state.working.games.filter((game) => game.id !== entry.id);
  state.selectedKey = null;
  setDirty(JSON.stringify(state.working.games) !== JSON.stringify(state.original.games));
  renderLibrary();
  renderEditor();
  log("warn", `Removed ${entry.title} from the working copy. Save to persist the deletion.`);
}

function startNewGame() {
  let counter = (state.working?.games?.length || 0) + 1;
  let seed = `new-game-${counter}`;
  while ((state.working?.games || []).some((game) => game.id === seed)) {
    counter += 1;
    seed = `new-game-${counter}`;
  }
  state.draft = {
    id: seed,
    title: "",
    genre: "",
    platform: "HTML5",
    url: "",
    cover: "",
    needsProxy: false,
    tags: [],
  };
  state.selectedKey = null;
  state.isNew = true;
  renderLibrary();
  renderEditor();
  $("#game-title")?.focus();
}

async function saveCatalog() {
  if (state.saveBusy) return;
  if (!state.data?.workspace) {
    toast("No workspace", "Choose the workspace folder before saving.", "error");
    return;
  }
  if (!state.working) return;
  state.saveBusy = true;
  const button = $("#catalog-save");
  const unsaved = $("#unsaved-save");
  if (button) button.disabled = true;
  if (unsaved) unsaved.disabled = true;
  log("info", "Validating and saving data/library.json…");

  try {
    const result = await window.manager.saveCatalog(state.working);
    if (!result.ok) {
      const messages = (result.errors || []).map((error) => `${error.path || "catalog"}: ${error.message}`);
      showFormErrors(messages.slice(0, 8));
      toast("Catalog rejected", messages[0] || "The validator found errors.", "error");
      log("error", `Save rejected: ${messages.length} validation error(s).`);
      return;
    }
    state.data = result.state;
    state.working = clone(result.catalog);
    state.original = clone(result.catalog);
    state.selectedKey = null;
    state.isNew = false;
    setDirty(false);
    renderStats();
    renderReadiness();
    renderLibrary();
    renderEditor();
    renderBackups();
    renderFramesAfterSave();
    renderFiles();
    toast("Catalog saved", result.backup?.name ? `Backup kept: ${result.backup.name}` : "Written to data/library.json.", "ok");
    log("ok", `Saved ${plural(result.catalog.games.length, "entry")}${result.backup ? ` · backup ${result.backup.name}` : ""}.`);
  } catch (error) {
    toast("Save failed", error.message || "The main process refused the write.", "error");
    log("error", `Save failed: ${error.message}`);
  } finally {
    state.saveBusy = false;
    if (button) button.disabled = false;
    if (unsaved) unsaved.disabled = false;
    setDirty(state.dirty);
  }
}

function discardWorking() {
  if (!state.original) return;
  state.working = clone(state.original);
  state.selectedKey = null;
  state.isNew = false;
  state.draft = null;
  setDirty(false);
  renderLibrary();
  renderEditor();
  renderReadiness();
  log("warn", "Discarded working-copy changes.");
}

function renderFramesAfterSave() {
  renderFrameCatalog();
  renderStats();
}

/* ------------------------------------------------------------- frame lab */

async function checkFrameUrl(url) {
  const value = String(url || "").trim();
  if (!isHttp(value)) {
    toast("Invalid URL", "Enter a full http(s) URL to inspect.", "error");
    return;
  }
  const result = $("#frame-result");
  if (result) {
    result.innerHTML = `<div class="empty-card"><p class="eyebrow">Checking</p><h2>${esc(value)}</h2><p>Following redirects and reading framing headers…</p></div>`;
  }
  log("info", `Frame check started for ${value}`);
  try {
    const checked = await window.manager.checkUrl(value);
    state.frameHistory.unshift({ at: new Date().toISOString(), url: value, result: checked });
    state.frameHistory = state.frameHistory.slice(0, 10);
    renderFrameResult(checked, value);
    renderFrameHistory();
    if (checked.ok) {
      log(checked.frame?.verdict === "blocked" ? "warn" : "ok", `${checked.frame?.verdict?.toUpperCase() || "CHECK"}: ${value}`);
    } else {
      log("error", `Frame check failed for ${value}: ${checked.error}`);
    }
  } catch (error) {
    renderFrameResult({ ok: false, error: error.message, url: value }, value);
    log("error", `Frame check failed: ${error.message}`);
  }
}

function renderFrameResult(result, url) {
  const host = $("#frame-result");
  if (!host) return;
  if (!result || result.ok === false) {
    host.innerHTML = `
      <div class="result-card" data-verdict="blocked">
        <div class="result-main">
          <div class="verdict-row"><span class="verdict" data-verdict="blocked">ERROR</span></div>
          <h2>Could not inspect this URL.</h2>
          <p>${esc(result?.error || "The host did not return a usable response.")}</p>
          <div class="result-url">${esc(url || result?.url || "")}</div>
          <div class="result-actions"><button class="btn ghost sm" data-frame-visual="${esc(url)}" type="button">Try visual frame</button><button class="btn ghost sm" data-external="${esc(url)}" type="button">Open externally</button></div>
        </div>
      </div>`;
    return;
  }

  const frame = result.frame || { verdict: "unknown", label: "No verdict", detail: "" };
  const headers = result.headers || {};
  const csp = headers["content-security-policy"] || "—";
  host.innerHTML = `
    <article class="result-card" data-verdict="${esc(frame.verdict)}">
      <div class="result-main">
        <div class="verdict-row">
          <span class="verdict" data-verdict="${esc(frame.verdict)}">${esc(frame.verdict)}</span>
          <span class="http-chip">HTTP ${esc(result.status)} ${esc(result.statusText || "")} · ${esc(result.elapsedMs)}ms</span>
          ${result.insecureRedirect ? `<span class="http-chip" style="color:var(--crimson-bright)">HTTPS → HTTP</span>` : ""}
        </div>
        <h2>${esc(frame.label)}</h2>
        <p>${esc(frame.detail)}</p>
        <p style="margin-top:7px">${esc(result.note || "")}</p>
        <div class="result-url">${esc(result.finalUrl)}</div>
        <div class="result-actions">
          <button class="btn primary sm" data-frame-visual="${esc(result.finalUrl)}" type="button">Open visual frame</button>
          <button class="btn ghost sm" data-external="${esc(result.finalUrl)}" type="button">Open externally</button>
          <button class="btn ghost sm" data-copy-url="${esc(result.finalUrl)}" type="button">Copy URL</button>
        </div>
      </div>
      <div class="result-headers">
        <h3>Response headers</h3>
        <div class="header-line"><span>x-frame-options</span><b>${esc(headers["x-frame-options"] || "—")}</b></div>
        <div class="header-line"><span>frame-ancestors</span><b>${esc(csp === "—" ? "—" : csp)}</b></div>
        <div class="header-line"><span>content-type</span><b>${esc(headers["content-type"] || "—")}</b></div>
        <div class="header-line"><span>server</span><b>${esc(headers.server || "—")}</b></div>
        <div class="header-line"><span>elapsed</span><b>${esc(result.elapsedMs)} ms</b></div>
        <div class="header-line"><span>final URL</span><b>${esc(result.redirectChanged ? "redirected" : "unchanged")}</b></div>
      </div>
    </article>`;
}

function renderFrameHistory() {
  const host = $("#frame-history");
  if (!host) return;
  if (state.frameHistory.length === 0) {
    host.innerHTML = `<p class="empty-inline">Checks from this session appear here.</p>`;
    return;
  }
  host.innerHTML = state.frameHistory
    .map(
      (item) => `
      <button class="history-row" data-history-url="${esc(item.url)}" type="button" style="border:0;background:transparent;text-align:left;width:100%">
        <span class="history-copy"><b data-verdict="${esc(item.result?.frame?.verdict || "error")}">${esc(item.result?.frame?.label || "Check failed")}</b><small>${esc(item.url)}</small></span>
        <span class="backup-size">${esc(formatTime(item.at))}</span>
      </button>`,
    )
    .join("");
}

function renderFrameCatalog() {
  const host = $("#frame-catalog");
  if (!host) return;
  const games = state.working?.games || [];
  if (!state.data?.workspace) {
    host.innerHTML = `<p class="empty-inline">Choose a workspace first.</p>`;
    return;
  }
  if (games.length === 0) {
    host.innerHTML = `<p class="empty-inline">No catalog entries to check.</p>`;
    return;
  }
  host.innerHTML = games
    .slice(0, 24)
    .map(
      (game) => `
      <div class="queue-row">
        <span class="queue-copy"><b>${esc(game.title)}</b><small>${esc(game.url)}</small></span>
        <button class="btn ghost sm" data-check-url="${esc(game.url)}" type="button">Check</button>
      </div>`,
    )
    .join("");
}

/* -------------------------------------------------------------- test lab */

function updateOfflineUi(offline) {
  const toggle = $("#offline-toggle");
  if (toggle) toggle.checked = offline;
  const pill = $("#offline-state");
  if (pill) {
    pill.textContent = offline ? "DROPOUT" : "ONLINE";
    pill.dataset.state = offline ? "on" : "";
  }
  if (state.data?.test) state.data.test.offline = offline;
}

function renderTestState() {
  const test = state.data?.test;
  if (!test) return;
  updateOfflineUi(test.offline === true);
  const pill = $("#test-size");
  if (pill) {
    if (test.windowOpen && test.size) {
      pill.textContent = `${test.size[0]} × ${test.size[1]}`;
      pill.dataset.state = "open";
    } else {
      pill.textContent = "CLOSED";
      pill.dataset.state = "";
    }
  }
  if ($("#test-window-state")) {
    $("#test-window-state").textContent = test.windowOpen
      ? `Open · ${test.size ? `${test.size[0]} × ${test.size[1]}` : "loading"}`
      : "No test window";
  }
}

function renderConsole() {
  const host = $("#test-console");
  if (!host) return;
  host.innerHTML = state.logs.length
    ? state.logs
        .slice(-70)
        .map(
          (line) => `<div class="console-line" data-level="${esc(line.level)}"><time>${esc(formatTime(line.at))}</time><b>${esc(line.level)}</b><span>${esc(line.message)}</span></div>`,
        )
        .join("")
    : `<p class="empty-inline">Test events appear here.</p>`;
  if ($("#console-count")) $("#console-count").textContent = `${state.logs.length} lines`;
  host.scrollTop = host.scrollHeight;
}

async function openFrameMode(mode) {
  const url = ($("#lab-url")?.value || "").trim();
  if (!isHttp(url)) {
    toast("Invalid test URL", "Enter a full http(s) URL for the frame harness.", "error");
    return;
  }
  const result = await window.manager.openFrameWindow({ url, mode });
  if (result.ok) log(mode === "normal" ? "info" : "warn", `Opened ${mode} frame harness for ${url}`);
  else log("error", result.error || "Could not open the frame harness.");
}

async function openTestWindow(route) {
  const result = await window.manager.openAppWindow({ route });
  if (result.ok) {
    log("info", `${route === "v11" ? "v1.1 deck" : "Games shell"} test window ${result.reused ? "reused" : "opened"}.`);
    toast("Test window", route === "v11" ? "Opened the v1.1 deck." : "Opened the games shell.", "ok");
  } else {
    toast("Could not open window", result.error || "Choose a workspace first.", "error");
    log("error", result.error || "Test window refused.");
  }
}

/* -------------------------------------------------------------- mirrors */

state.mirrorDraft = null;
state.mirrorResults = [];

function mirrorDraft() {
  if (!state.mirrorDraft) {
    const saved = state.data?.mirrors || { primary: "", active: "", mirrors: [] };
    state.mirrorDraft = {
      primary: saved.primary || "",
      active: saved.active || saved.primary || "",
      mirrors: (saved.mirrors || []).map((mirror) => ({
        id: mirror.id,
        label: mirror.label,
        origin: mirror.origin,
        note: mirror.note || "",
      })),
    };
  }
  return state.mirrorDraft;
}

function renderMirrorActive() {
  const select = $("#mirror-active");
  if (!select) return;
  const draft = mirrorDraft();
  const options = [
    ...(draft.primary.trim() ? [{ value: draft.primary.trim(), label: `Primary · ${draft.primary.trim()}` }] : []),
    ...draft.mirrors
      .filter((mirror) => mirror.origin.trim())
      .map((mirror) => ({ value: mirror.origin.trim(), label: `${mirror.label.trim() || "Mirror"} · ${mirror.origin.trim()}` })),
  ];
  select.innerHTML = options.length
    ? options.map((option) => `<option value="${esc(option.value)}"${option.value === draft.active ? " selected" : ""}>${esc(option.label)}</option>`).join("")
    : `<option value="">Save a primary origin first</option>`;
}

function renderMirrorRows() {
  const host = $("#mirror-list");
  if (!host) return;
  const draft = mirrorDraft();
  host.innerHTML = draft.mirrors.length
    ? draft.mirrors
        .map(
          (mirror, index) => `<div class="mirror-row" data-mirror-index="${index}">
            <label class="field"><span>Label</span><input data-mirror-field="label" value="${esc(mirror.label)}" placeholder="Backup host" /></label>
            <label class="field"><span>Origin</span><input data-mirror-field="origin" type="url" spellcheck="false" value="${esc(mirror.origin)}" placeholder="https://mirror.example.com/" /></label>
            <button class="mirror-drop" type="button" data-mirror-delete="${index}" aria-label="Remove ${esc(mirror.label || "mirror")}"><svg viewBox="0 0 24 24"><use href="#i-trash" /></svg></button>
          </div>`,
        )
        .join("")
    : `<p class="mirror-empty">No fallback origins yet. Add one to publish a second route.</p>`;
  const removeLast = $("#mirror-remove");
  if (removeLast) removeLast.hidden = draft.mirrors.length === 0;
}

function renderMirrorResults() {
  const host = $("#mirror-results");
  if (!host) return;
  const results = state.mirrorResults || [];
  host.innerHTML = results.length
    ? results
        .map((result) => {
          const match = result.ok && result.indexMatch && result.libraryMatch;
          return `<div class="mirror-result">
            <span class="route">${esc(result.origin)}</span>
            <span class="panel-tag" data-state="${match ? "ok" : "error"}">${match ? "MATCH" : result.ok ? "DRIFT" : "FAIL"}</span>
            <span class="meta">HTTP <b>${esc(result.status)}</b> · index <b>${result.indexMatch ? "same" : "differs"}</b> · catalog <b>${result.libraryMatch ? "same" : "differs"}</b> · <b>${result.latencyMs} ms</b>${result.error ? ` · ${esc(result.error)}` : ""}</span>
          </div>`;
        })
        .join("")
    : `<p class="mirror-empty">Run “Check all routes” to compare every host with this workspace.</p>`;
}

function renderMirrors() {
  const draft = mirrorDraft();
  if ($("#mirror-primary")) $("#mirror-primary").value = draft.primary;
  const saved = state.data?.mirrors;
  const tag = $("#mirrors-tag");
  if (tag) {
    const count = saved?.mirrorCount || 0;
    tag.dataset.state = saved?.active ? "ok" : "warn";
    tag.textContent = saved?.active ? `${count} MIRROR${count === 1 ? "" : "S"}` : "DRAFT";
  }
  if ($("#mirrors-summary")) {
    $("#mirrors-summary").innerHTML = !state.data?.workspace
      ? "Choose a workspace to manage its delivery routes."
      : saved?.active
        ? `<span class="panel-tag" data-state="ok">ACTIVE</span> <b>${esc(saved.active)}</b> · primary <b>${esc(saved.primary || "unset")}</b> · ${plural(saved.mirrorCount || 0, "fallback")}${saved.updated ? ` · updated ${esc(saved.updated)}` : ""}`
        : "No route manifest yet. Add a primary origin, then save.";
  }
  if ($("#mirror-index-hash")) $("#mirror-index-hash").textContent = saved?.indexSha256 || "—";
  if ($("#mirror-library-hash")) $("#mirror-library-hash").textContent = saved?.catalogSha256 || "—";
  if ($("#mirror-updated")) $("#mirror-updated").textContent = saved?.updated || "—";
  renderMirrorRows();
  renderMirrorActive();
  renderMirrorResults();
}

function mirrorPayload() {
  const draft = mirrorDraft();
  return { version: 1, primary: draft.primary.trim(), active: draft.active.trim(), mirrors: draft.mirrors };
}

async function saveMirrors() {
  const result = await window.manager.saveMirrors(mirrorPayload());
  if (!result.ok) {
    toast("Manifest rejected", result.errors?.[0]?.message || "Check the origins.", "error");
    log("error", `Mirror manifest rejected: ${result.errors?.[0]?.message || "unknown"}`);
    return;
  }
  const warnings = result.warnings?.length ? ` ${result.warnings.length} warning(s).` : "";
  state.mirrorDraft = null;
  adoptState(result.state);
  toast("Manifest saved", `${plural(result.manifest.mirrors.length, "mirror")} · active ${result.manifest.active}`, "ok");
  log("ok", `Mirror manifest saved${result.backup ? ` · backup ${result.backup}` : ""}.${warnings}`);
}

async function checkMirrors() {
  const tag = $("#mirrors-tag");
  if (tag) tag.textContent = "CHECKING";
  const result = await window.manager.checkMirrors(mirrorPayload());
  if (!result.ok) {
    toast("Check failed", result.errors?.[0]?.message || "Fix the manifest first.", "error");
    renderMirrors();
    return;
  }
  state.mirrorResults = result.results;
  const matches = result.results.filter((entry) => entry.ok && entry.indexMatch && entry.libraryMatch).length;
  if ($("#mirrors-summary")) {
    $("#mirrors-summary").innerHTML = `<span class="panel-tag" data-state="${matches ? "ok" : "error"}">${matches}/${result.results.length} MATCH</span> Local fingerprint compared at ${esc(formatTime(new Date().toISOString()))}.`;
  }
  renderMirrorResults();
  log(matches ? "ok" : "error", `Mirror check: ${matches}/${result.results.length} routes match the workspace.`);
  toast("Route check", `${matches} of ${result.results.length} hosts match.`, matches ? "ok" : "warn");
}

async function autoMirrors() {
  const result = await window.manager.autoMirrors(mirrorPayload());
  if (!result.ok) {
    toast("Auto-route failed", result.errors?.[0]?.message || "No matching route.", "error");
    state.mirrorResults = result.results || [];
    renderMirrorResults();
    if ($("#mirrors-summary")) $("#mirrors-summary").textContent = result.errors?.[0]?.message || "Auto-route failed.";
    return;
  }
  state.mirrorResults = result.results || [];
  state.mirrorDraft = null;
  adoptState(result.state);
  toast("Route promoted", `${result.active} now serves as the active route.`, "ok");
  log("ok", `Auto-route selected ${result.active}.`);
}

/* ---------------------------------------------------------------- files */

function renderFiles() {
  const data = state.data || {};
  const assets = data.assets;
  if ($("#files-root")) $("#files-root").textContent = data.workspace?.path || "—";
  if ($("#files-library")) $("#files-library").textContent = data.workspace?.libraryFile || "—";
  if ($("#files-settings")) $("#files-settings").textContent = data.settingsFile || "—";

  const summary = $("#files-summary");
  if (summary) {
    summary.innerHTML = !assets
      ? "Asset scan has not run yet. Choose a workspace and re-run the scan."
      : `<span class="panel-tag" data-state="${assets.ok ? "ok" : "error"}">${assets.ok ? "CLEAN" : "BLOCKED"}</span> <b>${assets.totals.present}/${assets.totals.expected}</b> files present · <b>${assets.totals.requiredPresent}/${assets.totals.required}</b> required · scanned ${esc(formatTime(assets.checkedAt))}`;
  }
  const tag = $("#files-tag");
  if (tag) {
    tag.dataset.state = !assets ? "warn" : assets.ok ? "ok" : "error";
    tag.textContent = !assets ? "PENDING" : assets.ok ? "CLEAN" : "BLOCKED";
  }
  if ($("#files-note")) {
    $("#files-note").textContent = !assets
      ? "Choose a workspace and run the scan."
      : assets.brokenReferences.length
        ? `Broken local references: ${assets.brokenReferences.map((item) => `${item.page} → ${item.reference}`).join(", ")}`
        : "A missing required file is a release blocker. Optional proxy and docs files only warn.";
  }

  const list = $("#asset-list");
  if (list) {
    list.innerHTML = assets
      ? assets.items
          .map((item) => {
            const stateName = item.exists ? (item.ok ? "ok" : "error") : item.required ? "error" : "optional";
            const mark = stateName === "ok" ? "✓" : stateName === "optional" ? "·" : "×";
            return `<div class="asset-row" data-state="${stateName}"><span class="asset-status" aria-hidden="true">${mark}</span><span class="asset-copy"><b>${esc(item.label)}</b><small>${esc(item.relative)}${item.note ? ` · ${esc(item.note)}` : ""}</small></span><span class="asset-category">${esc(item.category)}</span><span class="asset-size">${formatBytes(item.bytes)}</span></div>`;
          })
          .join("")
      : `<p class="empty-inline">Waiting for the workspace scan.</p>`;
  }
}

async function rerunAssets() {
  log("info", "Re-running the local asset scan…");
  try {
    const assets = await window.manager.testAssets();
    if (state.data) state.data.assets = assets;
    renderFiles();
    renderStats();
    renderReadiness();
    toast(assets.ok ? "Asset scan clean" : "Asset scan found gaps", assets.ok ? `${assets.totals.present} files present.` : `${assets.missingRequired.length} required missing.`, assets.ok ? "ok" : "error");
    log(assets.ok ? "ok" : "error", `Asset scan: ${assets.totals.requiredPresent}/${assets.totals.required} required present.`);
  } catch (error) {
    toast("Asset scan failed", error.message, "error");
    log("error", `Asset scan failed: ${error.message}`);
  }
}

/* --------------------------------------------------------------- events */

window.manager.onEvent((event) => {
  if (!event || !event.type) return;
  if (event.type === "app-window") {
    if (state.data?.test) {
      state.data.test.windowOpen = event.state !== "closed";
      if (event.size) state.data.test.size = event.size;
      if (event.url) state.data.test.url = event.url;
    }
    renderTestState();
    if (event.state === "opened") log("ok", `App test window opened · ${event.size?.[0]} × ${event.size?.[1]}`);
    else if (event.state === "resized") log("info", `App test window resized · ${event.size?.[0]} × ${event.size?.[1]}`);
    else if (event.state === "closed") log("warn", "App test window closed.");
  }
  if (event.type === "offline") {
    updateOfflineUi(event.offline === true);
    log(event.offline ? "warn" : "ok", event.offline ? "External network cut for the test session." : "External network restored.");
  }
  if (event.type === "catalog-saved") log("ok", `Catalog write confirmed${event.backup ? ` · ${event.backup}` : ""}.`);
  if (event.type === "backup") log("ok", `Manual backup created · ${event.name}`);
  if (event.type === "workspace") log("ok", `Workspace switched to ${event.path}`);
  if (event.type === "mirrors-saved") log("ok", `Mirror manifest updated · active ${event.active} · ${plural(event.count, "mirror")}`);
});

function bindEvents() {
  $$(".rail-btn").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.route)));

  $("#workspace-btn")?.addEventListener("click", async () => {
    const result = await window.manager.chooseWorkspace();
    if (result.chooseCanceled) return;
    if (result.chooseError) {
      toast("Not a workspace", result.chooseError, "error");
      log("error", result.chooseError);
      return;
    }
    state.working = null;
    state.original = null;
    state.selectedKey = null;
    state.isNew = false;
    adoptState(result, { resetWorking: true });
    toast("Workspace loaded", result.workspace?.name || "", "ok");
    log("ok", `Workspace loaded: ${result.workspace?.path}`);
  });

  $("#library-search")?.addEventListener("input", renderLibrary);
  $("#library-platform")?.addEventListener("change", renderLibrary);
  $("#game-new")?.addEventListener("click", startNewGame);
  $("#game-form")?.addEventListener("submit", applyForm);
  $("#game-delete")?.addEventListener("click", removeSelected);
  $("#game-revert")?.addEventListener("click", renderEditor);
  $("#catalog-save")?.addEventListener("click", saveCatalog);
  $("#unsaved-save")?.addEventListener("click", saveCatalog);
  $("#catalog-discard")?.addEventListener("click", discardWorking);
  $("#unsaved-discard")?.addEventListener("click", discardWorking);

  $("#game-list")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-game-row]");
    if (!row) return;
    state.selectedKey = row.dataset.id;
    state.isNew = false;
    state.draft = null;
    renderLibrary();
    renderEditor();
  });

  $("#frame-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    checkFrameUrl($("#frame-url")?.value);
  });

  $("#frame-history")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-history-url]");
    if (!row) return;
    $("#frame-url").value = row.dataset.historyUrl;
    checkFrameUrl(row.dataset.historyUrl);
  });

  $("#frame-catalog")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-check-url]");
    if (!button) return;
    $("#frame-url").value = button.dataset.checkUrl;
    checkFrameUrl(button.dataset.checkUrl);
  });

  $("#frame-result")?.addEventListener("click", (event) => {
    const visual = event.target.closest("[data-frame-visual]");
    if (visual) {
      window.manager.openFrameWindow({ url: visual.dataset.frameVisual, mode: "normal" });
      log("info", `Visual frame opened for ${visual.dataset.frameVisual}`);
    }
    const external = event.target.closest("[data-external]");
    if (external) window.manager.openExternal(external.dataset.external);
    const copy = event.target.closest("[data-copy-url]");
    if (copy) {
      window.manager.copyText(copy.dataset.copyUrl);
      toast("Copied", copy.dataset.copyUrl, "ok");
    }
  });

  $("#frame-visual")?.addEventListener("click", () => {
    const url = $("#frame-url")?.value.trim();
    if (!isHttp(url)) {
      toast("Invalid URL", "Enter a full http(s) URL first.", "error");
      return;
    }
    window.manager.openFrameWindow({ url, mode: "normal" });
    log("info", `Visual frame opened for ${url}`);
  });

  $("#frame-clear")?.addEventListener("click", () => {
    state.frameHistory = [];
    renderFrameHistory();
  });

  $("#offline-toggle")?.addEventListener("change", async (event) => {
    const result = await window.manager.setOffline(event.target.checked);
    updateOfflineUi(result.offline);
  });

  $("#open-shell")?.addEventListener("click", () => openTestWindow("app"));
  $("#open-deck")?.addEventListener("click", () => openTestWindow("v11"));
  $("#test-open")?.addEventListener("click", () => openTestWindow("app"));
  $("#overview-test-app")?.addEventListener("click", () => openTestWindow("app"));
  $("#test-close")?.addEventListener("click", async () => {
    await window.manager.closeAppWindow();
  });

  $$("[data-preset]").forEach((button) => {
    button.addEventListener("click", async () => {
      const result = await window.manager.resizeAppWindow(button.dataset.preset);
      if (!result.ok) {
        toast("No test window", "Open the app test window before applying a layout preset.", "warn");
        log("warn", "Layout preset ignored: no app test window.");
      }
    });
  });

  $$("[data-frame-mode]").forEach((button) => button.addEventListener("click", () => openFrameMode(button.dataset.frameMode)));

  $("#test-clear")?.addEventListener("click", () => {
    state.logs = [];
    renderConsole();
    log("info", "Test console cleared.");
  });

  $("#overview-assets")?.addEventListener("click", async () => {
    setPage("files");
    await rerunAssets();
  });
  $("#files-rerun")?.addEventListener("click", rerunAssets);

  $("#mirror-primary")?.addEventListener("input", (event) => {
    const draft = mirrorDraft();
    draft.primary = event.target.value;
    if (!draft.active) draft.active = event.target.value;
    renderMirrorActive();
  });
  $("#mirror-active")?.addEventListener("change", (event) => {
    mirrorDraft().active = event.target.value;
  });
  $("#mirror-list")?.addEventListener("input", (event) => {
    const row = event.target.closest("[data-mirror-index]");
    const field = event.target.dataset.mirrorField;
    if (!row || !field) return;
    const mirror = mirrorDraft().mirrors[Number(row.dataset.mirrorIndex)];
    if (!mirror) return;
    mirror[field] = event.target.value;
  });
  $("#mirror-list")?.addEventListener("click", (event) => {
    const drop = event.target.closest("[data-mirror-delete]");
    if (!drop) return;
    const draft = mirrorDraft();
    const [removed] = draft.mirrors.splice(Number(drop.dataset.mirrorDelete), 1);
    if (removed && draft.active === removed.origin) draft.active = draft.primary;
    renderMirrorRows();
    renderMirrorActive();
  });
  $("#mirror-add")?.addEventListener("click", () => {
    mirrorDraft().mirrors.push({ label: "", origin: "", note: "" });
    renderMirrorRows();
    renderMirrorActive();
    const rows = $$("[data-mirror-index]");
    rows.at(-1)?.querySelector("input")?.focus();
  });
  $("#mirror-remove")?.addEventListener("click", () => {
    const draft = mirrorDraft();
    const removed = draft.mirrors.pop();
    if (removed && draft.active === removed.origin) draft.active = draft.primary;
    renderMirrorRows();
    renderMirrorActive();
  });
  $("#mirrors-save")?.addEventListener("click", saveMirrors);
  $("#mirrors-check")?.addEventListener("click", checkMirrors);
  $("#mirrors-auto")?.addEventListener("click", autoMirrors);
  $("#files-reveal")?.addEventListener("click", () => window.manager.openPath("root"));
  $("#backup-now")?.addEventListener("click", async () => {
    const result = await window.manager.backupNow();
    if (result.ok) {
      adoptState(result.state);
      toast("Backup created", result.backup.name, "ok");
      log("ok", `Manual backup created · ${result.backup.name}`);
    } else {
      toast("Backup failed", result.error || "The main process refused the copy.", "error");
    }
  });

  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open]");
    if (open) {
      window.manager.openPath(open.dataset.open);
      return;
    }
    const jump = event.target.closest("[data-jump]");
    if (jump) setPage(jump.dataset.jump);
  });

  $("#overview-copy-root")?.addEventListener("click", async () => {
    const path = state.data?.workspace?.path;
    if (!path) return;
    await window.manager.copyText(path);
    toast("Workspace path copied", path, "ok");
  });
}

async function init() {
  bindEvents();
  renderConsole();
  log("info", "Manager renderer starting.");
  try {
    const data = await window.manager.getState();
    adoptState(data, { resetWorking: true });
    if (data.workspace) {
      log("ok", `Workspace resolved · ${data.workspace.path}`);
      log("info", `Catalog loaded · ${data.summary?.count || 0} entries.`);
      log(data.assets?.ok ? "ok" : "warn", data.assets?.ok ? "Asset inventory clean." : "Asset inventory needs attention.");
    } else {
      log("warn", "No workspace found. Choose the project folder from the top bar.");
      toast("Choose a workspace", "Point the Manager at the folder containing index.html and data/library.json.", "warn");
    }
    if (data.libraryError) log("error", data.libraryError);
  } catch (error) {
    setStatus("Manager failed to load", "error");
    toast("Startup error", error.message, "error");
    log("error", `Startup failed: ${error.message}`);
  }
  window.__managerReady = true;
}

init();
