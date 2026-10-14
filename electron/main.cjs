const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
let win, engine;
const isDev = !app.isPackaged;
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1100, minHeight: 720,
    backgroundColor: "#0b0b0c",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  if (isDev) win.loadURL("http://127.0.0.1:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
ipcMain.handle("engine:start", async (_e, payload) => {
  if (engine) return { ok: false, error: "An automation is already running." };
  const script = path.join(__dirname, "../engine/runner.cjs");
  engine = spawn(process.execPath, [script], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", FLOWFORGE_PAYLOAD: JSON.stringify(payload) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  engine.stdout.on("data", d => win?.webContents.send("engine:log", String(d)));
  engine.stderr.on("data", d => win?.webContents.send("engine:log", String(d)));
  engine.on("close", code => { win?.webContents.send("engine:finished", { code }); engine = null; });
  return { ok: true };
});
ipcMain.handle("engine:stop", async () => {
  if (engine) { engine.kill(); engine = null; }
  return { ok: true };
});
ipcMain.handle("profile:save", async (_e, profile) => {
  const dir = path.join(app.getPath("userData"), "profiles");
  await fs.mkdir(dir, { recursive: true });
  const safe = String(profile.name || "default").replace(/[^a-z0-9_-]/gi, "_");
  await fs.writeFile(path.join(dir, `${safe}.json`), JSON.stringify(profile, null, 2), "utf8");
  return { ok: true, path: path.join(dir, `${safe}.json`) };
});
ipcMain.handle("profile:list", async () => {
  const dir = path.join(app.getPath("userData"), "profiles");
  await fs.mkdir(dir, { recursive: true });
  return (await fs.readdir(dir)).filter(x => x.endsWith(".json"));
});
ipcMain.handle("open:external", (_e, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) shell.openExternal(url);
});
