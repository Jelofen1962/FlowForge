import { describe, expect, it } from "vitest";
import { validateSessionSnapshot } from "../src/core/session";
const valid = { version:1, createdAt:"2026-10-14T10:00:00.000Z", origin:"https://example.com", cookies:[{name:"sid",value:"abc",domain:"example.com",path:"/",secure:true}], localStorage:[{key:"theme",value:"dark"}], sessionStorage:[] };
describe("session snapshot validation", () => {
  it("accepts a well-formed single-origin snapshot", () => { expect(validateSessionSnapshot(valid).origin).toBe("https://example.com"); });
  it("rejects non-http origins and malformed storage", () => {
    expect(() => validateSessionSnapshot({...valid,origin:"file:///tmp/x"})).toThrow(/origin/i);
    expect(() => validateSessionSnapshot({...valid,localStorage:[{key:3,value:"x"}]})).toThrow(/storage/i);
  });
  it("rejects invalid cookie expiry and oversized snapshots", () => {
    expect(() => validateSessionSnapshot({...valid,cookies:[{name:"sid",value:"x",expiry:-1}]})).toThrow(/expiry/i);
    expect(() => validateSessionSnapshot({...valid,localStorage:[{key:"x",value:"z".repeat(2_000_000)}]})).toThrow(/size/i);
  });
});
