import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromeSession } from '../automation/chromeSession';
import { serializeWorkflow, validateWorkflow } from '../workflow/schema';
import { createDefaultRegistry, executeWorkflow, type RunResult } from '../workflow/engine';
import { registerAutomationActions } from '../automation/actions';
import type { RunHistoryEntry } from '../shared/ipc';

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;
const activeRuns = new Map<string, AbortController>();
const pendingDebug = new Map<string, (step: boolean) => void>();
const debugStepRuns = new Set<string>();
const workflowsDir = () => path.join(app.getPath('userData'), 'workflows');
const runHistoryPath = () => path.join(app.getPath('userData'), 'run-history.json');
const credentialsPath = () => path.join(app.getPath('userData'), 'credentials.json');
const batchJobsDir = () => path.join(app.getPath('userData'), 'batch-jobs');
const activeBatchRuns = new Map<string, AbortController>();
const credentialMarker = (name: string) => `@flowforge-credential:${name}`;

async function readCredentials(): Promise<Record<string, string>> {
  try { const value: unknown = JSON.parse(await fs.readFile(credentialsPath(), 'utf8')); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string> : {}; } catch { return {}; }
}
async function writeCredential(workflowId: string, name: string, value: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this system');
  const credentials = await readCredentials();
  credentials[`${workflowId}:${name}`] = safeStorage.encryptString(value).toString('base64');
  await writeFileAtomically(credentialsPath(), JSON.stringify(credentials));
}
async function readCredential(workflowId: string, name: string): Promise<string> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this system');
  const encrypted = (await readCredentials())[`${workflowId}:${name}`];
  if (!encrypted) throw new Error(`Secret variable ${name} has no stored credential`);
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
}
async function prepareWorkflowSecrets(workflow: import('../workflow/schema').Workflow, persistInline: boolean): Promise<import('../workflow/schema').Workflow> {
  const copy = structuredClone(workflow);
  for (const variable of copy.variables) {
    if (variable.type !== 'secret' || variable.scope === 'environment') continue;
    if (typeof variable.value === 'string' && variable.value.startsWith('@flowforge-credential:')) continue;
    if (typeof variable.value !== 'string' || !variable.value) continue;
    if (persistInline) await writeCredential(copy.id, variable.name, variable.value);
    else continue;
    variable.value = credentialMarker(variable.name);
  }
  for (const node of copy.nodes) {
    if (node.type === 'subworkflow' && node.config.workflow && typeof node.config.workflow === 'object' && !Array.isArray(node.config.workflow)) {
      const child = validateWorkflow(node.config.workflow);
      if (child.workflow) node.config.workflow = await prepareWorkflowSecrets(child.workflow, persistInline);
    }
  }
  return copy;
}
async function hydrateWorkflowSecrets(workflow: import('../workflow/schema').Workflow): Promise<import('../workflow/schema').Workflow> {
  const copy = structuredClone(workflow);
  for (const variable of copy.variables) {
    if (variable.type === 'secret' && variable.scope !== 'environment' && typeof variable.value === 'string' && variable.value.startsWith('@flowforge-credential:')) variable.value = await readCredential(copy.id, variable.value.slice('@flowforge-credential:'.length));
  }
  for (const node of copy.nodes) {
    if (node.type === 'subworkflow' && node.config.workflow && typeof node.config.workflow === 'object' && !Array.isArray(node.config.workflow)) {
      const child = validateWorkflow(node.config.workflow);
      if (child.workflow) node.config.workflow = await hydrateWorkflowSecrets(child.workflow);
    }
  }
  return copy;
}

async function writeFileAtomically(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

type BatchJob = import('../shared/ipc').BatchJobSummary & { workflow: import('../workflow/schema').Workflow; items: unknown[] };

async function readBatchJob(id: string): Promise<BatchJob> {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Invalid batch job id');
  const parsed: unknown = JSON.parse(await fs.readFile(path.join(batchJobsDir(), `${id}.json`), 'utf8'));
  if (!parsed || typeof parsed !== 'object' || (parsed as BatchJob).id !== id || !Array.isArray((parsed as BatchJob).items) || !Array.isArray((parsed as BatchJob).results)) throw new Error('Batch checkpoint is invalid');
  return parsed as BatchJob;
}
async function saveBatchJob(job: BatchJob): Promise<void> {
  job.updatedAt = new Date().toISOString();
  await writeFileAtomically(path.join(batchJobsDir(), `${job.id}.json`), JSON.stringify(job, null, 2));
}
function batchSummary(job: BatchJob): import('../shared/ipc').BatchJobSummary {
  const summary = structuredClone(job) as Partial<BatchJob>;
  delete summary.workflow; delete summary.items;
  return summary as import('../shared/ipc').BatchJobSummary;
}
function publishBatchProgress(job: BatchJob): void { mainWindow?.webContents.send('batch:progress', batchSummary(job)); }
async function executeBatchJob(job: BatchJob): Promise<import('../shared/ipc').BatchJobSummary> {
  if (activeBatchRuns.has(job.id)) throw new Error('This batch is already running');
  if (activeRuns.size) throw new Error('Stop the active workflow before starting a batch; the browser session is shared');
  if (activeBatchRuns.size) throw new Error('Only one batch can run at a time because the browser session is shared');
  const validation = validateWorkflow(job.workflow);
  if (!validation.workflow) throw new Error(`Stored workflow is invalid: ${validation.errors.join('; ')}`);
  const controller = new AbortController();
  activeBatchRuns.set(job.id, controller);
  job.status = 'running';
  try {
    await saveBatchJob(job); publishBatchProgress(job);
    const safeWorkflow = await hydrateWorkflowSecrets(validation.workflow);
    const registry = createDefaultRegistry();
    registerAutomationActions(registry, path.join(app.getPath('userData'), 'outputs'));
    const environmentVariables: Record<string, string> = {};
    const pending = [safeWorkflow];
    const visited = new Set<object>();
    while (pending.length) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const variable of current.variables.filter((entry) => entry.scope === 'environment')) {
        if (typeof variable.value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.value)) throw new Error(`Environment variable ${variable.name} must contain a valid environment key name`);
        const value = process.env[variable.value];
        if (value === undefined) throw new Error(`Required environment variable is not set: ${variable.value}`);
        environmentVariables[variable.value] = value;
      }
      for (const node of current.nodes) if (node.type === 'subworkflow' && node.config.workflow && typeof node.config.workflow === 'object' && !Array.isArray(node.config.workflow)) {
        const child = validateWorkflow(node.config.workflow); if (child.workflow) pending.push(child.workflow);
      }
    }
    for (let index = 0; index < job.items.length; index++) {
      if (job.results.some((result) => result.index === index && result.status === 'succeeded')) continue;
      if (controller.signal.aborted) {
        job.results = job.results.filter((result) => result.index !== index);
        job.results.push({ index, status: 'cancelled', steps: 0, updatedAt: new Date().toISOString() });
        job.status = 'cancelled'; await saveBatchJob(job); publishBatchProgress(job); break;
      }
      const result = await executeWorkflow(safeWorkflow, registry, { maxSteps: 1000, signal: controller.signal, environmentVariables, initialVariables: { [job.itemVariable]: job.items[index] } });
      job.results = job.results.filter((entry) => entry.index !== index);
      job.results.push({ index, status: result.status, steps: result.steps.length, ...(result.error ? { error: result.error.slice(0, 1000) } : {}), updatedAt: new Date().toISOString() });
      job.results.sort((a, b) => a.index - b.index);
      job.status = result.status === 'cancelled' ? 'cancelled' : result.status === 'failed' ? 'failed' : 'running';
      await saveBatchJob(job); publishBatchProgress(job);
      if (result.status !== 'succeeded') break;
    }
    if (job.status === 'running') job.status = job.results.filter((result) => result.status === 'succeeded').length === job.items.length ? 'succeeded' : 'failed';
    await saveBatchJob(job); publishBatchProgress(job);
    return batchSummary(job);
  } catch (error) {
    job.status = controller.signal.aborted ? 'cancelled' : 'failed';
    const index = job.items.findIndex((_, itemIndex) => !job.results.some((result) => result.index === itemIndex && result.status === 'succeeded'));
    if (index >= 0) {
      job.results = job.results.filter((result) => result.index !== index);
      job.results.push({ index, status: job.status === 'cancelled' ? 'cancelled' : 'failed', steps: 0, error: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000), updatedAt: new Date().toISOString() });
      job.results.sort((a, b) => a.index - b.index);
    }
    await saveBatchJob(job); publishBatchProgress(job);
    return batchSummary(job);
  } finally { activeBatchRuns.delete(job.id); }
}

async function readRunHistory(): Promise<RunHistoryEntry[]> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(runHistoryPath(), 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((entry): entry is RunHistoryEntry => Boolean(entry && typeof entry.id === 'string' && typeof entry.workflowName === 'string' && typeof entry.startedAt === 'string' && typeof entry.durationMs === 'number' && ['succeeded', 'failed', 'cancelled'].includes(entry.status) && typeof entry.steps === 'number')).slice(0, 50) : [];
  } catch { return []; }
}

async function saveRunHistory(entries: RunHistoryEntry[]): Promise<void> {
  await writeFileAtomically(runHistoryPath(), JSON.stringify(entries.slice(0, 50), null, 2));
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? '';
  const trustedFileUrl = pathToFileURL(path.join(__dirname, '../renderer/index.html')).href;
  const trusted = isDev ? (new URL(url).origin === 'http://127.0.0.1:5173') : url === trustedFileUrl;
  if (!trusted || event.senderFrame !== event.sender.mainFrame) throw new Error('Untrusted IPC sender');
}

function registerIpc(): void {
  ipcMain.handle('app:version', (event) => { assertTrustedSender(event); return app.getVersion(); });
  ipcMain.handle('workflow:load', async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog({ title: 'Open workflow', properties: ['openFile'], filters: [{ name: 'FlowForge workflow', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const stat = await fs.stat(result.filePaths[0]);
    if (stat.size > 10 * 1024 * 1024) throw new Error('Workflow file exceeds the 10 MB limit');
    const content = await fs.readFile(result.filePaths[0], 'utf8');
    const parsed: unknown = JSON.parse(content);
    const validation = validateWorkflow(parsed);
    if (!validation.workflow) throw new Error(`Invalid workflow file: ${validation.errors.join('; ')}`);
    const safeWorkflow = await prepareWorkflowSecrets(validation.workflow, true);
    if (JSON.stringify(safeWorkflow) !== JSON.stringify(validation.workflow)) await writeFileAtomically(result.filePaths[0], serializeWorkflow(safeWorkflow));
    return safeWorkflow;
  });
  ipcMain.handle('workflow:history', async (event) => { assertTrustedSender(event); return readRunHistory(); });
  ipcMain.handle('batch:list', async (event) => {
    assertTrustedSender(event);
    try { const names = await fs.readdir(batchJobsDir()); const jobs = await Promise.all(names.filter((name) => /^[a-zA-Z0-9_-]{1,80}\.json$/.test(name)).map(async (name) => { try { return batchSummary(await readBatchJob(name.slice(0, -5))); } catch { return null; } })); return jobs.filter((job): job is import('../shared/ipc').BatchJobSummary => job !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 30); } catch { return []; }
  });
  ipcMain.handle('batch:start', async (event, input: unknown, items: unknown, itemVariable: unknown) => {
    assertTrustedSender(event);
    const validation = validateWorkflow(input);
    if (!validation.workflow) throw new Error(`Workflow validation failed: ${validation.errors.join('; ')}`);
    if (!Array.isArray(items) || items.length < 1 || items.length > 10000) throw new Error('Batch input must be an array containing 1 to 10,000 items');
    if (Buffer.byteLength(JSON.stringify(items), 'utf8') > 50 * 1024 * 1024) throw new Error('Batch input exceeds the 50 MB limit');
    if (typeof itemVariable !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(itemVariable) || ['__proto__', 'prototype', 'constructor'].includes(itemVariable)) throw new Error('Choose a valid item variable name');
    const workflow = await prepareWorkflowSecrets(validation.workflow, true);
    const now = new Date().toISOString();
    const job: BatchJob = { id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, workflowName: validation.workflow.name, itemVariable, total: items.length, status: 'queued', results: [], createdAt: now, updatedAt: now, workflow, items: structuredClone(items) };
    await saveBatchJob(job);
    return executeBatchJob(job);
  });
  ipcMain.handle('batch:resume', async (event, id: unknown) => {
    assertTrustedSender(event);
    if (typeof id !== 'string') throw new Error('Invalid batch job id');
    const job = await readBatchJob(id);
    if (job.status === 'succeeded') return batchSummary(job);
    return executeBatchJob(job);
  });
  ipcMain.handle('batch:cancel', (event, id: unknown) => {
    assertTrustedSender(event);
    if (typeof id !== 'string') return false;
    const controller = activeBatchRuns.get(id); if (!controller) return false; controller.abort(); return true;
  });
  ipcMain.handle('workflow:run', async (event, input: unknown, runId: unknown) => {
    assertTrustedSender(event);
    let serialized: string;
    try { serialized = JSON.stringify(input) ?? ''; } catch { return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Workflow input is not serializable' }; }
    if (Buffer.byteLength(serialized, 'utf8') > 10 * 1024 * 1024) return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Workflow exceeds the 10 MB limit' };
    if (typeof runId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(runId) || activeRuns.has(runId)) return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Invalid or duplicate run id' };
    if (activeRuns.size > 0 || activeBatchRuns.size > 0) return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Only one workflow or batch can run at a time because the browser session is shared' };
    const controller = new AbortController();
    const stopBrowserOnCancel = () => {
      void chromeSession.stop().catch((error) => console.error('Could not stop browser after cancellation:', error));
    };
    controller.signal.addEventListener('abort', stopBrowserOnCancel, { once: true });
    activeRuns.set(runId, controller);
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const registry = createDefaultRegistry();
    registerAutomationActions(registry, path.join(app.getPath('userData'), 'outputs'));
    try {
      let result: RunResult;
      try {
        const validation = validateWorkflow(input);
        if (!validation.workflow) throw new Error(`Workflow validation failed: ${validation.errors.join('; ')}`);
        const environmentValues: Record<string, string> = {};
        const pendingWorkflows = [validation.workflow];
        const visitedWorkflows = new Set<object>();
        while (pendingWorkflows.length) {
          const currentWorkflow = pendingWorkflows.pop()!;
          if (visitedWorkflows.has(currentWorkflow)) continue;
          visitedWorkflows.add(currentWorkflow);
          for (const variable of currentWorkflow.variables.filter((entry) => entry.scope === 'environment')) {
            const environmentName = variable.value;
            if (typeof environmentName !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(environmentName)) {
              throw new Error(`Environment variable ${variable.name} must contain a valid environment key name`);
            }
            const environmentValue = process.env[environmentName];
            if (environmentValue === undefined) throw new Error(`Required environment variable is not set: ${environmentName}`);
            environmentValues[environmentName] = environmentValue;
          }
          for (const node of currentWorkflow.nodes) {
            if (node.type === 'subworkflow' && node.config.workflow && typeof node.config.workflow === 'object' && !Array.isArray(node.config.workflow)) {
              const child = validateWorkflow(node.config.workflow);
              if (child.workflow) pendingWorkflows.push(child.workflow);
            }
          }
        }
        const hydratedWorkflow = await hydrateWorkflowSecrets(validation.workflow);
        result = await executeWorkflow(hydratedWorkflow, registry, { maxSteps: 1000, signal: controller.signal, environmentVariables: environmentValues, shouldPause: (_nodeId, breakpoint) => breakpoint || debugStepRuns.has(runId), onBreakpoint: (nodeId) => new Promise<void>((resolve) => { let settled = false; const finish = (step: boolean) => { if (settled) return; settled = true; controller.signal.removeEventListener('abort', abortHandler); if (pendingDebug.get(runId) === finish) pendingDebug.delete(runId); if (step) debugStepRuns.add(runId); else debugStepRuns.delete(runId); resolve(); }; const abortHandler = () => finish(false); pendingDebug.set(runId, finish); mainWindow?.webContents.send('workflow:debug-pause', { runId, nodeId }); controller.signal.addEventListener('abort', abortHandler, { once: true }); if (controller.signal.aborted) finish(false); }) });
      } catch (error) { result = { status: controller.signal.aborted ? 'cancelled' as const : 'failed' as const, steps: [], variables: {}, logs: [], ...(!controller.signal.aborted ? { error: error instanceof Error ? error.message : String(error) } : {}) }; }
      const parsed = validateWorkflow(input).workflow;
      const entry: RunHistoryEntry = { id: runId, workflowName: parsed?.name ?? 'Invalid workflow', startedAt, durationMs: Date.now() - started, status: result.status, steps: result.steps.length, ...(result.error ? { error: result.error.slice(0, 1000) } : {}) };
      try { await saveRunHistory([entry, ...await readRunHistory()]); } catch (error) { console.error('Could not persist workflow run history:', error); }
      return result;
    } finally {
      controller.signal.removeEventListener('abort', stopBrowserOnCancel);
      // Also catch a browser session that finished starting after cancellation was requested.
      if (controller.signal.aborted) {
        try { await chromeSession.stop(); } catch (error) { console.error('Could not clean up cancelled browser session:', error); }
      }
      pendingDebug.delete(runId); debugStepRuns.delete(runId);
      activeRuns.delete(runId);
    }
  });
  ipcMain.handle('workflow:debug-resume', (event, runId: unknown, step: unknown) => {
    assertTrustedSender(event);
    if (typeof runId !== 'string' || typeof step !== 'boolean') return false;
    const resume = pendingDebug.get(runId);
    if (!resume) return false;
    resume(step);
    return true;
  });
  ipcMain.handle('workflow:cancel', (event, runId: unknown) => {
    assertTrustedSender(event);
    if (typeof runId !== 'string') return false;
    const controller = activeRuns.get(runId);
    if (!controller) return false;
    controller.abort();
    return true;
  });
  ipcMain.handle('workflow:save', async (event, input: unknown) => {
    assertTrustedSender(event);
    let serialized: string;
    try { serialized = JSON.stringify(input) ?? ''; } catch { return { ok: false, error: 'Workflow input is not serializable' }; }
    if (Buffer.byteLength(serialized, 'utf8') > 10 * 1024 * 1024) return { ok: false, error: 'Workflow exceeds the 10 MB limit' };
    const validation = validateWorkflow(input);
    if (!validation.workflow) return { ok: false, error: `Workflow validation failed: ${validation.errors.join('; ')}` };
    let workflow: import('../workflow/schema').Workflow;
    try { workflow = await prepareWorkflowSecrets(validation.workflow, true); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
    const safeName = workflow.name.replace(/[^a-z0-9-_ ]/gi, '').trim().slice(0, 80) || 'workflow';
    const safeId = workflow.id.replace(/[^a-z0-9-_]/gi, '').slice(0, 12) || 'workflow';
    const filePath = path.join(workflowsDir(), `${safeName}-${safeId}.flow.json`);
    await writeFileAtomically(filePath, serializeWorkflow(workflow));
    return { ok: true, path: filePath, workflow };
  });
  ipcMain.handle('file:choose-input', async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog({ title: 'Choose input data', properties: ['openFile'], filters: [{ name: 'Data files', extensions: ['json', 'txt', 'csv'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const stat = await fs.stat(result.filePaths[0]);
    if (stat.size > 50 * 1024 * 1024) throw new Error('Input file exceeds the 50 MB limit');
    return { path: result.filePaths[0], content: await fs.readFile(result.filePaths[0], 'utf8') };
  });
  ipcMain.handle('browser:list', (event) => { assertTrustedSender(event); return chromeSession.listBrowsers(); });
  ipcMain.handle('browser:start', async (event, browserId: unknown) => {
    assertTrustedSender(event);
    if (typeof browserId !== 'string' || !/^(chrome|edge|brave|firefox|chromium|vivaldi|opera)$/.test(browserId)) return { ok: false, error: 'Choose a supported detected browser.' };
    try { await chromeSession.start(browserId); return { ok: true }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle('browser:stop', async (event) => {
    assertTrustedSender(event);
    try { await chromeSession.stop(); return { ok: true }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle('browser:status', (event) => { assertTrustedSender(event); return chromeSession.isRunning(); });
  ipcMain.handle('browser:navigate', async (event, url: unknown) => {
    assertTrustedSender(event);
    if (typeof url !== 'string' || url.length > 4096) return { ok: false, error: 'Invalid URL' };
    try { return { ok: true, ...(await chromeSession.navigate(url)) }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle('browser:select-element', async (event) => {
    assertTrustedSender(event);
    try { return { ok: true, element: await chromeSession.selectElement() }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle('browser:record-next-action', async (event) => {
    assertTrustedSender(event);
    try { return { ok: true, action: await chromeSession.recordNextAction() }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle('browser:preview-items', async (event, itemSelector: unknown, fields: unknown) => {
    assertTrustedSender(event);
    if (typeof itemSelector !== 'string' || itemSelector.length > 2048 || !fields || typeof fields !== 'object' || Array.isArray(fields) || Object.entries(fields as Record<string, unknown>).some(([name, selector]) => !name.trim() || typeof selector !== 'string' || selector.length > 2048)) return { ok: false, error: 'Invalid extraction schema' };
    try { return { ok: true, rows: await chromeSession.previewItems(itemSelector, fields as Record<string, string>) }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle('browser:test-locator', async (event, strategy: unknown, value: unknown, frameSelector: unknown = '') => {
    assertTrustedSender(event);
    if (!['css', 'xpath', 'id'].includes(String(strategy)) || typeof value !== 'string' || value.length > 2048 || typeof frameSelector !== 'string' || frameSelector.length > 2048) return { ok: false, error: 'Invalid locator' };
    try { return { ok: true, ...(await chromeSession.testLocator(String(strategy), value, frameSelector)) }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle('file:write-output', async (event, filename: unknown, content: unknown) => {
    assertTrustedSender(event);
    if (typeof filename !== 'string' || typeof content !== 'string' || filename.length > 180 || filename.includes('/') || filename.includes('\\') || filename === '.' || filename === '..') return { ok: false, error: 'Invalid output filename or content' };
    if (Buffer.byteLength(content, 'utf8') > 50 * 1024 * 1024) return { ok: false, error: 'Output exceeds the 50 MB limit' };
    const result = await dialog.showSaveDialog({ defaultPath: filename, title: 'Save FlowForge output' });
    if (result.canceled || !result.filePath) return { ok: false, error: 'Save cancelled' };
    try { await writeFileAtomically(result.filePath, content); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
    return { ok: true, path: result.filePath };
  });
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1500, height: 940, minWidth: 1100, minHeight: 720,
    backgroundColor: '#0b0e14',
    webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const rendererUrl = isDev ? 'http://127.0.0.1:5173/' : pathToFileURL(path.join(__dirname, '../renderer/index.html')).href;
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? new URL(url).origin === 'http://127.0.0.1:5173' : url === rendererUrl;
    if (!allowed) event.preventDefault();
  });
  if (isDev) await mainWindow.loadURL('http://127.0.0.1:5173');
  else await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  if (app.isPackaged && process.platform === 'win32') {
    const managerPath = path.join(process.resourcesPath, 'selenium', 'selenium-manager.exe');
    if (existsSync(managerPath)) process.env.SE_MANAGER_PATH = managerPath;
  }
  registerIpc();
  return createWindow();
});
let shuttingDown = false;
app.on('before-quit', (event) => {
  if (shuttingDown) return;
  if (!chromeSession.isRunning() && activeRuns.size === 0) return;
  event.preventDefault();
  shuttingDown = true;
  for (const controller of activeRuns.values()) controller.abort();
  void chromeSession.stop().finally(() => app.quit());
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
