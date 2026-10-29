import { contextBridge, ipcRenderer } from 'electron';
import type { FlowForgeApi } from '../shared/ipc';

const api: FlowForgeApi = {
  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  loadWorkflow: () => ipcRenderer.invoke('workflow:load') as Promise<unknown | null>,
  saveWorkflow: (workflow) => ipcRenderer.invoke('workflow:save', workflow) as Promise<{ ok: boolean; path?: string; error?: string; workflow?: unknown }>,
  runWorkflow: (workflow, runId) => ipcRenderer.invoke('workflow:run', workflow, runId) as Promise<import('../workflow/engine').RunResult>,
  getRunHistory: () => ipcRenderer.invoke('workflow:history') as Promise<import('../shared/ipc').RunHistoryEntry[]>,
  startBatch: (workflow, items, itemVariable) => ipcRenderer.invoke('batch:start', workflow, items, itemVariable) as Promise<import('../shared/ipc').BatchJobSummary>,
  resumeBatch: (jobId) => ipcRenderer.invoke('batch:resume', jobId) as Promise<import('../shared/ipc').BatchJobSummary>,
  listBatchJobs: () => ipcRenderer.invoke('batch:list') as Promise<import('../shared/ipc').BatchJobSummary[]>,
  cancelBatch: (jobId) => ipcRenderer.invoke('batch:cancel', jobId) as Promise<boolean>,
  onBatchProgress: (listener) => { const handler = (_event: Electron.IpcRendererEvent, payload: import('../shared/ipc').BatchJobSummary) => listener(payload); ipcRenderer.on('batch:progress', handler); return () => ipcRenderer.removeListener('batch:progress', handler); },
  cancelWorkflow: (runId) => ipcRenderer.invoke('workflow:cancel', runId) as Promise<boolean>,
  resumeWorkflow: (runId, step = false) => ipcRenderer.invoke('workflow:debug-resume', runId, step) as Promise<boolean>,
  onDebugPause: (listener) => { const handler = (_event: Electron.IpcRendererEvent, payload: { runId: string; nodeId: string }) => listener(payload); ipcRenderer.on('workflow:debug-pause', handler); return () => ipcRenderer.removeListener('workflow:debug-pause', handler); },
  chooseInputFile: () => ipcRenderer.invoke('file:choose-input') as Promise<{ path: string; content: string } | null>,
  writeOutput: (filename, content) => ipcRenderer.invoke('file:write-output', filename, content) as Promise<{ ok: boolean; path?: string; error?: string }>,
  browser: {
    list: () => ipcRenderer.invoke('browser:list') as Promise<import('../automation/browsers').BrowserInfo[]>,
    start: (browserId) => ipcRenderer.invoke('browser:start', browserId) as Promise<{ ok: boolean; error?: string }>,
    stop: () => ipcRenderer.invoke('browser:stop') as Promise<{ ok: boolean; error?: string }>,
    status: () => ipcRenderer.invoke('browser:status') as Promise<boolean>,
    navigate: (url) => ipcRenderer.invoke('browser:navigate', url) as Promise<{ ok: boolean; url?: string; title?: string; error?: string }>,
    selectElement: () => ipcRenderer.invoke('browser:select-element') as Promise<{ ok: boolean; element?: import('../automation/chromeSession').ElementSnapshot; error?: string }>,
    recordNextAction: () => ipcRenderer.invoke('browser:record-next-action') as Promise<{ ok: boolean; action?: import('../automation/chromeSession').RecordedAction; error?: string }>,
    previewItems: (itemSelector, fields) => ipcRenderer.invoke('browser:preview-items', itemSelector, fields) as Promise<{ ok: boolean; rows?: Record<string, string>[]; error?: string }>,
    testLocator: (strategy, value, frameSelector = '') => ipcRenderer.invoke('browser:test-locator', strategy, value, frameSelector) as Promise<{ ok: boolean; matches?: number; firstText?: string; error?: string }>,
  },
};
contextBridge.exposeInMainWorld('flowforge', api);
