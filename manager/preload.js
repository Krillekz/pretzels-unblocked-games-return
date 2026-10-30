"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("manager", {
  getState: () => ipcRenderer.invoke("manager:get-state"),
  chooseWorkspace: () => ipcRenderer.invoke("manager:choose-workspace"),
  validateCatalog: (catalog) => ipcRenderer.invoke("manager:validate-catalog", catalog),
  saveCatalog: (catalog) => ipcRenderer.invoke("manager:save-catalog", catalog),
  backupNow: () => ipcRenderer.invoke("manager:backup-now"),
  testAssets: () => ipcRenderer.invoke("manager:test-assets"),
  checkUrl: (url) => ipcRenderer.invoke("manager:check-url", url),
  openExternal: (url) => ipcRenderer.invoke("manager:open-external", url),
  openPath: (target) => ipcRenderer.invoke("manager:open-path", target),
  copyText: (text) => ipcRenderer.invoke("manager:copy-text", text),
  openAppWindow: (options) => ipcRenderer.invoke("manager:open-app-window", options),
  resizeAppWindow: (preset) => ipcRenderer.invoke("manager:resize-app-window", preset),
  closeAppWindow: () => ipcRenderer.invoke("manager:close-app-window"),
  setOffline: (enabled) => ipcRenderer.invoke("manager:set-offline", enabled),
  openFrameWindow: (options) => ipcRenderer.invoke("manager:open-frame-window", options),
  saveMirrors: (manifest) => ipcRenderer.invoke("manager:save-mirrors", manifest),
  checkMirrors: (manifest) => ipcRenderer.invoke("manager:check-mirrors", manifest),
  autoMirrors: (manifest) => ipcRenderer.invoke("manager:auto-mirrors", manifest),
  onEvent: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("manager:event", wrapped);
    return () => ipcRenderer.removeListener("manager:event", wrapped);
  },
  meta: {
    isManager: true,
    platform: process.platform,
  },
});
