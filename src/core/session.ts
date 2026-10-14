export type StorageEntry = { key: string; value: string };
export type SessionCookie = {
  name: string; value: string; domain?: string; path?: string; expiry?: number;
  secure?: boolean; httpOnly?: boolean; sameSite?: "Strict" | "Lax" | "None";
};
export type SessionSnapshot = {
  version: 1; createdAt: string; origin: string; cookies: SessionCookie[];
  localStorage: StorageEntry[]; sessionStorage: StorageEntry[];
};
const MAX_BYTES = 2_000_000;
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function validStorage(value: unknown): value is StorageEntry[] {
  return Array.isArray(value) && value.length <= 10000 && value.every(x => isRecord(x) && typeof x.key === "string" && typeof x.value === "string" && x.key.length <= 10000 && x.value.length <= 200000);
}
export function validateSessionSnapshot(value: unknown): SessionSnapshot {
  if (!isRecord(value) || value.version !== 1 || typeof value.createdAt !== "string" || typeof value.origin !== "string") throw new Error("Unsupported or malformed session snapshot.");
  let url: URL;
  try { url = new URL(value.origin); } catch { throw new Error("Session origin is not a valid URL."); }
  if (!(["http:", "https:"].includes(url.protocol)) || url.origin !== value.origin || url.pathname !== "/" || url.search || url.hash) throw new Error("Session origin must be a canonical HTTP(S) origin.");
  if (!Array.isArray(value.cookies) || value.cookies.length > 5000) throw new Error("Session cookie list is invalid or too large.");
  const cookies = value.cookies.map((raw): SessionCookie => {
    if (!isRecord(raw) || typeof raw.name !== "string" || !raw.name || typeof raw.value !== "string") throw new Error("Session contains an invalid cookie.");
    if (raw.name.length > 4096 || raw.value.length > 100000) throw new Error("Session cookie exceeds size limits.");
    if (raw.domain !== undefined && (typeof raw.domain !== "string" || raw.domain.length > 255)) throw new Error("Session cookie domain is invalid.");
    if (raw.path !== undefined && typeof raw.path !== "string") throw new Error("Session cookie path is invalid.");
    if (raw.expiry !== undefined && (typeof raw.expiry !== "number" || !Number.isFinite(raw.expiry) || raw.expiry < 0)) throw new Error("Session cookie expiry is invalid.");
    if (raw.sameSite !== undefined && !["Strict", "Lax", "None"].includes(String(raw.sameSite))) throw new Error("Session cookie SameSite value is invalid.");
    for (const key of ["secure", "httpOnly"] as const) if (raw[key] !== undefined && typeof raw[key] !== "boolean") throw new Error(`Session cookie ${key} flag is invalid.`);
    return { name: raw.name, value: raw.value, ...(raw.domain ? { domain: raw.domain as string } : {}), ...(raw.path ? { path: raw.path as string } : {}), ...(typeof raw.expiry === "number" ? { expiry: raw.expiry } : {}), ...(typeof raw.secure === "boolean" ? { secure: raw.secure } : {}), ...(typeof raw.httpOnly === "boolean" ? { httpOnly: raw.httpOnly } : {}), ...(raw.sameSite ? { sameSite: raw.sameSite as SessionCookie["sameSite"] } : {}) };
  });
  if (!validStorage(value.localStorage) || !validStorage(value.sessionStorage)) throw new Error("Session storage size or data is invalid.");
  const snapshot: SessionSnapshot = { version: 1, createdAt: value.createdAt, origin: url.origin, cookies, localStorage: value.localStorage, sessionStorage: value.sessionStorage };
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > MAX_BYTES) throw new Error("Session snapshot exceeds the 2 MB limit.");
  return snapshot;
}
