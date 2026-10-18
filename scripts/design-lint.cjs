#!/usr/bin/env node
/**
 * Static design-system checks for the FlowForge UI. Fast (no browser, no build), runs in CI.
 * Fails when the UI drifts from its rules:
 *   - no emoji glyphs in UI source (icons are Lucide SVGs)
 *   - no hard-coded colours outside styles/tokens.css (use semantic tokens)
 *   - every var(--token) that is used is defined; light & dark themes define the same tokens
 *   - no `transition: all`, reduced-motion is honoured, no third-party <script> in index.html
 *   - <img> always has alt text
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const uiDir = path.join(root, "src", "ui");
const errors = [];
const fail = (file, message) => errors.push(`${path.relative(root, file)}: ${message}`);

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const files = walk(uiDir);
const tsFiles = files.filter(f => /\.(ts|tsx)$/.test(f));
const cssFiles = files.filter(f => f.endsWith(".css"));
const read = f => fs.readFileSync(f, "utf8");

// 1. Emoji
for (const file of tsFiles) {
  const match = read(file).match(/\p{Extended_Pictographic}/u);
  if (match) fail(file, `emoji glyph "${match[0]}" found — use a Lucide icon instead`);
}

// 2. Hard-coded colours
for (const file of cssFiles.filter(f => !f.endsWith("tokens.css"))) {
  const source = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
  const hex = source.match(/#[0-9a-fA-F]{3,8}\b(?![\w-])/g);
  if (hex) fail(file, `hard-coded colour ${hex[0]} — use a token from tokens.css`);
  if (/\b(?:rgb|rgba)\(/.test(source)) fail(file, "rgb()/rgba() colour — use hsl(var(--token))");
  if (/transition:\s*all\b/.test(source)) fail(file, "`transition: all` — list the properties that change");
}
for (const file of tsFiles) {
  const source = read(file);
  if (/<img\b(?![^>]*\balt=)/.test(source)) fail(file, "<img> without alt text");
  if (/style=\{\{[^}]*#[0-9a-fA-F]{3,8}\b/.test(source)) fail(file, "inline hard-coded colour");
}

// 3. Tokens
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, "");
const allCss = cssFiles.map(f => stripComments(read(f))).join("\n");
const tokensCss = stripComments(read(path.join(uiDir, "styles", "tokens.css")));
const defined = new Set([...allCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
const inlineDefined = new Set(tsFiles.flatMap(f => [...read(f).matchAll(/["'](--[a-z0-9-]+)["']/gi)].map(m => m[1])));
for (const match of allCss.matchAll(/var\((--[a-z0-9-]+)/gi)) {
  if (!defined.has(match[1]) && !inlineDefined.has(match[1])) fail(path.join(uiDir, "styles"), `var(${match[1]}) is used but never defined`);
}
const block = selector => {
  const start = tokensCss.indexOf(selector);
  if (start < 0) return "";
  return tokensCss.slice(tokensCss.indexOf("{", start), tokensCss.indexOf("}", start));
};
const names = text => new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
const dark = names(block(':root[data-theme="dark"]'));
const light = names(block(':root[data-theme="light"]'));
for (const name of dark) if (!light.has(name)) fail(path.join(uiDir, "styles", "tokens.css"), `${name} is defined for dark but not light`);
for (const name of light) if (!dark.has(name)) fail(path.join(uiDir, "styles", "tokens.css"), `${name} is defined for light but not dark`);
for (const required of ["--background", "--foreground", "--primary", "--primary-foreground", "--muted", "--muted-foreground", "--border", "--ring", "--destructive"]) {
  if (!dark.has(required)) fail(path.join(uiDir, "styles", "tokens.css"), `missing shadcn token ${required}`);
}

// 4. Motion
if (!/prefers-reduced-motion:\s*reduce/.test(read(path.join(uiDir, "styles", "base.css")))) fail(path.join(uiDir, "styles", "base.css"), "missing prefers-reduced-motion handling");

// 5. index.html
const html = read(path.join(root, "index.html"));
for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
  if (/^https?:/.test(match[1])) fail(path.join(root, "index.html"), `third-party script ${match[1]} — the renderer is privileged, bundle dependencies instead`);
}
if (!/name="viewport"/.test(html)) fail(path.join(root, "index.html"), "missing viewport meta");

if (errors.length) {
  console.error(`Design lint failed (${errors.length}):\n - ${errors.join("\n - ")}`);
  process.exit(1);
}
console.log(`Design lint passed (${tsFiles.length} source files, ${cssFiles.length} stylesheets).`);
