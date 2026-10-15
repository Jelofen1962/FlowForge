"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const crcTable = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; })();
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function dosDateTime(date = new Date()) { const year = Math.max(1980, date.getFullYear()); return { time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2), date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() }; }
async function walk(dir, root = dir) { const result = []; for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) result.push(...await walk(full, root)); else if (entry.isFile()) result.push({ full, name: path.relative(root, full).split(path.sep).join("/") }); } return result; }
async function createZipFromDirectory(sourceDir, zipPath) {
  const files = await walk(sourceDir); const totalSize = files.reduce((sum, file) => { try { return sum + require("node:fs").statSync(file.full).size; } catch { return sum; } }, 0);
  if (totalSize > 500 * 1024 * 1024) throw new Error("Workflow output archive exceeds the 500 MB total size limit.");
  const local = []; const central = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8"); const data = await fs.readFile(file.full); const compressed = zlib.deflateRawSync(data); const crc = crc32(data); const dt = dosDateTime();
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(dt.time, 10); header.writeUInt16LE(dt.date, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26); header.writeUInt16LE(0, 28);
    local.push(header, name, compressed);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x0314, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt16LE(dt.time, 12); c.writeUInt16LE(dt.date, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(compressed.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt16LE(0, 30); c.writeUInt16LE(0, 32); c.writeUInt16LE(0, 34); c.writeUInt16LE(0, 36); c.writeUInt32LE(0, 38); c.writeUInt32LE(offset, 42); central.push(c, name); offset += header.length + name.length + compressed.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  await fs.mkdir(path.dirname(zipPath), { recursive: true }); await fs.writeFile(zipPath, Buffer.concat([...local, ...central, end])); return { zipPath, fileCount: files.length, files: files.map(f => f.name) };
}
module.exports = { createZipFromDirectory, crc32 };
