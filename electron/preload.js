"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pretzelShell", {
  isDesktop: true,
  platform: process.platform,
  getInfo: () => ipcRenderer.invoke("shell:info"),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  setStealthHotkey: (accelerator) => ipcRenderer.invoke("shell:stealth-hotkey", accelerator),
  getStealthHotkey: () => ipcRenderer.invoke("shell:stealth-hotkey-state"),
  onStealthToggle: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on("shell:stealth-toggle", wrapped);
    return () => ipcRenderer.removeListener("shell:stealth-toggle", wrapped);
  },
});
