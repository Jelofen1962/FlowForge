"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");
const checks = [
  ["application version is set", typeof pkg.version === "string" && /^\d+\.\d+\.\d+/.test(pkg.version)],
  ["application version is synchronized with v0.3.24 release", pkg.version === "0.3.24"],
  ["About and status UI do not hard-code an old version", !/0\.3\.13/.test(fs.readFileSync(path.join(root, "src/ui/App.tsx"), "utf8"))],
  ["Windows NSIS target is configured", pkg.build?.win?.target?.some?.(target => (typeof target === "string" ? target : target.target) === "nsis")],
  ["packaged app uses ASAR", pkg.build?.asar === true],
  ["renderer disables Node integration", /nodeIntegration:\s*false/.test(main)],
  ["renderer enables context isolation", /contextIsolation:\s*true/.test(main)],
  ["renderer sandbox is enabled", /sandbox:\s*true/.test(main)],
  ["IPC is exposed through contextBridge", /contextBridge\.exposeInMainWorld\("flowforge"/.test(preload)],
  ["privileged IPC channels use sender validation", /function handleTrusted\(/.test(main) && !/ipcMain\.handle\(/.test(main.replace(/function handleTrusted\([\s\S]*?\n\}/, ""))],
  ["CI workflow exists", fs.existsSync(path.join(root, ".github/workflows/ci.yml"))],
  ["release workflow exists", fs.existsSync(path.join(root, ".github/workflows/release.yml"))]
];
let failed = false;
for (const [label, ok] of checks) {
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${label}\n`);
  if (!ok) failed = true;
}
if (failed) process.exitCode = 1;
