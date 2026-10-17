/* Maintainer: Amirreza Taati (Jelofen1962) | github.com/Jelofen1962 | t.me/Jelofen1962 */
const { contextBridge, ipcRenderer } = require("electron");
const subscribe = (channel, callback) => {
  const fn = (_event, value) => callback(value);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};
contextBridge.exposeInMainWorld("flowforge", {
  start: payload => ipcRenderer.invoke("engine:start", payload),
  setLaunchAtLogin: enabled => ipcRenderer.invoke("app:set-launch-at-login", !!enabled),
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getAiApiInfo: () => ipcRenderer.invoke("ai:api-info"),
  getAiGuidanceActions: () => ipcRenderer.invoke("ai:get-guidance-actions"),
  syncAiWorkflows: workflows => ipcRenderer.invoke("ai:sync-workflows", workflows),
  checkForUpdates: () => ipcRenderer.invoke("app:check-updates"),
  chooseFile: () => ipcRenderer.invoke("file:choose"),
  stop: () => ipcRenderer.invoke("engine:stop"),
  respondUserInput: response => ipcRenderer.invoke("engine:user-input-response", response),
  sessionExport: () => ipcRenderer.invoke("session:export"),
  sessionImport: snapshot => ipcRenderer.invoke("session:import", snapshot),
  recorderStart: payload => ipcRenderer.invoke("recorder:start", payload),
  recorderStop: () => ipcRenderer.invoke("recorder:stop"),
  recorderNavigate: url => ipcRenderer.invoke("recorder:navigate", url),
  saveProfile: profile => ipcRenderer.invoke("profile:save", profile),
  listProfiles: () => ipcRenderer.invoke("profile:list"),
  listOutputs: workflowId => ipcRenderer.invoke("outputs:list", workflowId),
  openOutput: (workflowId, archiveName) => ipcRenderer.invoke("outputs:open", workflowId, archiveName),
  revealOutput: (workflowId, archiveName) => ipcRenderer.invoke("outputs:reveal", workflowId, archiveName),
  deleteOutput: (workflowId, archiveName) => ipcRenderer.invoke("outputs:delete", workflowId, archiveName),
  readOutput: (workflowId, archiveName, artifactName) => ipcRenderer.invoke("outputs:read", workflowId, archiveName, artifactName),
  openExternal: url => ipcRenderer.invoke("open:external", url),
  onAiWorkflowUpsert: callback => subscribe("ai:workflow-upsert", callback),
  onLog: callback => subscribe("engine:log", callback),
  onFinished: callback => subscribe("engine:finished", callback)
});
