const { contextBridge, ipcRenderer } = require("electron");
const subscribe = (channel, callback) => {
  const fn = (_event, value) => callback(value);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};
contextBridge.exposeInMainWorld("flowforge", {
  start: payload => ipcRenderer.invoke("engine:start", payload),
  stop: () => ipcRenderer.invoke("engine:stop"),
  recorderStart: payload => ipcRenderer.invoke("recorder:start", payload),
  recorderStop: () => ipcRenderer.invoke("recorder:stop"),
  recorderNavigate: url => ipcRenderer.invoke("recorder:navigate", url),
  saveProfile: profile => ipcRenderer.invoke("profile:save", profile),
  listProfiles: () => ipcRenderer.invoke("profile:list"),
  openExternal: url => ipcRenderer.invoke("open:external", url),
  onLog: callback => subscribe("engine:log", callback),
  onFinished: callback => subscribe("engine:finished", callback)
});
