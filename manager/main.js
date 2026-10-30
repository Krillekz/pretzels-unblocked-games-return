"use strict";

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session, screen, clipboard } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const { validateCatalog, summarizeCatalog } = require("./lib/catalog");
const {
  findWorkspace,
  isWorkspace,
  loadSettings,
  saveSettings,
  readLibrary,
  readConfig,
  listBackups,
  backupNow,
  saveLibrary,
} = require("./lib/workspace");
const { checkDeploymentAssets } = require("./lib/assets");
const { checkFrame } = require("./lib/frame-check");
const { createStaticServer } = require("./lib/server");
const {
  validateManifest,
  readManifest,
  saveManifest,
  checkAll,
  autoRoute,
} = require("./lib/mirrors");

const BUILD = "m2";
const VERSION = require("./package.json").version;
const SMOKE = process.argv.includes("--smoke");

let mainWindow = null;
let testWindow = null;
let staticServer = null;
let workspace = null;
let testOffline = false;
let saveChain = Promise.resolve();
const frameWindows = new Set();

function testSession() {
  return session.fromPartition("manager-test");
}

function preferredDisplay() {
  const primary = screen.getPrimaryDisplay();
  const others = screen.getAllDisplays().filter((display) => display.id !== primary.id);
  if (others.length === 0) return primary;
  // Prefer the widest secondary display, which is normally the second monitor.
  return [...others].sort((a, b) => b.workArea.width * b.workArea.height - a.workArea.width * a.workArea.height)[0];
}

function windowPlacement(width, height) {
  const display = preferredDisplay();
  const area = display.workArea;
  const finalWidth = Math.min(width, Math.max(320, area.width - 24));
  const finalHeight = Math.min(height, Math.max(420, area.height - 24));
  return {
    width: finalWidth,
    height: finalHeight,
    x: Math.round(area.x + (area.width - finalWidth) / 2),
    y: Math.round(area.y + (area.height - finalHeight) / 2),
  };
}

function displaySnapshot() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((display) => ({
    id: display.id,
    primary: display.id === primary.id,
    bounds: display.bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
  }));
}

function isOnSecondary(win) {
  const secondary = screen.getAllDisplays().find((display) => display.id !== screen.getPrimaryDisplay().id);
  if (!secondary || !win || win.isDestroyed()) return true;
  const bounds = win.getBounds();
  const area = secondary.workArea;
  const overlapWidth = Math.max(0, Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x));
  const overlapHeight = Math.max(0, Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y));
  return overlapWidth * overlapHeight >= bounds.width * bounds.height * 0.5;
}

function tell(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("manager:event", payload);
  }
}

function localOrigin() {
  return staticServer?.origin || "";
}

async function buildState(extra = {}) {
  let library = null;
  let libraryError = "";
  let validation = null;
  let catalog = null;
  let libraryStat = null;

  if (workspace) {
    try {
      const loaded = await readLibrary(workspace);
      library = loaded.raw;
      catalog = loaded.raw;
      validation = validateCatalog(loaded.raw);
      const stat = await fs.stat(loaded.file);
      libraryStat = { bytes: stat.size, modified: stat.mtime.toISOString() };
    } catch (error) {
      libraryError = error.code === "ENOENT" ? "data/library.json is missing." : error.message;
      validation = { ok: false, errors: [{ path: "data/library.json", message: libraryError }], warnings: [] };
    }
  }

  const [backups, config, assets, mirrorManifest] = await Promise.all([
    workspace ? listBackups(workspace) : Promise.resolve([]),
    workspace ? readConfig(workspace) : Promise.resolve(null),
    workspace ? checkDeploymentAssets(workspace) : Promise.resolve(null),
    workspace ? readManifest(workspace) : Promise.resolve(null),
  ]);

  return {
    manager: {
      version: VERSION,
      build: BUILD,
      phase: "Phase 6",
      smoke: SMOKE,
    },
    runtime: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    },
    workspace: workspace
      ? {
          path: workspace,
          name: path.basename(workspace),
          libraryFile: path.join(workspace, "data", "library.json"),
          configFile: path.join(workspace, "data", "config.json"),
          backupDir: path.join(workspace, ".manager", "backups"),
        }
      : null,
    catalog,
    libraryError,
    libraryStat,
    validation,
    summary: catalog ? summarizeCatalog(catalog) : null,
    backups: backups.slice(0, 12),
    backupCount: backups.length,
    config,
    assets,
    mirrors: mirrorManifest
      ? {
          primary: mirrorManifest.primary || "",
          active: mirrorManifest.active || "",
          updated: mirrorManifest.updated || "",
          mirrors: mirrorManifest.mirrors,
          mirrorCount: mirrorManifest.mirrors.length,
        }
      : null,
    server: { origin: localOrigin() },
    test: {
      offline: testOffline,
      windowOpen: Boolean(testWindow && !testWindow.isDestroyed()),
      size: testWindow && !testWindow.isDestroyed() ? testWindow.getContentSize() : null,
      url: testWindow && !testWindow.isDestroyed() ? testWindow.webContents.getURL() : "",
      frameWindows: frameWindows.size,
    },
    settingsFile: path.join(app.getPath("userData"), "manager-settings.json"),
    ...extra,
  };
}

function createWindow() {
  const placement = windowPlacement(1460, 940);
  mainWindow = new BrowserWindow({
    ...placement,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    title: "Pretzel Manager",
    backgroundColor: "#0b0908",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => {
    if (!SMOKE) mainWindow.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function applyPreset(preset) {
  if (!testWindow || testWindow.isDestroyed()) return null;
  const presets = {
    wide: { width: 1440, height: 900 },
    compact: { width: 860, height: 720 },
    tiny: { width: 390, height: 720 },
  };
  const size = presets[preset];
  if (!size) return null;
  const placement = windowPlacement(size.width, size.height);
  testWindow.setContentSize(placement.width, placement.height);
  testWindow.setPosition(placement.x, placement.y);
  return testWindow.getContentSize();
}

function openAppWindow() {
  if (!staticServer || !workspace) return { ok: false, error: "Choose a workspace first." };
  const target = `${staticServer.origin}/`;

  if (testWindow && !testWindow.isDestroyed()) {
    testWindow.loadURL(target);
    testWindow.show();
    testWindow.focus();
    return { ok: true, reused: true, url: target };
  }

  testWindow = new BrowserWindow({
    ...windowPlacement(1280, 840),
    minWidth: 320,
    minHeight: 480,
    show: false,
    title: "Pretzel test window",
    backgroundColor: "#0b0908",
    autoHideMenuBar: true,
    webPreferences: {
      partition: "manager-test",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  testWindow.once("ready-to-show", () => {
    if (!SMOKE) testWindow.show();
    tell({ type: "app-window", state: "opened", size: testWindow.getContentSize(), url: target });
  });
  testWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  testWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(staticServer.origin)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  testWindow.webContents.on("did-finish-load", () => {
    if (!testWindow || testWindow.isDestroyed()) return;
    tell({
      type: "app-window",
      state: "loaded",
      size: testWindow.getContentSize(),
      url: testWindow.webContents.getURL(),
    });
  });
  testWindow.on("resize", () => {
    if (!testWindow || testWindow.isDestroyed()) return;
    tell({ type: "app-window", state: "resized", size: testWindow.getContentSize() });
  });
  testWindow.on("closed", () => {
    testWindow = null;
    tell({ type: "app-window", state: "closed" });
  });
  testWindow.loadURL(target);
  return { ok: true, reused: false, url: target };
}

function openFrameWindow({ url = "", mode = "normal" } = {}) {
  const allowed = new Set(["normal", "blocked", "crash"]);
  const safeMode = allowed.has(mode) ? mode : "normal";
  const safeUrl = typeof url === "string" && /^https?:\/\//i.test(url) ? url.slice(0, 2048) : "";
  const win = new BrowserWindow({
    ...windowPlacement(1180, 820),
    minWidth: 520,
    minHeight: 420,
    show: !SMOKE,
    title: `Frame test — ${safeMode}`,
    backgroundColor: "#0b0908",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  frameWindows.add(win);
  win.on("closed", () => frameWindows.delete(win));
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target)) shell.openExternal(target);
    return { action: "deny" };
  });
  win.loadFile(path.join(__dirname, "lab", "frame.html"), { query: { mode: safeMode, url: safeUrl } });
  return { ok: true };
}

function registerIpc() {
  ipcMain.handle("manager:get-state", () => buildState());

  ipcMain.handle("manager:choose-workspace", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose the Pretzel workspace",
      defaultPath: workspace || app.getPath("documents"),
      properties: ["openDirectory"],
      buttonLabel: "Use this folder",
    });
    if (result.canceled || !result.filePaths[0]) return buildState({ chooseCanceled: true });
    const candidate = result.filePaths[0];
    if (!(await isWorkspace(candidate))) {
      return buildState({
        chooseError: "That folder does not look like the workspace: index.html, js/app.js and data/library.json are required.",
      });
    }
    workspace = candidate;
    const settings = await loadSettings();
    await saveSettings({ ...settings, lastWorkspace: candidate });
    if (testWindow && !testWindow.isDestroyed()) testWindow.close();
    tell({ type: "workspace", path: candidate });
    return buildState({ workspaceChanged: true });
  });

  ipcMain.handle("manager:validate-catalog", (_event, catalog) => validateCatalog(catalog));

  ipcMain.handle("manager:save-catalog", async (_event, catalog) => {
    if (!workspace) return { ok: false, errors: [{ path: "", message: "Choose a workspace first." }], warnings: [] };
    const root = workspace;
    const run = () => saveLibrary(root, catalog);
    const next = saveChain.then(run, run);
    saveChain = next.catch(() => {});
    const result = await next;
    if (result.ok) {
      tell({ type: "catalog-saved", backup: result.backup?.name || null, count: result.catalog.games.length });
    }
    return { ...result, state: await buildState() };
  });

  ipcMain.handle("manager:backup-now", async () => {
    if (!workspace) return { ok: false, error: "Choose a workspace first." };
    try {
      const backup = await backupNow(workspace);
      tell({ type: "backup", name: backup.name });
      return { ok: true, backup, state: await buildState() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("manager:test-assets", async () => {
    if (!workspace) return { ok: false, error: "Choose a workspace first." };
    return checkDeploymentAssets(workspace);
  });

  ipcMain.handle("manager:check-url", async (_event, url) => {
    if (typeof url !== "string" || url.length > 2048) {
      return { ok: false, error: "Enter a URL of 2048 characters or fewer." };
    }
    return checkFrame(url.trim());
  });

  ipcMain.handle("manager:open-external", async (_event, url) => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return { ok: false, error: "Only http(s) links can open." };
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle("manager:open-path", async (_event, target) => {
    if (!workspace) return { ok: false, error: "Choose a workspace first." };
    const map = {
      root: workspace,
      data: path.join(workspace, "data"),
      library: path.join(workspace, "data", "library.json"),
      config: path.join(workspace, "data", "config.json"),
      backups: path.join(workspace, ".manager", "backups"),
      manager: __dirname,
      readme: path.join(workspace, "README.md"),
    };
    const targetPath = map[target];
    if (!targetPath) return { ok: false, error: "Unknown location." };
    if (target === "backups") await fs.mkdir(targetPath, { recursive: true });
    const error = await shell.openPath(targetPath);
    return error ? { ok: false, error } : { ok: true };
  });

  ipcMain.handle("manager:copy-text", (_event, text) => {
    if (typeof text !== "string") return { ok: false };
    clipboard.writeText(text);
    return { ok: true };
  });

  ipcMain.handle("manager:open-app-window", () => openAppWindow());

  ipcMain.handle("manager:resize-app-window", (_event, preset) => {
    const size = applyPreset(preset);
    if (!size) return { ok: false, error: "Open the app test window first." };
    tell({ type: "app-window", state: "resized", size });
    return { ok: true, size };
  });

  ipcMain.handle("manager:close-app-window", () => {
    if (testWindow && !testWindow.isDestroyed()) testWindow.close();
    return { ok: true };
  });

  ipcMain.handle("manager:set-offline", (_event, enabled) => {
    testOffline = enabled === true;
    tell({ type: "offline", offline: testOffline });
    return { ok: true, offline: testOffline };
  });

  ipcMain.handle("manager:open-frame-window", (_event, options = {}) => openFrameWindow(options));

  ipcMain.handle("manager:save-mirrors", async (_event, manifest) => {
    if (!workspace) return { ok: false, errors: [{ path: "", message: "Choose a workspace first." }], warnings: [] };
    const result = await saveManifest(workspace, manifest);
    if (result.ok) {
      tell({ type: "mirrors-saved", active: result.manifest.active, backup: result.backup, count: result.manifest.mirrors.length });
    }
    return { ...result, state: await buildState() };
  });

  ipcMain.handle("manager:check-mirrors", async (_event, manifest) => {
    if (!workspace) return { ok: false, errors: [{ path: "", message: "Choose a workspace first." }], warnings: [] };
    return checkAll(workspace, manifest);
  });

  ipcMain.handle("manager:auto-mirrors", async (_event, manifest) => {
    if (!workspace) return { ok: false, errors: [{ path: "", message: "Choose a workspace first." }], warnings: [] };
    const result = await autoRoute(workspace, manifest);
    if (result.ok) {
      tell({ type: "mirrors-saved", active: result.active, backup: result.backup, count: result.manifest.mirrors.length });
    }
    return { ...result, state: await buildState() };
  });
}

async function runSmoke() {
  const started = Date.now();
  const report = {
    app: "Pretzel Manager",
    version: VERSION,
    build: BUILD,
    workspace,
    checks: {},
    screenshots: [],
  };

  try {
    await new Promise((resolve, reject) => {
      if (!mainWindow) return reject(new Error("Manager window was not created."));
      if (!mainWindow.webContents.isLoading()) return resolve();
      mainWindow.webContents.once("did-finish-load", resolve);
      mainWindow.webContents.once("did-fail-load", (_e, code, description) =>
        reject(new Error(`Renderer failed to load: ${code} ${description}`)),
      );
    });

    await mainWindow.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = setInterval(() => {
          if (window.__managerReady) { clearInterval(tick); resolve(true); }
          else if (Date.now() - start > 12000) { clearInterval(tick); reject(new Error("Renderer never signalled ready")); }
        }, 100);
      })
    `);

    const overview = await mainWindow.webContents.executeJavaScript(`(() => ({
      title: document.title,
      ready: Boolean(window.__managerReady),
      bridge: typeof window.manager?.getState === "function",
      routes: [...document.querySelectorAll("[data-route]")].map((node) => node.dataset.route),
      activePage: document.querySelector(".page.is-active")?.dataset.page || null,
      activeRail: [...document.querySelectorAll(".rail-btn.is-active")].map((node) => node.dataset.route),
      gameRows: document.querySelectorAll("[data-game-row]").length,
      workspace: document.querySelector("#workspace-name")?.textContent.trim() || "",
      build: document.querySelector("#build-chip")?.textContent.trim() || ""
    }))()`);
    report.checks.renderer = overview;
    report.checks.displays = {
      displays: displaySnapshot(),
      mainBounds: mainWindow.getBounds(),
      onSecondary: isOnSecondary(mainWindow),
    };

    const state = await mainWindow.webContents.executeJavaScript(`window.manager.getState()`);
    report.checks.state = {
      games: state.summary?.count ?? 0,
      valid: state.validation?.ok === true,
      backups: state.backupCount,
      workspace: state.workspace?.path || null,
      server: state.server?.origin || null,
      electron: state.runtime.electron,
      assetsOk: state.assets?.ok === true,
    };

    const validation = await mainWindow.webContents.executeJavaScript(`
      window.manager.validateCatalog({version:1,games:[
        {id:"ok",title:"Valid",genre:"Puzzle",platform:"HTML5",url:"https://example.com/",cover:"",needsProxy:false,tags:["test"]},
        {id:"ok",title:"Duplicate",genre:"Puzzle",platform:"HTML5",url:"not-a-url",cover:"",needsProxy:false,tags:[]}
      ]})
    `);
    report.checks.validation = {
      ok: validation.ok,
      errors: validation.errors.length,
      duplicateCaught: validation.errors.some((error) => /Duplicate/.test(error.message)),
      urlCaught: validation.errors.some((error) => /URL/.test(error.message)),
    };

    const assets = await mainWindow.webContents.executeJavaScript(`window.manager.testAssets()`);
    report.checks.assets = {
      ok: assets.ok,
      present: assets.totals?.present,
      expected: assets.totals?.expected,
      missing: assets.missingRequired,
      broken: assets.brokenReferences?.length ?? 0,
    };

    const roundtripRoot = await fs.mkdtemp(path.join(require("os").tmpdir(), "pretzel-manager-smoke-"));
    try {
      await fs.mkdir(path.join(roundtripRoot, "data"), { recursive: true });
      const seed = {
        version: 1,
        updated: "2026-01-01",
        games: [
          { id: "seed", title: "Seed", genre: "Puzzle", platform: "HTML5", url: "https://example.com/", cover: "", needsProxy: false, tags: [] },
        ],
      };
      await fs.writeFile(path.join(roundtripRoot, "data", "library.json"), JSON.stringify(seed, null, 2));
      const saved = await saveLibrary(roundtripRoot, {
        ...seed,
        games: [{ ...seed.games[0], title: "Seed edited" }],
      });
      const backups = await listBackups(roundtripRoot);
      const afterSave = JSON.parse(await fs.readFile(path.join(roundtripRoot, "data", "library.json"), "utf8"));
      const rejected = await saveLibrary(roundtripRoot, { version: 1, games: [{ id: "x", title: "", genre: "Puzzle", platform: "HTML5", url: "nope", cover: "", needsProxy: false, tags: [] }] });
      const backupsAfterReject = await listBackups(roundtripRoot);
      const afterReject = JSON.parse(await fs.readFile(path.join(roundtripRoot, "data", "library.json"), "utf8"));
      report.checks.saveRoundtrip = {
        saved: saved.ok === true,
        backupCreated: backups.length === 1,
        newTitle: afterSave.games[0].title,
        rejectedInvalid: rejected.ok === false,
        invalidDidNotWrite: backupsAfterReject.length === 1 && afterReject.games[0].title === "Seed edited",
      };

      const mirrorRejected = validateManifest({
        primary: "https://primary.example.com/",
        active: "https://primary.example.com/",
        mirrors: [
          { label: "Mirror", origin: "https://mirror.example.com/" },
          { label: "Mirror duplicate", origin: "https://mirror.example.com/" },
        ],
      });
      const mirrorBadOrigin = validateManifest({ primary: "ftp://nope", active: "", mirrors: [] });
      await fs.writeFile(path.join(roundtripRoot, "index.html"), "<!doctype html><title>mirror seed</title>");
      const firstMirrorSave = await saveManifest(roundtripRoot, {
        primary: "https://primary.example.com/",
        active: "https://primary.example.com/",
        mirrors: [{ label: "Backup host", origin: "https://mirror.example.com/", note: "Static copy" }],
      });
      const secondMirrorSave = await saveManifest(roundtripRoot, {
        ...firstMirrorSave.manifest,
        active: "https://mirror.example.com/",
      });
      const mirrorFile = JSON.parse(await fs.readFile(path.join(roundtripRoot, "data", "mirrors.json"), "utf8"));
      report.checks.mirrors = {
        duplicateRejected: mirrorRejected.ok === false,
        badOriginRejected: mirrorBadOrigin.ok === false,
        saved: firstMirrorSave.ok === true,
        backupCreated: Boolean(secondMirrorSave.backup),
        activeSwitched: mirrorFile.active === "https://mirror.example.com/",
        fingerprintStored: /^[a-f0-9]{64}$/.test(mirrorFile.indexSha256 || ""),
      };
    } finally {
      await fs.rm(roundtripRoot, { recursive: true, force: true });
    }

    const uiDraft = await mainWindow.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-route="library"]')?.click();
      const before = document.querySelectorAll("[data-game-row]").length;
      document.querySelector("#game-new")?.click();
      document.querySelector("#game-id").value = "smoke-draft";
      document.querySelector("#game-title").value = "Smoke Draft";
      document.querySelector("#game-genre").value = "Puzzle";
      document.querySelector("#game-url").value = "https://example.com/";
      document.querySelector("#game-form")?.requestSubmit();
      const after = document.querySelectorAll("[data-game-row]").length;
      const dirty = document.querySelector("#library-dirty")?.hidden === false;
      document.querySelector("#catalog-discard")?.click();
      const afterDiscard = document.querySelectorAll("[data-game-row]").length;
      return { before, after, dirty, afterDiscard, draftCleared: document.querySelector("#game-form")?.hidden === true };
    })()`);
    report.checks.uiDraft = uiDraft;

    let frame = null;
    try {
      frame = await mainWindow.webContents.executeJavaScript(`window.manager.checkUrl("https://example.com/")`);
    } catch (error) {
      frame = { ok: false, error: error.message };
    }
    report.checks.frame = {
      ok: frame?.ok === true,
      status: frame?.status ?? null,
      verdict: frame?.frame?.verdict ?? null,
      xfo: frame?.headers?.["x-frame-options"] ?? null,
      note: frame?.error || frame?.note || "",
    };

    const smokeDir = path.join(workspace || __dirname, "manager", ".smoke");
    await fs.mkdir(smokeDir, { recursive: true });

    const frameLabOpen = openFrameWindow({ url: "https://example.com/", mode: "blocked" });
    const labWindow = [...frameWindows].at(-1);
    if (labWindow) {
      await new Promise((resolve) => {
        if (!labWindow.webContents.isLoading()) return resolve();
        labWindow.webContents.once("did-finish-load", resolve);
        setTimeout(resolve, 6000);
      });
      const labCheck = await labWindow.webContents.executeJavaScript(`({
        mode: document.querySelector("#mode-label")?.textContent,
        blockedVisible: document.querySelector("#blocked-panel")?.hidden === false,
        crashHidden: document.querySelector("#crash-panel")?.hidden === true,
        hostText: document.querySelector("#blocked-host")?.textContent
      })`);
      labWindow.showInactive();
      await new Promise((resolve) => setTimeout(resolve, 300));
      const labImage = await labWindow.capturePage();
      const labPath = path.join(smokeDir, "frame-lab.png");
      await fs.writeFile(labPath, labImage.toPNG());
      report.screenshots.push(labPath);
      labWindow.close();
      frameWindows.delete(labWindow);
      labCheck.onSecondary = isOnSecondary(labWindow);
      labCheck.bounds = labWindow.getBounds();
      report.checks.frameLab = { opened: frameLabOpen.ok === true, ...labCheck };
    } else {
      report.checks.frameLab = { opened: false };
    }

    const appOpen = openAppWindow("app");
    await new Promise((resolve) => {
      if (!testWindow) return resolve();
      if (!testWindow.webContents.isLoading()) return resolve();
      testWindow.webContents.once("did-finish-load", resolve);
      setTimeout(resolve, 8000);
    });
    let appWindowCheck = { opened: appOpen.ok === true };
    if (testWindow && !testWindow.isDestroyed()) {
      await testWindow.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const start = Date.now();
          const tick = setInterval(() => {
            if (document.querySelectorAll(".card").length > 0 || Date.now() - start > 6000) {
              clearInterval(tick);
              resolve(true);
            }
          }, 100);
        })
      `);
      appWindowCheck = await testWindow.webContents.executeJavaScript(`({
        opened: true,
        title: document.title,
        tiles: document.querySelectorAll(".card").length,
        shell: Boolean(document.querySelector("#lib-grid")),
        fileProtocol: location.protocol
      })`);
      appWindowCheck.onSecondary = isOnSecondary(testWindow);
      applyPreset("compact");
      await new Promise((resolve) => setTimeout(resolve, 250));
      appWindowCheck.compactWidth = await testWindow.webContents.executeJavaScript("window.innerWidth");
      applyPreset("tiny");
      await new Promise((resolve) => setTimeout(resolve, 250));
      appWindowCheck.tinyWidth = await testWindow.webContents.executeJavaScript("window.innerWidth");

      await mainWindow.webContents.executeJavaScript(`window.manager.setOffline(true)`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      appWindowCheck.offlineBlocked = await testWindow.webContents.executeJavaScript(`
        fetch("https://example.com/?offline=" + Date.now(), { mode: "no-cors", cache: "no-store" })
          .then(() => false)
          .catch(() => true)
      `);
      await mainWindow.webContents.executeJavaScript(`window.manager.setOffline(false)`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      appWindowCheck.onlineRestored = await testWindow.webContents.executeJavaScript(`
        fetch("https://example.com/?online=" + Date.now(), { mode: "no-cors", cache: "no-store" })
          .then(() => true)
          .catch(() => false)
      `);

      testWindow.close();
      testWindow = null;
    }
    report.checks.appWindow = appWindowCheck;

    mainWindow.showInactive();
    await new Promise((resolve) => setTimeout(resolve, 450));

    await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-route="overview"]')?.click()`);
    await new Promise((resolve) => setTimeout(resolve, 450));
    const image = await mainWindow.capturePage();
    const overviewPath = path.join(smokeDir, "overview.png");
    await fs.writeFile(overviewPath, image.toPNG());
    report.screenshots.push(overviewPath);

    await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-route="library"]')?.click()`);
    await new Promise((resolve) => setTimeout(resolve, 450));
    const libraryImage = await mainWindow.capturePage();
    const libraryPath = path.join(smokeDir, "library.png");
    await fs.writeFile(libraryPath, libraryImage.toPNG());
    report.screenshots.push(libraryPath);

    await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-route="test"]')?.click()`);
    await new Promise((resolve) => setTimeout(resolve, 450));
    const testImage = await mainWindow.capturePage();
    const testPath = path.join(smokeDir, "test-lab.png");
    await fs.writeFile(testPath, testImage.toPNG());
    report.screenshots.push(testPath);

    await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-route="mirrors"]')?.click()`);
    await new Promise((resolve) => setTimeout(resolve, 450));
    const mirrorImage = await mainWindow.capturePage();
    const mirrorPath = path.join(smokeDir, "mirrors.png");
    await fs.writeFile(mirrorPath, mirrorImage.toPNG());
    report.screenshots.push(mirrorPath);
    report.checks.mirrorPage = await mainWindow.webContents.executeJavaScript(`({
      activePage: [...document.querySelectorAll(".page.is-active")].map((node) => node.dataset.page),
      primaryField: Boolean(document.querySelector("#mirror-primary")),
      activeOptions: document.querySelectorAll("#mirror-active option").length,
      rows: document.querySelectorAll("[data-mirror-index]").length,
      summary: document.querySelector("#mirrors-summary")?.textContent.trim().slice(0, 80) || ""
    })`);

    mainWindow.setContentSize(1040, 740);
    await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-route="overview"]')?.click()`);
    await new Promise((resolve) => setTimeout(resolve, 550));
    const compactImage = await mainWindow.capturePage();
    const compactPath = path.join(smokeDir, "compact-1040.png");
    await fs.writeFile(compactPath, compactImage.toPNG());
    report.screenshots.push(compactPath);
    report.checks.nav = await mainWindow.webContents.executeJavaScript(`({
      activeRail: [...document.querySelectorAll(".rail-btn.is-active")].map((node) => node.dataset.route),
      activePage: [...document.querySelectorAll(".page.is-active")].map((node) => node.dataset.page),
      deckWidth: document.querySelector(".deck")?.getBoundingClientRect().width || 0,
      pageWidth: document.querySelector(".page.is-active")?.getBoundingClientRect().width || 0,
      pageOpacity: getComputedStyle(document.querySelector(".page.is-active")).opacity
    })`);

    report.ok =
      overview.ready &&
      overview.bridge &&
      overview.routes.length === 6 &&
      overview.activeRail.length === 1 &&
      overview.activeRail[0] === "overview" &&
      overview.gameRows > 0 &&
      state.validation?.ok === true &&
      validation.ok === false &&
      report.checks.validation.duplicateCaught &&
      report.checks.validation.urlCaught &&
      assets.ok === true &&
      report.checks.saveRoundtrip?.saved === true &&
      report.checks.saveRoundtrip?.backupCreated === true &&
      report.checks.saveRoundtrip?.rejectedInvalid === true &&
      report.checks.saveRoundtrip?.invalidDidNotWrite === true &&
      report.checks.mirrors?.duplicateRejected === true &&
      report.checks.mirrors?.badOriginRejected === true &&
      report.checks.mirrors?.saved === true &&
      report.checks.mirrors?.backupCreated === true &&
      report.checks.mirrors?.activeSwitched === true &&
      report.checks.mirrors?.fingerprintStored === true &&
      report.checks.mirrorPage?.activePage[0] === "mirrors" &&
      report.checks.mirrorPage?.primaryField === true &&
      report.checks.nav?.activeRail.length === 1 &&
      report.checks.nav?.activePage.length === 1 &&
      report.checks.nav?.activePage[0] === "overview" &&
      report.checks.nav?.deckWidth > 600 &&
      report.checks.nav?.pageOpacity !== "0" &&
      uiDraft.dirty === true &&
      uiDraft.after === uiDraft.before + 1 &&
      uiDraft.afterDiscard === uiDraft.before &&
      appWindowCheck.tiles > 0 &&
      appWindowCheck.shell === true &&
      report.checks.frameLab?.opened === true &&
      report.checks.frameLab?.blockedVisible === true &&
      report.checks.frameLab?.mode === "BLOCKED" &&
      appWindowCheck.compactWidth === 860 &&
      appWindowCheck.tinyWidth === 390 &&
      appWindowCheck.offlineBlocked === true &&
      appWindowCheck.onSecondary !== false &&
      report.checks.frameLab?.onSecondary !== false &&
      report.checks.displays?.onSecondary !== false;
    report.elapsedMs = Date.now() - started;
  } catch (error) {
    report.ok = false;
    report.error = error.stack || error.message;
  }

  console.log(`__MANAGER_SMOKE__${JSON.stringify(report)}`);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  app.exit(report.ok ? 0 : 1);
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.pretzel.manager");
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  workspace = await findWorkspace();
  staticServer = await createStaticServer(() => workspace || process.cwd());

  testSession().webRequest.onBeforeRequest((details, callback) => {
    if (testOffline && /^https?:/i.test(details.url)) {
      try {
        const parsed = new URL(details.url);
        const local = ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
        if (!local) return callback({ cancel: true });
      } catch {
        /* malformed requests are left to Chromium */
      }
    }
    callback({});
  });

  registerIpc();
  createWindow();

  if (SMOKE) {
    runSmoke();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});

app.on("before-quit", () => {
  if (staticServer) staticServer.close().catch(() => {});
});
