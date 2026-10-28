import { contextBridge, ipcRenderer } from 'electron';
import type { FlowForgeApi } from '../shared/ipc';

const api: FlowForgeApi = {
  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  loadWorkflow: () => ipcRenderer.invoke('workflow:load') as Promise<unknown | null>,
  saveWorkflow: (workflow) => ipcRenderer.invoke('workflow:save', workflow) as Promise<{ ok: boolean; path?: string; error?: string }>,
  runWorkflow: (workflow, runId) => ipcRenderer.invoke('workflow:run', workflow, runId) as Promise<import('../workflow/engine').RunResult>,
  cancelWorkflow: (runId) => ipcRenderer.invoke('workflow:cancel', runId) as Promise<boolean>,
  chooseInputFile: () => ipcRenderer.invoke('file:choose-input') as Promise<{ path: string; content: string } | null>,
  writeOutput: (filename, content) => ipcRenderer.invoke('file:write-output', filename, content) as Promise<{ ok: boolean; path?: string; error?: string }>,
  browser: {
    start: () => ipcRenderer.invoke('browser:start') as Promise<{ ok: boolean; error?: string }>,
    stop: () => ipcRenderer.invoke('browser:stop') as Promise<{ ok: boolean; error?: string }>,
    status: () => ipcRenderer.invoke('browser:status') as Promise<boolean>,
    navigate: (url) => ipcRenderer.invoke('browser:navigate', url) as Promise<{ ok: boolean; url?: string; title?: string; error?: string }>,
    selectElement: () => ipcRenderer.invoke('browser:select-element') as Promise<{ ok: boolean; element?: import('../automation/chromeSession').ElementSnapshot; error?: string }>,
    testLocator: (strategy, value) => ipcRenderer.invoke('browser:test-locator', strategy, value) as Promise<{ ok: boolean; matches?: number; firstText?: string; error?: string }>,
  },
};
contextBridge.exposeInMainWorld('flowforge', api);
