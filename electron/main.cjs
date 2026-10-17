const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const { createAiApi } = require("./ai-api.cjs");

/* Maintainer: Amirreza Taati (Jelofen1962) | https://github.com/Jelofen1962 | Telegram: https://t.me/Jelofen1962 */
const GITHUB_RELEASE_REPOSITORY = { owner: "Jelofen1962", repo: "FlowForge" };

let win;
let engine = null;
let engineStopping = false;
let enginePayloadPath = null;
let stdoutBuffer = "";
let aiWorkflows = [];
let activeRunId = null;
let activeRunStatus = "idle";
let activeRunLogs = [];
let guidanceActions = [];
const isDev = !app.isPackaged;

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1100, minHeight: 720,
    backgroundColor: "#0b0b0c",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const devUrl = "http://127.0.0.1:5173";
  const productionFile = path.join(__dirname, "../dist/index.html");

  // Prevent popups and renderer navigation away from the trusted application UI.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, targetUrl) => {
    const allowed = isDev ? targetUrl === devUrl || targetUrl.startsWith(`${devUrl}/`) : targetUrl === require("node:url").pathToFileURL(productionFile).href;
    if (!allowed) event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  // Production renderer CSP. Dev mode needs Vite's local websocket for HMR.
  if (!isDev) {
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"]
        }
      });
    });
  }

  if (isDev) win.loadURL(devUrl);
  else win.loadFile(productionFile);
  win.on("closed", () => { win = null; });
}

function sendToRenderer(channel, value) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, value);
}

function emitLogLine(line) {
  const trimmed = line.trim();
  if (trimmed) {
    try {
      const event = JSON.parse(trimmed);
      activeRunLogs.push(event);
      if (activeRunLogs.length > 1000) activeRunLogs = activeRunLogs.slice(-1000);
      if (event.type === "user-input-request") activeRunStatus = "waiting_for_input";
      else if (event.type === "recorder" && event.data?.status === "stopped") activeRunStatus = "stopped";
      else if (event.type === "done") activeRunStatus = event.data && event.data.success ? "success" : "failed";
      else if (event.type === "error") activeRunStatus = "failed";
    } catch {}
    sendToRenderer("engine:log", trimmed);
  }
}

function handleStdout(chunk) {
  stdoutBuffer += chunk.toString("utf8");
  const lines = stdoutBuffer.split(/\r?\n/);
  stdoutBuffer = lines.pop() || "";
  for (const line of lines) emitLogLine(line);
  // Avoid unbounded buffering if a broken child emits no newline.
  if (stdoutBuffer.length > 1_000_000) {
    emitLogLine(JSON.stringify({ type: "error", data: { message: "Engine output line exceeded 1 MB and was truncated." } }));
    stdoutBuffer = "";
  }
}

function finishEngine(code, signal) {
  if (!engine) return;
  if (stdoutBuffer.trim()) emitLogLine(stdoutBuffer);
  stdoutBuffer = "";
  sendToRenderer("engine:finished", { code: typeof code === "number" ? code : 1, signal: signal || null, stopped: engineStopping });
  engine = null;
  engineStopping = false;
  if (activeRunStatus === "running" || activeRunStatus === "recording") activeRunStatus = code === 0 ? "success" : "failed";
  const payloadPath = enginePayloadPath;
  enginePayloadPath = null;
  if (payloadPath) fs.unlink(payloadPath).catch(() => {});
}

const aiApi = createAiApi({
  userDataPath: app.getPath("userData"),
  getWorkflows: () => aiWorkflows,
  getGuidanceActions: () => guidanceActions,
  startRecorder: async options => {
    const startUrl = typeof options.startUrl === "string" ? options.startUrl : "https://example.com";
    const browser = options.browser === "edge" ? "edge" : "chrome";
    if (!/^https?:\/\//i.test(startUrl)) return { ok: false, error: "Recorder start URL must use HTTP or HTTPS." };
    guidanceActions = [];
    const result = await startEngine({ mode: "recorder", browser, startUrl, steps: [], profile: {} });
    if (result.ok) { activeRunStatus = "recording"; activeRunId = result.runId; activeRunLogs = []; }
    return result;
  },
  stopRecorder: async () => {
    if (!engine || !engine.stdin || engine.killed) return { ok: false, error: "No browser session is running." };
    engine.stdin.write(JSON.stringify({ type: "recorder:stop" }) + "\n");
    return { ok: true };
  },
  saveWorkflow: async (existingId, input) => {
    const document = input && input.document && typeof input.document === "object" ? input.document : input;
    if (!document || typeof document !== "object" || Array.isArray(document) || typeof document.name !== "string" || !document.name.trim() || !Array.isArray(document.steps) || document.steps.length > 1000) return { ok: false, error: "Workflow requires a name and a steps array of at most 1,000 steps." };
    if (document.startUrl && !/^https?:\/\//i.test(String(document.startUrl))) return { ok: false, error: "Workflow startUrl must use HTTP or HTTPS." };
    const existing = existingId ? aiWorkflows.find(item => item.id === existingId) : null;
    if (existingId && !existing) return { ok: false, error: "Workflow not found." };
    const id = existingId || crypto.randomUUID();
    const graph = new Map(aiWorkflows.filter(w => w.id !== id).map(w => [w.id, w.document]));
    graph.set(id, document);
    for (const [ownerId, ownerDoc] of graph) {
      for (const step of ownerDoc.steps || []) {
        if (step.type === "runWorkflow" && (!step.workflowId || !graph.has(step.workflowId))) return { ok: false, error: `Workflow "${ownerDoc.name}" references missing sub-workflow "${step.workflowId || ""}".` };
      }
    }
    const visiting = new Set(); const visited = new Set();
    const visit = nodeId => {
      if (visiting.has(nodeId)) throw new Error(`Nested workflow cycle detected at "${graph.get(nodeId)?.name || nodeId}".`);
      if (visited.has(nodeId)) return;
      visiting.add(nodeId);
      for (const step of graph.get(nodeId)?.steps || []) if (step.type === "runWorkflow" && step.workflowId) visit(step.workflowId);
      visiting.delete(nodeId); visited.add(nodeId);
    };
    try { for (const nodeId of graph.keys()) visit(nodeId); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Nested workflow cycle detected." }; }
    const requestedProvenance = input && ["generated", "human-guided", "ai-assisted"].includes(input.aiProvenance) ? input.aiProvenance : null;
    const item = { id, document, updatedAt: new Date().toISOString(), aiTag: true, aiProvenance: requestedProvenance || (existing ? "ai-assisted" : "generated") };
    const next = aiWorkflows.filter(w => w.id !== id);
    next.push(item);
    aiWorkflows = next.slice(-500);
    sendToRenderer("ai:workflow-upsert", item);
    return { ok: true, workflow: { id: item.id, name: document.name, aiTag: true, aiProvenance: item.aiProvenance } };
  },
  startWorkflow: async workflow => {
    const payload = workflow.document ? {
      steps: workflow.document.steps, startUrl: workflow.document.startUrl, browser: workflow.document.browser,
      workflowName: workflow.document.name, currentWorkflowId: workflow.id,
      variables: workflow.document.variables || [],
      workflowLibrary: Object.fromEntries(aiWorkflows.map(item => [item.id, item.document]))
    } : {
      ...workflow,
      workflowName: workflow.workflowName || workflow.name || "Workflow",
      currentWorkflowId: workflow.currentWorkflowId || workflow.id || "ai-workflow",
      variables: Array.isArray(workflow.variables) ? workflow.variables : [],
      workflowLibrary: workflow.workflowLibrary || Object.fromEntries(aiWorkflows.map(item => [item.id, item.document]))
    };
    const result = await startEngine(payload);
    if (result.ok) { activeRunId = result.runId || null; activeRunStatus = "running"; activeRunLogs = []; }
    return result;
  },
  stopWorkflow: async () => {
    if (!engine || engine.killed) return { ok: false, error: "No active browser run." };
    engineStopping = true;
    engine.kill("SIGTERM");
    activeRunStatus = "stopping";
    return { ok: true };
  },
  getRunState: () => ({ runId: activeRunId, status: activeRunStatus, logs: activeRunLogs.slice(-100).map(event => {
    if (!event || typeof event !== "object") return { type: "event" };
    const data = event.data && typeof event.data === "object" ? event.data : {};
    if (event.type === "user-input-request") return { type: event.type, data: {
      requestId: data.requestId, stepName: data.stepName,
      fields: Array.isArray(data.fields) ? data.fields.map(field => ({
        id: field.id, title: field.title, placeholder: field.placeholder, required: field.required,
        secret: field.secret, valueType: field.valueType, options: field.options, variableName: field.variableName
      })) : []
    }};
    if (event.type === "step") return { type: event.type, data: {
      stepId: data.stepId || data.id, name: data.name, status: data.status, durationMs: data.durationMs,
      error: typeof data.error === "string" ? data.error.slice(0, 500) : undefined
    }};
    if (event.type === "done") return { type: event.type, data: { success: !!data.success } };
    if (event.type === "error") return { type: event.type, data: { message: String(data.message || "Automation error").slice(0, 500) } };
    return { type: String(event.type || "event") };
  }) }),
  respondUserInput: async response => {
    if (!engine || !engine.stdin || engine.killed || activeRunStatus !== "waiting_for_input") return { ok: false, error: "No automation is waiting for user input." };
    engine.stdin.write(JSON.stringify({ type: response.cancel ? "user-input:cancel" : "user-input:response", requestId: response.requestId, values: response.values || {} }) + "\n");
    activeRunStatus = "running";
    return { ok: true };
  }
});
app.whenReady().then(async () => {
  try { await aiApi.start(); } catch (error) { console.error("FlowForge AI API could not start:", error); }
  createWindow();
});
app.on("will-quit", () => { aiApi.stop().catch(() => {}); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => {
  if (engine && !engine.killed) {
    engineStopping = true;
    engine.kill("SIGTERM");
  }
});

function handleTrusted(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    const trusted = !!win && !win.isDestroyed() && event.sender === win.webContents &&
      event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === win.webContents.getURL();
    if (!trusted) throw new Error(`Blocked untrusted IPC sender for ${channel}.`);
    return handler(event, ...args);
  });
}

async function startEngine(payload) {
  if (engine) return { ok: false, error: "An automation is already running." };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Invalid automation payload." };
  }
  const safeWorkflowKey = String(payload.currentWorkflowId || payload.workflowName || "default").replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "default";
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(16).slice(2, 8)}`;
  const workflowOutputRoot = path.join(app.getPath("userData"), "outputs", safeWorkflowKey);
  const outputDirectory = path.join(workflowOutputRoot, runId);
  const outputArchivePath = path.join(workflowOutputRoot, `${runId}.zip`);
  const sessionStoreDir = path.join(app.getPath("userData"), "profiles", "sessions");
  await fs.mkdir(sessionStoreDir, { recursive: true });
  let encoded;
  try {
    encoded = JSON.stringify({ ...payload, runId, workflowName: String(payload.workflowName || "Workflow"), outputDirectory, outputArchivePath, screenshotDirectory: outputDirectory, sessionStoreDir });
    if (Buffer.byteLength(encoded, "utf8") > 5_000_000) {
      return { ok: false, error: "Workflow payload exceeds the 5 MB limit." };
    }
  } catch {
    return { ok: false, error: "Workflow payload could not be serialized." };
  }
  const script = path.join(__dirname, "../engine/runner.cjs");
  const payloadPath = path.join(app.getPath("userData"), `engine-payload-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  try {
    await fs.writeFile(payloadPath, encoded, { encoding: "utf8", mode: 0o600, flag: "wx" });
  } catch (error) {
    return { ok: false, error: `Could not prepare workflow payload: ${error instanceof Error ? error.message : String(error)}` };
  }
  engineStopping = false;
  stdoutBuffer = "";
  enginePayloadPath = payloadPath;
  try {
    engine = spawn(process.execPath, [script], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", FLOWFORGE_PAYLOAD_FILE: payloadPath },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    engine.stdout.on("data", handleStdout);
    engine.stderr.on("data", chunk => {
      const text = chunk.toString("utf8").trim();
      if (text) emitLogLine(JSON.stringify({ type: "stderr", data: { message: text } }));
    });
    engine.once("error", error => {
      emitLogLine(JSON.stringify({ type: "error", data: { message: `Could not launch Selenium engine: ${error.message}` } }));
      if (engine) finishEngine(1, null);
    });
    engine.once("close", finishEngine);
    activeRunStatus = "running";
    return { ok: true, runId };
  } catch (error) {
    engine = null;
    enginePayloadPath = null;
    await fs.unlink(payloadPath).catch(() => {});
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

handleTrusted("engine:start", async (_event, payload) => startEngine(payload));
handleTrusted("file:choose", async () => {
  const result = await dialog.showOpenDialog(win, { title: "Choose file to upload", properties: ["openFile"] });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  return { canceled: false, path: result.filePaths[0] };
});

handleTrusted("engine:user-input-response", async (_event, response) => {
  if (!engine || !engine.stdin || engine.killed) return { ok: false, error: "No automation is waiting for user input." };
  if (!response || typeof response.requestId !== "string" || !response.requestId.trim()) return { ok: false, error: "Invalid user input response." };
  const cancel = response.cancel === true;
  const values = response.values && typeof response.values === "object" && !Array.isArray(response.values) ? response.values : {};
  let encoded;
  try { encoded = JSON.stringify({ type: cancel ? "user-input:cancel" : "user-input:response", requestId: response.requestId, values }); }
  catch { return { ok: false, error: "User input response could not be serialized." }; }
  if (Buffer.byteLength(encoded, "utf8") > 100_000) return { ok: false, error: "User input response exceeds the 100 KB limit." };
  engine.stdin.write(encoded + "\n");
  return { ok: true };
});

handleTrusted("recorder:start", async (_event, options = {}) => {
  if (engine) return { ok: false, error: "A browser session is already running. Stop it before starting the recorder." };
  const startUrl = typeof options.startUrl === "string" ? options.startUrl : "https://example.com";
  const browser = options.browser === "edge" ? "edge" : "chrome";
  if (!/^https?:\/\//i.test(startUrl)) return { ok: false, error: "Recorder start URL must use http or https." };
  const payload = { mode: "recorder", browser, startUrl, steps: [], profile: options.profile || {} };
  return await startEngine(payload);
});

handleTrusted("recorder:stop", async () => {
  if (!engine || !engine.stdin || engine.killed) return { ok: false, error: "No browser session is running." };
  engine.stdin.write(JSON.stringify({ type: "recorder:stop" }) + "\n");
  return { ok: true };
});

handleTrusted("recorder:navigate", async (_event, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return { ok: false, error: "Recorder URL must use http or https." };
  if (!engine || !engine.stdin || engine.killed) return { ok: false, error: "No browser session is running." };
  engine.stdin.write(JSON.stringify({ type: "navigate", url }) + "\n");
  return { ok: true };
});

handleTrusted("session:export", async () => {
  if (!engine || !engine.stdin || engine.killed) return { ok: false, error: "Start a browser session before exporting its state." };
  engine.stdin.write(JSON.stringify({ type: "session:export" }) + "\n");
  return { ok: true };
});

handleTrusted("session:import", async (_event, snapshot) => {
  if (!engine || !engine.stdin || engine.killed) return { ok: false, error: "Start a browser session on the target site before importing session state." };
  let encoded;
  try { encoded = JSON.stringify(snapshot); } catch { return { ok: false, error: "Session snapshot is not valid JSON data." }; }
  if (Buffer.byteLength(encoded, "utf8") > 2_000_000) return { ok: false, error: "Session snapshot exceeds the 2 MB limit." };
  engine.stdin.write(JSON.stringify({ type: "session:import", snapshot }) + "\n");
  return { ok: true };
});

handleTrusted("engine:stop", async () => {
  if (!engine) return { ok: true, alreadyStopped: true };
  if (!engineStopping) {
    engineStopping = true;
    try { engine.kill("SIGTERM"); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  }
  return { ok: true };
});

handleTrusted("profile:save", async (_event, profile) => {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return { ok: false, error: "Invalid profile." };
  const dir = path.join(app.getPath("userData"), "profiles");
  await fs.mkdir(dir, { recursive: true });
  const safe = String(profile.name || "default").replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "default";
  const target = path.join(dir, `${safe}.json`);
  await fs.writeFile(target, JSON.stringify(profile, null, 2), { encoding: "utf8", mode: 0o600 });
  return { ok: true, path: target };
});

handleTrusted("profile:list", async () => {
  const dir = path.join(app.getPath("userData"), "profiles");
  await fs.mkdir(dir, { recursive: true });
  const files = (await fs.readdir(dir)).filter(file => file.endsWith(".json"));
  const profiles = [];
  for (const file of files) {
    try {
      const value = JSON.parse(await fs.readFile(path.join(dir, file), "utf8"));
      profiles.push({ ...value, name: String(value.name || path.basename(file, ".json")) });
    } catch { /* ignore invalid profile files */ }
  }
  return profiles.sort((a, b) => a.name.localeCompare(b.name));
});

handleTrusted("session:list", async (_event, profileName) => {
  const safeProfile = String(profileName || "default").replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "default";
  const dir = path.join(app.getPath("userData"), "profiles", "sessions", safeProfile);
  await fs.mkdir(dir, { recursive: true });
  return (await fs.readdir(dir)).filter(file => file.endsWith(".json")).map(file => path.basename(file, ".json")).sort();
});

const outputRoot = () => path.join(app.getPath("userData"), "outputs");
const safeOutputKey = value => String(value || "default").replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "default";
handleTrusted("outputs:list", async (_event, workflowId) => {
  const key = safeOutputKey(workflowId);
  const dir = path.join(outputRoot(), key);
  await fs.mkdir(dir, { recursive: true });
  const names = (await fs.readdir(dir)).filter(name => name.endsWith(".zip")).sort().reverse();
  const results = [];
  for (const name of names) {
    const archivePath = path.join(dir, name);
    const runId = name.slice(0, -4);
    const runDir = path.join(dir, runId);
    const stat = await fs.stat(archivePath).catch(() => null);
    if (!stat || !stat.isFile()) continue;
    let manifest = { artifacts: [] };
    try { manifest = JSON.parse(await fs.readFile(path.join(runDir, "manifest.json"), "utf8")); } catch { /* Keep an archive visible even if its manifest is missing. */ }
    results.push({ name, path: archivePath, size: stat.size, modifiedAt: stat.mtime.toISOString(), workflowName: manifest.workflowName || "Workflow", runId: manifest.runId || runId, artifacts: Array.isArray(manifest.artifacts) ? manifest.artifacts : [] });
  }
  return results;
});
handleTrusted("outputs:open", async (_event, workflowId, archiveName) => {
  const dir = path.join(outputRoot(), safeOutputKey(workflowId));
  if (typeof archiveName !== "string" || path.basename(archiveName) !== archiveName || !archiveName.endsWith(".zip")) return { ok: false, error: "Invalid output archive name." };
  const target = path.join(dir, archiveName);
  const stat = await fs.stat(target).catch(() => null);
  if (!stat || !stat.isFile()) return { ok: false, error: "Output archive was not found." };
  const error = await shell.openPath(target);
  return error ? { ok: false, error } : { ok: true };
});
handleTrusted("outputs:reveal", async (_event, workflowId, archiveName) => {
  const dir = path.join(outputRoot(), safeOutputKey(workflowId));
  if (typeof archiveName !== "string" || path.basename(archiveName) !== archiveName || !archiveName.endsWith(".zip")) return { ok: false, error: "Invalid output archive name." };
  const target = path.join(dir, archiveName);
  if (!(await fs.stat(target).catch(() => null))) return { ok: false, error: "Output archive was not found." };
  shell.showItemInFolder(target); return { ok: true };
});
handleTrusted("outputs:delete", async (_event, workflowId, archiveName) => {
  const dir = path.join(outputRoot(), safeOutputKey(workflowId));
  if (typeof archiveName !== "string" || path.basename(archiveName) !== archiveName || !archiveName.endsWith(".zip")) return { ok: false, error: "Invalid output archive name." };
  const target = path.join(dir, archiveName); const runDir = path.join(dir, archiveName.slice(0, -4));
  await fs.unlink(target).catch(() => {}); await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
  return { ok: true };
});
handleTrusted("outputs:read", async (_event, workflowId, archiveName, artifactName) => {
  const dir = path.join(outputRoot(), safeOutputKey(workflowId));
  if (typeof archiveName !== "string" || path.basename(archiveName) !== archiveName || !archiveName.endsWith(".zip") || typeof artifactName !== "string" || path.basename(artifactName) !== artifactName) return { ok: false, error: "Invalid output artifact reference." };
  const file = path.join(dir, archiveName.slice(0, -4), artifactName);
  const stat = await fs.stat(file).catch(() => null);
  if (!stat || !stat.isFile()) return { ok: false, error: "Output artifact was not found." };
  if (stat.size > 10 * 1024 * 1024) return { ok: false, error: "Preview is limited to 10 MB. Open the ZIP to view this artifact." };
  const data = await fs.readFile(file);
  const ext = path.extname(file).toLowerCase();
  const mime = ({ ".txt": "text/plain", ".csv": "text/csv", ".json": "application/json", ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" })[ext] || "application/octet-stream";
  return { ok: true, name: artifactName, mime, data: data.toString("base64"), text: mime.startsWith("text/") || mime === "application/json" ? data.toString("utf8") : undefined };
});


// Checks the latest published GitHub Release. A failed/offline check is non-fatal.
async function checkLatestRelease() {
  const { owner, repo } = GITHUB_RELEASE_REPOSITORY;
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "FlowForge-Desktop-Update-Checker", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(7000)
    });
    if (response.status === 404) return { ok: false, available: false, error: "No published GitHub release was found for the configured repository." };
    if (!response.ok) return { ok: false, available: false, error: `GitHub returned HTTP ${response.status}.` };
    const release = await response.json();
    if (release.draft || release.prerelease || typeof release.tag_name !== "string") return { ok: true, available: false };
    const current = app.getVersion().replace(/^v/i, "");
    const latest = release.tag_name.replace(/^v/i, "");
    const parse = value => value.split(/[.+-]/).slice(0, 3).map(part => Number.parseInt(part, 10) || 0);
    const a = parse(current), b = parse(latest);
    let newer = false;
    for (let i = 0; i < 3; i++) { if (b[i] !== a[i]) { newer = b[i] > a[i]; break; } }
    return { ok: true, available: newer, currentVersion: current, latestVersion: latest, releaseName: String(release.name || release.tag_name), notes: String(release.body || "").slice(0, 12000), url: String(release.html_url || `https://github.com/${owner}/${repo}/releases/latest`), publishedAt: release.published_at || null };
  } catch (error) {
    return { ok: false, available: false, error: error instanceof Error ? error.message : "Could not check GitHub releases." };
  }
}

handleTrusted("ai:api-info", async () => aiApi.info());
handleTrusted("ai:get-guidance-actions", async () => guidanceActions.slice(-500));
handleTrusted("ai:sync-workflows", async (_event, workflows) => {
  if (!Array.isArray(workflows) || workflows.length > 500) return { ok: false, error: "Invalid workflow library." };
  const incoming = workflows.filter(item => item && typeof item.id === "string" && item.document && typeof item.document.name === "string")
    .map(item => ({ id: item.id, document: item.document, updatedAt: item.updatedAt || null, aiTag: !!item.aiTag, aiProvenance: item.aiProvenance }));
  const merged = new Map(aiWorkflows.map(item => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  aiWorkflows = [...merged.values()].slice(-500);
  return { ok: true, count: aiWorkflows.length };
});

handleTrusted("app:get-version", async () => app.getVersion().replace(/^v/i, ""));
handleTrusted("app:check-updates", async () => checkLatestRelease());

handleTrusted("app:set-launch-at-login", (_event, enabled) => {
  if (typeof enabled !== "boolean") return { ok: false, error: "Expected a boolean launch setting." };
  try { app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: false }); return { ok: true, enabled }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
});

handleTrusted("open:external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) return shell.openExternal(url);
  return false;
});
