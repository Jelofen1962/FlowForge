"use strict";
const fs = require("node:fs");
const path = require("node:path");
const packagePath = path.resolve(__dirname, "..", "package.json");
const requested = process.argv[2] || process.env.GITHUB_REF_NAME || process.env.RELEASE_TAG || "";
const match = requested.match(/^v?(\d+\.\d+\.\d+)$/);
if (!match) {
  console.error("Usage: node scripts/sync-release-version.cjs vX.Y.Z (or set GITHUB_REF_NAME to a vX.Y.Z tag)");
  process.exit(1);
}
const version = match[1];
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (pkg.version !== version) {
  const previous = pkg.version;
  pkg.version = version;
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`Synchronized package.json version ${previous} -> ${version} from GitHub release tag ${requested}`);
} else {
  console.log(`package.json already matches GitHub release tag ${requested} (${version})`);
}
