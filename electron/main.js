"use strict";

const { app, BrowserWindow, Menu, ipcMain, shell, session, screen, globalShortcut } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const { createStaticServer } = require("./server");

const ROOT = path.join(__dirname, "..");
const SMOKE = process.argv.includes("--smoke");
const DEFAULT_HOTKEY = "CommandOrControl+Shift+H";
const VERSION = require("../package.json").version;

let mainWindow = null;
let staticServer = null;
let stealthHotkey = DEFAULT_HOTKEY;

function preferredDisplay() {
  const primary = screen.getPrimaryDisplay();
  const others = screen.getAllDisplays().filter((display) => display.id !== primary.id);
  if (others.length === 0) return primary;
  return [...others].sort((a, b) => b.workArea.width * b.workArea.height - a.workArea.width * a.workArea.height)[0];
}

function windowPlacement(width, height) {
  const display = preferredDisplay();
  const area = display.workArea;
  const finalWidth = Math.min(width, Math.max(720, area.width - 24));
  const finalHeight = Math.min(height, Math.max(560, area.height - 24));
  return {
    width: finalWidth,
    height: finalHeight,
    x: Math.round(area.x + (area.width - finalWidth) / 2),
    y: Math.round(area.y + (area.height - finalHeight) / 2),
  };
}

function isOnSecondary(win) {
  const primary = screen.getPrimaryDisplay();
  const secondary = screen.getAllDisplays().find((display) => display.id !== primary.id);
  if (!secondary || !win || win.isDestroyed()) return true;
  const bounds = win.getBounds();
  const area = secondary.workArea;
  const overlapWidth = Math.max(0, Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x));
  const overlapHeight = Math.max(0, Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y));
  return overlapWidth * overlapHeight >= bounds.width * bounds.height * 0.5;
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

function sendStealthToggle() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("shell:stealth-toggle");
  }
}

function registerStealthHotkey(accelerator) {
  const next = String(accelerator || "").trim() || DEFAULT_HOTKEY;
  const previous = stealthHotkey;
  try {
    if (previous) globalShortcut.unregister(previous);
  } catch {
    /* the previous accelerator may not have registered */
  }

  try {
    const ok = globalShortcut.register(next, sendStealthToggle);
    if (!ok) {
      if (previous) {
        try {
          globalShortcut.register(previous, sendStealthToggle);
        } catch {
          /* leave the renderer shortcut as the fallback */
        }
      }
      return { ok: false, error: `The system refused the shortcut ${next}. Another app may own it.`, hotkey: previous };
    }
    stealthHotkey = next;
    return { ok: true, hotkey: next };
  } catch (error) {
    if (previous) {
      try {
        globalShortcut.register(previous, sendStealthToggle);
      } catch {
        /* ignore */
      }
    }
    return { ok: false, error: error.message || `Could not register ${next}.`, hotkey: previous };
  }
}

async function readConfig() {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, "data", "config.json"), "utf8"));
  } catch {
    return {};
  }
}

function createWindow() {
  const placement = windowPlacement(1460, 940);
  mainWindow = new BrowserWindow({
    ...placement,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: "Pretzel's Unblocked Games: RETURN",
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

  mainWindow.once("ready-to-show", () => {
    if (!SMOKE) mainWindow.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!staticServer || !url.startsWith(staticServer.origin)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(`Renderer gone: ${details.reason} (exit ${details.exitCode})`);
  });

  mainWindow.loadURL(`${staticServer.origin}/`);
}

function registerIpc() {
  ipcMain.handle("shell:info", () => ({
    version: VERSION,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    stealthHotkey,
  }));

  ipcMain.handle("shell:open-external", async (_event, url) => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      return { ok: false, error: "Only http(s) links can open in the system browser." };
    }
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle("shell:stealth-hotkey", (_event, accelerator) => registerStealthHotkey(accelerator));

  ipcMain.handle("shell:stealth-hotkey-state", () => ({
    hotkey: stealthHotkey,
    registered: Boolean(globalShortcut.isRegistered(stealthHotkey)),
  }));
}

async function runSmoke() {
  const report = {
    app: "Pretzel's Unblocked Games: RETURN",
    version: VERSION,
    electron: process.versions.electron,
    checks: {},
    screenshots: [],
  };

  try {
    await new Promise((resolve, reject) => {
      if (!mainWindow) return reject(new Error("Main window was not created."));
      if (!mainWindow.webContents.isLoading()) return resolve();
      mainWindow.webContents.once("did-finish-load", resolve);
      mainWindow.webContents.once("did-fail-load", (_event, code, description) =>
        reject(new Error(`Renderer failed to load: ${code} ${description}`)),
      );
    });

    await mainWindow.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = setInterval(() => {
          if (window.__pretzelReady) { clearInterval(tick); resolve(true); }
          else if (Date.now() - start > 15000) { clearInterval(tick); reject(new Error("Shell never signalled ready")); }
        }, 100);
      })
    `);

    const shell = await mainWindow.webContents.executeJavaScript(`(() => ({
      title: document.title,
      ready: Boolean(window.__pretzelReady),
      desktop: window.pretzelShell?.isDesktop === true,
      bridge: typeof window.pretzelShell?.openExternal === "function",
      tiles: document.querySelectorAll(".tile").length,
      renderer: document.querySelector("#diag-renderer")?.textContent || "",
      offline: document.querySelector("#diag-offline")?.textContent || "",
      cloakHidden: document.querySelector("#cloak")?.hidden !== false,
      build: document.querySelector("#build-tag")?.textContent || "",
      hotkey: window.PretzelSettings?.get()?.stealthHotkey || ""
    }))()`);
    report.checks.shell = shell;

    const sw = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        if (!("serviceWorker" in navigator)) return { supported: false };
        const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
        let keys = [];
        try { keys = await caches.keys(); } catch { keys = []; }
        return {
          supported: true,
          registered: Boolean(reg),
          active: Boolean(reg && reg.active),
          scope: reg ? reg.scope : "",
          keys
        };
      })()
    `);
    report.checks.offlineCache = sw;

    const cloak = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const before = document.title;
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "h", code: "KeyH", ctrlKey: true, shiftKey: true, bubbles: true }));
        const overlay = document.querySelector("#cloak");
        const shown = overlay && !overlay.hidden;
        const changedTitle = document.title !== before;
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "h", code: "KeyH", ctrlKey: true, shiftKey: true, bubbles: true }));
        return {
          shown,
          changedTitle,
          hiddenAgain: overlay ? overlay.hidden : false,
          titleRestored: document.title === before
        };
      })()
    `);
    report.checks.cloak = cloak;

    report.checks.stealthHotkey = {
      expected: shell.hotkey || DEFAULT_HOTKEY,
      registered: Boolean(globalShortcut.isRegistered(stealthHotkey)),
      active: stealthHotkey,
    };
    report.checks.displays = {
      displays: displaySnapshot(),
      bounds: mainWindow.getBounds(),
      onSecondary: isOnSecondary(mainWindow),
    };

    const smokeDir = app.isPackaged ? path.join(app.getPath("userData"), "smoke") : path.join(ROOT, ".smoke");
    await fs.mkdir(smokeDir, { recursive: true });
    mainWindow.showInactive();
    await new Promise((resolve) => setTimeout(resolve, 550));
    const shellImage = await mainWindow.capturePage();
    const shellPath = path.join(smokeDir, "electron-shell.png");
    await fs.writeFile(shellPath, shellImage.toPNG());
    report.screenshots.push(shellPath);

    await mainWindow.webContents.executeJavaScript(`
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "h", code: "KeyH", ctrlKey: true, shiftKey: true, bubbles: true }));
    `);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const cloakImage = await mainWindow.capturePage();
    const cloakPath = path.join(smokeDir, "electron-cloak.png");
    await fs.writeFile(cloakPath, cloakImage.toPNG());
    report.screenshots.push(cloakPath);
    await mainWindow.webContents.executeJavaScript(`
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "h", code: "KeyH", ctrlKey: true, shiftKey: true, bubbles: true }));
    `);

    report.ok =
      shell.ready &&
      shell.desktop &&
      shell.bridge &&
      shell.tiles > 0 &&
      shell.renderer === "Electron shell" &&
      sw.registered === true &&
      sw.active === true &&
      Array.isArray(sw.keys) &&
      sw.keys.some((key) => key.startsWith("pretzel-shell-")) &&
      cloak.shown === true &&
      cloak.changedTitle === true &&
      cloak.hiddenAgain === true &&
      cloak.titleRestored === true &&
      report.checks.stealthHotkey.registered === true &&
      report.checks.displays.onSecondary === true;
  } catch (error) {
    report.ok = false;
    report.error = error.stack || error.message;
  }

  console.log(`__PRETZEL_SMOKE__${JSON.stringify(report)}`);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  app.exit(report.ok ? 0 : 1);
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.pretzel.return");
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  staticServer = await createStaticServer(() => ROOT);
  registerIpc();

  const config = await readConfig();
  const configuredHotkey = config?.stealth?.hotkey || DEFAULT_HOTKEY;
  const hotkeyResult = registerStealthHotkey(configuredHotkey);
  if (!hotkeyResult.ok) console.error(`Stealth hotkey: ${hotkeyResult.error}`);

  createWindow();
  if (SMOKE) runSmoke();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (staticServer) staticServer.close().catch(() => {});
});
