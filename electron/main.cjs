const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");

let win;
let engine = null;
let engineStopping = false;
let stdoutBuffer = "";
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
  if (isDev) win.loadURL("http://127.0.0.1:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
  win.on("closed", () => { win = null; });
}

function sendToRenderer(channel, value) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, value);
}

function emitLogLine(line) {
  const trimmed = line.trim();
  if (trimmed) sendToRenderer("engine:log", trimmed);
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
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => {
  if (engine && !engine.killed) {
    engineStopping = true;
    engine.kill("SIGTERM");
  }
});

async function startEngine(payload) {
  if (engine) return { ok: false, error: "An automation is already running." };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Invalid automation payload." };
  }
  let encoded;
  try {
    encoded = JSON.stringify({ ...payload, screenshotDirectory: payload.screenshotDirectory || path.join(app.getPath("userData"), "screenshots") });
    if (Buffer.byteLength(encoded, "utf8") > 5_000_000) {
      return { ok: false, error: "Workflow payload exceeds the 5 MB limit." };
    }
  } catch {
    return { ok: false, error: "Workflow payload could not be serialized." };
  }
  const script = path.join(__dirname, "../engine/runner.cjs");
  engineStopping = false;
  stdoutBuffer = "";
  try {
    engine = spawn(process.execPath, [script], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", FLOWFORGE_PAYLOAD: encoded },
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
    return { ok: true };
  } catch (error) {
    engine = null;
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

ipcMain.handle("engine:start", async (_event, payload) => startEngine(payload));

ipcMain.handle("recorder:start", async (_event, options = {}) => {
  if (engine) return { ok: false, error: "A browser session is already running. Stop it before starting the recorder." };
  const startUrl = typeof options.startUrl === "string" ? options.startUrl : "https://example.com";
  const browser = options.browser === "edge" ? "edge" : "chrome";
  if (!/^https?:\/\//i.test(startUrl)) return { ok: false, error: "Recorder start URL must use http or https." };
  const payload = { mode: "recorder", browser, startUrl, steps: [], profile: options.profile || {} };
  return await startEngine(payload);
});

ipcMain.handle("recorder:stop", async () => {
  if (!engine || !engine.stdin || engine.killed) return { ok: false, error: "No browser session is running." };
  engine.stdin.write(JSON.stringify({ type: "recorder:stop" }) + "\n");
  return { ok: true };
});

ipcMain.handle("recorder:navigate", async (_event, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return { ok: false, error: "Recorder URL must use http or https." };
  if (!engine || !engine.stdin || engine.killed) return { ok: false, error: "No browser session is running." };
  engine.stdin.write(JSON.stringify({ type: "navigate", url }) + "\n");
  return { ok: true };
});

ipcMain.handle("engine:stop", async () => {
  if (!engine) return { ok: true, alreadyStopped: true };
  if (!engineStopping) {
    engineStopping = true;
    try { engine.kill("SIGTERM"); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  }
  return { ok: true };
});

ipcMain.handle("profile:save", async (_event, profile) => {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return { ok: false, error: "Invalid profile." };
  const dir = path.join(app.getPath("userData"), "profiles");
  await fs.mkdir(dir, { recursive: true });
  const safe = String(profile.name || "default").replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "default";
  const target = path.join(dir, `${safe}.json`);
  await fs.writeFile(target, JSON.stringify(profile, null, 2), { encoding: "utf8", mode: 0o600 });
  return { ok: true, path: target };
});

ipcMain.handle("profile:list", async () => {
  const dir = path.join(app.getPath("userData"), "profiles");
  await fs.mkdir(dir, { recursive: true });
  return (await fs.readdir(dir)).filter(file => file.endsWith(".json"));
});

ipcMain.handle("open:external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) return shell.openExternal(url);
  return false;
});
