"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");
const checks = [
  ["application version is set", typeof pkg.version === "string" && /^\d+\.\d+\.\d+/.test(pkg.version)],
  ["application version matches the GitHub release tag when running a tag build", (() => {
    const ref = process.env.GITHUB_REF_NAME || process.env.RELEASE_TAG || "";
    const match = ref.match(/^v?(\d+\.\d+\.\d+)$/);
    return !match || pkg.version === match[1];
  })()],
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
