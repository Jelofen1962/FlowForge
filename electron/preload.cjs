const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("flowforge", {
  start: payload => ipcRenderer.invoke("engine:start", payload),
  stop: () => ipcRenderer.invoke("engine:stop"),
  saveProfile: profile => ipcRenderer.invoke("profile:save", profile),
  listProfiles: () => ipcRenderer.invoke("profile:list"),
  openExternal: url => ipcRenderer.invoke("open:external", url),
  onLog: callback => { const fn = (_e, value) => callback(value); ipcRenderer.on("engine:log", fn); return () => ipcRenderer.removeListener("engine:log", fn); },
  onFinished: callback => { const fn = (_e, value) => callback(value); ipcRenderer.on("engine:finished", fn); return () => ipcRenderer.removeListener("engine:finished", fn); }
});