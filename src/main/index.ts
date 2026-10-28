import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
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
const workflowsDir = () => path.join(app.getPath('userData'), 'workflows');
const runHistoryPath = () => path.join(app.getPath('userData'), 'run-history.json');

async function readRunHistory(): Promise<RunHistoryEntry[]> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(runHistoryPath(), 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((entry): entry is RunHistoryEntry => Boolean(entry && typeof entry.id === 'string' && typeof entry.workflowName === 'string' && typeof entry.startedAt === 'string' && typeof entry.durationMs === 'number' && ['succeeded', 'failed', 'cancelled'].includes(entry.status) && typeof entry.steps === 'number')).slice(0, 50) : [];
  } catch { return []; }
}

async function saveRunHistory(entries: RunHistoryEntry[]): Promise<void> {
  const file = runHistoryPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(entries.slice(0, 50), null, 2), 'utf8');
  await fs.rename(temporary, file);
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
    return validation.workflow;
  });
  ipcMain.handle('workflow:history', async (event) => { assertTrustedSender(event); return readRunHistory(); });
  ipcMain.handle('workflow:run', async (event, input: unknown, runId: unknown) => {
    assertTrustedSender(event);
    let serialized: string;
    try { serialized = JSON.stringify(input) ?? ''; } catch { return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Workflow input is not serializable' }; }
    if (Buffer.byteLength(serialized, 'utf8') > 10 * 1024 * 1024) return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Workflow exceeds the 10 MB limit' };
    if (typeof runId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(runId) || activeRuns.has(runId)) return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Invalid or duplicate run id' };
    if (activeRuns.size > 0) return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Only one workflow can run at a time because the browser session is shared' };
    const controller = new AbortController();
    activeRuns.set(runId, controller);
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const registry = createDefaultRegistry();
    registerAutomationActions(registry, path.join(app.getPath('userData'), 'outputs'));
    try {
      let result: RunResult;
      try { result = await executeWorkflow(input, registry, { maxSteps: 1000, signal: controller.signal }); }
      catch (error) { result = { status: controller.signal.aborted ? 'cancelled' as const : 'failed' as const, steps: [], variables: {}, logs: [], ...(!controller.signal.aborted ? { error: error instanceof Error ? error.message : String(error) } : {}) }; }
      const parsed = validateWorkflow(input).workflow;
      const entry: RunHistoryEntry = { id: runId, workflowName: parsed?.name ?? 'Invalid workflow', startedAt, durationMs: Date.now() - started, status: result.status, steps: result.steps.length, ...(result.error ? { error: result.error.slice(0, 1000) } : {}) };
      try { await saveRunHistory([entry, ...await readRunHistory()]); } catch (error) { console.error('Could not persist workflow run history:', error); }
      return result;
    } finally { activeRuns.delete(runId); }
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
    if (Buffer.byteLength(JSON.stringify(input) ?? '', 'utf8') > 10 * 1024 * 1024) return { ok: false, error: 'Workflow exceeds the 10 MB limit' };
    const validation = validateWorkflow(input);
    if (!validation.workflow) return { ok: false, error: `Workflow validation failed: ${validation.errors.join('; ')}` };
    const workflow = validation.workflow;
    await fs.mkdir(workflowsDir(), { recursive: true });
    const safeName = workflow.name.replace(/[^a-z0-9-_ ]/gi, '').trim().slice(0, 80) || 'workflow';
    const safeId = workflow.id.replace(/[^a-z0-9-_]/gi, '').slice(0, 12) || 'workflow';
    const filePath = path.join(workflowsDir(), `${safeName}-${safeId}.flow.json`);
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, serializeWorkflow(workflow), 'utf8');
    await fs.rename(tempPath, filePath);
    return { ok: true, path: filePath };
  });
  ipcMain.handle('file:choose-input', async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog({ title: 'Choose input data', properties: ['openFile'], filters: [{ name: 'Data files', extensions: ['json', 'txt', 'csv'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const stat = await fs.stat(result.filePaths[0]);
    if (stat.size > 50 * 1024 * 1024) throw new Error('Input file exceeds the 50 MB limit');
    return { path: result.filePaths[0], content: await fs.readFile(result.filePaths[0], 'utf8') };
  });
  ipcMain.handle('browser:start', async (event) => {
    assertTrustedSender(event);
    try { await chromeSession.start(); return { ok: true }; }
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
  ipcMain.handle('browser:test-locator', async (event, strategy: unknown, value: unknown) => {
    assertTrustedSender(event);
    if (!['css', 'xpath', 'id'].includes(String(strategy)) || typeof value !== 'string' || value.length > 2048) return { ok: false, error: 'Invalid locator' };
    try { return { ok: true, ...(await chromeSession.testLocator(String(strategy), value)) }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle('file:write-output', async (event, filename: unknown, content: unknown) => {
    assertTrustedSender(event);
    if (typeof filename !== 'string' || typeof content !== 'string' || filename.length > 180 || filename.includes('/') || filename.includes('\\') || filename === '.' || filename === '..') return { ok: false, error: 'Invalid output filename or content' };
    if (Buffer.byteLength(content, 'utf8') > 50 * 1024 * 1024) return { ok: false, error: 'Output exceeds the 50 MB limit' };
    const result = await dialog.showSaveDialog({ defaultPath: filename, title: 'Save FlowForge output' });
    if (result.canceled || !result.filePath) return { ok: false, error: 'Save cancelled' };
    await fs.writeFile(result.filePath, content, 'utf8');
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

app.whenReady().then(() => { registerIpc(); return createWindow(); });
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
